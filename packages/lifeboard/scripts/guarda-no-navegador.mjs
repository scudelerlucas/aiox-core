#!/usr/bin/env node
/*
 * Os trechos dentro de `page.evaluate(...)` rodam DENTRO do Chromium, não no
 * Node — `document`, `window` e `getComputedStyle` existem lá. A linha abaixo
 * só declara isso ao analisador; nenhuma regra é desligada.
 */
/* global document, window, getComputedStyle */
/**
 * OS-LIFEBOARD · P4i — A GUARDA QUE MEDE O PRODUTO, NO NAVEGADOR.
 *
 * Achado ALTO #1 do crítico hostil da rodada 8: *"a guarda mede um simulador
 * escrito pelo próprio corretor"*. Era verdade — havia um `CanvasSimulado` de
 * 245 linhas que reimplementava o laço de render do React, e as promessas de
 * PIXEL da peça (o zoom que o operador alcança, o modo do cartão, os px de
 * "Hoje" acima da dobra, o traço triplo do caminho crítico) só existiam lá
 * dentro. Este arquivo é a resposta: abre a página real no Chromium, clica nos
 * botões reais e mede o DOM real. Falhou, sai com código 1.
 *
 * COMO RODAR
 *   `node scripts/guarda-no-navegador.mjs` — só isso. A guarda SOBE O PRÓPRIO
 *   servidor a partir DESTE diretório, numa porta livre, e o derruba no fim.
 *
 * POR QUE ELA SOBE O PRÓPRIO SERVIDOR (achado da conferência da rodada 9):
 *   a primeira versão se conectava a uma porta fixa e media o que estivesse
 *   lá. Numa máquina com várias cópias do repositório abertas, ela media a
 *   árvore de outra pessoa e dizia VERDE — inclusive com uma sabotagem
 *   aplicada na árvore de verdade. Medir o produto não é só abrir o
 *   navegador: é garantir que o que está do outro lado é ESTE código.
 *
 * VARIÁVEIS
 *   LIFEBOARD_BASE_URL    endereço de um servidor JÁ NO AR. Quem passa isto
 *                         assume a responsabilidade de ele servir esta árvore;
 *                         sem a variável, a guarda não depende de ninguém.
 *   LIFEBOARD_PLAYWRIGHT  caminho do `playwright-core` (este pacote não o
 *                         declara como dependência: o ambiente de CI da casa
 *                         não instala navegador, e instalar aqui era proibido
 *                         pela ordem da rodada)
 *   LIFEBOARD_CHROMIUM    `executablePath` do Chromium já instalado
 *   LIFEBOARD_GUARDA_JSON caminho para gravar a medição crua
 *
 * Sem playwright-core acessível o script sai com código 2 e diz exatamente o
 * que falta — nunca sai 0 fingindo ter medido.
 */

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
/** As cinco camadas e o `stroke` que cada uma promete (hex de `aresta-svg.tsx`). */
const CORES = {
  sucessao: "#5FE39A",
  correlacao: "#B9C4DC",
  sinergia: "#C58CFF",
  obsolescencia: "#FF6EC7",
  critico: "#FF7A6B",
};

const LARGURAS = [
  { largura: 1024, altura: 800, desktop: true },
  { largura: 1280, altura: 800, desktop: true },
  { largura: 1440, altura: 900, desktop: true },
  { largura: 1920, altura: 1080, desktop: true },
  { largura: 390, altura: 800, desktop: false },
];

function carregarPlaywright() {
  const req = createRequire(import.meta.url);
  const candidatos = [
    process.env.LIFEBOARD_PLAYWRIGHT,
    "playwright-core",
    "playwright",
  ].filter(Boolean);
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

/**
 * A tabela de panes que `tests/unit/panes-medidos.ts` usa. Lida daqui para que
 * ela não possa apodrecer: se o DOM vivo divergir, esta guarda reprova.
 */
const TABELA_DE_PANES = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../tests/unit/panes-medidos.json"), "utf8"),
);

const falhas = [];
const medicoes = {};
function exigir(condicao, mensagem) {
  if (!condicao) falhas.push(mensagem);
}

async function medirUmaLargura(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  const ctx = await browser.newContext({
    viewport: { width: caso.largura, height: caso.altura },
  });
  const page = await ctx.newPage();
  const errosDePagina = [];
  page.on("pageerror", (e) => errosDePagina.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  if (!caso.desktop) {
    const abaGrafo = page.locator('nav[aria-label="Painéis"] button', { hasText: "Grafo" });
    if (await abaGrafo.count()) await abaGrafo.first().click();
  }
  await page.waitForSelector(".react-flow__viewport", { timeout: 30000 });
  await page.waitForTimeout(1200);

  // Todas as camadas LIGADAS: o padrão da casa liga só sucessão + crítico, e o
  // contrato da peça é sobre as cinco.
  await ligarTodasAsCamadas(page);
  await page.waitForTimeout(600);

  const transform = () =>
    page.evaluate(() => {
      const el = document.querySelector(".react-flow__viewport");
      return el ? getComputedStyle(el).transform : null;
    });

  // ── 1. A faixa "Hoje" acima da dobra ────────────────────────────────────
  const hoje = await page.evaluate((vh) => {
    const sec = document.querySelector('section[aria-label="Prioridades de hoje"]');
    if (!sec) return { existe: false, visivel: 0 };
    const r = sec.getBoundingClientRect();
    return {
      existe: true,
      topo: Math.round(r.top),
      altura: Math.round(r.height),
      visivel: Math.round(Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))),
    };
  }, caso.altura);
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

  // ── 3. O gesto do operador: seis cliques em "Aumentar zoom" ─────────────
  const botao = page.locator('button[aria-label="Aumentar zoom"]').first();
  exigir((await botao.count()) > 0, `${chave}: não achei o botão "Aumentar zoom"`);
  const trilha = [escalaDe(await transform())];
  for (let i = 0; i < 6; i++) {
    await botao.click();
    await page.waitForTimeout(150);
    trilha.push(escalaDe(await transform()));
  }
  await page.waitForTimeout(1500);
  const depoisDeEsperar = escalaDe(await transform());
  trilha.push(depoisDeEsperar);
  for (let i = 1; i < trilha.length; i++) {
    exigir(
      trilha[i] >= trilha[i - 1] - 1e-9,
      `${chave}: o zoom CAIU de ${trilha[i - 1]} para ${trilha[i]} — o gesto do operador foi desfeito`,
    );
  }
  exigir(
    Math.abs(depoisDeEsperar - ZOOM_MAXIMO_DO_CANVAS) < 1e-3,
    `${chave}: seis cliques deveriam chegar ao teto ${ZOOM_MAXIMO_DO_CANVAS}, chegaram a ${depoisDeEsperar}`,
  );

  // ── 4. O modo CARTÃO existe de verdade (altura do nó no DOM) ────────────
  const alturaDoNo = await page.evaluate(() => {
    const n = document.querySelector(".react-flow__node");
    return n ? Math.round(n.getBoundingClientRect().height / (window.devicePixelRatio || 1)) : null;
  });

  // ── 5. Dois pixels não apagam o gesto (achado ALTO #2) ──────────────────
  const zAntesDoResize = escalaDe(await transform());
  // 2px para dentro, sem atravessar o corte de 1024 (atravessar troca o layout
  // inteiro — aí reenquadrar é o certo, e não é isto que se mede aqui).
  const larguraDeRuido = caso.largura - 2 >= 1024 || !caso.desktop ? caso.largura - 2 : caso.largura + 2;
  await page.setViewportSize({ width: larguraDeRuido, height: caso.altura });
  await page.waitForTimeout(1000);
  const zDepoisDoResize = escalaDe(await transform());
  exigir(
    Math.abs(zDepoisDoResize - zAntesDoResize) < 1e-6,
    `${chave}: 2px de resize mudaram o zoom de ${zAntesDoResize} para ${zDepoisDoResize}`,
  );

  // ── 6. …mas um resize DE VERDADE ainda reenquadra ───────────────────────
  const larguraDeVerdade = caso.largura >= 1024 ? 640 : 1280;
  await page.setViewportSize({ width: larguraDeVerdade, height: caso.altura });
  await page.waitForTimeout(1400);
  const zDepoisDeVerdade = escalaDe(await transform());
  exigir(
    zDepoisDeVerdade === null || Math.abs(zDepoisDeVerdade - zAntesDoResize) > 1e-6,
    `${chave}: um resize de ${caso.largura}→${larguraDeVerdade} NÃO reenquadrou (zoom ficou em ${zDepoisDeVerdade})`,
  );

  // ── 7. As camadas e o caminho crítico, no SVG que foi pintado ───────────
  await page.setViewportSize({ width: caso.largura, height: caso.altura });
  await page.waitForTimeout(1200);
  await ligarTodasAsCamadas(page);
  await page.waitForTimeout(800);
  const camadas = await page.evaluate(() => {
    const grupos = [...document.querySelectorAll("g[data-camada]")];
    const porCamada = {};
    for (const g of grupos) {
      const nome = g.getAttribute("data-camada");
      const critica = g.getAttribute("data-critica") === "true";
      const paths = [...g.querySelectorAll("path.lb-edge-path")];
      const alvo = critica ? "critico" : nome;
      porCamada[alvo] ??= { n: 0, traços: 0, cor: null, tracejado: null, glifos: 0 };
      porCamada[alvo].n += 1;
      porCamada[alvo].traços = Math.max(porCamada[alvo].traços, paths.length);
      porCamada[alvo].cor ??= paths[0]?.getAttribute("stroke") ?? null;
      porCamada[alvo].tracejado ??= paths[0]?.getAttribute("stroke-dasharray") ?? null;
      porCamada[alvo].glifos += g.querySelectorAll(".lb-edge-glifo").length;
    }
    return porCamada;
  });
  for (const [nome, cor] of Object.entries(CORES)) {
    const visto = camadas[nome];
    exigir(visto !== undefined && visto.n > 0, `${chave}: nenhuma aresta da camada "${nome}" foi desenhada`);
    if (visto) {
      exigir(
        (visto.cor ?? "").toUpperCase() === cor.toUpperCase(),
        `${chave}: a camada "${nome}" foi pintada em ${visto.cor}, e o contrato é ${cor}`,
      );
    }
  }
  if (camadas.critico) {
    exigir(
      camadas.critico.traços === 3,
      `${chave}: o caminho crítico tem ${camadas.critico.traços} traço(s), e o contrato é o traço TRIPLO`,
    );
  }
  if (camadas.correlacao) {
    exigir(
      (camadas.correlacao.tracejado ?? "") !== "",
      `${chave}: a correlação foi desenhada contínua, e o contrato é pontilhada`,
    );
  }
  if (camadas.sinergia) {
    exigir(
      (camadas.sinergia.tracejado ?? "") !== "",
      `${chave}: a sinergia foi desenhada contínua, e o contrato é pontilhada`,
    );
  }
  if (camadas.obsolescencia) {
    exigir(
      camadas.obsolescencia.glifos > 0,
      `${chave}: a obsolescência foi desenhada sem o glifo ❌`,
    );
  }

  exigir(errosDePagina.length === 0, `${chave}: a página lançou ${errosDePagina.length} erro(s): ${errosDePagina[0] ?? ""}`);

  medicoes[chave] = { hoje, pane, trilha, zAntesDoResize, zDepoisDoResize, zDepoisDeVerdade, alturaDoNo, camadas, errosDePagina };
  await ctx.close();
}

/** A raiz deste pacote — `scripts/` sobe um nível. */
const RAIZ_DO_PACOTE = join(dirname(fileURLToPath(import.meta.url)), "..");

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
 * Devolve `null` se não subir a tempo — nunca um endereço em que não dá para
 * confiar.
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

const browser = await pw.chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
try {
  for (const caso of LARGURAS) await medirUmaLargura(browser, caso);
} finally {
  await browser.close();
  encerrarServidor();
}

const json = JSON.stringify(medicoes, null, 2);
if (process.env.LIFEBOARD_GUARDA_JSON) writeFileSync(process.env.LIFEBOARD_GUARDA_JSON, json);

console.log("── guarda no navegador ────────────────────────────────");
for (const [chave, m] of Object.entries(medicoes)) {
  const linha = [
    chave.padEnd(10),
    `pane ${String(m.pane?.largura ?? "?").padStart(4)}×${String(m.pane?.altura ?? "?").padStart(3)}`,
    `Hoje ${String(m.hoje.visivel).padStart(3)}px`,
    `zoom ${String(m.trilha[0]).slice(0, 6)}→${String(m.trilha[6]).slice(0, 6)}`,
    `resize2px ${String(m.zDepoisDoResize).slice(0, 6)}`,
    `nó ${String(m.alturaDoNo)}px`,
  ].join("  ");
  console.log(linha);
}
if (falhas.length > 0) {
  console.error(`\n${falhas.length} promessa(s) da peça P4 NÃO se sustentam no navegador:`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\ntodas as promessas medidas no navegador se sustentam.");
