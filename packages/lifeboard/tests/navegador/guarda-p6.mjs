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
 * | J | as SENTINELAS de tempo real, uma POR ROTA: nada mexeu no contrato em toda a vida da guarda | canário conferido; 0 mudança fora da régua; vida ≥ 30 s; 7 campos EXERCIDOS |
 * | K | as SENTINELAS DO RELÓGIO, uma POR ROTA: meia hora adiantada, os campos exercidos, meia hora de novo | canário conferido; 0 mudança fora da régua; ≥ 7 campos no DOM e exercidos; 0 `type=number` |
 * | L | o alcance cobre TODAS as rotas, estados e CAMPOS EXERCIDOS que a guarda visita | 0 rota sem sentinela; sentinela ≥ o estado medido; os três números ≥ o piso escrito à mão (7) |
 * | P0 | o universo das escritas sai da lista canônica da página (`pedido.ts`) | 15 op(s); toda op com conferência ou dispensa com motivo; ≥ 15 conferidas |
 * | P·op | uma por operação de escrita: **o que o operador pediu está lá depois do F5** | pedido ≠ estado de antes, e o valor depois do F5 === o valor PEDIDO |
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
import { readFileSync } from "node:fs";
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
async function subirServidorProprio() {
  const req = createRequire(import.meta.url);
  let binarioDoNext;
  try {
    binarioDoNext = join(dirname(req.resolve("next/package.json")), "dist", "bin", "next");
  } catch {
    return null;
  }
  const porta = await portaLivre();
  const base = `http://127.0.0.1:${String(porta)}`;
  const filho = spawn(process.execPath, [binarioDoNext, "dev", "-p", String(porta)], {
    cwd: RAIZ_DO_PACOTE,
    env: { ...process.env, LIFEBOARD_DATA_MODE: "fixture" },
    stdio: "ignore",
  });
  const encerrar = () => {
    try {
      filho.kill("SIGTERM");
    } catch {
      // já morreu
    }
  };
  process.on("exit", encerrar);
  if (!(await esperarResponder(base, 180000))) {
    encerrar();
    return null;
  }
  return { base, encerrar };
}

let encerrarServidor = () => {};
let BASE = process.env.LIFEBOARD_URL ?? null;
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

function conferir(nome, ok, detalhe) {
  medidas.push(`${ok ? "ok   " : "FALHA"} ${nome} — ${detalhe}`);
  if (!ok) falhas.push(nome);
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
  try {
    await fn();
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message.split("\n")[0] : String(erro);
    conferir(`${nome} · (a medida não chegou ao fim)`, false, `a medida ESTOUROU: ${msg}`);
  }
}

const navegador = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});

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

/** Um contexto novo por medida: nada de rascunho de uma vazar na outra. */
async function abrir(rota, largura = 1280, altura = 1200, comRelogioDeMentira = false) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura } });
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
  const pagina = await contexto.newPage();
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
 * O que fica FORA, dito por extenso e sem maquiagem: um temporizador armado por
 * um evento que esta bateria não dispara (arrastar, colar, rolar, tocar), ou
 * pelo clique num botão que a sentinela não pode apertar sem gravar no
 * servidor. É o limite declarado desta família — e as duas redes de fonte
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

/** Dois quadros: o que uma `ref` faz no nó acontece depois do commit do React. */
async function assentar(pagina) {
  await pagina.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
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
 * faz**: arrastar, colar com o mouse, rolar, tocar em tela sensível, e o clique
 * em BOTÃO — este último de propósito, porque apertar um botão da página é
 * gravar no servidor, e a sentinela existe para observar, não para escrever. A
 * lista exata dos eventos exercidos é `EVENTOS_EXERCIDOS`, e o número de campos
 * exercidos sai impresso em cada medida J, K e L: hoje, 7 campos × 18 eventos
 * por rota.
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
const ROTAS_COM_SENTINELA = ["/tarefa/task-docs", "/tarefa/task-build", "/tarefa/task-setup"];

const SENTINELAS = [];
for (const rota of ROTAS_COM_SENTINELA) {
  for (const comRelogioDeMentira of [false, true]) {
    const aberta = await abrir(rota, 1280, 1200, comRelogioDeMentira);
    const revelados = await revelarEstadosOcultos(aberta.pagina);
    // [ALTO #2, rodada 16] revelar não basta: a sentinela EXERCE cada campo.
    const exercidos = await exercitarCampos(aberta.pagina);
    SENTINELAS.push({
      ...aberta,
      comRelogioDeMentira,
      revelados,
      exercidos,
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
await medir("C", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-docs");
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
    achou && antes === "2" && naCaixa === "2e" && recusouEmPortugues && depoisDoF5 === "2",
    achou
      ? `valor inicial=${JSON.stringify(antes)} (esperado "2") · na caixa (DOM .value)=${JSON.stringify(
          naCaixa,
        )} (esperado "2e") · mensagens=${JSON.stringify(recusa)} · depois do F5=${JSON.stringify(
          depoisDoF5,
        )} (esperado "2")`
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
    // A resposta atrasada chega aqui.
    await pagina.waitForTimeout(6000);
    anuncioFinal = await pagina.evaluate(() =>
      [...document.querySelectorAll('[role="status"]')]
        .map((el) => (el.innerText || "").trim())
        .filter((t) => t.startsWith("Status atualizado"))
        .join(" | "),
    );
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
await medir("E", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-build");
  const scoreDe = async () =>
    await pagina.evaluate(
      () => document.body.innerText.match(/assimetria \(A\) = \d+/)?.[0] ?? "(sem score)",
    );
  const antes = await scoreDe();
  const limpar = pagina.getByRole("button", { name: "Limpar átomos" });
  const temBotao = (await limpar.count()) === 1;
  let desfazerApareceu = false;
  let depois = "";
  let restaurado = "";
  let aposF5 = "";
  if (temBotao) {
    await limpar.click();
    const desfazer = pagina.getByRole("button", { name: "Desfazer" });
    desfazerApareceu = await desfazer
      .first()
      .waitFor({ timeout: 8000 })
      .then(() => true)
      .catch(() => false);
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
      await pagina.waitForTimeout(2500);
      restaurado = await scoreDe();
      await pagina.reload({ waitUntil: "networkidle" });
      await pagina.waitForSelector("h1");
      aposF5 = await scoreDe();
    }
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
      ? `antes=${JSON.stringify(antes)} · depois do clique=${JSON.stringify(
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

/** O molde das três medidas do ALTO #1. */
async function medirDesfazerQueFalha(config) {
  const { rotulo, frase, rota, vigia, iniciar, lerEstado } = config;
  const { contexto, pagina, registroFora } = await abrir(rota);
  const antes = await lerEstado(pagina);
  const comecou = await iniciar(pagina);
  const desfazer = pagina.getByRole("button", { name: "Desfazer" });
  const apareceu =
    comecou &&
    (await desfazer
      .first()
      .waitFor({ timeout: 12000 })
      .then(() => true)
      .catch(() => false));
  const nascimento = Date.now();
  const depoisDaExclusao = apareceu ? await esperarMudanca(pagina, lerEstado, antes) : antes;

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
    await pagina.waitForTimeout(5000);
  }
  const mensagens = apareceu ? await lerRegioesVivas(pagina) : "";
  const botoesDepois = await desfazer.count();

  // Tirada a sabotagem, o MESMO botão tem de desfazer de verdade.
  await pagina.unroute(padrao);
  let restaurado = "(não tentou: não havia botão)";
  if (botoesDepois >= 1) {
    await desfazer.first().click();
    restaurado = await esperarMudanca(pagina, lerEstado, depoisDaExclusao);
  }

  const disseQueFalhou = /Não foi possível desfazer/.test(mensagens);
  conferir(
    `${rotulo} · ${frase}`,
    comecou &&
      apareceu &&
      postsAbortados >= 1 &&
      antes !== depoisDaExclusao &&
      disseQueFalhou &&
      botoesDepois >= 1 &&
      restaurado === antes,
    comecou
      ? `antes=${JSON.stringify(antes)} · depois de excluir=${JSON.stringify(
          depoisDaExclusao,
        )} · botão Desfazer apareceu=${String(apareceu)} · clique aos ${String(
          clicouAos,
        )}ms da janela de 10000ms · POSTs abortados=${String(
          postsAbortados,
        )} · mensagens=${JSON.stringify(mensagens)} · botões Desfazer DEPOIS da falha=${String(
          botoesDepois,
        )} (esperado ≥ 1) · depois de tentar de novo sem sabotagem=${JSON.stringify(
          restaurado,
        )} (esperado ${JSON.stringify(antes)})`
      : "não foi possível começar a exclusão nesta tarefa — alvo ausente é reprovação, não dispensa",
  );
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
    await pagina.waitForTimeout(6000);
    anuncio = await pagina.evaluate(() =>
      [...document.querySelectorAll('[role="status"]')]
        .map((el) => (el.innerText || "").trim())
        .filter((t) => /Tarefa mãe/.test(t))
        .join(" | "),
    );
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
    await pagina.waitForTimeout(6000);
    anuncio = await pagina.evaluate(() =>
      [...document.querySelectorAll('[role="status"]')]
        .map((el) => (el.innerText || "").trim())
        .filter((t) => /meta/i.test(t))
        .join(" | "),
    );
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
await medir("G", async () => {
  const { contexto, pagina, registroFora } = await abrir("/tarefa/task-build");
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
    // A resposta atrasada chega aqui.
    await pagina.waitForTimeout(7000);
    anuncio = await lerRegioesVivas(pagina);
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
    if (vida < PISO_DE_VIDA_DA_SENTINELA) {
      problemas.push(
        `a sentinela viveu ${String(Math.round(vida / 1000))}s, menos que o piso declarado de ${String(
          Math.round(PISO_DE_VIDA_DA_SENTINELA / 1000),
        )}s — o alcance encolheu`,
      );
    }
    conferir(
      `J · ${sentinela.rota} — a sentinela de tempo real: nada mexeu no contrato em toda a vida da guarda`,
      problemas.length === 0,
      `viveu ${String(
        Math.round(vida / 1000),
      )}s — este é o ALCANCE DE TEMPO desta guarda NESTA ROTA, e mutação agendada para depois dele NÃO é vista (piso: ${String(
        Math.round(PISO_DE_VIDA_DA_SENTINELA / 1000),
      )}s) · estados revelados: ${sentinela.revelados.join(", ") || "(nenhum)"} · ${String(
        sentinela.exercidos,
      )} campo(s) EXERCIDOS (foco + ${String(EVENTOS_EXERCIDOS.length)} eventos) · ${resumoDoRelato(
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
    conferir(
      `K · ${sentinela.rota} — relógio adiantado meia hora: nenhum temporizador mexeu no contrato`,
      problemas.length === 0,
      `relógio adiantado ${String(
        Math.round(ADIANTAMENTO_DO_RELOGIO / 60000),
      )} min de uma vez, DUAS vezes, com os campos exercidos entre elas — atraso ATÉ ISSO está no alcance desta guarda NESTA ROTA · estados revelados: ${
        sentinela.revelados.join(", ") || "(nenhum)"
      } · ${String(contrato.length)} campos no DOM depois do adiantamento · ${String(
        exercidosDepois,
      )} exercidos depois dele · ${resumoDoRelato(
        relato,
      )}${problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`}`,
    );
  });
}

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
  conferir(
    "L · o alcance de tempo cobre TODAS as rotas, estados e campos EXERCIDOS que a guarda visita",
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
      .join(" ")}${problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`}`,
  );
});

for (const sentinela of SENTINELAS) await sentinela.contexto.close();

// ════════════════════════════════════════════════════════════════════════════
// P · A PERSISTÊNCIA, DERIVADA DA LISTA CANÔNICA DAS OPERAÇÕES
//
// [ALTOS #1 e #3, rodada 16] A GUARDA NUNCA PERGUNTAVA SE O QUE O OPERADOR
// PEDIU CHEGOU AO BANCO.
//
// Das 15 escritas desta página, a guarda conferia PERSISTÊNCIA em três lugares
// (três `reload()` no arquivo inteiro). Em todo o resto, o anúncio de sucesso e
// o estado do controle eram lidos DO CLIENTE — que é exatamente quem a
// sabotagem controla. Duas provas do crítico, as duas com os cinco portões
// verdes e as 34 medidas verdes:
//
//   1. dois campos trocados de lugar em `atomos-form.tsx`
//      (`esforco: String(custo)`), o erro de digitação mais comum que existe.
//      NA TELA {"Esforço":"1","Custo":"5"} + "Átomos salvos."; DEPOIS DO F5
//      {"Esforço":"5","Custo":"1"}. A única medida que tocava em "Salvar
//      átomos" (M) perguntava ao score `/assimetria \(A\) = \d+/` — um regex
//      que só quer saber se EXISTE score, nunca se é o score do que foi pedido;
//   2. `status-form.tsx` mandando `confirmadoRef.current` em vez de `novo`: a
//      tela dizia "Status atualizado para concluída." com a opção marcada, e
//      depois do F5 a tarefa voltava a "aberta" — e seguia entrando no caminho
//      crítico e na fila.
//
// A régua que substitui NÃO é uma medida a mais escrita à mão. O universo sai
// da LISTA CANÔNICA da página (`OPERACOES_DE_ESCRITA`, em
// `src/app/tarefa/pedido.ts`, lida do fonte): toda `op` que existe lá tem de
// ter, aqui, ou uma conferência de persistência ou uma DISPENSA com motivo
// escrito. Operação nova no `pedido.ts` sem linha nesta tabela reprova a
// medida P0 — e conferir zero nunca é sucesso: há um piso escrito à mão.
//
// A forma da conferência, onde o valor pedido é visível na tela: **pedir um
// valor DIFERENTE do atual, recarregar a página, e exigir o valor PEDIDO** —
// nunca "algum valor". É o que separa esta régua do regex que passou.
// ════════════════════════════════════════════════════════════════════════════

/** A lista canônica das escritas da página, lida do fonte — não uma cópia. */
function opsDaPagina() {
  const caminho = join(RAIZ_DO_PACOTE, "src", "app", "tarefa", "pedido.ts");
  const src = readFileSync(caminho, "utf8");
  const bloco = /OPERACOES_DE_ESCRITA[^=]*=\s*\[([\s\S]*?)\];/.exec(src);
  if (bloco === null) return [];
  return [...(bloco[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

const OPS_DA_PAGINA = opsDaPagina();

/** O piso de operações conferidas — escrito à mão. Zero nunca é sucesso. */
const PISO_DE_OPS_CONFERIDAS = 15;

const ROTA_DOCS = "/tarefa/task-docs";
const ROTA_BUILD = "/tarefa/task-build";

/** Marcadores desta corrida — nenhum fixture os tem, e eles atravessam o F5. */
const MARCAS = {};
function marcador(prefixo) {
  return `${prefixo}-${Math.random().toString(36).slice(2, 10)}`;
}

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

/** Cria uma relação com a NOTA como marcador, e devolve o anúncio. */
async function criarRelacaoMarcada(pagina, marca) {
  await escolherNoGrupo(pagina, "Tipo de relação", "correlação");
  await pagina.waitForTimeout(250);
  const destino = pagina.getByLabel("Destino").first();
  const valores = await destino.evaluate((el) =>
    [...el.options].map((o) => o.value).filter((v) => v !== ""),
  );
  if (valores.length === 0) return "(não há destino disponível para relação nova)";
  await destino.selectOption(valores[0]);
  await campoPorNome(pagina, /^Nota da relação/)
    .first()
    .fill(marca);
  await pagina.getByRole("button", { name: "Adicionar relação" }).click();
  return await anunciou(pagina, /Relação criada\./);
}

/**
 * Espera a lista REFLETIR o que acabou de acontecer, e devolve o texto dela.
 *
 * Sem isto a medida lia o quadro anterior: a exclusão acontece no servidor, e
 * a lista só muda quando o `router.refresh()` da porta volta — medido nesta
 * rodada, a primeira versão destas duas medidas dizia "o pedido é IGUAL ao
 * estado de antes" sobre uma exclusão que tinha acontecido. É a mesma
 * armadilha que a medida E fechou com um `waitForFunction`.
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

/**
 * A TABELA. Cada `op` da lista canônica aparece aqui, com uma conferência de
 * persistência ou uma dispensa com motivo escrito — nunca com nada.
 */
const PERSISTENCIA_POR_OP = {
  nota_criar: {
    rota: ROTA_BUILD,
    conferir: async (pagina) => {
      const marca = marcador("nota");
      MARCAS.nota = marca;
      const antes = presencaDe(await textoDasListas(pagina), marca);
      await campoPorNome(pagina, /^Nova nota$/)
        .first()
        .fill(marca);
      await pagina.getByRole("button", { name: "Salvar nota" }).click();
      const anuncio = await anunciou(pagina, /Nota salva\./);
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${marca}" está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        extra: `anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  nota_excluir: {
    rota: ROTA_BUILD,
    conferir: async (pagina) => {
      const marca = MARCAS.nota ?? "(a nota_criar não deixou marcador)";
      const antes = presencaDe(await textoDasListas(pagina), marca);
      const achou = await excluirItemComMarca(pagina, marca);
      const anuncio = achou ? await anunciou(pagina, /Excluída\./) : "(não achei a nota)";
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${marca}" NÃO está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        extra: `achei a nota para excluir=${String(achou)} · anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  nota_desfazer: {
    rota: ROTA_BUILD,
    conferir: async (pagina) => {
      const marca = marcador("nota-desfazer");
      await campoPorNome(pagina, /^Nova nota$/)
        .first()
        .fill(marca);
      await pagina.getByRole("button", { name: "Salvar nota" }).click();
      await anunciou(pagina, /Nota salva\./);
      await recarregar(pagina);
      const achou = await excluirItemComMarca(pagina, marca);
      await anunciou(pagina, /Excluída\./);
      // O estado DEPOIS da exclusão é o "atual" contra o qual o desfazer pede
      // outra coisa — sem isto a medida pediria o que já estava lá.
      const antes = presencaDe(await esperarPresenca(pagina, marca, false), marca);
      await pagina.getByRole("button", { name: "Desfazer" }).first().click();
      const anuncio = await anunciou(pagina, /Nota restaurada\./);
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${marca}" está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        extra: `achei a nota para excluir=${String(achou)} · anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  subtarefa_criar: {
    rota: ROTA_BUILD,
    conferir: async (pagina) => {
      const marca = marcador("sub");
      const antes = presencaDe(await textoDasListas(pagina), marca);
      await campoPorNome(pagina, /^Título da subtarefa$/)
        .first()
        .fill(marca);
      await pagina.getByRole("button", { name: "Adicionar subtarefa" }).click();
      const anuncio = await anunciou(pagina, /Subtarefa criada\./);
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${marca}" está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        extra: `anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  relacao_criar: {
    rota: ROTA_BUILD,
    conferir: async (pagina) => {
      const marca = marcador("rel");
      MARCAS.relacao = marca;
      const antes = presencaDe(await textoDasListas(pagina), marca);
      const anuncio = await criarRelacaoMarcada(pagina, marca);
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${marca}" está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        extra: `anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  relacao_excluir: {
    rota: ROTA_BUILD,
    conferir: async (pagina) => {
      const marca = MARCAS.relacao ?? "(a relacao_criar não deixou marcador)";
      const antes = presencaDe(await textoDasListas(pagina), marca);
      const achou = await excluirItemComMarca(pagina, marca);
      const anuncio = achou ? await anunciou(pagina, /Excluída\./) : "(não achei a relação)";
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${marca}" NÃO está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        extra: `achei a relação para excluir=${String(achou)} · anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  relacao_desfazer_criacao: {
    rota: ROTA_BUILD,
    conferir: async (pagina) => {
      const marca = marcador("rel-criada");
      await criarRelacaoMarcada(pagina, marca);
      const antes = presencaDe(await esperarPresenca(pagina, marca, true), marca);
      await pagina.getByRole("button", { name: "Desfazer" }).first().click();
      const anuncio = await anunciou(pagina, /Relação desfeita\./);
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${marca}" NÃO está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        extra: `anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  relacao_desfazer_exclusao: {
    rota: ROTA_BUILD,
    conferir: async (pagina) => {
      const marca = marcador("rel-excluida");
      await criarRelacaoMarcada(pagina, marca);
      // O F5 fecha a janela de desfazer da CRIAÇÃO: o único "Desfazer" que
      // sobra depois é o da exclusão, que é o que esta medida quer medir.
      await recarregar(pagina);
      const achou = await excluirItemComMarca(pagina, marca);
      await anunciou(pagina, /Excluída\./);
      const antes = presencaDe(await esperarPresenca(pagina, marca, false), marca);
      await pagina.getByRole("button", { name: "Desfazer" }).first().click();
      const anuncio = await anunciou(pagina, /Relação restaurada\./);
      await recarregar(pagina);
      return {
        antes,
        pedido: `"${marca}" está na lista`,
        obtido: presencaDe(await textoDasListas(pagina), marca),
        extra: `achei a relação para excluir=${String(achou)} · anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  status: {
    rota: ROTA_DOCS,
    conferir: async (pagina) => {
      const antes = await marcadoNoGrupo(pagina, "Status da tarefa");
      const opcoes = await opcoesDoGrupo(pagina, "Status da tarefa");
      const pedido = opcoes.find((o) => o !== antes) ?? "(nenhuma opção diferente na tela)";
      await escolherNoGrupo(pagina, "Status da tarefa", pedido);
      const anuncio = await anunciou(pagina, /Status atualizado para/);
      const naTela = await marcadoNoGrupo(pagina, "Status da tarefa");
      await recarregar(pagina);
      return {
        antes,
        pedido,
        obtido: await marcadoNoGrupo(pagina, "Status da tarefa"),
        extra: `anúncio=${JSON.stringify(anuncio)} · na tela ANTES do F5=${JSON.stringify(naTela)}`,
      };
    },
  },
  mae: {
    rota: ROTA_DOCS,
    conferir: async (pagina) => {
      const select = pagina.locator('select[aria-label="Tarefa mãe"]').first();
      const antes = await select.inputValue();
      const valores = await select.evaluate((el) => [...el.options].map((o) => o.value));
      const pedido = valores.find((v) => v !== antes) ?? "(nenhuma opção diferente)";
      await select.selectOption(pedido);
      const anuncio = await anunciou(pagina, /Tarefa mãe (atualizada|removida)\./);
      await recarregar(pagina);
      return {
        antes: antes === "" ? "(nenhuma)" : antes,
        pedido: pedido === "" ? "(nenhuma)" : pedido,
        obtido: await select
          .inputValue()
          .then((v) => (v === "" ? "(nenhuma)" : v))
          .catch(() => "(o <select> sumiu)"),
        extra: `anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  meta: {
    rota: ROTA_DOCS,
    conferir: async (pagina) => {
      const botao = pagina.locator("button[aria-pressed]").first();
      const antes = await botao.getAttribute("aria-pressed");
      await botao.click();
      const anuncio = await anunciou(pagina, /(Marcada como meta|Meta removida)\./);
      await recarregar(pagina);
      return {
        antes: `aria-pressed=${String(antes)}`,
        pedido: `aria-pressed=${antes === "true" ? "false" : "true"}`,
        obtido: `aria-pressed=${String(
          await pagina.locator("button[aria-pressed]").first().getAttribute("aria-pressed"),
        )}`,
        extra: `anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  duracao: {
    rota: ROTA_DOCS,
    conferir: async (pagina) => {
      const campo = campoPorNome(pagina, /^Duração \(dias, p80/).first();
      const antes = await campo.inputValue();
      const atual = Number(antes);
      const pedido = String(Number.isFinite(atual) && antes.trim() !== "" ? atual + 1 : 4);
      await campo.fill(pedido);
      await pagina.getByRole("button", { name: "Salvar duração" }).click();
      const anuncio = await anunciou(pagina, /Duração (salva|removida)\./);
      await recarregar(pagina);
      return {
        antes,
        pedido,
        obtido: await campoPorNome(pagina, /^Duração \(dias, p80/)
          .first()
          .inputValue(),
        extra: `anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  atomos_salvar: {
    rota: ROTA_BUILD,
    conferir: async (pagina) => {
      const antes = await trioNaTela(pagina);
      /*
       * O pedido escolhe Esforço e Custo DIFERENTES ENTRE SI, de propósito:
       * com os dois iguais, trocar um campo pelo outro no despacho
       * (`esforco: String(custo)`) seria invisível — é a sabotagem do ALTO #1.
       */
      const opcoesO = await opcoesDoGrupo(pagina, "Opcionalidade");
      const opcoesE = await opcoesDoGrupo(pagina, "Esforço");
      const opcoesC = await opcoesDoGrupo(pagina, "Custo");
      const atualO = await marcadoNoGrupo(pagina, "Opcionalidade");
      const atualE = await marcadoNoGrupo(pagina, "Esforço");
      const atualC = await marcadoNoGrupo(pagina, "Custo");
      const pedidoO = opcoesO.find((o) => o !== atualO) ?? "(sem opção diferente)";
      const pedidoE = opcoesE.find((o) => o !== atualE) ?? "(sem opção diferente)";
      const pedidoC =
        opcoesC.find((o) => o !== atualC && o !== pedidoE) ?? "(sem opção diferente)";
      await escolherNoGrupo(pagina, "Opcionalidade", pedidoO);
      await escolherNoGrupo(pagina, "Esforço", pedidoE);
      await escolherNoGrupo(pagina, "Custo", pedidoC);
      await pagina.getByRole("button", { name: "Salvar átomos" }).click();
      const anuncio = await anunciou(pagina, /Átomos salvos\./);
      const naTela = await trioNaTela(pagina);
      await recarregar(pagina);
      MARCAS.trio = `Opcionalidade=${pedidoO} · Esforço=${pedidoE} · Custo=${pedidoC}`;
      return {
        antes,
        pedido: MARCAS.trio,
        obtido: await trioNaTela(pagina),
        extra: `anúncio=${JSON.stringify(anuncio)} · na tela ANTES do F5=${JSON.stringify(naTela)}`,
      };
    },
  },
  atomos_limpar: {
    rota: ROTA_BUILD,
    conferir: async (pagina) => {
      const antes = await trioNaTela(pagina);
      const limpar = pagina.getByRole("button", { name: "Limpar átomos" });
      const tem = (await limpar.count()) === 1;
      if (tem) await limpar.click();
      const anuncio = tem
        ? await anunciou(pagina, /Átomos limpos\./)
        : '(o botão "Limpar átomos" não existe nesta tarefa)';
      await recarregar(pagina);
      return {
        antes,
        pedido: "Opcionalidade=(nenhum) · Esforço=(nenhum) · Custo=(nenhum)",
        obtido: await trioNaTela(pagina),
        extra: `anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
  atomos_desfazer_limpeza: {
    rota: ROTA_BUILD,
    conferir: async (pagina) => {
      // Precondição própria: declarar um trio, para haver o que limpar.
      const opcoesE = await opcoesDoGrupo(pagina, "Esforço");
      const opcoesC = await opcoesDoGrupo(pagina, "Custo");
      const opcoesO = await opcoesDoGrupo(pagina, "Opcionalidade");
      await escolherNoGrupo(pagina, "Opcionalidade", opcoesO[0] ?? "");
      await escolherNoGrupo(pagina, "Esforço", opcoesE[0] ?? "");
      await escolherNoGrupo(pagina, "Custo", opcoesC[opcoesC.length - 1] ?? "");
      await pagina.getByRole("button", { name: "Salvar átomos" }).click();
      await anunciou(pagina, /Átomos salvos\./);
      await recarregar(pagina);
      const trio = await trioNaTela(pagina);
      await pagina.getByRole("button", { name: "Limpar átomos" }).click();
      await anunciou(pagina, /Átomos limpos\./);
      const limpo = "Opcionalidade=(nenhum) · Esforço=(nenhum) · Custo=(nenhum)";
      const ate = Date.now() + 15000;
      let antes = await trioNaTela(pagina);
      while (antes !== limpo && Date.now() < ate) {
        await pagina.waitForTimeout(250);
        antes = await trioNaTela(pagina);
      }
      await pagina.getByRole("button", { name: "Desfazer" }).first().click();
      const anuncio = await anunciou(pagina, /Átomos restaurados\./);
      await recarregar(pagina);
      return {
        antes,
        pedido: trio,
        obtido: await trioNaTela(pagina),
        extra: `anúncio=${JSON.stringify(anuncio)}`,
      };
    },
  },
};

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
  conferir(
    "P0 · o universo das escritas sai da lista canônica da página, e toda op tem conferência ou dispensa com motivo",
    problemas.length === 0,
    `${String(OPS_DA_PAGINA.length)} op(s) em src/app/tarefa/pedido.ts: ${OPS_DA_PAGINA.join(
      ", ",
    )} · ${String(conferidas.length)} conferida(s) por persistência (piso ${String(
      PISO_DE_OPS_CONFERIDAS,
    )}) · ${String(dispensadas.length)} dispensada(s) com motivo escrito${
      problemas.length === 0 ? "" : ` — ${problemas.join(" | ")}`
    }`,
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
      await recarregar(aberta.pagina);
      const r = await PERSISTENCIA_POR_OP[op].conferir(aberta.pagina);
      const pediuOutraCoisa = r.pedido !== r.antes;
      conferir(
        `P · ${op} · o que o operador pediu é o que está lá DEPOIS DO F5`,
        pediuOutraCoisa && r.obtido === r.pedido,
        `rota=${rota} · antes=${JSON.stringify(r.antes)} · PEDIDO=${JSON.stringify(
          r.pedido,
        )} · depois do F5=${JSON.stringify(r.obtido)}${
          pediuOutraCoisa
            ? ""
            : " — o pedido é IGUAL ao estado de antes: esta medida não mediu nada"
        } · ${r.extra}`,
      );
    });
  }
  await aberta.contexto.close();
}

await navegador.close();
encerrarServidor();

console.log("%s", medidas.join("\n"));
if (falhas.length > 0) {
  console.error("%s", `\n${String(falhas.length)} medida(s) fora da régua: ${falhas.join(" | ")}`);
  process.exit(1);
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
  "L · ",
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
  ...[...OPS_POR_ROTA.values()].flat().map((op) => `P · ${op} · `),
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
