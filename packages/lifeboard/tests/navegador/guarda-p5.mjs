/**
 * OS-LIFEBOARD · P5 — rodada 10. A GUARDA NO NAVEGADOR.
 *
 * ## Por que ela existe (achado ALTO 2 do crítico hostil)
 *
 * A guarda "de comportamento" da rodada 10 (`tests/unit/linha-do-tempo-guarda-
 * de-comportamento.test.ts`) dizia medir a tela e não importava nenhum módulo
 * de `src/components/`: ela roda funções puras contra um modelo de navegador
 * escrito no próprio arquivo. Duas sabotagens de uma linha passaram por ela
 * com 1354/1354 verdes:
 *
 *   S1  `aplicarPlanoDaFolha(podeRolar ? plano : semRolagem(plano), …)`
 *       → `aplicarPlanoDaFolha(semRolagem(plano), …)`
 *       a 390×844 a folha voltava a tapar 100% do rótulo e da barra tocada.
 *   S2  `border-l-2 border-gold-500` → `border-l-2 border-transparent`
 *       a faixa do "Hoje" passava a 0px visíveis.
 *
 * S2 cai também no Vitest (`tests/unit/linha-do-tempo-componente.test.tsx`,
 * que resolve a cor no tema e MEDE o contraste). S1 não tem como cair lá: ela
 * só se manifesta como dois retângulos se sobrepondo depois de layout,
 * rolagem e `requestAnimationFrame`. Nada disso existe sem navegador — e
 * escrever um terceiro simulador para fingir que existe seria repetir o
 * próprio ALTO 2. Então S1 se mede aqui, no Chromium, contra a rota real.
 *
 * ## Como rodar
 *
 *   # 1. a rota real, com o quadro de fixture
 *   LIFEBOARD_DATA_MODE=fixture npx next dev -p 3751
 *   # 2. a guarda (precisa de um Chromium e do playwright-core)
 *   PLAYWRIGHT_MODULO=<caminho do playwright-core> \
 *   PLAYWRIGHT_CHROMIUM=<caminho do chrome> \
 *   node tests/navegador/guarda-p5.mjs
 *
 * Três códigos de saída (rodada 20, a régua da peça P4): **0** — todas as
 * medidas dentro da régua; **1** — o produto está errado, nomeando cada
 * medida; **2** — a guarda NÃO conseguiu medir (um teto de tempo estourou e
 * toda página aberta respondeu à sonda de vida: é a máquina, não o produto).
 * Um produto que trava a página sai com 1, nunca com 2. Não
 * entra em `npx vitest run` de propósito: um portão que exige servidor de pé
 * e navegador instalado travaria a suíte de quem só quer rodar os testes
 * puros. É portão de rodada de correção, e o relatório de cada rodada cola a
 * saída dele.
 *
 * ## O que ela mede, e nada além
 *
 * | # | medida | régua |
 * |---|---|---|
 * | A | a faixa do "Hoje" PINTADA: alfa composto + o pixel na tela | alfa real > 0, ≥ 2px, e pixel que muda ao esconder |
 * | B | área da folha inferior sobre a linha tocada, a 390×844 | 0 px² nas 3 últimas linhas |
 * | C | a gaveta e o desenho da MESMA linha dizem o mesmo período | 0 divergências nas 27 linhas, 0 contradições |
 * | D | contraste computado do rótulo riscado | ≥ 4,5:1 |
 * | E | ordem vertical dos assuntos, pela DATA do texto (nunca o pixel) | 0 inversões de data |
 * | F | fechar a gaveta não mexe a página | Δ`scrollY` = 0 |
 * | G | o chip do período inteiro ou ausente, com o ano na tela | 0 cacos, 0 sem ano |
 * | H | **cada afirmação de data no pixel que a data manda** | ±1,5 px contra a régua desenhada |
 * | I | **o PAR real de cada texto visível**, todas as gavetas, 3 zooms, 2 larguras | ≥ 4,5:1 (3:1 texto grande) |
 * | J | **barra só existe com duas datas declaradas no próprio texto** | 0 barras sem data, 0 linhas sem dado na grade |
 * | K | **abrir a gaveta não re-escala o eixo** | Δ`px/dia` = 0 e Δ`left` da barra tocada = 0 |
 * | M | **o eixo imprime a data que a régua manda** (rótulos do cabeçalho) | 0 divergências em 7 cenas por estado |
 * | N | **toda camada que a guarda afirma ver está PINTADA** | alfa real > 0 E pixel que muda ao esconder |
 * | O | **nenhum mecanismo desenhado soma ZERO nos 4 estados** | ≥ 1 de cada mecanismo obrigatório |
 * | P | **todo item fora da janela diz a sua data por escrito na coluna** | 1 rótulo datado por chevron |
 * | Q | **cada desenho na FAIXA VERTICAL do rótulo que o nomeia** (o eixo Y) | ±1,5 px de centro a centro, 9 contextos |
 * | R | **o teclado alcança todo controle que a tela declara**, NO INSTANTE DA CARGA | 0 `<button>`/`<a href>` visível fora do Tab |
 * | S | **a precedência desenhada é a da FONTE**, par a par | 0 par faltando, 0 conector a mais |
 * | T | **zoom diferente produz geometria diferente** | 4 escalas distintas duas a duas |
 * | U | **toda dispensa de contraste aponta para medida verde** | 0 dispensa órfã |
 * | V | **o teclado continua alcançando DEPOIS de o tempo passar** (sentinela viva a corrida inteira) | 0 controle fora do Tab, 0 mudança de contrato de foco, 0 escrita anotada pelo vigia |
 * | W | **idem, com o relógio adiantado meia hora duas vezes**, com os controles exercidos entre elas | igual a V |
 * | X | **o alcance de tempo declarado cobre tudo o que a guarda mede no teclado** | 1 sentinela de cada tipo por viewport medido |
 * | Y | **o teclado continua alcançando DEPOIS de a página ser USADA** — passos escritos à mão + TODOS os estímulos que o navegador faz a uma página aberta, incondicionais, cada estado segurado pela ausência DERIVADA do fonte (dias, no relógio da página) | 0 controle fora do Tab a cada passo e a cada estímulo, e o inventário lido do produto fechado nos dois sentidos |
 * | Z | **o teclado continua alcançando depois de VOLTAR em cada duração** — todo estímulo com volta, ida → fora por d → volta → Tab varrido, para cada d de uma grade DERIVADA (razão 2 a partir do menor limiar lido + 1 ms acima de cada limiar; inteira na aba e no foco, alternada nos outros) | 0 controle fora do Tab depois de cada volta, em cada estímulo e viewport |
 *
 * ## Rodada 21 — o que mudou
 *
 * **ALTO — "saí para almoçar e voltei".** A rodada 20 segurava cada estado
 * pelas 52 h derivadas, em 22 degraus — mas VOLTAVA uma vez só, no fim. O
 * operador volta depois de 5 min, de 1 h, de uma noite; um produto com um
 * ramo "volta curta" e outro "volta longa" tinha o curto nunca exercido. O
 * coordenador passou pelos cinco portões com uma aba que, voltando entre
 * 3 min e 24 h, tirava 27 controles do Tab (nenhum na volta de 52 h). Era a
 * forma 4 outra vez, no eixo "quanto tempo fiquei fora antes de voltar". A
 * medida Z volta em CADA duração de `GRADE_DAS_VOLTAS`, que não tem duração
 * nenhuma escrita: pontos geométricos de razão `RAZAO_DA_GRADE` (2, escrita
 * à mão e declarada) a partir do menor limiar lido, mais os degraus 1 ms
 * acima de cada limiar. Toda janela de volta (a, b) com b/a > 2 contém uma
 * volta na aba e no foco; nos outros estímulos, degraus alternados (b/a > 4),
 * com a paridade trocando de um para o seguinte. O relógio da página fica
 * PARADO durante a grade — a duração que o produto vê é a pedida, exata. A X
 * confere as voltas MEDIDAS (vão entre voltas consecutivas, primeira e
 * última, piso escrito à mão de voltas na grade inteira, e toda volta com o
 * relógio andando o pedido). Custo: a corrida inteira foi de ~3 min 10 s
 * para ~5 min num núcleo livre (a Z soma ~1 min por viewport).
 *
 * ## Rodada 20 — o que mudou
 *
 * **ALTO — "ficou fora da aba mais que 1,5 s".** A rodada 19 segurava cada
 * estímulo por 1500 ms de relógio de PAREDE e declarava fora quem consultasse
 * com período maior. O mesmo valia para quem mede QUANTO TEMPO a aba ficou
 * fora; o coordenador passou pelos cinco portões com `Date.now() - saiu >
 * 3000` — 0 controle fora do Tab com 1,5 s fora da aba, 27 com 60 s. Não se
 * trocou 1500 por um número maior. A sentinela de uso passou a nascer com o
 * relógio DA PÁGINA sob controle, e a ausência saiu de um número escrito para
 * uma DERIVAÇÃO: `LIMIARES_DE_TEMPO` lê do fonte do produto (e desta guarda)
 * todo limiar de tempo escrito — hoje o maior é `STALE_THRESHOLD_MS`, 26 h —,
 * e a ausência é o dobro do maior, em degraus que passam logo acima de cada
 * um. Todo estímulo virou IDA e VOLTA com a ausência no meio e outra depois,
 * e todo passo do roteiro segura o estado que deixou. Dois dias no relógio da
 * página custam milissegundos: a medida Y caiu de 56–82 s para ~15 s por
 * viewport. Os pisos — quantos limiares, quantos da rota, a ausência maior que
 * uma noite inteira, e a ausência MEDIDA em cada estímulo e passo — moram na X.
 *
 * **MÉDIO — estourar o teto de tempo saía como "o produto falhou".** Agora
 * sai com código 2 ("não consegui medir") só quando toda página aberta
 * responde à `sondarVida` num tempo da ordem de uma página em branco na mesma
 * máquina; página que não responde é o produto travado, código 1.
 *
 * ## Rodada 19 — o que mudou
 *
 * **MÉDIO — o estímulo dependia de a guarda VER o ouvinte (a forma 2).** A
 * rodada 18 derivava cada passo de fora dos nós do inventário: a vigia
 * embrulhava `addEventListener`, via o registro, o passo nascia. O navegador
 * aceita outra porta para o mesmo registro — a PROPRIEDADE — e a armadilha de
 * sempre, escrita como
 *
 *     document.onvisibilitychange = () => {
 *       if (document.visibilityState === "visible") setVoltouDeOutraAba(true);
 *     };
 *
 *     aba em primeiro plano          : {"visiveis":36,"foraDoTab":0}
 *     depois de sair da aba e voltar : {"visiveis":36,"foraDoTab":27}
 *
 * passou pelos cinco portões: sem entrada no inventário, sem passo derivado,
 * **ninguém trocava de aba**, e o dano nunca era provocado. Caçar o canal
 * seguinte não cura: depois da propriedade vem o relógio que CONSULTA
 * `document.visibilityState` sem ouvinte nenhum, o registro por
 * `EventTarget.prototype`, o ouvinte registrado de dentro de `node_modules`.
 *
 * A cura inverte a dependência. `ESTIMULOS_DO_NAVEGADOR` é o que o NAVEGADOR
 * faz a uma página aberta — 20 estímulos em 8 fontes (a moldura da janela, a
 * aba, o endereço, a rolagem, o teclado e o ponteiro fora dos controles, o
 * sistema, as outras janelas da mesma origem) — e **todos rodam sempre**, em
 * cada viewport, com o Tab remedido depois de cada um. Cada estímulo prova
 * que aconteceu pelo lado do navegador (o estado que ele expõe mudou, e uma
 * TESTEMUNHA da própria guarda viu o evento), e segura o estado alterado por
 * `PERMANENCIA_DO_ESTIMULO_MS` — para quem consulta por relógio também ver
 * (a rodada 20 aposentou esse número: ver "Rodada 20" acima).
 * O inventário deixou de ser o gatilho e ficou sendo o FECHO; e a vigia passou
 * a ver também as propriedades `on*` de `window` e `document`, só para o
 * fecho. Os pisos (`PISO_DE_ESTIMULOS`, `PISO_DE_FONTES`) e a conferência de
 * que cada viewport executou todos os estímulos moram na medida X, fora da Y.
 *
 * Provado com 19 sabotagens: as 16 da rodada 18 seguem vermelhas, a do
 * coordenador (`document.onvisibilitychange`) cai, e o teste de classe — dois
 * canais que ninguém escreveu na guarda — cai de graça: um `setInterval` que
 * consulta `document.visibilityState` sem ouvinte nenhum, e
 * `window.onhashchange` (propriedade, outro alvo, outro tipo).
 *
 * ## Rodada 18 — o que mudou
 *
 * **MÉDIO — a derivação de entradas cobria um ASSUNTO, não a CLASSE.** A
 * rodada 17 passou a ler o inventário do produto em duas fontes: (a) os `on*`
 * que o React pendura nos nós e (b) os sinais de LARGURA. A fonte (b) foi
 * escrita para um assunto, e o que a página escuta no DOCUMENTO ficou de
 * fora: `visibilitychange` — trocar de aba e voltar — não aparecia uma vez
 * sequer na guarda. O coordenador armou lá a mesma armadilha de sempre e
 * passou pelos cinco portões (1416 testes, `tsc`, contraste, `eslint` e
 * "60 medidas, todas dentro da régua"):
 *
 *     document.addEventListener("visibilitychange", () => {
 *       if (document.visibilityState === "visible") setVoltouDeOutraAba(true);
 *     });
 *     // em registrarBotaoLinha: if (el !== null && voltouDeOutraAba) el.tabIndex = -1;
 *
 *     aba em primeiro plano          : {"visiveis":36,"foraDoTab":0}
 *     depois de sair da aba e voltar : {"visiveis":36,"foraDoTab":27}
 *
 * A fonte (b) virou a CLASSE: a instrumentação anota todo
 * `addEventListener` em `window`, `document` e `visualViewport`, mais
 * `matchMedia` e `ResizeObserver`, seja qual for o tipo — e **embrulha cada
 * ouvinte do produto num contador**, para que "exercida" seja uma medição
 * ("o ouvinte rodou"), nunca uma declaração. O que o framework registra sai
 * por critério DERIVADO (a pilha de quem registrou: mora em `node_modules`?),
 * e não por lista de exceções: medido, 146 de 161 registros da carga são do
 * Next/React e caem por aí. Depois dos passos escritos à mão, a guarda
 * pergunta ao produto quais ouvintes dele ninguém acordou e **deriva um passo
 * para cada um** — redimensionar, rolar a página, apertar tecla, sair da aba
 * e voltar, trocar o `#` da URL —, remedindo o Tab logo depois. Tipo sem
 * motorista fica pendente e o fecho reprova nomeando o tipo.
 *
 * Provado com 16 sabotagens: as 13 da rodada 17 seguem vermelhas, a do
 * coordenador cai pelo passo derivado de `visibilitychange`, o teste de
 * classe (`hashchange`, que ninguém escreveu em lugar nenhum) cai do mesmo
 * jeito, e um ouvinte de tipo que o Playwright não sabe produzir
 * (`devicemotion`) reprova **nomeando o tipo** em vez de aprovar por ausência.
 *
 * ## Rodada 15 — o que mudou
 *
 * **ALTO 1 — a medida R olhava um instante só (a forma 4 do vício da casa).**
 * Quatro linhas de `setTimeout` dentro do `ref` que o produto já tinha tiravam
 * 27 dos 36 controles da ordem do Tab três segundos depois da carga, e os cinco
 * portões ficavam verdes. Entraram V, W e X — as sentinelas de teclado, com o
 * alcance de tempo escrito por extenso no bloco delas (procure por "QUAL É O
 * ALCANCE DE TEMPO DESTAS MEDIDAS"). R continua, e continua sendo a medida do
 * INSTANTE: é ela que pega `tabIndex={-1}` escrito no JSX.
 *
 * **MÉDIO 2 — a guarda morria sob carga com rastro de pilha do Node.** Entraram
 * o aquecimento da rota fora de medida, teto por medida, teto de corrida, o
 * anúncio de cada etapa enquanto roda e a classe de reprovação "precondição
 * falhou" — para a guarda nunca mais relatar como defeito do produto o estado
 * que ela mesma não conseguiu estabelecer. Medido: com o rótulo do zoom
 * renomeado, a guarda da rodada 14 morria em 15 linhas de log com
 * `locator.click: Timeout 30000ms exceeded` e nenhuma medida nomeada; esta
 * imprime 201 linhas, nomeia as 8 medidas cuja precondição falhou e roda as
 * outras 50 até o fim.
 *
 * ## Rodada 11 — por que H, I e J nasceram
 *
 * **H (achado ALTO 1).** Nenhuma das três camadas de guarda amarrava um pixel
 * a uma data. O crítico somou `+ 3` dentro de `xFor` — o ponto único de
 * posicionamento das barras — e passou por tudo: 1363 testes verdes, `tsc`
 * limpo, contraste 70/70 e esta guarda 8/8. A medida E ("o `left` nunca
 * desce") RELATOU o deslocamento nos próprios números e aprovou, porque
 * monotonicidade é invariante a translação. Na tela, toda barra andava 3 dias
 * enquanto a faixa do "Hoje" e os rótulos do eixo ficavam onde estavam: o
 * losango "mesmo dia, 21/09" nascia À DIREITA da linha do "Hoje".
 *
 * A régua de H **não passa por `xFor`**, ou ela mediria a mentira contra ela
 * mesma. Ela é o que está DESENHADO no mesmo canvas das barras:
 *
 *   - as **guias de segunda-feira** (`.lb-tl-guia-semana`, de
 *     `gerarEscalaEixo`) dão `px/dia` — são 7 dias exatos entre duas;
 *   - a **faixa do "Hoje"** (`.lb-tl-hoje[data-lb-hoje]`, de `xHoje`) dá a
 *     origem: é o único pixel do canvas cuja data o componente declara;
 *   - e as duas se conferem: cada guia tem de cair num dia que, contado a
 *     partir de "hoje", seja mesmo uma segunda-feira.
 *
 * Com a régua de pé, cada barra é convertida de volta para data e comparada
 * com a data que o **próprio `title` dela declara** — o texto que o operador
 * lê. Três fontes independentes (eixo, âncora, texto) cruzadas num número.
 *
 * **I (achado ALTO 2).** O medidor "derivado do código"
 * (`scripts/checar-contraste.mjs`) confere o token, nunca o par: exigia que
 * todo token usado como `text-*` aparecesse em ALGUM par, e um par de borda
 * decorativa a 3:1 virava passe livre para o mesmo token ser texto corrido.
 * O crítico trocou `text-bone-300`/`text-bone-100` por `text-navy-700` nas
 * duas gavetas e o script imprimiu "todos na régua" — o Chromium media
 * 2,76:1. E três canais inteiros eram invisíveis para ele: valor arbitrário
 * (`text-[#3a3a3a]`), `style={{ color }}` e cor vinda de CSS. I mede o que o
 * navegador pinta: cor computada de cada nó de texto visível contra o fundo
 * REAL (subindo até o primeiro ancestral opaco e compondo alfa e `opacity`
 * no caminho) — com as DUAS gavetas abertas, que é onde a sabotagem mora.
 *
 * ## Rodada 12 — o que mudou, e por quê
 *
 * O vício desta base apareceu dez vezes com a mesma forma — *a guarda mede a
 * hipótese, não o produto* — e a rodada 12 encontrou a versão mais irônica
 * dele: **dentro da medida escrita para curar a versão anterior do mesmo
 * erro.** A medida A dizia, no próprio comentário, medir "a faixa do Hoje como
 * o navegador a pinta", e lia três canais que `opacity` não toca. Uma classe
 * `opacity-0` apagou 1.134 px de faixa dourada com os cinco portões verdes.
 *
 * As correções, e a regra que cada uma instala:
 *
 * - **A, N (CRÍTICO 1).** Nenhuma medida de "isto está visível?" lê atributo
 *   declarado. `pintaDeVerdade` fotografa a janelinha do elemento COM e SEM
 *   ele e exige as duas coisas: pixels na cor que o compositor deve pintar, e
 *   pixels que MUDAM quando o elemento sai. N aplica isso às 10 camadas sobre
 *   as quais alguma medida deste arquivo faz alguma afirmação.
 * - **M (CRÍTICO 2).** Os rótulos de data do eixo entram na MESMA régua das
 *   barras, pelo caminho inverso (posição → data → o número impresso), em 5
 *   posições de rolagem e 2 resizes tardios: uma afirmação que só vale no
 *   primeiro quadro não vale.
 * - **H, O (ALTO 1).** A coleta é DERIVADA do que cada elemento afirma, não de
 *   três seletores escritos à mão; o que fica fora sai por exceção declarada
 *   COM conferência própria; uma classe `lb-tl-*` nova REPROVA até alguém
 *   dizer como ela se mede; e nenhum mecanismo obrigatório pode somar zero.
 * - **I (ALTO 2).** Todas as gavetas, nos 3 zooms e nas 2 larguras — e o que
 *   ela não cobre está escrito no relatório dela.
 * - **P (ALTO 3).** Cada "◀"/"▶" do canvas tem de ter, na coluna de rótulos,
 *   um texto VISÍVEL com a sua data-âncora: `title` não existe no toque.
 * - **C (MÉDIO 1).** Compara de verdade o "Período" da gaveta com o texto do
 *   desenho da mesma linha, nas 27 linhas da tela.
 * - **E (MÉDIO 2).** Lê a DATA do texto, não o pixel clampado: a ordenação
 *   ganhou poder de reprovar, e a posição continua sendo assunto de H.
 *
 * ## Rodada 13 — o eixo Y existia e ninguém o media
 *
 * **Q (achado ALTO 1).** As 26 medidas da rodada 12 mediam o eixo X inteiro —
 * H, M, J, K e E cruzam três fontes para dizer *quando*. **Nenhuma comparava a
 * posição vertical de uma barra com a do rótulo que a nomeia**, e um Gantt
 * afirma duas coisas por barra: *quando* (x) e *de quem* (y). A medida C casa
 * gaveta × desenho por prefixo de `title` — texto, não geometria — e a E só
 * ordena os RÓTULOS entre si. O canvas e a coluna são duas pilhas
 * independentes que só se alinhavam porque `ROW_H = 42` e `h-[42px]` eram dois
 * números escritos à mão com o mesmo valor, e a lei que os amarra vivia num
 * COMENTÁRIO do componente. Duas sabotagens passaram pelos cinco portões:
 * `(i + 1) * ROW_H` (toda barra 42px abaixo do próprio rótulo) e `ROW_H = 44`
 * (erro que ACUMULA — a linha 20 a mais de uma linha inteira do nome dela).
 * Q casa os dois lados pela chave da linha (`data-lb-linha`, que as duas
 * pontas passaram a carregar) e mede centro contra centro. A mesma lei também
 * virou teste barato em `linha-do-tempo-componente.test.tsx`, lendo as duas
 * alturas da árvore que o componente devolve.
 *
 * **Os 9 contextos (achado BAIXO 3a).** H, J e Q rodavam em 3 contextos, dos
 * quais dois eram "Auto": **Mês e Trimestre nunca entravam** — os dois zooms
 * em que o histórico inteiro cabe na tela e o piso de largura da barra morde
 * em quase toda linha. Não era vazamento; era buraco. Agora são 4 zooms × 2
 * larguras + 1024×768.
 *
 * **As `dentro-da-barra` (achado BAIXO 3b).** Este cabeçalho afirmava, por
 * escrito, que "a exceção não é um `continue`" — e as três classes
 * `dentro-da-barra` saíam por um `continue` puro. Cada uma tem agora a
 * conferência que o motivo dela promete (`confereDentroDaBarra`).
 *
 * ## Rodada 14 — quatro coisas que a guarda não perguntava
 *
 * **ALTO 1 — o modelo de mistura nunca media α.** Toda pergunta de "isto está
 * pintado?" era *"o pixel está na cor da linha?"* — e a cor esperada é
 * calculada com o mesmo `opacity` que o elemento declara. Em
 * `P = α·C + (1 − α)·B`, baixar α muda o pixel e muda a expectativa junto:
 * `opacity: 0.12` mantém o pixel em cima da linha, mantém "os pixels mudam ao
 * esconder" verdadeiro, e passa em tudo. Provado duas vezes, sem combinação:
 * na peça P4 (12,40:1 → 1,21:1) e aqui, pelo crítico, na faixa "Hoje"
 * (9,89:1 → 1,18:1).
 *
 * A cura são DUAS perguntas separadas, e todo alvo de `pintaDeVerdade`
 * responde as duas: (1) *é a cor certa?* — a distância até a linha declarada,
 * que já existia; (2) *dá para um humano enxergar?* — o CONTRASTE do pixel
 * composto contra o pixel REAL do fundo daquele lugar, os dois tirados das
 * mesmas duas fotos, sem cor declarada nenhuma no meio. O piso dessa segunda
 * pergunta vem de `scripts/checar-contraste.mjs` (3:1, não-texto, WCAG
 * 1.4.11) — **nunca deste arquivo nem do componente**: piso que mora onde
 * mora a cor é a guarda contando a si mesma. Uma única dispensa, declarada e
 * conferida pela medida U: a guia de semana, que é grade decorativa.
 *
 * **ALTO 2 — cobertura de teclado era ZERO.** `grep -c "keyboard|.press(|Tab"`
 * devolvia 0 neste arquivo (2 na guarda da P4). `tabIndex={-1}` nos dois
 * botões de rótulo passava em 47/47 medidas enquanto o número de elementos
 * alcançáveis por Tab caía de 27 para 0. A medida R fecha isso — e o universo
 * dela NÃO é `[tabindex]:not([tabindex="-1"])`, que sumiria junto com a
 * sabotagem: é todo `<button>`/`<a href>` VISÍVEL, veja ele o Tab ou não.
 *
 * **ALTO 3 — precedência desenhada × precedência do caminho crítico.**
 * `void edges` em `precedenciaDeclarada` derrubava os conectores de 5 para 4,
 * e a guarda imprimia o número mudado e aprovava: o universo esperado era o
 * que o próprio desenho entregara (forma 3). A medida S deriva o universo da
 * MESMA fonte de dado que alimenta o CPM (`tests/navegador/fonte-da-
 * precedencia.mjs`), aplica a lei da união escrita de novo e compara PAR A
 * PAR — contagem não distingue um par que some de outro que aparece.
 *
 * **MÉDIO 4 — o seletor de zoom era inerte.** Trocar `PX_POR_DIA_FIXO[zoom]`
 * por `.semana` passava: os 9 contextos viravam 4 cenas medidas 9 vezes. A
 * medida T mede o `px/dia` das guias desenhadas em cada zoom (a mesma régua
 * independente de H, nunca a constante do componente) e exige quatro escalas
 * distintas duas a duas.
 *
 * **BAIXO 5 — `.lb-tl-marco` não era medido por medida nenhuma.** Consertou-se
 * a CAUSA: o PR #598 da fixture nasce e morre no mesmo instante, então o
 * losango existe em toda corrida, a qualquer hora, e a camada passou a ser
 * `garantida` em N e obrigatória em O.
 *
 * ## Rodada 13
 *
 * **J (achado MÉDIO 3).** O texto parou de mentir na rodada 10; o desenho
 * não. Quatro tarefas cujo próprio `title` dizia "sem início nem duração
 * registrados" eram desenhadas em `left` = a faixa do "Hoje" e `width` = 1
 * dia exato — idênticas a uma tarefa de 1 dia real; e a 390px, com o piso de
 * largura, idênticas também a uma de 0,5 dia. J exige o contrário: uma barra
 * só existe se o texto dela declarar as DUAS datas, e uma linha marcada como
 * fora da grade não pode ter barra nenhuma.
 */

/*
 * Os nomes abaixo NÃO existem neste arquivo: eles existem dentro dos
 * `pagina.evaluate(...)`, que o Playwright serializa e roda no CONTEXTO DA
 * PÁGINA, dentro do Chromium. Declarados como globais para o ESLint saber
 * disso — é uma declaração de ambiente, não um silenciamento de regra.
 */
/* global document, window, navigator, getComputedStyle, requestAnimationFrame, CSS, Element, MutationObserver, KeyboardEvent, PointerEvent, MouseEvent, FocusEvent, Event, EventTarget, ResizeObserver, performance, AnimationTimeline */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { cpus, loadavg } from "node:os";

import { ARQUIVO_DA_FONTE, precedenciaDaFonte } from "./fonte-da-precedencia.mjs";
import { ARQUIVO_DO_PISO, pisosDeContraste } from "./piso-de-contraste.mjs";

/**
 * ESTA GUARDA SOBE O PRÓPRIO SERVIDOR.
 *
 * A primeira versão se conectava a uma porta fixa e media o que estivesse
 * lá. Numa máquina com várias cópias do repositório abertas — que é o caso
 * quando várias correções rodam em paralelo —, ela media a árvore de outra
 * pessoa e dizia VERDE, inclusive com uma sabotagem aplicada na árvore de
 * verdade. Isso foi medido, não suposto. Medir o produto não é só abrir o
 * navegador: é garantir que o que está do outro lado é ESTE código.
 *
 * `LIFEBOARD_URL` continua existindo para quem quiser apontar para um
 * servidor já no ar — e assume a responsabilidade de ele servir esta árvore.
 */
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
      "guarda-p5: não consegui subir o servidor deste pacote. Rode `npm install` na raiz, ou aponte LIFEBOARD_URL para um servidor que sirva ESTA árvore.",
    );
    process.exit(2);
  }
  BASE = proprio.base;
  encerrarServidor = proprio.encerrar;
  console.log("%s", `servidor próprio no ar em ${BASE} (subido por esta guarda)`);
}
const ROTA = `${BASE}/linha-do-tempo`;
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? undefined;

/*
 * `playwright-core` é CommonJS: quando o caminho vem por variável de ambiente
 * (o ambiente de CI da casa não instala navegador, então o módulo mora fora
 * do pacote), o `import()` devolve os nomes em `default`. Ler os dois lugares
 * evita o `chromium is undefined` que parece "playwright quebrado" e é só
 * formato de módulo.
 */
const moduloDoPlaywright = await import(process.env.PLAYWRIGHT_MODULO ?? "playwright-core");
const chromium = moduloDoPlaywright.chromium ?? moduloDoPlaywright.default?.chromium;
if (!chromium) {
  console.error("%s", "guarda-p5: não achei o `chromium` do playwright-core. Aponte PLAYWRIGHT_MODULO para o arquivo de entrada do pacote.");
  process.exit(2);
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * [MÉDIO 2, rodada 15] A GUARDA MORRIA SOB CARGA, COM RASTRO DE PILHA DO NODE
 *
 * Medido três vezes pelo coordenador NESTA máquina (4 núcleos, com outros
 * agentes rodando ao lado — `load average` acima de 5):
 *
 *   locator.click: Timeout 30000ms exceeded.      ← dentro de uma medida,
 *                                                   exit 1, rastro de pilha
 *   page.waitForSelector: Timeout 20000ms exceeded — waiting for
 *                                                   locator('.lb-tl-hoje')
 *
 * Repetidas com a máquina descarregada, as mesmas corridas ficaram VERDES.
 *
 * **Um portão que fica vermelho por carga ensina a repetir até passar — e é
 * assim que um vermelho de verdade também some.** O defeito não é a máquina
 * estar lenta: é a guarda não saber dizer a diferença entre "o produto está
 * quebrado" e "o estado de que esta medida precisava nunca chegou a existir".
 * As duas coisas saíam iguais — exceção não tratada, processo morto no meio,
 * e as medidas seguintes nunca rodando.
 *
 * Cinco travas, a classe já fechada pela peça P6 na rodada 17, adaptada aqui:
 *
 *  1. **aquecimento antes da primeira medida.** `esperarResponder` só batia em
 *     `/`; quem pagava a compilação de `/linha-do-tempo` no `next dev` era a
 *     medida A, dentro do teto de 20 s do `waitForSelector` — e era esse o
 *     `Timeout 20000ms` do coordenador. Agora a rota é aquecida FORA de
 *     qualquer medida, com teto próprio e generoso, e o custo de compilar sai
 *     impresso.
 *  2. **teto por medida.** Medida que trava vira reprovação COM NOME, nunca
 *     espera infinita nem rastro de pilha.
 *  3. **teto de corrida.** Corrida que não cabe para dizendo em que medida
 *     estava.
 *  4. **anúncio de cada etapa enquanto roda.** O veredito sai na hora, com
 *     carimbo. Corrida morta no meio deixa na última linha do log o nome da
 *     medida que estava rodando — era exatamente isso que faltava.
 *  5. **precondição é classe própria de reprovação.** Abrir a rota, trocar o
 *     zoom, abrir a gaveta: é o ESTADO de que a medida precisa para medir.
 *     Toda medida estabelece o próprio estado; se ele não se estabelece, a
 *     reprovação diz "a precondição falhou" e declara que NÃO mediu o produto
 *     — em vez de relatar como defeito do produto o estrago de outra etapa.
 *
 * `page.evaluate` é a única chamada do Playwright sem tempo limite nenhum, e
 * as que rodam sobre as páginas SENTINELA (abertas em segundo plano a corrida
 * inteira) são as que uma aba congelada faria esperar para sempre. Todas
 * passam a ter teto, e o congelamento de aba de segundo plano sai desligado na
 * linha de comando do navegador — que é onde isso se declara.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** O relógio da corrida — dele saem os carimbos e o teto total. */
const INICIO_DA_CORRIDA = Date.now();

/**
 * Teto de UMA medida. Escrito à mão, sem porta de saída por variável de
 * ambiente: teto que a corrida afrouxa sozinha não é teto. Medido nesta
 * máquina, com carga: a medida mais cara desta base é a `I` (30 cenas por
 * viewport, ~25 s). 3 min é ~7× isso — só dispara em travamento de verdade.
 */
const TETO_POR_MEDIDA_MS = 180000;

/** Teto da corrida inteira, contra os ~3 min que ela leva com carga. */
const TETO_DA_CORRIDA_MS = 1200000;

/** Teto de um `page.evaluate` — a única chamada do Playwright sem tempo limite. */
const TETO_DO_EVALUATE_MS = 30000;

/** Teto das ações do Playwright que estabelecem estado (clique, espera). */
const TETO_DE_ACAO_MS = 30000;

/**
 * Teto do aquecimento da rota, FORA de qualquer medida. Generoso de propósito:
 * é ele que paga a compilação do `next dev` uma vez só, e sob carga essa
 * compilação passou de 20 s (o antigo teto da medida A) mais de uma vez.
 */
const TETO_DO_AQUECIMENTO_MS = 240000;

class EstourouOTeto extends Error {}

/**
 * O estado de que a medida precisava não se estabeleceu. É uma classe à parte
 * porque a conclusão é outra: "não medi o produto", e não "o produto está
 * errado".
 */
class PrecondicaoFalhou extends Error {}

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

/** O erro, ou alguma causa dele, é um teto de tempo DESTA guarda? */
function cadeiaTemEstouro(erro) {
  let e = erro;
  for (let n = 0; n < 8 && e !== undefined && e !== null; n += 1) {
    if (e instanceof EstourouOTeto) return true;
    e = e.cause;
  }
  return false;
}

/** …ou o tempo-limite de uma AÇÃO do Playwright (clique, espera, navegação)? */
function cadeiaTemTempoDeAcao(erro) {
  let e = erro;
  for (let n = 0; n < 8 && e !== undefined && e !== null; n += 1) {
    if (e instanceof Error && e.name === "TimeoutError") return true;
    e = e.cause;
  }
  return false;
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * [MÉDIO, rodada 20] A SONDA DE VIDA — "a máquina não deu conta" ou "o
 * produto travou a página"?
 *
 * Medido pelo coordenador na árvore LIMPA da rodada 19, sob carga alta: a
 * medida Y estourou o teto de 180 s e a guarda saiu com código 1 — "o produto
 * falhou" — depois de 1445 s. A mesma árvore com carga menor deu verde em
 * 324 s. Um código 1 que some quando a máquina esvazia ensina a repetir até
 * passar, e é assim que um vermelho de verdade também some.
 *
 * O relógio sozinho não distingue as duas causas. A página distingue:
 *
 *  1. uma página EM BRANCO, num contexto novo, mede agora quanto esta
 *     máquina leva para responder `1` — é o controle, tirado no mesmo instante
 *     e na mesma carga que as páginas medidas;
 *  2. cada página aberta pela guarda responde `1`, três vezes. Ela está
 *     TRAVADA se não responder dentro de `max(PISO_DA_SONDA_MS, FATOR × controle)`,
 *     ou se a mediana dela passar de `max(PISO_DE_LENTIDAO_MS, FATOR ×
 *     controle)` — a página responde, mas dezenas de vezes mais devagar que
 *     uma página em branco na mesma máquina, agora;
 *  3. página travada = o PRODUTO, código 1, e o contexto dela é fechado (um
 *     laço infinito queimaria um núcleo pelo resto da corrida). Todas vivas =
 *     "não consegui medir", código 2. O controle sem resposta = a máquina nem
 *     abre uma página em branco: código 2.
 *
 * Carga pesa nas duas pontas da comparação — no controle e na página —, e é
 * por isso que ela não vira veredito. Um laço infinito pesa só numa.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const PISO_DA_SONDA_MS = 15000;
const PISO_DE_LENTIDAO_MS = 2000;
const FATOR_DA_SONDA = 50;
const TETO_DO_CONTROLE_MS = 60000;
const REPETICOES_DA_SONDA = 3;

function mediana(xs) {
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)] ?? 0;
}

/**
 * Quanto a página leva para responder `1` — a pergunta mais barata que existe.
 *
 * Pelo protocolo do navegador, direto ao processo que desenha a página, e
 * NÃO pelo `evaluate` do Playwright: medido na primeira corrida desta rodada,
 * o `evaluate` numa página cuja navegação ainda não chegou ESPERA o documento
 * novo — e a sonda chamou de "travada" uma página que só estava esperando o
 * servidor. `Runtime.evaluate` roda no documento que existe AGORA, qualquer
 * que seja; só não volta se a linha de execução da página estiver presa.
 */
async function latenciaDe(pagina, teto) {
  const t0 = Date.now();
  const sessao = await comTeto(pagina.context().newCDPSession(pagina), teto, "abrir a sonda de vida");
  try {
    await comTeto(sessao.send("Runtime.evaluate", { expression: "1", returnByValue: true }), teto, "a sonda de vida");
  } finally {
    sessao.detach().catch(() => {});
  }
  return Date.now() - t0;
}

async function sondarVida(onde) {
  const carga = `load ${loadavg()[0].toFixed(1)} em ${String(cpus().length)} núcleos`;
  console.log("%s", `[${carimbo()}] → sonda de vida depois de ${onde} (${carga}) …`);
  let controleMs = null;
  let contextoDeControle = null;
  try {
    contextoDeControle = await comTeto(navegador.newContext(), TETO_DO_CONTROLE_MS, "o contexto de controle");
    const branca = await comTeto(contextoDeControle.newPage(), TETO_DO_CONTROLE_MS, "a página de controle");
    const ls = [];
    for (let i = 0; i < REPETICOES_DA_SONDA; i += 1) ls.push(await latenciaDe(branca, TETO_DO_CONTROLE_MS));
    controleMs = mediana(ls);
  } catch {
    controleMs = null;
  } finally {
    await contextoDeControle?.close().catch(() => {});
  }
  if (controleMs === null) {
    return {
      travadas: [],
      resumo: "nenhuma página sondada",
      controle: `uma página em branco não respondeu em ${String(TETO_DO_CONTROLE_MS)} ms — a máquina nem abre página`,
      carga,
    };
  }
  const tetoDeResposta = Math.max(PISO_DA_SONDA_MS, FATOR_DA_SONDA * controleMs);
  const tetoDeLentidao = Math.max(PISO_DE_LENTIDAO_MS, FATOR_DA_SONDA * controleMs);
  const travadas = [];
  const vivas = [];
  for (const contexto of navegador.contexts()) {
    for (const pagina of contexto.pages()) {
      if (pagina.isClosed()) continue;
      const onde = pagina.url();
      const ls = [];
      let semResposta = null;
      for (let i = 0; i < REPETICOES_DA_SONDA; i += 1) {
        try {
          ls.push(await latenciaDe(pagina, tetoDeResposta));
        } catch (erro) {
          semResposta = erro instanceof Error ? erro.message.split("\n")[0] : String(erro);
          break;
        }
      }
      if (semResposta !== null) {
        travadas.push(`${onde} não respondeu \`1\` em ${String(tetoDeResposta)} ms (${semResposta})`);
        await comTeto(contexto.close(), TETO_DO_CONTROLE_MS, "fechar a página travada").catch(() => {});
        break;
      }
      const m = mediana(ls);
      if (m > tetoDeLentidao) {
        travadas.push(
          `${onde} responde \`1\` em ${String(m)} ms, mais de ${String(Math.round(tetoDeLentidao / Math.max(controleMs, 1)))}× uma página em branco`,
        );
        await comTeto(contexto.close(), TETO_DO_CONTROLE_MS, "fechar a página travada").catch(() => {});
        break;
      }
      vivas.push(m);
    }
  }
  const resumo = `${String(vivas.length)} página(s) viva(s), mediana ${String(mediana(vivas))} ms, pior ${String(Math.max(0, ...vivas))} ms`;
  console.log("%s", `[${carimbo()}] ← sonda de vida: ${travadas.length > 0 ? `${String(travadas.length)} TRAVADA(S)` : resumo} (controle ${String(controleMs)} ms)`);
  return { travadas, resumo, controle: `${String(controleMs)} ms`, carga };
}

function carimbo() {
  const s = Math.round((Date.now() - INICIO_DA_CORRIDA) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** O produto está errado: código 1. */
const falhas = [];
/**
 * [MÉDIO, rodada 20] NÃO CONSEGUI MEDIR: código 2. Só entra aqui o que
 * estourou um TETO DE TEMPO desta guarda **e** deixou todas as páginas vivas,
 * respondendo num tempo da ordem de uma página em branco na mesma máquina —
 * ver `sondarVida`. Página que não responde é o produto travado, e vai para
 * `falhas`.
 */
const impedimentos = [];
const medidas = [];

function conferir(nome, ok, detalhe, classe = "produto") {
  const rotulo = ok ? "ok   " : classe === "não medi" ? "NÃO MEDI" : "FALHA";
  const linha = `${rotulo} ${nome} — ${detalhe}`;
  medidas.push(linha);
  if (!ok && classe === "não medi") impedimentos.push(nome);
  else if (!ok) falhas.push(nome);
  /* [MÉDIO 2] o veredito sai NA HORA, não só no relatório do fim. */
  console.log("%s", `[${carimbo()}] ${linha}`);
}

/**
 * [MÉDIO, rodada 20] O CÓDIGO DE SAÍDA, EM DOIS BALDES — a mesma régua da
 * peça P4: produto errado → 1; não consegui medir → 2. Quando os dois
 * aparecem vale o 1: um impedimento não apaga um vermelho já medido.
 */
function codigoDeSaida() {
  if (falhas.length > 0) return 1;
  if (impedimentos.length > 0) return 2;
  return 0;
}

/** O fim abrupto: imprime o que já se sabe, com nome, e sai com o código do balde. */
function encerrarAgora(motivo) {
  console.error("%s", `\n${motivo}`);
  console.log("%s", `\n${medidas.join("\n")}`);
  try {
    encerrarServidor();
  } catch {
    // o servidor já morreu
  }
  const codigo = codigoDeSaida() === 0 ? 2 : codigoDeSaida();
  if (codigo === 2) {
    console.error(
      "%s",
      "\ncódigo 2: a guarda NÃO conseguiu medir — isto não é verde, e também não é o produto reprovado. Toda página aberta respondeu à sonda de vida; um produto que trava a página não sai por esta porta.",
    );
  }
  process.exit(codigo);
}

/**
 * Estabelece um pedaço do estado de que a medida precisa. Qualquer estouro
 * aqui vira `PrecondicaoFalhou` — com o nome do passo —, e `medir` o relata
 * como "a precondição falhou", nunca como defeito do produto.
 */
async function precondicao(oQue, fn) {
  try {
    return await fn();
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message.split("\n")[0] : String(erro);
    /* A causa vai junto: é por ela que `medir` sabe se o passo não se
       estabeleceu por TEMPO (e então pergunta à página se ela está viva) ou
       por outro motivo. */
    throw new PrecondicaoFalhou(`o passo "${oQue}" não se estabeleceu: ${msg}`, { cause: erro });
  }
}

/** Clique que estabelece estado: estourar é precondição falha, com nome. */
async function clicar(alvo, oQue) {
  await precondicao(oQue, async () => {
    await alvo.click({ timeout: TETO_DE_ACAO_MS });
  });
}

/** Espera por seletor que estabelece estado: idem. */
async function esperarSeletor(pagina, seletor, oQue, opcoes = {}) {
  return await precondicao(oQue, async () =>
    await pagina.waitForSelector(seletor, { timeout: TETO_DE_ACAO_MS, ...opcoes }),
  );
}

/**
 * Roda uma medida com teto próprio, anuncia início e fim, e transforma
 * estouro em reprovação COM NOME — nunca num rastro de pilha do Node.
 */
async function medir(nome, fn) {
  const restante = TETO_DA_CORRIDA_MS - (Date.now() - INICIO_DA_CORRIDA);
  const minutos = String(Math.round(TETO_DA_CORRIDA_MS / 60000));
  if (restante <= 0) {
    conferir(
      `${nome} · (a medida não chegou a rodar)`,
      false,
      `a corrida estourou o teto de ${minutos} min antes desta medida começar — não medi o que faltava; o que já foi medido continua valendo`,
      "não medi",
    );
    encerrarAgora(`a corrida estourou o teto de ${minutos} min — parada em "${nome}"`);
  }
  const teto = Math.min(TETO_POR_MEDIDA_MS, restante);
  console.log("%s", `[${carimbo()}] → ${nome} …`);
  const t0 = Date.now();
  try {
    await comTeto(fn(), teto, `a medida "${nome}"`);
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message.split("\n")[0] : String(erro);
    /*
     * [MÉDIO, rodada 20] TETO DE TEMPO NÃO É VEREDITO — A PÁGINA É QUEM DIZ.
     *
     * Estourar um teto desta guarda tem duas causas que saíam iguais: a
     * máquina não deu conta (código 2, "não medi") e o produto travou a
     * página (código 1). A diferença não se adivinha pelo relógio: pergunta-se
     * a cada página aberta se ela ainda responde. Vale para o estouro da
     * medida inteira e para o estouro que chegou aqui embrulhado numa
     * precondição.
     */
    /*
     * O tempo-limite de uma AÇÃO do Playwright também passa pela sonda — mas
     * só para dizer se a página TRAVOU. Viva, ele continua sendo precondição
     * (código 1, como sempre): uma espera de 30 s que acaba com a página
     * respondendo em milissegundos não distingue "o botão não existe" de "o
     * botão demorou", e na dúvida o vermelho do produto não vira "não medi".
     */
    const vidaDaAcao =
      !cadeiaTemEstouro(erro) && cadeiaTemTempoDeAcao(erro) ? await sondarVida(`a medida "${nome}"`) : null;
    if (vidaDaAcao !== null && vidaDaAcao.travadas.length > 0) {
      conferir(
        `${nome} · (o produto TRAVOU a página)`,
        false,
        `${msg} — e a sonda de vida confirmou: ${vidaDaAcao.travadas.join(" · ")} (página em branco na mesma máquina, agora: ${vidaDaAcao.controle}). Página que não responde é defeito do produto, nunca "não medi"`,
      );
    } else if (cadeiaTemEstouro(erro)) {
      const vida = await sondarVida(`a medida "${nome}"`);
      const parar = erro instanceof EstourouOTeto;
      if (vida.travadas.length > 0) {
        conferir(
          `${nome} · (o produto TRAVOU a página)`,
          false,
          `${msg} — e a sonda de vida confirmou: ${vida.travadas.join(" · ")} (página em branco na mesma máquina, agora: ${vida.controle}). Página que não responde é defeito do produto, nunca "não medi"`,
        );
      } else {
        conferir(
          `${nome} · (não consegui medir: estourou o teto de tempo)`,
          false,
          `${msg} — mas toda página aberta respondeu à sonda de vida (${vida.resumo}; página em branco na mesma máquina, agora: ${vida.controle}; carga ${vida.carga}). É a máquina, não o produto: repetir numa máquina menos carregada`,
          "não medi",
        );
      }
      if (parar) {
        /*
         * A corrida PARA aqui, de propósito: a medida abandonada deixou uma
         * operação do Playwright em voo, e tudo o que as seguintes
         * registrassem seria leitura de um estado que ninguém controla.
         */
        encerrarAgora(`medida parada no teto: "${nome}" passou de ${String(Math.round(teto / 1000))}s`);
      }
    } else if (erro instanceof PrecondicaoFalhou) {
      conferir(
        `${nome} · (precondição)`,
        false,
        `${msg} — esta medida NÃO mediu o produto: o estado de que ela precisava não existiu. Até a precondição valer, isto não é defeito do produto`,
      );
    } else {
      conferir(`${nome} · (a medida não chegou ao fim)`, false, `a medida ESTOUROU: ${msg}`);
    }
  }
  console.log("%s", `[${carimbo()}] ← ${nome} — ${String(Math.round((Date.now() - t0) / 1000))}s`);
}

/*
 * [MÉDIO 2] O CONGELAMENTO DE ABA EM SEGUNDO PLANO, DESLIGADO.
 *
 * As sentinelas de teclado (medidas V e W) ficam abertas a corrida inteira e,
 * por desenho, em segundo plano. O Chromium congela aba de segundo plano
 * depois de ~5 min, e `page.evaluate` sobre aba congelada não volta — e não
 * tem tempo limite. Desligar isso é causa-raiz, e se declara aqui, na linha de
 * comando do navegador, não num comentário.
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

/** Todo `page.evaluate` desta guarda passa a ter teto. */
function comTetoNoEvaluate(pagina) {
  const original = pagina.evaluate.bind(pagina);
  pagina.evaluate = async (fn, arg) =>
    await comTeto(original(fn, arg), TETO_DO_EVALUATE_MS, "um page.evaluate desta página");
  return pagina;
}

/**
 * [ALTO 1, rodada 15] DOIS QUADROS — E COM RELÓGIO DE MENTIRA, QUEM OS CAUSA
 * É A GUARDA.
 *
 * `clock.install()` SUBSTITUI o `requestAnimationFrame` da página. Esperar um
 * quadro ali é esperar por uma coisa que só nós podemos causar: impasse por
 * construção. A peça P6 pagou caro por isso (a medida K travou 30 s no CI, no
 * primeiro `evaluate` depois do `fastForward`). Aqui a regra já nasce escrita:
 * **com relógio de mentira, a guarda nunca espera um quadro — ela o causa.**
 * Sem relógio de mentira, o `requestAnimationFrame` é o nativo e ainda assim
 * há saída por temporizador REAL: quadro que não vem deixa de ser espera
 * infinita.
 */
const DOIS_QUADROS_MS = 32;

/**
 * A saída de emergência do caminho SEM relógio de mentira, em tempo real. Ela
 * existe para quebrar um impasse — "o quadro nunca vem" —, nunca para
 * encurtar uma espera legítima.
 *
 * MEDIDO NESTA RODADA, e o número nasceu errado: com 1 s, a guarda pinada em
 * UM núcleo (`taskset -c 0`, máquina com `load average` acima de 5) reprovou
 * três medidas — A e N a 390×844 ("esconder o elemento mudou só 0/144
 * pixels") e K a 1440×900 ("px/dia 16.000 → 42.769", que é o valor de
 * `PX_POR_DIA_AUTO_FALLBACK` do primeiro paint). Nenhuma delas era defeito do
 * produto: a saída de 1 s vencia o quadro lento e a medida LIA A TELA ANTES DE
 * ELA EXISTIR. Trocar espera infinita por leitura antecipada é o mesmo vício
 * de outro lado — e produziria exatamente o vermelho-por-carga que esta
 * rodada existe para acabar. 10 s é ~10× o pior quadro medido aqui e continua
 * muito abaixo do teto por medida, então ele só age em impasse de verdade.
 */
const SAIDA_DE_ASSENTAR_MS = 10000;

/**
 * [rodada 16] "DOIS QUADROS PASSARAM" NÃO É "A TELA PAROU DE SE MEXER".
 *
 * A rodada 15 subiu a saída de emergência de 1 s para 10 s e achou que tinha
 * fechado o vermelho-por-carga. Não fechou: medido nesta rodada, com a máquina
 * em `load average` 9 (4 núcleos), a corrida HONESTA reprovou duas vezes
 * seguidas, sempre nas mesmas medidas e sempre com a mesma assinatura:
 *
 *     K · px/dia 16.000 → 28.308      (16.000 é PX_POR_DIA_AUTO_FALLBACK, o
 *                                      valor ANTES de o painel ser medido)
 *     A · esconder o elemento mudou só 0/144 pixels
 *
 * Nenhuma das duas é defeito do produto: é a guarda lendo a tela no meio do
 * layout. Esperar DOIS QUADROS é esperar pelo relógio, não pela página — e a
 * largura do painel desta tela chega por `ResizeObserver` **depois** do
 * primeiro par de quadros, o que dispara um segundo layout inteiro.
 *
 * A pergunta certa não é "passaram quadros?", é **"a tela parou?"**. Então
 * `assentar` fotografa a geometria que as medidas usam — a escala rolável, a
 * faixa do "Hoje", a primeira barra e a altura da página — e só volta quando
 * ela sai IGUAL em três quadros seguidos. Página quieta volta em ~3 quadros
 * (mais barato que antes não é, mas é da mesma ordem); página ainda se
 * mexendo é esperada até parar, com a MESMA saída de emergência de 10 s que a
 * rodada 15 calibrou — ela continua existindo para quebrar impasse, não para
 * encurtar espera legítima.
 */
/** O quadro rolável — o alvo da roda do mouse e a régua de "o zoom mudou alguma coisa". */
const REGIAO_DO_QUADRO = '[role="region"][aria-label^="Linha do tempo"]';

const QUADROS_IGUAIS_PARA_ASSENTAR = 3;

/**
 * [rodada 16] E "A TELA PAROU" AINDA NÃO É "A TELA EXISTE".
 *
 * Com a espera por quietude acima, a corrida honesta continuou reprovando em
 * A, N e K sob carga. Medido com sonda própria, a cada 100 ms depois do
 * `networkidle`, a 1024×768 e pinada em um núcleo:
 *
 *     133 ms  px/dia 16.000   "hoje" em 408   altura 1677   sem fiber do React
 *     274 ms  px/dia 16.000   "hoje" em 408   altura 1677   sem fiber do React
 *     397 ms  px/dia 16.000   "hoje" em 408   altura 1677   FIBER do React presente
 *     566 ms  px/dia 28.286   "hoje" em 519   altura 1723
 *
 * Ou seja: por quase meio segundo a página fica **parada e errada** — é o HTML
 * do servidor, desenhado com `PX_POR_DIA_AUTO_FALLBACK` porque a largura do
 * painel só é medida por um `ResizeObserver` que nasce num efeito, depois da
 * hidratação. Uma espera por quietude dentro dessa janela aprova o estado
 * pré-hidratação — e a medida seguinte lê 16 px/dia, que foi exatamente o
 * `px/dia 16.000 → 28.308` da medida K.
 *
 * Então `abrir` passa a esperar DUAS coisas, nesta ordem: (1) o React ter
 * assumido o HTML do servidor, e (2) a geometria ficar parada por várias
 * amostras de `INTERVALO_DE_ASSENTO_MS` — não por quadros, que sob carga
 * passam rápido demais para atravessar o efeito.
 *
 * A pista de (1) é a chave `__reactFiber$…` que o React põe em cada nó que
 * hidrata. É INTERNO do React, e por isso ela **não decide nada sozinha**: é
 * só o relógio de partida da espera (2), com teto próprio. Se um dia o React
 * trocar o nome da chave, a espera cai para o caminho de sempre — a quietude
 * amostrada — e nada quebra em silêncio.
 */
const INTERVALO_DE_ASSENTO_MS = 150;
const AMOSTRAS_IGUAIS_APOS_HIDRATAR = 4;
const TETO_DA_PISTA_DE_HIDRATACAO_MS = 8000;

async function assentar(pagina) {
  if (pagina.__relogioDeMentira === true) {
    // O rAF desta página é FALSO. Quem o acorda é esta linha, e mais ninguém.
    await pagina.clock.runFor(DOIS_QUADROS_MS);
    return;
  }
  await pagina.evaluate(
    ({ saidaMs, iguaisNecessarios, regiao }) =>
      new Promise((r) => {
        const caixa = (el) => {
          if (el === null) return "-";
          const b = el.getBoundingClientRect();
          return `${String(Math.round(b.left))},${String(Math.round(b.top))},${String(Math.round(b.width))},${String(Math.round(b.height))}`;
        };
        const retrato = () => {
          const painel = document.querySelector(regiao);
          return [
            painel === null
              ? "-"
              : `${String(painel.scrollWidth)},${String(Math.round(painel.scrollLeft))},${String(painel.clientWidth)}`,
            caixa(document.querySelector(".lb-tl-hoje")),
            caixa(document.querySelector("[data-lb-barra]")),
            String(Math.round(document.documentElement.scrollHeight)),
          ].join("|");
        };
        const fim = Date.now() + saidaMs;
        let anterior = null;
        let iguais = 0;
        const passo = () => {
          const agora = retrato();
          iguais = agora === anterior ? iguais + 1 : 0;
          anterior = agora;
          if (iguais + 1 >= iguaisNecessarios || Date.now() >= fim) {
            r(null);
            return;
          }
          requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      }),
    {
      saidaMs: SAIDA_DE_ASSENTAR_MS,
      iguaisNecessarios: QUADROS_IGUAIS_PARA_ASSENTAR,
      regiao: REGIAO_DO_QUADRO,
    },
  );
}

/**
 * Espera `ms` de relógio de PAREDE e, quando a página tem relógio de mentira,
 * adianta o relógio dela junto. Sem a segunda metade, um `setTimeout` DENTRO
 * de uma página com `clock.install()` nunca dispararia e a espera viraria
 * impasse — a mesma armadilha que o comentário de `assentar` já nomeia.
 */
async function esperarComORelogioDaPagina(pagina, ms) {
  if (pagina.__relogioDeMentira === true) await pagina.clock.runFor(ms);
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Abre uma página nova na rota.
 *
 * `comRelogioDeMentira` põe o relógio da página sob controle da guarda ANTES
 * de qualquer script dela rodar — é o que permite à medida W adiantar meia
 * hora e ver disparar todo `setTimeout` que a página tiver agendado.
 * `comVigia` instala o vigia do contrato de foco (medidas V e W);
 * `comInventario` instala a leitura da dependência de largura (medida Y).
 */
async function abrir(largura, altura, opcoes = {}) {
  const { comRelogioDeMentira = false, comVigia = false, comInventario = false } = opcoes;
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura } });
  const registroForaDaPagina = [];
  if (comVigia) {
    /*
     * A cópia que mora no NODE: o vigia captura esta função antes do primeiro
     * script da página, e daí em diante toda anotação também sai da aba. É a
     * única cópia que nenhum código da página alcança.
     */
    await contexto.exposeBinding(CANAL_DO_VIGIA_DE_FOCO, (_fonte, carga) => {
      registroForaDaPagina.push(carga);
    });
  }
  /*
   * O relógio de mentira entra ANTES do vigia e antes de qualquer script da
   * página: um `setTimeout` que a página agendar depois disso é o relógio de
   * mentira que o guarda, e é por isso que `fastForward` consegue disparar.
   */
  if (comRelogioDeMentira) {
    await contexto.clock.install();
    /* [ALTO, rodada 20] e os dois relógios que ele não governa, alinhados a ele. */
    await contexto.addInitScript(RELOGIOS_ALINHADOS);
  }
  /*
   * Rodada 12: os ajudantes de alfa composto entram ANTES do carregamento —
   * assim toda medida os tem, inclusive as que rodam no primeiro quadro. Foi
   * a falta de um lugar comum que deixou a medida A com a própria conta de
   * "visível" enquanto a medida I, no mesmo arquivo, já compunha alfa certo.
   */
  await contexto.addInitScript({ content: AJUDANTES_NA_PAGINA });
  if (comVigia) {
    await contexto.addInitScript(VIGIA_DO_FOCO, {
      canal: CANAL_DO_VIGIA_DE_FOCO,
      atributos: ATRIBUTOS_DO_FOCO,
      seletor: SELETOR_DE_CONTROLE,
    });
  }
  /*
   * [MÉDIO, generalizado na rodada 18] A instrumentação dos OUVINTES entra
   * junto, antes do primeiro script da página: é ela que prova, lendo o
   * produto, tudo o que esta página escuta fora dos nós — e não uma lembrança
   * de quem escreveu o roteiro.
   */
  if (comInventario) await contexto.addInitScript(VIGIA_DE_OUVINTES, CANAL_DOS_OUVINTES);
  /*
   * [MÉDIO, rodada 19] E a testemunha do NAVEGADOR: é ela, e não o inventário,
   * quem prova que cada estímulo incondicional aconteceu.
   */
  if (comInventario) {
    await contexto.addInitScript(TESTEMUNHA_DO_NAVEGADOR, {
      chave: CANAL_DA_TESTEMUNHA,
      tipos: TIPOS_DA_TESTEMUNHA,
    });
  }
  const pagina = comTetoNoEvaluate(await contexto.newPage());
  /*
   * A marca fica NA PÁGINA, e não num parâmetro, porque parâmetro se esquece:
   * as chamadas de `assentar()` deste arquivo acertam sozinhas.
   */
  pagina.__relogioDeMentira = comRelogioDeMentira === true;
  /*
   * [MÉDIO 2] Abrir a rota é PRECONDIÇÃO, não medida. Sob carga, o `next dev`
   * levava mais que o teto antigo de 20 s para compilar `/linha-do-tempo` e a
   * guarda morria com `page.waitForSelector: Timeout 20000ms exceeded` e um
   * rastro de pilha — sem dizer que o que faltou foi o SERVIDOR, não o
   * produto. A rota já vem aquecida (ver `aquecerRota`), e o que sobrar de
   * lentidão vira uma reprovação que diz o nome do passo.
   */
  await precondicao(`abrir ${ROTA} a ${String(largura)}×${String(altura)}`, async () => {
    await pagina.goto(ROTA, { waitUntil: "networkidle", timeout: TETO_DE_ACAO_MS });
    /*
     * `state: "attached"`, e não o "visible" que é o padrão do Playwright.
     * Medido com uma sabotagem própria da rodada 12 (`invisible` na faixa do
     * "Hoje", em vez de `opacity-0`): com "visible" a guarda ficava 30s
     * esperando a faixa aparecer e MORRIA com um TimeoutError — reprovava,
     * sim, mas com um rastro de pilha em vez de dizer qual camada não pinta.
     * Uma guarda que trava na invisibilidade não a MEDE. Esperando só o
     * elemento existir, as medidas A e N rodam e nomeiam o defeito.
     */
    await pagina.waitForSelector(".lb-tl-hoje", { timeout: TETO_DE_ACAO_MS, state: "attached" });
  });
  await precondicao(
    `a página hidratar e a geometria parar de se mexer em ${String(largura)}×${String(altura)}`,
    async () => {
      const ler = async () =>
        await pagina.evaluate((regiao) => {
          const caixa = (el) => {
            if (el === null) return "-";
            const b = el.getBoundingClientRect();
            return `${String(Math.round(b.left))},${String(Math.round(b.top))},${String(Math.round(b.width))},${String(Math.round(b.height))}`;
          };
          const painel = document.querySelector(regiao);
          const linha = document.querySelector("button[data-lb-linha]");
          return {
            /* A pista: o React assumiu este nó do HTML do servidor. */
            hidratou: linha !== null && Object.keys(linha).some((k) => k.startsWith("__reactFiber$")),
            retrato: [
              painel === null
                ? "-"
                : `${String(painel.scrollWidth)},${String(Math.round(painel.scrollLeft))},${String(painel.clientWidth)}`,
              caixa(document.querySelector(".lb-tl-hoje")),
              caixa(document.querySelector("[data-lb-barra]")),
              String(Math.round(document.documentElement.scrollHeight)),
            ].join("|"),
          };
        }, REGIAO_DO_QUADRO);
      const fimDaPista = Date.now() + TETO_DA_PISTA_DE_HIDRATACAO_MS;
      while (Date.now() < fimDaPista) {
        if ((await ler()).hidratou) break;
        await esperarComORelogioDaPagina(pagina, INTERVALO_DE_ASSENTO_MS);
      }
      const fim = Date.now() + TETO_DE_ACAO_MS;
      let anterior = null;
      let iguais = 0;
      while (Date.now() < fim) {
        const { retrato } = await ler();
        iguais = retrato === anterior ? iguais + 1 : 0;
        anterior = retrato;
        if (iguais + 1 >= AMOSTRAS_IGUAIS_APOS_HIDRATAR) return;
        await esperarComORelogioDaPagina(pagina, INTERVALO_DE_ASSENTO_MS);
      }
      throw new Error(
        `a geometria do quadro não ficou parada por ${String(AMOSTRAS_IGUAIS_APOS_HIDRATAR)} amostras de ${String(INTERVALO_DE_ASSENTO_MS)} ms`,
      );
    },
  );
  await assentar(pagina);
  return { contexto, pagina, registroForaDaPagina };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * [ALTO 1, rodada 15] O TECLADO MEDIDO DEPOIS DE O TEMPO PASSAR
 *
 * A medida R nasceu na rodada 14 para fechar a cobertura zero de teclado — e
 * nasceu com a **forma 4** do vício da casa: *mede um instante só*. Ela olha a
 * ordem do Tab logo depois da carga, e mais nada.
 *
 * O coordenador passou por ela com quatro linhas dentro do `ref` que o produto
 * já tinha (`registrarBotaoLinha`, em `linha-do-tempo.tsx`):
 *
 *     if (el !== null) {
 *       setTimeout(() => { el.tabIndex = -1; }, 3000);
 *     }
 *
 * Medido no Chromium, na mesma árvore, com a sabotagem conferida presente
 * antes e depois da corrida:
 *
 *     logo depois da carga: {"visiveis":36,"foraDoTab":0}
 *     6 segundos depois:    {"visiveis":36,"foraDoTab":27}
 *
 * 27 dos 36 controles saem da ordem do Tab seis segundos depois de a página
 * abrir — e a guarda aprovava com "53 medidas, todas dentro da régua".
 * `setTimeout` dentro de um `ref` não é exotismo: é o que se escreve para
 * corrigir foco, teclado de celular e telemetria.
 *
 * A pergunta desta rodada deixa de ser "o Tab alcança AGORA?" e passa a ser
 * **"alguma coisa tirou algum controle do alcance do teclado em algum momento
 * da vida desta página?"**. Duas famílias novas, no desenho que a peça P6 já
 * provou (medidas J e K de lá), adaptado ao que envelhece AQUI — que é a ordem
 * do Tab e o estado dos controles, não o `type` de um campo:
 *
 *  - **V · as sentinelas de tempo real.** Páginas abertas ANTES da medida A e
 *    lidas DEPOIS da última. Cada uma vive a corrida inteira; no fim a guarda
 *    refaz a varredura de Tab e a fotografia dos controles e compara com a do
 *    nascimento. O tempo de vida É o alcance, e sai impresso.
 *  - **W · as sentinelas do relógio.** Nascem com o relógio da página sob
 *    controle da guarda e **adiantam meia hora de uma vez**, duas vezes, com
 *    os controles exercidos entre as duas. Todo `setTimeout`/`setInterval`
 *    agendado dispara, e a varredura é refeita.
 *
 * Em cada uma, três redes independentes:
 *
 *   1. **a varredura de Tab refeita** — a medida do PRODUTO: o teclado
 *      continua alcançando os 36 controles que a tela oferece?
 *   2. **a fotografia dos controles comparada** — quem mudou de contrato de
 *      foco (`tabindex`, `disabled`, `inert`, `hidden`, `aria-disabled`,
 *      `aria-hidden`), quem sumiu e quem apareceu;
 *   3. **o vigia dentro da página** — instalado antes da hidratação, ele
 *      intercepta a ESCRITA (setter de protótipo, `setAttribute` e um
 *      `MutationObserver`) e diz QUEM mudou, de quê para quê e AOS QUANTOS
 *      SEGUNDOS. É o que transforma "27 controles saíram do Tab" em "aos 3,0 s
 *      alguém escreveu tabindex 0→-1 em 27 botões de linha".
 *
 * ## QUAL É O ALCANCE DE TEMPO DESTAS MEDIDAS — dito por extenso
 *
 * ## [ALTO 1, rodada 16] AS SENTINELAS COBRIAM O RELÓGIO E NÃO COBRIAM O USO
 *
 * A rodada 15 fechou "a medida R olha um instante só" com duas sentinelas que
 * medem o TEMPO — e declarou, com todas as letras, que o CLIQUE ficava de
 * fora: *"a sentinela existe para observar, e clicar aqui abriria gaveta e
 * mudaria o estado que ela vigia"*. Declarar um vão é honesto e não o fecha, e
 * este ficava exatamente na interação principal da peça. O coordenador passou
 * pelos cinco portões com quatro linhas no produto:
 *
 *     const [jaAbriu, setJaAbriu] = useState(false);
 *     // em registrarBotaoLinha:  if (el !== null && jaAbriu) el.tabIndex = -1;
 *     // em alternarAtiva:        setJaAbriu(true);
 *
 *     ao abrir a página        : {"visiveis":36,"foraDoTab":0}
 *     depois de abrir 1 gaveta : {"visiveis":38,"foraDoTab":27}
 *     depois de fechar a gaveta: {"visiveis":36,"foraDoTab":27}
 *
 * O operador abre UMA tarefa e o teclado perde a lista inteira, para sempre.
 * É a **forma 5** do vício da casa: a cura da rodada 15 pegou o relógio, que
 * era o caso, e não o "depois", que é a classe.
 *
 * A saída não é clicar na sentinela que vigia o estado intocado — o argumento
 * dela continua de pé. A saída é uma TERCEIRA sentinela, **dedicada ao uso**:
 * ela abre a gaveta, fecha, troca o zoom, rola com a roda e abre de novo pelo
 * teclado — e **refaz a varredura de Tab depois de CADA uma**. A fotografia
 * comparada continua fazendo sentido na aba intocada (V e W); a alcançabilidade
 * por teclado passa a ser refeita DEPOIS DO USO (medida Y).
 *
 * ## QUAL É O ALCANCE DESTAS MEDIDAS — dito por extenso
 *
 * **O que está DENTRO:** qualquer coisa que tire um controle do alcance do
 * teclado, ou mude o contrato de foco dele, em `/linha-do-tempo`, nos dois
 * viewports de `VIEWPORTS_DO_TECLADO`, (a) a qualquer momento da vida real da
 * corrida — medido e impresso em cada medida V, piso escrito à mão de 30 s —,
 * (b) agendada para até **30 minutos** depois da carga, mais outros 30 minutos
 * depois de os controles serem exercidos (medida W), e (c) **causada pelo uso
 * da página** — as interações de `ROTEIRO_DE_USO`, piso escrito à mão de
 * `PISO_DE_INTERACOES`, cada uma com o efeito PROVADO antes de a varredura
 * valer, e o teclado remedido depois de cada uma (medida Y) — e, desde a
 * rodada 20, com o estado que cada uma deixa segurado por
 * `DURACAO_DA_AUSENCIA_MS` no relógio da página (dias, derivados do fonte).
 *
 * **E o (c) não é mais uma lista escrita à mão.** Desde a rodada 17 o roteiro
 * é conferido contra o INVENTÁRIO DE INTERAÇÕES lido da página viva — os
 * handlers que o React tem pendurados em cada nó, com o nome do componente
 * que os declarou, mais os três sinais de que a geometria depende da largura
 * (`ResizeObserver`, ouvinte de `resize`, `matchMedia`). Interação que o
 * produto oferece e o roteiro não exerce reprova COM NOME; passo do roteiro
 * que aponta para interação que o produto não oferece reprova também. Foi
 * assim que **redimensionar a janela** entrou: não porque alguém lembrou, mas
 * porque o produto olha a própria largura e o fecho cobrou.
 *
 * **O que está FORA, e não se finge o contrário:** (a) atraso maior que os dois
 * adiantamentos de meia hora da medida W; (b) mutação disparada por algo que o
 * relógio de mentira não controla e que só acontece depois do fim da guarda —
 * por exemplo a resposta de uma requisição de rede real que demore mais que
 * isso; (c) viewport fora de `VIEWPORTS_DO_TECLADO` e rota fora de
 * `/linha-do-tempo` — esta guarda visita uma rota só, e a medida X prova que
 * cada viewport visitado tem as suas TRÊS sentinelas, não que a guarda visita
 * tudo; (d) as três interações que o inventário achou e `ENTRADAS_DECLARADAS_FORA`
 * nomeia UMA A UMA, com motivo — clicar num link da navegação (sai da rota),
 * apontar o mouse sobre ele (pré-busca do `next/link`, que mora na outra rota)
 * e o `onTouchStart` dele (o Chromium desta guarda não emula dedo); **arrastar**
 * continua fora porque o inventário não acha nada arrastável nesta rota — e no
 * dia em que achar, o fecho cobra; (e) mutação num nó que ainda não entrou na
 * árvore — isso é montagem, não envelhecimento, e quem a mede é a FOTOGRAFIA
 * do nascimento, não o vigia.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** O que o PRODUTO declara ser um controle. `tabindex="-1"` é sabotagem, não definição. */
const SELETOR_DE_CONTROLE = "button, a[href]";

/** Os atributos que decidem se o teclado chega a um controle. */
const ATRIBUTOS_DO_FOCO = ["tabindex", "disabled", "inert", "hidden", "aria-disabled", "aria-hidden"];

/** O canal pelo qual o vigia entrega cada anotação AO NODE. */
const CANAL_DO_VIGIA_DE_FOCO = "__vigiaFocoP5Envia";

/** Viewports com sentinela. A medida X reprova se algum ficar sem as duas. */
const VIEWPORTS_DO_TECLADO = [
  [1440, 1000],
  [390, 844],
];

/** Piso de vida da sentinela de tempo real, escrito à mão — não derivado da corrida. */
const PISO_DE_VIDA_DA_SENTINELA_MS = 30000;

/** Quanto a medida W adianta o relógio de uma vez. É o alcance declarado. */
const ADIANTAMENTO_DO_RELOGIO_MS = 1800000;

/** Piso de controles visíveis por viewport — alvo ausente é reprovação, nunca aprovação. */
const PISO_DE_CONTROLES = 20;

/**
 * [ALTO 1] Piso, ESCRITO À MÃO, de interações reais que a sentinela de uso tem
 * de exercer em cada viewport. Derivar isto do tamanho do roteiro seria a
 * guarda contando a si mesma: esvaziar o roteiro deixaria a medida verde com
 * zero interação exercida. O número está aqui, e o roteiro tem de alcançá-lo.
 *
 * Rodada 17: de 5 para 10, com os cinco passos que o inventário lido do
 * produto cobrou — setas do teclado, legenda, barras do quadro e os dois de
 * redimensionar a janela.
 */
const PISO_DE_INTERACOES = 10;

/**
 * [MÉDIO, rodada 17] Piso, ESCRITO À MÃO, de ENTRADAS distintas que a leitura
 * do produto tem de achar nesta rota.
 *
 * É o contrapeso do fecho do inventário, e mora aqui — na medida X — porque
 * quem ele protege é a medida Y, e piso contado dentro da medida que ele
 * protege é a guarda contando a si mesma. Sem ele, uma leitura quebrada (as
 * chaves internas do React mudam de nome, a instrumentação da largura não
 * instala) devolveria zero entrada, o fecho ficaria satisfeito por ausência —
 * a forma 2 — e o portão diria verde.
 *
 * Rodada 18: a fonte de fora dos nós deixou de ser UM assunto (a largura) e
 * virou A CLASSE (tudo o que a página escuta em `window`, `document`,
 * `visualViewport`, `matchMedia` e `ResizeObserver`), então o piso sobe junto
 * — senão a generalização entraria valendo o mesmo número de antes, que é
 * outra forma de não medir.
 *
 * Medido nesta árvore, nos dois viewports: 16 entradas na carga (10 do React
 * + 6 de fora dos nós) e 17 depois de a gaveta abrir. O piso é o menor dos
 * dois, para que um roteiro interrompido não invente um segundo defeito.
 */
const PISO_DE_ENTRADAS = 16;

/**
 * [MÉDIO, rodada 18] E o piso, também escrito à mão, das entradas de FORA DOS
 * NÓS — as que o `VIGIA_DE_OUVINTES` lê.
 *
 * Existe separado porque as duas fontes quebram por motivos diferentes: as
 * chaves internas do React podem mudar de nome sem a instrumentação sofrer
 * nada, e a instrumentação pode deixar de instalar (ou o critério da pilha
 * passar a jogar o produto inteiro no balde do framework) sem o React mudar
 * nada. Um piso só esconderia a segunda falha atrás do número da primeira.
 *
 * Medido: 6 — `window | resize`, `window | scroll`, `window | keydown`,
 * `visualViewport | resize`, `matchMedia (min-width: 768px) | change` e
 * `ResizeObserver | observar`, todas de `linha-do-tempo.tsx`.
 */
const PISO_DE_OUVINTES_DO_PRODUTO = 5;

/**
 * Este corpo NÃO roda no Node: o Playwright o serializa e o executa dentro do
 * Chromium, antes de qualquer script da página (`addInitScript`). Por isso ele
 * fala com `window.` em tudo.
 */
function VIGIA_DO_FOCO(config) {
  const { canal, atributos, seletor } = config;
  /* Instalar duas vezes dobraria cada anotação — e contagem dobrada mente tanto quanto zerada. */
  if (Object.prototype.hasOwnProperty.call(window, "__vigiaFocoP5")) return;
  const inicio = Date.now();
  const anotacoes = [];
  let marcoMs = null;
  const enviar = typeof window[canal] === "function" ? window[canal] : null;
  const vigiados = new Set(atributos);

  const anotar = (rede, el, atributo, de, para) => {
    if (!(el instanceof Element)) return;
    if (String(de) === String(para)) return;
    /*
     * Nó que ainda não entrou na árvore é MONTAGEM, não envelhecimento: o
     * React escreve as props antes de inserir, e anotar isso acusaria o
     * produto por existir. O que o nó traz ao entrar é medido pela fotografia.
     */
    if (!el.isConnected) return;
    let casa = false;
    try {
      casa = el.matches(seletor);
    } catch {
      casa = false;
    }
    if (!casa) return;
    const m = {
      rede,
      atributo,
      de: String(de),
      para: String(para),
      alvo: `<${el.tagName.toLowerCase()}> "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 34)}"`,
      linha: el.getAttribute("data-lb-linha"),
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

  /* Rede 1 — o setter vivo do protótipo onde a propriedade mora de verdade. */
  const embrulharPropriedade = (proto, nome, atributo) => {
    if (!proto) return;
    const d = Object.getOwnPropertyDescriptor(proto, nome);
    if (d === undefined || typeof d.set !== "function" || typeof d.get !== "function") return;
    Object.defineProperty(proto, nome, {
      configurable: true,
      enumerable: d.enumerable,
      get: d.get,
      set(valor) {
        const de = d.get.call(this);
        d.set.call(this, valor);
        anotar("setter do protótipo", this, atributo, de, d.get.call(this));
      },
    });
  };
  embrulharPropriedade(window.HTMLElement?.prototype, "tabIndex", "tabindex");
  embrulharPropriedade(window.HTMLElement?.prototype, "inert", "inert");
  embrulharPropriedade(window.HTMLElement?.prototype, "hidden", "hidden");
  embrulharPropriedade(window.HTMLButtonElement?.prototype, "disabled", "disabled");

  /* Rede 2 — a escrita que não passa pela propriedade. */
  const set0 = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (nome, valor) {
    const chave = String(nome).toLowerCase();
    if (!vigiados.has(chave)) {
      set0.call(this, nome, valor);
      return;
    }
    const de = this.getAttribute(nome);
    set0.call(this, nome, valor);
    anotar("setAttribute", this, chave, de, this.getAttribute(nome));
  };
  const rem0 = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function (nome) {
    const chave = String(nome).toLowerCase();
    if (!vigiados.has(chave)) {
      rem0.call(this, nome);
      return;
    }
    const de = this.getAttribute(nome);
    rem0.call(this, nome);
    anotar("removeAttribute", this, chave, de, this.getAttribute(nome));
  };
  const tog0 = Element.prototype.toggleAttribute;
  Element.prototype.toggleAttribute = function (nome, forca) {
    const chave = String(nome).toLowerCase();
    if (!vigiados.has(chave)) return tog0.call(this, nome, forca);
    const de = this.getAttribute(nome);
    const r = tog0.call(this, nome, forca);
    anotar("toggleAttribute", this, chave, de, this.getAttribute(nome));
    return r;
  };

  /*
   * Rede 3 — o observador, que não depende de os dois embrulhos acima
   * sobreviverem: se alguém restaurar o protótipo original, a mutação ainda é
   * vista, porque `tabIndex`, `disabled`, `inert` e `hidden` refletem em
   * atributo.
   */
  const observador = new MutationObserver((registros) => {
    for (const r of registros) {
      if (r.type !== "attributes" || r.attributeName === null) continue;
      anotar(
        "MutationObserver",
        r.target,
        r.attributeName,
        r.oldValue,
        r.target.getAttribute(r.attributeName),
      );
    }
  });
  observador.observe(document, {
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: atributos,
  });

  window.__vigiaFocoP5 = {
    instalado: true,
    redes: ["setter do protótipo", "setAttribute/removeAttribute/toggleAttribute", "MutationObserver"],
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
async function lerVigiaDoFoco(pagina) {
  try {
    return await pagina.evaluate(() => {
      const v = window.__vigiaFocoP5;
      if (v === undefined || v === null) {
        return { instalado: false, redes: [], marco: null, vidaMs: 0, antes: 0, depois: [] };
      }
      return {
        instalado: v.instalado === true,
        redes: v.redes,
        marco: v.marco(),
        vidaMs: v.vidaMs(),
        antes: v.todas().length - v.depoisDoNascimento().length,
        depois: v.depoisDoNascimento(),
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
      quebrou: erro instanceof Error ? erro.message.split("\n")[0] : String(erro),
    };
  }
}


/**
 * ═══════════════════════════════════════════════════════════════════════════
 * [MÉDIO, rodada 17 · GENERALIZADO na rodada 18] O INVENTÁRIO DE INTERAÇÕES
 * É LIDO DO PRODUTO — E O QUE A PÁGINA ESCUTA FORA DOS NÓS É CLASSE, NÃO
 * ASSUNTO.
 *
 * O `ROTEIRO_DE_USO` da rodada 16 era uma lista de cinco passos escritos à
 * mão. Ele fechava a pergunta "o teclado sobrevive ao uso?" para as cinco
 * coisas que alguém lembrou de escrever — e **redimensionar a janela não era
 * uma delas**. A rodada 17 consertou isso derivando o inventário do produto,
 * em duas fontes: (a) os `on*` que o React pendura nos nós e (b) os sinais de
 * LARGURA (`ResizeObserver`, `resize`, `matchMedia`).
 *
 * **O vão que sobrou, e que o coordenador achou:** a fonte (b) foi escrita
 * para UM ASSUNTO (largura) em vez de para A CLASSE (tudo o que a página
 * escuta fora dos nós). `visibilitychange` — trocar de aba e voltar — não
 * aparecia uma vez sequer, e é coisa que o operador faz o tempo todo. A
 * sabotagem passou pelos cinco portões:
 *
 *     const [voltouDeOutraAba, setVoltouDeOutraAba] = useState(false);
 *     document.addEventListener("visibilitychange", () => {
 *       if (document.visibilityState === "visible") setVoltouDeOutraAba(true);
 *     });
 *     // em registrarBotaoLinha: if (el !== null && voltouDeOutraAba) el.tabIndex = -1;
 *
 *     aba em primeiro plano          : {"visiveis":36,"foraDoTab":0}
 *     depois de sair da aba e voltar : {"visiveis":36,"foraDoTab":27}
 *
 * É a **forma 5** (*confere o caso, não a classe*) dentro de uma cura da
 * **forma 3** (*universo por convenção*): a derivação existia, e cobria um
 * assunto.
 *
 * ## DE ONDE VEM O INVENTÁRIO, agora
 *
 * Do próprio produto, na página viva, em duas leituras independentes:
 *
 *  1. **Os handlers que o React tem pendurados em cada nó da árvore.** Cada nó
 *     hidratado carrega a chave `__reactProps$…` com as props daquele nó, e a
 *     `__reactFiber$…` com a fibra, de onde sai o NOME DO COMPONENTE que o
 *     renderizou. Cada par (componente × alvo × handler) é uma ENTRADA:
 *     `RotuloLinha | button | onClick`, `LinhaDoTempoView | div[role=region] |
 *     onKeyDown`, `Legenda | details | onToggle`. São chaves internas do
 *     React — e por isso **não decidem nada sozinhas**: se elas sumirem, o
 *     inventário vem vazio, o fecho ficaria verde por ausência, e é para isso
 *     que existem os pisos escritos à mão da medida X, que moram FORA da
 *     medida que eles protegem.
 *  2. **TUDO o que a página registra FORA dos nós** — `addEventListener` em
 *     `window`, em `document` e no `visualViewport`, `matchMedia(...)` e
 *     `ResizeObserver`. A instrumentação entra antes do primeiro script da
 *     página e anota cada registro como uma entrada
 *     `<arquivo> | <alvo> | <tipo>`, seja qual for o tipo: `resize`,
 *     `scroll`, `keydown`, `visibilitychange`, `hashchange`, `pointerdown`.
 *     Nada aqui é lista de assuntos: é a classe inteira.
 *     Medido nesta árvore, nos dois viewports, **6 entradas**:
 *     `linha-do-tempo.tsx | window | resize`, `… | window | scroll`,
 *     `… | window | keydown`, `… | visualViewport | resize`,
 *     `… | matchMedia (min-width: 768px) | change` e
 *     `… | ResizeObserver | observar`.
 *
 * ## O QUE É DO PRODUTO E O QUE É DO FRAMEWORK — critério DERIVADO
 *
 * Na mesma carga, o Next/React registra **146** ouvintes em `document` e
 * `window` (`click`, `keydown`, `drag*`, `transition*`, `popstate`…). Contar
 * todos afogaria o fecho em ruído que ninguém desta peça escreveu. A separação
 * **não é uma lista de exceções escrita à mão**: é a PILHA de quem registrou.
 * A instrumentação lê o primeiro quadro com endereço de arquivo e pergunta uma
 * coisa só — esse arquivo mora em `node_modules`? Se mora, é framework e não
 * entra. Medido: 146 de 161 registros caem por esse critério, e os 15 que
 * sobram apontam todos para `./src/components/timeline/linha-do-tempo.tsx`.
 *
 * ## COMO SE PROVA QUE UMA ENTRADA DESTAS FOI EXERCIDA
 *
 * Não por declaração: **pelo ouvinte ter rodado**. A instrumentação embrulha
 * cada ouvinte do produto num contador; exercer é ver o contador subir.
 *
 * **Rodada 19: o inventário deixou de ser o GATILHO.** Até a rodada 18 os
 * passos de fora dos nós nasciam do inventário — ouvinte que a vigia não via
 * não ganhava passo, e o dano não era provocado (a forma 2). Agora os
 * estímulos do navegador (`ESTIMULOS_DO_NAVEGADOR`) rodam TODOS, SEMPRE, e o
 * inventário serve só ao fecho: ouvinte do produto que nenhum estímulo acordou
 * reprova nomeando o tipo, a menos que alguém o declare fora com motivo. A
 * vigia lê também as propriedades `on*` de `window` e `document` (a porta que
 * a rodada 18 não via), com o mesmo critério da pilha e o mesmo contador.
 *
 * **O que esta régua NÃO promete, dito de frente:** "o ouvinte rodou" não
 * distingue quem o acordou. Medido nesta rodada com uma sabotagem própria: um
 * `devicemotion` registrado e nunca dirigido apareceu como `1r/1c`, porque o
 * próprio Chromium dispara o primeiro evento desse tipo ao registrar. Então
 * evento que a plataforma produz sozinha conta como exercido sem passo
 * nenhum. Isso não abre buraco no que a medida Y mede — o Tab é remedido
 * depois de CADA passo e no nascimento da sentinela, então dano causado por um
 * evento espontâneo cai na varredura seguinte de qualquer jeito —, mas quem
 * ler "14 exercidas" precisa saber que a conta é essa. A sabotagem que fecha a
 * outra ponta usa `fullscreenchange`, que não dispara sozinho: ali o fecho
 * reprova nomeando o tipo.
 *
 * O inventário é relido DEPOIS DE CADA PASSO e acumulado — senão ele seria a
 * forma 4 (*mede um instante só*): o botão "fechar" da gaveta
 * (`CabecalhoDoDetalhe | button | onClick`) só existe depois que alguém abre
 * a gaveta.
 *
 * ## O FECHO, NOS DOIS SENTIDOS
 *
 *  - entrada que o produto oferece, nenhum passo EXERCIDO cobre e ninguém
 *    declarou fora → **reprova, nomeando a entrada** (para as de fora dos nós,
 *    "exercer" é o contador do ouvinte ter subido);
 *  - passo do roteiro que diz cobrir uma entrada que o produto não oferece em
 *    lugar nenhum desta rota → **reprova** (declaração morta);
 *  - entrada declarada fora que o produto não oferece → **reprova** (exclusão
 *    morta: texto que descreve um produto que não existe mais).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Onde a instrumentação dos ouvintes guarda o que viu, dentro da página. */
const CANAL_DOS_OUVINTES = "__ouvintesDoProdutoP5";

/**
 * Instalada ANTES do primeiro script da página. Não mede teclado nem contrato
 * de foco: mede o que a página **escuta fora dos nós** — `window`, `document`,
 * `visualViewport`, `matchMedia` e `ResizeObserver` —, de quem é cada registro
 * (pela pilha) e quantas vezes cada ouvinte do PRODUTO de fato rodou.
 */
function VIGIA_DE_OUVINTES(chave) {
  if (Object.prototype.hasOwnProperty.call(window, chave)) return;
  const tabela = new Map();
  /* ouvinte → (alvo|tipo → embrulho). A chave composta é obrigatória: o
     produto registra a MESMA função em `window` e no `visualViewport`, e um
     embrulho só faria um dos dois contar — e faria `removeEventListener`
     errar o alvo, deixando ouvinte vivo depois do desmonte. */
  const embrulhos = new WeakMap();
  Object.defineProperty(window, chave, {
    value: { tabela },
    writable: false,
    configurable: false,
    enumerable: false,
  });
  /* O primeiro quadro da pilha que tem endereço de arquivo: quem registrou. */
  const quemRegistrou = () => {
    for (const linha of String(new Error().stack ?? "").split("\n")) {
      const limpa = linha.trim().replace(/\)\s*$/, "");
      const achado = /(webpack-internal:\/\/\/.+|blob:\S+|https?:\/\/\S+)$/.exec(limpa);
      if (achado === null) continue;
      const u = achado[1];
      if (u.includes("<anonymous>")) continue;
      return u;
    }
    return "";
  };
  /* O critério derivado: mora em `node_modules` = framework, não entra. */
  const doFramework = (u) => u === "" || u.includes("node_modules/");
  const arquivoDe = (u) => {
    const sem = u.replace(/[?#].*$/, "").replace(/:\d+:\d+$/, "");
    const pedaco = sem.split("/").filter((p) => p !== "").pop();
    return pedaco === undefined || pedaco === "" ? "produto" : pedaco;
  };
  const entrada = (chaveDaEntrada) => {
    let e = tabela.get(chaveDaEntrada);
    if (e === undefined) {
      e = { registros: 0, chamadas: 0 };
      tabela.set(chaveDaEntrada, e);
    }
    return e;
  };
  const vigiar = (nomeDoAlvo, alvo) => {
    if (alvo === null || alvo === undefined) return;
    if (typeof alvo.addEventListener !== "function") return;
    if (typeof alvo.removeEventListener !== "function") return;
    const registrar = alvo.addEventListener.bind(alvo);
    const apagar = alvo.removeEventListener.bind(alvo);
    alvo.addEventListener = function (tipo, ouvinte, opcoes) {
      const quem = quemRegistrou();
      if (doFramework(quem) || typeof ouvinte !== "function") {
        return registrar(tipo, ouvinte, opcoes);
      }
      const e = entrada(`${arquivoDe(quem)} | ${nomeDoAlvo} | ${String(tipo)}`);
      e.registros += 1;
      const id = `${nomeDoAlvo}|${String(tipo)}`;
      let porAlvo = embrulhos.get(ouvinte);
      if (porAlvo === undefined) {
        porAlvo = new Map();
        embrulhos.set(ouvinte, porAlvo);
      }
      let embrulho = porAlvo.get(id);
      if (embrulho === undefined) {
        embrulho = function (...argumentos) {
          e.chamadas += 1;
          return ouvinte.apply(this, argumentos);
        };
        porAlvo.set(id, embrulho);
      }
      return registrar(tipo, embrulho, opcoes);
    };
    alvo.removeEventListener = function (tipo, ouvinte, opcoes) {
      const id = `${nomeDoAlvo}|${String(tipo)}`;
      const embrulho =
        typeof ouvinte === "function" ? embrulhos.get(ouvinte)?.get(id) : undefined;
      return apagar(tipo, embrulho ?? ouvinte, opcoes);
    };
  };
  vigiar("window", window);
  vigiar("document", document);
  vigiar("visualViewport", window.visualViewport);
  /*
   * [MÉDIO, rodada 19] A outra porta do mesmo registro: a PROPRIEDADE
   * (`document.onvisibilitychange = fn`). Cada `on*` de `window` e `document`
   * ganha, na instância, um acessor que anota quem atribuiu (mesmo critério
   * da pilha) e embrulha a função num contador — e devolve a função ORIGINAL
   * a quem ler a propriedade. Isto alimenta o FECHO; o estímulo não depende
   * disto (ver `ESTIMULOS_DO_NAVEGADOR`).
   */
  const vigiarPropriedades = (nomeDoAlvo, alvo) => {
    const nomes = new Set();
    for (let o = alvo; o !== null; o = Object.getPrototypeOf(o)) {
      for (const n of Object.getOwnPropertyNames(o)) if (/^on[a-z]+$/.test(n)) nomes.add(n);
    }
    for (const n of nomes) {
      let dono = alvo;
      let d;
      while (dono !== null && (d = Object.getOwnPropertyDescriptor(dono, n)) === undefined) {
        dono = Object.getPrototypeOf(dono);
      }
      if (d === undefined || typeof d.get !== "function" || typeof d.set !== "function") continue;
      if (dono === alvo && d.configurable !== true) continue;
      const originais = new WeakMap();
      const tipo = n.slice(2);
      Object.defineProperty(alvo, n, {
        configurable: true,
        enumerable: d.enumerable,
        get() {
          const v = d.get.call(this);
          return typeof v === "function" && originais.has(v) ? originais.get(v) : v;
        },
        set(valor) {
          const quem = quemRegistrou();
          if (typeof valor !== "function" || doFramework(quem)) {
            d.set.call(this, valor);
            return;
          }
          const e = entrada(`${arquivoDe(quem)} | ${nomeDoAlvo}.${n} | ${tipo}`);
          e.registros += 1;
          const embrulho = function (...argumentos) {
            e.chamadas += 1;
            return valor.apply(this, argumentos);
          };
          originais.set(embrulho, valor);
          d.set.call(this, embrulho);
        },
      });
    }
  };
  vigiarPropriedades("window", window);
  vigiarPropriedades("document", document);
  const consultar = typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : null;
  if (consultar !== null) {
    window.matchMedia = function (consulta) {
      const lista = consultar(consulta);
      vigiar(`matchMedia ${String(consulta)}`, lista);
      return lista;
    };
  }
  const RO = window.ResizeObserver;
  if (typeof RO === "function") {
    window.ResizeObserver = class extends RO {
      constructor(retorno) {
        const quem = quemRegistrou();
        if (doFramework(quem) || typeof retorno !== "function") {
          super(retorno);
          this.__entradaDoP5 = null;
          return;
        }
        const e = entrada(`${arquivoDe(quem)} | ResizeObserver | observar`);
        super((...argumentos) => {
          e.chamadas += 1;
          return retorno(...argumentos);
        });
        this.__entradaDoP5 = e;
      }
      observe(alvo, opcoes) {
        if (this.__entradaDoP5 !== null && this.__entradaDoP5 !== undefined) {
          this.__entradaDoP5.registros += 1;
        }
        return super.observe(alvo, opcoes);
      }
    };
  }
}

/**
 * Lê, da página viva, TODA interação que o produto oferece nesta rota — as dos
 * NÓS (props do React) e as de FORA dos nós (o que a página escuta em
 * `window`, `document`, `visualViewport`, `matchMedia` e `ResizeObserver`).
 * Devolve também quantos nós tinham props do React — é o que separa
 * "inventário vazio porque a página não oferece nada" de "inventário vazio
 * porque a leitura quebrou".
 */
async function inventariarEntradas(pagina) {
  return await pagina.evaluate((chaveDoCanal) => {
    const interno = (el, prefixo) => {
      for (const k of Object.keys(el)) if (k.startsWith(prefixo)) return el[k];
      return null;
    };
    /* De qual COMPONENTE do produto é este nó: sobe a fibra até achar função com nome. */
    const dono = (el) => {
      let f = interno(el, "__reactFiber$");
      let n = 0;
      while (f !== null && f !== undefined && n < 80) {
        if (typeof f.type === "function" && typeof f.type.name === "string" && f.type.name !== "") {
          return f.type.name;
        }
        f = f.return;
        n += 1;
      }
      return null;
    };
    const entradas = new Map();
    let nosComProps = 0;
    for (const el of document.querySelectorAll("*")) {
      const props = interno(el, "__reactProps$");
      if (props === null || typeof props !== "object") continue;
      nosComProps += 1;
      const papel = el.getAttribute("role");
      const alvo = `${el.tagName.toLowerCase()}${papel === null ? "" : `[role=${papel}]`}`;
      const quem = dono(el);
      for (const nome of Object.keys(props)) {
        if (!/^on[A-Z]/.test(nome)) continue;
        if (typeof props[nome] !== "function") continue;
        const chave = `${quem === null ? "?" : quem} | ${alvo} | ${nome}`;
        entradas.set(chave, (entradas.get(chave) ?? 0) + 1);
      }
    }
    /*
     * [MÉDIO, rodada 18] A CLASSE INTEIRA do que a página escuta fora dos nós.
     * Não é uma lista de assuntos: é o que o produto REGISTROU, qualquer que
     * seja o tipo, com quantas vezes cada ouvinte já rodou — o número que
     * prova "exercido" sem ninguém precisar declarar nada.
     */
    const vigia = window[chaveDoCanal] ?? null;
    const ouvintes =
      vigia === null
        ? []
        : [...vigia.tabela].map(([chave, e]) => ({
            chave,
            registros: e.registros,
            chamadas: e.chamadas,
          }));
    for (const o of ouvintes) entradas.set(o.chave, o.registros);
    return {
      entradas: [...entradas].map(([chave, quantos]) => ({ chave, quantos })),
      nosComProps,
      ouvintesInstrumentados: vigia !== null,
      ouvintes,
    };
  }, CANAL_DOS_OUVINTES);
}

/** As entradas de FORA dos nós, em uma linha de gente. */
function descreverOuvintes(ouvintes) {
  if (ouvintes.length === 0) return "nenhum ouvinte do produto fora dos nós";
  return ouvintes
    .map((o) => `${o.chave} (${String(o.registros)}r/${String(o.chamadas)}c)`)
    .join(" + ");
}

/**
 * A FAMÍLIA DE LARGURA, derivada do que foi lido — e não de uma lista de
 * assuntos: é ouvinte de `resize` (em qualquer alvo), `ResizeObserver` ou
 * `matchMedia`. A medida X exige que ela exista, porque é dela que os passos
 * de redimensionar tiram o direito de existir.
 */
function ehDaFamiliaDaLargura(chave) {
  const partes = chave.split(" | ");
  const alvo = partes[1] ?? "";
  const tipo = partes[2] ?? "";
  return tipo === "resize" || alvo === "ResizeObserver" || alvo.startsWith("matchMedia");
}

/**
 * O inventário ACUMULADO de tudo o que o produto ofereceu em qualquer estado
 * de qualquer sentinela de interação. Alimenta o piso da medida X — que é
 * onde ele é contado, FORA da medida Y que ele protege.
 */
const ENTRADAS_DO_PRODUTO = new Map();
function registrarEntradasDoProduto(entradas, onde) {
  for (const e of entradas) {
    const antes = ENTRADAS_DO_PRODUTO.get(e.chave);
    if (antes === undefined) ENTRADAS_DO_PRODUTO.set(e.chave, { quantos: e.quantos, onde });
    else if (e.quantos > antes.quantos) antes.quantos = e.quantos;
  }
}

/**
 * [MÉDIO, rodada 18] E, em separado, só as entradas de FORA DOS NÓS. Elas
 * alimentam o segundo piso da medida X — contado, como o outro, FORA da
 * medida Y que ele protege.
 */
const OUVINTES_DO_PRODUTO = new Set();
function registrarOuvintesDoProduto(ouvintes) {
  for (const o of ouvintes) OUVINTES_DO_PRODUTO.add(o.chave);
}

/**
 * [MÉDIO] O QUE FICA FORA DO ROTEIRO — nomeado um a um, com motivo.
 *
 * Esta lista é a outra metade do fecho: o que o produto oferece e a guarda
 * decidiu NÃO exercer. Ficar fora é uma decisão declarada, nunca um
 * esquecimento — e entrada daqui que o produto não oferecer mais também
 * reprova, para a lista não virar folclore.
 */
const ENTRADAS_DECLARADAS_FORA = [
  {
    chave: "LinkComponent | a | onClick",
    porque:
      "clicar num link da navegação SAI de /linha-do-tempo, e a rota é o alcance declarado desta guarda — o que acontece do outro lado é assunto da peça de lá",
  },
  {
    chave: "LinkComponent | a | onMouseEnter",
    porque:
      "apontar o mouse sobre um link da navegação: o handler é do `next/link` (pré-busca da OUTRA rota), não do produto desta peça, e a consequência dele mora fora desta rota",
  },
  {
    chave: "LinkComponent | a | onTouchStart",
    porque:
      "toque em tela sensível — o Chromium desta guarda não emula dedo; já era o que o cabeçalho declarava fora, agora com a entrada nomeada",
  },
];

/**
 * Fotografa o que o produto DECLARA ser controle e o contrato de foco de cada
 * um, com uma identidade estável no tempo (nada de posição no documento: se o
 * sabotador some com um controle, a posição de todos os outros anda junto).
 */
async function fotografarControles(pagina) {
  return await pagina.evaluate((seletor) => {
    const contagem = new Map();
    const visivel = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    const saida = [];
    let n = 0;
    for (const el of document.querySelectorAll(seletor)) {
      if (!visivel(el)) continue;
      n += 1;
      /* A marca da varredura desta vez — casa o que o Tab achar com esta lista. */
      el.setAttribute("data-lb-foco", String(n));
      const nome = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40);
      const base = `${el.tagName.toLowerCase()}|${el.getAttribute("data-lb-linha") ?? ""}|${nome}`;
      const vez = (contagem.get(base) ?? 0) + 1;
      contagem.set(base, vez);
      saida.push({
        id: `${base}#${String(vez)}`,
        chave: String(n),
        linha: el.getAttribute("data-lb-linha"),
        nome,
        tag: el.tagName.toLowerCase(),
        tabindex: el.getAttribute("tabindex"),
        tabIndexVivo: el.tabIndex,
        desabilitado: el.disabled === true,
        ariaDesabilitado: el.getAttribute("aria-disabled"),
        ariaEscondido: el.getAttribute("aria-hidden"),
        inerte: el.inert === true || el.closest("[inert]") !== null,
        escondido: el.hasAttribute("hidden"),
      });
    }
    return saida;
  }, SELETOR_DE_CONTROLE);
}

/** Os campos da fotografia que decidem se o teclado chega ao controle. */
const CAMPOS_DO_CONTRATO_DE_FOCO = [
  "tabindex",
  "tabIndexVivo",
  "desabilitado",
  "ariaDesabilitado",
  "ariaEscondido",
  "inerte",
  "escondido",
];

/**
 * A varredura de Tab DE VERDADE, a partir do começo do documento. O universo é
 * o que o produto declara ser controle — nunca derivado de `[tabindex]`, que é
 * a forma 3 do vício (`tabIndex={-1}` tiraria o elemento das duas contas ao
 * mesmo tempo e a razão continuaria 100%).
 */
async function varrerTeclado(pagina) {
  const universo = await fotografarControles(pagina);
  await pagina.evaluate(() => {
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
  });
  const alcancados = new Set();
  const limite = universo.length + 12;
  for (let i = 0; i < limite; i += 1) {
    await pagina.keyboard.press("Tab");
    const chave = await pagina.evaluate(
      () => document.activeElement?.getAttribute?.("data-lb-foco") ?? null,
    );
    if (chave !== null) {
      if (alcancados.has(chave)) break; /* deu a volta */
      alcancados.add(chave);
    }
  }
  const faltando = universo.filter((c) => !alcancados.has(c.chave));
  return {
    universo,
    alcancadosIds: universo.filter((c) => alcancados.has(c.chave)).map((c) => c.id),
    faltando,
    linhas: universo.filter((c) => c.linha !== null).length,
  };
}

/** Os eventos que a sentinela dispara em cada controle. */
const EVENTOS_EXERCIDOS = [
  "pointerover",
  "pointerenter",
  "pointerdown",
  "pointerup",
  "mouseover",
  "mousedown",
  "mouseup",
  "keydown",
  "keyup",
];

/**
 * Exerce todo controle da página: foco de verdade + uma bateria de eventos.
 * Sem isto, um handler que só passa a existir com o tempo (instalado por um
 * `setTimeout` que acabou de disparar) nunca teria quem o acordasse — é o erro
 * que a peça P6 mediu na rodada 16. O CLIQUE fica de fora de propósito:
 * apertar um botão aqui abriria a gaveta e mudaria o estado que a sentinela
 * vigia.
 */
async function exercitarControles(pagina) {
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
          if (nome.startsWith("key")) ev = new KeyboardEvent(nome, { key: "Shift", bubbles: true });
          else if (nome.startsWith("pointer")) ev = new PointerEvent(nome, { bubbles: true });
          else ev = new MouseEvent(nome, { bubbles: true });
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
    { seletor: SELETOR_DE_CONTROLE, eventos: EVENTOS_EXERCIDOS },
  );
}

/** Quantos toques de Tab a sentinela dá antes de desistir de achar um botão de linha. */
const PASSOS_DE_TAB_ATE_UMA_LINHA = 120;

/**
 * Espera a página MUDAR de verdade depois de uma ação, e só então volta.
 *
 * Existe por causa da corrida que a rodada 16 mediu e `abrir` já trata na
 * carga: por quase meio segundo a página fica **parada e errada**, e uma
 * espera só por quietude aprovaria esse estado. Aqui é o mesmo risco por
 * outra porta — depois de um `setViewportSize`, o `ResizeObserver` ainda não
 * correu, a tela está quieta e ainda é a de antes. Então a régua é a mudança,
 * não a quietude: assenta, relê, e insiste até o retrato sair diferente ou o
 * teto estourar. Não mudou nunca = efeito nenhum, e quem diz isso é o passo.
 */
async function esperarRetratoMudar(pagina, ler, antes) {
  const fim = Date.now() + TETO_DE_ACAO_MS;
  let agora = antes;
  while (Date.now() < fim) {
    await assentar(pagina);
    agora = await ler();
    if (agora !== antes) return agora;
    await esperarComORelogioDaPagina(pagina, INTERVALO_DE_ASSENTO_MS);
  }
  return agora;
}

/** A geometria que depende da largura, em uma linha: janela | escala rolável | x do "Hoje". */
async function retratoDaLargura(pagina) {
  return await pagina.evaluate((regiao) => {
    const el = document.querySelector(regiao);
    const hoje = document.querySelector(".lb-tl-hoje");
    return [
      `janela ${String(Math.round(window.innerWidth))}px`,
      el === null ? "-" : `escala ${String(el.scrollWidth)}/${String(el.clientWidth)}`,
      hoje === null ? "-" : `hoje em ${String(Math.round(hoje.getBoundingClientRect().left))}`,
    ].join(" · ");
  }, REGIAO_DO_QUADRO);
}

/**
 * A OUTRA largura declarada em `VIEWPORTS_DO_TECLADO`. Redimensionar para uma
 * largura que a guarda já visita mantém a medida dentro do alcance declarado:
 * nenhuma varredura acontece numa largura que ninguém prometeu cobrir.
 */
function outraLarguraDeclarada(largura) {
  const outras = VIEWPORTS_DO_TECLADO.map(([l]) => l).filter((l) => l !== largura);
  return outras[0] ?? Math.max(360, Math.round(largura * 0.6));
}

/** Redimensiona a janela e devolve o efeito PROVADO — geometria que mudou, ou nada. */
async function trocarALarguraDaJanela(pagina, sentinela, largura) {
  const antes = await retratoDaLargura(pagina);
  await precondicao(`levar a janela a ${String(largura)}px de largura`, async () => {
    await pagina.setViewportSize({ width: largura, height: sentinela.altura });
  });
  const depois = await esperarRetratoMudar(pagina, async () => await retratoDaLargura(pagina), antes);
  return { ok: depois !== antes, dito: `${antes}  →  ${depois}` };
}

/**
 * [ALTO 1, rodada 16 · MÉDIO, rodada 17] AS INTERAÇÕES DE VERDADE — a
 * sentinela de uso USA a página.
 *
 * Cada passo faz UMA coisa com mouse, teclado ou a moldura da janela (nada de
 * evento sintético: isto não é `exercitarControles`) e **prova que ela
 * aconteceu**. A prova não é decoração: interação que não muda nada deixaria
 * a varredura seguinte medir a mesma tela de sempre e aprovar por ausência.
 * Passo sem efeito é PRECONDIÇÃO falha, com nome — nunca um verde.
 *
 * `cobre` é o outro lado do contrato: diz QUAIS entradas do inventário lido do
 * produto este passo exerce. Entrada oferecida e não coberta reprova; `cobre`
 * que aponta para entrada inexistente também.
 */
const ROTEIRO_DE_USO = [
  {
    nome: "abrir a gaveta de uma linha com um CLIQUE de verdade",
    cobre: ["RotuloLinha | button | onClick"],
    async fazer(pagina) {
      await clicar(
        pagina.locator("button[data-lb-linha]").first(),
        "clicar no 1º botão de linha da coluna",
      );
      await esperarSeletor(pagina, "[data-lb-detalhe]", "a gaveta aparecer depois do clique");
      await assentar(pagina);
      const n = await pagina.evaluate(() => document.querySelectorAll("[data-lb-detalhe]").length);
      return { ok: n === 1, dito: `${String(n)} gaveta(s) na tela` };
    },
  },
  {
    nome: 'fechar a gaveta pelo botão "fechar" dela',
    cobre: ["CabecalhoDoDetalhe | button | onClick"],
    async fazer(pagina) {
      await clicar(
        pagina.locator("[data-lb-detalhe] button").first(),
        'clicar no botão "fechar" da gaveta',
      );
      await esperarSeletor(pagina, "[data-lb-detalhe]", "a gaveta sumir depois do fechar", {
        state: "detached",
      });
      await assentar(pagina);
      const n = await pagina.evaluate(() => document.querySelectorAll("[data-lb-detalhe]").length);
      return { ok: n === 0, dito: `${String(n)} gaveta(s) na tela` };
    },
  },
  {
    nome: "abrir a gaveta pelo TECLADO (Tab até um botão de linha + Enter)",
    cobre: ["RotuloLinha | button | onClick"],
    async fazer(pagina) {
      await precondicao("levar o foco a um botão de linha SÓ com Tab e apertar Enter", async () => {
        await pagina.evaluate(() => {
          document.body.setAttribute("tabindex", "-1");
          document.body.focus();
        });
        let chegou = false;
        for (let i = 0; i < PASSOS_DE_TAB_ATE_UMA_LINHA && !chegou; i += 1) {
          await pagina.keyboard.press("Tab");
          chegou = await pagina.evaluate(
            () => document.activeElement?.hasAttribute?.("data-lb-linha") === true,
          );
        }
        if (!chegou) {
          throw new Error(
            `o Tab não chegou a nenhum botão de linha em ${String(PASSOS_DE_TAB_ATE_UMA_LINHA)} toques`,
          );
        }
        await pagina.keyboard.press("Enter");
      });
      await esperarSeletor(pagina, "[data-lb-detalhe]", "a gaveta aparecer depois do Enter");
      await assentar(pagina);
      const n = await pagina.evaluate(() => document.querySelectorAll("[data-lb-detalhe]").length);
      return { ok: n === 1, dito: `${String(n)} gaveta(s) na tela depois do Enter` };
    },
  },
  {
    nome: 'trocar o zoom da escala para "Semana"',
    cobre: ["LinhaDoTempoView | button | onClick"],
    async fazer(pagina) {
      const antes = await pagina.evaluate(
        (sel) => document.querySelector(sel)?.scrollWidth ?? 0,
        REGIAO_DO_QUADRO,
      );
      await clicar(
        pagina.locator('button[aria-label="Semana"]').first(),
        'clicar no botão de zoom "Semana"',
      );
      await assentar(pagina);
      const r = await pagina.evaluate(
        (sel) => ({
          largura: document.querySelector(sel)?.scrollWidth ?? 0,
          pressionado: document.querySelector('button[aria-label="Semana"]')?.getAttribute("aria-pressed") ?? "",
        }),
        REGIAO_DO_QUADRO,
      );
      return {
        ok: r.pressionado === "true" && r.largura !== antes,
        dito: `aria-pressed="${r.pressionado}", largura rolável ${String(antes)} → ${String(r.largura)} px`,
      };
    },
  },
  {
    nome: "rolar o quadro com a roda do mouse",
    cobre: ["LinhaDoTempoView | div[role=region] | onScroll"],
    async fazer(pagina) {
      /*
       * A direção NÃO é fixa. Medido a 1440×1000 depois do zoom "Semana": o
       * quadro nasce ancorado em "hoje", que ali é o FIM da escala — rolar
       * para a direita não anda um pixel (`scrollLeft 2936 → 2936`), e uma
       * interação que não acontece deixaria a varredura seguinte medir a mesma
       * tela de sempre. Rola-se para onde há espaço, e o que prova que a
       * página se mexeu não é só o número do navegador: é a BARRA andando na
       * tela.
       */
      const ler = async () =>
        await pagina.evaluate((sel) => {
          const el = document.querySelector(sel);
          const barra = document.querySelector("[data-lb-barra]");
          return {
            esquerda: Math.round(el?.scrollLeft ?? -1),
            maximo: Math.round((el?.scrollWidth ?? 0) - (el?.clientWidth ?? 0)),
            xDaBarra: barra === null ? null : Math.round(barra.getBoundingClientRect().left),
          };
        }, REGIAO_DO_QUADRO);
      const antes = await ler();
      const passo = antes.esquerda >= antes.maximo - 4 ? -600 : 600;
      await precondicao("rolar o quadro com a roda do mouse", async () => {
        await pagina.locator(REGIAO_DO_QUADRO).first().hover({ timeout: TETO_DE_ACAO_MS });
        /* Roda horizontal primeiro; o Chromium converte a vertical em
           horizontal só quando o elemento não rola em pé — não se aposta nisso. */
        await pagina.mouse.wheel(passo, 0);
      });
      await assentar(pagina);
      let depois = await ler();
      if (depois.esquerda === antes.esquerda) {
        await pagina.mouse.wheel(0, passo);
        await assentar(pagina);
        depois = await ler();
      }
      const barraAndou =
        antes.xDaBarra !== null && depois.xDaBarra !== null && antes.xDaBarra !== depois.xDaBarra;
      return {
        ok: depois.esquerda !== antes.esquerda && barraAndou,
        dito: `scrollLeft ${String(antes.esquerda)} → ${String(depois.esquerda)} (máx ${String(antes.maximo)}), 1ª barra na tela ${String(antes.xDaBarra)} → ${String(depois.xDaBarra)} px`,
      };
    },
  },
  {
    /*
     * [MÉDIO] A região do quadro declara `onKeyDown` — setas, Home, End e `H`
     * rolam a escala. Era uma entrada do produto que nenhum dos cinco passos
     * da rodada 16 exercia: o teste de CLASSE desta rodada arma a mesma
     * armadilha do coordenador aqui, e a guarda a pega pelo mesmo caminho.
     */
    nome: "rolar o quadro com as SETAS do teclado (Home/End na região focada)",
    cobre: ["LinhaDoTempoView | div[role=region] | onKeyDown"],
    async fazer(pagina) {
      const ler = async () =>
        await pagina.evaluate((sel) => {
          const el = document.querySelector(sel);
          return {
            esquerda: Math.round(el?.scrollLeft ?? -1),
            maximo: Math.round((el?.scrollWidth ?? 0) - (el?.clientWidth ?? 0)),
          };
        }, REGIAO_DO_QUADRO);
      const antes = await ler();
      const primeira = antes.esquerda > 2 ? "Home" : "End";
      const segunda = primeira === "Home" ? "End" : "Home";
      let usada = primeira;
      await precondicao("levar o foco à região do quadro e apertar as setas", async () => {
        await pagina.locator(REGIAO_DO_QUADRO).first().focus({ timeout: TETO_DE_ACAO_MS });
        const focou = await pagina.evaluate(
          (sel) => document.activeElement === document.querySelector(sel),
          REGIAO_DO_QUADRO,
        );
        if (!focou) throw new Error("a região do quadro não aceitou o foco do teclado");
        await pagina.keyboard.press(primeira);
      });
      await assentar(pagina);
      let depois = await ler();
      if (depois.esquerda === antes.esquerda) {
        usada = segunda;
        await pagina.keyboard.press(segunda);
        await assentar(pagina);
        depois = await ler();
      }
      return {
        ok: depois.esquerda !== antes.esquerda,
        dito: `tecla ${usada} com a região focada: scrollLeft ${String(antes.esquerda)} → ${String(depois.esquerda)} (máx ${String(antes.maximo)})`,
      };
    },
  },
  {
    /*
     * [MÉDIO] O `<details>` da legenda: `Legenda | details | onToggle`. A
     * legenda nasce ABERTA a partir de 768px e FECHADA abaixo disso, então o
     * passo não presume o sentido — ele exige que o estado TROQUE e que os
     * itens apareçam ou sumam da tela junto.
     */
    nome: "alternar a legenda de símbolos (<details>)",
    cobre: ["Legenda | details | onToggle"],
    async fazer(pagina) {
      const ler = async () =>
        await pagina.evaluate(() => {
          const d = document.querySelector("details.lb-tl-legenda");
          if (d === null) return "sem legenda na tela";
          const itens = [...d.querySelectorAll('[role="listitem"]')].filter(
            (el) => el.getBoundingClientRect().height > 0,
          ).length;
          return `${d.open ? "aberta" : "fechada"} com ${String(itens)} item(ns) desenhado(s)`;
        });
      const antes = await ler();
      await clicar(
        pagina.locator("details.lb-tl-legenda summary").first(),
        "clicar no resumo da legenda",
      );
      const depois = await esperarRetratoMudar(pagina, ler, antes);
      return { ok: depois !== antes, dito: `legenda ${antes} → ${depois}` };
    },
  },
  {
    /*
     * [MÉDIO] As BARRAS do quadro são outra família de clique
     * (`BarraAssunto` e `BarraTarefa`), com componente próprio — e o roteiro
     * da rodada 16 só clicava no RÓTULO da coluna. Duas entradas, um passo,
     * porque a prova é a mesma: a gaveta tem de mudar as duas vezes.
     */
    nome: "clicar nas BARRAS do quadro (uma de assunto e uma de tarefa)",
    cobre: ["BarraAssunto | div | onClick", "BarraTarefa | div | onClick"],
    async fazer(pagina) {
      const ler = async () =>
        await pagina.evaluate(() => {
          const g = document.querySelector("[data-lb-detalhe]");
          return g === null ? "sem gaveta" : `gaveta "${(g.textContent ?? "").trim().slice(0, 34)}"`;
        });
      const antes = await ler();
      await clicar(
        pagina.locator('[data-lb-barra="assunto"]').first(),
        "clicar numa barra de ASSUNTO dentro do quadro",
      );
      const meio = await esperarRetratoMudar(pagina, ler, antes);
      await clicar(
        pagina.locator('[data-lb-barra="tarefa"]').first(),
        "clicar numa barra de TAREFA dentro do quadro",
      );
      const depois = await esperarRetratoMudar(pagina, ler, meio);
      return { ok: meio !== antes && depois !== meio, dito: `${antes} → ${meio} → ${depois}` };
    },
  },
  {
    /*
     * [MÉDIO, rodada 17] REDIMENSIONAR A JANELA.
     *
     * O produto mede o próprio painel com `ResizeObserver`, ouve `resize` e
     * consulta `matchMedia` — quatro entradas lidas da página, e são elas que
     * obrigam estes dois passos a existirem. A largura de destino é a OUTRA
     * declarada em `VIEWPORTS_DO_TECLADO`: assim nenhuma varredura acontece
     * numa largura que a guarda não promete.
     *
     * `cobre` está vazio de propósito: entrada de FORA dos nós não se cobre
     * por declaração, se cobre pelo OUVINTE TER RODADO — e quem diz isso é o
     * contador da instrumentação, não este texto.
     */
    nome: "redimensionar a janela para a OUTRA largura declarada",
    cobre: [],
    async fazer(pagina, sentinela) {
      return await trocarALarguraDaJanela(pagina, sentinela, outraLarguraDeclarada(sentinela.largura));
    },
  },
  {
    nome: "devolver a janela à largura original",
    cobre: [],
    async fazer(pagina, sentinela) {
      return await trocarALarguraDaJanela(pagina, sentinela, sentinela.largura);
    },
  },
];


/**
 * ═══════════════════════════════════════════════════════════════════════════
 * [MÉDIO, rodada 19] OS ESTÍMULOS INCONDICIONAIS — a guarda faz à página o que
 * o NAVEGADOR faz a uma página aberta, escute ela ou não.
 *
 * ## Por que a rodada 18 não bastava (a forma 2 dentro da cura da forma 5)
 *
 * A rodada 18 derivava os passos do que a página ESCUTA: a instrumentação via
 * um `addEventListener`, o inventário ganhava a entrada, o passo nascia. O
 * coordenador registrou a MESMA armadilha por outra porta —
 * `document.onvisibilitychange = fn`, atribuição de propriedade — e passou
 * pelos cinco portões: a instrumentação não via o ouvinte → o inventário não
 * tinha a entrada → o passo não nascia → **ninguém trocava de aba** → o dano
 * nunca era provocado. Ouvinte invisível = estímulo ausente = verde. É a
 * **forma 2** (*aprova por ausência*), e ela não se cura caçando o canal
 * seguinte: depois da propriedade viria o relógio que CONSULTA
 * `document.visibilityState` sem ouvinte nenhum, o
 * `EventTarget.prototype.addEventListener.call(window, …)` que passa por
 * baixo do embrulho, o ouvinte registrado de dentro de `node_modules`.
 * **Enquanto o estímulo depender de detectar o ouvinte, sempre haverá um
 * canal que a detecção não vê.**
 *
 * ## A cura: o estímulo não depende de nada que o produto faça
 *
 * `ESTIMULOS_DO_NAVEGADOR` é o que o navegador faz a uma página aberta, SEM
 * tocar nos controles dela — não o que o produto escuta. **Todos rodam
 * sempre**, em toda corrida, na sentinela de uso de cada viewport, depois do
 * roteiro escrito à mão, e o Tab é remedido depois de cada um. O inventário
 * dos ouvintes continua existindo, mas para outra coisa: ele é o FECHO (a
 * página escuta algo que nenhum estímulo acordou → reprova nomeando; entrada
 * declarada fora que não existe mais → reprova) e deixou de ser o GATILHO.
 *
 * ## Por que ESTE é o universo certo
 *
 * Uma página aberta, sem ninguém tocar nos controles dela, só muda de mundo
 * por oito portas — as FONTES abaixo. Não é uma lista de eventos (eventos são
 * como o produto escolhe escutar, e escutar é o que não se pode supor): é a
 * lista de QUEM age sobre a página — a moldura da janela, a aba, o endereço,
 * a rolagem, o teclado e o ponteiro fora dos controles, o sistema operacional
 * e as outras janelas da mesma origem. Mais o TEMPO, que é a nona porta e já
 * tem medidas próprias (V e W). Cada fonte diz, por extenso, o que dela fica
 * FORA e por quê — o vão é declarado, não esquecido. A lista `FONTES_DO_NAVEGADOR`
 * é escrita à mão, uma vez, e o piso `PISO_DE_ESTIMULOS` também; os dois são
 * conferidos na medida X, FORA da medida Y que protegem.
 *
 * ## Como cada estímulo prova que aconteceu — sem perguntar ao produto
 *
 * Duas provas, as duas do lado do NAVEGADOR:
 *  1. **o estado mudou**: cada `fazer` lê o estado que o navegador expõe
 *     (`innerWidth`, `visibilityState`, `devicePixelRatio`, `navigator.onLine`,
 *     `matchMedia(...)`, `location.hash`, `scrollY`, a seleção) antes, durante
 *     e depois — e lança se ele não mudou;
 *  2. **a TESTEMUNHA viu o evento**: um ouvinte da própria guarda, em `window`,
 *     na fase de captura, instalado antes do primeiro script da página por
 *     `EventTarget.prototype` (fora do alcance do embrulho do inventário), conta
 *     cada tipo que o estímulo declara produzir. Contador que não subiu é
 *     PRECONDIÇÃO falha, com nome — nunca um verde.
 *
 * ## O alcance de tempo de cada estímulo — a DURAÇÃO derivada (rodada 20)
 *
 * **[ALTO, rodada 20] "Segurar por 1500 ms" era a forma 4 no eixo do tempo.**
 * A rodada 19 segurava cada estado alterado por `PERMANENCIA_DO_ESTIMULO_MS`
 * = 1500 ms de relógio de PAREDE, e declarava fora "quem consulta com período
 * maior que isso". O mesmo valia para quem mede QUANTO TEMPO a aba ficou
 * fora — e o operador real sai por minutos, não por 1,5 s. O coordenador
 * passou pelos cinco portões com
 *
 *     if (document.visibilityState === "hidden") saiuEmRef.current = Date.now();
 *     else if (Date.now() - saiuEmRef.current > 3000) setVoltouDeLonge(true);
 *     // em registrarBotaoLinha: if (el !== null && voltouDeLonge) el.tabIndex = -1;
 *
 *     fora da aba 1,5 s → 0 controle fora do Tab
 *     fora da aba 60 s  → 27 controles fora do Tab
 *
 * Trocar 1500 por 5000 seria o mesmo instante, mais adiante. A cura tem duas
 * metades, e nenhuma é um número escrito aqui:
 *
 *  1. **o relógio é da página, não da parede.** A sentinela de uso nasce com
 *     o relógio sob controle da guarda (`clock.install`, antes do primeiro
 *     script), e segurar um estado é ADIANTAR o relógio dela — `Date`,
 *     `performance.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`
 *     e, alinhados por `RELOGIOS_ALINHADOS`, `event.timeStamp` e
 *     `document.timeline`. Dois dias custam o mesmo que dois segundos: o custo
 *     em tempo de parede deixou de crescer com a duração.
 *  2. **a duração é derivada do que está escrito.** `LIMIARES_DE_TEMPO` lê,
 *     no arranque, todo limiar de tempo que o FONTE do produto declara (as
 *     constantes `*_MS`, o atraso de todo `setTimeout`/`setInterval`, e todo
 *     número escrito numa linha que lê um relógio — é assim que a validade de
 *     1500 ms da âncora e o `MS_POR_DIA` da meia-noite entram) e os que esta
 *     guarda declara. A ausência é `DURACAO_DA_AUSENCIA_MS` = o DOBRO do maior
 *     deles, e ela não é um salto só: `DEGRAUS_DA_AUSENCIA` passa logo acima de
 *     CADA limiar conhecido, em ordem, antes de chegar ao fim — quem consulta
 *     por relógio vê o estado alterado a cada limiar, e quem mede a duração vê
 *     a duração inteira ao voltar.
 *
 * Todo estímulo é IDA e VOLTA (ou declara por que não tem volta, em
 * `semVolta`): ida → o estado alterado dura a ausência inteira no relógio da
 * página → volta → mais uma ausência inteira DEPOIS de voltar, para quem só
 * olha depois → o Tab é remedido. O adiantamento é MEDIDO no relógio da
 * página em cada estímulo e contado na medida X — nunca declarado.
 *
 * ## O que fica FORA, dito com precisão
 *
 *  - relógio que o relógio da página não governa: o do SERVIDOR (a página
 *    pode perguntar a hora a ele) e o de um `Worker` (o `clock.install` é da
 *    janela). Esta rota não abre `Worker` — e o inventário do fecho vê o
 *    `message` de um, se um dia abrir;
 *  - limiar que não está escrito no fonte: calculado em tempo de execução a
 *    partir de dado (o atraso de `setTimeout` que é uma variável, e a
 *    constante `*_MS` que não é aritmética de números escritos, saem
 *    listados, por nome, em `ATRASOS_NAO_RESOLVIDOS`, impresso na medida X —
 *    hoje, um: o `folga` de `src/components/frentes/use-filtros.ts`, de
 *    outra rota);
 *  - [rodada 21: FECHADO, com o vão que sobra dito] armadilha que só
 *    dispara quando a volta cai numa JANELA de duração (entre A e B, e não
 *    depois de B). A rodada 20 voltava uma vez só, no fim da ausência; a
 *    medida Z volta em CADA duração de uma grade derivada (ver "A VOLTA EM
 *    CADA DURAÇÃO"), e o que fica fora é só a janela mais estreita que a
 *    razão declarada `RAZAO_DA_GRADE` (r na aba e no foco, r² nos outros),
 *    a que acaba antes do menor limiar lido e a que começa depois da
 *    ausência inteira;
 *  - quem CONTA disparos de relógio em vez de ler a hora: um `setInterval`
 *    dispara uma vez por degrau (é o que o navegador faz com uma aba de
 *    segundo plano numa máquina que dormiu), não uma vez por período.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/*
 * ── O RELÓGIO DA PÁGINA E A DURAÇÃO DERIVADA ──────────────────────────────
 */

/** Pisos ESCRITOS À MÃO — contados na medida X, fora da medida Y que protegem. */
/**
 * Uma noite inteira fora: a aba esquecida aberta de um dia para o outro. 25 h,
 * e não 24, porque o dia da troca de horário de verão tem 25 horas — só assim
 * a ausência atravessa uma meia-noite do fuso do operador, seja qual for a
 * hora em que a corrida começa. Em HORAS de propósito: o leitor de limiares
 * lê as constantes `*_MS` desta guarda, e o piso não pode entrar na conta que
 * ele fiscaliza.
 */
const PISO_DA_AUSENCIA_EM_HORAS = 25;

/**
 * Quantos limiares de tempo a leitura do fonte tem de achar. Medido nesta
 * árvore: ver o número impresso na medida X. É o contrapeso da forma 2 — um
 * leitor quebrado acharia zero limiar, a ausência cairia para o dobro de zero,
 * e a medida Y seguraria o estado por nada.
 */
const PISO_DE_LIMIARES = 20;

/**
 * E quantos deles têm de vir do componente DESTA rota
 * (`src/components/timeline/linha-do-tempo.tsx`): a validade da âncora e o
 * `MS_POR_DIA`, medidos. Um leitor que achasse tudo menos o arquivo da rota
 * passaria no piso acima com os números dos outros.
 */
const PISO_DE_LIMIARES_DA_ROTA = 2;
const ARQUIVO_DA_ROTA = "src/components/timeline/linha-do-tempo.tsx";

/** Um avaliador de aritmética de literais (`26 * 60 * 60 * 1000`), sem `eval`. */
function avaliarAritmetica(texto, tabela) {
  const fichas = texto.match(/\d[\d_]*(?:\.\d+)?|[A-Za-z_$][\w$]*|[-+*/()]/g);
  if (fichas === null || fichas.join("") !== texto.replace(/\s+/g, "")) return null;
  let i = 0;
  const fator = () => {
    const f = fichas[i];
    i += 1;
    if (f === "(") {
      const v = soma();
      if (fichas[i] !== ")") return Number.NaN;
      i += 1;
      return v;
    }
    if (f === "-") return -fator();
    if (/^\d/.test(f ?? "")) return Number(f.replace(/_/g, ""));
    if (f !== undefined && tabela.has(f)) return tabela.get(f);
    return Number.NaN;
  };
  const produto = () => {
    let v = fator();
    while (fichas[i] === "*" || fichas[i] === "/") {
      const op = fichas[i];
      i += 1;
      const w = fator();
      v = op === "*" ? v * w : v / w;
    }
    return v;
  };
  const soma = () => {
    let v = produto();
    while (fichas[i] === "+" || fichas[i] === "-") {
      const op = fichas[i];
      i += 1;
      const w = produto();
      v = op === "+" ? v + w : v - w;
    }
    return v;
  };
  const v = soma();
  return i === fichas.length && Number.isFinite(v) ? v : null;
}

/** Os argumentos de uma chamada, a partir do `(`, respeitando parênteses e chaves. */
function argumentosDaChamada(texto, abre) {
  const args = [];
  let prof = 0;
  let inicio = abre + 1;
  for (let k = abre; k < texto.length; k += 1) {
    const c = texto[k];
    if (c === "(" || c === "{" || c === "[") prof += 1;
    else if (c === ")" || c === "}" || c === "]") {
      prof -= 1;
      if (prof === 0) {
        args.push(texto.slice(inicio, k).trim());
        return args;
      }
    } else if (c === "," && prof === 1) {
      args.push(texto.slice(inicio, k).trim());
      inicio = k + 1;
    }
  }
  return args;
}

const RELOGIO_NA_LINHA = /Date\.now\(\)|performance\.now\(\)|\.getTime\(\)|\btimeStamp\b|\bset(?:Timeout|Interval)\s*\(/;
const NOME_DE_MILISSEGUNDOS = /(?:^|_)MS(?:_|$)/;

/**
 * Lê UM arquivo-fonte e devolve os limiares de tempo que ele escreve.
 * `soConstantes` lê só as `*_MS` (é o modo desta guarda: as linhas dela que
 * leem relógio são carimbos e tetos, não limiares de produto).
 */
function limiaresDoArquivo(rotulo, fonte, soConstantes) {
  /* Comentário não é código: sai, trocado por espaços, para as linhas não andarem. */
  const apagar = (m) => m.replace(/[^\n]/g, " ");
  const texto = fonte.replace(/\/\*[\s\S]*?\*\//g, apagar).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, antes) => antes + apagar(m.slice(antes.length)));
  const achados = [];
  const naoResolvidos = [];
  const linhaDe = (pos) => texto.slice(0, pos).split("\n").length;
  const tabela = new Map();
  for (const m of texto.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*number\s*)?=\s*([^;\n]+);/g)) {
    const v = avaliarAritmetica(m[2].trim(), tabela);
    if (v === null) {
      /* Uma constante de milissegundos que não é número escrito não some em
         silêncio: sai listada, por nome, com as de fora da conta. */
      if (!soConstantes && NOME_DE_MILISSEGUNDOS.test(m[1])) {
        naoResolvidos.push(`${rotulo}:${String(linhaDe(m.index))} (const ${m[1]} = \`${m[2].trim().slice(0, 40)}\`)`);
      }
      continue;
    }
    tabela.set(m[1], v);
    if (NOME_DE_MILISSEGUNDOS.test(m[1]) && v > 0) {
      achados.push({ ms: v, onde: `${rotulo}:${String(linhaDe(m.index))}`, como: `const ${m[1]}` });
    }
  }
  if (!soConstantes) {
    for (const m of texto.matchAll(/\bset(Timeout|Interval)\s*\(/g)) {
      const args = argumentosDaChamada(texto, m.index + m[0].length - 1);
      const atraso = args[1];
      if (atraso === undefined || atraso === "") continue;
      const v = avaliarAritmetica(atraso, tabela);
      const onde = `${rotulo}:${String(linhaDe(m.index))}`;
      if (v === null) naoResolvidos.push(`${onde} (set${m[1]} com atraso \`${atraso.slice(0, 40)}\`)`);
      else if (v > 0) achados.push({ ms: v, onde, como: `set${m[1]}(…, ${atraso.slice(0, 30)})` });
    }
    texto.split("\n").forEach((linha, n) => {
      if (!RELOGIO_NA_LINHA.test(linha)) return;
      for (const m of linha.matchAll(/\d[\d_]*(?:\.\d+)?(?:\s*\*\s*\d[\d_]*(?:\.\d+)?)*/g)) {
        const v = avaliarAritmetica(m[0], tabela);
        if (v !== null && v > 0) {
          achados.push({ ms: v, onde: `${rotulo}:${String(n + 1)}`, como: `número numa linha que lê relógio: ${m[0]}` });
        }
      }
    });
  }
  return { achados, naoResolvidos };
}

/** Todo `.ts`/`.tsx` debaixo de `src/` — o fonte INTEIRO do produto, e não uma lista. */
function arquivosDoFonte(dir) {
  const saida = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) saida.push(...arquivosDoFonte(p));
    else if (/\.tsx?$/.test(e.name)) saida.push(p);
  }
  return saida;
}

/*
 * O universo é o fonte inteiro de `src/`, e não só o da rota, de propósito:
 * a rota alcança o `middleware`, as bibliotecas e os repositórios, e um
 * limiar a mais só alonga a ausência — que custa o mesmo com o relógio da
 * página —, enquanto um a menos é justamente o buraco.
 */
const LIMIARES_DE_TEMPO = [];
const ATRASOS_NAO_RESOLVIDOS = [];
{
  const raizDoFonte = join(RAIZ_DO_PACOTE, "src");
  for (const caminho of arquivosDoFonte(raizDoFonte)) {
    const rotulo = caminho.slice(RAIZ_DO_PACOTE.length + 1);
    const { achados, naoResolvidos } = limiaresDoArquivo(rotulo, readFileSync(caminho, "utf8"), false);
    LIMIARES_DE_TEMPO.push(...achados);
    ATRASOS_NAO_RESOLVIDOS.push(...naoResolvidos);
  }
  const estaGuarda = fileURLToPath(import.meta.url);
  const { achados } = limiaresDoArquivo(
    estaGuarda.slice(RAIZ_DO_PACOTE.length + 1),
    readFileSync(estaGuarda, "utf8"),
    true,
  );
  LIMIARES_DE_TEMPO.push(...achados);
}

/** O maior limiar conhecido — é dele que a ausência tira o tamanho. */
const MAIOR_LIMIAR = LIMIARES_DE_TEMPO.reduce((m, l) => (l.ms > m.ms ? l : m), { ms: 0, onde: "(nenhum)", como: "" });

/** A ausência: o DOBRO do maior limiar conhecido. Acima dele com folga, e nunca um número escrito aqui. */
const DURACAO_DA_AUSENCIA_MS = 2 * MAIOR_LIMIAR.ms;

/**
 * Os degraus da ausência, em tempo ACUMULADO: logo acima de cada limiar
 * conhecido (1 ms depois), em ordem, e por fim a ausência inteira. Cada degrau
 * é um `clock.fastForward` — todo relógio vencido dispara uma vez nele, como
 * numa aba de segundo plano de uma máquina que dormiu e acordou.
 */
const DEGRAUS_DA_AUSENCIA = [
  ...new Set([
    ...LIMIARES_DE_TEMPO.map((l) => Math.ceil(l.ms) + 1).filter((t) => t < DURACAO_DA_AUSENCIA_MS),
    DURACAO_DA_AUSENCIA_MS,
  ]),
].sort((a, b) => a - b);

/*
 * ── A VOLTA EM CADA DURAÇÃO (rodada 21) ──────────────────────────────────
 *
 * A rodada 20 segurava o estado alterado pelos degraus inteiros e VOLTAVA uma
 * vez só, no fim das 52 h. O operador volta depois de 5 min, de 1 h, de uma
 * noite — e um produto com um ramo "volta curta" e outro "volta longa" tinha
 * o curto nunca exercido. A grade abaixo diz EM QUE DURAÇÕES a guarda volta,
 * e ela é derivada — nenhuma duração escrita aqui.
 */

/**
 * A RAZÃO da grade, ESCRITA À MÃO e declarada: entre uma volta e a seguinte
 * a duração no máximo dobra. É ela que define o que a grade promete: TODA
 * janela aberta (a, b) de duração fora com b/a > RAZAO_DA_GRADE, que termine
 * acima do menor limiar e comece abaixo da ausência inteira, contém uma volta.
 * Contada na medida X (nunca derivada da corrida que ela fiscaliza).
 */
const RAZAO_DA_GRADE = 2;

/**
 * Piso, ESCRITO À MÃO, de voltas que cada estímulo de grade INTEIRA tem de ter
 * feito em cada viewport — contado na X. Leitor de limiares quebrado ou razão
 * afrouxada encolhem a grade, e a grade encolhida ficaria verde por ausência.
 */
const PISO_DE_VOLTAS_DA_GRADE_INTEIRA = 30;

/** O menor limiar conhecido — é dele que a grade parte. */
const MENOR_LIMIAR = LIMIARES_DE_TEMPO.reduce((m, l) => (l.ms > 0 && l.ms < m.ms ? l : m), {
  ms: Number.POSITIVE_INFINITY,
  onde: "(nenhum)",
  como: "",
});

/**
 * Os pontos GEOMÉTRICOS: do menor limiar, multiplicando pela razão, até
 * abaixo da ausência inteira (a volta na ausência inteira é a da medida Y).
 * Se a janela (a, b) tem b/a > r e a está em [p(k−1), p(k)), então p(k) está
 * dentro dela — é a prova da promessa, e ela vale para QUALQUER a.
 */
const PONTOS_GEOMETRICOS = (() => {
  const saida = [];
  if (!Number.isFinite(MENOR_LIMIAR.ms)) return saida;
  for (let p = Math.ceil(MENOR_LIMIAR.ms); p < DURACAO_DA_AUSENCIA_MS; p = Math.ceil(p * RAZAO_DA_GRADE)) {
    saida.push(p);
  }
  return saida;
})();

/**
 * A GRADE INTEIRA de voltas: os pontos geométricos MAIS os degraus da ausência
 * que já existem (1 ms acima de cada limiar conhecido — o ramo que um produto
 * escreve com o próprio limiar, `fora > CACHE_MS`, cai exatamente aqui).
 */
const GRADE_DAS_VOLTAS = [
  ...new Set([...PONTOS_GEOMETRICOS, ...DEGRAUS_DA_AUSENCIA.filter((t) => t < DURACAO_DA_AUSENCIA_MS)]),
].sort((a, b) => a - b);

/**
 * Os estímulos que voltam em TODA a grade: sair da aba e a janela perder o
 * foco — as duas maneiras de o operador "sair e voltar" sem tocar na página.
 * Os outros estímulos com volta voltam em DEGRAUS ALTERNADOS (critério
 * declarado, para o custo não explodir): só os pontos geométricos, um sim e
 * um não, com a PARIDADE trocando de um estímulo para o seguinte — então
 * cada um deles promete as janelas com b/a > RAZAO_DA_GRADE² e cada PAR
 * consecutivo cobre a grade geométrica inteira entre os dois.
 */
const ESTIMULOS_DE_GRADE_INTEIRA = new Set(["sair da aba e voltar", "a janela perder o foco e recuperar"]);

/** A grade de UM estímulo, a partir da posição dele entre os que têm volta. */
function gradeDoEstimulo(estimulo, posicaoEntreOsDeVolta) {
  if (ESTIMULOS_DE_GRADE_INTEIRA.has(estimulo.nome)) return GRADE_DAS_VOLTAS;
  return PONTOS_GEOMETRICOS.filter((_, k) => k % 2 === posicaoEntreOsDeVolta % 2);
}

/**
 * Este corpo NÃO roda no Node: entra antes do primeiro script da página, e só
 * nas páginas de relógio controlado. Os dois relógios que o `clock.install` do
 * Playwright não governa — `event.timeStamp` e `document.timeline` — passam a
 * ler o MESMO `performance.now()` que ele governa. Sem isto, quem medisse a
 * ausência pelo carimbo do evento veria milissegundos onde a página viveu dias.
 */
function RELOGIOS_ALINHADOS() {
  const agora = () => performance.now();
  try {
    Object.defineProperty(Event.prototype, "timeStamp", { configurable: true, get: agora });
  } catch {
    // navegador sem o campo: nada a alinhar
  }
  try {
    Object.defineProperty(AnimationTimeline.prototype, "currentTime", { configurable: true, get: agora });
  } catch {
    // navegador sem linha do tempo de animação
  }
}

/** A hora que a PÁGINA acha que é. */
async function relogioDaPagina(pagina) {
  return await pagina.evaluate(() => Date.now());
}

/**
 * A AUSÊNCIA: o relógio da página anda `DURACAO_DA_AUSENCIA_MS`, degrau a
 * degrau, com o estado do jeito que estiver. Devolve quanto o relógio da
 * PÁGINA andou, medido — é esse número, e não a constante, que a medida X
 * confere.
 */
async function ausencia(pagina, ate = DURACAO_DA_AUSENCIA_MS) {
  if (pagina.__relogioDeMentira !== true) {
    throw new PrecondicaoFalhou(
      "a página não tem o relógio sob controle da guarda — segurar um estado por dias exigiria esperar dias de parede",
    );
  }
  const t0 = await relogioDaPagina(pagina);
  let feito = 0;
  /* Uma ausência mais curta que a inteira passa pelos MESMOS degraus que
     ficam abaixo dela, e termina exatamente nela (rodada 21). */
  for (const alvo of [...DEGRAUS_DA_AUSENCIA.filter((t) => t < ate), ate]) {
    await pagina.clock.fastForward(alvo - feito);
    feito = alvo;
  }
  await assentar(pagina);
  return (await relogioDaPagina(pagina)) - t0;
}

/** Escreve uma duração em gente: "52 h", "30 min", "1,5 s". */
function duracaoEmGente(ms) {
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  if (ms >= 3600000) return `${(ms / 3600000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  if (ms >= 60000) return `${(ms / 60000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`;
  return `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
}

/**
 * Piso, ESCRITO À MÃO, de estímulos que a sentinela de uso tem de executar em
 * cada viewport. Mora aqui e é contado na medida X — fora da Y que ele protege.
 */
const PISO_DE_ESTIMULOS = 20;

/** Piso, ESCRITO À MÃO, de fontes — as portas por onde o navegador age na página. */
const PISO_DE_FONTES = 8;

/** Onde a testemunha da guarda guarda as contagens, dentro da página. */
const CANAL_DA_TESTEMUNHA = "__testemunhaDoNavegadorP5";

/**
 * Este corpo NÃO roda no Node: entra antes do primeiro script da página. Conta,
 * por tipo, cada evento que chega a `window` na fase de captura — por
 * `EventTarget.prototype.addEventListener`, que o embrulho do inventário não
 * toca (ele troca o método da INSTÂNCIA). É a prova, do lado do navegador, de
 * que o estímulo aconteceu; o produto não entra nesta conta.
 */
function TESTEMUNHA_DO_NAVEGADOR(config) {
  const { chave, tipos } = config;
  if (Object.prototype.hasOwnProperty.call(window, chave)) return;
  const contagem = Object.create(null);
  const ouvir = EventTarget.prototype.addEventListener;
  for (const tipo of tipos) {
    contagem[tipo] = 0;
    ouvir.call(
      window,
      tipo,
      () => {
        contagem[tipo] += 1;
      },
      { capture: true, passive: true },
    );
  }
  Object.defineProperty(window, chave, {
    value: contagem,
    writable: false,
    configurable: false,
    enumerable: false,
  });
}

/** Lê a testemunha; ausente é precondição falha, nunca "nada aconteceu". */
async function lerTestemunha(pagina) {
  const c = await pagina.evaluate((chave) => {
    const t = window[chave];
    return t === undefined ? null : { ...t };
  }, CANAL_DA_TESTEMUNHA);
  if (c === null) {
    throw new PrecondicaoFalhou(
      "a testemunha do navegador não está instalada nesta página — sem ela nenhum estímulo prova que aconteceu",
    );
  }
  return c;
}

/** Lê um valor da página; exige que ele mude de `antes`, ou lança dizendo qual. */
async function exigirMudanca(oQue, antes, depois) {
  if (JSON.stringify(antes) === JSON.stringify(depois)) {
    throw new Error(`${oQue} não mudou (${JSON.stringify(antes)})`);
  }
}

/** Redimensiona para um tamanho qualquer e espera `innerWidth/innerHeight` mudarem. */
async function levarAJanela(pagina, largura, altura) {
  const ler = async () => await pagina.evaluate(() => `${String(window.innerWidth)}×${String(window.innerHeight)}`);
  const antes = await ler();
  await pagina.setViewportSize({ width: largura, height: altura });
  const fim = Date.now() + TETO_DE_ACAO_MS;
  let agora = await ler();
  while (agora === antes && Date.now() < fim) {
    await assentar(pagina);
    agora = await ler();
  }
  await exigirMudanca("o tamanho da janela", antes, agora);
  return `${antes} → ${agora}`;
}

/*
 * [ALTO, rodada 20] Cada estímulo agora é IDA e VOLTA. O que fica entre as
 * duas — a ausência — não mora mais aqui dentro: é `executarEstimulo` quem a
 * faz, a MESMA para todos, no relógio da página. `estado` passa o que a ida
 * precisa deixar para a volta.
 */

/** A LARGURA da janela: vai à outra largura declarada, e volta. */
async function larguraIda(pagina, sentinela) {
  const ida = await trocarALarguraDaJanela(pagina, sentinela, outraLarguraDeclarada(sentinela.largura));
  if (!ida.ok) throw new Error(`a tela não mudou ao ir para a outra largura (${ida.dito})`);
  return ida.dito;
}
async function larguraVolta(pagina, sentinela) {
  const volta = await trocarALarguraDaJanela(pagina, sentinela, sentinela.largura);
  if (!volta.ok) throw new Error(`a tela não mudou ao voltar à largura original (${volta.dito})`);
  return volta.dito;
}

/** A ALTURA da janela (a barra de ferramentas que aparece): encolhe, e volta. */
async function alturaIda(pagina, sentinela) {
  return await levarAJanela(pagina, sentinela.largura, Math.round(sentinela.altura * 0.6));
}
async function alturaVolta(pagina, sentinela) {
  return await levarAJanela(pagina, sentinela.largura, sentinela.altura);
}

/** A DENSIDADE de pixels (o zoom do navegador / trocar de monitor): muda, e volta. */
async function densidadeIda(pagina, sentinela, estado) {
  const ler = async () => await pagina.evaluate(() => window.devicePixelRatio);
  estado.ler = ler;
  estado.antes = await ler();
  estado.cdp = await pagina.context().newCDPSession(pagina);
  estado.aplicar = async (fator) => {
    await estado.cdp.send("Emulation.setDeviceMetricsOverride", {
      width: sentinela.largura,
      height: sentinela.altura,
      deviceScaleFactor: fator,
      mobile: false,
    });
  };
  await estado.aplicar(estado.antes === 2 ? 1 : 2);
  await assentar(pagina);
  const durante = await ler();
  await exigirMudanca("`devicePixelRatio`", estado.antes, durante);
  return `devicePixelRatio ${String(estado.antes)} → ${String(durante)}`;
}
async function densidadeVolta(pagina, _sentinela, estado) {
  try {
    await estado.aplicar(estado.antes);
    await assentar(pagina);
    const depois = await estado.ler();
    if (depois !== estado.antes) throw new Error(`a densidade não voltou (${String(depois)} ≠ ${String(estado.antes)})`);
    return `devicePixelRatio de volta a ${String(depois)}`;
  } finally {
    await estado.cdp.detach().catch(() => {});
  }
}

/**
 * SAIR DA ABA E VOLTAR. No Chromium sem tela o `bringToFront` não emite o
 * sinal — então a guarda põe no documento o MESMO estado que o navegador põe
 * (`visibilityState`, `hidden`) e emite o MESMO evento: quem escuta o evento e
 * quem consulta o estado por relógio veem a mesma aba escondida, pela ausência
 * inteira. Ao voltar, a guarda apaga o que pôs e o getter nativo reaparece.
 */
const lerAba = async (pagina) =>
  await pagina.evaluate(() => `${document.visibilityState}/${String(document.hidden)}`);
async function abaIda(pagina, _sentinela, estado) {
  estado.antes = await lerAba(pagina);
  await pagina.evaluate(() => {
    for (const [nome, valor] of [
      ["visibilityState", "hidden"],
      ["hidden", true],
    ]) {
      Object.defineProperty(document, nome, { configurable: true, get: () => valor });
    }
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const durante = await lerAba(pagina);
  await exigirMudanca("`document.visibilityState`", estado.antes, durante);
  return `aba ${estado.antes} → ${durante}`;
}
async function abaVolta(pagina, _sentinela, estado) {
  await pagina.evaluate(() => {
    delete document.visibilityState;
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await assentar(pagina);
  const depois = await lerAba(pagina);
  if (depois !== estado.antes) throw new Error(`a aba não voltou (${depois} ≠ ${estado.antes})`);
  return `aba de volta a ${depois}`;
}

/** A JANELA perde o foco (outro programa na frente) e o recupera. Mesmo método. */
async function focoIda(pagina) {
  await pagina.evaluate(() => {
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false });
    window.dispatchEvent(new FocusEvent("blur"));
  });
  const durante = await pagina.evaluate(() => document.hasFocus());
  if (durante !== false) throw new Error("`document.hasFocus()` não passou a dizer false");
  return "document.hasFocus() false, `blur` na janela";
}
async function focoVolta(pagina) {
  await pagina.evaluate(() => {
    delete document.hasFocus;
    window.dispatchEvent(new FocusEvent("focus"));
  });
  await assentar(pagina);
  return "`focus` na janela";
}

/** A REDE cai e volta — de verdade, pelo navegador (`setOffline`). */
const lerRede = async (pagina) => await pagina.evaluate(() => navigator.onLine);
async function redeIda(pagina, _sentinela, estado) {
  estado.antes = await lerRede(pagina);
  await pagina.context().setOffline(true);
  const fim = Date.now() + TETO_DE_ACAO_MS;
  let durante = await lerRede(pagina);
  while (durante === estado.antes && Date.now() < fim) {
    await assentar(pagina);
    durante = await lerRede(pagina);
  }
  await exigirMudanca("`navigator.onLine`", estado.antes, durante);
  return `navigator.onLine ${String(estado.antes)} → ${String(durante)}`;
}
async function redeVolta(pagina, _sentinela, estado) {
  await pagina.context().setOffline(false);
  const fim = Date.now() + TETO_DE_ACAO_MS;
  let depois = await lerRede(pagina);
  while (depois !== estado.antes && Date.now() < fim) {
    await assentar(pagina);
    depois = await lerRede(pagina);
  }
  if (depois !== estado.antes) throw new Error(`a rede não voltou (navigator.onLine ${String(depois)})`);
  return `navigator.onLine de volta a ${String(depois)}`;
}

/** Troca uma preferência do SISTEMA (`emulateMedia`), e volta. Prova pela `matchMedia`. */
function trocarPreferencia(campo, consulta, ligado, desligado) {
  const ler = async (pagina) => await pagina.evaluate((q) => window.matchMedia(q).matches, consulta);
  return {
    async ida(pagina, _sentinela, estado) {
      estado.antes = await ler(pagina);
      await pagina.emulateMedia({ [campo]: estado.antes ? desligado : ligado });
      await assentar(pagina);
      const durante = await ler(pagina);
      await exigirMudanca(`\`matchMedia("${consulta}")\``, estado.antes, durante);
      return `matchMedia("${consulta}") ${String(estado.antes)} → ${String(durante)}`;
    },
    async volta(pagina, _sentinela, estado) {
      await pagina.emulateMedia({ [campo]: estado.antes ? ligado : desligado });
      await assentar(pagina);
      const depois = await ler(pagina);
      if (depois !== estado.antes) throw new Error(`\`${consulta}\` não voltou`);
      return `de volta a ${String(depois)}`;
    },
  };
}

/** Pedir para IMPRIMIR: a mídia vira `print` com `beforeprint`; cancelar: `afterprint`, volta. */
const lerImpressao = async (pagina) => await pagina.evaluate(() => window.matchMedia("print").matches);
async function imprimirIda(pagina) {
  await pagina.emulateMedia({ media: "print" });
  await pagina.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await assentar(pagina);
  if ((await lerImpressao(pagina)) !== true) throw new Error("a mídia não virou `print`");
  return "mídia print, com `beforeprint`";
}
async function imprimirVolta(pagina) {
  await pagina.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await pagina.emulateMedia({ media: null });
  await assentar(pagina);
  if ((await lerImpressao(pagina)) !== false) throw new Error("a mídia não voltou de `print`");
  return "`afterprint` e mídia de tela de volta";
}

/** O IDIOMA do sistema muda e volta: o estado em `navigator` + `languagechange`. */
const lerIdioma = async (pagina) => await pagina.evaluate(() => navigator.language);
async function idiomaIda(pagina, _sentinela, estado) {
  estado.antes = await lerIdioma(pagina);
  const outro = estado.antes.toLowerCase().startsWith("en") ? "pt-BR" : "en-US";
  await pagina.evaluate((lingua) => {
    Object.defineProperty(navigator, "language", { configurable: true, get: () => lingua });
    Object.defineProperty(navigator, "languages", { configurable: true, get: () => [lingua] });
    window.dispatchEvent(new Event("languagechange"));
  }, outro);
  const durante = await lerIdioma(pagina);
  await exigirMudanca("`navigator.language`", estado.antes, durante);
  return `navigator.language ${estado.antes} → ${durante}`;
}
async function idiomaVolta(pagina, _sentinela, estado) {
  await pagina.evaluate(() => {
    delete navigator.language;
    delete navigator.languages;
    window.dispatchEvent(new Event("languagechange"));
  });
  await assentar(pagina);
  const depois = await lerIdioma(pagina);
  if (depois !== estado.antes) throw new Error(`o idioma não voltou (${depois} ≠ ${estado.antes})`);
  return `de volta a ${depois}`;
}

/** Troca o `#` da URL — o mesmo caminho que a barra de endereços usa. */
async function trocarOPedacoDaUrl(pagina) {
  const antes = await pagina.evaluate(() => window.location.hash);
  await pagina.evaluate((marca) => {
    window.location.hash = marca;
  }, `#lb-p5-${String(Date.now() % 100000)}`);
  await assentar(pagina);
  const depois = await pagina.evaluate(() => window.location.hash);
  if (depois === antes) throw new Error("o `#` da URL não mudou");
  return `URL "${antes === "" ? "(sem #)" : antes}" → "${depois}"`;
}

/** Uma entrada nova no histórico da mesma página; e o botão VOLTAR do navegador. */
async function historicoIda(pagina, _sentinela, estado) {
  estado.antes = await pagina.evaluate(() => window.location.hash);
  await pagina.evaluate(() => {
    window.history.pushState(window.history.state, "", `${window.location.pathname}${window.location.search}#lb-p5-historico`);
  });
  const durante = await pagina.evaluate(() => window.location.hash);
  await exigirMudanca("o endereço", estado.antes, durante);
  return `entrada nova no histórico: ${durante}`;
}
async function historicoVolta(pagina, _sentinela, estado) {
  await pagina.evaluate(() => window.history.back());
  const fim = Date.now() + TETO_DE_ACAO_MS;
  let depois = await pagina.evaluate(() => window.location.hash);
  while (depois !== estado.antes && Date.now() < fim) {
    await assentar(pagina);
    depois = await pagina.evaluate(() => window.location.hash);
  }
  if (depois !== estado.antes) throw new Error(`o VOLTAR não devolveu o endereço (${depois} ≠ ${estado.antes})`);
  return `VOLTAR → "${estado.antes === "" ? "(sem #)" : estado.antes}"`;
}

/** Rola a PÁGINA (não o quadro): é o que faz `window` ouvir `scroll`. */
async function rolarAPagina(pagina) {
  const ler = async () => await pagina.evaluate(() => Math.round(window.scrollY));
  const antes = await ler();
  const altura = await pagina.evaluate(() => ({
    documento: Math.round(document.documentElement.scrollHeight),
    janela: Math.round(window.innerHeight),
  }));
  if (altura.documento <= altura.janela + 4) {
    throw new Error(
      `a página não tem o que rolar (documento ${String(altura.documento)}px, janela ${String(altura.janela)}px)`,
    );
  }
  /* Roda do mouse num canto neutro — dentro do quadro ela viraria rolagem
     horizontal da escala, que é outra coisa e já tem passo próprio. */
  await pagina.mouse.move(6, 6);
  await pagina.mouse.wheel(0, antes > 4 ? -400 : 400);
  /* A rolagem anima no COMPOSITOR, fora de qualquer relógio da página: com o
     relógio sob controle, `assentar` não espera quadro nenhum — então a
     régua é a mudança, com espera de parede, como em `esperarRetratoMudar`. */
  let depois = await esperarRetratoMudar(pagina, ler, antes);
  if (depois === antes) {
    await pagina.evaluate(() => {
      document.body.setAttribute("tabindex", "-1");
      document.body.focus();
    });
    await pagina.keyboard.press(antes > 4 ? "Home" : "End");
    depois = await esperarRetratoMudar(pagina, ler, antes);
  }
  if (depois === antes) throw new Error(`a página não rolou (scrollY ${String(antes)})`);
  return `scrollY ${String(antes)} → ${String(depois)}`;
}

/** Aperta uma tecla inofensiva com o corpo do documento focado: desce… */
async function teclaIda(pagina) {
  await pagina.evaluate(() => {
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
  });
  await pagina.keyboard.down("Shift");
  await assentar(pagina);
  return 'tecla "Shift" apertada com o corpo do documento focado';
}
/** …e sobe, depois da ausência inteira com ela apertada. */
async function teclaVolta(pagina) {
  await pagina.keyboard.up("Shift");
  await assentar(pagina);
  return 'tecla "Shift" solta';
}

/** O botão do mouse num ponto neutro: desce… */
function botaoDoMouse(botao) {
  return {
    async ida(pagina) {
      await pagina.mouse.move(6, 6);
      await pagina.mouse.down({ button: botao });
      await assentar(pagina);
      return `botão ${botao === "right" ? "direito" : "esquerdo"} pressionado no canto da página`;
    },
    /* …e sobe, depois da ausência inteira pressionado. */
    async volta(pagina) {
      await pagina.mouse.up({ button: botao });
      await assentar(pagina);
      return "e solto";
    },
  };
}

/** O ponteiro ATRAVESSA a página de lado a lado, pela altura do meio, e volta ao canto. */
async function ponteiroIda(pagina, sentinela) {
  const y = Math.round(sentinela.altura / 2);
  await pagina.mouse.move(6, y);
  await pagina.mouse.move(sentinela.largura - 6, y, { steps: 16 });
  await assentar(pagina);
  return `ponteiro de x=6 a x=${String(sentinela.largura - 6)} na altura ${String(y)}`;
}
async function ponteiroVolta(pagina) {
  await pagina.mouse.move(6, 6, { steps: 4 });
  await assentar(pagina);
  return "de volta ao canto";
}

/** SELECIONAR um trecho de texto com o mouse, fora de qualquer controle (o título). */
async function selecaoIda(pagina) {
  const caixa = await pagina.evaluate(() => {
    const h = document.querySelector("h1");
    if (h === null) return null;
    const r = h.getBoundingClientRect();
    return { x: r.left, y: r.top + r.height / 2, w: r.width };
  });
  if (caixa === null) throw new Error("a página não tem título (`h1`) para selecionar");
  await pagina.mouse.move(caixa.x + 2, caixa.y);
  await pagina.mouse.down();
  await pagina.mouse.move(caixa.x + Math.max(20, caixa.w - 4), caixa.y, { steps: 6 });
  await pagina.mouse.up();
  await assentar(pagina);
  const trecho = await pagina.evaluate(() => String(window.getSelection() ?? ""));
  if (trecho.trim() === "") throw new Error("o arraste não selecionou texto nenhum");
  return `trecho "${trecho.slice(0, 24)}" selecionado com o mouse`;
}
async function selecaoVolta(pagina) {
  await pagina.evaluate(() => window.getSelection()?.removeAllRanges());
  await assentar(pagina);
  return "seleção desfeita";
}

/**
 * OUTRA ABA da mesma origem grava no armazenamento — de verdade: a guarda abre
 * uma segunda aba no mesmo contexto, servida na mesma origem por uma rota
 * interceptada (sem compilar página nenhuma do produto), e grava lá. Quem
 * dispara o `storage` aqui é o navegador. Na volta, ela APAGA a chave.
 */
async function abrirOutraAba(pagina) {
  if (pagina.__outraAba !== undefined && !pagina.__outraAba.pagina.isClosed()) return pagina.__outraAba;
  const contexto = pagina.context();
  const url = new URL("/__lb-p5-outra-aba", pagina.url()).toString();
  await contexto.route(url, (rota) =>
    rota.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>outra aba</title>" }),
  );
  const outra = { pagina: await contexto.newPage(), url, contexto };
  pagina.__outraAba = outra;
  await outra.pagina.goto(url);
  return outra;
}
async function fecharOutraAba(pagina) {
  const outra = pagina.__outraAba;
  pagina.__outraAba = undefined;
  if (outra === undefined) return;
  await outra.pagina.close().catch(() => {});
  await outra.contexto.unroute(outra.url).catch(() => {});
}
async function gravarNaOutraAba(pagina, operacao) {
  const { pagina: outra } = await abrirOutraAba(pagina);
  try {
    const valor = operacao === "gravar" ? String(Date.now()) : null;
    await outra.evaluate((v) => {
      if (v === null) window.localStorage.removeItem("lb-p5-outra-aba");
      else window.localStorage.setItem("lb-p5-outra-aba", v);
    }, valor);
    const fim = Date.now() + TETO_DE_ACAO_MS;
    let visto = await pagina.evaluate(() => window.localStorage.getItem("lb-p5-outra-aba"));
    while ((visto === null) !== (valor === null) && Date.now() < fim) {
      await assentar(pagina);
      visto = await pagina.evaluate(() => window.localStorage.getItem("lb-p5-outra-aba"));
    }
    if ((visto === null) !== (valor === null)) throw new Error(`a operação "${operacao}" da outra aba não chegou a esta`);
  } finally {
    /* Fora da grade da Z, a outra aba vive só o tempo de uma operação. */
    if (pagina.__reaproveitarOutraAba !== true) await fecharOutraAba(pagina);
  }
  await assentar(pagina);
  return operacao === "gravar"
    ? "outra aba da mesma origem gravou uma chave do `localStorage`"
    : "e a apagou";
}

/** Uma MENSAGEM chega de outra janela (é como extensões e iframes falam com a página). */
async function chegaUmaMensagem(pagina) {
  await pagina.evaluate(() => window.postMessage({ origem: "lb-p5-guarda" }, "*"));
  await assentar(pagina);
  return "`postMessage` recebido pela janela";
}

/**
 * AS FONTES — quem age sobre uma página aberta sem tocar nos controles dela.
 * Escritas à mão, uma vez. Cada uma diz o que dela fica FORA desta medida, e
 * por quê. A medida X exige que toda fonte tenha ao menos um estímulo
 * executado em cada viewport.
 */
const FONTES_DO_NAVEGADOR = [
  {
    fonte: "a moldura da janela",
    fora: "girar o aparelho como evento próprio (`orientationchange`): o Chromium de mesa não o emite; o efeito dele — largura e altura trocarem — está nos estímulos de largura e altura",
  },
  {
    fonte: "a aba",
    fora: "sair da página e voltar pelo cache do histórico (`pagehide`/`pageshow`/`freeze`/`resume`): a página que volta de lá é a do nascimento, e o nascimento é o que as medidas R, V e W já medem",
  },
  {
    fonte: "o endereço",
    fora: "navegar para OUTRA rota: sai de /linha-do-tempo, que é o alcance declarado desta guarda",
  },
  { fonte: "a rolagem", fora: "nada" },
  { fonte: "o teclado fora dos controles", fora: "nada" },
  {
    fonte: "o ponteiro fora dos controles",
    fora: "TOQUE (`touch*`) e caneta: o contexto desta guarda não tem tela sensível; arrastar e soltar ARQUIVO (`drop`) e COLAR (`paste`): exigem conteúdo de fora que a guarda não fabrica sem permissão de área de transferência",
  },
  {
    fonte: "o sistema",
    fora: "tela cheia (`fullscreenchange`: exige gesto e tela de verdade), sensores (`devicemotion`, `deviceorientation`, `gamepad*`, `devicechange`): não há hardware no Chromium sem tela",
  },
  {
    fonte: "outras janelas da mesma origem",
    fora: "`BroadcastChannel` e `SharedWorker`: só existem se o produto abrir o canal — e então o inventário os vê e o fecho cobra",
  },
];

/**
 * O QUE O NAVEGADOR FAZ A UMA PÁGINA ABERTA — todos, sempre, nesta ordem.
 * `produz` é o que a testemunha tem de ver para o estímulo contar como feito
 * (vazio quando a prova é só o estado: `matchMedia`, `devicePixelRatio`).
 * `ida`/`volta` é o estímulo; entre as duas, e depois da volta, a ausência de
 * `executarEstimulo`. Quem não tem volta diz por que em `semVolta`.
 */
const tema = trocarPreferencia("colorScheme", "(prefers-color-scheme: dark)", "dark", "light");
const movimento = trocarPreferencia("reducedMotion", "(prefers-reduced-motion: reduce)", "reduce", "no-preference");
const botaoEsquerdo = botaoDoMouse("left");
const botaoDireito = botaoDoMouse("right");
const ESTIMULOS_DO_NAVEGADOR = [
  { fonte: "a moldura da janela", nome: "redimensionar a LARGURA da janela", produz: ["resize"], ida: larguraIda, volta: larguraVolta },
  { fonte: "a moldura da janela", nome: "redimensionar a ALTURA da janela", produz: ["resize"], ida: alturaIda, volta: alturaVolta },
  { fonte: "a moldura da janela", nome: "trocar a densidade de pixels (zoom do navegador)", produz: [], ida: densidadeIda, volta: densidadeVolta },
  { fonte: "a aba", nome: "sair da aba e voltar", produz: ["visibilitychange"], ida: abaIda, volta: abaVolta },
  { fonte: "a aba", nome: "a janela perder o foco e recuperar", produz: ["blur", "focus"], ida: focoIda, volta: focoVolta },
  {
    fonte: "o endereço",
    nome: "trocar o `#` da URL",
    produz: ["hashchange"],
    ida: trocarOPedacoDaUrl,
    semVolta: "o operador que troca o `#` fica no endereço novo; a volta pelo histórico é o estímulo seguinte",
  },
  { fonte: "o endereço", nome: "apertar VOLTAR no navegador", produz: ["popstate"], ida: historicoIda, volta: historicoVolta },
  {
    fonte: "a rolagem",
    nome: "rolar a página",
    produz: ["scroll"],
    ida: rolarAPagina,
    semVolta: "a página fica onde foi rolada — é o estado em que o operador a deixa",
  },
  { fonte: "o teclado fora dos controles", nome: "apertar uma tecla fora dos controles", produz: ["keydown", "keyup"], ida: teclaIda, volta: teclaVolta },
  { fonte: "o ponteiro fora dos controles", nome: "clicar num ponto neutro", produz: ["pointerdown", "pointerup", "click"], ...botaoEsquerdo },
  { fonte: "o ponteiro fora dos controles", nome: "clicar com o botão direito", produz: ["contextmenu"], ...botaoDireito },
  { fonte: "o ponteiro fora dos controles", nome: "passar o ponteiro pela página", produz: ["pointermove", "mousemove"], ida: ponteiroIda, volta: ponteiroVolta },
  { fonte: "o ponteiro fora dos controles", nome: "selecionar um trecho de texto", produz: ["selectionchange"], ida: selecaoIda, volta: selecaoVolta },
  { fonte: "o sistema", nome: "a rede cair e voltar", produz: ["offline", "online"], ida: redeIda, volta: redeVolta },
  { fonte: "o sistema", nome: "trocar o tema do sistema (claro ↔ escuro)", produz: [], ...tema },
  { fonte: "o sistema", nome: "ligar e desligar o movimento reduzido", produz: [], ...movimento },
  { fonte: "o sistema", nome: "pedir para imprimir e cancelar", produz: ["beforeprint", "afterprint"], ida: imprimirIda, volta: imprimirVolta },
  { fonte: "o sistema", nome: "trocar o idioma do sistema", produz: ["languagechange"], ida: idiomaIda, volta: idiomaVolta },
  {
    fonte: "outras janelas da mesma origem",
    nome: "outra aba gravar no armazenamento",
    produz: ["storage"],
    ida: async (pagina) => await gravarNaOutraAba(pagina, "gravar"),
    volta: async (pagina) => await gravarNaOutraAba(pagina, "apagar"),
  },
  {
    fonte: "outras janelas da mesma origem",
    nome: "chegar uma mensagem de outra janela",
    produz: ["message"],
    ida: chegaUmaMensagem,
    semVolta: "uma mensagem chega e pronto: não há estado a desfazer",
  },
];

/** E a ausência que cada passo do ROTEIRO segurou, medida — contada na medida X. */
const AUSENCIAS_DO_ROTEIRO = new Map();
function registrarAusenciaDoRoteiro(largura, altura, nome, ms) {
  const chave = `${String(largura)}×${String(altura)}`;
  if (!AUSENCIAS_DO_ROTEIRO.has(chave)) AUSENCIAS_DO_ROTEIRO.set(chave, new Map());
  AUSENCIAS_DO_ROTEIRO.get(chave).set(nome, ms);
}

/**
 * As voltas da medida Z, por viewport e estímulo: a duração PEDIDA e a fora
 * MEDIDA no relógio da página. Preenchido na Z e CONTADO na X — fora dela.
 */
const VOLTAS_DA_GRADE = new Map();
function registrarVoltasDaGrade(largura, altura, nome, voltas) {
  const chave = `${String(largura)}×${String(altura)}`;
  if (!VOLTAS_DA_GRADE.has(chave)) VOLTAS_DA_GRADE.set(chave, new Map());
  VOLTAS_DA_GRADE.get(chave).set(nome, voltas);
}

/** Os tipos que a testemunha conta: o que os estímulos declaram produzir. */
const TIPOS_DA_TESTEMUNHA = [...new Set(ESTIMULOS_DO_NAVEGADOR.flatMap((e) => e.produz))];

/**
 * Onde cada sentinela de uso registra os estímulos que de fato executou — e
 * QUANTO o relógio da página andou fora e depois da volta, medido. É
 * preenchido dentro da medida Y e CONTADO na medida X — fora dela.
 */
const ESTIMULOS_EXECUTADOS = new Map();
function registrarEstimuloExecutado(largura, altura, nome, ausencias) {
  const chave = `${String(largura)}×${String(altura)}`;
  if (!ESTIMULOS_EXECUTADOS.has(chave)) ESTIMULOS_EXECUTADOS.set(chave, new Map());
  ESTIMULOS_EXECUTADOS.get(chave).set(nome, ausencias);
}

/**
 * Executa UM estímulo: a ida, a AUSÊNCIA no relógio da página com o estado
 * alterado, a volta, e outra ausência inteira depois da volta. As duas provas
 * do lado do navegador (o estado mudou; a testemunha viu os eventos) e as duas
 * ausências MEDIDAS no relógio da página. Qualquer prova que falhe é
 * precondição falha, com nome.
 */
async function executarEstimulo(estimulo, pagina, sentinela) {
  const antes = await lerTestemunha(pagina);
  const estado = {};
  let ditoIda = "";
  await precondicao(estimulo.nome, async () => {
    ditoIda = await estimulo.ida(pagina, sentinela, estado);
  });
  let fora = 0;
  let erroDaAusencia = null;
  try {
    fora = await ausencia(pagina);
  } catch (erro) {
    erroDaAusencia = erro;
  }
  /* A volta roda mesmo se a ausência falhou: rede fora, tecla apertada ou
     mídia de impressão não podem vazar para o estímulo seguinte. */
  let ditoVolta = null;
  if (typeof estimulo.volta === "function") {
    await precondicao(`${estimulo.nome} — a volta`, async () => {
      ditoVolta = await estimulo.volta(pagina, sentinela, estado);
    });
  }
  if (erroDaAusencia !== null) throw erroDaAusencia;
  const depoisDaVolta = await ausencia(pagina);
  const depois = await lerTestemunha(pagina);
  const mudos = estimulo.produz.filter((tipo) => (depois[tipo] ?? 0) <= (antes[tipo] ?? 0));
  if (mudos.length > 0) {
    throw new PrecondicaoFalhou(
      `o estímulo "${estimulo.nome}" não produziu ${mudos.map((t) => `\`${t}\``).join(", ")} segundo a testemunha da guarda — medir o teclado depois dele seria medir a mesma tela de sempre`,
    );
  }
  registrarEstimuloExecutado(sentinela.largura, sentinela.altura, estimulo.nome, { fora, depoisDaVolta });
  const vistos = estimulo.produz.map((t) => `${t}×${String((depois[t] ?? 0) - (antes[t] ?? 0))}`);
  const trajeto = `${ditoIda} · ${duracaoEmGente(fora)} fora${ditoVolta === null ? "" : ` · ${ditoVolta}`} · ${duracaoEmGente(depoisDaVolta)} depois`;
  return vistos.length === 0 ? trajeto : `${trajeto}; testemunha: ${vistos.join(" ")}`;
}

/** Descreve uma anotação do vigia em uma linha de gente. */
function descreverAnotacao(m) {
  return `${m.atributo} ${m.de}→${m.para} em ${m.alvo}${m.linha === null ? "" : ` [linha ${m.linha}]`} aos ${(m.aosMs / 1000).toFixed(1)}s (rede: ${m.rede})`;
}

/**
 * Compara a fotografia do nascimento com a do fim e devolve, em português, o
 * que envelheceu. Esta é a rede que mede o PRODUTO: ela não depende de o vigia
 * ter sobrevivido nem de o sabotador ter usado uma escrita conhecida.
 */
function oQueEnvelheceu(foto0, foto1) {
  const problemas = [];
  const por0 = new Map(foto0.universo.map((c) => [c.id, c]));
  const por1 = new Map(foto1.universo.map((c) => [c.id, c]));
  const sumiram = foto0.universo.filter((c) => !por1.has(c.id));
  const nasceram = foto1.universo.filter((c) => !por0.has(c.id));
  if (sumiram.length > 0) {
    problemas.push(
      `${String(sumiram.length)} controle(s) que existiam no nascimento SUMIRAM da tela: ${sumiram
        .slice(0, 4)
        .map((c) => `<${c.tag}> "${c.nome}"`)
        .join(" · ")}`,
    );
  }
  if (nasceram.length > 0) {
    problemas.push(
      `${String(nasceram.length)} controle(s) APARECERAM sem ninguém tocar na página: ${nasceram
        .slice(0, 4)
        .map((c) => `<${c.tag}> "${c.nome}"`)
        .join(" · ")}`,
    );
  }
  const mudaram = [];
  for (const c of foto1.universo) {
    const antes = por0.get(c.id);
    if (antes === undefined) continue;
    for (const campo of CAMPOS_DO_CONTRATO_DE_FOCO) {
      if (String(antes[campo]) !== String(c[campo])) {
        mudaram.push(`${campo} ${String(antes[campo])}→${String(c[campo])} em <${c.tag}> "${c.nome}"`);
      }
    }
  }
  if (mudaram.length > 0) {
    problemas.push(
      `${String(mudaram.length)} mudança(s) de contrato de foco entre o nascimento e o fim: ${mudaram
        .slice(0, 4)
        .join(" · ")}`,
    );
  }
  const alcancados0 = new Set(foto0.alcancadosIds);
  const perderamOTab = foto1.universo.filter(
    (c) => alcancados0.has(c.id) && !foto1.alcancadosIds.includes(c.id),
  );
  if (perderamOTab.length > 0) {
    problemas.push(
      `${String(perderamOTab.length)} de ${String(foto0.alcancadosIds.length)} controles que o Tab alcançava no nascimento SAÍRAM da ordem do Tab: ${perderamOTab
        .slice(0, 4)
        .map((c) => `<${c.tag}> "${c.nome}"${c.tabindex === null ? "" : ` [tabindex=${c.tabindex}]`}`)
        .join(" · ")}`,
    );
  }
  return problemas;
}

/**
 * O estado ABSOLUTO no fim: não basta "não mudou" — o teclado tem de alcançar,
 * AGORA, tudo o que a tela oferece. Sem isto, uma sentinela que nascesse já
 * quebrada ficaria verde por coerência consigo mesma (a forma 1 do vício).
 */
function oQueFaltaAgora(foto, quando) {
  const problemas = [];
  if (foto.universo.length < PISO_DE_CONTROLES) {
    problemas.push(
      `${quando}: a página só declara ${String(foto.universo.length)} controle(s) visível(is) (piso escrito à mão: ${String(PISO_DE_CONTROLES)}) — medir isto seria medir nada`,
    );
  }
  if (foto.linhas < LINHAS_DA_FIXTURE) {
    problemas.push(
      `${quando}: a coluna tem ${String(foto.linhas)} botões de linha visíveis e a fixture desenha ${String(LINHAS_DA_FIXTURE)}`,
    );
  }
  if (foto.faltando.length > 0) {
    problemas.push(
      `${quando}: ${String(foto.faltando.length)} de ${String(foto.universo.length)} controles visíveis NÃO são alcançáveis por Tab: ${foto.faltando
        .slice(0, 4)
        .map((c) => `<${c.tag}> "${c.nome}"${c.tabindex === null ? "" : ` [tabindex=${c.tabindex}]`}`)
        .join(" · ")}`,
    );
  }
  return problemas;
}

/**
 * [ALTO 1] A regressão entre DUAS varreduras: controle que o Tab alcançava
 * antes desta interação, continua na tela e não é mais alcançado. `oQueEnvelheceu`
 * não serve aqui — numa página USADA, controle que nasce (a gaveta que abriu) e
 * controle que some (a gaveta que fechou) são o comportamento certo, não defeito.
 * O que nunca pode acontecer é o teclado PERDER o que já alcançava.
 */
function oQuePerdeuOTab(antes, depois, quando) {
  const problemas = [];
  const alcancadosAntes = new Set(antes.alcancadosIds);
  const alcancadosAgora = new Set(depois.alcancadosIds);
  const perderam = depois.universo.filter(
    (c) => alcancadosAntes.has(c.id) && !alcancadosAgora.has(c.id),
  );
  if (perderam.length > 0) {
    problemas.push(
      `${quando}: ${String(perderam.length)} de ${String(alcancadosAntes.size)} controles que o Tab alcançava ANTES desta interação saíram da ordem do Tab: ${perderam
        .slice(0, 4)
        .map((c) => `<${c.tag}> "${c.nome}"${c.tabindex === null ? "" : ` [tabindex=${c.tabindex}]`}`)
        .join(" · ")}`,
    );
  }
  return problemas;
}

/**
 * [ALTO 1] O vigia, lido com a régua do USO. Na aba intocada (V e W) QUALQUER
 * escrita no contrato de foco depois do nascimento é suspeita, porque ninguém
 * tocou na página. Numa aba que está sendo usada isso não vale: abrir e fechar
 * a gaveta faz o React escrever. O que continua proibido é a escrita que MATA
 * o teclado — `tabindex` negativo, ou `disabled`/`inert`/`hidden`/`aria-hidden`
 * ligados num controle. É a classe, não o caso do coordenador.
 */
const ATRIBUTOS_QUE_TIRAM_DO_TECLADO = ["disabled", "inert", "hidden", "aria-hidden", "aria-disabled"];

function oQueOVigiaViuNoUso(vigia) {
  const problemas = [];
  if (!vigia.instalado) {
    problemas.push(
      `o vigia do contrato de foco não respondeu nesta página${vigia.quebrou === undefined ? "" : `: ${vigia.quebrou}`} — sem ele, a terceira rede não existe`,
    );
    return problemas;
  }
  if (vigia.marco === null) {
    problemas.push("o vigia nunca foi marcado no nascimento — não dá para separar montagem de uso");
    return problemas;
  }
  const matadoras = vigia.depois.filter((m) => {
    if (m.atributo === "tabindex") return Number(m.para) < 0;
    if (!ATRIBUTOS_QUE_TIRAM_DO_TECLADO.includes(m.atributo)) return false;
    return m.para !== "null" && m.para !== "false" && m.para !== "undefined";
  });
  if (matadoras.length > 0) {
    problemas.push(
      `o vigia anotou ${String(matadoras.length)} escrita(s) que TIRAM um controle do teclado durante o uso: ${matadoras
        .slice(0, 3)
        .map(descreverAnotacao)
        .join(" · ")}`,
    );
  }
  return problemas;
}

/** O que o vigia viu depois do nascimento, transformado em problema nomeado. */
function oQueOVigiaViu(vigia) {
  const problemas = [];
  if (!vigia.instalado) {
    problemas.push(
      `o vigia do contrato de foco não respondeu nesta página${vigia.quebrou === undefined ? "" : `: ${vigia.quebrou}`} — sem ele, a terceira rede não existe`,
    );
    return problemas;
  }
  if (vigia.marco === null) {
    problemas.push("o vigia nunca foi marcado no nascimento — não dá para separar montagem de envelhecimento");
    return problemas;
  }
  if (vigia.depois.length > 0) {
    problemas.push(
      `o vigia anotou ${String(vigia.depois.length)} escrita(s) no contrato de foco DEPOIS do nascimento: ${vigia.depois
        .slice(0, 3)
        .map(descreverAnotacao)
        .join(" · ")}`,
    );
  }
  return problemas;
}

/** `rgb(…)`/`rgba(…)` → `[r, g, b, a]`. */
function corEmCanais(css) {
  const n = (css.match(/[\d.]+/g) ?? []).map(Number);
  return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
}

function luminancia([r, g, b]) {
  const canal = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function razao(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/*
 * [ALTO 1, rodada 14] O PISO DE "DÁ PARA ENXERGAR", LIDO DE FORA.
 *
 * Vem de `scripts/checar-contraste.mjs` — outro portão, outra régua (WCAG
 * 1.4.11), nenhuma relação com quem decide a cor das camadas desta tela. Se
 * ele morasse aqui, ou no componente, ou no tema, quem baixasse a opacidade
 * poderia baixar o piso no mesmo commit: a guarda contaria a si mesma, que é
 * a forma 1 do vício desta base. A leitura falha FECHADA (lança) quando a
 * tabela de lá muda de forma — piso chutado é piso que não existe.
 */
const PISOS_DE_CONTRASTE = pisosDeContraste();
const PISO_NAO_TEXTO = PISOS_DE_CONTRASTE.naoTexto;

/* ═══════════════════════════════════════════════════════════════════════════
 * RODADA 12 · O PIXEL, NÃO O ATRIBUTO DECLARADO (achado CRÍTICO 1)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A medida A da rodada 11 dizia, no PRÓPRIO COMENTÁRIO, medir "a faixa do
 * Hoje como o navegador a pinta" — e lia três canais que `opacity` não toca:
 * `borderLeftColor`, `borderLeftWidth` e `getBoundingClientRect().height`.
 * Uma classe `opacity-0` na faixa apagou 1.134 px de dourado da tela com os
 * CINCO portões verdes, e a medida A imprimiu, sobre a faixa apagada,
 * "2/2 faixas com alfa > 0, ≥ 2px e altura > 0". Medido em pixel: 240 pixels
 * dourados na coluna da faixa viraram 0.
 *
 * A ironia é a lição — o arquivo JÁ TINHA a ferramenta certa: o ajudante da
 * medida I sobe a árvore compondo `opacity` e alfa. A medida A não usava. Daí
 * a regra desta rodada, que vale para toda medida deste arquivo:
 *
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ NENHUMA medida de "isto está visível?" pode ler atributo declarado.  │
 *   │ Ou compõe o alfa REAL subindo a árvore, ou AMOSTRA O PIXEL que o     │
 *   │ compositor do navegador pintou. As afirmações que sustentam a peça   │
 *   │ (a régua, as barras, os rótulos datados) fazem as DUAS coisas.       │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * ## Por que a amostra de pixel é feita COM E SEM o elemento
 *
 * A primeira versão desta ferramenta comparava a coluna do elemento com uma
 * coluna de controle 8 px ao lado. Duas sabotagens minhas passaram por ela:
 * pintar o FUNDO do canvas da cor da faixa (a coluna do elemento fica cheia
 * de dourado sem faixa nenhuma), e mover a faixa para debaixo de outro
 * elemento dourado. A geometria do controle é sempre um chute.
 *
 * A versão abaixo não chuta: tira a foto da mesma janelinha DUAS vezes, a
 * segunda com `visibility: hidden` no próprio elemento, e exige as duas
 * coisas ao mesmo tempo —
 *
 *   (a) os pixels de lá estão na cor que o elemento DECLARA (senão a medida
 *       aprovaria um elemento que pinta qualquer coisa), e
 *   (b) esconder o elemento MUDA aqueles pixels (senão quem pinta é outro).
 *
 * `opacity: 0` cai em (b): a foto com e sem o elemento é idêntica. Fundo
 * pintado da cor da faixa cai em (b) também. Cor trocada cai em (a). É a
 * propriedade da classe, não o número de uma sabotagem específica.
 */

/** ── PNG → pixels, com `node:zlib` e nada mais (nenhum pacote novo). ────── */
function lerPng(buffer) {
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("não é PNG");
  let pos = 8;
  let largura = 0;
  let altura = 0;
  let profundidade = 0;
  let tipoDeCor = -1;
  let entrelacado = 0;
  const pedacos = [];
  while (pos + 8 <= buffer.length) {
    const tamanho = buffer.readUInt32BE(pos);
    const tipo = buffer.toString("ascii", pos + 4, pos + 8);
    const dados = buffer.subarray(pos + 8, pos + 8 + tamanho);
    if (tipo === "IHDR") {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      profundidade = dados[8];
      tipoDeCor = dados[9];
      entrelacado = dados[12];
    } else if (tipo === "IDAT") pedacos.push(Buffer.from(dados));
    else if (tipo === "IEND") break;
    pos += 12 + tamanho;
  }
  if (profundidade !== 8 || entrelacado !== 0 || ![0, 2, 4, 6].includes(tipoDeCor)) {
    throw new Error(
      `PNG fora do que este decodificador lê: bits=${String(profundidade)} cor=${String(tipoDeCor)} entrelaçado=${String(entrelacado)}`,
    );
  }
  const canais = { 0: 1, 2: 3, 4: 2, 6: 4 }[tipoDeCor];
  const cru = zlib.inflateSync(Buffer.concat(pedacos));
  const linhaBytes = largura * canais;
  const saida = Buffer.alloc(altura * linhaBytes);
  let p = 0;
  for (let y = 0; y < altura; y += 1) {
    const filtro = cru[p];
    p += 1;
    const linha = cru.subarray(p, p + linhaBytes);
    p += linhaBytes;
    const destino = saida.subarray(y * linhaBytes, (y + 1) * linhaBytes);
    const acima = y > 0 ? saida.subarray((y - 1) * linhaBytes, y * linhaBytes) : null;
    for (let x = 0; x < linhaBytes; x += 1) {
      const bruto = linha[x];
      const a = x >= canais ? destino[x - canais] : 0;
      const b = acima ? acima[x] : 0;
      const c = acima && x >= canais ? acima[x - canais] : 0;
      let valor;
      if (filtro === 0) valor = bruto;
      else if (filtro === 1) valor = bruto + a;
      else if (filtro === 2) valor = bruto + b;
      else if (filtro === 3) valor = bruto + ((a + b) >> 1);
      else if (filtro === 4) {
        const pr = a + b - c;
        const pa = Math.abs(pr - a);
        const pb = Math.abs(pr - b);
        const pc = Math.abs(pr - c);
        valor = bruto + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`filtro PNG desconhecido: ${String(filtro)}`);
      destino[x] = valor & 0xff;
    }
  }
  return { largura, altura, canais, dados: saida };
}

/** O pixel `(x, y)` como `[r, g, b]`. */
function pixelEm(img, x, y) {
  const i = (y * img.largura + x) * img.canais;
  if (img.canais >= 3) return [img.dados[i], img.dados[i + 1], img.dados[i + 2]];
  const v = img.dados[i];
  return [v, v, v];
}

/** Distância máxima por canal entre duas cores — tolerância de antialias. */
function distanciaDeCor(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** Quantos pixels da janelinha estão a ≤ `tolerancia` da cor alvo. */
function contarNaCor(img, alvo, tolerancia) {
  let n = 0;
  for (let y = 0; y < img.altura; y += 1) {
    for (let x = 0; x < img.largura; x += 1) {
      if (distanciaDeCor(pixelEm(img, x, y), alvo) <= tolerancia) n += 1;
    }
  }
  return n;
}

/** Quantos pixels mudaram entre duas janelinhas do mesmo tamanho. */
function contarDiferentes(a, b) {
  if (a.largura !== b.largura || a.altura !== b.altura) return -1;
  let n = 0;
  for (let y = 0; y < a.altura; y += 1) {
    for (let x = 0; x < a.largura; x += 1) {
      if (distanciaDeCor(pixelEm(a, x, y), pixelEm(b, x, y)) > 2) n += 1;
    }
  }
  return n;
}

const TOLERANCIA_DE_COR = 14;
const ALTURA_MAX_AMOSTRA = 48;

/**
 * [ALTO 1, rodada 14] A SEGUNDA PERGUNTA: **dá para um humano enxergar?**
 *
 * A primeira pergunta — "é a cor certa?" — compara o pixel com a cor que o
 * elemento DECLARA, e essa expectativa já embute o `opacity` dele. No modelo
 * `P = α·C + (1 − α)·B`, baixar α muda o pixel e muda a expectativa junto:
 * `opacity: 0.12` mantém o pixel "em cima da linha" e mantém "os pixels mudam
 * ao esconder" verdadeiro. Foi assim que 9,89:1 virou 1,18:1 com a guarda
 * inteira verde.
 *
 * Esta função não olha para cor declarada nenhuma. Ela compara, pixel a
 * pixel, a foto COM o elemento e a foto SEM ele: o primeiro é o pixel
 * composto que o operador vê, o segundo é o fundo REAL daquele mesmo lugar
 * (não um fundo calculado, não o fundo do ancestral — o que está lá quando o
 * elemento sai). A razão entre os dois é a régua da WCAG, e o piso vem de
 * fora (`PISO_NAO_TEXTO`).
 *
 * Só entram os pixels que o elemento MUDA — os outros não são dele. Pixel que
 * ele não muda já é reprovado pela conta de `mudaram`, na outra pergunta.
 */
function contrasteContraOFundoReal(comEle, semEle, piso) {
  if (comEle.largura !== semEle.largura || comEle.altura !== semEle.altura) {
    return { legiveis: 0, alterados: 0, melhor: 1, erro: "as duas fotos saíram de tamanhos diferentes" };
  }
  let legiveis = 0;
  let alterados = 0;
  let melhor = 1;
  for (let y = 0; y < comEle.altura; y += 1) {
    for (let x = 0; x < comEle.largura; x += 1) {
      const c = pixelEm(comEle, x, y);
      const f = pixelEm(semEle, x, y);
      if (distanciaDeCor(c, f) <= 2) continue;
      alterados += 1;
      const r = razao(c, f);
      if (r > melhor) melhor = r;
      if (r >= piso) legiveis += 1;
    }
  }
  return { legiveis, alterados, melhor };
}

/**
 * A ferramenta central: **este elemento pinta, de verdade, na cor que ele
 * declara?** Duas fotos da mesma janelinha de 3 px de largura dentro da
 * caixa do elemento — a segunda com ele escondido.
 *
 * Devolve `{ ok, motivo, naCor, mudaram, total }`. `ok` exige as duas coisas:
 * pixels na cor declarada E pixels que MUDAM quando o elemento sai. Alvo que
 * não tem caixa de layout, ou que está fora da janela de visão, é REPROVA com
 * motivo escrito — nunca dispensa (checagem pulada é checagem aprovada).
 */
async function pintaDeVerdade(pagina, alvo, corDeclarada, minimoDePixels = 6, modo = "coluna") {
  let caixa = null;
  const vistaInicial = pagina.viewportSize();
  try {
    /*
     * A página é mais alta que a janela de visão, e um `clip` de screenshot
     * vive em coordenadas da JANELA. Na 1ª versão desta varredura, 13 de 31
     * camadas devolveram "a caixa não tem 3px dentro da janela de visão" — e
     * uma medida que se dispensa por não alcançar o alvo é uma medida que
     * aprova. Então se rola até o alvo; se nem assim couber, é REPROVAÇÃO com
     * o motivo escrito.
     *
     * Mas SÓ se rola quando é preciso, e foi assim que a 2ª versão errou: a
     * faixa do "Hoje" tem 1.218px de altura e o `scrollIntoViewIfNeeded`
     * empurrava o topo dela para cima da janela; a janelinha de 3px, medida a
     * partir do topo, caía então no CABEÇALHO GRUDADO — que tem a sua própria
     * faixa dourada, da mesma cor. Resultado: a cor batia e esconder a faixa
     * do canvas não mudava pixel nenhum, porque quem pintava ali era a outra.
     * A amostra passa a ser tirada no CENTRO da parte visível da caixa.
     */
    caixa = await alvo.boundingBox();
    const cruza =
      caixa !== null &&
      Math.min(vistaInicial.height, caixa.y + caixa.height) - Math.max(0, caixa.y) >= 4;
    if (!cruza) {
      await alvo.scrollIntoViewIfNeeded();
      await alvo.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
      );
      caixa = await alvo.boundingBox();
    }
  } catch {
    return { ok: false, motivo: "o alvo saiu do DOM antes de ser fotografado" };
  }
  if (!caixa || caixa.width <= 0 || caixa.height <= 0) {
    return { ok: false, motivo: `sem caixa de layout (${JSON.stringify(caixa)})` };
  }
  const vista = pagina.viewportSize();
  const topoVisivel = Math.max(0, Math.ceil(caixa.y) + 1);
  const baseVisivel = Math.min(vista.height - 1, Math.floor(caixa.y + caixa.height) - 1);
  const altura = Math.min(ALTURA_MAX_AMOSTRA, baseVisivel - topoVisivel);
  if (altura < 3) {
    return {
      ok: false,
      motivo: `a caixa não tem 3px dentro da janela de visão (topo ${caixa.y.toFixed(1)}, alt ${caixa.height.toFixed(1)}, janela ${String(vista.height)})`,
    };
  }
  /* No CENTRO da parte visível — longe do cabeçalho grudado e de qualquer
     borda onde outro elemento da mesma cor possa estar pintando. */
  const centro = (topoVisivel + baseVisivel) / 2;
  const y0 = Math.max(topoVisivel, Math.min(baseVisivel - altura, Math.round(centro - altura / 2)));
  /*
   * `coluna`: 3px na BORDA ESQUERDA da caixa — é onde vive o desenho de um
   * elemento de 2px (faixa, guia, traço de prazo) e ainda está dentro de um
   * de 200px (barra). Uma fórmula para os dois, sem caso especial.
   *
   * `caixa`: a caixa inteira (até 48px de altura). Necessário para TEXTO — um
   * glifo tem vão entre as hastes, e uma coluna de 3px pode cair no vão e
   * contar zero pixel da cor do texto sem que nada esteja errado — e para as
   * camadas TRANSLÚCIDAS (a hachura de folga: `bg-…/30` + `opacity-70` + um
   * gradiente repetido), cuja cor na tela é uma composição, não a declarada.
   * Nesses dois casos o que se exige é o teste que não depende de cor: ESCONDER
   * O ELEMENTO TEM DE MUDAR PIXEL. `opacity-0` cai nele igual.
   */
  const emCaixa = modo === "caixa";
  const larguraJanela = emCaixa
    ? Math.max(3, Math.min(Math.floor(caixa.width), vista.width - Math.max(0, Math.floor(caixa.x))))
    : 3;
  const x0 = emCaixa
    ? Math.max(0, Math.min(vista.width - larguraJanela, Math.floor(caixa.x)))
    : Math.max(0, Math.min(vista.width - 3, Math.round(caixa.x + Math.min(caixa.width, 6) / 2 - 1)));
  const janela = { x: x0, y: y0, width: larguraJanela, height: altura };
  const total = larguraJanela * altura;
  let comEle;
  let semEle;
  let anterior = "";
  try {
    comEle = lerPng(await pagina.screenshot({ clip: janela }));
    anterior = await alvo.evaluate((el) => {
      const v = el.style.visibility;
      el.style.visibility = "hidden";
      return v;
    });
    semEle = lerPng(await pagina.screenshot({ clip: janela }));
  } catch (e) {
    return { ok: false, motivo: `não consegui fotografar: ${String(e.message ?? e)}` };
  } finally {
    try {
      await alvo.evaluate((el, v) => {
        el.style.visibility = v;
      }, anterior);
    } catch {
      /* alvo já saiu do DOM; a próxima navegação recria a página de qualquer forma */
    }
  }
  const alvoCor = corEmCanais(corDeclarada);
  const naCor = contarNaCor(comEle, alvoCor, TOLERANCIA_DE_COR);
  const mudaram = contarDiferentes(comEle, semEle);
  /*
   * [ALTO 1, rodada 14] A SEGUNDA PERGUNTA, sempre — e o piso dela vem de
   * `scripts/checar-contraste.mjs`, nunca daqui. `minimoDeLegiveis` é o mesmo
   * número de pixels exigido nas outras duas contas: um punhado de pixels
   * antialiasados na borda não é "um elemento visível", e a faixa a 12% de
   * opacidade não produz NENHUM.
   */
  const contraste = contrasteContraOFundoReal(comEle, semEle, PISO_NAO_TEXTO);
  const minimoDeLegiveis = minimoDePixels;
  const ok =
    mudaram >= minimoDePixels &&
    (emCaixa || naCor >= minimoDePixels) &&
    contraste.legiveis >= minimoDeLegiveis;
  return {
    ok,
    naCor,
    mudaram,
    total,
    contraste,
    motivo: ok
      ? ""
      : mudaram < minimoDePixels
        ? `esconder o elemento mudou só ${String(mudaram)}/${String(total)} pixels (mínimo ${String(minimoDePixels)}) — ele não pinta nada ali`
        : !emCaixa && naCor < minimoDePixels
          ? `só ${String(naCor)}/${String(total)} pixels na cor declarada ${corDeclarada} (mínimo ${String(minimoDePixels)})`
          : `o que ele pinta NÃO SE DISTINGUE do fundo real daquele lugar: só ${String(
              contraste.legiveis,
            )}/${String(contraste.alterados)} pixels alterados chegam a ${PISO_NAO_TEXTO.toFixed(
              1,
            )}:1 (mínimo ${String(minimoDeLegiveis)}); melhor razão medida ${contraste.melhor.toFixed(
              2,
            )}:1 — piso lido de ${ARQUIVO_DO_PISO}${contraste.erro ? ` · ${contraste.erro}` : ""}`,
  };
}

/**
 * ── O ALFA REAL, COMPOSTO SUBINDO A ÁRVORE ────────────────────────────────
 *
 * Instalado em toda página ANTES do carregamento (`addInitScript`), para
 * qualquer `evaluate` poder usar. É o ajudante que a medida I já tinha e que
 * a medida A não usava — agora é de todo mundo.
 */
const AJUDANTES_NA_PAGINA = `
window.__lbg = {
  canais(css) {
    const n = (String(css).match(/[\\d.]+/g) || []).map(Number);
    return [n[0] || 0, n[1] || 0, n[2] || 0, n[3] === undefined ? 1 : n[3]];
  },
  /** O produto de TODOS os \`opacity\` do elemento até a raiz. */
  opacidadeAcumulada(el) {
    let o = 1;
    let n = el;
    while (n && n.nodeType === 1) {
      const v = Number.parseFloat(getComputedStyle(n).opacity);
      o *= Number.isFinite(v) ? v : 1;
      n = n.parentElement;
    }
    return o;
  },
  /**
   * Qualquer cor CSS (inclusive \`oklab()\`, \`oklch()\`, \`color()\`) resolvida
   * para rgb/rgba pelo próprio motor — o canvas 2D normaliza \`fillStyle\`.
   * Sem isto, o Tailwind com modificador de opacidade (\`/70\`) devolve
   * \`oklab(...)\` e a conta de cor da guarda lia números sem sentido.
   */
  emRgb(css) {
    const cv = document.createElement("canvas").getContext("2d");
    cv.fillStyle = "#000";
    cv.fillStyle = css;
    const v = cv.fillStyle;
    if (v.startsWith("#")) {
      const h = v.length === 4
        ? [v[1] + v[1], v[2] + v[2], v[3] + v[3]]
        : [v.slice(1, 3), v.slice(3, 5), v.slice(5, 7)];
      return [Number.parseInt(h[0], 16), Number.parseInt(h[1], 16), Number.parseInt(h[2], 16), 1];
    }
    return this.canais(v);
  },
  compor(frente, fundo) {
    const a = frente[3];
    return [
      frente[0] * a + fundo[0] * (1 - a),
      frente[1] * a + fundo[1] * (1 - a),
      frente[2] * a + fundo[2] * (1 - a),
      1,
    ];
  },
  /**
   * O FUNDO REAL atrás do elemento — a mesma conta da medida I: sobe a
   * árvore, só aceita como fundo o ancestral cuja caixa CONTÉM a minha
   * (badges \`absolute\` nascem fora da caixa do pai e continuam filhos dele
   * no DOM), compõe alfa e \`opacity\` no caminho.
   */
  fundoReal(el) {
    const meu = el.getBoundingClientRect();
    const contem = (r) =>
      r.left - 0.5 <= meu.left && r.right + 0.5 >= meu.right &&
      r.top - 0.5 <= meu.top && r.bottom + 0.5 >= meu.bottom;
    const pilha = [];
    let n = el.parentElement;
    let fundo = null;
    while (n) {
      const c = getComputedStyle(n);
      const cor = this.emRgb(c.backgroundColor);
      const alfa = cor[3] * (Number.parseFloat(c.opacity) || 0);
      if (alfa > 0 && contem(n.getBoundingClientRect())) {
        pilha.push([cor[0], cor[1], cor[2], Math.min(1, alfa)]);
        if (alfa >= 0.999) { fundo = pilha.pop(); break; }
      }
      n = n.parentElement;
    }
    if (fundo === null) fundo = [5, 7, 15, 1];
    for (let i = pilha.length - 1; i >= 0; i -= 1) fundo = this.compor(pilha[i], fundo);
    return fundo;
  },
  /**
   * A cor que o compositor do navegador DEVE pintar neste canal do elemento:
   * a cor declarada, com o alfa dela vezes toda a cadeia de \`opacity\`,
   * composta sobre o fundo real. É contra ESTA cor que a amostra de pixel é
   * comparada — comparar com a cor declarada crua reprovava uma barra
   * correta com \`opacity-90\` (declarada rgb(127,184,255), pintada
   * rgb(115,166,231)) e teria virado mais um número ajustado à mão.
   */
  corEsperada(el, canal) {
    const cs = getComputedStyle(el);
    const bruta = this.emRgb(
      canal === "borda" ? cs.borderLeftColor : canal === "fundo" ? cs.backgroundColor : cs.color,
    );
    const op = this.opacidadeAcumulada(el);
    const c = this.compor([bruta[0], bruta[1], bruta[2], Math.min(1, bruta[3] * op)], this.fundoReal(el));
    return "rgb(" + Math.round(c[0]) + ", " + Math.round(c[1]) + ", " + Math.round(c[2]) + ")";
  },
  /**
   * Um retrato do que o navegador REALMENTE vai pintar deste elemento:
   * alfa composto da borda e do fundo, visibilidade herdada, área de layout
   * e recorte. Nada aqui é atributo declarado lido sozinho.
   */
  retrato(el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const op = this.opacidadeAcumulada(el);
    /* emRgb, e nunca canais: uma cor oklab(... / 0.7) tem o alfa depois de
       uma barra, e ler "o 4o numero" dela devolvia qualquer coisa. */
    const alfaDe = (css) => this.emRgb(css)[3] * op;
    let visivelHerdado = true;
    let n = el;
    while (n && n.nodeType === 1) {
      const c = getComputedStyle(n);
      if (c.visibility === "hidden" || c.visibility === "collapse" || c.display === "none") {
        visivelHerdado = false;
        break;
      }
      n = n.parentElement;
    }
    return {
      opacidadeAcumulada: op,
      visivelHerdado,
      largura: r.width,
      altura: r.height,
      corDaBorda: cs.borderLeftColor,
      larguraDaBorda: Number.parseFloat(cs.borderLeftWidth) || 0,
      alfaDaBorda: alfaDe(cs.borderLeftColor),
      corDoFundo: cs.backgroundColor,
      alfaDoFundo: alfaDe(cs.backgroundColor),
      corDoTexto: cs.color,
      alfaDoTexto: alfaDe(cs.color),
      /* A cor que o compositor deve pintar em cada canal (declarada × toda a
         cadeia de opacity, composta sobre o fundo real). */
      esperadaDaBorda: this.corEsperada(el, "borda"),
      esperadaDoFundo: this.corEsperada(el, "fundo"),
      esperadaDoTexto: this.corEsperada(el, "texto"),
      texto: (el.textContent || "").trim().slice(0, 40),
    };
  },
};
`;

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * O AQUECIMENTO — FORA DE QUALQUER MEDIDA  [MÉDIO 2, rodada 15]
 *
 * `esperarResponder` só batia em `/`. Quem pagava a compilação de
 * `/linha-do-tempo` pelo `next dev` era a primeira medida, dentro do teto de
 * 20 s do `waitForSelector` — e sob carga essa compilação passa disso. O
 * resultado era o `page.waitForSelector: Timeout 20000ms exceeded` que o
 * coordenador mediu três vezes: um portão vermelho por carga, que some quando
 * a máquina esvazia. Aqui a compilação é paga uma vez, com teto próprio e
 * generoso, e o tempo dela sai impresso.
 * ═══════════════════════════════════════════════════════════════════════════
 */
{
  const t0 = Date.now();
  console.log("%s", `[${carimbo()}] → aquecendo ${ROTA} (fora de medida) …`);
  let pronto = false;
  let motivo = "";
  try {
    const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
    const pagina = await contexto.newPage();
    await comTeto(
      (async () => {
        await pagina.goto(ROTA, { waitUntil: "networkidle", timeout: TETO_DO_AQUECIMENTO_MS });
        await pagina.waitForSelector(".lb-tl-hoje", {
          timeout: TETO_DO_AQUECIMENTO_MS,
          state: "attached",
        });
      })(),
      TETO_DO_AQUECIMENTO_MS,
      `o aquecimento de ${ROTA}`,
    );
    pronto = true;
    await contexto.close();
  } catch (erro) {
    motivo = erro instanceof Error ? erro.message.split("\n")[0] : String(erro);
  }
  const gastou = `${String(Math.round((Date.now() - t0) / 1000))}s`;
  if (!pronto) {
    /*
     * [MÉDIO, rodada 20] Mesma régua de `medir`: a rota que não fica de pé
     * porque a PÁGINA travou é o produto (código 1); a que não fica de pé
     * porque o servidor não compilou a tempo é "não medi" (código 2).
     */
    const vida = await sondarVida("o aquecimento");
    conferir(
      "aquecimento da rota",
      false,
      vida.travadas.length > 0
        ? `${motivo} — a página da rota TRAVOU: ${vida.travadas.join(" · ")}`
        : `${motivo} — nenhuma página travada (${vida.resumo}; controle ${vida.controle}; ${vida.carga}): é o SERVIDOR não ter subido a tempo, não um defeito do produto`,
      vida.travadas.length > 0 ? "produto" : "não medi",
    );
    encerrarAgora(`a rota ${ROTA} não ficou de pé em ${gastou}: ${motivo}\nNENHUMA medida rodou.`);
  }
  console.log("%s", `[${carimbo()}] ← aquecimento — ${gastou} (compilação do next dev paga fora de medida)`);
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * O NASCIMENTO DAS SENTINELAS DE TECLADO  [ALTO 1, rodada 15]
 *
 * Elas nascem AQUI, antes da primeira medida, e são lidas DEPOIS da última:
 * é a vida delas que dá o alcance de tempo das medidas V e W. O nascimento
 * não é medida — é precondição. Sentinela que não nasce não vira "defeito do
 * produto": vira, nas medidas V/W/X, uma reprovação que diz "a precondição
 * falhou" e nomeia o passo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * O que a guarda viu de controle em cada viewport NO INSTANTE DA CARGA —
 * alimenta o piso da medida X. Só leituras de página recém-aberta entram aqui:
 * a medida Y mede uma página EM USO, onde abrir a gaveta acrescenta controles
 * de verdade, e misturar as duas faria a sentinela parecer menor que a guarda
 * por um motivo que não é defeito nenhum.
 */
const UNIVERSO_VISTO_PELA_GUARDA = new Map();
function registrarUniverso(largura, altura, quantos) {
  const chave = `${String(largura)}×${String(altura)}`;
  const antes = UNIVERSO_VISTO_PELA_GUARDA.get(chave) ?? 0;
  if (quantos > antes) UNIVERSO_VISTO_PELA_GUARDA.set(chave, quantos);
}

/** O que a sentinela de INTERAÇÃO viu depois de usar a página, por viewport. */
const UNIVERSO_DEPOIS_DO_USO = new Map();
function registrarUniversoDoUso(largura, altura, quantos) {
  const chave = `${String(largura)}×${String(altura)}`;
  const antes = UNIVERSO_DEPOIS_DO_USO.get(chave) ?? 0;
  if (quantos > antes) UNIVERSO_DEPOIS_DO_USO.set(chave, quantos);
}

const SENTINELAS_DO_TECLADO = [];

/**
 * [ALTO 1] As TRÊS sentinelas de cada viewport, e o que cada uma cobre:
 *
 * | tipo | o que ela responde |
 * |---|---|
 * | `tempo real` | a aba ficou aberta a corrida inteira e ninguém tocou nela — algo tirou um controle do teclado? (medida V) |
 * | `relógio de mentira` | e se o relógio andar meia hora, duas vezes, com os controles exercidos no meio? (medida W) |
 * | `interação` | e depois de a página ser USADA — gaveta, zoom, roda, Enter, e tudo o que o navegador faz a uma página aberta, cada estado segurado por dias no relógio DELA? (medida Y) |
 *
 * A de `interação` é uma aba À PARTE de propósito: a fotografia comparada de
 * V e W só quer dizer alguma coisa numa aba INTOCADA, e clicar ali apagaria
 * justamente o que elas vigiam. Separar as duas perguntas é o que permite
 * responder as duas sem uma estragar a outra.
 */
const TIPOS_DE_SENTINELA = [
  { tipo: "tempo real", comRelogioDeMentira: false, comInventario: false },
  { tipo: "relógio de mentira", comRelogioDeMentira: true, comInventario: false },
  /* [ALTO, rodada 20] relógio da página sob controle: é o que deixa segurar
     um estado por DIAS sem esperar dias. */
  { tipo: "interação", comRelogioDeMentira: true, comInventario: true },
];

for (const [largura, altura] of VIEWPORTS_DO_TECLADO) {
  for (const { tipo, comRelogioDeMentira, comInventario } of TIPOS_DE_SENTINELA) {
    const nome = `${String(largura)}×${String(altura)} · ${tipo}`;
    const t0 = Date.now();
    console.log("%s", `[${carimbo()}] → nascendo a sentinela de teclado ${nome} …`);
    try {
      const { contexto, pagina, registroForaDaPagina } = await comTeto(
        abrir(largura, altura, { comRelogioDeMentira, comVigia: true, comInventario }),
        TETO_POR_MEDIDA_MS,
        `o nascimento da sentinela ${nome}`,
      );
      const foto = await comTeto(
        varrerTeclado(pagina),
        TETO_POR_MEDIDA_MS,
        `a varredura de nascimento da sentinela ${nome}`,
      );
      /*
       * O marco: daqui para a frente, toda anotação do vigia é
       * ENVELHECIMENTO. O que veio antes é a montagem do React — e a montagem
       * quem mede é esta fotografia, não o vigia.
       */
      const marco = await pagina.evaluate(() => window.__vigiaFocoP5?.marcar() ?? null);
      registrarUniverso(largura, altura, foto.universo.length);
      SENTINELAS_DO_TECLADO.push({
        nome,
        tipo,
        largura,
        altura,
        comRelogioDeMentira,
        comInventario,
        contexto,
        pagina,
        registroForaDaPagina,
        foto,
        marco,
        nascimento: Date.now(),
        ok: true,
      });
      console.log(
        "%s",
        `[${carimbo()}] ← sentinela ${nome} de pé — ${String(Math.round((Date.now() - t0) / 1000))}s · ${String(foto.universo.length)} controles, ${String(foto.alcancadosIds.length)} no Tab, ${String(foto.linhas)} botões de linha`,
      );
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message.split("\n")[0] : String(erro);
      SENTINELAS_DO_TECLADO.push({
        nome,
        tipo,
        largura,
        altura,
        comRelogioDeMentira,
        comInventario,
        ok: false,
        motivo,
        /* [MÉDIO, rodada 20] a causa, para `medir` saber se foi tempo. */
        erro,
      });
      console.log("%s", `[${carimbo()}] ← sentinela ${nome} NÃO nasceu — ${motivo}`);
    }
  }
}

// ── A · a faixa do "Hoje": alfa REAL composto + o PIXEL na tela ─────────────
/*
 * Rodada 12 (achado CRÍTICO 1). A versão anterior desta medida lia
 * `borderLeftColor`, `borderLeftWidth` e `height` — três canais que `opacity`
 * não toca. Agora ela faz as duas coisas que o cabeçalho deste bloco exige:
 * compõe o alfa subindo a árvore (`__lbg.retrato`) E fotografa a coluna da
 * faixa com e sem o elemento (`pintaDeVerdade`).
 *
 * A faixa do "Hoje" é a única âncora datada do canvas e a ORIGEM da régua da
 * medida H: se ela não está na tela, H está medindo contra uma régua que o
 * operador não vê.
 */
for (const [largura, altura] of [
  [1440, 1000],
  [390, 844],
]) {
  await medir(`A ` + `${String(largura)}×${String(altura)}`, async () => {
    const { contexto, pagina } = await abrir(largura, altura);
    const alvos = await pagina.$$(".lb-tl-hoje");
    const problemas = [];
    const detalhes = [];
    if (alvos.length === 0) problemas.push("nenhuma faixa do Hoje na página");
    for (const alvo of alvos) {
      const r = await alvo.evaluate((el) => window.__lbg.retrato(el));
      const pintou = await pintaDeVerdade(pagina, alvo, r.esperadaDaBorda, 8);
      const geometriaOk = r.larguraDaBorda >= 2 && r.altura > 0;
      const alfaOk = r.alfaDaBorda > 0 && r.visivelHerdado && r.opacidadeAcumulada > 0;
      if (!geometriaOk) problemas.push(`faixa com ${String(r.larguraDaBorda)}px × ${r.altura.toFixed(0)}px`);
      if (!alfaOk) {
        problemas.push(
          `faixa sem alfa REAL: opacidade acumulada ${r.opacidadeAcumulada.toFixed(3)}, alfa da borda ${r.alfaDaBorda.toFixed(3)}, visível herdado ${String(r.visivelHerdado)}`,
        );
      }
      if (!pintou.ok) problemas.push(`faixa não pinta na tela: ${pintou.motivo}`);
      detalhes.push(
        `${r.corDaBorda} ${String(r.larguraDaBorda)}px × ${r.altura.toFixed(0)}px · opacidade ${r.opacidadeAcumulada.toFixed(2)} · ${String(pintou.naCor ?? 0)}/${String(pintou.total ?? 0)} px na cor, ${String(pintou.mudaram ?? 0)} mudam ao esconder, ${String(
          pintou.contraste?.legiveis ?? 0,
        )} legíveis a ${PISO_NAO_TEXTO.toFixed(1)}:1 (melhor ${(pintou.contraste?.melhor ?? 0).toFixed(2)}:1, piso de ${ARQUIVO_DO_PISO})`,
      );
    }
    conferir(
      `A · faixa do "Hoje" PINTADA a ${largura}×${altura} (alfa composto + pixel)`,
      problemas.length === 0,
      problemas.length === 0
        ? `${String(alvos.length)}/${String(alvos.length)} faixas com alfa real > 0 e pixel na tela — ${detalhes.join(" · ")}`
        : problemas.join(" · "),
    );
    await contexto.close();
  });
}

// ── B · a folha inferior não tapa a linha tocada (S1) ───────────────────────
await medir("B", async () => {
    const { contexto, pagina } = await abrir(390, 844);
    const chaves = await pagina.$$eval('button[aria-haspopup="dialog"]', (els) =>
      els.map((el) => el.getAttribute("aria-label") ?? ""),
    );
    const ultimas = chaves.slice(-3);
    let piorArea = 0;
    const detalhes = [];
    for (const rotulo of ultimas) {
      await precondicao("recarregar a rota e esperar a faixa do Hoje", async () => {
        await pagina.reload({ waitUntil: "networkidle", timeout: TETO_DE_ACAO_MS });
        await pagina.waitForSelector(".lb-tl-hoje", { state: "attached", timeout: TETO_DE_ACAO_MS });
      });
      const botao = pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first();
      await precondicao(`abrir a gaveta de "${String(rotulo).slice(0, 28)}"`, async () => {
        await botao.scrollIntoViewIfNeeded();
        await botao.click({ timeout: TETO_DE_ACAO_MS });
        await pagina.waitForSelector("[data-lb-detalhe]", { timeout: TETO_DE_ACAO_MS });
      });
      // Dois quadros de `requestAnimationFrame` — o plano da folha é aplicado
      // dentro de um deles, e medir antes disso mediria o quadro errado.
      await assentar(pagina);
      const area = await pagina.evaluate((alvo) => {
        const botaoEl = document.querySelector(`button[aria-label="${CSS.escape(alvo).replace(/\\/g, "")}"]`)
          ?? [...document.querySelectorAll('button[aria-haspopup="dialog"]')].find(
            (b) => b.getAttribute("aria-label") === alvo,
          );
        const folha = document.querySelector("[data-lb-detalhe]");
        if (!botaoEl || !folha) return { area: -1, rotuloTop: null, folhaTop: null };
        const a = botaoEl.getBoundingClientRect();
        const f = folha.getBoundingClientRect();
        const larg = Math.max(0, Math.min(a.right, f.right) - Math.max(a.left, f.left));
        const alt = Math.max(0, Math.min(a.bottom, f.bottom) - Math.max(a.top, f.top));
        return {
          area: Math.round(larg * alt),
          rotuloTop: Math.round(a.top),
          folhaTop: Math.round(f.top),
        };
      }, rotulo);
      piorArea = Math.max(piorArea, area.area);
      detalhes.push(
        `"${rotulo.slice(0, 28)}": ${area.area} px² (rótulo em ${area.rotuloTop}, folha em ${area.folhaTop})`,
      );
    }
    conferir(
      "B · a folha inferior não tapa a linha tocada (390×844, 3 últimas linhas)",
      piorArea === 0,
      detalhes.join(" · "),
    );
    await contexto.close();
});

/**
 * Quantas vezes a medida C repete o clique até a gaveta virar a da linha
 * pedida. Escrito à mão: é o número de cliques perdidos que ela tolera antes
 * de dizer, com nome, que o estado não se estabeleceu.
 */
const CLIQUES_ATE_A_GAVETA_TROCAR = 3;

// ── C · a gaveta e o canvas dizem a MESMA coisa sobre a mesma linha ─────────
/*
 * Rodada 12 (achado MÉDIO 1). Esta medida tinha o nome de um invariante e o
 * corpo de dois `includes`: testava se a palavra "sem estimativa" aparecia
 * junto de duas datas. Ela NUNCA comparou o campo "Período" da gaveta com o
 * `title` do desenho da mesma linha — que é a frase de abertura da peça P5
 * ("as duas superfícies nunca mais digam coisas diferentes sobre a mesma
 * tarefa") e a razão de `periodo-da-tarefa.ts` existir. O invariante só vivia
 * num teste unitário sobre 3 tarefas, com árvore React falsa, enquanto a tela
 * real tem 24 linhas.
 *
 * Agora ela compara, linha por linha, nas 24: o "Período" da gaveta tem de
 * aparecer LITERALMENTE no texto do desenho daquela linha — a barra, o
 * losango, o ponto de conclusão ou o chevron de fora da janela. Quando a
 * linha não tem desenho nenhum no canvas (saiu da grade por falta de dado), a
 * frase tem de estar no `title` do rótulo, que é a superfície que sobra.
 *
 * Se uma linha não tem NENHUMA das duas, é reprovação: uma linha sobre a qual
 * só a gaveta fala é uma linha cuja data ninguém confere.
 *
 * ## [BAIXO 2, rodada 16] A MEDIDA LIA AS DUAS SUPERFÍCIES EM DOIS INSTANTES
 *
 * A rodada 15 viu esta medida reprovar UMA vez em 8 corridas — "Revisar PR do
 * time: gaveta '22/09/2026 → 23/09/2026' × canvas/rótulo 'início previsto
 * 22/09/2026 — duração não estimada'" — não reproduziu em 7 tentativas e
 * arquivou o caso como "intermitência preexistente". **Instabilidade não é
 * causa.** Reproduzido nesta rodada, em 8 voltas de uma sonda que lê, JUNTO
 * com o período, QUEM é a gaveta aberta (o `aria-labelledby` dela):
 *
 *     {"nome":"Deploy de produção","tituloDaGaveta":"Implementar motor HIERARQ",
 *      "periodo":"22/09/2026 → 25/09/2026","quantasGavetas":1,
 *      "textos":["Deploy de produção — 25/09/2026 → 26/09/2026 (folga: 0 d)"]}
 *
 * A gaveta lida era a da linha ANTERIOR. Havia uma só na tela, aberta desde a
 * volta passada: `waitForSelector("[data-lb-detalhe]")` a encontra no mesmo
 * instante do clique — o seletor já casa — e o `$eval` seguinte lê o texto
 * velho, enquanto o nome comparado já é o da linha nova. **Defeito da MEDIDA,
 * não do produto:** o componente decide a gaveta e o `title` pela mesma função
 * pura (`textoDoPeriodo`), sobre o mesmo objeto — as duas não conseguem
 * divergir no mesmo instante. Quem divergia eram os dois instantes.
 *
 * A cura tem duas partes, e nenhuma delas afrouxa a régua:
 *  1. **a gaveta lida tem de ser a da linha clicada** — espera-se pelo TÍTULO
 *     dela (o elemento que o `aria-labelledby` aponta), não pela existência de
 *     uma gaveta qualquer. Gaveta que nunca vira a certa é PRECONDIÇÃO falha,
 *     com nome, nunca uma divergência de produto;
 *  2. **as duas superfícies saem do mesmo `evaluate`** — um instante só, e o
 *     título volta junto para ser conferido na hora da leitura.
 */
await medir("C", async () => {
    const { contexto, pagina } = await abrir(1440, 1000);
    const rotulos = await pagina.$$eval('button[aria-haspopup="dialog"]', (els) =>
      els.map((el) => el.getAttribute("aria-label") ?? ""),
    );
    const contradicoes = [];
    const divergencias = [];
    const semSuperficie = [];
    let abertas = 0;
    let comparadas = 0;
    let cliquesRepetidos = 0;
    for (const rotulo of rotulos) {
      const botao = pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first();
      const nome = (/^(.*?) — /.exec(rotulo)?.[1] ?? rotulo).trim();
      await precondicao(`abrir a gaveta DE "${nome.slice(0, 28)}" (a dela, não a que já estava aberta)`, async () => {
        /*
         * [BAIXO 2] Esperar "[data-lb-detalhe]" é esperar por uma coisa que
         * JÁ ESTÁ NA TELA desde a linha anterior. O que se espera é a gaveta
         * DESTA linha: o texto do elemento que o `aria-labelledby` aponta.
         *
         * E o clique se REPETE quando ela não troca. Medido sob carga: em
         * ~1 corrida a cada 8, um clique não vira gaveta nova — a gaveta velha
         * fica na tela e o `waitForFunction` espera os 30 s inteiros. Era
         * exatamente esse o clique perdido que a versão antiga desta medida
         * ACEITAVA em silêncio, lendo o texto da gaveta anterior e chamando
         * isso de divergência do produto (o falso vermelho da rodada 15).
         * Repetir o clique é estabelecer o ESTADO, não afrouxar a régua: a
         * régua (gaveta × desenho) continua a mesma, e quantas repetições
         * foram precisas sai IMPRESSO no veredito — clique perdido escondido
         * seria outra forma de aprovar por ausência.
         */
        for (let tentativa = 1; tentativa <= CLIQUES_ATE_A_GAVETA_TROCAR; tentativa += 1) {
          await botao.scrollIntoViewIfNeeded();
          await botao.click({ timeout: TETO_DE_ACAO_MS });
          try {
            await pagina.waitForFunction(
              (alvo) => {
                const g = document.querySelector("[data-lb-detalhe]");
                if (g === null) return false;
                const id = g.getAttribute("aria-labelledby") ?? "";
                return (document.getElementById(id)?.textContent ?? "").trim() === alvo;
              },
              nome,
              { timeout: Math.round(TETO_DE_ACAO_MS / CLIQUES_ATE_A_GAVETA_TROCAR) },
            );
            if (tentativa > 1) cliquesRepetidos += tentativa - 1;
            return;
          } catch (erro) {
            if (tentativa === CLIQUES_ATE_A_GAVETA_TROCAR) throw erro;
          }
        }
      });
      /*
       * [BAIXO 2] UM instante só: quem é a gaveta, o que ela diz e o que as
       * outras superfícies dizem saem todos do mesmo `evaluate`.
       */
      const tiro = await pagina.evaluate((alvo) => {
        const g = document.querySelector("[data-lb-detalhe]");
        const id = g?.getAttribute("aria-labelledby") ?? "";
        const painel = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
        const prefixo = `${alvo} — `;
        return {
          quemEhAGaveta: (document.getElementById(id)?.textContent ?? "").trim(),
          gaveta: g?.innerText ?? "",
          noCanvas: [...(painel?.querySelectorAll("[title]") ?? [])]
            .map((e) => e.getAttribute("title") ?? "")
            .filter((t) => t.startsWith(prefixo)),
          noRotulo: [...document.querySelectorAll('button[aria-haspopup="dialog"][title]')]
            .map((e) => e.getAttribute("title") ?? "")
            .filter((t) => t === alvo || t.startsWith(prefixo)),
        };
      }, nome);
      if (tiro.quemEhAGaveta !== nome) {
        throw new PrecondicaoFalhou(
          `a gaveta lida era a de "${tiro.quemEhAGaveta.slice(0, 30)}" e a linha clicada foi "${nome.slice(0, 30)}" — leitura de dois instantes, não divergência do produto`,
        );
      }
      const gaveta = tiro.gaveta;
      abertas += 1;
      const periodo = (/Período:\s*([^\n]*)/.exec(gaveta)?.[1] ?? "").trim();
      const datas = [...periodo.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((m) => m[0]);
      // A própria gaveta diz, em cinza, o que sabe do dado. Se ela diz "sem
      // estimativa", nenhum intervalo de datas pode estar impresso acima —
      // era exatamente essa contradição que o crítico mediu.
      if (gaveta.includes("sem estimativa") && datas.length >= 2) {
        contradicoes.push(`${rotulo.slice(0, 30)}: "sem estimativa" × "${periodo}"`);
      }
      if (gaveta.includes("início não definido") && /^\d{2}\/\d{2}\/\d{4}/.test(periodo)) {
        contradicoes.push(`${rotulo.slice(0, 30)}: "início não definido" × "${periodo}"`);
      }
      /* ── O INVARIANTE DE VERDADE: gaveta × canvas, na mesma linha ───────── */
      const superficies = { noCanvas: tiro.noCanvas, noRotulo: tiro.noRotulo };
      if (periodo === "") {
        semSuperficie.push(`${nome.slice(0, 34)}: a gaveta não imprime campo "Período"`);
        continue;
      }
      const textos = [...superficies.noCanvas, ...superficies.noRotulo];
      if (textos.length === 0) {
        semSuperficie.push(
          `${nome.slice(0, 34)}: a gaveta diz "${periodo}" e NENHUMA outra superfície fala desta linha`,
        );
        continue;
      }
      comparadas += 1;
      if (!textos.some((t) => t.includes(periodo))) {
        divergencias.push(
          `${nome.slice(0, 30)}: gaveta "${periodo}" × canvas/rótulo "${(textos[0] ?? "").slice(0, 60)}"`,
        );
      }
    }
    const problemas = [...contradicoes, ...divergencias, ...semSuperficie];
    conferir(
      "C · a gaveta e o desenho da mesma linha dizem o MESMO período",
      problemas.length === 0 && comparadas > 0,
      problemas.length === 0
        ? `${String(abertas)} gavetas abertas — cada uma conferida por TÍTULO como sendo a da linha clicada, e lida no MESMO instante que o desenho —, ${String(comparadas)} períodos comparados com o texto do desenho da própria linha, 0 divergências e 0 contradições · ${String(cliquesRepetidos)} clique(s) precisaram ser repetidos para a gaveta trocar`
        : problemas.slice(0, 4).join(" · "),
    );
    await contexto.close();
});

// ── D · contraste computado do rótulo riscado ───────────────────────────────
await medir("D", async () => {
    const { contexto, pagina } = await abrir(1440, 1000);
    const amostras = await pagina.$$eval("span.line-through", (els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        let fundo = "rgba(0, 0, 0, 0)";
        let n = el;
        while (n && /rgba\(0, 0, 0, 0\)|transparent/.test(fundo)) {
          n = n.parentElement;
          if (!n) break;
          fundo = getComputedStyle(n).backgroundColor;
        }
        return { cor: cs.color, fundo, texto: (el.textContent ?? "").slice(0, 24) };
      }),
    );
    const piores = amostras
      .map((a) => ({ ...a, r: razao(corEmCanais(a.cor), corEmCanais(a.fundo)) }))
      .sort((x, y) => x.r - y.r);
    conferir(
      "D · rótulo de assunto riscado (mergeado/fechado) ≥ 4,5:1",
      piores.length > 0 && (piores[0]?.r ?? 0) >= 4.5,
      piores.length === 0
        ? "nenhuma amostra encontrada"
        : `pior: ${piores[0].r.toFixed(2)}:1 (${piores[0].cor} sobre ${piores[0].fundo}) em ${piores.length} amostra(s)`,
    );
    await contexto.close();
});

// ── E · a ordem vertical dos assuntos é a ordem das DATAS, não dos pixels ───
/*
 * Rodada 12 (achado MÉDIO 2). A medida E aprovava qualquer translação: com a
 * mutação canônica (`xFor + pxPorDia`) ela imprimia "0 inversões" com todos os
 * números deslocados 42,77 px, porque monotonicidade é invariante a
 * translação. E contava 14 barras onde H contava 12: os 4 primeiros valores
 * eram `284` — chevrons de fora da janela, todos grudados em `left: 0` pelo
 * clamp, o que tornava o começo da sequência trivialmente monotônico.
 *
 * As duas coisas tinham a mesma causa: E lia PIXEL. O pixel de um item fora
 * da janela é clampado (não é uma afirmação de data), e o pixel de todos os
 * itens se desloca junto numa translação.
 *
 * E passa a ler a DATA que cada linha declara no próprio texto — e a
 * comparar a ordem das datas com a ordem VERTICAL das linhas. É uma
 * propriedade que o pixel não tem como dar: um item clampado em `left: 0`
 * continua declarando 03/08/2026, e uma translação não muda a ordem. A
 * afirmação de POSIÇÃO de cada um vive em H, que é quem tem régua para ela;
 * aqui se mede a ORDEM, que H não mede. Declarado: E é, de propósito,
 * invariante a translação — porque ordenação é invariante a translação, e
 * quem pega translação é H.
 */
await medir("E", async () => {
    const { contexto, pagina } = await abrir(1440, 1000);
    const linhas = await pagina.evaluate(() => {
      const painel = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
      const pr = painel?.getBoundingClientRect();
      /* A ORDEM VERTICAL vem do topo de cada botão da coluna de rótulos — a
         ordem em que o operador lê, não a ordem do DOM de um array qualquer. */
      return [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
        .map((b) => ({
          rotulo: b.getAttribute("aria-label") ?? "",
          topo: b.getBoundingClientRect().top,
        }))
        .filter((x) => x.rotulo.includes("— assunto em "))
        .sort((a, b) => a.topo - b.topo)
        .map((x) => ({
          nome: x.rotulo.split(" — assunto")[0],
          rotulo: x.rotulo,
          topo: x.topo,
          temPainel: Boolean(pr),
        }));
    });
    const comData = [];
    const semData = [];
    for (const l of linhas) {
      /* A data sai do rótulo acessível da própria linha (`rotuloAcessivelDoAssunto`
         — a mesma função pura que alimenta a gaveta e o `title` da barra). */
      const d = /(\d{2})\/(\d{2})\/(\d{4})/.exec(l.rotulo);
      if (!d) {
        semData.push(l.nome.slice(0, 34));
        continue;
      }
      comData.push({ nome: l.nome, iso: `${d[3]}-${d[2]}-${d[1]}`, topo: l.topo });
    }
    const inversoes = comData.filter((x, i) => i > 0 && x.iso < comData[i - 1].iso);
    conferir(
      "E · os assuntos saem em ordem de data de início (a data do texto, nunca o pixel clampado)",
      comData.length > 1 && inversoes.length === 0 && semData.length === 0,
      inversoes.length === 0 && semData.length === 0
        ? `${String(comData.length)} assuntos em ordem não-decrescente de data — ${comData
            .map((x) => x.iso.slice(5))
            .join(" · ")}`
        : [
            semData.length > 0
              ? `assunto cuja linha não declara data nenhuma: ${semData.join(" · ")}`
              : null,
            ...inversoes.map(
              (x, i) => `"${x.nome.slice(0, 28)}" (${x.iso}) vem DEPOIS de uma data maior na tela`,
            ),
          ]
            .filter(Boolean)
            .join(" · "),
    );
    await contexto.close();
});

// ── F · fechar a gaveta não mexe a página ───────────────────────────────────
await medir("F", async () => {
    const { contexto, pagina } = await abrir(390, 844);
    // Linhas FUNDAS de propósito: o defeito é o `.focus()` do fechamento
    // arrastando a página de volta para o botão de origem, e ele só aparece
    // quando o botão está longe do topo. Numa linha alta o navegador não
    // precisa rolar nada, e o teste passaria sem medir coisa alguma.
    const indices = [14, 18, 22];
    const deltas = [];
    for (const indice of indices) {
      await precondicao("recarregar a rota e esperar a faixa do Hoje", async () => {
        await pagina.reload({ waitUntil: "networkidle", timeout: TETO_DE_ACAO_MS });
        await pagina.waitForSelector(".lb-tl-hoje", { state: "attached", timeout: TETO_DE_ACAO_MS });
      });
      const rotulo = await pagina.$$eval(
        'button[aria-haspopup="dialog"]',
        (els, k) => els[k]?.getAttribute("aria-label") ?? "",
        indice,
      );
      if (!rotulo) continue;
      const botao = pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first();
      await precondicao(`abrir a gaveta de "${String(rotulo).slice(0, 28)}"`, async () => {
        await botao.scrollIntoViewIfNeeded();
        await botao.click({ timeout: TETO_DE_ACAO_MS });
        await pagina.waitForSelector("[data-lb-detalhe]", { timeout: TETO_DE_ACAO_MS });
      });
      await assentar(pagina);
      // O operador rola de volta para o topo COM a gaveta aberta…
      await pagina.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
      await assentar(pagina);
      const antes = await pagina.evaluate(() => window.scrollY);
      // …e fecha. A página tem de ficar onde ele a deixou.
      await clicar(pagina.locator("[data-lb-detalhe] button").first(), "fechar a gaveta");
      await assentar(pagina);
      const depois = await pagina.evaluate(() => window.scrollY);
      deltas.push({ indice, antes, depois, delta: Math.abs(depois - antes) });
    }
    const pior = deltas.reduce((m, d) => Math.max(m, d.delta), 0);
    conferir(
      "F · fechar a gaveta não arrasta a página (o foco volta sem rolar)",
      deltas.length > 0 && pior <= 1,
      deltas.map((d) => `linha ${String(d.indice)}: ${d.antes} → ${d.depois}`).join(" · "),
    );
    await contexto.close();
});

// ── G · o chip do período: inteiro ou ausente, e o ano sempre escrito ───────
await medir("G", async () => {
    const { contexto, pagina } = await abrir(768, 900);
    await clicar(pagina.locator('button:has-text("Semana")').first(), "trocar o zoom para Semana");
    // O chip é re-renderizado a cada `scroll`; medir antes de o React assentar
    // mede o quadro anterior. Espera-se o chip existir e, dentro do laço, dois
    // `requestAnimationFrame` depois de cada escrita em `scrollLeft`.
    await esperarSeletor(pagina, ".lb-tl-mes-grudado", "o chip de mês grudar no eixo");
    const maximo = await pagina.evaluate(() => {
      const el = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
      return el ? el.scrollWidth - el.clientWidth : 0;
    });
    let cacos = 0;
    let semAno = 0;
    let posicoes = 0;
    let pior = 1;
    for (let sx = 0; sx <= maximo; sx += 8) {
      const r = await pagina.evaluate(async (x) => {
        const el = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
        if (!el) return null;
        el.scrollLeft = x;
        await new Promise((pronto) =>
          requestAnimationFrame(() => requestAnimationFrame(() => pronto(null))),
        );
        const rp = el.getBoundingClientRect();
        const chip = document.querySelector(".lb-tl-mes-grudado");
        let fracao = 1;
        if (chip) {
          const rc = chip.getBoundingClientRect();
          const visivel = Math.max(0, Math.min(rc.right, rp.right) - Math.max(rc.left, rp.left));
          fracao = rc.width > 0 ? visivel / rc.width : 1;
        }
        const meses = [...document.querySelectorAll("div,span")]
          .filter(
            (e) =>
              e.children.length === 0 &&
              /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(\/\d{4})?$/.test(
                (e.textContent ?? "").trim(),
              ),
          )
          .map((e) => {
            const r2 = e.getBoundingClientRect();
            return {
              texto: (e.textContent ?? "").trim(),
              inteiro:
                Math.max(0, Math.min(r2.right, rp.right) - Math.max(r2.left, rp.left)) >
                r2.width * 0.9,
            };
          });
        return {
          temChip: Boolean(chip),
          fracao,
          temAno: meses.some((m) => m.inteiro && /\d{4}/.test(m.texto)),
        };
      }, sx);
      if (!r) continue;
      posicoes += 1;
      if (r.temChip && r.fracao < 0.999) cacos += 1;
      if (r.temChip) pior = Math.min(pior, r.fracao);
      if (!r.temChip && !r.temAno) semAno += 1;
    }
    conferir(
      "G · chip do período inteiro ou ausente, com o ano sempre escrito (768×900, Semana)",
      cacos === 0 && semAno === 0,
      `${posicoes} posições de rolagem — ${cacos} com chip cortado (pior fração ${pior.toFixed(3)}), ${semAno} sem o ano na tela`,
    );
    await contexto.close();
});

// ═══════════════════════════════════════════════════════════════════════════
// H · CADA BARRA NO PIXEL QUE A SUA DATA MANDA
// ═══════════════════════════════════════════════════════════════════════════

const MS_DIA = 86_400_000;
/** `dd/MM/aaaa` → epoch UTC. `NaN` quando não é data. */
function epochDeBr(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}
function epochDeIso(iso) {
  const t = Date.parse(`${iso}T00:00:00.000Z`);
  return Number.isFinite(t) ? t : Number.NaN;
}
const PISO_BARRA_PX = 12;
const TOLERANCIA_PX = 1.5;

/**
 * ── A COLETA É DERIVADA, E O QUE ELA PULA É DECLARADO (achado ALTO 1) ──────
 *
 * A versão anterior coletava três seletores escritos à mão
 * (`[data-lb-barra]`, `.lb-tl-marco`, `.lb-tl-ponto-concluida`) e imprimia
 * "12 barras conferidas". Medido no Chromium: o painel tinha 19 elementos com
 * `title` datado, 12 entravam e 7 ficavam fora — **sem uma palavra sobre os
 * 7**. É a mesma forma do defeito que a medida H nasceu para curar (a medida
 * E "relatava o deslocamento nos próprios números e aprovava").
 *
 * Agora a coleta parte do que o elemento AFIRMA, não de uma lista:
 *
 *   - `title` com data `dd/MM/aaaa`  → é uma afirmação sobre datas;
 *   - `data-lb-*` com data ISO       → idem (é assim que a hachura de folga
 *     e a faixa do "Hoje" declaram as suas).
 *
 * Todo elemento assim entra. O que sai, sai por EXCEÇÃO DECLARADA, com o
 * motivo escrito no código e impresso no relatório — e a exceção não é um
 * `continue`: cada uma tem a sua própria conferência (um clamp tem de estar
 * mesmo na borda, e a data que ele declara tem de estar mesmo fora da
 * janela). Checagem pulada é checagem aprovada; aqui não se pula, se mede
 * outra coisa.
 *
 * E há uma terceira rede, a que impede a lista de envelhecer em silêncio: o
 * REGISTRO de classes `lb-tl-*`. Toda classe desenhada dentro do painel tem
 * de estar nele. Uma classe nova — um mecanismo novo — REPROVA a guarda até
 * alguém dizer como ela se mede ou por que não se mede. Foi a falta disso que
 * deixou `lb-tl-slack` e `lb-tl-atraso` com zero cobertura de navegador por
 * duas rodadas.
 */
async function lerGeometria(pagina) {
  return await pagina.evaluate(() => {
    const painel = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
    if (!painel) return null;
    const pr = painel.getBoundingClientRect();
    /* Coordenadas do CONTEÚDO do painel (`rect` real + `scrollLeft`), nunca
       `style.left` — que seria o valor escrito, não o pintado. */
    const cx = (el) => {
      const r = el.getBoundingClientRect();
      return {
        esquerda: r.left - pr.left + painel.scrollLeft,
        centro: (r.left + r.right) / 2 - pr.left + painel.scrollLeft,
        direita: r.right - pr.left + painel.scrollLeft,
        largura: r.width,
      };
    };
    const RE_DATA = /\d{2}\/\d{2}\/\d{4}/;
    const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;

    /**
     * O REGISTRO. `medida` diz o que a guarda faz com cada desenho:
     *   posicao-esquerda  · a borda esquerda é `xDe(data do texto)`
     *   posicao-centro    · o centro é `xDe(data do texto)`
     *   intervalo         · esquerda e direita são duas datas declaradas
     *   regua             · é a própria régua (medida à parte, em M e N)
     *   clamp-declarado   · o desenho se RECUSA a afirmar posição; confere-se
     *                       que ele está na borda e que a data está mesmo fora
     *   dentro-da-barra   · não tem posição própria; a barra que o contém já é
     *                       medida, e a barra é quem afirma as datas
     */
    const REGISTRO = {
      "lb-tl-guia-semana": { medida: "regua", motivo: "as segundas-feiras dão px/dia (7 dias exatos entre duas)" },
      "lb-tl-hoje": { medida: "regua", motivo: "o único pixel do canvas cuja data o componente declara" },
      "lb-tl-marco": { medida: "posicao-centro", motivo: "" },
      "lb-tl-ponto-concluida": { medida: "posicao-centro", motivo: "" },
      "lb-tl-slack": { medida: "intervalo", motivo: "" },
      "lb-tl-atraso": { medida: "posicao-esquerda", motivo: "" },
      "lb-tl-fora-da-janela": {
        medida: "clamp-declarado",
        motivo: "o desenho se recusa a posicionar: a data está fora da janela e o glifo fica na borda",
      },
      "lb-tl-atraso-seta": {
        medida: "clamp-declarado",
        motivo: "o prazo cai fora da barra: o glifo é preso à borda da barra, não em xDe(prazo)",
      },
      "lb-tl-erro": {
        medida: "clamp-declarado",
        motivo: "dado podre (data inválida / datas inconsistentes): a caixa não afirma intervalo nenhum",
      },
      /* [BAIXO 3b, rodada 13] `dentro-da-barra` DEIXOU de ser um `continue`.
         Cada uma destas três tem agora a sua conferência própria, no fim de
         `medirPixelContraData` — `confereDentroDaBarra` diz qual: */
      "lb-tl-bar-critico": {
        medida: "dentro-da-barra",
        confere: "eh-a-propria-barra",
        motivo: "é a própria barra (mesmo elemento de data-lb-barra) — conferido: o elemento TEM `data-lb-barra`",
      },
      "lb-tl-atrasada-marcador": {
        medida: "dentro-da-barra",
        confere: "colado-na-barra",
        motivo: "inset-x-0 dentro da barra — conferido: as duas bordas coincidem com as da barra-pai",
      },
      "lb-tl-connector": {
        medida: "dentro-da-barra",
        confere: "pontas-em-barras",
        motivo: "derivado das pontas de dois desenhos — conferido: cada ponta cai numa ponta de desenho já medido (borda de barra, centro de losango/ponto) ou na borda do eixo",
      },
    };

    /* ── a régua desenhada ────────────────────────────────────────────── */
    const guias = [...painel.querySelectorAll(".lb-tl-guia-semana")]
      .map((e) => cx(e).esquerda)
      .sort((a, b) => a - b);
    const faixaHoje = painel.querySelector(".lb-tl-hoje[data-lb-hoje]");

    /* ── a coleta derivada ────────────────────────────────────────────── */
    const afirmacoes = [];
    const excecoes = [];
    const dentroDaBarra = [];
    const desconhecidos = [];
    const classesNoPainel = {};
    const semRegua = [];

    for (const el of painel.querySelectorAll("*")) {
      const classes = [...el.classList].filter((c) => c.startsWith("lb-tl-"));
      for (const c of classes) {
        classesNoPainel[c] = (classesNoPainel[c] ?? 0) + 1;
        if (!(c in REGISTRO)) desconhecidos.push(c);
      }
      const title = el.getAttribute("title") ?? "";
      const dataLb = [...el.attributes]
        .filter((a) => a.name.startsWith("data-lb-") && RE_ISO.test(a.value))
        .map((a) => `${a.name}=${a.value}`);
      const afirmaData = RE_DATA.test(title) || dataLb.length > 0;
      const entrada = REGISTRO[classes.find((c) => c in REGISTRO) ?? ""] ?? null;
      const barra = el.getAttribute("data-lb-barra");
      const comum = {
        classes: classes.join(","),
        title,
        dataLb,
        ...cx(el),
      };

      if (barra) {
        afirmacoes.push({ ...comum, medida: "posicao-esquerda", tipo: barra, confereLargura: true });
        continue;
      }
      if (el.hasAttribute("data-lb-folga-de") && el.hasAttribute("data-lb-folga-ate")) {
        afirmacoes.push({
          ...comum,
          medida: "intervalo",
          de: el.getAttribute("data-lb-folga-de"),
          ate: el.getAttribute("data-lb-folga-ate"),
        });
        continue;
      }
      if (entrada && (entrada.medida === "posicao-centro" || entrada.medida === "posicao-esquerda")) {
        afirmacoes.push({ ...comum, medida: entrada.medida, confereLargura: false });
        continue;
      }
      if (entrada && entrada.medida === "clamp-declarado") {
        /* Um "◀"/"▶" DENTRO de uma barra é enfeite da barra (o corte no fim
           do eixo) — a barra que o contém já é medida e é ela que afirma. */
        const dentroDeBarra = el.closest("[data-lb-barra]") !== null;
        excecoes.push({
          ...comum,
          motivo: dentroDeBarra
            ? "glifo dentro da barra: a barra que o contém é quem afirma as datas, e ela é medida"
            : entrada.motivo,
          dentroDeBarra,
          tituloDaBarraPai: el.closest("[data-lb-barra]")?.getAttribute("title") ?? null,
        });
        continue;
      }
      /* `regua` não é pulo: as guias e a faixa do "Hoje" SÃO a régua, e elas
         têm conferência própria em três lugares — `montarRegua` exige que toda
         guia caia numa segunda-feira no pixel que a conta manda, M as compara
         com os rótulos impressos do eixo e N exige que as duas estejam
         PINTADAS. Medir a régua contra ela mesma aqui é que seria vazio. */
      if (entrada && entrada.medida === "regua") continue;
      /* [BAIXO 3b, rodada 13] Aqui havia um `continue` puro, embaixo de um
         cabeçalho que afirmava, por escrito, que "a exceção não é um
         `continue`: cada uma tem a sua própria conferência". Não tinha. Agora
         cada uma leva a evidência de que precisa para ser conferida lá em
         cima, por `confereDentroDaBarra`. */
      if (entrada && entrada.medida === "dentro-da-barra") {
        const barraPai = el.closest("[data-lb-barra]");
        dentroDaBarra.push({
          ...comum,
          confere: entrada.confere,
          ehBarra: el.hasAttribute("data-lb-barra"),
          pai: barraPai ? cx(barraPai) : null,
        });
        continue;
      }
      /*
       * Uma classe registrada como "intervalo" ou "posicao-*" que NÃO trouxe
       * as datas que devia declarar cai aqui. Sem esta rede, arrancar
       * `data-lb-folga-de`/`-ate` da hachura a devolvia ao silêncio: sem
       * atributo e sem `title`, ela não "afirma data" e sairia da coleta sem
       * uma palavra — a doença de novo, com outra roupa.
       */
      if (entrada) {
        semRegua.push({
          ...comum,
          porque: `a classe está registrada como "${entrada.medida}" e não declarou as datas que essa medida exige`,
        });
        continue;
      }
      /* Elemento que AFIRMA uma data e não se encaixou em nada: é a doença
         de novo, e a guarda tem de cair. */
      if (afirmaData) semRegua.push(comum);
    }

    /* A etiqueta de "fora da grade" da coluna de rótulos, com o nome da linha. */
    const foraDaGrade = [...document.querySelectorAll(".lb-tl-fora-da-grade")].map((e) => ({
      motivo: (e.textContent ?? "").trim(),
      titulo: (e.parentElement?.querySelector("span")?.textContent ?? "").trim(),
    }));

    /*
     * Rodada 12 (achado ALTO 3): os rótulos datados da coluna, que é onde a
     * data de um item fora da janela passa a chegar por TOQUE. A guarda amarra
     * cada "◀"/"▶" do canvas a um destes — e reprova quando falta.
     */
    const rotulosForaDaJanela = [...document.querySelectorAll(".lb-tl-fora-da-janela-rotulo")].map(
      (e) => ({
        texto: (e.textContent ?? "").trim(),
        lado: e.getAttribute("data-lb-fora-da-janela"),
        rotuloAcessivel: e.closest("button")?.getAttribute("aria-label") ?? "",
        titleDaLinha: e.closest("button")?.getAttribute("title") ?? "",
      }),
    );

    /*
     * Rodada 12 (achado CRÍTICO 2): os rótulos de data do EIXO — os "14",
     * "15", "24" que o operador lê no cabeçalho. Eles saem de `rotulosVisiveis`
     * (outro array), moram no cabeçalho TRANSLADADO (outro contêiner de
     * rolagem) e não entravam em régua nenhuma. Ficam em coordenada de
     * conteúdo do painel, a mesma das barras, para poderem ser comparados com
     * a mesma régua.
     */
    const eixo = [];
    const faixaDeDias = document.querySelectorAll(
      '[role="region"][aria-label^="Linha do tempo"]',
    ).length
      ? document
      : document;
    for (const el of faixaDeDias.querySelectorAll("div,span")) {
      if (el.children.length > 0) continue;
      if (painel.contains(el)) continue;
      const texto = (el.textContent ?? "").trim();
      const ehDia = /^\d{1,2}$/.test(texto);
      const ehDiaMes = /^\d{2}\/\d{2}$/.test(texto);
      const ehChipHoje = el.classList.contains("lb-tl-hoje-rotulo");
      const ehMes = /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(\/\d{4})?$/.test(texto);
      if (!ehDia && !ehDiaMes && !ehMes) continue;
      /* Só o que está DENTRO do cabeçalho do eixo (o chip grudado do mês vive
         fora do conteúdo transladado de propósito, e tem medida própria: G). */
      if (el.classList.contains("lb-tl-mes-grudado")) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      eixo.push({
        texto,
        tipo: ehChipHoje ? "hoje" : ehMes ? "mes" : ehDiaMes ? "dia-mes" : "dia",
        esquerda: r.left - pr.left + painel.scrollLeft,
        visivelNaJanela: r.left >= pr.left - 1 && r.right <= pr.right + 1,
      });
    }

    return {
      guias,
      xHoje: faixaHoje ? cx(faixaHoje).esquerda : null,
      hojeIso: faixaHoje?.getAttribute("data-lb-hoje") ?? null,
      larguraTotal: painel.scrollWidth,
      scrollLeft: painel.scrollLeft,
      afirmacoes,
      excecoes,
      dentroDaBarra,
      /* As PONTAS de todo desenho que já foi medido contra uma data: as duas
         bordas de uma barra e o centro de um losango/ponto (que é onde a data
         dele cai). É a lista contra a qual as pontas de um conector têm de
         pousar — medido: o conector da tarefa CONCLUÍDA pousa no centro do
         ponto de conclusão dela, que não é barra nenhuma. */
      ancorasDeDesenho: afirmacoes.flatMap((a) =>
        a.tipo ? [a.esquerda, a.direita] : a.medida === "posicao-centro" ? [a.centro] : [],
      ),
      desconhecidos: [...new Set(desconhecidos)],
      semRegua,
      classesNoPainel,
      foraDaGrade,
      rotulosForaDaJanela,
      eixo,
    };
  });
}

/** A régua: `px/dia` das guias de segunda + a origem da faixa do "Hoje". */
function montarRegua(g) {
  if (!g || g.hojeIso === null || g.xHoje === null) return { erro: "sem faixa do Hoje na página" };
  if (g.guias.length < 2) return { erro: `só ${String(g.guias.length)} guia(s) de semana` };
  const pxPorDia = (g.guias[g.guias.length - 1] - g.guias[0]) / (7 * (g.guias.length - 1));
  if (!(pxPorDia > 0)) return { erro: "px/dia não positivo" };
  const hojeEpoch = epochDeIso(g.hojeIso);
  if (!Number.isFinite(hojeEpoch)) return { erro: `data de hoje ilegível: ${g.hojeIso}` };
  // As duas fontes da régua se conferem: toda guia tem de cair num dia que,
  // contado a partir de "hoje", é mesmo uma segunda-feira — e no pixel que a
  // conta manda. Se a âncora escorregar, isto quebra antes de qualquer barra.
  const desalinhadas = [];
  for (const x of g.guias) {
    const dias = Math.round((x - g.xHoje) / pxPorDia);
    const data = new Date(hojeEpoch + dias * MS_DIA);
    const previsto = g.xHoje + dias * pxPorDia;
    if (data.getUTCDay() !== 1 || Math.abs(x - previsto) > TOLERANCIA_PX) {
      desalinhadas.push(`${x.toFixed(2)} (${data.toISOString().slice(0, 10)})`);
    }
  }
  const xDeEpoch = (epoch) => g.xHoje + ((epoch - hojeEpoch) / MS_DIA) * pxPorDia;
  return {
    pxPorDia,
    /** `dd/MM/aaaa` → pixel, CLAMPADO no eixo (é o que o desenho faz). */
    xDe: (br) => Math.min(Math.max(xDeEpoch(epochDeBr(br)), 0), g.larguraTotal),
    /** O mesmo, SEM clamp — para perguntar se uma data cai fora do eixo. */
    xDeBruto: (br) => xDeEpoch(epochDeBr(br)),
    /** `aaaa-MM-dd` → pixel clampado (as datas que vêm de `data-lb-*`). */
    xDeIso: (iso) => Math.min(Math.max(xDeEpoch(epochDeIso(iso)), 0), g.larguraTotal),
    /** pixel → a data que aquele pixel significa (o caminho inverso, que a
        medida dos rótulos do eixo usa: posição → data → o número impresso). */
    dataEm: (x) => {
      const dias = (x - g.xHoje) / pxPorDia;
      const inteiro = Math.round(dias);
      return {
        dias,
        inteiro,
        resto: Math.abs(dias - inteiro),
        iso: new Date(hojeEpoch + inteiro * MS_DIA).toISOString().slice(0, 10),
      };
    },
    hojeBr: new Date(hojeEpoch).toISOString().slice(0, 10),
    desalinhadas,
  };
}

/** As datas que o PRÓPRIO TEXTO da barra declara. */
function datasDoTitulo(title, hojeIso) {
  const brDeIso = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const par = /(\d{2}\/\d{2}\/\d{4})\s*→\s*(em aberto|\d{2}\/\d{2}\/\d{4})/.exec(title);
  if (par) {
    return { inicio: par[1], fim: par[2] === "em aberto" ? brDeIso(hojeIso) : par[2], parDeDatas: true };
  }
  const unica = /(?:mesmo dia\)|marco em|concluída em)[^\d]*(\d{2}\/\d{2}\/\d{4})/.exec(title)
    ?? /(\d{2}\/\d{2}\/\d{4})\s*\(mesmo dia\)/.exec(title);
  if (unica) return { inicio: unica[1], fim: unica[1], parDeDatas: true };
  return { inicio: null, fim: null, parDeDatas: false };
}

/**
 * ── Q · CADA BARRA NA FAIXA DO RÓTULO QUE A NOMEIA (achado ALTO 1, rodada 13)
 *
 * As 26 medidas anteriores mediam o eixo X inteiro — "quando" — e NENHUMA
 * comparava a posição VERTICAL de uma barra com a do rótulo que a nomeia. Um
 * Gantt afirma duas coisas por barra: *quando* (x) e *de quem* (y). A medida C
 * casava gaveta × desenho por prefixo de `title` (texto, não geometria) e a E
 * só ordenava os RÓTULOS entre si.
 *
 * O canvas e a coluna de rótulos são duas pilhas independentes que só se
 * alinhavam porque `ROW_H = 42` e `h-[42px]` eram dois números escritos à mão
 * com o mesmo valor, e a lei que os amarra vivia num COMENTÁRIO do componente.
 * Duas sabotagens passaram pelos cinco portões com 26 medidas "ok":
 *   · `(i + 1) * ROW_H` — toda barra 42px abaixo do próprio rótulo;
 *   · `ROW_H = 44`      — erro que ACUMULA (31, 35, 37, 45px medidos): a linha
 *     20 ficava a mais de uma linha inteira do nome dela.
 *
 * Como esta medida funciona:
 *   · o universo é DERIVADO — todo `button[data-lb-linha]` da coluna e todo
 *     `[data-lb-linha]` dentro do painel; o par se faz pela chave da linha, que
 *     as duas pontas carregam (nunca por prefixo de texto);
 *   · casar ZERO é REPROVAÇÃO: a contagem de rótulos tem de bater com
 *     `LINHAS_DA_FIXTURE`, e o número de pares não pode cair abaixo do piso;
 *   · rótulo SEM desenho só passa por exceção com conferência própria: a linha
 *     tem de estar marcada "fora da grade" na própria coluna (a etiqueta
 *     `.lb-tl-fora-da-grade`, que a medida J já usa). Desenho sem rótulo é
 *     reprovação seca — ninguém desenha uma linha que a coluna não nomeia.
 *
 * A régua: o CENTRO vertical do desenho contra o CENTRO vertical da caixa do
 * rótulo. Por construção eles são o mesmo ponto — a barra nasce em
 * `i·ROW_H + (ROW_H − BAR_H)/2` e tem `BAR_H` de altura, logo o centro dela é
 * `i·ROW_H + ROW_H/2`, que é o meio da caixa de 42px do rótulo de índice `i`
 * (losango, ponto e chevron são centrados na mesma faixa de `BAR_H`). A folga
 * de ±1,5px é a MESMA de H, e pelo mesmo motivo: arredondamento de sub-pixel
 * do layout do Chromium, não margem de erro de alinhamento. Meia linha (21px)
 * seria folga bastante para o par sair da própria faixa, e é o que esta medida
 * existe para proibir.
 */
const LINHAS_DA_FIXTURE = 27;
/**
 * O piso de pares. Medido no quadro de fixture: 27 linhas, das quais 7 são
 * "fora da grade" (sem início e/ou sem duração — elas não recebem desenho
 * nenhum, e a coluna diz o motivo por escrito). Sobram 20 desenhadas em todos
 * os zooms — o que muda entre eles é a FORMA (barra, chevron, ponto), nunca a
 * quantidade. Se este número cair, alguma linha deixou de ser desenhada sem
 * dizer por quê, e a medida reprova em vez de aprovar por ausência.
 */
const PARES_MINIMOS = 20;

async function medirRotuloContraDesenho(pagina) {
  return await pagina.evaluate(() => {
    const painel = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
    if (!painel) return { erro: "painel da linha do tempo não encontrado" };
    const meio = (el) => {
      const r = el.getBoundingClientRect();
      return { centro: (r.top + r.bottom) / 2, topo: r.top, base: r.bottom, altura: r.height };
    };
    /* A coluna de rótulos vive FORA do painel (só o canvas rola na horizontal),
       então os dois conjuntos não se misturam: botão de um lado, desenho do
       outro. */
    const rotulos = [...document.querySelectorAll("button[data-lb-linha]")].map((el, i) => ({
      chave: el.getAttribute("data-lb-linha"),
      indice: i,
      nome: (el.getAttribute("aria-label") ?? "").slice(0, 40),
      foraDaGrade: el.querySelector(".lb-tl-fora-da-grade") !== null,
      ...meio(el),
    }));
    const desenhos = [...painel.querySelectorAll("[data-lb-linha]")].map((el) => ({
      chave: el.getAttribute("data-lb-linha"),
      classes: [...el.classList].filter((c) => c.startsWith("lb-tl-")).join(",") || "barra",
      ...meio(el),
    }));
    return { rotulos, desenhos };
  });
}

function conferirParesDeLinha(dados, contexto) {
  if (dados.erro) {
    conferir(`Q · cada barra na faixa do rótulo que a nomeia (${contexto})`, false, dados.erro);
    return;
  }
  const { rotulos, desenhos } = dados;
  const porChave = new Map();
  for (const d of desenhos) porChave.set(d.chave, [...(porChave.get(d.chave) ?? []), d]);

  const foraDaRegua = [];
  const semDesenhoIndevido = [];
  const duplicados = [];
  let pares = 0;
  let semDesenhoDeclarado = 0;
  let pior = { delta: -1, quem: "" };
  let maisFundo = -1;

  for (const r of rotulos) {
    const casados = porChave.get(r.chave) ?? [];
    if (casados.length === 0) {
      /* Exceção com conferência própria, nunca um `continue`: a linha sem
         desenho TEM de estar marcada "fora da grade" na própria coluna. */
      if (r.foraDaGrade) semDesenhoDeclarado += 1;
      else semDesenhoIndevido.push(`"${r.nome}" (linha ${String(r.indice)}) sem desenho e sem motivo escrito`);
      continue;
    }
    if (casados.length > 1) duplicados.push(`"${r.nome}" tem ${String(casados.length)} desenhos`);
    for (const d of casados) {
      const delta = Math.abs(d.centro - r.centro);
      pares += 1;
      maisFundo = Math.max(maisFundo, r.indice);
      if (delta > pior.delta) pior = { delta, quem: `${r.nome} [${d.classes}]` };
      if (delta > TOLERANCIA_PX) {
        foraDaRegua.push(
          `"${r.nome}" [${d.classes}]: desenho em ${d.centro.toFixed(1)}, rótulo em ${r.centro.toFixed(
            1,
          )} — ${delta.toFixed(1)}px (linha ${String(r.indice)}, faixa de ${r.altura.toFixed(0)}px)`,
        );
      }
    }
  }

  const chavesDeRotulo = new Set(rotulos.map((r) => r.chave));
  const orfaos = desenhos.filter((d) => !chavesDeRotulo.has(d.chave));
  const ok =
    rotulos.length === LINHAS_DA_FIXTURE &&
    pares >= PARES_MINIMOS &&
    foraDaRegua.length === 0 &&
    semDesenhoIndevido.length === 0 &&
    duplicados.length === 0 &&
    orfaos.length === 0;

  conferir(
    `Q · cada barra na faixa do rótulo que a nomeia (${contexto})`,
    ok,
    ok
      ? `${String(pares)} pares casados por chave de linha (piso ${String(PARES_MINIMOS)}) de ${String(
          rotulos.length,
        )} rótulos — ${String(semDesenhoDeclarado)} sem desenho, todos marcados "fora da grade" na coluna · ` +
        `linha mais funda conferida: ${String(maisFundo)} · pior desvio ${pior.delta.toFixed(
          2,
        )}px em "${pior.quem}" (régua ±${String(TOLERANCIA_PX)}px)`
      : [
          rotulos.length !== LINHAS_DA_FIXTURE
            ? `a coluna tem ${String(rotulos.length)} rótulos, e a fixture desenha ${String(LINHAS_DA_FIXTURE)} linhas`
            : null,
          pares < PARES_MINIMOS ? `só ${String(pares)} pares casados (piso ${String(PARES_MINIMOS)})` : null,
          orfaos.length > 0
            ? `desenho sem rótulo na coluna: ${orfaos.map((d) => `${d.chave} [${d.classes}]`).join(" · ")}`
            : null,
          semDesenhoIndevido.length > 0 ? semDesenhoIndevido.join(" · ") : null,
          duplicados.length > 0 ? duplicados.join(" · ") : null,
          foraDaRegua.length > 0
            ? `${String(foraDaRegua.length)} fora da faixa: ${foraDaRegua.slice(0, 4).join(" · ")}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
  );
}

/**
 * [BAIXO 3b, rodada 13] As três classes `dentro-da-barra`, CONFERIDAS.
 *
 * Elas saíam por `if (entrada.medida === "dentro-da-barra") continue;` —
 * literalmente um `continue`, três linhas abaixo de um cabeçalho que afirmava
 * que "a exceção não é um `continue`: cada uma tem a sua própria conferência".
 * Checagem pulada é checagem aprovada, e o arquivo afirmava o contrário do que
 * fazia. Cada uma tem agora a conferência que o motivo dela promete:
 *
 *   · `eh-a-propria-barra` — o motivo diz "é o mesmo elemento de
 *     `data-lb-barra`"; confere-se que ele TEM o atributo. Mover a classe para
 *     um elemento à parte (um traço decorativo com posição própria) deixa de
 *     ser silêncio e vira reprovação até alguém dizer como se mede.
 *   · `colado-na-barra` — o motivo diz "`inset-x-0`, não tem posição própria";
 *     confere-se que as duas bordas horizontais coincidem com as da barra-pai.
 *     Medido: coincidem em 0,00px, porque é a mesma caixa.
 *   · `pontas-em-barras` — o motivo diz "derivado das pontas de duas barras já
 *     medidas"; confere-se que cada ponta horizontal cai sobre uma borda de
 *     barra MEDIDA, ou sobre uma borda do eixo (é onde a ponta pousa quando a
 *     tarefa do outro lado está fora da janela). A folga é de 4px: a seta de
 *     chegada é um polígono de 7px de largura centrado no ponto de chegada,
 *     então a caixa do `<g>` passa 3,5px do ponto — mais um respiro de
 *     sub-pixel. Não é tolerância de posição, é a metade da seta.
 */
const FOLGA_DA_SETA_PX = 4;

function confereDentroDaBarra(g) {
  const tortos = [];
  const contagem = {};
  for (const d of g.dentroDaBarra) {
    contagem[d.classes] = (contagem[d.classes] ?? 0) + 1;
    if (d.confere === "eh-a-propria-barra") {
      if (!d.ehBarra) {
        tortos.push(
          `"${d.classes}" se declara "a própria barra" e não tem \`data-lb-barra\` — ganhou posição própria e nenhuma medida a segue`,
        );
      }
      continue;
    }
    if (d.confere === "colado-na-barra") {
      if (d.pai === null) {
        tortos.push(`"${d.classes}" se declara dentro de uma barra e não está dentro de nenhuma`);
        continue;
      }
      const dEsq = Math.abs(d.esquerda - d.pai.esquerda);
      const dDir = Math.abs(d.direita - d.pai.direita);
      if (dEsq > TOLERANCIA_PX || dDir > TOLERANCIA_PX) {
        tortos.push(
          `"${d.classes}" se declara \`inset-x-0\` mas sobra ${dEsq.toFixed(2)}px à esquerda e ${dDir.toFixed(2)}px à direita da barra-pai`,
        );
      }
      continue;
    }
    if (d.confere === "pontas-em-barras") {
      const ancoras = [...g.ancorasDeDesenho, 0, g.larguraTotal];
      const solta = (x) => !ancoras.some((a) => Math.abs(a - x) <= FOLGA_DA_SETA_PX);
      const pontasSoltas = [d.esquerda, d.direita].filter(solta);
      if (pontasSoltas.length > 0) {
        tortos.push(
          `"${d.classes}" se declara derivado de dois desenhos medidos, mas ${pontasSoltas
            .map((x) => x.toFixed(2))
            .join(" e ")} não cai em ponta de desenho nenhum (nem na borda do eixo)`,
        );
      }
      continue;
    }
    tortos.push(`"${d.classes}" está registrada como \`dentro-da-barra\` sem dizer QUAL conferência a segue`);
  }
  const resumo = Object.entries(contagem)
    .map(([c, n]) => `${c}=${String(n)}`)
    .join(" ");
  return { tortos, resumo: resumo || "nenhuma na tela" };
}

/** Uma passada de H + J numa página já aberta e num zoom já escolhido. */
async function medirPixelContraData(pagina, contexto) {
  const g = await lerGeometria(pagina);
  if (g === null) return { contexto, falhou: true, detalhe: "painel da linha do tempo não encontrado" };
  const regua = montarRegua(g);
  if (regua.erro) return { contexto, falhou: true, detalhe: `régua indisponível: ${regua.erro}` };
  const piores = [];
  const semData = [];
  let conferidas = 0;

  for (const a of g.afirmacoes) {
    /* ── intervalo declarado por `data-lb-*` (a hachura de folga) ───────── */
    if (a.medida === "intervalo") {
      const xDe = regua.xDeIso(a.de);
      const xAte = regua.xDeIso(a.ate);
      if (!Number.isFinite(xDe) || !Number.isFinite(xAte)) {
        piores.push(`${a.classes} declara datas ilegíveis (${String(a.de)} → ${String(a.ate)})`);
        continue;
      }
      conferidas += 1;
      if (Math.abs(a.esquerda - xDe) > TOLERANCIA_PX) {
        piores.push(
          `${a.classes} — começa em ${a.esquerda.toFixed(2)}, a data ${a.de} manda ${xDe.toFixed(2)} (${((a.esquerda - xDe) / regua.pxPorDia).toFixed(2)} dia de erro)`,
        );
      }
      if (Math.abs(a.direita - xAte) > TOLERANCIA_PX) {
        piores.push(
          `${a.classes} — acaba em ${a.direita.toFixed(2)}, a data ${a.ate} manda ${xAte.toFixed(2)} (${((a.direita - xAte) / regua.pxPorDia).toFixed(2)} dia de erro)`,
        );
      }
      continue;
    }

    /* ── posição afirmada pelo PRÓPRIO TEXTO do elemento ────────────────── */
    const prazo = /prazo\s+(\d{2}\/\d{2}\/\d{4})/.exec(a.title);
    const d = prazo ? { inicio: prazo[1], fim: prazo[1], parDeDatas: true } : datasDoTitulo(a.title, g.hojeIso);
    if (!d.parDeDatas) {
      semData.push(`[${a.classes || a.tipo}] "${a.title.slice(0, 50)}"`);
      continue;
    }
    const medido = a.medida === "posicao-centro" ? a.centro : a.esquerda;
    const alvo = regua.xDe(d.inicio);
    const erro = Math.abs(medido - alvo);
    conferidas += 1;
    if (erro > TOLERANCIA_PX) {
      piores.push(
        `${a.title.slice(0, 44)} — ${a.medida} medida ${medido.toFixed(2)}, a data ${d.inicio} manda ${alvo.toFixed(2)} (${(erro / regua.pxPorDia).toFixed(2)} dia de erro)`,
      );
    }
    /* O COMPRIMENTO também é uma afirmação sobre datas. Pulado só quando a
       barra é cortada pelo fim do eixo (aí o clamp é declarado no texto). */
    if (a.confereLargura && !/depois do fim da janela/.test(a.title)) {
      const larguraDaData = regua.xDe(d.fim) - regua.xDe(d.inicio);
      const esperada = Math.max(PISO_BARRA_PX, larguraDaData);
      if (Math.abs(a.largura - esperada) > TOLERANCIA_PX) {
        piores.push(
          `${a.title.slice(0, 44)} — largura ${a.largura.toFixed(2)}, as datas mandam ${esperada.toFixed(2)}`,
        );
      }
    }
  }

  /*
   * ── AS EXCEÇÕES NÃO SÃO PULOS: CADA UMA TEM A SUA CONFERÊNCIA ──────────
   * Um clamp declarado diz duas coisas ao mesmo tempo: "a data está fora" e
   * "por isso o glifo está na borda". As duas são verificáveis, e é isso que
   * separa uma exceção declarada de um `continue`.
   */
  const excecoesTortas = [];
  for (const e of g.excecoes) {
    if (e.dentroDeBarra) {
      /* O único dever aqui: existir uma barra medida que o contenha e que
         declare o corte no próprio texto. */
      if (e.tituloDaBarraPai === null) {
        excecoesTortas.push(`glifo "${e.title.slice(0, 30)}" diz estar dentro de uma barra que não existe`);
      }
      continue;
    }
    if (/^prazo /.test(e.title)) {
      /* `lb-tl-atraso-seta`: o prazo tem de estar MESMO fora da barra-pai, do
         lado que o texto declara. Se estiver dentro, o desenho certo seria o
         traço (`lb-tl-atraso`), que é medido — e a seta está mentindo. */
      const prazo = /prazo\s+(\d{2}\/\d{2}\/\d{4})/.exec(e.title)?.[1] ?? null;
      const pai = e.tituloDaBarraPai === null ? null : datasDoTitulo(e.tituloDaBarraPai, g.hojeIso);
      const antes = /antes do início/.test(e.title);
      if (prazo === null || pai === null || !pai.parDeDatas) {
        excecoesTortas.push(`seta de prazo sem barra-pai datada: "${e.title.slice(0, 40)}"`);
        continue;
      }
      const p = epochDeBr(prazo);
      const i = epochDeBr(pai.inicio);
      const f = epochDeBr(pai.fim);
      if (antes ? !(p < i) : !(p > f)) {
        excecoesTortas.push(
          `seta de prazo diz "${antes ? "antes do início" : "depois do fim"}" mas ${prazo} cai dentro de ${pai.inicio}→${pai.fim} — o desenho certo seria o traço`,
        );
      }
      continue;
    }
    /* `lb-tl-fora-da-janela` de fora da barra e `lb-tl-erro`: o glifo tem de
       estar preso a uma das duas bordas do eixo. */
    const naBordaEsquerda = Math.abs(e.esquerda) <= TOLERANCIA_PX;
    const naBordaDireita = Math.abs(e.direita - g.larguraTotal) <= 12 + TOLERANCIA_PX;
    if (!naBordaEsquerda && !naBordaDireita) {
      excecoesTortas.push(
        `"${e.title.slice(0, 40)}" se declara fora da janela mas não está em borda nenhuma (esquerda ${e.esquerda.toFixed(2)}, direita ${e.direita.toFixed(2)}, eixo ${String(g.larguraTotal)})`,
      );
      continue;
    }
    const datas = [...e.title.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((m) => m[0]);
    if (datas.length === 0) continue; /* `lb-tl-erro`: dado podre, sem data a conferir */
    /* A data declarada tem de estar MESMO fora da janela desenhada, do lado
       em que o glifo está. Senão o desenho se recusou a posicionar algo que
       cabia — e aí o "◀" é que é a mentira. */
    const xDaData = regua.xDeBruto(datas[0]);
    if (naBordaEsquerda && xDaData > TOLERANCIA_PX) {
      excecoesTortas.push(
        `"${e.title.slice(0, 40)}" está no "◀" da borda esquerda, mas ${datas[0]} cai em ${xDaData.toFixed(2)} — DENTRO do eixo`,
      );
    }
    if (naBordaDireita && xDaData < g.larguraTotal - TOLERANCIA_PX) {
      excecoesTortas.push(
        `"${e.title.slice(0, 40)}" está no "▶" da borda direita, mas ${datas[0]} cai em ${xDaData.toFixed(2)} — DENTRO do eixo (${String(g.larguraTotal)})`,
      );
    }
  }

  /* [BAIXO 3b] As `dentro-da-barra` entram na conta de H: se uma delas se
     soltar da barra que a sustenta, H fica vermelha e diz qual. */
  const dentro = confereDentroDaBarra(g);
  excecoesTortas.push(...dentro.tortos);

  const resumoDePulos =
    (g.excecoes.length === 0
      ? "0 pulados"
      : `${String(g.excecoes.length)} por exceção declarada: ${[
          ...new Set(g.excecoes.map((e) => `${e.classes || "?"} (${e.motivo})`)),
        ].join(" ; ")}`) +
    ` — dentro-da-barra conferidas (${dentro.resumo})`;

  return {
    contexto,
    falhou:
      piores.length > 0 ||
      semData.length > 0 ||
      regua.desalinhadas.length > 0 ||
      excecoesTortas.length > 0 ||
      g.desconhecidos.length > 0 ||
      g.semRegua.length > 0,
    conferidas,
    pxPorDia: regua.pxPorDia,
    detalhe:
      piores.length === 0 &&
      semData.length === 0 &&
      regua.desalinhadas.length === 0 &&
      excecoesTortas.length === 0 &&
      g.desconhecidos.length === 0 &&
      g.semRegua.length === 0
        ? `${String(conferidas)} afirmações de data conferidas a ${regua.pxPorDia.toFixed(3)} px/dia (régua: ${String(
            g.guias.length,
          )} guias de segunda + a faixa de ${g.hojeIso}), 0 fora de ±${String(TOLERANCIA_PX)} px — ${resumoDePulos}`
        : [
            g.desconhecidos.length > 0
              ? `DESENHO NOVO SEM RÉGUA (classe fora do REGISTRO): ${g.desconhecidos.join(", ")}`
              : null,
            g.semRegua.length > 0
              ? `elemento que afirma data e não caiu em régua nenhuma: ${g.semRegua
                  .map(
                    (x) =>
                      `[${x.classes || "sem classe lb-tl-"}] "${x.title.slice(0, 40)}" ${x.dataLb.join(",")}${
                        x.porque ? ` — ${x.porque}` : ""
                      }`,
                  )
                  .join(" · ")}`
              : null,
            regua.desalinhadas.length > 0 ? `guias fora da conta: ${regua.desalinhadas.join(" · ")}` : null,
            semData.length > 0 ? `elemento sem par de datas no texto: ${semData.join(" · ")}` : null,
            ...excecoesTortas,
            ...piores,
          ]
            .filter(Boolean)
            .join(" · "),
    foraDaGrade: g.foraDaGrade,
    titulosDeBarra: g.afirmacoes.filter((a) => a.tipo).map((a) => a.title),
    classesNoPainel: g.classesNoPainel,
    excecoes: g.excecoes,
    rotulosForaDaJanela: g.rotulosForaDaJanela,
    geometria: g,
    regua,
  };
}

{
  /*
   * [BAIXO 3a, rodada 13] O produto tem QUATRO estados de escala — Auto,
   * Semana, Mês e Trimestre — e este laço rodava em três contextos, dos quais
   * dois eram "Auto". **Mês e Trimestre nunca entravam**: os dois zooms em que
   * o histórico inteiro cabe na tela, onde a densidade cai para 6–12px/dia e
   * o piso de largura da barra morde em quase toda linha. Não era vazamento
   * (o crítico estendeu o laço e o produto passou em todos), era BURACO — a
   * guarda não sabia se passaria. Custo de fechar: seis linhas neste array.
   */
  const resultados = [];
  for (const [largura, altura, zoom] of [
    [1440, 1000, null],
    [1440, 1000, "Semana"],
    [1440, 1000, "Mês"],
    [1440, 1000, "Trimestre"],
    [390, 844, null],
    [390, 844, "Semana"],
    [390, 844, "Mês"],
    [390, 844, "Trimestre"],
    [1024, 768, null],
  ]) {
    await medir("Q·H·J " + `${String(largura)}×${String(altura)}` + " " + (zoom ?? "Auto"), async () => {
      const { contexto, pagina } = await abrir(largura, altura);
      if (zoom) {
        await clicar(pagina.locator(`button[aria-label=${JSON.stringify(zoom)}]`).first(), `trocar o zoom para ${String(zoom)}`);
        await assentar(pagina);
      }
      const nomeDoContexto = `${String(largura)}×${String(altura)} ${zoom ?? "Auto"}`;
      resultados.push(await medirPixelContraData(pagina, nomeDoContexto));
      /* Q roda no MESMO estado que H e J — mesma página, mesmo zoom, mesma
         rolagem: o eixo Y é medido onde o eixo X já é medido. */
      conferirParesDeLinha(await medirRotuloContraDesenho(pagina), nomeDoContexto);
      await contexto.close();
    });
  }
  for (const r of resultados) {
    conferir(`H · cada barra no pixel que a sua data manda (${r.contexto})`, !r.falhou && (r.conferidas ?? 0) > 0, r.detalhe);
  }

  // ── J · nenhuma barra sem dado, e nenhuma linha sem dado na grade ─────────
  for (const r of resultados) {
    const semDatas = (r.titulosDeBarra ?? []).filter(
      (t) => !datasDoTitulo(t, "2026-01-01").parDeDatas,
    );
    const fora = r.foraDaGrade ?? [];
    const comBarra = fora.filter((f) =>
      (r.titulosDeBarra ?? []).some((t) => t.startsWith(`${f.titulo} —`)),
    );
    conferir(
      `J · barra só existe com duas datas no próprio texto (${r.contexto})`,
      semDatas.length === 0 && comBarra.length === 0,
      semDatas.length === 0 && comBarra.length === 0
        ? `${String((r.titulosDeBarra ?? []).length)} barras, todas declarando datas — ${String(
            fora.length,
          )} linha(s) fora da grade (${fora.map((f) => f.motivo).join(", ") || "nenhuma"}), 0 com barra`
        : [
            semDatas.length > 0
              ? `barra sem datas no texto: ${semDatas.map((t) => `"${t.slice(0, 50)}"`).join(" · ")}`
              : null,
            comBarra.length > 0
              ? `linha marcada "${comBarra[0].motivo}" com barra na grade: ${comBarra
                  .map((f) => f.titulo)
                  .join(" · ")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// N · TODA CAMADA QUE A GUARDA AFIRMA VER, PINTADA DE VERDADE
//     (achado CRÍTICO 1, generalizado)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * A varredura que o CRÍTICO 1 pediu: não só a faixa do "Hoje", mas TODA camada
 * sobre a qual alguma medida deste arquivo faz uma afirmação. Se H diz "esta
 * barra está no pixel que a data manda" e a barra está com `opacity: 0`, H
 * está certa e irrelevante ao mesmo tempo: a afirmação é sobre uma coisa que
 * o operador não vê.
 *
 * Cada camada passa por duas peneiras, e nenhuma delas lê atributo declarado
 * sozinho:
 *   1. ALFA REAL composto subindo a árvore (`__lbg.retrato`) — pega `opacity`
 *      no elemento e em qualquer ancestral, `visibility` herdada e `display`;
 *   2. PIXEL — a janelinha fotografada com e sem o elemento.
 *
 * `esperado` é quantos daquela camada TÊM de existir: `>=1` significa que zero
 * é REPROVAÇÃO. Alvo ausente não é dispensa — foi assim que `lb-tl-slack` e
 * `lb-tl-atraso` passaram duas rodadas com zero cobertura sem ninguém notar.
 */
/*
 * `garantida: true` = a fixture põe esta camada na tela em toda corrida, logo
 * ZERO dela é REPROVAÇÃO (alvo ausente não é dispensa). `garantida: false` =
 * a presença depende de dado que a fixture não fixa; aí a contagem é
 * IMPRESSA no relatório em toda corrida — o zero fica visível, nunca
 * silencioso — e a camada é medida sempre que existir. É a diferença entre
 * "não cobri" declarado e "não cobri" escondido.
 */
const CAMADAS_QUE_A_GUARDA_AFIRMA = [
  { seletor: ".lb-tl-hoje", cor: "borda", modo: "coluna", minimo: 8, garantida: true, quem: 'faixa do "Hoje" (a origem da régua de H e M)' },
  /*
   * [ALTO 1, rodada 14] A ÚNICA DISPENSA DE CONTRASTE, e ela não é um `continue`.
   *
   * A guia de semana é `border-navy-800/70` + `aria-hidden="true"`: uma linha
   * de grade DE PROPÓSITO quase invisível (medida: 1,19:1 contra o canvas).
   * Exigir 3:1 dela seria exigir que a grade gritasse mais que as barras — e
   * a WCAG 1.4.11, de onde o piso vem, dispensa explicitamente o que é
   * decorativo. Mas "decorativo" só vale quando a informação que a guia
   * marca CHEGA por outro canal, e é isso que `conferidaPor` nomeia: as
   * mesmas segundas-feiras saem por escrito no cabeçalho do eixo, e a medida
   * M compara cada rótulo impresso com esta mesma régua. A dispensa é
   * conferida no fim do arquivo — uma medida nomeada aqui que não tenha
   * rodado VERDE derruba a guarda (ver "toda dispensa de contraste…").
   *
   * O que a dispensa NÃO dispensa: a guia continua tendo de PINTAR (pixel que
   * muda ao esconder) e pintar NA COR declarada. `opacity: 0` cai igual.
   */
  {
    seletor: ".lb-tl-guia-semana",
    cor: "borda",
    modo: "coluna",
    minimo: 6,
    garantida: true,
    quem: "guias de segunda-feira (dão px/dia para H e M)",
    contrasteDecorativo: {
      porque: "linha de grade `aria-hidden`, quase invisível de propósito; a data que ela marca é impressa em TEXTO no cabeçalho do eixo",
      conferidaPor: ["M · o eixo imprime a data que a régua manda", "H · cada barra no pixel que a sua data manda"],
    },
  },
  { seletor: "[data-lb-barra]", cor: "fundo", modo: "coluna", minimo: 8, garantida: true, quem: "barras (o que H mede contra a data)" },
  /*
   * [BAIXO 5, rodada 14] `garantida: false` era uma dispensa de fato: o
   * losango só existia quando o relógio fazia `criado_em` e `mergeado_em` do
   * mesmo PR caírem no mesmo dia de calendário — medido, 3 às 01h e 0 às 03h.
   * Resultado: `.lb-tl-marco` nunca era medido por medida nenhuma, e a linha
   * "0/0 (não garantida)" no relatório era a única pista. A fixture passou a
   * ter um assunto de mesmo INSTANTE (PR #598, `d(3)` nas quatro datas), que
   * é mesmo dia em qualquer fuso e a qualquer hora — então agora zero é
   * REPROVAÇÃO, como em toda camada que o produto promete desenhar.
   */
  { seletor: ".lb-tl-marco", cor: "fundo", modo: "coluna", minimo: 4, garantida: true, quem: "losangos de marco (H mede o centro)" },
  { seletor: ".lb-tl-hoje-rotulo", cor: "texto", modo: "caixa", minimo: 8, garantida: true, quem: 'chip dourado de "hoje" (âncora datada do cabeçalho, em M)' },
  { seletor: ".lb-tl-slack", cor: "fundo", modo: "caixa", minimo: 8, garantida: true, quem: "hachura de folga (H mede as duas bordas dela)" },
  { seletor: ".lb-tl-atraso", cor: "fundo", modo: "coluna", minimo: 4, garantida: true, quem: "traço de prazo dentro da barra (H mede xDe(prazo))" },
  { seletor: ".lb-tl-fora-da-janela", cor: "texto", modo: "caixa", minimo: 4, garantida: true, quem: "chevrons de fora da janela (exceção declarada de H)" },
  { seletor: ".lb-tl-fora-da-janela-rotulo", cor: "texto", modo: "caixa", minimo: 8, garantida: true, quem: "a data POR ESCRITO do item fora da janela (achado ALTO 3)" },
  { seletor: ".lb-tl-fora-da-grade", cor: "texto", modo: "caixa", minimo: 8, garantida: true, quem: "o motivo POR ESCRITO da linha sem barra (J confia nele)" },
];

for (const [largura, altura] of [
  [1440, 1000],
  [390, 844],
]) {
  await medir(`N ` + `${String(largura)}×${String(altura)}`, async () => {
    const { contexto, pagina } = await abrir(largura, altura);
    const problemas = [];
    const resumo = [];
    /* [ALTO 1] O pior contraste medido em toda a varredura vai para o relatório:
       um número que CAI quando alguém baixa a opacidade, mesmo antes de cruzar
       o piso — a medida deixa rastro, não só veredito. */
    let piorContraste = Number.POSITIVE_INFINITY;
    let piorContrasteQuem = "nenhuma";
    for (const camada of CAMADAS_QUE_A_GUARDA_AFIRMA) {
      const alvos = await pagina.$$(camada.seletor);
      if (alvos.length === 0) {
        if (camada.garantida) {
          problemas.push(
            `${camada.seletor} — NENHUM na tela, e a guarda afirma coisas sobre ${camada.quem}: alvo ausente é reprovação, não dispensa`,
          );
        } else {
          /* Declarado, nunca calado: a contagem zero vai para o relatório. */
          resumo.push(`${camada.seletor}=0/0 (não garantida pela fixture: ${camada.quem})`);
        }
        continue;
      }
      let pintam = 0;
      const falhas = [];
      for (const alvo of alvos) {
        const r = await alvo.evaluate((el) => window.__lbg.retrato(el));
        const cor =
          camada.cor === "borda"
            ? r.esperadaDaBorda
            : camada.cor === "fundo"
              ? r.esperadaDoFundo
              : r.esperadaDoTexto;
        const alfa =
          camada.cor === "borda" ? r.alfaDaBorda : camada.cor === "fundo" ? r.alfaDoFundo : r.alfaDoTexto;
        const alfaOk = alfa > 0 && r.visivelHerdado && r.opacidadeAcumulada > 0;
        const pintou = await pintaDeVerdade(pagina, alvo, cor, camada.minimo, camada.modo);
        const melhor = pintou.contraste?.melhor;
        if (typeof melhor === "number" && melhor < piorContraste && !camada.contrasteDecorativo) {
          piorContraste = melhor;
          piorContrasteQuem = camada.seletor;
        }
        /*
         * A dispensa vale SÓ para a segunda pergunta ("dá para enxergar?"). As
         * outras duas continuam: pinta, e pinta na cor. `naoLegivel` é o único
         * motivo que a dispensa apaga — qualquer outro segue reprovando.
         */
        const soFaltouContraste =
          !pintou.ok &&
          (pintou.contraste?.legiveis ?? 0) < camada.minimo &&
          (pintou.mudaram ?? 0) >= camada.minimo &&
          (camada.modo === "caixa" || (pintou.naCor ?? 0) >= camada.minimo);
        if (alfaOk && (pintou.ok || (camada.contrasteDecorativo && soFaltouContraste))) {
          pintam += 1;
          continue;
        }
        falhas.push(
          `"${(r.texto || camada.seletor).slice(0, 28)}": ${
            alfaOk ? "" : `alfa real ${alfa.toFixed(3)} (opacidade acumulada ${r.opacidadeAcumulada.toFixed(3)}, visível herdado ${String(r.visivelHerdado)}) · `
          }${pintou.ok ? "" : pintou.motivo}`,
        );
      }
      if (pintam !== alvos.length) {
        problemas.push(`${camada.seletor} (${camada.quem}): ${String(pintam)}/${String(alvos.length)} pintam — ${falhas.slice(0, 2).join(" ; ")}`);
      }
      resumo.push(
        `${camada.seletor}=${String(pintam)}/${String(alvos.length)}${
          camada.contrasteDecorativo ? " (contraste dispensado: decorativa)" : ""
        }`,
      );
    }
    conferir(
      `N · toda camada que a guarda afirma ver está PINTADA (${String(largura)}×${String(altura)})`,
      problemas.length === 0,
      problemas.length === 0
        ? `${String(CAMADAS_QUE_A_GUARDA_AFIRMA.length)} camadas, todas com alfa real > 0, pixel que muda ao esconder E pixel composto legível contra o fundo real (piso ${PISO_NAO_TEXTO.toFixed(
            1,
          )}:1, de ${ARQUIVO_DO_PISO}; pior camada ${
            Number.isFinite(piorContraste) ? piorContraste.toFixed(2) : "—"
          }:1 em ${piorContrasteQuem}) — ${resumo.join(" · ")}`
        : problemas.join(" · "),
    );
    await contexto.close();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// O · OS MECANISMOS DESENHADOS NÃO PODEM CONTAR ZERO (achado ALTO 1)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * `lb-tl-slack` (que afirma `fim → fimComFolga`) e `lb-tl-atraso` (que afirma
 * `xFor(dueDate)` dentro da barra) contavam **0 nos 4 estados medidos**, em
 * toda largura e todo zoom: as duas únicas tarefas com barra da fixture eram
 * as duas do caminho crítico, com `folga: 0 d`, e o único prazo caía fora da
 * barra. Dois mecanismos desenhados, com régua escrita e zero cobertura.
 *
 * Contar zero é o estado em que uma régua não mede nada e diz "ok". Esta
 * medida transforma esse silêncio em vermelho — e é ela, não um comentário na
 * fixture, que impede a cobertura de sumir de novo (por exemplo se a janela
 * do zoom "Auto" andar com o calendário e a barra atrasada sair dela: aí o
 * zoom fixo ainda a desenha, e é isto que vai dizer se os dois somaram zero).
 */
await medir("O", async () => {
    const CLASSES_OBRIGATORIAS = [
      ["lb-tl-slack", "a hachura de folga afirma `fim → fimComFolga`"],
      ["lb-tl-atraso", "o traço de prazo afirma `xFor(dueDate)` dentro da barra"],
      ["lb-tl-fora-da-janela", "o chevron declara uma data fora da janela"],
      ["lb-tl-ponto-concluida", "o ponto afirma a data de conclusão"],
      /* [BAIXO 5, rodada 14] O losango entrou na lista OBRIGATÓRIA. Ele era a
         única classe que vivia em `SO_DECLARADAS`, e o motivo (a fixture montar
         os PRs relativos a `Date.now()`, então "mesmo dia" dependia da HORA da
         corrida) deixou de existir: o PR #598 da fixture nasce e morre no mesmo
         INSTANTE, o que é o mesmo dia em qualquer fuso e a qualquer hora. */
      ["lb-tl-marco", "o losango afirma uma data única (assunto de um dia só)"],
    ];
    /*
     * [BAIXO 5, rodada 14] Esta lista está VAZIA, e a vaga fica aberta de
     * propósito. Ela guardava o losango de marco com esta justificativa: a
     * fixture de frentes monta os PRs relativos a `Date.now()`, então "começa e
     * acaba no mesmo dia" dependia da HORA da corrida (medido: 3 losangos às
     * 01h e 0 às 03h, com a mesma árvore). A justificativa era verdadeira e o
     * efeito era um desenho do produto com ZERO cobertura — que é o estado que
     * a medida O existe para proibir. Consertou-se a CAUSA, não o relatório: o
     * PR #598 da fixture passou a nascer e morrer no mesmo instante. Uma classe
     * volta para cá só com um motivo que não tenha conserto na fixture.
     */
    const SO_DECLARADAS = [];
    const soma = {};
    const porEstado = [];
    for (const [largura, altura, zoom] of [
      [1440, 1000, null],
      [1440, 1000, "Semana"],
      [1440, 1000, "Trimestre"],
      [390, 844, null],
    ]) {
      const { contexto, pagina } = await abrir(largura, altura);
      if (zoom) {
        await clicar(pagina.locator(`button[aria-label=${JSON.stringify(zoom)}]`).first(), `trocar o zoom para ${String(zoom)}`);
        await assentar(pagina);
      }
      const g = await lerGeometria(pagina);
      const c = g?.classesNoPainel ?? {};
      for (const [classe] of [...CLASSES_OBRIGATORIAS, ...SO_DECLARADAS]) {
        soma[classe] = (soma[classe] ?? 0) + (c[classe] ?? 0);
      }
      porEstado.push(
        `${String(largura)}×${String(altura)} ${zoom ?? "Auto"}: ${[...CLASSES_OBRIGATORIAS, ...SO_DECLARADAS]
          .map(([classe]) => `${classe.replace("lb-tl-", "")}=${String(c[classe] ?? 0)}`)
          .join(" ")}`,
      );
      await contexto.close();
    }
    const zeradas = CLASSES_OBRIGATORIAS.filter(([classe]) => (soma[classe] ?? 0) === 0);
    conferir(
      "O · nenhum mecanismo desenhado soma ZERO nos 4 estados medidos",
      zeradas.length === 0,
      zeradas.length === 0
        ? `${String(CLASSES_OBRIGATORIAS.length)} mecanismos obrigatórios, todos desenhados ao menos uma vez${
            SO_DECLARADAS.length === 0
              ? "; nenhuma classe só declarada"
              : `; ${SO_DECLARADAS.map(
                  ([classe]) => `${classe}=${String(soma[classe] ?? 0)} (só declarado)`,
                ).join(", ")}`
          } — ${porEstado.join(" | ")}`
        : `mecanismo com ZERO cobertura de navegador: ${zeradas
            .map(([classe, porque]) => `${classe} (${porque})`)
            .join(" · ")} — ${porEstado.join(" | ")}`,
    );
});

// ═══════════════════════════════════════════════════════════════════════════
// P · NENHUM ITEM FORA DA JANELA É UMA LINHA MUDA (achado ALTO 3)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * A lei da casa (`periodo-da-tarefa.ts`): "uma linha sem barra não pode ser
 * uma linha muda". Estava aplicada às tarefas SEM DADO e não às que caem
 * FORA DA JANELA — essas viravam um "◀" de 9px, `aria-hidden="true"`,
 * `tabIndex={-1}`, com a data só no `title`. E este repositório já mediu, na
 * rodada 7, que `title` não existe no toque: a 390×844, 6 de 18 itens (33%)
 * não entregavam a data por nenhum canal tocável. Pior nas CONCLUÍDAS fora da
 * janela, em que o `aria-label` também não dizia data nenhuma.
 *
 * A medida amarra as duas superfícies: cada chevron do canvas TEM de ter, na
 * coluna de rótulos, um texto VISÍVEL com a sua data-âncora, e o `aria-label`
 * da linha tem de dizer o período. Um a um, não por contagem.
 */
for (const [largura, altura] of [
  [390, 844],
  [1440, 1000],
]) {
  await medir(`P ` + `${String(largura)}×${String(altura)}`, async () => {
    const { contexto, pagina } = await abrir(largura, altura);
    const g = await lerGeometria(pagina);
    /* Os chevrons do CANVAS que se recusam a posicionar uma linha inteira — não
       o "▶" que vive dentro de uma barra cortada pelo fim do eixo (esse é da
       barra, que já tem `title` datado e já é medida por H). */
    const chevrons = (g?.excecoes ?? []).filter(
      (e) => !e.dentroDeBarra && e.classes.includes("lb-tl-fora-da-janela"),
    );
    const rotulos = g?.rotulosForaDaJanela ?? [];
    const problemas = [];
    const pares = [];
    for (const c of chevrons) {
      const datas = [...c.title.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((m) => m[0]);
      if (datas.length === 0) {
        problemas.push(`o chevron "${c.title.slice(0, 40)}" não declara data nenhuma nem no title`);
        continue;
      }
      /* A âncora é a data que decide o lado: o início, ou (nas concluídas) a
         data de conclusão — que é a ÚNICA do title nesse caso. */
      const ancora = /concluída em/.test(c.title) ? datas[datas.length - 1] : datas[0];
      const casado = rotulos.find((r) => r.texto.includes(ancora));
      if (!casado) {
        problemas.push(
          `"${c.title.slice(0, 36)}" é um chevron de 9px e NENHUM rótulo visível da coluna imprime ${ancora} — a data só existe no title, que não existe no toque`,
        );
        continue;
      }
      if (!/\d{2}\/\d{2}\/\d{4}/.test(casado.rotuloAcessivel)) {
        problemas.push(`a linha de "${c.title.slice(0, 30)}" tem texto visível mas o aria-label não diz data nenhuma`);
        continue;
      }
      pares.push(`"${casado.texto}"`);
    }
    if (chevrons.length === 0) {
      /* Alvo ausente é reprovação: sem nenhum item fora da janela esta medida
         não mede nada, e não pode passar como se tivesse medido. */
      problemas.push("nenhum item fora da janela nesta tela — a medida não teria o que conferir");
    }
    conferir(
      `P · todo item fora da janela diz a sua data por escrito na coluna (${String(largura)}×${String(altura)})`,
      problemas.length === 0,
      problemas.length === 0
        ? `${String(chevrons.length)} chevron(s) no canvas, ${String(rotulos.length)} rótulo(s) datado(s) na coluna, todos casados — ${pares.slice(0, 3).join(" · ")}…`
        : problemas.slice(0, 3).join(" · "),
    );
    await contexto.close();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// M · OS RÓTULOS DE DATA DO EIXO, CONTRA A MESMA RÉGUA DAS BARRAS
//     (achado CRÍTICO 2)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * A régua da medida H é feita de duas coisas do CANVAS: as guias de
 * segunda-feira e a faixa do "Hoje". Os **rótulos de data do eixo** — os
 * "14", "15", "24" que o operador lê no cabeçalho para saber em que dia a
 * barra começa — saem de OUTRO array (`rotulosVisiveis`), moram em OUTRO
 * contêiner de rolagem (o cabeçalho transladado) e não entravam em régua
 * nenhuma. Um `.map` de uma linha deslocou todos eles 1 dia inteiro, poupando
 * o chip de "hoje" (o único com teste unitário), e os cinco portões ficaram
 * verdes: a barra "Deploy de produção — 24/09/2026" foi desenhada exatamente
 * sob o rótulo escrito "23", e a medida H imprimiu "0 fora de ±1,5 px".
 *
 * A medida é o CAMINHO INVERSO do que a rodada 11 fez para as barras:
 * posição → data (pela régua do canvas) → e o número que essa data manda tem
 * de ser o número IMPRESSO no rótulo. Três fontes independentes cruzadas
 * (guias, faixa do "Hoje", texto do rótulo), como em H.
 *
 * ## Por que em VÁRIAS posições de rolagem, e depois de um resize
 *
 * O cabeçalho é um contêiner TRANSLADADO que se sincroniza com o `scrollLeft`
 * do painel por handler de `scroll` e de `resize`. Medir só o primeiro quadro
 * mediria o único instante em que os dois estão sincronizados por construção
 * — e este repositório já mediu um caso em que o cabeçalho ficava "parado no
 * valor antigo, 329,6px adiantado das barras" depois de um resize. Uma
 * afirmação sobre a linha do tempo que só vale no instante do carregamento
 * não vale. Então: 5 posições de rolagem E um resize, e a régua é refeita do
 * zero em cada uma.
 */
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Confere os rótulos do eixo de uma página no estado em que ela está. */
async function medirRotulosDoEixo(pagina, comoChegou) {
  const g = await lerGeometria(pagina);
  if (g === null) return [`${comoChegou}: painel não encontrado`];
  const regua = montarRegua(g);
  if (regua.erro) return [`${comoChegou}: régua indisponível (${regua.erro})`];
  const erros = [];
  let conferidos = 0;
  for (const r of g.eixo) {
    const d = regua.dataEm(r.esquerda);
    const data = new Date(`${d.iso}T00:00:00.000Z`);
    const dia = data.getUTCDate();
    const mes = data.getUTCMonth();
    if (r.tipo === "dia" || r.tipo === "dia-mes" || r.tipo === "hoje") {
      conferidos += 1;
      /* O rótulo tem de cair EM CIMA de um dia inteiro da régua, não entre dois. */
      if (d.resto * regua.pxPorDia > TOLERANCIA_PX) {
        erros.push(
          `${comoChegou}: rótulo "${r.texto}" em ${r.esquerda.toFixed(2)} não cai em dia nenhum da régua (${d.dias.toFixed(3)} dia)`,
        );
        continue;
      }
      const esperadoDia = r.tipo === "dia" ? String(dia) : `${String(dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}`;
      if (r.texto !== esperadoDia) {
        erros.push(
          `${comoChegou}: o eixo imprime "${r.texto}" em ${r.esquerda.toFixed(2)}, mas a régua diz que ali é ${d.iso} (esperado "${esperadoDia}") — ${(
            (r.esquerda - regua.xDe(`${String(Number(r.texto.slice(0, 2)) || dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${String(data.getUTCFullYear())}`)) /
            regua.pxPorDia
          ).toFixed(2)} dia de erro`,
        );
      }
      if (r.tipo === "hoje") {
        /* O chip dourado e a faixa dourada são a MESMA data: se os dois se
           separarem, a régua tem duas origens e nenhuma é confiável. */
        if (Math.abs(r.esquerda - g.xHoje) > TOLERANCIA_PX) {
          erros.push(
            `${comoChegou}: o chip de "hoje" está em ${r.esquerda.toFixed(2)} e a faixa dourada em ${g.xHoje.toFixed(2)} — o cabeçalho saiu de sincronia com o canvas`,
          );
        }
        if (d.iso !== g.hojeIso) {
          erros.push(`${comoChegou}: o chip de "hoje" cai em ${d.iso}, e a faixa declara ${String(g.hojeIso)}`);
        }
      }
      continue;
    }
    if (r.tipo === "mes") {
      conferidos += 1;
      const nome = r.texto.slice(0, 3);
      const indice = MESES_CURTOS.indexOf(nome);
      if (indice < 0) {
        erros.push(`${comoChegou}: rótulo de mês ilegível "${r.texto}"`);
        continue;
      }
      /* O rótulo de mês nasce no dia 1º, mas o PRIMEIRO da janela é grudado na
         borda esquerda por construção (`gerarEscalaEixo`) — ali a régua diz o
         dia em que a janela começa, e o mês desse dia é que tem de bater.
         Exceção DECLARADA, e conferida: só vale em x ≈ 0. */
      const naBorda = Math.abs(r.esquerda) <= TOLERANCIA_PX;
      if (!naBorda && dia !== 1) {
        erros.push(
          `${comoChegou}: o rótulo "${r.texto}" está em ${r.esquerda.toFixed(2)}, que a régua diz ser ${d.iso} — um rótulo de mês fora da borda tem de cair no dia 1º`,
        );
      }
      if (indice !== mes) {
        erros.push(
          `${comoChegou}: o eixo imprime o mês "${r.texto}" em ${r.esquerda.toFixed(2)}, e a régua diz que ali é ${d.iso}`,
        );
      }
      if (/\d{4}/.test(r.texto) && !r.texto.includes(String(data.getUTCFullYear()))) {
        erros.push(`${comoChegou}: o rótulo "${r.texto}" declara um ano que a régua não confirma (${d.iso})`);
      }
    }
  }
  if (conferidos === 0) {
    /* Alvo ausente é REPROVAÇÃO, nunca dispensa: um eixo sem nenhum rótulo
       datado é exatamente o estado em que esta medida não mede nada. */
    return [`${comoChegou}: nenhum rótulo de data no eixo — não há o que conferir, e isso não é um passe`];
  }
  return erros.length > 0 ? erros : [];
}

for (const [largura, altura, zoom] of [
  [1440, 1000, null],
  [1440, 1000, "Semana"],
  [390, 844, null],
]) {
  await medir("M " + `${String(largura)}×${String(altura)}` + " " + (zoom ?? "Auto"), async () => {
    const { contexto, pagina } = await abrir(largura, altura);
    if (zoom) {
      await clicar(pagina.locator(`button[aria-label=${JSON.stringify(zoom)}]`).first(), `trocar o zoom para ${String(zoom)}`);
      await assentar(pagina);
    }
    const maximo = await pagina.evaluate(() => {
      const el = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
      return el ? el.scrollWidth - el.clientWidth : 0;
    });
    const erros = [];
    let cenas = 0;
    for (const fracao of [0, 0.25, 0.5, 0.75, 1]) {
      const alvo = Math.round(maximo * fracao);
      await pagina.evaluate(async (x) => {
        const el = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
        if (el) el.scrollLeft = x;
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(null))));
      }, alvo);
      cenas += 1;
      erros.push(...(await medirRotulosDoEixo(pagina, `rolagem ${String(alvo)}px`)));
    }
    /*
     * E depois de MUDANÇAS TARDIAS de tamanho. Uma afirmação que só sobrevive
     * ao primeiro quadro não é uma afirmação — e o gatilho exato do defeito de
     * sincronia que este repositório já mediu (achado ALTO A1 da rodada 6:
     * "o cabeçalho ficava parado no valor antigo, 329,6px adiantado das
     * barras") é ALARGAR o painel com a rolagem no MÁXIMO: o máximo diminui, o
     * navegador clampa o `scrollLeft` sozinho e, por já estar no valor novo,
     * nunca dispara `scroll` — quem tem de pegar isso é o `ResizeObserver`.
     *
     * Medido: uma sabotagem própria desta rodada (tirar a re-sincronização do
     * `ResizeObserver`) passava pela versão desta medida que só ENCOLHIA o
     * painel, porque encolher AUMENTA o máximo de rolagem e não clampa nada.
     * Por isso as duas direções, e sempre a partir da rolagem no máximo.
     */
    for (const [nome, fator] of [
      ["alargar", 1.6],
      ["encolher", 0.75],
    ]) {
      await pagina.evaluate(async () => {
        const el = document.querySelector('[role="region"][aria-label^="Linha do tempo"]');
        if (el) el.scrollLeft = el.scrollWidth;
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(null))));
      });
      await pagina.setViewportSize({ width: Math.round(largura * fator), height: altura });
      await assentar(pagina);
      cenas += 1;
      erros.push(
        ...(await medirRotulosDoEixo(
          pagina,
          `${nome} para ${String(Math.round(largura * fator))}px com a rolagem no máximo`,
        )),
      );
      await pagina.setViewportSize({ width: largura, height: altura });
      await assentar(pagina);
    }
    conferir(
      `M · o eixo imprime a data que a régua manda (${String(largura)}×${String(altura)} ${zoom ?? "Auto"})`,
      erros.length === 0,
      erros.length === 0
        ? `${String(cenas)} cenas (5 posições de rolagem + 2 resizes tardios com a rolagem no máximo, alargando e encolhendo), todos os rótulos de dia/mês/hoje batendo com a régua do canvas em ±${String(TOLERANCIA_PX)} px`
        : `${String(erros.length)} divergência(s) — ${erros.slice(0, 4).join(" · ")}`,
    );
    await contexto.close();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// K · ABRIR A GAVETA NÃO RE-ESCALA O EIXO (achado MÉDIO 5)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * A partir de 768px a gaveta é uma COLUNA e comprime o gráfico. Enquanto o
 * "auto" derivava `px/dia` da largura VISÍVEL, clicar numa linha para
 * inspecioná-la mudava a escala inteira — medido pelo crítico: a 1024×768 o
 * canvas ia de 736 para 424 px (42% menos), o "hoje" andava de 519 para 411 e
 * a barra clicada encolhia de 85 para 49 px. Toda barra mudava de tamanho e
 * de lugar no instante da inspeção, inclusive a que se estava olhando.
 */
for (const [largura, altura] of [
  [1024, 768],
  [1440, 900],
]) {
  await medir(`K ` + `${String(largura)}×${String(altura)}`, async () => {
    const { contexto, pagina } = await abrir(largura, altura);
    const antes = await lerGeometria(pagina);
    const reguaAntes = montarRegua(antes);
    const barraAlvo = antes.afirmacoes.find((a) => a.medida === "posicao-esquerda" && a.tipo);
    const rotulo = await pagina.$$eval('button[aria-haspopup="dialog"]', (els) =>
      els.map((e) => e.getAttribute("aria-label") ?? "").find((r) => r.includes("— assunto em ")),
    );
    await clicar(
      pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first(),
      `abrir a gaveta de "${String(rotulo).slice(0, 28)}"`,
    );
    await esperarSeletor(pagina, "[data-lb-detalhe]", "a gaveta abrir");
    await assentar(pagina);
    const depois = await lerGeometria(pagina);
    const reguaDepois = montarRegua(depois);
    const mesmaBarra = depois.afirmacoes.find((a) => a.title === barraAlvo?.title);
    const dPx = Math.abs((reguaDepois.pxPorDia ?? 0) - (reguaAntes.pxPorDia ?? 0));
    const dHoje = Math.abs((depois.xHoje ?? 0) - (antes.xHoje ?? 0));
    const dBarra = mesmaBarra && barraAlvo ? Math.abs(mesmaBarra.esquerda - barraAlvo.esquerda) : -1;
    const dLargura =
      mesmaBarra && barraAlvo ? Math.abs(mesmaBarra.largura - barraAlvo.largura) : -1;
    conferir(
      `K · abrir a gaveta não re-escala o eixo (${String(largura)}×${String(altura)})`,
      dPx <= 0.01 && dHoje <= 0.5 && dBarra >= 0 && dBarra <= 0.5 && dLargura <= 0.5,
      `px/dia ${(reguaAntes.pxPorDia ?? 0).toFixed(3)} → ${(reguaDepois.pxPorDia ?? 0).toFixed(3)} · ` +
        `"hoje" ${(antes.xHoje ?? 0).toFixed(2)} → ${(depois.xHoje ?? 0).toFixed(2)} · ` +
        `barra "${(barraAlvo?.title ?? "").slice(0, 28)}" left ${(barraAlvo?.esquerda ?? 0).toFixed(2)} → ${(
          mesmaBarra?.esquerda ?? 0
        ).toFixed(2)}, largura ${(barraAlvo?.largura ?? 0).toFixed(2)} → ${(mesmaBarra?.largura ?? 0).toFixed(2)}`,
    );
    await contexto.close();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// I · O PAR REAL DE CADA TEXTO VISÍVEL (cor computada × fundo composto)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Rodada 12 (achado ALTO 2). O rótulo desta medida era "todo texto visível
 * medido contra o fundo REAL (as 2 gavetas abertas)" — e ela abria 2 gavetas
 * de 22, num único viewport, num único zoom. Rodando o PRÓPRIO algoritmo dela
 * em todos os estados: 99 textos existiam, 64 nunca eram medidos — a linha
 * `marcas` inteira ("caminho crítico · atrasada", "sem estimativa · início
 * não definido"), o campo "Prazo:" e as datas de 20 das 22 gavetas. Nada
 * estava fora da régua; o defeito era a medida NÃO SABER se estivesse, com um
 * nome que afirmava o contrário.
 *
 * Agora ela abre TODAS as gavetas, nos DOIS tamanhos, e passa pelos TRÊS
 * zooms (cada zoom desenha um conjunto diferente de barras e de rótulos de
 * eixo, logo um conjunto diferente de textos). O que ela NÃO cobre está
 * declarado no fim do relatório dela, por escrito, em vez de ficar implícito
 * num nome generoso.
 */
for (const [largura, altura] of [
  [1440, 1000],
  [390, 844],
]) {
  await medir(`I ` + `${String(largura)}×${String(altura)}`, async () => {
    const { contexto, pagina } = await abrir(largura, altura);

    const medirTextos = async () =>
      await pagina.evaluate(() => {
        const canais = (css) => {
          const n = (css.match(/[\d.]+/g) ?? []).map(Number);
          return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
        };
        /** `frente` sobre `fundo`, alfa do primeiro. */
        const compor = (frente, fundo) => {
          const a = frente[3];
          return [
            frente[0] * a + fundo[0] * (1 - a),
            frente[1] * a + fundo[1] * (1 - a),
            frente[2] * a + fundo[2] * (1 - a),
            1,
          ];
        };
        const BRANCO_DO_CANVAS = [5, 7, 15, 1]; // navy-950 — só se nem o <html> tiver fundo
        const alvos = [...document.querySelectorAll("*")].filter((el) => {
          if (el.children.length > 0) return false;
          if (!(el.textContent ?? "").trim()) return false;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none") return false;
          return true;
        });
        return alvos.map((el) => {
          const cs = getComputedStyle(el);
          const meu = el.getBoundingClientRect();
          /*
            O FUNDO É O QUE ESTÁ ATRÁS, NÃO O QUE ESTÁ ACIMA NA ÁRVORE.
            Medido na 1ª execução desta medida: o badge "atrasada" e a bandeira
            "⚑" são `absolute` e nascem FORA da caixa da barra (logo depois do
            fim dela, ou 10px antes do início) — mas continuam filhos dela no
            DOM. Subir a árvore sem olhar a geometria dava "bone-300 sobre
            aresta-critico, 1,45:1" e "state-error sobre state-error, 1,00:1"
            para dois textos que o navegador pinta sobre o canvas escuro. Um
            ancestral só conta como fundo quando a caixa dele CONTÉM a minha.
            Limitação declarada: um texto que atravessa a fronteira de dois
            fundos é medido contra o de fora (o que contém os dois).
          */
          const contem = (r) =>
            r.left - 0.5 <= meu.left &&
            r.right + 0.5 >= meu.right &&
            r.top - 0.5 <= meu.top &&
            r.bottom + 0.5 >= meu.bottom;
          const pilha = [];
          let opacidade = Number.parseFloat(cs.opacity);
          let n = el;
          let fundo = null;
          while (n) {
            const c = getComputedStyle(n);
            const cor = canais(c.backgroundColor);
            const alfa = cor[3] * Number.parseFloat(c.opacity);
            if (alfa > 0 && (n === el || contem(n.getBoundingClientRect()))) {
              pilha.push([cor[0], cor[1], cor[2], Math.min(1, alfa)]);
              if (alfa >= 0.999) {
                fundo = pilha.pop();
                break;
              }
            }
            n = n.parentElement;
            if (n && n !== el) opacidade *= Number.parseFloat(getComputedStyle(n).opacity);
          }
          if (fundo === null) fundo = BRANCO_DO_CANVAS;
          for (let i = pilha.length - 1; i >= 0; i -= 1) fundo = compor(pilha[i], fundo);
          const frente = canais(cs.color);
          const corFinal = compor([frente[0], frente[1], frente[2], frente[3] * opacidade], fundo);
          const tamanho = Number.parseFloat(cs.fontSize);
          const peso = Number.parseInt(cs.fontWeight, 10) || 400;
          return {
            texto: (el.textContent ?? "").trim().slice(0, 34),
            cor: `rgb(${corFinal.slice(0, 3).map((v) => Math.round(v)).join(", ")})`,
            fundo: `rgb(${fundo.slice(0, 3).map((v) => Math.round(v)).join(", ")})`,
            canaisCor: corFinal,
            canaisFundo: fundo,
            minimo: tamanho >= 24 || (tamanho >= 18.66 && peso >= 700) ? 3 : 4.5,
            onde: el.closest("[data-lb-detalhe]") ? "gaveta" : "tela",
          };
        });
      });

    const cenas = [];

    /* Um zoom por cena: cada um desenha outro conjunto de barras e de rótulos
       de eixo — logo, outro conjunto de textos na tela. */
    for (const zoom of [null, "Semana", "Trimestre"]) {
      if (zoom) {
        await clicar(pagina.locator(`button[aria-label=${JSON.stringify(zoom)}]`).first(), `trocar o zoom para ${String(zoom)}`);
        await assentar(pagina);
      }
      cenas.push({ nome: `tela sem gaveta · ${zoom ?? "Auto"}`, amostras: await medirTextos() });
    }
    await clicar(pagina.locator('button[aria-label="Auto"]').first(), "voltar o zoom para Auto");
    await assentar(pagina);

    /* E TODAS as gavetas, uma por uma — não "a primeira tarefa e o primeiro
       assunto", que era o que deixava 20 das 22 datas de gaveta sem medida. */
    const rotulos = await pagina.$$eval('button[aria-haspopup="dialog"]', (els) =>
      els.map((el) => el.getAttribute("aria-label") ?? ""),
    );
    let gavetasAbertas = 0;
    for (const rotulo of rotulos) {
      const botao = pagina.locator(`button[aria-label=${JSON.stringify(rotulo)}]`).first();
      await precondicao(`abrir a gaveta de "${String(rotulo).slice(0, 28)}"`, async () => {
        await botao.scrollIntoViewIfNeeded();
        await botao.click({ timeout: TETO_DE_ACAO_MS });
        await pagina.waitForSelector("[data-lb-detalhe]", { timeout: TETO_DE_ACAO_MS });
      });
      await assentar(pagina);
      gavetasAbertas += 1;
      cenas.push({ nome: `gaveta "${rotulo.slice(0, 26)}"`, amostras: await medirTextos() });
    }
    if (gavetasAbertas !== rotulos.length) {
      /* Alvo ausente é reprovação: uma gaveta que não abriu é uma gaveta não
         medida, e o relatório não pode dizer que mediu todas. */
      conferir(
        `I · abriu todas as gavetas (${String(largura)}×${String(altura)})`,
        false,
        `${String(gavetasAbertas)} de ${String(rotulos.length)} gavetas abriram`,
      );
    }

    const reprovados = [];
    let medidos = 0;
    let emGaveta = 0;
    const distintos = new Set();
    let pior = { r: 99, texto: "", cor: "", fundo: "" };
    for (const cena of cenas) {
      for (const a of cena.amostras) {
        const r = razao(a.canaisCor, a.canaisFundo);
        medidos += 1;
        distintos.add(`${a.onde}|${a.texto}`);
        if (a.onde === "gaveta") emGaveta += 1;
        if (r < pior.r) pior = { r, texto: a.texto, cor: a.cor, fundo: a.fundo };
        if (r < a.minimo) {
          reprovados.push(
            `[${cena.nome}] "${a.texto}" ${r.toFixed(2)}:1 (min ${String(a.minimo)}) — ${a.cor} sobre ${a.fundo}`,
          );
        }
      }
    }
    /*
     * O QUE ESTA MEDIDA NÃO COBRE — declarado, porque um nome generoso sobre
     * uma cobertura estreita foi exatamente o achado ALTO 2:
     *   · estados que a fixture não produz (data inválida, datas inconsistentes,
     *     tarefa com prazo dentro E fora da barra ao mesmo tempo) — não há
     *     caminho de dado para eles nesta fixture, e a medida N imprime a
     *     contagem zero de cada camada em toda corrida;
     *   · larguras entre 390 e 1440 (as duas pontas são medidas, o meio não);
     *   · `:hover`/`:focus`, que mudam cor e não são um estado de repouso.
     */
    const naoCobre =
      "não cobre: estados sem caminho de dado na fixture, larguras entre 390 e 1440, e :hover/:focus";
    conferir(
      `I · o par real de TODO texto visível, em TODAS as gavetas e nos 3 zooms (${String(largura)}×${String(altura)})`,
      medidos > 0 && emGaveta > 0 && reprovados.length === 0,
      reprovados.length === 0
        ? `${String(medidos)} nós de texto (${String(distintos.size)} distintos) em ${String(
            cenas.length,
          )} cenas — 3 zooms + ${String(cenas.length - 3)} gavetas, ${String(
            emGaveta,
          )} nós dentro de gavetas — pior ${pior.r.toFixed(2)}:1 em "${pior.texto}" (${pior.cor} sobre ${pior.fundo}) · ${naoCobre}`
        : `${String(reprovados.length)} de ${String(medidos)} abaixo da régua — ${reprovados
            .slice(0, 6)
            .join(" · ")}`,
    );
    await contexto.close();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// R · O TECLADO ALCANÇA O QUE A TELA OFERECE  (achado ALTO 2, rodada 14)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * `grep -c "keyboard\\|\\.press(\\|Tab" tests/navegador/guarda-p5.mjs` devolvia
 * **0**. Vinte e sete medidas no Chromium, 47 conferências, e NENHUMA
 * encostava no teclado — enquanto a guarda da peça irmã P4 já tinha duas.
 *
 * O que isso deixava passar, medido: `tabIndex={-1}` nos dois botões de
 * rótulo (assunto e tarefa) passa em **47/47** medidas, e o número de
 * elementos que o Tab alcança cai de **27 para 0**. A tela inteira continua
 * desenhada, os `aria-label` continuam certos, o leitor de tela continua
 * lendo — e ninguém que usa teclado consegue abrir uma linha.
 *
 * ## O universo, e por que ele não pode sair do próprio Tab
 *
 * Contar "quantos o Tab alcança" contra "quantos o Tab deveria alcançar"
 * derivado de `[tabindex]:not([tabindex="-1"])` seria a forma 3 do vício:
 * `tabIndex={-1}` tira o elemento das DUAS contas ao mesmo tempo, e a razão
 * continua 100%.
 *
 * O universo aqui é o que o PRODUTO declara ser um controle: todo `<button>`
 * e todo `<a href>` VISÍVEL na página, com caixa de layout, independente de
 * `tabindex`. Ser um `<button>` é a declaração; `tabindex="-1"` é a
 * sabotagem. Cada um deles tem de ser alcançado por Tab a partir do topo do
 * documento.
 *
 * ## E alcançar não basta: tem de FAZER
 *
 * Um foco que pousa num botão inerte é meia medida. Depois da varredura, a
 * guarda tabula até o primeiro botão de linha, aperta Enter e exige que a
 * gaveta da linha abra — o mesmo efeito que o clique produz.
 */
/*
 * [ALTO 1, rodada 15] A VARREDURA DE R É A MESMA DAS SENTINELAS V E W.
 *
 * Antes desta rodada o universo de R vivia dentro dela, escrito à mão. Duas
 * definições de "o que é um controle" no mesmo arquivo é o começo da forma 5
 * do vício (conferir o caso, não a classe): quem mexesse numa não mexeria na
 * outra, e a medida do INSTANTE e a medida do TEMPO passariam a falar de
 * universos diferentes. Agora as três usam `varrerTeclado` e a mesma lista de
 * viewports — e é por isso que a medida X consegue cobrar que todo viewport
 * medido por R tenha as suas duas sentinelas.
 */
for (const [largura, altura] of VIEWPORTS_DO_TECLADO) {
  await medir(`R ` + `${String(largura)}×${String(altura)}`, async () => {
    const { contexto, pagina } = await abrir(largura, altura);
    const foto = await varrerTeclado(pagina);
    registrarUniverso(largura, altura, foto.universo.length);
    const problemas = oQueFaltaAgora(foto, "logo depois da carga");
    const linhasAlcancadas = foto.universo.filter(
      (c) => c.linha !== null && foto.alcancadosIds.includes(c.id),
    ).length;

    /* Alcançar não é fazer: Enter no primeiro botão de linha tem de abrir a
       gaveta daquela linha — o mesmo efeito do clique. */
    if (linhasAlcancadas > 0) {
      await pagina.evaluate(() => {
        document.querySelector("button[data-lb-linha]")?.focus();
      });
      const focouNaLinha = await pagina.evaluate(
        () => document.activeElement?.getAttribute?.("data-lb-linha") ?? null,
      );
      await pagina.keyboard.press("Enter");
      await assentar(pagina);
      const abriuComEnter =
        focouNaLinha !== null &&
        (await pagina.evaluate(() => document.querySelectorAll('[data-lb-detalhe], [role="dialog"], [data-lb-gaveta]').length > 0 ||
          [...document.querySelectorAll("*")].some((el) => (el.textContent ?? "").trim() === "Período")));
      if (!abriuComEnter) {
        problemas.push(
          "Enter no botão de linha focado não abriu a gaveta — o teclado chega ao controle e o controle não faz o que o clique faz",
        );
      }
    }

    conferir(
      `R · o teclado alcança o que a tela oferece (${String(largura)}×${String(altura)})`,
      problemas.length === 0,
      problemas.length === 0
        ? `${String(foto.alcancadosIds.length)}/${String(foto.universo.length)} controles visíveis alcançados por Tab (universo = todo <button>/<a href> com caixa, veja ele o Tab ou não), ${String(
            linhasAlcancadas,
          )} deles botões de linha · Enter no primeiro abriu a gaveta · ATENÇÃO: esta medida olha o INSTANTE da carga; o que envelhece é medido por V e W, e o que o USO quebra, por Y
        `.trim()
        : problemas.join(" · "),
    );
    await contexto.close();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// S · A PRECEDÊNCIA DESENHADA É A PRECEDÊNCIA DA FONTE  (achado ALTO 3)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * `void edges` dentro de `precedenciaDeclarada` derruba a terceira fonte da
 * união do CPM (as `task_edges` de tipo `predecessor`). Os conectores caíam de
 * 5 para 4 — e a guarda **imprimia o número mudado e aprovava**, porque o
 * universo esperado era o que o próprio desenho tinha entregue.
 *
 * Aqui o universo vem de FORA do desenho: `precedenciaDaFonte()` lê a mesma
 * fonte de dado que alimenta o CPM (a fixture que o servidor desta guarda
 * serve) e aplica a lei da união escrita de novo, sem passar por nenhuma
 * função do produto. Duas implementações independentes da mesma lei — é isso
 * que dá à comparação poder de reprovar.
 *
 * A comparação é PAR A PAR, nunca por contagem: um par que some e outro que
 * apareça dariam o mesmo total.
 */
await medir("S", async () => {
    const { pares, porFonte, ids } = precedenciaDaFonte();
    const { contexto, pagina } = await abrir(1440, 1000);
    const desenhados = await pagina.evaluate(() =>
      [...document.querySelectorAll(".lb-tl-connector[data-lb-origem][data-lb-destino]")].map((g) => ({
        origem: g.getAttribute("data-lb-origem"),
        destino: g.getAttribute("data-lb-destino"),
      })),
    );
    /* As tarefas que a tela REALMENTE desenha como linha: um par só pode ser
       exigido quando as duas pontas estão na tela (o componente pula o
       predecessor órfão, e a lei da fonte também). */
    const linhasNaTela = new Set(
      (await pagina.evaluate(() =>
        [...document.querySelectorAll("button[data-lb-linha]")].map((b) => b.getAttribute("data-lb-linha")),
      )).filter((c) => typeof c === "string"),
    );
    const naTela = (id) => [...linhasNaTela].some((c) => c === id || c.endsWith(`:${id}`) || c.includes(id));

    const esperados = [...pares.keys()].filter((chave) => {
      const [origem, destino] = chave.split("->");
      return naTela(origem) && naTela(destino);
    });
    const feitos = new Set(desenhados.map((d) => `${d.origem}->${d.destino}`));
    const faltando = esperados.filter((c) => !feitos.has(c));
    const sobrando = [...feitos].filter((c) => !pares.has(c));

    const ok =
      esperados.length >= 4 && faltando.length === 0 && sobrando.length === 0 && desenhados.length > 0;
    conferir(
      "S · a precedência DESENHADA é a precedência da FONTE (par a par)",
      ok,
      ok
        ? `${String(esperados.length)} pares esperados, lidos de ${ARQUIVO_DA_FONTE} (${String(
            ids.length,
          )} tarefas; ${Object.entries(porFonte)
            .map(([f, n]) => `${f}=${String(n)}`)
            .join(" ")}) — todos desenhados, e nenhum conector a mais`
        : [
            esperados.length < 4
              ? `só ${String(esperados.length)} par(es) esperados na tela — universo pequeno demais para reprovar`
              : null,
            faltando.length > 0
              ? `precedência da FONTE que a tela NÃO desenha: ${faltando.join(" · ")} (a fonte declara ${String(
                  pares.size,
                )} pares: ${[...pares.keys()].join(", ")}; a tela desenhou ${String(desenhados.length)})`
              : null,
            sobrando.length > 0 ? `conector que a fonte não declara: ${sobrando.join(" · ")}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
    );
    await contexto.close();
});

// ═══════════════════════════════════════════════════════════════════════════
// T · ZOOM DIFERENTE É GEOMETRIA DIFERENTE  (achado MÉDIO 4, rodada 14)
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Trocar `PX_POR_DIA_FIXO[zoom]` por `PX_POR_DIA_FIXO.semana` passava em tudo:
 * os 9 contextos de H, J e Q (3 larguras × 4 zooms) viravam **4 cenas medidas
 * 9 vezes**. O seletor de zoom continuava lá, com `aria-pressed` mudando de
 * botão, e o eixo não mexia um pixel. Nenhuma medida perguntava se apertar o
 * botão fazia alguma coisa — só se o que estava desenhado estava certo.
 *
 * A régua não lê `PX_POR_DIA_FIXO` (isso seria conferir o número contra ele
 * mesmo). Ela mede, em cada zoom, o `px/dia` que sai das GUIAS DE SEGUNDA
 * desenhadas no canvas — a mesma régua independente que a medida H usa — e
 * exige que os quatro sejam distintos DOIS A DOIS, com a largura total do
 * eixo acompanhando. Se dois zooms produzirem a mesma geometria, um deles não
 * existe.
 */
for (const [largura, altura] of [
  [1440, 1000],
  [390, 844],
]) {
  await medir(`T ` + `${String(largura)}×${String(altura)}`, async () => {
    const { contexto, pagina } = await abrir(largura, altura);
    const cenas = [];
    const problemas = [];
    for (const zoom of ["Auto", "Semana", "Mês", "Trimestre"]) {
      await clicar(pagina.locator(`button[aria-label=${JSON.stringify(zoom)}]`).first(), `trocar o zoom para ${String(zoom)}`);
      await assentar(pagina);
      const g = await lerGeometria(pagina);
      const regua = montarRegua(g);
      if (regua.erro) {
        problemas.push(`${zoom}: não consegui montar a régua do canvas — ${regua.erro}`);
        continue;
      }
      const pressionado = await pagina.evaluate(
        (z) => document.querySelector(`button[aria-label="${z}"]`)?.getAttribute("aria-pressed") ?? null,
        zoom,
      );
      if (pressionado !== "true") {
        problemas.push(`${zoom}: cliquei e o botão não ficou marcado (aria-pressed=${String(pressionado)})`);
      }
      cenas.push({ zoom, pxPorDia: regua.pxPorDia, larguraTotal: g.larguraTotal });
    }
    /* Dois a dois: a colisão pode ser entre qualquer par, não só com o vizinho. */
    for (let i = 0; i < cenas.length; i += 1) {
      for (let j = i + 1; j < cenas.length; j += 1) {
        const a = cenas[i];
        const b = cenas[j];
        if (Math.abs(a.pxPorDia - b.pxPorDia) <= TOLERANCIA_PX) {
          problemas.push(
            `"${a.zoom}" e "${b.zoom}" desenham a MESMA escala: ${a.pxPorDia.toFixed(3)} e ${b.pxPorDia.toFixed(
              3,
            )} px/dia (eixo de ${a.larguraTotal.toFixed(0)}px e ${b.larguraTotal.toFixed(
              0,
            )}px) — um dos dois botões não faz nada`,
          );
        }
      }
    }
    conferir(
      `T · zoom diferente é geometria diferente (${String(largura)}×${String(altura)})`,
      problemas.length === 0 && cenas.length === 4,
      problemas.length === 0 && cenas.length === 4
        ? `4 zooms, 4 escalas distintas medidas nas guias do canvas — ${cenas
            .map((c) => `${c.zoom} ${c.pxPorDia.toFixed(2)}px/dia (eixo ${c.larguraTotal.toFixed(0)}px)`)
            .join(" · ")}`
        : problemas.join(" · "),
    );
    await contexto.close();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// U · TODA DISPENSA DE CONTRASTE NOMEIA MEDIDAS QUE RODARAM VERDES
// ═══════════════════════════════════════════════════════════════════════════
/*
 * A medida N dispensa a pergunta "dá para enxergar?" de uma camada só — a
 * guia de semana, que é grade decorativa. A dispensa só se sustenta enquanto
 * a informação chegar por outro canal, e o `conferidaPor` da camada nomeia
 * QUAL medida garante isso. Esta conferência fecha o laço: cada nome
 * declarado tem de corresponder a uma medida que realmente rodou e ficou
 * VERDE nesta corrida. Dispensa que aponta para uma medida que não existe (ou
 * que reprovou) é uma checagem pulada com cara de exceção declarada.
 */
await medir("U", async () => {
    const dispensas = CAMADAS_QUE_A_GUARDA_AFIRMA.filter((c) => c.contrasteDecorativo);
    const problemas = [];
    for (const camada of dispensas) {
      for (const nome of camada.contrasteDecorativo.conferidaPor) {
        const rodou = medidas.filter((m) => m.includes(nome));
        if (rodou.length === 0) {
          problemas.push(`${camada.seletor} aponta para "${nome}", e nenhuma medida com esse nome rodou`);
          continue;
        }
        const vermelhas = rodou.filter((m) => m.startsWith("FALHA"));
        if (vermelhas.length > 0) {
          problemas.push(`${camada.seletor} aponta para "${nome}", que reprovou nesta corrida`);
        }
      }
    }
    if (dispensas.length === 0) problemas.push("nenhuma dispensa declarada — esta conferência não mediria nada");
    conferir(
      "U · toda dispensa de contraste nomeia medidas que rodaram VERDES",
      problemas.length === 0,
      problemas.length === 0
        ? `${String(dispensas.length)} dispensa(s): ${dispensas
            .map(
              (c) =>
                `${c.seletor} (${c.contrasteDecorativo.porque}) conferida por ${c.contrasteDecorativo.conferidaPor.length} medida(s) verde(s)`,
            )
            .join(" · ")}`
        : problemas.join(" · "),
    );
});

// ═══════════════════════════════════════════════════════════════════════════
// V · A SENTINELA DE TEMPO REAL: O TECLADO CONTINUA ALCANÇANDO DEPOIS
//     (achado ALTO 1, rodada 15 — a medida R media um instante só)
//
// Esta página foi aberta antes da medida A e, desde então, só EXISTIU. A
// pergunta, na forma mais crua: **em algum momento da vida desta guarda,
// alguma coisa tirou um controle do alcance do teclado?** O tempo de vida é o
// alcance, e sai impresso. Três redes: a varredura de Tab refeita (o produto),
// a fotografia comparada (o que envelheceu) e o vigia (quem escreveu, e aos
// quantos segundos).
// ═══════════════════════════════════════════════════════════════════════════
for (const sentinela of SENTINELAS_DO_TECLADO.filter((s) => s.tipo === "tempo real")) {
  await medir(`V ${sentinela.nome}`, async () => {
    if (!sentinela.ok) {
      throw new PrecondicaoFalhou(
        `a sentinela de teclado ${sentinela.nome} nunca nasceu: ${sentinela.motivo}`,
        { cause: sentinela.erro },
      );
    }
    const vida = Date.now() - sentinela.nascimento;
    const depois = await varrerTeclado(sentinela.pagina);
    const vigia = await lerVigiaDoFoco(sentinela.pagina);
    const problemas = [
      ...oQueFaltaAgora(depois, "no fim da corrida"),
      ...oQueEnvelheceu(sentinela.foto, depois),
      ...oQueOVigiaViu(vigia),
    ];
    if (vida < PISO_DE_VIDA_DA_SENTINELA_MS) {
      problemas.push(
        `a sentinela viveu ${String(Math.round(vida / 1000))}s, menos que o piso declarado de ${String(Math.round(PISO_DE_VIDA_DA_SENTINELA_MS / 1000))}s — o alcance encolheu`,
      );
    }
    /*
     * A cópia que mora no NODE, que nenhum código da aba alcança. Ela não
     * sabe separar montagem de envelhecimento (isso é o marco, que vive na
     * página), então serve para UMA coisa: provar que o canal existiu. Canal
     * mudo com a página anotando é vigia sequestrado.
     */
    if (sentinela.registroForaDaPagina.length < vigia.antes + vigia.depois.length) {
      problemas.push(
        `o canal fora da página recebeu ${String(sentinela.registroForaDaPagina.length)} anotação(ões) e a página tem ${String(vigia.antes + vigia.depois.length)} — alguém calou o canal`,
      );
    }
    conferir(
      `V · o teclado alcança DEPOIS do tempo passar (${sentinela.nome})`,
      problemas.length === 0,
      problemas.length === 0
        ? `viveu ${String(Math.round(vida / 1000))}s — este é o ALCANCE DE TEMPO REAL desta guarda neste viewport, e mutação agendada para depois dele NÃO é vista (piso: ${String(Math.round(PISO_DE_VIDA_DA_SENTINELA_MS / 1000))}s) · ${String(depois.universo.length)}/${String(depois.universo.length)} controles ainda alcançáveis por Tab, ${String(depois.linhas)} botões de linha · fotografia idêntica à do nascimento nos ${String(CAMPOS_DO_CONTRATO_DE_FOCO.length)} campos do contrato de foco · vigia: ${String(vigia.redes.length)} redes, ${String(vigia.antes)} escrita(s) na montagem e 0 depois do nascimento`
        : problemas.join(" · "),
    );
    await sentinela.contexto.close();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// W · A SENTINELA DO RELÓGIO: MEIA HORA DE UMA VEZ, DUAS VEZES
//
// Esperar 60 s para pegar uma mutação de 60 s seria pagar caro por uma
// duplicação — o sabotador escreveria 120 s. Esta página nasceu com o relógio
// sob controle da guarda; aqui ele anda meia hora de uma vez, os controles são
// EXERCIDOS (um handler que só nasce com o tempo precisa de quem o acorde) e o
// relógio anda outra meia hora. Só então a varredura de Tab é refeita.
// ═══════════════════════════════════════════════════════════════════════════
for (const sentinela of SENTINELAS_DO_TECLADO.filter((s) => s.tipo === "relógio de mentira")) {
  await medir(`W ${sentinela.nome}`, async () => {
    if (!sentinela.ok) {
      throw new PrecondicaoFalhou(
        `a sentinela de teclado ${sentinela.nome} nunca nasceu: ${sentinela.motivo}`,
        { cause: sentinela.erro },
      );
    }
    await sentinela.pagina.clock.fastForward(ADIANTAMENTO_DO_RELOGIO_MS);
    await assentar(sentinela.pagina);
    const exercidos = await exercitarControles(sentinela.pagina);
    await assentar(sentinela.pagina);
    await sentinela.pagina.clock.fastForward(ADIANTAMENTO_DO_RELOGIO_MS);
    await assentar(sentinela.pagina);
    const depois = await varrerTeclado(sentinela.pagina);
    const vigia = await lerVigiaDoFoco(sentinela.pagina);
    const problemas = [
      ...oQueFaltaAgora(depois, "depois de uma hora de relógio adiantado"),
      ...oQueEnvelheceu(sentinela.foto, depois),
      ...oQueOVigiaViu(vigia),
    ];
    if (exercidos < PISO_DE_CONTROLES) {
      problemas.push(
        `só ${String(exercidos)} controle(s) exercidos DEPOIS do adiantamento (piso: ${String(PISO_DE_CONTROLES)}) — um handler que nasce com o tempo não teria quem o acordasse`,
      );
    }
    conferir(
      `W · o teclado alcança depois de meia hora de relógio (${sentinela.nome})`,
      problemas.length === 0,
      problemas.length === 0
        ? `relógio adiantado ${String(Math.round(ADIANTAMENTO_DO_RELOGIO_MS / 60000))} min de uma vez, DUAS vezes, com ${String(exercidos)} controles exercidos (foco + ${String(EVENTOS_EXERCIDOS.length)} eventos) entre elas — atraso ATÉ ISSO está no alcance desta guarda neste viewport · ${String(depois.universo.length)} controles, todos alcançáveis por Tab, ${String(depois.linhas)} botões de linha · vigia: ${String(vigia.antes)} escrita(s) na montagem e 0 depois do nascimento`
        : problemas.join(" · "),
    );
    await sentinela.contexto.close();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Y · A SENTINELA DE INTERAÇÃO: O TECLADO DEPOIS DE A PÁGINA SER USADA
//     (achado ALTO 1, rodada 16 — V e W cobriam o relógio, não o uso)
//
// V e W perguntam "e se o tempo passar?". Esta pergunta é outra: **e depois
// que o operador MEXE?** O roteiro é de interação de verdade — clique, botão
// de zoom, roda do mouse e Enter no teclado —, cada passo com o efeito
// PROVADO antes de a medição valer, e a varredura de Tab refeita DEPOIS DE
// CADA UM. Duas redes por varredura: o absoluto (tudo o que a tela oferece
// agora tem de ser alcançável) e a regressão contra a varredura anterior (o
// que o Tab já alcançava não pode sumir da ordem). Mais o vigia, lido com a
// régua do uso: escrita que MATA o teclado é proibida; escrita legítima do
// React ao abrir e fechar a gaveta, não.
//
// Aprovar por ausência está fechado por dois números escritos à mão: o piso
// de interações (`PISO_DE_INTERACOES`) e o piso de controles por varredura
// (`PISO_DE_CONTROLES`, dentro de `oQueFaltaAgora`).
// ═══════════════════════════════════════════════════════════════════════════
for (const sentinela of SENTINELAS_DO_TECLADO.filter((s) => s.tipo === "interação")) {
  await medir(`Y ${sentinela.nome}`, async () => {
    if (!sentinela.ok) {
      throw new PrecondicaoFalhou(
        `a sentinela de teclado ${sentinela.nome} nunca nasceu: ${sentinela.motivo}`,
        { cause: sentinela.erro },
      );
    }
    const problemas = [];
    const feitos = [];
    let antes = sentinela.foto;
    /*
     * [MÉDIO] O inventário do que o produto OFERECE, lido da página e
     * acumulado a cada passo. Ler uma vez só seria a forma 4 (*mede um
     * instante só*): o botão "fechar" da gaveta não existe antes de alguém
     * abrir a gaveta.
     */
    const oferecidas = new Map();
    /* O último retrato do que a página escuta FORA dos nós, com o contador de
       cada ouvinte: é dele que sai "exercida", medida em vez de declarada. */
    let ouvintesAgora = [];
    const ondeApareceu = async (quando) => {
      const inv = await inventariarEntradas(sentinela.pagina);
      registrarEntradasDoProduto(inv.entradas, sentinela.nome);
      registrarOuvintesDoProduto(inv.ouvintes);
      ouvintesAgora = inv.ouvintes;
      for (const e of inv.entradas) {
        if (!oferecidas.has(e.chave)) oferecidas.set(e.chave, { quando, quantos: e.quantos });
      }
      return inv;
    };
    const inventarioInicial = await ondeApareceu("na carga da página");
    const exercidas = new Set();
    /* Entradas de fora dos nós cujo ouvinte já rodou alguma vez nesta página. */
    const jaRodaram = () => new Set(ouvintesAgora.filter((o) => o.chamadas > 0).map((o) => o.chave));
    const chavesDeFora = () => new Set(ouvintesAgora.map((o) => o.chave));
    /*
     * [ALTO 1] O ACHADO JÁ MEDIDO VENCE A PRECONDIÇÃO QUE VEM DEPOIS.
     *
     * Medido com a sabotagem do coordenador (`jaAbriu`): depois de abrir a
     * gaveta, 27 dos 38 controles saem do Tab — a varredura do passo 1 anota
     * isso com nome e número. Três passos adiante, o passo que exige chegar a
     * um botão de linha SÓ COM Tab não consegue mais — e, se a exceção
     * vencesse, a guarda reprovaria dizendo "a precondição falhou", jogando
     * fora a frase que explica o defeito. Precondição existe para dizer "não
     * medi o produto"; aqui o produto JÁ foi medido e já está quebrado, e o
     * passo que não se estabelece é CONSEQUÊNCIA. Então: se já há problema
     * anotado, o veredito é o problema; se não há, a precondição sobe como
     * sempre.
     */
    let interrompido = null;
    let emCurso = null;
    try {
      for (const passo of ROTEIRO_DE_USO) {
        emCurso = passo.nome;
        const efeito = await passo.fazer(sentinela.pagina, sentinela);
        if (!efeito.ok) {
          throw new PrecondicaoFalhou(
            `a interação "${passo.nome}" não teve efeito nenhum (${efeito.dito}) — medir o teclado depois dela seria medir a mesma tela de sempre`,
          );
        }
        for (const chave of passo.cobre) exercidas.add(chave);
        await ondeApareceu(`depois de ${passo.nome}`);
        const depois = await varrerTeclado(sentinela.pagina);
        registrarUniversoDoUso(sentinela.largura, sentinela.altura, depois.universo.length);
        problemas.push(
          ...oQueFaltaAgora(depois, `depois de ${passo.nome}`),
          ...oQuePerdeuOTab(antes, depois, `depois de ${passo.nome}`),
        );
        /*
         * [ALTO, rodada 20] E o estado que o passo deixou DURA a ausência
         * inteira no relógio da página antes do passo seguinte — cuja
         * varredura é a que vê o que envelheceu aqui. A gaveta aberta há dois
         * dias é um estado tão real quanto a aba escondida há dois dias.
         */
        const segurou = await ausencia(sentinela.pagina);
        registrarAusenciaDoRoteiro(sentinela.largura, sentinela.altura, passo.nome, segurou);
        feitos.push(
          `${passo.nome} [${efeito.dito}] → ${String(depois.alcancadosIds.length)}/${String(depois.universo.length)} no Tab · e ${duracaoEmGente(segurou)} assim`,
        );
        antes = depois;
      }
      /*
       * [MÉDIO, rodada 19] OS ESTÍMULOS INCONDICIONAIS. O roteiro fixo
       * acabou; agora a guarda faz à página TUDO o que o navegador faz a uma
       * página aberta — escute ela ou não, e por qualquer canal que escute.
       * Nenhum estímulo depende do inventário: o inventário só cobra, no
       * fecho, o que a página escuta e nenhum estímulo acordou.
       */
      for (const estimulo of ESTIMULOS_DO_NAVEGADOR) {
        emCurso = estimulo.nome;
        const dito = await executarEstimulo(estimulo, sentinela.pagina, sentinela);
        await ondeApareceu(`depois de ${estimulo.nome}`);
        const depois = await varrerTeclado(sentinela.pagina);
        registrarUniversoDoUso(sentinela.largura, sentinela.altura, depois.universo.length);
        problemas.push(
          ...oQueFaltaAgora(depois, `depois de ${estimulo.nome} (estímulo do navegador)`),
          ...oQuePerdeuOTab(antes, depois, `depois de ${estimulo.nome} (estímulo do navegador)`),
        );
        feitos.push(
          `${estimulo.nome} [${dito}] → ${String(depois.alcancadosIds.length)}/${String(depois.universo.length)} no Tab`,
        );
        antes = depois;
      }
      emCurso = null;
    } catch (erro) {
      if (problemas.length === 0) throw erro;
      interrompido = `o roteiro parou em "${emCurso ?? "?"}": ${
        erro instanceof Error ? erro.message.split("\n")[0] : String(erro)
      } — consequência do que já está anotado acima, não outra causa`;
    }
    const vigia = await lerVigiaDoFoco(sentinela.pagina);
    problemas.push(...oQueOVigiaViuNoUso(vigia));
    if (interrompido !== null) problemas.push(interrompido);
    if (feitos.length < PISO_DE_INTERACOES && interrompido === null) {
      problemas.push(
        `só ${String(feitos.length)} interação(ões) exercidas (piso escrito à mão: ${String(PISO_DE_INTERACOES)}) — roteiro encolhido é alcance encolhido`,
      );
    }
    /*
     * [MÉDIO] O FECHO DO INVENTÁRIO, nos dois sentidos.
     *
     * Só corre com o roteiro INTEIRO de pé. Com o roteiro interrompido, os
     * passos que não rodaram não exerceram nada e os estados que eles abririam
     * nunca apareceram no inventário — o fecho acusaria dois defeitos onde há
     * um, e o segundo seria consequência do primeiro. O que já está anotado
     * acima é o veredito; este parágrafo diz, em uma linha, que o fecho não
     * foi conferido nesta corrida.
     */
    const fora = new Map(ENTRADAS_DECLARADAS_FORA.map((e) => [e.chave, e.porque]));
    /*
     * [MÉDIO, rodada 18] Entrada de FORA dos nós não se cobre por declaração:
     * se cobre pelo ouvinte ter rodado. `exercidas` soma as duas metades — o
     * `cobre` escrito à mão dos nós e o contador medido dos ouvintes.
     */
    const deFora = chavesDeFora();
    for (const chave of jaRodaram()) exercidas.add(chave);
    let fecho = "fecho do inventário NÃO conferido: o roteiro parou antes do fim";
    if (interrompido === null) {
      const naoExercidas = [...oferecidas.keys()].filter(
        (c) => !exercidas.has(c) && !fora.has(c),
      );
      if (naoExercidas.length > 0) {
        problemas.push(
          `o produto oferece ${String(naoExercidas.length)} interação(ões) nesta rota que o roteiro não exerce e que ninguém declarou fora: ${naoExercidas
            .slice(0, 6)
            .map((c) => `\`${c}\` (apareceu ${oferecidas.get(c)?.quando ?? "?"})`)
            .join(" · ")}`,
        );
      }
      /* Declaração morta é do `cobre` escrito à mão; o que foi MEDIDO não se
         declara, então sai da conta antes de a pergunta ser feita. */
      const declaracoesMortas = [...exercidas].filter((c) => !oferecidas.has(c) && !deFora.has(c));
      if (declaracoesMortas.length > 0) {
        problemas.push(
          `${String(declaracoesMortas.length)} passo(s) do roteiro dizem exercer interação que o produto NÃO oferece em lugar nenhum desta rota: ${declaracoesMortas
            .map((c) => `\`${c}\``)
            .join(" · ")}`,
        );
      }
      const exclusoesMortas = [...fora.keys()].filter((c) => !oferecidas.has(c));
      if (exclusoesMortas.length > 0) {
        problemas.push(
          `${String(exclusoesMortas.length)} entrada(s) declarada(s) fora do roteiro não existem mais no produto: ${exclusoesMortas
            .map((c) => `\`${c}\``)
            .join(" · ")} — lista que descreve produto que não existe é folclore, não decisão`,
        );
      }
      fecho = `${String(oferecidas.size)} interações lidas do produto — ${String(oferecidas.size - deFora.size)} nos nós (${String(inventarioInicial.nosComProps)} nós com props do React na carga) e ${String(deFora.size)} FORA dos nós [${descreverOuvintes(ouvintesAgora)}] —, ${String(exercidas.size)} exercidas e ${String(fora.size)} declaradas fora com motivo`;
    }
    sentinela.ultimaVarredura = antes;
    conferir(
      `Y · o teclado alcança DEPOIS de a página ser usada (${sentinela.nome})`,
      problemas.length === 0,
      problemas.length === 0
        ? `${String(feitos.length)} interações de verdade, cada uma com o efeito provado e o Tab remedido logo depois — ${feitos.join(" | ")} · ${fecho} · vigia: 0 escrita(s) que tirem controle do teclado durante o uso`
        : problemas.slice(0, 5).join(" · "),
    );
  });

  /*
   * ═════════════════════════════════════════════════════════════════════════
   * Z · [ALTO, rodada 21] A VOLTA EM CADA DURAÇÃO — "saí para almoçar e voltei"
   *
   * A Y segura cada estado pela ausência inteira e volta UMA vez, no fim das
   * 52 h: é o ramo "volta longa" de quem trata aba parada. O ramo "volta
   * curta" — o operador que volta depois de 5 min, de 1 h, de uma noite —
   * nunca era exercido: a forma 4 (*mede um instante só*) no eixo "quanto
   * tempo fiquei fora antes de voltar". O coordenador passou pelos cinco
   * portões com uma aba que, voltando entre 3 min e 24 h, tirava 27 controles
   * do Tab; na volta de 52 h, nenhum.
   *
   * Aqui, para CADA estímulo com volta e para CADA duração da grade dele:
   * ida → o relógio da página anda essa duração (pelos mesmos degraus da
   * ausência que ficam abaixo dela) → volta → o Tab é varrido de novo, com as
   * mesmas duas redes da Y (o absoluto e a regressão contra a varredura de
   * antes) e o vigia no fim. A duração fora é MEDIDA no relógio da página, de
   * ponta a ponta, e cada volta é contada na X — nunca declarada.
   *
   * A grade é `GRADE_DAS_VOLTAS` (derivada: pontos geométricos de razão
   * `RAZAO_DA_GRADE` a partir do menor limiar lido + 1 ms acima de cada
   * limiar), inteira na aba e no foco, alternada nos outros — `gradeDoEstimulo`.
   * Uma medida por estímulo e viewport: o teto por medida continua o mesmo, e
   * quem reprova diz em que estímulo e em que duração.
   * ═════════════════════════════════════════════════════════════════════════
   */
  const comVolta = ESTIMULOS_DO_NAVEGADOR.filter((e) => typeof e.volta === "function");
  const alternados = comVolta.filter((e) => !ESTIMULOS_DE_GRADE_INTEIRA.has(e.nome));
  for (const estimulo of comVolta) {
    await medir(`Z ${sentinela.nome} · ${estimulo.nome}`, async () => {
      if (!sentinela.ok) {
        throw new PrecondicaoFalhou(
          `a sentinela de teclado ${sentinela.nome} nunca nasceu: ${sentinela.motivo}`,
          { cause: sentinela.erro },
        );
      }
      const grade = gradeDoEstimulo(estimulo, alternados.indexOf(estimulo));
      const problemas = [];
      const pagina = sentinela.pagina;
      const antes = sentinela.ultimaVarredura ?? (await varrerTeclado(pagina));
      const testemunhaAntes = await lerTestemunha(pagina);
      const voltas = [];
      let ultima = antes;
      /*
       * O relógio da página PARA durante a grade: com ele correndo junto com a
       * parede, cada volta levaria de brinde o custo da própria guarda (as
       * idas e vindas do Playwright), e a duração que o produto vê deixaria de
       * ser a da grade. Parado, ele só anda quando a guarda manda — a duração
       * fora é a pedida mais os dois quadros de `assentar`, exata.
       */
      await pagina.clock.pauseAt((await relogioDaPagina(pagina)) + 1000);
      /* A outra aba do estímulo de armazenamento é aberta uma vez só e
         reaproveitada em todas as voltas desta medida (fecha no fim dela). */
      pagina.__reaproveitarOutraAba = true;
      try {
        for (const duracao of grade) {
          const estado = {};
          const rotulo = `${estimulo.nome}, voltando depois de ${duracaoEmGente(duracao)} fora`;
          await precondicao(`${rotulo} — a ida`, async () => {
            await estimulo.ida(pagina, sentinela, estado);
          });
          let fora = 0;
          let erroDaAusencia = null;
          try {
            fora = await ausencia(pagina, duracao);
          } catch (erro) {
            erroDaAusencia = erro;
          }
          /* A volta roda mesmo se a ausência falhou — o estado não vaza. */
          await precondicao(`${rotulo} — a volta`, async () => {
            await estimulo.volta(pagina, sentinela, estado);
          });
          if (erroDaAusencia !== null) throw erroDaAusencia;
          const depois = await varrerTeclado(pagina);
          registrarUniversoDoUso(sentinela.largura, sentinela.altura, depois.universo.length);
          problemas.push(
            ...oQueFaltaAgora(depois, `depois de ${rotulo}`),
            ...oQuePerdeuOTab(antes, depois, `depois de ${rotulo}`),
          );
          voltas.push({ pedido: duracao, fora });
          ultima = depois;
        }
      } catch (erro) {
        /* O mesmo princípio da Y: o achado JÁ medido vence a precondição que
           vem depois — ela é consequência dele, não outra causa. */
        if (problemas.length === 0) throw erro;
        problemas.push(
          `a grade parou em ${String(voltas.length + 1)}ª volta: ${erro instanceof Error ? erro.message.split("\n")[0] : String(erro)} — consequência do que já está anotado`,
        );
      } finally {
        pagina.__reaproveitarOutraAba = false;
        await fecharOutraAba(pagina);
        await pagina.clock.resume().catch(() => {});
      }
      sentinela.ultimaVarredura = ultima;
      if (problemas.length > 0) {
        conferir(
          `Z · o teclado alcança depois de VOLTAR em cada duração (${sentinela.nome} · ${estimulo.nome})`,
          false,
          problemas.slice(0, 5).join(" · "),
        );
        registrarVoltasDaGrade(sentinela.largura, sentinela.altura, estimulo.nome, voltas);
        return;
      }
      /* Cada ida aconteceu — a testemunha do navegador conta, uma vez por volta. */
      const testemunhaDepois = await lerTestemunha(pagina);
      const poucos = estimulo.produz.filter(
        (tipo) => (testemunhaDepois[tipo] ?? 0) - (testemunhaAntes[tipo] ?? 0) < grade.length,
      );
      if (poucos.length > 0) {
        throw new PrecondicaoFalhou(
          `"${estimulo.nome}" deu ${String(grade.length)} voltas e a testemunha viu menos que isso de ${poucos.map((t) => `\`${t}\``).join(", ")} — a ida não aconteceu em todas`,
        );
      }
      registrarVoltasDaGrade(sentinela.largura, sentinela.altura, estimulo.nome, voltas);
      problemas.push(...oQueOVigiaViuNoUso(await lerVigiaDoFoco(pagina)));
      const medidas = voltas.map((v) => v.fora);
      conferir(
        `Z · o teclado alcança depois de VOLTAR em cada duração (${sentinela.nome} · ${estimulo.nome})`,
        problemas.length === 0,
        problemas.length === 0
          ? `${String(voltas.length)} idas e voltas, de ${duracaoEmGente(Math.min(...medidas))} a ${duracaoEmGente(Math.max(...medidas))} fora no relógio da página (${ESTIMULOS_DE_GRADE_INTEIRA.has(estimulo.nome) ? "grade inteira" : "degraus alternados"}), o Tab varrido depois de cada volta`
          : problemas.slice(0, 5).join(" · "),
      );
    });
  }
  await sentinela.contexto.close().catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════
// X · O ALCANCE DECLARADO É O ALCANCE MEDIDO
//
// A medida que impede as duas de cima de valerem para menos do que dizem.
// Três perguntas, todas sobre o medido:
//  1. todo viewport em que a guarda mediu teclado tem as TRÊS sentinelas?
//     (viewport sem sentinela de tempo = alcance de tempo zero ali; sem
//     sentinela de interação = alcance de USO zero ali — o vão do ALTO 1 da
//     rodada 16);
//  2. cada sentinela viu, no nascimento, pelo menos tantos controles quanto a
//     maior leitura que a guarda fez naquele viewport? (sentinela que enxerga
//     menos que a guarda concorda com ela por encolher junto — foi assim que a
//     peça P6 ficou verde com o dado do operador sendo apagado);
//  3. o número que o cabeçalho declara é o que a medida W realmente adianta,
//     e o roteiro de uso alcança o piso de interações declarado?
// ═══════════════════════════════════════════════════════════════════════════
await medir("X", async () => {
  const problemas = [];
  const detalhes = [];
  for (const [largura, altura] of VIEWPORTS_DO_TECLADO) {
    const chave = `${String(largura)}×${String(altura)}`;
    const minhas = SENTINELAS_DO_TECLADO.filter((s) => s.largura === largura && s.altura === altura);
    const deTempoReal = minhas.filter((s) => s.tipo === "tempo real" && s.ok).length;
    const deRelogio = minhas.filter((s) => s.tipo === "relógio de mentira" && s.ok).length;
    const deInteracao = minhas.filter((s) => s.tipo === "interação" && s.ok).length;
    if (deTempoReal < 1 || deRelogio < 1 || deInteracao < 1) {
      problemas.push(
        `${chave}: ${String(deTempoReal)} sentinela(s) de tempo real, ${String(deRelogio)} de relógio e ${String(deInteracao)} de interação (precisa de 1 de cada) — alcance zero neste viewport na dimensão que faltar`,
      );
    }
    const vistoPelaGuarda = UNIVERSO_VISTO_PELA_GUARDA.get(chave) ?? 0;
    for (const s of minhas.filter((x) => x.ok)) {
      if (s.foto.universo.length < vistoPelaGuarda) {
        problemas.push(
          `${s.nome}: a sentinela viu ${String(s.foto.universo.length)} controles e a guarda viu ${String(vistoPelaGuarda)} no mesmo viewport — o alcance de tempo não cobre o que a guarda mede`,
        );
      }
    }
    detalhes.push(
      `${chave}: ${String(vistoPelaGuarda)} controles na carga e até ${String(UNIVERSO_DEPOIS_DO_USO.get(chave) ?? 0)} depois de uma interação, ${String(deTempoReal)}+${String(deRelogio)}+${String(deInteracao)} sentinelas (tempo real + relógio + interação)`,
    );
  }
  const viewportsMedidos = [...UNIVERSO_VISTO_PELA_GUARDA.keys()];
  const semSentinela = viewportsMedidos.filter(
    (chave) => !VIEWPORTS_DO_TECLADO.some(([l, a]) => `${String(l)}×${String(a)}` === chave),
  );
  if (semSentinela.length > 0) {
    problemas.push(
      `a guarda mediu teclado em ${semSentinela.join(", ")} e não há sentinela nesses viewports`,
    );
  }
  if (ADIANTAMENTO_DO_RELOGIO_MS !== 1800000) {
    problemas.push(
      `o cabeçalho declara 30 min de alcance agendado e a medida W adianta ${String(Math.round(ADIANTAMENTO_DO_RELOGIO_MS / 60000))} min`,
    );
  }
  /*
   * [ALTO 1] O roteiro de uso é o alcance de INTERAÇÃO declarado. Se ele
   * encolher abaixo do piso escrito à mão, a medida Y passa a cobrir menos do
   * que este cabeçalho promete — e isso se descobre aqui, não no próximo
   * coordenador.
   */
  if (ROTEIRO_DE_USO.length < PISO_DE_INTERACOES) {
    problemas.push(
      `o roteiro de uso tem ${String(ROTEIRO_DE_USO.length)} interação(ões) e o piso declarado é ${String(PISO_DE_INTERACOES)}`,
    );
  }
  /*
   * [MÉDIO] E o INVENTÁRIO lido do produto é o universo daquele fecho. Ele é
   * contado AQUI, fora da medida Y que protege: leitura quebrada devolve zero
   * entrada, o fecho da Y fica satisfeito por ausência (a forma 2) e só este
   * piso escrito à mão vê a diferença entre "nada a cobrir" e "não consegui
   * ler o produto".
   */
  if (ENTRADAS_DO_PRODUTO.size < PISO_DE_ENTRADAS) {
    problemas.push(
      `a leitura do produto achou ${String(ENTRADAS_DO_PRODUTO.size)} interação(ões) nesta rota e o piso escrito à mão é ${String(PISO_DE_ENTRADAS)} — inventário encolhido faz o fecho da medida Y aprovar por ausência`,
    );
  }
  /*
   * A entrada que nomeia o achado desta rodada. Ela não vem de uma lista: vem
   * de o produto observar a própria largura. Se um dia ele deixar de fazer
   * isso, esta linha reprova e alguém decide de novo — em vez de o passo de
   * redimensionar virar decoração silenciosa.
   */
  if (OUVINTES_DO_PRODUTO.size < PISO_DE_OUVINTES_DO_PRODUTO) {
    problemas.push(
      `a leitura do produto achou ${String(OUVINTES_DO_PRODUTO.size)} ouvinte(s) FORA dos nós (piso escrito à mão: ${String(PISO_DE_OUVINTES_DO_PRODUTO)}) — ou a página parou de escutar a janela e o documento, ou a instrumentação não instalou, ou o critério da pilha passou a jogar o produto no balde do framework; nos três casos os passos derivados deixaram de existir em silêncio`,
    );
  }
  /*
   * E a FAMÍLIA DA LARGURA continua sendo cobrada por nome — não por uma
   * lista de eventos, e sim pelo que ela é: ouvinte de `resize`,
   * `ResizeObserver` ou `matchMedia`. Se um dia o componente deixar de olhar
   * a largura, esta linha reprova e alguém decide de novo, em vez de os dois
   * passos de redimensionar virarem decoração silenciosa.
   */
  if (![...OUVINTES_DO_PRODUTO].some((c) => ehDaFamiliaDaLargura(c))) {
    problemas.push(
      `nenhum dos ${String(OUVINTES_DO_PRODUTO.size)} ouvinte(s) lidos do produto é da família da LARGURA (\`resize\`, \`ResizeObserver\`, \`matchMedia\`) — os passos de redimensionar deixaram de provar o que dizem`,
    );
  }
  /*
   * [ALTO 1] E a cobertura do USO não pode ser menor que a do instante: em
   * cada viewport, a maior varredura feita DEPOIS de uma interação tem de
   * alcançar pelo menos o que a guarda viu na carga. Sem isto, uma medida Y
   * que rodasse numa tela encolhida ficaria verde concordando consigo mesma —
   * a forma 1 do vício.
   */
  for (const [largura, altura] of VIEWPORTS_DO_TECLADO) {
    const chave = `${String(largura)}×${String(altura)}`;
    const noUso = UNIVERSO_DEPOIS_DO_USO.get(chave);
    const naCarga = UNIVERSO_VISTO_PELA_GUARDA.get(chave) ?? 0;
    if (noUso === undefined) {
      problemas.push(`${chave}: nenhuma varredura de teclado DEPOIS de uma interação — alcance de uso zero aqui`);
    } else if (noUso < naCarga) {
      problemas.push(
        `${chave}: a sentinela de interação varreu no máximo ${String(noUso)} controles e a guarda viu ${String(naCarga)} na carga — o alcance de uso não cobre o que a guarda mede`,
      );
    }
  }
  /*
   * [MÉDIO, rodada 19] OS ESTÍMULOS INCONDICIONAIS são o alcance de USO que
   * não depende do produto. Três perguntas, contadas AQUI, fora da medida Y:
   *  1. a lista escrita à mão alcança o piso escrito à mão?
   *  2. toda FONTE declarada tem estímulo, e todo estímulo tem fonte declarada?
   *     (fonte sem estímulo é porta do navegador que ninguém abre; estímulo sem
   *     fonte é universo que cresceu por convenção)
   *  3. em CADA viewport, a sentinela de uso executou TODOS os estímulos?
   *     (a medida Y interrompida ou encolhida executa menos, e só daqui se vê
   *     a diferença entre "nada quebrou" e "nada foi tentado" — a forma 2)
   */
  if (ESTIMULOS_DO_NAVEGADOR.length < PISO_DE_ESTIMULOS) {
    problemas.push(
      `a lista do que o navegador faz a uma página tem ${String(ESTIMULOS_DO_NAVEGADOR.length)} estímulo(s) e o piso escrito à mão é ${String(PISO_DE_ESTIMULOS)}`,
    );
  }
  if (FONTES_DO_NAVEGADOR.length < PISO_DE_FONTES) {
    problemas.push(
      `a lista de fontes tem ${String(FONTES_DO_NAVEGADOR.length)} e o piso escrito à mão é ${String(PISO_DE_FONTES)} — uma porta do navegador sumiu do universo`,
    );
  }
  const fontesSemEstimulo = FONTES_DO_NAVEGADOR.filter(
    (f) => !ESTIMULOS_DO_NAVEGADOR.some((e) => e.fonte === f.fonte),
  ).map((f) => f.fonte);
  if (fontesSemEstimulo.length > 0) {
    problemas.push(`fonte(s) do navegador sem estímulo nenhum: ${fontesSemEstimulo.join(" · ")}`);
  }
  const estimulosSemFonte = ESTIMULOS_DO_NAVEGADOR.filter(
    (e) => !FONTES_DO_NAVEGADOR.some((f) => f.fonte === e.fonte),
  ).map((e) => e.nome);
  if (estimulosSemFonte.length > 0) {
    problemas.push(`estímulo(s) sem fonte declarada: ${estimulosSemFonte.join(" · ")}`);
  }
  for (const [largura, altura] of VIEWPORTS_DO_TECLADO) {
    const chave = `${String(largura)}×${String(altura)}`;
    const feitos = ESTIMULOS_EXECUTADOS.get(chave) ?? new Map();
    const faltam = ESTIMULOS_DO_NAVEGADOR.filter((e) => !feitos.has(e.nome)).map((e) => e.nome);
    if (feitos.size < PISO_DE_ESTIMULOS || faltam.length > 0) {
      problemas.push(
        `${chave}: a sentinela de uso executou ${String(feitos.size)} estímulo(s) do navegador (piso ${String(PISO_DE_ESTIMULOS)})${faltam.length > 0 ? ` — não executou: ${faltam.join(" · ")}` : ""}`,
      );
    }
    /*
     * [ALTO, rodada 20] E cada estímulo executado SEGUROU a ausência — medido
     * no relógio da PÁGINA, fora e depois da volta. Uma ausência que encolhe
     * (degrau quebrado, relógio que não andou, página sem relógio controlado)
     * aparece aqui com o número, e não como um verde de quem não esperou.
     */
    const curtos = [...feitos]
      .filter(([, a]) => a.fora < DURACAO_DA_AUSENCIA_MS || a.depoisDaVolta < DURACAO_DA_AUSENCIA_MS)
      .map(([n, a]) => `${n} (${duracaoEmGente(a.fora)} fora, ${duracaoEmGente(a.depoisDaVolta)} depois)`);
    const doRoteiro = AUSENCIAS_DO_ROTEIRO.get(chave) ?? new Map();
    const passosCurtos = ROTEIRO_DE_USO.filter(
      (p) => !doRoteiro.has(p.nome) || doRoteiro.get(p.nome) < DURACAO_DA_AUSENCIA_MS,
    ).map((p) => `${p.nome} (${doRoteiro.has(p.nome) ? duracaoEmGente(doRoteiro.get(p.nome)) : "não segurou"})`);
    if (passosCurtos.length > 0) {
      problemas.push(
        `${chave}: ${String(passosCurtos.length)} passo(s) do roteiro não seguraram o estado pela ausência derivada de ${duracaoEmGente(DURACAO_DA_AUSENCIA_MS)}: ${passosCurtos.slice(0, 4).join(" · ")}`,
      );
    }
    if (curtos.length > 0) {
      problemas.push(
        `${chave}: ${String(curtos.length)} estímulo(s) seguraram MENOS que a ausência derivada de ${duracaoEmGente(DURACAO_DA_AUSENCIA_MS)} no relógio da página: ${curtos.slice(0, 4).join(" · ")}`,
      );
    }
  }
  /*
   * [ALTO, rodada 20] A DURAÇÃO DERIVADA, conferida AQUI, fora da Y que ela
   * protege. Cinco perguntas:
   *  1. a leitura do fonte achou limiares — no todo e no arquivo da rota —
   *     acima dos pisos escritos à mão? (leitor quebrado = ausência de zero)
   *  2. a ausência está ACIMA do maior limiar conhecido?
   *  3. a ausência atravessa uma noite inteira (piso escrito à mão, em horas)?
   *  4. os degraus passam acima de CADA limiar conhecido?
   *  5. todo estímulo tem volta, ou diz por que não tem?
   */
  if (LIMIARES_DE_TEMPO.length < PISO_DE_LIMIARES) {
    problemas.push(
      `a leitura do fonte achou ${String(LIMIARES_DE_TEMPO.length)} limiar(es) de tempo e o piso escrito à mão é ${String(PISO_DE_LIMIARES)} — leitor encolhido encolhe a ausência junto`,
    );
  }
  const daRota = LIMIARES_DE_TEMPO.filter((l) => l.onde.startsWith(`${ARQUIVO_DA_ROTA}:`));
  if (daRota.length < PISO_DE_LIMIARES_DA_ROTA) {
    problemas.push(
      `a leitura achou ${String(daRota.length)} limiar(es) em ${ARQUIVO_DA_ROTA} (piso escrito à mão: ${String(PISO_DE_LIMIARES_DA_ROTA)}) — a rota medida ficou fora da conta`,
    );
  }
  if (!(DURACAO_DA_AUSENCIA_MS > MAIOR_LIMIAR.ms)) {
    problemas.push(
      `a ausência (${String(DURACAO_DA_AUSENCIA_MS)} ms) não está acima do maior limiar conhecido (${String(MAIOR_LIMIAR.ms)} ms, ${MAIOR_LIMIAR.onde})`,
    );
  }
  if (DURACAO_DA_AUSENCIA_MS < PISO_DA_AUSENCIA_EM_HORAS * 3600000) {
    problemas.push(
      `a ausência derivada é de ${duracaoEmGente(DURACAO_DA_AUSENCIA_MS)} e o piso escrito à mão é ${String(PISO_DA_AUSENCIA_EM_HORAS)} h — ela não atravessa uma noite inteira`,
    );
  }
  const semDegrau = LIMIARES_DE_TEMPO.filter((l) => !DEGRAUS_DA_AUSENCIA.some((d) => d > l.ms));
  if (semDegrau.length > 0 || DEGRAUS_DA_AUSENCIA.at(-1) !== DURACAO_DA_AUSENCIA_MS) {
    problemas.push(
      `os degraus da ausência não passam acima de ${String(semDegrau.length)} limiar(es) conhecido(s): ${semDegrau.slice(0, 4).map((l) => `${String(l.ms)} ms (${l.onde})`).join(" · ")}`,
    );
  }
  const semVoltaNemMotivo = ESTIMULOS_DO_NAVEGADOR.filter(
    (e) => typeof e.volta !== "function" && (typeof e.semVolta !== "string" || e.semVolta.trim() === ""),
  ).map((e) => e.nome);
  if (semVoltaNemMotivo.length > 0) {
    problemas.push(`estímulo(s) sem volta e sem dizer por quê: ${semVoltaNemMotivo.join(" · ")}`);
  }
  /*
   * [ALTO, rodada 21] A VOLTA EM CADA DURAÇÃO — conferida sobre as voltas
   * MEDIDAS na Z, nunca sobre a grade declarada:
   *  5. todo estímulo com volta voltou na Z, em todo viewport? (forma 2)
   *  6. aba e foco voltaram em pelo menos `PISO_DE_VOLTAS_DA_GRADE_INTEIRA`
   *     durações (piso escrito à mão)? (formas 1 e 3: grade encolhida)
   *  7. entre duas voltas MEDIDAS consecutivas a duração fora no máximo
   *     multiplica pela razão prometida (r na grade inteira, r² na alternada),
   *     a primeira volta está a no máximo uma razão do menor limiar e a
   *     última a no máximo uma razão da volta de 52 h da Y? (forma 4: é isto
   *     que faz toda janela com b/a acima da razão conter uma volta)
   *  8. o relógio da página andou, em cada volta, pelo menos o que foi pedido?
   */
  const detalhesDaGrade = [];
  if (!(RAZAO_DA_GRADE > 1) || PONTOS_GEOMETRICOS.length === 0) {
    problemas.push(
      `a grade de voltas é vazia (razão ${String(RAZAO_DA_GRADE)}, ${String(PONTOS_GEOMETRICOS.length)} ponto(s) geométrico(s), menor limiar ${String(MENOR_LIMIAR.ms)} ms)`,
    );
  }
  const comVoltaNaX = ESTIMULOS_DO_NAVEGADOR.filter((e) => typeof e.volta === "function");
  for (const [largura, altura] of VIEWPORTS_DO_TECLADO) {
    const chave = `${String(largura)}×${String(altura)}`;
    const doViewport = VOLTAS_DA_GRADE.get(chave) ?? new Map();
    const semZ = comVoltaNaX.filter((e) => !doViewport.has(e.nome)).map((e) => e.nome);
    if (semZ.length > 0) {
      problemas.push(
        `${chave}: ${String(semZ.length)} estímulo(s) com volta não voltaram em duração nenhuma da grade (medida Z): ${semZ.slice(0, 4).join(" · ")}`,
      );
    }
    let totalDeVoltas = 0;
    for (const [nome, voltas] of doViewport) {
      totalDeVoltas += voltas.length;
      const inteira = ESTIMULOS_DE_GRADE_INTEIRA.has(nome);
      const razao = inteira ? RAZAO_DA_GRADE : RAZAO_DA_GRADE ** 2;
      const medidas = voltas.map((v) => v.fora).sort((a, b) => a - b);
      if (inteira && medidas.length < PISO_DE_VOLTAS_DA_GRADE_INTEIRA) {
        problemas.push(
          `${chave} · ${nome}: voltou em ${String(medidas.length)} duração(ões) e o piso escrito à mão é ${String(PISO_DE_VOLTAS_DA_GRADE_INTEIRA)}`,
        );
      }
      const curtas = voltas.filter((v) => !(v.fora >= v.pedido));
      if (curtas.length > 0) {
        problemas.push(
          `${chave} · ${nome}: ${String(curtas.length)} volta(s) em que o relógio da página andou MENOS que o pedido (${curtas.slice(0, 3).map((v) => `${String(v.fora)} < ${String(v.pedido)} ms`).join(" · ")})`,
        );
      }
      const buracos = [];
      /* A primeira volta: a no máximo uma razão do menor limiar, mais os dois
         quadros de `assentar` que toda volta leva (o relógio parado da Z faz
         desse o único acréscimo). */
      if (medidas.length === 0 || medidas[0] > MENOR_LIMIAR.ms * razao + DOIS_QUADROS_MS) {
        buracos.push(`antes da primeira volta (${medidas.length === 0 ? "nenhuma" : duracaoEmGente(medidas[0])})`);
      }
      for (let k = 1; k < medidas.length; k += 1) {
        if (medidas[k] > medidas[k - 1] * razao) {
          buracos.push(`entre ${duracaoEmGente(medidas[k - 1])} e ${duracaoEmGente(medidas[k])}`);
        }
      }
      if (medidas.length > 0 && medidas.at(-1) * razao < DURACAO_DA_AUSENCIA_MS) {
        buracos.push(`entre a última volta (${duracaoEmGente(medidas.at(-1))}) e a de ${duracaoEmGente(DURACAO_DA_AUSENCIA_MS)}`);
      }
      if (buracos.length > 0) {
        problemas.push(
          `${chave} · ${nome}: a grade MEDIDA tem ${String(buracos.length)} vão(s) maior(es) que a razão ${String(razao)} — uma janela de volta cabe ali sem volta nenhuma: ${buracos.slice(0, 3).join(" · ")}`,
        );
      }
    }
    detalhesDaGrade.push(`${chave}: ${String(totalDeVoltas)} voltas em ${String(doViewport.size)} estímulos`);
  }
  conferir(
    "X · o alcance de tempo declarado cobre tudo o que a guarda mede no teclado",
    problemas.length === 0,
    problemas.length === 0
      ? `${String(VIEWPORTS_DO_TECLADO.length)} viewport(s), ${String(SENTINELAS_DO_TECLADO.length)} sentinelas — ${detalhes.join(" | ")} · alcance declarado: toda a vida real da corrida (medida V) + ${String(Math.round(ADIANTAMENTO_DO_RELOGIO_MS / 60000))} min agendados, duas vezes (medida W) + ${String(ROTEIRO_DE_USO.length)} interações escritas à mão e ${String(ESTIMULOS_DO_NAVEGADOR.length)} estímulos INCONDICIONAIS do navegador (piso ${String(PISO_DE_ESTIMULOS)}), de ${String(FONTES_DO_NAVEGADOR.length)} fontes (piso ${String(PISO_DE_FONTES)}), executados em todos os viewports — ${[...ESTIMULOS_EXECUTADOS].map(([v, n]) => `${v}: ${String(n.size)}`).join(", ")} —, cada um com o estado segurado por ${duracaoEmGente(DURACAO_DA_AUSENCIA_MS)} no relógio da página, mais ${duracaoEmGente(DURACAO_DA_AUSENCIA_MS)} depois da volta, e o Tab remedido depois (medida Y) · a ausência vem do fonte: ${String(LIMIARES_DE_TEMPO.length)} limiares lidos (piso ${String(PISO_DE_LIMIARES)}), ${String(daRota.length)} da rota (piso ${String(PISO_DE_LIMIARES_DA_ROTA)}), o maior ${duracaoEmGente(MAIOR_LIMIAR.ms)} em ${MAIOR_LIMIAR.onde} (${MAIOR_LIMIAR.como}), ausência = o dobro, em ${String(DEGRAUS_DA_AUSENCIA.length)} degraus (piso de ${String(PISO_DA_AUSENCIA_EM_HORAS)} h) · a VOLTA em cada duração (medida Z): ${detalhesDaGrade.join(", ")} — grade de ${String(GRADE_DAS_VOLTAS.length)} durações na aba e no foco (${String(PONTOS_GEOMETRICOS.length)} geométricas de razão ${String(RAZAO_DA_GRADE)} a partir de ${duracaoEmGente(MENOR_LIMIAR.ms)}, em ${MENOR_LIMIAR.onde}, + os degraus 1 ms acima de cada limiar; piso ${String(PISO_DE_VOLTAS_DA_GRADE_INTEIRA)}), alternada nos outros (razão ${String(RAZAO_DA_GRADE ** 2)}); fica FORA a janela de volta mais estreita que a razão, a que acaba antes de ${duracaoEmGente(MENOR_LIMIAR.ms)} e a que começa depois de ${duracaoEmGente(DURACAO_DA_AUSENCIA_MS)}; atrasos e constantes de tempo que não são número escrito, fora da conta: ${ATRASOS_NAO_RESOLVIDOS.length === 0 ? "nenhum" : ATRASOS_NAO_RESOLVIDOS.join(" · ")} · inventário lido do produto: ${String(ENTRADAS_DO_PRODUTO.size)} interações (piso ${String(PISO_DE_ENTRADAS)}), das quais ${String(OUVINTES_DO_PRODUTO.size)} FORA dos nós (piso ${String(PISO_DE_OUVINTES_DO_PRODUTO)}) — ${[...OUVINTES_DO_PRODUTO].join(" · ")} —, ${String(ENTRADAS_DECLARADAS_FORA.length)} declaradas fora com motivo: ${ENTRADAS_DECLARADAS_FORA.map((e) => e.chave).join(" · ")}`
      : problemas.join(" · "),
  );
});

await navegador.close();
encerrarServidor();

console.log("%s", medidas.join("\n"));
/*
 * [MÉDIO, rodada 20] O VEREDITO EM DOIS CÓDIGOS. Produto errado → 1, com o
 * nome de cada medida. Não consegui medir → 2, e só quando nenhuma medida
 * reprovou o produto.
 */
if (falhas.length > 0) {
  console.error("%s", `\n${String(falhas.length)} medida(s) fora da régua: ${falhas.join(" | ")}`);
  if (impedimentos.length > 0) {
    console.error("%s", `e ${String(impedimentos.length)} que não conseguiram medir: ${impedimentos.join(" | ")}`);
  }
  process.exit(1);
}
if (impedimentos.length > 0) {
  console.error(
    "%s",
    `\n${String(impedimentos.length)} medida(s) NÃO conseguiram medir (código 2 — não é verde, e não é o produto reprovado): ${impedimentos.join(" | ")}`,
  );
  process.exit(2);
}
console.log("%s", `\n${String(medidas.length)} medidas no Chromium, todas dentro da régua.`);
