import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const AQUI = fileURLToPath(new URL(".", import.meta.url));
const RAIZ = join(AQUI, "..", "..");

function aplicar(nome: string): string {
  return readFileSync(join(RAIZ, "supabase", "aplicar", nome), "utf8");
}

describe("deploy das migrations 0027–0030 em produção", () => {
  it("confere as pré-condições antes de qualquer escrita", () => {
    const sql = aplicar("PASSO-1b-pre-condicoes-producao.sql");

    expect(sql).toContain("teto_usd < 20");
    expect(sql).toContain("teto_usd > 500");
    expect(sql).toContain("usd < 5");
    expect(sql).toContain("painel_fila_prompts");
    expect(sql).toContain("FALHA — NÃO APLIQUE");
  });

  it("o detector final reprova o estado parcial sem o limite de quatro no pull", () => {
    const sql = aplicar("PASSO-1c-conferencia-final-producao.sql");

    expect(sql).toContain("pull_com_limite");
    expect(sql).toMatch(/prosrc[\s\S]*painel_fila_em_voo/);
    expect(sql).toMatch(/prosrc[\s\S]*v_no_limite/);
    expect(sql).toContain("FALHA — ESTADO PARCIAL");
  });

  it("o detector final prova piso, quarta conta, trava da sessão e postos", () => {
    const sql = aplicar("PASSO-1c-conferencia-final-producao.sql");

    for (const prova of [
      "piso_funcao",
      "piso_estimativas",
      "piso_itens",
      "quarta_conta_travada",
      "sessao_dona_com_trava",
      "postos_preenchidos",
    ]) {
      expect(sql).toContain(prova);
    }
    expect(sql).toContain("PRONTO — 0027–0030 CONFERIDAS");
  });
});
