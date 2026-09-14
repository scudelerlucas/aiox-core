import { renderToStaticMarkup } from "react-dom/server";
import { ReactFlowProvider } from "reactflow";
import { describe, expect, it } from "vitest";

import { TaskNode, type TaskNodeData } from "@/components/graph/task-node";
import {
  caracteresQueCabemNoTitulo,
  tipografiaDoCartao,
  tituloSeraCortado,
} from "@/components/graph/tipografia-do-cartao";
import type { Task } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P4h — achado MÉDIO #5 do crítico hostil ROUND 8: **a pastilha
 * corta o título antes da palavra que distingue.**
 *
 * Medido: a 390px os 40 cartões mostravam ~11 caracteres — "Revisar o …",
 * "Gravar a …", "Publicar a…", "Fechar co…", doze vizinhos indistinguíveis; a
 * 1280 com 11 tarefas, ~18 caracteres, e a META do CPM aparecia como "META
 * Deplo…". O `title` só chega ao MOUSE.
 *
 * Corrigido o achado #1, o zoom volta a ser caminho de leitura. O que sobra é
 * o caminho SEM MOUSE: Tab até o cartão, Espaço para marcar — e o nome inteiro
 * aparece num painel. Este arquivo mede esse painel.
 */

const NOME_LONGO = "Revisar o contrato da Casa Torres com o jurídico";

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: "p",
    title: NOME_LONGO,
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: { s1: 1, s2: 1, s3: 1 },
    predecessorIds: [],
    successorIds: [],
    sourceId: "s",
    externalRef: "t1",
    updatedAt: "2026-09-13T00:00:00.000Z",
    estimativaDias: null,
    iniciadoEm: null,
    parentId: null,
    isGoal: false,
    assimetria: null,
    ...over,
  };
}

function montar(over: Partial<TaskNodeData> = {}, selected = false): string {
  const data: TaskNodeData = {
    task: task(),
    sourceKind: "calendar",
    sourceLabel: "Calendário",
    blockedByPredecessor: false,
    inCycle: false,
    ...over,
  };
  return renderToStaticMarkup(
    <ReactFlowProvider>
      <TaskNode
        id="t1"
        data={data}
        selected={selected}
        type="task"
        zIndex={0}
        isConnectable
        xPos={0}
        yPos={0}
        dragging={false}
      />
    </ReactFlowProvider>,
  );
}

describe("o nome inteiro tem caminho SEM MOUSE (achado MÉDIO #5)", () => {
  it("cartão NÃO selecionado: o título é truncado e não há painel (nada de ruído)", () => {
    const html = montar();
    expect(html).toContain("truncate");
    expect(html).not.toContain("data-nome-inteiro");
  });

  it("cartão SELECIONADO com nome longo: o nome inteiro aparece, quebrando linha", () => {
    const html = montar({}, true);
    expect(html).toContain(`data-nome-inteiro="${NOME_LONGO}"`);
    // O painel quebra linha — é o que separa "mostrar o nome" de "truncar de novo".
    expect(html).toMatch(/data-nome-inteiro[^>]*class="[^"]*whitespace-normal/);
    expect(html).toMatch(/data-nome-inteiro[^>]*class="[^"]*break-words/);
    // E o cartão solta o `overflow-hidden` enquanto o painel está aberto —
    // senão ele cortaria o próprio conserto.
    expect(html).not.toContain("overflow-hidden");
  });

  it("cartão SELECIONADO com nome curto: nenhum painel (não havia corte para consertar)", () => {
    const html = montar({ task: task({ title: "Deploy" }) }, true);
    expect(html).not.toContain("data-nome-inteiro");
  });

  it("o painel é `aria-hidden` — o rótulo acessível já começa pelo título inteiro", () => {
    const html = montar({}, true);
    expect(html).toContain(`aria-label="${NOME_LONGO},`);
    expect(html).toMatch(/aria-hidden="true"[^>]*data-nome-inteiro/);
  });
});

describe("a régua de quantos caracteres cabem (a estimativa que decide o painel)", () => {
  it("modo mapa a 0,5 de zoom: perto dos ~11 caracteres que o crítico contou a 390px", () => {
    const tipo = tipografiaDoCartao(0.5);
    expect(tipo.modo).toBe("mapa");
    const cabem = caracteresQueCabemNoTitulo({
      modo: tipo.modo,
      tituloPx: tipo.tituloPx,
      dadoPx: tipo.dadoPx,
    });
    expect(cabem).toBeGreaterThanOrEqual(9);
    expect(cabem).toBeLessThanOrEqual(14);
  });

  it("modo cartão a zoom 1: cabe mais, e um nome curto deixa de ser 'cortado'", () => {
    const tipo = tipografiaDoCartao(1);
    expect(tipo.modo).toBe("cartao");
    const p = { modo: tipo.modo, tituloPx: tipo.tituloPx, dadoPx: tipo.dadoPx };
    expect(caracteresQueCabemNoTitulo(p)).toBeGreaterThan(
      caracteresQueCabemNoTitulo({
        modo: "mapa",
        tituloPx: tipografiaDoCartao(0.5).tituloPx,
        dadoPx: tipografiaDoCartao(0.5).dadoPx,
      }),
    );
    expect(tituloSeraCortado("Deploy", p)).toBe(false);
    expect(tituloSeraCortado(NOME_LONGO, p)).toBe(true);
  });

  it("a META no modo cartão usa 2 linhas — o dobro de caracteres antes de cortar", () => {
    const tipo = tipografiaDoCartao(1);
    const base = { modo: tipo.modo, tituloPx: tipo.tituloPx, dadoPx: tipo.dadoPx };
    const nome = "x".repeat(caracteresQueCabemNoTitulo(base) + 2);
    expect(tituloSeraCortado(nome, base)).toBe(true);
    expect(tituloSeraCortado(nome, { ...base, temMeta: true })).toBe(false);
  });
});
