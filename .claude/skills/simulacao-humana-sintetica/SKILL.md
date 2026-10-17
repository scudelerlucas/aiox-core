---
name: simulacao-humana-sintetica
description: "!shs [alvo] · alias !simular — Simulação Humana Sintética: antes de pedir ao Lucas que confira, teste, abra ou gere algo 'e avise', a sessão vira o humano e faz a checagem no lugar dele — persona (ele no painel, o visitante, o lead), caminho real (HTTP, navegador sem tela, rota, banco, script — o banco, só leitura pelo caminho da persona; caminho que grava em banco é fronteira) e o medido numa seção `🧪 Checagem sintética`. Mesmas travas do humano: nada irreversível (apagar o próprio dado de teste não conta); dinheiro só até US$ 0,50 por checagem e US$ 2,00 por dia em cada chat; nada na Meta, a pessoa de fora, publicado ou em conta de cliente; dado de teste marcado `shs` e recolhido. Só sobra pedido na fronteira dele (credencial/2FA, aprovação exigida por regra, juízo humano) ou quando o ambiente não alcança — um passo só, com o porquê. Ativar SEMPRE que a resposta for pedir checagem ao operador, em qualquer repositório e conta, e em !shs, !simular, 'simula o humano', 'checa antes de me pedir', 'testa você', 'simulação humana sintética'. Não é !mirofish (que prevê reação de público)."
---

# !SHS — Simulação Humana Sintética (ordem do operador, 13/10/2026)

> Nasceu no PR #1664 do hub: a sessão aplicou a migração, confirmou as funções no banco, e terminou com *"gere um roteiro
> em uma das casas e me avise se der 503"*. O Lucas: *"Sempre que for me pedir para checar algo, vc já checa antes e me
> tira esse trabalho"* — e *"para todos os repositórios e para todas as contas"*. A sessão tinha a chave do banco, a URL
> de produção e a rota; o que faltava era o hábito. Esta skill é o hábito, com mecanismo. Norma curta:
> `.claude/rules/simulacao-humana-sintetica.md` (hub).

## 1. O que é
Um humano sintético é **a sessão fazendo a checagem que ela ia pedir ao Lucas**, pelo mesmo caminho que ele usaria, e
mostrando a prova. Não é opinião sobre o código ("deve funcionar"), não é teste unitário (que já roda no CI), e não é
população sintética (`!mirofish`, que prevê reação de público). É QA de ponta a ponta, feita por quem já está com as
ferramentas na mão, antes de gastar um minuto do operador.

## 2. Quando dispara
**Automático** — toda vez que a resposta ia conter um pedido de checagem ao Lucas: *confira se*, *teste e me avise*,
*veja se abriu*, *gere um e me diga*, *pronto quando você…*, *se der erro me avise*. No hub, o hook de parada
`.claude/hooks/shs-check.sh` barra a resposta sem a seção `🧪` nem `fronteira:`; fora do hub vale a leitura do item 8 do
`kernel-inicio` e do bloco do `AGENTS.md`.
**Explícito** — `!shs <alvo>` (ou `!simular <alvo>`): roda a checagem sob demanda sobre uma URL, rota, fluxo ou PR. No CLI de
terminal, onde `!` no começo da linha abre o shell, use `/simulacao-humana-sintetica <alvo>` ou ponha o `!shs` depois de
outra palavra (`rode !shs na prévia`).

## 3. Protocolo (6 passos — pular um é "eu acho")
1. **Alvo e persona.** Em 1 linha: *o que* se quer saber (a rota responde? o botão gera? a linha gravou?) e *quem*
   faria isso (Lucas no painel da Casa X · visitante anônimo da página · lead terminando o quiz · membro logado ·
   Codex lendo o AGENTS.md). A persona decide o caminho e a credencial: visitante usa o que a página pública usa; o
   painel usa a chave que o próprio painel usa no navegador (nunca `service_role` nem chave de servidor: ela pula
   login e RLS, e a checagem passaria com o caminho real quebrado); nunca credencial que o humano não teria. Persona
   com erro classe A nos últimos 30 dias → pedir o "sim" do Lucas antes de rodar. A lista é `docs/ops/SHS-QUARENTENA.md`
   (estado vigente, não histórico), lida na `main` do hub no GitHub na hora — clone local pode estar velho —, mais os
   PRs do hub com `SHS-QUARENTENA` no título atualizados nos últimos 30 dias (busca por `updated:`, não por `created:`:
   linha nova num PR antigo atualiza o PR), de qualquer estado (aberto, mergeado ou fechado sem merge), cuja linha já
   vale antes do merge e não some se o PR fechar; sem como fazer essas duas leituras, pedir o
   "sim" também.
2. **Caminho real, na camada mais externa que alcança.** Os passos 3 e 4 valem antes deste: travas, teto, isolamento e
   recolhimento se conferem antes do primeiro clique ou requisição, nunca depois. Antes de qualquer caminho — navegador
   ou HTTP, prévia ou produção —, ler no código que está no ar — o do commit da prévia ou da produção testada (o MCP da
   Vercel dá o commit do deploy), não o do clone, que pode estar noutra branch — se a página, o middleware ou a rota
   manda evento pelo próprio servidor (API de Conversões da Meta, analytics no backend) — e se o que a rota faz no
   banco, lido no código e nas migrações, grava ou avisa alguém (o banco, logo abaixo) —, que nenhum corte no
   navegador alcança (sem como saber o commit no ar, fronteira): se manda, a checagem só roda numa prévia
   comprovadamente sem essas
   credenciais (as variáveis de ambiente dela não têm o token da API de Conversões, o do analytics nem o endereço do
   destino, e o código lido não traz chave, pixel ou endereço escrito nele — destino que
   aceita evento sem chave, ou com a chave no código ou na URL, manda do mesmo jeito, e aí é fronteira); sem essa prova,
   é fronteira.

   **O banco, pela decisão 1-A do Lucas (16/10/2026).** Em produção, a checagem só chega ao banco pelo caminho da
   persona — a página, a rota da aplicação, ou a API pública do Supabase com a chave que a persona tem (a pública) — e só para ler: no navegador, o `PASSA` de produção leva só GET e
   HEAD, e no HTTP o `EXTRA` também; a página ou a rota que grava ao abrir, lida no código e nas migrações (contador
   de visita, log de acesso, gatilho que chama fora), é fronteira. Numa checagem, o banco de produção não recebe SQL
   da sessão: nem pelo MCP do Supabase (`execute_sql`), nem pela chave de serviço, nem para gravar, desfazer uma
   transação ou tirar evidência por consulta; do MCP, em produção, vale só o que lê a plataforma sem rodar SQL escrito
   pela sessão — a lista de migrações aplicadas, o log por campos fixos (em (b), abaixo), os avisos de segurança.
   Escrever em produção também sai, pela rota da persona inclusive, porque recolher o dado de teste pediria apagar
   direto no banco; o login de teste também grava (a sessão, o registro de acesso), e por isso a checagem só lê o que é público.
   Fora da checagem — publicar o custo, uma migração que o Lucas aprovou — cada trabalho segue a regra dele.

   Por quê: o banco roda código que ninguém chama pelo nome — gatilho, política, índice, cascata, valor padrão,
   gatilho de conexão — e manda para fora sem função nenhuma (tabela externa, publicação, fila de replicação). Das
   rodadas 41 a 48, um censo do catálogo tentou provar, antes de cada escrita, transação desfeita ou leitura direta em
   produção, que nada disso mandava algo para fora, ficava depois do `rollback` ou punha o valor no log; cada rodada
   achou um caminho novo (47, ~67, ~40, 38 e 48 achados nas rodadas 44 a 48, e 23 dos 46 da 49 ainda sobre o censo),
   porque a lista do que é perigoso no PostgreSQL não fecha. A leitura pelo caminho da persona faz o que qualquer
   visitante faz e não precisa dele. O censo da rodada 48 fica no commit `872b905c5` do hub; a história, no histórico
   da regra.

   **Nenhuma checagem grava em banco** (decisão 2-A do Lucas, 17/10/2026): nem em produção, nem num Postgres criado
   nesta sessão, nem numa branch do Supabase, nem pela prévia da Vercel que aponta para um banco da casa; consulta,
   escrita e transação desfeita escritas pela sessão também não. O caminho que grava (o quiz em `quiz_leituras`, um
   cadastro, o login de teste) é fronteira: a sessão vai até a borda — lê no código e nas migrações o que ele grava e
   quem avisa, roda os testes do repositório, confere em produção, pelo caminho da persona, o que é público — e o
   pedido ao Lucas sai como um passo só, com o porquê. Por quê: depois do censo (rodadas 41 a 48), a prévia do banco
   das rodadas 49 e 50 — um Postgres sem rede, no espaço de rede próprio — ainda via o disco, os processos e os
   sockets de arquivo da máquina (achado P1 do Codex na rodada 51: `copy … to program` e `dblink` por socket local
   alcançam o que roda como o mesmo usuário), e o teste de uma prévia fechada foi barrado pelo classificador de
   segurança da sessão. A receita da rodada 50 fica no commit `9d138454f` do hub; a história, no histórico da regra.

   **Só página da casa** (decisão 4-A e 4-C do Lucas, 17/10/2026): os cortes do bloco abaixo rodam dentro da página, e
   uma página feita para atacar a ferramenta os desfaz — ela reescreve o `frame.evaluate` trocando o `window.eval` e
   chama a ligação do Playwright direto (rodada 50, medido: um PUT com credencial e `Allow-Origin: *` passou pelo
   bloco, e o navegador puro o barrou). O que o bloco guarda é a página da casa deixando escapar pixel, analytics ou
   escrita por descuido, não uma página adversária; página de terceiro, ou de origem que a sessão não sabe de quem é,
   não abre no navegador da checagem: fronteira.

   Ordem de preferência: (a) navegador sem tela sobre a URL (Playwright 1.48 ou mais novo, com o navegador
   que o ambiente já tem: na nuvem do Claude Code, `executablePath: '/opt/pw-browsers/chromium'`; fora dela, o que o
   próprio Playwright encontra — o bloco abaixo recebe o `browser` já aberto, `const browser = await chromium.launch({
   executablePath })`, e quem o abriu o fecha num `finally`, `await browser.close()`, e antes do `require('playwright')`
   recusa as variáveis que o Playwright lê na importação e o Chromium no `launch`, com as duas linhas que o bloco também
   tem, porque para elas o bloco chega tarde: ``for (const k of ['NODE_DEBUG', 'DEBUG', 'PWDEBUG', 'PWDEBUGIMPL',
   'SELENIUM_REMOTE_URL', 'PW_TEST_CONNECT_WS_ENDPOINT', 'SSLKEYLOGFILE']) if (process.env[k]) throw new Error(`${k}:
   desligue antes do require do Playwright`);`` — o `NODE_DEBUG=child_process` imprime, no `launch`, o ambiente
   inteiro: rodada 50, 325 linhas, com a URL do teste e a senha do proxy; com o `NODE_DEBUG` na linha, ela para antes
   do `require`), com a página testada vinda da
   variável `ALVO_URL`, já carregada no ambiente — link assinado ou link mágico escrito no script fica no histórico —,
   e o `SHS_AMBIENTE`, também do ambiente e sem padrão: `previa` ou `producao`, senão o bloco para; em `producao`
   (decisão 1-A), toda entrada de `PASSA` é GET ou HEAD, senão ele para antes da página, e o pedido que não é GET nem
   HEAD não sai nem estando na lista (`producao`; rodada 50: com `producao`, um POST na lista parou o bloco antes da
   página, e a entrada GET trocada por POST depois da conferência foi cortada sem chegar ao servidor; o bloco da 49
   mandou os dois; com `previa`, o POST passa como antes),
   só `https://` (o `http://` só para `127.0.0.1` e `localhost`, conferidos no host que o `URL` leu e não no texto: em
   `http://localhost:@outro.com` o host é o `outro.com`; e nada antes do `@`, no `https` também, porque em
   `https://confiavel@outro` quem recebe a chave é o `outro` — medido: os dois blocos anteriores seguiam para o host
   depois do `@`, e os novos param antes) — ela e todo endereço de `PASSA` e `ESTATICO`, porque o `route.fetch` manda o
   que passa sem a recusa do navegador a `http://` dentro de página `https://` (medido: um `PASSA` com
   `http://example.com` agora para o bloco antes da página) —, e todo erro do navegador relançado só com o passo e o
   tipo (`falhou em <passo> (<tipo>)`): o do Playwright traz a URL inteira, token incluso, e o do teste traz o texto da
   página (medido); link de uso único (link mágico, convite) se gasta na visita: só um gerado para a checagem, nunca o
   do Lucas nem o de cliente. Clique, formulário, texto na tela, print — sempre só do elemento do teste (recorte do
   `[shs]`), nunca a tela inteira, porque produção e prévia que lê banco real mostram dado de cliente, e o arquivo fora
   do repositório. Em toda checagem com navegador, prévia inclusive (que costuma carregar o mesmo pixel e o mesmo
   analytics da produção), o contexto nasce com `serviceWorkers: 'block'`, sem WebRTC, `WebTransport`, `Worker` nem
   `SharedWorker`, saindo por um proxy que é uma porta do próprio bloco, que derruba toda conexão (`node:net`, aberta e
   fechada por ele: numa porta fixa, como a `127.0.0.1:9` do bloco anterior, outro programa da máquina podia estar
   ouvindo e encaminhar; e o endereço local também passa por ela, porque o Playwright tira o atalho que o Chromium dá ao
   `localhost` (`<-loopback>`), salvo com `PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK` ligada, que o bloco
   recusa — medido sem o `route`: com ela, o `fetch` a `127.0.0.1` chegou direto ao servidor; sem ela, só ao proxy) — a
   página não fala com rede nenhuma, tudo o que passa vai pela busca, e o que o Chromium abre
   por fora do `route` bate nela (medido no netlog do Chromium: sem isso, ele abria uma conexão direta com a origem da
   página antes da primeira busca; com isso, foi ao proxy do bloco;
   o `dns-prefetch` e o `preconnect` da página não saíram nem sem o bloco; o próprio navegador, fora da página, fala
   com serviços do Google, atualização e contas, pelo proxy do ambiente, com e sem o bloco, sem nada da página) — e
   com uma lista do que pode passar, registrada antes de abrir qualquer página — o segundo bloco
   abaixo: a própria página testada; os arquivos do build, por GET (`ESTATICO`: a pasta que só serve arquivo gerado — no
   Next.js, `/_next/static/` —, cada arquivo uma vez e no máximo 300, `ESTATICO_MAX`, porque só pelo começo do
   endereço a página que pede sem parar martelava o servidor: rodada 50, com 20 pedidos do mesmo arquivo e 350
   arquivos diferentes, o navegador e o bloco da 49 mandaram os 370, e o novo mandou 300 e reprovou em `repetido`; o
   mesmo arquivo pedido duas vezes de propósito, lido no código, vai em `PASSA` com `vezes`); e cada chamada ou
   página a mais que o caminho testado faz (`PASSA`, uma entrada por
   chamada — `m`, o método, e `url`, o endereço inteiro com a query, montado do ambiente quando leva token, como o
   `ALVO`; `tipo`, no que não é `fetch`, XHR nem `EventSource` (`script`, `image`, `document`), porque o mesmo
   endereço pedido por `<img>` não é a chamada da página (medido: uma entrada de `fetch` pedida só por `<img>` contava
   como feita; agora para em `não houve`), de todo método — o formulário (`document`) e o `sendBeacon` (`ping`)
   declaram o seu, e sem `tipo` só a chamada de dados casa (medido: um POST da lista feito por `sendBeacon` contava
   como feito no bloco da rodada 41, e a tela passava; agora para em `não houve`, com `cortado: POST ping`, e o mesmo
   POST por `fetch` passa; o `sendBeacon` a outra origem segue o navegador: de texto ou formulário, sem pergunta e
   sem olhar a resposta; de outro tipo, com a pergunta antes e com credenciais — medido sem o `route`: o Chromium
   mandou o POST de texto e, no de JSON, só o `OPTIONS`; o bloco anterior reprovou o de texto em `cors` e mandou o
   POST do JSON depois da pergunta; o novo passa o de texto e para o de JSON na pergunta, como o navegador; o
   `<a ping>` (a auditoria de link: `text/ping`, com o `Ping-To` que o `sendBeacon` não põe) vai como no navegador,
   sem pergunta, com cookie e sem olhar a resposta — rodada 49: o navegador mandou o POST com o cookie e sem `OPTIONS`;
   o bloco da 48 mandou só um `OPTIONS` e cortou em `cors`; o novo mandou o POST, como ele —; e o
   `EventSource` não passa por este bloco, mesmo listado: a busca espera o fim do corpo, e o fluxo aberto não acaba — o
   anterior
   esperava o prazo inteiro; o novo corta na hora, com `fluxo` no que foi cortado, e a página que depende dele se prova
   por HTTP quando o fluxo acaba — o `curl` do bloco também espera o fim e, no fluxo sem fim, para no `MAX` com
   `curl=28` (medido) —, ou vira fronteira; o `fetch` que manda o corpo em fluxo (`ReadableStream`, com `duplex:
   'half'`) também é cortado com `fluxo`, e a cópia dele também (`request.clone()`, `new Request(r)`: medido, o bloco
   anterior mandou o POST da cópia direto ao servidor, sem pergunta; o novo corta),
   porque o corpo não chega ao `route` e o navegador pergunta antes dele a outra origem — medido: sem o `route`, o
   Chromium mandou só o `OPTIONS`; o bloco anterior mandou o POST direto, de corpo vazio; o novo não manda nada —; e a
   resposta em fluxo lida pelo `fetch` (texto que chega aos poucos, sem fim) a busca espera inteira, até o prazo da
   rota, e reprova — medido: o navegador leu os cabeçalhos e o primeiro pedaço em menos de um segundo; o bloco, com o
   prazo em 8 s, parou em `falhou em abrir a página (TimeoutError)` aos 8 s —, e essa página vai pelo mesmo caminho);
   `corpo`, quando o mesmo endereço recebe outras coisas, a condição sobre o
   campo que só o teste manda e não
   sobre um pedaço do texto; chamada que não é GET nem HEAD (rodada 50: o HEAD sem `corpo` parava o bloco da 49 em
   `escrita sem condição`; o novo o aceita, como o GET) só entra com a condição que a liga a esta checagem — o código no
   corpo, ou a sessão que nasceu do e-mail `shs+…` (sem ela, o bloco para; a que não grava, lida no código, leva `() =>
   true` com o porquê) —, lida pelo `J`, que devolve `null` em corpo que não é JSON (o `JSON.parse` direto lançou e
   imprimiu o corpo com a senha — medido —, e todo erro dentro do `route` aborta calado, `erro`); e cada entrada passa
   uma vez, GET inclusive, como a própria página: a segunda, de nova tentativa, recarga ou clique duplo, aborta
   (`repetido`; `vezes` muda o limite, para o GET que a página repete de propósito) e reprova, de todo tipo (medido: o
   script da lista pedido duas vezes passava calado; agora reprova); e a resposta de cada entrada tem de vir no código
   esperado (`status`, padrão abaixo de 400) — e a do arquivo do build também, porque a tela que veio do servidor
   aparece sem o script (medido: um `/_next/static/` que dava 404 passava com a tela certa; agora para em `GET 404
   script`) — e, na rota que responde 200 com o erro no corpo, com o corpo
   esperado (`resposta: t => J(t)?.status === 'ok'`), senão o bloco reprova no fim, mesmo com a tela certa, porque a
   tela otimista mostra o sucesso antes da resposta (medido: uma página que mostrava o `[shs]` e chamava uma rota que
   dava 500 passou no bloco anterior; no novo, para em `falhou em conferir as chamadas (POST 500 …)`; e a que mostrava o
   `[shs]` antes da resposta e recebia `{"status":"error"}` com 200 passava, e com `resposta` para em `conferir as
   chamadas (POST 200 ou a resposta …)`), e cada entrada tem de acontecer: a que não houve reprova no fim, salvo com
   `opcional: true`, e a que houve e não chegou à página também (`3xx`, `falhou`, `cors`, de qualquer tipo: medido com
   um script de outra origem, na lista, que redirecionava, o bloco anterior passou com a tela certa e o script cortado,
   e o novo parou em `3xx GET script`), porque a regressão que nem chama a rota deixaria a tela estática ou otimista
   passar (medido: com uma entrada que a página nunca chamava, o bloco anterior passou; o novo parou em `falhou em
   conferir as chamadas (não houve: POST …)`), e a que só veio depois do fim, cortada, diz isso (`não houve: POST da
   entrada 0 (só depois do fim)`, medido): a evidência apareceu antes da chamada, e o teste tem de esperar o que vem
   depois dela, e, antes de conferir, o bloco espera as chamadas que ainda estavam no ar quando o teste acabou, cada uma
   com o prazo dela, e dali em diante nada novo passa, e o que chega depois reprova (`depois`), de todo tipo — a página
   que navega depois da evidência e o script da lista pedido de novo passavam calados (medido: agora param em `depois
   GET document` e `depois GET script`), e o arquivo do build também, porque o pedaço que não roda esconderia o que
   ele faria (medido: com um `/_next/static/` pedido 100 ms depois da evidência, o bloco da rodada 41 passou calado;
   o novo parou em `depois GET script o site`; a página que carrega pedaço do build sozinha depois de pronta — o
   prefetch do Next.js — espera a rede calar antes da evidência, `await page.waitForLoadState('networkidle')`, e
   assim passou) —, salvo a do `PREVISTO` e a da lista que ainda cabe na entrada dela — o mesmo corpo, e as vezes de
   antes e de depois do fim
   somadas —, com a `FOLGA` para a que a resposta delas dispara — meio segundo, ou o maior prazo que a página espera
   para chamar de novo (debounce, nova tentativa), lido no código, mais meio segundo —, e o que chega enquanto
   o contexto fecha também reprova (`falhou em conferir o fim`) (medido: com a página repetindo o POST um segundo depois
   de mostrar o resultado, com meio segundo o bloco passou calado, e com `FOLGA = 1500` parou em `depois POST fetch o
   site`, sem a repetida chegar ao servidor; com a página chamando 5 ms depois do fim, o bloco sem a conferência do fim
   passava, e o novo parou em `conferir o fim`; com a página chamando uma segunda rota assim que a primeira respondia, o
   bloco anterior passou calado, e o novo parou em `falhou em conferir o que foi cortado (depois POST fetch …)`, sem a
   segunda chegar ao servidor em nenhum dos dois; com a página repetindo, depois do fim, o POST da lista que já tinha
   passado, ou mandando-o com outro corpo, o bloco anterior passou calado nos dois, e o novo parou em `depois POST fetch
   o site`, sem a repetida chegar ao servidor; o GET da lista com `vezes: 5`, repetido depois do fim, passou nos dois;
   com a rota dando 500 três segundos depois de a tela mostrar o `[shs]`, o bloco que não esperava passou em 0 s, e o
   que espera reprovou em 3 s; com a página consultando o servidor sem parar, a espera sem esse corte passou de 30 s sem
   terminar, e com ele terminou em 2 s); nunca prefixo nem host inteiro: `/api/quiz/` deixaria passar o
   `/api/quiz/analytics`, `/api/eventos` sem a query deixaria passar o `?modo=track`, e o host do banco que serve o dado
   também recebe o aviso de erro do site); todo o resto aborta, GET do próprio domínio inclusive — o pixel próprio em
   `/collect.gif` é um GET de imagem como o logo. O que passa, o próprio Playwright busca sem seguir redirecionamento
   (com `maxRedirects: 0`, e a resposta e o contexto dela liberados depois), e um redirecionamento (301, 302, 303, 307,
   308) aborta — o 304 da chamada que pergunta se o dado mudou passa (medido) —: o `route` só vê o primeiro endereço, e
   o redirecionamento que o navegador seguisse levaria a visita a um destino fora da lista (medido: uma rota listada que
   mandava a um pixel de fora fez o pixel receber a visita; com o 3xx abortado, não), salvo no `fetch` com `redirect:
   'manual'` (todo pedido no ar àquele endereço assim): o 3xx chega à página como veio, `opaqueredirect`, e o navegador
   não o segue (rodada 49: o navegador e o novo deram `opaqueredirect 0` sem pedir o destino, e o bloco da 48 cortava
   em `3xx`; sem `Allow-Origin`, os três dão erro de CORS; o `follow` segue abortado). Lista do que passa, e não do que
   se corta, porque a medição que ninguém listou é justamente a que escapa: o analytics que o próprio domínio recebe num
   caminho gerado a cada build, o aviso de erro que a página manda ao banco, o pixel novo. `context.route` pega abas
   novas e popups, que o `page.route` perde; o `routeWebSocket` fecha todo WebSocket (a gravação de sessão vai por ele,
   e o `route` não o vê), e o que a página abre sem estar em `PREVISTO` (pelo endereço `ws://` ou `wss://` inteiro)
   reprova no fim, como a chamada de dados (medido: o bloco anterior fechava calado o WebSocket de que a tela dependia;
   o novo para em `conferir o que foi cortado (websocket …)`), e o Playwright anterior ao 1.48 não o tem: aí o bloco
   para antes da primeira página; o WebRTC (vídeo, chamada, canal de dados), o `WebTransport`, o `Worker` e o
   `SharedWorker` saem da página antes de ela abrir, porque o tráfego deles também não passa pelo `route` (medido: com o
   `route` ligado, o WebSocket aberto por um worker e a chamada do SharedWorker chegaram ao servidor; o `WebTransport`,
   que pede servidor HTTP/3, não foi medido). O que o caminho precisa e ficou de fora quebra o teste, que é o lado
   seguro — e, como a tela otimista pode mostrar sucesso sem a chamada que faltou, todo corte reprova no fim, de todo
   tipo — a chamada de dados (`fetch`, `xhr`, `EventSource` ou que não é GET) e também a imagem, o script e o documento
   (medido: o `EventSource` cortado passava calado, e, até a rodada 41, a imagem nova `/collect.gif` também; agora os
   dois reprovam) —, salvo os de `PREVISTO`, o que a página manda e o teste corta de propósito (analytics, pixel, aviso
   de erro, fonte de fora), lido no código, cada um pelo endereço inteiro, com a query, que só vale para GET, ou por
   uma função `(u, m, c, t) => …` sobre o endereço, o método, o corpo e o tipo — o mesmo `POST /api/events` leva o
   evento do analytics e o dado da tela, e pelo endereço o corte do dado passava calado (medido; com a condição sobre o
   corpo, só o do analytics fica de fora) —, nunca pelo começo, que cobriria também a chamada que importa (medido: na
   página de teste, com a lista completa o bloco passou;
   sem um endereço que a página chamava, parou em `falhou em conferir o que foi cortado (GET fetch …)`; com
   `${SITE}/api/events` na lista, o corte de `/api/events?mode=data`, chamada de dados da tela, reprovou do mesmo jeito,
   e com os endereços inteiros passou) —: o `CORTADO` mostra o quê — método (só os sete do padrão, de `GET` a `OPTIONS`;
   outro sai `outro`, porque a página escolhe a palavra, e a palavra pode ser chave: rodada 48, o `TOKEN123` saía cru no
   bloco da 47, e no novo sai `outro`), tipo (documento, script, imagem, fetch) e de onde (`o site`, `a origem da
   entrada N` ou `outra origem`, nunca o host, que também pode levar token ou o nome do
   cliente — e o mesmo nas mensagens de `não houve` e de status), guardado num conjunto, sem repetir, para a página que
   tenta sem parar não encher a memória (medido: em 5 s de laço, o bloco anterior juntou 7.705 linhas, 262 KB; o novo, 1
   linha), sem o caminho nem a query, que podem levar token, e-mail ou nome (`/magic-link/<token>`, `/maria/pedidos`), e
   a marca do que estava na lista e abortou mesmo assim (`3xx`, `falhou`, `repetido`, `cors`, `fluxo`, `rede local`,
   `status`, `erro`, `sem tipo`; e `desistiu`, que só reprova na entrada da lista sem `opcional`, como `não houve`), e
   sai
   na própria mensagem de erro, até 10 linhas diferentes, para o teste que falhou dizer o que faltou —, e entra em
   `PASSA` depois de lido no código e conferido que não é medição. O nome do erro que sai junto é de uma lista fechada
   (`Error`, `TypeError`, `TimeoutError`…), porque é texto que o código pode escolher (medido: o erro que a página joga
   com nome próprio no `page.evaluate` chega ao Node como `Error`; a lista fecha o que o teste e as condições da lista
   jogarem). O preflight do CORS, o Playwright responde sozinho, e
   o das chamadas que abortam não sai (medido com o Playwright 1.58: POST com JSON e PUT com cabeçalho próprio a outra
   origem, fora do `PASSA` — o servidor dela não recebeu nem o `OPTIONS`; e, com o `route`, um POST cujo `OPTIONS` o
   servidor recusa chegou ao servidor e a página leu a resposta, o que o navegador sem o `route` não deixa); então, na
   chamada a outra origem que pede preflight (método fora de GET, HEAD e POST, cabeçalho posto pela página, tipo de
   corpo fora dos três simples; o cabeçalho, contado nos que a busca manda, o `allHeaders`, menos os que só o navegador
   põe, a lista proibida do Fetch e o `User-Agent`: o `headers()` pode deixar de fora os de segurança — no Chromium 141
   trouxe o `Authorization`, medido, e a pergunta já saía —, e a conta agora é a mesma que vai à rede), o bloco manda
   antes o `OPTIONS` de verdade, por um contexto de busca só dele, sem cookie, como o do navegador, e o `Set-Cookie` da
   resposta dele não chega ao navegador, e só segue se o servidor liberar a origem, o método e os cabeçalhos (o `*` não
   libera o `Authorization`, nem nada quando a chamada vai com credenciais; o método, na caixa exata, como o navegador:
   medido, com `Allow-Methods: put, delete` o navegador recusou o PUT e o DELETE, o bloco anterior deixou passar, o novo
   recusa; e a lista com um membro que não é palavra do HTTP reprova inteira — rodada 49: com
   `Allow-Methods: PUT, bad method` ou `Allow-Headers: x-shs, bad header`, o navegador mandou só o `OPTIONS` e o bloco
   da 48 mandou o PUT; o novo para em `cors`), sem `Access-Control-Request-Headers` quando a página não pôs cabeçalho
   (o anterior mandava o campo vazio,
   que o navegador não manda), a resposta liberada fica guardada pelo tempo que ela diz (`Access-Control-Max-Age`, só
   número inteiro; 5 s sem ele ou com ele mal escrito, até 2 h — medido com `Max-Age: 600junk` e duas chamadas a 6,5 s:
   o navegador sem o `route` e o novo perguntaram duas vezes; o anterior guardou 600 s e mandou o segundo POST sem
   pergunta; o negativo vale 0, sem guardar, o que passa do int64 vale os 5 s, e o `+60` vale 60; rodada 49, dois
   PUT: com `-1`, o navegador perguntou nos dois e o bloco da 48 só no primeiro; com `99999999999999999999` e 6,5 s,
   o navegador perguntou de novo e o da 48 guardou 2 h; com `+60`, o navegador guardou e o da 48 perguntou de novo; o
   novo, como o navegador nos três), uma por origem de cima, origem e endereço, com os métodos e os cabeçalhos que ela
   liberou e trocada pela última pergunta ao mesmo endereço, como no Chromium, que tira a que venceu ou não basta e não
   guarda endereço de 1024 bytes ou mais (rodada 50, contra o Chromium 141 sem o `route`: o mesmo `iframe` sob outro
   site de cima — o Chromium perguntou de novo, o bloco da 49 não, o novo sim; sob o mesmo site, nenhum dos três;
   PUT, PUT com um cabeçalho que a pergunta recusa, PUT — o Chromium perguntou de novo no terceiro, o da 49 o mandou
   sem pergunta, o novo perguntou; dois PUT a um endereço de 1024 caracteres — o Chromium perguntou nos dois, o da 49
   só no primeiro, o novo nos dois; com 1023, os três guardaram; a origem de cima é mais fina que o site do Chromium:
   entre origens do mesmo site, o novo pergunta a mais, o lado seguro) — e vale pelo modo do pedido que perguntou, e
   não pelo `Allow-Credentials` da
   resposta: a feita sem credenciais não serve ao pedido que as leva (rodada 48: um `PUT` com `credentials: 'omit'` e
   outro com `'include'`, com a pergunta respondida com `Allow-Origin: *` e `Allow-Credentials: true` — o navegador
   perguntou de novo e barrou o segundo; o bloco da 47 mandou o segundo `PUT` sem perguntar, a escrita que o navegador
   nunca mandou; o novo pergunta e corta, como ele) —, e a
   chamada que cabe no que ela liberou não pergunta de novo (medido: duas chamadas iguais com `Max-Age: 60` — o
   navegador mandou um `OPTIONS` e dois POST, e o novo também; e PUT, DELETE, PATCH e PUT, com o primeiro `OPTIONS`
   liberando PUT e DELETE e o do PATCH só o PATCH: o navegador perguntou no 1º PUT, no PATCH e no 2º PUT; o bloco
   anterior perguntou também no DELETE, um `OPTIONS` a mais, e mandou o 2º PUT sem pergunta; o novo perguntou como o
   navegador), a chamada que a página desiste enquanto a
   pergunta corre (`AbortController`) não segue, como no navegador (`desistiu`: medido, o navegador e o bloco mandaram
   só o `OPTIONS`; o da rodada 44 mandou o POST depois), nem a que ela desiste com a busca já no ar, que fecha junto
   (rodada 48: POST a um `https` que demora 2 s no aperto de mão e desistência em 300 ms — o navegador abriu e fechou a
   conexão sem pedido nenhum; o bloco da 47 entregou o POST ao servidor e passou calado; o novo não entregou e marcou
   `desistiu`; o pedido que já tinha saído antes da desistência chega nos três), e a entrada da lista sem `opcional` de
   que a página desistiu
   conta como não houve (medido: o bloco anterior passava a checagem com a gravação obrigatória cancelada; o novo para
   em `não houve`), e o XHR a outra origem com corpo pergunta sempre,
   porque o navegador pergunta quando a
   página escuta o envio (`upload.onprogress`) e o `route` não mostra isso (medido: com o evento, o navegador mandou o
   `OPTIONS` antes do POST; o bloco anterior foi direto ao POST; o novo pergunta antes) — o XHR sem o evento ganha um
   `OPTIONS` que o navegador não manda, que é o lado seguro, salvo com `upload: false` na entrada, quando o código lido
   não escuta o envio (medido no Chromium sem o `route`: só perguntou com corpo e evento juntos; sem o evento, e com o
   evento num GET ou num `send(null)`, foi direto; com `upload: false`, o bloco foi direto como ele); e a resposta de
   toda chamada a outra origem só chega à página se liberar a origem (com credenciais, a origem exata e
   `Allow-Credentials`) — senão aborta (`cors`), e o servidor recebeu os mesmos `OPTIONS` e `POST` que recebeu do
   navegador sem o `route`, e a página, os mesmos erros (medido); a origem é a de quem chama, lida no `Origin` do
   pedido ou, no `fetch` que não o manda, na do documento que chamou, pelo endereço do quadro que o Playwright vê (o
   `iframe` `about:blank` e o `srcdoc` herdam a do quadro de cima — medido: o GET da própria origem num `iframe` assim
   era cortado como `cors`; agora passa, como no navegador), e não pelo `self.origin`, que a página troca (rodada 50:
   a página pública em `https` que pôs `self.origin = 'http://127.0.0.1'` e pediu `no-cors` ao `127.0.0.1` — o
   Chromium ficou esperando a licença, sem pedido; o bloco da 49 a tomou por local e entregou o GET; o novo corta em
   `rede local`; sem quadro em cima, o popup `about:blank`, vale a origem opaca, a mais estrita), e não a do site: o
   `iframe` de outra origem que chama o site faz chamada
   CORS (medido: um `iframe` de
   `localhost:8797` que chamava `127.0.0.1:8796` sem `Allow-Origin` leu a resposta no bloco anterior; no novo, deu o
   mesmo erro do navegador); cabeçalho simples é o da lista do Fetch com as regras de valor — um `Accept` de mais de 128
   bytes pede preflight, um `Range: bytes=0-` não, e o limite de 128 bytes vale para todos, o `Range` inclusive (medido
   nos dois contra o navegador sem o `route`: no bloco anterior, o primeiro foi direto ao servidor e o segundo mandou um
   `OPTIONS` que o navegador não manda; no novo, o servidor recebeu o mesmo que do navegador), e o `Range` invertido
   (`bytes=10-2`) pergunta antes, como no navegador, comparado em `BigInt` (medido: o navegador mandou o `OPTIONS`; o
   bloco anterior foi direto ao GET; o novo pergunta; com `bytes=9223372036854775809-9223372036854775808`, que em
   `Number` dá dois números iguais, o navegador perguntou, o bloco anterior foi direto, e o novo pergunta); credencial é
   o cookie que a página mandou, o `credentials: 'include'` do `fetch` e o `withCredentials` do XHR — que o pedido sem
   cookie a mandar não mostra, e a própria página anota, como o modo, o `withCredentials` pelo getter original, porque a
   propriedade posta na instância mente (rodada 48: escondido assim, o bloco da 47 mandou o POST, e o navegador o
   barrou; o novo corta em `cors`) —, ou `cred: 'include'` na entrada, no elemento com
   `crossorigin="use-credentials"` (medido: o XHR com `withCredentials` e o `fetch` com `credentials: 'include'`, sem
   cookie, com a pergunta respondida com `Allow-Origin: *` — o navegador mandou só o `OPTIONS` e deu erro; o bloco
   anterior mandou o POST depois; o novo para em `cors`, como ele; o XHR sem credenciais segue com o `OPTIONS` e o
   POST); o `fetch` com `mode: 'no-cors'` passa sem pergunta e
   sem `Allow-Origin` e chega opaco à página, como no navegador: o modo não chega ao `route` (nem o `Sec-Fetch-Mode`, e
   o POST `no-cors` traz `Origin`, medido), então o próprio `fetch` da página anota o modo de cada pedido que pode ser
   `no-cors` (GET, HEAD, POST), num pedido que ele monta uma vez, pelo construtor de verdade, e que é o mesmo entregue
   ao `fetch` nativo, para cada campo do `init` ser lido uma vez, como no navegador (rodada 48: o método que muda na 2ª
   leitura saiu `OPTIONS` e `PUT` pelo bloco da 47, e `GET` pelo navegador e pelo novo; o corpo que muda de texto para
   fluxo deu `TypeError` na página pelo bloco da 47) — o `Request` criado noutro quadro da mesma origem também,
   reconhecido pelo tipo e não
   pelo `instanceof`, que entre quadros dá falso (medido: com um `Request` de `iframe` e um `no-cors` ao mesmo endereço,
   o bloco anterior pulou a pergunta e mandou o POST com o cabeçalho; o navegador e o novo perguntaram antes e não o
   mandaram) —, sem ler o corpo, do começo até ele acabar, e o `route` só lê: trata como opaco só
   quando todo `fetch` no ar naquele endereço é `no-cors` e o pedido é dos que o `no-cors` deixa existir — GET, HEAD ou
   POST, só com `Accept`, `Accept-Language`, `Content-Language` e `Content-Type` simples —, porque a anotação vem da
   página, que pode forjá-la (rodada 50: a página que trocou o `window.__shsNoCors.get`, ou o `window.eval`, que muda
   o que todo `frame.evaluate` devolve, marcou de `no-cors` um PUT com cabeçalho próprio; o Chromium mandou só o
   `OPTIONS`, recusado; o bloco da 49 mandou o PUT; o novo pergunta e corta; o `redirect: 'manual'` forjado só entrega
   o 3xx, sem pedir o destino; e o que a anotação traz de mais estrito, a credencial e o corpo em fluxo, a página ainda
   pode apagar: um PUT `credentials: 'include'` sem cookie, com a pergunta respondida com `Allow-Origin: *`, passou nos
   dois blocos com a anotação apagada, e o Chromium o barrou — nem o `evaluate` nem o `exposeBinding` dão canal que a
   página não alcance, medido: o nome da binding aparece no controlador do Playwright, e ela a chama com o que quiser;
   aceitar esse resto é decisão do Lucas), e o `evaluate` que lê a anotação tem 2 s, como o `setOffline` do fim, senão
   vale o mais estrito (rodada 50: com um GET da lista no ar e a página presa num laço sem fim, o bloco da 49 levou
   45 s, 40 deles no `setOffline`, que falhou; o novo cortou o GET em `fluxo` e devolveu em 7,6 s, reprovando) — com um
   `cors` junto, não se sabe qual dos dois chegou, e
   vale o mais estrito, o preflight (na fila da rodada 39, o `route` tirava a anotação mais antiga, e um `cors`
   simultâneo podia pegar a do `no-cors` e pular a pergunta; em 12 voltas com os dois ao mesmo tempo a ordem saiu
   certa, mas a corrida existia, e agora não há o que tirar) —, e o endereço sem nenhum no ar sai do mapa (medido: 200
   `no-cors` com query nova deixavam 200 listas vazias; agora, nenhuma) (medido, a outra origem sem `Allow-Origin`: o
   navegador entregou a resposta opaca no GET e no
   POST `no-cors`; o bloco anterior abortava os dois, `cors`, com o POST já recebido pelo servidor; o novo entregou
   opaca, como o navegador; o `fetch` `cors` ao mesmo endereço continua dando erro; e a anotação é de cada `fetch`, sai
   quando ele acaba, e o `no-cors` com método que o `fetch` recusa, como o PUT, não se anota: com um `no-cors` recusado
   ou abortado antes de sair e, depois, o `fetch` `cors` ao mesmo endereço, a anotação que sobrava fazia o bloco
   anterior pular a pergunta e mandar ao servidor o PUT e o POST que o navegador, perguntando antes, não mandou; o novo
   pergunta e para, como ele; com `Access-Control-Allow-Origin: *`, a página leu a resposta vazia sem o `route` e pelo
   bloco); e a busca do que passa — o mesmo cliente do `route.fetch`, o `APIRequestContext` do Playwright — vai, cada
   uma, por um contexto novo, só dela e fechado com a resposta, com o cookie que a página mandou, lido no `allHeaders()`
   (o `headers()` pode escondê-lo, documentado pelo Playwright; medido com cookie `HttpOnly`: o servidor recebeu o
   cookie pela busca, como do navegador), e mais nenhum: pelo próprio contexto, a busca punha os cookies dele quando a
   página não mandava nenhum e gravava no navegador o `Set-Cookie` de toda resposta, o que o navegador não faz com
   `credentials: 'omit'`, com outra origem sem credenciais nem com o preflight (medido: no bloco anterior, a chamada com
   `omit` deixou o cookie gravado, a de outra origem também, e o cookie posto pela resposta do `OPTIONS` foi mandado ao
   servidor no `PUT` seguinte; no novo, como no navegador sem o `route`, só a chamada comum da própria origem grava, e
   em quatro chamadas — mesma origem e outra, com e sem `omit` — o servidor recebeu o cookie que o navegador mandou, e
   as duas com `omit`, que o bloco de antes abortava, passam sem ele); quem grava é o navegador, pelo `Set-Cookie` da
   resposta entregue (medido: os dois `Set-Cookie` de uma resposta chegaram ao `document.cookie`), e onde o navegador
   não manda `Cookie` a busca também não manda (medido: no bloco anterior, a página, as chamadas sem cookie e o
   `OPTIONS` chegaram ao servidor com um `Cookie` vazio, que um middleware pode tratar diferente da falta dele; no novo,
   sem o cabeçalho, como do navegador). Caminho que depende de service worker (offline, cache, API interceptada), de
   worker, de WebSocket ou de WebRTC (progresso ao vivo, chat, chamada) não se prova com eles cortados; resposta em
   fluxo (SSE, texto gerado aos poucos) chega à página de uma vez, no fim, porque o `route.fetch` lê a resposta inteira
   antes de entregar, e uma resposta grande demais pode derrubar o script, não o recolhimento, que é passo da sessão,
   depois dele (o navegador morre com o script: morto o processo do Node, os 10 processos do navegador saíram em 2,5 s —
   medido); e o `route` desliga o cache HTTP do navegador, então o que só quebra com cache (o visitante que volta)
   também não se prova assim, e o veredito diz isso. A página entregue pelo `route.fetch` continua em contexto seguro
   (medido no Playwright 1.58, em `https` fora do `localhost`: `isSecureContext` e `crypto.subtle` presentes). A busca
   sai pelo Node, não pelo navegador, e na nuvem do Claude Code não acha host de fora sem o proxy do ambiente (o
   `HTTPS_PROXY`, ou o `ALL_PROXY` quando é o único, e a variável vazia passa à seguinte; o endereço sem esquema,
   `proxy:3128`, que o Playwright aceita, vale como `http://` — medido: só com o `ALL_PROXY`, o bloco anterior não abriu
   a página, e o novo abriu pelo proxy; com o `HTTPS_PROXY` vazio ao lado do `ALL_PROXY`, e com o proxy sem esquema, o
   bloco anterior não abriu a página, e o novo abriu com 200 pelo proxy de teste, que viu a senha de cada um), que o
   contexto da página e os de busca recebem (`proxy`, com o que o `NO_PROXY` do ambiente lista e o que o Chromium
   manda direto sozinho fora dele — a busca, pelo mesmo caminho que a página: lê a mesma lista pela regra do
   Chromium (vírgula ou
   ponto e vírgula entre as entradas, `*`, porta, faixa IPv4 como `10.0.0.0/8`, curinga, ponto na frente; o IPv6 sem
   colchetes e a faixa IPv4 inválida, como `1.999.0.0/8` ou `/33`, o Chromium ignora — e, na faixa inválida, o bloco
   para) e vai direto ou pelo
   proxy sem lista, porque, na busca, a lista do Playwright só compara o fim do nome (medido num proxy de teste: com
   `NO_PROXY=*` e com `host:porta`, a página foi direto e a busca do bloco anterior, pelo proxy; com o host exato, a
   página mandou o subdomínio pelo proxy e a busca anterior, direto; a regra nova bateu com a página nos 25 casos
   medidos, e na rodada 41 em mais 11 — com `a;b`, a página foi direto e a regra anterior, pelo proxy; com
   `1.999.0.0/8`, a página foi pelo proxy e a regra anterior mandava `4.231.0.1` direto; rodada 49: a referência passa
   a ser o Chromium que lê o proxy do ambiente, como o da pessoa no Linux, e não a página do Playwright, que põe
   `<-loopback>` na lista e hoje vai ao proxy morto do bloco — nele, `localhost`, `*.localhost`, `127/8`, `[::1]`,
   `169.254/16`, `[fe80::]/10` e o `::ffff:` de `127` e de `169.254` vão direto sem estar na lista, e a entrada de nome
   casa pelo fim (`example.test` levou direto `api.example.test` e até `badexample.test`), a de IP, só o IP (`10.1` é
   `10.0.0.1`): medido no Chromium puro com um proxy de teste, o bloco da 48 bateu em 17 de 29 casos, e o novo em 29
   —, e a forma que ela não sabe seguir — `<local>`, esquema,
   faixa IPv6 — para o bloco, e o IPv6 entre colchetes mal escrito também, com mensagem fixa, porque o erro do `URL`
   do Node traz a entrada inteira (medido: com `NO_PROXY=[abcd:token]`, o bloco da rodada 41 caiu em `Invalid URL`
   com a entrada no erro; o novo, em `NO_PROXY com IPv6 mal escrito`, sem ela)) —, e o usuário e a senha
   do endereço do proxy nos campos próprios, que o Chromium não lê do endereço — medido num proxy de teste que pede
   senha: o bloco anterior nem abriu a página, o novo abriu com 200; com o host no `NO_PROXY`, o anterior foi pelo proxy
   e o novo foi direto; com o endereço do proxy mal escrito e a senha nele, o anterior imprimiu a senha no erro, porque
   o do `URL` do Node traz o endereço inteiro no `input`, e o novo para em `HTTPS_PROXY/ALL_PROXY mal escrito`, sem o
   valor) — medido: o bloco anterior não abriu nem o `example.com` nem a prévia da Vercel; o novo abriu o `example.com`
   com 200 e recebeu da prévia o mesmo 302 para o login da Vercel que o `curl` recebe. Os cabeçalhos de relatório da
   resposta (`Report-To`, `NEL`, `Reporting-Endpoints`) e os de registro de conversão
   (`Attribution-Reporting-Register-*`, `Attribution-Reporting-Info`) saem antes de a página receber, porque o relatório
   e a conversão são enviados pelo próprio navegador, que pode mandá-los por fora do `route`, e sem o endereço eles não
   saem (medido: a página não leu mais o `Report-To` nem o `Attribution-Reporting-Register-Source`, e os dois
   `Set-Cookie` da mesma resposta continuaram); o relatório de CSP pelo `report-uri` passa
   pelo `route` e aborta como o resto (medido: sem o `route`, o servidor recebeu o `POST` do relatório; com o bloco,
   não). O `Sec-Fetch-Site`, o `Sec-Fetch-Mode` e o `Sec-Fetch-Dest` não chegam ao servidor pelo `route.fetch` (medido:
   o navegador manda os três; pelo bloco, nenhum, e o `allHeaders()` dentro do `route` também não os mostra, então não
   há o que repor): rota que decide por eles (proteção contra pedido de outro site, lida no código antes — a dela e a do
   que roda na frente dela) não entra em `PASSA` na produção, porque a busca grava o que o navegador teria recusado
   antes de o veredito dizer qualquer coisa: ela vira fronteira; e o corpo binário sem
   tipo (um `ArrayBuffer`, um `Blob` sem tipo) é cortado (`sem tipo`), porque a busca o
   mandaria como `application/octet-stream`, que o Playwright põe sem como tirar, e a rota que só grava com esse tipo
   gravaria o que o navegador não mandou (medido: o navegador não manda `Content-Type`; pelo bloco anterior, o servidor
   recebeu `application/octet-stream` e respondeu 200; com o campo vazio, um `Content-Type` vazio; pelo novo, nada
   chegou): rota assim vira fronteira. A chamada de um quadro da internet à rede local
   (`localhost`, `127.x`, `10.x`, `172.16` a `172.31`, `192.168.x`, `169.254.x`, `100.64` a `100.127` — a rede da
   operadora —, `0/8` inteiro, `198.18/15` e, na dúvida, as faixas de documentação, reservadas e de multicast, o IPv6
   que não é público — só é público o de `2000::/3` fora de `2001::/23`, `2001:db8::/32`, `2002::/16` e `3fff::/20` —,
   lido como número, e o `::ffff:a.b.c.d` pelo IPv4 de dentro, o nome `.local` e o nome que resolve para um deles,
   quando a busca vai direto — e o que
   não resolve, porque a busca pode achar o endereço depois) é cortada (`rede local`), porque o Chrome novo pede licença
   à pessoa antes (Local Network Access) e a busca do bloco não
   pediria; quem chama é o quadro — a origem que o pedido leva, ou a do documento que pediu —, e não o site, porque o
   `iframe` público numa página local também pede a licença (conferido com pedidos e DNS de mentira: o `iframe` público
   numa página local, o `.local`, o `100.64.1.1` e o nome que resolve para `10.x` ou `fd00::1` passavam no bloco
   anterior, e o novo corta; a origem opaca e o quadro que não responde também cortam; o `iframe` local numa página
   pública passa; a busca de nomes do Node, pelo `/etc/hosts`, devolveu o endereço local); quem chama só é local escrito
   como tal, sem DNS, porque o nome dele poderia resolver local só na conta (conferido: a página cujo nome resolve local
   chamando outro que resolve local, e o nome que não resolve, passavam no bloco anterior, e o novo corta). Rodada 48: o
   IPv6 se lê como oito grupos de 16 bits, e não pelo texto — o `::ffff:8.8.8.8` contava como local qualquer que fosse o
   IPv4: a página pública que o chamava era cortada, e a página nele chamando `127.0.0.1` passava; o novo passa a
   primeira e corta a segunda, e o `::ffff:10.0.0.1` segue local; o `[fd::1]` é `00fd::1`, fora do `fc00::/7`, e não é
   ULA (todo ULA começa por um grupo de quatro dígitos, de `fc00` a `fdff`, e esses a regra antiga já pegava); e o IPv6
   escrito não vai mais ao DNS, que não lê colchetes e devolvia `ENOTFOUND`, contado como local (medido em 33 endereços:
   só os quatro IPv4 mapeados públicos mudaram; no navegador o IPv6 não se mediu, porque o núcleo do contêiner não tem
   IPv6). Rodada 49: a tabela vai pelo número e é a larga no destino, e quem chama segue pela de antes, porque ali o
   público tomado por local deixaria passar; o mesmo IP escrito dos dois lados é o mesmo espaço; e o nome do pedido
   que vai abortar não vai mais ao DNS (medido: o `lookup` recebia `segredo-abc123.invalid` de um `fetch` fora da
   lista; o novo não o chama). No Chromium 141 sem o `route`, a página pública em `https` que chamava `0.1.2.3` e
   `100.64.0.1` ficou esperando a licença, sem pedido nenhum, e a `198.18.0.1` recebeu o pedido (o 141 ainda a lê
   pública; a regra do Local Network Access, local); o bloco da 48 entregou o de `0.1.2.3`, e o novo corta os três (em
   51 endereços, 22 mudam no destino, todos de público para local, e nenhum em quem chama). Pelo proxy
   do ambiente, quem resolve o nome é o proxy, e o bloco não
   vê o endereço — nem o DNS que muda entre a conta e a busca, porque o `APIRequestContext` do Playwright não deixa
   prender o endereço conferido —: o nome assim não entra em `PASSA`, e aceitar esse resto é decisão do Lucas (o
   Chromium do
   ambiente é o 141). Medido sem mudança: o cabeçalho que a outra origem não expõe (`Access-Control-Expose-Headers`) o
   Chromium esconde da página depois do `route` (`null` com e sem o bloco); o 304 de um arquivo do build sem cópia
   guardada dá `onload` também no navegador comum. A dica de cliente (`DPR`, `Width`, `Viewport-Width`, `Device-Memory`,
   `RTT`, `Downlink`, `ECT`, `Save-Data`), no valor que o Chromium aceita, vai sem pergunta, como no navegador (medido
   no Chromium 141 sem o `route`: `DPR: 2`, `Save-Data: on` e `ECT: 4g` foram direto ao POST; `DPR: abc`, `Save-Data:
   off` e `ECT: 9g` perguntaram antes; o bloco anterior perguntava nos três primeiros, e esse `OPTIONS` a mais chegava
   ao servidor; o novo faz como o navegador nos seis), com o número que o Chromium aceita em cada uma — `Width`,
   `Viewport-Width` e `RTT` só inteiro, `DPR`, `Device-Memory` e `Downlink` com casa decimal — e o `Save-Data` sem caixa
   (medido no Chromium 141 sem o `route`: `Width: 1.5`, `Viewport-Width: 1.5` e `RTT: 1.5` perguntaram antes; `DPR:
   1.5`, `Device-Memory: 0.5`, `Downlink: 1.5` e `Save-Data: ON` foram direto; o bloco anterior mandava `Width` e `RTT`
   direto e perguntava no `Save-Data: ON`; o novo, como o navegador; rodada 50: as oito, postas pela página com os
   valores do achado — `DPR: 1.5`, `Device-Memory: 8`, `Width: 100`, `Viewport-Width: 100`, `ECT: 4g`, `RTT: 50`,
   `Downlink: 1.5`, `Save-Data: on` —, foram direto nos três; e o `Intervention`, de qualquer valor, também vai sem
   pergunta, que o 141 o tem na lista dele: o Chromium mandou o POST, o bloco da 49 perguntou, e a pergunta recusada
   cortou o que o navegador mandava; o novo, como ele); e os cabeçalhos simples que somam mais de 1024
   bytes perguntam todos, como no Fetch e no Chromium (medido: dez de 120 bytes — o navegador perguntou com os dez
   nomes; o anterior foi direto ao POST; o novo perguntou igual; quatro deles, 480 bytes, foram direto nos três). O
   `DEBUG` do Playwright (`pw:api`) imprime cada URL inteira, token incluso: com qualquer valor, o bloco para antes de
   tudo, porque o curinga do meio também o liga (rodada 49: com `DEBUG=p*:api`, o bloco da 48 seguiu e imprimiu 53
   linhas `pw:api`, três com o token da URL; o novo para em `DEBUG: desligue…`, como a linha de antes do
   `require`); e o `NODE_DEBUG` também, com qualquer valor, porque o do Node imprime a URL, o cookie e o
   `Authorization` no
   erro padrão (medido: com `NODE_DEBUG=http,https,net,tls,http2`, o token da query, o cookie e a chave apareceram lá; o
   bloco anterior seguia, o novo para em `NODE_DEBUG imprime …`). E o `PWDEBUG`, o `PWDEBUGIMPL`, o
   `SELENIUM_REMOTE_URL`, o `PW_TEST_CONNECT_WS_ENDPOINT` e o `SSLKEYLOGFILE` também: o Playwright lê o `PWDEBUG` na
   importação e põe o objeto `playwright` na página, os dois seguintes levam o navegador a outra máquina, e no
   `SSLKEYLOGFILE` o Chromium grava as chaves do TLS (rodada 48: com `PWDEBUG=console`, o script da própria página leu
   `window.playwright`; o `SELENIUM_REMOTE_URL` fez o `launch` mandar `POST /wd/hub/session` ao servidor dele; o
   Chromium gravou 10 linhas de chaves numa página `https` e 20 numa `data:` sem rede, pelas conexões de fundo; o bloco
   da 47 rodava com eles, e o novo recusa) — e quem abre o navegador confere o mesmo antes do `require` (passo 2, (a)),
   porque o `PWDEBUG` já valeu na importação e o Chromium abre o arquivo de chaves no `launch`. Sem como cortar tudo —
   Playwright velho, service
   worker, worker, WebSocket ou WebRTC necessário —, o navegador não abre, nem na prévia isolada, porque o pixel e o
   analytics que rodam no navegador disparam do mesmo jeito lá: o caminho se prova pelo HTTP, rota a rota, ou vira
   fronteira. O contexto fecha no `finally`, o da página e os de busca ainda abertos, cada um por si (um que falhe ao
   fechar não segura os outros), também quando o teste ou o preparo falha, e só depois de tirar a rede da página e de
   esperar as chamadas que estão no ar: fechar com uma no meio fazia o navegador mandá-la de novo, e a que ainda não
   tinha chegado ao `route` saía direto para a rede (medido, com o teste falhando enquanto a página gravava numa rota de
   2 s: em 5 rodadas, o bloco anterior mandou a gravação duas vezes em 3, deixou um contexto aberto e devolveu antes de
   ela terminar; o novo, em 8 rodadas, nunca mandou duas vezes nem devolveu antes — ou a gravação não saiu, ou ele
   esperou o fim dela; e, se tirar a rede falhar, o bloco reprova, `rede ligada no fim`, e antes de fechar espera a
   pausada chegar ao `route`, que, fechado, a aborta: medido com o `setOffline` quebrado de propósito, 5 rodadas cada, o
   bloco anterior seguiu calado e a gravação terminou depois de ele devolver em 4; o novo reprovou nas 5, e nenhuma
   terminou depois) — o preparo (prazo, script de início, rotas) fica dentro do `try`, e a conferência do Playwright
   fecha o contexto antes de parar (medido: sem o `finally`, o teste que falhou deixou o contexto aberto; com o preparo
   fora do `try`, o Playwright sem `routeWebSocket` e o script de início que falhou também) —, antes de esperar o que o
   fluxo grava depois e de apagar o dado de teste (passo 4): página aberta ainda repete chamada, sonda e salva sozinha.
   A página testada só vale com o código esperado (`ESPERA`, como no HTTP): o `goto` não lança em 404 nem em 500, e a
   casca da página costuma trazer o mesmo texto (medido: um bloco que conferia o código só depois de entregar a página
   leu o texto do teste numa 404 e noutra 500 e seguiu, e uma 404 que chamava uma rota de escrita listada fez o servidor
   receber duas gravações; o atual não entrega a página fora do código — ela aborta antes de rodar, `status` — e para em
   `falhou em abrir a página (veio 404)`, sem gravação nenhuma); quando a checagem é a recusa, o 404 é o `ESPERA`, e a
   condição passa a ser o texto que só a aplicação mostra. O que passa vai pelo `route.fetch` com o prazo da rota
   (`MAX_MS`, o mesmo do `MAX` do HTTP), e o contexto dá esse prazo a toda navegação e espera do teste
   (`setDefaultTimeout`): no padrão, 30 s, uma rota listada de 35 s abortou, e uma página de 35 s e a espera pela
   resposta de uma rota de 35 s caíram por prazo (medido); seletor errado demora o prazo para falhar, que é o lado
   seguro. A visita sintética não pode virar evento na Meta nem sujar a métrica da campanha ou do site. (b) HTTP na
   rota, com o primeiro bloco abaixo — `URL` recebe a rota da prévia ou da produção; `EXTRA` leva o método e os
   cabeçalhos quando a rota não é GET (um POST testado com GET dá 405 e reprova à toa), e `CORPO` leva o corpo, com o
   dado de teste marcado `shs`; `ESPERA` é o código que prova o caminho (200, 201; quando a checagem é a recusa —
   anônimo recebe 401, recurso apagado dá 404 —, é esse o código, e a condição do corpo passa a ser a da recusa da
   própria aplicação — o campo ou a mensagem que só ela devolve —, nunca só o código: a proteção de prévia da Vercel, um
   proxy ou uma rota digitada errado devolvem o mesmo 401 ou 404 sem o código da rota rodar); credencial nunca vai
   escrita no comando, que fica no histórico da sessão, nem como argumento do `curl`, que outro processo da máquina lê
   (`ps`): URL assinada vem de variável já carregada no ambiente (`URL="$ROTA_ASSINADA"`), cabeçalho com chave também
   (`CAB=("x-api-key: $CHAVE" "Authorization: Bearer $TOKEN")`, com aspas duplas, para o comando guardar o nome e não o
   valor; todo cabeçalho com credencial vai no `CAB`, nunca no `EXTRA`, que vira argumento — medido: o segundo cabeçalho
   posto no `EXTRA` apareceu na lista de processos), e todos entram no `curl` pelo stdin (`-K -`), montados pelo
   `printf`, que é do próprio shell e não vira processo, com aspas e barra escapadas e recusados se tiverem quebra de
   linha, e a URL só `https://` (o `http://` só vale para `127.0.0.1` e `localhost`, porque chave e senha iriam em texto
   aberto, conferidos no host como o `curl` o lê: em `http://localhost:x@127.0.0.1:8775/` o host é o de depois do `@`, e
   o bloco anterior mandou a chave a ele — medido —, e direto, com `--noproxy '*'`: com `http_proxy` no ambiente, o
   bloco anterior mandou a chave ao proxy em texto aberto — medido) — senão uma URL com `"` e quebra de linha vira outra
   instrução para o `curl` (medido: um `upload-file = /etc/hostname` escondido na URL mandou o arquivo da máquina ao
   servidor) —; o rastreio do shell (`set -x`) se desliga antes de tudo, porque ele imprime o comando com a credencial
   já expandida; o corpo, que pode levar senha ou token, vai por um arquivo temporário que só o dono lê (`--data-binary
   @arquivo`), nunca pela linha de comando, montado pelo próprio bloco: o `CORPO` é um filtro do `jq` (`'{campo: "[shs]
   <código>", senha: env.SENHA}'`; JSON pronto também é filtro; texto que não é JSON vai entre aspas,
   `'"a=1&s=\(env.SENHA|@uri)"'`), que entra no `jq` pelo stdin, lê a senha da variável já exportada no ambiente e
   escapa aspas e barra — montado à mão, uma senha com `"` quebra o JSON (medido: o servidor recebeu JSON inválido e a
   chamada caiu com `curl=52`), o `--arg` do `jq` poria o valor na lista de processos, e um `CORPO=$(…)` que falha deixa
   o corpo vazio e o POST sai sem a marca —; filtro que não monta, ou que monta vazio (`empty`, `select(false)`), para o
   bloco antes da chamada (medido: com o vazio, o bloco anterior mandou o POST sem corpo, e o novo para em `o corpo não
   montou ou saiu vazio`; com o filtro quebrado, `o corpo não montou` e o servidor não recebeu nada; com a senha
   `a"b\c{x}` no ambiente, JSON válido), nunca pelo valor; credencial que só existe como texto a colar é fronteira; o
   `COND` recebe a condição de sucesso daquela rota, como filtro do `jq` (o valor certo, não só o campo presente), e
   dela só sai o sim ou não e o código de saída do `jq` (`cond=0`, deu certo; 1, falso; 3, filtro que não compila; 5,
   erro ao rodar): a saída e o erro do `jq` vão para `/dev/null`, porque o que a condição seleciona e a mensagem de erro
   dela podem trazer o próprio corpo (medido: com `COND='select(.status == "ok")'`, o bloco anterior imprimiu a resposta
   inteira; o novo, nada; com `.value|tonumber` e com `error(.)`, numa resposta com um token, o anterior imprimiu o
   token no erro do `jq` e, no segundo, a resposta inteira; o novo, só `cond=5`) — rota que não devolve JSON troca o `jq
   -e "$COND"` por `grep -qF '[shs] <código>' "$f"` (HTML com o texto do teste); resposta sem corpo (204) e rota `HEAD`
   vão com `COND=''`, e fica só a conferência do código; o `EXTRA` só aceita `--head`, `-X <MÉTODO>` e `-H` de
   `Content-Type` ou `Accept`: opção que siga redirecionamento (`-L`), mande ou grave arquivo (`--upload-file`, `-o`),
   troque o proxy ou ponha credencial na linha de comando para o bloco antes de sair (medido: o bloco anterior mandou ao
   servidor o `-L` e o `Authorization` postos no `EXTRA`; o novo para em `EXTRA: só …`, e o servidor não recebe nada); a
   `HEAD` vai com `EXTRA=(--head)`, nunca `-X HEAD` (medido: com `-X HEAD`, o `curl` esperou o corpo que o
   `Content-Length` anunciava e caiu no prazo, `curl=28`; com `--head`, 200 na hora; e o `jq` sobre os cabeçalhos que o
   `--head` grava reprovava sempre — com `COND=''`, 200 e saída 0), e o bloco recusa o `-X HEAD` no `EXTRA`, e o
   `--head` junto com `-X` (medido: com `--head -X DELETE`, o bloco anterior mandou um `DELETE` ao servidor de teste;
   o novo para antes, e o servidor não recebe nada; e o
   bloco anterior o aceitava e esperou até o `MAX`, reprovando a rota sã com `curl=28`; o novo para em `EXTRA: só …
   (HEAD pelo --head)`, e o `--head` continua dando 200). O que cada peça evita: o `( … )` dá a cada checagem os seus
   arquivos e a sua limpeza, mesmo com várias no mesmo terminal; o `command -v jq` para antes de tudo quando falta o
   `jq` e o corpo ou a condição pedem por ele (medido: sem ele no caminho, `falta o jq` e saída 1; a `HEAD` com
   `COND=''`, que o bloco anterior também barrava, agora sai sem ele); o `mktemp /tmp/shs.XXXXXX` põe esses arquivos
   fora do repositório mesmo com o `TMPDIR` apontando para dentro dele; o `&& r=0 || r=$?` guarda o código do `curl`
   mesmo com `set -e` ligado, que mataria o subshell antes do `echo`; `-q`, que tem de vir primeiro, faz o `curl`
   ignorar o `.curlrc` da conta, que poderia religar o seguir-redirecionamento; `--globoff` faz o `curl` tomar `[` e `{`
   da URL como texto, e o erro dele vai para `/dev/null` — senão uma URL assinada com colchete sai inteira, token
   incluso, na mensagem de erro; do `curl` sai só o código de saída (`curl=7` sem conexão, `28` prazo estourado, `6`
   nome que não resolve, `63` ou `153` resposta maior que o limite); sem `-L`, redirecionamento não é seguido (o `curl`
   repetiria o cabeçalho de credencial para o outro endereço, e um POST viraria GET); comparar o código com `ESPERA`
   reprova todo o resto — 3xx, 4xx e 5xx —, mesmo com corpo `{"status":"ok"}`, e usa só o `-w '%{http_code}'`, que todo
   `curl` tem (o `--fail-with-body` só existe do 7.76 em diante); `--max-time "$MAX"` impede que uma rota travada prenda
   a checagem, com o prazo da própria rota (o `maxDuration` dela; sem ele, o padrão do projeto — na Vercel, 300 s, ou o
   que o painel do projeto definir, até 800 s, e o MCP da Vercel lê; sem como ler, 815) mais 15 s de folga para rede e
   partida a frio, para não reprovar rota lenta que está dentro do prazo; `--max-filesize` (no `curl` 8.4 em diante) e o
   `ulimit -f` (em qualquer versão, porque o antigo só confere o tamanho declarado) impedem que uma resposta enorme
   encha o disco — o `ulimit -f` vem depois de o corpo estar no arquivo (antes, um corpo grande derrubava a checagem sem
   a chamada sair), e o `ulimit -c 0` vem antes de tudo, porque o `jq` que monta o corpo com a senha e o `curl` morto
   pelo limite poderiam deixar um core dump com a credencial que leram (medido: no bloco anterior, o `jq` do corpo
   rodava com `core=unlimited` herdado do terminal; no novo, com `core=0`); e, logo depois dele, o `SSLKEYLOGFILE`
   ligado para o bloco, porque o `curl` grava nele as chaves do TLS, e quem tiver a captura do tráfego e o arquivo lê a
   chamada inteira, a credencial do `CAB` inclusive — recusar, e não só tirar a variável no subshell, porque ela
   seguiria ligada para o resto da sessão sem ninguém saber (rodada 48: com a variável ligada, o bloco da 47 deu `200` e
   deixou 5 linhas no arquivo; o novo recusa antes do `curl`, e o arquivo nem é criado; sem ela, o mesmo `200`); `jq -e`
   faz a condição falsa sair com erro
   (senão um `{}` ou um `{"status":"error"}` passaria); na falha, do corpo não sai nada — nem o código de erro, que pode
   ser token ou dado de cliente com cara de código —: sai só o status HTTP e o código do `curl`, e o diagnóstico segue
   pelo log do servidor só quando dá para achar a linha desta chamada — pelo código da checagem, se o log o registra, ou
   pelo id da requisição que a resposta traga; só pela janela de horário, com outro tráfego na rota, a linha pode ser de
   outra pessoa, e o log fica declarado não correlacionado — e só por consulta que já devolve campos fixos (status, rota
   sem a query, hora, nome do erro): filtrar a linha inteira depois de recebida não basta, porque ela já entrou no
   histórico da ferramenta. Rota que grava credencial na linha do log (no quiz-diagnosys, a de retomada registra o token
   cru), com ferramenta que só devolve a linha inteira: o log não se lê, e o diagnóstico fica no código. O corpo fica
   fora do repositório e fora do chat: dele sai só o campo que prova o caminho, nunca o corpo inteiro, que em painel ou
   produção pode trazer dado de cliente ou credencial. (c) banco: só pelo caminho da persona, em (a) e (b), e só para
   ler; consulta, escrita e transação desfeita escritas pela sessão não entram em checagem nenhuma, em banco nenhum
   (decisões 1-A e 2-A) — o que só o banco provaria fica no código, nas migrações e nos testes do repositório, e a
   fronteira diz isso. (d) script do repositório (`npm run`, `scripts/*.sh`). Teste
   unitário **não** substitui (a)–(c): ele prova
   o código, não o caminho. Sites públicos da casa: `vigia/dominios.txt` do hub
   (`../Lucas-Contexto-Geral/vigia/dominios.txt` ou
   https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/vigia/dominios.txt); prévia do PR: o link da Vercel
   no próprio PR.
   ```bash
   { set +x; } 2>/dev/null  # rastreio desligado antes da credencial: com set -x, o shell imprime o valor expandido
   URL='https://…/rota'   # a rota da prévia ou da produção; com credencial na URL: URL="$ROTA_ASSINADA" (nunca o valor)
   MAX=815                # o prazo da rota + 15 s: o maxDuration dela; sem ele, o do projeto (Vercel: 300 s, ou o do
                          # painel, até 800); sem como ler, 815, o padrão aqui
   ESPERA=200             # o código que prova o caminho (200, 201…; 401 ou 404 quando a checagem é a recusa)
   SHS_AMBIENTE="${SHS_AMBIENTE-}"   # previa ou producao, do ambiente, como no navegador, sem padrão: em producao só GET e HEAD, sem -X nem corpo (decisão 1-A)
   EXTRA=()               # só --head, -X <MÉTODO> e -H de Content-Type ou Accept (o resto, o bloco recusa); rota POST:
                          # EXTRA=(-X POST -H 'Content-Type: application/json') — credencial nunca aqui
   CORPO=''               # corpo, como filtro do jq: CORPO='{campo: "[shs] <código>", senha: env.SENHA}' — o bloco o
                          # monta num arquivo, lê a senha do ambiente e escapa; texto puro: CORPO='"a=\(env.A|@uri)"'
   COND='.status == "ok"'  # condição de sucesso sobre o corpo, filtro do jq; HEAD e resposta sem corpo: COND=''
   CAB=()                 # chaves: CAB=("x-api-key: $CHAVE" "Authorization: Bearer $TOKEN") — as variáveis, nunca o
                          # valor; todas vão pelo stdin
   ( f=$(mktemp /tmp/shs.XXXXXX); c=$(mktemp /tmp/shs.XXXXXX); trap 'rm -f "$f" "$c"' EXIT   # nunca no repo
     ulimit -c 0                    # sem core dump antes de qualquer processo ler a credencial (o jq do corpo, o curl)
     [ -z "${SSLKEYLOGFILE-}" ] || { echo 'SSLKEYLOGFILE ligado: o curl gravaria nele as chaves do TLS; desligue'; exit 1; }
     [ -z "$CORPO$COND" ] || command -v jq >/dev/null || { echo 'falta o jq: o corpo e a condição pedem'; exit 1; }
     hd= xm=; for ((i = 0; i < ${#EXTRA[@]}; i++)); do a=${EXTRA[i]} b=${EXTRA[i+1]-}   # nada que mude o destino,
       if [ "$a" = --head ]; then hd=1                  # siga redirecionamento ou mexa em arquivo; o -X HEAD esperava
       elif [ "$a" = -X ] && [[ $b =~ ^[A-Z]+$ && $b != HEAD ]]; then ((++i)); xm=1   # o corpo anunciado até o MAX
       elif [ "$a" = -H ] && [[ $b =~ ^([Cc]ontent-[Tt]ype|[Aa]ccept):\ [^[:cntrl:]]*$ ]]; then ((++i))
       else echo 'EXTRA: só --head, -X <MÉTODO> (HEAD pelo --head) e -H de Content-Type ou Accept'; exit 1; fi; done
     [ "$hd$xm" = 11 ] && { echo 'EXTRA: --head ou -X, não os dois (com os dois, o curl manda o do -X)'; exit 1; }
     case $SHS_AMBIENTE in previa) ;; producao) [ -z "$xm$CORPO" ] || { echo 'produção: só GET e HEAD, sem -X nem corpo'
       exit 1; } ;; *) echo 'SHS_AMBIENTE: previa ou producao'; exit 1 ;; esac   # a escrita em produção não sai
     case "$URL${CAB[*]}" in *[[:cntrl:]]*) echo 'URL ou CAB com quebra de linha'; exit 1;; esac
     h=${URL#*://}; h=${h%%[/?#]*}   # o host como o curl o lê: em http://localhost:@outro, é o outro
     case "$URL" in https://?*) ;; http://*) [[ $h =~ ^(127\.0\.0\.1|localhost)(:[0-9]+)?$ ]] || h=;; *) h=;; esac
     [ -n "$h" ] || { echo 'só https:// (http só local)'; exit 1; }
     [[ $h == *@* ]] && { echo 'URL com usuário antes do host: a chave iria ao host depois do @'; exit 1; }
     [ "${URL%%://*}" = http ] && EXTRA+=(--noproxy '*')   # http local vai direto: o proxy do ambiente leria a chave
     e() { local s=${1//\\/\\\\}; printf '"%s"' "${s//\"/\\\"}"; }   # aspas e barra escapadas para o -K
     [ -n "$CORPO" ] && { printf '%s' "$CORPO" | jq -cnj -f /dev/stdin > "$c" 2>/dev/null && [ -s "$c" ] ||
       { echo 'o corpo não montou ou saiu vazio: nada foi enviado'; exit 1; }; EXTRA+=(--data-binary "@$c"); }
     ulimit -f 5000                 # depois do corpo gravado: antes, um corpo grande derrubava a checagem
     w=$({ printf 'url = %s\n' "$(e "$URL")"; for k in "${CAB[@]}"; do printf 'header = %s\n' "$(e "$k")"; done; } |
           curl -q -s --globoff --max-time "$MAX" --max-filesize 5000000 "${EXTRA[@]}" -K - -o "$f" \
             -w '%{http_code} %{time_total}' 2>/dev/null) && r=0 || r=$?; echo "$w curl=$r"
     [ "$r" -eq 0 ] && [ "${w%% *}" = "$ESPERA" ] || exit 1
     # da condição, só o sim ou não e o código do jq: o valor que ela seleciona e o erro dela podem trazer o corpo
     [ -z "$COND" ] || { jq -e "$COND" "$f" >/dev/null 2>&1; j=$?; echo "cond=$j"; [ "$j" -eq 0 ]; } || exit 1 )
   ```

   ```js
   const SEGURO = s => { try { const x = new URL(s); return !x.username && !x.password && (x.protocol === 'https:'
     || (x.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(x.hostname))); } catch { return false; } };
   // o host já lido, não o texto; e nada antes do @: em https://confiavel@outro, quem recebe é o outro
   const ALVO = process.env.ALVO_URL ?? '';          // a página testada, do ambiente: link assinado nunca no script
   const AMBIENTE = process.env.SHS_AMBIENTE;        // previa ou producao, também do ambiente, dito pela sessão: em
   if (!['previa', 'producao'].includes(AMBIENTE)) throw new Error("SHS_AMBIENTE: 'previa' ou 'producao'");   // produção
   const PROD = AMBIENTE === 'producao';             // só se lê (decisão 1-A)
   if (/\S/.test(process.env.NODE_DEBUG ?? '')) throw new Error('NODE_DEBUG imprime URL, cookie e chave: desligue');
   for (const k of ['NODE_DEBUG', 'DEBUG', 'PWDEBUG', 'PWDEBUGIMPL', 'SELENIUM_REMOTE_URL', 'PW_TEST_CONNECT_WS_ENDPOINT',
     'SSLKEYLOGFILE']) if (process.env[k]) throw new Error(`${k}: desligue antes do require do Playwright`);   // o DEBUG,
   // de todo valor: o curinga do meio (p*:api) também liga o pw:api, que imprime a URL inteira (medido); o PWDEBUG,
   // lido na importação, põe o objeto playwright na página e abre o inspetor; os dois seguintes levam o navegador a outra
   // máquina; no SSLKEYLOGFILE o Chromium grava as chaves do TLS (medido). Quem abre o browser confere o mesmo antes
   if (process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK)   // sem ela, o localhost sai do proxy morto e
     throw new Error('PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK: desligue');   // vai direto (medido)
   if (!SEGURO(ALVO)) throw new Error('ALVO_URL: só https:// (http só local), sem usuário antes do host');
   const N = s => { const x = new URL(s); x.hash = ''; return x.href; };   // endereço inteiro, com a query, sem o #
   const SITE = new URL(ALVO).origin, PAGINA = N(ALVO), MAX_MS = 815_000;   // o MAX do HTTP: prazo da rota + 15 s
   const ESPERA = 200;                               // o código da página (404 quando a checagem é a recusa)
   const FOLGA = 500;                                // depois da evidência, o tempo em que a chamada atrasada conta: o
   // maior prazo da página para chamar de novo (debounce, nova tentativa), lido no código, mais 500 ms
   const ESTATICO = [`${SITE}/_next/static/`];       // pasta do build (Next.js; outro framework, a dele), só GET
   const ESTATICO_MAX = 300;                         // cada arquivo do build passa uma vez, e no máximo estes: a página
   // que pede sem parar, ou com ?r= novo a cada vez, não martela o servidor (o mesmo arquivo pedido duas vezes de
   // propósito, lido no código, vai em PASSA com vezes)
   const PREVISTO = [];                              // o que a página chama e o teste corta de propósito (analytics,
   // pixel, aviso de erro, fonte de fora), lido no código: o endereço inteiro, com a query, vale só para GET; outro
   // método, ou mais de um pedido no mesmo endereço, pede (u, m, c, t) => condição sobre endereço, método, corpo e tipo
   // (o mesmo POST /api/events leva o evento do analytics e o dado da página); o cortado fora daqui reprova, todo tipo
   const J = c => { try { return JSON.parse(c); } catch { return null; } };   // corpo que não é JSON não casa
   let SESSAO = null;                                // o teste guarda aqui a sessão aberta com o e-mail shs+…
   const PASSA = [{ m: 'POST', url: `${SITE}/api/quiz/score`,
     corpo: c => SESSAO !== null && J(c)?.session_id === SESSAO }];
   // m (em produção, só GET e HEAD: o POST do exemplo é de prévia) e url inteira, com a query (com token, montada do
   // ambiente, como o ALVO); corpo, no que não é GET nem HEAD: a condição que liga a chamada a esta checagem (o código
   // no corpo, a sessão que nasceu do e-mail shs+…); se preciso: vezes
   // (padrão 1; GET que a página repete de propósito pede o número), status (padrão s => s < 400), tipo (padrão:
   // fetch, XHR ou EventSource no GET; script, imagem, folha de estilo, fonte ou página pedem o dela: tipo: 'script',
   // porque o mesmo endereço pedido por <img> não é a chamada da página), cred: 'include', no elemento de outra origem
   // com crossorigin="use-credentials" (lido no código; o fetch com credentials: 'include' e o XHR com withCredentials
   // a própria página anota),
   // upload: false, no XHR com corpo sem ouvinte em xhr.upload (lido no código: sem ele, XHR com corpo pergunta antes),
   // resposta: t => condição sobre o corpo, quando a rota responde 200 com o erro dentro (J(t)?.status === 'ok'),
   // e opcional: true na que pode não acontecer — sem ele, a entrada que não houve reprova
   if (![...ESTATICO, ...PASSA.map(p => p.url)].every(SEGURO)) throw new Error('PASSA e ESTATICO: só https://');
   if (PASSA.some(p => !['GET', 'HEAD'].includes(p.m) && typeof p.corpo !== 'function'))   // o HEAD lê, como o GET
     throw new Error('PASSA: escrita sem condição');
   if (PROD && PASSA.some(p => !['GET', 'HEAD'].includes(p.m))) throw new Error('PASSA em produção: só GET e HEAD');
   const PREV = (u, m = 'GET', c = '', t = '') => PREVISTO.some(p => { try { return typeof p === 'function'
     ? p(u, m, c, t) === true : m === 'GET' && N(p) === u; } catch { return false; } });   // exato: começo de endereço
   const DADO = t => ['fetch', 'xhr', 'eventsource'].includes(t);   // sem tipo, só chamada de dados, de todo método
   const CASA = (p, m, u, c, t) => m === p.m && N(p.url) === u && (p.tipo ? p.tipo === t : DADO(t))
     && (p.corpo ?? (() => true))(c) === true;       // a entrada da lista: método, endereço, tipo e corpo
   const QUEM = o => { const i = PASSA.findIndex(p => new URL(p.url).origin === o);   // nem o host vai à mensagem,
     return o === SITE ? 'o site' : i >= 0 ? `a origem da entrada ${i}` : 'outra origem'; };   // que pode levar token
   const VEZES = PASSA.map(() => 0), TARDE = PASSA.map(() => 0), CORTADO = new Set(), RUIM = [], FALTOU = new Set();
   const EST = new Set();                            // os arquivos do build que já passaram
   const VOO = new Set();                            // no ar; TARDE conta, à parte, as da lista que vêm depois do fim
   const MET = m => ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].includes(m) ? m : 'outro';   // o método
   // que vai à mensagem: o da página pode ser qualquer palavra, e palavra pode ser chave (TOKEN123 sai 'outro')
   let VISITAS = 0, VEIO, FECHADO = false;           // FECHADO: depois da evidência, nada novo passa
   const LIBERA = (x, cred, de) => { const o = x.headers()['access-control-allow-origin'];   // libera quem chamou?
     return cred ? o === de && x.headers()['access-control-allow-credentials'] === 'true' : o === de || o === '*'; };
   const V6 = s => { const m = /^\[([\da-f:.]+)\]$/i.exec(s); if (!m) return null;   // [a:b::c] → os 8 grupos
     let t = m[1]; const q = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(t), n = q ? IP4(q[2]) : 0;   // de 16 bits; a cauda a.b.c.d
     if (q) { if (Number.isNaN(n)) return null; t = `${q[1]}${(n >>> 16).toString(16)}:${(n & 65535).toString(16)}`; }
     const [a, b, ...r] = t.split('::'), p = x => x ? x.split(':') : [], A = p(a), B = p(b), z = 8 - A.length - B.length;
     if (r.length || (b === undefined ? z : z < 1)) return null;   // vira os dois últimos; um :: só, valendo um grupo
     const g = [...A, ...Array(b === undefined ? 0 : z).fill('0'), ...B];   // ou mais
     return g.every(x => /^[\da-f]{1,4}$/i.test(x)) ? g.map(x => parseInt(x, 16)) : null; };
   const QUEM4 = ['0.0.0.0/32', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12',
     '192.168.0.0/16'], DESTINO4 = [...QUEM4, '0.0.0.0/8', '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24',
     '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/3'];   // 224/3: multicast, reservado, broadcast
   const EM4 = (n, l) => l.some(f => { const [a, b] = f.split('/'), d = 2 ** (32 - b);   // por divisão: em JS, o >>> 32
     return Math.floor(n / d) === Math.floor(IP4(a) / d); });   // não desloca nada
   const REDE = (h, quem) => /^(localhost|.+\.localhost|.+\.local)$/i.test(h) || EM4(IP4(h), quem ? QUEM4 : DESTINO4)
     || (g => !!g && (g.slice(0, 5).every(n => !n) && g[5] === 65535 ? EM4(g[6] * 65536 + g[7], quem ? QUEM4 : DESTINO4)
       : quem ? g.slice(0, 7).every(n => !n) && g[7] < 2 || (g[0] & 65024) === 64512 || (g[0] & 65472) === 65152
       : (g[0] & 57344) !== 8192 || g[0] === 8193 && (g[1] < 512 || g[1] === 3512) || g[0] === 8194
         || g[0] === 16383 && g[1] < 4096))(V6(h));
   // o destino, pela tabela larga: a do Local Network Access (198.18/15 e 0/8 inteiro inclusive) mais as de
   // documentação e reservadas, na dúvida local; do IPv6, só é público o de 2000::/3 fora de 2001::/23, 2001:db8::/32,
   // 2002::/16 e 3fff::/20 (fec0::1, 64:ff9b:: e fd::1, que é 00fd::1, saem locais); quem chama, só pela de antes (::,
   // ::1, fc00::/7, fe80::/10 e o IPv4 privado), porque ali o público tomado por local deixaria passar; no
   // ::ffff:a.b.c.d, o IPv4 de dentro decide. Endereço escrito como tal, e o nome .local; o que resolve, a LOCAL abaixo
   const ORIGEM = f => { for (; f; f = f.parentFrame()) { const s = f.url();   // a origem do quadro pelo endereço que
       if (!/^about:(blank|srcdoc)([?#]|$)/i.test(s)) try { return new URL(s).origin; } catch { return 'null'; } }
     return 'null'; };                               // o Playwright vê, e não pelo self.origin, que a página troca (é
   // [Replaceable]: medido); o about:blank e o srcdoc herdam a do quadro de cima; sem ele (popup about:blank), a opaca
   const CHAMA = (q, t, de) => { if (de) return de;  // quem chama é o quadro, não o site: a origem que o pedido leva, ou
     const f = t === 'document' ? q.frame().parentFrame() : q.frame();   // a do documento que pediu (o iframe público
     return f ? ORIGEM(f) : SITE; };                 // numa página local também pede licença ao Chrome)
   const PRAZO = (p, x) => { let z; const fim = new Promise(f => { z = setTimeout(f, 2000, x); });   // o evaluate não
     return Promise.race([p.catch(() => x), fim]).finally(() => clearTimeout(z)); };   // tem prazo (o setDefaultTimeout
   // não o alcança): a página travada num laço segurava a rota, e o fim, para sempre; em 2 s, vale o mais estrito
   const RELATO = /^(nel|report-to|reporting-endpoints|attribution-reporting-.*)$/;   // o navegador manda por fora
   const INSEGURO = /[\x00-\x08\x0a-\x1f"():<>?@[\\\]{}\x7f]/;   // byte que o Fetch não aceita em cabeçalho simples
   const SIMPLES = (k, v, tipo) => Buffer.byteLength(v) <= 128 && (k === 'accept' ? !INSEGURO.test(v)
     : ['accept-language', 'content-language'].includes(k) ? /^[0-9A-Za-z *,.;=-]*$/.test(v)
     : k === 'content-type' ? !INSEGURO.test(v)
       && ['text/plain', 'multipart/form-data', 'application/x-www-form-urlencoded'].includes(tipo)
     : k === 'range' ? (r => !!r && (!r[2] || BigInt(r[1]) <= BigInt(r[2])))(/^bytes=(\d+)-(\d*)$/.exec(v))
     : k === 'save-data' ? /^on$/i.test(v) : k === 'ect' ? /^(slow-2g|2g|3g|4g)$/.test(v)   // a dica de cliente que o
     : ['dpr', 'device-memory', 'downlink'].includes(k) ? /^\d+(\.\d+)?$/.test(v)   // Chromium põe também vai sem
     : ['width', 'viewport-width', 'rtt'].includes(k) ? /^\d+$/.test(v)   // pergunta, com o número que ele aceita
     : k === 'intervention');                        // e o Intervention, de todo valor (o Chromium 141 manda sem pergunta)
   // a lista simples do Fetch: 128 bytes para todos; o Range invertido (bytes=10-2) pergunta antes, como no navegador,
   // comparado em BigInt: em Number, dois números de 19 dígitos diferentes saem iguais
   const ABERTO = new Map(), DELE = new WeakMap();   // resposta → o contexto só dela, fechado junto (SOLTA); pedido da
   const BUSCA = async (url, op, q) => {             // página → as buscas dele no ar, que fecham quando ela desiste (e o
     const c = await browser.newContext(PELA(url));  // navegador não manda o que ainda não saiu: medido, aperto de mão
     if (q && CAIU.has(q)) { await c.close().catch(() => {}); return null; }   // lento). Contexto novo por busca: o
     const l = q && (DELE.get(q) ?? DELE.set(q, new Set()).get(q)); l?.add(c);   // Set-Cookie de uma não vai a outra,
     const r = await c.request.fetch(url, { maxRedirects: 0, timeout: MAX_MS, ...op }).catch(() => null); l?.delete(c);
     if (r) ABERTO.set(r, c); else await c.close().catch(() => {}); return r; };   // e o Cookie só sai se a página
   // mandou (medido: o vazio chegava)
   const SOLTA = async r => { if (!r) return; await r.dispose().catch(() => {});
     await ABERTO.get(r)?.close().catch(() => {}); ABERTO.delete(r); };
   const PROIBIDO = new RegExp('^(sec-|proxy-)|^(accept-charset|accept-encoding|access-control-request-(headers|method)'
     + '|connection|content-length|cookie2?|date|dnt|expect|host|keep-alive|origin|referer|set-cookie|te|trailer'
     + '|transfer-encoding|upgrade|via|user-agent)$');   // os que só o navegador põe (a lista proibida do Fetch e o UA)
   const GUARDA = new Map();                         // a resposta da pergunta, guardada pelo tempo que ela diz (o
   const PREFLIGHT = async (q, m, cred, de, e, h) => {   // o Playwright finge o preflight (medido): este vai à rota
     const tipo = (h['content-type'] ?? '').split(';')[0].trim().toLowerCase();   // com os cabeçalhos que a BUSCA manda
     const ks = Object.keys(h).filter(k => !PROIBIDO.test(k)), so = ks.filter(k => SIMPLES(k, h[k], tipo));   // (o
     const meus = (so.reduce((n, k) => n + Buffer.byteLength(h[k]), 0) > 1024 ? ks : ks.filter(k => !so.includes(k)))
       .sort();                                        // allHeaders); os simples que passam de 1024 bytes somados
     const sobe = q.resourceType() === 'xhr' && !!q.postDataBuffer() && e?.upload !== false;   // perguntam todos; o
     if (['GET', 'HEAD', 'POST'].includes(m) && !meus.length && !sobe) return true;   // Chromium pergunta no XHR com
     const vale = (met, cab) => (['GET', 'HEAD', 'POST'].includes(m) || met.includes(m)   // corpo e ouvinte de upload
       || (!cred && met.includes('*'))) && meus.every(k => cab.includes(k)   // (medido), que o route não vê: sem o
       || (!cred && cab.includes('*') && k !== 'authorization'));   // upload: false, pergunta. O método na caixa
     const topo = ORIGEM(q.frame().page().mainFrame()), chave = topo === 'null' || q.url().length >= 1024 ? ''
       : `${topo}\n${de}\n${q.url()}`, g = GUARDA.get(chave);   // exata (o navegador recusa o put); o * não cobre o
     if (g && g.ate > Date.now() && (!cred || g.cred) && vale(g.met, g.cab)) return true;   // Authorization
     GUARDA.delete(chave);                           // a vencida ou que não basta sai, como no Chromium (medido)
     const p = await BUSCA(q.url(), { method: 'OPTIONS', headers: { origin: de,   // Max-Age, 5 s sem ele, até 2 h),
       'access-control-request-method': m, ...(meus.length && { 'access-control-request-headers': meus.join() }) } }, q);
     if (!p && CAIU.has(q)) return null;             // a página desistiu no meio da pergunta: nem ela nem o pedido
     const lista = (k, caixa) => (p?.headers()[k] ?? '').split(',').map(s => s.trim())   // uma por origem e endereço,
       .map(s => caixa ? s : s.toLowerCase()).filter(Boolean);   // com o que ela liberou e trocada pela última, como
     const met = lista('access-control-allow-methods', true), cab = lista('access-control-allow-headers');   // no
     const ok = !!p && p.status() >= 200 && p.status() < 300 && LIBERA(p, cred, de)   // Chromium
       && [...met, ...cab].every(x => /^[!#$%&'*+.^`|~\w-]+$/.test(x)) && vale(met, cab);   // (medido:
     const ma = (p?.headers()['access-control-max-age'] ?? '').trim(), b = /^[-+]?\d+$/.test(ma) ? BigInt(ma) : null;
     const s = b === null || b >= 2n ** 63n || b < -(2n ** 63n) ? 5 : b < 0n ? 0 : Number(b < 7200n ? b : 7200n);
     if (ok && s > 0 && chave) GUARDA.set(chave, { ate: Date.now() + 1000 * s, met, cab,   // PUT, DELETE,
       cred });                                      // PATCH e PUT perguntaram no 1º PUT, no
     await SOLTA(p); return ok;                      // PATCH e no 2º PUT); o Max-Age que não é número vale os 5 s. A
   };                                                // pergunta vai sem Cookie, como a do navegador; e vale pelo modo do
   // pedido que a fez, não pelo Allow-Credentials: a feita sem credencial não serve à que leva (o Chromium pergunta de
   // novo, medido); a lista com um membro que não é palavra do HTTP (PUT, bad method) reprova inteira, e o Max-Age
   // negativo vale 0, sem guardar, e o que passa do int64 vale os 5 s, como no Chromium (medido nos dois); a guarda é
   // também por origem de cima (o Chromium separa por site de cima: medido), e o endereço de 1024 bytes ou mais não
   // se guarda, como no preflight_cache.cc dele (medido)
   const E = process.env, PROXY = E.HTTPS_PROXY || E.https_proxy || E.ALL_PROXY || E.all_proxy;   // a nuvem do Claude
   const FORA = E.NO_PROXY || E.no_proxy;            // Code sai por ele: sem ele, a busca não acha host de fora
   let PELA = () => ({});                            // (medido); a variável vazia passa à próxima; a senha vai no campo
   const IP4 = s => { const p = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);   // quatro números, até 255
     return p && p.slice(1).every(n => +n < 256) ? p.slice(1).reduce((a, b) => a * 256 + +b, 0) : NaN; };
   const REGRA = s => {                              // uma entrada do NO_PROXY, como o Chromium da página a lê; a busca
     if (s === '*') return () => true;               // só compara o fim do nome, e *, porta e faixa não valiam (medido)
     const c = /^([\d.]+)\/(\d+)$/.exec(s);           // faixa IPv4 (10.0.0.0/8): só endereço escrito em número; a
     if (c && (Number.isNaN(IP4(c[1])) || +c[2] > 32))   // que o Chromium não lê (1.999.0.0/8, /33) ele ignora e a
       throw new Error('NO_PROXY com faixa IPv4 inválida');   // página vai pelo proxy; a conta daqui a mandava direto
     if (c) { const n = 2 ** (32 - c[2]); return x => Math.floor(IP4(x.h) / n) === Math.floor(IP4(c[1]) / n); }
     if (/[/<]/.test(s)) throw new Error('NO_PROXY com esquema, <local> ou faixa IPv6: a busca não sabe seguir');
     if (s.split(':').length > 2 && s[0] !== '[') return () => false;   // IPv6 sem colchetes: o Chromium ignora
     const [, h, p] = /^\[(.+)\](?::(\d+))?$/.exec(s) ?? /^([^:]*)(?::(\d+))?$/.exec(s);   // host, porta
     let v6; try { v6 = h.includes(':') && new URL(`http://[${h}]`).hostname; }   // o erro do URL traz a entrada
     catch { throw new Error('NO_PROXY com IPv6 mal escrito'); }
     let n4 = ''; if (/^[\da-fx.]+$/i.test(h)) try { n4 = new URL(`http://${h}`).hostname; } catch {}
     const ip = v6 || (IP4(n4) >= 0 && n4);          // IP escrito (127.1 e 0x7f.0.0.1 também): só ele, sem curinga
     const g = new RegExp(`^${(h[0] === '*' ? h : `*${h}`)   // a de nome casa pelo fim, como o Chromium do Linux lê a
       .toLowerCase().replace(/[.+^$()|{}\\[\]]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);   // variável:
     return x => (ip ? x.h === ip : g.test(x.h)) && (!p || +p === x.p); };   // exemplo.com casa api.exemplo.com e
   // outroexemplo.com (o * na frente, no código dele)
   if (PROXY) {                                      // sem esquema (proxy:3128) vale http://, como no Playwright
     let so; try { const PX = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(PROXY) ? PROXY : `http://${PROXY}`);
       so = { server: `${PX.protocol}//${PX.host}`, username: decodeURIComponent(PX.username),
         password: decodeURIComponent(PX.password) };
     } catch { throw new Error('HTTPS_PROXY/ALL_PROXY mal escrito'); }   // sem o valor: o erro do URL traz a senha
     const R = (FORA ?? '').split(/[,;]/).map(s => s.trim()).filter(Boolean).map(REGRA);   // a página lê a lista, com ,
     const PERTO = ({ h }) => /^(.+\.)?localhost\.?$/i.test(h) || (n => n >= 0 && (Math.floor(n / 2 ** 24) === 127
       || Math.floor(n / 2 ** 16) === 43518))(IP4(h)) || (g => !!g && (g.slice(0, 7).every(v => !v) && g[7] === 1
       || (g[0] & 65472) === 65152 || g.slice(0, 5).every(v => !v) && g[5] === 65535
       && (g[6] >> 8 === 127 || g[6] === 43518)))(V6(h));   // ou ; (medido); e o que o Chromium manda direto sem estar
     PELA = u => { const x = new URL(u), y = { h: x.hostname, p: +(x.port || (x.protocol === 'https:' ? 443 : 80)) };
       return PERTO(y) || R.some(f => f(y)) ? {} : { proxy: so }; };   // nela: localhost e *.localhost, 127/8, [::1],
   }                                                 // 169.254/16, [fe80::]/10 e o ::ffff: de 127 e 169.254 (medido);
   // a busca, por esta lista e por esse desvio: direto, ou pelo proxy sem lista nenhuma
   const { lookup } = await import('node:dns/promises'), VISTO = new Map();   // conta o nome que vai à rede local
   const LOCAL = s => { let x; try { x = new URL(s); } catch { return false; }   // (a origem opaca, null, não é);
     if (REDE(x.hostname)) return true; if (V6(x.hostname) || PELA(x.href).proxy) return false;   // o Chromium
     const h = x.hostname; if (!VISTO.has(h)) VISTO.set(h, lookup(h, { all: true })   // decide pelo endereço; o
       .then(l => l.some(a => REDE(a.family === 6 ? `[${a.address}]` : a.address)), () => true));   // IPv6 escrito já
     return VISTO.get(h); };                         // se decidiu pelo número (o DNS não lê colchetes: ENOTFOUND,
   // medido, e contava como local); pelo proxy, quem resolve é ele, e o bloco não vê (nem o DNS que muda entre esta
   // conta e a busca); o
   const DONO = (s, u) => { try { const h = new URL(s).hostname; return REDE(h, true)   // nome que não resolve conta
       || h === new URL(u).hostname && (IP4(h) >= 0 || !!V6(h)); } catch { return false; } };   // como local, e quem
   // chama só é local escrito como tal, sem DNS: o nome dele não abre a rede local; o mesmo IP escrito dos dois lados é
   // o mesmo espaço (com as duas tabelas, a página em 192.0.2.2 se cortava a si mesma: medido)
   const { createServer } = await import('node:net');   // a porta fechada é nossa: numa fixa, outro programa podia
   const MORTO = createServer(s => s.destroy()).unref();   // estar ouvindo e encaminhar; esta derruba toda conexão
   await new Promise((ok, nao) => MORTO.once('error', nao).listen(0, '127.0.0.1', ok));
   const ctx = await browser.newContext({ serviceWorkers: 'block',   // antes da página; ela não fala com rede nenhuma:
     proxy: { server: `http://127.0.0.1:${MORTO.address().port}` } }).catch(x => { MORTO.close(); throw x; });
   // tudo passa pela busca, e o que o Chromium abre por fora do route (a pré-conexão à origem da página, medida no
   // netlog) bate nesta porta, que não responde
   if (typeof ctx.routeWebSocket !== 'function') {   // sem ele, nenhum corte de WebSocket: para aqui
     await ctx.close(); MORTO.close(); throw new Error('Playwright < 1.48: sem como cortar WebSocket'); }
   const CAIU = new WeakSet();                       // o pedido que a página desistiu (AbortController) enquanto a
   ctx.on('requestfailed', q => { CAIU.add(q);       // pergunta ou a busca corria: o navegador não manda o resto, e a
     for (const c of DELE.get(q) ?? []) c.close().catch(() => {}); });   // busca no ar fecha junto (medido)
   let passo = 'preparar o contexto', ERRO = null;   // o teste troca antes de cada ação: passo = 'clicar em Gerar'
   try {                                             // já no preparo: se ele falha, o finally fecha o contexto
     ctx.setDefaultTimeout(MAX_MS);                  // navegação e espera com o prazo da rota, não os 30 s do padrão
     await ctx.addInitScript(() => {                  // o tráfego destes não passa pelo route (o do worker, medido)
       for (const k of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'WebTransport', 'Worker', 'SharedWorker'])
         Object.defineProperty(window, k, { value: undefined });
       const f = window.fetch, S = new Map(), T = x => Object.prototype.toString.call(x), PR = Promise;
       Object.defineProperty(window, '__shsNoCors', { value: S });   // o modo do fetch não chega ao route (nem o
       const FL = Symbol.for('shs.fluxo'), Q = window.Request;   // Sec-Fetch-Mode, medido): todo fetch que pode ser
       const LE = (o, v) => o !== null && (typeof o === 'object' || typeof o === 'function') ? new Proxy(o, {   // no-cors
         get: (a, n) => { const x = Reflect.get(a, n); if (n === 'body') v(x); return x; } }) : o;   // fica anotado
       window.Request = new Proxy(Q, { construct: (A, g, n) => { let b; const c = [...g];   // aqui com o modo, do começo
         if (c.length > 1) c[1] = LE(c[1], x => { b = x; }); const r = Reflect.construct(A, c, n);   // até acabar; o
         if (b != null ? T(b) === '[object ReadableStream]' : g[0]?.[FL]) r[FL] = true; return r; } });   // corpo, lido
       const cl = Q.prototype.clone;                   // no init pelo construtor, uma vez só (o getter que muda a cada
       Q.prototype.clone = function () { const r = cl.call(this); if (this[FL]) r[FL] = true; return r; };   // leitura
       const NM = s => { const u = String(s).toUpperCase();   // daria um valor a nós e outro a ele). A cópia (clone, new
         return ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'].includes(u) ? u : String(s); };   // Request(r)) leva
       const PO = (k, x) => S.set(k, [...(S.get(k) ?? []), x]);   // o corpo em fluxo junto; o método, como o navegador
       const TIRA = (k, x) => { const l = (S.get(k) ?? []).filter(y => y !== x);   // o manda: só os seis do padrão
         if (l.length) S.set(k, l); else S.delete(k); };   // sobem. Cada anotação sai quando o próprio pedido acaba
       window.fetch = function (i, o) {                // (o route só lê), e o endereço sem nenhum no ar sai do mapa. O
         if (!arguments.length) return f.apply(this, arguments);   // pedido é montado aqui, uma vez, pelo construtor de
         let R, b, k, x; try { R = new Q(i, LE(o, v => { b = v; })); } catch (y) { return PR.reject(y); }   // verdade, e é
         try { k = `${R.method} ${R.url.split('#')[0]}`;   // esse mesmo que vai ao fetch: cada campo do init é lido uma
           x = { nc: R.mode === 'no-cors', fl: b != null ? T(b) === '[object ReadableStream]' : !!i?.[FL],   // vez, como
             cr: R.credentials === 'include', rd: R.redirect === 'manual' }; PO(k, x); } catch {}   // no fetch puro
         const p = f.call(this, R);                    // (medido: o método que muda na 2ª leitura saía PUT aqui e GET
         if (x) p.catch(() => {}).finally(() => TIRA(k, x));   // lá); o erro do construtor rejeita como o do fetch. O
         return p; };                                  // corpo em fluxo o route não vê, nem a credencial sem cookie a
       const X = XMLHttpRequest.prototype, ab = X.open, ev = X.send, K = Symbol('shs.xhr');   // mandar, nem o
       // redirect: 'manual': ficam anotados; o XHR com
       const WC = Object.getOwnPropertyDescriptor(X, 'withCredentials').get;   // withCredentials também, lido de dentro
       X.open = function () { const a = [...arguments];   // (a propriedade posta na instância mente: medido), e o
         if (a.length > 1) { a[0] = `${a[0]}`; a[1] = `${a[1]}`; this[K] = null;   // método e o endereço viram texto
           try { this[K] = `${NM(a[0])} ${new URL(a[1], document.baseURI).href.split('#')[0]}`; } catch {} }   // uma vez,
         return ab.apply(this, a); };                  // e o mesmo texto vai ao open
       X.send = function () { const k = this[K]; let w = false; try { w = WC.call(this); } catch {}
         if (k && w) { const x = { cr: true }; PO(k, x);
           this.addEventListener('loadend', () => TIRA(k, x), { once: true }); }
         return ev.apply(this, arguments); }; });
     const ROTA = async r => {                       // passa só o que o caminho precisa; todo o resto aborta
       const q = r.request(), t = q.resourceType();
       let marca = 'erro ', m = '?', o = '', u = '', c = '', resp = null, e, repetido = false;
       if (FECHADO) {                                  // o teste acabou: nada sai; reprova o que não está previsto nem
         let i = -1;                                   // cabe na entrada dele (o corpo e as vezes de antes do fim), de
         try { u = N(q.url()); m = q.method(); o = new URL(u).origin; c = q.postData() ?? '';   // todo tipo — a página
           i = PASSA.findIndex(p => CASA(p, m, u, c, t));   // que navega depois da evidência, e o arquivo do build:
         } catch { u = ''; }                           // o pedaço que não roda esconderia o que ele faria
         if (!PREV(u, m, c, t) && !(i >= 0 && VEZES[i] + ++TARDE[i] <= (PASSA[i].vezes ?? 1)))
           FALTOU.add(`depois ${MET(m)} ${t} ${QUEM(o)}`);
         return r.abort().catch(() => {});
       }
       try {                                           // erro aqui aborta calado: o do JSON.parse traz o corpo (medido)
         u = N(q.url()); c = q.postData() ?? ''; const h = await q.allHeaders(); m = q.method(); o = new URL(u).origin;
         const i = PASSA.findIndex(p => CASA(p, m, u, c, t));
         e = PASSA[i]; const pagina = m === 'GET' && t === 'document' && u === PAGINA;
         const est = !pagina && !e && m === 'GET' && ESTATICO.some(p => u.startsWith(p));   // nova tentativa, recarga
         repetido = (e && ++VEZES[i] > (e.vezes ?? 1)) || (pagina && ++VISITAS > 1)
           || (est && (EST.has(u) || EST.size >= ESTATICO_MAX || !EST.add(u)));
         const vai = (pagina || est || !!e) && !repetido, escreve = vai && PROD && !['GET', 'HEAD'].includes(m);
         const ok = vai && !escreve;                   // em produção nada além de GET e HEAD sai, nem o da lista
         const de = h.origin ?? (t === 'fetch' ? ORIGEM(q.frame()) : undefined);   // a do documento
         const ct = h['content-type'], tp = (ct ?? '').split(';')[0].trim().toLowerCase();
         const [nc0, fl, cr, rd] = t === 'fetch' || t === 'xhr' ? await PRAZO(q.frame().evaluate(k => {
           const l = window.__shsNoCors?.get(k) ?? [];
           return [!!l.length && l.every(x => x.nc), l.some(x => x.fl), l.some(x => x.cr),
             !!l.length && l.every(x => x.rd)];
         }, `${m} ${u}`), [false, true, true, false]) : [false, false, false, false];   // sem a anotação, o mais estrito
         const nc = !!nc0 && ['GET', 'HEAD', 'POST'].includes(m) && Object.keys(h).every(k => PROIBIDO.test(k)
           || ['accept', 'accept-language', 'content-language', 'content-type'].includes(k) && SIMPLES(k, h[k], tp));
         // a anotação vem da página, que pode forjá-la: o no-cors só vale no pedido que o no-cors deixa existir (o
         // PUT e o cabeçalho próprio marcados no-cors perguntam antes, como no navegador: medido)
         const cred = !!h.cookie || cr || e?.cred === 'include' || t === 'ping';   // com credenciais (o sendBeacon
         // sempre as leva), o Allow-Origin * não vale
         const opaca = t === 'ping' ? !!h['ping-to'] || !ct || SIMPLES('content-type', ct, tp)
           : t === 'fetch' && nc;                      // o <a ping> (text/ping, com Ping-To) e o sendBeacon de tipo
         // simples (texto, formulário) vão no-cors, como no navegador (medido: o <a ping> manda o POST com cookie e sem
         // pergunta); o fetch, só quando todo fetch no ar neste endereço é no-cors: com um cors junto, não se sabe qual
         // dos dois é este, e vale o mais estrito
         const fora = !!de && o !== de && t !== 'document' && !opaca;   // CORS a quem chamou; o no-cors, sem pergunta
         const fluxo = t === 'eventsource' || fl;      // a busca espera o fim do corpo, e o fluxo aberto não acaba; o
         // corpo em fluxo (ReadableStream) não chega ao route, e o navegador pergunta antes dele (medido)
         const local = ok && await LOCAL(u) && !DONO(CHAMA(q, t, de), u);   // da internet à rede local: o
         // Chrome pede licença à pessoa antes (Local Network Access); a busca não pede. Só o que vai passar: o nome do
         // que aborta não vai ao DNS (medido: o pixel de fora da lista ia)
         const semtipo = !!q.postDataBuffer()?.length && !h['content-type'];   // corpo sem tipo: a busca poria o
         // application/octet-stream, que o navegador não manda (medido)
         const cors = ok && !fluxo && !local && !semtipo && fora && (await PREFLIGHT(q, m, cred, de, e, h)) === false;
         marca = repetido ? 'repetido ' : escreve ? 'producao ' : fluxo && ok ? 'fluxo ' : local && ok ? 'rede local '
           : semtipo && ok ? 'sem tipo ' : cors ? 'cors ' : ok && CAIU.has(q) ? 'desistiu ' : '';   // (medido): para
         // na hora; nem Allow-Origin, chega opaca, como no navegador; sem o sim do preflight, nada sai
         if (ok && !marca) {
           resp = await BUSCA(q.url(), { method: m, headers: h, data: q.postDataBuffer() ?? undefined }, q);
           if (!resp) marca = CAIU.has(q) ? 'desistiu ' : 'falhou ';   // desistiu no meio: a busca caiu junto
           else if ([301, 302, 303, 307, 308].includes(resp.status()) && !(t === 'fetch' && rd)) marca = '3xx ';   // o
           // route só vê o 1º endereço; o fetch em que todo pedido no ar é redirect: 'manual' recebe o 3xx como veio, e
           // o navegador não o segue (opaqueredirect: medido, o destino não é pedido)
           else if (pagina && resp.status() !== ESPERA) { marca = 'status '; VEIO = resp.status(); }   // nem roda
           else if (fora && !LIBERA(resp, cred, de)) marca = 'cors ';   // o navegador não entregaria a resposta
           else {                                       // chega como chegaria; fora do status, reprova no fim
             const certo = e ? (e.status ?? (s => s < 400))(resp.status())
               && (!e.resposta || e.resposta(await resp.text()) === true)   // 200 com o erro no corpo também reprova,
               : pagina || resp.status() < 400;           // e o arquivo do build que falha: a tela vem sem o script
             if (!certo) RUIM.push(`${MET(m)} ${resp.status()}${e?.resposta ? ' ou a resposta' : ''} ${t} ${QUEM(o)}`);
             const cab = resp.headers(), rel = Object.keys(cab).filter(k => RELATO.test(k));
             for (const k of rel) delete cab[k];      // sem endpoint de relatório nem registro de conversão: o envio
             // deles não passa pelo route
             await r.fulfill(rel.length ? { response: resp, headers: cab } : { response: resp });
             return await SOLTA(resp);
           }
         }
         if (marca === 'desistiu ' && e) VEZES[i]--;   // a da lista de que a página desistiu não houve: reprova no fim
       } catch { marca = 'erro '; }
       await SOLTA(resp);
       const linha = `${marca}${MET(m)} ${t} ${QUEM(o)}`;   // sem caminho; num Set, a página que tenta sem parar não enche
       CORTADO.add(linha);                             // a memória. Todo corte fora do PREVISTO reprova, de todo tipo: a
       if (!PREV(u, m, c, t) && marca !== 'desistiu ') FALTOU.add(linha);   // a imagem nova do analytics, a da
       // lista repetida ou a que não
       return r.abort().catch(() => {});               // chegou à página (o script de outra origem que redireciona)
     };
     await ctx.route('**/*', r => { const v = ROTA(r); VOO.add(v); return v.finally(() => VOO.delete(v)); });
     await ctx.routeWebSocket(/.*/, ws => {           // nenhum WebSocket abre: gravação de sessão vai por ele; o que a
       const w = new URL(ws.url().replace(/^ws/, 'http')).origin;   // página abre sem estar previsto reprova, como a
       if (!PREV(ws.url(), 'GET', '', 'websocket')) FALTOU.add(`websocket ${QUEM(w)}`); ws.close(); });   // chamada
     passo = 'abrir a página';
     const page = await ctx.newPage();
     const doc = await page.goto(ALVO).catch(x => { if (VEIO) passo += ` (veio ${VEIO})`; throw x; });   // abortada
     if (doc?.status() !== ESPERA) { passo += ` (veio ${doc?.status()})`; throw new Error(); }
     // … o teste e a evidência …
     FECHADO = true; await Promise.allSettled([...VOO]);   // as que já estavam no ar, cada uma com o prazo dela
     await new Promise(f => setTimeout(f, FOLGA));   // a chamada que a resposta delas dispara chega aqui, e conta
     const NAO = PASSA.flatMap((p, i) => !p.opcional && VEZES[i] === 0   // a que só veio depois do fim foi cortada:
       ? [`${MET(p.m)} da entrada ${i}${TARDE[i] ? ' (só depois do fim)' : ''}`] : []);   // a evidência veio antes dela
     if (NAO.length) { passo = `conferir as chamadas (não houve: ${NAO.join(', ')})`; throw new Error(); }
     if (FALTOU.size) { passo = `conferir o que foi cortado (${[...FALTOU].slice(0, 10).join(', ')})`;
       throw new Error(); }                            // a tela pode mostrar sucesso sem a chamada que faltou
     if (RUIM.length) { passo = `conferir as chamadas (${RUIM.join(', ')})`; throw new Error(); }   // a tela mente
   } catch (e) {                                     // a mensagem do erro traz URL e texto da página: sai só o passo
     const c = [...CORTADO].slice(0, 10).join(', ');   // e o que foi cortado, que não tem caminho nem host
     const nome = ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'TimeoutError', 'AbortError']
       .includes(e?.name) ? e.name : 'outro';          // o nome do erro é texto que a página escolhe: só os conhecidos
     throw (ERRO = new Error(`falhou em ${passo} (${nome})` + (c ? ` · cortado: ${c}` : '')));
   }                                                 // fecha também na falha; antes do adiado e do apagar (passo 4),
   finally {                                         // mas só depois das que estão no ar: fechar com uma no meio fez o
     FECHADO = true; const sem = await PRAZO(ctx.setOffline(true).then(() => true, () => false), false);   // a pausada
     if (!sem) { FALTOU.add('rede ligada no fim'); if (ERRO) ERRO.message += ' · rede ligada no fim'; }   // que o route
     do { while (VOO.size) await Promise.allSettled([...VOO]);   // ainda não viu, o fechar a soltava na rede (medido; o
       // setOffline também tem os 2 s: com a página travada, levava 40 s e falhava, medido); sem rede,
       if (!sem) await new Promise(f => setTimeout(f, 500));   // ela falha; com a rede ligada, espera ela chegar ao
     } while (VOO.size);                               // route (que, fechado, aborta) e só então fecha — e reprova
     await Promise.allSettled([ctx, ...ABERTO.values()].map(c => c.close()));   // um não segura o outro
     MORTO.close();
   }                                                 // a de dados que chegou enquanto fechava também reprova
   if (FALTOU.size) throw new Error(`falhou em conferir o fim (${[...FALTOU].slice(0, 10).join(', ')})`);
   ```

3. **Mesmas travas do humano.** Nada irreversível — apagar ao fim o que esta checagem criou, achado pelo código dela
   (passo 4), é o recolhimento e não conta; apagar ou mudar o que já existia, nunca · nada de dinheiro fora do teto
   (US$ 0,50 por checagem, US$ 2,00 por dia em cada chat — não há contador comum entre chats; acima, pergunta com o
   número) · nada na Meta (`chave-meta-acesso-total`) · nada a pessoa de fora da casa (e-mail, WhatsApp, DM, lista de
   parceiro) · nada publicado · nada em conta de cliente · nada que amplie o alcance do agente (`execucao-remota`
   §exceção). Prévia por padrão; produção quando a pergunta é sobre produção, e aí só leitura, pelo caminho da persona
   (passo 2, decisão 1-A). Escrita em banco, em nenhum (decisão 2-A): o caminho que grava é fronteira; e o
   navegador só abre página da casa (decisão 4-C).
4. **Dado de teste marcado e recolhido.** Código de 6 caracteres gerado na checagem (`openssl rand -hex 3`), dito no
   chat antes da primeira escrita — checagem interrompida no meio ainda deixa no histórico o código para apagar — e
   anotado na `🧪`, presente em toda linha que ela cria — é por ele que se apaga, e por isso toda marca o leva:
   `criado_por = 'shs-<código>'` · nome/tema/título com prefixo `[shs] <código>` · lead com e-mail
   `shs+AAAA-MM-DD-<código>@alma-petra.test` · UTM `utm_source=shs&utm_content=<código>`; marca sem o código (`'shs'`
   sozinho) não acha a linha desta checagem sem pegar a de outra.
   **Nada disto vale para banco: ali não se grava (decisão 2-A).** Para o que a checagem cria fora dele, **antes de escrever, confirmar que dá para recolher tudo o que o caminho grava** — inclusive telemetria e
   métrica interna (`agent_metrics`, eventos), que costuma ir sem a marca nem a sessão — (apagar a linha, desfazer a
   transação), e qual sinal mostra que a gravação adiada desta checagem terminou — sinal dela, achado pelo código: a
   linha adiada com o código gravada, o job dela concluído; fila vazia não basta, porque o job pode já ter saído da fila
   e ainda estar rodando, ou nem ter entrado —, o limite que a plataforma impõe e que encerra a gravação que passa dele
   (o `maxDuration` da função, que mata o `after()` junto; o prazo de vida do job que não tenta de novo) — o prazo é
   esse limite, nunca uma estimativa, porque o lento que passa da estimativa ainda grava —, e como se vê que a gravação
   falhou (o job com erro, o que foi para a fila de mortos) sem nova tentativa depois, e o que o próprio apagar dispara
   (gatilho de `delete` que avisa fora do banco faz do recolhimento um envio). Não dá — log imutável, fila que se
   consome, envio a terceiro, gravação sem como achar pelo código, número tirado de sequência, contador ou cota que a
   chamada gasta e que não volta sozinho quando a linha sai (as vagas do dia: devolvê-las mexeria num contador que já
   existia), gravação adiada sem sinal de término, sem limite que a encerre ou com nova tentativa depois da falha (fila
   que reprocessa, webhook que pode chegar horas depois, job que tenta de novo depois do recolhimento) — → fronteira. Ao fim, com o navegador
   já fechado, esperar o
   que o fluxo grava depois da resposta (`after()`, fila, webhook — no quiz-diagnosys, o `quiz_leituras` entra depois do
   `/api/quiz/score` responder) até o sinal de término que se viu antes — a linha adiada já gravada com o código, o job
   desta checagem concluído (fila vazia não basta); apagar sem ele pode vir antes da última gravação; falhou, ou passou
   o limite sem sinal — e aí a plataforma já a encerrou —, apaga-se do mesmo jeito e o veredito diz que a gravação
   adiada não terminou; linha com o código que apareça depois disso é dado de teste sem recolher (F-SHS-2), porque o
   limite não era o que se leu —, apagar só as linhas com o código desta checagem (o filtro do `delete` é o código,
   nunca só a marca `shs`, que outra checagem pode estar usando agora), e reconferir todas as linhas com esse código
   antes de dizer que recolheu.
5. **Relatar na seção `🧪 Checagem sintética`** (modelo no §4) — persona · caminho · evidência · veredito · dado de
   teste recolhido · custo. A seção vem **antes** do `✅ Resumo simples`, e o `🧭 Passo a passo` perde o passo
   "confira".
6. **Fronteira, se sobrar.** Só quatro motivos justificam pedir ao Lucas: credencial ou sessão só dele (login no
   navegador, celular, QR, 2FA) · ação que a regra reserva a ele: gasto acima do teto — com o "sim" dele a checagem
   segue — e Meta, ação irreversível ou mensagem a pessoa de fora — aí a checagem para, mesmo com o "sim": isso não é
   passo de checagem, e se ele quiser a ação ela sai da SHS e segue a regra dela (`chave-meta-acesso-total` e afins),
   nunca delegada pela `execucao-remota` como parte da checagem · juízo humano (gosto, voz, decisão de negócio) · alcance: o ambiente desta sessão não chega lá
   (rede, IP, ferramenta que falta) e outro chega, sem alargar o alcance do agente. Mesmo assim: ir até a borda e
   escrever `fronteira: fiz até X; falta só o seu clique em Y, porque Z` — um passo, com link. Depois da fronteira,
   `execucao-remota` (prompt para quem alcança).

## 4. Modelo da seção
```
## 🧪 Checagem sintética
- **Persona · caminho:** Lucas no painel da Casa Magna → aba Roteiros → "Gerar" (POST /api/casas/magna/roteiros), prévia
  isolada do PR — em produção a checagem não grava (decisão 1-A), e a geração gastaria uma das 20 vagas do dia.
- **Evidência:** 201 em 6,8 s; corpo com os 5 blocos (gancho, dor, virada, evidencia, cta); linha `casas_roteiros`
  id `…` status `rascunho`, tema `[shs] a3f9c1 teste pós-merge #1664`; contador do dia da prévia 1/20.
- **Veredito:** passa na prévia — a reserva atômica funciona; nenhum 503. A produção não foi provada.
- **Dado de teste:** código `a3f9c1`; linha apagada (`delete … where tema like '[shs] a3f9c1 %'`), nenhuma sobrando; custo US$ 0,03.
```
Falhou? A seção mostra o erro medido (status e código de erro, nunca a mensagem livre) e o diagnóstico começa na mesma resposta — a falha é da sessão
resolver, não do Lucas reportar.

## 5. Personas da casa (ponto de partida; a sessão descobre o caminho no repositório, nunca inventa URL)
| Persona | Caminho típico | Credencial | Marca do dado |
|---|---|---|---|
| Lucas no painel de uma casa / CRM | tela estática gerada (`npm run tela:casas`), rotas `/api/casas/*` | a mesma chave do painel (variável do ambiente); o que grava, só na prévia | tema `[shs] <código>`, `criado_por='shs-<código>'` |
| Visitante de página pública / VSL | URL de `vigia/dominios.txt` do hub (caminho no passo 2) ou prévia da Vercel | nenhuma | — (só leitura) |
| Lead terminando um quiz | **fronteira** (decisão 2-A: o fluxo grava em banco) — a sessão lê no código e roda os testes do repositório; em produção, só a página pública. Por quê, além disso: no quiz-diagnosys o `/api/quiz/score` também grava `agent_metrics` e um evento Koinonia do `composite-scorer` depois da resposta, sem sessão nem marca, e isso em produção não se recolhe | nenhuma (anon) | e-mail `shs+data-<código>@alma-petra.test`; apagar lead e leitura ao fim; parceiro de destino **não** recebe (`nossa-base-e-a-fonte`): prévia isolada (conferida antes), ou supressão só do lead `shs` pelo marcador, se o fluxo já tiver — **nunca** desligar o envio compartilhado (lead real chegando no meio se perderia) |
| Membro logado / área restrita | **fronteira** — o login grava a sessão (decisão 2-A); só o público | só se já existir; nunca criar conta em sistema de terceiro | — |
| Codex / outra CLI lendo regra | no hub (`../Lucas-Contexto-Geral` ou um clone dele) **com os irmãos clonados ao lado dele**: `node scripts/sync-rules.mjs --check`, `bash scripts/rules-drift.sh`; sem os irmãos ao lado, vale o resultado da Action `rules-drift` do hub; num irmão esses scripts não existem — lá, `diff` do arquivo contra o do hub | — | — |

## 6. O que a SHS não faz
Não decide por ele (gosto, voz, negócio) · não aprova o que a regra manda ele aprovar · não entra em conta de cliente ·
não "testa" com dinheiro real acima do teto sem o "sim" do Lucas para aquele valor · não substitui o campo (`!mirofish` prediz, SHS confere, o campo mede).

## 7. Falsificador e medição
- **Sinal de que funciona:** resposta ao operador sem "confira/teste/me avise" ou com a fronteira nomeada. Não há
  contagem automática: `memoria/` guarda só resumos, e ninguém lê respostas de chat em lote. Quem mede é o F-SHS-1.
- **F-SHS-1:** duas checagens `🧪` dadas como "passa" que o Lucas depois achou quebradas no mesmo caminho → a evidência
  mínima sobe (print obrigatório em tela; linha do banco obrigatória em escrita) e o caso entra no histórico da regra.
- **F-SHS-2:** simulação que gastou acima do teto sem perguntar, mexeu na Meta, fez algo irreversível fora do
  recolhimento do passo 4, publicou, mexeu em conta de cliente, mandou mensagem a pessoa de fora, expôs credencial ou
  dado de cliente (no chat, no log, num print), deixou dado de teste sem recolher, disparou medição (pixel, analytics,
  conversão, gravação de sessão, aviso de erro) ou alargou o alcance do agente (rede, permissão, credencial) → erro
  classe A: linha nova em `docs/ops/SHS-QUARENTENA.md` no mesmo ato, num PR do hub com `SHS-QUARENTENA` no título (é por
  ele que as outras sessões acham a linha antes do merge; em repositório AIOX, quem abre o PR é o `@devops`, a quem a
  Constitution reserva o push e o PR: a sessão escreve a linha e delega a ele no mesmo ato), sem dado de ninguém
  (persona genérica e repositório, classe do erro, hashtag do chat — nunca nome de cliente, conta, e-mail, id ou o que
  vazou), e a história do caso no histórico da regra. A persona passa a exigir "sim" do Lucas por 30 dias — o passo 1 lê
  a lista antes de rodar; a linha só sai pela data.

*v1.3 · 2026-10-17 (decisões 2-A, nenhuma checagem grava em banco, e 4-AC, só página da casa; v1.2 em 16/10, decisão 1-A: o banco de produção só pela persona, e só leitura; v1.1 em 14/10, v1.0 em 13/10) · fonte única: `Lucas-Contexto-Geral/.claude/skills/simulacao-humana-sintetica/SKILL.md`,
no hub — nos irmãos este arquivo é cópia do `scripts/sync-rules.mjs` (3º canal) e não se edita lá · deploy no claude.ai
de cada conta Max: enviar esta pasta.*

🕒 2026-10-17 17:47 (São Paulo) · ✍ lucasscudeler · 💬 !! 18/10 · A75 · CANON SHS → aplicar 2-A/4-AC e plano de gasto do Actions · #chat-4BNJMe
