#!/usr/bin/env python3
"""Ingesta F02 · atracciones turísticas. Escribe lago/atracciones.json con solo los campos que usa una vista."""
import collections, json, re
import comun


def texto(v):
    """La fuente trae None como texto y caracteres mal codificados (â€™). Aquí se limpian, no en la vista."""
    if v is None or str(v).strip() in ("", "None", "null"):
        return None
    s = str(v).strip()
    try:
        s = s.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    return re.sub(r"\s+", " ", s)


def fecha(v):
    v = str(v or "")
    return f"{v[:4]}-{v[4:6]}-{v[6:8]}" if re.fullmatch(r"\d{14}(\.0)?", v) else None


cruda = json.loads(comun.bajar_dataset("d_0f2f47515425404e6c9d2a040dd87354", "atracciones.geojson").read_text(encoding="utf-8"))
zonas = comun.preparar_zonas(json.loads((comun.LAGO / "zonas.geojson").read_text(encoding="utf-8"))["features"])
filas, vistos = [], set()
for f in cruda["features"]:
    p = f["properties"]
    nombre = texto(p.get("PAGETITLE"))
    lon, lat = f["geometry"]["coordinates"][:2]
    if not nombre or nombre in vistos:
        continue
    vistos.add(nombre)
    filas.append({
        "nombre": nombre,
        "direccion": texto(p.get("ADDRESS")),
        "descripcion_corta": texto(p.get("META_DESCRIPTION")),
        "zona": comun.ubicar(lon, lat, zonas),
        "lon": round(lon, 5),
        "lat": round(lat, 5),
        "fecha_actualizacion_fuente": fecha(p.get("FMEL_UPD_D")),
    })
filas.sort(key=lambda f: f["nombre"])
por_zona = collections.Counter(f["zona"] for f in filas if f["zona"])
fechas = sorted(f["fecha_actualizacion_fuente"] for f in filas if f["fecha_actualizacion_fuente"])
vig = fechas[-1][:4] if fechas else "sin fecha"
comun.escribir(
    "atracciones", "atracciones", [comun.fuente("F02")],
    cifras={
        "total_atracciones": {"valor": len(filas), "unidad": "atracciones", "vigencia": f"registros editados hasta {vig}", "fuente": "F02"},
        "zonas_con_atraccion": {"valor": len(por_zona), "unidad": "áreas de 55", "vigencia": f"registros editados hasta {vig}", "fuente": "F02"},
    },
    por_zona=dict(sorted(por_zona.items())),
    filas=filas,
)
print(f"F02: {len(filas)} atracciones de {len(cruda['features'])}; {len(por_zona)} áreas; última edición {fechas[-1] if fechas else '?'}; sin zona: {sum(1 for f in filas if not f['zona'])}")
