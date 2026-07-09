/**
 * OS-LIFEBOARD · E3 — Parser ESTRUTURAL da entrada semi-manual.
 *
 * Reconhece padrões comuns de texto colado do app Notas do iPhone e de export
 * de chat Claude. É 100% determinístico e **ZERO LLM / zero token** (PRD §10:
 * "parsing … é estrutural, zero token"). Extrai o MÁXIMO de tarefas possível
 * sem recorrer a nenhum modelo.
 *
 * O que NÃO conseguir classificar como tarefa/cabeçalho sai como `residualLines`
 * (texto livre) — é sobre esse resíduo que `normalize.ts` decide se aplica a
 * heurística/LLM, sempre sob a GUARDA INVIOLÁVEL do PRD §10.
 *
 * Camada R do CHC (architecture.md §6): roda server-side, puro/testável.
 */

import type { TaskStatus } from "@/types/canonical";

/** Uma tarefa reconhecida estruturalmente (por marcador de linha). */
export interface ParsedTask {
  /** Título limpo (sem o marcador nem a data extraída). */
  title: string;
  /** due_date ISO (yyyy-mm-dd) extraída de dd/mm ou dd/mm/aaaa, ou null. */
  dueDate: string | null;
  /** Status derivado de checkbox: `[x]` → done; caso contrário → open. */
  status: TaskStatus;
  /** Linha original (auditoria / fallback bruto). */
  raw: string;
  /** Índice do bloco (projeto lógico) a que pertence. */
  blockIndex: number;
  /** Índice global da linha no texto colado. */
  lineIndex: number;
}

/** Uma linha de texto livre que o parser NÃO classificou como tarefa. */
export interface ResidualLine {
  text: string;
  blockIndex: number;
  lineIndex: number;
}

/** Um bloco = um projeto lógico inferido do cabeçalho/1ª linha. */
export interface ParsedBlock {
  index: number;
  /** Título do projeto/bloco (cabeçalho, 1ª linha, ou default). */
  title: string;
  tasks: ParsedTask[];
  residual: ResidualLine[];
}

export interface StructuralParseResult {
  blocks: ParsedBlock[];
  /** Tarefas estruturais achatadas (todos os blocos). */
  tasks: ParsedTask[];
  /** Linhas de texto livre não classificadas (todos os blocos). */
  residualLines: ResidualLine[];
}

export interface ParseOptions {
  /** Data de referência para datas dd/mm sem ano. Default: agora. */
  referenceDate?: Date;
  /** Título default quando o texto começa sem cabeçalho. */
  defaultBlockTitle?: string;
}

// ---------------------------------------------------------------------------
// Reconhecedores de marcador de tarefa (ordem importa: mais específico antes)
// ---------------------------------------------------------------------------

interface MarkerMatch {
  title: string;
  status: TaskStatus;
}

/**
 * Tenta reconhecer uma linha como tarefa por marcador. Retorna null se a linha
 * não começa com nenhum marcador estrutural conhecido.
 *
 * Marcadores suportados (Notas iPhone + export Claude + markdown comum):
 *   "- item"  "* item"  "• item"  |  "1. item"  "2) item"
 *   "- [ ] item"  "* [x] item"  "[ ] item"  "[x] item"  |  "TODO: item"
 */
function matchTaskMarker(line: string): MarkerMatch | null {
  // 1) bullet + checkbox: "- [ ] x" / "* [x] x" / "• [X] x"
  let m = /^\s*[-*•]\s*\[([ xX])\]\s+(.+)$/.exec(line);
  if (m) {
    return { title: m[2]!.trim(), status: m[1]!.toLowerCase() === "x" ? "done" : "open" };
  }
  // 2) checkbox nu: "[ ] x" / "[x] x"
  m = /^\s*\[([ xX])\]\s+(.+)$/.exec(line);
  if (m) {
    return { title: m[2]!.trim(), status: m[1]!.toLowerCase() === "x" ? "done" : "open" };
  }
  // 3) "TODO: x" (mas não "TODO:" sozinho, que é cabeçalho de seção)
  m = /^\s*(?:TODO|Todo|todo|AFAZER|A FAZER)\s*:\s*(.+)$/.exec(line);
  if (m) {
    return { title: m[1]!.trim(), status: "open" };
  }
  // 4) bullet simples: "- x" / "* x" / "• x"
  m = /^\s*[-*•]\s+(.+)$/.exec(line);
  if (m) {
    return { title: m[1]!.trim(), status: "open" };
  }
  // 5) lista numerada: "1. x" / "2) x"
  m = /^\s*\d+[.)]\s+(.+)$/.exec(line);
  if (m) {
    return { title: m[1]!.trim(), status: "open" };
  }
  return null;
}

/** Uma linha é cabeçalho de seção se termina em ":" e não é marcador de tarefa. */
function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return false;
  // termina com ":" e não é um "TODO:" (esse já foi tratado como tarefa se tiver texto)
  return /:$/.test(t) && !matchTaskMarker(line);
}

// ---------------------------------------------------------------------------
// Extração de data dd/mm ou dd/mm/aaaa → ISO yyyy-mm-dd
// ---------------------------------------------------------------------------

/**
 * Extrai a PRIMEIRA data no formato dd/mm ou dd/mm/aaaa de um título e devolve
 * `{ title, dueDate }` com o título limpo (data e rótulos "até/vence" removidos).
 * Sem data → dueDate null e título inalterado.
 */
export function extractDueDate(
  title: string,
  referenceDate: Date,
): { title: string; dueDate: string | null } {
  const re = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
  const m = re.exec(title);
  if (!m) return { title, dueDate: null };

  const day = Number(m[1]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return { title, dueDate: null };
  }

  let year: number;
  if (m[3]) {
    year = Number(m[3]);
    if (year < 100) year += 2000; // "26" → 2026
  } else {
    year = referenceDate.getFullYear();
  }

  const iso = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

  // Remove a data e rótulos de prazo comuns, sem alterar o resto do título.
  const cleaned = title
    .replace(re, "")
    .replace(/\b(at[ée]|vence(?:\s+em)?|due|prazo|entrega)\b\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s\-–—:]+$/g, "")
    .trim();

  return { title: cleaned.length > 0 ? cleaned : title.trim(), dueDate: iso };
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

/**
 * Faz o parse estrutural do texto colado. Determinístico, sem I/O, sem LLM.
 */
export function parseStructural(
  text: string,
  options: ParseOptions = {},
): StructuralParseResult {
  const referenceDate = options.referenceDate ?? new Date();
  const defaultBlockTitle = options.defaultBlockTitle ?? "Notas (sem título)";

  const rawLines = text.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  let current: ParsedBlock | null = null;

  const ensureBlock = (title: string): ParsedBlock => {
    const block: ParsedBlock = {
      index: blocks.length,
      title: title.trim(),
      tasks: [],
      residual: [],
    };
    blocks.push(block);
    return block;
  };

  rawLines.forEach((rawLine, lineIndex) => {
    const line = rawLine.replace(/\s+$/g, "");
    if (line.trim().length === 0) return; // linha em branco: ignorada

    // 1) Marcador de tarefa?
    const marker = matchTaskMarker(line);
    if (marker) {
      if (!current) current = ensureBlock(defaultBlockTitle);
      const { title, dueDate } = extractDueDate(marker.title, referenceDate);
      current.tasks.push({
        title,
        dueDate,
        status: marker.status,
        raw: rawLine,
        blockIndex: current.index,
        lineIndex,
      });
      return;
    }

    // 2) Cabeçalho de seção (termina em ":") OU 1ª linha de conteúdo → novo bloco.
    if (isSectionHeader(line) || !current) {
      const headerTitle = line.trim().replace(/:$/, "").trim();
      current = ensureBlock(headerTitle.length > 0 ? headerTitle : defaultBlockTitle);
      return;
    }

    // 3) Texto livre não classificado → resíduo do bloco atual.
    current.residual.push({
      text: line.trim(),
      blockIndex: current.index,
      lineIndex,
    });
  });

  const tasks = blocks.flatMap((b) => b.tasks);
  const residualLines = blocks.flatMap((b) => b.residual);
  return { blocks, tasks, residualLines };
}
