import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ARQUIVO_DA_PORTA,
  arquivosDoSrc,
  arquivosUseServer,
  arquivosVarridos,
  arquivosQueCitamOVigia,
  camposDeErro,
  camposDeTextoLivre,
  CHAVE_DO_VIGIA_P6,
  escritasNoDeposito,
  tagsDeInput,
  codigo as codigoDoArquivo,
  convertemOSelo,
  exportsDeValor,
  handlerDaConfirmacaoExecutada,
  importacoes,
  janelasDeDesfazer,
  janelasNoTexto,
  opDoBloco,
  blocoDepois,
  arquivosDeCliente,
  arquivosQueChamamAPorta,
  atribuicoesAPropriedade,
  marcasNoTexto,
  RAIZES_DA_PAGINA,
  portasDeclaradas,
  PORTADORES,
  quantasPortas,
  escritoresDoFixtureStore,
  funcoesDoModulo,
  marcasAntesDoVeredito,
  MODULO_DO_FIXTURE_STORE,
  rotasDeFuga,
  superficieDeEscrita,
  temExportAnonimo,
  tiposDeInput,
  tocamAEscrita,
  varrer,
} from "./tarefa-varredura-derivada";

import {
  ANUNCIO_DE_CONFIRMACAO,
  ANUNCIO_DE_SUCESSO,
  concluirEscrita,
  decidirEscrita,
  MENSAGEM_AGUARDE,
  MENSAGEM_INVALIDO,
  MENSAGEM_SEM_MUDANCA,
  mensagemDeRecusa,
  OPERACOES_DE_ESCRITA,
  recusarEscrita,
  saidaPorConfirmacao,
  transicaoDeConfirmacao,
  type OperacaoDeEscrita,
} from "@/components/task/escrita";

import { AVISO_COM_RASCUNHO, AVISO_SEM_RASCUNHO } from "@/components/task/aviso-nao-salvo";

/**
 * OS-LIFEBOARD · P6 — A PORTA DE ESCRITA É O TRANSPORTE (rodada 9, ALTO #1).
 *
 * A rodada 8 tentou garantir a porta por varredura léxica. O crítico passou
 * 7 de 12 formas de escrita pela peneira — a decisiva (M8) citava a porta no
 * handler e despachava cru: 1126/1126 verdes, varredura verde, e a duração
 * apagada no servidor em silêncio.
 *
 * Agora a garantia é arquitetônica, e este arquivo julga as DUAS redes:
 *
 *  1ª rede (arquitetura) — `escreverTarefaAction` só aceita `PedidoDeEscrita`;
 *      o selo é um `unique symbol` ambiente e não exportado; a fábrica é
 *      privada da porta; a porta não devolve despacho cru.
 *  2ª rede (esta varredura) — lê o `src/` INTEIRO (`app/api/**` incluído) e
 *      confere quem toca a superfície de escrita, quem declara `"use server"`,
 *      quem converte o selo, e se toda porta declarada tem `op` e alvo.
 *
 * Ambiente: sem DOM. O repositório não tem jsdom nem `@testing-library`, e
 * `npm install` está proibido — então o `document` é um objeto falso injetado.
 */

interface CasoDeEscrita {
  op: OperacaoDeEscrita;
  /** O arquivo que executa a operação (relativo a `src/`). */
  arquivo: string;
  /** Para onde o foco vai quando a operação dá certo — em português. */
  alvo: string;
  /** O plano B, quando o alvo não aceita foco (nó já fora da árvore). */
  alternativa: string | null;
}

const OPERACOES: readonly CasoDeEscrita[] = [
  {
    op: "nota_criar",
    arquivo: "components/task/notas-painel.tsx",
    alvo: "a textarea da nota nova (que acabou de esvaziar)",
    alternativa: null,
  },
  {
    op: "nota_excluir",
    arquivo: "components/task/notas-painel.tsx",
    alvo: "o botão excluir da nota seguinte",
    alternativa: "a textarea da nota nova",
  },
  {
    op: "nota_desfazer",
    arquivo: "components/task/notas-painel.tsx",
    alvo: "a textarea da nota nova",
    alternativa: null,
  },
  {
    op: "subtarefa_criar",
    arquivo: "components/task/subtarefas-painel.tsx",
    alvo: "o campo de título (que acabou de esvaziar)",
    alternativa: null,
  },
  {
    op: "relacao_criar",
    arquivo: "components/task/relacoes-painel.tsx",
    alvo: "o select de destino (que voltou a 'Escolha a tarefa…')",
    alternativa: "o botão Adicionar relação",
  },
  {
    op: "relacao_excluir",
    arquivo: "components/task/relacoes-painel.tsx",
    alvo: "o botão excluir da relação seguinte",
    alternativa: "o select de destino",
  },
  {
    op: "relacao_desfazer_criacao",
    arquivo: "components/task/relacoes-painel.tsx",
    alvo: "o botão Adicionar relação",
    alternativa: "o select de destino",
  },
  {
    op: "relacao_desfazer_exclusao",
    arquivo: "components/task/relacoes-painel.tsx",
    alvo: "o select de destino",
    alternativa: null,
  },
  {
    op: "status",
    arquivo: "components/task/status-form.tsx",
    alvo: "o botão de status que ficou marcado",
    alternativa: null,
  },
  {
    op: "mae",
    arquivo: "components/task/mae-form.tsx",
    alvo: "o select de tarefa mãe",
    alternativa: null,
  },
  {
    op: "meta",
    arquivo: "components/task/meta-form.tsx",
    alvo: "o botão da meta",
    alternativa: null,
  },
  {
    op: "duracao",
    arquivo: "components/task/duracao-form.tsx",
    alvo: "o botão Salvar duração",
    alternativa: null,
  },
  {
    op: "atomos_salvar",
    arquivo: "components/task/atomos-form.tsx",
    alvo: "o botão Salvar átomos",
    alternativa: null,
  },
  {
    op: "atomos_limpar",
    arquivo: "components/task/atomos-form.tsx",
    alvo: "o 1º botão do grupo Opcionalidade",
    alternativa: "o botão Salvar átomos",
  },
  {
    // [ALTO #2, rodada 14] o caminho de volta do "Limpar átomos".
    op: "atomos_desfazer_limpeza",
    arquivo: "components/task/atomos-form.tsx",
    alvo: "o botão Salvar átomos",
    alternativa: "o 1º botão do grupo Opcionalidade",
  },
];

/** Um elemento falso: `focavel: false` imita um nó que saiu da árvore. */
function elementoFalso(nome: string, focavel: boolean, doc: { activeElement: unknown }) {
  const el = {
    nome,
    focus: (): void => {
      if (focavel) doc.activeElement = el;
    },
  };
  return el;
}

const BODY = { nome: "<body>", focus: (): void => undefined };

// ═══════════════════════════════════ 1ª rede — a porta É o transporte ═
describe("ALTO #1 — a escrita só existe através da porta (arquitetura, não grep)", () => {
  it("PRONTO QUANDO: o selo do pedido é um `unique symbol` ambiente e NÃO exportado", () => {
    // É isto que faz `escreverTarefaAction(estado, form)` não compilar: nenhum
    // outro módulo consegue nomear a chave, então nenhum outro consegue
    // produzir um objeto que satisfaça `PedidoDeEscrita`.
    const src = readFileSync(
      fileURLToPath(new URL("../../src/app/tarefa/pedido.ts", import.meta.url)),
      "utf8",
    );
    expect(src).toContain("declare const seloDaPorta: unique symbol;");
    expect(src).not.toContain("export declare const seloDaPorta");
    expect(src).not.toMatch(/export\s+\{[^}]*seloDaPorta/);
    expect(src).toContain("readonly [seloDaPorta]: true;");
  });

  it("PRONTO QUANDO: a Server Action de escrita aceita PEDIDO, nunca FormData (forma M6)", () => {
    const src = codigoDoArquivo("app/tarefa/actions.ts");
    expect(src).toMatch(/export async function escreverTarefaAction\(/);
    expect(src).toContain("pedido: PedidoDeEscrita,");
    // Nenhuma das dez operações continua exportada: não há o que pôr num
    // `<form action={...}>` nem o que importar num handler de rota.
    expect(src).not.toMatch(/export async function \w+Action\(\s*_estado[^)]*form: FormData/);
    // [Achado MAIOR, CodeRabbit] Este arquivo é `"use server"`: TODA função
    // exportada dele vira uma Server Action pública, com endpoint próprio,
    // chamável pela rede por qualquer cliente autenticado. `mutar` estava
    // exportada aqui "só para teste" e era, na prática, uma porta dos fundos
    // para as 10 operações — sem PedidoDeEscrita, sem porta, sem anúncio.
    // Agora ela mora em `app/tarefa/despachante.ts`, que NÃO é `"use server"`.
    //
    // Esta asserção é a guarda: UMA export só. Qualquer export novo aqui é um
    // endpoint novo exposto na internet, e derruba este teste.
    expect(src.startsWith('"use server"')).toBe(true);

    // A guarda conta TODA forma de export de VALOR, não só `export async
    // function` — medido: com só aquela forma, um `export { mutar } from
    // "./despachante"` reabria o endpoint com os 81 testes deste arquivo
    // verdes. Tipos saem antes: `export type` é apagado na compilação e não
    // vira endpoint.
    const semTipos = src.replace(/export\s+type\s*\{[^}]*\}[^;]*;/g, "");
    const exportadas: string[] = [];
    for (const m of semTipos.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/g)) {
      exportadas.push(m[1] ?? "");
    }
    for (const m of semTipos.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const parte of (m[1] ?? "").split(",")) {
        const cru = parte.trim();
        if (cru.length === 0 || cru.startsWith("type ")) continue;
        exportadas.push((cru.split(/\s+as\s+/).pop() ?? "").trim());
      }
    }
    expect(semTipos).not.toMatch(/export\s+default/);
    // [Achado CodeRabbit, trivial] `export *` não nomeia nada, então as duas
    // varreduras acima (declaração e `export { }`) não o veem: um
    // `export * from "./despachante"` republicaria `mutar` como endpoint sem
    // que `exportadas` mudasse de tamanho.
    expect(semTipos).not.toMatch(/export\s*\*/);
    expect(exportadas.filter((n) => n.length > 0).sort()).toEqual(["escreverTarefaAction"]);

    // E o despachante, do outro lado da fronteira, não pode ganhar o selo:
    // um `"use server"` aqui republicaria `mutar` como endpoint.
    const despachante = codigoDoArquivo("app/tarefa/despachante.ts");
    expect(despachante).not.toContain('"use server"');
    expect(despachante).toMatch(/export async function mutar\(/);
  });

  it("PRONTO QUANDO: a conversão do selo existe em UM arquivo só — a porta", () => {
    expect(convertemOSelo()).toEqual(["components/task/porta-de-escrita.ts"]);
  });

  /**
   * ═══════════════════════════════════════════════════ ALTO A3, rodada 11 ═
   * O PERÍMETRO DO SELO TEM O TAMANHO DE UM ARQUIVO — E NINGUÉM O MEDIA.
   *
   * MUTAÇÃO 13: acrescentar a `porta-de-escrita.ts`
   *   `export function despacharCru(op, campos) {
   *      return escreverTarefaAction({}, selar(op, campos));
   *    }`
   * Três linhas, `tsc` limpo, 1350/1350 verdes — e qualquer componente ganha
   * escrita crua: sem trava de voo, sem foco entregue, sem anúncio, sem
   * `router.refresh()`, sem aviso de saída. A varredura checava os exports de
   * `actions.ts` e NUNCA os do único módulo que consegue forjar o selo.
   *
   * A régua: a porta exporta UMA função de valor, `usarPortaDeEscrita`.
   * Qualquer export novo de valor aqui é uma segunda porta.
   */
  it("PRONTO QUANDO: a porta exporta UMA função de valor — nada que despache cru", () => {
    expect(exportsDeValor(ARQUIVO_DA_PORTA)).toEqual(["usarPortaDeEscrita"]);
    expect(temExportAnonimo(ARQUIVO_DA_PORTA)).toBe(false);
    // E `selar` — a única fábrica de pedido do `src/` — continua privada.
    const src = codigoDoArquivo(ARQUIVO_DA_PORTA);
    expect(src).toMatch(/\nfunction selar\(/);
    expect(src).not.toMatch(/export\s+(async\s+)?function\s+selar\b/);
    expect(src).not.toMatch(/export\s*\{[^}]*\bselar\b/);
  });

  it("PRONTO QUANDO: a MESMA régua vale para os dois lados da porta", () => {
    // O lado servidor já era medido; agora as duas medições saem da mesma
    // função, e uma não pode ser endurecida esquecendo a outra.
    expect(exportsDeValor("app/tarefa/actions.ts")).toEqual(["escreverTarefaAction"]);
    expect(temExportAnonimo("app/tarefa/actions.ts")).toBe(false);
  });

  /**
   * ═════════════════════════════════════════════════════ CRÍTICO, rodada 11 ═
   * NENHUM CAMPO DESTA PÁGINA GUARDA ESTADO QUE O PROGRAMA NÃO VÊ.
   *
   * `<input type="number">` em `badInput` (`2e`, `1,5`, `--`) mostra o texto
   * na caixa e reporta `value === ""`. Medido no Chromium: `/tarefa/task-docs`
   * com duração 2, digitar `e`, salvar → "Duração salva." e a duração some.
   * Os três campos numéricos da página tinham o mesmo buraco.
   *
   * A trava que impede a volta é esta: `type="number"` não existe mais aqui.
   */
  it("PRONTO QUANDO: nenhum campo da página é `type=\"number\"`", () => {
    const todos = tiposDeInput();
    const numericos = todos
      .filter((i) => i.tipo === "number")
      .map((i) => `${i.arquivo}:${String(i.linha)}`);
    expect(
      numericos,
      `campo que esconde o que o operador digitou:\n${numericos.join("\n")}`,
    ).toEqual([]);
    /*
     * ═══════════════════════════════ VARREDURA DE GENERALIZAÇÃO, rodada 14 ═
     * A LISTA VAZIA ERA UM VERDE — "aprova por ausência", a 2ª das quatro
     * formas viciadas desta base.
     *
     * A asserção acima é `toEqual([])`. Se `tiposDeInput()` parar de achar
     * QUALQUER coisa — regex quebrada, `<input>` que passou a nascer de um
     * componente que a expressão não reconhece, arquivo renomeado — ela
     * continua verde, e a checagem deixou de medir sem avisar. Medido nesta
     * rodada: trocando `<input` por `<inputZZZ` na varredura, os 75 arquivos e
     * 1488 testes seguiram VERDES.
     *
     * Duas travas, as mesmas duas que a P7 pôs no medidor de contraste: um
     * PISO numérico escrito à mão e uma exigência NOMINAL. Encolher a régua
     * passa a exigir baixar o número de propósito, e isso aparece no diff.
     */
    const PISO_DE_CAMPOS_VARRIDOS = 6;
    /*
     * [BAIXO #1, rodada 15] A MENSAGEM ACUSAVA A COISA ERRADA.
     *
     * Esta asserção reprovava com "a varredura parou de achar campo" —
     * verdade — logo abaixo de um `toEqual([])` sobre `type="number"`. Quem
     * recebia a falha ia procurar um `type="number"` que não existia. A causa
     * real era outra: a varredura dependia da POSIÇÃO do `type=` dentro da
     * tag, e um atributo com `=>` escrito antes dele cortava a tag no meio
     * (ver `tagsDeInput`). Agora a mensagem diz o que de fato se mede — quantas
     * TAGS foram achadas e quantas sem `type` — e aponta o lugar certo.
     */
    const tags = tagsDeInput();
    const semType = tags.filter((t) => !/\btype=/.test(t.tag));
    expect(
      todos.length,
      `a varredura de tipos de <input> achou ${String(tags.length)} tag(s) <input> no src/, ` +
        `${String(semType.length)} sem atributo \`type\` — lista curta aqui quase nunca é ` +
        "`type=\"number\"` novo: é a varredura deixando de enxergar a tag (ver `tagsDeInput`, " +
        "que acha o fim da tag contando chaves, e não no primeiro `>`).",
    ).toBeGreaterThanOrEqual(PISO_DE_CAMPOS_VARRIDOS);
    // E o campo do CRÍTICO em pessoa: o único campo numérico da página tem de
    // ser ACHADO pela varredura, e achado como `text`. É a exigência nominal —
    // sem ela, o piso poderia ser cumprido por seis `checkbox` de outras telas
    // enquanto justamente este ficava invisível.
    const oCampoNumerico = todos.filter(
      (i) => i.arquivo === "components/task/campo-numerico.tsx",
    );
    expect(
      oCampoNumerico.map((i) => i.tipo),
      "a varredura não vê mais o <input> do campo numérico — é exatamente o campo do CRÍTICO das rodadas 10/11/13",
    ).toEqual(["text"]);
    // E o campo que os substitui declara o teclado decimal do celular.
    const campo = codigoDoArquivo("components/task/campo-numerico.tsx");
    expect(campo).toContain('type="text"');
    expect(campo).toContain('inputMode="decimal"');
  });

  it("PRONTO QUANDO: a porta não devolve despacho cru (era o que a forma M8 usava)", () => {
    const src = codigoDoArquivo("components/task/porta-de-escrita.ts");
    // O que ela devolve, por extenso — e `disparar` não está aqui.
    expect(src).toContain("export interface PortaDeEscrita {");
    expect(src).not.toContain("disparar");
    // `useAcaoTarefa` (o hook que devolvia `disparar`) deixou de existir.
    const miolo = codigoDoArquivo("components/task/usar-acao-tarefa.ts");
    expect(miolo).not.toContain("export function useAcaoTarefa");
    expect(miolo).not.toContain("useTransition");
  });

  it("PRONTO QUANDO: só a porta importa `escreverTarefaAction`, no src/ inteiro", () => {
    const importadores = arquivosDoSrc().filter((a) =>
      importacoes(codigoDoArquivo(a)).some(
        (i) => i.modulo === "@/app/tarefa/actions" && i.nomes.includes("escreverTarefaAction"),
      ),
    );
    expect(importadores).toEqual(["components/task/porta-de-escrita.ts"]);
  });
});

// ═════════════════════════════════════ 2ª rede — a varredura derivada ═
describe("ALTO #1 — a segunda rede: quem toca a superfície de escrita (src/ inteiro)", () => {
  it("PRONTO QUANDO: a superfície de escrita só é tocada pelos PORTADORES declarados", () => {
    // [buraco 4] `app/api/**` entra aqui: uma rota nova que importe qualquer
    // mutador (forma M5) aparece nesta lista, com o nome do arquivo.
    const permitidos = new Set(PORTADORES.map((p) => p.arquivo));
    const intrusos = tocamAEscrita()
      .filter((t) => !permitidos.has(t.arquivo))
      .map((t) => `${t.arquivo} → ${t.modulo} { ${t.nomes.join(", ")} }`);
    expect(intrusos, `arquivos escrevendo fora da porta:\n${intrusos.join("\n")}`).toEqual([]);
    // E cada portador justifica a sua presença em uma linha.
    for (const p of PORTADORES) expect(p.motivo.length, p.arquivo).toBeGreaterThan(30);
    // 3 desde a rodada 10: o despachante virou arquivo próprio para sair da
    // fronteira `"use server"` (achado MAIOR do CodeRabbit).
    expect(PORTADORES).toHaveLength(3);
    console.log("Superfície de escrita vigiada:");
    for (const [modulo, nomes] of Object.entries(superficieDeEscrita())) {
      console.log("  -", modulo, "→", nomes.join(", "));
    }
    console.log("Arquivos do src/ varridos:", String(arquivosDoSrc().length));
    console.log("Arquivos da página da tarefa:", String(arquivosVarridos().length));
    console.log("Raízes da página:", RAIZES_DA_PAGINA.join(", "));
    console.log("Arquivos de cliente da página:", String(arquivosDeCliente().length));
  });

  it("PRONTO QUANDO: nenhuma Server Action nova nasce fora dos dois arquivos conhecidos", () => {
    // Forma M6 na sua versão ambiciosa: um `"use server"` novo em qualquer
    // canto do src/ criaria um transporte paralelo.
    expect(arquivosUseServer().sort()).toEqual([
      "app/prompts/actions.ts",
      "app/tarefa/actions.ts",
    ]);
  });

  it("PRONTO QUANDO: a página da tarefa não tem rota de fuga (fetch, form action)", () => {
    const fugas = rotasDeFuga().map((f) => `${f.arquivo}:${String(f.linha)} — ${f.trecho}`);
    expect(fugas, fugas.join("\n")).toEqual([]);
  });

  it("PRONTO QUANDO: todo sítio de escrita sai de uma porta declarada, com `op`", () => {
    const sitios = varrer();
    const orfaos = sitios
      .filter((s) => s.receptor === "" || s.op === null)
      .map((s) => `${s.arquivo}:${String(s.linha)} — ${s.receptor || "(sem receptor)"}.escrever(…)`);
    expect(orfaos, `sítios sem porta:\n${orfaos.join("\n")}`).toEqual([]);
    expect(sitios.length).toBeGreaterThanOrEqual(15);
  });

  it("PRONTO QUANDO: toda porta declarada é usada, e declara alvo de foco", () => {
    const sitios = varrer();
    const problemas: string[] = [];
    for (const arquivo of arquivosVarridos()) {
      if (arquivo === ARQUIVO_DA_PORTA) continue; // é a definição, não um uso
      const portas = portasDeclaradas(arquivo);
      expect(portas.length, arquivo).toBe(quantasPortas(codigoDoArquivo(arquivo)));
      for (const p of portas) {
        if (p.op === null) problemas.push(`${arquivo}:${String(p.linha)} — porta sem op`);
        if (!p.temAlvo) problemas.push(`${arquivo}:${String(p.linha)} — porta sem alvo de foco`);
        if (!sitios.some((s) => s.arquivo === arquivo && s.receptor === p.nome)) {
          problemas.push(`${arquivo}:${String(p.linha)} — porta ${p.nome} nunca escreve`);
        }
      }
    }
    expect(problemas, problemas.join("\n")).toEqual([]);
  });

  it("[buraco 1] a `op` de um sítio sai do BLOCO da porta, nunca do arquivo inteiro", () => {
    // A regressão que isto impede: `temConcluir` da rodada 8 era
    // `new RegExp(...).test(src)` — bastava o ARQUIVO concluir aquela op em
    // qualquer lugar. Aqui, um bloco sem `op:` devolve `null` mesmo com a op
    // escrita logo ao lado.
    expect(opDoBloco('{ op: "duracao", alvo: () => null }')).toBe("duracao");
    expect(opDoBloco("{ alvo: () => null }")).toBeNull();
    const scanner = readFileSync(
      fileURLToPath(new URL("./tarefa-varredura-derivada.ts", import.meta.url)),
      "utf8",
    );
    expect(scanner).not.toMatch(/\.test\(src\)/);
  });

  it("[buraco 2] todos os `import {}` do mesmo módulo são lidos, não só o 1º (forma M2b)", () => {
    const dois = [
      'import { a } from "@/app/tarefa/actions";',
      'import { escreverTarefaAction } from "@/app/tarefa/actions";',
    ].join("\n");
    const lidas = importacoes(dois).filter((i) => i.modulo === "@/app/tarefa/actions");
    expect(lidas).toHaveLength(2);
    expect(lidas[1]?.nomes).toEqual(["escreverTarefaAction"]);
  });

  it("[buraco 3] nome que não termina em `Action` é lido igual, e `import * as` também", () => {
    const src = [
      'import { zerarDuracaoDireto } from "@/app/tarefa/actions";',
      'import * as Acoes from "@/lib/supabase/live-client";',
    ].join("\n");
    const lidas = importacoes(src);
    expect(lidas[0]?.nomes).toEqual(["zerarDuracaoDireto"]);
    expect(lidas[1]?.nomes).toEqual(["*"]);
  });

  it("PRONTO QUANDO: OPERACOES_DE_ESCRITA é CONFERIDA contra o derivado, nos dois sentidos", () => {
    const derivadas = [
      ...new Set(
        arquivosVarridos()
          .flatMap((a) => portasDeclaradas(a))
          .map((p) => p.op)
          .filter((o): o is string => o !== null),
      ),
    ].sort();
    const declaradas: string[] = [...OPERACOES_DE_ESCRITA].sort();
    expect(derivadas.filter((o) => !declaradas.includes(o))).toEqual([]);
    expect(declaradas.filter((o) => !derivadas.includes(o))).toEqual([]);
    expect(derivadas).toHaveLength(15);
  });

  it("a lista humana deste arquivo bate com a derivada (documentação, não fonte)", () => {
    expect(OPERACOES.map((c) => c.op).sort()).toEqual([...OPERACOES_DE_ESCRITA].sort());
    expect(OPERACOES).toHaveLength(15);
    // E cada operação é aberta no arquivo que a lista humana diz.
    for (const caso of OPERACOES) {
      const portas = portasDeclaradas(caso.arquivo);
      expect(
        portas.some((p) => p.op === caso.op),
        `${caso.arquivo} deveria abrir a porta ${caso.op}`,
      ).toBe(true);
    }
  });

  it("toda operação da lista tem um anúncio em português, não vazio", () => {
    for (const { op } of OPERACOES) {
      expect(ANUNCIO_DE_SUCESSO[op].length, op).toBeGreaterThan(3);
      expect(ANUNCIO_DE_SUCESSO[op].endsWith("."), op).toBe(true);
    }
  });
});

// ══════════════════════════════ ALTO #2 — nenhum CampoErro nasce cru ═
describe("ALTO #2 — os 10 sítios passam pela porta, e o 11º não nasce cru", () => {
  it("PRONTO QUANDO: nenhum arquivo da página cita `estado.erro`", () => {
    // A porta não expõe `estado`: `erroDoCampo` já vem resolvido (a recusa
    // nova vence o erro velho). Citar `estado.erro` deixou de ser possível.
    const cruus = arquivosVarridos()
      // `escrita.ts` é onde `useCampoDeErro` LÊ o estado da ação — é a
      // definição da regra, não um formulário mostrando erro velho.
      .filter((a) => a !== "components/task/escrita.ts")
      .map((a) => [a, codigoDoArquivo(a)] as const)
      .filter(([, src]) => /\bestado\.erro\b/.test(src))
      .map(([a]) => a);
    expect(cruus).toEqual([]);
  });

  it("PRONTO QUANDO: todo `<CampoErro>` da página é alimentado por uma porta — lista DERIVADA", () => {
    const campos = camposDeErro();
    // A lista não é escrita à mão: ela sai do fonte. Era assim que a rodada 8
    // consertava 4 sítios e deixava 6 — a lista dos 4 era humana.
    const errados = campos
      .filter((c) => !/^[A-Za-z_$][\w$]*\.erroDoCampo(\s*\?\?\s*[A-Za-z_$][\w$]*\.erroDoCampo)*$/.test(c.expressao))
      .map((c) => `${c.arquivo}:${String(c.linha)} — mensagem={${c.expressao}}`);
    expect(errados, `<CampoErro> fora da porta:\n${errados.join("\n")}`).toEqual([]);
    // Os 10 sítios do achado, e os que já existiam, todos contados.
    expect(campos.length).toBeGreaterThanOrEqual(10);
    console.log("Sítios de <CampoErro> derivados do fonte:", String(campos.length));
    for (const c of campos) console.log(`  - ${c.arquivo}:${String(c.linha)} → ${c.expressao}`);
  });

  it("PRONTO QUANDO: a porta resolve o campo por `useCampoDeErro`, num lugar só", () => {
    const usam = arquivosDoSrc().filter((a) => /\buseCampoDeErro\s*\(/.test(codigoDoArquivo(a)));
    expect(usam.sort()).toEqual([
      "components/task/escrita.ts",
      "components/task/porta-de-escrita.ts",
    ]);
  });
});

// ═══════════════════════════ MÉDIO #3 — a região viva não mente no clique ═
describe("MÉDIO #3 — a saída por CONFIRMAÇÃO não anuncia cancelamento", () => {
  for (const op of ["nota_excluir", "relacao_excluir"] as const) {
    it(`PRONTO QUANDO: ${op} — o 2º clique (o que APAGA) sai em silêncio`, () => {
      const t = saidaPorConfirmacao(op, "linha-1");
      expect(t.confirmandoId).toBeNull();
      expect(t.anuncio).toBeNull();
      // …e o cancelamento de verdade continua falando.
      const c = transicaoDeConfirmacao(op, "linha-1", null);
      expect(c.anuncio).toBe(ANUNCIO_DE_CONFIRMACAO[op].saiu);
    });

    it(`${op}: entrar numa linha enquanto outra confirmava diz as duas coisas`, () => {
      const t = transicaoDeConfirmacao(op, "linha-1", "linha-2");
      expect(t.confirmandoId).toBe("linha-2");
      expect(t.anuncio).toBe(
        `${ANUNCIO_DE_CONFIRMACAO[op].saiu} ${ANUNCIO_DE_CONFIRMACAO[op].entrou}`,
      );
    });
  }

  it("PRONTO QUANDO: os painéis usam TRÊS portas distintas — pedir, cancelar, executar", () => {
    for (const arquivo of [
      "components/task/notas-painel.tsx",
      "components/task/relacoes-painel.tsx",
    ]) {
      const src = codigoDoArquivo(arquivo);
      for (const nome of [
        "aoPedirConfirmacao",
        "aoCancelarConfirmacao",
        "aoConfirmarExecutado",
      ]) {
        expect(src, `${arquivo} — ${nome}`).toContain(nome);
      }
      // A porta única da rodada 8 (`aoConfirmar(id | null)`) não volta.
      expect(src, arquivo).not.toMatch(/aoConfirmar\(null\)/);
      expect(src, arquivo).not.toMatch(/aoConfirmar:\s/);
    }
  });

  it("PRONTO QUANDO: o handler do 2º clique sai da confirmação EM SILÊNCIO", () => {
    // Derivado: o nome do handler sai do JSX (`aoConfirmarExecutado={X}`), e
    // o corpo dele é lido do fonte. A mutação que reintroduz o defeito —
    // trocar `saidaPorConfirmacao` por `transicaoDeConfirmacao(..., null)` e
    // anunciar — cai exatamente aqui.
    for (const arquivo of [
      "components/task/notas-painel.tsx",
      "components/task/relacoes-painel.tsx",
    ]) {
      const h = handlerDaConfirmacaoExecutada(arquivo);
      expect(h, `${arquivo}: nenhum handler ligado em aoConfirmarExecutado`).not.toBeNull();
      if (h === null) continue;
      expect(h.corpo, `${arquivo} — ${h.nome}`).toContain("saidaPorConfirmacao(");
      // Nada é dito neste caminho: quem fala é o sucesso da exclusão.
      expect(h.corpo, `${arquivo} — ${h.nome}`).not.toContain("mostrar(");
      expect(h.corpo, `${arquivo} — ${h.nome}`).not.toContain("anunciar(");
      expect(h.corpo, `${arquivo} — ${h.nome}`).not.toContain("t.anuncio");
      expect(h.corpo, `${arquivo} — ${h.nome}`).not.toContain("transicaoDeConfirmacao(");
    }
  });

  it("PRONTO QUANDO: o bloco que DESPACHA a exclusão não chama o cancelamento", () => {
    // Derivado: o handler `excluir()` de cada linha é lido do fonte, e a
    // ordem lá dentro é `aoConfirmarExecutado()` → `escrever(`. A rodada 8
    // tinha `aoConfirmar(null)` nessa mesma posição.
    for (const arquivo of [
      "components/task/notas-painel.tsx",
      "components/task/relacoes-painel.tsx",
    ]) {
      const src = codigoDoArquivo(arquivo);
      const i = src.indexOf("function excluir(): void {");
      expect(i, arquivo).toBeGreaterThan(0);
      const bloco = src.slice(i, src.indexOf("\n  }", i));
      expect(bloco, arquivo).toContain("aoConfirmarExecutado()");
      const posExec = bloco.indexOf("aoConfirmarExecutado()");
      const posEscrever = bloco.indexOf(".escrever(", posExec);
      expect(posEscrever, arquivo).toBeGreaterThan(posExec);
      // Entre a saída da confirmação e o despacho não entra cancelamento.
      expect(bloco.slice(posExec, posEscrever)).not.toContain("aoCancelarConfirmacao");
    }
  });
});

// ═════════════════════════════════ BAIXO #6/#7 — as regiões vivas ═
describe("BAIXO #6 e #7 — o 'Desfazer' nunca fica sozinho, nem colado na confirmação", () => {
  it("PRONTO QUANDO: texto e botão do desfazer saem do MESMO valor (tipo, não disciplina)", () => {
    for (const [arquivo, tipo] of [
      ["components/task/notas-painel.tsx", "JanelaDeDesfazerNota"],
      ["components/task/relacoes-painel.tsx", "JanelaDeDesfazerAresta"],
      ["components/task/relacoes-painel.tsx", "JanelaDeDesfazerCriacao"],
    ] as const) {
      const src = codigoDoArquivo(arquivo);
      const i = src.indexOf(`interface ${tipo} {`);
      expect(i, `${arquivo} — ${tipo}`).toBeGreaterThan(0);
      const bloco = src.slice(i, src.indexOf("\n}", i));
      expect(bloco, tipo).toContain("texto: string;");
    }
  });

  it("PRONTO QUANDO: o desfazer que FALHA não apaga a região do desfazer (BAIXO #6)", () => {
    // Era o `limpar()` do `aoFalha` que deixava o `<p role=status>` com o
    // conteúdo `"Desfazer"` — só o botão, sem frase.
    for (const arquivo of [
      "components/task/notas-painel.tsx",
      "components/task/relacoes-painel.tsx",
    ]) {
      const src = codigoDoArquivo(arquivo);
      expect(src, arquivo).toContain("textoDeFalha:");
      expect(src, arquivo).not.toMatch(/aoFalha:[\s\S]{0,200}limparAnuncio\(\)/);
    }
  });

  it("PRONTO QUANDO: a confirmação e o desfazer moram em regiões vivas DIFERENTES (BAIXO #7)", () => {
    for (const arquivo of [
      "components/task/notas-painel.tsx",
      "components/task/relacoes-painel.tsx",
    ]) {
      const src = codigoDoArquivo(arquivo);
      // As transições de confirmação vão para a região de ANÚNCIOS…
      expect(src, arquivo).toMatch(/regiaoDeAnuncios\.mostrar\(t\.anuncio\)/);
      // …e o botão Desfazer mora num `<p role="status">` próprio, cujo
      // conteúdo é o `texto` da janela, nunca a mensagem geral.
      expect(src, arquivo).toContain("{`${desfazer.texto} `}");
    }
  });
});

describe("depois do sucesso, o foco NUNCA fica no <body> — as 15 operações", () => {
  for (const caso of OPERACOES) {
    it(`PRONTO QUANDO: ${caso.op} entrega o foco a ${caso.alvo}`, () => {
      const doc = { activeElement: BODY as unknown };
      const alvo = elementoFalso(caso.alvo, true, doc);
      const alternativa =
        caso.alternativa === null ? null : elementoFalso(caso.alternativa, true, doc);
      const anunciados: string[] = [];
      concluirEscrita(caso.op, alvo, alternativa, (t) => anunciados.push(t), undefined, doc);
      expect(doc.activeElement).not.toBe(BODY);
      expect((doc.activeElement as { nome: string }).nome).toBe(caso.alvo);
      expect(anunciados).toEqual([ANUNCIO_DE_SUCESSO[caso.op]]);
    });

    it(`${caso.op}: alvo que já saiu da árvore cai na alternativa, nunca no <body>`, () => {
      const doc = { activeElement: BODY as unknown };
      const alvo = elementoFalso(caso.alvo, false, doc); // não aceita foco
      const alternativa =
        caso.alternativa === null ? null : elementoFalso(caso.alternativa, true, doc);
      concluirEscrita(caso.op, alvo, alternativa, () => undefined, undefined, doc);
      if (caso.alternativa === null) {
        // Sem plano B: o foco fica ONDE ESTAVA. Isso só é seguro porque
        // nenhum controle desta página vira `disabled`.
        expect(doc.activeElement).toBe(BODY);
      } else {
        expect(doc.activeElement).not.toBe(BODY);
        expect((doc.activeElement as { nome: string }).nome).toBe(caso.alternativa);
      }
    });
  }
});

describe("fiação: cada operação está de fato ligada no componente que a executa", () => {
  for (const caso of OPERACOES) {
    it(`PRONTO QUANDO: ${caso.arquivo} abre a porta "${caso.op}" e escreve por ela`, () => {
      const porta = portasDeclaradas(caso.arquivo).find((p) => p.op === caso.op);
      expect(porta, caso.op).toBeDefined();
      expect(porta?.temAlvo, caso.op).toBe(true);
      const sitios = varrer().filter(
        (s) => s.arquivo === caso.arquivo && s.op === caso.op,
      );
      expect(sitios.length, `${caso.op} nunca escreve`).toBeGreaterThan(0);
    });
  }

  it("PRONTO QUANDO: o segmentado não engole mais o clique durante a gravação (BAIXO #4)", () => {
    const src = codigoDoArquivo("components/task/controle-segmentado.tsx");
    expect(src).not.toContain("if (desabilitado) return");
    expect(src).toContain("aoMudar(valor)");
  });

  it("PRONTO QUANDO: nenhum componente da página usa o atributo `disabled` (ALTO #1)", () => {
    // É ESTE atributo que faz o navegador tirar o foco do elemento — inclusive
    // quando ele vira `disabled` NO INSTANTE DO SUCESSO.
    const arquivos = [...new Set(OPERACOES.map((c) => c.arquivo))].concat([
      "components/task/controle-segmentado.tsx",
    ]);
    for (const arquivo of arquivos) {
      const semAria = codigoDoArquivo(arquivo).replace(/aria-disabled/g, "");
      expect(semAria.includes("disabled="), arquivo).toBe(false);
    }
  });
});

describe("decidirEscrita — a porta única de toda escrita", () => {
  it("PRONTO QUANDO: gravação em curso recusa com 'aguardar' (e a recusa FALA — BAIXO #4)", () => {
    expect(decidirEscrita({ pendente: true })).toBe("aguardar");
    expect(mensagemDeRecusa("mae", "aguardar")).toBe(MENSAGEM_AGUARDE);
    for (const { op } of OPERACOES) {
      expect(mensagemDeRecusa(op, "aguardar"), op).toBe(MENSAGEM_AGUARDE);
    }
  });

  it("PRONTO QUANDO: valor igual ao confirmado não grava (MÉDIO #3 — 6 Enters, 6 POSTs)", () => {
    expect(decidirEscrita({ pendente: false, mudou: false })).toBe("sem_mudanca");
    expect(decidirEscrita({ pendente: false, mudou: true })).toBe("gravar");
    expect(mensagemDeRecusa("status", "sem_mudanca")).toBeNull();
    expect(mensagemDeRecusa("mae", "sem_mudanca")).toBeNull();
    expect(mensagemDeRecusa("meta", "sem_mudanca")).toBeNull();
    expect(MENSAGEM_SEM_MUDANCA.duracao).toBeDefined();
    expect(MENSAGEM_SEM_MUDANCA.atomos_salvar).toBeDefined();
  });

  it("PRONTO QUANDO: formulário inválido recusa com frase em português, não com um botão morto", () => {
    expect(decidirEscrita({ pendente: false, valido: false })).toBe("invalido");
    for (const op of ["nota_criar", "subtarefa_criar", "relacao_criar", "atomos_salvar"] as const) {
      expect(MENSAGEM_INVALIDO[op], op).toBeDefined();
      expect(mensagemDeRecusa(op, "invalido"), op).toBe(MENSAGEM_INVALIDO[op]);
    }
    // As exclusões usam `valido: false` como "ainda não é hora de gravar" —
    // recusa silenciosa por desenho (o 1º clique só pede confirmação).
    expect(mensagemDeRecusa("nota_excluir", "invalido")).toBeNull();
    expect(mensagemDeRecusa("relacao_excluir", "invalido")).toBeNull();
  });

  it("a ordem das recusas: gravação em curso vence validade, que vence 'nada mudou'", () => {
    expect(decidirEscrita({ pendente: true, valido: false, mudou: false })).toBe("aguardar");
    expect(decidirEscrita({ pendente: false, valido: false, mudou: false })).toBe("invalido");
    expect(decidirEscrita({ pendente: false, valido: true, mudou: false })).toBe("sem_mudanca");
    expect(decidirEscrita({ pendente: false })).toBe("gravar");
  });

  it("recusarEscrita põe cada mensagem no canal certo: erro no alerta, notícia na região viva", () => {
    const anunciado: string[] = [];
    const alertado: string[] = [];
    const sinais = {
      anunciar: (t: string) => anunciado.push(t),
      alertar: (t: string) => alertado.push(t),
    };
    recusarEscrita("nota_criar", "invalido", sinais);
    recusarEscrita("nota_criar", "aguardar", sinais);
    recusarEscrita("duracao", "sem_mudanca", sinais);
    recusarEscrita("status", "sem_mudanca", sinais); // silenciosa por desenho
    expect(alertado).toEqual([MENSAGEM_INVALIDO.nota_criar]);
    expect(anunciado).toEqual([MENSAGEM_AGUARDE, MENSAGEM_SEM_MUDANCA.duracao]);
  });
});

describe("o desfazer devolve a nota à DATA e à POSIÇÃO originais (MÉDIO #4, rodada 7)", () => {
  it("PRONTO QUANDO: a migration 0017 aceita `criado_em` em nota_add e aresta_add", () => {
    const migration = readFileSync(
      fileURLToPath(
        new URL(
          "../../supabase/migrations/0017_lifeboard_v3_restaurar_nota_e_aresta.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    const notaAdd = migration.slice(migration.indexOf("if p_op = 'nota_add'"));
    const insertNota = notaAdd.slice(0, notaAdd.indexOf("nota_del"));
    expect(insertNota).toContain(
      "insert into public.task_notes (task_id, texto, autor, owner, created_at)",
    );
    expect(insertNota).toContain("coalesce(v_criado_em, now())");

    const arestaAdd = migration.slice(migration.indexOf("elsif p_op = 'aresta_add'"));
    const insertAresta = arestaAdd.slice(0, arestaAdd.indexOf("aresta_del"));
    expect(insertAresta).toContain(
      "insert into public.task_edges (origem, destino, tipo, peso, nota, owner, created_at)",
    );
    expect(insertAresta).toContain("coalesce(v_criado_em, now())");

    expect(migration).toContain("A data original não é uma data válida.");
    expect(migration).toContain("A data original não pode estar no futuro.");
  });

  it("PRONTO QUANDO: a frase do desfazer parou de dizer '(como nova)'", () => {
    expect(ANUNCIO_DE_SUCESSO.nota_desfazer).toBe("Nota restaurada.");
    expect(ANUNCIO_DE_SUCESSO.relacao_desfazer_exclusao).toBe("Relação restaurada.");
    expect(ANUNCIO_DE_SUCESSO.nota_desfazer).not.toContain("como nova");
    expect(ANUNCIO_DE_SUCESSO.relacao_desfazer_exclusao).not.toContain("como nova");
  });

  /**
   * [rodada 12] A MEDIÇÃO DE VERDADE MUDOU DE LUGAR. Este teste casava a
   * EXPRESSÃO exata (`criado_em: janela?.x.criadoEm ?? ""`) — é a mesma
   * classe de trava que o ALTO #2 desta rodada derrubou: ela mede a forma do
   * texto, não o que o pedido carrega. Quem mede o pedido agora é
   * `tarefa-handlers-vivos.test.tsx` ("o pedido do desfazer carrega a NOTA
   * original" e "tipo, peso e data original continuam viajando"), disparando
   * o botão de verdade contra a Server Action espiã. Aqui fica só a segunda
   * rede, e frouxa de propósito: a data original é MENCIONADA nos dois
   * painéis.
   */
  /**
   * ═════════════════════════════════════════════════════ MÉDIO #6, rodada 13 ═
   * A LISTA DERIVADA × UM DETECTOR INDEPENDENTE.
   *
   * `escritoresDoFixtureStore()` deriva a superfície pelo grafo de chamadas.
   * Este teste não confia nela: refaz a pergunta do jeito mais burro possível
   * — o corpo do export contém uma escrita de coleção? — e exige que tudo o
   * que ele acha esteja na superfície. Sabotar a derivação (tirar um nome)
   * deixa esta asserção vermelha, que é o ponto: duas leituras independentes
   * discordando é o sinal.
   */
  it("PRONTO QUANDO: a superfície do store do fixture cobre todo export que muda a loja", () => {
    const funcoes = funcoesDoModulo("lib/repositories/tasks.fixture-store.ts");
    const exportados = new Set(exportsDeValor("lib/repositories/tasks.fixture-store.ts"));
    const mutamAOlhoNu = [...funcoes]
      .filter(
        ([nome, corpo]) =>
          exportados.has(nome) &&
          (/\.\s*(?:set|delete|clear)\s*\(/.test(corpo) ||
            /__lifeboardFixtureStore\s*=[^=]/.test(corpo)),
      )
      .map(([nome]) => nome)
      .sort();
    const superficie = superficieDeEscrita()[MODULO_DO_FIXTURE_STORE] ?? [];
    const esquecidos = mutamAOlhoNu.filter((n) => !superficie.includes(n));
    expect(
      esquecidos,
      `export que muda a loja e não está na superfície:\n${esquecidos.join("\n")}`,
    ).toEqual([]);
    // Os dois que a lista escrita à mão esquecia, e que o crítico usou para
    // apagar as notas da tarefa por uma rota de API de 11 linhas.
    expect(escritoresDoFixtureStore()).toContain("resetarFixtureStore");
    expect(escritoresDoFixtureStore()).toContain("definirPredecessorIdsFixture");
    // E a derivação não pode ser mais curta que o detector burro.
    expect(superficie.length).toBeGreaterThanOrEqual(mutamAOlhoNu.length);
  });

  /**
   * ═══════════════════════════════════════════════ CRÍTICO #1 e #2, rodada 13 ═
   * A GUARDA DO GÊMEO QUE FICA PARA TRÁS.
   *
   * A rodada 10 corrigiu três formulários e deixou dois com a marca de estado
   * ANTES do veredito da porta. Nada avisou, e duas rodadas depois a duração
   * anunciava o desfecho oposto ao que gravou e os átomos travavam num trio
   * que o servidor nunca recebeu. Esta é a rede que faltava: nenhum sítio de
   * escrita da página pode marcar estado antes de saber se a porta aceitou.
   */
  it("PRONTO QUANDO: nenhum formulário marca estado antes do veredito da porta", () => {
    const achados = marcasAntesDoVeredito().map(
      (a) => `${a.arquivo}:${String(a.linha)} — ${a.marca} antes do escrever( da linha ${String(a.escritaNaLinha)}`,
    );
    expect(achados, `estado marcado antes do veredito:\n${achados.join("\n")}`).toEqual([]);
  });

  /**
   * ═══════════════════════════════════════════════════════ ALTO #1, rodada 14 ═
   * O REFORÇO DEIXA DE SER LISTA DE NOMES — ELE É A PROVA, ARQUIVO POR ARQUIVO.
   *
   * O teste anterior lia o fonte de DOIS arquivos escritos à mão aqui
   * (`duracao-form`, `atomos-form`) e conferia uma string. `status-form`,
   * `mae-form` e `meta-form` ficavam só com a guarda derivada — e a guarda
   * derivada não via `(tentativaRef).current = novo`. O crítico pôs exatamente
   * isso em `status-form.tsx`, com os quatro portões verdes, e no Chromium a
   * tela anunciou o desfecho do segundo clique enquanto o servidor gravava o do
   * primeiro.
   *
   * Aqui a lista é DERIVADA (`arquivosQueChamamAPorta`) e a guarda é PROVADA:
   * em cada arquivo que chama a porta, a sabotagem é injetada no texto — em
   * cinco grafias diferentes, inclusive as que a regex antiga não via — e a
   * guarda tem de acusar. Arquivo novo com porta nova entra sozinho.
   */
  it("PRONTO QUANDO: a guarda vê a marca antes do veredito em TODO arquivo que chama a porta, em 5 grafias", () => {
    const arquivos = arquivosQueChamamAPorta();
    // Alvo ausente é reprovação, nunca dispensa: se a derivação parar de achar
    // arquivos, este teste cai em vez de passar no vazio.
    expect(arquivos.length, "a derivação não achou arquivo que chame a porta").toBeGreaterThanOrEqual(5);
    const grafias = [
      "tentativaRef.current = 1;",
      "(tentativaRef).current = 1;",
      "(tentativaRef as { current: number }).current = 1;",
      'tentativaRef["current"] = 1;',
      "(a ?? tentativaRef).current = 1;",
    ];
    const cegueiras: string[] = [];
    for (const arquivo of arquivos) {
      const src = codigoDoArquivo(arquivo);
      // Sem sabotagem: limpo. (Se não estiver, o próprio teste acima acusa.)
      const alvo = src.indexOf("escrever(");
      expect(alvo, `${arquivo}: não achei a chamada da porta`).toBeGreaterThan(0);
      // O começo do comando que contém a chamada — é ali que a marca entra.
      const inicioDoComando = src.lastIndexOf("\n", src.lastIndexOf("=", alvo)) + 1;
      for (const grafia of grafias) {
        const sabotado = `${src.slice(0, inicioDoComando)}    ${grafia}\n${src.slice(inicioDoComando)}`;
        if (marcasNoTexto(sabotado).length === 0) cegueiras.push(`${arquivo} — ${grafia}`);
      }
    }
    expect(
      cegueiras,
      `a guarda NÃO vê a marca antes do veredito:\n${cegueiras.join("\n")}`,
    ).toEqual([]);
  });

  /**
   * E os cinco formulários continuam escrevendo o ref DEPOIS do veredito — a
   * lista dos refs sai do fonte (toda atribuição a `.current` no arquivo),
   * nunca de dois nomes escolhidos à mão.
   */
  it("PRONTO QUANDO: todo ref de tentativa é escrito sob `decisao === \"gravar\"`", () => {
    const fora: string[] = [];
    for (const arquivo of arquivosQueChamamAPorta()) {
      const src = codigoDoArquivo(arquivo);
      for (const a of atribuicoesAPropriedade(src)) {
        if (a.prop !== "current") continue;
        // Só as marcas que estão DEPOIS de uma decisão, no mesmo comando: o
        // que se cobra é o `if (decisao === "gravar")` em volta.
        const antes = src.slice(Math.max(0, a.indice - 400), a.indice);
        if (!/const\s+decisao\s*=/.test(antes)) continue;
        if (!/decisao === "gravar"/.test(antes)) {
          fora.push(`${arquivo}: ${a.esquerda.trim()} = fora do veredito`);
        }
      }
    }
    expect(fora, `ref de tentativa escrito sem veredito:\n${fora.join("\n")}`).toEqual([]);
  });

  /**
   * ══════════════════════════════════════════════════════════ ALTO #2, rodada 14 ═
   * TODA ESCRITA QUE APAGA DADO TEM CAMINHO DE VOLTA.
   *
   * "Limpar átomos" apagava os três números que alimentam o score de prioridade
   * com UM clique, sem confirmação e sem desfazer, enquanto na MESMA página
   * apagar uma relação ou uma nota custava dois cliques e abria 10 s de
   * "Desfazer". A régua sai das OPERAÇÕES declaradas (`_excluir`/`_limpar`), não
   * de uma lista de arquivos: operação destrutiva nova nasce cobrada.
   */
  it("PRONTO QUANDO: toda porta que APAGA dado tem porta de desfazer e janela na tela", () => {
    const problemas: string[] = [];
    let destrutivas = 0;
    for (const arquivo of arquivosVarridos()) {
      const portas = portasDeclaradas(arquivo);
      const desfazem = portas.filter((p) => p.op !== null && /desfazer/.test(p.op));
      const src = codigoDoArquivo(arquivo);
      for (const p of portas) {
        if (p.op === null || !/_(?:excluir|limpar)$/.test(p.op)) continue;
        destrutivas += 1;
        if (desfazem.length === 0) {
          problemas.push(`${arquivo}: ${p.op} apaga e o arquivo não declara porta de desfazer`);
        }
        // O sucesso da escrita destrutiva não pode ir para a região geral: ele
        // mora colado ao botão "Desfazer" (é o que abre a janela de 10 s).
        const bloco = blocoDepois(src, p.indice);
        if (!/anunciarSucesso/.test(bloco)) {
          problemas.push(`${arquivo}: ${p.op} não abre janela de desfazer (sem anunciarSucesso)`);
        }
      }
      if (
        portas.some((p) => p.op !== null && /_(?:excluir|limpar)$/.test(p.op)) &&
        !/>\s*Desfazer\s*</.test(src)
      ) {
        problemas.push(`${arquivo}: apaga dado e não tem botão "Desfazer" na tela`);
      }
    }
    // Alvo ausente é reprovação: se a derivação parar de achar operação
    // destrutiva, este teste cai em vez de passar no vazio.
    expect(destrutivas, "a derivação não achou operação destrutiva").toBe(3);
    expect(problemas, `escrita que apaga sem volta:\n${problemas.join("\n")}`).toEqual([]);
  });

  it("PRONTO QUANDO: os dois painéis mandam a data original junto do desfazer", () => {
    for (const arquivo of [
      "components/task/notas-painel.tsx",
      "components/task/relacoes-painel.tsx",
    ]) {
      const src = codigoDoArquivo(arquivo);
      expect(src, arquivo).toMatch(/criado_em:\s*[^,\n]*criadoEm/);
    }
  });
});


/**
 * ═══════════════════════════════════════════════════════ ALTO #1, rodada 15 ═
 * O "DESFAZER" NÃO PODE APAGAR O CAMINHO DE VOLTA QUE ELE PROMETE.
 *
 * Medido pelo crítico da rodada 15, no Chromium, com a rota segurando o POST
 * 3 s e depois abortando, clique no "Desfazer" aos 8,5 s da janela de 10 s:
 *
 *   P5 mensagens: "Não foi possível desfazer — a nota continua excluída."
 *   P5 botão Desfazer na tela: 0
 *   P5 notas depois: [a nota excluída NÃO voltou]
 *
 * O texto da nota existia em UM lugar só (`desfazer.nota.texto`), e o relógio
 * de 10 s descartou esse valor NO MEIO da chamada de desfazer. Quando a falha
 * chegou, não havia botão, não havia texto, e não havia como recuperar — o
 * comentário do `textoDeFalha` prometia um botão "que continua na tela" que o
 * relógio do próprio painel tinha acabado de tirar. Conteúdo do operador
 * destruído, sem caminho de volta.
 *
 * A régua aqui é DERIVADA: toda janela de desfazer da página, achada pelo
 * código (relógio `JANELA_DESFAZER_MS` + porta com `desfazer` na `op`), tem de
 * fechar o relógio no despacho e ter frase para a recusa.
 *
 * ═══════════════════════════════════════════════════════ MÉDIO #4, rodada 16 ═
 * O QUE ESTE BLOCO AFIRMAVA E NÃO CUMPRIA.
 *
 * Até a rodada 15 estava escrito aqui: *"A quinta janela que nascer sem isso
 * fica vermelha sem ninguém lembrar de acrescentar nome a lista nenhuma."*
 * Era falso por um motivo mecânico. A varredura casava
 *
 *     /const\s+(\w+)\s*=\s*usarPortaDeEscrita\(\{\s*\n\s*op:\s*"(\w*desfazer\w*)"/g
 *
 * — `op:` **na linha seguinte**. Uma quinta janela escrita em UMA LINHA SÓ, com
 * uma `op` de desfazer que já existe e sem fechar o relógio no despacho,
 * passava pelos cinco portões: `janelasDeDesfazer()` seguia listando quatro, e
 * as três asserções abaixo continuavam verdes sobre uma janela que elas nunca
 * tinham visto. Medido pelo coordenador antes do crítico.
 *
 * A varredura era derivada da GRAFIA, não da CLASSE. Agora a porta é achada
 * por `portasNoTexto` (declaração + bloco balanceado + `opDoBloco`), que é a
 * mesma máquina que resolve as `op` do resto deste arquivo desde a rodada 9.
 *
 * E a afirmação deixou de ser só uma frase: o quarto teste deste bloco INJETA
 * a quinta janela no fonte real, nas duas formas que passavam, e exige que a
 * varredura a veja e a marque como aberta. O que continua sendo verdade, dito
 * com precisão: **uma janela nova fica vermelha sozinha; ficar verde é que
 * exige acrescentar o nome dela na lista abaixo** — de propósito, mesma lei de
 * `MEDIDAS_EXIGIDAS`.
 */
describe("ALTO #1 — as janelas de Desfazer da página", () => {
  it("PRONTO QUANDO: a varredura ACHA as janelas (lista vazia não é aprovação)", () => {
    const janelas = janelasDeDesfazer();
    /*
     * O piso é escrito à mão: quatro janelas hoje — átomos (limpeza), nota
     * (exclusão), relação (criação) e relação (exclusão). O crítico nomeou
     * três; a quarta é da mesma classe, no mesmo arquivo.
     */
    const PISO_DE_JANELAS = 4;
    expect(
      janelas.length,
      "a varredura de janelas de Desfazer parou de achar janela — lista vazia é cegueira, não aprovação",
    ).toBeGreaterThanOrEqual(PISO_DE_JANELAS);
    // E as quatro pelo NOME: sem isto o piso poderia ser cumprido por quatro
    // portas quaisquer enquanto justamente estas ficassem invisíveis.
    expect(
      janelas.map((j) => j.op).sort(),
      "uma das quatro janelas de desfazer da página saiu da varredura",
    ).toEqual([
      "atomos_desfazer_limpeza",
      "nota_desfazer",
      "relacao_desfazer_criacao",
      "relacao_desfazer_exclusao",
    ]);
  });

  it("PRONTO QUANDO: toda janela FECHA o relógio no instante em que despacha o desfazer", () => {
    const abertas = janelasDeDesfazer()
      .filter((j) => !j.fechaORelogioNoDespacho)
      .map((j) => `${j.arquivo} (${j.op})`);
    expect(
      abertas,
      "janela(s) de Desfazer cujo relógio de 10 s continua correndo durante a chamada — é ele que apaga o texto, o botão E o dado a restaurar:\n" +
        abertas.join("\n"),
    ).toEqual([]);
  });

  /**
   * A PROVA de que a varredura é da CLASSE, e não da grafia — a sabotagem
   * injetada no fonte real, nas duas formas que passavam antes da rodada 16.
   */
  it("PRONTO QUANDO: a quinta janela escrita EM UMA LINHA SÓ é vista e marcada como aberta", () => {
    const arquivo = "components/task/notas-painel.tsx";
    const original = codigoDoArquivo(arquivo);
    const antes = janelasNoTexto(arquivo, original);
    expect(antes.length, "a varredura não acha a janela que JÁ existe neste arquivo").toBe(1);

    // Forma 1: declaração em uma linha só, sem despacho nenhum.
    const soDeclarada = original.replace(
      "export function NotasPainel(",
      'const portaQuinta = usarPortaDeEscrita({ op: "nota_desfazer", alvo: () => null });\n\nexport function NotasPainel(',
    );
    const comDeclarada = janelasNoTexto(arquivo, soDeclarada);
    expect(
      comDeclarada.length,
      "a quinta janela declarada em UMA LINHA passou pela varredura — é a grafia de novo",
    ).toBe(2);
    expect(
      comDeclarada.filter((j) => j.porta === "portaQuinta").map((j) => j.fechaORelogioNoDespacho),
      "janela sem despacho nenhum não pode contar como janela que fecha o relógio",
    ).toEqual([false]);

    // Forma 2: declaração em uma linha SÓ + despacho que não fecha o relógio.
    const comDespacho = original.replace(
      "export function NotasPainel(",
      'const portaQuinta = usarPortaDeEscrita({ op: "nota_desfazer", alvo: () => null });\n' +
        "function quintaJanela(): void { portaQuinta.escrever({}); }\n\nexport function NotasPainel(",
    );
    const achadas = janelasNoTexto(arquivo, comDespacho);
    expect(
      achadas.map((j) => j.porta).sort(),
      "a quinta janela COM despacho continuou invisível para a varredura",
    ).toEqual(["portaDesfazer", "portaQuinta"]);
    expect(
      achadas.filter((j) => j.porta === "portaQuinta").map((j) => j.fechaORelogioNoDespacho),
      "a quinta janela despacha sem fechar o relógio e a varredura disse que fecha",
    ).toEqual([false]);
    // E a janela que JÁ existe continua sendo lida como fechada — a régua nova
    // não pode ficar vermelha para o código correto.
    expect(
      achadas.filter((j) => j.porta === "portaDesfazer").map((j) => j.fechaORelogioNoDespacho),
      "a janela que existe e fecha o relógio passou a ser lida como aberta",
    ).toEqual([true]);
  });

  it("PRONTO QUANDO: nenhuma recusa de desfazer é silenciosa", () => {
    const mudas = janelasDeDesfazer()
      .filter((j) => {
        const frase = MENSAGEM_INVALIDO[j.op as OperacaoDeEscrita];
        return typeof frase !== "string" || frase.trim().length === 0;
      })
      .map((j) => j.op);
    expect(
      mudas,
      `op(s) de desfazer sem frase em MENSAGEM_INVALIDO — a recusa some em silêncio: ${mudas.join(", ")}`,
    ).toEqual([]);
    // A frase tem de dizer o que CONTINUA valendo, não só que deu errado.
    for (const janela of janelasDeDesfazer()) {
      const frase = MENSAGEM_INVALIDO[janela.op as OperacaoDeEscrita] ?? "";
      expect(
        /janela de desfazer fechou/i.test(frase),
        `a frase de ${janela.op} não diz que a janela fechou: ${JSON.stringify(frase)}`,
      ).toBe(true);
    }
  });
});


/**
 * ═══════════════════════════════════════════════════════ MÉDIO #1, rodada 15 ═
 * NENHUM CAMPO NUMÉRICO DA PÁGINA NASCE MUDO SOBRE O QUE ACONTECE COM O QUE
 * FOI DIGITADO.
 *
 * O crítico mediu dois campos de duração lado a lado, mesmo desenho, mesmo
 * teclado, comportamentos opostos — um guarda rascunho, o outro perde — e
 * nenhum sinal na tela que os distinguisse (`grep` por "não salvo|sem
 * salvar|alterações" em `components/task/`: zero ocorrências).
 *
 * A régua é DERIVADA do JSX: todo arquivo com `<CampoNumerico>` tem de trazer
 * um `<AvisoNaoSalvo>`, e a frase tem de casar com o comportamento REAL do
 * campo — quem grava rascunho usa `AVISO_COM_RASCUNHO`, quem não grava usa
 * `AVISO_SEM_RASCUNHO`. Trocar uma pela outra é mentir sobre o dado, que é a
 * família inteira dos CRÍTICOs desta peça.
 */
describe("MÉDIO #1 — a tela diz o que acontece com o que foi digitado", () => {
  it("PRONTO QUANDO: todo arquivo com <CampoNumerico> traz um <AvisoNaoSalvo>", () => {
    const comCampo = arquivosDoSrc().filter((a) => codigoDoArquivo(a).includes("<CampoNumerico"));
    // Piso: três campos numéricos hoje (duração da tarefa, duração da
    // subtarefa, desconto da sinergia). Lista vazia é cegueira, não aprovação.
    expect(
      comCampo.length,
      "a varredura não achou arquivo nenhum com <CampoNumerico> — a régua parou de medir",
    ).toBeGreaterThanOrEqual(3);
    const mudos = comCampo.filter((a) => !codigoDoArquivo(a).includes("<AvisoNaoSalvo"));
    expect(
      mudos,
      `arquivo(s) com campo numérico e sem aviso de "não salvo": ${mudos.join(", ")}`,
    ).toEqual([]);
  });

  it("PRONTO QUANDO: a frase de cada campo casa com o que ele REALMENTE faz com o rascunho", () => {
    const numericos = camposDeTextoLivre().filter((c) => c.tag === "CampoNumerico");
    expect(
      numericos.length,
      "a varredura derivada parou de achar campo numérico — lista vazia é cegueira",
    ).toBeGreaterThanOrEqual(3);
    const errados: string[] = [];
    for (const campo of numericos) {
      const src = codigoDoArquivo(campo.arquivo);
      const usaComRascunho = src.includes("AVISO_COM_RASCUNHO");
      const usaSemRascunho = src.includes("AVISO_SEM_RASCUNHO");
      if (campo.gravaRascunho && !usaComRascunho) {
        errados.push(`${campo.arquivo}: grava rascunho e NÃO usa AVISO_COM_RASCUNHO`);
      }
      if (!campo.gravaRascunho && !usaSemRascunho) {
        errados.push(`${campo.arquivo}: NÃO grava rascunho e não usa AVISO_SEM_RASCUNHO`);
      }
    }
    expect(
      errados,
      `campo numérico cuja frase mente sobre o rascunho:\n${errados.join("\n")}`,
    ).toEqual([]);
    // E as duas frases existem, e são DIFERENTES: uma frase só não distingue
    // nada, que é o estado em que o crítico achou a página.
    expect(AVISO_COM_RASCUNHO).not.toEqual(AVISO_SEM_RASCUNHO);
    for (const frase of [AVISO_COM_RASCUNHO, AVISO_SEM_RASCUNHO]) {
      expect(frase, "a frase do aviso precisa dizer 'Não salvo' em português").toContain(
        "Não salvo",
      );
    }
  });

  it("PRONTO QUANDO: o aviso é DESCRIÇÃO do campo, não mais uma região viva", () => {
    const src = codigoDoArquivo("components/task/aviso-nao-salvo.tsx");
    expect(
      src,
      'o aviso virou `role="status"`: ele muda a cada tecla, e uma região viva que fala a cada tecla é ruído',
    ).not.toContain('role="status"');
    expect(src, "o aviso deixou de ter `id` — sem ele o `aria-describedby` não aponta nada").toContain(
      "id={id}",
    );
    // E os três campos apontam para ele.
    const apontam = arquivosDoSrc().filter((a) => codigoDoArquivo(a).includes("descricaoId="));
    expect(
      apontam.length,
      "nenhum campo aponta o aviso em `aria-describedby` — a frase existe e ninguém a lê",
    ).toBeGreaterThanOrEqual(3);
    expect(
      codigoDoArquivo("components/task/campo-numerico.tsx"),
      "o <input> deixou de repassar a descrição",
    ).toContain("aria-describedby={descricaoId}");
  });
});


/**
 * ═══════════════════════════════════════════════════════ BAIXO #1, rodada 15 ═
 * A VARREDURA DE `<input>` NÃO DEPENDE MAIS DE ONDE O `type=` ESTÁ NA TAG.
 *
 * Provado contra o TEXTO, e não contra o `src/`: a régua tem de valer para a
 * próxima edição inofensiva, não só para a de hoje.
 */
describe("BAIXO #1 — a varredura de <input> lê a tag inteira", () => {
  it("PRONTO QUANDO: a varredura ACHA a tag do campo numérico e a lê como `text`", () => {
    const doCampo = tagsDeInput().filter(
      (t) => t.arquivo === "components/task/campo-numerico.tsx",
    );
    expect(doCampo.length, "a tag do <input> do campo numérico sumiu da varredura").toBe(1);
    expect(
      /\btype="text"/.test(doCampo[0]?.tag ?? ""),
      "a tag achada não é a do campo de texto",
    ).toBe(true);
    // E a tag vai até o FIM: `aria-describedby`, `value` e `onChange` vêm
    // depois de um atributo com `=>` e têm de estar dentro dela.
    expect(
      (doCampo[0]?.tag ?? "").includes("onChange"),
      "a tag foi cortada antes do fim — é o defeito do `[^>]*` parando no `>` de um `=>`",
    ).toBe(true);
  });

  it("PRONTO QUANDO: um atributo com `=>` ANTES do type não cega a varredura", () => {
    // O caso exato do crítico: `ref={(el) => {…}}` posto antes de `type=`.
    // A prova é sobre o leitor, com texto de mentira — o `src/` de verdade
    // não precisa ganhar uma `ref` para esta régua existir.
    const antes = tagsDeInput().length;
    expect(antes, "a varredura não acha tag nenhuma").toBeGreaterThanOrEqual(6);
    // A régua real: nenhuma tag achada pode estar cortada no meio (toda tag
    // termina em `>` e tem as chaves emparelhadas).
    const cortadas = tagsDeInput().filter((t) => {
      if (!t.tag.endsWith(">")) return true;
      let nivel = 0;
      for (const c of t.tag) {
        if (c === "{") nivel += 1;
        else if (c === "}") nivel -= 1;
      }
      return nivel !== 0;
    });
    expect(
      cortadas.map((t) => `${t.arquivo}:${String(t.linha)}`),
      "tag(s) <input> lidas pela metade — a varredura voltou a parar no primeiro `>`",
    ).toEqual([]);
  });
});


/**
 * ═══════════════════════════════════════════════════════ CRÍTICO #2, rodada 15 ═
 * O DEPÓSITO DO NAVEGADOR SÓ SE ESCREVE ONDE ESTÁ DECLARADO — E NUNCA NA
 * CHAVE DO VIGIA.
 *
 * A guarda de navegador guarda o que o vigia viu numa chave de
 * `sessionStorage`. O crítico da rodada 15 fez a guarda mentir com um
 * `setInterval` de 1 s gravando `"[]"` ali. A defesa que carrega o peso é o
 * canal fora da página; esta é a rede barata, no texto: só os quatro lugares
 * declarados escrevem no depósito, e nenhum arquivo do `src/` sequer nomeia a
 * chave do vigia.
 *
 * A exceção do OPERADOR está declarada aqui, por arquivo E por motivo — é o
 * rascunho dele que justifica cada uma.
 */
describe("CRÍTICO #2 — quem escreve no depósito do navegador", () => {
  /** Arquivo → por que ele tem direito de gravar no depósito. */
  const PORTADORES_DE_DEPOSITO: Record<string, string> = {
    "components/task/rascunho.ts":
      "o rascunho dos campos de texto do OPERADOR — a exceção declarada desta régua",
    "components/graph/layer-toggle-panel.tsx": "quais camadas do grafo ficam visíveis (por leitor)",
    "components/timeline/linha-do-tempo.tsx": "o zoom escolhido na linha do tempo (por leitor)",
    "stores/source-filter.ts": "o filtro de fontes escolhido (por leitor)",
  };

  it("PRONTO QUANDO: a varredura ACHA as escritas no depósito (lista vazia é cegueira)", () => {
    const escritas = escritasNoDeposito();
    const PISO_DE_ESCRITAS = 4;
    expect(
      escritas.length,
      "a varredura de escritas no depósito parou de achar chamada — lista vazia não é aprovação",
    ).toBeGreaterThanOrEqual(PISO_DE_ESCRITAS);
    // E a exceção do operador em pessoa, pelo nome.
    expect(
      escritas.some((e) => e.arquivo === "components/task/rascunho.ts"),
      "a varredura não vê mais o rascunho do operador — é a exceção que esta régua existe para declarar",
    ).toBe(true);
  });

  it("PRONTO QUANDO: só os portadores DECLARADOS escrevem no depósito", () => {
    const intrusos = escritasNoDeposito()
      .filter((e) => !(e.arquivo in PORTADORES_DE_DEPOSITO))
      .map((e) => `${e.arquivo}:${String(e.linha)} → ${e.chamada}`);
    expect(
      intrusos,
      "arquivo(s) escrevendo no sessionStorage/localStorage sem estar na lista, com o motivo:\n" +
        intrusos.join("\n"),
    ).toEqual([]);
  });

  it("PRONTO QUANDO: nenhum arquivo do src/ toca a chave do vigia da guarda", () => {
    expect(
      arquivosQueCitamOVigia(),
      `arquivo(s) do produto citando ${CHAVE_DO_VIGIA_P6} ou __vigiaP6 — o produto não tem ` +
        "nada a dizer ao vigia da guarda, e quem o nomeia está mirando nele",
    ).toEqual([]);
  });
});
