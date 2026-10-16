"""Reporte de control y CSV de revisión a partir de data/preguntas.json.

Uso:
    python reporte.py md  < data/preguntas.json > data/reporte_control.md
    python reporte.py csv < data/preguntas.json > data/revision.csv
"""
import collections
import csv
import difflib
import io
import json
import re
import sys

BLOQUES = ["Salud pública", "Cuidado integral de salud", "Ética e interculturalidad",
           "Investigación", "Gestión de servicios de salud"]


def norm(t):
    return re.sub(r"[^a-z0-9áéíóúñü]+", " ", t.lower()).strip()


def duplicados(banco, umbral=0.70):
    """Pares de preguntas de exámenes distintos con enunciado muy parecido."""
    pares = []
    textos = [(b, norm(b["enunciado"])) for b in banco]
    for i, (a, ta) in enumerate(textos):
        for b, tb in textos[i + 1:]:
            if a["proceso"] == b["proceso"]:
                continue
            sm = difflib.SequenceMatcher(None, ta, tb)
            if sm.real_quick_ratio() < umbral or sm.quick_ratio() < umbral:
                continue
            r = sm.ratio()
            if r >= umbral:
                misma = norm(a["opciones"][a["clave"]]) == norm(b["opciones"][b["clave"]])
                pares.append((a, b, r, misma))
    return pares


def md(banco):
    out = []
    w = out.append
    procesos = sorted({b["proceso"] for b in banco}, key=lambda p: (p[:4], len(p)))
    w("# Reporte de control – Fase 1\n")
    w(f"Total de preguntas únicas en el banco: **{len(banco)}**\n")

    w("## Preguntas por examen\n")
    w("| Examen | Preguntas | Sin clave | Sin clasificar | Versión guardada | Otra versión (mismas preguntas) |")
    w("|---|---|---|---|---|---|")
    for p in procesos:
        bs = [b for b in banco if b["proceso"] == p]
        otra = {k for b in bs for k in b.get("numero_en_otra_version", {})}
        w(f"| {p} | {len(bs)} | {sum(b['clave'] is None for b in bs)} | "
          f"{sum(b['bloque'] is None for b in bs)} | {bs[0]['version']} | {', '.join(sorted(otra)) or '—'} |")
    w("")

    w("## Preguntas por bloque y examen\n")
    w("| Bloque | " + " | ".join(procesos) + " | Total |")
    w("|---|" + "---|" * (len(procesos) + 1))
    for bl in BLOQUES + [None]:
        fila = [sum(1 for b in banco if b["proceso"] == p and b["bloque"] == bl) for p in procesos]
        if bl is None and not any(fila):
            continue
        w(f"| {bl or 'Sin clasificar'} | " + " | ".join(map(str, fila)) + f" | {sum(fila)} |")
    w("")

    w("## Tipo de pregunta\n")
    for t, n in collections.Counter(b["tipo"] for b in banco).most_common():
        w(f"- {t or 'sin dato'}: {n}")
    w("")
    w("> **Ojo:** bloque, subtema, tipo y norma_referencia los propuso la IA (no vienen del PDF). "
      "Los números de norma salieron de memoria y **no están verificados**: revísalos en `data/revision.csv`. "
      f"Preguntas con norma sugerida: {sum(bool(b['norma_referencia']) for b in banco)}. "
      f"Con subtema \"Otro\": {sum((b['subtema'] or '').startswith('Otro') for b in banco)}.\n")

    w("## Verificación de claves\n")
    cruz = [b for b in banco if "clave_coincide_otra_version" in b]
    ok = sum(b["clave_coincide_otra_version"] for b in cruz)
    w(f"- Preguntas que existen en dos versiones (2024-II I/II y 2025-I A/B): {len(cruz)}. "
      f"La respuesta resaltada coincide en ambas versiones en **{ok} de {len(cruz)}**.")
    w("- Todas las claves se leyeron del resaltado amarillo del PDF oficial de claves.\n")

    ver = collections.Counter(b.get("veredicto_norma") for b in banco if b.get("veredicto_norma"))
    w("## Claves revisadas contra la norma\n")
    w(f"- Revisadas: {sum(ver.values())}. Clave oficial sostenida: {ver['oficial_sostenida']}; "
      f"alternativa mejor sustentada: {ver['alternativa_mejor_sustentada']}; ambiguas: {ver['ambigua']}.")
    w("- Detalle y fuentes en data/marcas_manuales.json. La web califica siempre con la clave oficial.\n")
    obs = [b for b in banco if b.get("observacion")]
    w(f"## Claves en discusión ({len(obs)})\n")
    w("No se cambió ninguna clave oficial.\n")
    for b in obs:
        w(f"- **{b['id']}** [{b['estado']}]: {b['enunciado'][:110]}… → clave oficial {b['clave']}. {b['observacion']}")
    w("")

    pares = duplicados(banco)
    w(f"## Posibles duplicados entre exámenes ({len(pares)})\n")
    w("Preguntas de años distintos con enunciado ≥70 % parecido. Se mantienen ambas en el banco.\n")
    if pares:
        w("| Pregunta | Parecida a | Similitud | ¿Misma respuesta? |")
        w("|---|---|---|---|")
        for a, b, r, misma in sorted(pares, key=lambda t: -t[2]):
            w(f"| {a['id']} | {b['id']} | {r:.0%} | {'sí' if misma else '**no**'} |")
    w("")

    w("## Exámenes no disponibles\n")
    w("- Ninguno de Medicina 2024-II a 2026-II falta: para 2026-I y 2026-II el MINSA no publicó "
      "un cuadernillo aparte, pero el PDF de claves contiene el examen completo con la respuesta resaltada.")
    return "\n".join(out) + "\n"


def csv_revision(banco):
    buf = io.StringIO()
    wr = csv.writer(buf, delimiter=";")
    wr.writerow(["id", "bloque", "subtema", "tipo", "norma_referencia", "clave",
                 "enunciado", "respuesta_correcta", "estado", "observacion",
                 "bloque_corregido", "subtema_corregido", "ok (s/n)"])
    for b in banco:
        wr.writerow([b["id"], b["bloque"] or "", b["subtema"] or "", b["tipo"] or "",
                     b["norma_referencia"] or "", b["clave"], b["enunciado"],
                     b["opciones"].get(b["clave"], ""), b["estado"], b.get("observacion", ""), "", "", ""])
    return "﻿" + buf.getvalue()  # BOM para que Excel muestre bien las tildes


def main():
    banco = json.load(sys.stdin)
    modo = sys.argv[1] if len(sys.argv) > 1 else "md"
    sys.stdout.write(md(banco) if modo == "md" else csv_revision(banco))


if __name__ == "__main__":
    main()
