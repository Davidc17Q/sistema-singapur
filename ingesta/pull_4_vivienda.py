#!/usr/bin/env python3
"""Ingesta F05 y F06 · vivienda pública. Escribe lago/vivienda.json y lago/privacidad.json.

Regla de la pregunta 5: lo que sale de aquí va agregado por zona. Bloque, calle, piso, código postal
y geometría de los edificios se leen en esta máquina y nunca llegan al lago publicado."""
import collections, csv, datetime, json, statistics
import comun

MINIMO = 10  # ventas mínimas para publicar una mediana: con menos, un grupo se acerca demasiado a un apartamento


def mediana(v):
    return round(statistics.median(v))


zonas_geo = json.loads((comun.LAGO / "zonas.geojson").read_text(encoding="utf-8"))["features"]
zonas = comun.preparar_zonas(zonas_geo)
nombres = {z[0] for z in zonas}

# F05 · edificios por área, ubicados por el primer vértice del contorno
edif = json.loads(comun.bajar_dataset("d_16b157c52ed637edd6ba1232e026258d", "edificios_hdb.geojson").read_text(encoding="utf-8"))
edificios = collections.Counter()
sin_zona = 0
for f in edif["features"]:
    lon, lat = comun.poligonos(f["geometry"])[0][0][0][:2]
    z = comun.ubicar(lon, lat, zonas)
    if z:
        edificios[z] += 1
    else:
        sin_zona += 1

# F06 · ventas
with open(comun.bajar_dataset("d_8b84c4ee58e3cfc0ece0d773c8ca6abc", "reventa_hdb.csv"), encoding="utf-8") as f:
    ventas = []
    for r in csv.DictReader(f):
        area = float(r["floor_area_sqm"])
        precio = float(r["resale_price"])
        ventas.append({**r, "precio": precio, "psm": precio / area})
mes_actual = datetime.date.today().strftime("%Y-%m")
meses = sorted({v["month"] for v in ventas if v["month"] < mes_actual})
ultimo = meses[-1]
ventana = meses[-12:]
hace_un_anio = meses[-24:-12]
en_ventana = [v for v in ventas if v["month"] in ventana]
vig = f"{ventana[0]} a {ultimo}"

# Asignación town → áreas del mapa (PROXY, ver catalogo/towns_a_zonas.json)
mapa = json.loads((comun.RAIZ / "catalogo" / "towns_a_zonas.json").read_text(encoding="utf-8"))["manual"]
towns = []
por_town = collections.defaultdict(list)
for v in en_ventana:
    por_town[v["town"]].append(v)
antes = collections.defaultdict(list)
for v in ventas:
    if v["month"] in hace_un_anio:
        antes[v["town"]].append(v["psm"])
for town, grupo in sorted(por_town.items()):
    areas = mapa.get(town, [town])
    assert all(a in nombres for a in areas), town
    fila = {"town": town, "zonas": areas, "asignacion": "manual" if town in mapa else "nombre_igual", "ventas": len(grupo)}
    if len(grupo) >= MINIMO:
        fila["mediana_precio_sgd"] = mediana([v["precio"] for v in grupo])
        fila["mediana_sgd_m2"] = mediana([v["psm"] for v in grupo])
        if len(antes[town]) >= MINIMO:
            fila["variacion_anual_pct"] = round(100 * (fila["mediana_sgd_m2"] / statistics.median(antes[town]) - 1), 1)
    tipos = {}
    for tipo in sorted({v["flat_type"] for v in grupo}):
        sub = [v["precio"] for v in grupo if v["flat_type"] == tipo]
        if len(sub) >= MINIMO:
            tipos[tipo] = {"ventas": len(sub), "mediana_precio_sgd": mediana(sub)}
    fila["por_tipo"] = tipos
    towns.append(fila)

serie = []
por_mes = collections.defaultdict(list)
for v in ventas:
    if v["month"] <= ultimo:
        por_mes[v["month"]].append(v["psm"])
for m in sorted(por_mes):
    serie.append([m, mediana(por_mes[m]), len(por_mes[m])])

nac = mediana([v["psm"] for v in en_ventana])
ordenados = sorted((t for t in towns if "mediana_sgd_m2" in t), key=lambda t: t["mediana_sgd_m2"])
primero_anio = statistics.median([s[1] for s in serie if s[0].startswith(serie[0][0][:4])])
cifras = {
    "ventas_ventana": {"valor": len(en_ventana), "unidad": "ventas registradas", "vigencia": vig, "fuente": "F06"},
    "mediana_nacional_sgd_m2": {"valor": nac, "unidad": "SGD por m²", "vigencia": vig, "fuente": "F06"},
    "zona_mas_cara_sgd_m2": {"valor": ordenados[-1]["mediana_sgd_m2"], "unidad": f"SGD por m² en {ordenados[-1]['town']}", "vigencia": vig, "fuente": "F06"},
    "zona_mas_barata_sgd_m2": {"valor": ordenados[0]["mediana_sgd_m2"], "unidad": f"SGD por m² en {ordenados[0]['town']}", "vigencia": vig, "fuente": "F06"},
    "cambio_desde_2017_pct": {"valor": round(100 * (serie[-1][1] / primero_anio - 1), 1), "unidad": f"% contra la mediana de {serie[0][0][:4]}", "vigencia": ultimo, "fuente": "F06"},
    "edificios_hdb": {"valor": sum(edificios.values()), "unidad": "edificios ubicados en un área", "vigencia": f"versión del portal al {comun.hoy()}", "fuente": "F05"},
}
comun.escribir(
    "vivienda", "vivienda", [comun.fuente("F05"), comun.fuente("F06")],
    cifras=cifras,
    minimo_ventas=MINIMO,
    ventana=vig,
    edificios_por_zona=dict(sorted(edificios.items())),
    towns=towns,
    series={"mediana_mensual_sgd_m2": {"unidad": "SGD por m²", "fuente": "F06", "puntos": serie}},
)

# Evidencia para la decisión de protección: solo el porcentaje, nunca las combinaciones
def unicos(clave):
    c = collections.Counter(clave(v) for v in ventas)
    return round(100 * sum(1 for v in ventas if c[clave(v)] == 1) / len(ventas), 1)


priv = {
    "pct_unicos_bloque_calle_piso_mes": unicos(lambda v: (v["block"], v["street_name"], v["storey_range"], v["month"])),
    "pct_unicos_town_tipo_mes": unicos(lambda v: (v["town"], v["flat_type"], v["month"])),
}
comun.escribir(
    "privacidad", "privacidad", [comun.fuente("F06")],
    cifras={
        "pct_unicos_con_direccion": {"valor": priv["pct_unicos_bloque_calle_piso_mes"], "unidad": "% de ventas solas con bloque, calle, piso y mes", "vigencia": f"{meses[0]} a {ultimo}", "fuente": "F06"},
        "pct_unicos_agregado": {"valor": priv["pct_unicos_town_tipo_mes"], "unidad": "% de ventas solas con zona, tipo y mes", "vigencia": f"{meses[0]} a {ultimo}", "fuente": "F06"},
    },
)
print(f"F05: {sum(edificios.values())} edificios en {len(edificios)} áreas, {sin_zona} sin área")
print(f"F06: {len(ventas)} ventas; ventana {vig}: {len(en_ventana)}; mediana {nac} SGD/m²; extremos {ordenados[0]['town']} {ordenados[0]['mediana_sgd_m2']} y {ordenados[-1]['town']} {ordenados[-1]['mediana_sgd_m2']}")
print(f"Privacidad: {priv}")
