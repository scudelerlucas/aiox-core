import { describe, expect, it } from "vitest";

import { prontidaoDoEnvio } from "@/core/prompts/roteador";
import { AGORA_FIXTURE, FIXTURE_CONSUMO } from "@/lib/repositories/prompts-fila.fixture";

const BASE = FIXTURE_CONSUMO.find((c) => c.conta === "lucasscudeler@gmail.com");
if (!BASE) throw new Error("fixture sem a conta do Lucas");

describe("P2 Codex (PR #42, 17ª rodada) — a escolha manual avisa quando a conta está no limite de voo", () => {
  const escolhaAuto = { cabeHoje: true, todasSemVaga: false };

  it("conta escolhida à mão com dinheiro e vaga: sem aviso", () => {
    const r = prontidaoDoEnvio({ ...BASE, emVoo: 1, limiteEmVoo: 4 }, escolhaAuto, "baixa", AGORA_FIXTURE);
    expect(r.naoCabeHoje).toBe(false);
    expect(r.avisoEspera).toBeUndefined();
  });

  it("conta escolhida à mão com dinheiro mas no limite de voo: avisa a espera por vaga", () => {
    const r = prontidaoDoEnvio({ ...BASE, emVoo: 4, limiteEmVoo: 4 }, escolhaAuto, "baixa", AGORA_FIXTURE);
    expect(r.naoCabeHoje).toBe(true);
    expect(r.overrideSemEspaco).toBe(false);
    expect(r.avisoEspera).toContain("limite de sessões em voo");
  });

  it("automático com todas as contas no limite: avisa, mesmo com dinheiro", () => {
    const r = prontidaoDoEnvio(undefined, { cabeHoje: true, todasSemVaga: true }, "baixa", AGORA_FIXTURE);
    expect(r.naoCabeHoje).toBe(true);
  });

  it("automático com vaga e dinheiro: sem aviso", () => {
    const r = prontidaoDoEnvio(undefined, escolhaAuto, "baixa", AGORA_FIXTURE);
    expect(r.naoCabeHoje).toBe(false);
  });
});
