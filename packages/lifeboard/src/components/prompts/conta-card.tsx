import type { ConsumoConta } from "@/core/prompts/tipos";
import {
  ROTULO_CONTA,
  faixaConsumo,
  formatarUsd,
  headroomUsd,
  tetoAtingido,
  textoEspacoLivre,
  textoEstimativa,
  textoPrevisaoComFila,
} from "@/core/prompts/tipos";
import { formatRelativeTime } from "@/lib/format-relative-time";

/**
 * OS-LIFEBOARD · P7 — cartão de conta: gasto do dia vs teto (barra) + o que
 * espera na fila + o que o roteador faria a seguir.
 *
 * Cor NUNCA é o único sinal: a faixa (ok/warn/crit) reusa os tokens de estado
 * já verificados a 4,5:1/3:1 (`scripts/checar-contraste.mjs`), e o texto ao
 * lado sempre diz o número e o rótulo por extenso. O TRILHO da barra é
 * `bg-navy-600` (4,01:1 sobre o cartão), já registrado no script.
 *
 * D9 (rodada 3): conta no teto NÃO sugere modelo. Sugerir "próximo modelo:
 * Fable" numa conta que não vai rodar nada hoje é convidar o operador a uma
 * ação que o banco recusa — o cartão diz o que é verdade: "teto atingido —
 * próximo espaço amanhã".
 *
 * D13/D20 (rodada 4): o cartão NUNCA mostra número negativo (o crítico mediu
 * "US$ -20,00 livres" nesta linha) — passou do teto vira "sem espaço livre
 * agora". E quando parte do consumo é ESTIMATIVA da casa (item que morreu sem
 * fechar), o cartão diz isso: um número inflado pode congelar a conta o dia
 * inteiro, e o operador precisa saber que dá para corrigir na linha da fila.
 */
const FAIXA_CLASSES: Record<"ok" | "warn" | "crit", { barra: string; texto: string }> = {
  ok: { barra: "bg-state-done", texto: "text-state-done" },
  warn: { barra: "bg-state-progress", texto: "text-state-progress" },
  crit: { barra: "bg-state-blocked", texto: "text-state-blocked" },
};

export interface ContaCardProps {
  consumo: ConsumoConta;
  /** Próximo modelo que o roteador sugeriria, na complexidade selecionada. Ignorado quando a conta está no teto. */
  proximoModelo?: string;
  /** Esta conta seria a escolhida pelo roteamento automático agora? */
  seriaEscolhida?: boolean;
  /**
   * D3: esta conta não tem espaço HOJE para a complexidade atual. NÃO é
   * recusa — o item entra na fila e roda quando houver espaço.
   */
  semEspacoHoje?: boolean;
  agora?: number;
}

export function ContaCard({
  consumo,
  proximoModelo,
  seriaEscolhida,
  semEspacoHoje,
  agora = Date.now(),
}: ContaCardProps): JSX.Element {
  const emUso = consumo.consumoHojeUsd + consumo.reservadoUsd;
  const razao = consumo.tetoUsd > 0 ? Math.min(1, emUso / consumo.tetoUsd) : 1;
  const faixa = faixaConsumo(consumo.consumoHojeUsd, consumo.reservadoUsd, consumo.tetoUsd);
  const atingiu = tetoAtingido(consumo.consumoHojeUsd, consumo.reservadoUsd, consumo.tetoUsd);
  const headroom = headroomUsd(consumo);
  const cores = FAIXA_CLASSES[faixa];
  const previsao = textoPrevisaoComFila(consumo);
  const estimativa = textoEstimativa(consumo);
  const esperaHoje = semEspacoHoje === true && !atingiu;

  return (
    <section
      className={`rounded-lg border bg-navy-850 p-4 ${
        atingiu || esperaHoje
          ? "border-state-blocked/70"
          : seriaEscolhida
            ? "border-gold-500 shadow-heroi"
            : "border-navy-700"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-bone-50">{ROTULO_CONTA[consumo.conta]}</h2>
        {atingiu ? (
          <span className="rounded-full border border-state-blocked/70 bg-navy-800 px-2 py-0.5 text-[11px] font-medium text-state-blocked">
            teto atingido
          </span>
        ) : esperaHoje ? (
          <span className="rounded-full border border-state-blocked/70 bg-navy-800 px-2 py-0.5 text-[11px] font-medium text-state-blocked">
            não cabe hoje
          </span>
        ) : seriaEscolhida ? (
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
          aria-label={`Gasto de hoje: ${formatarUsd(consumo.consumoHojeUsd)} medido mais ${formatarUsd(consumo.reservadoUsd)} em execução, de ${formatarUsd(consumo.tetoUsd)}`}
          className="h-2.5 w-full overflow-hidden rounded-full bg-navy-600"
        >
          <div
            className={`h-full rounded-full ${cores.barra}`}
            style={{ width: `${Math.round(razao * 100)}%` }}
          />
        </div>
        <p className={`mt-1.5 text-xs font-medium ${cores.texto}`}>
          {formatarUsd(consumo.consumoHojeUsd)}
          {consumo.reservadoUsd > 0 ? ` + ${formatarUsd(consumo.reservadoUsd)} em execução` : ""}
          {" de "}
          {formatarUsd(consumo.tetoUsd)}
        </p>
        <p className="mt-0.5 text-[11px] text-bone-400">
          {/* O proxy só atualiza na cadência da Routine diária de cada conta. */}
          {consumo.medidoAteEm
            ? `medido até ${formatRelativeTime(consumo.medidoAteEm, agora)}`
            : "sem sessão medida hoje ainda"}
          {" · "}
          {/* D13: clamp em 0 — "US$ -20,00 livres" não é informação, é erro. */}
          {textoEspacoLivre(consumo)}
          {headroom < 0 ? ` (${formatarUsd(Math.abs(headroom))} acima do teto)` : ""}
          {previsao ? ` · ${previsao}` : ""}
          {consumo.emEspera > 0
            ? ` · ${consumo.emEspera === 1 ? "1 item espera" : `${consumo.emEspera} itens esperam`} nova tentativa`
            : ""}
        </p>
        {estimativa ? (
          <p className="mt-0.5 text-[11px] text-state-progress">{estimativa} — dá para ajustar na linha da fila.</p>
        ) : null}
      </div>

      {atingiu ? (
        <p className="mt-3 text-xs text-state-blocked">teto atingido — próximo espaço amanhã</p>
      ) : proximoModelo ? (
        <p className="mt-3 text-xs text-bone-300">
          próximo modelo sugerido: <span className="font-semibold text-bone-100">{proximoModelo}</span>
        </p>
      ) : null}
    </section>
  );
}
