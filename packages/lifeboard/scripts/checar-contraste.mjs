/**
 * Régua de contraste (UI/UX §3: "contraste ≥ 4,5:1, placeholder e ajuda contam").
 *
 * Lê os tokens de `tailwind.config.ts` e verifica cada par texto × fundo que a
 * interface realmente usa. Falha com código 1 se algum par cair abaixo de 4,5:1
 * (3:1 para o que é só borda/ícone decorativo, conforme WCAG 1.4.11).
 *
 * Rodar: `node scripts/checar-contraste.mjs`
 */
import { readFileSync } from "node:fs";

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
  ["fonte-github", "navy-850", 4.5, "rótulo da fonte GitHub (frentes → tarefas, 25/09)"],
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
];

/**
 * ── A COR QUE O GRAFO DE FATO PINTA (achado ALTO 4 da rodada 11) ──────────
 *
 * Até aqui esta régua lia SÓ `tailwind.config.ts`. O grafo não consome esses
 * tokens: `src/components/graph/aresta-svg.tsx` tem hex literais próprios
 * (`stroke`/`fill` do SVG não aceitam classe Tailwind). Eram DUAS tabelas de
 * hex para a mesma cor, sem nenhum teste entre elas — e o crítico trocou UM
 * hex lá (`sucessao` #5FE39A → #1A2238, 12,40:1 → 1,27:1 contra o canvas) com
 * os cinco portões verdes, este aqui imprimindo "64 pares verificados, todos
 * dentro da régua".
 *
 * Duas coisas fecham o buraco, e as duas moram aqui:
 *  1. A régua passa a medir a cor do ARQUIVO QUE DESENHA, contra o fundo do
 *     canvas (`navy-950`), com o mínimo de traço (3:1).
 *  2. As duas tabelas têm de ser IGUAIS, papel a papel. Divergir é falha —
 *     não importa qual das duas está "certa". (O mesmo casamento é testado em
 *     `tests/unit/cor-da-aresta-uma-fonte-so.test.ts`, para o portão de teste
 *     também morder, e é conferido pela guarda de navegador, que deriva o
 *     contrato dos DOIS lados.)
 */
const fonteDaAresta = readFileSync(
  new URL("../src/components/graph/aresta-svg.tsx", import.meta.url),
  "utf8",
);

/** Papel de aresta → token de `tailwind.config.ts` que ele tem de espelhar. */
const TOKEN_DO_PAPEL = {
  sucessao: "aresta-sucessao",
  correlacao: "aresta-correlacao",
  sinergia: "aresta-sinergia",
  obsolescencia: "aresta-obsolescenciaHue",
  critico: "aresta-critico",
  destacada: "aresta-predecessor",
};

function coresQueOGrafoPinta() {
  const bloco = /export const ARESTA_STROKE:[\s\S]*?=\s*\{([\s\S]*?)\n\};/.exec(fonteDaAresta);
  if (!bloco) throw new Error("não achei ARESTA_STROKE em src/components/graph/aresta-svg.tsx");
  const cores = {};
  for (const m of bloco[1].matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{6})"/g)) cores[m[1]] = m[2];
  const critico = /ARESTA_STROKE_CRITICO\s*=\s*"(#[0-9A-Fa-f]{6})"/.exec(fonteDaAresta);
  const destacada = /ARESTA_STROKE_DESTACADA\s*=\s*"(#[0-9A-Fa-f]{6})"/.exec(fonteDaAresta);
  if (!critico || !destacada) throw new Error("não achei ARESTA_STROKE_CRITICO/DESTACADA");
  cores.critico = critico[1];
  cores.destacada = destacada[1];
  return cores;
}

const CORES_DO_GRAFO = coresQueOGrafoPinta();
const papeisSemCor = Object.keys(TOKEN_DO_PAPEL).filter((p) => !CORES_DO_GRAFO[p]);
if (papeisSemCor.length > 0) {
  console.error(
    `papel de aresta sem cor em aresta-svg.tsx: ${papeisSemCor.join(", ")} — a régua de contraste não sabe medir o que o grafo pinta`,
  );
  process.exit(1);
}
/**
 * ── O PISO DE VISIBILIDADE DO TRAÇO, COM NOME (rodada 12) ─────────────────
 *
 * Era o literal `3` no meio do laço abaixo. Ganhou nome porque deixou de ser
 * só um número desta régua: a guarda de navegador (`guarda-no-navegador.mjs`,
 * §7 e §9) passa a cobrar ESTE MESMO número do PIXEL COMPOSTO que ela
 * fotografa, e vai buscá-lo aqui, lendo este arquivo — nunca escrevendo um
 * número próprio.
 *
 * Por que importava: a rodada 11 mediu a COR do pixel pelo modelo de mistura
 * (`P = α·C + (1 − α)·B`, distância até a reta B→C) e nunca mediu o **α**.
 * Qualquer ponto da reta passava, inclusive α perto de zero. Medido pelo
 * coordenador: `opacity: 0.12` no `<g>` da aresta leva a sucessão de 12,40:1
 * para 1,21:1 contra o canvas — o grafo inteiro quase invisível — com os
 * CINCO portões verdes, este arquivo inclusive (ele mede o hex DECLARADO, e a
 * opacidade é aplicada na composição: a cor declarada continua `#5FE39A`).
 *
 * São duas perguntas, e as duas têm de ser feitas: "está na cor certa?" (a
 * reta) e "está visível o bastante para um humano?" (o α). Esta constante é a
 * resposta da segunda, e ela mora AQUI — na régua de contraste da casa — e
 * não no arquivo que decide a cor nem na guarda que mede.
 */
export const PISO_DE_CONTRASTE_DA_ARESTA = 3;

for (const [papel, cor] of Object.entries(CORES_DO_GRAFO)) {
  RESOLVIDAS[`grafo-${papel}`] = cor;
  PARES.push([
    `grafo-${papel}`,
    "navy-950",
    PISO_DE_CONTRASTE_DA_ARESTA,
    `traço da aresta "${papel}" COMO O GRAFO PINTA (hex de aresta-svg.tsx, não o token) — P4 rodada 11 ALTO 4`,
  ]);
}

/** As duas tabelas de hex têm de dizer a mesma coisa, papel a papel. */
let divergencias = 0;
for (const [papel, token] of Object.entries(TOKEN_DO_PAPEL)) {
  const noGrafo = CORES_DO_GRAFO[papel];
  const noTema = T[token];
  if (!noTema) {
    console.error(`token ${token} não existe em tailwind.config.ts (papel "${papel}")`);
    divergencias += 1;
  } else if (noTema.toUpperCase() !== noGrafo.toUpperCase()) {
    console.error(
      `DUAS TABELAS DE HEX DIVERGEM no papel "${papel}": aresta-svg.tsx pinta ${noGrafo} e o token ${token} de tailwind.config.ts diz ${noTema}. Uma cor, uma fonte.`,
    );
    divergencias += 1;
  }
}

/** Nome de token em `tailwind.config.ts` OU chave já resolvida em `RESOLVIDAS` (pixel composto). */
function resolveCor(nome) {
  return T[nome] ?? RESOLVIDAS[nome];
}

/**
 * MÉDIO 3 (crítico da rodada 14): ESTE PORTÃO CONTAVA A SI MESMO.
 *
 * A mensagem final era `${PARES.length} pares verificados` — o número que
 * servia de prova saía do PRÓPRIO array auditado. Apagar um par baixava os
 * dois lados da conta e o portão dizia verde, com a contagem já ajustada para
 * não chamar atenção. O crítico apagou as NOVE linhas de `PARES` que dizem
 * `(P7` — todas as medições de acessibilidade da tela desta peça, o
 * `role=alert` da recusa da fila entre elas — e o portão devolveu
 * `55 pares verificados, todos dentro da régua`, saída 0, com os outros quatro
 * portões verdes.
 *
 * É o MESMO defeito que a rodada 13 matou em `rodar-suite-sql.sh`
 * (`ESPERADOS="$(grep -c … "$SUITE")"`), vivo e intacto em outro arquivo,
 * porque ninguém generalizou. O remédio é o mesmo da rodada 13, nas duas
 * formas que ele tem:
 *
 *   · PISO NUMÉRICO — um número escrito à mão. Encolher a régua passa a exigir
 *     baixar o piso num diff de uma linha, que é uma frase em voz alta ("a
 *     régua encolheu"). Acrescentar par não pede nada aqui.
 *   · LISTA NOMINAL — as medições que não podem desaparecer, cada uma pelo que
 *     ela mede, fora do array. Piso sozinho se atravessa: apagar os 9 pares do
 *     P7 e acrescentar 9 pares triviais mantém a contagem. É por isso que são
 *     duas guardas e não uma.
 *
 * O par ausente não é o que `resolveCor` pega: token inexistente REPROVA
 * (`token ausente` → `falhou++`). O que não reprovava é o par que simplesmente
 * deixa de existir.
 */
const PISO_DE_PARES = 64;

/**
 * As MEDIÇÕES que não podem sair da régua, identificadas pelo que elas medem —
 * não pelo par de tokens. Medido: `texto|fundo` não serve de chave, porque
 * `bone-400 sobre navy-850` aparece em três linhas diferentes; apagar as nove
 * do P7 deixava oito das chaves ainda "presentes" por causa de linhas de outra
 * tela, e a lista nominal acusava uma só. A chave é um trecho da DESCRIÇÃO,
 * que é única por medição.
 */
const MEDICOES_EXIGIDAS = [
  // o texto e o fundo da app, que toda tela usa
  "texto principal sobre o fundo da app",
  "texto principal sobre painel",
  "texto secundário do cartão",
  // P7 · a tela da fila de prompts (as 9 que o crítico apagou)
  "placeholder do textarea de novo prompt",
  "legenda de complexidades no rodapé do formulário",
  "trilho da barra de progresso do cartão de conta",
  "'sem medição nenhuma' no cartão de conta",
  "'última medição há N h' no cartão de conta",
  "teto × faixa real dos dias medidos no cartão",
  "aviso 'isto entrou no gasto de hoje' na linha da fila",
  "sucesso mudo da fila (cancelamento sem custo)",
  "recusa em português da fila, role=alert",
];

let falhou = divergencias;
const linhas = [];

if (PARES.length < PISO_DE_PARES) {
  console.error(
    `a régua encolheu: ${PARES.length} pares, piso ${PISO_DE_PARES}. ` +
      "Se a remoção é de propósito, baixe o PISO_DE_PARES no mesmo commit e diga por quê.",
  );
  falhou++;
}

{
  const descricoes = PARES.map(([, , , onde]) => onde);
  const ausentes = MEDICOES_EXIGIDAS.filter((k) => !descricoes.some((d) => d.includes(k)));
  if (ausentes.length > 0) {
    console.error(
      `medição(ões) exigida(s) que saíram da régua:\n  - ${ausentes.join("\n  - ")}`,
    );
    falhou += ausentes.length;
  }
}

for (const [t, f, min, onde] of PARES) {
  const corT = resolveCor(t);
  const corF = resolveCor(f);
  if (!corT || !corF) {
    console.error(`token ausente: ${t} ou ${f}`);
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

console.log(linhas.join("\n"));
console.log(
  falhou === 0
    ? `\n${PARES.length} pares verificados (piso ${PISO_DE_PARES}, ` +
        `${MEDICOES_EXIGIDAS.length} exigidas por nome), todos dentro da régua; as ${String(Object.keys(TOKEN_DO_PAPEL).length)} cores de aresta batem entre aresta-svg.tsx e tailwind.config.ts.`
    : `\n${falhou} problema(s): par abaixo da régua, medição exigida ausente, régua abaixo do piso ou hex divergente entre as duas tabelas de cor da aresta.`,
);
process.exit(falhou === 0 ? 0 : 1);
