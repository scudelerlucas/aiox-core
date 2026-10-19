#!/usr/bin/env bash
# MERGE REVERSÍVEL — LIGADO para a classe 1 (ordem do Lucas, 14/10/2026: "Eu preciso automatizar todos os
# merges reversíveis. Não quero mais ficar fazendo eles. Automatize agora!! eu aprovo"). Antes: modo
# ensaio (decisão D2-B, 11/10). Com MERGE_REAL=1 a classe 1 que "mergearia" é mergeada de verdade,
# presa ao SHA avaliado; a classe 3 continua só no registro (falta o npm ci + typecheck + test no head).
#
# O que faz: lê os PRs abertos deste repositório e diz, para cada PR de agente ou do Dependabot,
# se ele SERIA mergeado pelas classes reversíveis 1 (só texto) e 3 (Dependabot patch/minor) do
# regente/PLANO-MESTRE.md §5 — e por quê. Sem MERGE_REAL=1 não mergeia nada (o ensaio continua
# disponível rodando sem a variável).
#
# Saída: uma linha JSON por PR avaliado em $SAIDA (padrão: stdout), com
#   {quando, pr, sha, classe, veredito: mergearia|nao_mergearia|fora, motivo}
#
# Uma fonte só para "o que é só texto": a função classificar_arquivos() é lida do
# scripts/regente/fila.sh na hora, não copiada. Se a extração falhar, nada é avaliado (falha
# fechada: sem classificador, nenhum PR "mergearia").
#
# Guardas acrescentadas em 14/10/2026 (9 achados da revisão do PR #1721, aplicados pela emenda D da regra
# codex-corrige-claude-valida por ordem do operador: "faz vc a aprovação, não deixa no codex"):
#   classe 1 só com autor da casa (AUTOR_AGENTE), head no mesmo repositório e base `main`; arquivo
#   renomeado passa pelo classificador nas duas pontas; a lista de revisões que não se lê fecha o portão;
#   threads paginadas; a reserva /ccr/review_threads usa o mesmo filtro de gravidade; a pausa é relida
#   imediatamente antes de cada merge; o desfazer registra o SHA real do merge devolvido pelo GitHub.
#   Teste: scripts/regente/teste-merge-reversivel.sh (gh de mentira; cada guarda falha sem a correção).
#
# 15/10/2026 (D7-A do Lucas): o mesmo arquivo roda nos 13 repositórios. No hub, tudo como antes; num irmão, o
# classificador vem da cópia espelhada, a classe 1 é só docs/** e memoria/**, a base é a branch padrão e a pausa mora
# em .github/merge-reversivel/pausa.json (ou na variável MERGE_AUTONOMO_PAUSADO). Teste: teste-merge-reversivel.sh.
#
# Uso: GH_TOKEN=... REPO=dono/repo bash scripts/regente/merge-reversivel.sh [SAIDA]
set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
REPO="${REPO:-${GITHUB_REPOSITORY:-}}"
[ -n "$REPO" ] || { echo "merge-reversivel: REPO não definido" >&2; exit 2; }
SAIDA="${1:-/dev/stdout}"
AGORA="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# --- o classificador da classe 1 (fonte única: scripts/regente/fila.sh, no hub) --------------------
# Portátil (15/10/2026, D7-A do Lucas: "o robô em todos os repos e nas 4 contas"): no hub a função é lida do
# fila.sh, como sempre. Nos 12 irmãos não há fila.sh: vale a cópia espelhada scripts/regente/classificar-arquivos.sh
# (3º canal do sync-rules), que o teste do hub confere contra o fila.sh. Num irmão a classe 1 é ainda mais estreita:
# só docs/** e memoria/** — um `.md` solto num irmão pode ser instrução lida em tempo de execução.
if [ -f "$RAIZ/scripts/regente/fila.sh" ]; then
  FONTE_CLASSIFICADOR="$RAIZ/scripts/regente/fila.sh"; MODO_REPO="hub"
else
  FONTE_CLASSIFICADOR="$RAIZ/scripts/regente/classificar-arquivos.sh"; MODO_REPO="irmao"
fi
classificador="$(sed -n '/^classificar_arquivos() {/,/^}/p' "$FONTE_CLASSIFICADOR" 2>/dev/null)"
case "$classificador" in
  *'texto_medido="sim"'*'}') eval "$classificador" ;;
  *) echo "merge-reversivel: não consegui ler classificar_arquivos() de $FONTE_CLASSIFICADOR — nada avaliado" >&2; exit 3 ;;
esac

# --- a branch padrão (base): main no hub, master no templo-os-frontend ------------------------------
BASE="${BASE:-}"
[ -n "$BASE" ] || BASE="$(gh api "repos/$REPO" --jq '.default_branch' 2>/dev/null || true)"
# Falha fechada (achado do CodeRabbit no #1814): sem a branch padrão não se assume `main` — no templo-os-frontend (master),
# uma `main` antiga com pausa.json em "false" liberaria o merge com a pausa da branch padrão ligada.
[ -n "$BASE" ] || { echo "merge-reversivel: não consegui ler a branch padrão de $REPO — nada avaliado" >&2; exit 3; }

# --- a pausa, lida da main (só "false" autoriza; qualquer outra coisa é pausa) -------------------
# Lida uma vez para o registro e DE NOVO imediatamente antes de cada merge (guarda 6): a pausa que o
# operador ligar no meio de uma execução vale para o PR seguinte, não só para a execução seguinte.
AUTOR_AGENTE="${AUTOR_AGENTE:-scudelerlucas}"
# Onde a pausa mora: no hub, regente/eventos/agent_state.json (como sempre). Num irmão, .github/merge-reversivel/pausa.json,
# criado uma vez pelo PR de adoção (NÃO é espelhado: o espelho reescreveria a pausa que o Lucas ligou). Arquivo ausente
# = "ilegivel" = pausa (falha fechada). A escolha do arquivo é pela cópia de trabalho (existe fila.sh?), nunca por "o
# primeiro não respondeu". Por cima dos dois, a variável do repositório MERGE_AUTONOMO_PAUSADO (Settings → Variables →
# Actions): qualquer valor que não seja "false" pausa aquele repositório na hora, sem PR.
if [ "$MODO_REPO" = "hub" ]; then ARQ_PAUSA="regente/eventos/agent_state.json"
else ARQ_PAUSA=".github/merge-reversivel/pausa.json"; fi
ler_pausa() {
  local p
  if [ -n "${PAUSA_REPO:-}" ] && [ "${PAUSA_REPO}" != "false" ]; then printf 'variavel:%s' "$PAUSA_REPO"; return; fi
  p="$(gh api "repos/$REPO/contents/$ARQ_PAUSA?ref=$BASE" --jq '.content' 2>/dev/null \
    | base64 -d 2>/dev/null | jq -r '.merge_autonomo_pausado // "ausente"' 2>/dev/null)"
  [ -n "$p" ] || p="ilegivel"
  printf '%s' "$p"
}
pausa="$(ler_pausa)"

linha() { # pr sha classe veredito motivo
  jq -cn --arg q "$AGORA" --argjson pr "$1" --arg sha "$2" --arg c "$3" --arg v "$4" --arg m "$5" --arg p "$pausa" \
    '{quando:$q, pr:$pr, sha:$sha, classe:$c, veredito:$v, motivo:$m, pausa:$p}' >> "$SAIDA"
}

# Checks do head: todos concluídos e sem falha (sucesso, pulado ou neutro). Sem check nenhum = não sei.
checks_verdes() { # sha → 0 verde · 1 não
  local sha="$1" ruins total
  total="$(gh api "repos/$REPO/commits/$sha/check-runs?per_page=100" --jq '.total_count' 2>/dev/null)" || return 1
  [ "${total:-0}" -gt 0 ] || return 1
  ruins="$(gh api "repos/$REPO/commits/$sha/check-runs?per_page=100" \
    --jq '[.check_runs[] | select(.status != "completed" or (.conclusion | IN("success","skipped","neutral") | not))] | length' 2>/dev/null)" || return 1
  [ "$ruins" = "0" ]
}

# Threads de revisão abertas. Na Action: GraphQL. Numa sessão do Claude (GraphQL negado): a rota
# /ccr/review_threads que o próprio proxy oferece. Nenhuma respondeu = "?" = não mergearia.
threads_abertas() { # numero → imprime a contagem das que TRAVAM, ou "?" quando não deu para medir
  # Decisão B do Lucas (14/10): thread de robô marcada P2 ou menor (Codex P2/P3; CodeRabbit
  # Minor/Trivial/Nitpick) não trava PR só de texto. Trava: pessoa, Codex P0/P1, CodeRabbit
  # Major/Critical e robô sem selo reconhecível. Mesmo filtro do fila.sh.
  # Guarda 8: todas as páginas de threads (uma página de 100 só com threads resolvidas escondia a 101ª).
  # Guarda 9: sem GraphQL (sessão do Claude), a reserva /ccr/review_threads passa pelo MESMO filtro.
  # Guarda 10 (Codex P1, PR #1734): a 1ª página vai SEM a variável `a` — `-f a=""` manda cursor vazio,
  #   que o GitHub rejeita (INVALID_CURSOR_ARGUMENTS) e derrubaria toda leitura para a reserva.
  # Guarda 11 (Codex P2, PR #1734): a reserva é normalizada para {autor, corpo} antes do filtro. Medido em
  #   14/10 na rota real: cada thread vem como {resolved, outdated, path, line, comment_ids} — o texto do
  #   comentário é lido por /pulls/comments/<id>. Também aceita a variante inline (is_resolved,
  #   comments[].author como texto) relatada em anthropics/claude-code#56791.
  local dono="${REPO%%/*}" nome="${REPO##*/}" n total=0 cursor="" pagina mais t aberta c id
  local -a args
  # Uma thread {autor, corpo} trava quando NÃO é de robô conhecido, ou quando o corpo NÃO traz selo leve.
  local trava='def trava: ((.autor | test("\\[bot\\]$|^chatgpt-codex-connector$|^coderabbitai$")) | not)
      or ((.corpo | test("P[23] Badge|Minor\\*\\*|Trivial\\*\\*|Nitpick")) | not);'
  while :; do
    args=(-F o="$dono" -F n="$nome" -F p="$1")
    [ -n "$cursor" ] && args+=(-f a="$cursor")
    pagina="$(gh api graphql -f query='query($o:String!,$n:String!,$p:Int!,$a:String){repository(owner:$o,name:$n){pullRequest(number:$p){reviewThreads(first:100,after:$a){pageInfo{hasNextPage endCursor} nodes{isResolved comments(first:1){nodes{author{login} body}}}}}}}' \
      "${args[@]}" --jq '.data.repository.pullRequest.reviewThreads' 2>/dev/null)" || pagina=""
    [ -n "$pagina" ] && jq -e '.nodes' <<< "$pagina" >/dev/null 2>&1 || { total=""; break; }
    n="$(jq -r "$trava"' [.nodes[] | select(.isResolved|not) | .comments.nodes[0] as $c
      | {autor: ($c.author.login // ""), corpo: ($c.body // "")} | select(trava)] | length' <<< "$pagina" 2>/dev/null)"
    [[ "$n" =~ ^[0-9]+$ ]] || { total=""; break; }
    total=$((total + n))
    mais="$(jq -r '.pageInfo.hasNextPage' <<< "$pagina")"
    [ "$mais" = "true" ] || break
    cursor="$(jq -r '.pageInfo.endCursor // ""' <<< "$pagina")"
    [ -n "$cursor" ] || { total=""; break; }
  done
  if ! [[ "$total" =~ ^[0-9]+$ ]]; then
    # reserva: a rota do proxy devolve as threads como lista plana; normaliza, mesmo filtro, falha fechada
    pagina="$(gh api "repos/$REPO/pulls/$1/ccr/review_threads" 2>/dev/null)" || pagina=""
    if [ -n "$pagina" ] && jq -e 'type == "array"' <<< "$pagina" >/dev/null 2>&1; then
      total=0
      while IFS= read -r t; do
        [ -n "$t" ] || continue
        aberta="$(jq -r '((.resolved // .is_resolved // .isResolved // false) | not)' <<< "$t" 2>/dev/null)"
        [ "$aberta" = "true" ] || continue
        if jq -e '(.comments | type == "array") and (.comments | length > 0)' <<< "$t" >/dev/null 2>&1; then
          c="$(jq -c '.comments[0] | {autor: ((.author // .user // "") | if type == "object" then (.login // "") else tostring end),
            corpo: ((.body // "") | tostring)}' <<< "$t" 2>/dev/null)" || c=""
        else
          id="$(jq -r '((.comment_ids // [])[0]) // empty' <<< "$t" 2>/dev/null)"
          c=""
          [ -n "$id" ] && c="$(gh api "repos/$REPO/pulls/comments/$id" --jq '{autor: (.user.login // ""), corpo: (.body // "")}' 2>/dev/null)" || c=""
        fi
        [ -n "$c" ] || { total=""; break; }   # thread aberta sem texto legível = não sei = não mergeio
        n="$(jq -r "$trava"' if trava then 1 else 0 end' <<< "$c" 2>/dev/null)"
        [[ "$n" =~ ^[01]$ ]] || { total=""; break; }
        total=$((total + n))
      done < <(jq -c '.[]' <<< "$pagina" 2>/dev/null)
    else
      total=""
    fi
  fi
  [[ "$total" =~ ^[0-9]+$ ]] && printf '%s' "$total" || printf '?'
}

salto_pequeno() { # de para → 0 pequeno · 1 grande ou ilegível
  local de="${1#v}" para="${2#v}" a1 b1 a2 b2
  a1="${de%%.*}"; a2="${para%%.*}"
  b1="$(printf '%s' "$de" | cut -d. -f2)"; b2="$(printf '%s' "$para" | cut -d. -f2)"
  [[ "$a1" =~ ^[0-9]+$ && "$a2" =~ ^[0-9]+$ && "$b1" =~ ^[0-9]+$ && "$b2" =~ ^[0-9]+$ ]] || return 1
  [ "$a1" = "$a2" ] || return 1
  if [ "$a1" = "0" ]; then [ "$b1" = "$b2" ] || return 1; fi
  return 0
}

# Guarda 12 (14/10, medido): a Action passou a acordar a cada revisão e CI (D15-A) e cada rodada custa ~7 chamadas por
# PR aberto (82 em 14/10 ≈ 570). O token da Action tem 1.000 por hora no repositório: da 2ª rodada na hora em diante, a
# listagem falhava (15 falhas seguidas às 21:5x). Cota baixa → a rodada para limpa e a próxima tenta; leitura ilegível
# (dublê de teste, API fora) não para nada.
restante="$(gh api rate_limit --jq '.resources.core.remaining' 2>/dev/null || true)"
if [[ "$restante" =~ ^[0-9]+$ ]] && [ "$restante" -lt "${COTA_MINIMA:-300}" ]; then
  echo "merge-reversivel: cota do token baixa ($restante chamadas); esta rodada não avalia nada, a próxima tenta"
  exit 0
fi

# Tudo por REST (a lista por GraphQL do `gh pr list` é negada nas sessões do Claude; REST funciona lá e na Action).
# Guarda 7: só PR cuja base é a branch padrão do repositório — a pausa e a autorização valem para ela, não para outra branch.
erro_lista="$(mktemp)"
prs="$(gh api "repos/$REPO/pulls?state=open&base=$BASE&per_page=100" --paginate \
  --jq '.[] | select(.base.ref == "'"$BASE"'") | {number, draft, head_ref: .head.ref, sha: .head.sha, autor: .user.login, head_repo: (.head.repo.full_name // ""), base_ref: .base.ref}' 2>"$erro_lista")" \
  || { echo "merge-reversivel: não consegui listar os PRs abertos: $(head -c 300 "$erro_lista")" >&2; exit 4; }

printf '%s\n' "$prs" | jq -c '.' | while IFS= read -r pr; do
  num="$(jq -r .number <<< "$pr")"; sha="$(jq -r .sha <<< "$pr")"
  branch="$(jq -r .head_ref <<< "$pr")"; autor="$(jq -r .autor <<< "$pr")"
  rascunho="$(jq -r .draft <<< "$pr")"
  head_repo="$(jq -r .head_repo <<< "$pr")"; base_ref="$(jq -r .base_ref <<< "$pr")"

  case "$autor:$branch" in
    dependabot\[bot\]:*) [ "$MODO_REPO" = "hub" ] || continue; classe="3" ;;   # classe 3 só no hub (PLANO-MESTRE §5)
    *:claude/*|*:codex/*|*:chatgpt/*) classe="1" ;;
    *) continue ;;   # PR de pessoa: nenhuma classe cobre; nem entra no registro
  esac
  # Guarda 1 (P1): o prefixo da branch não prova nada — qualquer pessoa pode dar esse nome a uma branch
  # num fork. Classe 1 exige o autor da casa, head neste repositório e base main (PLANO-MESTRE §5, item 4).
  if [ "$classe" = "1" ]; then
    [ "$autor" = "$AUTOR_AGENTE" ] || { linha "$num" "$sha" 1 fora "autor $autor não é o agente da casa ($AUTOR_AGENTE)"; continue; }
    [ "$head_repo" = "$REPO" ] || { linha "$num" "$sha" 1 fora "head em outro repositório (${head_repo:-?})"; continue; }
  fi
  [ "$base_ref" = "$BASE" ] || { linha "$num" "$sha" "$classe" fora "base ${base_ref:-?} (só $BASE)"; continue; }
  # Guarda 12b: rascunho nunca se mergeia — sai antes de gastar as chamadas por PR (cota do token).
  [ "$rascunho" = "false" ] || { linha "$num" "$sha" "$classe" nao_mergearia "rascunho"; continue; }

  # Guarda 2 (P1): arquivo renomeado passa pelo classificador nas DUAS pontas — mover
  # .claude/rules/x.md para docs/x.md é mexer em .claude/, não em docs/.
  arquivos="$(gh api "repos/$REPO/pulls/$num/files?per_page=100" --paginate --jq '.[] | .filename, (.previous_filename // empty)' 2>/dev/null)" \
    || { linha "$num" "$sha" "$classe" nao_mergearia "não consegui ler os arquivos do PR"; continue; }

  if [ "$classe" = "1" ]; then
    classificar_arquivos "$arquivos"
    [ "$texto_medido" = "sim" ] || { linha "$num" "$sha" 1 fora "toca arquivo fora de só-texto"; continue; }
    if [ "$MODO_REPO" = "irmao" ] && printf '%s\n' "$arquivos" | grep -v '^$' | grep -qvE '^(docs|memoria)/'; then
      linha "$num" "$sha" 1 fora "num irmão, a classe 1 é só docs/** e memoria/**"; continue
    fi
    if gh api "repos/$REPO/pulls/$num" -H 'Accept: application/vnd.github.diff' 2>/dev/null | grep -q '^[-+].*"merge_autonomo_pausado"'; then
      linha "$num" "$sha" 1 fora "muda a chave da pausa (só o Lucas)"; continue
    fi
  else
    fora_pkg="$(printf '%s\n' "$arquivos" | grep -vxE 'package\.json|package-lock\.json' | grep -c . || true)"
    [ "$fora_pkg" = "0" ] || { linha "$num" "$sha" 3 fora "toca arquivo além de package.json e package-lock.json"; continue; }
    corpo="$(gh api "repos/$REPO/pulls/$num" --jq '.title + "\n" + (.body // "")' 2>/dev/null)"
    saltos="$(printf '%s' "$corpo" | grep -oE 'from `?v?[0-9]+\.[0-9]+(\.[0-9]+)?[^ `]*`? to `?v?[0-9]+\.[0-9]+(\.[0-9]+)?' \
      | sed -E 's/[`]//g; s/^from //' | sort -u)"
    [ -n "$saltos" ] || { linha "$num" "$sha" 3 nao_mergearia "não consegui ler as versões no PR"; continue; }
    grande=""
    while IFS= read -r s; do
      de="${s%% to *}"; para="${s##* to }"
      salto_pequeno "$de" "$para" || grande="$s"
    done <<< "$saltos"
    [ -z "$grande" ] || { linha "$num" "$sha" 3 fora "salto major (ou minor em 0.x): $grande"; continue; }
  fi

  [ "$rascunho" = "false" ] || { linha "$num" "$sha" "$classe" nao_mergearia "rascunho"; continue; }
  # Estado de merge do GitHub, pedido por PR (a listagem não o calcula). "clean" = sem conflito e
  # sem bloqueio da proteção da main (checks exigidos e revisões); qualquer outro valor = não.
  estado="$(gh api "repos/$REPO/pulls/$num" --jq '.mergeable_state // "unknown"' 2>/dev/null)"
  [ "$estado" = "clean" ] || { linha "$num" "$sha" "$classe" nao_mergearia "GitHub diz ${estado:-?} (precisa clean)"; continue; }
  # Última revisão de cada revisor: um pedido de mudança ainda de pé bloqueia, venha de robô ou de pessoa.
  # Guarda 5: lista de revisões que não se lê (API fora, permissão) fecha o portão — antes virava "0 pedidos".
  revisoes="$(gh api "repos/$REPO/pulls/$num/reviews?per_page=100" --paginate \
    --jq '.[] | select(.state != "COMMENTED") | [.user.login, .state] | @tsv' 2>/dev/null)" \
    || { linha "$num" "$sha" "$classe" nao_mergearia "não consegui ler as revisões do PR"; continue; }
  pedidos="$(printf '%s\n' "$revisoes" | awk -F'\t' 'NF>=2 {u[$1]=$2} END {n=0; for (k in u) if (u[k]=="CHANGES_REQUESTED") n++; print n}')"
  [ "${pedidos:-1}" = "0" ] || { linha "$num" "$sha" "$classe" nao_mergearia "pedido de mudança aberto"; continue; }
  checks_verdes "$sha" || { linha "$num" "$sha" "$classe" nao_mergearia "checks do head não estão todos verdes"; continue; }
  abertas="$(threads_abertas "$num")"
  [ "$abertas" = "0" ] || { linha "$num" "$sha" "$classe" nao_mergearia "threads abertas: $abertas"; continue; }
  [ "$pausa" = "false" ] || { linha "$num" "$sha" "$classe" nao_mergearia "pausa ligada ($pausa)"; continue; }

  if [ "$classe" = "3" ]; then
    linha "$num" "$sha" 3 mergearia "patch/minor, CI verde — na ligação, falta rodar npm ci + npm run typecheck + npm run test no head"
  else
    if [ "${MERGE_REAL:-0}" = "1" ]; then
      # Guarda 6: a pausa é relida agora, não no começo da execução.
      pausa="$(ler_pausa)"
      [ "$pausa" = "false" ] || { linha "$num" "$sha" 1 nao_mergearia "pausa ligada ($pausa) — relida antes do merge"; continue; }
      titulo="$(gh api "repos/$REPO/pulls/$num" --jq '.title' 2>/dev/null)"
      if resposta="$(gh api -X PUT "repos/$REPO/pulls/$num/merge" -f merge_method=merge -f sha="$sha" \
            -f commit_title="[classe 1] ${titulo:-PR #$num} (#$num)" 2>&1)"; then
        # Guarda 4: o desfazer leva o SHA do merge que o GitHub devolveu, não um espaço em branco.
        merge_sha="$(printf '%s' "$resposta" | jq -r '.sha // empty' 2>/dev/null)"
        linha "$num" "$sha" 1 mergeado "só texto, CLEAN, checks verdes, 0 threads que travam, pausa desligada — desfazer: git revert -m 1 ${merge_sha:-<sha não devolvido>}"
      else
        linha "$num" "$sha" 1 merge_falhou "GitHub recusou: $(printf '%s' "$resposta" | tr '\n' ' ' | cut -c1-160)"
      fi
    else
      linha "$num" "$sha" 1 mergearia "só texto, CLEAN, checks verdes, 0 threads que travam, pausa desligada"
    fi
  fi
done
