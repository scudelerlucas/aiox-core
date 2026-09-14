/**
 * OS-LIFEBOARD · P4g — Layout COMPACTO em linhas + roteamento por CANAIS.
 *
 * **D2 — layout compacto (rodada 5, achado ALTO #1).** Um rank não é uma
 * fileira: quebra em LINHAS de no máximo `maxColunas` cartões (6 num pane
 * ≥1024px, 3 abaixo de 640). Dentro do rank os críticos ficam na 1ª linha e
 * centralizados; a ordem é estável (por id).
 *
 * **D5 — canais (rodada 5, achado ALTO #3).** Horizontais só correm dentro de
 * um CORREDOR entre linhas, verticais dentro de um CORREDOR entre colunas, e
 * os "pés" abrem em leque na borda do cartão. Consequência provada em
 * `tests/unit/canais-de-aresta.test.ts` e `caminho-ortogonal.test.ts`: duas
 * arestas nunca correm coladas e nenhum segmento entra num cartão alheio.
 *
 * **D3 da rodada 6 (achado ALTO #3) — uma régua só, e ela manda no corredor.**
 * O passo do canal era `FAIXA_PX = 6`, um número escolhido à mão, enquanto a
 * banda da tripla do caminho crítico media 10px de mundo: a tripla passava POR
 * CIMA da vizinha (o crítico achou uma aresta verde pintada DENTRO dela). Duas
 * mudanças:
 *   1. `FAIXA_PX` agora é CALCULADO — a banda mais larga
 *      (`larguraDaBandaMaisLarga`, em `geometria-da-aresta.ts`) mais uma folga.
 *   2. O corredor CABE o passo: quantas faixas um corredor vertical aceita sai
 *      da largura dele (`limiteDeFaixasPorCorredor`), e quando nem espalhando
 *      cabe, o próprio vão CRESCE (`gapX`/`gapY` efetivos, devolvidos no
 *      resultado). Comprimir a faixa até caber era o que punha duas arestas a
 *      1,26px de mundo uma da outra (achado BAIXO #12) — 0,63px de tela no
 *      zoom mínimo, isto é, a mesma linha.
 *
 * Módulo PURO (sem React/ReactFlow).
 */

import { larguraDaBandaMaisLarga, ladoDeEntrada, ladoDeSaida } from "@/lib/geometria-da-aresta";
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
  /**
   * Vãos EFETIVOS (D3 da rodada 6). Podem ser maiores que os pedidos quando um
   * corredor precisa de mais faixas do que caberia no vão nominal — quem
   * enquadra o grafo precisa do número real para calcular a caixa.
   */
  gapX: number;
  gapY: number;
  /** Quantas LINHAS o grid tem (a caixa do grafo sai daqui + `nodeH`). */
  totalLinhas: number;
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

/** Folga entre a banda de uma faixa e a da faixa vizinha (px de mundo). */
export const FOLGA_ENTRE_BANDAS = 2;
/**
 * Passo do canal, em px de MUNDO: a banda mais larga (a tripla do caminho
 * crítico) mais a folga. Nunca um número escolhido à mão — se algum dia a
 * tripla engordar, o canal engorda junto (`tests/unit/banda-da-aresta.test.ts`).
 */
export const FAIXA_PX = larguraDaBandaMaisLarga() + FOLGA_ENTRE_BANDAS;
/** Folga entre a 1ª/última faixa e a borda do cartão que delimita o corredor. */
const MARGEM_DO_CANAL = 6;
/**
 * Separação nominal entre dois "pés" de aresta na borda do mesmo cartão — a
 * MESMA régua do canal (D3 da rodada 6). Dois pés vizinhos produzem dois
 * segmentos paralelos colados no cartão; separá-los por menos que o passo do
 * canal seria abrir, na borda, exatamente a colisão de banda que o canal
 * fecha. Comprime quando o leque não couber na largura do cartão — ali o piso
 * é a própria borda: um pé fora dela sairia do cartão.
 */
const PASSO_DO_LEQUE = FAIXA_PX;

/**
 * Quantas faixas cabem num corredor de largura `vao` SEM comprimir o passo.
 * Corredor cheio empurra a aresta seguinte para o corredor vizinho — nunca
 * para cima de um cartão, e nunca para uma faixa mais estreita que a banda.
 */
export function limiteDeFaixasPorCorredor(vao: number): number {
  const util = vao - 2 * MARGEM_DO_CANAL;
  return Math.max(1, Math.floor(util / FAIXA_PX) + 1);
}

/** Vão mínimo que comporta `faixas` faixas de `FAIXA_PX` com as duas margens. */
function vaoQueComporta(faixas: number): number {
  return Math.max(0, faixas - 1) * FAIXA_PX + 2 * MARGEM_DO_CANAL;
}

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
 * quando não couber em `±meiaLargura`. Sem piso: é o LEQUE na borda do cartão,
 * e um piso ali empurraria o pé para fora da largura do próprio cartão.
 */
function passoQueCabe(total: number, larguraDisponivel: number, passoIdeal: number): number {
  if (total <= 1) return passoIdeal;
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

/** Posição de grade de um nó — independente de `nodeH`/`gap` (é só rank/linha/coluna). */
interface CelulaDoGrid {
  id: string;
  rank: number;
  linha: number;
  coluna: number;
}

interface Passada {
  nodes: Map<string, NoDoLayout>;
  edges: ArestaDoLayout[];
  /** Maior número de faixas exigido por um corredor horizontal / vertical. */
  maxFaixasH: number;
  maxFaixasV: number;
}

export function layoutDoGrafo(params: LayoutDoGrafoParams): ResultadoLayout {
  const { ids, edges } = params;
  const nodeW = params.nodeW ?? DEFAULTS.nodeW;
  const nodeH = params.nodeH ?? DEFAULTS.nodeH;
  const gapXPedido = params.gapX ?? DEFAULTS.gapX;
  const gapYPedido = Math.max(params.gapY ?? DEFAULTS.gapY, GAP_Y_MINIMO);
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
  //    A GRADE (rank/linha/coluna) não depende de vão nenhum — por isso é
  //    calculada uma vez só, fora do laço que ajusta `gapX`/`gapY`.
  const grade: CelulaDoGrid[] = [];
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
        grade.push({ id, rank: r, linha: linhaGlobal, coluna: deslocamento + i });
      });
      linhaGlobal++;
    }
  }
  const totalLinhas = linhaGlobal;

  const brutas: readonly ArestaParaRotear[] =
    params.todasArestas ?? edges.map((e) => ({ id: `${e.origem}->${e.destino}`, ...e }));

  /**
   * Uma passada completa de roteamento com um par de vãos. Devolve, além das
   * rotas, quantas faixas o corredor mais carregado exigiu — é o que o laço de
   * fora usa para decidir se o vão precisa crescer.
   */
  const montar = (gapX: number, gapY: number): Passada => {
    const nodes = new Map<string, NoDoLayout>();
    for (const c of grade) {
      nodes.set(c.id, {
        id: c.id,
        rank: c.rank,
        linha: c.linha,
        coluna: c.coluna,
        x: c.coluna * (nodeW + gapX),
        y: c.linha * (nodeH + gapY),
      });
    }

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

    // (a) Pés em leque, agrupados por (coluna, corredor horizontal).
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

    // (b) Corredor vertical de cada aresta que troca de corredor horizontal.
    //     O limite de faixas por corredor sai da LARGURA do vão (D3 da rodada
    //     6): corredor cheio empurra para o vizinho, e só quando nem
    //     espalhando cabe é que o vão inteiro cresce (laço de fora).
    const limiteV = limiteDeFaixasPorCorredor(gapX);
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
      const escolhido = candidatos.find((c) => faixaLivreEm(c, intervalo) < limiteV) ?? candidatos[0]!;
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
      // O x exato do trecho vertical só é decidido na etapa (d). Para colorir
      // as horizontais ANTES disso sem errar, o intervalo cobre a LARGURA
      // INTEIRA do corredor vertical.
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
    let maxFaixasH = 0;
    for (const [corredor, lista] of trechosH) {
      const ordenada = [...lista].sort(
        (a, b) => a.intervalo.inicio - b.intervalo.inicio || a.intervalo.fim - b.intervalo.fim,
      );
      const faixas = colorirIntervalos(ordenada.map((t) => t.intervalo));
      const total = faixas.length === 0 ? 0 : Math.max(...faixas) + 1;
      if (total > maxFaixasH) maxFaixasH = total;
      const passo = passoQueCabe(total, gapY - 2 * MARGEM_DO_CANAL, FAIXA_PX);
      ordenada.forEach((t, i) => {
        const faixa = faixas[i]!;
        let y: number;
        if (corredor === 0) {
          // Corredor acima da 1ª linha: faixas coladas na fileira (para cima).
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
    let maxFaixasV = 0;
    for (const [corredor, lista] of trechosV) {
      const ordenada = [...lista].sort(
        (a, b) => a.intervalo.inicio - b.intervalo.inicio || a.intervalo.fim - b.intervalo.fim,
      );
      const faixas = colorirIntervalos(ordenada.map((t) => t.intervalo));
      const total = faixas.length === 0 ? 0 : Math.max(...faixas) + 1;
      if (total > maxFaixasV) maxFaixasV = total;
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

    return { nodes, edges: arestasLayout, maxFaixasH, maxFaixasV };
  };

  // ── O vão CRESCE até o passo do canal caber inteiro (D3 da rodada 6) ──────
  //    Comprimir a faixa foi o que pôs duas arestas a 1,26px de mundo uma da
  //    outra. Quando o corredor mais carregado não comporta o passo nominal,
  //    o vão inteiro aumenta e TODAS as faixas voltam a ter `FAIXA_PX`.
  let gapX = gapXPedido;
  let gapY = gapYPedido;
  let passada = montar(gapX, gapY);
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const gapYNecessario = Math.max(gapYPedido, vaoQueComporta(passada.maxFaixasH));
    const gapXNecessario = Math.max(gapXPedido, vaoQueComporta(passada.maxFaixasV));
    if (gapYNecessario <= gapY && gapXNecessario <= gapX) break;
    gapY = Math.max(gapY, gapYNecessario);
    gapX = Math.max(gapX, gapXNecessario);
    passada = montar(gapX, gapY);
  }

  return { nodes: passada.nodes, edges: passada.edges, gapX, gapY, totalLinhas };
}
