import "server-only";
/**
 * OS-LIFEBOARD — Cliente REAL (MCP) de Gmail — ⚠️ PAUSADO NESTA RODADA.
 *
 * Não exercido por nenhum teste (fixture-only). Em `LIFEBOARD_DATA_MODE=live`,
 * consome `mcp__Gmail__*` (via `lib/mcp/google.ts`, camada G) e mapeia cada thread
 * marcada com label de projeto para `RawGmailThread`. Read-only.
 *
 * `import 'server-only'` no topo (kill-switch nº 3). Troca fixture→live mecânica.
 */

import type { GmailClient } from "@/adapters/gmail/client";
import type { RawGmailThread } from "@/types/raw";

export class McpGmailClient implements GmailClient {
  readonly kind = "gmail" as const;
  readonly mode = "live" as const;

  async fetchRaw(): Promise<RawGmailThread[]> {
    // PAUSADO: fluxo real (revisão manual):
    //   1. listar threads por query de label → mcp__Gmail__list_threads (q: label:Projeto/*)
    //   2. mapear cada thread → RawGmailThread { threadId, subject, labels, snippet }
    throw new Error(
      "McpGmailClient PAUSADO nesta rodada (E2 fixture-only). " +
        "Ative com LIFEBOARD_DATA_MODE=live após conectar credenciais Google reais.",
    );
  }
}
