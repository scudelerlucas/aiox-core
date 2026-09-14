import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OS-LIFEBOARD · P6 — A PORTA, EXERCIDA (rodada 9).
 *
 * A rodada 8 provou a fiação por LEITURA do fonte, e foi por aí que a forma
 * M8 do crítico passou: o handler citava a porta, o teste via as citações, e
 * o despacho ia por fora. Aqui a porta é RODADA: um React mínimo (o hook usa
 * só `useState`, `useRef`, `useTransition` e `useEffect`), a Server Action
 * trocada por um espião, e o `document` por um objeto falso.
 *
 * É este arquivo que mede a TRILHA DA REGIÃO VIVA do MÉDIO #3 — a frase
 * "Exclusão cancelada — a nota continua." que a rodada 8 emitia no clique que
 * APAGA, e que com 1,2 s de latência ficava 1.240 ms sozinha no único canal
 * que o operador de leitor de tela tem.
 */

const estados: unknown[] = [];
const refs: { current: unknown }[] = [];
let iEstado = 0;
let iRef = 0;
let transicaoPendente = false;

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
  useTransition: (): [boolean, (fn: () => void) => void] => [
    transicaoPendente,
    (fn: () => void): void => {
      fn();
    },
  ],
  useEffect: (): void => undefined,
}));

const refrescou = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refrescou }),
}));

/** A Server Action, trocada por um espião com latência controlada. */
const acao = vi.fn();
vi.mock("@/app/tarefa/actions", () => ({
  escreverTarefaAction: (...args: unknown[]): unknown => acao(...args),
}));

import type { EstadoAcaoTarefa } from "@/app/tarefa/pedido";
import { ANUNCIO_DE_CONFIRMACAO, ANUNCIO_DE_SUCESSO, MENSAGEM_AGUARDE, saidaPorConfirmacao, transicaoDeConfirmacao } from "@/components/task/escrita";
import { usarPortaDeEscrita, type ConfigDaPorta, type PortaDeEscrita } from "@/components/task/porta-de-escrita";

interface Anuncio {
  ms: number;
  texto: string;
}

function agora(): number {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

describe("a porta de escrita, rodada de verdade (ALTO #1)", () => {
  let doc: { activeElement: unknown };
  let focado: { nome: string; focus: () => void };
  let regiao: string[];

  function render(config: Partial<ConfigDaPorta> = {}): PortaDeEscrita {
    iEstado = 0;
    iRef = 0;
    return usarPortaDeEscrita({
      op: "duracao",
      alvo: () => focado,
      ...config,
    });
  }

  beforeEach(() => {
    estados.length = 0;
    refs.length = 0;
    iEstado = 0;
    iRef = 0;
    transicaoPendente = false;
    acao.mockReset();
    refrescou.mockReset();
    regiao = [];
    doc = { activeElement: null };
    focado = {
      nome: "botão Salvar duração",
      focus: (): void => {
        doc.activeElement = focado;
      },
    };
    (globalThis as unknown as { window: unknown }).window = {
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
      clearTimeout: (id: number) => {
        clearTimeout(id as unknown as NodeJS.Timeout);
      },
    };
  });

  it("PRONTO QUANDO: o pedido que chega ao servidor traz a `op` e os campos — nada de FormData", async () => {
    acao.mockResolvedValue({ ok: true } satisfies EstadoAcaoTarefa);
    const porta = render();
    porta.escrever({ task_id: "task-build", estimativa_dias: "3" }, { mudou: true });
    await Promise.resolve();
    expect(acao).toHaveBeenCalledTimes(1);
    const pedido = acao.mock.calls[0]?.[1] as { op: string; campos: Record<string, string> };
    expect(pedido.op).toBe("duracao");
    expect(pedido.campos).toEqual({ task_id: "task-build", estimativa_dias: "3" });
    expect(pedido).not.toBeInstanceOf(FormData);
  });

  it("PRONTO QUANDO: a recusa por 'nada mudou' não chega ao servidor, e FALA", () => {
    const porta = render({ regiao: { mensagem: null, mostrar: (t) => regiao.push(t), limpar: () => undefined } });
    const decisao = porta.escrever({ task_id: "t" }, { mudou: false });
    expect(decisao).toBe("sem_mudanca");
    expect(acao).not.toHaveBeenCalled();
    expect(regiao).toEqual(["A duração já está salva assim — nada mudou."]);
  });

  it("PRONTO QUANDO: o 2º disparo no MESMO tick é recusado com voz, não engolido", () => {
    acao.mockReturnValue(new Promise(() => undefined)); // nunca resolve
    const porta = render({ regiao: { mensagem: null, mostrar: (t) => regiao.push(t), limpar: () => undefined } });
    expect(porta.escrever({ task_id: "t" }, { mudou: true })).toBe("gravar");
    expect(porta.escrever({ task_id: "t" }, { mudou: true })).toBe("aguardar");
    expect(acao).toHaveBeenCalledTimes(1);
    expect(regiao).toEqual([MENSAGEM_AGUARDE]);
  });

  it("PRONTO QUANDO: o sucesso entrega o foco ANTES de anunciar, e depois refresca", async () => {
    acao.mockResolvedValue({ ok: true } satisfies EstadoAcaoTarefa);
    const ordem: string[] = [];
    focado.focus = (): void => {
      doc.activeElement = focado;
      ordem.push("foco");
    };
    const porta = render({
      regiao: {
        mensagem: null,
        mostrar: (t) => {
          ordem.push(`anuncio:${t}`);
        },
        limpar: () => undefined,
      },
    });
    porta.escrever({ task_id: "t" }, { mudou: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(doc.activeElement).toBe(focado);
    expect(ordem).toEqual(["foco", `anuncio:${ANUNCIO_DE_SUCESSO.duracao}`]);
    expect(refrescou).toHaveBeenCalledTimes(1);
  });

  it("PRONTO QUANDO: a recusa do servidor NÃO anuncia sucesso e não refresca", async () => {
    acao.mockResolvedValue({ erro: "A duração não pode passar de 9999.99 dias." });
    const porta = render({ regiao: { mensagem: null, mostrar: (t) => regiao.push(t), limpar: () => undefined } });
    porta.escrever({ task_id: "t" }, { mudou: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(regiao).toEqual([]);
    expect(refrescou).not.toHaveBeenCalled();
    // E o erro aparece no campo, resolvido pela porta (ALTO #2).
    expect(render().erroDoCampo).toBe("A duração não pode passar de 9999.99 dias.");
  });

  it("PRONTO QUANDO: uma falha de REDE vira frase em português, nunca exceção", async () => {
    acao.mockRejectedValue(new TypeError("Failed to fetch"));
    const porta = render();
    expect(() => {
      porta.escrever({ task_id: "t" }, { mudou: true });
    }).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(render().erroDoCampo).toBe("Não foi possível salvar agora — tente de novo.");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MÉDIO #3 — A TRILHA DA REGIÃO VIVA, MEDIDA.
 *
 * Reprodução do cenário do crítico com a MESMA latência (1,2 s de RPC): 1º
 * clique pede confirmação, 2º clique apaga. Antes, a região viva recebia
 * "Exclusão cancelada — a nota continua." no clique que apagava, e ela ficava
 * ~1.240 ms sozinha até "Excluída." chegar.
 */
describe("MÉDIO #3 — a trilha da região viva no clique que APAGA", () => {
  beforeEach(() => {
    estados.length = 0;
    refs.length = 0;
    iEstado = 0;
    iRef = 0;
    acao.mockReset();
    refrescou.mockReset();
    (globalThis as unknown as { window: unknown }).window = {
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
      clearTimeout: (id: number) => {
        clearTimeout(id as unknown as NodeJS.Timeout);
      },
    };
  });

  it("PRONTO QUANDO: nenhuma frase de cancelamento entra na trilha da exclusão", async () => {
    const LATENCIA_MS = 1200;
    const trilha: Anuncio[] = [];
    const t0 = agora();
    const anunciar = (texto: string): void => {
      trilha.push({ ms: agora() - t0, texto });
    };

    // O painel: uma linha em confirmação por vez, como em `notas-painel.tsx`.
    let confirmandoId: string | null = null;
    function pedirConfirmacao(id: string): void {
      const t = transicaoDeConfirmacao("nota_excluir", confirmandoId, id);
      if (t.anuncio !== null) anunciar(t.anuncio);
      confirmandoId = t.confirmandoId;
    }
    function confirmacaoExecutada(): void {
      const t = saidaPorConfirmacao("nota_excluir", confirmandoId);
      if (t.anuncio !== null) anunciar(t.anuncio);
      confirmandoId = t.confirmandoId;
    }

    acao.mockImplementation(
      async (): Promise<EstadoAcaoTarefa> =>
        new Promise((resolve) => setTimeout(() => resolve({ ok: true }), LATENCIA_MS)),
    );

    iEstado = 0;
    iRef = 0;
    const porta = usarPortaDeEscrita({
      op: "nota_excluir",
      alvo: () => null,
      anunciarSucesso: anunciar,
      regiao: { mensagem: null, mostrar: anunciar, limpar: () => undefined },
    });

    // 1º clique — pede confirmação.
    pedirConfirmacao("nota-1");
    // 2º clique — APAGA.
    confirmacaoExecutada();
    porta.escrever({ id: "nota-1", task_id: "task-build" });

    await new Promise((r) => setTimeout(r, LATENCIA_MS + 120));

    const textos = trilha.map((a) => a.texto);
    expect(textos).toEqual([
      ANUNCIO_DE_CONFIRMACAO.nota_excluir.entrou,
      ANUNCIO_DE_SUCESSO.nota_excluir,
    ]);
    // A frase falsa não existe em lugar nenhum da trilha.
    expect(textos).not.toContain(ANUNCIO_DE_CONFIRMACAO.nota_excluir.saiu);
    // E entre o clique e "Excluída." a região não recebeu NADA — antes ela
    // recebia a frase de cancelamento e a segurava pela latência inteira.
    expect(trilha).toHaveLength(2);
    const intervalo = (trilha[1]?.ms ?? 0) - (trilha[0]?.ms ?? 0);
    expect(intervalo).toBeGreaterThanOrEqual(LATENCIA_MS - 60);
    console.log("Trilha da região viva (MÉDIO #3, latência de 1,2 s):");
    for (const a of trilha) console.log(`  ${String(a.ms).padStart(6)}ms  "${a.texto}"`);
  });

  it("PRONTO QUANDO: o CANCELAMENTO de verdade (Escape, foco fora) continua falando", () => {
    const trilha: string[] = [];
    let confirmandoId: string | null = null;
    const t1 = transicaoDeConfirmacao("nota_excluir", confirmandoId, "nota-1");
    if (t1.anuncio !== null) trilha.push(t1.anuncio);
    confirmandoId = t1.confirmandoId;
    const t2 = transicaoDeConfirmacao("nota_excluir", confirmandoId, null);
    if (t2.anuncio !== null) trilha.push(t2.anuncio);
    expect(trilha).toEqual([
      ANUNCIO_DE_CONFIRMACAO.nota_excluir.entrou,
      ANUNCIO_DE_CONFIRMACAO.nota_excluir.saiu,
    ]);
  });
});
