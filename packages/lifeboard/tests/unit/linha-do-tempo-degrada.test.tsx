import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * OS-LIFEBOARD · P5b (achado ALTO #12 do crítico hostil): nenhum teste provava
 * que a ROTA `/linha-do-tempo` degrada para `NaoConsegui` quando a leitura
 * falha — só a montagem PURA (`linha-do-tempo.test.ts`) e o RENDER isolado da
 * view (`linha-do-tempo-render.test.tsx`) eram cobertos. Mesmo espírito de
 * `home-degrada-sem-cair.test.ts` / `render-home-live-shape.test.tsx`: mocka o
 * ponto de falha real, chama a Server Component (é só uma função async) e
 * confere que ela resolve para o aviso — nunca rejeita, nunca 500.
 */

vi.mock("@/lib/repositories/factory", () => ({
  getTasksRepository: vi.fn(),
  getSourcesRepository: vi.fn(),
}));
vi.mock("@/lib/frentes/repository", () => ({
  getFrentesRepository: vi.fn(),
}));
vi.mock("@/core/timeline/linha-do-tempo", () => ({
  montarLinhaDoTempo: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe("/linha-do-tempo — degrada sem cair (achado ALTO #12)", () => {
  it("repositório de tarefas lançando → resolve para NaoConsegui, nunca rejeita", async () => {
    const { getTasksRepository, getSourcesRepository } = await import(
      "@/lib/repositories/factory"
    );
    const { getFrentesRepository } = await import("@/lib/frentes/repository");
    vi.mocked(getTasksRepository).mockReturnValue({
      listAll: vi.fn().mockRejectedValue(new Error("timeout no Postgres")),
      listEdges: vi.fn().mockResolvedValue([]),
    } as never);
    vi.mocked(getSourcesRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
    } as never);
    vi.mocked(getFrentesRepository).mockReturnValue({
      carregar: vi.fn().mockResolvedValue({ prs: [], branches: [], sessoes: [], sync: [] }),
      carregarHistorico: vi.fn(),
    } as never);

    const { default: PaginaLinhaDoTempo } = await import("@/app/linha-do-tempo/page");
    const elemento = await PaginaLinhaDoTempo();
    const html = renderToStaticMarkup(elemento);

    expect(html).toContain("Não consegui montar a linha do tempo agora");
    expect(html).not.toContain("undefined");
  });

  it("montarLinhaDoTempo lançando (bug de montagem, não de rede) → também resolve para NaoConsegui", async () => {
    const { getTasksRepository, getSourcesRepository } = await import(
      "@/lib/repositories/factory"
    );
    const { getFrentesRepository } = await import("@/lib/frentes/repository");
    const { montarLinhaDoTempo } = await import("@/core/timeline/linha-do-tempo");
    vi.mocked(getTasksRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
      listEdges: vi.fn().mockResolvedValue([]),
    } as never);
    vi.mocked(getSourcesRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
    } as never);
    vi.mocked(getFrentesRepository).mockReturnValue({
      carregar: vi.fn().mockResolvedValue({ prs: [], branches: [], sessoes: [], sync: [] }),
      carregarHistorico: vi.fn(),
    } as never);
    vi.mocked(montarLinhaDoTempo).mockImplementation(() => {
      throw new Error("score torto");
    });

    const { default: PaginaLinhaDoTempo } = await import("@/app/linha-do-tempo/page");
    const elemento = await PaginaLinhaDoTempo();
    const html = renderToStaticMarkup(elemento);

    expect(html).toContain("Não consegui montar a linha do tempo agora");
    expect(html).toContain("tentar de novo");
    expect(html).toContain("ir para o painel");
  });
});
