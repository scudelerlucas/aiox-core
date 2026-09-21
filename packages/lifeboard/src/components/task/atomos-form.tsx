"use client";

import { useRef, useState } from "react";

import { CampoErro } from "@/components/task/campo-erro";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import { MensagemSucesso } from "@/components/task/mensagem-sucesso";
import { usarPortaDeEscrita } from "@/components/task/porta-de-escrita";
import type { MotivoSemScore } from "@/core/prioritize/assimetria-motivo";
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
  /**
   * [BAIXO #7, rodada 5] POR QUE não há score. `"sem_atomos"` = ninguém
   * declarou os três ainda (o operador resolve com dois cliques, e a tela diz
   * isso); `"nao_calculavel"` = os átomos existem mas a conta não fecha
   * (esforço/custo efetivos 0 ou não finitos — a guarda de `assimetria.ts`).
   * Antes os dois caíam na MESMA frase, "Sem átomos declarados", que no
   * segundo caso é falsa: os átomos estão lá.
   */
  motivo: MotivoSemScore | null;
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

/**
 * A assinatura do trio declarado, para comparar "o que está na tela" com "o
 * que o servidor confirmou" sem depender da ordem dos campos. `null` (nada
 * declarado) tem a sua própria assinatura — limpar duas vezes seguidas também
 * é uma escrita repetida.
 */
function chaveDoTrio(
  trio: { opcionalidade: number | null; esforco: number | null; custo: number | null } | null,
): string {
  if (trio === null) return "sem-atomos";
  return `${String(trio.opcionalidade)}/${String(trio.esforco)}/${String(trio.custo)}`;
}

export function AtomosForm({
  taskId,
  assimetriaAtual,
  score,
  motivo,
  heranca,
}: AtomosFormProps): JSX.Element {
  // [MÉDIO #2, rodada 4] `null` = nada escolhido ainda — antes o `?? 2`/`?? 1`
  // pré-marcava o denominador MÍNIMO (2/1/1, prioridade quase máxima) para
  // toda tarefa sem átomos declarados, e "Salvar átomos" gravava isso com um
  // clique cego. Agora só reflete um valor JÁ salvo no servidor; sem ele, os
  // 3 grupos nascem sem seleção (`ControleSegmentado` aceita `T | null`).
  const [opcionalidade, setOpcionalidade] = useState<number | null>(assimetriaAtual?.opcionalidade ?? null);
  const [esforco, setEsforco] = useState<number | null>(assimetriaAtual?.esforco ?? null);
  const [custo, setCusto] = useState<number | null>(assimetriaAtual?.custo ?? null);
  const todosEscolhidos = opcionalidade !== null && esforco !== null && custo !== null;
  /**
   * [MÉDIO #2, rodada 5] "Limpar átomos" SOME no sucesso (só existe quando
   * `assimetriaAtual !== null`) — e o foco caía no `<body>`. O grupo
   * Opcionalidade é o alvo lógico: é de onde a declaração recomeça. O foco é
   * entregue ANTES de o botão sair da árvore (a re-renderização vem do
   * `router.refresh()`, que só acontece depois deste callback).
   */
  const grupoOpcionalidadeRef = useRef<HTMLDivElement | null>(null);
  const botaoSalvarRef = useRef<HTMLButtonElement | null>(null);
  /**
   * [MÉDIO #3, rodada 6] o trio que o SERVIDOR confirmou — salvar de novo o
   * mesmo trio não gasta rede (a região viva responde "nada mudou"). Começa
   * no que veio do servidor; `null` = nada declarado.
   */
  const confirmadoRef = useRef<string>(chaveDoTrio(assimetriaAtual));
  /** O trio submetido — lido no `aoSucesso`, depois do `await`. */
  const trioRef = useRef<string>(confirmadoRef.current);

  /**
   * [ALTO #1, rodada 9] DUAS portas, uma por operação — e nenhuma delas
   * devolve despacho cru. Antes era um hook só, com um `ultimaAcaoRef` para
   * adivinhar no sucesso qual das duas escritas tinha acontecido; agora a
   * `op` viaja com o pedido e o servidor sabe qual é.
   */
  /**
   * [P2 do Codex, rodada 10] UMA trava de voo para as DUAS portas. Salvar e
   * limpar escrevem o MESMO campo; com uma trava cada, começar a gravação por
   * uma deixava a outra apenas `aria-disabled` no visual, e a porta dela ainda
   * despachava. O valor final passava a depender da ordem das respostas.
   */
  const travaDeVooDosAtomos = useRef(false);

  const portaSalvar = usarPortaDeEscrita({
    op: "atomos_salvar",
    travaDeVoo: travaDeVooDosAtomos,
    alvo: () => botaoSalvarRef.current,
    aoSucesso: () => {
      confirmadoRef.current = trioRef.current;
    },
  });

  const portaLimpar = usarPortaDeEscrita({
    op: "atomos_limpar",
    travaDeVoo: travaDeVooDosAtomos,
    // "Limpar átomos" SOME no sucesso: o foco vai para o 1º botão do grupo
    // Opcionalidade (de onde a declaração recomeça) e, se ele já não estiver
    // lá, para "Salvar átomos" — nunca para o `<body>`.
    alvo: () => grupoOpcionalidadeRef.current?.querySelector<HTMLButtonElement>("button"),
    alternativa: () => botaoSalvarRef.current,
    regiao: {
      mensagem: portaSalvar.mensagem,
      mostrar: (t, o) => { portaSalvar.anunciar(t, o); },
      limpar: () => { portaSalvar.limparAnuncio(); },
    },
    aoSucesso: () => {
      // [MÉDIO #2] devolve os 3 grupos ao estado SEM seleção — sem isto, o
      // `useState` local (só lido no mount) continuava mostrando os últimos
      // valores escolhidos mesmo depois do servidor apagar `assimetria`.
      setOpcionalidade(null);
      setEsforco(null);
      setCusto(null);
      confirmadoRef.current = chaveDoTrio(null);
    },
  });

  const pendente = portaSalvar.pendente || portaLimpar.pendente;

  function aoMudarCampo(): void {
    portaSalvar.aoMudarCampo();
    portaLimpar.aoMudarCampo();
  }

  function salvar(): void {
    // [pós-merge, CodeRabbit] AS DUAS PORTAS, UM CAMPO DE ERRO SÓ. `CampoErro`
    // mostra `portaSalvar.erroDoCampo ?? portaLimpar.erroDoCampo`, e cada porta
    // limpa só a si mesma. Sem isto, um "limpar" que dá certo depois de um
    // "salvar" que falhou continuava exibindo o erro do salvar — a tela
    // acusando o que acabou de funcionar.
    portaLimpar.aoMudarCampo();
    const trio = chaveDoTrio(todosEscolhidos ? { opcionalidade, esforco, custo } : null);
    trioRef.current = trio;
    portaSalvar.escrever(
      {
        task_id: taskId,
        opcionalidade: String(opcionalidade),
        esforco: String(esforco),
        custo: String(custo),
      },
      { valido: todosEscolhidos, mudou: trio !== confirmadoRef.current },
    );
  }

  function limpar(): void {
    // Mesma razão do `salvar`, na direção oposta.
    portaSalvar.aoMudarCampo();
    portaLimpar.escrever({ task_id: taskId });
  }

  return (
    <div className="space-y-3">
      <div ref={grupoOpcionalidadeRef}>
        <p className="mb-1 text-xs font-semibold text-bone-300">Opcionalidade</p>
        <ControleSegmentado
          rotuloGrupo="Opcionalidade"
          opcoes={OPCOES_OPCIONALIDADE}
          valorAtual={opcionalidade}
          aoMudar={(v) => {
            setOpcionalidade(v);
            aoMudarCampo();
          }}
          desabilitado={pendente}
        />
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-bone-300">Esforço (p80)</p>
        <ControleSegmentado
          rotuloGrupo="Esforço"
          opcoes={OPCOES_ESFORCO_CUSTO}
          valorAtual={esforco}
          aoMudar={(v) => {
            setEsforco(v);
            aoMudarCampo();
          }}
          desabilitado={pendente}
        />
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-bone-300">Custo (p80)</p>
        <ControleSegmentado
          rotuloGrupo="Custo"
          opcoes={OPCOES_ESFORCO_CUSTO}
          valorAtual={custo}
          aoMudar={(v) => {
            setCusto(v);
            aoMudarCampo();
          }}
          desabilitado={pendente}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* [MÉDIO #9, crítico 13/09] era o 2º botão dourado da página — a
            régua de UI/UX pede UMA ação primária por tela, e "Salvar nota"
            (notas-painel.tsx) já é essa. Rebaixado ao estilo outline, igual
            aos demais botões secundários da tela (duração, subtarefa…). */}
        <button
          ref={botaoSalvarRef}
          type="button"
          onClick={salvar}
          // [ALTO #1, rodada 6] SEM `disabled`, nem por validade: era o último
          // botão da página que virava `disabled` sozinho (ao limpar os
          // átomos, o trio some e o botão trocava de estado com o foco
          // dentro dele). A recusa mora em `salvar()` e diz o porquê.
          //
          // [MÉDIO #3, rodada 7] E sem `aria-disabled` por VALIDADE: ele
          // anunciava "indisponível" e a tecnologia assistiva recusava o
          // clique. O texto "Escolha os três…" abaixo já existia; agora ele é
          // o `aria-describedby` deste botão, que fica plenamente habilitado.
          aria-busy={pendente ? true : undefined}
          aria-disabled={pendente ? true : undefined}
          aria-describedby={!todosEscolhidos ? "dica-atomos" : undefined}
          className={`inline-flex min-h-[44px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm font-semibold text-bone-100 transition hover:border-gold-600 ${
            pendente ? "opacity-50" : ""
          }`}
        >
          Salvar átomos
        </button>
        {assimetriaAtual !== null ? (
          <button
            type="button"
            onClick={limpar}
            aria-busy={pendente ? true : undefined}
            aria-disabled={pendente ? true : undefined}
            className={`inline-flex min-h-[44px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm text-bone-300 hover:border-navy-600 ${
              pendente ? "opacity-50" : ""
            }`}
          >
            Limpar átomos
          </button>
        ) : null}
      </div>
      {!todosEscolhidos ? (
        // [MÉDIO #2, rodada 4] este texto diz o PORQUÊ, em vez de deixar o
        // operador adivinhar. [MÉDIO #3, rodada 7] e agora é o
        // `aria-describedby` do botão — quem ouve recebe a exigência junto
        // com o nome do controle, em vez de um "[disabled]" sem explicação.
        <p id="dica-atomos" className="text-xs text-bone-400">
          Escolha os três para calcular o score.
        </p>
      ) : null}
      <CampoErro mensagem={portaSalvar.erroDoCampo ?? portaLimpar.erroDoCampo} />
      <MensagemSucesso mensagem={portaSalvar.mensagem} />

      <div className="rounded-lg border border-navy-700 bg-navy-850 px-3 py-2.5 text-sm">
        {score ? (
          <>
            {/* [MÉDIO A7, rodada 11] `A = 18` era uma letra sem dono numa
                página em português: o "A" de assimetria só existia na cabeça
                de quem escreveu o modelo. */}
            <p className="font-mono text-base font-bold text-gold-300">
              assimetria (A) = {score.valor}
              {score.obsoleta ? <span className="ml-2 text-xs text-state-blocked">(obsoleta)</span> : null}
            </p>
            <p className="mt-1 text-xs text-bone-400">{score.porque}</p>
          </>
        ) : (
          <p className="text-xs text-bone-400">
            {motivo === "nao_calculavel"
              ? // [BAIXO #7, rodada 5] os átomos ESTÃO declarados; o que falhou
                // foi a conta (esforço/custo efetivos 0 ou não finitos). Dizer
                // "sem átomos declarados" aqui era mandar o operador re-declarar
                // o que já estava lá.
                "Não foi possível calcular o score agora."
              : "Sem átomos declarados — salve os três acima para calcular o score de assimetria."}
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
