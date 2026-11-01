#!/usr/bin/env python3
"""Copia a web/datos solo lo publicable: una lista blanca, nunca lago/raw."""
import shutil
import comun

DESTINO = comun.RAIZ / "web" / "datos"
DESTINO.mkdir(parents=True, exist_ok=True)
for viejo in DESTINO.iterdir():
    viejo.unlink()
for nombre in ("zonas.geojson", "atracciones.json", "transporte.json", "vivienda.json", "privacidad.json"):
    shutil.copyfile(comun.LAGO / nombre, DESTINO / nombre)
shutil.copyfile(comun.CATALOGO, DESTINO / "fuentes.json")
print(f"Publicados {len(list(DESTINO.iterdir()))} archivos en web/datos")
