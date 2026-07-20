# Varredura Web — Redução Drástica de Custos de Token (Claude Code + Claude App)

> Pesquisa: 2026-07-20 · Método: varredura web (docs oficiais Anthropic + comunidade) ·
> Tese: **assimetria** (pagar centavos onde antes se pagava dólares) e **complexidade**
> (rotear só o difícil para modelo caro). Complementa ATOM-01/07/08 já implantados.

---

## 0. Sumário executivo

As 6 alavancas com maior alavancagem assimétrica, em ordem de impacto composto:

| # | Alavanca | Desconto | Esforço |
|---|----------|----------|---------|
| 1 | Prompt caching (leituras a 0,10× do preço de input) | até −90% input | zero (automático no Claude Code; no app, via Projects) |
| 2 | Roteamento de modelo 70/20/10 (Haiku/Sonnet/Opus) | −40 a −70% médio | baixo (já é política ATOM) |
| 3 | Batch API para trabalho assíncrono | −50% flat | médio (só API/SDK) |
| 4 | Dieta de contexto (CLAUDE.md ≤200 linhas, MCP→CLI, skills on-demand) | −30 a −60% input/turno | baixo |
| 5 | Effort/thinking control (`/effort` low, `MAX_THINKING_TOKENS`) | dezenas de milhares de tokens de output/req | zero |
| 6 | Subagentes para trabalho verboso (contexto descartável) | contexto principal não incha | zero (já é política ATOM) |

**Empilhamento:** cache (0,10×) + batch (0,5×) + Haiku em vez de Opus ≈ **custo efetivo de ~5% do preço de tabela do Opus** para trabalho roteável. Essa é a assimetria máxima documentada.

Preços de referência (por MTok, in/out): Haiku 4.5 ≈ $1/$5 · Sonnet ≈ $3/$15 · Opus ≈ $5/$25.

---

## 1. Assimetria de preço (API / SDK / automações)

### 1.1 Prompt caching
- Escrita de cache: 1,25× (TTL 5 min) ou 2,0× (TTL 1 h). Leitura: **0,10×** — desconto de 90%; break-even em ~1,4 leituras.
- Ordem do prefixo estável: tools → system → contexto fixo → breakpoint `cache_control`; conteúdo dinâmico sempre por último.
- Claude Code já cacheia o prefixo automaticamente — em sessão longa, a maior parte do input vira cache read (~−80% na fatura de input).
- TTL 1 h vale a pena para automações com intervalos > 5 min entre chamadas (crons, pipelines de conteúdo).

### 1.2 Batch API (Message Batches)
- **50% de desconto em input E output**, todos os modelos. Até 100k requests por batch, processamento em até 24 h.
- Uso ideal no ecossistema: geração de cartas SHAKESPEARMOZI em lote, auditoria REVISOR, classificação TRIAGEM retroativa, embeddings/extrações do Canon Forge — tudo que não precisa de resposta em tempo real.
- **Empilha com caching** → até 95%+ de redução em cargas repetitivas.

### 1.3 Roteamento por complexidade (padrão 70/20/10)
- 60–80% das requisições de um agente de código são rotineiras. Rotear 70% para Haiku, 20% para Sonnet, 10% para Opus derruba a média ponderada em 40–70%.
- Effort é alavanca melhor que troca de modelo em muitos casos: Opus com `effort: low` para tarefa direta, `high` só no difícil.
- Já formalizado em `.claude/rules/model-routing.md` (ATOM-01) — a novidade da varredura é o **número-alvo**: perseguir a distribuição 70/20/10 medível, não só a rubrica qualitativa.

### 1.4 Thinking / effort
- Thinking é cobrado como output; orçamento default pode ser dezenas de milhares de tokens por request.
- Controles: `/effort` (low/medium/high), desligar thinking em `/config`, `MAX_THINKING_TOKENS=8000` para modelos de budget fixo.

---

## 2. Claude Code — dieta de contexto (input recorrente é imposto por turno)

1. **CLAUDE.md ≤ 200 linhas / 300–600 tokens.** Cada token do CLAUDE.md é pago em TODO turno de TODA sessão. Instruções de workflow específico (PR review, migrations, protocolos de agente) devem migrar para **skills** (carregam on-demand).
2. **MCP → CLI.** MCPs podem consumir 66k+ tokens antes da primeira mensagem. Preferir `gh`, `aws`, `supabase` CLI etc. via Bash (zero overhead de schema). Desativar servidores não usados em `/mcp`. Tool-search/deferred tools (já padrão) mitiga, mas o melhor MCP é o que não está conectado.
3. **`/context` e `/usage`** para ver onde os tokens estão indo (system prompt, tools, memória, skills, histórico). `/usage` agora atribui % a skills, subagentes, plugins e MCPs individualmente.
4. **`/clear` entre tarefas não relacionadas** (contexto morto é imposto recorrente); `/compact` com instrução custom a ~60% de contexto, não a 90%.
5. **Hooks de pré-processamento:** PreToolUse que filtra output de teste/log para só falhas (10.000 linhas → centenas de tokens). Exemplo oficial na doc de costs.
6. **Subagentes para trabalho verboso** (testes, docs, logs): o contexto deles morre com eles; só o resumo volta. Atenção ao custo oculto: subagente nasce frio, sem o cache do pai — usar para volume grande, não para tarefa trivial.
7. **Plan mode antes de implementação complexa** — evita retrabalho caro (o retrabalho é o maior desperdício de tokens que existe).
8. **Prompts específicos** ("adicionar validação em auth.ts:login") em vez de vagos ("melhorar o código") — evita varredura ampla de arquivos.
9. **Plugins de code intelligence** para linguagem tipada: "go to definition" substitui grep + leitura de N arquivos candidatos.
10. **Agent teams**: ~7× mais tokens que sessão normal — usar Sonnet nos teammates, times pequenos, desligar teammate ocioso.

---

## 3. Claude app (claude.ai) — esticar as janelas de 5 h / semanal

1. **Projects como cache:** documentos no project knowledge são cacheados; referências subsequentes só pagam o delta. Subir os docs canônicos (TNF/TGM/CHC etc.) uma vez no Project em vez de colar em cada conversa.
2. **Agrupar perguntas relacionadas numa única mensagem** — cada mensagem repaga o histórico inteiro da conversa.
3. **Conversas curtas + handoff:** conversa longa repaga todo o histórico a cada turno. Ao trocar de assunto, abrir chat novo com um parágrafo de handoff (objetivo, decisões, estado, restrições).
4. **A janela é compartilhada** entre claude.ai, Claude Code e Cowork — gastar o app em chat pesado consome a mesma cota do Code. Rotear trabalho pesado de arquivo para o Code (que cacheia melhor) e conversa leve para o app.
5. **Modelo no app:** usar Sonnet como padrão do app também; Opus/Fable no app queima a janela muito mais rápido.

---

## 4. Plano vs API — onde cada dólar rende mais

- Break-even: Max 5x ($100) ≈ $3,33/dia de API; Max 20x ($200) ≈ $6,67/dia. Abaixo disso, API pura é mais barata.
- **Estratégia híbrida vencedora:** assinatura Max para desenvolvimento interativo diário (custo fixo) + API key para automação/CI/batch (sem competir com a janela interativa, com desconto de batch).
- Uso não-interativo (`claude -p`, Agent SDK, GitHub Actions) tira de um pool mensal separado ($100 no Max 5x, $200 no 20x) — automações não canibalizam a janela de 5 h.
- `/usage-credits` para teto de gasto mensal explícito.

---

## 5. Diagnóstico aplicado ao setup Lucas/Pandora (a assimetria começa em casa)

Achados da própria configuração atual, em ordem de impacto:

1. **CLAUDE.md gigantes e duplicados.** `Lucas-Contexto-Geral/CLAUDE.md` (frameworks + MMOS + 2 protocolos de resposta) + `.claude/CLAUDE.md` (que descreve o quiz-diagnosys, repo errado) somam milhares de tokens carregados em todo turno. O registro de frameworks e o protocolo MMOS são conteúdo de **skill/Project knowledge**, não de CLAUDE.md. Meta: cada CLAUDE.md ≤ 200 linhas; o resto vira skill on-demand.
2. **Três versões concorrentes do protocolo de resposta** (rodapé obrigatório) espalhadas pelos repos, com 3–4 blocos cada. Cada resposta paga 200–400 tokens de output de rodapé. Consolidar numa única versão curta (1 arquivo, 1 formato) já paga dividendo em toda resposta para sempre.
3. **Skills "sempre ativas" (maestro: "primeira e única skill lida em TODO prompt"; forja: "falso positivo é preferível").** Skill sempre-ativa é CLAUDE.md disfarçado — imposto por prompt. Restringir triggers ao que realmente precisa.
4. **Frota de MCPs conectados** (ClickUp ~60 tools, vidIQ ~50, Gamma, Notion, Apify…). Mesmo com deferred loading, cada servidor adiciona nomes ao contexto e induz tool-search. Desconectar da sessão default o que não é usado semanalmente; reconectar sob demanda.
5. **Batch API inexplorada** para as cargas em lote do ecossistema (cartas do quiz, auditorias, geração de docs canônicos) — 50% de desconto imediato onde hoje se paga preço cheio síncrono.
6. **Distribuição 70/20/10 não medida.** A política ATOM existe; falta o medidor. Registrar % de chamadas por modelo (OpenTelemetry ou `/usage`) e corrigir o desvio.

---

## Fontes

- [Manage costs effectively — Claude Code Docs](https://code.claude.com/docs/en/costs) (oficial)
- [Prompt caching — Claude Platform Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) (oficial)
- [Usage limit best practices — Claude Help Center](https://support.claude.com/en/articles/9797557-usage-limit-best-practices) (oficial)
- [How do usage and length limits work — Claude Help Center](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work) (oficial)
- [Claude Code Token Optimization: 19 Changes (buildtolaunch)](https://buildtolaunch.substack.com/p/claude-code-token-optimization)
- [Reduce Claude Code Token Usage: 8 Proven Ways (StationX)](https://app.stationx.net/articles/reduce-claude-code-token-usage)
- [Claude Code Token Optimization 2026 (ofox.ai)](https://ofox.ai/blog/claude-code-token-optimization-2026/)
- [Claude Code Sub-Agents: The Hidden Token Cost (extraheadroom)](https://extraheadroom.com/blog/claude-code-subagents-token-costs)
- [How to cut Claude API costs by up to 95% (Amit Kothari)](https://amitkoth.com/reduce-claude-api-costs/)
- [Claude Opus vs Sonnet vs Haiku: Model Routing Guide (duet.so)](https://duet.so/guides/claude-opus-vs-sonnet-model-routing)
- [Claude Code Max Plan vs API Cost: Break-Even Guide (buildthisnow)](https://www.buildthisnow.com/blog/guide/development/claude-code-max-plan-vs-api)
- [Claude Code Usage Limits Playbook 2026 (Developers Digest)](https://www.developersdigest.tech/blog/claude-code-usage-limits-playbook-2026)
- [Anthropic Message Batches API: 50% Off (Respan)](https://www.respan.ai/articles/anthropic-message-batches-api)
- [Anthropic API Pricing 2026 (finout.io)](https://www.finout.io/blog/anthropic-api-pricing)
- [Optimising MCP Server Context Usage (Scott Spence)](https://scottspence.com/posts/optimising-mcp-server-context-usage-in-claude-code)
- [Claude Code Context Window (claudefa.st)](https://claudefa.st/blog/guide/mechanics/context-management)
- [Claude Limits: 7 Ways to Make the 5-Hour Window Last (T-Minus AI)](https://www.tminusai.com/blog/claude-usage-limit-reached)
