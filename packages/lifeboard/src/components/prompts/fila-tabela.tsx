import { CancelarBotao } from "@/components/prompts/cancelar-botao";
import { EstadoFilaChip } from "@/components/prompts/estado-fila-chip";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { ItemFilaPrompt } from "@/core/prompts/tipos";
import { ROTULO_COMPLEXIDADE, ROTULO_CONTA } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — a tabela da fila: estado, conta, complexidade/modelo,
 * criado há, pego há, custo, link da sessão (quando existe) e o botão
 * cancelar (só em `na_fila`). Mobile: vira lista de cartões em vez de tabela
 * (tabela larga rolando de lado quebraria a régua de gutter ≥16px).
 */
export function FilaTabela({ itens, agora }: { itens: readonly ItemFilaPrompt[]; agora: number }): JSX.Element {
  if (itens.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-navy-700 bg-navy-850 px-4 py-6 text-center text-sm text-bone-400">
        Nenhum prompt na fila ainda.
      </p>
    );
  }

  return (
    <div className="mt-4">
      {/* Desktop/tablet: tabela de verdade. */}
      <div className="hidden overflow-x-auto rounded-lg border border-navy-700 sm:block">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-navy-700 bg-navy-900 text-xs uppercase tracking-wide text-bone-400">
              <th className="px-3 py-2">estado</th>
              <th className="px-3 py-2">conta</th>
              <th className="px-3 py-2">complexidade / modelo</th>
              <th className="px-3 py-2">criado</th>
              <th className="px-3 py-2">pego</th>
              <th className="px-3 py-2">custo</th>
              <th className="px-3 py-2">sessão</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id} className="border-b border-navy-800 last:border-0">
                <td className="px-3 py-2.5">
                  <EstadoFilaChip estado={item.estado} />
                </td>
                <td className="px-3 py-2.5 text-bone-100">{ROTULO_CONTA[item.conta]}</td>
                <td className="px-3 py-2.5 text-bone-300">
                  {ROTULO_COMPLEXIDADE[item.complexidade]} · {item.modeloSugerido}
                </td>
                <td className="px-3 py-2.5 text-bone-400">{formatRelativeTime(item.criadoEm, agora)}</td>
                <td className="px-3 py-2.5 text-bone-400">
                  {item.pegoEm ? formatRelativeTime(item.pegoEm, agora) : "—"}
                </td>
                <td className="px-3 py-2.5 text-bone-300">
                  {item.custoUsd !== null ? `US$ ${item.custoUsd.toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-2.5">
                  {item.sessaoUrl ? (
                    <a
                      href={item.sessaoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-gold-300 hover:underline"
                    >
                      abrir
                    </a>
                  ) : (
                    <span className="text-bone-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {item.estado === "na_fila" ? <CancelarBotao id={item.id} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cartões (nada de tabela rolando de lado). */}
      <div className="flex flex-col gap-3 sm:hidden">
        {itens.map((item) => (
          <div key={item.id} className="rounded-lg border border-navy-700 bg-navy-850 p-3">
            <div className="flex items-center justify-between gap-2">
              <EstadoFilaChip estado={item.estado} />
              <span className="text-xs text-bone-400">{formatRelativeTime(item.criadoEm, agora)}</span>
            </div>
            <p className="mt-2 text-sm text-bone-100">{ROTULO_CONTA[item.conta]}</p>
            <p className="mt-0.5 text-xs text-bone-300">
              {ROTULO_COMPLEXIDADE[item.complexidade]} · {item.modeloSugerido}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-bone-400">
                {item.custoUsd !== null ? `US$ ${item.custoUsd.toFixed(2)}` : "sem custo ainda"}
                {item.sessaoUrl ? (
                  <>
                    {" · "}
                    <a href={item.sessaoUrl} target="_blank" rel="noreferrer" className="text-gold-300 hover:underline">
                      abrir sessão
                    </a>
                  </>
                ) : null}
              </p>
              {item.estado === "na_fila" ? <CancelarBotao id={item.id} /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
