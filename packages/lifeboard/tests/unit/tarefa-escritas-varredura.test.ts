import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ARQUIVO_DA_PORTA,
  arquivosDoSrc,
  arquivosUseServer,
  arquivosVarridos,
  camposDeErro,
  codigo as codigoDoArquivo,
  convertemOSelo,
  exportsDeValor,
  handlerDaConfirmacaoExecutada,
  importacoes,
  opDoBloco,
  PASTAS_VARRIDAS,
  portasDeclaradas,
  PORTADORES,
  quantasPortas,
  rotasDeFuga,
  SUPERFICIE_DE_ESCRITA,
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
    const numericos = tiposDeInput()
      .filter((i) => i.tipo === "number")
      .map((i) => `${i.arquivo}:${String(i.linha)}`);
    expect(
      numericos,
      `campo que esconde o que o operador digitou:\n${numericos.join("\n")}`,
    ).toEqual([]);
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
    for (const [modulo, nomes] of Object.entries(SUPERFICIE_DE_ESCRITA)) {
      console.log("  -", modulo, "→", nomes.join(", "));
    }
    console.log("Arquivos do src/ varridos:", String(arquivosDoSrc().length));
    console.log("Arquivos da página da tarefa:", String(arquivosVarridos().length));
    console.log("Pastas da página:", PASTAS_VARRIDAS.join(", "));
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
    expect(sitios.length).toBeGreaterThanOrEqual(14);
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
    expect(derivadas).toHaveLength(14);
  });

  it("a lista humana deste arquivo bate com a derivada (documentação, não fonte)", () => {
    expect(OPERACOES.map((c) => c.op).sort()).toEqual([...OPERACOES_DE_ESCRITA].sort());
    expect(OPERACOES).toHaveLength(14);
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

describe("depois do sucesso, o foco NUNCA fica no <body> — as 14 operações", () => {
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
