# Bitácora técnica de desarrollo

Registro cronológico de lo que se hizo, por qué y cómo funciona. Las entradas nuevas van al final. El estado actual está en `DEVELOPMENT_STATUS.md`.

---

## 2026-11-02 · Diagnóstico: el popup del mapa no se lee en modo oscuro

### 1. Problema identificado

Al pasar el mouse sobre una zona del mapa aparece un recuadro blanco que parece vacío. Lo reportó el usuario. Esperaba ver al menos el nombre de la zona.

### 2. Análisis técnico (causa raíz)

El texto sí está. El recuadro se construye con `nombreZona()` en `web/app.js`:

```js
emergente.setLngLat(e.lngLat).setHTML(nombreZona(e.features[0])).addTo(mapa);
// → <strong>Novena</strong><br>S$ 7.741 por m²
```

El problema es de herencia de estilos CSS:

1. `web/vendor/maplibre-gl.css` define `.maplibregl-popup-content { background:#fff; ... }` con un blanco fijo y **no define `color`**.
2. Sin `color` propio, el texto hereda el `color` del `body`. `web/styles.css` lo fija con `color: var(--texto)`.
3. En modo oscuro (`@media (prefers-color-scheme: dark)`), `--texto` vale `#f0efec`, casi blanco.
4. Resultado: texto casi blanco sobre fondo blanco.

Mecanismo que conviene recordar: en CSS, `color` es una propiedad **heredada** y `background` no. Una librería que fija el fondo sin fijar el color depende de que el sitio donde se incrusta use texto oscuro. Este sitio cambia de tema, así que lo rompe.

### 3. Archivos involucrados

| Archivo | Responsabilidad | Papel en el bug |
|---|---|---|
| `web/vendor/maplibre-gl.css` | Estilos de MapLibre, minificados en una línea | Fija `background:#fff` en el popup y en sus puntas, sin `color` |
| `web/styles.css` | Estilos del sitio, con variables de tema claro y oscuro | Fija `body{color:var(--texto)}` y no tiene ninguna regla para el popup |
| `web/app.js` | Crea el `Popup` y su HTML | Correcto: el contenido es válido |
| `vercel.json` | CSP | Descartada como causa: `style-src 'unsafe-inline'` permite los estilos |

### 4. Cómo se detectó

Primero por lectura de código: la hipótesis salió de leer los archivos. Un sub-agente de investigación la respaldó, pero **yo no había visto el bug**. Para confirmarlo se escribió un script que controla Chrome real por el protocolo DevTools (CDP) y lee los estilos calculados:

| Modo | `color` calculado | `background` calculado | Opacidad | Contraste |
|---|---|---|---|---|
| Claro | `rgb(11, 11, 11)` | `rgb(255, 255, 255)` | 1 | 19,68:1 |
| Oscuro | `rgb(240, 239, 236)` | `rgb(255, 255, 255)` | 1 | **1,15:1** |

Quedan descartadas la transparencia (opacidad 1), la superposición y los datos faltantes (el `innerText` es «Novena / S$ 7.741 por m²»).

### 5. Decisiones técnicas

- **Medir antes de corregir.** La causa se verificó en un navegador real. Lo que dijo un sub-agente no se tomó como prueba.
- **Script CDP sin dependencias** (`WebSocket` y `fetch` incluidos en Node 22) en vez de instalar Playwright: el proyecto presume no tener dependencias y Vercel no debe ver un `package.json`.
- **La solución se hará con variables de tema** en `styles.css` y no con colores copiados (ver el diseño, sección 3.1).

### 6. Conceptos técnicos

- **Herencia CSS:** `color` se hereda, `background` no.
- **Contraste WCAG 2.2:** razón `(L1 + 0,05) / (L2 + 0,05)` entre las luminancias relativas de dos colores. Mínimos: 4,5:1 para texto normal, 3:1 para texto grande y componentes gráficos.
- **CDP (Chrome DevTools Protocol):** protocolo por WebSocket que permite abrir páginas, emular `prefers-color-scheme`, mover el mouse y leer `getComputedStyle`.

### 7. Pruebas

- Reproducido en claro y oscuro, con estilos calculados y capturas.
- **Tropiezo registrado:** la primera ejecución produjo capturas completamente en blanco (2,7 KB). Causa: `Page.captureScreenshot` usa coordenadas de la página completa y el script le pasó coordenadas de la ventana después de hacer scroll. Se corrigió sumando `window.scrollX/Y`, y se comprobó que las nuevas capturas pesan 82 y 90 KB y se ven. Los valores de estilo de la primera ejecución eran válidos porque no dependen de la captura.
- **Pendiente:** corregir el CSS (tarea T2) y volver a medir.

### 8. Resultado

Sin cambios de código todavía. El bug quedó confirmado y su causa, localizada.

---

## 2026-11-02 · Diagnóstico: contraste del sistema e interacción actual

### 1. Problema identificado

El usuario pidió auditar el contraste (WCAG 2.2) y los estados de interacción antes de añadir selección, popups y sincronización. También pidió entender cómo interactúan hoy el mapa y la tabla.

### 2. Análisis técnico

**Contraste.** Se calculó con la fórmula de luminancia relativa de WCAG 2.2 sobre las variables de `styles.css`. Falla en estos casos:

| Elemento | Valor | Mínimo |
|---|---|---|
| Texto del popup, oscuro | 1,15:1 | 4,5 |
| Borde de selección (`--texto`) sobre `seq-5`, claro | 1,65:1 | 3 |
| Mismo borde sobre `seq-4` y `seq-5`, oscuro | 1,84:1 y 1,15:1 | 3 |
| Punto de atracción (`--punto`) sobre `seq-1` y sobre `sin-dato`, claro | 2,42:1 y 2,49:1 | 3 |
| Rellenos `seq-1..3` y `sin-dato` contra el fondo del mapa | 1,23 a 2,91:1 | 3 |

Pasan: texto secundario (≥ 4,98:1), etiquetas PROXY (≥ 7,31:1), enlaces y acento.

**Interacción.** Hoy no hay estado de selección compartido:

- El mapa abre el detalle de la zona, y solo resalta su borde.
- La tabla abre el detalle del primer área de un *town* (`t.zonas[0]`) y no resalta nada.
- La lista de atracciones (tarjetas, no tabla) no responde a nada y el mapa tampoco la responde a ella.
- Las filas solo se activan con mouse: la `<tr>` no es enfocable.

**Datos que condicionan el diseño** (medidos sobre `web/datos`):

- 85 de 107 atracciones quedan a menos de 14 px de otra en el encuadre inicial. «Esplanade Theatre» y «Esplanade Theatres on the Bay» tienen coordenadas idénticas.
- La lista muestra 12 tarjetas y se filtra, así que una atracción elegida en el mapa puede no estar en el DOM.
- `CENTRAL AREA` cubre 3 áreas y `KALLANG/WHAMPOA` cubre 2; 26 de las 55 áreas no tienen fila.

### 3. Archivos involucrados

`web/app.js` (secciones mapa, tabla y atracciones), `web/styles.css` (variables y componentes), `web/datos/atracciones.json`, `web/datos/vivienda.json`, `web/datos/zonas.geojson`, `catalogo/towns_a_zonas.json`. Solo lectura.

### 4. Hallazgo sobre las restricciones duras

- **R1 (toda cifra con ficha) hoy se incumple** en el popup de hover: muestra «S$ 7.741 por m²» sin ficha, y una ventana que desaparece al mover el mouse no se puede tocar.
- **R2 (sin terceros) se verifica débilmente.** El check «ninguna carga desde otro dominio» de `verificar.py` solo mira atributos `src`/`href` de archivos `.js/.css` en el HTML. No revisa `app.js`, así que un `glyphs: 'https://…'` pasaría la verificación.

### 5. Decisiones técnicas

Se fijaron con el usuario (Q1 a Q6):

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Hover de zona sin cifras | Mostrar la cifra en hover | La cifra sin ficha incumple R1 |
| Etiquetas con marcadores HTML | Capa `symbol`; `glyphs` remoto | La capa de texto exige `glyphs`: o archivos de fuente propios (peso y licencia) o un servidor externo (viola R2) |
| Superpuestas: popup con lista, usando `queryRenderedFeatures` | Clusters de MapLibre; desplazar puntos | Los clusters necesitan texto (mismo problema de fuentes); desplazar falsea la ubicación |
| Contorno fino por zona | Contorno solo de la costa | Exige unir geometrías: dependencia o cambio de ingesta |
| Pruebas con Node + Chrome, sin `package.json` | Playwright | Evita dependencias y que Vercel detecte un proyecto Node |

### 6. Conceptos técnicos

Patrón Observer para la selección compartida; `queryRenderedFeatures` (consulta lo que realmente se dibuja bajo el cursor); `feature-state` de MapLibre; CSP; contraste de componentes gráficos (WCAG 1.4.11).

### 7. Pruebas

- `python verificacion/verificar.py`: 89 PASS, 0 fallos (línea base).
- Contrastes calculados con script propio; se revalidan en navegador en T2 y T8.
- Auditoría de superposición calculada sobre coordenadas: asume 1 px ≈ 0,00051° en el encuadre inicial de 1000 px de ancho. **Aproximación**; se confirmará con el mapa real en T5.

### 8. Resultado

Diagnóstico y plan aprobados por el usuario. Sin cambios de código.

---

## 2026-11-02 · Planificación: steering, specs y documentación

### 1. Problema identificado

El trabajo no debe depender del historial de una conversación. Faltaban `.kiro/` y `docs/`.

### 2. Análisis técnico

No existía ningún steering, spec ni documento de seguimiento. El `README.md` es la fuente de verdad del producto. Se extrajo de él lo que condiciona el trabajo, sin inventar características.

### 3. Archivos creados

| Archivo | Responsabilidad |
|---|---|
| `.kiro/steering/producto.md` | Usuario, preguntas, restricciones duras R1 y R2, protección de datos, PROXY, accesibilidad |
| `.kiro/steering/tecnologia.md` | Stack, convenciones del código, pruebas, reglas de Git, aviso sobre archivos fuera del workspace |
| `.kiro/steering/estructura.md` | Carpetas, flujo de datos, mapa de `app.js` y datos que condicionan el mapa |
| `.kiro/steering/continuidad.md` | Protocolo de inicio y cierre de sesión |
| `.kiro/specs/mapa-interactivo/requirements.md` | 11 requisitos con criterios numerados |
| `.kiro/specs/mapa-interactivo/design.md` | Arquitectura, alternativas, enforcement de R1/R2 |
| `.kiro/specs/mapa-interactivo/tasks.md` | Tareas con dependencias y criterios de aceptación |
| `docs/DEVELOPMENT_LOG.md`, `docs/DEVELOPMENT_STATUS.md` | Este seguimiento |

### 4. Solución y decisiones

- **Un solo spec** (`mapa-interactivo`) para toda la funcionalidad. No existía otro que duplicar.
- **«Cifra» se definió explícitamente** en los requisitos: valor calculado o agregado. Una dirección con dígitos no es una cifra. Sin esta definición, la prueba de R1 daría falsos positivos con direcciones como «1 Raffles Place».
- **R1 se prueba por comparación exacta, no buscando dígitos:** el popup de hover debe ser exactamente nombre + texto fijo.
- **Defensa en capas para R2:** CSP en producción, check estático en `verificar.py` y registro de red en navegador. Detalle en `design.md`, sección 7.
- **Rama `feat/mapa-interactivo`.** Sin commits hasta que el usuario lo pida.

### 5. Pruebas

Verificación de que los archivos existen y de la rama activa: ver `DEVELOPMENT_STATUS.md`.

### 6. Resultado

Sin cambios en el comportamiento del sistema. Queda lista la Fase 3.

### Lecciones del entorno

- Las herramientas de edición de Kiro fallan con archivos **fuera del workspace**: concatenan la ruta absoluta detrás de su carpeta de snapshots (`ENOENT … snapshots\…\c:\Users\…\Temp`). Los scripts temporales van dentro del workspace, en `.tmp-diag/`, excluido con `.git/info/exclude` (local, no se versiona).
- `fs_write` anunció «Created» para un archivo que luego no existía. Se verifica con `ls` tras crear archivos importantes.

---

## 2026-11-02 · Implementación: mapa interactivo con selección compartida (T2 a T11)

### 1. Problema identificado

El mapa no se orientaba ni respondía: el popup de hover era ilegible en modo oscuro, el hover mostraba cifras sin ficha (incumple R1), la selección era una variable suelta sin relación con la tabla ni con la lista, y la restricción de «sin terceros» (R2) solo se comprobaba de forma débil.

### 2. Análisis técnico

- **Popup:** `maplibre-gl.css` fija `background:#fff` y no define `color`; el texto heredaba el casi blanco del tema oscuro (1,15:1).
- **Interacción:** cada componente reaccionaba por su cuenta y nadie sabía lo que hacía el otro. La causa es estructural: no había un estado compartido.
- **R2:** el check de `verificar.py` solo miraba atributos `src`/`href` de `.js/.css` en el HTML. Un `glyphs: 'https://…'` en el estilo del mapa habría pasado.

### 3. Archivos involucrados

| Archivo | Responsabilidad |
|---|---|
| `web/seleccion.js` (nuevo) | Estado de selección y funciones puras. Sin DOM ni MapLibre, por eso se prueba con `node --test` |
| `web/app.js` | Cinco suscriptores, popups, clic y hover del mapa, etiquetas, plantillas compartidas |
| `web/styles.css` | Popups con variables de tema, estados de fila y tarjeta, etiquetas |
| `web/index.html` | Carga `seleccion.js`, región `aria-live`, favicon en línea |
| `verificacion/verificar.py` | 20 checks nuevos de R2 sobre el código de la web |
| `verificacion/cdp.mjs`, `pruebas_web.mjs`, `seleccion.test.mjs` | Pruebas en Chrome real y del store. Herramienta de desarrollo, no se publica |

### 4. Solución implementada

**Un estado, varios suscriptores (patrón Observer).** El store guarda `{zona, atraccion, origen}` y avisa a quien se suscribió:

```js
const store = Seleccion.crear({ zonas, townPorZona, atracciones: atr.filas });
[reflejarDetalle, reflejarTabla, reflejarLista, reflejarMapa, anunciar].forEach((fn) => store.suscribir(fn));

mapa.on('click', (e) => { /* ... */ store.seleccionarAtraccion(id, 'mapa'); });   // quien origina solo escribe
```

El campo `origen` decide los efectos secundarios: si la elección empieza en el mapa, la página no se desplaza; si empieza en la tabla o la lista, sí lleva al mapa. El store **lanza un error si un suscriptor intenta cambiar la selección** mientras se avisa: ese es el bucle mapa → tabla → mapa que el diseño quiere impedir, y prefiero que falle en voz alta.

**Popup de hover sin cifras (R1).** La plantilla solo recibe un nombre y la *clave* de un aviso fijo; una cifra no tiene por dónde entrar:

```js
const AVISOS = { precio: 'sin reventas HDB', edificios: 'sin edificios HDB' };
const hoverZona = (nombre, aviso) => { if (aviso != null && !Object.hasOwn(AVISOS, aviso)) throw ...; /* nombre + aviso + pista */ };
```

**Un solo `mousemove` y un solo `click`** para todo el mapa, con `queryRenderedFeatures`. MapLibre devuelve primero la capa de arriba, así que un punto gana sobre la zona sin código de prioridad. El clic usa una caja de ±8 px, y devuelve todos los puntos que se dibujan ahí, incluidos los de coordenadas idénticas.

**Anillo doble.** Dos líneas sobre el mismo borde: un halo ancho de `--superficie` bajo un trazo fino de `--texto`. Ningún color solo contrasta con los seis rellenos, pero para cada relleno al menos uno de los dos sí (peor caso 5,26:1 en claro y 4,79:1 en oscuro).

**Etiquetas con marcadores HTML y algoritmo voraz:** de la zona más grande a la más pequeña, se muestra si cabe, si está en el lienzo y si no tapa otra etiqueta ni un punto.

**R2 en tres capas:** (1) análisis estático en `verificar.py`; (2) el navegador de prueba registra toda petición y toda violación de CSP, sirviendo `web/` con las cabeceras reales de `vercel.json`; (3) la CSP en producción.

### 5. Decisiones técnicas

| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
| Marcadores HTML para las etiquetas | Capa `symbol`; `glyphs` remoto | El texto de MapLibre exige `glyphs`: o binarios propios o un servidor externo (viola R2) |
| Regla estática por claves (`tiles:`, `glyphs:`) | Prohibir la palabra | `tiles` es el nombre de las tarjetas del panorama: la palabra daría falsos positivos y una regla que dispara con código legítimo acaba desactivada |
| Lista para elegir entre puntos superpuestos | Clusters; desplazar puntos | Los clusters piden texto (fuentes); desplazar falsea la ubicación |
| No desplazar la página al elegir en el mapa | Scroll automático a la tabla o lista | El usuario acaba de hacer clic en el mapa; el popup ofrece «Ver en la lista» |
| Pruebas con Node y Chrome sin `package.json` | Playwright | Evita dependencias y que Vercel detecte un proyecto Node |

### 6. Conceptos técnicos

Observer; `feature-state` de MapLibre; `queryRenderedFeatures`; CDP (protocolo DevTools de Chrome); contraste WCAG 2.2; CSP; prueba de mutación (estropear el código a propósito para comprobar que las pruebas fallan); `aria-live`.

### 7. Pruebas

Ver `DEVELOPMENT_STATUS.md`, sección «Pruebas realizadas»: 109 PASS en `verificar.py`; 27 de 27 en el store; 92 de 92 en el navegador; 12 de 12 a 375 px; 23 de 23 violaciones de R2 detectadas.

**Hallazgos de las propias pruebas, que conviene recordar:**
- Varias veces una prueba falló por **un defecto de la prueba y no del código** (píxeles pegados al borde de la zona, un selector que tomaba el primer popup del DOM, criterios demasiado estrictos). Cada vez se diagnosticó antes de tocar nada.
- Una captura salió en blanco dos veces (coordenadas de página vs ventana). Las capturas se miran antes de usarlas como evidencia.
- La mutación de la suite de navegador quedó **incompleta**: algunas mutaciones tumbaron el recorrido antes de llegar al check. Se mejoró la robustez (`?.click()`), pero no se repitió todo. Detalle en el estado.
- Node falla con «stdout is not a tty» si su salida no va directo a la terminal del agente. Se resolvió con un resumen en archivo.

### 8. Resultado

El mapa muestra el nombre de la zona en un popup legible en claro y oscuro, permite elegir zonas y atracciones desde cualquiera de los tres componentes con el mismo estado visible en todos, y las restricciones R1 y R2 están comprobadas por código. `web/` creció ~26 KB (presupuesto era 20 KB). Pendiente: probarlo en Vercel y en un teléfono físico.
