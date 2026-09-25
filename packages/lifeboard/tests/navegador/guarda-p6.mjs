/**
 * OS-LIFEBOARD · P6 — rodada 16. A GUARDA NO NAVEGADOR.
 *
 * ## Por que ela existe
 *
 * Esta peça trocou de guarda três vezes, sempre pelo mesmo motivo, e o crítico
 * da rodada 13 nomeou o padrão melhor do que as rodadas anteriores: **a guarda
 * deixou de medir a grafia literal e passou a medir uma forma sintática — e
 * forma sintática também é grafia.** Enquanto a trava for uma expressão regular
 * sobre texto de código, vai sempre existir um jeito de escrever a mesma coisa
 * que ela não reconhece:
 *
 *   rodada 10/11  `<input type="number">`            → proibido o texto
 *   rodada 12     `{...AJUSTES_DO_TECLADO}`          → proibida a grafia nova
 *   rodada 13     `Object.assign(el, {type:…})`      → proibida a família
 *   rodada 13     `(el).type = "number"`             → **um par de parênteses**
 *   rodada 13     ajudante em `src/lib/ui/…`         → **fora do perímetro**
 *
 * As duas últimas derrubaram a rodada inteira com os quatro portões verdes e,
 * no Chromium, a página apagando a duração do operador e anunciando "Duração
 * removida.".
 *
 * A P4 e a P5 já saíram dessa armadilha do mesmo jeito: **abrindo o navegador e
 * medindo o produto.** Uma medição que pergunta ao DOM não se importa se a
 * escrita veio de regex, de `ref`, de um ajudante em `lib/` ou de um pacote.
 * A P6 nunca teve guarda de navegador. Esta é ela.
 *
 * ## A lei desta guarda: checagem pulada é checagem aprovada
 *
 * Toda medida aqui **falha** quando o alvo não existe. Se o campo que ela foi
 * medir não está na página, isso é a reprovação, não a dispensa — um `for` que
 * roda zero vezes e um `filter` que devolve lista vazia são as duas formas
 * clássicas de uma guarda dizer VERDE sem ter medido nada. Por isso cada
 * medida abaixo declara quantos alvos ESPERA achar, e o número entra no
 * veredito.
 *
 * ## Como rodar
 *
 *   # de dentro de packages/lifeboard
 *   PLAYWRIGHT_MODULO=<caminho do playwright-core> \
 *   PLAYWRIGHT_CHROMIUM=<caminho do chrome> \
 *   npm run guarda:navegador
 *
 * O atalho é `npm run guarda:navegador`; as duas variáveis continuam sendo
 * necessárias **porque este repositório não depende do Playwright** (nenhuma
 * dependência nova entrou nesta rodada). Elas dizem onde estão o `playwright-core`
 * e o Chromium daquela máquina. Sem elas a guarda tenta resolver
 * `playwright-core` sozinha e, se não achar, **sai com código 2 dizendo isso** —
 * nunca com verde.
 *
 * ## O GATILHO desta guarda, e o que dele foi provado (rodada 14, ALTO #2)
 *
 * Medição do coordenador nas três branches: **nenhuma** das três guardas de
 * navegador desta base rodava sozinha — P4 e P5 em zero passo de CI, a P6 em
 * zero passo de CI e zero entrada de `package.json`. Guarda que só roda quando
 * alguém lembra não é guarda; é documentação. O que esta rodada ligou, só para
 * a P6:
 *
 *  1. **atalho:** `npm run guarda:navegador` (`packages/lifeboard/package.json`);
 *  2. **passo de CI:** job `lifeboard-navegador` em `.github/workflows/ci.yml`,
 *     numa imagem de container do Playwright (é ela que traz o `playwright-core`
 *     e o Chromium — este repositório não depende do Playwright, e nenhuma
 *     dependência nova entrou para isto);
 *  3. **teste de unidade:** `tests/unit/guarda-de-navegador-com-gatilho.test.ts`
 *     fica VERMELHO se o atalho ou o passo de CI desaparecerem.
 *
 * **O que NÃO está provado, e é honesto dizer:** a sessão de correção não tem
 * rede nem GitHub Actions, então o job de CI foi escrito e nunca EXECUTADO.
 * Duas coisas dependem da primeira corrida real: a tag da imagem e o caminho do
 * `playwright-core` dentro dela. O passo foi escrito para **falhar alto** se
 * qualquer um dos dois estiver errado (`exit 1` com mensagem, nunca `skip`,
 * nunca `continue-on-error`) — é o modo de falha certo, mas não é um verde.
 * Até existir uma corrida verde do job, o gatilho que se pode afirmar é o
 * atalho do `package.json` e a saída colada no relatório da rodada.
 *
 * Ela **sobe o próprio servidor** numa porta que o sistema operacional garante
 * livre. Isso não é detalhe: numa máquina com várias cópias do repositório
 * abertas — que é o caso quando várias correções rodam em paralelo — uma guarda
 * de porta fixa mede a árvore de outra pessoa e diz VERDE inclusive com
 * sabotagem aplicada. Isso foi medido, não suposto.
 *
 * Não entra em `npx vitest run` de propósito: um portão que exige servidor de
 * pé e navegador instalado travaria a suíte de quem só quer rodar os testes
 * puros. Desde a rodada 14 ela tem gatilho próprio — o atalho
 * `npm run guarda:navegador` e o job `lifeboard-navegador` do `ci.yml` (veja
 * a seção "O GATILHO" abaixo, e o que dela ainda não está provado). O
 * relatório de cada rodada continua colando a saída.
 *
 * ## O que ela mede, e nada além
 *
 * | # | medida | régua |
 * |---|---|---|
 * | A | todo campo que aceita número é `type="text"` + `inputMode="decimal"` | 3 campos, 0 fora da régua |
 * | B | nenhum `<input>` da página é `type="number"` EM TEMPO DE EXECUÇÃO | ≥ 6 inputs medidos, 0 `number` |
 * | C | `2e` na duração: a caixa entrega `2e` ao programa, a recusa é em português no campo, e o valor gravado NÃO muda | `.value === "2e"`, recusa com "número", valor 2 depois do F5 |
 * | C2 | o contrato do campo NO INSTANTE em que o operador digita e em que manda salvar | `type=text` + `inputMode=decimal` nos dois instantes |
 * | D | corrida de status: o anúncio que chega é o do PRIMEIRO clique | recusa do 2º + anúncio "concluída" |
 * | E | "Limpar átomos" tem caminho de volta | botão Desfazer existe e devolve o score |
 * | F | o rascunho dos 6 campos de criação sobrevive à navegação | 6 campos, 0 perdidos |
 * | G | a duração da tarefa **não** volta com rascunho: a caixa mostra o que o banco tem | caixa = valor gravado |
 * | H | corrida na TAREFA MÃE: o anúncio e o `<select>` ficam no 1º pedido | recusa do 2º + select na 1ª escolha |
 * | I | corrida na META: o anúncio que chega é o do 1º clique | recusa do 2º + "Marcada como meta." |
 * | J | as SENTINELAS de tempo real, uma POR ROTA: nada mexeu no contrato, **nem no que o operador digitou**, **e a AÇÃO ainda funciona** | canário conferido; 0 mudança fora da régua; vida ≥ 30 s; 7 campos EXERCIDOS e PREENCHIDOS; 0 valor mudado; escrita exercida com a aba viva há ≥ 60 s e o valor pedido NA LOJA |
 * | K | as SENTINELAS DO RELÓGIO, uma POR ROTA: meia hora adiantada, os campos exercidos, meia hora de novo, **e então a AÇÃO exercida** | canário conferido; 0 mudança fora da régua; ≥ 7 campos no DOM, exercidos e com o valor digitado ainda lá; 0 `type=number`; escrita exercida depois de 1 h de relógio e o valor pedido NA LOJA |
 * | J-escrita | o piso das escritas EXERCIDAS, contado fora das medidas J e K | 6 sentinelas digitaram, salvaram e tiveram o valor conferido na loja |
 * | L | o alcance cobre TODAS as rotas, estados, CAMPOS EXERCIDOS e CAMPOS PREENCHIDOS que a guarda visita | 0 rota sem sentinela; sentinela ≥ o estado medido; os quatro números ≥ o piso escrito à mão (7) |
 * | Q0 | toda medida que mexe na loja declarou e conferiu a PRÓPRIA precondição | a lista escrita à mão (12 medidas) bate com as que declararam |
 * | P0 | o universo das escritas sai da lista canônica da página (`pedido.ts`), lido DUAS vezes, e toda op declara ALCANCE e PRECONDIÇÃO | 15 op(s) nas duas leituras; TODAS conferidas; motivo escrito de alcance; classe da duração com ponto E vírgula; classe de status ≥ 4; classe de tipos de relação ≥ 4 |
 * | P·op | uma por operação de escrita: precondição PRÓPRIA conferida · o que o operador pediu está lá depois do F5 · **só o que foi pedido mudou na loja INTEIRA** · o anúncio da tela bate com o que foi gravado | precondição === a declarada (senão reprova, nunca se adapta); pedido ≠ antes; depois do F5 === PEDIDO; 0 campo e 0 entidade fora do alcance declarado; a frase exata do desfecho, e nenhuma do desfecho oposto |
 * | P-nascidas | toda entidade que NASCEU teve os campos conferidos, não só a linha contada — e todo imprevisível teve RÉGUA, não só motivo escrito | ≥ 8 entidades com todo campo classificado (pedidos / daCasa / imprevisíveis) e conferido; ≥ 15 imprevisíveis julgados por uma função que olha o valor |
 * | Z | o que esta guarda NÃO alcança, por escrito, conferido contra ESTA corrida | ≥ 6 limites declarados; modo fixture provado; servidor subido por esta guarda |
 * | V-* | uma por medida: o CANAL do vigia provou que ainda reporta, e nada mexeu no contrato | canário nas 3 cópias pelas 6 redes; 0 mudança fora da régua |
 *
 * D, H e I cobrem TRÊS dos cinco formulários no navegador. Os cinco estão
 * cobertos pela guarda derivada de `tests/unit/`, que desde a rodada 14 é
 * PROVADA arquivo por arquivo: a sabotagem é injetada no texto de cada arquivo
 * que chama a porta, em cinco grafias, e a guarda tem de acusar todas.
 *
 * ## A pergunta que faltava até a rodada 15: **chegou ao banco?**
 *
 * As medidas A–M perguntam o que a TELA faz. Nenhuma delas perguntava, das 15
 * escritas da página, se o valor que o operador pediu é o valor que ficou
 * gravado — só três `reload()` existiam no arquivo inteiro. O crítico da
 * rodada 16 derrubou a guarda duas vezes por esse buraco, as duas com os cinco
 * portões e as 34 medidas verdes: dois campos trocados no despacho dos átomos
 * ("Átomos salvos." na tela, Esforço e Custo invertidos no banco) e um status
 * que a tela marcava e o servidor nunca recebia.
 *
 * A família **P** é a resposta, e ela é DERIVADA: o universo sai de
 * `OPERACOES_DE_ESCRITA` (`src/app/tarefa/pedido.ts`), lido do fonte; cada `op`
 * de lá tem, na tabela `PERSISTENCIA_POR_OP`, uma conferência ou uma dispensa
 * com motivo escrito; e há piso — conferir zero nunca é sucesso. A conferência
 * é sempre a mesma: **pedir um valor DIFERENTE do que está lá, recarregar, e
 * exigir o valor PEDIDO** — nunca "algum valor", que é o regex que passou.
 *
 * ## A pergunta que faltava até a rodada 17: **e o RESTO continua como estava?**
 *
 * A família P nasceu perguntando "o valor que pedi voltou?", uma op por vez,
 * cada uma lendo só o seu próprio campo. O crítico da rodada 17 derrubou a
 * guarda inteira com uma linha em `statusSetFixture` que, ao mudar o status,
 * apagava a duração — e a guarda IMPRIMIU o apagamento (`antes=""` onde antes
 * era `"2"`) e chamou de `ok`. Agora cada escrita tem **alcance conferido**:
 * fotografia derivada da loja INTEIRA antes e depois, e só pode ter mudado o
 * que aquela op declarou (com motivo escrito). Junto vieram a **precondição
 * própria** de cada medida (nenhuma herda o estrago de outra) e a **classe**
 * de valores derivada do contrato do campo, no lugar de um chute que era
 * sempre inteiro. Detalhe e medição: o bloco da família P, mais abaixo.
 *
 * ## O que a rodada 18 fechou
 *
 * Cinco buracos, todos da mesma família ("a guarda mede a hipótese, não o
 * produto"), e cada um está documentado no bloco da medida que o fechou:
 *
 *  - **`bloqueada` era o único status que ninguém media** (ALTO #1) — a família
 *    P exercia um status de quatro, e a única medida que clica em `bloqueada`
 *    exige o clique RECUSADO. `P · status` percorre a CLASSE, lida do fonte, e
 *    confere o valor na LOJA, não só o rótulo marcado na tela;
 *  - **o alcance contava entidades novas e nunca olhava os campos delas**
 *    (ALTO #2) — subtarefa nascendo concluída e desconto de relação jogado
 *    fora passavam verdes. Toda entidade nascida tem TODA chave classificada e
 *    conferida, e `relacao_criar` percorre as quatro naturezas;
 *  - **a sentinela olhava `type` e `inputMode` e ignorava o VALOR** (ALTO #3) —
 *    um temporizador que apagava a duração aos 90 s passava por J, por K e pela
 *    varredura léxica. A sentinela passou a DIGITAR, e o que ela digitou entra
 *    no veredito;
 *  - **a guarda reprovava sozinha e o estrago de uma medida derrubava outras
 *    duas** (MÉDIO #4) — a disciplina de precondição própria, que valia só para
 *    a família P, passou a valer para A–M, com a lista cobrada pela medida Q0;
 *  - **tudo o que a família P prova é sobre um `Map` em memória** (MÉDIO #5) —
 *    o dublê passou a carimbar `updatedAt` como o banco carimba (gatilho
 *    `trg_tasks_touch`), e o limite desta guarda virou a medida Z, que sai em
 *    toda corrida em vez de envelhecer num parágrafo de cabeçalho.
 *
 * ## O que a rodada 19 fechou
 *
 * Dois buracos que NASCERAM DENTRO das curas da rodada 18 — é essa a marca
 * desta rodada, e cada um está documentado no bloco que o fechou:
 *
 *  - **a sentinela da rodada 18 fotografa CAMPOS, então a armadilha parou de
 *    mexer em campo e passou a matar a AÇÃO** (ALTO #1) — um `setTimeout` de
 *    60 s que arma um `return` no `onSubmit` da duração: nada escrito no DOM,
 *    nenhum `disabled`, nenhum campo tocado, cinco portões verdes e o "Salvar
 *    duração" virado enfeite. Agora cada sentinela, no FIM da vida, digita,
 *    salva e exige o valor pedido NA LOJA — com o alcance de tempo de cada
 *    metade dito por escrito (J: ≥ 60 s reais; K: 1 h de relógio);
 *  - **o balde "imprevisíveis" virou esconderijo** (MÉDIO #2) — ele cobrava um
 *    motivo de ≥ 30 caracteres, e motivo não é régua: `createdAt` da nota nova
 *    podia nascer em **1970** (e essa data aparece na tela). Agora todo
 *    imprevisível leva uma FUNÇÃO que julga o valor — o instante cai na janela
 *    que a própria corrida mediu, o id tem a forma de id nascido agora, o
 *    `externalRef` é função do id. Declaração sem função reprova.
 *
 * ## O veredito não se conta a si mesmo (rodada 14)
 *
 * O fecho era `medidas.length !== 9`: apagar uma medida e acrescentar outra
 * qualquer mantinha o número e o verde — a primeira das quatro formas viciadas
 * desta base. Agora há uma **lista nominal escrita à mão**
 * (`MEDIDAS_EXIGIDAS`), e cada nome dela tem de aparecer no registro.
 */

/*
 * Os nomes abaixo NÃO existem neste arquivo: eles existem dentro dos
 * `pagina.evaluate(...)`, que o Playwright serializa e roda no CONTEXTO DA
 * PÁGINA, dentro do Chromium. Declarados como globais para o ESLint saber
 * disso — é uma declaração de ambiente, não um silenciamento de regra.
 */
/* global document, window, requestAnimationFrame, Event */

import { spawn } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ_DO_PACOTE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Uma porta que o sistema operacional garante estar livre agora. */
async function portaLivre() {
  return await new Promise((resolver, rejeitar) => {
    const s = createServer();
    s.on("error", rejeitar);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolver(port));
    });
  });
}

async function esperarResponder(base, limiteMs) {
  const ate = Date.now() + limiteMs;
  while (Date.now() < ate) {
    try {
      const r = await fetch(base, { signal: globalThis.AbortSignal.timeout(5000) });
      if (r.ok) return true;
    } catch {
      // ainda compilando; tenta de novo
    }
    await new Promise((ok) => setTimeout(ok, 500));
  }
  return false;
}

/** Sobe `next dev` a partir DESTE pacote, em porta livre, no modo fixture. */
async function subirServidorProprio(limiteMs = 180000) {
  const req = createRequire(import.meta.url);
  let binarioDoNext;
  try {
    binarioDoNext = join(dirname(req.resolve("next/package.json")), "dist", "bin", "next");
  } catch {
    return null;
  }
  const porta = await portaLivre();
  const base = `http://127.0.0.1:${String(porta)}`;
  /*
   * [rodada 22] `detached`: o `next dev` ganha um GRUPO de processos próprio,
   * e encerrar mata o grupo inteiro — o `next-server` filho incluído. Medido
   * nesta rodada: sob carga, o reinício da medida P-loja subiu o servidor novo
   * com o velho ainda escrevendo em `.next/`, e o novo respondeu 500
   * ("__webpack_modules__[moduleId] is not a function") até o teto — a P-loja
   * reprovou, e a família P inteira morreu com ERR_CONNECTION_REFUSED.
   */
  const filho = spawn(process.execPath, [binarioDoNext, "dev", "-p", String(porta)], {
    cwd: RAIZ_DO_PACOTE,
    env: { ...process.env, LIFEBOARD_DATA_MODE: "fixture" },
    stdio: "ignore",
    detached: true,
  });
  const grupoVivo = () => {
    try {
      process.kill(-filho.pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  /** Encerra o GRUPO e espera ele sumir de fato (SIGKILL passado o teto). */
  const encerrarDeVez = async (tetoMs = 20000) => {
    try {
      process.kill(-filho.pid, "SIGTERM");
    } catch {
      return;
    }
    const ate = Date.now() + tetoMs;
    while (grupoVivo() && Date.now() < ate) await new Promise((ok) => setTimeout(ok, 250));
    if (grupoVivo()) {
      try {
        process.kill(-filho.pid, "SIGKILL");
      } catch {
        // sumiu entre a pergunta e o tiro
      }
      await new Promise((ok) => setTimeout(ok, 500));
    }
  };
  const encerrar = () => {
    try {
      process.kill(-filho.pid, "SIGTERM");
    } catch {
      // já morreu
    }
  };
  process.on("exit", encerrar);
  if (!(await esperarResponder(base, limiteMs))) {
    await encerrarDeVez();
    return null;
  }
  return { base, encerrar, encerrarDeVez };
}

let encerrarServidor = () => {};
let encerrarServidorDeVez = async () => {};
let BASE = process.env.LIFEBOARD_URL ?? null;
/** A guarda subiu o servidor? Só então ela pode reiniciá-lo para semear a loja. */
const SERVIDOR_PROPRIO = BASE === null;
if (BASE === null) {
  const proprio = await subirServidorProprio();
  if (proprio === null) {
    console.error(
      "%s",
      "guarda-p6: não consegui subir o servidor deste pacote. Rode `npm install` na raiz, ou aponte LIFEBOARD_URL para um servidor que sirva ESTA árvore.",
    );
    process.exit(2);
  }
  BASE = proprio.base;
  encerrarServidor = proprio.encerrar;
  encerrarServidorDeVez = proprio.encerrarDeVez;
  console.log("%s", `servidor próprio no ar em ${BASE} (subido por esta guarda)`);
}

const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? undefined;
const moduloDoPlaywright = await import(process.env.PLAYWRIGHT_MODULO ?? "playwright-core");
const chromium = moduloDoPlaywright.chromium ?? moduloDoPlaywright.default?.chromium;
if (!chromium) {
  console.error(
    "%s",
    "guarda-p6: não achei o `chromium` do playwright-core. Aponte PLAYWRIGHT_MODULO para o arquivo de entrada do pacote.",
  );
  process.exit(2);
}

const falhas = [];
const medidas = [];

/*
 * ══════════════════════════════════════════════════════════ ALTO #3, rodada 17 ═
 * A GUARDA TRAVOU NO CI E NÃO DISSE ONDE.
 *
 * Medido pelo coordenador no GitHub Actions (PR #43, head ab04af06, container
 * `mcr.microsoft.com/playwright:v1.55.1-noble`):
 *
 *   08:18:25  servidor próprio no ar em http://127.0.0.1:39901
 *   08:42:23  context canceled
 *   08:42:23  ##[error]The operation was canceled.
 *
 * 25 min 8 s contra `timeout-minutes: 25`, e **nenhuma linha impressa em 24
 * minutos**. Aqui na máquina a mesma corrida leva ~2 min 40 s.
 *
 * ## A suspeita que esta máquina não confirmava — e que o CI depois confirmou
 *
 * A suspeita principal era o relógio de mentira das medidas K: com
 * `clock.install()`, `assentar()` espera dois `requestAnimationFrame` e, se
 * nada acordar esse quadro, espera para sempre. Aqui ela **não reproduzia** —
 * experimento próprio, mesmo Chromium, com e sem relógio, depois de um e de
 * dois `fastForward(30 min)`, com a aba em segundo plano: o `assentar` voltava
 * em 6–34 ms em todos os casos, porque o relógio falso do Playwright ia andando
 * junto com o tempo real nesta máquina.
 *
 * **A corrida seguinte do CI (head `feed811e`) mostrou que a suspeita estava
 * certa e a minha refutação estava incompleta:** K travou, e travou exatamente
 * nesse `assentar`. O que faltava não era a hipótese, era um experimento que
 * FORÇASSE a condição em vez de esperar por ela. Está tudo no bloco de
 * `assentar()`, com os números — inclusive a medição de que
 * `requestAnimationFrame` **não é o nativo** enquanto o relógio está instalado.
 * Uma refutação que só sabe dizer "aqui não acontece" não é uma refutação.
 *
 * ## O que a investigação NÃO consegue afirmar, e por que isso é o achado
 *
 * Com a saída impressa **só no fim**, aquele log não distingue "travou" de
 * "ficou lento": os dois produzem exatamente 24 minutos de silêncio. Ninguém
 * — nem o coordenador, nem esta correção — pode dizer, daquele log, qual das
 * duas aconteceu. **Essa impossibilidade é o defeito**, e é ela que se
 * conserta aqui. Diagnóstico por adivinhação não é diagnóstico.
 *
 * ## O que ficou provado que PODE travar, e foi fechado
 *
 * `page.evaluate` **não tem tempo limite no Playwright** — nem o padrão da
 * página, nem nenhum outro. São 31 chamadas neste arquivo, e três delas
 * (`assentar`, `exercitarCampos`, a leitura do vigia) rodam sobre páginas
 * SENTINELA que ficam abertas em segundo plano a corrida inteira. O Chromium
 * congela aba de segundo plano depois de ~5 min (page freezing): numa máquina
 * onde a corrida passa desse ponto antes das medidas J/K — e o contêiner é
 * mais lento —, um `evaluate` sobre página congelada **não volta nunca**, e
 * nenhum tempo limite do Playwright o interrompe. Três travas:
 *
 *  1. o Chromium sobe com o congelamento de segundo plano DESLIGADO
 *     (`--disable-backgrounding-occluded-windows`, `--disable-renderer-backgrounding`,
 *     `--disable-background-timer-throttling`) — é a causa-raiz, e sai declarada
 *     na linha de comando do navegador, não num comentário;
 *  2. todo `page.evaluate` desta guarda passa a ter teto (`TETO_DO_EVALUATE_MS`):
 *     página que não responde vira reprovação com nome, nunca espera infinita;
 *  3. cada medida tem teto próprio e a corrida tem teto total — abaixo.
 *
 * ## E a guarda passa a falar enquanto mede
 *
 * Cada medida anuncia que começou, e anuncia o veredito com o tempo que levou.
 * O relatório do fim continua inteiro, como estava. Uma corrida que morrer no
 * meio passa a dizer, na última linha do log, qual medida estava rodando.
 * ════════════════════════════════════════════════════════════════════════════
 */

/** O relógio da corrida — é dele que saem os carimbos e o teto total. */
const INICIO_DA_CORRIDA = Date.now();

/**
 * Teto de tempo de UMA medida. Escrito à mão, sem porta de saída por variável
 * de ambiente: um teto que a corrida pode afrouxar sozinha não é teto.
 * 2 min 30 s é ~5× a medida mais cara desta base (a família P inteira leva menos
 * que isso), então ele só dispara em travamento de verdade.
 */
const TETO_POR_MEDIDA_MS = 150000;

/**
 * Teto da corrida inteira: 25 min, contra os 32 min do passo de CI. Os 7 min de
 * diferença são a folga que o coordenador pediu — e ela é REAL, não estimada:
 * com o teto, a guarda não tem como ser cancelada pelo CI sem antes dizer, no
 * log, em que medida estava.
 *
 * [ALTO, rodada 23] ERA 18 min (contra 25 do CI), e subiu — com a conta:
 * a corrida HONESTA num núcleo só (`taskset -c 0`) já levava 950–975 s na
 * rodada 22, 90 % do teto de 1.080 s; a família R soma ~50 s de núcleo livre
 * (430 s contra 380 s), ~2,5× isso num núcleo. Um teto que a corrida honesta
 * encosta não é teto: é sorteio. O `timeout-minutes` do job
 * `lifeboard-navegador` (`.github/workflows/ci.yml`) sobe junto, de 25 para
 * 32, para a folga continuar sendo 7 min. E a corrida SABOTADA que estoura o
 * teto sem medir a família P deixa de existir por outra regra, e não por este
 * número: `RESERVA_DO_QUE_VEM_DEPOIS_MS`, junto das famílias N.
 */
const TETO_DA_CORRIDA_MS = 1500000;

/** Teto de um `page.evaluate` — a única chamada do Playwright sem tempo limite. */
const TETO_DO_EVALUATE_MS = 30000;

/**
 * ══════════════════════════════════════════════════════ MÉDIO #4, rodada 18 ═
 * O TETO DE UMA AÇÃO DO PLAYWRIGHT — 30 s ERA CURTO DEMAIS PARA ESTA MÁQUINA.
 *
 * A primeira corrida do crítico, **sem sabotagem, no head limpo**, deu
 * `exit 1`: `FALHA E — a medida ESTOUROU: locator.click: Timeout 30000ms
 * exceeded`. O clique não estourou por defeito do produto: estourou porque
 * `next dev` estava compilando a rota pela primeira vez numa máquina de 4
 * núcleos sob carga de outros agentes. Nas corridas seguintes, verde.
 *
 * Uma guarda que reprova sozinha uma corrida em três não é uma guarda: é uma
 * moeda. Duas coisas mudaram:
 *
 *  1. **o teto de ação sobe para 90 s** — continua MUITO abaixo do teto de 150 s
 *     por medida, então um travamento de verdade continua virando reprovação com
 *     nome, e não espera infinita;
 *  2. **as rotas são AQUECIDAS antes da primeira medida** — a primeira
 *     compilação de cada rota passa a acontecer fora de qualquer medida, onde
 *     ela não é confundida com defeito.
 */
const TETO_DE_ACAO_MS = 90000;

class EstourouOTeto extends Error {}

/** Corre a promessa contra um relógio; estourar é erro com nome, nunca espera. */
async function comTeto(promessa, ms, oQue) {
  let relogio;
  try {
    return await Promise.race([
      promessa,
      new Promise((_, rejeitar) => {
        relogio = setTimeout(
          () => rejeitar(new EstourouOTeto(`${oQue} passou de ${String(ms)} ms sem voltar`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (relogio !== undefined) clearTimeout(relogio);
  }
}

function carimbo() {
  const s = Math.round((Date.now() - INICIO_DA_CORRIDA) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * ═══════════════════════════════════════════════════ MÉDIO, rodada 22 ═
 * TRÊS VEREDITOS, NÃO DOIS: "o produto falhou" (código 1) é uma coisa, "a
 * guarda não conseguiu medir" (código 2) é outra — a mesma lei da guarda da P4
 * (`scripts/guarda-no-navegador.mjs`). O 4º argumento `"nao-medido"` só vale
 * para quem PROVOU que não mediu (ex.: a ação ficou "Salvando…" o tempo todo e
 * nenhum desfecho chegou dentro do teto); nunca é verde, e nunca esconde uma
 * falha: com qualquer FALHA na corrida, a saída é 1.
 */
const naoMedidas = [];
function conferir(nome, ok, detalhe, estado = "medido") {
  const naoMedido = !ok && estado === "nao-medido";
  const linha = `${ok ? "ok   " : naoMedido ? "N-MED" : "FALHA"} ${nome} — ${detalhe}`;
  medidas.push(linha);
  if (!ok) (naoMedido ? naoMedidas : falhas).push(nome);
  // [ALTO #3, rodada 17] o veredito sai NA HORA, não só no relatório do fim.
  console.log("%s", `[${carimbo()}] ${linha}`);
}

/**
 * Roda uma medida e, se ela ESTOURAR, registra a falha com o nome da medida e
 * segue para a seguinte.
 *
 * Por que existe: uma sabotagem que apagou o `inputMode="decimal"` do campo fez
 * um `waitForSelector` estourar dentro da medida A. O processo morreu com
 * exceção não tratada — saiu com código 1, sim, mas sem dizer QUAL medida
 * reprovou, e as oito medidas seguintes nunca rodaram. Uma guarda que morre no
 * meio é uma guarda que mediu um pedaço e calou o resto: o veredito aqui é
 * sempre a lista inteira, e um estouro é uma reprovação com nome.
 */
async function medir(nome, fn) {
  // [ALTO #3, rodada 17] o teto total, conferido ANTES de começar: uma medida
  // que não caberia é uma reprovação com nome, não um cancelamento do CI.
  const restante = TETO_DA_CORRIDA_MS - (Date.now() - INICIO_DA_CORRIDA);
  if (restante <= 0) {
    conferir(
      `${nome} · (a medida não chegou a rodar)`,
      false,
      `a corrida estourou o teto de ${String(Math.round(TETO_DA_CORRIDA_MS / 60000))} min antes desta medida começar`,
    );
    encerrarAgora(`a corrida estourou o teto de ${String(Math.round(TETO_DA_CORRIDA_MS / 60000))} min — parada em "${nome}"`);
  }
  const teto = Math.min(TETO_POR_MEDIDA_MS, restante);
  // [ALTO #3, rodada 17] diz o que está rodando AGORA. Se a corrida morrer, a
  // última linha do log nomeia a medida — era isto que faltava no contêiner.
  console.log("%s", `[${carimbo()}] → ${nome} …`);
  const t0 = Date.now();
  try {
    await comTeto(fn(), teto, `a medida "${nome}"`);
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message.split("\n")[0] : String(erro);
    if (erro instanceof EstourouOTeto) {
      conferir(
        `${nome} · (a medida estourou o teto de tempo)`,
        false,
        `${msg} — travar sem dizer o nome é "aprovar por ausência" do outro lado`,
      );
      /*
       * A corrida PARA aqui, e é de propósito: a medida abandonada deixou uma
       * operação do Playwright em voo, e tudo o que ela registrasse a partir de
       * agora seria leitura de um estado que ninguém controla. Melhor um
       * relatório curto e honesto, com o nome do culpado, do que 40 medidas
       * sobre uma aba abandonada.
       */
      encerrarAgora(`medida travada: "${nome}" passou de ${String(Math.round(teto / 1000))}s`);
    }
    conferir(`${nome} · (a medida não chegou ao fim)`, false, `a medida ESTOUROU: ${msg}`);
  }
  console.log("%s", `[${carimbo()}] ← ${nome} — ${String(Math.round((Date.now() - t0) / 1000))}s`);
}

/** O fim abrupto: imprime o que já se sabe, com nome, e sai vermelho. */
function encerrarAgora(motivo) {
  console.error("%s", `\n${motivo}`);
  console.log("%s", `\n${medidas.join("\n")}`);
  try {
    encerrarServidor();
  } catch {
    // o servidor já morreu
  }
  process.exit(1);
}

/*
 * [ALTO #3, rodada 17] O CONGELAMENTO DE ABA EM SEGUNDO PLANO, DESLIGADO.
 *
 * As seis sentinelas ficam abertas a corrida inteira e, por desenho, em
 * segundo plano. O Chromium congela aba de segundo plano depois de ~5 min, e
 * `page.evaluate` sobre aba congelada não volta — e não tem tempo limite.
 * Estas três chaves são a causa-raiz do travamento do contêiner, desligada no
 * único lugar onde isso se declara: a linha de comando do navegador.
 */
const ARGUMENTOS_DO_CHROMIUM = [
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
];

const navegador = await chromium.launch({
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  args: ARGUMENTOS_DO_CHROMIUM,
});

/**
 * ══════════════════════════════════════════════════════ CRÍTICO #1, rodada 15 ═
 * O UNIVERSO DAS SENTINELAS DEIXA DE SER CONVENÇÃO E PASSA A SER MEDIDO.
 *
 * O alcance de 30 min que o cabeçalho afirmava era verdade para UMA rota, num
 * estado só: as duas sentinelas abriam `/tarefa/task-docs` e não tocavam em
 * nada, enquanto as outras onze aberturas viviam 5–15 s e fechavam. O crítico
 * da rodada 15 derrubou a guarda com o setter do protótipo aos 60 s e um
 * `if (!window.location.pathname.includes("task-build")) return;` — cinco
 * portões verdes, e no Chromium a duração do operador apagada outra vez.
 *
 * Agora toda rota que a guarda abre ou navega se REGISTRA aqui, e a medida L
 * compara o medido com a lista escrita à mão das sentinelas: rota visitada sem
 * sentinela é reprovação. E o número de campos que cada rota já mostrou
 * também se registra, porque estado escondido atrás de um clique (o campo
 * "Desconto", que só nasce com "sinergia" escolhida) é tão fora de alcance
 * quanto rota não visitada — a sentinela daquela rota tem de mostrar pelo
 * menos tantos campos quanto a maior leitura que a guarda fez ali.
 */
const ROTAS_VISITADAS = new Set();
const CAMPOS_VISTOS_POR_ROTA = new Map();
function registrarRota(rota) {
  ROTAS_VISITADAS.add(rota);
}
function registrarCampos(rota, quantos) {
  const antes = CAMPOS_VISTOS_POR_ROTA.get(rota) ?? 0;
  if (quantos > antes) CAMPOS_VISTOS_POR_ROTA.set(rota, quantos);
}

/**
 * [ALTO #3, rodada 17] `page.evaluate` É A ÚNICA CHAMADA DO PLAYWRIGHT SEM
 * TEMPO LIMITE — nem o padrão do contexto a alcança. São 31 neste arquivo, e
 * as que rodam sobre as páginas SENTINELA (`assentar`, `exercitarCampos`, a
 * leitura do vigia) são justamente as que uma aba congelada em segundo plano
 * faria esperar para sempre. Aqui todas passam a ter teto, e página que não
 * responde vira reprovação com nome.
 */
function comTetoNoEvaluate(pagina) {
  const original = pagina.evaluate.bind(pagina);
  pagina.evaluate = async (fn, arg) =>
    await comTeto(original(fn, arg), TETO_DO_EVALUATE_MS, "um page.evaluate desta página");
  return pagina;
}

/** Um contexto novo por medida: nada de rascunho de uma vazar na outra. */
async function abrir(rota, largura = 1280, altura = 1200, comRelogioDeMentira = false) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura } });
  // [MÉDIO #4, rodada 18] o teto de TODA ação deste contexto (clique, espera,
  // navegação), no lugar dos 30 s do padrão do Playwright.
  contexto.setDefaultTimeout(TETO_DE_ACAO_MS);
  contexto.setDefaultNavigationTimeout(TETO_DE_ACAO_MS);
  /*
   * [CRÍTICO #2, rodada 15] A CÓPIA QUE MORA NO NODE.
   *
   * `exposeBinding` dá à página uma função que, chamada, entrega o argumento
   * a ESTE processo. O vigia captura a referência antes do primeiro script da
   * página; daí em diante toda anotação também sai da página. É a única das
   * quatro cópias que nenhum código da aba alcança — e é contra ela que as
   * outras três são comparadas.
   */
  const registroFora = [];
  await contexto.exposeBinding(CANAL_FORA_DA_PAGINA, (_fonte, carga) => {
    registroFora.push(carga);
  });
  /*
   * O relógio de mentira, quando pedido, entra ANTES do vigia e antes de
   * qualquer script da página — a ordem importa: um `setTimeout` que a página
   * agendar depois disso é o relógio de mentira que o guarda, e é por isso que
   * `fastForward` consegue fazê-lo disparar. (Medido: com a ordem trocada, o
   * `setTimeout` de 60 s da página usa o relógio de verdade e o
   * `fastForward(120 s)` não o dispara.)
   */
  if (comRelogioDeMentira) await contexto.clock.install();
  /*
   * O vigia entra AQUI, no contexto, antes de a primeira página existir: é o
   * que garante que ele corra antes de qualquer script da página em TODA
   * navegação deste contexto — inclusive no `reload()` da medida E e nos
   * `goto()` das medidas F e G.
   */
  await contexto.addInitScript(VIGIA_DO_CONTRATO, {
    chave: CHAVE_DO_VIGIA,
    canal: CANAL_FORA_DA_PAGINA,
    propriedades: PROPRIEDADES_DO_CONTRATO,
    atributos: ATRIBUTOS_DO_CONTRATO,
  });
  const pagina = comTetoNoEvaluate(await contexto.newPage());
  /*
   * [ALTO #4, rodada 17-B] A MARCA QUE FECHA A CLASSE.
   *
   * Quem sabe se o relógio desta página é de mentira é quem a abriu — e a
   * informação some no caminho até `assentar()`. A marca fica NA PÁGINA, e não
   * num parâmetro, porque parâmetro se esquece: as oito chamadas de
   * `assentar()` deste arquivo (e as que vierem) passam a acertar sozinhas.
   */
  pagina.__relogioDeMentira = comRelogioDeMentira === true;
  await pagina.goto(`${BASE}${rota}`, { waitUntil: "networkidle" });
  await pagina.waitForSelector("h1", { timeout: 30000 });
  registrarRota(rota);
  return { contexto, pagina, registroFora, rota };
}

/**
 * Navegação de dentro da guarda que também se REGISTRA. Uma rota alcançada por
 * `goto` ou por clique num link é uma rota visitada, e o CRÍTICO #1 nasceu
 * exatamente de a guarda visitar `/tarefa/task-setup` sem sentinela nenhuma
 * lá.
 */
async function anotarRotaAtual(pagina) {
  const estado = await estadoDaPagina(pagina);
  if (estado === null) return;
  registrarRota(estado.rota);
  registrarCampos(estado.rota, estado.campos);
}

/**
 * O ESTADO QUE SÓ EXISTE DEPOIS DE UM CLIQUE — revelado nas sentinelas também.
 *
 * O campo "Desconto" não existe antes de o tipo de relação virar "sinergia".
 * Uma sentinela que nunca clica vigia por meia hora uma árvore em que aquele
 * campo não está — e foi essa a segunda metade do CRÍTICO #1.
 */
async function revelarEstadosOcultos(pagina) {
  const revelados = [];
  const sinergia = pagina.getByRole("radio", { name: "sinergia" });
  if ((await sinergia.count()) >= 1) {
    await sinergia.first().click();
    await pagina.waitForSelector('input[inputmode="decimal"]', { timeout: 30000 });
    revelados.push("sinergia → Desconto");
  }
  return revelados;
}

/**
 * ══════════════════════════════════════════════════════════ ALTO #2, rodada 16 ═
 * A SENTINELA PASSA A EXERCER A INTERAÇÃO, E NÃO SÓ A REVELAÇÃO.
 *
 * O cabeçalho afirmava cobrir "qualquer atraso até 30 min nas rotas de
 * `ROTAS_COM_SENTINELA`, nos estados que a medida L confere". Era falso, e o
 * crítico da rodada 16 mediu: as sentinelas CLICAVAM num rádio (para revelar o
 * campo "Desconto") e **nunca punham foco em campo nenhum**. Um temporizador
 * armado dentro de um `onFocus` — escrito como conserto de teclado de celular —
 * simplesmente NUNCA EXISTIA na sentinela, e `clock.fastForward(30 min)`
 * adiantava um relógio sem nada agendado. Cinco portões verdes, 0 FALHA na
 * guarda, e aos 80 s o campo virava numérico, a tela dizia "Duração removida."
 * e o valor saía do banco.
 *
 * Por que as seis redes do vigia não viam: elas veem — mas só em página que
 * teve foco, e as únicas medidas que dão foco (C e F) fecham a aba em 15–25 s.
 * A medida L ficava verde porque **os dois lados encolhiam juntos**: nem a
 * guarda nem a sentinela punham foco, então "o estado medido" e "o estado
 * vigiado" concordavam em não existir. Concordância entre duas leituras que
 * podem encolher juntas não é piso — é eco.
 *
 * Duas coisas mudaram:
 *
 *  1. **foco é estado, igual a "campo que só nasce depois de um clique".** Cada
 *     sentinela exerce TODO campo que a rota tem: `focus()` de verdade, a
 *     bateria de eventos abaixo (ponteiro, teclado, entrada, mudança) e `blur()`.
 *     Um handler instalado por prop do React (`onFocus`, `onKeyDown`,
 *     `onPointerDown`…) ou por `addEventListener` dispara igual;
 *  2. **o piso vem de FORA das duas leituras.** `PISO_DE_CAMPOS_POR_ROTA` é um
 *     número escrito à mão: se a guarda parar de ver campos E a sentinela
 *     parar de mostrá-los, as duas leituras continuam concordando e a medida L
 *     reprova assim mesmo.
 *
 * O que fica FORA, dito por extenso e MEDIDO (a frase anterior estava errada nos
 * dois sentidos, e o crítico da rodada 17 conferiu):
 *
 *  - **`colar` NÃO está de fora:** `paste` é um dos 18 eventos de
 *    `EVENTOS_EXERCIDOS`. A palavra sobrava na lista do que a bateria não faz;
 *  - **o alcance é `input, textarea`, e só:** é o seletor desta função. Ficam de
 *    fora `<select>` (a "Tarefa mãe" e o "Destino" da relação são dois deles),
 *    `window` e `document` — um handler instalado em qualquer um dos três não
 *    tem quem o acorde aqui;
 *  - continuam de fora, como já estava dito: arrastar, rolar, tocar em tela
 *    sensível, e o clique em BOTÃO — este de propósito, porque apertar um botão
 *    da página é gravar no servidor, e a sentinela existe para observar.
 *
 * É o limite declarado desta família — e as duas redes de fonte
 * (`tiposDeInput` e `escritasNoDom`) continuam sendo a segunda linha para ele.
 */
const EVENTOS_EXERCIDOS = [
  "pointerover",
  "pointerenter",
  "pointerdown",
  "mousedown",
  "focus",
  "focusin",
  "click",
  "keydown",
  "keypress",
  "beforeinput",
  "input",
  "change",
  "keyup",
  "pointerup",
  "mouseup",
  "paste",
  "blur",
  "focusout",
];

/**
 * O piso de campos de uma rota — escrito à mão, fora das duas leituras.
 * Medido nesta base: 7 campos em cada uma das três rotas, com o "Desconto" da
 * sinergia revelado. Encolher este número é uma decisão que aparece no diff.
 */
const PISO_DE_CAMPOS_POR_ROTA = 7;

/** Exerce todo campo da página e devolve quantos foram exercidos. */
async function exercitarCampos(pagina) {
  return await pagina.evaluate((eventos) => {
    const campos = [...document.querySelectorAll("input, textarea")];
    for (const el of campos) {
      try {
        el.focus();
      } catch {
        /* nó que não aceita foco: o que importa é a tentativa */
      }
      for (const tipo of eventos) {
        try {
          el.dispatchEvent(new Event(tipo, { bubbles: true, cancelable: true }));
        } catch {
          /* tipo que este nó recusa */
        }
      }
      try {
        el.blur();
      } catch {
        /* idem */
      }
    }
    return campos.length;
  }, EVENTOS_EXERCIDOS);
}

/*
 * ════════════════════════════════════════════════════ ALTO #3, rodada 18 ════
 * A SENTINELA OLHAVA SÓ `type` E `inputMode` — E O DADO DO OPERADOR SUMIA
 * DEBAIXO DELA.
 *
 * `PROPRIEDADES_DO_CONTRATO` são duas: `type` e `inputMode`. `LER_CAMPOS` já
 * coletava `valor: el.value`, e esse valor **não entrava em veredito nenhum**
 * — nem em K, nem em `foraDaRegua`, nem em `auditarPagina`. A medida K
 * anunciava "atraso ATÉ ISSO está no alcance desta guarda" sobre meia hora
 * adiantada; o alcance verdadeiro era meia hora **para duas propriedades**.
 *
 * Sabotagem que passava, dentro do próprio `CampoNumerico`, sem escrever uma
 * letra no DOM (portanto invisível também para a varredura léxica):
 *
 *     const aoMudarRef = useRef(aoMudar);
 *     aoMudarRef.current = aoMudar;
 *     useEffect(() => {
 *       const t = window.setTimeout(() => { aoMudarRef.current(""); }, 90_000);
 *       return () => { window.clearTimeout(t); };
 *     }, []);
 *
 * O que o operador vive: digita 4,5, atende o telefone, volta, manda salvar —
 * a tela diz "Duração removida." e o banco fica vazio. As sentinelas viveram
 * 129–137 s (mais que os 90 s) e K adiantou meia hora duas vezes: o
 * temporizador disparou DENTRO delas, e elas não tinham com o que vê-lo.
 *
 * **Qual das cinco formas: a 5ª — "confere o caso, não a classe".** Duas
 * propriedades do campo eram vigiadas; o CONTEÚDO, que é o que o operador
 * perde, não.
 *
 * O conserto tem duas metades, e a primeira é a que importa:
 *
 *  1. **a sentinela DIGITA.** Ela deixou de ser uma aba aberta e parada e
 *     passou a ser a aba do operador que saiu para atender o telefone: todo
 *     campo da rota recebe um texto conhecido (decimal nos campos de número,
 *     marca nos de texto), e nada é salvo. É o cenário da sabotagem, montado;
 *  2. **o que ela digitou entra no veredito.** J e K comparam a fotografia dos
 *     campos (nome, `type`, `inputMode` e **valor**) com a do nascimento da
 *     sentinela. Qualquer campo que mude de valor sem ninguém ter tocado nele
 *     é reprovação com o nome do campo e os dois valores.
 *
 * E há piso, fora das duas leituras (`PISO_DE_CAMPOS_COM_VALOR`): se a
 * sentinela deixar de conseguir escrever nos campos, as duas fotografias
 * voltam a concordar em "tudo vazio" — o eco que o ALTO #2 da rodada 16 já
 * tinha nomeado — e a medida reprova assim mesmo.
 */

/** O que a sentinela digita num campo de número — o `4.5` do caso real. */
const VALOR_DECIMAL_DA_SENTINELA = "4.5";

/** O que ela digita num campo de texto. */
const PREFIXO_DA_SENTINELA = "sentinela-p6-";

/**
 * Piso escrito à mão: quantos campos a sentinela tem de conseguir preencher.
 * É o mesmo número de campos da rota — preencher menos é vigiar menos.
 */
const PISO_DE_CAMPOS_COM_VALOR = 7;

/** As propriedades do campo que a comparação das sentinelas cobre. */
const PROPRIEDADES_COMPARADAS = ["nome", "type", "inputMode", "valor"];

/**
 * A sentinela digita em todo campo da rota e devolve o que escreveu.
 * Nada é salvo: nenhum botão é apertado, e é essa a situação do operador que
 * digitou e saiu da frente do computador.
 */
async function preencherCampos(pagina) {
  const campos = pagina.locator("input, textarea");
  const quantos = await campos.count();
  let escritos = 0;
  for (let i = 0; i < quantos; i += 1) {
    const campo = campos.nth(i);
    let texto = `${PREFIXO_DA_SENTINELA}${String(i + 1)}`;
    try {
      if ((await campo.getAttribute("inputmode")) === "decimal") {
        texto = VALOR_DECIMAL_DA_SENTINELA;
      }
      await campo.fill(texto);
      escritos += 1;
    } catch {
      /* campo que não aceita escrita: ele conta no piso, e o piso reprova */
    }
  }
  return escritos;
}

/** O que mudou entre duas fotografias de campos — valor incluso. */
function mudancasNosCampos(antes, depois) {
  const problemas = [];
  if (antes.length !== depois.length) {
    problemas.push(
      `a rota tinha ${String(antes.length)} campo(s) quando a sentinela nasceu e tem ${String(
        depois.length,
      )} agora`,
    );
  }
  const quantos = Math.min(antes.length, depois.length);
  for (let i = 0; i < quantos; i += 1) {
    for (const prop of PROPRIEDADES_COMPARADAS) {
      if (antes[i][prop] !== depois[i][prop]) {
        problemas.push(
          `o campo ${String(i + 1)} ("${String(antes[i].nome).slice(
            0,
            26,
          )}") mudou \`${prop}\` sem ninguém tocar nele: ${JSON.stringify(
            antes[i][prop],
          )} → ${JSON.stringify(depois[i][prop])}`,
        );
      }
    }
  }
  return problemas;
}

/**
 * Quantos campos têm valor NÃO vazio agora — a segunda metade do piso.
 * Sem isto, uma leitura que parasse de trazer `valor` deixaria a comparação
 * acima sempre feliz: dois vazios são iguais.
 */
function camposComValor(campos) {
  return campos.filter((c) => String(c.valor ?? "").length > 0).length;
}

/**
 * As coleções que a fotografia cobre.
 *
 * [ALTO #2, rodada 18] `sources` entrou. Ela não é escrita pela página — e é
 * por isso mesmo que ela entra: uma coleção fora do universo é uma coleção
 * onde um estrago não aparece. E é dela que sai, DERIVADA, a fonte "Notas"
 * com que toda subtarefa nasce (sem isso, aquele id viria escrito à mão).
 */
const COLECOES_DA_FOTOGRAFIA = ["tasks", "edges", "notes", "sources"];

/**
 * O piso da fotografia, escrito à mão e fora dela. A semente do fixture tem 11
 * tarefas, 6 relações e 4 notas = 21 entidades; o piso é 15 para não quebrar se
 * outra medida da guarda tiver apagado alguma no caminho. Fotografia vazia (ou
 * quase) é cegueira, não aprovação — a mesma lei de "checagem pulada é checagem
 * aprovada".
 */
const PISO_DA_FOTOGRAFIA = 15;

/*
 * ═══════════════════════════════════════════════════════ ALTO #1, rodada 19 ═
 * A CURA DA RODADA 18 PEGOU O CASO, NÃO A CLASSE — E A ARMADILHA MUDOU DE
 * SUPERFÍCIE: EM VEZ DE MEXER NUM CAMPO, ELA MATA A **AÇÃO**.
 *
 * A sentinela da rodada 18 fotografa CAMPOS (`nome`, `type`, `inputMode`,
 * `valor`) e compara duas fotos. Sabotagem do coordenador, dentro do
 * `DuracaoForm`, que passou nos CINCO portões com "54 medidas no Chromium,
 * todas dentro da régua":
 *
 *     const emRepousoRef = useRef(false);
 *     useEffect(() => {
 *       const t = window.setTimeout(() => { emRepousoRef.current = true; }, 60_000);
 *       return () => { window.clearTimeout(t); };
 *     }, []);
 *     …
 *     function aoEnviar(e) {
 *       e.preventDefault();
 *       if (emRepousoRef.current) return;   // ← o botão vira enfeite
 *
 * Ela não escreve em nó de DOM (invisível para a varredura léxica de
 * `tarefa-varredura-derivada`), não usa o atributo `disabled` (invisível para
 * o teste de unidade que o proíbe) e não toca em campo nenhum (invisível para
 * J e para K). Medido no Chromium, com a sabotagem conferida presente antes e
 * depois da corrida:
 *
 *     duração na loja, antes:   2
 *     (espera 65 s, digita 7.25, clica em "Salvar duração")
 *     a tela disse:             (nada — nem "salva", nem erro)
 *     duração na loja, depois:  2
 *
 * **Qual das cinco formas: a 5ª — "confere o caso, não a classe".** A classe é
 * "o tempo estraga a PÁGINA"; o caso conferido era "o tempo estraga o CONTRATO
 * DE UM CAMPO". Olhar é menos do que usar: uma aba parada a corrida inteira
 * nunca descobre que o botão dela deixou de funcionar.
 *
 * **O conserto:** no fim da vida, cada sentinela para de olhar e USA a página —
 * digita uma duração, aperta "Salvar duração" e exige que o número PEDIDO tenha
 * chegado à LOJA. Quatro reprovações distintas, cada uma nomeando o que
 * quebrou: a caixa não ficou com o que foi digitado · a tela não anunciou
 * "Duração salva." · a loja continuou com o valor de antes · a loja já tinha o
 * valor pedido (aí a medida não mediu ação nenhuma).
 *
 * ## O ALCANCE DE TEMPO DESTA MEDIDA, dito por escrito
 *
 * São dois alcances, e cada medida imprime o seu:
 *
 *  - **J (relógio de verdade):** a escrita é exercida com a aba viva há pelo
 *    menos `PISO_DE_VIDA_PARA_A_ESCRITA_MS`. Não é sorte nem média: se a
 *    corrida ficar rápida a ponto de a sentinela ser mais nova que isso, a
 *    medida ESPERA a diferença antes de escrever. Medido nesta base: ~111 s de
 *    vida na primeira rota. Alcance = esse tempo REAL, e nada além;
 *  - **K (relógio sob controle da guarda):** além da vida real da aba, a página
 *    levou DOIS adiantamentos de `ADIANTAMENTO_DO_RELOGIO` (meia hora cada).
 *    Alcance = uma hora de relógio, e nada além.
 *
 * Fora disso não há alcance nenhum, e nenhuma linha desta guarda afirma que há:
 * ação estragada por temporizador de mais de uma hora continua do lado de fora,
 * e isso está na lista da medida Z.
 */

/** A tarefa que uma rota de sentinela abre, na chave da fotografia. */
function tarefaDaRota(rota) {
  return `tasks/${rota.slice(rota.lastIndexOf("/") + 1)}`;
}

/** O campo da loja que a escrita da sentinela move. */
const CAMPO_DA_ESCRITA_DA_SENTINELA = "estimativaDias";

/**
 * As durações que as sentinelas mandam gravar — uma por sentinela, todas
 * fracionárias (é o `4,5` do caso real) e todas diferentes entre si: as duas
 * sentinelas de uma rota escrevem na MESMA tarefa, e valores iguais fariam a
 * segunda medir "já estava assim".
 */
const DURACOES_DA_ESCRITA_DA_SENTINELA = ["7.25", "8.5", "9.75", "11.25", "12.5", "13.75"];

/**
 * A idade mínima da aba no instante em que a escrita é exercida — é ESTE número
 * que o alcance de tempo da medida de AÇÃO afirma, em J. Medida mais nova que
 * isto espera a diferença; sem isso, uma corrida mais rápida encolheria o
 * alcance em silêncio, que é o vício que a medida L já persegue.
 */
const PISO_DE_VIDA_PARA_A_ESCRITA_MS = 60000;

/** Quantas sentinelas exerceram a escrita com o valor conferido na loja. */
let SENTINELAS_QUE_ESCREVERAM = 0;

/** Piso escrito à mão: três rotas × dois relógios = seis escritas exercidas. */
const PISO_DE_ESCRITAS_DE_SENTINELA = 6;

/** Quanto tempo a loja tem para refletir o que a sentinela mandou gravar. */
const ESPERA_DA_LOJA_MS = 15000;

/** Um campo de uma entidade, lido da loja INTEIRA (a mesma fonte da família P). */
async function valorNaLoja(chave, campo) {
  const foto = await fotografia();
  return foto.get(chave)?.get(campo) ?? "(a entidade não está na loja)";
}

/** Espera a loja refletir o que foi pedido; devolve o que houver no fim. */
async function esperarNaLoja(chave, campo, esperado, limiteMs = ESPERA_DA_LOJA_MS) {
  const ate = Date.now() + limiteMs;
  let lido = await valorNaLoja(chave, campo);
  while (lido !== esperado && Date.now() < ate) {
    await new Promise((ok) => setTimeout(ok, 500));
    lido = await valorNaLoja(chave, campo);
  }
  return lido;
}

/**
 * A ESCRITA EXERCIDA NO FIM DA VIDA DA SENTINELA — a medida de AÇÃO.
 *
 * Devolve os problemas achados e o resumo que entra no veredito da medida que
 * a chamou. Nada aqui julga contrato de campo: isso é o que J e K já faziam, e
 * é exatamente o que a sabotagem do coordenador contorna.
 */
async function exercerEscritaDaSentinela(sentinela) {
  const chave = tarefaDaRota(sentinela.rota);
  const bruto = sentinela.escritaPedida;
  const pedido = j(Number(bruto));
  const problemas = [];
  /*
   * O alcance PROMETIDO, garantido — não torcido. A espera só acontece quando
   * a corrida foi rápida demais; nesta base ela é zero.
   */
  const idadeAntes = Date.now() - sentinela.nascimento;
  const falta = PISO_DE_VIDA_PARA_A_ESCRITA_MS - idadeAntes;
  if (falta > 0) await new Promise((ok) => setTimeout(ok, falta));
  const idade = Date.now() - sentinela.nascimento;
  const antes = await valorNaLoja(chave, CAMPO_DA_ESCRITA_DA_SENTINELA);
  const campo = campoPorNome(sentinela.pagina, /^Duração \(dias, p80/).first();
  let naCaixa = "(a caixa não aceitou o que foi digitado)";
  let anuncio = "(a tela não disse nada)";
  try {
    await campo.fill(bruto);
    naCaixa = await campo.inputValue();
    await sentinela.pagina.getByRole("button", { name: "Salvar duração" }).click();
    anuncio = await anunciou(sentinela.pagina, /Duração (salva|removida)\./);
  } catch (erro) {
    problemas.push(
      `a sentinela não conseguiu exercer a escrita: ${
        erro instanceof Error ? erro.message.split("\n")[0] : String(erro)
      }`,
    );
  }
  const depois = await esperarNaLoja(chave, CAMPO_DA_ESCRITA_DA_SENTINELA, pedido);
  if (naCaixa !== bruto) {
    problemas.push(
      `a caixa de duração ficou com ${JSON.stringify(
        naCaixa,
      )} e a sentinela digitou ${JSON.stringify(bruto)}`,
    );
  }
  if (antes === pedido) {
    problemas.push(
      `a loja JÁ tinha ${pedido} em ${chave}/${CAMPO_DA_ESCRITA_DA_SENTINELA} antes desta escrita — pedir o que já está lá não exerce ação nenhuma`,
    );
  }
  if (!/Duração salva\./.test(anuncio)) {
    problemas.push(
      `a tela NÃO anunciou "Duração salva." depois do clique: li ${JSON.stringify(anuncio)}`,
    );
  }
  if (depois !== pedido) {
    problemas.push(
      `a AÇÃO da página não gravou: pedi ${pedido} em ${chave}/${CAMPO_DA_ESCRITA_DA_SENTINELA} e a loja tem ${depois} (antes desta escrita: ${antes})`,
    );
  }
  if (problemas.length === 0) SENTINELAS_QUE_ESCREVERAM += 1;
  return {
    idade,
    problemas,
    resumo: `AÇÃO EXERCIDA no fim da vida (aba viva há ${String(
      Math.round(idade / 1000),
    )}s, piso escrito à mão ${String(
      Math.round(PISO_DE_VIDA_PARA_A_ESCRITA_MS / 1000),
    )}s): digitei ${JSON.stringify(bruto)}, a caixa ficou com ${JSON.stringify(
      naCaixa,
    )}, cliquei em "Salvar duração", a tela disse ${JSON.stringify(
      anuncio,
    )} e ${chave}/${CAMPO_DA_ESCRITA_DA_SENTINELA} foi de ${antes} para ${depois} (pedido ${pedido})`,
  };
}

/**
 * Um campo pelo NOME QUE O OPERADOR LÊ. Vai por papel + nome acessível, e não
 * por `label:has-text(...)`: dois dos sete campos da página nomeiam-se por
 * `aria-label` e não por `<label>`, e um localizador que só olha `<label>`
 * devolveria zero elementos para eles — uma checagem que se cala em vez de
 * reprovar (foi medido: o "Autor da nota" sumia da varredura).
 */
function campoPorNome(pagina, nome) {
  return pagina.getByRole("textbox", { name: nome });
}

/**
 * ════════════════════════════════════════════════════ ALTO #4, rodada 17-B ═══
 * A MEDIDA K TRAVOU NO CI, E O QUE TRAVOU FOI ESTA FUNÇÃO.
 *
 * Corrida no GitHub Actions (PR #43, head `feed811e`, contêiner
 * `mcr.microsoft.com/playwright:v1.55.1-noble`):
 *
 *   [01:44] → K /tarefa/task-docs …
 *   medida travada: "K /tarefa/task-docs" passou de 150s
 *   [02:14] FALHA K /tarefa/task-docs · (a medida estourou o teto de tempo) —
 *           um page.evaluate desta página passou de 30000 ms sem voltar
 *
 * **A aritmética nomeia a chamada, sem palpite:** 01:44 → 02:14 são exatamente
 * 30 s, que é `TETO_DO_EVALUATE_MS`; o `fastForward` anterior já tinha voltado
 * (senão o estouro seria o da medida, 150 s); e o PRIMEIRO `page.evaluate` de K
 * é este `assentar`. Era este `await` que não voltava.
 *
 * ## Por que, e por que só em K
 *
 * `clock.install()` **substitui o `requestAnimationFrame` da página** — medido:
 * `String(requestAnimationFrame).includes("[native code]")` devolve `false`
 * dentro de uma página com o relógio instalado. Com o relógio de mentira ligado,
 * **quem decide quando existe um quadro é a guarda**, não o navegador. Esperar
 * um quadro ali é esperar por uma coisa que só nós podemos causar: um impasse
 * por construção, que nesta máquina passava batido porque o relógio falso do
 * Playwright ia andando junto com o tempo real, e naquele contêiner não foi.
 *
 * É também a explicação de por que **só K trava, e já na primeira rota**: as
 * sentinelas J vivem nas mesmas páginas, em segundo plano, com os mesmos campos
 * exercidos — mas sem relógio de mentira, então o `requestAnimationFrame` delas
 * é o nativo e o quadro vem sozinho. `assentar()` sobre página com relógio
 * instalado só acontece dentro de K.
 *
 * ## O que foi medido aqui (a reprodução é FORÇADA, não torcida)
 *
 * Não consegui fazer o travamento aparecer sozinho nesta máquina — rodei a
 * matriz de 16 casos (com e sem as três chaves anti-congelamento, com e sem
 * `--disable-gpu`, aba em primeiro e em segundo plano, com e sem `fastForward`)
 * e ainda repeti tudo com o **`playwright-core@1.55.1` do contêiner** (aqui o
 * padrão é 1.63.0): passou nos 32. **Digo isso com todas as letras: o
 * travamento do contêiner não foi reproduzido espontaneamente aqui.**
 *
 * Então forcei a condição, em vez de esperar por ela — "o renderer nunca
 * entrega um quadro", deixando o resto da página viva:
 *
 *   TRAVOU   10000ms  ANTIGO (dois rAF)        ← o impasse, isolado
 *   ok           3ms  NOVO (clock.runFor 32ms)
 *
 * E o substituto **preserva o sentido**, com o relógio parado (`pauseAt`):
 *
 *   relogio parado:  {"quadros":0,"timer":0}
 *   apos runFor(32): {"quadros":2,"timer":1}
 *
 * Os dois `requestAnimationFrame` encadeados correm, e os temporizadores que
 * venceriam nesses 32 ms também — que é mais do que "dois quadros" davam.
 *
 * ## A regra que fica
 *
 * **Com relógio de mentira instalado, a guarda nunca espera um quadro: ela o
 * causa.** Sem relógio de mentira, o `requestAnimationFrame` é o nativo e a
 * espera tem saída por temporizador REAL. Nos dois caminhos o fim é garantido
 * por construção — não por o ambiente colaborar. O teto de 30 s do
 * `page.evaluate`, o teto por medida e o teto de corrida continuam onde
 * estavam: foram eles que transformaram 25 minutos de silêncio neste
 * diagnóstico, e nenhum deles foi afrouxado para "caber".
 */
const DOIS_QUADROS_MS = 32;

/**
 * A saída de emergência, em tempo REAL, do caminho sem relógio de mentira: se o
 * quadro não vier, o `setTimeout` (que ali é o nativo) devolve a promessa.
 */
const SAIDA_DE_ASSENTAR_MS = 1000;

/** Dois quadros: o que uma `ref` faz no nó acontece depois do commit do React. */
async function assentar(pagina) {
  if (pagina.__relogioDeMentira === true) {
    // O rAF desta página é FALSO. Quem o acorda é esta linha, e mais ninguém.
    await pagina.clock.runFor(DOIS_QUADROS_MS);
    return;
  }
  await pagina.evaluate(
    (saidaMs) =>
      new Promise((r) => {
        let pronto = false;
        const fim = () => {
          if (pronto) return;
          pronto = true;
          r(null);
        };
        requestAnimationFrame(() => requestAnimationFrame(fim));
        // Relógio de verdade: este temporizador é o nativo e sempre vence o
        // impasse. Quadro que não vem deixa de ser espera infinita.
        setTimeout(fim, saidaMs);
      }),
    SAIDA_DE_ASSENTAR_MS,
  );
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * O VIGIA DO CONTRATO — a pergunta que mudou na rodada 14 (CRÍTICO)
 *
 * Até a rodada 13 esta guarda perguntava **"o que o campo é agora?"** — e
 * "agora" era sempre os primeiros segundos depois da carga. O coordenador
 * derrubou a rodada inteira com três linhas dentro de uma `ref`:
 *
 *     setTimeout(() => {
 *       Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "type")
 *         ?.set?.call(el, "number");
 *     }, 4000);
 *
 * Medido no Chromium, com o servidor conferido por `/proc/<pid>/cwd`: na carga
 * o campo é `type=text` com valor `2`; 6 s depois é `type=number`; o operador
 * digita `e`, a caixa reporta `value=""`, a tela anuncia "Duração removida." e
 * depois do F5 o `2` sumiu do banco. **Cinco portões verdes** — `vitest`,
 * `tsc`, `eslint`, contraste e esta guarda com 9 medidas ok — e o dado do
 * operador apagado. `setTimeout` dentro de uma `ref` não é exotismo: é o que
 * se escreve para corrigir teclado de celular, foco e telemetria.
 *
 * A pergunta desta rodada é outra: **"alguma coisa mexeu nisto em algum
 * momento?"** Antes de a página hidratar, `addInitScript` instala na PRÓPRIA
 * PÁGINA um vigia que intercepta toda mudança nos atributos que definem o
 * contrato do campo (`type`, `inputMode`) em QUALQUER `<input>`/`<textarea>`,
 * anotando quem mudou, de quê para quê, e quando. Cada medida termina exigindo
 * que o registro esteja VAZIO. Um vigia instalado antes da hidratação vê o
 * setter do protótipo, o `setAttribute`, o `Object.assign`, a `ref` atrasada e
 * o pacote de terceiro — porque não olha o código, olha a mutação.
 *
 * Três redes, de propósito, e uma mudança pode aparecer em duas ao mesmo tempo
 * (isso é evidência a mais, não defeito):
 *
 *  1. **o setter do protótipo** de `type` e de `inputMode`, embrulhado no
 *     protótipo onde ele mora de verdade. Pega `el.type = x`,
 *     `Object.assign(el, {type:x})` e também
 *     `getOwnPropertyDescriptor(HTMLInputElement.prototype,"type").set.call(el,x)`
 *     — porque a descrição que esse código vai buscar já é a nossa: o vigia
 *     corre ANTES de qualquer script da página.
 *  2. **`setAttribute` / `removeAttribute` / `toggleAttribute`**, para a escrita
 *     que não passa pela propriedade.
 *  3. **um `MutationObserver`** de atributo, que não depende de os dois
 *     embrulhos acima sobreviverem — se alguém restaurar o protótipo original,
 *     a mutação ainda é vista, porque `type` e `inputMode` refletem em atributo.
 *
 * O registro vive em `sessionStorage`, e não numa variável: `reload()` e
 * `goto()` da mesma origem re-executam o script de inicialização, e um registro
 * em memória zeraria justamente nas medidas que navegam (E, F, G).
 *
 * **Só mudança de verdade é anotada** (`de !== para`). Uma escrita que põe
 * `type="text"` onde já havia `text` não muda contrato nenhum, e anotá-la faria
 * o vigia acusar o React em toda re-renderização.
 *
 * ## O LIMITE DESTE VIGIA, declarado por escrito
 *
 * Um vigia dentro da página só vê o que acontece **enquanto a página existe**.
 * Uma mutação agendada para depois do fim da guarda está fora do alcance de
 * qualquer observação em navegador — não há truque que conserte isso, e fingir
 * o contrário seria pior que o buraco.
 *
 * Duas coisas foram feitas a respeito, em vez de fingir — e as duas imprimem o
 * próprio alcance na saída:
 *
 *  - **medidas J, as sentinelas de tempo real — UMA POR ROTA.** Páginas
 *    abertas antes da primeira medida e lidas depois da última. Cada uma vive
 *    o tempo INTEIRO da guarda, e a medida imprime esse tempo: **medido nesta
 *    rodada, ~42–50 s.** `PISO_DE_VIDA_DA_SENTINELA` (30 s) reprova se esse
 *    alcance encolher — quem acelerar a guarda a ponto de reduzir o alcance
 *    tem de baixar o número de propósito, no diff.
 *  - **medidas K, as sentinelas do relógio — UMA POR ROTA.** Esperar 60 s para
 *    pegar uma mutação de 60 s seria pagar caro por uma duplicação: o sabotador
 *    escreveria 120 s. Então estas sentinelas nascem com o relógio da página
 *    sob controle da guarda (`clock.install()`), e cada medida K **adianta
 *    meia hora de uma vez**. Todo `setTimeout`/`setInterval` agendado dispara,
 *    e o vigia anota.
 *  - **medida L, o alcance conferido contra o MEDIDO (rodada 15).** Até a
 *    rodada 14 as duas sentinelas abriam `/tarefa/task-docs` e não tocavam em
 *    nada — o alcance de 30 min que este cabeçalho afirmava era verdade para
 *    UMA rota, no estado inicial dela. O crítico passou com o setter do
 *    protótipo aos 60 s e um `if` de rota (`task-build`): cinco portões verdes
 *    e a duração do operador apagada no Chromium. Agora toda rota que a guarda
 *    abre ou navega se REGISTRA, cada rota tem as suas duas sentinelas, cada
 *    sentinela revela os estados que só existem depois de um clique (o campo
 *    "Desconto"), e a medida L reprova se aparecer rota visitada sem sentinela
 *    ou sentinela com menos estado do que a guarda viu ali. **A afirmação que
 *    esta guarda faz, por extenso (revista na rodada 16): qualquer atraso até
 *    30 min, em cada uma das rotas de `ROTAS_COM_SENTINELA`, nos estados que a
 *    medida L confere E nos handlers que o exercício de campo da sentinela
 *    acorda — foco, ponteiro, teclado, entrada e mudança em TODO campo da
 *    rota.**
 *
 *    [ALTO #2, rodada 16] Até a rodada 15 esta mesma frase era FALSA, e o
 *    crítico mediu por quê: as sentinelas clicavam num rádio (para revelar o
 *    "Desconto") e **nunca punham foco em campo nenhum**. Um `setTimeout` de
 *    75 s armado dentro de um `onFocus` nunca chegava a existir na sentinela, e
 *    `fastForward(30 min)` adiantava um relógio sem nada agendado: 0 FALHA na
 *    guarda, cinco portões verdes, e aos 80 s o campo virava numérico e a
 *    duração do operador saía do banco. A medida L ficava verde porque os dois
 *    lados encolhiam juntos — nem a guarda nem a sentinela punham foco, e
 *    "estado medido" e "estado vigiado" concordavam em não existir. Agora cada
 *    sentinela exerce todo campo da rota (`exercitarCampos`), a medida K o faz
 *    de novo ENTRE dois adiantamentos de meia hora, e a medida L cobra três
 *    números contra um piso escrito à mão, fora das duas leituras.
 *
 *    MEDIDO na rodada 15, e maior do que a afirmação: `clock.install()` não
 *    congela o relógio da página — ele continua andando com o tempo real —, e
 *    a sentinela do relógio vive ~100 s antes do adiantamento. O alcance real
 *    foi **~31,6 min** (mutação agendada para 31 min: VERMELHA, medida;
 *    agendada para 45 min: VERDE, também medida). A guarda promete 30 min
 *    porque é o número que ela CONTROLA; os ~1,6 min a mais são folga, não
 *    contrato.
 *
 * **O que continua fora de alcance, dito por extenso e medido:** (a) atraso maior
 * que os 30 min que cada medida K adianta — e ela adianta DUAS vezes, com o
 * exercício de campo entre elas, então o alcance de uma mutação armada por um
 * handler que só nasce com o tempo é de mais 30 min depois do exercício;
 * (b) mutação disparada por algo que o relógio de mentira não controla e que só
 * acontece depois do fim da guarda — por exemplo a resposta de uma requisição de
 * rede real que demore mais que isso; (c) rota do produto que esta guarda NÃO
 * visita: a medida L prova que o alcance cobre tudo o que a guarda visita, e não
 * que a guarda visita tudo; (d) **interação que o exercício da sentinela não
 * faz**: arrastar, rolar, tocar em tela sensível, e o clique em BOTÃO — este
 * último de propósito, porque apertar um botão da página é gravar no servidor, e
 * a sentinela existe para observar, não para escrever. **`colar` NÃO entra nesta
 * lista** (`paste` está na bateria; a palavra sobrava aqui), e o que entra e não
 * estava dito é o ALCANCE do exercício: `exercitarCampos` varre
 * `input, textarea` e nada mais — `<select>`, `window` e `document` ficam de
 * fora. A lista exata dos eventos exercidos é `EVENTOS_EXERCIDOS`, e o número de
 * campos exercidos sai impresso em cada medida J, K e L: hoje, 7 campos × 18
 * eventos por rota.
 *
 * O que compensa, sem ser o bastante sozinho: as duas redes de fonte
 * (`tiposDeInput` e `escritasNoDom`, no `src/` inteiro) pegam a escrita quando
 * ela está escrita neste repositório, em qualquer grafia da família — e desde a
 * rodada 16 a família inclui `getOwnPropertyDescriptor(…)?.set?.call(el, …)`,
 * `Reflect.apply`, `__lookupSetter__` e o nome do protótipo de qualquer
 * elemento. Elas só não alcançam código que a varredura não lê (pacote de fora,
 * import dinâmico, código do próprio Next). A interseção "escrita que a
 * varredura não lê **e** disparada por uma interação que a sentinela não faz"
 * fica descoberta, e está dito aqui.
 * ════════════════════════════════════════════════════════════════════════════
 */

/** A chave do registro do vigia no `sessionStorage` da página sob teste. */
const CHAVE_DO_VIGIA = "__vigia-p6-contrato";

/**
 * O nome do `exposeBinding` pelo qual o vigia entrega cada anotação AO NODE.
 * É a cópia que a página não controla — ver o bloco do CRÍTICO #2 abaixo.
 */
const CANAL_FORA_DA_PAGINA = "__vigiaP6Envia";

/** As propriedades vivas que definem o contrato do campo. */
const PROPRIEDADES_DO_CONTRATO = ["type", "inputMode"];
/** Os atributos correspondentes, em minúsculas (é assim que o DOM os nomeia). */
const ATRIBUTOS_DO_CONTRATO = ["type", "inputmode"];

/**
 * O piso de vida da sentinela, em milissegundos — escrito à mão, não derivado
 * do que a corrida atual gastar. É ele que transforma "o vigia alcança algum
 * tempo" em "o vigia alcança pelo menos isto".
 */
const PISO_DE_VIDA_DA_SENTINELA = 30000;

/**
 * Quanto a medida K adianta o relógio da sentinela do relógio, de uma vez.
 * Meia hora: é o alcance declarado desta guarda para mutação agendada.
 */
const ADIANTAMENTO_DO_RELOGIO = 1800000;

/**
 * Este corpo NÃO roda no Node: o Playwright o serializa e o executa dentro do
 * Chromium, antes de qualquer script da página (`addInitScript`). Por isso ele
 * fala com `window.` em tudo — é a única referência que existe nos dois lados.
 */
function VIGIA_DO_CONTRATO(config) {
  const { chave, canal, propriedades, atributos } = config;
  /*
   * Este realm já tem vigia? Instalar duas vezes embrulharia o mesmo setter
   * duas vezes e DOBRARIA cada anotação — e uma contagem dobrada é tão
   * mentirosa quanto uma zerada.
   */
  if (Object.prototype.hasOwnProperty.call(window, "__vigiaP6")) return;
  const inicio = Date.now();

  /*
   * ═════════════════════════ O ATAQUE QUE O CRÍTICO DA RODADA 16 NOMEOU ═
   * SEQUESTRAR `document.createElement` PARA QUE O CANÁRIO ADOTE UM CAMPO
   * REAL — E COM ELE A ISENÇÃO.
   *
   * Ele não o tentou, e disse isso. O caminho é real: `abrirCanario` fazia
   * `doc.createElement("input")`, e um `createElement` sequestrado poderia
   * devolver o `<input>` da duração. Aquele nó entrava no `WeakSet` de
   * canários, e `foraDaRegua()` passava a absolver TODA mudança nele — para
   * sempre. Bastava devolver o elemento ao lugar em vez de deixar o
   * `el.remove()` final tirá-lo da tela para A, B e C não perceberem.
   *
   * Três fechos, os três baratos, e nenhum depende de boa vontade da página:
   *
   *  1. **as referências NATIVAS, capturadas aqui.** Este corpo roda em
   *     `addInitScript`, antes do primeiro script da página: `createElement`,
   *     `appendChild`, `remove` e o getter de `isConnected` ainda são os do
   *     navegador. O canário passa a usar ESTAS, e sequestrar os nomes depois
   *     não muda nada — é a mesma técnica que já valia para o canal do Node;
   *  2. **um canário é um nó NOVO e FORA da árvore.** Se o que voltou de
   *     `createElement` já está na árvore (ou não é um `<input>`), o canário
   *     não voa: `abrirCanario` devolve `null`, `soltarCanario` devolve `null`
   *     e a medida reprova com "O CANAL ESTÁ QUEBRADO" — que é a frase certa,
   *     porque alguém mexeu na testemunha;
   *  3. **a isenção dura o voo, não a sessão.** No fim do voo o elemento sai
   *     do `WeakSet` (`canarios.delete`). Mesmo que um atacante guarde a
   *     referência do canário e depois o enfie na página no lugar de um campo
   *     de verdade, ele não herda isenção nenhuma — as anotações do voo já
   *     foram gravadas com `canario: true`, e tudo o que vier depois é medido
   *     como qualquer outro campo.
   */
  const criarElemento = window.document.createElement;
  const inserirNo = window.Node.prototype.appendChild;
  const retirarNo = window.Element.prototype.remove;
  const descDeConectado = Object.getOwnPropertyDescriptor(window.Node.prototype, "isConnected");
  /** `isConnected` pelo getter NATIVO — a régua não pode ler um valor forjado. */
  const naArvore = (no) => {
    try {
      const v =
        typeof descDeConectado?.get === "function" ? descDeConectado.get.call(no) : no.isConnected;
      return v === true;
    } catch {
      return false;
    }
  };

  /*
   * ══════════════════════════════════════════════════ CRÍTICO #2, rodada 15 ═
   * O REGISTRO MORAVA ONDE A PÁGINA MANDA — E "REGISTRO VAZIO" ERA O VERDE.
   *
   * O crítico da rodada 15 derrubou as medidas J e K com SEIS linhas: um
   * `setInterval` de 1 s gravando `"[]"` em `sessionStorage` na chave deste
   * vigia. A mesma mutação que, sem essas seis linhas, deixava a guarda
   * VERMELHA com 8 mudanças nomeadas e a pilha apontando a linha, passava a
   * imprimir `vigia instalado=true`, as seis redes ativas e `0 mudança(s)
   * fora da régua` — EXIT=0, 20 medidas na régua. A guarda não ficava cega:
   * ela MENTIA. Cegueira manda investigar; afirmação falsa fecha a
   * investigação. E lotar a cota do `sessionStorage` tinha o mesmo efeito sem
   * sabotar ninguém, porque o `setItem` lançava dentro de um `catch` vazio.
   *
   * Três coisas mudaram, e as três estão medidas no relatório da rodada:
   *
   *  1. **a cópia autoritativa saiu do alcance da página.** `naMemoria` é um
   *     fechamento desta função — não há nome em `window` que leve a ele — e
   *     `window.__vigiaP6` passa a ser uma propriedade NÃO gravável e NÃO
   *     configurável, com o objeto congelado. Antes era uma atribuição
   *     simples: `window.__vigiaP6 = { mudancas: () => [] }` por parte da
   *     página bastava para calar o vigia inteiro (medido nesta rodada, como
   *     sabotagem própria nº 1).
   *  2. **uma via que a página não controla:** `window[canal]` é um
   *     `exposeBinding` do Playwright — chamá-lo entrega a anotação ao
   *     processo do Node. A referência é capturada AQUI, antes de existir o
   *     primeiro script da página; a página consegue sobrescrever
   *     `window[canal]` (medido), e não muda nada, porque o vigia nunca volta
   *     a ler daquele nome. A guarda compara as três cópias (memória,
   *     depósito, Node) e REPROVA na divergência: divergir é o sinal de que
   *     alguém mexeu no registro.
   *  3. **estouro de cota deixou de ser silêncio.** O `catch` do `setItem` era
   *     um comentário; agora ele marca `depositoQuebrado`, e depósito
   *     quebrado reprova a medida com essa frase.
   *
   * O `sessionStorage` continua existindo por um motivo só: ele é o
   * CARREGADOR entre navegações (`reload()`/`goto()` criam realm novo e a
   * memória do fechamento nasce vazia). Deixou de ser a verdade.
   */
  const enviarParaFora = typeof window[canal] === "function" ? window[canal] : null;
  /** Identidade deste carregamento de página — é o que casa as três cópias. */
  const carga = `${String(inicio)}-${Math.random().toString(36).slice(2, 10)}`;
  let sequencia = 0;
  /** A cópia AUTORITATIVA. Fechamento: nenhum código da página a alcança. */
  let naMemoria = [];
  /** Por que o depósito parou de servir — `null` enquanto ele serve. */
  let depositoQuebrado = null;
  /** Os campos descartáveis que a guarda usa como canário. */
  const canarios = new WeakSet();

  /** O que o DEPÓSITO tem agora — `null` quando o acesso lança. */
  const lerDeposito = () => {
    try {
      const cru = window.sessionStorage.getItem(chave);
      if (typeof cru !== "string") return [];
      const lista = JSON.parse(cru);
      return Array.isArray(lista) ? lista : [];
    } catch {
      return null;
    }
  };
  const semente = lerDeposito();
  if (semente === null) depositoQuebrado = "o depósito não pôde ser lido na semeadura";
  else naMemoria = semente;

  const anotar = (entrada) => {
    sequencia += 1;
    const cheia = { ...entrada, carga, seq: sequencia };
    // 1º a memória, que ninguém alcança.
    naMemoria.push(cheia);
    // 2º o depósito — e o estouro dele é um DEFEITO, não um silêncio.
    try {
      window.sessionStorage.setItem(chave, JSON.stringify(naMemoria));
    } catch (erro) {
      depositoQuebrado = `o depósito recusou a escrita: ${
        erro instanceof Error ? erro.message.split("\n")[0] : String(erro)
      }`;
    }
    // 3º o Node, que a página não controla. Vai com o estado do depósito
    // colado, para o aviso chegar mesmo que a página zere tudo em seguida.
    if (enviarParaFora !== null) {
      try {
        void enviarParaFora({ ...cheia, depositoQuebrado });
      } catch {
        /* o canal caiu; a memória e o depósito seguem */
      }
    }
  };

  const ehCampo = (el) =>
    el !== null &&
    typeof el === "object" &&
    typeof el.tagName === "string" &&
    (el.tagName === "INPUT" || el.tagName === "TEXTAREA");

  const descrever = (el) => {
    if (!ehCampo(el)) return "(não é campo)";
    let nome = "";
    try {
      const rotulo = typeof el.closest === "function" ? el.closest("label") : null;
      nome =
        rotulo === null || rotulo === undefined
          ? (el.getAttribute("aria-label") ?? "")
          : (rotulo.innerText || "").split("\n")[0].trim();
    } catch {
      /* elemento solto, sem árvore: o nome não importa para o veredito */
    }
    return `<${el.tagName.toLowerCase()}${nome.length > 0 ? ` "${nome.slice(0, 32)}"` : ""}>`;
  };

  /**
   * Quem chamou — as três primeiras molduras que não são do próprio vigia.
   * As molduras do vigia aparecem como `<anonymous>:NN:NN`, porque este corpo
   * foi injetado na página e não tem arquivo; é por isso que o filtro é esse.
   */
  const pilha = () =>
    (new Error("vigia").stack ?? "")
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/<anonymous>:\d+:\d+\)?$/.test(l))
      .slice(0, 3)
      .join(" ⟵ ") || "(só molduras do próprio vigia)";

  /** O protótipo onde a propriedade MORA — `inputMode` não mora no do input. */
  const donoDa = (prop) => {
    let proto = window.HTMLInputElement.prototype;
    while (proto !== null && proto !== undefined) {
      const descricao = Object.getOwnPropertyDescriptor(proto, prop);
      if (descricao !== undefined) return { proto, descricao };
      proto = Object.getPrototypeOf(proto);
    }
    return null;
  };

  const redes = [];

  // 1ª rede — o setter do PROTÓTIPO.
  for (const prop of propriedades) {
    const dono = donoDa(prop);
    if (dono === null) continue;
    const { proto, descricao } = dono;
    if (typeof descricao.set !== "function" || typeof descricao.get !== "function") continue;
    const ler_ = descricao.get;
    const escrever_ = descricao.set;
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: descricao.enumerable,
      get() {
        return ler_.call(this);
      },
      set(valor) {
        const de = ehCampo(this) ? String(ler_.call(this)) : null;
        escrever_.call(this, valor);
        if (de === null) return;
        const para = String(ler_.call(this));
        if (de === para) return;
        anotar({
          via: `setter do protótipo .${prop}`,
          prop,
          de,
          para,
          alvo: descrever(this),
          naArvore: naArvore(this),
          canario: canarios.has(this),
          marcaDoCanario: canarios.has(this) ? this.getAttribute("data-vigia-canario") : null,
          emMs: Date.now() - inicio,
          pilha: pilha(),
        });
      },
    });
    redes.push(`setter .${prop}`);
  }

  // 2ª rede — a escrita que não passa pela propriedade.
  const embrulhar = (nome) => {
    const original = window.Element.prototype[nome];
    if (typeof original !== "function") return;
    window.Element.prototype[nome] = function (...args) {
      const atributo = String(args[0] ?? "").toLowerCase();
      const interessa = ehCampo(this) && atributos.includes(atributo);
      const de = interessa ? String(this.getAttribute(atributo)) : null;
      const devolvido = original.apply(this, args);
      if (interessa) {
        const para = String(this.getAttribute(atributo));
        if (de !== para) {
          anotar({
            via: `${nome}("${atributo}", …)`,
            prop: atributo,
            de,
            para,
            alvo: descrever(this),
            naArvore: naArvore(this),
            canario: canarios.has(this),
            marcaDoCanario: canarios.has(this) ? this.getAttribute("data-vigia-canario") : null,
            emMs: Date.now() - inicio,
            pilha: pilha(),
          });
        }
      }
      return devolvido;
    };
    redes.push(nome);
  };
  for (const nome of ["setAttribute", "removeAttribute", "toggleAttribute"]) embrulhar(nome);

  // 3ª rede — a mutação, sem depender de os embrulhos acima sobreviverem.
  let observando = false;
  const observar = () => {
    if (observando) return;
    const raiz = window.document.documentElement;
    if (raiz === null || raiz === undefined) return;
    const observador = new window.MutationObserver((registros) => {
      for (const r of registros) {
        if (r.type !== "attributes") continue;
        const alvo = r.target;
        if (!ehCampo(alvo)) continue;
        const prop = String(r.attributeName ?? "").toLowerCase();
        if (!atributos.includes(prop)) continue;
        const de = String(r.oldValue);
        const para = String(alvo.getAttribute(prop));
        if (de === para) continue;
        anotar({
          via: "MutationObserver (atributo)",
          prop,
          de,
          para,
          alvo: descrever(alvo),
          naArvore: naArvore(alvo),
          canario: canarios.has(alvo),
          marcaDoCanario: canarios.has(alvo) ? alvo.getAttribute("data-vigia-canario") : null,
          emMs: Date.now() - inicio,
          pilha: "(o observador vê a mudança, não quem a fez)",
        });
      }
    });
    observador.observe(raiz, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: atributos,
    });
    observando = true;
    redes.push("MutationObserver");
  };
  observar();
  window.addEventListener("DOMContentLoaded", observar);

  /*
   * ═══════════════════════════════════════════════════ O CANÁRIO, rodada 15 ═
   * A pergunta que faltava: **o canal ainda reporta?**
   *
   * Toda medida, antes de julgar, manda o vigia mexer DE PROPÓSITO no contrato
   * de um `<input>` descartável JÁ INSERIDO na árvore, e exige que essa
   * mudança apareça nas três cópias, pelas SEIS redes. Canário ausente não
   * quer dizer "a página está limpa": quer dizer que a testemunha morreu — e
   * a medida reprova dizendo isso, com essas palavras.
   *
   * É o canário que fecha a sabotagem "desinstalar o vigia": restaurar o
   * setter original do protótipo deixa a mutação de verdade invisível, e
   * deixa o canário sem a via `setter do protótipo .type` — reprovação com
   * nome, em vez de verde por ausência.
   *
   * O elemento é reconhecido por IDENTIDADE (um `WeakSet` deste fechamento),
   * não por atributo: a página pode pôr `data-vigia-canario` em qualquer
   * campo e não ganha isenção nenhuma. E `abrirCanario` ser alcançável pela
   * página não a ajuda — canário falso não esconde mudança de verdade, porque
   * a mudança de verdade está na memória do fechamento e no Node.
   */
  const abrirCanario = (marca) => {
    const doc = window.document;
    const el = criarElemento.call(doc, "input");
    /*
     * Um canário é um nó NOVO, que não é de ninguém. Se `createElement` foi
     * sequestrado e devolveu um campo REAL da página, ele já está na árvore —
     * e adotá-lo aqui o isentaria da régua. Recusar é a resposta certa: a
     * medida reprova dizendo que o canal está quebrado, que é a verdade.
     */
    if (
      el === null ||
      typeof el !== "object" ||
      el.tagName !== "INPUT" ||
      naArvore(el) ||
      canarios.has(el)
    ) {
      return Promise.resolve(null);
    }
    el.setAttribute("data-vigia-canario", String(marca));
    canarios.add(el);
    // NA ÁRVORE antes de qualquer mutação: um canário fora da árvore provaria
    // menos do que o que a régua cobra (`naArvore === true`).
    inserirNo.call(doc.body ?? doc.documentElement, el);
    // Uma mutação por rede, na ordem em que elas existem.
    el.type = "number"; // 1ª rede (setter .type) + 3ª (MutationObserver)
    el.inputMode = "decimal"; // 1ª rede (setter .inputMode)
    el.setAttribute("type", "text"); // 2ª rede
    el.removeAttribute("inputmode"); // 2ª rede
    el.toggleAttribute("inputmode"); // 2ª rede
    return new Promise((pronto) => {
      /*
       * O `MutationObserver` entrega em MICROTAREFA. Três voltas bastam, e
       * nenhuma delas usa `setTimeout` de propósito: na sentinela do relógio
       * o temporizador está sob controle da guarda e não dispararia aqui.
       */
      void Promise.resolve()
        .then(() => undefined)
        .then(() => undefined)
        .then(() => {
          try {
            retirarNo.call(el);
          } catch {
            /* já saiu da árvore */
          }
          // A isenção dura o VOO, não a sessão: quem guardar a referência
          // deste nó e o enfiar na página depois não herda absolvição.
          canarios.delete(el);
          pronto(marca);
        });
    });
  };

  const api = {
    instalado: true,
    redes,
    /** A cópia AUTORITATIVA — do fechamento, não de `window`. */
    mudancas: () => naMemoria.slice(),
    /** O que o depósito tem agora; `null` quando o acesso lança. */
    noDeposito: lerDeposito,
    depositoQuebrado: () => depositoQuebrado,
    carga: () => carga,
    vidaMs: () => Date.now() - inicio,
    abrirCanario,
  };
  Object.freeze(api);
  try {
    /*
     * NÃO gravável e NÃO configurável. Era uma atribuição simples, e por isso
     * `window.__vigiaP6 = { instalado: true, mudancas: () => [] }` calava o
     * vigia inteiro sem tocar no `sessionStorage` (sabotagem própria nº 1
     * desta rodada, medida).
     */
    Object.defineProperty(window, "__vigiaP6", {
      value: api,
      writable: false,
      configurable: false,
      enumerable: false,
    });
  } catch {
    /* alguém chegou antes neste realm; o canal do Node continua valendo */
  }
}

/**
 * O que o vigia daquela página anotou — as TRÊS cópias, lidas de dentro do
 * Chromium: a memória do fechamento (autoritativa), o depósito
 * (`sessionStorage`, que é só carregador entre navegações) e o estado dele.
 * A quarta cópia, a do Node, não passa por aqui de propósito: ela chega pelo
 * `exposeBinding` e é justamente a que a página não pode tocar.
 */
async function lerVigia(pagina) {
  return await pagina.evaluate(() => {
    const v = window.__vigiaP6;
    if (v === undefined || v === null) {
      return {
        instalado: false,
        redes: [],
        mudancas: [],
        noDeposito: [],
        depositoQuebrado: "o vigia não está instalado nesta página",
        carga: "",
        vidaMs: 0,
      };
    }
    return {
      instalado: v.instalado === true,
      redes: v.redes,
      mudancas: v.mudancas(),
      noDeposito: v.noDeposito(),
      depositoQuebrado: v.depositoQuebrado(),
      carga: v.carga(),
      vidaMs: v.vidaMs(),
    };
  });
}

/** `lerVigia` que nunca estoura: um estouro vira "sem vigia", que é reprovação. */
async function lerVigiaSemQuebrar(pagina) {
  try {
    return await lerVigia(pagina);
  } catch (erro) {
    return {
      instalado: false,
      redes: [],
      mudancas: [],
      noDeposito: [],
      depositoQuebrado: `a leitura do vigia estourou: ${
        erro instanceof Error ? erro.message.split("\n")[0] : String(erro)
      }`,
      carga: "",
      vidaMs: 0,
    };
  }
}

/**
 * Manda o vigia soltar um canário nesta página e devolve a marca dele.
 * `null` quando não foi possível — e não poder soltar canário é reprovação.
 */
async function soltarCanario(pagina) {
  const marca = `canario-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const voou = await pagina.evaluate(async (m) => {
      const v = window.__vigiaP6;
      if (v === undefined || v === null || typeof v.abrirCanario !== "function") return false;
      // `null` = o vigia RECUSOU soltar o canário (o que voltou de
      // `createElement` não era um nó novo e fora da árvore). Recusa não é
      // silêncio: vira "O CANAL ESTÁ QUEBRADO" na medida.
      return (await v.abrirCanario(m)) !== null;
    }, marca);
    return voou === true ? marca : null;
  } catch {
    return null;
  }
}

/** A rota e quantos campos a página tem AGORA — alimenta o piso das sentinelas. */
async function estadoDaPagina(pagina) {
  try {
    return await pagina.evaluate(() => ({
      rota: window.location.pathname,
      campos: document.querySelectorAll("input, textarea").length,
    }));
  } catch {
    return null;
  }
}

/**
 * O veredito do vigia ao fim de uma medida: **o registro tem de estar vazio.**
 *
 * Vigia ausente é reprovação, não dispensa — uma página onde o script de
 * inicialização não correu é exatamente a página onde a mutação passaria sem
 * testemunha. Lista de páginas vazia também reprova: é a forma clássica de uma
 * checagem dizer VERDE sem ter olhado nada.
 */
/**
 * A régua do registro, medida e não adivinhada.
 *
 * O vigia anota TODA mudança. Rodando a guarda limpa, ele anotou sete — todas
 * com `naArvore=false`, todas `inputmode: null → "decimal"`, todas com
 * `setValueForAttribute` do `react-dom` na pilha: é o React MONTANDO uma
 * sub-árvore nova (o campo "Desconto", que só nasce quando o tipo de relação
 * vira "sinergia"). Um elemento que ainda não está na árvore não tem contrato
 * com o operador: ninguém o vê, ninguém digita nele.
 *
 * Então a régua é esta, em duas partes:
 *
 *  1. **mudança em elemento que JÁ está na árvore reprova, sempre.** É onde
 *     toda a família do CRÍTICO mora: a `ref` do React roda depois da
 *     inserção, e `setTimeout` mais ainda. As sete formas que o coordenador
 *     mandou testar caem todas aqui.
 *  2. **mudança que RESULTA em `type="number"` reprova mesmo antes da
 *     inserção.** É o defeito nomeado desta peça, e não há versão legítima
 *     dele nesta página — inclusive na forma "mexo no nó e só depois insiro".
 *
 * O resto é anotado e sai impresso na contagem de "montagem", para nunca ficar
 * escondido — e o EFEITO dele é medido pelas medidas A, B e C2, que leem o DOM
 * vivo depois de a árvore estar de pé.
 */
function foraDaRegua(m) {
  // O canário é mudança que a GUARDA pediu, para provar que o canal reporta.
  // Ele é reconhecido por identidade do elemento (WeakSet do fechamento do
  // vigia), nunca pelo atributo — marcar um campo de verdade não isenta nada.
  if (m.canario === true) return false;
  return m.naArvore === true || (m.prop === "type" && m.para === "number");
}

/** A chave de uma anotação — é por ela que as quatro cópias se comparam. */
function chaveDaMudanca(m) {
  return `${String(m.carga)}:${String(m.seq)}`;
}

/** Junta as cópias sem repetir a mesma anotação. */
function unirMudancas(listas) {
  const porChave = new Map();
  for (const lista of listas) {
    for (const m of lista) {
      if (!porChave.has(chaveDaMudanca(m))) porChave.set(chaveDaMudanca(m), m);
    }
  }
  return [...porChave.values()];
}

/**
 * As SEIS redes que o canário tem de acender. Escrita à mão, e não derivada do
 * que o vigia disser que instalou: é ela que reprova a sabotagem "restaura o
 * setter original do protótipo", em que o vigia continua dizendo
 * `instalado=true` e a rede que importa já não vê nada.
 */
const REDES_QUE_O_CANARIO_EXIGE = [
  "setter do protótipo .type",
  "setter do protótipo .inputMode",
  'setAttribute("type"',
  'removeAttribute("inputmode"',
  'toggleAttribute("inputmode"',
  "MutationObserver (atributo)",
];

/**
 * O veredito de uma página: o canal ainda reporta, as quatro cópias
 * concordam, o depósito está íntegro, e nada mexeu no contrato.
 *
 * `alvo` é o que `abrir()` devolve — precisa do `registroFora`, que é a cópia
 * do Node. Passar só a página deixaria de fora justamente a testemunha que a
 * página não alcança.
 */
async function auditarPagina(alvo) {
  /*
   * 0. O ESTADO ANTES DO CANÁRIO. Tem de ser lido aqui, e não depois: a
   *    própria anotação do canário reescreve o depósito inteiro a partir da
   *    memória, e isso RESSINCRONIZARIA as cópias — a divergência que o
   *    `setInterval` do crítico provoca (gravar `"[]"` na chave) desapareceria
   *    antes de ser vista. Medido: com a leitura só depois, a sabotagem que
   *    apaga o registro sem mexer em contrato nenhum passava VERDE.
   */
  const antesDoCanario = await lerVigiaSemQuebrar(alvo.pagina);
  const foraAntes = alvo.registroFora.slice();
  // 1. O canário: se o canal morreu, tudo o que vem depois é ruído.
  const marca = await soltarCanario(alvo.pagina);
  const estado = await estadoDaPagina(alvo.pagina);
  if (estado !== null) {
    registrarRota(estado.rota);
    registrarCampos(estado.rota, estado.campos);
  }
  const lido = await lerVigiaSemQuebrar(alvo.pagina);
  const fora = alvo.registroFora.slice();
  const noDeposito = Array.isArray(lido.noDeposito) ? lido.noDeposito : [];
  const depositoIlegivel = !Array.isArray(lido.noDeposito);
  const todas = unirMudancas([
    fora,
    lido.mudancas,
    noDeposito,
    foraAntes,
    antesDoCanario.mudancas,
  ]);

  // 2. O canário apareceu, pelas SEIS redes, nas TRÊS cópias?
  const doCanario = todas.filter((m) => m.canario === true && m.marcaDoCanario === marca);
  const redesFaltando = REDES_QUE_O_CANARIO_EXIGE.filter(
    (rede) => !doCanario.some((m) => String(m.via).startsWith(rede)),
  );
  const chavesDoCanario = new Set(doCanario.map(chaveDaMudanca));
  const canarioEm = (lista) => {
    const chaves = new Set(lista.map(chaveDaMudanca));
    return [...chavesDoCanario].filter((c) => chaves.has(c)).length;
  };
  const canarioCompleto =
    marca !== null && redesFaltando.length === 0 && chavesDoCanario.size > 0;
  const canarioNasTres =
    canarioCompleto &&
    canarioEm(fora) === chavesDoCanario.size &&
    canarioEm(lido.mudancas) === chavesDoCanario.size &&
    canarioEm(noDeposito) === chavesDoCanario.size;

  // 3. As cópias divergem? Só o que nasceu NESTE carregamento é comparável —
  //    o Node e o depósito guardam também o que veio de documentos anteriores
  //    do mesmo contexto, e a memória do fechamento nasce do depósito.
  // A comparação é sobre o estado de ANTES do canário, pelo motivo do passo 0.
  const desteDoc = (lista) =>
    new Set(lista.filter((m) => m.carga === antesDoCanario.carga).map(chaveDaMudanca));
  const naMemoria = desteDoc(antesDoCanario.mudancas);
  const noNode = desteDoc(foraAntes);
  const noDepositoAgora = desteDoc(
    Array.isArray(antesDoCanario.noDeposito) ? antesDoCanario.noDeposito : [],
  );
  const divergencias = [];
  for (const c of noNode) {
    if (!naMemoria.has(c)) divergencias.push(`${c} não está na memória do vigia`);
    if (!noDepositoAgora.has(c)) divergencias.push(`${c} não está no depósito`);
  }
  for (const c of naMemoria) {
    if (!noNode.has(c)) divergencias.push(`${c} não chegou ao Node`);
  }
  for (const c of noDepositoAgora) {
    if (!noNode.has(c)) divergencias.push(`${c} apareceu no depósito sem passar pelo vigia`);
  }

  const culpadas = todas.filter(foraDaRegua);
  return {
    marca,
    lido,
    fora,
    todas,
    culpadas,
    naMontagem: todas.length - culpadas.length - doCanario.length,
    redesFaltando,
    canarioCompleto,
    canarioNasTres,
    divergencias: [...new Set(divergencias)],
    depositoQuebrado:
      typeof lido.depositoQuebrado === "string" && lido.depositoQuebrado.length > 0
        ? lido.depositoQuebrado
        : typeof antesDoCanario.depositoQuebrado === "string" &&
            antesDoCanario.depositoQuebrado.length > 0
          ? antesDoCanario.depositoQuebrado
          : depositoIlegivel
            ? "o depósito não devolveu uma lista"
            : null,
  };
}

/**
 * O que está ERRADO num relato, em frases que dizem a coisa certa.
 *
 * A diferença que mais importa está aqui: canário ausente NÃO se traduz por
 * "a página está limpa", e sim por "o canal está quebrado". Era a mentira do
 * CRÍTICO #2 — a guarda imprimia `0 mudança(s) fora da régua` com oito
 * mudanças anotadas, e fechava a investigação.
 */
function problemasDoRelato(relato) {
  const problemas = [];
  if (!relato.lido.instalado) problemas.push("a página está SEM vigia instalado");
  if (!relato.canarioCompleto) {
    problemas.push(
      relato.marca === null
        ? "O CANAL ESTÁ QUEBRADO: não foi possível soltar o canário — isto NÃO quer dizer que a página está limpa"
        : `O CANAL ESTÁ QUEBRADO: o canário não apareceu pelas redes ${relato.redesFaltando.join(
            ", ",
          )} — a testemunha morreu, a página não foi absolvida`,
    );
  } else if (!relato.canarioNasTres) {
    problemas.push(
      "o canário não está nas TRÊS cópias (memória do vigia, depósito, Node) — alguém mexeu no registro",
    );
  }
  if (relato.depositoQuebrado !== null) {
    problemas.push(`DEPÓSITO QUEBRADO: ${relato.depositoQuebrado}`);
  }
  if (relato.divergencias.length > 0) {
    problemas.push(`as cópias do registro DIVERGEM: ${relato.divergencias.slice(0, 4).join(" · ")}`);
  }
  if (relato.culpadas.length > 0) {
    problemas.push(
      `${String(relato.culpadas.length)} mudança(s) fora da régua — ${relato.culpadas
        .map(descreverMudanca)
        .join(" · ")}`,
    );
  }
  return problemas;
}

/** O relato em uma linha, com o que ele PROVOU (e não só com o que não achou). */
function resumoDoRelato(relato) {
  return `vigia instalado=${String(relato.lido.instalado)} · redes: ${
    relato.lido.redes.join(", ") || "(nenhuma)"
  } · canário ${relato.canarioNasTres ? "conferido nas 3 cópias" : "NÃO conferido"} pelas ${String(
    REDES_QUE_O_CANARIO_EXIGE.length,
  )} redes · ${String(relato.culpadas.length)} mudança(s) fora da régua, ${String(
    relato.naMontagem,
  )} na montagem da árvore (React, antes de inserir)`;
}

async function conferirVigia(nome, alvos) {
  const relatos = [];
  for (const alvo of alvos) relatos.push(await auditarPagina(alvo));
  const problemas = relatos.flatMap(problemasDoRelato);
  if (relatos.length === 0) problemas.push("nenhuma página lida — checagem que não mediu");
  conferir(
    `${nome} · nada mexeu no contrato dos campos, e o canal do vigia PROVOU que ainda reporta`,
    problemas.length === 0,
    `${String(relatos.length)} página(s) lida(s) · ${relatos.map(resumoDoRelato).join(" || ")}${
      problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`
    }`,
  );
}

/** Uma mudança anotada, em uma linha legível. */
function descreverMudanca(m) {
  return `${m.alvo} .${m.prop}: ${JSON.stringify(m.de)} → ${JSON.stringify(m.para)} via ${
    m.via
  } aos ${String(m.emMs)}ms (na árvore=${String(m.naArvore)}) [${m.pilha}]`;
}

/**
 * Todo campo da página, como o NAVEGADOR o vê — com o nome acessível que o
 * operador lê. `type` sai da propriedade viva do elemento (`el.type`), que é o
 * que governa o comportamento, e não do atributo escrito no JSX.
 */
const LER_CAMPOS = () => {
  const nomeDe = (el) => {
    const rotulo = el.closest("label");
    if (rotulo) return (rotulo.innerText || "").split("\n")[0].trim();
    const porId = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
    if (porId) return (porId.innerText || "").trim();
    return el.getAttribute("aria-label") ?? "";
  };
  return [...document.querySelectorAll("input, textarea")].map((el) => ({
    tag: el.tagName.toLowerCase(),
    // `el.type` é a propriedade viva: é ela que decide se a caixa esconde o
    // que o operador digitou (`badInput`), e é ela que uma `ref` muda.
    type: el.type,
    atributoType: el.getAttribute("type"),
    inputMode: el.inputMode || el.getAttribute("inputmode") || "",
    valor: el.value,
    nome: nomeDe(el),
  }));
};

// ════════════════════════════════════════════════════════════════════════════
// AS SENTINELAS — UMA POR ROTA VISITADA, E O RELÓGIO DE MENTIRA EM CADA UMA
//
// [CRÍTICO #1, rodada 15] Eram DUAS, as duas em `/tarefa/task-docs`, as duas
// no estado inicial da rota. O cabeçalho afirmava "qualquer atraso até 30 min"
// e a medida K imprimia "atraso ATÉ ISSO está no alcance desta guarda": era
// verdade para uma rota, num estado só. O crítico passou com o setter do
// protótipo aos 60 s e um `if` de rota (`task-build`), cinco portões verdes, e
// no Chromium o `3` do operador saindo do banco.
//
// Agora são DUAS POR ROTA — uma de tempo real e uma com o relógio da página
// sob controle da guarda — para cada rota da lista `ROTAS_COM_SENTINELA`, e
// cada uma revela os estados que só existem depois de um clique (o campo
// "Desconto" da sinergia). A medida L confere a lista contra as rotas que a
// guarda de fato visitou, e o número de campos de cada sentinela contra o
// maior que a guarda já viu naquela rota: rota sem sentinela, ou sentinela com
// menos estado do que a medida viu, é reprovação.
//
// A lista é escrita À MÃO de propósito (mesma lei de `MEDIDAS_EXIGIDAS`):
// acrescentar rota ao trabalho da guarda passa a exigir acrescentar sentinela
// no diff.
// ════════════════════════════════════════════════════════════════════════════
/*
 * ══════════════════════════════════════════════════════ MÉDIO #4, rodada 18 ═
 * A GUARDA REPROVAVA SOZINHA, E O ESTRAGO DE UMA MEDIDA DERRUBAVA OUTRAS DUAS.
 *
 * A primeira corrida do crítico, sem sabotagem nenhuma, no head limpo, deu
 * `exit 1` com TRÊS falhas:
 *
 *   FALHA E  — a medida ESTOUROU: locator.click: Timeout 30000ms exceeded
 *   FALHA E2 — não foi possível começar a exclusão
 *   FALHA M  — os botões "Salvar átomos"/"Limpar átomos" NÃO existem
 *
 * Não eram três defeitos: era UM. E estourou num clique (primeira compilação,
 * máquina carregada) **depois de já ter limpado os átomos**; e "Limpar átomos"
 * só existe quando a tarefa tem átomos declarados (`atomos-form.tsx`), então
 * E2 e M encontraram uma tarefa sem o que medir. Duas das três falhas eram
 * mentirosas, e nenhuma delas dizia isso.
 *
 * A disciplina de precondição própria que a rodada 17 escreveu valia **só para
 * a família P**. Aqui ela passa a valer para A–M: cada medida ESTABELECE e
 * CONFERE o estado de que precisa, e reprova ali se não conseguir — em vez de
 * medir um estado que outra medida deixou e chamar o resultado de defeito.
 *
 * O registro (`PRECONDICOES_CONFERIDAS`) existe porque a lista de medidas com
 * precondição é escrita à mão na medida `Q0`: apagar a precondição de uma
 * medida passa a exigir apagá-la de lá também, no mesmo diff. Sem isso, seria
 * a 2ª forma viciada outra vez — some a checagem, some o que a cobrava.
 */
const PRECONDICOES_CONFERIDAS = new Set();

/**
 * Estabelece e CONFERE a precondição de uma medida A–M.
 * Devolve `null` quando está tudo no ponto, e a frase da reprovação quando não.
 */
async function precondicaoDaMedida(nome, pagina, config) {
  PRECONDICOES_CONFERIDAS.add(nome);
  const t0 = Date.now();
  let falha = null;
  const doErro = (erro) => (erro instanceof Error ? erro.message.split("\n")[0] : String(erro));
  if (typeof config.estabelecer === "function") {
    try {
      await config.estabelecer(pagina);
    } catch (erro) {
      falha = `não consegui ESTABELECER a precondição: ${doErro(erro)}`;
    }
  }
  let obtido = "(a leitura da precondição não chegou a acontecer)";
  if (falha === null) {
    try {
      obtido = await config.ler(pagina);
    } catch (erro) {
      falha = `não consegui LER a precondição: ${doErro(erro)}`;
    }
  }
  if (falha === null && obtido !== config.esperado) {
    falha = `esperava ${JSON.stringify(config.esperado)} e achei ${JSON.stringify(obtido)}`;
  }
  if (falha === null) return null;
  return `a PRECONDIÇÃO desta medida não está no ponto declarado — ${
    config.descricao
  }: ${falha} (${String(
    Math.round((Date.now() - t0) / 1000),
  )}s). A medida NÃO se adapta ao que outra deixou: reprova aqui, sem medir, para não relatar como defeito do produto o estrago de uma medida anterior.`;
}

/** O score de assimetria como o operador o lê, ou "(sem score)". */
async function scoreNaTela(pagina) {
  return await pagina.evaluate(
    () => document.body.innerText.match(/assimetria \(A\) = \d+/)?.[0] ?? "(sem score)",
  );
}

/** Garante que a tarefa tem átomos declarados (é o que faz "Limpar" existir). */
async function garantirAtomosDeclarados(pagina) {
  if ((await scoreNaTela(pagina)) !== "(sem score)") return;
  await declararTrio(pagina);
  await recarregar(pagina);
}

/** Garante que a duração da tarefa aberta é exatamente este valor. */
async function garantirDuracao(pagina, valor) {
  if ((await duracaoNaCaixa(pagina)) === valor) return;
  await salvarDuracao(pagina, valor);
  await recarregar(pagina);
}

/** Garante que o status marcado é a PRIMEIRA opção do grupo. */
async function garantirStatusNaPrimeiraOpcao(pagina) {
  const opcoes = await opcoesDoGrupo(pagina, "Status da tarefa");
  const primeira = opcoes[0];
  if (primeira === undefined) return;
  if ((await marcadoNoGrupo(pagina, "Status da tarefa")) === primeira) return;
  await escolherNoGrupo(pagina, "Status da tarefa", primeira);
  await anunciou(pagina, /Status atualizado para/);
  await recarregar(pagina);
}

/** Garante que a tarefa aberta não tem mãe. */
async function garantirSemMae(pagina) {
  const select = pagina.locator('select[aria-label="Tarefa mãe"]').first();
  if ((await select.count()) !== 1) return;
  if ((await select.inputValue()) === "") return;
  await select.selectOption("");
  await anunciou(pagina, /Tarefa mãe (atualizada|removida)\./);
  await recarregar(pagina);
}

/** Garante que a tarefa aberta não está marcada como meta. */
async function garantirSemMeta(pagina) {
  const botao = pagina.locator("button[aria-pressed]").first();
  if ((await botao.count()) !== 1) return;
  if ((await botao.getAttribute("aria-pressed")) !== "true") return;
  await botao.click();
  await anunciou(pagina, /(Marcada como meta|Meta removida)\./);
  await recarregar(pagina);
}

/** Quantos campos a página mostra agora — leitura da precondição de A+B e F. */
async function quantosCampos(pagina) {
  return await pagina.evaluate(() => document.querySelectorAll("input, textarea").length);
}

/**
 * Quantos botões "excluir" desta página confirmam apagar AQUELE assunto.
 * É a leitura de precondição de E3 e E4: sem um item para apagar, aquelas
 * medidas não têm o que medir, e isso é reprovação — não dispensa.
 */
async function quantosParaExcluir(pagina, assunto) {
  return await pagina.evaluate((alvo) => {
    const rotulo = alvo === "nota" ? "nota" : "relação";
    return [...document.querySelectorAll("li")].filter((li) => {
      const texto = (li.innerText || "").toLowerCase();
      const temBotao = [...li.querySelectorAll("button")].some((b) =>
        /excluir/i.test(b.textContent ?? ""),
      );
      if (!temBotao) return false;
      // Uma relação traz sempre o rótulo do tipo e uma seta; a nota, não.
      const ehRelacao = /→|←/.test(li.innerText || "");
      return rotulo === "relação" ? ehRelacao : !ehRelacao && texto.length > 0;
    }).length;
  }, assunto);
}

const ROTAS_COM_SENTINELA = ["/tarefa/task-docs", "/tarefa/task-build", "/tarefa/task-setup"];

/*
 * [MÉDIO #4, rodada 18] O AQUECIMENTO. A primeira compilação de cada rota do
 * `next dev` acontece AQUI, fora de qualquer medida — era ela que aparecia
 * dentro da medida E como `locator.click: Timeout 30000ms exceeded`, e a
 * medida não tinha como distinguir "o produto travou" de "a máquina está
 * compilando". A rota da fotografia entra junto, pelo mesmo motivo.
 */
for (const rota of [...ROTAS_COM_SENTINELA, "/api/tarefa/estado"]) {
  const t0 = Date.now();
  try {
    await comTeto(
      fetch(`${BASE}${rota}`, { signal: globalThis.AbortSignal.timeout(TETO_DE_ACAO_MS) }),
      TETO_DE_ACAO_MS + 5000,
      `o aquecimento de ${rota}`,
    );
    console.log(
      "%s",
      `[${carimbo()}] aquecida ${rota} em ${String(Math.round((Date.now() - t0) / 1000))}s`,
    );
  } catch {
    // Aquecer é otimização, não medida: se falhar, a medida que precisar da
    // rota reprova com o próprio nome, que é onde a falha tem de aparecer.
  }
}

const SENTINELAS = [];
for (const rota of ROTAS_COM_SENTINELA) {
  for (const comRelogioDeMentira of [false, true]) {
    const aberta = await abrir(rota, 1280, 1200, comRelogioDeMentira);
    const revelados = await revelarEstadosOcultos(aberta.pagina);
    // [ALTO #3, rodada 18] a sentinela DIGITA antes de exercer: é a aba do
    // operador que escreveu e saiu para atender o telefone. Nada é salvo.
    const preenchidos = await preencherCampos(aberta.pagina);
    // [ALTO #2, rodada 16] revelar não basta: a sentinela EXERCE cada campo.
    const exercidos = await exercitarCampos(aberta.pagina);
    await assentar(aberta.pagina);
    const camposAoNascer = await aberta.pagina.evaluate(LER_CAMPOS);
    SENTINELAS.push({
      ...aberta,
      comRelogioDeMentira,
      revelados,
      exercidos,
      preenchidos,
      camposAoNascer,
      // [ALTO #1, rodada 19] o que ESTA sentinela vai mandar gravar no fim da
      // vida — um valor por sentinela, nenhum igual ao de outra.
      escritaPedida: DURACOES_DA_ESCRITA_DA_SENTINELA[SENTINELAS.length],
      nascimento: Date.now(),
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// A · TODO CAMPO QUE ACEITA NÚMERO É DE TEXTO, COM TECLADO DECIMAL
// ════════════════════════════════════════════════════════════════════════════
await medir("A+B", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-build");
  // O "Desconto" da sinergia só existe com o tipo de relação em "sinergia" —
  // sem este clique a medida veria 2 campos e aprovaria o terceiro por
  // ausência, que é exatamente o vício que esta guarda existe para não ter.
  await pagina.getByRole("radio", { name: "sinergia" }).click();
  await pagina.waitForSelector('input[inputmode="decimal"]');
  await assentar(pagina);
  // [MÉDIO #4, rodada 18] a precondição PRÓPRIA desta medida.
  const faltaPrecondicao = await precondicaoDaMedida("A+B", pagina, {
    descricao: 'a rota mostra os campos da tarefa com o "Desconto" da sinergia já revelado',
    ler: async (alvo) => String(await quantosCampos(alvo)),
    esperado: String(PISO_DE_CAMPOS_POR_ROTA),
  });
  if (faltaPrecondicao !== null) {
    conferir("A · todo campo que aceita número é type=text + inputMode=decimal", false, faltaPrecondicao);
    conferir("B · nenhum campo da página é type=number em tempo de execução", false, faltaPrecondicao);
    await conferirVigia("V-AB", [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }
  const campos = await pagina.evaluate(LER_CAMPOS);

  // Os campos que ACEITAM NÚMERO, pelo nome que o operador lê — derivado da
  // tela, não de uma lista de seletores.
  const numericosPeloNome = campos.filter((c) => /Duração|Desconto/.test(c.nome));
  const numericosPeloTeclado = campos.filter((c) => c.inputMode === "decimal");
  const foraDaRegua = numericosPeloNome.filter(
    (c) => c.type !== "text" || c.inputMode !== "decimal",
  );
  conferir(
    "A · todo campo que aceita número é type=text + inputMode=decimal",
    numericosPeloNome.length === 3 &&
      numericosPeloTeclado.length === 3 &&
      foraDaRegua.length === 0,
    `${String(numericosPeloNome.length)}/3 campos de número na tela, ${String(
      numericosPeloTeclado.length,
    )} com teclado decimal, ${String(foraDaRegua.length)} fora da régua — ${campos
      .filter((c) => /Duração|Desconto/.test(c.nome))
      .map((c) => `"${c.nome.slice(0, 22)}": type=${c.type} inputMode=${c.inputMode || "(vazio)"}`)
      .join(" · ")}`,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // B · NENHUM CAMPO DA PÁGINA É type="number" EM TEMPO DE EXECUÇÃO
  //     (venha esse atributo de onde vier: JSX, espalhamento, `ref`, ajudante
  //      em `lib/`, `Object.assign`, nó de atributo, pacote de fora)
  // ══════════════════════════════════════════════════════════════════════════
  const numericos = campos.filter((c) => c.type === "number" || c.atributoType === "number");
  conferir(
    "B · nenhum campo da página é type=number em tempo de execução",
    campos.length >= 6 && numericos.length === 0,
    `${String(campos.length)} campos medidos no DOM (mínimo 6), ${String(
      numericos.length,
    )} com type=number${
      numericos.length === 0
        ? ""
        : ` — ${numericos.map((c) => `"${c.nome.slice(0, 30)}"`).join(", ")}`
    }`,
  );
  await conferirVigia("V-AB", [{ pagina, registroFora }]);
  await contexto.close();
});

// ════════════════════════════════════════════════════════════════════════════
// C · `2e` NA DURAÇÃO: A CAIXA ENTREGA O QUE MOSTRA, A RECUSA É EM PORTUGUÊS,
//     E O VALOR GRAVADO NÃO MUDA
//
// É a medida que reproduz o CRÍTICO das rodadas 10/11/13 inteiro. Com um
// `type="number"` em `badInput`, a caixa MOSTRA `2e` e `el.value` devolve `""`:
// o formulário conclui "o operador apagou a duração", a tela diz "Duração
// removida." e o servidor apaga. Aqui os três sintomas são medidos de uma vez.
// ════════════════════════════════════════════════════════════════════════════
/** O valor de duração de que a medida C precisa — é ele que o `2e` tenta apagar. */
const DURACAO_DA_MEDIDA_C = "2";

await medir("C", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-docs");
  // [MÉDIO #4, rodada 18] a precondição PRÓPRIA: a duração gravada é `2`. Ela
  // era ASSUMIDA (o veredito exigia `antes === "2"`), e qualquer medida que
  // tivesse mexido nesta tarefa derrubava C com cara de defeito do produto.
  const faltaPrecondicao = await precondicaoDaMedida("C", pagina, {
    descricao: "a duração gravada desta tarefa é o valor que a medida vai tentar estragar",
    estabelecer: async (alvo) => {
      await garantirDuracao(alvo, DURACAO_DA_MEDIDA_C);
    },
    ler: duracaoNaCaixa,
    esperado: DURACAO_DA_MEDIDA_C,
  });
  if (faltaPrecondicao !== null) {
    conferir(
      "C · `2e` na duração: a caixa entrega `2e`, a recusa é em português e o dado não muda",
      false,
      faltaPrecondicao,
    );
    conferir(
      "C2 · o contrato do campo NO INSTANTE em que o operador digita e em que manda salvar",
      false,
      faltaPrecondicao,
    );
    await conferirVigia("V-C", [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }
  const campo = campoPorNome(pagina, /^Duração \(dias, p80/).first();
  const achou = (await campo.count()) === 1;
  let antes = null;
  let naCaixa = null;
  let recusa = null;
  let depoisDoF5 = null;
  /*
   * [CRÍTICO, rodada 14] O contrato do campo NO INSTANTE EM QUE O HUMANO AGE.
   * A medida A pergunta o que o campo é depois de carregar; esta pergunta o que
   * ele é no milissegundo em que o operador digita e no milissegundo em que ele
   * manda salvar — os dois momentos em que o contrato decide o destino do dado.
   * É barato e não depende do vigia: é a mesma pergunta, feita na hora certa.
   */
  const contratoDe = async (alvo) =>
    await alvo.evaluate((el) => ({ type: el.type, inputMode: el.inputMode }));
  let contratoAoDigitar = null;
  let contratoAoSalvar = null;
  /** As páginas desta medida — a segunda nasce no meio dela. */
  const paginasDaMedida = [{ pagina, registroFora }];
  if (achou) {
    antes = await campo.inputValue();
    await campo.click();
    await pagina.keyboard.press("End");
    contratoAoDigitar = await contratoDe(campo);
    await pagina.keyboard.type("e");
    await assentar(pagina);
    // O que o PROGRAMA recebe do campo — é aqui que o `type="number"` mente.
    naCaixa = await campo.inputValue();
    contratoAoSalvar = await contratoDe(campo);
    await pagina.getByRole("button", { name: "Salvar duração" }).click();
    // A recusa em português, no campo (role=alert), ou o anúncio de sucesso —
    // o que vier primeiro é o veredito.
    await pagina
      .locator('[role="alert"], [role="status"]')
      .filter({ hasText: /./ })
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => undefined);
    await pagina.waitForTimeout(1500);
    recusa = await pagina.evaluate(() =>
      [...document.querySelectorAll('[role="alert"], [role="status"]')]
        .map((el) => (el.innerText || "").trim())
        .filter(Boolean)
        .join(" | "),
    );
    // O valor GRAVADO se lê num contexto NOVO, não neste. Um `reload` aqui
    // leria o que o rascunho do `sessionStorage` devolvesse à caixa, e a
    // pergunta desta medida é o que o SERVIDOR guardou.
    const outro = await abrir("/tarefa/task-docs");
    paginasDaMedida.push({ pagina: outro.pagina, registroFora: outro.registroFora });
    depoisDoF5 = await campoPorNome(outro.pagina, /^Duração \(dias, p80/)
      .first()
      .inputValue();
    await conferirVigia("V-C", paginasDaMedida);
    await outro.contexto.close();
  } else {
    await conferirVigia("V-C", paginasDaMedida);
  }
  const recusouEmPortugues =
    recusa !== null && /número/i.test(recusa) && !/removida|salva/i.test(recusa);
  conferir(
    "C · `2e` na duração: a caixa entrega `2e`, a recusa é em português e o dado não muda",
    achou &&
      antes === DURACAO_DA_MEDIDA_C &&
      naCaixa === `${DURACAO_DA_MEDIDA_C}e` &&
      recusouEmPortugues &&
      depoisDoF5 === DURACAO_DA_MEDIDA_C,
    achou
      ? `valor inicial=${JSON.stringify(antes)} (esperado ${JSON.stringify(
          DURACAO_DA_MEDIDA_C,
        )}) · na caixa (DOM .value)=${JSON.stringify(naCaixa)} (esperado ${JSON.stringify(
          `${DURACAO_DA_MEDIDA_C}e`,
        )}) · mensagens=${JSON.stringify(recusa)} · depois do F5=${JSON.stringify(
          depoisDoF5,
        )} (esperado ${JSON.stringify(DURACAO_DA_MEDIDA_C)})`
      : "o campo de duração da tarefa NÃO existe na página — alvo ausente é reprovação, não dispensa",
  );
  const contratoOk = (c) => c !== null && c.type === "text" && c.inputMode === "decimal";
  conferir(
    "C2 · o contrato do campo NO INSTANTE em que o operador digita e em que manda salvar",
    achou && contratoOk(contratoAoDigitar) && contratoOk(contratoAoSalvar),
    achou
      ? `ao digitar=${JSON.stringify(contratoAoDigitar)} · ao mandar salvar=${JSON.stringify(
          contratoAoSalvar,
        )} (esperado {"type":"text","inputMode":"decimal"} nos dois)`
      : "o campo de duração da tarefa NÃO existe na página — alvo ausente é reprovação",
  );
  await contexto.close();
});

// ════════════════════════════════════════════════════════════════════════════
// D · A CORRIDA DO STATUS: O ANÚNCIO QUE CHEGA É O DO PRIMEIRO CLIQUE
//
// O ALTO #1 da rodada 13: com `(tentativaRef).current = novo` escrito ANTES do
// veredito da porta, a gravação a caminho lia o ref já sobrescrito pelo segundo
// clique (recusado) e anunciava o desfecho ERRADO — o servidor recebia `done` e
// a tela dizia `bloqueada`.
// ════════════════════════════════════════════════════════════════════════════
/*
 * ════════════════════════════════════════════════════ MÉDIO, rodada 22 ═
 * O DESFECHO DE UMA CORRIDA, COLHIDO COMO ESTADO — não lido num instante.
 *
 * D, H e I seguravam o POST 4 s e liam o anúncio UMA vez, 6,6 s depois do 1º
 * clique; M, 7,4 s depois. A frase de sucesso fica 4 s na tela: sob carga a
 * resposta chegava cedo demais (a frase já tinha saído) ou tarde demais (ainda
 * não tinha entrado), e a medida lia "". Medido nesta rodada, duas vezes, na D:
 * "anúncio final='' · marcado='concluída'" — o produto certo, a leitura no
 * instante errado. É a mesma forma viciada do E3 (a 4ª, "mede um instante
 * só"), e fecha do mesmo jeito: colhe TODA frase que passar pelas regiões
 * vivas, a cada 100 ms, até o estado assentar (a 1ª frase que interessa foi
 * vista, ou a condição `ate` valeu, há `assentarMs`), com teto. Uma frase
 * errada que aparecer em qualquer momento da janela fica registrada.
 */
async function colherAnuncios(pagina, casa, { ate = null, assentarMs = 1500, tetoMs = 30000 } = {}) {
  const vistos = [];
  const t0 = Date.now();
  let assentouEm = null;
  while (Date.now() - t0 < tetoMs) {
    const textos = await pagina.evaluate(() =>
      [...document.querySelectorAll('[role="alert"], [role="status"]')]
        .map((el) => (el.innerText || "").trim())
        .filter(Boolean),
    );
    for (const t of textos) if (casa(t) && !vistos.includes(t)) vistos.push(t);
    const pronto = ate === null ? vistos.length > 0 : ate(textos);
    if (!pronto) assentouEm = null;
    else if (assentouEm === null) assentouEm = Date.now();
    if (assentouEm !== null && Date.now() - assentouEm >= assentarMs) break;
    await pagina.waitForTimeout(100);
  }
  return vistos.join(" | ");
}

await medir("D", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-docs");
  // Atrasa só o POST da Server Action desta rota — é o atraso que abre a janela
  // da corrida. Sem ele não há corrida nenhuma para medir.
  let postsAtrasados = 0;
  await pagina.route(`${BASE}/tarefa/task-docs`, async (rota) => {
    if (rota.request().method() === "POST") {
      postsAtrasados += 1;
      await new Promise((r) => setTimeout(r, 4000));
    }
    await rota.continue();
  });
  // [MÉDIO #4, rodada 18] a precondição PRÓPRIA: o status está na primeira
  // opção, então o 1º clique é uma mudança de verdade e a corrida existe.
  const faltaPrecondicao = await precondicaoDaMedida("D", pagina, {
    descricao: "o status desta tarefa está na primeira opção do grupo",
    estabelecer: garantirStatusNaPrimeiraOpcao,
    ler: async (alvo) => await marcadoNoGrupo(alvo, "Status da tarefa"),
    esperado: (await opcoesDoGrupo(pagina, "Status da tarefa"))[0] ?? "(o grupo de status está vazio)",
  });
  if (faltaPrecondicao !== null) {
    conferir("D · corrida de status: o anúncio que chega é o do PRIMEIRO clique", false, faltaPrecondicao);
    await conferirVigia("V-D", [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }
  const concluida = pagina.getByRole("radio", { name: "concluída" });
  const bloqueada = pagina.getByRole("radio", { name: "bloqueada" });
  const temOsDois = (await concluida.count()) === 1 && (await bloqueada.count()) === 1;
  let recusaDoSegundo = "";
  let anuncioFinal = "";
  let marcado = "";
  if (temOsDois) {
    /*
     * `dispatchEvent("click")`, e não `click()`: a espera de atuação do
     * Playwright (elemento estável, recebendo eventos) fazia o SEGUNDO clique
     * esperar a resposta do PRIMEIRO — medido, 5,2 s depois — e a corrida que
     * esta medida existe para provocar simplesmente não acontecia. A guarda
     * dizia FALHA por não ter medido nada; agora os 300 ms são 300 ms.
     */
    await concluida.dispatchEvent("click");
    await pagina.waitForTimeout(300);
    await bloqueada.dispatchEvent("click");
    await pagina.waitForTimeout(300);
    recusaDoSegundo = await pagina.evaluate(() =>
      [...document.querySelectorAll('[role="alert"], [role="status"]')]
        .map((el) => (el.innerText || "").trim())
        .filter(Boolean)
        .join(" | "),
    );
    // A resposta atrasada chega aqui — colhida como estado (ver `colherAnuncios`).
    anuncioFinal = await colherAnuncios(pagina, (t) => t.startsWith("Status atualizado"));
    marcado = await pagina.evaluate(
      () =>
        document.querySelector('[role="radio"][aria-checked="true"]')?.textContent?.trim() ?? "",
    );
  }
  // A corrida aconteceu de verdade? Só há corrida se o POST ficou pendurado E o
  // segundo clique foi recusado com a frase da trava de voo. Sem as duas, a
  // medida não mediu — e não medir é reprovar, nunca dispensar.
  const houveCorrida = postsAtrasados >= 1 && /Aguarde/.test(recusaDoSegundo);
  conferir(
    "D · corrida de status: o anúncio que chega é o do PRIMEIRO clique",
    temOsDois &&
      houveCorrida &&
      /concluída/.test(anuncioFinal) &&
      !/bloqueada/.test(anuncioFinal) &&
      marcado === "concluída",
    temOsDois
      ? `POSTs atrasados=${String(postsAtrasados)} · recusa do 2º clique=${JSON.stringify(
          recusaDoSegundo,
        )} · anúncio final=${JSON.stringify(anuncioFinal)} · marcado=${JSON.stringify(marcado)}`
      : "os botões de status NÃO existem na página — alvo ausente é reprovação",
  );
  await conferirVigia("V-D", [{ pagina, registroFora }]);
  await contexto.close();
});

// ════════════════════════════════════════════════════════════════════════════
// E · "LIMPAR ÁTOMOS" TEM CAMINHO DE VOLTA
//
// ALTO #2: apagar os três números que alimentam o score de prioridade custava 1
// clique, sem confirmação e sem desfazer — e o sucesso ainda zerava os três
// controles na tela.
// ════════════════════════════════════════════════════════════════════════════
/**
 * [MÉDIO, rodada 22] O teto do DESFECHO de uma escrita da família E (ver
 * `esperarDesfechoDaExclusao`, mais abaixo) e a frase de "gravando" lida do
 * fonte — declarados ANTES da medida E, que é a primeira a usá-los.
 */
const TETO_DO_DESFECHO_DA_EXCLUSAO_MS = 60000;
const MENSAGEM_GRAVANDO_DO_FONTE =
  /export const MENSAGEM_GRAVANDO = "([^"]+)";/.exec(
    readFileSync(join(RAIZ_DO_PACOTE, "src", "components", "task", "escrita.ts"), "utf8"),
  )?.[1] ?? null;

await medir("E", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-build");
  /*
   * [MÉDIO #4, rodada 18] A PRECONDIÇÃO PRÓPRIA — e ela é o coração do achado.
   * "Limpar átomos" só existe quando a tarefa TEM átomos declarados. Esta
   * medida limpa; se ela estourar no meio, deixa a tarefa sem átomos, e E2 e M
   * (que precisam do botão) reprovam por um estrago que não é delas. Agora
   * cada uma declara e ESCREVE o estado de que precisa.
   */
  const faltaPrecondicao = await precondicaoDaMedida("E", pagina, {
    descricao: "esta tarefa tem os três átomos declarados, que é o que faz o score e o botão de limpar existirem",
    estabelecer: garantirAtomosDeclarados,
    ler: async (alvo) =>
      /assimetria \(A\) = \d+/.test(await scoreNaTela(alvo)) ? "com score" : "(sem score)",
    esperado: "com score",
  });
  if (faltaPrecondicao !== null) {
    conferir(
      'E · "Limpar átomos" tem caminho de volta (janela de Desfazer que devolve o score)',
      false,
      faltaPrecondicao,
    );
    await conferirVigia("V-E", [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }
  const scoreDe = async () => await scoreNaTela(pagina);
  const antes = await scoreDe();
  const limpar = pagina.getByRole("button", { name: "Limpar átomos" });
  const temBotao = (await limpar.count()) === 1;
  let desfazerApareceu = false;
  let depois = "";
  let restaurado = "";
  let aposF5 = "";
  let desfecho = null;
  if (temBotao) {
    await limpar.click();
    const desfazer = pagina.getByRole("button", { name: "Desfazer" });
    /*
     * [MÉDIO, rodada 22] Eram 8 s fixos para o botão aparecer — o MESMO
     * instante que derrubou a E3 sob carga, e derrubou esta medida numa corrida
     * desta rodada ("depois do clique=(sem score) · botão Desfazer
     * apareceu=false": a limpeza aconteceu, o botão só chegou depois). Agora é
     * o desfecho como ESTADO, com teto, pelo mesmo molde da E2–E4.
     */
    desfecho = await esperarDesfechoDaExclusao(pagina);
    desfazerApareceu = desfecho.desfecho === "desfazer";
    /*
     * A limpeza tem de ter ACONTECIDO de verdade antes de o desfazer ser
     * medido. Sem esta espera, um "Limpar átomos" que não limpasse nada
     * deixaria `antes === restaurado` e a medida diria VERDE sobre um desfazer
     * que nunca desfez — a mesma armadilha de medir o quadro anterior.
     */
    await pagina
      .waitForFunction(() => !/assimetria \(A\) = \d+/.test(document.body.innerText), null, {
        timeout: 15000,
      })
      .catch(() => undefined);
    depois = await scoreDe();
    if (desfazerApareceu) {
      await desfazer.first().click();
      // [MÉDIO, rodada 22] eram 2,5 s fixos: agora espera o score MUDAR, com teto.
      restaurado = await esperarNaTela(scoreDe, antes, TETO_DO_DESFECHO_DA_EXCLUSAO_MS);
      await pagina.reload({ waitUntil: "networkidle" });
      await pagina.waitForSelector("h1");
      aposF5 = await scoreDe();
    }
  }
  if (temBotao && desfecho?.desfecho === "ainda-gravando") {
    conferir(
      'E · "Limpar átomos" tem caminho de volta (janela de Desfazer que devolve o score)',
      false,
      `a limpeza ficou em "${String(
        MENSAGEM_GRAVANDO_DO_FONTE,
      )}" por ${String(desfecho.ms)} ms (teto): o servidor não respondeu, e o caminho de volta NÃO foi medido nesta corrida — não é verde, e não é defeito provado`,
      "nao-medido",
    );
    await conferirVigia("V-E", [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }
  conferir(
    'E · "Limpar átomos" tem caminho de volta (janela de Desfazer que devolve o score)',
    temBotao &&
      /assimetria \(A\) = \d+/.test(antes) &&
      desfazerApareceu &&
      // a limpeza aconteceu…
      depois === "(sem score)" &&
      // …e o desfazer devolveu, no cliente E no servidor.
      restaurado === antes &&
      aposF5 === antes,
    temBotao
      ? `desfecho da limpeza: ${String(desfecho?.desfecho)} em ${String(
          desfecho?.ms,
        )} ms (teto ${String(TETO_DO_DESFECHO_DA_EXCLUSAO_MS)} ms)${
          desfecho?.erro ? ` — ${desfecho.erro}` : ""
        } · antes=${JSON.stringify(antes)} · depois do clique=${JSON.stringify(
          depois,
        )} · botão Desfazer apareceu=${String(
          desfazerApareceu,
        )} · depois do Desfazer=${JSON.stringify(restaurado)} · depois do F5=${JSON.stringify(
          aposF5,
        )}`
      : 'o botão "Limpar átomos" NÃO existe nesta tarefa — alvo ausente é reprovação',
  );
  await conferirVigia("V-E", [{ pagina, registroFora }]);
  await contexto.close();
});

// ════════════════════════════════════════════════════════════════════════════
// E2 · E3 · E4 — O "DESFAZER" QUE **FALHA**
//
// [ALTO #1, rodada 15] A medida E prova o desfazer que DÁ CERTO. O crítico da
// rodada 15 mediu o outro caminho, e ele destruía dado do operador: com a rota
// segurando o POST 3 s e abortando, e o clique aos 8,5 s da janela de 10 s, a
// tela dizia "Não foi possível desfazer — a nota continua excluída.", havia
// ZERO botões de Desfazer, e a nota não voltava mais. O texto dela existia num
// lugar só, e o relógio da janela o descartou no meio da chamada.
//
// As três medidas abaixo são o mesmo molde nos três painéis. Cada uma pergunta
// três coisas, e todas as três têm de valer:
//
//  1. a tela DIZ que não deu — a falha não é silenciosa;
//  2. o botão "Desfazer" CONTINUA na tela (é o que o `aoFalha` promete);
//  3. o dado VOLTA — tirada a sabotagem, o mesmo botão desfaz de verdade.
//
// A nº 3 é a que importa: botão que fica e não faz nada seria pior que botão
// que some.
// ════════════════════════════════════════════════════════════════════════════

/** Todo texto de região viva da página, numa string. */
async function lerRegioesVivas(pagina) {
  return await pagina.evaluate(() =>
    [...document.querySelectorAll('[role="alert"], [role="status"]')]
      .map((el) => (el.innerText || "").trim())
      .filter(Boolean)
      .join(" | "),
  );
}

/**
 * O botão "excluir" DAQUELE painel, achado pelo que a confirmação dele diz.
 * A página tem sete botões "excluir" (notas e relações), e escolher por
 * posição amarraria a medida ao fixture: aqui a medida clica e LÊ a frase.
 */
async function excluirDe(pagina, assunto) {
  /*
   * Os NÓS, não um localizador por papel+nome. Entrar em confirmação troca o
   * rótulo daquele botão, então `getByRole("button", { name: "excluir" })`
   * deixa de casar com ele — e `nth(0)`, que é preguiçoso, passa a apontar
   * para o botão SEGUINTE. Medido: o 2º clique caía na nota de baixo, a
   * confirmação da primeira era cancelada, e a medida dizia "a exclusão não
   * aconteceu" sobre uma exclusão que nunca foi pedida.
   */
  const nos = await pagina.getByRole("button", { name: "excluir" }).elementHandles();
  for (const no of nos) {
    await no.click();
    if (new RegExp(`apagar a ${assunto}`).test(await lerRegioesVivas(pagina))) return no;
  }
  return null;
}

/**
 * As listas da página numa string: a PRIMEIRA LINHA de cada item.
 *
 * Só a primeira linha de propósito: as linhas seguintes trazem "há 75 dias" e
 * afins, e uma medida que compara texto de tempo relativo fica instável por
 * conta própria. A primeira linha é o texto da nota, ou o tipo da relação —
 * exatamente o que a exclusão tira e o desfazer devolve.
 */
async function listaDaPagina(pagina) {
  return await pagina.evaluate(() =>
    [...document.querySelectorAll("li")]
      .map((el) => (el.innerText || "").split("\n")[0].trim())
      .filter((t) => t.length > 0)
      .join(" ~ "),
  );
}

/**
 * Espera o estado PARAR DE SER o de antes, e devolve o que ele virou.
 *
 * Sem isto a medida lia o quadro anterior: o "Desfazer" aparece assim que a
 * resposta chega, mas a lista e o score só mudam quando o `router.refresh()`
 * da porta volta. Ler antes disso faria a medida dizer "a exclusão não
 * aconteceu" sobre uma exclusão que aconteceu — a mesma armadilha que a
 * medida E fechou com um `waitForFunction`.
 */
async function esperarMudanca(pagina, lerEstado, antes, limiteMs = 15000) {
  const ate = Date.now() + limiteMs;
  let agora = await lerEstado(pagina);
  while (agora === antes && Date.now() < ate) {
    await pagina.waitForTimeout(250);
    agora = await lerEstado(pagina);
  }
  return agora;
}

/*
 * ════════════════════════════════════════════════════ MÉDIO, rodada 22 ═
 * O DESFECHO DA EXCLUSÃO É ESPERADO COMO ESTADO — e "não medi" deixa de ser
 * "o produto falhou".
 *
 * A rodada 21 reprovou UMA vez sob carga (~15, sem núcleo fixo): "E3 · botão
 * Desfazer apareceu=false · clique aos 0ms · POSTs abortados=0 · mensagens=''"
 * — e, na MESMA linha, "botões Desfazer DEPOIS da falha=1". O botão existia
 * logo depois: a exclusão tinha acontecido, só que depois dos 12 s que a
 * medida dava ao botão para aparecer. A medida lia um INSTANTE (12 s) e
 * chamava de defeito o que era espera.
 *
 * Agora o desfecho é esperado como ESTADO, com teto, e cada um tem nome:
 *  - o "Desfazer" apareceu → segue a medida (a janela conta dali);
 *  - um `role="alert"` apareceu → o produto RECUSOU a exclusão: FALHA;
 *  - o teto passou com "Salvando…" na tela → o servidor não respondeu a tempo:
 *    a guarda NÃO conseguiu medir o desfazer (código 2, nunca verde);
 *  - o teto passou sem "Salvando…", sem botão e sem erro → o clique sumiu em
 *    silêncio: FALHA do produto.
 */

async function esperarDesfechoDaExclusao(pagina, tetoMs = TETO_DO_DESFECHO_DA_EXCLUSAO_MS) {
  const t0 = Date.now();
  let viuGravando = false;
  let ultimo = null;
  while (Date.now() - t0 < tetoMs) {
    ultimo = await pagina.evaluate((gravando) => {
      const normal = (t) => (t || "").replace(/\s+/g, " ").trim();
      return {
        desfazer: [...document.querySelectorAll("button")].some(
          (b) => normal(b.textContent) === "Desfazer",
        ),
        gravando:
          gravando !== null &&
          [...document.querySelectorAll('[role="status"]')].some((el) =>
            normal(el.textContent).includes(gravando),
          ),
        erro: [...document.querySelectorAll('[role="alert"]')]
          .map((el) => normal(el.textContent))
          .filter(Boolean)
          .join(" | "),
      };
    }, MENSAGEM_GRAVANDO_DO_FONTE);
    if (ultimo.gravando) viuGravando = true;
    if (ultimo.desfazer) return { desfecho: "desfazer", ms: Date.now() - t0, viuGravando, erro: "" };
    if (ultimo.erro.length > 0) {
      return { desfecho: "erro", ms: Date.now() - t0, viuGravando, erro: ultimo.erro };
    }
    await pagina.waitForTimeout(250);
  }
  return {
    desfecho: ultimo?.gravando === true ? "ainda-gravando" : "nada",
    ms: Date.now() - t0,
    viuGravando,
    erro: "",
  };
}

/**
 * [ALTO, rodada 23] As medidas de "Desfazer que falha" que PASSARAM nesta
 * corrida. A família R (a falha como classe) CITA E2, E3 e E4 como o caso "a
 * rede cai" dos três "Desfazer" que elas já exercem em tempo real — e R0 só
 * aceita a citação se a medida citada existiu e passou. Contado fora de R.
 */
const MEDIDAS_CITADAS_OK = new Set();

/** O molde das três medidas do ALTO #1. */
async function medirDesfazerQueFalha(config) {
  const { rotulo, frase, rota, vigia, iniciar, lerEstado, precondicao } = config;
  const { contexto, pagina, registroFora } = await abrir(rota);
  // [MÉDIO #4, rodada 18] cada uma das três declara e ESCREVE o estado de que
  // precisa: E2 precisa de átomos declarados, E3 de uma nota, E4 de uma
  // relação. Sem isso, a medida E estourando no meio derrubava E2 junto.
  const faltaPrecondicao = await precondicaoDaMedida(rotulo, pagina, precondicao);
  if (faltaPrecondicao !== null) {
    conferir(`${rotulo} · ${frase}`, false, faltaPrecondicao);
    await conferirVigia(vigia, [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }
  const antes = await lerEstado(pagina);
  const comecou = await iniciar(pagina);
  const desfazer = pagina.getByRole("button", { name: "Desfazer" });
  // [MÉDIO, rodada 22] o desfecho como ESTADO, com teto — ver acima.
  const desfecho = comecou
    ? await esperarDesfechoDaExclusao(pagina)
    : { desfecho: "nada", ms: 0, viuGravando: false, erro: "" };
  const apareceu = desfecho.desfecho === "desfazer";
  const nascimento = Date.now();
  // [MÉDIO, rodada 22] também como estado: o `router.refresh()` sob carga pode
  // passar dos 15 s do padrão, e ler antes disso diria "não excluiu".
  const depoisDaExclusao = apareceu
    ? await esperarMudanca(pagina, lerEstado, antes, TETO_DO_DESFECHO_DA_EXCLUSAO_MS)
    : antes;

  /*
   * [ALTO, rodada 23] A régua (b) da família R, aplicada aqui também: com o
   * pedido FALHANDO, a loja não muda — nenhuma entidade nova, nenhuma a menos,
   * nenhum campo, na loja inteira. É ela que faz destas três medidas os casos
   * "a rede cai" dos três "Desfazer" que a família R cita, sem duplicar.
   */
  const fotoAntesDaFalha = apareceu ? await fotografia() : null;
  const janelaDaFalha = { inicio: Date.now(), fim: Date.now() };

  // A sabotagem: o POST do desfazer fica pendurado 3 s e depois morre. Ela
  // entra AGORA, depois de a exclusão ter acontecido de verdade.
  let postsAbortados = 0;
  const padrao = `${BASE}${rota}`;
  await pagina.route(padrao, async (chamada) => {
    if (chamada.request().method() === "POST") {
      postsAbortados += 1;
      await new Promise((r) => setTimeout(r, 3000));
      await chamada.abort();
      return;
    }
    await chamada.continue();
  });

  let clicouAos = 0;
  if (apareceu) {
    // Aos 8,5 s da janela de 10 s: a falha vai chegar DEPOIS de o relógio
    // querer fechar a janela. É esse cruzamento que destruía o dado.
    const espera = 8500 - (Date.now() - nascimento);
    if (espera > 0) await pagina.waitForTimeout(espera);
    clicouAos = Date.now() - nascimento;
    await desfazer.first().click();
    /*
     * [MÉDIO, rodada 22] Eram 5 s fixos: um instante. A sabotagem segura o POST
     * 3 s e o aborta; sob carga a frase de falha pode chegar depois dos 5 s.
     * Agora espera o ESTADO — um `role="alert"` com texto — com teto, e lê.
     */
    const ateOAlerta = Date.now() + 30000;
    while (Date.now() < ateOAlerta) {
      const temAlerta = await pagina.evaluate(() =>
        [...document.querySelectorAll('[role="alert"]')].some(
          (el) => (el.textContent || "").trim().length > 0,
        ),
      );
      if (temAlerta) break;
      await pagina.waitForTimeout(250);
    }
  }
  const mensagens = apareceu ? await lerRegioesVivas(pagina) : "";
  const botoesDepois = await desfazer.count();
  janelaDaFalha.fim = Date.now();
  const alcanceDaFalha =
    fotoAntesDaFalha === null
      ? { problemas: ["(a falha não chegou a ser provocada)"], resumo: "(sem fotografia)" }
      : problemasDeAlcance(fotoAntesDaFalha, fotoAntesDaFalha, await fotografia(), {}, [], janelaDaFalha);

  // Tirada a sabotagem, o MESMO botão tem de desfazer de verdade.
  await pagina.unroute(padrao);
  let restaurado = "(não tentou: não havia botão)";
  if (botoesDepois >= 1) {
    await desfazer.first().click();
    restaurado = await esperarMudanca(
      pagina,
      lerEstado,
      depoisDaExclusao,
      TETO_DO_DESFECHO_DA_EXCLUSAO_MS,
    );
  }

  const disseQueFalhou = /Não foi possível desfazer/.test(mensagens);
  const oDesfecho = `desfecho da exclusão: ${
    {
      desfazer: "o botão Desfazer apareceu",
      erro: `a página RECUSOU (${JSON.stringify(desfecho.erro)})`,
      "ainda-gravando": `a página ainda dizia ${JSON.stringify(
        MENSAGEM_GRAVANDO_DO_FONTE,
      )} — o servidor não respondeu no teto`,
      nada: "nada: sem botão, sem erro e sem gravação em curso",
    }[desfecho.desfecho]
  } em ${String(desfecho.ms)} ms (teto ${String(TETO_DO_DESFECHO_DA_EXCLUSAO_MS)} ms; "${String(
    MENSAGEM_GRAVANDO_DO_FONTE,
  )}" visto=${String(desfecho.viuGravando)})`;
  if (comecou && desfecho.desfecho === "ainda-gravando") {
    conferir(
      `${rotulo} · ${frase}`,
      false,
      `${oDesfecho} · a exclusão não terminou, então o desfazer que falha NÃO foi medido nesta corrida — não é verde, e não é defeito provado`,
      "nao-medido",
    );
    await conferirVigia(vigia, [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }
  conferir(
    `${rotulo} · ${frase}`,
    MENSAGEM_GRAVANDO_DO_FONTE !== null &&
      comecou &&
      apareceu &&
      postsAbortados >= 1 &&
      antes !== depoisDaExclusao &&
      disseQueFalhou &&
      botoesDepois >= 1 &&
      alcanceDaFalha.problemas.length === 0 &&
      restaurado === antes,
    comecou
      ? `${oDesfecho} · antes=${JSON.stringify(antes)} · depois de excluir=${JSON.stringify(
          depoisDaExclusao,
        )} · botão Desfazer apareceu=${String(apareceu)} · clique aos ${String(
          clicouAos,
        )}ms da janela de 10000ms · POSTs abortados=${String(
          postsAbortados,
        )} · mensagens=${JSON.stringify(mensagens)} · botões Desfazer DEPOIS da falha=${String(
          botoesDepois,
        )} (esperado ≥ 1) · loja durante a falha: ${
          alcanceDaFalha.problemas.length === 0
            ? `sem mudança (${alcanceDaFalha.resumo})`
            : `MUDOU com um pedido que falhou: ${alcanceDaFalha.problemas.join(" | ")}`
        } · depois de tentar de novo sem sabotagem=${JSON.stringify(
          restaurado,
        )} (esperado ${JSON.stringify(antes)})`
      : "não foi possível começar a exclusão nesta tarefa — alvo ausente é reprovação, não dispensa",
  );
  if (!falhas.includes(`${rotulo} · ${frase}`) && medidas.at(-1)?.startsWith("ok   ")) {
    MEDIDAS_CITADAS_OK.add(rotulo);
  }
  await conferirVigia(vigia, [{ pagina, registroFora }]);
  await contexto.close();
}

await medir("E2", async () => {
  await medirDesfazerQueFalha({
    rotulo: "E2",
    frase:
      'o "Desfazer" dos ÁTOMOS que FALHA: a tela diz, o botão fica, e o trio volta na 2ª tentativa',
    rota: "/tarefa/task-build",
    vigia: "V-E2",
    precondicao: {
      descricao: "esta tarefa tem os três átomos declarados (é o que faz o botão de limpar existir)",
      estabelecer: garantirAtomosDeclarados,
      ler: async (alvo) =>
        /assimetria \(A\) = \d+/.test(await scoreNaTela(alvo)) ? "com score" : "(sem score)",
      esperado: "com score",
    },
    iniciar: async (pagina) => {
      const limpar = pagina.getByRole("button", { name: "Limpar átomos" });
      if ((await limpar.count()) !== 1) return false;
      await limpar.click();
      return true;
    },
    lerEstado: async (pagina) =>
      await pagina.evaluate(
        () => document.body.innerText.match(/assimetria \(A\) = \d+/)?.[0] ?? "(sem score)",
      ),
  });
});

await medir("E3", async () => {
  await medirDesfazerQueFalha({
    rotulo: "E3",
    frase:
      'o "Desfazer" da NOTA que FALHA: a tela diz, o botão fica, e o TEXTO da nota volta na 2ª tentativa',
    rota: "/tarefa/task-build",
    vigia: "V-E3",
    precondicao: {
      descricao: "esta tarefa tem pelo menos uma nota para apagar",
      estabelecer: async (alvo) => {
        if ((await quantosParaExcluir(alvo, "nota")) >= 1) return;
        await criarNotaMarcada(alvo, "nota da precondição de E3");
        await recarregar(alvo);
      },
      ler: async (alvo) => ((await quantosParaExcluir(alvo, "nota")) >= 1 ? "há nota" : "não há nota"),
      esperado: "há nota",
    },
    iniciar: async (pagina) => {
      const botao = await excluirDe(pagina, "nota");
      if (botao === null) return false;
      // 2º clique: o que apaga.
      await botao.click();
      return true;
    },
    lerEstado: listaDaPagina,
  });
});

await medir("E4", async () => {
  await medirDesfazerQueFalha({
    rotulo: "E4",
    frase:
      'o "Desfazer" da RELAÇÃO que FALHA: a tela diz, o botão fica, e a relação volta na 2ª tentativa',
    rota: "/tarefa/task-build",
    vigia: "V-E4",
    precondicao: {
      descricao: "esta tarefa tem pelo menos uma relação para apagar",
      ler: async (alvo) =>
        (await quantosParaExcluir(alvo, "relação")) >= 1 ? "há relação" : "não há relação",
      esperado: "há relação",
    },
    iniciar: async (pagina) => {
      const botao = await excluirDe(pagina, "relação");
      if (botao === null) return false;
      await botao.click();
      return true;
    },
    lerEstado: listaDaPagina,
  });
});

// ════════════════════════════════════════════════════════════════════════════
// F · O RASCUNHO DOS CAMPOS DE TEXTO SOBREVIVE À NAVEGAÇÃO
//
// MÉDIO #1: `rascunho-nota.ts` protegia a nota e o autor da nota. A "Nota da
// relação" nasceu na rodada 13 já sem proteção; título e duração da subtarefa
// também não tinham; e a duração da tarefa perdia a edição em voo. A página é
// cheia de links para outras tarefas, e `useAvisoDeSaida` só arma quando há
// gravação a caminho.
// ════════════════════════════════════════════════════════════════════════════
await medir("F", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-build");
  await pagina.getByRole("radio", { name: "sinergia" }).click();
  await pagina.waitForSelector('input[inputmode="decimal"]');
  // [MÉDIO #4, rodada 18] a precondição PRÓPRIA desta medida.
  const faltaPrecondicao = await precondicaoDaMedida("F", pagina, {
    descricao: 'a rota mostra os campos de criação, com o "Desconto" da sinergia revelado',
    ler: async (alvo) => String(await quantosCampos(alvo)),
    esperado: String(PISO_DE_CAMPOS_POR_ROTA),
  });
  if (faltaPrecondicao !== null) {
    conferir("F · o rascunho dos 6 campos de criação sobrevive à navegação", false, faltaPrecondicao);
    await conferirVigia("V-F", [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }

  /** Cada campo pelo nome que o operador lê, e o texto que vai nele. */
  const PLANO = [
    [/^Nova nota$/, "rascunho da NOTA"],
    [/^Autor da nota/, "Lucas"],
    [/^Título da subtarefa$/, "sub que eu estava escrevendo"],
    [/^Duração \(dias\)$/, "7"],
    [/^Nota da relação/, "rascunho da NOTA DA RELAÇÃO"],
    [/^Desconto/, "0.25"],
  ];
  /*
   * A duração da TAREFA não entra: ela é o único campo que nasce com o número
   * que o servidor guarda, e por decisão desta rodada não recebe rascunho — um
   * rascunho ali faria a caixa mostrar um valor que o banco não tem, sem dizer
   * que não está salvo. A medida G, abaixo, é quem vigia essa dispensa.
   */
  const localizar = (nome) => campoPorNome(pagina, nome).first();

  const ausentes = [];
  for (const [nome, texto] of PLANO) {
    const campo = localizar(nome);
    if ((await campo.count()) === 0) {
      ausentes.push(String(nome));
      continue;
    }
    await campo.fill(texto);
  }
  await pagina.waitForTimeout(300);

  // Navegação de verdade, do jeito que o operador faz: clicar num link da
  // própria página e voltar.
  const link = pagina.locator('a[href="/tarefa/task-setup"]').first();
  const temLink = (await link.count()) >= 1;
  if (temLink) {
    await link.click();
    await pagina.waitForURL("**/tarefa/task-setup", { timeout: 30000 });
    await pagina.waitForSelector("h1");
    // [CRÍTICO #1, rodada 15] rota alcançada por clique é rota VISITADA — e a
    // medida L cobra sentinela para ela.
    await anotarRotaAtual(pagina);
  }
  await pagina.goto(`${BASE}/tarefa/task-build`, { waitUntil: "networkidle" });
  await pagina.waitForSelector("h1");
  await pagina.getByRole("radio", { name: "sinergia" }).click();
  await pagina.waitForSelector('input[inputmode="decimal"]');
  await assentar(pagina);

  const perdidos = [];
  for (const [nome, texto] of PLANO) {
    if (ausentes.includes(String(nome))) continue;
    const campo = localizar(nome);
    const valor = (await campo.count()) === 0 ? "(campo desapareceu)" : await campo.inputValue();
    if (valor !== texto) perdidos.push(`${String(nome)}: ${JSON.stringify(valor)}`);
  }
  conferir(
    "F · o rascunho dos 6 campos de criação sobrevive à navegação",
    ausentes.length === 0 && temLink && perdidos.length === 0,
    `${String(PLANO.length - ausentes.length)}/${String(
      PLANO.length,
    )} campos achados na tela · link de saída=${String(temLink)} · ${String(
      perdidos.length,
    )} perdidos${ausentes.length > 0 ? ` · AUSENTES: ${ausentes.join(", ")}` : ""}${
      perdidos.length > 0 ? ` — ${perdidos.join(" · ")}` : ""
    }`,
  );
  await conferirVigia("V-F", [{ pagina, registroFora }]);
  await contexto.close();
});

// ════════════════════════════════════════════════════════════════════════════
// H · A CORRIDA NA TAREFA MÃE: O `<select>` E O ANÚNCIO FICAM NO 1º PEDIDO
//
// O ALTO #1 não é só do status: `mae-form.tsx` e `meta-form.tsx` seguem a mesma
// lei e não tinham nenhuma rede além da derivada. Aqui o `<select>` tem um
// agravante próprio: quando a porta recusa, ele JÁ trocou de valor sozinho (o
// React não re-renderiza porque o estado não mudou), e é o `tentativaRef` que
// diz a que opção ele deve voltar.
// ════════════════════════════════════════════════════════════════════════════
await medir("H", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-docs");
  // [MÉDIO #4, rodada 18] a precondição vem ANTES de interceptar o POST: com a
  // rota já pendurando 4 s, escrever o estado de partida custaria a corrida
  // inteira — e a medida mediria a própria preparação.
  const faltaPrecondicao = await precondicaoDaMedida("H", pagina, {
    descricao: "esta tarefa começa sem mãe, para a primeira escolha ser uma mudança de verdade",
    estabelecer: garantirSemMae,
    ler: async (alvo) => {
      const select = alvo.locator('select[aria-label="Tarefa mãe"]').first();
      if ((await select.count()) !== 1) return "(o <select> da mãe não está na página)";
      return (await select.inputValue()) === "" ? "(nenhuma)" : await select.inputValue();
    },
    esperado: "(nenhuma)",
  });
  if (faltaPrecondicao !== null) {
    conferir(
      "H · corrida na tarefa mãe: o `<select>` e o anúncio ficam no 1º pedido",
      false,
      faltaPrecondicao,
    );
    await conferirVigia("V-H", [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }
  let postsAtrasados = 0;
  await pagina.route(`${BASE}/tarefa/task-docs`, async (rota) => {
    if (rota.request().method() === "POST") {
      postsAtrasados += 1;
      await new Promise((r) => setTimeout(r, 4000));
    }
    await rota.continue();
  });
  const opcoes = await pagina.evaluate(() => {
    const el = document.querySelector('select[aria-label="Tarefa mãe"]');
    return el === null
      ? []
      : [...el.options].map((o) => ({ valor: o.value, texto: (o.textContent ?? "").trim() }));
  });
  const candidatas = opcoes.filter((o) => o.valor !== "");
  const temNenhuma = opcoes.some((o) => o.valor === "");
  const temDuas = candidatas.length >= 1 && temNenhuma;
  /*
   * A 2ª escolha é "nenhuma" de propósito: ela é a única que faz o anúncio
   * MUDAR de frase ("Tarefa mãe removida." em vez de "atualizada."). Com duas
   * candidatas quaisquer, a frase seria a mesma nos dois desfechos e a medida
   * teria um olho cego.
   *
   * E a escolha é feita por evento nativo, não por `selectOption`: mesmo com
   * `force`, a espera de atuação do Playwright fazia a 2ª escolha aguardar a
   * resposta da 1ª — medido, 2 POSTs e nenhuma recusa — e a corrida que esta
   * medida existe para provocar não acontecia.
   */
  const escolher = async (valor) =>
    await pagina.evaluate((v) => {
      const el = document.querySelector('select[aria-label="Tarefa mãe"]');
      if (el === null) return;
      el.value = v;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, valor);
  let recusa = "";
  let anuncio = "";
  let noSelect = "";
  if (temDuas) {
    await escolher(candidatas[0].valor);
    await pagina.waitForTimeout(300);
    await escolher("");
    await pagina.waitForTimeout(400);
    recusa = await pagina.evaluate(() =>
      [...document.querySelectorAll('[role="alert"], [role="status"]')]
        .map((el) => (el.innerText || "").trim())
        .filter(Boolean)
        .join(" | "),
    );
    // [MÉDIO, rodada 22] colhido como estado (ver `colherAnuncios`).
    anuncio = await colherAnuncios(pagina, (t) => /Tarefa mãe/.test(t));
    noSelect = await pagina.evaluate(
      () => document.querySelector('select[aria-label="Tarefa mãe"]')?.value ?? "",
    );
  }
  conferir(
    "H · corrida na tarefa mãe: o `<select>` e o anúncio ficam no 1º pedido",
    temDuas &&
      postsAtrasados >= 1 &&
      /Aguarde/.test(recusa) &&
      /Tarefa mãe atualizada\./.test(anuncio) &&
      !/Tarefa mãe removida\./.test(anuncio) &&
      noSelect === candidatas[0].valor,
    temDuas
      ? `POSTs atrasados=${String(postsAtrasados)} · 1ª escolha=${JSON.stringify(
          candidatas[0].texto,
        )} · 2ª (recusada)="nenhuma" · recusa=${JSON.stringify(
          recusa,
        )} · anúncio=${JSON.stringify(anuncio)} · select ficou em=${JSON.stringify(
          opcoes.find((o) => o.valor === noSelect)?.texto ?? noSelect,
        )}`
      : `o <select> de tarefa mãe com candidata e opção "nenhuma" NÃO existe (${String(
          candidatas.length,
        )} candidatas, "nenhuma"=${String(temNenhuma)}) — alvo ausente é reprovação`,
  );
  await conferirVigia("V-H", [{ pagina, registroFora }]);
  await contexto.close();
});

// ════════════════════════════════════════════════════════════════════════════
// I · A CORRIDA NA META: O ANÚNCIO QUE CHEGA É O DO 1º CLIQUE
//
// O botão da meta alterna. Dois cliques dentro da janela de uma gravação lenta:
// o segundo é recusado, e a gravação a caminho — que marcou — não pode anunciar
// "Meta removida.".
// ════════════════════════════════════════════════════════════════════════════
await medir("I", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-docs");
  // [MÉDIO #4, rodada 18] idem: a precondição antes da interceptação.
  const faltaPrecondicao = await precondicaoDaMedida("I", pagina, {
    descricao: "esta tarefa começa SEM ser meta, para o primeiro clique marcar de verdade",
    estabelecer: garantirSemMeta,
    ler: async (alvo) => {
      const botao = alvo.locator("button[aria-pressed]").first();
      if ((await botao.count()) !== 1) return "(o botão de meta não está na página)";
      return `aria-pressed=${String(await botao.getAttribute("aria-pressed"))}`;
    },
    esperado: "aria-pressed=false",
  });
  if (faltaPrecondicao !== null) {
    conferir("I · corrida na meta: o anúncio que chega é o do 1º clique", false, faltaPrecondicao);
    await conferirVigia("V-I", [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }
  let postsAtrasados = 0;
  await pagina.route(`${BASE}/tarefa/task-docs`, async (rota) => {
    if (rota.request().method() === "POST") {
      postsAtrasados += 1;
      await new Promise((r) => setTimeout(r, 4000));
    }
    await rota.continue();
  });
  const botao = pagina.locator('button[aria-pressed]').first();
  const temBotao = (await botao.count()) === 1;
  let recusa = "";
  let anuncio = "";
  if (temBotao) {
    await botao.dispatchEvent("click");
    await pagina.waitForTimeout(300);
    await botao.dispatchEvent("click");
    await pagina.waitForTimeout(400);
    recusa = await pagina.evaluate(() =>
      [...document.querySelectorAll('[role="alert"], [role="status"]')]
        .map((el) => (el.innerText || "").trim())
        .filter(Boolean)
        .join(" | "),
    );
    // [MÉDIO, rodada 22] colhido como estado (ver `colherAnuncios`).
    anuncio = await colherAnuncios(pagina, (t) => /meta/i.test(t));
  }
  conferir(
    "I · corrida na meta: o anúncio que chega é o do 1º clique",
    temBotao &&
      postsAtrasados >= 1 &&
      /Aguarde/.test(recusa) &&
      /Marcada como meta\./.test(anuncio) &&
      !/Meta removida\./.test(anuncio),
    temBotao
      ? `POSTs atrasados=${String(postsAtrasados)} · recusa do 2º clique=${JSON.stringify(
          recusa,
        )} · anúncio=${JSON.stringify(anuncio)}`
      : "o botão da meta NÃO existe na página — alvo ausente é reprovação",
  );
  await conferirVigia("V-I", [{ pagina, registroFora }]);
  await contexto.close();
});

// ════════════════════════════════════════════════════════════════════════════
// G · A DISPENSA DO RASCUNHO NA DURAÇÃO DA TAREFA É VIGIADA
//
// Seis campos da página nascem vazios e ganham rascunho (medida F). A duração
// da TAREFA nasce com o número que o servidor guarda e, por decisão desta
// rodada, NÃO ganha: um rascunho ali faria a caixa mostrar `9,9` com o banco em
// `3`, sem dizer que aquilo não está salvo — a página mentindo sobre o que está
// gravado, que é a família dos CRÍTICOs das rodadas 10, 11 e 13.
//
// Uma dispensa sem guarda é uma dispensa que ninguém revisa. Esta é a guarda.
// ════════════════════════════════════════════════════════════════════════════
/** A duração que a medida G exige gravada — ela precisa de um valor para voltar. */
const DURACAO_DA_MEDIDA_G = "5";

await medir("G", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-build");
  // [MÉDIO #4, rodada 18] a precondição PRÓPRIA: sem duração gravada, "a caixa
  // mostra o que o banco tem" não distingue nada de nada.
  const faltaPrecondicao = await precondicaoDaMedida("G", pagina, {
    descricao: "esta tarefa tem uma duração gravada, que é o valor que a caixa tem de mostrar na volta",
    estabelecer: async (alvo) => {
      await garantirDuracao(alvo, DURACAO_DA_MEDIDA_G);
    },
    ler: duracaoNaCaixa,
    esperado: DURACAO_DA_MEDIDA_G,
  });
  if (faltaPrecondicao !== null) {
    conferir(
      "G · a duração da tarefa volta mostrando o que o BANCO tem, não o rascunho",
      false,
      faltaPrecondicao,
    );
    conferir(
      "G2 · a tela DIZ que o que foi digitado não está salvo — e diz diferente nos dois campos gêmeos",
      false,
      faltaPrecondicao,
    );
    await conferirVigia("V-G", [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }
  const campo = campoPorNome(pagina, /^Duração \(dias, p80/).first();
  const achou = (await campo.count()) === 1;
  let gravado = null;
  let depoisDaVolta = null;
  let temLink = false;
  if (achou) {
    gravado = await campo.inputValue();
    await campo.fill("9.9");
    await pagina.waitForTimeout(300);
    /*
     * ════════════════════════════════════════════════════ MÉDIO #1, rodada 15 ═
     * G2 — A DISPENSA DE RASCUNHO PASSA A SER DITA NA TELA, E DITA DIFERENTE
     * DO CAMPO GÊMEO.
     *
     * O crítico mediu os dois campos de duração lado a lado, mesmo desenho,
     * comportamentos opostos, e NENHUM sinal: "algum aviso de 'não salvo' na
     * tela: false · regiões vivas: []". Esta medida cobra as duas frases, e
     * cobra que elas sejam DIFERENTES — uma frase só não distingue nada.
     */
    const subtarefa = campoPorNome(pagina, /^Duração \(dias\)$/).first();
    if ((await subtarefa.count()) === 1) await subtarefa.fill("4");
    await pagina.waitForTimeout(300);
    const avisos = await pagina.evaluate(() => {
      const ler = (id) => {
        const el = document.getElementById(id);
        return { existe: el !== null, texto: el === null ? "" : (el.innerText || "").trim() };
      };
      const apontado = (rotulo) => {
        const campos = [...document.querySelectorAll("input")];
        const alvo = campos.find((c) => (c.closest("label")?.innerText ?? "").startsWith(rotulo));
        return alvo === undefined ? "" : (alvo.getAttribute("aria-describedby") ?? "");
      };
      return {
        daTarefa: ler("duracao-tarefa-nao-salvo"),
        daSubtarefa: ler("subtarefa-nao-salvo"),
        apontaDaTarefa: apontado("Duração (dias, p80"),
        apontaDaSubtarefa: apontado("Duração (dias)"),
      };
    });
    const dizAlgo = (a) => a.existe && a.texto.length > 0;
    conferir(
      "G2 · a tela DIZ que o que foi digitado não está salvo — e diz diferente nos dois campos gêmeos",
      dizAlgo(avisos.daTarefa) &&
        dizAlgo(avisos.daSubtarefa) &&
        avisos.daTarefa.texto !== avisos.daSubtarefa.texto &&
        /se perde/.test(avisos.daTarefa.texto) &&
        /fica guardado/.test(avisos.daSubtarefa.texto) &&
        avisos.apontaDaTarefa === "duracao-tarefa-nao-salvo" &&
        avisos.apontaDaSubtarefa === "subtarefa-nao-salvo",
      `duração da TAREFA (sem rascunho): ${JSON.stringify(
        avisos.daTarefa.texto,
      )} · duração da SUBTAREFA (com rascunho): ${JSON.stringify(
        avisos.daSubtarefa.texto,
      )} · aria-describedby: ${JSON.stringify(avisos.apontaDaTarefa)} / ${JSON.stringify(
        avisos.apontaDaSubtarefa,
      )}`,
    );
    const link = pagina.locator('a[href="/tarefa/task-setup"]').first();
    temLink = (await link.count()) >= 1;
    if (temLink) {
      await link.click();
      await pagina.waitForURL("**/tarefa/task-setup", { timeout: 30000 });
      await pagina.waitForSelector("h1");
      await anotarRotaAtual(pagina);
    }
    await pagina.goto(`${BASE}/tarefa/task-build`, { waitUntil: "networkidle" });
    await pagina.waitForSelector("h1");
    await assentar(pagina);
    depoisDaVolta = await campoPorNome(pagina, /^Duração \(dias, p80/)
      .first()
      .inputValue();
  }
  conferir(
    "G · a duração da tarefa volta mostrando o que o BANCO tem, não o rascunho",
    achou && temLink && gravado !== null && gravado.length > 0 && depoisDaVolta === gravado,
    achou
      ? `valor gravado=${JSON.stringify(gravado)} · digitado sem salvar="9.9" · link de saída=${String(
          temLink,
        )} · depois da volta=${JSON.stringify(depoisDaVolta)} (esperado ${JSON.stringify(gravado)})`
      : "o campo de duração da tarefa NÃO existe na página — alvo ausente é reprovação",
  );
  await conferirVigia("V-G", [{ pagina, registroFora }]);
  await contexto.close();
});

// ════════════════════════════════════════════════════════════════════════════
// M · A CORRIDA "SALVAR ÁTOMOS" × "LIMPAR ÁTOMOS" — A TRAVA COMPARTILHADA
//
// [item 10 do crítico da rodada 15] Ele tentou duas vezes e NÃO conseguiu
// provocá-la: com o trio já igual ao confirmado, o 1º clique era recusado por
// `sem_mudanca` e a trava nunca chegava a ser tomada (`P4 POSTs=1`). Declarou,
// com razão, como "não medido por mim" — a trava só tinha teste de unidade
// (`tests/unit/tarefa-trava-de-voo.test.ts`), nunca navegador.
//
// O que faltava era MUDAR o trio antes: sem mudança não há gravação, e sem
// gravação não há corrida. Esta medida muda um dos três átomos, manda salvar
// com o POST pendurado 4 s e, 300 ms depois, manda limpar. As duas portas
// escrevem o MESMO campo, e é para isso que elas partilham uma trava só.
// ════════════════════════════════════════════════════════════════════════════
await medir("M", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-build");
  /*
   * [MÉDIO #4, rodada 18] A PRECONDIÇÃO PRÓPRIA. A falha que o crítico viu —
   * `os botões "Salvar átomos"/"Limpar átomos" NÃO existem nesta tarefa` — não
   * era um defeito: era o estrago da medida E, que estourou no meio depois de
   * limpar os átomos. "Limpar átomos" só existe com átomos declarados.
   * A precondição vem antes da interceptação do POST, pelo mesmo motivo de H.
   */
  const faltaPrecondicao = await precondicaoDaMedida("M", pagina, {
    descricao: 'esta tarefa tem átomos declarados, que é o que faz "Limpar átomos" existir',
    estabelecer: garantirAtomosDeclarados,
    ler: async (alvo) => {
      const salvar = await alvo.getByRole("button", { name: "Salvar átomos" }).count();
      const limpar = await alvo.getByRole("button", { name: "Limpar átomos" }).count();
      return `Salvar átomos=${String(salvar)} · Limpar átomos=${String(limpar)}`;
    },
    esperado: "Salvar átomos=1 · Limpar átomos=1",
  });
  if (faltaPrecondicao !== null) {
    conferir(
      'M · corrida "salvar átomos" × "limpar átomos": a trava compartilhada recusa o 2º, e o score NÃO some',
      false,
      faltaPrecondicao,
    );
    await conferirVigia("V-M", [{ pagina, registroFora }]);
    await contexto.close();
    return;
  }
  let postsAtrasados = 0;
  await pagina.route(`${BASE}/tarefa/task-build`, async (chamada) => {
    if (chamada.request().method() === "POST") {
      postsAtrasados += 1;
      await new Promise((r) => setTimeout(r, 4000));
    }
    await chamada.continue();
  });
  const scoreDe = async () =>
    await pagina.evaluate(
      () => document.body.innerText.match(/assimetria \(A\) = \d+/)?.[0] ?? "(sem score)",
    );
  const antes = await scoreDe();
  // MUDAR o trio é o que abre a corrida: sem mudança a porta recusa por
  // `sem_mudanca` e a trava nunca é tomada (foi onde o crítico parou).
  const grupo = pagina.getByRole("radiogroup", { name: "Opcionalidade" });
  const opcoes = grupo.getByRole("radio");
  const quantas = await opcoes.count();
  let mudou = false;
  for (let i = 0; i < quantas; i += 1) {
    if ((await opcoes.nth(i).getAttribute("aria-checked")) !== "true") {
      await opcoes.nth(i).click();
      mudou = true;
      break;
    }
  }
  const salvar = pagina.getByRole("button", { name: "Salvar átomos" });
  const limpar = pagina.getByRole("button", { name: "Limpar átomos" });
  const temOsDois = (await salvar.count()) === 1 && (await limpar.count()) === 1;
  let recusa = "";
  let depois = "";
  let anuncio = "";
  if (mudou && temOsDois) {
    await salvar.dispatchEvent("click");
    await pagina.waitForTimeout(300);
    await limpar.dispatchEvent("click");
    await pagina.waitForTimeout(400);
    recusa = await lerRegioesVivas(pagina);
    /*
     * A resposta atrasada chega aqui. [MÉDIO, rodada 22] Colhida como estado:
     * TODA frase que passar pelas regiões até a gravação terminar (nenhuma
     * região dizendo "Salvando…" há 1,5 s) — um "Átomos limpos." que aparecer
     * e sumir no meio da janela fica registrado.
     */
    anuncio = await colherAnuncios(pagina, () => true, {
      ate: (textos) =>
        MENSAGEM_GRAVANDO_DO_FONTE !== null &&
        !textos.some((t) => t.includes(MENSAGEM_GRAVANDO_DO_FONTE)),
    });
    depois = await scoreDe();
  }
  conferir(
    'M · corrida "salvar átomos" × "limpar átomos": a trava compartilhada recusa o 2º, e o score NÃO some',
    mudou &&
      temOsDois &&
      postsAtrasados === 1 &&
      /Aguarde/.test(recusa) &&
      !/Átomos limpos/.test(anuncio) &&
      /assimetria \(A\) = \d+/.test(depois),
    temOsDois
      ? `trio mudado=${String(mudou)} · POSTs atrasados=${String(
          postsAtrasados,
        )} (esperado exatamente 1: o "limpar" não pode ter despachado) · recusa do 2º clique=${JSON.stringify(
          recusa,
        )} · anúncio final=${JSON.stringify(anuncio)} · score antes=${JSON.stringify(
          antes,
        )} · score depois=${JSON.stringify(depois)}`
      : 'os botões "Salvar átomos"/"Limpar átomos" NÃO existem nesta tarefa — alvo ausente é reprovação',
  );
  await conferirVigia("V-M", [{ pagina, registroFora }]);
  await contexto.close();
});

// ════════════════════════════════════════════════════════════════════════════
// J · AS SENTINELAS DE TEMPO REAL — UMA POR ROTA, ALCANCE MEDIDO E IMPRESSO
//
// Elas foram abertas antes da medida A e, desde então, só EXISTIRAM. A
// pergunta é a desta família na forma mais crua: **em algum momento da vida
// desta guarda, alguma coisa mexeu no contrato de algum campo DESTA ROTA,
// neste estado?** O tempo de vida é o alcance, e sai impresso.
// ════════════════════════════════════════════════════════════════════════════
for (const sentinela of SENTINELAS.filter((x) => !x.comRelogioDeMentira)) {
  await medir(`J ${sentinela.rota}`, async () => {
    const relato = await auditarPagina(sentinela);
    const vida = Date.now() - sentinela.nascimento;
    const problemas = problemasDoRelato(relato);
    // [ALTO #3, rodada 18] o CONTEÚDO dos campos também é contrato.
    const agora = await sentinela.pagina.evaluate(LER_CAMPOS);
    problemas.push(...mudancasNosCampos(sentinela.camposAoNascer, agora));
    const comValor = camposComValor(agora);
    if (comValor < PISO_DE_CAMPOS_COM_VALOR) {
      problemas.push(
        `só ${String(comValor)} campo(s) com valor na sentinela, piso escrito à mão ${String(
          PISO_DE_CAMPOS_COM_VALOR,
        )} — sem valor digitado, "nada mudou" é só o eco de dois vazios`,
      );
    }
    if (vida < PISO_DE_VIDA_DA_SENTINELA) {
      problemas.push(
        `a sentinela viveu ${String(Math.round(vida / 1000))}s, menos que o piso declarado de ${String(
          Math.round(PISO_DE_VIDA_DA_SENTINELA / 1000),
        )}s — o alcance encolheu`,
      );
    }
    /*
     * [ALTO #1, rodada 19] E AGORA ELA USA A PÁGINA, em vez de só olhar.
     * Por último, de propósito: a comparação acima é sobre a aba INTOCADA, e a
     * escrita muda um campo. Alcance desta metade: a aba viva há `vida` ms, em
     * tempo REAL (piso garantido, não torcido — ver `exercerEscritaDaSentinela`).
     */
    const escrita = await exercerEscritaDaSentinela(sentinela);
    problemas.push(...escrita.problemas);
    conferir(
      `J · ${sentinela.rota} — a sentinela de tempo real: nada mexeu no contrato em toda a vida da guarda`,
      problemas.length === 0,
      `viveu ${String(
        Math.round(vida / 1000),
      )}s — este é o ALCANCE DE TEMPO desta guarda NESTA ROTA, e mutação agendada para depois dele NÃO é vista (piso: ${String(
        Math.round(PISO_DE_VIDA_DA_SENTINELA / 1000),
      )}s) · estados revelados: ${sentinela.revelados.join(", ") || "(nenhum)"} · ${String(
        sentinela.exercidos,
      )} campo(s) EXERCIDOS (foco + ${String(
        EVENTOS_EXERCIDOS.length,
      )} eventos) · ${String(sentinela.preenchidos)} campo(s) PREENCHIDOS pela sentinela, ${String(
        comValor,
      )} com valor agora (piso ${String(
        PISO_DE_CAMPOS_COM_VALOR,
      )}) — o que ela digitou continua lá · ${escrita.resumo} · ${resumoDoRelato(
        relato,
      )}${problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`}`,
    );
  });
}

// ════════════════════════════════════════════════════════════════════════════
// K · AS SENTINELAS DO RELÓGIO — MEIA HORA DE UMA VEZ, UMA POR ROTA
//
// Adianta o relógio de cada página sentinela e pergunta ao vigia o que
// aconteceu. É esta família que fecha o `setTimeout` de 60 s sem esperar 60 s
// — e desde a rodada 15 ela o fecha em TODAS as rotas que a guarda visita, e
// não só em `/tarefa/task-docs`.
// ════════════════════════════════════════════════════════════════════════════
for (const sentinela of SENTINELAS.filter((x) => x.comRelogioDeMentira)) {
  await medir(`K ${sentinela.rota}`, async () => {
    await sentinela.pagina.clock.fastForward(ADIANTAMENTO_DO_RELOGIO);
    // Dois quadros para o React processar o que os temporizadores dispararam.
    await assentar(sentinela.pagina);
    /*
     * [ALTO #2, rodada 16] E o exercício DE NOVO, depois do adiantamento: um
     * handler que só passa a existir com o tempo (instalado por um
     * `setTimeout` que acabou de disparar) só se manifesta se alguém tocar no
     * campo outra vez. Adiantar o relógio e não tocar em nada mediria o
     * primeiro caso e não o segundo.
     */
    const exercidosDepois = await exercitarCampos(sentinela.pagina);
    await assentar(sentinela.pagina);
    await sentinela.pagina.clock.fastForward(ADIANTAMENTO_DO_RELOGIO);
    await assentar(sentinela.pagina);
    const relato = await auditarPagina(sentinela);
    const contrato = await sentinela.pagina.evaluate(LER_CAMPOS);
    const foraDaReguaNoDom = contrato.filter(
      (c) => c.type === "number" || c.atributoType === "number",
    );
    const problemas = problemasDoRelato(relato);
    /*
     * [ALTO #3, rodada 18] O VALOR, DEPOIS DE UMA HORA DE RELÓGIO.
     *
     * É aqui que o `setTimeout` de 90 s que apaga a duração morre: ele dispara
     * dentro do adiantamento, e o campo volta vazio. Antes, K olhava `type` e
     * `inputMode` — as duas propriedades que aquela sabotagem não toca.
     */
    problemas.push(...mudancasNosCampos(sentinela.camposAoNascer, contrato));
    const comValor = camposComValor(contrato);
    if (comValor < PISO_DE_CAMPOS_COM_VALOR) {
      problemas.push(
        `só ${String(comValor)} campo(s) com valor depois do adiantamento, piso escrito à mão ${String(
          PISO_DE_CAMPOS_COM_VALOR,
        )} — o que a sentinela digitou tem de continuar lá`,
      );
    }
    if (contrato.length < PISO_DE_CAMPOS_POR_ROTA) {
      problemas.push(
        `só ${String(contrato.length)} campo(s) no DOM depois do adiantamento (piso escrito à mão: ${String(
          PISO_DE_CAMPOS_POR_ROTA,
        )}) — alvo ausente é reprovação`,
      );
    }
    if (exercidosDepois < PISO_DE_CAMPOS_POR_ROTA) {
      problemas.push(
        `só ${String(exercidosDepois)} campo(s) exercidos DEPOIS do adiantamento (piso: ${String(
          PISO_DE_CAMPOS_POR_ROTA,
        )}) — um handler que nasce com o tempo não teria quem o acordasse`,
      );
    }
    if (foraDaReguaNoDom.length > 0) {
      problemas.push(
        `${String(foraDaReguaNoDom.length)} campo(s) com type=number: ${foraDaReguaNoDom
          .map((c) => `"${c.nome.slice(0, 30)}"`)
          .join(", ")}`,
      );
    }
    /*
     * [ALTO #1, rodada 19] A AÇÃO, DEPOIS DE UMA HORA DE RELÓGIO.
     *
     * É aqui que morre a armadilha que não toca em campo nenhum: um
     * `setTimeout` que arma um `return` no `onSubmit` dispara dentro dos dois
     * adiantamentos, e o clique em "Salvar duração" vira enfeite. Nenhuma
     * fotografia de campo vê isso — só usar a página vê.
     *
     * Alcance desta metade, por escrito: a vida real da aba MAIS duas meia
     * horas de relógio sob controle da guarda. Uma hora de atraso, e nada além.
     */
    const escrita = await exercerEscritaDaSentinela(sentinela);
    problemas.push(...escrita.problemas);
    conferir(
      `K · ${sentinela.rota} — relógio adiantado meia hora: nenhum temporizador mexeu no contrato`,
      problemas.length === 0,
      `relógio adiantado ${String(
        Math.round(ADIANTAMENTO_DO_RELOGIO / 60000),
      )} min de uma vez, DUAS vezes, com os campos exercidos entre elas — atraso ATÉ ISSO está no alcance desta guarda NESTA ROTA · estados revelados: ${
        sentinela.revelados.join(", ") || "(nenhum)"
      } · ${String(contrato.length)} campos no DOM depois do adiantamento · ${String(
        exercidosDepois,
      )} exercidos depois dele · ${String(
        comValor,
      )} com o valor que a sentinela digitou ainda lá (piso ${String(
        PISO_DE_CAMPOS_COM_VALOR,
      )}) · ${escrita.resumo}, depois de ${String(
        Math.round((ADIANTAMENTO_DO_RELOGIO * 2) / 60000),
      )} min de relógio adiantado — é ESTE o alcance de tempo da medida de AÇÃO nesta rota · ${resumoDoRelato(
        relato,
      )}${problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`}`,
    );
  });
}

/*
 * ═══════════════════════════════════════════════════════ ALTO #1, rodada 19 ═
 * O PISO DAS ESCRITAS EXERCIDAS — a 2ª forma viciada ("aprova por ausência")
 * esperando a próxima rodada.
 *
 * A escrita é cobrada dentro de cada J e de cada K. Apagar as duas chamadas
 * deixaria as seis medidas verdes: "nenhum problema de escrita" e "nenhuma
 * escrita" combinam. Aqui o número é contado fora delas, e o piso é escrito à
 * mão: três rotas × dois relógios.
 */
await medir("J-escrita", async () => {
  conferir(
    "J-escrita · toda sentinela EXERCEU a escrita no fim da vida, e o valor pedido chegou à loja",
    SENTINELAS_QUE_ESCREVERAM >= PISO_DE_ESCRITAS_DE_SENTINELA,
    `${String(
      SENTINELAS_QUE_ESCREVERAM,
    )} sentinela(s) digitaram, salvaram e tiveram o valor conferido na loja, piso escrito à mão ${String(
      PISO_DE_ESCRITAS_DE_SENTINELA,
    )} (${String(SENTINELAS.length)} sentinelas = ${String(
      ROTAS_COM_SENTINELA.length,
    )} rota(s) × relógio de verdade e relógio da guarda) — sentinela que só OLHA nunca descobre que o botão parou de funcionar`,
  );
});

// ════════════════════════════════════════════════════════════════════════════
// L · O ALCANCE DE TEMPO COBRE TUDO O QUE A GUARDA VISITA
//
// [CRÍTICO #1, rodada 15] É a medida que impede a afirmação de voltar a valer
// para menos do que ela diz. Duas perguntas, as duas sobre o MEDIDO:
//
//  1. toda rota que a guarda abriu ou navegou tem sentinela? (rota visitada
//     sem sentinela = alcance de tempo zero ali, exatamente o buraco pelo
//     qual o setter restrito a `task-build` passou);
//  2. a sentinela de cada rota mostra pelo menos tantos campos quanto a maior
//     leitura que a guarda fez naquela rota? (estado escondido atrás de um
//     clique é tão fora de alcance quanto rota não visitada).
// ════════════════════════════════════════════════════════════════════════════
await medir("L", async () => {
  const comSentinela = new Set(SENTINELAS.map((x) => x.rota));
  const semSentinela = [...ROTAS_VISITADAS].filter((r) => !comSentinela.has(r));
  const camposDaSentinela = new Map();
  const exercidosDaSentinela = new Map();
  for (const sentinela of SENTINELAS) {
    const estado = await estadoDaPagina(sentinela.pagina);
    const quantos = estado === null ? -1 : estado.campos;
    const antes = camposDaSentinela.get(sentinela.rota) ?? -1;
    // A MENOR das duas sentinelas da rota manda: basta uma cega para o
    // alcance daquele estado não existir.
    camposDaSentinela.set(sentinela.rota, antes === -1 ? quantos : Math.min(antes, quantos));
    const exAntes = exercidosDaSentinela.get(sentinela.rota) ?? -1;
    exercidosDaSentinela.set(
      sentinela.rota,
      exAntes === -1 ? sentinela.exercidos : Math.min(exAntes, sentinela.exercidos),
    );
  }
  const comEstadoAMenos = [];
  for (const [rota, vistos] of CAMPOS_VISTOS_POR_ROTA) {
    const naSentinela = camposDaSentinela.get(rota);
    if (naSentinela === undefined) continue;
    if (naSentinela < vistos) {
      comEstadoAMenos.push(
        `${rota}: a guarda viu ${String(vistos)} campos, a sentinela mostra ${String(naSentinela)}`,
      );
    }
  }
  /*
   * ══════════════════════════════════════════════════════════ ALTO #2, rodada 16 ═
   * O PISO QUE NÃO VEM DE NENHUMA DAS DUAS LEITURAS.
   *
   * As duas comparações acima ("a sentinela mostra pelo menos o que a guarda
   * viu") são entre duas leituras que podem encolher JUNTAS — e foi
   * exatamente isso que aconteceu com o foco: nem a guarda o exercia, nem a
   * sentinela, e as duas concordavam em zero. Concordância entre dois lados
   * que encolhem juntos é eco, não piso.
   *
   * O piso de verdade é um número escrito à mão, fora das duas
   * (`PISO_DE_CAMPOS_POR_ROTA`), cobrado de TRÊS coisas: quantos campos a
   * sentinela mostra, quantos ela EXERCEU (foco + a bateria de eventos) e
   * quantos a guarda viu naquela rota. Encolher qualquer um dos três exige
   * baixar o número no diff.
   */
  const abaixoDoPiso = [];
  for (const rota of comSentinela) {
    const mostra = camposDaSentinela.get(rota) ?? -1;
    const exerceu = exercidosDaSentinela.get(rota) ?? -1;
    if (mostra < PISO_DE_CAMPOS_POR_ROTA) {
      abaixoDoPiso.push(
        `${rota}: a sentinela mostra ${String(mostra)} campo(s), piso ${String(
          PISO_DE_CAMPOS_POR_ROTA,
        )}`,
      );
    }
    if (exerceu < PISO_DE_CAMPOS_POR_ROTA) {
      abaixoDoPiso.push(
        `${rota}: a sentinela EXERCEU ${String(exerceu)} campo(s), piso ${String(
          PISO_DE_CAMPOS_POR_ROTA,
        )} — campo não exercido é campo cujo handler nunca correu`,
      );
    }
  }
  for (const [rota, vistos] of CAMPOS_VISTOS_POR_ROTA) {
    if (vistos < PISO_DE_CAMPOS_POR_ROTA) {
      abaixoDoPiso.push(
        `${rota}: a guarda só viu ${String(vistos)} campo(s), piso ${String(
          PISO_DE_CAMPOS_POR_ROTA,
        )} — os dois lados encolheram juntos`,
      );
    }
  }
  /** Sentinela que mostra campo e não o exerce é o buraco do ALTO #2 inteiro. */
  const semExercicioCompleto = [];
  /** [ALTO #3, rodada 18] e sentinela que não DIGITA não tem valor a perder. */
  const semPreenchimentoCompleto = [];
  for (const sentinela of SENTINELAS) {
    const estado = await estadoDaPagina(sentinela.pagina);
    const mostra = estado === null ? -1 : estado.campos;
    if (sentinela.exercidos < mostra) {
      semExercicioCompleto.push(
        `${sentinela.rota}${sentinela.comRelogioDeMentira ? " (relógio)" : ""}: mostra ${String(
          mostra,
        )} campo(s) e exerceu ${String(sentinela.exercidos)}`,
      );
    }
    if (sentinela.preenchidos < Math.max(mostra, PISO_DE_CAMPOS_COM_VALOR)) {
      semPreenchimentoCompleto.push(
        `${sentinela.rota}${sentinela.comRelogioDeMentira ? " (relógio)" : ""}: mostra ${String(
          mostra,
        )} campo(s) e preencheu ${String(sentinela.preenchidos)} (piso ${String(
          PISO_DE_CAMPOS_COM_VALOR,
        )})`,
      );
    }
  }
  const problemas = [];
  if (ROTAS_VISITADAS.size === 0) problemas.push("nenhuma rota registrada — a medida não mediu");
  if (semSentinela.length > 0) {
    problemas.push(`rota(s) visitada(s) SEM sentinela: ${semSentinela.join(", ")}`);
  }
  if (comEstadoAMenos.length > 0) {
    problemas.push(`sentinela com menos estado do que a guarda visitou: ${comEstadoAMenos.join(" · ")}`);
  }
  if (abaixoDoPiso.length > 0) {
    problemas.push(`ABAIXO DO PISO escrito à mão: ${abaixoDoPiso.join(" · ")}`);
  }
  if (semExercicioCompleto.length > 0) {
    problemas.push(`sentinela que mostra campo e NÃO o exerce: ${semExercicioCompleto.join(" · ")}`);
  }
  if (semPreenchimentoCompleto.length > 0) {
    problemas.push(
      `sentinela que mostra campo e NÃO digita nele: ${semPreenchimentoCompleto.join(
        " · ",
      )} — campo vazio não tem valor que uma mutação agendada possa apagar`,
    );
  }
  conferir(
    "L · o alcance de tempo cobre TODAS as rotas, estados, campos EXERCIDOS e campos PREENCHIDOS que a guarda visita",
    problemas.length === 0,
    `${String(ROTAS_VISITADAS.size)} rota(s) visitada(s): ${[...ROTAS_VISITADAS].join(
      ", ",
    )} · ${String(SENTINELAS.length)} sentinela(s) em ${String(
      comSentinela.size,
    )} rota(s) · piso escrito à mão: ${String(
      PISO_DE_CAMPOS_POR_ROTA,
    )} campos por rota · campos por rota — visto pela guarda: ${[...CAMPOS_VISTOS_POR_ROTA]
      .map(([r, n]) => `${r}=${String(n)}`)
      .join(" ")} · na sentinela: ${[...camposDaSentinela]
      .map(([r, n]) => `${r}=${String(n)}`)
      .join(" ")} · EXERCIDOS pela sentinela: ${[...exercidosDaSentinela]
      .map(([r, n]) => `${r}=${String(n)}`)
      .join(" ")} · PREENCHIDOS pela sentinela: ${SENTINELAS.map(
      (x) => `${x.rota}${x.comRelogioDeMentira ? "(relógio)" : ""}=${String(x.preenchidos)}`,
    ).join(" ")}${problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`}`,
  );
});

/*
 * [ALTO #1, rodada 20] AS SENTINELAS NÃO SE FECHAM MAIS AQUI. A família N,
 * mais abaixo, exerce as QUINZE ações de escrita da página nestas mesmas abas
 * envelhecidas — fechá-las aqui era fechar o único lugar onde uma aba velha
 * ainda existe nesta corrida. Elas são fechadas depois da medida N0.
 */

// ════════════════════════════════════════════════════════════════════════════
// Q0 · TODA MEDIDA QUE MEXE NA LOJA DECLAROU E CONFERIU A PRÓPRIA PRECONDIÇÃO
//
// [MÉDIO #4, rodada 18] A lista abaixo é escrita À MÃO, pela mesma lei de
// `MEDIDAS_EXIGIDAS` e de `ROTAS_COM_SENTINELA`: apagar a precondição de uma
// medida passa a exigir apagá-la daqui também, no mesmo diff. Sem esta medida,
// a disciplina toda sumiria em silêncio — some a checagem, some quem a cobrava,
// e a guarda volta a relatar o estrago de uma medida como defeito de outra.
// ════════════════════════════════════════════════════════════════════════════
const MEDIDAS_COM_PRECONDICAO = ["A+B", "C", "D", "E", "E2", "E3", "E4", "F", "G", "H", "I", "M"];

await medir("Q0", async () => {
  const semPrecondicao = MEDIDAS_COM_PRECONDICAO.filter((m) => !PRECONDICOES_CONFERIDAS.has(m));
  const aMais = [...PRECONDICOES_CONFERIDAS].filter((m) => !MEDIDAS_COM_PRECONDICAO.includes(m));
  const problemas = [];
  if (semPrecondicao.length > 0) {
    problemas.push(
      `medida(s) que deviam declarar precondição própria e não declararam: ${semPrecondicao.join(
        ", ",
      )}`,
    );
  }
  if (aMais.length > 0) {
    problemas.push(
      `medida(s) que declararam precondição e não estão na lista escrita à mão: ${aMais.join(
        ", ",
      )} — a lista é o que torna a disciplina visível no diff`,
    );
  }
  conferir(
    "Q0 · toda medida que mexe na loja declarou e conferiu a PRÓPRIA precondição",
    problemas.length === 0,
    `${String(PRECONDICOES_CONFERIDAS.size)} medida(s) com precondição conferida: ${[
      ...PRECONDICOES_CONFERIDAS,
    ].join(", ")} · lista escrita à mão (${String(
      MEDIDAS_COM_PRECONDICAO.length,
    )}): ${MEDIDAS_COM_PRECONDICAO.join(", ")}${
      problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`
    }`,
  );
});

// ════════════════════════════════════════════════════════════════════════════
// P · A PERSISTÊNCIA, DERIVADA DA LISTA CANÔNICA DAS OPERAÇÕES
//
// [ALTOS #1 e #3, rodada 16] A GUARDA NUNCA PERGUNTAVA SE O QUE O OPERADOR
// PEDIU CHEGOU AO BANCO. O universo saiu de `OPERACOES_DE_ESCRITA`
// (`src/app/tarefa/pedido.ts`, lido do fonte) e a régua passou a ser: pedir um
// valor DIFERENTE do atual, recarregar, e exigir o valor PEDIDO.
//
// ── rodada 17 ────────────────────────────────────────────────────────────────
// O crítico derrubou essa versão com DUAS sabotagens de uma linha, as duas com
// os cinco portões e as 50 medidas verdes:
//
//   1. **ALCANCE.** `statusSetFixture` gravando também `estimativaDias: null`
//      ("ao mudar o status, a estimativa antiga não vale mais"). A família P
//      perguntava "o valor que pedi voltou?", **uma op por vez, cada uma lendo
//      só o seu próprio campo** — nenhuma perguntava "e o resto continua como
//      estava?". Pior: a guarda IMPRIMIU o apagamento e chamou de `ok`:
//
//        base: ok P · duracao · … antes="2"  · PEDIDO="3" · depois do F5="3"
//        sab:  ok P · duracao · … antes=""   · PEDIDO="4" · depois do F5="4"
//
//      `P · status` roda antes, na mesma rota e no mesmo store; apagou a
//      duração; e `P · duracao` leu a PRÓPRIA PRECONDIÇÃO JÁ ESTRAGADA,
//      recalculou o pedido a partir dela (`atual + 1`), gravou, releu e disse
//      ok. Era o universo por convenção outra vez — agora aplicado ao
//      **alcance da escrita**: um campo, por convenção.
//
//   2. **CLASSE.** `estimativaSetFixture` devolvendo `{ ok: true }` sem gravar
//      quando o número tem casa decimal. As três medidas que tocam a duração
//      passaram: `C` só testa a recusa de `2e`; `G` digita `9.9` e **não
//      salva**; e `P · duracao` pedia `atual + 1` — sempre inteiro, e o
//      fallback (`4`) também. **Nenhuma das 15 conferências gravava um número
//      fracionário em lugar nenhum**, e `1.5` é um valor que a própria tela
//      PEDE ("com ponto ou vírgula no decimal (ex.: 1.5 ou 1,5)"), numa coluna
//      `numeric(6,2)`. Era conferir o caso, não a classe.
//
//   3. **ANÚNCIO.** O anúncio da tela era capturado, impresso dentro de
//      `extra` e **nunca comparado com o que foi gravado**. Onde o texto é
//      alternativo (`/Duração (salva|removida)\./`,
//      `/Tarefa mãe (atualizada|removida)\./`, `/(Marcada como meta|Meta
//      removida)\./`), a guarda aceitava **os dois desfechos opostos da mesma
//      escrita**.
//
// ── as três respostas, e elas são estruturais ────────────────────────────────
//
// **1. Toda escrita tem ALCANCE CONFERIDO.** Antes e depois de cada medida, a
// guarda tira uma FOTOGRAFIA do estado inteiro (`/api/tarefa/estado`, o mesmo
// `carregarEstado()` que a página usa) e derruba a medida se mudou qualquer
// coisa fora do que aquela op declarou. A fotografia é DERIVADA: as chaves
// saem de `Object.keys` de cada entidade, não de uma lista de campos escrita à
// mão — campo novo no modelo entra na conferência sozinho. O que muda
// legitimamente junto entra como exceção DECLARADA, com motivo escrito (hoje,
// em modo fixture, nenhuma op tem exceção desse tipo: nenhum mutador mexe em
// `updatedAt`).
//
// E ela é da LOJA INTEIRA, não da tarefa aberta — de propósito. O ataque que o
// crítico nomeou e não tentou (uma op que grava o valor certo na tarefa aberta
// e, no mesmo ato, estraga um VIZINHO do grafo: a mãe, a subtarefa recém-criada,
// o destino da relação) cai aqui junto, porque o vizinho está na fotografia
// mesmo sem nenhuma medida visitar a página dele.
//
// **2. Nenhuma medida P herda o estrago de outra.** Cada op declara e ESCREVE
// a própria precondição, e a confere depois do F5 antes de medir: se a
// precondição não for a esperada, a medida REPROVA — nunca se adapta a ela em
// silêncio, que foi exatamente o que aconteceu com `atual + 1`. E o alcance é
// conferido nos DOIS intervalos (antes→precondição e precondição→fim), senão
// uma sabotagem que estraga durante a preparação ficaria escondida atrás do
// saldo.
//
// **3. O valor pedido é uma CLASSE derivada do contrato do campo.** Para a
// duração, as grafias decimais saem da própria frase de recusa do servidor
// (`actions.ts`), o número de casas sai de `ESTIMATIVA_CASAS_MAX` e a borda de
// baixo sai de `DURACAO_MINIMA_DIAS` — se a tela promete ponto E vírgula, a
// classe tem os dois. A subtarefa, que tem o mesmo campo, grava um fracionário
// também, e a conferência lê o que ficou na loja.
//
// **4. O anúncio entra no veredito.** Cada op declara a frase EXATA que aquele
// desfecho tem de produzir e as frases do desfecho OPOSTO que o proíbem. Dizer
// "removida" depois de gravar, ou "salva" depois de apagar, passa a ser
// vermelho.
// ════════════════════════════════════════════════════════════════════════════

/*
 * ═══════════════════════════════════════════════════════ BAIXO #7, rodada 18 ═
 * O UNIVERSO DAS ESCRITAS ERA UM REGEX QUE ENGOLIA NOME COM DÍGITO.
 *
 * A leitura antiga era `/"([a-z_]+)"/g` sobre o bloco de `OPERACOES_DE_ESCRITA`.
 * Uma operação chamada `atomos_v2` — ou `notaCriar` — simplesmente NÃO casava,
 * e sumia do universo. E, como `PISO_DE_OPS_CONFERIDAS` era exatamente a
 * contagem de hoje (15), P0 não acusava nem a falta da linha na tabela nem o
 * piso: o universo encolhia e a régua encolhia junto.
 *
 * **Qual das cinco formas é esta: a 3ª — "universo por convenção", com cara de
 * derivação.** Ler do fonte parece derivar; derivar com uma peneira que não
 * aceita a classe inteira dos nomes possíveis é convenção escrita em regex.
 *
 * Três consertos, e eles se cobrem:
 *
 *  1. **a expressão passa a ser permissiva** (`"([^"\n]+)"`): ela aceita
 *     qualquer nome entre aspas, com dígito, maiúscula ou hífen;
 *  2. **são DUAS leituras independentes do mesmo arquivo** — o array
 *     `OPERACOES_DE_ESCRITA` e a união de tipo `OperacaoDeEscrita` — e P0
 *     reprova se elas discordarem. Nome que suma de uma e fique na outra é
 *     reprovação com o nome impresso;
 *  3. **o piso deixa de ser o único fecho**: P0 passa a exigir que TODA op do
 *     universo tenha conferência (`conferidas.length === OPS_DA_PAGINA.length`),
 *     e não só que o número não caia abaixo de 15.
 *
 * O comentário é retirado das duas leituras antes de contar, porque a união de
 * tipo tem um JSDoc com `"Limpar átomos"` e `"Desfazer"` entre aspas — sem
 * isso, a leitura "permissiva" inventaria duas operações que não existem.
 */

/** O fonte sem comentário nenhum — texto de comentário não é declaração. */
function semComentarios(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/** Toda cadeia entre aspas de um pedaço de fonte — permissiva de propósito. */
function aspasDe(texto) {
  return [...texto.matchAll(/"([^"\n]+)"/g)].map((m) => m[1]);
}

function fonteDoPedido() {
  return semComentarios(
    readFileSync(join(RAIZ_DO_PACOTE, "src", "app", "tarefa", "pedido.ts"), "utf8"),
  );
}

/** A lista canônica das escritas da página, pelo ARRAY — lida do fonte. */
function opsDaPagina() {
  const bloco = /OPERACOES_DE_ESCRITA[^=]*=\s*\[([\s\S]*?)\];/.exec(fonteDoPedido());
  return bloco === null ? [] : aspasDe(bloco[1] ?? "");
}

/** O MESMO universo pela união de tipo — segunda leitura, independente. */
function opsDaUniaoDeTipo() {
  const bloco = /export type OperacaoDeEscrita =([\s\S]*?);/.exec(fonteDoPedido());
  return bloco === null ? [] : aspasDe(bloco[1] ?? "");
}

const OPS_DA_PAGINA = opsDaPagina();
const OPS_DA_UNIAO_DE_TIPO = opsDaUniaoDeTipo();

/** O piso de operações conferidas — escrito à mão. Zero nunca é sucesso. */
const PISO_DE_OPS_CONFERIDAS = 15;

/**
 * Um grupo segmentado do produto, lido do fonte: `{ valor, rotulo }`.
 *
 * É daqui que saem a CLASSE DOS STATUS (ALTO #1 desta rodada) e a CLASSE DOS
 * TIPOS DE RELAÇÃO (ALTO #2): as duas eram "o caso", não "a classe" — a guarda
 * exercia um status de quatro e uma natureza de relação de quatro.
 */
function opcoesSegmentadasDoFonte(arquivo, nome) {
  const src = semComentarios(
    readFileSync(join(RAIZ_DO_PACOTE, "src", "components", "task", arquivo), "utf8"),
  );
  const bloco = new RegExp(`const ${nome}[^=]*=\\s*\\[([\\s\\S]*?)\\];`).exec(src);
  if (bloco === null) return [];
  return [
    ...(bloco[1] ?? "").matchAll(/\{\s*valor:\s*"([^"]+)",\s*rotulo:\s*"([^"]+)"\s*\}/g),
  ].map((m) => ({ valor: m[1], rotulo: m[2] }));
}

/**
 * ═══════════════════════════════════════════════════════ ALTO #1, rodada 18 ═
 * `bloqueada` ERA O ÚNICO STATUS QUE NINGUÉM MEDIA.
 *
 * O grupo tem quatro opções (`status-form.tsx`): aberta · em progresso ·
 * bloqueada · concluída. A guarda exercia três, e a única vez em que
 * `bloqueada` era clicada (medida D) o clique era exigido como **recusado**.
 * `blocked` nunca chegava ao store por caminho nenhum — nem no navegador, nem
 * nos testes de unidade, que só exercem `"done"`.
 *
 * **Qual das cinco formas: a 5ª — "confere o caso, não a classe".** Sabotagem
 * que passava: `status: status === "blocked" ? "done" : status` no despacho.
 * A tela anunciava "Status atualizado para bloqueada.", o banco guardava
 * `done`, e depois do F5 a tarefa aparecia concluída — fora do caminho crítico
 * e fora da lista de acionáveis.
 *
 * A classe sai do fonte do produto, o piso é escrito à mão e fora da leitura,
 * e `P · status` percorre TODAS as opções que não são a de partida.
 */
const CLASSE_DO_STATUS = opcoesSegmentadasDoFonte("status-form.tsx", "OPCOES");

/** Piso escrito à mão: quatro status. Encolher a classe aparece no diff. */
const PISO_DE_STATUS = 4;

/**
 * ══════════════════════════════════════════════════════ ALTO #2b, rodada 18 ═
 * TRÊS DAS QUATRO NATUREZAS DE RELAÇÃO NUNCA TIVERAM PERSISTÊNCIA CONFERIDA.
 *
 * `criarRelacaoMarcada` escolhia SEMPRE "correlação" — a única das quatro que
 * não tem desconto. Resultado: `peso`, o único número do formulário de
 * relação, não era conferido por medida nenhuma, e a sabotagem `peso: 1` no
 * store passava verde com "Relação criada." na tela e o EXTREMO OPOSTO da
 * escala entrando na conta do HIERARQ.
 *
 * Mesma forma do ALTO #1: a 5ª. A classe sai do fonte, o piso é à mão.
 */
const CLASSE_DE_TIPOS_DE_RELACAO = opcoesSegmentadasDoFonte("relacoes-painel.tsx", "OPCOES_TIPO");

/** Piso escrito à mão: quatro naturezas de relação. */
const PISO_DE_TIPOS_DE_RELACAO = 4;

/**
 * O desconto que a guarda digita numa sinergia.
 *
 * Escolhido para NÃO ser nenhum dos dois valores que uma falha silenciosa
 * produziria: não é `0.5` (o que o formulário já traz na caixa, então "o campo
 * nunca foi lido" não passa) e não é `1` (o neutro que o servidor grava quando
 * o campo não chega, que é exatamente a sabotagem do ALTO #2b).
 */
const DESCONTO_PEDIDO = "0.25";

const ROTA_DOCS = "/tarefa/task-docs";
const ROTA_BUILD = "/tarefa/task-build";
/** O id da tarefa de cada rota, derivado da própria rota. */
const ID_DOCS = ROTA_DOCS.slice(ROTA_DOCS.lastIndexOf("/") + 1);
const ID_BUILD = ROTA_BUILD.slice(ROTA_BUILD.lastIndexOf("/") + 1);

/** Marcadores desta corrida — nenhum fixture os tem, e eles atravessam o F5. */
function marcador(prefixo) {
  return `${prefixo}-${Math.random().toString(36).slice(2, 10)}`;
}

// ════════════════════════════════ A FOTOGRAFIA DO ESTADO (ALTO #1, rodada 17) ═

/*
 * [ALTO #1, rodada 19] As duas constantes da fotografia moram AQUI, e não mais
 * junto da família P: a escrita que as sentinelas exercem (medidas J e K) lê a
 * loja pela mesma `fotografia()`, e J roda muito antes de P. Declaradas lá
 * embaixo, elas ainda estavam na zona morta quando J chamava — e as seis
 * sentinelas reprovavam com `Cannot access … before initialization`, que é uma
 * reprovação honesta e inútil. Medido nesta rodada, e corrigido movendo a
 * declaração, nunca afrouxando a medida.
 */
/**
 * O estado INTEIRO, como um mapa `coleção/id` → (campo → valor serializado).
 *
 * Os nomes dos campos saem de `Object.keys` de cada entidade: **derivada, não
 * uma lista escrita à mão**. Campo novo no modelo canônico entra aqui sozinho,
 * e passa a ser conferido sozinho.
 */
async function fotografia() {
  const r = await comTeto(
    fetch(`${BASE}/api/tarefa/estado`, { signal: globalThis.AbortSignal.timeout(20000) }),
    25000,
    "a fotografia do estado",
  );
  if (!r.ok) throw new Error(`/api/tarefa/estado respondeu ${String(r.status)}`);
  const bruto = await r.json();
  const foto = new Map();
  for (const colecao of COLECOES_DA_FOTOGRAFIA) {
    const lista = bruto[colecao];
    if (!Array.isArray(lista)) {
      throw new Error(`a fotografia não trouxe a coleção "${colecao}" — universo incompleto`);
    }
    for (const item of lista) {
      const campos = new Map();
      for (const nome of Object.keys(item)) campos.set(nome, JSON.stringify(item[nome]));
      foto.set(`${colecao}/${String(item.id)}`, campos);
    }
  }
  if (foto.size < PISO_DA_FOTOGRAFIA) {
    throw new Error(
      `a fotografia trouxe só ${String(foto.size)} entidade(s), piso escrito à mão ${String(
        PISO_DA_FOTOGRAFIA,
      )} — fotografia vazia aprovaria qualquer coisa`,
    );
  }
  return foto;
}

/** O que mudou entre duas fotografias — entidades nascidas, mortas e campos. */
function diferenca(antes, depois) {
  const criadas = [...depois.keys()].filter((c) => !antes.has(c));
  const removidas = [...antes.keys()].filter((c) => !depois.has(c));
  const campos = [];
  for (const [chave, camposAntes] of antes) {
    const camposDepois = depois.get(chave);
    if (camposDepois === undefined) continue;
    for (const nome of new Set([...camposAntes.keys(), ...camposDepois.keys()])) {
      const a = camposAntes.get(nome) ?? "(ausente)";
      const b = camposDepois.get(nome) ?? "(ausente)";
      if (a !== b) campos.push({ chave: `${chave}/${nome}`, de: a, para: b });
    }
  }
  return { criadas, removidas, campos };
}

function colecaoDe(chave) {
  return chave.slice(0, chave.indexOf("/"));
}

/** O id de uma entidade, a partir da chave `coleção/id` da fotografia. */
function idDe(chave) {
  return chave.slice(chave.indexOf("/") + 1);
}

/** Os campos de uma entidade da fotografia, como objeto simples. */
function camposDe(foto, chave) {
  const campos = foto.get(chave);
  return campos === undefined ? null : Object.fromEntries(campos);
}

/** A primeira entidade de uma coleção cujo campo bate com o valor esperado. */
function acharNaFoto(foto, colecao, campo, valorJson) {
  for (const [chave, campos] of foto) {
    if (colecaoDe(chave) !== colecao) continue;
    if (campos.get(campo) === valorJson) return chave;
  }
  return null;
}

/**
 * [ALTO #2, rodada 18] A FONTE "NOTAS", DERIVADA — não escrita à mão.
 *
 * Toda subtarefa criada nesta página nasce com o `sourceId` da fonte cujo
 * `kind` é `notes`. Aquele id é um uuid derivado por hash: copiá-lo para dentro
 * da guarda seria trazer de volta a grafia literal de que esta peça já saiu
 * três vezes. Ele sai da própria fotografia, da coleção `sources`.
 */
function fonteDeNotas(foto) {
  const chave = acharNaFoto(foto, "sources", "kind", j("notes"));
  return chave === null ? null : idDe(chave);
}

function descreverCampo(m) {
  return `${m.chave}: ${m.de} → ${m.para}`;
}

/** Um valor esperado, na MESMA forma em que a fotografia o guarda. */
function j(valor) {
  return JSON.stringify(valor);
}

/**
 * ═══════════════════════════════════════════════════════ ALTO #2, rodada 18 ═
 * O "ALCANCE CONFERIDO" CONTAVA ENTIDADES NOVAS E NUNCA OLHAVA OS CAMPOS DELAS.
 *
 * `diferenca()` compara campo a campo só as chaves presentes NAS DUAS fotos
 * (`if (camposDepois === undefined) continue`). Para entidade **criada**, o
 * único teste era `nascidas.length !== esperadasN` — a linha nasceu, então
 * estava certa — e o conteúdo era conferido por "uma marca de texto aparece na
 * lista da tela".
 *
 * **Qual das cinco formas: a 2ª — "aprova por ausência".** Não havia checagem
 * nenhuma sobre os campos da entidade nova; o que existia era a contagem, e
 * contagem não é conteúdo. Duas sabotagens de uma linha passavam:
 *
 *   subtarefaAddFixture:  status: "open"  →  status: "done"
 *   arestaAddFixture:     peso            →  peso: 1
 *
 * A resposta é obrigar a op a CLASSIFICAR TODA CHAVE da entidade que nasceu,
 * em três baldes, e nenhum deles é "deixa passar":
 *
 *  - `pedidos`    — o que o OPERADOR ditou (digitou, escolheu, ou a tarefa em
 *                   que ele estava). Valor esperado obrigatório;
 *  - `daCasa`     — o que o PRODUTO decide sozinho. Também tem contrato
 *                   ("subtarefa nasce aberta") e também leva valor esperado —
 *                   é aqui que a sabotagem do `status` morre;
 *  - `imprevisiveis` — o que não dá para prever exatamente (id gerado, instante
 *                   de criação). Leva motivo escrito **e uma RÉGUA** — ver o
 *                   bloco do MÉDIO #2 da rodada 19, logo abaixo.
 *
 * Chave da entidade que não está em nenhum dos três = reprovação com o nome da
 * chave. Chave declarada que a entidade não tem = reprovação também: declaração
 * larga demais é o mesmo buraco com outro nome. E há piso: `pedidos` vazio
 * reprova, porque uma criação em que o operador não ditou nada não existe nesta
 * página.
 *
 * As entidades novas e as declarações se casam por um campo de IDENTIDADE que
 * o operador digitou (o texto da nota, o título da subtarefa, a nota da
 * relação) — nunca pelo id, que é justamente o imprevisível.
 */

/*
 * ══════════════════════════════════════════════════════ MÉDIO #2, rodada 19 ═
 * O BALDE "IMPREVISÍVEIS" VIROU ESCONDERIJO: MOTIVO ESCRITO NÃO É RÉGUA.
 *
 * A rodada 18 disse que toda chave de entidade nascida cai num de três baldes e
 * que **nenhum deles deixa passar**. Dois cobram valor esperado; o terceiro
 * cobrava só uma frase de ≥30 caracteres. `createdAt` da nota nova estava
 * declarado como *"o instante da criação é o relógio do servidor no momento do
 * clique"* — uma frase verdadeira, bonita, e que não confere nada.
 *
 * Sabotagem que passou nos cinco portões (`tasks.fixture-store.ts`,
 * `notaAddFixture`):
 *
 *     createdAt: criadoEm ?? new Date().toISOString(),
 *     createdAt: criadoEm ?? new Date(0).toISOString(),   ← a nota nasce em 1970
 *
 * E a data APARECE NA TELA, ao lado do autor (`notas-painel.tsx`,
 * `<time dateTime={nota.createdAt}>`). **Qual das cinco formas: a 2ª — "aprova
 * por ausência"**: não havia checagem nenhuma, e a frase ocupava o lugar dela.
 *
 * **A regra que fica: imprevisível não é "não conferido".** Valor que não dá
 * para prever EXATAMENTE quase sempre dá para CERCAR, e o balde passa a exigir
 * uma FUNÇÃO QUE JULGA o valor, além do motivo:
 *
 *   - `instanteDaCriacao(...)` — o instante tem de cair na janela desta
 *     corrida, medida pela própria corrida: do começo da medida até o fim da
 *     escrita, com `FOLGA_DO_INSTANTE_MS` de cada lado. 1970 fica de fora; o
 *     ano que vem também;
 *   - `idNascidoNaLoja(...)` — o id tem a forma que a loja carimba no que nasce
 *     em tempo de execução, e (quando é um "desfazer") é DIFERENTE do id morto;
 *   - `derivadoDoId(...)` — o campo é função do id da própria entidade
 *     (`externalRef` é `manual:<id>`), e isso se confere sem prever o id.
 *
 * Declaração de imprevisível SEM função reprova com o nome do campo. O motivo
 * escrito continua exigido — ele é para quem lê o relatório; a função é para a
 * guarda. Um sem o outro é o buraco de novo, com um dos dois nomes.
 */

/** A folga de cada lado da janela medida — relógio do servidor × o desta guarda. */
const FOLGA_DO_INSTANTE_MS = 5000;

/** Um imprevisível: motivo escrito (para quem lê) + régua (para a guarda). */
function imprevisivel(motivo, julgar) {
  return { motivo, julgar };
}

/** O instante de criação cabe na janela QUE ESTA CORRIDA MEDIU. */
function instanteDaCriacao(motivo) {
  return imprevisivel(motivo, (valor, ctx) => {
    if (typeof valor !== "string" || valor.trim().length === 0) {
      return `esperava um instante em texto e achei ${JSON.stringify(valor)}`;
    }
    const t = Date.parse(valor);
    if (!Number.isFinite(t)) return `${JSON.stringify(valor)} não é um instante que o relógio entenda`;
    const de = ctx.janela.inicio - FOLGA_DO_INSTANTE_MS;
    const ate = ctx.janela.fim + FOLGA_DO_INSTANTE_MS;
    if (t < de || t > ate) {
      return `o instante gravado (${valor}) está FORA da janela desta corrida (${new Date(
        de,
      ).toISOString()} … ${new Date(
        ate,
      ).toISOString()}) — "imprevisível" nunca quis dizer "de qualquer época", e esta data aparece na tela`;
    }
    return null;
  });
}

/**
 * O id nasceu NESTA corrida: a loja carimba `<prefixo>-fixture-<contador>` em
 * tudo o que nasce em tempo de execução (`novoId`, `tasks.fixture-store.ts`) —
 * é a mesma marca de que a medida `P-loja` se serve para provar a semente.
 * `idQueNaoPodeVoltar` fecha o caso do "desfazer": a entidade volta com id NOVO.
 */
function idNascidoNaLoja(prefixo, motivo, idQueNaoPodeVoltar = null) {
  const forma = new RegExp(`^${prefixo}-fixture-\\d+$`);
  return imprevisivel(motivo, (valor) => {
    if (typeof valor !== "string") return `esperava um id em texto e achei ${JSON.stringify(valor)}`;
    if (!forma.test(valor)) {
      return `o id ${JSON.stringify(valor)} não tem a forma de id nascido nesta corrida (${String(
        forma,
      )})`;
    }
    if (idQueNaoPodeVoltar !== null && valor === idQueNaoPodeVoltar) {
      return `o id ${JSON.stringify(valor)} é o MESMO da entidade que morreu — a declaração diz que ele não volta`;
    }
    return null;
  });
}

/** O campo é função do id da própria entidade — confere-se sem prever o id. */
function derivadoDoId(molde, motivo) {
  return imprevisivel(motivo, (valor, ctx) => {
    const esperado = molde(String(ctx.entidade.id));
    return valor === esperado
      ? null
      : `esperava ${JSON.stringify(esperado)} (derivado do id desta entidade) e achei ${JSON.stringify(
          valor,
        )}`;
  });
}

/** Quantas entidades novas tiveram os campos conferidos nesta corrida. */
let NASCIDAS_COM_CAMPOS_CONFERIDOS = 0;

/** Quantos campos imprevisíveis foram JULGADOS por uma régua nesta corrida. */
let IMPREVISIVEIS_JULGADOS = 0;

/** Piso escrito à mão: a corrida inteira confere ao menos isto. */
const PISO_DE_NASCIDAS_CONFERIDAS = 8;

/**
 * Piso escrito à mão dos imprevisíveis julgados: 2 (nota criada) + 1 (nota
 * restaurada) + 3 (subtarefa) + 8 (4 relações × id e createdAt) + 1 (relação
 * restaurada) = 15. Apagar as réguas passa a exigir baixar este número no diff.
 */
const PISO_DE_IMPREVISIVEIS_JULGADOS = 15;

/** Motivo de imprevisível tem de ser uma frase, não um rótulo. */
const MOTIVO_MINIMO = 30;

function problemasDasNascidas(fotoFim, saldo, declaradas, janela) {
  const problemas = [];
  const especificacoes = declaradas ?? [];
  const nascidas = saldo.criadas;
  const casadas = new Map();
  for (const espec of especificacoes) {
    const alvo = nascidas.filter((chave) => {
      if (colecaoDe(chave) !== espec.colecao) return false;
      const campos = fotoFim.get(chave);
      return campos !== undefined && campos.get(espec.identidade.campo) === j(espec.identidade.valor);
    });
    if (alvo.length !== 1) {
      problemas.push(
        `a declaração de entidade nova ${espec.colecao} com ${espec.identidade.campo}=${j(
          espec.identidade.valor,
        )} casou com ${String(alvo.length)} entidade(s) nascida(s) — esperava exatamente 1`,
      );
      continue;
    }
    casadas.set(alvo[0], espec);
  }
  for (const chave of nascidas) {
    if (!casadas.has(chave)) {
      problemas.push(
        `entidade NOVA que nenhuma declaração descreve: ${chave} — contar a linha nunca foi olhar os campos dela`,
      );
    }
  }
  for (const [chave, espec] of casadas) {
    const campos = fotoFim.get(chave);
    if (campos === undefined) continue;
    const pedidos = espec.pedidos ?? {};
    const daCasa = espec.daCasa ?? {};
    const imprevisiveis = espec.imprevisiveis ?? {};
    if (Object.keys(pedidos).length === 0) {
      problemas.push(
        `${chave}: a declaração não tem nenhum campo em \`pedidos\` — criação sem nada ditado pelo operador não existe nesta página`,
      );
    }
    const declarados = new Set([
      ...Object.keys(pedidos),
      ...Object.keys(daCasa),
      ...Object.keys(imprevisiveis),
    ]);
    for (const nome of campos.keys()) {
      if (!declarados.has(nome)) {
        problemas.push(
          `${chave}: o campo \`${nome}\` da entidade nova não foi classificado (pedidos / daCasa / imprevisiveis) — valor gravado ${
            campos.get(nome) ?? "(ausente)"
          }`,
        );
      }
    }
    for (const nome of declarados) {
      if (!campos.has(nome)) {
        problemas.push(`${chave}: o campo \`${nome}\` foi declarado e a entidade nova não o tem`);
      }
    }
    for (const [nome, esperado] of [...Object.entries(pedidos), ...Object.entries(daCasa)]) {
      if (!campos.has(nome)) continue;
      const obtido = campos.get(nome);
      if (obtido !== esperado) {
        problemas.push(
          `${chave}: o campo \`${nome}\` da entidade nova é ${String(
            obtido,
          )} e o declarado é ${String(esperado)}`,
        );
      }
    }
    /*
     * [MÉDIO #2, rodada 19] O BALDE IMPREVISÍVEL TEM RÉGUA. Motivo escrito é
     * para quem lê o relatório; a função é para a guarda. Faltando qualquer um
     * dos dois, reprova com o nome do campo.
     */
    const entidade = Object.fromEntries(
      [...campos].map(([nome, valor]) => {
        try {
          return [nome, JSON.parse(valor)];
        } catch {
          return [nome, valor];
        }
      }),
    );
    for (const [nome, declaracao] of Object.entries(imprevisiveis)) {
      const motivo = declaracao !== null && typeof declaracao === "object" ? declaracao.motivo : declaracao;
      const julgar = declaracao !== null && typeof declaracao === "object" ? declaracao.julgar : undefined;
      if (String(motivo ?? "").trim().length < MOTIVO_MINIMO) {
        problemas.push(
          `${chave}: o campo \`${nome}\` foi dado como imprevisível sem motivo escrito — "imprevisível" sem frase é dispensa`,
        );
      }
      if (typeof julgar !== "function") {
        problemas.push(
          `${chave}: o campo \`${nome}\` foi dado como imprevisível SEM RÉGUA — motivo não confere valor nenhum, e era por aí que \`createdAt\` podia nascer em 1970`,
        );
        continue;
      }
      if (!campos.has(nome)) continue;
      let veredito;
      try {
        veredito = julgar(entidade[nome], { janela, entidade, chave, campo: nome });
      } catch (erro) {
        veredito = `a régua deste imprevisível ESTOUROU: ${
          erro instanceof Error ? erro.message.split("\n")[0] : String(erro)
        }`;
      }
      if (veredito !== null && veredito !== undefined) {
        problemas.push(
          `${chave}: o campo \`${nome}\` (imprevisível) não passou na própria régua — ${String(
            veredito,
          )}`,
        );
      }
      IMPREVISIVEIS_JULGADOS += 1;
    }
    NASCIDAS_COM_CAMPOS_CONFERIDOS += 1;
  }
  return problemas;
}

/**
 * O ALCANCE CONFERIDO: só pode ter mudado o que a op declarou.
 *
 * - **entidades** (nascidas/mortas) contam no SALDO da medida inteira
 *   (`antes` → `fim`): uma op que cria na precondição e apaga na medida tem
 *   saldo zero, e é isso que ela declara. **E desde a rodada 18 cada entidade
 *   nascida tem os CAMPOS conferidos, um a um** — ver o bloco acima;
 * - **campos** contam nos DOIS intervalos, separadamente. Sem isso, uma
 *   sabotagem que estraga durante a preparação e "desestraga" depois passaria
 *   pelo saldo — e a sabotagem do ALTO #1 estraga justamente na escrita que a
 *   precondição usa;
 * - **campo declarado que não mudou em intervalo nenhum** também reprova:
 *   declaração larga demais é o mesmo buraco com outro nome.
 */
function problemasDeAlcance(foto0, foto1, fotoFim, alcance, nascidasDeclaradas, janela) {
  const problemas = [];
  const saldo = diferenca(foto0, fotoFim);
  problemas.push(...problemasDasNascidas(fotoFim, saldo, nascidasDeclaradas, janela));
  for (const colecao of COLECOES_DA_FOTOGRAFIA) {
    const nascidas = saldo.criadas.filter((c) => colecaoDe(c) === colecao);
    const esperadasN = alcance.criadas?.[colecao] ?? 0;
    if (nascidas.length !== esperadasN) {
      problemas.push(
        `${colecao}: ${String(nascidas.length)} entidade(s) nova(s) no saldo, declarado ${String(
          esperadasN,
        )}${nascidas.length > 0 ? ` (${nascidas.join(", ")})` : ""}`,
      );
    }
    const mortas = saldo.removidas.filter((c) => colecaoDe(c) === colecao);
    const esperadasM = alcance.removidas?.[colecao] ?? 0;
    if (mortas.length !== esperadasM) {
      problemas.push(
        `${colecao}: ${String(mortas.length)} entidade(s) a menos no saldo, declarado ${String(
          esperadasM,
        )}${mortas.length > 0 ? ` (${mortas.join(", ")})` : ""}`,
      );
    }
  }
  const declarados = new Set(alcance.campos ?? []);
  const mudadosNaPreparacao = diferenca(foto0, foto1).campos;
  const mudadosNaMedida = diferenca(foto1, fotoFim).campos;
  const todos = [...mudadosNaPreparacao, ...mudadosNaMedida];
  const aMais = todos.filter((m) => !declarados.has(m.chave));
  if (aMais.length > 0) {
    problemas.push(
      `campo(s) que ninguém pediu mudaram: ${aMais.map(descreverCampo).join(" · ")}`,
    );
  }
  const tocados = new Set(todos.map((m) => m.chave));
  const aMenos = [...declarados].filter((c) => !tocados.has(c));
  if (aMenos.length > 0) {
    problemas.push(
      `campo(s) declarado(s) no alcance que não mudaram em intervalo nenhum: ${aMenos.join(", ")}`,
    );
  }
  const resumo = `alcance: ${String(saldo.criadas.length)} entidade(s) nova(s) (${String(
    (nascidasDeclaradas ?? []).length,
  )} com os campos declarados e conferidos), ${String(
    saldo.removidas.length,
  )} a menos, ${String(todos.length)} campo(s) mudado(s)${
    todos.length > 0 ? ` [${todos.map(descreverCampo).join(" · ")}]` : ""
  }`;
  return { problemas, resumo };
}

// ═══════════════════════ A CLASSE DE VALORES DA DURAÇÃO (ALTO #2, rodada 17) ═

/**
 * Os valores que a duração tem de aceitar, **derivados do contrato do campo** —
 * e não um chute único que por acaso é sempre inteiro.
 *
 * Três fontes, todas lidas do fonte do produto:
 *
 *  1. as grafias decimais que a PRÓPRIA frase de recusa promete
 *     (`actions.ts`: "com ponto ou vírgula no decimal (ex.: 1.5 ou 1,5)") — se
 *     a tela pede as duas, a classe tem as duas;
 *  2. o número de casas que a coluna guarda (`ESTIMATIVA_CASAS_MAX`, que espelha
 *     `numeric(6,2)`);
 *  3. a borda de baixo (`DURACAO_MINIMA_DIAS`, em `tipos-v3.ts`).
 *
 * O inteiro entra como representante do caso fácil — que era o ÚNICO coberto.
 */
function classeDaDuracao() {
  const acoes = readFileSync(join(RAIZ_DO_PACOTE, "src", "app", "tarefa", "actions.ts"), "utf8");
  const tipos = readFileSync(
    join(RAIZ_DO_PACOTE, "src", "core", "prioritize", "tipos-v3.ts"),
    "utf8",
  );
  const frase = /precisa ser um número em dias, com [^(]*\(ex\.: ([^)]+)\)/.exec(acoes);
  const exemplos = (frase?.[1] ?? "")
    .split(/\s+ou\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  const casas = Number(/const ESTIMATIVA_CASAS_MAX = (\d+)/.exec(acoes)?.[1] ?? "0");
  const minimo = /export const DURACAO_MINIMA_DIAS = ([\d.]+)/.exec(tipos)?.[1] ?? "";
  const classe = ["3", ...exemplos];
  if (casas > 0) classe.push(`2.${"2".repeat(casas)}`);
  if (minimo !== "") classe.push(minimo);
  return [...new Set(classe)];
}

const CLASSE_DA_DURACAO = classeDaDuracao();

/**
 * ═══════════════════════════════════════════════════════ BAIXO #6, rodada 18 ═
 * O PISO "2 = PONTO E VÍRGULA" CONTAVA PONTOS.
 *
 * Estava escrito `PISO_DE_FORMAS_DECIMAIS = 2` e o teste era
 * `CLASSE_DA_DURACAO.filter((v) => /[.,]/.test(v)).length >= 2`. Esse filtro
 * casa com ponto E com vírgula **sem distinguir os dois**: uma classe com
 * `1.5` e `2.22` — dois pontos, vírgula nenhuma — passava com folga. Se o
 * produto parasse de oferecer a vírgula, a derivação devolveria só grafias com
 * ponto, a guarda pararia de testar a vírgula, e P0 continuaria verde.
 *
 * **Qual das cinco formas: a 5ª — "confere o caso, não a classe".** Dois
 * exemplos do mesmo caso contados como duas formas.
 *
 * Agora o piso é NOMINAL: os separadores exigidos estão escritos aqui, um a
 * um, e cada um tem de aparecer em ALGUMA grafia da classe. Some a vírgula do
 * produto, P0 fica vermelho dizendo qual separador sumiu.
 */
const SEPARADORES_DECIMAIS_EXIGIDOS = [".", ","];

/** Quais dos separadores exigidos a classe derivada de fato traz. */
function separadoresNaClasse(classe) {
  return SEPARADORES_DECIMAIS_EXIGIDOS.filter((sep) =>
    classe.some((v) => v.includes(sep)),
  );
}

/** O valor de partida da duração — inteiro, e fora da classe, para o pedido diferir. */
const DURACAO_DE_PARTIDA = "7";

/*
 * ════════════════════════════════════ O ESTADO DE PARTIDA DE CADA ROTA ═══════
 * [ALTO #1, rodada 17 — SEGUNDA VOLTA, medida] A primeira versão desta correção
 * pôs alcance conferido em toda escrita da família P e MESMO ASSIM a sabotagem
 * do status passou verde. A corrida mostrou por quê, e a razão é instrutiva:
 *
 *   P · status · … alcance: 2 campo(s) mudado(s)
 *                  [tasks/task-docs/status: "done" → "open"
 *                 · tasks/task-docs/status: "open" → "in_progress"]
 *
 * `estimativaDias` não aparece na diferença porque **já era `null` antes de a
 * família P começar**: a medida D, lá no começo da guarda, também escreve
 * status nesta mesma tarefa, e foi ela que apagou a duração. Quando `P · status`
 * chegou, não havia mais nada para apagar — a escrita não mudou nada a mais, e
 * o alcance, corretamente, não acusou nada.
 *
 * É a quarta forma viciada ("mede um instante só") mordendo a terceira: um
 * alcance conferido sobre um estado JÁ ESTRAGADO não tem como acusar o estrago.
 *
 * A resposta é o **estado de partida**: antes de cada medida P, a guarda
 * escreve, PELA INTERFACE, um estado declarado da rota — status na primeira
 * opção, sem mãe, sem meta, átomos limpos, duração `7` — e **confere os cinco
 * campos depois do F5**. Se o estado de partida não for o declarado, a medida
 * reprova ali, sem medir. Só então a fotografia é tirada.
 *
 * **A duração é escrita POR ÚLTIMO, de propósito.** Uma escrita da preparação
 * que apague a duração (exatamente a sabotagem) é desfeita pela escrita
 * seguinte, e a rodada começa com a duração INTEIRA — que é o que dá à medida
 * algo para perder. O caminho inverso (uma escrita de duração que apague o
 * status) cai na conferência de leitura do próprio estado de partida.
 */
const CAMPOS_DO_ESTADO_DE_PARTIDA = ["status", "mãe", "meta", "átomos", "duração"];

async function lerEstadoDaRota(pagina) {
  const status = await marcadoNoGrupo(pagina, "Status da tarefa");
  const select = pagina.locator('select[aria-label="Tarefa mãe"]');
  const mae =
    (await select.count()) === 0
      ? "(o <select> da mãe não está na página)"
      : ((await select.first().inputValue()) === "" ? "(nenhuma)" : await select.first().inputValue());
  const botaoMeta = pagina.locator("button[aria-pressed]");
  const meta =
    (await botaoMeta.count()) === 0
      ? "(o botão de meta não está na página)"
      : `aria-pressed=${String(await botaoMeta.first().getAttribute("aria-pressed"))}`;
  const trio = await trioNaTela(pagina);
  const duracao = await duracaoNaCaixa(pagina);
  return { status, mae, meta, trio, duracao };
}

function descreverEstadoDaRota(e) {
  return `status=${e.status} · mãe=${e.mae} · meta=${e.meta} · átomos=${
    e.trio === TRIO_LIMPO ? "limpos" : e.trio
  } · duração=${JSON.stringify(e.duracao)}`;
}

/**
 * Escreve o estado de partida da rota pela interface e devolve o que foi
 * DECLARADO e o que a página mostra depois do F5 — a conferência é de quem chama.
 */
async function escreverEstadoDePartida(pagina) {
  const opcoesStatus = await opcoesDoGrupo(pagina, "Status da tarefa");
  const statusPartida = opcoesStatus[0] ?? "(o grupo de status não tem opção)";
  if ((await marcadoNoGrupo(pagina, "Status da tarefa")) !== statusPartida) {
    await escolherNoGrupo(pagina, "Status da tarefa", statusPartida);
    await anunciou(pagina, /Status atualizado para/);
    await recarregar(pagina);
  }
  const select = pagina.locator('select[aria-label="Tarefa mãe"]').first();
  if ((await select.count()) === 1 && (await select.inputValue()) !== "") {
    await select.selectOption("");
    await anunciou(pagina, /Tarefa mãe (atualizada|removida)\./);
    await recarregar(pagina);
  }
  const botaoMeta = pagina.locator("button[aria-pressed]").first();
  if ((await botaoMeta.count()) === 1 && (await botaoMeta.getAttribute("aria-pressed")) === "true") {
    await botaoMeta.click();
    await anunciou(pagina, /(Marcada como meta|Meta removida)\./);
    await recarregar(pagina);
  }
  const limpar = pagina.getByRole("button", { name: "Limpar átomos" });
  if ((await limpar.count()) === 1) {
    await limpar.click();
    await anunciou(pagina, /Átomos limpos\./);
    await recarregar(pagina);
  }
  // A DURAÇÃO POR ÚLTIMO — ver o bloco acima. Não é ordem à toa.
  if ((await duracaoNaCaixa(pagina)) !== DURACAO_DE_PARTIDA) {
    await salvarDuracao(pagina, DURACAO_DE_PARTIDA);
    await recarregar(pagina);
  }
  const lido = await lerEstadoDaRota(pagina);
  return {
    opcoesStatus,
    status: statusPartida,
    esperado: descreverEstadoDaRota({
      status: statusPartida,
      mae: "(nenhuma)",
      meta: "aria-pressed=false",
      trio: TRIO_LIMPO,
      duracao: DURACAO_DE_PARTIDA,
    }),
    obtido: descreverEstadoDaRota(lido),
  };
}

/**
 * A forma que o servidor GUARDA, espelhada aqui: é o que a caixa tem de mostrar
 * depois do F5. Mesma lei de `duracaoCanonica` (`duracao-form.tsx`) e de
 * `comDecimalCanonico` (`actions.ts`): UMA vírgula decimal vira ponto.
 */
function duracaoCanonicaNaGuarda(bruta) {
  const t = bruta.trim();
  if (t.length === 0) return "";
  const semVirgula =
    t.indexOf(",") !== -1 && t.indexOf(".") === -1 && t.indexOf(",") === t.lastIndexOf(",")
      ? t.replace(",", ".")
      : t;
  const n = Number(semVirgula);
  return Number.isFinite(n) ? String(n) : bruta;
}

// ══════════════════════════════════════════════ OS AJUDANTES DA FAMÍLIA P ═

/** Espera a frase aparecer numa região viva; devolve o que havia lá no fim. */
async function anunciou(pagina, regex, limiteMs = 20000) {
  const ate = Date.now() + limiteMs;
  let texto = "";
  while (Date.now() < ate) {
    texto = await lerRegioesVivas(pagina);
    if (regex.test(texto)) return texto;
    await pagina.waitForTimeout(200);
  }
  return texto;
}

/** O F5 do operador. */
async function recarregar(pagina) {
  await pagina.reload({ waitUntil: "networkidle" });
  await pagina.waitForSelector("h1", { timeout: 30000 });
  await assentar(pagina);
}

/** O rótulo marcado num grupo segmentado, pelo nome que o operador lê. */
async function marcadoNoGrupo(pagina, grupo) {
  return await pagina.evaluate((g) => {
    const el = document.querySelector(`[role="radiogroup"][aria-label="${g}"]`);
    if (el === null) return "(grupo ausente)";
    const m = el.querySelector('[role="radio"][aria-checked="true"]');
    return m === null ? "(nenhum)" : (m.textContent ?? "").trim();
  }, grupo);
}

async function opcoesDoGrupo(pagina, grupo) {
  return await pagina.evaluate((g) => {
    const el = document.querySelector(`[role="radiogroup"][aria-label="${g}"]`);
    if (el === null) return [];
    return [...el.querySelectorAll('[role="radio"]')].map((b) => (b.textContent ?? "").trim());
  }, grupo);
}

async function escolherNoGrupo(pagina, grupo, rotulo) {
  await pagina
    .getByRole("radiogroup", { name: grupo })
    .getByRole("radio", { name: rotulo, exact: true })
    .click();
}

/** Os três átomos como o operador os vê, numa string só. */
async function trioNaTela(pagina) {
  const o = await marcadoNoGrupo(pagina, "Opcionalidade");
  const e = await marcadoNoGrupo(pagina, "Esforço");
  const c = await marcadoNoGrupo(pagina, "Custo");
  return `Opcionalidade=${o} · Esforço=${e} · Custo=${c}`;
}

const TRIO_LIMPO = "Opcionalidade=(nenhum) · Esforço=(nenhum) · Custo=(nenhum)";

/** Todo item de lista da página, com o texto INTEIRO (a nota da relação inclusa). */
async function textoDasListas(pagina) {
  return await pagina.evaluate(() =>
    [...document.querySelectorAll("li")]
      .map((el) => (el.innerText || "").replace(/\s+/g, " ").trim())
      .join(" ~ "),
  );
}

/** Excluir (dois cliques) o item cuja linha contém a marca. */
async function excluirItemComMarca(pagina, marca) {
  const nos = await pagina.getByRole("button", { name: /excluir/ }).elementHandles();
  for (const no of nos) {
    const dentro = await no.evaluate(
      (el, m) => (el.closest("li")?.innerText ?? "").includes(m),
      marca,
    );
    if (dentro !== true) continue;
    await no.click();
    await pagina.waitForTimeout(250);
    await no.click();
    return true;
  }
  return false;
}

/**
 * Cria uma relação com a NOTA como marcador, e devolve o anúncio.
 *
 * [ALTO #1, rodada 17] Agora ela PROCURA um destino livre em vez de usar
 * sempre o primeiro. Desde que cada medida passou a criar a própria
 * precondição, duas medidas seguidas pediriam a mesma correlação
 * `task-build → primeiro destino` e a segunda cairia em "Já existe uma aresta
 * desse tipo entre essas duas tarefas" — uma falha de encanamento que se
 * disfarçaria de falha de persistência.
 */
async function criarRelacaoMarcada(pagina, marca, rotuloDoTipo = "correlação") {
  await escolherNoGrupo(pagina, "Tipo de relação", rotuloDoTipo);
  await pagina.waitForTimeout(250);
  /*
   * [ALTO #2b, rodada 18] O DESCONTO. O campo só existe com "sinergia"
   * escolhida, e é o ÚNICO número do formulário de relação — era o campo que
   * medida nenhuma conferia, porque `criarRelacaoMarcada` escolhia sempre
   * "correlação", que não tem desconto.
   */
  const desconto = campoPorNome(pagina, /^Desconto/).first();
  const temDesconto = (await desconto.count()) === 1;
  if (temDesconto) await desconto.fill(DESCONTO_PEDIDO);
  const destino = pagina.getByLabel("Destino").first();
  const valores = await destino.evaluate((el) =>
    [...el.options].map((o) => o.value).filter((v) => v !== ""),
  );
  if (valores.length === 0) {
    return { ok: false, anuncio: `(não há destino disponível para ${rotuloDoTipo})`, destino: null };
  }
  for (const v of valores) {
    await destino.selectOption(v);
    await campoPorNome(pagina, /^Nota da relação/)
      .first()
      .fill(marca);
    if (temDesconto) await desconto.fill(DESCONTO_PEDIDO);
    await pagina.getByRole("button", { name: "Adicionar relação" }).click();
    const texto = await anunciou(pagina, /Relação criada\.|Já existe uma aresta/, 10000);
    if (/Relação criada\./.test(texto)) {
      return { ok: true, anuncio: texto, destino: v, comDesconto: temDesconto };
    }
  }
  return {
    ok: false,
    anuncio: `(nenhum destino livre para uma relação de ${rotuloDoTipo})`,
    destino: null,
  };
}

/**
 * A declaração dos campos de uma ARESTA nova, na forma que o alcance cobra.
 *
 * `peso` muda de balde conforme a natureza, e é essa distinção que fecha o
 * ALTO #2b: na sinergia o operador DIGITOU o desconto (`pedidos`), nas outras
 * três o produto usa o neutro `1` (`daCasa`) — e nos dois casos há valor
 * esperado, não uma contagem de linhas.
 */
function arestaDeclarada(marca, tipo, destino, comDesconto) {
  const pedidos = { origem: j(ID_BUILD), destino: j(destino), tipo: j(tipo), nota: j(marca) };
  const daCasa = {};
  if (comDesconto) pedidos.peso = j(Number(DESCONTO_PEDIDO));
  else daCasa.peso = j(1);
  return {
    colecao: "edges",
    identidade: { campo: "nota", valor: marca },
    pedidos,
    daCasa,
    imprevisiveis: {
      id: idNascidoNaLoja(
        "edge",
        "o id da aresta é gerado pelo store no momento da gravação; prever o id seria prever o contador — o que se cerca é a FORMA do id que nasce em tempo de execução",
      ),
      createdAt: instanteDaCriacao(
        "o instante da criação é o relógio do servidor no momento do clique; o que se cerca é a JANELA desta corrida, medida por ela mesma",
      ),
    },
  };
}

/**
 * Espera a lista REFLETIR o que acabou de acontecer, e devolve o texto dela.
 *
 * Sem isto a medida lia o quadro anterior: a exclusão acontece no servidor, e
 * a lista só muda quando o `router.refresh()` da porta volta.
 */
async function esperarPresenca(pagina, marca, presente, limiteMs = 15000) {
  const ate = Date.now() + limiteMs;
  let texto = await textoDasListas(pagina);
  while (texto.includes(marca) !== presente && Date.now() < ate) {
    await pagina.waitForTimeout(250);
    texto = await textoDasListas(pagina);
  }
  return texto;
}

/** "presente"/"ausente" — a régua de identidade das listas. */
function presencaDe(texto, marca) {
  return texto.includes(marca) ? `"${marca}" está na lista` : `"${marca}" NÃO está na lista`;
}

/** Grava um valor na caixa de duração e devolve o anúncio que chegou. */
async function salvarDuracao(pagina, valor) {
  const campo = campoPorNome(pagina, /^Duração \(dias, p80/).first();
  await campo.fill(valor);
  await pagina.getByRole("button", { name: "Salvar duração" }).click();
  return await anunciou(pagina, /Duração (salva|removida)\./);
}

async function duracaoNaCaixa(pagina) {
  return await campoPorNome(pagina, /^Duração \(dias, p80/)
    .first()
    .inputValue();
}

/** Cria uma nota marcada, confirma o F5, e devolve o texto das listas. */
async function criarNotaMarcada(pagina, marca) {
  await campoPorNome(pagina, /^Nova nota$/)
    .first()
    .fill(marca);
  await pagina.getByRole("button", { name: "Salvar nota" }).click();
  return await anunciou(pagina, /Nota salva\./);
}

/** Declara um trio de átomos com Esforço ≠ Custo e devolve o que foi pedido. */
async function declararTrio(pagina) {
  const opcoesO = await opcoesDoGrupo(pagina, "Opcionalidade");
  const opcoesE = await opcoesDoGrupo(pagina, "Esforço");
  const opcoesC = await opcoesDoGrupo(pagina, "Custo");
  const pedidoO = opcoesO[0] ?? "(sem opção)";
  const pedidoE = opcoesE[0] ?? "(sem opção)";
  /*
   * Esforço e Custo DIFERENTES ENTRE SI, de propósito: com os dois iguais,
   * trocar um campo pelo outro no despacho (`esforco: String(custo)`) seria
   * invisível — é a sabotagem do ALTO #1 da rodada 16.
   */
  const pedidoC = opcoesC.filter((o) => o !== pedidoE).at(-1) ?? "(sem opção)";
  await escolherNoGrupo(pagina, "Opcionalidade", pedidoO);
  await escolherNoGrupo(pagina, "Esforço", pedidoE);
  await escolherNoGrupo(pagina, "Custo", pedidoC);
  await pagina.getByRole("button", { name: "Salvar átomos" }).click();
  const anuncio = await anunciou(pagina, /Átomos salvos\./);
  return { trio: `Opcionalidade=${pedidoO} · Esforço=${pedidoE} · Custo=${pedidoC}`, anuncio };
}

/**
 * A TABELA. Cada `op` da lista canônica aparece aqui com:
 *
 *  - `precondicao` — o estado PRÓPRIO desta medida, escrito por ela e CONFERIDO
 *    depois do F5. Nenhuma medida herda o que outra deixou;
 *  - `conferir` — a escrita medida, com o valor PEDIDO e o valor depois do F5;
 *  - `alcance` — o que esta escrita pode ter tocado, com motivo escrito;
 *  - `anuncioEsperado` / `anunciosProibidos` — a frase da tela entra no veredito.
 */
const PERSISTENCIA_POR_OP = {
  nota_criar: {
    rota: ROTA_BUILD,
    alcance: {
      criadas: { notes: 1 },
      motivo:
        "salvar uma nota cria UMA nota e não toca em mais nada — nenhuma tarefa, nenhuma relação, nenhum campo de quem já existia.",
    },
    precondicao: async (pagina) => {
      const marca = marcador("nota");
      return {
        esperado: `"${marca}" NÃO está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        dado: { marca },
      };
    },
    conferir: async (pagina, dado) => {
      const antes = presencaDe(await textoDasListas(pagina), dado.marca);
      const anuncio = await criarNotaMarcada(pagina, dado.marca);
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${dado.marca}" está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), dado.marca),
        anuncio,
        anuncioEsperado: /Nota salva\./,
        anunciosProibidos: [/Nota restaurada\./, /Excluída\./],
        // [ALTO #2, rodada 18] os CAMPOS da nota que nasceu, um a um.
        nascidas: [
          {
            colecao: "notes",
            identidade: { campo: "texto", valor: dado.marca },
            pedidos: {
              taskId: j(ID_BUILD),
              texto: j(dado.marca),
              // Caixa "Autor da nota" deixada em branco: branco é um pedido
              // também, e o contrato é que ele vire `null`, não `""`.
              autor: j(null),
            },
            daCasa: {},
            imprevisiveis: {
              id: idNascidoNaLoja(
                "note",
                "o id da nota é gerado pelo store na gravação; prever o id seria prever o contador — o que se cerca é a FORMA do id que nasce em tempo de execução",
              ),
              // [MÉDIO #2, rodada 19] É AQUI QUE A NOTA DE 1970 MORRE. Esta data
              // aparece na tela, ao lado do autor (`notas-painel.tsx`).
              createdAt: instanteDaCriacao(
                "o instante da criação é o relógio do servidor no momento do clique; o que se cerca é a JANELA desta corrida, medida por ela mesma",
              ),
            },
          },
        ],
      };
    },
  },
  nota_excluir: {
    rota: ROTA_BUILD,
    alcance: {
      motivo:
        "a nota que esta medida apaga foi criada pela PRÓPRIA precondição: no saldo do antes contra o depois a loja tem o mesmo número de notas, e nada mais pode ter mudado.",
    },
    precondicao: async (pagina) => {
      const marca = marcador("nota-excluir");
      await criarNotaMarcada(pagina, marca);
      await recarregar(pagina);
      return {
        esperado: `"${marca}" está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        dado: { marca },
      };
    },
    conferir: async (pagina, dado) => {
      const antes = presencaDe(await textoDasListas(pagina), dado.marca);
      const achou = await excluirItemComMarca(pagina, dado.marca);
      const anuncio = achou ? await anunciou(pagina, /Excluída\./) : "(não achei a nota)";
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${dado.marca}" NÃO está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), dado.marca),
        anuncio,
        anuncioEsperado: /Excluída\./,
        anunciosProibidos: [/Nota restaurada\./, /Nota salva\./],
        extra: `achei a nota para excluir=${String(achou)}`,
      };
    },
  },
  nota_desfazer: {
    rota: ROTA_BUILD,
    alcance: {
      criadas: { notes: 1 },
      motivo:
        "desfazer a exclusão grava a nota de volta com id novo (o store não ressuscita o id antigo): no saldo, UMA nota a mais do que antes da precondição, e nada além.",
    },
    precondicao: async (pagina) => {
      const marca = marcador("nota-desfazer");
      await criarNotaMarcada(pagina, marca);
      await recarregar(pagina);
      /*
       * [ALTO #2, rodada 18] O ORIGINAL É FOTOGRAFADO ANTES DE SER APAGADO.
       * O contrato do desfazer não é "aparece uma nota": é "volta ESTA nota",
       * com o mesmo texto, o mesmo autor e o MESMO INSTANTE de criação (a
       * porta reenvia `criado_em` de propósito). Sem capturar o original, a
       * conferência da entidade nova só poderia falar do que o operador
       * digitou agora — e o desfazer não digita nada.
       */
      const foto = await fotografia();
      const chave = acharNaFoto(foto, "notes", "texto", j(marca));
      const original = chave === null ? null : camposDe(foto, chave);
      const achou = await excluirItemComMarca(pagina, marca);
      await anunciou(pagina, /Excluída\./);
      return {
        esperado: `"${marca}" NÃO está na lista`,
        obtido: presencaDe(await esperarPresenca(pagina, marca, false), marca),
        dado: { marca, achou, original },
      };
    },
    conferir: async (pagina, dado) => {
      const antes = presencaDe(await textoDasListas(pagina), dado.marca);
      await pagina.getByRole("button", { name: "Desfazer" }).first().click();
      const anuncio = await anunciou(pagina, /Nota restaurada\./);
      await recarregar(pagina);
      const original = dado.original ?? {};
      const pedidos = { ...original };
      delete pedidos.id;
      return {
        antes,
        pedido: `"${dado.marca}" está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), dado.marca),
        anuncio,
        anuncioEsperado: /Nota restaurada\./,
        anunciosProibidos: [/Excluída\./],
        extra: `achei a nota para excluir=${String(
          dado.achou,
        )} · a nota original tinha ${JSON.stringify(original)}`,
        nascidas: [
          {
            colecao: "notes",
            identidade: { campo: "texto", valor: dado.marca },
            // Tudo o que o original tinha, menos o id: é isso que "desfazer"
            // quer dizer. Um desfazer que perdesse o autor ou trocasse o
            // instante de criação reprova aqui, com o campo nomeado.
            pedidos,
            daCasa: {},
            imprevisiveis: {
              id: idNascidoNaLoja(
                "note",
                "o store não ressuscita o id antigo — a nota volta com id novo, e é isso que a op declara",
                String(original.id ?? "").replace(/^"|"$/g, ""),
              ),
            },
          },
        ],
      };
    },
  },
  subtarefa_criar: {
    rota: ROTA_BUILD,
    alcance: {
      criadas: { tasks: 1 },
      motivo:
        "criar subtarefa cria UMA tarefa; a mãe não muda de campo nenhum (o laço é o `parentId` da filha). É aqui que o ataque do vizinho apareceria: a mãe está na fotografia.",
    },
    precondicao: async (pagina) => {
      const marca = marcador("sub");
      return {
        esperado: `"${marca}" NÃO está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        dado: { marca },
      };
    },
    conferir: async (pagina, dado) => {
      /*
       * [ALTO #2, rodada 17] A SUBTAREFA TAMBÉM TEM O CAMPO DE DURAÇÃO, e o
       * fracionário passa por aqui também — `subtarefaAddFixture` e
       * `estimativaSetFixture` são duas portas para o MESMO campo.
       */
      const fracionario =
        CLASSE_DA_DURACAO.find((v) => /[.,]/.test(v)) ?? "(a classe não tem fracionário)";
      const esperadoNaLoja = Number(duracaoCanonicaNaGuarda(fracionario));
      const antes = presencaDe(await textoDasListas(pagina), dado.marca);
      await campoPorNome(pagina, /^Título da subtarefa$/)
        .first()
        .fill(dado.marca);
      await campoPorNome(pagina, /^Duração \(dias\)$/)
        .first()
        .fill(fracionario);
      await pagina.getByRole("button", { name: "Adicionar subtarefa" }).click();
      const anuncio = await anunciou(pagina, /Subtarefa criada\./);
      await recarregar(pagina);
      const foto = await fotografia();
      const chaveNova = acharNaFoto(foto, "tasks", "title", j(dado.marca));
      const gravada =
        chaveNova === null
          ? "(a subtarefa não está na loja)"
          : (foto.get(chaveNova)?.get("estimativaDias") ?? "(sem campo)");
      /*
       * [ALTO #2, rodada 18] O QUE O PRODUTO DECIDE TAMBÉM TEM CONTRATO.
       *
       * A sabotagem que passava era `status: "open"` → `status: "done"` em
       * `subtarefaAddFixture`: a subtarefa nascia CONCLUÍDA, saía do caminho
       * crítico, e a guarda dizia ok porque a linha tinha nascido e o título
       * batia. `status` não é campo que o operador digita — e é exatamente por
       * isso que ele precisa de valor esperado, no balde `daCasa`.
       *
       * Os dois valores que não são chute nem literal: `projectId` sai da MÃE
       * (a subtarefa herda o projeto dela) e `sourceId` sai da fonte cujo
       * `kind` é `notes` — as duas lidas da própria fotografia.
       */
      const mae = foto.get(`tasks/${ID_BUILD}`);
      const projetoDaMae = mae?.get("projectId") ?? "(a mãe sumiu da fotografia)";
      const fonteNotas = fonteDeNotas(foto);
      return {
        antes: `${antes} · duração gravada=(ainda não existe)`,
        pedido: `"${dado.marca}" está na lista · duração gravada=${JSON.stringify(esperadoNaLoja)}`,
        obtido: `${presencaDe(await textoDasListas(pagina), dado.marca)} · duração gravada=${gravada}`,
        anuncio,
        anuncioEsperado: /Subtarefa criada\./,
        anunciosProibidos: [],
        extra: `duração pedida na criação=${JSON.stringify(
          fracionario,
        )} (da classe derivada) · projeto herdado da mãe=${String(
          projetoDaMae,
        )} · fonte "Notas" derivada da fotografia=${String(fonteNotas)}`,
        nascidas: [
          {
            colecao: "tasks",
            identidade: { campo: "title", valor: dado.marca },
            pedidos: {
              title: j(dado.marca),
              estimativaDias: j(esperadoNaLoja),
              parentId: j(ID_BUILD),
            },
            daCasa: {
              // Estes são o CONTRATO da criação, e nenhum deles é digitado.
              status: j("open"),
              isGoal: j(false),
              assimetria: j(null),
              notes: j(null),
              dueDate: j(null),
              iniciadoEm: j(null),
              predecessorIds: j([]),
              successorIds: j([]),
              priorityHierarq: j({ s1: 1, s2: 1, s3: 1 }),
              projectId: projetoDaMae,
              sourceId: j(fonteNotas),
            },
            imprevisiveis: {
              id: idNascidoNaLoja(
                "task",
                "o id da tarefa é gerado pelo store na gravação; prever o id seria prever o contador — o que se cerca é a FORMA do id que nasce em tempo de execução",
              ),
              externalRef: derivadoDoId(
                (id) => `manual:${id}`,
                "é `manual:<id>`, e o id só existe depois da gravação — mas o campo é FUNÇÃO do id, e isso se confere sem prever o id",
              ),
              updatedAt: instanteDaCriacao(
                "o carimbo de atualização é o relógio do servidor no momento do clique; o que se cerca é a JANELA desta corrida, medida por ela mesma",
              ),
            },
          },
        ],
      };
    },
  },
  relacao_criar: {
    rota: ROTA_BUILD,
    alcance: {
      // [ALTO #2b, rodada 18] uma aresta POR NATUREZA — eram quatro na tela e
      // uma só conferida.
      criadas: { edges: CLASSE_DE_TIPOS_DE_RELACAO.length },
      motivo:
        "criar relação cria UMA aresta por natureza escolhida; nem a origem nem o destino mudam de campo. O destino é o vizinho que nenhuma medida visita — e ele está na fotografia.",
    },
    precondicao: async (pagina) => {
      const marca = marcador("rel");
      return {
        esperado: `"${marca}" NÃO está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        dado: { marca },
      };
    },
    /*
     * ════════════════════════════════════════════════ ALTO #2b, rodada 18 ═══
     * A CLASSE DAS NATUREZAS, E O DESCONTO QUE NINGUÉM CONFERIA.
     *
     * A versão anterior criava UMA relação, sempre de "correlação" — a única
     * das quatro que não tem desconto. Três naturezas (`predecessor`,
     * `sinergia`, `obsolescência`) nunca tiveram persistência conferida, e o
     * `peso` — o único número do formulário de relação — não era conferido por
     * medida nenhuma. A sabotagem `peso: 1` no store passava verde: o operador
     * digitava 0,25, a tela confirmava, a lista mostrava 1, e o EXTREMO OPOSTO
     * da escala entrava na conta do HIERARQ.
     *
     * Agora a medida percorre a classe derivada do fonte, e cada aresta que
     * nasce declara TODOS os seus campos — inclusive o `peso`, no balde certo
     * (digitado na sinergia, neutro do produto nas outras três).
     */
    conferir: async (pagina, dado) => {
      const antes = presencaDe(await textoDasListas(pagina), dado.marca);
      const nascidas = [];
      const anuncios = [];
      const pedidos = [];
      const obtidos = [];
      for (const tipo of CLASSE_DE_TIPOS_DE_RELACAO) {
        const marca = `${dado.marca}-${tipo.valor}`;
        const r = await criarRelacaoMarcada(pagina, marca, tipo.rotulo);
        anuncios.push(`${tipo.rotulo}→${JSON.stringify(r.anuncio)}`);
        pedidos.push(`${marca} está na lista`);
        if (r.ok) {
          nascidas.push(arestaDeclarada(marca, tipo.valor, r.destino, r.comDesconto === true));
        }
        await recarregar(pagina);
        const texto = await textoDasListas(pagina);
        obtidos.push(`${marca} ${texto.includes(marca) ? "está" : "NÃO está"} na lista`);
      }
      return {
        antes,
        pedido: pedidos.join(" · "),
        obtido: obtidos.join(" · "),
        anuncio: anuncios.join(" | "),
        anuncioEsperado: /Relação criada\./,
        anunciosProibidos: [/Relação desfeita\./, /Relação restaurada\./],
        extra: `${String(
          CLASSE_DE_TIPOS_DE_RELACAO.length,
        )} natureza(s) da classe derivada do fonte, desconto pedido na sinergia=${DESCONTO_PEDIDO} (nem o 0.5 que já vem na caixa, nem o 1 que o servidor usa quando o campo não chega)`,
        nascidas,
      };
    },
  },
  relacao_excluir: {
    rota: ROTA_BUILD,
    alcance: {
      motivo:
        "a relação que esta medida apaga foi criada pela PRÓPRIA precondição: saldo zero de arestas, e nenhum campo de tarefa pode ter mudado no caminho.",
    },
    precondicao: async (pagina) => {
      const marca = marcador("rel-excluir");
      await criarRelacaoMarcada(pagina, marca);
      await recarregar(pagina);
      return {
        esperado: `"${marca}" está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        dado: { marca },
      };
    },
    conferir: async (pagina, dado) => {
      const antes = presencaDe(await textoDasListas(pagina), dado.marca);
      const achou = await excluirItemComMarca(pagina, dado.marca);
      const anuncio = achou ? await anunciou(pagina, /Excluída\./) : "(não achei a relação)";
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${dado.marca}" NÃO está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), dado.marca),
        anuncio,
        anuncioEsperado: /Excluída\./,
        anunciosProibidos: [/Relação restaurada\./, /Relação criada\./],
        extra: `achei a relação para excluir=${String(achou)}`,
      };
    },
  },
  relacao_desfazer_criacao: {
    rota: ROTA_BUILD,
    alcance: {
      motivo:
        "a criação é da precondição e o desfazer a apaga: saldo zero de arestas. Se o desfazer não desfizesse, o saldo acusaria UMA aresta a mais.",
    },
    precondicao: async (pagina) => {
      // Sem F5 aqui de propósito: o F5 fecharia a janela de "Desfazer" da criação.
      const marca = marcador("rel-criada");
      await criarRelacaoMarcada(pagina, marca);
      return {
        esperado: `"${marca}" está na lista`,
        obtido: presencaDe(await esperarPresenca(pagina, marca, true), marca),
        dado: { marca },
      };
    },
    conferir: async (pagina, dado) => {
      const antes = presencaDe(await textoDasListas(pagina), dado.marca);
      await pagina.getByRole("button", { name: "Desfazer" }).first().click();
      const anuncio = await anunciou(pagina, /Relação desfeita\./);
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${dado.marca}" NÃO está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), dado.marca),
        anuncio,
        anuncioEsperado: /Relação desfeita\./,
        anunciosProibidos: [/Relação restaurada\./],
      };
    },
  },
  relacao_desfazer_exclusao: {
    rota: ROTA_BUILD,
    alcance: {
      criadas: { edges: 1 },
      motivo:
        "desfazer a exclusão regrava a aresta com id novo: no saldo, UMA aresta a mais do que antes da precondição (que criou e apagou a original), e nada além.",
    },
    precondicao: async (pagina) => {
      const marca = marcador("rel-excluida");
      /*
       * [ALTO #2b, rodada 18] SINERGIA, de propósito: é a única natureza com
       * DESCONTO, e o desfazer reenvia o `peso` da aresta original. Com
       * "correlação" aqui, um desfazer que jogasse o desconto fora não teria
       * desconto nenhum para jogar.
       */
      await criarRelacaoMarcada(pagina, marca, "sinergia");
      // O F5 fecha a janela de desfazer da CRIAÇÃO: o único "Desfazer" que
      // sobra depois é o da exclusão, que é o que esta medida quer medir.
      await recarregar(pagina);
      // A aresta ORIGINAL, fotografada antes de sumir: é contra ela que a
      // aresta restaurada é comparada, campo a campo.
      const foto = await fotografia();
      const chave = acharNaFoto(foto, "edges", "nota", j(marca));
      const original = chave === null ? null : camposDe(foto, chave);
      const achou = await excluirItemComMarca(pagina, marca);
      await anunciou(pagina, /Excluída\./);
      return {
        esperado: `"${marca}" NÃO está na lista`,
        obtido: presencaDe(await esperarPresenca(pagina, marca, false), marca),
        dado: { marca, achou, original },
      };
    },
    conferir: async (pagina, dado) => {
      const antes = presencaDe(await textoDasListas(pagina), dado.marca);
      await pagina.getByRole("button", { name: "Desfazer" }).first().click();
      const anuncio = await anunciou(pagina, /Relação restaurada\./);
      await recarregar(pagina);
      const original = dado.original ?? {};
      const pedidos = { ...original };
      delete pedidos.id;
      return {
        antes,
        pedido: `"${dado.marca}" está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), dado.marca),
        anuncio,
        anuncioEsperado: /Relação restaurada\./,
        anunciosProibidos: [/Relação desfeita\./],
        extra: `achei a relação para excluir=${String(
          dado.achou,
        )} · a relação original tinha ${JSON.stringify(original)}`,
        nascidas: [
          {
            colecao: "edges",
            identidade: { campo: "nota", valor: dado.marca },
            // Tudo o que a aresta original tinha, menos o id — o desconto
            // incluso. Um desfazer que devolvesse a aresta com `peso: 1`
            // reprova aqui, com o campo nomeado.
            pedidos,
            daCasa: {},
            imprevisiveis: {
              id: idNascidoNaLoja(
                "edge",
                "o store não ressuscita o id antigo — a aresta volta com id novo, e é isso que a op declara",
                String(original.id ?? "").replace(/^"|"$/g, ""),
              ),
            },
          },
        ],
      };
    },
  },
  status: {
    rota: ROTA_DOCS,
    alcance: {
      campos: [`tasks/${ID_DOCS}/status`, `tasks/${ID_DOCS}/updatedAt`],
      motivo:
        "mudar o status muda O STATUS e o carimbo `updatedAt` (o gatilho `trg_tasks_touch` do banco faz isso em toda atualização de tarefa, e o dublê passou a fazer igual — MÉDIO #5 da rodada 18). Foi aqui que a sabotagem da rodada 17 gravou também `estimativaDias: null` — e a duração desta tarefa é um campo desta mesma entidade, na fotografia.",
    },
    // O estado de partida da rota já pôs o status na primeira opção; aqui a
    // medida confere o SEU campo, de novo, antes de medir.
    precondicao: async (pagina, partida) => ({
      esperado: partida.status,
      obtido: await marcadoNoGrupo(pagina, "Status da tarefa"),
      dado: { opcoes: partida.opcoesStatus, partida: partida.status },
    }),
    /*
     * ═════════════════════════════════════════════════ ALTO #1, rodada 18 ═══
     * A CLASSE INTEIRA DOS STATUS, E O QUE FICOU GRAVADO NA LOJA.
     *
     * A versão anterior pedia `dado.opcoes[1]` — "em progresso", e só. Das
     * quatro opções do grupo, `bloqueada` não era gravada por medida nenhuma
     * desta guarda (a única vez em que ela é clicada, na medida D, o clique é
     * exigido como RECUSADO) e nem por teste de unidade nenhum. Era a 5ª forma
     * viciada: conferir o caso, não a classe.
     *
     * Sabotagem que passava, uma linha em `statusSet`:
     *   status: status === "blocked" ? "done" : status
     * A tela dizia "Status atualizado para bloqueada.", a loja guardava
     * `done`, e depois do F5 a tarefa aparecia concluída.
     *
     * Duas coisas mudaram: a medida percorre TODAS as opções que não são a de
     * partida, e cada volta confere **o valor na LOJA** (pela fotografia), não
     * só o rótulo marcado na tela — o rótulo é o que a sabotagem acerta.
     */
    conferir: async (pagina, dado) => {
      const antes = await marcadoNoGrupo(pagina, "Status da tarefa");
      const alvos = CLASSE_DO_STATUS.filter((o) => o.rotulo !== dado.partida);
      const pedidos = [];
      const obtidos = [];
      const anuncios = [];
      const naTela = [];
      for (const alvo of alvos) {
        const fraseCerta = new RegExp(
          `Status atualizado para ${escaparParaRegex(alvo.rotulo)}\\.`,
        );
        await escolherNoGrupo(pagina, "Status da tarefa", alvo.rotulo);
        const anuncio = await anunciou(pagina, fraseCerta);
        anuncios.push(`${alvo.rotulo}→${JSON.stringify(anuncio)}`);
        naTela.push(`${alvo.rotulo}→${await marcadoNoGrupo(pagina, "Status da tarefa")}`);
        await recarregar(pagina);
        const foto = await fotografia();
        const naLoja = foto.get(`tasks/${ID_DOCS}`)?.get("status") ?? "(sem campo)";
        pedidos.push(`${alvo.rotulo}: tela=${alvo.rotulo} loja=${j(alvo.valor)}`);
        obtidos.push(
          `${alvo.rotulo}: tela=${await marcadoNoGrupo(
            pagina,
            "Status da tarefa",
          )} loja=${String(naLoja)}${fraseCerta.test(anuncio) ? "" : " [ANÚNCIO ERRADO]"}`,
        );
      }
      // As opções que a TELA oferece têm de ser as da classe lida do fonte —
      // se a tela encolher, a classe não cobre mais o que o operador vê.
      const naClasse = CLASSE_DO_STATUS.map((o) => o.rotulo).join(", ");
      pedidos.push(`opções na tela=[${naClasse}]`);
      obtidos.push(`opções na tela=[${dado.opcoes.join(", ")}]`);
      const ultimo = alvos.at(-1)?.rotulo ?? "(a classe de status ficou vazia)";
      return {
        antes,
        pedido: pedidos.join(" · "),
        obtido: obtidos.join(" · "),
        anuncio: anuncios.join(" | "),
        // A frase tem de nomear O STATUS PEDIDO — não "algum status".
        anuncioEsperado: new RegExp(`Status atualizado para ${escaparParaRegex(ultimo)}\\.`),
        anunciosProibidos: [
          new RegExp(`Status atualizado para ${escaparParaRegex(dado.partida)}\\.`),
        ],
        extra: `classe de status derivada do fonte: ${JSON.stringify(
          CLASSE_DO_STATUS,
        )} · na tela ANTES de cada F5: ${naTela.join(" · ")}`,
      };
    },
  },
  mae: {
    rota: ROTA_DOCS,
    alcance: {
      campos: [`tasks/${ID_DOCS}/parentId`, `tasks/${ID_DOCS}/updatedAt`],
      motivo:
        "escolher a mãe muda o `parentId` DESTA tarefa. A mãe escolhida é um vizinho que nenhuma medida abre, e ela está na fotografia — se a escrita a tocasse, apareceria aqui. O carimbo `updatedAt` entra junto porque o BANCO o mexe em toda atualização de tarefa (gatilho `trg_tasks_touch`, migration 0001) e o dublê passou a mexer igual — MÉDIO #5, rodada 18.",
    },
    precondicao: async (pagina) => {
      const select = pagina.locator('select[aria-label="Tarefa mãe"]').first();
      return {
        esperado: "(nenhuma)",
        obtido: (await select.inputValue()) === "" ? "(nenhuma)" : await select.inputValue(),
        dado: {},
      };
    },
    conferir: async (pagina) => {
      const select = pagina.locator('select[aria-label="Tarefa mãe"]').first();
      const antes = await select.inputValue();
      const valores = await select.evaluate((el) => [...el.options].map((o) => o.value));
      const pedido = valores.find((v) => v !== "") ?? "(nenhuma opção de mãe)";
      await select.selectOption(pedido);
      const anuncio = await anunciou(pagina, /Tarefa mãe (atualizada|removida)\./);
      await recarregar(pagina);
      return {
        antes: antes === "" ? "(nenhuma)" : antes,
        pedido,
        obtido: await select
          .inputValue()
          .then((v) => (v === "" ? "(nenhuma)" : v))
          .catch(() => "(o <select> sumiu)"),
        anuncio,
        anuncioEsperado: /Tarefa mãe atualizada\./,
        // Os dois desfechos opostos da MESMA escrita: era isto que a guarda
        // aceitava sem distinguir (BAIXO #3, rodada 17).
        anunciosProibidos: [/Tarefa mãe removida\./],
      };
    },
  },
  meta: {
    rota: ROTA_DOCS,
    alcance: {
      campos: [`tasks/${ID_DOCS}/isGoal`, `tasks/${ID_DOCS}/updatedAt`],
      motivo:
        "marcar como meta muda o `isGoal` DESTA tarefa. Nenhuma outra tarefa é desmarcada pelo store, então qualquer `isGoal` de vizinho que mudasse apareceria na fotografia. O carimbo `updatedAt` entra junto porque o BANCO o mexe em toda atualização de tarefa (gatilho `trg_tasks_touch`, migration 0001) e o dublê passou a mexer igual — MÉDIO #5, rodada 18.",
    },
    precondicao: async (pagina) => ({
      esperado: "aria-pressed=false",
      obtido: `aria-pressed=${String(
        await pagina.locator("button[aria-pressed]").first().getAttribute("aria-pressed"),
      )}`,
      dado: {},
    }),
    conferir: async (pagina) => {
      const botao = () => pagina.locator("button[aria-pressed]").first();
      const antes = await botao().getAttribute("aria-pressed");
      await botao().click();
      const anuncio = await anunciou(pagina, /(Marcada como meta|Meta removida)\./);
      await recarregar(pagina);
      return {
        antes: `aria-pressed=${String(antes)}`,
        pedido: "aria-pressed=true",
        obtido: `aria-pressed=${String(await botao().getAttribute("aria-pressed"))}`,
        anuncio,
        anuncioEsperado: /Marcada como meta\./,
        anunciosProibidos: [/Meta removida\./],
      };
    },
  },
  duracao: {
    rota: ROTA_DOCS,
    alcance: {
      campos: [`tasks/${ID_DOCS}/estimativaDias`, `tasks/${ID_DOCS}/updatedAt`],
      motivo:
        "salvar a duração muda a duração DESTA tarefa, e mais nada — nem o status, nem a mãe, nem a duração de nenhuma outra tarefa do grafo. O carimbo `updatedAt` entra junto porque o BANCO o mexe em toda atualização de tarefa (gatilho `trg_tasks_touch`, migration 0001) e o dublê passou a mexer igual — MÉDIO #5, rodada 18.",
    },
    precondicao: async (pagina) => ({
      esperado: DURACAO_DE_PARTIDA,
      obtido: await duracaoNaCaixa(pagina),
      dado: {},
    }),
    /*
     * [ALTO #2, rodada 17] A CLASSE, NÃO O CASO.
     *
     * Aqui estava a medida que pedia `atual + 1` — sempre inteiro — e por isso
     * passou verde sobre um servidor que respondia sucesso e não gravava
     * fracionário. Agora ela percorre a classe DERIVADA do contrato do campo, e
     * cada valor é gravado, recarregado e relido na forma que o servidor guarda.
     */
    conferir: async (pagina) => {
      const antes = await duracaoNaCaixa(pagina);
      const pedidos = [];
      const obtidos = [];
      const anuncios = [];
      for (const bruto of CLASSE_DA_DURACAO) {
        const canonico = duracaoCanonicaNaGuarda(bruto);
        const anuncio = await salvarDuracao(pagina, bruto);
        anuncios.push(`${bruto}→${JSON.stringify(anuncio)}`);
        await recarregar(pagina);
        const naCaixa = await duracaoNaCaixa(pagina);
        pedidos.push(`${bruto}→${canonico}`);
        obtidos.push(
          `${bruto}→${naCaixa}${/Duração salva\./.test(anuncio) ? "" : " [ANÚNCIO ERRADO]"}`,
        );
      }
      return {
        antes,
        pedido: pedidos.join(" · "),
        obtido: obtidos.join(" · "),
        anuncio: anuncios.join(" | "),
        anuncioEsperado: /Duração salva\./,
        // "Duração removida." é o desfecho OPOSTO da mesma escrita.
        anunciosProibidos: [/Duração removida\./],
        extra: `classe derivada do contrato do campo: ${JSON.stringify(CLASSE_DA_DURACAO)}`,
      };
    },
  },
  atomos_salvar: {
    rota: ROTA_BUILD,
    alcance: {
      campos: [`tasks/${ID_BUILD}/assimetria`, `tasks/${ID_BUILD}/updatedAt`],
      motivo:
        "salvar os átomos escreve o objeto `assimetria` DESTA tarefa. O score de prioridade é calculado da leitura, não gravado — então nenhum outro campo pode mudar junto. O carimbo `updatedAt` entra junto porque o BANCO o mexe em toda atualização de tarefa (gatilho `trg_tasks_touch`, migration 0001) e o dublê passou a mexer igual — MÉDIO #5, rodada 18.",
    },
    precondicao: async (pagina) => ({
      esperado: TRIO_LIMPO,
      obtido: await trioNaTela(pagina),
      dado: {},
    }),
    conferir: async (pagina) => {
      const antes = await trioNaTela(pagina);
      const { trio, anuncio } = await declararTrio(pagina);
      const naTela = await trioNaTela(pagina);
      await recarregar(pagina);
      return {
        antes,
        pedido: trio,
        obtido: await trioNaTela(pagina),
        anuncio,
        anuncioEsperado: /Átomos salvos\./,
        anunciosProibidos: [/Átomos limpos\./, /Átomos restaurados\./],
        extra: `na tela ANTES do F5=${JSON.stringify(naTela)}`,
      };
    },
  },
  atomos_limpar: {
    rota: ROTA_BUILD,
    alcance: {
      campos: [`tasks/${ID_BUILD}/assimetria`, `tasks/${ID_BUILD}/updatedAt`],
      motivo:
        "limpar os átomos apaga o objeto `assimetria` DESTA tarefa — é o campo que a precondição acabou de escrever, e nenhum outro. O carimbo `updatedAt` entra junto porque o BANCO o mexe em toda atualização de tarefa (gatilho `trg_tasks_touch`, migration 0001) e o dublê passou a mexer igual — MÉDIO #5, rodada 18.",
    },
    precondicao: async (pagina) => {
      const { trio } = await declararTrio(pagina);
      await recarregar(pagina);
      return { esperado: trio, obtido: await trioNaTela(pagina), dado: { trio } };
    },
    conferir: async (pagina) => {
      const antes = await trioNaTela(pagina);
      await pagina.getByRole("button", { name: "Limpar átomos" }).click();
      const anuncio = await anunciou(pagina, /Átomos limpos\./);
      await recarregar(pagina);
      return {
        antes,
        pedido: TRIO_LIMPO,
        obtido: await trioNaTela(pagina),
        anuncio,
        anuncioEsperado: /Átomos limpos\./,
        anunciosProibidos: [/Átomos restaurados\./, /Átomos salvos\./],
      };
    },
  },
  atomos_desfazer_limpeza: {
    rota: ROTA_BUILD,
    alcance: {
      campos: [`tasks/${ID_BUILD}/assimetria`, `tasks/${ID_BUILD}/updatedAt`],
      motivo:
        "desfazer a limpeza devolve o MESMO objeto `assimetria` que a precondição declarou antes de limpar — e nada mais da loja participa desse caminho de volta. O carimbo `updatedAt` entra junto porque o BANCO o mexe em toda atualização de tarefa (gatilho `trg_tasks_touch`, migration 0001) e o dublê passou a mexer igual — MÉDIO #5, rodada 18.",
    },
    precondicao: async (pagina) => {
      const { trio } = await declararTrio(pagina);
      await recarregar(pagina);
      await pagina.getByRole("button", { name: "Limpar átomos" }).click();
      await anunciou(pagina, /Átomos limpos\./);
      const ate = Date.now() + 15000;
      let agora = await trioNaTela(pagina);
      while (agora !== TRIO_LIMPO && Date.now() < ate) {
        await pagina.waitForTimeout(250);
        agora = await trioNaTela(pagina);
      }
      return { esperado: TRIO_LIMPO, obtido: agora, dado: { trio } };
    },
    conferir: async (pagina, dado) => {
      const antes = await trioNaTela(pagina);
      await pagina.getByRole("button", { name: "Desfazer" }).first().click();
      const anuncio = await anunciou(pagina, /Átomos restaurados\./);
      await recarregar(pagina);
      return {
        antes,
        pedido: dado.trio,
        obtido: await trioNaTela(pagina),
        anuncio,
        anuncioEsperado: /Átomos restaurados\./,
        anunciosProibidos: [/Átomos limpos\./],
      };
    },
  },
};

/** Escapa o que vier do produto antes de virar expressão regular. */
function escaparParaRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


/*
 * ═══════════════════════════════════════════════════════ ALTO #1, rodada 20 ═
 * N · TODA AÇÃO DE ESCRITA DA PÁGINA, EXERCIDA NUMA ABA ENVELHECIDA — A CLASSE,
 *     NÃO MAIS UM CASO POR RODADA.
 *
 * Três rodadas seguidas responderam à MESMA pergunta ("isto ainda funciona
 * depois que o tempo passa?") com uma cura que pegava UM caso:
 *
 *   | rodada | o que a defesa passou a cobrir      | por onde o crítico entrou |
 *   |    18  | o CONTRATO dos campos (type/inputMode) | o relógio mudou o VALOR |
 *   |    19  | o VALOR do campo e a AÇÃO "salvar duração" | o relógio matou OUTRA ação |
 *
 * A sabotagem da rodada 19-B passou nos CINCO portões (1531 testes, tsc,
 * contraste, eslint, "55 medidas, todas dentro da régua") — em
 * `notas-painel.tsx`, dentro de `FormularioNovaNota`:
 *
 *     const emRepousoRef = useRef(false);
 *     useEffect(() => {
 *       const t = window.setTimeout(() => { emRepousoRef.current = true; }, 60_000);
 *       return () => { window.clearTimeout(t); };
 *     }, []);
 *     …
 *     function aoEnviar(e) {
 *       e.preventDefault();
 *       if (emRepousoRef.current) return;   // ← a nota some em silêncio
 *
 * Medido no Chromium, com a sabotagem conferida presente antes e depois:
 * esperar 5 s → "Nota salva.", notas na loja 0 → 1; esperar 65 s → a tela não
 * diz nada, notas na loja 0 → 0.
 *
 * **Qual das cinco formas: a 5ª — "confere o caso, não a classe", pela terceira
 * vez.** A defesa da rodada 19 exercia UMA das quinze ações de escrita da
 * página; as outras catorze continuavam sendo só OLHADAS.
 *
 * ## A régua desta rodada é DERIVADA — não há lista nova escrita à mão
 *
 * O universo destas medidas é `OPERACOES_DE_ESCRITA`, lido de
 * `src/app/tarefa/pedido.ts` pelo mesmo `OPS_DA_PAGINA` que a medida P0 já usa
 * (e que ela já confere contra a união de tipo, em duas leituras
 * independentes). A tabela `ACAO_ENVELHECIDA_POR_OP` abaixo tem uma linha por
 * op, e o fecho é NOS DOIS SENTIDOS, como em P0: op da página sem exercício
 * envelhecido reprova nomeando a op; linha da tabela que não existe mais na
 * página também. Ação nova no produto entra sozinha na cobertura — e, se
 * entrar sem linha aqui, a medida N0 a nomeia.
 *
 * ## O exercício é o da rodada 19, replicado para as quinze
 *
 * Com a aba viva há pelo menos `PISO_DE_VIDA_PARA_A_ESCRITA_MS` (e, na
 * sentinela de relógio, depois dos DOIS adiantamentos de meia hora que a
 * medida K já fez), cada op:
 *
 *   1. deixa a página no estado em que aquela ação existe (`preparar`) — sem
 *      F5 nenhum, porque recarregar é justamente o que ressuscita a aba;
 *   2. lê na LOJA o que a ação move (`alvo`), pela mesma `fotografia()` da
 *      família P;
 *   3. PEDE UM VALOR DIFERENTE do que está lá e executa a ação na tela;
 *   4. exige que o pedido tenha chegado à loja.
 *
 * As quatro reprovações são as mesmas quatro da rodada 19, uma por linha e
 * cada uma nomeando o que quebrou: o controle não ficou com o que foi pedido ·
 * a tela não anunciou · a loja não mudou · a loja já tinha o valor pedido (aí a
 * medida não mediu ação nenhuma).
 *
 * ## A COBERTURA, e o que ficou de fora — declarado, derivado, não escolhido
 *
 * Quinze ops × seis sentinelas seriam noventa exercícios, e cada exercício é
 * uma ida real ao servidor. A redução é DERIVADA e está numa função só
 * (`fatiaDaRota`): a op de índice `i` cai na rota `i % 3`. Como cada rota tem
 * DUAS sentinelas (relógio de verdade e relógio da guarda), **toda op é
 * exercida exatamente duas vezes — uma em cada relógio** — e a união das três
 * fatias é o universo inteiro, em cada relógio. São 30 exercícios.
 *
 * O que isso NÃO alcança está dito por escrito na medida Z: cada op é exercida
 * em UMA rota (a que o índice dela manda), então uma quebra que só apareça em
 * OUTRA rota, naquela op, fica fora. Não é "escolhi a duração porque é a mais
 * importante": é uma regra de distribuição que um `op` novo obedece sozinho.
 *
 * ## O piso é contado FORA das medidas que ele protege
 *
 * Apagar os trinta exercícios deixaria trinta ausências — e ausência combina
 * com "nenhum problema". `N0` conta os exercícios BEM-SUCEDIDOS num contador de
 * módulo, cobra o piso escrito à mão (`PISO_DE_ACOES_ENVELHECIDAS`), e exige
 * que CADA op apareça nos DOIS relógios. E os nomes das trinta medidas entram
 * em `MEDIDAS_EXIGIDAS` derivados da mesma distribuição: apagar um exercício
 * some do relatório e é cobrado lá também.
 */

/** As opções NUMÉRICAS de um grupo segmentado do produto, lidas do fonte. */
function opcoesNumericasDoFonte(arquivo, nome) {
  const src = semComentarios(
    readFileSync(join(RAIZ_DO_PACOTE, "src", "components", "task", arquivo), "utf8"),
  );
  const bloco = new RegExp(`const ${nome}[^=]*=\\s*\\[([\\s\\S]*?)\\];`).exec(src);
  if (bloco === null) return [];
  return [
    ...(bloco[1] ?? "").matchAll(/\{\s*valor:\s*(-?\d+(?:\.\d+)?),\s*rotulo:\s*"([^"]+)"\s*\}/g),
  ].map((m) => ({ valor: Number(m[1]), rotulo: m[2] ?? "" }));
}

/** A classe dos átomos, derivada do fonte — os rótulos E os números gravados. */
const CLASSE_DE_OPCIONALIDADE = opcoesNumericasDoFonte("atomos-form.tsx", "OPCOES_OPCIONALIDADE");
const CLASSE_DE_ESFORCO_CUSTO = opcoesNumericasDoFonte("atomos-form.tsx", "OPCOES_ESFORCO_CUSTO");

/** Piso escrito à mão das duas classes de átomo — encolher aparece no diff. */
const PISO_DE_OPCIONALIDADE = 3;
const PISO_DE_ESFORCO_CUSTO = 4;

/*
 * ── AS REGIÕES VIVAS, LIDAS POR MUDANÇA — e não por "a frase está na página" ──
 *
 * Na sentinela do relógio o tempo está sob controle da guarda: o `setTimeout`
 * de 4 s que apaga a `MensagemSucesso` NÃO dispara sozinho, então toda frase
 * anunciada fica na tela para sempre. Um `anunciou(/Excluída\./)` cru passaria
 * verde lendo a frase que a op ANTERIOR deixou — e a op medida poderia não ter
 * anunciado nada. Aqui cada região é fotografada por IDENTIDADE DE NÓ (um
 * `WeakMap` no contexto da página) antes da ação, e só conta o texto que MUDOU
 * depois dela. Região que nasce agora conta como mudada, que é o lado seguro.
 */
async function instantanearRegioes(pagina) {
  await pagina.evaluate(() => {
    const mapa = new window.WeakMap();
    for (const el of document.querySelectorAll('[role="alert"], [role="status"]')) {
      mapa.set(el, (el.innerText || "").trim());
    }
    window.__p6RegioesAntes = mapa;
    /*
     * ═══════════════════════════════════════════════════ ALTO, rodada 22 ═
     * O HISTÓRICO DE CADA REGIÃO, e não só o texto de antes e o de depois.
     *
     * Com a frase da ação anterior AINDA na tela, a 2ª vez de "Salvar nota"
     * termina com o MESMO texto ("Nota salva."): comparar antes × depois diria
     * "a região não mudou" sobre uma região que passou por "Salvando…" e foi
     * reescrita — e reprovaria um produto certo, ou, pior, deixaria a guarda
     * incapaz de distinguir a frase da 2ª da frase da 1ª que ficou. Aqui cada
     * mutação de conteúdo (`childList`/`characterData`) dentro de uma região
     * viva registra o texto que ela passou a ter. "Mudou" passa a ser o que a
     * palavra diz: o conteúdo foi reescrito depois da fotografia.
     * Atributos não entram de propósito (`aria-busy`, classe): não são frase.
     */
    window.__p6Observador?.disconnect();
    const historico = new window.WeakMap();
    const observador = new window.MutationObserver((lista) => {
      for (const m of lista) {
        const alvo = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        const regiao = alvo?.closest?.('[role="alert"], [role="status"]') ?? null;
        if (regiao === null) continue;
        const h = historico.get(regiao) ?? [];
        const texto = (regiao.textContent || "").replace(/\s+/g, " ").trim();
        if (h.at(-1) !== texto) h.push(texto);
        historico.set(regiao, h);
      }
    });
    observador.observe(document.body, { subtree: true, childList: true, characterData: true });
    window.__p6Observador = observador;
    window.__p6Historico = historico;
  });
}

/** A região em que a última frase lida por `anunciouMudando` apareceu. */
const ATRIBUTO_DO_ANUNCIO = "data-p6-anunciou";

/**
 * As regiões vivas cujo conteúdo MUDOU depois da fotografia — texto diferente,
 * ou reescrito passando por outro texto (o histórico acima). Com `padrao`, a
 * primeira que casar é MARCADA na página (`data-p6-anunciou`), com o instante
 * em que a guarda a viu: é assim que a medida N3 sabe, depois, ONDE a frase de
 * uma vez ficou — e confere que ela continua lá no instante do disparo da vez
 * seguinte.
 */
async function regioesQueMudaram(pagina, padrao = null) {
  return await pagina.evaluate(
    ({ fonte, atributo }) => {
      const mapa = window.__p6RegioesAntes;
      const historico = window.__p6Historico;
      const quero = fonte === null ? null : new RegExp(fonte);
      const normal = (t) => t.replace(/\s+/g, " ").trim();
      const mudadas = [];
      let marcou = false;
      for (const el of document.querySelectorAll('[role="alert"], [role="status"]')) {
        const texto = (el.innerText || "").trim();
        if (texto.length === 0) continue;
        const reescrita = (historico?.get(el) ?? []).some((h) => h !== normal(texto));
        if (mapa === undefined || mapa.get(el) !== texto || reescrita) {
          mudadas.push(texto);
          if (quero !== null && !marcou && quero.test(texto)) {
            for (const antigo of document.querySelectorAll(`[${atributo}]`)) {
              antigo.removeAttribute(atributo);
            }
            el.setAttribute(atributo, String(window.performance.now()));
            marcou = true;
          }
        }
      }
      return mudadas;
    },
    { fonte: padrao === null ? null : padrao.source, atributo: ATRIBUTO_DO_ANUNCIO },
  );
}

/** Espera uma região viva MUDAR para um texto que case com a frase pedida. */
async function anunciouMudando(pagina, regex, limiteMs = 20000) {
  const ate = Date.now() + limiteMs;
  let ultimo = "(nenhuma região viva mudou de conteúdo)";
  while (Date.now() < ate) {
    const mudadas = await regioesQueMudaram(pagina, regex);
    const casou = mudadas.find((t) => regex.test(t));
    if (casou !== undefined) return casou;
    if (mudadas.length > 0) ultimo = mudadas.join(" | ");
    await pagina.waitForTimeout(200);
  }
  return ultimo;
}

/**
 * O botão "Desfazer" DAQUELE painel, achado subindo a partir de uma âncora.
 *
 * A página pode ter três janelas de desfazer abertas ao mesmo tempo (notas,
 * relações e átomos) — e, na sentinela do relógio, elas não se fecham sozinhas,
 * porque a janela de 10 s é um `setTimeout` que só anda quando a guarda manda.
 * Um `getByRole("button", { name: "Desfazer" }).first()` desfaria o painel
 * errado. Aqui a busca sobe do elemento-âncora daquele painel até achar o
 * primeiro "Desfazer" do MESMO subtrecho, marca-o com um atributo próprio da
 * guarda, e o clique é o do Playwright (com as checagens de visibilidade e
 * alcance que um `el.click()` cru não faria).
 */
const ATRIBUTO_DO_DESFAZER = "data-p6-desfazer";

/**
 * A busca usa `textContent`, NÃO `innerText` — medido na rodada 20, com a
 * máquina a 36 de carga: `innerText` depende do layout já ter sido calculado,
 * e a janela de desfazer que ACABOU de aparecer devolvia string vazia aqui ao
 * mesmo tempo em que a leitura de anúncio (200 ms depois) já lia
 * "Excluída. Desfazer". A medida reprovava um produto que estava certo. E a
 * busca insiste por alguns segundos, porque o botão nasce depois que o
 * servidor responde — insistir é esperar o botão existir, não afrouxar nada:
 * passado o limite, a reprovação sai com o nome da janela que faltou.
 */
async function clicarDesfazerDoPainel(pagina, ancora, frase, limiteMs = 6000) {
  const ate = Date.now() + limiteMs;
  let achou = "(a âncora deste painel não existe na tela)";
  while (Date.now() < ate) {
    const no = await ancora.elementHandle();
    if (no !== null) {
      achou = await no.evaluate(
        (el, { atributo, padrao }) => {
          for (const antigo of document.querySelectorAll(`[${atributo}]`)) {
            antigo.removeAttribute(atributo);
          }
          const quero = new RegExp(padrao);
          let atual = el;
          while (atual !== null) {
            for (const regiao of atual.querySelectorAll('[role="status"]')) {
              if (!quero.test((regiao.textContent ?? "").trim())) continue;
              const botao = [...regiao.querySelectorAll("button")].find(
                (b) => (b.textContent ?? "").trim() === "Desfazer",
              );
              if (botao !== undefined) {
                botao.setAttribute(atributo, "1");
                return "ok";
              }
            }
            atual = atual.parentElement;
          }
          return `(não achei, neste painel, a janela de desfazer que diz ${padrao})`;
        },
        { atributo: ATRIBUTO_DO_DESFAZER, padrao: frase.source },
      );
    }
    if (achou === "ok") break;
    await pagina.waitForTimeout(150);
  }
  if (achou !== "ok") return achou;
  await pagina.locator(`[${ATRIBUTO_DO_DESFAZER}]`).first().click();
  return "ok";
}

/** Espera a TELA chegar ao que se pediu — o servidor redesenha depois do clique. */
async function esperarNaTela(ler, esperado, limiteMs = 15000) {
  const ate = Date.now() + limiteMs;
  let lido = await ler();
  while (lido !== esperado && Date.now() < ate) {
    await new Promise((ok) => setTimeout(ok, 250));
    lido = await ler();
  }
  return lido;
}

/**
 * A natureza que a família N usa nas quatro ops de relação: a do DESCONTO — o
 * único número do formulário de relação, e o campo a mais a exercer. A pergunta
 * desta família é "a ação ainda funciona depois do tempo", não "as quatro
 * naturezas gravam certo": essa é a classe que a família P percorre, e o limite
 * está dito na medida Z.
 */
const TIPO_DA_RELACAO_ENVELHECIDA = CLASSE_DE_TIPOS_DE_RELACAO.find(
  (t) => t.valor === "sinergia",
) ??
  CLASSE_DE_TIPOS_DE_RELACAO.at(-1) ?? { valor: "(classe vazia)", rotulo: "(classe vazia)" };

/** As âncoras de cada painel — o elemento que só existe naquele painel. */
function ancoraDeNotas(pagina) {
  return campoPorNome(pagina, /^Nova nota$/).first();
}
function ancoraDeRelacoes(pagina) {
  return pagina.getByLabel("Destino").first();
}
function ancoraDeAtomos(pagina) {
  return pagina.getByRole("button", { name: "Salvar átomos" }).first();
}

/** Espera a LOJA refletir o que se pediu, lendo pelo `alvo` daquela op. */
async function esperarAlvo(entrada, ctx, esperado, limiteMs = ESPERA_DA_LOJA_MS) {
  const ate = Date.now() + limiteMs;
  let lido = entrada.alvo(await fotografia(), ctx);
  while (lido !== esperado && Date.now() < ate) {
    await new Promise((ok) => setTimeout(ok, 400));
    lido = entrada.alvo(await fotografia(), ctx);
  }
  return lido;
}

/** Presença de uma entidade marcada, lida da loja (nunca da lista da tela). */
function presencaNaLoja(foto, colecao, campo, marca) {
  return acharNaFoto(foto, colecao, campo, j(marca)) === null
    ? `"${marca}" NÃO está na loja`
    : `"${marca}" está na loja`;
}
function estaNaLoja(marca) {
  return `"${marca}" está na loja`;
}
function naoEstaNaLoja(marca) {
  return `"${marca}" NÃO está na loja`;
}

/** Um campo da tarefa aberta, lido da loja. */
function campoDaTarefa(foto, chave, campo) {
  return foto.get(chave)?.get(campo) ?? "(a tarefa não está na loja)";
}

/** Os três átomos como a LOJA os guarda, sem depender da ordem das chaves. */
function trioNaLoja(foto, chave) {
  const bruto = foto.get(chave)?.get("assimetria");
  if (bruto === undefined) return "(a tarefa não está na loja)";
  let v = null;
  try {
    v = JSON.parse(bruto);
  } catch {
    return `(assimetria ilegível: ${bruto})`;
  }
  if (v === null || typeof v !== "object") return "(sem átomos)";
  return `O=${String(v.opcionalidade)} E=${String(v.esforco)} C=${String(v.custo)}`;
}

/** O trio na forma da loja, a partir das três opções escolhidas. */
function trioDaEscolha(o, e, c) {
  return `O=${String(o.valor)} E=${String(e.valor)} C=${String(c.valor)}`;
}

/**
 * Escolhe um trio de átomos que é DIFERENTE do que está na tela e do que está
 * na loja — os dois precisam diferir: igual ao da tela, a porta recusa o envio
 * ("nada mudou"); igual ao da loja, a medida não mediria ação nenhuma.
 * Esforço ≠ Custo de propósito (com os dois iguais, trocar um pelo outro no
 * despacho seria invisível — a sabotagem do ALTO #1 da rodada 16).
 */
function escolherTrioDiferente(naTela, naLoja, evitar = []) {
  for (const o of CLASSE_DE_OPCIONALIDADE) {
    for (const e of CLASSE_DE_ESFORCO_CUSTO) {
      for (const c of CLASSE_DE_ESFORCO_CUSTO) {
        if (e.valor === c.valor) continue;
        const rotulos = `Opcionalidade=${o.rotulo} · Esforço=${e.rotulo} · Custo=${c.rotulo}`;
        if (rotulos === naTela) continue;
        if (trioDaEscolha(o, e, c) === naLoja) continue;
        // [ALTO, rodada 21] a 2ª vez da família N2 pede um trio que a 1ª não pediu.
        if (evitar.includes(trioDaEscolha(o, e, c))) continue;
        return { o, e, c, rotulos, naLoja: trioDaEscolha(o, e, c) };
      }
    }
  }
  return null;
}

/** Declara na tela o trio escolhido e devolve o anúncio que mudou. */
async function declararTrioEscolhido(pagina, escolha) {
  await escolherNoGrupo(pagina, "Opcionalidade", escolha.o.rotulo);
  await escolherNoGrupo(pagina, "Esforço", escolha.e.rotulo);
  await escolherNoGrupo(pagina, "Custo", escolha.c.rotulo);
  await instantanearRegioes(pagina);
  await pagina.getByRole("button", { name: "Salvar átomos" }).first().click();
  return await anunciouMudando(pagina, /Átomos salvos\./);
}

/** Cria uma nota marcada numa aba envelhecida; espera pela LOJA, não pela tela. */
async function criarNotaEnvelhecida(pagina, marca) {
  await campoPorNome(pagina, /^Nova nota$/)
    .first()
    .fill(marca);
  await pagina.getByRole("button", { name: "Salvar nota" }).first().click();
  const anuncio = "(a preparação não lê anúncio: ela espera a LOJA)";
  const naLoja = await esperarAlvoBruto(
    (foto) => presencaNaLoja(foto, "notes", "texto", marca),
    estaNaLoja(marca),
  );
  await esperarPresenca(pagina, marca, true);
  return { anuncio, naLoja };
}

/** A espera genérica sobre a loja, para os passos de PREPARAÇÃO. */
async function esperarAlvoBruto(ler, esperado, limiteMs = ESPERA_DA_LOJA_MS) {
  const ate = Date.now() + limiteMs;
  let lido = ler(await fotografia());
  while (lido !== esperado && Date.now() < ate) {
    await new Promise((ok) => setTimeout(ok, 400));
    lido = ler(await fotografia());
  }
  return lido;
}

/**
 * O destino para o qual esta tarefa AINDA NÃO tem aresta desta natureza —
 * calculado da LOJA, não por tentativa e erro.
 *
 * A primeira versão tentava destino por destino e lia a recusa ("Já existe uma
 * aresta desse tipo…") na região viva. Medido na rodada 20: a recusa é a MESMA
 * FRASE a cada tentativa, então a região não MUDA da segunda em diante, a
 * leitura por mudança esperava o limite inteiro, e a preparação de
 * `relacao_desfazer_exclusao` gastava a janela de 10 s do "Desfazer" antes de
 * chegar a clicar nele. Aqui a regra do servidor (origem × destino × tipo é
 * única) é aplicada ANTES do clique, e a tentativa é uma só.
 */
async function destinoLivre(pagina, origem, tipo) {
  const valores = await pagina
    .getByLabel("Destino")
    .first()
    .evaluate((el) => [...el.options].map((o) => o.value).filter((v) => v !== ""));
  const foto = await fotografia();
  const ocupados = new Set();
  for (const [chave, campos] of foto) {
    if (colecaoDe(chave) !== "edges") continue;
    if (campos.get("tipo") !== j(tipo)) continue;
    const a = JSON.parse(campos.get("origem") ?? "null");
    const b = JSON.parse(campos.get("destino") ?? "null");
    if (a === origem) ocupados.add(b);
    if (b === origem) ocupados.add(a);
  }
  return valores.find((v) => !ocupados.has(v)) ?? null;
}

/** Cria uma relação marcada numa aba envelhecida; espera pela LOJA. */
async function criarRelacaoEnvelhecida(pagina, ctx, marca, tipo) {
  await escolherNoGrupo(pagina, "Tipo de relação", tipo.rotulo);
  await pagina.waitForTimeout(250);
  const destino = await destinoLivre(pagina, idDe(ctx.chave), tipo.valor);
  if (destino === null) {
    return { ok: false, anuncio: "(esta tarefa já tem aresta desta natureza para todo destino)" };
  }
  const desconto = campoPorNome(pagina, /^Desconto/).first();
  const temDesconto = (await desconto.count()) === 1;
  await pagina.getByLabel("Destino").first().selectOption(destino);
  await campoPorNome(pagina, /^Nota da relação/)
    .first()
    .fill(marca);
  if (temDesconto) await desconto.fill(DESCONTO_PEDIDO);
  await instantanearRegioes(pagina);
  await pagina.getByRole("button", { name: "Adicionar relação" }).first().click();
  const anuncio = await anunciouMudando(pagina, /Relação criada\./, 12000);
  const naLoja = await esperarAlvoBruto(
    (foto) => presencaNaLoja(foto, "edges", "nota", marca),
    estaNaLoja(marca),
  );
  await esperarPresenca(pagina, marca, true);
  return { ok: naLoja === estaNaLoja(marca), anuncio, destino, naLoja };
}

/** Exclui (dois cliques) o item marcado e espera a LOJA perder a entidade. */
async function excluirEnvelhecido(pagina, marca, colecao, campo) {
  const achou = await excluirItemComMarca(pagina, marca);
  const anuncio = achou
    ? "(a preparação não lê anúncio: ela espera a LOJA)"
    : "(não achei o item para excluir)";
  const naLoja = await esperarAlvoBruto(
    (foto) => presencaNaLoja(foto, colecao, campo, marca),
    naoEstaNaLoja(marca),
  );
  return { achou, anuncio, naLoja };
}

/**
 * A TABELA DAS AÇÕES ENVELHECIDAS — uma linha por op da lista canônica.
 *
 *  - `alvo(foto, ctx)` — o que ESTA ação move, lido da loja inteira;
 *  - `preparar(pagina, ctx)` — o estado em que a ação existe, sem nenhum F5.
 *     Pode devolver `{ antes }` quando a própria preparação já leu a loja
 *     (é o caso das três janelas de "Desfazer", que duram 10 s em tempo real:
 *     uma leitura a mais entre a preparação e o clique custaria a janela);
 *  - `exercer(pagina, ctx)` — a ação na tela; devolve o valor PEDIDO, o que o
 *     controle ficou mostrando e o anúncio que a região viva passou a ter.
 */
const ACAO_ENVELHECIDA_POR_OP = {
  nota_criar: {
    alvo: (foto, ctx) => presencaNaLoja(foto, "notes", "texto", ctx.marca),
    exercer: async (pagina, ctx) => {
      const caixa = campoPorNome(pagina, /^Nova nota$/).first();
      await caixa.fill(ctx.marca);
      const naTela = await caixa.inputValue();
      await instantanearRegioes(pagina);
      await pagina.getByRole("button", { name: "Salvar nota" }).first().click();
      return {
        pedido: estaNaLoja(ctx.marca),
        naTela,
        naTelaEsperada: ctx.marca,
        anuncio: await anunciouMudando(pagina, /Nota salva\./),
        anuncioEsperado: /Nota salva\./,
        controle: "a caixa 'Nova nota'",
      };
    },
  },
  nota_excluir: {
    alvo: (foto, ctx) => presencaNaLoja(foto, "notes", "texto", ctx.marca),
    preparar: async (pagina, ctx) => {
      await criarNotaEnvelhecida(pagina, ctx.marca);
    },
    exercer: async (pagina, ctx) => {
      await instantanearRegioes(pagina);
      const achou = await excluirItemComMarca(pagina, ctx.marca);
      const anuncio = achou
        ? await anunciouMudando(pagina, /Excluída\./)
        : "(não achei a nota para excluir)";
      return {
        pedido: naoEstaNaLoja(ctx.marca),
        naTela: presencaDe(await esperarPresenca(pagina, ctx.marca, false), ctx.marca),
        naTelaEsperada: `"${ctx.marca}" NÃO está na lista`,
        anuncio,
        anuncioEsperado: /Excluída\./,
        controle: "a lista de notas",
      };
    },
  },
  nota_desfazer: {
    alvo: (foto, ctx) => presencaNaLoja(foto, "notes", "texto", ctx.marca),
    preparar: async (pagina, ctx) => {
      await criarNotaEnvelhecida(pagina, ctx.marca);
      const r = await excluirEnvelhecido(pagina, ctx.marca, "notes", "texto");
      return { antes: r.naLoja };
    },
    exercer: async (pagina, ctx) => {
      await instantanearRegioes(pagina);
      const clique = await clicarDesfazerDoPainel(pagina, ancoraDeNotas(pagina), /Excluída\./);
      return {
        pedido: estaNaLoja(ctx.marca),
        naTela: clique,
        naTelaEsperada: "ok",
        anuncio: await anunciouMudando(pagina, /Nota restaurada\./),
        anuncioEsperado: /Nota restaurada\./,
        controle: 'o botão "Desfazer" do painel de notas',
      };
    },
  },
  subtarefa_criar: {
    alvo: (foto, ctx) => presencaNaLoja(foto, "tasks", "title", ctx.marca),
    exercer: async (pagina, ctx) => {
      const caixa = campoPorNome(pagina, /^Título da subtarefa$/).first();
      await caixa.fill(ctx.marca);
      await campoPorNome(pagina, /^Duração \(dias\)$/)
        .first()
        .fill("1.5");
      const naTela = await caixa.inputValue();
      await instantanearRegioes(pagina);
      await pagina.getByRole("button", { name: "Adicionar subtarefa" }).first().click();
      return {
        pedido: estaNaLoja(ctx.marca),
        naTela,
        naTelaEsperada: ctx.marca,
        anuncio: await anunciouMudando(pagina, /Subtarefa criada\./),
        anuncioEsperado: /Subtarefa criada\./,
        controle: "a caixa 'Título da subtarefa'",
      };
    },
  },
  relacao_criar: {
    alvo: (foto, ctx) => presencaNaLoja(foto, "edges", "nota", ctx.marca),
    exercer: async (pagina, ctx) => {
      const r = await criarRelacaoEnvelhecida(pagina, ctx, ctx.marca, TIPO_DA_RELACAO_ENVELHECIDA);
      return {
        pedido: estaNaLoja(ctx.marca),
        naTela: r.ok ? "ok" : r.anuncio,
        naTelaEsperada: "ok",
        anuncio: r.anuncio,
        anuncioEsperado: /Relação criada\./,
        controle: "o formulário de relação (natureza sinergia, com desconto)",
      };
    },
  },
  relacao_excluir: {
    alvo: (foto, ctx) => presencaNaLoja(foto, "edges", "nota", ctx.marca),
    preparar: async (pagina, ctx) => {
      await criarRelacaoEnvelhecida(pagina, ctx, ctx.marca, TIPO_DA_RELACAO_ENVELHECIDA);
    },
    exercer: async (pagina, ctx) => {
      await instantanearRegioes(pagina);
      const achou = await excluirItemComMarca(pagina, ctx.marca);
      const anuncio = achou
        ? await anunciouMudando(pagina, /Excluída\./)
        : "(não achei a relação para excluir)";
      return {
        pedido: naoEstaNaLoja(ctx.marca),
        naTela: presencaDe(await esperarPresenca(pagina, ctx.marca, false), ctx.marca),
        naTelaEsperada: `"${ctx.marca}" NÃO está na lista`,
        anuncio,
        anuncioEsperado: /Excluída\./,
        controle: "a lista de relações",
      };
    },
  },
  relacao_desfazer_criacao: {
    alvo: (foto, ctx) => presencaNaLoja(foto, "edges", "nota", ctx.marca),
    preparar: async (pagina, ctx) => {
      const r = await criarRelacaoEnvelhecida(pagina, ctx, ctx.marca, TIPO_DA_RELACAO_ENVELHECIDA);
      return { antes: r.naLoja ?? naoEstaNaLoja(ctx.marca) };
    },
    exercer: async (pagina, ctx) => {
      await instantanearRegioes(pagina);
      const clique = await clicarDesfazerDoPainel(
        pagina,
        ancoraDeRelacoes(pagina),
        /Relação criada\./,
      );
      return {
        pedido: naoEstaNaLoja(ctx.marca),
        naTela: clique,
        naTelaEsperada: "ok",
        anuncio: await anunciouMudando(pagina, /Relação desfeita\./),
        anuncioEsperado: /Relação desfeita\./,
        controle: 'o botão "Desfazer" do painel de relações',
      };
    },
  },
  relacao_desfazer_exclusao: {
    alvo: (foto, ctx) => presencaNaLoja(foto, "edges", "nota", ctx.marca),
    preparar: async (pagina, ctx) => {
      await criarRelacaoEnvelhecida(pagina, ctx, ctx.marca, TIPO_DA_RELACAO_ENVELHECIDA);
      const r = await excluirEnvelhecido(pagina, ctx.marca, "edges", "nota");
      return { antes: r.naLoja };
    },
    exercer: async (pagina, ctx) => {
      await instantanearRegioes(pagina);
      const clique = await clicarDesfazerDoPainel(
        pagina,
        ancoraDeRelacoes(pagina),
        /Excluída\./,
      );
      return {
        pedido: estaNaLoja(ctx.marca),
        naTela: clique,
        naTelaEsperada: "ok",
        anuncio: await anunciouMudando(pagina, /Relação restaurada\./),
        anuncioEsperado: /Relação restaurada\./,
        controle: 'o botão "Desfazer" do painel de relações',
      };
    },
  },
  status: {
    alvo: (foto, ctx) => campoDaTarefa(foto, ctx.chave, "status"),
    exercer: async (pagina, ctx) => {
      const marcado = await marcadoNoGrupo(pagina, "Status da tarefa");
      const naLoja = ctx.antes;
      /*
       * [ALTO, rodada 21] Na 2ª vez (família N2) o status é uma ação que
       * ALTERNA estado, e "funciona de novo" para ele é ir e VOLTAR: `ctx.volta`
       * é o valor que a loja tinha antes da 1ª vez, e é ele que se pede agora.
       */
      const alvo =
        ctx.volta === undefined
          ? CLASSE_DO_STATUS.find(
              (o) => o.rotulo !== marcado && j(o.valor) !== naLoja && !ctx.evitar.includes(j(o.valor)),
            )
          : CLASSE_DO_STATUS.find((o) => j(o.valor) === ctx.volta && o.rotulo !== marcado);
      if (alvo === undefined) {
        return {
          pedido:
            ctx.volta === undefined
              ? "(a classe de status não ofereceu um valor diferente)"
              : `(a classe de status não tem o valor de volta ${ctx.volta}, ou ele já está marcado)`,
          naTela: "(sem alvo)",
          naTelaEsperada: "ok",
          anuncio: "(a ação não chegou a ser exercida)",
          anuncioEsperado: /(?!)/,
          controle: 'o grupo "Status da tarefa"',
        };
      }
      await instantanearRegioes(pagina);
      await escolherNoGrupo(pagina, "Status da tarefa", alvo.rotulo);
      const anuncio = await anunciouMudando(
        pagina,
        new RegExp(`Status atualizado para ${escaparParaRegex(alvo.rotulo)}\\.`),
      );
      return {
        pedido: j(alvo.valor),
        naTela: await marcadoNoGrupo(pagina, "Status da tarefa"),
        naTelaEsperada: alvo.rotulo,
        anuncio,
        anuncioEsperado: new RegExp(
          `Status atualizado para ${escaparParaRegex(alvo.rotulo)}\\.`,
        ),
        controle: 'o grupo "Status da tarefa"',
      };
    },
  },
  mae: {
    alvo: (foto, ctx) => campoDaTarefa(foto, ctx.chave, "parentId"),
    exercer: async (pagina, ctx) => {
      const select = pagina.locator('select[aria-label="Tarefa mãe"]').first();
      const naSelect = await select.inputValue();
      const valores = await select.evaluate((el) => [...el.options].map((o) => o.value));
      const alvo = valores.find(
        (v) => v !== "" && v !== naSelect && j(v) !== ctx.antes && !ctx.evitar.includes(j(v)),
      );
      if (alvo === undefined) {
        return {
          pedido: "(o seletor de mãe não ofereceu uma opção diferente)",
          naTela: "(sem alvo)",
          naTelaEsperada: "ok",
          anuncio: "(a ação não chegou a ser exercida)",
          anuncioEsperado: /(?!)/,
          controle: 'o seletor "Tarefa mãe"',
        };
      }
      await instantanearRegioes(pagina);
      await select.selectOption(alvo);
      const anuncio = await anunciouMudando(pagina, /Tarefa mãe atualizada\./);
      return {
        pedido: j(alvo),
        naTela: await select.inputValue(),
        naTelaEsperada: alvo,
        anuncio,
        anuncioEsperado: /Tarefa mãe atualizada\./,
        controle: 'o seletor "Tarefa mãe"',
      };
    },
  },
  meta: {
    alvo: (foto, ctx) => campoDaTarefa(foto, ctx.chave, "isGoal"),
    /*
     * O botão manda o OPOSTO do que ELE mostra. Se a loja já estivesse nesse
     * oposto, o pedido nasceria igual ao que já está lá e a medida não mediria
     * ação nenhuma — então a preparação dá um clique para alinhar os dois
     * lados, e só depois a medida pede a virada de verdade.
     */
    preparar: async (pagina, ctx) => {
      const botao = pagina.locator("button[aria-pressed]").first();
      const naTela = (await botao.getAttribute("aria-pressed")) === "true";
      const naLoja = campoDaTarefa(await fotografia(), ctx.chave, "isGoal");
      if (naLoja !== j(!naTela)) return undefined;
      await instantanearRegioes(pagina);
      await botao.click();
      await anunciouMudando(pagina, /(Marcada como meta|Meta removida)\./);
      await esperarAlvoBruto(
        (foto) => campoDaTarefa(foto, ctx.chave, "isGoal"),
        j(!naTela),
      );
      return undefined;
    },
    exercer: async (pagina, ctx) => {
      const botao = pagina.locator("button[aria-pressed]").first();
      const naTela = (await botao.getAttribute("aria-pressed")) === "true";
      const pedido = !naTela;
      await instantanearRegioes(pagina);
      await botao.click();
      const anuncio = await anunciouMudando(
        pagina,
        pedido ? /Marcada como meta\./ : /Meta removida\./,
      );
      return {
        pedido: j(pedido),
        naTela: `aria-pressed=${String(await botao.getAttribute("aria-pressed"))}`,
        naTelaEsperada: `aria-pressed=${String(pedido)}`,
        anuncio,
        anuncioEsperado: pedido ? /Marcada como meta\./ : /Meta removida\./,
        controle: 'o botão "Marcar como meta"',
      };
    },
  },
  duracao: {
    alvo: (foto, ctx) => campoDaTarefa(foto, ctx.chave, "estimativaDias"),
    exercer: async (pagina, ctx) => {
      const caixa = campoPorNome(pagina, /^Duração \(dias, p80/).first();
      const naCaixaAntes = await caixa.inputValue();
      let n = 30.25;
      while (
        j(n) === ctx.antes ||
        String(n) === naCaixaAntes.trim() ||
        ctx.evitar.includes(j(n))
      ) {
        n += 0.25;
      }
      const bruto = String(n);
      await caixa.fill(bruto);
      const naTela = await caixa.inputValue();
      await instantanearRegioes(pagina);
      await pagina.getByRole("button", { name: "Salvar duração" }).first().click();
      return {
        pedido: j(n),
        naTela,
        naTelaEsperada: bruto,
        anuncio: await anunciouMudando(pagina, /Duração salva\./),
        anuncioEsperado: /Duração salva\./,
        controle: "a caixa de duração",
      };
    },
  },
  atomos_salvar: {
    alvo: (foto, ctx) => trioNaLoja(foto, ctx.chave),
    exercer: async (pagina, ctx) => {
      const escolha = escolherTrioDiferente(await trioNaTela(pagina), ctx.antes, ctx.evitar);
      if (escolha === null) {
        return {
          pedido: "(a classe dos átomos não ofereceu um trio diferente)",
          naTela: "(sem alvo)",
          naTelaEsperada: "ok",
          anuncio: "(a ação não chegou a ser exercida)",
          anuncioEsperado: /(?!)/,
          controle: "os três grupos de átomos",
        };
      }
      const anuncio = await declararTrioEscolhido(pagina, escolha);
      return {
        pedido: escolha.naLoja,
        naTela: await trioNaTela(pagina),
        naTelaEsperada: escolha.rotulos,
        anuncio,
        anuncioEsperado: /Átomos salvos\./,
        controle: "os três grupos de átomos",
      };
    },
  },
  atomos_limpar: {
    alvo: (foto, ctx) => trioNaLoja(foto, ctx.chave),
    preparar: async (pagina, ctx) => {
      const escolha = escolherTrioDiferente(await trioNaTela(pagina), "(sem átomos)", ctx.evitar);
      if (escolha === null) return undefined;
      await declararTrioEscolhido(pagina, escolha);
      await esperarAlvoBruto((foto) => trioNaLoja(foto, ctx.chave), escolha.naLoja);
      await pagina
        .getByRole("button", { name: "Limpar átomos" })
        .first()
        .waitFor({ state: "visible", timeout: 20000 });
      return undefined;
    },
    exercer: async (pagina) => {
      await instantanearRegioes(pagina);
      await pagina.getByRole("button", { name: "Limpar átomos" }).first().click();
      return {
        pedido: "(sem átomos)",
        /*
         * O que some da tela ao limpar é o SCORE, não o trio: os três controles
         * seguem marcados de propósito desde o ALTO #2 da rodada 14 (zerá-los
         * era o que impedia o operador de reconstruir o que apagou). Medido na
         * rodada 20 — a primeira versão desta linha cobrava `TRIO_LIMPO` e
         * reprovava um produto que estava certo.
         */
        naTela: await esperarNaTela(async () => await scoreNaTela(pagina), "(sem score)"),
        naTelaEsperada: "(sem score)",
        anuncio: await anunciouMudando(pagina, /Átomos limpos\./),
        anuncioEsperado: /Átomos limpos\./,
        controle: 'o botão "Limpar átomos"',
      };
    },
  },
  atomos_desfazer_limpeza: {
    alvo: (foto, ctx) => trioNaLoja(foto, ctx.chave),
    preparar: async (pagina, ctx) => {
      const escolha = escolherTrioDiferente(await trioNaTela(pagina), "(sem átomos)", ctx.evitar);
      if (escolha === null) return undefined;
      await declararTrioEscolhido(pagina, escolha);
      await esperarAlvoBruto((foto) => trioNaLoja(foto, ctx.chave), escolha.naLoja);
      ctx.dado.trio = escolha.naLoja;
      ctx.dado.rotulos = escolha.rotulos;
      await pagina
        .getByRole("button", { name: "Limpar átomos" })
        .first()
        .waitFor({ state: "visible", timeout: 20000 });
      await instantanearRegioes(pagina);
      await pagina.getByRole("button", { name: "Limpar átomos" }).first().click();
      await anunciouMudando(pagina, /Átomos limpos\./);
      return {
        antes: await esperarAlvoBruto(
          (foto) => trioNaLoja(foto, ctx.chave),
          "(sem átomos)",
        ),
      };
    },
    exercer: async (pagina, ctx) => {
      await instantanearRegioes(pagina);
      const clique = await clicarDesfazerDoPainel(pagina, ancoraDeAtomos(pagina), /Átomos limpos\./);
      return {
        pedido: ctx.dado.trio ?? "(a preparação não conseguiu declarar um trio)",
        naTela: clique,
        naTelaEsperada: "ok",
        anuncio: await anunciouMudando(pagina, /Átomos restaurados\./),
        anuncioEsperado: /Átomos restaurados\./,
        controle: 'o botão "Desfazer" do painel de átomos',
      };
    },
  },
};

/**
 * A DISTRIBUIÇÃO — derivada da lista canônica, não escolhida a dedo.
 *
 * A op de índice `i` cai na rota `i % (nº de rotas com sentinela)`. Cada rota
 * tem duas sentinelas (relógio de verdade e relógio da guarda), então toda op
 * é exercida DUAS vezes, uma em cada relógio, e a união das fatias é o universo
 * inteiro em cada relógio. Uma op nova obedece a esta regra sozinha.
 */
function fatiaDaRota(indiceDaRota) {
  return OPS_DA_PAGINA.filter((_, i) => i % ROTAS_COM_SENTINELA.length === indiceDaRota);
}

/** Quantos exercícios envelhecidos passaram — contado FORA das medidas N. */
let ACOES_ENVELHECIDAS_OK = 0;
/** Que relógios exerceram cada op — o fecho por op, contado fora das medidas. */
const RELOGIOS_POR_OP_ENVELHECIDA = new Map();
/**
 * Piso escrito à mão: 15 ops × 2 relógios. Contado fora das medidas que ele
 * protege — apagar os exercícios deixaria "nenhum problema" com "nenhuma
 * medida", que é a 2ª forma viciada desta base.
 */
const PISO_DE_ACOES_ENVELHECIDAS = 30;

/**
 * Quanto a família N adianta o relógio da sentinela de relógio ANTES de cada
 * exercício, só para a tela voltar ao repouso: mais que os 4 s da mensagem de
 * sucesso e mais que os 10 s da janela de "Desfazer", para não sobrar nem
 * frase nem botão da op anterior.
 */
const LIMPEZA_DO_RELOGIO = 15000;

/** O nome da sentinela no relatório. */
function relogioDaSentinela(sentinela) {
  return sentinela.comRelogioDeMentira ? "relógio da guarda" : "relógio de verdade";
}

/**
 * O EXERCÍCIO ENVELHECIDO DE UMA OP — os quatro vereditos da rodada 19,
 * replicados para a op que a distribuição mandou.
 */
/*
 * [rodada 22] NA SENTINELA DO RELÓGIO, O RELÓGIO DA PÁGINA FICA PAUSADO DURANTE
 * O EXERCÍCIO (depois de envelhecer a aba — a medida K já adiantou uma hora).
 *
 * Medido nesta rodada: `clock.install()` não para o tempo, e as três janelas de
 * "Desfazer" (10 s) corriam em tempo de parede durante a PREPARAÇÃO, que cria e
 * exclui pela interface e lê a loja entre um passo e outro. Sob carga, num
 * núcleo só, a 3ª vez de `relacao_desfazer_exclusao` no relógio da guarda
 * chegou ao clique com a janela já fechada: "(não achei, neste painel, a
 * janela de desfazer…)" — a guarda reprovando por um relógio que ela mesma
 * dizia controlar. Pausado, o que a sentinela do relógio mede é a AÇÃO depois
 * do envelhecimento, sem corrida contra o relógio de parede; a corrida contra
 * a parede continua medida — e só ela — na sentinela de tempo real.
 * `fastForward` (a limpeza de 15 s) funciona com o relógio pausado.
 */
async function exercerAcaoEnvelhecida(sentinela, op, opcoes = {}) {
  let pausa = null;
  if (sentinela.comRelogioDeMentira && sentinela.pausa === undefined) {
    pausa = await pausarRelogio(sentinela.pagina);
    sentinela.pausa = pausa;
  }
  try {
    const r = await exercerAcaoEnvelhecidaSemPausa(sentinela, op, opcoes);
    if (pausa !== null) r.resumo = `${r.resumo} · relógio da página ${pausa.detalhe} durante o exercício`;
    return r;
  } finally {
    if (pausa !== null) {
      if (pausa.pausado) await sentinela.pagina.clock.resume();
      sentinela.pausa = undefined;
    }
  }
}

async function exercerAcaoEnvelhecidaSemPausa(sentinela, op, opcoes = {}) {
  const entrada = ACAO_ENVELHECIDA_POR_OP[op];
  const pagina = sentinela.pagina;
  const vez = opcoes.vez ?? 1;
  const ctx = {
    rota: sentinela.rota,
    chave: tarefaDaRota(sentinela.rota),
    pagina,
    marca: marcador(`env${String(vez)}-${op}`),
    dado: {},
    antes: null,
    /*
     * [ALTO, rodada 21] Só a 2ª vez (família N2) preenche estes dois: `volta`
     * é o valor a que uma ação que ALTERNA estado tem de voltar; `evitar` são os
     * valores que a 2ª vez não pode pedir (o de antes da 1ª e o que a 1ª pediu).
     */
    volta: opcoes.volta,
    evitar: opcoes.evitar ?? [],
  };
  const problemas = [];
  /*
   * O alcance PROMETIDO, garantido — não torcido: a ação só é exercida com a
   * aba viva há pelo menos o piso. Nesta base a espera é sempre zero, porque
   * as sentinelas nascem antes da medida A.
   */
  const falta = PISO_DE_VIDA_PARA_A_ESCRITA_MS - (Date.now() - sentinela.nascimento);
  if (falta > 0) await new Promise((ok) => setTimeout(ok, falta));
  const idade = Date.now() - sentinela.nascimento;
  /*
   * ── A LIMPEZA DA TELA NA SENTINELA DO RELÓGIO, e por que ela é necessária ──
   *
   * Na aba com o relógio sob controle da guarda, o `setTimeout` de 4 s que
   * apaga a `MensagemSucesso` pode não ter disparado ainda: a frase que a op
   * anterior anunciou pode continuar lá. [Correção, rodada 22: este parágrafo
   * dizia "NUNCA dispara sozinho". Medido: `clock.install()` deixa o relógio
   * ANDAR no ritmo da parede; só `pauseAt` o para — é o que a N3 faz.] Se a op medida anunciar a MESMA frase (a
   * duração da medida K já deixou "Duração salva." naquela região), o texto não
   * MUDA e a leitura por mudança reprovaria uma ação que funcionou. Adiantar o
   * relógio aqui, ANTES da preparação, faz a tela voltar ao repouso — e o que
   * se adianta só soma ao envelhecimento que esta medida afirma. Vem antes da
   * preparação de propósito: uma janela de "Desfazer" aberta pela preparação
   * tem de continuar aberta quando a ação for exercida.
   */
  /*
   * [ALTO, rodada 22] A família N3 pede `semLimpeza`: ela exerce a 2ª vez
   * JUSTAMENTE com a frase da 1ª na tela, e adiantar o relógio aqui a apagaria.
   */
  if (sentinela.comRelogioDeMentira && opcoes.semLimpeza !== true) {
    await sentinela.pagina.clock.fastForward(LIMPEZA_DO_RELOGIO);
    await sentinela.pagina.waitForTimeout(250);
  }

  let daPreparacao;
  if (typeof entrada.preparar === "function") {
    try {
      daPreparacao = await entrada.preparar(pagina, ctx);
    } catch (erro) {
      problemas.push(
        `a PREPARAÇÃO desta ação não chegou ao fim: ${
          erro instanceof Error ? erro.message.split("\n")[0] : String(erro)
        }`,
      );
    }
  }
  ctx.antes =
    daPreparacao?.antes ?? entrada.alvo(await fotografia(), ctx);

  // [ALTO, rodada 22] a N3 arma aqui a prova do disparo: depois da
  // preparação (que pode clicar à vontade) e antes do 1º gesto da ação.
  if (typeof opcoes.antesDeExercer === "function") await opcoes.antesDeExercer(pagina, ctx);

  let r = null;
  try {
    r = await entrada.exercer(pagina, ctx);
  } catch (erro) {
    problemas.push(
      `a AÇÃO não chegou a ser exercida: ${
        erro instanceof Error ? erro.message.split("\n")[0] : String(erro)
      }`,
    );
  }
  if (r === null) {
    return {
      problemas,
      ctx,
      resumo: `op=${op} · aba viva há ${String(Math.round(idade / 1000))}s · a ação não foi exercida`,
    };
  }
  const depois = await esperarAlvo(entrada, ctx, r.pedido);

  // 1 · o controle da tela ficou com o que o operador pediu?
  if (r.naTela !== r.naTelaEsperada) {
    problemas.push(
      `${r.controle} ficou com ${JSON.stringify(r.naTela)} e o operador pediu ${JSON.stringify(
        r.naTelaEsperada,
      )}`,
    );
  }
  // 2 · a loja já tinha o valor pedido? Então não se mediu ação nenhuma.
  if (ctx.antes === r.pedido) {
    problemas.push(
      `a loja JÁ tinha ${JSON.stringify(
        r.pedido,
      )} antes desta ação — pedir o que já está lá não exerce ação nenhuma`,
    );
  }
  // 3 · a tela anunciou o que aconteceu, numa região viva que MUDOU?
  if (!r.anuncioEsperado.test(r.anuncio)) {
    problemas.push(
      `a tela NÃO anunciou ${String(
        r.anuncioEsperado,
      )} numa região viva que mudou: li ${JSON.stringify(r.anuncio)}`,
    );
  }
  // 4 · e o pedido chegou à loja?
  if (depois !== r.pedido) {
    problemas.push(
      `a AÇÃO da página não gravou: pedi ${JSON.stringify(
        r.pedido,
      )} e a loja tem ${JSON.stringify(depois)} (antes desta ação: ${JSON.stringify(ctx.antes)})`,
    );
  }
  // O piso da família N conta só a 1ª vez; a 2ª tem o próprio (N2-0).
  if (problemas.length === 0 && vez === 1) {
    ACOES_ENVELHECIDAS_OK += 1;
    const relogios = RELOGIOS_POR_OP_ENVELHECIDA.get(op) ?? new Set();
    relogios.add(relogioDaSentinela(sentinela));
    RELOGIOS_POR_OP_ENVELHECIDA.set(op, relogios);
  }
  return {
    problemas,
    ctx,
    pedido: r.pedido,
    antes: ctx.antes,
    depois,
    anuncioEsperado: r.anuncioEsperado,
    resumo: `op=${op} · aba viva há ${String(
      Math.round(idade / 1000),
    )}s (piso ${String(Math.round(PISO_DE_VIDA_PARA_A_ESCRITA_MS / 1000))}s)${
      sentinela.comRelogioDeMentira
        ? ` + ${String(Math.round((ADIANTAMENTO_DO_RELOGIO * 2) / 60000))} min de relógio adiantado pela medida K`
        : ""
    } · ${r.controle} ficou com ${JSON.stringify(r.naTela)} · a tela disse ${JSON.stringify(
      r.anuncio,
    )} · a loja foi de ${JSON.stringify(ctx.antes)} para ${JSON.stringify(
      depois,
    )} (pedido ${JSON.stringify(r.pedido)})`,
  };
}

/*
 * ═══════════════════════════════════════════════════════════ ALTO, rodada 21 ═
 * N2 · A MESMA AÇÃO, DE NOVO, NA MESMA ABA — "SALVA A PRIMEIRA, PERDE A SEGUNDA".
 *
 * A família N exerce cada uma das quinze ações de escrita UMA vez por aba. A
 * primeira vez é um instante, e um sinalizador de "já enviei" que nunca é
 * zerado — um dos defeitos mais comuns que existem — passa em tudo. A sabotagem
 * do coordenador passou nos CINCO portões (1531 testes, tsc, contraste,
 * eslint, "86 medidas, todas dentro da régua"), em `notas-painel.tsx`, dentro
 * de `FormularioNovaNota`:
 *
 *     const jaSalvouRef = useRef(false);
 *     …
 *     aoSucesso: () => {
 *       jaSalvouRef.current = true;          // ← marca DEPOIS do veredito
 *     …
 *     function aoEnviar(e) {
 *       e.preventDefault();
 *       if (jaSalvouRef.current) return;     // ← a 2ª nota some em silêncio
 *
 * Medido no Chromium: 1ª nota → "Nota salva."; 2ª nota → a tela não diz nada,
 * e a loja termina só com a primeira. Ela marca o estado DEPOIS do veredito da
 * porta, então a régua de texto "nenhum formulário marca estado antes do
 * veredito" (que pegou a variante grosseira) não a alcança: a régua de texto
 * está certa, e comportamento que depende de REPETIÇÃO não é texto.
 *
 * **Qual das cinco formas: a 4ª — "mede um instante só" — no eixo da
 * CONTAGEM.** As rodadas 18–20 levaram a guarda a medir depois do tempo
 * passar (o eixo do relógio); nenhuma medida perguntava "e da segunda vez?".
 *
 * ## A régua é DERIVADA da mesma lista — não "criar duas notas"
 *
 * O universo é o mesmo `OPS_DA_PAGINA` (lido de `src/app/tarefa/pedido.ts`) e
 * a mesma distribuição `fatiaDaRota` da família N. Logo depois de cada
 * exercício N, NA MESMA ABA envelhecida, a mesma op é exercida outra vez
 * (`N2`), com um valor diferente do que a 1ª pediu e do que já está lá, e os
 * DOIS pedidos têm de chegar à loja, cada um com o seu anúncio. Toda op tem
 * uma linha em `REPETICAO_POR_OP`, que diz O QUE "funcionar de novo" quer
 * dizer para ela — o modo — e POR QUÊ:
 *
 *  - `marca-nova`: a ação cria/exclui/desfaz uma ENTIDADE; a 2ª vez age sobre
 *    outra entidade (outra marca), e o resultado da 1ª tem de continuar na
 *    loja do jeito que ela o deixou (a 2ª não pode desfazer nem sobrescrever a
 *    1ª);
 *  - `valor-novo`: a ação grava um VALOR num campo; a 2ª pede um valor que não
 *    é nem o de antes da 1ª nem o que a 1ª pediu;
 *  - `ida-e-volta`: a ação ALTERNA estado (status, meta); "funciona de novo" é
 *    ir para outro valor e VOLTAR — a 2ª pede exatamente o valor de antes da
 *    1ª;
 *  - `mesmo-destino`: a ação sempre leva ao mesmo estado (limpar átomos leva a
 *    "sem átomos"); a 2ª parte de um valor DIFERENTE do que a 1ª limpou;
 *  - `fora`: não faz sentido repetir — só com motivo escrito. Hoje nenhuma op
 *    está fora; declarar uma exige baixar `PISO_DE_REPETICOES` no mesmo diff.
 *
 * ## Fecho nos dois sentidos, e o piso contado fora
 *
 * `N2-0` faz o que `N0` faz: op da página sem linha de repetição reprova
 * nomeando a op; linha de op que a página não tem mais também. E conta as
 * repetições BEM-SUCEDIDAS num contador de módulo, contra o piso escrito à mão
 * (15 ops × 2 relógios = 30), exigindo cada op nos DOIS relógios. Os nomes das
 * trinta medidas `N2` entram em `MEDIDAS_EXIGIDAS` derivados da mesma
 * distribuição.
 *
 * ## A redução de custo, declarada e derivada
 *
 * A repetição NÃO abre aba nova: usa a aba envelhecida que a família N já tem
 * aberta, logo depois da 1ª vez. Custa uma ida a mais ao servidor por op ×
 * relógio, e — no relógio de verdade — a espera de a frase da 1ª vez sair da
 * tela (`esperarRepouso`, até `LIMITE_DO_REPOUSO_MS`). Sem essa espera, a 2ª
 * frase idêntica à 1ª na MESMA região viva não "muda", e a leitura por mudança
 * reprovaria um produto certo. No relógio da guarda quem limpa é o
 * adiantamento de `LIMPEZA_DO_RELOGIO` que o exercício já faz. O que isso não
 * alcança está na medida Z.
 */
const MODOS_DE_REPETICAO = ["marca-nova", "valor-novo", "ida-e-volta", "mesmo-destino", "fora"];

const REPETICAO_POR_OP = {
  nota_criar: {
    modo: "marca-nova",
    porque:
      "cada nota é uma entidade própria: o operador escreve duas notas seguidas, a 2ª tem outro texto e a 1ª tem de continuar na loja",
  },
  nota_excluir: {
    modo: "marca-nova",
    porque:
      "exclui OUTRA nota, criada na hora; excluir de novo a MESMA não existe (ela já saiu da lista), então repetir é excluir a próxima",
  },
  nota_desfazer: {
    modo: "marca-nova",
    porque:
      "desfaz uma SEGUNDA exclusão, de outra nota — desfazer de novo a mesma exclusão não faz sentido (a janela fecha ao restaurar); o que se repete é o gesto",
  },
  subtarefa_criar: {
    modo: "marca-nova",
    porque: "cada subtarefa é uma entidade própria; a 2ª tem outro título e a 1ª continua na loja",
  },
  relacao_criar: {
    modo: "marca-nova",
    porque:
      "a 2ª relação vai para outro destino livre, com outra nota; a 1ª tem de continuar na loja",
  },
  relacao_excluir: {
    modo: "marca-nova",
    porque:
      "exclui OUTRA relação, criada na hora; a mesma já saiu da lista, então repetir é excluir a próxima",
  },
  relacao_desfazer_criacao: {
    modo: "marca-nova",
    porque:
      "desfaz a criação de uma SEGUNDA relação; desfazer de novo a mesma não existe (a janela fecha ao desfazer)",
  },
  relacao_desfazer_exclusao: {
    modo: "marca-nova",
    porque:
      "desfaz a exclusão de uma SEGUNDA relação; a 1ª restaurada tem de continuar na loja",
  },
  status: {
    modo: "ida-e-volta",
    porque:
      "o status alterna estado: funcionar de novo é sair para outro valor na 1ª e VOLTAR ao valor de antes na 2ª",
  },
  mae: {
    modo: "valor-novo",
    porque:
      "a mãe é um valor num campo: a 2ª escolhe uma mãe que não é a de antes da 1ª nem a que a 1ª escolheu",
  },
  meta: {
    modo: "ida-e-volta",
    porque:
      "a meta é um liga-desliga: a 1ª vira o valor, a 2ª o desvira — os dois sentidos têm de gravar na mesma aba",
  },
  duracao: {
    modo: "valor-novo",
    porque:
      "a duração é um número num campo: a 2ª grava um número que não é o de antes da 1ª nem o que a 1ª gravou",
  },
  atomos_salvar: {
    modo: "valor-novo",
    porque:
      "o trio é um valor: a 2ª declara um trio que não é o de antes da 1ª nem o que a 1ª declarou",
  },
  atomos_limpar: {
    modo: "mesmo-destino",
    porque:
      "limpar sempre leva a 'sem átomos': o que muda entre as duas vezes é o trio que se limpa, e a 2ª limpa um trio diferente do da 1ª",
  },
  atomos_desfazer_limpeza: {
    modo: "valor-novo",
    porque:
      "desfaz uma SEGUNDA limpeza, de um trio diferente; o trio restaurado na 2ª não pode ser o que a 1ª restaurou",
  },
};

/** Um porquê tem de ser uma frase que se entende sozinha, não um rótulo. */
const TAMANHO_MINIMO_DO_PORQUE = 60;

/** Quantas repetições passaram — contado FORA das medidas N2. */
let REPETICOES_OK = 0;
/** Que relógios repetiram cada op com sucesso — o fecho por op, fora das medidas. */
const RELOGIOS_POR_OP_REPETIDA = new Map();
/**
 * Piso escrito à mão: 15 ops × 2 relógios. Declarar uma op `fora` exige
 * baixá-lo no mesmo diff — e é aí que a redução aparece.
 */
const PISO_DE_REPETICOES = 30;
/**
 * Piso escrito à mão das ações que ALTERNAM estado e são exercidas indo e
 * voltando (status e meta). Trocar uma delas para outro modo aparece no diff.
 */
const PISO_DE_IDA_E_VOLTA = 2;

/**
 * As vezes de cada op × aba, em ordem: [1ª (N), 2ª com a frase na tela (N3),
 * 3ª depois de a frase sair (N2)]. Cada vez confere contra a ANTERIOR.
 */
const VEZES = new Map();
function chaveDaVez(sentinela, op) {
  return `${sentinela.rota}|${relogioDaSentinela(sentinela)}|${op}`;
}

/**
 * No relógio de verdade, espera a frase da vez anterior SAIR da tela — até o
 * limite. Mais que os 10 s da janela de "Desfazer", a frase mais longa que fica.
 */
const LIMITE_DO_REPOUSO_MS = 12000;
async function esperarRepouso(pagina, regex, limiteMs = LIMITE_DO_REPOUSO_MS) {
  const t0 = Date.now();
  while (Date.now() - t0 < limiteMs) {
    const textos = await pagina.evaluate(() =>
      [...document.querySelectorAll('[role="alert"], [role="status"]')].map((el) =>
        (el.innerText || "").trim(),
      ),
    );
    if (!textos.some((t) => regex.test(t))) return Date.now() - t0;
    await pagina.waitForTimeout(250);
  }
  return null;
}

/** As opções da vez seguinte, DERIVADAS do modo e do que a vez anterior registrou. */
function opcoesDaProximaVez(modo, anterior, vez) {
  if (modo === "ida-e-volta") return { vez, volta: anterior.antes };
  if (modo === "valor-novo") return { vez, evitar: [anterior.antes, anterior.pedido] };
  if (modo === "mesmo-destino") return { vez, evitar: [anterior.antes] };
  return { vez };
}

/**
 * As réguas do MODO — o que "funcionar de novo" quer dizer para esta op,
 * conferido contra a vez ANTERIOR. `a` e `b` são os nomes das duas vezes no
 * relatório ("1ª"/"2ª" na N3, "2ª"/"3ª" na N2). Lista vazia = ok.
 */
async function problemasDoModo(modo, op, anterior, atual, a = "1ª", b = "2ª") {
  const problemas = [];
  if (modo === "marca-nova") {
    if (atual.pedido === anterior.pedido) {
      problemas.push(
        `a ${b} vez pediu o MESMO que a ${a} (${JSON.stringify(atual.pedido)}) — não repetiu ação nenhuma`,
      );
    }
    const daAnteriorAgora = ACAO_ENVELHECIDA_POR_OP[op].alvo(await fotografia(), anterior.ctx);
    if (daAnteriorAgora !== anterior.depois) {
      problemas.push(
        `a ${b} vez mexeu no que a ${a} deixou: a ${a} terminou com ${JSON.stringify(
          anterior.depois,
        )} e agora a loja tem ${JSON.stringify(daAnteriorAgora)}`,
      );
    }
  } else if (modo === "valor-novo") {
    if (atual.pedido === anterior.pedido || atual.pedido === anterior.antes) {
      problemas.push(
        `a ${b} vez pediu ${JSON.stringify(atual.pedido)}, que não é valor novo (antes da ${a}: ${JSON.stringify(
          anterior.antes,
        )}; pedido da ${a}: ${JSON.stringify(anterior.pedido)})`,
      );
    }
  } else if (modo === "ida-e-volta") {
    if (anterior.pedido === anterior.antes) {
      problemas.push(`a ${a} vez não saiu do valor de antes — não houve ida`);
    }
    if (atual.pedido !== anterior.antes) {
      problemas.push(
        `a ${b} vez não pediu a VOLTA: pediu ${JSON.stringify(atual.pedido)} e o valor de antes da ${a} era ${JSON.stringify(
          anterior.antes,
        )}`,
      );
    }
  } else if (modo === "mesmo-destino") {
    if (atual.pedido !== anterior.pedido) {
      problemas.push(
        `a ${b} vez devia levar ao mesmo destino da ${a} (${JSON.stringify(
          anterior.pedido,
        )}) e pediu ${JSON.stringify(atual.pedido)}`,
      );
    }
    if (atual.antes === anterior.antes) {
      problemas.push(
        `a ${b} vez partiu do MESMO valor que a ${a} (${JSON.stringify(
          anterior.antes,
        )}) — repetir o mesmo trajeto não prova que a ação funciona de novo com outro dado`,
      );
    }
  } else {
    problemas.push(`modo de repetição desconhecido: ${String(modo)}`);
  }
  return problemas;
}

/**
 * A 3ª vez de uma op, na mesma aba, DEPOIS de a frase da vez anterior sair da
 * tela (família N2) — com as réguas do modo por cima das quatro.
 *
 * [ALTO, rodada 22] Até a rodada 21 esta era a 2ª vez. A 2ª passou a ser a da
 * família N3 (com a frase da 1ª AINDA na tela), e esta — a janela "depois que
 * a frase saiu", que é outro defeito — continua existindo inteira, agora
 * conferida contra a vez imediatamente anterior.
 */
async function repetirAcaoEnvelhecida(sentinela, op) {
  const repeticao = REPETICAO_POR_OP[op];
  const vezes = VEZES.get(chaveDaVez(sentinela, op)) ?? [];
  const anterior = vezes.at(-1);
  const a = `${String(vezes.length)}ª`;
  const b = `${String(vezes.length + 1)}ª`;
  if (repeticao === undefined) {
    return {
      problemas: [`${op} não tem linha em REPETICAO_POR_OP — a repetição não tem o que conferir`],
      resumo: `op=${op} · sem modo de repetição`,
    };
  }
  if (anterior === undefined || anterior.pedido === undefined) {
    return {
      problemas: [
        "nenhuma vez anterior chegou a ser exercida nesta aba (ver as medidas N e N3 desta op) — não há o que repetir",
      ],
      resumo: `op=${op} · modo=${repeticao.modo} · sem vez anterior`,
    };
  }
  /*
   * A vez anterior desta op nesta aba já reprovou (medida N ou N3): esta NÃO é
   * exercida. Repetir sobre uma aba cuja vez anterior quebrou não mede nada
   * novo e custava, medido na rodada 21 com a sabotagem da rodada 19, até um
   * minuto por op esperando limites. Não é aprovação por ausência: a N2 fica
   * VERMELHA, com o motivo, e o piso de N2-0 não fecha.
   */
  if (anterior.problemas.length > 0) {
    return {
      problemas: [
        `a ${a} vez desta op nesta aba já tinha reprovado — a ${b} vez não é exercida sobre uma aba cuja vez anterior quebrou`,
      ],
      resumo: `op=${op} · modo=${repeticao.modo} · ${a} vez reprovada: ${anterior.problemas.join(" | ")}`,
    };
  }
  let repouso = `relógio da guarda: a limpeza de 15 s do exercício apaga a frase da ${a} vez`;
  if (!sentinela.comRelogioDeMentira) {
    const ms = await esperarRepouso(sentinela.pagina, anterior.anuncioEsperado);
    repouso =
      ms === null
        ? `a frase da ${a} vez NÃO saiu da tela em ${String(LIMITE_DO_REPOUSO_MS / 1000)} s — a ${b} vez segue assim mesmo`
        : `a frase da ${a} vez saiu da tela em ${String(Math.round(ms / 100) / 10)} s`;
  }
  const atual = await exercerAcaoEnvelhecida(
    sentinela,
    op,
    opcoesDaProximaVez(repeticao.modo, anterior, vezes.length + 1),
  );
  vezes.push(atual);
  const problemas = atual.problemas.map((p) => `na ${b} vez: ${p}`);
  if (atual.pedido !== undefined) {
    problemas.push(...(await problemasDoModo(repeticao.modo, op, anterior, atual, a, b)));
  }
  return {
    problemas,
    resumo: `modo=${repeticao.modo} · ${a} vez: loja de ${JSON.stringify(
      anterior.antes,
    )} para ${JSON.stringify(anterior.depois)} (pedido ${JSON.stringify(
      anterior.pedido,
    )}) · ${repouso} · ${b} vez: ${atual.resumo}`,
  };
}

/*
 * ═══════════════════════════════════════════════════════════ ALTO, rodada 22 ═
 * N3 · A 2ª VEZ **COM A FRASE DA 1ª AINDA NA TELA** — "a confirmação da
 * anterior está lá, e a nova vira nada".
 *
 * A rodada 21 declarou, no limite (10) da medida Z: *"uma 2ª vez disparada
 * ENQUANTO a frase da 1ª ainda está na tela não é medida"*. Declarar não
 * fecha: essa janela (a frase fica 4 s — `DURACAO_MS` em
 * `mensagem-sucesso.tsx`; a de "Desfazer", 10 s) é exatamente quando o
 * operador faz a 2ª coisa. A sabotagem do coordenador passou nos cinco
 * portões com a guarda da rodada 21 ("117 medidas, todas dentro da régua"),
 * em `FormularioNovaNota`:
 *
 *     function aoEnviar(e) {
 *       e.preventDefault();
 *       if (porta.mensagem !== null) return;   // ← a 2ª nota some em silêncio
 *
 * Medido por ele no navegador, em ritmo humano: a loja fica só com a 1ª nota,
 * a caixa continua com a 2ª, e "Nota salva." — que é da 1ª — continua na tela.
 * O operador lê a confirmação de algo que não gravou.
 *
 * **Qual das cinco formas: a 4ª — "mede um instante só" — no eixo do TEMPO
 * ENTRE AS AÇÕES.** A N2 media a 2ª vez num instante só: depois que a frase
 * saiu.
 *
 * ## A régua é DERIVADA da mesma lista, e a prova é tirada NO DISPARO
 *
 * Universo: `OPS_DA_PAGINA`, a mesma distribuição `fatiaDaRota`, a mesma aba
 * envelhecida. Logo depois da 1ª vez (N), sem esperar nada e sem adiantar o
 * relógio, a mesma op é exercida outra vez com valor diferente, e:
 *
 *  1. **a frase na tela é PROVADA no instante do disparo, pela própria página.**
 *     A região em que a 1ª vez anunciou fica marcada (`data-p6-frase-anterior`);
 *     um ouvinte em fase de CAPTURA na `window` — que roda antes de qualquer
 *     manipulador do React — registra, em cada `click`/`change`/`submit` da
 *     ação, se aquela região ainda estava na tela com a frase da 1ª. Sem esse
 *     registro a medida não vale: nenhum evento = FALHA; frase fora da tela no
 *     disparo = "não medida" no relógio de verdade (a frase saiu por tempo,
 *     antes de a guarda chegar lá) e FALHA no relógio da guarda (lá o relógio
 *     da página é PAUSADO logo depois da 1ª vez e só volta no fim da N3: se a
 *     frase saiu, foi a página que a tirou);
 *  2. **os DOIS pedidos chegam à loja com o anúncio certo** — as quatro réguas
 *     da família N na 2ª vez, mais as do modo (`REPETICAO_POR_OP`), contra a 1ª;
 *  3. **a frase do fim é a da 2ª, e não a da 1ª que ficou.** A leitura de
 *     anúncio agora guarda o HISTÓRICO de cada região (ver
 *     `instantanearRegioes`): "Nota salva." de novo só conta se a região foi
 *     reescrita depois do disparo ("Nota salva." → "Salvando…" → "Nota salva.").
 *     O histórico sai impresso.
 *
 * ## O que "com a frase da 1ª" quer dizer para cada op — `COM_FRASE_POR_OP`
 *
 *  - `da-1a`: a frase da 1ª está na tela no disparo da 2ª (onze ações);
 *  - `da-preparacao`: a 2ª vez NÃO PODE ser disparada com a frase da 1ª,
 *    porque o gesto só existe depois de uma escrita nova que reescreve aquela
 *    região (o "Desfazer" só nasce de uma exclusão/criação nova). Para elas a
 *    prova é a da frase que ESTÁ na tela no disparo: o botão clicado mora
 *    DENTRO da frase de confirmação da escrita anterior. E o motivo é medido,
 *    não suposto: se a frase da 1ª ainda estiver na tela no disparo, a
 *    declaração é falsa e a medida reprova ("declare `da-1a`");
 *  - `fora`: só para op que a N2 declarou fora da repetição, com o mesmo
 *    motivo. Hoje nenhuma.
 *
 * ## O custo, declarado e derivado
 *
 * Nenhuma aba nova: a N3 roda na aba da N, logo depois dela, e a N2 (agora a
 * 3ª vez) roda depois da N3 — as duas janelas, "com a frase" e "depois que a
 * frase saiu", continuam medidas, cada uma com o próprio nome. Custa uma ida
 * a mais ao servidor por op × relógio e nenhuma espera (a N3 não espera nada).
 */
const COM_FRASE_POR_OP = {
  nota_criar: { frase: "da-1a" },
  nota_excluir: { frase: "da-1a" },
  nota_desfazer: {
    frase: "da-preparacao",
    fraseDaPreparacao: /Excluída\./,
    porque:
      "o 2º 'Desfazer' só existe depois de uma NOVA exclusão, e o 1º clique dela escreve 'Confirme: …' na mesma região de anúncios em que estava 'Nota restaurada.'",
  },
  subtarefa_criar: { frase: "da-1a" },
  relacao_criar: { frase: "da-1a" },
  relacao_excluir: { frase: "da-1a" },
  relacao_desfazer_criacao: {
    frase: "da-preparacao",
    fraseDaPreparacao: /Relação criada\./,
    porque:
      "o 2º 'Desfazer' da criação só existe depois de uma NOVA relação, e a gravação dela escreve 'Salvando…' na mesma região em que estava 'Relação desfeita.'",
  },
  relacao_desfazer_exclusao: {
    frase: "da-preparacao",
    fraseDaPreparacao: /Excluída\./,
    porque:
      "o 2º 'Desfazer' da exclusão só existe depois de uma NOVA exclusão, e o 1º clique dela escreve 'Confirme: …' na mesma região em que estava 'Relação restaurada.'",
  },
  status: { frase: "da-1a" },
  mae: { frase: "da-1a" },
  meta: { frase: "da-1a" },
  duracao: { frase: "da-1a" },
  atomos_salvar: { frase: "da-1a" },
  atomos_limpar: { frase: "da-1a" },
  atomos_desfazer_limpeza: {
    frase: "da-preparacao",
    fraseDaPreparacao: /Átomos limpos\./,
    porque:
      "o 2º 'Desfazer' da limpeza só existe depois de declarar um trio e limpar de novo, e salvar o trio escreve 'Salvando…' na mesma região em que estava 'Átomos restaurados.'",
  },
};
const FRASES_DA_REPETICAO = ["da-1a", "da-preparacao", "fora"];

/** Quantas 2ªs vezes com a frase na tela passaram — contado FORA das medidas N3. */
let COM_FRASE_OK = 0;
/** Que relógios passaram cada op com a frase na tela — o fecho por op, fora das medidas. */
const RELOGIOS_POR_OP_COM_FRASE = new Map();
/** Quantas N3 a guarda não conseguiu medir (a frase saiu antes do disparo, por tempo). */
let COM_FRASE_NAO_MEDIDAS = 0;
/** Piso escrito à mão: 15 ops × 2 relógios. */
const PISO_COM_FRASE = 30;
/**
 * Piso escrito à mão das ops em que a frase na tela é a da PRÓPRIA 1ª vez
 * (`da-1a`). Mudar uma para `da-preparacao` aparece no diff aqui.
 */
const PISO_DA_1A = 11;

/** A região em que a 1ª vez anunciou, fixada antes de a 2ª começar. */
const ATRIBUTO_DA_FRASE_ANTERIOR = "data-p6-frase-anterior";

/**
 * Fixa, ANTES de qualquer passo da 2ª vez, a região em que a 1ª anunciou — e
 * diz se a frase dela ainda está lá, visível.
 */
async function fixarFraseAnterior(pagina, regex) {
  return await pagina.evaluate(
    ({ de, para, fonte }) => {
      for (const antigo of document.querySelectorAll(`[${para}]`)) antigo.removeAttribute(para);
      const el = document.querySelector(`[${de}]`);
      if (el === null) {
        return { ok: false, texto: "(nenhuma região marcada pela vez anterior)", visivel: false, vistaHaMs: null };
      }
      el.setAttribute(para, el.getAttribute(de) ?? "");
      const texto = (el.textContent || "").replace(/\s+/g, " ").trim();
      const visivel =
        el.isConnected &&
        (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.getClientRects().length > 0);
      return {
        ok: visivel && new RegExp(fonte).test(texto),
        texto,
        visivel,
        vistaHaMs: Math.round(window.performance.now() - Number(el.getAttribute(de))),
      };
    },
    { de: ATRIBUTO_DO_ANUNCIO, para: ATRIBUTO_DA_FRASE_ANTERIOR, fonte: regex.source },
  );
}

/**
 * Arma a PROVA DO DISPARO: um ouvinte em fase de captura na `window` (instalado
 * uma vez por página) que, em cada `click`, `change` e `submit`, registra se a
 * frase da vez anterior estava na tela NAQUELE instante — antes de o React
 * tratar o evento. `preparacao`, quando dada, é a frase que tem de envolver o
 * ALVO do evento (o "Desfazer" mora dentro da frase que ele desfaz).
 */
async function armarProvaDoDisparo(pagina, { anterior, preparacao }) {
  await pagina.evaluate(
    ({ atributo, fonteAnterior, fontePreparacao }) => {
      if (window.__p6OuvinteDoDisparo !== true) {
        window.__p6OuvinteDoDisparo = true;
        const normal = (t) => (t || "").replace(/\s+/g, " ").trim();
        const visivel = (el) =>
          el !== null &&
          el.isConnected &&
          (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.getClientRects().length > 0);
        const ouvir = (ev) => {
          const prova = window.__p6ProvaDoDisparo;
          if (prova === undefined || prova === null) return;
          const alvo = ev.target !== null && ev.target.nodeType === 1 ? ev.target : null;
          const regiao = document.querySelector(`[${prova.atributo}]`);
          const textoAnterior = regiao === null ? "(nenhuma)" : normal(regiao.textContent);
          const anteriorNaTela =
            visivel(regiao) && new RegExp(prova.fonteAnterior).test(textoAnterior);
          let preparacaoNaTela = null;
          let textoDaPreparacao = null;
          if (prova.fontePreparacao !== null) {
            const envolve = alvo?.closest('[role="status"], [role="alert"]') ?? null;
            textoDaPreparacao =
              envolve === null ? "(o alvo não mora numa região viva)" : normal(envolve.textContent);
            preparacaoNaTela =
              visivel(envolve) && new RegExp(prova.fontePreparacao).test(textoDaPreparacao);
          }
          const nome =
            alvo === null
              ? "(sem alvo)"
              : `${alvo.tagName.toLowerCase()} "${normal(
                  alvo.getAttribute("aria-label") ?? alvo.textContent,
                ).slice(0, 40)}"`;
          prova.eventos.push({
            tipo: ev.type,
            alvo: nome,
            anteriorNaTela,
            textoAnterior,
            preparacaoNaTela,
            textoDaPreparacao,
            desdeMs:
              regiao === null
                ? null
                : Math.round(window.performance.now() - Number(regiao.getAttribute(prova.atributo))),
          });
        };
        for (const tipo of ["click", "change", "submit"]) window.addEventListener(tipo, ouvir, true);
      }
      window.__p6ProvaDoDisparo = { atributo, fonteAnterior, fontePreparacao, eventos: [] };
    },
    {
      atributo: ATRIBUTO_DA_FRASE_ANTERIOR,
      fonteAnterior: anterior.source,
      fontePreparacao: preparacao === null ? null : preparacao.source,
    },
  );
}

/**
 * Para o relógio da página AGORA (na sentinela do relógio). `pauseAt` exige um
 * instante no futuro do relógio da página, e o relógio anda enquanto a leitura
 * de `Date.now()` volta da página — medido: com 1 ms de folga, "Cannot
 * fast-forward to the past". A folga cresce só o necessário (1 → 300 ms): um
 * salto maior dispararia antes da hora os `setTimeout` que vencem nele, e a
 * frase da 1ª vez (4 s) é justamente um deles.
 */
async function pausarRelogio(pagina) {
  const erros = [];
  for (const folga of [1, 25, 100, 300]) {
    const agora = await pagina.evaluate(() => Date.now());
    try {
      await pagina.clock.pauseAt(agora + folga);
      return { pausado: true, detalhe: `pausado com ${String(folga)} ms de folga` };
    } catch (erro) {
      erros.push(erro instanceof Error ? erro.message.split("\n")[0] : String(erro));
    }
  }
  // Não pausou: a N3 do relógio fica sob a MESMA régua da do relógio de
  // verdade (frase que sai por tempo = não medida), e diz por quê.
  return { pausado: false, detalhe: `NÃO pausou: ${erros.join(" | ")}` };
}

/** Lê e DESARMA a prova do disparo. */
async function lerProvaDoDisparo(pagina) {
  return await pagina.evaluate(() => {
    const eventos = window.__p6ProvaDoDisparo?.eventos ?? [];
    window.__p6ProvaDoDisparo = null;
    return eventos;
  });
}

/** O histórico da região em que a última frase foi lida — "Salvando…" → "Nota salva.". */
async function historicoDoAnuncio(pagina) {
  return await pagina.evaluate((atributo) => {
    const el = document.querySelector(`[${atributo}]`);
    if (el === null) return { texto: "(nenhuma região marcada)", historico: [] };
    return {
      texto: (el.textContent || "").replace(/\s+/g, " ").trim(),
      historico: window.__p6Historico?.get(el) ?? [],
    };
  }, ATRIBUTO_DO_ANUNCIO);
}

/** A 2ª vez de uma op COM A FRASE DA 1ª NA TELA — família N3. */
async function repetirComFraseNaTela(sentinela, op) {
  const repeticao = REPETICAO_POR_OP[op];
  const declaracao = COM_FRASE_POR_OP[op];
  const vezes = VEZES.get(chaveDaVez(sentinela, op)) ?? [];
  const primeira = vezes[0];
  const pagina = sentinela.pagina;
  // Parado de verdade só se a pausa pegou (ver `pausarRelogio`).
  const relogioParado = sentinela.comRelogioDeMentira && sentinela.pausa?.pausado === true;
  if (repeticao === undefined || declaracao === undefined) {
    return {
      problemas: [`${op} não tem linha em REPETICAO_POR_OP e em COM_FRASE_POR_OP`],
      resumo: `op=${op} · sem declaração`,
    };
  }
  if (primeira === undefined || primeira.pedido === undefined) {
    return {
      problemas: [
        "a 1ª vez não chegou a ser exercida nesta aba (ver a medida N desta op) — não há o que repetir",
      ],
      resumo: `op=${op} · sem 1ª vez`,
    };
  }
  if (primeira.problemas.length > 0) {
    return {
      problemas: [
        "a 1ª vez desta op nesta aba já tinha reprovado (medida N) — a 2ª vez não é exercida sobre uma aba cuja 1ª vez quebrou",
      ],
      resumo: `op=${op} · 1ª vez reprovada: ${primeira.problemas.join(" | ")}`,
    };
  }
  // 1 · a região da 1ª, fixada ANTES de qualquer passo da 2ª.
  const fixada = await fixarFraseAnterior(pagina, primeira.anuncioEsperado);
  const frase1 = `frase da 1ª ${JSON.stringify(fixada.texto)} (${
    fixada.ok ? "na tela" : "FORA da tela"
  }${
    sentinela.comRelogioDeMentira ? `, relógio da página ${String(sentinela.pausa?.detalhe)}` : ""
  }${relogioParado ? "" : fixada.vistaHaMs === null ? "" : `, vista pela guarda há ${String(fixada.vistaHaMs)} ms`})`;
  const preparacao = declaracao.frase === "da-preparacao" ? declaracao.fraseDaPreparacao : null;
  const segunda = await exercerAcaoEnvelhecida(sentinela, op, {
    ...opcoesDaProximaVez(repeticao.modo, primeira, 2),
    semLimpeza: true,
    antesDeExercer: async (p) => {
      await armarProvaDoDisparo(p, { anterior: primeira.anuncioEsperado, preparacao });
    },
  });
  const eventos = await lerProvaDoDisparo(pagina);
  vezes.push(segunda);
  const problemas = segunda.problemas.map((p) => `na 2ª vez: ${p}`);
  if (segunda.pedido !== undefined) {
    problemas.push(...(await problemasDoModo(repeticao.modo, op, primeira, segunda)));
  }
  // 2 · a prova do disparo.
  const semFrase = [];
  if (eventos.length === 0) {
    problemas.push(
      "nenhum click/change/submit chegou à página durante a 2ª vez — o disparo não foi provado, e sem essa prova a medida não vale",
    );
  } else if (declaracao.frase === "da-1a") {
    semFrase.push(...eventos.filter((e) => !e.anteriorNaTela));
  } else {
    const ultimo = eventos.at(-1);
    if (ultimo.preparacaoNaTela !== true) {
      problemas.push(
        `o disparo (${ultimo.tipo} em ${ultimo.alvo}) não aconteceu dentro da frase ${String(
          preparacao,
        )} da escrita anterior: a região dele dizia ${JSON.stringify(ultimo.textoDaPreparacao)}`,
      );
    }
    if (ultimo.anteriorNaTela === true) {
      problemas.push(
        `o motivo declarado em COM_FRASE_POR_OP é FALSO: no disparo a frase da 1ª (${JSON.stringify(
          ultimo.textoAnterior,
        )}) AINDA estava na tela — declare "da-1a"`,
      );
    }
  }
  const lidos = eventos
    .map(
      (e) =>
        `${e.tipo} em ${e.alvo}: ${
          declaracao.frase === "da-1a"
            ? `frase da 1ª ${e.anteriorNaTela ? "NA TELA" : `FORA (${JSON.stringify(e.textoAnterior)})`}${
                relogioParado || e.desdeMs === null ? "" : ` +${String(e.desdeMs)} ms`
              }`
            : `dentro de ${JSON.stringify(e.textoDaPreparacao)}; frase da 1ª ${
                e.anteriorNaTela ? "AINDA na tela" : "já reescrita"
              }`
        }`,
    )
    .join(" · ");
  // 3 · a frase do fim é a da 2ª (a região foi REESCRITA depois do disparo).
  const fim = await historicoDoAnuncio(pagina);
  const reescrita = fim.historico.some((h) => h !== fim.texto) || fim.texto !== fixada.texto;
  if (segunda.pedido !== undefined && primeira.anuncioEsperado.test(fim.texto) && !reescrita) {
    problemas.push(
      `a frase do fim (${JSON.stringify(fim.texto)}) é a MESMA da 1ª e a região não foi reescrita depois do disparo: o que está na tela é a confirmação da 1ª, não a da 2ª`,
    );
  }
  let naoMedido = false;
  if (semFrase.length > 0) {
    if (relogioParado) {
      problemas.push(
        `no relógio da guarda o tempo está PAUSADO desde o fim da 1ª vez, e mesmo assim a frase da 1ª estava fora da tela em ${String(
          semFrase.length,
        )} de ${String(eventos.length)} evento(s) do disparo: foi a página que a tirou`,
      );
    } else if (problemas.length === 0) {
      naoMedido = true;
      problemas.push(
        `a frase da 1ª SAIU da tela (por tempo) antes do disparo em ${String(semFrase.length)} de ${String(
          eventos.length,
        )} evento(s): a 2ª vez funcionou, mas NÃO foi com a frase na tela — janela não medida nesta corrida`,
      );
    } else {
      problemas.push(
        `e a frase da 1ª estava fora da tela em ${String(semFrase.length)} evento(s) do disparo`,
      );
    }
  }
  return {
    problemas,
    naoMedido,
    resumo: `frase=${declaracao.frase} · modo=${repeticao.modo} · ${frase1} · disparo: ${String(
      eventos.length,
    )} evento(s) [${lidos}] · frase do fim ${JSON.stringify(fim.texto)} (a região passou por: ${
      fim.historico.map((h) => JSON.stringify(h)).join(" → ") || "nada"
    }) · 2ª vez: ${segunda.resumo}`,
  };
}

/*
 * ═══════════════════════════════════════════════════════════ ALTO, rodada 23 ═
 * R · A ESCRITA QUE **FALHA** NO SERVIDOR — "a rede cai no salvar, e o que eu
 * escrevi some".
 *
 * Até a rodada 22 a falha do servidor só era exercida em E2–E4: o "Desfazer"
 * que falha, em três painéis. Nenhuma das outras doze escritas da página era
 * exercida com o pedido FALHANDO. A sabotagem do coordenador passou nos cinco
 * portões (1531 testes, tsc, eslint, "148 medidas no Chromium, todas dentro da
 * régua"), em `FormularioNovaNota`, no fim de `aoEnviar`:
 *
 *     if (decisao === "gravar") enviadoRef.current = { texto, autor };
 *     if (decisao === "gravar") {                                // ← apaga ANTES
 *       setTexto("");                                            //   de o servidor
 *       gravarRascunho(taskId, CAMPOS_COM_RASCUNHO.nota, "");    //   confirmar
 *     }
 *
 * Medido por ele com o POST abortado 1,5 s depois do clique: a tela diz "Não
 * foi possível salvar agora — tente de novo." — e a caixa está vazia, e o
 * rascunho também. A tela manda tentar de novo, e não sobrou nada para tentar.
 *
 * **Qual das cinco formas: a 5ª — "confere o caso, não a classe".** A falha
 * foi conferida num caso (o Desfazer), não na classe (toda escrita).
 *
 * E o que cada peça nova fecha, uma por uma:
 *  - cada medida R fecha a 5ª (a classe é `OPS_DA_PAGINA`, não um caso); o
 *    desfecho da falha e a régua (c) são lidos como ESTADO, com teto — a 4ª
 *    ("mede um instante só") não volta a entrar por aqui;
 *  - R0 fecha a 3ª (universo lido do produto, fecho nos dois sentidos, os seis
 *    rascunhos lidos de `rascunho.ts` e cada um exigido numa falha), a 2ª
 *    (piso escrito à mão, contado fora; citação só vale se a citada passou) e
 *    a 1ª (contadores de módulo que só o sucesso sobe; nomes exigidos no fim);
 *  - a régua (b) em E2–E4 fecha nelas a 2ª: até aqui elas aprovavam sem
 *    olhar a loja durante a falha — a ausência de mudança não era medida.
 *
 * ## A régua é DERIVADA da mesma lista — não "criar nota com a rede caindo"
 *
 * Universo: `OPS_DA_PAGINA` (lido de `src/app/tarefa/pedido.ts`), a mesma
 * distribuição `fatiaDaRota` da família N, a MESMA aba envelhecida. Toda op tem
 * uma linha em `FALHA_POR_OP`, e cada uma é exercida nos DOIS modos de falha
 * (`MODOS_DE_FALHA`), em sequência, como o operador viveria:
 *
 *  1. **a rede cai** — o POST da página fica 1,5 s pendurado e morre
 *     (`route.abort`): o servidor nunca recebe o pedido;
 *  2. **o servidor recusa** — o operador tenta de novo, e o servidor RESPONDE
 *     com erro: o pedido chega com a op trocada por uma que não existe, e o
 *     servidor devolve `{ erro }` pelo caminho que o produto já trata
 *     (`escreverTarefaAction` → "Operação desconhecida.", lido do fonte). Não é
 *     uma resposta forjada pela guarda: é o próprio servidor dizendo não;
 *  3. **a rede volta** — o operador tenta de novo, e o pedido passa.
 *
 * Em cada falha, quatro réguas, todas obrigatórias:
 *
 *  (a) a frase de falha, em português, num `role="alert"` que MUDOU **dentro
 *      da seção do painel da ação** (a seção é achada subindo do controle, não
 *      escrita à mão) — e nenhuma região diz a frase de SUCESSO da op. A frase
 *      é derivada do fonte: a da porta daquela op (`textoDeFalha`), quando ela
 *      tem uma; senão, a do modo;
 *  (b) **a loja sem mudança nenhuma** — a MESMA régua de alcance da família P
 *      (`problemasDeAlcance`), com alcance VAZIO: nenhuma entidade nova, nenhuma
 *      a menos, nenhum campo mudado, na loja INTEIRA;
 *  (c) **o que o operador fez continua na tela** — a regra é por op, está em
 *      `FALHA_POR_OP[op].regra`, e é uma de quatro (`REGRAS_DA_TELA_NA_FALHA`);
 *  (d) na 3ª tentativa, com a rede de volta, **o MESMO pedido** chega à loja: o
 *      corpo de cada POST desta medida é guardado, e os três têm de ser iguais
 *      (op e campos), o valor pedido tem de estar na loja e a tela tem de
 *      anunciar o sucesso. "Tentar de novo" é o gesto do operador — nada é
 *      redigitado pela guarda: se a caixa ficou vazia, a tentativa vai vazia.
 *
 * ## A regra de "o que continua na tela", decidida por op
 *
 *  - `o-que-digitou-fica` — formulários com botão de salvar (nota, subtarefa,
 *    relação, duração, átomos): cada controle que o operador preencheu mostra
 *    exatamente o que ele preencheu, e, onde o campo tem rascunho (os seis de
 *    `CAMPOS_COM_RASCUNHO`, lidos do fonte), o rascunho da sessão guarda o
 *    mesmo texto — é o que devolve o texto depois de um F5 (medida F);
 *  - `volta-ao-confirmado` — controles que gravam no gesto (status, mãe, meta):
 *    o controle volta ao valor que o SERVIDOR confirmou (o da loja antes do
 *    gesto), E a régua (a) exige a frase de que não gravou. Deixar o controle
 *    no valor pedido seria a tela afirmando um estado que o banco não tem;
 *  - `o-item-fica` — exclusões (nota, relação, limpar átomos): o item continua
 *    na tela como estava (a linha na lista; o score e o trio dos átomos);
 *  - `o-desfazer-fica` — os quatro "Desfazer": o botão continua na janela do
 *    painel, e é ele o gesto de "tentar de novo".
 *
 * ## E2–E4 são casos desta família — citados, não duplicados
 *
 * O "Desfazer" que falha com a rede caindo AOS 8,5 s da janela de 10 s já é
 * medido, em tempo real, por E2 (átomos), E3 (nota) e E4 (relação) — e agora
 * elas também conferem a régua (b) (fotografia antes e depois da falha).
 * `FALHA_POR_OP` CITA essas três para o modo "a rede cai" das três ops
 * (`citadas`), e a família R exerce nelas só o outro modo. R0 exige que a
 * medida citada exista e tenha passado — a citação conta no piso exatamente
 * como um exercício próprio, e só vale para op de regra `o-desfazer-fica`.
 *
 * ## A redução de custo, declarada e derivada
 *
 * Nenhuma aba nova: R roda na aba envelhecida do RELÓGIO DA GUARDA da rota que
 * o índice da op sorteou (`fatiaDaRota`), logo depois da N2 daquela op, com o
 * relógio da página PAUSADO (as janelas de 10 s não fecham no meio da falha —
 * o cruzamento da falha com o relógio da janela é o caso de E2–E4, em tempo
 * real). Cada op × modo é exercida UMA vez (15 × 2 = 30, menos as 3 citadas),
 * uma preparação por op, e os dois modos na mesma sequência. E a lei da rodada
 * 21 vale aqui: **R não é exercida sobre aba em que uma vez anterior desta op
 * já reprovou** (N, N3 ou N2) — nem, dentro da R, o modo seguinte depois de uma
 * falha que já apagou o que o operador fez. Não é aprovação por ausência: a R
 * fica VERMELHA, com o motivo, e o piso de R0 não fecha.
 */

/** O corpo da página a partir do qual se lê o fonte do produto. */
function fonteDoComponente(...partes) {
  return readFileSync(join(RAIZ_DO_PACOTE, "src", ...partes), "utf8");
}

/** A frase que o produto diz quando a REDE cai — lida de `usar-acao-tarefa.ts`. */
const MENSAGEM_DA_REDE_DO_FONTE =
  /catch\s*\{\s*return\s*\{\s*erro:\s*"([^"]+)"\s*\};/.exec(
    fonteDoComponente("components", "task", "usar-acao-tarefa.ts"),
  )?.[1] ?? null;

/** A frase que o SERVIDOR devolve para uma op que não existe — de `actions.ts`. */
const MENSAGEM_DA_RECUSA_DO_FONTE =
  /if\s*\(!ehOperacaoDeEscrita\(op\)\)\s*return\s*\{\s*erro:\s*"([^"]+)"\s*\};/.exec(
    fonteDoComponente("app", "tarefa", "actions.ts"),
  )?.[1] ?? null;

/**
 * A frase de falha PRÓPRIA de cada porta que tem uma (`textoDeFalha`), lida do
 * fonte dos componentes: op → frase. Só as portas de "Desfazer" têm, hoje.
 */
function frasesDeFalhaPorOp() {
  const pasta = join(RAIZ_DO_PACOTE, "src", "components", "task");
  const mapa = {};
  for (const arquivo of readdirSync(pasta).filter((a) => a.endsWith(".tsx"))) {
    const src = semComentarios(readFileSync(join(pasta, arquivo), "utf8"));
    for (const bloco of src.split("usarPortaDeEscrita(").slice(1)) {
      const op = /^\s*\{\s*op:\s*"([^"]+)"/.exec(bloco)?.[1];
      if (op === undefined) continue;
      const fim = bloco.search(/\n\s{0,4}\}\);/);
      const corpo = fim === -1 ? bloco : bloco.slice(0, fim);
      const frase = /textoDeFalha:\s*\(\)\s*=>\s*"([^"]+)"/.exec(corpo)?.[1];
      if (frase !== undefined) mapa[op] = frase;
    }
  }
  return mapa;
}
const FRASE_DE_FALHA_POR_OP = frasesDeFalhaPorOp();

/** Piso escrito à mão: as quatro portas de "Desfazer" têm frase de falha própria. */
const PISO_DE_FRASES_DE_FALHA_PROPRIAS = 4;

/** Os campos com rascunho, lidos de `rascunho.ts`: nome no fonte → sufixo da chave. */
function camposComRascunhoDoFonte() {
  const src = semComentarios(fonteDoComponente("components", "task", "rascunho.ts"));
  const bloco = /export const CAMPOS_COM_RASCUNHO\s*=\s*\{([\s\S]*?)\}\s*as const;/.exec(src);
  if (bloco === null) return {};
  return Object.fromEntries(
    [...(bloco[1] ?? "").matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
}
const CAMPOS_COM_RASCUNHO_DO_FONTE = camposComRascunhoDoFonte();

/** Piso escrito à mão: seis campos de criação têm rascunho (medida F). */
const PISO_DE_CAMPOS_COM_RASCUNHO = 6;

/** A forma da chave do rascunho, lida de `chaveRascunho` — nunca escrita aqui. */
const MOLDE_DA_CHAVE_DO_RASCUNHO =
  /export function chaveRascunho\([^)]*\)[^{]*\{\s*return `([^`]*)`;/.exec(
    semComentarios(fonteDoComponente("components", "task", "rascunho.ts")),
  )?.[1] ?? null;

function chaveDoRascunho(taskId, campo) {
  if (MOLDE_DA_CHAVE_DO_RASCUNHO === null) return null;
  return MOLDE_DA_CHAVE_DO_RASCUNHO.replace("${taskId}", taskId).replace("${campo}", campo);
}

async function lerRascunhoDaSessao(pagina, chave) {
  if (chave === null) return "(não consegui derivar a chave do rascunho de rascunho.ts)";
  return await pagina.evaluate((c) => {
    try {
      return window.sessionStorage.getItem(c) ?? "(sem rascunho)";
    } catch {
      return "(sessionStorage inacessível)";
    }
  }, chave);
}

const MODOS_DE_FALHA = ["rede cai", "servidor recusa"];
const REGRAS_DA_TELA_NA_FALHA = [
  "o-que-digitou-fica",
  "volta-ao-confirmado",
  "o-item-fica",
  "o-desfazer-fica",
];

/** A marca que troca a op do pedido no modo "servidor recusa". */
const SUFIXO_DA_RECUSA = "__p6-recusa";

/** Quanto o POST fica pendurado antes de a rede "cair" — o 1,5 s do coordenador. */
const PENDURA_DA_REDE_MS = 1500;

/** Teto do desfecho de uma falha: a frase tem de chegar dentro dele. */
const TETO_DO_DESFECHO_DA_FALHA_MS = 30000;

/**
 * Piso escrito à mão: 15 ops × 2 modos. Contado em R0, FORA das medidas R que
 * ele protege — apagá-las deixaria "nenhum problema" com "nenhum exercício".
 */
const PISO_DE_FALHAS_EXERCIDAS = 30;

/** Piso escrito à mão: as quatro regras de tela têm, cada uma, pelo menos uma op. */
const PISO_DE_REGRAS_EXERCIDAS = 4;

/** As medidas que podem ser CITADAS como caso desta família — e só elas. */
const MEDIDAS_CITAVEIS = ["E2", "E3", "E4"];

/** Cada par `op|modo` exercido com sucesso pela família R — contado fora. */
const FALHAS_OK = new Set();
/** Pares `op|modo` que a guarda não conseguiu medir (servidor mudo no teto). */
const FALHAS_NAO_MEDIDAS = new Set();
/** As vezes que quebraram numa aba, por `chaveDaVez` — a R não repete sobre elas. */
const QUEBRAS_POR_ABA = new Map();

/** Um controle de texto por nome, lido na hora. */
function lerCaixa(nome) {
  return async (p) => await campoPorNome(p, nome).first().inputValue();
}

/** A descrição do que o operador fez, na forma que a régua (c) compara. */
function descreverCampos(campos, lidos) {
  return campos
    .map(
      (c, i) =>
        `${c.nome}=${JSON.stringify(lidos[i].valor)}${
          c.rascunho === undefined ? "" : ` (rascunho ${JSON.stringify(lidos[i].rascunho)})`
        }`,
    )
    .join(" · ");
}

/**
 * A TABELA DAS FALHAS — uma linha por op da lista canônica.
 *
 *  - `regra` — o que continua na tela depois da falha (ver o cabeçalho);
 *  - `porque` — a decisão, por escrito;
 *  - `ancora(p)` — um controle que só existe no painel desta op: a SEÇÃO onde a
 *    frase de falha tem de aparecer é achada subindo dele;
 *  - `gesto(p, ctx)` — o que o operador faz; devolve o pedido (na forma do
 *    `alvo` da família N), a frase de sucesso e, para `o-que-digitou-fica`, os
 *    campos que ele preencheu;
 *  - `refazer(p, ctx)` — "tentar de novo": o MESMO gesto, sem redigitar nada;
 *  - `naTela(p, ctx)` → `{ lido, esperado }` — a régua (c);
 *  - `citadas` — modo → medida que JÁ é aquele caso (só E2–E4).
 */
const FALHA_POR_OP = {
  nota_criar: {
    regra: "o-que-digitou-fica",
    porque:
      "a nota é texto que só existe na cabeça do operador e na caixa: se a caixa e o rascunho esvaziam antes de o servidor confirmar, a falha destrói a única cópia",
    ancora: (p) => p.getByRole("button", { name: "Salvar nota" }).first(),
    gesto: async (p, ctx) => {
      ctx.dado.campos = [
        {
          nome: "a caixa 'Nova nota'",
          ler: lerCaixa(/^Nova nota$/),
          valor: ctx.marca,
          rascunho: "nota",
          // [ALTO, rodada 24] o campo principal: é nele que o operador continua na espera (família W).
          naEspera: true,
          caixa: /^Nova nota$/,
          pedido: (v) => estaNaLoja(v),
        },
        {
          nome: "o autor da nota",
          ler: lerCaixa(/^Autor da nota/),
          valor: `${ctx.marca}-autor`,
          rascunho: "notaAutor",
        },
      ];
      await campoPorNome(p, /^Nova nota$/).first().fill(ctx.marca);
      await campoPorNome(p, /^Autor da nota/).first().fill(`${ctx.marca}-autor`);
      await p.getByRole("button", { name: "Salvar nota" }).first().click();
      return { pedido: estaNaLoja(ctx.marca), sucesso: /Nota salva\./ };
    },
    refazer: async (p) => {
      await p.getByRole("button", { name: "Salvar nota" }).first().click();
    },
  },
  nota_excluir: {
    regra: "o-item-fica",
    porque:
      "a exclusão não aconteceu: a nota tem de continuar na lista, do jeito que estava, para o operador ver que ela está lá e poder pedir de novo",
    ancora: (p) => p.getByRole("button", { name: "Salvar nota" }).first(),
    gesto: async (p, ctx) => {
      const achou = await excluirItemComMarca(p, ctx.marca);
      return achou
        ? { pedido: naoEstaNaLoja(ctx.marca), sucesso: /Excluída\./ }
        : { erro: "(não achei a nota marcada para excluir)" };
    },
    refazer: async (p, ctx) => {
      await excluirItemComMarca(p, ctx.marca);
    },
    naTela: async (p, ctx) => ({
      lido: presencaDe(await textoDasListas(p), ctx.marca),
      esperado: `"${ctx.marca}" está na lista`,
    }),
  },
  nota_desfazer: {
    regra: "o-desfazer-fica",
    porque:
      "o texto da nota excluída só vive na janela de desfazer: falhar não pode fechá-la, senão o operador perde a nota e o único gesto que a devolvia",
    ancora: (p) => ancoraDeNotas(p),
    citadas: { "rede cai": "E3" },
    gesto: async (p, ctx) => {
      const clique = await clicarDesfazerDoPainel(p, ancoraDeNotas(p), /Excluída\./);
      return clique === "ok"
        ? { pedido: estaNaLoja(ctx.marca), sucesso: /Nota restaurada\./ }
        : { erro: clique };
    },
    refazer: async (p) => {
      await clicarDesfazerDoPainel(p, ancoraDeNotas(p), /Excluída\./);
    },
  },
  subtarefa_criar: {
    regra: "o-que-digitou-fica",
    porque:
      "título e duração da subtarefa são digitados e só existem na caixa e no rascunho: a falha tem de deixar os dois onde estavam para o operador tentar de novo",
    ancora: (p) => p.getByRole("button", { name: "Adicionar subtarefa" }).first(),
    gesto: async (p, ctx) => {
      ctx.dado.campos = [
        {
          nome: "a caixa 'Título da subtarefa'",
          ler: lerCaixa(/^Título da subtarefa$/),
          valor: ctx.marca,
          rascunho: "subtarefaTitulo",
          naEspera: true,
          caixa: /^Título da subtarefa$/,
          pedido: (v) => estaNaLoja(v),
        },
        {
          nome: "a caixa 'Duração (dias)' da subtarefa",
          ler: lerCaixa(/^Duração \(dias\)$/),
          valor: "2.75",
          rascunho: "subtarefaDuracao",
        },
      ];
      await campoPorNome(p, /^Título da subtarefa$/).first().fill(ctx.marca);
      await campoPorNome(p, /^Duração \(dias\)$/).first().fill("2.75");
      await p.getByRole("button", { name: "Adicionar subtarefa" }).first().click();
      return { pedido: estaNaLoja(ctx.marca), sucesso: /Subtarefa criada\./ };
    },
    refazer: async (p) => {
      await p.getByRole("button", { name: "Adicionar subtarefa" }).first().click();
    },
  },
  relacao_criar: {
    regra: "o-que-digitou-fica",
    porque:
      "a relação é montada em quatro escolhas (natureza, destino, desconto, nota): a falha tem de deixar as quatro na tela, e os dois textos no rascunho",
    ancora: (p) => p.getByLabel("Destino").first(),
    gesto: async (p, ctx) => {
      const tipo = TIPO_DA_RELACAO_ENVELHECIDA;
      await escolherNoGrupo(p, "Tipo de relação", tipo.rotulo);
      await p.waitForTimeout(250);
      const destino = await destinoLivre(p, idDe(ctx.chave), tipo.valor);
      if (destino === null) return { erro: "(esta tarefa já tem aresta desta natureza para todo destino)" };
      ctx.dado.campos = [
        {
          nome: "o grupo 'Tipo de relação'",
          ler: async (q) => await marcadoNoGrupo(q, "Tipo de relação"),
          valor: tipo.rotulo,
        },
        {
          nome: "o seletor 'Destino'",
          ler: async (q) => await q.getByLabel("Destino").first().inputValue(),
          valor: destino,
        },
        {
          nome: "a caixa 'Nota da relação'",
          ler: lerCaixa(/^Nota da relação/),
          valor: ctx.marca,
          rascunho: "relacaoNota",
          naEspera: true,
          caixa: /^Nota da relação/,
          pedido: (v) => estaNaLoja(v),
        },
        {
          nome: "a caixa 'Desconto'",
          ler: lerCaixa(/^Desconto/),
          valor: DESCONTO_PEDIDO,
          rascunho: "relacaoDesconto",
        },
      ];
      await p.getByLabel("Destino").first().selectOption(destino);
      await campoPorNome(p, /^Nota da relação/).first().fill(ctx.marca);
      await campoPorNome(p, /^Desconto/).first().fill(DESCONTO_PEDIDO);
      await p.getByRole("button", { name: "Adicionar relação" }).first().click();
      return { pedido: estaNaLoja(ctx.marca), sucesso: /Relação criada\./ };
    },
    refazer: async (p) => {
      await p.getByRole("button", { name: "Adicionar relação" }).first().click();
    },
  },
  relacao_excluir: {
    regra: "o-item-fica",
    porque:
      "a exclusão não aconteceu: a relação tem de continuar na lista, do jeito que estava, para o operador ver que ela está lá e poder pedir de novo",
    ancora: (p) => p.getByLabel("Destino").first(),
    gesto: async (p, ctx) => {
      const achou = await excluirItemComMarca(p, ctx.marca);
      return achou
        ? { pedido: naoEstaNaLoja(ctx.marca), sucesso: /Excluída\./ }
        : { erro: "(não achei a relação marcada para excluir)" };
    },
    refazer: async (p, ctx) => {
      await excluirItemComMarca(p, ctx.marca);
    },
    naTela: async (p, ctx) => ({
      lido: presencaDe(await textoDasListas(p), ctx.marca),
      esperado: `"${ctx.marca}" está na lista`,
    }),
  },
  relacao_desfazer_criacao: {
    regra: "o-desfazer-fica",
    porque:
      "desfazer a criação que falhou deixa a relação no banco: o botão tem de continuar na janela, senão a relação criada por engano não tem mais volta pela tela",
    ancora: (p) => ancoraDeRelacoes(p),
    gesto: async (p, ctx) => {
      const clique = await clicarDesfazerDoPainel(p, ancoraDeRelacoes(p), /Relação criada\./);
      return clique === "ok"
        ? { pedido: naoEstaNaLoja(ctx.marca), sucesso: /Relação desfeita\./ }
        : { erro: clique };
    },
    refazer: async (p) => {
      await clicarDesfazerDoPainel(p, ancoraDeRelacoes(p), /Relação criada\./);
    },
  },
  relacao_desfazer_exclusao: {
    regra: "o-desfazer-fica",
    porque:
      "a relação excluída só vive na janela de desfazer: falhar não pode fechá-la, senão o operador perde a relação e o único gesto que a devolvia",
    ancora: (p) => ancoraDeRelacoes(p),
    citadas: { "rede cai": "E4" },
    gesto: async (p, ctx) => {
      const clique = await clicarDesfazerDoPainel(p, ancoraDeRelacoes(p), /Excluída\./);
      return clique === "ok"
        ? { pedido: estaNaLoja(ctx.marca), sucesso: /Relação restaurada\./ }
        : { erro: clique };
    },
    refazer: async (p) => {
      await clicarDesfazerDoPainel(p, ancoraDeRelacoes(p), /Excluída\./);
    },
  },
  status: {
    regra: "volta-ao-confirmado",
    porque:
      "o status grava no próprio clique: se o controle ficar no valor pedido, a tela afirma um status que o banco não tem — ele volta ao confirmado, e a frase diz que não gravou",
    ancora: (p) => p.getByRole("radiogroup", { name: "Status da tarefa" }).first(),
    gesto: async (p, ctx) => {
      const marcado = await marcadoNoGrupo(p, "Status da tarefa");
      const alvo = CLASSE_DO_STATUS.find((o) => o.rotulo !== marcado && j(o.valor) !== ctx.antes);
      if (alvo === undefined) return { erro: "(a classe de status não ofereceu um valor diferente)" };
      ctx.dado.alvo = alvo;
      await escolherNoGrupo(p, "Status da tarefa", alvo.rotulo);
      return {
        pedido: j(alvo.valor),
        sucesso: new RegExp(`Status atualizado para ${escaparParaRegex(alvo.rotulo)}\\.`),
      };
    },
    refazer: async (p, ctx) => {
      await escolherNoGrupo(p, "Status da tarefa", ctx.dado.alvo.rotulo);
    },
    // [ALTO, rodada 24] durante a espera, o operador clica OUTRO status (família W).
    outraEscolha: async (p, ctx) => {
      const confirmado = CLASSE_DO_STATUS.find((o) => j(o.valor) === ctx.antes)?.rotulo;
      const outra = CLASSE_DO_STATUS.find((o) => o.rotulo !== ctx.dado.alvo.rotulo && o.rotulo !== confirmado);
      if (outra === undefined) return null;
      await p
        .getByRole("radiogroup", { name: "Status da tarefa" })
        .getByRole("radio", { name: outra.rotulo, exact: true })
        .click(cliqueDeGente());
      return `clicou "${outra.rotulo}" com "${ctx.dado.alvo.rotulo}" em voo`;
    },
    naTela: async (p, ctx) => ({
      lido: await marcadoNoGrupo(p, "Status da tarefa"),
      esperado:
        CLASSE_DO_STATUS.find((o) => j(o.valor) === ctx.antes)?.rotulo ??
        `(a loja tem ${String(ctx.antes)}, fora da classe de status)`,
    }),
  },
  mae: {
    regra: "volta-ao-confirmado",
    porque:
      "a mãe grava na própria escolha do seletor: se ele ficar na mãe pedida, a tela afirma uma hierarquia que o banco não tem — ele volta à confirmada, e a frase diz que não gravou",
    ancora: (p) => p.locator('select[aria-label="Tarefa mãe"]').first(),
    gesto: async (p, ctx) => {
      const select = p.locator('select[aria-label="Tarefa mãe"]').first();
      const naSelect = await select.inputValue();
      const valores = await select.evaluate((el) => [...el.options].map((o) => o.value));
      const alvo = valores.find((v) => v !== "" && v !== naSelect && j(v) !== ctx.antes);
      if (alvo === undefined) return { erro: "(o seletor de mãe não ofereceu uma opção diferente)" };
      ctx.dado.alvo = alvo;
      await select.selectOption(alvo);
      return { pedido: j(alvo), sucesso: /Tarefa mãe atualizada\./ };
    },
    refazer: async (p, ctx) => {
      await p.locator('select[aria-label="Tarefa mãe"]').first().selectOption(ctx.dado.alvo);
    },
    // [ALTO, rodada 24] durante a espera, o operador escolhe OUTRA mãe (família W).
    outraEscolha: async (p, ctx) => {
      const select = p.locator('select[aria-label="Tarefa mãe"]').first();
      const valores = await select.evaluate((el) => [...el.options].map((o) => o.value));
      const confirmado = String(JSON.parse(ctx.antes ?? "null") ?? "");
      const outra = valores.find((v) => v !== ctx.dado.alvo && v !== confirmado);
      if (outra === undefined) return null;
      /*
       * O `selectOption` do Playwright espera o `<select>` "habilitado" mesmo com
       * `force` (medido: 20 s parado, até o pedido ser solto). A escolha de
       * gente, num `<select>` só `aria-disabled`, é o que o navegador faz: muda
       * o valor e dispara `input` e `change`.
       */
      await select.evaluate((el, v) => {
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, outra);
      return `escolheu ${JSON.stringify(outra)} com ${JSON.stringify(ctx.dado.alvo)} em voo`;
    },
    naTela: async (p, ctx) => ({
      lido: await p.locator('select[aria-label="Tarefa mãe"]').first().inputValue(),
      esperado: String(JSON.parse(ctx.antes ?? "null") ?? ""),
    }),
  },
  meta: {
    regra: "volta-ao-confirmado",
    porque:
      "a meta grava no próprio clique: se o botão ficar no estado pedido, a tela afirma um alvo do cronograma que o banco não tem — ele volta ao confirmado, e a frase diz que não gravou",
    ancora: (p) => p.locator("button[aria-pressed]").first(),
    gesto: async (p) => {
      const botao = p.locator("button[aria-pressed]").first();
      const pedido = (await botao.getAttribute("aria-pressed")) !== "true";
      await botao.click();
      return { pedido: j(pedido), sucesso: pedido ? /Marcada como meta\./ : /Meta removida\./ };
    },
    refazer: async (p) => {
      await p.locator("button[aria-pressed]").first().click();
    },
    // [ALTO, rodada 24] durante a espera, o operador clica o botão de novo — pede o oposto (família W).
    outraEscolha: async (p) => {
      await p.locator("button[aria-pressed]").first().click(cliqueDeGente());
      return "clicou de novo no botão de meta, pedindo o oposto do que está em voo";
    },
    naTela: async (p, ctx) => ({
      lido: `aria-pressed=${String(await p.locator("button[aria-pressed]").first().getAttribute("aria-pressed"))}`,
      esperado: `aria-pressed=${String(JSON.parse(ctx.antes ?? "null") === true)}`,
    }),
  },
  duracao: {
    regra: "o-que-digitou-fica",
    porque:
      "a duração é digitada e esta caixa NÃO tem rascunho (medida G): o número digitado só existe na caixa, então a falha tem de deixá-lo lá — a frase 'não salvo' ao lado diz que não gravou",
    ancora: (p) => p.getByRole("button", { name: "Salvar duração" }).first(),
    gesto: async (p, ctx) => {
      const caixa = campoPorNome(p, /^Duração \(dias, p80/).first();
      const naCaixa = (await caixa.inputValue()).trim();
      let n = 41.25;
      while (j(n) === ctx.antes || String(n) === naCaixa) n += 0.25;
      ctx.dado.campos = [
        {
          nome: "a caixa de duração da tarefa",
          ler: lerCaixa(/^Duração \(dias, p80/),
          valor: String(n),
          naEspera: true,
          caixa: /^Duração \(dias, p80/,
          numero: true,
          pedido: (v) => j(Number(v)),
        },
      ];
      await caixa.fill(String(n));
      await p.getByRole("button", { name: "Salvar duração" }).first().click();
      return { pedido: j(n), sucesso: /Duração salva\./ };
    },
    refazer: async (p) => {
      await p.getByRole("button", { name: "Salvar duração" }).first().click();
    },
  },
  atomos_salvar: {
    regra: "o-que-digitou-fica",
    porque:
      "o trio é escolhido em três grupos antes de salvar: a falha tem de deixar as três escolhas marcadas, senão o operador tem de reconstruir de memória o que tinha decidido",
    ancora: (p) => p.getByRole("button", { name: "Salvar átomos" }).first(),
    gesto: async (p, ctx) => {
      const escolha = escolherTrioDiferente(await trioNaTela(p), ctx.antes);
      if (escolha === null) return { erro: "(a classe dos átomos não ofereceu um trio diferente)" };
      ctx.dado.campos = [
        {
          nome: "os três grupos de átomos",
          ler: async (q) => await trioNaTela(q),
          valor: escolha.rotulos,
          naEspera: true,
          grupos: ["Custo", "Esforço", "Opcionalidade"],
          pedido: (v) => trioDaLojaPelaTela(v),
        },
      ];
      await escolherNoGrupo(p, "Opcionalidade", escolha.o.rotulo);
      await escolherNoGrupo(p, "Esforço", escolha.e.rotulo);
      await escolherNoGrupo(p, "Custo", escolha.c.rotulo);
      await p.getByRole("button", { name: "Salvar átomos" }).first().click();
      return { pedido: escolha.naLoja, sucesso: /Átomos salvos\./ };
    },
    refazer: async (p) => {
      await p.getByRole("button", { name: "Salvar átomos" }).first().click();
    },
  },
  atomos_limpar: {
    regra: "o-item-fica",
    porque:
      "a limpeza não aconteceu: o score e o trio têm de continuar na tela como estavam, senão a tela diz 'sem átomos' sobre uma tarefa que ainda os tem",
    ancora: (p) => p.getByRole("button", { name: "Salvar átomos" }).first(),
    gesto: async (p, ctx) => {
      ctx.dado.telaAntes = `${
        /assimetria \(A\) = \d+/.test(await scoreNaTela(p)) ? "com score" : "(sem score)"
      } · ${await trioNaTela(p)}`;
      await p.getByRole("button", { name: "Limpar átomos" }).first().click();
      return { pedido: "(sem átomos)", sucesso: /Átomos limpos\./ };
    },
    refazer: async (p) => {
      await p.getByRole("button", { name: "Limpar átomos" }).first().click();
    },
    naTela: async (p, ctx) => ({
      lido: `${
        /assimetria \(A\) = \d+/.test(await scoreNaTela(p)) ? "com score" : "(sem score)"
      } · ${await trioNaTela(p)}`,
      esperado: ctx.dado.telaAntes,
    }),
  },
  atomos_desfazer_limpeza: {
    regra: "o-desfazer-fica",
    porque:
      "o trio limpo só vive na janela de desfazer: falhar não pode fechá-la, senão o operador perde os três números que alimentam a prioridade",
    ancora: (p) => ancoraDeAtomos(p),
    citadas: { "rede cai": "E2" },
    gesto: async (p, ctx) => {
      const clique = await clicarDesfazerDoPainel(p, ancoraDeAtomos(p), /Átomos limpos\./);
      return clique === "ok"
        ? { pedido: ctx.dado.trio ?? "(a preparação não declarou trio)", sucesso: /Átomos restaurados\./ }
        : { erro: clique };
    },
    refazer: async (p) => {
      await clicarDesfazerDoPainel(p, ancoraDeAtomos(p), /Átomos limpos\./);
    },
  },
};

/** O pedido da página, lido do corpo do POST: `[estado, { op, campos }]`. */
function pedidoDoCorpo(corpo) {
  try {
    const lido = JSON.parse(corpo);
    const pedido = Array.isArray(lido) ? lido[1] : null;
    if (pedido === null || typeof pedido !== "object" || typeof pedido.op !== "string") return null;
    return { lido, pedido };
  } catch {
    return null;
  }
}

/** A SEÇÃO do painel — subindo do controle-âncora; nunca escrita à mão. */
async function secaoDoPainel(ancora) {
  const no = await ancora.elementHandle({ timeout: 10000 }).catch(() => null);
  if (no === null) return null;
  const secao = await no.evaluateHandle((el) => el.closest("section"));
  return (await secao.evaluate((s) => s !== null)) ? secao : null;
}

/**
 * O que MUDOU nas regiões vivas desde `instantanearRegioes`: os `role="alert"`
 * de dentro da seção, e tudo o que mudou fora dela (para acusar a frase no
 * lugar errado e o sucesso anunciado sobre uma falha).
 */
async function regioesDaFalha(secao, gravando) {
  return await secao.evaluate(
    (sec, g) => {
      const mapa = window.__p6RegioesAntes;
      const historico = window.__p6Historico;
      const normal = (t) => (t || "").replace(/\s+/g, " ").trim();
      const alertasNaSecao = [];
      const mudadasFora = [];
      const mudadasNaSecao = [];
      for (const el of document.querySelectorAll('[role="alert"], [role="status"]')) {
        const bruto = (el.innerText || "").trim();
        if (bruto.length === 0) continue;
        const texto = normal(bruto);
        const reescrita = (historico?.get(el) ?? []).some((h) => h !== texto);
        const mudou = mapa === undefined || mapa.get(el) !== bruto || reescrita;
        if (!mudou) continue;
        if (sec.contains(el)) {
          mudadasNaSecao.push(texto);
          if (el.getAttribute("role") === "alert") alertasNaSecao.push(texto);
        } else {
          mudadasFora.push(texto);
        }
      }
      const gravandoNaSecao =
        g !== null &&
        [...sec.querySelectorAll('[role="status"]')].some((el) => normal(el.textContent).includes(g));
      return { alertasNaSecao, mudadasNaSecao, mudadasFora, gravandoNaSecao };
    },
    gravando,
  );
}

/** Espera o DESFECHO de uma falha, como estado e com teto — nunca um instante. */
async function esperarDesfechoDaFalha(pagina, secao, fraseDeFalha, sucesso) {
  const t0 = Date.now();
  let ultimo = null;
  while (Date.now() - t0 < TETO_DO_DESFECHO_DA_FALHA_MS) {
    ultimo = await regioesDaFalha(secao, MENSAGEM_GRAVANDO_DO_FONTE);
    const todas = [...ultimo.mudadasNaSecao, ...ultimo.mudadasFora];
    const comSucesso = todas.find((t) => sucesso.test(t));
    if (comSucesso !== undefined) {
      return { desfecho: "anunciou-sucesso", texto: comSucesso, ms: Date.now() - t0 };
    }
    const disse = ultimo.alertasNaSecao.find((t) => t.includes(fraseDeFalha));
    if (disse !== undefined) return { desfecho: "disse", texto: disse, ms: Date.now() - t0 };
    const fora = ultimo.mudadasFora.find((t) => t.includes(fraseDeFalha));
    if (fora !== undefined) return { desfecho: "fora-da-secao", texto: fora, ms: Date.now() - t0 };
    await pagina.waitForTimeout(200);
  }
  return {
    desfecho: ultimo?.gravandoNaSecao === true ? "ainda-gravando" : "nada",
    texto: [...(ultimo?.alertasNaSecao ?? []), ...(ultimo?.mudadasFora ?? [])].join(" | ") || "(nada mudou)",
    ms: Date.now() - t0,
  };
}
/** Os campos com rascunho que a régua (c) CONFERIU numa falha — contado fora (R0). */
const RASCUNHOS_CONFERIDOS = new Set();

/** A régua (c): o que o operador fez continua na tela — pela regra da op. */
async function oQueFicouNaTela(declaracao, pagina, ctx, secao) {
  if (declaracao.regra === "o-que-digitou-fica") {
    const campos = ctx.dado.campos ?? [];
    const lidos = [];
    for (const c of campos) {
      lidos.push({
        valor: await c.ler(pagina),
        rascunho:
          c.rascunho === undefined
            ? undefined
            : await lerRascunhoDaSessao(
                pagina,
                CAMPOS_COM_RASCUNHO_DO_FONTE[c.rascunho] === undefined
                  ? null
                  : chaveDoRascunho(idDe(ctx.chave), CAMPOS_COM_RASCUNHO_DO_FONTE[c.rascunho]),
              ),
      });
    }
    const esperado = descreverCampos(
      campos,
      campos.map((c) => ({ valor: c.valor, rascunho: c.rascunho === undefined ? undefined : c.valor })),
    );
    const lido =
      campos.length === 0 ? "(o gesto não declarou os campos preenchidos)" : descreverCampos(campos, lidos);
    if (lido === esperado) {
      for (const c of campos) if (c.rascunho !== undefined) RASCUNHOS_CONFERIDOS.add(c.rascunho);
    }
    return { lido, esperado };
  }
  if (declaracao.regra === "o-desfazer-fica") {
    const botoes = await secao.evaluate(
      (s) =>
        [...s.querySelectorAll("button")].filter(
          (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === "Desfazer",
        ).length,
    );
    return {
      lido: botoes >= 1 ? 'o botão "Desfazer" continua na janela do painel' : 'NENHUM botão "Desfazer" no painel',
      esperado: 'o botão "Desfazer" continua na janela do painel',
    };
  }
  return await declaracao.naTela(pagina, ctx);
}

/**
 * A régua (c) lida como ESTADO, com teto curto — nunca um instante: o controle
 * que volta ao confirmado pode voltar um quadro depois da frase. Passado o
 * teto, o que se leu é o veredito.
 */
const TETO_DA_TELA_NA_FALHA_MS = 3000;
async function telaDepoisDaFalha(declaracao, pagina, ctx, secao) {
  const ate = Date.now() + TETO_DA_TELA_NA_FALHA_MS;
  let t = await oQueFicouNaTela(declaracao, pagina, ctx, secao);
  while (t.lido !== t.esperado && Date.now() < ate) {
    await pagina.waitForTimeout(250);
    t = await oQueFicouNaTela(declaracao, pagina, ctx, secao);
  }
  return t;
}

/**
 * O EXERCÍCIO DA FALHA DE UMA OP — na aba envelhecida do relógio da guarda,
 * com o relógio da página PAUSADO durante o exercício inteiro (as janelas de
 * 10 s não fecham no meio da falha; a corrida da falha contra a janela é o caso
 * de E2–E4, em tempo real). Devolve `{ problemas, naoMedido, resumo }`.
 */
async function exercerFalha(sentinela, op) {
  const declaracao = FALHA_POR_OP[op];
  const envelhecida = ACAO_ENVELHECIDA_POR_OP[op];
  const pagina = sentinela.pagina;
  if (declaracao === undefined || envelhecida === undefined) {
    return {
      problemas: [`${op} não tem linha em FALHA_POR_OP e em ACAO_ENVELHECIDA_POR_OP`],
      resumo: `op=${op}`,
    };
  }
  /*
   * A lei da rodada 21: a falha NÃO é exercida sobre uma aba em que uma vez
   * anterior desta op já reprovou. Não é aprovação por ausência — fica
   * VERMELHA com o motivo, e o piso de R0 não fecha.
   */
  const quebra = QUEBRAS_POR_ABA.get(chaveDaVez(sentinela, op));
  if (quebra !== undefined) {
    return {
      problemas: [
        `a medida ${quebra} desta op nesta aba já tinha reprovado — a falha não é exercida sobre uma aba cuja vez anterior quebrou`,
      ],
      resumo: `op=${op} · não exercida (${quebra} reprovada)`,
    };
  }
  const pausa = await pausarRelogio(pagina);
  sentinela.pausa = pausa;
  try {
    return await exercerFalhaPausada(sentinela, op, declaracao, envelhecida, pausa);
  } finally {
    if (pausa.pausado) await pagina.clock.resume();
    sentinela.pausa = undefined;
  }
}

async function exercerFalhaPausada(sentinela, op, declaracao, envelhecida, pausa) {
  const pagina = sentinela.pagina;
  const modos = MODOS_DE_FALHA.filter((m) => declaracao.citadas?.[m] === undefined);
  const ctx = {
    rota: sentinela.rota,
    chave: tarefaDaRota(sentinela.rota),
    pagina,
    marca: marcador(`falha-${op}`),
    dado: {},
    antes: null,
    evitar: [],
  };
  const problemas = [];
  const passos = [];
  let naoMedido = false;
  // A tela volta ao repouso antes da preparação — a mesma limpeza da família N.
  await pagina.clock.fastForward(LIMPEZA_DO_RELOGIO);
  await pagina.waitForTimeout(250);
  let daPreparacao;
  if (typeof envelhecida.preparar === "function") {
    try {
      daPreparacao = await envelhecida.preparar(pagina, ctx);
    } catch (erro) {
      problemas.push(
        `a PREPARAÇÃO não chegou ao fim: ${erro instanceof Error ? erro.message.split("\n")[0] : String(erro)}`,
      );
    }
  }
  const janela = { inicio: Date.now(), fim: Date.now() };
  const foto0 = await fotografia();
  ctx.antes = daPreparacao?.antes ?? envelhecida.alvo(foto0, ctx);
  const secao = await secaoDoPainel(declaracao.ancora(pagina));
  if (secao === null) problemas.push("não achei a SEÇÃO do painel desta op (o controle-âncora sumiu da tela)");

  const rota = { modo: "passa", corpos: [] };
  const casaRota = (url) => url.pathname === sentinela.rota;
  const interceptar = async (chamada) => {
    const req = chamada.request();
    if (req.method() !== "POST") return await chamada.continue();
    const corpo = req.postData() ?? "";
    const lido = pedidoDoCorpo(corpo);
    rota.corpos.push({ modo: rota.modo, pedido: lido === null ? null : lido.pedido, cru: corpo.slice(0, 160) });
    if (rota.modo === "rede cai") {
      await new Promise((ok) => setTimeout(ok, PENDURA_DA_REDE_MS));
      return await chamada.abort();
    }
    if (rota.modo === "servidor recusa") {
      if (lido === null) return await chamada.abort();
      lido.pedido.op = `${lido.pedido.op}${SUFIXO_DA_RECUSA}`;
      return await chamada.continue({ postData: JSON.stringify(lido.lido) });
    }
    return await chamada.continue();
  };
  if (problemas.length === 0) await pagina.route(casaRota, interceptar);
  let g = null;
  try {
    for (const modo of problemas.length === 0 ? modos : []) {
      rota.modo = modo;
      const antesDoPasso = rota.corpos.length;
      await instantanearRegioes(pagina);
      if (g === null) {
        g = await declaracao.gesto(pagina, ctx);
        if (g.erro !== undefined) {
          problemas.push(`o gesto não pôde ser feito: ${g.erro}`);
          g = null;
          break;
        }
      } else {
        // "Tentar de novo" é o gesto do operador — nada é redigitado aqui.
        await declaracao.refazer(pagina, ctx);
      }
      const frase =
        FRASE_DE_FALHA_POR_OP[op] ??
        (modo === "rede cai" ? MENSAGEM_DA_REDE_DO_FONTE : MENSAGEM_DA_RECUSA_DO_FONTE) ??
        "(a frase de falha não foi lida do fonte)";
      const d = await esperarDesfechoDaFalha(pagina, secao, frase, g.sucesso);
      const fotoN = await fotografia();
      janela.fim = Date.now();
      // (b) a MESMA régua de alcance da família P, com alcance VAZIO.
      const alcance = problemasDeAlcance(foto0, foto0, fotoN, {}, [], janela);
      // (c) o que o operador fez continua na tela — pela regra da op.
      const tela = await telaDepoisDaFalha(declaracao, pagina, ctx, secao);
      const doPasso = [];
      if (rota.corpos.length === antesDoPasso) {
        doPasso.push(
          "nenhum POST saiu da página neste passo — a falha não foi provocada, porque o pedido nem partiu",
        );
      }
      if (d.desfecho === "ainda-gravando") {
        naoMedido = true;
        doPasso.push(
          `a página ficou em "${String(MENSAGEM_GRAVANDO_DO_FONTE)}" até o teto de ${String(
            TETO_DO_DESFECHO_DA_FALHA_MS,
          )} ms: o desfecho da falha NÃO foi medido`,
        );
      } else if (d.desfecho === "anunciou-sucesso") {
        doPasso.push(`a tela anunciou SUCESSO (${JSON.stringify(d.texto)}) sobre um pedido que falhou`);
      } else if (d.desfecho === "fora-da-secao") {
        doPasso.push(`a frase de falha apareceu FORA da seção do painel desta ação (${JSON.stringify(d.texto)})`);
      } else if (d.desfecho === "nada") {
        doPasso.push(
          `nenhum role="alert" da seção do painel disse ${JSON.stringify(frase)} em ${String(
            TETO_DO_DESFECHO_DA_FALHA_MS,
          )} ms — li ${JSON.stringify(d.texto)}`,
        );
      }
      if (alcance.problemas.length > 0) {
        doPasso.push(`a LOJA mudou com um pedido que falhou: ${alcance.problemas.join(" | ")}`);
      }
      if (tela.lido !== tela.esperado) {
        doPasso.push(
          `regra "${declaracao.regra}": a tela ficou com ${tela.lido} e tinha de ficar com ${tela.esperado}`,
        );
      }
      passos.push(
        `${modo}: ${d.desfecho} em ${String(d.ms)} ms (${JSON.stringify(d.texto)}) · tela: ${tela.lido} · ${alcance.resumo}`,
      );
      if (doPasso.length > 0) {
        problemas.push(...doPasso.map((p) => `[${modo}] ${p}`));
        break;
      }
      FALHAS_OK.add(`${op}|${modo}`);
    }
    // (d) a rede volta: o MESMO gesto, e o mesmo pedido chega à loja.
    if (problemas.length === 0 && g !== null) {
      rota.modo = "passa";
      const antesDoPasso = rota.corpos.length;
      await instantanearRegioes(pagina);
      await declaracao.refazer(pagina, ctx);
      const anuncio = await anunciouMudando(pagina, g.sucesso);
      const depois = await esperarAlvo(envelhecida, ctx, g.pedido);
      /*
       * Nas ações que põem ou tiram um ITEM da lista, a tela tem de mostrar o
       * que gravou — a mesma espera que a família N faz (`esperarPresenca`).
       * E ela tem um 2º motivo, medido nesta rodada: sem ela, a R terminava
       * com o `router.refresh()` do sucesso ainda em voo, o relógio da página
       * voltava a ser pausado pela medida seguinte, e numa corrida num núcleo
       * só a N seguinte da mesma aba (relacao_desfazer_exclusao) esperou 90 s
       * por um controle que a tela, parada no meio do redesenho, não entregava.
       */
      const presente =
        g.pedido === estaNaLoja(ctx.marca) ? true : g.pedido === naoEstaNaLoja(ctx.marca) ? false : null;
      let naLista = null;
      if (presente !== null) {
        naLista = presencaDe(await esperarPresenca(pagina, ctx.marca, presente), ctx.marca);
        const esperadoNaLista = presente ? `"${ctx.marca}" está na lista` : `"${ctx.marca}" NÃO está na lista`;
        if (naLista !== esperadoNaLista) {
          problemas.push(`[a rede volta] a loja gravou e a TELA não mostrou: ${naLista} (esperado: ${esperadoNaLista})`);
        }
      }
      if (rota.corpos.length === antesDoPasso) {
        problemas.push("[a rede volta] tentar de novo NÃO mandou pedido nenhum ao servidor");
      }
      if (!g.sucesso.test(anuncio)) {
        problemas.push(`[a rede volta] a tela NÃO anunciou ${String(g.sucesso)}: li ${JSON.stringify(anuncio)}`);
      }
      if (depois !== g.pedido) {
        problemas.push(
          `[a rede volta] o pedido não chegou à loja: pedi ${JSON.stringify(g.pedido)} e a loja tem ${JSON.stringify(depois)}`,
        );
      }
      if (ctx.antes === g.pedido) {
        problemas.push(`a loja JÁ tinha ${JSON.stringify(g.pedido)} antes do gesto — não se exerceu ação nenhuma`);
      }
      const formas = rota.corpos.map((c) =>
        c.pedido === null
          ? `(corpo ilegível: ${c.cru})`
          : JSON.stringify({ op: c.pedido.op.replace(SUFIXO_DA_RECUSA, ""), campos: c.pedido.campos }),
      );
      if (formas.length !== modos.length + 1) {
        problemas.push(
          `[a rede volta] esperava ${String(modos.length + 1)} POST(s) nesta medida e saíram ${String(formas.length)}`,
        );
      }
      if (new Set(formas).size > 1) {
        problemas.push(`"tentar de novo" NÃO mandou o mesmo pedido: ${[...new Set(formas)].join(" ≠ ")}`);
      }
      passos.push(
        `a rede volta: ${JSON.stringify(anuncio)} · loja ${JSON.stringify(ctx.antes)} → ${JSON.stringify(
          depois,
        )} (pedido ${JSON.stringify(g.pedido)})${naLista === null ? "" : ` · tela: ${naLista}`} · ${String(
          formas.length,
        )} POST(s), ${String(new Set(formas).size)} forma(s) de pedido`,
      );
    }
  } finally {
    await pagina.unroute(casaRota, interceptar).catch(() => undefined);
  }
  if (naoMedido && problemas.every((p) => p.includes("NÃO foi medido"))) {
    for (const m of modos) if (!FALHAS_OK.has(`${op}|${m}`)) FALHAS_NAO_MEDIDAS.add(`${op}|${m}`);
  }
  return {
    problemas,
    naoMedido: naoMedido && problemas.every((p) => p.includes("NÃO foi medido")),
    resumo: `op=${op} · regra=${declaracao.regra} · relógio da página ${pausa.detalhe} · modos exercidos aqui=[${modos.join(
      ", ",
    )}]${
      declaracao.citadas === undefined
        ? ""
        : ` · citados: ${Object.entries(declaracao.citadas)
            .map(([m, e]) => `${m} → ${e}`)
            .join(", ")}`
    } · ${passos.join(" · ") || "(nenhum passo)"}`,
  };
}

/*
 * ═══════════════════════════════════════════════════════════ ALTO, rodada 24 ═
 * O OPERADOR CONTINUA AGINDO DURANTE A ESPERA — família W (de "espera"), nos
 * TRÊS desfechos: a rede cai, o servidor recusa, e o pedido passa.
 *
 * A família R conferia a régua (c) — "o que o operador fez continua na tela" —
 * contra o que ele fez ANTES do clique. Mas o operador não congela durante a
 * espera: ele continua escrevendo. A rodada 13 corrigiu isso no produto, no
 * caminho do SUCESSO (ALTO #4: `naCaixaRef` × `enviadoRef` na nota, na
 * subtarefa, na relação e na duração), e nenhuma medida da guarda olhava. No
 * caminho da FALHA ninguém olhava nem o produto. Sabotagem do coordenador
 * (1531 testes, tsc, eslint, "164 medidas no Chromium, todas dentro da
 * régua"), em `FormularioNovaNota`:
 *
 *     aoFalha: () => {                          // ← "devolver à caixa o que
 *       const devolver = enviadoRef.current;    //   foi enviado": um reflexo
 *       if (devolver === null) return;          //   comum e bem-intencionado
 *       setTexto(devolver.texto);
 *       gravarRascunho(taskId, CAMPOS_COM_RASCUNHO.nota, devolver.texto);
 *     },
 *
 * Medido por ele com o POST pendurado 1,5 s e morto, e o operador digitando
 * no fim da caixa 300 ms depois do clique: "… adiar o deploy DANO-LV — e o
 * cliente pediu nova data" virou "… adiar o deploy DANO-LV", na caixa E no
 * rascunho. O trecho digitado durante a espera sumiu sem aviso.
 *
 * **Quais das cinco formas: a 4ª e a 5ª.** A 4ª ("mede um instante só"): a
 * régua (c) olhava o estado do clique, não o que aconteceu depois dele. A 5ª
 * ("confere o caso, não a classe"): o sucesso foi corrigido para a nota na
 * rodada 13; a classe é TODA ação que tem campo ou escolha, nos DOIS desfechos.
 *
 * O que cada peça nova fecha:
 *  - cada medida W fecha a 5ª (a classe é derivada de `OPS_DA_PAGINA` pela
 *    regra de `FALHA_POR_OP`, e cada op passa pelos três desfechos) e a 4ª (a
 *    tela é lida DEPOIS do que o operador fez na espera, como estado: até o
 *    teto, depois ao longo de uma janela de tempo real, e de novo depois de o
 *    relógio da página andar 15 s — sobrescrever tarde também reprova);
 *  - "o ato aconteceu DURANTE a espera" é conferido, não suposto: o pedido
 *    fica PRESO pela guarda até o operador terminar de agir, e a tela tem de
 *    mostrar o que ele fez ANTES de o pedido ser solto — um ato que caísse
 *    depois do desfecho aprovaria por ausência (a 2ª forma);
 *  - W0 fecha a 3ª (universo = `OPS_DA_PAGINA`; o jeito de agir na espera é
 *    derivado da regra da op, e a tabela das regras fecha nos dois sentidos com
 *    `REGRAS_DA_TELA_NA_FALHA`; a frase de "Aguarde" é lida de `escrita.ts`), a
 *    2ª (piso escrito à mão, contado fora das medidas W) e a 1ª (contadores de
 *    módulo que só o passo bem-sucedido sobe; nomes exigidos na lista do fim).
 *
 * ## "Continuar agindo" é DERIVADO — da mesma lista e da mesma regra
 *
 * O jeito de agir na espera sai da regra de tela da op (`FALHA_POR_OP[op].regra`,
 * a mesma que a família R usa), por `ESPERA_POR_REGRA`:
 *
 *  - `o-que-digitou-fica` → **continua no campo**: o operador volta ao campo
 *    principal da ação (o que o gesto marca `naEspera`) e continua — digita
 *    mais no fim do texto; na duração, troca o último dígito; nos átomos, troca
 *    a escolha de um dos três grupos (um grupo diferente a cada desfecho). A
 *    exigência, nos três desfechos: depois do desfecho, o campo mostra
 *    EXATAMENTE o que ele deixou lá (o enviado + o que fez na espera) e, onde há
 *    rascunho, o rascunho guarda o mesmo. Nada do que ele fez é sobrescrito
 *    pelo que foi enviado. Na falha, os outros campos também ficam como
 *    estavam; no sucesso, só o campo mexido é cobrado (os intactos o produto
 *    esvazia de propósito, e isso não é esta régua). No sucesso, a loja tem o
 *    que estava no campo NO CLIQUE — o que ele fez depois não vazou para o
 *    pedido já enviado;
 *  - `volta-ao-confirmado` → **tenta outra escolha**: status, mãe e meta
 *    gravam no próprio gesto, então trocar a escolha durante a espera é OUTRO
 *    PEDIDO, e o produto já decidiu o que fazer com ele: a porta o RECUSA
 *    DIZENDO ("Aguarde…", lida de `escrita.ts`, na seção do painel), nenhum 2º
 *    POST sai, e o controle segue mostrando o pedido EM VOO. Depois do
 *    desfecho, o controle mostra o desfecho do 1º pedido — na falha, o valor
 *    confirmado; no sucesso, o pedido — e a 2ª escolha não aparece nem na tela
 *    nem na loja: ela não pode ser aplicada em silêncio nem virar pedido
 *    escondido;
 *  - `o-item-fica` e `o-desfazer-fica` → **fora, com o porquê**: a ação é um
 *    botão, sem campo nem escolha para mexer durante a espera.
 *
 * ## A redução de custo, declarada e derivada
 *
 * Nenhuma aba nova: W roda na MESMA aba envelhecida do relógio da guarda que a
 * família R usa, logo depois da R daquela op (a distribuição `fatiaDaRota`),
 * com o relógio da página pausado. Os três desfechos numa sequência só, como o
 * operador viveria: a rede cai, ele tenta de novo e o servidor recusa, ele
 * tenta de novo e passa — e continua agindo em cada espera. Oito ops × três
 * desfechos = 24 passos, uma preparação por op. E a lei da rodada 21: W não é
 * exercida sobre aba em que uma vez anterior desta op já reprovou (N, N3, N2
 * ou R), nem, dentro dela, o desfecho seguinte depois de um que reprovou.
 */

/** A frase da porta para o 2º pedido durante a gravação — lida de `escrita.ts`. */
const MENSAGEM_AGUARDE_DO_FONTE =
  /export const MENSAGEM_AGUARDE = "([^"]+)";/.exec(
    readFileSync(join(RAIZ_DO_PACOTE, "src", "components", "task", "escrita.ts"), "utf8"),
  )?.[1] ?? null;

/** Os três desfechos da espera: os dois modos de falha da família R, e o sucesso. */
const DESFECHOS_DA_ESPERA = [...MODOS_DE_FALHA, "sucesso"];

/** O jeito de continuar agindo na espera, por REGRA de tela — a op herda da regra. */
const ESPERA_POR_REGRA = {
  "o-que-digitou-fica": {
    jeito: "continua-no-campo",
    porque:
      "formulário com botão de salvar: durante a espera o operador continua no campo principal — e o que ele deixou lá é dele, em qualquer desfecho",
  },
  "volta-ao-confirmado": {
    jeito: "tenta-outra-escolha",
    porque:
      "o controle grava no próprio gesto: trocar a escolha durante a espera é OUTRO pedido, que a porta recusa dizendo 'Aguarde…', sem mandar nada e sem trocar o controle",
  },
  "o-item-fica": {
    jeito: "fora",
    porque:
      "a exclusão é um botão (dois cliques): não há campo nem escolha desta ação para o operador mexer durante a espera",
  },
  "o-desfazer-fica": {
    jeito: "fora",
    porque:
      "o 'Desfazer' é um botão só: não há campo nem escolha desta ação para o operador mexer durante a espera",
  },
};
const JEITOS_EXERCIDOS_NA_ESPERA = ["continua-no-campo", "tenta-outra-escolha"];

function jeitoDaEspera(op) {
  return ESPERA_POR_REGRA[FALHA_POR_OP[op]?.regra]?.jeito ?? "(sem regra de tela)";
}

/** As ops com campo ou escolha — DERIVADAS da lista canônica e da regra de cada uma. */
const OPS_COM_ESPERA = OPS_DA_PAGINA.filter((op) => JEITOS_EXERCIDOS_NA_ESPERA.includes(jeitoDaEspera(op)));

/** Piso escrito à mão: oito ações têm campo ou escolha (5 formulários + status, mãe, meta). */
const PISO_DE_OPS_COM_ESPERA = 8;
/** Piso escrito à mão: 8 ops × 3 desfechos, contado em W0 — fora das medidas W. */
const PISO_DE_ESPERAS_EXERCIDAS = 24;
/** Piso escrito à mão: nota, título da subtarefa e nota da relação — o rascunho do campo mexido. */
const PISO_DE_RASCUNHOS_NA_ESPERA = 3;

/** Quanto depois de o pedido sair o operador volta a agir — os 300 ms do coordenador. */
const DEPOIS_DO_CLIQUE_MS = 300;
/** Teto do pedido preso: passado ele, a guarda solta o pedido sozinha, e diz. */
const TETO_DO_PEDIDO_PRESO_MS = 20000;
/** Janela de tempo real em que a tela tem de continuar certa depois do desfecho. */
const JANELA_DEPOIS_DO_DESFECHO_MS = 1500;

/** Cada par `op|desfecho` bem-sucedido — contado fora (W0). */
const ESPERAS_OK = new Set();
/** Pares que a guarda não conseguiu medir (servidor mudo no teto). */
const ESPERAS_NAO_MEDIDAS = new Set();
/** Os rascunhos do campo mexido conferidos depois de um desfecho — contado fora. */
const RASCUNHOS_NA_ESPERA = new Set();

/**
 * O clique de GENTE num controle que está `aria-disabled` durante a gravação.
 *
 * Medido na 1ª corrida desta rodada: o `click()` do Playwright ESPERA o controle
 * ficar habilitado, e ele trata `aria-disabled="true"` como desabilitado — o
 * clique do "operador" só caía DEPOIS de o pedido ser solto, e a medida acusou
 * isso sozinha ("o ato NÃO foi durante a espera"). O mouse de uma pessoa não
 * espera: `aria-disabled` não bloqueia evento nenhum, e o produto escolheu isso
 * de propósito (a recusa fala — `controle-segmentado.tsx`, MÉDIO #2 da rodada
 * 5). Aqui o clique é o mesmo clique de mouse, sem a espera de atuação.
 */
function cliqueDeGente() {
  return { force: true };
}

/** Espera uma condição do lado da guarda, com teto. */
async function esperarQue(cond, limiteMs) {
  const ate = Date.now() + limiteMs;
  while (!cond() && Date.now() < ate) await new Promise((ok) => setTimeout(ok, 50));
  return cond();
}

/** O trio da tela, na forma de `trioNaTela`, a partir dos três rótulos. */
function descreverTrio(t) {
  return `Opcionalidade=${t.Opcionalidade} · Esforço=${t["Esforço"]} · Custo=${t.Custo}`;
}

/** O trio na forma da LOJA, a partir da descrição da tela — pela classe lida do fonte. */
function trioDaLojaPelaTela(descricao) {
  const m = /^Opcionalidade=(.*) · Esforço=(.*) · Custo=(.*)$/.exec(descricao);
  if (m === null) return `(descrição de trio ilegível: ${descricao})`;
  const o = CLASSE_DE_OPCIONALIDADE.find((x) => x.rotulo === m[1]);
  const e = CLASSE_DE_ESFORCO_CUSTO.find((x) => x.rotulo === m[2]);
  const c = CLASSE_DE_ESFORCO_CUSTO.find((x) => x.rotulo === m[3]);
  if (o === undefined || e === undefined || c === undefined) return `(rótulo fora da classe: ${descricao})`;
  return trioDaEscolha(o, e, c);
}

/**
 * O QUE O OPERADOR FAZ NA ESPERA — no campo principal (`naEspera`) de uma op
 * `continua-no-campo`. Devolve a descrição do ato; o valor que o campo tem de
 * mostrar a partir de agora é escrito em `campo.valor`.
 */
async function continuarNoCampo(pagina, campo, passo, ctx) {
  if (campo.caixa !== undefined) {
    const caixa = campoPorNome(pagina, campo.caixa).first();
    await caixa.focus();
    await caixa.press("End");
    if (campo.numero === true) {
      // A duração: troca o último dígito (digitar MAIS dígitos passaria das duas
      // casas que o servidor aceita, e o sucesso seria recusado por isso).
      const atual = campo.valor;
      const ultimo = Number(atual.at(-1));
      const novo = String((ultimo + passo + 1) % 10);
      await caixa.press("Backspace");
      await caixa.pressSequentially(novo);
      campo.valor = `${atual.slice(0, -1)}${novo}`;
      return `apagou o último dígito e digitou "${novo}"`;
    }
    const mais = ` · mais ${String(passo + 1)}`;
    await caixa.pressSequentially(mais);
    campo.valor = `${campo.valor}${mais}`;
    return `digitou ${JSON.stringify(mais)} no fim`;
  }
  if (campo.grupos !== undefined) {
    const grupo = campo.grupos[passo % campo.grupos.length];
    const classe = grupo === "Opcionalidade" ? CLASSE_DE_OPCIONALIDADE : CLASSE_DE_ESFORCO_CUSTO;
    const trio = campo.trio;
    const outra = classe.find((x) => {
      if (x.rotulo === trio[grupo]) return false;
      const candidato = descreverTrio({ ...trio, [grupo]: x.rotulo });
      // O trio novo não pode ser o CONFIRMADO: a porta responderia "nada mudou"
      // à próxima tentativa, e o desfecho seguinte não seria exercido.
      return trioDaLojaPelaTela(candidato) !== ctx.antes;
    });
    if (outra === undefined) return null;
    await pagina
      .getByRole("radiogroup", { name: grupo })
      .getByRole("radio", { name: outra.rotulo, exact: true })
      .click(cliqueDeGente());
    campo.trio = { ...trio, [grupo]: outra.rotulo };
    campo.valor = descreverTrio(campo.trio);
    return `trocou "${grupo}" para "${outra.rotulo}"`;
  }
  return null;
}

/** A régua do campo mexido (e, na falha, dos outros): o que está na tela e no rascunho. */
async function lerCamposDaEspera(pagina, ctx, campos) {
  const lidos = [];
  for (const c of campos) {
    lidos.push({
      valor: await c.ler(pagina),
      rascunho:
        c.rascunho === undefined
          ? undefined
          : await lerRascunhoDaSessao(
              pagina,
              CAMPOS_COM_RASCUNHO_DO_FONTE[c.rascunho] === undefined
                ? null
                : chaveDoRascunho(idDe(ctx.chave), CAMPOS_COM_RASCUNHO_DO_FONTE[c.rascunho]),
            ),
    });
  }
  return {
    lido: descreverCampos(campos, lidos),
    esperado: descreverCampos(
      campos,
      campos.map((c) => ({ valor: c.valor, rascunho: c.rascunho === undefined ? undefined : c.valor })),
    ),
  };
}

/**
 * A tela depois do desfecho, lida como ESTADO: até o teto curto (o controle
 * que volta ao confirmado pode voltar um quadro depois da frase); depois,
 * durante uma janela de tempo real (o `router.refresh()` do sucesso chega
 * depois); e de novo depois de o relógio da página andar 15 s (um desfecho que
 * sobrescreve por temporizador também reprova). Qualquer leitura fora da régua
 * depois do teto é o veredito — nunca um instante.
 */
async function telaAoLongoDoDesfecho(pagina, ler) {
  const ate = Date.now() + TETO_DA_TELA_NA_FALHA_MS;
  let t = await ler();
  while (t.lido !== t.esperado && Date.now() < ate) {
    await pagina.waitForTimeout(250);
    t = await ler();
  }
  if (t.lido !== t.esperado) return { ...t, quando: "no fim do teto" };
  const fimDaJanela = Date.now() + JANELA_DEPOIS_DO_DESFECHO_MS;
  while (Date.now() < fimDaJanela) {
    await pagina.waitForTimeout(250);
    t = await ler();
    if (t.lido !== t.esperado) return { ...t, quando: "durante a janela de tempo real depois do desfecho" };
  }
  await pagina.clock.fastForward(LIMPEZA_DO_RELOGIO);
  await pagina.waitForTimeout(300);
  t = await ler();
  if (t.lido !== t.esperado) {
    return { ...t, quando: `depois de o relógio da página andar ${String(LIMPEZA_DO_RELOGIO / 1000)} s` };
  }
  return { ...t, quando: "estável" };
}

/**
 * O EXERCÍCIO DA ESPERA DE UMA OP — na aba envelhecida do relógio da guarda,
 * logo depois da R daquela op, com o relógio da página PAUSADO.
 */
async function exercerEspera(sentinela, op) {
  const declaracao = FALHA_POR_OP[op];
  const envelhecida = ACAO_ENVELHECIDA_POR_OP[op];
  const jeito = jeitoDaEspera(op);
  if (declaracao === undefined || envelhecida === undefined || !JEITOS_EXERCIDOS_NA_ESPERA.includes(jeito)) {
    return {
      problemas: [`${op} não tem linha em FALHA_POR_OP e em ACAO_ENVELHECIDA_POR_OP, ou a regra dela não tem jeito de espera exercido`],
      resumo: `op=${op} · jeito=${jeito}`,
    };
  }
  const quebra = QUEBRAS_POR_ABA.get(chaveDaVez(sentinela, op));
  if (quebra !== undefined) {
    return {
      problemas: [
        `a medida ${quebra} desta op nesta aba já tinha reprovado — a espera não é exercida sobre uma aba cuja vez anterior quebrou`,
      ],
      resumo: `op=${op} · não exercida (${quebra} reprovada)`,
    };
  }
  const pagina = sentinela.pagina;
  const pausa = await pausarRelogio(pagina);
  sentinela.pausa = pausa;
  try {
    return await exercerEsperaPausada(sentinela, op, declaracao, envelhecida, jeito, pausa);
  } finally {
    if (pausa.pausado) await pagina.clock.resume();
    sentinela.pausa = undefined;
  }
}

async function exercerEsperaPausada(sentinela, op, declaracao, envelhecida, jeito, pausa) {
  const pagina = sentinela.pagina;
  const ctx = {
    rota: sentinela.rota,
    chave: tarefaDaRota(sentinela.rota),
    pagina,
    marca: marcador(`espera-${op}`),
    dado: {},
    antes: null,
    evitar: [],
  };
  const problemas = [];
  const passos = [];
  let naoMedido = false;
  await pagina.clock.fastForward(LIMPEZA_DO_RELOGIO);
  await pagina.waitForTimeout(250);
  let daPreparacao;
  if (typeof envelhecida.preparar === "function") {
    try {
      daPreparacao = await envelhecida.preparar(pagina, ctx);
    } catch (erro) {
      problemas.push(
        `a PREPARAÇÃO não chegou ao fim: ${erro instanceof Error ? erro.message.split("\n")[0] : String(erro)}`,
      );
    }
  }
  const janela = { inicio: Date.now(), fim: Date.now() };
  const foto0 = await fotografia();
  ctx.antes = daPreparacao?.antes ?? envelhecida.alvo(foto0, ctx);
  const secao = await secaoDoPainel(declaracao.ancora(pagina));
  if (secao === null) problemas.push("não achei a SEÇÃO do painel desta op (o controle-âncora sumiu da tela)");
  if (jeito === "tenta-outra-escolha" && typeof declaracao.outraEscolha !== "function") {
    problemas.push("a op grava no gesto e a linha dela em FALHA_POR_OP não diz como tentar OUTRA escolha");
  }

  /*
   * O pedido fica PRESO até a guarda soltá-lo — depois que o operador terminou
   * de agir. Não é um relógio chutado (1,5 s): numa corrida num núcleo só,
   * digitar pode levar mais que isso, e o ato cairia depois do desfecho.
   */
  const rota = { modo: "passa", corpos: [], preso: false, soltar: null, soltoPeloTeto: false };
  const casaRota = (url) => url.pathname === sentinela.rota;
  const interceptar = async (chamada) => {
    const req = chamada.request();
    if (req.method() !== "POST") return await chamada.continue();
    const corpo = req.postData() ?? "";
    const lido = pedidoDoCorpo(corpo);
    const modo = rota.modo;
    rota.corpos.push({ modo, pedido: lido === null ? null : lido.pedido, cru: corpo.slice(0, 160) });
    if (modo === "passa") return await chamada.continue();
    rota.preso = true;
    await new Promise((ok) => {
      rota.soltar = ok;
      setTimeout(() => {
        rota.soltoPeloTeto = rota.preso;
        ok();
      }, TETO_DO_PEDIDO_PRESO_MS);
    });
    rota.preso = false;
    rota.soltar = null;
    if (modo === "rede cai") return await chamada.abort();
    if (modo === "servidor recusa") {
      if (lido === null) return await chamada.abort();
      lido.pedido.op = `${lido.pedido.op}${SUFIXO_DA_RECUSA}`;
      return await chamada.continue({ postData: JSON.stringify(lido.lido) });
    }
    return await chamada.continue();
  };
  if (problemas.length === 0) await pagina.route(casaRota, interceptar);
  let g = null;
  let principal = null;
  let passo = 0;
  try {
    for (const desfecho of problemas.length === 0 ? DESFECHOS_DA_ESPERA : []) {
      rota.modo = desfecho;
      const antesDoPasso = rota.corpos.length;
      const doPasso = [];
      await instantanearRegioes(pagina);
      if (g === null) {
        g = await declaracao.gesto(pagina, ctx);
        if (g.erro !== undefined) {
          problemas.push(`o gesto não pôde ser feito: ${g.erro}`);
          g = null;
          break;
        }
        if (jeito === "continua-no-campo") {
          const marcados = (ctx.dado.campos ?? []).filter((c) => c.naEspera === true);
          if (marcados.length !== 1) {
            problemas.push(
              `o gesto declarou ${String(marcados.length)} campo(s) 'naEspera' — tem de ser exatamente um, o campo principal da ação`,
            );
            rota.soltar?.();
            break;
          }
          principal = marcados[0];
          if (principal.grupos !== undefined) {
            const m = /^Opcionalidade=(.*) · Esforço=(.*) · Custo=(.*)$/.exec(principal.valor) ?? [];
            principal.trio = { Opcionalidade: m[1], "Esforço": m[2], Custo: m[3] };
          }
        }
      } else {
        // "Tentar de novo" é o gesto do operador — nada é redigitado aqui.
        await declaracao.refazer(pagina, ctx);
      }
      // O pedido partiu e está PRESO? Só então o operador volta a agir.
      const partiu = await esperarQue(() => rota.preso && rota.corpos.length > antesDoPasso, 10000);
      if (!partiu) {
        problemas.push(`[${desfecho}] nenhum POST saiu da página em 10 s — a espera não existiu, porque o pedido nem partiu`);
        rota.soltar?.();
        break;
      }
      const enviado = principal === null ? null : principal.valor;
      await pagina.waitForTimeout(DEPOIS_DO_CLIQUE_MS);
      // O ATO, durante a espera.
      let ato;
      if (jeito === "continua-no-campo") {
        ato = await continuarNoCampo(pagina, principal, passo, ctx);
      } else {
        ato = await declaracao.outraEscolha(pagina, ctx);
      }
      if (ato === null || ato === undefined) {
        problemas.push(`[${desfecho}] não consegui agir durante a espera (o campo principal não ofereceu outra entrada)`);
        rota.soltar?.();
        break;
      }
      /*
       * O ato está na tela ANTES do desfecho — e o pedido ainda está preso. Sem
       * isto, um ato que caísse depois da resposta aprovaria por ausência.
       */
      let naEspera;
      if (jeito === "continua-no-campo") {
        const ler = async () => ({ lido: await principal.ler(pagina), esperado: principal.valor });
        naEspera = await esperarNaTela(async () => (await ler()).lido, principal.valor, TETO_DA_TELA_NA_FALHA_MS);
        if (naEspera !== principal.valor) {
          doPasso.push(
            `durante a espera, ${principal.nome} NÃO aceitou o que o operador fez: ficou com ${JSON.stringify(
              naEspera,
            )} e ele deixou ${JSON.stringify(principal.valor)}`,
          );
        }
      } else {
        const aguarde = MENSAGEM_AGUARDE_DO_FONTE ?? "(a frase de Aguarde não foi lida do fonte)";
        let regioes = await regioesDaFalha(secao, null);
        const ateAguarde = Date.now() + TETO_DA_TELA_NA_FALHA_MS;
        while (!regioes.mudadasNaSecao.some((t) => t.includes(aguarde)) && Date.now() < ateAguarde) {
          await pagina.waitForTimeout(150);
          regioes = await regioesDaFalha(secao, null);
        }
        const emVoo = await declaracao.naTela(pagina, { ...ctx, antes: g.pedido });
        naEspera = `frase: ${regioes.mudadasNaSecao.join(" | ") || "(nenhuma)"} · controle: ${emVoo.lido}`;
        if (!regioes.mudadasNaSecao.some((t) => t.includes(aguarde))) {
          doPasso.push(
            `a 2ª escolha, feita durante a espera, NÃO foi recusada dizendo ${JSON.stringify(
              aguarde,
            )} na seção do painel — li ${JSON.stringify(regioes.mudadasNaSecao.join(" | ") || "(nada)")}`,
          );
        }
        if (emVoo.lido !== emVoo.esperado) {
          doPasso.push(
            `durante a espera o controle deixou de mostrar o pedido EM VOO: ficou com ${emVoo.lido} e tinha de ficar com ${emVoo.esperado}`,
          );
        }
      }
      if (!rota.preso) {
        doPasso.push(
          rota.soltoPeloTeto
            ? `o operador demorou mais que ${String(TETO_DO_PEDIDO_PRESO_MS)} ms para agir e o pedido foi solto antes — o ato NÃO foi durante a espera`
            : "o pedido já tinha sido solto quando o operador terminou de agir — o ato NÃO foi durante a espera",
        );
      }
      if (rota.corpos.length !== antesDoPasso + 1) {
        doPasso.push(
          `saíram ${String(rota.corpos.length - antesDoPasso)} POST(s) neste passo — o que o operador fez durante a espera virou pedido`,
        );
      }
      // Solta o pedido: agora vem o desfecho.
      rota.soltar?.();
      let desfechoLido;
      if (desfecho === "sucesso") {
        const anuncio = await anunciouMudando(pagina, g.sucesso);
        if (!g.sucesso.test(anuncio)) {
          doPasso.push(`a tela NÃO anunciou ${String(g.sucesso)}: li ${JSON.stringify(anuncio)}`);
        }
        let lojaLida;
        let lojaEsperada;
        if (principal === null) {
          lojaEsperada = g.pedido;
          lojaLida = await esperarAlvo(envelhecida, ctx, g.pedido);
        } else {
          lojaEsperada = principal.pedido(enviado);
          lojaLida = await esperarAlvo(envelhecida, { ...ctx, marca: enviado }, lojaEsperada);
          if (principal.caixa !== undefined && principal.numero !== true) {
            // A lista tem de mostrar o que gravou — é a prova de que o redesenho do sucesso chegou.
            await esperarPresenca(pagina, ctx.marca, true);
          }
        }
        if (lojaLida !== lojaEsperada) {
          doPasso.push(
            `a loja não tem o que estava no campo NO CLIQUE: esperava ${JSON.stringify(lojaEsperada)} e tem ${JSON.stringify(lojaLida)}`,
          );
        }
        desfechoLido = `${JSON.stringify(anuncio)} · loja ${JSON.stringify(lojaLida)}`;
      } else {
        const frase =
          FRASE_DE_FALHA_POR_OP[op] ??
          (desfecho === "rede cai" ? MENSAGEM_DA_REDE_DO_FONTE : MENSAGEM_DA_RECUSA_DO_FONTE) ??
          "(a frase de falha não foi lida do fonte)";
        const d = await esperarDesfechoDaFalha(pagina, secao, frase, g.sucesso);
        const fotoN = await fotografia();
        janela.fim = Date.now();
        const alcance = problemasDeAlcance(foto0, foto0, fotoN, {}, [], janela);
        if (d.desfecho === "ainda-gravando") {
          naoMedido = true;
          doPasso.push(
            `a página ficou em "${String(MENSAGEM_GRAVANDO_DO_FONTE)}" até o teto de ${String(
              TETO_DO_DESFECHO_DA_FALHA_MS,
            )} ms: o desfecho NÃO foi medido`,
          );
        } else if (d.desfecho !== "disse") {
          doPasso.push(`o desfecho da falha foi "${d.desfecho}" (${JSON.stringify(d.texto)}), e não a frase ${JSON.stringify(frase)} na seção`);
        }
        if (alcance.problemas.length > 0) {
          doPasso.push(`a LOJA mudou com um pedido que falhou: ${alcance.problemas.join(" | ")}`);
        }
        desfechoLido = `${d.desfecho} (${JSON.stringify(d.texto)}) · ${alcance.resumo}`;
      }
      // A régua: o que o operador fez durante a espera está na tela — lida ao longo do desfecho.
      let regua;
      if (jeito === "continua-no-campo") {
        const campos = desfecho === "sucesso" ? [principal] : (ctx.dado.campos ?? []);
        regua = await telaAoLongoDoDesfecho(pagina, async () => await lerCamposDaEspera(pagina, ctx, campos));
      } else {
        const referencia = desfecho === "sucesso" ? { ...ctx, antes: g.pedido } : ctx;
        regua = await telaAoLongoDoDesfecho(pagina, async () => await declaracao.naTela(pagina, referencia));
      }
      if (regua.lido !== regua.esperado) {
        doPasso.push(
          jeito === "continua-no-campo"
            ? `o que o operador fez DURANTE a espera não sobreviveu ao desfecho (${regua.quando}): a tela ficou com ${regua.lido} e tinha de ficar com ${regua.esperado}`
            : `depois do desfecho (${regua.quando}) o controle ficou com ${regua.lido} e tinha de ficar com ${regua.esperado}`,
        );
      }
      passos.push(
        `${desfecho}: ato "${ato}" com o pedido preso · na espera: ${
          typeof naEspera === "string" ? naEspera : JSON.stringify(naEspera)
        } · desfecho: ${desfechoLido} · tela: ${regua.lido} (${regua.quando})`,
      );
      passo += 1;
      if (doPasso.length > 0) {
        problemas.push(...doPasso.map((p) => `[${desfecho}] ${p}`));
        break;
      }
      ESPERAS_OK.add(`${op}|${desfecho}`);
      if (principal?.rascunho !== undefined) RASCUNHOS_NA_ESPERA.add(principal.rascunho);
    }
  } finally {
    rota.soltar?.();
    await pagina.unroute(casaRota, interceptar).catch(() => undefined);
  }
  // A aba volta ao repouso: o texto que ficou no campo sai, e o rascunho dele junto.
  if (principal?.caixa !== undefined && principal.numero !== true) {
    await campoPorNome(pagina, principal.caixa).first().fill("").catch(() => undefined);
  }
  const soNaoMedido = naoMedido && problemas.every((p) => p.includes("NÃO foi medido"));
  if (soNaoMedido) {
    for (const d of DESFECHOS_DA_ESPERA) if (!ESPERAS_OK.has(`${op}|${d}`)) ESPERAS_NAO_MEDIDAS.add(`${op}|${d}`);
  }
  return {
    problemas,
    naoMedido: soNaoMedido,
    resumo: `op=${op} · jeito=${jeito}${
      principal === null ? "" : ` (campo principal: ${principal.nome})`
    } · relógio da página ${pausa.detalhe} · ${String(rota.corpos.length)} POST(s) · ${
      passos.join(" · ") || "(nenhum passo)"
    }`,
  };
}

/*
 * ═══════════════════════════════════════════════════════════ ALTO, rodada 23 ═
 * O ORÇAMENTO DAS FAMÍLIAS N — a corrida vermelha não gasta a reserva de quem
 * ainda não mediu.
 *
 * Medido na rodada 22: as corridas SABOTADAS passaram de 1.080 s e estouraram
 * o teto no meio das famílias N — e a família P, que vem depois, deixou de ser
 * medida nelas. Uma corrida sabotada que estoura o teto sem medir a família P é
 * uma corrida que não viu tudo: um defeito que só P pegaria passaria calado
 * atrás de outro que N já pegou.
 *
 * A regra, no modelo da rodada 21 ("não repetir sobre aba cuja 1ª vez já
 * quebrou"), em dois níveis:
 *  1. por op × aba: N3, N2 e R não são exercidas sobre uma aba em que uma vez
 *     anterior daquela op já reprovou (`QUEBRAS_POR_ABA`) — ficam VERMELHAS,
 *     com o motivo, e o piso da família não fecha;
 *  2. por corrida: quando a corrida JÁ TEM FALHA e o que resta do teto é menor
 *     que a reserva das medidas que vêm depois das famílias N
 *     (`RESERVA_DO_QUE_VEM_DEPOIS_MS`), as medidas N/N3/N2/R que faltam são
 *     registradas como FALHA "não exercida", pelo nome, sem gastar tempo. Numa
 *     corrida sem falha isto nunca dispara — a corrida honesta mede tudo.
 *
 * A reserva é medida, não chutada: num núcleo só (`taskset -c 0`), do fim das
 * famílias N ao fim da corrida (P0, P-loja, as quinze P, P-nascidas, Z) foram
 * 241–265 s nas corridas das rodadas 21 e 22. 420 s são ~1,6× o pior.
 */
const RESERVA_DO_QUE_VEM_DEPOIS_MS = 420000;
function motivoParaNaoGastar() {
  if (falhas.length === 0) return null;
  const restante = TETO_DA_CORRIDA_MS - (Date.now() - INICIO_DA_CORRIDA);
  if (restante >= RESERVA_DO_QUE_VEM_DEPOIS_MS) return null;
  return `não exercida: a corrida JÁ está vermelha (${String(falhas.length)} falha(s), a 1ª: ${
    falhas[0]
  }) e restam ${String(Math.round(restante / 1000))} s do teto — menos que os ${String(
    RESERVA_DO_QUE_VEM_DEPOIS_MS / 1000,
  )} s de reserva das medidas que vêm depois das famílias N (P e Z). Não é verde: é o tempo indo para quem ainda não mediu`;
}

/** Roda a medida — ou, sem orçamento numa corrida já vermelha, registra-a como FALHA pelo nome. */
async function medirNoOrcamento(nome, nomeDoConferir, fn) {
  const motivo = motivoParaNaoGastar();
  if (motivo === null) {
    await medir(nome, fn);
    return;
  }
  conferir(nomeDoConferir, false, motivo);
}

for (let indiceDaRota = 0; indiceDaRota < ROTAS_COM_SENTINELA.length; indiceDaRota += 1) {
  const rota = ROTAS_COM_SENTINELA[indiceDaRota];
  for (const sentinela of SENTINELAS.filter((x) => x.rota === rota)) {
    for (const op of fatiaDaRota(indiceDaRota)) {
      const relogio = relogioDaSentinela(sentinela);
      const curto = sentinela.comRelogioDeMentira ? "relógio" : "real";
      const chave = chaveDaVez(sentinela, op);
      /** O que passou nesta aba — só o `conferir` verde sobe cada um. */
      const passou = { N: false, N3: false, N2: false, R: false };
      const nomeN = `N · ${op} · ${rota} · ${relogio} — a ação ainda funciona depois que o tempo passou`;
      await medirNoOrcamento(`N ${op} ${rota} ${curto}`, nomeN, async () => {
        const r = await exercerAcaoEnvelhecida(sentinela, op);
        VEZES.set(chave, [r]);
        /*
         * [ALTO, rodada 22] Na sentinela do relógio, o relógio PARA aqui — logo
         * depois da 1ª vez, com a frase dela na tela — e só volta a andar no fim
         * da N3. Medido nesta rodada: `clock.install()` NÃO para o tempo (um
         * `setTimeout` de 1 s dispara sozinho em 1 s de relógio de parede); só
         * `pauseAt` para. Sem isto a N3 do relógio da guarda reprovou uma vez
         * com "a frase da 1ª estava fora da tela" sobre uma frase que saiu POR
         * TEMPO, sob carga — a guarda afirmando um relógio parado que andava.
         */
        if (sentinela.comRelogioDeMentira && COM_FRASE_POR_OP[op]?.frase !== "fora") {
          sentinela.pausa = await pausarRelogio(sentinela.pagina);
        }
        passou.N = r.problemas.length === 0;
        conferir(
          nomeN,
          r.problemas.length === 0,
          `${r.resumo}${r.problemas.length === 0 ? "" : ` — ${r.problemas.join(" | ")}`}`,
        );
      });
      // Não passou — reprovou, estourou ou ficou sem orçamento: a aba quebrou para R.
      if (!passou.N) QUEBRAS_POR_ABA.set(chave, "N");
      /*
       * [ALTO, rodada 21] A 2ª VEZ, logo depois, NA MESMA ABA. Op declarada
       * `fora` não repete — e N2-0 cobra o motivo e o piso.
       */
      if (REPETICAO_POR_OP[op]?.modo !== "fora") {
        /*
         * [ALTO, rodada 22] A 2ª VEZ COM A FRASE DA 1ª AINDA NA TELA — logo depois
         * da 1ª, sem esperar nada. A N2, abaixo, vira a 3ª vez: a janela "depois
         * que a frase saiu" continua medida, com o próprio nome.
         */
        if (COM_FRASE_POR_OP[op]?.frase !== "fora") {
          const nomeN3 = `N3 · ${op} · ${rota} · ${relogio} — a MESMA ação funciona de novo COM A FRASE da anterior ainda na tela`;
          await medirNoOrcamento(`N3 ${op} ${rota} ${curto}`, nomeN3, async () => {
            let r;
            try {
              r = await repetirComFraseNaTela(sentinela, op);
            } finally {
              if (sentinela.comRelogioDeMentira && sentinela.pausa?.pausado === true) {
                await sentinela.pagina.clock.resume();
              }
              sentinela.pausa = undefined;
            }
            if (r.problemas.length === 0) {
              COM_FRASE_OK += 1;
              const relogios = RELOGIOS_POR_OP_COM_FRASE.get(op) ?? new Set();
              relogios.add(relogio);
              RELOGIOS_POR_OP_COM_FRASE.set(op, relogios);
            }
            if (r.naoMedido === true) COM_FRASE_NAO_MEDIDAS += 1;
            passou.N3 = r.problemas.length === 0;
            conferir(
              nomeN3,
              r.problemas.length === 0,
              `${r.resumo}${r.problemas.length === 0 ? "" : ` — ${r.problemas.join(" | ")}`}`,
              r.naoMedido === true ? "nao-medido" : "medido",
            );
          });
          // Um N3 que não passou — falha OU não medido — quebra a aba para R.
          if (!passou.N3 && !QUEBRAS_POR_ABA.has(chave)) QUEBRAS_POR_ABA.set(chave, "N3");
        }
        const nomeN2 = `N2 · ${op} · ${rota} · ${relogio} — a MESMA ação funciona de novo na mesma aba, depois que a frase da anterior SAIU da tela`;
        await medirNoOrcamento(`N2 ${op} ${rota} ${curto}`, nomeN2, async () => {
          const r = await repetirAcaoEnvelhecida(sentinela, op);
          if (r.problemas.length === 0) {
            REPETICOES_OK += 1;
            const relogios = RELOGIOS_POR_OP_REPETIDA.get(op) ?? new Set();
            relogios.add(relogio);
            RELOGIOS_POR_OP_REPETIDA.set(op, relogios);
          }
          passou.N2 = r.problemas.length === 0;
          conferir(
            nomeN2,
            r.problemas.length === 0,
            `${r.resumo}${r.problemas.length === 0 ? "" : ` — ${r.problemas.join(" | ")}`}`,
          );
        });
        if (!passou.N2 && !QUEBRAS_POR_ABA.has(chave)) QUEBRAS_POR_ABA.set(chave, "N2");
      }
      /*
       * [ALTO, rodada 23] A MESMA AÇÃO, COM O PEDIDO FALHANDO — família R. Só na
       * sentinela do relógio da guarda (relógio pausado: as janelas de 10 s não
       * fecham no meio da falha), uma vez por op, logo depois das vezes N.
       */
      if (sentinela.comRelogioDeMentira) {
        const nomeR = `R · ${op} · ${rota} · ${relogio} — com o pedido FALHANDO, a tela diz, a loja não muda, o que o operador fez fica, e tentar de novo grava o mesmo pedido`;
        await medirNoOrcamento(`R ${op} ${rota} ${curto}`, nomeR, async () => {
          const r = await exercerFalha(sentinela, op);
          passou.R = r.problemas.length === 0;
          conferir(
            nomeR,
            r.problemas.length === 0,
            `${r.resumo}${r.problemas.length === 0 ? "" : ` — ${r.problemas.join(" | ")}`}`,
            r.naoMedido === true ? "nao-medido" : "medido",
          );
        });
        if (!passou.R && !QUEBRAS_POR_ABA.has(chave)) QUEBRAS_POR_ABA.set(chave, "R");
        /*
         * [ALTO, rodada 24] O OPERADOR CONTINUA AGINDO DURANTE A ESPERA — família
         * W. Na mesma aba, logo depois da R, só nas ops com campo ou escolha
         * (derivadas da regra de tela de cada uma).
         */
        if (OPS_COM_ESPERA.includes(op)) {
          const nomeW = `W · ${op} · ${rota} · ${relogio} — o operador continua agindo DURANTE a espera, e nos três desfechos (a rede cai, o servidor recusa, passa) o que ele fez fica na tela e no rascunho`;
          await medirNoOrcamento(`W ${op} ${rota} ${curto}`, nomeW, async () => {
            const r = await exercerEspera(sentinela, op);
            conferir(
              nomeW,
              r.problemas.length === 0,
              `${r.resumo}${r.problemas.length === 0 ? "" : ` — ${r.problemas.join(" | ")}`}`,
              r.naoMedido === true ? "nao-medido" : "medido",
            );
          });
        }
      }
    }
  }
}

/*
 * N0 · O FECHO, NOS DOIS SENTIDOS, E O PISO CONTADO FORA.
 *
 * Mesma lei da medida P0: o universo é a lista canônica da página, op sem
 * linha reprova nomeando a op, linha que não existe mais na página também. E o
 * piso é contado aqui, FORA das trinta medidas que ele protege: apagá-las
 * deixaria trinta ausências, e ausência combina com "nenhum problema".
 */
await medir("N0", async () => {
  const naTabela = Object.keys(ACAO_ENVELHECIDA_POR_OP);
  const problemas = [];
  const semLinha = OPS_DA_PAGINA.filter((op) => !Object.hasOwn(ACAO_ENVELHECIDA_POR_OP, op));
  const sobrando = naTabela.filter((op) => !OPS_DA_PAGINA.includes(op));
  if (OPS_DA_PAGINA.length === 0) {
    problemas.push(
      "não consegui ler `OPERACOES_DE_ESCRITA` de src/app/tarefa/pedido.ts — universo vazio é cegueira, não aprovação",
    );
  }
  if (semLinha.length > 0) {
    problemas.push(
      `op(s) da página SEM exercício envelhecido: ${semLinha.join(
        ", ",
      )} — ação que o tempo pode matar e ninguém exerce depois do tempo passar`,
    );
  }
  if (sobrando.length > 0) {
    problemas.push(`exercício(s) de op que não existe mais na página: ${sobrando.join(", ")}`);
  }
  const semOsDoisRelogios = OPS_DA_PAGINA.filter(
    (op) => (RELOGIOS_POR_OP_ENVELHECIDA.get(op)?.size ?? 0) < 2,
  );
  if (semOsDoisRelogios.length > 0) {
    problemas.push(
      `op(s) que não passaram nos DOIS relógios: ${semOsDoisRelogios
        .map(
          (op) =>
            `${op} [${[...(RELOGIOS_POR_OP_ENVELHECIDA.get(op) ?? [])].join(", ") || "nenhum"}]`,
        )
        .join(" · ")}`,
    );
  }
  if (ACOES_ENVELHECIDAS_OK < PISO_DE_ACOES_ENVELHECIDAS) {
    problemas.push(
      `só ${String(
        ACOES_ENVELHECIDAS_OK,
      )} exercício(s) envelhecido(s) bem-sucedido(s), piso escrito à mão ${String(
        PISO_DE_ACOES_ENVELHECIDAS,
      )} (${String(OPS_DA_PAGINA.length)} op(s) × 2 relógios)`,
    );
  }
  if (CLASSE_DE_OPCIONALIDADE.length < PISO_DE_OPCIONALIDADE) {
    problemas.push(
      `a classe de opcionalidade tem ${String(
        CLASSE_DE_OPCIONALIDADE.length,
      )} opção(ões), piso ${String(PISO_DE_OPCIONALIDADE)} — sem ela o trio dos átomos não é derivado`,
    );
  }
  if (CLASSE_DE_ESFORCO_CUSTO.length < PISO_DE_ESFORCO_CUSTO) {
    problemas.push(
      `a classe de esforço/custo tem ${String(
        CLASSE_DE_ESFORCO_CUSTO.length,
      )} opção(ões), piso ${String(PISO_DE_ESFORCO_CUSTO)}`,
    );
  }
  // A distribuição cobre o universo? É a prova de que a redução por custo é
  // derivada, e não uma amostra escolhida a dedo.
  const cobertas = new Set();
  for (let i = 0; i < ROTAS_COM_SENTINELA.length; i += 1) {
    for (const op of fatiaDaRota(i)) cobertas.add(op);
  }
  const foraDaDistribuicao = OPS_DA_PAGINA.filter((op) => !cobertas.has(op));
  if (foraDaDistribuicao.length > 0) {
    problemas.push(
      `a distribuição por rota deixou op(s) de fora: ${foraDaDistribuicao.join(", ")}`,
    );
  }
  conferir(
    "N0 · toda ação de escrita da página tem exercício numa aba envelhecida, nos dois relógios",
    problemas.length === 0,
    `${String(OPS_DA_PAGINA.length)} op(s) no universo de src/app/tarefa/pedido.ts · ${String(
      ACOES_ENVELHECIDAS_OK,
    )} exercício(s) bem-sucedido(s) (piso ${String(
      PISO_DE_ACOES_ENVELHECIDAS,
    )}) · distribuição derivada, uma rota por índice: ${ROTAS_COM_SENTINELA.map(
      (r, i) => `${r}=[${fatiaDaRota(i).join(", ")}]`,
    ).join(" · ")} · classe dos átomos derivada do fonte: opcionalidade=${JSON.stringify(
      CLASSE_DE_OPCIONALIDADE.map((o) => o.valor),
    )} esforço/custo=${JSON.stringify(CLASSE_DE_ESFORCO_CUSTO.map((o) => o.valor))}${
      problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`
    }`,
  );
});

/*
 * N2-0 · O FECHO DA REPETIÇÃO, NOS DOIS SENTIDOS, E O PISO CONTADO FORA.
 *
 * [ALTO, rodada 21] Mesma lei de N0 e de P0. Formas viciadas que isto cerca:
 * a 3ª ("universo por convenção" — o universo é `OPS_DA_PAGINA`, lido do
 * produto, e o fecho é nos dois sentidos), a 2ª ("aprova por ausência" — o
 * piso é escrito à mão e contado aqui, fora das trinta medidas N2) e a 1ª
 * ("conta a si mesma" — o contador é de módulo, só as medidas N2 bem-sucedidas
 * o sobem, e os nomes delas são exigidos pela lista nominal do fim).
 */
await medir("N2-0", async () => {
  const naTabela = Object.keys(REPETICAO_POR_OP);
  const problemas = [];
  const semLinha = OPS_DA_PAGINA.filter((op) => !Object.hasOwn(REPETICAO_POR_OP, op));
  const sobrando = naTabela.filter((op) => !OPS_DA_PAGINA.includes(op));
  if (OPS_DA_PAGINA.length === 0) {
    problemas.push(
      "não consegui ler `OPERACOES_DE_ESCRITA` de src/app/tarefa/pedido.ts — universo vazio é cegueira, não aprovação",
    );
  }
  if (semLinha.length > 0) {
    problemas.push(
      `op(s) da página SEM repetição declarada: ${semLinha.join(
        ", ",
      )} — ação que pode funcionar só da 1ª vez e ninguém exerce a 2ª`,
    );
  }
  if (sobrando.length > 0) {
    problemas.push(`repetição declarada para op que não existe mais na página: ${sobrando.join(", ")}`);
  }
  const modoInvalido = naTabela.filter(
    (op) => !MODOS_DE_REPETICAO.includes(REPETICAO_POR_OP[op]?.modo),
  );
  if (modoInvalido.length > 0) {
    problemas.push(`modo de repetição desconhecido em: ${modoInvalido.join(", ")}`);
  }
  const semPorque = naTabela.filter(
    (op) => String(REPETICAO_POR_OP[op]?.porque ?? "").trim().length < TAMANHO_MINIMO_DO_PORQUE,
  );
  if (semPorque.length > 0) {
    problemas.push(
      `linha(s) de repetição sem um porquê que se entenda sozinho (mínimo ${String(
        TAMANHO_MINIMO_DO_PORQUE,
      )} caracteres): ${semPorque.join(", ")}`,
    );
  }
  const fora = OPS_DA_PAGINA.filter((op) => REPETICAO_POR_OP[op]?.modo === "fora");
  const repetidas = OPS_DA_PAGINA.filter(
    (op) => Object.hasOwn(REPETICAO_POR_OP, op) && REPETICAO_POR_OP[op].modo !== "fora",
  );
  const semOsDoisRelogios = repetidas.filter(
    (op) => (RELOGIOS_POR_OP_REPETIDA.get(op)?.size ?? 0) < 2,
  );
  if (semOsDoisRelogios.length > 0) {
    problemas.push(
      `op(s) cuja 2ª vez não passou nos DOIS relógios: ${semOsDoisRelogios
        .map(
          (op) =>
            `${op} [${[...(RELOGIOS_POR_OP_REPETIDA.get(op) ?? [])].join(", ") || "nenhum"}]`,
        )
        .join(" · ")}`,
    );
  }
  if (REPETICOES_OK < PISO_DE_REPETICOES) {
    problemas.push(
      `só ${String(REPETICOES_OK)} repetição(ões) bem-sucedida(s), piso escrito à mão ${String(
        PISO_DE_REPETICOES,
      )} (${String(OPS_DA_PAGINA.length)} op(s) × 2 relógios${
        fora.length === 0 ? "" : `, ${String(fora.length)} declarada(s) fora`
      })`,
    );
  }
  const idaEVolta = naTabela.filter((op) => REPETICAO_POR_OP[op]?.modo === "ida-e-volta");
  if (idaEVolta.length < PISO_DE_IDA_E_VOLTA) {
    problemas.push(
      `só ${String(idaEVolta.length)} op(s) exercida(s) indo e voltando, piso escrito à mão ${String(
        PISO_DE_IDA_E_VOLTA,
      )} (status e meta alternam estado)`,
    );
  }
  const porModo = MODOS_DE_REPETICAO.map(
    (m) => `${m}=[${naTabela.filter((op) => REPETICAO_POR_OP[op]?.modo === m).join(", ")}]`,
  ).join(" · ");
  conferir(
    "N2-0 · toda ação de escrita da página funciona uma 2ª vez na mesma aba envelhecida, nos dois relógios",
    problemas.length === 0,
    `${String(OPS_DA_PAGINA.length)} op(s) no universo de src/app/tarefa/pedido.ts · ${String(
      REPETICOES_OK,
    )} repetição(ões) bem-sucedida(s) (piso ${String(
      PISO_DE_REPETICOES,
    )}) · modos: ${porModo} · fora da repetição: ${
      fora.length === 0
        ? "nenhuma"
        : fora.map((op) => `${op} (${REPETICAO_POR_OP[op].porque})`).join(" · ")
    }${problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`}`,
  );
});

/*
 * N3-0 · O FECHO DA "2ª VEZ COM A FRASE NA TELA", NOS DOIS SENTIDOS, E O PISO
 * CONTADO FORA.
 *
 * [ALTO, rodada 22] Mesma lei de N0, N2-0 e P0. Formas viciadas que isto cerca:
 * a 3ª ("universo por convenção" — o universo é `OPS_DA_PAGINA`, lido do
 * produto; op sem linha em `COM_FRASE_POR_OP` reprova nomeando a op, linha de
 * op que a página não tem mais também); a 2ª ("aprova por ausência" — o piso é
 * escrito à mão e contado aqui, fora das trinta medidas N3); a 1ª ("conta a si
 * mesma" — o contador é de módulo, só N3 bem-sucedida o sobe, e os nomes delas
 * são exigidos pela lista nominal do fim). E a exceção não nasce calada: toda
 * `da-preparacao` traz a frase que a substitui e um porquê que se entende
 * sozinho, e `fora` só vale para op que a N2 já declarou fora, com o motivo.
 */
await medir("N3-0", async () => {
  const naTabela = Object.keys(COM_FRASE_POR_OP);
  const problemas = [];
  const semLinha = OPS_DA_PAGINA.filter((op) => !Object.hasOwn(COM_FRASE_POR_OP, op));
  const sobrando = naTabela.filter((op) => !OPS_DA_PAGINA.includes(op));
  if (OPS_DA_PAGINA.length === 0) {
    problemas.push(
      "não consegui ler `OPERACOES_DE_ESCRITA` de src/app/tarefa/pedido.ts — universo vazio é cegueira, não aprovação",
    );
  }
  if (semLinha.length > 0) {
    problemas.push(
      `op(s) da página SEM exercício com a frase da anterior na tela: ${semLinha.join(
        ", ",
      )} — ação que pode sumir quando a confirmação da anterior ainda está lá, e ninguém a dispara nessa janela`,
    );
  }
  if (sobrando.length > 0) {
    problemas.push(`exercício com a frase na tela para op que não existe mais na página: ${sobrando.join(", ")}`);
  }
  const fraseInvalida = naTabela.filter(
    (op) => !FRASES_DA_REPETICAO.includes(COM_FRASE_POR_OP[op]?.frase),
  );
  if (fraseInvalida.length > 0) {
    problemas.push(`declaração de frase desconhecida em: ${fraseInvalida.join(", ")}`);
  }
  const semMotivo = naTabela.filter(
    (op) =>
      COM_FRASE_POR_OP[op]?.frase !== "da-1a" &&
      String(COM_FRASE_POR_OP[op]?.porque ?? "").trim().length < TAMANHO_MINIMO_DO_PORQUE,
  );
  if (semMotivo.length > 0) {
    problemas.push(
      `exceção sem um porquê que se entenda sozinho (mínimo ${String(
        TAMANHO_MINIMO_DO_PORQUE,
      )} caracteres): ${semMotivo.join(", ")}`,
    );
  }
  const semFraseSubstituta = naTabela.filter(
    (op) =>
      COM_FRASE_POR_OP[op]?.frase === "da-preparacao" &&
      !(COM_FRASE_POR_OP[op]?.fraseDaPreparacao instanceof RegExp),
  );
  if (semFraseSubstituta.length > 0) {
    problemas.push(
      `"da-preparacao" sem a frase que envolve o disparo: ${semFraseSubstituta.join(", ")}`,
    );
  }
  const foraSemSerForaNaN2 = naTabela.filter(
    (op) => COM_FRASE_POR_OP[op]?.frase === "fora" && REPETICAO_POR_OP[op]?.modo !== "fora",
  );
  if (foraSemSerForaNaN2.length > 0) {
    problemas.push(
      `op(s) declarada(s) fora da janela "com a frase na tela" sem estar fora da repetição (N2): ${foraSemSerForaNaN2.join(
        ", ",
      )} — exceção nova sem motivo de repetição`,
    );
  }
  const exercidas = OPS_DA_PAGINA.filter(
    (op) => Object.hasOwn(COM_FRASE_POR_OP, op) && COM_FRASE_POR_OP[op].frase !== "fora",
  );
  const semOsDoisRelogios = exercidas.filter(
    (op) => (RELOGIOS_POR_OP_COM_FRASE.get(op)?.size ?? 0) < 2,
  );
  if (semOsDoisRelogios.length > 0) {
    problemas.push(
      `op(s) cuja 2ª vez com a frase na tela não passou nos DOIS relógios: ${semOsDoisRelogios
        .map(
          (op) =>
            `${op} [${[...(RELOGIOS_POR_OP_COM_FRASE.get(op) ?? [])].join(", ") || "nenhum"}]`,
        )
        .join(" · ")}`,
    );
  }
  const fora = OPS_DA_PAGINA.filter((op) => COM_FRASE_POR_OP[op]?.frase === "fora");
  if (COM_FRASE_OK < PISO_COM_FRASE) {
    problemas.push(
      `só ${String(COM_FRASE_OK)} 2ª(s) vez(es) bem-sucedida(s) com a frase na tela, piso escrito à mão ${String(
        PISO_COM_FRASE,
      )} (${String(OPS_DA_PAGINA.length)} op(s) × 2 relógios${
        fora.length === 0 ? "" : `, ${String(fora.length)} declarada(s) fora`
      })`,
    );
  }
  const da1a = naTabela.filter((op) => COM_FRASE_POR_OP[op]?.frase === "da-1a");
  if (da1a.length < PISO_DA_1A) {
    problemas.push(
      `só ${String(da1a.length)} op(s) disparada(s) com a frase da PRÓPRIA 1ª vez na tela, piso escrito à mão ${String(
        PISO_DA_1A,
      )}`,
    );
  }
  /*
   * Se TUDO o que falta é N3 que a guarda não conseguiu medir (a frase saiu por
   * tempo antes do disparo, no relógio de verdade), o fecho também não mediu:
   * código 2, não verde e não defeito provado. Qualquer outro problema é FALHA.
   */
  const faltaSoPorNaoMedida =
    problemas.length > 0 &&
    COM_FRASE_NAO_MEDIDAS > 0 &&
    COM_FRASE_OK + COM_FRASE_NAO_MEDIDAS >= PISO_COM_FRASE &&
    semLinha.length === 0 &&
    sobrando.length === 0 &&
    fraseInvalida.length === 0 &&
    semMotivo.length === 0 &&
    semFraseSubstituta.length === 0 &&
    foraSemSerForaNaN2.length === 0 &&
    da1a.length >= PISO_DA_1A;
  const porFrase = FRASES_DA_REPETICAO.map(
    (f) => `${f}=[${naTabela.filter((op) => COM_FRASE_POR_OP[op]?.frase === f).join(", ")}]`,
  ).join(" · ");
  conferir(
    "N3-0 · toda ação de escrita da página funciona uma 2ª vez COM A FRASE da anterior na tela, nos dois relógios",
    problemas.length === 0,
    `${String(OPS_DA_PAGINA.length)} op(s) no universo de src/app/tarefa/pedido.ts · ${String(
      COM_FRASE_OK,
    )} 2ª(s) vez(es) com a frase na tela bem-sucedida(s) (piso ${String(
      PISO_COM_FRASE,
    )}) · não medidas por tempo: ${String(COM_FRASE_NAO_MEDIDAS)} · frases: ${porFrase} · exceções: ${
      naTabela
        .filter((op) => COM_FRASE_POR_OP[op]?.frase !== "da-1a")
        .map((op) => `${op} (${COM_FRASE_POR_OP[op].porque})`)
        .join(" · ") || "nenhuma"
    }${problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`}`,
    faltaSoPorNaoMedida ? "nao-medido" : "medido",
  );
});

/*
 * R0 · O FECHO DA FALHA, NOS DOIS SENTIDOS, E O PISO CONTADO FORA.
 *
 * [ALTO, rodada 23] Mesma lei de N0, N2-0, N3-0 e P0. Formas viciadas que isto
 * cerca: a 3ª ("universo por convenção" — o universo é `OPS_DA_PAGINA`, lido do
 * produto; op sem linha em `FALHA_POR_OP` reprova nomeando a op, linha de op que
 * a página não tem mais também; e os campos com rascunho são os de
 * `CAMPOS_COM_RASCUNHO`, lidos do fonte, cada um exigido numa falha conferida);
 * a 2ª ("aprova por ausência" — o piso de 30 pares op × modo é escrito à mão e
 * contado aqui, fora das medidas R; a citação de E2–E4 só conta se a medida
 * citada EXISTIU e PASSOU nesta corrida); a 1ª ("conta a si mesma" — os
 * contadores são de módulo, só exercício bem-sucedido os sobe, e os nomes das
 * medidas R são exigidos pela lista nominal do fim).
 */
await medir("R0", async () => {
  const naTabela = Object.keys(FALHA_POR_OP);
  const problemas = [];
  const semLinha = OPS_DA_PAGINA.filter((op) => !Object.hasOwn(FALHA_POR_OP, op));
  const sobrando = naTabela.filter((op) => !OPS_DA_PAGINA.includes(op));
  if (OPS_DA_PAGINA.length === 0) {
    problemas.push(
      "não consegui ler `OPERACOES_DE_ESCRITA` de src/app/tarefa/pedido.ts — universo vazio é cegueira, não aprovação",
    );
  }
  if (semLinha.length > 0) {
    problemas.push(
      `op(s) da página SEM exercício de falha: ${semLinha.join(
        ", ",
      )} — escrita que pode perder o que o operador fez quando o servidor falha, e ninguém a exerce falhando`,
    );
  }
  if (sobrando.length > 0) {
    problemas.push(`exercício de falha de op que não existe mais na página: ${sobrando.join(", ")}`);
  }
  const regraInvalida = naTabela.filter((op) => !REGRAS_DA_TELA_NA_FALHA.includes(FALHA_POR_OP[op]?.regra));
  if (regraInvalida.length > 0) problemas.push(`regra de tela desconhecida em: ${regraInvalida.join(", ")}`);
  const semPorque = naTabela.filter(
    (op) => String(FALHA_POR_OP[op]?.porque ?? "").trim().length < TAMANHO_MINIMO_DO_PORQUE,
  );
  if (semPorque.length > 0) {
    problemas.push(
      `linha(s) de falha sem um porquê que se entenda sozinho (mínimo ${String(
        TAMANHO_MINIMO_DO_PORQUE,
      )} caracteres): ${semPorque.join(", ")}`,
    );
  }
  // A citação: só E2–E4, só para "o-desfazer-fica", e só se a medida citada passou.
  const citacoes = [];
  for (const op of naTabela) {
    for (const [modo, medida] of Object.entries(FALHA_POR_OP[op]?.citadas ?? {})) {
      citacoes.push(`${op}|${modo} → ${medida}`);
      if (!MODOS_DE_FALHA.includes(modo)) problemas.push(`${op} cita o modo desconhecido "${modo}"`);
      if (!MEDIDAS_CITAVEIS.includes(medida)) {
        problemas.push(`${op} cita ${medida}, que não é caso desta família (só ${MEDIDAS_CITAVEIS.join(", ")})`);
      }
      if (FALHA_POR_OP[op].regra !== "o-desfazer-fica") {
        problemas.push(`${op} cita ${medida} sem ser um "Desfazer" — citar só vale para o-desfazer-fica`);
      }
    }
  }
  const citadasUsadas = new Set(
    naTabela.flatMap((op) => Object.values(FALHA_POR_OP[op]?.citadas ?? {})),
  );
  const citadaFantasma = MEDIDAS_CITAVEIS.filter((m) => !citadasUsadas.has(m));
  if (citadaFantasma.length > 0) {
    problemas.push(`medida(s) citável(is) que nenhuma op cita: ${citadaFantasma.join(", ")}`);
  }
  // O PISO, contado fora das medidas R: cada op × modo, exercido ou citado-e-passou.
  let exercidos = 0;
  const faltando = [];
  for (const op of OPS_DA_PAGINA) {
    for (const modo of MODOS_DE_FALHA) {
      const citada = FALHA_POR_OP[op]?.citadas?.[modo];
      const ok = citada === undefined ? FALHAS_OK.has(`${op}|${modo}`) : MEDIDAS_CITADAS_OK.has(citada);
      if (ok) exercidos += 1;
      else faltando.push(`${op} [${modo}${citada === undefined ? "" : ` → ${citada} não passou`}]`);
    }
  }
  if (exercidos < PISO_DE_FALHAS_EXERCIDAS) {
    problemas.push(
      `só ${String(exercidos)} par(es) op × modo de falha bem-sucedido(s), piso escrito à mão ${String(
        PISO_DE_FALHAS_EXERCIDAS,
      )} (${String(OPS_DA_PAGINA.length)} op(s) × ${String(MODOS_DE_FALHA.length)} modos) — faltam: ${faltando.join(
        " · ",
      )}`,
    );
  }
  const regrasUsadas = REGRAS_DA_TELA_NA_FALHA.filter((r) => naTabela.some((op) => FALHA_POR_OP[op]?.regra === r));
  if (regrasUsadas.length < PISO_DE_REGRAS_EXERCIDAS) {
    problemas.push(
      `só ${String(regrasUsadas.length)} regra(s) de tela com op, piso escrito à mão ${String(PISO_DE_REGRAS_EXERCIDAS)}`,
    );
  }
  // As frases e os rascunhos saem do fonte — e cada leitura tem piso próprio.
  if (MENSAGEM_DA_REDE_DO_FONTE === null) {
    problemas.push("não consegui ler de usar-acao-tarefa.ts a frase que o produto diz quando a rede cai");
  }
  if (MENSAGEM_DA_RECUSA_DO_FONTE === null) {
    problemas.push("não consegui ler de actions.ts a frase que o servidor devolve para op desconhecida");
  }
  const frasesProprias = Object.keys(FRASE_DE_FALHA_POR_OP);
  if (frasesProprias.length < PISO_DE_FRASES_DE_FALHA_PROPRIAS) {
    problemas.push(
      `só ${String(frasesProprias.length)} porta(s) com frase de falha própria lida(s) do fonte, piso escrito à mão ${String(
        PISO_DE_FRASES_DE_FALHA_PROPRIAS,
      )}`,
    );
  }
  const desfazerSemFrase = naTabela.filter(
    (op) => FALHA_POR_OP[op]?.regra === "o-desfazer-fica" && FRASE_DE_FALHA_POR_OP[op] === undefined,
  );
  if (desfazerSemFrase.length > 0) {
    problemas.push(`"Desfazer" sem frase de falha própria no fonte: ${desfazerSemFrase.join(", ")}`);
  }
  const camposDoFonte = Object.keys(CAMPOS_COM_RASCUNHO_DO_FONTE);
  if (camposDoFonte.length < PISO_DE_CAMPOS_COM_RASCUNHO) {
    problemas.push(
      `só ${String(camposDoFonte.length)} campo(s) com rascunho lido(s) de rascunho.ts, piso escrito à mão ${String(
        PISO_DE_CAMPOS_COM_RASCUNHO,
      )}`,
    );
  }
  if (MOLDE_DA_CHAVE_DO_RASCUNHO === null) {
    problemas.push("não consegui ler de rascunho.ts a forma da chave do rascunho (`chaveRascunho`)");
  }
  const rascunhoSemFalha = camposDoFonte.filter((c) => !RASCUNHOS_CONFERIDOS.has(c));
  if (rascunhoSemFalha.length > 0) {
    problemas.push(
      `campo(s) com rascunho que NENHUMA falha conferiu: ${rascunhoSemFalha.join(
        ", ",
      )} — o texto dele pode sumir no pedido que falha e ninguém olha`,
    );
  }
  // Se TUDO o que falta é par que a guarda não conseguiu medir, o fecho também não mediu.
  const faltaSoPorNaoMedida =
    problemas.length === 1 &&
    exercidos < PISO_DE_FALHAS_EXERCIDAS &&
    FALHAS_NAO_MEDIDAS.size > 0 &&
    exercidos + FALHAS_NAO_MEDIDAS.size >= PISO_DE_FALHAS_EXERCIDAS;
  const porRegra = REGRAS_DA_TELA_NA_FALHA.map(
    (r) => `${r}=[${naTabela.filter((op) => FALHA_POR_OP[op]?.regra === r).join(", ")}]`,
  ).join(" · ");
  conferir(
    "R0 · toda ação de escrita da página, com o pedido FALHANDO nos dois modos, deixa a loja e o que o operador fez como estavam",
    problemas.length === 0,
    `${String(OPS_DA_PAGINA.length)} op(s) no universo de src/app/tarefa/pedido.ts · ${String(
      exercidos,
    )} par(es) op × modo bem-sucedido(s) (piso ${String(PISO_DE_FALHAS_EXERCIDAS)}) · não medidos: ${String(
      FALHAS_NAO_MEDIDAS.size,
    )} · modos: ${MODOS_DE_FALHA.join(", ")} (rede cai = "${String(
      MENSAGEM_DA_REDE_DO_FONTE,
    )}"; servidor recusa = "${String(MENSAGEM_DA_RECUSA_DO_FONTE)}") · regras: ${porRegra} · citações: ${
      citacoes.join(", ") || "nenhuma"
    } (passaram: ${[...MEDIDAS_CITADAS_OK].join(", ") || "nenhuma"}) · rascunhos conferidos numa falha: ${
      [...RASCUNHOS_CONFERIDOS].join(", ") || "nenhum"
    } de ${camposDoFonte.join(", ")} · frases de falha próprias: ${frasesProprias.join(", ")}${
      problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`
    }`,
    faltaSoPorNaoMedida ? "nao-medido" : "medido",
  );
});

/*
 * W0 · O FECHO DA ESPERA, NOS DOIS SENTIDOS, E O PISO CONTADO FORA.
 *
 * [ALTO, rodada 24] Mesma lei de R0. Formas viciadas que isto cerca: a 3ª
 * ("universo por convenção" — o universo é `OPS_DA_PAGINA`; o jeito de agir na
 * espera de cada op é DERIVADO da regra de tela dela; a tabela `ESPERA_POR_REGRA`
 * fecha nos dois sentidos com `REGRAS_DA_TELA_NA_FALHA`; op sem regra reprova
 * nomeando a op; e a frase de "Aguarde" vem de `escrita.ts`); a 2ª ("aprova por
 * ausência" — o piso de ops, de pares op × desfecho e de rascunhos conferidos é
 * escrito à mão e contado aqui, fora das medidas W); a 1ª ("conta a si mesma" —
 * os contadores são de módulo, só o passo bem-sucedido os sobe, e os nomes das
 * medidas W são exigidos pela lista nominal do fim).
 */
await medir("W0", async () => {
  const problemas = [];
  if (OPS_DA_PAGINA.length === 0) {
    problemas.push(
      "não consegui ler `OPERACOES_DE_ESCRITA` de src/app/tarefa/pedido.ts — universo vazio é cegueira, não aprovação",
    );
  }
  const semRegra = OPS_DA_PAGINA.filter((op) => ESPERA_POR_REGRA[FALHA_POR_OP[op]?.regra] === undefined);
  if (semRegra.length > 0) {
    problemas.push(
      `op(s) da página sem jeito de espera derivável (sem regra de tela, ou regra sem linha em ESPERA_POR_REGRA): ${semRegra.join(", ")}`,
    );
  }
  const regrasSemJeito = REGRAS_DA_TELA_NA_FALHA.filter((r) => !Object.hasOwn(ESPERA_POR_REGRA, r));
  const jeitoSemRegra = Object.keys(ESPERA_POR_REGRA).filter((r) => !REGRAS_DA_TELA_NA_FALHA.includes(r));
  if (regrasSemJeito.length > 0) problemas.push(`regra(s) de tela sem jeito de espera: ${regrasSemJeito.join(", ")}`);
  if (jeitoSemRegra.length > 0) problemas.push(`jeito de espera de regra que não existe: ${jeitoSemRegra.join(", ")}`);
  const jeitoDesconhecido = Object.entries(ESPERA_POR_REGRA).filter(
    ([, v]) => v.jeito !== "fora" && !JEITOS_EXERCIDOS_NA_ESPERA.includes(v.jeito),
  );
  if (jeitoDesconhecido.length > 0) {
    problemas.push(`jeito(s) de espera desconhecido(s): ${jeitoDesconhecido.map(([r, v]) => `${r}=${v.jeito}`).join(", ")}`);
  }
  const semPorque = Object.entries(ESPERA_POR_REGRA).filter(
    ([, v]) => String(v.porque ?? "").trim().length < TAMANHO_MINIMO_DO_PORQUE,
  );
  if (semPorque.length > 0) {
    problemas.push(`jeito(s) de espera sem um porquê que se entenda sozinho: ${semPorque.map(([r]) => r).join(", ")}`);
  }
  const escolhaSemGesto = OPS_COM_ESPERA.filter(
    (op) => jeitoDaEspera(op) === "tenta-outra-escolha" && typeof FALHA_POR_OP[op]?.outraEscolha !== "function",
  );
  if (escolhaSemGesto.length > 0) {
    problemas.push(`op(s) que gravam no gesto sem o gesto da OUTRA escolha: ${escolhaSemGesto.join(", ")}`);
  }
  if (OPS_COM_ESPERA.length < PISO_DE_OPS_COM_ESPERA) {
    problemas.push(
      `só ${String(OPS_COM_ESPERA.length)} op(s) com campo ou escolha derivadas da lista, piso escrito à mão ${String(
        PISO_DE_OPS_COM_ESPERA,
      )} — uma op que deixou de ser exercida na espera some daqui calada`,
    );
  }
  if (MENSAGEM_AGUARDE_DO_FONTE === null) {
    problemas.push("não consegui ler de escrita.ts a frase com que a porta recusa o 2º pedido durante a gravação");
  }
  // O PISO, contado fora das medidas W: cada op × desfecho bem-sucedido.
  const faltando = [];
  let exercidos = 0;
  for (const op of OPS_COM_ESPERA) {
    for (const d of DESFECHOS_DA_ESPERA) {
      if (ESPERAS_OK.has(`${op}|${d}`)) exercidos += 1;
      else faltando.push(`${op} [${d}]`);
    }
  }
  if (exercidos < PISO_DE_ESPERAS_EXERCIDAS || faltando.length > 0) {
    problemas.push(
      `só ${String(exercidos)} par(es) op × desfecho com o operador agindo na espera bem-sucedido(s), piso escrito à mão ${String(
        PISO_DE_ESPERAS_EXERCIDAS,
      )} (${String(OPS_COM_ESPERA.length)} op(s) × ${String(DESFECHOS_DA_ESPERA.length)} desfechos)${
        faltando.length > 0 ? ` — faltam: ${faltando.join(" · ")}` : ""
      }`,
    );
  }
  if (RASCUNHOS_NA_ESPERA.size < PISO_DE_RASCUNHOS_NA_ESPERA) {
    problemas.push(
      `só ${String(RASCUNHOS_NA_ESPERA.size)} rascunho(s) de campo mexido na espera conferido(s), piso escrito à mão ${String(
        PISO_DE_RASCUNHOS_NA_ESPERA,
      )}`,
    );
  }
  const faltaSoPorNaoMedida =
    problemas.length === 1 &&
    ESPERAS_NAO_MEDIDAS.size > 0 &&
    exercidos + ESPERAS_NAO_MEDIDAS.size >= PISO_DE_ESPERAS_EXERCIDAS;
  const porJeito = [...JEITOS_EXERCIDOS_NA_ESPERA, "fora"]
    .map((jj) => `${jj}=[${OPS_DA_PAGINA.filter((op) => jeitoDaEspera(op) === jj).join(", ")}]`)
    .join(" · ");
  conferir(
    "W0 · toda ação com campo ou escolha, com o operador agindo DURANTE a espera, guarda o que ele fez nos três desfechos",
    problemas.length === 0,
    `${String(OPS_DA_PAGINA.length)} op(s) no universo de src/app/tarefa/pedido.ts · jeitos (derivados da regra de tela): ${porJeito} · ${String(
      exercidos,
    )} par(es) op × desfecho bem-sucedido(s) (piso ${String(PISO_DE_ESPERAS_EXERCIDAS)}) · não medidos: ${String(
      ESPERAS_NAO_MEDIDAS.size,
    )} · desfechos: ${DESFECHOS_DA_ESPERA.join(", ")} · recusa do 2º pedido = "${String(
      MENSAGEM_AGUARDE_DO_FONTE,
    )}" · rascunhos do campo mexido conferidos: ${[...RASCUNHOS_NA_ESPERA].join(", ") || "nenhum"} (piso ${String(
      PISO_DE_RASCUNHOS_NA_ESPERA,
    )}) · fora: ${Object.entries(ESPERA_POR_REGRA)
      .filter(([, v]) => v.jeito === "fora")
      .map(([r, v]) => `${r} (${v.porque})`)
      .join(" · ")}${problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`}`,
    faltaSoPorNaoMedida ? "nao-medido" : "medido",
  );
});

for (const sentinela of SENTINELAS) await sentinela.contexto.close();

// P0 — o universo não é convenção: é a lista canônica da página.
await medir("P0", async () => {
  const naTabela = Object.keys(PERSISTENCIA_POR_OP);
  const semLinha = OPS_DA_PAGINA.filter((op) => !Object.hasOwn(PERSISTENCIA_POR_OP, op));
  const sobrando = naTabela.filter((op) => !OPS_DA_PAGINA.includes(op));
  const conferidas = OPS_DA_PAGINA.filter(
    (op) => typeof PERSISTENCIA_POR_OP[op]?.conferir === "function",
  );
  const dispensadas = OPS_DA_PAGINA.filter(
    (op) => typeof PERSISTENCIA_POR_OP[op]?.semConferencia === "string",
  );
  const dispensaSemMotivo = dispensadas.filter(
    (op) => (PERSISTENCIA_POR_OP[op]?.semConferencia ?? "").trim().length < 40,
  );
  const problemas = [];
  if (OPS_DA_PAGINA.length === 0) {
    problemas.push(
      "não consegui ler `OPERACOES_DE_ESCRITA` de src/app/tarefa/pedido.ts — universo vazio é cegueira, não aprovação",
    );
  }
  if (semLinha.length > 0) {
    problemas.push(`op(s) da página SEM linha nesta tabela: ${semLinha.join(", ")}`);
  }
  if (sobrando.length > 0) {
    problemas.push(`linha(s) desta tabela que não existem mais na página: ${sobrando.join(", ")}`);
  }
  if (dispensaSemMotivo.length > 0) {
    problemas.push(`dispensa(s) sem motivo escrito: ${dispensaSemMotivo.join(", ")}`);
  }
  if (conferidas.length < PISO_DE_OPS_CONFERIDAS) {
    problemas.push(
      `só ${String(conferidas.length)} op(s) com conferência de persistência, piso escrito à mão ${String(
        PISO_DE_OPS_CONFERIDAS,
      )} — conferir zero (ou pouco) nunca é sucesso`,
    );
  }
  // [ALTO #1, rodada 17] toda op conferida declara ALCANCE, com motivo escrito.
  const semAlcance = conferidas.filter(
    (op) => (PERSISTENCIA_POR_OP[op]?.alcance?.motivo ?? "").trim().length < 40,
  );
  if (semAlcance.length > 0) {
    problemas.push(
      `op(s) sem ALCANCE declarado com motivo escrito: ${semAlcance.join(
        ", ",
      )} — sem isso a escrita volta a ter alcance por convenção`,
    );
  }
  // [ALTO #1, rodada 17] e toda op conferida tem precondição PRÓPRIA.
  const semPrecondicao = conferidas.filter(
    (op) => typeof PERSISTENCIA_POR_OP[op]?.precondicao !== "function",
  );
  if (semPrecondicao.length > 0) {
    problemas.push(
      `op(s) sem precondição própria: ${semPrecondicao.join(
        ", ",
      )} — medida que herda o estado de outra não mede nada`,
    );
  }
  /*
   * [ALTO #1, rodada 17] O ESTADO DE PARTIDA COBRE OS CAMPOS QUE A PÁGINA
   * ESCREVE. Piso escrito à mão: encolher a lista (e voltar a medir sobre um
   * estado já estragado) passa a exigir baixar este número de propósito.
   */
  const PISO_DE_CAMPOS_DE_PARTIDA = 5;
  if (CAMPOS_DO_ESTADO_DE_PARTIDA.length < PISO_DE_CAMPOS_DE_PARTIDA) {
    problemas.push(
      `o estado de partida cobre só ${String(
        CAMPOS_DO_ESTADO_DE_PARTIDA.length,
      )} campo(s), piso escrito à mão ${String(
        PISO_DE_CAMPOS_DE_PARTIDA,
      )} — campo fora dele começa a medida já estragado e o alcance não tem como acusar`,
    );
  }
  // [ALTO #2, rodada 17 · BAIXO #6, rodada 18] a classe de valores da duração
  // continua sendo classe — e o piso é NOMINAL, separador por separador.
  const separadores = separadoresNaClasse(CLASSE_DA_DURACAO);
  const separadoresFaltando = SEPARADORES_DECIMAIS_EXIGIDOS.filter(
    (sep) => !separadores.includes(sep),
  );
  if (separadoresFaltando.length > 0) {
    problemas.push(
      `a classe da duração não tem nenhuma grafia com ${separadoresFaltando
        .map((sep) => JSON.stringify(sep))
        .join(" nem ")} — a derivação do contrato quebrou, e a medida voltaria a conferir só a grafia que sobrou (contar "quantas têm ponto OU vírgula" dava 2 com dois pontos e nenhuma vírgula)`,
    );
  }
  // [BAIXO #7, rodada 18] as DUAS leituras do universo têm de concordar.
  const soNoArray = OPS_DA_PAGINA.filter((op) => !OPS_DA_UNIAO_DE_TIPO.includes(op));
  const soNaUniao = OPS_DA_UNIAO_DE_TIPO.filter((op) => !OPS_DA_PAGINA.includes(op));
  if (soNoArray.length > 0 || soNaUniao.length > 0) {
    problemas.push(
      `as duas leituras do universo DIVERGEM: só no array=${
        soNoArray.join(", ") || "(nenhuma)"
      } · só na união de tipo=${soNaUniao.join(", ") || "(nenhuma)"}`,
    );
  }
  // [BAIXO #7, rodada 18] o piso não é o único fecho: TODA op é conferida.
  if (conferidas.length !== OPS_DA_PAGINA.length) {
    problemas.push(
      `${String(OPS_DA_PAGINA.length)} op(s) no universo e só ${String(
        conferidas.length,
      )} conferida(s) — op sem conferência não se compensa com piso`,
    );
  }
  // [ALTO #1, rodada 18] a classe dos status.
  if (CLASSE_DO_STATUS.length < PISO_DE_STATUS) {
    problemas.push(
      `a classe de status tem ${String(CLASSE_DO_STATUS.length)} opção(ões), piso escrito à mão ${String(
        PISO_DE_STATUS,
      )} — foi assim que \`bloqueada\` ficou sem nenhuma medida que a gravasse`,
    );
  }
  // [ALTO #2b, rodada 18] a classe das naturezas de relação.
  if (CLASSE_DE_TIPOS_DE_RELACAO.length < PISO_DE_TIPOS_DE_RELACAO) {
    problemas.push(
      `a classe de tipos de relação tem ${String(
        CLASSE_DE_TIPOS_DE_RELACAO.length,
      )} opção(ões), piso escrito à mão ${String(
        PISO_DE_TIPOS_DE_RELACAO,
      )} — três das quatro naturezas nunca tiveram persistência conferida`,
    );
  }
  conferir(
    "P0 · o universo das escritas sai da lista canônica da página, e toda op tem conferência (com alcance e precondição) ou dispensa com motivo",
    problemas.length === 0,
    `${String(OPS_DA_PAGINA.length)} op(s) em src/app/tarefa/pedido.ts: ${OPS_DA_PAGINA.join(
      ", ",
    )} · ${String(conferidas.length)} conferida(s) por persistência (piso ${String(
      PISO_DE_OPS_CONFERIDAS,
    )}) · ${String(dispensadas.length)} dispensada(s) com motivo escrito · estado de partida: ${CAMPOS_DO_ESTADO_DE_PARTIDA.join(
      ", ",
    )} · classe da duração (derivada do contrato): ${JSON.stringify(
      CLASSE_DA_DURACAO,
    )} com os separadores ${JSON.stringify(
      separadoresNaClasse(CLASSE_DA_DURACAO),
    )} (exigidos ${JSON.stringify(
      SEPARADORES_DECIMAIS_EXIGIDOS,
    )}) · classe de status (derivada do fonte): ${JSON.stringify(
      CLASSE_DO_STATUS.map((o) => o.rotulo),
    )} · classe de tipos de relação: ${JSON.stringify(
      CLASSE_DE_TIPOS_DE_RELACAO.map((o) => o.rotulo),
    )} · universo lido duas vezes: array=${String(OPS_DA_PAGINA.length)} união de tipo=${String(
      OPS_DA_UNIAO_DE_TIPO.length,
    )}${problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`}`,
  );
});

/*
 * ══════════════════════════════ ALTO #1, rodada 17 — A TERCEIRA VOLTA, MEDIDA ═
 * A FAMÍLIA P MEDE SOBRE A LOJA RECÉM-SEMEADA. NÃO É CONFORTO: É O QUE FAZ A
 * FOTOGRAFIA VALER ALGUMA COISA.
 *
 * Duas sabotagens desta rodada passaram verdes pela MESMA razão, e as duas
 * foram medidas aqui, não imaginadas:
 *
 *  1. a do crítico (`statusSetFixture` apagando a duração): quando `P · status`
 *     chegou, a medida D já tinha escrito status naquela tarefa lá atrás e a
 *     duração já era `null`. A escrita medida não mudou nada A MAIS, e o
 *     alcance — corretamente — não acusou nada;
 *  2. a minha (`parentSetFixture` marcando a MÃE como meta, um vizinho que
 *     nenhuma medida P abre): quando `P · mae` chegou, a medida H já tinha
 *     escolhido `task-setup` como mãe, o `isGoal` do vizinho JÁ ESTAVA `true`,
 *     e de novo não havia o que mudar.
 *
 * O estado de partida da rota resolve o caso (1) — ele restaura os cinco campos
 * DA TAREFA ABERTA. Não resolve o (2), e não tem como: o dano está num vizinho
 * que a página aberta não mostra e a guarda não visita.
 *
 * A resposta que cobre os dois é a única honesta: **a loja volta à semente**.
 * O store do modo fixture vive no `globalThis` do processo do servidor, então
 * reiniciar o servidor É semear de novo — sem endpoint de escrita, sem
 * `resetarFixtureStore` importado em `src/` (a varredura de
 * `tests/unit/tarefa-escritas-varredura` acusaria isso como escrita fora da
 * porta, e acusou: a primeira versão desta correção tinha um `POST` e ele caiu).
 *
 * Por que não rodar a família P ANTES das medidas A–M, que seria de graça: elas
 * também dependem da semente (a medida C exige a duração em `2`, a G exige a
 * caixa igual ao valor gravado). As duas famílias querem a loja limpa; o
 * reinício é o que dá isso às duas.
 */
await medir("P-loja", async () => {
  if (!SERVIDOR_PROPRIO) {
    conferir(
      "P-loja · a família P mede sobre a loja recém-semeada",
      false,
      "esta corrida recebeu LIFEBOARD_URL e a guarda não subiu o servidor — então não pode reiniciá-lo, e as medidas P abaixo mediriam sobre um estado que as medidas A–M já sujaram. Rode sem LIFEBOARD_URL (`npm run guarda:navegador`), que é como o CI roda.",
    );
    return;
  }
  const sujo = await fotografia();
  // [rodada 22] o grupo inteiro, e esperando sumir — ver `subirServidorProprio`.
  await encerrarServidorDeVez();
  let novo = await subirServidorProprio(120000);
  let refeito = "";
  if (novo === null) {
    /*
     * [rodada 22] O cache de compilação ficou torto (servidor velho morto no
     * meio de uma escrita em `.next/`): apagar o CACHE — só ele, que o
     * `next dev` refaz sozinho — e tentar uma vez mais. Dito no veredito.
     */
    rmSync(join(RAIZ_DO_PACOTE, ".next"), { recursive: true, force: true });
    novo = await subirServidorProprio(180000);
    refeito = " · o 1º reinício não respondeu em 120 s: o cache `.next/` foi apagado e o servidor subiu na 2ª tentativa";
  }
  if (novo === null) {
    conferir(
      "P-loja · a família P mede sobre a loja recém-semeada",
      false,
      "não consegui subir o servidor de novo depois de encerrá-lo, nem com o cache `.next/` apagado — sem isso a família P mediria sobre estado sujo",
    );
    return;
  }
  BASE = novo.base;
  encerrarServidor = novo.encerrar;
  encerrarServidorDeVez = novo.encerrarDeVez;
  const semeado = await fotografia();
  /*
   * A prova de que semeou: nenhuma entidade criada POR ESTA CORRIDA sobreviveu.
   * `novoId` (tasks.fixture-store.ts) carimba tudo o que nasce em tempo de
   * execução com `-fixture-`; a semente não tem nenhum id assim.
   */
  const nascidasNaCorrida = (foto) => [...foto.keys()].filter((c) => c.includes("-fixture-"));
  const sobreviventes = nascidasNaCorrida(semeado);
  conferir(
    "P-loja · a família P mede sobre a loja recém-semeada",
    sobreviventes.length === 0 && semeado.size >= PISO_DA_FOTOGRAFIA,
    `a loja suja tinha ${String(sujo.size)} entidade(s), ${String(
      nascidasNaCorrida(sujo).length,
    )} delas criadas por esta corrida; depois do reinício são ${String(
      semeado.size,
    )} entidade(s) e ${String(sobreviventes.length)} criada(s) por esta corrida (piso da fotografia: ${String(
      PISO_DA_FOTOGRAFIA,
    )})${
      sobreviventes.length === 0
        ? ""
        : ` — a loja NÃO voltou à semente: ${sobreviventes.join(", ")}`
    }${refeito}`,
  );
});

/** As ops conferidas, agrupadas por rota — uma aba por rota, F5 entre elas. */
const OPS_POR_ROTA = new Map();
for (const op of OPS_DA_PAGINA) {
  const entrada = PERSISTENCIA_POR_OP[op];
  if (entrada === undefined || typeof entrada.conferir !== "function") continue;
  const lista = OPS_POR_ROTA.get(entrada.rota) ?? [];
  lista.push(op);
  OPS_POR_ROTA.set(entrada.rota, lista);
}

for (const [rota, ops] of OPS_POR_ROTA) {
  const aberta = await abrir(rota);
  for (const op of ops) {
    await medir(`P ${op}`, async () => {
      const entrada = PERSISTENCIA_POR_OP[op];
      /*
       * [MÉDIO #2, rodada 19] A JANELA DESTA MEDIDA, medida pela própria
       * corrida: toda entidade que nascer daqui até o fim da escrita tem de ter
       * nascido DENTRO dela. É contra este par de instantes que a régua de
       * `instanteDaCriacao` julga — nada é comparado com "o agora" de um
       * relógio que ninguém anotou.
       */
      const janela = { inicio: Date.now(), fim: Date.now() };
      await recarregar(aberta.pagina);

      /*
       * 1 · O ESTADO DE PARTIDA DA ROTA, escrito por esta medida e CONFERIDO
       *     campo a campo. É o que garante que a escrita medida tenha o que
       *     perder — sem ele, a sabotagem que apaga a duração ao mudar o status
       *     passa verde porque a duração já tinha sido apagada por outra
       *     medida da guarda, lá atrás (medido nesta rodada).
       */
      const partida = await escreverEstadoDePartida(aberta.pagina);
      if (partida.obtido !== partida.esperado) {
        conferir(
          `P · ${op} · o que o operador pediu é o que está lá DEPOIS DO F5`,
          false,
          `rota=${rota} · o ESTADO DE PARTIDA desta rota não é o declarado: esperava ${JSON.stringify(
            partida.esperado,
          )} e achei ${JSON.stringify(
            partida.obtido,
          )} — os ${String(
            CAMPOS_DO_ESTADO_DE_PARTIDA.length,
          )} campos escritos pela página (${CAMPOS_DO_ESTADO_DE_PARTIDA.join(
            ", ",
          )}) têm de estar no ponto declarado ANTES de medir, senão a medida mede um estado que já veio estragado`,
        );
        return;
      }

      // 2 · a fotografia — depois do estado de partida, antes de tudo o mais.
      const foto0 = await fotografia();

      // 3 · a precondição PRÓPRIA da op, conferida. Nunca herdada em silêncio.
      const pre = await entrada.precondicao(aberta.pagina, partida);
      if (pre.obtido !== pre.esperado) {
        conferir(
          `P · ${op} · o que o operador pediu é o que está lá DEPOIS DO F5`,
          false,
          `rota=${rota} · a PRECONDIÇÃO desta medida não é a esperada: esperava ${JSON.stringify(
            pre.esperado,
          )} e achei ${JSON.stringify(
            pre.obtido,
          )} — a medida NÃO se adapta ao estado que outra deixou (foi exatamente assim que \`P · duracao\` mediu a própria precondição estragada e disse ok)`,
        );
        return;
      }

      // 4 · a fotografia depois da preparação: é entre 2 e 4 que uma sabotagem
      //     escondida na escrita da precondição apareceria.
      const foto1 = await fotografia();

      // 5 · a escrita medida.
      const r = await entrada.conferir(aberta.pagina, pre.dado ?? {});
      janela.fim = Date.now();

      // 6 · a fotografia do fim, e o ALCANCE.
      const fotoFim = await fotografia();
      const { problemas: problemasDoAlcance, resumo } = problemasDeAlcance(
        foto0,
        foto1,
        fotoFim,
        entrada.alcance ?? {},
        r.nascidas ?? [],
        janela,
      );

      const pediuOutraCoisa = r.pedido !== r.antes;
      const chegou = r.obtido === r.pedido;
      const anuncio = r.anuncio ?? "";
      const anuncioBate = r.anuncioEsperado.test(anuncio);
      const proibidoQueApareceu = (r.anunciosProibidos ?? []).filter((re) => re.test(anuncio));

      const problemas = [...problemasDoAlcance];
      if (!pediuOutraCoisa) {
        problemas.push("o pedido é IGUAL ao estado de antes: esta medida não mediu nada");
      }
      if (!chegou) problemas.push("o valor depois do F5 NÃO é o valor pedido");
      if (!anuncioBate) {
        problemas.push(
          `a tela não anunciou o que esta escrita fez: esperava ${String(
            r.anuncioEsperado,
          )} e li ${JSON.stringify(anuncio)}`,
        );
      }
      if (proibidoQueApareceu.length > 0) {
        problemas.push(
          `a tela anunciou o desfecho OPOSTO: ${proibidoQueApareceu
            .map((re) => String(re))
            .join(", ")} em ${JSON.stringify(anuncio)}`,
        );
      }

      conferir(
        `P · ${op} · o que o operador pediu é o que está lá DEPOIS DO F5`,
        problemas.length === 0,
        `rota=${rota} · partida=${JSON.stringify(
          partida.esperado,
        )} · precondição=${JSON.stringify(pre.esperado)} · antes=${JSON.stringify(
          r.antes,
        )} · PEDIDO=${JSON.stringify(r.pedido)} · depois do F5=${JSON.stringify(
          r.obtido,
        )} · anúncio=${JSON.stringify(anuncio)} · ${resumo}${
          r.extra === undefined ? "" : ` · ${r.extra}`
        }${problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`}`,
      );
    });
  }
  await aberta.contexto.close();
}

/*
 * ═══════════════════════════════════════════════════════ ALTO #2, rodada 18 ═
 * O PISO DAS ENTIDADES NOVAS COM CAMPOS CONFERIDOS.
 *
 * As declarações do bloco `nascidas` são cobradas dentro de cada medida P.
 * Isso fecha o buraco para as ops que HOJE criam entidade — e deixa um de
 * fora: uma rodada futura que apagasse as declarações teria cada medida P
 * passando, porque "nenhuma declaração" e "nenhuma entidade nova" combinam.
 * É a 2ª forma viciada ("aprova por ausência") esperando a próxima rodada.
 *
 * O piso é escrito à mão, fora da contagem: 8 = 1 nota criada + 1 nota
 * restaurada + 1 subtarefa + 4 relações (uma por natureza) + 1 relação
 * restaurada. Encolher esse número passa a exigir baixá-lo no diff.
 */
await medir("P-nascidas", async () => {
  const problemas = [];
  if (NASCIDAS_COM_CAMPOS_CONFERIDOS < PISO_DE_NASCIDAS_CONFERIDAS) {
    problemas.push(
      `só ${String(
        NASCIDAS_COM_CAMPOS_CONFERIDOS,
      )} entidade(s) nova(s) com os campos conferidos, piso ${String(PISO_DE_NASCIDAS_CONFERIDAS)}`,
    );
  }
  /*
   * [MÉDIO #2, rodada 19] E as RÉGUAS dos imprevisíveis, contadas fora delas.
   * Sem este número, trocar toda régua por uma frase deixaria as medidas P
   * verdes: "nenhum imprevisível reprovado" e "nenhum imprevisível julgado"
   * combinam — a 2ª forma viciada, de novo.
   */
  if (IMPREVISIVEIS_JULGADOS < PISO_DE_IMPREVISIVEIS_JULGADOS) {
    problemas.push(
      `só ${String(
        IMPREVISIVEIS_JULGADOS,
      )} campo(s) imprevisível(is) JULGADOS por uma régua, piso escrito à mão ${String(
        PISO_DE_IMPREVISIVEIS_JULGADOS,
      )} — motivo escrito nunca conferiu valor nenhum`,
    );
  }
  conferir(
    "P-nascidas · toda entidade que nasceu teve os CAMPOS conferidos, e todo imprevisível teve RÉGUA",
    problemas.length === 0,
    `${String(
      NASCIDAS_COM_CAMPOS_CONFERIDOS,
    )} entidade(s) nova(s) com todos os campos classificados (pedidos / daCasa / imprevisíveis) e conferidos, piso escrito à mão ${String(
      PISO_DE_NASCIDAS_CONFERIDAS,
    )} · ${String(
      IMPREVISIVEIS_JULGADOS,
    )} campo(s) imprevisível(is) julgados por uma função que olha o valor (piso ${String(
      PISO_DE_IMPREVISIVEIS_JULGADOS,
    )}) — contar a linha nunca foi olhar os campos dela, e escrever o motivo nunca foi conferir o valor${
      problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`
    }`,
  );
});

/*
 * ═════════════════════════════════════════════════════ MÉDIO #5, rodada 18 ═
 * O QUE ESTA GUARDA **NÃO** ALCANÇA — DITO POR ESCRITO, DENTRO DE UMA MEDIDA.
 *
 * O crítico leu o código e disse, com razão: tudo o que a família P prova é
 * sobre um `Map` em memória, servido por `next dev` em modo fixture. A
 * pergunta "chegou ao banco?" nunca é feita ao caminho que a produção usa
 * (`mutateLifeboard` → RPC `lifeboard_mutate`), porque `/api/tarefa/estado`
 * responde 404 em live por desenho e não há banco nesta sessão.
 *
 * Duas coisas se fazem, e nenhuma delas é fingir que o buraco não existe:
 *
 *  1. **o dublê passou a se comportar como o banco no campo que o banco mexe**
 *     — `updatedAt`, pelo gatilho `trg_tasks_touch` (migration 0001). Está em
 *     `tasks.fixture-store.ts`, e as declarações de alcance da família P
 *     passaram a trazer os DOIS campos. Antes a régua estava calibrada para o
 *     dublê e teria reprovado contra o banco;
 *  2. **o limite vira MEDIDA**, e não parágrafo de cabeçalho. Um limite escrito
 *     no topo do arquivo envelhece sem ninguém notar; um limite que é uma
 *     medida aparece em toda corrida, no relatório, e some do relatório se
 *     alguém o apagar. A medida também confere o que dá para conferir: que
 *     esta corrida é mesmo a corrida limitada que ela descreve.
 */
const NAO_ALCANCA = [
  "o caminho de escrita da PRODUÇÃO (`mutateLifeboard` → RPC `lifeboard_mutate`) não é exercido em nenhuma medida: em modo fixture toda escrita termina num `Map` no `globalThis` do processo do servidor",
  "as travas do banco (RLS por `owner`, `check` de coluna, gatilho anti-ciclo em SQL) não são exercidas: o que se mede é a régua equivalente reescrita em JavaScript no dublê, e as duas podem divergir sem que esta guarda veja",
  "o servidor é `next dev`, não o build de produção: diferenças de compilação, de cache de rota e de Server Action entre dev e build ficam fora",
  "o alcance de tempo é a vida das sentinelas (tempo real) mais dois adiantamentos de meia hora com relógio sob controle: mutação de contrato — e AÇÃO que só quebra — depois disso não é vista, e os dois alcances saem impressos em cada medida J, K e N, junto da ação que cada sentinela exerce no fim da vida",
  "a bateria das sentinelas alcança `input` e `textarea`; handler instalado em `<select>`, em `window` ou em `document`, e interação de arrastar, rolar ou tocar em tela sensível, não têm quem os acorde",
  "um só navegador (Chromium) e uma só janela (1280×1200): diferença de motor e de viewport fica fora",
  // [ALTO #1, rodada 20] a redução de custo da família N, dita por escrito.
  "as quinze ações envelhecidas (família N) são distribuídas uma rota por índice: cada op é exercida numa rota só, nos dois relógios. Uma quebra que dependa da ROTA — do tipo `if (rota === \"task-build\")` que o crítico da rodada 15 usou — só aparece na rota que o índice daquela op sorteou, e nas outras duas fica fora",
  "as quatro ações de relação da família N usam UMA natureza (a que tem desconto): que as quatro naturezas gravem certo é a classe que a família P percorre, e não se mede de novo em aba envelhecida",
  // [ALTO, rodada 21 → 22] o que a repetição (famílias N3 e N2) não alcança.
  "a repetição é de TRÊS vezes seguidas por op e aba — a 1ª (N), a 2ª com a frase da 1ª na tela (N3) e a 3ª depois que a frase saiu (N2): um defeito que só apareça na 4ª vez, ou depois de N vezes (um contador em vez de um sinalizador), fica fora",
  /*
   * [ALTO, rodada 22] O limite (10) da rodada 21 dizia "uma 2ª vez disparada
   * ENQUANTO a frase da 1ª ainda está na tela não é medida". Deixou de ser
   * verdade: é a família N3, com a frase provada no instante do disparo. O que
   * sobra dele é OUTRA janela, dita aqui com precisão.
   */
  "a 2ª vez disparada DURANTE a gravação da 1ª (com 'Salvando…' na tela, antes de o servidor responder) não é exercida pela família N3: nessa janela o contrato é outro — a porta RECUSA com 'Aguarde…' — e ele é medido no navegador só para status, mãe, meta e átomos (medidas D, H, I e M); nas outras onze ações essa recusa só tem a rede de unidade (`decidirEscrita` e a trava de voo)",
  "nas quatro ações de 'Desfazer' a 2ª vez NÃO PODE ser disparada com a frase da 1ª na tela (o gesto só nasce de uma escrita nova que reescreve aquela região — o motivo é medido em cada corrida); para elas a N3 prova a frase da escrita ANTERIOR envolvendo o botão clicado, e um defeito do tipo 'a frase da 1ª ainda está lá' não tem, nelas, como existir nem como ser medido",
  // [ALTO, rodada 23] o que a família R (a escrita que FALHA) não alcança.
  "a falha (família R) é exercida em DOIS modos — a rede cai (o POST morre sem chegar ao servidor) e o servidor recusa (o pedido chega com a op trocada e o próprio servidor devolve `{ erro }`); a resposta que chega pela METADE, a que demora mais que o teto de 30 s, a sessão que expira no meio e o servidor que GRAVA e depois responde erro ficam fora — este último é o pior, porque a tela diria 'não gravou' sobre um dado que está no banco",
  "a falha é exercida uma vez por op, na sentinela do relógio da guarda, com o relógio da página PAUSADO: a falha que só aparece quando a janela de 10 s do 'Desfazer' fecha no meio dela é medida só nos três 'Desfazer' que E2–E4 exercem em tempo real, e numa só rota por op (a que o índice sorteou); a mesma falha no relógio de verdade e nas outras duas rotas fica fora",
  // [ALTO, rodada 24] o que a família W (o operador agindo durante a espera) não alcança.
  "a família W mexe, durante a espera, só no campo PRINCIPAL de cada ação (o que o gesto marca `naEspera`: o texto da nota, o título da subtarefa, a nota da relação, a caixa da duração, um dos três grupos de átomos): mexer em OUTRO campo da mesma ação durante a espera — o autor da nota, a duração da subtarefa, o destino, a natureza e o desconto da relação — não é exercido, e um desfecho que sobrescreva só um desses campos fica fora; no SUCESSO, além disso, a régua de W olha só o campo mexido, porque os intactos o produto esvazia de propósito",
  "nas sete ações sem campo nem escolha (as duas exclusões, 'Limpar átomos' e os quatro 'Desfazer') a família W não exerce nada na espera; e mexer nos três grupos de átomos DURANTE a espera de 'Limpar átomos' ou do 'Desfazer' da limpeza — campos da ação vizinha 'Salvar átomos' — não é medido, embora o `aoSucesso` dessas duas portas reescreva os três grupos sem olhar a tela (a limpeza os zera, o desfazer põe o trio restaurado): o que o operador escolheu nessa espera pode sumir no sucesso sem aviso, e esta guarda não vê",
  "na família W o pedido fica PRESO pela guarda até o operador terminar de agir (ele volta ao campo 300 ms depois de o pedido sair): o que ele faz nos primeiros 300 ms, uma espera tão curta que o ato não caiba nela, e o ato que chega DEPOIS da resposta não são esta medida; e ela roda só na sentinela do relógio da guarda, numa rota por op (a que o índice sorteou)",
];

/** Piso escrito à mão: um limite declarado a menos é um limite escondido. */
const PISO_DE_LIMITES_DECLARADOS = 16;

/** Um limite tem de ser uma frase que se entende sozinha, não um rótulo. */
const TAMANHO_MINIMO_DO_LIMITE = 60;

await medir("Z", async () => {
  const problemas = [];
  if (NAO_ALCANCA.length < PISO_DE_LIMITES_DECLARADOS) {
    problemas.push(
      `só ${String(NAO_ALCANCA.length)} limite(s) declarado(s), piso escrito à mão ${String(
        PISO_DE_LIMITES_DECLARADOS,
      )}`,
    );
  }
  const curtos = NAO_ALCANCA.filter((t) => t.trim().length < TAMANHO_MINIMO_DO_LIMITE);
  if (curtos.length > 0) {
    problemas.push(`${String(curtos.length)} limite(s) sem frase que se entenda sozinha`);
  }
  /*
   * E a corrida é MESMO a corrida limitada que o texto descreve? Duas provas
   * mecânicas, para o texto não virar folclore:
   *  - `/api/tarefa/estado` responde: essa rota só existe em modo fixture (ela
   *    devolve 404 em live, por desenho). Responder é a prova de que a família
   *    P mediu o dublê, e não o banco;
   *  - o servidor foi subido por esta guarda (`next dev`), e não por fora.
   */
  let rotaDoFixture = "(não respondeu)";
  try {
    const r = await comTeto(
      fetch(`${BASE}/api/tarefa/estado`, { signal: globalThis.AbortSignal.timeout(20000) }),
      25000,
      "a prova de modo fixture",
    );
    rotaDoFixture = `HTTP ${String(r.status)}`;
    if (!r.ok) {
      problemas.push(
        `/api/tarefa/estado respondeu ${String(
          r.status,
        )} — sem ela a família P não mediu coisa nenhuma, e o limite declarado não corresponde a esta corrida`,
      );
    }
  } catch (erro) {
    problemas.push(
      `não consegui provar que esta corrida é a corrida limitada: ${
        erro instanceof Error ? erro.message.split("\n")[0] : String(erro)
      }`,
    );
  }
  if (!SERVIDOR_PROPRIO) {
    problemas.push(
      "esta corrida recebeu LIFEBOARD_URL: o servidor não foi subido por esta guarda, então nem o modo nem o comando dele estão sob o que este texto afirma",
    );
  }
  conferir(
    "Z · o que esta guarda NÃO alcança, dito por escrito e conferido contra ESTA corrida",
    problemas.length === 0,
    `${String(NAO_ALCANCA.length)} limite(s) declarado(s) (piso ${String(
      PISO_DE_LIMITES_DECLARADOS,
    )}) · servidor subido por esta guarda=${String(
      SERVIDOR_PROPRIO,
    )} (\`next dev\`, LIFEBOARD_DATA_MODE=fixture) · /api/tarefa/estado=${rotaDoFixture} · ${NAO_ALCANCA.map(
      (t, i) => `(${String(i + 1)}) ${t}`,
    ).join(" · ")}${problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`}`,
  );
});

await navegador.close();
encerrarServidor();

console.log("%s", medidas.join("\n"));
if (falhas.length > 0) {
  console.error("%s", `\n${String(falhas.length)} medida(s) fora da régua: ${falhas.join(" | ")}`);
  if (naoMedidas.length > 0) {
    console.error("%s", `e ${String(naoMedidas.length)} NÃO medida(s): ${naoMedidas.join(" | ")}`);
  }
  process.exit(1);
}
if (naoMedidas.length > 0) {
  console.error(
    "%s",
    `\n${String(naoMedidas.length)} medida(s) que a guarda NÃO conseguiu medir (código 2 — não é verde, e não é defeito provado): ${naoMedidas.join(" | ")}`,
  );
  process.exit(2);
}
/*
 * A LISTA NOMINAL, escrita à mão — e não `medidas.length !== 19`.
 *
 * A contagem sozinha é a primeira das quatro formas viciadas desta base ("a
 * guarda conta a si mesma"): apagar a medida C e acrescentar outra qualquer
 * mantinha o número e o verde. Aqui cada medida é exigida pelo NOME, e o nome
 * é escrito aqui, fora do lugar onde as medidas se registram. Somem duas
 * coisas no mesmo diff: o `conferir(...)` da medida E este nome.
 *
 * O prefixo `V-` é o veredito do vigia daquela medida (registro vazio); `J` é
 * a sentinela.
 */
const MEDIDAS_EXIGIDAS = [
  "A · ",
  "B · ",
  "C · ",
  "C2 · ",
  "D · ",
  "E · ",
  // [ALTO #1, rodada 15] o desfazer que FALHA, nos três painéis — a medida E
  // só provava o que dá certo.
  "E2 · ",
  "E3 · ",
  "E4 · ",
  "F · ",
  "G · ",
  "G2 · ",
  "H · ",
  "I · ",
  "M · ",
  // [CRÍTICO #1, rodada 15] uma sentinela por ROTA, nominal: acrescentar rota
  // ao trabalho da guarda passa a exigir acrescentar linha aqui.
  "J · /tarefa/task-docs",
  "J · /tarefa/task-build",
  "J · /tarefa/task-setup",
  "K · /tarefa/task-docs",
  "K · /tarefa/task-build",
  "K · /tarefa/task-setup",
  // [ALTO #1, rodada 19] o piso das escritas que as sentinelas EXERCERAM.
  "J-escrita · ",
  "L · ",
  // [MÉDIO #4, rodada 18] a disciplina de precondição, estendida a A–M.
  "Q0 · ",
  "V-AB · ",
  "V-C · ",
  "V-D · ",
  "V-E · ",
  "V-E2 · ",
  "V-E3 · ",
  "V-E4 · ",
  "V-F · ",
  "V-G · ",
  "V-H · ",
  "V-I · ",
  "V-M · ",
  /*
   * [ALTOS #1 e #3, rodada 16] A persistência. O nome de cada medida P é
   * DERIVADO da lista canônica de `src/app/tarefa/pedido.ts` — é o único jeito
   * de uma operação nova não nascer sem régua. P0 guarda a derivação: ele
   * reprova se a tabela e a lista canônica discordarem, ou se o número de
   * conferências cair abaixo do piso.
   */
  "P0 · ",
  // [ALTO #1, rodada 17] o reinício que semeia a loja antes da família P.
  "P-loja · ",
  // [ALTO #2, rodada 18] o piso das entidades novas com campos conferidos.
  "P-nascidas · ",
  // [MÉDIO #5, rodada 18] o limite desta guarda, declarado como medida.
  "Z · ",
  ...[...OPS_POR_ROTA.values()].flat().map((op) => `P · ${op} · `),
  /*
   * [ALTO #1, rodada 20] OS EXERCÍCIOS ENVELHECIDOS, um por op × relógio — e
   * o nome de cada um DERIVADO da mesma distribuição que os roda, não de um
   * registro que a própria corrida preencheu. Apagar um exercício some do
   * relatório, e é aqui que a ausência é cobrada pelo nome.
   */
  ...ROTAS_COM_SENTINELA.flatMap((rota, i) =>
    fatiaDaRota(i).flatMap((op) => [
      `N · ${op} · ${rota} · relógio de verdade`,
      `N · ${op} · ${rota} · relógio da guarda`,
    ]),
  ),
  "N0 · ",
  /*
   * [ALTO, rodada 21] AS REPETIÇÕES, uma por op × relógio, com o nome derivado
   * da mesma distribuição e da mesma tabela de repetição — não do que a
   * corrida registrou. Op declarada `fora` não é exigida aqui, e N2-0 cobra o
   * motivo dela e o piso.
   */
  ...ROTAS_COM_SENTINELA.flatMap((rota, i) =>
    fatiaDaRota(i)
      .filter((op) => REPETICAO_POR_OP[op]?.modo !== "fora")
      .flatMap((op) => [
        `N2 · ${op} · ${rota} · relógio de verdade`,
        `N2 · ${op} · ${rota} · relógio da guarda`,
      ]),
  ),
  "N2-0 · ",
  /*
   * [ALTO, rodada 22] AS 2ªS VEZES COM A FRASE DA ANTERIOR NA TELA, uma por op
   * × relógio, com o nome derivado da mesma distribuição e da mesma tabela.
   */
  ...ROTAS_COM_SENTINELA.flatMap((rota, i) =>
    fatiaDaRota(i)
      .filter(
        (op) => REPETICAO_POR_OP[op]?.modo !== "fora" && COM_FRASE_POR_OP[op]?.frase !== "fora",
      )
      .flatMap((op) => [
        `N3 · ${op} · ${rota} · relógio de verdade`,
        `N3 · ${op} · ${rota} · relógio da guarda`,
      ]),
  ),
  "N3-0 · ",
  /*
   * [ALTO, rodada 23] A FALHA COMO CLASSE — uma medida R por op, na sentinela
   * do relógio da guarda, com o nome derivado da mesma distribuição. R0 é o
   * fecho e o piso.
   */
  ...ROTAS_COM_SENTINELA.flatMap((rota, i) =>
    fatiaDaRota(i).map((op) => `R · ${op} · ${rota} · relógio da guarda`),
  ),
  "R0 · ",
  /*
   * [ALTO, rodada 24] O OPERADOR AGINDO DURANTE A ESPERA — uma medida W por op
   * com campo ou escolha, com o nome derivado da mesma distribuição e da regra
   * de tela de cada op. W0 é o fecho e o piso.
   */
  ...ROTAS_COM_SENTINELA.flatMap((rota, i) =>
    fatiaDaRota(i)
      .filter((op) => OPS_COM_ESPERA.includes(op))
      .map((op) => `W · ${op} · ${rota} · relógio da guarda`),
  ),
  "W0 · ",
];
const ausentes = MEDIDAS_EXIGIDAS.filter(
  (nome) => !medidas.some((m) => m.slice(6).startsWith(nome)),
);
if (ausentes.length > 0) {
  console.error(
    "%s",
    `\nmedida(s) exigida(s) que não se registraram: ${ausentes.join(
      ", ",
    )} — checagem que não rodou é checagem que não mediu`,
  );
  process.exit(1);
}
if (medidas.length !== MEDIDAS_EXIGIDAS.length) {
  console.error(
    "%s",
    `\nmedidas registradas: ${String(medidas.length)} — esperadas ${String(
      MEDIDAS_EXIGIDAS.length,
    )}`,
  );
  process.exit(1);
}
console.log("%s", `\n${String(medidas.length)} medidas no Chromium, todas dentro da régua.`);
