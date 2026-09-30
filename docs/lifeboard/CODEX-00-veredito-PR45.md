# Tarefa 00 · veredito do PR #45 (P5, linha do tempo) — 26/09/2026

> Revisor independente de contexto limpo (subagente Claude, Opus), sobre a cabeça `d31d820b`, em cópia separada.
> Portões na árvore limpa: tipos 0 erros · vitest **1550/1550** · contraste 79 pares ok · guarda `guarda-p5.mjs`
> **verde (94 medidas)**. Nenhum commit, nenhum push, nada postado no GitHub.

## VEREDITO: reprovado — 1 CRÍTICO, 1 ALTO, 1 MÉDIO

| # | Sev. | O defeito, em uma frase | Onde | Prova |
|---|---|---|---|---|
| 1 | **CRÍTICO** | A classe "o operador sai e volta" não fechou: sair pela barra do próprio app (Linha do tempo → Painel → Linha do tempo) não é medido, e a guarda declara isso fora do alcance com um motivo falso | `tests/navegador/guarda-p5.mjs:3485-3489`; `layout.tsx:34-39` | Sabotagem RV1 (variável no escopo do arquivo + `tabIndex = -1` na volta): 27 controles somem do Tab em 1280 e 390 px; `tsc` 0 erros, 1550 testes verdes, **guarda verde com a sabotagem dentro** |
| 2 | **ALTO** | No celular (390 px) toda data de item fora da janela sai cortada no meio do ano ("começa 07/08/20…" lê-se como 2020) | `src/components/timeline/linha-do-tempo.tsx:1749` (`whitespace-nowrap` em coluna de 111–123 px; texto pede 133–143) | 5 de 5 rótulos cortados no Chromium; as medidas P e G deram verde porque leem o texto no código, não na tela |
| 3 | MÉDIO | O "Hoje" congela no dia em que a página abriu: volta depois de 26 h e a linha dourada, o chip e as barras apontam para ontem | `src/app/linha-do-tempo/page.tsx:75`; `linha-do-tempo.tsx:709,1548` | desenhado 26/09 com a máquina em 27/09 |

**Formas viciadas de guarda:** 3 (mede só o que o nome sugere: "voltar" virou "voltar sem sair da rota") e 5 (confere o
caso — aba e relógio — não a classe "sai e volta").

Nota menor: `PLAYWRIGHT_MODULO` apontando para a pasta em vez do `index.js` faz a guarda sair com código 1 ("produto
errado") quando o certo era 2 ("não consegui medir").

## Comentários `@codex` propostos (um por achado CRÍTICO/ALTO) — postar só com o "pode" do Lucas

**Thread 1 (CRÍTICO)** — em `tests/navegador/guarda-p5.mjs:3485`:

```
@codex corrija o achado desta thread: a classe "o operador sai e volta" não está fechada. A guarda
declara fora do alcance "navegar para outra rota" com o motivo "a página que volta é a do nascimento",
e isso é falso para a navegação do Next pela barra superior (src/app/layout.tsx:34-39): o componente
remonta, mas o escopo do arquivo sobrevive. Prova: uma variável de módulo ligada no unmount + `el.tabIndex
= -1` em registrarBotaoLinha deixa 27 controles fora do Tab depois de Painel → Linha do tempo, e a guarda
sai verde (94 medidas). Regras: (1) reproduza antes — medida nova na guarda que falhe com essa sabotagem
(sair pela barra e voltar, e também voltar/avançar do navegador, em 1280 e 390); (2) corrija no menor
escopo sobre o head atual desta branch — o ramo de "volta" tem que cobrir a remontagem por rota, não só
aba/foco/rede; (3) rode tsc, vitest, contraste e a guarda; (4) commit em português e publique como PR pela
tarefa (o push direto não funciona no seu ambiente); (5) não mexa na main, não aplique nada em produção.
```

**Thread 2 (ALTO)** — em `src/components/timeline/linha-do-tempo.tsx:1749`:

```
@codex corrija o achado desta thread: a 390 px o rótulo de item fora da janela ("◀ começa 07/08/2026")
usa whitespace-nowrap numa coluna de 111–123 px e o texto pede 133–143 px — 5 de 5 rótulos saem cortados
no meio do ano ("…07/08/20") e a data inteira só existe no title/aria-label. As medidas P e G da guarda
deram verde porque leem o texto no DOM, não o pixel visível. Regras: (1) reproduza antes — medida na
guarda que compare a largura do texto com a da coluna (ou decodifique a foto) e falhe hoje a 390 px;
(2) corrija no menor escopo (quebra de linha, abreviação declarada ou coluna maior — sem esconder o ano);
(3) rode tsc, vitest, contraste e a guarda nas 5 larguras; (4) commit em português e publique como PR pela
tarefa; (5) não mexa na main, não aplique nada em produção.
```

O MÉDIO 3 vai para a lista da v2 na `LINHA-DE-CHEGADA.md`, sem rodada.
