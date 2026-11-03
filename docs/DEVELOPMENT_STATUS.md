# Estado del desarrollo

Actualizado: 2026-11-02 · Rama: `feat/mapa-interactivo` · **Código terminado y sin commitear**: el usuario hará el commit y el push.

Para una sesión nueva: leer primero `.kiro/steering/continuidad.md` y luego este archivo.

## Objetivo actual

Mapa interactivo con popups legibles, orientación, selección compartida entre el mapa, la tabla de zonas y la lista de atracciones, y las restricciones duras R1 y R2 aplicadas en la lógica. Spec: `.kiro/specs/mapa-interactivo/`. **Implementación completa. Falta probarlo desplegado en Vercel.**

## Estado por fase

| Fase | Estado |
|---|---|
| 1. Diagnóstico | Completa |
| 2. Planificación | Completa |
| 3. Implementación | Completa (T2 a T11) |
| 4. Validación | Completa salvo lo listado en «Pruebas no hechas» |
| 5. Cierre | Documentación al día; falta el commit, el push y la prueba en Vercel |

## Funcionalidades completadas

- **Popups legibles** en claro y oscuro (19,17:1 y 15,15:1). Causa raíz: `maplibre-gl.css` fija `background:#fff` sin `color`.
- **Hover de zona sin cifras** (R1): solo nombre, aviso fijo y «Clic para ver el detalle». Sin parpadeo al cruzar zonas.
- **Selección compartida** (`web/seleccion.js`, patrón Observer): zona o atracción, con cinco suscriptores (detalle, tabla, lista, mapa, anuncio).
- **Tabla de zonas ↔ mapa**: un *town* con varias áreas resalta todas (CENTRAL AREA → 3); las 26 áreas sin fila se explican; el nombre de zona es un botón (teclado).
- **Lista de atracciones ↔ mapa**: tarjeta marcada, «Ver en el mapa», «Ver en la lista», limpia la búsqueda y amplía la página si hace falta.
- **Atracciones en el mapa**: hover (solo nombre), popup persistente con ficha F02, lista para elegir cuando hay puntos superpuestos (Esplanade).
- **Estados visuales**: anillo doble de hover y selección, contorno fino por zona, aro en los puntos. Paleta intacta.
- **Etiquetas de zona** (marcadores HTML) con colocación voraz y sin tapar puntos.
- **R2 en tres capas**: 20 checks nuevos en `verificar.py`, comprobación de red en el navegador y la CSP de Vercel.
- Favicon en línea (`data:,`): quita el 404 de `/favicon.ico`.

## En desarrollo

Nada.

## Pruebas realizadas (al cerrar la sesión)

| Prueba | Resultado |
|---|---|
| `python verificacion/verificar.py` | 109 PASS, 0 fallos |
| `node --test` sobre `seleccion.js` | 27 de 27; además 8 de 8 mutaciones detectadas |
| `verificacion/pruebas_web.mjs` (Chrome 156, con la CSP de `vercel.json`) | 92 de 92 |
| Móvil a 375 px, claro y oscuro | Consola limpia, sin desbordamiento, sin peticiones externas (12 de 12) |
| R2 estático por mutación | 23 de 23 violaciones detectadas |

Cómo ejecutarlas: `python verificacion/verificar.py`; `node --test verificacion/`; `node verificacion/pruebas_web.mjs`. **En la terminal del agente de Kiro** Node falla si su salida no va directo a la terminal («stdout is not a tty»): no usar tuberías ni redirecciones; para la suite del navegador, `PRUEBAS_RESUMEN=<archivo> node verificacion/pruebas_web.mjs` y leer el archivo.

## Pruebas no hechas (deuda de verificación)

- **Mutación de la suite de navegador, parcial.** Verificadas: hover de zona con cifra, hover de atracción con cifra, detalle sin ficha, popup sin ficha, petición externa. **Sin una prueba justa:** panorama sin ficha, transporte sin ficha, popup con cifra sin ficha (la mutación tumbó el recorrido antes del check). Scripts en `.tmp-diag/` (local, fuera de git).
- **Emulación táctil** (dispositivo sin hover): no se ejecutó.
- **A ojo:** anillo de hover, punto seleccionado con el aro nuevo, y filas/tarjetas marcadas en modo claro. Colores y contrastes sí están medidos.
- **Gráfica de evolución y selector de edad:** no se tocaron y no se probaron de forma explícita tras los cambios.
- **No se ha probado en Vercel ni en un teléfono físico.**

## Problemas conocidos

| Problema | Detalle |
|---|---|
| Presupuesto de peso superado | `web/` (sin `vendor/`) creció ~26 KB frente a los 20 KB de REQ-11.5 |
| Los checks estáticos de R2 no ven URLs construidas en tiempo de ejecución | Por eso hay tres capas (estático, navegador, CSP) |
| Rellenos claros de la paleta bajo 3:1 contra el fondo (1,23 a 2,91:1) | Mitigado con el contorno fino; paleta intacta por decisión del usuario |
| A escala inicial las zonas pequeñas del centro no tienen etiqueta | Es el comportamiento pedido: la ganan al acercar |
| Con puntos solapados el hover muestra el nombre del de arriba | Cumple R1 (solo un nombre real); el clic abre la lista para elegir |
| Repositorio anterior del grupo sigue público con crudos y clave | Ya documentado en el README; fuera de este alcance |

## Decisiones técnicas importantes

Detalle y alternativas en `design.md` y en la bitácora.

- **R1:** el hover no lleva cifras; la plantilla solo recibe un nombre y la clave de un aviso fijo. Las cifras viven en el detalle con su ficha.
- **R2:** tres capas sin excepciones. Las reglas estáticas apuntan a lo que carga cosas (claves `glyphs:`/`tiles:`, `fetch(` no relativo), no a palabras sueltas: `tiles` es el nombre de las tarjetas del panorama.
- **Selección:** store único; los componentes solo escriben y leen. Cambiar la selección dentro de un suscriptor lanza error (evita bucles).
- **Superpuestas:** `queryRenderedFeatures` con ±8 px y popup con lista. No se desplazan puntos.
- **Etiquetas:** marcadores HTML con fondo sólido; una capa de texto exigiría `glyphs` remotos (R2).
- **Desvío del requisito original (3.6 y 5.2):** elegir en el mapa no desplaza la página a la tabla ni a la lista (el usuario acaba de hacer clic en el mapa); se resalta y el popup ofrece «Ver en la lista». Elegir desde la tabla o la lista sí lleva al mapa.
- **Pruebas y Vercel:** Node + Chrome solo como herramienta de desarrollo en `verificacion/`. No hay `package.json`. Vercel publica solo `web/`.

## Próximos pasos concretos

1. Revisar `git diff` y hacer commit en `feat/mapa-interactivo`.
2. Push y revisar el despliegue de vista previa de Vercel.
3. En la vista previa: abrirla en un teléfono real, comprobar los popups en modo oscuro, elegir una atracción en la lista y en el mapa, y abrir la consola del navegador (debe estar vacía).
4. Si algo falla en Vercel pero no en local, lo primero que hay que mirar son las violaciones de CSP en la consola.
5. Opcional: terminar la mutación de la suite de navegador y probar con emulación táctil.
