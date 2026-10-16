#!/usr/bin/env bash
# Rehace toda la Fase 1 a partir de los PDFs que están en fuentes/.
# Uso (desde la carpeta del proyecto, en Git Bash):  bash scripts/correr_fase1.sh
#
# Nota: el Python de la tienda de Windows no puede abrir archivos de esta
# carpeta por ruta, por eso los PDFs y scripts se le pasan "por tubería".
set -e
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8
PY="python -P -E -X utf8"
mkdir -p texto/json data

for f in fuentes/*claves*.pdf; do
  b=$(basename "$f" .pdf)
  $PY -c "$(cat scripts/extraer_pdf.py)" < "$f" > "texto/json/$b.json"
done

{
  for f in texto/json/*.json; do echo "### $(basename "$f" .json)"; cat "$f"; echo; done
  # Clasificación por bloque/subtema (una por examen, hecha con IA)
  for f in texto/clasif/*.json; do
    [ -f "$f" ] || continue
    echo "### clasif_$(basename "$f" .json)"; tr -d '\n\r' < "$f"; echo
  done
  # Marcas manuales (estado / observación) que no se pierden al regenerar
  if [ -f data/marcas_manuales.json ]; then
    echo "### marcas"; tr -d '\n\r' < data/marcas_manuales.json; echo
  fi
} | $PY -c "$(cat scripts/armar_banco.py)" > data/preguntas.json

$PY -c "$(cat scripts/reporte.py)" md  < data/preguntas.json > data/reporte_control.md
$PY -c "$(cat scripts/reporte.py)" csv < data/preguntas.json > data/revision.csv
$PY -c "$(cat scripts/exportar_web.py)" < data/preguntas.json > web/preguntas.js
echo "Listo: data/preguntas.json, data/revision.csv, data/reporte_control.md y web/preguntas.js"
