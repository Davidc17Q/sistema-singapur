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
      <td><button type="button" class="enlace-fila">${esc(titulo(t.town))}</button>${t.asignacion === 'manual' ? ' <span class="etiqueta">PROXY</span>' : ''}</td>
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
  // Selección compartida: mapa, tabla, lista y detalle escriben aquí y leen de aquí (ver web/seleccion.js)
  const store = Seleccion.crear({ zonas: zonas.features.map((f) => f.properties.zona), townPorZona, atracciones: atr.filas });
  const cuantiles = (vals, k) => {
    const s = [...vals].sort((a, b) => a - b);
    return Array.from({ length: k - 1 }, (_, i) => s[Math.floor(s.length * (i + 1) / k)]);
  };
  const cortes = {
    precio: cuantiles(cara.map((t) => t.mediana_sgd_m2), 5),
    edificios: cuantiles(Object.values(viv.edificios_por_zona), 5),
  };
  let capa = 'precio', mapa = null, popupAtr = null, popupVarias = null, cerrandoDesdeEstado = false;
  let etiquetas = [];   // { el, caja, centro } por área: marcadores HTML con su nombre
  /**
   * Muestra solo las etiquetas que caben. Se recorre de la zona más grande a la más pequeña (algoritmo voraz): una etiqueta se
   * pone si cabe dentro de su área, queda en el lienzo y no tapa a otra ya puesta ni a un punto de atracción. Al acercar el zoom
   * las áreas crecen y aparecen más. Es la alternativa a una capa de texto de MapLibre, que exigiría tipografías remotas (R2).
   */
  function colocarEtiquetas() {
    if (!mapa || !etiquetas.length) return;
    const lienzo = mapa.getCanvas(), W = lienzo.clientWidth, H = lienzo.clientHeight;
    const puntosVisibles = $('ver-atracciones').checked ? atr.filas.map((f) => mapa.project([f.lon, f.lat])) : [];
    const info = etiquetas.map((e) => {
      const a = mapa.project([e.caja[0], e.caja[1]]), b = mapa.project([e.caja[2], e.caja[3]]);
      return { e, ancho: Math.abs(b.x - a.x), alto: Math.abs(a.y - b.y), c: mapa.project(e.centro) };
    }).sort((p, q) => q.ancho * q.alto - p.ancho * p.alto);
    const puestas = [];
    for (const { e, ancho, alto, c } of info) {
      const w = e.el.offsetWidth, h = e.el.offsetHeight;
      const r = { x0: c.x - w / 2 - 2, y0: c.y - h / 2 - 2, x1: c.x + w / 2 + 2, y1: c.y + h / 2 + 2 };
      const cabe = w + 4 <= ancho && h + 4 <= alto;
      const enLienzo = r.x0 >= 0 && r.y0 >= 0 && r.x1 <= W && r.y1 <= H;
      const choca = puestas.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)
        || puntosVisibles.some((p) => p.x > r.x0 - 6 && p.x < r.x1 + 6 && p.y > r.y0 - 6 && p.y < r.y1 + 6);
      const mostrar = cabe && enLienzo && !choca;
      e.el.classList.toggle('oculta', !mostrar);
      if (mostrar) puestas.push(r);
    }
  }
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
    if (!z) {
      // Sin zona: o no hay nada elegido, o es una atracción que cae fuera del límite terrestre y no pertenece a ningún área
      $('detalle').innerHTML = store.get().atraccion !== null
        ? '<p class="nota">Esta atracción está fuera del límite terrestre, así que no pertenece a ningún área y no hay detalle de zona que mostrar.</p>'
        : '<p class="vacio">Toque un área del mapa para ver su detalle.</p>';
      return;
    }
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
  }
  const irAlMapa = () => $('mapa-lienzo').scrollIntoView({ block: 'center' });
  document.querySelector('#tabla-zonas tbody').addEventListener('click', (e) => {
    if (e.target.closest('[data-f]')) return;   // una cifra de la fila abre su ficha, no selecciona
    const fila = e.target.closest('tr[data-zona]');
    if (fila) {
      const t = viv.towns.find((x) => x.town === fila.dataset.zona);
      // Si ya estaba elegida el store no avisa; igual se lleva al usuario al mapa, que es lo que pidió con el clic
      if (!store.seleccionarZona(t.zonas[0], 'tabla')) irAlMapa();
    }
  });

  const puntos = {
    type: 'FeatureCollection',
    // id numérico = posición en atr.filas: es lo que usa feature-state y también el id de atracción del store
    features: atr.filas.map((f, i) => ({ type: 'Feature', id: i, properties: { i, nombre: f.nombre, zona: f.zona || '' }, geometry: { type: 'Point', coordinates: [f.lon, f.lat] } })),
  };
  const esSel = ['boolean', ['feature-state', 'sel'], false];
  const esHov = ['boolean', ['feature-state', 'hov'], false];
  // Un punto normal: trazo claro por dentro y aro oscuro por fuera. Uno seleccionado: al revés, y más grande (no solo cambia el color)
  const trazoPunto = () => ['case', esSel, css('--texto'), css('--superficie')];
  const aroPunto = () => ['case', esSel, css('--superficie'), css('--texto')];
  function pintarMapa() {
    if (!mapa || !mapa.getLayer('zonas')) return;
    mapa.setPaintProperty('zonas', 'fill-color', colorExpr());
    mapa.setPaintProperty('bordes', 'line-color', css('--borde-zona'));
    mapa.setPaintProperty('contorno', 'line-color', css('--texto-3'));
    for (const id of ['zonas-hover-halo', 'zonas-sel-halo']) mapa.setPaintProperty(id, 'line-color', css('--superficie'));
    for (const id of ['zonas-hover', 'zonas-sel']) mapa.setPaintProperty(id, 'line-color', css('--texto'));
    mapa.setPaintProperty('puntos', 'circle-color', css('--punto'));
    mapa.setPaintProperty('puntos', 'circle-stroke-color', trazoPunto());
    mapa.setPaintProperty('puntos-aro', 'circle-stroke-color', aroPunto());
    for (const id of ['puntos', 'puntos-aro']) mapa.setLayoutProperty(id, 'visibility', $('ver-atracciones').checked ? 'visible' : 'none');
    pintarLeyenda();
    colocarEtiquetas();   // los puntos de atracción cuentan como obstáculos: al activarlos o apagarlos se reparten de nuevo
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
      // Contorno fino: separa del fondo las áreas pálidas y las «sin datos», que no llegan a 3:1 contra él
      mapa.addLayer({ id: 'contorno', type: 'line', source: 'zonas', layout: { 'line-join': 'round' }, paint: { 'line-color': css('--texto-3'), 'line-width': 0.75 } });
      // Hover y selección son anillos dobles: un halo ancho de --superficie bajo un trazo fino de --texto. Ningún color solo contrasta
      // con los cinco rellenos de la escala, pero para cada relleno al menos uno de los dos sí (≥ 3:1, ver la tarea T8).
      const ninguna = ['==', ['get', 'zona'], ''];
      const anillo = (id, color, ancho) => mapa.addLayer({ id, type: 'line', source: 'zonas', filter: ninguna, layout: { 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': ancho } });
      anillo('zonas-hover-halo', css('--superficie'), 4);
      anillo('zonas-hover', css('--texto'), 1.5);
      anillo('zonas-sel-halo', css('--superficie'), 6);
      anillo('zonas-sel', css('--texto'), 2.5);
      // Aro exterior de cada punto: el naranja solo no llega a 3:1 sobre los rellenos claros ni sobre «sin datos»
      mapa.addLayer({ id: 'puntos-aro', type: 'circle', source: 'puntos', layout: { visibility: 'none' }, paint: { 'circle-radius': ['case', esSel, 11.5, 6.5], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': ['case', esSel, 2.5, 2], 'circle-stroke-color': aroPunto() } });
      mapa.addLayer({ id: 'puntos', type: 'circle', source: 'puntos', layout: { visibility: 'none' }, paint: { 'circle-radius': ['case', esSel, 9, esHov, 7, 5], 'circle-color': css('--punto'), 'circle-stroke-width': ['case', esSel, 3, 2], 'circle-stroke-color': trazoPunto() } });
      // Popup al pasar el mouse. R1: no puede llevar cifras, porque desaparece al mover el mouse y no se puede tocar
      // para abrir su ficha. La plantilla solo recibe un nombre y la clave de un aviso fijo: una cifra no tiene por dónde entrar.
      const AVISOS = { precio: 'sin reventas HDB', edificios: 'sin edificios HDB' };
      const hoverZona = (nombre, aviso) => {
        if (aviso != null && !Object.hasOwn(AVISOS, aviso)) throw new Error('aviso desconocido: ' + aviso);
        return `<strong>${esc(titulo(nombre))}</strong>` + (aviso ? `<br>${AVISOS[aviso]}` : '') + '<br><span class="pista">Clic para ver el detalle</span>';
      };
      const avisoDe = (z) => (capa === 'precio'
        ? (townPorZona[z] && townPorZona[z].mediana_sgd_m2 ? null : 'precio')
        : (viv.edificios_por_zona[z] ? null : 'edificios'));
      const emergente = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'popup-hover' });
      let claveHover = null, hoverZ = null, hoverP = null;
      // Estado visual del hover en el mapa: anillo en la zona y punto más grande. Solo toca MapLibre si cambió algo.
      const marcarHover = (z, i) => {
        if (z !== hoverZ) {
          hoverZ = z;
          const f = ['==', ['get', 'zona'], z || ''];
          mapa.setFilter('zonas-hover-halo', f);
          mapa.setFilter('zonas-hover', f);
        }
        if (i !== hoverP) {
          if (hoverP !== null) mapa.setFeatureState({ source: 'puntos', id: hoverP }, { hov: false });
          if (i !== null) mapa.setFeatureState({ source: 'puntos', id: i }, { hov: true });
          hoverP = i;
        }
      };
      const quitarHover = () => { claveHover = null; marcarHover(null, null); mapa.getCanvas().style.cursor = ''; emergente.remove(); };
      if (window.matchMedia('(hover: hover)').matches) {
        // Un solo manejador para todo el mapa: si hubiera uno por capa, un punto sobre un polígono dispararía dos popups
        mapa.on('mousemove', (e) => {
          const bajo = mapa.queryRenderedFeatures(e.point, { layers: ['puntos', 'zonas'] });
          if (!bajo.length) { quitarHover(); return; }
          mapa.getCanvas().style.cursor = 'pointer';
          // queryRenderedFeatures devuelve primero la capa de más arriba: un punto de atracción gana sobre la zona
          if (bajo[0].layer.id === 'puntos') {
            // R1: el hover de una atracción lleva solo su nombre
            const i = bajo[0].properties.i, clave = 'a|' + i;
            marcarHover(null, i);
            if (clave !== claveHover) { claveHover = clave; emergente.setHTML(`<strong>${esc(atr.filas[i].nombre)}</strong>`); }
            emergente.setLngLat(e.lngLat);
            if (!emergente.isOpen()) emergente.addTo(mapa);
            return;
          }
          const z = bajo[0].properties.zona;
          marcarHover(z, null);
          const clave = z + '|' + capa;
          // El HTML se reconstruye solo si cambió la zona o la capa: así no parpadea mientras se mueve dentro de una zona
          if (clave !== claveHover) { claveHover = clave; emergente.setHTML(hoverZona(z, avisoDe(z))); }
          emergente.setLngLat(e.lngLat);
          if (!emergente.isOpen()) emergente.addTo(mapa);
        });
        mapa.getCanvas().addEventListener('mouseleave', quitarHover);
      }
      // Popups con los que se puede interactuar (a diferencia del de hover, no desaparecen solos)
      popupAtr = new maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 12, maxWidth: '320px', className: 'popup-atraccion' });
      popupVarias = new maplibregl.Popup({ closeButton: true, closeOnClick: false, offset: 12, maxWidth: '320px', className: 'popup-atraccion' });
      // Cerrar con la ✕ deselecciona la atracción. Cuando lo cierra el propio código (cerrandoDesdeEstado) no se vuelve a escribir
      // en el store: sería un cambio de selección dentro de un suscriptor, que el store prohíbe.
      popupAtr.on('close', () => { if (!cerrandoDesdeEstado && store.get().atraccion !== null) store.quitarAtraccion('mapa'); });
      const abrirVarias = (ids, lngLat) => {
        const items = ids.sort((a, b) => atr.filas[a].nombre.localeCompare(atr.filas[b].nombre))
          .map((i) => `<li><button type="button" class="enlace" data-atr-mapa="${i}">${esc(atr.filas[i].nombre)}</button></li>`).join('');
        popupVarias.setLngLat(lngLat).setHTML(`<p class="varias">Varias atracciones en este lugar. Elija una:</p><ul class="lista-varias">${items}</ul>`).addTo(mapa);
      };
      // Un solo clic para todo el mapa. Se consulta una caja de ±8 px: un punto mide 5 px de radio y un dedo no acierta tan fino.
      // queryRenderedFeatures devuelve lo que realmente se dibuja ahí, incluidas las atracciones con coordenadas idénticas.
      mapa.on('click', (e) => {
        popupVarias.remove();
        const r = 8;
        const hay = $('ver-atracciones').checked
          ? mapa.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: ['puntos'] }) : [];
        const ids = [...new Set(hay.map((f) => f.properties.i))];
        if (ids.length === 1) { store.seleccionarAtraccion(ids[0], 'mapa'); return; }
        if (ids.length > 1) { abrirVarias(ids, e.lngLat); return; }
        const z = mapa.queryRenderedFeatures(e.point, { layers: ['zonas'] })[0];
        if (z) store.seleccionarZona(z.properties.zona, 'mapa');
      });
      // Etiqueta con el nombre de cada área. aria-hidden: el nombre ya está en la tabla, el detalle y el anuncio de selección.
      zonas.features.forEach((f) => {
        const caja = cajaDeZona(f);
        const el = document.createElement('div');
        el.className = 'etiqueta-zona oculta';
        el.setAttribute('aria-hidden', 'true');
        el.textContent = titulo(f.properties.zona);
        const centro = [(caja[0] + caja[2]) / 2, (caja[1] + caja[3]) / 2];
        new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(centro).addTo(mapa);
        etiquetas.push({ el, caja, centro });
      });
      mapa.on('moveend', colocarEtiquetas);
      mapa.on('resize', colocarEtiquetas);
      pintarMapa();
      reflejarMapa(store.get(), { zona: null, atraccion: null, origen: null });
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
  const PASO_LISTA = 24;
  // El mismo contenido sirve a la tarjeta de la lista y al popup del mapa: una sola plantilla, un solo lugar donde corregirla
  function cuerpoAtraccion(f) {
    return `<strong>${esc(f.nombre)}</strong>
      <span class="donde">${esc(f.zona ? titulo(f.zona) : 'Fuera del límite terrestre')}${f.direccion ? ' · ' + esc(f.direccion) : ''}</span>
      ${f.descripcion_corta ? `<p lang="en">${esc(f.descripcion_corta)}</p>` : ''}
      ${cifra('Fuente F02', { valor: f.nombre, rotulo: 'Atracción', fuente: 'F02', vigencia: f.fecha_actualizacion_fuente ? 'registro editado el ' + f.fecha_actualizacion_fuente : 'la fuente no da fecha' })}`;
  }
  function pintarAtracciones() {
    // Todo el estado visual sale del store en cada dibujo: innerHTML borra las clases, así que no se puede guardar en el DOM
    const indices = Seleccion.filtrar(atr.filas, $('buscar-atraccion').value);
    const elegida = store.get().atraccion;
    $('lista-atracciones').innerHTML = indices.slice(0, visibles).map((i) => `<li id="atr-${i}"${i === elegida ? ' class="sel" aria-current="true"' : ''}>${cuerpoAtraccion(atr.filas[i])}
      <button type="button" class="enlace" data-atr-lista="${i}">Ver en el mapa</button></li>`).join('') || '<li>No hay atracciones con esa búsqueda.</li>';
    $('mas-atracciones').hidden = indices.length <= visibles;
    $('mas-atracciones').textContent = `Ver más (quedan ${indices.length - visibles})`;
  }
  $('buscar-atraccion').addEventListener('input', () => { visibles = 12; pintarAtracciones(); });
  $('mas-atracciones').addEventListener('click', () => { visibles += PASO_LISTA; pintarAtracciones(); });
  pintarAtracciones();

  // ── Selección compartida: cada componente reacciona al store, ninguno llama a otro ──
  const sinAnimacion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Rectángulo de la parte más grande del área (las áreas con islas lejanas no deben alejar la cámara). */
  function cajaDeZona(f) {
    let mejor = null, area = -1;
    for (const poli of f.geometry.coordinates) {
      const xs = poli[0].map((p) => p[0]), ys = poli[0].map((p) => p[1]);
      const b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const a = (b[2] - b[0]) * (b[3] - b[1]);
      if (a > area) { area = a; mejor = b; }
    }
    return mejor;
  }
  function reflejarDetalle(nuevo) { mostrarDetalle(nuevo.zona); }
  function reflejarTabla(nuevo) {
    const town = Seleccion.townDeZona(nuevo.zona, townPorZona);   // null si el área no tiene reventas HDB: ninguna fila queda marcada
    document.querySelectorAll('#tabla-zonas tr[data-zona]').forEach((tr) => {
      const sel = tr.dataset.zona === town;
      tr.classList.toggle('fila-sel', sel);
      if (sel) tr.setAttribute('aria-current', 'true'); else tr.removeAttribute('aria-current');
    });
  }
  function reflejarLista(nuevo, anterior) {
    if (nuevo.atraccion === anterior.atraccion) return;
    if (nuevo.atraccion !== null && nuevo.origen !== 'lista') {
      // La tarjeta puede no estar en pantalla: la búsqueda la filtra o queda en una página sin mostrar
      let pos = Seleccion.filtrar(atr.filas, $('buscar-atraccion').value).indexOf(nuevo.atraccion);
      if (pos === -1) { $('buscar-atraccion').value = ''; pos = nuevo.atraccion; }   // sin filtro, la posición es el propio id
      visibles = Seleccion.paginaPara(pos, visibles, PASO_LISTA);
    }
    pintarAtracciones();
    // innerHTML destruyó el botón con el foco: se devuelve para que quien navega con teclado no pierda el lugar
    if (nuevo.origen === 'lista' && nuevo.atraccion !== null) {
      const b = document.querySelector(`#atr-${nuevo.atraccion} [data-atr-lista]`);
      if (b) b.focus({ preventScroll: true });
    }
  }
  function reflejarMapa(nuevo, anterior) {
    if (!mapa || !popupAtr || !mapa.getLayer('zonas-sel')) return;
    cerrandoDesdeEstado = true;   // addTo/remove de un popup abierto dispara su evento 'close': no debe volver a escribir en el store
    try {
      const filtroSel = ['in', ['get', 'zona'], ['literal', Seleccion.areasDelTown(nuevo.zona, townPorZona)]];
      mapa.setFilter('zonas-sel-halo', filtroSel);
      mapa.setFilter('zonas-sel', filtroSel);
      if (anterior.atraccion !== nuevo.atraccion) {
        if (anterior.atraccion !== null) mapa.setFeatureState({ source: 'puntos', id: anterior.atraccion }, { sel: false });
        if (nuevo.atraccion !== null) mapa.setFeatureState({ source: 'puntos', id: nuevo.atraccion }, { sel: true });
      }
      popupVarias.remove();
      if (nuevo.atraccion === null) popupAtr.remove();
      else if (anterior.atraccion !== nuevo.atraccion) {
        const f = atr.filas[nuevo.atraccion];
        popupAtr.setLngLat([f.lon, f.lat]).setHTML(`${cuerpoAtraccion(f)}<button type="button" class="enlace" data-ver-lista="${nuevo.atraccion}">Ver en la lista</button>`).addTo(mapa);
      }
      if (nuevo.origen === 'lista' && nuevo.atraccion !== null && !$('ver-atracciones').checked) {
        $('ver-atracciones').checked = true;   // elegir una atracción en la lista debe poder verse en el mapa
        pintarMapa();
      }
      if (nuevo.origen !== 'mapa' && (nuevo.zona || nuevo.atraccion !== null)) {
        const duracion = sinAnimacion() ? 0 : 600;
        if (nuevo.atraccion !== null) {
          const f = atr.filas[nuevo.atraccion];
          mapa.easeTo({ center: [f.lon, f.lat], zoom: Math.max(mapa.getZoom(), 12), duration: duracion });
        } else {
          const cajas = Seleccion.areasDelTown(nuevo.zona, townPorZona).map((a) => cajaDeZona(zonas.features.find((x) => x.properties.zona === a)));
          mapa.fitBounds([[Math.min(...cajas.map((c) => c[0])), Math.min(...cajas.map((c) => c[1]))], [Math.max(...cajas.map((c) => c[2])), Math.max(...cajas.map((c) => c[3]))]],
            { padding: 40, maxZoom: 13, duration: duracion });
        }
      }
    } finally { cerrandoDesdeEstado = false; }
    if (nuevo.origen !== 'mapa' && (nuevo.zona || nuevo.atraccion !== null)) irAlMapa();
  }
  function anunciar(nuevo) {
    let t = '';
    if (nuevo.atraccion !== null) {
      const f = atr.filas[nuevo.atraccion];
      t = `Atracción seleccionada: ${f.nombre}${f.zona ? ', en ' + titulo(f.zona) : ', fuera del límite terrestre'}.`;
    } else if (nuevo.zona) t = `Área seleccionada: ${titulo(nuevo.zona)}.`;
    $('anuncio-seleccion').textContent = t;
  }
  [reflejarDetalle, reflejarTabla, reflejarLista, reflejarMapa, anunciar].forEach((fn) => store.suscribir(fn));

  document.addEventListener('click', (e) => {
    const deVarias = e.target.closest('[data-atr-mapa]');
    if (deVarias) { popupVarias.remove(); store.seleccionarAtraccion(Number(deVarias.dataset.atrMapa), 'mapa'); return; }
    const deLista = e.target.closest('[data-atr-lista]');
    if (deLista) { if (!store.seleccionarAtraccion(Number(deLista.dataset.atrLista), 'lista')) irAlMapa(); return; }
    const verEnLista = e.target.closest('[data-ver-lista]');
    if (verEnLista) {
      const li = $('atr-' + verEnLista.dataset.verLista);
      if (li) { li.scrollIntoView({ block: 'center' }); const b = li.querySelector('[data-atr-lista]'); if (b) b.focus({ preventScroll: true }); }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && store.get().atraccion !== null && !$('ficha').open) store.quitarAtraccion('mapa');
  });

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
