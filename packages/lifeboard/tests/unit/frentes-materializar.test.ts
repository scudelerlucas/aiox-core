import { describe, expect, it } from "vitest";

import { detectCycleIds } from "@/core/prioritize/dag";
import { buildTodayList } from "@/core/prioritize/today";
import { fixtureFrentes } from "@/lib/frentes/fixture";
import {
  JANELA_BRANCH_DIAS,
  KIND_CONVERSA,
  KIND_GITHUB,
  idDaFontePadrao,
  idDaTarefaFrente,
  materializarFrentes,
  refDaBranch,
  refDoPr,
  refDaSessao,
  statusDaSessao,
  statusDoPr,
} from "@/lib/frentes/materializar";
import type { BranchSemPr, DadosFrentes, Pr, Sessao, Sync } from "@/lib/frentes/types";
import type { Task, TaskEdge } from "@/types/canonical";

/**
 * Tarefa Codex 01 — as frentes (mudanças, branches e conversas) viram tarefas
 * ligadas no grafo. Testes (a)–(d) do doc
 * `docs/lifeboard/TAREFA-CODEX-01-frentes-para-tarefas.md`; o (e) — o trigger
 * anti-ciclo do banco — segue em `tests/unit/dag.test.ts`, intocado.
 *
 * O (a) é o teste que FALHA ANTES e PASSA DEPOIS: antes desta rodada não existia
 * função nenhuma que ligasse conversa → branch → mudança; `tasks` tinha 0 arestas.
 */

const AGORA = Date.parse("2026-09-25T12:00:00.000Z");
const HORA = 3_600_000;
const DIA = 24 * HORA;
const h = (n: number): string => new Date(AGORA - n * HORA).toISOString();
const d = (n: number): string => new Date(AGORA - n * DIA).toISOString();

const HUB = "scudelerlucas/Lucas-Contexto-Geral";

function pr(over: Partial<Pr> = {}): Pr {
  return {
    repo: HUB,
    numero: 7,
    titulo: "feat(painel): filtros por conta",
    estado: "aberto",
    rascunho: false,
    branch: "claude/painel",
    url: "https://github.com/scudelerlucas/Lucas-Contexto-Geral/pull/7",
    criado_em: d(2),
    atualizado_em: h(2),
    fechado_em: null,
    mergeado_em: null,
    checks: "verde",
    sessao_ids: [],
    ...over,
  };
}

function branch(over: Partial<BranchSemPr> = {}): BranchSemPr {
  return {
    repo: HUB,
    branch: "claude/painel",
    ultimo_commit_em: h(3),
    ultimo_commit_msg: "feat(painel): filtros por conta",
    tem_pr: true,
    sessao_ids: [],
    ...over,
  };
}

function sessao(over: Partial<Sessao> = {}): Sessao {
  return {
    sessao_id: "session_01ABC",
    conta: "lucasscudeler@gmail.com",
    titulo: "Painel de assuntos: filtros por conta",
    estado: "working",
    estado_detalhe: null,
    precisa_de: null,
    branches: ["claude/painel"],
    repos: [HUB],
    url: "https://claude.ai/code/session_01ABC",
    criado_em: d(1),
    atualizado_em: h(2),
    ...over,
  };
}

const SYNC: Sync[] = [
  { fonte: "github", executado_em: h(1), ok: true },
  { fonte: "sessoes:lucasscudeler@gmail.com", executado_em: h(2), ok: true },
];

function dados(over: Partial<DadosFrentes> = {}): DadosFrentes {
  return { prs: [], branches: [], sessoes: [], sync: SYNC, ...over };
}

/** A cadeia mínima: 1 conversa → 1 branch → 1 mudança, com o dado declarando as duas pontas. */
function cadeia(): DadosFrentes {
  return dados({
    sessoes: [sessao()],
    branches: [branch({ sessao_ids: ["session_01ABC"] })],
    prs: [pr()],
  });
}

const idSessao = idDaTarefaFrente(KIND_CONVERSA, "session_01ABC");
const idBranch = idDaTarefaFrente(KIND_GITHUB, `${HUB}:claude/painel`);
const idPr = idDaTarefaFrente(KIND_GITHUB, `${HUB}#7`);

const porId = (tasks: Task[], id: string): Task => {
  const t = tasks.find((x) => x.id === id);
  if (!t) throw new Error(`tarefa ${id} não nasceu`);
  return t;
};
const arestas = (edges: TaskEdge[]): string[] =>
  edges.map((e) => `${e.origem}->${e.destino}`).sort();

describe("(a) 1 conversa → 1 branch → 1 mudança", () => {
  it("gera 3 tarefas e 2 arestas, no sentido de quem produziu", () => {
    const { tasks, edges } = materializarFrentes(cadeia(), { agora: AGORA });

    expect(tasks).toHaveLength(3);
    expect(edges).toHaveLength(2);
    expect(arestas(edges)).toEqual([`${idBranch}->${idPr}`, `${idSessao}->${idBranch}`].sort());
    for (const e of edges) {
      expect(e.tipo).toBe("predecessor");
      expect(e.peso).toBe(1);
    }
  });

  it("as duas representações batem: arrays e arestas contam a mesma história", () => {
    const { tasks } = materializarFrentes(cadeia(), { agora: AGORA });
    expect(porId(tasks, idSessao).successorIds).toEqual([idBranch]);
    expect(porId(tasks, idBranch).predecessorIds).toEqual([idSessao]);
    expect(porId(tasks, idBranch).successorIds).toEqual([idPr]);
    expect(porId(tasks, idPr).predecessorIds).toEqual([idBranch]);
    expect(porId(tasks, idSessao).predecessorIds).toEqual([]);
  });

  it("external_ref e fonte seguem o contrato do doc", () => {
    const { tasks } = materializarFrentes(cadeia(), { agora: AGORA });
    const s = porId(tasks, idSessao);
    const b = porId(tasks, idBranch);
    const p = porId(tasks, idPr);
    expect(s.externalRef).toBe("session_01ABC");
    expect(b.externalRef).toBe(`${HUB}:claude/painel`);
    expect(p.externalRef).toBe(`${HUB}#7`);
    expect(s.sourceId).toBe(idDaFontePadrao(KIND_CONVERSA));
    expect(b.sourceId).toBe(idDaFontePadrao(KIND_GITHUB));
    expect(p.sourceId).toBe(idDaFontePadrao(KIND_GITHUB));
    expect(refDaSessao(sessao())).toBe("session_01ABC");
    expect(refDaBranch(branch())).toBe(`${HUB}:claude/painel`);
    expect(refDoPr(pr())).toBe(`${HUB}#7`);
  });

  it("a conversa citada também na mudança não repete a ligação que já passa pela branch", () => {
    const comAtalho = dados({
      sessoes: [sessao()],
      branches: [branch({ sessao_ids: ["session_01ABC"] })],
      prs: [pr({ sessao_ids: ["session_01ABC"] })],
    });
    const { edges } = materializarFrentes(comAtalho, { agora: AGORA });
    expect(arestas(edges)).toEqual([`${idBranch}->${idPr}`, `${idSessao}->${idBranch}`].sort());
  });

  it("sem branch materializada, conversa → mudança liga direto (prs.sessao_ids)", () => {
    const semBranch = dados({
      sessoes: [sessao({ branches: [] })],
      prs: [pr({ sessao_ids: ["session_01ABC"] })],
    });
    const { tasks, edges } = materializarFrentes(semBranch, { agora: AGORA });
    expect(tasks.map((t) => t.id).sort()).toEqual([idPr, idSessao].sort());
    expect(arestas(edges)).toEqual([`${idSessao}->${idPr}`]);
  });

  it("a ligação conversa → branch vale pelos dois lados do dado", () => {
    // Só `sessoes.branches` diz (a linha da branch não traz sessao_ids)…
    const peloLadoDaConversa = dados({
      sessoes: [sessao()],
      branches: [branch({ sessao_ids: [], ultimo_commit_em: d(200) })],
    });
    expect(arestas(materializarFrentes(peloLadoDaConversa, { agora: AGORA }).edges)).toEqual([
      `${idSessao}->${idBranch}`,
    ]);
    // …ou só `branches.sessao_ids` diz (a conversa não lista a branch).
    const peloLadoDaBranch = dados({
      sessoes: [sessao({ branches: [] })],
      branches: [branch({ sessao_ids: ["session_01ABC"], ultimo_commit_em: d(200) })],
    });
    expect(arestas(materializarFrentes(peloLadoDaBranch, { agora: AGORA }).edges)).toEqual([
      `${idSessao}->${idBranch}`,
    ]);
  });

  it("o motor 'hoje' enxerga a precedência: a mudança espera a conversa acabar", () => {
    const { tasks } = materializarFrentes(cadeia(), { agora: AGORA });
    const hoje = buildTodayList(tasks).items.map((i) => i.task.id);
    expect(hoje).toEqual([idSessao]);
    expect(hoje).not.toContain(idBranch);
    expect(hoje).not.toContain(idPr);
  });
});

describe("(b) o que fechou não aparece", () => {
  it("conversa encerrada (done · completed · archived) não vira tarefa", () => {
    for (const estado of ["done", "completed", "archived"]) {
      const { tasks } = materializarFrentes(dados({ sessoes: [sessao({ estado })] }), {
        agora: AGORA,
      });
      expect(tasks).toHaveLength(0);
    }
  });

  it("mudança mergeada ou fechada não vira tarefa", () => {
    const { tasks } = materializarFrentes(
      dados({
        prs: [
          pr({ numero: 1, estado: "mergeado", mergeado_em: h(1) }),
          pr({ numero: 2, estado: "fechado", fechado_em: h(1) }),
        ],
      }),
      { agora: AGORA },
    );
    expect(tasks).toHaveLength(0);
  });

  it("a branch de uma mudança já mergeada, sem conversa e sem commit recente, some junto", () => {
    const { tasks } = materializarFrentes(
      dados({
        prs: [pr({ estado: "mergeado", mergeado_em: d(40) })],
        branches: [branch({ ultimo_commit_em: d(40) })],
      }),
      { agora: AGORA },
    );
    expect(tasks).toHaveLength(0);
  });
});

describe("(c) branch velha sem conversa não aparece", () => {
  it(`fora da janela de ${JANELA_BRANCH_DIAS} dias e sem conversa → nada`, () => {
    const velha = branch({
      branch: "claude/antiga",
      tem_pr: false,
      sessao_ids: [],
      ultimo_commit_em: d(JANELA_BRANCH_DIAS + 1),
    });
    expect(materializarFrentes(dados({ branches: [velha] }), { agora: AGORA }).tasks).toEqual([]);
  });

  it("dentro da janela entra, mesmo sem conversa e sem mudança", () => {
    const recente = branch({
      branch: "claude/recente",
      tem_pr: false,
      sessao_ids: [],
      ultimo_commit_em: d(JANELA_BRANCH_DIAS - 1),
    });
    const { tasks } = materializarFrentes(dados({ branches: [recente] }), { agora: AGORA });
    expect(tasks.map((t) => t.externalRef)).toEqual([`${HUB}:claude/recente`]);
    expect(tasks[0]?.status).toBe("open");
  });

  it("velha, mas com conversa ligada → entra (a conversa é o que a mantém viva)", () => {
    const velhaComConversa = branch({
      branch: "claude/antiga",
      tem_pr: false,
      sessao_ids: ["sess_x"],
      ultimo_commit_em: d(200),
    });
    const { tasks } = materializarFrentes(dados({ branches: [velhaComConversa] }), {
      agora: AGORA,
    });
    expect(tasks).toHaveLength(1);
  });

  it("branch genérica (main, develop…) nunca vira tarefa", () => {
    const { tasks } = materializarFrentes(
      dados({
        branches: [
          branch({ branch: "main", ultimo_commit_em: h(1), tem_pr: false }),
          branch({ branch: "develop", ultimo_commit_em: h(1), tem_pr: false }),
        ],
      }),
      { agora: AGORA },
    );
    expect(tasks).toHaveLength(0);
  });

  it("o volume real não afoga o grafo: a fixture da aba Assuntos entra filtrada", () => {
    const frentes = fixtureFrentes(AGORA);
    const { tasks } = materializarFrentes(frentes, { agora: AGORA });
    const branchesMaterializadas = tasks.filter((t) => t.externalRef.includes(":claude/"));
    expect(branchesMaterializadas.length).toBeLessThan(frentes.branches.length);
    expect(branchesMaterializadas.length).toBeGreaterThan(0);
  });
});

describe("(d) idempotência", () => {
  it("2 execuções = mesmas tarefas, mesmas arestas, byte a byte", () => {
    const uma = materializarFrentes(cadeia(), { agora: AGORA });
    const outra = materializarFrentes(cadeia(), { agora: AGORA });
    expect(outra).toEqual(uma);
    expect(JSON.stringify(outra)).toBe(JSON.stringify(uma));
  });

  it("a mesma linha lida duas vezes não duplica (chave (fonte, external_ref))", () => {
    const duplicado = dados({
      sessoes: [sessao(), sessao()],
      branches: [branch(), branch()],
      prs: [pr(), pr()],
    });
    const { tasks, edges } = materializarFrentes(duplicado, { agora: AGORA });
    expect(tasks).toHaveLength(3);
    expect(edges).toHaveLength(2);
    const chaves = tasks.map((t) => `${t.sourceId}|${t.externalRef}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("o id da fonte é injetável: em produção é a linha real de `sources`", () => {
    const { tasks } = materializarFrentes(cadeia(), {
      agora: AGORA,
      idDaFonte: (kind) => `fonte-real-${kind}`,
    });
    expect(porId(tasks, idSessao).sourceId).toBe("fonte-real-claude_chat");
    expect(porId(tasks, idPr).sourceId).toBe("fonte-real-github");
  });
});

describe("acíclico por construção (complementa o (e) do banco)", () => {
  it("nem a fixture inteira nem a cadeia produzem ciclo de precedência", () => {
    for (const entrada of [cadeia(), fixtureFrentes(AGORA)]) {
      const { tasks, edges } = materializarFrentes(entrada, { agora: AGORA });
      expect(detectCycleIds(tasks, edges).size).toBe(0);
      for (const e of edges) expect(e.origem).not.toBe(e.destino);
    }
  });
});

describe("status e texto", () => {
  it("estado da conversa → status canônico", () => {
    expect(statusDaSessao("working")).toBe("in_progress");
    expect(statusDaSessao("blocked")).toBe("blocked");
    expect(statusDaSessao("need_input")).toBe("blocked");
    expect(statusDaSessao("review_ready")).toBe("open");
    expect(statusDaSessao("idle")).toBe("open");
  });

  it("testes e rascunho da mudança → status canônico", () => {
    expect(statusDoPr(pr({ checks: "vermelho" }))).toBe("blocked");
    expect(statusDoPr(pr({ rascunho: true }))).toBe("in_progress");
    expect(statusDoPr(pr({ checks: "pendente" }))).toBe("in_progress");
    expect(statusDoPr(pr({ checks: "verde" }))).toBe("open");
    expect(statusDoPr(pr({ checks: null }))).toBe("open");
  });

  it("conversa sem título ganha o id curto; as notas trazem o que ela precisa", () => {
    const { tasks } = materializarFrentes(
      dados({
        sessoes: [
          sessao({
            titulo: null,
            estado: "need_input",
            precisa_de: "aprovar o texto do e-mail",
            estado_detalhe: "aguardando resposta",
          }),
        ],
      }),
      { agora: AGORA },
    );
    const t = porId(tasks, idSessao);
    expect(t.title).toBe("Conversa 01ABC");
    expect(t.status).toBe("blocked");
    expect(t.notes).toContain("aprovar o texto do e-mail");
    expect(t.notes).toContain("aguardando resposta");
    expect(t.notes).toContain("https://claude.ai/code/session_01ABC");
  });

  it("as fontes saem com o frescor de `painel_frentes_sync`", () => {
    const { fontes } = materializarFrentes(cadeia(), { agora: AGORA });
    expect(fontes.map((f) => f.kind).sort()).toEqual(["claude_chat", "github"]);
    expect(fontes.find((f) => f.kind === "github")?.lastSyncAt).toBe(h(1));
    expect(fontes.find((f) => f.kind === "claude_chat")?.lastSyncAt).toBe(h(2));
  });
});
