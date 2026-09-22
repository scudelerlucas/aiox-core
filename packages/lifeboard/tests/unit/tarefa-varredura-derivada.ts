import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * OS-LIFEBOARD · P6 — A SEGUNDA REDE (rodada 9, ALTO #1).
 *
 * A PRIMEIRA rede não é este arquivo: é a arquitetura. `escreverTarefaAction`
 * só aceita `PedidoDeEscrita`, cujo selo é um `unique symbol` ambiente e não
 * exportado (`src/app/tarefa/pedido.ts`); a única fábrica é privada de
 * `src/components/task/porta-de-escrita.ts`; e a porta não devolve despacho
 * cru — `escrever()` já decide, já recusa com frase, já anuncia e já entrega
 * o foco. Um handler que CITE a porta sem usá-la não tem o que despachar.
 *
 * Esta rede existe para o que a arquitetura não pode impedir sozinha: alguém
 * copiar a conversão de selo, importar a ação direto, abrir uma rota de API
 * que grave por fora, ou pôr um `"use server"` novo em outro canto. Ela lê o
 * `src/` INTEIRO — `app/api/**` incluído.
 *
 * Os 4 buracos de regex que o crítico nomeou na rodada 8, e o que mudou:
 *
 *  1. `temConcluir` era testado contra o ARQUIVO (`src`), não contra o bloco:
 *     "fiado" queria dizer só *este bloco cita a porta, e algum outro lugar do
 *     arquivo conclui aquela op*. Agora a `op` de um sítio sai do BLOCO da
 *     declaração da porta que ele usa — nunca de uma busca no arquivo
 *     (`opDoBloco`, e o teste `nenhuma resolução usa o arquivo inteiro`).
 *  2. `importamAction()` usava `.exec` e via só o 1º `import {}` do módulo —
 *     um 2º import do MESMO módulo passava batido (forma M2b). Agora é
 *     `matchAll`, e devolve TODOS.
 *  3. o filtro `x.endsWith("Action")` ignorava qualquer nome que não
 *     terminasse assim (forma M6). Não há mais filtro: todo nome importado é
 *     considerado, e `import * as X` também (forma M4b).
 *  4. rotas de API não eram varridas (forma M5). `arquivosDoSrc()` cobre
 *     `src/` inteiro.
 *
 * E as `EXCECOES` deixaram de isentar a checagem de escrita (forma R3b): elas
 * só dizem quem pode TOCAR a superfície de escrita, com nome e motivo — e
 * qualquer arquivo fora dessa lista que a toque aparece como violação.
 */

const RAIZ = fileURLToPath(new URL("../../src/", import.meta.url));

/** As duas árvores da página da tarefa — onde as portas vivem. */
export const PASTAS_VARRIDAS = ["components/task", "app/tarefa"] as const;

function arquivosDe(pasta: string): string[] {
  const achados: string[] = [];
  const pilha = [RAIZ + pasta];
  while (pilha.length > 0) {
    const atual = pilha.pop();
    if (atual === undefined) continue;
    for (const nome of readdirSync(atual)) {
      const caminho = `${atual}/${nome}`;
      if (statSync(caminho).isDirectory()) pilha.push(caminho);
      else if (nome.endsWith(".ts") || nome.endsWith(".tsx")) {
        achados.push(caminho.slice(RAIZ.length).replace(/^\/+/, ""));
      }
    }
  }
  return achados.sort();
}

/** Os arquivos da página da tarefa. */
export function arquivosVarridos(): string[] {
  return PASTAS_VARRIDAS.flatMap((p) => arquivosDe(p)).sort();
}

/** TODO o `src/` — é aqui que `app/api/**` entra (buraco 4). */
export function arquivosDoSrc(): string[] {
  return arquivosDe("").sort();
}

export function fonte(arquivo: string): string {
  return readFileSync(RAIZ + arquivo, "utf8");
}

/**
 * O código sem comentários e sem o MIOLO das strings de prosa — estes
 * arquivos explicam por escrito os achados que os originaram, e a história
 * não pode virar código aos olhos do scanner. As aspas ficam (para
 * `op: "nota_criar"` continuar reconhecível).
 */
export function codigo(arquivo: string): string {
  return fonte(arquivo)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, antes: string) => antes);
}

function linhaDe(src: string, i: number): number {
  return src.slice(0, i).split("\n").length;
}

/**
 * A partir do índice `i`, acha o primeiro `{` e devolve o bloco balanceado.
 * É o que permite dizer "a `op` DESTA porta", em vez de "o arquivo tem uma
 * `op` em algum lugar" — que era a checagem furada da rodada 8.
 */
export function blocoDepois(src: string, i: number): string {
  const inicio = src.indexOf("{", i);
  if (inicio === -1) return "";
  let nivel = 0;
  for (let p = inicio; p < src.length; p++) {
    const c = src[p];
    if (c === "{") nivel++;
    else if (c === "}") {
      nivel--;
      if (nivel === 0) return src.slice(inicio, p + 1);
    }
  }
  return src.slice(inicio);
}

/** A `op` declarada DENTRO de um bloco — nunca no arquivo inteiro (buraco 1). */
export function opDoBloco(bloco: string): string | null {
  return /\bop:\s*"([a-z_]+)"/.exec(bloco)?.[1] ?? null;
}

export interface PortaDeclarada {
  arquivo: string;
  linha: number;
  /** Onde a declaração começa, em caracteres — resolve nomes repetidos. */
  indice: number;
  /** O nome local da porta (`porta`, `portaDesfazer`, …). */
  nome: string;
  /** A `op` que o BLOCO da declaração traz. `null` = porta sem operação. */
  op: string | null;
  /** A porta declara para onde o foco vai no sucesso? */
  temAlvo: boolean;
}

export function portasDeclaradas(arquivo: string): PortaDeclarada[] {
  const src = codigo(arquivo);
  const out: PortaDeclarada[] = [];
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*usarPortaDeEscrita\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const bloco = blocoDepois(src, m.index + m[0].length - 1);
    out.push({
      arquivo,
      linha: linhaDe(src, m.index),
      indice: m.index,
      nome: m[1] ?? "",
      op: opDoBloco(bloco),
      temAlvo: /\balvo:\s*\S/.test(bloco),
    });
  }
  return out;
}

/** Quantas portas o arquivo abre — cada uma é uma escrita ligada. */
export function quantasPortas(src: string): number {
  return (src.match(/usarPortaDeEscrita\s*\(/g) ?? []).length;
}

export interface SitioDeEscrita {
  arquivo: string;
  linha: number;
  /** O receptor da chamada: `porta`, `portaDesfazer`… ou `""` quando é solto. */
  receptor: string;
  /** A `op` da porta que ele usa — resolvida pelo bloco DAQUELA porta. */
  op: string | null;
}

/**
 * Todo sítio de escrita da página, derivado do fonte: toda chamada de
 * `escrever(` — com ou sem receptor conhecido. Um `escrever(` cujo receptor
 * não seja uma porta declarada no mesmo arquivo é ÓRFÃO, e isso cobre o
 * buraco de "o identificador local não é o único jeito de chamar" (M3).
 */
export const ARQUIVO_DA_PORTA = "components/task/porta-de-escrita.ts";

export function varrer(): SitioDeEscrita[] {
  const sitios: SitioDeEscrita[] = [];
  for (const arquivo of arquivosVarridos()) {
    // A própria porta DEFINE `escrever` — ali não é sítio, é a maquinaria.
    // (E é o único arquivo dispensado: nenhum outro é isento de nada.)
    if (arquivo === ARQUIVO_DA_PORTA) continue;
    const src = codigo(arquivo);
    // Dois componentes do mesmo arquivo costumam chamar a porta de `porta`
    // (`FormularioNovaNota` e `NotaLinha`, por exemplo). A resolução é por
    // ESCOPO — a declaração daquele nome mais próxima ANTES da chamada —, não
    // por nome no arquivo: senão a última declaração venceria todas, que é a
    // mesma classe de furo do `temConcluir` contra `src` da rodada 8.
    const portas = portasDeclaradas(arquivo);
    const re = /\bescrever\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const indice = m.index;
      const antes = src.slice(Math.max(0, indice - 120), indice);
      // `escrever:` (chave de objeto) e `function escrever(` não são chamadas.
      if (/(function|:)\s*$/.test(antes)) continue;
      const receptor = /([A-Za-z_$][\w$]*)\s*\.\s*$/.exec(antes)?.[1] ?? "";
      const candidatas = portas.filter((p) => p.nome === receptor && p.indice < indice);
      const porta = candidatas[candidatas.length - 1];
      sitios.push({
        arquivo,
        linha: linhaDe(src, indice),
        receptor,
        op: porta?.op ?? null,
      });
    }
  }
  return sitios;
}

// ══════════════════════════ o ESTADO MARCADO ANTES DO VEREDITO (rodada 13) ═
/**
 * [CRÍTICO #1 e #2, rodada 13] O GÊMEO QUE FICOU PARA TRÁS.
 *
 * A rodada 10 corrigiu `status-form`, `mae-form` e `meta-form`: o ref da
 * TENTATIVA (o valor submetido, lido depois do `await` para escolher a frase e
 * para guardar o confirmado) só se escreve quando a porta ACEITA. O motivo,
 * nas palavras daquela correção: *"escrito antes, uma recusa sobrescrevia o
 * valor EM VOO e a gravação a caminho anunciava e confirmava o valor errado"*.
 *
 * `duracao-form` e `atomos-form` não receberam a correção, e nada avisou. Doze
 * rodadas depois o crítico mediu as duas consequências: a duração anunciando o
 * desfecho OPOSTO ao que gravou e travando em "nada mudou", e os átomos presos
 * num trio que o servidor nunca recebeu, com o score de prioridade calculado
 * com o esforço errado.
 *
 * Esta é a guarda mecânica que faltava, e ela é DERIVADA: percorre todo sítio
 * de escrita de `components/task/**`, acha a função que o contém e reprova
 * qualquer marca de estado — atribuição a `<algo>.current` ou chamada a um
 * `setAlgumaCoisa(...)` — que aconteça ANTES da chamada a `escrever(`. Um
 * formulário novo que marque antes nasce vermelho.
 *
 * O que continua permitido: marcar DEPOIS do veredito (`if (decisao ===
 * "gravar") ref.current = x`), marcar no corpo do componente (espelho de
 * estado em ref, que roda a cada render e não pertence a handler nenhum) e
 * marcar dentro de `aoSucesso`/`aoFalha`, que por definição já têm veredito.
 */
export interface MarcaAntesDoVeredito {
  arquivo: string;
  linha: number;
  /** O trecho que marca o estado (`valorEnviadoRef.current =`, `setTexto(`…). */
  marca: string;
  /** A chamada de escrita que vem DEPOIS dele, na mesma função. */
  escritaNaLinha: number;
}

/**
 * O início da FUNÇÃO que contém o índice `i` — não o do bloco mais interno.
 * Sobe de bloco em bloco até encontrar um `{` precedido de cabeçalho de função
 * (`… ) {`, `… ): Tipo {`, `… => {`). Sem isso, uma marca posta no corpo da
 * função e uma escrita dentro de um `if` ficariam em escopos diferentes e a
 * violação passaria.
 */
export function inicioDaFuncao(src: string, i: number): number {
  let p = i;
  for (let voltas = 0; voltas < 50; voltas++) {
    let nivel = 0;
    let abertura = -1;
    for (let q = p - 1; q >= 0; q--) {
      const c = src[q];
      if (c === "}") nivel++;
      else if (c === "{") {
        if (nivel === 0) {
          abertura = q;
          break;
        }
        nivel--;
      }
    }
    if (abertura === -1) return 0;
    const cabecalho = src.slice(Math.max(0, abertura - 160), abertura);
    if (/(\)\s*(:[^(){}=;]*)?|=>)\s*$/.test(cabecalho)) return abertura;
    p = abertura;
  }
  return 0;
}

export function marcasAntesDoVeredito(): MarcaAntesDoVeredito[] {
  const achados: MarcaAntesDoVeredito[] = [];
  const marcadores: [RegExp, string][] = [
    [/[A-Za-z_$][\w$]*\s*\.\s*current\s*=[^=]/g, ".current ="],
    [/\bset[A-Z][\w$]*\s*\(/g, "set…("],
  ];
  for (const arquivo of arquivosVarridos()) {
    if (arquivo === ARQUIVO_DA_PORTA) continue;
    const src = codigo(arquivo);
    for (const m of src.matchAll(/\bescrever\s*\(/g)) {
      const indice = m.index ?? 0;
      const antes = src.slice(Math.max(0, indice - 120), indice);
      if (/(function|:)\s*$/.test(antes)) continue;
      const inicio = inicioDaFuncao(src, indice);
      const corpo = src.slice(inicio, indice);
      for (const [re, rotulo] of marcadores) {
        for (const marca of corpo.matchAll(re)) {
          achados.push({
            arquivo,
            linha: linhaDe(src, inicio + (marca.index ?? 0)),
            marca: rotulo,
            escritaNaLinha: linhaDe(src, indice),
          });
        }
      }
    }
  }
  return achados;
}

// ══════════════════════════════════════ a SUPERFÍCIE de escrita do sistema ═
/**
 * Tudo que consegue mudar uma tarefa no servidor. Quem importa qualquer um
 * destes nomes está escrevendo — por rota de API, por Server Action nova, por
 * componente. A lista é curta de propósito: ela é a fronteira.
 */
export const MODULO_DO_FIXTURE_STORE = "@/lib/repositories/tasks.fixture-store";
const ARQUIVO_DO_FIXTURE_STORE = "lib/repositories/tasks.fixture-store.ts";

/**
 * ═══════════════════════════════════════════════════════ MÉDIO #6, rodada 13 ═
 * A SUPERFÍCIE DE ESCRITA DO STORE PASSA A SAIR DO CÓDIGO.
 *
 * A lista era escrita à mão e listava 10 dos 12 exports que mudam o store:
 * faltavam `resetarFixtureStore` e `definirPredecessorIdsFixture`. O crítico
 * abriu uma rota `POST /api/manutencao` de 11 linhas chamando
 * `resetarFixtureStore()` — `tsc` limpo, `eslint` limpo, 1441 verdes, e a rota
 * apagou as notas da tarefa. É exatamente o defeito que esta varredura diz ter
 * aposentado: *"foi assim que a rodada 8 consertou 4 e deixou 6"*.
 *
 * A derivação, em três passos, sobre o fonte do store:
 *  1. separar as funções do módulo (nome → corpo balanceado);
 *  2. marcar as que mudam a loja DIRETAMENTE — `.tasks`/`.edges`/`.notes` com
 *     `set`/`delete`/`clear`, o contador de ids, ou a troca do próprio store;
 *  3. propagar pelas chamadas: quem chama um mutador é mutador.
 *
 * O ACESSOR PREGUIÇOSO fica de fora do passo 2, e só dele: é a função que faz
 * `if (!g.__lifeboardFixtureStore) g.__lifeboardFixtureStore = estadoNovo()`,
 * reconhecida por esse formato e não pelo nome. Sem a ressalva, TODA leitura
 * viraria escrita (todas passam por ela) e `listarTasksFixture` — que a página
 * de prompts importa — apareceria como violação.
 */
export function funcoesDoModulo(arquivo: string): Map<string, string> {
  const src = codigo(arquivo);
  const out = new Map<string, string>();
  for (const m of src.matchAll(
    /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
  )) {
    out.set(m[1] ?? "", blocoDepois(src, (m.index ?? 0) + m[0].length));
  }
  return out;
}

/** Os três jeitos de mudar a loja neste módulo. */
const MUTACOES_DIRETAS: readonly RegExp[] = [
  /\.\s*(?:tasks|edges|notes)\s*\.\s*(?:set|delete|clear)\s*\(/,
  /\.\s*contador\s*(?:\+\+|--|[+\-*/]?=[^=])/,
  /__lifeboardFixtureStore\s*=[^=]/,
];

/** O acessor preguiçoso: cria a loja na primeira leitura. Não é escrita. */
function ehAcessorPreguicoso(corpo: string): boolean {
  return /if\s*\(\s*!\s*[A-Za-z_$][\w$]*\s*\.\s*__lifeboardFixtureStore\s*\)/.test(corpo);
}

export function escritoresDoFixtureStore(): string[] {
  const funcoes = funcoesDoModulo(ARQUIVO_DO_FIXTURE_STORE);
  const mutam = new Set<string>();
  for (const [nome, corpo] of funcoes) {
    if (ehAcessorPreguicoso(corpo)) continue;
    if (MUTACOES_DIRETAS.some((re) => re.test(corpo))) mutam.add(nome);
  }
  // Propagação por chamada, até o ponto fixo.
  for (let volta = 0; volta < funcoes.size + 1; volta++) {
    let mudou = false;
    for (const [nome, corpo] of funcoes) {
      if (mutam.has(nome)) continue;
      for (const chamado of mutam) {
        if (new RegExp(`\\b${chamado}\\s*\\(`).test(corpo)) {
          mutam.add(nome);
          mudou = true;
          break;
        }
      }
    }
    if (!mudou) break;
  }
  const exportados = new Set(exportsDeValor(ARQUIVO_DO_FIXTURE_STORE));
  return [...mutam].filter((n) => exportados.has(n)).sort();
}

/**
 * Tudo que consegue mudar uma tarefa no servidor. Quem importa qualquer um
 * destes nomes está escrevendo — por rota de API, por Server Action nova, por
 * componente. A lista é curta de propósito: ela é a fronteira. A entrada do
 * store do fixture é DERIVADA do código (MÉDIO #6, rodada 13).
 */
export function superficieDeEscrita(): Readonly<Record<string, readonly string[]>> {
  return {
    // [Achado MAIOR, CodeRabbit] `mutar` saiu daqui: `actions.ts` é `"use server"`
    // e todo export dele vira Server Action pública. Agora mora no despachante,
    // que não é `"use server"` — continua sendo superfície de escrita, mas não
    // é mais um endpoint na internet.
    "@/app/tarefa/actions": ["escreverTarefaAction"],
    "@/app/tarefa/despachante": ["mutar"],
    "@/lib/supabase/live-client": ["mutateLifeboard"],
    [MODULO_DO_FIXTURE_STORE]: escritoresDoFixtureStore(),
  };
}

/**
 * Quem pode tocar a superfície, e por quê. Diferente das `EXCECOES` da rodada
 * 8, esta lista NÃO isenta ninguém da checagem de escrita: ela é a própria
 * checagem — qualquer arquivo fora dela que importe a superfície é violação.
 */
export const PORTADORES: readonly { arquivo: string; motivo: string }[] = [
  {
    arquivo: "app/tarefa/actions.ts",
    motivo:
      "é o lado servidor da porta: valida em português e chama o despachante. Não tem componente, nem foco a entregar, nem região viva. Exporta APENAS escreverTarefaAction — é `\"use server\"`, então todo export seria um endpoint público.",
  },
  {
    arquivo: "app/tarefa/despachante.ts",
    motivo:
      "é o despachante live × fixture, fora da fronteira `\"use server\"` de propósito: exportado de actions.ts ele era uma Server Action pública que pulava a porta inteira (achado MAIOR do CodeRabbit).",
  },
  {
    arquivo: "components/task/porta-de-escrita.ts",
    motivo:
      "é a porta: o único lugar do src/ que produz um PedidoDeEscrita e o único que importa escreverTarefaAction. Decide, recusa, anuncia e entrega o foco.",
  },
];

export interface ImportacaoLida {
  modulo: string;
  /** Os nomes trazidos. `"*"` quando é `import * as X`. */
  nomes: string[];
}

/**
 * TODAS as importações de um fonte — `matchAll`, nunca `.exec` (buraco 2);
 * sem filtro por sufixo (buraco 3); `import * as X` incluído (forma M4b).
 */
export function importacoes(src: string): ImportacaoLida[] {
  const out: ImportacaoLida[] = [];
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const nomes = (m[1] ?? "")
      .split(",")
      .map((x) => x.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim() ?? "")
      .filter((x) => x.length > 0);
    out.push({ modulo: m[2] ?? "", nomes });
  }
  for (const m of src.matchAll(/import\s+\*\s+as\s+[A-Za-z_$][\w$]*\s*from\s*["']([^"']+)["']/g)) {
    out.push({ modulo: m[1] ?? "", nomes: ["*"] });
  }
  for (const m of src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*,?\s*from\s*["']([^"']+)["']/g)) {
    out.push({ modulo: m[2] ?? "", nomes: [m[1] ?? ""] });
  }
  return out;
}

export interface ToqueNaEscrita {
  arquivo: string;
  modulo: string;
  nomes: string[];
}

/** Quem, no `src/` inteiro, toca a superfície de escrita. */
export function tocamAEscrita(): ToqueNaEscrita[] {
  const out: ToqueNaEscrita[] = [];
  const superficie = superficieDeEscrita();
  for (const arquivo of arquivosDoSrc()) {
    const src = codigo(arquivo);
    for (const imp of importacoes(src)) {
      const proibidos = superficie[imp.modulo];
      if (proibidos === undefined) continue;
      // `import * as X` do módulo traz a superfície inteira junto.
      const nomes = imp.nomes.includes("*")
        ? [...proibidos]
        : imp.nomes.filter((n) => proibidos.includes(n));
      if (nomes.length > 0) out.push({ arquivo, modulo: imp.modulo, nomes });
    }
  }
  return out;
}

/** Arquivos do `src/` com a diretiva `"use server"` — uma Server Action nova. */
export function arquivosUseServer(): string[] {
  return arquivosDoSrc().filter((a) => /(^|\n)\s*["']use server["']\s*;?/.test(codigo(a)));
}

/** Onde a conversão de selo aparece — tem de ser um lugar só. */
export function convertemOSelo(): string[] {
  return arquivosDoSrc().filter((a) => /as\s+unknown\s+as\s+PedidoDeEscrita/.test(codigo(a)));
}

/** Trechos que alcançariam o servidor por fora da porta, na página da tarefa. */
export function rotasDeFuga(): { arquivo: string; linha: number; trecho: string }[] {
  const achados: { arquivo: string; linha: number; trecho: string }[] = [];
  const padroes: [RegExp, string][] = [
    // M5: uma chamada HTTP crua do cliente para uma rota que grave.
    [/\bfetch\s*\(/g, "fetch("],
    // M6: `<form action={...}>` entrega um FormData direto a uma Server Action.
    [/<form[^>]*\saction=\{/g, "<form action={"],
    [/\bformAction=\{/g, "formAction={"],
  ];
  for (const arquivo of arquivosVarridos()) {
    const src = codigo(arquivo);
    for (const [re, rotulo] of padroes) {
      for (const m of src.matchAll(re)) {
        achados.push({ arquivo, linha: linhaDe(src, m.index ?? 0), trecho: rotulo });
      }
    }
  }
  return achados;
}

/**
 * Todo `<CampoErro mensagem={X} />` da página, com o X literal.
 * [ALTO #2, rodada 9] A lista dos sítios não pode ser escrita à mão — foi
 * assim que a rodada 8 consertou 4 e deixou 6.
 */
export function camposDeErro(): { arquivo: string; linha: number; expressao: string }[] {
  const out: { arquivo: string; linha: number; expressao: string }[] = [];
  for (const arquivo of arquivosVarridos()) {
    const src = codigo(arquivo);
    for (const m of src.matchAll(/<CampoErro\s+mensagem=\{([^}]*)\}/g)) {
      out.push({ arquivo, linha: linhaDe(src, m.index ?? 0), expressao: (m[1] ?? "").trim() });
    }
  }
  return out;
}

/**
 * [MÉDIO #3, rodada 9] O handler que o painel liga em `aoConfirmarExecutado`,
 * DERIVADO do JSX — não de um nome escrito à mão aqui. É o caminho do 2º
 * clique, o que APAGA; ele tem de sair da confirmação em silêncio.
 */
export function handlerDaConfirmacaoExecutada(
  arquivo: string,
): { nome: string; corpo: string } | null {
  const src = codigo(arquivo);
  const nome = /aoConfirmarExecutado=\{([A-Za-z_$][\w$]*)\}/.exec(src)?.[1];
  if (nome === undefined) return null;
  const i = src.indexOf(`function ${nome}(`);
  if (i === -1) return null;
  return { nome, corpo: blocoDepois(src, i) };
}

/**
 * ═══════════════════════════════════════════════════════ ALTO A3, rodada 11 ═
 * O PERÍMETRO DO SELO TINHA UM ARQUIVO DE LARGURA.
 *
 * A tese da rodada 9 é "a porta é o transporte; `selar` é privada". O crítico
 * acrescentou TRÊS linhas a `porta-de-escrita.ts` —
 * `export function despacharCru(op, campos) { return escreverTarefaAction({}, selar(op, campos)); }`
 * — e qualquer componente ganhou escrita crua: sem trava, sem foco, sem
 * anúncio, sem `router.refresh()`, sem aviso de saída. `tsc` limpo,
 * 1350/1350 verdes.
 *
 * A varredura fazia whitelist dos exports de `actions.ts` (e por isso pegava
 * o buraco equivalente LÁ) e nunca conferia os exports do ÚNICO módulo que
 * consegue forjar o selo. Esta função é a mesma leitura, agora aplicável a
 * qualquer arquivo — `actions.ts` e a porta usam as duas a MESMA régua.
 *
 * Só exports de VALOR contam: `export type`/`export interface` somem na
 * compilação e não dão acesso a nada em runtime.
 */
export function exportsDeValor(arquivo: string): string[] {
  const src = codigo(arquivo)
    .replace(/export\s+type\s*\{[^}]*\}[^;]*;/g, "")
    .replace(/export\s+(?:type|interface)\s+\w+/g, "");
  const nomes: string[] = [];
  for (const m of src.matchAll(
    /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/g,
  )) {
    nomes.push(m[1] ?? "");
  }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const parte of (m[1] ?? "").split(",")) {
      const cru = parte.trim();
      if (cru.length === 0 || cru.startsWith("type ")) continue;
      nomes.push((cru.split(/\s+as\s+/).pop() ?? "").trim());
    }
  }
  return nomes.filter((n) => n.length > 0).sort();
}

/** `export default` e `export *` não nomeiam nada — e por isso escapam da lista acima. */
export function temExportAnonimo(arquivo: string): boolean {
  // A variável não se chama `src` de propósito: casar uma regex contra a
  // fonte inteira é a assinatura da regressão do buraco 1 (resolver a `op` de
  // um SÍTIO contra o arquivo todo), e um teste desta suíte vigia essa
  // string. Aqui o arquivo inteiro É o alvo legítimo — a pergunta é sobre os
  // exports DELE, não sobre um sítio dentro dele.
  const arquivoInteiro = codigo(arquivo);
  return /export\s+default/.test(arquivoInteiro) || /export\s*\*/.test(arquivoInteiro);
}

/**
 * [CRÍTICO, rodada 11] Todo `<input type="...">` dos componentes da tarefa.
 * `type="number"` é proibido: em `badInput` (`2e`, `1,5`, `--`) ele MOSTRA o
 * texto e reporta `value === ""`, e foi assim que a página apagou a duração
 * do operador dizendo "Duração salva.".
 */
export function tiposDeInput(): { arquivo: string; linha: number; tipo: string }[] {
  const achados: { arquivo: string; linha: number; tipo: string }[] = [];
  for (const arquivo of arquivosVarridos()) {
    const src = codigo(arquivo);
    for (const m of src.matchAll(/<input\b[^>]*?\btype=\{?["']([a-z]+)["']\}?/g)) {
      achados.push({ arquivo, linha: linhaDe(src, m.index ?? 0), tipo: m[1] ?? "" });
    }
  }
  return achados;
}

/**
 * ═══════════════════════════════════════════════════════ ALTO #3, rodada 13 ═
 * A SEGUNDA REDE PASSA A PROIBIR A FAMÍLIA, NÃO A GRAFIA.
 *
 * A rodada 12 proibia TRÊS escritas literais (`.type =`, `setAttribute(`,
 * `dangerouslySetInnerHTML`). O crítico passou por ela com três linhas:
 *
 *     const TECLADO_DO_CELULAR: Record<string, string> = { type: "number", step: "0.25" };
 *     <input ref={(el) => { if (el !== null) Object.assign(el, TECLADO_DO_CELULAR); }}
 *            type="text" inputMode="decimal" … />
 *
 * `tsc` limpo, `eslint` limpo, 1441/1441 verdes — inclusive as 6 asserções da
 * suíte que mede o elemento renderizado, porque `Object.assign` acontece no
 * NÓ, depois que o React já entregou a árvore. No Chromium, `input.type` virava
 * `number` e digitar `e` na duração 2 apagava o dado dizendo "Duração
 * removida.": o CRÍTICO das rodadas 10/11 inteiro, com os quatro portões
 * verdes.
 *
 * A pergunta certa não é "este texto aparece?", é **"este arquivo escreve num
 * nó de DOM?"**. Nestes arquivos a resposta tem de ser não: o que está na tela
 * tem de estar na árvore do React.
 *
 * Duas famílias, e as exceções DECLARADAS por propriedade — nunca por arquivo:
 *
 *  1. CHAMADAS que mexem em nó ou copiam propriedades em lote
 *     (`Object.assign`, `setAttribute`, `defineProperty`, `Reflect.set`,
 *     `innerHTML`, `appendChild`, `createElement`…). Não há uso legítimo de
 *     nenhuma delas nestes arquivos.
 *  2. ATRIBUIÇÕES a propriedade (`x.y = …`) e a propriedade CALCULADA
 *     (`x[k] = …`, que é como um apelido escapa de qualquer lista de nomes).
 *     Permitidas só três formas, e cada uma pelo motivo escrito:
 *       - `<algo>.current = …` — a caixa de ref do React, que não é um nó;
 *       - `<algo>Ref.current.value = …` — o `<select>` nativo que já trocou de
 *         valor sozinho e precisa voltar (`mae-form.tsx`); e SÓ em arquivo que
 *         não desenha `<input>`, que é derivado de `arquivosComInput()`: no
 *         campo de texto é justamente `value` que faria o programa e a caixa
 *         discordarem;
 *       - montar um objeto literal local (`const campos = {…}; campos.peso = …`),
 *         que é dado, não DOM — e a raiz tem de estar declarada como literal
 *         no mesmo arquivo.
 */
export interface EscritaNoDom {
  arquivo: string;
  linha: number;
  trecho: string;
}

/** As chamadas que escrevem em nó (ou copiam propriedades para dentro de um). */
export const CHAMADAS_QUE_ESCREVEM_NO_DOM: readonly [RegExp, string][] = [
  [/\bassign\s*\(/g, "assign("],
  [/\bdefinePropert(?:y|ies)\s*\(/g, "defineProperty("],
  [/\bsetPrototypeOf\s*\(/g, "setPrototypeOf("],
  [/\bReflect\s*\.\s*set\s*\(/g, "Reflect.set("],
  [/\bsetAttribute(?:NS|Node)?\s*\(/g, "setAttribute("],
  [/\bremoveAttribute(?:NS|Node)?\s*\(/g, "removeAttribute("],
  [/\bsetNamedItem\s*\(/g, "setNamedItem("],
  /*
   * [rodada 13, achado meu ao conferir a correção] PEGAR O NÓ DE ATRIBUTO
   * TAMBÉM É ESCRITA. A lista cobria `setNamedItem(` — a escrita direta — e
   * deixava passar o caminho de duas etapas: pegar o nó do atributo e gravar
   * no `.value` dele. Medido no Chromium, com os 1466 testes, `tsc` e
   * `eslint` limpos:
   *
   *   ref={(el) => { el.attributes.getNamedItem("type")!.value = "number"; }}
   *
   * deixa `input.type` = `number` no DOM, e o campo volta a apagar o que o
   * operador digita. Um nó de atributo só se pega para escrever nele — ler
   * atributo é `getAttribute(`, que continua livre.
   */
  [/\bgetNamedItem\s*\(/g, "getNamedItem("],
  [/\bgetAttributeNode(?:NS)?\s*\(/g, "getAttributeNode("],
  [/\.\s*attributes\b/g, ".attributes"],
  [/\bdangerouslySetInnerHTML\b/g, "dangerouslySetInnerHTML"],
  [/\b(?:inner|outer)HTML\b/g, "innerHTML"],
  [/\binsertAdjacent(?:HTML|Element|Text)\s*\(/g, "insertAdjacentHTML("],
  [/\b(?:appendChild|replaceChild|replaceChildren|replaceWith|insertBefore|prepend)\s*\(/g, "appendChild("],
  [/\bcloneNode\s*\(/g, "cloneNode("],
  [/\bcreateElement(?:NS)?\s*\(/g, "createElement("],
  [/\bdocument\s*\.\s*write\b/g, "document.write"],
];

/**
 * As propriedades que estes arquivos PODEM escrever, com o motivo de cada uma.
 * Mesma disciplina de `PORTADORES`: a lista não isenta arquivo nenhum — ela é
 * a própria checagem, e um teste desta rodada recusa qualquer propriedade que
 * mude o contrato do campo (`type`, `inputMode`, `pattern`, `step`, `min`,
 * `max`, `checked`, `defaultValue`…).
 */
export const PROPRIEDADES_TOLERADAS: readonly {
  prop: string;
  motivo: string;
  /** Quando existe, o caminho inteiro da atribuição tem de casar. */
  exigeCaminho?: RegExp;
}[] = [
  {
    prop: "current",
    motivo:
      "é a caixa de ref do React, um objeto comum — não um nó de DOM. Toda a página guarda estado de closure aqui.",
  },
  {
    prop: "value",
    exigeCaminho: /Ref\s*\??\.\s*current\s*\.\s*value$/,
    motivo:
      "o <select> nativo de mae-form.tsx já trocou de valor sozinho quando a porta recusa, e o React não re-renderiza porque o estado não mudou; devolver o valor visível é a única forma de a caixa não mentir. Só em arquivo SEM <input>: num campo de texto seria `value` justamente o que faria programa e caixa discordarem.",
  },
  {
    prop: "returnValue",
    motivo:
      "é o contrato de `beforeunload` (usar-aviso-de-saida.ts): sem ele o navegador não pergunta antes de levar embora uma gravação em voo. Não toca em campo nenhum.",
  },
];

/** Palavras que abrem uma DECLARAÇÃO, não uma atribuição a propriedade. */
const RAIZES_QUE_NAO_SAO_OBJETO = new Set([
  "const",
  "let",
  "var",
  "readonly",
  "typeof",
  "return",
  "new",
  "as",
  "of",
  "in",
  "case",
  "yield",
  "await",
]);

/** As raízes declaradas como objeto literal no arquivo — dado, não nó. */
function objetosLiteraisLocais(src: string): Set<string> {
  const nomes = new Set<string>();
  for (const m of src.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]*)?=\s*\{/g,
  )) {
    nomes.add(m[1] ?? "");
  }
  return nomes;
}

export function escritasNoDom(): EscritaNoDom[] {
  const achados: EscritaNoDom[] = [];
  const comInput = new Set(arquivosComInput());
  for (const arquivo of arquivosVarridos()) {
    const src = codigo(arquivo);
    for (const [re, rotulo] of CHAMADAS_QUE_ESCREVEM_NO_DOM) {
      for (const m of src.matchAll(re)) {
        achados.push({ arquivo, linha: linhaDe(src, m.index ?? 0), trecho: rotulo });
      }
    }
    const literais = objetosLiteraisLocais(src);
    for (const m of src.matchAll(
      /([A-Za-z_$][\w$]*)((?:\s*\??\.\s*[A-Za-z_$][\w$]*|\s*\[[^\]\n]*\])+)\s*=(?!=|>)/g,
    )) {
      const raiz = m[1] ?? "";
      const caminho = (m[2] ?? "").replace(/\s+/g, "");
      // `const [a, b] = …`, `readonly Tipo[] = …`: declaração ou anotação de
      // tipo, não escrita em propriedade.
      if (RAIZES_QUE_NAO_SAO_OBJETO.has(raiz)) continue;
      if (/^(\[[^\]]*\])+$/.test(caminho) && !caminho.includes(".")) {
        // Só colchetes: ou é `Tipo[] =` (vazio) ou é uma propriedade CALCULADA
        // num identificador solto — esta última é exatamente a fuga que a
        // lista de nomes não pega, e por isso continua sendo violação.
        if (/\[\s*\]/.test(caminho)) continue;
      }
      const ultimo = /\.([A-Za-z_$][\w$]*)$/.exec(caminho)?.[1] ?? null;
      const trecho = `${raiz}${caminho} =`;
      const inteiro = `${raiz}${caminho}`;
      if (ultimo !== null) {
        const tolerada = PROPRIEDADES_TOLERADAS.find((t) => t.prop === ultimo);
        if (tolerada !== undefined) {
          const caminhoOk =
            tolerada.exigeCaminho === undefined || tolerada.exigeCaminho.test(inteiro);
          // `current` vale em qualquer arquivo (não é DOM); as demais, só onde
          // não há campo de texto desenhado.
          const arquivoOk = tolerada.prop === "current" || !comInput.has(arquivo);
          if (caminhoOk && arquivoOk) continue;
        }
        // Montar um objeto literal local é dado, não DOM.
        if (literais.has(raiz) && !caminho.includes("[")) continue;
      }
      achados.push({ arquivo, linha: linhaDe(src, m.index ?? 0), trecho });
    }
  }
  return achados;
}

/** Os arquivos da página da tarefa que declaram um `<input>` no JSX. */
export function arquivosComInput(): string[] {
  return arquivosVarridos().filter((a) => /<input\b/.test(codigo(a)));
}
