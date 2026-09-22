import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { OPERACOES_DE_ESCRITA } from "@/app/tarefa/pedido";

/**
 * OS-LIFEBOARD · P6 — ALTO #2 (conferência da rodada 13): GUARDA QUE NINGUÉM
 * RODA NÃO É GUARDA; É DOCUMENTAÇÃO.
 *
 * Medição do coordenador nas três branches do painel:
 *
 *   | peça | passos em `ci.yml` | entradas em `package.json` |
 *   |---|---|---|
 *   | P4 (`guarda-no-navegador.mjs`) | 0 | 1 (atalho só) |
 *   | P5 (`guarda-p5.mjs`)           | 0 | 0 |
 *   | P6 (`guarda-p6.mjs`)           | 0 | 0 |
 *
 * É a quinta variação do mesmo vício nesta base — a mesma que a rodada 14 da P7
 * fechou para o medidor de contraste. E é grave em dobro aqui: pela decisão da
 * rodada 13, **a completude desta peça mora no navegador** ("a varredura de
 * fonte é rede rápida, incompleta por construção"). A rede que carrega o peso
 * era a única que nada disparava.
 *
 * Este arquivo é o gatilho do gatilho: ele fica VERMELHO se o atalho do
 * `package.json` ou o passo de CI desaparecerem. Roda no `vitest`, que é o
 * portão barato — não precisa de navegador para dizer que o navegador ficou
 * sem gatilho.
 *
 * O nome do arquivo não é `guardas-com-gatilho.test.ts` de propósito: a P7 está
 * criando um arquivo com esse nome na rodada dela, na branch dela, e dois
 * arquivos de mesmo nome e conteúdo diferente colidiriam no merge.
 */

const AQUI = new URL(".", import.meta.url).pathname;
const PACOTE = join(AQUI, "..", "..");
const RAIZ_REPO = join(PACOTE, "..", "..");

const CAMINHO_DA_GUARDA = "tests/navegador/guarda-p6.mjs";

function pacote(): { scripts: Record<string, string> } {
  return JSON.parse(readFileSync(join(PACOTE, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
}
function ci(): string {
  return readFileSync(join(RAIZ_REPO, ".github", "workflows", "ci.yml"), "utf8");
}
function guarda(): string {
  return readFileSync(join(PACOTE, CAMINHO_DA_GUARDA), "utf8");
}

describe("ALTO #2 — a guarda no navegador da P6 tem gatilho de verdade", () => {
  it("existe como atalho do package.json (`npm run guarda:navegador`)", () => {
    expect(
      pacote().scripts["guarda:navegador"],
      "sem entrada no package.json a guarda só roda se alguém lembrar de digitá-la",
    ).toContain(CAMINHO_DA_GUARDA);
  });

  it("existe um job de CI que a CHAMA — não um comentário que fala dela", () => {
    const texto = ci();
    expect(texto, "o job `lifeboard-navegador` saiu do ci.yml").toContain("lifeboard-navegador:");
    expect(
      texto,
      "o job existe mas ninguém chama a guarda dentro dele — guarda sem gatilho é comentário",
    ).toMatch(/npm run guarda:navegador/);
  });

  /**
   * PREMISSA CORRIGIDA NA 2ª CORRIDA (22/09, PR #43). Este bloco dizia que "a
   * imagem de container é quem os traz", os dois — e isso era falso pela
   * metade: a imagem traz os NAVEGADORES em `/ms-playwright`, não o pacote
   * `playwright-core`. Como este repo não depende do Playwright, não havia nada
   * a achar, e o job reprovou em `playwright-core nao foi encontrado nesta
   * imagem`. Procurar melhor nunca resolveria.
   *
   * O desenho passou a ser: a imagem traz o navegador · o job instala o pacote
   * com `--no-save`, na versão lida da própria tag da imagem · o repo continua
   * sem depender do Playwright, o que este bloco segue conferindo.
   */
  it("a imagem traz o Chromium, o job instala o pacote, e o repo segue sem depender do Playwright", () => {
    const texto = ci();
    expect(
      texto,
      "a guarda precisa do Chromium, e quem o traz é a imagem de container",
    ).toMatch(/image: mcr\.microsoft\.com\/playwright:/);
    expect(
      texto,
      "sem o passo de instalação o `playwright-core` não existe em lugar nenhum: a imagem não o traz e o repo não depende dele",
    ).toContain("Instalar playwright-core na versao da imagem");
    expect(
      texto,
      "a instalação tem de ser `--no-save`: o repo não pode passar a depender do Playwright por causa de um job",
    ).toMatch(/npm install --no-save[^\n]*playwright-core@/);
    expect(
      texto,
      "a versão do pacote tem de ser LIDA da tag da imagem — número escrito à mão é a próxima divergência esperando acontecer",
    ).toMatch(/VERSAO="\$\(grep[^\n]*mcr[^\n]*ci\.yml/);
    expect(
      texto,
      "o módulo se RESOLVE pelo Node; procurá-lo por caminho amarra o job ao desenho interno da imagem, que foi o que quebrou na 2ª corrida",
    ).toContain('require.resolve("playwright-core")');
    const deps = JSON.parse(readFileSync(join(PACOTE, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const todas = { ...deps.dependencies, ...deps.devDependencies };
    for (const nome of Object.keys(todas)) {
      expect(
        /playwright/.test(nome),
        `${nome} entrou como dependência — a decisão desta rodada foi NÃO instalar pacote novo`,
      ).toBe(false);
    }
  });

  /**
   * Um passo que não pode reprovar não é gatilho. `continue-on-error`, `|| true`
   * e `if: false` transformam a guarda em enfeite sem nenhum diff óbvio.
   */
  it("o passo da guarda pode REPROVAR — nada de continue-on-error, `|| true` ou skip", () => {
    const texto = ci();
    const inicio = texto.indexOf("  lifeboard-navegador:");
    expect(inicio, "o job `lifeboard-navegador` não está no ci.yml").toBeGreaterThan(0);
    const fim = texto.indexOf("\n  story-validation:", inicio);
    expect(fim, "não achei o fim do job `lifeboard-navegador`").toBeGreaterThan(inicio);
    const bloco = texto.slice(inicio, fim);
    expect(bloco, "o job da guarda foi posto em continue-on-error").not.toMatch(
      /continue-on-error:\s*true/,
    );
    expect(bloco, "o job da guarda ganhou um `|| true`").not.toContain("|| true");
    expect(bloco, "o job da guarda foi desligado com `if: false`").not.toMatch(/if:\s*false/);
    // E ele reprova em voz alta quando o ambiente não tem o navegador — nunca
    // pula em silêncio, que é a forma preferida de um portão morrer.
    expect(bloco, "o job precisa falhar com mensagem quando não achar o playwright-core").toMatch(
      /::error::[\s\S]{0,400}exit 1/,
    );
  });

  /**
   * O limite declarado é parte da correção, não enfeite: se alguém apagar o
   * parágrafo que diz o que a guarda NÃO alcança, a guarda volta a prometer
   * mais do que entrega — que é o defeito que esta rodada veio consertar.
   */
  it("o cabeçalho da guarda continua declarando o alcance e o limite dela", () => {
    const texto = guarda();
    expect(texto, "o cabeçalho perdeu a declaração do que fica FORA de alcance").toContain(
      "O que continua fora de alcance",
    );
    expect(texto, "o cabeçalho perdeu o aviso de que o job de CI nunca foi executado").toContain(
      "nunca EXECUTADO",
    );
  });
});

/**
 * CRÍTICO da rodada 14 — o VIGIA não pode sair sem que alguém veja.
 *
 * A correção do CRÍTICO desta rodada é um vigia instalado na página ANTES da
 * hidratação (`addInitScript`), que anota toda mudança em `type`/`inputMode` de
 * qualquer campo, e duas sentinelas que dão alcance de tempo a essa anotação
 * (uma de tempo real, uma com o relógio da página sob controle da guarda).
 *
 * O vitest não abre navegador — não é ele que prova que o vigia FUNCIONA (isso
 * são as 20 medidas do Chromium e as 7 mutações do relatório da rodada). O que
 * ele faz aqui é o mesmo serviço do bloco de cima, uma camada abaixo: se o
 * vigia, as sentinelas ou a lista nominal de medidas forem removidos, o portão
 * barato fica vermelho no mesmo diff.
 */
describe("CRÍTICO — o vigia do contrato, o canário e as sentinelas continuam armados", () => {
  const PEDACOS: readonly [string, string][] = [
    ["addInitScript", "o vigia deixou de ser instalado antes da hidratação da página"],
    ["function VIGIA_DO_CONTRATO", "o corpo do vigia desapareceu"],
    ["MutationObserver", "a 3ª rede (a que não depende dos embrulhos) desapareceu"],
    ["conferirVigia(", "nenhuma medida confere mais o registro do vigia"],
    ["const MEDIDAS_EXIGIDAS", "a lista nominal de medidas saiu — o veredito voltou a ser contagem"],
    ["clock.install()", "as sentinelas do relógio desapareceram"],
    ["clock.fastForward(", "ninguém adianta mais o relógio: atraso longo saiu do alcance"],
    /*
     * ═══════════════════════════════════════════════════ CRÍTICO #2, rodada 15 ═
     * O CANÁRIO E A CÓPIA QUE A PÁGINA NÃO CONTROLA.
     *
     * Sem estas cinco peças a guarda volta a dizer VERDE por registro vazio —
     * e foi com seis linhas de `sessionStorage.setItem(chave, "[]")` que o
     * crítico da rodada 15 fez as medidas J e K afirmarem o contrário do que
     * mediram.
     */
    ["const abrirCanario", "o canário desapareceu: registro vazio voltou a ser aprovação"],
    [
      "REDES_QUE_O_CANARIO_EXIGE",
      "a lista das redes que o canário tem de acender saiu — o canário deixou de provar que a rede que importa está viva",
    ],
    [
      "exposeBinding",
      "a cópia do registro que mora no Node saiu: o registro voltou a morar só onde a página manda",
    ],
    [
      "depositoQuebrado",
      "estouro de cota voltou a ser silêncio — era o `catch` vazio do `setItem`",
    ],
    [
      'Object.defineProperty(window, "__vigiaP6"',
      "`window.__vigiaP6` voltou a ser atribuição simples: a página consegue trocar o vigia por um que diz sempre 'nada mudou'",
    ],
    /*
     * ═══════════════════════════════════════════════════ CRÍTICO #1, rodada 15 ═
     * UMA SENTINELA POR ROTA, E O UNIVERSO MEDIDO.
     */
    [
      "const ROTAS_COM_SENTINELA",
      "a lista nominal de rotas com sentinela saiu — o alcance de tempo volta a valer para uma rota só",
    ],
    [
      "function registrarRota",
      "a guarda parou de registrar as rotas que visita: a medida L não tem mais o que comparar",
    ],
    [
      "revelarEstadosOcultos",
      "as sentinelas pararam de revelar o estado que só existe depois de um clique (o campo Desconto)",
    ],
    [
      "CAMPOS_VISTOS_POR_ROTA",
      "o piso de estado das sentinelas saiu: sentinela cega para um estado voltaria a passar",
    ],
  ];

  it("cada peça da correção do CRÍTICO ainda está no arquivo da guarda", () => {
    const texto = guarda();
    for (const [pedaco, porque] of PEDACOS) {
      expect(texto.includes(pedaco), `${porque} (procurei por: ${pedaco})`).toBe(true);
    }
  });

  /**
   * ═══════════════════════════════════════════════════ ALTOS #1 e #3, rodada 16 ═
   * A TABELA DE PERSISTÊNCIA COBRE A LISTA CANÔNICA — CONFERIDO SEM NAVEGADOR.
   *
   * A medida P0 da guarda já reprova quando a tabela e `OPERACOES_DE_ESCRITA`
   * discordam. Mas a guarda de navegador não roda em `npx vitest run`, e uma
   * régua que só existe atrás de um Chromium é uma régua que alguém vai
   * esquecer de rodar. Esta é a MESMA pergunta, feita sobre o texto dos dois
   * arquivos, em 2 s: operação nova em `pedido.ts` sem linha na tabela da
   * guarda fica vermelha aqui também.
   */
  it("a tabela de persistência da guarda cobre TODAS as operações de escrita da página", () => {
    const texto = guarda();
    const inicio = texto.indexOf("const PERSISTENCIA_POR_OP = {");
    expect(inicio, "a tabela de persistência saiu da guarda").toBeGreaterThan(0);
    const bloco = texto.slice(inicio, texto.indexOf("\n};", inicio));
    const naTabela = [...bloco.matchAll(/^ {2}([a-z_]+): \{$/gm)].map((m) => m[1] as string);
    expect(
      naTabela.length,
      "a tabela de persistência ficou sem operação nenhuma — lista vazia é cegueira, não aprovação",
    ).toBeGreaterThanOrEqual(OPERACOES_DE_ESCRITA.length);
    const semLinha = OPERACOES_DE_ESCRITA.filter((op) => !naTabela.includes(op));
    expect(
      semLinha,
      `op(s) de \`pedido.ts\` sem conferência de persistência na guarda: ${semLinha.join(", ")}`,
    ).toEqual([]);
    const sobrando = naTabela.filter(
      (op) => !(OPERACOES_DE_ESCRITA as readonly string[]).includes(op),
    );
    expect(
      sobrando,
      `linha(s) da tabela que não existem mais em \`pedido.ts\`: ${sobrando.join(", ")}`,
    ).toEqual([]);
    // E o piso da guarda não pode ser zero — "conferir nada" nunca é sucesso.
    const piso = /const PISO_DE_OPS_CONFERIDAS = (\d+);/.exec(texto)?.[1] ?? "0";
    expect(
      Number(piso),
      "o piso de operações conferidas por persistência caiu abaixo da lista canônica",
    ).toBeGreaterThanOrEqual(OPERACOES_DE_ESCRITA.length);
  });

  it("toda medida da lista nominal é conferida por um `conferir(...)` da guarda", () => {
    const texto = guarda();
    const inicio = texto.indexOf("const MEDIDAS_EXIGIDAS = [");
    expect(inicio, "a lista nominal de medidas saiu da guarda").toBeGreaterThan(0);
    const fim = texto.indexOf("];", inicio);
    const nomes = [...texto.slice(inicio, fim).matchAll(/"([^"]+)"/g)].map((m) => m[1] as string);
    // O piso é escrito à mão AQUI, fora da guarda: encolher a lista exige
    // baixar este número de propósito, e isso aparece no diff.
    // Rodada 15: subiu de 20 para 25 (uma sentinela J e uma K por rota, mais a
    // medida L do alcance). Encolher exige baixar este número de propósito.
    // Rodada 16: subiu de 34 para 35 — entrou `P0 · `, o fecho da família da
    // persistência. Os nomes `P · <op>` NÃO são literais desta lista: eles são
    // DERIVADOS da lista canônica de `src/app/tarefa/pedido.ts`, e é o teste
    // logo abaixo que confere essa derivação sem precisar de navegador.
    // Rodada 17: subiu de 35 para 36 — entrou `P-loja · `, o reinício que
    // semeia a loja antes da família P (sem ele, duas sabotagens medidas nesta
    // rodada passavam verdes sobre um estado já estragado por outras medidas).
    const PISO_DE_MEDIDAS = 36;
    expect(
      nomes.length,
      "a lista nominal de medidas encolheu — se foi de propósito, baixe o piso neste arquivo e diga por quê",
    ).toBeGreaterThanOrEqual(PISO_DE_MEDIDAS);
    /*
     * VARREDURA DE GENERALIZAÇÃO aplicada a ESTE arquivo: a primeira versão
     * desta asserção se contava a si mesma. Ela fazia
     * `nomes.filter((n) => !texto.includes(`"${n}`))` — e os nomes tinham
     * saído justamente de `texto`, então a condição era verdadeira sempre e a
     * asserção não podia reprovar nunca. Agora a busca é no texto da guarda
     * SEM o bloco da lista: o nome tem de aparecer numa OUTRA parte do
     * arquivo, que é onde os `conferir(...)` vivem.
     */
    const foraDaLista = texto.slice(0, inicio) + texto.slice(fim);
    const semConferir = nomes.filter((n) => {
      // O rótulo é o que vem antes do " · " — "E", "V-AB", "C2", "K".
      const rotulo = n.split(" · ")[0] as string;
      // Ele aparece no arquivo de três formas legítimas: como início da frase
      // do `conferir` (entre aspas duplas OU simples — a medida E usa simples,
      // porque a frase dela já tem aspas duplas dentro) ou como nome passado a
      // `medir(...)`/`conferirVigia(...)`, que é o caso das medidas do vigia,
      // cuja frase é montada por interpolação.
      return !(
        foraDaLista.includes(`"${rotulo} · `) ||
        foraDaLista.includes(`'${rotulo} · `) ||
        foraDaLista.includes(`"${rotulo}"`) ||
        // Rodada 15: as sentinelas J e K nascem de um laço sobre as rotas, e a
        // frase delas é um literal de template — `J · ${sentinela.rota} — …`.
        foraDaLista.includes("`" + `${rotulo} · `)
      );
    });
    expect(
      semConferir,
      `nome exigido na lista sem nenhuma medida que o produza: ${semConferir.join(", ")}`,
    ).toEqual([]);
    // E as medidas que nasceram nas rodadas 14 e 15 estão entre elas.
    for (const nova of ["C2 · ", "L · ", "E2 · ", "E3 · ", "E4 · ", "G2 · ", "M · ", "P0 · "]) {
      expect(nomes, `a medida ${nova} saiu da lista nominal`).toContain(nova);
    }
    /*
     * [CRÍTICO #1, rodada 15] AS SENTINELAS SÃO COBRADAS POR ROTA, PELO NOME.
     *
     * O alcance de 30 min existia para `/tarefa/task-docs` e para o estado
     * inicial dela. Uma lista nominal que só exigisse "J · " e "K · " seria
     * satisfeita por uma sentinela só — o mesmo "universo por convenção" que
     * derrubou a rodada. Aqui cada rota é exigida, e a lista da guarda tem de
     * conter exatamente as mesmas rotas que ela declara em
     * `ROTAS_COM_SENTINELA`.
     */
    const inicioRotas = texto.indexOf("const ROTAS_COM_SENTINELA = [");
    expect(inicioRotas, "a lista de rotas com sentinela saiu da guarda").toBeGreaterThan(0);
    const rotas = [
      ...texto
        .slice(inicioRotas, texto.indexOf("];", inicioRotas))
        .matchAll(/"([^"]+)"/g),
    ].map((m) => m[1] as string);
    expect(rotas.length, "a guarda ficou sem rota nenhuma com sentinela").toBeGreaterThanOrEqual(3);
    for (const rota of rotas) {
      for (const familia of ["J", "K"]) {
        expect(
          nomes,
          `a rota ${rota} tem sentinela na guarda mas NÃO é exigida pela lista nominal (${familia}) — some uma sentinela e o verde fica`,
        ).toContain(`${familia} · ${rota}`);
      }
    }
    for (const nome of nomes) {
      const familia = nome.split(" · ")[0] as string;
      if (familia !== "J" && familia !== "K") continue;
      const rota = nome.slice(familia.length + 3);
      expect(
        rotas,
        `a lista nominal exige ${nome}, e essa rota não está em ROTAS_COM_SENTINELA`,
      ).toContain(rota);
    }
  });
});

/**
 * ESTREIA DO JOB (22/09/2026) — O PASSO REPROVOU ALTO, E POR CAUSA DO
 * INTERPRETADOR.
 *
 * O job nasceu na rodada 14 sem nunca ter rodado: a sessão que o escreveu não
 * tinha rede. O autor previu que a primeira corrida poderia falhar por dois
 * motivos — a tag da imagem, ou o caminho do `playwright-core` dentro dela. Os
 * dois estavam certos. O que quebrou foi um terceiro, que ninguém previu:
 *
 *   /__w/_temp/….sh: 1: set: Illegal option -o pipefail
 *   ##[error]Process completed with exit code 2
 *
 * A imagem do Playwright entrega `sh` (dash) como interpretador padrão dos
 * passos, e `set -o pipefail` é bash. O job foi escrito em bash sem declarar
 * bash, então reprovou antes de medir uma única coisa. O conserto é
 * `shell: bash` no passo.
 *
 * Este bloco existe para fechar a CLASSE, não o caso: qualquer passo do
 * `ci.yml` que use bash tem de declarar bash. Sem isto, o próximo passo escrito
 * com `[[ … ]]`, `pipefail` ou `<<<` repete o erro num contêiner qualquer — e
 * repete em voz alta, gastando uma corrida inteira para dizer "o interpretador
 * está errado".
 */
describe("todo passo de CI que usa bash declara bash", () => {
  const CI = ci();

  /** Construções que o `sh` (dash) do POSIX não entende. */
  const BASHISMOS: ReadonlyArray<readonly [RegExp, string]> = [
    [/\bpipefail\b/, "set -o pipefail"],
    [/\[\[/, "[[ … ]]"],
    [/<<</, "<<< (here-string)"],
    [/\$\{[A-Za-z_][A-Za-z0-9_]*(,,|\^\^)/, "${var,,} / ${var^^}"],
    [/\bfunction\s+[A-Za-z_]/, "function nome()"],
  ] as const;

  /**
   * Corta o arquivo em passos. Um passo começa em `- name:` (ou `- uses:`) na
   * indentação de lista de `steps:` e termina onde o próximo começa. Cortar por
   * texto é suficiente porque a pergunta é local ao passo: o `run:` e o
   * `shell:` do mesmo passo.
   */
  function passosDoCi(): ReadonlyArray<{ readonly rotulo: string; readonly texto: string }> {
    const linhas = CI.split("\n");
    const inicios: number[] = [];
    for (const [i, linha] of linhas.entries()) {
      if (/^\s{6}- (name|uses):/.test(linha)) inicios.push(i);
    }
    return inicios.map((inicio, n) => {
      const fim = inicios[n + 1] ?? linhas.length;
      const texto = linhas.slice(inicio, fim).join("\n");
      const rotulo = /- name:\s*(.+)$/m.exec(texto)?.[1]?.trim() ?? `passo na linha ${inicio + 1}`;
      return { rotulo, texto };
    });
  }

  it("PRONTO QUANDO: nenhum passo usa construção de bash sem `shell: bash`", () => {
    const passos = passosDoCi();
    // Piso: se o cortador parar de achar passos, este bloco aprova por ausência
    // — a forma nº 2 do catálogo desta base.
    expect(passos.length, "o cortador de passos não achou passo nenhum no ci.yml").toBeGreaterThan(
      20,
    );

    const faltando: string[] = [];
    for (const passo of passos) {
      const corpoDoRun = /^\s*run:\s*\|?\s*$([\s\S]*)/m.exec(passo.texto)?.[1] ?? "";
      const comentariosFora = corpoDoRun
        .split("\n")
        .filter((l) => !/^\s*#/.test(l))
        .join("\n");
      if (comentariosFora.trim() === "") continue;
      const usados = BASHISMOS.filter(([re]) => re.test(comentariosFora)).map(([, nome]) => nome);
      if (usados.length === 0) continue;
      const declaraBash = /^\s*shell:\s*bash\s*$/m.test(passo.texto);
      if (!declaraBash) faltando.push(`${passo.rotulo} → usa ${usados.join(", ")}`);
    }

    expect(
      faltando,
      "passo(s) de CI usando bash sem `shell: bash` — num contêiner com `sh`, isto reprova antes de medir qualquer coisa",
    ).toEqual([]);
  });

  it("PRONTO QUANDO: o passo da guarda no navegador declara `shell: bash`", () => {
    const passo = passosDoCi().find((x) => x.rotulo.includes("guarda no navegador"));
    expect(passo, "o passo da guarda no navegador desapareceu do ci.yml").toBeDefined();
    expect(
      /^\s*shell:\s*bash\s*$/m.test(passo?.texto ?? ""),
      "sem `shell: bash` o passo morre em `set: Illegal option -o pipefail` dentro da imagem do Playwright",
    ).toBe(true);
  });

  /*
   * ═════════════════════════════════════════════════════ ALTO #3, rodada 17 ═
   * A GUARDA FOI CANCELADA PELO CI SEM DIZER ONDE ESTAVA.
   *
   * Medido no GitHub Actions (PR #43, head ab04af06): 25 min 8 s contra
   * `timeout-minutes: 25`, e NENHUMA linha impressa em 24 minutos — a saída só
   * existia no fim. Um log assim não distingue "travou" de "ficou lento", e é
   * essa impossibilidade que os três testes abaixo impedem de voltar.
   */
  it("PRONTO QUANDO: o teto interno da corrida cabe, com folga, dentro do `timeout-minutes` do CI", () => {
    const teto = Number(/const TETO_DA_CORRIDA_MS = (\d+)/.exec(guarda())?.[1] ?? "0");
    expect(teto, "a guarda perdeu o teto de tempo da corrida inteira").toBeGreaterThan(0);
    const bloco = ci().slice(ci().indexOf("lifeboard-navegador:"));
    const minutos = Number(/timeout-minutes:\s*(\d+)/.exec(bloco)?.[1] ?? "0");
    expect(minutos, "o job da guarda perdeu o `timeout-minutes`").toBeGreaterThan(0);
    /*
     * A folga é a diferença entre "reprova dizendo o nome da medida" e
     * "cancelada sem dizer nada". Cinco minutos cobrem o `npm ci` e o checkout
     * do job, que também correm contra o mesmo relógio.
     */
    const FOLGA_MINIMA_MS = 5 * 60_000;
    expect(
      minutos * 60_000 - teto,
      `o teto da guarda (${String(teto / 60_000)} min) ficou perto demais do corte do CI (${String(minutos)} min)`,
    ).toBeGreaterThanOrEqual(FOLGA_MINIMA_MS);
  });

  it("PRONTO QUANDO: cada medida tem teto próprio, e estourar o teto vira reprovação COM NOME", () => {
    const texto = guarda();
    expect(
      /const TETO_POR_MEDIDA_MS = \d+/.test(texto),
      "a guarda perdeu o teto por medida — uma medida travada voltaria a consumir a corrida inteira",
    ).toBe(true);
    expect(
      texto,
      "o teto por medida existe mas não é aplicado dentro de `medir`",
    ).toContain("await comTeto(fn(), teto,");
    expect(
      texto,
      "estourar o teto tem de registrar uma medida VERMELHA com o nome, nunca sumir em silêncio",
    ).toContain("a medida estourou o teto de tempo");
  });

  it("PRONTO QUANDO: a guarda fala enquanto mede — veredito e nome saem na hora", () => {
    const texto = guarda();
    const corpoDoConferir = texto.slice(
      texto.indexOf("function conferir(nome, ok, detalhe)"),
      texto.indexOf("async function medir(nome, fn)"),
    );
    expect(
      /console\.log\(/.test(corpoDoConferir),
      "o `conferir` voltou a guardar tudo para o fim — foi assim que 24 minutos de silêncio viraram um cancelamento sem diagnóstico",
    ).toBe(true);
    expect(
      texto,
      "a guarda não anuncia mais qual medida COMEÇOU — sem isso, uma corrida morta não nomeia a culpada",
    ).toContain("→ ${nome} …");
  });

  /*
   * ═══════════════════════════════════════════════════ ALTO #4, rodada 17-B ═
   * A MEDIDA K TRAVOU NO CI PORQUE ESPEROU UM QUADRO QUE SÓ A GUARDA PODIA DAR.
   *
   * Com `clock.install()`, o `requestAnimationFrame` da página é FALSO (medido:
   * `String(requestAnimationFrame).includes("[native code]")` → `false`). Quem
   * decide que existe um quadro passa a ser a guarda, então esperar por um é
   * impasse por construção. No contêiner isso custou uma medida travada; aqui
   * passava porque o relógio falso ia andando com o tempo real.
   */
  it("PRONTO QUANDO: com relógio de mentira, a guarda CAUSA o quadro em vez de esperar por ele", () => {
    const texto = guarda();
    const corpo = texto.slice(
      texto.indexOf("async function assentar(pagina)"),
      texto.indexOf("async function assentar(pagina)") + 900,
    );
    expect(
      corpo,
      "`assentar` voltou a não distinguir a página com relógio de mentira — e é nela que esperar quadro trava",
    ).toContain("pagina.__relogioDeMentira === true");
    expect(
      corpo,
      "com relógio de mentira o quadro tem de ser CAUSADO (`clock.runFor`), nunca esperado",
    ).toContain("await pagina.clock.runFor(DOIS_QUADROS_MS)");
    // E a marca tem de ser posta em TODA página que a guarda abre — é o que
    // impede que uma chamada nova de `assentar` erre sozinha.
    expect(
      texto,
      "a página deixou de se marcar como sendo de relógio de mentira em `abrir()`",
    ).toContain("pagina.__relogioDeMentira = comRelogioDeMentira === true;");
  });

  it("PRONTO QUANDO: sem relógio de mentira, a espera por quadro tem saída em tempo real", () => {
    const texto = guarda();
    expect(
      /const SAIDA_DE_ASSENTAR_MS = \d+/.test(texto),
      "sumiu a saída de emergência do assentamento — quadro que não vem voltaria a ser espera infinita",
    ).toBe(true);
    const corpo = texto.slice(
      texto.indexOf("async function assentar(pagina)"),
      texto.indexOf("async function assentar(pagina)") + 900,
    );
    expect(
      corpo,
      "a espera por quadro precisa correr contra um temporizador REAL, senão volta a poder esperar para sempre",
    ).toContain("setTimeout(fim, saidaMs)");
  });

  it("PRONTO QUANDO: `page.evaluate` — a única chamada do Playwright sem tempo limite — tem teto", () => {
    const texto = guarda();
    expect(
      /const TETO_DO_EVALUATE_MS = \d+/.test(texto),
      "sem teto no `page.evaluate`, uma aba congelada em segundo plano espera para sempre e nenhum tempo limite do Playwright a interrompe",
    ).toBe(true);
    expect(texto, "o teto do evaluate existe mas não é instalado na página").toContain(
      "comTetoNoEvaluate(await contexto.newPage())",
    );
    // E a causa-raiz, desligada na linha de comando do navegador.
    for (const chave of [
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
    ]) {
      expect(texto, `o Chromium voltou a subir sem ${chave}`).toContain(chave);
    }
  });
});
