// Ayudante para probar la web en un Chrome real, sin dependencias: Node 22 trae WebSocket y fetch.
// Herramienta de desarrollo. No se publica: Vercel solo sirve la carpeta web.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

export const RAIZ = resolve(import.meta.dirname, '..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.geojson': 'application/geo+json; charset=utf-8',
};
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// app.js guarda el mapa en una variable local. Para probarlo sin añadir ganchos al código de producción, este script
// (que solo existe en las pruebas) envuelve maplibregl.Map cuando la librería se asigna al global y guarda cada instancia.
const EXPONER_MAPA = `(() => {
  let real;
  Object.defineProperty(window, 'maplibregl', {
    configurable: true,
    get() { return real; },
    set(v) {
      real = v;
      if (v && v.Map && !v.__envuelto) {
        const Original = v.Map;
        v.Map = class extends Original { constructor(o) { super(o); (window.__mapas = window.__mapas || []).push(this); } };
        v.__envuelto = true;
      }
    },
  });
})();`;

/** Las cabeceras de seguridad de producción, leídas de vercel.json: la prueba usa la misma CSP que Vercel. */
export function cabecerasDeVercel() {
  const v = JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8'));
  return Object.fromEntries(v.headers[0].headers.map((h) => [h.key, h.value]));
}

/** Sirve web/ en un puerto libre de 127.0.0.1, con las cabeceras de producción. */
export function servir() {
  const web = join(RAIZ, 'web');
  const cabeceras = cabecerasDeVercel();
  const servidor = createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const archivo = resolve(web, '.' + (ruta === '/' ? '/index.html' : ruta));
    if (!archivo.startsWith(web + sep) || !existsSync(archivo)) { res.writeHead(404, cabeceras).end('no encontrado'); return; }
    res.writeHead(200, { ...cabeceras, 'Content-Type': TIPOS[extname(archivo)] || 'application/octet-stream' });
    res.end(readFileSync(archivo));
  });
  return new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok({
    origen: `http://127.0.0.1:${servidor.address().port}`,
    cerrar: () => servidor.close(),
  })));
}

function buscarChrome() {
  return [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync);
}

/** Abre Chrome sin ventana y devuelve una página controlable. Termina con código 2 si no encuentra Chrome. */
export async function abrir({ esquema = 'light', ancho = 1280, alto = 1000, movimientoReducido = false } = {}) {
  const exe = buscarChrome();
  if (!exe) { console.error('No se encontró Chrome ni Edge. Define la variable CHROME_PATH.'); process.exit(2); }
  const dir = mkdtempSync(join(tmpdir(), 'sg-cdp-'));
  const chrome = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', `--window-size=${ancho},${alto}`, 'about:blank'], { stdio: 'ignore' });
  let puerto;
  for (let i = 0; i < 80 && !puerto; i++) {
    try { puerto = Number(readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch { await dormir(250); }
  }
  if (!puerto) { chrome.kill(); throw new Error('Chrome no abrió el puerto de depuración'); }
  let destinos;
  for (let i = 0; i < 40; i++) {
    try { destinos = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json(); if (destinos.some((t) => t.type === 'page')) break; } catch { /* reintento */ }
    await dormir(250);
  }
  const ws = new WebSocket(destinos.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let n = 0;
  const pendientes = new Map();
  const red = { peticiones: [], errores: [] };
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendientes.has(d.id)) {
      const p = pendientes.get(d.id); pendientes.delete(d.id);
      d.error ? p.rej(new Error(`${d.error.message}`)) : p.res(d.result);
    } else if (d.method === 'Network.requestWillBeSent') red.peticiones.push(d.params.request.url);
    else if (d.method === 'Runtime.exceptionThrown') red.errores.push('excepción: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') red.errores.push('consola: ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
    else if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') red.errores.push('log: ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++n; pendientes.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  for (const d of ['Page', 'Runtime', 'Network', 'Log']) await send(`${d}.enable`);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: EXPONER_MAPA });
  await send('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: false });

  const pagina = {
    send, ev, red,
    async esquema(valor) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: valor }, { name: 'prefers-reduced-motion', value: movimientoReducido ? 'reduce' : 'no-preference' }] });
    },
    async esperar(expr, ms = 20000, etiqueta = expr) {
      const fin = Date.now() + ms;
      while (Date.now() < fin) { if (await ev(`!!(${expr})`)) return; await dormir(150); }
      throw new Error(`Tiempo agotado esperando: ${etiqueta}`);
    },
    /** Abre la URL y espera a que el mapa (canvas) exista y las capas estén cargadas. */
    async ir(url) {
      // Chrome recién abierto a veces tarda en cargar la primera página en esta máquina: un reintento antes de rendirse
      for (let intento = 1; ; intento++) {
        await send('Page.navigate', { url });
        try { await this.esperar("document.querySelector('.maplibregl-canvas')", 15000, 'canvas del mapa'); break; } catch (e) { if (intento >= 2) throw e; }
      }
      await dormir(1200);
    },
    async raton(x, y, tipo = 'mouseMoved') { await send('Input.dispatchMouseEvent', { type: tipo, x, y, button: 'none', buttons: 0 }); },
    async clic(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    },
    /** Pulsa una tecla. Chrome solo activa un botón con Enter/Espacio si el evento trae el código virtual y el texto. */
    async tecla(key) {
      const info = { Enter: { vk: 13, code: 'Enter', text: '\r' }, Escape: { vk: 27, code: 'Escape' }, ' ': { vk: 32, code: 'Space', text: ' ' }, Tab: { vk: 9, code: 'Tab' } }[key];
      const base = { key, code: info?.code ?? key, windowsVirtualKeyCode: info?.vk ?? 0 };
      await send('Input.dispatchKeyEvent', { type: info?.text ? 'keyDown' : 'rawKeyDown', ...base, ...(info?.text ? { text: info.text } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },
    /** Captura un rectángulo en coordenadas de la ventana. captureScreenshot pide coordenadas de página: se suma el scroll. */
    async captura(archivo, r) {
      const s = await ev('({x:window.scrollX,y:window.scrollY})');
      const clip = { x: Math.max(0, r.x + s.x), y: Math.max(0, r.y + s.y), width: r.w, height: r.h, scale: 1 };
      const shot = await send('Page.captureScreenshot', { format: 'png', clip });
      writeFileSync(archivo, Buffer.from(shot.data, 'base64'));
    },
    cerrar() {
      try { ws.close(); } catch { /* ya cerrado */ }
      chrome.kill();
      try { rmSync(dir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Windows puede retener archivos un instante */ }
    },
  };
  await pagina.esquema(esquema);
  return pagina;
}

// ── Contraste WCAG 2.2 ──
const canal = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function luminancia([r, g, b]) { return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b); }
export function contraste(a, b) { const [x, y] = [luminancia(a), luminancia(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
/** Convierte 'rgb(11, 11, 11)' o '#0b0b0b' en [r,g,b]. */
export function rgb(texto) {
  if (texto.startsWith('#')) return [1, 3, 5].map((i) => parseInt(texto.slice(i, i + 2), 16));
  return texto.match(/[\d.]+/g).slice(0, 3).map(Number);
}
