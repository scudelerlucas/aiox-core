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
 * | A | cor e largura COMPUTADAS da faixa do "Hoje" | alfa > 0, ≥ 2px, altura > 0 |
 * | B | área da folha inferior sobre a linha tocada, a 390×844 | 0 px² nas 3 últimas linhas |
 * | C | a gaveta nunca se contradiz: marca "sem estimativa" × datas no Período | 0 intervalos |
 * | D | contraste computado do rótulo riscado | ≥ 4,5:1 |
 * | E | ordem vertical das barras de assunto | `left` nunca desce |
 * | F | fechar a gaveta não mexe a página | Δ`scrollY` = 0 |
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
  const pagina = await contexto.newPage();
  await pagina.goto(ROTA, { waitUntil: "networkidle" });
  await pagina.waitForSelector(".lb-tl-hoje", { timeout: 20000 });
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

// ── A · a faixa do "Hoje", medida como o navegador a pinta ──────────────────
for (const [largura, altura] of [
  [1440, 1000],
  [390, 844],
]) {
  const { contexto, pagina } = await abrir(largura, altura);
  const faixas = await pagina.$$eval(".lb-tl-hoje", (els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        cor: cs.borderLeftColor,
        largura: Number.parseFloat(cs.borderLeftWidth),
        altura: r.height,
      };
    }),
  );
  const visiveis = faixas.filter(
    (f) => corEmCanais(f.cor)[3] > 0 && f.largura >= 2 && f.altura > 0,
  );
  conferir(
    `A · faixa do "Hoje" visível a ${largura}×${altura}`,
    faixas.length > 0 && visiveis.length === faixas.length,
    `${visiveis.length}/${faixas.length} faixas com alfa > 0, ≥ 2px e altura > 0 — ${faixas
      .map((f) => `${f.cor} ${f.largura}px × ${Math.round(f.altura)}px`)
      .join(" · ")}`,
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
    await pagina.waitForSelector(".lb-tl-hoje");
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

// ── C · a gaveta nunca se contradiz sobre o período ─────────────────────────
{
  const { contexto, pagina } = await abrir(1440, 1000);
  const rotulos = await pagina.$$eval('button[aria-haspopup="dialog"]', (els) =>
    els.map((el) => el.getAttribute("aria-label") ?? "").filter((r) => !r.includes("assunto em ")),
  );
  const contradicoes = [];
  let abertas = 0;
  for (const rotulo of rotulos) {
    const botao = pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first();
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
  }
  conferir(
    "C · a gaveta não imprime intervalo de datas para tarefa sem estimativa",
    contradicoes.length === 0,
    contradicoes.length === 0
      ? `${abertas} gavetas abertas, 0 contradições`
      : contradicoes.join(" · "),
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

// ── E · a ordem vertical das barras de assunto ──────────────────────────────
{
  const { contexto, pagina } = await abrir(1440, 1000);
  const titulos = await pagina.$$eval('button[aria-haspopup="dialog"]', (els) =>
    els
      .map((el) => el.getAttribute("aria-label") ?? "")
      .filter((r) => r.includes("— assunto em "))
      .map((r) => r.split(" — assunto")[0]),
  );
  const lefts = await pagina.evaluate((nomes) => {
    const barras = [...document.querySelectorAll("[title]")].filter((e) => e.tagName !== "BUTTON");
    return nomes.map((nome) => {
      const el = barras.find((e) => (e.getAttribute("title") ?? "").startsWith(`${nome} —`));
      return el ? Number(el.getBoundingClientRect().left.toFixed(2)) : null;
    });
  }, titulos);
  const medidos = lefts.filter((x) => x !== null);
  const inversoes = medidos.filter((x, i) => i > 0 && x < medidos[i - 1]).length;
  conferir(
    "E · barras de assunto em ordem de data de início (o `left` nunca desce)",
    medidos.length > 1 && inversoes === 0,
    `${medidos.length} barras medidas, ${inversoes} inversões — ${medidos.join(" · ")}`,
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
    await pagina.waitForSelector(".lb-tl-hoje");
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

await navegador.close();
encerrarServidor();

console.log("%s", medidas.join("\n"));
if (falhas.length > 0) {
  console.error("%s", `\n${String(falhas.length)} medida(s) fora da régua: ${falhas.join(" | ")}`);
  process.exit(1);
}
console.log("%s", `\n${String(medidas.length)} medidas no Chromium, todas dentro da régua.`);
