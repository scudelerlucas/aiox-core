"use client";

import { useEffect, useRef, useState } from "react";

import { CampoErro } from "@/components/task/campo-erro";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import { anuncioComDesfazerPerdido } from "@/components/task/escrita";
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
/** 10 s — mesma janela do "Desfazer" da nota e da relação criada. */
const JANELA_DESFAZER_MS = 10_000;

/**
 * ══════════════════════════════════════════════════════════ ALTO #2, rodada 14 ═
 * "LIMPAR ÁTOMOS" ERA UM CLIQUE SEM VOLTA.
 *
 * Na mesma página, excluir uma relação custa dois cliques (confirmação) e abre
 * 10 s de "Desfazer"; excluir uma nota, idem. "Limpar átomos" apagava os TRÊS
 * números que o operador declarou — e que alimentam o score de prioridade da
 * tarefa — com UM clique, sem confirmação, sem desfazer, e o `aoSucesso` ainda
 * zerava os três controles na tela: nem pela memória visual dava para
 * reconstruir. Medido pelo crítico: assimetria (A) = 18 (átomos 3/3/2) → 1
 * clique, 0 diálogos, "Sem átomos declarados", 0 botões "Desfazer", e nada
 * depois do F5.
 *
 * O remédio é o padrão que a PÁGINA já usa, e não um terceiro: janela de
 * desfazer de 10 s, com o trio guardado e devolvido pela porta
 * `atomos_desfazer_limpeza`. Janela é melhor que confirmação aqui pela mesma
 * razão das outras duas exclusões: não cobra um segundo clique de quem já sabe
 * o que quer, e dá volta a quem errou.
 */
interface JanelaDeDesfazerAtomos {
  /** A frase que vai para a região viva, colada ao botão "Desfazer". */
  texto: string;
  /** Os três números apagados — é isto que o "Desfazer" devolve. */
  trio: { opcionalidade: number; esforco: number; custo: number };
}

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

  /** A janela de "Desfazer" da limpeza — um valor, não dois estados soltos. */
  const [limpado, setLimpado] = useState<JanelaDeDesfazerAtomos | null>(null);
  /** A verdade sobre a janela no instante do sucesso (depois do `await`). */
  const janelaRef = useRef<JanelaDeDesfazerAtomos | null>(null);
  janelaRef.current = limpado;
  /** O trio que a limpeza EM VOO está apagando — escrito só após o veredito. */
  const apagadoRef = useRef<JanelaDeDesfazerAtomos["trio"] | null>(null);
  /** O trio que o desfazer EM VOO está devolvendo — mesma lei. */
  const restauradoRef = useRef<JanelaDeDesfazerAtomos["trio"] | null>(null);
  const botaoDesfazerRef = useRef<HTMLButtonElement | null>(null);
  const desfazerTimeoutRef = useRef<number | null>(null);

  function fecharRelogio(): void {
    if (desfazerTimeoutRef.current !== null) window.clearTimeout(desfazerTimeoutRef.current);
    desfazerTimeoutRef.current = null;
  }

  useEffect(() => fecharRelogio, []);

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
    // Uma limpeza nova fecha a janela da anterior antes de gravar.
    antesDeGravar: () => {
      fecharRelogio();
      setLimpado(null);
    },
    // [BAIXO #8, rodada 7] havia um "Desfazer" pendente? Ele acabou de ser
    // substituído — a frase entra JUNTO, numa string só.
    texto: () => anuncioComDesfazerPerdido("atomos_limpar", janelaRef.current !== null),
    // [ALTO #2, rodada 14] o sucesso não vai para a região geral: ele mora
    // colado ao botão "Desfazer", como nas outras duas exclusões da página.
    anunciarSucesso: (t) => {
      const trio = apagadoRef.current;
      if (trio === null) {
        // Sem trio guardado não há volta a oferecer (não deveria acontecer: o
        // botão só existe com `assimetriaAtual`). Degrada dizendo o que houve.
        portaSalvar.anunciar(t);
        return;
      }
      setLimpado({ texto: t, trio });
      desfazerTimeoutRef.current = window.setTimeout(() => {
        setLimpado(null);
        // Se o foco estava no "Desfazer" que acabou de sumir, devolve ao
        // botão "Salvar átomos" — nunca ao `<body>`.
        if (
          typeof document !== "undefined" &&
          botaoDesfazerRef.current !== null &&
          document.activeElement === botaoDesfazerRef.current
        ) {
          botaoSalvarRef.current?.focus();
        }
      }, JANELA_DESFAZER_MS);
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

  /**
   * [ALTO #2, rodada 14] O CAMINHO DE VOLTA. Porta própria, com `textoDeFalha`
   * próprio: a chamada pode falhar (rede caída, RPC recusando) e a tela não
   * pode seguir mostrando "Átomos limpos. Desfazer" como se nada tivesse
   * acontecido. Mesma trava de voo das outras duas — as três escrevem o MESMO
   * campo.
   */
  const portaDesfazerLimpeza = usarPortaDeEscrita({
    op: "atomos_desfazer_limpeza",
    travaDeVoo: travaDeVooDosAtomos,
    // O "Desfazer" some agora: o foco vai para "Salvar átomos" (de onde a
    // edição do trio recomeça) e, se ele não aceitar, para o 1º botão do
    // grupo Opcionalidade.
    alvo: () => botaoSalvarRef.current,
    alternativa: () => grupoOpcionalidadeRef.current?.querySelector<HTMLButtonElement>("button"),
    // Uma região viva a mais por porta seria o defeito que a rodada 9 fechou
    // nos outros painéis: o desfazer fala na região de ANÚNCIOS do painel (a
    // de `portaSalvar`), e o botão "Desfazer" mora na região própria dele.
    regiao: {
      mensagem: portaSalvar.mensagem,
      mostrar: (t, o) => {
        portaSalvar.anunciar(t, o);
      },
      limpar: () => {
        portaSalvar.limparAnuncio();
      },
    },
    aoSucesso: () => {
      fecharRelogio();
      setLimpado(null);
      const trio = restauradoRef.current;
      if (trio === null) return;
      // Os três controles voltam ao que o servidor acabou de aceitar — o
      // `router.refresh()` da porta traz o score junto.
      setOpcionalidade(trio.opcionalidade);
      setEsforco(trio.esforco);
      setCusto(trio.custo);
      confirmadoRef.current = chaveDoTrio(trio);
    },
    aoFalha: () => {
      fecharRelogio(); // não esconde o botão: o operador ainda vai querer tentar.
    },
    textoDeFalha: () => "Não foi possível desfazer — os átomos continuam limpos.",
  });

  const pendente = portaSalvar.pendente || portaLimpar.pendente || portaDesfazerLimpeza.pendente;

  function aoMudarCampo(): void {
    portaSalvar.aoMudarCampo();
    portaLimpar.aoMudarCampo();
    portaDesfazerLimpeza.aoMudarCampo();
  }

  function salvar(): void {
    // [pós-merge, CodeRabbit] AS DUAS PORTAS, UM CAMPO DE ERRO SÓ. `CampoErro`
    // mostra `portaSalvar.erroDoCampo ?? portaLimpar.erroDoCampo`, e cada porta
    // limpa só a si mesma. Sem isto, um "limpar" que dá certo depois de um
    // "salvar" que falhou continuava exibindo o erro do salvar — a tela
    // acusando o que acabou de funcionar.
    portaLimpar.aoMudarCampo();
    const trio = chaveDoTrio(todosEscolhidos ? { opcionalidade, esforco, custo } : null);
    // [CRÍTICO #2, rodada 13] O TRIO SUBMETIDO SÓ SE ESCREVE DEPOIS DO
    // VEREDITO — gêmeo exato do `valorEnviadoRef` de `duracao-form.tsx`, e
    // pela mesma lei da rodada 10 que `status`, `mae` e `meta` já cumpriam.
    //
    // Escrito antes, uma recusa sobrescrevia o trio EM VOO. Medido: opcionalidade
    // 1→3 e salvar; 120 ms depois esforço 2→5 e salvar (recusado, "Aguarde…").
    // A resposta da PRIMEIRA gravação chegava, anunciava "Átomos salvos." e
    // guardava em `confirmadoRef` o trio `3/5/1`, que o servidor nunca recebeu —
    // o banco tinha `3/2/1`. A tela mostrava esforço 5, o score de assimetria
    // saía calculado com esforço 2, e "Salvar átomos" respondia "já estão
    // salvos assim — nada mudou": o estado ficava preso, e a prioridade da
    // tarefa seguia sendo calculada com o número errado.
    const decisao = portaSalvar.escrever(
      {
        task_id: taskId,
        opcionalidade: String(opcionalidade),
        esforco: String(esforco),
        custo: String(custo),
      },
      { valido: todosEscolhidos, mudou: trio !== confirmadoRef.current },
    );
    if (decisao === "gravar") trioRef.current = trio;
  }

  function limpar(): void {
    // Mesma razão do `salvar`, na direção oposta.
    portaSalvar.aoMudarCampo();
    portaDesfazerLimpeza.aoMudarCampo();
    // O trio que está indo embora — é ele que o "Desfazer" devolve. Lido do
    // que o SERVIDOR confirmou, nunca do `useState` da tela.
    const indo = assimetriaAtual;
    const decisao = portaLimpar.escrever({ task_id: taskId });
    // [CRÍTICO #1/#2, rodada 13] o ref só depois do veredito: uma recusa não
    // pode passar por cima do trio que a limpeza EM VOO está apagando.
    if (decisao === "gravar") {
      apagadoRef.current =
        indo === null
          ? null
          : {
              opcionalidade: indo.opcionalidade,
              esforco: indo.esforco,
              custo: indo.custo,
            };
    }
  }

  function desfazerLimpeza(): void {
    const janela = janelaRef.current;
    portaSalvar.aoMudarCampo();
    const decisao = portaDesfazerLimpeza.escrever(
      {
        task_id: taskId,
        opcionalidade: String(janela?.trio.opcionalidade),
        esforco: String(janela?.trio.esforco),
        custo: String(janela?.trio.custo),
      },
      { valido: janela !== null },
    );
    if (decisao === "gravar") restauradoRef.current = janela?.trio ?? null;
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
      <CampoErro
        mensagem={
          portaSalvar.erroDoCampo ?? portaLimpar.erroDoCampo ?? portaDesfazerLimpeza.erroDoCampo
        }
      />
      <MensagemSucesso mensagem={portaSalvar.mensagem} />

      {/* [ALTO #2, rodada 14] Região viva do DESFAZER da limpeza — texto e
          botão no MESMO valor, como em notas-painel e relacoes-painel: era o
          desencontro entre os dois que deixava um "Desfazer" sozinho, sem
          dizer desfazer o quê. */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          limpado ? "text-xs font-medium text-state-done" : "m-0 min-h-0 text-xs text-state-done"
        }
      >
        {limpado ? (
          <>
            {`${limpado.texto} `}
            <button
              ref={botaoDesfazerRef}
              type="button"
              onClick={desfazerLimpeza}
              aria-busy={portaDesfazerLimpeza.pendente ? true : undefined}
              aria-disabled={portaDesfazerLimpeza.pendente ? true : undefined}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 underline underline-offset-2 hover:text-gold-300 ${
                portaDesfazerLimpeza.pendente ? "opacity-50" : ""
              }`}
            >
              Desfazer
            </button>
          </>
        ) : (
          ""
        )}
      </p>

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
