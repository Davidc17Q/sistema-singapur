// Vistas del sistema. Toda cifra visible sale de web/datos, y ninguna se teclea en la prosa.
(async function () {
  const leer = (a) => fetch('datos/' + a).then((r) => { if (!r.ok) throw new Error(a); return r.json(); });
  const $ = (id) => document.getElementById(id);
  const n0 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
  const n1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const titulo = (s) => String(s).toLowerCase().replace(/(^|[\s/-])(\S)/g, (m, a, b) => a + b.toUpperCase());
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  let zonas, atr, tra, viv, pri, cat;
  try {
    [zonas, atr, tra, viv, pri, cat] = await Promise.all(['zonas.geojson', 'atracciones.json', 'transporte.json', 'vivienda.json', 'privacidad.json', 'fuentes.json'].map(leer));
  } catch (e) {
    document.querySelector('main').innerHTML = '<section><h2>No se pudieron cargar los datos</h2><p>Recargue la página. Si sigue fallando, el sistema no muestra cifras antes que mostrarlas sin fuente.</p></section>';
    return;
  }
  const fichas = Object.fromEntries(cat.map((f) => [f.id, f]));

  // ── Ficha de procedencia: un solo lugar para todas las cifras ──
  const registro = [];
  function cifra(texto, o) {
    registro.push(o);
    return `<button type="button" class="cifra" data-f="${registro.length - 1}">${esc(texto)}</button>`;
  }
  function deCifra(c, texto) {
    return cifra(texto, { valor: texto, rotulo: c.unidad, fuente: c.fuente, vigencia: c.vigencia });
  }
  function abrirFicha(o) {
    const f = fichas[o.fuente];
    $('ficha-cuerpo').innerHTML = `
      <p class="ficha-valor" id="ficha-titulo">${esc(o.valor)}</p>
      <p class="ficha-rotulo">${esc(o.rotulo || '')}</p>
      ${o.proxy ? '<p class="marca-proxy"><span class="etiqueta">PROXY</span> ' + esc(o.proxy) + '</p>' : ''}
      <dl class="ficha-datos">
        <dt>Fuente</dt><dd><strong>${esc(f.id)}</strong> · ${esc(f.nombre)}</dd>
        <dt>Publica</dt><dd>${esc(f.entidad)}</dd>
        <dt>Vigencia</dt><dd>${esc(o.vigencia || f.vigencia)}</dd>
        <dt>Probada el</dt><dd>${esc(f.probado)}</dd>
        <dt>Licencia</dt><dd>${esc(f.licencia)}</dd>
        <dt>Enlace</dt><dd><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.url)}</a></dd>
      </dl>`;
    const d = $('ficha');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (b) abrirFicha(registro[Number(b.dataset.f)]);
    if (e.target === $('ficha')) $('ficha').close();
  });

  // ── Portada ──
  const pruebas = cat.filter((f) => f.estado === 'integrada').map((f) => f.probado).sort();
  const ultima = pruebas[pruebas.length - 1];
  $('revisado').textContent = 'Datos probados el ' + ultima;
  if ((Date.now() - new Date(ultima)) / 864e5 > 365) {
    const av = $('aviso-viejo');
    av.hidden = false;
    av.textContent = 'Nadie ha vuelto a probar estas fuentes en más de un año. Tome estas cifras como históricas.';
  }

  // ── Panorama ──
  const c = viv.cifras;
  const cara = viv.towns.filter((t) => t.mediana_sgd_m2).sort((a, b) => b.mediana_sgd_m2 - a.mediana_sgd_m2);
  const masCara = cara[0], masBarata = cara[cara.length - 1];
  $('lectura-panorama').innerHTML =
    `Entre ${esc(viv.ventana.replace(' a ', ' y '))} se registraron ${deCifra(c.ventas_ventana, n0.format(c.ventas_ventana.valor))} reventas. ` +
    `El metro cuadrado en ${esc(titulo(masCara.town))} cuesta ${cifra(n1.format(masCara.mediana_sgd_m2 / masBarata.mediana_sgd_m2) + ' veces', { valor: n1.format(masCara.mediana_sgd_m2 / masBarata.mediana_sgd_m2) + ' veces', rotulo: 'Razón entre las medianas por m² de ' + titulo(masCara.town) + ' y ' + titulo(masBarata.town), fuente: 'F06', vigencia: viv.ventana })} lo que cuesta en ${esc(titulo(masBarata.town))}.`;
  const tile = (rot, cc, val) => {
    registro.push({ valor: val, rotulo: cc.unidad, fuente: cc.fuente, vigencia: cc.vigencia });
    return `<button type="button" class="tile" data-f="${registro.length - 1}"><span class="rotulo">${esc(rot)}</span><span class="valor">${esc(val)}</span><span class="vig">${esc(cc.vigencia)} · <span class="id">${esc(cc.fuente)}</span></span></button>`;
  };
  $('tiles').innerHTML =
    tile('Mediana del m² en todo el país', c.mediana_nacional_sgd_m2, 'S$ ' + n0.format(c.mediana_nacional_sgd_m2.valor)) +
    tile('Zona más cara: ' + titulo(masCara.town), c.zona_mas_cara_sgd_m2, 'S$ ' + n0.format(c.zona_mas_cara_sgd_m2.valor)) +
    tile('Zona más barata: ' + titulo(masBarata.town), c.zona_mas_barata_sgd_m2, 'S$ ' + n0.format(c.zona_mas_barata_sgd_m2.valor)) +
    tile('Cambio del m² desde 2017', c.cambio_desde_2017_pct, (c.cambio_desde_2017_pct.valor > 0 ? '+' : '') + n1.format(c.cambio_desde_2017_pct.valor) + ' %');

  // ── Tabla de zonas ──
  const textoProxy = (t) => t.asignacion === 'manual'
    ? `Esta zona se asignó a mano a ${t.zonas.map(titulo).join(', ')}. Sus bordes no coinciden con los de esas áreas.`
    : 'La zona de HDB se pinta sobre el área de igual nombre. Sus bordes pueden no coincidir.';
  const maxM2 = masCara.mediana_sgd_m2;
  const fichaT = (t, val, rot) => cifra(val, { valor: val, rotulo: rot + ' · ' + titulo(t.town), fuente: 'F06', vigencia: viv.ventana, proxy: textoProxy(t) });
  $('tabla-zonas').innerHTML = `<thead><tr><th>Zona</th><th class="num">S$ por m²</th><th class="celda-barra ocultar-movil" aria-hidden="true"></th><th class="num">Año</th><th class="num">Ventas</th></tr></thead><tbody>` +
    cara.map((t) => `<tr data-zona="${esc(t.town)}">
      <td>${esc(titulo(t.town))}${t.asignacion === 'manual' ? ' <span class="etiqueta">PROXY</span>' : ''}</td>
      <td class="num">${fichaT(t, n0.format(t.mediana_sgd_m2), 'Mediana en S$ por m²')}</td>
      <td class="celda-barra ocultar-movil" aria-hidden="true"><div class="barra-fondo"><div class="barra-llena" style="width:${(100 * t.mediana_sgd_m2 / maxM2).toFixed(1)}%"></div></div></td>
      <td class="num">${t.variacion_anual_pct == null ? '—' : fichaT(t, (t.variacion_anual_pct > 0 ? '+' : '') + n1.format(t.variacion_anual_pct) + ' %', 'Cambio contra los 12 meses anteriores')}</td>
      <td class="num">${fichaT(t, n0.format(t.ventas), 'Ventas registradas')}</td>
    </tr>`).join('') + '</tbody>';
  $('nota-tabla').textContent = `Medianas de ${viv.ventana}. Solo se publican grupos con ${viv.minimo_ventas} ventas o más. S$ son dólares de Singapur.`;

  // ── Mapa ──
  const townPorZona = {};
  viv.towns.forEach((t) => t.zonas.forEach((z) => { townPorZona[z] = t; }));
  zonas.features.forEach((f, i) => {
    const z = f.properties.zona, t = townPorZona[z];
    f.id = i;
    f.properties.m2 = t && t.mediana_sgd_m2 ? t.mediana_sgd_m2 : -1;
    f.properties.edificios = viv.edificios_por_zona[z] || 0;
  });
  const cuantiles = (vals, k) => {
    const s = [...vals].sort((a, b) => a - b);
    return Array.from({ length: k - 1 }, (_, i) => s[Math.floor(s.length * (i + 1) / k)]);
  };
  const cortes = {
    precio: cuantiles(cara.map((t) => t.mediana_sgd_m2), 5),
    edificios: cuantiles(Object.values(viv.edificios_por_zona), 5),
  };
  let capa = 'precio', mapa = null, seleccionada = null;
  const colorExpr = () => {
    const prop = capa === 'precio' ? 'm2' : 'edificios';
    const [c1, c2, c3, c4] = cortes[capa];
    return ['case', ['<=', ['get', prop], capa === 'precio' ? -1 : 0], css('--sin-dato'),
      ['step', ['get', prop], css('--seq-1'), c1, css('--seq-2'), c2, css('--seq-3'), c3, css('--seq-4'), c4, css('--seq-5')]];
  };
  function pintarLeyenda() {
    const k = cortes[capa];
    const f = capa === 'precio' ? (v) => n0.format(Math.round(v / 100) * 100) : (v) => n0.format(v);
    const rangos = ['menos de ' + f(k[0]), f(k[0]) + ' a ' + f(k[1]), f(k[1]) + ' a ' + f(k[2]), f(k[2]) + ' a ' + f(k[3]), 'más de ' + f(k[3])];
    $('leyenda').innerHTML = `<span>${capa === 'precio' ? 'S$ por m², ' + esc(viv.ventana) : 'Edificios HDB por área'}</span>` +
      rangos.map((r, i) => `<span class="tramo"><i class="muestra" style="background:var(--seq-${i + 1})"></i>${esc(r)}</span>`).join('') +
      `<span class="tramo"><i class="muestra" style="background:var(--sin-dato)"></i>${capa === 'precio' ? 'sin reventas HDB' : 'sin edificios HDB'}</span>` +
      ($('ver-atracciones').checked ? '<span class="tramo"><i class="muestra circulo" style="background:var(--punto)"></i>atracción</span>' : '');
  }
  function mostrarDetalle(z) {
    const f = zonas.features.find((x) => x.properties.zona === z);
    const t = townPorZona[z];
    const ed = viv.edificios_por_zona[z] || 0;
    const nAtr = atr.por_zona[z] || 0;
    const filas = [];
    const edFicha = cifra(n0.format(ed), { valor: n0.format(ed), rotulo: 'Edificios HDB en ' + titulo(z), fuente: 'F05', vigencia: viv.cifras.edificios_hdb.vigencia });
    const atFicha = cifra(n0.format(nAtr), { valor: n0.format(nAtr), rotulo: 'Atracciones en ' + titulo(z), fuente: 'F02', vigencia: atr.cifras.total_atracciones.vigencia });
    if (t && t.mediana_sgd_m2) {
      filas.push(`<div><dt>Mediana por m²</dt><dd>S$ ${fichaT(t, n0.format(t.mediana_sgd_m2), 'Mediana en S$ por m²')}</dd></div>`);
      filas.push(`<div><dt>Mediana de venta</dt><dd>S$ ${fichaT(t, n0.format(t.mediana_precio_sgd), 'Mediana del precio de venta en S$')}</dd></div>`);
      filas.push(`<div><dt>Ventas en 12 meses</dt><dd>${fichaT(t, n0.format(t.ventas), 'Ventas registradas')}</dd></div>`);
    }
    filas.push(`<div><dt>Edificios HDB</dt><dd>${edFicha}</dd></div>`);
    filas.push(`<div><dt>Atracciones</dt><dd>${atFicha}</dd></div>`);
    const tipos = t ? Object.entries(t.por_tipo) : [];
    $('detalle').innerHTML = `<h3>${esc(titulo(z))} <small style="font-weight:400;color:var(--texto-2)">· ${esc(titulo(f.properties.region))}</small></h3>
      ${t ? `<p class="marca-proxy"><span class="etiqueta">PROXY</span> Datos de la zona HDB ${esc(titulo(t.town))}. ${esc(textoProxy(t))}</p>` : '<p class="nota">Esta área no tiene reventas HDB en el lago. No quiere decir que sea barata: aquí el sistema no sabe.</p>'}
      <dl>${filas.join('')}</dl>
      ${tipos.length ? `<h3>Por tipo de apartamento</h3><div class="tabla-envoltura"><table><thead><tr><th>Tipo</th><th class="num">Mediana (S$)</th><th class="num">Ventas</th></tr></thead><tbody>${tipos.map(([k, d]) => `<tr><td>${esc(titulo(k))}</td><td class="num">${fichaT(t, n0.format(d.mediana_precio_sgd), 'Mediana de ' + k)}</td><td class="num">${fichaT(t, n0.format(d.ventas), 'Ventas de ' + k)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    if (mapa && mapa.isStyleLoaded()) {
      mapa.setFilter('zonas-sel', ['==', ['get', 'zona'], z]);
    }
    seleccionada = z;
  }
  document.querySelector('#tabla-zonas tbody').addEventListener('click', (e) => {
    if (e.target.closest('[data-f]')) return;
    const fila = e.target.closest('tr[data-zona]');
    if (fila) {
      const t = viv.towns.find((x) => x.town === fila.dataset.zona);
      mostrarDetalle(t.zonas[0]);
      $('mapa-lienzo').scrollIntoView({ block: 'center' });
    }
  });

  const puntos = {
    type: 'FeatureCollection',
    features: atr.filas.map((f) => ({ type: 'Feature', properties: { nombre: f.nombre, zona: f.zona || '' }, geometry: { type: 'Point', coordinates: [f.lon, f.lat] } })),
  };
  function pintarMapa() {
    if (!mapa || !mapa.getLayer('zonas')) return;
    mapa.setPaintProperty('zonas', 'fill-color', colorExpr());
    mapa.setPaintProperty('bordes', 'line-color', css('--borde-zona'));
    mapa.setPaintProperty('zonas-sel', 'line-color', css('--texto'));
    mapa.setPaintProperty('puntos', 'circle-color', css('--punto'));
    mapa.setPaintProperty('puntos', 'circle-stroke-color', css('--superficie'));
    mapa.setLayoutProperty('puntos', 'visibility', $('ver-atracciones').checked ? 'visible' : 'none');
    pintarLeyenda();
  }
  pintarLeyenda();
  try {
    mapa = new maplibregl.Map({
      container: 'mapa-lienzo',
      style: { version: 8, sources: {}, layers: [] },
      bounds: [[103.59, 1.2], [104.1, 1.48]],
      fitBoundsOptions: { padding: 12 },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: window.matchMedia('(pointer: coarse)').matches,
    });
    mapa.touchZoomRotate.disableRotation();
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapa.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Límites: URA (F10), Singapore Open Data Licence v1.0' }));
    mapa.on('load', () => {
      mapa.addSource('zonas', { type: 'geojson', data: zonas });
      mapa.addSource('puntos', { type: 'geojson', data: puntos });
      mapa.addLayer({ id: 'zonas', type: 'fill', source: 'zonas', paint: { 'fill-color': colorExpr() } });
      mapa.addLayer({ id: 'bordes', type: 'line', source: 'zonas', paint: { 'line-color': css('--borde-zona'), 'line-width': 1.5 } });
      mapa.addLayer({ id: 'zonas-sel', type: 'line', source: 'zonas', filter: ['==', ['get', 'zona'], ''], paint: { 'line-color': css('--texto'), 'line-width': 2.5 } });
      mapa.addLayer({ id: 'puntos', type: 'circle', source: 'puntos', layout: { visibility: 'none' }, paint: { 'circle-radius': 5, 'circle-color': css('--punto'), 'circle-stroke-width': 2, 'circle-stroke-color': css('--superficie') } });
      const emergente = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      const nombreZona = (f) => {
        const t = townPorZona[f.properties.zona];
        return `<strong>${esc(titulo(f.properties.zona))}</strong><br>` + (capa === 'precio'
          ? (t && t.mediana_sgd_m2 ? 'S$ ' + n0.format(t.mediana_sgd_m2) + ' por m²' : 'sin reventas HDB')
          : n0.format(f.properties.edificios) + ' edificios HDB');
      };
      if (window.matchMedia('(hover: hover)').matches) {
        mapa.on('mousemove', 'zonas', (e) => {
          mapa.getCanvas().style.cursor = 'pointer';
          emergente.setLngLat(e.lngLat).setHTML(nombreZona(e.features[0])).addTo(mapa);
        });
        mapa.on('mouseleave', 'zonas', () => { mapa.getCanvas().style.cursor = ''; emergente.remove(); });
      }
      mapa.on('click', 'zonas', (e) => mostrarDetalle(e.features[0].properties.zona));
      if (seleccionada) mapa.setFilter('zonas-sel', ['==', ['get', 'zona'], seleccionada]);
      pintarMapa();
    });
  } catch (e) {
    $('mapa-lienzo').innerHTML = '<p class="nota" style="padding:16px">Este navegador no pudo dibujar el mapa. La tabla de abajo trae los mismos datos.</p>';
    $('mapa-lienzo').style.height = 'auto';
    $('mapa-lienzo').style.minHeight = '0';
  }
  document.querySelectorAll('[data-capa]').forEach((b) => b.addEventListener('click', () => {
    capa = b.dataset.capa;
    document.querySelectorAll('[data-capa]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    pintarMapa();
    pintarLeyenda();
  }));
  $('ver-atracciones').addEventListener('change', () => { pintarMapa(); pintarLeyenda(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { pintarMapa(); dibujarLinea(); });

  // ── Evolución ──
  const serie = viv.series.mediana_mensual_sgd_m2.puntos;
  const primero = serie[0], ultimoP = serie[serie.length - 1];
  $('lectura-evolucion').innerHTML = `Responde: ¿cómo cambian los precios en el tiempo? La mediana nacional del m² pasó de S$ ${fichaS(primero)} en ${esc(primero[0])} a S$ ${fichaS(ultimoP)} en ${esc(ultimoP[0])}. La línea describe el mercado: no explica la causa del cambio.`;
  function fichaS(p) {
    return cifra(n0.format(p[1]), { valor: 'S$ ' + n0.format(p[1]), rotulo: 'Mediana nacional por m², con ' + n0.format(p[2]) + ' ventas', fuente: 'F06', vigencia: p[0] });
  }
  $('pie-linea').innerHTML = cifra('Fuente F06', { valor: 'Serie mensual', rotulo: 'Mediana nacional en S$ por m²', fuente: 'F06', vigencia: primero[0] + ' a ' + ultimoP[0] }) + ` · ${esc(primero[0])} a ${esc(ultimoP[0])} · probada el ${esc(fichas.F06.probado)} · ${serie.length} meses`;
  function dibujarLinea() {
    const cont = $('linea');
    const W = Math.max(320, cont.clientWidth || 640), H = W < 520 ? 240 : 300;
    const m = { i: 52, d: 12, s: 12, b: 26 };
    const vals = serie.map((p) => p[1]);
    const techo = Math.ceil(Math.max(...vals) / 2000) * 2000;
    const x = (i) => m.i + i * (W - m.i - m.d) / (serie.length - 1);
    const y = (v) => H - m.b - v * (H - m.s - m.b) / techo;
    let g = '';
    for (let v = 0; v <= techo; v += 2000) g += `<line x1="${m.i}" x2="${W - m.d}" y1="${y(v)}" y2="${y(v)}" stroke="${css('--reja')}"/><text x="${m.i - 8}" y="${y(v) + 4}" text-anchor="end">${n0.format(v)}</text>`;
    const anios = W < 520 ? 2 : 1;
    serie.forEach((p, i) => { if (p[0].endsWith('-01') && Number(p[0].slice(0, 4)) % anios === 1 % anios) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${p[0].slice(0, 4)}</text>`; });
    const d = serie.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' ');
    cont.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Línea de la mediana nacional por metro cuadrado, de ${primero[0]} a ${ultimoP[0]}. Sube de ${n0.format(primero[1])} a ${n0.format(ultimoP[1])} dólares de Singapur.">${g}
      <path d="${d}" fill="none" stroke="${css('--serie')}" stroke-width="2" stroke-linejoin="round"/>
      <g id="marca"><line id="m-l" y1="${m.s}" y2="${H - m.b}" stroke="${css('--texto-3')}" visibility="hidden"/><circle id="m-c" r="4" fill="${css('--serie')}" stroke="${css('--superficie')}" stroke-width="2" visibility="hidden"/></g>
      <rect id="zona-toque" x="${m.i}" y="${m.s}" width="${W - m.i - m.d}" height="${H - m.s - m.b}" fill="transparent"/></svg>`;
    const zona = $('zona-toque');
    const svg = cont.querySelector('svg');
    const mostrar = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) * W / r.width;
      const i = Math.max(0, Math.min(serie.length - 1, Math.round((px - m.i) * (serie.length - 1) / (W - m.i - m.d))));
      const p = serie[i];
      $('m-l').setAttribute('x1', x(i)); $('m-l').setAttribute('x2', x(i)); $('m-l').setAttribute('visibility', 'visible');
      $('m-c').setAttribute('cx', x(i)); $('m-c').setAttribute('cy', y(p[1])); $('m-c').setAttribute('visibility', 'visible');
      $('info-punto').innerHTML = `<strong>${esc(p[0])}</strong>: S$ ${fichaS(p)} por m², con ${n0.format(p[2])} ventas`;
    };
    zona.addEventListener('pointermove', mostrar);
    zona.addEventListener('pointerdown', mostrar);
    $('info-punto').innerHTML = `<strong>${esc(ultimoP[0])}</strong>: S$ ${fichaS(ultimoP)} por m², con ${n0.format(ultimoP[2])} ventas`;
  }
  dibujarLinea();
  let espera;
  window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(dibujarLinea, 150); });

  // ── Atracciones ──
  const ca = atr.cifras;
  const zonaTop = Object.entries(atr.por_zona).sort((a, b) => b[1] - a[1])[0];
  $('lectura-atracciones').innerHTML = `El lago tiene ${deCifra(ca.total_atracciones, n0.format(ca.total_atracciones.valor))} atracciones en ${deCifra(ca.zonas_con_atraccion, n0.format(ca.zonas_con_atraccion.valor))} de las 55 áreas. ${esc(titulo(zonaTop[0]))} concentra ${cifra(n0.format(zonaTop[1]), { valor: n0.format(zonaTop[1]), rotulo: 'Atracciones en ' + titulo(zonaTop[0]), fuente: 'F02', vigencia: ca.total_atracciones.vigencia })}. Actívelas en el mapa para compararlas con los precios.`;
  const anioAtr = (atr.filas.map((f) => f.fecha_actualizacion_fuente).filter(Boolean).sort().pop() || '').slice(0, 4);
  $('anio-atracciones').textContent = anioAtr || 'una fecha que la fuente no declara';
  let visibles = 12;
  function pintarAtracciones() {
    const q = $('buscar-atraccion').value.trim().toLowerCase();
    const res = atr.filas.filter((f) => !q || f.nombre.toLowerCase().includes(q) || (f.zona || '').toLowerCase().includes(q));
    $('lista-atracciones').innerHTML = res.slice(0, visibles).map((f) => `<li><strong>${esc(f.nombre)}</strong>
      <span class="donde">${esc(f.zona ? titulo(f.zona) : 'Fuera del límite terrestre')}${f.direccion ? ' · ' + esc(f.direccion) : ''}</span>
      ${f.descripcion_corta ? `<p lang="en">${esc(f.descripcion_corta)}</p>` : ''}
      ${cifra('Fuente F02', { valor: f.nombre, rotulo: 'Atracción', fuente: 'F02', vigencia: f.fecha_actualizacion_fuente ? 'registro editado el ' + f.fecha_actualizacion_fuente : 'la fuente no da fecha' })}</li>`).join('') || '<li>No hay atracciones con esa búsqueda.</li>';
    $('mas-atracciones').hidden = res.length <= visibles;
    $('mas-atracciones').textContent = `Ver más (quedan ${res.length - visibles})`;
  }
  $('buscar-atraccion').addEventListener('input', () => { visibles = 12; pintarAtracciones(); });
  $('mas-atracciones').addEventListener('click', () => { visibles += 24; pintarAtracciones(); });
  pintarAtracciones();

  // ── Transporte ──
  const ct = tra.cifras;
  $('lectura-transporte').innerHTML = `En 2015, ${deCifra(ct.porcentaje_transporte_publico, n1.format(ct.porcentaje_transporte_publico.valor) + ' %')} de los residentes que trabajan iba en bus o MRT, solos o combinados, y ${deCifra(ct.porcentaje_carro, n1.format(ct.porcentaje_carro.valor) + ' %')} iba solo en carro.`;
  const grupos = [...new Set(tra.filas.map((f) => f.grupo_edad))];
  $('edad').innerHTML = grupos.map((g) => `<option>${esc(g)}</option>`).join('');
  function pintarTransporte() {
    const g = $('edad').value;
    const filas = tra.filas.filter((f) => f.grupo_edad === g).sort((a, b) => b.porcentaje - a.porcentaje);
    const max = filas[0].porcentaje;
    $('barras-transporte').innerHTML = filas.map((f) => `<div class="fila-barra"><span class="nombre">${esc(f.modo_transporte)}</span>
      ${cifra(n1.format(f.porcentaje) + ' %', { valor: n1.format(f.porcentaje) + ' %', rotulo: f.modo_transporte + ' · ' + g + ' · ' + n1.format(f.trabajadores_miles || 0) + ' mil personas', fuente: 'F03', vigencia: ct.porcentaje_transporte_publico.vigencia })}
      <div class="barra-fondo"><div class="barra-llena" style="width:${(100 * f.porcentaje / max).toFixed(1)}%"></div></div></div>`).join('');
  }
  $('edad').addEventListener('change', pintarTransporte);
  pintarTransporte();

  // ── Lo que no sabe ──
  const cp = pri.cifras;
  $('evidencia-privacidad').innerHTML = `Con bloque, calle, piso y mes, ${deCifra(cp.pct_unicos_con_direccion, n1.format(cp.pct_unicos_con_direccion.valor) + ' %')} de las ventas queda sola en su combinación: señala un apartamento y su precio. Con zona, tipo y mes, solo ${deCifra(cp.pct_unicos_agregado, n1.format(cp.pct_unicos_agregado.valor) + ' %')}.`;
  $('minimo').textContent = viv.minimo_ventas;

  // ── Fuentes ──
  const cuenta = (e) => cat.filter((f) => f.estado === e).length;
  $('lectura-fuentes').textContent = `Rastreamos ${cat.length} fuentes: ${cuenta('integrada')} integradas, ${cuenta('candidata')} candidatas y ${cuenta('descartada')} descartadas. Lo que no entró también se documenta.`;
  $('tabla-fuentes').innerHTML = `<thead><tr><th>ID</th><th>Fuente</th><th>Estado</th><th>Vigencia</th><th>Probada</th><th>Licencia</th><th>Por qué</th></tr></thead><tbody>` +
    cat.map((f) => `<tr id="f-${esc(f.id)}"><td><strong>${esc(f.id)}</strong></td><td><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.nombre)}</a><br><span class="nota">${esc(f.entidad)}</span></td><td>${esc(f.estado)}</td><td>${esc(f.vigencia)}</td><td class="num">${esc(f.probado)}</td><td>${esc(f.licencia)}</td><td>${esc(f.nota)}</td></tr>`).join('') + '</tbody>';
  const avisoLic = 'https://data.gov.sg/open-data-licence';
  $('avisos').innerHTML = cat.filter((f) => f.estado === 'integrada').map((f) => `<p>Contains information from ${esc(f.nombre)} accessed on ${esc(f.probado)} from <a href="${esc(f.url)}">data.gov.sg</a> which is made available under the terms of the <a href="${avisoLic}">Singapore Open Data Licence version 1.0</a>.</p>`).join('');
})();
