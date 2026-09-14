import { describe, expect, it } from "vitest";

import {
  caixaDoRotulo,
  caixaEstimadaDoTexto,
  colocarRotulos,
  FOLGA_DO_ROTULO_MUNDO,
  pontoNaFracao,
  type PedidoDeRotulo,
  type Retangulo,
} from "@/lib/rotulo-da-aresta";

/**
 * OS-LIFEBOARD · P4g — achado MÉDIO #5 do crítico hostil ROUND 6.
 *
 * O rótulo de % da sinergia ia SEMPRE para o meio do segmento mais longo, sem
 * olhar para nada: 1 par sobreposto de 195 a 228px² (lido como "35%35%"), 4 a 5
 * rótulos por cima de cartões (até 106px²) e 1 cortado pela borda a 390px.
 *
 * O colocador é único e puro: candidatos ao longo do caminho, recusa por
 * colisão com outro rótulo e com retângulo de cartão, e — sem lugar livre —
 * `null`, que o desenho respeita não escrevendo o texto (o valor continua no
 * `aria-label`/`title` da aresta).
 */

const CARTAO: Retangulo = { x0: 0, y0: 0, x1: 200, y1: 180 };

function reta(y: number): { x: number; y: number }[] {
  return [
    { x: -400, y },
    { x: 400, y },
  ];
}

describe("colocarRotulos — colisão recusa o lugar (achado MÉDIO #5)", () => {
  it("dois rótulos no MESMO caminho não caem um em cima do outro", () => {
    const pedidos: PedidoDeRotulo[] = [
      { id: "a", pontos: reta(-100), largura: 30, altura: 15 },
      { id: "b", pontos: reta(-100), largura: 30, altura: 15 },
    ];
    const r = colocarRotulos(pedidos, []);
    const a = r.get("a")!;
    const b = r.get("b")!;
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const ca = caixaDoRotulo(a!, 30, 15);
    const cb = caixaDoRotulo(b!, 30, 15);
    const areaSobreposta =
      Math.max(0, Math.min(ca.x1, cb.x1) - Math.max(ca.x0, cb.x0)) *
      Math.max(0, Math.min(ca.y1, cb.y1) - Math.max(ca.y0, cb.y0));
    expect(areaSobreposta).toBe(0);
  });

  it("o rótulo NÃO fica sobre o cartão — sai para um ponto livre do próprio caminho", () => {
    // O meio do caminho cai bem dentro do cartão; o colocador tem de recusar.
    const caminho = [
      { x: -300, y: 90 },
      { x: 500, y: 90 },
    ];
    const r = colocarRotulos([{ id: "s", pontos: caminho, largura: 30, altura: 15 }], [CARTAO]);
    const ponto = r.get("s")!;
    expect(ponto).not.toBeNull();
    const caixa = caixaDoRotulo(ponto!, 30, 15);
    const sobreCartao =
      Math.max(0, Math.min(caixa.x1, CARTAO.x1) - Math.max(caixa.x0, CARTAO.x0)) *
      Math.max(0, Math.min(caixa.y1, CARTAO.y1) - Math.max(caixa.y0, CARTAO.y0));
    expect(sobreCartao).toBe(0);
  });

  it("falsificador: sem a recusa por cartão, o meio do caminho CAI sobre o cartão", () => {
    // A mesma geometria do teste acima, medida no candidato que o código
    // antigo usava (o ponto médio): prova que a régua tem o que recusar.
    const meio = pontoNaFracao(
      [
        { x: -300, y: 90 },
        { x: 500, y: 90 },
      ],
      0.5,
    );
    const caixa = caixaDoRotulo(meio, 30, 15);
    const sobreCartao =
      Math.max(0, Math.min(caixa.x1, CARTAO.x1) - Math.max(caixa.x0, CARTAO.x0)) *
      Math.max(0, Math.min(caixa.y1, CARTAO.y1) - Math.max(caixa.y0, CARTAO.y0));
    expect(sobreCartao).toBeGreaterThan(0);
  });

  it("caminho inteiramente coberto: o rótulo não é desenhado (null), nunca escrito por cima", () => {
    const muroDeCartoes: Retangulo[] = [{ x0: -1000, y0: -1000, x1: 1000, y1: 1000 }];
    const r = colocarRotulos([{ id: "s", pontos: reta(0), largura: 30, altura: 15 }], muroDeCartoes);
    expect(r.get("s")).toBeNull();
  });

  it("é determinístico: a mesma entrada, na ordem que for, dá a mesma colocação", () => {
    const pedidos: PedidoDeRotulo[] = [
      { id: "b", pontos: reta(-100), largura: 30, altura: 15 },
      { id: "a", pontos: reta(-100), largura: 30, altura: 15 },
    ];
    const primeiro = colocarRotulos(pedidos, []);
    const segundo = colocarRotulos([...pedidos].reverse(), []);
    expect(primeiro.get("a")).toEqual(segundo.get("a"));
    expect(primeiro.get("b")).toEqual(segundo.get("b"));
  });
});

describe("pontoNaFracao / caixaEstimadaDoTexto — a geometria que o colocador usa", () => {
  it("anda ao longo da POLILINHA, não em linha reta entre as pontas", () => {
    const caminho = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ];
    expect(pontoNaFracao(caminho, 0.5)).toEqual({ x: 0, y: 100 });
    expect(pontoNaFracao(caminho, 1)).toEqual({ x: 100, y: 100 });
    expect(pontoNaFracao(caminho, 0)).toEqual({ x: 0, y: 0 });
  });

  it("a caixa do texto cresce com a fonte e com o número de caracteres", () => {
    const pequena = caixaEstimadaDoTexto("35%", 12);
    const grande = caixaEstimadaDoTexto("35%", 24);
    expect(grande.largura).toBeGreaterThan(pequena.largura);
    expect(caixaEstimadaDoTexto("100%", 12).largura).toBeGreaterThan(pequena.largura);
  });

  it("rota degenerada não quebra", () => {
    expect(pontoNaFracao([], 0.5)).toEqual({ x: 0, y: 0 });
    expect(pontoNaFracao([{ x: 5, y: 5 }], 0.5)).toEqual({ x: 5, y: 5 });
  });
});

/**
 * P4h — achado BAIXO #6 do crítico hostil ROUND 8: a 200 nós o crítico mediu 3
 * rótulos de sinergia POR CIMA de cartões e 17 de 17 FORA do painel (em 11 e
 * em 40 era 0/0/0 e 100% dentro). Duas causas distintas, duas curas:
 *
 *  • o teste de colisão era exato — o que passava raspando passava. Agora o
 *    rótulo precisa de FOLGA em volta.
 *  • o colocador não sabia que pedaço do mundo estava na tela. Agora ele tenta
 *    primeiro os candidatos VISÍVEIS, e só depois o resto (nunca é filtro: um
 *    rótulo fora da tela ainda é melhor que nenhum quando não há alternativa).
 */
describe("P4h — folga e região visível (achado BAIXO #6)", () => {
  const pedido = (id: string, pontos: { x: number; y: number }[]): PedidoDeRotulo => ({
    id,
    pontos,
    largura: 20,
    altura: 12,
  });

  it("rótulo que apenas ENCOSTA num cartão é recusado pela folga", () => {
    const caminho = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ];
    const meio = pontoNaFracao(caminho, 0.5);
    const caixa = caixaDoRotulo(meio, 20, 12);
    // Um cartão colado na borda de baixo do rótulo: sem folga passava.
    const encostado: Retangulo = {
      x0: caixa.x0,
      x1: caixa.x1,
      y0: caixa.y1 + FOLGA_DO_ROTULO_MUNDO / 2,
      y1: caixa.y1 + 100,
    };
    const semFolga = colocarRotulos([pedido("a", caminho)], [encostado], { folga: 0 });
    const comFolga = colocarRotulos([pedido("a", caminho)], [encostado]);
    expect(semFolga.get("a")).toEqual(meio);
    expect(comFolga.get("a")).not.toEqual(meio);
  });

  it("com região visível, o rótulo vai para um candidato DENTRO da tela", () => {
    // Caminho longo: o meio (fração 0,5) cai fora do painel; um candidato
    // mais perto da ponta cai dentro.
    const caminho = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
    ];
    const regiaoVisivel: Retangulo = { x0: 0, y0: -50, x1: 1200, y1: 50 };
    const semRegiao = colocarRotulos([pedido("a", caminho)], []);
    const comRegiao = colocarRotulos([pedido("a", caminho)], [], { regiaoVisivel });
    expect(semRegiao.get("a")!.x).toBeGreaterThan(regiaoVisivel.x1);
    expect(comRegiao.get("a")!.x).toBeLessThanOrEqual(regiaoVisivel.x1);
    expect(comRegiao.get("a")!.x).toBeGreaterThanOrEqual(regiaoVisivel.x0);
  });

  it("a região é PREFERÊNCIA, não filtro: sem candidato visível, o rótulo ainda sai", () => {
    const caminho = [
      { x: 5000, y: 5000 },
      { x: 6000, y: 5000 },
    ];
    const regiaoVisivel: Retangulo = { x0: 0, y0: 0, x1: 800, y1: 600 };
    const saida = colocarRotulos([pedido("a", caminho)], [], { regiaoVisivel });
    expect(saida.get("a")).not.toBeNull();
  });

  it("dois rótulos no mesmo lugar continuam sem se sobrepor, agora com folga entre eles", () => {
    const caminho = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
    ];
    const saida = colocarRotulos([pedido("a", caminho), pedido("b", caminho)], []);
    const a = saida.get("a")!;
    const b = saida.get("b")!;
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(20 + FOLGA_DO_ROTULO_MUNDO);
  });
});
