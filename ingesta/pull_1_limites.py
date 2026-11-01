#!/usr/bin/env python3
"""Ingesta F10 · límites de las áreas de planificación. Escribe lago/zonas.geojson (simplificado, WGS84)."""
import json
import comun


def distancia(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    if dx == dy == 0:
        return ((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2) ** 0.5
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return ((p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2) ** 0.5


def simplificar(puntos, tol):
    """Douglas-Peucker iterativo."""
    guardar = {0, len(puntos) - 1}
    pila = [(0, len(puntos) - 1)]
    while pila:
        i, j = pila.pop()
        mayor, indice = 0, None
        for k in range(i + 1, j):
            d = distancia(puntos[k], puntos[i], puntos[j])
            if d > mayor:
                mayor, indice = d, k
        if indice is not None and mayor > tol:
            guardar.add(indice)
            pila += [(i, indice), (indice, j)]
    return [[round(puntos[k][0], 5), round(puntos[k][1], 5)] for k in sorted(guardar)]


def anillo(a):
    # Un anillo cerrado se parte en dos tramos para que el primer y el último punto no colapsen
    medio = len(a) // 2
    s = simplificar(a[: medio + 1], 0.0002)[:-1] + simplificar(a[medio:], 0.0002)
    return s if len(s) >= 4 else None


cruda = json.loads(comun.bajar_dataset("d_4765db0e87b9c86336792efe8a1f7a66", "limites.geojson").read_text(encoding="utf-8"))
salida = []
for f in cruda["features"]:
    polis = comun.poligonos(f["geometry"])
    nuevos = []
    for poli in polis:
        anillos = [r for r in (anillo([c[:2] for c in r]) for r in poli) if r]
        if anillos:
            nuevos.append(anillos)
    salida.append({
        "type": "Feature",
        "properties": {"zona": f["properties"]["PLN_AREA_N"], "region": f["properties"]["REGION_N"]},
        "geometry": {"type": "MultiPolygon", "coordinates": nuevos},
    })
salida.sort(key=lambda f: f["properties"]["zona"])
geo = {"type": "FeatureCollection", "fuente": "F10", "probado": comun.hoy(), "features": salida}
(comun.LAGO / "zonas.geojson").write_text(json.dumps(geo, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
comun.fuente("F10")
print(f"F10: {len(salida)} áreas, {(comun.LAGO / 'zonas.geojson').stat().st_size // 1024} KB")
