import { describe, expect, it } from "vitest";

import { layoutDoGrafo } from "@/lib/layout-do-grafo";

/**
 * OS-LIFEBOARD · P4b — fixture do achado CRÍTICO do crítico hostil: o layout
 * em grade (`col = i % COLS_MAX` sobre o índice de encontro) empilhava "Daily
 * standup" (sem predecessor/sucessor nenhum) na MESMA coluna e entre as linhas
 * visuais de setup→build→deploy, por pura coincidência de sub-linha de
 * transbordo — a aresta crítica passava reto por cima do card dele.
 */
const IDS = ["setup", "standup", "build", "deploy", "review"] as const;
const EDGES = [
  { origem: "setup", destino: "build" },
  { origem: "build", destino: "deploy" },
  // "review" pula direto para "deploy" sem passar por "build" — rank 0 → rank 2,
  // pula o rank 1 (onde "build" mora) — é a aresta review→deploy do fixture real.
  { origem: "review", destino: "deploy" },
];

describe("layoutDoGrafo — rank por caminho mais longo + coluna estável", () => {
  it("setup, build e deploy caem em ranks (linhas) distintos", () => {
    const { nodes } = layoutDoGrafo({ ids: [...IDS], edges: EDGES });
    expect(nodes.get("setup")?.rank).toBe(0);
    expect(nodes.get("build")?.rank).toBe(1);
    expect(nodes.get("deploy")?.rank).toBe(2);
  });

  it("'standup' (sem predecessor/sucessor) fica no rank 0 — NUNCA numa linha intermediária", () => {
    const { nodes } = layoutDoGrafo({ ids: [...IDS], edges: EDGES });
    const standup = nodes.get("standup");
    const setup = nodes.get("setup");
    const build = nodes.get("build");
    const deploy = nodes.get("deploy");
    expect(standup?.rank).toBe(0);
    // A prova concreta do bug anterior: o rank de standup é IGUAL ao de setup
    // (mesma linha), então ele nunca pode ficar visualmente "entre" setup e
    // build/deploy — era exatamente essa a coincidência de sub-linha que o
    // layout antigo produzia.
    expect(standup?.y).toBe(setup?.y);
    expect(standup?.y).toBeLessThan(build!.y);
    expect(standup?.y).toBeLessThan(deploy!.y);
  });

  it("coluna é estável: crítico primeiro, depois por id — nunca pela ordem de chegada", () => {
    const idsForaDeOrdem = ["zzz", "aaa", "setup", "build", "deploy", "standup", "review"];
    const { nodes } = layoutDoGrafo({
      ids: idsForaDeOrdem,
      edges: EDGES,
      criticoIds: ["setup", "build", "deploy"],
    });
    // Rank 0: aaa, review, setup, standup, zzz (todos sem predecessor) —
    // crítico (setup) primeiro, depois os demais por id ascendente.
    expect(nodes.get("setup")?.coluna).toBe(0);
    const rank0PorColuna = [...nodes.values()]
      .filter((n) => n.rank === 0)
      .sort((a, b) => a.coluna - b.coluna)
      .map((n) => n.id);
    expect(rank0PorColuna[0]).toBe("setup"); // único crítico do rank 0
    expect(rank0PorColuna.slice(1)).toEqual(["aaa", "review", "standup", "zzz"]); // resto por id
  });

  it("mesma entrada produz sempre o mesmo layout (determinístico, sem depender de ordem de array)", () => {
    const a = layoutDoGrafo({ ids: [...IDS], edges: EDGES, criticoIds: ["setup", "build", "deploy"] });
    const b = layoutDoGrafo({
      ids: [...IDS].reverse(),
      edges: [...EDGES].reverse(),
      criticoIds: ["setup", "build", "deploy"],
    });
    for (const id of IDS) {
      expect(b.nodes.get(id)).toEqual(a.nodes.get(id));
    }
  });

  it("aresta que pula rank (review→deploy, pula o rank de 'build') ganha desviar=true e desvioPx>0 — a célula intermediária ('build', rank 1) está ocupada na coluna de destino", () => {
    const { edges } = layoutDoGrafo({
      ids: [...IDS],
      edges: EDGES,
      criticoIds: ["setup", "build", "deploy"],
    });
    const reviewDeploy = edges.find((e) => e.origem === "review" && e.destino === "deploy");
    expect(reviewDeploy?.pulaRank).toBe(true);
    // P4c (achado CRÍTICO #2 do crítico hostil ROUND 2): a v P4b só testava
    // "é boolean" — passava mesmo com `desviar` sempre false. O fixture tem
    // "build" (único nó do rank 1) na coluna de "deploy" (destino) — É a
    // obstrução real; o valor tem que ser `true`, não só "é um boolean".
    expect(reviewDeploy?.desviar).toBe(true);
    expect(reviewDeploy?.desvioPx).toBeGreaterThan(0);
    // P4c (achado CRÍTICO #2): a faixa vertical que o desvio contorna tem que
    // existir e cobrir o rank de "build" (rank 1) — é o que `v3-edge.tsx`
    // usa pra desenhar o path ortogonal que de fato sai da coluna.
    const build = layoutDoGrafo({
      ids: [...IDS],
      edges: EDGES,
      criticoIds: ["setup", "build", "deploy"],
    }).nodes.get("build")!;
    expect(reviewDeploy?.desvioYInicio).toBeLessThanOrEqual(build.y);
    expect(reviewDeploy?.desvioYFim).toBeGreaterThanOrEqual(build.y + 112);
  });

  it("aresta adjacente (rank a rank+1) nunca pula — desviar sempre false, sem faixa de desvio", () => {
    const { edges } = layoutDoGrafo({ ids: [...IDS], edges: EDGES });
    const setupBuild = edges.find((e) => e.origem === "setup" && e.destino === "build");
    expect(setupBuild?.pulaRank).toBe(false);
    expect(setupBuild?.desviar).toBe(false);
    expect(setupBuild?.desvioYInicio).toBeUndefined();
    expect(setupBuild?.desvioYFim).toBeUndefined();
  });

  it("nenhum nó ocupa o corredor vertical de uma aresta SEM desvio, usando nodeW/nodeH do próprio layout (achado CRÍTICO #1)", () => {
    const nodeW = 200;
    const nodeH = 112;
    const gapX = 56;
    const gapY = 84;
    const { nodes, edges } = layoutDoGrafo({
      ids: [...IDS],
      edges: EDGES,
      criticoIds: ["setup", "build", "deploy"],
      nodeW,
      nodeH,
      gapX,
      gapY,
    });
    for (const aresta of edges) {
      if (aresta.desviar) continue; // rota de desvio é outra faixa — testada acima
      const o = nodes.get(aresta.origem);
      const d = nodes.get(aresta.destino);
      if (!o || !d) continue;
      const colX = o.x + nodeW / 2;
      const y0 = o.y + nodeH; // sai do handle de baixo da origem
      const y1 = d.y; // entra no handle de cima do destino
      for (const [id, n] of nodes) {
        if (id === aresta.origem || id === aresta.destino) continue;
        const dentroX = colX > n.x && colX < n.x + nodeW;
        const dentroY = n.y < y1 && n.y + nodeH > y0;
        expect(dentroX && dentroY).toBe(false);
      }
    }
  });

  // ── P4d (rodada 3) — achado ALTO #4 + MÉDIO #5: handle por rank relativo ──

  it("aresta 'PRA TRÁS' (destino de rank MENOR, ex. obsolescência build→standup) desvia contornando o rank intermediário — nunca degenera (desvioYInicio !== desvioYFim)", () => {
    // rank0: r0 · rank1: r1 · rank2: r2 — uma coluna só, então r1 SEMPRE está
    // no corredor vertical entre r0 e r2 (mesma coluna). "voltar" de r2 pra r0
    // (rank 2 → rank 0, pula o rank 1 onde mora r1) é a mesma forma da
    // obsolescência real do fixture (`task-build`(rank1)→`task-archive`(rank0)).
    const idsBack = ["r0", "r1", "r2"];
    const edgesForward = [
      { origem: "r0", destino: "r1" },
      { origem: "r1", destino: "r2" },
    ];
    const { nodes, edges } = layoutDoGrafo({
      ids: idsBack,
      edges: edgesForward,
      todasArestas: [...edgesForward, { origem: "r2", destino: "r0" }],
    });
    const r1 = nodes.get("r1")!;
    const voltando = edges.find((e) => e.origem === "r2" && e.destino === "r0");
    expect(voltando?.desviar).toBe(true);
    // Nunca degenerado (achado MÉDIO #5): início estritamente antes do fim.
    expect(voltando!.desvioYInicio).toBeLessThan(voltando!.desvioYFim!);
    // A faixa contornada cobre o rank intermediário (r1) inteiro — a mesma
    // prova que já existia para o pulo "pra frente" (review→deploy), agora
    // também para o pulo "pra trás".
    expect(voltando?.desvioYInicio).toBeLessThanOrEqual(r1.y);
    expect(voltando?.desvioYFim).toBeGreaterThanOrEqual(r1.y + 112);
  });

  it("aresta de MESMO rank (ex. sinergia entre dois nós do rank 0) nunca aciona desvio — rota direta, nunca degenerada (achado MÉDIO #5)", () => {
    // 3 nós, todos sem predecessor/sucessor → todos rank 0. Coluna por id
    // ascendente: "a" < "meio" < "z" — "meio" fica ENTRE "a" e "z".
    const { edges } = layoutDoGrafo({
      ids: ["a", "meio", "z"],
      edges: [],
      todasArestas: [{ origem: "a", destino: "z" }],
    });
    const aZ = edges.find((e) => e.origem === "a" && e.destino === "z");
    // P4d: com o handle Top/Top (mesmo rank), sourceY===targetY (o topo da
    // fileira) — a checagem de bloqueio geométrico é estrita (`>`), então
    // NENHUM nó da própria fileira aciona `desviar`; a rota é sempre direta,
    // ao longo do topo da fileira, nunca atravessando o interior de "meio".
    expect(aZ?.desviar).toBe(false);
    expect(aZ?.desvioYInicio).toBeUndefined();
    expect(aZ?.desvioYFim).toBeUndefined();
  });

  it("ciclo não trava (corta em rank 0, layout ainda sai)", () => {
    const { nodes } = layoutDoGrafo({
      ids: ["a", "b"],
      edges: [
        { origem: "a", destino: "b" },
        { origem: "b", destino: "a" },
      ],
    });
    expect(nodes.size).toBe(2);
    expect(Number.isFinite(nodes.get("a")?.rank)).toBe(true);
    expect(Number.isFinite(nodes.get("b")?.rank)).toBe(true);
  });
});
