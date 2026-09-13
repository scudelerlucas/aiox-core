"use client";

import { useState, type FormEvent } from "react";

import { novoPromptAction } from "@/app/prompts/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import { useAcaoPrompt } from "@/components/prompts/usar-acao-prompt";
import type { Complexidade } from "@/core/prompts/tipos";
import { CONTAS, ROTULO_CONTA, ROTULO_COMPLEXIDADE } from "@/core/prompts/tipos";

const OPCOES_COMPLEXIDADE: readonly OpcaoSegmentada<Complexidade>[] = [
  { valor: "baixa", rotulo: "baixa" },
  { valor: "media", rotulo: "média" },
  { valor: "alta", rotulo: "alta" },
  { valor: "maxima", rotulo: "máxima" },
];

export interface TarefaParaLink {
  id: string;
  title: string;
}

export interface NovoPromptFormProps {
  complexidade: Complexidade;
  aoMudarComplexidade: (v: Complexidade) => void;
  contaOverride: string;
  aoMudarContaOverride: (v: string) => void;
  modeloImplicado: string;
  motivoAuto: string;
  contaAuto: string | null;
  tarefas: readonly TarefaParaLink[];
  /**
   * D3 (rodada 3): não há espaço HOJE — AVISO, não bloqueio. O item entra na
   * fila e roda quando houver espaço; a tela diz isso e o botão continua vivo.
   * (Na rodada anterior isto desabilitava o envio e o prompt era perdido.)
   */
  naoCabeHoje?: boolean;
  /**
   * D3: o ÚNICO bloqueio real — a tarefa custa mais que o teto de qualquer
   * conta e nunca vai caber, em nenhum dia. Aí o banco recusa mesmo.
   */
  impossivel?: boolean;
}

/**
 * OS-LIFEBOARD · P7 — "Novo prompt": textarea + complexidade (com o modelo
 * que ela implica mostrado AO VIVO) + conta opcional (roteamento automático
 * por padrão) + tarefa opcional para linkar. Ação primária única da tela
 * (régua de UI/UX): enviar.
 */
export function NovoPromptForm({
  complexidade,
  aoMudarComplexidade,
  contaOverride,
  aoMudarContaOverride,
  modeloImplicado,
  motivoAuto,
  contaAuto,
  tarefas,
  naoCabeHoje,
  impossivel,
}: NovoPromptFormProps): JSX.Element {
  const [prompt, setPrompt] = useState("");
  const { estado, pendente, disparar } = useAcaoPrompt(novoPromptAction, () => setPrompt(""));

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const form = new FormData();
    form.set("prompt", prompt);
    form.set("complexidade", complexidade);
    form.set("conta", contaOverride);
    const taskSelect = e.currentTarget.elements.namedItem("task_id") as HTMLSelectElement | null;
    if (taskSelect) form.set("task_id", taskSelect.value);
    disparar(form);
  }

  return (
    <form onSubmit={aoEnviar} className="rounded-lg border border-navy-700 bg-navy-850 p-4">
      <h2 className="text-sm font-semibold text-bone-50">Novo prompt</h2>

      <label htmlFor="prompt-novo" className="sr-only">
        Prompt
      </label>
      <textarea
        id="prompt-novo"
        name="prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Descreva a tarefa a ser executada na conta escolhida…"
        rows={4}
        maxLength={20000}
        className="mt-2 w-full rounded-md border border-navy-700 bg-navy-900 px-3 py-2 text-sm text-bone-100 placeholder:text-bone-400 focus:border-gold-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-bone-300">Complexidade</p>
          <ControleSegmentado
            rotuloGrupo="Complexidade da tarefa"
            opcoes={OPCOES_COMPLEXIDADE}
            valorAtual={complexidade}
            aoMudar={aoMudarComplexidade}
            desabilitado={pendente}
          />
          <input type="hidden" name="complexidade" value={complexidade} />
          <p className="mt-1.5 text-xs text-bone-400">
            modelo sugerido: <span className="font-semibold text-gold-300">{modeloImplicado}</span>
          </p>
        </div>

        <div>
          <label htmlFor="conta-override" className="mb-1.5 block text-xs font-medium text-bone-300">
            Conta (opcional)
          </label>
          <select
            id="conta-override"
            name="conta"
            value={contaOverride}
            onChange={(e) => aoMudarContaOverride(e.target.value)}
            disabled={pendente}
            className="min-h-[36px] rounded-md border border-navy-700 bg-navy-900 px-2 text-sm text-bone-100 focus:border-gold-500 focus:outline-none disabled:opacity-50"
          >
            <option value="">automático (maior espaço livre hoje)</option>
            {CONTAS.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CONTA[c]}
              </option>
            ))}
          </select>
          <p className="mt-1.5 max-w-[260px] text-xs text-bone-400">
            {/* Quando não cabe hoje, o motivo já é uma frase inteira e aparece
                logo abaixo em destaque — repeti-lo aqui produzia "agora
                escolheria Lucas — Nenhuma conta tem…", que se contradiz. */}
            {contaOverride === ""
              ? contaAuto
                ? naoCabeHoje
                  ? `agora iria para ${ROTULO_CONTA[contaAuto as keyof typeof ROTULO_CONTA]}`
                  : `agora iria para ${ROTULO_CONTA[contaAuto as keyof typeof ROTULO_CONTA]} — ${motivoAuto}`
                : motivoAuto
              : "escolha manual — ignora o roteamento automático"}
          </p>
        </div>

        {tarefas.length > 0 ? (
          <div>
            <label htmlFor="task-link" className="mb-1.5 block text-xs font-medium text-bone-300">
              Linkar a uma tarefa (opcional)
            </label>
            <select
              id="task-link"
              name="task_id"
              disabled={pendente}
              className="min-h-[36px] max-w-[220px] rounded-md border border-navy-700 bg-navy-900 px-2 text-sm text-bone-100 focus:border-gold-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">nenhuma</option>
              {tarefas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <CampoErro mensagem={estado.erro} />
      {estado.ok && estado.conta ? (
        <p role="status" className="mt-2 text-xs font-medium text-state-done">
          Enfileirado para {ROTULO_CONTA[estado.conta as keyof typeof ROTULO_CONTA] ?? estado.conta}
          {estado.motivo ? ` — ${estado.motivo}` : ""}.
        </p>
      ) : null}
      {/* D3: dois avisos diferentes, porque são duas coisas diferentes — um é
          "espera até amanhã" (o item entra), o outro é "nunca" (o banco recusa). */}
      {impossivel ? (
        <p role="alert" className="mt-2 text-xs font-medium text-state-blocked">
          {motivoAuto}
        </p>
      ) : naoCabeHoje ? (
        <p role="status" className="mt-2 text-xs font-medium text-state-progress">
          {motivoAuto} Entra na fila assim mesmo e roda quando houver espaço.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendente || prompt.trim().length === 0 || impossivel === true}
        className="mt-4 min-h-[40px] rounded-md border border-gold-500 bg-navy-800 px-4 text-sm font-semibold text-gold-300 transition duration-150 ease-almapetra hover:bg-navy-700 disabled:opacity-50"
      >
        {pendente ? "enviando…" : "Enviar para a fila"}
      </button>
      <p className="mt-1.5 text-[11px] text-bone-400">
        Complexidades: {ROTULO_COMPLEXIDADE.baixa}=Haiku · {ROTULO_COMPLEXIDADE.media}=Sonnet ·{" "}
        {ROTULO_COMPLEXIDADE.alta}=Opus · {ROTULO_COMPLEXIDADE.maxima}=Fable.
      </p>
    </form>
  );
}
