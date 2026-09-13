import { describe, expect, it } from "vitest";

import { FUSO_DO_OPERADOR, hojeNoFusoDoOperador } from "@/lib/fuso";

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
