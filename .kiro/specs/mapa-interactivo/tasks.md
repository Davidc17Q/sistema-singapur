# Tareas: mapa interactivo

Leyenda: `[x]` hecha y verificada contra su criterio · `[ ]` pendiente · `[~]` en curso.
Una tarea solo se marca al cumplir **todos** sus criterios, con la prueba ejecutada. Requisitos en `requirements.md`, decisiones en `design.md`.

Rama: `feat/mapa-interactivo`. Sin commits hasta que el usuario lo pida.

## Fase 1 · Diagnóstico

- [x] **D1.** Inspeccionar el proyecto y entender la implementación actual. *Evidencia:* lectura completa de ingesta, verificación, frontend y catálogo; `verificar.py` da 89 PASS y 0 fallos.
- [x] **D2.** Reproducir el popup invisible en un navegador real. *Evidencia:* Chrome 156 por CDP. Claro `rgb(11,11,11)` sobre `rgb(255,255,255)`; oscuro `rgb(240,239,236)` sobre `rgb(255,255,255)`, opacidad 1. Capturas vistas.
- [x] **D3.** Medir el contraste WCAG de popup, selección, puntos y rellenos. *Evidencia:* tabla de la sección 2.4 del diagnóstico, calculada con la fórmula de luminancia relativa de WCAG 2.2.
- [x] **D4.** Mapear la interacción actual mapa, tabla y lista; medir superposición de puntos. *Evidencia:* 85 de 107 puntos a menos de 14 px de otro; 2 con coordenadas idénticas; 26 áreas sin fila.

## Fase 2 · Planificación

- [x] **T1.** Steering, Specs, `docs/` y rama de trabajo. *Criterio:* existen `.kiro/steering/{producto,tecnologia,estructura,continuidad}.md`, `.kiro/specs/mapa-interactivo/{requirements,design,tasks}.md`, `docs/DEVELOPMENT_LOG.md` y `docs/DEVELOPMENT_STATUS.md`, y la rama `feat/mapa-interactivo` está activa.

## Fase 3 · Implementación

- [x] **T2.** Corregir el contraste del popup. *Depende de:* T1. *Cubre:* REQ-1.
  - [x] Reglas `.maplibregl-popup-content`, puntas y botón de cerrar en `styles.css`.
  - [x] Medido en Chrome 156 (`verificacion/cdp.mjs`): claro 19,17:1 y oscuro 15,15:1; las 8 puntas por anclaje del mismo color que el fondo. Antes de la corrección la misma medición dio FAIL en oscuro (1,15:1), así que detecta el defecto.
  - [x] Capturas en claro y oscuro vistas: nombre y precio legibles en ambos modos.
  - Pendiente de T5: comprobar el botón de cerrar sobre un popup persistente real.

- [x] **T3.** Módulo `seleccion.js` con pruebas. *Depende de:* T1. *Cubre:* REQ-3.3, 3.4, 5.3, 5.4, 5.6.
  - [x] `crear`, `seleccionarZona`, `seleccionarAtraccion`, `limpiar`, `suscribir`.
  - [x] `areasDelTown`, `townDeZona`, `paginaPara`, `filtrar`.
  - [x] `verificacion/seleccion.test.mjs`: 25 pruebas, 25 pasan. Incluyen town multi-área, área sin fila, selección repetida sin avisar, id inválido, atracción sin zona, una sola selección a la vez, reentrancia, suscriptor que falla y un bloque con los datos reales (55 áreas, 107 atracciones únicas, 26 áreas sin fila).
  - [x] Prueba de mutación: 8 defectos introducidos a propósito, 8 detectados; archivo restaurado idéntico.
  - Nota: el reporter por defecto de `node --test` falla en la terminal del agente («stdout is not a tty»). Se ejecuta con `--test-reporter=tap --test-reporter-destination=<archivo>`. En una terminal normal, `node --test verificacion/` funciona.

- [x] **T4.** Popup de hover de zona y prioridad de capas. *Depende de:* T2. *Cubre:* REQ-2.
  - [x] Plantilla `hoverZona(nombre, aviso)`: solo recibe un nombre y la clave de un aviso fijo (`precio`/`edificios`); una clave desconocida lanza error.
  - [x] Un único `mousemove` para el mapa con `queryRenderedFeatures(['puntos','zonas'])`; el HTML solo se reconstruye si cambia la zona o la capa.
  - [x] `verificacion/pruebas_web.mjs`: 14 de 14 comprobaciones en Chrome. Las 55 zonas en las dos capas muestran exactamente nombre + aviso + pista y ningún dígito; sin reconstrucción al moverse dentro de una zona; sin parpadeo en 6 cruces entre zonas vecinas; desaparece fuera del mapa y sobre el mar; un punto de atracción gana sobre la zona; legible en modo oscuro (15,15:1 y 9,72:1).
  - Alcance reducido a pedido del usuario: **no se hizo** la prueba de mutación de la suite de navegador (sí se hizo con `seleccion.js`). Queda como deuda de verificación; los scripts están en `.tmp-diag/mutar_web.mjs` y `mut_t4.json`.

- [x] **T5.** Atracciones en el mapa: hover, clic, popup persistente, superpuestas. *Depende de:* T3, T4. *Cubre:* REQ-4, REQ-6.
  - [x] Ids numéricos en las features de `puntos` (`id` y `properties.i`); `feature-state` `sel`.
  - [x] Hover con solo el nombre; popup persistente con nombre, área, dirección, descripción, «Fuente F02» y «Ver en la lista». Se cierra con ✕ o Escape.
  - [x] Clic con `queryRenderedFeatures` en una caja de ±8 px: un punto lo selecciona, varios abren una lista para elegir, ninguno selecciona la zona.
  - [x] Verificado con el par de coordenadas idénticas (Esplanade): las dos se pueden elegir.

- [x] **T6.** Sincronización lista ↔ mapa de atracciones. *Depende de:* T5. *Cubre:* REQ-5.
  - [x] Botón «Ver en el mapa» en cada tarjeta; la tarjeta marcada se calcula desde el store en cada dibujo.
  - [x] Mapa → lista: limpia la búsqueda, amplía la página y marca la tarjeta. El popup trae «Ver en la lista», que lleva la tarjeta a la vista.
  - [x] Lista → mapa: enciende la capa, resalta el punto, abre su popup y centra (con animación comprobada a < 0,002°).
  - [x] Casos verificados: atracción filtrada, atracción lejos en la lista, atracción fuera del límite terrestre, una sola selección a la vez, filtrar no cambia la selección.

- [x] **T7.** Sincronización tabla de zonas ↔ mapa, con teclado. *Depende de:* T3. *Cubre:* REQ-3, REQ-9.1.
  - [x] El nombre de la zona es un `<button>`; fila marcada con clase `fila-sel` y `aria-current`.
  - [x] Un town multi-área resalta todas sus áreas (CENTRAL AREA → 3).
  - [x] Área sin fila: detalle con aviso, ninguna fila marcada, sin error (ORCHARD).
  - [x] Verificado con Enter sobre el botón, y clic en OUTRAM que marca la fila CENTRAL AREA.
  - Pendiente: revisar a ojo el aspecto de la fila marcada (la captura salió en blanco); se hace en T8.
  - **Desviación del requisito:** REQ-3.6 y 5.2 pedían que la fila o tarjeta «se desplace a la vista» al elegir en el mapa. No se hace: la lista está varias pantallas debajo del mapa y un scroll automático sacaría al usuario del mapa justo después de su clic. Se resalta, y el popup ofrece «Ver en la lista». Elegir desde la tabla o la lista sí lleva al mapa.

- [x] **T8.** Estados visuales y contraste. *Depende de:* T5, T6, T7. *Cubre:* REQ-8.
  - [x] Anillo doble de selección (`zonas-sel-halo` 6 px `--superficie` + `zonas-sel` 2,5 px `--texto`) y de hover (4 px + 1,5 px).
  - [x] Contorno fino: capa `contorno`, `--texto-3`, 0,75 px, por encima de `bordes`. Con capturas se comprobó que el borde blanco no lo tapa.
  - [x] Punto de atracción: aro exterior (`puntos-aro`) más trazo interior; seleccionado = más grande y con los colores invertidos; hover = radio 7.
  - [x] Medido en Chrome con los colores reales de la página, en claro y oscuro (20 comprobaciones nuevas, suite en 63 de 63): anillo ≥ 3:1 contra los 6 rellenos (peor caso 5,26:1 claro y 4,79:1 oscuro); ningún color del anillo basta por sí solo; contorno ≥ 3:1; punto con aro ≥ 3:1; barra de selección ≥ 3:1 y texto sobre fondo marcado ≥ 4,5:1.
  - [x] Capturas vistas: anillo de selección legible sobre rellenos claros y oscuros en los dos modos, contorno de las zonas «sin datos» visible, puntos con aro.
  - **Sin revisar a ojo:** anillo de hover, un punto seleccionado con el aro nuevo, y las filas/tarjetas marcadas en modo claro (la captura de la tabla salió en blanco). Sus colores y contrastes sí están medidos.

- [x] **T9.** Etiquetas de zona y cámara. *Depende de:* T7. *Cubre:* REQ-7.
  - [x] `cajaDeZona()` (rectángulo de la parte más grande del área) y un marcador HTML por área, `aria-hidden`, `pointer-events: none`, fondo sólido `--superficie`.
  - [x] `colocarEtiquetas()`: algoritmo voraz de la zona grande a la pequeña; se muestra si cabe en su área, queda en el lienzo y no tapa otra etiqueta ni un punto. Se recalcula en `moveend`, `resize` y al activar o apagar las atracciones.
  - [x] Cámara en `reflejarMapa`: `easeTo` para una atracción, `fitBounds` para el conjunto de áreas del town, sin animación con `prefers-reduced-motion`.
  - [x] Capturas a tres niveles de zoom en claro y oscuro, vistas: sin solapes, legibles. 27 etiquetas a escala inicial, 25 a escala media, 9 muy cerca.
  - [x] Pruebas en Chrome (suite en 80 de 80): una etiqueta por área; sin solapes; dentro del lienzo; ≥ 4,5:1; el clic atraviesa; Downtown Core gana etiqueta al acercarse; con atracciones activas ninguna tapa un punto; con movimiento reducido la zona queda encuadrada al instante.
  - Limitación conocida: a escala inicial las áreas pequeñas del centro (Downtown Core, Museum, Newton...) no tienen etiqueta; la ganan al acercar. Es el comportamiento pedido (REQ-7.2).

- [~] **T10.** Restricción dura R1 y R2 en el código. *Depende de:* T4, T5. *Cubre:* REQ-10. **Hecha salvo una parte de la verificación por mutación (ver abajo).**
  - [x] Checks estáticos nuevos en `verificar.py` (R2): sin `glyphs`/`sprite`/`tiles` como claves de estilo, sin `XMLHttpRequest`/`WebSocket`/`EventSource`/`sendBeacon`/`import()`/`new Worker`, sin recursos asignados por código, un solo `fetch(` y solo hacia `datos/`, sin URL absoluta en el JS salvo el enlace de la licencia, sin `@import`/`url()` externos en el CSS, sin scripts/estilos/iframes externos en el HTML. Línea base medida antes de escribirlos: `tiles` es nombre propio del proyecto (tarjetas del panorama), por eso la regla mira la clave `tiles:` y no la palabra.
  - [x] **Prueba por mutación de R2 estática: 23 de 23 violaciones detectadas** por el check esperado (glyphs/sprite/tiles remotos, fetch externo y camuflado con espacios, WebSocket, sendBeacon, import(), imagen por código, URLs absolutas y con `//`, `@import`, `url()` externa, script/hoja/iframe externos). Archivos restaurados idénticos.
  - [x] `verificacion/pruebas_web.mjs` (92 comprobaciones, todas pasan): servidor con la CSP de `vercel.json`; R2 en navegador (ninguna petición fuera del servidor local, ninguna violación de CSP); R1 del hover en las 55 zonas × 2 capas y las 107 atracciones; R1 de cifras con ficha en detalle, popup, panorama, tabla y transporte; la ficha abre con fuente, vigencia, licencia y enlace.
  - [~] Mutación de la suite de navegador (REQ-10.5), **parcial**. Detectadas: hover de zona con cifra, hover de atracción con cifra, cifra sin ficha en el detalle, popup sin botón de ficha, y una petición externa (la ve la comprobación de CSP). **No verificadas por mutación:** panorama sin ficha, transporte sin ficha y popup con cifra sin ficha. En esas pruebas la mutación tumbó el recorrido antes de llegar al check, así que no hubo una prueba justa. Se suspendió a pedido del usuario. Los scripts están en `.tmp-diag/` (`mutar_web.mjs`, `mut_r1.json`), local y fuera de git.
  - Límite conocido: los checks estáticos no pueden ver una URL construida en tiempo de ejecución (`'ht' + 'tps://…'`). Por eso hay tres capas: este análisis, la comprobación de red en navegador y la CSP de Vercel.

- [x] **T11.** Anuncios para lectores de pantalla, teclado y táctil. *Depende de:* T6, T7. *Cubre:* REQ-9.
  - [x] Región `aria-live` (`#anuncio-seleccion`) con «Área seleccionada: …» / «Atracción seleccionada: …». Probado.
  - [x] `Escape` cierra el popup persistente y deselecciona la atracción. Probado. El nombre de zona y las tarjetas son botones reales: Enter probado en la tabla.
  - [ ] **No verificado:** emulación táctil (dispositivo sin hover) en Chrome. El código solo registra los popups de hover con `(hover: hover)`, y el clic abre el detalle y el popup persistente, pero no se ejecutó en un dispositivo o emulación táctil. A 375 px, con puntero normal, sí se comprobó (consola limpia, sin desbordamiento).

## Fase 4 · Validación

- [x] **V1.** Regresión. *Depende de:* T2 a T11. *Cubre:* REQ-11.
  - [x] `python verificacion/verificar.py`: 109 PASS, 0 fallos (antes 89; los 20 nuevos son los checks de R2).
  - [x] Sin errores de consola a 1280 px (suite del navegador, sin excepciones) y a 375 px (claro y oscuro, sin desbordamiento horizontal). Se arregló el 404 de `/favicon.ico` con `<link rel="icon" href="data:,">`.
  - [x] Siguen funcionando: capas precio/edificios (hover en las dos), casilla de atracciones, leyenda y fichas (suite), búsqueda de atracciones y paginación (suite). **Sin probar de forma explícita** tras los cambios: la gráfica de evolución y el selector de edad (no se tocó su código).
  - [~] Peso: `web/` sin `vendor/` creció unos **26 KB** (app.js +17, seleccion.js +4,9, styles.css +4,1), por encima del presupuesto de 20 KB de REQ-11.5. Sin `package.json` ni dependencias.
- [~] **V2.** Revisión de contraste final. Medida en navegador con los colores reales (20 comprobaciones, claro y oscuro) y capturas vistas del anillo de selección, contorno, puntos y etiquetas. **Sin revisar a ojo:** anillo de hover, punto seleccionado con el aro nuevo y filas/tarjetas marcadas en modo claro.

## Fase 5 · Cierre

- [x] **C1.** Specs, `DEVELOPMENT_STATUS.md` y `DEVELOPMENT_LOG.md` actualizados.
- [x] **C2.** Sección breve en `README.md` sobre las pruebas de interfaz.
- [x] **C3.** Servidor local detenido. `.tmp-diag/` se deja: está excluida con `.git/info/exclude` (no se sube) y contiene los scripts de mutación pendientes.
- [x] **C4.** Resumen técnico al usuario con los próximos pasos.

## Problemas conocidos

- Los rellenos `seq-1..3` y `sin-dato` quedan por debajo de 3:1 contra el fondo del mapa (1,23 a 2,91:1). Es propio de la paleta y se mitiga con el contorno fino de T8. No se cambia la paleta.
- Las capturas de Chrome headless en `%TEMP%` salieron en blanco la primera vez por un error de coordenadas del script. Corregido en `.tmp-diag/diag_popup.mjs`.
