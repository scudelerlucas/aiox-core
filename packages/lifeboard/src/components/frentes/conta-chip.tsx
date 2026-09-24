import type { CorConta } from "@/lib/frentes/types";

/**
 * PAINEL DE ASSUNTOS — etiqueta do cartão.
 *
 * Com conversa, mostra a conta (Lucas · Pandora · Alma Petra). Sem conversa,
 * mostra o repositório em cinza — dizer "conta não identificada" não informava
 * nada e aparecia em 295 dos cartões reais.
 *
 * Cor NUNCA é o único sinal: a etiqueta sempre traz o nome escrito. Fundo fixo
 * `navy-800` em todas as variantes para o contraste do texto ser previsível
 * (medido entre 6,3:1 e 9,4:1).
 */
const CORES: Record<CorConta, string> = {
  lucas: "border-gold-500/70 text-gold-300",
  pandora: "border-state-success/70 text-state-success-fg",
  almapetra: "border-state-warning/70 text-state-warning",
  neutra: "border-state-neutral/60 text-bone-300",
};

export function ContaChip({
  texto,
  cor,
}: {
  texto: string;
  cor: CorConta;
}): JSX.Element {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border bg-navy-800 px-2 py-0.5 text-[11px] font-medium ${CORES[cor]}`}
    >
      {texto}
    </span>
  );
}
