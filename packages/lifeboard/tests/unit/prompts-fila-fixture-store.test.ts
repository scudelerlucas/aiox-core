import { beforeEach, describe, expect, it } from "vitest";

import {
  ajustarCustoFixture,
  ajustarTetoFixture,
  cancelarFixture,
  cursorDaPaginaFixture,
  enfileirarFixture,
  envelhecerSinalFixture,
  fecharFixture,
  filaTemMaisFixture,
  heartbeatFixture,
  listarConsumoFixture,
  listarFilaFixture,
  pegarFixture,
  publicarSessaoFixture,
  resetarFilaFixtureStore,
  vencerBackoffFixture,
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
    expect(deW1).toEqual({ ok: true, jaFechado: false, estado: "concluida" });

    // D8: o worker pode repetir o passo de fechamento depois de um timeout.
    const deNovo = fecharFixture({
      id,
      conta: LUCAS,
      workerId: "W1",
      estado: "concluida",
      custoUsd: 1.5,
      agora: AGORA,
    });
    expect(deNovo).toEqual({ ok: true, jaFechado: true, estado: "concluida" });
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
        // D19 (rodada 4): o item devolvido cumpre castigo antes de voltar a ser
        // elegível — sem isto, um item que mata a sessão era re-pego na hora e
        // queimava o teto do dia em três voltas seguidas.
        vencerBackoffFixture(id, AGORA);
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
    // D14: o fixture devolve CÓDIGO, igual à RPC — a frase é do `actions.ts`.
    expect("motivoCodigo" in r ? r.motivoCodigo : "").toBe("manual_nao_cabe_hoje");
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

    expect(heartbeatFixture(item.id, LUCAS, "W1", "sessao-filha", AGORA)).toEqual({
      ok: true,
      // D18: a Routine precisa ver o relógio, não decorá-lo.
      expiraEm: new Date(AGORA + 45 * 60_000).toISOString(),
    });
    // D12 (rodada 4): cancelar em execução NÃO é de graça — o estimado entra
    // no gasto do dia, marcado como estimativa.
    expect(cancelarFixture(item.id, AGORA)).toEqual({
      ok: true,
      motivoCancelamento: "cancelado_em_execucao",
      custoLancadoUsd: 5,
      tentativas: 1,
    });

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

// ═══════════════════════════════════════════════════════════════════════════
// RODADA 4 — a contabilidade. Os MESMOS números dos blocos SQL rodados ao vivo
// em 13/09/2026 (com rollback), agora em TypeScript.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * O pull pega o MAIS ANTIGO que cabe (D3) — e a semente já tem itens na frente.
 * Para exercitar um item específico, puxa-se até ele sair. Cada volta usa um
 * worker diferente, como duas Routines fariam.
 */
function pegarAte(conta: Conta, id: string, agora: number): string {
  for (let volta = 1; volta <= 10; volta += 1) {
    const r = pegarFixture(conta, `W-ate-${volta}`, agora);
    if (r.item === null) break;
    if (r.item.id === id) return `W-ate-${volta}`;
  }
  throw new Error(`o pull nunca chegou ao item ${id}`);
}

describe("D16 — o consumo do fixture MEXE (não é mais constante)", () => {
  it("fechar um item com custo sobe o gasto do dia da conta", () => {
    resetarFilaFixtureStore();
    const antes = listarConsumoFixture(AGORA).find((c) => c.conta === LUCAS)?.consumoHojeUsd;
    const item = pegarFixture(LUCAS, "W1", AGORA).item as { id: string };
    fecharFixture({
      id: item.id,
      conta: LUCAS,
      workerId: "W1",
      estado: "concluida",
      custoUsd: 20,
      agora: AGORA,
    });
    const depois = listarConsumoFixture(AGORA).find((c) => c.conta === LUCAS)?.consumoHojeUsd;
    expect((depois ?? 0) - (antes ?? 0)).toBeCloseTo(20, 5);
  });

  it("a semente continua somando 42,10 no Lucas — o item concluído entra por cima da base", () => {
    resetarFilaFixtureStore();
    expect(listarConsumoFixture(AGORA).find((c) => c.conta === LUCAS)?.consumoHojeUsd).toBeCloseTo(
      42.1,
      5,
    );
  });

  it("o teto barra o pull DE VERDADE: gastar 140 no Lucas impede a próxima tarefa alta", () => {
    resetarFilaFixtureStore();
    const item = pegarFixture(LUCAS, "W1", AGORA).item as { id: string };
    fecharFixture({
      id: item.id,
      conta: LUCAS,
      workerId: "W1",
      estado: "concluida",
      custoUsd: 100,
      agora: AGORA,
    });
    // 38,68 publicadas + 3,42 (item da semente) + 100 = 142,10 de 150.
    enfileirarFixture({ prompt: "alta", complexidade: "alta", conta: LUCAS, agora: AGORA + 1 });
    const r = pegarFixture(LUCAS, "W2", AGORA);
    expect(r.item).toBeNull();
    expect(r.motivo).toContain("o mais barato da fila custa US$ 50,00");
  });
});

describe("D10 — publicar a sessão SUBTRAI, nunca apaga", () => {
  function prepara(): string {
    resetarFilaFixtureStore();
    const item = pegarFixture(LUCAS, "W1", AGORA).item as { id: string };
    fecharFixture({
      id: item.id,
      conta: LUCAS,
      workerId: "W1",
      estado: "concluida",
      custoUsd: 118.4,
      sessionId: "session_FILHA_D10",
      agora: AGORA,
    });
    return item.id;
  }
  function medido(): number {
    return listarConsumoFixture(AGORA).find((c) => c.conta === LUCAS)?.consumoHojeUsd ?? 0;
  }

  it("os 4 números do bloco SQL: 118,40 → 118,40 → 118,40 → 130,00", () => {
    prepara();
    const base = 38.68 + 3.42; // publicadas + o item concluído da semente
    expect(medido() - base).toBeCloseTo(118.4, 5);

    // A sessão filha é publicada SEM custo (21 das 215 sessões reais são assim).
    publicarSessaoFixture(LUCAS, "session_FILHA_D10", null);
    expect(medido() - base).toBeCloseTo(118.4, 5);

    publicarSessaoFixture(LUCAS, "session_FILHA_D10", 100);
    expect(medido() - base).toBeCloseTo(118.4, 5);

    publicarSessaoFixture(LUCAS, "session_FILHA_D10", 130);
    expect(medido() - base).toBeCloseTo(130, 5);
  });
});

describe("D11 — session_id é chave, não texto livre", () => {
  it("recusa o id do WORKER no lugar do id da sessão filha", () => {
    resetarFilaFixtureStore();
    const item = pegarFixture(LUCAS, "W1", AGORA).item as { id: string };
    expect(heartbeatFixture(item.id, LUCAS, "W1", "W1", AGORA)).toEqual({
      erro: "session_id é o id da sessão FILHA, não o da Routine",
    });
    expect(
      fecharFixture({
        id: item.id,
        conta: LUCAS,
        workerId: "W1",
        estado: "concluida",
        custoUsd: 1,
        sessionId: "W1",
        agora: AGORA,
      }),
    ).toEqual({ erro: "session_id é o id da sessão FILHA, não o da Routine" });
  });

  it("recusa uma sessão já vinculada a outro item", () => {
    resetarFilaFixtureStore();
    const item = pegarFixture(LUCAS, "W1", AGORA).item as { id: string };
    // A semente já usa `session_01FILHA000000000000000001` no item-1.
    const r = heartbeatFixture(item.id, LUCAS, "W1", "session_01FILHA000000000000000001", AGORA);
    expect("erro" in r ? r.erro : "").toContain("sessão já vinculada ao item");
  });
});

describe("D12 — cancelar não perdoa, e a medição real corrige depois", () => {
  it("cancelar pega (estimado 50) → 50 no gasto; fechar depois com 33 → 33", () => {
    resetarFilaFixtureStore();
    const base = listarConsumoFixture(AGORA).find((c) => c.conta === LUCAS)?.consumoHojeUsd ?? 0;
    const novo = enfileirarFixture({
      prompt: "vai ser cancelado",
      complexidade: "alta",
      conta: LUCAS,
      agora: AGORA,
    });
    const id = (novo as { id: string }).id;
    const worker = pegarAte(LUCAS, id, AGORA);

    const cancel = cancelarFixture(id, AGORA);
    expect("motivoCancelamento" in cancel ? cancel.motivoCancelamento : "").toBe(
      "cancelado_em_execucao",
    );
    expect("custoLancadoUsd" in cancel ? cancel.custoLancadoUsd : -1).toBe(50);
    const depoisDoCancel =
      (listarConsumoFixture(AGORA).find((c) => c.conta === LUCAS)?.consumoHojeUsd ?? 0) - base;
    expect(depoisDoCancel).toBeCloseTo(50, 5);

    const fechado = fecharFixture({
      id,
      conta: LUCAS,
      workerId: worker,
      estado: "concluida",
      custoUsd: 33,
      agora: AGORA,
    });
    expect(fechado).toEqual({ ok: true, jaFechado: false, estado: "cancelada" });
    const depoisDoFechar =
      (listarConsumoFixture(AGORA).find((c) => c.conta === LUCAS)?.consumoHojeUsd ?? 0) - base;
    expect(depoisDoFechar).toBeCloseTo(33, 5);
    expect(listarFilaFixture(200).find((i) => i.id === id)?.estado).toBe("cancelada");
  });

  it("cancelar item que NUNCA foi pego é de graça (e diz isso)", () => {
    resetarFilaFixtureStore();
    const base = listarConsumoFixture(AGORA).find((c) => c.conta === ALMA)?.consumoHojeUsd ?? 0;
    const novo = enfileirarFixture({
      prompt: "virgem",
      complexidade: "alta",
      conta: ALMA,
      agora: AGORA,
    });
    const r = cancelarFixture((novo as { id: string }).id, AGORA);
    expect("motivoCancelamento" in r ? r.motivoCancelamento : "").toBe("cancelado_nunca_pego");
    expect("custoLancadoUsd" in r ? r.custoLancadoUsd : -1).toBe(0);
    expect(listarConsumoFixture(AGORA).find((c) => c.conta === ALMA)?.consumoHojeUsd).toBeCloseTo(
      base,
      5,
    );
  });
});

describe("D19 — backoff: quem volta cumpre castigo antes de ser re-pego", () => {
  it("devolvido fica em espera 15 min × tentativas e o pull NOMEIA isso", () => {
    resetarFilaFixtureStore();
    const a = pegarFixture(LUCAS, "W1", AGORA).item as { id: string };
    envelhecerSinalFixture(a.id, 46, AGORA);

    const primeiro = pegarFixture(LUCAS, "W2", AGORA);
    expect(primeiro.devolvidos).toBe(1);
    expect(primeiro.item).toBeNull();
    // #11: "fila vazia" seria mentira — havia um item, acabou de voltar.
    expect(primeiro.motivo).toBe(
      "1 item(ns) devolvido(s) para a fila, aguardando nova tentativa",
    );

    const segundo = pegarFixture(LUCAS, "W3", AGORA);
    expect(segundo.item).toBeNull();
    expect(segundo.emEspera).toBe(1);
    expect(segundo.motivo).toBe("1 item(ns) em espera de nova tentativa");

    vencerBackoffFixture(a.id, AGORA);
    const terceiro = pegarFixture(LUCAS, "W4", AGORA);
    expect(terceiro.item?.id).toBe(a.id);
    expect(terceiro.item?.tentativas).toBe(2);
  });
});

describe("D20 — a parcela de estimativa é marcada, dita e ajustável", () => {
  it("item morto conta o estimado, aparece como estimativa e o ajuste corrige o dia", () => {
    resetarFilaFixtureStore();
    // A Alma Petra da semente está exatamente no teto; sobe-se o teto ANTES de
    // enfileirar, para o pull conseguir liberar o item e o cenário ser sobre a
    // MORTE do item, não sobre o teto.
    ajustarTetoFixture(ALMA, 400);
    const base = listarConsumoFixture(AGORA).find((c) => c.conta === ALMA)?.consumoHojeUsd ?? 0;
    const novo = enfileirarFixture({
      prompt: "vai morrer",
      complexidade: "alta",
      conta: ALMA,
      agora: AGORA,
    });
    const id = (novo as { id: string }).id;

    for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
      pegarAte(ALMA, id, AGORA);
      envelhecerSinalFixture(id, 46, AGORA);
      if (tentativa < 3) {
        pegarFixture(ALMA, "W-expira", AGORA); // a expiração acontece no pull
        vencerBackoffFixture(id, AGORA);
      }
    }
    const morte = pegarFixture(ALMA, "W9", AGORA);
    expect(morte.mortos).toBe(1);
    expect(morte.motivo).toContain("do consumo são estimativa de 1 item(ns) que morreram sem fechar");

    const conta = listarConsumoFixture(AGORA).find((c) => c.conta === ALMA) as {
      consumoHojeUsd: number;
      estimativaUsd: number;
      estimativaItens: number;
    };
    expect(conta.consumoHojeUsd - base).toBeCloseTo(50, 5);
    expect(conta.estimativaUsd).toBeCloseTo(50, 5);
    expect(conta.estimativaItens).toBe(1);
    expect(listarFilaFixture(200).find((i) => i.id === id)?.custoEEstimativa).toBe(true);

    expect(ajustarCustoFixture(id, 12.34, AGORA)).toEqual({ ok: true });
    const depois = listarConsumoFixture(AGORA).find((c) => c.conta === ALMA) as {
      consumoHojeUsd: number;
      estimativaUsd: number;
    };
    expect(depois.consumoHojeUsd - base).toBeCloseTo(12.34, 5);
    expect(depois.estimativaUsd).toBe(0);
    expect(listarFilaFixture(200).find((i) => i.id === id)?.custoAjustadoEm).not.toBeNull();
  });

  it("ajustar custo só vale para item falhou/cancelada — nunca para o que foi medido", () => {
    resetarFilaFixtureStore();
    const concluida = listarFilaFixture(200).find((i) => i.estado === "concluida") as { id: string };
    expect(ajustarCustoFixture(concluida.id, 1, AGORA)).toEqual({
      erro: "Só dá para ajustar o custo de item que falhou ou foi cancelado.",
    });
  });
});

describe("D15 — paginação keyset chega ao fim da fila", () => {
  it("205 itens saem em 5 páginas de 50, e a 5ª traz o 205º", () => {
    resetarFilaFixtureStore();
    const inicial = listarFilaFixture(200).length; // a semente
    for (let i = 1; i <= 205 - inicial; i += 1) {
      enfileirarFixture({
        prompt: `keyset ${i}`,
        complexidade: "baixa",
        conta: LUCAS,
        agora: AGORA - i * 1000,
      });
    }
    let antesDe: string | null = null;
    let antesId: string | null = null;
    let total = 0;
    const vistos = new Set<string>();
    for (let pagina = 1; pagina <= 5; pagina += 1) {
      const itensDaPagina = listarFilaFixture(50, antesDe, antesId);
      total += itensDaPagina.length;
      for (const i of itensDaPagina) vistos.add(i.id);
      const cursor = cursorDaPaginaFixture(50, antesDe, antesId);
      antesDe = cursor?.antesDe ?? null;
      antesId = cursor?.antesId ?? null;
    }
    expect(total).toBe(205);
    expect(vistos.size).toBe(205);
    expect(filaTemMaisFixture(50, antesDe, antesId)).toBe(false);
  });
});
