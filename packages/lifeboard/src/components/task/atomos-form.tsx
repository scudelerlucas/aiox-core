"use client";

import { useRef, useState } from "react";

import { atomosSetAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import { MensagemSucesso, useMensagemSucesso } from "@/components/task/mensagem-sucesso";
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

/**
 * [BAIXO #7, rodada 3] plural de máquina ("filha(s) aberta(s)", "subtarefa(s)
 * sem átomos") — singular/plural condicional em português, para 1 vs. N.
 *
 * [BAIXO #4, rodada 4] a FRASE inteira, não só o substantivo: o chamador
 * (`AtomosForm`) escrevia `"soma das " + filhasAbertasTexto(n)`, com "das"
 * FIXO — para `n=1` isso lia "soma das 1 filha aberta" (concordância errada;
 * seria "soma DA 1 filha aberta"). A função agora devolve a frase JÁ com a
 * preposição/artigo concordando, para o chamador nunca hardcodar a metade
 * plural de novo.
 */
function fraseFilhasAbertas(n: number): string {
  return n === 1 ? "da 1 filha aberta" : `das ${n} filhas abertas`;
}

function filhasSemAtomosTexto(n: number): string {
  return n === 1 ? "1 subtarefa sem átomos" : `${n} subtarefas sem átomos`;
}

export function AtomosForm({ taskId, assimetriaAtual, score, heranca }: AtomosFormProps): JSX.Element {
  // [MÉDIO #2, rodada 4] `null` = nada escolhido ainda — antes o `?? 2`/`?? 1`
  // pré-marcava o denominador MÍNIMO (2/1/1, prioridade quase máxima) para
  // toda tarefa sem átomos declarados, e "Salvar átomos" gravava isso com um
  // clique cego. Agora só reflete um valor JÁ salvo no servidor; sem ele, os
  // 3 grupos nascem sem seleção (`ControleSegmentado` aceita `T | null`).
  const [opcionalidade, setOpcionalidade] = useState<number | null>(assimetriaAtual?.opcionalidade ?? null);
  const [esforco, setEsforco] = useState<number | null>(assimetriaAtual?.esforco ?? null);
  const [custo, setCusto] = useState<number | null>(assimetriaAtual?.custo ?? null);
  const todosEscolhidos = opcionalidade !== null && esforco !== null && custo !== null;
  // Distingue, no callback de sucesso ÚNICO do hook, se o disparo em curso
  // era "salvar" ou "limpar" — os dois usam a mesma `disparar()`.
  const ultimaAcaoRef = useRef<"salvar" | "limpar" | null>(null);
  const { mensagem, mostrar } = useMensagemSucesso();
  const { estado, pendente, disparar } = useAcaoTarefa(atomosSetAction, () => {
    if (ultimaAcaoRef.current === "limpar") {
      // [MÉDIO #2] devolve os 3 grupos ao estado SEM seleção — sem isto, o
      // `useState` local (só lido no mount) continuava mostrando os últimos
      // valores escolhidos mesmo depois do servidor apagar `assimetria`.
      setOpcionalidade(null);
      setEsforco(null);
      setCusto(null);
      mostrar("Átomos limpos.");
    } else {
      mostrar("Átomos salvos.");
    }
  });

  function salvar(): void {
    if (!todosEscolhidos) return; // defensivo — o botão já nasce `disabled` neste caso.
    ultimaAcaoRef.current = "salvar";
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("opcionalidade", String(opcionalidade));
    form.set("esforco", String(esforco));
    form.set("custo", String(custo));
    disparar(form);
  }

  function limpar(): void {
    ultimaAcaoRef.current = "limpar";
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
          disabled={pendente || !todosEscolhidos}
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
      {!todosEscolhidos ? (
        // [MÉDIO #2, rodada 4] o botão nasce `disabled` — este texto diz o
        // PORQUÊ, em vez de deixar o operador adivinhar por que "Salvar
        // átomos" não responde ao clique.
        <p className="text-xs text-bone-400">Escolha os três para calcular o score.</p>
      ) : null}
      <CampoErro mensagem={estado.erro} />
      <MensagemSucesso mensagem={mensagem} />

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
            Esforço/custo herdados: soma {fraseFilhasAbertas(heranca.filhasAbertas)} — esforço{" "}
            <span className="font-mono text-bone-200">{heranca.esforco}</span>, custo{" "}
            <span className="font-mono text-bone-200">{heranca.custo}</span>.
          </p>
        ) : heranca.filhasAbertas > 0 ? (
          // [ALTO #1, crítico 13/09, rodada 2] há filha(s) aberta(s), mas
          // nenhuma (nem a subárvore delas) declarou átomo — antes disto a
          // mãe "herdava" 0/0 e o score inflava com o piso de `assimetria.ts`.
          // Agora usa os átomos da própria tarefa e avisa, em vez de fingir
          // "esforço 0, custo 0".
          <p className="mt-2 border-t border-navy-800 pt-2 text-xs text-bone-400">
            {filhasSemAtomosTexto(heranca.filhasSemAtomos)} — usando os átomos da própria
            tarefa.
          </p>
        ) : null}
      </div>
    </div>
  );
}
