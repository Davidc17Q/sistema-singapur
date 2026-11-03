# Requisitos: mapa interactivo

Estado: aprobado por el usuario el 2026-11-02 (respuestas Q1 a Q6 de la Fase 1).
Contexto y evidencia: `docs/DEVELOPMENT_LOG.md`, entrada del diagnóstico.

## Definiciones

- **Cifra:** valor calculado o agregado a partir de las fuentes: conteos, medianas, porcentajes, precios, variaciones. Debe mostrarse con `cifra()` o `deCifra()`. Los atributos textuales de una fuente (nombre, dirección, descripción) no son cifras, aunque contengan dígitos.
- **Ventana efímera:** elemento que aparece solo al pasar el mouse y desaparece al salir. No se puede tocar ni activar, por lo que no puede contener cifras.
- **Selección:** la zona o la atracción que el usuario eligió. Es única y compartida por el mapa, la tabla de zonas, la lista de atracciones y el panel de detalle.
- **Origen:** el componente donde el usuario hizo la elección (`mapa`, `tabla`, `lista`).

## REQ-1 · Legibilidad de los popups

Como usuario en modo claro u oscuro, quiero leer el contenido de todo popup.

- 1.1 El texto de cualquier popup tiene contraste de al menos 4,5:1 contra su fondo, en modo claro y oscuro.
- 1.2 El fondo y el texto del popup usan las variables de tema existentes (`--superficie`, `--texto`, `--texto-2`). No se introducen colores nuevos.
- 1.3 La punta del popup (`.maplibregl-popup-tip`) tiene el mismo color que el fondo del popup.
- 1.4 El contraste se mide sobre estilos calculados en un navegador real, no solo por lectura del CSS.
- 1.5 Si el usuario cambia el esquema de color con la página abierta, el popup se actualiza sin recargar.

## REQ-2 · Popup al pasar el mouse sobre una zona

- 2.1 Al pasar el mouse sobre un polígono aparece un popup con el nombre de la zona, en el formato de título que usa el resto de la interfaz.
- 2.2 El popup indica en texto si la zona no tiene reventas HDB («sin reventas HDB»). No dice «barata».
- 2.3 El popup incluye una pista de interacción fija («Clic para ver el detalle»).
- 2.4 **R1:** el popup no contiene ninguna cifra: ni precio, ni conteo, ni porcentaje. Esas cifras se ven en el panel de detalle, con su ficha.
- 2.5 El popup sigue al cursor sin parpadear al cruzar de un polígono a otro, y desaparece al salir del mapa.
- 2.6 Si hay una atracción bajo el cursor, solo aparece el popup de la atracción (prioridad de capas).

## REQ-3 · Selección de zona sincronizada

- 3.1 Clic en un polígono: selecciona la zona, resalta su borde, abre el panel de detalle y resalta la fila de la tabla que le corresponde.
- 3.2 Clic o Enter/Espacio en una fila de la tabla: selecciona la zona, resalta su borde en el mapa y abre el panel de detalle.
- 3.3 Si el *town* cubre varias áreas (`CENTRAL AREA`, `KALLANG/WHAMPOA`), el mapa resalta **todas** las áreas del town. La zona elegida en el mapa sigue siendo la que se muestra en el título del detalle.
- 3.4 Clic en un área sin fila en la tabla (26 de 55): se selecciona y se muestra el detalle con el aviso «sin reventas HDB en el lago». Ninguna fila queda resaltada y no se produce ningún error.
- 3.5 Cuando la selección cambia, la selección anterior deja de estar resaltada en todos los componentes.
- 3.6 Si la elección empieza en la tabla o en la lista, la página se desplaza al mapa. Si empieza en el mapa, la página **no** se desplaza (la tabla queda fuera de pantalla y el usuario acaba de hacer clic en el mapa); la fila queda marcada.
- 3.7 El estado resaltado de la fila se mantiene si la tabla se vuelve a dibujar.

## REQ-4 · Atracciones en el mapa

- 4.1 Con la capa de atracciones activa, pasar el mouse sobre un punto muestra un popup con el nombre de la atracción y el cursor cambia a puntero.
- 4.2 Clic en un punto selecciona la atracción y abre un popup persistente con: nombre, área, dirección (si existe), descripción corta (si existe) y el botón de ficha «Fuente F02».
- 4.3 El popup persistente se cierra con un botón de cerrar, con Escape o al elegir otra selección.
- 4.4 Una atracción sin área se muestra con «Fuera del límite terrestre», igual que en la lista.
- 4.5 **R1:** el popup de hover de una atracción contiene únicamente su nombre.

## REQ-5 · Sincronización bidireccional lista ↔ mapa de atracciones

- 5.1 Elegir una atracción en la lista (clic, Enter o Espacio) resalta su punto en el mapa, activa la capa de atracciones si estaba apagada y centra suavemente el mapa sobre ella.
- 5.2 Elegir una atracción en el mapa marca su tarjeta en la lista, sin desplazar la página. El popup de la atracción incluye un botón «Ver en la lista» que lleva la tarjeta a la vista y le da el foco.
- 5.3 Si la tarjeta no está en la lista porque la búsqueda la filtra, se limpia la búsqueda. Si queda fuera de la página visible, se amplía la página hasta incluirla.
- 5.4 La tarjeta y el punto muestran el mismo estado de selección, y no puede haber dos atracciones seleccionadas a la vez.
- 5.5 Filtrar la lista no cambia la selección. Si la atracción seleccionada queda fuera del filtro, el punto sigue resaltado en el mapa.
- 5.6 Elegir una atracción actualiza también la zona seleccionada, a la zona donde cae (si tiene).

## REQ-6 · Puntos superpuestos

- 6.1 Si un clic cae sobre varios puntos (a menos de 14 px o con coordenadas idénticas), el popup lista todas las atracciones del lugar para elegir una. No se desplazan los puntos.
- 6.2 Elegir una de ellas la selecciona con el mismo comportamiento que REQ-4 y REQ-5.
- 6.3 Con coordenadas idénticas, ninguna atracción queda inaccesible.

## REQ-7 · Orientación

- 7.1 El mapa muestra el nombre de las áreas sin necesidad de pasar el mouse, mediante marcadores HTML.
- 7.2 A la escala inicial se muestran solo las áreas con espacio suficiente. Al acercar se muestran más. Ningún texto queda tapado por otro.
- 7.3 Las etiquetas respetan el tema, tienen contraste de al menos 4,5:1 sobre su fondo y no capturan clics (el clic llega al polígono).
- 7.4 Al seleccionar una zona o atracción desde la tabla o la lista, el mapa se centra en ella con animación suave. Con `prefers-reduced-motion`, sin animación.
- 7.5 Los marcadores no añaden peticiones de red ni archivos (R2).

## REQ-8 · Estados visuales y contraste

- 8.1 Los estados normal, hover, seleccionado, activo y foco son distinguibles entre sí y no dependen solo del color.
- 8.2 El borde de selección tiene contraste de al menos 3:1 contra cualquier relleno de la escala (`--seq-1..5`, `--sin-dato`), en modo claro y oscuro.
- 8.3 El punto de atracción seleccionado se distingue del no seleccionado por tamaño o forma, además de por color, con contraste de al menos 3:1.
- 8.4 El punto de atracción normal tiene contraste de al menos 3:1 contra cualquier relleno sobre el que pueda caer.
- 8.5 Cada zona tiene un contorno fino con contraste de al menos 3:1 contra el fondo del mapa, usando una variable existente. No cambia ningún color de relleno ni de la paleta.
- 8.6 Los elementos interactivos nuevos tienen un indicador de foco visible de al menos 3:1.
- 8.7 Los textos nuevos cumplen 4,5:1 (3:1 si son grandes).

## REQ-9 · Teclado y dispositivos táctiles

- 9.1 Toda acción disponible con mouse tiene equivalente con teclado: filas de la tabla, tarjetas de la lista, botones de los popups.
- 9.2 En dispositivos sin hover no existen los popups de hover. El clic o toque abre el detalle y, para atracciones, el popup persistente.
- 9.3 Los cambios de selección se anuncian a lectores de pantalla en una región `aria-live`.
- 9.4 Se respeta `prefers-reduced-motion`.

## REQ-10 · Restricciones duras

- 10.1 **R1 en la lógica:** una prueba automatizada recorre las 55 zonas y las 107 atracciones y falla si algún popup de hover contiene algo distinto de su nombre y del texto fijo definido.
- 10.2 **R1:** una prueba automatizada falla si una cifra del panel de detalle o del popup persistente aparece fuera de un elemento `.cifra`.
- 10.3 **R2 en el navegador:** una prueba falla ante cualquier petición a un origen distinto del servidor local.
- 10.4 **R2 en la puerta de publicación:** `verificar.py` falla si `app.js`, `seleccion.js` o `styles.css` contienen `glyphs`, `sprite`, `tiles`, `fetch(`, `import(`, `@import` o `url(` con un origen absoluto `http(s)://` o `//`. Los enlaces `<a href>` externos permitidos (licencia, repositorio, fuentes) quedan fuera de la regla.
- 10.5 Cada verificación se comprueba rompiéndola a propósito y confirmando el FAIL, y se registra el resultado.
- 10.6 No existe bandera, parámetro ni ruta alternativa que desactive R1 o R2.

## REQ-11 · No regresión

- 11.1 `python verificacion/verificar.py` termina con 0 fallos.
- 11.2 La página no produce errores de consola a 375 px y a 1280 px.
- 11.3 Siguen funcionando: el cambio de capa precio/edificios, la casilla de atracciones, la leyenda, las fichas de procedencia, la gráfica de evolución, el selector de edad y la búsqueda de atracciones.
- 11.4 Se mantiene la paleta de colores existente.
- 11.5 No se añade `package.json`, `node_modules` ni ninguna dependencia a `web/`. El peso total de `web/` no aumenta más de 20 KB, sin contar `vendor/`. *(Resultado: aumentó unos 26 KB, por encima del presupuesto. No se recortó: es el costo de las funciones pedidas.)*

## Fuera de alcance

- Capa de variación anual.
- Mapa base, clusters con contador de MapLibre y fuentes tipográficas propias.
- Cambios en la ingesta, el lago, el diccionario o las fuentes.
- Cambios de la paleta. Los rellenos `seq-1..3` y `sin-dato` quedan por debajo de 3:1 contra el fondo; se mitiga con el contorno de 8.5 y se documenta como problema conocido.
