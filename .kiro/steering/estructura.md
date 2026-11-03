# Estructura del repositorio

```
ingesta/       pull_1..pull_5: bajan, limpian, agregan; escriben lago/ y copian a web/datos
catalogo/      fuentes.json (10 fuentes), diccionario.json, towns_a_zonas.json, bitacora_ia.json
lago/          datos procesados (lago/raw queda fuera del repo)
verificacion/  verificar.py: puerta de calidad
web/           sitio estático: index.html, app.js, styles.css, datos/, vendor/
exploracion/   pruebas descartadas (Streamlit, DuckDB). No se despliega
entrega/       Excel del diccionario de datos
docs/          bitácora y estado del desarrollo (ver continuidad.md)
.kiro/         steering y specs
```

## Flujo de datos

`data.gov.sg` → `lago/raw` (local) → `ingesta/pull_N.py` → `lago/*.json` → `pull_5_publicar.py` (lista blanca) → `web/datos/` → `web/app.js`.

`verificar.py` comprueba que `web/datos` sea idéntico a `lago`, que todo campo esté en el diccionario y que ninguna cifra carezca de fuente, unidad o vigencia.

## Mapa de `web/app.js`

Secciones en orden: carga de datos → ficha de procedencia (`cifra`, `deCifra`, `abrirFicha`) → portada → panorama → tabla de zonas → mapa → evolución → atracciones → transporte → «lo que no sabe» → fuentes.

Piezas que importan para el mapa:

| Pieza | Qué es |
|---|---|
| `registro[]`, `cifra()` | Registro de procedencia. Un clic global sobre `[data-f]` abre el `<dialog id="ficha">`. |
| `townPorZona` | Mapa área → fila de `viv.towns`. Una fila de town puede cubrir varias áreas. |
| `seleccionada` | Zona seleccionada (una sola; no existe estado de atracción). |
| `mostrarDetalle(zona)` | Rellena `#detalle` y resalta el borde con el filtro de la capa `zonas-sel`. |
| Capas MapLibre | `zonas` (relleno), `bordes`, `zonas-sel`, `puntos` (atracciones). |
| `#tabla-zonas` | Tabla de zonas con precio; filas `tr[data-zona]`. |
| `#lista-atracciones` | Lista de tarjetas paginada (12 visibles) y filtrable; se reconstruye con `innerHTML`. |

## Datos que condicionan el diseño del mapa

- 55 áreas en el mapa; 29 tienen precio (26 *towns*, 2 asignados a mano); 26 no tienen fila en la tabla.
- 107 atracciones con nombre único; 2 sin área (fuera del límite terrestre); 26 áreas con atracciones.
- Varias atracciones comparten coordenadas o quedan a menos de 14 px en el encuadre inicial.
