import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { expandir, todasAsTags } from "./arvore-react";
import { janelaFalsa, montar, novaInstancia, reactFalso } from "./hooks-falsos";
import {
  arquivosComInput,
  escritasNoDom,
  PROPRIEDADES_TOLERADAS,
} from "./tarefa-varredura-derivada";

/**
 * ═══════════════════════════════════════════════════════ ALTO #2, rodada 12 ═
 * A TRAVA PASSA A MEDIR O ELEMENTO RENDERIZADO — NÃO O TEXTO DO ARQUIVO.
 *
 * O que a peça prometia, no cabeçalho de `campo-numerico.tsx`: *"a trava que
 * impede a volta: `tarefa-escritas-varredura.test.ts` recusa qualquer
 * `<input type="number"` em `components/task/**`"*. Essa trava era uma
 * expressão regular sobre a STRING do fonte — ela media a forma do texto, e
 * não a propriedade que importa: **o campo entregar ao programa o que o
 * operador vê na caixa**.
 *
 * O crítico da rodada 11 passou por ela com três linhas de um padrão banal de
 * "props compartilhadas":
 *
 *     const AJUSTES_DO_TECLADO: Record<string, string> = { type: "number", step: "0.25" };
 *     <input type="text" inputMode="decimal" {...AJUSTES_DO_TECLADO} … />
 *
 * (`Record<string, string>` em vez de `as const` é o que evita o TS2783 — com
 * `as const` o `tsc` acusa; sem, não acusa.) Resultado medido: `tsc` limpo,
 * `eslint` limpo, **1412 testes verdes** — inclusive os dois que existiam
 * exatamente para isto —, e no Chromium, em `/tarefa/task-build`: o `type` do
 * input no DOM virava `number`, digitar `e` mostrava `3e` na caixa, o React
 * lia `""` (`badInput: true`), a tela dizia **"Duração removida."** e o banco
 * ficava `null`. O CRÍTICO da rodada 10 voltava inteiro, com os quatro
 * portões verdes.
 *
 * O que esta suíte mede, em vez daquilo: os componentes são CHAMADOS, a
 * árvore é EXPANDIDA até os elementos de HTML (`expandir`, em
 * `arvore-react.ts`), e a pergunta é feita ao `<input>` que o React entregaria
 * ao DOM — onde o espalhamento já venceu, a variável já foi resolvida e o
 * componente que envolve o campo já foi renderizado.
 *
 * O que ela NÃO alcança, e por isso tem uma segunda rede: mexer no nó do DOM
 * por fora do React (`ref={(el) => { el.type = "number"; }}`,
 * `Object.assign(el, …)`, `el[k] = v`, `setAttribute`). Essa família é
 * proibida por inteiro nos arquivos da página (`escritasNoDom`, rodada 13).
 */

vi.mock("react", () => reactFalso);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/tarefa/actions", () => ({
  escreverTarefaAction: (): unknown => ({ ok: true }),
}));

const { DuracaoForm } = await import("@/components/task/duracao-form");
const { NotasPainel } = await import("@/components/task/notas-painel");
const { SubtarefasPainel } = await import("@/components/task/subtarefas-painel");

const NOTA = {
  id: "n1",
  taskId: "task-docs",
  texto: "primeira",
  autor: "Claude",
  createdAt: "2026-07-09T10:00:00.000Z",
} as const;

interface Montagem {
  nome: string;
  /** O arquivo de `components/task` cujo `<input>` esta montagem alcança. */
  cobre: readonly string[];
  arvore: () => ReactNode;
}

/**
 * As telas que se monta aqui. A lista é curta de propósito — o que impede
 * alguém de acrescentar um campo novo e esquecer de cobri-lo NÃO é esta lista
 * (que é escrita à mão), é o teste de cobertura logo abaixo: os arquivos com
 * `<input>` saem do fonte, e têm de bater exatamente com o que se cobre aqui.
 */
const MONTAGENS: readonly Montagem[] = [
  {
    nome: "DuracaoForm",
    cobre: ["components/task/campo-numerico.tsx"],
    arvore: () =>
      montar(novaInstancia(), DuracaoForm, { taskId: "task-docs", estimativaDias: 2 }),
  },
  {
    nome: "NotasPainel",
    cobre: ["components/task/notas-painel.tsx"],
    arvore: () =>
      montar(novaInstancia(), NotasPainel, {
        taskId: "task-docs",
        notas: [NOTA],
        agora: Date.parse("2026-07-09T12:00:00.000Z"),
      }),
  },
  {
    nome: "SubtarefasPainel",
    cobre: ["components/task/subtarefas-painel.tsx", "components/task/campo-numerico.tsx"],
    arvore: () => montar(novaInstancia(), SubtarefasPainel, { parentId: "task-docs", filhas: [] }),
  },
];

function inputsRenderizados(m: Montagem): Record<string, unknown>[] {
  return todasAsTags(expandir(m.arvore()), "input").map((n) => n.props);
}

beforeEach(() => {
  janelaFalsa();
});

describe("os campos RENDERIZADOS da página da tarefa", () => {
  it("PRONTO QUANDO: todo arquivo com `<input>` tem uma montagem que o renderiza", () => {
    // Derivado do fonte: campo novo em arquivo novo deixa este teste vermelho
    // até alguém montá-lo aqui — a rodada 8 já ensinou que lista escrita à
    // mão conserta 4 e esquece 6.
    const cobertos = [...new Set(MONTAGENS.flatMap((m) => m.cobre))].sort();
    expect(arquivosComInput()).toEqual(cobertos);
  });

  it("PRONTO QUANDO: nenhuma montagem renderiza zero campos (o laço não passa no vazio)", () => {
    for (const m of MONTAGENS) {
      expect(inputsRenderizados(m).length, `${m.nome} não renderizou nenhum <input>`).toBeGreaterThan(0);
    }
  });

  /**
   * A TRAVA. Não pergunta ao arquivo o que ele escreveu; pergunta ao elemento
   * o que ele É — com o espalhamento, a variável e o componente que envolve o
   * campo já resolvidos.
   */
  it('PRONTO QUANDO: nenhum <input> RENDERIZADO da página é `type="number"`', () => {
    const culpados: string[] = [];
    for (const m of MONTAGENS) {
      for (const props of inputsRenderizados(m)) {
        if (props.type === "number") culpados.push(`${m.nome}: <input type="number">`);
      }
    }
    expect(
      culpados,
      `campo que esconde do programa o que o operador vê na caixa:\n${culpados.join("\n")}`,
    ).toEqual([]);
  });

  /**
   * O contrato do campo, no elemento: controlado por `value` (string) e
   * `onChange` — é isso que garante que o programa leia o MESMO texto que
   * está na caixa. Um campo não controlado guarda estado que o React não vê,
   * que é a forma geral do defeito da rodada 11.
   */
  it("PRONTO QUANDO: todo <input> renderizado é controlado — `value` string + `onChange`", () => {
    for (const m of MONTAGENS) {
      for (const props of inputsRenderizados(m)) {
        expect(typeof props.value, `${m.nome}: <input> sem value string`).toBe("string");
        expect(typeof props.onChange, `${m.nome}: <input> sem onChange`).toBe("function");
      }
    }
  });

  /**
   * O campo de número, especificamente: texto + teclado decimal do celular.
   * Medido no elemento, não no arquivo — é a mesma pergunta que a sabotagem
   * do espalhamento respondia mentindo.
   */
  it('PRONTO QUANDO: o campo decimal renderizado é `type="text"` com `inputMode="decimal"`', () => {
    const decimais = MONTAGENS.flatMap((m) =>
      inputsRenderizados(m).filter((p) => p.inputMode === "decimal"),
    );
    expect(decimais.length, "nenhum campo decimal renderizado").toBeGreaterThan(0);
    for (const props of decimais) {
      expect(props.type).toBe("text");
      expect(props.inputMode).toBe("decimal");
    }
  });

  /**
   * ═════════════════════════════════════════════════════ ALTO #3, rodada 13 ═
   * A SEGUNDA REDE: NENHUMA ESCRITA EM NÓ DE DOM, DE NENHUMA FORMA.
   *
   * A versão da rodada 12 proibia três GRAFIAS (`.type =`, `setAttribute(`,
   * `dangerouslySetInnerHTML`) e o crítico passou por ela com um
   * `Object.assign(el, { type: "number" })` dentro de uma `ref` — `tsc`,
   * `eslint` e 1441 testes verdes, e a duração apagada no Chromium. Agora o
   * que se proíbe é a FAMÍLIA: qualquer chamada que escreva em nó e qualquer
   * atribuição a propriedade (inclusive calculada, que é como um apelido
   * escapa de lista de nomes). As exceções são por PROPRIEDADE, declaradas com
   * motivo em `PROPRIEDADES_TOLERADAS`.
   */
  it("PRONTO QUANDO: nenhum arquivo da página escreve em nó de DOM", () => {
    const achados = escritasNoDom().map((a) => `${a.arquivo}:${String(a.linha)} — ${a.trecho}`);
    expect(achados, `estado fora da árvore:\n${achados.join("\n")}`).toEqual([]);
  });

  /**
   * A lista de exceções não pode virar a porta dos fundos que ela fecha:
   * nenhuma propriedade tolerada pode mudar o CONTRATO do campo — é disso que
   * o CRÍTICO das rodadas 10/11 era feito (`type="number"` em `badInput`
   * mostra o texto e entrega `""` ao programa).
   */
  it("PRONTO QUANDO: nenhuma exceção declarada mexe no contrato do campo", () => {
    const proibidas = [
      "type",
      "inputMode",
      "pattern",
      "step",
      "min",
      "max",
      "checked",
      "defaultValue",
      "defaultChecked",
      "innerHTML",
      "outerHTML",
      "textContent",
      "attributes",
    ];
    const invasoras = PROPRIEDADES_TOLERADAS.filter((t) => proibidas.includes(t.prop)).map(
      (t) => t.prop,
    );
    expect(invasoras, `exceção que reabre o CRÍTICO: ${invasoras.join(", ")}`).toEqual([]);
    // E toda exceção diz POR QUÊ — motivo vazio é exceção sem dono.
    for (const t of PROPRIEDADES_TOLERADAS) {
      expect(t.motivo.length, `exceção "${t.prop}" sem motivo escrito`).toBeGreaterThan(40);
    }
  });
});
