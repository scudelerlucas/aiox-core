import { beforeEach, describe, expect, it, vi } from "vitest";

import { janelaFalsa, montar, novaInstancia, reactFalso, soltarInstancia } from "./hooks-falsos";

/**
 * OS-LIFEBOARD · P6 — A TRAVA DE VOO E O AVISO DE SAÍDA, EXERCIDOS (rodada 11).
 *
 * O crítico mediu: `grep -rn travaDeVoo tests/` devolvia 0. Três das treze
 * mutações moram aqui, e as três passavam com 1350/1350 verdes:
 *
 *  · tirar `emVooRef.current = false` do `finally` → a porta tranca PARA
 *    SEMPRE depois da 1ª gravação: a 2ª nota devolve "Aguarde: a gravação
 *    anterior ainda está em andamento." eternamente, e a página vira
 *    somente-leitura (medido no navegador pelo crítico);
 *  · `config.travaDeVoo ?? emVooProprioRef` → `emVooProprioRef` → "Salvar
 *    átomos" e "Limpar átomos" voltam a correr juntas sobre o mesmo campo, e
 *    o valor final passa a depender da ordem das respostas;
 *  · `useAvisoDeSaida(pendente)` → `useAvisoDeSaida(false)` → o aviso antes de
 *    fechar a aba com uma gravação em voo simplesmente some. O teste que
 *    existia (`tarefa-aviso-de-saida.test.ts`) ADMITE POR ESCRITO que prova o
 *    CORPO do efeito e não a LIGAÇÃO — este prova a ligação.
 */

vi.mock("react", () => reactFalso);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const acao = vi.fn();
vi.mock("@/app/tarefa/actions", () => ({
  escreverTarefaAction: (...args: unknown[]): unknown => acao(...args),
}));

/** O aviso de saída, espiado — é a LIGAÇÃO que se mede, não o corpo. */
const avisoRecebeu: boolean[] = [];
vi.mock("@/components/task/usar-aviso-de-saida", () => ({
  useAvisoDeSaida: (pendente: boolean): void => {
    avisoRecebeu.push(pendente);
  },
}));

import type { ConfigDaPorta } from "@/components/task/porta-de-escrita";

const { usarPortaDeEscrita } = await import("@/components/task/porta-de-escrita");
const { MENSAGEM_AGUARDE } = await import("@/components/task/escrita");

type Config = ConfigDaPorta;

function regiaoQueAnota(onde: string[]): Config["regiao"] {
  return {
    mensagem: null,
    mostrar: (t: string) => {
      onde.push(t);
    },
    limpar: () => undefined,
  };
}

async function assentar(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

beforeEach(() => {
  soltarInstancia();
  acao.mockReset();
  avisoRecebeu.length = 0;
  janelaFalsa();
});

describe("ALTO A4 — a trava de voo solta quando a resposta chega", () => {
  /**
   * MUTAÇÃO 12: remover `emVooRef.current = false` do `finally`.
   * Sem este teste, a página inteira vira somente-leitura depois da 1ª
   * gravação e a suíte fica verde.
   */
  it("PRONTO QUANDO: depois de uma gravação que VOLTA, a próxima escreve de novo", async () => {
    acao.mockResolvedValue({ ok: true });
    const inst = novaInstancia();
    const dito: string[] = [];
    const config: Config = { op: "duracao", alvo: () => null, regiao: regiaoQueAnota(dito) };

    const primeira = montar(inst, usarPortaDeEscrita, config);
    expect(primeira.escrever({ task_id: "t" }, { mudou: true })).toBe("gravar");
    await assentar();

    const segunda = montar(inst, usarPortaDeEscrita, config);
    expect(segunda.escrever({ task_id: "t" }, { mudou: true })).toBe("gravar");
    expect(acao).toHaveBeenCalledTimes(2);
    expect(dito).not.toContain(MENSAGEM_AGUARDE);
  });

  /** A trava também solta quando a ação FALHA — senão o erro tranca a página. */
  it("PRONTO QUANDO: uma falha de rede não deixa a porta trancada", async () => {
    acao.mockRejectedValue(new TypeError("Failed to fetch"));
    const inst = novaInstancia();
    const config: Config = { op: "duracao", alvo: () => null };
    const primeira = montar(inst, usarPortaDeEscrita, config);
    primeira.escrever({ task_id: "t" }, { mudou: true });
    await assentar();
    const segunda = montar(inst, usarPortaDeEscrita, config);
    expect(segunda.escrever({ task_id: "t" }, { mudou: true })).toBe("gravar");
  });

  /** E enquanto a resposta NÃO volta, a trava de fato segura (o outro lado). */
  it("PRONTO QUANDO: com a gravação em voo, a 2ª tentativa é recusada com voz", () => {
    acao.mockReturnValue(new Promise(() => undefined));
    const inst = novaInstancia();
    const dito: string[] = [];
    const config: Config = { op: "duracao", alvo: () => null, regiao: regiaoQueAnota(dito) };
    const porta = montar(inst, usarPortaDeEscrita, config);
    expect(porta.escrever({ task_id: "t" }, { mudou: true })).toBe("gravar");
    expect(porta.escrever({ task_id: "t" }, { mudou: true })).toBe("aguardar");
    expect(dito).toContain(MENSAGEM_AGUARDE);
  });
});

describe("MUTAÇÃO 9 — a trava COMPARTILHADA entre portas irmãs", () => {
  /**
   * `config.travaDeVoo ?? emVooProprioRef` → `emVooProprioRef`.
   * "Salvar átomos" e "Limpar átomos" escrevem o MESMO campo: com uma trava
   * cada, começar a gravação por uma deixa a outra só `aria-disabled` no
   * visual e a porta dela continua despachando.
   */
  it("PRONTO QUANDO: com a mesma trava, a porta irmã não despacha durante o voo", () => {
    acao.mockReturnValue(new Promise(() => undefined));
    const trava = { current: false };
    const instSalvar = novaInstancia();
    const instLimpar = novaInstancia();
    const dito: string[] = [];

    const salvar = montar(instSalvar, usarPortaDeEscrita, {
      op: "atomos_salvar",
      alvo: () => null,
      travaDeVoo: trava,
      regiao: regiaoQueAnota(dito),
    });
    const limpar = montar(instLimpar, usarPortaDeEscrita, {
      op: "atomos_limpar",
      alvo: () => null,
      travaDeVoo: trava,
      regiao: regiaoQueAnota(dito),
    });

    expect(salvar.escrever({ task_id: "t" })).toBe("gravar");
    expect(limpar.escrever({ task_id: "t" })).toBe("aguardar");
    expect(acao).toHaveBeenCalledTimes(1);
    expect(dito).toContain(MENSAGEM_AGUARDE);
  });

  /** Sem trava compartilhada, cada porta é dona de si — o outro lado da regra. */
  it("PRONTO QUANDO: portas de dados DIFERENTES não travam uma à outra", () => {
    acao.mockReturnValue(new Promise(() => undefined));
    const a = montar(novaInstancia(), usarPortaDeEscrita, {
      op: "duracao",
      alvo: () => null,
    });
    const b = montar(novaInstancia(), usarPortaDeEscrita, {
      op: "meta",
      alvo: () => null,
    });
    expect(a.escrever({ task_id: "t" }, { mudou: true })).toBe("gravar");
    expect(b.escrever({ task_id: "t" }, { mudou: true })).toBe("gravar");
  });
});

describe("MUTAÇÃO 1 — a LIGAÇÃO do aviso de saída (não o corpo dele)", () => {
  /**
   * `useAvisoDeSaida(pendente)` → `useAvisoDeSaida(false)`: compila, passa em
   * `tarefa-aviso-de-saida.test.ts` (que testa a função solta) e o navegador
   * deixa a aba fechar levando a gravação embora, sem perguntar nada.
   */
  it("PRONTO QUANDO: a porta ligada a uma gravação em voo pede o aviso com `true`", () => {
    acao.mockReturnValue(new Promise(() => undefined));
    const inst = novaInstancia();
    const config: Config = { op: "duracao", alvo: () => null };
    const porta = montar(inst, usarPortaDeEscrita, config);
    // Página parada: ninguém é perguntado à toa.
    expect(avisoRecebeu).toEqual([false]);

    porta.escrever({ task_id: "t" }, { mudou: true });
    const emVoo = montar(inst, usarPortaDeEscrita, config);
    expect(emVoo.pendente).toBe(true);
    // A porta PASSA o pendente adiante — é isto que a mutação apaga.
    expect(avisoRecebeu.at(-1)).toBe(true);
    expect(avisoRecebeu).toContain(true);
  });

  it("PRONTO QUANDO: terminada a gravação, o aviso volta a ser `false`", async () => {
    acao.mockResolvedValue({ ok: true });
    const inst = novaInstancia();
    const config: Config = { op: "duracao", alvo: () => null };
    const porta = montar(inst, usarPortaDeEscrita, config);
    porta.escrever({ task_id: "t" }, { mudou: true });
    await assentar();
    montar(inst, usarPortaDeEscrita, config);
    expect(avisoRecebeu.at(-1)).toBe(false);
  });
});
