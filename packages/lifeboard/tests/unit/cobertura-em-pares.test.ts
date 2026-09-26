/**
 * OS-LIFEBOARD · P4 rodada 16 — a cobertura em pares do produto dos gestos.
 *
 * O ALTO da rodada 16: §22 cruzava dois eixos escolhidos à mão (camadas ×
 * seleção) e o zoom ficou de fora — uma linha em `v3-edge.tsx` apagou as
 * ligações do cartão selecionado ao aproximar, com os cinco portões verdes.
 * A guarda passou a derivar os eixos e a cobrir TODO par de valores de
 * quaisquer dois eixos. Este teste prova, sem navegador, as três coisas de
 * que a guarda depende: (1) o gerador cobre todo par, contado por uma
 * recontagem independente; (2) a recontagem NÃO é vazia (tirar uma
 * combinação deixa par descoberto); (3) par não observável não conta —
 * "selecionado × zoom no teto" numa combinação sem a camada que faz o
 * destaque aparecer não cobre nada.
 */
import { describe, expect, it } from "vitest";

import { gerarCoberturaEmPares, paresSemCobertura } from "../../scripts/cobertura-em-pares.mjs";

const valores = (prefixo: string, n: number): { nome: string }[] =>
  Array.from({ length: n }, (_, i) => ({ nome: `${prefixo}${String(i)}` }));

/** Os eixos do fixture, na ordem da guarda: camadas primeiro (é o eixo que decide o que é observável). */
const EIXOS = [
  { nome: "camadas", valores: valores("camadas", 7) },
  { nome: "zoom", valores: valores("zoom", 3) },
  { nome: "popover", valores: valores("popover", 3) },
  { nome: "selecao", valores: valores("selecao", 2) },
  { nome: "fontes", valores: valores("fontes", 2) },
  { nome: "enquadramento", valores: valores("enquadramento", 2) },
  { nome: "pan", valores: valores("pan", 2) },
];
const CAMADAS = 0;
const SELECAO = 3;
/** Na guarda, o valor de camadas "sem Sucessão" é o índice 2: ali o destaque não tem como aparecer. */
const SEM_SUCESSAO = 2;

const credita = (combo: (number | null)[], i: number, j: number): boolean => {
  const tocaSelecao = (i === SELECAO || j === SELECAO) && combo[SELECAO] === 1;
  if (!tocaSelecao) return true;
  if ((i === CAMADAS && j === SELECAO) || (i === SELECAO && j === CAMADAS)) return true;
  if (combo[CAMADAS] === null) return false;
  return combo[CAMADAS] !== SEM_SUCESSAO;
};

describe("cobertura em pares do produto dos gestos (§22)", () => {
  const { combos, total } = gerarCoberturaEmPares(EIXOS, credita);

  it("cobre todo par de valores de quaisquer dois eixos — pela recontagem independente", () => {
    expect(total).toBe(179);
    expect(paresSemCobertura(EIXOS, combos, credita)).toEqual([]);
  });

  it("custa uma fração do produto completo, e nunca menos que o maior par de eixos", () => {
    const produto = EIXOS.reduce((p, e) => p * e.valores.length, 1);
    expect(produto).toBe(1008);
    expect(combos.length).toBeGreaterThanOrEqual(7 * 3);
    expect(combos.length).toBeLessThanOrEqual(30);
  });

  it("é determinística: as mesmas combinações a cada corrida (nunca escolhidas a dedo, nunca sorteadas)", () => {
    expect(gerarCoberturaEmPares(EIXOS, credita).combos).toEqual(combos);
  });

  it("a recontagem não é vazia: tirar qualquer combinação deixa par descoberto", () => {
    for (let k = 0; k < combos.length; k += 1) {
      const sem = combos.filter((_, i) => i !== k);
      expect(paresSemCobertura(EIXOS, sem, credita).length).toBeGreaterThan(0);
    }
  });

  it("par não observável não conta: 'selecionado × zoom no teto' só vale onde o destaque pode aparecer", () => {
    for (let eixo = 1; eixo < EIXOS.length; eixo += 1) {
      if (eixo === SELECAO) continue;
      for (let v = 0; v < EIXOS[eixo]!.valores.length; v += 1) {
        const observavel = combos.some(
          (c) => c[SELECAO] === 1 && c[eixo] === v && c[CAMADAS] !== SEM_SUCESSAO,
        );
        expect(observavel, `${EIXOS[eixo]!.nome}=${String(v)} × selecionado`).toBe(true);
      }
    }
    /* E a recontagem acusa quando o único lugar de um par é não observável. */
    const todosSemSucessao = combos.map((c) => (c[SELECAO] === 1 ? [SEM_SUCESSAO, ...c.slice(1)] : c));
    expect(paresSemCobertura(EIXOS, todosSemSucessao, credita).length).toBeGreaterThan(0);
  });

  it("par que nunca é observável derruba o gerador em vez de sair 'coberto'", () => {
    expect(() => gerarCoberturaEmPares(EIXOS, () => false)).toThrow(/não é observável|não conseguiu creditar/);
  });
});
