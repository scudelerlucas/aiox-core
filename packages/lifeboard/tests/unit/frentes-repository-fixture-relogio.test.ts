/**
 * A fixture das frentes não pode "andar" entre duas leituras vizinhas — nem
 * envelhecer num processo que fica vivo por dias.
 *
 * Achado da CI em 26/09/2026 (run 36278921070): a guarda no navegador da P6
 * (medida R) reprovava porque `sources/<frentes>/lastSyncAt` mudava entre as duas
 * fotos da loja tiradas em volta de um pedido que falhou. O `lastSyncAt` da fonte
 * virtual vem do `executado_em` do sync da fixture, e a fixture era montada com
 * `Date.now()` a cada `carregar()`. Os dois primeiros testes ficam VERMELHOS sem
 * a âncora. O terceiro cobre o achado da revisão do #53: âncora fixa para sempre
 * envelheceria a demonstração.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fontesDasFrentes } from "@/lib/frentes/materializar";
import { agoraDaFixture, getFrentesRepository } from "@/lib/frentes/repository";

const SEGUNDO = 1_000;
const HORA = 60 * 60 * SEGUNDO;

describe("fixture das frentes — o relógio não anda entre leituras vizinhas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("duas leituras com 2 s de parede entre elas devolvem o mesmo sync e o mesmo lastSyncAt", async () => {
    const repo = getFrentesRepository(); // sem LIFEBOARD_DATA_MODE=live → fixture
    const primeira = await repo.carregar();
    vi.setSystemTime(Date.now() + 2 * SEGUNDO); // o intervalo real medido na CI foi ~1,8 s
    const segunda = await repo.carregar();

    expect(segunda.sync.map((s) => s.executado_em)).toEqual(
      primeira.sync.map((s) => s.executado_em),
    );
    expect(fontesDasFrentes(segunda.sync).map((f) => f.lastSyncAt)).toEqual(
      fontesDasFrentes(primeira.sync).map((f) => f.lastSyncAt),
    );
  });

  it("o histórico lê o mesmo instante que o quadro", async () => {
    const repo = getFrentesRepository();
    const quadro = await repo.carregar();
    vi.setSystemTime(Date.now() + 2 * SEGUNDO);
    const historico = await repo.carregarHistorico();
    expect(historico.sync.map((s) => s.executado_em)).toEqual(
      quadro.sync.map((s) => s.executado_em),
    );
  });

  it("a âncora só se move depois de ociosidade E idade: uma sequência viva nunca a vê mudar, um processo parado por horas não envelhece", () => {
    const inicio = agoraDaFixture(Date.now());
    // sequência viva: leituras a cada 30 s por 2 h — nunca ociosa, âncora parada
    let t = Date.now();
    for (let i = 0; i < 240; i += 1) {
      t += 30 * SEGUNDO;
      expect(agoraDaFixture(t)).toBe(inicio);
    }
    // parada de 5 min sem idade suficiente ainda? já tem 2 h → move
    t += 5 * 60 * SEGUNDO;
    const depoisDaParada = agoraDaFixture(t);
    expect(depoisDaParada).toBe(t);
    expect(depoisDaParada - inicio).toBeGreaterThan(ANCORA_LIMITE_DE_TESTE);
    // ociosa mas nova (< 1 h): não move
    t += 5 * 60 * SEGUNDO;
    expect(agoraDaFixture(t)).toBe(depoisDaParada);
  });
});

/** 1 h — o mesmo `ANCORA_MAX_MS` do repositório, repetido aqui para o teste não importar detalhe interno. */
const ANCORA_LIMITE_DE_TESTE = HORA;
