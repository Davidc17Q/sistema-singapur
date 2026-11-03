# Diseño técnico: mapa interactivo

Requisitos: `requirements.md`. Este diseño no cambia datos, ingesta ni paleta.

## 1. Estado actual y qué se reutiliza

`web/app.js` (IIFE asíncrona) ya tiene: `cifra()/deCifra()` y el `<dialog>` de fichas, `townPorZona`, `mostrarDetalle(zona)`, las capas `zonas`, `bordes`, `zonas-sel`, `puntos`, y las funciones `pintarMapa()`, `pintarLeyenda()`, `pintarAtracciones()`. Hoy hay una sola variable `seleccionada` (zona) y cada componente reacciona por su cuenta: el mapa abre el detalle, la tabla abre el detalle, y nadie resalta nada en los demás.

Se conserva todo eso. Se añade un estado de selección y se conectan los componentes a él.

## 2. Arquitectura de la selección

```
 mapa ──┐                          ┌── mapa    (filtros de borde, feature-state del punto, popup, centrado)
 tabla ─┼─► store.seleccionar...() ┼── tabla   (fila resaltada, scroll)
 lista ─┘      (estado único)      ├── lista   (tarjeta resaltada, página, scroll)
                                   ├── detalle (mostrarDetalle)
                                   └── anuncio (región aria-live)
```

Patrón Observer. Los componentes **escriben** en el store y **leen** de él. Ninguno llama a otro. Esto evita los bucles (el mapa selecciona, la tabla reacciona, la tabla vuelve a seleccionar) y evita que el estado visual dependa del orden de los eventos.

### 2.1 `web/seleccion.js` (nuevo, lógica pura)

Sin DOM ni MapLibre, para poder probarlo con `node --test`. Se carga como script clásico (`<script src="seleccion.js">` antes de `app.js`) y se exporta con un envoltorio UMD mínimo, de modo que en el navegador queda como `window.Seleccion` y en Node como `module.exports`. No usa módulos ES porque `app.js` no lo es y no hay paso de compilación.

```js
// Estado: { zona: string|null, atraccion: number|null, origen: 'mapa'|'tabla'|'lista'|null }
const store = Seleccion.crear({ townPorZona, atracciones });
store.seleccionarZona('OUTRAM', 'mapa');
store.seleccionarAtraccion(42, 'lista');
store.limpiar('mapa');
store.suscribir((estado, anterior) => { ... });   // devuelve la función para cancelar
```

Funciones puras que exporta:

| Función | Qué hace |
|---|---|
| `areasDelTown(zona, townPorZona)` | Devuelve todas las áreas del mismo town (`OUTRAM` → `DOWNTOWN CORE, OUTRAM, ROCHOR`). Sin town, devuelve `[zona]`. |
| `townDeZona(zona, townPorZona)` | Nombre del town o `null` (26 de 55 áreas no tienen). |
| `paginaPara(indice, visibles, paso)` | Cuántas tarjetas hay que mostrar para que la de posición `indice` sea visible. |
| `filtrar(filas, consulta)` | La misma regla de búsqueda que usa hoy `pintarAtracciones()`, extraída para que lista y selección coincidan. |

Reglas del estado:

- `seleccionarZona` pone `atraccion = null`.
- `seleccionarAtraccion(i)` pone `zona` = la zona donde cae la atracción, o `null` si cae fuera del límite terrestre (REQ-5.6).
- Seleccionar lo mismo dos veces no emite un cambio (no hay repintado ni re-scroll).
- Un id de atracción fuera de rango se rechaza con un error, no se ignora.

Identificador de atracción: el índice en `atr.filas`. Los 107 nombres son únicos y el orden es estable (los datos son estáticos y la ingesta los ordena por nombre).

### 2.2 `aplicarSeleccion(estado, anterior)` en `app.js`

Un único suscriptor que reparte el efecto a cada componente. El campo `origen` decide los efectos secundarios: el componente donde empezó la elección no hace scroll ni centra el mapa (REQ-3.6, 7.4).

| Componente | Efecto |
|---|---|
| Mapa, zona | `setFilter` de las capas de selección con `['in', ['get','zona'], ['literal', areas]]` (varias áreas si el town las cubre). |
| Mapa, atracción | `setFeatureState({source:'puntos', id}, {sel:true})` y se limpia el anterior. Abre o cierra el popup persistente. Activa la capa de atracciones si estaba apagada. |
| Mapa, cámara | `easeTo` / `fitBounds` si `origen !== 'mapa'`. Sin animación con `prefers-reduced-motion`. |
| Tabla | Clase `fila-sel` y `aria-current="true"` en la fila del town. Sin fila: ninguna (REQ-3.4). |
| Lista | Se vuelve a dibujar con la tarjeta marcada. Si hace falta, se limpia la búsqueda y se amplía la página antes (REQ-5.3). |
| Detalle | `mostrarDetalle(zona)`, que ya existe. |
| Anuncio | Texto breve en `#anuncio-seleccion` (`aria-live="polite"`). |

## 3. Popups

### 3.1 Contraste (REQ-1)

Causa raíz del bug: `maplibre-gl.css` fija `.maplibregl-popup-content{background:#fff}` y las puntas en `#fff`, sin `color`. En modo oscuro el texto hereda `--texto` (casi blanco).

Solución en `styles.css`, cargado después del CSS vendored y con la misma especificidad, así que gana por orden:

```css
.maplibregl-popup-content {
  background: var(--superficie); color: var(--texto);
  border-radius: 8px; padding: 8px 12px; font-size: .88rem; line-height: 1.4;
  box-shadow: 0 2px 10px rgba(0, 0, 0, .18);
}
.maplibregl-popup-anchor-top .maplibregl-popup-tip,
.maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
.maplibregl-popup-anchor-top-right .maplibregl-popup-tip { border-bottom-color: var(--superficie); }
/* ...los anclajes bottom, left y right con su propio border-*-color */
```

El cambio de esquema se actualiza solo porque usa variables CSS, no valores copiados (REQ-1.5).

Alternativa descartada: pasar `className` al `Popup` y fijar colores en JavaScript. Duplicaría los colores del tema en dos lugares.

### 3.2 Contenido (REQ-2, 4, 6)

| Popup | Disparo | Contenido | Interactivo |
|---|---|---|---|
| Hover de zona | `mousemove` sobre `zonas` | `<strong>Nombre</strong>`, «sin reventas HDB» si aplica, y «Clic para ver el detalle» | No |
| Hover de atracción | `mousemove` sobre `puntos` | Solo el nombre | No |
| Persistente de atracción | Clic o selección | Nombre, área, dirección, descripción, botón `cifra('Fuente F02')` | Sí: botón de ficha y de cerrar |
| Superpuestas | Clic sobre varios puntos | Lista de botones con los nombres | Sí |

Prioridad entre capas: el controlador de `mousemove` consulta primero `puntos`; si hay un punto, muestra su popup y no el de la zona. Se registra un solo `mousemove` para el mapa entero y no uno por capa, así no se disparan dos popups.

Superpuestas: el clic usa `queryRenderedFeatures(bbox, {layers:['puntos']})` con un cuadro de ±8 px alrededor del cursor. Devuelve todas las atracciones que se dibujan ahí, incluidas las de coordenadas idénticas. Es lo que ve el usuario, sin calcular distancias a mano ni agrupar datos. Se eliminan duplicados por id.

Todo texto de fuente pasa por `esc()`. El HTML se construye con plantillas, como el resto del código.

**R1 en esta capa:** las plantillas de hover no reciben datos numéricos; la función que las crea solo recibe el nombre y un booleano `sinDatos`. Así no es posible que una cifra llegue al hover aunque alguien la pase por error.

## 4. Orientación

### 4.1 Etiquetas de nombre (REQ-7)

Marcadores HTML (`maplibregl.Marker`) en vez de una capa `symbol`, porque una capa de texto exige un `glyphs` (R2).

- Posición: centro del rectángulo de la parte más grande de cada área, calculado una vez al cargar.
- Visibilidad, en cada `moveend`: se proyecta el rectángulo de cada área a píxeles y se ordenan por área descendente. Una etiqueta se muestra solo si cabe en su área y no se solapa con otra ya mostrada (algoritmo voraz).
- Estilo: etiqueta con fondo sólido `--superficie` y texto `--texto`, de 19:1 en claro y 15:1 en oscuro. Un fondo sólido evita el problema de leer texto sobre los rellenos `seq-4` y `seq-5`.
- `pointer-events: none` para que el clic llegue al polígono, y `aria-hidden="true"` porque el nombre ya está en la tabla y en el detalle.

| Alternativa | Veredicto |
|---|---|
| Capa `symbol` con fuentes `.pbf` propias | Añade binarios al despliegue y exige gestionar su licencia. Descartada. |
| `glyphs` remoto | Viola R2. Descartada. |
| Texto sin fondo con halo | No garantiza 4,5:1 sobre todos los rellenos. Descartada. |

### 4.2 Cámara

Al elegir desde la tabla o la lista: `fitBounds` del rectángulo de las áreas con `padding`, o `easeTo` al punto para una atracción. Se evita `flyTo` por su zoom exagerado en distancias cortas. `duration: 0` con `prefers-reduced-motion`.

## 5. Estados visuales y contraste (REQ-8)

Solo variables existentes.

| Estado | Mapa | Tabla y lista |
|---|---|---|
| Normal | Relleno de la escala; contorno fino | Sin marca |
| Hover | Anillo fino `--texto` en el borde de la zona; punto con radio mayor | Fondo `--pista` (ya existe) |
| Seleccionado | **Anillo doble**: halo `--superficie` de 5 px bajo un trazo `--texto` de 2,5 px. Punto con radio 8 y trazo doble. | Barra lateral de 4 px `--acento`, fondo `--pista`, `aria-current` |
| Activo (pulsado) | `:active` con hundimiento ligero en botones | Ídem |
| Foco | `outline: 2px solid var(--acento)` (ya global) | Ídem |

El anillo doble se justifica con los números de la Fase 1: ni `--texto` ni `--superficie` solos alcanzan 3:1 contra todos los rellenos, pero para cada relleno al menos uno de los dos sí (peor caso 5,26:1 en claro y 4,79:1 en oscuro). Se valida además con capturas.

**Contorno fino (Q6).** Una capa de línea de 0,75 px con `--texto-3` (4,98:1 en claro, 6,78:1 en oscuro contra la superficie) para que las áreas pálidas y las «sin datos» se distingan del fondo. Un contorno solo en la costa de la isla exigiría unir las geometrías de las áreas, que hoy no se calcula y requeriría una dependencia o un cambio en la ingesta. Fuera de alcance. El orden y el grosor exactos respecto de la capa `bordes` (blanca, 1,5 px) se deciden con capturas en la tarea T8, porque el blanco puede tapar el contorno. Si se tapa, se sube el contorno por encima de `bordes`.

**Punto de atracción (REQ-8.3, 8.4).** Hoy `--punto` falla 3:1 contra `seq-1` y `sin-dato` en claro. Se mantiene el color y se añade un trazo exterior `--texto` de 1,5 px bajo el trazo `--superficie` existente, que asegura el contorno del punto sobre cualquier relleno. Se verifica con los 12 pares calculados.

## 6. Teclado y táctil (REQ-9)

- Tabla de zonas: el nombre de la zona pasa a ser un `<button class="enlace-fila">`. No se pone `tabindex` ni `role` en la `<tr>`, para no romper la semántica de tabla. El clic en la fila sigue funcionando.
- Lista de atracciones: cada tarjeta recibe un `<button>` «Ver en el mapa».
- Los eventos `mousemove` de hover solo se registran con `(hover: hover)`, como hoy. En táctiles: toque abre el popup persistente o el detalle.
- `Escape` cierra el popup persistente.

## 7. Cómo se aplican R1 y R2 (REQ-10)

Defensa en tres capas, ninguna con excepciones:

| Capa | Mecanismo | Cuándo falla |
|---|---|---|
| Producción | CSP de `vercel.json` (`default-src 'self'`) | El navegador bloquea cualquier carga externa. Ya existe. |
| Puerta de publicación | `verificar.py` (nuevos checks) | Antes de publicar. No necesita navegador. |
| Navegador real | `verificacion/pruebas_web.mjs` | En desarrollo: registra toda petición de red. |

**Check estático nuevo en `verificar.py`.** Sobre `web/app.js`, `web/seleccion.js` y `web/styles.css` (no sobre `web/vendor`, que es código de terceros servido desde el mismo origen):

1. Falla si aparece alguno de: `glyphs`, `sprite`, `tiles`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `new Worker(`, `import(`.
2. Falla si `fetch(` aparece más de una vez o si su argumento no empieza por `'datos/'`. Hoy hay una sola llamada, en `leer`.
3. Falla si el CSS contiene `@import` o `url(` con `http(s)://` o `//`.
4. Falla si el JS contiene una URL absoluta que no esté en la lista de enlaces de licencia ya existentes (`https://data.gov.sg/open-data-licence`). Esa lista no habilita ninguna carga: las URLs solo se usan como `href` de un `<a>`, y los puntos 1 a 3 siguen prohibiendo cargarlas.

**Prueba de navegador.** `pruebas_web.mjs` levanta un servidor Node (`node:http`) que sirve `web/` con **las mismas cabeceras de `vercel.json`**, incluida la CSP, así lo que pasa en la prueba es lo que pasaría en producción. Escucha `Network.requestWillBeSent`, `Network.loadingFailed` y las violaciones de CSP, y falla ante cualquier petición cuyo origen no sea `127.0.0.1`.

**R1 en la prueba.** Para las 55 zonas y las 107 atracciones, simula el hover y compara el texto del popup con la plantilla esperada (nombre + texto fijo). Es una comparación exacta, más estricta que buscar dígitos. Para el detalle y el popup persistente, comprueba que cada valor numérico de datos esté dentro de un `.cifra`.

**Pruebas de las pruebas.** Cada check se prueba rompiéndolo a propósito (REQ-10.5): un `glyphs` externo, un `fetch` a otro dominio, una cifra en el hover, un `<link>` externo. Debe dar FAIL. El resultado se registra en la bitácora.

## 8. Pruebas y despliegue en Vercel (decisión Q4)

Se aprobó usar Node + Chrome como herramienta de desarrollo **solo si hace falta**. Hace falta porque los popups se construyen dentro de eventos de MapLibre sobre un canvas WebGL, y REQ-10.1 a 10.3 no se pueden comprobar de otra forma.

| Prueba | Herramienta | Dónde |
|---|---|---|
| Lógica del store | `node --test` | `verificacion/seleccion.test.mjs` |
| Puerta de publicación | Python, ya existente | `verificacion/verificar.py` |
| Comportamiento, contraste y R1/R2 en navegador | Node + Chrome por CDP | `verificacion/pruebas_web.mjs` |

Cómo no afecta al despliegue:

- Vercel publica solo `web/` (`outputDirectory`). `verificacion/` no se sirve.
- No se crea `package.json` ni `node_modules`. Las pruebas usan solo lo incluido en Node 22 (`node:test`, `node:http`, `WebSocket`, `fetch`).
- `web/` solo gana `seleccion.js` (unos 3 KB). Presupuesto total de REQ-11.5: 20 KB.
- Chrome se localiza con la variable `CHROME_PATH` o rutas habituales de Windows. Si no se encuentra, la prueba termina con un mensaje claro y código distinto de 0, sin pasar en silencio.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El blanco de `bordes` tapa el contorno fino | Se decide el orden con capturas (T8). Plan B documentado en la sección 5. |
| Etiquetas apretadas en el centro (Downtown Core, Museum, Newton) | Algoritmo voraz con exclusión por solape. Se valida con capturas a 3 niveles de zoom. |
| WebGL headless distinto en otra máquina | Chrome con `--use-angle=swiftshader` funcionó aquí. Se documenta la opción de arranque. |
| `innerHTML` borra el estado visual de la lista | La clase de selección se calcula desde el store en cada dibujo. |
| Bucle de eventos entre componentes | Los componentes solo escriben en el store; el store no emite si el valor no cambió. |
| `registro[]` crece cada vez que se abre un popup | Ya ocurre en el código actual con cada render. Aceptado; sin impacto práctico con 107 atracciones. |

## 10. Archivos

| Archivo | Cambio |
|---|---|
| `web/seleccion.js` | Nuevo |
| `web/app.js` | Se añaden el store, `aplicarSeleccion`, popups, etiquetas. Se sustituye `seleccionada`. Cambian `mostrarDetalle`, el listener de la tabla y `pintarAtracciones`. |
| `web/styles.css` | Reglas de popup, filas y tarjetas seleccionadas, etiquetas de zona. Sin variables de color nuevas. |
| `web/index.html` | `<script src="seleccion.js">`, región `aria-live`. |
| `verificacion/verificar.py` | Checks de R2 sobre el código de la web |
| `verificacion/seleccion.test.mjs` | Nuevo |
| `verificacion/pruebas_web.mjs` | Nuevo |
| `README.md` | Una sección breve sobre las pruebas de interfaz |
