/**
 * OS-LIFEBOARD — Cliente FIXTURE de Drive (ATIVO nesta rodada).
 * Lê `tests/fixtures/drive/*.json`. Mesma classe em dev-fixture e Vitest.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { DriveClient } from "@/adapters/drive/client";
import type { RawDriveFile } from "@/types/raw";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests/fixtures/drive");

export class FixtureDriveClient implements DriveClient {
  readonly kind = "drive" as const;
  readonly mode = "fixture" as const;

  async fetchRaw(): Promise<RawDriveFile[]> {
    const files = (await readdir(FIXTURE_DIR))
      .filter((f) => f.endsWith(".json"))
      .sort();
    const all: RawDriveFile[] = [];
    for (const file of files) {
      const content = await readFile(path.join(FIXTURE_DIR, file), "utf8");
      const parsed = JSON.parse(content) as RawDriveFile[] | RawDriveFile;
      if (Array.isArray(parsed)) all.push(...parsed);
      else all.push(parsed);
    }
    return all;
  }
}
