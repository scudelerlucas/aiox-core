import { describe, expect, it } from "vitest";

import { iconeDaFonte } from "@/components/ui/source-icon";

/**
 * Regressão de 13/09/2026: a home caía com HTTP 500 ("Element type is invalid…
 * got: undefined") porque `public.sources` tem uma fonte `kind = "lms"` (Cativa),
 * fora da união `SourceKind`, e o mapa de ícones devolvia `undefined`.
 * O tipo não protege: o kind chega do banco como string.
 */
describe("iconeDaFonte", () => {
  it("devolve um ícone para cada kind canônico", () => {
    for (const kind of ["calendar", "gmail", "drive", "notes", "claude_chat"]) {
      expect(typeof iconeDaFonte(kind)).not.toBe("undefined");
      expect(iconeDaFonte(kind)).toBeTruthy();
    }
  });

  it("devolve ícone para 'lms', que existe no banco e não está na união", () => {
    expect(iconeDaFonte("lms")).toBeTruthy();
  });

  it("nunca devolve undefined para kind desconhecido (o que derrubava a home)", () => {
    for (const kind of ["", "kind-que-ainda-nao-existe", "LMS", "hotmart"]) {
      expect(iconeDaFonte(kind)).toBeTruthy();
    }
  });

  it("usa o mesmo ícone neutro para quaisquer dois kinds desconhecidos", () => {
    expect(iconeDaFonte("zzz-1")).toBe(iconeDaFonte("zzz-2"));
  });
});
