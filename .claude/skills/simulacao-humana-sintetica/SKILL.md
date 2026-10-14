---
name: simulacao-humana-sintetica
description: "!shs [alvo] · alias !simular — Simulação Humana Sintética: antes de pedir ao Lucas que confira, teste, abra ou gere algo 'e avise', a sessão vira o humano e faz a checagem no lugar dele — persona (ele no painel, o visitante, o lead), caminho real (HTTP, navegador sem tela, rota, banco, script) e o medido numa seção `🧪 Checagem sintética`. Mesmas travas do humano: nada irreversível (apagar o próprio dado de teste não conta); dinheiro só até US$ 0,50 por checagem e US$ 2,00 por dia em cada chat; nada na Meta, a pessoa de fora, publicado ou em conta de cliente; dado de teste marcado `shs` e recolhido. Só sobra pedido na fronteira dele (credencial/2FA, aprovação exigida por regra, juízo humano) ou quando o ambiente não alcança — um passo só, com o porquê. Ativar SEMPRE que a resposta for pedir checagem ao operador, em qualquer repositório e conta, e em !shs, !simular, 'simula o humano', 'checa antes de me pedir', 'testa você', 'simulação humana sintética'. Não é !mirofish (que prevê reação de público)."
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
   PRs do hub com `SHS-QUARENTENA` no título dos últimos 30 dias, de qualquer estado (aberto, mergeado ou fechado sem
   merge), cuja linha já vale antes do merge e não some se o PR fechar; sem como fazer essas duas leituras, pedir o
   "sim" também.
2. **Caminho real, na camada mais externa que alcança.** Os passos 3 e 4 valem antes deste: travas, teto, isolamento e
   recolhimento se conferem antes do primeiro clique ou requisição, nunca depois. Antes de qualquer caminho — navegador
   ou HTTP, prévia ou produção —, ler no código se a página, o middleware ou a rota manda evento pelo próprio servidor
   (API de Conversões da Meta, analytics no backend), que nenhum corte no navegador alcança: se manda, a checagem só
   roda numa prévia comprovadamente sem essas credenciais (as variáveis de ambiente dela não têm o token da API de
   Conversões nem o do analytics); sem essa prova, é fronteira. Ordem de preferência: (a) navegador sem tela sobre a
   URL (Playwright 1.48 ou mais novo, com o navegador que o ambiente já tem: na nuvem do Claude Code, `executablePath:
   '/opt/pw-browsers/chromium'`; fora dela, o que o próprio Playwright encontra): clique, formulário, texto na tela,
   print — sempre só do elemento do teste (recorte do `[shs]`), nunca a tela inteira, porque produção e prévia que lê
   banco real mostram dado de cliente, e o arquivo fora do repositório. Em toda checagem com navegador, prévia
   inclusive (que costuma carregar o mesmo pixel e o mesmo analytics da produção), o contexto nasce com
   `serviceWorkers: 'block'` e com uma lista do que pode passar, registrada antes de abrir qualquer página — o segundo
   bloco abaixo: do próprio domínio, só documento, estilo, script, imagem e fonte, por GET; e, de qualquer lugar, só as
   chamadas que o caminho testado faz (`PASSA` — método e endereço exatos, nunca prefixo nem host inteiro: `/api/quiz/`
   deixaria passar o `/api/quiz/analytics`, e o host do banco que serve o dado também recebe o aviso de erro do site);
   todo o resto aborta. Lista do que passa, e não do que se corta, porque a medição que ninguém listou é justamente a
   que escapa: o analytics que o próprio domínio recebe num caminho gerado a cada build, o aviso de erro que a página
   manda ao banco, o pixel novo. `context.route` pega abas novas e popups, que o `page.route` perde; o `routeWebSocket`
   fecha todo WebSocket (a gravação de sessão vai por ele, e o `route` não o vê), e o Playwright anterior ao 1.48 não o
   tem: aí o bloco para antes da primeira página. Chamada que a página faz sozinha e o caminho precisa (dado, navegação
   do app) entra em `PASSA`, com o método; o que quebrar por falta dela aparece no teste, que é o lado seguro. Antes,
   ler no código da página o que ela mede (o `layout`, as tags do `<head>`): medição servida do próprio domínio que
   conta só por carregar (pixel próprio, script que registra a visita no GET) vai para `MEDE`. Caminho que depende de
   service worker (offline, cache, API interceptada) não se prova com ele bloqueado; e o `route` desliga o cache HTTP
   do navegador, então o que só quebra com cache (o visitante que volta) também não se prova assim, e o veredito diz
   isso. Sem como cortar tudo — Playwright velho, service worker necessário, medição que não se acha —, só na prévia
   isolada; e, se a pergunta era sobre produção, o veredito diz que a produção não foi provada, em vez de usar a prévia
   como prova dela. A visita sintética não pode virar evento na Meta nem sujar a métrica da campanha ou do site. (b)
   HTTP na rota, com o primeiro bloco abaixo — `URL` recebe a rota da prévia ou da produção; `EXTRA` leva o método e os
   cabeçalhos quando a rota não é GET (um POST testado com GET dá 405 e reprova à toa), e `CORPO` leva o corpo, com o
   dado de teste marcado `shs`; `ESPERA` é o código que prova o caminho (200, 201; quando a checagem é a recusa —
   anônimo recebe 401, recurso apagado dá 404 —, é esse o código, e a condição do corpo passa a ser a da recusa, ou
   sai, e o código basta); credencial nunca vai escrita no comando, que fica no histórico da sessão, nem como argumento
   do `curl`, que outro processo da máquina lê (`ps`): URL assinada vem de variável já carregada no ambiente
   (`URL="$ROTA_ASSINADA"`), cabeçalho com chave também (`CAB="header = \"x-api-key: $CHAVE\""`, com aspas duplas, para
   o comando guardar o nome e não o valor), e os dois entram no `curl` pelo stdin (`-K -`), montados pelo `printf`, que
   é do próprio shell e não vira processo; o corpo, que pode levar senha ou token, vai por um arquivo temporário que só
   o dono lê (`--data-binary @arquivo`), nunca pela linha de comando; credencial que só existe como texto a colar é
   fronteira; `.status == "ok"` dá lugar à condição de sucesso daquela rota (o valor certo, não só o campo presente) —
   rota que não devolve JSON troca o `jq -e` por `grep -qF '[shs] <código>' "$f"` (HTML com o texto do teste) ou `[ !
   -s "$f" ]` (204, corpo vazio). O que cada peça evita: o `( … )` dá a cada checagem os seus arquivos e a sua limpeza,
   mesmo com várias no mesmo terminal; `-q`, que tem de vir primeiro, faz o `curl` ignorar o `.curlrc` da conta, que
   poderia religar o seguir-redirecionamento; `--globoff` faz o `curl` tomar `[` e `{` da URL como texto, e o erro dele
   vai para `/dev/null` — senão uma URL assinada com colchete sai inteira, token incluso, na mensagem de erro; do
   `curl` sai só o código de saída (`curl=7` sem conexão, `28` prazo estourado, `6` nome que não resolve, `63` ou `153`
   resposta maior que o limite); sem `-L`, redirecionamento não é seguido (o `curl` repetiria o cabeçalho de credencial
   para o outro endereço, e um POST viraria GET); comparar o código com `ESPERA` reprova todo o resto — 3xx, 4xx e 5xx
   —, mesmo com corpo `{"status":"ok"}`, e usa só o `-w '%{http_code}'`, que todo `curl` tem (o `--fail-with-body` só
   existe do 7.76 em diante); `--max-time "$MAX"` impede que uma rota travada prenda a checagem, com o prazo da própria
   rota (o `maxDuration` dela; sem ele, o padrão do projeto — na Vercel, 300 s, ou o que o painel do projeto definir,
   até 800 s, e o MCP da Vercel lê; sem como ler, 815) mais 15 s de folga para rede e partida a frio, para não reprovar
   rota lenta que está dentro do prazo; `--max-filesize` (no `curl` 8.4 em diante) e o `ulimit -f` (em qualquer versão,
   porque o antigo só confere o tamanho declarado) impedem que uma resposta enorme encha o disco; `jq -e` faz a
   condição falsa sair com erro (senão um `{}` ou um `{"status":"error"}` passaria); na falha, do corpo não sai nada —
   nem o código de erro, que pode ser token ou dado de cliente com cara de código —: sai só o status HTTP e o código do
   `curl`, e o diagnóstico segue pelo log do servidor — filtrado pela janela exata da chamada ou pelo código da
   checagem, e dele também só sai o campo fixo que prova (status, nome do erro), nunca a linha inteira, que pode trazer
   token e dado de cliente (no quiz-diagnosys, a rota de retomada registra o token cru). O corpo fica fora do
   repositório e fora do chat: dele sai só o campo que prova o caminho, nunca o corpo inteiro, que em painel ou
   produção pode trazer dado de cliente ou credencial. (c) leitura/escrita no banco (MCP do Supabase; `begin …
   rollback` numa única chamada do `execute_sql` — cada chamada é uma conexão própria, e `begin` numa com `rollback`
   noutra não desfaz nada —, nunca `raise exception` para desfazer em produção, que deixa um erro no log do banco e
   pode disparar alerta; prova o banco, não a rota: se a pergunta é sobre a rota, desfazer no banco não substitui
   chamá-la). (d) script do repositório (`npm run`, `scripts/*.sh`). Teste unitário **não** substitui (a)–(c): ele
   prova o código, não o caminho. Sites públicos da casa: `vigia/dominios.txt` do hub
   (`../Lucas-Contexto-Geral/vigia/dominios.txt` ou
   https://github.com/scudelerlucas/Lucas-Contexto-Geral/blob/main/vigia/dominios.txt); prévia do PR: o link da Vercel
   no próprio PR.

   ```bash
   URL='https://…/rota'   # a rota da prévia ou da produção; com credencial na URL: URL="$ROTA_ASSINADA" (nunca o valor)
   MAX=315                # prazo da rota (maxDuration; sem ele, o padrão do projeto — Vercel 300 s ou o do painel) + 15 s
   ESPERA=200             # o código que prova o caminho (200, 201…; 401 ou 404 quando a checagem é a recusa)
   EXTRA=()               # rota POST: EXTRA=(-X POST -H 'Content-Type: application/json')
   CORPO=''               # corpo do POST: CORPO='{"campo":"[shs] <código> …"}' — vai por arquivo, nunca pela linha de comando
   CAB=''                 # chave: CAB="header = \"x-api-key: $CHAVE\"" — a variável, nunca o valor; vai pelo stdin
   ( f=$(mktemp); c=$(mktemp); trap 'rm -f "$f" "$c"' EXIT; ulimit -f 5000
     [ -n "$CORPO" ] && { printf '%s' "$CORPO" > "$c"; EXTRA+=(--data-binary "@$c"); }
     w=$(printf 'url = "%s"\n%s\n' "$URL" "$CAB" | curl -q -s --globoff --max-time "$MAX" --max-filesize 5000000 \
           "${EXTRA[@]}" -K - -o "$f" -w '%{http_code} %{time_total}' 2>/dev/null); r=$?; echo "$w curl=$r"
     [ "$r" -eq 0 ] && [ "${w%% *}" = "$ESPERA" ] && jq -e '.status == "ok"' "$f" || exit 1 )
   ```

   ```js
   const ALVO = 'https://…/pagina';                  // a página testada
   const SITE = new URL(ALVO).origin;
   const PASSA = [['POST', `${SITE}/api/quiz/score`]]; // chamadas do caminho testado: método e endereço exatos, sem prefixo
   const MEDE = [];                                   // medição servida do próprio domínio, achada no layout (pixel próprio…)
   const ctx = await browser.newContext({ serviceWorkers: 'block' });   // antes de qualquer página
   await ctx.route('**/*', r => {                     // passa só o que o caminho precisa; todo o resto aborta
     const q = r.request(), u = q.url();
     const doSite = u.startsWith(SITE + '/') && q.method() === 'GET' && !MEDE.some(p => u.startsWith(p))
       && ['document', 'stylesheet', 'script', 'image', 'font'].includes(q.resourceType());
     const exato = PASSA.some(([m, p]) => q.method() === m && u.split(/[?#]/)[0] === p);
     return doSite || exato ? r.continue() : r.abort();
   });
   if (typeof ctx.routeWebSocket !== 'function') throw new Error('Playwright < 1.48: sem como cortar WebSocket');
   await ctx.routeWebSocket(/.*/, ws => ws.close());  // nenhum WebSocket abre: gravação de sessão vai por ele
   const page = await ctx.newPage();
   ```

3. **Mesmas travas do humano.** Nada irreversível — apagar ao fim o que esta checagem criou, achado pelo código dela
   (passo 4), é o recolhimento e não conta; apagar ou mudar o que já existia, nunca · nada de dinheiro fora do teto
   (US$ 0,50 por checagem, US$ 2,00 por dia em cada chat — não há contador comum entre chats; acima, pergunta com o
   número) · nada na Meta (`chave-meta-acesso-total`) · nada a pessoa de fora da casa (e-mail, WhatsApp, DM, lista de
   parceiro) · nada publicado · nada em conta de cliente · nada que amplie o alcance do agente (`execucao-remota`
   §exceção). Prévia por padrão; produção quando a pergunta é sobre produção. Escrita em prévia, só em prévia
   comprovadamente isolada (banco, filas e envios dela não chegam à produção nem a terceiro — há prévia da casa que
   manda e-mail real); escrita em produção, só com o recolhimento confirmado antes (passo 4).
4. **Dado de teste marcado e recolhido.** Código de 6 caracteres gerado na checagem (`openssl rand -hex 3`), dito no
   chat antes da primeira escrita — checagem interrompida no meio ainda deixa no histórico o código para apagar — e
   anotado na `🧪`, presente em toda linha que ela cria — é por ele que se apaga, e por isso toda marca o leva: `criado_por =
   'shs-<código>'` · nome/tema/título com prefixo `[shs] <código>` · lead com e-mail
   `shs+AAAA-MM-DD-<código>@alma-petra.test` · UTM `utm_source=shs&utm_content=<código>`; marca sem o código (`'shs'`
   sozinho) não acha a linha desta checagem sem pegar a de outra. **Antes de escrever em produção, confirmar que dá
   para recolher tudo o que o caminho grava** — inclusive telemetria e métrica interna (`agent_metrics`, eventos),
   que costuma ir sem a marca nem a sessão — (apagar a linha, desfazer a transação). Não dá — log imutável, fila que
   se consome, envio a terceiro, gravação sem como achar pelo código — → a escrita vai à prévia isolada; transação
   desfeita só quando o caminho inteiro cabe nela; senão, fronteira. Ao fim, esperar o que o fluxo grava depois da
   resposta (`after()`, fila, webhook — no quiz-diagnosys, o `quiz_leituras` entra depois do `/api/quiz/score`
   responder), apagar só as linhas com o código desta checagem (o filtro do `delete` é o código, nunca só a marca
   `shs`, que outra checagem pode estar usando agora), e reconferir todas as linhas com esse código antes de dizer
   que recolheu.
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
- **Persona · caminho:** Lucas no painel da Casa Magna → aba Roteiros → "Gerar" (POST /api/casas/magna/roteiros), produção.
- **Evidência:** 201 em 6,8 s; corpo com os 5 blocos (gancho, dor, virada, evidencia, cta); linha `casas_roteiros`
  id `…` status `rascunho`, tema `[shs] a3f9c1 teste pós-merge #1664`; contador do dia 1/20.
- **Veredito:** passa — a reserva atômica está no ar; nenhum 503.
- **Dado de teste:** código `a3f9c1`; linha apagada (`delete … where tema like '[shs] a3f9c1 %'`), nenhuma sobrando; custo US$ 0,03.
```
Falhou? A seção mostra o erro medido (status e código de erro, nunca a mensagem livre) e o diagnóstico começa na mesma resposta — a falha é da sessão
resolver, não do Lucas reportar.

## 5. Personas da casa (ponto de partida; a sessão descobre o caminho no repositório, nunca inventa URL)
| Persona | Caminho típico | Credencial | Marca do dado |
|---|---|---|---|
| Lucas no painel de uma casa / CRM | tela estática gerada (`npm run tela:casas`), rotas `/api/casas/*` | a mesma chave do painel (variável do ambiente) | tema `[shs] <código>`, `criado_por='shs-<código>'` |
| Visitante de página pública / VSL | URL de `vigia/dominios.txt` do hub (caminho no passo 2) ou prévia da Vercel | nenhuma | — (só leitura) |
| Lead terminando um quiz | fluxo inteiro até a carta, **na prévia isolada** — no quiz-diagnosys o `/api/quiz/score` também grava `agent_metrics` e um evento Koinonia do `composite-scorer` depois da resposta, sem sessão nem marca, e isso em produção não se recolhe | nenhuma (anon) | e-mail `shs+data-<código>@alma-petra.test`; apagar lead e leitura ao fim; parceiro de destino **não** recebe (`nossa-base-e-a-fonte`): prévia isolada (conferida antes), ou supressão só do lead `shs` pelo marcador, se o fluxo já tiver — **nunca** desligar o envio compartilhado (lead real chegando no meio se perderia) |
| Membro logado / área restrita | login de teste **já existente** da casa | só se já existir; nunca criar conta em sistema de terceiro | — |
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
  recolhimento do passo 4, publicou, mexeu em conta de cliente ou mandou mensagem a pessoa de fora → erro classe A:
  linha nova em `docs/ops/SHS-QUARENTENA.md` no mesmo ato, num PR do hub com `SHS-QUARENTENA` no título (é por ele que
  as outras sessões acham a linha antes do merge), sem dado de ninguém (persona genérica e repositório, classe do erro,
  hashtag do chat — nunca nome de cliente, conta, e-mail, id ou o que vazou), e a história do caso no histórico da
  regra. A persona passa a exigir "sim" do Lucas por 30 dias — o passo 1 lê a lista antes de rodar; a linha só sai
  pela data.

*v1.1 · 2026-10-14 (v1.0 em 13/10) · fonte única: `Lucas-Contexto-Geral/.claude/skills/simulacao-humana-sintetica/SKILL.md`,
no hub — nos irmãos este arquivo é cópia do `scripts/sync-rules.mjs` (3º canal) e não se edita lá · deploy no claude.ai
de cada conta Max: enviar esta pasta.*

🕒 2026-10-14 07:43 (São Paulo) · ✍ lucasscudeler · 💬 ✋ !! 16/10 · A75 · CANON SHS → liberar app no TEMPLO-FE e mergear PRs · #chat-4BNJMe
