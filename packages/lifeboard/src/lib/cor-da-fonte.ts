import type { SourceKind } from "@/types/canonical";

/**
 * OS-LIFEBOARD — cor por FONTE (paleta v2, 13/09/2026).
 *
 * Cada fonte tem um matiz próprio para que a pessoa reconheça a origem da
 * tarefa **antes de ler o rótulo**. A cor nunca é o único sinal: o ícone e o
 * nome da fonte continuam ali (régua de UI/UX — daltônico-safe).
 *
 * As classes são **literais** de propósito: o Tailwind varre o código-fonte e
 * só gera a classe que encontra escrita por extenso. Montar `text-fonte-${kind}`
 * geraria CSS vazio em produção — erro clássico e silencioso.
 *
 * `NEUTRA` cobre qualquer `kind` novo no banco. Mesma disciplina de
 * `iconeDaFonte` e `configDoEstado`: o tipo não protege, porque o valor chega
 * do Postgres como texto.
 */
export interface CorDaFonte {
  /** Cor do texto e do ícone. */
  texto: string;
  /** Faixa lateral do cartão — é o que dá o "colorido" da lista. */
  faixa: string;
  /** Borda do chip/caixa. */
  borda: string;
  /** Fundo tênue do chip. */
  fundo: string;
  /** Ponto sólido (indicador pequeno). */
  ponto: string;
}

const NEUTRA: CorDaFonte = {
  texto: "text-fonte-neutra",
  faixa: "bg-fonte-neutra",
  borda: "border-fonte-neutra/45",
  fundo: "bg-fonte-neutra/10",
  ponto: "bg-fonte-neutra",
};

const POR_KIND: Record<string, CorDaFonte> = {
  calendar: {
    texto: "text-fonte-calendar",
    faixa: "bg-fonte-calendar",
    borda: "border-fonte-calendar/45",
    fundo: "bg-fonte-calendar/10",
    ponto: "bg-fonte-calendar",
  },
  gmail: {
    texto: "text-fonte-gmail",
    faixa: "bg-fonte-gmail",
    borda: "border-fonte-gmail/45",
    fundo: "bg-fonte-gmail/10",
    ponto: "bg-fonte-gmail",
  },
  drive: {
    texto: "text-fonte-drive",
    faixa: "bg-fonte-drive",
    borda: "border-fonte-drive/45",
    fundo: "bg-fonte-drive/10",
    ponto: "bg-fonte-drive",
  },
  notes: {
    texto: "text-fonte-notes",
    faixa: "bg-fonte-notes",
    borda: "border-fonte-notes/45",
    fundo: "bg-fonte-notes/10",
    ponto: "bg-fonte-notes",
  },
  claude_chat: {
    texto: "text-fonte-chat",
    faixa: "bg-fonte-chat",
    borda: "border-fonte-chat/45",
    fundo: "bg-fonte-chat/10",
    ponto: "bg-fonte-chat",
  },
  lms: {
    texto: "text-fonte-lms",
    faixa: "bg-fonte-lms",
    borda: "border-fonte-lms/45",
    fundo: "bg-fonte-lms/10",
    ponto: "bg-fonte-lms",
  },
  github: {
    texto: "text-fonte-github",
    faixa: "bg-fonte-github",
    borda: "border-fonte-github/45",
    fundo: "bg-fonte-github/10",
    ponto: "bg-fonte-github",
  },
};

/** Cor de uma fonte; nunca devolve `undefined`, mesmo com kind novo no banco. */
export function corDaFonte(kind: SourceKind | string | undefined): CorDaFonte {
  if (kind === undefined) return NEUTRA;
  return POR_KIND[kind] ?? NEUTRA;
}
