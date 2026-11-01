#!/usr/bin/env python3
"""Segunda herramienta para el mismo cálculo: DuckDB sobre el crudo debe dar las medianas de la ingesta en Python."""
import json, pathlib, sys
import duckdb

RAIZ = pathlib.Path(__file__).resolve().parents[1]
viv = json.loads((RAIZ / "lago/vivienda.json").read_text(encoding="utf-8"))
desde, hasta = viv["ventana"].split(" a ")
filas = duckdb.sql(f"""
    SELECT town, count(*) AS n, median(resale_price / floor_area_sqm) AS m2
    FROM read_csv('{(RAIZ / "lago/raw/reventa_hdb.csv").as_posix()}', header = true)
    WHERE month BETWEEN '{desde}' AND '{hasta}' GROUP BY town
""").fetchall()
lago = {t["town"]: t for t in viv["towns"]}
malas = [(t, n, round(m), lago[t]["ventas"], lago[t]["mediana_sgd_m2"]) for t, n, m in filas
         if n != lago[t]["ventas"] or abs(round(m) - lago[t]["mediana_sgd_m2"]) > 1]
print(f"{len(filas)} zonas comparadas, {len(malas)} diferencias", malas)
sys.exit(1 if malas else 0)
