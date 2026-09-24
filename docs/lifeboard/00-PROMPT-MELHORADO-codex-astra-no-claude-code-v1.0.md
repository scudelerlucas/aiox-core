# PROMPT MELHORADO — Codex (GPT-6 Astra) dentro do Claude Code para fechar o LifeBoard

> **Encomenda literal (24/09/2026):** *"!melhore — Eu quero conectar o codex aqui no Claude code para ajudar
> no projeto Lifeboard OS que nunca termina usando o ASTRA — !arsenal"*
>
> **Método:** `!melhorar` (PEP v2 por escrito, `Lucas-Contexto-Geral/.claude/skills/melhorar-prompt/SKILL.md`).
> **Arma escolhida pelo `!arsenal`:** `!melhorar` (8,0) + `!atom v2` (9,5) sobre a frase "nunca termina",
> com o RADAR-4Z ligado. `!GARGALO` fica sugerido (⚙): é a arma certa para "por que não fecha".
> **Precedentes:** `Lucas-Contexto-Geral/docs/mirofish/00-PROMPT-MELHORADO-mirofish-no-codex-v1.0.md` (11/09) ·
> `docs/lifeboard/00-PROMPT-MELHORADO-vercel-troca-supabase-500-v1.0.md` (15/09).
> **Classificação:** CRIAR (ligar uma ferramenta) + DECIDIR (o que "terminar" quer dizer). **Nada foi executado.**

---

## §0 — As duas leituras que o pedido escondia

| Nome | Na casa | No mundo |
|---|---|---|
| **ASTRA** | **CASA ASTRA**: a casa central que cuida do selo, da formação e da governança (`docs/casas/ADR-CASAS-canonizacao-FINAL-v1.0.md`). Não tem nenhuma ligação com o LifeBoard, que é marca ALMA PETRA (PRD §1). | **GPT-6 Astra**: modelo da OpenAI, lançado em 03/09/2026 e **padrão do Codex CLI desde 04/09** (nível C). |
| **Codex** | RATIO STUDIORUM CODEX (framework pedagógico) · o Codex que já revisa os PRs do `aiox-core` | **OpenAI Codex**: agente de código (CLI no terminal, nuvem em chatgpt.com/codex) |
| **LifeBoard OS** | `aiox-core/packages/lifeboard`: painel ALMA PETRA que junta agenda, Gmail, Drive, Notas e chats e responde "o que eu faço hoje?" | — |

**Leitura adotada: ASTRA = GPT-6 Astra** (a única que liga as três palavras do pedido). A CASA ASTRA
fica fora do prompt. Se a intenção era "o LifeBoard servir à CASA ASTRA", vira a decisão D1.

---

## §1 — O que o pedido tinha, e o que faltava

| Tinha | Faltava (e por que muda o resultado) |
|---|---|
| "conectar o codex aqui no Claude Code" | **Qual caminho.** Existe o **plugin oficial da OpenAI** `openai/codex-plugin-cc` (nível B), com revisão, revisão adversarial, delegação em segundo plano e uma "trava de revisão". Existem servidores MCP de terceiros (nível C) e um proxy de terceiros que **troca o cérebro do Claude Code** pelo Astra (Eigenwise `model-gateway`, nível C). Só o primeiro é da própria OpenAI e deixa o Claude no comando. |
| "aqui" | **Onde roda.** Medido nesta sessão web (nível A): `api.openai.com` responde 401 (alcançável), **`auth.openai.com` responde 403**, `registry.npmjs.org` 200, Node 22. Então o login pela conta do ChatGPT **não passa** daqui, e a sessão web some quando o contêiner é recolhido. Desde 15/08 o Codex CLI vive **no iMac**. O caminho sem atrito é o **Claude Code no iMac**. |
| "usando o ASTRA" | **Custo.** O plugin usa o limite da conta do ChatGPT. O próprio README avisa que a trava de revisão pode entrar em laço Claude↔Codex e esgotar o limite (nível B). O Astra conta contra o mesmo limite (nível C). |
| "ajudar no projeto que nunca termina" | **O que é "terminar".** Medido no repo (nível A): PRD com **0 de 17 caixas marcadas**; **67 commits em 9 dias** (13–21/09); o painel ainda lê **dados de mentira** (`LIFEBOARD_DATA_MODE=fixture`) e a Vercel aponta para o **banco errado** (`ofskmjpzlgzmnivmkyop` em vez de `hciiilopyivjaekaxfqp`). A frente da COO registra: *"apontar a Vercel para o banco certo e ligar o login Google"*, dono **Lucas**, prazo **28/09**. |
| — | **O achado de RUÍNA (RADAR-4Z).** O LifeBoard não trava por falta de mão para escrever código. Trava em **passos de painel que só o Lucas faz** e em **rodadas de revisão sem fim**: o Codex já revisa os PRs e cada rodada abriu correções novas. Pôr o Codex como mais um revisor (trava de revisão ligada) **alonga** o projeto. Ele só encurta se entrar como **executor com linha de chegada fechada** e a revisão tiver um limite de rodadas. |

---

## §2 — ARQUITETO · o que nasce

1. **Codex ligado ao Claude Code no iMac**: plugin instalado, `/codex:setup` verde, modelo Astra confirmado.
2. **`packages/lifeboard/LINHA-DE-CHEGADA.md`** (novo, ≤1 página): os itens do PRD que definem "v1 no ar",
   cada um marcado **FEITO / FALTA / CORTADO PARA v2**, e o dono de cada FALTA (Lucas × Claude × Codex).
3. **Uma tarefa real entregue pelo Codex** (`/codex:rescue`), a primeira FALTA de código da lista, num PR,
   com o Claude conferindo.
4. **Relatório** em `docs/lifeboard/CODEX-NO-CLAUDE-CODE-relatorio-v1.0.md`: o que funcionou, o custo
   em limite do ChatGPT e quantas rodadas de revisão houve.

**Como se sabe que nasceu:** `/codex:setup` sem erro · o arquivo de linha de chegada existe e soma 17 itens
(nenhum sem status) · um PR com a tarefa do Codex e testes verdes (`tsc --noEmit` + vitest) · o relatório existe.

---

## §3 — ENGENHEIRO · spec (≤15 linhas)

- Rota: Claude (Opus) orquestra e confere; Astra executa via `/codex:rescue`; leitura em massa → subagente Haiku.
- Reuso primeiro: `DEPLOY.md`, `RUNBOOK.md`, `PRD.md`, `docs/ops/PROMPT-CHROME-2026-09-15-lifeboard-vercel-diagnostico.md`, frente da COO v1.3.
- Ordem que não volta atrás: (1) ligar e provar o plugin → (2) linha de chegada → (3) 1 tarefa via Codex → (4) relatório.
- **Trava de revisão desligada.** Revisão com limite: no máximo **2 rodadas** por PR; o que sobrar vira item da v2.
- Login: o próprio Lucas faz `codex login` (cria credencial que dá alcance a um agente = regra `execucao-remota`, exceção).
- Segredos: nenhuma chave no repo nem no chat. Nada de `OPENAI_API_KEY` na sessão web.
- Passos de painel (Vercel, Supabase, Google) continuam do Lucas: o Codex não resolve o gargalo principal.
- `main` protegida: branch da sessão → PR.
- **Falsificador:** se, depois da linha de chegada, os itens FALTA forem quase todos passos de painel do Lucas,
  o Codex não era o que faltava. Aí o relatório diz isso e o foco volta para o passo de 28/09.

---

## §4 — O PROMPT REESCRITO (colar numa sessão nova do Claude Code **no iMac**, pasta `aiox-core`)

```
Contexto: o LifeBoard (aiox-core/packages/lifeboard) é o painel ALMA PETRA que junta agenda, Gmail,
Drive, Notas e chats e responde "o que eu faço hoje?". Tem 0 de 17 caixas do PRD marcadas, 67 commits
em 9 dias, ainda lê dados de mentira (fixture) e a Vercel aponta para o banco Supabase errado.
Quero o Codex da OpenAI (modelo GPT-6 Astra) dentro deste Claude Code, como EXECUTOR, para fechar a v1.

REUSE ANTES
- packages/lifeboard/PRD.md (§3 objetivo, §4 critérios, DoD), DEPLOY.md, RUNBOOK.md
- docs/lifeboard/00-PROMPT-MELHORADO-codex-astra-no-claude-code-v1.0.md (este plano, §1 e §3)
- Lucas-Contexto-Geral/docs/casas/coo/FRENTES-ABERTAS-PARA-A-COO-2026-09-22-v1.3.md (linha LifeBoard)
- docs/ops/PROMPT-CHROME-2026-09-15-lifeboard-vercel-diagnostico.md

ENTREGUE
1. Ligar o Codex: `/plugin marketplace add openai/codex-plugin-cc` → `/plugin install codex@openai-codex`
   → `/reload-plugins` → `/codex:setup`. Se faltar o CLI: `npm install -g @openai/codex`.
   O `codex login` quem faz sou eu (Lucas); pare e me peça. Confirme qual modelo o Codex usa
   (espero o GPT-6 Astra) e escreva o nome exato que o CLI mostrar, sem supor.
2. Escrever packages/lifeboard/LINHA-DE-CHEGADA.md: os 17 itens do PRD, cada um FEITO / FALTA /
   CORTADO PARA v2, com a prova (arquivo, teste, tela) e o dono de cada FALTA (Lucas, Claude ou Codex).
   Proponha os cortes para a v2; eu aprovo antes de seguir.
3. Pegar a primeira FALTA de código cujo dono seja o Codex e delegar com `/codex:rescue`.
   Você confere o resultado: `tsc --noEmit` e vitest do pacote verdes, teste que falha antes e passa depois.
   Abra um PR a partir da branch da sessão.
4. Revisão: no máximo 2 rodadas (`/codex:review` ou `/codex:adversarial-review`). O que sobrar vira item
   da v2 na LINHA-DE-CHEGADA, não uma 3ª rodada.
5. Relatório em docs/lifeboard/CODEX-NO-CLAUDE-CODE-relatorio-v1.0.md.

NÃO FAÇA
- Não ligar a trava de revisão (`--enable-review-gate`): ela entra em laço e gasta o limite.
- Não instalar proxy de terceiros que troca o modelo do Claude Code (ex.: model-gateway).
- Não colar chave, token ou senha no chat nem no repo. Não usar OPENAI_API_KEY em sessão web.
- Não mexer em Vercel, Supabase ou Google: esses passos são meus e têm prazo (28/09).
- Não aplicar migration em produção. Não fazer push para a main.
- Não começar a 2ª tarefa do Codex antes de eu ler o relatório.

PRONTO QUANDO
- `/codex:setup` sem erro e o modelo anotado · LINHA-DE-CHEGADA.md com 17 itens, nenhum sem status ·
  1 PR com a tarefa feita pelo Codex, testes verdes, no máximo 2 rodadas · relatório escrito.

RELATÓRIO FINAL (tabela)
passo | feito? | prova | custo (limite do ChatGPT usado) | rodadas de revisão | o que ficou para mim (Lucas)
+ 1 linha respondendo: "o Codex encurtou o caminho ou o que falta são passos de painel meus?"
```

---

## §5 — Decisões do operador

- **D1 · ASTRA.** A: GPT-6 Astra, o modelo da OpenAI (adotada) · B: CASA ASTRA, o LifeBoard passa a servir à casa central.
- **D2 · Onde ligar.** A: Claude Code no iMac, login pela conta do ChatGPT · B: sessão web com chave de API da OpenAI guardada no ambiente · C: as duas.
- **D3 · Papel do Codex.** A: executor com linha de chegada e no máximo 2 rodadas de revisão · B: revisor permanente com a trava de revisão ligada.
- **D4 · Ordem.** A: primeiro o passo de 28/09 (Vercel no banco certo + login Google), depois o Codex · B: Codex primeiro, em paralelo.

**Recomendação:** D1-A · D2-A · D3-A · D4-A. O gargalo medido é o passo de painel que só o Lucas faz.
O Codex acelera o código que vem depois dele, mas não o substitui.

---

## §6 — Fontes e nível de evidência

| Fato | Fonte | Nível |
|---|---|---|
| Plugin oficial, comandos, requisitos (ChatGPT ou chave de API, Node ≥18.18), aviso da trava de revisão | [github.com/openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc/blob/main/README.md) | B |
| Plugin usa o Codex CLI já instalado na máquina, com as mesmas credenciais | [the-decoder.com](https://the-decoder.com/openai-launches-a-codex-plugin-that-runs-inside-anthropics-claude-code/) | C |
| GPT-6 Astra lançado em 03/09/2026; padrão do Codex CLI desde 04/09 | [artificialanalysis.ai](https://artificialanalysis.ai/articles/benchmarking-gpt-6-astra) · busca web | C |
| Astra consome o mesmo limite da assinatura; proxy que troca o modelo do Claude Code | [eigenwise.io](https://eigenwise.io/writing/using-gpt-6-astra-inside-claude-code-is-the-new-meta) | C |
| Servidores MCP de terceiros para o Codex | [tuannvm/codex-mcp-server](https://github.com/tuannvm/codex-mcp-server) | C |
| `api.openai.com` 401 · `auth.openai.com` 403 · npm 200 · Node 22 (sessão web, 24/09) | `curl` nesta sessão | A |
| PRD 0/17 caixas · 67 commits de 13/09 a 21/09 · `fixture` · banco errado na Vercel | `aiox-core` (git log, PRD.md, DEPLOY.md, memória 15/09) | A |
| Passo "Vercel no banco certo + login Google", dono Lucas, 28/09 | `FRENTES-ABERTAS-PARA-A-COO-2026-09-22-v1.3.md` | A |
| Codex CLI instalado no iMac (decisão de 15/08) | precedente MiroFish×Codex §1 | A (registro), não remedido |
