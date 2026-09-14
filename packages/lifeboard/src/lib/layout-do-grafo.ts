/**
 * OS-LIFEBOARD · P4f — Layout COMPACTO em linhas + roteamento por CANAIS.
 *
 * Duas correções da rodada 5 vivem aqui, e as duas nasceram de medição do
 * crítico hostil:
 *
 * **D2 — layout compacto (achado ALTO #1).** Até a rodada 4 um rank era UMA
 * fileira: 40 tarefas com 16 raízes viravam uma fileira de 16 cartões
 * (4.096px de mundo) que nenhum zoom legível enquadra. Agora cada rank quebra
 * em LINHAS de no máximo `maxColunas` cartões (6 num pane ≥1024px, 3 abaixo
 * de 640 — `dependency-graph.tsx` mede o pane e passa o número). Dentro do
 * rank: os nós críticos ficam na 1ª linha e centralizados nela; a ordem é
 * estável (por id), nunca a ordem de chegada no array.
 *
 * **D5 — canais (achado ALTO #3).** Até a rodada 4 todas as arestas que
 * cruzavam o mesmo vão usavam a MESMA cota (`midY`): o crítico mediu uma
 * correlação 100% escondida sob uma obsolescência e duas arestas a 0,48px uma
 * da outra. Agora o roteamento é de canal, e o desenho inteiro da aresta sai
 * daqui (o renderer só traça os pontos):
 *   • horizontais só correm dentro de um CORREDOR entre linhas (faixa livre de
 *     cartão), cada aresta numa FAIXA própria de 6px;
 *   • verticais longos só correm dentro de um CORREDOR ENTRE COLUNAS (idem);
 *   • os "pés" que saem/entram na borda do cartão abrem em leque, um por
 *     aresta, dentro da própria largura do cartão.
 * Consequência provável (e provada em `tests/unit/canais-de-aresta.test.ts`):
 * o comprimento de sobreposição COLINEAR entre dois segmentos quaisquer de
 * duas arestas quaisquer é exatamente 0 px, e nenhum segmento entra no
 * retângulo de um cartão alheio.
 *
 * Módulo PURO (sem React/ReactFlow) — a única dependência é `Position`, via
 * `geometria-da-aresta.ts`, para nunca ter duas regras de handle.
 */

import { ladoDeEntrada, ladoDeSaida } from "@/lib/geometria-da-aresta";
import { ALTURA_DO_CARTAO } from "@/types/grafo-v3";

export interface ArestaParaRotear {
  /** Id da aresta VISUAL — duas arestas entre o mesmo par (ex.: sucessão e
   *  correlação de A para B) são objetos distintos e têm de receber canais
   *  distintos; sem o id elas colapsariam numa rota só (o achado #3). */
  id: string;
  origem: string;
  destino: string;
}

export interface LayoutDoGrafoParams {
  /** Todas as tarefas do grafo (nós sem nenhuma aresta entram no rank 0). */
  ids: readonly string[];
  /** União de precedência — MESMA fonte que `caminhoCritico` usa (define o RANK). */
  edges: readonly { origem: string; destino: string }[];
  /** Ids no caminho crítico — 1ª linha do rank, centralizados (D2). */
  criticoIds?: ReadonlySet<string> | readonly string[];
  nodeW?: number;
  nodeH?: number;
  gapX?: number;
  gapY?: number;
  /** Máximo de cartões por linha dentro de um rank (D2). Default 6. */
  maxColunas?: number;
  /**
   * TODAS as arestas visuais (as 6 camadas) a rotear. O RANK continua vindo só
   * de `edges` (misturar sinergia/correlação ali criaria precedência falsa).
   * Ausente = rotea as próprias `edges`.
   */
  todasArestas?: readonly ArestaParaRotear[];
}

export interface NoDoLayout {
  id: string;
  /** Profundidade topológica (0 = raiz sem predecessor). */
  rank: number;
  /** Linha GLOBAL do grid (um rank ocupa 1+ linhas depois da compactação). */
  linha: number;
  /** Coluna do grid dentro da linha (já com o deslocamento de centralização). */
  coluna: number;
  x: number;
  y: number;
}

export interface Ponto {
  x: number;
  y: number;
}

export interface ArestaDoLayout {
  id: string;
  origem: string;
  destino: string;
  /** Rota ortogonal COMPLETA em px de mundo, já com canal/faixa próprios. */
  pontos: Ponto[];
}

export interface ResultadoLayout {
  nodes: Map<string, NoDoLayout>;
  edges: ArestaDoLayout[];
}

const DEFAULTS = {
  nodeW: 200,
  nodeH: ALTURA_DO_CARTAO,
  gapX: 56,
  gapY: 84,
  maxColunas: 6,
} as const;
/** Piso de `gapY` — nunca aceitar menos, mesmo passado por fora. */
const GAP_Y_MINIMO = 60;

/** Largura nominal de uma faixa de canal (D5). */
export const FAIXA_PX = 6;
/** Folga entre a 1ª/última faixa e a borda do cartão que delimita o corredor. */
const MARGEM_DO_CANAL = 6;
/**
 * Quantas faixas um corredor VERTICAL aceita antes de a aresta seguinte
 * procurar o corredor vizinho. O limite existe porque a invariante dura é
 * "nenhum segmento dentro de um cartão": faixas demais num corredor só teriam
 * como caber transbordando para dentro das colunas. Espalhar é a saída certa —
 * corredor lotado empurra para o de ao lado, nunca para cima de um cartão.
 */
const LIMITE_DE_FAIXAS_POR_CORREDOR = 12;
/** Separação nominal entre dois "pés" de aresta na borda do mesmo cartão. */
const PASSO_DO_LEQUE = 7;

/** Rank por caminho mais longo a partir das fontes, com guarda de ciclo. */
function computeRanks(
  ids: readonly string[],
  predsOf: Map<string, string[]>,
): Map<string, number> {
  const memo = new Map<string, number>();
  const visitando = new Set<string>();

  const rank = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visitando.has(id)) return 0; // ciclo → corta, nunca recursão infinita
    visitando.add(id);
    let r = 0;
    for (const p of predsOf.get(id) ?? []) r = Math.max(r, rank(p) + 1);
    visitando.delete(id);
    memo.set(id, r);
    return r;
  };

  for (const id of ids) rank(id);
  return memo;
}

/**
 * Offsets centrados em 0 para `n` itens: passo nominal `passoIdeal`, comprimido
 * (nunca abaixo de `PASSO_MINIMO`) quando não couber em `±meiaLargura`.
 */
function passoQueCabe(total: number, larguraDisponivel: number, passoIdeal: number): number {
  if (total <= 1) return passoIdeal;
  // Sem piso: a faixa se comprime o quanto for preciso para CABER na largura
  // livre. Um piso "mínimo de conforto" seria o caminho mais curto para um
  // segmento acabar dentro de um cartão — exatamente o que este módulo
  // existe para impedir.
  return Math.min(passoIdeal, larguraDisponivel / (total - 1));
}

function offsetsCentrados(n: number, passoIdeal: number, meiaLargura: number): number[] {
  if (n <= 1) return [0];
  const passo = passoQueCabe(n, 2 * meiaLargura, passoIdeal);
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * passo);
}

interface Intervalo {
  inicio: number;
  fim: number;
}

/**
 * Coloração gulosa de intervalos: dois intervalos que se sobrepõem em MAIS DE
 * ZERO px nunca recebem a mesma faixa (encostar ponta com ponta pode — a
 * sobreposição medida continua 0). Entrada já ordenada = saída determinística.
 */
function colorirIntervalos(intervalos: readonly Intervalo[]): number[] {
  const faixaDe: number[] = [];
  const ocupacao: Intervalo[][] = [];
  for (const alvo of intervalos) {
    let faixa = 0;
    for (;; faixa++) {
      const nesta = ocupacao[faixa];
      if (!nesta) {
        ocupacao[faixa] = [];
        break;
      }
      const colide = nesta.some((i) => alvo.inicio < i.fim && i.inicio < alvo.fim);
      if (!colide) break;
    }
    ocupacao[faixa]!.push(alvo);
    faixaDe.push(faixa);
  }
  return faixaDe;
}

/** Remove pontos consecutivos iguais — segmento de comprimento zero nunca entra na rota. */
function semSegmentosZero(pontos: readonly Ponto[]): Ponto[] {
  const saida: Ponto[] = [];
  for (const p of pontos) {
    const anterior = saida[saida.length - 1];
    if (anterior && Math.abs(anterior.x - p.x) < 0.01 && Math.abs(anterior.y - p.y) < 0.01) continue;
    saida.push(p);
  }
  if (saida.length < 2 && saida[0]) saida.push({ ...saida[0] });
  return saida;
}

export function layoutDoGrafo(params: LayoutDoGrafoParams): ResultadoLayout {
  const { ids, edges } = params;
  const nodeW = params.nodeW ?? DEFAULTS.nodeW;
  const nodeH = params.nodeH ?? DEFAULTS.nodeH;
  const gapX = params.gapX ?? DEFAULTS.gapX;
  const gapY = Math.max(params.gapY ?? DEFAULTS.gapY, GAP_Y_MINIMO);
  const maxColunas = Math.max(1, Math.floor(params.maxColunas ?? DEFAULTS.maxColunas));
  const critico =
    params.criticoIds instanceof Set
      ? params.criticoIds
      : new Set(params.criticoIds ?? []);

  const idSet = new Set(ids);
  const predsOf = new Map<string, string[]>();
  for (const { origem, destino } of edges) {
    if (!idSet.has(origem) || !idSet.has(destino)) continue;
    const arr = predsOf.get(destino);
    if (arr) arr.push(origem);
    else predsOf.set(destino, [origem]);
  }

  const ranks = computeRanks(ids, predsOf);

  const porRank = new Map<number, string[]>();
  for (const id of ids) {
    const r = ranks.get(id) ?? 0;
    const balde = porRank.get(r);
    if (balde) balde.push(id);
    else porRank.set(r, [id]);
  }

  // ── D2: cada rank vira 1+ LINHAS de no máximo `maxColunas` cartões ───────
  const nodes = new Map<string, NoDoLayout>();
  const ranksOrdenados = [...porRank.keys()].sort((a, b) => a - b);
  let linhaGlobal = 0;
  for (const r of ranksOrdenados) {
    const doRank = porRank.get(r) ?? [];
    const criticos = doRank.filter((id) => critico.has(id)).sort((a, b) => a.localeCompare(b));
    const comuns = doRank.filter((id) => !critico.has(id)).sort((a, b) => a.localeCompare(b));
    const ordenados = [...criticos, ...comuns];

    for (let inicio = 0; inicio < ordenados.length; inicio += maxColunas) {
      let daLinha = ordenados.slice(inicio, inicio + maxColunas);
      if (inicio === 0 && criticos.length > 0 && criticos.length < daLinha.length) {
        // Críticos CENTRALIZADOS na 1ª linha do rank (D2) — os comuns da
        // mesma linha se repartem à esquerda e à direita deles.
        const outros = daLinha.filter((id) => !critico.has(id));
        const meio = Math.floor(outros.length / 2);
        daLinha = [...outros.slice(0, meio), ...criticos, ...outros.slice(meio)];
      }
      // Centralização da linha no orçamento de colunas — por coluna INTEIRA,
      // para que os corredores verticais entre colunas continuem livres de
      // cartão em TODAS as linhas (é essa invariante que o roteador usa).
      const deslocamento = Math.floor((maxColunas - daLinha.length) / 2);
      daLinha.forEach((id, i) => {
        const coluna = deslocamento + i;
        nodes.set(id, {
          id,
          rank: r,
          linha: linhaGlobal,
          coluna,
          x: coluna * (nodeW + gapX),
          y: linhaGlobal * (nodeH + gapY),
        });
      });
      linhaGlobal++;
    }
  }
  const totalLinhas = linhaGlobal;

  // ── D5: roteamento por canais ────────────────────────────────────────────
  const brutas: readonly ArestaParaRotear[] =
    params.todasArestas ?? edges.map((e) => ({ id: `${e.origem}->${e.destino}`, ...e }));
  const arestas = brutas
    .filter((a) => nodes.has(a.origem) && nodes.has(a.destino))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const topoDaLinha = (linha: number): number => linha * (nodeH + gapY);
  const baseDaLinha = (linha: number): number => topoDaLinha(linha) + nodeH;
  /** Corredor horizontal `g` = vão ACIMA da linha `g` (g = totalLinhas → abaixo da última). */
  const centroDoCorredorH = (g: number): number =>
    g === 0
      ? topoDaLinha(0) - gapY / 2
      : g >= totalLinhas
        ? baseDaLinha(totalLinhas - 1) + gapY / 2
        : (baseDaLinha(g - 1) + topoDaLinha(g)) / 2;
  /** Corredor vertical `c` = vão à ESQUERDA da coluna `c`. */
  const centroDoCorredorV = (c: number): number => c * (nodeW + gapX) - gapX / 2;

  interface Plano {
    aresta: ArestaParaRotear;
    colunaOrigem: number;
    colunaDestino: number;
    corredorSaida: number;
    corredorEntrada: number;
    /** Aresta reta: mesmo corredor horizontal E mesma coluna — um só pé. */
    direta: boolean;
    xSaida: number;
    ySaida: number;
    xEntrada: number;
    yEntrada: number;
    corredorV: number;
  }

  const planos: Plano[] = arestas.map((aresta) => {
    const o = nodes.get(aresta.origem)!;
    const d = nodes.get(aresta.destino)!;
    const saida = ladoDeSaida(nodes, aresta.origem, aresta.destino);
    const entrada = ladoDeEntrada(nodes, aresta.origem, aresta.destino);
    const corredorSaida = saida === "bottom" ? o.linha + 1 : o.linha;
    const corredorEntrada = entrada === "bottom" ? d.linha + 1 : d.linha;
    return {
      aresta,
      colunaOrigem: o.coluna,
      colunaDestino: d.coluna,
      corredorSaida,
      corredorEntrada,
      direta: corredorSaida === corredorEntrada && o.coluna === d.coluna,
      xSaida: o.x + nodeW / 2,
      ySaida: saida === "bottom" ? baseDaLinha(o.linha) : topoDaLinha(o.linha),
      xEntrada: d.x + nodeW / 2,
      yEntrada: entrada === "bottom" ? baseDaLinha(d.linha) : topoDaLinha(d.linha),
      corredorV: 0,
    };
  });

  // (a) Pés em leque, agrupados por (coluna, corredor horizontal). O grupo é a
  //     coluna e não o nó: dois cartões vizinhos (um acima, um abaixo do mesmo
  //     vão) compartilham a mesma faixa de x, e dois pés iguais ali se
  //     sobreporiam em cima um do outro.
  interface Pe {
    chave: string;
    ordem: string;
    aplicar: (offset: number) => void;
  }
  const pes = new Map<string, Pe[]>();
  const registrarPe = (
    coluna: number,
    corredor: number,
    ordem: string,
    aplicar: (offset: number) => void,
  ): void => {
    const chave = `${coluna}|${corredor}`;
    const lista = pes.get(chave);
    const pe: Pe = { chave, ordem, aplicar };
    if (lista) lista.push(pe);
    else pes.set(chave, [pe]);
  };
  const deslocamentoDoPe = new Map<string, { saida: number; entrada: number }>();
  for (const p of planos) deslocamentoDoPe.set(p.aresta.id, { saida: 0, entrada: 0 });
  for (const p of planos) {
    const registro = deslocamentoDoPe.get(p.aresta.id)!;
    if (p.direta) {
      // Um pé só, usado nas duas pontas — é o que mantém a aresta reta entre
      // dois cartões da mesma coluna em linhas vizinhas.
      registrarPe(p.colunaOrigem, p.corredorSaida, `${p.xEntrada}|${p.aresta.id}`, (offset) => {
        registro.saida = offset;
        registro.entrada = offset;
      });
      continue;
    }
    registrarPe(p.colunaOrigem, p.corredorSaida, `${p.xEntrada}|${p.aresta.id}`, (offset) => {
      registro.saida = offset;
    });
    registrarPe(p.colunaDestino, p.corredorEntrada, `${p.xSaida}|${p.aresta.id}`, (offset) => {
      registro.entrada = offset;
    });
  }
  const meiaLarguraDoLeque = nodeW / 2 - 10;
  for (const lista of pes.values()) {
    const ordenada = [...lista].sort((a, b) => a.ordem.localeCompare(b.ordem));
    const offsets = offsetsCentrados(ordenada.length, PASSO_DO_LEQUE, meiaLarguraDoLeque);
    ordenada.forEach((pe, i) => pe.aplicar(offsets[i]!));
  }

  // (b) Corredor vertical de cada aresta que troca de corredor horizontal: o
  //     vão entre colunas mais próximo do meio do percurso.
  // Corredor vertical: o vão entre colunas mais próximo do meio do percurso —
  // e, quando esse já está lotado, o vizinho seguinte. A ocupação é medida
  // com a cota APROXIMADA de cada corredor horizontal (o centro), que já
  // basta para balancear: as faixas exatas saem na etapa (d).
  const ocupacaoDoCorredorV = new Map<number, Intervalo[]>();
  const faixaLivreEm = (corredor: number, intervalo: Intervalo): number => {
    const usados = ocupacaoDoCorredorV.get(corredor) ?? [];
    const conflitantes = usados.filter((i) => intervalo.inicio < i.fim && i.inicio < intervalo.fim);
    return conflitantes.length;
  };
  for (const p of planos) {
    if (p.corredorSaida === p.corredorEntrada && p.colunaOrigem === p.colunaDestino) continue;
    const off = deslocamentoDoPe.get(p.aresta.id)!;
    const alvo = (p.xSaida + off.saida + p.xEntrada + off.entrada) / 2;
    const yA = centroDoCorredorH(p.corredorSaida);
    const yB = centroDoCorredorH(p.corredorEntrada);
    const intervalo = { inicio: Math.min(yA, yB), fim: Math.max(yA, yB) };
    const candidatos = Array.from({ length: maxColunas + 1 }, (_, c) => c).sort((a, b) => {
      const da = Math.abs(centroDoCorredorV(a) - alvo);
      const db = Math.abs(centroDoCorredorV(b) - alvo);
      return da - db || a - b;
    });
    const escolhido =
      candidatos.find((c) => faixaLivreEm(c, intervalo) < LIMITE_DE_FAIXAS_POR_CORREDOR) ??
      candidatos[0]!;
    p.corredorV = escolhido;
    const usados = ocupacaoDoCorredorV.get(escolhido);
    if (usados) usados.push(intervalo);
    else ocupacaoDoCorredorV.set(escolhido, [intervalo]);
  }

  // (c) Faixa horizontal de cada trecho, por corredor.
  interface TrechoH {
    corredor: number;
    intervalo: Intervalo;
    aplicar: (y: number) => void;
  }
  const trechosH = new Map<number, TrechoH[]>();
  const registrarH = (t: TrechoH): void => {
    const lista = trechosH.get(t.corredor);
    if (lista) lista.push(t);
    else trechosH.set(t.corredor, [t]);
  };
  const yDoTrecho = new Map<string, { saida: number; entrada: number }>();
  for (const p of planos) {
    if (p.direta) continue;
    const off = deslocamentoDoPe.get(p.aresta.id)!;
    const registro = { saida: 0, entrada: 0 };
    yDoTrecho.set(p.aresta.id, registro);
    const xPeSaida = p.xSaida + off.saida;
    const xPeEntrada = p.xEntrada + off.entrada;
    if (p.corredorSaida === p.corredorEntrada) {
      const a = Math.min(xPeSaida, xPeEntrada);
      const b = Math.max(xPeSaida, xPeEntrada);
      registrarH({
        corredor: p.corredorSaida,
        intervalo: { inicio: a, fim: b },
        aplicar: (y) => {
          registro.saida = y;
          registro.entrada = y;
        },
      });
      continue;
    }
    // O x exato do trecho vertical só é decidido na etapa (d) (ele também
    // ganha faixa própria dentro do corredor). Para colorir as horizontais
    // ANTES disso sem errar, o intervalo cobre a LARGURA INTEIRA do corredor
    // vertical: assim duas horizontais que terminam no mesmo corredor sempre
    // contam como sobrepostas, não importa em que faixa dele cada uma vá
    // parar. Sem isto, duas horizontais na mesma cota terminavam em faixas
    // vizinhas do mesmo corredor e corriam 6px coladas — foi o que a primeira
    // versão desta rodada ainda deixou passar, e a medição pegou.
    const meiaLarguraDoCorredor = gapX / 2 - MARGEM_DO_CANAL;
    const xCorredorMin = centroDoCorredorV(p.corredorV) - meiaLarguraDoCorredor;
    const xCorredorMax = centroDoCorredorV(p.corredorV) + meiaLarguraDoCorredor;
    registrarH({
      corredor: p.corredorSaida,
      intervalo: {
        inicio: Math.min(xPeSaida, xCorredorMin),
        fim: Math.max(xPeSaida, xCorredorMax),
      },
      aplicar: (y) => {
        registro.saida = y;
      },
    });
    registrarH({
      corredor: p.corredorEntrada,
      intervalo: {
        inicio: Math.min(xPeEntrada, xCorredorMin),
        fim: Math.max(xPeEntrada, xCorredorMax),
      },
      aplicar: (y) => {
        registro.entrada = y;
      },
    });
  }
  for (const [corredor, lista] of trechosH) {
    const ordenada = [...lista].sort(
      (a, b) => a.intervalo.inicio - b.intervalo.inicio || a.intervalo.fim - b.intervalo.fim,
    );
    const faixas = colorirIntervalos(ordenada.map((t) => t.intervalo));
    const total = faixas.length === 0 ? 0 : Math.max(...faixas) + 1;
    const passo = passoQueCabe(total, gapY - 2 * MARGEM_DO_CANAL, FAIXA_PX);
    ordenada.forEach((t, i) => {
      const faixa = faixas[i]!;
      let y: number;
      if (corredor === 0) {
        // Corredor acima da 1ª linha: faixas coladas na fileira (para cima),
        // para não empurrar a moldura do grafo mais do que o necessário.
        y = topoDaLinha(0) - MARGEM_DO_CANAL - faixa * passo;
      } else if (corredor >= totalLinhas) {
        y = baseDaLinha(totalLinhas - 1) + MARGEM_DO_CANAL + faixa * passo;
      } else {
        y = centroDoCorredorH(corredor) + (faixa - (total - 1) / 2) * passo;
      }
      t.aplicar(y);
    });
  }

  // (d) Faixa vertical de cada trecho que atravessa corredores horizontais.
  interface TrechoV {
    corredor: number;
    intervalo: Intervalo;
    aplicar: (x: number) => void;
  }
  const trechosV = new Map<number, TrechoV[]>();
  const xDoCorredor = new Map<string, number>();
  for (const p of planos) {
    if (p.direta || p.corredorSaida === p.corredorEntrada) continue;
    const ys = yDoTrecho.get(p.aresta.id)!;
    const intervalo = {
      inicio: Math.min(ys.saida, ys.entrada),
      fim: Math.max(ys.saida, ys.entrada),
    };
    const lista = trechosV.get(p.corredorV);
    const trecho: TrechoV = {
      corredor: p.corredorV,
      intervalo,
      aplicar: (x) => xDoCorredor.set(p.aresta.id, x),
    };
    if (lista) lista.push(trecho);
    else trechosV.set(p.corredorV, [trecho]);
  }
  for (const [corredor, lista] of trechosV) {
    const ordenada = [...lista].sort(
      (a, b) => a.intervalo.inicio - b.intervalo.inicio || a.intervalo.fim - b.intervalo.fim,
    );
    const faixas = colorirIntervalos(ordenada.map((t) => t.intervalo));
    const total = faixas.length === 0 ? 0 : Math.max(...faixas) + 1;
    const passo = passoQueCabe(total, gapX - 2 * MARGEM_DO_CANAL, FAIXA_PX);
    const centro = centroDoCorredorV(corredor);
    ordenada.forEach((t, i) => t.aplicar(centro + (faixas[i]! - (total - 1) / 2) * passo));
  }

  // (e) A rota, ponto a ponto.
  const arestasLayout: ArestaDoLayout[] = planos.map((p) => {
    const off = deslocamentoDoPe.get(p.aresta.id)!;
    const xPeSaida = p.xSaida + off.saida;
    const xPeEntrada = p.xEntrada + off.entrada;
    const brutos: Ponto[] = [{ x: xPeSaida, y: p.ySaida }];
    if (!p.direta) {
      const ys = yDoTrecho.get(p.aresta.id)!;
      brutos.push({ x: xPeSaida, y: ys.saida });
      if (p.corredorSaida !== p.corredorEntrada) {
        const xv = xDoCorredor.get(p.aresta.id)!;
        brutos.push({ x: xv, y: ys.saida });
        brutos.push({ x: xv, y: ys.entrada });
      }
      brutos.push({ x: xPeEntrada, y: ys.entrada });
    }
    brutos.push({ x: xPeEntrada, y: p.yEntrada });
    return {
      id: p.aresta.id,
      origem: p.aresta.origem,
      destino: p.aresta.destino,
      pontos: semSegmentosZero(brutos),
    };
  });

  return { nodes, edges: arestasLayout };
}
