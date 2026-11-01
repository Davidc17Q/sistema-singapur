"""Funciones compartidas por los scripts de ingesta. Solo biblioteca estándar, sin llaves."""
import datetime, json, pathlib, time, urllib.error, urllib.request

RAIZ = pathlib.Path(__file__).resolve().parent.parent
RAW = RAIZ / "lago" / "raw"
LAGO = RAIZ / "lago"
CATALOGO = RAIZ / "catalogo" / "fuentes.json"
UA = {"User-Agent": "taller-datos-eafit-singapur/1.0 (curso universitario)"}
POLL = "https://api-open.data.gov.sg/v1/public/api/datasets/{}/poll-download"


def _get(url, timeout=180):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()


def bajar_dataset(dataset_id, nombre_local, forzar=False):
    """Baja un conjunto de data.gov.sg a lago/raw. El portal limita las peticiones: se espera y se reintenta."""
    RAW.mkdir(parents=True, exist_ok=True)
    destino = RAW / nombre_local
    if destino.exists() and not forzar:
        return destino
    for intento in range(8):
        try:
            res = json.loads(_get(POLL.format(dataset_id), timeout=40))
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            res = {"code": 24}
        if res.get("code") == 0 and res["data"].get("url"):
            destino.write_bytes(_get(res["data"]["url"]))
            return destino
        time.sleep(15)
    raise SystemExit(f"data.gov.sg no entregó {dataset_id} tras 8 intentos")


def hoy():
    return datetime.date.today().isoformat()


def fuente(fid):
    """Lee la ficha del catálogo y deja constancia del día en que la fuente respondió de verdad."""
    fichas = json.loads(CATALOGO.read_text(encoding="utf-8"))
    ficha = next(f for f in fichas if f["id"] == fid)
    if ficha.get("probado") != hoy():
        ficha["probado"] = hoy()
        CATALOGO.write_text(json.dumps(fichas, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return {k: ficha[k] for k in ("id", "nombre", "entidad", "url", "licencia", "estado", "vigencia", "probado")}


def escribir(nombre, tema, fuentes, cifras=None, **resto):
    """Escribe lago/<nombre>.json siempre con la forma del contrato."""
    doc = {"tema": tema, "probado": hoy(), "fuentes": fuentes, "cifras": cifras or {}}
    doc.update(resto)
    LAGO.mkdir(exist_ok=True)
    (LAGO / f"{nombre}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def en_anillo(lon, lat, anillo):
    dentro = False
    j = len(anillo) - 1
    for i in range(len(anillo)):
        xi, yi = anillo[i][0], anillo[i][1]
        xj, yj = anillo[j][0], anillo[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def poligonos(geom):
    return [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]


def preparar_zonas(features):
    """Devuelve [(nombre, bbox, polígonos)] para ubicar puntos dentro de un área de planificación."""
    zonas = []
    for f in features:
        polis = poligonos(f["geometry"])
        xs = [p[0] for poli in polis for p in poli[0]]
        ys = [p[1] for poli in polis for p in poli[0]]
        zonas.append((f["properties"]["zona"], (min(xs), min(ys), max(xs), max(ys)), polis))
    return zonas


def ubicar(lon, lat, zonas):
    for nombre, (x0, y0, x1, y1), polis in zonas:
        if x0 <= lon <= x1 and y0 <= lat <= y1:
            for poli in polis:
                if en_anillo(lon, lat, poli[0]) and not any(en_anillo(lon, lat, h) for h in poli[1:]):
                    return nombre
    return None
