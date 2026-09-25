# Tarefa Codex 00 — uma revisão adversarial única em P4, P5 e P6, e depois o Lucas decide

> Nasceu em 25/09/2026 da passagem de bastão
> `Lucas-Contexto-Geral/docs/ops/LIFEBOARD-GAUNTLET-PASSAGEM-2026-09-25.md` (conta `lucasscudeler@`, que
> bateu o limite semanal). Vem **antes** da Tarefa 01: os três PRs tocam o grafo, a linha do tempo, a página da
> tarefa e as fixtures que a 01 vai usar. Roda no **iMac**, via `/codex:adversarial-review`, **uma rodada por PR**.

## O que está aberto (medido 25/09, 19h UTC)

| PR | Peça | Linhas | Rodadas já feitas | Estado no GitHub | O gauntlet pedia |
|---|---|---|---|---|---|
| [#44](https://github.com/scudelerlucas/aiox-core/pull/44) | P4 grafo (arestas por camada, caminho crítico, guarda no Chromium) | +12.032 | 9 correções + 17 rodadas de revisor | aberto, `main` dentro, **uma verificação pendente** | revisor independente, rodada 17 |
| [#45](https://github.com/scudelerlucas/aiox-core/pull/45) | P5 linha do tempo (Gantt) | +11.083 | 21 correções | aberto, limpo | conferência do coordenador da correção 21 |
| [#43](https://github.com/scudelerlucas/aiox-core/pull/43) | P6 página da tarefa | +19.077 | 24 correções | aberto, limpo | terminar a conferência da correção 24 (sabotagem FT1 nunca entrou no arquivo) |
| #42 | P7 fila de prompts | mergeado 24/09 | 15 correções + 25 rodadas do Codex | na `main` | revisor rodada 16 |

**O padrão que a passagem registra sem nomear:** uma sessão só, aberta em 12/09, custou **US$ 9.775,80** e
nenhuma das três peças chegou ao merge. É o "nunca termina" do pedido original, e é o que a decisão D3-A de
24/09 (executor com linha de chegada, ≤2 rodadas) existe para cortar.

## O que entregar

Para **cada** um dos três PRs, nesta ordem — #45, #43, #44 (do mais limpo ao que tem verificação pendente):

1. `/codex:adversarial-review` sobre a **cabeça atual da branch**, com este foco declarado:
   - P5 (#45): a correção 21 fecha a **classe** "volta depois de ausência" ou só o caso de 1 hora? Um estímulo
     diferente (foco da janela, rede voltando) ainda derruba o Tab?
   - P6 (#43): aplicar a sabotagem **FT1** de verdade (`src/components/task/notas-painel.tsx`, roteiro em
     `Lucas-Contexto-Geral/docs/ops/lifeboard-gauntlet-passagem-2026-09-25/p6-estrago-FT1.mjs`), conferir com
     `grep` que está no arquivo, rodar a guarda `tests/navegador/guarda-p6.mjs`. Guarda verde com FT1 dentro =
     reprovado. Depois, uma sabotagem no desfecho de **sucesso**, não só de falha.
   - P4 (#44): revisar o `fd2b91b` (cabeça, já com a `main`); nomear qual verificação está pendente e por quê.
2. Veredito por PR, uma linha, no formato do gauntlet: `VEREDITO: aprovado` ou
   `VEREDITO: reprovado — <n> CRÍTICO, <n> ALTO, <n> MÉDIO`, dizendo qual das **cinco formas viciadas de
   guarda** apareceu, se apareceu (conta a si mesma · aprova sem ver · mede só o nome · mede um instante ·
   confere o caso, não a classe).
3. **Uma** rodada de correção por PR, só para CRÍTICO e ALTO. MÉDIO vira lista na `LINHA-DE-CHEGADA.md` (v2).
4. Relatório de 1 página em `docs/lifeboard/CODEX-00-relatorio.md`: tabela PR × veredito × custo do limite ×
   o que ficou para o Lucas.

## NÃO FAÇA

- Não abrir 2ª rodada de correção em nenhum PR. Reprovou de novo → o Lucas decide: mergeia com a lista de
  pendências, ou fecha a peça e ela vira item da v2.
- Não reescrever histórico das branches (há commits com nome de modelo no rodapé; só o operador manda limpar).
- Não subir mais de **um** Chromium por vez: cada guarda sobe um servidor próprio.
- Não tocar em Vercel, Supabase de produção, nem aplicar migration.
- Não começar a Tarefa 01 antes de o Lucas ter decidido o destino dos três PRs.

## PRONTO QUANDO

- Três vereditos escritos, ≤1 rodada de correção cada, relatório no repo, e o Lucas com uma decisão por PR:
  **mergear / mergear com pendências listadas / fechar**.
