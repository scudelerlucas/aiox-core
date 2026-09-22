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
 * | G | o chip do período inteiro ou ausente, com o ano na tela | 0 cacos, 0 sem ano |
 * | H | **cada barra no pixel que a sua data manda** | ±1,5 px contra a régua desenhada |
 * | I | **o PAR real de cada texto visível** (cor computada × fundo composto) | ≥ 4,5:1 (3:1 texto grande) |
 * | J | **barra só existe com duas datas declaradas no próprio texto** | 0 barras sem data, 0 linhas sem dado na grade |
 * | K | **abrir a gaveta não re-escala o eixo** | Δ`px/dia` = 0 e Δ`left` da barra tocada = 0 |
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
 * Lê, de dentro da página, a RÉGUA desenhada e a geometria de cada barra —
 * tudo em coordenadas do CONTEÚDO do painel (`rect` real + `scrollLeft`),
 * nunca `style.left` (que seria o valor escrito, não o pintado).
 */
async function lerGeometria(pagina) {
  return await pagina.evaluate(() => {
    const painel = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
    if (!painel) return null;
    const pr = painel.getBoundingClientRect();
    const cx = (el) => {
      const r = el.getBoundingClientRect();
      return {
        esquerda: r.left - pr.left + painel.scrollLeft,
        centro: (r.left + r.right) / 2 - pr.left + painel.scrollLeft,
        largura: r.width,
      };
    };
    const guias = [...painel.querySelectorAll(".lb-tl-guia-semana")]
      .map((e) => cx(e).esquerda)
      .sort((a, b) => a - b);
    const faixaHoje = painel.querySelector(".lb-tl-hoje[data-lb-hoje]");
    const barras = [...painel.querySelectorAll("[data-lb-barra]")].map((e) => ({
      tipo: e.getAttribute("data-lb-barra"),
      ancora: "esquerda",
      title: e.getAttribute("title") ?? "",
      ...cx(e),
    }));
    const pontuais = [
      ...painel.querySelectorAll(".lb-tl-marco, .lb-tl-ponto-concluida"),
    ].map((e) => ({
      tipo: e.classList.contains("lb-tl-marco") ? "marco" : "ponto",
      ancora: "centro",
      title: e.getAttribute("title") ?? "",
      ...cx(e),
    }));
    /* A etiqueta de "fora da grade" da coluna de rótulos, com o nome da linha. */
    const foraDaGrade = [...document.querySelectorAll(".lb-tl-fora-da-grade")].map((e) => ({
      motivo: (e.textContent ?? "").trim(),
      titulo: (e.parentElement?.querySelector("span")?.textContent ?? "").trim(),
    }));
    return {
      guias,
      xHoje: faixaHoje ? cx(faixaHoje).esquerda : null,
      hojeIso: faixaHoje?.getAttribute("data-lb-hoje") ?? null,
      larguraTotal: painel.scrollWidth,
      barras: [...barras, ...pontuais],
      foraDaGrade,
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
  return {
    pxPorDia,
    xDe: (br) => g.xHoje + ((epochDeBr(br) - hojeEpoch) / MS_DIA) * pxPorDia,
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
  const regua = montarRegua(g);
  if (regua.erro) return { contexto, falhou: true, detalhe: `régua indisponível: ${regua.erro}` };
  const piores = [];
  const semData = [];
  let conferidas = 0;
  for (const b of g.barras) {
    const d = datasDoTitulo(b.title, g.hojeIso);
    if (!d.parDeDatas) {
      semData.push(`"${b.title.slice(0, 50)}"`);
      continue;
    }
    const alvo = regua.xDe(b.inicio ?? d.inicio);
    const medido = b.ancora === "centro" ? b.centro : b.esquerda;
    const erro = Math.abs(medido - regua.xDe(d.inicio));
    conferidas += 1;
    if (erro > TOLERANCIA_PX) {
      piores.push(
        `${b.title.slice(0, 44)} — ${b.ancora} medida ${medido.toFixed(2)}, a data ${d.inicio} manda ${regua
          .xDe(d.inicio)
          .toFixed(2)} (${(erro / regua.pxPorDia).toFixed(2)} dia de erro)`,
      );
    }
    void alvo;
    // O COMPRIMENTO também é uma afirmação sobre datas. Pulado só quando a
    // barra é cortada pelo fim do eixo (aí o clamp é declarado no texto).
    if (b.ancora === "esquerda" && !/depois do fim da janela/.test(b.title)) {
      const larguraDaData = regua.xDe(d.fim) - regua.xDe(d.inicio);
      const esperada = Math.max(PISO_BARRA_PX, larguraDaData);
      if (Math.abs(b.largura - esperada) > TOLERANCIA_PX) {
        piores.push(
          `${b.title.slice(0, 44)} — largura ${b.largura.toFixed(2)}, as datas mandam ${esperada.toFixed(2)}`,
        );
      }
    }
  }
  return {
    contexto,
    falhou: piores.length > 0 || semData.length > 0 || regua.desalinhadas.length > 0,
    conferidas,
    pxPorDia: regua.pxPorDia,
    detalhe:
      piores.length === 0 && semData.length === 0 && regua.desalinhadas.length === 0
        ? `${String(conferidas)} barras conferidas a ${regua.pxPorDia.toFixed(3)} px/dia (régua: ${String(
            g.guias.length,
          )} guias de segunda + a faixa de ${g.hojeIso}), 0 fora de ±${String(TOLERANCIA_PX)} px`
        : [
            regua.desalinhadas.length > 0
              ? `guias fora da conta: ${regua.desalinhadas.join(" · ")}`
              : null,
            semData.length > 0 ? `barra sem par de datas no texto: ${semData.join(" · ")}` : null,
            ...piores,
          ]
            .filter(Boolean)
            .join(" · "),
    foraDaGrade: g.foraDaGrade,
    titulosDeBarra: g.barras.map((b) => b.title),
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
  const barraAlvo = antes.barras.find((b) => b.ancora === "esquerda");
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
  const mesmaBarra = depois.barras.find((b) => b.title === barraAlvo?.title);
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
{
  const { contexto, pagina } = await abrir(1440, 1000);

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
  cenas.push({ nome: "tela sem gaveta", amostras: await medirTextos() });

  const rotulos = await pagina.$$eval('button[aria-haspopup="dialog"]', (els) =>
    els.map((el) => el.getAttribute("aria-label") ?? ""),
  );
  const daTarefa = rotulos.find((r) => !r.includes("— assunto em "));
  const doAssunto = rotulos.find((r) => r.includes("— assunto em "));
  for (const [nome, rotulo] of [
    ["gaveta de tarefa", daTarefa],
    ["gaveta de assunto", doAssunto],
  ]) {
    if (!rotulo) continue;
    await pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first().click();
    await pagina.waitForSelector("[data-lb-detalhe]");
    await pagina.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    );
    cenas.push({ nome, amostras: await medirTextos() });
  }

  const reprovados = [];
  let medidos = 0;
  let emGaveta = 0;
  let pior = { r: 99, texto: "", cor: "", fundo: "" };
  for (const cena of cenas) {
    for (const a of cena.amostras) {
      const r = razao(a.canaisCor, a.canaisFundo);
      medidos += 1;
      if (a.onde === "gaveta") emGaveta += 1;
      if (r < pior.r) pior = { r, texto: a.texto, cor: a.cor, fundo: a.fundo };
      if (r < a.minimo) {
        reprovados.push(
          `[${cena.nome}] "${a.texto}" ${r.toFixed(2)}:1 (min ${String(a.minimo)}) — ${a.cor} sobre ${a.fundo}`,
        );
      }
    }
  }
  conferir(
    "I · todo texto visível medido contra o fundo REAL (as 2 gavetas abertas)",
    medidos > 0 && emGaveta > 0 && reprovados.length === 0,
    reprovados.length === 0
      ? `${String(medidos)} nós de texto em ${String(cenas.length)} cenas (${String(
          emGaveta,
        )} dentro das gavetas) — pior ${pior.r.toFixed(2)}:1 em "${pior.texto}" (${pior.cor} sobre ${pior.fundo})`
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
