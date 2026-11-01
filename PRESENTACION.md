# Presentación en clase

Con el sistema abierto en pantalla y sin diapositivas.

## ¿Qué herramienta descartaron que casi eligen?

**Streamlit.** Con 30 líneas de Python ya tenía mapa, tabla y línea. Lo descartamos por tres razones:
- Para mostrar datos abiertos y fijos pide un servidor y 34 paquetes de terceros.
- Le pedimos que no cargara mapa base y aun así lo cargó.
- La ficha de fuente en cada cifra era pelear con sus componentes.

Muestren: toque una cifra y abra la ficha.

## ¿Qué decidieron no mostrar?

**El precio por bloque, calle y piso.** Muestren la sección «Lo que este sistema no sabe»: con esos datos y el mes, el 92,3 % de las ventas queda sola en su combinación. Con zona, tipo y mes, el 0,6 %.

También quedaron fuera:
- La ubicación de cada edificio.
- Los grupos con menos de 10 ventas.
- Las cámaras de tráfico.

## ¿Qué tendría que cambiar para que la respuesta fuera otra?

- **En la fuente:** si HDB publicara una división por *planning area*, el mapa dejaría de ser un PROXY. Si hubiera movilidad diaria por zona, se podría responder la pregunta del clima.
- **En la herramienta:** si el sistema tuviera que actualizarse solo cada hora o responder consultas, un sitio estático ya no alcanzaría, y Streamlit volvería a competir.
- **En nuestro sistema:** si un comprador necesitara ver su calle, habría que rediseñar la protección para ese caso, tal vez con un mínimo de ventas por calle. Hoy no lo hacemos, porque el costo de señalar un hogar nos pesa más que esa comodidad.

## Si preguntan por el primer tablero

Pedía una clave que estaba en el JavaScript, y mostraba cifras de demostración. Se reemplazó, y el error quedó escrito en la bitácora.
