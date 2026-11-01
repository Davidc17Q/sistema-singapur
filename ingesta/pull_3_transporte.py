#!/usr/bin/env python3
"""Ingesta F03 · modo de transporte al trabajo. Escribe lago/transporte.json. El sexo no se usa: no entra (minimización)."""
import csv
import comun

GRUPOS = {"Total_Total": "Todas las edades", "Below30Years_Total": "Menos de 30", "30_39Years_Total": "30 a 39",
          "40_49Years_Total": "40 a 49", "50YearsandOver_Total": "50 y más"}
PUBLICO = ["Public Bus Only", "MRT Only", "MRT & Public Bus Only", "Other combinations of MRT or Public Bus"]
ES = {"Public Bus Only": "Solo bus público", "MRT Only": "Solo MRT", "MRT & Public Bus Only": "MRT y bus público",
      "Other combinations of MRT or Public Bus": "Otras combinaciones de MRT o bus", "Taxi Only": "Solo taxi",
      "Car Only": "Solo carro", "Private Chartered Bus/Van Only": "Bus o van privados", "Lorry/Pickup Only": "Camión o pickup",
      "Motorcycle/Scooter Only": "Moto o scooter", "Others": "Otros", "No Transport Required": "No necesita transporte"}


def num(v):
    v = v.strip()
    return None if v in ("-", "na", "") else float(v.replace(",", ""))


with open(comun.bajar_dataset("d_b2adcabcfc9c4352f3086f1a61f77bc0", "transporte_trabajo.csv"), encoding="utf-8") as f:
    crudas = list(csv.DictReader(f))
total = next(r for r in crudas if r["Thousands"] == "Total")
filas = []
for r in crudas:
    if r["Thousands"] == "Total":
        continue
    for col, grupo in GRUPOS.items():
        filas.append({"modo_transporte": ES[r["Thousands"]], "grupo_edad": grupo, "trabajadores_miles": num(r[col]),
                      "porcentaje": round(100 * (num(r[col]) or 0) / num(total[col]), 1)})
base = num(total["Total_Total"])
publico = sum(num(r["Total_Total"]) for r in crudas if r["Thousands"] in PUBLICO)
carro = next(num(r["Total_Total"]) for r in crudas if r["Thousands"] == "Car Only")
vig = "encuesta de hogares 2015"
comun.escribir(
    "transporte", "transporte", [comun.fuente("F03")],
    cifras={
        "porcentaje_transporte_publico": {"valor": round(100 * publico / base, 1), "unidad": "% de trabajadores residentes", "vigencia": vig, "fuente": "F03"},
        "porcentaje_carro": {"valor": round(100 * carro / base, 1), "unidad": "% de trabajadores residentes", "vigencia": vig, "fuente": "F03"},
    },
    filas=filas,
)
print(f"F03: {len(filas)} filas; transporte público {100 * publico / base:.1f} %; total {base} miles")
