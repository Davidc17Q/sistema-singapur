// Pruebas de la interfaz en Chrome real. Herramienta de desarrollo: no se publica (Vercel solo sirve web/).
// Uso: node verificacion/pruebas_web.mjs        Termina con código 1 si algo falla y con 2 si no hay Chrome.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { abrir, servir, contraste, rgb, RAIZ, dormir } from './cdp.mjs';

const leer = (n) => JSON.parse(readFileSync(join(RAIZ, 'web', 'datos', n), 'utf8'));
const geo = leer('zonas.geojson'), viv = leer('vivienda.json'), atr = leer('atracciones.json');
const ZONAS = geo.features.map((f) => f.properties.zona);
const townPorZona = {};
viv.towns.forEach((t) => t.zonas.forEach((z) => { townPorZona[z] = t; }));
// Mismo criterio de formato que app.js, escrito aparte a propósito: la prueba no debe depender del código que verifica
const titulo = (s) => String(s).toLowerCase().replace(/(^|[\s/-])(\S)/g, (m, a, b) => a + b.toUpperCase());

let fallos = 0;
const lineas = [];
// Con PRUEBAS_RESUMEN no se escribe en consola (quien la lanza la descarta); el resultado va solo al archivo
const decir = (t) => { if (!process.env.PRUEBAS_RESUMEN) console.log(t); };
const ok = (nombre, cond, detalle = '') => {
  const linea = (cond ? 'PASS ' : 'FAIL ') + nombre + (cond ? '' : `  <- ${detalle}`);
  decir(linea);
  lineas.push(linea);
  if (!cond) fallos++;
};
// Si PRUEBAS_RESUMEN apunta a un archivo, el resultado también se escribe ahí (lo usan las pruebas de mutación)
const guardarResumen = () => { if (process.env.PRUEBAS_RESUMEN) writeFileSync(process.env.PRUEBAS_RESUMEN, lineas.join('\n') + `\n${fallos} fallos\n`); };

// Funciones que corren dentro de la página: leen el mapa real (ver EXPONER_MAPA en cdp.mjs)
const AYUDAS = `window.__t = (() => {
  const mapa = () => window.__mapas[0];
  let geo = null;
  const cargar = async () => geo || (geo = await (await fetch('datos/zonas.geojson')).json());
  const reposo = async () => {
    const m = mapa();
    for (let i = 0; i < 60; i++) { if (m.areTilesLoaded() && !m.isMoving()) break; await new Promise((r) => setTimeout(r, 100)); }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };
  const bboxMayor = (f) => {
    let mejor = null, area = -1;
    for (const poli of f.geometry.coordinates) {
      const xs = poli[0].map((p) => p[0]), ys = poli[0].map((p) => p[1]);
      const b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const a = (b[2] - b[0]) * (b[3] - b[1]);
      if (a > area) { area = a; mejor = b; }
    }
    return mejor;
  };
  const zonaEn = (x, y) => { const f = mapa().queryRenderedFeatures([x, y], { layers: ['zonas'] }); return f.length ? f[0].properties.zona : null; };
  const rect = () => { const r = mapa().getCanvas().getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  return {
    rect,
    async quieto() { await reposo(); },
    async inicial() { mapa().fitBounds([[103.59, 1.2], [104.1, 1.48]], { padding: 12, duration: 0 }); await reposo(); },
    async irA(nombre) {
      const g = await cargar(), f = g.features.find((x) => x.properties.zona === nombre), b = bboxMayor(f);
      mapa().fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 0, maxZoom: 16 });
      await reposo();
    },
    /** Un píxel (en coordenadas de la ventana) donde la capa superior sea esa zona. */
    punto(nombre) {
      const c = mapa().getCanvas(), w = c.clientWidth, h = c.clientHeight, r = c.getBoundingClientRect();
      // Se prefiere un píxel rodeado por la misma zona a varios píxeles de distancia: el borde es ambiguo por redondeo
      const rodeado = (x, y, m) => [[m, 0], [-m, 0], [0, m], [0, -m], [m, m], [-m, -m], [m, -m], [-m, m]].every(([dx, dy]) => zonaEn(x + dx, y + dy) === nombre);
      for (const margen of [8, 4, 2, 0]) for (const paso of [12, 5, 2]) for (let y = paso; y < h; y += paso) for (let x = paso; x < w; x += paso) {
        if (zonaEn(x, y) === nombre && rodeado(x, y, margen)) return { x: r.left + x, y: r.top + y, margen };
      }
      return null;
    },
    /** Un píxel del lienzo sin ninguna zona (mar). */
    mar() {
      const c = mapa().getCanvas(), r = c.getBoundingClientRect();
      for (let y = 8; y < c.clientHeight; y += 8) for (let x = 8; x < c.clientWidth; x += 8) {
        if (!mapa().queryRenderedFeatures([x, y], { layers: ['zonas'] }).length) return { x: r.left + x, y: r.top + y };
      }
      return null;
    },
    /** Lugares donde dos zonas son vecinas pixel con pixel en la fila y, con 6 px de margen a cada lado. */
    transiciones(ys) {
      const w = mapa().getCanvas().clientWidth, res = [];
      for (const y of ys) {
        let previa = zonaEn(0, y);
        for (let x = 1; x < w; x++) {
          const z = zonaEn(x, y);
          if (z && previa && z !== previa && x > 6 && x < w - 7 && zonaEn(x - 6, y) === previa && zonaEn(x + 5, y) === z) res.push({ x, y, a: previa, b: z });
          previa = z;
        }
      }
      return res;
    },
    async irAPunto(lon, lat, zoom) { mapa().jumpTo({ center: [lon, lat], zoom }); await reposo(); },
    punto_atraccion(lon, lat) { const p = mapa().project([lon, lat]), r = rect(); return { x: r.x + p.x, y: r.y + p.y }; },
    // Solo el popup de hover: puede haber a la vez uno persistente (.popup-atraccion) con otro contenido
    texto() { const c = document.querySelector('.popup-hover .maplibregl-popup-content'); return c ? c.innerText : null; },
    hayPopup() { return !!document.querySelector('.popup-hover'); },
    vigilar() {
      window.__quitados = 0; window.__cambios = 0;
      const lienzo = document.getElementById('mapa-lienzo');
      new MutationObserver((ms) => ms.forEach((m) => {
        m.removedNodes.forEach((n) => { if (n.classList && n.classList.contains('popup-hover')) window.__quitados++; });
        if (m.target.closest && m.target.closest('.popup-hover .maplibregl-popup-content')) window.__cambios++;
      })).observe(lienzo, { childList: true, subtree: true, characterData: true });
    },
  };
})();`;

const hover = async (p, pt) => { await p.raton(pt.x - 4, pt.y - 4); await p.raton(pt.x - 2, pt.y - 2); await p.raton(pt.x, pt.y); };
async function textoPopup(p, esperado) {
  let t = null;
  for (let i = 0; i < 25; i++) { t = await p.ev('window.__t.texto()'); if (t === esperado) return t; await dormir(120); }
  return t;
}
const esperadoZona = (z, capa) => {
  const sinDatos = capa === 'precio' ? !(townPorZona[z] && townPorZona[z].mediana_sgd_m2) : !viv.edificios_por_zona[z];
  return titulo(z) + (sinDatos ? '\n' + (capa === 'precio' ? 'sin reventas HDB' : 'sin edificios HDB') : '') + '\nClic para ver el detalle';
};
async function cargarPagina(p, origen) {
  await p.ir(origen + '/index.html');
  await p.esperar('window.__mapas && window.__mapas[0] && window.__mapas[0].loaded()', 20000, 'mapa cargado');
  await p.ev(AYUDAS);
  await p.ev("document.getElementById('mapa-lienzo').scrollIntoView({block:'center'})");
  await dormir(500);
}

const servidor = await servir();
let p;
try {
  // ════════ T4 · Popup al pasar el mouse sobre una zona ════════
  p = await abrir({ esquema: 'light' });
  await cargarPagina(p, servidor.origen);
  ok('el mapa expone su instancia a las pruebas', await p.ev('window.__mapas.length') === 1);

  for (const capa of ['precio', 'edificios']) {
    if (capa === 'edificios') await p.ev("document.querySelector('[data-capa=edificios]')?.click()");
    const malas = [];
    for (const z of ZONAS) {
      await p.ev(`window.__t.irA(${JSON.stringify(z)})`);
      // El mapa puede tardar un instante en redibujar tras el zoom; las zonas pequeñas lo notan primero. Se reintenta.
      let pt = null;
      for (let intento = 0; intento < 6 && !pt; intento++) { pt = await p.ev(`window.__t.punto(${JSON.stringify(z)})`); if (!pt) await dormir(250); }
      if (!pt) { malas.push(`${z}: sin píxel donde pasar el mouse`); continue; }
      await hover(p, pt);
      const esperado = esperadoZona(z, capa);
      const real = await textoPopup(p, esperado);
      if (real !== esperado) malas.push(`${z}: esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`);
      else if (/\d/.test(real)) malas.push(`${z}: el popup tiene un dígito (R1)`);
    }
    ok(`hover capa «${capa}»: las ${ZONAS.length} zonas muestran nombre, aviso y pista, sin cifras (${ZONAS.length - malas.length}/${ZONAS.length})`, malas.length === 0, malas.slice(0, 3).join(' | '));
  }
  await p.ev("document.querySelector('[data-capa=precio]')?.click()");

  // Moverse dentro de la misma zona no reconstruye el popup
  await p.ev('window.__t.irA("BISHAN")');
  const pb = await p.ev('window.__t.punto("BISHAN")');
  await hover(p, pb);
  await textoPopup(p, esperadoZona('BISHAN', 'precio'));
  await p.ev('window.__t.vigilar()');
  for (let k = 1; k <= 10; k++) await p.raton(pb.x + k, pb.y + k);
  await dormir(300);
  ok('moverse dentro de una zona no reconstruye el popup ni lo quita', await p.ev('window.__cambios') === 0 && await p.ev('window.__quitados') === 0,
    `cambios=${await p.ev('window.__cambios')} quitados=${await p.ev('window.__quitados')}`);

  // Cruzar de una zona a su vecina no hace parpadear el popup
  await p.ev('window.__t.inicial()');
  const r = await p.ev('window.__t.rect()');
  const trans = await p.ev(`window.__t.transiciones([0.3, 0.4, 0.5, 0.6, 0.7].map((f) => Math.round(f * ${r.h})))`);
  ok('el mapa tiene pares de zonas vecinas para probar el cruce', trans.length >= 3, `encontré ${trans.length}`);
  const fallosCruce = [];
  for (const t of trans.slice(0, 6)) {
    await p.ev('window.__t.vigilar()');
    await hover(p, { x: r.x + t.x - 6, y: r.y + t.y });
    await textoPopup(p, esperadoZona(t.a, 'precio'));
    for (let dx = -5; dx <= 5; dx++) await p.raton(r.x + t.x + dx, r.y + t.y);
    const final = await textoPopup(p, esperadoZona(t.b, 'precio'));
    const quitados = await p.ev('window.__quitados');
    if (quitados > 0 || final !== esperadoZona(t.b, 'precio')) fallosCruce.push(`${t.a}→${t.b}: quitados=${quitados}, final=${JSON.stringify(final)}`);
  }
  ok(`cruzar de una zona a otra no quita el popup y pasa al nombre de la nueva (${Math.min(6, trans.length)} cruces)`, fallosCruce.length === 0, fallosCruce.slice(0, 2).join(' | '));

  // Desaparece al salir del mapa y al pasar por el mar
  const pz = await p.ev('window.__t.punto("BISHAN")');
  await hover(p, pz ?? { x: r.x + 500, y: r.y + 250 });
  await p.ev('window.__t.inicial()');
  const pk = await p.ev('window.__t.punto("KALLANG")');
  await hover(p, pk);
  await textoPopup(p, esperadoZona('KALLANG', 'precio'));
  ok('hay un popup antes de salir del mapa', await p.ev('window.__t.hayPopup()'));
  await p.raton(r.x + 40, r.y - 30);
  await dormir(300);
  ok('el popup desaparece al sacar el mouse del mapa', !(await p.ev('window.__t.hayPopup()')));
  await hover(p, pk);
  await textoPopup(p, esperadoZona('KALLANG', 'precio'));
  const mar = await p.ev('window.__t.mar()');
  await hover(p, mar);
  await dormir(300);
  ok('el popup desaparece al pasar por el mar (sin zona)', !(await p.ev('window.__t.hayPopup()')));

  // Prioridad de capas: con atracciones activas, un punto gana sobre la zona. (T5 le pondrá su propio popup.)
  await p.ev("(()=>{const c=document.getElementById('ver-atracciones');c.checked=true;c.dispatchEvent(new Event('change'))})()");
  await dormir(500);
  const conZona = atr.filas.find((f) => f.zona);
  const pa = await p.ev(`window.__t.punto_atraccion(${conZona.lon}, ${conZona.lat})`);
  await hover(p, pa);
  await dormir(400);
  const sobrePunto = await p.ev('window.__t.texto()');
  ok(`con un punto de atracción bajo el mouse no sale el popup de la zona (${conZona.nombre})`, sobrePunto === null || !sobrePunto.includes('Clic para ver el detalle'), JSON.stringify(sobrePunto));

  const errores = p.red.errores;
  ok('sin errores de consola ni excepciones durante las pruebas del hover', errores.length === 0, errores.slice(0, 3).join(' | '));
  const externas = p.red.peticiones.filter((u) => !u.startsWith(servidor.origen) && !u.startsWith('data:') && !u.startsWith('blob:'));
  ok('ninguna petición salió del servidor local (R2, comprobación básica; la completa es T10)', externas.length === 0, externas.slice(0, 3).join(' | '));
  p.cerrar();

  // Legibilidad en modo oscuro
  p = await abrir({ esquema: 'dark' });
  await cargarPagina(p, servidor.origen);
  await p.ev('window.__t.irA("BEDOK")');
  await hover(p, await p.ev('window.__t.punto("BEDOK")'));
  await textoPopup(p, esperadoZona('BEDOK', 'precio'));
  const col = await p.ev(`(()=>{const c=document.querySelector('.maplibregl-popup-content');const g=(e)=>getComputedStyle(e).color;
    return {fondo:getComputedStyle(c).backgroundColor,nombre:g(c.querySelector('strong')),pista:g(c.querySelector('.pista'))}})()`);
  ok(`modo oscuro: el nombre del hover se lee (${contraste(rgb(col.nombre), rgb(col.fondo)).toFixed(2)}:1)`, contraste(rgb(col.nombre), rgb(col.fondo)) >= 4.5);
  ok(`modo oscuro: la pista del hover se lee (${contraste(rgb(col.pista), rgb(col.fondo)).toFixed(2)}:1)`, contraste(rgb(col.pista), rgb(col.fondo)) >= 4.5);
  p.cerrar(); p = null;

  // ════════ T5-T7 · Selección compartida entre mapa, tabla de zonas y lista de atracciones ════════
  const filas = atr.filas;
  const aislada = (i) => filas.every((g, j) => j === i || Math.hypot(g.lon - filas[i].lon, g.lat - filas[i].lat) > 0.003);
  const aisladas = filas.map((_, i) => i).filter((i) => aislada(i) && filas[i].zona);
  const [A, B] = aisladas, C = aisladas.find((i) => i >= 40);
  const esp = [filas.findIndex((f) => f.nombre === 'Esplanade Theatre'), filas.findIndex((f) => f.nombre === 'Esplanade Theatres on the Bay')];
  const sinZona = filas.findIndex((f) => !f.zona);
  ok('hay atracciones aisladas, una lejos en la lista, el par Esplanade y una fuera del límite para probar', [A, B, C, esp[0], esp[1], sinZona].every((x) => x !== undefined && x >= 0), JSON.stringify({ A, B, C, esp, sinZona }));

  p = await abrir({ esquema: 'light', movimientoReducido: true });
  await cargarPagina(p, servidor.origen);
  const ui = () => p.ev(`(() => {
    const m = window.__mapas[0], f = m.getFilter('zonas-sel');
    return {
      areas: f && f[0] === 'in' ? [...f[2][1]].sort() : null,
      fila: (document.querySelector('#tabla-zonas tr.fila-sel .enlace-fila') || {}).textContent || null,
      nFilas: document.querySelectorAll('#tabla-zonas tr.fila-sel').length,
      tarjetas: [...document.querySelectorAll('#lista-atracciones li.sel')].map((li) => li.id),
      detalle: document.getElementById('detalle').innerText,
      popups: [...document.querySelectorAll('.popup-atraccion .maplibregl-popup-content')].map((c) => c.innerText),
      anuncio: document.getElementById('anuncio-seleccion').textContent,
      busqueda: document.getElementById('buscar-atraccion').value,
      capaAtr: document.getElementById('ver-atracciones').checked,
    };
  })()`);
  const sel = (i) => p.ev(`!!window.__mapas[0].getFeatureState({ source: 'puntos', id: ${i} }).sel`);
  const verMapa = async () => { await p.ev("document.getElementById('mapa-lienzo').scrollIntoView({block:'center'})"); await dormir(250); };
  const clicZona = async (z) => { await verMapa(); await p.ev(`window.__t.irA(${JSON.stringify(z)})`); const pt = await p.ev(`window.__t.punto(${JSON.stringify(z)})`); await p.clic(pt.x, pt.y); await dormir(250); };
  const clicPunto = async (i) => {
    await verMapa(); await p.ev(`window.__t.irAPunto(${filas[i].lon}, ${filas[i].lat}, 15)`);
    const pt = await p.ev(`window.__t.punto_atraccion(${filas[i].lon}, ${filas[i].lat})`); await p.clic(pt.x, pt.y); await dormir(250);
    return pt;
  };
  const activarCapa = () => p.ev("(()=>{const c=document.getElementById('ver-atracciones');if(!c.checked){c.checked=true;c.dispatchEvent(new Event('change'))}})()");

  // Tabla → mapa (T7). CENTRAL AREA cubre tres áreas del mapa
  await p.ev("document.querySelector('#tabla-zonas tr[data-zona=\"CENTRAL AREA\"] .enlace-fila')?.click()");
  await dormir(300);
  let u = await ui();
  ok('tabla → mapa: elegir CENTRAL AREA resalta sus tres áreas en el mapa', JSON.stringify(u.areas) === JSON.stringify(['DOWNTOWN CORE', 'OUTRAM', 'ROCHOR']), JSON.stringify(u.areas));
  ok('tabla → detalle: muestra el área elegida y la fila queda marcada (una sola)', /^Downtown Core/.test(u.detalle) && u.fila === 'Central Area' && u.nFilas === 1, JSON.stringify([u.detalle.slice(0, 40), u.fila, u.nFilas]));
  ok('el cambio se anuncia a lectores de pantalla', u.anuncio === 'Área seleccionada: Downtown Core.', u.anuncio);

  // Mapa → tabla (T7), en un town de varias áreas: clic en OUTRAM marca la fila CENTRAL AREA
  await clicZona('OUTRAM');
  u = await ui();
  ok('mapa → tabla: clic en OUTRAM marca la fila CENTRAL AREA y resalta sus tres áreas', u.fila === 'Central Area' && u.areas.length === 3 && /^Outram/.test(u.detalle), JSON.stringify([u.fila, u.areas, u.detalle.slice(0, 30)]));

  // Un área sin fila en la tabla (26 de 55): se selecciona, se explica y ninguna fila queda marcada
  await clicZona('ORCHARD');
  u = await ui();
  ok('mapa → tabla: un área sin reventas HDB se selecciona, se explica y no marca ninguna fila', u.nFilas === 0 && JSON.stringify(u.areas) === '["ORCHARD"]' && /no tiene reventas HDB/.test(u.detalle), JSON.stringify([u.nFilas, u.areas, u.detalle.slice(0, 60)]));
  ok('no queda resaltada la selección anterior (3.5)', !u.areas.includes('OUTRAM'));

  // Teclado en la tabla: el nombre de la zona es un botón real
  await p.ev("document.querySelector('#tabla-zonas tr[data-zona=\"BEDOK\"] .enlace-fila').focus()");
  await p.tecla('Enter');
  await dormir(300);
  u = await ui();
  ok('teclado: Enter sobre el nombre de una zona de la tabla la selecciona', u.fila === 'Bedok' && JSON.stringify(u.areas) === '["BEDOK"]', JSON.stringify([u.fila, u.areas]));

  // Lista → mapa (T6)
  ok('antes de elegir, la capa de atracciones está apagada', (await ui()).capaAtr === false);
  await p.ev(`document.querySelector('[data-atr-lista="${A}"]')?.click()`);
  await dormir(500);
  u = await ui();
  const zA = filas[A].zona;
  ok(`lista → mapa: «Ver en el mapa» enciende la capa, resalta el punto y abre su popup (${filas[A].nombre})`,
    u.capaAtr && await sel(A) && u.popups.length === 1 && u.popups[0].includes(filas[A].nombre), JSON.stringify([u.capaAtr, await sel(A), u.popups.map((t) => t.slice(0, 40))]));
  ok('lista → detalle: la zona de la atracción queda seleccionada y la tarjeta marcada (una sola)', /^/.test(u.detalle) && u.tarjetas.length === 1 && u.tarjetas[0] === `atr-${A}` && u.areas.includes(zA), JSON.stringify([u.tarjetas, u.areas, zA]));
  ok('el popup de la atracción trae el botón de ficha «Fuente F02» y «Ver en la lista» (R1)', await p.ev("[...document.querySelectorAll('.popup-atraccion [data-f]')].some((b) => b.textContent === 'Fuente F02') && !!document.querySelector('.popup-atraccion [data-ver-lista]')"));

  // Una sola atracción seleccionada a la vez
  await p.ev(`document.querySelector('[data-atr-lista="${B}"]')?.click()`);
  await dormir(400);
  u = await ui();
  ok('solo una atracción seleccionada a la vez: punto, tarjeta y popup pasan de A a B', !(await sel(A)) && await sel(B) && u.tarjetas.length === 1 && u.tarjetas[0] === `atr-${B}` && u.popups.length === 1, JSON.stringify([await sel(A), await sel(B), u.tarjetas, u.popups.length]));

  // Mapa → lista (T6): la tarjeta no está en pantalla (búsqueda que no la incluye) y está lejos en la lista
  await p.ev("(()=>{const i=document.getElementById('buscar-atraccion');i.value='zzz-sin-resultados';i.dispatchEvent(new Event('input'))})()");
  await dormir(200);
  ok('con una búsqueda sin resultados la lista queda vacía', (await p.ev("document.querySelectorAll('#lista-atracciones li[id]').length")) === 0);
  await clicPunto(C);
  u = await ui();
  ok(`mapa → lista: clic en un punto lejano de la lista (${C}) limpia la búsqueda, amplía la página y marca su tarjeta`, u.busqueda === '' && u.tarjetas.length === 1 && u.tarjetas[0] === `atr-${C}` && await sel(C), JSON.stringify([u.busqueda, u.tarjetas, await sel(C)]));
  ok('mapa → lista: el popup de esa atracción se abre', u.popups.length === 1 && u.popups[0].includes(filas[C].nombre), JSON.stringify(u.popups.map((t) => t.slice(0, 40))));
  await p.ev(`document.querySelector('.popup-atraccion [data-ver-lista]')?.click()`);
  await dormir(300);
  ok('«Ver en la lista» lleva la tarjeta a la vista', await p.ev(`(() => { const r = document.getElementById('atr-${C}').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()`));

  // La búsqueda no cambia la selección (5.5)
  await p.ev("(()=>{const i=document.getElementById('buscar-atraccion');i.value='zzz-sin-resultados';i.dispatchEvent(new Event('input'))})()");
  await dormir(200);
  ok('filtrar la lista no cambia la selección: el punto sigue resaltado', await sel(C) && (await ui()).popups.length === 1);
  await p.ev("(()=>{const i=document.getElementById('buscar-atraccion');i.value='';i.dispatchEvent(new Event('input'))})()");

  // Hover sobre un punto: solo el nombre (R1)
  await verMapa();
  const ph = await p.ev(`window.__t.punto_atraccion(${filas[C].lon}, ${filas[C].lat})`);
  await p.raton(ph.x + 40, ph.y + 40); await hover(p, ph);
  ok('hover sobre un punto de atracción: el popup contiene únicamente su nombre', (await textoPopup(p, filas[C].nombre)) === filas[C].nombre, JSON.stringify(await p.ev('window.__t.texto()')));

  // Cerrar con ✕ y con Escape deselecciona la atracción y conserva la zona
  await p.ev(`document.querySelector('.popup-atraccion .maplibregl-popup-close-button')?.click()`);
  await dormir(300);
  u = await ui();
  ok('cerrar con ✕ deselecciona la atracción (punto, tarjeta y popup) y conserva el área', !(await sel(C)) && u.tarjetas.length === 0 && u.popups.length === 0 && u.areas.length >= 1, JSON.stringify([await sel(C), u.tarjetas, u.popups.length, u.areas]));
  await p.ev(`document.querySelector('[data-atr-lista="${A}"]')?.click()`);
  await dormir(300);
  await p.tecla('Escape');
  await dormir(300);
  u = await ui();
  ok('Escape cierra el popup y deselecciona la atracción', !(await sel(A)) && u.tarjetas.length === 0 && u.popups.length === 0, JSON.stringify([await sel(A), u.tarjetas, u.popups.length]));

  // Superpuestas (T5): Esplanade tiene las mismas coordenadas
  await activarCapa();
  await clicPunto(esp[0]);
  u = await ui();
  const botones = await p.ev("[...document.querySelectorAll('[data-atr-mapa]')].map((b) => b.textContent)");
  ok('puntos superpuestos: el clic abre una lista con las dos atracciones, sin elegir ninguna', botones.length === 2 && botones.includes(filas[esp[0]].nombre) && botones.includes(filas[esp[1]].nombre) && u.tarjetas.length === 0, JSON.stringify([botones, u.tarjetas]));
  await p.ev(`document.querySelector('[data-atr-mapa="${esp[1]}"]')?.click()`);
  await dormir(300);
  u = await ui();
  ok('puntos superpuestos: elegir una la selecciona y cierra la lista (ninguna queda inaccesible)', await sel(esp[1]) && !(await sel(esp[0])) && u.tarjetas[0] === `atr-${esp[1]}` && (await p.ev("document.querySelectorAll('[data-atr-mapa]').length")) === 0, JSON.stringify([await sel(esp[1]), u.tarjetas]));
  await p.ev("window.__t.inicial()");
  await clicPunto(esp[0]);
  await p.ev(`document.querySelector('[data-atr-mapa="${esp[0]}"]')?.click()`);
  await dormir(300);
  ok('puntos superpuestos: la otra del par también se puede elegir', await sel(esp[0]) && !(await sel(esp[1])));

  // Atracción fuera del límite terrestre
  await p.ev(`document.querySelector('[data-atr-lista="${sinZona}"]')?.click()`);
  const haySinZona = await p.ev(`!!document.getElementById('atr-${sinZona}')`);
  if (!haySinZona) {   // no está en la primera página: se busca por nombre
    await p.ev(`(()=>{const i=document.getElementById('buscar-atraccion');i.value=${JSON.stringify(filas[sinZona].nombre)};i.dispatchEvent(new Event('input'))})()`);
    await dormir(200);
    await p.ev(`document.querySelector('[data-atr-lista="${sinZona}"]')?.click()`);
  }
  await dormir(400);
  u = await ui();
  ok('una atracción fuera del límite terrestre se selecciona y el detalle lo explica, sin error', await sel(sinZona) && /fuera del límite terrestre/.test(u.detalle) && u.nFilas === 0, JSON.stringify([await sel(sinZona), u.detalle.slice(0, 80), u.nFilas]));

  // Elegir una zona en el mapa quita la atracción seleccionada
  await clicZona('BEDOK');
  u = await ui();
  ok('elegir un área en el mapa deselecciona la atracción', !(await sel(sinZona)) && u.tarjetas.length === 0 && u.popups.length === 0 && u.fila === 'Bedok', JSON.stringify([await sel(sinZona), u.tarjetas, u.fila]));

  const err2 = p.red.errores;
  ok('sin errores de consola durante las pruebas de selección', err2.length === 0, err2.slice(0, 3).join(' | '));
  const ext2 = p.red.peticiones.filter((x) => !x.startsWith(servidor.origen) && !x.startsWith('data:') && !x.startsWith('blob:'));
  ok('ninguna petición salió del servidor local durante las pruebas de selección (R2, comprobación básica)', ext2.length === 0, ext2.slice(0, 3).join(' | '));
  p.cerrar(); p = null;

  // ════════ T10 · Restricciones duras R1 (toda cifra con ficha) y R2 (sin terceros), en el navegador ════════
  p = await abrir({ esquema: 'light', movimientoReducido: true });
  await cargarPagina(p, servidor.origen);

  // R1. Una «cifra» es un valor calculado de los datos. Se busca en lo que aparece al elegir cosas: detalle y popup persistente.
  // Cada número de esos textos debe estar dentro de un botón .cifra; los dígitos de nombres y direcciones no cuentan.
  const sinFicha = (selector) => p.ev(`(() => {
    const raiz = document.querySelector(${JSON.stringify(selector)});
    if (!raiz) return ['(no existe ' + ${JSON.stringify(selector)} + ')'];
    const malos = [];
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.textContent;
      if (!/\\d/.test(t)) continue;
      const el = n.parentElement;
      // El mecanismo de R1 es el atributo data-f: lo llevan los botones .cifra y también las tarjetas del panorama (.tile)
      if (el.closest('[data-f]')) continue;
      if (el.closest('.donde') || el.closest('p[lang=en]')) continue;   // dirección y descripción: texto de la fuente, no una cifra
      if (el.closest('h3')) continue;                                   // nombre de área
      // Etiquetas y nombres de categoría, no medidas: <dt>, <th> y la primera columna de la tabla por tipo («2 Room»)
      if (el.closest('dt, th, td:first-child')) continue;
      // Un período de los datos («2025-11 y 2026-10») es la vigencia, que la ficha ya muestra; sin ese período no queda ningún dígito
      if (!/\\d/.test(t.replace(/\\d{4}-\\d{2}/g, ''))) continue;
      malos.push(t.trim().slice(0, 50));
    }
    return malos;
  })()`);
  await p.ev("document.querySelector('#tabla-zonas tr[data-zona=\"BEDOK\"] .enlace-fila')?.click()");
  await dormir(300);
  const huerfanasDetalle = await sinFicha('#detalle');
  ok('R1: en el detalle de una zona toda cifra está dentro de un botón con ficha', huerfanasDetalle.length === 0, huerfanasDetalle.slice(0, 4).join(' | '));
  const nCifrasDetalle = await p.ev("document.querySelectorAll('#detalle .cifra').length");
  ok(`R1: el detalle muestra cifras con ficha (${nCifrasDetalle})`, nCifrasDetalle >= 5, String(nCifrasDetalle));
  // Una ficha abre de verdad y trae fuente, vigencia, licencia y enlace
  await p.ev("document.querySelector('#detalle .cifra')?.click()");
  await dormir(300);
  const ficha = await p.ev("(() => { const d = document.getElementById('ficha'); return { abierta: d.open, texto: d.innerText }; })()");
  ok('R1: la ficha de una cifra abre y muestra fuente, vigencia, licencia y enlace', ficha.abierta && /Fuente/.test(ficha.texto) && /Vigencia/.test(ficha.texto) && /Licencia/.test(ficha.texto) && /Enlace/.test(ficha.texto), ficha.texto.slice(0, 80));
  await p.tecla('Escape');
  await dormir(300);
  // Cada tarjeta/popup de atracción: el único botón de datos es «Fuente F02»; el resto es texto de la fuente
  await p.ev(`document.querySelector('[data-atr-lista="${A}"]')?.click()`);
  await dormir(500);
  const huerfanasPopup = await sinFicha('.popup-atraccion .maplibregl-popup-content');
  ok('R1: en el popup de una atracción no hay cifras sin ficha', huerfanasPopup.length === 0, huerfanasPopup.slice(0, 4).join(' | '));
  ok('R1: el popup de una atracción lleva su botón «Fuente F02»', await p.ev("[...document.querySelectorAll('.popup-atraccion .cifra')].some((b) => b.textContent === 'Fuente F02')"));
  // Las cifras del panorama, la tabla y el selector de edad también (recorrido amplio)
  for (const [nombre, sel] of [['panorama', '#panorama'], ['tabla de zonas', '#tabla-zonas'], ['transporte', '#barras-transporte']]) {
    const m = await sinFicha(sel);
    ok(`R1: ${nombre}: toda cifra con ficha`, m.length === 0, m.slice(0, 4).join(' | '));
  }
  // El hover sigue sin cifras en las 55 zonas (ya comprobado en T4) y en las 107 atracciones: solo su nombre
  let malasHover = 0, solapados = 0, ejemplo = '';
  const nombresAtr = new Set(filas.map((f) => f.nombre));
  await p.ev("(()=>{const c=document.getElementById('ver-atracciones');c.checked=true;c.dispatchEvent(new Event('change'))})()");
  await p.ev(`document.querySelector('.popup-atraccion .maplibregl-popup-close-button')?.click()`);
  await dormir(200);
  for (let i = 0; i < filas.length; i++) {
    await p.ev(`window.__t.irAPunto(${filas[i].lon}, ${filas[i].lat}, 16)`);
    const pt = await p.ev(`window.__t.punto_atraccion(${filas[i].lon}, ${filas[i].lat})`);
    await verMapa();
    const pt2 = await p.ev(`window.__t.punto_atraccion(${filas[i].lon}, ${filas[i].lat})`);
    await p.raton(pt2.x + 30, pt2.y + 30); await hover(p, pt2);
    // Criterio de R1: el hover es exactamente el nombre de una atracción real y nada más. Si dos puntos se solapan (Esplanade,
    // o las del complejo de Sentosa a zoom 16) el popup muestra el de arriba, que puede no ser el que se buscaba.
    const t = await textoPopup(p, filas[i].nombre);
    if (!nombresAtr.has(t)) { malasHover++; if (!ejemplo) ejemplo = `${filas[i].nombre} → ${JSON.stringify(t)}`; }
    else if (t !== filas[i].nombre) solapados++;
  }
  ok(`R1: el hover de las ${filas.length} atracciones muestra exactamente un nombre real y nada más (${filas.length - malasHover}/${filas.length}; en ${solapados} salió el de otra atracción solapada)`, malasHover === 0, `${malasHover} fallan, p. ej. ${ejemplo}`);

  // R2. Durante todo el recorrido anterior, ni una petición fuera del servidor local ni una violación de la CSP.
  const fuera = p.red.peticiones.filter((u) => !u.startsWith(servidor.origen) && !u.startsWith('data:') && !u.startsWith('blob:'));
  ok(`R2: ninguna petición salió del servidor local en todo el recorrido (${p.red.peticiones.length} peticiones revisadas)`, fuera.length === 0, fuera.slice(0, 3).join(' | '));
  const csp = p.red.errores.filter((e) => /Content Security Policy|Refused to|violat/i.test(e));
  ok('R2: la CSP de producción no bloqueó nada durante el recorrido (no hubo violaciones)', csp.length === 0, csp.slice(0, 2).join(' | '));
  const origenes = [...new Set(p.red.peticiones.map((u) => { try { return new URL(u).origin; } catch { return u.slice(0, 5); } }))];
  ok(`R2: los únicos orígenes vistos son el local y data:/blob: (${origenes.join(', ')})`, origenes.every((o) => o === servidor.origen || o === 'data:' || o === 'blob:' || o === 'null'), origenes.join(', '));
  p.cerrar(); p = null;

  // ════════ T9 · Etiquetas de zona y cámara ════════
  for (const esquema of ['light', 'dark']) {
    p = await abrir({ esquema, movimientoReducido: true });
    await cargarPagina(p, servidor.origen);
    await p.ev('window.__t.inicial()');
    await dormir(400);
    const etiquetasVisibles = () => p.ev(`(() => [...document.querySelectorAll('.etiqueta-zona:not(.oculta)')].map((e) => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      return { t: e.textContent, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, color: s.color, fondo: s.backgroundColor, pe: s.pointerEvents };
    }))()`);
    const sola = (a, b) => a.x0 >= b.x1 || a.x1 <= b.x0 || a.y0 >= b.y1 || a.y1 <= b.y0;
    const lienzo = await p.ev('window.__t.rect()');

    let es = await etiquetasVisibles();
    const total = await p.ev("document.querySelectorAll('.etiqueta-zona').length");
    ok(`${esquema}: hay una etiqueta por área (${total} de ${ZONAS.length}), todas aria-hidden`, total === ZONAS.length && await p.ev("[...document.querySelectorAll('.etiqueta-zona')].every((e) => e.getAttribute('aria-hidden') === 'true')"), String(total));
    ok(`${esquema}: a la escala inicial se muestran solo las áreas con espacio (${es.length} de ${ZONAS.length})`, es.length >= 10 && es.length < ZONAS.length, String(es.length));
    const solapes = [];
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) if (!sola(es[i], es[j])) solapes.push(`${es[i].t}/${es[j].t}`);
    ok(`${esquema}: ninguna etiqueta visible tapa a otra`, solapes.length === 0, solapes.slice(0, 3).join(', '));
    ok(`${esquema}: todas las etiquetas visibles quedan dentro del lienzo`, es.every((e) => e.x0 >= lienzo.x && e.x1 <= lienzo.x + lienzo.w && e.y0 >= lienzo.y && e.y1 <= lienzo.y + lienzo.h));
    const minimo = Math.min(...es.map((e) => contraste(rgb(e.color), rgb(e.fondo))));
    ok(`${esquema}: el texto de las etiquetas se lee ≥ 4.5:1 (peor caso ${minimo.toFixed(2)}:1)`, minimo >= 4.5, minimo.toFixed(2));
    ok(`${esquema}: las etiquetas no capturan el mouse (pointer-events: none)`, es.every((e) => e.pe === 'none'));

    // El clic atraviesa la etiqueta y llega a la zona que hay debajo
    const clicAtraves = await p.ev(`(() => {
      const m = window.__mapas[0], c = m.getCanvas().getBoundingClientRect();
      for (const e of document.querySelectorAll('.etiqueta-zona:not(.oculta)')) {
        const r = e.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
        const z = m.queryRenderedFeatures([x - c.left, y - c.top], { layers: ['zonas'] })[0];
        if (z) return { x, y, zona: z.properties.zona, encima: document.elementFromPoint(x, y).className };
      }
      return null;
    })()`);
    await p.clic(clicAtraves.x, clicAtraves.y);
    await dormir(300);
    const anuncio = await p.ev("document.getElementById('anuncio-seleccion').textContent");
    ok(`${esquema}: un clic sobre una etiqueta selecciona el área de debajo (${clicAtraves.zona})`, !String(clicAtraves.encima).includes('etiqueta-zona') && anuncio === `Área seleccionada: ${titulo(clicAtraves.zona)}.`, JSON.stringify([clicAtraves.encima, anuncio]));

    if (esquema === 'light') {
      // Una zona pequeña no cabe a la escala inicial y gana su etiqueta al acercarse
      await p.ev('window.__t.inicial()'); await dormir(400);
      const antes = await p.ev("(() => { const e = [...document.querySelectorAll('.etiqueta-zona')].find((x) => x.textContent === 'Downtown Core'); return !e.classList.contains('oculta'); })()");
      await p.ev('window.__t.irA("DOWNTOWN CORE")'); await dormir(500);
      const despues = await p.ev("(() => { const e = [...document.querySelectorAll('.etiqueta-zona')].find((x) => x.textContent === 'Downtown Core'); return !e.classList.contains('oculta'); })()");
      ok('una zona pequeña (Downtown Core) no tiene etiqueta a la escala inicial y la gana al acercarse', antes === false && despues === true, JSON.stringify([antes, despues]));

      // Con atracciones activas, ninguna etiqueta visible tapa un punto
      await p.ev('window.__t.inicial()');
      await activarCapa();
      await dormir(500);
      es = await etiquetasVisibles();
      const tapados = await p.ev(`(() => {
        const m = window.__mapas[0], c = m.getCanvas().getBoundingClientRect(), malos = [];
        const filas = ${JSON.stringify(filas.map((f) => [f.lon, f.lat]))};
        for (const e of document.querySelectorAll('.etiqueta-zona:not(.oculta)')) {
          const r = e.getBoundingClientRect();
          for (const [lon, lat] of filas) { const q = m.project([lon, lat]); const x = q.x + c.left, y = q.y + c.top;
            if (x > r.left && x < r.right && y > r.top && y < r.bottom) malos.push(e.textContent); }
        }
        return malos;
      })()`);
      ok(`con las atracciones activas ninguna etiqueta tapa un punto (${es.length} etiquetas visibles)`, tapados.length === 0, tapados.slice(0, 3).join(', '));

      // Cámara con movimiento reducido: elegir en la tabla encuadra la zona al instante, sin animación
      await p.ev("document.querySelector('#tabla-zonas tr[data-zona=\"BEDOK\"] .enlace-fila')?.click()");
      await dormir(400);
      const encuadre = await p.ev(`(() => {
        const m = window.__mapas[0], b = m.getBounds(), g = window.__bedokCaja;
        return { moviendo: m.isMoving(), zoom: m.getZoom(), b: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] };
      })()`);
      const cajaBedok = (() => { const f = geo.features.find((x) => x.properties.zona === 'BEDOK'); let mejor = null, area = -1; for (const poli of f.geometry.coordinates) { const xs = poli[0].map((q) => q[0]), ys = poli[0].map((q) => q[1]); const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; const a = (bb[2] - bb[0]) * (bb[3] - bb[1]); if (a > area) { area = a; mejor = bb; } } return mejor; })();
      const contiene = encuadre.b[0] <= cajaBedok[0] && encuadre.b[1] <= cajaBedok[1] && encuadre.b[2] >= cajaBedok[2] && encuadre.b[3] >= cajaBedok[3];
      ok('con movimiento reducido, elegir una zona en la tabla la encuadra de inmediato (sin animación) y el mapa queda quieto', !encuadre.moviendo && contiene, JSON.stringify(encuadre));
    }
    p.cerrar(); p = null;
  }

  // ════════ T8 · Estados visuales y contraste (WCAG 2.2), con los colores reales de la página ════════
  for (const esquema of ['light', 'dark']) {
    p = await abrir({ esquema, movimientoReducido: true });
    await cargarPagina(p, servidor.origen);
    const c = await p.ev(`(() => {
      const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      const m = window.__mapas[0];
      return {
        texto: v('--texto'), sup: v('--superficie'), t3: v('--texto-3'), acento: v('--acento'), pista: v('--pista'), punto: v('--punto'), sindato: v('--sin-dato'),
        seq: [1, 2, 3, 4, 5].map((i) => v('--seq-' + i)),
        capas: m.getStyle().layers.map((l) => l.id),
        pintura: {
          selHalo: m.getPaintProperty('zonas-sel-halo', 'line-color'), sel: m.getPaintProperty('zonas-sel', 'line-color'),
          hovHalo: m.getPaintProperty('zonas-hover-halo', 'line-color'), hov: m.getPaintProperty('zonas-hover', 'line-color'),
          contorno: m.getPaintProperty('contorno', 'line-color'), contornoAncho: m.getPaintProperty('contorno', 'line-width'),
        },
      };
    })()`);
    const rellenos = [...c.seq, c.sindato];
    const peor = (a, b) => Math.min(...rellenos.map((f) => Math.max(contraste(rgb(a), rgb(f)), contraste(rgb(b), rgb(f)))));
    ok(`${esquema}: el orden de las capas es zonas, bordes, contorno, hover y selección (anillos), aro y puntos`,
      JSON.stringify(c.capas) === JSON.stringify(['zonas', 'bordes', 'contorno', 'zonas-hover-halo', 'zonas-hover', 'zonas-sel-halo', 'zonas-sel', 'puntos-aro', 'puntos']), JSON.stringify(c.capas));
    ok(`${esquema}: el anillo de selección usa los colores del tema (halo --superficie, trazo --texto)`, c.pintura.selHalo === c.sup && c.pintura.sel === c.texto, JSON.stringify(c.pintura));
    ok(`${esquema}: el anillo de hover usa los colores del tema`, c.pintura.hovHalo === c.sup && c.pintura.hov === c.texto);
    const sel = peor(c.texto, c.sup);
    ok(`${esquema}: el anillo de selección contrasta ≥ 3:1 con los 6 rellenos posibles (peor caso ${sel.toFixed(2)}:1)`, sel >= 3, sel.toFixed(2));
    // Cada color del anillo por separado NO basta: eso es lo que justifica que sean dos
    ok(`${esquema}: ningún color del anillo basta por sí solo (por eso es doble)`, Math.min(...rellenos.map((f) => contraste(rgb(c.texto), rgb(f)))) < 3 && Math.min(...rellenos.map((f) => contraste(rgb(c.sup), rgb(f)))) < 3);
    const cont = contraste(rgb(c.pintura.contorno), rgb(c.sup));
    ok(`${esquema}: el contorno fino usa --texto-3 y contrasta ≥ 3:1 con el fondo del mapa (${cont.toFixed(2)}:1)`, c.pintura.contorno === c.t3 && cont >= 3 && c.pintura.contornoAncho <= 1, JSON.stringify([c.pintura.contorno, c.pintura.contornoAncho]));
    // Punto: trazo claro por dentro y aro oscuro por fuera; el naranja solo no llega a 3:1 con todos los rellenos
    const aro = peor(c.texto, c.sup);
    ok(`${esquema}: el punto (trazo --superficie + aro --texto) contrasta ≥ 3:1 con cualquier relleno (peor caso ${aro.toFixed(2)}:1)`, aro >= 3, aro.toFixed(2));
    ok(`${esquema}: el naranja del punto solo no basta (por eso lleva aro)`, Math.min(...rellenos.map((f) => contraste(rgb(c.punto), rgb(f)))) < 3);
    // Marca de fila seleccionada: la barra lateral y el texto sobre el fondo marcado
    const barra = contraste(rgb(c.acento), rgb(c.pista));
    ok(`${esquema}: la barra de lo seleccionado contrasta ≥ 3:1 con el fondo de la fila/tarjeta (${barra.toFixed(2)}:1)`, barra >= 3, barra.toFixed(2));
    ok(`${esquema}: el texto sobre el fondo de lo seleccionado se lee ≥ 4.5:1 (${contraste(rgb(c.texto), rgb(c.pista)).toFixed(2)}:1)`, contraste(rgb(c.texto), rgb(c.pista)) >= 4.5);
    p.cerrar(); p = null;
  }

  // Cámara animada: sin «movimiento reducido», elegir en la lista lleva el mapa a la atracción
  p = await abrir({ esquema: 'light', movimientoReducido: false });
  await cargarPagina(p, servidor.origen);
  await p.ev(`document.querySelector('[data-atr-lista="${A}"]')?.click()`);
  await dormir(1800);
  const centro = await p.ev('(() => { const c = window.__mapas[0].getCenter(); return [c.lng, c.lat]; })()');
  const distancia = Math.hypot(centro[0] - filas[A].lon, centro[1] - filas[A].lat);
  ok(`con animación, elegir en la lista centra el mapa en la atracción (a ${distancia.toFixed(4)}° del punto)`, distancia < 0.002, JSON.stringify(centro));
  p.cerrar(); p = null;
} catch (e) {
  const msg = 'FAIL ERROR en la prueba: ' + (e.stack || e.message);
  decir(msg); lineas.push(msg);
  fallos++;
} finally {
  if (p) p.cerrar();
  servidor.cerrar();
}
decir(`\n${fallos} fallos`);
guardarResumen();
process.exit(fallos ? 1 : 0);
