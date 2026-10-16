"""Extrae preguntas de UN PDF de claves del SERUMS.

Uso:  python extraer_pdf.py < archivo.pdf > salida.json

Lee el PDF por la entrada estándar (stdin) y escribe un JSON con la lista
de preguntas: numero, enunciado, opciones y la clave (la alternativa
resaltada en amarillo en el PDF de claves).
"""
import json
import re
import sys

import pymupdf

MARCA = re.compile(r"^([A-E])[\.\)]$")          # "A."  como palabra suelta
MARCA_PEGADA = re.compile(r"^([A-E])[\.\)](\S+)$")  # "A.Texto" sin espacio
NUM = re.compile(r"^(\d{1,3})[\.\)]$")
CABECERA = re.compile(r"(Evaluaci[oó]n para el Servicio Rural|P[aá]gina \d+ de \d+)", re.I)


def es_amarillo(fill):
    if not fill:
        return False
    r, g, b = fill[:3]
    return r > 0.85 and g > 0.8 and b < 0.5


def filas_de_pagina(page):
    """Agrupa las palabras de la página en filas (misma altura)."""
    palabras = page.get_text("words")  # x0,y0,x1,y1,texto,bloque,linea,n
    palabras.sort(key=lambda w: ((w[1] + w[3]) / 2, w[0]))
    filas = []
    for w in palabras:
        yc = (w[1] + w[3]) / 2
        if filas and abs(filas[-1]["y"] - yc) < 3.5:
            filas[-1]["w"].append(w)
        else:
            filas.append({"y": yc, "w": [w]})
    for f in filas:
        f["w"].sort(key=lambda w: w[0])
        f["texto"] = " ".join(w[4] for w in f["w"])
    return [f for f in filas if not CABECERA.search(f["texto"])]


def main():
    doc = pymupdf.open(stream=sys.stdin.buffer.read(), filetype="pdf")
    margen_izq = None
    preguntas, actual = [], None
    avisos = []

    for page in doc:
        amarillos = [d["rect"] for d in page.get_drawings() if es_amarillo(d.get("fill"))]
        filas = filas_de_pagina(page)
        if margen_izq is None:
            xs = [f["w"][0][0] for f in filas if NUM.match(f["w"][0][4])]
            margen_izq = min(xs) if xs else 50

        for f in filas:
            ws = f["w"]
            primera = ws[0]
            m = NUM.match(primera[4])
            # Nueva pregunta: número al inicio de la fila, pegado al margen
            if m and primera[0] < margen_izq + 15 and (
                actual is None or int(m.group(1)) == actual["numero"] + 1
            ):
                actual = {"numero": int(m.group(1)), "enunciado": [], "opciones": {},
                          "col_x": {}, "clave": [], "pagina": page.number + 1}
                preguntas.append(actual)
                ws = ws[1:]
                if not ws:
                    continue
            if actual is None:
                continue

            # Buscar marcas de alternativa en la fila
            cortes = []
            for i, w in enumerate(ws):
                mm = MARCA.match(w[4]) or MARCA_PEGADA.match(w[4])
                if not mm:
                    continue
                letra = mm.group(1)
                inicio_fila = i == 0
                hueco = i > 0 and w[0] - ws[i - 1][2] > 15
                if (inicio_fila or hueco) and letra not in actual["opciones"]:
                    cortes.append((i, letra, mm))
            if cortes:
                for k, (i, letra, mm) in enumerate(cortes):
                    fin = cortes[k + 1][0] if k + 1 < len(cortes) else len(ws)
                    trozo = [w[4] for w in ws[i + 1:fin]]
                    if mm.re is MARCA_PEGADA:
                        trozo.insert(0, mm.group(2))
                    actual["opciones"][letra] = " ".join(trozo)
                    actual["col_x"][letra] = ws[i][0]
                    w = ws[i]
                    cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
                    if any(r.x0 - 2 <= cx <= r.x1 + 2 and r.y0 - 2 <= cy <= r.y1 + 2 for r in amarillos):
                        actual["clave"].append(letra)
            elif actual["opciones"]:
                # Continuación de una alternativa larga: va a la columna más cercana a la izquierda
                x = ws[0][0]
                cand = [(l, cx) for l, cx in actual["col_x"].items() if cx <= x + 5]
                letra = max(cand, key=lambda t: (t[1], t[0]))[0] if cand else list(actual["opciones"])[-1]
                actual["opciones"][letra] += " " + " ".join(w[4] for w in ws)
            else:
                actual["enunciado"].append(" ".join(w[4] for w in ws))

    salida = []
    for p in preguntas:
        enun = " ".join(p["enunciado"])
        enun = re.sub(r"\s+", " ", enun).strip()
        opciones = {k: re.sub(r"\s+", " ", v).strip() for k, v in sorted(p["opciones"].items())}
        salida.append({"numero": p["numero"], "enunciado": enun, "opciones": opciones,
                       "clave": p["clave"], "pagina": p["pagina"]})
    json.dump({"preguntas": salida, "avisos": avisos}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
