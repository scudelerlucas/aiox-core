import { describe, expect, it } from "vitest";

import { diaNoFusoDoOperador, FUSO_DO_OPERADOR, hojeNoFusoDoOperador } from "@/lib/fuso";

/**
 * OS-LIFEBOARD · P5b (achado ALTO #10 do crítico hostil): `hoje` computado em
 * UTC (`toISOString().slice(0,10)`) adianta um dia para o operador
 * (America/Sao_Paulo, UTC-3) entre 21h00 e 23h59 no relógio dele. Instante
 * fixo: 2026-09-13T01:30:00Z → 2026-09-12 22:30 em São Paulo — ainda
 * 2026-09-12 lá, mas já 2026-09-13 em UTC. É exatamente o caso que capturava
 * a linha "hoje" do Gantt um dia à frente do calendário real.
 */
describe("hojeNoFusoDoOperador", () => {
  it("01:30Z ainda é o dia anterior em America/Sao_Paulo", () => {
    const instanteFixo = new Date("2026-09-13T01:30:00.000Z");
    expect(hojeNoFusoDoOperador(instanteFixo)).toBe("2026-09-12");
  });

  it("12:00Z já é o mesmo dia em ambos os fusos", () => {
    const instanteFixo = new Date("2026-09-13T12:00:00.000Z");
    expect(hojeNoFusoDoOperador(instanteFixo)).toBe("2026-09-13");
  });

  it("FUSO_DO_OPERADOR é America/Sao_Paulo — nunca UTC implícito", () => {
    expect(FUSO_DO_OPERADOR).toBe("America/Sao_Paulo");
  });
});

/**
 * [ALTO 2, rodada 13] A conversão que faltava: o DIA de um instante qualquer
 * (não só "agora") no fuso do operador. Todos os instantes abaixo são
 * CONGELADOS em literal — nenhum teste aqui pergunta as horas ao relógio da
 * máquina, senão ele passaria ou falharia conforme a hora em que roda.
 */
describe("diaNoFusoDoOperador", () => {
  it("23h em São Paulo ainda é o dia 21, embora em UTC já seja 22", () => {
    // 2026-09-22T02:00Z = 21/09 23h00 em São Paulo (UTC−3).
    expect(diaNoFusoDoOperador("2026-09-22T02:00:00.000Z")).toBe("2026-09-21");
    expect("2026-09-22T02:00:00.000Z".slice(0, 10)).toBe("2026-09-22"); // o que o `slice` dizia
  });

  it("00h30 em São Paulo é o dia novo, embora em UTC ainda seja o mesmo", () => {
    // 2026-09-22T03:30Z = 22/09 00h30 em São Paulo — aqui os dois fusos
    // coincidem; a rede é o caso simétrico do anterior, para a correção não
    // virar um deslocamento constante de um dia para trás.
    expect(diaNoFusoDoOperador("2026-09-22T03:30:00.000Z")).toBe("2026-09-22");
  });

  it("meia-noite UTC é sempre o dia ANTERIOR em São Paulo", () => {
    expect(diaNoFusoDoOperador("2026-09-01T00:00:00.000Z")).toBe("2026-08-31");
  });

  it("horário de verão: em fev/2017 São Paulo era UTC−2, e a conversão usa isso", () => {
    /*
     * America/Sao_Paulo não tem mais horário de verão (extinto em 2019), mas a
     * conversão não pode ser um "−3 fixo" escrito à mão: dado antigo existe no
     * banco. 2017-02-01T01:30Z, com o horário de verão em vigor (UTC−2), é
     * 31/01 às 23h30 em São Paulo. Um "−3 fixo" daria a mesma resposta aqui,
     * então o par abaixo separa os dois: 2017-02-01T02:30Z é 00h30 de 01/02 em
     * UTC−2 (dia 1º) e seria 23h30 de 31/01 num "−3 fixo" (dia 31).
     */
    expect(diaNoFusoDoOperador("2017-02-01T01:30:00.000Z")).toBe("2017-01-31");
    expect(diaNoFusoDoOperador("2017-02-01T02:30:00.000Z")).toBe("2017-02-01");
  });

  it("`AAAA-MM-DD` sem hora sai IGUAL — converter seria inventar um fuso", () => {
    expect(diaNoFusoDoOperador("2026-09-22")).toBe("2026-09-22");
  });

  it("ISO ilegível devolve null — o chamador decide, esta função nunca lança", () => {
    expect(diaNoFusoDoOperador("abc")).toBeNull();
    expect(diaNoFusoDoOperador("")).toBeNull();
  });
});
