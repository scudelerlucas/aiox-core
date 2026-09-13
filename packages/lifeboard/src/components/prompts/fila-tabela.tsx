"use client";

import Link from "next/link";
import { useState } from "react";

import { CancelarBotao } from "@/components/prompts/cancelar-botao";
import { EstadoFilaChip } from "@/components/prompts/estado-fila-chip";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { ItemFilaPrompt } from "@/core/prompts/tipos";
import {
  ROTULO_COMPLEXIDADE,
  ROTULO_CONTA,
  descricaoExecucao,
  formatarUsd,
  semSinal,
} from "@/core/prompts/tipos";

const LIMITE_PREVIA = 90;

/**
 * O prompt chega TRUNCADO em 300 caracteres da RPC (D8) — `promptTamanho` diz
 * o tamanho real. A tabela mostra 90 caracteres; "ver tudo" abre o que veio, e
 * quando o original é maior que isso a linha diz quanto ficou de fora (em vez
 * de fingir que aquele é o prompt inteiro).
 */
function CelulaPrompt({ item }: { item: ItemFilaPrompt }): JSX.Element {
  const [aberto, setAberto] = useState(false);
  const recebido = item.prompt;
  const truncadoNoBanco = item.promptTamanho > recebido.length;
  const precisaTruncar = recebido.length > LIMITE_PREVIA;

  if (!precisaTruncar && !truncadoNoBanco) {
    return <p className="text-xs text-bone-300">{recebido}</p>;
  }

  return (
    <div className="text-xs text-bone-300">
      <p>{aberto || !precisaTruncar ? recebido : `${recebido.slice(0, LIMITE_PREVIA)}…`}</p>
      {aberto && truncadoNoBanco ? (
        <p className="mt-1 text-[11px] text-bone-400">
          são {item.promptTamanho} caracteres no total; a tela mostra os {recebido.length} primeiros.
        </p>
      ) : null}
      {precisaTruncar ? (
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="mt-1 min-h-[24px] text-[11px] font-medium text-gold-300 hover:underline"
        >
          {aberto ? "recolher" : "ver tudo"}
        </button>
      ) : null}
    </div>
  );
}

/** D7: a frase de vida do item em execução (ou o aviso de que ele emudeceu). */
function Execucao({ item, agora }: { item: ItemFilaPrompt; agora: number }): JSX.Element | null {
  const frase = descricaoExecucao(item, agora);
  if (!frase) return null;
  const mudo = semSinal(item, agora);
  return (
    <p className={`mt-0.5 text-[11px] ${mudo ? "text-state-blocked" : "text-bone-400"}`}>
      {frase}
      {item.tentativas > 1 ? ` · tentativa ${item.tentativas} de ${item.maxTentativas}` : ""}
    </p>
  );
}

function podeCancelar(item: ItemFilaPrompt): boolean {
  // D7: `pega` deixou de ser beco sem saída — o operador pode parar o que está
  // rodando, e o worker descobre pelo heartbeat.
  return item.estado === "na_fila" || item.estado === "pega";
}

/**
 * OS-LIFEBOARD · P7 — a tabela da fila: estado (com "sem sinal"), conta,
 * complexidade/modelo, prompt (prévia + "ver tudo"), idades, custo, link da
 * sessão e cancelar. Mobile: vira lista de cartões (tabela larga rolando de
 * lado quebraria a régua de gutter ≥16px).
 */
export function FilaTabela({
  itens,
  agora,
  temMais,
  limiteAtual,
}: {
  itens: readonly ItemFilaPrompt[];
  agora: number;
  temMais?: boolean;
  limiteAtual?: number;
}): JSX.Element {
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
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-navy-700 bg-navy-900 text-xs uppercase tracking-wide text-bone-400">
              <th className="px-3 py-2">estado</th>
              <th className="px-3 py-2">conta</th>
              <th className="px-3 py-2">complexidade / modelo</th>
              <th className="px-3 py-2">prompt</th>
              <th className="px-3 py-2">criado</th>
              <th className="px-3 py-2">custo</th>
              <th className="px-3 py-2">sessão</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id} className="border-b border-navy-800 last:border-0">
                <td className="px-3 py-2.5 align-top">
                  <EstadoFilaChip estado={item.estado} semSinal={semSinal(item, agora)} />
                  <Execucao item={item} agora={agora} />
                  {item.motivoFalha ? (
                    <p className="mt-0.5 text-[11px] text-bone-400">{item.motivoFalha}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 align-top text-bone-100">{ROTULO_CONTA[item.conta]}</td>
                <td className="px-3 py-2.5 align-top text-bone-300">
                  {ROTULO_COMPLEXIDADE[item.complexidade]} · {item.modeloSugerido}
                </td>
                <td className="max-w-[280px] px-3 py-2.5 align-top">
                  <CelulaPrompt item={item} />
                </td>
                <td className="px-3 py-2.5 align-top text-bone-400">
                  {formatRelativeTime(item.criadoEm, agora)}
                </td>
                <td className="px-3 py-2.5 align-top text-bone-300">
                  {item.custoUsd !== null ? formatarUsd(item.custoUsd) : "—"}
                </td>
                <td className="px-3 py-2.5 align-top">
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
                <td className="px-3 py-2.5 align-top text-right">
                  {podeCancelar(item) ? (
                    <CancelarBotao id={item.id} emExecucao={item.estado === "pega"} />
                  ) : null}
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
              <EstadoFilaChip estado={item.estado} semSinal={semSinal(item, agora)} />
              <span className="text-xs text-bone-400">{formatRelativeTime(item.criadoEm, agora)}</span>
            </div>
            <Execucao item={item} agora={agora} />
            {item.motivoFalha ? (
              <p className="mt-0.5 text-[11px] text-bone-400">{item.motivoFalha}</p>
            ) : null}
            <p className="mt-2 text-sm text-bone-100">{ROTULO_CONTA[item.conta]}</p>
            <p className="mt-0.5 text-xs text-bone-300">
              {ROTULO_COMPLEXIDADE[item.complexidade]} · {item.modeloSugerido}
            </p>
            <div className="mt-2">
              <CelulaPrompt item={item} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-bone-400">
                {item.custoUsd !== null ? formatarUsd(item.custoUsd) : "sem custo ainda"}
                {item.sessaoUrl ? (
                  <>
                    {" · "}
                    <a href={item.sessaoUrl} target="_blank" rel="noreferrer" className="text-gold-300 hover:underline">
                      abrir sessão
                    </a>
                  </>
                ) : null}
              </p>
              {podeCancelar(item) ? (
                <CancelarBotao id={item.id} emExecucao={item.estado === "pega"} />
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* D8: a tela mostra 50 e um "mostrar mais" — o próximo passo pede mais 50
          à RPC (link real, sem estado de cliente: a página é Server Component). */}
      {temMais ? (
        <div className="mt-3 text-center">
          <Link
            href={`/prompts?limite=${(limiteAtual ?? 50) + 50}`}
            prefetch={false}
            scroll={false}
            className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
          >
            mostrar mais 50
          </Link>
        </div>
      ) : null}
    </div>
  );
}
