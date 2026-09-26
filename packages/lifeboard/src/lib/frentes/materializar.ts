/**
 * FRENTES → TAREFAS — o que já está no banco (mudanças no código, branches e
 * conversas do Claude) vira tarefa ligada no grafo. PURA: nada de rede, nada de
 * `Date.now()` escondido (o `agora` entra por parâmetro), nada de aleatório.
 *
 * Por que existe (Tarefa Codex 01, decisão do Lucas em 25/09/2026): a aba
 * Assuntos já lia `painel_frentes_prs`, `painel_frentes_branches` e
 * `painel_frentes_sessoes`, mas o grafo só desenhava `tasks` — e `tasks` tinha
 * zero ligações. Nada aqui é fonte nova: é junção do que existe.
 *
 * Regras (do doc `docs/lifeboard/TAREFA-CODEX-01-frentes-para-tarefas.md`):
 *  • conversa NÃO encerrada e que se mexeu nos últimos `JANELA_SESSAO_DIAS` dias
 *    → 1 tarefa (`external_ref = sessao_id`);
 *  • mudança ABERTA → 1 tarefa (`external_ref = repo#numero`);
 *  • branch → 1 tarefa (`external_ref = repo:branch`) SÓ se tiver mudança aberta ou
 *    uma conversa que ENTROU ligada a ela.
 *
 *    Medido em produção em 26/09/2026, depois do 1º deploy: a regra do doc da
 *    tarefa ("tem `sessao_ids` OU commit em 30 dias") deixava entrar 285 das 339
 *    branches, porque quase toda branch carrega o id de uma conversa — viva ou
 *    morta há meses. Somadas às 210 conversas "não encerradas" dos últimos 90 dias,
 *    eram ~530 cartões e o grafo virou uma parede de linhas. A regra de agora
 *    (medida no mesmo banco): 74 conversas, ~78 branches, 33 mudanças;
 *  • arestas DECLARADAS a partir do dado, nunca inferidas por texto:
 *      conversa → branch  (`sessoes.branches` ∋ branch  ou  `branches.sessao_ids` ∋ conversa)
 *      branch   → mudança (`prs.branch = branch`, mesmo repositório)
 *      conversa → mudança (`prs.sessao_ids` ∋ conversa; omitida quando a mesma
 *                          ligação já existe passando pela branch)
 *    Sentido: quem produziu vem antes. Tipo `predecessor` — a única aresta que o
 *    CPM e o anti-ciclo enxergam. As três arestas só apontam "para a frente"
 *    (conversa → branch → mudança), então o resultado é acíclico por construção.
 *  • idempotente: os ids são determinísticos (`(fonte, external_ref)`), rodar 2×
 *    dá exatamente o mesmo resultado.
 *
 * As tarefas trazem as DUAS representações da precedência que o banco aceita —
 * `predecessorIds`/`successorIds` E `TaskEdge tipo=predecessor` — porque o
 * motor "hoje" (`dag.ts`) lê só os arrays e o grafo v3 lê as duas; quem une
 * (`caminho-critico`, `camadas-do-grafo`) já deduplica.
 */

import { deterministicId } from "@/adapters/id";
import {
  ENCERRADAS,
  JANELA_ATIVA_DIAS,
  TEXTO_ESTADO,
  branchUtil,
  limparTitulo,
  repoCurto,
  textoDosTestes,
} from "@/lib/frentes/compose";
import { maisRecente, ms } from "@/lib/frentes/tempo";
import type { BranchSemPr, DadosFrentes, Pr, Sessao, Sync } from "@/lib/frentes/types";
import {
  DEFAULT_HIERARQ,
  type SourceKind,
  type Task,
  type TaskEdge,
  type TaskStatus,
} from "@/types/canonical";

const DIA = 86_400_000;

/**
 * Conversa só vira tarefa se se mexeu nesta janela — a mesma das colunas vivas
 * do quadro Assuntos (`JANELA_ATIVA_DIAS`). Conversa "bloqueada" parada há dois
 * meses não é trabalho de hoje; ela continua no quadro Assuntos, em "mais antigos".
 */
export const JANELA_SESSAO_DIAS = JANELA_ATIVA_DIAS;

/** Fonte das mudanças e branches (kind registrado pela migration 0031). */
export const KIND_GITHUB: SourceKind = "github";
/** Fonte das conversas do Claude — o kind que o banco já tinha para chats. */
export const KIND_CONVERSA: SourceKind = "claude_chat";

export const ROTULO_GITHUB = "GitHub";
export const ROTULO_CONVERSA = "Conversas do Claude";

/** Uma fonte que as frentes precisam ter no painel (para filtro e frescor). */
export interface FonteMaterializada {
  kind: SourceKind;
  label: string;
  lastSyncAt: string | null;
}

/** O que sai da materialização: tarefas, arestas e as fontes que elas usam. */
export interface Materializacao {
  tasks: Task[];
  edges: TaskEdge[];
  fontes: FonteMaterializada[];
}

export interface OpcoesMaterializar {
  /** Instante de referência (ms). Injetado para o resultado ser reproduzível. */
  agora: number;
  /**
   * Como achar o id da fonte de um `kind`. Em produção, é o id da linha real de
   * `sources` quando ela existe; senão, o id determinístico de sempre.
   */
  idDaFonte?: (kind: SourceKind) => string;
}

// ─── ids e chaves ────────────────────────────────────────────────────────────

/** Mesma convenção dos adapters e do fixture: `deterministicId("source", kind)`. */
export function idDaFontePadrao(kind: SourceKind): string {
  return deterministicId("source", kind);
}

/** Id estável da tarefa: depende só de (fonte, external_ref). */
export function idDaTarefaFrente(kind: SourceKind, externalRef: string): string {
  return deterministicId("frentes-tarefa", `${kind}:${externalRef}`);
}

function idDaAresta(origem: string, destino: string): string {
  return deterministicId("frentes-aresta", `${origem}->${destino}`);
}

/** Projeto = a "pasta" do item: o repositório (GitHub) ou a conta (conversa). */
function idDoProjeto(chave: string): string {
  return deterministicId("frentes-projeto", chave);
}

export const refDaSessao = (s: Sessao): string => s.sessao_id;
export const refDoPr = (p: Pr): string => `${p.repo}#${p.numero}`;
export const refDaBranch = (b: BranchSemPr): string => `${b.repo}:${b.branch}`;

// ─── status ──────────────────────────────────────────────────────────────────

/**
 * Estado da conversa → status canônico. `blocked`/`need_input` é a conversa
 * esperando o Lucas (doc da tarefa); `review_ready` é pronta para ele aprovar,
 * portanto acionável; `working` é o agente ainda trabalhando.
 */
export function statusDaSessao(estado: Sessao["estado"]): TaskStatus {
  if (estado === "working") return "in_progress";
  if (estado === "blocked" || estado === "need_input") return "blocked";
  return "open";
}

/** Mudança aberta → status: testes vermelhos travam; rascunho/rodando andam. */
export function statusDoPr(p: Pr): TaskStatus {
  if (p.checks === "vermelho") return "blocked";
  if (p.rascunho || p.checks === "pendente") return "in_progress";
  return "open";
}

// ─── filtros ─────────────────────────────────────────────────────────────────

/** Conversa que conta: não encerrada E com movimento nos últimos `JANELA_SESSAO_DIAS` dias. */
export function sessaoEntra(s: Sessao, agora: number): boolean {
  if (ENCERRADAS.has(s.estado)) return false;
  const quando = ms(maisRecente(s.atualizado_em, s.criado_em));
  return quando > 0 && agora - quando <= JANELA_SESSAO_DIAS * DIA;
}

/** Só mudança aberta vira tarefa — o que fechou é histórico, não trabalho. */
export function prEntra(p: Pr): boolean {
  return p.estado === "aberto";
}

/**
 * A regra que evita afogar o grafo: branch só entra ligada a algo que ENTROU —
 * uma mudança aberta nela ou uma conversa viva que a produziu. `sessao_ids` com
 * conversa morta não conta, e commit recente sozinho também não: branch sem
 * ninguém vivo por trás é histórico, e mora no quadro Assuntos. Branch genérica
 * (`main` etc.) nunca entra.
 */
export function branchEntra(b: BranchSemPr, ligadaAAlgoVivo: boolean): boolean {
  return branchUtil(b.branch) && ligadaAAlgoVivo;
}

// ─── texto ───────────────────────────────────────────────────────────────────

/** Trecho curto do id da conversa, para quando ela não tem título. */
function sessaoCurta(sessaoId: string): string {
  const semPrefixo = sessaoId.replace(/^session_/, "");
  return semPrefixo.slice(0, 8);
}

function notas(linhas: (string | null | undefined)[]): string | null {
  const limpas = linhas.map((l) => l?.trim() ?? "").filter((l) => l.length > 0);
  return limpas.length > 0 ? limpas.join("\n") : null;
}

// ─── tarefas ─────────────────────────────────────────────────────────────────

interface Base {
  agora: number;
  idDaFonte: (kind: SourceKind) => string;
}

function tarefaBase(
  base: Base,
  kind: SourceKind,
  externalRef: string,
  projeto: string,
  campos: Pick<Task, "title" | "notes" | "status" | "updatedAt" | "iniciadoEm">,
): Task {
  return {
    id: idDaTarefaFrente(kind, externalRef),
    projectId: idDoProjeto(projeto),
    title: campos.title,
    notes: campos.notes,
    dueDate: null,
    status: campos.status,
    priorityHierarq: DEFAULT_HIERARQ,
    predecessorIds: [],
    successorIds: [],
    sourceId: base.idDaFonte(kind),
    externalRef,
    updatedAt: campos.updatedAt,
    estimativaDias: null,
    iniciadoEm: campos.iniciadoEm,
    parentId: null,
    isGoal: false,
    assimetria: null,
  };
}

function tarefaDaSessao(base: Base, s: Sessao): Task {
  const titulo = limparTitulo(s.titulo) || `Conversa ${sessaoCurta(s.sessao_id)}`;
  return tarefaBase(base, KIND_CONVERSA, refDaSessao(s), `conta:${s.conta}`, {
    title: titulo,
    notes: notas([TEXTO_ESTADO[s.estado], s.precisa_de, s.estado_detalhe, s.url]),
    status: statusDaSessao(s.estado),
    updatedAt:
      maisRecente(s.atualizado_em, s.criado_em) ?? new Date(base.agora).toISOString(),
    iniciadoEm: s.criado_em ?? null,
  });
}

function tarefaDoPr(base: Base, p: Pr): Task {
  const titulo = limparTitulo(p.titulo) || `${repoCurto(p.repo) ?? p.repo} #${p.numero}`;
  return tarefaBase(base, KIND_GITHUB, refDoPr(p), `repo:${p.repo}`, {
    title: titulo,
    notes: notas([
      `Mudança #${p.numero} em ${repoCurto(p.repo) ?? p.repo}${p.rascunho ? " (rascunho)" : ""}`,
      textoDosTestes(p.checks),
      p.url,
    ]),
    status: statusDoPr(p),
    updatedAt:
      maisRecente(p.atualizado_em, p.criado_em) ?? new Date(base.agora).toISOString(),
    iniciadoEm: p.criado_em ?? null,
  });
}

function tarefaDaBranch(base: Base, b: BranchSemPr, temMudancaAberta: boolean): Task {
  const titulo = limparTitulo(b.ultimo_commit_msg) || b.branch;
  return tarefaBase(base, KIND_GITHUB, refDaBranch(b), `repo:${b.repo}`, {
    title: titulo,
    notes: notas([
      `Branch ${b.branch} em ${repoCurto(b.repo) ?? b.repo}`,
      temMudancaAberta ? "já tem mudança aberta" : "ainda sem mudança aberta",
    ]),
    status: temMudancaAberta ? "in_progress" : "open",
    updatedAt: b.ultimo_commit_em ?? new Date(base.agora).toISOString(),
    iniciadoEm: null,
  });
}

// ─── fontes ──────────────────────────────────────────────────────────────────

/** Última leitura que deu certo, por fonte: GitHub × qualquer publicador de conversas. */
export function fontesDasFrentes(sync: Sync[]): FonteMaterializada[] {
  let github: string | null = null;
  let conversas: string | null = null;
  for (const linha of sync) {
    if (!linha.ok) continue;
    if (linha.fonte === "github") github = maisRecente(github, linha.executado_em);
    else conversas = maisRecente(conversas, linha.executado_em);
  }
  return [
    { kind: KIND_GITHUB, label: ROTULO_GITHUB, lastSyncAt: github },
    { kind: KIND_CONVERSA, label: ROTULO_CONVERSA, lastSyncAt: conversas },
  ];
}

// ─── a função pública ────────────────────────────────────────────────────────

/**
 * Materializa as frentes em tarefas + arestas. Determinística: mesma entrada e
 * mesmo `agora` ⇒ mesma saída, byte a byte.
 */
export function materializarFrentes(
  dados: DadosFrentes,
  opcoes: OpcoesMaterializar,
): Materializacao {
  const base: Base = {
    agora: opcoes.agora,
    idDaFonte: opcoes.idDaFonte ?? idDaFontePadrao,
  };

  // 1 · o que entra
  const sessoes = dados.sessoes.filter((s) => sessaoEntra(s, base.agora));
  const sessoesQueEntraram = new Set(sessoes.map((s) => s.sessao_id));
  const prs = dados.prs.filter((p) => prEntra(p) && p.repo && p.numero != null);

  const prsPorRepoBranch = new Map<string, Pr[]>();
  for (const p of prs) {
    if (!branchUtil(p.branch)) continue;
    const chave = `${p.repo}:${p.branch}`;
    const lista = prsPorRepoBranch.get(chave) ?? [];
    lista.push(p);
    prsPorRepoBranch.set(chave, lista);
  }

  // Branch citada por alguma conversa viva (nome; e repositório, se a conversa disser).
  const branchesDasSessoes = new Map<string, Set<string> | null>(); // nome → repos (null = qualquer)
  for (const s of sessoes) {
    for (const nome of s.branches ?? []) {
      if (!branchUtil(nome)) continue;
      const repos = s.repos && s.repos.length > 0 ? s.repos : null;
      const atual = branchesDasSessoes.get(nome);
      if (atual === null) continue; // já vale para qualquer repositório
      if (repos === null) branchesDasSessoes.set(nome, null);
      else {
        const conjunto = atual ?? new Set<string>();
        for (const r of repos) conjunto.add(r);
        branchesDasSessoes.set(nome, conjunto);
      }
    }
  }
  const citadaPorSessao = (b: BranchSemPr): boolean => {
    if (!branchesDasSessoes.has(b.branch)) return false;
    const repos = branchesDasSessoes.get(b.branch);
    return repos === null || repos === undefined || repos.has(b.repo);
  };

  // Uma linha por (repo, branch) — o repositório já une, mas custa nada garantir.
  const branchesUnicas = new Map<string, BranchSemPr>();
  for (const b of dados.branches) {
    const chave = `${b.repo}:${b.branch}`;
    const anterior = branchesUnicas.get(chave);
    if (!anterior || ms(b.ultimo_commit_em) > ms(anterior.ultimo_commit_em)) {
      branchesUnicas.set(chave, b);
    }
  }
  const branches = [...branchesUnicas.values()].filter((b) => {
    const temMudancaAberta = prsPorRepoBranch.has(`${b.repo}:${b.branch}`);
    const produzidaPorConversaViva = (b.sessao_ids ?? []).some((id) =>
      sessoesQueEntraram.has(id),
    );
    return branchEntra(b, temMudancaAberta || produzidaPorConversaViva || citadaPorSessao(b));
  });

  // 2 · tarefas
  const tasks = new Map<string, Task>();
  const idDaSessao = new Map<string, string>(); // sessao_id → task id
  for (const s of sessoes) {
    const t = tarefaDaSessao(base, s);
    if (tasks.has(t.id)) continue; // mesma conversa duas vezes na leitura
    tasks.set(t.id, t);
    idDaSessao.set(s.sessao_id, t.id);
  }
  const idDaBranch = new Map<string, string>(); // repo:branch → task id
  for (const b of branches) {
    const t = tarefaDaBranch(base, b, prsPorRepoBranch.has(`${b.repo}:${b.branch}`));
    tasks.set(t.id, t);
    idDaBranch.set(`${b.repo}:${b.branch}`, t.id);
  }
  const idDoPr = new Map<string, string>(); // repo#numero → task id
  for (const p of prs) {
    const t = tarefaDoPr(base, p);
    if (tasks.has(t.id)) continue;
    tasks.set(t.id, t);
    idDoPr.set(refDoPr(p), t.id);
  }

  // 3 · arestas — só entre tarefas que existem, sem repetir
  const arestas = new Map<string, { origem: string; destino: string; nota: string }>();
  const liga = (origem: string | undefined, destino: string | undefined, nota: string): void => {
    if (!origem || !destino || origem === destino) return;
    if (!tasks.has(origem) || !tasks.has(destino)) return;
    const chave = `${origem}->${destino}`;
    if (!arestas.has(chave)) arestas.set(chave, { origem, destino, nota });
  };

  // conversa → branch
  for (const b of branches) {
    const destino = idDaBranch.get(`${b.repo}:${b.branch}`);
    for (const sessaoId of b.sessao_ids ?? []) {
      liga(idDaSessao.get(sessaoId), destino, "a conversa produziu esta branch");
    }
    if (citadaPorSessao(b)) {
      for (const s of sessoes) {
        if (!(s.branches ?? []).includes(b.branch)) continue;
        if (s.repos && s.repos.length > 0 && !s.repos.includes(b.repo)) continue;
        liga(idDaSessao.get(s.sessao_id), destino, "a conversa produziu esta branch");
      }
    }
  }

  // branch → mudança
  for (const p of prs) {
    if (!branchUtil(p.branch)) continue;
    liga(
      idDaBranch.get(`${p.repo}:${p.branch}`),
      idDoPr.get(refDoPr(p)),
      "a branch virou esta mudança",
    );
  }

  // conversa → mudança (só quando não há caminho pela branch)
  for (const p of prs) {
    const destino = idDoPr.get(refDoPr(p));
    const viaBranch = branchUtil(p.branch) ? idDaBranch.get(`${p.repo}:${p.branch}`) : undefined;
    for (const sessaoId of p.sessao_ids ?? []) {
      const origem = idDaSessao.get(sessaoId);
      if (!origem || !destino) continue;
      const jaPassaPelaBranch =
        viaBranch !== undefined &&
        arestas.has(`${origem}->${viaBranch}`) &&
        arestas.has(`${viaBranch}->${destino}`);
      if (jaPassaPelaBranch) continue;
      liga(origem, destino, "a conversa produziu esta mudança");
    }
  }

  // 4 · as duas representações da precedência
  const criadoEm = new Date(base.agora).toISOString();
  const edges: TaskEdge[] = [];
  for (const { origem, destino, nota } of arestas.values()) {
    edges.push({
      id: idDaAresta(origem, destino),
      origem,
      destino,
      tipo: "predecessor",
      peso: 1,
      nota,
      createdAt: criadoEm,
    });
    const de = tasks.get(origem);
    const para = tasks.get(destino);
    if (de && !de.successorIds.includes(destino)) de.successorIds.push(destino);
    if (para && !para.predecessorIds.includes(origem)) para.predecessorIds.push(origem);
  }
  for (const t of tasks.values()) {
    t.predecessorIds.sort();
    t.successorIds.sort();
  }
  edges.sort((a, b) => a.id.localeCompare(b.id));

  return {
    tasks: [...tasks.values()],
    edges,
    fontes: fontesDasFrentes(dados.sync),
  };
}
