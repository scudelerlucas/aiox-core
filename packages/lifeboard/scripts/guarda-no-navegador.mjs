#!/usr/bin/env node
/*
 * Os trechos dentro de `page.evaluate(...)` rodam DENTRO do Chromium, não no
 * Node — `document`, `window` e `getComputedStyle` existem lá. A linha abaixo
 * só declara isso ao analisador; nenhuma regra é desligada.
 */
/* global document, window, getComputedStyle, Element, Node, MutationObserver, KeyboardEvent, PointerEvent, MouseEvent */
/**
 * OS-LIFEBOARD · P4 — A GUARDA QUE MEDE O PRODUTO, NO NAVEGADOR.
 *
 * COMO RODAR
 *   `node scripts/guarda-no-navegador.mjs` — só isso. A guarda SOBE O PRÓPRIO
 *   servidor a partir DESTE diretório, numa porta livre, e o derruba no fim.
 *   Falhou, sai com código 1; não conseguiu medir, sai com 2 dizendo o que
 *   falta. Nunca sai 0 fingindo ter medido.
 *
 * VARIÁVEIS
 *   LIFEBOARD_BASE_URL    endereço de um servidor JÁ NO AR. Quem passa isto
 *                         assume a responsabilidade de ele servir esta árvore.
 *   LIFEBOARD_PLAYWRIGHT  caminho do `playwright-core` (este pacote não o
 *                         declara como dependência: o CI da casa não instala
 *                         navegador, e instalar aqui era proibido pela ordem
 *                         da rodada)
 *   LIFEBOARD_CHROMIUM    `executablePath` do Chromium já instalado
 *   LIFEBOARD_GUARDA_JSON caminho para gravar a medição crua
 *   LIFEBOARD_GUARDA_LARGURAS  subconjunto das larguras ("1440x900,390x800"),
 *                         para repetir uma sabotagem em minutos. O portão
 *                         completo continua sendo a lista inteira, e a corrida
 *                         parcial se anuncia na primeira linha da saída.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * RODADA 10 — O QUE MUDOU, E POR QUÊ
 * ═════════════════════════════════════════════════════════════════════════
 *
 * **CRÍTICO — a guarda lia atributo e nunca perguntava se alguma coisa foi
 * PINTADA.** A versão da rodada 9 abria o Chromium de verdade e, para dizer
 * "a camada X está desenhada", lia `stroke`, `stroke-dasharray` e
 * `paths.length` do SVG. Nenhuma das três muda com transparência. Medido:
 * `style={{ opacity: 0 }}` no `<g>` da aresta (UMA linha em `aresta-svg.tsx`)
 * apagou as cinco camadas, o traço triplo e o ❌ — e os CINCO portões ficaram
 * verdes, esta guarda inclusive, imprimindo "todas as promessas medidas no
 * navegador se sustentam" sobre um grafo que virou 11 cartões soltos.
 *
 * Agora, **nenhuma medida de "isto está visível?" lê atributo declarado**. A
 * ferramenta é `scripts/pixel-do-grafo.mjs`: duas fotos da tela, uma com o
 * elemento e outra com ele `visibility: hidden`, e exige-se as DUAS coisas —
 * pixels na cor que o compositor deve pintar E pixels que MUDAM quando o
 * elemento sai. A geometria amostrada sai do `d` do próprio `<path>` (a
 * polilinha que o roteador calculou) convertido para tela pelo
 * `getScreenCTM()`: os pontos caem SOBRE o traço, não perto dele.
 *
 * O universo é **derivado**, não escrito à mão: os papéis de aresta vêm de
 * `TIPOS_DE_BANDA` (`src/lib/geometria-da-aresta.ts`), as camadas de
 * `CAMADAS_TODAS` e os rótulos de `CAMADA_LABEL`
 * (`src/lib/camadas-do-grafo.ts`), as cores de `ARESTA_STROKE*`
 * (`src/components/graph/aresta-svg.tsx`). Papel novo sem cor declarada
 * REPROVA ("a guarda não sabe medir"); papel com ZERO arestas na tela REPROVA
 * (medir zero nunca é sucesso).
 *
 * **ALTO 1 e ALTO 2 — a guarda media um estado só.** Um clique no aviso
 * "5 fontes desatualizadas" devolvia a faixa "Hoje" a 0 px (44 → 0 a 1024,
 * 1280 e 1440; 44 → 10 a 1920) e, com o aviso aberto, 2 px de resize
 * derrubavam o zoom do teto (1,8 → 0,849). As duas são a MESMA classe, e as
 * duas correções anteriores fecharam só o estado inicial. A régua agora varre
 * **estados derivados da própria tela**: o estado base mais um estado por
 * controle `[aria-expanded]` que a página tiver — e em cada um mede "Hoje" e
 * a sobrevivência do gesto do operador a 2 px de resize.
 *
 * **ALTO 3 — teclado e leitor de tela alcançavam 1 das 5 camadas.** A medida
 * §10 casa, linha a linha, o que o canvas DESENHA com o que a lista acessível
 * DIZ: toda aresta desenhada tem de aparecer na lista, com o rótulo da camada
 * dela e o título do outro lado, e todo item da lista tem de ser alcançável
 * por Tab.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * O QUE ELA MEDE
 * ═════════════════════════════════════════════════════════════════════════
 * | § | medida | régua |
 * |---|---|---|
 * | 1 | a faixa "Hoje" acima da dobra | ≥ 44 px no desktop |
 * | 2 | o pane real × `tests/unit/panes-medidos.json` | ± 2 px |
 * | 3 | seis cliques de zoom, e o gesto não é desfeito | monotônico, teto 1,8 |
 * | 4 | altura do nó no DOM | > 0 |
 * | 5 | 2 px de resize não apagam o gesto | Δzoom = 0 |
 * | 6 | …mas um resize DE VERDADE ainda reenquadra | Δzoom ≠ 0 |
 * | 7 | **toda aresta desenhada PINTA** (cor composta + pixel que muda) | por papel, piso derivado |
 * | 8 | **a faixa do caminho crítico é larga de PIXEL**, não 3 atributos | ≥ 2× a simples |
 * | 8b | **cada um dos três traços pinta, e num lugar diferente dos outros** | 3 `<path>`, cada um medido |
 * | 9 | **todo glifo (seta/círculo/losango/❌) PINTA** | pixel que muda; ❌ também na cor |
 * | 10 | **teclado e leitor alcançam toda aresta do grafo** | 0 arestas fora da lista |
 * | 11 | **§1, §5 E §7–§10/§12 em TODO estado da tela**, derivados de `[aria-expanded]` | idem |
 * | 12 | **o canvas × o DADO, nos dois sentidos** | conjuntos e contagens iguais |
 * | 13 | **desmarcar uma camada apaga as arestas dela do canvas** | previsão canvas+checkbox |
 * | 14 | **o estado em que a tela NASCE** (`CAMADAS_DEFAULT`) | nada fora do default, **e em PIXEL** |
 * | 15 | **o desenho DEPOIS do gesto do operador** (zoom e pan) | canvas × universo; cartão não anda, fundo anda |
 * | 16 | **a lista acessível obedece ao painel "Camadas"** | camada desmarcada não é anunciada |
 * | 17 | **fonte desligada esmaece a aresta DE VERDADE** | α da esmaecida < metade do α da vizinha |
 * | 18 | **as camadas sobrevivem ao F5** | estado depois do recarregamento = estado antes |
 * | 19 | **o desenho continua de pé depois de o TEMPO REAL passar** (sentinela viva as medidas inteiras daquela largura) | desenho refeito = desenho do nascimento, 0 escrita anotada |
 * | 20 | **idem, com o relógio adiantado meia hora DUAS vezes**, com a tela exercida entre elas | idem |
 * | 21 | **o alcance de tempo declarado cobre tudo o que a guarda mede** | 1 sentinela de cada tipo por largura |
 * | 0 | **o universo do dado é grosso o bastante para provar a classe** | ≥ 2 arestas por camada base |
 *
 * ═════════════════════════════════════════════════════════════════════════
 * RODADA 11 — A GUARDA COMPARAVA O DESENHO COM ELE MESMO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A rodada 10 curou *"a guarda lia atributo e nunca perguntava se alguma
 * coisa foi pintada"*. A 11 herdou a versão nova do mesmo vício: **a guarda
 * perguntava se alguma coisa foi pintada, e nunca se foi pintada a coisa
 * certa, no lugar certo, na cor certa, entre os nós certos.** Cinco
 * sabotagens de UMA linha cada passaram pelos cinco portões:
 *
 * • **ALTO 1** — `filter: hue-rotate(-140deg)` numa aresta de sucessão: cor
 *   declarada `rgb(95,227,154)`, cor PINTADA `rgb(255,167,161)` (o vermelho
 *   do caminho crítico), 0 de 378 pixels na cor declarada. A régua por aresta
 *   lia `getComputedStyle(path).stroke` (declaração, não pintura) e a régua
 *   por papel exigia UMA aresta certa — a outra pagava a conta. Cura: §7 mede
 *   a cor de CADA aresta pelo modelo de mistura (`residuoDeMistura`), que
 *   resolve antialias e oclusão sem abrir a porta para outra cor.
 * • **ALTO 2** — uma aresta do caminho crítico sumiu do canvas e a saída
 *   imprimiu `critico=1/1` chamando de sucesso. §10 só perguntava um sentido
 *   e §7 tinha piso de 1 por papel. Cura: §12, o canvas × o dado publicado
 *   pelo produto (`data-lb-contrato-do-canvas`), nos dois sentidos e por
 *   contagem — nunca por piso.
 * • **ALTO 3** — `camadasAtivas` fixo nas cinco. `ligarTodasAsCamadas`
 *   aparecia 3× e NADA desligava; o default nunca era observado. Cura: §13 e
 *   §14.
 * • **ALTO 4** — um hex escuro em `aresta-svg.tsx` levou a sucessão a 1,27:1
 *   contra o canvas. A guarda derivava a cor do MESMO arquivo que a decide
 *   (o arquivo concordando consigo mesmo) e havia duas tabelas de hex sem
 *   teste entre elas. Cura: `derivarContrato` exige as duas tabelas iguais,
 *   `scripts/checar-contraste.mjs` mede o hex que o grafo pinta e
 *   `tests/unit/cor-da-aresta-uma-fonte-so.test.ts` costura as duas.
 * • **MÉDIO 5** — o traço desenhado entre o par ERRADO de cartões. Cura:
 *   `conferirExtremos`, as duas pontas do `d` contra a caixa dos cartões que
 *   `data-origem`/`data-destino` nomeiam.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * RODADA 13 — A GUARDA MEDIA A HIPÓTESE, NÃO O PRODUTO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Nove sabotagens de uma linha passaram pelos cinco portões. Elas não são
 * nove defeitos: são cinco formas do MESMO vício, e cada correção abaixo diz
 * qual delas fecha.
 *
 * • **ALTO 1 — §12 "o canvas × o DADO" não comparava com dado nenhum.**
 *   `contratoDoCanvas` e o `useMemo` de `edges` nasciam os dois de
 *   `arestasVisuais`, a 16 linhas um do outro. Trocar o conjunto de ids
 *   críticos que alimenta as ARESTAS deixava os cinco portões verdes, com a
 *   saída imprimindo `críticas 1/1` e `sucessao=3/3` — a mentira medida e
 *   chamada de sucesso. É a **forma 1** (a guarda conta a si mesma), um andar
 *   acima do que a rodada 11 fechou. Cura: `§0`/`§12` derivam o universo
 *   esperado do CPM e do dado bruto (`GET /api/grafo-bruto`, servido por
 *   `core/prioritize/grafo-do-dia.ts`) e comparam par a par com o desenho. O
 *   contrato publicado vira o TERCEIRO lado, não "o dado".
 *
 * • **ALTO 2 — o estado em que a tela NASCE nunca era medido em pixel.**
 *   §7–§12 só rodavam depois de `ligarTodasAsCamadas`; §14 lia ids e texto.
 *   `className: camadasAtivas.size <= 2 ? "opacity-0" : undefined` apagava
 *   TODAS as arestas no único estado que todo mundo vê, e a guarda passava.
 *   É a **forma 4** (mede um instante só). Cura: §14 roda o desenho inteiro.
 *
 * • **ALTO 3 — depois do zoom, nada mais era medido.** `return null` acima de
 *   zoom 1,2 dentro de `v3-edge.tsx` apagava as arestas do DOM depois de seis
 *   cliques, e a guarda já tinha ido embora. **Forma 4** de novo, agora no
 *   eixo do gesto. Cura: §15 mede o canvas × o universo depois do zoom E
 *   depois de um pan — e, no mesmo gesto, prova que o cartão NÃO se arrasta.
 *
 * • **ALTO 4 — com um cartão selecionado, §12 e §10 não rodavam.** O estado
 *   com seleção era medido por `medirPinturaDasArestas` sozinha, com piso de
 *   1 aresta por papel. Apagar uma sucessão SÓ quando há seleção passava.
 *   **Forma 5** (confere o caso, não a classe). Cura: o estado com seleção
 *   passa pelo mesmo `medirODesenhoInteiro` de todos os outros.
 *
 * • **MÉDIO 5 — §10 era unidirecional.** Perguntava "toda aresta desenhada
 *   está na lista?" e nunca "tudo o que a lista anuncia existe?". Uma relação
 *   inventada em 10 das 11 tarefas passava. **Forma 3** (universo por
 *   convenção). Cura: a lista é comparada, item a item, com o universo
 *   derivado — nos dois sentidos.
 *
 * • **MÉDIO 8 — §9 lia a FORMA do glifo e nunca conferia QUAL.** Três setas
 *   idênticas melhoravam os números. Cura: a assinatura geométrica de cada
 *   camada, e a exigência de que elas sejam distintas entre si — sem tabela
 *   escrita aqui, que seria a forma 1 outra vez.
 *
 * • **MÉDIO 9 — a guarda reprovava por CARGA**, com rastro de pilha e código
 *   1 onde o cabeçalho promete 2. Cura (adaptada da peça P6): teto por
 *   medida, teto de corrida, teto em todo `page.evaluate`, congelamento de
 *   aba desligado no Chromium, anúncio de cada etapa enquanto roda — e, no
 *   veredito, **"não consegui medir" é código 2 e "o produto está errado" é
 *   código 1**, nunca os dois no mesmo balde.
 *
 * • **MÉDIO 10 — §8 aceitava barra sólida no lugar do traço triplo**, pelo
 *   escape "uma faixa 3× mais larga". Cura: cada um dos três `<path>` é
 *   medido POR SI — tem de pintar, e tem de pintar num lugar diferente dos
 *   outros dois, à distância que a separação do mundo prevê para aquele zoom.
 *
 * • **BAIXO 11/12/13** — o F5 nunca era dado depois de mexer nas caixas (§18);
 *   o universo do dado tinha UMA aresta em três camadas (§0 cobra ≥ 2, e o
 *   fixture cresceu); e o rótulo de sinergia era escrito em cima do próprio
 *   traço (§7 cobra que nenhum traço cruze a caixa de nenhum rótulo).
 *
 * ═════════════════════════════════════════════════════════════════════════
 * RODADA 14 — A GUARDA NÃO TINHA SENTINELA DE TEMPO NENHUMA
 * ═════════════════════════════════════════════════════════════════════════
 *
 * **ALTO — tudo era medido no começo da vida da página.** A carga, o estado
 * default, o zoom, o pan: quatro instantes, todos nos primeiros segundos. Uma
 * regressão que ARMA DEPOIS era invisível. Quatro linhas dentro de
 * `v3-edge.tsx` — um `setTimeout` de 45 s que devolve `null` para toda aresta
 * não crítica — passaram pelos CINCO portões:
 *
 *     t =  2s  {"arestasNoCanvas":4,"porCamada":{"sucessao":4}}
 *     t = 50s  {"arestasNoCanvas":4,"porCamada":{"sucessao":2}}
 *
 * É a **forma 4** do vício desta casa (*a guarda mede um instante só*) e era a
 * última das cinco que esta peça ainda tinha aberta. Cura: as sentinelas de
 * tempo, §19, §20 e §21 — o bloco com o desenho inteiro e o alcance de tempo
 * escrito por extenso está algumas centenas de linhas abaixo; procure por
 * "QUAL É O ALCANCE DE TEMPO DESTAS MEDIDAS".
 *
 * ═════════════════════════════════════════════════════════════════════════
 * RODADA 16 — OS EIXOS DO PRODUTO DOS GESTOS ERAM ESCOLHIDOS À MÃO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * **ALTO — §22 cruzava camadas × seleção, e o zoom ficou de fora.** Uma
 * linha em `v3-edge.tsx` apagava as ligações do cartão SELECIONADO acima de
 * zoom 1,2 (2 destacadas a 0,849; 0 a 1,467), com os cinco portões verdes.
 * **Forma 3** (universo por convenção), um eixo adiante do ALTO 3 da rodada
 * 15. Cura: o inventário do estado que o operador controla sai do código
 * (§0c, `derivarContrato`) e da tela (§22, `LEITURA_DOS_CONTROLES`); cada item
 * é eixo ou está fora com motivo e lastro; os valores de cada eixo são
 * derivados; e as combinações cobrem todo PAR de valores (cobertura em pares,
 * `cobertura-em-pares.mjs`, recontada e testada) — procure por "§22 · O
 * PRODUTO DOS GESTOS, COM OS EIXOS DERIVADOS".
 *
 * ═════════════════════════════════════════════════════════════════════════
 * RODADA 17 — O OPERADOR PARA NO MEIO, E A PÁGINA QUE TRAVA NÃO É O PRODUTO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * **ALTO — o zoom que o operador usa não era nenhum dos três medidos.** Com
 * `1,2 < zoom < 1,6` apagando o destaque, dois cliques em "Aumentar zoom"
 * sumiam com as ligações do cartão selecionado e a guarda passava inteira em
 * três larguras. Forma 3 de novo, agora nos VALORES de um eixo contínuo. Cura:
 * os valores do zoom saem dos GESTOS (fatores lidos da lib instalada, partidas
 * lidas na página, toda sequência de um gesto repetido até a ponta — 47 a 64
 * valores por largura), e cada um é medido contra as camadas e a seleção
 * (§22z); o pan e a largura da janela, os outros eixos contínuos, ganharam o
 * seu passeio (§22p, §22L); cada eixo diz se é contínuo em
 * `CONTINUIDADE_DOS_EIXOS` (§0c). Procure por "§22z / §22p / §22L".
 *
 * **MÉDIO — "Page crashed" por falta de memória da máquina virava ✗.** A
 * página que trava é refeita num navegador novo; só é o produto quando trava
 * de novo com a máquina sobrando memória. Procure por "A PÁGINA TRAVOU".
 */

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { gerarCoberturaEmPares, paresSemCobertura } from "./cobertura-em-pares.mjs";
import {
  NOTCH_DA_RODA_PX,
  cortesDeLarguraDoCodigo,
  gestosDoZoom,
  julgarTravamento,
  lerFatoresDoZoomDaLib,
  maiorVao,
  planoDoPasseioDoZoom,
  trilhaDaLargura,
  valoresDistintos,
} from "./eixos-continuos.mjs";
import {
  AJUDANTES_NA_PAGINA,
  amostraNoPonto,
  bandasDoPerfil,
  fotosComESem,
  janelaDosPontos,
  perfilPerpendicular,
  TOLERANCIA_DE_MISTURA,
} from "./pixel-do-grafo.mjs";

/** A raiz deste pacote — `scripts/` sobe um nível. */
const RAIZ_DO_PACOTE = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Resolvido antes de abrir o navegador: ou o endereço que o operador passou,
 * ou o do servidor que esta guarda mesma sobe (ver `subirServidorProprio`).
 */
let BASE = process.env.LIFEBOARD_BASE_URL ?? null;
const CHROMIUM = process.env.LIFEBOARD_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/** O teaser da faixa "Fontes + Hoje" — o mesmo número de `altura-do-canvas.ts`. */
const TEASER_DA_FAIXA_DE_BAIXO_PX = 44;

const TODAS_AS_LARGURAS = [
  { largura: 1024, altura: 800, desktop: true },
  { largura: 1280, altura: 800, desktop: true },
  { largura: 1440, altura: 900, desktop: true },
  { largura: 1920, altura: 1080, desktop: true },
  { largura: 390, altura: 800, desktop: false },
];

/**
 * `LIFEBOARD_GUARDA_LARGURAS="1440x900,390x800"` roda um SUBCONJUNTO — existe
 * para a rodada de correção poder repetir uma sabotagem em minutos em vez de
 * dez. O default é a lista inteira, e uma largura pedida que não está na
 * tabela derruba a guarda com código 2: nunca um recorte silencioso.
 */
const LARGURAS = (() => {
  const pedido = process.env.LIFEBOARD_GUARDA_LARGURAS;
  if (!pedido) return TODAS_AS_LARGURAS;
  const chaves = pedido.split(",").map((c) => c.trim()).filter(Boolean);
  const escolhidas = chaves.map((chave) => {
    const achado = TODAS_AS_LARGURAS.find((c) => `${c.largura}x${c.altura}` === chave);
    if (!achado) {
      console.error(
        `guarda-no-navegador: "${chave}" não está na tabela de larguras (${TODAS_AS_LARGURAS.map((c) => `${c.largura}x${c.altura}`).join(", ")})`,
      );
      process.exit(2);
    }
    return achado;
  });
  console.log(`ATENÇÃO: corrida parcial, só ${chaves.join(", ")} — o portão completo são as ${String(TODAS_AS_LARGURAS.length)} larguras.`);
  return escolhidas;
})();

function lerFonte(relativo) {
  return readFileSync(join(RAIZ_DO_PACOTE, relativo), "utf8");
}

/*
 * ── A MATEMÁTICA DA FAMÍLIA DE COR (rodada 15, ALTO 1) ─────────────────────
 *
 * Aritmética de HSL, e só isso: a PROMESSA (quais faixas são "vermelho",
 * "verde", …) mora em `src/lib/promessa-do-grafo.ts` e é lida de lá. O
 * espelho desta conta em TypeScript, que o teste de unidade usa, está no mesmo
 * arquivo da promessa — duas contas iguais sobre a mesma promessa, nunca duas
 * promessas.
 */
function hexParaHsl(hex) {
  const limpo = String(hex ?? "").trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(limpo)) return null;
  const r = Number.parseInt(limpo.slice(1, 3), 16) / 255;
  const g = Number.parseInt(limpo.slice(3, 5), 16) / 255;
  const b = Number.parseInt(limpo.slice(5, 7), 16) / 255;
  const maior = Math.max(r, g, b);
  const menor = Math.min(r, g, b);
  const l = (maior + menor) / 2;
  const d = maior - menor;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - maior - menor) : d / (maior + menor);
  let h;
  if (maior === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (maior === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function matizNaFaixa(h, de, ate) {
  const gr = ((h % 360) + 360) % 360;
  return de <= ate ? gr >= de && gr <= ate : gr >= de || gr <= ate;
}

function corNaFamiliaDaPromessa(hex, familia) {
  const hsl = hexParaHsl(hex);
  if (hsl === null) return false;
  if (hsl.s < familia.satMin || hsl.s > familia.satMax) return false;
  if (hsl.l < familia.lumMin || hsl.l > familia.lumMax) return false;
  if (familia.satMin === 0) return true;
  return matizNaFaixa(hsl.h, familia.hueDe, familia.hueAte);
}

function familiasSeSobrepoem(a, b) {
  if (a.satMin > b.satMax || b.satMin > a.satMax) return false;
  if (a.lumMin > b.lumMax || b.lumMin > a.lumMax) return false;
  if (a.satMin === 0 || b.satMin === 0) return true;
  for (let h = 0; h < 360; h += 1) {
    if (matizNaFaixa(h, a.hueDe, a.hueAte) && matizNaFaixa(h, b.hueDe, b.hueAte)) return true;
  }
  return false;
}

/**
 * ── O CONTRATO, DERIVADO DO CÓDIGO QUE DESENHA ────────────────────────────
 *
 * Três listas escritas à mão aqui seriam três listas livres para apodrecer —
 * e "universo por convenção" é um dos cinco vícios que esta esteira já
 * catalogou. Os papéis, as camadas, os rótulos e as cores saem dos módulos
 * que o produto usa para pintar. Se algum deles sumir ou mudar de forma, esta
 * função lança e a guarda sai com código 2: nunca 0 por não ter conseguido
 * ler o contrato.
 */
function derivarContrato() {
  const geometria = lerFonte("src/lib/geometria-da-aresta.ts");
  const blocoDePapeis = /export const TIPOS_DE_BANDA = \[([\s\S]*?)\] as const;/.exec(geometria);
  if (!blocoDePapeis) throw new Error("não achei TIPOS_DE_BANDA em src/lib/geometria-da-aresta.ts");
  const papeis = [...blocoDePapeis[1].matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]);

  const camadasSrc = lerFonte("src/lib/camadas-do-grafo.ts");
  const blocoDeCamadas = /export const CAMADAS_TODAS[^=]*=\s*\[([\s\S]*?)\];/.exec(camadasSrc);
  if (!blocoDeCamadas) throw new Error("não achei CAMADAS_TODAS em src/lib/camadas-do-grafo.ts");
  const camadas = [...blocoDeCamadas[1].matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]);
  const blocoDoDefault = /export const CAMADAS_DEFAULT[^=]*=\s*\[([\s\S]*?)\];/.exec(camadasSrc);
  if (!blocoDoDefault) throw new Error("não achei CAMADAS_DEFAULT em src/lib/camadas-do-grafo.ts");
  const camadasDefault = [...blocoDoDefault[1].matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]);
  const blocoDeRotulos = /export const CAMADA_LABEL[^=]*=\s*\{([\s\S]*?)\n\};/.exec(camadasSrc);
  if (!blocoDeRotulos) throw new Error("não achei CAMADA_LABEL em src/lib/camadas-do-grafo.ts");
  const rotulos = {};
  for (const m of blocoDeRotulos[1].matchAll(/(\w+):\s*"([^"]+)"/g)) rotulos[m[1]] = m[2];

  const arestaSrc = lerFonte("src/components/graph/aresta-svg.tsx");
  const blocoDeCores = /export const ARESTA_STROKE:[\s\S]*?=\s*\{([\s\S]*?)\n\};/.exec(arestaSrc);
  if (!blocoDeCores) throw new Error("não achei ARESTA_STROKE em src/components/graph/aresta-svg.tsx");
  const cores = {};
  for (const m of blocoDeCores[1].matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{6})"/g)) cores[m[1]] = m[2];
  const critico = /ARESTA_STROKE_CRITICO\s*=\s*"(#[0-9A-Fa-f]{6})"/.exec(arestaSrc);
  const destacada = /ARESTA_STROKE_DESTACADA\s*=\s*"(#[0-9A-Fa-f]{6})"/.exec(arestaSrc);
  if (!critico || !destacada) throw new Error("não achei ARESTA_STROKE_CRITICO/DESTACADA");
  cores.critico = critico[1];
  cores.destacada = destacada[1];

  /*
   * ── A GUARDA NÃO PODE CONTAR A SI MESMA (achado ALTO 4 da rodada 11) ────
   *
   * Até a rodada 10 a tabela de cores saía SÓ de `aresta-svg.tsx` — o mesmo
   * arquivo que decide a cor. "Declarada == contrato" era o arquivo
   * concordando consigo mesmo, e trocar um hex ali levou a sucessão a 1,27:1
   * contra o canvas com os cinco portões verdes.
   *
   * O contrato passa a exigir as DUAS tabelas: o hex de `aresta-svg.tsx` (o
   * que o grafo pinta) e o token `aresta.*` de `tailwind.config.ts` (o que o
   * tema da casa declara, e o que `scripts/checar-contraste.mjs` mede).
   * Divergir é sair com código 2 — nunca 0 por concordância consigo mesmo.
   */
  const temaSrc = lerFonte("tailwind.config.ts");
  const blocoDoTema = /aresta: \{([\s\S]*?)\n {8}\},/.exec(temaSrc);
  if (!blocoDoTema) throw new Error("não achei o grupo de tokens `aresta` em tailwind.config.ts");
  const tokens = {};
  for (const m of blocoDoTema[1].matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{6})"/g)) tokens[m[1]] = m[2];
  const TOKEN_DO_PAPEL = {
    sucessao: "sucessao",
    correlacao: "correlacao",
    sinergia: "sinergia",
    obsolescencia: "obsolescenciaHue",
    critico: "critico",
    destacada: "predecessor",
  };
  const divergentes = [];
  for (const papel of papeis) {
    const token = TOKEN_DO_PAPEL[papel];
    if (!token) {
      divergentes.push(`papel "${papel}" não tem token declarado nesta guarda`);
      continue;
    }
    if (!tokens[token]) {
      divergentes.push(`token aresta.${token} (papel "${papel}") não existe em tailwind.config.ts`);
      continue;
    }
    if (cores[papel] && tokens[token].toUpperCase() !== cores[papel].toUpperCase()) {
      divergentes.push(
        `papel "${papel}": aresta-svg.tsx pinta ${cores[papel]} e o token aresta.${token} diz ${tokens[token]}`,
      );
    }
  }
  if (divergentes.length > 0) {
    throw new Error(
      `as duas tabelas de cor da aresta divergem (uma cor, uma fonte): ${divergentes.join(" ; ")}`,
    );
  }

  /*
   * ── ALTO 1 DA RODADA 15: CONCORDAR NÃO É PROMETER ──────────────────────
   *
   * O parágrafo acima exige que as duas tabelas de cor digam o MESMO hex. Isso
   * fecha "uma das duas apodreceu" e não fecha "as duas foram trocadas no
   * mesmo ato" — porque **as duas são do produto**. O crítico hostil provou
   * com duas linhas (`ARESTA_STROKE_CRITICO` e o token `aresta.critico`, de
   * `#FF7A6B` para `#5FE39A`): as duas tabelas continuaram concordando, os
   * cinco portões ficaram verdes e `checar-contraste.mjs` imprimiu
   * `ok 12,40:1` — porque ele mede o hex NOVO. Na tela, os pixels na cor do
   * caminho crítico caíram de **1661 para 832** e o traço triplo ficou do
   * mesmo verde das arestas de sucessão. **Nada, em lugar nenhum deste
   * repositório, afirmava que o caminho crítico é vermelho.**
   *
   * A âncora é `src/lib/promessa-do-grafo.ts` — nem `aresta-svg.tsx` nem
   * `tailwind.config.ts`. Ela não guarda hex: guarda a FAMÍLIA (faixa de
   * matiz, saturação e luminância). Afinar o tom do vermelho não encosta
   * nela; trocar vermelho por verde exige ir lá e escrever que o caminho
   * crítico deixou de ser vermelho.
   */
  const promessaSrc = lerFonte("src/lib/promessa-do-grafo.ts");
  const blocoDasFamilias = /export const FAMILIAS_DE_COR = \{([\s\S]*?)\n\} as const satisfies/.exec(promessaSrc);
  if (!blocoDasFamilias) {
    throw new Error(
      "não achei FAMILIAS_DE_COR em src/lib/promessa-do-grafo.ts — sem a promessa escrita fora das duas tabelas, esta guarda voltaria a aprovar as duas trocadas no mesmo ato",
    );
  }
  const familias = {};
  for (const m of blocoDasFamilias[1].matchAll(
    /(\w+):\s*\{\s*hueDe:\s*([\d.]+),\s*hueAte:\s*([\d.]+),\s*satMin:\s*([\d.]+),\s*satMax:\s*([\d.]+),\s*lumMin:\s*([\d.]+),\s*lumMax:\s*([\d.]+),\s*emPortugues:\s*"([^"]+)"/g,
  )) {
    familias[m[1]] = {
      hueDe: Number(m[2]),
      hueAte: Number(m[3]),
      satMin: Number(m[4]),
      satMax: Number(m[5]),
      lumMin: Number(m[6]),
      lumMax: Number(m[7]),
      emPortugues: m[8],
    };
  }
  if (Object.keys(familias).length === 0) {
    throw new Error("FAMILIAS_DE_COR existe em promessa-do-grafo.ts e não deu para ler nenhuma família dela");
  }
  const blocoDaPromessaDeCor = /export const FAMILIA_EXIGIDA_POR_PAPEL = \{([\s\S]*?)\n\} as const satisfies/.exec(promessaSrc);
  if (!blocoDaPromessaDeCor) throw new Error("não achei FAMILIA_EXIGIDA_POR_PAPEL em src/lib/promessa-do-grafo.ts");
  const familiaDoPapel = {};
  for (const m of blocoDaPromessaDeCor[1].matchAll(/(\w+):\s*"(\w+)"/g)) familiaDoPapel[m[1]] = m[2];

  const foraDaFamilia = [];
  const familiaJaUsada = new Map();
  for (const papel of papeis) {
    const nomeDaFamilia = familiaDoPapel[papel];
    if (!nomeDaFamilia) {
      foraDaFamilia.push(
        `o papel "${papel}" não tem família de cor prometida em src/lib/promessa-do-grafo.ts — a cor dele poderia virar qualquer uma sem ninguém dizer nada`,
      );
      continue;
    }
    const familia = familias[nomeDaFamilia];
    if (!familia) {
      foraDaFamilia.push(`o papel "${papel}" promete a família "${nomeDaFamilia}", que não existe em FAMILIAS_DE_COR`);
      continue;
    }
    const outro = familiaJaUsada.get(nomeDaFamilia);
    if (outro) {
      foraDaFamilia.push(
        `os papéis "${outro}" e "${papel}" prometem a MESMA família ("${familia.emPortugues}") — dizer a cor de um deixaria de excluir o outro`,
      );
    }
    familiaJaUsada.set(nomeDaFamilia, papel);
    const hex = cores[papel];
    if (!hex) continue;
    if (!corNaFamiliaDaPromessa(hex, familia)) {
      const hsl = hexParaHsl(hex);
      foraDaFamilia.push(
        `o papel "${papel}" é prometido ${familia.emPortugues} e as DUAS tabelas pintam ${hex} (matiz ${String(
          Math.round(hsl?.h ?? -1),
        )}°, saturação ${String((hsl?.s ?? 0).toFixed(2))}, luminância ${String((hsl?.l ?? 0).toFixed(2))})`,
      );
    }
  }
  const paresDeFamilia = Object.keys(familias);
  for (let i = 0; i < paresDeFamilia.length; i += 1) {
    for (let j = i + 1; j < paresDeFamilia.length; j += 1) {
      const a = familias[paresDeFamilia[i]];
      const b = familias[paresDeFamilia[j]];
      if (familiasSeSobrepoem(a, b)) {
        foraDaFamilia.push(
          `as famílias "${paresDeFamilia[i]}" e "${paresDeFamilia[j]}" se sobrepõem — uma mesma cor caberia nas duas, e a promessa deixaria de distinguir`,
        );
      }
    }
  }
  /*
   * Promessa quebrada é PRODUTO REPROVADO (código 1), não "não consegui medir"
   * (código 2): a guarda leu tudo o que precisava e o que ela leu contradiz o
   * que a peça promete. Por isso não se lança daqui — junta-se e §0b cobra,
   * pela mesma porta de todas as outras réguas de produto.
   */
  const promessaQuebrada = [...foraDaFamilia];

  /*
   * ── ALTO 2 DA RODADA 15: OS CINCO NOMES PODIAM ESTAR TODOS ERRADOS ─────
   *
   * `CAMADA_LABEL` alimenta o painel, a lista acessível e o `CONTRATO.rotulos`
   * desta guarda; o único teste comparava o rótulo da lista com
   * `CAMADA_LABEL`. Trocar "Sucessão" e "Correlação" de lugar passava em tudo,
   * e quem opera por teclado passava a ler **"Correlação: habilita X"** (verbo
   * com direção numa relação simétrica) e **"Sucessão: com Y"** (verbo
   * simétrico na única camada que tem direção).
   *
   * A âncora, de novo, está fora da tabela: a promessa diz, por NOME, quais
   * relações têm direção. Aqui isso é conferido contra as DUAS afirmações de
   * direção que o código faz — o verbo da lista acessível e a forma do glifo.
   * §10 confere a mesma coisa no texto que chega à tela.
   */
  const blocoDaDirecao = /export const DIRECAO_POR_ROTULO = \{([\s\S]*?)\n\} as const satisfies/.exec(promessaSrc);
  if (!blocoDaDirecao) throw new Error("não achei DIRECAO_POR_ROTULO em src/lib/promessa-do-grafo.ts");
  const direcaoPorRotulo = {};
  for (const m of blocoDaDirecao[1].matchAll(/"([^"]+)":\s*"(direcional|simetrica)"/g)) direcaoPorRotulo[m[1]] = m[2];
  const lerLista = (nome) => {
    const bloco = new RegExp(`export const ${nome} = \\[([^\\]]*)\\]`).exec(promessaSrc);
    if (!bloco) throw new Error(`não achei ${nome} em src/lib/promessa-do-grafo.ts`);
    return [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  };
  const verbosDirecionais = lerLista("VERBOS_DIRECIONAIS");
  const verbosSimetricos = lerLista("VERBOS_SIMETRICOS");
  const formasDirecionais = lerLista("FORMAS_DIRECIONAIS");

  const blocoDasFormas = /export const FORMA_POR_CAMADA:[\s\S]*?=\s*\{([\s\S]*?)\n\};/.exec(arestaSrc);
  if (!blocoDasFormas) {
    throw new Error("não achei FORMA_POR_CAMADA em src/components/graph/aresta-svg.tsx");
  }
  const formaDaCamada = {};
  for (const m of blocoDasFormas[1].matchAll(/(\w+):\s*"(\w+)"/g)) formaDaCamada[m[1]] = m[2];

  const nomesSemPromessa = [];
  for (const camada of camadas) {
    const rotulo = rotulos[camada];
    const direcao = direcaoPorRotulo[rotulo];
    if (!direcao) {
      nomesSemPromessa.push(
        `a camada "${camada}" se chama "${rotulo}" na tela e src/lib/promessa-do-grafo.ts não diz se uma relação com esse nome tem direção`,
      );
      continue;
    }
    if (camada === "critico") continue;
    const forma = formaDaCamada[camada];
    if (!forma) {
      nomesSemPromessa.push(`a camada "${camada}" não tem forma de glifo declarada em FORMA_POR_CAMADA`);
      continue;
    }
    const apontaNaTela = formasDirecionais.includes(forma);
    if (direcao === "direcional" && !apontaNaTela) {
      nomesSemPromessa.push(
        `"${rotulo}" é uma relação COM direção e o glifo da camada "${camada}" é "${forma}", que não aponta`,
      );
    }
    if (direcao === "simetrica" && apontaNaTela) {
      nomesSemPromessa.push(
        `"${rotulo}" é uma relação SEM direção e o glifo da camada "${camada}" é "${forma}", que aponta`,
      );
    }
  }
  const rotulosDaTela = camadas.map((c) => rotulos[c]).sort();
  const rotulosPrometidos = Object.keys(direcaoPorRotulo).sort();
  if (rotulosDaTela.join("|") !== rotulosPrometidos.join("|")) {
    nomesSemPromessa.push(
      `os nomes do painel são [${rotulosDaTela.join(", ")}] e a promessa conhece [${rotulosPrometidos.join(", ")}]`,
    );
  }
  promessaQuebrada.push(...nomesSemPromessa);

  /*
   * ── O PISO DE VISIBILIDADE VEM DE FORA (achado da rodada 12) ───────────
   *
   * A rodada 11 levou um ALTO por "a guarda conta a si mesma" (a cor saía do
   * mesmo arquivo que a decide). O piso do OUTRO eixo — o α, "dá para ver?" —
   * não pode repetir o vício: ele é lido de `scripts/checar-contraste.mjs`,
   * a régua de contraste da casa, que é quem diz 3:1 para estas arestas.
   * Sumir a constante de lá derruba esta guarda com código 2; mexer no número
   * lá muda os dois portões no mesmo ato, que é o certo.
   */
  const contrasteSrc = lerFonte("scripts/checar-contraste.mjs");
  const pisoNaRegua = /export const PISO_DE_CONTRASTE_DA_ARESTA\s*=\s*([\d.]+)\s*;/.exec(contrasteSrc);
  if (!pisoNaRegua) {
    throw new Error(
      "não achei PISO_DE_CONTRASTE_DA_ARESTA em scripts/checar-contraste.mjs — o piso de visibilidade do traço não pode ser escrito dentro desta guarda (a guarda contaria a si mesma)",
    );
  }
  const pisoDeContraste = Number(pisoNaRegua[1]);
  if (!Number.isFinite(pisoDeContraste) || pisoDeContraste < 1) {
    throw new Error(`PISO_DE_CONTRASTE_DA_ARESTA ilegível em checar-contraste.mjs: "${pisoNaRegua[1]}"`);
  }
  /* E a régua tem de estar de fato COBRANDO esse piso nas arestas: se o par
     `grafo-<papel>` deixar de existir lá, o número aqui vira decoração. */
  if (!/PARES\.push\(\[\s*`grafo-\$\{papel\}`,\s*"navy-950",\s*PISO_DE_CONTRASTE_DA_ARESTA,/.test(contrasteSrc)) {
    throw new Error(
      "checar-contraste.mjs não cobra mais PISO_DE_CONTRASTE_DA_ARESTA no par `grafo-<papel>` sobre navy-950 — o piso desta guarda ficaria sem lastro",
    );
  }

  /*
   * A SEPARAÇÃO DO TRAÇO TRIPLO, em px de MUNDO, lida de quem a decide
   * (`geometria-da-aresta.ts`). §8 precisa dela para saber A QUE DISTÂNCIA os
   * três `<path>` do caminho crítico devem estar uns dos outros naquele zoom —
   * escrever o número aqui seria a guarda decidindo o que ela mede.
   */
  const separacao = /export const SEPARACAO_DA_TRIPLA_MUNDO\s*=\s*([\d.]+)\s*;/.exec(geometria);
  if (!separacao) {
    throw new Error("não achei SEPARACAO_DA_TRIPLA_MUNDO em src/lib/geometria-da-aresta.ts");
  }
  const separacaoDaTripla = Number(separacao[1]);
  if (!Number.isFinite(separacaoDaTripla) || separacaoDaTripla <= 0) {
    throw new Error(`SEPARACAO_DA_TRIPLA_MUNDO ilegível: "${separacao[1]}"`);
  }

  /*
   * ── O PISO DO EIXO DO ZOOM, LIDO DE QUEM O DECIDE (rodada 15, ALTO 5) ──
   *
   * `gestoDeZoom` clicava seis vezes em "Aumentar zoom" e **"Diminuir zoom"
   * não aparecia uma única vez neste arquivo**: a metade de BAIXO do eixo
   * (de 0,849 até o piso) nunca era exercida — justamente onde rodadas
   * anteriores acharam glifo pequeno demais e tripla virando borrão. O
   * crítico provou com uma linha em `v3-edge.tsx` (`if (zoomSeguro < 0.6)
   * return null`): dois cliques em afastar e as 10 arestas viram 0, guarda
   * verde.
   *
   * O piso sai de `tipografia-do-cartao.ts` (quem o calcula) e tem de estar
   * LIGADO no canvas — escrever 0,5 aqui seria a guarda decidindo onde o
   * eixo termina.
   */
  const tipografiaSrc = lerFonte("src/components/graph/tipografia-do-cartao.ts");
  const baseDoMapa = /const BASE_MAPA_PX = ([\d.]+);/.exec(tipografiaSrc);
  const escalaDoMapa = /const ESCALA_MAXIMA_DO_MAPA = ([\d.]+);/.exec(tipografiaSrc);
  const formulaDoPiso =
    /export const ZOOM_MINIMO = BASE_MAPA_PX \/ \(BASE_MAPA_PX \* ESCALA_MAXIMA_DO_MAPA\);/.test(tipografiaSrc);
  if (!baseDoMapa || !escalaDoMapa || !formulaDoPiso) {
    throw new Error(
      "não consegui derivar ZOOM_MINIMO de src/components/graph/tipografia-do-cartao.ts (BASE_MAPA_PX, ESCALA_MAXIMA_DO_MAPA e a fórmula) — sem o piso, o eixo do zoom não tem onde terminar e esta guarda voltaria a só saber ampliar",
    );
  }
  const zoomMinimo = Number(baseDoMapa[1]) / (Number(baseDoMapa[1]) * Number(escalaDoMapa[1]));
  if (!Number.isFinite(zoomMinimo) || zoomMinimo <= 0 || zoomMinimo >= 1) {
    throw new Error(`ZOOM_MINIMO derivado ficou ilegível: ${String(zoomMinimo)}`);
  }
  const grafoSrc = lerFonte("src/components/graph/dependency-graph.tsx");
  if (!/minZoom=\{ZOOM_MINIMO\}/.test(grafoSrc)) {
    throw new Error(
      "o canvas não passa mais `minZoom={ZOOM_MINIMO}` — o piso do eixo do zoom desta guarda ficaria sem lastro no produto",
    );
  }

  /*
   * ── O TETO DO EIXO DO ZOOM, TAMBÉM LIDO DE QUEM O DECIDE (rodada 16) ────
   *
   * Até a rodada 15 o teto era um `1.8` escrito à mão aqui, "o mesmo de
   * dependency-graph.tsx". O piso já saía do produto; o teto era convenção.
   * Com o zoom virando EIXO do produto dos gestos (§22), a ponta de cima tem
   * de ter o mesmo lastro que a de baixo.
   */
  const teto = /export const ZOOM_MAXIMO_DO_CANVAS = ([\d.]+);/.exec(grafoSrc);
  if (!teto || !/maxZoom=\{ZOOM_MAXIMO_DO_CANVAS\}/.test(grafoSrc)) {
    throw new Error(
      "não consegui derivar o teto do zoom de src/components/graph/dependency-graph.tsx (`export const ZOOM_MAXIMO_DO_CANVAS` ligado em `maxZoom=`) — sem o teto, o eixo do zoom de §22 não tem onde terminar",
    );
  }
  const zoomMaximo = Number(teto[1]);
  if (!Number.isFinite(zoomMaximo) || zoomMaximo <= 1 || zoomMaximo <= zoomMinimo) {
    throw new Error(`ZOOM_MAXIMO_DO_CANVAS derivado ficou ilegível: ${String(teto[1])}`);
  }

  /*
   * ── O ESTADO QUE O OPERADOR CONTROLA, INVENTARIADO DO CÓDIGO (rodada 16) ─
   *
   * §22 cruzava dois eixos escolhidos à mão (camadas × seleção). O zoom ficou
   * de fora e uma linha em `v3-edge.tsx` apagou as ligações do cartão
   * selecionado ao aproximar (0,849 → 2 destacadas; 1,467 → 0), com os cinco
   * portões verdes. É a **forma 3** — os eixos do produto eram convenção.
   *
   * Aqui o inventário sai do código: toda prop de `DependencyGraphProps` e
   * todo `useState` dos arquivos do grafo. Cada item tem de estar classificado
   * em `ESTADO_DO_GRAFO` (abaixo): ou é um EIXO do produto dos gestos, ou está
   * FORA com o motivo escrito. Item novo sem classificação reprova (§0c) —
   * nomeando o item. Classificação de item que o código não tem mais também
   * reprova: tabela que descreve estado que não existe é a mesma mentira.
   */
  const inventarioDoEstado = [];
  const interfaceDasProps = /export interface DependencyGraphProps \{([\s\S]*?)\n\}/.exec(grafoSrc);
  if (!interfaceDasProps) {
    throw new Error("não achei `export interface DependencyGraphProps` em dependency-graph.tsx — sem ela o inventário do estado do operador não tem de onde sair");
  }
  for (const m of interfaceDasProps[1].matchAll(/^\s{2}(\w+)\??:/gm)) {
    inventarioDoEstado.push(`prop ${m[1]}`);
  }
  for (const arquivo of [
    "src/components/graph/dependency-graph.tsx",
    "src/components/graph/layer-toggle-panel.tsx",
    "src/components/graph/task-node.tsx",
    "src/components/graph/v3-edge.tsx",
    "src/components/graph/aresta-svg.tsx",
  ]) {
    const fonte = lerFonte(arquivo);
    const funcoes = [...fonte.matchAll(/function (\w+)\s*[(<]/g)].map((m) => ({ nome: m[1], em: m.index }));
    for (const m of fonte.matchAll(/const \[(\w+),\s*set\w+\]\s*=\s*(?:React\.)?use(?:State|Reducer)\b/g)) {
      const dona = funcoes.filter((f) => f.em < m.index).pop();
      inventarioDoEstado.push(`${arquivo.split("/").pop()} ${dona ? dona.nome : "?"}.${m[1]}`);
    }
  }
  /*
   * O estado que a LIB guarda e o produto LÊ: `const { x, y, zoom } =
   * useViewport()`. É por aqui que o pan entra no inventário — o chip de
   * "fora da tela" lê `x`/`y`, e nenhum `useState` do produto guarda o pan.
   */
  for (const arquivo of [
    "src/components/graph/dependency-graph.tsx",
    "src/components/graph/task-node.tsx",
    "src/components/graph/v3-edge.tsx",
    "src/components/graph/aresta-svg.tsx",
  ]) {
    for (const m of lerFonte(arquivo).matchAll(/const \{([^}]*)\}\s*=\s*useViewport\(\)/g)) {
      for (const campo of m[1].split(",").map((c) => c.trim().split(":")[0].trim()).filter(Boolean)) {
        const item = `viewport ${campo}`;
        if (!inventarioDoEstado.includes(item)) inventarioDoEstado.push(item);
      }
    }
  }
  /*
   * E os GESTOS que a lib dá ao operador sem o produto pedir: toda prop do
   * `<ReactFlow>` que nasce ligada (`= true` na assinatura do componente, ou
   * `: true` no estado inicial da store) e toda tecla de ativação
   * (`…KeyCode = '…'`), lidas do próprio pacote instalado — menos as que o
   * produto desliga explicitamente (`prop={false}`/`prop={null}`). Um gesto
   * que a lib liga e o produto esquece de desligar é um eixo que o operador
   * tem, queira a peça ou não.
   */
  const requerDoPacote = createRequire(join(RAIZ_DO_PACOTE, "package.json"));
  let fonteDaLib;
  try {
    const principal = createRequire(requerDoPacote.resolve("reactflow")).resolve("@reactflow/core");
    const raizDaLib = principal.slice(0, principal.lastIndexOf("@reactflow/core") + "@reactflow/core".length);
    fonteDaLib = readFileSync(join(raizDaLib, "dist", "esm", "index.mjs"), "utf8");
  } catch (e) {
    throw new Error(`não consegui ler o pacote @reactflow/core instalado — sem ele os gestos que a lib dá ao operador não entram no inventário: ${String(e?.message ?? e)}`);
  }
  const assinatura = /const ReactFlow = forwardRef\(\(\{([\s\S]*?)\}, ref\) =>/.exec(fonteDaLib);
  const estadoInicial = /const initialState = \{([\s\S]*?)\n\};/.exec(fonteDaLib);
  if (!assinatura || !estadoInicial) {
    throw new Error("não achei a assinatura de `ReactFlow` nem o `initialState` da store em @reactflow/core — o inventário dos gestos da lib ficaria vazio");
  }
  const propsDaLib = new Set([...assinatura[1].matchAll(/(\w+)(?:\s*=[^,]*)?,/g)].map((m) => m[1]));
  const ligadasNaLib = new Set([
    ...[...assinatura[1].matchAll(/(\w+) = true\b/g)].map((m) => m[1]),
    ...[...estadoInicial[1].matchAll(/(\w+): true\b/g)].map((m) => m[1]).filter((p) => propsDaLib.has(p)),
    ...[...assinatura[1].matchAll(/(\w+KeyCode) = /g)].map((m) => m[1]),
  ]);
  const jsxDoCanvas = /<ReactFlow\b([\s\S]*?)<\/ReactFlow>/.exec(grafoSrc);
  if (!jsxDoCanvas) throw new Error("não achei o `<ReactFlow` em dependency-graph.tsx");
  for (const gesto of [...ligadasNaLib].sort()) {
    const desligado = new RegExp(`\\b${gesto}=\\{(?:false|null)\\}`).test(jsxDoCanvas[1]);
    if (!desligado) inventarioDoEstado.push(`gesto da lib ${gesto}`);
  }
  if (inventarioDoEstado.length < 5) {
    throw new Error(`o inventário do estado do grafo saiu com ${String(inventarioDoEstado.length)} item(ns) — o leitor do código quebrou, e um inventário vazio aprovaria tudo`);
  }

  /*
   * ── OS FATORES DE ZOOM DE CADA GESTO, LIDOS DA LIB INSTALADA (rodada 17) ─
   *
   * O eixo do zoom de §22 tinha três valores escritos por esta guarda (o do
   * enquadramento, o piso e o teto) e o operador não para em nenhum deles:
   * ele clica "Aumentar zoom" duas vezes. Os valores do eixo passam a sair dos
   * GESTOS — e o fator de cada gesto sai do código da biblioteca que a página
   * carrega (`eixos-continuos.mjs`, testado sem navegador). O produto tem de
   * ligar os botões ao `zoomIn()`/`zoomOut()` da lib SEM passo próprio: se um
   * dia ele passar um fator seu, o lastro cai aqui e o eixo não tem de onde
   * sair.
   */
  let fatoresDoZoom;
  try {
    const principal = createRequire(requerDoPacote.resolve("reactflow")).resolve("@reactflow/core");
    const raizDaLib = principal.slice(0, principal.lastIndexOf("@reactflow/core") + "@reactflow/core".length);
    const d3 = createRequire(join(raizDaLib, "package.json")).resolve("d3-zoom");
    fatoresDoZoom = lerFatoresDoZoomDaLib({
      fonteDoCore: fonteDaLib,
      fonteDoD3Zoom: readFileSync(join(dirname(d3), "zoom.js"), "utf8"),
    });
  } catch (e) {
    throw new Error(`não consegui derivar os fatores de zoom da lib instalada — sem eles o eixo do zoom de §22z não tem valores: ${String(e?.message ?? e)}`);
  }
  if (!/aria-label="Diminuir zoom" onClick=\{\(\) => void zoomOut\(\)\}/.test(grafoSrc) || !/aria-label="Aumentar zoom" onClick=\{\(\) => void zoomIn\(\)\}/.test(grafoSrc)) {
    throw new Error(
      'os botões "Aumentar/Diminuir zoom" de dependency-graph.tsx não chamam mais `zoomIn()`/`zoomOut()` da lib sem argumento — o fator do clique deixou de ser o que a lib declara, e o eixo do zoom perdeu o lastro',
    );
  }

  const semCor = papeis.filter((p) => !cores[p]);
  if (semCor.length > 0) {
    throw new Error(
      `papel de aresta sem cor declarada — a guarda não sabe medir: ${semCor.join(", ")}. Declare a cor em aresta-svg.tsx e diga aqui como o papel chega à tela.`,
    );
  }
  const camadasSemRotulo = camadas.filter((c) => !rotulos[c]);
  if (camadasSemRotulo.length > 0) {
    throw new Error(`camada sem rótulo em CAMADA_LABEL: ${camadasSemRotulo.join(", ")}`);
  }
  return {
    papeis,
    camadas,
    camadasDefault,
    rotulos,
    cores,
    pisoDeContraste,
    separacaoDaTripla,
    familias,
    familiaDoPapel,
    direcaoPorRotulo,
    verbosDirecionais,
    verbosSimetricos,
    formaDaCamada,
    promessaQuebrada,
    zoomMinimo,
    zoomMaximo,
    inventarioDoEstado,
    fatoresDoZoom,
  };
}

let CONTRATO;
try {
  CONTRATO = derivarContrato();
} catch (e) {
  console.error(`guarda-no-navegador: ${String(e.message ?? e)}`);
  process.exit(2);
}

// ═══════════════════════════════════════════════════════════════════════════
// §0 · O UNIVERSO ESPERADO, DERIVADO DO CPM E DO DADO BRUTO  (achado ALTO 1)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * A rodada 11 criou `data-lb-contrato-do-canvas` e a rodada 12 o chamou de "o
 * lado do DADO". Não era: ele e as arestas do ReactFlow nascem da MESMA
 * variável (`arestasVisuais`), a dezesseis linhas um do outro, no mesmo
 * componente. Qualquer erro acima dela era publicado como "o dado" e depois
 * confirmado pelo desenho — o crítico trocou o conjunto de ids críticos que
 * alimenta as ARESTAS e os cinco portões ficaram verdes, com a saída
 * imprimindo `críticas 1/1` onde o CPM diz 2 e `sucessao=3/3` onde o dado diz
 * 2. A tela dizia que o gargalo é outra cadeia, e os cartões continuavam com a
 * moldura na cadeia certa: a tela se contradizendo sozinha, medida e aprovada.
 *
 * O dado agora entra por um caminho que **não atravessa o componente que
 * desenha**: `GET /api/grafo-bruto` (`core/prioritize/grafo-do-dia.ts`), a
 * mesma função que a home usa para calcular o CPM. Dali saem as tarefas com as
 * duas listas de precedência, as arestas declaradas e o conjunto `critico`.
 *
 * E a derivação abaixo é DESTA guarda — de propósito. Ela espelha as regras
 * que `camadas-do-grafo.ts` documenta (união das três fontes de precedência,
 * dedupe por par, id `sucessao:origem->destino`, crítica quando as duas pontas
 * estão em `critico`). Se as duas divergirem, a guarda fica VERMELHA — que é o
 * lado seguro da divergência, e o contrário de perguntar ao desenho o que ele
 * acha que devia desenhar.
 */
async function lerDadoBruto(base) {
  const resposta = await fetch(`${base}/api/grafo-bruto`, {
    signal: globalThis.AbortSignal.timeout(30000),
  });
  if (!resposta.ok) throw new Error(`GET /api/grafo-bruto respondeu ${String(resposta.status)}`);
  const bruto = await resposta.json();
  if (!Array.isArray(bruto?.tarefas) || !Array.isArray(bruto?.arestas) || !Array.isArray(bruto?.critico)) {
    throw new Error("GET /api/grafo-bruto não devolveu tarefas/arestas/critico");
  }
  return bruto;
}

/** As arestas que o grafo DEVE ter, derivadas do dado bruto + do CPM. */
function derivarUniversoDeArestas(bruto) {
  const ids = new Set(bruto.tarefas.map((t) => t.id));
  const critico = new Set(bruto.critico);
  const vistos = new Set();
  const universo = [];
  const addSucessao = (origem, destino) => {
    if (!ids.has(origem) || !ids.has(destino) || origem === destino) return;
    const chave = `${origem}|${destino}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    const critica = critico.has(origem) && critico.has(destino);
    universo.push({
      id: `sucessao:${origem}->${destino}`,
      origem,
      destino,
      camada: "sucessao",
      critica,
      camadas: critica ? ["sucessao", "critico"] : ["sucessao"],
    });
  };
  for (const t of bruto.tarefas) {
    for (const p of t.predecessorIds ?? []) addSucessao(p, t.id);
    for (const sc of t.successorIds ?? []) addSucessao(t.id, sc);
  }
  for (const e of bruto.arestas) if (e.tipo === "predecessor") addSucessao(e.origem, e.destino);
  for (const e of bruto.arestas) {
    if (!ids.has(e.origem) || !ids.has(e.destino)) continue;
    if (e.tipo !== "correlacao" && e.tipo !== "sinergia" && e.tipo !== "obsolescencia") continue;
    universo.push({
      id: `${e.tipo}:${e.id}`,
      origem: e.origem,
      destino: e.destino,
      camada: e.tipo,
      critica: false,
      camadas: [e.tipo],
      pesoPercent: e.tipo === "sinergia" ? Math.round(e.peso * 100) : undefined,
    });
  }
  return universo;
}

/** O universo depois do painel "Camadas": OR entre as camadas marcadas. */
function universoNasCamadas(universo, camadasAtivas) {
  const ativas = new Set(camadasAtivas);
  return universo
    .filter((a) => a.camadas.some((c) => ativas.has(c)))
    .map((a) => ({ ...a, critica: a.critica && ativas.has("critico") }));
}

/** O título de cada tarefa, pelo dado bruto (nunca pelo que a tela escreve). */
function titulosDoDado(bruto) {
  const m = new Map();
  for (const t of bruto.tarefas) m.set(t.id, t.titulo);
  return m;
}

/**
 * ── §0 · MEDIR A CLASSE EXIGE MAIS DE UM CASO DA CLASSE (achado BAIXO 12) ──
 *
 * O universo do fixture tinha 7 arestas, com UMA em três das quatro camadas
 * base. O piso "cada papel tem ao menos 1 aresta na tela" repousava, em três
 * papéis, sobre um único objeto — tão marginal que mudar o layout já o
 * derrubava, e uma sabotagem na *outra* aresta daquele papel não teria onde
 * ser vista, porque não havia outra. O piso cobra o dado, não a tela: é do
 * lado do dado que a magreza nasce.
 */
const MINIMO_DE_ARESTAS_POR_CAMADA = 2;

function medirEspessuraDoUniverso(universo, bruto) {
  const problemas = [];
  const base = CONTRATO.camadas.filter((c) => c !== "critico");
  for (const camada of base) {
    const n = universo.filter((a) => a.camada === camada).length;
    if (n < MINIMO_DE_ARESTAS_POR_CAMADA) {
      problemas.push(
        `camada "${camada}" tem ${String(n)} aresta(s) no dado (piso ${String(MINIMO_DE_ARESTAS_POR_CAMADA)}) — com uma só, o piso "cada papel tem aresta na tela" repousa num objeto e não prova a classe`,
      );
    }
  }
  const criticas = universo.filter((a) => a.critica).length;
  if (criticas < MINIMO_DE_ARESTAS_POR_CAMADA) {
    problemas.push(
      `o caminho crítico tem ${String(criticas)} aresta(s) no CPM (piso ${String(MINIMO_DE_ARESTAS_POR_CAMADA)}) — uma só não distingue "o traço triplo funciona" de "aquele traço funciona"`,
    );
  }
  exigir(
    problemas.length === 0,
    `§0 o universo do dado é fino demais para provar a classe: ${problemas.join(" ; ")}`,
  );
  return `${String(bruto.tarefas.length)} tarefas · ${String(universo.length)} arestas (${base
    .map((c) => `${c} ${String(universo.filter((a) => a.camada === c).length)}`)
    .join(", ")}) · críticas ${String(criticas)} · goal ${String(bruto.goalId)}`;
}

/**
 * A tabela de panes que `tests/unit/panes-medidos.ts` usa. Lida daqui para que
 * ela não possa apodrecer: se o DOM vivo divergir, esta guarda reprova.
 */
const TABELA_DE_PANES = JSON.parse(lerFonte("tests/unit/panes-medidos.json"));

const falhas = [];
/**
 * ── DUAS LISTAS, DOIS CÓDIGOS DE SAÍDA (achado MÉDIO 9 da rodada 13) ───────
 *
 * O cabeçalho deste arquivo promete: *"Falhou, sai com código 1; não
 * conseguiu medir, sai com 2 dizendo o que falta."* A guarda tinha UMA lista,
 * e três de cinco corridas completas morreram sob carga misturando as duas
 * coisas: um `TimeoutError` não tratado saiu com rastro de pilha e código 1,
 * e "o canvas não apareceu em 4 tentativas" entrou na mesma lista que "a
 * aresta pinta na cor errada".
 *
 * Isso não é detalhe de formatação. **Um portão que fica vermelho por carga
 * ensina a repetir até passar — e é assim que um vermelho de verdade também
 * some.** Agora:
 *
 *   `falhas`      → o PRODUTO não cumpre a promessa. Código 1.
 *   `impedimentos`→ a guarda NÃO CONSEGUIU medir (a página não subiu, um
 *                   `evaluate` não voltou, uma etapa estourou o teto). Código
 *                   2, com o nome da etapa. Nunca 0, nunca confundido com o 1.
 *
 * A fronteira é declarada, não sentida: só o que a guarda classifica
 * explicitamente como impedimento entra na segunda lista. Toda régua de
 * produto continua caindo em `exigir`.
 */
const impedimentos = [];
const medicoes = {};
function exigir(condicao, mensagem) {
  if (!condicao) falhas.push(mensagem);
}
function naoConsegui(mensagem) {
  impedimentos.push(mensagem);
  console.log("%s", `[${carimbo()}] ✗ não consegui medir: ${mensagem}`);
}

/**
 * A falha veio do AMBIENTE, não do produto?
 *
 * Provado ao demonstrar o teto (achado MÉDIO 9): quando uma etapa estoura o
 * tempo, a guarda segue para a seguinte e as fotos daquela página abandonada
 * voltam com *"Target page, context or browser has been closed"*. Isso é o
 * rastro da etapa que morreu — e entrava na lista de FALHAS DE PRODUTO,
 * misturando de novo as duas coisas que esta rodada separou. Página fechada e
 * navegador fechado são impedimento com nome; qualquer outro erro de foto
 * continua sendo reprovação.
 */
function ehErroDeAmbiente(mensagem) {
  const texto = String(mensagem ?? "");
  return (
    texto.includes("has been closed") ||
    texto.includes("Target page") ||
    texto.includes("Target closed") ||
    texto.includes("browser has disconnected")
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// O RELÓGIO DA CORRIDA, E AS TRÊS TRAVAS DE TEMPO  (achado MÉDIO 9)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Adaptado da peça P6 (`tests/navegador/guarda-p6.mjs`, rodada 17), que já
 * tinha resolvido esta classe: `page.evaluate` **não tem tempo limite no
 * Playwright** — nem o padrão do contexto o alcança —, então uma aba que o
 * sistema operacional resolveu não escalonar trava a corrida para sempre. Três
 * travas, e a quarta na linha de comando do Chromium (congelamento de aba de
 * segundo plano desligado).
 */
const INICIO_DA_CORRIDA = Date.now();
/** Teto de UMA etapa. Escrito à mão: teto que a corrida afrouxa não é teto. */
const TETO_POR_ETAPA_MS = 600000;
/** Teto da corrida inteira. */
const TETO_DA_CORRIDA_MS = 5400000;
/** Teto de um `page.evaluate` — a única chamada do Playwright sem tempo limite. */
const TETO_DO_EVALUATE_MS = 60000;

class EstourouOTeto extends Error {}

function carimbo() {
  const s = Math.round((Date.now() - INICIO_DA_CORRIDA) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Corre a promessa contra um relógio; estourar é erro com nome, nunca espera. */
async function comTeto(promessa, ms, oQue) {
  let relogio;
  try {
    return await Promise.race([
      promessa,
      new Promise((_, rejeitar) => {
        relogio = setTimeout(() => rejeitar(new EstourouOTeto(`${oQue} passou de ${String(ms)} ms sem voltar`)), ms);
      }),
    ]);
  } finally {
    if (relogio !== undefined) clearTimeout(relogio);
  }
}

/**
 * Roda uma etapa com nome, teto e anúncio. Estouro ou exceção viram
 * IMPEDIMENTO com o nome da etapa — nunca um rastro de pilha, nunca as etapas
 * seguintes caladas.
 *
 * Só o que a própria etapa registrar por `exigir` conta como falha de produto.
 */
async function etapa(nome, fn, opcoes = {}) {
  const restante = TETO_DA_CORRIDA_MS - (Date.now() - INICIO_DA_CORRIDA);
  if (restante <= 0) {
    naoConsegui(`${nome}: a corrida estourou o teto de ${String(Math.round(TETO_DA_CORRIDA_MS / 60000))} min antes desta etapa começar`);
    return null;
  }
  console.log("%s", `[${carimbo()}] → ${nome}`);
  const t0 = Date.now();
  const inicioDasFalhas = falhas.length;
  try {
    await garantirNavegador();
    const saida = await comTeto(fn(browser), Math.min(TETO_POR_ETAPA_MS, restante), `a etapa "${nome}"`);
    console.log("%s", `[${carimbo()}] ← ${nome} — ${String(Math.round((Date.now() - t0) / 1000))}s`);
    return saida;
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message.split("\n")[0] : String(erro);
    /* A página TRAVOU (ou levou o navegador junto): produto ou máquina? A
       etapa é refeita num navegador novo e o veredito sai da prova — nunca
       do nome do erro (achado MÉDIO da rodada 17). */
    const repetir = opcoes.repetir ?? (fn.length >= 1 ? fn : null);
    if (!(erro instanceof EstourouOTeto) && repetir !== null && (ehTravamento(msg) || !navegadorVivo())) {
      const { saida } = await julgarOTravamento({ nome, msg, t0, inicioDasFalhas, repetir, provaMede: opcoes.provaMede !== false, aoJulgar: opcoes.aoJulgar });
      return saida;
    }
    naoConsegui(
      `${nome}: ${erro instanceof EstourouOTeto ? "estourou o teto de tempo" : "a etapa morreu"} — ${msg}`,
    );
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// A PÁGINA TRAVOU: É O PRODUTO OU É O NAVEGADOR?  (achado MÉDIO da rodada 17)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Na corrida do coordenador, a 1920 a página travou por falta de memória da
 * MÁQUINA ("Page crashed" — seis guardas rodando juntas). §16 saiu certo como
 * "não consegui medir", mas §19, §20 e §21 marcaram ✗ ("a sentinela nunca
 * nasceu", "alcance de tempo ZERO") e a corrida saiu com código 1 — o balde
 * de "o produto está errado" para um defeito que o produto não tinha. E o
 * navegador morto levou junto as cinco etapas de 390 px.
 *
 * A régua agora é uma PROVA, não o nome do erro:
 *
 *   1. toda página abre com o heap de JavaScript limitado a
 *      `TETO_DO_HEAP_DA_PAGINA_MB` (a página do LifeBoard usa ~70 MB): uma
 *      página que vaza memória trava de forma rápida e determinística, sem
 *      levar a máquina — e os outros — junto;
 *   2. travou → a MESMA medida é refeita num navegador NOVO. Não travou de
 *      novo → "navegador": a medida da prova é a que vale (ou, nas sentinelas,
 *      cuja vida longa não se refaz, "não consegui medir" — código 2);
 *   3. travou de novo, e a máquina tinha mais de `PISO_DE_MEMORIA_LIVRE_MB`
 *      livres nas duas vezes (amostrada a cada meio segundo de
 *      `/proc/meminfo`) → "produto": código 1, dizendo quanto havia livre;
 *   4. travou de novo com a máquina abaixo do piso (ou sem como ler a
 *      memória) → "máquina": código 2, com os números;
 *   5. o navegador principal morto é relançado antes da etapa seguinte — uma
 *      largura que trava não cala as outras.
 *
 * O veredito é uma função pura (`julgarTravamento`, em
 * `eixos-continuos.mjs`), testada sem navegador nos quatro desfechos.
 */
const TETO_DO_HEAP_DA_PAGINA_MB = 1024;
const PISO_DE_MEMORIA_LIVRE_MB = 512;
/** Quanto a sentinela de PROVA vive antes de dizer "não travou". */
const VIDA_DA_PROVA_DE_TRAVAMENTO_MS = 20000;

const ARGUMENTOS_DO_NAVEGADOR = [
  "--no-sandbox",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
  `--js-flags=--max-old-space-size=${String(TETO_DO_HEAP_DA_PAGINA_MB)}`,
];

let browser = null;
let pwParaLancar = null;
async function lancarNavegador() {
  return pwParaLancar.chromium.launch({ executablePath: CHROMIUM, args: ARGUMENTOS_DO_NAVEGADOR });
}
function navegadorVivo() {
  return browser !== null && browser.isConnected();
}
/** Relança o navegador principal se ele morreu — a largura seguinte não herda o cadáver. */
async function garantirNavegador() {
  if (browser === null || navegadorVivo()) return;
  console.log("%s", `[${carimbo()}] ! o navegador principal morreu — relançando para as etapas seguintes`);
  browser = await lancarNavegador();
}

function ehTravamento(mensagem) {
  const texto = String(mensagem ?? "");
  return (
    /Page crashed|Target crashed|crashed/i.test(texto) ||
    texto.includes("browser has disconnected") ||
    texto.includes("Browser closed") ||
    texto.includes("browser has been closed")
  );
}

/* O vigia da memória da MÁQUINA: uma amostra a cada meio segundo. */
const AMOSTRAS_DE_MEMORIA = [];
function memoriaLivreAgoraMb() {
  try {
    const m = /MemAvailable:\s+(\d+) kB/.exec(readFileSync("/proc/meminfo", "utf8"));
    return m ? Number(m[1]) / 1024 : null;
  } catch {
    return null;
  }
}
const VIGIA_DA_MEMORIA = setInterval(() => {
  AMOSTRAS_DE_MEMORIA.push({ t: Date.now(), mb: memoriaLivreAgoraMb() });
  if (AMOSTRAS_DE_MEMORIA.length > 20000) AMOSTRAS_DE_MEMORIA.shift();
}, 500);
VIGIA_DA_MEMORIA.unref();
function memoriaMinimaDesde(t0) {
  const valores = [...AMOSTRAS_DE_MEMORIA.filter((a) => a.t >= t0 - 500).map((a) => a.mb), memoriaLivreAgoraMb()];
  if (valores.some((v) => v === null)) return null;
  return Math.min(...valores);
}
const mb = (v) => (v === null ? "ilegível" : `${String(Math.round(v))} MB`);

/** Os travamentos julgados na corrida — impressos no fim. */
const TRAVAMENTOS = [];

async function julgarOTravamento({ nome, msg, t0, inicioDasFalhas, repetir, provaMede, aoJulgar }) {
  const memoriaDaPrimeira = memoriaMinimaDesde(t0);
  console.log("%s", `[${carimbo()}] ! ${nome}: a página travou (${msg}) — refazendo num navegador NOVO para saber se é o produto`);
  const falhasDaTentativa = inicioDasFalhas === undefined ? [] : falhas.splice(inicioDasFalhas);
  try {
    await garantirNavegador();
  } catch (e) {
    console.log("%s", `[${carimbo()}]   não consegui relançar o navegador principal: ${String(e?.message ?? e).split("\n")[0]}`);
  }
  const t1 = Date.now();
  let prova = null;
  let erroDaProva = null;
  let saida = null;
  try {
    prova = await lancarNavegador();
    saida = await comTeto(repetir(prova), TETO_POR_ETAPA_MS, `a prova do travamento de "${nome}"`);
  } catch (e) {
    erroDaProva = e instanceof Error ? e.message.split("\n")[0] : String(e);
    if (e instanceof EstourouOTeto) erroDaProva = `estourou o teto de tempo — ${erroDaProva}`;
  }
  const provaMorreu = prova !== null && !prova.isConnected();
  await prova?.close().catch(() => undefined);
  const memoriaDaProva = memoriaMinimaDesde(t1);
  const veredito = julgarTravamento({
    primeiro: { memoriaMinimaMb: memoriaDaPrimeira },
    prova: { erro: erroDaProva, memoriaMinimaMb: memoriaDaProva },
    pisoMb: PISO_DE_MEMORIA_LIVRE_MB,
    ehTravamento: (m) => ehTravamento(m) || provaMorreu,
  });
  const memoria = `memória livre da máquina: ${mb(memoriaDaPrimeira)} na 1ª vez, ${mb(memoriaDaProva)} na prova (piso ${String(PISO_DE_MEMORIA_LIVRE_MB)} MB)`;
  TRAVAMENTOS.push(`${nome}: ${veredito} — ${msg}${erroDaProva ? ` / prova: ${erroDaProva}` : " / a prova não travou"} · ${memoria}`);
  console.log("%s", `[${carimbo()}]   veredito do travamento: ${veredito} · ${memoria}`);
  if (veredito === "navegador" && provaMede) {
    if (falhasDaTentativa.length > 0) {
      console.log("%s", `[${carimbo()}]   ${String(falhasDaTentativa.length)} reprovação(ões) da tentativa que travou ficam de fora: a prova refez a medida inteira`);
    }
    console.log("%s", `[${carimbo()}] ← ${nome} — medido na prova (a página travou uma vez e não de novo: navegador, não produto)`);
  } else {
    for (const f of falhasDaTentativa) falhas.push(f);
    if (veredito === "produto") {
      exigir(
        false,
        `${nome}: a página TRAVOU duas vezes, a 2ª num navegador novo, com a máquina sobrando memória (${memoria}) — quem trava a página é o produto (${msg}${erroDaProva ? ` / ${erroDaProva}` : ""})`,
      );
    } else if (veredito === "navegador") {
      naoConsegui(`${nome}: a página travou (${msg}); uma prova num navegador novo viveu sem travar — travamento do navegador, não do produto (${memoria}). Esta medida NÃO foi feita`);
    } else if (veredito === "maquina") {
      naoConsegui(`${nome}: a página travou duas vezes e a máquina esteve abaixo do piso de memória livre, ou ela não pôde ser lida (${memoria}) — não dá para culpar o produto`);
    } else {
      naoConsegui(`${nome}: a página travou (${msg}) e a prova num navegador novo morreu de outro jeito (${String(erroDaProva)})`);
    }
  }
  aoJulgar?.(veredito);
  return { veredito, saida: veredito === "navegador" && provaMede ? saida : null };
}

/** A prova de uma SENTINELA que travou: nasce outra num navegador novo e vive `VIDA_DA_PROVA_DE_TRAVAMENTO_MS`. */
async function provaDaSentinela(navegador, caso, comRelogioDeMentira) {
  const s = await nascerSentinela(navegador, caso, comRelogioDeMentira);
  await s.page.waitForTimeout(VIDA_DA_PROVA_DE_TRAVAMENTO_MS);
  await s.page.evaluate(FOTOGRAFIA_DO_DESENHO);
  await s.ctx.close();
  return true;
}

/** Larguras cuja sentinela caiu com o navegador (não com o produto): §21 diz "não medi", não "zero". */
const SENTINELA_PERDIDA_PARA_O_AMBIENTE = new Map();

/**
 * Põe teto em TODO `page.evaluate` desta página. Página que não responde vira
 * impedimento com nome, nunca espera infinita.
 */
function comTetoNoEvaluate(pagina) {
  const original = pagina.evaluate.bind(pagina);
  pagina.evaluate = async (fn, arg) =>
    comTeto(original(fn, arg), TETO_DO_EVALUATE_MS, "um page.evaluate desta página");
  return pagina;
}

function carregarPlaywright() {
  const req = createRequire(import.meta.url);
  const candidatos = [process.env.LIFEBOARD_PLAYWRIGHT, "playwright-core", "playwright"].filter(Boolean);
  for (const c of candidatos) {
    try {
      return req(c);
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

/** Abre o painel "Camadas" e marca as cinco caixas. */
async function ligarTodasAsCamadas(page) {
  const pill = page.locator('button[aria-label="Camadas"]').first();
  /* Saía em silêncio quando o pill não existia — e "a guarda não achou o
     controle" virava "as camadas estão ligadas". Agora é reprovação. */
  if ((await pill.count()) === 0) {
    exigir(false, 'não achei o pill "Camadas" — sem ele nenhuma camada pode ser ligada, e medir o grafo com o default fingindo que são as cinco é medir outra coisa');
    return;
  }
  if ((await pill.getAttribute("aria-expanded")) !== "true") await pill.click();
  await page.waitForSelector('[role="dialog"][aria-label="Camadas do grafo"]', { timeout: 10000 });
  const caixas = page.locator('[role="dialog"][aria-label="Camadas do grafo"] input[type="checkbox"]');
  const n = await caixas.count();
  exigir(
    n === CONTRATO.camadas.length,
    `o painel "Camadas" tem ${String(n)} caixas e o código declara ${String(CONTRATO.camadas.length)} camadas (${CONTRATO.camadas.join(", ")})`,
  );
  for (let i = 0; i < n; i++) {
    const caixa = caixas.nth(i);
    if (!(await caixa.isChecked())) await caixa.check();
  }
  // No celular a folha tem backdrop e o pill fica atrás dele: fecha pelo
  // botão "Fechar" da própria folha, ou pelo Esc.
  const fechar = page.locator('[role="dialog"][aria-label="Camadas do grafo"] button[aria-label="Fechar"]');
  if (await fechar.count()) await fechar.first().click();
  else await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

/**
 * Some com o selo do `next dev` (`<nextjs-portal>`).
 *
 * Ele não é produto: a guarda sobe `next dev` porque é o que ela tem, não
 * porque o operador usa dev. A 390 px o selo fica no canto de baixo e cobre a
 * ÚLTIMA caixa da folha "Camadas" — o clique não chega lá.
 *
 * Existe como função (e não como uma linha dentro de `abrirPagina`) por causa
 * do achado desta rodada: `page.reload()` apaga o `addStyleTag`, e o F5 de
 * §18 devolvia o selo à tela. O sintoma era um `locator.uncheck: Timeout
 * 15000ms exceeded` a 390 px, que o veredito classificava como impedimento —
 * certo quanto à classe, e ainda assim uma medida que não acontecia.
 */
async function esconderSeloDoNext(page) {
  await page
    .addStyleTag({ content: "nextjs-portal { display: none !important; }" })
    .catch(() => undefined);
}

function escalaDe(transform) {
  const m = /matrix\(([-0-9.e]+)/.exec(transform ?? "");
  return m ? Number(m[1]) : null;
}

/** Abre a página já com os ajudantes de pixel instalados, no painel do grafo. */
async function abrirPagina(browser, caso) {
  const ctx = await browser.newContext({ viewport: { width: caso.largura, height: caso.altura } });
  await ctx.addInitScript({ content: AJUDANTES_NA_PAGINA });
  /* Todo `page.evaluate` desta guarda com teto (achado MÉDIO 9): é a única
     chamada do Playwright sem tempo limite, e três das cinco corridas
     completas do crítico morreram sob carga por causa disso. */
  const page = comTetoNoEvaluate(await ctx.newPage());
  const errosDePagina = [];
  page.on("pageerror", (e) => errosDePagina.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  /*
   * No celular o grafo vive numa aba, e a aba só responde depois da
   * hidratação. Clicar uma vez e esperar 30s pelo canvas transformava uma
   * hidratação lenta num TimeoutError com rastro de pilha — que reprova, sim,
   * mas sem dizer nada. Tenta de novo, e só então desiste com a mensagem.
   */
  const abaGrafo = page.locator('nav[aria-label="Painéis"] button', { hasText: "Grafo" });
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    if (!caso.desktop && (await abaGrafo.count()) > 0) {
      await abaGrafo.first().click().catch(() => undefined);
    }
    try {
      await page.waitForSelector(".react-flow__viewport", { timeout: 25000 });
      /*
       * O selo do Next em modo dev (`<nextjs-portal>`) fica no canto de baixo
       * e, a 390 px, cobre a ÚLTIMA caixa da folha "Camadas" — o clique do
       * operador não chega lá. Ele não é produto: a guarda sobe `next dev`
       * porque é o que ela tem, não porque o operador usa dev. Some com ele
       * pelo CSS, e os erros de página continuam sendo colhidos pelo
       * `pageerror` acima (nada é silenciado, só um selo de ferramenta sai da
       * frente).
       */
      await esconderSeloDoNext(page);
      await page.waitForTimeout(1200);
      return { ctx, page, errosDePagina };
    } catch {
      await page.waitForTimeout(1000);
    }
  }
  /*
   * ── "NÃO APARECEU" É PRODUTO OU É CARGA? (achado MÉDIO 9) ───────────────
   *
   * Sob carga de outros agentes, "o canvas não apareceu em 4 tentativas"
   * aparecia na MESMA lista que "a aresta pinta na cor errada", e arrastava
   * seis falhas em cascata. Repetida sozinha, a mesma corrida ficava verde —
   * e um portão que fica vermelho por carga ensina a repetir até passar.
   *
   * A fronteira: se a PÁGINA lançou erro, o produto quebrou (falha). Se não
   * lançou nada e simplesmente não coube no tempo, a guarda não conseguiu
   * medir (impedimento, saída 2, com o nome da largura). Nunca verde.
   */
  const chaveDaPagina = `${caso.largura}x${caso.altura}`;
  if (errosDePagina.length > 0) {
    exigir(
      false,
      `${chaveDaPagina}: o canvas do grafo não apareceu e a página lançou ${String(errosDePagina.length)} erro(s): ${errosDePagina[0] ?? ""}`,
    );
  } else {
    naoConsegui(
      `${chaveDaPagina}: o canvas do grafo não apareceu em 5 tentativas e a página não lançou erro nenhum — máquina carregada, não produto reprovado`,
    );
  }
  await page.waitForTimeout(500);
  return { ctx, page, errosDePagina, semCanvas: true };
}

/** Quanto da faixa "Hoje" está dentro da janela de visão, em px. */
async function medirHoje(page, alturaDaJanela) {
  return page.evaluate((vh) => {
    const sec = document.querySelector('section[aria-label="Prioridades de hoje"]');
    if (!sec) return { existe: false, visivel: 0 };
    const r = sec.getBoundingClientRect();
    return {
      existe: true,
      topo: Math.round(r.top),
      altura: Math.round(r.height),
      visivel: Math.round(Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))),
    };
  }, alturaDaJanela);
}

const transformDoCanvas = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".react-flow__viewport");
    return el ? getComputedStyle(el).transform : null;
  });

/**
 * O gesto do operador: seis cliques em "Aumentar zoom". Devolve a trilha
 * inteira — nenhum passo pode DESCER, e o fim tem de ser o teto.
 */
async function gestoDeZoom(page) {
  const botao = page.locator('button[aria-label="Aumentar zoom"]').first();
  if ((await botao.count()) === 0) return { trilha: [], achouBotao: false, alcancavel: false, fim: null };
  const trilha = [escalaDe(await transformDoCanvas(page))];
  for (let i = 0; i < 6; i++) {
    try {
      await botao.click({ timeout: 10000 });
    } catch {
      /*
       * ── "INALCANÇÁVEL" SE MEDE, NÃO SE INFERE DE UM TEMPO ESGOTADO ─────
       *
       * A folha modal do celular cobre o canvas inteiro — ali o operador
       * REALMENTE não alcança o zoom, e isso não é defeito. Mas até a rodada
       * 12 o veredito "inalcançável" saía do TEMPO do clique, e sob carga o
       * clique estoura sem nada estar cobrindo nada: foi assim que
       * `1280x800: §11 o botão "Aumentar zoom" ficou inalcançável` apareceu
       * numa corrida e sumiu na repetição (achado MÉDIO 9).
       *
       * Agora pergunta-se ao DOM quem está por cima do botão. Coberto de
       * fato → `alcancavel: false`, e quem chama confere se é a folha modal.
       * Ninguém por cima → o clique só não coube no tempo: impedimento com
       * nome, nunca uma reprovação de produto disfarçada.
       */
      const cobertura = await botao.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const acima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return {
          livre: acima === el || el.contains(acima),
          quem: acima === null ? "nada" : `${acima.tagName.toLowerCase()}.${String(acima.className).slice(0, 40)}`,
        };
      });
      if (cobertura.livre) {
        naoConsegui(
          `o clique em "Aumentar zoom" não voltou em 10 s e NADA está por cima do botão (${cobertura.quem}) — máquina carregada, não produto reprovado`,
        );
        return { trilha, achouBotao: true, alcancavel: true, fim: escalaDe(await transformDoCanvas(page)), semMedida: true };
      }
      return { trilha, achouBotao: true, alcancavel: false, fim: null };
    }
    await page.waitForTimeout(150);
    trilha.push(escalaDe(await transformDoCanvas(page)));
  }
  await page.waitForTimeout(1500);
  const fim = escalaDe(await transformDoCanvas(page));
  trilha.push(fim);
  return { trilha, achouBotao: true, alcancavel: true, fim };
}

/**
 * ── §15b/§15c · A GUARDA SÓ SABIA DAR ZOOM PARA DENTRO (rodada 15, ALTO 5) ─
 *
 * `gestoDeZoom` clica seis vezes em "Aumentar zoom"; **"Diminuir zoom" não
 * aparecia uma única vez neste arquivo**. A metade de baixo do eixo — de
 * 0,849 até `ZOOM_MINIMO` — nunca era exercida, e é exatamente a faixa em que
 * rodadas anteriores acharam glifo pequeno demais e traço triplo virando
 * borrão. O crítico fechou o buraco com uma linha (`if (zoomSeguro < 0.6)
 * return null` em `v3-edge.tsx`): dois cliques em afastar e as 10 arestas
 * viravam 0, com a guarda verde.
 *
 * Esta função exerce o eixo NOS DOIS SENTIDOS, até a ponta derivada do
 * produto (o piso `ZOOM_MINIMO` para fora, o teto `maxZoom` para dentro). O
 * botão vira `disabled` na ponta, então o laço para quando o zoom deixa de
 * andar — e a trilha inteira volta, para quem chama exigir que ela nunca ande
 * ao contrário e que o fim seja a ponta.
 *
 * `gestoDeZoom` (seis cliques) continua existindo e continua sendo o gesto que
 * §3 e §5 medem: seis cliques é o gesto do operador, e chegar ao teto em seis
 * é a promessa daquela seção. Este aqui não tem número de cliques declarado —
 * o que ele cobra é a PONTA, e seis cliques não saem do piso até o teto
 * (0,5 × 1,2⁶ = 1,49).
 */
async function gestoDeZoomAteAPonta(page, sentido, alvo, assentarMs = 1200, passoMs = 150) {
  const nome = sentido === "fora" ? "Diminuir zoom" : "Aumentar zoom";
  const botao = page.locator(`button[aria-label="${nome}"]`).first();
  if ((await botao.count()) === 0) {
    return { trilha: [], achouBotao: false, alcancavel: false, fim: null, nome };
  }
  const trilha = [escalaDe(await transformDoCanvas(page))];
  for (let i = 0; i < 20; i += 1) {
    try {
      await botao.click({ timeout: 10000 });
    } catch {
      /* Mesma fronteira de `gestoDeZoom` (achado MÉDIO 9): "inalcançável" se
         mede no DOM, nunca se infere de um tempo esgotado. */
      const cobertura = await botao.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const acima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return {
          livre: acima === el || el.contains(acima),
          desabilitado: el.disabled === true,
          quem: acima === null ? "nada" : `${acima.tagName.toLowerCase()}.${String(acima.className).slice(0, 40)}`,
        };
      });
      if (cobertura.desabilitado) break;
      if (cobertura.livre) {
        naoConsegui(
          `o clique em "${nome}" não voltou em 10 s e NADA está por cima do botão (${cobertura.quem}) — máquina carregada, não produto reprovado`,
        );
        return { trilha, achouBotao: true, alcancavel: true, fim: escalaDe(await transformDoCanvas(page)), semMedida: true, nome };
      }
      return { trilha, achouBotao: true, alcancavel: false, fim: null, nome };
    }
    await page.waitForTimeout(passoMs);
    const agora = escalaDe(await transformDoCanvas(page));
    trilha.push(agora);
    if (agora === null) continue;
    if (sentido === "fora" ? agora <= alvo + 1e-3 : agora >= alvo - 1e-3) break;
  }
  await page.waitForTimeout(assentarMs);
  const fim = escalaDe(await transformDoCanvas(page));
  trilha.push(fim);
  return { trilha, achouBotao: true, alcancavel: true, fim, nome };
}

/**
 * O DESENHO, remedido depois de um gesto qualquer: o canvas contra o universo
 * derivado do dado bruto (§12) e a prova de que alguma aresta continua
 * PINTANDO de verdade (§15). É o par que a rodada 15 passou a exigir também
 * depois do zoom PARA FORA (ALTO 5) e depois de um redimensionamento DE
 * VERDADE (ALTO 4) — os dois gestos em que o produto podia esvaziar o grafo
 * com a guarda verde.
 */
async function remedirODesenhoDepoisDoGesto(page, chave, estado, camadasAtivas) {
  const caixaDoCanvas = await page.evaluate(() => {
    const el = document.querySelector(".react-flow");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, largura: r.width, altura: r.height };
  });
  const leitura = await page.evaluate(LEITURA_DAS_ARESTAS);
  const contrato = await lerContratoDoCanvas(page);
  const dado = medirCanvasContraOUniverso(chave, estado, contrato, leitura.arestas, camadasAtivas);
  const pintura = await medirPinturaLeve(
    page,
    chave,
    estado,
    leitura.arestas,
    leitura.cartoes,
    caixaDoCanvas,
  );
  return `${dado} · ${pintura}`;
}

/**
 * ── §6b · A LARGURA DE "ARRASTAR A JANELA" (achado ALTO 4 da rodada 15) ────
 *
 * Fica na MESMA faixa de layout de quem chega (desktop continua desktop,
 * celular continua celular) e muda 180 px — noventa vezes o ruído de 2 px que
 * §5 mede, e acima de qualquer limiar razoável de ouvinte de `resize`. É o
 * gesto do operador que arrasta a borda da janela, e é depois dele que o
 * desenho passa a ser remedido.
 */
function larguraDeArrastarAJanela(caso) {
  if (!caso.desktop) return caso.largura + 180;
  return caso.largura - 180 >= 1024 ? caso.largura - 180 : caso.largura + 180;
}

/**
 * 2 px de ruído de tamanho não podem apagar o gesto. A largura de ruído nunca
 * atravessa o corte de 1024: atravessar troca o layout inteiro, e aí
 * reenquadrar é o certo — não é isto que se mede aqui.
 */
function larguraDeRuidoPara(caso) {
  return caso.largura - 2 >= 1024 || !caso.desktop ? caso.largura - 2 : caso.largura + 2;
}

// ═══════════════════════════════════════════════════════════════════════════
// §7 · TODA ARESTA DESENHADA PINTA DE VERDADE  (achado CRÍTICO)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * `papel` é o que decide a COR do traço em `corDaAresta` (`aresta-svg.tsx`):
 * destaque vence crítico, que vence a camada base. A classificação aqui
 * espelha aquela função — e a cor computada de cada traço é conferida contra
 * a tabela hex derivada, então divergir das duas é reprovar.
 */
const LEITURA_DAS_ARESTAS = `(() => {
  const saida = [];
  for (const g of document.querySelectorAll(".react-flow g[data-camada]")) {
    const path = g.querySelector("path.lb-edge-path");
    if (!path) { saida.push({ id: g.getAttribute("data-aresta-id"), semPath: true }); continue; }
    const papel = g.classList.contains("lb-edge-destacada")
      ? "destacada"
      : g.getAttribute("data-critica") === "true" ? "critico" : g.getAttribute("data-camada");
    saida.push({
      id: g.getAttribute("data-aresta-id"),
      camada: g.getAttribute("data-camada"),
      origem: g.getAttribute("data-origem"),
      destino: g.getAttribute("data-destino"),
      critica: g.getAttribute("data-critica") === "true",
      esmaecida: g.getAttribute("data-esmaecida") === "true",
      papel: papel,
      corComputada: getComputedStyle(path).stroke,
      corEsperada: window.__lbp4.corEsperada(path, "stroke"),
      retrato: window.__lbp4.retrato(g),
      pontos: window.__lbp4.pontosDaAresta(path, 20),
      extremos: window.__lbp4.extremosDaAresta(path),
      caixaDoRotulo: (() => {
        const t = g.querySelector(".lb-edge-label");
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return { x: r.x, y: r.y, largura: r.width, altura: r.height };
      })(),
      nTracos: g.querySelectorAll("path.lb-edge-path").length,
      tracejado: path.getAttribute("stroke-dasharray") || "",
    });
  }
  return { arestas: saida, cartoes: window.__lbp4.caixasDosCartoes() };
})()`;

// ═══════════════════════════════════════════════════════════════════════════
// MÉDIO 5 · O TRAÇO LIGA OS DOIS CARTÕES QUE ELE DIZ LIGAR
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Nenhuma seção comparava os EXTREMOS do traço com os cartões que
 * `data-origem`/`data-destino` nomeiam. O crítico trocou o destino de uma
 * aresta no roteador (uma linha) e o ❌ da obsolescência foi pintado em cima
 * de "Daily standup" enquanto o atributo, a lista acessível e o dado diziam
 * "Arquivar docs antigos" — verde a 1024, 1280, 1440 e 1920.
 *
 * A régua: a distância do extremo até a CAIXA do cartão nomeado, em px de
 * tela. Zero quando o ponto está dentro ou encostado; cresce com o desvio. E,
 * além da distância, o cartão nomeado tem de ser o MAIS PERTO de todos — um
 * traço que termina em cima do cartão errado erra as duas coisas.
 *
 * O teto é folgado de propósito (o roteador recua a ponta para o glifo caber,
 * e a tripla do crítico desloca o path lateralmente): medido na árvore
 * honesta, o pior extremo ficou a 7 px do cartão nomeado nas cinco larguras.
 */
const FOLGA_DO_EXTREMO_PX = 40;

function distanciaAteACaixa(ponto, caixa) {
  const dx = Math.max(caixa.x - ponto.x, 0, ponto.x - (caixa.x + caixa.largura));
  const dy = Math.max(caixa.y - ponto.y, 0, ponto.y - (caixa.y + caixa.altura));
  return Math.hypot(dx, dy);
}

/** Problemas de "este traço liga os cartões que ele nomeia?" — lista vazia = tudo certo. */
function conferirExtremos(a, cartoes) {
  const problemas = [];
  if (!a.extremos) {
    problemas.push(`${a.id}: não consegui ler os extremos do "d" do traço — medida impossível é reprovação`);
    return problemas;
  }
  for (const [ponta, ponto, id] of [
    ["origem", a.extremos.inicio, a.origem],
    ["destino", a.extremos.fim, a.destino],
  ]) {
    const caixa = cartoes[id];
    if (!caixa) {
      problemas.push(`${a.id}: a ${ponta} "${String(id)}" não tem cartão no canvas`);
      continue;
    }
    const daNomeada = distanciaAteACaixa(ponto, caixa);
    let maisPerto = id;
    let menor = daNomeada;
    for (const [outro, c] of Object.entries(cartoes)) {
      const d = distanciaAteACaixa(ponto, c);
      if (d < menor - 1) {
        menor = d;
        maisPerto = outro;
      }
    }
    if (daNomeada > FOLGA_DO_EXTREMO_PX) {
      problemas.push(
        `${a.id}: a ponta de ${ponta} do traço está a ${daNomeada.toFixed(1)}px do cartão "${String(id)}" que o atributo nomeia (teto ${String(FOLGA_DO_EXTREMO_PX)}px) — o traço é desenhado entre outro par de cartões`,
      );
    } else if (maisPerto !== id) {
      problemas.push(
        `${a.id}: a ponta de ${ponta} está a ${daNomeada.toFixed(1)}px do cartão nomeado "${String(id)}" e a ${menor.toFixed(1)}px de "${maisPerto}" — o traço encosta no cartão errado`,
      );
    }
  }
  return problemas;
}

/**
 * ── O SELETOR DA ARESTA É ANCORADO NO CANVAS (achado desta rodada, saído do
 *    próprio BAIXO 6) ────────────────────────────────────────────────────
 *
 * `g[data-camada]` solto pega TAMBÉM as amostras da legenda: `AmostraDeAresta`
 * desenha o mesmo `ArestaSvgGroup` de produção ao lado de cada checkbox do
 * painel "Camadas" e na tira da "Legenda" — com `data-camada`, `data-critica`
 * e `data-aresta-id="amostra-…"`. Enquanto §7–§10 só rodavam na tela fechada,
 * ninguém notava; ao medi-las com os popovers ABERTOS (BAIXO 6), a guarda
 * passou a contar 10 e 12 arestas onde o dado tem 7, e a reprovar as amostras
 * por não estarem na lista acessível — que é o certo para uma aresta e
 * absurdo para uma legenda.
 *
 * A aresta do grafo é a que vive DENTRO do canvas. As amostras da legenda são
 * conferidas por onde elas de fato são o produto: o teste de render
 * (`tests/unit/aresta-svg-render.test.tsx`).
 */
const SELETOR_DA_ARESTA = ".react-flow g[data-camada]";

const RAIO_DA_AMOSTRA = 4;
const RAIO_DO_PERFIL = 14;

/**
 * Quantos pixels do traço precisam chegar ao piso de contraste para a aresta
 * contar como VISÍVEL (rodada 12).
 *
 * Um só bastaria para o lado lógico — mas um pixel isolado pode ser ruído de
 * compressão ou a franja de subpixel do rótulo. Quatro é o mesmo número que
 * `PISO_DE_PIXEIS_NA_COR` já usa para a cor cheia, pela mesma razão, e foi
 * medido contra os dois lados nesta rodada (números na saída `visív` de §7):
 * a árvore honesta fica ordens de grandeza acima nas cinco larguras, e a
 * sabotagem de `opacity: 0.12` fica em ZERO.
 *
 * O PISO DE CONTRASTE não está aqui de propósito: ele é lido de
 * `scripts/checar-contraste.mjs` (`CONTRATO.pisoDeContraste`). Este número é
 * "quantos pixels", não "quão visível" — e "quão visível" é a régua da casa,
 * não uma constante desta guarda.
 */
const PISO_DE_PIXEIS_VISIVEIS = 4;

/**
 * O GLIFO de fim passa pelo caminho rápido — os mesmos 3:1 do traço — quando
 * ele tem pixels de sobra no piso. A seta da sucessão e o ❌ da obsolescência
 * passam por aqui folgados (medido nesta rodada: dezenas de pixels acima do
 * piso). O círculo da correlação não passa, e o motivo é oclusão, não
 * opacidade: ver o bloco em §9.
 */
const PISO_DE_PIXEIS_VISIVEIS_DO_GLIFO = 4;

/**
 * Quantos pixels UM dos três traços da tripla tem de mover ao ser escondido
 * sozinho (§8b). Baixo de propósito: a linha lateral tem 2 px de mundo e, em
 * zoom baixo, pinta pouco — o que se exige aqui é que ela exista na tela, não
 * que seja grossa. A largura da faixa inteira já é cobrada pela régua 1 de §8.
 */
const PISO_DE_PIXEIS_DE_UM_TRACO = 4;

/**
 * O caminho lento do glifo ocluído: o α DE PICO dele contra o α de pico do
 * TRAÇO DA MESMA ARESTA, medido na mesma tela. Os dois saem do mesmo
 * componente, com a mesma cor e a mesma cadeia de `opacity`.
 *
 * Medido nesta rodada, a 1440×900: círculo da correlação α 0,70 contra traço
 * α 1,00 — razão 0,70. Com `fill-opacity: 0.12` no glifo, a razão vai a ~0,08.
 * 0,35 fica no meio, 2× abaixo do honesto e 4× acima da sabotagem.
 */
const FRACAO_MINIMA_DO_ALFA_DO_TRACO = 0.35;

/** `#RRGGBB` → `rgb(r, g, b)`, para comparar com o que o motor devolve. */
function hexEmRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${String((n >> 16) & 255)}, ${String((n >> 8) & 255)}, ${String(n & 255)})`;
}

/** `rgb(r, g, b)` (o que `getComputedStyle` devolve) → `#RRGGBB`. `null` se não der. */
function rgbEmHex(cor) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(String(cor ?? ""));
  if (!m) return null;
  const parte = (x) => Math.max(0, Math.min(255, Math.round(Number(x)))).toString(16).padStart(2, "0");
  return `#${parte(m[1])}${parte(m[2])}${parte(m[3])}`.toUpperCase();
}

/**
 * `papeisExigidos` é o piso do universo NESTE estado da tela. O papel
 * "destacada" (o amarelo do predecessor) só existe com um nó selecionado —
 * então ele sai do piso do estado sem seleção e VOLTA, obrigatório, no estado
 * com seleção (§7b). É exceção declarada com conferência própria, nunca um
 * papel que some da conta e ninguém nota.
 */
async function medirPinturaDasArestas(
  page,
  chave,
  estado,
  papeisExigidos = CONTRATO.papeis,
  papeisComProvaDeCor = CONTRATO.papeis,
  esperaEsmaecidas = false,
) {
  const leitura = await page.evaluate(LEITURA_DAS_ARESTAS);
  const arestas = leitura.arestas;
  const cartoes = leitura.cartoes ?? {};
  const grupos = await page.$$(SELETOR_DA_ARESTA);
  const resumo = {};
  const problemas = [];
  const detalhePorAresta = [];
  const bandasPorCritica = [];
  /*
   * O α DE PICO de cada traço, para §9 usar como REFERÊNCIA MEDIDA NA MESMA
   * TELA (é o mesmo recurso que §8 já usa para o traço triplo: comparar com
   * uma aresta simples medida ali, em vez de com uma constante escrita aqui).
   */
  const alfaPicoPorAresta = new Map();

  for (let i = 0; i < arestas.length; i += 1) {
    const a = arestas[i];
    const g = grupos[i];
    if (a.semPath || !g) {
      problemas.push(`${a.id}: o grupo da aresta não tem nenhum <path.lb-edge-path>`);
      continue;
    }
    resumo[a.papel] = resumo[a.papel] ?? { n: 0, pintam: 0 };
    resumo[a.papel].n += 1;

    // A cor DECLARADA tem de ser a do contrato — o pixel confere o resto.
    const esperadaNoContrato = hexEmRgb(CONTRATO.cores[a.papel] ?? "#000000");
    if (a.corComputada.replace(/\s/g, "") !== esperadaNoContrato.replace(/\s/g, "")) {
      problemas.push(
        `${a.id}: papel "${a.papel}" foi declarado em ${a.corComputada}, e o contrato (${CONTRATO.cores[a.papel]}) é ${esperadaNoContrato}`,
      );
    }

    /*
     * ── ALTO 1: E A COR QUE O NAVEGADOR COMPUTOU É DA FAMÍLIA PROMETIDA ───
     *
     * A linha acima confere o navegador contra o contrato, e o contrato sai
     * das duas tabelas do produto — trocar as duas no mesmo ato move os três
     * juntos. Esta confere o que o navegador computou contra a PROMESSA
     * (`src/lib/promessa-do-grafo.ts`), que não é nenhuma das duas: o traço
     * do caminho crítico, na tela, tem de ser VERMELHO. Medido pelo crítico
     * com a sabotagem de 2 linhas: 1661 → 832 pixels na cor do crítico, com
     * tudo verde.
     */
    const familiaPrometida = CONTRATO.familias[CONTRATO.familiaDoPapel[a.papel]];
    const hexComputado = rgbEmHex(a.corComputada);
    if (!familiaPrometida) {
      problemas.push(
        `${a.id}: o papel "${a.papel}" não tem família de cor prometida em src/lib/promessa-do-grafo.ts`,
      );
    } else if (hexComputado === null) {
      problemas.push(`${a.id}: não consegui ler a cor computada "${String(a.corComputada)}" como RGB`);
    } else if (!corNaFamiliaDaPromessa(hexComputado, familiaPrometida)) {
      const hsl = hexParaHsl(hexComputado);
      problemas.push(
        `${a.id}: o papel "${a.papel}" é prometido ${familiaPrometida.emPortugues} em src/lib/promessa-do-grafo.ts e o navegador pintou ${hexComputado} (matiz ${String(
          Math.round(hsl?.h ?? -1),
        )}°, saturação ${String((hsl?.s ?? 0).toFixed(2))}, luminância ${String((hsl?.l ?? 0).toFixed(2))})`,
      );
    }

    // MÉDIO 5: o traço começa e termina nos cartões que o próprio grupo nomeia.
    problemas.push(...conferirExtremos(a, cartoes));

    if (!Array.isArray(a.pontos) || a.pontos.length === 0) {
      problemas.push(
        `${a.id}: não consegui derivar nenhum ponto sobre o traço a partir do "d" do path — medida impossível é reprovação, não dispensa`,
      );
      continue;
    }
    const janela = janelaDosPontos(a.pontos, RAIO_DO_PERFIL + 3, page.viewportSize());
    if (janela === null) {
      problemas.push(
        `${a.id}: o traço inteiro ficou fora da janela de visão — não consegui medir, e isso é reprovação`,
      );
      continue;
    }
    const fotos = await fotosComESem(page, g, janela);
    if (fotos.erro) {
      if (ehErroDeAmbiente(fotos.erro)) naoConsegui(`${chave}${estado} · ${a.id}: ${fotos.erro}`);
      else problemas.push(`${a.id}: ${fotos.erro}`);
      continue;
    }
    let medidos = 0;
    let pintam = 0;
    let naCor = 0;
    let mudaram = 0;
    let peso = 0;
    let pesoVezesResiduo = 0;
    let piorResiduoForte = 0;
    let melhorContraste = 1;
    let pixeisVisiveis = 0;
    let alfaPicoDoTraco = 0;
    const bandas = {};
    let melhorPerfil = "";
    let maiorExtensao = -1;
    /*
     * A cor do CONTRATO (as duas tabelas de hex já casadas em
     * `derivarContrato`), crua — não a composta. O modelo de mistura
     * (`residuoDeMistura`) já resolve opacidade e fundo: o que o compositor
     * pinta é sempre `α·contrato + (1−α)·fundo real daquele pixel`.
     */
    const corDoContrato = hexEmRgb(CONTRATO.cores[a.papel] ?? "#000000");
    /*
     * A COR DO TRAÇO SE MEDE NO TRAÇO, LONGE DO TEXTO.
     *
     * Só a sinergia carrega um `<text>` dentro do grupo (o "%" do peso), e o
     * Chromium pinta texto com antialias de subpixel: as franjas de cor caem
     * FORA da reta fundo→cor, por construção. Medido na árvore honesta: essa
     * aresta — e só ela — ia a 8,6 de resíduo médio no desktop e a 20,1 a
     * 390 px, contra 0,2–0,7 de todas as outras. Não é a aresta pintando
     * errado; é o texto não ser um traço.
     *
     * Então os pontos cuja janelinha encosta na caixa do rótulo não votam na
     * COR (continuam contando em "pixels que mudam" e "pixels na cor"). Se
     * NENHUM ponto sobrar fora do rótulo, isso é reprovação logo abaixo — não
     * dispensa.
     */
    const caixa = a.caixaDoRotulo;
    for (const ponto of a.pontos) {
      const amostra = amostraNoPonto(
        fotos,
        ponto,
        a.corEsperada,
        RAIO_DA_AMOSTRA,
        corDoContrato,
        CONTRATO.pisoDeContraste,
      );
      if (!amostra.dentro) continue;
      medidos += 1;
      naCor += amostra.naCor;
      mudaram += amostra.mudaram;
      const encostaNoRotulo =
        caixa !== null &&
        caixa !== undefined &&
        ponto.x >= caixa.x - RAIO_DA_AMOSTRA &&
        ponto.x <= caixa.x + caixa.largura + RAIO_DA_AMOSTRA &&
        ponto.y >= caixa.y - RAIO_DA_AMOSTRA &&
        ponto.y <= caixa.y + caixa.altura + RAIO_DA_AMOSTRA;
      if (!encostaNoRotulo) {
        peso += amostra.peso;
        pesoVezesResiduo += amostra.pesoVezesResiduo;
        if (amostra.piorResiduoForte > piorResiduoForte) piorResiduoForte = amostra.piorResiduoForte;
        /*
         * A VISIBILIDADE (rodada 12) também sai SÓ do traço, fora da caixa do
         * rótulo — e aqui não é por causa do antialias de subpixel, é por
         * causa de uma porta: `stroke-opacity` apaga o TRAÇO e deixa o `<text>`
         * do "%" (que é `fill`) aceso. Contar os pixels do rótulo deixaria a
         * sinergia provar visibilidade com o texto dela. Nenhum ponto fora do
         * rótulo = `melhorContraste` fica em 1:1 = reprovação, que é o certo.
         */
        if (amostra.melhorContraste > melhorContraste) melhorContraste = amostra.melhorContraste;
        pixeisVisiveis += amostra.pixeisVisiveis;
        if (amostra.alfaPico > alfaPicoDoTraco) alfaPicoDoTraco = amostra.alfaPico;
      }
      if (amostra.naCor >= 1 && amostra.mudaram >= 2) pintam += 1;
      const perfil = perfilPerpendicular(fotos, ponto, { x: ponto.nx, y: ponto.ny }, RAIO_DO_PERFIL);
      const b = bandasDoPerfil(perfil);
      bandas[b.bandas] = (bandas[b.bandas] ?? 0) + 1;
      if (b.extensao > maiorExtensao) {
        maiorExtensao = b.extensao;
        melhorPerfil = perfil;
      }
    }
    if (medidos === 0) {
      problemas.push(
        `${a.id}: nenhum dos ${String(a.pontos.length)} pontos do traço caiu dentro da foto — não consegui medir, e isso é reprovação`,
      );
      continue;
    }
    const alfaOk = a.retrato.visivelHerdado && a.retrato.opacidadeAcumulada > 0;
    /*
     * DUAS RÉGUAS, E ELAS SÃO DIFERENTES DE PROPÓSITO (calibrado a 390 px):
     *
     * • POR ARESTA, exige-se PIXEL QUE MUDA — a única coisa que vale para toda
     *   aresta em toda largura. A 390 px o canvas tem 390×552 e onze cartões de
     *   150 px de tela: várias arestas correm quase inteiras ATRÁS de um
     *   cartão, e a parte que sobra é antialias puro. Medido: uma aresta de
     *   sucessão com 99 pixels que mudam ao esconder e ZERO pixels na cor
     *   cheia. Exigir cor ali reprovaria a oclusão, não o produto.
     * • POR PAPEL, exige-se que ao menos UMA aresta daquele papel também passe
     *   na COR — é o que impede "pinta qualquer coisa" de passar. Ver a
     *   conferência de `semCor`, abaixo.
     *
     * `opacity: 0`, `filter: opacity(0)` e a camada apagada caem na régua por
     * aresta: sem pixel que muda, nada passa.
     */
    const PISO_DE_PIXEIS_QUE_MUDAM = 12;
    const PISO_DE_PIXEIS_NA_COR = 4;
    const pintaDeVerdade = alfaOk && mudaram >= PISO_DE_PIXEIS_QUE_MUDAM;
    const pintaNaCor = pintaDeVerdade && naCor >= PISO_DE_PIXEIS_NA_COR;
    if (pintaDeVerdade) resumo[a.papel].pintam += 1;
    if (pintaNaCor) resumo[a.papel].naCor = (resumo[a.papel].naCor ?? 0) + 1;
    if (!pintaDeVerdade) {
      problemas.push(
        `${a.id} (papel "${a.papel}"): ${
          alfaOk ? "" : `alfa real 0 (opacidade acumulada ${a.retrato.opacidadeAcumulada.toFixed(3)}, visível herdado ${String(a.retrato.visivelHerdado)}) · `
        }${String(mudaram)} pixels mudam ao esconder (piso ${String(PISO_DE_PIXEIS_QUE_MUDAM)}), ${String(naCor)} pixels na cor ${a.corEsperada}, ${String(pintam)}/${String(medidos)} pontos do traço com as duas coisas`,
      );
    }
    /*
     * ── ALTO 1: A COR PINTADA DESTA ARESTA, NÃO A DECLARADA, NÃO A DO PAPEL
     *
     * `getComputedStyle(path).stroke` é DECLARAÇÃO; um `filter` mente na
     * PINTURA. E exigir a cor cheia uma vez por PAPEL deixa a segunda aresta
     * do papel mentir de graça — foi exatamente o buraco: uma aresta de
     * sucessão pintada de vermelho lia-se como caminho crítico, com
     * `sucessao=2/2` impresso na saída.
     *
     * Agora CADA aresta responde pela própria cor, e responde pelo modelo de
     * mistura: todo pixel que ela pinta tem de cair na reta "fundo real
     * daquele pixel → cor do contrato". Antialias e oclusão só mexem em α (a
     * posição na reta); trocar a cor tira o pixel da reta. O voto de cada
     * pixel é proporcional ao quanto ele mudou, então a ponta de antialias não
     * decide nada e o traço cheio decide tudo.
     */
    const residuoMedio = peso > 0 ? pesoVezesResiduo / peso : null;
    const corConfere = residuoMedio !== null && residuoMedio <= TOLERANCIA_DE_MISTURA;
    if (pintaDeVerdade && !corConfere) {
      problemas.push(
        `${a.id} (papel "${a.papel}"): a cor PINTADA não é a da camada — resíduo médio ${
          residuoMedio === null
            ? "NENHUM pixel de traço fora da caixa do rótulo para medir, e não medir é reprovar"
            : residuoMedio.toFixed(1)
        } contra o teto ${String(TOLERANCIA_DE_MISTURA)} (contrato ${CONTRATO.cores[a.papel]} = ${corDoContrato}, declarada ${a.corComputada}, pior pixel forte ${piorResiduoForte.toFixed(0)})`,
      );
    }
    if (pintaDeVerdade && corConfere) resumo[a.papel].corOk = (resumo[a.papel].corOk ?? 0) + 1;
    /*
     * ── A SEGUNDA PERGUNTA, A QUE FALTAVA: "DÁ PARA VER?" (rodada 12) ─────
     *
     * O modelo de mistura acima responde *"está na cor certa?"*: a distância
     * do pixel até a reta `B→C`. Ele NÃO responde *"está visível?"* — o
     * comentário dele diz isso por escrito ("antialias e oclusão só mexem em
     * α, a posição na reta"), e α não era medido em lugar nenhum. Qualquer
     * ponto da reta passava, **α perto de zero inclusive**.
     *
     * Medido pelo coordenador nesta entrega: `style={{ opacity: 0.12 }}` no
     * `<g>` da aresta deixou os CINCO portões verdes com o grafo quase
     * apagado — a sucessão caindo de 12,40:1 para 1,21:1 contra o canvas,
     * PIOR que o ALTO 4 que a rodada 11 acabara de fechar (1,27:1).
     *
     * A régua: o contraste WCAG do PIXEL COMPOSTO (a foto COM o traço) contra
     * o PIXEL DE FUNDO DO MESMO LUGAR (a foto SEM). É o que o olho recebe —
     * não o token declarado, que a opacidade não muda, e não a quantidade de
     * pixels que mudam, que é grande mesmo a 12%.
     *
     * Duas decisões que essa régua obriga:
     *
     * • **ONDE ela vale.** Oclusão foi o motivo legítimo da relaxação da
     *   rodada 11: aresta que corre atrás de um cartão tem pixels que somem, e
     *   a 390 px o traço tem menos de 1 px de tela e é antialias puro. Então a
     *   exigência é sobre o MELHOR pixel do traço — onde ele de fato aparece —
     *   e não sobre a média. Um traço legível em algum lugar é um traço.
     * • **"Não apareceu em lugar nenhum" é REPROVAÇÃO.** `melhorContraste`
     *   nasce em 1 (nenhum pixel mudou = nenhuma diferença = 1:1), abaixo de
     *   qualquer piso — então a aresta apagada cai aqui, e não por silêncio.
     *   E a conferência roda SEM depender de `pintaDeVerdade`: ela não pode
     *   ser pulada por uma checagem anterior ter falhado antes.
     *
     * O piso é `CONTRATO.pisoDeContraste` — lido de
     * `scripts/checar-contraste.mjs`, que é quem diz 3:1 para estas arestas.
     * Não sai daqui, e não sai do arquivo que decide a cor.
     */
    const visivel =
      melhorContraste >= CONTRATO.pisoDeContraste && pixeisVisiveis >= PISO_DE_PIXEIS_VISIVEIS;
    if (visivel) resumo[a.papel].visivel = (resumo[a.papel].visivel ?? 0) + 1;
    /* Aresta ESMAECIDA por filtro de fonte não responde ao piso de 3:1 — ela
       está apagada de propósito, e é isso que §17 mede. A exceção só existe no
       estado que a guarda liga o filtro (`esperaEsmaecidas`); fora dele,
       declarar-se esmaecida já é falha, conferida logo abaixo. */
    if (!visivel && !(esperaEsmaecidas && a.esmaecida)) {
      problemas.push(
        `${a.id} (papel "${a.papel}"): quase invisível — o MELHOR pixel do traço inteiro mede ${melhorContraste.toFixed(2)}:1 contra o fundo do próprio lugar (piso ${String(CONTRATO.pisoDeContraste)}:1, lido de scripts/checar-contraste.mjs) e ${String(pixeisVisiveis)} pixel(es) chegam lá (piso ${String(PISO_DE_PIXEIS_VISIVEIS)}). A cor DECLARADA continua ${a.corComputada}: a opacidade é aplicada na composição, e é por isso que a régua de tokens não vê`,
      );
    }
    alfaPicoPorAresta.set(a.id, alfaPicoDoTraco);
    if (a.papel === "critico") bandasPorCritica.push({ id: a.id, bandas, perfil: melhorPerfil, extensao: maiorExtensao });
    detalhePorAresta.push({
      id: a.id,
      papel: a.papel,
      medidos,
      pintam,
      naCor,
      mudaram,
      bandas,
      extensao: maiorExtensao,
      residuoMedio: residuoMedio === null ? null : Number(residuoMedio.toFixed(2)),
      piorResiduoForte,
      melhorContraste: Number(melhorContraste.toFixed(2)),
      pixeisVisiveis,
      alfaPicoDoTraco: Number(alfaPicoDoTraco.toFixed(3)),
    });
  }

  /*
   * ── BAIXO 13: O RÓTULO NÃO É ESCRITO EM CIMA DE TRAÇO NENHUM ───────────
   *
   * Olho de usuário do crítico: *"o rótulo '50%' da sinergia é desenhado em
   * cima do próprio traço tracejado (o colocador desvia de cartões, não de
   * arestas)"*. Era estrutural: o candidato nascia SOBRE a polilinha da
   * própria aresta, então o tracejado sempre atravessava os dígitos.
   *
   * A régua aqui é geométrica e usa o que §7 já leu: a caixa de tela de cada
   * rótulo desenhado, contra os pontos que ESTÃO SOBRE os traços de todas as
   * arestas. Um ponto de traço dentro da caixa de um rótulo é o rótulo escrito
   * por cima de uma linha.
   */
  for (const comRotulo of arestas) {
    const caixaR = comRotulo.caixaDoRotulo;
    if (!caixaR) continue;
    for (const outra of arestas) {
      if (!Array.isArray(outra.pontos)) continue;
      const dentro = outra.pontos.filter(
        (ponto) =>
          ponto.x >= caixaR.x &&
          ponto.x <= caixaR.x + caixaR.largura &&
          ponto.y >= caixaR.y &&
          ponto.y <= caixaR.y + caixaR.altura,
      );
      if (dentro.length > 0) {
        problemas.push(
          `o rótulo de ${comRotulo.id} é desenhado EM CIMA do traço de ${outra.id} (${String(dentro.length)} ponto(s) do traço dentro da caixa do texto) — texto sobre linha não é informação, é ruído com aparência de informação`,
        );
      }
    }
  }

  /*
   * ── MÉDIO 7: NINGUÉM SE DECLARA ESMAECIDO SEM FILTRO DE FONTE LIGADO ───
   *
   * `data-esmaecida` existe para §17 medir o esmaecimento de verdade. Nos
   * estados em que nenhum filtro de fonte está ligado — que são todos, menos
   * §17 — nenhuma aresta pode estar esmaecida. Sem esta trava, "declarar-se
   * esmaecida" viraria a porta de saída da régua de visibilidade.
   */
  if (!esperaEsmaecidas) {
    const esmaecidasIndevidas = arestas.filter((a) => a.esmaecida);
    if (esmaecidasIndevidas.length > 0) {
      problemas.push(
        `${String(esmaecidasIndevidas.length)} aresta(s) se declaram esmaecidas sem nenhum filtro de fonte ligado: ${esmaecidasIndevidas.map((a) => a.id).slice(0, 3).join(", ")}`,
      );
    }
  }

  // Piso do universo: cada papel do contrato tem de ter aresta na tela.
  const papeisNaTela = Object.keys(resumo);
  const faltando = papeisExigidos.filter((p) => !papeisNaTela.includes(p));
  /*
   * Nenhum papel pode existir na tela sem que ao menos UMA aresta dele pinte
   * na cor que o contrato declara — senão "pinta alguma coisa" bastaria.
   *
   * `papeisComProvaDeCor` existe porque o estado COM SELEÇÃO não é o lugar de
   * provar cor: ao selecionar um nó, uma das arestas de sucessão VIRA
   * "destacada", e a 390 px a que sobra pode estar quase inteira atrás de um
   * cartão (medido: 99 pixels que mudam ao esconder, 0 na cor cheia). A cor de
   * cada papel se prova no estado SEM seleção, na mesma largura, onde todos
   * têm todas as suas arestas; o estado com seleção prova a cor só do papel
   * que ele é o único a produzir — "destacada".
   */
  const semCor = papeisNaTela
    .filter((p) => papeisComProvaDeCor.includes(p))
    .filter((p) => (resumo[p]?.naCor ?? 0) === 0);
  /* `pintam/n` e, entre parênteses, quantas dessas têm a COR PINTADA certa
     (ALTO 1) — as duas contas, nunca só a primeira.
     Observação do crítico da rodada 15, sem sabotagem: `destacada=0/0(cor 0,
     visív 0)` aparecia DENTRO de uma linha verde nos estados sem seleção. O
     número estava certo e a leitura, não — zero sobre zero parece "medi e
     estava tudo lá". Papel que não existe naquele estado passa a dizer isso
     por extenso, e o piso de papéis (`papeisExigidos`) continua sendo quem
     decide se a ausência é legítima. */
  const linha = CONTRATO.papeis
    .map((p) =>
      (resumo[p]?.n ?? 0) === 0
        ? `${p}=SEM ARESTA neste estado (nada medido)`
        : `${p}=${String(resumo[p]?.pintam ?? 0)}/${String(resumo[p]?.n ?? 0)}(cor ${String(resumo[p]?.corOk ?? 0)}, visív ${String(resumo[p]?.visivel ?? 0)})`,
    )
    .join(" · ");

  exigir(
    problemas.length === 0 && faltando.length === 0 && semCor.length === 0 && arestas.length > 0,
    `${chave}${estado}: §7 a pintura das arestas — ${
      arestas.length === 0 ? "NENHUMA aresta no DOM; " : ""
    }${
      faltando.length > 0
        ? `papel sem NENHUMA aresta na tela (medir zero nunca é sucesso): ${faltando.join(", ")}; `
        : ""
    }${
      semCor.length > 0
        ? `papel em que NENHUMA aresta pinta na cor declarada: ${semCor.join(", ")}; `
        : ""
    }${problemas.slice(0, 3).join(" ; ")}`,
  );

  return { resumo, linha, bandasPorCritica, detalhePorAresta, arestas, cartoes, alfaPicoPorAresta };
}

// ═══════════════════════════════════════════════════════════════════════════
// §12 · O CANVAS × O DADO, NOS DOIS SENTIDOS  (achado ALTO 2 da rodada 11)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * O crítico apagou UMA aresta do caminho crítico do canvas com uma linha
 * (`return []` dentro do `useMemo` de `edges`) e os cinco portões ficaram
 * verdes — a própria saída imprimindo `critico=1/1` em vez de `2/2`, um traço
 * triplo em vez de dois, 6 arestas em vez de 7, e chamando isso de sucesso.
 *
 * Por quê: §10 perguntava só *"toda aresta DESENHADA está na lista?"*, nunca o
 * contrário, e o piso de §7 era "cada papel tem ≥ 1 aresta" — nunca uma
 * CONTAGEM contra o dado. Um grafo com 40 tarefas e 80 arestas passaria com
 * os mesmos números de um com 11 e 7.
 *
 * O dado entra pelo `data-lb-contrato-do-canvas` que o produto publica
 * (`dependency-graph.tsx`): sai de `arestasVisuais` filtrado pelas camadas
 * ativas, sem passar pelo `useMemo` que monta as arestas do ReactFlow. Aqui
 * os dois conjuntos são comparados NOS DOIS SENTIDOS, por id — e a camada e a
 * flag de crítica de cada aresta desenhada têm de bater com o dado também.
 */
async function lerContratoDoCanvas(page) {
  return page.evaluate(() => {
    const el = document.querySelector("[data-lb-contrato-do-canvas]");
    if (!el) return null;
    const cru = el.getAttribute("data-lb-contrato-do-canvas");
    try {
      return JSON.parse(cru);
    } catch (e) {
      return { erroDeLeitura: String(e && e.message ? e.message : e) };
    }
  });
}

function medirCanvasContraOUniverso(chave, estado, contrato, arestas, camadasAtivas) {
  const esperadas = universoNasCamadas(UNIVERSO, camadasAtivas);
  const problemas = [];
  const desenhadas = arestas.filter((a) => !a.semPath);
  /* §21 precisa saber quanto a GUARDA chegou a ver em cada largura: é o piso
     que impede uma sentinela de nascer encolhida e concordar com a tela por
     encolher junto. Registrado aqui porque §12 roda em TODO estado medido. */
  registrarDesenhoVisto(chave, desenhadas.length);
  const porId = new Map(desenhadas.map((a) => [a.id, a]));
  const esperadasPorId = new Map(esperadas.map((e) => [e.id, e]));

  // ── 1. O DESENHO × O UNIVERSO DERIVADO DO CPM E DO DADO BRUTO ───────────
  const faltando = esperadas.filter((e) => !porId.has(e.id));
  if (faltando.length > 0) {
    problemas.push(
      `${String(faltando.length)} aresta(s) que o DADO BRUTO manda desenhar não estão no canvas: ${faltando
        .map((e) => `${e.id} (camada "${e.camada}"${e.critica ? ", caminho crítico" : ""})`)
        .slice(0, 3)
        .join(" ; ")}`,
    );
  }
  const sobrando = desenhadas.filter((a) => !esperadasPorId.has(a.id));
  if (sobrando.length > 0) {
    problemas.push(
      `${String(sobrando.length)} aresta(s) desenhadas que o DADO BRUTO não pede: ${sobrando.map((a) => a.id).slice(0, 3).join(", ")}`,
    );
  }
  for (const a of desenhadas) {
    const e = esperadasPorId.get(a.id);
    if (!e) continue;
    if (e.camada !== a.camada) {
      problemas.push(`${a.id}: o dado bruto diz camada "${e.camada}" e o canvas desenhou "${String(a.camada)}"`);
    }
    if (Boolean(e.critica) !== Boolean(a.critica)) {
      problemas.push(
        `${a.id}: o CPM diz caminho crítico = ${String(Boolean(e.critica))} e o canvas desenhou ${String(Boolean(a.critica))}`,
      );
    }
    if (e.origem !== a.origem || e.destino !== a.destino) {
      problemas.push(
        `${a.id}: o dado bruto liga "${String(e.origem)}"→"${String(e.destino)}" e o canvas nomeia "${String(a.origem)}"→"${String(a.destino)}"`,
      );
    }
  }
  // Contagens por camada, contra o dado — nunca contra um piso de 1.
  const contar = (lista) => {
    const m = {};
    for (const x of lista) m[x.camada] = (m[x.camada] ?? 0) + 1;
    return m;
  };
  const noDado = contar(esperadas);
  const naTela = contar(desenhadas);
  for (const camada of new Set([...Object.keys(noDado), ...Object.keys(naTela)])) {
    if ((noDado[camada] ?? 0) !== (naTela[camada] ?? 0)) {
      problemas.push(
        `camada "${camada}": o dado bruto tem ${String(noDado[camada] ?? 0)} aresta(s) e o canvas desenhou ${String(naTela[camada] ?? 0)}`,
      );
    }
  }
  const criticasNoDado = esperadas.filter((e) => e.critica).length;
  const criticasNaTela = desenhadas.filter((a) => a.critica).length;
  if (criticasNoDado !== criticasNaTela) {
    problemas.push(
      `caminho crítico: o CPM tem ${String(criticasNoDado)} aresta(s) nesta combinação de camadas e o canvas desenhou ${String(criticasNaTela)}`,
    );
  }

  /*
   * ── 2. O TERCEIRO LADO: O QUE O COMPONENTE DECLARA ──────────────────────
   *
   * `data-lb-contrato-do-canvas` deixou de ser "o dado" (ALTO 1) e passou a
   * ser um terceiro depoimento: é ele que denuncia o componente DECLARAR uma
   * coisa e DESENHAR outra, e é dele que sai o `temRota`, que só o layout
   * sabe. Ele é conferido contra o universo derivado, igual ao desenho — não
   * contra o desenho, que era o vício.
   */
  if (contrato === null || contrato.erroDeLeitura || !Array.isArray(contrato.esperadas)) {
    problemas.push(
      `não consegui ler o contrato publicado pelo componente (data-lb-contrato-do-canvas)${
        contrato?.erroDeLeitura ? `: ${contrato.erroDeLeitura}` : ""
      }`,
    );
  } else {
    const noContrato = Array.isArray(contrato.camadasAtivas) ? [...contrato.camadasAtivas].sort() : null;
    if (noContrato === null || noContrato.join(",") !== [...camadasAtivas].sort().join(",")) {
      problemas.push(
        `o componente declara as camadas [${noContrato === null ? "ilegíveis" : noContrato.join("+")}] e as marcadas no painel são [${[...camadasAtivas].sort().join("+")}]`,
      );
    }
    const semRota = contrato.esperadas.filter((e) => !e.temRota);
    if (semRota.length > 0) {
      problemas.push(
        `${String(semRota.length)} aresta(s) ficaram sem rota no layout e o canvas cala sobre elas: ${semRota.map((e) => e.id).slice(0, 3).join(", ")}`,
      );
    }
    const declaradasPorId = new Map(contrato.esperadas.map((e) => [e.id, e]));
    const naoDeclaradas = esperadas.filter((e) => !declaradasPorId.has(e.id));
    if (naoDeclaradas.length > 0) {
      problemas.push(
        `${String(naoDeclaradas.length)} aresta(s) do dado bruto que o componente NEM declara: ${naoDeclaradas.map((e) => e.id).slice(0, 3).join(", ")}`,
      );
    }
    const declaradasASobrar = contrato.esperadas.filter((e) => !esperadasPorId.has(e.id));
    if (declaradasASobrar.length > 0) {
      problemas.push(
        `${String(declaradasASobrar.length)} aresta(s) declaradas pelo componente que o dado bruto não pede: ${declaradasASobrar.map((e) => e.id).slice(0, 3).join(", ")}`,
      );
    }
    for (const e of esperadas) {
      const d = declaradasPorId.get(e.id);
      if (!d) continue;
      if (Boolean(d.critica) !== Boolean(e.critica) || d.camada !== e.camada) {
        problemas.push(
          `${e.id}: o componente declara camada "${String(d.camada)}"/crítica ${String(Boolean(d.critica))} e o CPM + dado bruto dizem "${e.camada}"/${String(Boolean(e.critica))}`,
        );
      }
    }
  }

  exigir(
    problemas.length === 0 && desenhadas.length > 0 && esperadas.length > 0,
    `${chave}${estado}: §12 o canvas × o DADO BRUTO — ${
      desenhadas.length === 0 ? "NENHUMA aresta desenhada; " : ""
    }${esperadas.length === 0 ? "o universo derivado ficou VAZIO nesta combinação de camadas; " : ""}${problemas.slice(0, 4).join(" ; ")}`,
  );
  return `${String(desenhadas.length)}/${String(esperadas.length)} do dado bruto · críticas ${String(criticasNaTela)}/${String(criticasNoDado)} · ${String(UNIVERSO.length)} no grafo inteiro`;
}

// ═══════════════════════════════════════════════════════════════════════════
// §13 · DESLIGAR UMA CAMADA APAGA AS ARESTAS DELA  (achado ALTO 3)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * `ligarTodasAsCamadas(page)` aparecia três vezes nesta guarda e NADA, em
 * nenhuma das onze seções, chegava a desligar. O sentido OFF do único
 * controle que a peça nomeia nunca era exercido — e fixar `camadasAtivas` nas
 * cinco (uma linha em `dependency-graph.tsx`) deixava os cinco portões
 * verdes. `filtrarArestasPorCamada` tinha teste de unidade impecável; a
 * FIAÇÃO entre o checkbox e o canvas não tinha nenhum.
 *
 * Aqui o que se mede é a fiação, e a previsão sai do CANVAS + do CHECKBOX,
 * nunca do estado interno: com as cinco ligadas, cada aresta desenhada
 * declara a camada base (`data-camada`) e se é do caminho crítico
 * (`data-critica`). Desmarcar a camada L tem de deixar na tela exatamente as
 * arestas cujo conjunto de camadas ainda toca alguma camada marcada.
 *
 * "Caminho crítico" é o caso próprio: desmarcá-la NÃO apaga aresta nenhuma
 * (uma sucessão crítica continua sendo sucessão — OR, não AND); o que ela
 * apaga é o traço triplo. Então ali a régua é outra, declarada, e conferida.
 */
async function idsDesenhadosComCamada(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".react-flow g[data-camada]")].map((g) => ({
      id: g.getAttribute("data-aresta-id"),
      camada: g.getAttribute("data-camada"),
      critica: g.getAttribute("data-critica") === "true",
    })),
  );
}

/** Abre o painel "Camadas" e devolve o locator das caixas, com os rótulos. */
async function abrirPainelDeCamadas(page) {
  const pill = page.locator('button[aria-label="Camadas"]').first();
  if ((await pill.count()) === 0) return null;
  if ((await pill.getAttribute("aria-expanded")) !== "true") await pill.click();
  await page.waitForSelector('[role="dialog"][aria-label="Camadas do grafo"]', { timeout: 10000 });
  /*
   * O texto do rótulo vem SEM a amostra de aresta: cada `label` carrega um
   * `<svg>` desenhado pelo mesmo componente de produção, e a amostra de
   * sinergia tem o "50%" dentro — `textContent` cru devolvia
   * "sinergia 50%50%Sinergia" e a camada não casava com `CAMADA_LABEL`.
   */
  const rotulos = await page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"][aria-label="Camadas do grafo"] label')].map((l) => {
      const copia = l.cloneNode(true);
      for (const svg of copia.querySelectorAll("svg")) svg.remove();
      return {
        texto: (copia.textContent || "").replace(/\s+/g, " ").trim(),
        marcada: l.querySelector('input[type="checkbox"]')?.checked === true,
      };
    }),
  );
  return { rotulos };
}

async function fecharPainelDeCamadas(page) {
  const fechar = page.locator('[role="dialog"][aria-label="Camadas do grafo"] button[aria-label="Fechar"]');
  if (await fechar.count()) await fechar.first().click();
  else await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

async function medirDesligarCamada(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  const { ctx, page } = await abrirPagina(browser, caso);
  const linhas = [];
  try {
    await ligarTodasAsCamadas(page);
    await page.waitForTimeout(500);

    const painel = await abrirPainelDeCamadas(page);
    if (painel === null) {
      exigir(false, `${chave}: §13 não achei o controle "Camadas" — o sentido OFF não tem por onde ser exercido`);
      return linhas;
    }
    const porRotulo = new Map(
      CONTRATO.camadas.map((c) => [CONTRATO.rotulos[c], c]),
    );
    const indiceDaCamada = new Map();
    painel.rotulos.forEach((r, i) => {
      const camada = porRotulo.get(r.texto);
      if (camada) indiceDaCamada.set(camada, i);
    });
    const semCaixa = CONTRATO.camadas.filter((c) => !indiceDaCamada.has(c));
    if (semCaixa.length > 0) {
      exigir(
        false,
        `${chave}: §13 camada sem caixa no painel: ${semCaixa.join(", ")} (rótulos vistos: ${painel.rotulos.map((r) => r.texto).join(" | ")})`,
      );
      return linhas;
    }
    /*
     * O painel pode não estar aberto: o F5 de §18 fecha a folha, e no celular
     * ela ainda é modal com backdrop. Marcar uma caixa que não está na tela é
     * um tempo esgotado de 30 s que vira "a etapa morreu" — medido a 390×800
     * na corrida de um núcleo. Então a função GARANTE o painel aberto, e tenta
     * de novo uma vez antes de desistir: reabrir é barato, e um tempo esgotado
     * por painel fechado não é nem produto reprovado nem medição honesta.
     */
    const garantirPainelAberto = async () => {
      const dialogo = page.locator('[role="dialog"][aria-label="Camadas do grafo"]');
      if ((await dialogo.count()) === 0) await abrirPainelDeCamadas(page);
    };
    const marcarCaixa = async (camada, valor) => {
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        await garantirPainelAberto();
        const caixas = page.locator('[role="dialog"][aria-label="Camadas do grafo"] input[type="checkbox"]');
        const caixa = caixas.nth(indiceDaCamada.get(camada));
        try {
          if (valor) await caixa.check({ timeout: 15000 });
          else await caixa.uncheck({ timeout: 15000 });
          await page.waitForTimeout(600);
          return;
        } catch (erro) {
          if (tentativa === 1) throw erro;
          await fecharPainelDeCamadas(page).catch(() => undefined);
          await page.waitForTimeout(400);
        }
      }
    };

    const antes = await idsDesenhadosComCamada(page);
    const camadasDe = (a) => (a.critica ? [a.camada, "critico"] : [a.camada]);

    for (const camada of CONTRATO.camadas) {
      const marcadasDepois = CONTRATO.camadas.filter((c) => c !== camada);
      await marcarCaixa(camada, false);
      const depois = await idsDesenhadosComCamada(page);
      const contratoAgora = await lerContratoDoCanvas(page);
      const idsDepois = new Set(depois.map((a) => a.id));

      if (camada === "critico") {
        /* Régua própria e declarada: nenhuma aresta some (sucessão crítica
           continua sucessão), mas o traço TRIPLO tem de sumir. */
        const criticasAntes = antes.filter((a) => a.critica).length;
        const criticasAgora = depois.filter((a) => a.critica).length;
        exigir(
          criticasAntes > 0,
          `${chave}: §13 nenhuma aresta de caminho crítico estava na tela antes de desligar a camada — não há o que medir`,
        );
        exigir(
          criticasAgora === 0,
          `${chave}: §13 desmarcar "${CONTRATO.rotulos[camada]}" deixou ${String(criticasAgora)} aresta(s) ainda marcadas como caminho crítico no canvas`,
        );
        exigir(
          depois.length === antes.length,
          `${chave}: §13 desmarcar "${CONTRATO.rotulos[camada]}" apagou ${String(antes.length - depois.length)} aresta(s) — uma sucessão crítica continua sendo sucessão (OR, não AND)`,
        );
        linhas.push(`${camada}: críticas ${String(criticasAntes)}→${String(criticasAgora)}, arestas ${String(antes.length)}→${String(depois.length)}`);
      } else {
        const previstas = antes.filter((a) => camadasDe(a).some((c) => marcadasDepois.includes(c)));
        const removidas = antes.filter((a) => !previstas.includes(a));
        exigir(
          removidas.length > 0,
          `${chave}: §13 a camada "${CONTRATO.rotulos[camada]}" não tinha nenhuma aresta exclusiva na tela — desligá-la não prova nada, e não provar nada é reprovar`,
        );
        const sobreviventesErrados = removidas.filter((a) => idsDepois.has(a.id));
        exigir(
          sobreviventesErrados.length === 0,
          `${chave}: §13 desmarcar "${CONTRATO.rotulos[camada]}" NÃO apagou ${String(sobreviventesErrados.length)} aresta(s) do canvas: ${sobreviventesErrados.map((a) => a.id).slice(0, 3).join(", ")}`,
        );
        const sumiuDemais = previstas.filter((a) => !idsDepois.has(a.id));
        exigir(
          sumiuDemais.length === 0,
          `${chave}: §13 desmarcar "${CONTRATO.rotulos[camada]}" apagou ${String(sumiuDemais.length)} aresta(s) de OUTRA camada: ${sumiuDemais.map((a) => `${a.id} (camada "${a.camada}")`).slice(0, 3).join(", ")}`,
        );
        linhas.push(`${camada}: ${String(antes.length)}→${String(depois.length)} arestas (−${String(removidas.length)} previstas)`);
      }

      /*
       * ── §18 · AS CAMADAS SOBREVIVEM AO F5 (achado BAIXO 11) ────────────
       *
       * O painel promete persistência (`localStorage`, chave namespaced) e a
       * guarda nunca recarregava a página depois de mexer nas caixas: a
       * promessa podia mentir inteira sem ninguém ver. Aqui, com a camada
       * desmarcada, dá-se F5 e exige-se o MESMO estado — no painel e no
       * canvas. É a mesma disciplina do "chegou ao banco?" da peça P6: pedir,
       * recarregar, e exigir o que foi pedido.
       */
      await page.reload({ waitUntil: "networkidle" });
      /* No celular o grafo vive numa aba, e o F5 devolve a tela à aba inicial:
         sem voltar para "Grafo" o canvas simplesmente não existe, e a espera
         pelo seletor estourava (medido a 390×800). */
      await irParaAba(page, caso, "Grafo");
      await page.waitForSelector(".react-flow__viewport", { timeout: 30000 });
      /* O F5 apaga o `addStyleTag` de `abrirPagina` e o selo do `next dev`
         volta a cobrir a última caixa da folha a 390 px. */
      await esconderSeloDoNext(page);
      /*
       * O canvas depois do F5 se mede ASSENTADO, não no primeiro quadro
       * (achado da rodada 16): o ReactFlow mede os cartões antes de desenhar
       * as arestas, e sob carga os 700 ms fixos daqui liam o intervalo entre
       * as duas coisas — "0 arestas depois do F5" numa corrida honesta a
       * 1920, com a persistência certa. Espera-se até a contagem pedida, com
       * teto de 10 s; passado o teto, a medida continua reprovando.
       */
      let depoisDoF5 = [];
      for (let espera = 0; espera < 20; espera += 1) {
        await page.waitForTimeout(500);
        depoisDoF5 = await idsDesenhadosComCamada(page);
        if (depoisDoF5.length === depois.length) break;
      }
      const contratoDepoisDoF5 = await lerContratoDoCanvas(page);
      const noContratoDepoisDoF5 = Array.isArray(contratoDepoisDoF5?.camadasAtivas)
        ? [...contratoDepoisDoF5.camadasAtivas].sort()
        : null;
      exigir(
        noContratoDepoisDoF5 !== null &&
          noContratoDepoisDoF5.join(",") === [...marcadasDepois].sort().join(","),
        `${chave}: §18 depois do F5 com "${CONTRATO.rotulos[camada]}" desmarcada, a tela volta com ${
          noContratoDepoisDoF5 === null ? "camadas ilegíveis" : noContratoDepoisDoF5.join("+")
        } e o operador tinha deixado ${marcadasDepois.join("+")} — a persistência do painel está mentindo`,
      );
      exigir(
        depoisDoF5.length === depois.length,
        `${chave}: §18 depois do F5 o canvas desenha ${String(depoisDoF5.length)} aresta(s) e antes do F5 desenhava ${String(depois.length)} com as mesmas camadas`,
      );
      const painelDepoisDoF5 = await abrirPainelDeCamadas(page);
      const marcadasNoF5 = (painelDepoisDoF5?.rotulos ?? [])
        .filter((r) => r.marcada)
        .map((r) => r.texto)
        .sort();
      exigir(
        marcadasNoF5.join(",") === marcadasDepois.map((c) => CONTRATO.rotulos[c]).sort().join(","),
        `${chave}: §18 depois do F5 o painel mostra [${marcadasNoF5.join(", ")}] marcadas e o operador tinha deixado [${marcadasDepois.map((c) => CONTRATO.rotulos[c]).sort().join(", ")}]`,
      );

      /* O painel e o dado que alimenta o canvas têm de dizer a MESMA coisa —
         é o casamento que o `camadasAtivas` fixo quebra em silêncio. */
      const noContrato = Array.isArray(contratoAgora?.camadasAtivas) ? [...contratoAgora.camadasAtivas].sort() : null;
      exigir(
        noContrato !== null && noContrato.join(",") === [...marcadasDepois].sort().join(","),
        `${chave}: §13 com "${CONTRATO.rotulos[camada]}" desmarcada, o painel diz ${marcadasDepois.join("+")} e o dado que alimenta o canvas diz ${noContrato === null ? "nada (sem contrato)" : noContrato.join("+")}`,
      );

      await marcarCaixa(camada, true);
      const devolta = await idsDesenhadosComCamada(page);
      exigir(
        devolta.length === antes.length,
        `${chave}: §13 remarcar "${CONTRATO.rotulos[camada]}" devolveu ${String(devolta.length)} aresta(s) e antes eram ${String(antes.length)}`,
      );
    }
    await fecharPainelDeCamadas(page);
  } finally {
    await ctx.close();
  }
  return linhas;
}

// ═══════════════════════════════════════════════════════════════════════════
// §14 · O ESTADO DEFAULT, COMO ELE NASCE  (achado ALTO 3, segunda metade)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * A guarda ligava as cinco camadas na primeira coisa que fazia, em toda
 * largura — o estado em que a tela NASCE (`CAMADAS_DEFAULT` = sucessão +
 * caminho crítico) nunca era observado por ninguém. Aqui ele é: página nova,
 * nada clicado, e o que está na tela tem de ser exatamente o que o default
 * manda.
 */
async function medirEstadoDefault(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  const { ctx, page } = await abrirPagina(browser, caso);
  let linha = "?";
  try {
    const desenhadas = await idsDesenhadosComCamada(page);
    const contrato = await lerContratoDoCanvas(page);
    const noContrato = Array.isArray(contrato?.camadasAtivas) ? [...contrato.camadasAtivas].sort() : null;
    exigir(
      noContrato !== null && noContrato.join(",") === [...CONTRATO.camadasDefault].sort().join(","),
      `${chave}: §14 a tela nasce com as camadas ${noContrato === null ? "ilegíveis" : noContrato.join("+")} e CAMADAS_DEFAULT diz ${CONTRATO.camadasDefault.join("+")}`,
    );
    const foraDoDefault = desenhadas.filter(
      (a) => !CONTRATO.camadasDefault.includes(a.camada) && !(a.critica && CONTRATO.camadasDefault.includes("critico")),
    );
    exigir(
      foraDoDefault.length === 0,
      `${chave}: §14 a tela nasce desenhando ${String(foraDoDefault.length)} aresta(s) de camada que o default NÃO liga: ${foraDoDefault.map((a) => `${a.id} (camada "${a.camada}")`).slice(0, 3).join(", ")}`,
    );
    exigir(
      desenhadas.length > 0,
      `${chave}: §14 a tela nasce SEM nenhuma aresta desenhada — o default liga ${CONTRATO.camadasDefault.join("+")}`,
    );
    const painel = await abrirPainelDeCamadas(page);
    const marcadas = (painel?.rotulos ?? []).filter((r) => r.marcada).map((r) => r.texto).sort();
    const esperadasNoPainel = CONTRATO.camadasDefault.map((c) => CONTRATO.rotulos[c]).sort();
    exigir(
      marcadas.join(",") === esperadasNoPainel.join(","),
      `${chave}: §14 o painel nasce com [${marcadas.join(", ")}] marcadas e o default é [${esperadasNoPainel.join(", ")}]`,
    );
    if (painel !== null) await fecharPainelDeCamadas(page);

    /*
     * ── ALTO 2: O ESTADO EM QUE A TELA NASCE, MEDIDO EM PIXEL ────────────
     *
     * §7/§8/§9/§10/§12 só rodavam dentro de `medirODesenhoInteiro`, e as duas
     * chamadas vinham logo depois de `ligarTodasAsCamadas`. O único lugar que
     * observava o default era esta §14 — lendo ids de DOM e texto, nenhuma
     * foto, nenhum pixel. Provado pelo crítico com uma linha
     * (`className: camadasAtivas.size <= 2 ? "opacity-0" : undefined`): ao
     * abrir a página, 11 cartões soltos e ZERO arestas visíveis; os cinco
     * portões verdes. Era o CRÍTICO da rodada 10 voltando pelo único estado
     * que todo mundo vê.
     *
     * Agora o default passa pelo mesmo `medirODesenhoInteiro` de todos os
     * outros estados, com o universo filtrado por `CAMADAS_DEFAULT`.
     */
    const desenhoNoDefault = await medirODesenhoInteiro(
      page,
      chave,
      " [default]",
      CONTRATO.camadasDefault,
    );
    linha = `${String(desenhadas.length)} arestas, camadas ${
      noContrato === null ? "?" : noContrato.join("+")
    }, painel [${marcadas.join(", ")}] · ${desenhoNoDefault.pintura.linha} · dado ${desenhoNoDefault.contraODado} · tripla ${desenhoNoDefault.tripla} · lista ${desenhoNoDefault.alcance}`;
  } finally {
    await ctx.close();
  }
  return linha;
}

// ═══════════════════════════════════════════════════════════════════════════
// §22 · O PRODUTO DOS GESTOS, COM OS EIXOS DERIVADOS — NÃO ESCOLHIDOS
//       (ALTO 3 da rodada 15 + o ALTO do coordenador na rodada 16)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * **O que a rodada 15 fechou, e o que ela deixou aberto.** Cada gesto desta
 * peça tinha a sua seção e cada seção media o seu gesto SOZINHO. A rodada 15
 * trocou a lista pelo produto de dois eixos — camadas × seleção — e parou aí.
 * Os dois eixos eram escritos à mão. O zoom ficou de fora ("tem eixo próprio
 * em §15b/§15c"), e as pontas do zoom eram medidas SEM cartão selecionado.
 *
 * O coordenador provou com uma linha em `v3-edge.tsx`:
 *
 *     if (zoomSeguro > 1.2 && data.destacadaPeloSelecionado === true) return null;
 *
 * "Deploy de produção" selecionado: 2 ligações destacadas a 0,849 e **0** a
 * 1,467 (três cliques em "Aumentar zoom"), com os cinco portões verdes. O
 * operador aproxima para ver melhor e as ligações do cartão somem. É a
 * **forma 3** do vício desta casa (universo por convenção): os eixos do
 * produto eram os que alguém lembrou.
 *
 * **O conserto fecha a classe, não o caso.** Os eixos saem de duas fontes que
 * esta guarda NÃO escreve:
 *
 *   1. **o código** — `CONTRATO.inventarioDoEstado` (em `derivarContrato`):
 *      toda prop de `DependencyGraphProps`, todo `useState` dos arquivos do
 *      grafo, todo campo que o produto lê de `useViewport()` e todo gesto que
 *      o `<ReactFlow>` instalado liga sem o produto pedir. Cada item tem de
 *      estar em `ESTADO_DO_GRAFO`: ou é um EIXO, ou está FORA com o motivo
 *      escrito (e, quando o motivo depende do código, com o lastro conferido).
 *      Item sem classificação reprova em §0c, nomeando o item;
 *   2. **a tela** — todo controle da seção do grafo (`LEITURA_DOS_CONTROLES`)
 *      tem de casar com uma regra de `CONTROLES_DO_GRAFO`. Controle novo na
 *      barra sem regra reprova aqui, nomeando o controle.
 *
 * E os VALORES de cada eixo também são derivados: o piso e o teto do zoom
 * saem de `tipografia-do-cartao.ts` e de `dependency-graph.tsx`; o inicial é
 * o que o enquadramento do próprio produto dá; o cartão selecionado é o
 * destino de uma sucessão que o canvas desenha; a fonte do filtro é a que
 * esmaece a ligação desse cartão (derivada do rótulo do cartão e do dado
 * bruto); os painéis e os enquadramentos são os botões que a barra põe na tela.
 *
 * **O custo, e o critério de redução — declarado.** O produto cartesiano é
 * 7 camadas × 3 zooms × 3 painéis × 2 seleções × 2 filtros × 2 enquadramentos
 * × 2 pans = 1.008 combinações por largura: inviável no robô. Esta seção
 * cobre **todo PAR de valores de quaisquer dois eixos** (cobertura em pares),
 * com as combinações GERADAS por `gerarCoberturaEmPares` — gulosa e
 * determinística, nunca escolhidas a dedo — e a cobertura RECONTADA do zero
 * por `paresSemCobertura`, que não confia no gerador. Com o dado do fixture:
 * 179 pares, 22 combinações por largura.
 *
 * Um par só conta como coberto onde ele é OBSERVÁVEL: "com X selecionado ×
 * zoom no teto" numa combinação em que a camada "Sucessão" está desligada não
 * cobre nada — o destaque não tem como aparecer ali, e contar esse par seria
 * aprovar por ausência (forma 2). A exceção é o próprio par (camadas ×
 * seleção), que é justamente o que mede se o destaque se CALA quando deve.
 *
 * **O que fica fora, dito por extenso:** defeito que só apareça numa
 * interação de TRÊS eixos ou mais e em nenhuma de dois (ex.: só com o
 * painel "Legenda" aberto E zoom no piso E fundo arrastado ao mesmo tempo),
 * a menos que a combinação gerada calhe de conter os três; duas camadas
 * desligadas que não sejam o default; e os itens que `ESTADO_DO_GRAFO`
 * declara fora, cada um com o seu motivo. Os valores INTERMEDIÁRIOS do zoom,
 * do pan e da largura NÃO ficam mais fora (rodada 17): aqui o zoom tem os três
 * valores representativos cruzados em pares com todos os eixos, e §22z
 * percorre TODO valor que os gestos alcançam — ver "§22z / §22p / §22L".
 *
 * Em cada combinação, a medida é o §12 (o canvas × o dado bruto derivado do
 * CPM) **e** o destaque: se o universo daquela combinação tem sucessão
 * chegando no cartão selecionado, as arestas destacadas têm de ser
 * EXATAMENTE essas (conjunto igual, não "pelo menos uma"), com o `<path>`
 * pintando a cor do contrato com largura e opacidade de verdade (em toda
 * combinação), e no PIXEL com cobertura de UM fator nos eixos que mudam onde
 * o traço chega à tela — trazendo a aresta à vista pelo pan quando o zoom a
 * jogou para fora. Esse corte do pixel é o segundo critério de redução
 * declarado desta seção: com pixel em toda combinação a corrida media
 * 1.913 s num núcleo.
 */

/** Os eixos que esta guarda sabe exercer. Eixo classificado sem aplicador aqui reprova (§0c). */
const EIXOS_EXERCIDOS = ["camadas", "zoom", "popover", "selecao", "fontes", "enquadramento", "pan"];

/**
 * A classificação de TODO item de `CONTRATO.inventarioDoEstado`. A chave é o
 * que o inventário imprime; `eixo` diz em qual eixo do produto ele entra;
 * `fora` diz por que não entra; `lastro` (quando há) é a prova no código de
 * que o motivo continua verdadeiro — `{ arquivo, tem }` exige que o código
 * tenha o trecho, `{ arquivo, naoTem }` exige que não tenha.
 */
const DADO_DO_SERVIDOR = "dado do servidor (a página o calcula e o entrega pronto) — o operador não o muda com gesto nenhum nesta tela";
const DERIVADO = "estado DERIVADO de outros eixos (enquadramento × largura × zoom), recalculado pelo próprio componente — o operador não o escreve";
const LARGURA =
  "é a LARGURA da janela — o laço de FORA desta guarda: cada combinação deste produto roda em cada uma das 5 larguras (produto completo com todo o resto), e redimensionar com a tela aberta é §6b";
const ESTADO_DO_GRAFO = {
  "prop tasks": { fora: DADO_DO_SERVIDOR },
  "prop sources": { fora: DADO_DO_SERVIDOR },
  "prop cycleTaskIds": { fora: DADO_DO_SERVIDOR },
  "prop todayTaskIds": { fora: DADO_DO_SERVIDOR },
  "prop grafoV3": { fora: DADO_DO_SERVIDOR },
  "prop activeSourceKinds": { eixo: "fontes" },
  "prop selectedTaskId": { eixo: "selecao" },
  "prop onSelectTask": { eixo: "selecao" },
  "prop accessibleFallback": {
    fora:
      'troca a SUPERFÍCIE inteira ("ver como lista"): sem canvas não existe zoom, pan, enquadramento nem traço para destacar — os outros eixos não têm valor nela. A lista é medida contra o universo em §10 e contra o painel de camadas em §16',
    lastro: { arquivo: "src/components/graph/dependency-graph.tsx", tem: 'data-lb-modo="lista"' },
  },
  "dependency-graph.tsx GraphLegend.expandido": { eixo: "popover" },
  "dependency-graph.tsx ChipForaDaTela.conta": { fora: DERIVADO },
  "dependency-graph.tsx DependencyGraph.pane": { fora: LARGURA },
  "dependency-graph.tsx DependencyGraph.zoomAtual": { eixo: "zoom" },
  "dependency-graph.tsx DependencyGraph.alvoDoEnquadramento": { eixo: "enquadramento" },
  "dependency-graph.tsx DependencyGraph.cabeInteiro": { fora: DERIVADO },
  "dependency-graph.tsx DependencyGraph.ultimoEnquadramento": { fora: DERIVADO },
  "dependency-graph.tsx DependencyGraph.fecharPaineisSinal": { eixo: "popover" },
  "dependency-graph.tsx DependencyGraph.alturaMedida": { fora: DERIVADO },
  "layer-toggle-panel.tsx useCamadasDoGrafo.ativas": { eixo: "camadas" },
  "layer-toggle-panel.tsx useEhMobile.mobile": { fora: LARGURA },
  "layer-toggle-panel.tsx LayerTogglePanel.expandido": { eixo: "popover" },
  "viewport zoom": { eixo: "zoom" },
  "viewport x": { eixo: "pan" },
  "viewport y": { eixo: "pan" },
  "gesto da lib panOnDrag": { eixo: "pan" },
  "gesto da lib panActivationKeyCode": { eixo: "pan" },
  "gesto da lib zoomOnScroll": { eixo: "zoom" },
  "gesto da lib zoomOnPinch": { eixo: "zoom" },
  "gesto da lib zoomOnDoubleClick": { eixo: "zoom" },
  "gesto da lib zoomActivationKeyCode": { eixo: "zoom" },
  "gesto da lib elementsSelectable": { eixo: "selecao" },
  "gesto da lib selectionKeyCode": {
    fora:
      "seleção por caixa (Shift + arrasto) marca o cartão pela seleção INTERNA da lib; as arestas destacadas saem só de `selectedTaskId`, que só `onNodeClick`/`onPaneClick` escrevem — a peça P4 não promete destaque para seleção múltipla",
    lastro: { arquivo: "src/components/graph/dependency-graph.tsx", tem: "onNodeClick={(_, node) => handleSelect(node.id)}" },
  },
  "gesto da lib multiSelectionKeyCode": {
    fora: "idem à seleção por caixa: Ctrl + clique acumula seleção INTERNA da lib, sem promessa de destaque na peça P4",
    lastro: { arquivo: "src/components/graph/dependency-graph.tsx", tem: "onNodeClick={(_, node) => handleSelect(node.id)}" },
  },
  "gesto da lib deleteKeyCode": {
    fora: "Backspace só apaga elemento de canvas NÃO controlado; aqui os nós e as arestas vêm por prop e o produto não passa `onNodesChange`/`onEdgesChange` — a tecla não muda estado nenhum",
    lastro: { arquivo: "src/components/graph/dependency-graph.tsx", naoTem: "onNodesChange" },
  },
  "gesto da lib selectNodesOnDrag": {
    fora: "só age sobre nó arrastável, e o produto desliga o arrasto do cartão (§15 prova que ele não anda)",
    lastro: { arquivo: "src/components/graph/dependency-graph.tsx", tem: "nodesDraggable={false}" },
  },
  "gesto da lib autoPanOnNodeDrag": {
    fora: "só age arrastando nó, e o produto desliga o arrasto do cartão",
    lastro: { arquivo: "src/components/graph/dependency-graph.tsx", tem: "nodesDraggable={false}" },
  },
  "gesto da lib connectOnClick": {
    fora: "ligar dois nós exige alça conectável, e o produto desliga a conexão",
    lastro: { arquivo: "src/components/graph/dependency-graph.tsx", tem: "nodesConnectable={false}" },
  },
  "gesto da lib autoPanOnConnect": {
    fora: "só age ligando dois nós, e o produto desliga a conexão",
    lastro: { arquivo: "src/components/graph/dependency-graph.tsx", tem: "nodesConnectable={false}" },
  },
  "gesto da lib edgesUpdatable": {
    fora: "religar a ponta de uma aresta exige `onEdgeUpdate`/`onReconnect`, que o produto não passa",
    lastro: { arquivo: "src/components/graph/dependency-graph.tsx", naoTem: "onEdgeUpdate" },
  },
  "gesto da lib edgesFocusable": {
    fora: "cada aresta nasce com `focusable: false` — o foco de teclado nunca chega a ela, e quem a lê sem mouse é a lista de §10",
    lastro: { arquivo: "src/components/graph/dependency-graph.tsx", tem: "focusable: false," },
  },
  "gesto da lib elevateNodesOnSelect": {
    fora: "é a ordem de empilhamento do cartão clicado, consequência da seleção (que é eixo) — não um estado que o operador escreva à parte",
  },
  "gesto da lib preventScrolling": {
    fora: "não guarda estado: só impede a PÁGINA de rolar enquanto a roda age no canvas (a roda em si é a porta `zoomOnScroll` do eixo do zoom)",
  },
};

/** Conferência de §0c: o inventário inteiro classificado, sem fantasma e com lastro. */
function conferirClassificacaoDoEstado() {
  const problemas = [];
  const inventario = CONTRATO.inventarioDoEstado;
  const semClasse = inventario.filter((i) => !Object.hasOwn(ESTADO_DO_GRAFO, i));
  if (semClasse.length > 0) {
    problemas.push(
      `o produto guarda ${semClasse.map((i) => `"${i}"`).join(", ")} e o produto dos gestos (§22) não o cruza nem o declara fora — eixo de estado que o operador controla e nenhuma medida atravessa`,
    );
  }
  const fantasmas = Object.keys(ESTADO_DO_GRAFO).filter((k) => !inventario.includes(k));
  if (fantasmas.length > 0) {
    problemas.push(
      `a classificação descreve ${fantasmas.map((i) => `"${i}"`).join(", ")}, que o código não tem mais — tabela que classifica estado inexistente é a mesma convenção que esta seção existe para matar`,
    );
  }
  const eixosDaTabela = new Set();
  for (const [item, c] of Object.entries(ESTADO_DO_GRAFO)) {
    if (c.eixo !== undefined) {
      eixosDaTabela.add(c.eixo);
      if (!EIXOS_EXERCIDOS.includes(c.eixo)) problemas.push(`"${item}" está no eixo "${c.eixo}", que §22 não sabe exercer`);
      continue;
    }
    if (typeof c.fora !== "string" || c.fora.length < 40) {
      problemas.push(`"${item}" está declarado fora sem motivo escrito — eixo fora precisa dizer por quê`);
    }
    if (c.lastro) {
      const fonte = lerFonte(c.lastro.arquivo);
      if (c.lastro.tem !== undefined && !fonte.includes(c.lastro.tem)) {
        problemas.push(`"${item}" está fora porque ${c.lastro.arquivo} tem \`${c.lastro.tem}\` — e não tem mais: o motivo caiu, o eixo voltou`);
      }
      if (c.lastro.naoTem !== undefined && fonte.includes(c.lastro.naoTem)) {
        problemas.push(`"${item}" está fora porque ${c.lastro.arquivo} não tem \`${c.lastro.naoTem}\` — e agora tem: o motivo caiu, o eixo voltou`);
      }
    }
  }
  const semEstado = EIXOS_EXERCIDOS.filter((e) => !eixosDaTabela.has(e));
  if (semEstado.length > 0) {
    problemas.push(`§22 exerce ${semEstado.join(", ")} e nenhum item do código está nesse(s) eixo(s) — um eixo sem estado no produto é convenção desta guarda`);
  }
  return problemas;
}

/**
 * Os controles que a SEÇÃO do grafo põe na tela (fora dos cartões, fora dos
 * painéis abertos). É a outra metade da derivação: um botão novo na barra
 * aparece aqui antes de alguém lembrar de medi-lo.
 */
const LEITURA_DOS_CONTROLES = `(() => {
  const secao = document.querySelector('section[aria-label="Grafo de dependências"]');
  if (!secao) return null;
  const saida = [];
  const seletor = 'button, input, select, textarea, a[href], [role="button"], [role="checkbox"], [role="switch"], [role="slider"], [role="tab"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
  for (const el of secao.querySelectorAll(seletor)) {
    if (el.closest(".react-flow__node") || el.closest('[role="dialog"]')) continue;
    saida.push({
      rotulo: el.getAttribute("aria-label"),
      texto: (el.textContent || "").replace(/\\s+/g, " ").trim(),
      acao: el.getAttribute("data-acao"),
      popup: el.getAttribute("aria-haspopup"),
      pressionado: el.getAttribute("aria-pressed"),
      tag: el.tagName.toLowerCase(),
    });
  }
  return saida;
})()`;

/**
 * A PINTURA COMPUTADA de cada traço destacado, no `<path>` e não só no `<g>`:
 * cor, largura, opacidade do traço e opacidade acumulada até a raiz. É o que
 * roda em TODA combinação (barato, sem foto) — o pixel vem por cima, com a
 * cobertura declarada em §22.
 */
const LEITURA_DO_TRACO_DESTACADO = `(() => {
  const saida = {};
  for (const g of document.querySelectorAll(".react-flow g.lb-edge-destacada")) {
    const tracos = [];
    for (const path of g.querySelectorAll("path.lb-edge-path")) {
      const c = getComputedStyle(path);
      let acumulada = Number(c.opacity) * Number(c.strokeOpacity);
      let visivel = c.visibility === "visible" && c.display !== "none";
      for (let n = path.parentElement; n && n.nodeType === 1; n = n.parentElement) {
        const cn = getComputedStyle(n);
        acumulada *= Number(cn.opacity);
        if (cn.display === "none" || cn.visibility === "hidden") visivel = false;
      }
      tracos.push({ stroke: c.stroke, largura: parseFloat(c.strokeWidth), acumulada, visivel, tamanho: path.getTotalLength() });
    }
    saida[g.getAttribute("data-aresta-id")] = tracos;
  }
  return saida;
})()`;

/** Cada controle da barra casa com UMA regra: ou um eixo, ou fora com motivo. */
const CONTROLES_DO_GRAFO = [
  { regra: "zoom", casa: (c) => c.rotulo === "Diminuir zoom" || c.rotulo === "Aumentar zoom", eixo: "zoom" },
  { regra: "enquadramento", casa: (c) => typeof c.acao === "string" && c.acao.length > 0, eixo: "enquadramento" },
  { regra: "painel", casa: (c) => c.popup === "dialog", eixo: "popover" },
  {
    regra: "chip de fora da tela",
    casa: (c) => c.rotulo === null && / fora da tela · /.test(c.texto),
    eixo: "enquadramento",
    lastro: { arquivo: "src/components/graph/dependency-graph.tsx", tem: 'onClick={() => enquadrar("tudo")}' },
  },
  {
    regra: "ver como lista",
    casa: (c) => c.pressionado !== null && /^ver (como lista|grafo)$/.test(c.texto),
    fora: "é a prop `accessibleFallback` — declarada fora em ESTADO_DO_GRAFO (troca a superfície inteira)",
  },
];

async function aplicarCamadas(page, indiceDaCamada, ativas) {
  const alvo = new Set(ativas);
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    const dialogo = page.locator('[role="dialog"][aria-label="Camadas do grafo"]');
    if ((await dialogo.count()) === 0) await abrirPainelDeCamadas(page);
    const caixas = page.locator('[role="dialog"][aria-label="Camadas do grafo"] input[type="checkbox"]');
    try {
      for (const camada of CONTRATO.camadas) {
        const caixa = caixas.nth(indiceDaCamada.get(camada));
        const querMarcada = alvo.has(camada);
        if ((await caixa.isChecked()) === querMarcada) continue;
        if (querMarcada) await caixa.check({ timeout: 15000 });
        else await caixa.uncheck({ timeout: 15000 });
        await page.waitForTimeout(80);
      }
      await fecharPainelDeCamadas(page);
      await page.waitForTimeout(150);
      return true;
    } catch (erro) {
      if (tentativa === 1) throw erro;
      await fecharPainelDeCamadas(page).catch(() => undefined);
      await page.waitForTimeout(400);
    }
  }
  return false;
}

/** Seleciona o cartão de id `taskId`, ou LIMPA a seleção quando `taskId` é `null`. */
async function aplicarSelecao(page, taskId) {
  if (taskId === null) {
    await page.evaluate(() => {
      const pane = document.querySelector(".react-flow__pane");
      pane?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    await page.waitForTimeout(200);
    return true;
  }
  const clicou = await page.evaluate((id) => {
    const no = [...document.querySelectorAll(".react-flow__node")].find(
      (n) => n.getAttribute("data-id") === id,
    );
    const botao = no?.querySelector('[role="button"]');
    if (!botao) return false;
    botao.click();
    return true;
  }, taskId);
  await page.waitForTimeout(250);
  return clicou;
}

/** Marca só a fonte `so` (ou todas, com `null`) no filtro de fontes — pelo filtro do produto. */
async function aplicarFontes(page, caso, so) {
  const precisa = await page.evaluate((alvo) => {
    const caixas = [...document.querySelectorAll('fieldset input[type="checkbox"]')];
    return caixas
      .map((cx, i) => {
        const nome = cx.closest("label")?.querySelector("span[title]")?.getAttribute("title") ?? "";
        const quer = alvo === null ? true : nome === alvo;
        return { i, quer, esta: cx.checked };
      })
      .filter((c) => c.quer !== c.esta);
  }, so);
  if (precisa.length === 0) return true;
  await irParaAba(page, caso, "Fontes");
  const caixas = page.locator('fieldset input[type="checkbox"]');
  /* Primeiro MARCA o que tem de ficar marcado, depois desmarca: nunca passa
     por "nenhuma marcada", que o filtro normaliza para "todas". */
  for (const c of precisa.filter((x) => x.quer)) await caixas.nth(c.i).check({ timeout: 15000 });
  for (const c of precisa.filter((x) => !x.quer)) await caixas.nth(c.i).uncheck({ timeout: 15000 });
  await page.waitForTimeout(400);
  await irParaAba(page, caso, "Grafo");
  await page.waitForSelector(".react-flow__viewport", { timeout: 20000 });
  await page.waitForTimeout(500);
  return true;
}

/** Arrasta o FUNDO do canvas (o pan do operador), a partir de um ponto que é fundo de verdade. */
async function arrastarOFundo(page) {
  const antes = await transformDoCanvas(page);
  const ponto = await page.evaluate(() => {
    const pane = document.querySelector(".react-flow__pane");
    if (!pane) return null;
    const r = pane.getBoundingClientRect();
    for (const fx of [0.5, 0.15, 0.85, 0.3, 0.7, 0.05, 0.95]) {
      for (const fy of [0.5, 0.12, 0.88, 0.3, 0.7]) {
        const x = r.x + r.width * fx;
        const y = r.y + r.height * fy;
        if (document.elementFromPoint(x, y) === pane) return { x, y };
      }
    }
    return null;
  });
  if (ponto === null) return { ok: false, motivo: "não achei um ponto do FUNDO do canvas livre de cartão para arrastar" };
  await page.mouse.move(ponto.x, ponto.y);
  await page.mouse.down();
  await page.mouse.move(ponto.x - 70, ponto.y - 50, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const depois = await transformDoCanvas(page);
  if (depois === null || depois === antes) return { ok: false, motivo: `arrastar o fundo não moveu nada (transform ${String(antes)})` };
  return { ok: true, antes, depois };
}

async function abrirPainelPeloBotao(page, rotulo) {
  const pill = page.locator(`button[aria-label="${rotulo}"][aria-haspopup="dialog"]`).first();
  if ((await pill.count()) === 0) return false;
  if ((await pill.getAttribute("aria-expanded")) !== "true") await pill.click({ timeout: 10000 });
  await page.waitForTimeout(200);
  return (await pill.getAttribute("aria-expanded")) === "true";
}

async function fecharPaineisAbertos(page) {
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const aberto = await page.evaluate(() =>
      [...document.querySelectorAll('button[aria-haspopup="dialog"][aria-expanded="true"]')].map((b) => b.getAttribute("aria-label")),
    );
    if (aberto.length === 0) return true;
    const fechar = page.locator('[role="dialog"] button[aria-label="Fechar"]');
    if (await fechar.count()) await fechar.first().click().catch(() => undefined);
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
  return false;
}

/** As caixas dos painéis abertos: pixel embaixo delas não vota (o painel está por cima, e isso é certo). */
async function caixasDosPaineisAbertos(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"]')].map((d) => {
      const r = d.getBoundingClientRect();
      return { x: r.x, y: r.y, largura: r.width, altura: r.height };
    }),
  );
}

/**
 * O DESTAQUE NA TELA, EM PIXEL: a aresta destacada que tem ponto dentro da
 * janela, dentro do canvas, fora de todo cartão e fora de todo painel aberto
 * TEM de mudar pixel ao ser escondida, e o que ela pinta tem de ser a mistura
 * do AMARELO do contrato com o fundo daquele pixel (mesmo modelo de §7).
 * Devolve `null` quando nada dela cai em lugar medível — quem chama conta.
 */
async function medirDestaqueEmPixel(page, a, grupo, cartoes, pane, paineis) {
  const vista = page.viewportSize();
  const fora = (p, caixas, folga) =>
    !caixas.some(
      (c) => p.x >= c.x - folga && p.x <= c.x + c.largura + folga && p.y >= c.y - folga && p.y <= c.y + c.altura + folga,
    );
  const livres = (a.pontos ?? []).filter(
    (p) =>
      p.x >= 0 &&
      p.y >= 0 &&
      p.x < vista.width &&
      p.y < vista.height &&
      (pane === null || (p.x >= pane.x && p.x <= pane.x + pane.largura && p.y >= pane.y && p.y <= pane.y + pane.altura)) &&
      fora(p, Object.values(cartoes ?? {}), 2) &&
      fora(p, paineis, RAIO_DA_AMOSTRA + 2),
  );
  if (livres.length === 0) return null;
  const janela = janelaDosPontos(livres, RAIO_DA_AMOSTRA + 3, vista);
  if (janela === null) return null;
  const fotos = await fotosComESem(page, grupo, janela);
  if (fotos.erro) return { erro: fotos.erro };
  const corDoContrato = hexEmRgb(CONTRATO.cores.destacada);
  let mudaram = 0;
  let peso = 0;
  let pesoVezesResiduo = 0;
  for (const ponto of livres) {
    const amostra = amostraNoPonto(fotos, ponto, a.corEsperada, RAIO_DA_AMOSTRA, corDoContrato, CONTRATO.pisoDeContraste);
    if (!amostra.dentro) continue;
    mudaram += amostra.mudaram;
    peso += amostra.peso;
    pesoVezesResiduo += amostra.pesoVezesResiduo;
  }
  const residuo = peso > 0 ? pesoVezesResiduo / peso : null;
  return { pontos: livres.length, mudaram, residuo };
}

/**
 * Traz a aresta `id` para o meio do canvas ARRASTANDO O FUNDO — o gesto do
 * operador que quer ver o que o zoom jogou para fora. Só muda o pan (o zoom
 * é conferido igual antes e depois por quem chama). Devolve `true` quando o
 * meio da aresta chegou perto do centro do canvas.
 *
 * Rodada 17 (achado da corrida honesta a 1024 e 1280): a 1,698 depois de um
 * duplo clique a aresta ficava 910 px abaixo de um canvas de 507 px de altura.
 * O arrasto partia do primeiro ponto livre do fundo — às vezes perto da borda
 * para onde o arrasto ia, andando 56 px — e seis arrastos acabavam a 143 px do
 * centro: a aresta já estava NA TELA, e a função dizia que não. Agora o ponto
 * de partida é o ponto livre que deixa o arrasto MAIS LONGO na direção
 * pedida, são até doze arrastos, e a conferência final vale depois do último.
 */
async function trazerArestaAVista(page, id) {
  for (let passo = 0; passo <= 12; passo += 1) {
    const alvo = await page.evaluate((idDaAresta) => {
      const pane = document.querySelector(".react-flow__pane");
      const g = [...document.querySelectorAll(".react-flow g[data-camada]")].find(
        (x) => x.getAttribute("data-aresta-id") === idDaAresta,
      );
      const path = g?.querySelector("path.lb-edge-path");
      if (!pane || !path) return null;
      const r = pane.getBoundingClientRect();
      const comprimento = path.getTotalLength();
      const meio = path.getPointAtLength(comprimento / 2);
      const ctm = path.getScreenCTM();
      if (!ctm) return null;
      const p = path.ownerSVGElement.createSVGPoint();
      p.x = meio.x;
      p.y = meio.y;
      const t = p.matrixTransform(ctm);
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const dx = cx - t.x;
      const dy = cy - t.y;
      /* O ponto livre do fundo que deixa o arrasto mais longo na direção pedida. */
      let fundo = null;
      let melhor = -1;
      for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85, 0.05, 0.95]) {
        for (const fy of [0.5, 0.3, 0.7, 0.12, 0.88]) {
          const x = r.x + r.width * fx;
          const y = r.y + r.height * fy;
          if (document.elementFromPoint(x, y) !== pane) continue;
          const fimX = Math.max(r.x + 4, Math.min(r.x + r.width - 4, x + dx));
          const fimY = Math.max(r.y + 4, Math.min(r.y + r.height - 4, y + dy));
          const anda = Math.hypot(fimX - x, fimY - y);
          if (anda > melhor) {
            melhor = anda;
            fundo = { x, y };
          }
        }
      }
      return { dx, dy, fundo, larg: r.width, alt: r.height, r: { x: r.x, y: r.y } };
    }, id);
    if (alvo === null) return false;
    if (Math.abs(alvo.dx) < alvo.larg * 0.2 && Math.abs(alvo.dy) < alvo.alt * 0.2) return true;
    if (alvo.fundo === null || passo === 12) return false;
    /* Cada arrasto fica DENTRO do canvas: o fim do gesto não sai do retângulo. */
    const limite = (v, de, ate) => Math.max(de, Math.min(ate, v));
    const fimX = limite(alvo.fundo.x + alvo.dx, alvo.r.x + 4, alvo.r.x + alvo.larg - 4);
    const fimY = limite(alvo.fundo.y + alvo.dy, alvo.r.y + 4, alvo.r.y + alvo.alt - 4);
    await page.mouse.move(alvo.fundo.x, alvo.fundo.y);
    await page.mouse.down();
    await page.mouse.move(fimX, fimY, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(250);
  }
  return false;
}

async function medirProdutoDosGestos(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  const { ctx, page, errosDePagina, semCanvas } = await abrirPagina(browser, caso);
  const linhas = [];
  try {
    if (semCanvas) return linhas;

    // ── (1) OS CONTROLES DA TELA, CLASSIFICADOS ─────────────────────────────
    const controles = await page.evaluate(LEITURA_DOS_CONTROLES);
    if (controles === null) {
      exigir(false, `${chave}: §22 não achei a seção "Grafo de dependências" — o produto dos gestos não tem onde ser exercido`);
      return linhas;
    }
    const controlesPorEixo = new Map();
    const semRegra = [];
    for (const c of controles) {
      const regra = CONTROLES_DO_GRAFO.find((r) => r.casa(c));
      if (!regra) {
        semRegra.push(c.rotulo ?? (c.texto || `<${c.tag}>`));
        continue;
      }
      if (regra.lastro && !lerFonte(regra.lastro.arquivo).includes(regra.lastro.tem)) {
        exigir(false, `${chave}: §22 o controle "${c.rotulo ?? c.texto}" foi posto no eixo "${String(regra.eixo)}" porque ${regra.lastro.arquivo} tem \`${regra.lastro.tem}\` — e não tem mais`);
      }
      if (regra.eixo) controlesPorEixo.set(regra.eixo, [...(controlesPorEixo.get(regra.eixo) ?? []), c]);
    }
    exigir(
      semRegra.length === 0,
      `${chave}: §22 a barra do grafo oferece ${semRegra.map((r) => `"${r}"`).join(", ")} e o produto dos gestos não cruza esse controle nem o declara fora — é um eixo que o operador tem e nenhuma medida atravessa`,
    );

    await ligarTodasAsCamadas(page);
    await page.waitForTimeout(400);
    const painel = await abrirPainelDeCamadas(page);
    if (painel === null) {
      exigir(false, `${chave}: §22 não achei o controle "Camadas" — o eixo das camadas não tem por onde ser exercido`);
      return linhas;
    }
    const porRotulo = new Map(CONTRATO.camadas.map((c) => [CONTRATO.rotulos[c], c]));
    const indiceDaCamada = new Map();
    painel.rotulos.forEach((r, i) => {
      const camada = porRotulo.get(r.texto);
      if (camada) indiceDaCamada.set(camada, i);
    });
    const semCaixa = CONTRATO.camadas.filter((c) => !indiceDaCamada.has(c));
    await fecharPainelDeCamadas(page);
    if (semCaixa.length > 0) {
      exigir(false, `${chave}: §22 camada sem caixa no painel: ${semCaixa.join(", ")}`);
      return linhas;
    }

    // ── (2) OS VALORES DE CADA EIXO, DERIVADOS ──────────────────────────────
    const alvoDaSelecao = await page.evaluate(() => {
      for (const g of document.querySelectorAll('.react-flow g[data-camada="sucessao"]')) {
        if (g.getAttribute("data-critica") !== "true") return g.getAttribute("data-destino");
      }
      const q = document.querySelector('.react-flow g[data-camada="sucessao"]');
      return q ? q.getAttribute("data-destino") : null;
    });
    if (alvoDaSelecao === null) {
      exigir(false, `${chave}: §22 nenhuma aresta de sucessão no canvas — o eixo da seleção não tem alvo derivável`);
      return linhas;
    }
    /* A fonte do filtro: a que ESMAECE a ligação do cartão selecionado — nem a
       fonte dele, nem a de nenhum predecessor dele (o dado bruto diz quem são;
       o rótulo do cartão diz a fonte de cada um). É o caso difícil: destaque
       em cima de aresta apagada. */
    const predecessores = UNIVERSO.filter((e) => e.camada === "sucessao" && e.destino === alvoDaSelecao).map((e) => e.origem);
    const fontesNaTela = await page.evaluate((ids) => {
      const deCartao = {};
      for (const no of document.querySelectorAll(".react-flow__node")) {
        const id = no.getAttribute("data-id");
        if (!ids.includes(id)) continue;
        const rotulo = no.querySelector('[role="button"]')?.getAttribute("aria-label") ?? "";
        const m = /, fonte ([^,]+)(?:,|$)/.exec(rotulo);
        deCartao[id] = m ? m[1].trim() : null;
      }
      const noFiltro = [...document.querySelectorAll('fieldset input[type="checkbox"]')].map(
        (cx) => cx.closest("label")?.querySelector("span[title]")?.getAttribute("title") ?? "",
      );
      return { deCartao, noFiltro };
    }, [alvoDaSelecao, ...predecessores]);
    if (fontesNaTela.noFiltro.length < 2) {
      exigir(false, `${chave}: §22 o filtro de fontes tem ${String(fontesNaTela.noFiltro.length)} caixa(s) — o eixo das fontes não tem dois valores`);
      return linhas;
    }
    const fontesDoDestaque = new Set(Object.values(fontesNaTela.deCartao).filter((f) => f !== null));
    const fonteQueEsmaece = fontesNaTela.noFiltro.find((f) => f && !fontesDoDestaque.has(f)) ?? fontesNaTela.noFiltro[0];
    const botoesDePainel = (controlesPorEixo.get("popover") ?? []).map((c) => c.rotulo).filter(Boolean);
    const acoes = [...new Set((controlesPorEixo.get("enquadramento") ?? []).map((c) => c.acao).filter(Boolean))];

    const eixos = [
      {
        nome: "camadas",
        valores: [
          { nome: "todas as camadas", ativas: [...CONTRATO.camadas] },
          { nome: "camadas do default", ativas: [...CONTRATO.camadasDefault] },
          ...CONTRATO.camadas.map((c) => ({
            nome: `sem "${CONTRATO.rotulos[c]}"`,
            ativas: CONTRATO.camadas.filter((x) => x !== c),
          })),
        ],
      },
      {
        nome: "zoom",
        valores: [
          { nome: "zoom do enquadramento", ponta: null },
          { nome: `zoom no piso ${String(CONTRATO.zoomMinimo)}`, ponta: "fora", alvo: CONTRATO.zoomMinimo },
          { nome: `zoom no teto ${String(CONTRATO.zoomMaximo)}`, ponta: "dentro", alvo: CONTRATO.zoomMaximo },
        ],
      },
      {
        nome: "popover",
        valores: [{ nome: "nenhum painel aberto", botao: null }, ...botoesDePainel.map((b) => ({ nome: `"${b}" aberto`, botao: b }))],
      },
      {
        nome: "selecao",
        valores: [
          { nome: "sem seleção", id: null },
          { nome: `"${alvoDaSelecao}" selecionado`, id: alvoDaSelecao },
        ],
      },
      {
        nome: "fontes",
        valores: [
          { nome: "todas as fontes", so: null },
          { nome: `só a fonte "${fonteQueEsmaece}"`, so: fonteQueEsmaece },
        ],
      },
      { nome: "enquadramento", valores: acoes.map((a) => ({ nome: `enquadrado em "${a}"`, acao: a })) },
      {
        nome: "pan",
        valores: [
          { nome: "sem arrasto", arrasta: false },
          { nome: "fundo arrastado", arrasta: true },
        ],
      },
    ];
    const nomesDosEixos = eixos.map((e) => e.nome);
    const eixosDoCodigo = [...new Set(Object.values(ESTADO_DO_GRAFO).map((c) => c.eixo).filter(Boolean))];
    const naoCruzados = eixosDoCodigo.filter((e) => !nomesDosEixos.includes(e));
    exigir(
      naoCruzados.length === 0,
      `${chave}: §22 o código tem estado no(s) eixo(s) ${naoCruzados.join(", ")} e o produto dos gestos não o(s) cruza`,
    );
    const degenerados = eixos.filter((e) => e.valores.length < 2).map((e) => `${e.nome} (${String(e.valores.length)})`);
    if (degenerados.length > 0) {
      exigir(
        false,
        `${chave}: §22 eixo(s) com menos de dois valores: ${degenerados.join(", ")} — um produto com eixo degenerado mede um estado e diz que mediu a classe`,
      );
      return linhas;
    }

    // ── (3) AS COMBINAÇÕES: COBERTURA EM PARES, GERADA E RECONTADA ──────────
    const iCam = nomesDosEixos.indexOf("camadas");
    const iSel = nomesDosEixos.indexOf("selecao");
    const pedeDestaque = (ativas, id) =>
      id !== null && universoNasCamadas(UNIVERSO, ativas).some((e) => e.camada === "sucessao" && e.destino === id);
    const credita = (combo, i, j) => {
      const tocaSelecao = (i === iSel || j === iSel) && eixos[iSel].valores[combo[iSel]].id !== null;
      if (!tocaSelecao) return true;
      if ((i === iCam && j === iSel) || (i === iSel && j === iCam)) return true;
      if (combo[iCam] === null) return false;
      return pedeDestaque(eixos[iCam].valores[combo[iCam]].ativas, eixos[iSel].valores[combo[iSel]].id);
    };
    let geracao;
    try {
      geracao = gerarCoberturaEmPares(eixos, credita);
    } catch (e) {
      exigir(false, `${chave}: §22 a cobertura em pares não fecha: ${String(e?.message ?? e)}`);
      return linhas;
    }
    const iFontes = nomesDosEixos.indexOf("fontes");
    /* Ordem de execução: agrupadas pelo filtro de fontes (trocar o filtro, no
       celular, é ir à aba "Fontes" e voltar). A ordem não muda a cobertura. */
    const combos = [...geracao.combos].sort((x, y) => x[iFontes] - y[iFontes]);
    const faltam = paresSemCobertura(eixos, combos, credita);
    exigir(
      faltam.length === 0,
      `${chave}: §22 ${String(faltam.length)} par(es) de valores sem combinação que os cubra de forma observável: ${faltam.slice(0, 4).join(" ; ")}`,
    );
    linhas.push(
      `eixos derivados: ${eixos.map((e) => `${e.nome} ${String(e.valores.length)}`).join(" × ")} = ${String(
        eixos.reduce((p, e) => p * e.valores.length, 1),
      )} no produto completo · ${String(geracao.total)} pares cobertos por ${String(combos.length)} combinações (cobertura em pares)`,
    );

    // ── (4) CADA COMBINAÇÃO, APLICADA PELOS GESTOS DO PRODUTO, E MEDIDA ─────
    let camadasAplicadas = [...CONTRATO.camadas];
    let destaquesEmPixel = 0;
    let combinacoesQuePedemDestaque = 0;
    /* O piso do pixel é POR VALOR DO ZOOM: um destaque que só se mede em
       pixel no piso deixaria o teto — onde o coordenador achou o defeito —
       aprovado por ausência (forma 2). */
    const destaquePorZoom = new Map();
    const pixelPorZoom = new Map();
    /* E o pixel do destaque tem cobertura de UM fator (declarada): cada valor
       dos eixos que mudam ONDE e COMO o traço chega à tela (zoom, painel,
       fontes, enquadramento, pan), entre as combinações que pedem destaque, é
       medido em pixel ao menos uma vez. O conjunto das destacadas, a cor e a
       pintura computada do traço (largura, opacidade acumulada) continuam
       medidos em TODA combinação. Reduzido na rodada 16: oito medidas em
       pixel por largura (com o "trazer à vista") punham a corrida em 1.913 s
       num núcleo, acima do teto de ~1.800 s do robô. */
    const valorComPixel = new Set();
    const valorPedeDestaque = new Set();
    const valorSoSobFolha = new Set();
    const chaveDoValor = (e, i) => `${e.nome}=${e.valores[i].nome}`;
    /* Camadas e seleção decidem QUAIS arestas são destacadas — isso o
       conjunto do DOM e a pintura computada do traço medem em TODA
       combinação. Os outros eixos decidem ONDE e COMO o traço chega à tela
       (escala, deslocamento, painel por cima, esmaecimento): é neles que o
       pixel tem o que dizer que o DOM não diz. */
    const eixosDoPixel = eixos.filter((e) => e.nome !== "camadas" && e.nome !== "selecao");
    const corDoDestaque = String(CONTRATO.cores.destacada).toUpperCase();
    for (const combo of combos) {
      const v = Object.fromEntries(eixos.map((e, i) => [e.nome, e.valores[combo[i]]]));
      const estado = ` (${eixos.map((e, i) => e.valores[combo[i]].nome).join(" × ")})`;

      await aplicarFontes(page, caso, v.fontes.so);
      await page.locator(`button[data-acao="${v.enquadramento.acao}"]`).first().click({ timeout: 10000 });
      await page.waitForTimeout(250);
      const zoomDoEnquadramento = escalaDe(await transformDoCanvas(page));
      const ativas = v.camadas.ativas;
      const mesmas = ativas.length === camadasAplicadas.length && ativas.every((c) => camadasAplicadas.includes(c));
      if (!mesmas) {
        await aplicarCamadas(page, indiceDaCamada, ativas);
        camadasAplicadas = [...ativas];
      }
      let zoomEsperado = zoomDoEnquadramento;
      if (v.zoom.ponta !== null) {
        const gesto = await gestoDeZoomAteAPonta(page, v.zoom.ponta, v.zoom.alvo, 200, 60);
        if (!gesto.achouBotao || !gesto.alcancavel) {
          exigir(false, `${chave}: §22${estado} o botão "${String(gesto.nome)}" não estava alcançável — o zoom não pôde ser posto na ponta`);
          continue;
        }
        if (gesto.semMedida) continue;
        zoomEsperado = v.zoom.alvo;
      }
      if (v.pan.arrasta) {
        const arrasto = await arrastarOFundo(page);
        if (!arrasto.ok) {
          exigir(false, `${chave}: §22${estado} ${arrasto.motivo} — o pan não pôde ser exercido nesta combinação`);
          continue;
        }
      }
      const aplicou = await aplicarSelecao(page, v.selecao.id);
      if (v.popover.botao !== null) {
        const abriu = await abrirPainelPeloBotao(page, v.popover.botao);
        exigir(abriu, `${chave}: §22${estado} o painel "${v.popover.botao}" não abriu`);
      }

      /* O ESTADO É O QUE A COMBINAÇÃO DIZ? — conferido no instante da medida.
         Um gesto que "foi aplicado" e não pegou mediria outra combinação. */
      const zoomAgora = escalaDe(await transformDoCanvas(page));
      exigir(
        zoomAgora !== null && zoomEsperado !== null && Math.abs(zoomAgora - zoomEsperado) < 1e-3,
        `${chave}: §22${estado} o zoom deveria estar em ${String(zoomEsperado)} e está em ${String(zoomAgora)} — um gesto desfez o outro`,
      );
      const pressionados = await page.evaluate(() =>
        [...document.querySelectorAll('.react-flow__node [role="button"][aria-pressed="true"]')].map((b) =>
          b.closest(".react-flow__node")?.getAttribute("data-id"),
        ),
      );
      exigir(
        aplicou && (v.selecao.id === null ? pressionados.length === 0 : pressionados.includes(v.selecao.id)),
        `${chave}: §22${estado} a seleção não é a da combinação: cartões marcados [${pressionados.join(", ")}]`,
      );

      const leitura = await page.evaluate(LEITURA_DAS_ARESTAS);
      const contrato = await lerContratoDoCanvas(page);
      const contraODado = medirCanvasContraOUniverso(chave, estado, contrato, leitura.arestas, ativas);

      const esmaecidas = leitura.arestas.filter((a) => a.esmaecida).length;
      exigir(
        v.fontes.so === null ? esmaecidas === 0 : esmaecidas > 0,
        v.fontes.so === null
          ? `${chave}: §22${estado} ${String(esmaecidas)} aresta(s) se dizem esmaecidas sem filtro de fonte nenhum`
          : `${chave}: §22${estado} com só "${v.fontes.so}" marcada nenhuma aresta esmaeceu — o valor do eixo das fontes não fez nada`,
      );

      /* O DESTAQUE, como CONJUNTO: exatamente as sucessões que o dado bruto
         faz chegar no cartão selecionado, nas camadas marcadas. */
      const esperadas = pedeDestaque(ativas, v.selecao.id)
        ? universoNasCamadas(UNIVERSO, ativas)
            .filter((e) => e.camada === "sucessao" && e.destino === v.selecao.id)
            .map((e) => e.id)
        : [];
      if (esperadas.length > 0) {
        combinacoesQuePedemDestaque += 1;
        destaquePorZoom.set(v.zoom.nome, (destaquePorZoom.get(v.zoom.nome) ?? 0) + 1);
      }
      const naTela = leitura.arestas.filter((a) => a.papel === "destacada");
      const idsNaTela = naTela.map((a) => a.id);
      const faltaDestaque = esperadas.filter((id) => !idsNaTela.includes(id));
      const sobraDestaque = idsNaTela.filter((id) => !esperadas.includes(id));
      exigir(
        faltaDestaque.length === 0,
        `${chave}: §22${estado} o dado bruto tem ${faltaDestaque.join(", ")} chegando no cartão selecionado e o canvas NÃO a destaca (${String(naTela.length)} destacada(s) na tela, ${String(esperadas.length)} pedida(s)) — o amarelo do predecessor some quando estes gestos se cruzam`,
      );
      exigir(
        sobraDestaque.length === 0,
        `${chave}: §22${estado} ${sobraDestaque.join(", ")} se diz(em) destacada(s) e o dado bruto não tem essa sucessão chegando num cartão selecionado nesta combinação`,
      );
      const problemasDoDestaque = [];
      const tracosDestacados = esperadas.length > 0 ? await page.evaluate(LEITURA_DO_TRACO_DESTACADO) : {};
      for (const a of naTela.filter((x) => esperadas.includes(x.id))) {
        const pisoDoTraco = a.esmaecida ? 0.1 : 0.9;
        const tracos = tracosDestacados[a.id] ?? [];
        const pinta = tracos.some(
          (t) =>
            rgbEmHex(t.stroke) === corDoDestaque && t.largura >= 1 && t.acumulada >= pisoDoTraco && t.visivel && t.tamanho > 0,
        );
        if (!pinta) {
          problemasDoDestaque.push(
            `${a.id}: nenhum traço do grupo pinta o amarelo de verdade — ${tracos
              .map((t) => `${String(rgbEmHex(t.stroke))} largura ${String(t.largura)} opacidade ${t.acumulada.toFixed(2)}${t.visivel ? "" : " escondido"}`)
              .join(", ") || "sem traço"} (piso de opacidade ${String(pisoDoTraco)})`,
          );
        }
        const cor = rgbEmHex(a.corComputada);
        const piso = a.esmaecida ? 0.1 : 0.9;
        if (a.semPath) problemasDoDestaque.push(`${a.id}: sem traço`);
        else if (cor !== corDoDestaque) problemasDoDestaque.push(`${a.id}: pinta ${String(cor)} e o contrato do destaque é ${corDoDestaque}`);
        else if (!a.retrato?.visivelHerdado || (a.retrato?.opacidadeAcumulada ?? 0) < piso) {
          problemasDoDestaque.push(
            `${a.id}: escondida (visível ${String(a.retrato?.visivelHerdado)}, opacidade ${String(a.retrato?.opacidadeAcumulada)} contra o piso ${String(piso)})`,
          );
        }
      }
      let pixel = "sem destaque pedido";
      const valoresDaCombinacao = eixos
        .map((e, i) => (eixosDoPixel.includes(e) ? chaveDoValor(e, combo[i]) : null))
        .filter((k) => k !== null);
      if (esperadas.length > 0) for (const k of valoresDaCombinacao) valorPedeDestaque.add(k);
      const pixelTrazNovidade = valoresDaCombinacao.some((k) => !valorComPixel.has(k));
      if (esperadas.length > 0 && problemasDoDestaque.length === 0 && !pixelTrazNovidade) {
        pixel = "pixel dispensado: todo valor desta combinação já foi medido em pixel (cobertura de 1 fator)";
      } else if (esperadas.length > 0 && problemasDoDestaque.length === 0) {
        const folha = await canvasCobertoPorFolhaModal(page);
        if (folha.coberto) {
          pixel = "pixel não medido: folha modal por cima do canvas";
          if (v.popover.botao !== null) valorSoSobFolha.add(chaveDoValor(eixos[nomesDosEixos.indexOf("popover")], combo[nomesDosEixos.indexOf("popover")]));
        } else {
          const pane = await page.evaluate(() => {
            const el = document.querySelector(".react-flow");
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, largura: r.width, altura: r.height };
          });
          const paineis = await caixasDosPaineisAbertos(page);
          const grupos = await page.$$(SELETOR_DA_ARESTA);
          const partes = [];
          for (const a of naTela.filter((x) => esperadas.includes(x.id))) {
            const g = grupos[leitura.arestas.indexOf(a)];
            if (!g) continue;
            let m = await medirDestaqueEmPixel(page, a, g, leitura.cartoes, pane, paineis);
            if (m === null) {
              /* O zoom jogou o traço para fora da janela (ou para trás de um
                 cartão). "Fora da janela" não é medida: o operador arrasta o
                 fundo para ver — a guarda também, e o zoom tem de continuar
                 o mesmo depois. */
              const zoomAntes = escalaDe(await transformDoCanvas(page));
              const veio = await trazerArestaAVista(page, a.id);
              const zoomDepois = escalaDe(await transformDoCanvas(page));
              exigir(
                zoomAntes !== null && zoomDepois !== null && Math.abs(zoomAntes - zoomDepois) < 1e-6,
                `${chave}: §22${estado} arrastar o fundo para ver o destaque mexeu no ZOOM (${String(zoomAntes)} → ${String(zoomDepois)})`,
              );
              if (veio) {
                const releitura = await page.evaluate(LEITURA_DAS_ARESTAS);
                const indice = releitura.arestas.findIndex((x) => x.id === a.id);
                const nova = releitura.arestas[indice];
                const gNovo = (await page.$$(SELETOR_DA_ARESTA))[indice];
                const cartoesNovos = releitura.cartoes;
                if (nova && gNovo) {
                  exigir(
                    nova.papel === "destacada",
                    `${chave}: §22${estado} ${a.id} deixou de ser destacada depois de arrastar o fundo para vê-la`,
                  );
                  m = await medirDestaqueEmPixel(page, nova, gNovo, cartoesNovos, pane, await caixasDosPaineisAbertos(page));
                }
              }
              if (m === null) {
                partes.push(`${a.id.split("->")[0]}… fora da janela mesmo depois de arrastar o fundo`);
                continue;
              }
              if (!m.erro) partes.push("trazida à vista arrastando o fundo");
            }
            if (m.erro) {
              if (ehErroDeAmbiente(m.erro)) naoConsegui(`${chave}${estado} · ${a.id}: ${m.erro}`);
              else problemasDoDestaque.push(`${a.id}: ${m.erro}`);
              continue;
            }
            destaquesEmPixel += 1;
            pixelPorZoom.set(v.zoom.nome, (pixelPorZoom.get(v.zoom.nome) ?? 0) + 1);
            for (const k of valoresDaCombinacao) valorComPixel.add(k);
            if (m.mudaram < 12) {
              problemasDoDestaque.push(`${a.id}: tem ${String(m.pontos)} ponto(s) livres na tela e só ${String(m.mudaram)} pixel(s) mudam ao escondê-la — o amarelo não está na tela`);
            } else if (m.residuo === null || m.residuo > TOLERANCIA_DE_MISTURA) {
              problemasDoDestaque.push(
                `${a.id}: pinta, mas o que pinta não é o amarelo do contrato (${corDoDestaque}) misturado ao fundo — resíduo ${m.residuo === null ? "?" : m.residuo.toFixed(1)} contra o teto ${String(TOLERANCIA_DE_MISTURA)}`,
              );
            } else partes.push(`${String(m.mudaram)}px amarelos (resíduo ${m.residuo.toFixed(1)})`);
          }
          pixel = partes.join(", ") || "nenhuma destacada com ponto livre";
        }
      }
      exigir(
        problemasDoDestaque.length === 0,
        `${chave}: §22${estado} o destaque do cartão selecionado — ${problemasDoDestaque.slice(0, 3).join(" ; ")}`,
      );
      linhas.push(
        `${eixos.map((e, i) => e.valores[combo[i]].nome).join(" × ")}: zoom ${String(zoomAgora)} · ${contraODado} · esmaecidas ${String(esmaecidas)} · destacadas ${String(naTela.length)}/${String(esperadas.length)} · ${pixel}`,
      );
      if (v.popover.botao !== null) {
        const fechou = await fecharPaineisAbertos(page);
        exigir(fechou, `${chave}: §22${estado} o painel "${v.popover.botao}" não fechou — a próxima combinação herdaria um painel aberto`);
      }
    }
    exigir(
      combinacoesQuePedemDestaque === 0 || destaquesEmPixel > 0,
      `${chave}: §22 ${String(combinacoesQuePedemDestaque)} combinação(ões) pediam destaque e NENHUMA aresta destacada caiu em lugar medível em pixel — não medir é reprovar`,
    );
    /* O piso é POR VALOR DE EIXO: um destaque medido em pixel só no piso do
       zoom deixaria o teto — onde o coordenador achou o defeito — aprovado por
       ausência (forma 2). A única dispensa é o painel que, nesta largura, é
       uma folha MODAL por cima do canvas inteiro: ali não há pixel do canvas
       para medir, e o DOM continua medido. */
    const valoresSemPixel = [...valorPedeDestaque].filter((k) => !valorComPixel.has(k) && !valorSoSobFolha.has(k));
    exigir(
      valoresSemPixel.length === 0,
      `${chave}: §22 ${valoresSemPixel.join(", ")}: houve combinação pedindo destaque com esse valor e o amarelo nunca foi medido em pixel nele — o destaque desse valor seria aprovado por ausência`,
    );
    linhas.push(
      `destaque medido em pixel em ${String(destaquesEmPixel)} aresta(s), ao longo de ${String(combinacoesQuePedemDestaque)} combinação(ões) que o pedem · por zoom: ${[...destaquePorZoom.keys()]
        .map((z) => `${z} ${String(pixelPorZoom.get(z) ?? 0)}/${String(destaquePorZoom.get(z))}`)
        .join(" · ")}`,
    );
    await fecharPaineisAbertos(page);
    exigir(
      errosDePagina.length === 0,
      `${chave}: §22 a página lançou ${String(errosDePagina.length)} erro(s) durante o produto dos gestos: ${errosDePagina[0] ?? ""}`,
    );
  } finally {
    await ctx.close();
  }
  return linhas;
}

// ═══════════════════════════════════════════════════════════════════════════
// §22z / §22p / §22L · OS EIXOS CONTÍNUOS — O OPERADOR PARA NO MEIO
//       (ALTO da rodada 17)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * **O que a rodada 16 deixou aberto.** O eixo do zoom de §22 tinha três
 * valores: o do enquadramento, o piso e o teto. O operador não usa nenhum
 * deles em particular — ele clica "Aumentar zoom" uma, duas, três vezes, ou
 * gira a roda. O coordenador provou com uma linha em `v3-edge.tsx`:
 *
 *     if (zoomSeguro > 1.2 && zoomSeguro < 1.6 && data.destacadaPeloSelecionado === true) return null;
 *
 * "Deploy de produção" selecionado a 1440: 2 ligações destacadas a 0,849,
 * 1,019 e 1,76, e **0** a 1,223 e 1,467 — dois cliques em "Aumentar zoom" —,
 * com a guarda verde em 1024, 1280 e 1440, §22 incluído.
 *
 * **O conserto é a classe.** Nenhum número de zoom é escrito aqui:
 *
 *   1. os FATORES saem da lib instalada (`CONTRATO.fatoresDoZoom`, lidos de
 *      `@reactflow/core` e `d3-zoom` por `eixos-continuos.mjs`): botão ×1,2,
 *      roda 2^(0,002 × notch), duplo clique ×2 (Shift: ×0,5);
 *   2. as PARTIDAS saem da página: o zoom que cada botão de enquadramento dá
 *      naquela largura e naquele estado, o piso e o teto (onde o operador bate
 *      de tanto repetir o gesto e de onde ele volta);
 *   3. o eixo é TODA sequência de um gesto repetido a partir de uma partida,
 *      até a ponta — o conjunto finito que os cliques e a roda alcançam
 *      (47 a 64 valores por largura com o dado do fixture);
 *   4. antes do passeio, os três gestos são feitos DE VERDADE (clique do
 *      Playwright, giro de roda, duplo clique do mouse) e o zoom que eles dão
 *      tem de ser o que a derivação prevê — é o que autoriza o passeio a
 *      repetir o gesto pelo mesmo manipulador (evento no botão e no fundo), e
 *      TODO passo do passeio confere o zoom lido contra o previsto.
 *
 * **Contra o quê cada valor é medido.** Em cada valor: o conjunto das arestas
 * no canvas contra o dado bruto nas camadas marcadas (§12, por id), o
 * conjunto EXATO das destacadas contra o dado, e cada destacada pintando o
 * amarelo do contrato de verdade (cor, largura, opacidade acumulada, visível,
 * comprimento e caixa na tela maiores que zero). O passeio inteiro é refeito
 * para CADA valor do eixo das camadas (sete) com o cartão selecionado, e uma
 * vez sem seleção: todo par (zoom × camadas) e (zoom × seleção). Os painéis,
 * o filtro de fontes e o pan são distribuídos entre os passeios em que o
 * destaque aparece, de modo que todo valor de cada um deles cruza todo valor
 * do zoom onde isso é observável; o enquadramento é cruzado dentro de cada
 * passeio (as sequências partem de cada botão).
 *
 * **Os outros eixos contínuos** estão em `CONTINUIDADE_DOS_EIXOS`, conferida
 * em §0c: o pan (§22p, passos de fundo arrastado até o desenho sair do
 * canvas, nas quatro direções) e a largura da janela (§22L, a trilha de
 * arrastar a borda da janela da menor à maior largura da tabela, com os dois
 * lados de cada corte que o produto declara).
 *
 * **O que fica fora, dito por extenso:** o contínuo ENTRE os valores medidos
 * — pinça, trackpad, roda de notch diferente e gestos misturados levam o zoom
 * a qualquer número entre o piso e o teto; o maior vão entre dois valores
 * medidos sai impresso por largura, e uma faixa de defeito mais estreita que
 * ele pode escapar. O pixel do amarelo nos valores do meio: o passeio mede
 * DOM, pintura computada e caixa na tela em todo valor; o pixel continua nos
 * três valores de §22 (o custo de uma foto por valor seria ~50 fotos por
 * largura). Pan e largura cruzados com o zoom (cada um é medido no zoom que o
 * produto dá naquele ponto, não na sequência inteira).
 */

/**
 * CADA EIXO DE §22 É CONTÍNUO OU DISCRETO — e o contínuo tem um passeio que o
 * percorre. Conferida em §0c: eixo exercido sem classificação reprova.
 */
const CONTINUIDADE_DOS_EIXOS = {
  camadas: {
    discreto:
      "cinco caixas, cada uma marcada ou não — não há valor entre as duas. §22 mede todas, o default e cada camada sozinha desligada; duas ou mais desligadas ficam fora (declarado em §22)",
  },
  popover: { discreto: "cada painel está aberto ou fechado — não há meio-aberto que o operador escolha" },
  selecao: {
    discreto:
      "um cartão está selecionado ou não; o alvo é derivado do dado bruto (o destino de sucessão com mais predecessores nos passeios, o primeiro destino não crítico em §22)",
  },
  fontes: { discreto: "cada fonte está marcada no filtro ou não" },
  enquadramento: { discreto: "cada botão de enquadramento dá UM zoom e UM pan naquela largura e naquele estado" },
  zoom: { continuo: "§22z o passeio do zoom", porQue: "o operador repete o clique e gira a roda: para em qualquer valor da sequência" },
  pan: { continuo: "§22p o passeio do pan", porQue: "arrastar o fundo leva o canvas a qualquer deslocamento, px a px" },
  largura: { continuo: "§22L a trilha da largura", porQue: "arrastar a borda da janela passa por toda largura entre as cinco da tabela" },
};

/** Conferência de §0c para a tabela acima. */
function conferirContinuidadeDosEixos() {
  const problemas = [];
  for (const eixo of [...EIXOS_EXERCIDOS, "largura"]) {
    const c = CONTINUIDADE_DOS_EIXOS[eixo];
    if (!c) {
      problemas.push(`o eixo "${eixo}" não diz se é contínuo ou discreto — um eixo contínuo sem passeio mede três valores e diz que mediu a classe`);
      continue;
    }
    if (c.continuo === undefined && (typeof c.discreto !== "string" || c.discreto.length < 30)) {
      problemas.push(`o eixo "${eixo}" está declarado discreto sem motivo escrito`);
    }
  }
  for (const eixo of Object.keys(CONTINUIDADE_DOS_EIXOS)) {
    if (eixo !== "largura" && !EIXOS_EXERCIDOS.includes(eixo)) problemas.push(`CONTINUIDADE_DOS_EIXOS descreve "${eixo}", que §22 não exerce`);
  }
  return problemas;
}

/**
 * OS PISOS, À MÃO, contados sobre o que a PÁGINA mostrou — nunca sobre o
 * plano que gerou os passos (a medida não pode contar a si mesma).
 *
 *   - zoom: menor contagem medida na árvore honesta foi 47 valores distintos
 *     por passeio (390 px); o piso é 40;
 *   - pan: passos de 40 px (a resolução declarada), e ao menos 40 leituras
 *     somando as quatro direções;
 *   - largura: passos de 32 px da menor à maior largura da tabela, mais os
 *     cortes; ao menos 45 larguras lidas.
 */
const PISO_DE_VALORES_DE_ZOOM = 40;
const PASSO_DO_PAN_PX = 40;
const PISO_DE_LEITURAS_DO_PAN = 40;
const TETO_DE_PASSOS_DO_PAN_POR_DIRECAO = 80;
const PASSO_DA_TRILHA_DE_LARGURA_PX = 32;
const PISO_DE_LARGURAS_DA_TRILHA = 45;

/** Os passeios que rodaram, por largura — §0c confere no fim que todo eixo contínuo teve o seu. */
const PASSEIOS_FEITOS = new Map();
function anotarPasseio(nome, chave) {
  PASSEIOS_FEITOS.set(nome, new Set([...(PASSEIOS_FEITOS.get(nome) ?? []), chave]));
}

/** O cartão cujo destaque os passeios acompanham: o destino de sucessão com mais predecessores no dado bruto. */
function alvoDosPasseios() {
  const conta = new Map();
  for (const e of UNIVERSO) if (e.camada === "sucessao") conta.set(e.destino, (conta.get(e.destino) ?? 0) + 1);
  const ordem = [...conta.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  return ordem[0]?.[0] ?? null;
}

/**
 * O ajudante que roda NA PÁGINA: lê o estado do grafo e repete os gestos pelo
 * mesmo manipulador que o operador aciona (o `onClick` do botão, o ouvinte de
 * roda e de duplo clique do fundo, o arrasto do fundo). Instalado uma vez por
 * página.
 */
function instalarPasseioNaPagina(notch) {
  if (window.__lbPasseio) return true;
  const quadro = () => new Promise((r) => window.requestAnimationFrame(() => r()));
  const matriz = () => {
    const v = document.querySelector(".react-flow__viewport");
    return v ? new window.DOMMatrix(getComputedStyle(v).transform) : null;
  };
  const ler = () => {
    const arestas = [];
    const destacadas = [];
    for (const g of document.querySelectorAll(".react-flow g[data-camada]")) {
      const path = g.querySelector("path.lb-edge-path");
      if (!path) continue;
      const id = g.getAttribute("data-aresta-id");
      const esmaecida = g.getAttribute("data-esmaecida") === "true";
      arestas.push({ id, camada: g.getAttribute("data-camada"), critica: g.getAttribute("data-critica") === "true", esmaecida });
      if (!g.classList.contains("lb-edge-destacada")) continue;
      const tracos = [];
      for (const p of g.querySelectorAll("path.lb-edge-path")) {
        const c = getComputedStyle(p);
        let acumulada = Number(c.opacity) * Number(c.strokeOpacity);
        let visivel = c.visibility === "visible" && c.display !== "none";
        for (let n = p.parentElement; n && n.nodeType === 1; n = n.parentElement) {
          const cn = getComputedStyle(n);
          acumulada *= Number(cn.opacity);
          if (cn.display === "none" || cn.visibility === "hidden") visivel = false;
        }
        const r = p.getBoundingClientRect();
        tracos.push({ stroke: c.stroke, largura: parseFloat(c.strokeWidth), acumulada, visivel, tamanho: p.getTotalLength(), caixa: r.width + r.height });
      }
      destacadas.push({ id, esmaecida, tracos });
    }
    const m = matriz();
    const pane = document.querySelector(".react-flow__pane")?.getBoundingClientRect() ?? null;
    let cartoesNoCanvas = 0;
    for (const no of document.querySelectorAll(".react-flow__node")) {
      const r = no.getBoundingClientRect();
      if (pane && r.right > pane.left && r.left < pane.right && r.bottom > pane.top && r.top < pane.bottom) cartoesNoCanvas += 1;
    }
    return {
      z: m ? m.a : null,
      x: m ? m.e : null,
      y: m ? m.f : null,
      arestas,
      destacadas,
      pressionados: [...document.querySelectorAll('.react-flow__node [role="button"][aria-pressed="true"]')].map((b) =>
        b.closest(".react-flow__node")?.getAttribute("data-id"),
      ),
      paineis: [...document.querySelectorAll('button[aria-haspopup="dialog"][aria-expanded="true"]')].map((b) => b.getAttribute("aria-label")),
      largura: window.innerWidth,
      altura: window.innerHeight,
      canvas: m !== null,
      cartoesNoCanvas,
    };
  };
  /* O DESENHO ASSENTADO: o mesmo número de traços e de destacadas por três
     quadros seguidos. Medido na árvore honesta: ao cruzar o zoom 0,85 (o
     cartão troca de modo e é medido de novo) as arestas somem por UM quadro
     e voltam — a leitura é do que fica na tela, não do quadro de passagem. */
  const assinatura = () =>
    `${String(document.querySelectorAll(".react-flow g[data-camada] path.lb-edge-path").length)}/${String(document.querySelectorAll(".react-flow g.lb-edge-destacada").length)}`;
  const desenhoAssentado = async (maxMs) => {
    const t0 = window.performance.now();
    let ultima = assinatura();
    let iguais = 0;
    while (iguais < 3 && window.performance.now() - t0 < maxMs) {
      await quadro();
      const agora = assinatura();
      iguais = agora === ultima ? iguais + 1 : 0;
      ultima = agora;
    }
  };
  /* Assenta: espera o zoom chegar ao previsto (ou, sem previsto, ficar parado seis quadros) e o desenho assentar. */
  const assentar = async (alvo, maxMs) => {
    await assentarZoom(alvo, maxMs);
    await desenhoAssentado(1500);
  };
  const assentarZoom = async (alvo, maxMs) => {
    const t0 = window.performance.now();
    let ultimo = null;
    let iguais = 0;
    for (;;) {
      await quadro();
      const z = matriz()?.a ?? null;
      if (alvo !== null && z !== null && Math.abs(z - alvo) <= 1e-4 * Math.max(1, alvo)) {
        await quadro();
        return;
      }
      if (alvo === null) {
        if (z !== null && z === ultimo) {
          iguais += 1;
          if (iguais >= 6) return;
        } else iguais = 0;
        ultimo = z;
      }
      if (window.performance.now() - t0 > maxMs) return;
    }
  };
  const centroDoFundo = () => {
    const pane = document.querySelector(".react-flow__pane");
    if (!pane) return null;
    const r = pane.getBoundingClientRect();
    return { pane, x: r.x + r.width / 2, y: r.y + r.height / 2, r };
  };
  const gesto = async (nome, sentido, alvo) => {
    if (nome === "botão") {
      const b = document.querySelector(`button[aria-label="${sentido === "dentro" ? "Aumentar zoom" : "Diminuir zoom"}"]`);
      if (!b) return `não achei o botão de zoom (${sentido})`;
      b.click();
      await assentar(alvo, 800);
      return null;
    }
    const c = centroDoFundo();
    if (!c) return "não achei o fundo do canvas";
    if (nome === "roda") {
      c.pane.dispatchEvent(
        new window.WheelEvent("wheel", { bubbles: true, cancelable: true, view: window, clientX: c.x, clientY: c.y, deltaMode: 0, deltaY: sentido === "dentro" ? -notch : notch }),
      );
      await assentar(alvo, 800);
      return null;
    }
    if (nome === "duplo clique") {
      c.pane.dispatchEvent(
        new window.MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window, clientX: c.x, clientY: c.y, shiftKey: sentido === "fora" }),
      );
      await assentar(alvo, 2000);
      return null;
    }
    return `gesto desconhecido: ${nome}`;
  };
  const arrastar = async (dx, dy) => {
    const c = centroDoFundo();
    if (!c) return false;
    let ponto = null;
    for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85, 0.05, 0.95]) {
      for (const fy of [0.5, 0.3, 0.7, 0.12, 0.88]) {
        const x = c.r.x + c.r.width * fx;
        const y = c.r.y + c.r.height * fy;
        if (!ponto && document.elementFromPoint(x, y) === c.pane) ponto = { x, y };
      }
    }
    if (!ponto) ponto = { x: c.x, y: c.y };
    const ev = (tipo, x, y, alvo) =>
      alvo.dispatchEvent(new window.MouseEvent(tipo, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons: tipo === "mouseup" ? 0 : 1 }));
    ev("mousedown", ponto.x, ponto.y, c.pane);
    for (let i = 1; i <= 4; i += 1) ev("mousemove", ponto.x + (dx * i) / 4, ponto.y + (dy * i) / 4, window);
    ev("mouseup", ponto.x + dx, ponto.y + dy, window);
    await quadro();
    await quadro();
    return true;
  };
  window.__lbPasseio = {
    ler,
    async enquadrar(acao, arrasto) {
      const b = document.querySelector(`button[data-acao="${acao}"]`);
      if (!b) return { erro: `não achei o botão de enquadramento "${acao}"` };
      b.click();
      await assentar(null, 3000);
      if (arrasto) {
        await arrastar(arrasto.dx, arrasto.dy);
        await assentar(null, 1000);
      }
      return { leitura: ler() };
    },
    async trecho(passos) {
      const saida = [];
      for (const p of passos) {
        const erro = await gesto(p.gesto, p.sentido, p.alvo);
        saida.push({ erro, leitura: ler() });
      }
      return saida;
    },
    async arrastarEmPassos(dx, dy, maximo) {
      const saida = [];
      for (let i = 0; i < maximo; i += 1) {
        if (!(await arrastar(dx, dy))) return { erro: "não achei o fundo do canvas para arrastar", saida };
        const l = ler();
        saida.push(l);
        if (l.cartoesNoCanvas === 0) break;
      }
      return { saida };
    },
  };
  return true;
}

/**
 * O que cada leitura de passeio TEM de mostrar, contra o dado bruto. Devolve
 * a lista de problemas (vazia = a leitura se sustenta).
 */
function conferirLeituraDoPasseio(l, esperado) {
  const problemas = [];
  if (!l.canvas) return ["o canvas do grafo sumiu"];
  if (esperado.z !== null && (l.z === null || Math.abs(l.z - esperado.z) > 1e-3 * Math.max(1, esperado.z))) {
    problemas.push(`o zoom lido é ${String(l.z)} e o gesto, pela lib, leva a ${esperado.z.toFixed(4)}`);
  }
  const noDado = universoNasCamadas(UNIVERSO, esperado.ativas);
  const idsNoDado = new Set(noDado.map((e) => e.id));
  const idsNaTela = new Set(l.arestas.map((a) => a.id));
  const faltam = [...idsNoDado].filter((id) => !idsNaTela.has(id));
  const sobram = [...idsNaTela].filter((id) => !idsNoDado.has(id));
  if (faltam.length > 0) problemas.push(`${String(faltam.length)} aresta(s) do dado bruto fora do canvas: ${faltam.slice(0, 2).join(", ")}`);
  if (sobram.length > 0) problemas.push(`${String(sobram.length)} aresta(s) no canvas que o dado não pede nestas camadas: ${sobram.slice(0, 2).join(", ")}`);
  const pedidas =
    esperado.selecao === null
      ? []
      : noDado.filter((e) => e.camada === "sucessao" && e.destino === esperado.selecao).map((e) => e.id);
  const destacadasNaTela = l.destacadas.map((d) => d.id);
  const faltaDestaque = pedidas.filter((id) => !destacadasNaTela.includes(id));
  const sobraDestaque = destacadasNaTela.filter((id) => !pedidas.includes(id));
  if (faltaDestaque.length > 0) {
    problemas.push(`o dado tem ${faltaDestaque.join(", ")} chegando no cartão selecionado e o canvas NÃO a destaca (${String(destacadasNaTela.length)}/${String(pedidas.length)})`);
  }
  if (sobraDestaque.length > 0) problemas.push(`${sobraDestaque.join(", ")} se diz(em) destacada(s) sem sucessão chegando num cartão selecionado`);
  const corDoDestaque = String(CONTRATO.cores.destacada).toUpperCase();
  for (const d of l.destacadas.filter((x) => pedidas.includes(x.id))) {
    const piso = d.esmaecida ? 0.1 : 0.9;
    const pinta = d.tracos.some(
      (t) => rgbEmHex(t.stroke) === corDoDestaque && t.largura >= 1 && t.acumulada >= piso && t.visivel && t.tamanho > 0 && t.caixa >= 2,
    );
    if (!pinta) {
      problemas.push(
        `${d.id} destacada não pinta o amarelo de verdade — ${d.tracos
          .map((t) => `${String(rgbEmHex(t.stroke))} largura ${String(t.largura)} opacidade ${t.acumulada.toFixed(2)} caixa ${t.caixa.toFixed(1)}px${t.visivel ? "" : " escondido"}`)
          .join(", ") || "sem traço"}`,
      );
    }
  }
  const quer = esperado.selecao === null ? [] : [esperado.selecao];
  if (l.pressionados.length !== quer.length || !quer.every((id) => l.pressionados.includes(id))) {
    problemas.push(`a seleção deveria ser [${quer.join(", ")}] e os cartões marcados são [${l.pressionados.join(", ")}]`);
  }
  if (esperado.painel !== undefined) {
    const quero = esperado.painel === null ? [] : [esperado.painel];
    if (l.paineis.length !== quero.length || !quero.every((p) => l.paineis.includes(p))) {
      problemas.push(`o painel aberto deveria ser [${quero.join(", ")}] e é [${l.paineis.join(", ")}]`);
    }
  }
  if (esperado.fonte !== undefined) {
    const esmaecidas = l.arestas.filter((a) => a.esmaecida).length;
    if (esperado.fonte === null ? esmaecidas > 0 : esmaecidas === 0) {
      problemas.push(esperado.fonte === null ? `${String(esmaecidas)} aresta(s) esmaecidas sem filtro de fonte` : `com só "${esperado.fonte}" marcada nenhuma aresta esmaeceu`);
    }
  }
  return problemas;
}

/**
 * Os controles da seção do grafo e as caixas do painel "Camadas" — a mesma
 * leitura de §22, para os passeios.
 */
async function lerControlesParaOsPasseios(page, chave, secao) {
  const controles = await page.evaluate(LEITURA_DOS_CONTROLES);
  if (controles === null) {
    exigir(false, `${chave}: ${secao} não achei a seção "Grafo de dependências"`);
    return null;
  }
  const controlesPorEixo = new Map();
  for (const c of controles) {
    const regra = CONTROLES_DO_GRAFO.find((r) => r.casa(c));
    if (regra?.eixo) controlesPorEixo.set(regra.eixo, [...(controlesPorEixo.get(regra.eixo) ?? []), c]);
  }
  await ligarTodasAsCamadas(page);
  await page.waitForTimeout(300);
  const painel = await abrirPainelDeCamadas(page);
  if (painel === null) {
    exigir(false, `${chave}: ${secao} não achei o controle "Camadas"`);
    return null;
  }
  const porRotulo = new Map(CONTRATO.camadas.map((c) => [CONTRATO.rotulos[c], c]));
  const indiceDaCamada = new Map();
  painel.rotulos.forEach((r, i) => {
    const camada = porRotulo.get(r.texto);
    if (camada) indiceDaCamada.set(camada, i);
  });
  await fecharPainelDeCamadas(page);
  const semCaixa = CONTRATO.camadas.filter((c) => !indiceDaCamada.has(c));
  if (semCaixa.length > 0) {
    exigir(false, `${chave}: ${secao} camada sem caixa no painel: ${semCaixa.join(", ")}`);
    return null;
  }
  return { controlesPorEixo, indiceDaCamada };
}

/**
 * Os três gestos, DE VERDADE (Playwright: clique no botão, giro de roda,
 * duplo clique do mouse no fundo), contra o fator que a lib declara. É o que
 * autoriza o passeio a repetir o gesto pelo mesmo manipulador sem o robô
 * mover o mouse a cada passo.
 */
async function conferirGestosDeVerdade(page, chave, gestos, acao) {
  const problemas = [];
  const ler = async () => escalaDe(await transformDoCanvas(page));
  const pontoDoFundo = async () =>
    page.evaluate(() => {
      const pane = document.querySelector(".react-flow__pane");
      if (!pane) return null;
      const r = pane.getBoundingClientRect();
      for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
        for (const fy of [0.5, 0.3, 0.7, 0.12, 0.88]) {
          const x = r.x + r.width * fx;
          const y = r.y + r.height * fy;
          if (document.elementFromPoint(x, y) === pane) return { x, y };
        }
      }
      return null;
    });
  const feitos = [];
  for (const g of gestos) {
    await page.locator(`button[data-acao="${acao}"]`).first().click({ timeout: 10000 });
    await page.waitForTimeout(700);
    const antes = await ler();
    if (g.nome === "botão") {
      await page.locator('button[aria-label="Aumentar zoom"]').first().click({ timeout: 10000 });
      await page.waitForTimeout(300);
    } else {
      const p = await pontoDoFundo();
      if (p === null) {
        problemas.push(`não achei um ponto livre do fundo para o gesto "${g.nome}" de verdade`);
        continue;
      }
      await page.mouse.move(p.x, p.y);
      if (g.nome === "roda") await page.mouse.wheel(0, -NOTCH_DA_RODA_PX);
      else await page.mouse.dblclick(p.x, p.y);
      await page.waitForTimeout(g.nome === "roda" ? 400 : 900);
    }
    const depois = await ler();
    const previsto = Math.max(CONTRATO.zoomMinimo, Math.min(CONTRATO.zoomMaximo, (antes ?? 0) * g.dentro));
    if (antes === null || depois === null || Math.abs(depois - previsto) > 1e-3 * Math.max(1, previsto)) {
      problemas.push(`${g.nome} de verdade levou ${String(antes)} a ${String(depois)} e a lib prevê ${previsto.toFixed(4)}`);
    } else feitos.push(`${g.nome} ×${g.dentro.toFixed(4)}`);
  }
  exigir(
    problemas.length === 0,
    `${chave}: §22z o gesto de verdade não dá o fator que a lib declara — ${problemas.join(" ; ")}. O passeio (que repete o gesto pelo mesmo manipulador) não mediria o que o operador alcança`,
  );
  return feitos;
}

/**
 * O amarelo do destaque NA TELA, em pixel, no estado em que o passeio está —
 * o mesmo modelo de §22 (esconde o traço, compara as fotos, confere a mistura
 * do amarelo do contrato com o fundo), trazendo a aresta à vista arrastando o
 * fundo quando o zoom a jogou para fora. Só o pan muda; o zoom é conferido.
 */
async function medirPixelDoDestaqueNoPasseio(page, esperadas) {
  const problemas = [];
  const partes = [];
  let medidas = 0;
  if (esperadas.length === 0) return { problemas, medidas, linha: "sem destaque pedido" };
  const folha = await canvasCobertoPorFolhaModal(page);
  if (folha.coberto) return { problemas, medidas, linha: "folha modal por cima" };
  const pane = await page.evaluate(() => {
    const el = document.querySelector(".react-flow");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, largura: r.width, altura: r.height };
  });
  for (const id of esperadas) {
    let leitura = await page.evaluate(LEITURA_DAS_ARESTAS);
    let indice = leitura.arestas.findIndex((x) => x.id === id);
    if (indice < 0) {
      problemas.push(`${id} não está no canvas para a foto`);
      continue;
    }
    let m = await medirDestaqueEmPixel(page, leitura.arestas[indice], (await page.$$(SELETOR_DA_ARESTA))[indice], leitura.cartoes, pane, await caixasDosPaineisAbertos(page));
    if (m === null) {
      const zoomAntes = escalaDe(await transformDoCanvas(page));
      const veio = await trazerArestaAVista(page, id);
      const zoomDepois = escalaDe(await transformDoCanvas(page));
      if (zoomAntes === null || zoomDepois === null || Math.abs(zoomAntes - zoomDepois) > 1e-6) {
        problemas.push(`arrastar o fundo para ver ${id} mexeu no zoom (${String(zoomAntes)} → ${String(zoomDepois)})`);
      }
      /* Mede de novo mesmo sem o meio no centro: basta um pedaço da aresta na tela. */
      {
        leitura = await page.evaluate(LEITURA_DAS_ARESTAS);
        indice = leitura.arestas.findIndex((x) => x.id === id);
        if (indice >= 0) {
          if (leitura.arestas[indice].papel !== "destacada") problemas.push(`${id} deixou de ser destacada depois de arrastar o fundo para vê-la`);
          m = await medirDestaqueEmPixel(page, leitura.arestas[indice], (await page.$$(SELETOR_DA_ARESTA))[indice], leitura.cartoes, pane, await caixasDosPaineisAbertos(page));
        }
      }
      if (m === null) {
        problemas.push(`${id} fora da janela mesmo depois de arrastar o fundo (o meio ${veio ? "chegou" : "não chegou"} ao centro do canvas) — o amarelo não pôde ser visto`);
        continue;
      }
    }
    if (m.erro) {
      if (ehErroDeAmbiente(m.erro)) naoConsegui(`§22z · ${id}: ${m.erro}`);
      else problemas.push(`${id}: ${m.erro}`);
      continue;
    }
    medidas += 1;
    if (m.mudaram < 12) problemas.push(`${id}: ${String(m.pontos)} ponto(s) livres e só ${String(m.mudaram)} pixel(s) mudam ao escondê-la — o amarelo não está na tela`);
    else if (m.residuo === null || m.residuo > TOLERANCIA_DE_MISTURA) problemas.push(`${id}: o que pinta não é o amarelo do contrato misturado ao fundo (resíduo ${m.residuo === null ? "?" : m.residuo.toFixed(1)})`);
    else partes.push(`${String(m.mudaram)}px`);
  }
  return { problemas, medidas, linha: partes.join("+") || "sem medida" };
}

async function medirPasseioDoZoom(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  const { ctx, page, errosDePagina, semCanvas } = await abrirPagina(browser, caso);
  const linhas = [];
  try {
    if (semCanvas) return linhas;
    const base = await lerControlesParaOsPasseios(page, chave, "§22z");
    if (base === null) return linhas;
    const { controlesPorEixo, indiceDaCamada } = base;
    const alvo = alvoDosPasseios();
    if (alvo === null) {
      exigir(false, `${chave}: §22z o dado bruto não tem sucessão nenhuma — o destaque não tem alvo`);
      return linhas;
    }
    const acoes = [...new Set((controlesPorEixo.get("enquadramento") ?? []).map((c) => c.acao).filter(Boolean))];
    const botoesDePainel = (controlesPorEixo.get("popover") ?? []).map((c) => c.rotulo).filter(Boolean);
    const inventario = CONTRATO.inventarioDoEstado;
    const gestos = gestosDoZoom(CONTRATO.fatoresDoZoom, {
      botoes: (controlesPorEixo.get("zoom") ?? []).length >= 2,
      roda: inventario.includes("gesto da lib zoomOnScroll"),
      duploClique: inventario.includes("gesto da lib zoomOnDoubleClick"),
    });
    if (acoes.length === 0 || gestos.length === 0) {
      exigir(false, `${chave}: §22z sem botão de enquadramento (${String(acoes.length)}) ou sem gesto de zoom (${String(gestos.length)}) — o passeio não tem de onde partir`);
      return linhas;
    }
    const verdade = await conferirGestosDeVerdade(page, chave, gestos, acoes[0]);

    /* A fonte que esmaece a ligação do alvo — mesma derivação de §22. */
    const predecessores = UNIVERSO.filter((e) => e.camada === "sucessao" && e.destino === alvo).map((e) => e.origem);
    const fontesNaTela = await page.evaluate((ids) => {
      const deCartao = {};
      for (const no of document.querySelectorAll(".react-flow__node")) {
        const id = no.getAttribute("data-id");
        if (!ids.includes(id)) continue;
        const rotulo = no.querySelector('[role="button"]')?.getAttribute("aria-label") ?? "";
        const m = /, fonte ([^,]+)(?:,|$)/.exec(rotulo);
        deCartao[id] = m ? m[1].trim() : null;
      }
      const noFiltro = [...document.querySelectorAll('fieldset input[type="checkbox"]')].map(
        (cx) => cx.closest("label")?.querySelector("span[title]")?.getAttribute("title") ?? "",
      );
      return { deCartao, noFiltro };
    }, [alvo, ...predecessores]);
    const fontesDoDestaque = new Set(Object.values(fontesNaTela.deCartao).filter((f) => f !== null));
    const fonteQueEsmaece = fontesNaTela.noFiltro.find((f) => f && !fontesDoDestaque.has(f)) ?? fontesNaTela.noFiltro[0] ?? null;

    /* OS PASSEIOS: um por valor do eixo das camadas, com o alvo selecionado,
       e um sem seleção. Painel, fontes e pan distribuídos entre os passeios
       em que o destaque aparece. */
    const valoresDeCamadas = [
      { nome: "todas as camadas", ativas: [...CONTRATO.camadas] },
      { nome: "camadas do default", ativas: [...CONTRATO.camadasDefault] },
      ...CONTRATO.camadas.map((c) => ({ nome: `sem "${CONTRATO.rotulos[c]}"`, ativas: CONTRATO.camadas.filter((x) => x !== c) })),
    ];
    const passeios = valoresDeCamadas.map((c) => ({ camadas: c, selecao: alvo, painel: null, fonte: null, arrasta: false }));
    /* O passeio SEM seleção é o das camadas em que o destaque não aparece
       (sem "Sucessão"): cobre o par (zoom × sem seleção) e o par (zoom × sem
       "Sucessão") na mesma volta — o destaque "calado com o cartão
       selecionado e a Sucessão desligada" fica nos três valores de §22. */
    for (const p of passeios) {
      if (!universoNasCamadas(UNIVERSO, p.camadas.ativas).some((e) => e.camada === "sucessao" && e.destino === alvo)) p.selecao = null;
    }
    if (!passeios.some((p) => p.selecao === null)) passeios.push({ camadas: valoresDeCamadas[0], selecao: null, painel: null, fonte: null, arrasta: false });
    const observaveis = passeios.filter((p) =>
      p.selecao !== null && universoNasCamadas(UNIVERSO, p.camadas.ativas).some((e) => e.camada === "sucessao" && e.destino === p.selecao),
    );
    const paineis = [null, ...botoesDePainel];
    const fontes = fonteQueEsmaece === null ? [null] : [null, fonteQueEsmaece];
    observaveis.forEach((p, i) => {
      p.painel = paineis[i % paineis.length];
      p.fonte = fontes[i % fontes.length];
      p.arrasta = Math.floor(i / 2) % 2 === 1;
    });
    const faltaValor = [
      ...paineis.filter((v) => !observaveis.some((p) => p.painel === v)).map((v) => `painel ${String(v)}`),
      ...fontes.filter((v) => !observaveis.some((p) => p.fonte === v)).map((v) => `fonte ${String(v)}`),
      ...[false, true].filter((v) => !observaveis.some((p) => p.arrasta === v)).map((v) => `pan ${String(v)}`),
    ];
    exigir(faltaValor.length === 0, `${chave}: §22z valor(es) de eixo que não cruzam o zoom em passeio observável nenhum: ${faltaValor.join(", ")}`);

    await page.evaluate(instalarPasseioNaPagina, NOTCH_DA_RODA_PX);
    let camadasAplicadas = [...CONTRATO.camadas];
    const pixelNoPasseio = [];
    const valoresComPixel = new Set();
    const valoresQuePedemPixel = new Set();
    let menorContagem = Infinity;
    let maiorVaoVisto = { vao: 0, entre: null };
    let passos = 0;
    const t0 = Date.now();
    for (const p of passeios) {
      const estado = ` (passeio: ${p.camadas.nome} × ${p.selecao === null ? "sem seleção" : `"${p.selecao}" selecionado`} × ${p.painel === null ? "nenhum painel" : `"${p.painel}" aberto`} × ${p.fonte === null ? "todas as fontes" : `só "${p.fonte}"`} × ${p.arrasta ? "fundo arrastado" : "sem arrasto"})`;
      await fecharPaineisAbertos(page);
      await aplicarFontes(page, caso, p.fonte);
      await page.evaluate(instalarPasseioNaPagina, NOTCH_DA_RODA_PX);
      const mesmas = p.camadas.ativas.length === camadasAplicadas.length && p.camadas.ativas.every((c) => camadasAplicadas.includes(c));
      if (!mesmas) {
        await aplicarCamadas(page, indiceDaCamada, p.camadas.ativas);
        camadasAplicadas = [...p.camadas.ativas];
      }
      await aplicarSelecao(page, p.selecao);
      /* As partidas: o zoom que cada botão de enquadramento dá NESTE estado. */
      const partidas = [];
      for (const acao of acoes) {
        const r = await page.evaluate((a) => window.__lbPasseio.enquadrar(a, null), acao);
        if (r.erro || r.leitura.z === null) {
          exigir(false, `${chave}: §22z${estado} ${r.erro ?? "o enquadramento não deu zoom legível"}`);
          continue;
        }
        partidas.push({ acao, z: r.leitura.z });
      }
      if (partidas.length === 0) continue;
      let plano;
      try {
        plano = planoDoPasseioDoZoom({ partidas, piso: CONTRATO.zoomMinimo, teto: CONTRATO.zoomMaximo, gestos });
      } catch (e) {
        exigir(false, `${chave}: §22z${estado} o plano do passeio não fecha: ${String(e?.message ?? e)}`);
        continue;
      }
      if (p.painel !== null) {
        const abriu = await abrirPainelPeloBotao(page, p.painel);
        exigir(abriu, `${chave}: §22z${estado} o painel "${p.painel}" não abriu`);
      }
      const tDoPasseio = Date.now();
      const esperadoBase = { ativas: p.camadas.ativas, selecao: p.selecao, painel: p.painel, fonte: p.fonte };
      const arrasto = p.arrasta ? { dx: -70, dy: -50 } : null;
      const problemas = [];
      const vistos = [];
      for (const t of plano.trechos) {
        if (t.tipo === "enquadrar") {
          const r = await page.evaluate(({ a, arr }) => window.__lbPasseio.enquadrar(a, arr), { a: t.acao, arr: arrasto });
          if (r.erro) {
            problemas.push(r.erro);
            continue;
          }
          passos += 1;
          vistos.push(r.leitura.z);
          for (const pr of conferirLeituraDoPasseio(r.leitura, { ...esperadoBase, z: t.previsto })) problemas.push(`enquadrado em "${t.acao}": ${pr}`);
          continue;
        }
        const pedido = t.previstos.map((alvoZ) => ({ gesto: t.gesto, sentido: t.sentido, alvo: alvoZ }));
        /* O PIXEL, nas sequências que partem do enquadramento (os cliques e
           as notches do operador a partir da tela como ela abre), no primeiro
           passeio em que o destaque aparece: passo a passo, com a foto. */
        const comPixel = p === observaveis[0] && t.partida.startsWith("enquadramento");
        const saida = [];
        if (comPixel) {
          for (const passo of pedido) {
            const [um] = await page.evaluate((ps) => window.__lbPasseio.trecho(ps), [passo]);
            saida.push(um);
            if (um.erro) continue;
            const r = await medirPixelDoDestaqueNoPasseio(page, universoNasCamadas(UNIVERSO, p.camadas.ativas).filter((e) => e.camada === "sucessao" && e.destino === p.selecao).map((e) => e.id));
            pixelNoPasseio.push(`${passo.alvo.toFixed(3)} ${r.linha}`);
            for (const pr of r.problemas) problemas.push(`${t.gesto} a partir do ${t.partida}, zoom ${passo.alvo.toFixed(3)}: ${pr}`);
            if (r.medidas > 0) valoresComPixel.add(passo.alvo.toFixed(4));
            valoresQuePedemPixel.add(passo.alvo.toFixed(4));
          }
        } else saida.push(...(await page.evaluate((ps) => window.__lbPasseio.trecho(ps), pedido)));
        saida.forEach((s, i) => {
          passos += 1;
          const onde = `${t.gesto} ${t.sentido === "dentro" ? "para dentro" : "para fora"} a partir do ${t.partida}, ${String(i + 1)}º passo`;
          if (s.erro) {
            problemas.push(`${onde}: ${s.erro}`);
            return;
          }
          vistos.push(s.leitura.z);
          for (const pr of conferirLeituraDoPasseio(s.leitura, { ...esperadoBase, z: t.previstos[i] })) problemas.push(`${onde} (zoom ${t.previstos[i].toFixed(3)}): ${pr}`);
        });
      }
      /* A CONTAGEM É DO QUE A PÁGINA MOSTROU: zoom lido, valor distinto, que
         bate com um valor derivado. Valor derivado que nenhuma leitura mostrou
         é valor que o passeio pulou. */
      const lidos = valoresDistintos(vistos.filter((z) => z !== null));
      const batem = plano.valores.filter((v) => lidos.some((z) => Math.abs(z - v) <= 1e-3 * Math.max(1, v)));
      const pulados = plano.valores.filter((v) => !batem.includes(v));
      if (pulados.length > 0) problemas.push(`${String(pulados.length)} valor(es) derivado(s) do zoom nunca apareceram na página: ${pulados.slice(0, 4).map((v) => v.toFixed(3)).join(", ")}`);
      menorContagem = Math.min(menorContagem, lidos.length);
      const vao = maiorVao(lidos);
      if (vao.vao > maiorVaoVisto.vao) maiorVaoVisto = vao;
      exigir(
        problemas.length === 0,
        `${chave}: §22z${estado} — ${problemas.slice(0, 3).join(" ; ")}${problemas.length > 3 ? ` (+${String(problemas.length - 3)})` : ""}`,
      );
      linhas.push(
        `${p.camadas.nome} × ${p.selecao === null ? "sem seleção" : "selecionado"} × ${p.painel ?? "nenhum painel"} × ${p.fonte ?? "todas as fontes"} × ${p.arrasta ? "arrastado" : "sem arrasto"}: partidas ${partidas.map((x) => `${x.acao} ${x.z.toFixed(3)}`).join(", ")} · ${String(plano.valores.length)} valores derivados, ${String(lidos.length)} lidos na página em ${String(Math.round((Date.now() - tDoPasseio) / 1000))}s · ${problemas.length === 0 ? "todos se sustentam" : `${String(problemas.length)} problema(s)`}`,
      );
    }
    await fecharPaineisAbertos(page);
    const semPixel = [...valoresQuePedemPixel].filter((v) => !valoresComPixel.has(v));
    exigir(
      valoresQuePedemPixel.size > 0 && semPixel.length === 0,
      `${chave}: §22z o amarelo nunca foi medido em pixel no(s) zoom(s) ${semPixel.join(", ") || "(nenhum pedido)"} das sequências que partem do enquadramento — aprovar esse valor pelo DOM seria aprovar por ausência`,
    );
    linhas.push(`pixel do destaque nas sequências do enquadramento (${String(valoresComPixel.size)} valores): ${pixelNoPasseio.join(" · ")}`);
    exigir(
      menorContagem >= PISO_DE_VALORES_DE_ZOOM,
      `${chave}: §22z o passeio mais pobre leu ${String(menorContagem)} valor(es) distinto(s) de zoom na página e o piso escrito à mão é ${String(PISO_DE_VALORES_DE_ZOOM)} — o eixo encolheu`,
    );
    exigir(errosDePagina.length === 0, `${chave}: §22z a página lançou ${String(errosDePagina.length)} erro(s): ${errosDePagina[0] ?? ""}`);
    linhas.unshift(
      `gestos de verdade conferidos contra a lib: ${verdade.join(", ") || "nenhum"} · ${String(passeios.length)} passeios, ${String(passos)} leituras em ${String(Math.round((Date.now() - t0) / 1000))}s · menor passeio: ${String(menorContagem)} valores distintos (piso ${String(PISO_DE_VALORES_DE_ZOOM)}) · maior vão entre dois valores medidos: ${maiorVaoVisto.vao.toFixed(3)}${maiorVaoVisto.entre ? ` (entre ${maiorVaoVisto.entre[0].toFixed(3)} e ${maiorVaoVisto.entre[1].toFixed(3)})` : ""} — faixa de defeito mais estreita que isso, alcançável só por pinça/trackpad, escapa`,
    );
    anotarPasseio("§22z o passeio do zoom", chave);
  } finally {
    await ctx.close();
  }
  return linhas;
}

/**
 * §22p · O PASSEIO DO PAN. O fundo é arrastado em passos de `PASSO_DO_PAN_PX`,
 * nas quatro direções, a partir do enquadramento, até o desenho inteiro sair
 * do canvas (nenhum cartão dentro dele — o fim do que há para ver, lido na
 * página). O cartão selecionado, todas as camadas. Em cada passo: o canvas
 * contra o dado, o destaque exato e pintando, e o zoom intacto (arrastar não
 * pode mexer no zoom).
 */
async function medirPasseioDoPan(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  const { ctx, page, errosDePagina, semCanvas } = await abrirPagina(browser, caso);
  const linhas = [];
  try {
    if (semCanvas) return linhas;
    const base = await lerControlesParaOsPasseios(page, chave, "§22p");
    if (base === null) return linhas;
    const alvo = alvoDosPasseios();
    const acao = [...new Set((base.controlesPorEixo.get("enquadramento") ?? []).map((c) => c.acao).filter(Boolean))][0];
    if (alvo === null || !acao) {
      exigir(false, `${chave}: §22p sem alvo (${String(alvo)}) ou sem botão de enquadramento`);
      return linhas;
    }
    await aplicarSelecao(page, alvo);
    await page.evaluate(instalarPasseioNaPagina, NOTCH_DA_RODA_PX);
    const esperado = { ativas: [...CONTRATO.camadas], selecao: alvo, painel: null, fonte: null };
    let leituras = 0;
    const problemas = [];
    const alcance = [];
    for (const [dx, dy, nome] of [
      [PASSO_DO_PAN_PX, 0, "direita"],
      [-PASSO_DO_PAN_PX, 0, "esquerda"],
      [0, PASSO_DO_PAN_PX, "baixo"],
      [0, -PASSO_DO_PAN_PX, "cima"],
    ]) {
      const r = await page.evaluate((a) => window.__lbPasseio.enquadrar(a, null), acao);
      if (r.erro) {
        problemas.push(r.erro);
        continue;
      }
      const z0 = r.leitura.z;
      const x0 = r.leitura.x;
      const y0 = r.leitura.y;
      const { erro, saida } = await page.evaluate(
        ({ a, b, m }) => window.__lbPasseio.arrastarEmPassos(a, b, m),
        { a: dx, b: dy, m: TETO_DE_PASSOS_DO_PAN_POR_DIRECAO },
      );
      if (erro) problemas.push(`${nome}: ${erro}`);
      saida.forEach((l, i) => {
        leituras += 1;
        const deslocado = Math.round(Math.hypot((l.x ?? 0) - x0, (l.y ?? 0) - y0));
        const esperadoPx = PASSO_DO_PAN_PX * (i + 1);
        const ps = conferirLeituraDoPasseio(l, { ...esperado, z: z0 });
        if (Math.abs(deslocado - esperadoPx) > 2) ps.push(`o fundo andou ${String(deslocado)} px e o gesto pediu ${String(esperadoPx)}`);
        for (const pr of ps) problemas.push(`arrastado ${String(esperadoPx)} px para ${nome}: ${pr}`);
      });
      const ultimo = saida.at(-1);
      if (ultimo && ultimo.cartoesNoCanvas > 0) {
        problemas.push(`${nome}: ${String(saida.length)} passos e o desenho ainda não saiu do canvas (${String(ultimo.cartoesNoCanvas)} cartão(ões) dentro) — o passeio parou antes do fim do que há para ver`);
      }
      alcance.push(`${nome} ${String(saida.length * PASSO_DO_PAN_PX)} px`);
    }
    exigir(problemas.length === 0, `${chave}: §22p o passeio do pan — ${problemas.slice(0, 3).join(" ; ")}${problemas.length > 3 ? ` (+${String(problemas.length - 3)})` : ""}`);
    exigir(
      leituras >= PISO_DE_LEITURAS_DO_PAN,
      `${chave}: §22p o passeio do pan leu ${String(leituras)} deslocamento(s) e o piso escrito à mão é ${String(PISO_DE_LEITURAS_DO_PAN)}`,
    );
    exigir(errosDePagina.length === 0, `${chave}: §22p a página lançou ${String(errosDePagina.length)} erro(s): ${errosDePagina[0] ?? ""}`);
    linhas.push(
      `"${alvo}" selecionado, todas as camadas, passos de ${String(PASSO_DO_PAN_PX)} px até o desenho sair do canvas: ${alcance.join(", ")} · ${String(leituras)} leituras (piso ${String(PISO_DE_LEITURAS_DO_PAN)}) — faixa de defeito mais estreita que ${String(PASSO_DO_PAN_PX)} px, ou só na diagonal, escapa`,
    );
    anotarPasseio("§22p o passeio do pan", chave);
  } finally {
    await ctx.close();
  }
  return linhas;
}

/**
 * §22L · A TRILHA DA LARGURA. Uma página só, com o cartão selecionado e todas
 * as camadas, redimensionada da menor à maior largura da tabela em passos de
 * `PASSO_DA_TRILHA_DE_LARGURA_PX`, mais os dois lados de cada corte que o
 * produto declara no código (consultas de mídia, `larguraCorte`,
 * `LARGURA_…_PX`, pontos de quebra do Tailwind). A altura anda junto,
 * interpolada entre as larguras vizinhas da tabela.
 */
async function medirTrilhaDaLargura(browser) {
  const casos = TODAS_AS_LARGURAS;
  const fontes = {};
  const listar = (dir) => {
    for (const nome of readdirSync(join(RAIZ_DO_PACOTE, dir), { withFileTypes: true })) {
      const rel = `${dir}/${nome.name}`;
      if (nome.isDirectory()) listar(rel);
      else if (/\.(tsx?|css)$/.test(nome.name)) fontes[rel] = lerFonte(rel);
    }
  };
  listar("src");
  const tailwindDoProduto = lerFonte("tailwind.config.ts");
  if (/\bscreens\s*:/.test(tailwindDoProduto)) {
    exigir(false, "§22L tailwind.config.ts passou a declarar `screens` — os cortes do Tailwind desta trilha saem do tema padrão e deixaram de ser os do produto");
  }
  let telas = {};
  try {
    telas = createRequire(join(RAIZ_DO_PACOTE, "package.json"))("tailwindcss/defaultTheme").screens ?? {};
  } catch (e) {
    exigir(false, `§22L não consegui ler os pontos de quebra do Tailwind instalado: ${String(e?.message ?? e)}`);
  }
  const cortes = cortesDeLarguraDoCodigo(fontes, telas);
  const trilha = trilhaDaLargura(casos, cortes, PASSO_DA_TRILHA_DE_LARGURA_PX);
  const primeiro = { ...casos.find((c) => c.largura === trilha[0].largura) ?? { desktop: trilha[0].largura >= 1024 }, largura: trilha[0].largura, altura: trilha[0].altura };
  const { ctx, page, errosDePagina, semCanvas } = await abrirPagina(browser, primeiro);
  const linhas = [];
  try {
    if (semCanvas) return linhas;
    const base = await lerControlesParaOsPasseios(page, `${String(primeiro.largura)}x${String(primeiro.altura)}`, "§22L");
    if (base === null) return linhas;
    const alvo = alvoDosPasseios();
    await aplicarSelecao(page, alvo);
    await page.evaluate(instalarPasseioNaPagina, NOTCH_DA_RODA_PX);
    const esperado = { ativas: [...CONTRATO.camadas], selecao: alvo, painel: null, fonte: null, z: null };
    const problemas = [];
    const lidas = new Set();
    for (const passo of trilha) {
      await page.setViewportSize({ width: passo.largura, height: passo.altura });
      await page.waitForTimeout(120);
      const l = await page.evaluate(async () => {
        const quadro = () => new Promise((r) => window.requestAnimationFrame(() => r()));
        let ultimo = null;
        for (let i = 0; i < 90; i += 1) {
          await quadro();
          const v = document.querySelector(".react-flow__viewport");
          const t = v ? getComputedStyle(v).transform : null;
          if (t !== null && t === ultimo && i >= 6) break;
          ultimo = t;
        }
        return window.__lbPasseio.ler();
      });
      if (l.largura !== passo.largura) {
        problemas.push(`pedi ${String(passo.largura)} px e a janela tem ${String(l.largura)}`);
        continue;
      }
      lidas.add(l.largura);
      for (const pr of conferirLeituraDoPasseio(l, esperado)) problemas.push(`a ${String(passo.largura)}×${String(passo.altura)}: ${pr}`);
    }
    exigir(problemas.length === 0, `§22L a trilha da largura — ${problemas.slice(0, 3).join(" ; ")}${problemas.length > 3 ? ` (+${String(problemas.length - 3)})` : ""}`);
    exigir(
      lidas.size >= PISO_DE_LARGURAS_DA_TRILHA,
      `§22L a trilha leu ${String(lidas.size)} largura(s) distinta(s) e o piso escrito à mão é ${String(PISO_DE_LARGURAS_DA_TRILHA)}`,
    );
    exigir(errosDePagina.length === 0, `§22L a página lançou ${String(errosDePagina.length)} erro(s): ${errosDePagina[0] ?? ""}`);
    linhas.push(
      `de ${String(trilha[0].largura)} a ${String(trilha[trilha.length - 1].largura)} px em passos de ${String(PASSO_DA_TRILHA_DE_LARGURA_PX)} px, mais os cortes do código (${cortes.map((c) => String(c.px)).join(", ")}): ${String(lidas.size)} larguras lidas (piso ${String(PISO_DE_LARGURAS_DA_TRILHA)}), "${String(alvo)}" selecionado e todas as camadas — faixa de defeito mais estreita que ${String(PASSO_DA_TRILHA_DE_LARGURA_PX)} px entre dois cortes escapa; alturas fora da trilha interpolada ficam fora`,
    );
    anotarPasseio("§22L a trilha da largura", "todas");
  } finally {
    await ctx.close();
  }
  return linhas;
}

// ═══════════════════════════════════════════════════════════════════════════
// §8 · A FAIXA DO CAMINHO CRÍTICO É LARGA DE PIXEL, NÃO TRÊS ATRIBUTOS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * A versão anterior conferia `paths.length === 3`. Três `<path>` com
 * `opacity: 0` também dão 3. Aqui o perfil PERPENDICULAR ao traço é lido em
 * passos de meio pixel, e o que se exige é o que a tela mostra: pelo menos um
 * ponto do caminho crítico com TRÊS faixas pintadas separadas.
 *
 * Por que "pelo menos um ponto", e não todos: o deslocamento da tripla é feito
 * num eixo só (`eixoDeslocamento`, escolhido pelo sentido dominante da aresta
 * inteira — `aresta-svg.tsx`), então nos trechos em que o segmento corre
 * PARALELO a esse eixo as três linhas se sobrepõem de propósito e viram uma.
 * Medido nesta rodada, a 1440: `setup→build` dá {1:10, 2:6, 3:4} e
 * `build→deploy` dá {3:20} — e nenhuma aresta simples chegou a 2 faixas.
 */
function medirTracoTriplo(chave, estado, bandasPorCritica, detalhePorAresta) {
  if (bandasPorCritica.length === 0) {
    exigir(false, `${chave}${estado}: §8 nenhuma aresta do caminho crítico na tela — o traço triplo não foi medido, e não medir é reprovar`);
    return "critico=0";
  }
  const problemas = [];
  /*
   * CONTRAPROVA NA MESMA TELA, por EXTENSÃO e não por contagem de faixas.
   *
   * A primeira versão exigia que nenhuma aresta comum desenhasse 3 faixas — e
   * a 390 px isso deu vermelho falso: a sinergia é tracejada ("3 4"), e a 0,75
   * de zoom os vãos do tracejado aparecem no perfil perpendicular como
   * buracos. Contar faixas num tracejado não distingue tripla de traço.
   *
   * A extensão distingue: a tripla ocupa `2 × separação + traço` de largura,
   * e um traço simples ocupa o traço. Medido a 1440: crítico 10 px, comuns
   * 2–3 px (com uma ponta de 7 px numa curva). A mediana das comuns resiste a
   * essa ponta, e o fator 2 é folgado para os dois lados.
   */
  const comuns = detalhePorAresta.filter((d) => d.papel !== "critico" && d.extensao > 0);
  const extensoes = comuns.map((d) => d.extensao).sort((x, y) => x - y);
  const medianaComum = extensoes.length > 0 ? extensoes[Math.floor(extensoes.length / 2)] : 0;
  if (medianaComum <= 0) {
    exigir(
      false,
      `${chave}${estado}: §8 nenhuma aresta simples com traço medível nesta tela — sem a contraprova a largura da tripla não diz nada`,
    );
    return "sem contraprova";
  }
  for (const c of bandasPorCritica) {
    /*
     * REGRA 1 — a faixa do caminho crítico é MAIS LARGA que um traço simples
     * medido na MESMA tela. É esta que mata as versões falsas: três `<path>`
     * com `opacity: 0` nas laterais, ou `paths.length === 3` sem pintura
     * nenhuma, colapsam a extensão para a de um traço comum.
     */
    if (c.extensao < 2 * medianaComum) {
      problemas.push(
        `${c.id}: a faixa pintada do caminho crítico tem ${String(c.extensao)}px de largura e a mediana das arestas simples desta MESMA tela é ${String(medianaComum)}px — a tripla não é mais larga que um traço`,
      );
      continue;
    }
    /*
     * REGRA 2 — e ela mostra faixas SEPARADAS onde a resolução permite.
     *
     * Rodada 11: ao medir §8 nos estados que a varredura abriu (BAIXO 6),
     * apareceu um estado a 390 px em que a tripla é uma faixa SÓLIDA de 8 px
     * contra 2 px das simples — quatro vezes mais larga, sem nenhum buraco. O
     * arquivo já sabia por quê ("as laterais chegam a encostar na central
     * quando o zoom encolhe a separação", e nos trechos paralelos ao eixo do
     * deslocamento as três linhas se sobrepõem de propósito). Exigir 3 faixas
     * SEMPRE seria exigir uma resolução que o produto não promete.
     *
     * Então: 2 faixas separadas em algum ponto OU uma faixa 3× mais larga que
     * a simples. E o nome da medida passa a dizer isso — "a faixa larga do
     * caminho crítico", não "três faixas de pixel" (BAIXO 7: a guarda não
     * afirma o que ela não mede).
     */
    const comDuasOuMais = Object.entries(c.bandas)
      .filter(([n]) => Number(n) >= 2)
      .reduce((soma, [, q]) => soma + q, 0);
    if (comDuasOuMais < 1 && c.extensao < 3 * medianaComum) {
      problemas.push(
        `${c.id}: a faixa do caminho crítico tem ${String(c.extensao)}px (simples: ${String(medianaComum)}px) e NENHUM ponto mostrou duas faixas separadas — distribuição ${JSON.stringify(c.bandas)}, perfil "${c.perfil}"`,
      );
    }
  }
  exigir(problemas.length === 0, `${chave}${estado}: §8 o traço triplo — ${problemas.join(" ; ")}`);
  return bandasPorCritica.map((c) => `${c.id.split(":")[1] ?? c.id}:${JSON.stringify(c.bandas)}`).join(" ");
}

// ═══════════════════════════════════════════════════════════════════════════
// §8b · TRÊS TRAÇOS, CADA UM PINTANDO, CADA UM NO SEU LUGAR  (achado MÉDIO 10)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * A régua 2 de §8 tinha um escape: *"2 faixas separadas OU uma faixa 3× mais
 * larga que a simples"*. O crítico obteve `{"1":20}` — UM perfil, UMA faixa,
 * em todos os 20 pontos — sem §8 levantar falha: uma barra sólida passava por
 * traço triplo, e a única coisa no repositório que exigia três `<path>` era um
 * teste de unidade sobre um componente instanciado fora do canvas.
 *
 * Por que o escape existia, e por que ele não podia ser só apagado: a
 * separação é em px de MUNDO, então em zoom baixo as três linhas encostam e o
 * perfil perpendicular vira uma faixa só. Exigir "3 faixas sempre" é exigir
 * uma resolução que o produto não promete.
 *
 * A saída não é afrouxar a régua; é medir a coisa certa. **Cada um dos três
 * `<path>` é medido POR SI:**
 *
 *   1. ele existe (três, não um);
 *   2. ele PINTA — foto com e sem ELE, pixels que mudam (uma lateral com
 *      `opacity: 0` cai aqui, e uma barra sólida não tem laterais para medir);
 *   3. ele está em LUGAR DIFERENTE dos outros dois, e à distância que a
 *      separação do mundo prevê PARA AQUELE ZOOM — `SEPARACAO_DA_TRIPLA_MUNDO`
 *      é lida de `geometria-da-aresta.ts` (quem a decide), nunca escrita aqui,
 *      e o zoom sai da matriz do próprio canvas.
 *
 * Três linhas sobrepostas no mesmo ponto continuam sendo uma barra — e agora
 * a barra reprova pelo item 3, mesmo quando o zoom fecha o buraco do perfil.
 */
const LEITURA_DOS_PATHS_CRITICOS = `(() => {
  const saida = [];
  for (const g of document.querySelectorAll(".react-flow g[data-camada]")) {
    if (g.getAttribute("data-critica") !== "true") continue;
    const paths = [...g.querySelectorAll("path.lb-edge-path")];
    const pontos = paths.map((p) => {
      const lista = window.__lbp4.pontosDaAresta(p, 3);
      return lista.length > 0 ? lista[Math.floor(lista.length / 2)] : null;
    });
    saida.push({ id: g.getAttribute("data-aresta-id"), n: paths.length, pontos: pontos });
  }
  return saida;
})()`;

/** Quantos traços o caminho crítico promete — o desenho de `aresta-svg.tsx`. */
const TRACOS_DA_TRIPLA = 3;

async function medirCadaTracoDaTripla(page, chave, estado, zoomDoCanvas) {
  const criticas = await page.evaluate(LEITURA_DOS_PATHS_CRITICOS);
  if (criticas.length === 0) {
    exigir(
      false,
      `${chave}${estado}: §8b nenhuma aresta do caminho crítico na tela — os três traços não foram medidos, e não medir é reprovar`,
    );
    return "sem críticas";
  }
  const problemas = [];
  const linha = [];
  const zoom = zoomDoCanvas !== null && zoomDoCanvas > 0 ? zoomDoCanvas : 1;
  const separacaoNaTela = CONTRATO.separacaoDaTripla * zoom;
  for (const c of criticas) {
    if (c.n < TRACOS_DA_TRIPLA) {
      problemas.push(
        `${c.id}: o caminho crítico é desenhado com ${String(c.n)} <path> e a promessa são ${String(TRACOS_DA_TRIPLA)} — uma barra grossa não é um traço triplo`,
      );
      continue;
    }
    const alvos = await page.$$(`${SELETOR_DA_ARESTA}[data-aresta-id="${c.id}"] path.lb-edge-path`);
    const centros = [];
    let falhou = false;
    for (let i = 0; i < c.n; i += 1) {
      const ponto = c.pontos[i];
      const alvo = alvos[i];
      if (!ponto || !alvo) {
        problemas.push(`${c.id}: não consegui achar o traço nº ${String(i + 1)} para medir — não medir é reprovar`);
        falhou = true;
        break;
      }
      const janela = janelaDosPontos([ponto], RAIO_DA_AMOSTRA + 3, page.viewportSize());
      if (janela === null) {
        problemas.push(`${c.id}: o traço nº ${String(i + 1)} caiu fora da janela de visão — não medir é reprovar`);
        falhou = true;
        break;
      }
      const fotos = await fotosComESem(page, alvo, janela);
      if (fotos.erro) {
        if (ehErroDeAmbiente(fotos.erro)) naoConsegui(`${chave}${estado} · ${c.id} traço ${String(i + 1)}: ${fotos.erro}`);
        else problemas.push(`${c.id}: traço nº ${String(i + 1)}: ${fotos.erro}`);
        falhou = true;
        break;
      }
      const amostra = amostraNoPonto(fotos, ponto, "rgb(0, 0, 0)", RAIO_DA_AMOSTRA);
      if (!amostra.dentro || amostra.mudaram < PISO_DE_PIXEIS_DE_UM_TRACO) {
        problemas.push(
          `${c.id}: o traço nº ${String(i + 1)} dos três não pinta — ${String(amostra.mudaram)} pixels mudam ao escondê-lo (piso ${String(PISO_DE_PIXEIS_DE_UM_TRACO)}). Três <path> com um deles apagado continuam sendo três no DOM`,
        );
        falhou = true;
        break;
      }
      centros.push(ponto);
    }
    if (falhou) continue;
    let menor = Infinity;
    let maior = 0;
    for (let i = 0; i < centros.length; i += 1) {
      for (let j = i + 1; j < centros.length; j += 1) {
        const d = Math.hypot(centros[i].x - centros[j].x, centros[i].y - centros[j].y);
        if (d < menor) menor = d;
        if (d > maior) maior = d;
      }
    }
    const esperadoMaior = 2 * separacaoNaTela;
    if (menor < 0.8) {
      problemas.push(
        `${c.id}: dois dos três traços são desenhados no MESMO lugar (${menor.toFixed(2)}px de distância) — sobrepostos, os três viram uma barra`,
      );
    } else if (maior < 0.5 * esperadoMaior) {
      problemas.push(
        `${c.id}: os três traços ocupam ${maior.toFixed(1)}px de largura e a separação do mundo (${String(CONTRATO.separacaoDaTripla)}px, de geometria-da-aresta.ts) prevê ${esperadoMaior.toFixed(1)}px no zoom ${zoom.toFixed(3)}`,
      );
    }
    linha.push(`${c.id.split(":")[1] ?? c.id}:${String(c.n)}x/${maior.toFixed(1)}px`);
  }
  exigir(problemas.length === 0, `${chave}${estado}: §8b cada traço da tripla — ${problemas.slice(0, 3).join(" ; ")}`);
  return linha.join(" ");
}

// ═══════════════════════════════════════════════════════════════════════════
// §9 · TODO GLIFO PINTA (a seta, o círculo, o losango e o ❌)
// ═══════════════════════════════════════════════════════════════════════════
const LEITURA_DOS_GLIFOS = `(() => {
  /*
   * A ASSINATURA GEOMÉTRICA do glifo: o nome do elemento SVG mais os números
   * que descrevem a forma, transladados para a origem e arredondados. É ela
   * que distingue uma seta de um losango (os dois são <polygon>) sem consultar
   * nenhuma tabela — a tabela viria do mesmo arquivo que decide a forma, e
   * seria a guarda concordando consigo mesma.
   */
  const assinaturaDaForma = (el) => {
    const t = el.tagName.toLowerCase();
    if (t === "circle") return "circle|r=" + Number(el.getAttribute("r") || 0).toFixed(1);
    const bruto = t === "polygon" ? (el.getAttribute("points") || "") : (el.getAttribute("d") || "");
    const nums = (bruto.match(/-?\\d+(?:\\.\\d+)?/g) || []).map(Number);
    const comandos = t === "path" ? (bruto.match(/[A-Za-z]/g) || []).join("") : "";
    if (nums.length < 4) return t + "|" + comandos + "|" + nums.join(",");
    let minX = Infinity, minY = Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      if (nums[i] < minX) minX = nums[i];
      if (nums[i + 1] < minY) minY = nums[i + 1];
    }
    const rel = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      rel.push((nums[i] - minX).toFixed(1) + " " + (nums[i + 1] - minY).toFixed(1));
    }
    return t + "|" + comandos + "|" + rel.join(",");
  };
  const saida = [];
  for (const el of document.querySelectorAll(".react-flow g[data-camada] .lb-edge-glifo")) {
    const grupo = el.closest(".react-flow g[data-camada]");
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const usaFill = cs.fill && cs.fill !== "none";
    saida.push({
      camada: grupo.getAttribute("data-camada"),
      aresta: grupo.getAttribute("data-aresta-id"),
      forma: el.tagName,
      assinatura: assinaturaDaForma(el),
      caixa: { x: r.x, y: r.y, largura: r.width, altura: r.height },
      cor: window.__lbp4.corEsperada(el, usaFill ? "fill" : "stroke"),
      retrato: window.__lbp4.retrato(el),
    });
  }
  return saida;
})()`;

async function medirGlifos(page, chave, estado, arestas, alfaPicoPorAresta) {
  const glifos = await page.evaluate(LEITURA_DOS_GLIFOS);
  const alvos = await page.$$(`${SELETOR_DA_ARESTA} .lb-edge-glifo`);
  const problemas = [];
  const linha = [];
  const comGlifo = new Set(glifos.map((g) => g.aresta));
  /*
   * ── O QUE ESTÁ FORA DO CANVAS NÃO SE MEDE EM PIXEL, E ISSO NÃO É DISPENSA
   *
   * O canvas RECORTA o que sai dele, e o produto já ANUNCIA isso: o chip
   * "N tarefas fora da tela" existe justamente porque nem todo grafo cabe em
   * 1024 ou em 390. Medido nesta rodada, na árvore honesta: o glifo de uma das
   * sinergias fica fora do retângulo do canvas em 1024, 1280 e 390 — exigir
   * pixel dele é reprovar o recorte, não o produto.
   *
   * A troca não abre buraco porque o piso muda de lugar: cada CAMADA presente
   * na tela tem de ter ao menos UM glifo medido de verdade. Camada inteira
   * fora da tela, ou camada em que nenhum glifo pôde ser medido, continua
   * reprovando — e é isso que impede "empurrar o glifo para fora" de virar
   * saída.
   */
  const caixaDoCanvas = await page.evaluate(() => {
    const el = document.querySelector(".react-flow");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, largura: r.width, altura: r.height };
  });
  const vistaDaPagina = page.viewportSize();
  const dentroDoCanvas = (caixa) => {
    if (caixaDoCanvas === null) return true;
    const cx = caixa.x + caixa.largura / 2;
    const cy = caixa.y + caixa.altura / 2;
    return (
      cx >= caixaDoCanvas.x &&
      cx <= caixaDoCanvas.x + caixaDoCanvas.largura &&
      cy >= caixaDoCanvas.y &&
      cy <= caixaDoCanvas.y + caixaDoCanvas.altura &&
      cx >= 0 &&
      cy >= 0 &&
      cx < vistaDaPagina.width &&
      cy < vistaDaPagina.height
    );
  };
  const medidosPorCamada = new Map();
  const foraDaTela = [];

  /*
   * ── MÉDIO 8: A FORMA É O QUE DISTINGUE A CAMADA — ENTÃO ELAS TÊM DE SER
   *    DIFERENTES ENTRE SI ───────────────────────────────────────────────
   *
   * Este arquivo prometia, por escrito, que *"a forma é o que distingue a
   * camada para quem não vê cor"* — e `forma: el.tagName` só reaparecia na
   * mensagem de erro. O crítico trocou correlação e sinergia para `"seta"` em
   * `aresta-svg.tsx`: três setas idênticas na tela, a promessa morta, e a
   * guarda MELHOROU o número (`correlacao:9px/3.4:1/α0.72` virou
   * `15px/11.5:1/α1.00`), porque uma seta pinta mais que um circulinho.
   *
   * A régua não pode ser uma tabela "correlação = círculo" escrita aqui: ela
   * sairia do mesmo arquivo que decide a forma (forma 1, a guarda contando a
   * si mesma). O que se pode exigir sem tabela nenhuma é a PROPRIEDADE que a
   * promessa afirma: **glifos de camadas diferentes são geometrias
   * diferentes, e dentro de uma camada são sempre a mesma.**
   */
  const assinaturaPorCamada = new Map();
  for (const g of glifos) {
    const vistas = assinaturaPorCamada.get(g.camada) ?? new Set();
    vistas.add(g.assinatura);
    assinaturaPorCamada.set(g.camada, vistas);
  }
  for (const [camada, vistas] of assinaturaPorCamada) {
    if (vistas.size > 1) {
      problemas.push(
        `a camada "${camada}" desenha ${String(vistas.size)} formas diferentes de glifo (${[...vistas].join(" | ").slice(0, 120)}) — dentro de uma camada a forma tem de ser uma só`,
      );
    }
  }
  const camadasPorAssinatura = new Map();
  for (const [camada, vistas] of assinaturaPorCamada) {
    for (const a of vistas) {
      const donas = camadasPorAssinatura.get(a) ?? [];
      if (!donas.includes(camada)) donas.push(camada);
      camadasPorAssinatura.set(a, donas);
    }
  }
  for (const [assinatura, donas] of camadasPorAssinatura) {
    if (donas.length > 1) {
      problemas.push(
        `as camadas ${donas.join(" e ")} desenham o MESMO glifo (${assinatura.slice(0, 100)}) — a forma deixou de distinguir a camada para quem não vê cor, que é a promessa escrita neste arquivo`,
      );
    }
  }
  for (const a of arestas) {
    if (!a.semPath && !comGlifo.has(a.id)) {
      problemas.push(`${a.id}: aresta desenhada SEM glifo de fim — a forma é o que distingue a camada para quem não vê cor`);
    }
  }
  for (let i = 0; i < glifos.length; i += 1) {
    const g = glifos[i];
    const alvo = alvos[i];
    if (!alvo) continue;
    if (g.caixa.largura <= 0 || g.caixa.altura <= 0) {
      problemas.push(`glifo de ${g.aresta}: sem caixa de layout (${JSON.stringify(g.caixa)})`);
      continue;
    }
    if (!dentroDoCanvas(g.caixa)) {
      foraDaTela.push(`${g.camada}/${String(g.aresta)}`);
      continue;
    }
    const centro = { x: g.caixa.x + g.caixa.largura / 2, y: g.caixa.y + g.caixa.altura / 2 };
    const raio = Math.max(3, Math.round(Math.min(g.caixa.largura, g.caixa.altura) / 2));
    const janela = janelaDosPontos([centro], raio + 3, vistaDaPagina);
    if (janela === null) {
      foraDaTela.push(`${g.camada}/${String(g.aresta)}`);
      continue;
    }
    const fotos = await fotosComESem(page, alvo, janela);
    if (fotos.erro) {
      if (ehErroDeAmbiente(fotos.erro)) naoConsegui(`${chave}${estado} · glifo de ${g.aresta}: ${fotos.erro}`);
      else problemas.push(`glifo de ${g.aresta}: ${fotos.erro}`);
      continue;
    }
    const daAresta = arestas.find((a) => a.id === g.aresta);
    const corDoContrato = hexEmRgb(CONTRATO.cores[daAresta?.papel] ?? "#000000");
    const amostra = amostraNoPonto(fotos, centro, g.cor, raio, corDoContrato, CONTRATO.pisoDeContraste);
    if (!amostra.dentro) {
      problemas.push(`glifo de ${g.aresta}: a caixa dele não caiu dentro da foto — não consegui medir, e isso é reprovação`);
      continue;
    }
    const alfaOk = g.retrato.visivelHerdado && g.retrato.opacidadeAcumulada > 0;
    /*
     * Todo glifo tem de PINTAR (pixel que muda). Só o ❌ da obsolescência tem,
     * além disso, régua de COR: ele é a promessa nomeada da peça ("obsolescência
     * com ❌") e é o maior dos quatro (13×13). O círculo da correlação tem 3,5
     * px de raio de MUNDO — a 0,849 de zoom ele vira uma bolinha de 6 px quase
     * toda de antialias, e exigir cor cheia ali seria uma régua que reprova o
     * antialias, não o produto. A cor daquela camada já é medida no traço (§7).
     */
    const exigeCor = g.camada === "obsolescencia";
    /*
     * ── E O GLIFO TAMBÉM TEM DE SER VISÍVEL (rodada 12) ──────────────────
     *
     * A mesma porta do traço abre aqui, e com um nome próprio: `fill-opacity`
     * no glifo apaga o ❌, a seta, o círculo e o losango sem tocar no traço.
     * "Pixels que mudam" não pega: a 12% de opacidade eles continuam mudando
     * (medido: o círculo da correlação muda os MESMOS 9 pixels).
     *
     * **Por que existe um caminho lento, mesmo agora.** Na rodada 12 o
     * círculo da correlação tinha caixa de 7×7 px e pintava NOVE pixels — uma
     * meia-lua de duas linhas, com o resto atrás do cartão para onde ele
     * aponta —, e o melhor pixel chegava a 3,39:1, um fio acima do piso. Era
     * um portão calibrado a 13% do vermelho sobre a árvore honesta: apitaria
     * sozinho. O crítico levantou isso como olho de usuário (BAIXO 13), e o
     * PRODUTO mudou nesta rodada: o círculo passou a ter a mesma meia-largura
     * do ❌ (6,5), e agora mede 46–79 pixels a 11,5:1 com α 1,00 — passa
     * folgado pelo caminho rápido.
     *
     * O caminho lento FICA, e não por nostalgia: oclusão continua sendo um
     * motivo legítimo para um glifo aparecer pouco (um cartão maior, um zoom
     * menor, uma rota que chega por trás), e a comparação com o α do traço da
     * MESMA aresta é a régua que distingue "está escondido" de "foi apagado"
     * sem constante nenhuma escrita aqui.
     *
     * A régua que serve é a de §8: comparar com uma REFERÊNCIA MEDIDA NA
     * MESMA TELA, não com uma constante escrita aqui. O glifo e o traço da
     * mesma aresta saem do mesmo componente, com a mesma cor e a mesma cadeia
     * de `opacity` — então o α DE PICO do glifo não pode desabar enquanto o
     * do traço fica de pé. `fill-opacity: 0.12` derruba um e não o outro.
     *
     * Traço sem α de pico medido = reprovação, nunca dispensa.
     */
    const alfaDoTraco = alfaPicoPorAresta?.get(g.aresta);
    const razaoDeAlfa =
      alfaDoTraco !== undefined && alfaDoTraco > 0 ? amostra.alfaPico / alfaDoTraco : null;
    const glifoVisivel =
      amostra.pixeisVisiveis >= PISO_DE_PIXEIS_VISIVEIS_DO_GLIFO
        ? true
        : razaoDeAlfa !== null && razaoDeAlfa >= FRACAO_MINIMA_DO_ALFA_DO_TRACO;
    const ok = alfaOk && amostra.mudaram >= 6 && (!exigeCor || amostra.naCor >= 8) && glifoVisivel;
    if (!ok) {
      problemas.push(
        `glifo ${g.forma} de ${g.aresta} (camada "${g.camada}"): ${
          alfaOk ? "" : "alfa real 0 · "
        }${String(amostra.mudaram)} pixels mudam ao esconder (piso 6)${
          exigeCor ? `, ${String(amostra.naCor)} na cor ${g.cor} (piso 8)` : ""
        }${
          glifoVisivel
            ? ""
            : `, e ele está quase invisível: melhor pixel ${amostra.melhorContraste.toFixed(2)}:1 contra o fundo do próprio lugar (piso ${String(CONTRATO.pisoDeContraste)}:1 de checar-contraste.mjs) com ${String(amostra.pixeisVisiveis)} pixel(es) no piso, e o α de pico dele é ${amostra.alfaPico.toFixed(3)} contra ${alfaDoTraco === undefined ? "NENHUM α medido no traço desta aresta — não medir é reprovar" : `${alfaDoTraco.toFixed(3)} do traço da MESMA aresta (razão ${razaoDeAlfa === null ? "n/d" : razaoDeAlfa.toFixed(2)}, piso ${String(FRACAO_MINIMA_DO_ALFA_DO_TRACO)})`}`
        }`,
      );
    }
    medidosPorCamada.set(g.camada, (medidosPorCamada.get(g.camada) ?? 0) + 1);
    linha.push(`${g.camada}:${String(amostra.mudaram)}px/${amostra.melhorContraste.toFixed(1)}:1/α${amostra.alfaPico.toFixed(2)}`);
  }
  /* O piso: cada camada com glifo no DOM tem de ter ao menos UM medido em
     pixel nesta tela. Empurrar tudo para fora do canvas não é saída. */
  for (const camada of assinaturaPorCamada.keys()) {
    if ((medidosPorCamada.get(camada) ?? 0) === 0) {
      problemas.push(
        `a camada "${camada}" tem glifo no DOM e NENHUM deles pôde ser medido em pixel nesta tela (todos fora do canvas) — medir zero nunca é sucesso`,
      );
    }
  }
  exigir(
    problemas.length === 0 && glifos.length > 0,
    `${chave}${estado}: §9 os glifos — ${glifos.length === 0 ? "NENHUM glifo no DOM; " : ""}${problemas.slice(0, 3).join(" ; ")}`,
  );
  return `${linha.join(" ")} · ${String(camadasPorAssinatura.size)} forma(s) distinta(s) em ${String(assinaturaPorCamada.size)} camada(s)${
    foraDaTela.length > 0 ? ` · ${String(foraDaTela.length)} glifo(s) fora do canvas` : ""
  }`;
}

// ═══════════════════════════════════════════════════════════════════════════
// §10 · TECLADO E LEITOR DE TELA ALCANÇAM AS CINCO CAMADAS  (achado ALTO 3)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * O universo é o que o CANVAS desenhou — não uma lista escrita aqui. Cada
 * aresta desenhada tem de aparecer na lista acessível, na linha de uma das
 * duas pontas, sob o rótulo da camada dela (`CAMADA_LABEL`, derivado) e com o
 * título do outro lado por escrito. E cada item da lista tem de ser alcançável
 * por Tab — uma lista que o leitor lê e o teclado não alcança é meia lista.
 */
/**
 * As relações que a lista acessível DEVE anunciar, tarefa por tarefa e camada
 * por camada, derivadas do universo (dado bruto + CPM) — nunca da lista.
 *
 * Espelha as frases de `relacoesAcessiveisDaTarefa` (`camadas-do-grafo.ts`):
 * a sucessão tem direção ("depende de" / "habilita"), as outras três são
 * simétricas para quem lê ("com"), e o caminho crítico entra como uma linha
 * PRÓPRIA ("vem de" / "segue para") quando a camada está marcada.
 */
function relacoesEsperadasPorTarefa(esperadas, titulos) {
  const porTarefa = new Map();
  const guardar = (taskId, camada, texto) => {
    const camadas = porTarefa.get(taskId) ?? new Map();
    const itens = camadas.get(camada) ?? new Set();
    itens.add(texto);
    camadas.set(camada, itens);
    porTarefa.set(taskId, camadas);
  };
  for (const a of esperadas) {
    const nomeOrigem = titulos.get(a.origem) ?? a.origem;
    const nomeDestino = titulos.get(a.destino) ?? a.destino;
    if (a.camada === "sucessao") {
      guardar(a.destino, "sucessao", `depende de ${nomeOrigem}`);
      guardar(a.origem, "sucessao", `habilita ${nomeDestino}`);
    } else {
      guardar(a.destino, a.camada, `com ${nomeOrigem}`);
      guardar(a.origem, a.camada, `com ${nomeDestino}`);
    }
    if (a.critica) {
      guardar(a.destino, "critico", `vem de ${nomeOrigem}`);
      guardar(a.origem, "critico", `segue para ${nomeDestino}`);
    }
  }
  return porTarefa;
}

/**
 * ── ALTO 2 DA RODADA 15: O NOME, O VERBO E A SETA DIZEM A MESMA COISA ──────
 *
 * A direção que o ITEM afirma, pelo verbo com que ele abre. A promessa
 * (`src/lib/promessa-do-grafo.ts`) diz, por NOME de camada, se aquela relação
 * tem direção; aqui se lê o que a tela escreveu e se compara com a promessa —
 * nunca com `CAMADA_LABEL`, que é a tabela auditada.
 */
function direcaoDoVerboNaGuarda(item) {
  const texto = String(item ?? "").trim();
  for (const v of CONTRATO.verbosDirecionais) if (texto.startsWith(`${v} `)) return "direcional";
  for (const v of CONTRATO.verbosSimetricos) if (texto.startsWith(`${v} `)) return "simetrica";
  return null;
}

/** Os itens de um span da lista: `"Rótulo: a, b"` → `["a", "b"]`. */
function itensDoSpan(texto, rotulo) {
  const corpo = texto.startsWith(`${rotulo}:`) ? texto.slice(rotulo.length + 1) : texto;
  return corpo
    .split(", ")
    .map((x) => x.trim())
    .filter(Boolean);
}

async function medirAlcanceSemMouse(page, chave, estado, arestas, contrato, camadasAtivas) {
  const desenhadas = arestas.filter((a) => !a.semPath);
  /*
   * O universo da conferência é o DERIVADO (dado bruto + CPM), filtrado pelas
   * camadas marcadas — não o desenho, e não o que o componente declara.
   * Comparar a lista só com o desenho deixa os dois calarem juntos; comparar
   * com o contrato do componente deixa os três calarem juntos (ALTO 1).
   */
  const universo = universoNasCamadas(UNIVERSO, camadasAtivas);
  if (universo.length === 0) {
    exigir(false, `${chave}${estado}: §10 o universo derivado ficou vazio nesta combinação de camadas — não há o que comparar com a lista acessível`);
    return "0/0";
  }
  /*
   * O nome que o CANVAS dá a cada tarefa: o `aria-label` do cartão, que começa
   * pelo título (`task-node.tsx`). Lido ANTES de trocar para a lista — o
   * canvas some quando `accessibleFallback` entra no lugar dele, e ler depois
   * devolvia um mapa vazio (a medida reprovaria por defeito dela mesma).
   */
  const rotulosDoCanvas = await page.evaluate(() => {
    const m = {};
    for (const no of document.querySelectorAll(".react-flow__node[data-id]")) {
      const botao = no.querySelector('[role="button"][aria-label]');
      if (botao) m[no.getAttribute("data-id")] = botao.getAttribute("aria-label");
    }
    return m;
  });
  if (Object.keys(rotulosDoCanvas).length === 0) {
    exigir(false, `${chave}${estado}: §10 não consegui ler o nome de nenhum cartão do canvas — sem isso não há o que comparar`);
    return "sem nomes no canvas";
  }
  const botao = page.locator('button', { hasText: "ver como lista" }).first();
  if ((await botao.count()) === 0) {
    exigir(false, `${chave}${estado}: §10 não achei o botão "ver como lista" — o caminho sem mouse não existe`);
    return "sem botão";
  }
  /*
   * A folha modal do celular (o painel "Camadas" a 390 px) cobre a tela
   * inteira com um backdrop: ali o operador REALMENTE não alcança o botão da
   * lista, e isso não é defeito. Exceção com conferência própria, nunca um
   * `catch` mudo: exige-se que exista mesmo uma folha `aria-modal="true"` E
   * que o que está por cima do botão pertença a ela. Qualquer outra coisa
   * cobrindo o botão continua reprovando.
   */
  const cobertura = await botao.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const acima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const folha = document.querySelector('[role="dialog"][aria-modal="true"]');
    return {
      alcancavel: acima === el || el.contains(acima),
      temFolha: folha !== null,
      doBackdropDaFolha:
        acima !== null &&
        folha !== null &&
        (folha.contains(acima) || acima.getAttribute("aria-hidden") === "true"),
      quemEsta: acima === null ? "nada" : `${acima.tagName.toLowerCase()}.${String(acima.className).slice(0, 40)}`,
    };
  });
  if (!cobertura.alcancavel) {
    exigir(
      cobertura.temFolha && cobertura.doBackdropDaFolha,
      `${chave}${estado}: §10 alguma coisa cobre o botão "ver como lista" e NÃO é a folha modal do painel: ${cobertura.quemEsta}`,
    );
    return "coberto por folha modal — §10 não se mede através dela (medida no estado base da mesma largura)";
  }
  await botao.click();
  await page.waitForSelector("ol[aria-label] li[data-lb-tarefa]", { timeout: 10000 });
  await page.waitForTimeout(300);

  const lista = await page.evaluate(() => {
    const itens = {};
    for (const li of document.querySelectorAll("ol[aria-label] li[data-lb-tarefa]")) {
      const porCamada = {};
      for (const span of li.querySelectorAll("[data-lb-camada]")) {
        porCamada[span.getAttribute("data-lb-camada")] = (span.textContent || "").trim();
      }
      itens[li.getAttribute("data-lb-tarefa")] = {
        titulo: li.getAttribute("data-lb-titulo"),
        texto: (li.textContent || "").trim(),
        porCamada,
      };
    }
    return itens;
  });
  const problemas = [];
  /*
   * As duas superfícies nomeiam a MESMA tarefa? O `aria-label` do cartão
   * começa pelo título; o item da lista carrega o título em `data-lb-titulo`.
   * Sem esta conferência, a §10 estaria comparando a lista com ela mesma.
   */
  for (const [id, item] of Object.entries(lista)) {
    const doCanvas = rotulosDoCanvas[id];
    if (typeof doCanvas !== "string" || typeof item.titulo !== "string" || !doCanvas.startsWith(item.titulo)) {
      problemas.push(
        `a tarefa "${id}" se chama "${String(item.titulo)}" na lista acessível e "${String(doCanvas).slice(0, 40)}…" no canvas`,
      );
    }
  }
  /*
   * ── MÉDIO 5: A LISTA NOS DOIS SENTIDOS ─────────────────────────────────
   *
   * §10 percorria o universo e perguntava *"está na lista?"*. Nunca o
   * contrário. Acrescentar uma relação de obsolescência FALSA fazia 10 das 11
   * tarefas anunciarem, para quem usa leitor de tela, um vínculo que não
   * existe em lugar nenhum — com os quatro portões verdes. É a forma 3
   * (universo por convenção): a lista tinha permissão de inventar.
   *
   * Agora a conferência é de CONJUNTO, nas duas direções: o que o dado bruto
   * manda anunciar, tarefa por tarefa e camada por camada, tem de ser
   * exatamente o que a lista anuncia. Nada a menos (o ALTO 3 da rodada 10) e
   * nada a mais (este).
   */
  const titulos = titulosDoDado(BRUTO);
  const esperadoPorTarefa = relacoesEsperadasPorTarefa(universo, titulos);
  /* O separador de itens é ", " — se um título contiver essa sequência, a
     guarda não sabe separar e diz isso em vez de medir errado. */
  const tituloAmbiguo = [...titulos.values()].find((t) => typeof t === "string" && t.includes(", "));
  if (tituloAmbiguo !== undefined) {
    problemas.push(
      `o título "${tituloAmbiguo}" contém ", " e esta guarda separa os itens da lista por ", " — não consigo conferir a lista item a item`,
    );
  }
  const tarefasDoDado = new Set(titulos.keys());
  for (const id of tarefasDoDado) {
    const item = lista[id];
    if (!item) {
      problemas.push(`a tarefa "${id}" existe no dado bruto e NÃO tem linha na lista acessível`);
      continue;
    }
    const esperadoDaTarefa = esperadoPorTarefa.get(id) ?? new Map();
    const camadasNaLista = Object.keys(item.porCamada).filter((c) => c !== "nenhuma");
    for (const camada of new Set([...esperadoDaTarefa.keys(), ...camadasNaLista])) {
      const rotulo = CONTRATO.rotulos[camada];
      const esperados = [...(esperadoDaTarefa.get(camada) ?? new Set())].sort();
      const textoDoSpan = item.porCamada[camada];
      if (esperados.length > 0 && (textoDoSpan === undefined || !textoDoSpan.startsWith(`${rotulo}:`))) {
        problemas.push(
          `a tarefa "${String(item.titulo)}" deveria anunciar "${rotulo}: ${esperados.join(", ")}" e a lista diz ${
            textoDoSpan === undefined ? "NADA sobre essa camada" : `"${textoDoSpan}"`
          }`,
        );
        continue;
      }
      if (esperados.length === 0) {
        problemas.push(
          `a tarefa "${String(item.titulo)}" anuncia "${String(textoDoSpan)}" e o dado bruto não tem NENHUMA relação dela nessa camada — a lista está inventando vínculo`,
        );
        continue;
      }
      const naLista = itensDoSpan(textoDoSpan, rotulo).sort();
      /*
       * ALTO 2: o NOME que a tela escreve e o VERBO que ela usa embaixo dele
       * têm de dizer a mesma coisa sobre direção. Trocar dois rótulos de
       * lugar em `CAMADA_LABEL` passava em tudo — e fazia a lista anunciar
       * "Correlação: habilita X" (verbo com direção numa relação simétrica) e
       * "Sucessão: com Y" (verbo simétrico na única camada com direção).
       */
      const direcaoPrometida = CONTRATO.direcaoPorRotulo[rotulo];
      if (direcaoPrometida === undefined) {
        problemas.push(
          `a lista anuncia a camada "${camada}" sob o nome "${rotulo}", e src/lib/promessa-do-grafo.ts não diz se uma relação com esse nome tem direção`,
        );
      } else {
        for (const item of naLista) {
          const doVerbo = direcaoDoVerboNaGuarda(item);
          if (doVerbo === null) {
            problemas.push(
              `a lista escreve "${rotulo}: ${item}" e esse item abre com um verbo que a promessa da peça não conhece`,
            );
          } else if (doVerbo !== direcaoPrometida) {
            problemas.push(
              `"${rotulo}" é uma relação ${direcaoPrometida === "direcional" ? "COM" : "SEM"} direção na promessa da peça, e a lista escreve "${item}", que fala como ${doVerbo} — quem lê por leitor de tela recebe a dependência ao contrário`,
            );
          }
        }
      }
      const aMenos = esperados.filter((x) => !naLista.includes(x));
      const aMais = naLista.filter((x) => !esperados.includes(x));
      if (aMenos.length > 0) {
        problemas.push(
          `a tarefa "${String(item.titulo)}", camada "${camada}": a lista NÃO anuncia ${aMenos.map((x) => `"${x}"`).join(", ")}`,
        );
      }
      if (aMais.length > 0) {
        problemas.push(
          `a tarefa "${String(item.titulo)}", camada "${camada}": a lista anuncia ${aMais.map((x) => `"${x}"`).join(", ")} e isso NÃO existe no dado bruto`,
        );
      }
    }
    if (esperadoDaTarefa.size === 0 && item.porCamada["nenhuma"] === undefined && camadasNaLista.length === 0) {
      problemas.push(
        `a tarefa "${String(item.titulo)}" não tem relação nenhuma no dado bruto e a lista não diz "sem ligação com outra tarefa"`,
      );
    }
  }
  for (const id of Object.keys(lista)) {
    if (!tarefasDoDado.has(id)) {
      problemas.push(`a lista acessível tem uma linha para "${id}", que não existe no dado bruto`);
    }
  }

  // Tab de verdade: quantos itens da lista o teclado alcança.
  const total = Object.keys(lista).length;
  await page.evaluate(() => {
    const primeiro = document.querySelector("ol[aria-label] li[data-lb-tarefa] button");
    if (primeiro) primeiro.focus();
  });
  const alcancados = new Set();
  for (let i = 0; i < total + 4; i += 1) {
    const id = await page.evaluate(() => {
      const li = document.activeElement?.closest?.("li[data-lb-tarefa]");
      return li ? li.getAttribute("data-lb-tarefa") : null;
    });
    if (id) alcancados.add(id);
    await page.keyboard.press("Tab");
  }
  if (alcancados.size < total) {
    problemas.push(
      `o teclado alcançou ${String(alcancados.size)} dos ${String(total)} itens da lista acessível`,
    );
  }
  /*
   * BAIXO 7 da rodada 11: a saída prometia "as CINCO camadas" e imprimia
   * "7 arestas em 4 camadas", porque `data-camada` é sempre a camada BASE e
   * nunca vale "critico" — o caminho crítico é uma FLAG (`data-critica`) sobre
   * uma aresta de sucessão, por decisão da própria peça. A medida estava
   * certa; o rótulo, não. Agora a linha diz as duas contas pelo nome.
   */
  const camadasBase = CONTRATO.camadas.filter((c) => c !== "critico");
  const cobertas = new Set(universo.map((a) => a.camada));
  const criticas = universo.filter((a) => a.critica).length;
  exigir(
    problemas.length === 0 && total > 0,
    `${chave}${estado}: §10 teclado e leitor de tela — ${total === 0 ? "a lista acessível está vazia; " : ""}${problemas.slice(0, 3).join(" ; ")}`,
  );
  /* O mesmo botão passa a se chamar "ver grafo" depois do primeiro clique —
     por isso a volta usa um localizador próprio, e não o de ida. */
  const voltar = page.locator("button", { hasText: "ver grafo" }).first();
  if ((await voltar.count()) > 0) await voltar.click();
  await page.waitForSelector(".react-flow__viewport", { timeout: 10000 });
  await page.waitForTimeout(400);
  return `${String(universo.length)} arestas · ${String(cobertas.size)}/${String(camadasBase.length)} camadas base · ${String(criticas)} no caminho crítico (flag, não camada base) · ${String(alcancados.size)}/${String(total)} itens no Tab`;
}

// ═══════════════════════════════════════════════════════════════════════════
// AS MEDIDAS DO DESENHO, NUM ESTADO DA TELA  (§7, §8, §9, §10 e §12 juntas)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Rodada 11, BAIXO 6: §7 a §10 só existiam em DOIS estados (a tela nova e a
 * tela com um nó selecionado). A varredura de estados (§11) media só a faixa
 * "Hoje" e o zoom — pintura, traço triplo, glifos e lista acessível não eram
 * medidos depois de abrir "Legenda" ou "Camadas", que é justamente onde um
 * popover remonta o canvas. As cinco medidas viraram esta função, e §11 passa
 * a chamá-la em TODO estado derivado da tela.
 */
/**
 * O canvas está DEBAIXO de uma folha modal? A folha do celular ("Camadas" a
 * 390 px) é `fixed inset-x-0 bottom-0` com backdrop opaco por cima do grafo
 * inteiro: ali o canvas de fato não está na tela, e fotografar a folha para
 * dizer "a aresta não pinta" seria reprovar o produto por ele ter um modal.
 *
 * Exceção com conferência própria, nunca um `catch` mudo: exige-se que exista
 * `[role="dialog"][aria-modal="true"]` E que o que está no CENTRO do pane não
 * pertença ao canvas. Qualquer outra coisa cobrindo o canvas continua
 * reprovando — e as medidas que NÃO dependem de pixel (§12, o canvas × o
 * dado) rodam do mesmo jeito.
 */
async function canvasCobertoPorFolhaModal(page) {
  return page.evaluate(() => {
    const pane = document.querySelector(".react-flow");
    const folha = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!pane || !folha) return { coberto: false, temFolha: folha !== null, quem: "" };
    const r = pane.getBoundingClientRect();
    const acima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const doCanvas = acima !== null && pane.contains(acima);
    return {
      coberto: !doCanvas,
      temFolha: true,
      daFolha: acima !== null && (folha.contains(acima) || acima.getAttribute("aria-hidden") === "true"),
      quem: acima === null ? "nada" : `${acima.tagName.toLowerCase()}.${String(acima.className).slice(0, 40)}`,
    };
  });
}

/**
 * As medidas do desenho num estado da tela. `camadasAtivas` é o que o operador
 * tem MARCADO ali (a guarda sabe porque foi ela que marcou) — e é contra isso
 * que o universo derivado do dado bruto é filtrado.
 *
 * `opcoes.comSelecao` liga o papel "destacada" no piso de papéis exigidos
 * (achado ALTO 4: o estado com um cartão selecionado era medido por
 * `medirPinturaDasArestas` sozinha, sem §8, §9, §10 nem §12, e com piso de 1
 * aresta por papel — apagar uma sucessão SÓ quando há seleção passava).
 */
async function medirODesenhoInteiro(page, chave, estado, camadasAtivas, opcoes = {}) {
  const comSelecao = opcoes.comSelecao === true;
  const esperaEsmaecidas = opcoes.esperaEsmaecidas === true;
  /*
   * O piso de papéis deste estado é DERIVADO do universo filtrado pelas
   * camadas marcadas — não uma lista escrita aqui. Com só "Sucessão" e
   * "Caminho crítico" ligadas (o default da casa), correlação, sinergia e
   * obsolescência não estão na tela e exigi-las seria reprovar o produto por
   * ele obedecer ao próprio painel; exigir a lista inteira sempre foi o que
   * impediu §7–§12 de rodarem no estado em que a tela NASCE (ALTO 2).
   */
  const papeisDoEstado = [
    ...new Set(
      universoNasCamadas(UNIVERSO, camadasAtivas).map((e) => (e.critica ? "critico" : e.camada)),
    ),
  ].concat(comSelecao ? ["destacada"] : []);
  /*
   * O papel "destacada" só existe com um nó selecionado; e no estado COM
   * seleção uma das sucessões VIRA destacada, então a cor de cada papel se
   * prova no estado SEM seleção (onde todos têm todas as suas arestas) e o
   * estado com seleção prova a cor só do papel que ele é o único a produzir.
   */
  const papeisComProvaDeCor = comSelecao ? ["destacada"] : papeisDoEstado;
  const contrato = await lerContratoDoCanvas(page);
  const cobertura = await canvasCobertoPorFolhaModal(page);
  if (cobertura.coberto) {
    exigir(
      cobertura.temFolha && cobertura.daFolha,
      `${chave}${estado}: §7 alguma coisa cobre o CENTRO do canvas e NÃO é a folha modal do painel: ${cobertura.quem}`,
    );
    const leitura = await page.evaluate(LEITURA_DAS_ARESTAS);
    const contraODado = medirCanvasContraOUniverso(chave, estado, contrato, leitura.arestas, camadasAtivas);
    return {
      pintura: { linha: "canvas debaixo da folha modal — §7/§8/§9 não se medem através dela", detalhePorAresta: [], arestas: leitura.arestas },
      triplo: "n/d (folha modal)",
      tripla: "n/d (folha modal)",
      glifos: "n/d (folha modal)",
      alcance: "n/d (folha modal)",
      contraODado,
    };
  }
  const pintura = await medirPinturaDasArestas(
    page,
    chave,
    estado,
    papeisDoEstado,
    papeisComProvaDeCor,
    esperaEsmaecidas,
  );
  const triplo = medirTracoTriplo(chave, estado, pintura.bandasPorCritica, pintura.detalhePorAresta);
  const tripla = await medirCadaTracoDaTripla(page, chave, estado, escalaDe(await transformDoCanvas(page)));
  const contraODado = medirCanvasContraOUniverso(chave, estado, contrato, pintura.arestas, camadasAtivas);
  const glifos = await medirGlifos(page, chave, estado, pintura.arestas, pintura.alfaPicoPorAresta);
  const alcance = await medirAlcanceSemMouse(page, chave, estado, pintura.arestas, contrato, camadasAtivas);
  return { pintura, triplo, tripla, glifos, alcance, contraODado };
}

// ═══════════════════════════════════════════════════════════════════════════
// §16 · A LISTA ACESSÍVEL OBEDECE AO PAINEL "CAMADAS"  (achado MÉDIO 6)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Dois defeitos de PRODUTO, um dentro do outro, e nenhuma medida via nenhum:
 *
 *  1. `AccessibleGraphList` recebia `arestas={arestasVisuais}` — as arestas
 *     CRUAS, sem passar por `filtrarArestasPorCamada`. Com só "Sucessão"
 *     marcada, o canvas mostrava 4 arestas de sucessão e a lista continuava
 *     anunciando Correlação, Sinergia, Obsolescência e Caminho crítico.
 *  2. o ramo `if (accessibleFallback)` devolvia SÓ a `<ol>`, deixando a barra
 *     do grafo — e com ela o pill "Camadas" — fora da tela. Quem troca o
 *     canvas pela lista (o caminho de quem não usa mouse) perdia o único
 *     controle que a peça nomeia: não havia como desligar camada nenhuma.
 *
 * Os dois foram consertados no produto. Esta medida cobra os dois: o painel
 * EXISTE no modo lista, e desmarcar uma camada some com ela da lista —
 * conferido contra o universo derivado, camada por camada, em TODAS as
 * camadas (não numa amostra).
 */
async function medirListaObedeceAsCamadas(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  const { ctx, page } = await abrirPagina(browser, caso);
  const linhas = [];
  try {
    await ligarTodasAsCamadas(page);
    await page.waitForTimeout(400);
    const botao = page.locator("button", { hasText: "ver como lista" }).first();
    if ((await botao.count()) === 0) {
      exigir(false, `${chave}: §16 não achei o botão "ver como lista"`);
      return linhas;
    }
    await botao.click();
    await page.waitForSelector("ol[aria-label] li[data-lb-tarefa]", { timeout: 10000 });
    await page.waitForTimeout(300);

    const pill = page.locator('button[aria-label="Camadas"]').first();
    const temPainel = (await pill.count()) > 0;
    exigir(
      temPainel,
      `${chave}: §16 o modo LISTA não tem o pill "Camadas" — quem não usa mouse fica sem o único controle que a peça nomeia`,
    );
    if (!temPainel) return linhas;

    const lerCamadasAnunciadas = async () =>
      page.evaluate(() =>
        [...document.querySelectorAll("ol[aria-label] li[data-lb-tarefa] [data-lb-camada]")].map((el) =>
          el.getAttribute("data-lb-camada"),
        ),
      );

    const painel = await abrirPainelDeCamadas(page);
    if (painel === null) {
      exigir(false, `${chave}: §16 o pill "Camadas" existe no modo lista e não abre o painel`);
      return linhas;
    }
    const porRotulo = new Map(CONTRATO.camadas.map((c) => [CONTRATO.rotulos[c], c]));
    const indiceDaCamada = new Map();
    painel.rotulos.forEach((r, i) => {
      const camada = porRotulo.get(r.texto);
      if (camada) indiceDaCamada.set(camada, i);
    });
    const semCaixa = CONTRATO.camadas.filter((c) => !indiceDaCamada.has(c));
    if (semCaixa.length > 0) {
      exigir(false, `${chave}: §16 camada sem caixa no painel do modo lista: ${semCaixa.join(", ")}`);
      return linhas;
    }
    const marcar = async (camada, valor) => {
      const caixas = page.locator('[role="dialog"][aria-label="Camadas do grafo"] input[type="checkbox"]');
      const caixa = caixas.nth(indiceDaCamada.get(camada));
      if (valor) await caixa.check();
      else await caixa.uncheck();
      await page.waitForTimeout(450);
    };

    for (const camada of CONTRATO.camadas) {
      await marcar(camada, false);
      const marcadasAgora = CONTRATO.camadas.filter((c) => c !== camada);
      const anunciadas = await lerCamadasAnunciadas();
      const esperadas = universoNasCamadas(UNIVERSO, marcadasAgora);
      const camadasEsperadas = new Set();
      for (const e of esperadas) {
        camadasEsperadas.add(e.camada);
        if (e.critica) camadasEsperadas.add("critico");
      }
      const aMais = [...new Set(anunciadas)].filter((c) => c !== "nenhuma" && !camadasEsperadas.has(c));
      const aMenos = [...camadasEsperadas].filter((c) => !anunciadas.includes(c));
      exigir(
        aMais.length === 0,
        `${chave}: §16 com "${CONTRATO.rotulos[camada]}" DESMARCADA, a lista acessível continua anunciando ${aMais.join(", ")} — ela não obedece ao painel`,
      );
      exigir(
        aMenos.length === 0,
        `${chave}: §16 com "${CONTRATO.rotulos[camada]}" desmarcada, a lista acessível deixou de anunciar ${aMenos.join(", ")}, que continuam no dado`,
      );
      linhas.push(
        `${camada} off: lista anuncia [${[...new Set(anunciadas)].filter((c) => c !== "nenhuma").sort().join("+") || "nada"}]`,
      );
      await marcar(camada, true);
    }
    await fecharPainelDeCamadas(page);
  } finally {
    await ctx.close();
  }
  return linhas;
}

// ═══════════════════════════════════════════════════════════════════════════
// §17 · FONTE DESLIGADA ESMAECE A ARESTA DE VERDADE  (achado MÉDIO 7)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * `style: { opacity: dimmed ? 0.15 : 1 }` era CÓDIGO MORTO: no ReactFlow 11 o
 * `EdgeWrapper` não aplica `style` ao `<g>` — ele o passa como prop ao
 * componente customizado, e `V3Edge` desestruturava só `{ data }`. Provado:
 * `opacity: 0` em todas as arestas não mudava nada na tela e
 * `getComputedStyle` devolvia `style = null`. Consequência real: aresta de
 * fonte desligada NUNCA esmaeceu, enquanto o cartão da mesma fonte esmaecia.
 *
 * Consertado o produto (o esmaecimento anda por `data` e é aplicado no `<g>`),
 * a régua aqui mede o que o olho recebe: com um filtro de fonte ligado, a
 * aresta cujas DUAS pontas estão fora tem de ficar visivelmente mais apagada
 * que uma vizinha que continua dentro — comparação na MESMA tela, como §8 e §9
 * já fazem, nunca contra uma constante escrita aqui.
 *
 * O filtro é escolhido pelo DADO: a fonte que deixa alguma aresta com as duas
 * pontas fora e alguma outra com pelo menos uma dentro. Se nenhuma fonte fizer
 * isso, não há o que medir — e isso é reprovação, nunca dispensa.
 */
const FRACAO_MAXIMA_DO_ALFA_ESMAECIDO = 0.6;

/** No celular cada painel é uma ABA; o filtro de fontes mora na aba "Fontes". */
async function irParaAba(page, caso, nome) {
  if (caso.desktop) return;
  const aba = page.locator('nav[aria-label="Painéis"] button', { hasText: nome });
  if ((await aba.count()) > 0) {
    await aba.first().click();
    await page.waitForTimeout(600);
  }
}

async function medirEsmaecimentoPorFonte(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  const { ctx, page } = await abrirPagina(browser, caso);
  try {
    await ligarTodasAsCamadas(page);
    await page.waitForTimeout(400);
    await irParaAba(page, caso, "Fontes");
    const caixas = page.locator('fieldset input[type="checkbox"]');
    const n = await caixas.count();
    if (n < 2) {
      exigir(false, `${chave}: §17 não achei o filtro de fontes (${String(n)} caixas) — sem ele o esmaecimento não tem como ser exercido`);
      return "sem filtro";
    }
    /* Deixa só a PRIMEIRA fonte marcada: alguma aresta fica com as duas pontas
       fora (esmaecida) e alguma fica com uma ponta dentro (normal). Se a
       escolha não produzir os dois lados, a medida reprova logo abaixo. */
    for (let i = 1; i < n; i += 1) {
      const caixa = caixas.nth(i);
      if (await caixa.isChecked()) await caixa.uncheck();
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(700);
    await irParaAba(page, caso, "Grafo");
    await page.waitForSelector(".react-flow__viewport", { timeout: 20000 });
    await page.waitForTimeout(700);

    const leitura = await page.evaluate(LEITURA_DAS_ARESTAS);
    const esmaecidas = leitura.arestas.filter((a) => a.esmaecida && !a.semPath);
    const inteiras = leitura.arestas.filter((a) => !a.esmaecida && !a.semPath);
    exigir(
      esmaecidas.length > 0 && inteiras.length > 0,
      `${chave}: §17 com uma fonte só marcada, o canvas tem ${String(esmaecidas.length)} aresta(s) esmaecida(s) e ${String(inteiras.length)} inteira(s) — precisa das duas para comparar na mesma tela. Aresta que nunca esmaece é o código morto que esta medida existe para pegar`,
    );
    if (esmaecidas.length === 0 || inteiras.length === 0) return "sem os dois lados";

    const grupos = await page.$$(SELETOR_DA_ARESTA);
    const alfaDe = async (a) => {
      const i = leitura.arestas.indexOf(a);
      const g = grupos[i];
      if (!g || !Array.isArray(a.pontos) || a.pontos.length === 0) return null;
      const janela = janelaDosPontos(a.pontos, RAIO_DA_AMOSTRA + 3, page.viewportSize());
      if (janela === null) return null;
      const fotos = await fotosComESem(page, g, janela);
      if (fotos.erro) return null;
      let pico = 0;
      for (const ponto of a.pontos) {
        const amostra = amostraNoPonto(
          fotos,
          ponto,
          a.corEsperada,
          RAIO_DA_AMOSTRA,
          hexEmRgb(CONTRATO.cores[a.papel] ?? "#000000"),
          CONTRATO.pisoDeContraste,
        );
        if (amostra.dentro && amostra.alfaPico > pico) pico = amostra.alfaPico;
      }
      return pico;
    };

    let piorInteira = 0;
    for (const a of inteiras) {
      const alfa = await alfaDe(a);
      if (alfa !== null && alfa > piorInteira) piorInteira = alfa;
    }
    const problemas = [];
    const medidos = [];
    for (const a of esmaecidas) {
      const alfa = await alfaDe(a);
      if (alfa === null) {
        problemas.push(`${a.id}: não consegui medir o α dela na tela, e não medir é reprovar`);
        continue;
      }
      medidos.push(`${a.id.split(":")[0]} α${alfa.toFixed(2)}`);
      if (piorInteira <= 0) continue;
      if (alfa > FRACAO_MAXIMA_DO_ALFA_ESMAECIDO * piorInteira) {
        problemas.push(
          `${a.id}: as duas pontas estão fora do filtro e a aresta pinta com α ${alfa.toFixed(2)} contra ${piorInteira.toFixed(2)} da vizinha que ficou dentro (teto ${String(FRACAO_MAXIMA_DO_ALFA_ESMAECIDO)}×) — ela não esmaeceu`,
        );
      }
    }
    exigir(
      piorInteira > 0,
      `${chave}: §17 nenhuma aresta INTEIRA pôde ser medida nesta tela — sem a referência, o α da esmaecida não diz nada`,
    );
    exigir(problemas.length === 0, `${chave}: §17 o esmaecimento por fonte — ${problemas.slice(0, 3).join(" ; ")}`);
    return `${String(esmaecidas.length)} esmaecida(s) [${medidos.join(", ")}] contra α ${piorInteira.toFixed(2)} da inteira`;
  } finally {
    await ctx.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// §15 · O DESENHO DEPOIS DO GESTO DO OPERADOR  (achado ALTO 3)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * §3–§6 rodavam numa página limpa própria e mediam SÓ a escala do viewport;
 * §7–§12 rodavam antes, sempre no zoom inicial. A varredura de estados (§11)
 * fechou a porta dos popovers e deixou a do gesto escancarada — é a forma 4
 * (medir um instante só), aplicada ao eixo que o operador mexe toda hora.
 *
 * Provado pelo crítico com uma linha em `v3-edge.tsx` (`if (zoomSeguro > 1.2)
 * return null`): zoom inicial com 4 arestas no DOM, e ZERO depois de seis
 * cliques no botão de zoom do próprio produto — com os cinco portões verdes.
 *
 * O que se mede aqui, depois do gesto:
 *   • o canvas × o universo derivado (DOM, robusto a aresta fora da janela);
 *   • que alguma aresta continua PINTANDO de fato (pixel) — e não medir
 *     nenhuma é reprovação, nunca dispensa;
 *   • o mesmo depois de um PAN de verdade (arrastar o fundo);
 *   • e, no mesmo gesto, que arrastar um CARTÃO não o move — a posição é
 *     derivada do grafo, e isto é contrato (achado BAIXO 13, 3ª parte).
 */
async function medirPinturaLeve(page, chave, estado, arestas, cartoes, pane) {
  const problemas = [];
  const grupos = await page.$$(SELETOR_DA_ARESTA);
  const vista = page.viewportSize();
  const caixas = Object.values(cartoes ?? {});
  /* O canvas RECORTA o que sai dele (`.react-flow` tem overflow escondido):
     depois de um zoom de 1,8 pedaços de traço passam a cair acima da barra do
     grafo e simplesmente não são pintados ali. Medido na árvore honesta: duas
     arestas com 6 a 15 pontos "na tela" e ZERO pixels mudando, porque os
     pontos estavam fora do retângulo do canvas. A régua é o retângulo do
     CANVAS, não o da janela. */
  const dentroDoPane = (p) =>
    pane === undefined ||
    pane === null ||
    (p.x >= pane.x && p.x <= pane.x + pane.largura && p.y >= pane.y && p.y <= pane.y + pane.altura);
  /*
   * ── O QUE É "MEDÍVEL" DEPOIS DO GESTO, E POR QUE ISSO NÃO É DISPENSA ───
   *
   * Depois de seis cliques de zoom o mundo fica maior que a tela: pedaços de
   * traço saem da janela de visão, e outros passam a correr ATRÁS de um
   * cartão (o cartão também cresceu). Exigir que TODA aresta do DOM pinte
   * seria reprovar a oclusão e o recorte — nenhum dos dois é defeito, e os
   * dois foram medidos na árvore honesta.
   *
   * A régua, então, é geométrica e decidida ANTES de olhar o pixel: um ponto
   * do traço só vota se estiver DENTRO da janela E FORA de todo cartão. Onde
   * sobra ponto assim, a aresta TEM de pintar — e "nenhuma aresta sobrou para
   * medir" é reprovação, nunca silêncio (é exatamente a forma 2 do vício
   * desta esteira: aprovar por ausência).
   */
  const foraDeCartao = (p) =>
    !caixas.some(
      (c) => p.x >= c.x - 2 && p.x <= c.x + c.largura + 2 && p.y >= c.y - 2 && p.y <= c.y + c.altura + 2,
    );
  let medidas = 0;
  let pintam = 0;
  for (let i = 0; i < arestas.length; i += 1) {
    const a = arestas[i];
    const g = grupos[i];
    if (!g || a.semPath || !Array.isArray(a.pontos) || a.pontos.length === 0) continue;
    const livres = a.pontos.filter(
      (p) =>
        p.x >= 0 &&
        p.y >= 0 &&
        p.x < vista.width &&
        p.y < vista.height &&
        dentroDoPane(p) &&
        foraDeCartao(p),
    );
    if (livres.length === 0) continue; // fora da tela ou atrás de cartão: não é defeito
    const janela = janelaDosPontos(livres, RAIO_DA_AMOSTRA + 3, vista);
    if (janela === null) continue;
    const fotos = await fotosComESem(page, g, janela);
    if (fotos.erro) {
      if (ehErroDeAmbiente(fotos.erro)) naoConsegui(`${chave}${estado} · ${a.id}: ${fotos.erro}`);
      else problemas.push(`${a.id}: ${fotos.erro}`);
      continue;
    }
    let mudaram = 0;
    let dentro = false;
    for (const ponto of livres) {
      const amostra = amostraNoPonto(fotos, ponto, a.corEsperada, RAIO_DA_AMOSTRA);
      if (!amostra.dentro) continue;
      dentro = true;
      mudaram += amostra.mudaram;
    }
    if (!dentro) continue;
    medidas += 1;
    if (mudaram >= 12) pintam += 1;
    else {
      problemas.push(
        `${a.id} (papel "${a.papel}"): tem ${String(livres.length)} ponto(s) de traço na tela e fora de qualquer cartão, e não pinta em nenhum — ${String(mudaram)} pixels mudam ao escondê-la`,
      );
    }
  }
  exigir(
    medidas > 0 && problemas.length === 0,
    `${chave}${estado}: §15 a pintura depois do gesto — ${
      medidas === 0
        ? "NENHUMA aresta caiu na janela de visão para ser medida em pixel, e não medir é reprovar"
        : problemas.slice(0, 3).join(" ; ")
    }`,
  );
  return `${String(pintam)}/${String(medidas)} pintam`;
}

async function medirDepoisDoGesto(page, chave, camadasAtivas) {
  const linhas = [];
  const caixaDoCanvas = await page.evaluate(() => {
    const el = document.querySelector(".react-flow");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, largura: r.width, altura: r.height };
  });

  // ── depois do ZOOM (o gesto já foi aplicado por quem chama) ─────────────
  const zoom = escalaDe(await transformDoCanvas(page));
  const leituraZoom = await page.evaluate(LEITURA_DAS_ARESTAS);
  const contratoZoom = await lerContratoDoCanvas(page);
  const dadoZoom = medirCanvasContraOUniverso(
    chave,
    ` (depois do zoom ${String(zoom)})`,
    contratoZoom,
    leituraZoom.arestas,
    camadasAtivas,
  );
  const pinturaZoom = await medirPinturaLeve(
    page,
    chave,
    ` (depois do zoom ${String(zoom)})`,
    leituraZoom.arestas,
    leituraZoom.cartoes,
    caixaDoCanvas,
  );
  linhas.push(`zoom ${String(zoom)}: ${dadoZoom} · ${pinturaZoom}`);

  // ── e depois de um PAN de verdade (arrastar o fundo) ────────────────────
  const antesDoPan = await page.evaluate(() => {
    const el = document.querySelector(".react-flow__viewport");
    return el ? getComputedStyle(el).transform : null;
  });
  /*
   * O ponto de partida do arrasto tem de ser FUNDO de verdade. Medido a
   * 390×800 na árvore honesta: o centro do pane cai em cima de um cartão (a
   * 1,8 de zoom um cartão ocupa quase a largura inteira), o `mousedown` vai
   * para o nó e o pan não acontece — a guarda acusava "arrastar o fundo não
   * moveu nada" sobre um produto que estava certo. Procura-se um ponto cuja
   * pilha de elementos comece no próprio `.react-flow__pane`.
   */
  const pontoDeFundo = await page.evaluate(() => {
    const pane = document.querySelector(".react-flow__pane");
    if (!pane) return null;
    const r = pane.getBoundingClientRect();
    for (const fx of [0.5, 0.15, 0.85, 0.3, 0.7, 0.05, 0.95]) {
      for (const fy of [0.5, 0.12, 0.88, 0.3, 0.7]) {
        const x = r.x + r.width * fx;
        const y = r.y + r.height * fy;
        const acima = document.elementFromPoint(x, y);
        if (acima === pane) return { x: x, y: y };
      }
    }
    return null;
  });
  if (pontoDeFundo === null) {
    exigir(
      false,
      `${chave}: §15 não achei um ponto do FUNDO do canvas livre de cartão para arrastar — sem isso o pan não pode ser exercido`,
    );
    return linhas;
  }
  const centro = pontoDeFundo;
  await page.mouse.move(centro.x, centro.y);
  await page.mouse.down();
  await page.mouse.move(centro.x - 70, centro.y - 50, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const depoisDoPan = await page.evaluate(() => {
    const el = document.querySelector(".react-flow__viewport");
    return el ? getComputedStyle(el).transform : null;
  });
  exigir(
    depoisDoPan !== null && depoisDoPan !== antesDoPan,
    `${chave}: §15 arrastar o FUNDO do canvas não moveu nada (transform ${String(antesDoPan)} antes e depois) — o pan é o único arrasto que esta peça promete`,
  );
  exigir(
    Math.abs((escalaDe(depoisDoPan) ?? 0) - (zoom ?? 0)) < 1e-6,
    `${chave}: §15 o pan mexeu no ZOOM (${String(zoom)} → ${String(escalaDe(depoisDoPan))}) — arrastar o fundo desloca, não amplia`,
  );
  const leituraPan = await page.evaluate(LEITURA_DAS_ARESTAS);
  const contratoPan = await lerContratoDoCanvas(page);
  const dadoPan = medirCanvasContraOUniverso(chave, " (depois do pan)", contratoPan, leituraPan.arestas, camadasAtivas);
  const pinturaPan = await medirPinturaLeve(
    page,
    chave,
    " (depois do pan)",
    leituraPan.arestas,
    leituraPan.cartoes,
    caixaDoCanvas,
  );
  linhas.push(`pan: ${dadoPan} · ${pinturaPan}`);

  /*
   * ── E O CARTÃO NÃO SE ARRASTA (achado BAIXO 13, 3ª parte) ──────────────
   *
   * A peça é descrita por fora como "canvas de nós arrastáveis" e passa
   * `nodesDraggable={false}`: a posição de cada cartão é DERIVADA do grafo.
   * Ou a descrição está errada, ou o produto está — e nenhuma medida dizia
   * qual. Esta diz: o `transform` do nó (a posição em px de MUNDO) tem de ser
   * o mesmo antes e depois de um arrasto de 80×60 px em cima dele.
   */
  const noParaArrastar = await page.evaluate(() => {
    const no = document.querySelector(".react-flow__node[data-id]");
    if (!no) return null;
    const r = no.getBoundingClientRect();
    return {
      id: no.getAttribute("data-id"),
      transform: getComputedStyle(no).transform,
      centro: { x: r.x + r.width / 2, y: r.y + r.height / 2 },
    };
  });
  if (noParaArrastar === null) {
    exigir(false, `${chave}: §15 nenhum cartão no canvas para provar que ele não se arrasta`);
    return linhas;
  }
  await page.mouse.move(noParaArrastar.centro.x, noParaArrastar.centro.y);
  await page.mouse.down();
  await page.mouse.move(noParaArrastar.centro.x + 80, noParaArrastar.centro.y + 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const depoisDoArrasto = await page.evaluate((id) => {
    const no = [...document.querySelectorAll(".react-flow__node[data-id]")].find(
      (n) => n.getAttribute("data-id") === id,
    );
    return no ? getComputedStyle(no).transform : null;
  }, noParaArrastar.id);
  exigir(
    depoisDoArrasto === noParaArrastar.transform,
    `${chave}: §15 arrastar o cartão "${String(noParaArrastar.id)}" MOVEU o cartão (${String(noParaArrastar.transform)} → ${String(depoisDoArrasto)}) — a posição é derivada do grafo, não do mouse`,
  );
  linhas.push(`cartão arrastado: ${depoisDoArrasto === noParaArrastar.transform ? "não saiu do lugar" : "SAIU DO LUGAR"}`);
  return linhas;
}

// ═══════════════════════════════════════════════════════════════════════════
// §1–§9 numa largura
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// §19/§20/§21 · AS SENTINELAS DE TEMPO  (achado ALTO da rodada 14)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * **O que estava aberto, e por quê.** Esta guarda media a carga, o estado
 * default, o zoom e o pan — tudo no COMEÇO da vida da página. Nenhuma medida
 * olhava para trás depois que o tempo passou, e uma regressão que ARMA DEPOIS
 * era invisível. Medido pelo coordenador, com quatro linhas dentro de
 * `v3-edge.tsx` (um `setTimeout` de 45 s que devolve `null` para toda aresta
 * não crítica):
 *
 *     t =  2s  {"arestasNoCanvas":4,"porCamada":{"sucessao":4}}
 *     t = 50s  {"arestasNoCanvas":4,"porCamada":{"sucessao":2}}
 *
 * Duas dependências somem da tela do operador, em silêncio, e os CINCO
 * portões ficavam verdes — esta guarda inclusive, imprimindo "todas as
 * promessas medidas no navegador se sustentam".
 *
 * É a **forma 4** do vício desta casa (*a guarda mede um instante só*), e era
 * a última das cinco que a peça P4 ainda tinha aberta. As outras quatro
 * continuam fechadas onde já estavam: forma 1 (conta a si mesma) em §0/§12,
 * forma 2 (aprova por ausência) nos pisos derivados de §7, forma 3 (universo
 * por convenção) em `derivarContrato`, forma 5 (o caso, não a classe) em §11.
 *
 * ## As três medidas, e as três redes de cada uma
 *
 * | # | medida | régua |
 * |---|---|---|
 * | §19 V | o DESENHO continua de pé depois de o tempo real passar (sentinela viva as medidas inteiras daquela largura) | desenho refeito = desenho do nascimento, 0 escrita anotada |
 * | §20 W | idem, com o relógio adiantado meia hora DUAS vezes, com a tela exercida entre elas | idem |
 * | §21 X | o alcance de tempo declarado cobre tudo o que a guarda mede | 1 sentinela de cada tipo por largura, e nenhuma enxergando menos que a guarda |
 *
 * Três redes independentes em cada sentinela, porque uma só sempre tem um
 * ponto cego:
 *
 *   1. **a MEDIÇÃO DO PRODUTO REFEITA** — `medirODesenhoInteiro` inteiro, o
 *      mesmo de §7–§12: pixel que muda ao esconder, cor composta por aresta,
 *      o traço triplo medido traço a traço, o glifo de cada camada, a lista
 *      acessível e o canvas × o dado bruto. **Não é olhar atributo**: é o
 *      desenho medido de novo, tarde. Aqui o que envelhece é o CANVAS, e as
 *      regressões desta peça têm cara de aresta que some, cor que muda, glifo
 *      que desaparece e traço triplo que vira simples — nenhuma delas se vê
 *      lendo `tabindex`;
 *   2. **a FOTOGRAFIA do nascimento comparada com a do fim** — o que mudou
 *      entre os dois instantes, aresta por aresta: quem sumiu, quem nasceu,
 *      quem trocou de camada, de papel, de cor, de número de traços, de
 *      glifo, de opacidade ou de rota. Pega também a mudança que continua
 *      LEGAL (uma cor de contrato trocada por outra cor de contrato), que a
 *      rede 1 aprovaria;
 *   3. **o VIGIA dentro da página**, instalado por `addInitScript` ANTES da
 *      hidratação: ele intercepta a remoção de nó (`removeChild`/`remove`) e a
 *      escrita de atributo de desenho, e diz QUEM mudou, de quê para quê e AOS
 *      QUANTOS SEGUNDOS. É o que transforma "8 arestas sumiram" em "aos 45,0 s
 *      o React removeu 8 `g[data-camada]`".
 *
 * ## QUAL É O ALCANCE DE TEMPO DESTAS MEDIDAS — dito por extenso
 *
 * **O que está DENTRO:** qualquer coisa que mude o DESENHO do grafo — aresta
 * que some ou nasce, camada, papel, cor, opacidade, rota, número de traços da
 * tripla, glifo, rótulo — na rota que esta guarda visita, em CADA largura de
 * `LARGURAS`, com as cinco camadas ligadas, (a) a qualquer momento da vida
 * real das medidas DAQUELA LARGURA — a sentinela nasce antes da primeira e é
 * lida depois da última —, medida e impressa em cada §19, com piso escrito à
 * mão de `PISO_DE_VIDA_DA_SENTINELA_MS` (e, se a largura correr mais rápido
 * que o piso, a sentinela espera pelo piso em vez de declarar um alcance que
 * não teve); e (b) agendada para até 30 minutos depois da carga, mais outros
 * 30 minutos depois de a tela ser exercida (§20).
 *
 * **O que está FORA, e não se finge o contrário:** (a) atraso maior que os
 * dois adiantamentos de meia hora de §20; (b) mutação disparada por algo que
 * o relógio de mentira não controla e que só aconteça depois do fim da
 * corrida — a resposta de uma requisição de rede real que demore mais que
 * isso, por exemplo; (b′) regressão de tempo real mais lenta que as medidas
 * de UMA largura: §19 cobre a vida da sentinela daquela largura, não a corrida
 * inteira — quem cobre o longo prazo é §20, pelo relógio, sem pagar o relógio
 * de parede; (c) estados da tela que a sentinela não estabelece: ela
 * vive com as cinco camadas LIGADAS e sem seleção, então uma regressão que só
 * arme com um cartão selecionado, com uma camada desligada, depois do zoom ou
 * depois do F5 está fora — quem mede esses estados são §11, §13, §14, §15 e
 * §18, e eles continuam medindo um instante cada; (d) interação que o
 * exercício de §20 não faz: arrastar, rolar e o CLIQUE de verdade (clicar
 * aqui abriria painel e mudaria o estado que a sentinela vigia); (e) mutação
 * num nó que ainda não entrou na árvore — isso é montagem, não
 * envelhecimento, e quem a mede é a FOTOGRAFIA do nascimento, não o vigia.
 *
 * E **§21 é quem impede as duas de valerem para menos do que dizem**: toda
 * largura em que a guarda mediu o desenho tem de ter as suas duas sentinelas,
 * e nenhuma sentinela pode ter nascido enxergando menos arestas do que a
 * guarda enxergou naquela largura — sentinela que nasce encolhida concorda
 * com a tela por encolher junto.
 */

/** Piso de vida da sentinela de tempo real, escrito à mão — não derivado da corrida. */
const PISO_DE_VIDA_DA_SENTINELA_MS = 60000;

/** Quanto §20 adianta o relógio de uma vez. É o alcance agendado declarado. */
const ADIANTAMENTO_DO_RELOGIO_MS = 1800000;

/** O canal pelo qual o vigia entrega cada anotação AO NODE. */
const CANAL_DO_VIGIA_DO_DESENHO = "__vigiaDesenhoP4Envia";

/** Os atributos que decidem como (ou se) uma aresta é desenhada. */
const ATRIBUTOS_DO_DESENHO = [
  "d",
  "style",
  "class",
  "opacity",
  "display",
  "visibility",
  "hidden",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "fill",
  "fill-opacity",
  "transform",
  "points",
  "r",
  "data-camada",
  "data-critica",
  "data-esmaecida",
];

/** O que o vigia considera "peça do desenho" para efeito de ATRIBUTO. */
const SELETOR_DO_DESENHO =
  ".react-flow g[data-camada], .react-flow g[data-camada] path, .react-flow g[data-camada] polygon, .react-flow g[data-camada] circle, .react-flow g[data-camada] text";

/** O que o vigia considera "peça do desenho" para efeito de NÓ QUE SOME. */
const SELETOR_DE_PECA_QUE_SOME = ".react-flow g[data-camada], .react-flow__node";

/**
 * Este corpo NÃO roda no Node: o Playwright o serializa e o executa dentro do
 * Chromium, antes de qualquer script da página (`addInitScript`). Por isso ele
 * fala com `window.` em tudo.
 */
function VIGIA_DO_DESENHO(config) {
  const { canal, atributos, seletorDeAtributo, seletorDePeca } = config;
  /* Instalar duas vezes dobraria cada anotação — e contagem dobrada mente
     tanto quanto zerada. */
  if (Object.prototype.hasOwnProperty.call(window, "__vigiaDesenhoP4")) return;
  const inicio = Date.now();
  const anotacoes = [];
  let marcoMs = null;
  const enviar = typeof window[canal] === "function" ? window[canal] : null;
  const vigiados = new Set(atributos);

  const nomeDe = (el) => {
    const g = el.closest === undefined ? null : el.closest("[data-aresta-id]");
    const id = g === null ? el.getAttribute("data-id") : g.getAttribute("data-aresta-id");
    return `<${el.tagName.toLowerCase()}>${id === null ? "" : ` [${id}]`}`;
  };

  const anotar = (rede, el, oQue, de, para) => {
    if (!(el instanceof Element)) return;
    if (String(de) === String(para)) return;
    const m = {
      rede,
      oQue,
      de: String(de).slice(0, 60),
      para: String(para).slice(0, 60),
      alvo: nomeDe(el),
      aosMs: Date.now() - inicio,
    };
    anotacoes.push(m);
    if (enviar !== null) {
      try {
        enviar(m);
      } catch {
        // o canal caiu; as outras cópias continuam
      }
    }
  };

  /** Quantas peças de desenho existem dentro (ou são) este nó. */
  const pecasDentro = (no) => {
    if (!(no instanceof Element)) return [];
    const achadas = [];
    try {
      if (no.matches(seletorDePeca)) achadas.push(no);
      for (const d of no.querySelectorAll(seletorDePeca)) achadas.push(d);
    } catch {
      /* seletor impossível neste nó */
    }
    return achadas;
  };

  /*
   * Rede 1 — o observador. Pega TODA mudança de atributo e TODA remoção,
   * inclusive as que não passam pelas funções embrulhadas abaixo.
   */
  const observador = new MutationObserver((registros) => {
    for (const r of registros) {
      if (r.type === "attributes" && r.attributeName !== null) {
        const el = r.target;
        if (!(el instanceof Element) || !el.isConnected) continue;
        let casa = false;
        try {
          casa = el.matches(seletorDeAtributo);
        } catch {
          casa = false;
        }
        if (!casa) continue;
        anotar(
          "MutationObserver",
          el,
          `atributo ${r.attributeName}`,
          r.oldValue,
          el.getAttribute(r.attributeName),
        );
        continue;
      }
      if (r.type !== "childList") continue;
      for (const no of r.removedNodes) {
        const pecas = pecasDentro(no);
        if (pecas.length > 0) {
          anotar("MutationObserver", pecas[0], `${String(pecas.length)} peça(s) do desenho SAÍRAM da árvore`, "na tela", "removida");
        }
      }
      for (const no of r.addedNodes) {
        const pecas = pecasDentro(no);
        if (pecas.length > 0) {
          anotar("MutationObserver", pecas[0], `${String(pecas.length)} peça(s) do desenho ENTRARAM na árvore`, "ausente", "na tela");
        }
      }
    }
  });
  observador.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: atributos,
  });

  /*
   * Rede 2 — a remoção pela porta que o React usa de verdade. Não depende de
   * o observador acima sobreviver: quem desligar o `MutationObserver` ainda
   * cai aqui.
   */
  const remover0 = Node.prototype.removeChild;
  Node.prototype.removeChild = function (filho) {
    const pecas = pecasDentro(filho);
    const r = remover0.call(this, filho);
    if (pecas.length > 0) {
      anotar("removeChild", pecas[0], `${String(pecas.length)} peça(s) do desenho removidas por removeChild`, "na tela", "removida");
    }
    return r;
  };
  const remover1 = Element.prototype.remove;
  Element.prototype.remove = function () {
    const pecas = pecasDentro(this);
    const alvo = pecas.length > 0 ? pecas[0] : null;
    const quantas = pecas.length;
    const r = remover1.call(this);
    if (alvo !== null) {
      anotar("Element.remove", alvo, `${String(quantas)} peça(s) do desenho removidas por remove()`, "na tela", "removida");
    }
    return r;
  };

  /*
   * Rede 3 — a escrita de atributo que não passa pelo observador porque
   * alguém o desligou. `setAttribute` é a porta pela qual o React escreve em
   * SVG.
   */
  const set0 = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (nome, valor) {
    const chave = String(nome).toLowerCase();
    if (!vigiados.has(chave)) {
      set0.call(this, nome, valor);
      return;
    }
    let casa = false;
    try {
      casa = this.isConnected && this.matches(seletorDeAtributo);
    } catch {
      casa = false;
    }
    const de = this.getAttribute(nome);
    set0.call(this, nome, valor);
    if (casa) anotar("setAttribute", this, `atributo ${chave}`, de, this.getAttribute(nome));
  };

  window.__vigiaDesenhoP4 = {
    instalado: true,
    redes: ["MutationObserver", "removeChild/remove", "setAttribute"],
    /* O nascimento: daqui para a frente, toda anotação é ENVELHECIMENTO. */
    marcar: () => {
      marcoMs = Date.now() - inicio;
      return marcoMs;
    },
    marco: () => marcoMs,
    vidaMs: () => Date.now() - inicio,
    todas: () => anotacoes.slice(),
    depoisDoNascimento: () => (marcoMs === null ? [] : anotacoes.filter((m) => m.aosMs >= marcoMs)),
  };
}

/** Lê o vigia; não estar instalado é reprovação, nunca silêncio. */
async function lerVigiaDoDesenho(pagina) {
  try {
    return await pagina.evaluate(() => {
      const v = window.__vigiaDesenhoP4;
      if (v === undefined || v === null) {
        return { instalado: false, redes: [], marco: null, vidaMs: 0, antes: 0, depois: [] };
      }
      const depois = v.depoisDoNascimento();
      return {
        instalado: v.instalado === true,
        redes: v.redes,
        marco: v.marco(),
        vidaMs: v.vidaMs(),
        antes: v.todas().length - depois.length,
        depois: depois.slice(0, 40),
        quantasDepois: depois.length,
      };
    });
  } catch (erro) {
    return {
      instalado: false,
      redes: [],
      marco: null,
      vidaMs: 0,
      antes: 0,
      depois: [],
      quantasDepois: 0,
      quebrou: erro instanceof Error ? erro.message.split("\n")[0] : String(erro),
    };
  }
}

/**
 * A FOTOGRAFIA DO DESENHO — o retrato de tudo o que o canvas está afirmando
 * naquele instante, com uma identidade estável no tempo (o id da aresta, que
 * vem do dado, nunca a posição no documento: se o sabotador some com uma
 * aresta, a posição de todas as outras anda junto).
 *
 * Ela NÃO substitui a medição do produto — é a segunda rede, a que pega a
 * mudança que continuaria passando na primeira: uma cor de contrato trocada
 * por outra cor de contrato, um traço a menos na tripla, um glifo que virou o
 * glifo de outra camada.
 */
const FOTOGRAFIA_DO_DESENHO = `(() => {
  const assinaturaDaForma = (el) => {
    const t = el.tagName.toLowerCase();
    if (t === "circle") return "circle|r=" + Number(el.getAttribute("r") || 0).toFixed(1);
    const bruto = t === "polygon" ? (el.getAttribute("points") || "") : (el.getAttribute("d") || "");
    const nums = (bruto.match(/-?\\d+(?:\\.\\d+)?/g) || []).map(Number);
    const comandos = t === "path" ? (bruto.match(/[A-Za-z]/g) || []).join("") : "";
    if (nums.length < 4) return t + "|" + comandos + "|" + nums.join(",");
    let minX = Infinity, minY = Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      if (nums[i] < minX) minX = nums[i];
      if (nums[i + 1] < minY) minY = nums[i + 1];
    }
    const rel = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      rel.push((nums[i] - minX).toFixed(1) + " " + (nums[i + 1] - minY).toFixed(1));
    }
    return t + "|" + comandos + "|" + rel.join(",");
  };
  const arestas = [];
  for (const g of document.querySelectorAll(".react-flow g[data-camada]")) {
    const path = g.querySelector("path.lb-edge-path");
    const retrato = window.__lbp4.retrato(g);
    const glifos = [...g.querySelectorAll(".lb-edge-glifo")].map(assinaturaDaForma).sort();
    arestas.push({
      id: g.getAttribute("data-aresta-id"),
      camada: g.getAttribute("data-camada"),
      origem: g.getAttribute("data-origem"),
      destino: g.getAttribute("data-destino"),
      critica: g.getAttribute("data-critica") === "true",
      esmaecida: g.getAttribute("data-esmaecida") === "true",
      papel: g.classList.contains("lb-edge-destacada")
        ? "destacada"
        : g.getAttribute("data-critica") === "true" ? "critico" : g.getAttribute("data-camada"),
      semPath: path === null,
      cor: path === null ? "" : getComputedStyle(path).stroke,
      corComposta: path === null ? "" : window.__lbp4.corEsperada(path, "stroke"),
      tracejado: path === null ? "" : (path.getAttribute("stroke-dasharray") || ""),
      rota: path === null ? "" : (path.getAttribute("d") || ""),
      nTracos: g.querySelectorAll("path.lb-edge-path").length,
      glifos: glifos.join(" + "),
      temRotulo: g.querySelector(".lb-edge-label") !== null,
      alfa: Number(retrato.opacidadeAcumulada.toFixed(3)),
      visivel: retrato.visivelHerdado,
    });
  }
  arestas.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const porCamada = {};
  for (const a of arestas) porCamada[a.camada] = (porCamada[a.camada] || 0) + 1;
  return {
    arestas: arestas,
    porCamada: porCamada,
    criticas: arestas.filter((a) => a.critica).length,
    cartoes: document.querySelectorAll(".react-flow__node[data-id]").length,
    contrato: (() => {
      const el = document.querySelector("[data-lb-contrato-do-canvas]");
      return el === null ? null : el.getAttribute("data-lb-contrato-do-canvas");
    })(),
  };
})()`;

/** Os campos da fotografia cuja mudança é, por si, uma regressão do desenho. */
const CAMPOS_DA_FOTOGRAFIA = [
  "camada",
  "origem",
  "destino",
  "critica",
  "esmaecida",
  "papel",
  "semPath",
  "cor",
  "corComposta",
  "tracejado",
  "rota",
  "nTracos",
  "glifos",
  "temRotulo",
  "visivel",
];

/** Quanto a opacidade composta pode oscilar entre duas leituras sem ser regressão. */
const FOLGA_DO_ALFA_DA_FOTOGRAFIA = 0.02;

/**
 * Compara a fotografia do nascimento com a do fim e devolve, em português, o
 * que envelheceu. Esta rede não depende de o vigia ter sobrevivido nem de o
 * sabotador ter usado uma escrita conhecida: ela olha o desenho, e pronto.
 */
function oQueODesenhoPerdeu(foto0, foto1) {
  const problemas = [];
  const por0 = new Map(foto0.arestas.map((a) => [a.id, a]));
  const por1 = new Map(foto1.arestas.map((a) => [a.id, a]));
  const sumiram = foto0.arestas.filter((a) => !por1.has(a.id));
  const nasceram = foto1.arestas.filter((a) => !por0.has(a.id));
  if (sumiram.length > 0) {
    problemas.push(
      `${String(sumiram.length)} de ${String(foto0.arestas.length)} aresta(s) que o canvas desenhava no nascimento SUMIRAM da tela: ${sumiram
        .slice(0, 4)
        .map((a) => `${String(a.id)} (camada "${String(a.camada)}"${a.critica ? ", caminho crítico" : ""})`)
        .join(" · ")}`,
    );
  }
  if (nasceram.length > 0) {
    problemas.push(
      `${String(nasceram.length)} aresta(s) APARECERAM sem ninguém tocar na página: ${nasceram
        .slice(0, 4)
        .map((a) => String(a.id))
        .join(" · ")}`,
    );
  }
  const mudaram = [];
  for (const a of foto1.arestas) {
    const antes = por0.get(a.id);
    if (antes === undefined) continue;
    for (const campo of CAMPOS_DA_FOTOGRAFIA) {
      if (String(antes[campo]) !== String(a[campo])) {
        mudaram.push(
          `${String(a.id)}: ${campo} "${String(antes[campo]).slice(0, 40)}" → "${String(a[campo]).slice(0, 40)}"`,
        );
      }
    }
    if (Math.abs(antes.alfa - a.alfa) > FOLGA_DO_ALFA_DA_FOTOGRAFIA) {
      mudaram.push(`${String(a.id)}: opacidade composta ${String(antes.alfa)} → ${String(a.alfa)}`);
    }
  }
  if (mudaram.length > 0) {
    problemas.push(
      `${String(mudaram.length)} mudança(s) no desenho entre o nascimento e o fim: ${mudaram.slice(0, 4).join(" · ")}`,
    );
  }
  if (foto0.cartoes !== foto1.cartoes) {
    problemas.push(`os cartões do canvas foram de ${String(foto0.cartoes)} para ${String(foto1.cartoes)}`);
  }
  if (foto0.criticas !== foto1.criticas) {
    problemas.push(
      `o caminho crítico foi de ${String(foto0.criticas)} para ${String(foto1.criticas)} aresta(s) desenhada(s)`,
    );
  }
  if (String(foto0.contrato) !== String(foto1.contrato)) {
    problemas.push("o contrato que o canvas publica (`data-lb-contrato-do-canvas`) mudou sozinho");
  }
  return problemas;
}

/**
 * O estado ABSOLUTO no fim: não basta "não mudou" — o canvas tem de estar
 * desenhando, AGORA, tudo o que o dado bruto manda. Sem isto, uma sentinela
 * que nascesse já quebrada ficaria verde por coerência consigo mesma (a forma
 * 1 do vício).
 */
function oQueFaltaNoDesenhoAgora(foto, quando, camadasAtivas) {
  const problemas = [];
  const esperadas = universoNasCamadas(UNIVERSO, camadasAtivas);
  const desenhadas = foto.arestas.filter((a) => !a.semPath);
  const porId = new Set(desenhadas.map((a) => a.id));
  const faltando = esperadas.filter((e) => !porId.has(e.id));
  if (faltando.length > 0) {
    problemas.push(
      `${quando}: ${String(faltando.length)} de ${String(esperadas.length)} aresta(s) que o DADO BRUTO manda desenhar não estão no canvas: ${faltando
        .slice(0, 4)
        .map((e) => `${e.id} (camada "${e.camada}")`)
        .join(" · ")}`,
    );
  }
  const semPath = foto.arestas.filter((a) => a.semPath);
  if (semPath.length > 0) {
    problemas.push(
      `${quando}: ${String(semPath.length)} grupo(s) de aresta sem nenhum <path> dentro: ${semPath.slice(0, 3).map((a) => String(a.id)).join(", ")}`,
    );
  }
  const invisiveis = desenhadas.filter((a) => !a.visivel);
  if (invisiveis.length > 0) {
    problemas.push(
      `${quando}: ${String(invisiveis.length)} aresta(s) no DOM e fora da vista (visibility/display herdados): ${invisiveis.slice(0, 3).map((a) => String(a.id)).join(", ")}`,
    );
  }
  return problemas;
}

/** O que o vigia viu depois do nascimento, transformado em problema nomeado. */
function oQueOVigiaDoDesenhoViu(vigia) {
  const problemas = [];
  if (!vigia.instalado) {
    problemas.push(
      `o vigia do desenho não respondeu nesta página${vigia.quebrou === undefined ? "" : `: ${vigia.quebrou}`} — sem ele, a terceira rede não existe`,
    );
    return problemas;
  }
  if (vigia.marco === null) {
    problemas.push("o vigia nunca foi marcado no nascimento — não dá para separar montagem de envelhecimento");
    return problemas;
  }
  if (vigia.quantasDepois > 0) {
    problemas.push(
      `o vigia anotou ${String(vigia.quantasDepois)} escrita(s) no desenho DEPOIS do nascimento: ${vigia.depois
        .slice(0, 3)
        .map((m) => `${m.oQue} ${m.de}→${m.para} em ${m.alvo} aos ${(m.aosMs / 1000).toFixed(1)}s (rede: ${m.rede})`)
        .join(" · ")}`,
    );
  }
  return problemas;
}

/**
 * Deixa a página assentar. **Com relógio de mentira, quem causa o quadro é a
 * guarda**: `clock.install()` SUBSTITUI o `requestAnimationFrame` da página,
 * e esperar um quadro ali é esperar por uma coisa que só nós podemos causar —
 * impasse por construção. A peça P5 pagou esse pedágio na rodada 15 e a P6 na
 * 16; aqui a regra já nasce escrita.
 */
async function assentarSentinela(pagina, ms) {
  if (pagina.__relogioDeMentira === true) {
    await pagina.clock.runFor(ms);
    await pagina.waitForTimeout(Math.min(ms, 250));
    return;
  }
  await pagina.waitForTimeout(ms);
}

/** Os eventos que §20 dispara em cada peça da tela. */
const EVENTOS_EXERCIDOS = [
  "pointerover",
  "pointerenter",
  "pointermove",
  "pointerdown",
  "pointerup",
  "mouseover",
  "mousemove",
  "mousedown",
  "mouseup",
  "keydown",
  "keyup",
];

/** O que §20 exerce: os controles da tela e as peças do grafo. */
const SELETOR_EXERCIDO = 'button, a[href], .react-flow__node, .react-flow g[data-camada]';

/**
 * Exerce a tela: foco de verdade nos controles + uma bateria de eventos em
 * cada peça. Sem isto, um handler que só passa a existir com o tempo
 * (instalado por um `setTimeout` que acabou de disparar) nunca teria quem o
 * acordasse. O CLIQUE fica de fora de propósito: apertar um botão aqui abriria
 * painel e mudaria o estado que a sentinela vigia.
 */
async function exercitarATela(pagina) {
  return await pagina.evaluate(
    ({ seletor, eventos }) => {
      const alvos = [...document.querySelectorAll(seletor)].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      for (const el of alvos) {
        try {
          el.focus({ preventScroll: true });
        } catch {
          // elemento que não aceita foco
        }
        for (const nome of eventos) {
          let ev;
          /* `view: window` não é enfeite: o d3-zoom que o ReactFlow usa lê
             `event.view.document`, e um evento sintético sem `view` faz a
             PÁGINA lançar — a guarda acusaria o produto pelo próprio evento
             que ela inventou. Medido nesta rodada: 11 TypeError por corrida. */
          if (nome.startsWith("key")) ev = new KeyboardEvent(nome, { key: "Shift", bubbles: true, view: window });
          else if (nome.startsWith("pointer")) ev = new PointerEvent(nome, { bubbles: true, view: window });
          else ev = new MouseEvent(nome, { bubbles: true, view: window });
          el.dispatchEvent(ev);
        }
        try {
          el.blur();
        } catch {
          // elemento sem blur
        }
      }
      return alvos.length;
    },
    { seletor: SELETOR_EXERCIDO, eventos: EVENTOS_EXERCIDOS },
  );
}

/**
 * O que a guarda viu de aresta desenhada em cada largura — alimenta o piso de
 * §21. Registrado de dentro de §12, que roda em TODO estado medido.
 */
const DESENHO_VISTO_PELA_GUARDA = new Map();
function registrarDesenhoVisto(chave, quantas) {
  const antes = DESENHO_VISTO_PELA_GUARDA.get(chave) ?? 0;
  if (quantas > antes) DESENHO_VISTO_PELA_GUARDA.set(chave, quantas);
}

/** As sentinelas vivas, nascidas antes da primeira medida e lidas depois da última. */
const SENTINELAS_DO_DESENHO = [];

/**
 * Abre a página de uma sentinela: relógio (opcional) e vigia ANTES de
 * qualquer script da página, as cinco camadas ligadas, e a fotografia do
 * nascimento tirada só depois de tudo assentar.
 *
 * O nascimento NÃO é medida — é precondição. Sentinela que não nasce não vira
 * "defeito do produto": vira, em §19/§20/§21, uma reprovação que diz "a
 * precondição falhou" e nomeia o passo.
 */
async function nascerSentinela(browser, caso, comRelogioDeMentira) {
  const chave = `${caso.largura}x${caso.altura}`;
  const nome = `${chave} · ${comRelogioDeMentira ? "relógio de mentira" : "tempo real"}`;
  const ctx = await browser.newContext({ viewport: { width: caso.largura, height: caso.altura } });
  const registroForaDaPagina = [];
  /*
   * A cópia que mora no NODE: o vigia captura esta função antes do primeiro
   * script da página, e daí em diante toda anotação também sai da aba. É a
   * única cópia que nenhum código da página alcança.
   */
  await ctx.exposeBinding(CANAL_DO_VIGIA_DO_DESENHO, (_fonte, carga) => {
    registroForaDaPagina.push(carga);
  });
  /*
   * O relógio de mentira entra ANTES do vigia e antes de qualquer script da
   * página: um `setTimeout` que a página agendar depois disso é o relógio de
   * mentira que o guarda, e é por isso que `fastForward` consegue disparar.
   */
  if (comRelogioDeMentira) await ctx.clock.install();
  await ctx.addInitScript({ content: AJUDANTES_NA_PAGINA });
  await ctx.addInitScript(VIGIA_DO_DESENHO, {
    canal: CANAL_DO_VIGIA_DO_DESENHO,
    atributos: ATRIBUTOS_DO_DESENHO,
    seletorDeAtributo: SELETOR_DO_DESENHO,
    seletorDePeca: SELETOR_DE_PECA_QUE_SOME,
  });
  const page = comTetoNoEvaluate(await ctx.newPage());
  page.__relogioDeMentira = comRelogioDeMentira;
  const errosDePagina = [];
  page.on("pageerror", (e) => errosDePagina.push(String(e)));
  /*
   * ── A ABA RECARREGOU? (medido nesta rodada, e custou uma corrida) ───────
   *
   * A guarda sobe o `next dev` DESTA árvore. Quem mexer num arquivo da
   * árvore enquanto ela roda faz o servidor empurrar um recarregamento para
   * TODA aba aberta — e a aba da sentinela perde e refaz o desenho inteiro.
   * Medido: duas sentinelas, em contextos diferentes, perderam 8 arestas no
   * MESMO segundo da corrida, e o relatório dizia "o vigia anotou 40
   * escrita(s)" sem dizer de onde vinham. Contar a navegação não afrouxa
   * nada — o veredito continua vermelho —, só nomeia a causa em vez de
   * mandar a próxima pessoa caçar fantasma.
   */
  const navegacoes = { depoisDoNascimento: 0, contando: false };
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && navegacoes.contando) navegacoes.depoisDoNascimento += 1;
  });
  await page.goto(BASE, { waitUntil: "networkidle" });

  const abaGrafo = page.locator('nav[aria-label="Painéis"] button', { hasText: "Grafo" });
  let deuPe = false;
  for (let tentativa = 0; tentativa < 6 && !deuPe; tentativa += 1) {
    if (!caso.desktop && (await abaGrafo.count()) > 0) {
      await abaGrafo.first().click().catch(() => undefined);
    }
    await assentarSentinela(page, 400);
    const quantas = await page.evaluate(
      () => document.querySelectorAll(".react-flow g[data-camada]").length,
    );
    if (quantas > 0) deuPe = true;
  }
  if (!deuPe) {
    await ctx.close();
    throw new Error(
      `o canvas do grafo não desenhou nenhuma aresta em 6 tentativas${errosDePagina.length > 0 ? ` (a página lançou: ${errosDePagina[0]})` : ""}`,
    );
  }
  await esconderSeloDoNext(page);
  await assentarSentinela(page, 400);
  await ligarTodasAsCamadas(page);
  await assentarSentinela(page, 800);

  const foto = await page.evaluate(FOTOGRAFIA_DO_DESENHO);
  /*
   * O marco: daqui para a frente, toda anotação do vigia é ENVELHECIMENTO. O
   * que veio antes é a montagem do React e os cliques que ligaram as camadas —
   * e quem mede isso é esta fotografia, não o vigia.
   */
  const marco = await page.evaluate(() => window.__vigiaDesenhoP4?.marcar() ?? null);
  navegacoes.contando = true;
  return {
    nome,
    chave,
    caso,
    comRelogioDeMentira,
    ctx,
    page,
    registroForaDaPagina,
    errosDePagina,
    navegacoes,
    foto,
    marco,
    nascimento: Date.now(),
    ok: true,
  };
}

/*
 * ── O NASCIMENTO DAS SENTINELAS (achado ALTO da rodada 14) ────────────────
 *
 * Duas por largura — uma de tempo real e uma com o relógio da página sob
 * controle da guarda —, abertas ANTES da primeira medida daquela largura e
 * lidas DEPOIS da última. É a vida delas que dá o alcance de tempo de §19.
 *
 * **Por que POR LARGURA, e não uma leva só para a corrida inteira.** A
 * primeira versão abria as dez de uma vez e as mantinha vivas do começo ao
 * fim: 10 abas do painel abertas em paralelo. Medido numa máquina com
 * `load average` 9 e 13,7 GB de 16 em uso, com a guarda pinada em UM núcleo,
 * a corrida morreu de teto na quinta largura — `Target page, context or
 * browser has been closed` — e o veredito virou "não consegui medir". Isso é
 * o vermelho por CARGA que o achado MÉDIO 9 da rodada 13 existe para acabar.
 * Com a leva por largura, no máximo duas sentinelas vivem ao mesmo tempo, o
 * alcance continua SENDO MEDIDO E IMPRESSO em cada §19, e o piso escrito à
 * mão continua de pé: o que encolhe é o custo, não a régua.
 */
async function nascerAsSentinelasDe(browser, caso) {
  const nascidas = [];
  for (const comRelogioDeMentira of [false, true]) {
    const chave = `${caso.largura}x${caso.altura}`;
    const nome = `${chave} · ${comRelogioDeMentira ? "relógio de mentira" : "tempo real"}`;
    const t0 = Date.now();
    console.log("%s", `[${carimbo()}] → nascendo a sentinela ${nome} …`);
    try {
      const sentinela = await comTeto(
        nascerSentinela(browser, caso, comRelogioDeMentira),
        TETO_POR_ETAPA_MS,
        `o nascimento da sentinela ${nome}`,
      );
      nascidas.push(sentinela);
      console.log(
        "%s",
        `[${carimbo()}] ← sentinela ${nome} de pé — ${String(Math.round((Date.now() - t0) / 1000))}s · ${String(sentinela.foto.arestas.length)} arestas, ${String(sentinela.foto.criticas)} críticas, ${String(sentinela.foto.cartoes)} cartões`,
      );
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message.split("\n")[0] : String(erro);
      /* Travou ao nascer? Quem decide se foi o produto é a prova de §19/§20. */
      const travou = !(erro instanceof EstourouOTeto) && (ehTravamento(motivo) || !browser.isConnected());
      nascidas.push({ nome, chave, caso, comRelogioDeMentira, ok: false, motivo, travou, t0 });
      console.log("%s", `[${carimbo()}] ← sentinela ${nome} NÃO nasceu — ${motivo}`);
    }
  }
  for (const s of nascidas) SENTINELAS_DO_DESENHO.push(s);
  return nascidas;
}

/** O corpo comum de §19 e §20: as três redes, na ordem em que elas fazem sentido. */
async function conferirSentinela(sentinela, quando, extra) {
  /*
   * A ORDEM IMPORTA. O vigia e a fotografia são lidos ANTES da medição do
   * produto, porque a medição do produto ESCONDE e MOSTRA cada aresta e cada
   * glifo (é assim que ela vê o pixel mudar) e troca o canvas pela lista
   * acessível — tudo isso é escrita no desenho, feita pela guarda. Lida
   * depois, a rede 3 acusaria a própria guarda.
   */
  const vigia = await lerVigiaDoDesenho(sentinela.page);
  const foto = await sentinela.page.evaluate(FOTOGRAFIA_DO_DESENHO);
  const problemas = [
    ...oQueFaltaNoDesenhoAgora(foto, quando, CONTRATO.camadas),
    ...oQueODesenhoPerdeu(sentinela.foto, foto),
    ...oQueOVigiaDoDesenhoViu(vigia),
    ...extra,
  ];
  if (sentinela.registroForaDaPagina.length < vigia.antes + vigia.quantasDepois) {
    problemas.push(
      `o canal fora da página recebeu ${String(sentinela.registroForaDaPagina.length)} anotação(ões) e a página tem ${String(vigia.antes + vigia.quantasDepois)} — alguém calou o canal`,
    );
  }
  if (sentinela.errosDePagina.length > 0) {
    problemas.push(`a página da sentinela lançou ${String(sentinela.errosDePagina.length)} erro(s): ${sentinela.errosDePagina[0]}`);
  }
  if (sentinela.navegacoes.depoisDoNascimento > 0) {
    /* Continua vermelho: página que se recarrega sozinha é regressão. O que
       esta linha faz é NOMEAR a causa mais provável — alguém mexeu na árvore
       enquanto a guarda rodava, e o `next dev` que ela mesma subiu empurrou o
       recarregamento para a aba. Sem ela, o relatório culpa o produto por um
       gesto de fora. */
    problemas.push(
      `a aba da sentinela NAVEGOU ${String(sentinela.navegacoes.depoisDoNascimento)} vez(es) depois do nascimento — o desenho inteiro foi refeito. Se alguém tocou num arquivo desta árvore enquanto a guarda rodava, foi o \`next dev\` empurrando recarregamento; se ninguém tocou, a página está se recarregando sozinha`,
    );
  }
  return { problemas, foto, vigia };
}

async function medirUmaLargura(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  console.log(`· medindo ${chave}`);
  const { ctx, page, errosDePagina } = await abrirPagina(browser, caso);

  // Todas as camadas LIGADAS: o padrão da casa liga só sucessão + crítico, e o
  // contrato da peça é sobre as cinco.
  await ligarTodasAsCamadas(page);
  await page.waitForTimeout(600);

  // ── 1. A faixa "Hoje" acima da dobra ────────────────────────────────────
  const hoje = await medirHoje(page, caso.altura);
  if (caso.desktop) {
    exigir(
      hoje.visivel >= TEASER_DA_FAIXA_DE_BAIXO_PX,
      `${chave}: a faixa "Hoje" tem ${hoje.visivel}px visíveis, e o contrato é ≥ ${TEASER_DA_FAIXA_DE_BAIXO_PX}px`,
    );
  }

  // ── 2. O pane real (a tabela que `tests/unit/panes-medidos.ts` guarda) ──
  const pane = await page.evaluate(() => {
    const el = document.querySelector(".react-flow");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { largura: Math.round(r.width), altura: Math.round(r.height) };
  });
  exigir(pane !== null && pane.altura > 0, `${chave}: o canvas do grafo não tem altura`);
  const naTabela = TABELA_DE_PANES.panes[chave];
  if (naTabela && pane) {
    const folga = TABELA_DE_PANES.toleranciaPx;
    exigir(
      Math.abs(naTabela.largura - pane.largura) <= folga &&
        Math.abs(naTabela.altura - pane.altura) <= folga,
      `${chave}: o pane real é ${pane.largura}×${pane.altura} e a tabela de tests/unit/panes-medidos.json diz ${naTabela.largura}×${naTabela.altura} — a tabela apodreceu`,
    );
  }

  // ── 7/8/9/10/12. A PINTURA, antes de mexer no zoom ─────────────────────
  const desenho = await medirODesenhoInteiro(page, chave, "", CONTRATO.camadas);
  const pintura = desenho.pintura;
  const triplo = desenho.triplo;
  const glifos = desenho.glifos;
  const alcance = desenho.alcance;
  const contraODado = desenho.contraODado;

  // ── 7b. O destaque amarelo do predecessor (o 6º papel) ─────────────────
  /*
   * `destacada` só existe com um nó selecionado — e era o único papel de
   * `TIPOS_DE_BANDA` que NENHUMA medida deste arquivo tocava em nenhuma
   * rodada. O nó escolhido é derivado: o destino da primeira aresta de
   * sucessão que o canvas desenhou.
   */
  /* A volta da lista acessível para o canvas recria as arestas; esperar o
     seletor (em vez de ler no escuro) evita que uma re-renderização lenta
     vire "nenhuma aresta de sucessão no canvas". Se ela não aparecer mesmo,
     o `exigir` abaixo continua reprovando. */
  await page
    .waitForSelector('.react-flow g[data-camada="sucessao"]', { timeout: 10000 })
    .catch(() => undefined);
  const destinoParaSelecionar = await page.evaluate(() => {
    for (const g of document.querySelectorAll('.react-flow g[data-camada="sucessao"]')) {
      if (g.getAttribute("data-critica") !== "true") return g.getAttribute("data-destino");
    }
    const q = document.querySelector('.react-flow g[data-camada="sucessao"]');
    return q ? q.getAttribute("data-destino") : null;
  });
  let destaque = "sem aresta de sucessão";
  if (destinoParaSelecionar) {
    await page.evaluate((id) => {
      const no = [...document.querySelectorAll(".react-flow__node")].find(
        (n) => n.getAttribute("data-id") === id,
      );
      no?.querySelector('[role="button"]')?.click();
    }, destinoParaSelecionar);
    await page.waitForTimeout(700);
    /*
     * ── ALTO 4: O ESTADO COM SELEÇÃO PASSA PELA MESMA RÉGUA DE TODOS ─────
     *
     * Ele era medido num ponto só — `medirPinturaDasArestas` sozinha, sem
     * §8, §9, §10 nem §12 — e com o piso de "≥ 1 aresta por papel", o mesmo
     * que a rodada 11 registrou como causa do ALTO 2 dela. Apagar uma aresta
     * de sucessão SÓ quando `selectedTaskId !== null` (uma linha) passava:
     * sem seleção 4 ids desenhados / 4 no dado, com seleção 3 / 4.
     */
    const comSelecao = await medirODesenhoInteiro(page, chave, " (nó selecionado)", CONTRATO.camadas, {
      comSelecao: true,
    });
    const comDestaque = comSelecao.pintura;
    destaque = comDestaque.linha;
    exigir(
      (comDestaque.resumo.destacada?.n ?? 0) > 0,
      `${chave}: selecionar "${destinoParaSelecionar}" não deixou NENHUMA aresta destacada (amarelo do predecessor) — o papel "destacada" existe no código e não chega à tela`,
    );
    await page.evaluate(() => {
      const pane2 = document.querySelector(".react-flow__pane");
      pane2?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    await page.waitForTimeout(400);
    await ligarTodasAsCamadas(page);
    await page.waitForTimeout(400);
  } else {
    exigir(false, `${chave}: nenhuma aresta de sucessão no canvas — não há como medir o destaque do predecessor`);
  }

  medicoes[chave] = {
    hoje,
    pane,
    pintura: pintura.linha,
    destaque,
    triplo,
    tripla: desenho.tripla,
    glifos,
    alcance,
    contraODado,
    detalhePorAresta: pintura.detalhePorAresta,
    errosDePagina: [...errosDePagina],
  };
  exigir(errosDePagina.length === 0, `${chave}: a página lançou ${errosDePagina.length} erro(s): ${errosDePagina[0] ?? ""}`);
  await ctx.close();

  /*
   * ── PÁGINA LIMPA PARA AS MEDIDAS DE GESTO (§3 a §6) ─────────────────────
   *
   * As medidas acima mexem em catorze elementos (esconder/mostrar cada aresta
   * e cada glifo), selecionam um cartão, trocam o grafo pela lista acessível e
   * voltam. Medir o gesto do operador DEPOIS disso é medir o próprio rastro:
   * medido a 390 px, o reenquadramento de §6 não disparava numa página assim —
   * e disparava, na mesma árvore, numa página recém-carregada (conferido
   * rodando a guarda da rodada 9, que não mexe em nada antes, contra ESTE
   * mesmo código). O zoom e os resizes passam a rodar numa página limpa.
   */
  const segunda = await abrirPagina(browser, caso);
  const page2 = segunda.page;
  const errosDaSegunda = segunda.errosDePagina;
  await ligarTodasAsCamadas(page2);
  await page2.waitForTimeout(600);

  // ── 3. O gesto do operador: seis cliques em "Aumentar zoom" ─────────────
  const gesto = await gestoDeZoom(page2);
  exigir(gesto.achouBotao, `${chave}: não achei o botão "Aumentar zoom"`);
  /* `semMedida` = o clique não coube no tempo com NADA cobrindo o botão (é
     carga, e já virou impedimento em `gestoDeZoom`). Cobrar a trilha de um
     gesto que não chegou a acontecer seria transformar carga em vermelho de
     produto — exatamente o que o achado MÉDIO 9 proíbe. */
  if (!gesto.semMedida) {
    for (let i = 1; i < gesto.trilha.length; i++) {
      exigir(
        gesto.trilha[i] >= gesto.trilha[i - 1] - 1e-9,
        `${chave}: o zoom CAIU de ${gesto.trilha[i - 1]} para ${gesto.trilha[i]} — o gesto do operador foi desfeito`,
      );
    }
    exigir(
      gesto.fim !== null && Math.abs(gesto.fim - CONTRATO.zoomMaximo) < 1e-3,
      `${chave}: seis cliques deveriam chegar ao teto ${CONTRATO.zoomMaximo}, chegaram a ${gesto.fim}`,
    );
  }

  // ── 15. O DESENHO DEPOIS DO GESTO (zoom, pan, e o cartão que não anda) ──
  const depoisDoGesto = gesto.alcancavel
    ? await medirDepoisDoGesto(page2, chave, CONTRATO.camadas)
    : ["n/d (o botão de zoom ficou inalcançável nesta largura)"];

  /*
   * ── 15b/15c. O EIXO INTEIRO DO ZOOM (achado ALTO 5 da rodada 15) ────────
   *
   * Até aqui a guarda só sabia AMPLIAR: "Diminuir zoom" não aparecia uma vez
   * neste arquivo, e a metade de baixo do eixo — de 0,849 até o piso derivado
   * do produto — nunca era exercida. Uma linha em `v3-edge.tsx`
   * (`if (zoomSeguro < 0.6) return null`) apagava as 10 arestas com dois
   * cliques em afastar, e a guarda ficava verde.
   *
   * Agora: afasta até o PISO e remede o desenho lá; aproxima de volta até o
   * TETO e remede o desenho lá também. As duas pontas, não uma.
   */
  if (gesto.alcancavel && !gesto.semMedida) {
    const paraFora = await gestoDeZoomAteAPonta(page2, "fora", CONTRATO.zoomMinimo);
    exigir(
      paraFora.achouBotao,
      `${chave}: não achei o botão "Diminuir zoom" — a metade de baixo do eixo do zoom não tem por onde ser exercida`,
    );
    if (paraFora.achouBotao && paraFora.alcancavel && !paraFora.semMedida) {
      for (let i = 1; i < paraFora.trilha.length; i += 1) {
        exigir(
          paraFora.trilha[i] <= paraFora.trilha[i - 1] + 1e-9,
          `${chave}: afastando o zoom, a escala SUBIU de ${String(paraFora.trilha[i - 1])} para ${String(paraFora.trilha[i])} — o gesto do operador foi desfeito`,
        );
      }
      exigir(
        paraFora.fim !== null && Math.abs(paraFora.fim - CONTRATO.zoomMinimo) < 1e-3,
        `${chave}: afastar até o fim deveria chegar ao piso ${String(CONTRATO.zoomMinimo)} (derivado de tipografia-do-cartao.ts) e chegou a ${String(paraFora.fim)}`,
      );
      depoisDoGesto.push(
        `zoom no PISO ${String(paraFora.fim)} (${String(paraFora.trilha.length - 1)} cliques em "Diminuir zoom"): ${await remedirODesenhoDepoisDoGesto(
          page2,
          chave,
          ` (no piso do zoom, ${String(paraFora.fim)})`,
          CONTRATO.camadas,
        )}`,
      );
      const deVolta = await gestoDeZoomAteAPonta(page2, "dentro", CONTRATO.zoomMaximo);
      if (!deVolta.semMedida && deVolta.alcancavel) {
        for (let i = 1; i < deVolta.trilha.length; i += 1) {
          exigir(
            deVolta.trilha[i] >= deVolta.trilha[i - 1] - 1e-9,
            `${chave}: voltando do piso, a escala CAIU de ${String(deVolta.trilha[i - 1])} para ${String(deVolta.trilha[i])}`,
          );
        }
        exigir(
          deVolta.fim !== null && Math.abs(deVolta.fim - CONTRATO.zoomMaximo) < 1e-3,
          `${chave}: voltar do piso ao teto deveria chegar a ${String(CONTRATO.zoomMaximo)} e chegou a ${String(deVolta.fim)} — o eixo do zoom não é reversível`,
        );
        depoisDoGesto.push(
          `zoom de volta ao TETO ${String(deVolta.fim)}: ${await remedirODesenhoDepoisDoGesto(
            page2,
            chave,
            ` (de volta ao teto do zoom, ${String(deVolta.fim)})`,
            CONTRATO.camadas,
          )}`,
        );
      }
    }
  }

  // ── 4. O modo CARTÃO existe de verdade (altura do nó no DOM) ────────────
  const alturaDoNo = await page2.evaluate(() => {
    const n = document.querySelector(".react-flow__node");
    return n ? Math.round(n.getBoundingClientRect().height / (window.devicePixelRatio || 1)) : null;
  });
  exigir(alturaDoNo !== null && alturaDoNo > 0, `${chave}: o cartão do grafo não tem altura no DOM`);

  // ── 5. Dois pixels não apagam o gesto (achado ALTO #2 da rodada 8) ──────
  const zAntesDoResize = escalaDe(await transformDoCanvas(page2));
  await page2.setViewportSize({ width: larguraDeRuidoPara(caso), height: caso.altura });
  await page2.waitForTimeout(1000);
  const zDepoisDoResize = escalaDe(await transformDoCanvas(page2));
  exigir(
    Math.abs(zDepoisDoResize - zAntesDoResize) < 1e-6,
    `${chave}: 2px de resize mudaram o zoom de ${zAntesDoResize} para ${zDepoisDoResize}`,
  );

  // ── 6. …mas um resize DE VERDADE ainda reenquadra ───────────────────────
  const larguraDeVerdade = caso.largura >= 1024 ? 640 : 1280;
  await page2.setViewportSize({ width: larguraDeVerdade, height: caso.altura });
  await page2.waitForTimeout(1400);
  const zDepoisDeVerdade = escalaDe(await transformDoCanvas(page2));
  exigir(
    zDepoisDeVerdade === null || Math.abs(zDepoisDeVerdade - zAntesDoResize) > 1e-6,
    `${chave}: um resize de ${caso.largura}→${larguraDeVerdade} NÃO reenquadrou (zoom ficou em ${zDepoisDeVerdade})`,
  );

  /*
   * ── 6b/6c. DEPOIS DO RESIZE, O DESENHO AINDA É OLHADO (ALTO 4) ──────────
   *
   * Achado ALTO 4 da rodada 15: a guarda redimensionava em três lugares — dois
   * eram o ruído de 2 px e o terceiro (§6, logo acima) media **só o zoom** e
   * fechava a página. *Depois de um redimensionamento de verdade, o desenho
   * nunca mais era olhado.* O crítico provou com um ouvinte de `resize` de
   * limiar 50 px (para o ruído de 2 px passar intacto) que esvaziava as
   * arestas: **4 arestas → 0** ao arrastar a janela, voltando só com F5, e a
   * guarda ficava verde.
   *
   * São duas medidas, porque são dois redimensionamentos diferentes:
   *
   * • §6c — o resize de §6, que ATRAVESSA a faixa de layout. A 640 px o painel
   *   do grafo vive numa aba, e é preciso ir até ela; o que não pode existir é
   *   o canvas sem arestas. Só a conferência contra o dado bruto, sem pixel:
   *   depois da troca de faixa o enquadramento é outro, e o que se cobra aqui
   *   é que o grafo continue lá inteiro.
   *
   * • §6b — "arrastar a janela", DENTRO da faixa nova (desktop segue desktop,
   *   celular segue celular): muito mais que o ruído de 2 px e sem trocar de
   *   tela. Aqui o desenho é remedido inteiro — canvas × dado bruto E pintura
   *   de pixel. É o gesto exato da sabotagem.
   *
   * A ordem importa e está escolhida: §6 primeiro, com o MESMO ponto de
   * partida que sempre teve (o zoom do gesto). Medir §6 depois de um outro
   * resize já reenquadrado o deixaria comparar dois reenquadramentos que caem
   * no mesmo piso — medido a 390×800: 570→1280 devolveu 0,849 nas duas pontas,
   * e §6 reprovou um produto que estava certo.
   */
  const bandaNovaEhDesktop = larguraDeVerdade >= 1024;
  await irParaAba(page2, { desktop: bandaNovaEhDesktop }, "Grafo");
  await page2.waitForSelector(".react-flow__viewport", { timeout: 20000 }).catch(() => undefined);
  await esconderSeloDoNext(page2);
  await page2.waitForTimeout(700);
  const leituraNaFaixaNova = await page2.evaluate(LEITURA_DAS_ARESTAS);
  const contratoNaFaixaNova = await lerContratoDoCanvas(page2);
  const desenhoNaFaixaNova = medirCanvasContraOUniverso(
    chave,
    ` (depois de atravessar para ${String(larguraDeVerdade)}px)`,
    contratoNaFaixaNova,
    leituraNaFaixaNova.arestas,
    CONTRATO.camadas,
  );

  const larguraArrastada = larguraDeArrastarAJanela({
    largura: larguraDeVerdade,
    desktop: bandaNovaEhDesktop,
  });
  await page2.setViewportSize({ width: larguraArrastada, height: caso.altura });
  await page2.waitForTimeout(1600);
  await irParaAba(page2, { desktop: larguraArrastada >= 1024 }, "Grafo");
  await page2.waitForSelector(".react-flow__viewport", { timeout: 20000 }).catch(() => undefined);
  await page2.waitForTimeout(500);
  const desenhoDepoisDoArraste = await remedirODesenhoDepoisDoGesto(
    page2,
    chave,
    ` (janela arrastada de ${String(larguraDeVerdade)} para ${String(larguraArrastada)}×${String(caso.altura)})`,
    CONTRATO.camadas,
  );

  exigir(
    errosDaSegunda.length === 0,
    `${chave}: a página do gesto lançou ${errosDaSegunda.length} erro(s): ${errosDaSegunda[0] ?? ""}`,
  );

  medicoes[chave] = {
    ...medicoes[chave],
    depoisDoGesto,
    trilha: gesto.trilha,
    zAntesDoResize,
    zDepoisDoResize,
    zDepoisDeVerdade,
    larguraArrastada,
    desenhoDepoisDoArraste,
    desenhoNaFaixaNova,
    alturaDoNo,
  };
  await segunda.ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// §11 · OS ESTADOS DA TELA, DERIVADOS  (achados ALTO 1 e ALTO 2)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * A guarda media um estado só: a tela recém-carregada. Um clique no aviso
 * "5 fontes desatualizadas" bastava para a faixa "Hoje" ir a 0 px, e para
 * 2 px de resize derrubarem o zoom do teto. Os dois achados são a mesma
 * classe, e fechá-la exige varrer ESTADOS, não escrever mais um caso.
 *
 * O conjunto de estados é DERIVADO da tela: o estado base, mais um estado por
 * controle `[aria-expanded]` que a página tiver. Um acordeão novo entra na
 * varredura sozinho. Piso: se a tela não tiver NENHUM controle desses, a
 * varredura reprova — porque ela passaria a não medir nada e a dizer "ok".
 */
async function medirEstadosDerivados(browser, caso) {
  const chave = `${caso.largura}x${caso.altura}`;
  console.log(`· varrendo estados em ${chave}`);
  const primeira = await abrirPagina(browser, caso);
  const controles = await primeira.page.evaluate(() =>
    [...document.querySelectorAll("[aria-expanded]")].map((el, i) => ({
      indice: i,
      nome: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40),
    })),
  );
  await primeira.ctx.close();
  exigir(
    controles.length > 0,
    `${chave}: §11 nenhum controle [aria-expanded] na tela — a varredura de estados não teria o que medir, e uma varredura vazia diria "ok" sem medir nada`,
  );

  const linhas = [];
  for (const controle of [{ indice: -1, nome: "base" }, ...controles]) {
    const { ctx, page, errosDePagina } = await abrirPagina(browser, caso);
    if (controle.indice >= 0) {
      const clicou = await page.evaluate((i) => {
        const el = [...document.querySelectorAll("[aria-expanded]")][i];
        if (!el) return false;
        el.click();
        return true;
      }, controle.indice);
      if (!clicou) {
        exigir(false, `${chave}: §11 o controle "${controle.nome}" sumiu antes de ser clicado — não consegui medir o estado`);
        await ctx.close();
        continue;
      }
      await page.waitForTimeout(900);
    }

    // §1 no estado: a faixa "Hoje" continua acima da dobra, SEM resize nenhum.
    const hoje = await medirHoje(page, caso.altura);
    if (caso.desktop) {
      exigir(
        hoje.visivel >= TEASER_DA_FAIXA_DE_BAIXO_PX,
        `${chave}: §11 com "${controle.nome}" aberto, a faixa "Hoje" tem ${hoje.visivel}px visíveis e o contrato é ≥ ${TEASER_DA_FAIXA_DE_BAIXO_PX}px`,
      );
    }

    // §5 no estado: o gesto do operador sobrevive a 2px de ruído.
    const gesto = await gestoDeZoom(page);
    let antes = gesto.fim;
    let depois = null;
    if (!gesto.alcancavel) {
      const temFolhaModal = await page.evaluate(
        () => document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
      );
      exigir(
        temFolhaModal,
        `${chave}: §11 com "${controle.nome}" aberto, o botão "Aumentar zoom" ficou inalcançável SEM nenhuma folha modal na tela — alguma coisa está cobrindo o canvas`,
      );
      antes = "coberto por folha modal";
      depois = antes;
    } else {
      await page.setViewportSize({ width: larguraDeRuidoPara(caso), height: caso.altura });
      await page.waitForTimeout(1200);
      depois = escalaDe(await transformDoCanvas(page));
      exigir(
        gesto.semMedida === true ||
          (antes !== null && depois !== null && Math.abs(depois - antes) < 1e-6),
        `${chave}: §11 com "${controle.nome}" aberto, 2px de resize mudaram o zoom de ${antes} para ${depois}`,
      );
    }
    exigir(
      errosDePagina.length === 0,
      `${chave}: §11 com "${controle.nome}" aberto, a página lançou ${errosDePagina.length} erro(s): ${errosDePagina[0] ?? ""}`,
    );
    await ctx.close();

    /*
     * BAIXO 6: o MESMO estado, numa página limpa, com as cinco camadas
     * ligadas — e aí as cinco medidas do desenho (§7 pintura, §8 traço
     * triplo, §9 glifos, §10 lista acessível, §12 canvas × dado). Página
     * separada de propósito: as medidas acima mexem no zoom e no tamanho da
     * janela, e medir a pintura depois disso seria medir o próprio rastro.
     */
    const segunda = await abrirPagina(browser, caso);
    await ligarTodasAsCamadas(segunda.page);
    await segunda.page.waitForTimeout(500);
    if (controle.indice >= 0) {
      const clicou2 = await segunda.page.evaluate((i) => {
        const el = [...document.querySelectorAll("[aria-expanded]")][i];
        if (!el) return false;
        el.click();
        return true;
      }, controle.indice);
      exigir(
        clicou2,
        `${chave}: §11 o controle "${controle.nome}" sumiu antes de medir o desenho neste estado`,
      );
      await segunda.page.waitForTimeout(900);
    }
    const desenhoNoEstado = await medirODesenhoInteiro(
      segunda.page,
      chave,
      ` [${controle.nome}]`,
      CONTRATO.camadas,
    );
    exigir(
      segunda.errosDePagina.length === 0,
      `${chave}: §11 com "${controle.nome}" aberto, a página do desenho lançou ${segunda.errosDePagina.length} erro(s): ${segunda.errosDePagina[0] ?? ""}`,
    );
    await segunda.ctx.close();

    linhas.push(
      `${controle.nome}: Hoje ${String(hoje.visivel)}px, zoom ${String(antes)}→${String(depois)} · ${desenhoNoEstado.pintura.linha} · dado ${desenhoNoEstado.contraODado} · glifos ${
        desenhoNoEstado.glifos.startsWith("n/d")
          ? desenhoNoEstado.glifos
          : `${String((desenhoNoEstado.glifos.split(" · ")[0] ?? "").split(" ").filter(Boolean).length)} medidos, ${String(desenhoNoEstado.glifos.split(" · ")[1] ?? "?")}`
      } · tripla ${desenhoNoEstado.tripla} · lista ${desenhoNoEstado.alcance}`,
    );
  }
  medicoes[chave] = { ...(medicoes[chave] ?? {}), estados: linhas };
  return linhas;
}

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

/** Espera o servidor responder, ou desiste. */
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

/**
 * Sobe `next dev` a partir DESTE pacote, em porta livre, com o modo fixture.
 *
 * POR QUE ELA SOBE O PRÓPRIO SERVIDOR (achado da conferência da rodada 9):
 * a primeira versão se conectava a uma porta fixa e media o que estivesse lá.
 * Numa máquina com várias cópias do repositório abertas, ela media a árvore de
 * outra pessoa e dizia VERDE — inclusive com uma sabotagem aplicada na árvore
 * de verdade. Medir o produto não é só abrir o navegador: é garantir que o que
 * está do outro lado é ESTE código.
 */
async function subirServidorProprio() {
  const req = createRequire(import.meta.url);
  let binarioDoNext;
  try {
    binarioDoNext = join(dirname(req.resolve("next/package.json")), "dist", "bin", "next");
  } catch {
    return null;
  }
  const porta = await portaLivre();
  const base = `http://127.0.0.1:${porta}`;
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
if (BASE === null) {
  const proprio = await subirServidorProprio();
  if (proprio === null) {
    console.error(
      "guarda-no-navegador: não consegui subir o servidor deste pacote. Rode `npm install` na raiz, ou aponte LIFEBOARD_BASE_URL para um servidor que sirva ESTA árvore.",
    );
    process.exit(2);
  }
  BASE = proprio.base;
  encerrarServidor = proprio.encerrar;
  console.log(`servidor próprio no ar em ${BASE} (subido por esta guarda)`);
}

/*
 * ── O DADO BRUTO, ANTES DE ABRIR O NAVEGADOR (achado ALTO 1 + BAIXO 12) ───
 *
 * Sem ele não há com o que comparar o desenho — e "não consegui ler o dado"
 * é saída 2 (não medi), nunca 0 e nunca 1.
 */
let BRUTO;
let UNIVERSO;
try {
  BRUTO = await lerDadoBruto(BASE);
  UNIVERSO = derivarUniversoDeArestas(BRUTO);
} catch (e) {
  console.error(
    "%s",
    `guarda-no-navegador: não consegui ler GET /api/grafo-bruto — sem o dado bruto esta guarda não tem com o que comparar o canvas: ${String(e?.message ?? e)}`,
  );
  encerrarServidor();
  process.exit(2);
}

const pw = carregarPlaywright();
if (pw === null) {
  console.error(
    "guarda-no-navegador: não achei playwright-core. Aponte LIFEBOARD_PLAYWRIGHT para a instalação (este pacote não o declara como dependência).",
  );
  process.exit(2);
}

console.log(
  `contrato derivado do código: ${CONTRATO.papeis.length} papéis de aresta (${CONTRATO.papeis.join(", ")}), ${CONTRATO.camadas.length} camadas`,
);

/*
 * ── §0b · A PROMESSA DA PEÇA, COBRADA COMO PRODUTO (rodada 15) ─────────────
 *
 * ALTO 1 e ALTO 2 do crítico hostil são o mesmo defeito em dois assuntos: a
 * régua saía da coisa medida. A cor do caminho crítico era conferida contra
 * as DUAS tabelas do produto (trocar as duas no mesmo ato trocava a régua
 * junto: 1661 → 832 pixels vermelhos na tela, cinco portões verdes); e os
 * nomes das camadas eram conferidos contra a tabela de nomes (trocar
 * "Sucessão" e "Correlação" passava em tudo, e a lista para leitor de tela
 * passava a anunciar a dependência ao contrário).
 *
 * `src/lib/promessa-do-grafo.ts` é a âncora: diz, em palavras e uma vez só,
 * que o caminho crítico é VERMELHO e quais relações têm DIREÇÃO. Aqui isso é
 * cobrado como promessa de produto — código 1, não 2.
 */
exigir(
  CONTRATO.promessaQuebrada.length === 0,
  `§0b a promessa da peça (src/lib/promessa-do-grafo.ts) não se sustenta: ${CONTRATO.promessaQuebrada.join(" ; ")}`,
);
console.log(
  "%s",
  `[${carimbo()}] §0b promessa da peça: ${CONTRATO.papeis
    .map((p) => `${p} ${String(CONTRATO.familias[CONTRATO.familiaDoPapel[p]]?.emPortugues ?? "?")}`)
    .join(" · ")} | ${Object.entries(CONTRATO.direcaoPorRotulo)
    .map(([r, d]) => `${r} ${d}`)
    .join(" · ")}`,
);

/*
 * ── §0c · TODO ESTADO QUE O OPERADOR CONTROLA TEM EIXO — OU MOTIVO (rodada 16)
 *
 * O inventário sai do código (`derivarContrato`); a classificação está em
 * `ESTADO_DO_GRAFO`, junto de §22. Item do código sem classificação, item
 * classificado que o código não tem mais, eixo fora sem motivo, motivo cujo
 * lastro no código caiu: tudo reprova aqui, antes de abrir o navegador —
 * código 1, porque é o produto oferecendo um eixo que nenhuma medida cruza.
 */
{
  const problemasDoInventario = [...conferirClassificacaoDoEstado(), ...conferirContinuidadeDosEixos()];
  exigir(
    problemasDoInventario.length === 0,
    `§0c o estado do grafo que o operador controla: ${problemasDoInventario.join(" ; ")}`,
  );
  const eixos = {};
  for (const [item, c] of Object.entries(ESTADO_DO_GRAFO)) {
    const k = c.eixo ?? "fora";
    (eixos[k] ??= []).push(item);
  }
  console.log(
    "%s",
    `[${carimbo()}] §0c inventário do estado: ${String(CONTRATO.inventarioDoEstado.length)} itens do código → ${EIXOS_EXERCIDOS.map(
      (e) => `${e} ${String(eixos[e]?.length ?? 0)}`,
    ).join(" · ")} · fora ${String(eixos.fora?.length ?? 0)} (com motivo)`,
  );
}

medicoes.universo = medirEspessuraDoUniverso(UNIVERSO, BRUTO);
console.log("%s", `[${carimbo()}] §0 universo do dado: ${medicoes.universo}`);

/*
 * O congelamento de aba de segundo plano fica DESLIGADO (achado MÉDIO 9):
 * o Chromium congela aba não visível depois de ~5 min e, sobre aba congelada,
 * um `page.evaluate` não volta nunca — e nenhum tempo limite do Playwright o
 * interrompe. Sai na linha de comando do navegador, não num comentário.
 */
/*
 * O navegador que não ABRE é carga, não produto (achado da rodada 16: sob
 * load 230 da máquina, `chromium.launch` estourou 180 s e a guarda saía com
 * rastro de pilha e código 1 — o balde de "o produto está errado"). Nada foi
 * medido: código 2, com o motivo.
 */
pwParaLancar = pw;
try {
  browser = await lancarNavegador();
} catch (e) {
  console.error(
    "%s",
    `guarda-no-navegador: o navegador não abriu (${String(e?.message ?? e).split("\n")[0]}) — nada foi medido; máquina carregada, não produto reprovado`,
  );
  encerrarServidor();
  process.exit(2);
}
try {

  for (const caso of LARGURAS) {
    const chave = `${caso.largura}x${caso.altura}`;
    /* As sentinelas desta largura nascem ANTES da primeira medida dela. */
    try {
      await garantirNavegador();
    } catch (e) {
      naoConsegui(`${chave}: o navegador principal morreu e não relançou — ${String(e?.message ?? e).split("\n")[0]}`);
      continue;
    }
    const sentinelasDaLargura = await nascerAsSentinelasDe(browser, caso);
    /* Cada etapa recebe o navegador como argumento: é isso que deixa a prova
       de travamento refazê-la num navegador NOVO. */
    await etapa(`${chave} · §1–§10/§12/§15 e o nó selecionado`, (b) => medirUmaLargura(b, caso));
    await etapa(`${chave} · §11 estados derivados`, (b) => medirEstadosDerivados(b, caso));
    const desligar = await etapa(`${chave} · §13/§18 desligar camada e o F5`, (b) => medirDesligarCamada(b, caso));
    const defaultDaTela = await etapa(`${chave} · §14 o estado em que a tela nasce`, (b) => medirEstadoDefault(b, caso));
    const listaPorCamada = await etapa(`${chave} · §16 a lista acessível × o painel`, (b) => medirListaObedeceAsCamadas(b, caso));
    const esmaecimento = await etapa(`${chave} · §17 esmaecimento por fonte`, (b) => medirEsmaecimentoPorFonte(b, caso));
    const produtoDosGestos = await etapa(`${chave} · §22 o produto dos gestos (eixos derivados, cobertura em pares)`, (b) =>
      medirProdutoDosGestos(b, caso),
    );
    const passeioDoZoom = await etapa(`${chave} · §22z o passeio do zoom (todo valor que os gestos alcançam)`, (b) =>
      medirPasseioDoZoom(b, caso),
    );
    const passeioDoPan = await etapa(`${chave} · §22p o passeio do pan`, (b) => medirPasseioDoPan(b, caso));
    medicoes[chave] = {
      ...(medicoes[chave] ?? {}),
      desligar,
      defaultDaTela,
      listaPorCamada,
      esmaecimento,
      produtoDosGestos,
      passeioDoZoom,
      passeioDoPan,
    };

    // ═════════════════════════════════════════════════════════════════════════
    // §19 · A SENTINELA DE TEMPO REAL: O DESENHO CONTINUA DE PÉ DEPOIS
    //       (achado ALTO da rodada 14 — a guarda media um instante só)
    //
    // Esta página foi aberta ANTES da primeira medida desta largura e, desde
    // então, só EXISTIU. A pergunta, na forma mais crua: **em algum momento da
    // vida dela, alguma coisa mudou o desenho do grafo?** O tempo de vida é o
    // alcance, e sai impresso.
    // ═════════════════════════════════════════════════════════════════════════
    for (const sentinela of sentinelasDaLargura.filter((s) => !s.comRelogioDeMentira)) {
      const perdida = (veredito) => {
        if (veredito !== "produto") SENTINELA_PERDIDA_PARA_O_AMBIENTE.set(sentinela.chave, veredito);
      };
      await etapa(`§19 sentinela de tempo real ${sentinela.nome}`, async () => {
        if (!sentinela.ok) {
          if (sentinela.travou) {
            await julgarOTravamento({
              nome: `§19 ${sentinela.nome}: a sentinela não nasceu`,
              msg: sentinela.motivo,
              t0: sentinela.t0,
              repetir: (b) => provaDaSentinela(b, caso, false),
              provaMede: false,
              aoJulgar: perdida,
            });
            return;
          }
          exigir(false, `§19 ${sentinela.nome}: a sentinela nunca nasceu — ${sentinela.motivo}`);
          return;
        }
        /*
         * O piso de vida é ESCRITO À MÃO, e a sentinela espera por ele quando a
         * corrida é curta demais (uma largura só, máquina rápida). Reprovar
         * porque a corrida foi rápida seria vermelho de ambiente; encurtar o
         * alcance em silêncio seria pior ainda — a guarda declararia um alcance
         * que ela não teve.
         */
        let vida = Date.now() - sentinela.nascimento;
        if (vida < PISO_DE_VIDA_DA_SENTINELA_MS) {
          const falta = PISO_DE_VIDA_DA_SENTINELA_MS - vida;
          console.log(
            "%s",
            `[${carimbo()}]   a sentinela viveu ${String(Math.round(vida / 1000))}s e o piso declarado é ${String(Math.round(PISO_DE_VIDA_DA_SENTINELA_MS / 1000))}s — esperando os ${String(Math.round(falta / 1000))}s que faltam`,
          );
          await sentinela.page.waitForTimeout(falta);
          vida = Date.now() - sentinela.nascimento;
        }
        const { problemas } = await conferirSentinela(sentinela, `aos ${String(Math.round(vida / 1000))}s de vida`, []);
        exigir(
          problemas.length === 0,
          `§19 ${sentinela.nome}: ${problemas.join(" · ")}`,
        );
        /* A rede 1: a MEDIÇÃO DO PRODUTO REFEITA, tarde. Vem depois das outras
           duas porque ela escreve no desenho para medir o pixel. */
        const desenho = await medirODesenhoInteiro(
          sentinela.page,
          sentinela.chave,
          ` (sentinela de tempo real, ${String(Math.round(vida / 1000))}s depois)`,
          CONTRATO.camadas,
        );
        const linha = `viveu ${String(Math.round(vida / 1000))}s — este é o ALCANCE DE TEMPO REAL desta guarda nesta largura, e regressão agendada para depois dele NÃO é vista (piso ${String(Math.round(PISO_DE_VIDA_DA_SENTINELA_MS / 1000))}s) · desenho refeito: ${desenho.contraODado} · ${desenho.pintura.linha ?? ""} · fotografia idêntica à do nascimento nos ${String(CAMPOS_DA_FOTOGRAFIA.length)} campos do desenho`;
        medicoes[sentinela.chave] = {
          ...(medicoes[sentinela.chave] ?? {}),
          sentinelaTempoReal: problemas.length === 0 ? linha : problemas.join(" · "),
        };
        await sentinela.ctx.close();
      }, { repetir: (b) => provaDaSentinela(b, caso, false), provaMede: false, aoJulgar: perdida });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // §20 · A SENTINELA DO RELÓGIO: MEIA HORA DE UMA VEZ, DUAS VEZES
    //
    // Esperar 60 s para pegar uma mutação de 45 s seria pagar caro por uma
    // duplicação — o sabotador escreveria 120 s. Esta página nasceu com o
    // relógio sob controle da guarda; aqui ele anda meia hora de uma vez, a tela
    // é EXERCIDA (um handler que só nasce com o tempo precisa de quem o acorde)
    // e o relógio anda outra meia hora. Só então o desenho é refeito.
    // ═════════════════════════════════════════════════════════════════════════
    for (const sentinela of sentinelasDaLargura.filter((s) => s.comRelogioDeMentira)) {
      const perdida = (veredito) => {
        if (veredito !== "produto") SENTINELA_PERDIDA_PARA_O_AMBIENTE.set(sentinela.chave, veredito);
      };
      await etapa(`§20 sentinela do relógio ${sentinela.nome}`, async () => {
        if (!sentinela.ok) {
          if (sentinela.travou) {
            await julgarOTravamento({
              nome: `§20 ${sentinela.nome}: a sentinela não nasceu`,
              msg: sentinela.motivo,
              t0: sentinela.t0,
              repetir: (b) => provaDaSentinela(b, caso, true),
              provaMede: false,
              aoJulgar: perdida,
            });
            return;
          }
          exigir(false, `§20 ${sentinela.nome}: a sentinela nunca nasceu — ${sentinela.motivo}`);
          return;
        }
        await sentinela.page.clock.fastForward(ADIANTAMENTO_DO_RELOGIO_MS);
        await assentarSentinela(sentinela.page, 200);
        const exercidas = await exercitarATela(sentinela.page);
        await assentarSentinela(sentinela.page, 200);
        await sentinela.page.clock.fastForward(ADIANTAMENTO_DO_RELOGIO_MS);
        await assentarSentinela(sentinela.page, 400);
        const extra = [];
        if (exercidas < 1) {
          extra.push(
            "nenhuma peça da tela foi exercida depois do adiantamento — um handler que nasce com o tempo não teria quem o acordasse",
          );
        }
        const { problemas } = await conferirSentinela(
          sentinela,
          `depois de ${String(Math.round((2 * ADIANTAMENTO_DO_RELOGIO_MS) / 60000))} min de relógio adiantado`,
          extra,
        );
        exigir(problemas.length === 0, `§20 ${sentinela.nome}: ${problemas.join(" · ")}`);
        const desenho = await medirODesenhoInteiro(
          sentinela.page,
          sentinela.chave,
          ` (sentinela do relógio, +${String(Math.round((2 * ADIANTAMENTO_DO_RELOGIO_MS) / 60000))} min)`,
          CONTRATO.camadas,
        );
        const linha = `relógio adiantado ${String(Math.round(ADIANTAMENTO_DO_RELOGIO_MS / 60000))} min de uma vez, DUAS vezes, com ${String(exercidas)} peça(s) da tela exercidas (foco + ${String(EVENTOS_EXERCIDOS.length)} eventos) entre elas — regressão agendada ATÉ ISSO está no alcance · desenho refeito: ${desenho.contraODado} · ${desenho.pintura.linha ?? ""}`;
        medicoes[sentinela.chave] = {
          ...(medicoes[sentinela.chave] ?? {}),
          sentinelaRelogio: problemas.length === 0 ? linha : problemas.join(" · "),
        };
        await sentinela.ctx.close();
      }, { repetir: (b) => provaDaSentinela(b, caso, true), provaMede: false, aoJulgar: perdida });
    }

  }

  medicoes.trilhaDaLargura = await etapa("§22L a trilha da largura (arrastar a borda da janela)", (b) => medirTrilhaDaLargura(b));

  /* Todo eixo CONTÍNUO de §22 teve o seu passeio? (O que morreu no caminho
     já é "não consegui medir"; aqui pega o passeio que ninguém chamou.) */
  for (const [eixo, c] of Object.entries(CONTINUIDADE_DOS_EIXOS)) {
    if (c.continuo === undefined) continue;
    const feitas = PASSEIOS_FEITOS.get(c.continuo) ?? new Set();
    const precisa = eixo === "largura" ? ["todas"] : LARGURAS.map((x) => `${x.largura}x${x.altura}`);
    const faltam = precisa.filter((k) => !feitas.has(k) && !impedimentos.some((i) => i.includes(k) && i.includes(c.continuo.split(" ")[0])));
    exigir(faltam.length === 0, `§0c o eixo contínuo "${eixo}" declara o passeio "${c.continuo}" e ele não rodou em ${faltam.join(", ")}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // §21 · O ALCANCE DECLARADO É O ALCANCE MEDIDO
  //
  // A medida que impede as duas de cima de valerem para menos do que dizem.
  // Três perguntas, todas sobre o medido:
  //  1. toda largura em que a guarda mediu o desenho tem as DUAS sentinelas?
  //     (largura sem sentinela = alcance de tempo zero ali);
  //  2. cada sentinela viu, no nascimento, pelo menos tantas arestas quanto a
  //     maior leitura que a guarda fez naquela largura? (sentinela que enxerga
  //     menos que a guarda concorda com a tela por encolher junto);
  //  3. o número que o cabeçalho declara é o que §20 realmente adianta?
  // ═════════════════════════════════════════════════════════════════════════
  await etapa("§21 o alcance de tempo declarado × o medido", async () => {
    const problemas = [];
    const detalhes = [];
    for (const caso of LARGURAS) {
      const chave = `${caso.largura}x${caso.altura}`;
      const minhas = SENTINELAS_DO_DESENHO.filter((s) => s.chave === chave);
      const deTempoReal = minhas.filter((s) => !s.comRelogioDeMentira && s.ok).length;
      const deRelogio = minhas.filter((s) => s.comRelogioDeMentira && s.ok).length;
      if ((deTempoReal < 1 || deRelogio < 1) && SENTINELA_PERDIDA_PARA_O_AMBIENTE.has(chave)) {
        naoConsegui(
          `§21 ${chave}: o alcance de tempo desta largura NÃO foi medido — a sentinela travou e a prova disse "${String(SENTINELA_PERDIDA_PARA_O_AMBIENTE.get(chave))}", não "produto"`,
        );
      } else if (deTempoReal < 1 || deRelogio < 1) {
        problemas.push(
          `${chave}: ${String(deTempoReal)} sentinela(s) de tempo real e ${String(deRelogio)} de relógio (precisa de 1 de cada) — alcance de tempo ZERO nesta largura`,
        );
      }
      const vistoPelaGuarda = DESENHO_VISTO_PELA_GUARDA.get(chave) ?? 0;
      for (const s of minhas.filter((x) => x.ok)) {
        const naSentinela = s.foto.arestas.filter((a) => !a.semPath).length;
        if (naSentinela < vistoPelaGuarda) {
          problemas.push(
            `${s.nome}: a sentinela nasceu vendo ${String(naSentinela)} aresta(s) e a guarda chegou a ver ${String(vistoPelaGuarda)} na mesma largura — o alcance de tempo não cobre o que a guarda mede`,
          );
        }
      }
      detalhes.push(
        `${chave}: ${String(vistoPelaGuarda)} arestas vistas pela guarda, ${String(deTempoReal)}+${String(deRelogio)} sentinelas`,
      );
    }
    const medidasSemSentinela = [...DESENHO_VISTO_PELA_GUARDA.keys()].filter(
      (chave) => !LARGURAS.some((c) => `${c.largura}x${c.altura}` === chave),
    );
    if (medidasSemSentinela.length > 0) {
      problemas.push(
        `a guarda mediu o desenho em ${medidasSemSentinela.join(", ")} e não há sentinela nessas larguras`,
      );
    }
    if (ADIANTAMENTO_DO_RELOGIO_MS !== 1800000) {
      problemas.push(
        `o cabeçalho declara 30 min de alcance agendado e §20 adianta ${String(Math.round(ADIANTAMENTO_DO_RELOGIO_MS / 60000))} min`,
      );
    }
    exigir(problemas.length === 0, `§21: ${problemas.join(" · ")}`);
    medicoes.alcanceDeTempo =
      problemas.length === 0
        ? `${String(LARGURAS.length)} largura(s), ${String(SENTINELAS_DO_DESENHO.length)} sentinelas — ${detalhes.join(" | ")} · alcance declarado: toda a vida real das medidas de cada largura, que §19 mede e imprime uma a uma + ${String(Math.round(ADIANTAMENTO_DO_RELOGIO_MS / 60000))} min agendados, duas vezes (§20)`
        : problemas.join(" · ");
  });

} finally {
  await browser?.close().catch(() => undefined);
  encerrarServidor();
}

const json = JSON.stringify(medicoes, null, 2);
if (process.env.LIFEBOARD_GUARDA_JSON) writeFileSync(process.env.LIFEBOARD_GUARDA_JSON, json);

console.log("── guarda no navegador ────────────────────────────────");
console.log(`§0 universo do dado bruto: ${String(medicoes.universo ?? "?")}`);
for (const [chave, m] of Object.entries(medicoes)) {
  if (chave === "universo" || chave === "alcanceDeTempo" || chave === "trilhaDaLargura") continue;
  console.log(
    [
      chave.padEnd(10),
      `pane ${String(m.pane?.largura ?? "?").padStart(4)}×${String(m.pane?.altura ?? "?").padStart(3)}`,
      `Hoje ${String(m.hoje?.visivel ?? "?").padStart(3)}px`,
      `zoom ${String(m.trilha?.[0]).slice(0, 6)}→${String(m.trilha?.[6]).slice(0, 6)}`,
      `resize2px ${String(m.zDepoisDoResize).slice(0, 6)}`,
      `nó ${String(m.alturaDoNo)}px`,
    ].join("  "),
  );
  console.log(`             pintura  ${m.pintura ?? "?"}`);
  console.log(`             destaque ${m.destaque ?? "?"}`);
  console.log(`             triplo   ${m.triplo ?? "?"}`);
  console.log(`             tripla   ${m.tripla ?? "?"}`);
  console.log(`             glifos   ${m.glifos ?? "?"}`);
  console.log(`             sem mouse ${m.alcance ?? "?"}`);
  console.log(`             × o dado ${m.contraODado ?? "?"}`);
  console.log(`             default  ${m.defaultDaTela ?? "?"}`);
  console.log(`             esmaece  ${m.esmaecimento ?? "?"}`);
  for (const linha of m.depoisDoGesto ?? []) console.log(`             gesto    ${linha}`);
  if (m.desenhoDepoisDoArraste) {
    console.log(`             §6b resize ${String(m.larguraArrastada)}px: ${m.desenhoDepoisDoArraste}`);
  }
  if (m.desenhoNaFaixaNova) console.log(`             §6c faixa  ${m.desenhoNaFaixaNova}`);
  for (const linha of m.desligar ?? []) console.log(`             desliga  ${linha}`);
  for (const linha of m.listaPorCamada ?? []) console.log(`             lista×   ${linha}`);
  for (const linha of m.estados ?? []) console.log(`             estado   ${linha}`);
  for (const linha of m.produtoDosGestos ?? []) console.log(`             §22 combo ${linha}`);
  for (const linha of m.passeioDoZoom ?? []) console.log(`             §22z zoom ${linha}`);
  for (const linha of m.passeioDoPan ?? []) console.log(`             §22p pan  ${linha}`);
  if (m.sentinelaTempoReal) console.log(`             §19 real ${m.sentinelaTempoReal}`);
  if (m.sentinelaRelogio) console.log(`             §20 relóg ${m.sentinelaRelogio}`);
}
for (const linha of medicoes.trilhaDaLargura ?? []) console.log(`§22L largura: ${linha}`);
console.log(`§21 alcance de tempo: ${String(medicoes.alcanceDeTempo ?? "?")}`);
for (const t of TRAVAMENTOS) console.log(`travamento julgado: ${t}`);
console.log(`\ncorrida de ${carimbo()} (mm:ss)`);
/*
 * ── O VEREDITO EM DOIS CÓDIGOS (achado MÉDIO 9) ───────────────────────────
 *
 * Produto errado → 1. Não consegui medir → 2, com o nome da etapa. A ordem
 * importa: quando os dois aparecem, o que vale é a FALHA DE PRODUTO — um
 * impedimento não apaga um vermelho já medido.
 */
if (falhas.length > 0) {
  console.error(`\n${falhas.length} promessa(s) da peça P4 NÃO se sustentam no navegador:`);
  for (const f of falhas) console.error(`  ✗ ${f}`);
  if (impedimentos.length > 0) {
    console.error(`\ne ${impedimentos.length} etapa(s) não chegaram a medir:`);
    for (const i of impedimentos) console.error(`  ? ${i}`);
  }
  process.exit(1);
}
if (impedimentos.length > 0) {
  console.error(
    `\n${impedimentos.length} etapa(s) NÃO conseguiram medir — isto não é verde, e também não é o produto reprovado:`,
  );
  for (const i of impedimentos) console.error(`  ? ${i}`);
  console.error(
    "Repetir a corrida numa máquina menos carregada é o certo AQUI, e só aqui: um vermelho de produto nunca sai por esta porta.",
  );
  process.exit(2);
}
console.log("\ntodas as promessas medidas no navegador se sustentam.");
