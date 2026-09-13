"use client";

import { useState } from "react";

import { atomosSetAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";
import type { HerancaResultado, ScoreAssimetria } from "@/core/prioritize/tipos-v3";
import type { AssimetriaDeclarada } from "@/types/canonical";

const OPCOES_OPCIONALIDADE: readonly OpcaoSegmentada<number>[] = [
  { valor: 1, rotulo: "1 — presa" },
  { valor: 2, rotulo: "2" },
  { valor: 3, rotulo: "3 — livre" },
];
const OPCOES_ESFORCO_CUSTO: readonly OpcaoSegmentada<number>[] = [
  { valor: 1, rotulo: "1" },
  { valor: 2, rotulo: "2" },
  { valor: 3, rotulo: "3" },
  { valor: 5, rotulo: "5" },
];

export interface AtomosFormProps {
  taskId: string;
  assimetriaAtual: AssimetriaDeclarada | null;
  /**
   * Score já calculado no servidor (`scoreAssimetria`, camada O) com os
   * átomos declarados no momento do render — recalcula a cada save porque a
   * página inteira revalida (`revalidatePath`), não porque o cliente refaz a
   * conta: alavanca/alcance dependem do grafo inteiro, calculado só no
   * servidor (kill-switch nº 3, `import "server-only"` em `assimetria.ts`).
   */
  score: ScoreAssimetria | null;
  heranca: HerancaResultado;
}

export function AtomosForm({ taskId, assimetriaAtual, score, heranca }: AtomosFormProps): JSX.Element {
  const [opcionalidade, setOpcionalidade] = useState(assimetriaAtual?.opcionalidade ?? 2);
  const [esforco, setEsforco] = useState(assimetriaAtual?.esforco ?? 1);
  const [custo, setCusto] = useState(assimetriaAtual?.custo ?? 1);
  const { estado, pendente, disparar } = useAcaoTarefa(atomosSetAction);

  function salvar(): void {
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("opcionalidade", String(opcionalidade));
    form.set("esforco", String(esforco));
    form.set("custo", String(custo));
    disparar(form);
  }

  function limpar(): void {
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("limpar", "true");
    disparar(form);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs font-semibold text-bone-300">Opcionalidade</p>
        <ControleSegmentado
          rotuloGrupo="Opcionalidade"
          opcoes={OPCOES_OPCIONALIDADE}
          valorAtual={opcionalidade}
          aoMudar={setOpcionalidade}
          desabilitado={pendente}
        />
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-bone-300">Esforço (p80)</p>
        <ControleSegmentado
          rotuloGrupo="Esforço"
          opcoes={OPCOES_ESFORCO_CUSTO}
          valorAtual={esforco}
          aoMudar={setEsforco}
          desabilitado={pendente}
        />
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-bone-300">Custo (p80)</p>
        <ControleSegmentado
          rotuloGrupo="Custo"
          opcoes={OPCOES_ESFORCO_CUSTO}
          valorAtual={custo}
          aoMudar={setCusto}
          desabilitado={pendente}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* [MÉDIO #9, crítico 13/09] era o 2º botão dourado da página — a
            régua de UI/UX pede UMA ação primária por tela, e "Salvar nota"
            (notas-painel.tsx) já é essa. Rebaixado ao estilo outline, igual
            aos demais botões secundários da tela (duração, subtarefa…). */}
        <button
          type="button"
          onClick={salvar}
          disabled={pendente}
          className="inline-flex min-h-[36px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm font-semibold text-bone-100 transition hover:border-gold-600 disabled:opacity-50"
        >
          Salvar átomos
        </button>
        {assimetriaAtual !== null ? (
          <button
            type="button"
            onClick={limpar}
            disabled={pendente}
            className="inline-flex min-h-[36px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm text-bone-300 hover:border-navy-600 disabled:opacity-50"
          >
            Limpar átomos
          </button>
        ) : null}
      </div>
      <CampoErro mensagem={estado.erro} />

      <div className="rounded-lg border border-navy-700 bg-navy-850 px-3 py-2.5 text-sm">
        {score ? (
          <>
            <p className="font-mono text-base font-bold text-gold-300">
              A = {score.valor}
              {score.obsoleta ? <span className="ml-2 text-xs text-state-blocked">(obsoleta)</span> : null}
            </p>
            <p className="mt-1 text-xs text-bone-400">{score.porque}</p>
          </>
        ) : (
          <p className="text-xs text-bone-400">
            Sem átomos declarados — salve os três acima para calcular o score de assimetria.
          </p>
        )}
        {heranca.herdado ? (
          <p className="mt-2 border-t border-navy-800 pt-2 text-xs text-bone-400">
            Esforço/custo herdados: soma das {heranca.filhasAbertas} filha(s) aberta(s) — esforço{" "}
            <span className="font-mono text-bone-200">{heranca.esforco}</span>, custo{" "}
            <span className="font-mono text-bone-200">{heranca.custo}</span>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
