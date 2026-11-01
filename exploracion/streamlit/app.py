"""Prueba de exploración: la misma vista del sistema en Streamlit, leyendo el mismo lago."""
import json, pathlib
import pandas as pd
import pydeck as pdk
import streamlit as st

LAGO = pathlib.Path(__file__).resolve().parents[2] / "lago"
viv = json.loads((LAGO / "vivienda.json").read_text(encoding="utf-8"))
zonas = json.loads((LAGO / "zonas.geojson").read_text(encoding="utf-8"))
por_zona = {z: t for t in viv["towns"] for z in t["zonas"]}
tope = max(t["mediana_sgd_m2"] for t in viv["towns"])
for f in zonas["features"]:
    t = por_zona.get(f["properties"]["zona"])
    f["properties"]["m2"] = t["mediana_sgd_m2"] if t else 0
    f["properties"]["color"] = [28, 92, 171, int(40 + 200 * t["mediana_sgd_m2"] / tope)] if t else [220, 220, 216, 255]

st.title("Singapur: precio de la vivienda HDB")
st.caption(f"Fuente F06 · {viv['ventana']}")
st.pydeck_chart(pdk.Deck(
    layers=[pdk.Layer("GeoJsonLayer", zonas, get_fill_color="properties.color", pickable=True, stroked=True, get_line_color=[255, 255, 255])],
    initial_view_state=pdk.ViewState(latitude=1.35, longitude=103.82, zoom=9.6),
    map_style=None,
    tooltip={"text": "{zona}: {m2} SGD por m²"},
))
st.dataframe(pd.DataFrame([{"zona": t["town"], "sgd_m2": t["mediana_sgd_m2"], "ventas": t["ventas"]} for t in viv["towns"]]).sort_values("sgd_m2", ascending=False))
serie = viv["series"]["mediana_mensual_sgd_m2"]["puntos"]
st.line_chart(pd.DataFrame(serie, columns=["mes", "sgd_m2", "ventas"]).set_index("mes")["sgd_m2"])
