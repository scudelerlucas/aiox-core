/**
 * OS-LIFEBOARD — Gerador de id determinístico para normalização.
 *
 * Por que determinístico: a normalização é PURA e a idempotência do sync é
 * `(sourceId, externalRef)` (architecture.md §5.1). Rodar `normalize` 2× sobre a
 * mesma entrada precisa gerar EXATAMENTE os mesmos ids — assim o teste de
 * idempotência prova a chave lógica sem tocar o banco. Em produção, o repositório
 * faz upsert por `(source_id, external_ref)`; o uuid real vem do Postgres. Aqui
 * derivamos um uuid estável a partir de (namespace, chave) para a camada pura.
 */

import { createHash } from "node:crypto";

/** UUID v5-like determinístico (estável, não RFC-estrito) de (namespace, key). */
export function deterministicId(namespace: string, key: string): string {
  const hex = createHash("sha1").update(`${namespace}::${key}`).digest("hex");
  const variant = ((parseInt(hex[16] ?? "8", 16) & 0x3) | 0x8).toString(16);
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-5" +
    hex.slice(13, 16) +
    "-" +
    variant +
    hex.slice(17, 20) +
    "-" +
    hex.slice(20, 32)
  );
}
