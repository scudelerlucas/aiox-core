# Tarefa Codex 02 — conversa sem ligação sai do grafo (fica no quadro Assuntos)

> Decisão do Lucas, 26/09/2026 19:2x (São Paulo), opção **A**: depois do #49 o grafo ainda tem ~200 cartões; a
> próxima alavanca é a que o item 7 da `packages/lifeboard/LINHA-DE-CHEGADA.md` já nomeia — **esconder conversa que
> não tem ligação com nada**. Executa o **Codex** (regra `codex-corrige-claude-valida`: um PR publicado pela
> tarefa, base = a branch deste doc); o Claude valida por fora e mescla. **Um PR. No máximo 2 rodadas.**

## O que foi medido (26/09 19:19 SP, banco `hciiilopyivjaekaxfqp`, sincronização das 18:08)

Rodei `materializarFrentes` (a função que está em produção desde o merge do #49) sobre exatamente o que
`src/lib/frentes/repository.ts` carrega: 32 mudanças abertas · 338 branches · 335 conversas dos últimos 90 dias.

| | Cartões |
|---|---|
| Antes do #49 (1º deploy) | ~530 |
| Hoje, com a regra do #49 | **183** = 74 conversas · 77 branches · 32 mudanças (+ 18 tarefas do dono em `tasks`) |
| Ligações | 92 |
| Conversas **sem nenhuma ligação** (grau 0 no grafo materializado) | **46 de 74** |
| Branches sem ligação | 0 (por construção: branch só entra ligada a algo) |
| Se a conversa solta sair | **137** cartões de frentes (~155 com as do dono) |

O item 7 estimava "43 das 74 têm ligação"; a medição de hoje dá 28 com ligação e 46 sem. Os dois números vêm do
mesmo banco em horas diferentes; vale o medido no dia da entrega, e o PR do Codex deve trazer o dele.

## A regra nova (uma frase)

**Conversa só vira cartão do grafo se está ligada a pelo menos uma branch ou mudança que também entrou.**
Conversa viva e solta continua existindo no quadro Assuntos (`compose.ts`, coluna do estado dela) — o grafo é o
lugar das ligações, o quadro é o lugar da lista. Nada some do sistema; muda só onde aparece.

Consequências que precisam continuar verdadeiras:
- branch continua entrando **só** ligada a mudança aberta ou conversa viva (regra do #49) — e a conversa que
  segura a branch, por definição, tem ligação, então fica;
- as arestas continuam declaradas a partir do dado (`sessoes.branches`, `branches.sessao_ids`, `prs.sessao_ids`,
  `prs.branch`), nunca inferidas por texto;
- `JANELA_SESSAO_DIAS` (21 dias) continua valendo **antes** desta regra: conversa velha nem chega a ser candidata.

## O que entregar

1. Em `src/lib/frentes/materializar.ts`: depois de montar as arestas (passo 3), **remover as tarefas de conversa
   com grau zero** (nenhuma aresta de origem nem de destino). Constante declarada e comentada, no mesmo estilo
   de `JANELA_SESSAO_DIAS`, dizendo por quê (medição acima). O comentário de cabeçalho do arquivo ganha a regra.
   Nada muda em `no-grafo.ts`, `compose.ts` nem no quadro Assuntos.
2. Em `tests/unit/frentes-materializar.test.ts`, bloco novo **(f) conversa sem ligação não vira cartão**:
   - conversa viva, sem `branches`, sem nenhuma branch/mudança que a cite → **0** tarefa de conversa
     (**é o teste que falha antes e passa depois**);
   - conversa viva que cita uma branch existente → entra, com a aresta conversa → branch;
   - conversa viva citada por `prs.sessao_ids` de uma mudança aberta → entra, com a aresta conversa → mudança;
   - os blocos (a)–(e) continuam verdes sem alteração de expectativa (a fixture 1 conversa → 1 branch → 1 mudança
     continua dando 3 tarefas e 2 arestas).
3. `LINHA-DE-CHEGADA.md`, item 7: acrescentar a linha da medição do PR (cartões antes → depois, no banco de
   produção, só leitura).
4. Checagens do repo, em `packages/lifeboard`: `npx tsc --noEmit` · `npx vitest run` (hoje 1536/1536) ·
   `npm run contraste` · eslint nos arquivos tocados.

## Como a entrega é validada por fora (Claude)

Merge local do PR do Codex com a base · as quatro checagens · o teste (f) rodado contra o `materializar.ts` da base
(tem que ficar vermelho) · a mesma medição desta página refeita sobre o head do Codex (esperado ≈ 137 cartões de
frentes com o dado de 26/09; o número do dia pode variar com a sincronização). Verde → merge commit na branch deste
doc, thread resolvida com o resultado escrito; o operador mergeia na `main`.

## Não faça

- Não mexer na regra de branch (#49) nem em `JANELA_SESSAO_DIAS`.
- Não tocar em `compose.ts`/quadro Assuntos: a conversa solta continua lá.
- Não inferir ligação por texto (título, mensagem de commit).
- Não aplicar nada em produção; não empurrar na `main`; não fazer rebase/força na branch base.

## Registro da execução Codex

- [x] Teste (f) reproduziu em vermelho a conversa viva sem ligação.
- [x] Conversa de grau zero removida depois da montagem das arestas.
- [x] Conversas ligadas a branch ou mudança preservadas com suas arestas.
- [x] Item 7 registra a medição antes → depois.
- [x] Checagens locais executadas conforme a tarefa.

### File list

- `packages/lifeboard/src/lib/frentes/materializar.ts`
- `packages/lifeboard/tests/unit/frentes-materializar.test.ts`
- `packages/lifeboard/LINHA-DE-CHEGADA.md`
- `docs/lifeboard/TAREFA-CODEX-02-conversa-sem-ligacao-fora-do-grafo.md`
