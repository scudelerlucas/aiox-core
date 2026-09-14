import { describe, expect, it } from "vitest";

import {
  caixaDoRotulo,
  caixaEstimadaDoTexto,
  colocarRotulos,
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
