/**
 * PAINEL DE ASSUNTOS — tipos das quatro tabelas de origem e do modelo do quadro.
 *
 * As linhas cruas (`Pr`, `BranchSemPr`, `Sessao`, `Sync`) usam os MESMOS nomes de
 * coluna do Supabase (snake_case) de propósito: assim o repositório live não
 * precisa renomear nada e nenhum campo se perde numa tradução silenciosa. Os
 * campos que a tela NÃO usa são opcionais — é o que permite pedir ao banco só as
 * colunas necessárias (nunca `select("*")`).
 *
 * O modelo do quadro (`Assunto`, `Coluna`, `QuadroAssuntos`) já está em palavras
 * de gente: quem lê a tela nunca vê "PR", "branch", "merge" ou "draft".
 */

// ─── Linhas cruas (espelho das tabelas) ──────────────────────────────────────

/** Estado de uma mudança no código. */
export type EstadoPr = "aberto" | "mergeado" | "fechado";

/** Resultado dos testes automáticos de uma mudança. */
export type Checks = "verde" | "vermelho" | "pendente" | null;

/** `painel_frentes_prs` — uma mudança no código, aberta ou já encerrada. */
export interface Pr {
  repo: string;
  numero: number;
  titulo: string;
  estado: EstadoPr;
  rascunho: boolean;
  branch: string;
  url: string;
  atualizado_em: string;
  fechado_em: string | null;
  mergeado_em: string | null;
  checks: Checks;
  // Colunas que existem na tabela mas a tela não precisa ler:
  base?: string;
  autor?: string;
  criado_em?: string;
  sessao_ids?: string[] | null;
  labels?: string[] | null;
  sincronizado_em?: string | null;
}

/** `painel_frentes_branches` — trabalho commitado que pode ainda não ter mudança aberta. */
export interface BranchSemPr {
  repo: string;
  branch: string;
  ultimo_commit_em: string | null;
  ultimo_commit_msg: string | null;
  tem_pr: boolean;
  sessao_ids?: string[] | null;
  sincronizado_em?: string | null;
}

/**
 * Estados possíveis de uma conversa. `done`, `completed` e `archived` são o
 * MESMO desfecho (o publicador de sessões usa os três) — ver `ENCERRADAS`.
 */
export type EstadoSessao =
  | "working"
  | "review_ready"
  | "blocked"
  | "need_input"
  | "idle"
  | "done"
  | "completed"
  | "archived"
  | (string & {});

/** `painel_frentes_sessoes` — uma conversa do Claude. */
export interface Sessao {
  sessao_id: string;
  conta: string;
  titulo: string | null;
  estado: EstadoSessao;
  estado_detalhe: string | null;
  precisa_de: string | null;
  branches: string[] | null;
  repos: string[] | null;
  url: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  custo_usd?: number | null;
  publicado_em?: string | null;
}

/** `painel_frentes_sync` — quando cada fonte de dados foi lida pela última vez. */
export interface Sync {
  fonte: string;
  executado_em: string;
  ok: boolean;
  itens?: number | null;
  erro?: string | null;
}

/** O pacote inteiro, do jeito que o repositório entrega. */
export interface DadosFrentes {
  prs: Pr[];
  branches: BranchSemPr[];
  sessoes: Sessao[];
  sync: Sync[];
}

// ─── Modelo do quadro (o que a tela mostra) ──────────────────────────────────

/** As quatro colunas, na ordem em que aparecem. */
export type ColunaId = "esperando" | "andando" | "parado" | "fechado";

/** Chave de cor da etiqueta — 3 contas conhecidas + cinza (repositório). */
export type CorConta = "lucas" | "pandora" | "almapetra" | "neutra";

/** Um link do cartão, já com o texto que a pessoa lê. */
export interface LinkAssunto {
  rotulo: string;
  url: string;
}

/** Um cartão do quadro: um assunto. */
export interface Assunto {
  /** Identificador estável, usado como `key` na lista. */
  id: string;
  titulo: string;
  /** Texto da etiqueta: nome da conta ou, quando não há conversa, o repositório. */
  etiqueta: string;
  corConta: CorConta;
  /** Conta de verdade (para o filtro); null quando o assunto não tem conversa. */
  contaFiltro: string | null;
  /** Nome curto do repositório (depois da barra) — null quando não se aplica. */
  repo: string | null;
  /** Momento da última atividade (ISO) — base da ordenação e das janelas vivas. */
  atividadeEm: string | null;
  /** Quando o assunto FECHOU (ISO); null enquanto está vivo. */
  fechadoEm: string | null;
  /** "há 3 dias", "há 2 h" — já pronto para a tela. */
  atividadeTexto: string;
  /** Situação em palavras simples. */
  situacao: string;
  coluna: ColunaId;
  /** Para o histórico: "entrou na versão oficial", "descartado", "concluído". */
  desfecho: string | null;
  links: LinkAssunto[];
  /** Texto minúsculo concatenado, só para a busca da tela. */
  busca: string;
}

/** Uma coluna do quadro, com o que a tela precisa para o cabeçalho. */
export interface Coluna {
  id: ColunaId;
  nome: string;
  /** Frase do estado vazio, em português. */
  vazio: string;
  /** Assuntos dentro da janela ativa (21 dias; 7 dias na coluna que fechou). */
  assuntos: Assunto[];
  /** Assuntos fora da janela — vão no bloco recolhido "mais antigos". */
  antigos: Assunto[];
}

/** Um aviso de fonte velha, com a conta a que ele se refere (null = GitHub). */
export interface AvisoFonte {
  texto: string;
  conta: string | null;
}

/** Frescor dos dados + os avisos quando algo está velho. */
export interface Frescor {
  /** "há 2 h" da leitura mais recente que deu certo; null se não houver nenhuma. */
  atualizadoTexto: string | null;
  /** Houve alguma leitura bem-sucedida? Sem isso, vazio não é motivo de festa. */
  temLeituraOk: boolean;
  /** Só dado VELHO de verdade (prefixo "Os dados podem estar velhos:"). */
  avisos: AvisoFonte[];
  /** Contas conhecidas que ainda não publicaram leitura nenhuma. */
  contasSemLeitura: string[];
}

/** O modelo completo devolvido por `composeAssuntos`. */
export interface QuadroAssuntos {
  colunas: Coluna[];
  /** Todos os assuntos encerrados, mais novos primeiro (sem corte de janela). */
  historico: Assunto[];
  frescor: Frescor;
  /** Contas presentes nas conversas, para os filtros. */
  contas: string[];
  /** Quantos cartões existem no total (soma das colunas + encerrados antigos). */
  totalAssuntos: number;
}
