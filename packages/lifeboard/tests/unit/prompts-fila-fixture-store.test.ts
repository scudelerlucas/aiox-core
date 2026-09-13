import { beforeEach, describe, expect, it } from "vitest";

import {
  ajustarTetoFixture,
  cancelarFixture,
  enfileirarFixture,
  envelhecerSinalFixture,
  fecharFixture,
  filaTemMaisFixture,
  heartbeatFixture,
  listarConsumoFixture,
  listarFilaFixture,
  pegarFixture,
  resetarFilaFixtureStore,
} from "@/lib/repositories/prompts-fila.fixture-store";
import { AGORA_FIXTURE } from "@/lib/repositories/prompts-fila.fixture";
import type { Conta } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — o fixture-store é o ESPELHO em memória das RPCs. Se ele
 * e o banco decidissem diferente, `/prompts` mentiria em dev e em teste.
 *
 * Estes testes são a metade em TypeScript das provas que a migration 0012
 * rodou AO VIVO contra o Postgres (13/09/2026, blocos com rollback): posse
 * (D1), expiração com fim (D2), elegibilidade por item (D3), cancelar `pega`
 * (D7) e idempotência/paginação (D8). Mesmos números dos blocos SQL.
 */

const LUCAS: Conta = "lucasscudeler@gmail.com";
const PANDORA: Conta = "lsgpandora@gmail.com";
const ALMA: Conta = "almapetra.ltda@gmail.com";
const AGORA = AGORA_FIXTURE;

beforeEach(() => {
  resetarFilaFixtureStore();
});

describe("D1 — posse (fencing) e heartbeat", () => {
  it("pegar grava worker, sinal de vida e incrementa a tentativa", () => {
    const r = pegarFixture(LUCAS, "W1", AGORA);
    expect(r.item?.workerId).toBe("W1");
    expect(r.item?.tentativas).toBe(1);
    expect(r.item?.heartbeatEm).toBe(new Date(AGORA).toISOString());
  });

  it("fechar de OUTRO worker é recusado; do dono é aceito; do dono de novo é ja_fechado", () => {
    const pego = pegarFixture(LUCAS, "W1", AGORA).item;
    expect(pego).not.toBeNull();
    const id = (pego as { id: string }).id;

    const deW2 = fecharFixture({
      id,
      conta: LUCAS,
      workerId: "W2",
      estado: "concluida",
      custoUsd: 1,
      agora: AGORA,
    });
    expect(deW2).toEqual({ erro: "Item pertence a outro worker (W1)." });

    const deW1 = fecharFixture({
      id,
      conta: LUCAS,
      workerId: "W1",
      estado: "concluida",
      custoUsd: 1.5,
      sessionId: "sessao-filha",
      agora: AGORA,
    });
    expect(deW1).toEqual({ ok: true, jaFechado: false });

    // D8: o worker pode repetir o passo de fechamento depois de um timeout.
    const deNovo = fecharFixture({
      id,
      conta: LUCAS,
      workerId: "W1",
      estado: "concluida",
      custoUsd: 1.5,
      agora: AGORA,
    });
    expect(deNovo).toEqual({ ok: true, jaFechado: true });
  });

  it("custo fora de 0..500 é recusado (negativo zerava o freio do teto)", () => {
    const id = (pegarFixture(LUCAS, "W1", AGORA).item as { id: string }).id;
    expect(
      fecharFixture({ id, conta: LUCAS, workerId: "W1", estado: "concluida", custoUsd: -10 }),
    ).toEqual({ erro: "custo_usd fora da faixa aceita (0 a 500)." });
  });
});

describe("D2 — expiração com fim", () => {
  it("mudo há 46 min e com tentativa sobrando: volta para a fila e NÃO é re-pego na mesma chamada", () => {
    const a = pegarFixture(LUCAS, "W1", AGORA).item as { id: string };
    envelhecerSinalFixture(a.id, 46, AGORA);

    // Outro item na mesma conta para provar que o pull continua produzindo.
    enfileirarFixture({ prompt: "outro", complexidade: "baixa", conta: LUCAS, agora: AGORA + 1 });

    const r = pegarFixture(LUCAS, "W2", AGORA);
    expect(r.devolvidos).toBe(1);
    expect(r.mortos).toBe(0);
    expect(r.item?.id).not.toBe(a.id);

    const devolvido = listarFilaFixture(200).find((i) => i.id === a.id);
    expect(devolvido?.estado).toBe("na_fila");
    expect(devolvido?.workerId).toBeNull();
    expect(devolvido?.tentativas).toBe(1);
  });

  it("mudo há 44 min: nada acontece — sessão longa e viva não é roubada", () => {
    const a = pegarFixture(LUCAS, "W1", AGORA).item as { id: string };
    envelhecerSinalFixture(a.id, 44, AGORA);

    const r = pegarFixture(LUCAS, "W2", AGORA);
    expect(r.devolvidos).toBe(0);
    expect(listarFilaFixture(200).find((i) => i.id === a.id)?.estado).toBe("pega");
  });

  it("na ÚLTIMA tentativa vira `falhou` com o custo estimado e o motivo por escrito", () => {
    resetarFilaFixtureStore();
    const novo = enfileirarFixture({
      prompt: "vai morrer",
      complexidade: "baixa",
      conta: PANDORA,
      agora: AGORA,
    });
    const id = (novo as { id: string }).id;

    // 3 ciclos de pegar + emudecer: tentativas 1, 2, 3 (= maxTentativas).
    for (let i = 1; i <= 3; i += 1) {
      const pego = pegarFixture(PANDORA, `W${i}`, AGORA).item;
      expect(pego?.id).toBe(id);
      expect(pego?.tentativas).toBe(i);
      envelhecerSinalFixture(id, 46, AGORA);
      if (i < 3) {
        const volta = pegarFixture(PANDORA, "Wx", AGORA);
        expect(volta.devolvidos).toBe(1);
        expect(volta.mortos).toBe(0);
      }
    }

    const r = pegarFixture(PANDORA, "W4", AGORA);
    expect(r.mortos).toBe(1);
    expect(r.devolvidos).toBe(0);

    const morto = listarFilaFixture(200).find((i) => i.id === id);
    expect(morto?.estado).toBe("falhou");
    expect(morto?.motivoFalha).toBe("expirou 3 vezes sem fechamento");
    expect(morto?.custoUsd).toBe(5); // o estimado da complexidade `baixa`
  });
});

describe("D3 — elegibilidade por item, não reserva agregada", () => {
  it("o que está na_fila NÃO reserva orçamento; só o que está em execução com sinal vivo", () => {
    resetarFilaFixtureStore();
    const antes = listarConsumoFixture(AGORA).find((c) => c.conta === ALMA);
    // A semente tem um item `maxima` (120) na_fila na Alma Petra.
    expect(antes?.naFilaUsd).toBe(120);
    expect(antes?.reservadoUsd).toBe(0);
  });

  it("um item caro na frente não bloqueia o barato atrás dele (pula o que não cabe)", () => {
    resetarFilaFixtureStore();
    // Alma Petra está a 150/150 medido. Baixa o medido para 40 usando outra conta
    // limpa: Pandora (98,50 medido) não serve; usa-se a semente do Lucas (42,10).
    enfileirarFixture({ prompt: "cara", complexidade: "maxima", conta: LUCAS, agora: AGORA + 1 });
    enfileirarFixture({ prompt: "barata", complexidade: "baixa", conta: LUCAS, agora: AGORA + 2 });

    // medido 42,10 + 0 em execução: maxima (120) estoura 150; baixa (5) cabe.
    // A semente já tem um `baixa` na_fila mais antigo — ele sai primeiro.
    const primeiro = pegarFixture(LUCAS, "W1", AGORA);
    expect(primeiro.item?.complexidade).toBe("baixa");
    expect(primeiro.pulados).toBe(0);

    // Com o `baixa` da semente em execução (5) e o `maxima` na frente: pula 1.
    const segundo = pegarFixture(LUCAS, "W2", AGORA);
    expect(segundo.item?.prompt).toBe("barata");
    expect(segundo.pulados).toBe(1);
  });

  it("quando nada cabe, o motivo NOMEIA o menor custo que não coube", () => {
    resetarFilaFixtureStore();
    // Alma Petra: 150 medido de 150 de teto — nem a mais barata cabe.
    enfileirarFixture({ prompt: "x", complexidade: "baixa", conta: ALMA, agora: AGORA });
    const r = pegarFixture(ALMA, "W1", AGORA);
    expect(r.item).toBeNull();
    expect(r.pulados).toBeGreaterThan(0);
    expect(r.motivo).toContain("o mais barato da fila custa US$ 5,00");
  });

  it("fila vazia devolve motivo próprio (não é o mesmo caso de 'nada cabe')", () => {
    resetarFilaFixtureStore();
    pegarFixture(LUCAS, "W1", AGORA); // consome o único `na_fila` do Lucas
    const r = pegarFixture(LUCAS, "W2", AGORA);
    expect(r.item).toBeNull();
    expect(r.motivo).toBe("fila vazia para esta conta");
  });
});

describe("D3 — admissão só recusa o impossível", () => {
  it("item que não cabe HOJE é ACEITO e espera espaço", () => {
    resetarFilaFixtureStore();
    const r = enfileirarFixture({
      prompt: "não cabe hoje",
      complexidade: "maxima",
      conta: ALMA, // 150/150 medido
      agora: AGORA,
    });
    expect("ok" in r && r.ok).toBe(true);
    expect("cabeHoje" in r ? r.cabeHoje : true).toBe(false);
    expect("motivo" in r ? r.motivo : "").toContain("roda quando houver espaço");
  });

  it("item que NUNCA caberia (estimado > teto) é recusado, em português", () => {
    resetarFilaFixtureStore();
    // Com os tetos de produção (150 nas 3) nenhuma complexidade estoura, então
    // a admissão nunca recusa — é o desenho D3. O caso só existe com um teto
    // menor: os MESMOS números do bloco SQL provado ao vivo (teto 10 + máxima).
    expect(listarConsumoFixture(AGORA).every((c) => c.tetoUsd === 150)).toBe(true);
    ajustarTetoFixture(ALMA, 10);
    const r = enfileirarFixture({
      prompt: "a mais cara possível",
      complexidade: "maxima",
      conta: ALMA,
      agora: AGORA,
    });
    expect(r).toEqual({
      erro:
        "Uma tarefa máxima custa cerca de US$ 120,00 e o teto diário da conta " +
        "Alma Petra é US$ 10,00 — nunca vai caber.",
    });
  });
});

describe("D7 — item `pega` não é beco sem saída", () => {
  it("cancelar aceita `pega`, tira da reserva e o heartbeat seguinte diz 'cancelado'", () => {
    resetarFilaFixtureStore();
    const item = pegarFixture(LUCAS, "W1", AGORA).item as { id: string; custoEstimadoUsd: number };
    expect(listarConsumoFixture(AGORA).find((c) => c.conta === LUCAS)?.reservadoUsd).toBe(
      item.custoEstimadoUsd,
    );

    expect(heartbeatFixture(item.id, LUCAS, "W1", "sessao-filha", AGORA)).toEqual({ ok: true });
    expect(cancelarFixture(item.id, AGORA)).toEqual({ ok: true });

    const cancelado = listarFilaFixture(200).find((i) => i.id === item.id);
    expect(cancelado?.estado).toBe("cancelada");
    expect(listarConsumoFixture(AGORA).find((c) => c.conta === LUCAS)?.reservadoUsd).toBe(0);

    expect(heartbeatFixture(item.id, LUCAS, "W1", null, AGORA)).toEqual({
      ok: false,
      motivo: "cancelado",
    });
  });

  it("heartbeat de outro worker não renova nada", () => {
    resetarFilaFixtureStore();
    const item = pegarFixture(LUCAS, "W1", AGORA).item as { id: string };
    expect(heartbeatFixture(item.id, LUCAS, "W2", null, AGORA)).toEqual({
      ok: false,
      motivo: "outro worker",
    });
  });

  it("item já fechado não pode ser cancelado", () => {
    resetarFilaFixtureStore();
    const concluida = listarFilaFixture(200).find((i) => i.estado === "concluida");
    expect(concluida).toBeDefined();
    expect(cancelarFixture((concluida as { id: string }).id, AGORA)).toEqual({
      erro: "Item já fechado (concluída, falhou ou cancelada) — não dá para cancelar.",
    });
  });
});

describe("D8 — paginação e truncamento espelham a RPC", () => {
  it("limite corta a página e temMais avisa que há mais atrás", () => {
    resetarFilaFixtureStore();
    expect(listarFilaFixture(3)).toHaveLength(3);
    expect(filaTemMaisFixture(3)).toBe(true);
    expect(filaTemMaisFixture(200)).toBe(false);
  });

  it("o prompt vem truncado em 300 caracteres, com o tamanho real ao lado", () => {
    resetarFilaFixtureStore();
    const longo = "L".repeat(1200);
    enfileirarFixture({ prompt: longo, complexidade: "baixa", conta: LUCAS, agora: AGORA + 10 });
    const primeiro = listarFilaFixture(1)[0];
    expect(primeiro?.prompt).toHaveLength(300);
    expect(primeiro?.promptTamanho).toBe(1200);
  });

  it("antesDe pagina por criado_em desc", () => {
    resetarFilaFixtureStore();
    const pagina1 = listarFilaFixture(2);
    const corte = pagina1[1]?.criadoEm as string;
    const pagina2 = listarFilaFixture(2, corte);
    expect(pagina2.every((i) => i.criadoEm < corte)).toBe(true);
    expect(pagina2.map((i) => i.id)).not.toContain(pagina1[0]?.id);
  });
});
