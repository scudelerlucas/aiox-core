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

/**
 * ═══════════════════════════════════════════════════════ CRÍTICO #2, rodada 14 ═
 * O PERÍMETRO TINHA DUAS PASTAS; A APLICAÇÃO NÃO TEM.
 *
 * Até a rodada 13 o perímetro era a constante `["components/task", "app/tarefa"]`.
 * O crítico pôs o ajudante
 *
 *     // src/lib/ui/teclado-do-celular.ts
 *     export function ajustarTecladoDecimal(el: HTMLInputElement | null): void {
 *       if (el === null) return;
 *       el.type = "number";
 *     }
 *
 * e, em `campo-numerico.tsx`, `ref={ajustarTecladoDecimal}`. O arquivo da página
 * não continha escrita nenhuma — só uma chamada de nome inocente —, os quatro
 * portões ficaram verdes e, no Chromium, `input.type` virava `number`: a página
 * apagando a duração do operador e dizendo "Duração removida.".
 *
 * Duas coisas mudaram, e as duas importam:
 *
 *  1. O perímetro da PÁGINA deixou de ser lista de pastas: ele é o **fecho de
 *     importações** a partir do que o navegador monta em `/tarefa/<id>`
 *     (`RAIZES_DA_PAGINA`). Qualquer arquivo, em qualquer canto do `src/`, que a
 *     página alcance entra — `lib/ui/teclado-do-celular.ts` inclusive.
 *  2. A varredura de escrita em nó de DOM (`escritasNoDom`) deixou de rodar no
 *     perímetro da página e passa a rodar no **`src/` INTEIRO**, com exceções
 *     declaradas uma a uma, por caminho + propriedade + motivo escrito
 *     (`ESCRITAS_TOLERADAS`) — nunca por ausência de cobertura.
 */
export const RAIZES_DA_PAGINA = ["app/tarefa/[id]/page.tsx", "app/layout.tsx"] as const;

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

function existeArquivo(caminho: string): boolean {
  try {
    return statSync(RAIZ + caminho).isFile();
  } catch {
    return false;
  }
}

/**
 * `@/x/y` e `./y` → o arquivo do `src/`, quando ele existe. Devolve `null` para
 * pacote de fora (`react`, `next/link`), que não é código desta casa.
 */
export function resolverImport(especificador: string, deArquivo: string): string | null {
  let base: string;
  if (especificador.startsWith("@/")) base = especificador.slice(2);
  else if (especificador.startsWith(".")) {
    const dir = deArquivo.includes("/") ? deArquivo.slice(0, deArquivo.lastIndexOf("/")) : "";
    const partes = dir.length > 0 ? dir.split("/") : [];
    for (const p of especificador.split("/")) {
      if (p === ".") continue;
      else if (p === "..") partes.pop();
      else partes.push(p);
    }
    base = partes.join("/");
  } else return null;
  for (const sufixo of [".ts", ".tsx", "/index.ts", "/index.tsx", ""]) {
    const candidato = base + sufixo;
    if (/\.tsx?$/.test(candidato) && existeArquivo(candidato)) return candidato;
  }
  return null;
}

/** Os módulos do `src/` que este arquivo importa (estático e dinâmico). */
export function importadosPor(arquivo: string): string[] {
  const src = codigo(arquivo);
  const fora: string[] = [];
  for (const m of src.matchAll(
    /(?:^|[\n;}])\s*(?:import|export)\b[^;\n]*?from\s*["']([^"']+)["']/g,
  )) {
    const r = resolverImport(m[1] ?? "", arquivo);
    if (r !== null) fora.push(r);
  }
  for (const m of src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    const r = resolverImport(m[1] ?? "", arquivo);
    if (r !== null) fora.push(r);
  }
  return [...new Set(fora)];
}

/**
 * Os arquivos que a página da tarefa ALCANÇA — fecho de importações a partir de
 * `RAIZES_DA_PAGINA`. É o perímetro da página, e ele não conhece pasta
 * privilegiada: um ajudante em `lib/`, `hooks/` ou `components/ui/` entra no dia
 * em que a página o importa.
 */
export function arquivosVarridos(): string[] {
  const vistos = new Set<string>();
  const pilha: string[] = RAIZES_DA_PAGINA.filter((r) => existeArquivo(r));
  while (pilha.length > 0) {
    const atual = pilha.pop();
    if (atual === undefined || vistos.has(atual)) continue;
    vistos.add(atual);
    for (const vizinho of importadosPor(atual)) pilha.push(vizinho);
  }
  return [...vistos].sort();
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

/**
 * ══════════════════════════════════════════════════════════ ALTO #1, rodada 14 ═
 * A GUARDA-GÊMEA CAÍA NO MESMO PARÊNTESE — E O REFORÇO ERA LISTA DE NOMES.
 *
 * Os marcadores desta guarda tinham a MESMA exigência de identificador nu da
 * varredura de DOM: `/[A-Za-z_$][\w$]*\s*\.\s*current\s*=/`. O crítico pôs
 * `(tentativaRef).current = novo;` antes da porta em `status-form.tsx`, os
 * quatro portões ficaram verdes, e no Chromium (POST atrasado 4 s, segundo
 * clique recusado) a tela anunciou o desfecho do SEGUNDO clique enquanto o
 * servidor recebia o do primeiro.
 *
 * Duas mudanças:
 *  1. as marcas de estado saem do mesmo leitor que anda para trás
 *     (`atribuicoesAPropriedade`) — `(x).current`, `(x as Y).current`,
 *     `x["current"]` e `f().current` entram todas;
 *  2. `marcasNoTexto` trabalha sobre TEXTO, não sobre arquivo, para o teste
 *     poder injetar a sabotagem em cada arquivo que chama a porta e PROVAR que
 *     a guarda a vê — em vez de conferir dois nomes de arquivo escritos à mão.
 */
export function marcasNoTexto(src: string): Omit<MarcaAntesDoVeredito, "arquivo">[] {
  const achados: Omit<MarcaAntesDoVeredito, "arquivo">[] = [];
  const atribuicoes = atribuicoesAPropriedade(src);
  for (const m of src.matchAll(/\bescrever\s*\(/g)) {
    const indice = m.index ?? 0;
    const antes = src.slice(Math.max(0, indice - 120), indice);
    // A DECLARAÇÃO de `escrever` na porta não é um sítio de escrita.
    if (/(function|:)\s*$/.test(antes)) continue;
    const inicio = inicioDaFuncao(src, indice);
    // `ref.current = …` em qualquer grafia, dentro da mesma função e ANTES da
    // chamada da porta.
    for (const a of atribuicoes) {
      if (a.indice < inicio || a.indice >= indice) continue;
      const ehCurrent =
        a.prop === "current" || /^\[\s*["']current["']\s*\]$/.test(a.calculado ?? "");
      if (!ehCurrent) continue;
      achados.push({
        linha: linhaDe(src, a.indice),
        marca: `${a.esquerda.replace(/\s+/g, " ").trim()} =`,
        escritaNaLinha: linhaDe(src, indice),
      });
    }
    const corpo = src.slice(inicio, indice);
    for (const marca of corpo.matchAll(/\bset[A-Z][\w$]*\s*\(/g)) {
      achados.push({
        linha: linhaDe(src, inicio + (marca.index ?? 0)),
        marca: "set…(",
        escritaNaLinha: linhaDe(src, indice),
      });
    }
  }
  return achados;
}

/** Os arquivos do perímetro que CHAMAM a porta — derivado, nunca listado. */
export function arquivosQueChamamAPorta(): string[] {
  return arquivosVarridos().filter((a) => {
    if (a === ARQUIVO_DA_PORTA) return false;
    const src = codigo(a);
    for (const m of src.matchAll(/\bescrever\s*\(/g)) {
      const antes = src.slice(Math.max(0, (m.index ?? 0) - 120), m.index ?? 0);
      if (!/(function|:)\s*$/.test(antes)) return true;
    }
    return false;
  });
}

export function marcasAntesDoVeredito(): MarcaAntesDoVeredito[] {
  const achados: MarcaAntesDoVeredito[] = [];
  for (const arquivo of arquivosVarridos()) {
    if (arquivo === ARQUIVO_DA_PORTA) continue;
    for (const marca of marcasNoTexto(codigo(arquivo))) achados.push({ arquivo, ...marca });
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
  // [rodada 14] O perímetro virou o FECHO da página, e nele entram módulos de
  // servidor que falam com o Supabase por `fetch` — o que é o trabalho deles.
  // A rota de fuga que importa é a do NAVEGADOR: um arquivo `"use client"` da
  // página chamando o servidor por fora da porta. Derivado da diretiva, não de
  // uma lista de arquivos.
  for (const arquivo of arquivosDeCliente()) {
    const src = codigo(arquivo);
    for (const [re, rotulo] of padroes) {
      for (const m of src.matchAll(re)) {
        achados.push({ arquivo, linha: linhaDe(src, m.index ?? 0), trecho: rotulo });
      }
    }
  }
  return achados;
}

/** Os arquivos do perímetro da página que rodam no NAVEGADOR (`"use client"`). */
export function arquivosDeCliente(): string[] {
  return arquivosVarridos().filter((a) => /^\s*["']use client["']/.test(fonte(a)));
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
/**
 * ═══════════════════════════════════════════════════════ BAIXO #1, rodada 15 ═
 * A VARREDURA DEPENDIA DA POSIÇÃO DO `type=` DENTRO DA TAG — E ACUSAVA A
 * COISA ERRADA.
 *
 * A expressão era `/<input\b[^>]*?\btype=…/`. `[^>]*?` para no primeiro `>` do
 * texto, e uma `ref` tem um `=>` dentro: qualquer atributo com arrow escrito
 * ANTES do `type=` fazia a varredura deixar de ver aquele campo. Medido pelo
 * crítico: o piso reprovou (`expected 5 to be greater than or equal to 6`) —
 * a rede fez o trabalho dela —, mas a mensagem mandava procurar um
 * `type="number"` que não existia. Rede que reprova pelo motivo errado gasta a
 * corrida seguinte inteira.
 *
 * A correção não é uma regex maior: é ACHAR O FIM DA TAG. De cada `<input`, o
 * leitor anda para a frente contando `{`/`}` e só aceita como fim da tag um
 * `>` que esteja FORA de chaves — então `=>`, `{cond ? a : b}` e objetos
 * literais deixam de cortar a tag no meio. Dentro desse texto, a pergunta é a
 * mesma: qual `type`?
 *
 * Um `<input>` SEM `type=` também é anotado, com `tipo: ""`. Ele não é
 * proibido (o padrão do HTML é `text`), mas contá-lo é o que permite a
 * mensagem dizer "a varredura achou N tags e M sem `type`" em vez de acusar um
 * `number` inexistente.
 */
export function tagsDeInput(): { arquivo: string; linha: number; tag: string }[] {
  const achados: { arquivo: string; linha: number; tag: string }[] = [];
  for (const arquivo of arquivosDoSrc()) {
    const src = codigo(arquivo);
    for (const m of src.matchAll(/<input\b/g)) {
      const inicio = m.index ?? 0;
      let chaves = 0;
      let fim = -1;
      for (let i = inicio; i < src.length; i += 1) {
        const c = src[i];
        if (c === "{") chaves += 1;
        else if (c === "}") chaves -= 1;
        else if (c === ">" && chaves === 0) {
          fim = i;
          break;
        }
      }
      achados.push({
        arquivo,
        linha: linhaDe(src, inicio),
        tag: src.slice(inicio, fim === -1 ? src.length : fim + 1),
      });
    }
  }
  return achados;
}

export function tiposDeInput(): { arquivo: string; linha: number; tipo: string }[] {
  // [CRÍTICO #2, rodada 14] `src/` INTEIRO: o `type="number"` proibido não tem
  // por que ser proibido só em duas pastas, e um campo novo em `components/ui/`
  // reusado pela página escapava da checagem.
  return tagsDeInput().map(({ arquivo, linha, tag }) => ({
    arquivo,
    linha,
    tipo: /\btype=\{?["']([a-z]+)["']\}?/.exec(tag)?.[1] ?? "",
  }));
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
 * ═══════════════════════════════════════════════════════ CRÍTICO #1, rodada 14 ═
 * UM PAR DE PARÊNTESES APAGAVA A TRAVA INTEIRA.
 *
 * A rodada 13 trocou "proibir três grafias" por "proibir a família" e escreveu,
 * neste arquivo, que *"a pergunta certa não é «este texto aparece?», é «este
 * arquivo escreve num nó de DOM?»"*. A implementação continuava respondendo a
 * primeira: a regex exigia um IDENTIFICADOR NU na raiz —
 *
 *     /([A-Za-z_$][\w$]*)((?:\s*\??\.\s*[A-Za-z_$][\w$]*|…)+)\s*=(?!=|>)/g
 *
 * — e por isso `(el).type = "number"`, `(el as HTMLInputElement).type = …`,
 * `(a ?? b).type = …` e `f().type = …` passavam. O crítico derrubou a rodada
 * inteira com um par de parênteses dentro de `campo-numerico.tsx`, os quatro
 * portões verdes e, no Chromium, a duração do operador apagada com a tela
 * dizendo "Duração removida.".
 *
 * **Forma sintática também é grafia.** O que substitui a regex não é uma regex
 * maior: é um leitor que ANDA PARA TRÁS a partir de cada `=` e reconstrói o
 * lado esquerdo — identificadores, `.`, `?.`, `[…]`, `(…)`, `!` — e só pergunta
 * duas coisas no fim: *a escrita termina numa propriedade (ou num índice
 * calculado)?* e *qual propriedade?*. A raiz deixou de ser exigência: ela vira
 * informação, e vem `null` quando o autor a escondeu atrás de parênteses.
 *
 * A rede principal desta peça passou a ser o navegador
 * (`tests/navegador/guarda-p6.mjs`), que pergunta ao DOM e não ao texto. Esta
 * varredura é a SEGUNDA rede: ela não depende de servidor de pé, roda em
 * `npx vitest run` e nomeia o arquivo e a linha.
 *
 * E ela é incompleta POR CONSTRUÇÃO — isto está medido, não suposto. Na rodada
 * 14 esta sabotagem passou pelos QUATRO portões de fonte (1480 testes verdes,
 * `tsc` limpo, contraste limpo, `eslint` limpo):
 *
 *     ref={(el) => {
 *       if (el !== null) {
 *         const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "type");
 *         d?.set?.call(el, "number");
 *       }
 *     }}
 *
 * Não há atribuição nenhuma ali: o setter da propriedade é CHAMADO. No Chromium
 * a guarda reprovou em cinco medidas (A, B, C, F e G) e o campo voltou a apagar
 * a duração do operador. A conclusão não é "acrescentar `getOwnPropertyDescriptor`
 * à lista" — seria a nona variação do mesmo vício, e a décima já está escrita em
 * algum lugar. A conclusão é que a completude desta peça mora no navegador, e o
 * que está aqui é rede de segurança rápida, com nome e linha.
 */

/** Uma atribuição a propriedade, lida de trás para a frente. */
export interface AtribuicaoAPropriedade {
  /** Onde o `=` está, em caracteres. */
  indice: number;
  /** A raiz NUA (`el`), ou `null` quando a raiz é uma expressão (`(el)`, `f()`). */
  raiz: string | null;
  /** A propriedade escrita (`type`), ou `null` quando a escrita é calculada. */
  prop: string | null;
  /** O índice calculado (`[k]`), quando a escrita é calculada. */
  calculado: string | null;
  /** O lado esquerdo inteiro, como está escrito. */
  esquerda: string;
  /** Onde o lado esquerdo começa, em caracteres. */
  inicio: number;
}

/** Operadores de atribuição composta: `+=`, `??=`, `||=`, `&&=`… */
const OPERADORES_COMPOSTOS = new Set(["+", "-", "*", "/", "%", "&", "|", "^", "?"]);

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
  "function",
  "class",
  "interface",
  "type",
  "export",
  "default",
  "void",
  "delete",
]);

/**
 * Anda para trás a partir de `fim` e devolve o lado esquerdo da atribuição.
 * `null` quando o que está ali não é escrita em propriedade (`const x =`,
 * `onChange={…}`, `a === b`).
 */
export function ladoEsquerdo(
  src: string,
  fim: number,
): Omit<AtribuicaoAPropriedade, "indice"> | null {
  let p = fim - 1;
  const pular = (): void => {
    while (p >= 0 && /\s/.test(src[p] ?? "")) p--;
  };
  pular();
  const ultimo = p;
  let prop: string | null = null;
  let calculado: string | null = null;
  let achouMembro = false;
  for (let voltas = 0; voltas < 400 && p >= 0; voltas++) {
    const c = src[p] ?? "";
    if (c === "]") {
      let nivel = 0;
      let q = p;
      for (; q >= 0; q--) {
        const d = src[q];
        if (d === "]") nivel++;
        else if (d === "[") {
          nivel--;
          if (nivel === 0) break;
        }
      }
      if (q < 0) return null;
      if (!achouMembro) {
        calculado = src.slice(q, p + 1);
        achouMembro = true;
      }
      p = q - 1;
      pular();
      continue;
    }
    if (c === ")") {
      // `(el).type`, `(el as X).type`, `f().type` — a raiz é uma EXPRESSÃO.
      if (!achouMembro) return null;
      let nivel = 0;
      let q = p;
      for (; q >= 0; q--) {
        const d = src[q];
        if (d === ")") nivel++;
        else if (d === "(") {
          nivel--;
          if (nivel === 0) break;
        }
      }
      if (q < 0) return null;
      p = q - 1;
      pular();
      continue;
    }
    if (/[\w$]/.test(c)) {
      let q = p;
      while (q >= 0 && /[\w$]/.test(src[q] ?? "")) q--;
      const nome = src.slice(q + 1, p + 1);
      let r = q;
      while (r >= 0 && /\s/.test(src[r] ?? "")) r--;
      if (src[r] === ".") {
        if (!achouMembro) {
          prop = nome;
          achouMembro = true;
        }
        let s = r - 1;
        while (s >= 0 && /\s/.test(src[s] ?? "")) s--;
        p = src[s] === "?" ? s - 1 : r - 1;
        pular();
        continue;
      }
      if (!achouMembro) return null;
      return { raiz: nome, prop, calculado, esquerda: src.slice(q + 1, ultimo + 1), inicio: q + 1 };
    }
    // `!` (non-null), `>` (genérico), `"` , `;`, `{`: acabou o lado esquerdo.
    if (!achouMembro) return null;
    return { raiz: null, prop, calculado, esquerda: src.slice(p + 1, ultimo + 1), inicio: p + 1 };
  }
  if (!achouMembro) return null;
  return { raiz: null, prop, calculado, esquerda: src.slice(0, ultimo + 1), inicio: 0 };
}

/**
 * TODA atribuição a propriedade do texto — sem exigir identificador nu na raiz.
 * É a peça que fecha o CRÍTICO #1: a família não tem mais uma grafia preferida.
 */
export function atribuicoesAPropriedade(src: string): AtribuicaoAPropriedade[] {
  const out: AtribuicaoAPropriedade[] = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== "=") continue;
    // `==`, `===`, `=>`, `!=`, `<=`, `>=` não são atribuição.
    if (src[i + 1] === "=" || src[i + 1] === ">") continue;
    const anterior = src[i - 1];
    if (anterior === "=" || anterior === "!" || anterior === "<" || anterior === ">") continue;
    let fim = i;
    if (anterior !== undefined && OPERADORES_COMPOSTOS.has(anterior)) {
      // `x.y += 1`, `x.y ??= 1`: a escrita continua sendo escrita.
      fim = src[i - 2] === anterior ? i - 2 : i - 1;
    }
    const esquerda = ladoEsquerdo(src, fim);
    if (esquerda === null) continue;
    // `const [a, b] = …`: desestruturação, não escrita em propriedade.
    const texto = esquerda.esquerda.trim();
    if (esquerda.raiz === null && texto.startsWith("[") && texto.endsWith("]")) continue;
    // `const x: Tipo["k"] = …`: anotação de tipo, não escrita. A régua olha o
    // que vem ANTES do lado esquerdo — daí o `inicio` devolvido pelo leitor.
    const antes = src.slice(Math.max(0, esquerda.inicio - 260), esquerda.inicio);
    if (/(?:const|let|var|readonly|public|private|protected)\s+[A-Za-z_$][\w$]*!?\s*:\s*$/.test(antes))
      continue;
    if (esquerda.raiz !== null && RAIZES_QUE_NAO_SAO_OBJETO.has(esquerda.raiz)) continue;
    // `Tipo[] = …` (colchete vazio) é anotação, não índice calculado.
    if (esquerda.prop === null && /^\[\s*\]$/.test(esquerda.calculado ?? "")) continue;
    out.push({ indice: i, ...esquerda });
  }
  return out;
}

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

/**
 * ═══════════════════════════════════════════════ CRÍTICO #2, rodada 14 (cont.) ═
 * AS EXCEÇÕES SÃO DECLARADAS — POR CAMINHO, POR PROPRIEDADE E COM MOTIVO.
 *
 * Com o perímetro em `src/` INTEIRO, aparecem escritas legítimas de peças que
 * não são a página da tarefa (a folha da linha do tempo, o roteador de arestas
 * do grafo, o middleware, os stores de fixture). Cada uma entra aqui com o
 * caminho, a propriedade e o porquê — e três testes vigiam esta lista:
 *
 *  - nenhuma exceção cobre propriedade que muda o contrato de um campo
 *    (`type`, `inputMode`, `step`, `value`, `checked`…): era disso que o
 *    CRÍTICO das rodadas 10/11/13 era feito;
 *  - nenhuma exceção com caminho aponta para arquivo que DESENHA um campo
 *    (`<input>`, `<select>`, `<textarea>`) — derivado do fonte, não listado;
 *  - toda exceção é USADA. Exceção que não casa com escrita nenhuma é lixo que
 *    esconde a próxima, e o teste manda apagá-la.
 */
export interface EscritaTolerada {
  /** O caminho EXATO, ou `null` para "em qualquer arquivo". */
  arquivo: string | null;
  /** A propriedade exata, ou `"[]"` para índice calculado. */
  prop: string;
  /** Quando existe, o lado esquerdo inteiro tem de casar. */
  exigeCaminho?: RegExp;
  /** Quando `true`, vale só em arquivo que NÃO desenha campo de TEXTO. */
  soSemCampoDeTexto?: boolean;
  motivo: string;
}

export const ESCRITAS_TOLERADAS: readonly EscritaTolerada[] = [
  {
    arquivo: null,
    prop: "current",
    motivo:
      "é a caixa de ref do React, um objeto comum — não um nó de DOM. Toda a página guarda estado de closure aqui.",
  },
  {
    arquivo: null,
    prop: "value",
    exigeCaminho: /Ref\s*\??\.\s*current\s*\.\s*value$/,
    soSemCampoDeTexto: true,
    motivo:
      "o <select> nativo de mae-form.tsx já trocou de valor sozinho quando a porta recusa, e o React não re-renderiza porque o estado não mudou; devolver o valor visível é a única forma de a caixa não mentir. Só em arquivo SEM <input>: num campo de texto seria `value` justamente o que faria programa e caixa discordarem.",
  },
  {
    arquivo: null,
    prop: "returnValue",
    motivo:
      "é o contrato de `beforeunload` (usar-aviso-de-saida.ts): sem ele o navegador não pergunta antes de levar embora uma gravação em voo. Não toca em campo nenhum.",
  },
  {
    arquivo: "core/prioritize/elos-de-precedencia.ts",
    prop: "arestaId",
    motivo:
      "preenche o id da aresta num registro de agregação guardado num Map local da própria função — dado do cálculo de precedência, que roda no servidor e nunca vê um nó de DOM.",
  },
  {
    arquivo: "core/prioritize/heranca.ts",
    prop: "indice",
    motivo:
      "é o cursor da pilha explícita que substitui a recursão na descida da subárvore — um objeto de quadro criado ali mesmo, no cálculo de herança que roda no servidor.",
  },
  {
    arquivo: "lib/supabase/live-client.ts",
    prop: "code",
    motivo:
      "é o campo da classe RpcError sendo preenchido no construtor (`this.code`) — `this` dentro de uma classe declarada no arquivo, nunca um elemento da página.",
  },
  {
    arquivo: "lib/supabase/live-client.ts",
    prop: "lastIndex",
    motivo:
      "zera o cursor de uma expressão regular global antes de reusá-la (`/g` guarda posição entre chamadas). `lastIndex` é estado de RegExp; nenhum nó de DOM tem essa propriedade gravável.",
  },
  {
    arquivo: "core/timeline/folha-inferior.ts",
    prop: "maxHeight",
    motivo:
      "a folha inferior da LINHA DO TEMPO (peça P5) aplica a altura calculada por medida geométrica — é o remédio do achado S1 daquela peça, e não há campo nenhum nesse arquivo.",
  },
  {
    arquivo: "core/timeline/folha-inferior.ts",
    prop: "height",
    motivo:
      "mesma aplicação de altura da folha inferior da linha do tempo (peça P5): geometria de painel, medida no navegador pela guarda daquela peça.",
  },
  {
    arquivo: "core/timeline/sincronizacao-painel.ts",
    prop: "scrollLeft",
    motivo:
      "sincroniza a rolagem horizontal dos dois painéis da linha do tempo (peça P5) — posição de rolagem, não contrato de campo.",
  },
  {
    arquivo: "core/timeline/sincronizacao-painel.ts",
    prop: "transform",
    motivo:
      "desloca a camada da linha do tempo (peça P5) por `transform`, que é pintura; o arquivo não desenha campo nenhum.",
  },
  {
    arquivo: "lib/frentes/compose.ts",
    prop: "branch",
    motivo:
      "completa o nome da branch num grupo montado ali mesmo, ao unir PRs e sessões da página de frentes — dado puro, calculado no servidor.",
  },
  {
    arquivo: "lib/frentes/repository.ts",
    prop: "name",
    motivo:
      "é `this.name` no construtor de uma classe de erro declarada no arquivo — nomear o erro, não escrever em elemento.",
  },
  {
    arquivo: "lib/layout-do-grafo.ts",
    prop: "corredorV",
    motivo:
      "grava o corredor vertical escolhido num ponto do plano de roteamento do grafo (peça P4) — geometria em memória, antes de qualquer render.",
  },
  {
    arquivo: "lib/layout-do-grafo.ts",
    prop: "saida",
    motivo:
      "conta as saídas já ocupadas de um nó do grafo (peça P4), num registro criado pelo próprio roteador de arestas.",
  },
  {
    arquivo: "lib/layout-do-grafo.ts",
    prop: "entrada",
    motivo:
      "gêmeo do anterior, para as entradas do nó — mesma estrutura em memória do roteador de arestas do grafo.",
  },
  {
    arquivo: "lib/layout-do-grafo.ts",
    prop: "[]",
    motivo:
      "marca a faixa horizontal ocupada num vetor de ocupação indexado por faixa (peça P4) — vetor local do algoritmo, não um nó.",
  },
  {
    arquivo: "lib/serializa-grafo-v3.ts",
    prop: "[]",
    motivo:
      "preenche por id os dois mapas planos (janelas e scores) que o grafo recebe serializado — objetos literais declarados duas linhas acima, no mesmo arquivo.",
  },
  {
    arquivo: "lib/repositories/tasks.fixture-store.ts",
    prop: "__lifeboardFixtureStore",
    motivo:
      "instala o store de fixture no `globalThis` — é como o modo fixture sobrevive ao recarregamento de módulo do `next dev`. Roda no servidor, e a chave é privada deste arquivo.",
  },
  {
    arquivo: "lib/repositories/tasks.fixture-store.ts",
    prop: "contador",
    motivo:
      "incrementa o contador de ids do store de fixture, num objeto de estado criado pelo próprio módulo.",
  },
  {
    arquivo: "lib/repositories/prompts-fila.fixture-store.ts",
    prop: "__lifeboardFilaFixtureStore",
    motivo:
      "gêmeo do anterior para a fila de prompts: instala o store de fixture no `globalThis`, no servidor.",
  },
  {
    arquivo: "lib/repositories/prompts-fila.fixture-store.ts",
    prop: "contador",
    motivo:
      "incrementa o contador de ids do store de fixture da fila de prompts, num objeto de estado do próprio módulo.",
  },
  {
    arquivo: "middleware.ts",
    prop: "pathname",
    motivo:
      "monta a URL de redirecionamento do login (`new URL(...)`) antes de devolver a resposta. Middleware roda no Edge, onde não existe `document`.",
  },
  {
    arquivo: "middleware.ts",
    prop: "search",
    motivo:
      "gêmeo do anterior: a query da URL de redirecionamento do login, montada no Edge.",
  },
];

/** A exceção que cobre esta escrita, quando existe. */
export function toleracaoDe(
  arquivo: string,
  a: AtribuicaoAPropriedade,
  desenhaCampoDeTexto: (arquivo: string) => boolean,
): EscritaTolerada | null {
  const alvo = a.prop ?? "[]";
  for (const t of ESCRITAS_TOLERADAS) {
    if (t.prop !== alvo) continue;
    if (t.arquivo !== null && t.arquivo !== arquivo) continue;
    if (t.exigeCaminho !== undefined && !t.exigeCaminho.test(a.esquerda.replace(/\s+/g, "")))
      continue;
    if (t.soSemCampoDeTexto === true && desenhaCampoDeTexto(arquivo)) continue;
    return t;
  }
  return null;
}

/**
 * Toda escrita em nó de DOM do `src/` INTEIRO que não tenha exceção declarada.
 * Perímetro: `arquivosDoSrc()` — não mais duas pastas (CRÍTICO #2).
 */
export function escritasNoDom(): EscritaNoDom[] {
  const achados: EscritaNoDom[] = [];
  const comTexto = new Set(arquivosComCampoDeTexto());
  const desenhaCampoDeTexto = (a: string): boolean => comTexto.has(a);
  for (const arquivo of arquivosDoSrc()) {
    const src = codigo(arquivo);
    for (const [re, rotulo] of CHAMADAS_QUE_ESCREVEM_NO_DOM) {
      for (const m of src.matchAll(re)) {
        achados.push({ arquivo, linha: linhaDe(src, m.index ?? 0), trecho: rotulo });
      }
    }
    const literais = objetosLiteraisLocais(src);
    for (const a of atribuicoesAPropriedade(src)) {
      if (toleracaoDe(arquivo, a, desenhaCampoDeTexto) !== null) continue;
      // Montar um objeto literal LOCAL é dado, não DOM — a raiz tem de estar
      // declarada como literal no mesmo arquivo, e nunca escondida atrás de
      // parênteses (foi assim que o CRÍTICO #1 passou).
      if (a.raiz !== null && literais.has(a.raiz)) continue;
      achados.push({
        arquivo,
        linha: linhaDe(src, a.indice),
        trecho: `${a.esquerda.replace(/\s+/g, " ").trim()} =`,
      });
    }
  }
  return achados;
}

/** Os arquivos do perímetro da página que declaram um `<input>` no JSX. */
export function arquivosComInput(): string[] {
  return arquivosVarridos().filter((a) => /<input\b/.test(codigo(a)));
}

/** Todo arquivo do `src/` que DESENHA um campo — derivado, nunca listado. */
export function arquivosComCampo(): string[] {
  return arquivosDoSrc().filter((a) => /<(?:input|select|textarea)\b/.test(codigo(a)));
}

/**
 * Os arquivos do `src/` que desenham um campo de TEXTO (`<input>`/`<textarea>`).
 * É a régua da exceção `value`: num `<select>` devolver o valor visível é a
 * correção; num campo de texto seria justamente o que faz o programa e a caixa
 * discordarem — o CRÍTICO das rodadas 10/11.
 */
export function arquivosComCampoDeTexto(): string[] {
  return arquivosDoSrc().filter((a) => /<(?:input|textarea)\b/.test(codigo(a)));
}

// ═══════════════════════════════════════════════ MÉDIO #1, rodada 14 — rascunho ═
/**
 * OS CAMPOS DE TEXTO LIVRE DA PÁGINA, DERIVADOS DO JSX.
 *
 * `rascunho-nota.ts` nasceu de um achado do crítico ("escrever meia nota,
 * clicar numa subtarefa e voltar apagava tudo") e era importado por UM arquivo.
 * A "Nota da relação" nasceu na rodada 13 já sem a proteção; título e duração
 * de subtarefa também não a tinham. A página é cheia de links para outras
 * tarefas, e `useAvisoDeSaida` só arma com gravação em voo — navegar apagava.
 *
 * A guarda não pode ser lista de nomes (foi esse vício que deixou os gêmeos
 * para trás). Ela deriva do JSX: todo `<textarea>`, todo `<input>` de texto e
 * todo `<CampoNumerico>` do perímetro da página é um campo de texto livre, e
 * cada um tem de ter um rascunho — a chave aparece no manipulador de mudança
 * daquele campo, e o arquivo restaura no efeito.
 */
export interface CampoDeTextoLivre {
  arquivo: string;
  linha: number;
  /** `textarea`, `input` ou `CampoNumerico`. */
  tag: string;
  /** A expressão do `value=`/`valor=` — o estado que a caixa mostra. */
  valor: string;
  /** O manipulador de mudança, como está escrito (`onChange={…}`/`aoMudar={…}`). */
  manipulador: string;
  /** O manipulador GRAVA rascunho? */
  gravaRascunho: boolean;
  /**
   * A caixa nasce com dado do SERVIDOR (o `useState` não começa num literal)?
   * Esses são os únicos que NÃO devem ter rascunho: um rascunho ali faria a
   * tela mostrar um número que o banco não tem, sem dizer que não está salvo —
   * a página mentindo sobre o que está gravado, que é a família dos CRÍTICOs
   * das rodadas 10/11/13. Os campos que nascem vazios (formulários de criação)
   * só têm a ganhar com o rascunho.
   */
  nasceDoServidor: boolean;
}

/** O elemento JSX que começa em `i`, até o `>` que o fecha (respeita `{}`). */
function elementoJsx(src: string, i: number): string {
  let chaves = 0;
  for (let p = i; p < src.length; p++) {
    const c = src[p];
    if (c === "{") chaves++;
    else if (c === "}") chaves--;
    else if (c === ">" && chaves === 0) return src.slice(i, p + 1);
  }
  return src.slice(i);
}

/** O valor de um atributo JSX `nome={…}` ou `nome="…"`, do elemento inteiro. */
function atributoJsx(elemento: string, nome: string): string | null {
  const re = new RegExp(`\\b${nome}=`, "g");
  const m = re.exec(elemento);
  if (m === null) return null;
  const inicio = m.index + m[0].length;
  if (elemento[inicio] === '"' || elemento[inicio] === "'") {
    const aspas = elemento[inicio];
    const fim = elemento.indexOf(aspas ?? '"', inicio + 1);
    return elemento.slice(inicio + 1, fim === -1 ? undefined : fim);
  }
  if (elemento[inicio] !== "{") return null;
  let chaves = 0;
  for (let p = inicio; p < elemento.length; p++) {
    if (elemento[p] === "{") chaves++;
    else if (elemento[p] === "}") {
      chaves--;
      if (chaves === 0) return elemento.slice(inicio + 1, p);
    }
  }
  return elemento.slice(inicio + 1);
}

/**
 * O corpo EFETIVO de um manipulador: o próprio texto, mais o corpo de cada
 * função declarada no arquivo que ele chama. `onChange={(e) => aoDigitar(...)}`
 * grava o rascunho DENTRO de `aoDigitar` — sem seguir a chamada, a guarda
 * mediria o invólucro e passaria.
 */
function corpoEfetivo(arquivoInteiro: string, expressao: string, profundidade = 2): string {
  let junto = expressao;
  let camada = expressao;
  for (let n = 0; n < profundidade; n++) {
    let proxima = "";
    for (const m of camada.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      const i = arquivoInteiro.indexOf(`function ${m[1] ?? ""}(`);
      if (i === -1) continue;
      proxima += blocoDepois(arquivoInteiro, i);
    }
    if (proxima.length === 0) break;
    junto += proxima;
    camada = proxima;
  }
  return junto;
}

/** A marca de que um trecho grava rascunho de campo. */
const GRAVA_RASCUNHO = /\bgravarRascunho\s*\(/;

/**
 * O `useState` deste estado começa num LITERAL (`""`, `"0.5"`, `0`)? Se sim, a
 * caixa nasce vazia ou num padrão constante — formulário de criação. Se não, o
 * valor inicial vem de fora (uma propriedade com dado do servidor).
 */
function comecaEmLiteral(arquivoInteiro: string, estado: string): boolean {
  const re = new RegExp(
    `\\[\\s*${estado}\\s*,\\s*set[\\w$]*\\s*\\]\\s*=\\s*useState\\s*(?:<[^>]*>)?\\s*\\(([^)]*)\\)`,
  );
  const inicial = (re.exec(arquivoInteiro)?.[1] ?? "").trim();
  return /^(?:""|''|`[^`$]*`|"[^"]*"|'[^']*'|-?\d+(?:\.\d+)?|true|false|null)$/.test(inicial);
}

export function camposDeTextoLivre(): CampoDeTextoLivre[] {
  const out: CampoDeTextoLivre[] = [];
  for (const arquivo of arquivosVarridos()) {
    // A variável não se chama `src` de propósito: casar uma regex contra a
    // fonte inteira é a assinatura da regressão do buraco 1, e um teste desta
    // suíte vigia essa forma. Aqui o arquivo inteiro É o alvo legítimo — a
    // pergunta é sobre o ESTADO declarado nele, não sobre um sítio.
    const arquivoInteiro = codigo(arquivo);
    for (const m of arquivoInteiro.matchAll(/<(textarea|input|CampoNumerico)\b/g)) {
      const elemento = elementoJsx(arquivoInteiro, m.index ?? 0);
      const tag = m[1] ?? "";
      // Caixa de marcar, botão de rádio e campo escondido não guardam texto.
      const tipo = atributoJsx(elemento, "type");
      if (tag === "input" && tipo !== null && tipo !== "text" && !tipo.startsWith("{")) continue;
      const valor = (atributoJsx(elemento, tag === "CampoNumerico" ? "valor" : "value") ?? "").trim();
      /*
       * O campo só é DESTE arquivo quando o texto que ele mostra é estado
       * declarado aqui (`const [valor, setValor] = useState(...)`). O `<input>`
       * de `campo-numerico.tsx` recebe `value` por propriedade: quem guarda o
       * texto — e quem precisa do rascunho — é o formulário que o usa. Sem esta
       * régua, o rascunho seria cobrado do componente que não tem o estado.
       */
      if (
        !new RegExp(`\\[\\s*${valor}\\s*,\\s*set[\\w$]*\\s*\\]\\s*=\\s*useState`).test(
          arquivoInteiro,
        )
      )
        continue;
      const manipulador =
        atributoJsx(elemento, tag === "CampoNumerico" ? "aoMudar" : "onChange") ?? "";
      const corpo = corpoEfetivo(arquivoInteiro, manipulador);
      out.push({
        arquivo,
        linha: linhaDe(arquivoInteiro, m.index ?? 0),
        tag,
        valor,
        manipulador: manipulador.trim(),
        gravaRascunho: GRAVA_RASCUNHO.test(corpo),
        nasceDoServidor: !comecaEmLiteral(arquivoInteiro, valor),
      });
    }
  }
  return out;
}

/** Os arquivos do perímetro que RESTAURAM rascunho (o outro meio do mecanismo). */
export function arquivosQueRestauramRascunho(): string[] {
  return arquivosVarridos().filter((a) => /\blerRascunho\s*\(/.test(codigo(a)));
}

/**
 * ═══════════════════════════════════════════════════════ ALTO #1, rodada 15 ═
 * TODA JANELA DE "DESFAZER" DA PÁGINA, DERIVADA DO CÓDIGO.
 *
 * O crítico nomeou três (átomos, nota, criação de relação). São QUATRO — a
 * exclusão de relação tem a mesma forma, no mesmo arquivo. Fechar só as três
 * nomeadas seria a 5ª forma viciada desta base ("confere o caso, não a
 * classe"), então a régua não é uma lista escrita à mão: é uma varredura.
 *
 * Uma janela de desfazer é, neste `src/`, o encontro de duas coisas no mesmo
 * arquivo: um relógio `JANELA_DESFAZER_MS` que apaga o valor da janela, e uma
 * porta cuja `op` tem `desfazer` no nome. O que a varredura pergunta de cada
 * uma:
 *
 *  1. a função que despacha o desfazer FECHA o relógio quando a decisão é
 *     gravar? (sem isso, o relógio apaga o texto, o botão E o dado a
 *     restaurar no meio da chamada — medido pelo crítico: clique aos 8,5 s,
 *     falha aos 11,5 s, zero botões na tela e a nota do operador destruída);
 *  2. a `op` dela tem frase em `MENSAGEM_INVALIDO`? (sem isso, a recusa por
 *     janela fechada é silenciosa — o operador clica e não acontece nada).
 */
export interface JanelaDeDesfazer {
  arquivo: string;
  op: string;
  porta: string;
  fechaORelogioNoDespacho: boolean;
}

/**
 * O corpo da função que contém `agulha`. Anda para trás até o `function` mais
 * próximo e emparelha as chaves para a frente — é o mesmo serviço do
 * `corpoEfetivo` acima, para uma agulha em vez de um nome.
 */
function corpoQueChama(src: string, agulha: string): string | null {
  const onde = src.indexOf(agulha);
  if (onde < 0) return null;
  const inicioDaFuncao = src.lastIndexOf("function ", onde);
  if (inicioDaFuncao < 0) return null;
  const abre = src.indexOf("{", inicioDaFuncao);
  if (abre < 0 || abre > onde) return null;
  let nivel = 0;
  for (let i = abre; i < src.length; i += 1) {
    if (src[i] === "{") nivel += 1;
    else if (src[i] === "}") {
      nivel -= 1;
      if (nivel === 0) return src.slice(abre, i + 1);
    }
  }
  return null;
}

export function janelasDeDesfazer(): JanelaDeDesfazer[] {
  const achados: JanelaDeDesfazer[] = [];
  for (const arquivo of arquivosDoSrc()) {
    const src = codigo(arquivo);
    if (!src.includes("JANELA_DESFAZER_MS")) continue;
    // Como se chamam, NESTE arquivo, as funções que apagam o relógio.
    const fechadores = [
      ...src.matchAll(/function\s+(\w+)\s*\(\s*\)\s*:\s*void\s*\{[^}]*clearTimeout\s*\(/g),
    ].map((m) => m[1] ?? "");
    for (const m of src.matchAll(
      /const\s+(\w+)\s*=\s*usarPortaDeEscrita\(\{\s*\n\s*op:\s*"(\w*desfazer\w*)"/g,
    )) {
      const porta = m[1] ?? "";
      const corpo = corpoQueChama(src, `${porta}.escrever(`);
      achados.push({
        arquivo,
        op: m[2] ?? "",
        porta,
        fechaORelogioNoDespacho:
          corpo !== null &&
          /decisao === "gravar"/.test(corpo) &&
          fechadores.some((f) => f.length > 0 && corpo.includes(`${f}()`)),
      });
    }
  }
  return achados;
}

/**
 * ═══════════════════════════════════════════════════════ CRÍTICO #2, rodada 15 ═
 * QUEM ESCREVE NO DEPÓSITO DO NAVEGADOR, E COM QUE DIREITO.
 *
 * O crítico calou a guarda inteira com uma linha de `sessionStorage.setItem` na
 * chave do vigia. A rede principal contra isso é o canal fora da página (ver
 * `guarda-p6.mjs`); esta é a segunda, barata, no texto do `src/`:
 * `sessionStorage`/`localStorage` só se escreve nos lugares DECLARADOS, e a
 * chave do vigia não se escreve em lugar nenhum.
 *
 * `CHAMADAS_QUE_ESCREVEM_NO_DOM` não alcançava isto: `setItem(` não é escrita
 * em nó nem atribuição a propriedade. É uma família própria, e tem a sua lista.
 */
export interface EscritaNoDeposito {
  arquivo: string;
  linha: number;
  chamada: string;
}

/** As chamadas que MUDAM o depósito do navegador (ler é livre). */
const CHAMADAS_QUE_ESCREVEM_NO_DEPOSITO: readonly [RegExp, string][] = [
  [/\bsetItem\s*\(/g, "setItem("],
  [/\bremoveItem\s*\(/g, "removeItem("],
  [/\b(?:sessionStorage|localStorage)\s*\.\s*clear\s*\(/g, "clear("],
];

export function escritasNoDeposito(): EscritaNoDeposito[] {
  const achados: EscritaNoDeposito[] = [];
  for (const arquivo of arquivosDoSrc()) {
    const src = codigo(arquivo);
    for (const [re, nome] of CHAMADAS_QUE_ESCREVEM_NO_DEPOSITO) {
      for (const m of src.matchAll(re)) {
        achados.push({ arquivo, linha: linhaDe(src, m.index ?? 0), chamada: nome });
      }
    }
  }
  return achados;
}

/** A chave do registro do vigia — tem de não aparecer em nenhum arquivo do `src/`. */
export const CHAVE_DO_VIGIA_P6 = "__vigia-p6-contrato";

export function arquivosQueCitamOVigia(): string[] {
  return arquivosDoSrc().filter((a) => {
    const src = codigo(a);
    return src.includes(CHAVE_DO_VIGIA_P6) || src.includes("__vigiaP6");
  });
}
