/**
 * OS-LIFEBOARD — Acesso validado a variáveis de ambiente.
 *
 * Coding standard (architecture.md §11): segredo/config só via `@/config/env`,
 * NUNCA `process.env` cru espalhado pelo código. `.env.example` sem valores reais
 * (camada G do CHC).
 *
 * `LIFEBOARD_DATA_MODE` é o único flip que troca fixture (rodada atual, default)
 * por live (produção, após conectar credenciais Google reais). Ver `factory.ts`.
 *
 * Pré-requisito compartilhado entre E2 e E3 — extensão ADITIVA: novos campos são
 * adicionados aqui sem remover os existentes.
 */

import type { DataMode } from "@/adapters/types";

function readDataMode(): DataMode {
  return process.env.LIFEBOARD_DATA_MODE === "live" ? "live" : "fixture";
}

export interface LifeboardEnv {
  /** 'fixture' (default, rodada atual) | 'live' (produção). */
  readonly LIFEBOARD_DATA_MODE: DataMode;
}

/** Config validada. Reavaliado por getter para respeitar overrides em teste. */
export const env: LifeboardEnv = {
  get LIFEBOARD_DATA_MODE(): DataMode {
    return readDataMode();
  },
};
