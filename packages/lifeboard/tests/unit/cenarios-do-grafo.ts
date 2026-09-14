/**
 * OS-LIFEBOARD · P4f — cenários de grafo compartilhados pelas medições.
 *
 * Não é um arquivo de teste (nenhum `describe`): é a FONTE ÚNICA dos grafos
 * que `caminho-ortogonal.test.ts` (segmento × cartão) e `canais-de-aresta.test.ts`
 * (sobreposição colinear) medem — e o mesmo cenário de 40 tarefas que a
 * medição no navegador monta. Dois arquivos de teste com o próprio gerador
 * seriam duas topologias divergindo em silêncio.
 */

import type { ArestaParaRotear } from "@/lib/layout-do-grafo";

/** Fixture da casa (11 tarefas, a mesma topologia de `tasks.fixture.ts`). */
export const FIXTURE_11 = {
  ids: [
    "task-setup",
    "task-build",
    "task-deploy",
    "task-review",
    "task-chat-followup",
    "task-docs",
    "task-triage",
    "task-standup",
    "task-notes-idea",
    "task-archive",
    "task-inbox",
  ],
  edges: [
    { origem: "task-setup", destino: "task-build" },
    { origem: "task-build", destino: "task-deploy" },
    { origem: "task-review", destino: "task-chat-followup" },
    { origem: "task-review", destino: "task-deploy" },
  ],
  extras: [
    { id: "correlacao:docs-build", origem: "task-docs", destino: "task-build" },
    { id: "sinergia:triage-notes", origem: "task-triage", destino: "task-notes-idea" },
    { id: "obsolescencia:build-archive", origem: "task-build", destino: "task-archive" },
  ],
  criticoIds: ["task-setup", "task-build", "task-deploy"],
};

/**
 * Cenário de 40 tarefas — o MESMO que a medição no navegador usa (5 ranks:
 * 12 · 12 · 6 · 6 · 4). Com 6 colunas por linha ele ocupa 7 linhas; com 3,
 * 14 linhas.
 */
export function grafo40(): {
  ids: string[];
  edges: { origem: string; destino: string }[];
  todasArestas: ArestaParaRotear[];
  criticoIds: string[];
} {
  const tamanhos = [12, 12, 6, 6, 4];
  const porRank = tamanhos.map((n, r) =>
    Array.from({ length: n }, (_, i) => `t${r}-${String(i).padStart(2, "0")}`),
  );
  const ids = porRank.flat();
  const edges: { origem: string; destino: string }[] = [];
  for (let r = 1; r < porRank.length; r++) {
    porRank[r]!.forEach((id, i) => {
      edges.push({ origem: porRank[r - 1]![i % porRank[r - 1]!.length]!, destino: id });
    });
  }
  const todasArestas: ArestaParaRotear[] = edges.map((e) => ({
    id: `sucessao:${e.origem}->${e.destino}`,
    ...e,
  }));
  // As outras camadas: correlação entre irmãos, sinergia pulando ranks,
  // obsolescência voltando para trás — e uma correlação sobre o MESMO par de
  // uma sucessão (o caso que a rodada 4 desenhava uma em cima da outra).
  for (let i = 0; i + 1 < porRank[0]!.length; i += 2) {
    todasArestas.push({
      id: `correlacao:irmaos-${i}`,
      origem: porRank[0]![i]!,
      destino: porRank[0]![i + 1]!,
    });
  }
  todasArestas.push({
    id: "correlacao:mesmo-par-da-sucessao",
    origem: edges[0]!.origem,
    destino: edges[0]!.destino,
  });
  for (let i = 0; i < porRank[2]!.length; i++) {
    todasArestas.push({
      id: `sinergia:${i}`,
      origem: porRank[0]![i]!,
      destino: porRank[2]![i]!,
    });
  }
  for (let i = 0; i < porRank[4]!.length; i++) {
    todasArestas.push({
      id: `obsolescencia:${i}`,
      origem: porRank[4]![i]!,
      destino: porRank[0]![i]!,
    });
  }
  const criticoIds = porRank.map((r) => r[0]!);
  return { ids, edges, todasArestas, criticoIds };
}

export function cadeia200(): {
  ids: string[];
  edges: { origem: string; destino: string }[];
  todasArestas: ArestaParaRotear[];
} {
  const ids = Array.from({ length: 200 }, (_, i) => `c${String(i).padStart(3, "0")}`);
  const edges = ids.slice(0, -1).map((id, i) => ({ origem: id, destino: ids[i + 1]! }));
  const extras: { origem: string; destino: string }[] = [];
  for (let i = 0; i + 4 < ids.length; i += 7) {
    extras.push({ origem: ids[i]!, destino: ids[i + 4]! }); // salto à frente
    extras.push({ origem: ids[i + 4]!, destino: ids[i]! }); // e a volta pelo mesmo vão
  }
  extras.push({ origem: ids[199]!, destino: ids[0]! }); // a volta mais longa possível
  const todasArestas = [...edges, ...extras].map((e, i) => ({ id: `e${i}`, ...e }));
  return { ids, edges, todasArestas };
}

export function arvore200(): {
  ids: string[];
  edges: { origem: string; destino: string }[];
  todasArestas: ArestaParaRotear[];
} {
  const ids: string[] = ["n000"];
  const edges: { origem: string; destino: string }[] = [];
  const RAMO = 3;
  for (let i = 1; ids.length < 200; i++) {
    const pai = ids[Math.floor((i - 1) / RAMO)]!;
    const id = `n${String(i).padStart(3, "0")}`;
    ids.push(id);
    edges.push({ origem: pai, destino: id });
  }
  const extras: { origem: string; destino: string }[] = [];
  for (let i = 4; i + 1 < ids.length; i += 5) {
    extras.push({ origem: ids[i]!, destino: ids[i + 1]! }); // irmão/primo
    extras.push({ origem: ids[i + 1]!, destino: ids[i]! }); // e a volta
  }
  for (let i = 40; i < ids.length; i += 11) {
    extras.push({ origem: ids[0]!, destino: ids[i]! }); // raiz → neto distante
    extras.push({ origem: ids[i]!, destino: ids[0]! }); // neto distante → raiz
  }
  const todasArestas = [...edges, ...extras].map((e, i) => ({ id: `e${i}`, ...e }));
  return { ids, edges, todasArestas };
}


/** As 7 arestas visuais do fixture de 11 (sucessões + as 3 outras camadas). */
export function arestasDo11(): ArestaParaRotear[] {
  return [
    ...FIXTURE_11.edges.map((e) => ({ id: `sucessao:${e.origem}->${e.destino}`, ...e })),
    ...FIXTURE_11.extras,
  ];
}
