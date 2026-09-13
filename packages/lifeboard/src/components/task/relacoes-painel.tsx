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
import { focar, focarComAlternativa } from "@/components/task/foco";
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
  const timerRef = useRef<number | null>(null);

  function limparTimer(): void {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  useEffect(() => limparTimer, []);

  const { pendente: desfazendo, disparar: dispararDesfazer } = useAcaoTarefa(
    arestaAddAction,
    () => {
      limparTimer();
      setErroDesfazer(undefined);
      setExcluida(null);
      focar(selectDestinoRef.current);
    },
    () => {
      // [MÉDIO #1 + BAIXO #5, rodada 5] falha do desfazer nunca é silenciosa.
      limparTimer();
      setErroDesfazer("Não foi possível desfazer — a relação continua excluída.");
    },
  );

  const linhas = [
    ...saindo.map((e) => ({ aresta: e, direcao: "saindo" as const, outraPonta: e.destino })),
    ...entrando.map((e) => ({ aresta: e, direcao: "entrando" as const, outraPonta: e.origem })),
  ];

  function aoExcluirComSucesso(aresta: TaskEdge, indice: number): void {
    // (1) FOCO antes de a linha sair da árvore: a relação seguinte, ou o
    // seletor de destino do formulário quando era a última.
    const seguinte = botoesExcluirRef.current.get(indice + 1);
    if (seguinte) focar(seguinte);
    else focar(selectDestinoRef.current);
    // (2) janela de desfazer, com o payload que recria a MESMA aresta.
    limparTimer();
    setErroDesfazer(undefined);
    setExcluida({
      origem: aresta.origem,
      destino: aresta.destino,
      tipo: aresta.tipo,
      peso: aresta.peso,
    });
    timerRef.current = window.setTimeout(() => {
      setExcluida(null);
      if (
        typeof document !== "undefined" &&
        botaoDesfazerRef.current !== null &&
        document.activeElement === botaoDesfazerRef.current
      ) {
        focar(selectDestinoRef.current);
      }
    }, JANELA_DESFAZER_MS);
  }

  function desfazerExclusao(): void {
    if (!excluida || desfazendo) return;
    const form = new FormData();
    form.set("origem", excluida.origem);
    form.set("destino", excluida.destino);
    form.set("tipo", excluida.tipo);
    form.set("peso", String(excluida.peso));
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
              direcao={linha.direcao}
              rotuloOutraPonta={tituloPorId.get(linha.outraPonta) ?? linha.outraPonta}
              outraPontaId={linha.outraPonta}
              refDoBotao={(el) => {
                if (el) botoesExcluirRef.current.set(indice, el);
                else botoesExcluirRef.current.delete(indice);
              }}
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
          excluida ? "text-xs font-medium text-state-done" : "m-0 min-h-0 text-xs text-state-done"
        }
      >
        {excluida ? (
          <>
            {erroDesfazer ? "" : "Excluída. "}
            <button
              ref={botaoDesfazerRef}
              type="button"
              onClick={desfazerExclusao}
              aria-busy={desfazendo ? true : undefined}
              aria-disabled={desfazendo ? true : undefined}
              className={`underline underline-offset-2 hover:text-gold-300 ${
                desfazendo ? "opacity-50" : ""
              }`}
            >
              Desfazer
            </button>
          </>
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
  direcao,
  rotuloOutraPonta,
  outraPontaId,
  refDoBotao,
  aoExcluir,
}: {
  aresta: TaskEdge;
  taskId: string;
  indice: number;
  direcao: "saindo" | "entrando";
  rotuloOutraPonta: string;
  outraPontaId: string;
  refDoBotao: (el: HTMLButtonElement | null) => void;
  aoExcluir: (aresta: TaskEdge, indice: number) => void;
}): JSX.Element {
  const { estado, pendente, disparar } = useAcaoTarefa(arestaDelAction, () =>
    aoExcluir(aresta, indice),
  );
  // [MÉDIO #20, crítico 13/09] excluir nota já pedia confirmação em 2 passos
  // (clique → "confirmar exclusão?" → clique de novo); excluir relação
  // apagava direto no 1º clique. Mesma disciplina agora nos dois.
  const [confirmando, setConfirmando] = useState(false);

  function excluir(): void {
    if (pendente) return; // [MÉDIO #2, rodada 5] 2º clique recusado sem `disabled`.
    if (!confirmando) {
      setConfirmando(true);
      window.setTimeout(() => setConfirmando(false), 3000);
      return;
    }
    setConfirmando(false);
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
          className="text-sm text-bone-100 underline-offset-2 hover:text-gold-300 hover:underline"
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
        aria-busy={pendente ? true : undefined}
        aria-disabled={pendente ? true : undefined}
        className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
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
  // [MÉDIO #1, rodada 5] o desfazer que FALHA precisa dizer isso — em
  // português, `role="alert"`, ao lado do botão, que continua na tela.
  const [erroDesfazer, setErroDesfazer] = useState<string | undefined>(undefined);
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

  const { estado, pendente, disparar } = useAcaoTarefa(arestaAddAction, (estadoSucesso) => {
    setDestino("");
    limparDesfazer();
    setErroDesfazer(undefined);
    // `id` só falta se o backend (RPC live) não devolver — degrada de forma
    // graciosa: a relação foi criada (a lista ao lado já mostra), só sem
    // "Desfazer" nesta resposta específica.
    if (estadoSucesso.id) {
      const idDaNova = estadoSucesso.id;
      setCriada({ id: idDaNova });
      desfazerTimeoutRef.current = window.setTimeout(() => {
        setCriada(null);
        if (
          typeof document !== "undefined" &&
          botaoDesfazerRef.current !== null &&
          document.activeElement === botaoDesfazerRef.current
        ) {
          focarComAlternativa(botaoAdicionarRef.current, selectDestinoRef.current);
        }
      }, JANELA_DESFAZER_MS);
    }
  });

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
  const { pendente: desfazendo, disparar: dispararDesfazer } = useAcaoTarefa(
    arestaDelAction,
    () => {
      limparDesfazer();
      setErroDesfazer(undefined);
      // O "Desfazer" some agora: entrega o foco ao botão "Adicionar relação"
      // — e, quando ele está `disabled` (nenhum destino escolhido, que é o
      // estado normal logo após um desfazer), ao `<select>` de destino, o
      // primeiro controle do mesmo formulário. Nunca ao `<body>`.
      focarComAlternativa(botaoAdicionarRef.current, selectDestinoRef.current);
      setCriada(null);
    },
    () => {
      limparDesfazer(); // não esconde o botão: o operador ainda vai querer tentar.
      setErroDesfazer("Não foi possível desfazer — a relação continua.");
    },
  );

  const podeEnviar = destino !== "";

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    // [MÉDIO #3] `noValidate` desliga a validação nativa do navegador — sem
    // esta guarda, um submit por outro caminho que não o clique no botão
    // (já `disabled` sem destino) ainda criaria a aresta com destino vazio.
    if (!podeEnviar) return;
    if (pendente) return; // [MÉDIO #2, rodada 5] duplo envio recusado sem `disabled`.
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
    if (!criada || desfazendo) return;
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
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setDestino(e.target.value)}
          className="w-56 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
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
              className="w-24 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
            />
          </label>
        ) : null}
        <button
          ref={botaoAdicionarRef}
          type="submit"
          // `disabled` SÓ pela validade (sem destino escolhido) — nunca pelo
          // `pendente` (MÉDIO #2, rodada 5).
          disabled={!podeEnviar}
          aria-busy={pendente ? true : undefined}
          aria-disabled={pendente || !podeEnviar ? true : undefined}
          className={`inline-flex min-h-[40px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm font-semibold text-bone-100 hover:border-gold-600 disabled:opacity-50 ${
            pendente ? "opacity-50" : ""
          }`}
        >
          Adicionar relação
        </button>
      </div>
      <CampoErro mensagem={estado.erro} />
      {/* [MÉDIO #3, rodada 5] região viva PERSISTENTE do formulário: nasce
          vazia no DOM e recebe o texto por troca de conteúdo. */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          criada ? "text-xs font-medium text-state-done" : "m-0 min-h-0 text-xs text-state-done"
        }
      >
        {criada ? (
          <>
            {/* [MÉDIO #1, rodada 5] depois de um desfazer que FALHOU, repetir
                "Relação criada." é dizer a notícia velha: o que o operador
                precisa ler é o alerta abaixo e o botão para tentar de novo. */}
            {erroDesfazer ? "" : "Relação criada. "}
            <button
              ref={botaoDesfazerRef}
              type="button"
              onClick={desfazer}
              aria-busy={desfazendo ? true : undefined}
              aria-disabled={desfazendo ? true : undefined}
              className={`underline underline-offset-2 hover:text-gold-300 ${
                desfazendo ? "opacity-50" : ""
              }`}
            >
              Desfazer
            </button>
          </>
        ) : (
          ""
        )}
      </p>
      <CampoErro mensagem={erroDesfazer} />
    </form>
  );
}
