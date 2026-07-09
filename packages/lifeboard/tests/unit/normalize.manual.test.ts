/**
 * OS-LIFEBOARD · E3 — Testes da entrada semi-manual (camada R).
 *
 * Cobre:
 *   1. Parser estrutural extrai as tarefas certas (marcadores, checkbox, data).
 *   2. Stress-3 do PRD §11: diff heurística/LLM-vs-bruto = 0 tarefas perdidas.
 *   3. GUARDA INVIOLÁVEL (PRD §10): quando o enriquecido perde uma tarefa,
 *      o sistema cai pro bruto — provado por fixture real e por caso sintético.
 *   4. Append-only: `mergeAppendOnly` nunca sobrescreve o que já existe.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  extractDueDate,
  parseStructural,
} from "@/adapters/manual/parser";
import {
  mergeAppendOnly,
  normalizeManual,
  normalizeResidualWithLLM,
} from "@/adapters/manual/normalize";
import type { Task } from "@/types/canonical";

// Data de referência fixa → datas dd/mm sem ano viram 2026 (determinismo).
const REF = new Date(2026, 6, 9); // 2026-07-09 (mês 0-based)
const NOW = "2026-07-09T00:00:00.000Z";

function loadFixture(name: string): string {
  return readFileSync(new URL(`../fixtures/manual/${name}`, import.meta.url), "utf8");
}

const NOTES = loadFixture("notes-iphone.txt");
const CLAUDE = loadFixture("claude-chat-export.md");

// ---------------------------------------------------------------------------
// 1. Parser estrutural
// ---------------------------------------------------------------------------

describe("parseStructural — reconhecimento estrutural (zero token)", () => {
  it("extrai as tarefas certas do bloco de Notas iPhone", () => {
    const res = parseStructural(NOTES, { referenceDate: REF });

    expect(res.tasks).toHaveLength(4);

    const [t1, t2, t3, t4] = res.tasks;
    expect(t1).toMatchObject({
      title: "Fechar copy da landing",
      dueDate: "2026-07-12",
      status: "open",
    });
    expect(t2).toMatchObject({
      title: "Revisar paleta com o designer",
      dueDate: null,
      status: "open",
    });
    expect(t3).toMatchObject({
      title: "Comprar domínio almapetra.com",
      dueDate: null,
      status: "done", // [x]
    });
    expect(t4).toMatchObject({
      title: "Gravar vídeo de abertura",
      dueDate: null,
      status: "open",
    });
  });

  it("separa o texto livre solto como resíduo (não como tarefa estrutural)", () => {
    const res = parseStructural(NOTES, { referenceDate: REF });
    // "Comprar presente..." e "Confirmar o cardápio..." caem sob "Ideias soltas:"
    expect(res.residualLines).toHaveLength(2);
    expect(res.blocks.map((b) => b.title)).toEqual([
      "Projeto Lançamento ALMA PETRA",
      "Ideias soltas",
    ]);
  });

  it("reconhece marcadores variados: bullet, checkbox, TODO e numerada", () => {
    const text = [
      "Tarefas",
      "- item bullet",
      "* item asterisco",
      "[ ] item checkbox",
      "[x] item feito",
      "TODO: item todo",
      "1. item numerado",
      "2) outro numerado",
    ].join("\n");
    const res = parseStructural(text, { referenceDate: REF });
    expect(res.tasks).toHaveLength(7);
    expect(res.tasks.find((t) => t.title === "item feito")?.status).toBe("done");
  });

  it("extractDueDate entende dd/mm e dd/mm/aaaa e limpa o título", () => {
    expect(extractDueDate("Entregar relatório 05/03", REF)).toEqual({
      title: "Entregar relatório",
      dueDate: "2026-03-05",
    });
    expect(extractDueDate("Pagar boleto 10/01/2027", REF)).toEqual({
      title: "Pagar boleto",
      dueDate: "2027-01-10",
    });
    expect(extractDueDate("Sem data aqui", REF)).toEqual({
      title: "Sem data aqui",
      dueDate: null,
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Stress-3 do PRD §11 — diff LLM/heurística vs bruto = 0 tarefas perdidas
// ---------------------------------------------------------------------------

describe("PRD §11 stress-3 — normalização não perde nenhuma tarefa vs bruto", () => {
  const titlesOf = (tasks: Task[]): Set<string> =>
    new Set(tasks.map((t) => t.title));

  for (const [name, text] of [
    ["notes-iphone", NOTES],
    ["claude-chat", CLAUDE],
  ] as const) {
    it(`diff = 0 para a fixture ${name}`, () => {
      const brute = normalizeManual(text, {
        useLLM: false,
        referenceDate: REF,
        now: NOW,
      });
      const final = normalizeManual(text, { referenceDate: REF, now: NOW });

      // Nenhuma tarefa que o bruto capturaria pode faltar no resultado final.
      const finalTitles = titlesOf(final.tasks);
      for (const t of brute.tasks) {
        expect(finalTitles.has(t.title)).toBe(true);
      }
      // E a contagem final nunca é menor que a bruta (piso de fidelidade).
      expect(final.tasks.length).toBeGreaterThanOrEqual(brute.tasks.length);
    });
  }

  it("fixture de Notas: enriquecido vence limpo (todo resíduo é acionável)", () => {
    const res = normalizeManual(NOTES, { referenceDate: REF, now: NOW });
    expect(res.strategy).toBe("enriched");
    expect(res.rescuedByGuard).toBe(0);
    expect(res.tasks).toHaveLength(6); // 4 estruturais + 2 residuais acionáveis
    expect(res.projects).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 3. GUARDA INVIOLÁVEL — fallback pro bruto quando o enriquecido perde tarefa
// ---------------------------------------------------------------------------

describe("PRD §10 — guarda inviolável (fallback determinístico)", () => {
  it("fixture de chat Claude: guarda dispara e resgata a tarefa em texto livre", () => {
    const res = normalizeManual(CLAUDE, { referenceDate: REF, now: NOW });

    // A heurística descartaria "Segue um resumo..." (ruído) E a linha do
    // contrato (tarefa real sem verbo-gatilho) → menos tarefas que o bruto.
    expect(res.strategy).toBe("brute-fallback");
    expect(res.rescuedByGuard).toBe(2);
    expect(res.tasks).toHaveLength(5);

    // A tarefa que SÓ o parsing bruto captura sobrevive no resultado final.
    const preserved = res.tasks.find((t) =>
      t.title.includes("contrato com o fornecedor"),
    );
    expect(preserved).toBeDefined();
  });

  it("caso sintético: enriquecido com MENOS itens força o fallback pro bruto", () => {
    // 1 tarefa estrutural + 2 residuais: 1 acionável, 1 sem gatilho (só o bruto pega).
    const synthetic = [
      "Semana",
      "- Enviar proposta para o cliente",
      "Anotações:",
      "Agendar call de kickoff",
      "aquela pendência antiga do rodapé continua lá", // sem verbo-gatilho → heurística ignora
    ].join("\n");

    const brute = normalizeManual(synthetic, {
      useLLM: false,
      referenceDate: REF,
      now: NOW,
    });
    const final = normalizeManual(synthetic, { referenceDate: REF, now: NOW });

    expect(brute.tasks.length).toBe(3); // estrutural + 2 residuais
    expect(final.strategy).toBe("brute-fallback");
    expect(final.rescuedByGuard).toBe(1);
    expect(final.tasks.map((t) => t.title)).toContain(
      "aquela pendência antiga do rodapé continua lá",
    );
  });

  it("normalizeResidualWithLLM é sempre um subconjunto do resíduo (nunca inventa)", () => {
    const structural = parseStructural(CLAUDE, { referenceDate: REF });
    const enriched = normalizeResidualWithLLM(
      structural.residualLines.map((r) => r.text).join("\n"),
      structural,
      { referenceDate: REF },
    );
    expect(enriched.length).toBeLessThanOrEqual(structural.residualLines.length);
    // Todo título enriquecido veio de uma linha residual real.
    const residualBlob = structural.residualLines.map((r) => r.text).join("\n");
    for (const t of enriched) {
      expect(residualBlob.includes(t.title.split(" até ")[0]!)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Append-only — nunca sobrescreve tarefas existentes (inclusive de outras fontes)
// ---------------------------------------------------------------------------

describe("append-only — mergeAppendOnly preserva o que já existe", () => {
  const calendarTask: Task = {
    id: "cal-1",
    projectId: "proj-cal",
    title: "Reunião marcada no Calendar",
    notes: null,
    dueDate: "2026-07-15",
    status: "open",
    priorityHierarq: { s1: 5, s2: 5, s3: 5 }, // prioridade DECLARADA
    predecessorIds: ["cal-0"], // dependência DECLARADA
    successorIds: [],
    sourceId: "calendar",
    externalRef: "evt-123",
    updatedAt: NOW,
  };

  it("não sobrescreve tarefas de outras fontes ao ingerir manual", () => {
    const manual = normalizeManual(NOTES, {
      referenceDate: REF,
      now: NOW,
      sourceId: "manual:notes",
      sourceKind: "notes",
    });

    const merged = mergeAppendOnly([calendarTask], manual.tasks);

    // A tarefa do Calendar continua intacta (deps e prioridade declaradas preservadas).
    const cal = merged.find((t) => t.id === "cal-1");
    expect(cal).toEqual(calendarTask);
    // E as manuais foram todas adicionadas.
    expect(merged.length).toBe(1 + manual.tasks.length);
  });

  it("é idempotente: re-mergear o mesmo conjunto não duplica", () => {
    const manual = normalizeManual(NOTES, {
      referenceDate: REF,
      now: NOW,
      sourceId: "manual:notes",
      sourceKind: "notes",
    });
    const once = mergeAppendOnly([calendarTask], manual.tasks);
    const twice = mergeAppendOnly(once, manual.tasks);
    expect(twice.length).toBe(once.length);
  });
});
