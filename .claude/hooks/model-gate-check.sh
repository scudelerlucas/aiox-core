#!/usr/bin/env bash
# MODEL-GATE — hook de UserPromptSubmit.
#
# POR QUE ESTE ARQUIVO EXISTE (2026-08-21): a skill `model-gate` manda ser consultada
# "sempre que aparecer um comando de modo (!estressar, !atom, ...)". Mas skill NÃO dispara
# sozinha — ela só carrega quando alguém a invoca. Numa sessão de 2026-08-19 o operador
# mandou quatro comandos `!` (!atom v2, !estressar, !PRT, !elenchos) e o gate não rodou.
# Não houve dano (a sessão estava no tier certo), mas é exatamente o falsificador F-MG1
# que a própria skill nomeia: "output T3 entregue sem o gate ter rodado".
#
# A correção é de mecanismo, não de disciplina: detecção por string num hook determinístico,
# como a própria skill §2 exige ("detecção por string, não por juízo").
#
# Recebe JSON no stdin com o campo .prompt. O que este script imprime em stdout entra
# no contexto do turno. Nunca bloqueia (exit 0 sempre) — o gate informa, quem decide é o agente.

set -uo pipefail

payload="$(cat)"

# extrai .prompt sem depender de jq
prompt="$(printf '%s' "$payload" | python3 -c '
import sys, json
try:
    print(json.load(sys.stdin).get("prompt", ""))
except Exception:
    pass
' 2>/dev/null || true)"

[ -z "$prompt" ] && exit 0

lower="$(printf '%s' "$prompt" | tr "[:upper:]" "[:lower:]")"
hits=""

# §2 da skill — gatilhos determinísticos de T3
case "$lower" in
  *"!atom"*|*"!estressar"*|*"!decidir"*|*"!validar"*|*"!forjar"*|*"!elenchos"*|*"!prt"*|*"!pcs"*|*"!dps"*|*"!pentar"*|*"!comprimir"*|*"!gargalo"*|*"!compasso"*|*"!lastro"*)
    hits="${hits}comando-de-modo " ;;
esac
case "$lower" in
  *"adr"*|*"documento canônico"*|*"doc canônico"*|*"canoniz"*|*" io "*|*"mapa canônico"*)
    hits="${hits}doc-canônico " ;;
esac
case "$lower" in
  *"auditor"*|*"auditar"*|*"stress test"*|*"red team"*|*"go/no-go"*|*"go no go"*)
    hits="${hits}auditoria/stress " ;;
esac
case "$lower" in
  *"arquitetura"*|*"framework"*|*"protocolo"*|*"skill nova"*|*"criar skill"*)
    hits="${hits}arquitetura " ;;
esac
case "$lower" in
  *"sociedade"*|*"contrato"*|*"precifica"*|*"parceria"*|*"joint venture"*)
    hits="${hits}decisão-estratégica " ;;
esac

[ -z "$hits" ] && exit 0

cat <<EOF
[MODEL-GATE] Gatilho T3 detectado neste prompt: ${hits}
Tier necessário: T3 (modelo topo vigente). Protocolo da skill \`model-gate\` §3:
- Se a sessão está em T3 → executar normalmente e registrar a linha [MG: ok · <gatilho> · T3].
- Se está abaixo do tier → NÃO produzir o output substantivo; responder em ≤3 linhas pedindo
  a troca de modelo, salvo se o operador reenviou o mesmo pedido sem trocar (consentimento
  implícito = force, executar com nota de 1 linha).
Nunca sugerir downgrade no meio da sessão. Este aviso é informativo — não bloqueia.
EOF
exit 0
