// Pruebas de web/seleccion.js. Se ejecutan con: node --test verificacion/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const RAIZ = join(import.meta.dirname, '..');
const S = require(join(RAIZ, 'web', 'seleccion.js'));

// ── Datos de juguete que reproducen los casos difíciles ──
const central = { town: 'CENTRAL AREA', zonas: ['DOWNTOWN CORE', 'OUTRAM', 'ROCHOR'] };
const bedok = { town: 'BEDOK', zonas: ['BEDOK'] };
const townPorZona = { 'DOWNTOWN CORE': central, OUTRAM: central, ROCHOR: central, BEDOK: bedok };
const ZONAS = ['BEDOK', 'DOWNTOWN CORE', 'ORCHARD', 'OUTRAM', 'ROCHOR'];
const ATR = [
  { nombre: 'Esplanade Theatre', zona: 'DOWNTOWN CORE' },
  { nombre: 'Esplanade Theatres on the Bay', zona: 'DOWNTOWN CORE' },
  { nombre: 'Isla lejana', zona: null },          // fuera del límite terrestre
  { nombre: 'Museo en Orchard', zona: 'ORCHARD' },  // área sin fila en la tabla
];
const nuevo = () => S.crear({ zonas: ZONAS, townPorZona, atracciones: ATR });

test('areasDelTown: un town con varias áreas devuelve todas, desde cualquiera de ellas', () => {
  for (const z of central.zonas) assert.deepEqual(S.areasDelTown(z, townPorZona), central.zonas);
});
test('areasDelTown: town de una sola área, área sin town y sin zona', () => {
  assert.deepEqual(S.areasDelTown('BEDOK', townPorZona), ['BEDOK']);
  assert.deepEqual(S.areasDelTown('ORCHARD', townPorZona), ['ORCHARD']);
  assert.deepEqual(S.areasDelTown(null, townPorZona), []);
});
test('areasDelTown devuelve una copia: modificarla no corrompe los datos', () => {
  S.areasDelTown('OUTRAM', townPorZona).push('X');
  assert.equal(central.zonas.length, 3);
});
test('townDeZona: nombre del town o null si el área no tiene fila', () => {
  assert.equal(S.townDeZona('OUTRAM', townPorZona), 'CENTRAL AREA');
  assert.equal(S.townDeZona('ORCHARD', townPorZona), null);
  assert.equal(S.townDeZona(null, townPorZona), null);
});

test('paginaPara: crece de paso en paso hasta incluir la posición', () => {
  assert.equal(S.paginaPara(0, 12, 24), 12);
  assert.equal(S.paginaPara(11, 12, 24), 12);
  assert.equal(S.paginaPara(12, 12, 24), 36);
  assert.equal(S.paginaPara(35, 12, 24), 36);
  assert.equal(S.paginaPara(36, 12, 24), 60);
});
test('paginaPara rechaza argumentos inválidos', () => {
  for (const a of [[-1, 12, 24], [1.5, 12, 24], [1, 0, 24], [1, 12, 0], ['1', 12, 24]]) assert.throws(() => S.paginaPara(...a), RangeError);
});

test('filtrar: sin consulta devuelve todos los índices', () => {
  assert.deepEqual(S.filtrar(ATR, ''), [0, 1, 2, 3]);
  assert.deepEqual(S.filtrar(ATR, '   '), [0, 1, 2, 3]);
  assert.deepEqual(S.filtrar(ATR, undefined), [0, 1, 2, 3]);
});
test('filtrar: por nombre o por área, sin distinguir mayúsculas; sin coincidencias devuelve vacío', () => {
  assert.deepEqual(S.filtrar(ATR, 'ESPLANADE'), [0, 1]);
  assert.deepEqual(S.filtrar(ATR, 'orchard'), [3]);   // coincide por nombre y por zona, una sola vez
  assert.deepEqual(S.filtrar(ATR, 'zzz'), []);
});
test('filtrar: una atracción sin zona no rompe la búsqueda', () => {
  assert.deepEqual(S.filtrar(ATR, 'lejana'), [2]);
});

test('estado inicial: nada seleccionado', () => {
  assert.deepEqual({ ...nuevo().get() }, { zona: null, atraccion: null, origen: null });
});
test('seleccionarZona: cambia el estado y avisa con el estado nuevo, el anterior y el origen', () => {
  const s = nuevo(), avisos = [];
  s.suscribir((nuevo_, anterior) => avisos.push([nuevo_, anterior]));
  assert.equal(s.seleccionarZona('OUTRAM', 'mapa'), true);
  assert.equal(avisos.length, 1);
  assert.deepEqual({ ...avisos[0][0] }, { zona: 'OUTRAM', atraccion: null, origen: 'mapa' });
  assert.equal(avisos[0][1].zona, null);
});
test('seleccionar lo mismo dos veces no vuelve a avisar (evita repintar y repetir el scroll)', () => {
  const s = nuevo(); let n = 0;
  s.suscribir(() => n++);
  s.seleccionarZona('BEDOK', 'tabla');
  assert.equal(s.seleccionarZona('BEDOK', 'mapa'), false);
  assert.equal(n, 1);
});
test('seleccionar una zona quita la atracción seleccionada', () => {
  const s = nuevo();
  s.seleccionarAtraccion(0, 'lista');
  s.seleccionarZona('BEDOK', 'mapa');
  assert.deepEqual({ ...s.get() }, { zona: 'BEDOK', atraccion: null, origen: 'mapa' });
});
test('seleccionarAtraccion: fija también la zona donde cae', () => {
  const s = nuevo();
  s.seleccionarAtraccion(3, 'mapa');
  assert.deepEqual({ ...s.get() }, { zona: 'ORCHARD', atraccion: 3, origen: 'mapa' });
});
test('seleccionarAtraccion: una atracción fuera del límite terrestre deja la zona en null', () => {
  const s = nuevo();
  s.seleccionarZona('BEDOK', 'mapa');
  s.seleccionarAtraccion(2, 'lista');
  assert.deepEqual({ ...s.get() }, { zona: null, atraccion: 2, origen: 'lista' });
});
test('solo hay una atracción seleccionada a la vez, también con coordenadas idénticas (Esplanade)', () => {
  const s = nuevo();
  s.seleccionarAtraccion(0, 'mapa');
  s.seleccionarAtraccion(1, 'mapa');
  assert.equal(s.get().atraccion, 1);
});
test('misma zona, otra atracción: sí avisa, porque cambió la atracción', () => {
  const s = nuevo(); let n = 0;
  s.seleccionarAtraccion(0, 'mapa');
  s.suscribir(() => n++);
  s.seleccionarAtraccion(1, 'mapa');
  assert.equal(n, 1);
});
test('un id de atracción inválido se rechaza y deja el estado intacto', () => {
  const s = nuevo();
  s.seleccionarZona('BEDOK', 'mapa');
  for (const id of [-1, ATR.length, 1.5, '1', null, undefined, NaN]) assert.throws(() => s.seleccionarAtraccion(id, 'mapa'), RangeError);
  assert.equal(s.get().zona, 'BEDOK');
});
test('una zona desconocida y un origen inválido se rechazan', () => {
  const s = nuevo();
  assert.throws(() => s.seleccionarZona('ATLANTIDA', 'mapa'), RangeError);
  assert.throws(() => s.seleccionarZona('BEDOK', 'teclado'), RangeError);
  assert.throws(() => s.seleccionarAtraccion(0, undefined), RangeError);
  assert.throws(() => s.limpiar('otro'), RangeError);
  assert.equal(s.get().zona, null);
});
test('limpiar: quita zona y atracción; si ya estaba limpio no avisa', () => {
  const s = nuevo(); let n = 0;
  s.seleccionarAtraccion(3, 'mapa');
  s.suscribir(() => n++);
  assert.equal(s.limpiar('mapa'), true);
  assert.equal(s.limpiar('mapa'), false);
  assert.equal(n, 1);
  assert.equal(s.get().zona, null);
});
test('quitarAtraccion: deja la zona y quita la atracción; si no había atracción no avisa', () => {
  const s = nuevo(); let n = 0;
  s.seleccionarAtraccion(3, 'mapa');
  s.suscribir(() => n++);
  assert.equal(s.quitarAtraccion('mapa'), true);
  assert.deepEqual({ ...s.get() }, { zona: 'ORCHARD', atraccion: null, origen: 'mapa' });
  assert.equal(s.quitarAtraccion('mapa'), false);
  assert.equal(n, 1);
});
test('quitarAtraccion sobre una atracción fuera del límite terrestre deja todo vacío', () => {
  const s = nuevo();
  s.seleccionarAtraccion(2, 'lista');
  s.quitarAtraccion('mapa');
  assert.deepEqual({ ...s.get() }, { zona: null, atraccion: null, origen: 'mapa' });
});
test('suscribir devuelve la función que cancela', () => {
  const s = nuevo(); let n = 0;
  const cancelar = s.suscribir(() => n++);
  s.seleccionarZona('BEDOK', 'mapa');
  cancelar();
  s.seleccionarZona('OUTRAM', 'mapa');
  assert.equal(n, 1);
});
test('el estado es inmutable: mutar lo que devuelve get() no cambia la selección', () => {
  const s = nuevo();
  s.seleccionarZona('BEDOK', 'mapa');
  assert.throws(() => { 'use strict'; s.get().zona = 'OUTRAM'; }, TypeError);
  assert.equal(s.get().zona, 'BEDOK');
});
test('cambiar la selección dentro de un suscriptor es un error (así se evitan los bucles entre componentes)', () => {
  const s = nuevo();
  s.suscribir(() => s.seleccionarZona('OUTRAM', 'tabla'));
  assert.throws(() => s.seleccionarZona('BEDOK', 'mapa'), /solo deben leerla/);
});
test('un suscriptor que falla no impide que los demás reciban el aviso, y el error se propaga', () => {
  const s = nuevo(); let llegó = false;
  s.suscribir(() => { throw new Error('falló el componente A'); });
  s.suscribir(() => { llegó = true; });
  assert.throws(() => s.seleccionarZona('BEDOK', 'mapa'), /componente A/);
  assert.equal(llegó, true);
  assert.equal(s.get().zona, 'BEDOK');                 // la selección quedó aplicada
});

// ── Los datos reales cumplen lo que el módulo da por supuesto ──
test('datos reales: invariantes de zonas, towns y atracciones', () => {
  const leer = (n) => JSON.parse(readFileSync(join(RAIZ, 'web', 'datos', n), 'utf8'));
  const zonas = leer('zonas.geojson').features.map((f) => f.properties.zona);
  const viv = leer('vivienda.json'), atr = leer('atracciones.json').filas;
  const real = {};
  viv.towns.forEach((t) => t.zonas.forEach((z) => { real[z] = t; }));
  const conocidas = new Set(zonas);

  assert.equal(zonas.length, 55);
  assert.equal(new Set(atr.map((a) => a.nombre)).size, atr.length, 'los nombres de atracciones son únicos');
  for (const a of atr) assert.ok(a.zona === null || conocidas.has(a.zona), `atracción en un área que no existe: ${a.zona}`);
  for (const z of Object.keys(real)) {
    assert.ok(conocidas.has(z), `el town apunta a un área inexistente: ${z}`);
    assert.ok(S.areasDelTown(z, real).includes(z), `${z} debe estar entre las áreas de su propio town`);
  }
  assert.equal(zonas.length - Object.keys(real).length, 26, 'hay 26 áreas sin fila en la tabla');

  const s = S.crear({ zonas, townPorZona: real, atracciones: atr });
  atr.forEach((_, i) => { s.seleccionarAtraccion(i, 'lista'); });          // las 107 se pueden seleccionar
  assert.equal(s.get().atraccion, atr.length - 1);
  assert.deepEqual(S.areasDelTown('OUTRAM', real).sort(), ['DOWNTOWN CORE', 'OUTRAM', 'ROCHOR']);
  assert.equal(S.townDeZona('ORCHARD', real), null);
});
