import { describe, expect, it } from "vitest";

import { escolherConta } from "@/core/prompts/roteador";
import { MODELO_POR_COMPLEXIDADE } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — o roteador de conta é a peça central do pedido do
 * operador ("a conta com mais tokens disponíveis para a complexidade"), e
 * como a cota real não é mensurável (R1 do mapa !4z), o teste prova o
 * INVERSO: menor consumo, desempate declarado, recusa quando as 3 bateram o
 * teto, e a tabela complexidade → modelo (idêntica a `model-routing.md`).
 */
describe("escolherConta", () => {
  it("escolhe a conta com menor consumo hoje", () => {
    const r = escolherConta(
      {
        "lucasscudeler@gmail.com": 100,
        "lsgpandora@gmail.com": 10,
        "almapetra.ltda@gmail.com": 50,
      },
      {
        "lucasscudeler@gmail.com": 150,
        "lsgpandora@gmail.com": 150,
        "almapetra.ltda@gmail.com": 150,
      },
      "baixa",
    );
    expect(r.conta).toBe("lsgpandora@gmail.com");
    expect(r.motivo).toMatch(/menor consumo hoje/);
    expect(r.modeloSugerido).toBe("Haiku");
  });

  it("empate (as 3 em US$0) desempata para a conta preferida (default: lucasscudeler@gmail.com)", () => {
    const r = escolherConta(
      { "lucasscudeler@gmail.com": 0, "lsgpandora@gmail.com": 0, "almapetra.ltda@gmail.com": 0 },
      { "lucasscudeler@gmail.com": 150, "lsgpandora@gmail.com": 150, "almapetra.ltda@gmail.com": 150 },
      "media",
    );
    expect(r.conta).toBe("lucasscudeler@gmail.com");
    expect(r.motivo).toMatch(/empate/);
    expect(r.modeloSugerido).toBe("Sonnet");
  });

  it("empate com outra conta preferida desempata para ela", () => {
    const r = escolherConta(
      { "lucasscudeler@gmail.com": 5, "lsgpandora@gmail.com": 5, "almapetra.ltda@gmail.com": 20 },
      { "lucasscudeler@gmail.com": 150, "lsgpandora@gmail.com": 150, "almapetra.ltda@gmail.com": 150 },
      "alta",
      "lsgpandora@gmail.com",
    );
    expect(r.conta).toBe("lsgpandora@gmail.com");
  });

  it("ignora conta que já bateu o próprio teto (consumo >= teto)", () => {
    const r = escolherConta(
      {
        "lucasscudeler@gmail.com": 150, // bateu o teto — fora
        "lsgpandora@gmail.com": 80,
        "almapetra.ltda@gmail.com": 120,
      },
      { "lucasscudeler@gmail.com": 150, "lsgpandora@gmail.com": 150, "almapetra.ltda@gmail.com": 150 },
      "baixa",
    );
    expect(r.conta).toBe("lsgpandora@gmail.com");
  });

  it("as 3 contas bateram o teto -> conta null com motivo declarado", () => {
    const r = escolherConta(
      { "lucasscudeler@gmail.com": 150, "lsgpandora@gmail.com": 151, "almapetra.ltda@gmail.com": 200 },
      { "lucasscudeler@gmail.com": 150, "lsgpandora@gmail.com": 150, "almapetra.ltda@gmail.com": 150 },
      "maxima",
    );
    expect(r.conta).toBeNull();
    expect(r.motivo).toBe("as 3 contas já bateram o teto diário hoje");
    expect(r.modeloSugerido).toBe("Fable");
  });

  it("conta/teto ausentes no mapa caem no default (consumo 0, teto 150)", () => {
    const r = escolherConta({}, {}, "baixa");
    expect(r.conta).toBe("lucasscudeler@gmail.com"); // empate em 0 nas 3 -> preferida
  });

  it("tabela complexidade -> modelo é idêntica à de model-routing.md", () => {
    expect(MODELO_POR_COMPLEXIDADE).toEqual({
      baixa: "Haiku",
      media: "Sonnet",
      alta: "Opus",
      maxima: "Fable",
    });
  });
});
