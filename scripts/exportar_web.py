"""Convierte data/preguntas.json en web/preguntas.js (lo que lee la web).

Uso:  python exportar_web.py < data/preguntas.json > web/preguntas.js

Se usa un .js (y no un .json) para que la web funcione también abriendo
index.html con doble clic, sin servidor.
"""
import json
import sys

CAMPOS = ["id", "proceso", "numero", "enunciado", "opciones", "clave", "bloque", "subtema",
          "tipo", "norma_referencia", "estado", "observacion", "clave_sugerida", "sustento",
          "sustento_url", "veredicto_norma", "fuente_url", "pagina_pdf"]

banco = json.load(sys.stdin)
salida = [{k: p[k] for k in CAMPOS if p.get(k) not in (None, "")} for p in banco]
sys.stdout.write("/* Generado por scripts/exportar_web.py a partir de data/preguntas.json. No editar a mano. */\n")
sys.stdout.write("window.BANCO = ")
json.dump(salida, sys.stdout, ensure_ascii=False, separators=(",", ":"))
sys.stdout.write(";\n")
