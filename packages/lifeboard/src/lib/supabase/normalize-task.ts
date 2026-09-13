import { DEFAULT_HIERARQ, type HierarqScore } from "@/types/canonical";

/**
 * OS-LIFEBOARD — saneamento da fronteira crua com o Postgres.
 *
 * Módulo próprio, sem `server-only` e sem `cache()` do React, para que a regra
 * possa ser testada sozinha: o `live-client` que o consome só roda sob a
 * condição `react-server`.
 */

/**
 * Garante um score HIERARQ bem formado. `public.tasks.priority_hierarq` é
 * `jsonb NOT NULL`, mas `NOT NULL` em jsonb **não** barra o valor JSON `null`
 * (`'null'::jsonb` passa pela constraint), e não há CHECK de forma na coluna.
 * A RPC devolve o jsonb cru. Sem isto, `const { s1, s2, s3 } = ...` lança
 * ("Cannot destructure property 's1' … as it is null") dentro de
 * `buildTodayList`, que roda no Server Component da home: HTTP 500 na `/`
 * inteira — a mesma tela do incidente de 13/09, por outra porta. `{}` ou
 * `{"s1":"3"}` não derrubam, mas produzem `NaN` na tela e ordem arbitrária.
 */
export function normalizeHierarq(raw: unknown): HierarqScore {
  if (typeof raw !== "object" || raw === null) return DEFAULT_HIERARQ;
  const { s1, s2, s3 } = raw as Partial<HierarqScore>;
  const valido = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n);
  if (!valido(s1) || !valido(s2) || !valido(s3)) return DEFAULT_HIERARQ;
  return { s1, s2, s3 };
}
