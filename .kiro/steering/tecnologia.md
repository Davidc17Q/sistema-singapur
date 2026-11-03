# Tecnología y convenciones

## Stack

- Ingesta y verificación: Python con biblioteca estándar. Sin dependencias ni llaves.
- Web: HTML, CSS y JavaScript sin framework ni paso de compilación. MapLibre GL JS 4.7.1 (BSD-3-Clause), copiado en `web/vendor/`.
- Mapa: sin mapa base. El estilo es `{ version: 8, sources: {}, layers: [] }` y las capas son GeoJSON propio. No hay `glyphs`, así que **no se pueden usar capas `symbol` con `text-field`**.
- Despliegue: Vercel, sitio estático. `vercel.json` publica solo la carpeta `web` (`outputDirectory`), sin build, con cabeceras de seguridad y CSP estricta.
- Entorno del desarrollador: Windows y bash. Node 22 y Chrome están instalados, pero no son parte del producto.

## Convenciones del código existente

- Nombres, comentarios y textos en español. Identificadores sin tildes.
- Todo valor que llega al HTML pasa por `esc()`. No concatenar datos sin escapar.
- Los colores salen de variables CSS (`--seq-1`..`--seq-5`, `--sin-dato`, `--punto`, `--texto`, `--superficie`...), leídas con `css('--variable')` en JavaScript. No escribir colores literales en el JS ni en reglas nuevas.
- Los datos que consume la web viven en `web/datos/` y son una copia exacta de `lago/` (la verifica `verificacion/verificar.py`).
- `app.js` es una IIFE asíncrona. Se amplía por secciones; no se reescribe lo que funciona.

## Pruebas y despliegue

- Puerta de publicación: `python verificacion/verificar.py` (línea base al 2026-11-02: 89 PASS, 0 fallos). Un solo FAIL impide publicar.
- Pruebas de interfaz (herramientas de desarrollo, nunca parte de `web/`):
  - Lógica pura: `node --test` sobre módulos sin DOM. En una terminal normal: `node --test verificacion/`. En la terminal del agente de Kiro el reporter por defecto falla («stdout is not a tty»); allí usar `node --test --test-reporter=tap --test-reporter-destination=.tmp-diag/res.tap <archivo>` y leer el archivo.
  - Comportamiento del navegador: solo lo que no se puede probar de otra forma, con Chrome local controlado por el protocolo DevTools (CDP) y el `WebSocket` y `fetch` incluidos en Node 22.
- **No añadir `package.json` ni `node_modules` en la raíz.** Vercel podría detectar un proyecto Node e intentar instalar o construir. El proyecto no tiene ninguno y debe seguir así.
- Las pruebas viven en `verificacion/`, que no se publica porque Vercel solo sirve `web/`.
- Los scripts de diagnóstico locales van en `.tmp-diag/` (excluida con `.git/info/exclude`) y se borran al cerrar el trabajo.
- Las herramientas de edición de Kiro fallan con archivos fuera del workspace (concatenan rutas absolutas). Mantener todo dentro del workspace.

## Git

- Rama de trabajo actual: `feat/mapa-interactivo`.
- No hacer commits hasta que el usuario lo pida. No `push`, no `reset --hard`, no `--force`.
