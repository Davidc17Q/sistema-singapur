#!/usr/bin/env python3
"""Actualiza el Excel del diccionario desde catalogo/ y lago/.
Uso: python catalogo/generar_excel.py <excel de la entrega 1> <salida> [enlace del repositorio]"""
import copy, datetime, json, pathlib, sys
import openpyxl

RAIZ = pathlib.Path(__file__).resolve().parent.parent
base, salida = sys.argv[1], sys.argv[2]
REPO = sys.argv[3] if len(sys.argv) > 3 else ""
wb = openpyxl.load_workbook(base)
cat = json.loads((RAIZ / "catalogo/fuentes.json").read_text(encoding="utf-8"))
dic = json.loads((RAIZ / "catalogo/diccionario.json").read_text(encoding="utf-8"))
lago = {p.name: json.loads(p.read_text(encoding="utf-8")) for p in (RAIZ / "lago").glob("*.json")}
lago["zonas.geojson"] = json.loads((RAIZ / "lago/zonas.geojson").read_text(encoding="utf-8"))


def fijar(ws, fila, col, valor):
    c = ws.cell(fila, col)
    c.value = valor
    return c


def estilo(ws, fila, modelo=5):
    for col in range(1, ws.max_column + 1):
        ws.cell(fila, col)._style = copy.copy(ws.cell(modelo, col)._style)


# ── Instrucciones ──
ins = wb["Instrucciones"]
ins["B5"] = "Ciudad elegida: Singapur"
ins["B6"] = "Integrantes: Miguel Angel Garcia Osorio - Juan Ignacio Lotero Franco - David Quintero Gallego"
if REPO:
    ins["B7"] = "Enlace al repositorio o a la carpeta del lago: " + REPO

# ── 1. Fuentes ──
TIPO = {"F01": "Plataforma colaborativa", "F04": "Plataforma colaborativa"}
FORMATO = {"F01": "CSV", "F02": "GeoJSON", "F03": "CSV", "F04": "CSV", "F05": "GeoJSON", "F06": "CSV", "F07": "JSON", "F08": "JSON", "F09": "JSON", "F10": "GeoJSON"}
COMO = {"F07": "API sin llave", "F08": "API sin llave", "F09": "API sin llave"}
PERSONAS = {"F04": "Personas identificables", "F06": "Personas identificables", "F08": "Texto libre sin revisar"}
FREC = {"F01": "Anual", "F02": "No se sabe", "F03": "Cada 10 años", "F04": "Única vez", "F05": "Trimestral", "F06": "Diaria", "F07": "Tiempo real", "F08": "Tiempo real", "F09": "Tiempo real", "F10": "Única vez"}
ESTADO = {"integrada": "Integrada al lago", "candidata": "Candidata", "descartada": "Descartada"}
ENCONTRADA = {
    "F01": "Búsqueda en Kaggle de conjuntos con Singapur en el nombre",
    "F04": "Búsqueda en Kaggle de conjuntos con Singapur en el nombre",
    "F09": "IA (Claude) la sugirió; se comprobó en el portal y con la API",
    "F10": "IA (Claude Code) la encontró al buscar los límites del mapa; se bajó y se revisó el GeoJSON",
}
OBS = {
    "F05": " Sin nombres de personas, pero ubica cada edificio.",
    "F06": " No nombra personas, pero con bloque, calle y piso un apartamento y su precio quedan determinables.",
    "F08": " Las fotos no se revisaron: la lista del Excel no tiene una opción para imágenes.",
}
fs = wb["1. Fuentes"]
for i, f in enumerate(cat):
    fila = 5 + i
    if fila > 13:
        estilo(fs, fila)
    fijar(fs, fila, 1, f["id"])
    fijar(fs, fila, 2, f["nombre"])
    fijar(fs, fila, 3, f["entidad"])
    fijar(fs, fila, 4, TIPO.get(f["id"], "Entidad pública"))
    fijar(fs, fila, 5, f["url"]).hyperlink = f["url"]
    fijar(fs, fila, 6, FORMATO[f["id"]])
    fijar(fs, fila, 7, COMO.get(f["id"], "Descarga directa"))
    fijar(fs, fila, 8, f["licencia"])
    fijar(fs, fila, 9, PERSONAS.get(f["id"], "No"))
    fijar(fs, fila, 10, "Singapur")
    fijar(fs, fila, 11, f["vigencia"])
    fijar(fs, fila, 12, FREC[f["id"]])
    fijar(fs, fila, 13, datetime.date.fromisoformat(f["probado"])).number_format = "yyyy-mm-dd"
    fijar(fs, fila, 14, ESTADO[f["estado"]])
    fijar(fs, fila, 15, ENCONTRADA.get(f["id"], "Búsqueda en el portal oficial de datos públicos de Singapur"))
    fijar(fs, fila, 16, f["nota"] + OBS.get(f["id"], ""))


# ── 2. Diccionario: solo lo que de verdad está en el lago ──
def ejemplo(d):
    doc = lago[d["archivo"].split("/")[1]]
    campo = d["campo"]
    if d["archivo"].endswith(".geojson"):
        p = doc["features"][0]
        return "polígono simplificado de " + p["properties"]["zona"] if campo == "geometry" else p["properties"][campo]
    if campo.startswith("cifras."):
        return doc["cifras"][campo.split(".")[1]]["valor"]
    if campo.startswith(("por_zona", "edificios_por_zona")):
        k, v = next(iter(doc[campo.split(".")[0]].items()))
        return f"{k}: {v}"
    if campo.startswith("filas[]."):
        nombre = campo.split(".")[1]
        return next(x[nombre] for x in doc["filas"] if x[nombre] is not None)
    if campo.startswith("towns[].por_tipo"):
        k, v = next(iter(doc["towns"][0]["por_tipo"].items()))
        return f"{k}: {v[campo.split('.')[-1]]}"
    if campo.startswith("towns[]."):
        v = doc["towns"][0][campo.split(".")[1]]
        return ", ".join(v) if isinstance(v, list) else v
    if campo.startswith("series."):
        return json.dumps(doc["series"]["mediana_mensual_sgd_m2"]["puntos"][0], ensure_ascii=False)
    return doc[campo]


ds = wb["2. Diccionario"]
assert len(dic) <= 40, "El resumen del Excel solo cuenta hasta la fila 44"
for fila in range(4, 45):
    for col in range(1, 14):
        ds.cell(fila, col).value = None
for i, d in enumerate(dic):
    valores = (d["fuente"], d["archivo"], d["campo"], d["original"], d["significado"], d["tipo"], d["unidad"], ejemplo(d),
               d["vacio"], d["valores"], d["clasificacion"], d["transformacion"], d["pregunta"])
    for col, v in enumerate(valores, 1):
        ds.cell(5 + i, col).value = v

# ── 3. Bitácora IA ──
bitacora = json.loads((RAIZ / "catalogo/bitacora_ia.json").read_text(encoding="utf-8"))
bs = wb["3. Bitácora IA"]
for fila in range(4, 43):
    for col in range(1, 9):
        bs.cell(fila, col).value = None
for i, b in enumerate(bitacora):
    bs.cell(4 + i, 1).value = i + 1
    for col, k in enumerate(("herramienta", "encargo", "respondio", "comprobaron", "resultado", "fuente", "aprendieron"), 2):
        bs.cell(4 + i, col).value = b[k]

wb.calculation.fullCalcOnLoad = True
wb.save(salida)
print(f"{len(cat)} fuentes, {len(dic)} campos, {len(bitacora)} encargos a la IA")
