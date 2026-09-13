/**
 * Fronteira crua v3 (migration 0004/0005): `normalizeAssimetria` e `normalizeEdge`.
 * Achado do crítico de 13/09: a fundação entrou sem um teste sequer nas funções
 * novas. Cada caso abaixo é um dado que o Postgres aceita ou já aceitou.
 */
import { describe, expect, it } from "vitest";
import { normalizeAssimetria, normalizeEdge } from "@/lib/supabase/normalize-task";
import { atomosDeclaradosValidos, pesoValido } from "@/core/prioritize/tipos-v3";

describe("normalizeAssimetria — mesma régua do CHECK tasks_assimetria_dominio", () => {
  it("aceita o domínio: opcionalidade 1..3, esforço/custo em {1,2,3,5}", () => {
    expect(normalizeAssimetria({ opcionalidade: 3, esforco: 5, custo: 1 })).toEqual({
      opcionalidade: 3,
      esforco: 5,
      custo: 1,
    });
    expect(normalizeAssimetria({ opcionalidade: 1.5, esforco: 2, custo: 3, extra: "x" })).toEqual(
      { opcionalidade: 1.5, esforco: 2, custo: 3 },
    );
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["objeto vazio", {}],
    ["string", "3"],
    ["array", [1, 2, 3]],
    ["campo string", { opcionalidade: 2, esforco: "3", custo: 1 }],
    ["custo zero", { opcionalidade: 2, esforco: 3, custo: 0 }],
    ["esforco negativo", { opcionalidade: 2, esforco: -1, custo: 1 }],
    ["esforco fora das faixas (4)", { opcionalidade: 2, esforco: 4, custo: 1 }],
    ["esforco 0.001 (score 10⁴)", { opcionalidade: 2, esforco: 0.001, custo: 1 }],
    ["opcionalidade 99", { opcionalidade: 99, esforco: 1, custo: 1 }],
    ["custo Infinity", { opcionalidade: 2, esforco: 1, custo: Infinity }],
    ["custo NaN", { opcionalidade: 2, esforco: 1, custo: NaN }],
  ])("devolve null para %s", (_nome, raw) => {
    expect(normalizeAssimetria(raw)).toBeNull();
    expect(atomosDeclaradosValidos(raw)).toBe(false);
  });
});

describe("normalizeEdge — descarta o que o app não sabe consumir", () => {
  const base = { id: "e1", origem: "a", destino: "b", tipo: "sinergia", peso: 0.5, nota: null, createdAt: "2026-09-13T00:00:00Z" };

  it("aresta válida passa inteira", () => {
    expect(normalizeEdge(base)).toEqual({ ...base });
  });

  it("tipo desconhecido (novo no banco) → null", () => {
    expect(normalizeEdge({ ...base, tipo: "sucessao" })).toBeNull();
  });

  it("auto-laço → null", () => {
    expect(normalizeEdge({ ...base, destino: "a" })).toBeNull();
  });

  it("origem/destino/id ausentes → null", () => {
    expect(normalizeEdge({ ...base, origem: undefined })).toBeNull();
    expect(normalizeEdge({ ...base, destino: 7 })).toBeNull();
    expect(normalizeEdge({ ...base, id: null })).toBeNull();
  });

  it("peso ausente vira 1; fora de 0..1 é grampeado; NaN vira 1", () => {
    expect(normalizeEdge({ ...base, peso: undefined })?.peso).toBe(1);
    expect(normalizeEdge({ ...base, peso: 1.5 })?.peso).toBe(1);
    expect(normalizeEdge({ ...base, peso: -0.2 })?.peso).toBe(0);
    expect(normalizeEdge({ ...base, peso: NaN })?.peso).toBe(1);
  });

  it("nota não-string vira null; createdAt não-string vira string vazia", () => {
    const e = normalizeEdge({ ...base, nota: 42, createdAt: 1 });
    expect(e?.nota).toBeNull();
    expect(e?.createdAt).toBe("");
  });

  it("pesoValido: só número finito em 0..1", () => {
    expect(pesoValido(0)).toBe(true);
    expect(pesoValido(1)).toBe(true);
    expect(pesoValido(1.01)).toBe(false);
    expect(pesoValido(NaN)).toBe(false);
    expect(pesoValido("0.5")).toBe(false);
  });
});
