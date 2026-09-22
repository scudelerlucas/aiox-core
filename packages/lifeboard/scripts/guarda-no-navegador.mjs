#!/usr/bin/env node
/*
 * Os trechos dentro de `page.evaluate(...)` rodam DENTRO do Chromium, não no
 * Node — `document`, `window` e `getComputedStyle` existem lá. A linha abaixo
 * só declara isso ao analisador; nenhuma regra é desligada.
 */
/* global document, window, getComputedStyle */
/**
 * OS-LIFEBOARD · P4 — A GUARDA QUE MEDE O PRODUTO, NO NAVEGADOR.
 *
 * COMO RODAR
 *   `node scripts/guarda-no-navegador.mjs` — só isso. A guarda SOBE O PRÓPRIO
 *   servidor a partir DESTE diretório, numa porta livre, e o derruba no fim.
 *   Falhou, sai com código 1; não conseguiu medir, sai com 2 dizendo o que
 *   falta. Nunca sai 0 fingindo ter medido.
 *
 * VARIÁVEIS
 *   LIFEBOARD_BASE_URL    endereço de um servidor JÁ NO AR. Quem passa isto
 *                         assume a responsabilidade de ele servir esta árvore.
 *   LIFEBOARD_PLAYWRIGHT  caminho do `playwright-core` (este pacote não o
 *                         declara como dependência: o CI da casa não instala
 *                         navegador, e instalar aqui era proibido pela ordem
 *                         da rodada)
 *   LIFEBOARD_CHROMIUM    `executablePath` do Chromium já instalado
 *   LIFEBOARD_GUARDA_JSON caminho para gravar a medição crua
 *   LIFEBOARD_GUARDA_LARGURAS  subconjunto das larguras ("1440x900,390x800"),
 *                         para repetir uma sabotagem em minutos. O portão
 *                         completo continua sendo a lista inteira, e a corrida
 *                         parcial se anuncia na primeira linha da saída.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * RODADA 10 — O QUE MUDOU, E POR QUÊ
 * ═════════════════════════════════════════════════════════════════════════
 *
 * **CRÍTICO — a guarda lia atributo e nunca perguntava se alguma coisa foi
 * PINTADA.** A versão da rodada 9 abria o Chromium de verdade e, para dizer
 * "a camada X está desenhada", lia `stroke`, `stroke-dasharray` e
 * `paths.length` do SVG. Nenhuma das três muda com transparência. Medido:
 * `style={{ opacity: 0 }}` no `<g>` da aresta (UMA linha em `aresta-svg.tsx`)
 * apagou as cinco camadas, o traço triplo e o ❌ — e os CINCO portões ficaram
 * verdes, esta guarda inclusive, imprimindo "todas as promessas medidas no
 * navegador se sustentam" sobre um grafo que virou 11 cartões soltos.
 *
 * Agora, **nenhuma medida de "isto está visível?" lê atributo declarado**. A
 * ferramenta é `scripts/pixel-do-grafo.mjs`: duas fotos da tela, uma com o
 * elemento e outra com ele `visibility: hidden`, e exige-se as DUAS coisas —
 * pixels na cor que o compositor deve pintar E pixels que MUDAM quando o
 * elemento sai. A geometria amostrada sai do `d` do próprio `<path>` (a
 * polilinha que o roteador calculou) convertido para tela pelo
 * `getScreenCTM()`: os pontos caem SOBRE o traço, não perto dele.
 *
 * O universo é **derivado**, não escrito à mão: os papéis de aresta vêm de
 * `TIPOS_DE_BANDA` (`src/lib/geometria-da-aresta.ts`), as camadas de
 * `CAMADAS_TODAS` e os rótulos de `CAMADA_LABEL`
 * (`src/lib/camadas-do-grafo.ts`), as cores de `ARESTA_STROKE*`
 * (`src/components/graph/aresta-svg.tsx`). Papel novo sem cor declarada
 * REPROVA ("a guarda não sabe medir"); papel com ZERO arestas na tela REPROVA
 * (medir zero nunca é sucesso).
 *
 * **ALTO 1 e ALTO 2 — a guarda media um estado só.** Um clique no aviso
 * "5 fontes desatualizadas" devolvia a faixa "Hoje" a 0 px (44 → 0 a 1024,
 * 1280 e 1440; 44 → 10 a 1920) e, com o aviso aberto, 2 px de resize
 * derrubavam o zoom do teto (1,8 → 0,849). As duas são a MESMA classe, e as
 * duas correções anteriores fecharam só o estado inicial. A régua agora varre
 * **estados derivados da própria tela**: o estado base mais um estado por
 * controle `[aria-expanded]` que a página tiver — e em cada um mede "Hoje" e
 * a sobrevivência do gesto do operador a 2 px de resize.
 *
 * **ALTO 3 — teclado e leitor de tela alcançavam 1 das 5 camadas.** A medida
 * §10 casa, linha a linha, o que o canvas DESENHA com o que a lista acessível
 * DIZ: toda aresta desenhada tem de aparecer na lista, com o rótulo da camada
 * dela e o título do outro lado, e todo item da lista tem de ser alcançável
 * por Tab.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * O QUE ELA MEDE
 * ═════════════════════════════════════════════════════════════════════════
 * | § | medida | régua |
 * |---|---|---|
 * | 1 | a faixa "Hoje" acima da dobra | ≥ 44 px no desktop |
 * | 2 | o pane real × `tests/unit/panes-medidos.json` | ± 2 px |
 * | 3 | seis cliques de zoom, e o gesto não é desfeito | monotônico, teto 1,8 |
 * | 4 | altura do nó no DOM | > 0 |
 * | 5 | 2 px de resize não apagam o gesto | Δzoom = 0 |
 * | 6 | …mas um resize DE VERDADE ainda reenquadra | Δzoom ≠ 0 |
 * | 7 | **toda aresta desenhada PINTA** (cor composta + pixel que muda) | por papel, piso derivado |
 * | 8 | **a faixa do caminho crítico é larga de PIXEL**, não 3 atributos | ≥ 2× a simples, e separada onde dá |
 * | 9 | **todo glifo (seta/círculo/losango/❌) PINTA** | pixel que muda; ❌ também na cor |
 * | 10 | **teclado e leitor alcançam toda aresta do grafo** | 0 arestas fora da lista |
 * | 11 | **§1, §5 E §7–§10/§12 em TODO estado da tela**, derivados de `[aria-expanded]` | idem |
 * | 12 | **o canvas × o DADO, nos dois sentidos** | conjuntos e contagens iguais |
 * | 13 | **desmarcar uma camada apaga as arestas dela do canvas** | previsão canvas+checkbox |
 * | 14 | **o estado em que a tela NASCE** (`CAMADAS_DEFAULT`) | nada fora do default |
 *
 * ═════════════════════════════════════════════════════════════════════════
 * RODADA 11 — A GUARDA COMPARAVA O DESENHO COM ELE MESMO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A rodada 10 curou *"a guarda lia atributo e nunca perguntava se alguma
 * coisa foi pintada"*. A 11 herdou a versão nova do mesmo vício: **a guarda
 * perguntava se alguma coisa foi pintada, e nunca se foi pintada a coisa
 * certa, no lugar certo, na cor certa, entre os nós certos.** Cinco
 * sabotagens de UMA linha cada passaram pelos cinco portões:
 *
 * • **ALTO 1** — `filter: hue-rotate(-140deg)` numa aresta de sucessão: cor
 *   declarada `rgb(95,227,154)`, cor PINTADA `rgb(255,167,161)` (o vermelho
 *   do caminho crítico), 0 de 378 pixels na cor declarada. A régua por aresta
 *   lia `getComputedStyle(path).stroke` (declaração, não pintura) e a régua
 *   por papel exigia UMA aresta certa — a outra pagava a conta. Cura: §7 mede
 *   a cor de CADA aresta pelo modelo de mistura (`residuoDeMistura`), que
 *   resolve antialias e oclusão sem abrir a porta para outra cor.
 * • **ALTO 2** — uma aresta do caminho crítico sumiu do canvas e a saída
 *   imprimiu `critico=1/1` chamando de sucesso. §10 só perguntava um sentido
 *   e §7 tinha piso de 1 por papel. Cura: §12, o canvas × o dado publicado
 *   pelo produto (`data-lb-contrato-do-canvas`), nos dois sentidos e por
 *   contagem — nunca por piso.
 * • **ALTO 3** — `camadasAtivas` fixo nas cinco. `ligarTodasAsCamadas`
 *   aparecia 3× e NADA desligava; o default nunca era observado. Cura: §13 e
 *   §14.
 * • **ALTO 4** — um hex escuro em `aresta-svg.tsx` levou a sucessão a 1,27:1
 *   contra o canvas. A guarda derivava a cor do MESMO arquivo que a decide
 *   (o arquivo concordando consigo mesmo) e havia duas tabelas de hex sem
 *   teste entre elas. Cura: `derivarContrato` exige as duas tabelas iguais,
 *   `scripts/checar-contraste.mjs` mede o hex que o grafo pinta e
 *   `tests/unit/cor-da-aresta-uma-fonte-so.test.ts` costura as duas.
 * • **MÉDIO 5** — o traço desenhado entre o par ERRADO de cartões. Cura:
 *   `conferirExtremos`, as duas pontas do `d` contra a caixa dos cartões que
 *   `data-origem`/`data-destino` nomeiam.
 */

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  AJUDANTES_NA_PAGINA,
  amostraNoPonto,
  bandasDoPerfil,
  fotosComESem,
  janelaDosPontos,
  perfilPerpendicular,
  TOLERANCIA_DE_MISTURA,
} from "./pixel-do-grafo.mjs";

/** A raiz deste pacote — `scripts/` sobe um nível. */
const RAIZ_DO_PACOTE = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Resolvido antes de abrir o navegador: ou o endereço que o operador passou,
 * ou o do servidor que esta guarda mesma sobe (ver `subirServidorProprio`).
 */
let BASE = process.env.LIFEBOARD_BASE_URL ?? null;
const CHROMIUM = process.env.LIFEBOARD_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/** O teaser da faixa "Fontes + Hoje" — o mesmo número de `altura-do-canvas.ts`. */
const TEASER_DA_FAIXA_DE_BAIXO_PX = 44;
/** Teto de zoom do canvas — o mesmo de `dependency-graph.tsx`. */
const ZOOM_MAXIMO_DO_CANVAS = 1.8;

const TODAS_AS_LARGURAS = [
  { largura: 1024, altura: 800, desktop: true },
  { largura: 1280, altura: 800, desktop: true },
  { largura: 1440, altura: 900, desktop: true },
  { largura: 1920, altura: 1080, desktop: true },
  { largura: 390, altura: 800, desktop: false },
];

/**
 * `LIFEBOARD_GUARDA_LARGURAS="1440x900,390x800"` roda um SUBCONJUNTO — existe
 * para a rodada de correção poder repetir uma sabotagem em minutos em vez de
 * dez. O default é a lista inteira, e uma largura pedida que não está na
 * tabela derruba a guarda com código 2: nunca um recorte silencioso.
 */
const LARGURAS = (() => {
  const pedido = process.env.LIFEBOARD_GUARDA_LARGURAS;
  if (!pedido) return TODAS_AS_LARGURAS;
  const chaves = pedido.split(",").map((c) => c.trim()).filter(Boolean);
  const escolhidas = chaves.map((chave) => {
    const achado = TODAS_AS_LARGURAS.find((c) => `${c.largura}x${c.altura}` === chave);
    if (!achado) {
      console.error(
        `guarda-no-navegador: "${chave}" não está na tabela de larguras (${TODAS_AS_LARGURAS.map((c) => `${c.largura}x${c.altura}`).join(", ")})`,
      );
      process.exit(2);
    }
    return achado;
  });
  console.log(`ATENÇÃO: corrida parcial, só ${chaves.join(", ")} — o portão completo são as ${String(TODAS_AS_LARGURAS.length)} larguras.`);
  return escolhidas;
})();

function lerFonte(relativo) {
  return readFileSync(join(RAIZ_DO_PACOTE, relativo), "utf8");
}

/**
 * ── O CONTRATO, DERIVADO DO CÓDIGO QUE DESENHA ────────────────────────────
 *
 * Três listas escritas à mão aqui seriam três listas livres para apodrecer —
 * e "universo por convenção" é um dos cinco vícios que esta esteira já
 * catalogou. Os papéis, as camadas, os rótulos e as cores saem dos módulos
 * que o produto usa para pintar. Se algum deles sumir ou mudar de forma, esta
 * função lança e a guarda sai com código 2: nunca 0 por não ter conseguido
 * ler o contrato.
 */
function derivarContrato() {
  const geometria = lerFonte("src/lib/geometria-da-aresta.ts");
  const blocoDePapeis = /export const TIPOS_DE_BANDA = \[([\s\S]*?)\] as const;/.exec(geometria);
  if (!blocoDePapeis) throw new Error("não achei TIPOS_DE_BANDA em src/lib/geometria-da-aresta.ts");
  const papeis = [...blocoDePapeis[1].matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]);

  const camadasSrc = lerFonte("src/lib/camadas-do-grafo.ts");
  const blocoDeCamadas = /export const CAMADAS_TODAS[^=]*=\s*\[([\s\S]*?)\];/.exec(camadasSrc);
  if (!blocoDeCamadas) throw new Error("não achei CAMADAS_TODAS em src/lib/camadas-do-grafo.ts");
  const camadas = [...blocoDeCamadas[1].matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]);
  const blocoDoDefault = /export const CAMADAS_DEFAULT[^=]*=\s*\[([\s\S]*?)\];/.exec(camadasSrc);
  if (!blocoDoDefault) throw new Error("não achei CAMADAS_DEFAULT em src/lib/camadas-do-grafo.ts");
  const camadasDefault = [...blocoDoDefault[1].matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]);
  const blocoDeRotulos = /export const CAMADA_LABEL[^=]*=\s*\{([\s\S]*?)\n\};/.exec(camadasSrc);
  if (!blocoDeRotulos) throw new Error("não achei CAMADA_LABEL em src/lib/camadas-do-grafo.ts");
  const rotulos = {};
  for (const m of blocoDeRotulos[1].matchAll(/(\w+):\s*"([^"]+)"/g)) rotulos[m[1]] = m[2];

  const arestaSrc = lerFonte("src/components/graph/aresta-svg.tsx");
  const blocoDeCores = /export const ARESTA_STROKE:[\s\S]*?=\s*\{([\s\S]*?)\n\};/.exec(arestaSrc);
  if (!blocoDeCores) throw new Error("não achei ARESTA_STROKE em src/components/graph/aresta-svg.tsx");
  const cores = {};
  for (const m of blocoDeCores[1].matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{6})"/g)) cores[m[1]] = m[2];
  const critico = /ARESTA_STROKE_CRITICO\s*=\s*"(#[0-9A-Fa-f]{6})"/.exec(arestaSrc);
  const destacada = /ARESTA_STROKE_DESTACADA\s*=\s*"(#[0-9A-Fa-f]{6})"/.exec(arestaSrc);
  if (!critico || !destacada) throw new Error("não achei ARESTA_STROKE_CRITICO/DESTACADA");
  cores.critico = critico[1];
  cores.destacada = destacada[1];

  /*
   * ── A GUARDA NÃO PODE CONTAR A SI MESMA (achado ALTO 4 da rodada 11) ────
   *
   * Até a rodada 10 a tabela de cores saía SÓ de `aresta-svg.tsx` — o mesmo
   * arquivo que decide a cor. "Declarada == contrato" era o arquivo
   * concordando consigo mesmo, e trocar um hex ali levou a sucessão a 1,27:1
   * contra o canvas com os cinco portões verdes.
   *
   * O contrato passa a exigir as DUAS tabelas: o hex de `aresta-svg.tsx` (o
   * que o grafo pinta) e o token `aresta.*` de `tailwind.config.ts` (o que o
   * tema da casa declara, e o que `scripts/checar-contraste.mjs` mede).
   * Divergir é sair com código 2 — nunca 0 por concordância consigo mesmo.
   */
  const temaSrc = lerFonte("tailwind.config.ts");
  const blocoDoTema = /aresta: \{([\s\S]*?)\n {8}\},/.exec(temaSrc);
  if (!blocoDoTema) throw new Error("não achei o grupo de tokens `aresta` em tailwind.config.ts");
  const tokens = {};
  for (const m of blocoDoTema[1].matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{6})"/g)) tokens[m[1]] = m[2];
  const TOKEN_DO_PAPEL = {
    sucessao: "sucessao",
    correlacao: "correlacao",
    sinergia: "sinergia",
    obsolescencia: "obsolescenciaHue",
    critico: "critico",
    destacada: "predecessor",
  };
  const divergentes = [];
  for (const papel of papeis) {
    const token = TOKEN_DO_PAPEL[papel];
    if (!token) {
      divergentes.push(`papel "${papel}" não tem token declarado nesta guarda`);
      continue;
    }
    if (!tokens[token]) {
      divergentes.push(`token aresta.${token} (papel "${papel}") não existe em tailwind.config.ts`);
      continue;
    }
    if (cores[papel] && tokens[token].toUpperCase() !== cores[papel].toUpperCase()) {
      divergentes.push(
        `papel "${papel}": aresta-svg.tsx pinta ${cores[papel]} e o token aresta.${token} diz ${tokens[token]}`,
      );
    }
  }
  if (divergentes.length > 0) {
    throw new Error(
      `as duas tabelas de cor da aresta divergem (uma cor, uma fonte): ${divergentes.join(" ; ")}`,
    );
  }

  /*
   * ── O PISO DE VISIBILIDADE VEM DE FORA (achado da rodada 12) ───────────
   *
   * A rodada 11 levou um ALTO por "a guarda conta a si mesma" (a cor saía do
   * mesmo arquivo que a decide). O piso do OUTRO eixo — o α, "dá para ver?" —
   * não pode repetir o vício: ele é lido de `scripts/checar-contraste.mjs`,
   * a régua de contraste da casa, que é quem diz 3:1 para estas arestas.
   * Sumir a constante de lá derruba esta guarda com código 2; mexer no número
   * lá muda os dois portões no mesmo ato, que é o certo.
   */
  const contrasteSrc = lerFonte("scripts/checar-contraste.mjs");
  const pisoNaRegua = /export const PISO_DE_CONTRASTE_DA_ARESTA\s*=\s*([\d.]+)\s*;/.exec(contrasteSrc);
  if (!pisoNaRegua) {
    throw new Error(
      "não achei PISO_DE_CONTRASTE_DA_ARESTA em scripts/checar-contraste.mjs — o piso de visibilidade do traço não pode ser escrito dentro desta guarda (a guarda contaria a si mesma)",
    );
  }
  const pisoDeContraste = Number(pisoNaRegua[1]);
  if (!Number.isFinite(pisoDeContraste) || pisoDeContraste < 1) {
    throw new Error(`PISO_DE_CONTRASTE_DA_ARESTA ilegível em checar-contraste.mjs: "${pisoNaRegua[1]}"`);
  }
  /* E a régua tem de estar de fato COBRANDO esse piso nas arestas: se o par
     `grafo-<papel>` deixar de existir lá, o número aqui vira decoração. */
  if (!/PARES\.push\(\[\s*`grafo-\$\{papel\}`,\s*"navy-950",\s*PISO_DE_CONTRASTE_DA_ARESTA,/.test(contrasteSrc)) {
    throw new Error(
      "checar-contraste.mjs não cobra mais PISO_DE_CONTRASTE_DA_ARESTA no par `grafo-<papel>` sobre navy-950 — o piso desta guarda ficaria sem lastro",
    );
  }

  const semCor = papeis.filter((p) => !cores[p]);
  if (semCor.length > 0) {
    throw new Error(
      `papel de aresta sem cor declarada — a guarda não sabe medir: ${semCor.join(", ")}. Declare a cor em aresta-svg.tsx e diga aqui como o papel chega à tela.`,
    );
  }
  const camadasSemRotulo = camadas.filter((c) => !rotulos[c]);
  if (camadasSemRotulo.length > 0) {
    throw new Error(`camada sem rótulo em CAMADA_LABEL: ${camadasSemRotulo.join(", ")}`);
  }
  return { papeis, camadas, camadasDefault, rotulos, cores, pisoDeContraste };
}

let CONTRATO;
try {
  CONTRATO = derivarContrato();
} catch (e) {
  console.error(`guarda-no-navegador: ${String(e.message ?? e)}`);
  process.exit(2);
}

/**
 * A tabela de panes que `tests/unit/panes-medidos.ts` usa. Lida daqui para que
 * ela não possa apodrecer: se o DOM vivo divergir, esta guarda reprova.
 */
const TABELA_DE_PANES = JSON.parse(lerFonte("tests/unit/panes-medidos.json"));

const falhas = [];
const medicoes = {};
function exigir(condicao, mensagem) {
  if (!condicao) falhas.push(mensagem);
}

function carregarPlaywright() {
  const req = createRequire(import.meta.url);
  const candidatos = [process.env.LIFEBOARD_PLAYWRIGHT, "playwright-core", "playwright"].filter(Boolean);
  for (const c of candidatos) {
    try {
      return req(c);
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

/** Abre o painel "Camadas" e marca as cinco caixas. */
async function ligarTodasAsCamadas(page) {
  const pill = page.locator('button[aria-label="Camadas"]').first();
  if ((await pill.count()) === 0) return;
  if ((await pill.getAttribute("aria-expanded")) !== "true") await pill.click();
  await page.waitForSelector('[role="dialog"][aria-label="Camadas do grafo"]', { timeout: 10000 });
  const caixas = page.locator('[role="dialog"][aria-label="Camadas do grafo"] input[type="checkbox"]');
  const n = await caixas.count();
  for (let i = 0; i < n; i++) {
    const caixa = caixas.nth(i);
    if (!(await caixa.isChecked())) await caixa.check();
  }
  // No celular a folha tem backdrop e o pill fica atrás dele: fecha pelo
  // botão "Fechar" da própria folha, ou pelo Esc.
  const fechar = page.locator('[role="dialog"][aria-label="Camadas do grafo"] button[aria-label="Fechar"]');
  if (await fechar.count()) await fechar.first().click();
  else await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

function escalaDe(transform) {
  const m = /matrix\(([-0-9.e]+)/.exec(transform ?? "");
  return m ? Number(m[1]) : null;
}

/** Abre a página já com os ajudantes de pixel instalados, no painel do grafo. */
async function abrirPagina(browser, caso) {
  const ctx = await browser.newContext({ viewport: { width: caso.largura, height: caso.altura } });
  await ctx.addInitScript({ content: AJUDANTES_NA_PAGINA });
  const page = await ctx.newPage();
  const errosDePagina = [];
  page.on("pageerror", (e) => errosDePagina.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  /*
   * No celular o grafo vive numa aba, e a aba só responde depois da
   * hidratação. Clicar uma vez e esperar 30s pelo canvas transformava uma
   * hidratação lenta num TimeoutError com rastro de pilha — que reprova, sim,
   * mas sem dizer nada. Tenta de novo, e só então desiste com a mensagem.
   */
  const abaGrafo = page.locator('nav[aria-label="Painéis"] button', { hasText: "Grafo" });
  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    if (!caso.desktop && (await abaGrafo.count()) > 0) {
      await abaGrafo.first().click().catch(() => undefined);
    }
    try {
      await page.waitForSelector(".react-flow__viewport", { timeout: 15000 });
      /*
       * O selo do Next em modo dev (`<nextjs-portal>`) fica no canto de baixo
       * e, a 390 px, cobre a ÚLTIMA caixa da folha "Camadas" — o clique do
       * operador não chega lá. Ele não é produto: a guarda sobe `next dev`
       * porque é o que ela tem, não porque o operador usa dev. Some com ele
       * pelo CSS, e os erros de página continuam sendo colhidos pelo
       * `pageerror` acima (nada é silenciado, só um selo de ferramenta sai da
       * frente).
       */
      await page
        .addStyleTag({ content: "nextjs-portal { display: none !important; }" })
        .catch(() => undefined);
      await page.waitForTimeout(1200);
      return { ctx, page, errosDePagina };
    } catch {
      await page.waitForTimeout(1000);
    }
  }
  exigir(false, `${caso.largura}x${caso.altura}: o canvas do grafo não apareceu na tela em 4 tentativas`);
  await page.waitForTimeout(500);
  return { ctx, page, errosDePagina, semCanvas: true };
}

/** Quanto da faixa "Hoje" está dentro da janela de visão, em px. */
async function medirHoje(page, alturaDaJanela) {
  return page.evaluate((vh) => {
    const sec = document.querySelector('section[aria-label="Prioridades de hoje"]');
    if (!sec) return { existe: false, visivel: 0 };
    const r = sec.getBoundingClientRect();
    return {
      existe: true,
      topo: Math.round(r.top),
      altura: Math.round(r.height),
      visivel: Math.round(Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))),
    };
  }, alturaDaJanela);
}

const transformDoCanvas = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".react-flow__viewport");
    return el ? getComputedStyle(el).transform : null;
  });

/**
 * O gesto do operador: seis cliques em "Aumentar zoom". Devolve a trilha
 * inteira — nenhum passo pode DESCER, e o fim tem de ser o teto.
 */
async function gestoDeZoom(page) {
  const botao = page.locator('button[aria-label="Aumentar zoom"]').first();
  if ((await botao.count()) === 0) return { trilha: [], achouBotao: false, alcancavel: false, fim: null };
  const trilha = [escalaDe(await transformDoCanvas(page))];
  for (let i = 0; i < 6; i++) {
    try {
      await botao.click({ timeout: 4000 });
    } catch {
      /*
       * A folha modal do celular cobre o canvas inteiro — ali o operador
       * REALMENTE não alcança o zoom, e isso não é defeito. Devolve-se
       * `alcancavel: false` e quem chama decide: a §11 só aceita isso se a
       * tela de fato tiver um `[role="dialog"][aria-modal="true"]` aberto
       * (exceção com conferência própria, nunca um `continue` mudo).
       */
      return { trilha, achouBotao: true, alcancavel: false, fim: null };
    }
    await page.waitForTimeout(150);
    trilha.push(escalaDe(await transformDoCanvas(page)));
  }
  await page.waitForTimeout(1500);
  const fim = escalaDe(await transformDoCanvas(page));
  trilha.push(fim);
  return { trilha, achouBotao: true, alcancavel: true, fim };
}

/**
 * 2 px de ruído de tamanho não podem apagar o gesto. A largura de ruído nunca
 * atravessa o corte de 1024: atravessar troca o layout inteiro, e aí
 * reenquadrar é o certo — não é isto que se mede aqui.
 */
function larguraDeRuidoPara(caso) {
  return caso.largura - 2 >= 1024 || !caso.desktop ? caso.largura - 2 : caso.largura + 2;
}

// ═══════════════════════════════════════════════════════════════════════════
// §7 · TODA ARESTA DESENHADA PINTA DE VERDADE  (achado CRÍTICO)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * `papel` é o que decide a COR do traço em `corDaAresta` (`aresta-svg.tsx`):
 * destaque vence crítico, que vence a camada base. A classificação aqui
 * espelha aquela função — e a cor computada de cada traço é conferida contra
 * a tabela hex derivada, então divergir das duas é reprovar.
 */
const LEITURA_DAS_ARESTAS = `(() => {
  const saida = [];
  for (const g of document.querySelectorAll(".react-flow g[data-camada]")) {
    const path = g.querySelector("path.lb-edge-path");
    if (!path) { saida.push({ id: g.getAttribute("data-aresta-id"), semPath: true }); continue; }
    const papel = g.classList.contains("lb-edge-destacada")
      ? "destacada"
      : g.getAttribute("data-critica") === "true" ? "critico" : g.getAttribute("data-camada");
    saida.push({
      id: g.getAttribute("data-aresta-id"),
      camada: g.getAttribute("data-camada"),
      origem: g.getAttribute("data-origem"),
      destino: g.getAttribute("data-destino"),
      critica: g.getAttribute("data-critica") === "true",
      papel: papel,
      corComputada: getComputedStyle(path).stroke,
      corEsperada: window.__lbp4.corEsperada(path, "stroke"),
      retrato: window.__lbp4.retrato(g),
      pontos: window.__lbp4.pontosDaAresta(path, 20),
      extremos: window.__lbp4.extremosDaAresta(path),
      caixaDoRotulo: (() => {
        const t = g.querySelector(".lb-edge-label");
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return { x: r.x, y: r.y, largura: r.width, altura: r.height };
      })(),
      nTracos: g.querySelectorAll("path.lb-edge-path").length,
      tracejado: path.getAttribute("stroke-dasharray") || "",
    });
  }
  return { arestas: saida, cartoes: window.__lbp4.caixasDosCartoes() };
})()`;

// ═══════════════════════════════════════════════════════════════════════════
// MÉDIO 5 · O TRAÇO LIGA OS DOIS CARTÕES QUE ELE DIZ LIGAR
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Nenhuma seção comparava os EXTREMOS do traço com os cartões que
 * `data-origem`/`data-destino` nomeiam. O crítico trocou o destino de uma
 * aresta no roteador (uma linha) e o ❌ da obsolescência foi pintado em cima
 * de "Daily standup" enquanto o atributo, a lista acessível e o dado diziam
 * "Arquivar docs antigos" — verde a 1024, 1280, 1440 e 1920.
 *
 * A régua: a distância do extremo até a CAIXA do cartão nomeado, em px de
 * tela. Zero quando o ponto está dentro ou encostado; cresce com o desvio. E,
 * além da distância, o cartão nomeado tem de ser o MAIS PERTO de todos — um
 * traço que termina em cima do cartão errado erra as duas coisas.
 *
 * O teto é folgado de propósito (o roteador recua a ponta para o glifo caber,
 * e a tripla do crítico desloca o path lateralmente): medido na árvore
 * honesta, o pior extremo ficou a 7 px do cartão nomeado nas cinco larguras.
 */
const FOLGA_DO_EXTREMO_PX = 40;

function distanciaAteACaixa(ponto, caixa) {
  const dx = Math.max(caixa.x - ponto.x, 0, ponto.x - (caixa.x + caixa.largura));
  const dy = Math.max(caixa.y - ponto.y, 0, ponto.y - (caixa.y + caixa.altura));
  return Math.hypot(dx, dy);
}

/** Problemas de "este traço liga os cartões que ele nomeia?" — lista vazia = tudo certo. */
function conferirExtremos(a, cartoes) {
  const problemas = [];
  if (!a.extremos) {
    problemas.push(`${a.id}: não consegui ler os extremos do "d" do traço — medida impossível é reprovação`);
    return problemas;
  }
  for (const [ponta, ponto, id] of [
    ["origem", a.extremos.inicio, a.origem],
    ["destino", a.extremos.fim, a.destino],
  ]) {
    const caixa = cartoes[id];
    if (!caixa) {
      problemas.push(`${a.id}: a ${ponta} "${String(id)}" não tem cartão no canvas`);
      continue;
    }
    const daNomeada = distanciaAteACaixa(ponto, caixa);
    let maisPerto = id;
    let menor = daNomeada;
    for (const [outro, c] of Object.entries(cartoes)) {
      const d = distanciaAteACaixa(ponto, c);
      if (d < menor - 1) {
        menor = d;
        maisPerto = outro;
      }
    }
    if (daNomeada > FOLGA_DO_EXTREMO_PX) {
      problemas.push(
        `${a.id}: a ponta de ${ponta} do traço está a ${daNomeada.toFixed(1)}px do cartão "${String(id)}" que o atributo nomeia (teto ${String(FOLGA_DO_EXTREMO_PX)}px) — o traço é desenhado entre outro par de cartões`,
      );
    } else if (maisPerto !== id) {
      problemas.push(
        `${a.id}: a ponta de ${ponta} está a ${daNomeada.toFixed(1)}px do cartão nomeado "${String(id)}" e a ${menor.toFixed(1)}px de "${maisPerto}" — o traço encosta no cartão errado`,
      );
    }
  }
  return problemas;
}

/**
 * ── O SELETOR DA ARESTA É ANCORADO NO CANVAS (achado desta rodada, saído do
 *    próprio BAIXO 6) ────────────────────────────────────────────────────
 *
 * `g[data-camada]` solto pega TAMBÉM as amostras da legenda: `AmostraDeAresta`
 * desenha o mesmo `ArestaSvgGroup` de produção ao lado de cada checkbox do
 * painel "Camadas" e na tira da "Legenda" — com `data-camada`, `data-critica`
 * e `data-aresta-id="amostra-…"`. Enquanto §7–§10 só rodavam na tela fechada,
 * ninguém notava; ao medi-las com os popovers ABERTOS (BAIXO 6), a guarda
 * passou a contar 10 e 12 arestas onde o dado tem 7, e a reprovar as amostras
 * por não estarem na lista acessível — que é o certo para uma aresta e
 * absurdo para uma legenda.
 *
 * A aresta do grafo é a que vive DENTRO do canvas. As amostras da legenda são
 * conferidas por onde elas de fato são o produto: o teste de render
 * (`tests/unit/aresta-svg-render.test.tsx`).
 */
const SELETOR_DA_ARESTA = ".react-flow g[data-camada]";

const RAIO_DA_AMOSTRA = 4;
const RAIO_DO_PERFIL = 14;

/**
 * Quantos pixels do traço precisam chegar ao piso de contraste para a aresta
 * contar como VISÍVEL (rodada 12).
 *
 * Um só bastaria para o lado lógico — mas um pixel isolado pode ser ruído de
 * compressão ou a franja de subpixel do rótulo. Quatro é o mesmo número que
 * `PISO_DE_PIXEIS_NA_COR` já usa para a cor cheia, pela mesma razão, e foi
 * medido contra os dois lados nesta rodada (números na saída `visív` de §7):
 * a árvore honesta fica ordens de grandeza acima nas cinco larguras, e a
 * sabotagem de `opacity: 0.12` fica em ZERO.
 *
 * O PISO DE CONTRASTE não está aqui de propósito: ele é lido de
 * `scripts/checar-contraste.mjs` (`CONTRATO.pisoDeContraste`). Este número é
 * "quantos pixels", não "quão visível" — e "quão visível" é a régua da casa,
 * não uma constante desta guarda.
 */
const PISO_DE_PIXEIS_VISIVEIS = 4;

/**
 * O GLIFO de fim passa pelo caminho rápido — os mesmos 3:1 do traço — quando
 * ele tem pixels de sobra no piso. A seta da sucessão e o ❌ da obsolescência
 * passam por aqui folgados (medido nesta rodada: dezenas de pixels acima do
 * piso). O círculo da correlação não passa, e o motivo é oclusão, não
 * opacidade: ver o bloco em §9.
 */
const PISO_DE_PIXEIS_VISIVEIS_DO_GLIFO = 4;

/**
 * O caminho lento do glifo ocluído: o α DE PICO dele contra o α de pico do
 * TRAÇO DA MESMA ARESTA, medido na mesma tela. Os dois saem do mesmo
 * componente, com a mesma cor e a mesma cadeia de `opacity`.
 *
 * Medido nesta rodada, a 1440×900: círculo da correlação α 0,70 contra traço
 * α 1,00 — razão 0,70. Com `fill-opacity: 0.12` no glifo, a razão vai a ~0,08.
 * 0,35 fica no meio, 2× abaixo do honesto e 4× acima da sabotagem.
 */
const FRACAO_MINIMA_DO_ALFA_DO_TRACO = 0.35;

/** `#RRGGBB` → `rgb(r, g, b)`, para comparar com o que o motor devolve. */
function hexEmRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${String((n >> 16) & 255)}, ${String((n >> 8) & 255)}, ${String(n & 255)})`;
}

/**
 * `papeisExigidos` é o piso do universo NESTE estado da tela. O papel
 * "destacada" (o amarelo do predecessor) só existe com um nó selecionado —
 * então ele sai do piso do estado sem seleção e VOLTA, obrigatório, no estado
 * com seleção (§7b). É exceção declarada com conferência própria, nunca um
 * papel que some da conta e ninguém nota.
 */
async function medirPinturaDasArestas(page, chave, estado, papeisExigidos = CONTRATO.papeis, papeisComProvaDeCor = CONTRATO.papeis) {
  const leitura = await page.evaluate(LEITURA_DAS_ARESTAS);
  const arestas = leitura.arestas;
  const cartoes = leitura.cartoes ?? {};
  const grupos = await page.$$(SELETOR_DA_ARESTA);
  const resumo = {};
  const problemas = [];
  const detalhePorAresta = [];
  const bandasPorCritica = [];
  /*
   * O α DE PICO de cada traço, para §9 usar como REFERÊNCIA MEDIDA NA MESMA
   * TELA (é o mesmo recurso que §8 já usa para o traço triplo: comparar com
   * uma aresta simples medida ali, em vez de com uma constante escrita aqui).
   */
  const alfaPicoPorAresta = new Map();

  for (let i = 0; i < arestas.length; i += 1) {
    const a = arestas[i];
    const g = grupos[i];
    if (a.semPath || !g) {
      problemas.push(`${a.id}: o grupo da aresta não tem nenhum <path.lb-edge-path>`);
      continue;
    }
    resumo[a.papel] = resumo[a.papel] ?? { n: 0, pintam: 0 };
    resumo[a.papel].n += 1;

    // A cor DECLARADA tem de ser a do contrato — o pixel confere o resto.
    const esperadaNoContrato = hexEmRgb(CONTRATO.cores[a.papel] ?? "#000000");
    if (a.corComputada.replace(/\s/g, "") !== esperadaNoContrato.replace(/\s/g, "")) {
      problemas.push(
        `${a.id}: papel "${a.papel}" foi declarado em ${a.corComputada}, e o contrato (${CONTRATO.cores[a.papel]}) é ${esperadaNoContrato}`,
      );
    }

    // MÉDIO 5: o traço começa e termina nos cartões que o próprio grupo nomeia.
    problemas.push(...conferirExtremos(a, cartoes));

    if (!Array.isArray(a.pontos) || a.pontos.length === 0) {
      problemas.push(
        `${a.id}: não consegui derivar nenhum ponto sobre o traço a partir do "d" do path — medida impossível é reprovação, não dispensa`,
      );
      continue;
    }
    const janela = janelaDosPontos(a.pontos, RAIO_DO_PERFIL + 3, page.viewportSize());
    if (janela === null) {
      problemas.push(
        `${a.id}: o traço inteiro ficou fora da janela de visão — não consegui medir, e isso é reprovação`,
      );
      continue;
    }
    const fotos = await fotosComESem(page, g, janela);
    if (fotos.erro) {
      problemas.push(`${a.id}: ${fotos.erro}`);
      continue;
    }
    let medidos = 0;
    let pintam = 0;
    let naCor = 0;
    let mudaram = 0;
    let peso = 0;
    let pesoVezesResiduo = 0;
    let piorResiduoForte = 0;
    let melhorContraste = 1;
    let pixeisVisiveis = 0;
    let alfaPicoDoTraco = 0;
    const bandas = {};
    let melhorPerfil = "";
    let maiorExtensao = -1;
    /*
     * A cor do CONTRATO (as duas tabelas de hex já casadas em
     * `derivarContrato`), crua — não a composta. O modelo de mistura
     * (`residuoDeMistura`) já resolve opacidade e fundo: o que o compositor
     * pinta é sempre `α·contrato + (1−α)·fundo real daquele pixel`.
     */
    const corDoContrato = hexEmRgb(CONTRATO.cores[a.papel] ?? "#000000");
    /*
     * A COR DO TRAÇO SE MEDE NO TRAÇO, LONGE DO TEXTO.
     *
     * Só a sinergia carrega um `<text>` dentro do grupo (o "%" do peso), e o
     * Chromium pinta texto com antialias de subpixel: as franjas de cor caem
     * FORA da reta fundo→cor, por construção. Medido na árvore honesta: essa
     * aresta — e só ela — ia a 8,6 de resíduo médio no desktop e a 20,1 a
     * 390 px, contra 0,2–0,7 de todas as outras. Não é a aresta pintando
     * errado; é o texto não ser um traço.
     *
     * Então os pontos cuja janelinha encosta na caixa do rótulo não votam na
     * COR (continuam contando em "pixels que mudam" e "pixels na cor"). Se
     * NENHUM ponto sobrar fora do rótulo, isso é reprovação logo abaixo — não
     * dispensa.
     */
    const caixa = a.caixaDoRotulo;
    for (const ponto of a.pontos) {
      const amostra = amostraNoPonto(
        fotos,
        ponto,
        a.corEsperada,
        RAIO_DA_AMOSTRA,
        corDoContrato,
        CONTRATO.pisoDeContraste,
      );
      if (!amostra.dentro) continue;
      medidos += 1;
      naCor += amostra.naCor;
      mudaram += amostra.mudaram;
      const encostaNoRotulo =
        caixa !== null &&
        caixa !== undefined &&
        ponto.x >= caixa.x - RAIO_DA_AMOSTRA &&
        ponto.x <= caixa.x + caixa.largura + RAIO_DA_AMOSTRA &&
        ponto.y >= caixa.y - RAIO_DA_AMOSTRA &&
        ponto.y <= caixa.y + caixa.altura + RAIO_DA_AMOSTRA;
      if (!encostaNoRotulo) {
        peso += amostra.peso;
        pesoVezesResiduo += amostra.pesoVezesResiduo;
        if (amostra.piorResiduoForte > piorResiduoForte) piorResiduoForte = amostra.piorResiduoForte;
        /*
         * A VISIBILIDADE (rodada 12) também sai SÓ do traço, fora da caixa do
         * rótulo — e aqui não é por causa do antialias de subpixel, é por
         * causa de uma porta: `stroke-opacity` apaga o TRAÇO e deixa o `<text>`
         * do "%" (que é `fill`) aceso. Contar os pixels do rótulo deixaria a
         * sinergia provar visibilidade com o texto dela. Nenhum ponto fora do
         * rótulo = `melhorContraste` fica em 1:1 = reprovação, que é o certo.
         */
        if (amostra.melhorContraste > melhorContraste) melhorContraste = amostra.melhorContraste;
        pixeisVisiveis += amostra.pixeisVisiveis;
        if (amostra.alfaPico > alfaPicoDoTraco) alfaPicoDoTraco = amostra.alfaPico;
      }
      if (amostra.naCor >= 1 && amostra.mudaram >= 2) pintam += 1;
      const perfil = perfilPerpendicular(fotos, ponto, { x: ponto.nx, y: ponto.ny }, RAIO_DO_PERFIL);
      const b = bandasDoPerfil(perfil);
      bandas[b.bandas] = (bandas[b.bandas] ?? 0) + 1;
      if (b.extensao > maiorExtensao) {
        maiorExtensao = b.extensao;
        melhorPerfil = perfil;
      }
    }
    if (medidos === 0) {
      problemas.push(
        `${a.id}: nenhum dos ${String(a.pontos.length)} pontos do traço caiu dentro da foto — não consegui medir, e isso é reprovação`,
      );
      continue;
    }
    const alfaOk = a.retrato.visivelHerdado && a.retrato.opacidadeAcumulada > 0;
    /*
     * DUAS RÉGUAS, E ELAS SÃO DIFERENTES DE PROPÓSITO (calibrado a 390 px):
     *
     * • POR ARESTA, exige-se PIXEL QUE MUDA — a única coisa que vale para toda
     *   aresta em toda largura. A 390 px o canvas tem 390×552 e onze cartões de
     *   150 px de tela: várias arestas correm quase inteiras ATRÁS de um
     *   cartão, e a parte que sobra é antialias puro. Medido: uma aresta de
     *   sucessão com 99 pixels que mudam ao esconder e ZERO pixels na cor
     *   cheia. Exigir cor ali reprovaria a oclusão, não o produto.
     * • POR PAPEL, exige-se que ao menos UMA aresta daquele papel também passe
     *   na COR — é o que impede "pinta qualquer coisa" de passar. Ver a
     *   conferência de `semCor`, abaixo.
     *
     * `opacity: 0`, `filter: opacity(0)` e a camada apagada caem na régua por
     * aresta: sem pixel que muda, nada passa.
     */
    const PISO_DE_PIXEIS_QUE_MUDAM = 12;
    const PISO_DE_PIXEIS_NA_COR = 4;
    const pintaDeVerdade = alfaOk && mudaram >= PISO_DE_PIXEIS_QUE_MUDAM;
    const pintaNaCor = pintaDeVerdade && naCor >= PISO_DE_PIXEIS_NA_COR;
    if (pintaDeVerdade) resumo[a.papel].pintam += 1;
    if (pintaNaCor) resumo[a.papel].naCor = (resumo[a.papel].naCor ?? 0) + 1;
    if (!pintaDeVerdade) {
      problemas.push(
        `${a.id} (papel "${a.papel}"): ${
          alfaOk ? "" : `alfa real 0 (opacidade acumulada ${a.retrato.opacidadeAcumulada.toFixed(3)}, visível herdado ${String(a.retrato.visivelHerdado)}) · `
        }${String(mudaram)} pixels mudam ao esconder (piso ${String(PISO_DE_PIXEIS_QUE_MUDAM)}), ${String(naCor)} pixels na cor ${a.corEsperada}, ${String(pintam)}/${String(medidos)} pontos do traço com as duas coisas`,
      );
    }
    /*
     * ── ALTO 1: A COR PINTADA DESTA ARESTA, NÃO A DECLARADA, NÃO A DO PAPEL
     *
     * `getComputedStyle(path).stroke` é DECLARAÇÃO; um `filter` mente na
     * PINTURA. E exigir a cor cheia uma vez por PAPEL deixa a segunda aresta
     * do papel mentir de graça — foi exatamente o buraco: uma aresta de
     * sucessão pintada de vermelho lia-se como caminho crítico, com
     * `sucessao=2/2` impresso na saída.
     *
     * Agora CADA aresta responde pela própria cor, e responde pelo modelo de
     * mistura: todo pixel que ela pinta tem de cair na reta "fundo real
     * daquele pixel → cor do contrato". Antialias e oclusão só mexem em α (a
     * posição na reta); trocar a cor tira o pixel da reta. O voto de cada
     * pixel é proporcional ao quanto ele mudou, então a ponta de antialias não
     * decide nada e o traço cheio decide tudo.
     */
    const residuoMedio = peso > 0 ? pesoVezesResiduo / peso : null;
    const corConfere = residuoMedio !== null && residuoMedio <= TOLERANCIA_DE_MISTURA;
    if (pintaDeVerdade && !corConfere) {
      problemas.push(
        `${a.id} (papel "${a.papel}"): a cor PINTADA não é a da camada — resíduo médio ${
          residuoMedio === null
            ? "NENHUM pixel de traço fora da caixa do rótulo para medir, e não medir é reprovar"
            : residuoMedio.toFixed(1)
        } contra o teto ${String(TOLERANCIA_DE_MISTURA)} (contrato ${CONTRATO.cores[a.papel]} = ${corDoContrato}, declarada ${a.corComputada}, pior pixel forte ${piorResiduoForte.toFixed(0)})`,
      );
    }
    if (pintaDeVerdade && corConfere) resumo[a.papel].corOk = (resumo[a.papel].corOk ?? 0) + 1;
    /*
     * ── A SEGUNDA PERGUNTA, A QUE FALTAVA: "DÁ PARA VER?" (rodada 12) ─────
     *
     * O modelo de mistura acima responde *"está na cor certa?"*: a distância
     * do pixel até a reta `B→C`. Ele NÃO responde *"está visível?"* — o
     * comentário dele diz isso por escrito ("antialias e oclusão só mexem em
     * α, a posição na reta"), e α não era medido em lugar nenhum. Qualquer
     * ponto da reta passava, **α perto de zero inclusive**.
     *
     * Medido pelo coordenador nesta entrega: `style={{ opacity: 0.12 }}` no
     * `<g>` da aresta deixou os CINCO portões verdes com o grafo quase
     * apagado — a sucessão caindo de 12,40:1 para 1,21:1 contra o canvas,
     * PIOR que o ALTO 4 que a rodada 11 acabara de fechar (1,27:1).
     *
     * A régua: o contraste WCAG do PIXEL COMPOSTO (a foto COM o traço) contra
     * o PIXEL DE FUNDO DO MESMO LUGAR (a foto SEM). É o que o olho recebe —
     * não o token declarado, que a opacidade não muda, e não a quantidade de
     * pixels que mudam, que é grande mesmo a 12%.
     *
     * Duas decisões que essa régua obriga:
     *
     * • **ONDE ela vale.** Oclusão foi o motivo legítimo da relaxação da
     *   rodada 11: aresta que corre atrás de um cartão tem pixels que somem, e
     *   a 390 px o traço tem menos de 1 px de tela e é antialias puro. Então a
     *   exigência é sobre o MELHOR pixel do traço — onde ele de fato aparece —
     *   e não sobre a média. Um traço legível em algum lugar é um traço.
     * • **"Não apareceu em lugar nenhum" é REPROVAÇÃO.** `melhorContraste`
     *   nasce em 1 (nenhum pixel mudou = nenhuma diferença = 1:1), abaixo de
     *   qualquer piso — então a aresta apagada cai aqui, e não por silêncio.
     *   E a conferência roda SEM depender de `pintaDeVerdade`: ela não pode
     *   ser pulada por uma checagem anterior ter falhado antes.
     *
     * O piso é `CONTRATO.pisoDeContraste` — lido de
     * `scripts/checar-contraste.mjs`, que é quem diz 3:1 para estas arestas.
     * Não sai daqui, e não sai do arquivo que decide a cor.
     */
    const visivel =
      melhorContraste >= CONTRATO.pisoDeContraste && pixeisVisiveis >= PISO_DE_PIXEIS_VISIVEIS;
    if (visivel) resumo[a.papel].visivel = (resumo[a.papel].visivel ?? 0) + 1;
    if (!visivel) {
      problemas.push(
        `${a.id} (papel "${a.papel}"): quase invisível — o MELHOR pixel do traço inteiro mede ${melhorContraste.toFixed(2)}:1 contra o fundo do próprio lugar (piso ${String(CONTRATO.pisoDeContraste)}:1, lido de scripts/checar-contraste.mjs) e ${String(pixeisVisiveis)} pixel(es) chegam lá (piso ${String(PISO_DE_PIXEIS_VISIVEIS)}). A cor DECLARADA continua ${a.corComputada}: a opacidade é aplicada na composição, e é por isso que a régua de tokens não vê`,
      );
    }
    alfaPicoPorAresta.set(a.id, alfaPicoDoTraco);
    if (a.papel === "critico") bandasPorCritica.push({ id: a.id, bandas, perfil: melhorPerfil, extensao: maiorExtensao });
    detalhePorAresta.push({
      id: a.id,
      papel: a.papel,
      medidos,
      pintam,
      naCor,
      mudaram,
      bandas,
      extensao: maiorExtensao,
      residuoMedio: residuoMedio === null ? null : Number(residuoMedio.toFixed(2)),
      piorResiduoForte,
      melhorContraste: Number(melhorContraste.toFixed(2)),
      pixeisVisiveis,
      alfaPicoDoTraco: Number(alfaPicoDoTraco.toFixed(3)),
    });
  }

  // Piso do universo: cada papel do contrato tem de ter aresta na tela.
  const papeisNaTela = Object.keys(resumo);
  const faltando = papeisExigidos.filter((p) => !papeisNaTela.includes(p));
  /*
   * Nenhum papel pode existir na tela sem que ao menos UMA aresta dele pinte
   * na cor que o contrato declara — senão "pinta alguma coisa" bastaria.
   *
   * `papeisComProvaDeCor` existe porque o estado COM SELEÇÃO não é o lugar de
   * provar cor: ao selecionar um nó, uma das arestas de sucessão VIRA
   * "destacada", e a 390 px a que sobra pode estar quase inteira atrás de um
   * cartão (medido: 99 pixels que mudam ao esconder, 0 na cor cheia). A cor de
   * cada papel se prova no estado SEM seleção, na mesma largura, onde todos
   * têm todas as suas arestas; o estado com seleção prova a cor só do papel
   * que ele é o único a produzir — "destacada".
   */
  const semCor = papeisNaTela
    .filter((p) => papeisComProvaDeCor.includes(p))
    .filter((p) => (resumo[p]?.naCor ?? 0) === 0);
  /* `pintam/n` e, entre parênteses, quantas dessas têm a COR PINTADA certa
     (ALTO 1) — as duas contas, nunca só a primeira. */
  const linha = CONTRATO.papeis
    .map(
      (p) =>
        `${p}=${String(resumo[p]?.pintam ?? 0)}/${String(resumo[p]?.n ?? 0)}(cor ${String(resumo[p]?.corOk ?? 0)}, visív ${String(resumo[p]?.visivel ?? 0)})`,
    )
    .join(" · ");

  exigir(
    problemas.length === 0 && faltando.length === 0 && semCor.length === 0 && arestas.length > 0,
    `${chave}${estado}: §7 a pintura das arestas — ${
      arestas.length === 0 ? "NENHUMA aresta no DOM; " : ""
    }${
      faltando.length > 0
        ? `papel sem NENHUMA aresta na tela (medir zero nunca é sucesso): ${faltando.join(", ")}; `
        : ""
    }${
      semCor.length > 0
        ? `papel em que NENHUMA aresta pinta na cor declarada: ${semCor.join(", ")}; `
        : ""
    }${problemas.slice(0, 3).join(" ; ")}`,
  );

  return { resumo, linha, bandasPorCritica, detalhePorAresta, arestas, cartoes, alfaPicoPorAresta };
}

// ═══════════════════════════════════════════════════════════════════════════
// §12 · O CANVAS × O DADO, NOS DOIS SENTIDOS  (achado ALTO 2 da rodada 11)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * O crítico apagou UMA aresta do caminho crítico do canvas com uma linha
 * (`return []` dentro do `useMemo` de `edges`) e os cinco portões ficaram
 * verdes — a própria saída imprimindo `critico=1/1` em vez de `2/2`, um traço
 * triplo em vez de dois, 6 arestas em vez de 7, e chamando isso de sucesso.
 *
 * Por quê: §10 perguntava só *"toda aresta DESENHADA está na lista?"*, nunca o
 * contrário, e o piso de §7 era "cada papel tem ≥ 1 aresta" — nunca uma
 * CONTAGEM contra o dado. Um grafo com 40 tarefas e 80 arestas passaria com
 * os mesmos números de um com 11 e 7.
 *
 * O dado entra pelo `data-lb-contrato-do-canvas` que o produto publica
 * (`dependency-graph.tsx`): sai de `arestasVisuais` filtrado pelas camadas
 * ativas, sem passar pelo `useMemo` que monta as arestas do ReactFlow. Aqui
 * os dois conjuntos são comparados NOS DOIS SENTIDOS, por id — e a camada e a
 * flag de crítica de cada aresta desenhada têm de bater com o dado também.
 */
async function lerContratoDoCanvas(page) {
  return page.evaluate(() => {
    const el = document.querySelector("[data-lb-contrato-do-canvas]");
    if (!el) return null;
    const cru = el.getAttribute("data-lb-contrato-do-canvas");
    try {
      return JSON.parse(cru);
    } catch (e) {
      return { erroDeLeitura: String(e && e.message ? e.message : e) };
    }
  });
}

function medirCoberturaContraODado(chave, estado, contrato, arestas) {
  if (contrato === null || contrato.erroDeLeitura || !Array.isArray(contrato.esperadas)) {
    exigir(
      false,
      `${chave}${estado}: §12 não consegui ler o contrato do canvas (data-lb-contrato-do-canvas) — sem o lado do DADO não há com o que comparar o desenho${
        contrato?.erroDeLeitura ? `: ${contrato.erroDeLeitura}` : ""
      }`,
    );
    return "sem contrato";
  }
  const problemas = [];
  const semRota = contrato.esperadas.filter((e) => !e.temRota);
  if (semRota.length > 0) {
    problemas.push(
      `${String(semRota.length)} aresta(s) do dado ficaram sem rota no layout e o canvas cala sobre elas: ${semRota.map((e) => e.id).slice(0, 3).join(", ")}`,
    );
  }
  const desenhadas = arestas.filter((a) => !a.semPath);
  const porId = new Map(desenhadas.map((a) => [a.id, a]));
  const esperadasPorId = new Map(contrato.esperadas.map((e) => [e.id, e]));

  const faltando = contrato.esperadas.filter((e) => !porId.has(e.id));
  if (faltando.length > 0) {
    problemas.push(
      `${String(faltando.length)} aresta(s) que o DADO manda desenhar não estão no canvas: ${faltando.map((e) => `${e.id} (camada "${e.camada}"${e.critica ? ", caminho crítico" : ""})`).slice(0, 3).join(" ; ")}`,
    );
  }
  const sobrando = desenhadas.filter((a) => !esperadasPorId.has(a.id));
  if (sobrando.length > 0) {
    problemas.push(
      `${String(sobrando.length)} aresta(s) desenhadas que o DADO não pede: ${sobrando.map((a) => a.id).slice(0, 3).join(", ")}`,
    );
  }
  for (const a of desenhadas) {
    const e = esperadasPorId.get(a.id);
    if (!e) continue;
    if (e.camada !== a.camada) {
      problemas.push(`${a.id}: o dado diz camada "${e.camada}" e o canvas desenhou "${String(a.camada)}"`);
    }
    if (Boolean(e.critica) !== Boolean(a.critica)) {
      problemas.push(
        `${a.id}: o dado diz caminho crítico = ${String(Boolean(e.critica))} e o canvas desenhou ${String(Boolean(a.critica))}`,
      );
    }
    if (e.origem !== a.origem || e.destino !== a.destino) {
      problemas.push(
        `${a.id}: o dado liga "${String(e.origem)}"→"${String(e.destino)}" e o canvas nomeia "${String(a.origem)}"→"${String(a.destino)}"`,
      );
    }
  }

  // As contagens, contra o dado — nunca contra um piso de 1.
  const contar = (lista, chaveDaCamada) => {
    const m = {};
    for (const x of lista) m[x[chaveDaCamada]] = (m[x[chaveDaCamada]] ?? 0) + 1;
    return m;
  };
  const noDado = contar(contrato.esperadas, "camada");
  const naTela = contar(desenhadas, "camada");
  for (const camada of new Set([...Object.keys(noDado), ...Object.keys(naTela)])) {
    if ((noDado[camada] ?? 0) !== (naTela[camada] ?? 0)) {
      problemas.push(
        `camada "${camada}": o dado tem ${String(noDado[camada] ?? 0)} aresta(s) e o canvas desenhou ${String(naTela[camada] ?? 0)}`,
      );
    }
  }
  const criticasNoDado = contrato.esperadas.filter((e) => e.critica).length;
  const criticasNaTela = desenhadas.filter((a) => a.critica).length;
  if (criticasNoDado !== criticasNaTela) {
    problemas.push(
      `caminho crítico: o dado tem ${String(criticasNoDado)} aresta(s) e o canvas desenhou ${String(criticasNaTela)}`,
    );
  }
  exigir(
    problemas.length === 0 && desenhadas.length > 0,
    `${chave}${estado}: §12 o canvas × o dado — ${desenhadas.length === 0 ? "NENHUMA aresta desenhada; " : ""}${problemas.slice(0, 4).join(" ; ")}`,
  );
  return `${String(desenhadas.length)}/${String(contrato.esperadas.length)} do dado · críticas ${String(criticasNaTela)}/${String(criticasNoDado)} · ${String(contrato.totalNoDado)} no grafo inteiro`;
}

// ═══════════════════════════════════════════════════════════════════════════
// §13 · DESLIGAR UMA CAMADA APAGA AS ARESTAS DELA  (achado ALTO 3)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * `ligarTodasAsCamadas(page)` aparecia três vezes nesta guarda e NADA, em
 * nenhuma das onze seções, chegava a desligar. O sentido OFF do único
 * controle que a peça nomeia nunca era exercido — e fixar `camadasAtivas` nas
 * cinco (uma linha em `dependency-graph.tsx`) deixava os cinco portões
 * verdes. `filtrarArestasPorCamada` tinha teste de unidade impecável; a
 * FIAÇÃO entre o checkbox e o canvas não tinha nenhum.
 *
 * Aqui o que se mede é a fiação, e a previsão sai do CANVAS + do CHECKBOX,
 * nunca do estado interno: com as cinco ligadas, cada aresta desenhada
 * declara a camada base (`data-camada`) e se é do caminho crítico
 * (`data-critica`). Desmarcar a camada L tem de deixar na tela exatamente as
 * arestas cujo conjunto de camadas ainda toca alguma camada marcada.
 *
 * "Caminho crítico" é o caso próprio: desmarcá-la NÃO apaga aresta nenhuma
 * (uma sucessão crítica continua sendo sucessão — OR, não AND); o que ela
 * apaga é o traço triplo. Então ali a régua é outra, declarada, e conferida.
 */
async function idsDesenhadosComCamada(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".react-flow g[data-camada]")].map((g) => ({
      id: g.getAttribute("data-aresta-id"),
      camada: g.getAttribute("data-camada"),
      critica: g.getAttribute("data-critica") === "true",
    })),
  );
}

/** Abre o painel "Camadas" e devolve o locator das caixas, com os rótulos. */
async function abrirPainelDeCamadas(page) {
  const pill = page.locator('button[aria-label="Camadas"]').first();
  if ((await pill.count()) === 0) return null;
  if ((await pill.getAttribute("aria-expanded")) !== "true") await pill.click();
  await page.waitForSelector('[role="dialog"][aria-label="Camadas do grafo"]', { timeout: 10000 });
  /*
   * O texto do rótulo vem SEM a amostra de aresta: cada `label` carrega um
   * `<svg>` desenhado pelo mesmo componente de produção, e a amostra de
   * sinergia tem o "50%" dentro — `textContent` cru devolvia
   * "sinergia 50%50%Sinergia" e a camada não casava com `CAMADA_LABEL`.
   */
  const rotulos = await page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"][aria-label="Camadas do grafo"] label')].map((l) => {
      const copia = l.cloneNode(true);
      for (const svg of copia.querySelectorAll("svg")) svg.remove();
      return {
        texto: (copia.textContent || "").replace(/\s+/g, " ").trim(),
        marcada: l.querySelector('input[type="checkbox"]')?.checked === true,
      };
    }),
  );
  return { rotulos };
}

async function fecharPainelDeCamadas(page) {
  const fechar = page.locator('[role="dialog"][aria-label="Camadas do grafo"] button[aria-label="Fechar"]');
  if (await fechar.count()) await fechar.first().click();
  else await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

async function medirDesligarCamada(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  const { ctx, page } = await abrirPagina(browser, caso);
  const linhas = [];
  try {
    await ligarTodasAsCamadas(page);
    await page.waitForTimeout(500);

    const painel = await abrirPainelDeCamadas(page);
    if (painel === null) {
      exigir(false, `${chave}: §13 não achei o controle "Camadas" — o sentido OFF não tem por onde ser exercido`);
      return linhas;
    }
    const porRotulo = new Map(
      CONTRATO.camadas.map((c) => [CONTRATO.rotulos[c], c]),
    );
    const indiceDaCamada = new Map();
    painel.rotulos.forEach((r, i) => {
      const camada = porRotulo.get(r.texto);
      if (camada) indiceDaCamada.set(camada, i);
    });
    const semCaixa = CONTRATO.camadas.filter((c) => !indiceDaCamada.has(c));
    if (semCaixa.length > 0) {
      exigir(
        false,
        `${chave}: §13 camada sem caixa no painel: ${semCaixa.join(", ")} (rótulos vistos: ${painel.rotulos.map((r) => r.texto).join(" | ")})`,
      );
      return linhas;
    }
    const marcarCaixa = async (camada, valor) => {
      const caixas = page.locator('[role="dialog"][aria-label="Camadas do grafo"] input[type="checkbox"]');
      const caixa = caixas.nth(indiceDaCamada.get(camada));
      if (valor) await caixa.check();
      else await caixa.uncheck();
      await page.waitForTimeout(600);
    };

    const antes = await idsDesenhadosComCamada(page);
    const camadasDe = (a) => (a.critica ? [a.camada, "critico"] : [a.camada]);

    for (const camada of CONTRATO.camadas) {
      const marcadasDepois = CONTRATO.camadas.filter((c) => c !== camada);
      await marcarCaixa(camada, false);
      const depois = await idsDesenhadosComCamada(page);
      const contratoAgora = await lerContratoDoCanvas(page);
      const idsDepois = new Set(depois.map((a) => a.id));

      if (camada === "critico") {
        /* Régua própria e declarada: nenhuma aresta some (sucessão crítica
           continua sucessão), mas o traço TRIPLO tem de sumir. */
        const criticasAntes = antes.filter((a) => a.critica).length;
        const criticasAgora = depois.filter((a) => a.critica).length;
        exigir(
          criticasAntes > 0,
          `${chave}: §13 nenhuma aresta de caminho crítico estava na tela antes de desligar a camada — não há o que medir`,
        );
        exigir(
          criticasAgora === 0,
          `${chave}: §13 desmarcar "${CONTRATO.rotulos[camada]}" deixou ${String(criticasAgora)} aresta(s) ainda marcadas como caminho crítico no canvas`,
        );
        exigir(
          depois.length === antes.length,
          `${chave}: §13 desmarcar "${CONTRATO.rotulos[camada]}" apagou ${String(antes.length - depois.length)} aresta(s) — uma sucessão crítica continua sendo sucessão (OR, não AND)`,
        );
        linhas.push(`${camada}: críticas ${String(criticasAntes)}→${String(criticasAgora)}, arestas ${String(antes.length)}→${String(depois.length)}`);
      } else {
        const previstas = antes.filter((a) => camadasDe(a).some((c) => marcadasDepois.includes(c)));
        const removidas = antes.filter((a) => !previstas.includes(a));
        exigir(
          removidas.length > 0,
          `${chave}: §13 a camada "${CONTRATO.rotulos[camada]}" não tinha nenhuma aresta exclusiva na tela — desligá-la não prova nada, e não provar nada é reprovar`,
        );
        const sobreviventesErrados = removidas.filter((a) => idsDepois.has(a.id));
        exigir(
          sobreviventesErrados.length === 0,
          `${chave}: §13 desmarcar "${CONTRATO.rotulos[camada]}" NÃO apagou ${String(sobreviventesErrados.length)} aresta(s) do canvas: ${sobreviventesErrados.map((a) => a.id).slice(0, 3).join(", ")}`,
        );
        const sumiuDemais = previstas.filter((a) => !idsDepois.has(a.id));
        exigir(
          sumiuDemais.length === 0,
          `${chave}: §13 desmarcar "${CONTRATO.rotulos[camada]}" apagou ${String(sumiuDemais.length)} aresta(s) de OUTRA camada: ${sumiuDemais.map((a) => `${a.id} (camada "${a.camada}")`).slice(0, 3).join(", ")}`,
        );
        linhas.push(`${camada}: ${String(antes.length)}→${String(depois.length)} arestas (−${String(removidas.length)} previstas)`);
      }

      /* O painel e o dado que alimenta o canvas têm de dizer a MESMA coisa —
         é o casamento que o `camadasAtivas` fixo quebra em silêncio. */
      const noContrato = Array.isArray(contratoAgora?.camadasAtivas) ? [...contratoAgora.camadasAtivas].sort() : null;
      exigir(
        noContrato !== null && noContrato.join(",") === [...marcadasDepois].sort().join(","),
        `${chave}: §13 com "${CONTRATO.rotulos[camada]}" desmarcada, o painel diz ${marcadasDepois.join("+")} e o dado que alimenta o canvas diz ${noContrato === null ? "nada (sem contrato)" : noContrato.join("+")}`,
      );

      await marcarCaixa(camada, true);
      const devolta = await idsDesenhadosComCamada(page);
      exigir(
        devolta.length === antes.length,
        `${chave}: §13 remarcar "${CONTRATO.rotulos[camada]}" devolveu ${String(devolta.length)} aresta(s) e antes eram ${String(antes.length)}`,
      );
    }
    await fecharPainelDeCamadas(page);
  } finally {
    await ctx.close();
  }
  return linhas;
}

// ═══════════════════════════════════════════════════════════════════════════
// §14 · O ESTADO DEFAULT, COMO ELE NASCE  (achado ALTO 3, segunda metade)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * A guarda ligava as cinco camadas na primeira coisa que fazia, em toda
 * largura — o estado em que a tela NASCE (`CAMADAS_DEFAULT` = sucessão +
 * caminho crítico) nunca era observado por ninguém. Aqui ele é: página nova,
 * nada clicado, e o que está na tela tem de ser exatamente o que o default
 * manda.
 */
async function medirEstadoDefault(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  const { ctx, page } = await abrirPagina(browser, caso);
  let linha = "?";
  try {
    const desenhadas = await idsDesenhadosComCamada(page);
    const contrato = await lerContratoDoCanvas(page);
    const noContrato = Array.isArray(contrato?.camadasAtivas) ? [...contrato.camadasAtivas].sort() : null;
    exigir(
      noContrato !== null && noContrato.join(",") === [...CONTRATO.camadasDefault].sort().join(","),
      `${chave}: §14 a tela nasce com as camadas ${noContrato === null ? "ilegíveis" : noContrato.join("+")} e CAMADAS_DEFAULT diz ${CONTRATO.camadasDefault.join("+")}`,
    );
    const foraDoDefault = desenhadas.filter(
      (a) => !CONTRATO.camadasDefault.includes(a.camada) && !(a.critica && CONTRATO.camadasDefault.includes("critico")),
    );
    exigir(
      foraDoDefault.length === 0,
      `${chave}: §14 a tela nasce desenhando ${String(foraDoDefault.length)} aresta(s) de camada que o default NÃO liga: ${foraDoDefault.map((a) => `${a.id} (camada "${a.camada}")`).slice(0, 3).join(", ")}`,
    );
    exigir(
      desenhadas.length > 0,
      `${chave}: §14 a tela nasce SEM nenhuma aresta desenhada — o default liga ${CONTRATO.camadasDefault.join("+")}`,
    );
    const painel = await abrirPainelDeCamadas(page);
    const marcadas = (painel?.rotulos ?? []).filter((r) => r.marcada).map((r) => r.texto).sort();
    const esperadasNoPainel = CONTRATO.camadasDefault.map((c) => CONTRATO.rotulos[c]).sort();
    exigir(
      marcadas.join(",") === esperadasNoPainel.join(","),
      `${chave}: §14 o painel nasce com [${marcadas.join(", ")}] marcadas e o default é [${esperadasNoPainel.join(", ")}]`,
    );
    if (painel !== null) await fecharPainelDeCamadas(page);
    linha = `${String(desenhadas.length)} arestas, camadas ${noContrato === null ? "?" : noContrato.join("+")}, painel [${marcadas.join(", ")}]`;
  } finally {
    await ctx.close();
  }
  return linha;
}

// ═══════════════════════════════════════════════════════════════════════════
// §8 · A FAIXA DO CAMINHO CRÍTICO É LARGA DE PIXEL, NÃO TRÊS ATRIBUTOS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * A versão anterior conferia `paths.length === 3`. Três `<path>` com
 * `opacity: 0` também dão 3. Aqui o perfil PERPENDICULAR ao traço é lido em
 * passos de meio pixel, e o que se exige é o que a tela mostra: pelo menos um
 * ponto do caminho crítico com TRÊS faixas pintadas separadas.
 *
 * Por que "pelo menos um ponto", e não todos: o deslocamento da tripla é feito
 * num eixo só (`eixoDeslocamento`, escolhido pelo sentido dominante da aresta
 * inteira — `aresta-svg.tsx`), então nos trechos em que o segmento corre
 * PARALELO a esse eixo as três linhas se sobrepõem de propósito e viram uma.
 * Medido nesta rodada, a 1440: `setup→build` dá {1:10, 2:6, 3:4} e
 * `build→deploy` dá {3:20} — e nenhuma aresta simples chegou a 2 faixas.
 */
function medirTracoTriplo(chave, estado, bandasPorCritica, detalhePorAresta) {
  if (bandasPorCritica.length === 0) {
    exigir(false, `${chave}${estado}: §8 nenhuma aresta do caminho crítico na tela — o traço triplo não foi medido, e não medir é reprovar`);
    return "critico=0";
  }
  const problemas = [];
  /*
   * CONTRAPROVA NA MESMA TELA, por EXTENSÃO e não por contagem de faixas.
   *
   * A primeira versão exigia que nenhuma aresta comum desenhasse 3 faixas — e
   * a 390 px isso deu vermelho falso: a sinergia é tracejada ("3 4"), e a 0,75
   * de zoom os vãos do tracejado aparecem no perfil perpendicular como
   * buracos. Contar faixas num tracejado não distingue tripla de traço.
   *
   * A extensão distingue: a tripla ocupa `2 × separação + traço` de largura,
   * e um traço simples ocupa o traço. Medido a 1440: crítico 10 px, comuns
   * 2–3 px (com uma ponta de 7 px numa curva). A mediana das comuns resiste a
   * essa ponta, e o fator 2 é folgado para os dois lados.
   */
  const comuns = detalhePorAresta.filter((d) => d.papel !== "critico" && d.extensao > 0);
  const extensoes = comuns.map((d) => d.extensao).sort((x, y) => x - y);
  const medianaComum = extensoes.length > 0 ? extensoes[Math.floor(extensoes.length / 2)] : 0;
  if (medianaComum <= 0) {
    exigir(
      false,
      `${chave}${estado}: §8 nenhuma aresta simples com traço medível nesta tela — sem a contraprova a largura da tripla não diz nada`,
    );
    return "sem contraprova";
  }
  for (const c of bandasPorCritica) {
    /*
     * REGRA 1 — a faixa do caminho crítico é MAIS LARGA que um traço simples
     * medido na MESMA tela. É esta que mata as versões falsas: três `<path>`
     * com `opacity: 0` nas laterais, ou `paths.length === 3` sem pintura
     * nenhuma, colapsam a extensão para a de um traço comum.
     */
    if (c.extensao < 2 * medianaComum) {
      problemas.push(
        `${c.id}: a faixa pintada do caminho crítico tem ${String(c.extensao)}px de largura e a mediana das arestas simples desta MESMA tela é ${String(medianaComum)}px — a tripla não é mais larga que um traço`,
      );
      continue;
    }
    /*
     * REGRA 2 — e ela mostra faixas SEPARADAS onde a resolução permite.
     *
     * Rodada 11: ao medir §8 nos estados que a varredura abriu (BAIXO 6),
     * apareceu um estado a 390 px em que a tripla é uma faixa SÓLIDA de 8 px
     * contra 2 px das simples — quatro vezes mais larga, sem nenhum buraco. O
     * arquivo já sabia por quê ("as laterais chegam a encostar na central
     * quando o zoom encolhe a separação", e nos trechos paralelos ao eixo do
     * deslocamento as três linhas se sobrepõem de propósito). Exigir 3 faixas
     * SEMPRE seria exigir uma resolução que o produto não promete.
     *
     * Então: 2 faixas separadas em algum ponto OU uma faixa 3× mais larga que
     * a simples. E o nome da medida passa a dizer isso — "a faixa larga do
     * caminho crítico", não "três faixas de pixel" (BAIXO 7: a guarda não
     * afirma o que ela não mede).
     */
    const comDuasOuMais = Object.entries(c.bandas)
      .filter(([n]) => Number(n) >= 2)
      .reduce((soma, [, q]) => soma + q, 0);
    if (comDuasOuMais < 1 && c.extensao < 3 * medianaComum) {
      problemas.push(
        `${c.id}: a faixa do caminho crítico tem ${String(c.extensao)}px (simples: ${String(medianaComum)}px) e NENHUM ponto mostrou duas faixas separadas — distribuição ${JSON.stringify(c.bandas)}, perfil "${c.perfil}"`,
      );
    }
  }
  exigir(problemas.length === 0, `${chave}${estado}: §8 o traço triplo — ${problemas.join(" ; ")}`);
  return bandasPorCritica.map((c) => `${c.id.split(":")[1] ?? c.id}:${JSON.stringify(c.bandas)}`).join(" ");
}

// ═══════════════════════════════════════════════════════════════════════════
// §9 · TODO GLIFO PINTA (a seta, o círculo, o losango e o ❌)
// ═══════════════════════════════════════════════════════════════════════════
const LEITURA_DOS_GLIFOS = `(() => {
  const saida = [];
  for (const el of document.querySelectorAll(".react-flow g[data-camada] .lb-edge-glifo")) {
    const grupo = el.closest(".react-flow g[data-camada]");
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const usaFill = cs.fill && cs.fill !== "none";
    saida.push({
      camada: grupo.getAttribute("data-camada"),
      aresta: grupo.getAttribute("data-aresta-id"),
      forma: el.tagName,
      caixa: { x: r.x, y: r.y, largura: r.width, altura: r.height },
      cor: window.__lbp4.corEsperada(el, usaFill ? "fill" : "stroke"),
      retrato: window.__lbp4.retrato(el),
    });
  }
  return saida;
})()`;

async function medirGlifos(page, chave, estado, arestas, alfaPicoPorAresta) {
  const glifos = await page.evaluate(LEITURA_DOS_GLIFOS);
  const alvos = await page.$$(`${SELETOR_DA_ARESTA} .lb-edge-glifo`);
  const problemas = [];
  const linha = [];
  const comGlifo = new Set(glifos.map((g) => g.aresta));
  for (const a of arestas) {
    if (!a.semPath && !comGlifo.has(a.id)) {
      problemas.push(`${a.id}: aresta desenhada SEM glifo de fim — a forma é o que distingue a camada para quem não vê cor`);
    }
  }
  for (let i = 0; i < glifos.length; i += 1) {
    const g = glifos[i];
    const alvo = alvos[i];
    if (!alvo) continue;
    if (g.caixa.largura <= 0 || g.caixa.altura <= 0) {
      problemas.push(`glifo de ${g.aresta}: sem caixa de layout (${JSON.stringify(g.caixa)})`);
      continue;
    }
    const centro = { x: g.caixa.x + g.caixa.largura / 2, y: g.caixa.y + g.caixa.altura / 2 };
    const raio = Math.max(3, Math.round(Math.min(g.caixa.largura, g.caixa.altura) / 2));
    const janela = janelaDosPontos([centro], raio + 3, page.viewportSize());
    if (janela === null) {
      problemas.push(`glifo de ${g.aresta}: a caixa dele ficou fora da janela de visão — não consegui medir, e isso é reprovação`);
      continue;
    }
    const fotos = await fotosComESem(page, alvo, janela);
    if (fotos.erro) {
      problemas.push(`glifo de ${g.aresta}: ${fotos.erro}`);
      continue;
    }
    const daAresta = arestas.find((a) => a.id === g.aresta);
    const corDoContrato = hexEmRgb(CONTRATO.cores[daAresta?.papel] ?? "#000000");
    const amostra = amostraNoPonto(fotos, centro, g.cor, raio, corDoContrato, CONTRATO.pisoDeContraste);
    if (!amostra.dentro) {
      problemas.push(`glifo de ${g.aresta}: a caixa dele não caiu dentro da foto — não consegui medir, e isso é reprovação`);
      continue;
    }
    const alfaOk = g.retrato.visivelHerdado && g.retrato.opacidadeAcumulada > 0;
    /*
     * Todo glifo tem de PINTAR (pixel que muda). Só o ❌ da obsolescência tem,
     * além disso, régua de COR: ele é a promessa nomeada da peça ("obsolescência
     * com ❌") e é o maior dos quatro (13×13). O círculo da correlação tem 3,5
     * px de raio de MUNDO — a 0,849 de zoom ele vira uma bolinha de 6 px quase
     * toda de antialias, e exigir cor cheia ali seria uma régua que reprova o
     * antialias, não o produto. A cor daquela camada já é medida no traço (§7).
     */
    const exigeCor = g.camada === "obsolescencia";
    /*
     * ── E O GLIFO TAMBÉM TEM DE SER VISÍVEL (rodada 12) ──────────────────
     *
     * A mesma porta do traço abre aqui, e com um nome próprio: `fill-opacity`
     * no glifo apaga o ❌, a seta, o círculo e o losango sem tocar no traço.
     * "Pixels que mudam" não pega: a 12% de opacidade eles continuam mudando
     * (medido: o círculo da correlação muda os MESMOS 9 pixels).
     *
     * **Por que aqui a régua não é o 3:1 absoluto do traço.** Medido nesta
     * rodada, na árvore honesta a 1440×900: o círculo da correlação tem caixa
     * de 7×7 px e pinta só NOVE pixels — uma meia-lua de 2 linhas; o resto
     * está atrás do cartão para onde ele aponta. O melhor pixel dele chega a
     * 3,39:1, um fio acima do piso, com UM pixel no piso. Um portão calibrado
     * a 13% do vermelho sobre a árvore honesta é um portão que apita sozinho —
     * e a oclusão é exatamente o motivo legítimo que a rodada 11 já tinha
     * nomeado. (Que o círculo apareça tão pouco é observação de PRODUTO, e vai
     * no relatório desta rodada; mudar o desenho não é trabalho de guarda.)
     *
     * A régua que serve é a de §8: comparar com uma REFERÊNCIA MEDIDA NA
     * MESMA TELA, não com uma constante escrita aqui. O glifo e o traço da
     * mesma aresta saem do mesmo componente, com a mesma cor e a mesma cadeia
     * de `opacity` — então o α DE PICO do glifo não pode desabar enquanto o
     * do traço fica de pé. `fill-opacity: 0.12` derruba um e não o outro.
     *
     * Traço sem α de pico medido = reprovação, nunca dispensa.
     */
    const alfaDoTraco = alfaPicoPorAresta?.get(g.aresta);
    const razaoDeAlfa =
      alfaDoTraco !== undefined && alfaDoTraco > 0 ? amostra.alfaPico / alfaDoTraco : null;
    const glifoVisivel =
      amostra.pixeisVisiveis >= PISO_DE_PIXEIS_VISIVEIS_DO_GLIFO
        ? true
        : razaoDeAlfa !== null && razaoDeAlfa >= FRACAO_MINIMA_DO_ALFA_DO_TRACO;
    const ok = alfaOk && amostra.mudaram >= 6 && (!exigeCor || amostra.naCor >= 8) && glifoVisivel;
    if (!ok) {
      problemas.push(
        `glifo ${g.forma} de ${g.aresta} (camada "${g.camada}"): ${
          alfaOk ? "" : "alfa real 0 · "
        }${String(amostra.mudaram)} pixels mudam ao esconder (piso 6)${
          exigeCor ? `, ${String(amostra.naCor)} na cor ${g.cor} (piso 8)` : ""
        }${
          glifoVisivel
            ? ""
            : `, e ele está quase invisível: melhor pixel ${amostra.melhorContraste.toFixed(2)}:1 contra o fundo do próprio lugar (piso ${String(CONTRATO.pisoDeContraste)}:1 de checar-contraste.mjs) com ${String(amostra.pixeisVisiveis)} pixel(es) no piso, e o α de pico dele é ${amostra.alfaPico.toFixed(3)} contra ${alfaDoTraco === undefined ? "NENHUM α medido no traço desta aresta — não medir é reprovar" : `${alfaDoTraco.toFixed(3)} do traço da MESMA aresta (razão ${razaoDeAlfa === null ? "n/d" : razaoDeAlfa.toFixed(2)}, piso ${String(FRACAO_MINIMA_DO_ALFA_DO_TRACO)})`}`
        }`,
      );
    }
    linha.push(`${g.camada}:${String(amostra.mudaram)}px/${amostra.melhorContraste.toFixed(1)}:1/α${amostra.alfaPico.toFixed(2)}`);
  }
  exigir(
    problemas.length === 0 && glifos.length > 0,
    `${chave}${estado}: §9 os glifos — ${glifos.length === 0 ? "NENHUM glifo no DOM; " : ""}${problemas.slice(0, 3).join(" ; ")}`,
  );
  return linha.join(" ");
}

// ═══════════════════════════════════════════════════════════════════════════
// §10 · TECLADO E LEITOR DE TELA ALCANÇAM AS CINCO CAMADAS  (achado ALTO 3)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * O universo é o que o CANVAS desenhou — não uma lista escrita aqui. Cada
 * aresta desenhada tem de aparecer na lista acessível, na linha de uma das
 * duas pontas, sob o rótulo da camada dela (`CAMADA_LABEL`, derivado) e com o
 * título do outro lado por escrito. E cada item da lista tem de ser alcançável
 * por Tab — uma lista que o leitor lê e o teclado não alcança é meia lista.
 */
async function medirAlcanceSemMouse(page, chave, estado, arestas, contrato) {
  const desenhadas = arestas.filter((a) => !a.semPath);
  /*
   * O universo da conferência é a UNIÃO do que o canvas desenhou com o que o
   * DADO manda desenhar (rodada 11, ALTO 2): comparar só com o desenho deixa
   * a lista e o canvas calarem juntos. Aresta que o dado tem e o canvas não
   * desenhou continua tendo de aparecer na lista — e a falta dela no canvas é
   * o que §12 reprova.
   */
  const doDado = Array.isArray(contrato?.esperadas) ? contrato.esperadas : [];
  const universo = [...desenhadas];
  for (const e of doDado) {
    if (!universo.some((a) => a.id === e.id)) {
      universo.push({ id: e.id, camada: e.camada, origem: e.origem, destino: e.destino, critica: e.critica });
    }
  }
  if (universo.length === 0) {
    exigir(false, `${chave}${estado}: §10 nenhuma aresta (nem no canvas, nem no dado) para comparar com a lista acessível`);
    return "0/0";
  }
  /*
   * O nome que o CANVAS dá a cada tarefa: o `aria-label` do cartão, que começa
   * pelo título (`task-node.tsx`). Lido ANTES de trocar para a lista — o
   * canvas some quando `accessibleFallback` entra no lugar dele, e ler depois
   * devolvia um mapa vazio (a medida reprovaria por defeito dela mesma).
   */
  const rotulosDoCanvas = await page.evaluate(() => {
    const m = {};
    for (const no of document.querySelectorAll(".react-flow__node[data-id]")) {
      const botao = no.querySelector('[role="button"][aria-label]');
      if (botao) m[no.getAttribute("data-id")] = botao.getAttribute("aria-label");
    }
    return m;
  });
  if (Object.keys(rotulosDoCanvas).length === 0) {
    exigir(false, `${chave}${estado}: §10 não consegui ler o nome de nenhum cartão do canvas — sem isso não há o que comparar`);
    return "sem nomes no canvas";
  }
  const botao = page.locator('button', { hasText: "ver como lista" }).first();
  if ((await botao.count()) === 0) {
    exigir(false, `${chave}${estado}: §10 não achei o botão "ver como lista" — o caminho sem mouse não existe`);
    return "sem botão";
  }
  /*
   * A folha modal do celular (o painel "Camadas" a 390 px) cobre a tela
   * inteira com um backdrop: ali o operador REALMENTE não alcança o botão da
   * lista, e isso não é defeito. Exceção com conferência própria, nunca um
   * `catch` mudo: exige-se que exista mesmo uma folha `aria-modal="true"` E
   * que o que está por cima do botão pertença a ela. Qualquer outra coisa
   * cobrindo o botão continua reprovando.
   */
  const cobertura = await botao.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const acima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const folha = document.querySelector('[role="dialog"][aria-modal="true"]');
    return {
      alcancavel: acima === el || el.contains(acima),
      temFolha: folha !== null,
      doBackdropDaFolha:
        acima !== null &&
        folha !== null &&
        (folha.contains(acima) || acima.getAttribute("aria-hidden") === "true"),
      quemEsta: acima === null ? "nada" : `${acima.tagName.toLowerCase()}.${String(acima.className).slice(0, 40)}`,
    };
  });
  if (!cobertura.alcancavel) {
    exigir(
      cobertura.temFolha && cobertura.doBackdropDaFolha,
      `${chave}${estado}: §10 alguma coisa cobre o botão "ver como lista" e NÃO é a folha modal do painel: ${cobertura.quemEsta}`,
    );
    return "coberto por folha modal — §10 não se mede através dela (medida no estado base da mesma largura)";
  }
  await botao.click();
  await page.waitForSelector("ol[aria-label] li[data-lb-tarefa]", { timeout: 10000 });
  await page.waitForTimeout(300);

  const lista = await page.evaluate(() => {
    const itens = {};
    for (const li of document.querySelectorAll("ol[aria-label] li[data-lb-tarefa]")) {
      const porCamada = {};
      for (const span of li.querySelectorAll("[data-lb-camada]")) {
        porCamada[span.getAttribute("data-lb-camada")] = (span.textContent || "").trim();
      }
      itens[li.getAttribute("data-lb-tarefa")] = {
        titulo: li.getAttribute("data-lb-titulo"),
        texto: (li.textContent || "").trim(),
        porCamada,
      };
    }
    return itens;
  });
  const problemas = [];
  /*
   * As duas superfícies nomeiam a MESMA tarefa? O `aria-label` do cartão
   * começa pelo título; o item da lista carrega o título em `data-lb-titulo`.
   * Sem esta conferência, a §10 estaria comparando a lista com ela mesma.
   */
  for (const [id, item] of Object.entries(lista)) {
    const doCanvas = rotulosDoCanvas[id];
    if (typeof doCanvas !== "string" || typeof item.titulo !== "string" || !doCanvas.startsWith(item.titulo)) {
      problemas.push(
        `a tarefa "${id}" se chama "${String(item.titulo)}" na lista acessível e "${String(doCanvas).slice(0, 40)}…" no canvas`,
      );
    }
  }
  for (const a of universo) {
    const rotulo = CONTRATO.rotulos[a.camada];
    const paraConferir = [
      { eu: a.origem, outro: a.destino },
      { eu: a.destino, outro: a.origem },
    ];
    const achou = paraConferir.some(({ eu, outro }) => {
      const item = lista[eu];
      if (!item) return false;
      const texto = item.porCamada[a.camada] ?? "";
      const nomeDoOutro = lista[outro]?.titulo ?? outro;
      return texto.includes(rotulo) && texto.includes(nomeDoOutro);
    });
    if (!achou) {
      problemas.push(
        `a aresta "${a.id}" (camada "${a.camada}") existe no grafo e NÃO está na lista acessível de nenhuma das duas pontas`,
      );
    }
    if (a.critica) {
      const achouCritico = paraConferir.some(({ eu }) => (lista[eu]?.porCamada["critico"] ?? "") !== "");
      if (!achouCritico) {
        problemas.push(`a aresta "${a.id}" é do caminho crítico e a lista acessível não diz isso em nenhuma das pontas`);
      }
    }
  }

  // Tab de verdade: quantos itens da lista o teclado alcança.
  const total = Object.keys(lista).length;
  await page.evaluate(() => {
    const primeiro = document.querySelector("ol[aria-label] li[data-lb-tarefa] button");
    if (primeiro) primeiro.focus();
  });
  const alcancados = new Set();
  for (let i = 0; i < total + 4; i += 1) {
    const id = await page.evaluate(() => {
      const li = document.activeElement?.closest?.("li[data-lb-tarefa]");
      return li ? li.getAttribute("data-lb-tarefa") : null;
    });
    if (id) alcancados.add(id);
    await page.keyboard.press("Tab");
  }
  if (alcancados.size < total) {
    problemas.push(
      `o teclado alcançou ${String(alcancados.size)} dos ${String(total)} itens da lista acessível`,
    );
  }
  /*
   * BAIXO 7 da rodada 11: a saída prometia "as CINCO camadas" e imprimia
   * "7 arestas em 4 camadas", porque `data-camada` é sempre a camada BASE e
   * nunca vale "critico" — o caminho crítico é uma FLAG (`data-critica`) sobre
   * uma aresta de sucessão, por decisão da própria peça. A medida estava
   * certa; o rótulo, não. Agora a linha diz as duas contas pelo nome.
   */
  const camadasBase = CONTRATO.camadas.filter((c) => c !== "critico");
  const cobertas = new Set(universo.map((a) => a.camada));
  const criticas = universo.filter((a) => a.critica).length;
  exigir(
    problemas.length === 0 && total > 0,
    `${chave}${estado}: §10 teclado e leitor de tela — ${total === 0 ? "a lista acessível está vazia; " : ""}${problemas.slice(0, 3).join(" ; ")}`,
  );
  /* O mesmo botão passa a se chamar "ver grafo" depois do primeiro clique —
     por isso a volta usa um localizador próprio, e não o de ida. */
  const voltar = page.locator("button", { hasText: "ver grafo" }).first();
  if ((await voltar.count()) > 0) await voltar.click();
  await page.waitForSelector(".react-flow__viewport", { timeout: 10000 });
  await page.waitForTimeout(400);
  return `${String(universo.length)} arestas · ${String(cobertas.size)}/${String(camadasBase.length)} camadas base · ${String(criticas)} no caminho crítico (flag, não camada base) · ${String(alcancados.size)}/${String(total)} itens no Tab`;
}

// ═══════════════════════════════════════════════════════════════════════════
// AS MEDIDAS DO DESENHO, NUM ESTADO DA TELA  (§7, §8, §9, §10 e §12 juntas)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Rodada 11, BAIXO 6: §7 a §10 só existiam em DOIS estados (a tela nova e a
 * tela com um nó selecionado). A varredura de estados (§11) media só a faixa
 * "Hoje" e o zoom — pintura, traço triplo, glifos e lista acessível não eram
 * medidos depois de abrir "Legenda" ou "Camadas", que é justamente onde um
 * popover remonta o canvas. As cinco medidas viraram esta função, e §11 passa
 * a chamá-la em TODO estado derivado da tela.
 */
/**
 * O canvas está DEBAIXO de uma folha modal? A folha do celular ("Camadas" a
 * 390 px) é `fixed inset-x-0 bottom-0` com backdrop opaco por cima do grafo
 * inteiro: ali o canvas de fato não está na tela, e fotografar a folha para
 * dizer "a aresta não pinta" seria reprovar o produto por ele ter um modal.
 *
 * Exceção com conferência própria, nunca um `catch` mudo: exige-se que exista
 * `[role="dialog"][aria-modal="true"]` E que o que está no CENTRO do pane não
 * pertença ao canvas. Qualquer outra coisa cobrindo o canvas continua
 * reprovando — e as medidas que NÃO dependem de pixel (§12, o canvas × o
 * dado) rodam do mesmo jeito.
 */
async function canvasCobertoPorFolhaModal(page) {
  return page.evaluate(() => {
    const pane = document.querySelector(".react-flow");
    const folha = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!pane || !folha) return { coberto: false, temFolha: folha !== null, quem: "" };
    const r = pane.getBoundingClientRect();
    const acima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const doCanvas = acima !== null && pane.contains(acima);
    return {
      coberto: !doCanvas,
      temFolha: true,
      daFolha: acima !== null && (folha.contains(acima) || acima.getAttribute("aria-hidden") === "true"),
      quem: acima === null ? "nada" : `${acima.tagName.toLowerCase()}.${String(acima.className).slice(0, 40)}`,
    };
  });
}

async function medirODesenhoInteiro(page, chave, estado) {
  const PAPEIS_SEM_SELECAO = CONTRATO.papeis.filter((p) => p !== "destacada");
  const contrato = await lerContratoDoCanvas(page);
  const cobertura = await canvasCobertoPorFolhaModal(page);
  if (cobertura.coberto) {
    exigir(
      cobertura.temFolha && cobertura.daFolha,
      `${chave}${estado}: §7 alguma coisa cobre o CENTRO do canvas e NÃO é a folha modal do painel: ${cobertura.quem}`,
    );
    const leitura = await page.evaluate(LEITURA_DAS_ARESTAS);
    const contraODado = medirCoberturaContraODado(chave, estado, contrato, leitura.arestas);
    return {
      pintura: { linha: "canvas debaixo da folha modal — §7/§8/§9 não se medem através dela", detalhePorAresta: [], arestas: leitura.arestas },
      triplo: "n/d (folha modal)",
      glifos: "n/d (folha modal)",
      alcance: "n/d (folha modal)",
      contraODado,
    };
  }
  const pintura = await medirPinturaDasArestas(page, chave, estado, PAPEIS_SEM_SELECAO, PAPEIS_SEM_SELECAO);
  const triplo = medirTracoTriplo(chave, estado, pintura.bandasPorCritica, pintura.detalhePorAresta);
  const contraODado = medirCoberturaContraODado(chave, estado, contrato, pintura.arestas);
  const glifos = await medirGlifos(page, chave, estado, pintura.arestas, pintura.alfaPicoPorAresta);
  const alcance = await medirAlcanceSemMouse(page, chave, estado, pintura.arestas, contrato);
  return { pintura, triplo, glifos, alcance, contraODado };
}

// ═══════════════════════════════════════════════════════════════════════════
// §1–§9 numa largura
// ═══════════════════════════════════════════════════════════════════════════
async function medirUmaLargura(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  console.log(`· medindo ${chave}`);
  const { ctx, page, errosDePagina } = await abrirPagina(browser, caso);

  // Todas as camadas LIGADAS: o padrão da casa liga só sucessão + crítico, e o
  // contrato da peça é sobre as cinco.
  await ligarTodasAsCamadas(page);
  await page.waitForTimeout(600);

  // ── 1. A faixa "Hoje" acima da dobra ────────────────────────────────────
  const hoje = await medirHoje(page, caso.altura);
  if (caso.desktop) {
    exigir(
      hoje.visivel >= TEASER_DA_FAIXA_DE_BAIXO_PX,
      `${chave}: a faixa "Hoje" tem ${hoje.visivel}px visíveis, e o contrato é ≥ ${TEASER_DA_FAIXA_DE_BAIXO_PX}px`,
    );
  }

  // ── 2. O pane real (a tabela que `tests/unit/panes-medidos.ts` guarda) ──
  const pane = await page.evaluate(() => {
    const el = document.querySelector(".react-flow");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { largura: Math.round(r.width), altura: Math.round(r.height) };
  });
  exigir(pane !== null && pane.altura > 0, `${chave}: o canvas do grafo não tem altura`);
  const naTabela = TABELA_DE_PANES.panes[chave];
  if (naTabela && pane) {
    const folga = TABELA_DE_PANES.toleranciaPx;
    exigir(
      Math.abs(naTabela.largura - pane.largura) <= folga &&
        Math.abs(naTabela.altura - pane.altura) <= folga,
      `${chave}: o pane real é ${pane.largura}×${pane.altura} e a tabela de tests/unit/panes-medidos.json diz ${naTabela.largura}×${naTabela.altura} — a tabela apodreceu`,
    );
  }

  // ── 7/8/9/10/12. A PINTURA, antes de mexer no zoom ─────────────────────
  const desenho = await medirODesenhoInteiro(page, chave, "");
  const pintura = desenho.pintura;
  const triplo = desenho.triplo;
  const glifos = desenho.glifos;
  const alcance = desenho.alcance;
  const contraODado = desenho.contraODado;

  // ── 7b. O destaque amarelo do predecessor (o 6º papel) ─────────────────
  /*
   * `destacada` só existe com um nó selecionado — e era o único papel de
   * `TIPOS_DE_BANDA` que NENHUMA medida deste arquivo tocava em nenhuma
   * rodada. O nó escolhido é derivado: o destino da primeira aresta de
   * sucessão que o canvas desenhou.
   */
  /* A volta da lista acessível para o canvas recria as arestas; esperar o
     seletor (em vez de ler no escuro) evita que uma re-renderização lenta
     vire "nenhuma aresta de sucessão no canvas". Se ela não aparecer mesmo,
     o `exigir` abaixo continua reprovando. */
  await page
    .waitForSelector('.react-flow g[data-camada="sucessao"]', { timeout: 10000 })
    .catch(() => undefined);
  const destinoParaSelecionar = await page.evaluate(() => {
    for (const g of document.querySelectorAll('.react-flow g[data-camada="sucessao"]')) {
      if (g.getAttribute("data-critica") !== "true") return g.getAttribute("data-destino");
    }
    const q = document.querySelector('.react-flow g[data-camada="sucessao"]');
    return q ? q.getAttribute("data-destino") : null;
  });
  let destaque = "sem aresta de sucessão";
  if (destinoParaSelecionar) {
    await page.evaluate((id) => {
      const no = [...document.querySelectorAll(".react-flow__node")].find(
        (n) => n.getAttribute("data-id") === id,
      );
      no?.querySelector('[role="button"]')?.click();
    }, destinoParaSelecionar);
    await page.waitForTimeout(700);
    const comDestaque = await medirPinturaDasArestas(page, chave, " (nó selecionado)", CONTRATO.papeis, ["destacada"]);
    destaque = comDestaque.linha;
    exigir(
      (comDestaque.resumo.destacada?.n ?? 0) > 0,
      `${chave}: selecionar "${destinoParaSelecionar}" não deixou NENHUMA aresta destacada (amarelo do predecessor) — o papel "destacada" existe no código e não chega à tela`,
    );
    await page.evaluate(() => {
      const pane2 = document.querySelector(".react-flow__pane");
      pane2?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    await page.waitForTimeout(400);
    await ligarTodasAsCamadas(page);
    await page.waitForTimeout(400);
  } else {
    exigir(false, `${chave}: nenhuma aresta de sucessão no canvas — não há como medir o destaque do predecessor`);
  }

  medicoes[chave] = {
    hoje,
    pane,
    pintura: pintura.linha,
    destaque,
    triplo,
    glifos,
    alcance,
    contraODado,
    detalhePorAresta: pintura.detalhePorAresta,
    errosDePagina: [...errosDePagina],
  };
  exigir(errosDePagina.length === 0, `${chave}: a página lançou ${errosDePagina.length} erro(s): ${errosDePagina[0] ?? ""}`);
  await ctx.close();

  /*
   * ── PÁGINA LIMPA PARA AS MEDIDAS DE GESTO (§3 a §6) ─────────────────────
   *
   * As medidas acima mexem em catorze elementos (esconder/mostrar cada aresta
   * e cada glifo), selecionam um cartão, trocam o grafo pela lista acessível e
   * voltam. Medir o gesto do operador DEPOIS disso é medir o próprio rastro:
   * medido a 390 px, o reenquadramento de §6 não disparava numa página assim —
   * e disparava, na mesma árvore, numa página recém-carregada (conferido
   * rodando a guarda da rodada 9, que não mexe em nada antes, contra ESTE
   * mesmo código). O zoom e os resizes passam a rodar numa página limpa.
   */
  const segunda = await abrirPagina(browser, caso);
  const page2 = segunda.page;
  const errosDaSegunda = segunda.errosDePagina;
  await ligarTodasAsCamadas(page2);
  await page2.waitForTimeout(600);

  // ── 3. O gesto do operador: seis cliques em "Aumentar zoom" ─────────────
  const gesto = await gestoDeZoom(page2);
  exigir(gesto.achouBotao, `${chave}: não achei o botão "Aumentar zoom"`);
  for (let i = 1; i < gesto.trilha.length; i++) {
    exigir(
      gesto.trilha[i] >= gesto.trilha[i - 1] - 1e-9,
      `${chave}: o zoom CAIU de ${gesto.trilha[i - 1]} para ${gesto.trilha[i]} — o gesto do operador foi desfeito`,
    );
  }
  exigir(
    gesto.fim !== null && Math.abs(gesto.fim - ZOOM_MAXIMO_DO_CANVAS) < 1e-3,
    `${chave}: seis cliques deveriam chegar ao teto ${ZOOM_MAXIMO_DO_CANVAS}, chegaram a ${gesto.fim}`,
  );

  // ── 4. O modo CARTÃO existe de verdade (altura do nó no DOM) ────────────
  const alturaDoNo = await page2.evaluate(() => {
    const n = document.querySelector(".react-flow__node");
    return n ? Math.round(n.getBoundingClientRect().height / (window.devicePixelRatio || 1)) : null;
  });
  exigir(alturaDoNo !== null && alturaDoNo > 0, `${chave}: o cartão do grafo não tem altura no DOM`);

  // ── 5. Dois pixels não apagam o gesto (achado ALTO #2 da rodada 8) ──────
  const zAntesDoResize = escalaDe(await transformDoCanvas(page2));
  await page2.setViewportSize({ width: larguraDeRuidoPara(caso), height: caso.altura });
  await page2.waitForTimeout(1000);
  const zDepoisDoResize = escalaDe(await transformDoCanvas(page2));
  exigir(
    Math.abs(zDepoisDoResize - zAntesDoResize) < 1e-6,
    `${chave}: 2px de resize mudaram o zoom de ${zAntesDoResize} para ${zDepoisDoResize}`,
  );

  // ── 6. …mas um resize DE VERDADE ainda reenquadra ───────────────────────
  const larguraDeVerdade = caso.largura >= 1024 ? 640 : 1280;
  await page2.setViewportSize({ width: larguraDeVerdade, height: caso.altura });
  await page2.waitForTimeout(1400);
  const zDepoisDeVerdade = escalaDe(await transformDoCanvas(page2));
  exigir(
    zDepoisDeVerdade === null || Math.abs(zDepoisDeVerdade - zAntesDoResize) > 1e-6,
    `${chave}: um resize de ${caso.largura}→${larguraDeVerdade} NÃO reenquadrou (zoom ficou em ${zDepoisDeVerdade})`,
  );

  exigir(
    errosDaSegunda.length === 0,
    `${chave}: a página do gesto lançou ${errosDaSegunda.length} erro(s): ${errosDaSegunda[0] ?? ""}`,
  );

  medicoes[chave] = {
    ...medicoes[chave],
    trilha: gesto.trilha,
    zAntesDoResize,
    zDepoisDoResize,
    zDepoisDeVerdade,
    alturaDoNo,
  };
  await segunda.ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// §11 · OS ESTADOS DA TELA, DERIVADOS  (achados ALTO 1 e ALTO 2)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * A guarda media um estado só: a tela recém-carregada. Um clique no aviso
 * "5 fontes desatualizadas" bastava para a faixa "Hoje" ir a 0 px, e para
 * 2 px de resize derrubarem o zoom do teto. Os dois achados são a mesma
 * classe, e fechá-la exige varrer ESTADOS, não escrever mais um caso.
 *
 * O conjunto de estados é DERIVADO da tela: o estado base, mais um estado por
 * controle `[aria-expanded]` que a página tiver. Um acordeão novo entra na
 * varredura sozinho. Piso: se a tela não tiver NENHUM controle desses, a
 * varredura reprova — porque ela passaria a não medir nada e a dizer "ok".
 */
async function medirEstadosDerivados(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  console.log(`· varrendo estados em ${chave}`);
  const primeira = await abrirPagina(browser, caso);
  const controles = await primeira.page.evaluate(() =>
    [...document.querySelectorAll("[aria-expanded]")].map((el, i) => ({
      indice: i,
      nome: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40),
    })),
  );
  await primeira.ctx.close();
  exigir(
    controles.length > 0,
    `${chave}: §11 nenhum controle [aria-expanded] na tela — a varredura de estados não teria o que medir, e uma varredura vazia diria "ok" sem medir nada`,
  );

  const linhas = [];
  for (const controle of [{ indice: -1, nome: "base" }, ...controles]) {
    const { ctx, page, errosDePagina } = await abrirPagina(browser, caso);
    if (controle.indice >= 0) {
      const clicou = await page.evaluate((i) => {
        const el = [...document.querySelectorAll("[aria-expanded]")][i];
        if (!el) return false;
        el.click();
        return true;
      }, controle.indice);
      if (!clicou) {
        exigir(false, `${chave}: §11 o controle "${controle.nome}" sumiu antes de ser clicado — não consegui medir o estado`);
        await ctx.close();
        continue;
      }
      await page.waitForTimeout(900);
    }

    // §1 no estado: a faixa "Hoje" continua acima da dobra, SEM resize nenhum.
    const hoje = await medirHoje(page, caso.altura);
    if (caso.desktop) {
      exigir(
        hoje.visivel >= TEASER_DA_FAIXA_DE_BAIXO_PX,
        `${chave}: §11 com "${controle.nome}" aberto, a faixa "Hoje" tem ${hoje.visivel}px visíveis e o contrato é ≥ ${TEASER_DA_FAIXA_DE_BAIXO_PX}px`,
      );
    }

    // §5 no estado: o gesto do operador sobrevive a 2px de ruído.
    const gesto = await gestoDeZoom(page);
    let antes = gesto.fim;
    let depois = null;
    if (!gesto.alcancavel) {
      const temFolhaModal = await page.evaluate(
        () => document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
      );
      exigir(
        temFolhaModal,
        `${chave}: §11 com "${controle.nome}" aberto, o botão "Aumentar zoom" ficou inalcançável SEM nenhuma folha modal na tela — alguma coisa está cobrindo o canvas`,
      );
      antes = "coberto por folha modal";
      depois = antes;
    } else {
      await page.setViewportSize({ width: larguraDeRuidoPara(caso), height: caso.altura });
      await page.waitForTimeout(1200);
      depois = escalaDe(await transformDoCanvas(page));
      exigir(
        antes !== null && depois !== null && Math.abs(depois - antes) < 1e-6,
        `${chave}: §11 com "${controle.nome}" aberto, 2px de resize mudaram o zoom de ${antes} para ${depois}`,
      );
    }
    exigir(
      errosDePagina.length === 0,
      `${chave}: §11 com "${controle.nome}" aberto, a página lançou ${errosDePagina.length} erro(s): ${errosDePagina[0] ?? ""}`,
    );
    await ctx.close();

    /*
     * BAIXO 6: o MESMO estado, numa página limpa, com as cinco camadas
     * ligadas — e aí as cinco medidas do desenho (§7 pintura, §8 traço
     * triplo, §9 glifos, §10 lista acessível, §12 canvas × dado). Página
     * separada de propósito: as medidas acima mexem no zoom e no tamanho da
     * janela, e medir a pintura depois disso seria medir o próprio rastro.
     */
    const segunda = await abrirPagina(browser, caso);
    await ligarTodasAsCamadas(segunda.page);
    await segunda.page.waitForTimeout(500);
    if (controle.indice >= 0) {
      const clicou2 = await segunda.page.evaluate((i) => {
        const el = [...document.querySelectorAll("[aria-expanded]")][i];
        if (!el) return false;
        el.click();
        return true;
      }, controle.indice);
      exigir(
        clicou2,
        `${chave}: §11 o controle "${controle.nome}" sumiu antes de medir o desenho neste estado`,
      );
      await segunda.page.waitForTimeout(900);
    }
    const desenhoNoEstado = await medirODesenhoInteiro(segunda.page, chave, ` [${controle.nome}]`);
    exigir(
      segunda.errosDePagina.length === 0,
      `${chave}: §11 com "${controle.nome}" aberto, a página do desenho lançou ${segunda.errosDePagina.length} erro(s): ${segunda.errosDePagina[0] ?? ""}`,
    );
    await segunda.ctx.close();

    linhas.push(
      `${controle.nome}: Hoje ${String(hoje.visivel)}px, zoom ${String(antes)}→${String(depois)} · ${desenhoNoEstado.pintura.linha} · dado ${desenhoNoEstado.contraODado} · glifos ${
        desenhoNoEstado.glifos.startsWith("n/d")
          ? desenhoNoEstado.glifos
          : `${String(desenhoNoEstado.glifos.split(" ").filter(Boolean).length)} medidos`
      } · lista ${desenhoNoEstado.alcance}`,
    );
  }
  medicoes[chave] = { ...(medicoes[chave] ?? {}), estados: linhas };
  return linhas;
}

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

/**
 * Sobe `next dev` a partir DESTE pacote, em porta livre, com o modo fixture.
 *
 * POR QUE ELA SOBE O PRÓPRIO SERVIDOR (achado da conferência da rodada 9):
 * a primeira versão se conectava a uma porta fixa e media o que estivesse lá.
 * Numa máquina com várias cópias do repositório abertas, ela media a árvore de
 * outra pessoa e dizia VERDE — inclusive com uma sabotagem aplicada na árvore
 * de verdade. Medir o produto não é só abrir o navegador: é garantir que o que
 * está do outro lado é ESTE código.
 */
async function subirServidorProprio() {
  const req = createRequire(import.meta.url);
  let binarioDoNext;
  try {
    binarioDoNext = join(dirname(req.resolve("next/package.json")), "dist", "bin", "next");
  } catch {
    return null;
  }
  const porta = await portaLivre();
  const base = `http://127.0.0.1:${porta}`;
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
if (BASE === null) {
  const proprio = await subirServidorProprio();
  if (proprio === null) {
    console.error(
      "guarda-no-navegador: não consegui subir o servidor deste pacote. Rode `npm install` na raiz, ou aponte LIFEBOARD_BASE_URL para um servidor que sirva ESTA árvore.",
    );
    process.exit(2);
  }
  BASE = proprio.base;
  encerrarServidor = proprio.encerrar;
  console.log(`servidor próprio no ar em ${BASE} (subido por esta guarda)`);
}

const pw = carregarPlaywright();
if (pw === null) {
  console.error(
    "guarda-no-navegador: não achei playwright-core. Aponte LIFEBOARD_PLAYWRIGHT para a instalação (este pacote não o declara como dependência).",
  );
  process.exit(2);
}

console.log(
  `contrato derivado do código: ${CONTRATO.papeis.length} papéis de aresta (${CONTRATO.papeis.join(", ")}), ${CONTRATO.camadas.length} camadas`,
);

const browser = await pw.chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
try {
  for (const caso of LARGURAS) {
    const chave = `${caso.largura}x${caso.altura}`;
    await medirUmaLargura(browser, caso);
    await medirEstadosDerivados(browser, caso);
    console.log(`· desligando camadas em ${chave}`);
    const desligar = await medirDesligarCamada(browser, caso);
    console.log(`· estado default (nada clicado) em ${chave}`);
    const defaultDaTela = await medirEstadoDefault(browser, caso);
    medicoes[chave] = { ...(medicoes[chave] ?? {}), desligar, defaultDaTela };
  }
} finally {
  await browser.close();
  encerrarServidor();
}

const json = JSON.stringify(medicoes, null, 2);
if (process.env.LIFEBOARD_GUARDA_JSON) writeFileSync(process.env.LIFEBOARD_GUARDA_JSON, json);

console.log("── guarda no navegador ────────────────────────────────");
for (const [chave, m] of Object.entries(medicoes)) {
  console.log(
    [
      chave.padEnd(10),
      `pane ${String(m.pane?.largura ?? "?").padStart(4)}×${String(m.pane?.altura ?? "?").padStart(3)}`,
      `Hoje ${String(m.hoje?.visivel ?? "?").padStart(3)}px`,
      `zoom ${String(m.trilha?.[0]).slice(0, 6)}→${String(m.trilha?.[6]).slice(0, 6)}`,
      `resize2px ${String(m.zDepoisDoResize).slice(0, 6)}`,
      `nó ${String(m.alturaDoNo)}px`,
    ].join("  "),
  );
  console.log(`             pintura  ${m.pintura ?? "?"}`);
  console.log(`             destaque ${m.destaque ?? "?"}`);
  console.log(`             triplo   ${m.triplo ?? "?"}`);
  console.log(`             glifos   ${m.glifos ?? "?"}`);
  console.log(`             sem mouse ${m.alcance ?? "?"}`);
  console.log(`             × o dado ${m.contraODado ?? "?"}`);
  console.log(`             default  ${m.defaultDaTela ?? "?"}`);
  for (const linha of m.desligar ?? []) console.log(`             desliga  ${linha}`);
  for (const linha of m.estados ?? []) console.log(`             estado   ${linha}`);
}
if (falhas.length > 0) {
  console.error(`\n${falhas.length} promessa(s) da peça P4 NÃO se sustentam no navegador:`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\ntodas as promessas medidas no navegador se sustentam.");
