/**
 * OS-LIFEBOARD · P5 — rodada 10. A GUARDA NO NAVEGADOR.
 *
 * ## Por que ela existe (achado ALTO 2 do crítico hostil)
 *
 * A guarda "de comportamento" da rodada 10 (`tests/unit/linha-do-tempo-guarda-
 * de-comportamento.test.ts`) dizia medir a tela e não importava nenhum módulo
 * de `src/components/`: ela roda funções puras contra um modelo de navegador
 * escrito no próprio arquivo. Duas sabotagens de uma linha passaram por ela
 * com 1354/1354 verdes:
 *
 *   S1  `aplicarPlanoDaFolha(podeRolar ? plano : semRolagem(plano), …)`
 *       → `aplicarPlanoDaFolha(semRolagem(plano), …)`
 *       a 390×844 a folha voltava a tapar 100% do rótulo e da barra tocada.
 *   S2  `border-l-2 border-gold-500` → `border-l-2 border-transparent`
 *       a faixa do "Hoje" passava a 0px visíveis.
 *
 * S2 cai também no Vitest (`tests/unit/linha-do-tempo-componente.test.tsx`,
 * que resolve a cor no tema e MEDE o contraste). S1 não tem como cair lá: ela
 * só se manifesta como dois retângulos se sobrepondo depois de layout,
 * rolagem e `requestAnimationFrame`. Nada disso existe sem navegador — e
 * escrever um terceiro simulador para fingir que existe seria repetir o
 * próprio ALTO 2. Então S1 se mede aqui, no Chromium, contra a rota real.
 *
 * ## Como rodar
 *
 *   # 1. a rota real, com o quadro de fixture
 *   LIFEBOARD_DATA_MODE=fixture npx next dev -p 3751
 *   # 2. a guarda (precisa de um Chromium e do playwright-core)
 *   PLAYWRIGHT_MODULO=<caminho do playwright-core> \
 *   PLAYWRIGHT_CHROMIUM=<caminho do chrome> \
 *   node tests/navegador/guarda-p5.mjs
 *
 * Sai com código 1 na primeira medição fora da régua, nomeando o número. Não
 * entra em `npx vitest run` de propósito: um portão que exige servidor de pé
 * e navegador instalado travaria a suíte de quem só quer rodar os testes
 * puros. É portão de rodada de correção, e o relatório de cada rodada cola a
 * saída dele.
 *
 * ## O que ela mede, e nada além
 *
 * | # | medida | régua |
 * |---|---|---|
 * | A | a faixa do "Hoje" PINTADA: alfa composto + o pixel na tela | alfa real > 0, ≥ 2px, e pixel que muda ao esconder |
 * | B | área da folha inferior sobre a linha tocada, a 390×844 | 0 px² nas 3 últimas linhas |
 * | C | a gaveta e o desenho da MESMA linha dizem o mesmo período | 0 divergências nas 27 linhas, 0 contradições |
 * | D | contraste computado do rótulo riscado | ≥ 4,5:1 |
 * | E | ordem vertical dos assuntos, pela DATA do texto (nunca o pixel) | 0 inversões de data |
 * | F | fechar a gaveta não mexe a página | Δ`scrollY` = 0 |
 * | G | o chip do período inteiro ou ausente, com o ano na tela | 0 cacos, 0 sem ano |
 * | H | **cada afirmação de data no pixel que a data manda** | ±1,5 px contra a régua desenhada |
 * | I | **o PAR real de cada texto visível**, todas as gavetas, 3 zooms, 2 larguras | ≥ 4,5:1 (3:1 texto grande) |
 * | J | **barra só existe com duas datas declaradas no próprio texto** | 0 barras sem data, 0 linhas sem dado na grade |
 * | K | **abrir a gaveta não re-escala o eixo** | Δ`px/dia` = 0 e Δ`left` da barra tocada = 0 |
 * | M | **o eixo imprime a data que a régua manda** (rótulos do cabeçalho) | 0 divergências em 7 cenas por estado |
 * | N | **toda camada que a guarda afirma ver está PINTADA** | alfa real > 0 E pixel que muda ao esconder |
 * | O | **nenhum mecanismo desenhado soma ZERO nos 4 estados** | ≥ 1 de cada mecanismo obrigatório |
 * | P | **todo item fora da janela diz a sua data por escrito na coluna** | 1 rótulo datado por chevron |
 *
 * ## Rodada 11 — por que H, I e J nasceram
 *
 * **H (achado ALTO 1).** Nenhuma das três camadas de guarda amarrava um pixel
 * a uma data. O crítico somou `+ 3` dentro de `xFor` — o ponto único de
 * posicionamento das barras — e passou por tudo: 1363 testes verdes, `tsc`
 * limpo, contraste 70/70 e esta guarda 8/8. A medida E ("o `left` nunca
 * desce") RELATOU o deslocamento nos próprios números e aprovou, porque
 * monotonicidade é invariante a translação. Na tela, toda barra andava 3 dias
 * enquanto a faixa do "Hoje" e os rótulos do eixo ficavam onde estavam: o
 * losango "mesmo dia, 21/09" nascia À DIREITA da linha do "Hoje".
 *
 * A régua de H **não passa por `xFor`**, ou ela mediria a mentira contra ela
 * mesma. Ela é o que está DESENHADO no mesmo canvas das barras:
 *
 *   - as **guias de segunda-feira** (`.lb-tl-guia-semana`, de
 *     `gerarEscalaEixo`) dão `px/dia` — são 7 dias exatos entre duas;
 *   - a **faixa do "Hoje"** (`.lb-tl-hoje[data-lb-hoje]`, de `xHoje`) dá a
 *     origem: é o único pixel do canvas cuja data o componente declara;
 *   - e as duas se conferem: cada guia tem de cair num dia que, contado a
 *     partir de "hoje", seja mesmo uma segunda-feira.
 *
 * Com a régua de pé, cada barra é convertida de volta para data e comparada
 * com a data que o **próprio `title` dela declara** — o texto que o operador
 * lê. Três fontes independentes (eixo, âncora, texto) cruzadas num número.
 *
 * **I (achado ALTO 2).** O medidor "derivado do código"
 * (`scripts/checar-contraste.mjs`) confere o token, nunca o par: exigia que
 * todo token usado como `text-*` aparecesse em ALGUM par, e um par de borda
 * decorativa a 3:1 virava passe livre para o mesmo token ser texto corrido.
 * O crítico trocou `text-bone-300`/`text-bone-100` por `text-navy-700` nas
 * duas gavetas e o script imprimiu "todos na régua" — o Chromium media
 * 2,76:1. E três canais inteiros eram invisíveis para ele: valor arbitrário
 * (`text-[#3a3a3a]`), `style={{ color }}` e cor vinda de CSS. I mede o que o
 * navegador pinta: cor computada de cada nó de texto visível contra o fundo
 * REAL (subindo até o primeiro ancestral opaco e compondo alfa e `opacity`
 * no caminho) — com as DUAS gavetas abertas, que é onde a sabotagem mora.
 *
 * ## Rodada 12 — o que mudou, e por quê
 *
 * O vício desta base apareceu dez vezes com a mesma forma — *a guarda mede a
 * hipótese, não o produto* — e a rodada 12 encontrou a versão mais irônica
 * dele: **dentro da medida escrita para curar a versão anterior do mesmo
 * erro.** A medida A dizia, no próprio comentário, medir "a faixa do Hoje como
 * o navegador a pinta", e lia três canais que `opacity` não toca. Uma classe
 * `opacity-0` apagou 1.134 px de faixa dourada com os cinco portões verdes.
 *
 * As correções, e a regra que cada uma instala:
 *
 * - **A, N (CRÍTICO 1).** Nenhuma medida de "isto está visível?" lê atributo
 *   declarado. `pintaDeVerdade` fotografa a janelinha do elemento COM e SEM
 *   ele e exige as duas coisas: pixels na cor que o compositor deve pintar, e
 *   pixels que MUDAM quando o elemento sai. N aplica isso às 10 camadas sobre
 *   as quais alguma medida deste arquivo faz alguma afirmação.
 * - **M (CRÍTICO 2).** Os rótulos de data do eixo entram na MESMA régua das
 *   barras, pelo caminho inverso (posição → data → o número impresso), em 5
 *   posições de rolagem e 2 resizes tardios: uma afirmação que só vale no
 *   primeiro quadro não vale.
 * - **H, O (ALTO 1).** A coleta é DERIVADA do que cada elemento afirma, não de
 *   três seletores escritos à mão; o que fica fora sai por exceção declarada
 *   COM conferência própria; uma classe `lb-tl-*` nova REPROVA até alguém
 *   dizer como ela se mede; e nenhum mecanismo obrigatório pode somar zero.
 * - **I (ALTO 2).** Todas as gavetas, nos 3 zooms e nas 2 larguras — e o que
 *   ela não cobre está escrito no relatório dela.
 * - **P (ALTO 3).** Cada "◀"/"▶" do canvas tem de ter, na coluna de rótulos,
 *   um texto VISÍVEL com a sua data-âncora: `title` não existe no toque.
 * - **C (MÉDIO 1).** Compara de verdade o "Período" da gaveta com o texto do
 *   desenho da mesma linha, nas 27 linhas da tela.
 * - **E (MÉDIO 2).** Lê a DATA do texto, não o pixel clampado: a ordenação
 *   ganhou poder de reprovar, e a posição continua sendo assunto de H.
 *
 * **J (achado MÉDIO 3).** O texto parou de mentir na rodada 10; o desenho
 * não. Quatro tarefas cujo próprio `title` dizia "sem início nem duração
 * registrados" eram desenhadas em `left` = a faixa do "Hoje" e `width` = 1
 * dia exato — idênticas a uma tarefa de 1 dia real; e a 390px, com o piso de
 * largura, idênticas também a uma de 0,5 dia. J exige o contrário: uma barra
 * só existe se o texto dela declarar as DUAS datas, e uma linha marcada como
 * fora da grade não pode ter barra nenhuma.
 */

/*
 * Os nomes abaixo NÃO existem neste arquivo: eles existem dentro dos
 * `pagina.evaluate(...)`, que o Playwright serializa e roda no CONTEXTO DA
 * PÁGINA, dentro do Chromium. Declarados como globais para o ESLint saber
 * disso — é uma declaração de ambiente, não um silenciamento de regra.
 */
/* global document, window, getComputedStyle, requestAnimationFrame, CSS */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * ESTA GUARDA SOBE O PRÓPRIO SERVIDOR.
 *
 * A primeira versão se conectava a uma porta fixa e media o que estivesse
 * lá. Numa máquina com várias cópias do repositório abertas — que é o caso
 * quando várias correções rodam em paralelo —, ela media a árvore de outra
 * pessoa e dizia VERDE, inclusive com uma sabotagem aplicada na árvore de
 * verdade. Isso foi medido, não suposto. Medir o produto não é só abrir o
 * navegador: é garantir que o que está do outro lado é ESTE código.
 *
 * `LIFEBOARD_URL` continua existindo para quem quiser apontar para um
 * servidor já no ar — e assume a responsabilidade de ele servir esta árvore.
 */
const RAIZ_DO_PACOTE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Uma porta que o sistema operacional garante estar livre agora. */
async function portaLivre() {
  return await new Promise((resolver, rejeitar) => {
    const s = createServer();
    s.on("error", rejeitar);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolver(port));
    });
  });
}

/** Espera o servidor responder, ou desiste. */
async function esperarResponder(base, limiteMs) {
  const ate = Date.now() + limiteMs;
  while (Date.now() < ate) {
    try {
      const r = await fetch(base, { signal: globalThis.AbortSignal.timeout(5000) });
      if (r.ok) return true;
    } catch {
      // ainda compilando; tenta de novo
    }
    await new Promise((ok) => setTimeout(ok, 500));
  }
  return false;
}

/** Sobe `next dev` a partir DESTE pacote, em porta livre, no modo fixture. */
async function subirServidorProprio() {
  const req = createRequire(import.meta.url);
  let binarioDoNext;
  try {
    binarioDoNext = join(dirname(req.resolve("next/package.json")), "dist", "bin", "next");
  } catch {
    return null;
  }
  const porta = await portaLivre();
  const base = `http://127.0.0.1:${String(porta)}`;
  const filho = spawn(process.execPath, [binarioDoNext, "dev", "-p", String(porta)], {
    cwd: RAIZ_DO_PACOTE,
    env: { ...process.env, LIFEBOARD_DATA_MODE: "fixture" },
    stdio: "ignore",
  });
  const encerrar = () => {
    try {
      filho.kill("SIGTERM");
    } catch {
      // já morreu
    }
  };
  process.on("exit", encerrar);
  if (!(await esperarResponder(base, 180000))) {
    encerrar();
    return null;
  }
  return { base, encerrar };
}

let encerrarServidor = () => {};
let BASE = process.env.LIFEBOARD_URL ?? null;
if (BASE === null) {
  const proprio = await subirServidorProprio();
  if (proprio === null) {
    console.error(
      "%s",
      "guarda-p5: não consegui subir o servidor deste pacote. Rode `npm install` na raiz, ou aponte LIFEBOARD_URL para um servidor que sirva ESTA árvore.",
    );
    process.exit(2);
  }
  BASE = proprio.base;
  encerrarServidor = proprio.encerrar;
  console.log("%s", `servidor próprio no ar em ${BASE} (subido por esta guarda)`);
}
const ROTA = `${BASE}/linha-do-tempo`;
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? undefined;

/*
 * `playwright-core` é CommonJS: quando o caminho vem por variável de ambiente
 * (o ambiente de CI da casa não instala navegador, então o módulo mora fora
 * do pacote), o `import()` devolve os nomes em `default`. Ler os dois lugares
 * evita o `chromium is undefined` que parece "playwright quebrado" e é só
 * formato de módulo.
 */
const moduloDoPlaywright = await import(process.env.PLAYWRIGHT_MODULO ?? "playwright-core");
const chromium = moduloDoPlaywright.chromium ?? moduloDoPlaywright.default?.chromium;
if (!chromium) {
  console.error("%s", "guarda-p5: não achei o `chromium` do playwright-core. Aponte PLAYWRIGHT_MODULO para o arquivo de entrada do pacote.");
  process.exit(2);
}

const falhas = [];
const medidas = [];

function conferir(nome, ok, detalhe) {
  medidas.push(`${ok ? "ok   " : "FALHA"} ${nome} — ${detalhe}`);
  if (!ok) falhas.push(nome);
}

const navegador = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});

async function abrir(largura, altura) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura } });
  /*
   * Rodada 12: os ajudantes de alfa composto entram ANTES do carregamento —
   * assim toda medida os tem, inclusive as que rodam no primeiro quadro. Foi
   * a falta de um lugar comum que deixou a medida A com a própria conta de
   * "visível" enquanto a medida I, no mesmo arquivo, já compunha alfa certo.
   */
  await contexto.addInitScript({ content: AJUDANTES_NA_PAGINA });
  const pagina = await contexto.newPage();
  await pagina.goto(ROTA, { waitUntil: "networkidle" });
  /*
   * `state: "attached"`, e não o "visible" que é o padrão do Playwright.
   * Medido com uma sabotagem própria da rodada 12 (`invisible` na faixa do
   * "Hoje", em vez de `opacity-0`): com "visible" a guarda ficava 30s
   * esperando a faixa aparecer e MORRIA com um TimeoutError — reprovava, sim,
   * mas com um rastro de pilha em vez de dizer qual camada não pinta. Uma
   * guarda que trava na invisibilidade não a MEDE. Esperando só o elemento
   * existir, as medidas A e N rodam e nomeiam o defeito.
   */
  await pagina.waitForSelector(".lb-tl-hoje", { timeout: 20000, state: "attached" });
  await pagina.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
  return { contexto, pagina };
}

/** `rgb(…)`/`rgba(…)` → `[r, g, b, a]`. */
function corEmCanais(css) {
  const n = (css.match(/[\d.]+/g) ?? []).map(Number);
  return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
}

function luminancia([r, g, b]) {
  const canal = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function razao(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RODADA 12 · O PIXEL, NÃO O ATRIBUTO DECLARADO (achado CRÍTICO 1)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A medida A da rodada 11 dizia, no PRÓPRIO COMENTÁRIO, medir "a faixa do
 * Hoje como o navegador a pinta" — e lia três canais que `opacity` não toca:
 * `borderLeftColor`, `borderLeftWidth` e `getBoundingClientRect().height`.
 * Uma classe `opacity-0` na faixa apagou 1.134 px de dourado da tela com os
 * CINCO portões verdes, e a medida A imprimiu, sobre a faixa apagada,
 * "2/2 faixas com alfa > 0, ≥ 2px e altura > 0". Medido em pixel: 240 pixels
 * dourados na coluna da faixa viraram 0.
 *
 * A ironia é a lição — o arquivo JÁ TINHA a ferramenta certa: o ajudante da
 * medida I sobe a árvore compondo `opacity` e alfa. A medida A não usava. Daí
 * a regra desta rodada, que vale para toda medida deste arquivo:
 *
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ NENHUMA medida de "isto está visível?" pode ler atributo declarado.  │
 *   │ Ou compõe o alfa REAL subindo a árvore, ou AMOSTRA O PIXEL que o     │
 *   │ compositor do navegador pintou. As afirmações que sustentam a peça   │
 *   │ (a régua, as barras, os rótulos datados) fazem as DUAS coisas.       │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * ## Por que a amostra de pixel é feita COM E SEM o elemento
 *
 * A primeira versão desta ferramenta comparava a coluna do elemento com uma
 * coluna de controle 8 px ao lado. Duas sabotagens minhas passaram por ela:
 * pintar o FUNDO do canvas da cor da faixa (a coluna do elemento fica cheia
 * de dourado sem faixa nenhuma), e mover a faixa para debaixo de outro
 * elemento dourado. A geometria do controle é sempre um chute.
 *
 * A versão abaixo não chuta: tira a foto da mesma janelinha DUAS vezes, a
 * segunda com `visibility: hidden` no próprio elemento, e exige as duas
 * coisas ao mesmo tempo —
 *
 *   (a) os pixels de lá estão na cor que o elemento DECLARA (senão a medida
 *       aprovaria um elemento que pinta qualquer coisa), e
 *   (b) esconder o elemento MUDA aqueles pixels (senão quem pinta é outro).
 *
 * `opacity: 0` cai em (b): a foto com e sem o elemento é idêntica. Fundo
 * pintado da cor da faixa cai em (b) também. Cor trocada cai em (a). É a
 * propriedade da classe, não o número de uma sabotagem específica.
 */

/** ── PNG → pixels, com `node:zlib` e nada mais (nenhum pacote novo). ────── */
function lerPng(buffer) {
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("não é PNG");
  let pos = 8;
  let largura = 0;
  let altura = 0;
  let profundidade = 0;
  let tipoDeCor = -1;
  let entrelacado = 0;
  const pedacos = [];
  while (pos + 8 <= buffer.length) {
    const tamanho = buffer.readUInt32BE(pos);
    const tipo = buffer.toString("ascii", pos + 4, pos + 8);
    const dados = buffer.subarray(pos + 8, pos + 8 + tamanho);
    if (tipo === "IHDR") {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      profundidade = dados[8];
      tipoDeCor = dados[9];
      entrelacado = dados[12];
    } else if (tipo === "IDAT") pedacos.push(Buffer.from(dados));
    else if (tipo === "IEND") break;
    pos += 12 + tamanho;
  }
  if (profundidade !== 8 || entrelacado !== 0 || ![0, 2, 4, 6].includes(tipoDeCor)) {
    throw new Error(
      `PNG fora do que este decodificador lê: bits=${String(profundidade)} cor=${String(tipoDeCor)} entrelaçado=${String(entrelacado)}`,
    );
  }
  const canais = { 0: 1, 2: 3, 4: 2, 6: 4 }[tipoDeCor];
  const cru = zlib.inflateSync(Buffer.concat(pedacos));
  const linhaBytes = largura * canais;
  const saida = Buffer.alloc(altura * linhaBytes);
  let p = 0;
  for (let y = 0; y < altura; y += 1) {
    const filtro = cru[p];
    p += 1;
    const linha = cru.subarray(p, p + linhaBytes);
    p += linhaBytes;
    const destino = saida.subarray(y * linhaBytes, (y + 1) * linhaBytes);
    const acima = y > 0 ? saida.subarray((y - 1) * linhaBytes, y * linhaBytes) : null;
    for (let x = 0; x < linhaBytes; x += 1) {
      const bruto = linha[x];
      const a = x >= canais ? destino[x - canais] : 0;
      const b = acima ? acima[x] : 0;
      const c = acima && x >= canais ? acima[x - canais] : 0;
      let valor;
      if (filtro === 0) valor = bruto;
      else if (filtro === 1) valor = bruto + a;
      else if (filtro === 2) valor = bruto + b;
      else if (filtro === 3) valor = bruto + ((a + b) >> 1);
      else if (filtro === 4) {
        const pr = a + b - c;
        const pa = Math.abs(pr - a);
        const pb = Math.abs(pr - b);
        const pc = Math.abs(pr - c);
        valor = bruto + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`filtro PNG desconhecido: ${String(filtro)}`);
      destino[x] = valor & 0xff;
    }
  }
  return { largura, altura, canais, dados: saida };
}

/** O pixel `(x, y)` como `[r, g, b]`. */
function pixelEm(img, x, y) {
  const i = (y * img.largura + x) * img.canais;
  if (img.canais >= 3) return [img.dados[i], img.dados[i + 1], img.dados[i + 2]];
  const v = img.dados[i];
  return [v, v, v];
}

/** Distância máxima por canal entre duas cores — tolerância de antialias. */
function distanciaDeCor(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** Quantos pixels da janelinha estão a ≤ `tolerancia` da cor alvo. */
function contarNaCor(img, alvo, tolerancia) {
  let n = 0;
  for (let y = 0; y < img.altura; y += 1) {
    for (let x = 0; x < img.largura; x += 1) {
      if (distanciaDeCor(pixelEm(img, x, y), alvo) <= tolerancia) n += 1;
    }
  }
  return n;
}

/** Quantos pixels mudaram entre duas janelinhas do mesmo tamanho. */
function contarDiferentes(a, b) {
  if (a.largura !== b.largura || a.altura !== b.altura) return -1;
  let n = 0;
  for (let y = 0; y < a.altura; y += 1) {
    for (let x = 0; x < a.largura; x += 1) {
      if (distanciaDeCor(pixelEm(a, x, y), pixelEm(b, x, y)) > 2) n += 1;
    }
  }
  return n;
}

const TOLERANCIA_DE_COR = 14;
const ALTURA_MAX_AMOSTRA = 48;

/**
 * A ferramenta central: **este elemento pinta, de verdade, na cor que ele
 * declara?** Duas fotos da mesma janelinha de 3 px de largura dentro da
 * caixa do elemento — a segunda com ele escondido.
 *
 * Devolve `{ ok, motivo, naCor, mudaram, total }`. `ok` exige as duas coisas:
 * pixels na cor declarada E pixels que MUDAM quando o elemento sai. Alvo que
 * não tem caixa de layout, ou que está fora da janela de visão, é REPROVA com
 * motivo escrito — nunca dispensa (checagem pulada é checagem aprovada).
 */
async function pintaDeVerdade(pagina, alvo, corDeclarada, minimoDePixels = 6, modo = "coluna") {
  let caixa = null;
  const vistaInicial = pagina.viewportSize();
  try {
    /*
     * A página é mais alta que a janela de visão, e um `clip` de screenshot
     * vive em coordenadas da JANELA. Na 1ª versão desta varredura, 13 de 31
     * camadas devolveram "a caixa não tem 3px dentro da janela de visão" — e
     * uma medida que se dispensa por não alcançar o alvo é uma medida que
     * aprova. Então se rola até o alvo; se nem assim couber, é REPROVAÇÃO com
     * o motivo escrito.
     *
     * Mas SÓ se rola quando é preciso, e foi assim que a 2ª versão errou: a
     * faixa do "Hoje" tem 1.218px de altura e o `scrollIntoViewIfNeeded`
     * empurrava o topo dela para cima da janela; a janelinha de 3px, medida a
     * partir do topo, caía então no CABEÇALHO GRUDADO — que tem a sua própria
     * faixa dourada, da mesma cor. Resultado: a cor batia e esconder a faixa
     * do canvas não mudava pixel nenhum, porque quem pintava ali era a outra.
     * A amostra passa a ser tirada no CENTRO da parte visível da caixa.
     */
    caixa = await alvo.boundingBox();
    const cruza =
      caixa !== null &&
      Math.min(vistaInicial.height, caixa.y + caixa.height) - Math.max(0, caixa.y) >= 4;
    if (!cruza) {
      await alvo.scrollIntoViewIfNeeded();
      await alvo.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
      );
      caixa = await alvo.boundingBox();
    }
  } catch {
    return { ok: false, motivo: "o alvo saiu do DOM antes de ser fotografado" };
  }
  if (!caixa || caixa.width <= 0 || caixa.height <= 0) {
    return { ok: false, motivo: `sem caixa de layout (${JSON.stringify(caixa)})` };
  }
  const vista = pagina.viewportSize();
  const topoVisivel = Math.max(0, Math.ceil(caixa.y) + 1);
  const baseVisivel = Math.min(vista.height - 1, Math.floor(caixa.y + caixa.height) - 1);
  const altura = Math.min(ALTURA_MAX_AMOSTRA, baseVisivel - topoVisivel);
  if (altura < 3) {
    return {
      ok: false,
      motivo: `a caixa não tem 3px dentro da janela de visão (topo ${caixa.y.toFixed(1)}, alt ${caixa.height.toFixed(1)}, janela ${String(vista.height)})`,
    };
  }
  /* No CENTRO da parte visível — longe do cabeçalho grudado e de qualquer
     borda onde outro elemento da mesma cor possa estar pintando. */
  const centro = (topoVisivel + baseVisivel) / 2;
  const y0 = Math.max(topoVisivel, Math.min(baseVisivel - altura, Math.round(centro - altura / 2)));
  /*
   * `coluna`: 3px na BORDA ESQUERDA da caixa — é onde vive o desenho de um
   * elemento de 2px (faixa, guia, traço de prazo) e ainda está dentro de um
   * de 200px (barra). Uma fórmula para os dois, sem caso especial.
   *
   * `caixa`: a caixa inteira (até 48px de altura). Necessário para TEXTO — um
   * glifo tem vão entre as hastes, e uma coluna de 3px pode cair no vão e
   * contar zero pixel da cor do texto sem que nada esteja errado — e para as
   * camadas TRANSLÚCIDAS (a hachura de folga: `bg-…/30` + `opacity-70` + um
   * gradiente repetido), cuja cor na tela é uma composição, não a declarada.
   * Nesses dois casos o que se exige é o teste que não depende de cor: ESCONDER
   * O ELEMENTO TEM DE MUDAR PIXEL. `opacity-0` cai nele igual.
   */
  const emCaixa = modo === "caixa";
  const larguraJanela = emCaixa
    ? Math.max(3, Math.min(Math.floor(caixa.width), vista.width - Math.max(0, Math.floor(caixa.x))))
    : 3;
  const x0 = emCaixa
    ? Math.max(0, Math.min(vista.width - larguraJanela, Math.floor(caixa.x)))
    : Math.max(0, Math.min(vista.width - 3, Math.round(caixa.x + Math.min(caixa.width, 6) / 2 - 1)));
  const janela = { x: x0, y: y0, width: larguraJanela, height: altura };
  const total = larguraJanela * altura;
  let comEle;
  let semEle;
  let anterior = "";
  try {
    comEle = lerPng(await pagina.screenshot({ clip: janela }));
    anterior = await alvo.evaluate((el) => {
      const v = el.style.visibility;
      el.style.visibility = "hidden";
      return v;
    });
    semEle = lerPng(await pagina.screenshot({ clip: janela }));
  } catch (e) {
    return { ok: false, motivo: `não consegui fotografar: ${String(e.message ?? e)}` };
  } finally {
    try {
      await alvo.evaluate((el, v) => {
        el.style.visibility = v;
      }, anterior);
    } catch {
      /* alvo já saiu do DOM; a próxima navegação recria a página de qualquer forma */
    }
  }
  const alvoCor = corEmCanais(corDeclarada);
  const naCor = contarNaCor(comEle, alvoCor, TOLERANCIA_DE_COR);
  const mudaram = contarDiferentes(comEle, semEle);
  const ok = mudaram >= minimoDePixels && (emCaixa || naCor >= minimoDePixels);
  return {
    ok,
    naCor,
    mudaram,
    total,
    motivo: ok
      ? ""
      : mudaram < minimoDePixels
        ? `esconder o elemento mudou só ${String(mudaram)}/${String(total)} pixels (mínimo ${String(minimoDePixels)}) — ele não pinta nada ali`
        : `só ${String(naCor)}/${String(total)} pixels na cor declarada ${corDeclarada} (mínimo ${String(minimoDePixels)})`,
  };
}

/**
 * ── O ALFA REAL, COMPOSTO SUBINDO A ÁRVORE ────────────────────────────────
 *
 * Instalado em toda página ANTES do carregamento (`addInitScript`), para
 * qualquer `evaluate` poder usar. É o ajudante que a medida I já tinha e que
 * a medida A não usava — agora é de todo mundo.
 */
const AJUDANTES_NA_PAGINA = `
window.__lbg = {
  canais(css) {
    const n = (String(css).match(/[\\d.]+/g) || []).map(Number);
    return [n[0] || 0, n[1] || 0, n[2] || 0, n[3] === undefined ? 1 : n[3]];
  },
  /** O produto de TODOS os \`opacity\` do elemento até a raiz. */
  opacidadeAcumulada(el) {
    let o = 1;
    let n = el;
    while (n && n.nodeType === 1) {
      const v = Number.parseFloat(getComputedStyle(n).opacity);
      o *= Number.isFinite(v) ? v : 1;
      n = n.parentElement;
    }
    return o;
  },
  /**
   * Qualquer cor CSS (inclusive \`oklab()\`, \`oklch()\`, \`color()\`) resolvida
   * para rgb/rgba pelo próprio motor — o canvas 2D normaliza \`fillStyle\`.
   * Sem isto, o Tailwind com modificador de opacidade (\`/70\`) devolve
   * \`oklab(...)\` e a conta de cor da guarda lia números sem sentido.
   */
  emRgb(css) {
    const cv = document.createElement("canvas").getContext("2d");
    cv.fillStyle = "#000";
    cv.fillStyle = css;
    const v = cv.fillStyle;
    if (v.startsWith("#")) {
      const h = v.length === 4
        ? [v[1] + v[1], v[2] + v[2], v[3] + v[3]]
        : [v.slice(1, 3), v.slice(3, 5), v.slice(5, 7)];
      return [Number.parseInt(h[0], 16), Number.parseInt(h[1], 16), Number.parseInt(h[2], 16), 1];
    }
    return this.canais(v);
  },
  compor(frente, fundo) {
    const a = frente[3];
    return [
      frente[0] * a + fundo[0] * (1 - a),
      frente[1] * a + fundo[1] * (1 - a),
      frente[2] * a + fundo[2] * (1 - a),
      1,
    ];
  },
  /**
   * O FUNDO REAL atrás do elemento — a mesma conta da medida I: sobe a
   * árvore, só aceita como fundo o ancestral cuja caixa CONTÉM a minha
   * (badges \`absolute\` nascem fora da caixa do pai e continuam filhos dele
   * no DOM), compõe alfa e \`opacity\` no caminho.
   */
  fundoReal(el) {
    const meu = el.getBoundingClientRect();
    const contem = (r) =>
      r.left - 0.5 <= meu.left && r.right + 0.5 >= meu.right &&
      r.top - 0.5 <= meu.top && r.bottom + 0.5 >= meu.bottom;
    const pilha = [];
    let n = el.parentElement;
    let fundo = null;
    while (n) {
      const c = getComputedStyle(n);
      const cor = this.emRgb(c.backgroundColor);
      const alfa = cor[3] * (Number.parseFloat(c.opacity) || 0);
      if (alfa > 0 && contem(n.getBoundingClientRect())) {
        pilha.push([cor[0], cor[1], cor[2], Math.min(1, alfa)]);
        if (alfa >= 0.999) { fundo = pilha.pop(); break; }
      }
      n = n.parentElement;
    }
    if (fundo === null) fundo = [5, 7, 15, 1];
    for (let i = pilha.length - 1; i >= 0; i -= 1) fundo = this.compor(pilha[i], fundo);
    return fundo;
  },
  /**
   * A cor que o compositor do navegador DEVE pintar neste canal do elemento:
   * a cor declarada, com o alfa dela vezes toda a cadeia de \`opacity\`,
   * composta sobre o fundo real. É contra ESTA cor que a amostra de pixel é
   * comparada — comparar com a cor declarada crua reprovava uma barra
   * correta com \`opacity-90\` (declarada rgb(127,184,255), pintada
   * rgb(115,166,231)) e teria virado mais um número ajustado à mão.
   */
  corEsperada(el, canal) {
    const cs = getComputedStyle(el);
    const bruta = this.emRgb(
      canal === "borda" ? cs.borderLeftColor : canal === "fundo" ? cs.backgroundColor : cs.color,
    );
    const op = this.opacidadeAcumulada(el);
    const c = this.compor([bruta[0], bruta[1], bruta[2], Math.min(1, bruta[3] * op)], this.fundoReal(el));
    return "rgb(" + Math.round(c[0]) + ", " + Math.round(c[1]) + ", " + Math.round(c[2]) + ")";
  },
  /**
   * Um retrato do que o navegador REALMENTE vai pintar deste elemento:
   * alfa composto da borda e do fundo, visibilidade herdada, área de layout
   * e recorte. Nada aqui é atributo declarado lido sozinho.
   */
  retrato(el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const op = this.opacidadeAcumulada(el);
    /* emRgb, e nunca canais: uma cor oklab(... / 0.7) tem o alfa depois de
       uma barra, e ler "o 4o numero" dela devolvia qualquer coisa. */
    const alfaDe = (css) => this.emRgb(css)[3] * op;
    let visivelHerdado = true;
    let n = el;
    while (n && n.nodeType === 1) {
      const c = getComputedStyle(n);
      if (c.visibility === "hidden" || c.visibility === "collapse" || c.display === "none") {
        visivelHerdado = false;
        break;
      }
      n = n.parentElement;
    }
    return {
      opacidadeAcumulada: op,
      visivelHerdado,
      largura: r.width,
      altura: r.height,
      corDaBorda: cs.borderLeftColor,
      larguraDaBorda: Number.parseFloat(cs.borderLeftWidth) || 0,
      alfaDaBorda: alfaDe(cs.borderLeftColor),
      corDoFundo: cs.backgroundColor,
      alfaDoFundo: alfaDe(cs.backgroundColor),
      corDoTexto: cs.color,
      alfaDoTexto: alfaDe(cs.color),
      /* A cor que o compositor deve pintar em cada canal (declarada × toda a
         cadeia de opacity, composta sobre o fundo real). */
      esperadaDaBorda: this.corEsperada(el, "borda"),
      esperadaDoFundo: this.corEsperada(el, "fundo"),
      esperadaDoTexto: this.corEsperada(el, "texto"),
      texto: (el.textContent || "").trim().slice(0, 40),
    };
  },
};
`;

// ── A · a faixa do "Hoje": alfa REAL composto + o PIXEL na tela ─────────────
/*
 * Rodada 12 (achado CRÍTICO 1). A versão anterior desta medida lia
 * `borderLeftColor`, `borderLeftWidth` e `height` — três canais que `opacity`
 * não toca. Agora ela faz as duas coisas que o cabeçalho deste bloco exige:
 * compõe o alfa subindo a árvore (`__lbg.retrato`) E fotografa a coluna da
 * faixa com e sem o elemento (`pintaDeVerdade`).
 *
 * A faixa do "Hoje" é a única âncora datada do canvas e a ORIGEM da régua da
 * medida H: se ela não está na tela, H está medindo contra uma régua que o
 * operador não vê.
 */
for (const [largura, altura] of [
  [1440, 1000],
  [390, 844],
]) {
  const { contexto, pagina } = await abrir(largura, altura);
  const alvos = await pagina.$$(".lb-tl-hoje");
  const problemas = [];
  const detalhes = [];
  if (alvos.length === 0) problemas.push("nenhuma faixa do Hoje na página");
  for (const alvo of alvos) {
    const r = await alvo.evaluate((el) => window.__lbg.retrato(el));
    const pintou = await pintaDeVerdade(pagina, alvo, r.esperadaDaBorda, 8);
    const geometriaOk = r.larguraDaBorda >= 2 && r.altura > 0;
    const alfaOk = r.alfaDaBorda > 0 && r.visivelHerdado && r.opacidadeAcumulada > 0;
    if (!geometriaOk) problemas.push(`faixa com ${String(r.larguraDaBorda)}px × ${r.altura.toFixed(0)}px`);
    if (!alfaOk) {
      problemas.push(
        `faixa sem alfa REAL: opacidade acumulada ${r.opacidadeAcumulada.toFixed(3)}, alfa da borda ${r.alfaDaBorda.toFixed(3)}, visível herdado ${String(r.visivelHerdado)}`,
      );
    }
    if (!pintou.ok) problemas.push(`faixa não pinta na tela: ${pintou.motivo}`);
    detalhes.push(
      `${r.corDaBorda} ${String(r.larguraDaBorda)}px × ${r.altura.toFixed(0)}px · opacidade ${r.opacidadeAcumulada.toFixed(2)} · ${String(pintou.naCor ?? 0)}/${String(pintou.total ?? 0)} px na cor, ${String(pintou.mudaram ?? 0)} mudam ao esconder`,
    );
  }
  conferir(
    `A · faixa do "Hoje" PINTADA a ${largura}×${altura} (alfa composto + pixel)`,
    problemas.length === 0,
    problemas.length === 0
      ? `${String(alvos.length)}/${String(alvos.length)} faixas com alfa real > 0 e pixel na tela — ${detalhes.join(" · ")}`
      : problemas.join(" · "),
  );
  await contexto.close();
}

// ── B · a folha inferior não tapa a linha tocada (S1) ───────────────────────
{
  const { contexto, pagina } = await abrir(390, 844);
  const chaves = await pagina.$$eval('button[aria-haspopup="dialog"]', (els) =>
    els.map((el) => el.getAttribute("aria-label") ?? ""),
  );
  const ultimas = chaves.slice(-3);
  let piorArea = 0;
  const detalhes = [];
  for (const rotulo of ultimas) {
    await pagina.reload({ waitUntil: "networkidle" });
    await pagina.waitForSelector(".lb-tl-hoje", { state: "attached" });
    const botao = pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first();
    await botao.scrollIntoViewIfNeeded();
    await botao.click();
    await pagina.waitForSelector("[data-lb-detalhe]");
    // Dois quadros de `requestAnimationFrame` — o plano da folha é aplicado
    // dentro de um deles, e medir antes disso mediria o quadro errado.
    await pagina.evaluate(
      () =>
        new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    );
    const area = await pagina.evaluate((alvo) => {
      const botaoEl = document.querySelector(`button[aria-label="${CSS.escape(alvo).replace(/\\/g, "")}"]`)
        ?? [...document.querySelectorAll('button[aria-haspopup="dialog"]')].find(
          (b) => b.getAttribute("aria-label") === alvo,
        );
      const folha = document.querySelector("[data-lb-detalhe]");
      if (!botaoEl || !folha) return { area: -1, rotuloTop: null, folhaTop: null };
      const a = botaoEl.getBoundingClientRect();
      const f = folha.getBoundingClientRect();
      const larg = Math.max(0, Math.min(a.right, f.right) - Math.max(a.left, f.left));
      const alt = Math.max(0, Math.min(a.bottom, f.bottom) - Math.max(a.top, f.top));
      return {
        area: Math.round(larg * alt),
        rotuloTop: Math.round(a.top),
        folhaTop: Math.round(f.top),
      };
    }, rotulo);
    piorArea = Math.max(piorArea, area.area);
    detalhes.push(
      `"${rotulo.slice(0, 28)}": ${area.area} px² (rótulo em ${area.rotuloTop}, folha em ${area.folhaTop})`,
    );
  }
  conferir(
    "B · a folha inferior não tapa a linha tocada (390×844, 3 últimas linhas)",
    piorArea === 0,
    detalhes.join(" · "),
  );
  await contexto.close();
}

// ── C · a gaveta e o canvas dizem a MESMA coisa sobre a mesma linha ─────────
/*
 * Rodada 12 (achado MÉDIO 1). Esta medida tinha o nome de um invariante e o
 * corpo de dois `includes`: testava se a palavra "sem estimativa" aparecia
 * junto de duas datas. Ela NUNCA comparou o campo "Período" da gaveta com o
 * `title` do desenho da mesma linha — que é a frase de abertura da peça P5
 * ("as duas superfícies nunca mais digam coisas diferentes sobre a mesma
 * tarefa") e a razão de `periodo-da-tarefa.ts` existir. O invariante só vivia
 * num teste unitário sobre 3 tarefas, com árvore React falsa, enquanto a tela
 * real tem 24 linhas.
 *
 * Agora ela compara, linha por linha, nas 24: o "Período" da gaveta tem de
 * aparecer LITERALMENTE no texto do desenho daquela linha — a barra, o
 * losango, o ponto de conclusão ou o chevron de fora da janela. Quando a
 * linha não tem desenho nenhum no canvas (saiu da grade por falta de dado), a
 * frase tem de estar no `title` do rótulo, que é a superfície que sobra.
 *
 * Se uma linha não tem NENHUMA das duas, é reprovação: uma linha sobre a qual
 * só a gaveta fala é uma linha cuja data ninguém confere.
 */
{
  const { contexto, pagina } = await abrir(1440, 1000);
  const rotulos = await pagina.$$eval('button[aria-haspopup="dialog"]', (els) =>
    els.map((el) => el.getAttribute("aria-label") ?? ""),
  );
  const contradicoes = [];
  const divergencias = [];
  const semSuperficie = [];
  let abertas = 0;
  let comparadas = 0;
  for (const rotulo of rotulos) {
    const botao = pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first();
    await botao.scrollIntoViewIfNeeded();
    await botao.click();
    await pagina.waitForSelector("[data-lb-detalhe]");
    const gaveta = await pagina.$eval("[data-lb-detalhe]", (el) => el.innerText);
    abertas += 1;
    const periodo = (/Período:\s*([^\n]*)/.exec(gaveta)?.[1] ?? "").trim();
    const datas = [...periodo.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((m) => m[0]);
    // A própria gaveta diz, em cinza, o que sabe do dado. Se ela diz "sem
    // estimativa", nenhum intervalo de datas pode estar impresso acima —
    // era exatamente essa contradição que o crítico mediu.
    if (gaveta.includes("sem estimativa") && datas.length >= 2) {
      contradicoes.push(`${rotulo.slice(0, 30)}: "sem estimativa" × "${periodo}"`);
    }
    if (gaveta.includes("início não definido") && /^\d{2}\/\d{2}\/\d{4}/.test(periodo)) {
      contradicoes.push(`${rotulo.slice(0, 30)}: "início não definido" × "${periodo}"`);
    }
    /* ── O INVARIANTE DE VERDADE: gaveta × canvas, na mesma linha ───────── */
    const nome = (/^(.*?) — /.exec(rotulo)?.[1] ?? rotulo).trim();
    const superficies = await pagina.evaluate((alvo) => {
      const painel = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
      const prefixo = `${alvo} — `;
      const noCanvas = [...(painel?.querySelectorAll("[title]") ?? [])]
        .map((e) => e.getAttribute("title") ?? "")
        .filter((t) => t.startsWith(prefixo));
      const noRotulo = [...document.querySelectorAll('button[aria-haspopup="dialog"][title]')]
        .map((e) => e.getAttribute("title") ?? "")
        .filter((t) => t === alvo || t.startsWith(prefixo));
      return { noCanvas, noRotulo };
    }, nome);
    if (periodo === "") {
      semSuperficie.push(`${nome.slice(0, 34)}: a gaveta não imprime campo "Período"`);
      continue;
    }
    const textos = [...superficies.noCanvas, ...superficies.noRotulo];
    if (textos.length === 0) {
      semSuperficie.push(
        `${nome.slice(0, 34)}: a gaveta diz "${periodo}" e NENHUMA outra superfície fala desta linha`,
      );
      continue;
    }
    comparadas += 1;
    if (!textos.some((t) => t.includes(periodo))) {
      divergencias.push(
        `${nome.slice(0, 30)}: gaveta "${periodo}" × canvas/rótulo "${(textos[0] ?? "").slice(0, 60)}"`,
      );
    }
  }
  const problemas = [...contradicoes, ...divergencias, ...semSuperficie];
  conferir(
    "C · a gaveta e o desenho da mesma linha dizem o MESMO período",
    problemas.length === 0 && comparadas > 0,
    problemas.length === 0
      ? `${String(abertas)} gavetas abertas, ${String(comparadas)} períodos comparados com o texto do desenho da própria linha, 0 divergências e 0 contradições`
      : problemas.slice(0, 4).join(" · "),
  );
  await contexto.close();
}

// ── D · contraste computado do rótulo riscado ───────────────────────────────
{
  const { contexto, pagina } = await abrir(1440, 1000);
  const amostras = await pagina.$$eval("span.line-through", (els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      let fundo = "rgba(0, 0, 0, 0)";
      let n = el;
      while (n && /rgba\(0, 0, 0, 0\)|transparent/.test(fundo)) {
        n = n.parentElement;
        if (!n) break;
        fundo = getComputedStyle(n).backgroundColor;
      }
      return { cor: cs.color, fundo, texto: (el.textContent ?? "").slice(0, 24) };
    }),
  );
  const piores = amostras
    .map((a) => ({ ...a, r: razao(corEmCanais(a.cor), corEmCanais(a.fundo)) }))
    .sort((x, y) => x.r - y.r);
  conferir(
    "D · rótulo de assunto riscado (mergeado/fechado) ≥ 4,5:1",
    piores.length > 0 && (piores[0]?.r ?? 0) >= 4.5,
    piores.length === 0
      ? "nenhuma amostra encontrada"
      : `pior: ${piores[0].r.toFixed(2)}:1 (${piores[0].cor} sobre ${piores[0].fundo}) em ${piores.length} amostra(s)`,
  );
  await contexto.close();
}

// ── E · a ordem vertical dos assuntos é a ordem das DATAS, não dos pixels ───
/*
 * Rodada 12 (achado MÉDIO 2). A medida E aprovava qualquer translação: com a
 * mutação canônica (`xFor + pxPorDia`) ela imprimia "0 inversões" com todos os
 * números deslocados 42,77 px, porque monotonicidade é invariante a
 * translação. E contava 14 barras onde H contava 12: os 4 primeiros valores
 * eram `284` — chevrons de fora da janela, todos grudados em `left: 0` pelo
 * clamp, o que tornava o começo da sequência trivialmente monotônico.
 *
 * As duas coisas tinham a mesma causa: E lia PIXEL. O pixel de um item fora
 * da janela é clampado (não é uma afirmação de data), e o pixel de todos os
 * itens se desloca junto numa translação.
 *
 * E passa a ler a DATA que cada linha declara no próprio texto — e a
 * comparar a ordem das datas com a ordem VERTICAL das linhas. É uma
 * propriedade que o pixel não tem como dar: um item clampado em `left: 0`
 * continua declarando 03/08/2026, e uma translação não muda a ordem. A
 * afirmação de POSIÇÃO de cada um vive em H, que é quem tem régua para ela;
 * aqui se mede a ORDEM, que H não mede. Declarado: E é, de propósito,
 * invariante a translação — porque ordenação é invariante a translação, e
 * quem pega translação é H.
 */
{
  const { contexto, pagina } = await abrir(1440, 1000);
  const linhas = await pagina.evaluate(() => {
    const painel = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
    const pr = painel?.getBoundingClientRect();
    /* A ORDEM VERTICAL vem do topo de cada botão da coluna de rótulos — a
       ordem em que o operador lê, não a ordem do DOM de um array qualquer. */
    return [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
      .map((b) => ({
        rotulo: b.getAttribute("aria-label") ?? "",
        topo: b.getBoundingClientRect().top,
      }))
      .filter((x) => x.rotulo.includes("— assunto em "))
      .sort((a, b) => a.topo - b.topo)
      .map((x) => ({
        nome: x.rotulo.split(" — assunto")[0],
        rotulo: x.rotulo,
        topo: x.topo,
        temPainel: Boolean(pr),
      }));
  });
  const comData = [];
  const semData = [];
  for (const l of linhas) {
    /* A data sai do rótulo acessível da própria linha (`rotuloAcessivelDoAssunto`
       — a mesma função pura que alimenta a gaveta e o `title` da barra). */
    const d = /(\d{2})\/(\d{2})\/(\d{4})/.exec(l.rotulo);
    if (!d) {
      semData.push(l.nome.slice(0, 34));
      continue;
    }
    comData.push({ nome: l.nome, iso: `${d[3]}-${d[2]}-${d[1]}`, topo: l.topo });
  }
  const inversoes = comData.filter((x, i) => i > 0 && x.iso < comData[i - 1].iso);
  conferir(
    "E · os assuntos saem em ordem de data de início (a data do texto, nunca o pixel clampado)",
    comData.length > 1 && inversoes.length === 0 && semData.length === 0,
    inversoes.length === 0 && semData.length === 0
      ? `${String(comData.length)} assuntos em ordem não-decrescente de data — ${comData
          .map((x) => x.iso.slice(5))
          .join(" · ")}`
      : [
          semData.length > 0
            ? `assunto cuja linha não declara data nenhuma: ${semData.join(" · ")}`
            : null,
          ...inversoes.map(
            (x, i) => `"${x.nome.slice(0, 28)}" (${x.iso}) vem DEPOIS de uma data maior na tela`,
          ),
        ]
          .filter(Boolean)
          .join(" · "),
  );
  await contexto.close();
}

// ── F · fechar a gaveta não mexe a página ───────────────────────────────────
{
  const { contexto, pagina } = await abrir(390, 844);
  // Linhas FUNDAS de propósito: o defeito é o `.focus()` do fechamento
  // arrastando a página de volta para o botão de origem, e ele só aparece
  // quando o botão está longe do topo. Numa linha alta o navegador não
  // precisa rolar nada, e o teste passaria sem medir coisa alguma.
  const indices = [14, 18, 22];
  const deltas = [];
  for (const indice of indices) {
    await pagina.reload({ waitUntil: "networkidle" });
    await pagina.waitForSelector(".lb-tl-hoje", { state: "attached" });
    const rotulo = await pagina.$$eval(
      'button[aria-haspopup="dialog"]',
      (els, k) => els[k]?.getAttribute("aria-label") ?? "",
      indice,
    );
    if (!rotulo) continue;
    const botao = pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first();
    await botao.scrollIntoViewIfNeeded();
    await botao.click();
    await pagina.waitForSelector("[data-lb-detalhe]");
    await pagina.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    );
    // O operador rola de volta para o topo COM a gaveta aberta…
    await pagina.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
    await pagina.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    );
    const antes = await pagina.evaluate(() => window.scrollY);
    // …e fecha. A página tem de ficar onde ele a deixou.
    await pagina.locator("[data-lb-detalhe] button").first().click();
    await pagina.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    );
    const depois = await pagina.evaluate(() => window.scrollY);
    deltas.push({ indice, antes, depois, delta: Math.abs(depois - antes) });
  }
  const pior = deltas.reduce((m, d) => Math.max(m, d.delta), 0);
  conferir(
    "F · fechar a gaveta não arrasta a página (o foco volta sem rolar)",
    deltas.length > 0 && pior <= 1,
    deltas.map((d) => `linha ${String(d.indice)}: ${d.antes} → ${d.depois}`).join(" · "),
  );
  await contexto.close();
}

// ── G · o chip do período: inteiro ou ausente, e o ano sempre escrito ───────
{
  const { contexto, pagina } = await abrir(768, 900);
  await pagina.locator('button:has-text("Semana")').first().click();
  // O chip é re-renderizado a cada `scroll`; medir antes de o React assentar
  // mede o quadro anterior. Espera-se o chip existir e, dentro do laço, dois
  // `requestAnimationFrame` depois de cada escrita em `scrollLeft`.
  await pagina.waitForSelector(".lb-tl-mes-grudado", { timeout: 10000 });
  const maximo = await pagina.evaluate(() => {
    const el = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
    return el ? el.scrollWidth - el.clientWidth : 0;
  });
  let cacos = 0;
  let semAno = 0;
  let posicoes = 0;
  let pior = 1;
  for (let sx = 0; sx <= maximo; sx += 8) {
    const r = await pagina.evaluate(async (x) => {
      const el = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
      if (!el) return null;
      el.scrollLeft = x;
      await new Promise((pronto) =>
        requestAnimationFrame(() => requestAnimationFrame(() => pronto(null))),
      );
      const rp = el.getBoundingClientRect();
      const chip = document.querySelector(".lb-tl-mes-grudado");
      let fracao = 1;
      if (chip) {
        const rc = chip.getBoundingClientRect();
        const visivel = Math.max(0, Math.min(rc.right, rp.right) - Math.max(rc.left, rp.left));
        fracao = rc.width > 0 ? visivel / rc.width : 1;
      }
      const meses = [...document.querySelectorAll("div,span")]
        .filter(
          (e) =>
            e.children.length === 0 &&
            /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(\/\d{4})?$/.test(
              (e.textContent ?? "").trim(),
            ),
        )
        .map((e) => {
          const r2 = e.getBoundingClientRect();
          return {
            texto: (e.textContent ?? "").trim(),
            inteiro:
              Math.max(0, Math.min(r2.right, rp.right) - Math.max(r2.left, rp.left)) >
              r2.width * 0.9,
          };
        });
      return {
        temChip: Boolean(chip),
        fracao,
        temAno: meses.some((m) => m.inteiro && /\d{4}/.test(m.texto)),
      };
    }, sx);
    if (!r) continue;
    posicoes += 1;
    if (r.temChip && r.fracao < 0.999) cacos += 1;
    if (r.temChip) pior = Math.min(pior, r.fracao);
    if (!r.temChip && !r.temAno) semAno += 1;
  }
  conferir(
    "G · chip do período inteiro ou ausente, com o ano sempre escrito (768×900, Semana)",
    cacos === 0 && semAno === 0,
    `${posicoes} posições de rolagem — ${cacos} com chip cortado (pior fração ${pior.toFixed(3)}), ${semAno} sem o ano na tela`,
  );
  await contexto.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// H · CADA BARRA NO PIXEL QUE A SUA DATA MANDA
// ═══════════════════════════════════════════════════════════════════════════

const MS_DIA = 86_400_000;
/** `dd/MM/aaaa` → epoch UTC. `NaN` quando não é data. */
function epochDeBr(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}
function epochDeIso(iso) {
  const t = Date.parse(`${iso}T00:00:00.000Z`);
  return Number.isFinite(t) ? t : Number.NaN;
}
const PISO_BARRA_PX = 12;
const TOLERANCIA_PX = 1.5;

/**
 * ── A COLETA É DERIVADA, E O QUE ELA PULA É DECLARADO (achado ALTO 1) ──────
 *
 * A versão anterior coletava três seletores escritos à mão
 * (`[data-lb-barra]`, `.lb-tl-marco`, `.lb-tl-ponto-concluida`) e imprimia
 * "12 barras conferidas". Medido no Chromium: o painel tinha 19 elementos com
 * `title` datado, 12 entravam e 7 ficavam fora — **sem uma palavra sobre os
 * 7**. É a mesma forma do defeito que a medida H nasceu para curar (a medida
 * E "relatava o deslocamento nos próprios números e aprovava").
 *
 * Agora a coleta parte do que o elemento AFIRMA, não de uma lista:
 *
 *   - `title` com data `dd/MM/aaaa`  → é uma afirmação sobre datas;
 *   - `data-lb-*` com data ISO       → idem (é assim que a hachura de folga
 *     e a faixa do "Hoje" declaram as suas).
 *
 * Todo elemento assim entra. O que sai, sai por EXCEÇÃO DECLARADA, com o
 * motivo escrito no código e impresso no relatório — e a exceção não é um
 * `continue`: cada uma tem a sua própria conferência (um clamp tem de estar
 * mesmo na borda, e a data que ele declara tem de estar mesmo fora da
 * janela). Checagem pulada é checagem aprovada; aqui não se pula, se mede
 * outra coisa.
 *
 * E há uma terceira rede, a que impede a lista de envelhecer em silêncio: o
 * REGISTRO de classes `lb-tl-*`. Toda classe desenhada dentro do painel tem
 * de estar nele. Uma classe nova — um mecanismo novo — REPROVA a guarda até
 * alguém dizer como ela se mede ou por que não se mede. Foi a falta disso que
 * deixou `lb-tl-slack` e `lb-tl-atraso` com zero cobertura de navegador por
 * duas rodadas.
 */
async function lerGeometria(pagina) {
  return await pagina.evaluate(() => {
    const painel = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
    if (!painel) return null;
    const pr = painel.getBoundingClientRect();
    /* Coordenadas do CONTEÚDO do painel (`rect` real + `scrollLeft`), nunca
       `style.left` — que seria o valor escrito, não o pintado. */
    const cx = (el) => {
      const r = el.getBoundingClientRect();
      return {
        esquerda: r.left - pr.left + painel.scrollLeft,
        centro: (r.left + r.right) / 2 - pr.left + painel.scrollLeft,
        direita: r.right - pr.left + painel.scrollLeft,
        largura: r.width,
      };
    };
    const RE_DATA = /\d{2}\/\d{2}\/\d{4}/;
    const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;

    /**
     * O REGISTRO. `medida` diz o que a guarda faz com cada desenho:
     *   posicao-esquerda  · a borda esquerda é `xDe(data do texto)`
     *   posicao-centro    · o centro é `xDe(data do texto)`
     *   intervalo         · esquerda e direita são duas datas declaradas
     *   regua             · é a própria régua (medida à parte, em M e N)
     *   clamp-declarado   · o desenho se RECUSA a afirmar posição; confere-se
     *                       que ele está na borda e que a data está mesmo fora
     *   dentro-da-barra   · não tem posição própria; a barra que o contém já é
     *                       medida, e a barra é quem afirma as datas
     */
    const REGISTRO = {
      "lb-tl-guia-semana": { medida: "regua", motivo: "as segundas-feiras dão px/dia (7 dias exatos entre duas)" },
      "lb-tl-hoje": { medida: "regua", motivo: "o único pixel do canvas cuja data o componente declara" },
      "lb-tl-marco": { medida: "posicao-centro", motivo: "" },
      "lb-tl-ponto-concluida": { medida: "posicao-centro", motivo: "" },
      "lb-tl-slack": { medida: "intervalo", motivo: "" },
      "lb-tl-atraso": { medida: "posicao-esquerda", motivo: "" },
      "lb-tl-fora-da-janela": {
        medida: "clamp-declarado",
        motivo: "o desenho se recusa a posicionar: a data está fora da janela e o glifo fica na borda",
      },
      "lb-tl-atraso-seta": {
        medida: "clamp-declarado",
        motivo: "o prazo cai fora da barra: o glifo é preso à borda da barra, não em xDe(prazo)",
      },
      "lb-tl-erro": {
        medida: "clamp-declarado",
        motivo: "dado podre (data inválida / datas inconsistentes): a caixa não afirma intervalo nenhum",
      },
      "lb-tl-bar-critico": { medida: "dentro-da-barra", motivo: "é a própria barra (mesmo elemento de data-lb-barra)" },
      "lb-tl-atrasada-marcador": { medida: "dentro-da-barra", motivo: "inset-x-0 dentro da barra: não tem posição própria" },
      "lb-tl-connector": { medida: "dentro-da-barra", motivo: "derivado das pontas de duas barras já medidas" },
    };

    /* ── a régua desenhada ────────────────────────────────────────────── */
    const guias = [...painel.querySelectorAll(".lb-tl-guia-semana")]
      .map((e) => cx(e).esquerda)
      .sort((a, b) => a - b);
    const faixaHoje = painel.querySelector(".lb-tl-hoje[data-lb-hoje]");

    /* ── a coleta derivada ────────────────────────────────────────────── */
    const afirmacoes = [];
    const excecoes = [];
    const desconhecidos = [];
    const classesNoPainel = {};
    const semRegua = [];

    for (const el of painel.querySelectorAll("*")) {
      const classes = [...el.classList].filter((c) => c.startsWith("lb-tl-"));
      for (const c of classes) {
        classesNoPainel[c] = (classesNoPainel[c] ?? 0) + 1;
        if (!(c in REGISTRO)) desconhecidos.push(c);
      }
      const title = el.getAttribute("title") ?? "";
      const dataLb = [...el.attributes]
        .filter((a) => a.name.startsWith("data-lb-") && RE_ISO.test(a.value))
        .map((a) => `${a.name}=${a.value}`);
      const afirmaData = RE_DATA.test(title) || dataLb.length > 0;
      const entrada = REGISTRO[classes.find((c) => c in REGISTRO) ?? ""] ?? null;
      const barra = el.getAttribute("data-lb-barra");
      const comum = {
        classes: classes.join(","),
        title,
        dataLb,
        ...cx(el),
      };

      if (barra) {
        afirmacoes.push({ ...comum, medida: "posicao-esquerda", tipo: barra, confereLargura: true });
        continue;
      }
      if (el.hasAttribute("data-lb-folga-de") && el.hasAttribute("data-lb-folga-ate")) {
        afirmacoes.push({
          ...comum,
          medida: "intervalo",
          de: el.getAttribute("data-lb-folga-de"),
          ate: el.getAttribute("data-lb-folga-ate"),
        });
        continue;
      }
      if (entrada && (entrada.medida === "posicao-centro" || entrada.medida === "posicao-esquerda")) {
        afirmacoes.push({ ...comum, medida: entrada.medida, confereLargura: false });
        continue;
      }
      if (entrada && entrada.medida === "clamp-declarado") {
        /* Um "◀"/"▶" DENTRO de uma barra é enfeite da barra (o corte no fim
           do eixo) — a barra que o contém já é medida e é ela que afirma. */
        const dentroDeBarra = el.closest("[data-lb-barra]") !== null;
        excecoes.push({
          ...comum,
          motivo: dentroDeBarra
            ? "glifo dentro da barra: a barra que o contém é quem afirma as datas, e ela é medida"
            : entrada.motivo,
          dentroDeBarra,
          tituloDaBarraPai: el.closest("[data-lb-barra]")?.getAttribute("title") ?? null,
        });
        continue;
      }
      if (entrada && entrada.medida === "regua") continue;
      if (entrada && entrada.medida === "dentro-da-barra") continue;
      /*
       * Uma classe registrada como "intervalo" ou "posicao-*" que NÃO trouxe
       * as datas que devia declarar cai aqui. Sem esta rede, arrancar
       * `data-lb-folga-de`/`-ate` da hachura a devolvia ao silêncio: sem
       * atributo e sem `title`, ela não "afirma data" e sairia da coleta sem
       * uma palavra — a doença de novo, com outra roupa.
       */
      if (entrada) {
        semRegua.push({
          ...comum,
          porque: `a classe está registrada como "${entrada.medida}" e não declarou as datas que essa medida exige`,
        });
        continue;
      }
      /* Elemento que AFIRMA uma data e não se encaixou em nada: é a doença
         de novo, e a guarda tem de cair. */
      if (afirmaData) semRegua.push(comum);
    }

    /* A etiqueta de "fora da grade" da coluna de rótulos, com o nome da linha. */
    const foraDaGrade = [...document.querySelectorAll(".lb-tl-fora-da-grade")].map((e) => ({
      motivo: (e.textContent ?? "").trim(),
      titulo: (e.parentElement?.querySelector("span")?.textContent ?? "").trim(),
    }));

    /*
     * Rodada 12 (achado ALTO 3): os rótulos datados da coluna, que é onde a
     * data de um item fora da janela passa a chegar por TOQUE. A guarda amarra
     * cada "◀"/"▶" do canvas a um destes — e reprova quando falta.
     */
    const rotulosForaDaJanela = [...document.querySelectorAll(".lb-tl-fora-da-janela-rotulo")].map(
      (e) => ({
        texto: (e.textContent ?? "").trim(),
        lado: e.getAttribute("data-lb-fora-da-janela"),
        rotuloAcessivel: e.closest("button")?.getAttribute("aria-label") ?? "",
        titleDaLinha: e.closest("button")?.getAttribute("title") ?? "",
      }),
    );

    /*
     * Rodada 12 (achado CRÍTICO 2): os rótulos de data do EIXO — os "14",
     * "15", "24" que o operador lê no cabeçalho. Eles saem de `rotulosVisiveis`
     * (outro array), moram no cabeçalho TRANSLADADO (outro contêiner de
     * rolagem) e não entravam em régua nenhuma. Ficam em coordenada de
     * conteúdo do painel, a mesma das barras, para poderem ser comparados com
     * a mesma régua.
     */
    const eixo = [];
    const faixaDeDias = document.querySelectorAll(
      '[role="region"][aria-label^="Linha do tempo"]',
    ).length
      ? document
      : document;
    for (const el of faixaDeDias.querySelectorAll("div,span")) {
      if (el.children.length > 0) continue;
      if (painel.contains(el)) continue;
      const texto = (el.textContent ?? "").trim();
      const ehDia = /^\d{1,2}$/.test(texto);
      const ehDiaMes = /^\d{2}\/\d{2}$/.test(texto);
      const ehChipHoje = el.classList.contains("lb-tl-hoje-rotulo");
      const ehMes = /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(\/\d{4})?$/.test(texto);
      if (!ehDia && !ehDiaMes && !ehMes) continue;
      /* Só o que está DENTRO do cabeçalho do eixo (o chip grudado do mês vive
         fora do conteúdo transladado de propósito, e tem medida própria: G). */
      if (el.classList.contains("lb-tl-mes-grudado")) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      eixo.push({
        texto,
        tipo: ehChipHoje ? "hoje" : ehMes ? "mes" : ehDiaMes ? "dia-mes" : "dia",
        esquerda: r.left - pr.left + painel.scrollLeft,
        visivelNaJanela: r.left >= pr.left - 1 && r.right <= pr.right + 1,
      });
    }

    return {
      guias,
      xHoje: faixaHoje ? cx(faixaHoje).esquerda : null,
      hojeIso: faixaHoje?.getAttribute("data-lb-hoje") ?? null,
      larguraTotal: painel.scrollWidth,
      scrollLeft: painel.scrollLeft,
      afirmacoes,
      excecoes,
      desconhecidos: [...new Set(desconhecidos)],
      semRegua,
      classesNoPainel,
      foraDaGrade,
      rotulosForaDaJanela,
      eixo,
    };
  });
}

/** A régua: `px/dia` das guias de segunda + a origem da faixa do "Hoje". */
function montarRegua(g) {
  if (!g || g.hojeIso === null || g.xHoje === null) return { erro: "sem faixa do Hoje na página" };
  if (g.guias.length < 2) return { erro: `só ${String(g.guias.length)} guia(s) de semana` };
  const pxPorDia = (g.guias[g.guias.length - 1] - g.guias[0]) / (7 * (g.guias.length - 1));
  if (!(pxPorDia > 0)) return { erro: "px/dia não positivo" };
  const hojeEpoch = epochDeIso(g.hojeIso);
  if (!Number.isFinite(hojeEpoch)) return { erro: `data de hoje ilegível: ${g.hojeIso}` };
  // As duas fontes da régua se conferem: toda guia tem de cair num dia que,
  // contado a partir de "hoje", é mesmo uma segunda-feira — e no pixel que a
  // conta manda. Se a âncora escorregar, isto quebra antes de qualquer barra.
  const desalinhadas = [];
  for (const x of g.guias) {
    const dias = Math.round((x - g.xHoje) / pxPorDia);
    const data = new Date(hojeEpoch + dias * MS_DIA);
    const previsto = g.xHoje + dias * pxPorDia;
    if (data.getUTCDay() !== 1 || Math.abs(x - previsto) > TOLERANCIA_PX) {
      desalinhadas.push(`${x.toFixed(2)} (${data.toISOString().slice(0, 10)})`);
    }
  }
  const xDeEpoch = (epoch) => g.xHoje + ((epoch - hojeEpoch) / MS_DIA) * pxPorDia;
  return {
    pxPorDia,
    /** `dd/MM/aaaa` → pixel, CLAMPADO no eixo (é o que o desenho faz). */
    xDe: (br) => Math.min(Math.max(xDeEpoch(epochDeBr(br)), 0), g.larguraTotal),
    /** O mesmo, SEM clamp — para perguntar se uma data cai fora do eixo. */
    xDeBruto: (br) => xDeEpoch(epochDeBr(br)),
    /** `aaaa-MM-dd` → pixel clampado (as datas que vêm de `data-lb-*`). */
    xDeIso: (iso) => Math.min(Math.max(xDeEpoch(epochDeIso(iso)), 0), g.larguraTotal),
    /** pixel → a data que aquele pixel significa (o caminho inverso, que a
        medida dos rótulos do eixo usa: posição → data → o número impresso). */
    dataEm: (x) => {
      const dias = (x - g.xHoje) / pxPorDia;
      const inteiro = Math.round(dias);
      return {
        dias,
        inteiro,
        resto: Math.abs(dias - inteiro),
        iso: new Date(hojeEpoch + inteiro * MS_DIA).toISOString().slice(0, 10),
      };
    },
    hojeBr: new Date(hojeEpoch).toISOString().slice(0, 10),
    desalinhadas,
  };
}

/** As datas que o PRÓPRIO TEXTO da barra declara. */
function datasDoTitulo(title, hojeIso) {
  const brDeIso = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const par = /(\d{2}\/\d{2}\/\d{4})\s*→\s*(em aberto|\d{2}\/\d{2}\/\d{4})/.exec(title);
  if (par) {
    return { inicio: par[1], fim: par[2] === "em aberto" ? brDeIso(hojeIso) : par[2], parDeDatas: true };
  }
  const unica = /(?:mesmo dia\)|marco em|concluída em)[^\d]*(\d{2}\/\d{2}\/\d{4})/.exec(title)
    ?? /(\d{2}\/\d{2}\/\d{4})\s*\(mesmo dia\)/.exec(title);
  if (unica) return { inicio: unica[1], fim: unica[1], parDeDatas: true };
  return { inicio: null, fim: null, parDeDatas: false };
}

/** Uma passada de H + J numa página já aberta e num zoom já escolhido. */
async function medirPixelContraData(pagina, contexto) {
  const g = await lerGeometria(pagina);
  if (g === null) return { contexto, falhou: true, detalhe: "painel da linha do tempo não encontrado" };
  const regua = montarRegua(g);
  if (regua.erro) return { contexto, falhou: true, detalhe: `régua indisponível: ${regua.erro}` };
  const piores = [];
  const semData = [];
  let conferidas = 0;

  for (const a of g.afirmacoes) {
    /* ── intervalo declarado por `data-lb-*` (a hachura de folga) ───────── */
    if (a.medida === "intervalo") {
      const xDe = regua.xDeIso(a.de);
      const xAte = regua.xDeIso(a.ate);
      if (!Number.isFinite(xDe) || !Number.isFinite(xAte)) {
        piores.push(`${a.classes} declara datas ilegíveis (${String(a.de)} → ${String(a.ate)})`);
        continue;
      }
      conferidas += 1;
      if (Math.abs(a.esquerda - xDe) > TOLERANCIA_PX) {
        piores.push(
          `${a.classes} — começa em ${a.esquerda.toFixed(2)}, a data ${a.de} manda ${xDe.toFixed(2)} (${((a.esquerda - xDe) / regua.pxPorDia).toFixed(2)} dia de erro)`,
        );
      }
      if (Math.abs(a.direita - xAte) > TOLERANCIA_PX) {
        piores.push(
          `${a.classes} — acaba em ${a.direita.toFixed(2)}, a data ${a.ate} manda ${xAte.toFixed(2)} (${((a.direita - xAte) / regua.pxPorDia).toFixed(2)} dia de erro)`,
        );
      }
      continue;
    }

    /* ── posição afirmada pelo PRÓPRIO TEXTO do elemento ────────────────── */
    const prazo = /prazo\s+(\d{2}\/\d{2}\/\d{4})/.exec(a.title);
    const d = prazo ? { inicio: prazo[1], fim: prazo[1], parDeDatas: true } : datasDoTitulo(a.title, g.hojeIso);
    if (!d.parDeDatas) {
      semData.push(`[${a.classes || a.tipo}] "${a.title.slice(0, 50)}"`);
      continue;
    }
    const medido = a.medida === "posicao-centro" ? a.centro : a.esquerda;
    const alvo = regua.xDe(d.inicio);
    const erro = Math.abs(medido - alvo);
    conferidas += 1;
    if (erro > TOLERANCIA_PX) {
      piores.push(
        `${a.title.slice(0, 44)} — ${a.medida} medida ${medido.toFixed(2)}, a data ${d.inicio} manda ${alvo.toFixed(2)} (${(erro / regua.pxPorDia).toFixed(2)} dia de erro)`,
      );
    }
    /* O COMPRIMENTO também é uma afirmação sobre datas. Pulado só quando a
       barra é cortada pelo fim do eixo (aí o clamp é declarado no texto). */
    if (a.confereLargura && !/depois do fim da janela/.test(a.title)) {
      const larguraDaData = regua.xDe(d.fim) - regua.xDe(d.inicio);
      const esperada = Math.max(PISO_BARRA_PX, larguraDaData);
      if (Math.abs(a.largura - esperada) > TOLERANCIA_PX) {
        piores.push(
          `${a.title.slice(0, 44)} — largura ${a.largura.toFixed(2)}, as datas mandam ${esperada.toFixed(2)}`,
        );
      }
    }
  }

  /*
   * ── AS EXCEÇÕES NÃO SÃO PULOS: CADA UMA TEM A SUA CONFERÊNCIA ──────────
   * Um clamp declarado diz duas coisas ao mesmo tempo: "a data está fora" e
   * "por isso o glifo está na borda". As duas são verificáveis, e é isso que
   * separa uma exceção declarada de um `continue`.
   */
  const excecoesTortas = [];
  for (const e of g.excecoes) {
    if (e.dentroDeBarra) {
      /* O único dever aqui: existir uma barra medida que o contenha e que
         declare o corte no próprio texto. */
      if (e.tituloDaBarraPai === null) {
        excecoesTortas.push(`glifo "${e.title.slice(0, 30)}" diz estar dentro de uma barra que não existe`);
      }
      continue;
    }
    if (/^prazo /.test(e.title)) {
      /* `lb-tl-atraso-seta`: o prazo tem de estar MESMO fora da barra-pai, do
         lado que o texto declara. Se estiver dentro, o desenho certo seria o
         traço (`lb-tl-atraso`), que é medido — e a seta está mentindo. */
      const prazo = /prazo\s+(\d{2}\/\d{2}\/\d{4})/.exec(e.title)?.[1] ?? null;
      const pai = e.tituloDaBarraPai === null ? null : datasDoTitulo(e.tituloDaBarraPai, g.hojeIso);
      const antes = /antes do início/.test(e.title);
      if (prazo === null || pai === null || !pai.parDeDatas) {
        excecoesTortas.push(`seta de prazo sem barra-pai datada: "${e.title.slice(0, 40)}"`);
        continue;
      }
      const p = epochDeBr(prazo);
      const i = epochDeBr(pai.inicio);
      const f = epochDeBr(pai.fim);
      if (antes ? !(p < i) : !(p > f)) {
        excecoesTortas.push(
          `seta de prazo diz "${antes ? "antes do início" : "depois do fim"}" mas ${prazo} cai dentro de ${pai.inicio}→${pai.fim} — o desenho certo seria o traço`,
        );
      }
      continue;
    }
    /* `lb-tl-fora-da-janela` de fora da barra e `lb-tl-erro`: o glifo tem de
       estar preso a uma das duas bordas do eixo. */
    const naBordaEsquerda = Math.abs(e.esquerda) <= TOLERANCIA_PX;
    const naBordaDireita = Math.abs(e.direita - g.larguraTotal) <= 12 + TOLERANCIA_PX;
    if (!naBordaEsquerda && !naBordaDireita) {
      excecoesTortas.push(
        `"${e.title.slice(0, 40)}" se declara fora da janela mas não está em borda nenhuma (esquerda ${e.esquerda.toFixed(2)}, direita ${e.direita.toFixed(2)}, eixo ${String(g.larguraTotal)})`,
      );
      continue;
    }
    const datas = [...e.title.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((m) => m[0]);
    if (datas.length === 0) continue; /* `lb-tl-erro`: dado podre, sem data a conferir */
    /* A data declarada tem de estar MESMO fora da janela desenhada, do lado
       em que o glifo está. Senão o desenho se recusou a posicionar algo que
       cabia — e aí o "◀" é que é a mentira. */
    const xDaData = regua.xDeBruto(datas[0]);
    if (naBordaEsquerda && xDaData > TOLERANCIA_PX) {
      excecoesTortas.push(
        `"${e.title.slice(0, 40)}" está no "◀" da borda esquerda, mas ${datas[0]} cai em ${xDaData.toFixed(2)} — DENTRO do eixo`,
      );
    }
    if (naBordaDireita && xDaData < g.larguraTotal - TOLERANCIA_PX) {
      excecoesTortas.push(
        `"${e.title.slice(0, 40)}" está no "▶" da borda direita, mas ${datas[0]} cai em ${xDaData.toFixed(2)} — DENTRO do eixo (${String(g.larguraTotal)})`,
      );
    }
  }

  const resumoDePulos = g.excecoes.length === 0
    ? "0 pulados"
    : `${String(g.excecoes.length)} por exceção declarada: ${[
        ...new Set(g.excecoes.map((e) => `${e.classes || "?"} (${e.motivo})`)),
      ].join(" ; ")}`;

  return {
    contexto,
    falhou:
      piores.length > 0 ||
      semData.length > 0 ||
      regua.desalinhadas.length > 0 ||
      excecoesTortas.length > 0 ||
      g.desconhecidos.length > 0 ||
      g.semRegua.length > 0,
    conferidas,
    pxPorDia: regua.pxPorDia,
    detalhe:
      piores.length === 0 &&
      semData.length === 0 &&
      regua.desalinhadas.length === 0 &&
      excecoesTortas.length === 0 &&
      g.desconhecidos.length === 0 &&
      g.semRegua.length === 0
        ? `${String(conferidas)} afirmações de data conferidas a ${regua.pxPorDia.toFixed(3)} px/dia (régua: ${String(
            g.guias.length,
          )} guias de segunda + a faixa de ${g.hojeIso}), 0 fora de ±${String(TOLERANCIA_PX)} px — ${resumoDePulos}`
        : [
            g.desconhecidos.length > 0
              ? `DESENHO NOVO SEM RÉGUA (classe fora do REGISTRO): ${g.desconhecidos.join(", ")}`
              : null,
            g.semRegua.length > 0
              ? `elemento que afirma data e não caiu em régua nenhuma: ${g.semRegua
                  .map(
                    (x) =>
                      `[${x.classes || "sem classe lb-tl-"}] "${x.title.slice(0, 40)}" ${x.dataLb.join(",")}${
                        x.porque ? ` — ${x.porque}` : ""
                      }`,
                  )
                  .join(" · ")}`
              : null,
            regua.desalinhadas.length > 0 ? `guias fora da conta: ${regua.desalinhadas.join(" · ")}` : null,
            semData.length > 0 ? `elemento sem par de datas no texto: ${semData.join(" · ")}` : null,
            ...excecoesTortas,
            ...piores,
          ]
            .filter(Boolean)
            .join(" · "),
    foraDaGrade: g.foraDaGrade,
    titulosDeBarra: g.afirmacoes.filter((a) => a.tipo).map((a) => a.title),
    classesNoPainel: g.classesNoPainel,
    excecoes: g.excecoes,
    rotulosForaDaJanela: g.rotulosForaDaJanela,
    geometria: g,
    regua,
  };
}

{
  const resultados = [];
  for (const [largura, altura, zoom] of [
    [1440, 1000, null],
    [1440, 1000, "Semana"],
    [390, 844, null],
  ]) {
    const { contexto, pagina } = await abrir(largura, altura);
    if (zoom) {
      await pagina.locator(`button[aria-label=${JSON.stringify(zoom)}]`).first().click();
      await pagina.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
      );
    }
    resultados.push(
      await medirPixelContraData(pagina, `${String(largura)}×${String(altura)} ${zoom ?? "Auto"}`),
    );
    await contexto.close();
  }
  for (const r of resultados) {
    conferir(`H · cada barra no pixel que a sua data manda (${r.contexto})`, !r.falhou && (r.conferidas ?? 0) > 0, r.detalhe);
  }

  // ── J · nenhuma barra sem dado, e nenhuma linha sem dado na grade ─────────
  for (const r of resultados) {
    const semDatas = (r.titulosDeBarra ?? []).filter(
      (t) => !datasDoTitulo(t, "2026-01-01").parDeDatas,
    );
    const fora = r.foraDaGrade ?? [];
    const comBarra = fora.filter((f) =>
      (r.titulosDeBarra ?? []).some((t) => t.startsWith(`${f.titulo} —`)),
    );
    conferir(
      `J · barra só existe com duas datas no próprio texto (${r.contexto})`,
      semDatas.length === 0 && comBarra.length === 0,
      semDatas.length === 0 && comBarra.length === 0
        ? `${String((r.titulosDeBarra ?? []).length)} barras, todas declarando datas — ${String(
            fora.length,
          )} linha(s) fora da grade (${fora.map((f) => f.motivo).join(", ") || "nenhuma"}), 0 com barra`
        : [
            semDatas.length > 0
              ? `barra sem datas no texto: ${semDatas.map((t) => `"${t.slice(0, 50)}"`).join(" · ")}`
              : null,
            comBarra.length > 0
              ? `linha marcada "${comBarra[0].motivo}" com barra na grade: ${comBarra
                  .map((f) => f.titulo)
                  .join(" · ")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// N · TODA CAMADA QUE A GUARDA AFIRMA VER, PINTADA DE VERDADE
//     (achado CRÍTICO 1, generalizado)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * A varredura que o CRÍTICO 1 pediu: não só a faixa do "Hoje", mas TODA camada
 * sobre a qual alguma medida deste arquivo faz uma afirmação. Se H diz "esta
 * barra está no pixel que a data manda" e a barra está com `opacity: 0`, H
 * está certa e irrelevante ao mesmo tempo: a afirmação é sobre uma coisa que
 * o operador não vê.
 *
 * Cada camada passa por duas peneiras, e nenhuma delas lê atributo declarado
 * sozinho:
 *   1. ALFA REAL composto subindo a árvore (`__lbg.retrato`) — pega `opacity`
 *      no elemento e em qualquer ancestral, `visibility` herdada e `display`;
 *   2. PIXEL — a janelinha fotografada com e sem o elemento.
 *
 * `esperado` é quantos daquela camada TÊM de existir: `>=1` significa que zero
 * é REPROVAÇÃO. Alvo ausente não é dispensa — foi assim que `lb-tl-slack` e
 * `lb-tl-atraso` passaram duas rodadas com zero cobertura sem ninguém notar.
 */
/*
 * `garantida: true` = a fixture põe esta camada na tela em toda corrida, logo
 * ZERO dela é REPROVAÇÃO (alvo ausente não é dispensa). `garantida: false` =
 * a presença depende de dado que a fixture não fixa; aí a contagem é
 * IMPRESSA no relatório em toda corrida — o zero fica visível, nunca
 * silencioso — e a camada é medida sempre que existir. É a diferença entre
 * "não cobri" declarado e "não cobri" escondido.
 */
const CAMADAS_QUE_A_GUARDA_AFIRMA = [
  { seletor: ".lb-tl-hoje", cor: "borda", modo: "coluna", minimo: 8, garantida: true, quem: 'faixa do "Hoje" (a origem da régua de H e M)' },
  { seletor: ".lb-tl-guia-semana", cor: "borda", modo: "coluna", minimo: 6, garantida: true, quem: "guias de segunda-feira (dão px/dia para H e M)" },
  { seletor: "[data-lb-barra]", cor: "fundo", modo: "coluna", minimo: 8, garantida: true, quem: "barras (o que H mede contra a data)" },
  { seletor: ".lb-tl-marco", cor: "fundo", modo: "coluna", minimo: 4, garantida: false, quem: "losangos de marco (H mede o centro)" },
  { seletor: ".lb-tl-hoje-rotulo", cor: "texto", modo: "caixa", minimo: 8, garantida: true, quem: 'chip dourado de "hoje" (âncora datada do cabeçalho, em M)' },
  { seletor: ".lb-tl-slack", cor: "fundo", modo: "caixa", minimo: 8, garantida: true, quem: "hachura de folga (H mede as duas bordas dela)" },
  { seletor: ".lb-tl-atraso", cor: "fundo", modo: "coluna", minimo: 4, garantida: true, quem: "traço de prazo dentro da barra (H mede xDe(prazo))" },
  { seletor: ".lb-tl-fora-da-janela", cor: "texto", modo: "caixa", minimo: 4, garantida: true, quem: "chevrons de fora da janela (exceção declarada de H)" },
  { seletor: ".lb-tl-fora-da-janela-rotulo", cor: "texto", modo: "caixa", minimo: 8, garantida: true, quem: "a data POR ESCRITO do item fora da janela (achado ALTO 3)" },
  { seletor: ".lb-tl-fora-da-grade", cor: "texto", modo: "caixa", minimo: 8, garantida: true, quem: "o motivo POR ESCRITO da linha sem barra (J confia nele)" },
];

for (const [largura, altura] of [
  [1440, 1000],
  [390, 844],
]) {
  const { contexto, pagina } = await abrir(largura, altura);
  const problemas = [];
  const resumo = [];
  for (const camada of CAMADAS_QUE_A_GUARDA_AFIRMA) {
    const alvos = await pagina.$$(camada.seletor);
    if (alvos.length === 0) {
      if (camada.garantida) {
        problemas.push(
          `${camada.seletor} — NENHUM na tela, e a guarda afirma coisas sobre ${camada.quem}: alvo ausente é reprovação, não dispensa`,
        );
      } else {
        /* Declarado, nunca calado: a contagem zero vai para o relatório. */
        resumo.push(`${camada.seletor}=0/0 (não garantida pela fixture: ${camada.quem})`);
      }
      continue;
    }
    let pintam = 0;
    const falhas = [];
    for (const alvo of alvos) {
      const r = await alvo.evaluate((el) => window.__lbg.retrato(el));
      const cor =
        camada.cor === "borda"
          ? r.esperadaDaBorda
          : camada.cor === "fundo"
            ? r.esperadaDoFundo
            : r.esperadaDoTexto;
      const alfa =
        camada.cor === "borda" ? r.alfaDaBorda : camada.cor === "fundo" ? r.alfaDoFundo : r.alfaDoTexto;
      const alfaOk = alfa > 0 && r.visivelHerdado && r.opacidadeAcumulada > 0;
      const pintou = await pintaDeVerdade(pagina, alvo, cor, camada.minimo, camada.modo);
      if (alfaOk && pintou.ok) {
        pintam += 1;
        continue;
      }
      falhas.push(
        `"${(r.texto || camada.seletor).slice(0, 28)}": ${
          alfaOk ? "" : `alfa real ${alfa.toFixed(3)} (opacidade acumulada ${r.opacidadeAcumulada.toFixed(3)}, visível herdado ${String(r.visivelHerdado)}) · `
        }${pintou.ok ? "" : pintou.motivo}`,
      );
    }
    if (pintam !== alvos.length) {
      problemas.push(`${camada.seletor} (${camada.quem}): ${String(pintam)}/${String(alvos.length)} pintam — ${falhas.slice(0, 2).join(" ; ")}`);
    }
    resumo.push(`${camada.seletor}=${String(pintam)}/${String(alvos.length)}`);
  }
  conferir(
    `N · toda camada que a guarda afirma ver está PINTADA (${String(largura)}×${String(altura)})`,
    problemas.length === 0,
    problemas.length === 0
      ? `${String(CAMADAS_QUE_A_GUARDA_AFIRMA.length)} camadas, todas com alfa real > 0 E pixel que muda ao esconder — ${resumo.join(" · ")}`
      : problemas.join(" · "),
  );
  await contexto.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// O · OS MECANISMOS DESENHADOS NÃO PODEM CONTAR ZERO (achado ALTO 1)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * `lb-tl-slack` (que afirma `fim → fimComFolga`) e `lb-tl-atraso` (que afirma
 * `xFor(dueDate)` dentro da barra) contavam **0 nos 4 estados medidos**, em
 * toda largura e todo zoom: as duas únicas tarefas com barra da fixture eram
 * as duas do caminho crítico, com `folga: 0 d`, e o único prazo caía fora da
 * barra. Dois mecanismos desenhados, com régua escrita e zero cobertura.
 *
 * Contar zero é o estado em que uma régua não mede nada e diz "ok". Esta
 * medida transforma esse silêncio em vermelho — e é ela, não um comentário na
 * fixture, que impede a cobertura de sumir de novo (por exemplo se a janela
 * do zoom "Auto" andar com o calendário e a barra atrasada sair dela: aí o
 * zoom fixo ainda a desenha, e é isto que vai dizer se os dois somaram zero).
 */
{
  const CLASSES_OBRIGATORIAS = [
    ["lb-tl-slack", "a hachura de folga afirma `fim → fimComFolga`"],
    ["lb-tl-atraso", "o traço de prazo afirma `xFor(dueDate)` dentro da barra"],
    ["lb-tl-fora-da-janela", "o chevron declara uma data fora da janela"],
    ["lb-tl-ponto-concluida", "o ponto afirma a data de conclusão"],
  ];
  /*
   * DECLARADO, e por isso impresso em toda corrida em vez de exigido: o
   * losango de marco existe quando um assunto começa e acaba no MESMO dia de
   * calendário, e a fixture de frentes monta os PRs relativos a `Date.now()`
   * (`criado_em: h(9)` — nove horas atrás). Um PR aberto nove horas atrás cai
   * no mesmo dia de calendário durante parte do dia e no dia anterior no
   * resto — medido: 3 losangos às 01h e 0 às 03h, com a mesma árvore.
   * Exigir ≥ 1 aqui seria uma guarda que fica vermelha pela hora do relógio,
   * não pelo produto. Quando existe um, H mede o CENTRO dele contra a data do
   * próprio texto (está na coleta derivada como `posicao-centro`), e a
   * contagem abaixo mostra em toda corrida se havia algum.
   */
  const SO_DECLARADAS = [["lb-tl-marco", "o losango afirma uma data única"]];
  const soma = {};
  const porEstado = [];
  for (const [largura, altura, zoom] of [
    [1440, 1000, null],
    [1440, 1000, "Semana"],
    [1440, 1000, "Trimestre"],
    [390, 844, null],
  ]) {
    const { contexto, pagina } = await abrir(largura, altura);
    if (zoom) {
      await pagina.locator(`button[aria-label=${JSON.stringify(zoom)}]`).first().click();
      await pagina.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
      );
    }
    const g = await lerGeometria(pagina);
    const c = g?.classesNoPainel ?? {};
    for (const [classe] of [...CLASSES_OBRIGATORIAS, ...SO_DECLARADAS]) {
      soma[classe] = (soma[classe] ?? 0) + (c[classe] ?? 0);
    }
    porEstado.push(
      `${String(largura)}×${String(altura)} ${zoom ?? "Auto"}: ${[...CLASSES_OBRIGATORIAS, ...SO_DECLARADAS]
        .map(([classe]) => `${classe.replace("lb-tl-", "")}=${String(c[classe] ?? 0)}`)
        .join(" ")}`,
    );
    await contexto.close();
  }
  const zeradas = CLASSES_OBRIGATORIAS.filter(([classe]) => (soma[classe] ?? 0) === 0);
  conferir(
    "O · nenhum mecanismo desenhado soma ZERO nos 4 estados medidos",
    zeradas.length === 0,
    zeradas.length === 0
      ? `${String(CLASSES_OBRIGATORIAS.length)} mecanismos obrigatórios, todos desenhados ao menos uma vez; ${SO_DECLARADAS.map(
          ([classe]) => `${classe}=${String(soma[classe] ?? 0)} (só declarado, presença depende da hora do dia)`,
        ).join(", ")} — ${porEstado.join(" | ")}`
      : `mecanismo com ZERO cobertura de navegador: ${zeradas
          .map(([classe, porque]) => `${classe} (${porque})`)
          .join(" · ")} — ${porEstado.join(" | ")}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// P · NENHUM ITEM FORA DA JANELA É UMA LINHA MUDA (achado ALTO 3)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * A lei da casa (`periodo-da-tarefa.ts`): "uma linha sem barra não pode ser
 * uma linha muda". Estava aplicada às tarefas SEM DADO e não às que caem
 * FORA DA JANELA — essas viravam um "◀" de 9px, `aria-hidden="true"`,
 * `tabIndex={-1}`, com a data só no `title`. E este repositório já mediu, na
 * rodada 7, que `title` não existe no toque: a 390×844, 6 de 18 itens (33%)
 * não entregavam a data por nenhum canal tocável. Pior nas CONCLUÍDAS fora da
 * janela, em que o `aria-label` também não dizia data nenhuma.
 *
 * A medida amarra as duas superfícies: cada chevron do canvas TEM de ter, na
 * coluna de rótulos, um texto VISÍVEL com a sua data-âncora, e o `aria-label`
 * da linha tem de dizer o período. Um a um, não por contagem.
 */
for (const [largura, altura] of [
  [390, 844],
  [1440, 1000],
]) {
  const { contexto, pagina } = await abrir(largura, altura);
  const g = await lerGeometria(pagina);
  /* Os chevrons do CANVAS que se recusam a posicionar uma linha inteira — não
     o "▶" que vive dentro de uma barra cortada pelo fim do eixo (esse é da
     barra, que já tem `title` datado e já é medida por H). */
  const chevrons = (g?.excecoes ?? []).filter(
    (e) => !e.dentroDeBarra && e.classes.includes("lb-tl-fora-da-janela"),
  );
  const rotulos = g?.rotulosForaDaJanela ?? [];
  const problemas = [];
  const pares = [];
  for (const c of chevrons) {
    const datas = [...c.title.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((m) => m[0]);
    if (datas.length === 0) {
      problemas.push(`o chevron "${c.title.slice(0, 40)}" não declara data nenhuma nem no title`);
      continue;
    }
    /* A âncora é a data que decide o lado: o início, ou (nas concluídas) a
       data de conclusão — que é a ÚNICA do title nesse caso. */
    const ancora = /concluída em/.test(c.title) ? datas[datas.length - 1] : datas[0];
    const casado = rotulos.find((r) => r.texto.includes(ancora));
    if (!casado) {
      problemas.push(
        `"${c.title.slice(0, 36)}" é um chevron de 9px e NENHUM rótulo visível da coluna imprime ${ancora} — a data só existe no title, que não existe no toque`,
      );
      continue;
    }
    if (!/\d{2}\/\d{2}\/\d{4}/.test(casado.rotuloAcessivel)) {
      problemas.push(`a linha de "${c.title.slice(0, 30)}" tem texto visível mas o aria-label não diz data nenhuma`);
      continue;
    }
    pares.push(`"${casado.texto}"`);
  }
  if (chevrons.length === 0) {
    /* Alvo ausente é reprovação: sem nenhum item fora da janela esta medida
       não mede nada, e não pode passar como se tivesse medido. */
    problemas.push("nenhum item fora da janela nesta tela — a medida não teria o que conferir");
  }
  conferir(
    `P · todo item fora da janela diz a sua data por escrito na coluna (${String(largura)}×${String(altura)})`,
    problemas.length === 0,
    problemas.length === 0
      ? `${String(chevrons.length)} chevron(s) no canvas, ${String(rotulos.length)} rótulo(s) datado(s) na coluna, todos casados — ${pares.slice(0, 3).join(" · ")}…`
      : problemas.slice(0, 3).join(" · "),
  );
  await contexto.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// M · OS RÓTULOS DE DATA DO EIXO, CONTRA A MESMA RÉGUA DAS BARRAS
//     (achado CRÍTICO 2)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * A régua da medida H é feita de duas coisas do CANVAS: as guias de
 * segunda-feira e a faixa do "Hoje". Os **rótulos de data do eixo** — os
 * "14", "15", "24" que o operador lê no cabeçalho para saber em que dia a
 * barra começa — saem de OUTRO array (`rotulosVisiveis`), moram em OUTRO
 * contêiner de rolagem (o cabeçalho transladado) e não entravam em régua
 * nenhuma. Um `.map` de uma linha deslocou todos eles 1 dia inteiro, poupando
 * o chip de "hoje" (o único com teste unitário), e os cinco portões ficaram
 * verdes: a barra "Deploy de produção — 24/09/2026" foi desenhada exatamente
 * sob o rótulo escrito "23", e a medida H imprimiu "0 fora de ±1,5 px".
 *
 * A medida é o CAMINHO INVERSO do que a rodada 11 fez para as barras:
 * posição → data (pela régua do canvas) → e o número que essa data manda tem
 * de ser o número IMPRESSO no rótulo. Três fontes independentes cruzadas
 * (guias, faixa do "Hoje", texto do rótulo), como em H.
 *
 * ## Por que em VÁRIAS posições de rolagem, e depois de um resize
 *
 * O cabeçalho é um contêiner TRANSLADADO que se sincroniza com o `scrollLeft`
 * do painel por handler de `scroll` e de `resize`. Medir só o primeiro quadro
 * mediria o único instante em que os dois estão sincronizados por construção
 * — e este repositório já mediu um caso em que o cabeçalho ficava "parado no
 * valor antigo, 329,6px adiantado das barras" depois de um resize. Uma
 * afirmação sobre a linha do tempo que só vale no instante do carregamento
 * não vale. Então: 5 posições de rolagem E um resize, e a régua é refeita do
 * zero em cada uma.
 */
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Confere os rótulos do eixo de uma página no estado em que ela está. */
async function medirRotulosDoEixo(pagina, comoChegou) {
  const g = await lerGeometria(pagina);
  if (g === null) return [`${comoChegou}: painel não encontrado`];
  const regua = montarRegua(g);
  if (regua.erro) return [`${comoChegou}: régua indisponível (${regua.erro})`];
  const erros = [];
  let conferidos = 0;
  for (const r of g.eixo) {
    const d = regua.dataEm(r.esquerda);
    const data = new Date(`${d.iso}T00:00:00.000Z`);
    const dia = data.getUTCDate();
    const mes = data.getUTCMonth();
    if (r.tipo === "dia" || r.tipo === "dia-mes" || r.tipo === "hoje") {
      conferidos += 1;
      /* O rótulo tem de cair EM CIMA de um dia inteiro da régua, não entre dois. */
      if (d.resto * regua.pxPorDia > TOLERANCIA_PX) {
        erros.push(
          `${comoChegou}: rótulo "${r.texto}" em ${r.esquerda.toFixed(2)} não cai em dia nenhum da régua (${d.dias.toFixed(3)} dia)`,
        );
        continue;
      }
      const esperadoDia = r.tipo === "dia" ? String(dia) : `${String(dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}`;
      if (r.texto !== esperadoDia) {
        erros.push(
          `${comoChegou}: o eixo imprime "${r.texto}" em ${r.esquerda.toFixed(2)}, mas a régua diz que ali é ${d.iso} (esperado "${esperadoDia}") — ${(
            (r.esquerda - regua.xDe(`${String(Number(r.texto.slice(0, 2)) || dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${String(data.getUTCFullYear())}`)) /
            regua.pxPorDia
          ).toFixed(2)} dia de erro`,
        );
      }
      if (r.tipo === "hoje") {
        /* O chip dourado e a faixa dourada são a MESMA data: se os dois se
           separarem, a régua tem duas origens e nenhuma é confiável. */
        if (Math.abs(r.esquerda - g.xHoje) > TOLERANCIA_PX) {
          erros.push(
            `${comoChegou}: o chip de "hoje" está em ${r.esquerda.toFixed(2)} e a faixa dourada em ${g.xHoje.toFixed(2)} — o cabeçalho saiu de sincronia com o canvas`,
          );
        }
        if (d.iso !== g.hojeIso) {
          erros.push(`${comoChegou}: o chip de "hoje" cai em ${d.iso}, e a faixa declara ${String(g.hojeIso)}`);
        }
      }
      continue;
    }
    if (r.tipo === "mes") {
      conferidos += 1;
      const nome = r.texto.slice(0, 3);
      const indice = MESES_CURTOS.indexOf(nome);
      if (indice < 0) {
        erros.push(`${comoChegou}: rótulo de mês ilegível "${r.texto}"`);
        continue;
      }
      /* O rótulo de mês nasce no dia 1º, mas o PRIMEIRO da janela é grudado na
         borda esquerda por construção (`gerarEscalaEixo`) — ali a régua diz o
         dia em que a janela começa, e o mês desse dia é que tem de bater.
         Exceção DECLARADA, e conferida: só vale em x ≈ 0. */
      const naBorda = Math.abs(r.esquerda) <= TOLERANCIA_PX;
      if (!naBorda && dia !== 1) {
        erros.push(
          `${comoChegou}: o rótulo "${r.texto}" está em ${r.esquerda.toFixed(2)}, que a régua diz ser ${d.iso} — um rótulo de mês fora da borda tem de cair no dia 1º`,
        );
      }
      if (indice !== mes) {
        erros.push(
          `${comoChegou}: o eixo imprime o mês "${r.texto}" em ${r.esquerda.toFixed(2)}, e a régua diz que ali é ${d.iso}`,
        );
      }
      if (/\d{4}/.test(r.texto) && !r.texto.includes(String(data.getUTCFullYear()))) {
        erros.push(`${comoChegou}: o rótulo "${r.texto}" declara um ano que a régua não confirma (${d.iso})`);
      }
    }
  }
  if (conferidos === 0) {
    /* Alvo ausente é REPROVAÇÃO, nunca dispensa: um eixo sem nenhum rótulo
       datado é exatamente o estado em que esta medida não mede nada. */
    return [`${comoChegou}: nenhum rótulo de data no eixo — não há o que conferir, e isso não é um passe`];
  }
  return erros.length > 0 ? erros : [];
}

for (const [largura, altura, zoom] of [
  [1440, 1000, null],
  [1440, 1000, "Semana"],
  [390, 844, null],
]) {
  const { contexto, pagina } = await abrir(largura, altura);
  if (zoom) {
    await pagina.locator(`button[aria-label=${JSON.stringify(zoom)}]`).first().click();
    await pagina.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    );
  }
  const maximo = await pagina.evaluate(() => {
    const el = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
    return el ? el.scrollWidth - el.clientWidth : 0;
  });
  const erros = [];
  let cenas = 0;
  for (const fracao of [0, 0.25, 0.5, 0.75, 1]) {
    const alvo = Math.round(maximo * fracao);
    await pagina.evaluate(async (x) => {
      const el = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
      if (el) el.scrollLeft = x;
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(null))));
    }, alvo);
    cenas += 1;
    erros.push(...(await medirRotulosDoEixo(pagina, `rolagem ${String(alvo)}px`)));
  }
  /*
   * E depois de MUDANÇAS TARDIAS de tamanho. Uma afirmação que só sobrevive
   * ao primeiro quadro não é uma afirmação — e o gatilho exato do defeito de
   * sincronia que este repositório já mediu (achado ALTO A1 da rodada 6:
   * "o cabeçalho ficava parado no valor antigo, 329,6px adiantado das
   * barras") é ALARGAR o painel com a rolagem no MÁXIMO: o máximo diminui, o
   * navegador clampa o `scrollLeft` sozinho e, por já estar no valor novo,
   * nunca dispara `scroll` — quem tem de pegar isso é o `ResizeObserver`.
   *
   * Medido: uma sabotagem própria desta rodada (tirar a re-sincronização do
   * `ResizeObserver`) passava pela versão desta medida que só ENCOLHIA o
   * painel, porque encolher AUMENTA o máximo de rolagem e não clampa nada.
   * Por isso as duas direções, e sempre a partir da rolagem no máximo.
   */
  for (const [nome, fator] of [
    ["alargar", 1.6],
    ["encolher", 0.75],
  ]) {
    await pagina.evaluate(async () => {
      const el = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
      if (el) el.scrollLeft = el.scrollWidth;
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(null))));
    });
    await pagina.setViewportSize({ width: Math.round(largura * fator), height: altura });
    await pagina.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    );
    cenas += 1;
    erros.push(
      ...(await medirRotulosDoEixo(
        pagina,
        `${nome} para ${String(Math.round(largura * fator))}px com a rolagem no máximo`,
      )),
    );
    await pagina.setViewportSize({ width: largura, height: altura });
    await pagina.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    );
  }
  conferir(
    `M · o eixo imprime a data que a régua manda (${String(largura)}×${String(altura)} ${zoom ?? "Auto"})`,
    erros.length === 0,
    erros.length === 0
      ? `${String(cenas)} cenas (5 posições de rolagem + 2 resizes tardios com a rolagem no máximo, alargando e encolhendo), todos os rótulos de dia/mês/hoje batendo com a régua do canvas em ±${String(TOLERANCIA_PX)} px`
      : `${String(erros.length)} divergência(s) — ${erros.slice(0, 4).join(" · ")}`,
  );
  await contexto.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// K · ABRIR A GAVETA NÃO RE-ESCALA O EIXO (achado MÉDIO 5)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * A partir de 768px a gaveta é uma COLUNA e comprime o gráfico. Enquanto o
 * "auto" derivava `px/dia` da largura VISÍVEL, clicar numa linha para
 * inspecioná-la mudava a escala inteira — medido pelo crítico: a 1024×768 o
 * canvas ia de 736 para 424 px (42% menos), o "hoje" andava de 519 para 411 e
 * a barra clicada encolhia de 85 para 49 px. Toda barra mudava de tamanho e
 * de lugar no instante da inspeção, inclusive a que se estava olhando.
 */
for (const [largura, altura] of [
  [1024, 768],
  [1440, 900],
]) {
  const { contexto, pagina } = await abrir(largura, altura);
  const antes = await lerGeometria(pagina);
  const reguaAntes = montarRegua(antes);
  const barraAlvo = antes.afirmacoes.find((a) => a.medida === "posicao-esquerda" && a.tipo);
  const rotulo = await pagina.$$eval('button[aria-haspopup="dialog"]', (els) =>
    els.map((e) => e.getAttribute("aria-label") ?? "").find((r) => r.includes("— assunto em ")),
  );
  await pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first().click();
  await pagina.waitForSelector("[data-lb-detalhe]");
  await pagina.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
  const depois = await lerGeometria(pagina);
  const reguaDepois = montarRegua(depois);
  const mesmaBarra = depois.afirmacoes.find((a) => a.title === barraAlvo?.title);
  const dPx = Math.abs((reguaDepois.pxPorDia ?? 0) - (reguaAntes.pxPorDia ?? 0));
  const dHoje = Math.abs((depois.xHoje ?? 0) - (antes.xHoje ?? 0));
  const dBarra = mesmaBarra && barraAlvo ? Math.abs(mesmaBarra.esquerda - barraAlvo.esquerda) : -1;
  const dLargura =
    mesmaBarra && barraAlvo ? Math.abs(mesmaBarra.largura - barraAlvo.largura) : -1;
  conferir(
    `K · abrir a gaveta não re-escala o eixo (${String(largura)}×${String(altura)})`,
    dPx <= 0.01 && dHoje <= 0.5 && dBarra >= 0 && dBarra <= 0.5 && dLargura <= 0.5,
    `px/dia ${(reguaAntes.pxPorDia ?? 0).toFixed(3)} → ${(reguaDepois.pxPorDia ?? 0).toFixed(3)} · ` +
      `"hoje" ${(antes.xHoje ?? 0).toFixed(2)} → ${(depois.xHoje ?? 0).toFixed(2)} · ` +
      `barra "${(barraAlvo?.title ?? "").slice(0, 28)}" left ${(barraAlvo?.esquerda ?? 0).toFixed(2)} → ${(
        mesmaBarra?.esquerda ?? 0
      ).toFixed(2)}, largura ${(barraAlvo?.largura ?? 0).toFixed(2)} → ${(mesmaBarra?.largura ?? 0).toFixed(2)}`,
  );
  await contexto.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// I · O PAR REAL DE CADA TEXTO VISÍVEL (cor computada × fundo composto)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Rodada 12 (achado ALTO 2). O rótulo desta medida era "todo texto visível
 * medido contra o fundo REAL (as 2 gavetas abertas)" — e ela abria 2 gavetas
 * de 22, num único viewport, num único zoom. Rodando o PRÓPRIO algoritmo dela
 * em todos os estados: 99 textos existiam, 64 nunca eram medidos — a linha
 * `marcas` inteira ("caminho crítico · atrasada", "sem estimativa · início
 * não definido"), o campo "Prazo:" e as datas de 20 das 22 gavetas. Nada
 * estava fora da régua; o defeito era a medida NÃO SABER se estivesse, com um
 * nome que afirmava o contrário.
 *
 * Agora ela abre TODAS as gavetas, nos DOIS tamanhos, e passa pelos TRÊS
 * zooms (cada zoom desenha um conjunto diferente de barras e de rótulos de
 * eixo, logo um conjunto diferente de textos). O que ela NÃO cobre está
 * declarado no fim do relatório dela, por escrito, em vez de ficar implícito
 * num nome generoso.
 */
for (const [largura, altura] of [
  [1440, 1000],
  [390, 844],
]) {
  const { contexto, pagina } = await abrir(largura, altura);

  const medirTextos = async () =>
    await pagina.evaluate(() => {
      const canais = (css) => {
        const n = (css.match(/[\d.]+/g) ?? []).map(Number);
        return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
      };
      /** `frente` sobre `fundo`, alfa do primeiro. */
      const compor = (frente, fundo) => {
        const a = frente[3];
        return [
          frente[0] * a + fundo[0] * (1 - a),
          frente[1] * a + fundo[1] * (1 - a),
          frente[2] * a + fundo[2] * (1 - a),
          1,
        ];
      };
      const BRANCO_DO_CANVAS = [5, 7, 15, 1]; // navy-950 — só se nem o <html> tiver fundo
      const alvos = [...document.querySelectorAll("*")].filter((el) => {
        if (el.children.length > 0) return false;
        if (!(el.textContent ?? "").trim()) return false;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") return false;
        return true;
      });
      return alvos.map((el) => {
        const cs = getComputedStyle(el);
        const meu = el.getBoundingClientRect();
        /*
          O FUNDO É O QUE ESTÁ ATRÁS, NÃO O QUE ESTÁ ACIMA NA ÁRVORE.
          Medido na 1ª execução desta medida: o badge "atrasada" e a bandeira
          "⚑" são `absolute` e nascem FORA da caixa da barra (logo depois do
          fim dela, ou 10px antes do início) — mas continuam filhos dela no
          DOM. Subir a árvore sem olhar a geometria dava "bone-300 sobre
          aresta-critico, 1,45:1" e "state-error sobre state-error, 1,00:1"
          para dois textos que o navegador pinta sobre o canvas escuro. Um
          ancestral só conta como fundo quando a caixa dele CONTÉM a minha.
          Limitação declarada: um texto que atravessa a fronteira de dois
          fundos é medido contra o de fora (o que contém os dois).
        */
        const contem = (r) =>
          r.left - 0.5 <= meu.left &&
          r.right + 0.5 >= meu.right &&
          r.top - 0.5 <= meu.top &&
          r.bottom + 0.5 >= meu.bottom;
        const pilha = [];
        let opacidade = Number.parseFloat(cs.opacity);
        let n = el;
        let fundo = null;
        while (n) {
          const c = getComputedStyle(n);
          const cor = canais(c.backgroundColor);
          const alfa = cor[3] * Number.parseFloat(c.opacity);
          if (alfa > 0 && (n === el || contem(n.getBoundingClientRect()))) {
            pilha.push([cor[0], cor[1], cor[2], Math.min(1, alfa)]);
            if (alfa >= 0.999) {
              fundo = pilha.pop();
              break;
            }
          }
          n = n.parentElement;
          if (n && n !== el) opacidade *= Number.parseFloat(getComputedStyle(n).opacity);
        }
        if (fundo === null) fundo = BRANCO_DO_CANVAS;
        for (let i = pilha.length - 1; i >= 0; i -= 1) fundo = compor(pilha[i], fundo);
        const frente = canais(cs.color);
        const corFinal = compor([frente[0], frente[1], frente[2], frente[3] * opacidade], fundo);
        const tamanho = Number.parseFloat(cs.fontSize);
        const peso = Number.parseInt(cs.fontWeight, 10) || 400;
        return {
          texto: (el.textContent ?? "").trim().slice(0, 34),
          cor: `rgb(${corFinal.slice(0, 3).map((v) => Math.round(v)).join(", ")})`,
          fundo: `rgb(${fundo.slice(0, 3).map((v) => Math.round(v)).join(", ")})`,
          canaisCor: corFinal,
          canaisFundo: fundo,
          minimo: tamanho >= 24 || (tamanho >= 18.66 && peso >= 700) ? 3 : 4.5,
          onde: el.closest("[data-lb-detalhe]") ? "gaveta" : "tela",
        };
      });
    });

  const cenas = [];
  const assentar = async () =>
    await pagina.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    );

  /* Um zoom por cena: cada um desenha outro conjunto de barras e de rótulos
     de eixo — logo, outro conjunto de textos na tela. */
  for (const zoom of [null, "Semana", "Trimestre"]) {
    if (zoom) {
      await pagina.locator(`button[aria-label=${JSON.stringify(zoom)}]`).first().click();
      await assentar();
    }
    cenas.push({ nome: `tela sem gaveta · ${zoom ?? "Auto"}`, amostras: await medirTextos() });
  }
  await pagina.locator('button[aria-label="Auto"]').first().click();
  await assentar();

  /* E TODAS as gavetas, uma por uma — não "a primeira tarefa e o primeiro
     assunto", que era o que deixava 20 das 22 datas de gaveta sem medida. */
  const rotulos = await pagina.$$eval('button[aria-haspopup="dialog"]', (els) =>
    els.map((el) => el.getAttribute("aria-label") ?? ""),
  );
  let gavetasAbertas = 0;
  for (const rotulo of rotulos) {
    const botao = pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first();
    await botao.scrollIntoViewIfNeeded();
    await botao.click();
    await pagina.waitForSelector("[data-lb-detalhe]");
    await assentar();
    gavetasAbertas += 1;
    cenas.push({ nome: `gaveta "${rotulo.slice(0, 26)}"`, amostras: await medirTextos() });
  }
  if (gavetasAbertas !== rotulos.length) {
    /* Alvo ausente é reprovação: uma gaveta que não abriu é uma gaveta não
       medida, e o relatório não pode dizer que mediu todas. */
    conferir(
      `I · abriu todas as gavetas (${String(largura)}×${String(altura)})`,
      false,
      `${String(gavetasAbertas)} de ${String(rotulos.length)} gavetas abriram`,
    );
  }

  const reprovados = [];
  let medidos = 0;
  let emGaveta = 0;
  const distintos = new Set();
  let pior = { r: 99, texto: "", cor: "", fundo: "" };
  for (const cena of cenas) {
    for (const a of cena.amostras) {
      const r = razao(a.canaisCor, a.canaisFundo);
      medidos += 1;
      distintos.add(`${a.onde}|${a.texto}`);
      if (a.onde === "gaveta") emGaveta += 1;
      if (r < pior.r) pior = { r, texto: a.texto, cor: a.cor, fundo: a.fundo };
      if (r < a.minimo) {
        reprovados.push(
          `[${cena.nome}] "${a.texto}" ${r.toFixed(2)}:1 (min ${String(a.minimo)}) — ${a.cor} sobre ${a.fundo}`,
        );
      }
    }
  }
  /*
   * O QUE ESTA MEDIDA NÃO COBRE — declarado, porque um nome generoso sobre
   * uma cobertura estreita foi exatamente o achado ALTO 2:
   *   · estados que a fixture não produz (data inválida, datas inconsistentes,
   *     tarefa com prazo dentro E fora da barra ao mesmo tempo) — não há
   *     caminho de dado para eles nesta fixture, e a medida N imprime a
   *     contagem zero de cada camada em toda corrida;
   *   · larguras entre 390 e 1440 (as duas pontas são medidas, o meio não);
   *   · `:hover`/`:focus`, que mudam cor e não são um estado de repouso.
   */
  const naoCobre =
    "não cobre: estados sem caminho de dado na fixture, larguras entre 390 e 1440, e :hover/:focus";
  conferir(
    `I · o par real de TODO texto visível, em TODAS as gavetas e nos 3 zooms (${String(largura)}×${String(altura)})`,
    medidos > 0 && emGaveta > 0 && reprovados.length === 0,
    reprovados.length === 0
      ? `${String(medidos)} nós de texto (${String(distintos.size)} distintos) em ${String(
          cenas.length,
        )} cenas — 3 zooms + ${String(cenas.length - 3)} gavetas, ${String(
          emGaveta,
        )} nós dentro de gavetas — pior ${pior.r.toFixed(2)}:1 em "${pior.texto}" (${pior.cor} sobre ${pior.fundo}) · ${naoCobre}`
      : `${String(reprovados.length)} de ${String(medidos)} abaixo da régua — ${reprovados
          .slice(0, 6)
          .join(" · ")}`,
  );
  await contexto.close();
}

await navegador.close();
encerrarServidor();

console.log("%s", medidas.join("\n"));
if (falhas.length > 0) {
  console.error("%s", `\n${String(falhas.length)} medida(s) fora da régua: ${falhas.join(" | ")}`);
  process.exit(1);
}
console.log("%s", `\n${String(medidas.length)} medidas no Chromium, todas dentro da régua.`);
