import { describe, expect, it } from "vitest";

import {
  CAMPOS_COM_RASCUNHO,
  chaveRascunho,
  gravarRascunho,
  lerRascunho,
  limparRascunhos,
  type DepositoRascunho,
} from "@/components/task/rascunho";

import { camposDeTextoLivre, arquivosQueRestauramRascunho } from "./tarefa-varredura-derivada";

/**
 * OS-LIFEBOARD · P6 — achado BAIXO #6 (rodada 5): o rascunho da nota sumia ao
 * navegar (clicar numa subtarefa e voltar). Agora ele vive em
 * `sessionStorage` sob `tarefa:<id>:<campo>`, e a regra que mais importa em uso
 * repetido é a de FALHA: `sessionStorage` lança em aba anônima com cookies
 * bloqueados e quando a cota estoura — perder um rascunho é aceitável,
 * derrubar a página da tarefa não é.
 *
 * ═══════════════════════════════════════════════════════════ MÉDIO #1, rodada 14 ═
 * E o mecanismo deixou de ser "da nota": os SETE campos de texto livre da
 * página usam as mesmas quatro funções, e a guarda que cobra isso é DERIVADA do
 * JSX (`camposDeTextoLivre`) — não uma lista de nomes de arquivo, que foi
 * exatamente o vício que deixou a "Nota da relação" nascer sem proteção.
 *
 * Reverter para ver falhar: em `src/components/task/rascunho.ts`, tirar o
 * `try/catch` de `lerRascunho`/`gravarRascunho` — os dois testes do bloco
 * "depósito que lança" passam a estourar. Tirar o `gravarRascunho` do
 * manipulador de qualquer um dos sete campos deixa vermelho o teste derivado.
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

describe("rascunho de campo (achado BAIXO #6, rodada 5)", () => {
  it("PRONTO QUANDO: a chave é `tarefa:<id>:<campo>` — uma por tarefa E por campo", () => {
    expect(chaveRascunho("task-build", CAMPOS_COM_RASCUNHO.nota)).toBe("tarefa:task-build:nota");
    expect(chaveRascunho("task-docs", CAMPOS_COM_RASCUNHO.nota)).toBe("tarefa:task-docs:nota");
    // As chaves dos dois campos da nota são as MESMAS de antes da rodada 14:
    // quem tinha rascunho na sessão não o perde na generalização.
    expect(chaveRascunho("task-build", CAMPOS_COM_RASCUNHO.notaAutor)).toBe(
      "tarefa:task-build:nota:autor",
    );
  });

  it("PRONTO QUANDO: o que foi digitado volta na leitura seguinte (é isso que sobrevive à navegação)", () => {
    const d = depositoDeMemoria();
    gravarRascunho("task-build", CAMPOS_COM_RASCUNHO.nota, "meia frase que eu ia terminar", d);
    expect(lerRascunho("task-build", CAMPOS_COM_RASCUNHO.nota, d)).toBe(
      "meia frase que eu ia terminar",
    );
  });

  it("o rascunho de uma tarefa não vaza para outra", () => {
    const d = depositoDeMemoria();
    gravarRascunho("task-build", CAMPOS_COM_RASCUNHO.nota, "nota do build", d);
    expect(lerRascunho("task-docs", CAMPOS_COM_RASCUNHO.nota, d)).toBe("");
  });

  it("o rascunho de um campo não vaza para o campo vizinho", () => {
    const d = depositoDeMemoria();
    gravarRascunho("task-build", CAMPOS_COM_RASCUNHO.relacaoNota, "nota da relação", d);
    expect(lerRascunho("task-build", CAMPOS_COM_RASCUNHO.nota, d)).toBe("");
    expect(lerRascunho("task-build", CAMPOS_COM_RASCUNHO.subtarefaTitulo, d)).toBe("");
  });

  it("salvar apaga o rascunho do formulário inteiro (não volta como fantasma)", () => {
    const d = depositoDeMemoria();
    gravarRascunho("task-build", CAMPOS_COM_RASCUNHO.subtarefaTitulo, "texto", d);
    gravarRascunho("task-build", CAMPOS_COM_RASCUNHO.subtarefaDuracao, "7", d);
    limparRascunhos("task-build", [
      CAMPOS_COM_RASCUNHO.subtarefaTitulo,
      CAMPOS_COM_RASCUNHO.subtarefaDuracao,
    ], d);
    expect(d.mapa.size).toBe(0);
  });

  it("limpar o campo de propósito apaga o rascunho, em vez de gravar string vazia", () => {
    const d = depositoDeMemoria();
    gravarRascunho("task-build", CAMPOS_COM_RASCUNHO.nota, "texto", d);
    gravarRascunho("task-build", CAMPOS_COM_RASCUNHO.nota, "", d);
    expect(d.mapa.has("tarefa:task-build:nota")).toBe(false);
  });
});

describe("rascunho — depósito que LANÇA (aba anônima, cota estourada)", () => {
  it("PRONTO QUANDO: ler nunca estoura — devolve vazio e a página segue de pé", () => {
    expect(() =>
      lerRascunho("task-build", CAMPOS_COM_RASCUNHO.nota, DEPOSITO_QUE_LANCA),
    ).not.toThrow();
    expect(lerRascunho("task-build", CAMPOS_COM_RASCUNHO.nota, DEPOSITO_QUE_LANCA)).toBe("");
  });

  it("PRONTO QUANDO: gravar/limpar nunca estouram (perder o rascunho > derrubar a tela)", () => {
    expect(() =>
      gravarRascunho("task-build", CAMPOS_COM_RASCUNHO.nota, "texto", DEPOSITO_QUE_LANCA),
    ).not.toThrow();
    expect(() =>
      limparRascunhos("task-build", [CAMPOS_COM_RASCUNHO.nota], DEPOSITO_QUE_LANCA),
    ).not.toThrow();
  });

  it("sem depósito nenhum (SSR: não existe `window`) também não estoura", () => {
    expect(lerRascunho("task-build", CAMPOS_COM_RASCUNHO.nota, null)).toBe("");
    expect(() => gravarRascunho("task-build", CAMPOS_COM_RASCUNHO.nota, "x", null)).not.toThrow();
    expect(() => limparRascunhos("task-build", [CAMPOS_COM_RASCUNHO.nota], null)).not.toThrow();
  });
});

// ════════════════════════════════════ MÉDIO #1, rodada 14 — a guarda derivada ═
describe("MÉDIO #1 — todo campo de texto livre da página tem rascunho (DERIVADO do JSX)", () => {
  /**
   * A lista não é escrita aqui: ela sai do JSX do perímetro da página. Campo de
   * texto novo, em arquivo novo ou velho, entra sozinho — e entra vermelho até
   * alguém gravar o rascunho dele. Era a ausência desta guarda que deixou a
   * "Nota da relação" (rodada 13) nascer sem a proteção que a irmã tinha desde
   * a rodada 5.
   */
  it("PRONTO QUANDO: a varredura ACHA campos — alvo ausente é reprovação, não dispensa", () => {
    const campos = camposDeTextoLivre();
    // 7 campos: nota, autor da nota, duração da tarefa, nota da relação,
    // desconto da sinergia, título da subtarefa, duração da subtarefa.
    expect(campos.length, "a varredura não achou campo nenhum — ela deixou de medir").toBe(7);
    // E cada um tem um estado e um manipulador de mudança de verdade.
    for (const c of campos) {
      expect(c.valor.length, `${c.arquivo}:${String(c.linha)} sem \`value\``).toBeGreaterThan(0);
      expect(
        c.manipulador.length,
        `${c.arquivo}:${String(c.linha)} sem manipulador de mudança`,
      ).toBeGreaterThan(0);
    }
  });

  it("PRONTO QUANDO: nenhum campo que nasce VAZIO grava sem rascunho", () => {
    const campos = camposDeTextoLivre();
    const deCriacao = campos.filter((c) => !c.nasceDoServidor);
    const doServidor = campos.filter((c) => c.nasceDoServidor);
    // A cobrança não pode encolher em silêncio: 6 dos 7 campos são de criação.
    expect(
      deCriacao.length,
      "a cobrança do rascunho encolheu — campo de criação deixou de ser visto",
    ).toBe(6);
    // E a dispensa é UMA, declarada por escrito em `duracao-form.tsx`: a caixa
    // que nasce com o número do servidor não recebe rascunho, senão a tela
    // mostraria um valor que o banco não tem, sem dizer que não está salvo.
    expect(doServidor.map((c) => c.arquivo)).toEqual(["components/task/duracao-form.tsx"]);
    const sem = deCriacao
      .filter((c) => !c.gravaRascunho)
      .map((c) => `${c.arquivo}:${String(c.linha)} — <${c.tag} value={${c.valor}}>`);
    expect(
      sem,
      `campo de texto que a navegação apaga sem aviso:\n${sem.join("\n")}`,
    ).toEqual([]);
  });

  it("PRONTO QUANDO: todo arquivo com campo de texto também RESTAURA o rascunho", () => {
    // Gravar sem restaurar é metade do mecanismo — e meia restauração em
    // silêncio é o pior dos três desfechos (achado BAIXO da rodada 11).
    const comCampo = [
      ...new Set(camposDeTextoLivre().filter((c) => !c.nasceDoServidor).map((c) => c.arquivo)),
    ].sort();
    const restauram = new Set(arquivosQueRestauramRascunho());
    const faltam = comCampo.filter((a) => !restauram.has(a));
    expect(faltam, `grava rascunho e nunca o devolve:\n${faltam.join("\n")}`).toEqual([]);
    expect(comCampo.length).toBeGreaterThan(0);
  });
});
