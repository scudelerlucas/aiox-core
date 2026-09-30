/**
 * OS-LIFEBOARD · P4 · rodada 12 — o achado do coordenador.
 *
 * A rodada 11 trocou a régua de cor por um MODELO DE MISTURA: o que o
 * compositor pinta é `P = α·C + (1 − α)·B`, e mede-se a distância do pixel até
 * a reta `B→C`. O comentário do próprio arquivo dizia, com todas as letras,
 * que "antialias e oclusão só mexem em α (a posição na reta)".
 *
 * **α não era medido em lugar nenhum.** Qualquer ponto da reta passava — α
 * perto de zero inclusive. Uma linha (`style={{ opacity: 0.12 }}` no `<g>` da
 * aresta) apagou o grafo inteiro com os CINCO portões verdes. Pela conta desta
 * casa, a aresta de sucessão caiu de 12,40:1 para 1,21:1 contra o canvas —
 * pior que o ALTO 4 que a rodada 11 tinha acabado de fechar (1,27:1).
 *
 * São DUAS perguntas, e as duas são obrigatórias:
 *   1. está na COR certa?  → a reta `B→C` (`residuoDeMistura`, rodada 11)
 *   2. está VISÍVEL?       → o α, medido como contraste do PIXEL COMPOSTO
 *                            contra o pixel de fundo do mesmo lugar
 *
 * Este teste costura a pergunta 2 nos três arquivos onde ela vive, para o
 * portão de TESTE morder junto com a guarda de navegador:
 *  • o piso mora em `scripts/checar-contraste.mjs` (a régua de contraste da
 *    casa) — e não no arquivo que decide a cor nem na guarda que mede;
 *  • `scripts/guarda-no-navegador.mjs` LÊ esse piso de lá, nunca escreve um
 *    número próprio (a rodada 11 já levou um ALTO por "a guarda conta a si
 *    mesma");
 *  • a conta de contraste de `scripts/pixel-do-grafo.mjs` é a MESMA de
 *    `checar-contraste.mjs`, e ela de fato separa o honesto do sabotado.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { luminanciaRelativa, razaoDeContraste } from "../../scripts/pixel-do-grafo.mjs";
import {
  ARESTA_STROKE,
  ARESTA_STROKE_CRITICO,
  ARESTA_STROKE_DESTACADA,
} from "@/components/graph/aresta-svg";
import { TIPOS_DE_BANDA } from "@/lib/geometria-da-aresta";

function lerScript(relativo: string): string {
  return readFileSync(join(process.cwd(), relativo), "utf8");
}

const REGUA = lerScript("scripts/checar-contraste.mjs");
const GUARDA = lerScript("scripts/guarda-no-navegador.mjs");

/** O piso, lido de onde ele mora de verdade. */
const PISO = Number(
  /export const PISO_DE_CONTRASTE_DA_ARESTA\s*=\s*([\d.]+)\s*;/.exec(REGUA)?.[1] ?? "NaN",
);

/** `#RRGGBB` → `[r, g, b]`. */
function canais(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** O fundo do canvas — o mesmo `navy-950` que a régua de contraste usa. */
const FUNDO = canais(
  /950: "(#[0-9A-Fa-f]{6})"/.exec(lerScript("tailwind.config.ts"))?.[1] ?? "#000000",
);

/** `P = α·C + (1 − α)·B` — a composição que o navegador faz. */
function composto(cor: [number, number, number], alfa: number): [number, number, number] {
  return [0, 1, 2].map((i) => alfa * cor[i]! + (1 - alfa) * FUNDO[i]!) as [number, number, number];
}

function corDoPapel(papel: string): string {
  if (papel === "critico") return ARESTA_STROKE_CRITICO;
  if (papel === "destacada") return ARESTA_STROKE_DESTACADA;
  return (ARESTA_STROKE as Record<string, string>)[papel] as string;
}

describe("o piso de visibilidade da aresta tem UMA fonte só", () => {
  it("o piso mora na régua de contraste da casa, com nome", () => {
    expect(PISO, "PISO_DE_CONTRASTE_DA_ARESTA sumiu de scripts/checar-contraste.mjs").toBeGreaterThanOrEqual(1);
    expect(
      REGUA,
      "a régua parou de cobrar o piso no par `grafo-<papel>` sobre navy-950 — o número viraria decoração",
    ).toMatch(/PARES\.push\(\[\s*`grafo-\$\{papel\}`,\s*"navy-950",\s*PISO_DE_CONTRASTE_DA_ARESTA,/);
  });

  it("a guarda de navegador LÊ o piso da régua, não escreve um número próprio", () => {
    expect(GUARDA, "a guarda deixou de ler scripts/checar-contraste.mjs").toContain(
      'lerFonte("scripts/checar-contraste.mjs")',
    );
    expect(
      GUARDA,
      "a guarda deixou de extrair PISO_DE_CONTRASTE_DA_ARESTA da régua",
    ).toContain("PISO_DE_CONTRASTE_DA_ARESTA");
    /* E nenhum número de contraste escrito à mão dentro da guarda: o piso é
       lido, não declarado. */
    expect(
      /const\s+\w*[Pp]iso\w*[Dd]e[Cc]ontraste\w*\s*=\s*[\d.]+/.exec(GUARDA),
      "a guarda voltou a escrever um piso de contraste próprio — é o vício 'a guarda conta a si mesma'",
    ).toBeNull();
  });

  it("a conta de contraste do medidor é a mesma da régua (luminância relativa WCAG)", () => {
    /* A régua faz a conta a partir do hex; o medidor, a partir dos canais da
       foto. Os dois têm de dar o mesmo número para a mesma cor. */
    expect(luminanciaRelativa([255, 255, 255])).toBeCloseTo(1, 6);
    expect(luminanciaRelativa([0, 0, 0])).toBeCloseTo(0, 6);
    expect(razaoDeContraste([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 6);
    /* Os dois números que o coordenador mediu na sabotagem, reproduzidos aqui. */
    expect(razaoDeContraste(canais(ARESTA_STROKE.sucessao), FUNDO)).toBeCloseTo(12.4, 1);
    expect(razaoDeContraste(composto(canais(ARESTA_STROKE.sucessao), 0.12), FUNDO)).toBeCloseTo(1.21, 2);
  });
});

describe("o piso separa o traço honesto do traço apagado", () => {
  it("toda cor de aresta, OPACA sobre o canvas, passa o piso", () => {
    for (const papel of TIPOS_DE_BANDA) {
      const r = razaoDeContraste(canais(corDoPapel(papel)), FUNDO);
      expect(r, `papel "${papel}" opaco sobre navy-950 mede ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(PISO);
    }
  });

  it("a MESMA cor a 12% de opacidade reprova em todo papel — é a sabotagem do coordenador", () => {
    for (const papel of TIPOS_DE_BANDA) {
      const r = razaoDeContraste(composto(canais(corDoPapel(papel)), 0.12), FUNDO);
      expect(r, `papel "${papel}" a 12% mede ${r.toFixed(2)}:1 e passaria`).toBeLessThan(PISO);
    }
  });

  it("um hex escurecido nas DUAS tabelas ao mesmo tempo também reprova", () => {
    /* A sabotagem V4 da rodada 11: trocar o hex nos dois lugares faz as duas
       tabelas concordarem — e a guarda antiga ficava verde por concordância.
       A pergunta "dá para ver?" não depende de concordância nenhuma. */
    const escurecido = razaoDeContraste(canais("#0A2418"), FUNDO);
    expect(escurecido, `um verde quase preto mede ${escurecido.toFixed(2)}:1`).toBeLessThan(PISO);
  });
});
