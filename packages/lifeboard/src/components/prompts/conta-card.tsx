import type { ConsumoConta } from "@/core/prompts/tipos";
import { faixaConsumo, ROTULO_CONTA, tetoAtingido } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — cartão de conta: consumo do dia vs teto (barra de
 * progresso) + o modelo que o roteador escolheria a seguir para esta conta.
 *
 * Cor NUNCA é o único sinal (régua de UI/UX): a faixa (ok/warn/crit) reusa os
 * tokens de estado já verificados a 4,5:1/3:1 (`scripts/checar-contraste.mjs`
 * — nenhum par novo), e o texto ao lado sempre diz o número e o rótulo por
 * extenso ("teto atingido"), nunca só a cor da barra.
 */
const FAIXA_CLASSES: Record<"ok" | "warn" | "crit", { barra: string; texto: string }> = {
  ok: { barra: "bg-state-done", texto: "text-state-done" },
  warn: { barra: "bg-state-progress", texto: "text-state-progress" },
  crit: { barra: "bg-state-blocked", texto: "text-state-blocked" },
};

export interface ContaCardProps {
  consumo: ConsumoConta;
  /** Próximo modelo que o roteador sugeriria para esta conta, na complexidade selecionada no formulário. */
  proximoModelo?: string;
  /** Esta conta seria a escolhida pelo roteamento automático agora? */
  seriaEscolhida?: boolean;
}

export function ContaCard({ consumo, proximoModelo, seriaEscolhida }: ContaCardProps): JSX.Element {
  const razao = consumo.tetoUsd > 0 ? Math.min(1, consumo.consumoHojeUsd / consumo.tetoUsd) : 1;
  const faixa = faixaConsumo(consumo.consumoHojeUsd, consumo.tetoUsd);
  const atingiu = tetoAtingido(consumo.consumoHojeUsd, consumo.tetoUsd);
  const cores = FAIXA_CLASSES[faixa];

  return (
    <section
      className={`rounded-lg border bg-navy-850 p-4 ${
        seriaEscolhida ? "border-gold-500 shadow-heroi" : "border-navy-700"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-bone-50">{ROTULO_CONTA[consumo.conta]}</h2>
        {seriaEscolhida ? (
          <span className="rounded-full border border-gold-500/70 bg-navy-800 px-2 py-0.5 text-[11px] font-medium text-gold-300">
            escolhida agora
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[11px] text-bone-400">{consumo.conta}</p>

      <div className="mt-3">
        <div
          role="progressbar"
          aria-valuenow={Math.round(razao * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Consumo de hoje: US$ ${consumo.consumoHojeUsd.toFixed(2)} de US$ ${consumo.tetoUsd.toFixed(2)}`}
          className="h-2.5 w-full overflow-hidden rounded-full bg-navy-800"
        >
          <div
            className={`h-full rounded-full ${cores.barra}`}
            style={{ width: `${Math.round(razao * 100)}%` }}
          />
        </div>
        <p className={`mt-1.5 text-xs font-medium ${cores.texto}`}>
          US$ {consumo.consumoHojeUsd.toFixed(2)} de US$ {consumo.tetoUsd.toFixed(2)} hoje
          {atingiu ? " · teto atingido" : ""}
        </p>
      </div>

      {proximoModelo ? (
        <p className="mt-3 text-xs text-bone-300">
          próximo modelo sugerido: <span className="font-semibold text-bone-100">{proximoModelo}</span>
        </p>
      ) : null}
    </section>
  );
}
