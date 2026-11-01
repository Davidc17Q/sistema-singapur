# Singapur · sistema de información

**Grupo:** Miguel Angel Garcia Osorio · Juan Ignacio Lotero Franco · David Quintero Gallego
**Enlace:** <URL_SISTEMA> · **Revisado:** 2026-11-01

Taller de datos, Gestión y gobierno de datos, EAFIT. Reemplaza al primer tablero del grupo ([tablero-interactivo-singapur](https://github.com/miguelangel17z/tablero-interactivo-singapur)), que no cumplía: mostraba cifras de demostración, comparaba la clave en el navegador y tenía los crudos en un repositorio público.

## Para quién y qué pregunta

- **Usuario:** quien evalúa comprar o invertir en un apartamento de vivienda pública (HDB). En la entrega 1 nombramos a turistas, ciudadanos, inversionistas y urbanistas; un sistema para todos no decide qué va primero, así que escogimos uno.
- **Preguntas respondidas:**
  1. ¿Cómo se distribuye la vivienda pública y cómo varían sus precios? (F05, F06)
  2. ¿Cuáles son las principales atracciones y dónde se ubican? (F02)
- **Preguntas pendientes, y dichas dentro del sistema:**
  3. ¿Cómo se relacionan el transporte y los taxis con el flujo de personas y la oferta inmobiliaria? F03 es nacional y de 2015, y F07 es una foto de un instante.
  4. ¿Cómo influye el clima en la movilidad y el turismo? Hay lluvia (F09), pero no encontramos una medida abierta y diaria de movilidad o turismo por zona.
- **Escala y comparación:** 26 zonas de HDB pintadas sobre las 55 áreas de planificación. Cada zona se compara con las demás, y con ella misma doce meses antes.
- **Lo que decidimos no mostrar, y por qué:**
  - Precios por bloque, calle o piso: con esos datos y el mes, el 92,3 % de las ventas queda sola en su combinación. Con zona, tipo y mes, el 0,6 %.
  - Ubicación y código postal de cada edificio: solo publicamos cuántos hay por área.
  - Medianas con menos de 10 ventas.
  - Imágenes de cámaras de tráfico (F08): pueden mostrar placas o personas, y ninguna pregunta las necesita.

## La réplica

- **Igual que Lima:** carpetas `ingesta/`, `catalogo/`, `lago/`, `verificacion/`, `web/`. Python con biblioteca estándar, JSON con la forma del contrato, HTML y JavaScript sin framework, MapLibre.
- **Diferente:** sin compuerta, porque aquí todo lo publicado es abierto y agregado. Una clave sería teatro. Tampoco hay gemelo 3D ni tantas secciones: 5 fuentes integradas contra 94.
- **Fuentes catalogadas · integradas · candidatas · descartadas:** 10 · 5 · 3 · 2 (ver [catalogo/fuentes.json](catalogo/fuentes.json)).
- **Huecos:** viajes o movilidad diaria por zona; precios de vivienda privada; datos de turismo por zona. Las atracciones llevan sin editarse desde 2018 y se marcan como dato viejo.
- **PROXY:** las ventas vienen por *town* de HDB y el mapa por *planning area*. No son la misma división. Se pintan por nombre igual, y a mano Central Area (Downtown Core, Outram, Rochor) y Kallang/Whampoa (Kallang, Novena). Se avisa en el mapa, en la tabla y en cada ficha.

## Reconstruir el lago

Sin llaves ni dependencias. Baja los crudos a `lago/raw` (fuera del repositorio) y escribe el lago y `web/datos`:

```bash
for s in ingesta/pull_*.py; do python "$s"; done
python verificacion/verificar.py
```

La verificación termina con error si falta una fuente, unidad o vigencia, si aparece un dato de hogar o persona, si una mediana tiene menos de 10 ventas, si los totales no cuadran, si el diccionario y el lago no dicen lo mismo, o si `web/datos` difiere del lago. La probamos rompiendo una copia a propósito: una cifra sin fuente, un campo `bloque`, un texto con teléfono y correo, un grupo de 3 ventas, una mediana absurda y una atracción fuera del país. Dio 10 FAIL y salió con error.

## ¿Se puede usar?

| Fuente | Licencia | Personas | Estado | Condición |
|---|---|---|---|---|
| F02 Tourist Attractions | Singapore Open Data Licence version 1.0 | No | Integrada | Aviso visible con enlace. Dato de 2018 marcado |
| F03 Transporte al trabajo | Singapore Open Data Licence version 1.0 | Solo conteos nacionales | Integrada | Aviso visible. Encuesta de 2015 marcada |
| F05 HDB Existing Building | Singapore Open Data Licence version 1.0 | No, pero ubica cada edificio | Integrada | Solo conteo por área |
| F06 Resale flat prices | Singapore Open Data Licence version 1.0 | Sin nombres; determinable con bloque, calle y piso | Integrada | Solo medianas por zona, mínimo 10 ventas |
| F10 Planning Area Boundary | Singapore Open Data Licence version 1.0 | No | Integrada | Aviso visible. Límite indicativo |
| F07 Taxi Availability | Singapore Open Data Licence version 1.0 | No | Candidata | Haría falta acumular lecturas |
| F08 Traffic Images | Singapore Open Data Licence version 1.0 | Sin revisar: fotos de vías | Candidata | No se publica |
| F09 Rainfall | Singapore Open Data Licence version 1.0 | No | Candidata | Falta con qué cruzarla |
| F01 Waste Management (Kaggle) | CC0 1.0 Universal | No | Descartada | Espejo de un tercero, sin actualizar |
| F04 Singapore Airbnb (Kaggle) | no declara | Personas identificables | Descartada | Sin licencia y con anfitriones |

La licencia pide un aviso visible con enlace, y prohíbe sugerir respaldo oficial: los dos avisos están en la sección Fuentes de la página. La ley de datos personales de Singapur es la PDPA; esto es el criterio del taller, no una asesoría jurídica.

## Bitácora de exploración

Probadas con los mismos datos del lago, en esta máquina, el 2026-11-01.

| Tramo | Herramienta | Qué pidió para empezar | Licencia | Dónde quedan los datos | ¿Se rehace con un comando? | Estado del proyecto | Qué resolvió | Qué no pudo | ¿Quedó? ¿Por qué? |
|---|---|---|---|---|---|---|---|---|---|
| Vistas | **HTML + MapLibre GL JS 4.7.1** | Un archivo JS y uno CSS, copiados al repositorio. Sin instalación ni cuenta | BSD-3-Clause | En `web/datos`, públicos y descargables. Es lo que decidimos publicar | Sí, es un sitio estático | Activo | Mapa sin mapa base, toda cifra con ficha a un clic, 1,1 MB en total, abre en teléfono | Hay que escribirlo todo a mano, sin componentes listos | **Quedó.** Muestra lo que necesitamos, no trae terceros y no carga nada de otro dominio |
| Vistas | **Streamlit 1.66.1 + pydeck 0.9.3** | Python, entorno virtual y 34 paquetes. En Windows la instalación falló con una ruta larga y hubo que repetirla en una ruta corta | Apache-2.0 | En el repositorio y en la aplicación. Publicar pide Community Cloud y cuenta de GitHub (**no lo publicamos**; lo dice la lámina «La herramienta») | Sí, con `streamlit run` | Activo | En 30 líneas: mapa, tabla ordenable y línea. Abrió sin desbordarse a 400 px | Ficha de procedencia por cifra sin pelear con los componentes. Cargó un mapa base externo aunque le pedimos que no. Los colores por transparencia casi no distinguían zonas | **Casi queda.** Es mucho más rápido, pero es un servidor y 34 terceros para mostrar datos abiertos y fijos |
| Ingesta | **Python, biblioteca estándar** | Python | PSF | `lago/` | Sí | Activo | Baja, limpia, agrega y escribe el lago | Es más lento que un motor de consultas | **Quedó.** Sin dependencias |
| Ingesta | **DuckDB 2.0.0** | `pip install duckdb` en un entorno aparte | No lo declara el paquete: revisar el sitio del proyecto | En la máquina, sobre `lago/raw` | Sí, `exploracion/cruce_duckdb.py` | Activo | La misma mediana con SQL en una línea. Sirvió de cruce: 26 zonas, 0 diferencias | No hace falta para publicar | **Como comprobación**, no en la ingesta |

No probamos Datawrapper, Power BI ni Data Studio porque piden cuenta. kepler.gl tampoco se probó. La prueba de Streamlit está en [exploracion/streamlit/app.py](exploracion/streamlit/app.py). La guía pide dos herramientas también en los demás tramos: aquí están las de vistas e ingesta, y **faltan los tramos de verificación y protección**.

## Protección

- **Nivel:** abierto, solo agregados.
- **Qué protegemos, y de quién:** el vínculo entre un apartamento concreto y su precio. Su público es cualquiera que quiera perfilar edificios por capacidad de pago, presionar a sus dueños o estigmatizar direcciones. La fuente original sigue siendo pública: no la ocultamos, pero nuestro sistema no le facilita el cruce con la geometría.
- **Pruebas de terminal:** ver abajo. Que se pueda bajar todo es correcto, porque todo es abierto; lo que se comprueba es que los crudos no estén.
- **Revisión de secretos en el historial:** ver abajo.

```bash
curl -s -o /dev/null -w "%{http_code}\n" <URL_SISTEMA>/lago/raw/reventa_hdb.csv   # 404
curl -s -o /dev/null -w "%{http_code}\n" <URL_SISTEMA>/raw/reventa_hdb.csv        # 404
curl -s <URL_SISTEMA>/datos/vivienda.json | grep -c -i -E "block|street|storey"   # 0
git log -p | grep -n -i -E "clave *=|secret|password|api_key|token"               # solo documentación
```

<RESULTADO_PRUEBAS>

**Queda pendiente del grupo:** el repositorio anterior sigue público, con la clave en el código y los crudos en el historial. Lo que protege el sistema nuevo no alcanza al viejo.

## Herramienta elegida para las vistas

- **Qué necesitábamos mostrar:** un mapa por zona y cifras con su fuente a un clic, en un teléfono.
- **Qué teníamos que proteger:** nada detrás de una puerta; solo que los crudos no se publiquen.
- **Por qué esta herramienta cumple las dos cosas, y cuál descartamos por poco:** un sitio estático con MapLibre publica exactamente la lista blanca de `web/datos`, sin servidor ni terceros. Casi elegimos Streamlit, porque se hace en una fracción del tiempo.

## Nuestra posición

### Datos · «Público no es inocuo»

¿Qué columnas de su lago señalan a una persona? `block`, `street_name`, `storey_range` y `month` de F06. Ninguna nombra a nadie, y todas son públicas. Juntas, dejan sola al 92,3 % de las ventas: quien conozca el edificio y el piso de alguien lee cuánto pagó. Por eso exigimos 10 ventas por grupo: con menos, un grupo por zona y tipo se acerca a un apartamento concreto; es una regla nuestra, no una norma. Lo incómodo es que no cerramos nada: HDB publica ese archivo. Lo que decidimos es no ser el sistema que lo cruza con el mapa de los edificios. Y hay costo: alguien que compra quisiera ver su calle, y aquí no puede.

### Seguridad · «Parecer protegido no es estar protegido»

Nuestro primer tablero pedía una clave y parecía protegido. Bajamos el JavaScript publicado y la clave estaba ahí, y además en el README. Peor: protegía cifras de demostración, mientras los datos reales con bloque y piso estaban en un repositorio público. Teníamos la apariencia exactamente al revés de lo que había que cuidar. El sistema nuevo no tiene puerta: todo lo publicado se puede bajar, y lo que importa es que lo delicado no esté. La verificación lo comprueba, en vez de confiar en que alguien se acuerde.

## Bitácora de IA

| Tramo | Herramienta | Qué le encargamos | Qué entregó | Qué le corregimos |
|---|---|---|---|---|
| Rastreo | Gemini | Fuentes abiertas para Singapur | data.gov.sg, Kaggle y descripciones | Se validaron las respuestas y se contrastaron los resúmenes con la metadata |
| Rastreo | Gemini | Conjuntos sobre alquileres | Conjuntos de Kaggle sin licencia reutilizable | Descartados tras leer los términos (F04) |
| Rastreo | Claude | APIs de clima | API de lluvia | Responde, pero no basta para la pregunta: queda como candidata (F09) |
| Revisión | Claude Code | Revisar la entrega 1 contra el enunciado | Cifras de demostración, clave en el JavaScript, crudos públicos | Se confirmó con grep y con la API de GitHub |
| Rastreo | Claude Code | Comprobar las fuentes | Supuso una ruta y obtuvo 404 en tres fuentes | La fuente no estaba caída: la ruta correcta es poll-download |
| Ingesta | Claude Code | Scripts con la forma del contrato | Cinco scripts | Medianas cruzadas con DuckDB: 0 diferencias |
| Catálogo | Claude Code | Corregir el diccionario | F02 sin HTML y con datos hasta 2018; F07 y F08 sin llave | Se comprobó en los archivos y con las API |
| Exploración | Claude Code | Streamlit sin mapa base | `map_style=None` | Aun así cargó un mapa base externo: se vio en el navegador |
| Vistas | Claude Code | Página para teléfono | Mapa demasiado alto | Se probó a 400 px y se ajustó |
| Vistas | Claude Code | Nombres del grupo | Agregó tildes que el grupo no usa | Se copiaron del Word |

El mismo registro está en el Excel y en [catalogo/bitacora_ia.json](catalogo/bitacora_ia.json). Claude Code escribió buena parte de este repositorio, incluido este README. Permisos que tuvo: leer y escribir archivos en esta máquina y correr comandos; no tuvo llaves de datos porque ninguna fuente las pide.

## Revisión cruzada

**No se hizo.** La guía del taller pide dos revisiones entre grupos, y el enunciado de la entrega no las menciona. No hay resultados que reportar.

- Tres cifras auditadas por otro grupo: pendiente
- Ataque de otro grupo: pendiente
- Vueltas atrás en la ruta:
  - De las vistas al contrato: el tablero necesitaba cifras que no estaban en el lago, así que se reescribió la ingesta.
  - De la verificación al catálogo: F07 y F09 decían estar integradas sin alimentar nada, y volvieron a candidatas.
  - Del Excel al lago: el resumen solo cuenta 40 campos, lo que obligó a quitar del lago cifras que ninguna vista usaba.

## Presentación en clase

Guía corta en [PRESENTACION.md](PRESENTACION.md).
