# LifeBoard — versões e fosso (regra `versionamento-fosso-publico`, 1ª aplicação, 02/10/2026)

> **Classe declarada pelo operador em 02/10/2026 (decisão 3-B): Vantagem** — ferramenta que dá à casa tempo e visão que o
> mercado não tem; a versão pública anda **1 a 2 versões maiores atrás** da interna, e o preço é de assinatura, nunca grátis.
> Reavaliar a classe quando aparecer o 1º pagante ou o 1º concorrente. Regra (no hub):
> `Lucas-Contexto-Geral/.claude/rules/versionamento-fosso-publico.md`.

## Versão interna hoje

**vI 1.x** — v1 aprovada pelo Lucas em 25/09 (`packages/lifeboard/LINHA-DE-CHEGADA.md`) e itens da v2 entrando: a junção
das frentes das contas Claude e Codex no grafo (#47), a regra de volume (#49), a poda das conversas soltas (Tarefa 02, #51)
e, em curso, a colagem branch → mudança (Tarefa 04). A v2 fecha quando o item 7 e a caixa A1 (ingestão automática de
agenda, Gmail e Drive) fecharem.

## Versão pública

**vP 0 — nenhuma.** Distância: indefinida até a primeira liberação. Pela classe, a 1ª pública pode ser a **v1** quando a
interna for **v2 em uso diário medido** (degrau abaixo).

## NUNCA sai — em versão alguma

- **Dado de pessoa e da casa:** tarefas, notas, frentes (PRs, branches, conversas das contas), agenda, Gmail, Drive, o banco
  `hciiilopyivjaekaxfqp` e qualquer cópia dele.
- **Pesos e fórmulas de priorização:** os pesos do HIERARQ e o score de assimetria (`src/core/prioritize/hierarq.ts`,
  `assimetria.ts` — já marcados como camada O, só no servidor).
- **O comportamento do dinheiro** (a fila e o livro-razão que a suíte "Lifeboard SQL" protege): regra e dado.
- **Credenciais e ligações com as contas** (tokens do painel, chaves do Supabase, a lista das contas lidas).

## SÓ COM FOSSO NOVO — sai quando a interna alcançar o nível nomeado

| Item | Sai com | Por quê espera |
|---|---|---|
| O motor do grafo do dia (caminho crítico + junção das frentes + poda + colagem) | **fosso-1** | é o que faz o grafo ser "o dia do Lucas" e não um quadro de tarefas |
| A leitura multi-conta (Claude ×4 + Codex) num painel só | **fosso-1** | hoje ninguém mais junta as sessões de várias contas num lugar |
| As guardas de navegador P4/P5/P6 (medir a classe, não o caso) | **fosso-1** | método de qualidade que ainda não está fechado na `main` (Tarefa 03) |

**fosso-1 =** a interna em **v2 com A1 fechada** (agenda, Gmail e Drive chegando sozinhos) e **30 dias de uso diário
medido** pelo Lucas. Fosso novo é ter isso em uso, não o tempo passar.

## PODE SAIR — com marca, a qualquer momento

| Degrau | O que sai | Preço |
|---|---|---|
| 0 | O padrão "guarda que mede a classe, não o caso" como texto ou aula; o checador de contraste (`scripts/checar-contraste.mjs`) | grátis, com o rodapé da casa |
| 1 (com fosso-1) | **LifeBoard v1 público**: grafo + "hoje" pelo HIERARQ **sem os pesos da casa** (o usuário define os dele), colagem manual de notas, DAG sem ciclo | assinatura |

## Linha de versão para todo PR do LifeBoard

```
Versão interna: vI 1.x · pública: vP 0 · distância: — · pode liberar agora: só o degrau 0 (grátis, com marca) · só com fosso novo: motor do grafo, leitura multi-conta, guardas (fosso-1)
```
