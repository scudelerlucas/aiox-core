/**
 * OS-LIFEBOARD · P4g — onde o rótulo de % da sinergia pode ficar (achado
 * MÉDIO #5 do crítico hostil ROUND 6).
 *
 * O que ele mediu: o rótulo era desenhado SEMPRE no ponto médio do segmento
 * mais longo, sem olhar para nada em volta — 1 par sobreposto de 195 a 228px²
 * ("35%35%" lido como um número só), 4 a 5 rótulos por cima de cartões (até
 * 106px²) e 1 cortado pela borda a 390px.
 *
 * A cura é a MESMA disciplina do eixo da P5: um COLOCADOR único, puro, que
 * tenta candidatos ao longo do próprio caminho e RECUSA por colisão — com
 * outro rótulo já colocado e com o retângulo de qualquer cartão. Sem lugar
 * livre, o rótulo não é desenhado: o valor continua no `aria-label`/`title` da
 * aresta, que teclado e leitor de tela alcançam. Rótulo ilegível não é
 * informação; é ruído com aparência de informação.
 */

import type { Ponto } from "@/lib/layout-do-grafo";

export interface Retangulo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PedidoDeRotulo {
  id: string;
  /** Rota da aresta, em px de mundo. */
  pontos: readonly Ponto[];
  /** Caixa do texto, em px de mundo (estimada pela fonte e pelo nº de caracteres). */
  largura: number;
  altura: number;
}

/**
 * Frações do comprimento do caminho tentadas, na ordem. O meio primeiro (onde
 * o rótulo sempre esteve, quando dá); depois pontos cada vez mais perto das
 * pontas, alternando os lados para não empilhar tudo numa metade.
 */
export const FRACOES_CANDIDATAS = [0.5, 0.38, 0.62, 0.27, 0.73, 0.18, 0.82] as const;

/**
 * Afastamento perpendicular do rótulo em relação ao próprio traço, em px de
 * MUNDO (achado BAIXO 13 do crítico hostil, rodada 13).
 *
 * O que ele viu: *"o rótulo '50%' da sinergia é desenhado em cima do próprio
 * traço tracejado (o colocador desvia de cartões, não de arestas)"*. E era
 * estrutural: o candidato nasce de `pontoNaFracao`, que é um ponto SOBRE a
 * polilinha — então o texto ficava sempre em cima da linha que ele descreve,
 * com o tracejado atravessando os dígitos.
 *
 * O valor é o AR ALÉM da caixa do texto, não a distância total: o colocador
 * soma `0,8 × altura` (a parte da caixa que fica acima da linha de base, que é
 * como o `<text>` do SVG se desenha) para que os DOIS lados do traço fiquem
 * livres — um número fixo de distância total serviria para um lado e deixaria
 * o outro encostado, e o colocador precisa dos dois para ter alternativa.
 */
export const AFASTAMENTO_DO_ROTULO_MUNDO = 5;

/** Ponto a uma fração do comprimento total da polilinha. */
export function pontoNaFracao(pontos: readonly Ponto[], fracao: number): Ponto {
  const lista = pontos.length > 0 ? pontos : [{ x: 0, y: 0 }];
  if (lista.length === 1) return { ...lista[0]! };
  let total = 0;
  for (let i = 0; i < lista.length - 1; i++) {
    total += Math.hypot(lista[i + 1]!.x - lista[i]!.x, lista[i + 1]!.y - lista[i]!.y);
  }
  if (total === 0) return { ...lista[0]! };
  const alvo = total * Math.min(Math.max(fracao, 0), 1);
  let andado = 0;
  for (let i = 0; i < lista.length - 1; i++) {
    const a = lista[i]!;
    const b = lista[i + 1]!;
    const comprimento = Math.hypot(b.x - a.x, b.y - a.y);
    if (andado + comprimento >= alvo) {
      const t = comprimento === 0 ? 0 : (alvo - andado) / comprimento;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    andado += comprimento;
  }
  return { ...lista[lista.length - 1]! };
}

/**
 * A NORMAL (unitária) do segmento em que a fração cai. É por ela que o rótulo
 * sai de cima do próprio traço, para o lado — ver `AFASTAMENTO_DO_ROTULO_MUNDO`.
 * Polilinha degenerada devolve `{x:0,y:-1}` (para cima), que é um lado válido.
 */
export function normalNaFracao(pontos: readonly Ponto[], fracao: number): Ponto {
  const lista = pontos.length > 1 ? pontos : [];
  if (lista.length === 0) return { x: 0, y: -1 };
  let total = 0;
  for (let i = 0; i < lista.length - 1; i++) {
    total += Math.hypot(lista[i + 1]!.x - lista[i]!.x, lista[i + 1]!.y - lista[i]!.y);
  }
  if (total === 0) return { x: 0, y: -1 };
  const alvo = total * Math.min(Math.max(fracao, 0), 1);
  let andado = 0;
  for (let i = 0; i < lista.length - 1; i++) {
    const a = lista[i]!;
    const b = lista[i + 1]!;
    const comprimento = Math.hypot(b.x - a.x, b.y - a.y);
    if (comprimento === 0) continue;
    if (andado + comprimento >= alvo || i === lista.length - 2) {
      return { x: -(b.y - a.y) / comprimento, y: (b.x - a.x) / comprimento };
    }
    andado += comprimento;
  }
  return { x: 0, y: -1 };
}

/**
 * Caixa do texto ancorado em `ponto` com `text-anchor="middle"` e a linha de
 * base em `ponto.y` — é assim que o `<text>` do SVG se desenha.
 */
export function caixaDoRotulo(ponto: Ponto, largura: number, altura: number): Retangulo {
  return {
    x0: ponto.x - largura / 2,
    x1: ponto.x + largura / 2,
    y0: ponto.y - altura * 0.8,
    y1: ponto.y + altura * 0.2,
  };
}

function colidem(a: Retangulo, b: Retangulo): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/**
 * P4h (achado BAIXO #6 do crítico hostil ROUND 8): a 200 nós o crítico mediu 3
 * rótulos de sinergia POR CIMA de cartões (em 11 e 40 eram 0) — o teste de
 * colisão é exato, então o que passou raspando passou. Uma FOLGA em px de
 * mundo transforma "não encosta" em "não chega perto": o rótulo precisa de ar
 * em volta, senão o texto encosta na borda do cartão e vira ruído.
 */
export const FOLGA_DO_ROTULO_MUNDO = 4;

function inflado(r: Retangulo, folga: number): Retangulo {
  return { x0: r.x0 - folga, y0: r.y0 - folga, x1: r.x1 + folga, y1: r.y1 + folga };
}

/**
 * O segmento `a→b` encosta no retângulo? Recorte de Liang–Barsky, sem
 * dependência nenhuma: é o que permite ao colocador recusar um lugar por causa
 * de uma ARESTA (uma polilinha), e não só por causa de um cartão.
 */
export function segmentoCruzaRetangulo(a: Ponto, b: Ponto, r: Retangulo): boolean {
  const dentro = (p: Ponto): boolean => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
  if (dentro(a) || dentro(b)) return true;
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const testes: [number, number][] = [
    [-dx, a.x - r.x0],
    [dx, r.x1 - a.x],
    [-dy, a.y - r.y0],
    [dy, r.y1 - a.y],
  ];
  for (const [p, q] of testes) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t0 <= t1;
}

/** Alguma aresta (polilinha) encosta neste retângulo? */
function algumaArestaCruza(caixa: Retangulo, arestas: readonly (readonly Ponto[])[]): boolean {
  for (const pontos of arestas) {
    for (let i = 0; i + 1 < pontos.length; i += 1) {
      if (segmentoCruzaRetangulo(pontos[i]!, pontos[i + 1]!, caixa)) return true;
    }
  }
  return false;
}

function contido(a: Retangulo, b: Retangulo): boolean {
  return a.x0 >= b.x0 && a.y0 >= b.y0 && a.x1 <= b.x1 && a.y1 <= b.y1;
}

/**
 * Decide o ponto de cada rótulo. Ordem determinística (por id) — o mesmo grafo
 * produz sempre a mesma colocação. `null` = não há lugar livre; quem desenha
 * NÃO desenha o texto (e mantém o valor no rótulo acessível).
 */
export function colocarRotulos(
  pedidos: readonly PedidoDeRotulo[],
  cartoes: readonly Retangulo[],
  opcoes: {
    /**
     * O retângulo do MUNDO que está na tela agora. Candidatos dentro dele são
     * tentados primeiro — achado BAIXO #6: a 200 nós, 17 de 17 rótulos caíam
     * fora do painel (em 11 e 40, 0 de 0). Não é filtro: se nenhum candidato
     * visível servir, a ordem antiga continua valendo.
     */
    regiaoVisivel?: Retangulo;
    /** Ar mínimo em volta do rótulo, em px de mundo. */
    folga?: number;
    /**
     * As polilinhas das arestas desenhadas, em px de mundo. Candidato que
     * encoste em qualquer uma é recusado — inclusive na aresta do próprio
     * rótulo (achado BAIXO 13: o "50%" era escrito em cima do próprio traço
     * tracejado). Ausente = a régua antiga, que só conhecia cartões.
     */
    arestas?: readonly (readonly Ponto[])[];
    /**
     * Quanto o rótulo sai de LADO, perpendicular ao traço, em px de mundo.
     * 0 (o default) mantém o comportamento de sempre: o texto no ponto do
     * caminho. Quem desenha o grafo passa `AFASTAMENTO_DO_ROTULO_MUNDO`.
     */
    deslocamento?: number;
  } = {},
): Map<string, Ponto | null> {
  const folga = opcoes.folga ?? FOLGA_DO_ROTULO_MUNDO;
  const arestas = opcoes.arestas ?? [];
  const deslocamento = opcoes.deslocamento ?? 0;
  const saida = new Map<string, Ponto | null>();
  const ocupadas: Retangulo[] = [];
  const ordenados = [...pedidos].sort((a, b) => a.id.localeCompare(b.id));
  for (const pedido of ordenados) {
    let escolhido: Ponto | null = null;
    let caixaEscolhida: Retangulo | null = null;
    // Duas passadas: a 1ª só aceita o que está na tela; a 2ª aceita qualquer
    // lugar livre (é a regra antiga, intacta, quando não há região).
    const passadas = opcoes.regiaoVisivel ? [opcoes.regiaoVisivel, undefined] : [undefined];
    for (const regiao of passadas) {
      for (const fracao of FRACOES_CANDIDATAS) {
        const naLinha = pontoNaFracao(pedido.pontos, fracao);
        const normal = normalNaFracao(pedido.pontos, fracao);
        // Os dois lados do traço, sempre na mesma ordem (determinismo), e o
        // ponto sobre a linha só quando não há afastamento pedido.
        // Ar pedido + a meia-caixa alta do texto: é o que deixa os DOIS lados
        // do traço livres (ver `AFASTAMENTO_DO_ROTULO_MUNDO`).
        const afastamento = deslocamento > 0 ? deslocamento + pedido.altura * 0.8 : 0;
        const lados: Ponto[] =
          afastamento > 0
            ? [
                { x: naLinha.x + normal.x * afastamento, y: naLinha.y + normal.y * afastamento },
                { x: naLinha.x - normal.x * afastamento, y: naLinha.y - normal.y * afastamento },
              ]
            : [naLinha];
        for (const ponto of lados) {
          const caixa = caixaDoRotulo(ponto, pedido.largura, pedido.altura);
          const comFolga = inflado(caixa, folga);
          if (regiao && !contido(caixa, regiao)) continue;
          if (cartoes.some((c) => colidem(comFolga, c))) continue;
          if (ocupadas.some((o) => colidem(comFolga, o))) continue;
          if (algumaArestaCruza(comFolga, arestas)) continue;
          escolhido = ponto;
          caixaEscolhida = caixa;
          break;
        }
        if (escolhido) break;
      }
      if (escolhido) break;
    }
    if (caixaEscolhida) ocupadas.push(caixaEscolhida);
    saida.set(pedido.id, escolhido);
  }
  return saida;
}

/**
 * Largura estimada de um texto curto em px de mundo. Não existe medição de
 * fonte fora do navegador, e o colocador tem de ser PURO — então a régua é
 * conservadora (0,62 em ao caractere, a largura média de dígito da fonte do
 * cartão) e a altura é a caixa de linha.
 */
export function caixaEstimadaDoTexto(texto: string, fontePx: number): { largura: number; altura: number } {
  return { largura: Math.max(1, texto.length) * fontePx * 0.62, altura: fontePx * 1.2 };
}
