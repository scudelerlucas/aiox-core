"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MutableRefObject,
} from "react";

import { arestaAddAction, arestaDelAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import {
  anuncioComDesfazerPerdido,
  concluirEscrita,
  decidirEscrita,
  MENSAGEM_INVALIDO,
  recusarEscrita,
  transicaoDeConfirmacao,
  useCampoDeErro,
} from "@/components/task/escrita";
import { focarComAlternativa } from "@/components/task/foco";
import { useMensagemSucesso } from "@/components/task/mensagem-sucesso";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";
import type { EdgeTipo, TaskEdge } from "@/types/canonical";

const ROTULO_TIPO: Record<EdgeTipo, string> = {
  predecessor: "predecessor",
  correlacao: "correlação",
  sinergia: "sinergia",
  obsolescencia: "obsolescência",
};

const OPCOES_TIPO: readonly OpcaoSegmentada<EdgeTipo>[] = [
  { valor: "predecessor", rotulo: "predecessor" },
  { valor: "correlacao", rotulo: "correlação" },
  { valor: "sinergia", rotulo: "sinergia" },
  { valor: "obsolescencia", rotulo: "obsolescência" },
];

/** 10 s — mesma janela do "Desfazer" da nota excluída (`notas-painel.tsx`). */
const JANELA_DESFAZER_MS = 10_000;

export interface OpcaoTarefaRelacao {
  id: string;
  title: string;
}

export interface RelacoesPainelProps {
  taskId: string;
  /** Arestas em que esta tarefa é a ORIGEM (aponta para fora). */
  saindo: readonly TaskEdge[];
  /** Arestas em que esta tarefa é o DESTINO (apontam para cá). */
  entrando: readonly TaskEdge[];
  /** Candidatas a destino — o chamador já exclui a própria tarefa. */
  opcoesDestino: readonly OpcaoTarefaRelacao[];
  tituloPorId: ReadonlyMap<string, string>;
}

/** O payload que recria uma aresta idêntica (achado BAIXO #5, rodada 5). */
interface ArestaExcluida {
  origem: string;
  destino: string;
  tipo: EdgeTipo;
  peso: number;
  /** [MÉDIO #4, rodada 7] a data ORIGINAL — devolve a relação à sua posição. */
  criadoEm: string;
}

/**
 * [MÉDIO #6, rodada 7] PURA — o nome acessível do "excluir" de UMA linha de
 * relação. Medido: o foco entregue depois de excluir aterrissava num botão
 * chamado só "excluir", idêntico em todas as linhas.
 */
export function rotuloDoBotaoDeExcluirRelacao(
  tipo: EdgeTipo,
  rotuloOutraPonta: string,
  indice: number,
  total: number,
  confirmando: boolean,
): string {
  // A posição entra pelo mesmo motivo da nota: duas relações do MESMO tipo
  // com a MESMA outra ponta existem (uma saindo, outra entrando) e teriam o
  // mesmo nome sem ela.
  const alvo =
    `a relação ${String(indice + 1)} de ${String(total)}, de ${ROTULO_TIPO[tipo]} ` +
    `com ${rotuloOutraPonta}`;
  return confirmando ? `confirmar exclusão d${alvo}` : `excluir ${alvo}`;
}

export function RelacoesPainel({
  taskId,
  saindo,
  entrando,
  opcoesDestino,
  tituloPorId,
}: RelacoesPainelProps): JSX.Element {
  const selectDestinoRef = useRef<HTMLSelectElement | null>(null);
  const botaoAdicionarRef = useRef<HTMLButtonElement | null>(null);
  /** Botões "excluir" por índice — o alvo do foco quando a linha some. */
  const botoesExcluirRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const botaoDesfazerRef = useRef<HTMLButtonElement | null>(null);
  const [excluida, setExcluida] = useState<ArestaExcluida | null>(null);
  const [erroDesfazer, setErroDesfazer] = useState<string | undefined>(undefined);
  /** [MÉDIO #5, rodada 7] uma linha em confirmação por painel — sem relógio. */
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  // Região viva do PAINEL: "Excluída." (persistente, ao lado do Desfazer) e
  // "Relação restaurada (como nova)." (4 s).
  const { mensagem, mostrar, limpar } = useMensagemSucesso();
  const timerRef = useRef<number | null>(null);

  function limparTimer(): void {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  useEffect(() => limparTimer, []);

  const {
    pendente: desfazendo,
    disparar: dispararDesfazer,
    emVooAgora: desfazerEmVoo,
  } = useAcaoTarefa(
    arestaAddAction,
    () => {
      limparTimer();
      setErroDesfazer(undefined);
      setExcluida(null);
      // [BAIXO #5, rodada 6] "(como nova)": `aresta_add` insere uma linha
      // nova (id novo, data de agora) — a RPC não aceita `criado_em`. A
      // frase diz isso em vez de fingir que a linha antiga voltou.
      concluirEscrita("relacao_desfazer_exclusao", selectDestinoRef.current, null, (t) =>
        mostrar(t),
      );
    },
    () => {
      // [MÉDIO #1 + BAIXO #5, rodada 5] falha do desfazer nunca é silenciosa.
      limparTimer();
      limpar(); // a notícia velha ("Excluída.") sai da região viva.
      setErroDesfazer("Não foi possível desfazer — a relação continua excluída.");
    },
  );

  const linhas = [
    ...saindo.map((e) => ({ aresta: e, direcao: "saindo" as const, outraPonta: e.destino })),
    ...entrando.map((e) => ({ aresta: e, direcao: "entrando" as const, outraPonta: e.origem })),
  ];

  /**
   * [MÉDIO #5, rodada 7] a porta única da confirmação: as DUAS transições
   * anunciam, e nenhuma delas depende de temporizador.
   */
  function mudarConfirmacao(id: string | null): void {
    const t = transicaoDeConfirmacao("relacao_excluir", confirmandoId, id);
    if (t.anuncio !== null) mostrar(t.anuncio);
    setConfirmandoId(t.confirmandoId);
  }

  function aoExcluirComSucesso(aresta: TaskEdge, indice: number): void {
    // (1) FOCO antes de a linha sair da árvore: a relação seguinte, ou o
    // seletor de destino do formulário quando era a última.
    limparTimer();
    setErroDesfazer(undefined);
    setConfirmandoId(null);
    concluirEscrita(
      "relacao_excluir",
      botoesExcluirRef.current.get(indice + 1),
      selectDestinoRef.current,
      (t) => mostrar(t, { persistente: true }),
      // [BAIXO #8, rodada 7] numa frase só — ver `notas-painel.tsx`.
      anuncioComDesfazerPerdido("relacao_excluir", excluida !== null),
    );
    // (2) janela de desfazer, com o payload que recria a MESMA aresta.
    setExcluida({
      origem: aresta.origem,
      destino: aresta.destino,
      tipo: aresta.tipo,
      peso: aresta.peso,
      criadoEm: aresta.createdAt,
    });
    timerRef.current = window.setTimeout(() => {
      setExcluida(null);
      limpar();
      if (
        typeof document !== "undefined" &&
        botaoDesfazerRef.current !== null &&
        document.activeElement === botaoDesfazerRef.current
      ) {
        selectDestinoRef.current?.focus();
      }
    }, JANELA_DESFAZER_MS);
  }

  function desfazerExclusao(): void {
    const decisao = decidirEscrita({
      pendente: desfazendo || desfazerEmVoo(),
      valido: excluida !== null,
    });
    if (decisao !== "gravar") {
      recusarEscrita("relacao_desfazer_exclusao", decisao, {
        anunciar: (t) => mostrar(t),
        alertar: setErroDesfazer,
      });
      return;
    }
    if (!excluida) return; // defensivo: `valido` acima já garante.
    const form = new FormData();
    form.set("origem", excluida.origem);
    form.set("destino", excluida.destino);
    form.set("tipo", excluida.tipo);
    form.set("peso", String(excluida.peso));
    // [MÉDIO #4, rodada 7] a data original volta junto (migration 0017) — a
    // lista de relações ordena por `created_at`, então a posição volta também.
    form.set("criado_em", excluida.criadoEm);
    dispararDesfazer(form);
  }

  return (
    <div className="space-y-3">
      {linhas.length === 0 ? (
        <p className="text-sm text-bone-400">Nenhuma relação ainda.</p>
      ) : (
        <ul className="space-y-2">
          {linhas.map((linha, indice) => (
            <LinhaAresta
              key={linha.aresta.id}
              aresta={linha.aresta}
              taskId={taskId}
              indice={indice}
              total={linhas.length}
              direcao={linha.direcao}
              rotuloOutraPonta={tituloPorId.get(linha.outraPonta) ?? linha.outraPonta}
              outraPontaId={linha.outraPonta}
              refDoBotao={(el) => {
                if (el) botoesExcluirRef.current.set(indice, el);
                else botoesExcluirRef.current.delete(indice);
              }}
              avisar={(t) => mostrar(t)}
              confirmando={confirmandoId === linha.aresta.id}
              aoConfirmar={mudarConfirmacao}
              aoExcluir={aoExcluirComSucesso}
            />
          ))}
        </ul>
      )}
      {/* [MÉDIO #3, rodada 5] região viva PERSISTENTE (nasce vazia no DOM). */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          mensagem || excluida
            ? "text-xs font-medium text-state-done"
            : "m-0 min-h-0 text-xs text-state-done"
        }
      >
        {mensagem ? `${mensagem} ` : ""}
        {excluida ? (
          <button
            ref={botaoDesfazerRef}
            type="button"
            onClick={desfazerExclusao}
            aria-busy={desfazendo ? true : undefined}
            aria-disabled={desfazendo ? true : undefined}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 underline underline-offset-2 hover:text-gold-300 ${
              desfazendo ? "opacity-50" : ""
            }`}
          >
            Desfazer
          </button>
        ) : (
          ""
        )}
      </p>
      <CampoErro mensagem={erroDesfazer} />
      <FormularioNovaAresta
        taskId={taskId}
        opcoesDestino={opcoesDestino}
        selectDestinoRef={selectDestinoRef}
        botaoAdicionarRef={botaoAdicionarRef}
      />
    </div>
  );
}

function LinhaAresta({
  aresta,
  taskId,
  indice,
  total,
  direcao,
  rotuloOutraPonta,
  outraPontaId,
  refDoBotao,
  avisar,
  confirmando,
  aoConfirmar,
  aoExcluir,
}: {
  aresta: TaskEdge;
  taskId: string;
  indice: number;
  /** Quantas relações a lista tem — o "de 2" do rótulo (MÉDIO #6). */
  total: number;
  direcao: "saindo" | "entrando";
  rotuloOutraPonta: string;
  outraPontaId: string;
  refDoBotao: (el: HTMLButtonElement | null) => void;
  /** A região viva do PAINEL — a linha some no sucesso, então não pode ter uma. */
  avisar: (texto: string) => void;
  /** [MÉDIO #5, rodada 7] a confirmação é do painel: uma linha por vez. */
  confirmando: boolean;
  aoConfirmar: (id: string | null) => void;
  aoExcluir: (aresta: TaskEdge, indice: number) => void;
}): JSX.Element {
  const { estado, pendente, disparar, emVooAgora } = useAcaoTarefa(arestaDelAction, () =>
    aoExcluir(aresta, indice),
  );

  function excluir(): void {
    const decisao = decidirEscrita({ pendente: pendente || emVooAgora() });
    if (decisao !== "gravar") {
      // [BAIXO #4, rodada 6] o 2º clique durante a gravação era engolido em
      // silêncio; agora a região viva do painel diz por que nada aconteceu.
      recusarEscrita("relacao_excluir", decisao, { anunciar: avisar, alertar: avisar });
      return;
    }
    if (!confirmando) {
      // [MÉDIO #5, rodada 7] sem `setTimeout` — e a entrada é anunciada.
      aoConfirmar(aresta.id);
      return;
    }
    aoConfirmar(null);
    const form = new FormData();
    form.set("id", aresta.id);
    form.set("task_id", taskId);
    disparar(form);
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-navy-700 bg-navy-850 p-3">
      <div className="min-w-0 flex-1">
        <span className="mr-2 rounded-full bg-navy-800 px-2 py-0.5 font-mono text-xs font-semibold text-gold-300">
          {ROTULO_TIPO[aresta.tipo]}
        </span>
        <span className="text-xs text-bone-400">{direcao === "saindo" ? "→" : "←"}</span>{" "}
        <Link
          href={`/tarefa/${outraPontaId}`}
          prefetch={false}
          // [BAIXO #6, rodada 6] alvo de toque de 44 px sem quebrar a linha.
          className="inline-flex min-h-[44px] items-center text-sm text-bone-100 underline-offset-2 hover:text-gold-300 hover:underline"
        >
          {rotuloOutraPonta}
        </Link>
        {aresta.tipo === "sinergia" ? (
          <span className="ml-2 font-mono text-xs text-bone-400">desconto {aresta.peso}</span>
        ) : null}
      </div>
      <button
        ref={refDoBotao}
        type="button"
        onClick={excluir}
        // [MÉDIO #5, rodada 7] Escape e a saída do foco cancelam — sem relógio.
        onKeyDown={(e) => {
          if (e.key === "Escape" && confirmando) {
            e.preventDefault();
            aoConfirmar(null);
          }
        }}
        onBlur={() => {
          if (confirmando) aoConfirmar(null);
        }}
        aria-busy={pendente ? true : undefined}
        aria-disabled={pendente ? true : undefined}
        // [MÉDIO #6, rodada 7] cada linha diz QUAL relação ela apaga.
        aria-label={rotuloDoBotaoDeExcluirRelacao(
          aresta.tipo,
          rotuloOutraPonta,
          indice,
          total,
          confirmando,
        )}
        className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md px-2 text-xs font-semibold ${
          pendente ? "opacity-50" : ""
        } ${
          confirmando
            ? "bg-state-blocked/12 text-state-blocked"
            : "text-bone-400 hover:bg-state-blocked/10 hover:text-state-blocked"
        }`}
      >
        {confirmando ? "confirmar exclusão?" : "excluir"}
      </button>
      <CampoErro mensagem={estado.erro} />
    </li>
  );
}

function FormularioNovaAresta({
  taskId,
  opcoesDestino,
  selectDestinoRef,
  botaoAdicionarRef,
}: {
  taskId: string;
  opcoesDestino: readonly OpcaoTarefaRelacao[];
  selectDestinoRef: MutableRefObject<HTMLSelectElement | null>;
  botaoAdicionarRef: MutableRefObject<HTMLButtonElement | null>;
}): JSX.Element {
  // [MÉDIO #3, rodada 4] começa VAZIO — antes, o `<select>` nascia com a
  // 1ª opção da lista já selecionada e o botão já `enabled`: um único clique
  // cego (sem escolher nada) criava uma aresta de verdade contra quem quer
  // que fosse a 1ª tarefa da lista, sem confirmação nem desfazer. A opção
  // vazia ("Escolha a tarefa…") abaixo é o que faz isso deixar de ser possível.
  const [destino, setDestino] = useState("");
  const [tipo, setTipo] = useState<EdgeTipo>("predecessor");
  const [peso, setPeso] = useState("0.5");
  // [MÉDIO #3] a aresta recém-criada — sustenta o "Desfazer" por 10s (ou até
  // a próxima criação/desfazimento, o que vier primeiro).
  const [criada, setCriada] = useState<{ id: string } | null>(null);
  /**
   * [BAIXO #8, rodada 7] A verdade sobre "já existe um Desfazer pendente" no
   * instante em que o `aoSucesso` roda (depois do `await`) — o estado lido
   * pela closure seria o do render em que ela nasceu.
   */
  const criadaRef = useRef<{ id: string } | null>(null);
  criadaRef.current = criada;
  // [MÉDIO #1, rodada 5] o desfazer que FALHA precisa dizer isso — em
  // português, `role="alert"`, ao lado do botão, que continua na tela.
  const [erroDesfazer, setErroDesfazer] = useState<string | undefined>(undefined);
  // A região viva DESTE formulário — "Relação criada." (persistente, enquanto
  // o Desfazer existe), "Relação desfeita.", "Aguarde…".
  const { mensagem, mostrar, limpar } = useMensagemSucesso();
  const botaoDesfazerRef = useRef<HTMLButtonElement | null>(null);
  // `number`, não `ReturnType<typeof window.setTimeout>` — mesma nota de
  // `mensagem-sucesso.tsx` (a CHAMADA resolve por sobrecarga para `number`,
  // mesmo o TIPO da propriedade discordando neste tsconfig).
  const desfazerTimeoutRef = useRef<number | null>(null);

  function limparDesfazer(): void {
    if (desfazerTimeoutRef.current !== null) window.clearTimeout(desfazerTimeoutRef.current);
    desfazerTimeoutRef.current = null;
  }

  useEffect(() => limparDesfazer, []);

  const { estado, pendente, disparar, emVooAgora } = useAcaoTarefa(
    arestaAddAction,
    (estadoSucesso) => {
    setDestino("");
    limparDesfazer();
    setErroDesfazer(undefined);
    // [ALTO #1, rodada 6] o `<select>` de destino é o campo que ficou vazio —
    // e o botão "Adicionar relação" era o que virava `disabled` no instante
    // do sucesso, mandando o foco para o `<body>`.
    //
    // O texto só fica PERMANENTE quando há um "Desfazer" para ele explicar
    // (o backend devolveu o id); sem isso ele se comporta como os demais
    // sucessos da página e some sozinho em 4 s.
    const temDesfazer = typeof estadoSucesso.id === "string" && estadoSucesso.id.length > 0;
    concluirEscrita(
      "relacao_criar",
      selectDestinoRef.current,
      botaoAdicionarRef.current,
      (t) => mostrar(t, { persistente: temDesfazer }),
      // [BAIXO #8, rodada 7] havia um "Desfazer" pendente da criação
      // anterior? Ele acabou de ser substituído, e some sem aviso — a frase
      // entra JUNTO com "Relação criada.", numa string só.
      anuncioComDesfazerPerdido("relacao_criar", criadaRef.current !== null),
    );
    // `id` só falta se o backend (RPC live) não devolver — degrada de forma
    // graciosa: a relação foi criada (a lista ao lado já mostra), só sem
    // "Desfazer" nesta resposta específica.
    if (estadoSucesso.id) {
      const idDaNova = estadoSucesso.id;
      setCriada({ id: idDaNova });
      desfazerTimeoutRef.current = window.setTimeout(() => {
        setCriada(null);
        limpar();
        if (
          typeof document !== "undefined" &&
          botaoDesfazerRef.current !== null &&
          document.activeElement === botaoDesfazerRef.current
        ) {
          focarComAlternativa(botaoAdicionarRef.current, selectDestinoRef.current);
        }
      }, JANELA_DESFAZER_MS);
    }
    },
  );

  /**
   * [MÉDIO #1, rodada 5] O desfazer usa o MESMO hook — com `aoFalha`. Antes,
   * `useAcaoTarefa(arestaDelAction, () => setCriada(null))` descartava o
   * `estado` inteiro: a chamada podia falhar (rede caída, RPC recusando) e a
   * tela seguia mostrando "Relação criada. Desfazer" como se nada tivesse
   * acontecido — o operador clicava, nada mudava, e nada explicava.
   *  - sucesso: some a mensagem, o foco vai para "Adicionar relação" (o botão
   *    "Desfazer" sai do DOM — MÉDIO #2);
   *  - falha: frase em português em `role="alert"` ao lado do botão, que
   *    CONTINUA disponível para nova tentativa; a contagem "Relações (N)" do
   *    cabeçalho segue refletindo o banco (a relação continua lá — e é isso
   *    que a frase diz).
   */
  const {
    pendente: desfazendo,
    disparar: dispararDesfazer,
    emVooAgora: desfazerEmVoo,
  } = useAcaoTarefa(
    arestaDelAction,
    () => {
      limparDesfazer();
      setErroDesfazer(undefined);
      // O "Desfazer" some agora: entrega o foco ao botão "Adicionar relação"
      // — e, se ele não aceitar (nó já fora da árvore), ao `<select>` de
      // destino, o primeiro controle do mesmo formulário. Nunca ao `<body>`.
      concluirEscrita(
        "relacao_desfazer_criacao",
        botaoAdicionarRef.current,
        selectDestinoRef.current,
        (t) => mostrar(t),
      );
      setCriada(null);
    },
    () => {
      limparDesfazer(); // não esconde o botão: o operador ainda vai querer tentar.
      limpar(); // a notícia velha ("Relação criada.") sai da região viva.
      setErroDesfazer("Não foi possível desfazer — a relação continua.");
    },
  );

  /**
   * [ALTO #2, rodada 7] o erro velho do servidor não engole mais a recusa
   * nova — a mesma porta dos outros 3 formulários.
   */
  const campo = useCampoDeErro(estado);
  const podeEnviar = destino !== "";

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    // [MÉDIO #3, rodada 4] a guarda que impede a aresta cega: sem destino
    // escolhido, NADA é criado — a regressão da rodada 4 (um clique criava
    // aresta contra a 1ª tarefa da lista) não volta. O que mudou na rodada 6
    // é que a recusa agora FALA, em vez de um botão cinza que não responde.
    const decisao = decidirEscrita({
      pendente: pendente || emVooAgora(),
      valido: podeEnviar,
    });
    if (decisao !== "gravar") {
      recusarEscrita("relacao_criar", decisao, {
        anunciar: (t) => mostrar(t),
        alertar: campo.avisar,
      });
      return;
    }
    campo.aoMudarCampo();
    limparDesfazer();
    setCriada(null);
    setErroDesfazer(undefined);
    const form = new FormData();
    form.set("origem", taskId);
    form.set("destino", destino);
    form.set("tipo", tipo);
    if (tipo === "sinergia") form.set("peso", peso);
    disparar(form);
  }

  function desfazer(): void {
    const decisao = decidirEscrita({
      pendente: desfazendo || desfazerEmVoo(),
      valido: criada !== null,
    });
    if (decisao !== "gravar") {
      recusarEscrita("relacao_desfazer_criacao", decisao, {
        anunciar: (t) => mostrar(t),
        alertar: setErroDesfazer,
      });
      return;
    }
    if (!criada) return; // defensivo: `valido` acima já garante.
    const form = new FormData();
    form.set("id", criada.id);
    form.set("task_id", taskId);
    dispararDesfazer(form);
  }

  if (opcoesDestino.length === 0) {
    return <p className="text-xs text-bone-400">Não há outra tarefa para relacionar.</p>;
  }

  return (
    // [ALTO #4, crítico 13/09] mesmo ajuste — o desconto (`peso`) tem
    // min/max/step nativos que disparariam validação em inglês do Chrome.
    //
    // [BAIXO #11, crítico 13/09, rodada 2] "Tipo de relação" vinha DEPOIS do
    // botão "Adicionar relação" no DOM e na tela — quem navega por Tab (ou lê
    // de cima para baixo) topava com o botão antes de escolher o tipo. Agora
    // a ordem é a do preenchimento: destino → tipo → (desconto, só sinergia)
    // → botão.
    <form onSubmit={aoEnviar} noValidate className="space-y-2">
      <label className="flex flex-col gap-1 text-xs font-semibold text-bone-300">
        Destino
        <select
          ref={selectDestinoRef}
          value={destino}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setDestino(e.target.value);
            campo.aoMudarCampo();
          }}
          className="min-h-[44px] w-56 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        >
          <option value="">Escolha a tarefa…</option>
          {opcoesDestino.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <ControleSegmentado
        rotuloGrupo="Tipo de relação"
        opcoes={OPCOES_TIPO}
        valorAtual={tipo}
        aoMudar={setTipo}
        desabilitado={pendente}
      />
      <div className="flex flex-wrap items-end gap-2">
        {tipo === "sinergia" ? (
          <label className="flex flex-col gap-1 text-xs font-semibold text-bone-300">
            Desconto (0–1)
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              className="min-h-[44px] w-24 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
            />
          </label>
        ) : null}
        <button
          ref={botaoAdicionarRef}
          type="submit"
          // [ALTO #1, rodada 6] SEM `disabled` — nem por validade. Um botão
          // que vira `disabled` no instante do sucesso (o destino volta a "")
          // é desfocado pelo navegador, e o foco cai no `<body>`: foi assim
          // que esta operação falhou a medição das 3 criações. A guarda
          // continua em `aoEnviar` (nenhuma aresta cega), e agora ela fala.
          //
          // [MÉDIO #3, rodada 7] `aria-disabled` por VALIDADE anunciava
          // "indisponível" e travava o clique da tecnologia assistiva; agora
          // ele só existe enquanto a gravação está em curso, e a exigência é
          // o texto abaixo, ligado por `aria-describedby`.
          aria-busy={pendente ? true : undefined}
          aria-disabled={pendente ? true : undefined}
          aria-describedby={!podeEnviar ? "dica-nova-relacao" : undefined}
          className={`inline-flex min-h-[44px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm font-semibold text-bone-100 hover:border-gold-600 ${
            pendente ? "opacity-50" : ""
          }`}
        >
          Adicionar relação
        </button>
      </div>
      {!podeEnviar ? (
        <p id="dica-nova-relacao" className="text-xs text-bone-400">
          {MENSAGEM_INVALIDO.relacao_criar}
        </p>
      ) : null}
      <CampoErro mensagem={campo.mensagem} />
      {/* [MÉDIO #3, rodada 5] região viva PERSISTENTE do formulário: nasce
          vazia no DOM e recebe o texto por troca de conteúdo.
          [MÉDIO #1, rodada 5] depois de um desfazer que FALHOU, a notícia
          velha ("Relação criada.") é apagada por `limpar()`: o que o operador
          precisa ler é o alerta abaixo e o botão para tentar de novo. */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          mensagem || criada
            ? "text-xs font-medium text-state-done"
            : "m-0 min-h-0 text-xs text-state-done"
        }
      >
        {mensagem ? `${mensagem} ` : ""}
        {criada ? (
          <button
            ref={botaoDesfazerRef}
            type="button"
            onClick={desfazer}
            aria-busy={desfazendo ? true : undefined}
            aria-disabled={desfazendo ? true : undefined}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 underline underline-offset-2 hover:text-gold-300 ${
              desfazendo ? "opacity-50" : ""
            }`}
          >
            Desfazer
          </button>
        ) : (
          ""
        )}
      </p>
      <CampoErro mensagem={erroDesfazer} />
    </form>
  );
}
