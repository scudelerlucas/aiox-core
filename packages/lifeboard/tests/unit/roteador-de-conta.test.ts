import { describe, expect, it } from "vitest";

import { contaTemEspacoPara, escolherConta } from "@/core/prompts/roteador";
import { CUSTO_ESTIMADO_POR_COMPLEXIDADE, MODELO_POR_COMPLEXIDADE } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — o roteador de conta é a peça central do pedido do
 * operador ("a conta com mais tokens disponíveis para a complexidade"), e
 * como a cota real não é mensurável (R1 do mapa !4z), o teste prova o
 * INVERSO: menor consumo, desempate declarado, recusa quando as 3 bateram o
 * teto, e a tabela complexidade → modelo (idêntica a `model-routing.md`).
 *
 * Rodada de correção (13/09/2026, achado ALTO #8 do crítico hostil): a v1
 * filtrava só `consumo < teto`; a v2 filtra por HEADROOM (`teto − consumo −
 * reservado`) ≥ custo estimado da complexidade — os testes abaixo agora
 * passam `reservados` e cobrem exatamente o caso que reprovou (uma conta
 * "livre" pelo teto mas sem espaço real para a tarefa pedida).
 */
describe("escolherConta", () => {
  it("escolhe a conta com menor consumo hoje (sem reserva)", () => {
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
      {},
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

  it("as 3 contas bateram o teto -> conta null com motivo declarado (headroom insuficiente)", () => {
    const r = escolherConta(
      { "lucasscudeler@gmail.com": 150, "lsgpandora@gmail.com": 151, "almapetra.ltda@gmail.com": 200 },
      { "lucasscudeler@gmail.com": 150, "lsgpandora@gmail.com": 150, "almapetra.ltda@gmail.com": 150 },
      "maxima",
    );
    expect(r.conta).toBeNull();
    expect(r.motivo).toMatch(/nenhuma conta tem US\$ 120\.00 livres/);
    expect(r.modeloSugerido).toBe("Fable");
  });

  it("conta/teto/reservado ausentes no mapa caem no default (consumo 0, teto 150, reservado 0)", () => {
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

  it("tabela complexidade -> custo estimado é a mesma seed de painel_custo_estimado (0009)", () => {
    expect(CUSTO_ESTIMADO_POR_COMPLEXIDADE).toEqual({
      baixa: 5,
      media: 15,
      alta: 50,
      maxima: 120,
    });
  });

  // ── Achado CRÍTICO #1 / ALTO #8 (rodada de correção 13/09/2026) ───────────
  describe("headroom (teto − consumo − reservado) — o achado que reprovou a v1", () => {
    it("consumo baixo mas SEM headroom (reservado alto) não é elegível para a complexidade pedida", () => {
      // 149,99 medido + 0 reservado = US$0,01 de headroom — nem uma "baixa" (5) cabe.
      const r = escolherConta(
        { "lucasscudeler@gmail.com": 149.99, "lsgpandora@gmail.com": 149.99, "almapetra.ltda@gmail.com": 149.99 },
        { "lucasscudeler@gmail.com": 150, "lsgpandora@gmail.com": 150, "almapetra.ltda@gmail.com": 150 },
        "baixa",
      );
      expect(r.conta).toBeNull();
      expect(r.motivo).toMatch(/nenhuma conta tem US\$ 5\.00 livres/);
    });

    it("consumo=0 mas reservado alto (fila cheia) também derruba o headroom", () => {
      const r = escolherConta(
        { "lucasscudeler@gmail.com": 0, "lsgpandora@gmail.com": 0, "almapetra.ltda@gmail.com": 0 },
        { "lucasscudeler@gmail.com": 150, "lsgpandora@gmail.com": 150, "almapetra.ltda@gmail.com": 150 },
        "maxima",
        { "lucasscudeler@gmail.com": 145, "lsgpandora@gmail.com": 145, "almapetra.ltda@gmail.com": 40 },
      );
      // só almapetra tem headroom (150-0-40=110 >= 120? não — 110<120 também
      // fica fora). Ajustando: nenhuma das 3 cabe (145 e 40 de reservado, teto
      // 150, estimado maxima=120 -> headroom max é 110) -> null.
      expect(r.conta).toBeNull();
    });

    it("entre duas contas com o MESMO consumo medido, a que tem MENOS reservado não entra no critério de escolha (escolha é por consumo, não por headroom) mas seria filtrada se sem headroom", () => {
      const r = escolherConta(
        { "lucasscudeler@gmail.com": 50, "lsgpandora@gmail.com": 50, "almapetra.ltda@gmail.com": 50 },
        { "lucasscudeler@gmail.com": 150, "lsgpandora@gmail.com": 150, "almapetra.ltda@gmail.com": 150 },
        "alta", // estimado 50
        { "lucasscudeler@gmail.com": 0, "lsgpandora@gmail.com": 51, "almapetra.ltda@gmail.com": 0 },
      );
      // lsgpandora: headroom = 150-50-51 = 49 < 50 -> fora.
      // lucasscudeler e almapetra: headroom = 100 >= 50 -> elegíveis, empatadas em consumo 50 -> preferida.
      expect(r.conta).toBe("lucasscudeler@gmail.com");
    });
  });

  describe("contaTemEspacoPara", () => {
    it("true quando headroom cobre o custo estimado", () => {
      expect(
        contaTemEspacoPara({ consumoHojeUsd: 50, reservadoUsd: 20, tetoUsd: 150 }, "alta"),
      ).toBe(true); // headroom 80 >= 50
    });
    it("false quando headroom não cobre", () => {
      expect(
        contaTemEspacoPara({ consumoHojeUsd: 100, reservadoUsd: 40, tetoUsd: 150 }, "alta"),
      ).toBe(false); // headroom 10 < 50
    });
  });

  // ── Achado BAIXO #16: paridade TS × SQL ───────────────────────────────────
  // O SQL real (fila_prompts_enfileirar, 0009_lifeboard_v3_fila_ajustes.sql)
  // roda no Postgres — não dá para chamá-lo offline neste teste. A paridade
  // provada aqui é: mesma tabela de casos, mesma decisão. A tabela abaixo foi
  // rodada CONTRA O BANCO DE VERDADE (mcp__Supabase__execute_sql, proof block
  // da migration 0009 — ver relatório da sessão) com os MESMOS números; os 3
  // casos de teto/reserva do proof (a/b/d) batem com o que `escolherConta` e
  // `contaTemEspacoPara` decidem aqui. Isto documenta a paridade — não a
  // executa a cada `vitest run` (o SQL não roda em CI sem banco).
  describe("paridade com o roteamento SQL (fila_prompts_enfileirar / painel_fila_prompts_checar_teto)", () => {
    const casosProvadosNoBanco = [
      {
        rotulo: "seed medido 149,99, teto 150: maxima (120) recusada",
        consumo: 149.99,
        reservado: 0,
        teto: 150,
        complexidade: "maxima" as const,
        headroomEsperado: 0.01,
        cabeNoBanco: false, // provado: RAISE EXCEPTION 'fila: ... ficaria em US$ 269.99 ...'
      },
      {
        rotulo: "seed medido 149,99, teto 150: baixa (5) recusada",
        consumo: 149.99,
        reservado: 0,
        teto: 150,
        complexidade: "baixa" as const,
        headroomEsperado: 0.01,
        cabeNoBanco: false, // provado: RAISE EXCEPTION 'fila: ... US$ 154.99 ...'
      },
      {
        rotulo: "teto 200, reservado 100 (1a pega + 2a na_fila, 50+50): maxima (120) recusada",
        consumo: 0,
        reservado: 100,
        teto: 200,
        complexidade: "maxima" as const,
        headroomEsperado: 100,
        cabeNoBanco: false, // provado: 'fila: ... US$ 220.00 ... teto US$ 200.00'
      },
      {
        rotulo: "teto 200, reservado 0: alta (50) cabe",
        consumo: 0,
        reservado: 0,
        teto: 200,
        complexidade: "alta" as const,
        headroomEsperado: 200,
        cabeNoBanco: true, // provado: insert OK, pegar_interno pegou o item
      },
    ];

    it.each(casosProvadosNoBanco)(
      "$rotulo",
      ({ consumo, reservado, teto, complexidade, cabeNoBanco }) => {
        const cabeNoTS = contaTemEspacoPara(
          { consumoHojeUsd: consumo, reservadoUsd: reservado, tetoUsd: teto },
          complexidade,
        );
        expect(cabeNoTS).toBe(cabeNoBanco);
      },
    );
  });
});
