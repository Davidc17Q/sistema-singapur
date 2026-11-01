#!/usr/bin/env python3
"""Verificación antes de publicar: con un solo FAIL no se despliega."""
import filecmp, glob, json, pathlib, re, subprocess, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
sys.stdout.reconfigure(encoding="utf-8")
fallos = 0
# Correos, teléfonos de Singapur (8 dígitos que empiezan por 6, 8 o 9) y NRIC
PII = re.compile(r"[\w.+-]+@[\w-]+\.[a-z]{2,}|(?<![\d-])(?:\+?65[ -]?)?[689]\d{3}[ -]?\d{4}(?!\d)|\b[STFG]\d{7}[A-Z]\b")
CAMPOS_PROHIBIDOS = re.compile(r"block|bloque|street|calle|storey|piso|postal|floor_area|lease|nric|cedula|telefono|celular|correo|email|anfitrion|host", re.I)
LON, LAT = (103.5, 104.2), (1.1, 1.5)


def check(nombre, ok, detalle=""):
    global fallos
    print(("PASS " if ok else "FAIL ") + nombre + ("" if ok else f" <- {detalle}"))
    fallos += 0 if ok else 1


def recorre(x, clave=""):
    if isinstance(x, dict):
        for k, v in x.items():
            yield from recorre(v, k)
    elif isinstance(x, list):
        for v in x:
            yield from recorre(v, clave)
    else:
        yield clave, x


def rutas(x, prefijo=""):
    """Rutas de campos, con [] para listas y * para mapas cuyas claves son datos (zonas, tipos)."""
    if isinstance(x, dict):
        for k, v in x.items():
            clave = "*" if prefijo.rsplit(".", 1)[-1] in ("por_zona", "edificios_por_zona", "por_tipo") else k
            yield from rutas(v, f"{prefijo}.{clave}" if prefijo else clave)
    elif isinstance(x, list):
        if x and all(isinstance(v, dict) for v in x):
            for v in x:
                yield from rutas(v, prefijo + "[]")
        else:
            yield prefijo
    else:
        yield prefijo


catalogo = json.load(open(RAIZ / "catalogo/fuentes.json", encoding="utf-8"))
fichas = {f["id"]: f for f in catalogo}
ESTADOS = {"integrada", "candidata", "descartada", "no responde", "no existe"}
check("catálogo: IDs únicos", len(fichas) == len(catalogo))
for f in catalogo:
    check(f"catálogo {f['id']}: ficha completa", all(f.get(k) for k in ("nombre", "entidad", "url", "licencia", "personas", "vigencia", "probado", "uso", "nota")) and f["estado"] in ESTADOS, f)
    check(f"catálogo {f['id']}: probado es un día", re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(f.get("probado"))), f.get("probado"))

usadas = set()
docs = {}
for ruta in sorted(glob.glob(str(RAIZ / "lago/*.json"))):
    nombre = pathlib.Path(ruta).name
    lago = json.load(open(ruta, encoding="utf-8"))
    docs[nombre] = lago
    fuentes = lago.get("fuentes", [])
    ids = {f.get("id") for f in fuentes}
    usadas |= ids
    check(f"{nombre}: probado es un día", re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(lago.get("probado"))), lago.get("probado"))
    check(f"{nombre}: toda fuente con url y licencia", fuentes and all(f.get("url") and f.get("licencia") for f in fuentes))
    check(f"{nombre}: fuentes integradas en el catálogo", all(fichas.get(i, {}).get("estado") == "integrada" for i in ids), ids)
    for clave, c in lago.get("cifras", {}).items():
        completa = c.get("valor") is not None and c.get("unidad") and c.get("vigencia") and c.get("fuente") in ids
        check(f"{nombre}: {clave} con valor, unidad, vigencia y fuente conocida", completa, c)
    pares = list(recorre(lago))
    sospechosos = sorted({k for k, _ in pares if CAMPOS_PROHIBIDOS.search(k)})
    check(f"{nombre}: ningún campo con dato de hogar o persona", not sospechosos, sospechosos)
    # Solo se revisan los textos de los datos: las URL de las fuentes traen IDs largos
    textos = [v for k, v in pares if isinstance(v, str) and k not in ("url", "id")]
    hallado = next((v for v in textos if PII.search(v)), None)
    check(f"{nombre}: ningún texto con correo, teléfono o documento", hallado is None, hallado)

# Comprobaciones de dominio
zonas = json.load(open(RAIZ / "lago/zonas.geojson", encoding="utf-8"))
nombres = {f["properties"]["zona"] for f in zonas["features"]}
check("zonas: son las 55 áreas de planificación", len(nombres) == 55, len(nombres))
coords = [p for f in zonas["features"] for poli in f["geometry"]["coordinates"] for anillo in poli for p in anillo]
check("zonas: coordenadas dentro de Singapur", all(LON[0] <= p[0] <= LON[1] and LAT[0] <= p[1] <= LAT[1] for p in coords))
check("zonas: pesa menos de 300 KB para abrir en un teléfono", (RAIZ / "lago/zonas.geojson").stat().st_size < 300_000)

v = docs["vivienda.json"]
minimo = v["minimo_ventas"]
check("vivienda: la suma por zona da el total de la ventana", sum(t["ventas"] for t in v["towns"]) == v["cifras"]["ventas_ventana"]["valor"])
check("vivienda: toda mediana publicada tiene el mínimo de ventas", all(t["ventas"] >= minimo for t in v["towns"] if "mediana_sgd_m2" in t))
check("vivienda: todo tipo publicado tiene el mínimo de ventas", all(d["ventas"] >= minimo for t in v["towns"] for d in t["por_tipo"].values()))
check("vivienda: medianas por m² en rango sensato", all(2000 < t["mediana_sgd_m2"] < 25000 for t in v["towns"] if "mediana_sgd_m2" in t))
check("vivienda: las áreas de cada zona existen en el mapa", all(z in nombres for t in v["towns"] for z in t["zonas"]))
check("vivienda: ningún área repetida entre zonas", len([z for t in v["towns"] for z in t["zonas"]]) == len({z for t in v["towns"] for z in t["zonas"]}))
check("vivienda: los edificios suman el total", sum(v["edificios_por_zona"].values()) == v["cifras"]["edificios_hdb"]["valor"])
puntos = v["series"]["mediana_mensual_sgd_m2"]["puntos"]
check("vivienda: la serie está ordenada y sin meses repetidos", [p[0] for p in puntos] == sorted({p[0] for p in puntos}))
meses_serie = [p[0] for p in puntos]
esperados = [f"{a}-{m:02d}" for a in range(int(meses_serie[0][:4]), int(meses_serie[-1][:4]) + 1) for m in range(1, 13)]
esperados = [m for m in esperados if meses_serie[0] <= m <= meses_serie[-1]]
check("vivienda: la serie no tiene meses faltantes", meses_serie == esperados)

a = docs["atracciones.json"]
check("atracciones: el total coincide con las filas", a["cifras"]["total_atracciones"]["valor"] == len(a["filas"]))
check("atracciones: puntos dentro de Singapur", all(LON[0] <= f["lon"] <= LON[1] and LAT[0] <= f["lat"] <= LAT[1] for f in a["filas"]))
check("atracciones: sin mal código de caracteres", not any("â€" in (f["descripcion_corta"] or "") + f["nombre"] for f in a["filas"]))
check("atracciones: el conteo por zona no supera el total", sum(a["por_zona"].values()) <= len(a["filas"]))

t = docs["transporte.json"]
por_edad = [f for f in t["filas"] if f["grupo_edad"] == "Todas las edades"]
check("transporte: los modos suman el 100 %", abs(sum(f["porcentaje"] for f in por_edad) - 100) < 0.6, sum(f["porcentaje"] for f in por_edad))

integradas = {f["id"] for f in catalogo if f["estado"] == "integrada"}
check("catálogo: toda fuente integrada alimenta el lago", integradas == usadas | {zonas.get("fuente")}, integradas ^ (usadas | {zonas.get("fuente")}))
check("sistema: por lo menos tres fuentes integradas", len(integradas) >= 3, integradas)

# El diccionario y el lago dicen lo mismo: si un campo no está en él, no existe
dic = json.load(open(RAIZ / "catalogo/diccionario.json", encoding="utf-8"))
en_dic = {(d["archivo"], d["campo"]) for d in dic}
en_lago = set()
METADATOS = re.compile(r"^(tema|probado|fuentes\[\]\.|cifras\.[^.]+\.(unidad|vigencia|fuente)$|series\.[^.]+\.(unidad|fuente)$)")
for nombre, doc in docs.items():
    for r in rutas(doc):
        if METADATOS.match(r):
            continue
        en_lago.add((f"lago/{nombre}", r.replace(".valor", "") if r.startswith("cifras.") else r))
en_lago |= {("lago/zonas.geojson", c) for c in ("zona", "region", "geometry")}
check("diccionario: todo campo del lago está documentado", en_lago <= en_dic, sorted(en_lago - en_dic))
check("diccionario: no documenta campos que no existen", en_dic <= en_lago, sorted(en_dic - en_lago))
check("diccionario: toda fila apunta a una fuente integrada", all(d["fuente"] in integradas for d in dic))
check("diccionario: toda fila responde a una pregunta", all(d.get("pregunta") for d in dic))

# Lo publicado es exactamente lo verificado
web = RAIZ / "web/datos"
for f in ("zonas.geojson", "atracciones.json", "transporte.json", "vivienda.json", "privacidad.json"):
    check(f"web: {f} es idéntico al lago", (web / f).exists() and filecmp.cmp(RAIZ / "lago" / f, web / f, shallow=False))
check("web: fuentes.json es idéntico al catálogo", filecmp.cmp(RAIZ / "catalogo/fuentes.json", web / "fuentes.json", shallow=False))
publicados = {p.name for p in web.iterdir()}
check("web: solo archivos de la lista blanca", publicados == {"zonas.geojson", "atracciones.json", "transporte.json", "vivienda.json", "privacidad.json", "fuentes.json"}, publicados)
codigo = "".join(p.read_text(encoding="utf-8", errors="ignore") for p in (RAIZ / "web").glob("*.*"))
check("web: nombres de los tres integrantes visibles", all(n in codigo for n in ("Miguel Angel Garcia Osorio", "Juan Ignacio Lotero Franco", "David Quintero Gallego")))
check("web: aviso de la licencia con enlace", "data.gov.sg/open-data-licence" in codigo)
check("web: ninguna clave en el código", not re.search(r"password|contrase|api[_-]?key|accountkey", codigo, re.I))
check("web: ninguna carga desde otro dominio", not re.search(r"(src|href)=\"https?://[^\"]+\.(js|css)", codigo))

# Los crudos no llegan al repositorio
try:
    seguidos = subprocess.run(["git", "ls-files"], cwd=RAIZ, capture_output=True, text=True, check=True).stdout.splitlines()
except (OSError, subprocess.CalledProcessError):
    seguidos = []
check("git: lago/raw no está en el repositorio", not any(s.startswith("lago/raw") for s in seguidos))
check("git: ningún .env en el repositorio", not any(pathlib.Path(s).name.startswith(".env") for s in seguidos))

print(f"\n{fallos} fallos")
sys.exit(1 if fallos else 0)
