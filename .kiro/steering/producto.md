# Producto: Singapur · sistema de información

Fuente de verdad del producto: `README.md`. Este archivo resume lo que condiciona cualquier cambio.

## Para quién y qué pregunta

- Usuario único: quien evalúa comprar o invertir en un apartamento de vivienda pública (HDB).
- Preguntas respondidas: (1) distribución y precios de la vivienda pública, fuentes F05 y F06; (2) principales atracciones y su ubicación, fuente F02.
- Preguntas pendientes, y declaradas así dentro del sistema: transporte y taxis frente a flujo de personas, y clima frente a movilidad y turismo.
- Idioma de la interfaz y de los textos: español. Nombres de lugares y descripciones de la fuente F02 van en inglés (`lang="en"`).
- Nombres del grupo, tal como están en el README. No añadir tildes que el grupo no usa.

## Restricciones duras (confirmadas por el usuario el 2026-11-02)

No hay excepciones, banderas ni rutas alternativas que las salten. Deben cumplirse en la lógica, no solo en la interfaz.

- **R1. Toda cifra visible tiene su ficha de procedencia a un clic.** La ficha muestra fuente, entidad, vigencia, día de prueba, licencia y enlace. Toda cifra se renderiza con `cifra()` o `deCifra()` en `web/app.js`. Una ventana que aparece solo al pasar el mouse no se puede tocar, así que **no puede contener cifras**: solo nombres y texto.
- **R2. Sin terceros.** Sin mapa base, sin tiles, sin fuentes tipográficas remotas (`glyphs`), sin llaves, sin scripts, estilos, imágenes ni peticiones a otro dominio. La CSP de `vercel.json` es `default-src 'self'`.

## Protección de datos (decisión del grupo, no una norma)

- Solo agregados. Nunca bloque, calle, piso, código postal ni ubicación de edificios.
- Ninguna mediana con menos de 10 ventas.
- `lago/raw` nunca llega al repositorio ni al despliegue.
- Las áreas sin reventas HDB se muestran como «sin datos», nunca como «baratas».

## PROXY

Las ventas vienen por *town* de HDB (26) y el mapa por *planning area* (55). No son la misma división. Se pinta por nombre igual y, a mano, `CENTRAL AREA` (Downtown Core, Outram, Rochor) y `KALLANG/WHAMPOA` (Kallang, Novena). El aviso PROXY debe seguir visible en el mapa, la tabla y cada ficha afectada.

## Accesibilidad

- Referencia: WCAG 2.2. Texto normal 4,5:1, texto grande 3:1, componentes e indicadores 3:1.
- La paleta actual (variables CSS en `web/styles.css`, modo claro y oscuro) se considera adecuada. No cambiar colores sin identificar primero el defecto concreto.
- Un estado (seleccionado, activo) no debe depender solo del color.
