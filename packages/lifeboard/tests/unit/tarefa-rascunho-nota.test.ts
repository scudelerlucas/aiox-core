import { describe, expect, it } from "vitest";

import {
  chaveRascunhoNota,
  gravarRascunhoNota,
  lerRascunhoNota,
  limparRascunhoNota,
  type DepositoRascunho,
} from "@/components/task/rascunho-nota";

/**
 * OS-LIFEBOARD · P6 — achado BAIXO #6 (rodada 5): o rascunho da nota sumia ao
 * navegar (clicar numa subtarefa e voltar). Agora ele vive em
 * `sessionStorage` sob `tarefa:<id>:nota`, e a regra que mais importa em uso
 * repetido é a de FALHA: `sessionStorage` lança em aba anônima com cookies
 * bloqueados e quando a cota estoura — perder um rascunho é aceitável,
 * derrubar a página da tarefa não é.
 *
 * Reverter para ver falhar: em `src/components/task/rascunho-nota.ts`, tirar
 * o `try/catch` de `lerRascunhoNota`/`gravarRascunhoNota` — os dois testes do
 * bloco "depósito que lança" passam a estourar.
 */
function depositoDeMemoria(): DepositoRascunho & { mapa: Map<string, string> } {
  const mapa = new Map<string, string>();
  return {
    mapa,
    getItem: (k) => mapa.get(k) ?? null,
    setItem: (k, v) => void mapa.set(k, v),
    removeItem: (k) => void mapa.delete(k),
  };
}

const DEPOSITO_QUE_LANCA: DepositoRascunho = {
  getItem: () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("QuotaExceededError", "QuotaExceededError");
  },
  removeItem: () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  },
};

describe("rascunho da nota (achado BAIXO #6, rodada 5)", () => {
  it("PRONTO QUANDO: a chave é `tarefa:<id>:nota` — uma por tarefa, nunca uma global", () => {
    expect(chaveRascunhoNota("task-build")).toBe("tarefa:task-build:nota");
    expect(chaveRascunhoNota("task-docs")).toBe("tarefa:task-docs:nota");
  });

  it("PRONTO QUANDO: o que foi digitado volta na leitura seguinte (é isso que sobrevive à navegação)", () => {
    const d = depositoDeMemoria();
    gravarRascunhoNota("task-build", "meia frase que eu ia terminar", d);
    expect(lerRascunhoNota("task-build", d)).toBe("meia frase que eu ia terminar");
  });

  it("o rascunho de uma tarefa não vaza para outra", () => {
    const d = depositoDeMemoria();
    gravarRascunhoNota("task-build", "nota do build", d);
    expect(lerRascunhoNota("task-docs", d)).toBe("");
  });

  it("salvar a nota apaga o rascunho (não volta como fantasma na próxima visita)", () => {
    const d = depositoDeMemoria();
    gravarRascunhoNota("task-build", "texto", d);
    limparRascunhoNota("task-build", d);
    expect(lerRascunhoNota("task-build", d)).toBe("");
    expect(d.mapa.size).toBe(0);
  });

  it("limpar o campo de propósito apaga o rascunho, em vez de gravar string vazia", () => {
    const d = depositoDeMemoria();
    gravarRascunhoNota("task-build", "texto", d);
    gravarRascunhoNota("task-build", "", d);
    expect(d.mapa.has("tarefa:task-build:nota")).toBe(false);
  });
});

describe("rascunho da nota — depósito que LANÇA (aba anônima, cota estourada)", () => {
  it("PRONTO QUANDO: ler nunca estoura — devolve vazio e a página segue de pé", () => {
    expect(() => lerRascunhoNota("task-build", DEPOSITO_QUE_LANCA)).not.toThrow();
    expect(lerRascunhoNota("task-build", DEPOSITO_QUE_LANCA)).toBe("");
  });

  it("PRONTO QUANDO: gravar/limpar nunca estouram (perder o rascunho > derrubar a tela)", () => {
    expect(() => gravarRascunhoNota("task-build", "texto", DEPOSITO_QUE_LANCA)).not.toThrow();
    expect(() => limparRascunhoNota("task-build", DEPOSITO_QUE_LANCA)).not.toThrow();
  });

  it("sem depósito nenhum (SSR: não existe `window`) também não estoura", () => {
    expect(lerRascunhoNota("task-build", null)).toBe("");
    expect(() => gravarRascunhoNota("task-build", "x", null)).not.toThrow();
    expect(() => limparRascunhoNota("task-build", null)).not.toThrow();
  });
});
