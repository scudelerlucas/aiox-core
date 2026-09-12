/**
 * PAINEL DE ASSUNTOS — a função que monta o quadro. PURA: nada de rede, nada de
 * `Date.now()` escondido (o `now` entra por parâmetro), nada de aleatório.
 *
 * Um "assunto" é um cartão. As fontes se juntam assim:
 *   • conversas que trabalham na MESMA branch → UM cartão (várias conversas =
 *     vários links "abrir conversa"), com as mudanças daquela branch anexadas;
 *   • mudanças sem conversa → um cartão por branch do repositório;
 *   • trabalho commitado sem mudança aberta e sem conversa → cartão só dele.
 *
 * Duas regras que o volume real (825 mudanças / 324 branches / 215 conversas)
 * ensinou, e que valem mais que qualquer preferência de layout:
 *   1. o DESFECHO da mudança vence o estado da conversa — o que entrou na versão
 *      oficial está fechado, mesmo que a conversa ainda se declare "pronta";
 *   2. as colunas vivas mostram só os últimos 21 dias; o resto vai para o bloco
 *      recolhido "mais antigos", senão "Parado" viraria um depósito de 273 itens.
 */

import { FUSO, dataCurta, maisRecente, ms, tempoRelativo } from "@/lib/frentes/tempo";
import type {
  Assunto,
  AvisoFonte,
  BranchSemPr,
  Coluna,
  ColunaId,
  CorConta,
  Frescor,
  LinkAssunto,
  Pr,
  QuadroAssuntos,
  Sessao,
  Sync,
} from "@/lib/frentes/types";

const HORA = 3_600_000;
const DIA = 24 * HORA;

/** Janela das colunas vivas (esperando · andando · parado). */
export const JANELA_ATIVA_DIAS = 21;
/** Janela da coluna que fechou: a semana. O resto vive no histórico. */
export const JANELA_FECHADO_DIAS = 7;
/** Teto de cartões visíveis por coluna antes do "mostrar mais". */
export const TETO_VISIVEL = 25;
/** Quantos links de mudança um cartão mostra antes de resumir o resto. */
export const TETO_LINKS = 3;
/** Quantos cartões nascem abertos por coluna: 6 no desktop, 4 no celular. */
export const PRIMEIRO_PAINT_DESKTOP = 6;
export const PRIMEIRO_PAINT_CELULAR = 4;
/** A partir daqui, trabalho commitado sem mudança aberta conta como parado. */
const PARADO_BRANCH_DIAS = 7;
/** A partir daqui, mudança aberta sem novidade conta como parada. */
const PARADO_PR_DIAS = 14;
/** A partir daqui, conversa "sem movimento" conta como parada. */
const PARADO_SESSAO_DIAS = 7;
/** Leitura do GitHub mais velha que isto acende o aviso. */
const AVISO_GITHUB_HORAS = 26;
/** Leitura das conversas de uma conta mais velha que isto acende o aviso. */
const AVISO_SESSOES_HORAS = 48;

/** Os três nomes do mesmo desfecho: conversa encerrada. */
export const ENCERRADAS = new Set(["done", "completed", "archived"]);
/** Conversa que está esperando o operador. */
const ESPERANDO_OPERADOR = new Set(["review_ready", "blocked", "need_input"]);
/**
 * Branches que aparecem em todo repositório: não servem para juntar assuntos
 * (juntariam tudo com tudo).
 */
const BRANCHES_GENERICAS = new Set([
  "main",
  "master",
  "develop",
  "dev",
  "head",
  "staging",
  "production",
  "prod",
]);

// ─── contas ──────────────────────────────────────────────────────────────────

const CONTAS: Record<string, { rotulo: string; cor: CorConta }> = {
  "lucasscudeler@gmail.com": { rotulo: "Lucas", cor: "lucas" },
  "lsgpandora@gmail.com": { rotulo: "Pandora", cor: "pandora" },
  "almapetra.ltda@gmail.com": { rotulo: "Alma Petra", cor: "almapetra" },
};

/** As três contas da casa, na ordem em que aparecem nos filtros. */
export const CONTAS_CONHECIDAS = ["Lucas", "Pandora", "Alma Petra"];

/** Rótulo curto da conta; e-mail desconhecido vira a parte antes do "@". */
export function rotuloDaConta(email: string | null | undefined): {
  rotulo: string;
  cor: CorConta;
} {
  if (!email) return { rotulo: "sem conta", cor: "neutra" };
  const chave = email.trim().toLowerCase();
  const conhecida = CONTAS[chave];
  if (conhecida) return conhecida;
  const local = chave.split("@")[0] ?? chave;
  return { rotulo: local, cor: "neutra" };
}

// ─── texto e datas ───────────────────────────────────────────────────────────

const PREFIXO_COMMIT =
  /^(feat|fix|docs|chore|refactor|test|tests|style|perf|build|ci|revert|wip)(\([^)]*\))?!?:\s*/i;

/** Tira prefixos de commit ("docs(x): ", "feat!: ") e põe a 1ª letra maiúscula. */
export function limparTitulo(bruto: string | null | undefined): string {
  if (!bruto) return "";
  const primeiraLinha = bruto.split("\n")[0] ?? "";
  let texto = primeiraLinha.trim();
  for (let i = 0; i < 3; i += 1) {
    const limpo = texto.replace(PREFIXO_COMMIT, "");
    if (limpo === texto) break;
    texto = limpo.trim();
  }
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
}

/** Nome curto do repositório: o que vem depois da barra. */
export function repoCurto(repo: string | null | undefined): string | null {
  if (!repo) return null;
  const partes = repo.split("/");
  return partes[partes.length - 1] ?? repo;
}

// Tempo e datas vêm de `@/lib/frentes/tempo` (uma só implementação, reexportada
// aqui porque a tela e os testes já importam daqui).
export { FUSO, dataCurta, maisRecente, ms, tempoRelativo };

/** Os testes automáticos, em palavras de gente. */
function textoDosTestes(checks: Pr["checks"]): string | null {
  if (checks === "verde") return "testes ok";
  if (checks === "vermelho") return "testes com erro";
  if (checks === "pendente") return "testes rodando";
  return null;
}

const TEXTO_ESTADO: Record<string, string> = {
  working: "em andamento",
  review_ready: "pronto para o Lucas aprovar",
  blocked: "travado, esperando o Lucas",
  need_input: "esperando uma resposta do Lucas",
  idle: "sem movimento",
  done: "concluído",
  completed: "concluído",
  archived: "concluído",
};

// ─── juntar as fontes ────────────────────────────────────────────────────────

interface Grupo {
  sessoes: Sessao[];
  prs: Pr[];
  branch: BranchSemPr | null;
  branches: Set<string>;
}

/** Branch que serve para juntar assuntos (ignora `main` e companhia). */
function branchUtil(nome: string | null | undefined): boolean {
  if (!nome) return false;
  return !BRANCHES_GENERICAS.has(nome.trim().toLowerCase());
}

const chavePr = (p: Pr): string => `${p.repo}#${p.numero}`;
const chaveBranch = (b: BranchSemPr): string => `${b.repo}@@${b.branch}`;

/**
 * Agrupa conversas, mudanças e trabalho commitado em cartões, sem duplicar e
 * sem perder nada. Usa índices por branch — roda em tempo linear mesmo com
 * centenas de linhas de cada tabela.
 */
function agrupar(prs: Pr[], branches: BranchSemPr[], sessoes: Sessao[]): Grupo[] {
  const prsPorBranch = new Map<string, Pr[]>();
  for (const p of prs) {
    if (!branchUtil(p.branch)) continue;
    const lista = prsPorBranch.get(p.branch) ?? [];
    lista.push(p);
    prsPorBranch.set(p.branch, lista);
  }

  const branchesPorNome = new Map<string, BranchSemPr[]>();
  for (const b of branches) {
    if (!branchUtil(b.branch)) continue;
    const lista = branchesPorNome.get(b.branch) ?? [];
    lista.push(b);
    branchesPorNome.set(b.branch, lista);
  }

  const grupos: Grupo[] = [];
  const grupoPorBranch = new Map<string, Grupo>();

  // Conversas primeiro, da mais recente para a mais antiga: a primeira de cada
  // grupo é a que dá nome e conta ao cartão.
  const ordenadas = [...sessoes].sort(
    (a, b) =>
      ms(b.atualizado_em ?? b.criado_em) - ms(a.atualizado_em ?? a.criado_em),
  );

  for (const sessao of ordenadas) {
    const brs = (sessao.branches ?? []).filter(branchUtil);
    if (brs.length === 0) {
      grupos.push({ sessoes: [sessao], prs: [], branch: null, branches: new Set() });
      continue;
    }
    let grupo: Grupo | null = null;
    for (const b of brs) {
      const achado = grupoPorBranch.get(b);
      if (achado) {
        grupo = achado;
        break;
      }
    }
    if (!grupo) {
      grupo = { sessoes: [], prs: [], branch: null, branches: new Set() };
      grupos.push(grupo);
    }
    grupo.sessoes.push(sessao);
    for (const b of brs) {
      grupo.branches.add(b);
      grupoPorBranch.set(b, grupo);
    }
  }

  // Mudanças e trabalho commitado das branches de cada conversa.
  const prUsado = new Set<string>();
  const branchUsada = new Set<string>();
  for (const grupo of grupos) {
    for (const nome of grupo.branches) {
      for (const p of prsPorBranch.get(nome) ?? []) {
        const chave = chavePr(p);
        if (prUsado.has(chave)) continue;
        prUsado.add(chave);
        grupo.prs.push(p);
      }
      for (const b of branchesPorNome.get(nome) ?? []) {
        const chave = chaveBranch(b);
        if (branchUsada.has(chave)) continue;
        branchUsada.add(chave);
        grupo.branch = grupo.branch ?? b;
      }
    }
  }

  // Mudanças órfãs: um cartão por branch de cada repositório.
  const porRepoBranch = new Map<string, Grupo>();
  for (const p of prs) {
    const chave = chavePr(p);
    if (prUsado.has(chave)) continue;
    prUsado.add(chave);
    // Branch genérica (ou vazia) não identifica assunto: a chave passa a ser o
    // número da mudança, senão todo o `main` do repositório viraria um cartão.
    const id = branchUtil(p.branch)
      ? `${p.repo}@@${p.branch}`
      : `${p.repo}@@pr:${p.numero}`;
    let grupo = porRepoBranch.get(id);
    if (!grupo) {
      grupo = { sessoes: [], prs: [], branch: null, branches: new Set([p.branch]) };
      porRepoBranch.set(id, grupo);
      grupos.push(grupo);
    }
    grupo.prs.push(p);
  }

  // Trabalho commitado que ainda não virou mudança nenhuma.
  for (const b of branches) {
    const chave = chaveBranch(b);
    if (branchUsada.has(chave)) continue;
    // Se já existe mudança nessa branch do mesmo repositório, o cartão dela conta a história.
    if (b.tem_pr) continue;
    const jaTem = branchUtil(b.branch)
      ? porRepoBranch.get(`${b.repo}@@${b.branch}`)
      : undefined;
    if (jaTem) {
      jaTem.branch = jaTem.branch ?? b;
      branchUsada.add(chave);
      continue;
    }
    branchUsada.add(chave);
    grupos.push({ sessoes: [], prs: [], branch: b, branches: new Set([b.branch]) });
  }

  return grupos;
}

// ─── coluna de cada cartão ───────────────────────────────────────────────────

/** A mudança que representa o assunto: a aberta mais recente; se não há, a última. */
function mudancaPrincipal(prs: Pr[]): Pr | null {
  if (prs.length === 0) return null;
  const peso = (p: Pr): number =>
    ms(maisRecente(p.atualizado_em, p.mergeado_em, p.fechado_em));
  const abertas = prs.filter((p) => p.estado === "aberto");
  const pool = abertas.length > 0 ? abertas : prs;
  return [...pool].sort((a, b) => peso(b) - peso(a))[0] ?? null;
}

function decidirColuna(
  grupo: Grupo,
  principal: Pr | null,
  sessao: Sessao | null,
  now: number,
): ColunaId {
  // (a) O DESFECHO DA MUDANÇA VENCE. Nada que entrou na versão oficial ou foi
  // descartado fica "esperando o Lucas", diga a conversa o que disser.
  if (principal && principal.estado !== "aberto") return "fechado";

  const estado = sessao?.estado ?? null;

  // (b) Só então o estado da conversa.
  if (estado && ENCERRADAS.has(estado) && !principal) return "fechado";
  if (estado && ESPERANDO_OPERADOR.has(estado)) return "esperando";
  if (estado === "working") return "andando";

  if (principal) {
    if (principal.rascunho) return "andando";
    if (principal.checks === "verde") return "esperando";
    const parado = now - ms(principal.atualizado_em) > PARADO_PR_DIAS * DIA;
    return parado ? "parado" : "andando";
  }

  if (grupo.branch && !grupo.branch.tem_pr) {
    const velho = now - ms(grupo.branch.ultimo_commit_em) > PARADO_BRANCH_DIAS * DIA;
    return velho ? "parado" : "andando";
  }

  if (estado === "idle") {
    const velho =
      now - ms(sessao?.atualizado_em ?? sessao?.criado_em) > PARADO_SESSAO_DIAS * DIA;
    return velho ? "parado" : "andando";
  }

  if (estado && ENCERRADAS.has(estado)) return "fechado";

  return "andando";
}

// ─── frase de situação ───────────────────────────────────────────────────────

function montarSituacao(
  grupo: Grupo,
  principal: Pr | null,
  sessao: Sessao | null,
  coluna: ColunaId,
): { situacao: string; desfecho: string | null } {
  // Assunto encerrado: só o desfecho. Nunca "entrou na versão oficial · pronto
  // para o Lucas aprovar" (contradição que o volume real produziu 148 vezes).
  if (coluna === "fechado") {
    if (principal?.estado === "mergeado") {
      return {
        desfecho: "entrou na versão oficial",
        situacao: `entrou na versão oficial em ${dataCurta(principal.mergeado_em ?? principal.atualizado_em)}`,
      };
    }
    if (principal?.estado === "fechado") {
      return {
        desfecho: "descartado",
        situacao: `descartado em ${dataCurta(principal.fechado_em ?? principal.atualizado_em)}`,
      };
    }
    const quando = dataCurta(sessao?.atualizado_em ?? null);
    return {
      desfecho: "concluído",
      situacao: quando ? `concluído em ${quando}` : "concluído",
    };
  }

  const partes: string[] = [];
  if (principal) {
    const testes = textoDosTestes(principal.checks);
    if (testes) partes.push(testes);
    if (principal.rascunho) partes.push("rascunho");
  }
  const estado = sessao?.estado ?? null;
  if (estado) {
    // Conversa que se declara encerrada mas cujo assunto segue vivo NÃO escreve
    // "concluído" numa coluna viva — era a contradição que vazava para a tela.
    const encerradaForaDeLugar = ENCERRADAS.has(estado);
    const texto = encerradaForaDeLugar ? undefined : TEXTO_ESTADO[estado];
    if (texto) partes.push(texto);
  }
  if (grupo.sessoes.length === 0) partes.push("sem conversa ligada");

  let finais = partes.slice(0, 3);

  // Na coluna de espera, o que ele precisa fazer vem PRIMEIRO e nunca é cortado.
  // O texto do estado sai: "você olhar e aprovar" já diz o que "pronto para o
  // Lucas aprovar" diria, e repetir só gasta a linha.
  const precisa = sessao?.precisa_de?.trim();
  if (coluna === "esperando") {
    const doEstado = estado && !ENCERRADAS.has(estado) ? TEXTO_ESTADO[estado] : undefined;
    // Sem `precisa_de`, a própria tela diz o que fazer: ninguém deve adivinhar
    // por que um cartão está na coluna "Esperando o Lucas".
    const pedido =
      precisa ||
      (principal?.estado === "aberto" && principal.checks === "verde"
        ? "você olhar e aprovar"
        : null);
    if (pedido) {
      finais = [
        pedido,
        ...partes.filter((p) => p !== pedido && p !== doEstado).slice(0, 2),
      ];
    }
  }

  if (finais.length === 0) finais = ["sem novidade"];
  return { situacao: finais.join(" · "), desfecho: null };
}

// ─── montagem de um cartão ───────────────────────────────────────────────────

function montarAssunto(grupo: Grupo, now: number): Assunto {
  const sessao = grupo.sessoes[0] ?? null;
  const principal = mudancaPrincipal(grupo.prs);

  const coluna = decidirColuna(grupo, principal, sessao, now);
  const { situacao, desfecho } = montarSituacao(grupo, principal, sessao, coluna);

  const titulo =
    limparTitulo(sessao?.titulo) ||
    limparTitulo(principal?.titulo) ||
    limparTitulo(grupo.branch?.ultimo_commit_msg) ||
    grupo.branch?.branch ||
    [...grupo.branches][0] ||
    "assunto sem nome";

  const repo = repoCurto(
    principal?.repo ?? grupo.branch?.repo ?? sessao?.repos?.[0] ?? null,
  );

  // Sem conversa, a etiqueta é o repositório em cinza — "conta não identificada"
  // não informa nada e aparecia em 295 dos cartões reais.
  const daConta = sessao ? rotuloDaConta(sessao.conta) : null;
  const etiqueta = daConta ? daConta.rotulo : (repo ?? "sem repositório");
  const corConta: CorConta = daConta ? daConta.cor : "neutra";

  // Quando o assunto FECHOU (não quando alguém mexeu nele depois): é isto que
  // decide a coluna "Fechou esta semana" e a data do histórico.
  // Precedência, não máximo: a data do fecho é `mergeado_em`, senão `fechado_em`,
  // senão a última mexida. Pegar o MAIOR dos três ressuscitava mudança mergeada
  // há 20 dias que alguém comentou ontem.
  const fechadoEm =
    coluna !== "fechado"
      ? null
      : principal && principal.estado !== "aberto"
        ? (principal.mergeado_em ?? principal.fechado_em ?? principal.atualizado_em)
        : (sessao?.atualizado_em ?? sessao?.criado_em ?? null);

  const atividadeEm = maisRecente(
    sessao?.atualizado_em ?? sessao?.criado_em,
    ...grupo.prs.map((p) => maisRecente(p.atualizado_em, p.mergeado_em, p.fechado_em)),
    grupo.branch?.ultimo_commit_em,
  );

  const links: LinkAssunto[] = [];
  grupo.sessoes.forEach((s, indice) => {
    if (!s.url) return;
    links.push({
      rotulo: indice === 0 ? "abrir conversa" : `abrir conversa (${indice + 1})`,
      url: s.url,
    });
  });
  // Mudanças: no máximo TETO_LINKS links, e nunca o número cru da mudança —
  // "#4821" não diz nada a quem não vive no GitHub.
  const mudancasOrdenadas = [...grupo.prs]
    .filter((p) => p.url)
    .sort((a, b) => ms(b.atualizado_em) - ms(a.atualizado_em));
  const mostradas = mudancasOrdenadas.slice(0, TETO_LINKS);
  mostradas.forEach((p, indice) => {
    links.push({
      rotulo:
        mudancasOrdenadas.length > 1 ? `mudança ${indice + 1}` : "ver no GitHub",
      url: p.url,
    });
  });
  const sobraram = mudancasOrdenadas.length - mostradas.length;
  if (sobraram > 0) {
    const referencia = mostradas[0];
    links.push({
      rotulo: `e outras ${sobraram} mudanças no GitHub`,
      // Leva para a lista de mudanças daquela branch, não para uma delas.
      url: referencia
        ? `https://github.com/${referencia.repo}/pulls?q=${encodeURIComponent(
            `is:pr head:${referencia.branch}`,
          )}`
        : "",
    });
  }

  const id = sessao
    ? `conversa:${sessao.sessao_id}`
    : principal
      ? `mudanca:${principal.repo}#${principal.numero}`
      : `trabalho:${grupo.branch?.repo}@${grupo.branch?.branch}`;

  const busca = [
    titulo,
    etiqueta,
    repo ?? "",
    situacao,
    [...grupo.branches].join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return {
    id,
    titulo,
    fechadoEm,
    etiqueta,
    corConta,
    contaFiltro: daConta ? daConta.rotulo : null,
    repo,
    atividadeEm,
    atividadeTexto: tempoRelativo(atividadeEm, now),
    situacao,
    coluna,
    desfecho,
    links,
    busca,
  };
}

// ─── frescor dos dados ───────────────────────────────────────────────────────

function montarFrescor(
  sync: Sync[],
  prs: Pr[],
  branches: BranchSemPr[],
  now: number,
): Frescor {
  const ultimaOk = new Map<string, string>();
  for (const linha of sync) {
    if (!linha.ok) continue;
    const atual = ultimaOk.get(linha.fonte);
    if (!atual || ms(linha.executado_em) > ms(atual)) {
      ultimaOk.set(linha.fonte, linha.executado_em);
    }
  }

  let maisNova: string | null = null;
  for (const iso of ultimaOk.values()) maisNova = maisRecente(maisNova, iso);

  // Segunda fonte de frescor do GitHub: o `sincronizado_em` das próprias linhas.
  // Enquanto a leitura do GitHub não registra em `painel_frentes_sync`, é ELE que
  // conta — dizer "nunca lidas" com 823 mudanças na tabela seria falso.
  let carimboDasLinhas: string | null = null;
  for (const p of prs) carimboDasLinhas = maisRecente(carimboDasLinhas, p.sincronizado_em);
  for (const b of branches) {
    carimboDasLinhas = maisRecente(carimboDasLinhas, b.sincronizado_em);
  }
  maisNova = maisRecente(maisNova, carimboDasLinhas);

  const avisos: AvisoFonte[] = [];
  const github = ultimaOk.get("github") ?? carimboDasLinhas;
  if (!github) {
    // Só é "nunca lida" quando não há mudança nenhuma para ter sido lida.
    if (prs.length === 0) {
      avisos.push({
        texto:
          "Os dados podem estar velhos: as mudanças no código ainda não foram lidas nenhuma vez.",
        conta: null,
      });
    }
  } else if (now - ms(github) > AVISO_GITHUB_HORAS * HORA) {
    avisos.push({
      texto: `Os dados podem estar velhos: as mudanças no código não atualizam desde ${dataCurta(github)}.`,
      conta: null,
    });
  }

  // Conta conhecida que nunca apareceu em `painel_frentes_sync` NÃO é dado velho:
  // é dado que ainda não chegou. Sai do bloco âmbar e vira uma linha cinza, que
  // desaparece sozinha no dia em que aquela conta publicar.
  const contasLidas = new Set<string>();
  for (const fonte of ultimaOk.keys()) {
    if (!fonte.startsWith("sessoes:")) continue;
    contasLidas.add(rotuloDaConta(fonte.slice("sessoes:".length)).rotulo);
  }
  const contasSemLeitura = CONTAS_CONHECIDAS.filter((c) => !contasLidas.has(c));

  for (const [fonte, iso] of ultimaOk) {
    if (!fonte.startsWith("sessoes:")) continue;
    if (now - ms(iso) <= AVISO_SESSOES_HORAS * HORA) continue;
    const { rotulo } = rotuloDaConta(fonte.slice("sessoes:".length));
    avisos.push({
      texto: `Os dados podem estar velhos: as conversas da conta ${rotulo} não atualizam desde ${dataCurta(iso)}.`,
      conta: rotulo,
    });
  }

  return {
    atualizadoTexto: maisNova ? tempoRelativo(maisNova, now) : null,
    // Houve leitura se alguma fonte registrou OU se as linhas têm carimbo.
    temLeituraOk: ultimaOk.size > 0 || carimboDasLinhas !== null,
    avisos,
    contasSemLeitura,
  };
}

// ─── a função pública ────────────────────────────────────────────────────────

const NOMES: Record<ColunaId, { nome: string; vazio: string }> = {
  esperando: { nome: "Esperando o Lucas", vazio: "Nada esperando o Lucas 🎉" },
  andando: { nome: "Andando", vazio: "Nada andando agora." },
  parado: { nome: "Parado", vazio: "Nada parado — tudo em movimento." },
  fechado: { nome: "Fechou esta semana", vazio: "Nada fechou esta semana." },
};

const ORDEM: ColunaId[] = ["esperando", "andando", "parado", "fechado"];

/**
 * Monta o quadro. `now` é o instante de referência (ms) — injetado para o
 * resultado ser sempre o mesmo em teste e no servidor.
 */
export function composeAssuntos(
  prs: Pr[],
  branches: BranchSemPr[],
  sessoes: Sessao[],
  sync: Sync[],
  now: number,
): QuadroAssuntos {
  const assuntos = agrupar(prs, branches, sessoes).map((g) => montarAssunto(g, now));

  const colunas: Coluna[] = ORDEM.map((id) => {
    const janela = (id === "fechado" ? JANELA_FECHADO_DIAS : JANELA_ATIVA_DIAS) * DIA;
    // A coluna que fechou se mede pela data do fecho; as vivas, pela atividade.
    const quando = (a: Assunto): number =>
      id === "fechado" ? ms(a.fechadoEm ?? a.atividadeEm) : ms(a.atividadeEm);
    const daColuna = assuntos
      .filter((a) => a.coluna === id)
      .sort((a, b) => quando(b) - quando(a));
    const dentro = daColuna.filter((a) => now - quando(a) <= janela);
    // Na coluna que fechou, o que é mais velho que a semana vive no histórico.
    const fora = id === "fechado" ? [] : daColuna.filter((a) => now - quando(a) > janela);
    return {
      id,
      nome: NOMES[id].nome,
      vazio: NOMES[id].vazio,
      assuntos: dentro,
      antigos: fora,
    };
  });

  const historico = assuntos
    .filter((a) => a.coluna === "fechado")
    .sort((a, b) => ms(b.fechadoEm ?? b.atividadeEm) - ms(a.fechadoEm ?? a.atividadeEm));

  // Filtro de conta: só as contas de verdade (3 conhecidas primeiro).
  const ORDEM_CONTAS = CONTAS_CONHECIDAS;
  const contas = Array.from(
    new Set(assuntos.map((a) => a.contaFiltro).filter((c): c is string => c !== null)),
  ).sort((a, b) => {
    const ia = ORDEM_CONTAS.indexOf(a);
    const ib = ORDEM_CONTAS.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b, "pt-BR");
  });

  return {
    colunas,
    historico,
    frescor: montarFrescor(sync, prs, branches, now),
    contas,
    totalAssuntos: assuntos.length,
  };
}
