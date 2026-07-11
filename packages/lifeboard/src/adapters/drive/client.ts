/**
 * OS-LIFEBOARD — Port do adapter de Drive (architecture.md §5.2).
 * Busca `RawDriveFile[]` (read-only). Impl fixture (ativa) + mcp (PROD, PAUSADA).
 */

import type { SourceClient } from "@/adapters/types";
import type { RawDriveFile } from "@/types/raw";

export type DriveClient = SourceClient<RawDriveFile>;
