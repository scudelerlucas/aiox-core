import "server-only";
/**
 * OS-LIFEBOARD — Cliente REAL (MCP) de Drive — ⚠️ PAUSADO NESTA RODADA.
 *
 * Não exercido por nenhum teste (fixture-only). Em `LIFEBOARD_DATA_MODE=live`,
 * consome `mcp__Google_Drive__*` (via `lib/mcp/google.ts`, camada G) e mapeia cada
 * arquivo das pastas de projeto para `RawDriveFile`. Read-only.
 *
 * `import 'server-only'` no topo (kill-switch nº 3). Troca fixture→live mecânica.
 */

import type { DriveClient } from "@/adapters/drive/client";
import type { RawDriveFile } from "@/types/raw";

export class McpDriveClient implements DriveClient {
  readonly kind = "drive" as const;
  readonly mode = "live" as const;

  async fetchRaw(): Promise<RawDriveFile[]> {
    // PAUSADO: fluxo real (revisão manual):
    //   1. listar pastas de projeto → mcp__Google_Drive__list_folders
    //   2. listar arquivos por pasta → mcp__Google_Drive__list_files (folderId)
    //   3. mapear cada arquivo → RawDriveFile { fileId, name, folder, modifiedTime }
    throw new Error(
      "McpDriveClient PAUSADO nesta rodada (E2 fixture-only). " +
        "Ative com LIFEBOARD_DATA_MODE=live após conectar credenciais Google reais.",
    );
  }
}
