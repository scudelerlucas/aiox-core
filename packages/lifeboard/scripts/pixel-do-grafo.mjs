/*
 * Os nomes abaixo NÃO existem neste arquivo: existem dentro dos
 * `page.evaluate(...)`, que o Playwright serializa e roda no CONTEXTO DA
 * PÁGINA, dentro do Chromium. Declarados como globais para o ESLint saber
 * disso — é declaração de ambiente, não silenciamento de regra.
 */
/* global document, getComputedStyle, requestAnimationFrame */
/**
 * OS-LIFEBOARD · P4 — O PIXEL DO GRAFO, NÃO O ATRIBUTO DECLARADO.
 *
 * ## Por que este arquivo existe (achado CRÍTICO da rodada 10)
 *
 * A guarda de navegador da rodada 9 abria o Chromium de verdade, clicava nos
 * botões de verdade — e, na hora de dizer *"a camada X está desenhada"*, lia
 * `stroke`, `stroke-dasharray` e `paths.length` do SVG. Nenhuma das três muda
 * quando alguém aplica transparência. Medido nesta rodada: um `style={{
 * opacity: 0 }}` no `<g>` da aresta (UMA linha em `aresta-svg.tsx`) apagou as
 * cinco camadas, o traço triplo e o ❌ da tela — e os CINCO portões ficaram
 * verdes, inclusive a guarda no navegador, que imprimiu
 * "todas as promessas medidas no navegador se sustentam" sobre um grafo que
 * virou 11 cartões soltos.
 *
 * A cura é a mesma da peça irmã P5 (`tests/navegador/guarda-p5.mjs`), com a
 * régua trocada: lá o desenho é um Gantt de `<div>`s e a amostra é uma coluna
 * de 3px dentro da caixa do elemento; aqui o desenho é SVG — uma linha de 1,5
 * px de tela, que pode ser tracejada, diagonal e ter a caixa quase toda vazia.
 * Amostrar "a caixa" de uma aresta mediria sobretudo o fundo. Então a régua
 * do grafo é outra:
 *
 *   ┌───────────────────────────────────────────────────────────────────────┐
 *   │ 1. A geometria vem do `d` do próprio `<path>`, convertida para        │
 *   │    coordenadas de TELA pelo `getScreenCTM()` — os pontos amostrados   │
 *   │    estão SOBRE o traço, não perto dele.                               │
 *   │ 2. De cada ponto tiram-se DUAS fotos da tela: uma com o elemento e    │
 *   │    outra com ele `visibility: hidden`. Exige-se as duas coisas:       │
 *   │    (a) pixels na cor que o compositor DEVE pintar (a declarada, com   │
 *   │        todo `opacity` da árvore, composta sobre o fundo real), e      │
 *   │    (b) pixels que MUDAM quando o elemento sai.                        │
 *   │ 3. "Não consegui medir" é REPROVAÇÃO, nunca dispensa — checagem       │
 *   │    pulada é checagem aprovada (`display:none` some com a caixa e a    │
 *   │    região amostrada, e o silêncio contaria como sucesso).             │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 * `opacity: 0` cai em (b): a foto com e sem o elemento é idêntica. Fundo
 * pintado da cor da aresta cai em (b) também. Cor trocada cai em (a).
 *
 * ## Propriedade preservada da P5: o decodificador falha FECHADO
 *
 * `lerPng` decodifica com `zlib.inflateSync`. Trocar o `inflateSync` por um
 * decodificador que devolve zeros (quebra SEM lançar) deixa a guarda
 * VERMELHA, não verde: a foto "com" e a foto "sem" viram duas telas pretas
 * idênticas, `mudaram` vai a 0 e `naCor` vai a 0. A prova está no relatório
 * da rodada.
 */

import zlib from "node:zlib";

/** ── PNG → pixels, com `node:zlib` e nada mais (nenhum pacote novo). ────── */
export function lerPng(buffer) {
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
      const bruto = linha[x] ?? 0;
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

/** O pixel `(x, y)` como `[r, g, b]`, ou `null` fora da imagem. */
export function pixelEm(img, x, y) {
  if (x < 0 || y < 0 || x >= img.largura || y >= img.altura) return null;
  const i = (y * img.largura + x) * img.canais;
  if (img.canais >= 3) return [img.dados[i], img.dados[i + 1], img.dados[i + 2]];
  const v = img.dados[i];
  return [v, v, v];
}

/** Distância máxima por canal entre duas cores — tolerância de antialias. */
export function distanciaDeCor(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** `rgb(…)`/`rgba(…)` → `[r, g, b]`. */
export function corEmCanais(css) {
  const n = (String(css).match(/[\d.]+/g) ?? []).map(Number);
  return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0];
}

/**
 * Antialias de um traço de ~1,5px de tela: o pixel do CENTRO fica na cor
 * cheia, os vizinhos ficam a meio caminho do fundo. 20 por canal aceita o
 * centro e recusa um traço pintado de outra cor (a distância entre duas cores
 * de camada deste grafo é ≥ 60 por canal — medido em `checar-contraste.mjs`).
 */
export const TOLERANCIA_DE_COR = 20;

/**
 * Duas fotos da JANELA DE VISÃO inteira: uma com o elemento, outra com ele
 * `visibility: hidden`. Uma foto por estado, e todas as amostras saem delas —
 * é o que permite medir sete arestas sem tirar quatorze screenshots por
 * aresta.
 *
 * `visibility: hidden` (e não `display: none`) de propósito: o elemento
 * continua ocupando a MESMA caixa, então a foto "sem" difere da "com"
 * exatamente nos pixels que ele pintava, e em nenhum outro.
 */
/**
 * Dois quadros de verdade depois de mexer no DOM.
 *
 * P4 rodada 13 (família do achado MÉDIO 9, "a guarda reprova por ambiente"):
 * `page.screenshot({clip})` pode devolver o quadro ANTERIOR quando a máquina
 * está carregada — e aí a foto "sem" sai idêntica à foto "com". O sintoma é
 * inconfundível e foi medido nesta rodada: `0 pixels mudam ao esconder` numa
 * aresta que a MESMA amostra reporta com `364 pixels na cor` dela. Isso não é
 * o produto apagado; é a foto velha.
 *
 * Dois `requestAnimationFrame` encadeados devolvem só DEPOIS que o compositor
 * desenhou o quadro seguinte — é a espera pelo próprio desenho, não um
 * `sleep` calibrado no olho.
 */
async function esperarOProximoQuadro(pagina) {
  /*
   * P4 rodada 14 — a armadilha que a P5 e a P6 já pagaram: sob relógio de
   * mentira (`clock.install()`), o `requestAnimationFrame` da página é
   * SUBSTITUÍDO, e esperar um quadro ali é esperar por uma coisa que só a
   * guarda pode causar — impasse por construção, 60 s de teto por foto. Com o
   * relógio na mão, a guarda CAUSA o quadro em vez de esperar por ele.
   */
  if (pagina.__relogioDeMentira === true) {
    await pagina.clock.runFor(32).catch(() => undefined);
    return;
  }
  await pagina
    .evaluate(
      () =>
        new Promise((resolver) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolver(null)));
        }),
    )
    .catch(() => undefined);
}

export async function fotosComESem(pagina, alvo, janela) {
  const opcoes = janela ? { clip: janela } : undefined;
  let com;
  let sem;
  let anterior = "";
  try {
    await esperarOProximoQuadro(pagina);
    com = lerPng(await pagina.screenshot(opcoes));
    anterior = await alvo.evaluate((el) => {
      const v = el.style.visibility;
      el.style.visibility = "hidden";
      return v;
    });
    await esperarOProximoQuadro(pagina);
    sem = lerPng(await pagina.screenshot(opcoes));
  } catch (e) {
    return { erro: `não consegui fotografar: ${String(e?.message ?? e)}` };
  } finally {
    try {
      await alvo.evaluate((el, v) => {
        el.style.visibility = v;
      }, anterior);
    } catch {
      /* alvo já saiu do DOM; a próxima navegação recria a página */
    }
  }
  if (com.largura !== sem.largura || com.altura !== sem.altura) {
    return { erro: "as duas fotos saíram de tamanhos diferentes — nada comparável" };
  }
  return { com, sem, dx: janela ? janela.x : 0, dy: janela ? janela.y : 0 };
}

/**
 * A JANELA a fotografar em torno de um conjunto de pontos de tela, já presa
 * dentro da janela de visão. Recortar a foto é o que deixa esta guarda medir
 * quatorze elementos por largura sem decodificar quatorze telas de 1920×1080.
 *
 * Devolve `null` quando NADA do alvo cabe na janela de visão — e quem chama
 * trata isso como reprovação, nunca como dispensa.
 */
export function janelaDosPontos(pontos, margem, vista) {
  if (!Array.isArray(pontos) || pontos.length === 0) return null;
  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - margem));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - margem));
  const x1 = Math.min(vista.width, Math.ceil(Math.max(...xs) + margem));
  const y1 = Math.min(vista.height, Math.ceil(Math.max(...ys) + margem));
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * ── A COR PINTADA, E NÃO SÓ "ALGUMA COISA FOI PINTADA" (achado ALTO 1 da
 *    rodada 11) ──────────────────────────────────────────────────────────
 *
 * A rodada 10 exigia, por aresta, só PIXEL QUE MUDA, e a cor cheia era
 * exigida uma vez por PAPEL. Medido pelo crítico: um `filter: hue-rotate`
 * numa aresta de sucessão pintou `rgb(255, 167, 161)` (o vermelho do caminho
 * crítico) onde a cor declarada era `rgb(95, 227, 154)` — 0 de 378 pixels na
 * cor declarada — e os cinco portões ficaram verdes, porque a OUTRA aresta de
 * sucessão pagava a conta do papel inteiro.
 *
 * Exigir "cor cheia em cada aresta" não serve: a 390 px o traço tem menos de
 * 1 px de tela e é antialias puro (medido: 99 pixels que mudam, ZERO na cor
 * cheia), e uma aresta quase toda atrás de um cartão sobra em antialias.
 *
 * A régua que serve nos dois casos não é a cor cheia — é a MISTURA. O que o
 * compositor pinta num pixel é sempre
 *
 *     P = α·C + (1 − α)·B,   α = opacidade do elemento × cobertura do traço
 *
 * com `B` = o pixel do MESMO lugar na foto SEM o elemento (o fundo real, seja
 * o canvas ou um cartão) e `C` = a cor da camada, tirada do CONTRATO. O
 * antialias mexe em α e nada mais; trocar a cor (filter, blend, irmão por
 * cima) tira o pixel da reta B→C. Então mede-se a DISTÂNCIA do pixel até essa
 * reta — não até um ponto.
 *
 * `residuoDeMistura` devolve o α que melhor explica o pixel e o que sobra
 * depois dele. Sobra grande = pintou outra cor.
 */
export function residuoDeMistura(pixel, fundo, cor) {
  const d = [cor[0] - fundo[0], cor[1] - fundo[1], cor[2] - fundo[2]];
  const p = [pixel[0] - fundo[0], pixel[1] - fundo[1], pixel[2] - fundo[2]];
  const den = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  /*
   * Cor da camada indistinguível do fundo naquele pixel: não há reta para
   * projetar. O resíduo vira a mudança inteira — ou seja, um pixel que mudou
   * ali REPROVA. É o comportamento certo: aresta da cor do próprio fundo não
   * é uma aresta que se prova, é uma aresta que se some.
   */
  if (den < 1) return { alfa: null, residuo: Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])) };
  let alfa = (p[0] * d[0] + p[1] * d[1] + p[2] * d[2]) / den;
  if (alfa < 0) alfa = 0;
  if (alfa > 1) alfa = 1;
  const residuo = Math.max(
    Math.abs(p[0] - alfa * d[0]),
    Math.abs(p[1] - alfa * d[1]),
    Math.abs(p[2] - alfa * d[2]),
  );
  return { alfa, residuo };
}

/**
 * Teto do resíduo médio PONDERADO de uma aresta. Ponderado pelo tanto que
 * cada pixel mudou: pixel que quase não mudou quase não vota (é antialias de
 * ponta), pixel de traço cheio manda.
 *
 * Os números medidos nesta rodada, nas CINCO larguras (a corrida completa,
 * não uma amostra):
 *
 * | o que foi medido | resíduo médio |
 * |---|---|
 * | árvore honesta, as 7 arestas × 5 larguras | **0,18 a 1,06** |
 * | `filter: saturate(0)` na obsolescência (variante desta rodada) | **52,9** |
 * | `filter: hue-rotate(-140deg)` na sucessão (sabotagem do crítico) | **128,1** |
 *
 * 24 fica 23× acima do pior caso honesto e 2,2× abaixo da sabotagem mais
 * fraca. (O 20,1 que a sinergia chegava a marcar a 390 px antes era o `<text>`
 * do "%" dentro do grupo, não o traço: o Chromium pinta texto com antialias
 * de subpixel, e franja de cor sai da reta por construção. A guarda passou a
 * medir a cor do traço FORA da caixa do rótulo — ver `caixaDoRotulo` em
 * `guarda-no-navegador.mjs`.)
 */
export const TOLERANCIA_DE_MISTURA = 24;

/**
 * ── A SEGUNDA PERGUNTA: O TRAÇO ESTÁ VISÍVEL? (achado da rodada 12) ───────
 *
 * `residuoDeMistura` responde *"está na cor certa?"* — a distância do pixel
 * até a reta `B→C`. Ela NÃO responde *"dá para ver?"*: o próprio comentário
 * dela diz que "antialias e oclusão só mexem em α (a posição na reta)", e α
 * não era medido em lugar nenhum. Qualquer ponto da reta passava, **α perto
 * de zero inclusive**.
 *
 * Medido pelo coordenador na entrega da rodada 11: `style={{ opacity: 0.12 }}`
 * no `<g>` da aresta (UMA linha em `aresta-svg.tsx`) deixou os CINCO portões
 * verdes com o grafo inteiro quase apagado. Pela mesma conta de
 * `scripts/checar-contraste.mjs`, a aresta de sucessão (`#5FE39A` sobre
 * `navy-950` `#05070F`) cai de **12,40:1** para **1,21:1** — pior que o ALTO 4
 * que a rodada 11 tinha acabado de fechar (1,27:1), e por um portão escrito
 * justamente para pegar aquilo.
 *
 * Por que nenhuma régua antiga via: `checar-contraste.mjs` mede o par de
 * TOKENS DECLARADOS, e a opacidade é aplicada na composição (a cor declarada
 * continua `#5FE39A`; o que chega ao olho é `rgb(16, 33, 32)`). E a régua de
 * "pixels que mudam" é de QUANTIDADE, não de intensidade: a 12% ainda mudam
 * pixels de sobra.
 *
 * A cura mede o que o olho recebe: o contraste WCAG entre o PIXEL COMPOSTO
 * (foto COM o elemento) e o PIXEL DE FUNDO DO MESMO LUGAR (foto SEM). As duas
 * fotos já existem; o que faltava era esta conta. O piso vem de fora — de
 * `scripts/checar-contraste.mjs`, a régua de contraste da casa — para não
 * repetir o vício "a guarda conta a si mesma" que a rodada 11 levou como
 * ALTO 4.
 *
 * A conta é literalmente a de `checar-contraste.mjs` (WCAG 2.x, luminância
 * relativa), com a entrada em canais 0–255 em vez de hex.
 */
const canalLinear = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** Luminância relativa WCAG de `[r, g, b]` em 0–255. */
export function luminanciaRelativa(rgb) {
  return (
    0.2126 * canalLinear(rgb[0] / 255) +
    0.7152 * canalLinear(rgb[1] / 255) +
    0.0722 * canalLinear(rgb[2] / 255)
  );
}

/** Razão de contraste WCAG entre duas cores `[r, g, b]` — 1:1 a 21:1. */
export function razaoDeContraste(a, b) {
  const [claro, escuro] = [luminanciaRelativa(a), luminanciaRelativa(b)].sort((p, q) => q - p);
  return (claro + 0.05) / (escuro + 0.05);
}

/**
 * A amostra em torno de UM ponto de tela: quantos pixels estão na cor que o
 * compositor deve pintar, quantos MUDAM quando o elemento some, e — quando
 * `corDoContrato` é passada — o quanto os pixels que mudaram se afastam da
 * reta "fundo → cor da camada" (ver `residuoDeMistura`).
 *
 * Com `pisoDeContraste`, devolve também as DUAS medidas de visibilidade
 * (rodada 12): o MAIOR contraste que um pixel deste ponto alcança contra o
 * fundo do próprio lugar (`melhorContraste`) e quantos pixels chegam ao piso
 * (`pixeisVisiveis`). É o eixo α, que a régua da reta não mede.
 *
 * `dentro: false` = a janelinha não cabe na foto. Não é dispensa: quem chama
 * conta os pontos medíveis e REPROVA quando nenhum é.
 */
export function amostraNoPonto(fotos, ponto, corEsperada, raio, corDoContrato, pisoDeContraste) {
  const cx = Math.round(ponto.x - (fotos.dx ?? 0));
  const cy = Math.round(ponto.y - (fotos.dy ?? 0));
  const alvo = corEmCanais(corEsperada);
  const alvoDoContrato = corDoContrato ? corEmCanais(corDoContrato) : null;
  let naCor = 0;
  let mudaram = 0;
  let total = 0;
  let melhorDistancia = 255;
  let peso = 0;
  let pesoVezesResiduo = 0;
  let piorResiduoForte = 0;
  let melhorContraste = 1;
  let pixeisVisiveis = 0;
  let alfaPico = 0;
  for (let y = cy - raio; y <= cy + raio; y += 1) {
    for (let x = cx - raio; x <= cx + raio; x += 1) {
      const c = pixelEm(fotos.com, x, y);
      const s = pixelEm(fotos.sem, x, y);
      if (c === null || s === null) continue;
      total += 1;
      const d = distanciaDeCor(c, alvo);
      if (d < melhorDistancia) melhorDistancia = d;
      if (d <= TOLERANCIA_DE_COR) naCor += 1;
      const mudou = distanciaDeCor(c, s);
      if (mudou > 2) {
        mudaram += 1;
        /*
         * O QUE O OLHO RECEBE, pixel a pixel: o composto contra o fundo do
         * MESMO lugar. Não é o token declarado (que a opacidade não muda) nem
         * a cor do contrato (que é o fim da reta) — é o pixel da foto.
         */
        const contraste = razaoDeContraste(c, s);
        if (contraste > melhorContraste) melhorContraste = contraste;
        if (pisoDeContraste !== undefined && contraste >= pisoDeContraste) pixeisVisiveis += 1;
        if (alvoDoContrato !== null) {
          const { alfa, residuo } = residuoDeMistura(c, s, alvoDoContrato);
          /*
           * O α DE PICO: o quanto o elemento chega a cobrir, no melhor pixel
           * desta amostra. É a grandeza que o modelo de mistura calculava e
           * jogava fora — e é ela que uma opacidade de 12% derruba.
           */
          if (alfa !== null && alfa > alfaPico) alfaPico = alfa;
          peso += mudou;
          pesoVezesResiduo += mudou * residuo;
          if (mudou >= 16 && residuo > piorResiduoForte) piorResiduoForte = residuo;
        }
      }
    }
  }
  return {
    naCor,
    mudaram,
    total,
    melhorDistancia,
    dentro: total > 0,
    peso,
    pesoVezesResiduo,
    piorResiduoForte,
    melhorContraste,
    pixeisVisiveis,
    alfaPico,
  };
}

/**
 * O PERFIL PERPENDICULAR ao traço, em passos de meio pixel: `#` = o pixel
 * mudou quando o elemento sumiu, `.` = não mudou, `?` = fora da foto.
 *
 * É com ele que o TRAÇO TRIPLO do caminho crítico deixa de ser
 * `paths.length === 3` (um atributo) e passa a ser o que a tela mostra: uma
 * faixa pintada LARGA, com buracos no meio. Ver `bandasDoPerfil`.
 */
export function perfilPerpendicular(fotos, ponto, normal, raio, passo = 0.5) {
  const marcas = [];
  for (let t = -raio; t <= raio; t += passo) {
    const x = Math.round(ponto.x + normal.x * t - (fotos.dx ?? 0));
    const y = Math.round(ponto.y + normal.y * t - (fotos.dy ?? 0));
    const c = pixelEm(fotos.com, x, y);
    const s = pixelEm(fotos.sem, x, y);
    if (c === null || s === null) {
      marcas.push("?");
      continue;
    }
    marcas.push(distanciaDeCor(c, s) > 2 ? "#" : ".");
  }
  return marcas.join("");
}

/**
 * Do perfil: quantas FAIXAS pintadas separadas existem, e qual a extensão
 * total (do primeiro ao último pixel pintado), em px de tela.
 *
 * Um traço simples dá 1 faixa; a tripla do caminho crítico dá 2 ou 3 (as
 * laterais chegam a encostar na central quando o zoom encolhe a separação),
 * e uma extensão de 2 a 5 vezes a de um traço simples. Por isso a régua do
 * triplo usa as DUAS coisas — número de faixas ≥ 2 E extensão contra a de uma
 * aresta simples MEDIDA NA MESMA TELA — em vez de uma constante escrita aqui.
 */
export function bandasDoPerfil(perfil, passo = 0.5) {
  let bandas = 0;
  let anterior = ".";
  let primeiro = -1;
  let ultimo = -1;
  for (let i = 0; i < perfil.length; i += 1) {
    const atual = perfil[i];
    if (atual === "#") {
      if (anterior !== "#") bandas += 1;
      if (primeiro < 0) primeiro = i;
      ultimo = i;
    }
    anterior = atual;
  }
  const extensao = primeiro < 0 ? 0 : (ultimo - primeiro + 1) * passo;
  const pintados = [...perfil].filter((c) => c === "#").length * passo;
  return { bandas, extensao, pintados, temBuraco: perfil.replace(/^[.?]+|[.?]+$/g, "").includes(".") };
}

/**
 * ── OS AJUDANTES QUE RODAM DENTRO DA PÁGINA ───────────────────────────────
 *
 * Instalados ANTES do carregamento (`addInitScript`) para qualquer `evaluate`
 * poder usá-los. Duas coisas moram aqui:
 *
 * • `corEsperada(el, canal)` — a cor que o compositor DEVE pintar: a
 *   declarada, com o alfa dela vezes toda a cadeia de `opacity` da árvore,
 *   composta sobre o fundo real (subindo até o primeiro ancestral opaco).
 *   Comparar com a cor declarada crua reprovaria uma aresta correta desenhada
 *   com `opacity-90`.
 * • `pontosDaAresta(g)` — a geometria do traço em coordenadas de TELA, tirada
 *   do `d` do próprio `<path>` (a polilinha que `layout-do-grafo.ts` roteou) e
 *   do `getScreenCTM()`. Nunca de `getBoundingClientRect()`: a caixa de uma
 *   aresta em L é quase toda vazia, e amostrar a caixa seria amostrar o fundo.
 */
export const AJUDANTES_NA_PAGINA = `
window.__lbp4 = {
  canais(css) {
    const n = (String(css).match(/[\\d.]+/g) || []).map(Number);
    return [n[0] || 0, n[1] || 0, n[2] || 0, n[3] === undefined ? 1 : n[3]];
  },
  opacidadeAcumulada(el) {
    let o = 1, n = el;
    while (n && n.nodeType === 1) {
      const v = Number.parseFloat(getComputedStyle(n).opacity);
      o *= Number.isFinite(v) ? v : 1;
      n = n.parentElement;
    }
    return o;
  },
  /** Qualquer cor CSS resolvida para rgb/rgba pelo próprio motor. */
  emRgb(css) {
    const cv = document.createElement("canvas").getContext("2d");
    cv.fillStyle = "#000";
    cv.fillStyle = css;
    const v = cv.fillStyle;
    if (typeof v === "string" && v.startsWith("#")) {
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
  /** O fundo REAL atrás do elemento: sobe a árvore compondo alfa e opacity. */
  fundoReal(el) {
    const pilha = [];
    let n = el.parentElement, fundo = null;
    while (n) {
      const c = getComputedStyle(n);
      const cor = this.emRgb(c.backgroundColor);
      const alfa = cor[3] * (Number.parseFloat(c.opacity) || 0);
      if (alfa > 0) {
        pilha.push([cor[0], cor[1], cor[2], Math.min(1, alfa)]);
        if (alfa >= 0.999) { fundo = pilha.pop(); break; }
      }
      n = n.parentElement;
    }
    if (fundo === null) fundo = [5, 10, 23, 1];
    for (let i = pilha.length - 1; i >= 0; i -= 1) fundo = this.compor(pilha[i], fundo);
    return fundo;
  },
  corEsperada(el, canal) {
    const cs = getComputedStyle(el);
    const crua = canal === "stroke" ? cs.stroke : canal === "fill" ? cs.fill : cs.color;
    const bruta = this.emRgb(crua);
    const alfaDoCanal = canal === "stroke"
      ? (Number.parseFloat(cs.strokeOpacity) || 0)
      : canal === "fill" ? (Number.parseFloat(cs.fillOpacity) || 0) : 1;
    const op = this.opacidadeAcumulada(el);
    const c = this.compor(
      [bruta[0], bruta[1], bruta[2], Math.min(1, bruta[3] * op * alfaDoCanal)],
      this.fundoReal(el),
    );
    return "rgb(" + Math.round(c[0]) + ", " + Math.round(c[1]) + ", " + Math.round(c[2]) + ")";
  },
  /** Visibilidade herdada e opacidade acumulada — nunca lidas sozinhas. */
  retrato(el) {
    let visivelHerdado = true, n = el;
    while (n && n.nodeType === 1) {
      const c = getComputedStyle(n);
      if (c.visibility === "hidden" || c.visibility === "collapse" || c.display === "none") {
        visivelHerdado = false;
        break;
      }
      n = n.parentElement;
    }
    return { opacidadeAcumulada: this.opacidadeAcumulada(el), visivelHerdado };
  },
  /**
   * Os DOIS EXTREMOS do traço, em coordenadas de tela — o primeiro e o último
   * vértice do \`d\`. É com eles que o MÉDIO 5 da rodada 11 se fecha: o traço
   * tem de começar no cartão que \`data-origem\` nomeia e terminar no que
   * \`data-destino\` nomeia. Até aqui nenhuma seção comparava as pontas do
   * desenho com os cartões nomeados — e o crítico pintou o ❌ da obsolescência
   * em cima de "Daily standup" enquanto o atributo, a lista acessível e o
   * dado diziam "Arquivar docs antigos".
   */
  extremosDaAresta(path) {
    const ctm = path.getScreenCTM();
    if (!ctm) return null;
    const nums = (path.getAttribute("d") || "").match(/-?\\d+(?:\\.\\d+)?/g);
    if (!nums || nums.length < 4) return null;
    const svg = path.ownerSVGElement;
    const emTela = (i) => {
      const p = svg.createSVGPoint();
      p.x = Number(nums[i]);
      p.y = Number(nums[i + 1]);
      const q = p.matrixTransform(ctm);
      return { x: q.x, y: q.y };
    };
    return { inicio: emTela(0), fim: emTela(nums.length - 2) };
  },
  /** A caixa de tela de cada cartão do canvas, por id da tarefa. */
  caixasDosCartoes() {
    const m = {};
    for (const no of document.querySelectorAll(".react-flow__node[data-id]")) {
      const r = no.getBoundingClientRect();
      m[no.getAttribute("data-id")] = { x: r.x, y: r.y, largura: r.width, altura: r.height };
    }
    return m;
  },
  /**
   * Pontos SOBRE o traço, em coordenadas de tela, com a perpendicular exata
   * do segmento em que cada um cai. Sai do \`d\` do path (a polilinha roteada)
   * e do getScreenCTM — a geometria do produto, não uma aproximação.
   */
  pontosDaAresta(path, quantos) {
    const ctm = path.getScreenCTM();
    if (!ctm) return [];
    const nums = (path.getAttribute("d") || "").match(/-?\\d+(?:\\.\\d+)?/g);
    if (!nums || nums.length < 4) return [];
    const svg = path.ownerSVGElement;
    const vertices = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const p = svg.createSVGPoint();
      p.x = Number(nums[i]);
      p.y = Number(nums[i + 1]);
      const q = p.matrixTransform(ctm);
      vertices.push({ x: q.x, y: q.y });
    }
    const segmentos = [];
    let total = 0;
    for (let i = 0; i + 1 < vertices.length; i += 1) {
      const a = vertices[i], b = vertices[i + 1];
      const comprimento = Math.hypot(b.x - a.x, b.y - a.y);
      if (comprimento < 6) continue;
      segmentos.push({ a: a, b: b, comprimento: comprimento });
      total += comprimento;
    }
    if (segmentos.length === 0 || total === 0) return [];
    const saida = [];
    for (const s of segmentos) {
      /* Pontos proporcionais ao comprimento do segmento — o segmento longo
         ganha mais amostras, e nenhum segmento fica sem nenhuma. Margem de
         6px nas pontas: lá mora o glifo e o canto da curva. */
      const n = Math.max(1, Math.round((quantos * s.comprimento) / total));
      const dx = (s.b.x - s.a.x) / s.comprimento, dy = (s.b.y - s.a.y) / s.comprimento;
      for (let k = 0; k < n; k += 1) {
        const f = (k + 1) / (n + 1);
        const margem = Math.min(6, s.comprimento / 4);
        const l = margem + f * (s.comprimento - 2 * margem);
        saida.push({
          x: s.a.x + dx * l,
          y: s.a.y + dy * l,
          nx: -dy,
          ny: dx,
          comprimentoDoSegmento: s.comprimento,
        });
      }
    }
    return saida;
  },
};
`;
