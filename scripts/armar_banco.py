"""Une las extracciones de cada PDF en un solo banco (data/preguntas.json).

Uso (lo hace scripts/correr_fase1.sh):
    entrada estándar = bloques "### <archivo>" seguidos de una línea JSON
    (la salida de extraer_pdf.py), y opcionalmente "### clasificacion"
    seguido de un JSON {id: {bloque, subtema, tipo, norma_referencia}}.
    salida estándar = JSON con la lista de preguntas.

Cuando un examen tiene dos versiones con las mismas preguntas en distinto
orden (2024-II I/II, 2025-I A/B), se guarda solo la versión principal y se
anota el número que tiene la pregunta en la otra versión.
"""
import difflib
import json
import re
import sys

# archivo -> (proceso, version, url de la fuente)
FUENTES = {
    "2024-II_claves_I": ("2024-II", "I", "https://www.gob.pe/institucion/minsa/informes-publicaciones/5943055"),
    "2024-II_claves_II": ("2024-II", "II", "https://www.gob.pe/institucion/minsa/informes-publicaciones/5943055"),
    "2025-I_claves_A": ("2025-I", "A", "https://www.gob.pe/institucion/minsa/informes-publicaciones/6641242-examenes-de-la-evaluacion-para-el-serums-2025-i"),
    "2025-I_claves_B": ("2025-I", "B", "https://www.gob.pe/institucion/minsa/informes-publicaciones/6641242-examenes-de-la-evaluacion-para-el-serums-2025-i"),
    "2025-II_claves": ("2025-II", "unica", "https://www.gob.pe/institucion/minsa/informes-publicaciones/7084125-examenes-de-la-evaluacion-para-el-serums-2025-ii"),
    "2026-I_claves": ("2026-I", "unica", "https://www.gob.pe/institucion/minsa/informes-publicaciones/8053031-claves-de-respuesta-de-la-evaluacion-para-el-serums-2026-i"),
    "2026-II_claves": ("2026-II", "unica", "https://www.gob.pe/institucion/minsa/informes-publicaciones/8489155-claves-de-respuesta-de-la-evaluacion-para-el-serums-2026-ii"),
}
SECUNDARIAS = {"2024-II_claves_II": "2024-II_claves_I", "2025-I_claves_B": "2025-I_claves_A"}


def norm(t):
    return re.sub(r"[^a-z0-9áéíóúñü]+", " ", t.lower()).strip()


def leer_entrada():
    secciones, nombre = {}, None
    for linea in sys.stdin.read().splitlines():
        if linea.startswith("### "):
            nombre = linea[4:].strip()
        elif linea.strip() and nombre:
            secciones[nombre] = json.loads(linea)
    return secciones


def main():
    sec = leer_entrada()
    clasif = {}
    for nombre in [n for n in sec if n.startswith("clasif")]:
        clasif.update(sec.pop(nombre))
    marcas = sec.pop("marcas", {})
    banco = []
    for archivo, (proceso, version, url) in FUENTES.items():
        if archivo in SECUNDARIAS or archivo not in sec:
            continue
        otra = SECUNDARIAS_INV.get(archivo)
        otras = sec[otra]["preguntas"] if otra in sec else []
        for p in sec[archivo]["preguntas"]:
            pid = f"{proceso}-{p['numero']:03d}"
            item = {
                "id": pid,
                "proceso": proceso,
                "version": version,
                "numero": p["numero"],
                "enunciado": p["enunciado"],
                "opciones": p["opciones"],
                "clave": p["clave"][0] if len(p["clave"]) == 1 else None,
                "bloque": None,
                "subtema": None,
                "tipo": None,
                "norma_referencia": None,
                "estado": "vigente",
                "clasificacion_revisada": False,
                "fuente_url": url,
                "pagina_pdf": p["pagina"],
            }
            if otras:
                q = max(otras, key=lambda q: difflib.SequenceMatcher(None, norm(p["enunciado"]), norm(q["enunciado"])).ratio())
                r = difflib.SequenceMatcher(None, norm(p["enunciado"]), norm(q["enunciado"])).ratio()
                if r > 0.9:
                    item["numero_en_otra_version"] = {FUENTES[otra][1]: q["numero"]}
                    texto_a = norm(p["opciones"].get(item["clave"] or "", ""))
                    texto_b = norm(q["opciones"].get(q["clave"][0] if q["clave"] else "", ""))
                    item["clave_coincide_otra_version"] = texto_a == texto_b
            c = clasif.get(pid)
            if c:
                for k in ("bloque", "subtema", "tipo", "norma_referencia"):
                    item[k] = c.get(k) or None
                if c.get("duda_clave"):
                    item["observacion"] = "Posible clave dudosa (revisión IA): " + c["duda_clave"]
            m = marcas.get(pid)
            if m:  # marcas manuales (data/marcas_manuales.json): mandan sobre lo automático
                item["estado"] = m.get("estado", item["estado"])
                for k in ("clave_sugerida", "sustento", "sustento_url"):
                    if m.get(k):
                        item[k] = m[k]
                if "observacion" in m:  # la marca manual reemplaza la nota automática ("" la borra)
                    item["observacion"] = m["observacion"] or None
                if m.get("veredicto"):
                    item["veredicto_norma"] = m["veredicto"]
            banco.append(item)
    json.dump(banco, sys.stdout, ensure_ascii=False, indent=2)


SECUNDARIAS_INV = {v: k for k, v in SECUNDARIAS.items()}

if __name__ == "__main__":
    main()
