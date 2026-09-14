"use client";

/**
 * OS-LIFEBOARD · P6 — erro de formulário em português, ao lado do campo.
 * Nunca JSON, nunca stack trace (régua de UI/UX §B: "erro em português no
 * campo, nunca JSON"). `role="alert"` para leitor de tela sem precisar de
 * `aria-live` extra (o elemento nasce no DOM já com o texto).
 */
export function CampoErro({ mensagem }: { mensagem?: string }): JSX.Element | null {
  if (!mensagem) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-state-blocked">
      {mensagem}
    </p>
  );
}
