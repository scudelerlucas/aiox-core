/**
 * OS-LIFEBOARD — Cliente FIXTURE de Gmail (ATIVO nesta rodada).
 * Lê `tests/fixtures/gmail/*.json`. Mesma classe em dev-fixture e Vitest.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { GmailClient } from "@/adapters/gmail/client";
import type { RawGmailThread } from "@/types/raw";

const FIXTURE_DIR = path.resolve(process.cwd(), "tests/fixtures/gmail");

export class FixtureGmailClient implements GmailClient {
  readonly kind = "gmail" as const;
  readonly mode = "fixture" as const;

  async fetchRaw(): Promise<RawGmailThread[]> {
    const files = (await readdir(FIXTURE_DIR))
      .filter((f) => f.endsWith(".json"))
      .sort();
    const all: RawGmailThread[] = [];
    for (const file of files) {
      const content = await readFile(path.join(FIXTURE_DIR, file), "utf8");
      const parsed = JSON.parse(content) as RawGmailThread[] | RawGmailThread;
      if (Array.isArray(parsed)) all.push(...parsed);
      else all.push(parsed);
    }
    return all;
  }
}
