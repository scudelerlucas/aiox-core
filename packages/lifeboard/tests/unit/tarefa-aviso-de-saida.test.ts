import { describe, expect, it } from "vitest";

import {
  registrarAvisoDeSaida,
  type EventoDeSaida,
  type JanelaComAviso,
} from "@/components/task/usar-aviso-de-saida";

/**
 * OS-LIFEBOARD · P6 — achado BAIXO #7 (rodada 6): com uma gravação em voo,
 * `F5`/URL digitada levava a nota embora SEM UMA PALAVRA (medido pelo crítico
 * segurando o POST por 4 s e navegando no meio).
 *
 * O que se testa aqui é o CORPO do efeito (`registrarAvisoDeSaida`), não o
 * hook: montar um hook exigiria DOM, que este repositório não tem (sem jsdom,
 * sem `@testing-library`, `npm install` proibido nesta rodada). O hook é uma
 * linha em volta desta função.
 *
 * Reverter para ver falhar: trocar `if (janela === null || !pendente)` por
 * `if (janela === null)` — o 2º teste passa a registrar ouvinte com a página
 * parada.
 */
function janelaFalsa(): {
  janela: JanelaComAviso;
  adicionados: ((e: EventoDeSaida) => void)[];
  removidos: ((e: EventoDeSaida) => void)[];
} {
  const adicionados: ((e: EventoDeSaida) => void)[] = [];
  const removidos: ((e: EventoDeSaida) => void)[] = [];
  return {
    adicionados,
    removidos,
    janela: {
      addEventListener: (_t, ouvinte) => adicionados.push(ouvinte),
      removeEventListener: (_t, ouvinte) => removidos.push(ouvinte),
    },
  };
}

describe("useAvisoDeSaida — sair no meio de uma gravação (achado BAIXO #7)", () => {
  it("PRONTO QUANDO: com gravação em voo, registra UM ouvinte de beforeunload", () => {
    const { janela, adicionados } = janelaFalsa();
    const limpar = registrarAvisoDeSaida(janela, true);
    expect(adicionados).toHaveLength(1);
    expect(typeof limpar).toBe("function");
  });

  it("PRONTO QUANDO: página parada (nada em voo) não registra nada — ninguém é perguntado à toa", () => {
    const { janela, adicionados } = janelaFalsa();
    expect(registrarAvisoDeSaida(janela, false)).toBeUndefined();
    expect(adicionados).toHaveLength(0);
  });

  it("PRONTO QUANDO: ao terminar a gravação, remove EXATAMENTE o ouvinte que registrou", () => {
    const { janela, adicionados, removidos } = janelaFalsa();
    const limpar = registrarAvisoDeSaida(janela, true);
    limpar?.();
    expect(removidos).toHaveLength(1);
    expect(removidos[0]).toBe(adicionados[0]);
  });

  it("PRONTO QUANDO: o ouvinte devolve o que o navegador precisa para mostrar o aviso padrão", () => {
    const { janela, adicionados } = janelaFalsa();
    registrarAvisoDeSaida(janela, true);
    const evento = { preventDefault: () => (chamouPreventDefault = true), returnValue: undefined };
    let chamouPreventDefault = false;
    adicionados[0]?.(evento as unknown as EventoDeSaida);
    expect(chamouPreventDefault).toBe(true);
    expect(evento.returnValue).toBe("");
  });

  it("sem janela (render no servidor) não estoura nem registra", () => {
    expect(registrarAvisoDeSaida(null, true)).toBeUndefined();
  });
});
