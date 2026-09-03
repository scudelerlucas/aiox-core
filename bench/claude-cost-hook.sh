#!/usr/bin/env bash
# Stop hook — calcula o gasto de HOJE (local, sem rede: sessões sandboxed do Claude
# Code na web têm saída de rede restrita por política, então nenhum script de shell
# consegue publicar direto no Supabase). Este hook só IMPRIME o resumo; quem publica
# no dashboard vivo é o próprio agente, via ferramenta MCP do Supabase (upsert em
# claude_code_costs) — regra permanente em CLAUDE.md §"Dashboard de custo".
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$SCRIPT_DIR/claude-code-cost.py" --date "$(date -u +%Y-%m-%d)" 2>/dev/null | tail -6 || true
