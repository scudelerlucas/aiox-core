import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OS-LIFEBOARD · OS ACHADOS QUE O MERGE DO PR #21 LEVOU JUNTO.
 *
 * CodeRabbit e Codex postaram estes achados DEPOIS do último push daquele PR;
 * ele foi mergeado antes de qualquer um ser tratado, então todos passaram a
 * viver na `main`. Cada teste aqui EXERCITA a correção — nenhum lê o fonte
 * atrás de uma string. Desfazer a correção deixa o teste vermelho:
 *
 *   D50 · medir de novo o mesmo valor renova o carimbo   (SQL — prova no banco
 *          e blocos novos em `supabase/tests/fila_prompts.test.sql`)
 *   D51 · recusa por medição velha tem código e frase próprios
 *   A   · `pendente` cobre o `await` inteiro da gravação
 *   C   · uma porta limpa o erro da outra antes de escrever
 *   B   · o relógio da confirmação morre quando outra instância desarma
 */

// ── O React mínimo, compartilhado pelos três testes de componente ───────────
const estados: unknown[] = [];
const refs: { current: unknown }[] = [];
const efeitos: { fn: () => void | (() => void); deps: unknown[] | undefined }[] = [];
let iEstado = 0;
let iRef = 0;

function zerarIndices(): void {
  iEstado = 0;
  iRef = 0;
  efeitos.length = 0;
}

vi.mock("react", () => ({
  useState: (inicial: unknown): [unknown, (v: unknown) => void] => {
    const k = iEstado++;
    if (!(k in estados)) {
      estados[k] = typeof inicial === "function" ? (inicial as () => unknown)() : inicial;
    }
    return [
      estados[k],
      (v: unknown): void => {
        estados[k] = typeof v === "function" ? (v as (p: unknown) => unknown)(estados[k]) : v;
      },
    ];
  },
  useRef: (inicial: unknown): { current: unknown } => {
    const k = iRef++;
    refs[k] ??= { current: inicial };
    return refs[k] as { current: unknown };
  },
  useId: (): string => "instancia",
  useTransition: (): [boolean, (fn: () => void) => void] => [
    false,
    (fn: () => void): void => {
      fn();
    },
  ],
  useEffect: (fn: () => void | (() => void), deps?: unknown[]): void => {
    efeitos.push({ fn, deps });
  },
}));

const acao = vi.fn();
vi.mock("@/app/tarefa/actions", () => ({
  escreverTarefaAction: (...args: unknown[]): unknown => acao(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: (): void => undefined }) }));

import { CancelarBotao } from "@/components/prompts/cancelar-botao";
import { usarPortaDeEscrita } from "@/components/task/porta-de-escrita";
import { LIMITE_DEFASAGEM_HORAS, fraseDoEnfileiramento } from "@/core/prompts/tipos";

// ── D51 · a recusa por medição velha não fala de dinheiro ───────────────────
describe("D51 — conta recusada por medição parada não é 'sem espaço'", () => {
  const numeros = {
    conta: "lsgpandora@gmail.com" as const,
    complexidade: "alta" as const,
    headroomUsd: 500,
    espacoLivreUsd: 420,
    custoEstimadoUsd: 30,
    naFilaUsd: 80,
    itensNaFrente: 2,
  };

  it("PRONTO QUANDO: a frase nomeia a medição parada e nega a falta de espaço", () => {
    const frase = fraseDoEnfileiramento("manual_medicao_velha", numeros);
    expect(frase).toContain("medição parada");
    expect(frase).toContain(`${LIMITE_DEFASAGEM_HORAS} h`);
    // 24ª rodada: a frase manual passou a usar a mesma construção da automática
    // ("… recusado. Não é falta de espaço"); o que se afirma é a negação, não a caixa.
    expect(frase).toMatch(/não é falta de espaço/i);
    // O defeito era ESTE texto, da `manual_nao_cabe_hoje`, aparecendo aqui.
    expect(frase).not.toContain("sem espaço livre agora");
    expect(frase).not.toContain("não cabe hoje");
  });

  it("a frase de falta de espaço continua falando de espaço — as duas não se confundem", () => {
    const frase = fraseDoEnfileiramento("manual_nao_cabe_hoje", numeros);
    expect(frase).toContain("não cabe hoje");
    expect(frase).not.toContain("medição parada");
  });
});

// ── A · o `pendente` cobre o `await` inteiro ────────────────────────────────
describe("A — a gravação lenta continua sendo uma gravação em voo", () => {
  beforeEach(() => {
    estados.length = 0;
    refs.length = 0;
    zerarIndices();
    acao.mockReset();
    (globalThis as unknown as { window: unknown }).window = {
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
      clearTimeout: (id: number): void => {
        clearTimeout(id as unknown as NodeJS.Timeout);
      },
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined,
    };
  });

  function montar(): ReturnType<typeof usarPortaDeEscrita> {
    zerarIndices();
    return usarPortaDeEscrita({ op: "duracao", alvo: () => null });
  }

  it("PRONTO QUANDO: `pendente` é verdadeiro ENQUANTO o servidor não respondeu", async () => {
    let responder: (v: unknown) => void = () => undefined;
    acao.mockReturnValue(
      new Promise((res) => {
        responder = res;
      }),
    );

    const porta = montar();
    expect(porta.pendente, "nasce sem gravação em voo").toBe(false);

    porta.escrever({ task_id: "t-1", estimativa_dias: "3" }, { mudou: true });
    await Promise.resolve();

    // A transição do React 18 já fechou aqui — a callback dela era síncrona.
    // Quem tem de segurar o "em voo" é o estado próprio da porta.
    expect(montar().pendente, "o await ainda não voltou: a gravação está em voo").toBe(true);

    responder({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(montar().pendente, "o servidor respondeu: a gravação acabou").toBe(false);
  });

  it("servidor que explode não deixa a tela presa em 'gravando'", async () => {
    acao.mockRejectedValue(new Error("rede caiu"));
    const porta = montar();
    porta.escrever({ task_id: "t-2", estimativa_dias: "5" }, { mudou: true });
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
    expect(montar().pendente).toBe(false);
  });
});

// ── B · o relógio da confirmação morre quando outra instância desarma ───────
describe("B — duas instâncias da mesma linha, um relógio cada", () => {
  beforeEach(() => {
    estados.length = 0;
    refs.length = 0;
    zerarIndices();
    (globalThis as unknown as { window: unknown }).window = {
      setTimeout: (): number => 77,
      clearTimeout: vi.fn(),
    };
  });

  function renderizar(confirmando: boolean): void {
    zerarIndices();
    CancelarBotao({ id: "item-1", confirmando, aoMudarConfirmando: (): void => undefined });
    for (const e of efeitos) e.fn();
  }

  it("PRONTO QUANDO: `confirmando` virando falso limpa o relógio desta instância", () => {
    renderizar(true);
    // Simula o relógio armado pelo clique desta instância.
    const relogioRef = refs.find((r) => r.current === null);
    expect(relogioRef, "o ref do relógio existe").toBeDefined();
    (relogioRef as { current: unknown }).current = 77;

    const limpar = (globalThis as unknown as { window: { clearTimeout: ReturnType<typeof vi.fn> } })
      .window.clearTimeout;
    limpar.mockClear();

    // A OUTRA instância confirmou: o pai desarmou o bit compartilhado.
    renderizar(false);

    expect(limpar, "o relógio órfão foi cancelado").toHaveBeenCalledWith(77);
    expect((relogioRef as { current: unknown }).current, "e o ref ficou vazio").toBeNull();
  });
});
