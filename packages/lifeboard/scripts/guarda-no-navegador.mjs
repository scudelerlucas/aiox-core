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
 * | 8 | **o traço triplo tem 3 faixas de pixel**, não 3 atributos | 3 bandas em ≥ 1 ponto |
 * | 9 | **todo glifo (seta/círculo/losango/❌) PINTA** | pixel que muda; ❌ também na cor |
 * | 10 | **teclado e leitor alcançam as 5 camadas** | 0 arestas fora da lista |
 * | 11 | **§1 e §5 em TODO estado da tela**, derivados de `[aria-expanded]` | idem §1 e §5 |
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
  return { papeis, camadas, rotulos, cores };
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
  for (const g of document.querySelectorAll("g[data-camada]")) {
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
      nTracos: g.querySelectorAll("path.lb-edge-path").length,
      tracejado: path.getAttribute("stroke-dasharray") || "",
    });
  }
  return saida;
})()`;

const RAIO_DA_AMOSTRA = 4;
const RAIO_DO_PERFIL = 14;

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
  const arestas = await page.evaluate(LEITURA_DAS_ARESTAS);
  const grupos = await page.$$("g[data-camada]");
  const resumo = {};
  const problemas = [];
  const detalhePorAresta = [];
  const bandasPorCritica = [];

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
    const bandas = {};
    let melhorPerfil = "";
    let maiorExtensao = -1;
    for (const ponto of a.pontos) {
      const amostra = amostraNoPonto(fotos, ponto, a.corEsperada, RAIO_DA_AMOSTRA);
      if (!amostra.dentro) continue;
      medidos += 1;
      naCor += amostra.naCor;
      mudaram += amostra.mudaram;
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
    if (a.papel === "critico") bandasPorCritica.push({ id: a.id, bandas, perfil: melhorPerfil, extensao: maiorExtensao });
    detalhePorAresta.push({ id: a.id, papel: a.papel, medidos, pintam, naCor, mudaram, bandas, extensao: maiorExtensao });
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
  const linha = CONTRATO.papeis
    .map((p) => `${p}=${String(resumo[p]?.pintam ?? 0)}/${String(resumo[p]?.n ?? 0)}`)
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

  return { resumo, linha, bandasPorCritica, detalhePorAresta, arestas };
}

// ═══════════════════════════════════════════════════════════════════════════
// §8 · O TRAÇO TRIPLO É TRÊS FAIXAS DE PIXEL, NÃO TRÊS ATRIBUTOS
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
  for (const c of bandasPorCritica) {
    const comTres = c.bandas["3"] ?? 0;
    if (comTres < 1) {
      problemas.push(
        `${c.id}: nenhum ponto do traço mostrou 3 faixas de pixel (distribuição ${JSON.stringify(c.bandas)}, maior extensão ${String(c.extensao)}px, perfil "${c.perfil}")`,
      );
    }
  }
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
  if (medianaComum > 0) {
    for (const c of bandasPorCritica) {
      if (c.extensao < 2 * medianaComum) {
        problemas.push(
          `${c.id}: a faixa pintada do caminho crítico tem ${String(c.extensao)}px de largura e a mediana das arestas simples desta MESMA tela é ${String(medianaComum)}px — a tripla não é mais larga que um traço`,
        );
      }
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
  for (const el of document.querySelectorAll("g[data-camada] .lb-edge-glifo")) {
    const grupo = el.closest("g[data-camada]");
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

async function medirGlifos(page, chave, estado, arestas) {
  const glifos = await page.evaluate(LEITURA_DOS_GLIFOS);
  const alvos = await page.$$("g[data-camada] .lb-edge-glifo");
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
    const amostra = amostraNoPonto(fotos, centro, g.cor, raio);
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
    const ok = alfaOk && amostra.mudaram >= 6 && (!exigeCor || amostra.naCor >= 8);
    if (!ok) {
      problemas.push(
        `glifo ${g.forma} de ${g.aresta} (camada "${g.camada}"): ${
          alfaOk ? "" : "alfa real 0 · "
        }${String(amostra.mudaram)} pixels mudam ao esconder (piso 6)${
          exigeCor ? `, ${String(amostra.naCor)} na cor ${g.cor} (piso 8)` : ""
        }`,
      );
    }
    linha.push(`${g.camada}:${String(amostra.mudaram)}`);
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
async function medirAlcanceSemMouse(page, chave, estado, arestas) {
  const desenhadas = arestas.filter((a) => !a.semPath);
  if (desenhadas.length === 0) {
    exigir(false, `${chave}${estado}: §10 nenhuma aresta desenhada para comparar com a lista acessível`);
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
  for (const a of desenhadas) {
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
        `a aresta "${a.id}" (camada "${a.camada}") está no canvas e NÃO está na lista acessível de nenhuma das duas pontas`,
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
  const camadasCobertas = new Set(desenhadas.map((a) => a.camada));
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
  return `${String(desenhadas.length)} arestas em ${String(camadasCobertas.size)} camadas · ${String(alcancados.size)}/${String(total)} itens no Tab`;
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

  // ── 7/8/9/10. A PINTURA, antes de mexer no zoom ────────────────────────
  const PAPEIS_SEM_SELECAO = CONTRATO.papeis.filter((p) => p !== "destacada");
  const pintura = await medirPinturaDasArestas(page, chave, "", PAPEIS_SEM_SELECAO, PAPEIS_SEM_SELECAO);
  const triplo = medirTracoTriplo(chave, "", pintura.bandasPorCritica, pintura.detalhePorAresta);
  const glifos = await medirGlifos(page, chave, "", pintura.arestas);
  const alcance = await medirAlcanceSemMouse(page, chave, "", pintura.arestas);

  // ── 7b. O destaque amarelo do predecessor (o 6º papel) ─────────────────
  /*
   * `destacada` só existe com um nó selecionado — e era o único papel de
   * `TIPOS_DE_BANDA` que NENHUMA medida deste arquivo tocava em nenhuma
   * rodada. O nó escolhido é derivado: o destino da primeira aresta de
   * sucessão que o canvas desenhou.
   */
  const destinoParaSelecionar = await page.evaluate(() => {
    for (const g of document.querySelectorAll('g[data-camada="sucessao"]')) {
      if (g.getAttribute("data-critica") !== "true") return g.getAttribute("data-destino");
    }
    const q = document.querySelector('g[data-camada="sucessao"]');
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
    linhas.push(`${controle.nome}: Hoje ${String(hoje.visivel)}px, zoom ${String(antes)}→${String(depois)}`);
    await ctx.close();
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
    await medirUmaLargura(browser, caso);
    await medirEstadosDerivados(browser, caso);
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
  for (const linha of m.estados ?? []) console.log(`             estado   ${linha}`);
}
if (falhas.length > 0) {
  console.error(`\n${falhas.length} promessa(s) da peça P4 NÃO se sustentam no navegador:`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\ntodas as promessas medidas no navegador se sustentam.");
