/**
 * OS-LIFEBOARD · P4 · rodada 11 — achado ALTO 4 do crítico hostil.
 *
 * Havia DUAS tabelas de hex para a mesma cor de aresta e NENHUM teste entre
 * elas: `tailwind.config.ts` (tokens `aresta.*`, que a régua de contraste da
 * casa lê) e `src/components/graph/aresta-svg.tsx` (hex literais, que o grafo
 * de fato pinta — `stroke` do SVG não aceita classe Tailwind). Trocar UM hex
 * em `aresta-svg.tsx` levou a aresta de sucessão de 12,40:1 para 1,27:1
 * contra o fundo do canvas com os cinco portões verdes.
 *
 * Este teste é a costura: papel a papel, as duas tabelas têm de dizer a mesma
 * coisa. Não decide qual está certa — decide que não pode haver duas.
 * (`scripts/checar-contraste.mjs` faz a mesma conferência e ainda MEDE o
 * contraste do hex de `aresta-svg.tsx`; a guarda de navegador deriva o
 * contrato dos dois lados e reprova se divergirem.)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ARESTA_STROKE,
  ARESTA_STROKE_CRITICO,
  ARESTA_STROKE_DESTACADA,
} from "@/components/graph/aresta-svg";
import { TIPOS_DE_BANDA } from "@/lib/geometria-da-aresta";

/** Papel de aresta → chave do token em `tailwind.config.ts` (grupo `aresta`). */
const TOKEN_DO_PAPEL: Record<string, string> = {
  sucessao: "sucessao",
  correlacao: "correlacao",
  sinergia: "sinergia",
  obsolescencia: "obsolescenciaHue",
  critico: "critico",
  destacada: "predecessor",
};

function tokensDaAresta(): Record<string, string> {
  const fonte = readFileSync(join(process.cwd(), "tailwind.config.ts"), "utf8");
  const bloco = /aresta: \{([\s\S]*?)\n {8}\},/.exec(fonte);
  expect(bloco, "não achei o grupo de tokens `aresta` em tailwind.config.ts").not.toBeNull();
  const mapa: Record<string, string> = {};
  for (const m of (bloco?.[1] ?? "").matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{6})"/g)) {
    mapa[m[1] as string] = m[2] as string;
  }
  return mapa;
}

function corQueOGrafoPinta(papel: string): string | undefined {
  if (papel === "critico") return ARESTA_STROKE_CRITICO;
  if (papel === "destacada") return ARESTA_STROKE_DESTACADA;
  return (ARESTA_STROKE as Record<string, string>)[papel];
}

describe("a cor da aresta tem UMA fonte só", () => {
  it("todo papel de TIPOS_DE_BANDA tem cor no grafo e token no tema", () => {
    const tokens = tokensDaAresta();
    for (const papel of TIPOS_DE_BANDA) {
      expect(corQueOGrafoPinta(papel), `papel "${papel}" sem cor em aresta-svg.tsx`).toMatch(
        /^#[0-9A-Fa-f]{6}$/,
      );
      const token = TOKEN_DO_PAPEL[papel];
      expect(token, `papel "${papel}" sem token declarado neste teste`).toBeTypeOf("string");
      expect(tokens[token as string], `token aresta.${String(token)} não existe em tailwind.config.ts`).toMatch(
        /^#[0-9A-Fa-f]{6}$/,
      );
    }
  });

  it("aresta-svg.tsx e tailwind.config.ts pintam o MESMO hex em cada papel", () => {
    const tokens = tokensDaAresta();
    const divergentes = TIPOS_DE_BANDA.filter((papel) => {
      const noGrafo = corQueOGrafoPinta(papel)?.toUpperCase();
      const noTema = tokens[TOKEN_DO_PAPEL[papel] as string]?.toUpperCase();
      return noGrafo !== noTema;
    }).map((papel) => ({
      papel,
      noGrafo: corQueOGrafoPinta(papel),
      noTema: tokens[TOKEN_DO_PAPEL[papel] as string],
    }));
    expect(divergentes, "as duas tabelas de hex da aresta divergem — uma cor, uma fonte").toEqual([]);
  });
});
