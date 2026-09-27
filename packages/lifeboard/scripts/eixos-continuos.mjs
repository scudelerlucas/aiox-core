/**
 * OS-LIFEBOARD · P4 rodada 17 — OS EIXOS CONTÍNUOS do produto dos gestos
 * (§22z de `guarda-no-navegador.mjs`), fora da guarda para poder ser testado
 * sem navegador (`tests/unit/eixos-continuos.test.ts`).
 *
 * O ALTO da rodada 17: o eixo do zoom de §22 tinha três valores — o do
 * enquadramento, o piso e o teto. O operador não para em nenhum deles em
 * particular: ele clica "Aumentar zoom" uma, duas, três vezes, ou gira a roda.
 * Uma linha em `v3-edge.tsx` apagou as ligações do cartão selecionado entre
 * 1,2 e 1,6 (dois cliques a partir do enquadramento) com os cinco portões
 * verdes. Forma 3 do vício (universo por convenção): os valores do eixo eram
 * os que a guarda escolheu, não os que o produto oferece.
 *
 * Aqui os valores saem dos GESTOS. Cada gesto do produto multiplica o zoom por
 * um fator que a BIBLIOTECA INSTALADA decide — e o fator é lido do código dela,
 * não escrito aqui:
 *
 *   - botões "Aumentar/Diminuir zoom" → `zoomIn`/`zoomOut` do `@reactflow/core`
 *     (`d3Zoom.scaleBy(…, 1.2)` e `1 / 1.2`);
 *   - roda do mouse → `wheelDelta` do `@reactflow/core` (`-deltaY × 0,002` no
 *     modo pixel) elevado na base que o `d3-zoom` usa (`Math.pow(2, …)`), com a
 *     notch de roda do Chromium (deltaY 100 px, modo pixel — é o que o
 *     navegador entrega por "clique" de roda, e é o que a guarda confere contra
 *     um giro de roda de verdade antes do passeio);
 *   - duplo clique no fundo → `d3-zoom` (`event.shiftKey ? 0.5 : 2`).
 *
 * E as PARTIDAS também saem do produto: o zoom que cada botão de enquadramento
 * dá naquela largura (lido na página), o piso (`ZOOM_MINIMO`) e o teto
 * (`ZOOM_MAXIMO_DO_CANVAS`) — as duas pontas em que o operador "bate" de
 * tanto repetir o gesto, e de onde ele volta por uma sequência nova.
 *
 * O conjunto é FINITO: toda sequência de UM gesto repetido a partir de UMA
 * partida, até bater na ponta. O que fica fora é o contínuo entre os valores
 * (pinça, trackpad, roda de notch diferente, gestos misturados) — e a
 * resolução disso sai impressa: o MAIOR VÃO entre dois valores medidos.
 */

/** A notch de roda do Chromium, em px no modo pixel. Conferida contra um giro de verdade na guarda. */
export const NOTCH_DA_RODA_PX = 100;

/**
 * Os fatores de zoom de cada gesto, lidos do código da biblioteca instalada.
 * Falha com nome — nunca inventa um fator.
 */
export function lerFatoresDoZoomDaLib({ fonteDoCore, fonteDoD3Zoom }) {
  const botaoDentro = /zoomIn:\s*\(options\)\s*=>\s*d3Zoom\.scaleBy\([^)]*\),\s*([\d.]+)\)/.exec(fonteDoCore);
  const botaoFora = /zoomOut:\s*\(options\)\s*=>\s*d3Zoom\.scaleBy\([^)]*\),\s*1\s*\/\s*([\d.]+)\)/.exec(fonteDoCore);
  if (!botaoDentro || !botaoFora) {
    throw new Error("não achei `zoomIn`/`zoomOut` com `d3Zoom.scaleBy(…, fator)` no @reactflow/core instalado — o fator dos botões de zoom não tem de onde sair");
  }
  if (Number(botaoDentro[1]) !== Number(botaoFora[1])) {
    throw new Error(`zoomIn multiplica por ${botaoDentro[1]} e zoomOut divide por ${botaoFora[1]} — os botões não são inversos, e o passeio supõe que sejam`);
  }
  const roda = /event\.deltaMode === 1 \? ([\d.]+) : event\.deltaMode \? ([\d.]+) : ([\d.]+)\)/.exec(fonteDoCore);
  if (!roda) throw new Error("não achei o `wheelDelta` do @reactflow/core — o passo da roda não tem de onde sair");
  const base = /t\.k \* Math\.pow\((\d+(?:\.\d+)?), wheelDelta\.apply/.exec(fonteDoD3Zoom);
  if (!base) throw new Error("não achei `t.k * Math.pow(base, wheelDelta…)` no d3-zoom instalado — a roda não tem base");
  const duplo = /k1 = t0\.k \* \(event\.shiftKey \? ([\d.]+) : ([\d.]+)\)/.exec(fonteDoD3Zoom);
  if (!duplo) throw new Error("não achei o fator do duplo clique (`event.shiftKey ? … : …`) no d3-zoom instalado");
  return {
    botao: Number(botaoDentro[1]),
    rodaPorPixel: Number(roda[3]),
    baseDaRoda: Number(base[1]),
    duploCliqueDentro: Number(duplo[2]),
    duploCliqueFora: Number(duplo[1]),
  };
}

/**
 * Os gestos de zoom que o produto oferece, cada um com o fator de ENTRAR e o
 * de SAIR. `ligados` diz quais o produto deixa ligados (os botões existem na
 * tela; a roda e o duplo clique existem quando o inventário do estado os tem).
 */
export function gestosDoZoom(fatores, ligados) {
  const gestos = [];
  if (ligados.botoes) gestos.push({ nome: "botão", dentro: fatores.botao, fora: 1 / fatores.botao });
  if (ligados.roda) {
    const passo = fatores.rodaPorPixel * NOTCH_DA_RODA_PX;
    gestos.push({
      nome: "roda",
      dentro: Math.pow(fatores.baseDaRoda, passo),
      fora: Math.pow(fatores.baseDaRoda, -passo),
    });
  }
  if (ligados.duploClique) {
    gestos.push({ nome: "duplo clique", dentro: fatores.duploCliqueDentro, fora: fatores.duploCliqueFora });
  }
  return gestos;
}

/** A sequência de UM gesto repetido a partir de `partida`, até bater na ponta (inclusive). */
export function sequenciaDoGesto(partida, fator, piso, teto) {
  const saida = [];
  let z = partida;
  for (let i = 0; i < 200; i += 1) {
    const proximo = Math.max(piso, Math.min(teto, z * fator));
    if (Math.abs(proximo - z) < 1e-9) break;
    saida.push(proximo);
    z = proximo;
    if (proximo === piso || proximo === teto) break;
  }
  return saida;
}

const MESMO_ZOOM = 1e-6;

/** Valores distintos, em ordem (tolerância relativa de 1e-6). */
export function valoresDistintos(lista) {
  const ordenada = [...lista].sort((a, b) => a - b);
  const saida = [];
  for (const v of ordenada) {
    if (saida.length === 0 || Math.abs(v - saida[saida.length - 1]) > MESMO_ZOOM * Math.max(1, v)) saida.push(v);
  }
  return saida;
}

/** O maior vão entre dois valores consecutivos — a resolução declarada do contínuo. */
export function maiorVao(valores) {
  const v = valoresDistintos(valores);
  let maior = 0;
  let onde = null;
  for (let i = 1; i < v.length; i += 1) {
    if (v[i] - v[i - 1] > maior) {
      maior = v[i] - v[i - 1];
      onde = [v[i - 1], v[i]];
    }
  }
  return { vao: maior, entre: onde };
}

/**
 * O PLANO DO PASSEIO DO ZOOM: a lista de trechos que o robô executa, na ordem,
 * e o zoom PREVISTO depois de cada gesto. Cada trecho começa de um lugar que o
 * operador alcança (um botão de enquadramento, ou a ponta em que o trecho
 * anterior bateu) e repete UM gesto até a outra ponta.
 *
 * Por gesto: enquadra → SAI até o piso (a sequência da partida, para baixo)
 * → ENTRA até o teto (a sequência do piso) → SAI até o piso (a do teto) →
 * enquadra de novo → ENTRA até o teto (a da partida, para cima). As
 * sequências do piso e do teto independem do enquadramento: saem uma vez
 * por gesto.
 *
 * `partidas`: [{ acao, z }] — o zoom que cada botão de enquadramento dá.
 */
export function planoDoPasseioDoZoom({ partidas, piso, teto, gestos }) {
  const trechos = [];
  const distintas = [];
  for (const p of partidas) {
    if (!distintas.some((d) => Math.abs(d.z - p.z) <= MESMO_ZOOM * Math.max(1, p.z))) distintas.push(p);
  }
  for (const g of gestos) {
    distintas.forEach((p, i) => {
      trechos.push({ tipo: "enquadrar", acao: p.acao, previsto: p.z });
      trechos.push({ tipo: "gesto", gesto: g.nome, sentido: "fora", partida: `enquadramento "${p.acao}"`, previstos: sequenciaDoGesto(p.z, g.fora, piso, teto) });
      if (i === 0) {
        /* o trecho anterior bateu no piso; se a partida JÁ era o piso, a sequência de saída é vazia e o robô continua nela */
        trechos.push({ tipo: "gesto", gesto: g.nome, sentido: "dentro", partida: "piso", previstos: sequenciaDoGesto(piso, g.dentro, piso, teto) });
        trechos.push({ tipo: "gesto", gesto: g.nome, sentido: "fora", partida: "teto", previstos: sequenciaDoGesto(teto, g.fora, piso, teto) });
      }
      trechos.push({ tipo: "enquadrar", acao: p.acao, previsto: p.z });
      trechos.push({ tipo: "gesto", gesto: g.nome, sentido: "dentro", partida: `enquadramento "${p.acao}"`, previstos: sequenciaDoGesto(p.z, g.dentro, piso, teto) });
    });
  }
  /* O trecho "a partir do piso" só é o piso se o anterior bateu nele — confere. */
  let ondeEsta = null;
  for (const t of trechos) {
    if (t.tipo === "enquadrar") {
      ondeEsta = t.previsto;
      continue;
    }
    if (t.partida === "piso" || t.partida === "teto") {
      const esperado = t.partida === "piso" ? piso : teto;
      if (ondeEsta === null || Math.abs(ondeEsta - esperado) > 1e-9) {
        throw new Error(`o trecho a partir do ${t.partida} não começa no ${t.partida} (o robô está em ${String(ondeEsta)})`);
      }
    }
    if (t.previstos.length > 0) ondeEsta = t.previstos[t.previstos.length - 1];
  }
  const valores = valoresDistintos([
    ...distintas.map((p) => p.z),
    ...trechos.flatMap((t) => (t.tipo === "gesto" ? t.previstos : [])),
  ]);
  return { trechos, valores, partidas: distintas };
}

/**
 * OS CORTES DE LARGURA QUE O PRODUTO DECIDE, lidos do código: as consultas de
 * mídia em JS (`(min-width: Npx)`, `(max-width: Npx)`, o `larguraCorte` do
 * `useEhMobile`), toda comparação com `window.innerWidth` (número ou
 * constante declarada no produto) e os pontos de quebra do Tailwind (os do
 * tema padrão, que o produto não sobrescreve; `rem` vale 16 px).
 */
export function cortesDeLarguraDoCodigo(fontes, telasDoTailwind) {
  const cortes = new Map();
  const anotar = (px, onde) => {
    if (!Number.isFinite(px) || px <= 0) return;
    cortes.set(px, [...(cortes.get(px) ?? []), onde]);
  };
  for (const [arquivo, texto] of Object.entries(fontes)) {
    for (const m of texto.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)) anotar(Number(m[2]) + (m[1] === "max" ? 1 : 0), `${arquivo} (${m[1]}-width: ${m[2]}px)`);
    for (const m of texto.matchAll(/larguraCorte\s*=\s*(\d+)/g)) anotar(Number(m[1]), `${arquivo} larguraCorte = ${m[1]}`);
    /* `window.innerWidth < X`: X é número ou constante declarada em algum arquivo do produto. */
    for (const m of texto.matchAll(/innerWidth\s*(<=?|>=?)\s*([A-Za-z_]\w*|\d+)/g)) {
      let px = Number(m[2]);
      if (!Number.isFinite(px)) {
        const declarada = Object.values(fontes)
          .map((t) => new RegExp(`\\b${m[2]}\\s*=\\s*(\\d+)\\b`).exec(t)?.[1])
          .find((v) => v !== undefined);
        px = Number(declarada);
      }
      anotar(px + (m[1] === "<=" || m[1] === ">" ? 1 : 0), `${arquivo} innerWidth ${m[1]} ${m[2]}`);
    }
  }
  for (const [nome, valor] of Object.entries(telasDoTailwind ?? {})) {
    const m = typeof valor === "string" ? /^([\d.]+)(px|rem)$/.exec(valor) : null;
    const px = m ? Number(m[1]) * (m[2] === "rem" ? 16 : 1) : NaN;
    anotar(px, `tailwind ${nome}: ${String(valor)}`);
  }
  return [...cortes.entries()].sort((a, b) => a[0] - b[0]).map(([px, onde]) => ({ px, onde }));
}

/**
 * A TRILHA DA LARGURA: da menor à maior largura da tabela da guarda, em passos
 * de `passo` px, MAIS os dois lados de cada corte do produto (N−1 e N). A
 * altura anda junto, interpolada entre as larguras vizinhas da tabela (a
 * trilha é a que o operador percorre arrastando a borda da janela de uma
 * largura medida até a próxima).
 */
export function trilhaDaLargura(casos, cortes, passo) {
  const ordem = [...casos].sort((a, b) => a.largura - b.largura);
  const menor = ordem[0].largura;
  const maior = ordem[ordem.length - 1].largura;
  const alturaEm = (w) => {
    for (let i = 1; i < ordem.length; i += 1) {
      const a = ordem[i - 1];
      const b = ordem[i];
      if (w >= a.largura && w <= b.largura) {
        const t = b.largura === a.largura ? 0 : (w - a.largura) / (b.largura - a.largura);
        return Math.round(a.altura + t * (b.altura - a.altura));
      }
    }
    return ordem[ordem.length - 1].altura;
  };
  const larguras = new Set();
  for (let w = menor; w <= maior; w += passo) larguras.add(w);
  larguras.add(maior);
  for (const c of cortes) {
    for (const w of [c.px - 1, c.px]) if (w >= menor && w <= maior) larguras.add(w);
  }
  return [...larguras].sort((a, b) => a - b).map((w) => ({ largura: w, altura: alturaEm(w) }));
}

/**
 * O VEREDITO DE UM TRAVAMENTO DE PÁGINA (achado MÉDIO da rodada 17).
 *
 * "Page crashed" pode ser o produto (um vazamento que estoura o teto de
 * memória da página, um laço que aloca sem fim) ou a máquina (os outros
 * processos comeram a memória e o sistema matou a aba). A régua:
 *
 *   - a prova (a MESMA medida, num navegador NOVO) não travou → "navegador":
 *     o travamento não se repete, não é o produto;
 *   - a prova travou de novo E a máquina tinha memória livre acima do piso
 *     nas DUAS vezes → "produto": travou duas vezes seguidas, com memória
 *     sobrando, no mesmo lugar — quem trava a página é ela mesma;
 *   - a prova travou de novo e a máquina esteve abaixo do piso (ou a memória
 *     não pôde ser lida) → "maquina": não dá para culpar o produto;
 *   - a prova falhou de outro jeito (não travamento) → "outro".
 */
export function julgarTravamento({ primeiro, prova, pisoMb, ehTravamento }) {
  if (prova.erro === null) return "navegador";
  if (!ehTravamento(prova.erro)) return "outro";
  const memorias = [primeiro.memoriaMinimaMb, prova.memoriaMinimaMb];
  if (memorias.some((m) => m === null || m === undefined || !Number.isFinite(m))) return "maquina";
  return Math.min(...memorias) >= pisoMb ? "produto" : "maquina";
}
