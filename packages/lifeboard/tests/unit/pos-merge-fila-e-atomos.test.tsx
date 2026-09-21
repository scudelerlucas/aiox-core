import { describe, expect, it, vi } from "vitest";

/**
 * OS-LIFEBOARD · os dois achados pós-merge que precisam de contexto próprio:
 *
 *   D51 (fila) · a conta escolhida À MÃO e recusada por medição parada devolve
 *        código próprio, e `cabeHoje` acompanha — o espelho de fixture tem de
 *        dizer o MESMO que `fila_prompts_enfileirar` (migration 0025) diz.
 *   C (átomos) · salvar limpa o erro que ficou de limpar, e vice-versa: o
 *        campo de erro é um só para as duas portas.
 *
 * Arquivo separado porque cada bloco precisa de um mock diferente do módulo
 * da porta de escrita, e `vi.mock` vale para o arquivo inteiro.
 */

// ── C · as duas portas, um campo de erro só ────────────────────────────────
const portas: Record<string, { aoMudarCampo: ReturnType<typeof vi.fn>; escrever: ReturnType<typeof vi.fn> }> = {};

vi.mock("@/components/task/porta-de-escrita", () => ({
  usarPortaDeEscrita: (config: { op: string }) => {
    portas[config.op] ??= { aoMudarCampo: vi.fn(), escrever: vi.fn() };
    const p = portas[config.op] as (typeof portas)[string];
    return {
      pendente: false,
      escrever: p.escrever,
      erroDoCampo: null,
      aoMudarCampo: p.aoMudarCampo,
      mensagem: null,
      anunciar: (): void => undefined,
      limparAnuncio: (): void => undefined,
    };
  },
}));

vi.mock("react", () => ({
  useState: (inicial: unknown): [unknown, (v: unknown) => void] => [
    typeof inicial === "function" ? (inicial as () => unknown)() : inicial,
    (): void => undefined,
  ],
  useRef: (inicial: unknown): { current: unknown } => ({ current: inicial }),
  useId: (): string => "i",
  useEffect: (): void => undefined,
  useTransition: (): [boolean, (fn: () => void) => void] => [false, (fn) => fn()],
}));

import { AtomosForm } from "@/components/task/atomos-form";
import {
  definirExigirMedicaoFixture,
  enfileirarFixture,
  resetarFilaFixtureStore,
} from "@/lib/repositories/prompts-fila.fixture-store";

/** Acha o primeiro nó da árvore cujo texto acessível casa com `rotulo`. */
function acharBotao(no: unknown, rotulo: string): { onClick?: () => void } | null {
  if (no === null || typeof no !== "object") return null;
  const el = no as { props?: Record<string, unknown>; type?: unknown };
  const props = el.props;
  if (props) {
    const texto = JSON.stringify(props.children ?? "");
    const aria = typeof props["aria-label"] === "string" ? (props["aria-label"] as string) : "";
    if ((texto.includes(rotulo) || aria.includes(rotulo)) && typeof props.onClick === "function") {
      return props as { onClick?: () => void };
    }
    const filhos = props.children;
    const lista = Array.isArray(filhos) ? filhos : [filhos];
    for (const f of lista) {
      const achado = acharBotao(f, rotulo);
      if (achado) return achado;
    }
  }
  return null;
}

describe("C — o campo de erro é um só, então cada porta limpa a outra", () => {
  it("PRONTO QUANDO: salvar limpa o erro de limpar, e limpar limpa o erro de salvar", () => {
    for (const k of Object.keys(portas)) delete portas[k];
    const arvore = AtomosForm({
      taskId: "task-1",
      assimetriaAtual: { opcionalidade: 1, esforco: 1, custo: 1 },
      score: null,
      motivoSemScore: null,
      heranca: { esforco: 1, custo: 1, herdado: false, filhasAbertas: 0 },
    } as unknown as Parameters<typeof AtomosForm>[0]);

    const salvar = acharBotao(arvore, "Salvar átomos");
    const limpar = acharBotao(arvore, "Limpar átomos");
    expect(salvar, "o botão de salvar está na árvore").not.toBeNull();
    expect(limpar, "o botão de limpar está na árvore").not.toBeNull();

    salvar?.onClick?.();
    expect(
      portas.atomos_limpar?.aoMudarCampo,
      "salvar apaga o erro que sobrou de um limpar que falhou",
    ).toHaveBeenCalled();

    portas.atomos_salvar?.aoMudarCampo.mockClear();
    limpar?.onClick?.();
    expect(
      portas.atomos_salvar?.aoMudarCampo,
      "limpar apaga o erro que sobrou de um salvar que falhou",
    ).toHaveBeenCalled();
  });
});

// ── D51 · o espelho de fixture diz o mesmo que o SQL ───────────────────────
describe("D51 — conta manual com medição parada: código próprio, e não 'sem espaço'", () => {
  const PANDORA = "lsgpandora@gmail.com" as const;

  it("PRONTO QUANDO: a recusa é por medição, o código é `manual_medicao_velha` e `cabeHoje` é falso", () => {
    resetarFilaFixtureStore();
    // Conta com teto inteiro livre — dinheiro NÃO é o problema aqui.
    definirExigirMedicaoFixture(PANDORA, true);
    const r = enfileirarFixture({
      prompt: "escolhi esta conta à mão",
      complexidade: "baixa",
      conta: PANDORA,
      agora: Date.now(),
    });
    expect("ok" in r && r.ok, "o item entra na fila do mesmo jeito").toBe(true);
    expect("motivoCodigo" in r ? r.motivoCodigo : "").toBe("manual_medicao_velha");
    expect("cabeHoje" in r ? r.cabeHoje : true, "o pull recusaria — a tela não pode prometer").toBe(
      false,
    );
  });

  it("sem a exigência de medição, a mesma conta volta a ser `manual_cabe`", () => {
    resetarFilaFixtureStore();
    definirExigirMedicaoFixture(PANDORA, false);
    const r = enfileirarFixture({
      prompt: "mesma conta, sem a trava",
      complexidade: "baixa",
      conta: PANDORA,
      agora: Date.now(),
    });
    expect("motivoCodigo" in r ? r.motivoCodigo : "").toBe("manual_cabe");
    expect("cabeHoje" in r ? r.cabeHoje : false).toBe(true);
  });
});
