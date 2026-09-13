import {
  DEFAULT_HIERARQ,
  type AssimetriaDeclarada,
  type EdgeTipo,
  type HierarqScore,
  type TaskEdge,
} from "@/types/canonical";

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

const TIPOS_DE_ARESTA: ReadonlySet<string> = new Set<EdgeTipo>([
  "predecessor",
  "correlacao",
  "sinergia",
  "obsolescencia",
]);

/** `true` só para um tipo que o app conhece — tipo novo no banco cai fora, com aviso. */
export function tipoDeArestaValido(tipo: unknown): tipo is EdgeTipo {
  return typeof tipo === "string" && TIPOS_DE_ARESTA.has(tipo);
}

function numeroOuNulo(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

/** Átomos declarados: cada um inteiro positivo, senão o objeto inteiro é nulo. */
export function normalizeAssimetria(raw: unknown): AssimetriaDeclarada | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { opcionalidade, esforco, custo } = raw as Partial<AssimetriaDeclarada>;
  const ok = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n) && n > 0;
  if (!ok(opcionalidade) || !ok(esforco) || !ok(custo)) return null;
  return { opcionalidade, esforco, custo };
}

/**
 * Uma aresta crua da RPC. Devolve `null` (para o chamador descartar) quando o
 * tipo não é conhecido ou quando origem/destino faltam — nunca lança.
 */
export function normalizeEdge(raw: unknown): TaskEdge | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Partial<TaskEdge>;
  if (!tipoDeArestaValido(e.tipo)) return null;
  if (typeof e.id !== "string" || typeof e.origem !== "string" || typeof e.destino !== "string")
    return null;
  if (e.origem === e.destino) return null;
  const peso = numeroOuNulo(e.peso);
  return {
    id: e.id,
    origem: e.origem,
    destino: e.destino,
    tipo: e.tipo,
    peso: peso === null ? 1 : Math.min(1, Math.max(0, peso)),
    nota: typeof e.nota === "string" ? e.nota : null,
    createdAt: typeof e.createdAt === "string" ? e.createdAt : "",
  };
}

export { numeroOuNulo };
