#!/usr/bin/env bash
# TRAVA DE GASTO DIÁRIO — hook de PreToolUse + UserPromptSubmit.
# Ordem do operador (2026-09-03): "limitar gastos a 5 dólares por dia no máximo".
# Soma o gasto de HOJE (UTC) nos transcripts deste ambiente (bench/claude-code-cost.py)
# e, se >= teto, sai com código 2 — o Claude Code BLOQUEIA a ação e mostra a mensagem.
# Teto: variável CLAUDE_COST_CAP_USD (default 5). Cache de 60s para não pesar em cada tool call.
# Limite conhecido: mede só os transcripts DESTE ambiente (cada sessão web é um ambiente).
set -u
CAP="${CLAUDE_COST_CAP_USD:-5}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${TMPDIR:-/tmp}/claude-cost-cap.$(date -u +%Y-%m-%d).$(id -u)"
now=$(date +%s)
if [ -f "$CACHE" ]; then
  age=$(( now - $(stat -c %Y "$CACHE" 2>/dev/null || echo 0) ))
  if [ "$age" -lt 60 ]; then
    rc=$(head -1 "$CACHE"); msg=$(tail -n +2 "$CACHE")
    [ "$rc" = "2" ] && { echo "$msg" >&2; exit 2; }
    exit 0
  fi
fi
msg=$(python3 "$DIR/claude-code-cost.py" --date "$(date -u +%Y-%m-%d)" --cap "$CAP" --quiet 2>&1); rc=$?
printf '%s\n%s\n' "$rc" "$msg" > "$CACHE"
if [ "$rc" = "2" ]; then echo "$msg" >&2; exit 2; fi
exit 0
