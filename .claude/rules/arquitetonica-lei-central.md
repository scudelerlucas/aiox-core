# A lei central da ARQUITETÔNICA — os sete termos, para nunca mais errar

> **Ordem do operador, 2026-09-05 (literal):** *"P = [T × A × S × N]^C × R está errado! eu já corrigi
> mil vezes isso … T = território técnico, A = arquétipos, S = símbolos heurísticos, N = narrativas,
> verifique todos, e vamos canonizar para nunca mais errar."* O erro do dia: uma sessão expandiu as
> letras como "Tempo × Autoridade × Semântica × Narrativa … × Repetição" num dossiê e num painel.
> A **emenda E9** (22/08) já fixava os nomes; o que faltava era a regra carregar em **toda sessão**
> (`.claude/rules/` carrega sempre; `docs/frameworks/` só quando alguém abre). Este arquivo é o
> espelho executável. **FONTE DA TEORIA:** `docs/frameworks/ARQUITETONICA-v1_1-Corpo-Canonico.md` §2
> e `ARQUITETONICA-E9-nomenclatura-dos-sete-termos-v1.0.md`. Não reabrir a teoria aqui.

## A lei (forma canônica — copiar daqui, nunca de memória)

> **POSICIONAMENTO = [ TERRITÓRIO × ARQUÉTIPO × SÍMBOLOS HEURÍSTICOS × NARRATIVA ] ^ COERÊNCIA × RITMO**
> — tudo relativo a um **ADVERSÁRIO** nomeado, sustentado por **PROVA**, aterrissando no slot que a
> **FERIDA** da audiência já abriu.

Forma abreviada: `P = [T × A × S × N] ^C × R`

| Sigla | Nome canônico | Definição (Corpo Canônico §2.1) | Erros já cometidos (proibidos) |
|---|---|---|---|
| **P** | **Posicionamento** | o que a mente da audiência **retém, concede e repete a terceiros** — output medido | "Poder" |
| **T** | **Território** | domínio **técnico** + autodomínio + fronteira declarada | "Tempo", "Timing", "relógio" |
| **A** | **Arquétipo** | tensão primária–secundária **prescrita pela ferida**, não escolhida por gosto | "Autoridade", "Audiência" |
| **S** | **Símbolos heurísticos** | heurísticas e objetos proprietários que carregam significado sem explicá-lo — **inclui o preço como signo** | "Semântica", "Símbolo/Imagem" visual |
| **N** | **Narrativa** | **dito + não dito + dito por terceiros** | "Novidade" |
| **C** | **Coerência** | **expoente**, sempre externo — audita-se de fora, age por coorte, com latência | "Congruência", "Consistência" |
| **R** | **Ritmo** | multiplicador **externo ao colchete** — cadência do operador (input) | "Repetição" (é P, não R — emenda E4) |

## Como aplicar a uma casa (o que a sessão escreve, sempre nesta ordem)

1. **Adversário** nomeado (não uma pessoa; uma crença ou um modo de operar). 2. **Prova** aceita pela
audiência-alvo. 3. **Ferida** pré-existente. 4. Só então os quatro fatores: T (o que domina e o que
declara não disputar) · A (o par de forças que a ferida exige) · S (objetos, heurísticas e preços que
significam sem explicar) · N (o que diz, o que cala, o que deixa terceiros dizerem). 5. **C** avaliada
de fora (vida × discurso). 6. **R** como disciplina de cadência, nunca como "volume de conteúdo".

## Regra de uso

- **Toda vez** que a lei aparecer em documento, painel, slide ou resposta: os sete nomes acima, por extenso
  pelo menos uma vez. Sigla sem expansão só depois de expandida no mesmo documento.
- **Antes de escrever a lei, abrir este arquivo** — não reconstruir de memória. Memória de modelo inventa
  acrônimos plausíveis ("Tempo, Autoridade…") e foi exatamente assim que errou.
- **Lint:** `scripts/lint-lei-central.sh` procura expansões erradas em `docs/` e falha se achar.
- Vale em **todos os repos e todas as sessões** (espelhada por `scripts/sync-rules.mjs`).

## Sinal de que a regra foi violada

Qualquer texto vivo com "Tempo", "Autoridade", "Semântica" ou "Repetição" no lugar de T, A, S ou R; a lei
escrita sem os três termos de contorno (Adversário, Prova, Ferida); ou "Poder" no lugar de Posicionamento.

*v1.0 · 2026-09-05 · canônica por ordem do operador · espelho executável da E9.*
