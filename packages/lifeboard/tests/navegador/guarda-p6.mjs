/**
 * OS-LIFEBOARD · P6 — rodada 14. A GUARDA NO NAVEGADOR.
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
 * | J | a SENTINELA de tempo real: nada mexeu no contrato em toda a vida da guarda | registro vazio; vida ≥ 30 s (medida: ~41 s) |
 * | K | a SENTINELA DO RELÓGIO: meia hora adiantada de uma vez, nenhum temporizador mexeu no contrato | registro vazio; ≥ 4 campos no DOM; 0 `type=number` |
 * | V-* | uma por medida: o registro do VIGIA daquela medida está vazio | 0 mudança fora da régua, vigia instalado |
 *
 * D, H e I cobrem TRÊS dos cinco formulários no navegador. Os cinco estão
 * cobertos pela guarda derivada de `tests/unit/`, que desde a rodada 14 é
 * PROVADA arquivo por arquivo: a sabotagem é injetada no texto de cada arquivo
 * que chama a porta, em cinco grafias, e a guarda tem de acusar todas.
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

/** Um contexto novo por medida: nada de rascunho de uma vazar na outra. */
async function abrir(rota, largura = 1280, altura = 1200, comRelogioDeMentira = false) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura } });
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
    propriedades: PROPRIEDADES_DO_CONTRATO,
    atributos: ATRIBUTOS_DO_CONTRATO,
  });
  const pagina = await contexto.newPage();
  await pagina.goto(`${BASE}${rota}`, { waitUntil: "networkidle" });
  await pagina.waitForSelector("h1", { timeout: 30000 });
  return { contexto, pagina };
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
 *  - **medida J, a sentinela de tempo real.** Uma página aberta antes da
 *    primeira medida e lida depois da última. Ela vive o tempo INTEIRO da
 *    guarda, e a medida imprime esse tempo: **medido nesta rodada, ~41 s.**
 *    `PISO_DE_VIDA_DA_SENTINELA` (30 s) reprova se esse alcance encolher —
 *    quem acelerar a guarda a ponto de reduzir o alcance tem de baixar o
 *    número de propósito, no diff.
 *  - **medida K, a sentinela do relógio.** Esperar 60 s para pegar uma mutação
 *    de 60 s seria pagar caro por uma duplicação: o sabotador escreveria 120 s.
 *    Então esta sentinela nasce com o relógio da página sob controle da guarda
 *    (`clock.install()`), e a medida K **adianta meia hora de uma vez**. Todo
 *    `setTimeout`/`setInterval` agendado dispara, e o vigia anota. O alcance
 *    para mutação agendada deixa de ser "o tempo que a guarda gasta" e passa a
 *    ser **qualquer atraso até 30 min** — o exemplo de 60 s do coordenador fica
 *    VERMELHO, provado.
 *
 * **O que continua fora de alcance, dito por extenso:** (a) atraso maior que os
 * 30 min que a medida K adianta; (b) mutação disparada por algo que o relógio de
 * mentira não controla e que só acontece depois do fim da guarda — por exemplo
 * a resposta de uma requisição de rede real que demore mais que isso. O que
 * compensa, sem ser o bastante sozinho: as duas redes de fonte (`tiposDeInput` e
 * `escritasNoDom`, no `src/` inteiro) pegam a escrita quando ela está escrita
 * neste repositório, em qualquer grafia da família — elas só não alcançam código
 * que a varredura não lê (pacote de fora, import dinâmico, código do próprio
 * Next). A interseção "escrita que a varredura não lê **e** disparada fora do
 * alcance das duas sentinelas" fica descoberta, e está dito aqui.
 * ════════════════════════════════════════════════════════════════════════════
 */

/** A chave do registro do vigia no `sessionStorage` da página sob teste. */
const CHAVE_DO_VIGIA = "__vigia-p6-contrato";

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
  const { chave, propriedades, atributos } = config;
  const inicio = Date.now();
  let naMemoria = [];

  const ler = () => {
    try {
      const cru = window.sessionStorage.getItem(chave);
      if (typeof cru === "string") return JSON.parse(cru);
    } catch {
      /* janela privada ou armazenamento bloqueado: a memória do processo serve */
    }
    return naMemoria;
  };
  const anotar = (entrada) => {
    const lista = ler();
    lista.push(entrada);
    naMemoria = lista;
    try {
      window.sessionStorage.setItem(chave, JSON.stringify(lista));
    } catch {
      /* idem */
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
          naArvore: this.isConnected === true,
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
            naArvore: this.isConnected === true,
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
          naArvore: alvo.isConnected === true,
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

  window.__vigiaP6 = {
    instalado: true,
    redes,
    mudancas: ler,
    vidaMs: () => Date.now() - inicio,
  };
}

/** O que o vigia daquela página anotou — lido de dentro do Chromium. */
async function lerVigia(pagina) {
  return await pagina.evaluate(() => {
    const v = window.__vigiaP6;
    if (v === undefined || v === null) return { instalado: false, redes: [], mudancas: [], vidaMs: 0 };
    return { instalado: true, redes: v.redes, mudancas: v.mudancas(), vidaMs: v.vidaMs() };
  });
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
  return m.naArvore === true || (m.prop === "type" && m.para === "number");
}

async function conferirVigia(nome, paginas) {
  const lidos = [];
  for (const pagina of paginas) {
    try {
      lidos.push(await lerVigia(pagina));
    } catch (erro) {
      lidos.push({
        instalado: false,
        redes: [],
        mudancas: [],
        vidaMs: 0,
        erro: erro instanceof Error ? erro.message.split("\n")[0] : String(erro),
      });
    }
  }
  const semVigia = lidos.filter((l) => !l.instalado).length;
  const todas = lidos.flatMap((l) => l.mudancas);
  const culpadas = todas.filter(foraDaRegua);
  const naMontagem = todas.length - culpadas.length;
  const redes = [...new Set(lidos.flatMap((l) => l.redes))];
  conferir(
    `${nome} · nada mexeu no contrato dos campos, em nenhum momento da medida`,
    lidos.length > 0 && semVigia === 0 && culpadas.length === 0,
    `${String(lidos.length)} página(s) lida(s), ${String(
      semVigia,
    )} sem vigia instalado · redes ativas: ${redes.join(", ") || "(nenhuma)"} · ${String(
      culpadas.length,
    )} mudança(s) fora da régua, ${String(
      naMontagem,
    )} na montagem da árvore (React, antes de inserir)${
      culpadas.length === 0 ? "" : ` — ${culpadas.map(descreverMudanca).join(" · ")}`
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
// A SENTINELA — aberta agora, lida na última medida (J)
//
// Ela não clica em nada. A única coisa que ela faz é EXISTIR enquanto a guarda
// roda, com o vigia dentro. É o que dá ao vigia um alcance de tempo maior que
// o de qualquer medida isolada, e é o que torna o limite declarável em número
// em vez de em promessa.
// ════════════════════════════════════════════════════════════════════════════
const sentinela = await abrir("/tarefa/task-docs");
const nascimentoDaSentinela = Date.now();

// ════════════════════════════════════════════════════════════════════════════
// A SENTINELA DO RELÓGIO — o alcance que não depende de esperar
//
// A sentinela acima mede tempo de verdade, e por isso o alcance dela é o tempo
// que a guarda gasta (~40 s). O exemplo do coordenador para o limite era uma
// mutação agendada para 60 s: fora de alcance por espera, e esperar 60 s numa
// guarda de 50 s seria pagar caro por uma duplicação (o sabotador escreveria
// 120 s).
//
// Esta segunda sentinela troca espera por RELÓGIO: `clock.install()` põe o
// tempo da página sob controle da guarda, e a medida K adianta meia hora de
// uma vez. Todo `setTimeout`/`setInterval` que a página tiver agendado dispara,
// e o vigia anota. O alcance deixa de ser "o tempo que a guarda gasta" e passa
// a ser "qualquer atraso até o que a medida K adiantar".
//
// Medido antes de entrar aqui: com o relógio de mentira a página HIDRATA
// normalmente (`h1` presente, os 4 campos com `type=text`, a duração com o
// valor `2` do banco) — trocar o relógio do React não o quebra.
// ════════════════════════════════════════════════════════════════════════════
const sentinelaDoRelogio = await abrir("/tarefa/task-docs", 1280, 1200, true);

// ════════════════════════════════════════════════════════════════════════════
// A · TODO CAMPO QUE ACEITA NÚMERO É DE TEXTO, COM TECLADO DECIMAL
// ════════════════════════════════════════════════════════════════════════════
await medir("A+B", async () => {
  const { contexto, pagina } = await abrir("/tarefa/task-build");
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
  await conferirVigia("V-AB", [pagina]);
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
  const { contexto, pagina } = await abrir("/tarefa/task-docs");
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
  const paginasDaMedida = [pagina];
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
    paginasDaMedida.push(outro.pagina);
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
  const { contexto, pagina } = await abrir("/tarefa/task-docs");
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
  await conferirVigia("V-D", [pagina]);
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
  const { contexto, pagina } = await abrir("/tarefa/task-build");
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
  await conferirVigia("V-E", [pagina]);
  await contexto.close();
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
  const { contexto, pagina } = await abrir("/tarefa/task-build");
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
  await conferirVigia("V-F", [pagina]);
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
  const { contexto, pagina } = await abrir("/tarefa/task-docs");
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
  await conferirVigia("V-H", [pagina]);
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
  const { contexto, pagina } = await abrir("/tarefa/task-docs");
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
  await conferirVigia("V-I", [pagina]);
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
  const { contexto, pagina } = await abrir("/tarefa/task-build");
  const campo = campoPorNome(pagina, /^Duração \(dias, p80/).first();
  const achou = (await campo.count()) === 1;
  let gravado = null;
  let depoisDaVolta = null;
  let temLink = false;
  if (achou) {
    gravado = await campo.inputValue();
    await campo.fill("9.9");
    await pagina.waitForTimeout(300);
    const link = pagina.locator('a[href="/tarefa/task-setup"]').first();
    temLink = (await link.count()) >= 1;
    if (temLink) {
      await link.click();
      await pagina.waitForURL("**/tarefa/task-setup", { timeout: 30000 });
      await pagina.waitForSelector("h1");
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
  await conferirVigia("V-G", [pagina]);
  await contexto.close();
});

// ════════════════════════════════════════════════════════════════════════════
// J · A SENTINELA — O ALCANCE DE TEMPO DO VIGIA, MEDIDO E IMPRESSO
//
// Ela foi aberta antes da medida A e não fez nada desde então. O que a medida J
// pergunta é a pergunta desta rodada na sua forma mais crua: **em algum momento
// da vida desta guarda, alguma coisa mexeu no contrato de algum campo?**
//
// O tempo de vida dela é o ALCANCE do vigia, e ele sai impresso: uma mutação
// agendada para além desse número está fora de alcance, e é assim que o limite
// fica declarado em vez de escondido. `PISO_DE_VIDA_DA_SENTINELA` reprova se o
// alcance encolher sem alguém baixar o número de propósito.
// ════════════════════════════════════════════════════════════════════════════
await medir("J", async () => {
  const lido = await lerVigia(sentinela.pagina);
  const vida = Date.now() - nascimentoDaSentinela;
  const culpadas = lido.mudancas.filter(foraDaRegua);
  conferir(
    "J · a sentinela: nada mexeu no contrato em toda a vida da guarda",
    lido.instalado && culpadas.length === 0 && vida >= PISO_DE_VIDA_DA_SENTINELA,
    `a sentinela viveu ${String(
      Math.round(vida / 1000),
    )}s — este é o ALCANCE DE TEMPO desta guarda, e mutação agendada para depois dele NÃO é vista (piso declarado: ${String(
      Math.round(PISO_DE_VIDA_DA_SENTINELA / 1000),
    )}s) · vigia instalado=${String(lido.instalado)} · redes: ${
      lido.redes.join(", ") || "(nenhuma)"
    } · ${String(culpadas.length)} mudança(s) fora da régua, ${String(
      lido.mudancas.length - culpadas.length,
    )} na montagem${culpadas.length === 0 ? "" : ` — ${culpadas.map(descreverMudanca).join(" · ")}`}`,
  );
  await sentinela.contexto.close();
});

// ════════════════════════════════════════════════════════════════════════════
// K · A SENTINELA DO RELÓGIO — MEIA HORA DE UMA VEZ
//
// Adianta o relógio da página sentinela e pergunta ao vigia o que aconteceu.
// É esta medida que fecha o item 6 da lista do coordenador (`setTimeout` de
// 60 s, maior que o tempo de vida da guarda) sem ter de esperar 60 s.
// ════════════════════════════════════════════════════════════════════════════
await medir("K", async () => {
  const antes = await lerVigia(sentinelaDoRelogio.pagina);
  await sentinelaDoRelogio.pagina.clock.fastForward(ADIANTAMENTO_DO_RELOGIO);
  // Dois quadros para o React processar o que os temporizadores dispararam.
  await assentar(sentinelaDoRelogio.pagina);
  const depois = await lerVigia(sentinelaDoRelogio.pagina);
  const culpadas = depois.mudancas.filter(foraDaRegua);
  const contrato = await sentinelaDoRelogio.pagina.evaluate(LER_CAMPOS);
  const foraDaReguaNoDom = contrato.filter(
    (c) => c.type === "number" || c.atributoType === "number",
  );
  conferir(
    "K · relógio adiantado meia hora: nenhum temporizador mexeu no contrato",
    antes.instalado &&
      depois.instalado &&
      culpadas.length === 0 &&
      contrato.length >= 4 &&
      foraDaReguaNoDom.length === 0,
    `relógio adiantado ${String(
      Math.round(ADIANTAMENTO_DO_RELOGIO / 60000),
    )} min de uma vez — atraso ATÉ ISSO está no alcance desta guarda · vigia instalado=${String(
      depois.instalado,
    )} · ${String(culpadas.length)} mudança(s) fora da régua, ${String(
      depois.mudancas.length - culpadas.length,
    )} na montagem · ${String(contrato.length)} campos no DOM depois do adiantamento (mínimo 4), ${String(
      foraDaReguaNoDom.length,
    )} com type=number${
      culpadas.length === 0 ? "" : ` — ${culpadas.map(descreverMudanca).join(" · ")}`
    }`,
  );
  await sentinelaDoRelogio.contexto.close();
});

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
  "F · ",
  "G · ",
  "H · ",
  "I · ",
  "J · ",
  "K · ",
  "V-AB · ",
  "V-C · ",
  "V-D · ",
  "V-E · ",
  "V-F · ",
  "V-G · ",
  "V-H · ",
  "V-I · ",
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
