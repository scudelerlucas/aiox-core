/**
 * A fixture das frentes não pode "andar" entre duas leituras do mesmo processo.
 *
 * Achado da CI em 26/09/2026 (run 36278921070): a guarda no navegador da P6
 * (medida R) reprovava porque `sources/<frentes>/lastSyncAt` mudava entre as duas
 * fotos da loja tiradas em volta de um pedido que falhou. O `lastSyncAt` da fonte
 * virtual vem do `executado_em` do sync da fixture, e a fixture era montada com
 * `Date.now()` a cada `carregar()`. Este teste fica VERMELHO sem `RELOGIO_DA_FIXTURE`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fontesDasFrentes } from "@/lib/frentes/materializar";
import { getFrentesRepository } from "@/lib/frentes/repository";

describe("fixture das frentes — o relógio não anda entre duas leituras", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("duas leituras com 2 s de parede entre elas devolvem o mesmo sync e o mesmo lastSyncAt", async () => {
    const repo = getFrentesRepository(); // sem LIFEBOARD_DATA_MODE=live → fixture
    const primeira = await repo.carregar();
    vi.setSystemTime(Date.now() + 2_000); // o intervalo real medido na CI foi ~1,8 s
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
    vi.setSystemTime(Date.now() + 2_000);
    const historico = await repo.carregarHistorico();
    expect(historico.sync.map((s) => s.executado_em)).toEqual(
      quadro.sync.map((s) => s.executado_em),
    );
  });
});
