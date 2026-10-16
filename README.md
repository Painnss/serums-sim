# SERUMS Sim – Medicina Humana

Banco de preguntas **oficiales** del examen SERUMS (MINSA) con simulacros, para estudiar.

## Cómo abrir la web

Haz doble clic en `web/index.html`. No necesita internet ni instalar nada.
Tu progreso se guarda en el navegador que uses.

## Qué hay en cada carpeta

| Carpeta / archivo | Qué es |
|---|---|
| `fuentes/` | PDFs oficiales descargados de gob.pe (cuadernillos, claves y temario) |
| `data/preguntas.json` | El banco: 500 preguntas de 2024-II, 2025-I, 2025-II, 2026-I y 2026-II |
| `data/revision.csv` | Para revisar la clasificación en Excel |
| `data/reporte_control.md` | Conteos, claves en discusión y duplicados |
| `data/marcas_manuales.json` | Claves revisadas contra la norma (sustento, clave sugerida). Aquí se agregan marcas nuevas a mano |
| `data/comparacion_solucionarios.md` | Comparación con solucionarios de academias |
| `web/` | La web (Fase 2) |
| `scripts/` | Programas que generan todo |
| `texto/` | Material intermedio: textos extraídos, normas descargadas, clasificación hecha con IA. **Solo está en la PC**: no se sube a GitHub porque incluye material de terceros |

## Rehacer todo después de un cambio

Hace falta tener Git Bash. Desde esta carpeta:

```bash
bash scripts/correr_fase1.sh
```

Este comando regenera `data/` y `web/preguntas.js`.

## Reglas del banco

- La **clave oficial del MINSA nunca se cambia**: la web califica siempre con ella.
- Si la norma respalda otra alternativa, se muestra aparte como "clave sugerida", con su fuente.
- El bloque, el subtema y la norma probable de cada pregunta los propuso la IA y pueden revisarse en `revision.csv`.
