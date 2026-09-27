import { describe, expect, it } from "vitest";

import { elementosAcimaDaSecao } from "@/lib/altura-do-canvas";

/**
 * OS-LIFEBOARD · P4 — achados ALTO 1 e ALTO 2 do crítico hostil da rodada 10,
 * que são o MESMO defeito: **a altura da seção do grafo só era recalculada no
 * `resize` da janela.**
 *
 * Medido no Chromium em 22/09, sem resize nenhum: um clique no aviso
 * "5 fontes desatualizadas" abre a lista de chips, empurra a seção ~33 px para
 * baixo e a faixa "Hoje" cai de 44 px para **0 px** a 1024, 1280 e 1440 (10 px
 * a 1920). E a dívida ficava guardada: no primeiro resize — **2 px bastavam** —
 * os 33 px eram cobrados de uma vez, o pane caía de 507 px para 443 px, o
 * reenquadramento automático via aquilo como mudança material e desfazia o
 * zoom do operador (1,8 → 0,849).
 *
 * O conserto observa **o que está acima da seção**, e o conjunto observado é
 * derivado da árvore: para cada ancestral, os irmãos ANTERIORES. São
 * exatamente os elementos cuja altura entra em `topoDaSecao` — e nenhum deles
 * muda de tamanho quando a seção muda de altura, que é o que garante não haver
 * realimentação.
 *
 * Este teste roda em `environment: "node"`, sem DOM: `elementosAcimaDaSecao` é
 * pura sobre a interface de árvore, então uma árvore de mentira com
 * `parentElement` e `previousElementSibling` basta — e é ela que prova a
 * DERIVAÇÃO (o que entra e o que não entra), que é a decisão do conserto.
 */
interface NoDeMentira {
  nome: string;
  parentElement: NoDeMentira | null;
  previousElementSibling: NoDeMentira | null;
}

/** Monta uma árvore a partir de um objeto { pai: [filhos em ordem] }. */
function montar(estrutura: Record<string, string[]>): Map<string, NoDeMentira> {
  const nos = new Map<string, NoDeMentira>();
  const pegar = (nome: string): NoDeMentira => {
    const existente = nos.get(nome);
    if (existente) return existente;
    const novo: NoDeMentira = { nome, parentElement: null, previousElementSibling: null };
    nos.set(nome, novo);
    return novo;
  };
  for (const [pai, filhos] of Object.entries(estrutura)) {
    const noPai = pegar(pai);
    let anterior: NoDeMentira | null = null;
    for (const filho of filhos) {
      const no = pegar(filho);
      no.parentElement = noPai;
      no.previousElementSibling = anterior;
      anterior = no;
    }
  }
  return nos;
}

/** A árvore real do painel (`dashboard-client.tsx`), com o aviso presente. */
const ARVORE = montar({
  body: ["nav-global", "raiz"],
  raiz: ["header", "aviso-de-fontes", "abas", "corpo"],
  corpo: ["secao-do-grafo", "faixa-de-baixo"],
  "secao-do-grafo": ["titulo-do-grafo", "canvas"],
});

describe("elementosAcimaDaSecao", () => {
  it("pega TUDO o que fica acima da seção, em qualquer nível da árvore", () => {
    const acima = elementosAcimaDaSecao(
      ARVORE.get("secao-do-grafo") as unknown as Element,
    ) as unknown as NoDeMentira[];
    expect(acima.map((n) => n.nome).sort()).toEqual(
      ["abas", "aviso-de-fontes", "header", "nav-global"].sort(),
    );
  });

  it("NÃO pega o que está abaixo nem dentro — é o que impede a realimentação", () => {
    const acima = elementosAcimaDaSecao(
      ARVORE.get("secao-do-grafo") as unknown as Element,
    ) as unknown as NoDeMentira[];
    const nomes = acima.map((n) => n.nome);
    // A faixa de baixo e o corpo do grafo mudam de tamanho QUANDO a seção muda
    // de altura. Observá-los seria um laço.
    expect(nomes).not.toContain("faixa-de-baixo");
    expect(nomes).not.toContain("canvas");
    expect(nomes).not.toContain("titulo-do-grafo");
    expect(nomes).not.toContain("secao-do-grafo");
    expect(nomes).not.toContain("corpo");
  });

  it("o aviso de fontes desatualizadas está no conjunto — era ele que ninguém via", () => {
    const acima = elementosAcimaDaSecao(
      ARVORE.get("secao-do-grafo") as unknown as Element,
    ) as unknown as NoDeMentira[];
    expect(acima.map((n) => n.nome)).toContain("aviso-de-fontes");
  });

  it("árvore sem nada acima devolve vazio, sem inventar elemento", () => {
    const sozinha = montar({ body: ["secao"] });
    const acima = elementosAcimaDaSecao(sozinha.get("secao") as unknown as Element);
    expect(acima).toEqual([]);
  });
});
