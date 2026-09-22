/**
 * Régua de contraste (UI/UX §3: "contraste ≥ 4,5:1, placeholder e ajuda contam").
 *
 * Lê os tokens de `tailwind.config.ts` e verifica cada par texto × fundo que a
 * interface realmente usa. Falha com código 1 se algum par cair abaixo de 4,5:1
 * (3:1 para o que é só borda/ícone decorativo, conforme WCAG 1.4.11).
 *
 * Rodar: `node scripts/checar-contraste.mjs`
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const fonte = readFileSync(new URL("../tailwind.config.ts", import.meta.url), "utf8");

/** Extrai os hex do arquivo de tokens por nome-do-grupo + chave. */
function tokens() {
  const mapa = {};
  let grupo = null;
  for (const linha of fonte.split("\n")) {
    const g = linha.match(/^\s{8}(\w+): \{/);
    if (g) grupo = g[1];
    const c = linha.match(/^\s{10}"?([\w-]+)"?:\s*"(#[0-9A-Fa-f]{6})"/);
    if (c && grupo) mapa[`${grupo}-${c[1]}`] = c[2];
  }
  return mapa;
}

const T = tokens();

/**
 * P5c (13/09/2026, achado BAIXO #13 do crítico hostil, rodada 2): duas cores
 * na tela NÃO são um token puro — são o PIXEL JÁ COMPOSTO que o navegador
 * pinta depois de somar opacidade + `background-image` sobre o canvas
 * (`navy-950`): a hachura de folga (listra opaca do `repeating-linear-
 * gradient` × a `opacity-70` do elemento) e a barra cinza de "fechado sem
 * merge" (`bone-500` a 90% de opacidade, achado ALTO #9 da rodada 1). Nenhum
 * dos dois é achável lendo só `tailwind.config.ts` — o crítico mediu o PIXEL
 * de um screenshot real. `RESOLVIDAS` guarda esse resultado já composto (hex
 * literal, não nome de token) para as duas entradas correspondentes em
 * `PARES` — a mesma disciplina de "nenhum hex fora de um arquivo
 * documentado", só que aqui o arquivo é ESTE comentário, não o tema.
 */
const RESOLVIDAS = {
  // 0,7×folga.tracado(#57C9C0) + 0,3×navy-950(#05070F) — a listra OPACA do
  // gradiente por cima do fundo a 30%+70% de opacidade. Medido pelo crítico: 5,28:1.
  "hatch-folga-composta": "#3E8F8B",
  // 0,9×bone-500(#6C7A99) + 0,1×navy-950(#05070F) — a barra "fechado sem
  // merge" (cinza, `opacity-90`) sobre o canvas. Medido pelo crítico: 3,94:1.
  "barra-fechada-composta": "#626E8B",
  /**
   * Rodada 11 (achado ALTO 2): a tela de login (`app/login/page.tsx`) pinta
   * TODA a sua cor por `style={{ color: … }}`, com hex literais num objeto
   * `C` no topo do arquivo. Nenhum deles é um token do tema, então nem a
   * lista à mão nem o gate derivado de `text-<token>` jamais os viram — a
   * tela inteira era invisível para esta régua. Entram aqui, com o pixel
   * literal, e passam a ser medidos como qualquer outro par.
   */
  "login-navy": "#0A1628",
  "login-bone": "#F5F2EC",
  "login-gold": "#A8895A",
  "login-card": "#0F1E33",
  "login-muted": "#8593A8",
  "login-erro": "#FF9C90",
};

const canal = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
function razao(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** [texto, fundo, mínimo, onde aparece] */
const PARES = [
  ["bone-100", "navy-950", 4.5, "texto principal sobre o fundo da app"],
  ["bone-100", "navy-900", 4.5, "texto principal sobre painel"],
  ["bone-100", "navy-850", 4.5, "título do cartão"],
  ["bone-100", "navy-800", 4.5, "título do cartão em hover"],
  ["bone-300", "navy-850", 4.5, "texto secundário do cartão"],
  ["bone-300", "navy-900", 4.5, "texto secundário do painel"],
  ["bone-400", "navy-950", 4.5, "texto terciário / ajuda"],
  // P6b (achado MÉDIO #15, crítico 13/09): o botão primário único da tela da
  // tarefa ("Salvar nota") é texto navy-950 sobre um degradê gold-400→gold-600
  // — as duas pontas do degradê contra o fundo/painel escuro, mais o texto
  // dourado do radio SELECIONADO do controle segmentado (navy-800).
  ["gold-400", "navy-950", 4.5, "topo do degradê do botão primário (Salvar nota)"],
  ["gold-600", "navy-950", 4.5, "base do degradê do botão primário (Salvar nota)"],
  ["gold-300", "navy-800", 4.5, "opção selecionada do controle segmentado (radio ativo)"],
  ["bone-400", "navy-850", 4.5, "motivo da ordem no cartão"],
  ["gold-300", "navy-850", 4.5, "rótulo da ação"],
  ["gold-400", "navy-900", 4.5, "marca e destaque do 1º lugar"],
  ["state-open", "navy-850", 4.5, "chip 'aberta'"],
  ["state-progress", "navy-850", 4.5, "chip 'em progresso'"],
  ["state-blocked", "navy-850", 4.5, "chip 'bloqueada'"],
  ["state-done", "navy-850", 4.5, "chip 'concluída'"],
  ["state-error-fg", "navy-850", 4.5, "aviso de ciclo"],
  ["state-neutral", "navy-850", 4.5, "estado desconhecido"],
  ["fonte-calendar", "navy-850", 4.5, "rótulo da fonte Agenda"],
  ["fonte-gmail", "navy-850", 4.5, "rótulo da fonte Gmail"],
  ["fonte-drive", "navy-850", 4.5, "rótulo da fonte Drive"],
  ["fonte-notes", "navy-850", 4.5, "rótulo da fonte Notas"],
  ["fonte-chat", "navy-850", 4.5, "rótulo da fonte Chats"],
  ["fonte-lms", "navy-850", 4.5, "rótulo da fonte Cativa"],
  ["fonte-neutra", "navy-850", 4.5, "rótulo de fonte desconhecida"],
  ["navy-700", "navy-950", 3, "borda de cartão (só borda: 3:1)"],
  ["navy-600", "navy-850", 3, "borda forte (só borda: 3:1)"],
  ["state-warning", "navy-850", 4.5, "aviso 'estimativa faltando' no cartão do grafo (P4)"],
  // ── Arestas do grafo v3 (P4, 13/09/2026) — traço sobre o fundo do canvas (navy-950) ──
  ["aresta-sucessao", "navy-950", 3, "aresta de sucessão — verde contínua (P4 §5)"],
  ["aresta-predecessor", "navy-950", 3, "aresta destacada ao selecionar — amarela (P4 §5)"],
  ["aresta-correlacao", "navy-950", 3, "aresta de correlação — pontilhada (P4 §5)"],
  ["aresta-sinergia", "navy-950", 3, "aresta de sinergia — pontilhada roxa + rótulo % (P4 §5)"],
  ["aresta-obsolescencia", "navy-950", 3, "aresta de obsolescência — ❌ no destino (P4 §5)"],
  ["aresta-critico", "navy-950", 3, "traço triplo do caminho crítico (P4 §5)"],
  // P4b (achado ALTO #4): obsolescência ganhou matiz própria — antes idêntica ao crítico.
  ["aresta-obsolescenciaHue", "navy-950", 3, "aresta de obsolescência — matiz própria, traço (P4b #4)"],
  ["aresta-obsolescenciaHue", "navy-950", 4.5, "aresta de obsolescência — matiz própria, se usada como texto (P4b #4)"],
  // ── Linha do tempo / Gantt (P5, 13/09/2026) — barras sólidas sobre o canvas (navy-950) ──
  ["state-open", "navy-950", 3, "barra de assunto/tarefa 'aberta' no Gantt (P5)"],
  ["state-done", "navy-950", 3, "barra de assunto/tarefa 'concluída' no Gantt (P5)"],
  // SUBSTITUÍDO (P5c, rodada 2, achado BAIXO #13): "fechado sem merge" não usa
  // mais `state-error` desde o achado ALTO #9 da rodada 1 (cinza + traço,
  // nunca o vermelho — ver `corDoAssunto` em `linha-do-tempo.tsx`). O par
  // "aresta-sucessaoAtiva" abaixo é quem cobre o Gantt daqui em diante; esta
  // linha fica só como registro de por que o par sumiu, não reentra na régua.
  // ["state-error", "navy-950", 3, "barra de assunto 'fechado sem merge' no Gantt (P5) — SUBSTITUÍDO"],
  ["state-progress", "navy-950", 3, "barra de tarefa 'em progresso' no Gantt (P5)"],
  ["state-blocked", "navy-950", 3, "barra de tarefa 'bloqueada' no Gantt (P5)"],
  ["aresta-sucessaoAtiva", "navy-950", 3, "conector de sucessora destacada na seleção do Gantt (P5c #9)"],
  // P5b (13/09/2026, achado ALTO #7): token dedicado da FOLGA — antes reusava
  // `aresta-critico` a 25% (2,71:1, abaixo da régua) e o mesmo matiz do crítico
  // para o conceito oposto. Checado contra o canvas (navy-950) E a base da
  // barra (navy-850) — a hachura aparece sobre os dois.
  ["folga-tracado", "navy-950", 3, "hachura de folga do Gantt sobre o canvas (P5b #7)"],
  ["folga-tracado", "navy-850", 3, "hachura de folga do Gantt sobre a base da barra (P5b #7)"],
  // ── Pares de PIXEL JÁ COMPOSTO (P5c, rodada 2, achado BAIXO #13) ──
  ["hatch-folga-composta", "navy-950", 3, "listra opaca da hachura de folga, já composta com a opacidade — pixel real medido pelo crítico"],
  ["barra-fechada-composta", "navy-950", 3, "barra cinza 'fechado sem merge' a 90% de opacidade, já composta — pixel real medido pelo crítico"],
  // P5f (rodada 5, achado BAIXO A9): a barra de "início não definido" é
  // borda TRACEJADA + preenchimento a 30% do mesmo tom do estado. O pixel
  // composto do preenchimento (0,3×state-open #7FB8FF + 0,7×navy-950) dá
  // #2A3C57 = 1,80:1 contra o canvas — e isso é PROPOSITAL: o preenchimento
  // ali é textura ("não confie nesta data"), não é a fronteira do elemento.
  // Quem carrega o significado, e quem a WCAG 1.4.11 mede, é a BORDA — e ela
  // é o token cheio, já na régua acima (`state-open`/`state-progress`/
  // `state-blocked`/`state-done`/`aresta-critico` sobre navy-950, ≥ 3:1).
  // Registrado aqui para o próximo leitor não "consertar" o 1,80 sem saber.
  // ── Fila de prompts (P7, 13/09/2026, rodada de correção do crítico) ──
  // Achado MÉDIO #12: `bone-500` sobre navy-850 (4,01:1) e navy-900 (4,41:1)
  // — os dois abaixo de 4,5:1. Trocado por `bone-400` nos dois usos
  // (placeholder do textarea e legenda de complexidades do formulário).
  ["bone-400", "navy-900", 4.5, "placeholder do textarea de novo prompt (P7, corrigido de bone-500 4,41:1)"],
  ["bone-400", "navy-850", 4.5, "legenda de complexidades no rodapé do formulário (P7, corrigido de bone-500 4,01:1)"],
  // Achado BAIXO #16: o trilho da barra de progresso do cartão de conta era
  // `navy-800` sobre `navy-850` (1,14:1 — invisível). `navy-600` mede 4,01:1
  // sobre o mesmo cartão (o mínimo aqui é 3:1, decorativo/UI, não texto).
  ["navy-600", "navy-850", 3, "trilho da barra de progresso do cartão de conta (P7 #16, era navy-800 1,14:1)"],
  // D32a (P7, rodada 7): as duas frases novas do cartão de conta. Cor NUNCA é o
  // único sinal — as duas dizem por extenso o que são ("sem medição nenhuma",
  // "última medição há N h"); a cor só reforça.
  ["state-blocked", "navy-850", 4.5, "'sem medição nenhuma' no cartão de conta (P7 D32a)"],
  ["state-progress", "navy-850", 4.5, "'última medição há N h' no cartão de conta (P7 D32a)"],
  ["bone-400", "navy-850", 4.5, "teto × faixa real dos dias medidos no cartão (P7 D32d)"],
  // ── Linha do tempo / Gantt, rodada 4 do crítico hostil (P5e, 13/09/2026) ──
  // Achado BAIXO #8: o marcador de atraso era SEMPRE vermelho (`state-error`)
  // — sobre a barra crítica (preenchimento `aresta-critico`, também vermelho)
  // ficava invisível. 1ª tentativa (`gold-400`) mediu 1,70:1 — pior que o
  // problema original. `navy-950` pontilhado quando `row.critico` mede
  // 7,90:1; par decorativo (só borda/marcador, nunca texto corrido) — régua 3:1.
  ["navy-950", "aresta-critico", 3, "marcador pontilhado de atraso sobre a barra crítica do Gantt (P5e #8)"],
  // ── Linha do tempo / Gantt, rodada 6 do crítico hostil (P5g, 13/09/2026) ──
  // Achado ALTO A3: a barra cortada pelo teto de dias ganhou "▶" DENTRO dela
  // (fora, o glifo esticava o `scrollWidth` do painel — achado BAIXO A6). O
  // glifo é `navy-950` sobre o preenchimento da barra, qualquer que ele seja;
  // carrega significado (não é enfeite), então vale a régua de texto, 4,5:1.
  ["navy-950", "state-open", 4.5, "▶ 'continua além da janela' sobre a barra aberta (P5g A3)"],
  ["navy-950", "state-done", 4.5, "▶ 'continua além da janela' sobre a barra concluída (P5g A3)"],
  ["navy-950", "state-progress", 4.5, "▶ 'continua além da janela' sobre a barra em progresso (P5g A3)"],
  ["navy-950", "state-blocked", 4.5, "▶ 'continua além da janela' sobre a barra bloqueada (P5g A3)"],
  ["navy-950", "aresta-critico", 4.5, "▶ 'continua além da janela' sobre a barra crítica (P5g A3)"],
  // Sobre o cinza de "fechado sem merge" o glifo escuro mede só 3,95:1 — ali
  // (e só ali) ele é CLARO. Sobre as barras translúcidas ("sem data", "início
  // não definido") o fundo real é o canvas: `bone-300` sobre `navy-950`.
  ["bone-50", "barra-fechada-composta", 4.5, "▶ claro sobre a barra cinza 'fechado sem merge' já composta (P5g A3)"],
  ["bone-300", "navy-950", 4.5, "▶ sobre barra translúcida do Gantt — o fundo real é o canvas (P5g A3)"],
  // ── Página da tarefa, rodada 4 do crítico hostil (13/09/2026) ──
  // Achado BAIXO #5: mensagem de sucesso ("Duração salva." e o mesmo padrão
  // em mãe/status/meta/átomos/relação) sobre o `<section class="bg-navy-900">`
  // que envolve esses formulários — `state-done` já media 4,5:1+ sobre
  // navy-850 (linha acima); aqui o par que faltava.
  ["state-done", "navy-900", 4.5, "mensagem de sucesso dos formulários da tarefa (mãe/status/meta/duração/relação, BAIXO #5)"],
  // ── Fila de prompts, rodada 6 do crítico hostil (P7, 13/09/2026) ──
  // Achado MÉDIO 4: a frase que LANÇA dinheiro no teto do dia ("US$ 120,00
  // entram no gasto de hoje…") saía em `text-state-done` — o mesmo verde de
  // "enfileirado com sucesso". Ela passou a ser `text-state-progress`, e o par
  // precisa valer nas DUAS superfícies em que a linha da fila é desenhada: a
  // tabela (fundo da página, `navy-950`) e o cartão do mobile (`navy-850`,
  // já na régua acima).
  ["state-progress", "navy-950", 4.5, "aviso 'isto entrou no gasto de hoje' na linha da fila (P7 MÉDIO 4)"],
  ["state-done", "navy-950", 4.5, "sucesso mudo da fila (cancelamento sem custo) na tabela (P7 MÉDIO 4)"],
  ["state-blocked", "navy-950", 4.5, "recusa em português da fila, role=alert, na tabela (P7)"],
  // ── Pares que ENTRARAM porque o gate derivado acima os cobrou (rodada 10) ──
  // Não são achados do crítico: são cores que já estavam na tela e que a lista
  // à mão nunca mediu. O gate as encontrou na primeira execução, junto com o
  // `bone-500` da P5 (4,01:1) que motivou tudo isto. Todas passam.
  ["bone-200", "navy-850", 4.5, "rótulo dos botões flutuantes do grafo e cabeçalho do detalhe (P4/P5)"],
  ["bone-200", "navy-900", 4.5, "chip de mês grudado no topo do Gantt (P5)"],
  ["bone-200", "navy-700", 4.5, "rótulo do botão do grafo em hover (P4)"],
  ["state-error", "navy-950", 4.5, "ícone de alerta do cartão e borda de 'datas inconsistentes' do Gantt"],
  ["state-error", "navy-850", 4.5, "ícone de alerta do cartão sobre o painel (P4)"],
  ["state-success-fg", "navy-800", 4.5, "etiqueta de conta 'pandora' — fundo fixo navy-800 (frentes)"],
  // ── Pares que a trava nova cobrou (rodada 11, achado ALTO 2) ──
  // Os três já estavam na régua como TRAÇO (3:1, arestas do grafo), e a P5 os
  // usa também como TEXTO: a frase que decodifica as cores no topo da tela, o
  // "◀ ▶" de fora-da-janela numa linha crítica e o "✕" da legenda. Nenhum
  // deles era medido contra a régua de texto até agora — passavam pelo par
  // decorativo. Todos com folga sobre o fundo da página (`navy-950`).
  ["aresta-critico", "navy-950", 4.5, "'vermelho triplo' na frase do topo, '◀ ▶' crítico e '✕' da legenda (P5, rodada 11)"],
  ["aresta-sucessao", "navy-950", 4.5, "'verde' na frase que decodifica as cores no topo da linha do tempo (P5, rodada 11)"],
  ["aresta-predecessor", "navy-950", 4.5, "'amarelo' na frase que decodifica as cores no topo da linha do tempo (P5, rodada 11)"],
  // ── Tela de login (rodada 11, achado ALTO 2) — cor por `style` inline ──
  // Medidos agora pela primeira vez. O vermelho do erro media 4,21:1 (`#CF5C48`
  // sobre o cartão, 13px): abaixo da régua, e invisível para o gate antigo
  // porque não passa por `text-<token>` nenhum. Trocado por `#FF9C90` (o mesmo
  // pixel de `state-error-fg`, que já é o vermelho legível da casa).
  ["login-bone", "login-navy", 4.5, "texto da página de login sobre o fundo"],
  ["login-bone", "login-card", 4.5, "título 'ALMA PETRA' sobre o cartão de login"],
  ["login-gold", "login-card", 4.5, "'OS-LIFEBOARD' e o botão em carregamento, sobre o cartão"],
  ["login-muted", "login-card", 4.5, "parágrafo de explicação do login"],
  ["login-erro", "login-card", 4.5, "mensagem de erro do login (era #CF5C48, 4,21:1)"],
  ["login-navy", "login-gold", 4.5, "rótulo do botão 'Entrar com Google' sobre o dourado"],
];

/** Nome de token em `tailwind.config.ts` OU chave já resolvida em `RESOLVIDAS` (pixel composto). */
function resolveCor(nome) {
  return T[nome] ?? RESOLVIDAS[nome];
}

/**
 * ── O MEDIDOR PASSOU A MEDIR O PRODUTO, NÃO A HIPÓTESE (rodada 10, MÉDIO 4) ──
 *
 * O defeito que esta seção fecha: a P5 pintava o rótulo de um assunto
 * mergeado com `text-bone-500` sobre `navy-850` (4,01:1, medido no Chromium),
 * este script tinha o par `bone-500 × navy-850` DOCUMENTADO como corrigido na
 * P7 — e mesmo assim imprimia "64 pares verificados, todos dentro da régua".
 * Porque `PARES` é uma lista escrita à mão, e a P5 nunca foi escrita nela.
 * Uma régua que só mede o que alguém lembrou de anotar mede o autor, não a
 * tela; é a mesma doença da guarda de comportamento da rodada 9.
 *
 * O que dá para derivar do código sem navegador, e é derivado abaixo:
 *
 *  **Todo token usado como COR DE TEXTO existe na régua.** Varre `src/**`
 *  atrás de `text-<grupo>-<chave>` que resolva em `tailwind.config.ts`
 *  (`text-[12px]`, `text-left`, `text-ellipsis` não resolvem e são ignorados)
 *  e exige que cada um apareça como lado ESQUERDO de pelo menos um par.
 *  `bone-500` teria caído aqui, e com ele o achado inteiro.
 *
 * ## O que foi tentado e REJEITADO, com a medição
 *
 * A primeira versão derivava também o PAR: quando um `className` traz
 * `bg-navy-850` e `text-bone-300` na mesma linha, o par seria um fato do
 * código. Rodou contra `src/` e acusou 17 pares — **9 deles falsos**, em duas
 * classes que nenhuma heurística de texto resolve:
 *
 *  1. **Opacidade.** `bg-gold-500/20 text-bone-50` não é `bone-50` sobre
 *     `gold-500` (2,03:1, "reprovado"): é `bone-50` sobre gold a 20% sobre o
 *     canvas escuro — legível. O pixel real depende do que está EMBAIXO, que
 *     o arquivo de tokens não sabe.
 *  2. **Linha que é tabela de variantes, não `className`.** `{ barra:
 *     "bg-state-done", texto: "text-state-done" }` (a tabela de cores do
 *     próprio Gantt) vira "state-done sobre state-done" — duas cores que
 *     nunca se encostam na tela.
 *
 * Suprimir esses dois casos exigiria uma lista de exceções escrita à mão —
 * exatamente a doença que o gate existe para curar, um nível acima. Então o
 * par derivado ficou de fora, e isto aqui é o que ele cobre de verdade: o
 * medidor não deixa mais uma cor de texto existir na tela sem estar na régua.
 *
 * O que continua sem derivação, e por isso na lista à mão: o fundo que vem de
 * um ANCESTRAL (o caso do rótulo do Gantt — o `text-` está num `<span>` e o
 * `bg-navy-850` vem de dois componentes acima) e o pixel já composto por
 * opacidade (`RESOLVIDAS`). Para esses a régua é a lista + a medição no
 * navegador (`tests/navegador/guarda-p5.mjs`, que lê `getComputedStyle` de
 * verdade e reprovou o 4,01:1 antes desta correção).
 *
 * Exceção declarada, uma só: um token usado como cor de um ÍCONE decorativo
 * não é texto e vale 3:1. Cada exceção nomeia o arquivo e some da lista
 * quando o uso sumir do código (uma exceção que não corresponde a nada é
 * FALHA, para a lista não apodrecer).
 *
 * ── O QUE A RODADA 11 CONSERTOU AQUI (achado ALTO 2) ────────────────────────
 *
 * O parágrafo acima descreve a régua da rodada 10, e ela media o autor um
 * nível acima: exigia que todo token usado como `text-*` aparecesse como lado
 * esquerdo de **algum** par — sem nunca olhar CONTRA QUAL FUNDO ele está
 * sendo usado. Um par registrado como borda decorativa a 3:1 virava passe
 * livre para o mesmo token ser texto corrido. Sabotagem de duas linhas do
 * crítico (`text-bone-300` → `text-navy-700` e `text-bone-100` →
 * `text-navy-700`, nas duas gavetas): o script imprimia "27 tokens usados
 * como cor de texto — todos na régua" e "70 pares verificados, todos dentro
 * da régua", enquanto o Chromium media **2,76:1** naquele texto.
 *
 * Dois buracos maiores, sem sabotagem nenhuma: a expressão
 * `text-([a-zA-Z]+)-([\w-]+)` não vê `text-[#3a3a3a]` (valor arbitrário do
 * Tailwind), nem `style={{ color: … }}`, nem cor vinda de um arquivo CSS. A
 * tela de login inteira (todo o texto dela é `style` inline) era invisível —
 * e tinha um vermelho a 4,21:1 esperando lá desde sempre.
 *
 * As três travas que entram agora, e o que cada uma consegue:
 *
 * 1. **Todo token de TEXTO precisa de um par de TEXTO (≥ 4,5:1).** Um token
 *    cujo único registro é decorativo (3:1) deixa de servir como cor de
 *    texto. `navy-700` tem exatamente um par — `navy-700 × navy-950, 3:1,
 *    "borda de cartão"` — então a sabotagem do crítico cai aqui, sem
 *    navegador.
 * 2. **Os três canais escondidos são DETECTADOS e nenhum passa em silêncio.**
 *    Valor arbitrário (`text-[…]`), `color:` em objeto de estilo e `color:`
 *    em arquivo CSS: cada ocorrência tem de estar num arquivo DECLARADO em
 *    `ARQUIVOS_COM_COR_LITERAL`, e cada arquivo declarado tem de listar os
 *    pares que ele pinta (medidos acima, como qualquer outro). Arquivo não
 *    declarado = FALHA; arquivo declarado que parou de usar cor literal =
 *    FALHA (a lista não apodrece).
 * 3. **O par de verdade se mede no navegador.** Nada aqui sabe qual é o fundo
 *    REAL de um `<span>` cujo `bg-` vem de dois componentes acima, nem
 *    compõe opacidade. Quem faz isso é `tests/navegador/guarda-p5.mjs`
 *    (medida I): lê a cor computada de cada nó de texto visível, sobe até o
 *    primeiro ancestral com fundo, compõe alfa e exige 4,5:1 (3:1 para texto
 *    grande). É ela que fecha o caso das gavetas — este arquivo cobre o
 *    código inteiro de forma mais grossa; ela cobre uma rota inteira de forma
 *    exata. As duas juntas, nunca uma só.
 */
const RAIZ_SRC = fileURLToPath(new URL("../src", import.meta.url));

function arquivosDeFonte(dir, padrao = /\.(tsx?|jsx?)$/) {
  const achados = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      achados.push(...arquivosDeFonte(caminho, padrao));
    } else if (padrao.test(nome)) {
      achados.push(caminho);
    }
  }
  return achados;
}

/**
 * Os TRÊS CANAIS por onde uma cor de texto entra na tela sem passar por
 * `text-<token>` — e que a régua até a rodada 10 não via de jeito nenhum.
 * Cada padrão só DETECTA; quem julga é `ARQUIVOS_COM_COR_LITERAL` abaixo.
 */
const CANAIS_ESCONDIDOS = [
  {
    nome: "valor arbitrário do Tailwind (text-[…])",
    // `text-[12px]`, `text-[length:…]` e afins não são cor; só entram os que
    // trazem um valor de COR (hex, rgb/hsl, nome CSS ou variável).
    re: /(?:^|[\s"'`{(\[])text-\[(#[0-9A-Fa-f]{3,8}|(?:rgb|hsl)a?\(|var\(--|color:)/,
  },
  {
    nome: "cor em objeto de estilo (style={{ color: … }})",
    re: /(?:^|[\s{,(])color\s*:\s*(?!["']?inherit)(?!["']?transparent)(?!["']?currentColor)[^,;}\n]+/,
  },
];
/** O mesmo, dentro de CSS — `color-scheme` NÃO é cor de texto e fica de fora. */
const CANAL_CSS = /(?:^|[;{\s])color\s*:/;

/**
 * Arquivos autorizados a pintar cor de texto fora do canal `text-<token>`.
 *
 * Estar aqui não é perdão: é a promessa de que os pares que o arquivo pinta
 * estão em `PARES` acima, medidos. `pares` lista as chaves desses pares (as
 * mesmas de `RESOLVIDAS`/tokens) — se nenhuma delas existir na régua, é
 * FALHA. Se o arquivo parar de usar cor literal, também é FALHA: a
 * autorização some junto com o uso.
 */
const ARQUIVOS_COM_COR_LITERAL = [
  {
    arquivo: "app/login/page.tsx",
    pares: ["login-bone", "login-gold", "login-muted", "login-erro", "login-navy"],
    porque:
      "tela pré-sessão, fora do tema Tailwind por decisão antiga; os 6 pares dela estão em PARES",
  },
];

/**
 * `text-bone-400` → `bone-400`, mas só quando o nome resolve num token real
 * (`text-[12px]`, `text-left`, `text-ellipsis` não resolvem e caem fora).
 *
 * **Modificador de opacidade derruba o token de propósito.** `bg-gold-500/20`
 * NÃO é `gold-500`: o pixel que o navegador pinta é a composição da cor com o
 * que estiver embaixo, e nenhuma conta feita só com `tailwind.config.ts` sabe
 * o que está embaixo. Tratar os dois como iguais produzia falso positivo puro
 * — a primeira versão deste gate acusou `bone-50 sobre gold-500` (2,03:1) no
 * chip de filtro ativo, que na tela é `bone-50` sobre `gold-500 a 20%` sobre
 * `navy-950`, perfeitamente legível. Pixel composto continua entrando à mão,
 * em `RESOLVIDAS`, com a medição do navegador do lado.
 */
function tokensDeClasse(texto, prefixo) {
  const achados = new Set();
  const re = new RegExp(
    `(?:^|[\\s"'\`{}(\\[])${prefixo}-([a-zA-Z]+)-([\\w-]+?)(?=[\\s"'\`{}()\\]]|$)`,
    "g",
  );
  for (const m of texto.matchAll(re)) {
    const nome = `${m[1]}-${m[2]}`;
    if (T[nome]) achados.add(nome);
  }
  return achados;
}

/** Tokens de texto que são cor de ÍCONE decorativo (régua 3:1), não de texto. */
const ICONES_DECORATIVOS = [];

/**
 * Comentário não é tela. Uma linha que só FALA de uma cor (o registro de "era
 * `bone-500`, virou `bone-400`", que esta rodada escreveu no próprio
 * componente) não pinta nada, e contá-la faria o gate acusar a sua própria
 * documentação. Some o corpo dos comentários mantendo as quebras de linha,
 * para `arquivo:linha` continuar apontando o lugar certo.
 */
function semComentarios(conteudo) {
  const embranquece = (trecho) => trecho.replace(/[^\n]/g, " ");
  return conteudo
    .replace(/\/\*[\s\S]*?\*\//g, embranquece)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m) => m[0] + embranquece(m.slice(1)));
}

const textoUsado = new Map(); // token → [arquivo:linha]
/** arquivo → [canal:linha] — onde uma cor entra fora de `text-<token>`. */
const literaisPorArquivo = new Map();
function anotarLiteral(ondeArquivo, canal, i) {
  if (!literaisPorArquivo.has(ondeArquivo)) literaisPorArquivo.set(ondeArquivo, []);
  literaisPorArquivo.get(ondeArquivo).push(`${canal} (linha ${String(i + 1)})`);
}

for (const arquivo of arquivosDeFonte(RAIZ_SRC)) {
  const conteudo = semComentarios(readFileSync(arquivo, "utf8"));
  const ondeArquivo = relative(RAIZ_SRC, arquivo);
  conteudo.split("\n").forEach((linha, i) => {
    for (const t of tokensDeClasse(linha, "text")) {
      if (!textoUsado.has(t)) textoUsado.set(t, []);
      textoUsado.get(t).push(`${ondeArquivo}:${String(i + 1)}`);
    }
    for (const canal of CANAIS_ESCONDIDOS) {
      if (canal.re.test(linha)) anotarLiteral(ondeArquivo, canal.nome, i);
    }
  });
}
for (const arquivo of arquivosDeFonte(RAIZ_SRC, /\.css$/)) {
  const ondeArquivo = relative(RAIZ_SRC, arquivo);
  readFileSync(arquivo, "utf8")
    .split("\n")
    .forEach((linha, i) => {
      if (/color-scheme/.test(linha)) return;
      if (CANAL_CSS.test(linha)) anotarLiteral(ondeArquivo, "cor em arquivo CSS", i);
    });
}

const tokensNaRegua = new Set(PARES.map(([t]) => t));
/**
 * Rodada 11 (achado ALTO 2): "estar na régua" deixou de bastar. Um token só
 * pode ser COR DE TEXTO se tiver ao menos um par medido com a régua de TEXTO
 * (4,5:1). `navy-700` só existia como borda a 3:1 — e era exatamente essa
 * brecha que deixava um texto a 2,76:1 passar com tudo verde.
 */
const tokensComParDeTexto = new Set(PARES.filter(([, , min]) => min >= 4.5).map(([t]) => t));
const derivados = [];
let derivadosFalhos = 0;

for (const [token, ondes] of [...textoUsado].sort()) {
  if (ICONES_DECORATIVOS.includes(token)) continue;
  const onde3 = ondes.slice(0, 3).join(", ");
  if (!tokensNaRegua.has(token)) {
    derivadosFalhos++;
    derivados.push(`FALHA  token de TEXTO usado no código e ausente da régua: ${token}  — ${onde3}`);
    continue;
  }
  if (!tokensComParDeTexto.has(token)) {
    derivadosFalhos++;
    derivados.push(
      `FALHA  token usado como TEXTO mas só registrado em par decorativo (< 4,5:1): ${token}  — ${onde3}`,
    );
  }
}
for (const exceção of ICONES_DECORATIVOS) {
  if (textoUsado.has(exceção)) continue;
  derivadosFalhos++;
  derivados.push(`FALHA  exceção de ícone decorativo sem uso no código: ${exceção}`);
}

// ── Os três canais escondidos ──────────────────────────────────────────────
const declarados = new Map(ARQUIVOS_COM_COR_LITERAL.map((d) => [d.arquivo, d]));
for (const [arquivo, ocorrencias] of [...literaisPorArquivo].sort()) {
  const d = declarados.get(arquivo);
  if (!d) {
    derivadosFalhos++;
    derivados.push(
      `FALHA  cor de texto fora de \`text-<token>\` em arquivo NÃO declarado: ${arquivo} — ${ocorrencias
        .slice(0, 3)
        .join(", ")}`,
    );
    continue;
  }
  const semPar = d.pares.filter((c) => !tokensNaRegua.has(c));
  if (semPar.length > 0) {
    derivadosFalhos++;
    derivados.push(
      `FALHA  arquivo declarado com par ausente da régua: ${arquivo} — ${semPar.join(", ")}`,
    );
  }
}
for (const d of ARQUIVOS_COM_COR_LITERAL) {
  if (literaisPorArquivo.has(d.arquivo)) continue;
  derivadosFalhos++;
  derivados.push(`FALHA  arquivo declarado que não usa mais cor literal: ${d.arquivo}`);
}

let falhou = derivadosFalhos;
const linhas = [];
for (const [t, f, min, onde] of PARES) {
  const corT = resolveCor(t);
  const corF = resolveCor(f);
  if (!corT || !corF) {
    // Nunca interpolar variável no 1º argumento de `console.*` — o analisador
    // de segurança do GitHub reprova a forma, mesmo com dado local.
    console.error("token ausente: %s ou %s", t, f);
    falhou++;
    continue;
  }
  const r = razao(corT, corF);
  const ok = r >= min;
  if (!ok) falhou++;
  linhas.push(
    `${ok ? "ok  " : "FALHA"} ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${t} sobre ${f}  — ${onde}`,
  );
}

console.log("%s", linhas.join("\n"));
console.log(
  "%s",
  derivados.length === 0
    ? `\nderivado do código: ${String(textoUsado.size)} tokens usados como cor de texto em src/ — todos com par de TEXTO (≥ 4,5:1) na régua; ${String(literaisPorArquivo.size)} arquivo(s) pintando cor fora de \`text-<token>\`, todos declarados.`
    : `\nderivado do código (${String(derivados.length)} problema(s)):\n${derivados.join("\n")}`,
);
console.log(
  "%s",
  falhou === 0
    ? `\n${String(PARES.length)} pares verificados, todos dentro da régua.`
    : `\n${String(falhou)} item(ns) fora da régua.`,
);
process.exit(falhou === 0 ? 0 : 1);
