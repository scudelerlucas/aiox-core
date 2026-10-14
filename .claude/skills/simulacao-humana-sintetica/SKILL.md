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
   PRs do hub com `SHS-QUARENTENA` no título atualizados nos últimos 30 dias (busca por `updated:`, não por `created:`:
   linha nova num PR antigo atualiza o PR), de qualquer estado (aberto, mergeado ou fechado sem merge), cuja linha já
   vale antes do merge e não some se o PR fechar; sem como fazer essas duas leituras, pedir o
   "sim" também.
2. **Caminho real, na camada mais externa que alcança.** Os passos 3 e 4 valem antes deste: travas, teto, isolamento e
   recolhimento se conferem antes do primeiro clique ou requisição, nunca depois. Antes de qualquer caminho — navegador
   ou HTTP, prévia ou produção —, ler no código que está no ar — o do commit da prévia ou da produção testada (o MCP da
   Vercel dá o commit do deploy), não o do clone, que pode estar noutra branch — se a página, o middleware ou a rota
   manda evento pelo próprio servidor (API de Conversões da Meta, analytics no backend) — e se o banco que a rota
   usa tem por onde mandar algo para fora (o censo do banco, logo abaixo) —, que nenhum corte no navegador alcança
   (sem como saber o commit no ar, fronteira): se manda, a checagem só roda numa prévia comprovadamente sem essas
   credenciais (as variáveis de ambiente dela não têm o token da API de Conversões, o do analytics nem o endereço do
   destino, e o código lido não traz chave, pixel ou endereço escrito nele — destino que
   aceita evento sem chave, ou com a chave no código ou na URL, manda do mesmo jeito, e aí é fronteira); sem essa prova,
   é fronteira.

   **O censo do banco** (rodadas 41 e 42, no lugar da busca pelo que a rota chama). O banco roda função sem que
   ninguém a chame pelo nome — gatilho, gatilho de DDL, regra de `CHECK`, índice de expressão, valor padrão, política
   de RLS, cascata de chave estrangeira, partição, `TRUNCATE`, SQL montado na hora (`execute`) — e manda para fora
   sem função nenhuma: tabela externa, publicação do Realtime, fila de replicação. Seguir o que a rota chama deixou
   de fora um desses por rodada, da 36 à 41 (medido num Postgres 16 local, como papel comum, com um caso de cada
   sobre uma função que chama `pg_notify`: a busca da rodada 39 aprovou 10 dos 11 — `CHECK`, índice, cascata,
   `TRUNCATE`, nome com aspas dobradas, partição, tabela externa, publicação de uma tabela e de todas, `dblink`
   instalado — e só pegou o SQL montado porque o `'notify'` estava escrito nele). Por isso o banco se confere pelo
   que ele **consegue** fazer, e a dúvida reprova, numa consulta que devolve só números e nomes de extensão — nunca o
   texto das funções (`prosrc`), que pode trazer a chave ou o endereço assinado da integração e entraria inteiro no
   histórico da ferramenta:

   ```sql
   with recursive f as (select p.oid, p.proname as nome, p.prolang, p.prokind, p.proowner,
     p.prosecdef, (select e.extname from pg_depend d join pg_extension e on e.oid = d.refobjid
     where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e') as ext,
     replace(concat(p.prosrc, ' ', case when p.prosqlbody is not null then pg_get_function_sqlbody(p.oid) end),
     '""', '"') as t from pg_proc p),
   seguras(x) as (values ('plpgsql'), ('pgcrypto'), ('uuid-ossp'), ('pg_stat_statements'), ('supabase_vault'),
     ('pgsodium'), ('pg_graphql'), ('pgjwt'), ('pg_trgm'), ('unaccent'), ('citext'), ('vector')),
   u as (select * from f where oid >= 16384 and ext is null),   -- 16384: o 1º objeto que não vem do initdb
   le as (select concat(pg_get_expr(polqual, polrelid), ' ', pg_get_expr(polwithcheck, polrelid)) as t
     from pg_policy union all select pg_get_ruledef(r.oid) from pg_rewrite r join pg_class c on c.oid = r.ev_class
     where c.oid >= 16384),
   x as (select t from le
     union all select pg_get_expr(adbin, adrelid) from pg_attrdef a where a.adrelid >= 16384
     union all select pg_get_constraintdef(o.oid) from pg_constraint o where o.oid >= 16384
     union all select pg_get_indexdef(i.indexrelid) from pg_index i where i.indexrelid >= 16384
     union all select regexp_replace(pg_get_triggerdef(g.oid), ' EXECUTE (FUNCTION|PROCEDURE) .*$', '')
     from pg_trigger g where not g.tgisinternal and g.oid >= 16384),
   priv as (select oid from pg_roles where rolsuper or pg_has_role(oid, 'pg_execute_server_program', 'member')
     or pg_has_role(oid, 'pg_write_server_files', 'member')),
   semente as (select oid, nome from f where oid >= 16384 and (t ~* ('notify|emit_message|\mexecute\M|\mcopy\M|'
     || 'net\.|http|dblink|cron\.|pgmq|lo_export|lo_import|_backend|nextval|setval|advisory|'
     || '\mraise\M\s+(notice|warning|info|log|debug)')
     or ext not in (select x from seguras) or ext is null and prokind <> 'a' and prolang not in (select oid
     from pg_language where lanname in ('sql', 'plpgsql'))) or oid < 16384 and nome ~ ('^(pg_'
     || 'notify|pg_logical_emit_message|lo_export|lo_import|pg_(terminate|cancel)_backend|nextval|setval|pg_(try_)?'
     || 'advisory_lock(_shared)?|pg_reload_conf|pg_switch_wal|pg_promote)$')),
   alcance(oid, nome) as (select * from semente union select g.oid, g.nome from f g, alcance a
     where g.oid >= 16384 and (g.t ~* ('\m' || regexp_replace(a.nome, '\W', '\\\&', 'g') || '\M')
     or exists (select 1 from pg_aggregate ag where ag.aggfnoid = g.oid and a.oid in (ag.aggtransfn, ag.aggfinalfn,
     ag.aggcombinefn, ag.aggserialfn, ag.aggdeserialfn, ag.aggmtransfn, ag.aggminvtransfn, ag.aggmfinalfn))))
   select (select string_agg(extname, ',' order by extname) from pg_extension
     where extname not in (select x from seguras)) as extensoes,
     (select count(*) from pg_foreign_server) as externo,
     (select count(*) from pg_publication_tables) as publicado,
     (select count(*) from pg_replication_slots where slot_type = 'logical') as replicacao,
     (select count(*) from pg_event_trigger where evtevent = 'login' and evtenabled <> 'D') as login,
     (select count(*) from u where prokind <> 'a' and prolang not in (select oid from pg_language
     where lanname in ('sql', 'plpgsql'))) as livre,
     (select count(*) from (select t from u union all select t from x) y
     where t ~* 'notify|emit_message|\mexecute\M|\mcopy\M|net\.|http|dblink') as texto,
     (select count(*) from (select t from u union all select t from x) y
     where t ~* ('\mexecute\M|\mcopy\M|lo_export|lo_import|_backend|nextval|setval|advisory|emit_message|'
     || '\mraise\M\s+(notice|warning|info|log|debug)')) as naodesfaz,
     (select count(*) from pg_class c where relkind = 'S' and c.oid >= 16384 and not exists (select 1
     from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')) as sequencia,
     (select oid from pg_roles where rolname = current_user) in (select oid from priv) or exists (select 1 from u
     where prosecdef and proowner in (select oid from priv) and (has_function_privilege(u.oid, 'execute')
     or exists (select 1 from pg_depend d where d.refclassid = 'pg_proc'::regclass and d.refobjid = u.oid)))
     as programa,
     (select count(*) from le where exists (select 1 from alcance a
     where le.t ~* ('\m' || regexp_replace(a.nome, '\W', '\\\&', 'g') || '\M')))
     + (select count(*) from pg_depend d where d.classid in ('pg_policy'::regclass, 'pg_rewrite'::regclass)
     and d.refclassid = 'pg_operator'::regclass and (select oprcode from pg_operator where oid = d.refobjid)
     in (select oid from alcance)) as leitura;
   ```

   O que cada número conta, sobre o que foi criado depois do `initdb` — objeto de número 16384 em diante, em qualquer
   esquema, o `pg_catalog` inclusive (a função que alguém põe lá conta) — e fora das extensões. `extensoes`: as
   instaladas fora das que nunca falam com a rede nem rodam depois (`pg_net`, `http`, `dblink`, `pg_cron`, `pgmq`, a
   de tabela externa…). `externo`, `publicado` e `replicacao`: servidor externo, tabela publicada, fila de
   replicação. `login`: gatilho que roda a cada conexão (Postgres 17) — acima de zero, a conexão do próprio censo já
   o disparou, e nenhum caminho segue nesse banco. `livre`: função em linguagem que não seja `sql` nem `plpgsql` (C,
   `internal`, `plpython3u`), cujo texto é só o nome de um símbolo e que pode fazer qualquer coisa. `texto`: função —
   as de gatilho de DDL inclusive, porque o caminho testado pode rodar DDL — e expressão do banco (valor padrão,
   `CHECK`, índice, `WHEN` de gatilho, política, visão, regra — `create rule … do also notify` não chama função
   nenhuma) que avisa (`NOTIFY`, `pg_notify`), manda mensagem à replicação, monta SQL, copia ou fala de rede.
   `naodesfaz`: as que fazem o que o `rollback` não desfaz — SQL montado, que pode fazer qualquer coisa, `copy`,
   arquivo no servidor (`lo_export`), derrubar outra conexão (`pg_terminate_backend`), trava de sessão, número de
   sequência (`nextval`, `setval`, o `serial` no valor padrão), mensagem ao cliente e ao log do servidor (`raise
   notice`, `warning`, `log`), que sai antes do `rollback` e pode levar valor da linha. `sequencia`: as sequências do
   banco, porque o `rollback` não devolve o número que o caminho tirou. `programa`: se o papel desta conexão, ou o
   dono de uma função `security definer` que alguém alcança (o papel pode chamá-la, ou um gatilho, política ou visão
   a usa), pode rodar programa ou gravar arquivo no servidor (superusuário, `pg_execute_server_program`,
   `pg_write_server_files`) — sem olhar o texto dela, porque a que só chama outra empresta o papel à outra.
   `leitura`: as políticas e visões que chegam, por qualquer cadeia de chamadas, a uma função que manda para fora,
   não se desfaz ou manda mensagem, a uma de extensão fora da lista segura (`cron.schedule`, `pgmq.send`) ou a uma do
   catálogo que faz isso (`pg_notify` direto numa visão não deixa rastro de dependência no banco) — a cadeia se segue
   pelo nome escrito no corpo de cada função, palavra inteira, e o nome que aparece conta como chamada.

   **Gravar e confirmar em produção** — a rota ou o `rpc` que grava, ou de que não se sabe se grava — só com
   `extensoes` vazio, os números em zero e `programa` falso; senão, prévia isolada ou fronteira. **Transação desfeita
   em produção** (o MCP, em (c)) com `externo`, `replicacao`, `login`, `livre`, `naodesfaz` e `sequencia` em zero,
   `programa` falso e, em `extensoes`, no máximo `pg_net`, `pg_cron` e `pgmq`: as três guardam numa tabela o que vai
   sair, e quem manda só lê o que foi confirmado (lido no catálogo do banco da casa: `net.http_get`, `http_post` e
   `http_delete`, do `pg_net` 0.19.5, só gravam em `net.http_request_queue`), e o aviso e a publicação também só saem
   no `commit`; o que sai antes dele — `http`, `dblink`, `pg_background`, tabela externa, linguagem sem trava,
   mensagem à replicação com uma fila aberta, `copy … to program` de quem pode — o `rollback` não desfaz (medido no
   Postgres local: a linguagem sem trava, a fila de replicação e a tabela externa acenderam cada uma a sua coluna).
   **Só ler em produção** — a rota no ar só lê, sem `rpc` nem escrita, lido no código — com `extensoes` no máximo
   `pg_net`, `pg_cron` e `pgmq`, e `externo`, `login`, `livre` e `leitura` em zero.

   Medido no Postgres local, como papel comum, um caso de cada (rodada 42): o censo da rodada 41 aprovava gravar com
   gatilho de DDL que avisa, com `CHECK` ou `WHEN` de gatilho que chama `pg_notify` direto, com regra que faz
   `NOTIFY`, com função do usuário posta no `pg_catalog`, com `lo_export`, `pg_terminate_backend`, `raise notice` ou
   `serial` e com o papel em `pg_write_server_files`; aprovava a transação desfeita com função C ou `internal` fora
   de extensão, com SQL montado e com `security definer` de superusuário que só chama a função com `copy … to
   program`, ou que é ele mesmo o gatilho de DDL; e aprovava a leitura com política que chama uma função que chama
   outra com `pg_notify` ou `cron.schedule`, e com visão que chama `pg_notify` direto, por agregado ou por operador.
   O novo reprovou cada um no veredito certo, repetiu os 11 da rodada 41, passou o banco limpo e o gatilho comum, e a
   função `send`, que avisa, não acendeu a política que só tem `sender_id`. No banco da casa (Postgres 17, medido no
   turno da rodada 42): `extensoes` = `pg_cron,pg_net`, `texto` = 41, `naodesfaz` = 52, `sequencia` = 44, o resto em
   zero e `programa` falso — gravar e transação desfeita em produção não passam, e a checagem do banco vai a uma
   prévia isolada (um Postgres local com as migrações do repositório, que não prova a produção) ou vira fronteira; a
   leitura passa.

   Ordem de preferência: (a) navegador sem tela sobre a URL (Playwright 1.48 ou mais novo, com o navegador
   que o ambiente já tem: na nuvem do Claude Code, `executablePath: '/opt/pw-browsers/chromium'`; fora dela, o que o
   próprio Playwright encontra — o bloco abaixo recebe o `browser` já aberto, `const browser = await chromium.launch({
   executablePath })`, e quem o abriu o fecha num `finally`, `await browser.close()`), com a página testada vinda da
   variável `ALVO_URL`, já carregada no ambiente — link assinado ou link mágico escrito no script fica no histórico —,
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
   `SharedWorker` e com uma lista do que pode passar, registrada antes de abrir qualquer página — o segundo bloco
   abaixo: a própria página testada; os arquivos do build, por GET (`ESTATICO`: a pasta que só serve arquivo gerado — no
   Next.js, `/_next/static/`); e cada chamada ou página a mais que o caminho testado faz (`PASSA`, uma entrada por
   chamada — `m`, o método, e `url`, o endereço inteiro com a query, montado do ambiente quando leva token, como o
   `ALVO`; `tipo`, no que não é `fetch`, XHR nem `EventSource` (`script`, `image`, `document`), porque o mesmo
   endereço pedido por `<img>` não é a chamada da página (medido: uma entrada de `fetch` pedida só por `<img>` contava
   como feita; agora para em `não houve`), de todo método — o formulário (`document`) e o `sendBeacon` (`ping`)
   declaram o seu, e sem `tipo` só a chamada de dados casa (medido: um POST da lista feito por `sendBeacon` contava
   como feito no bloco da rodada 41, e a tela passava; agora para em `não houve`, com `cortado: POST ping`, e o mesmo
   POST por `fetch` passa); `corpo`, quando o mesmo endereço recebe outras coisas, a condição sobre o
   campo que só o teste manda e não
   sobre um pedaço do texto; chamada que não é GET só entra com a condição que a liga a esta checagem — o código no
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
   mandava a um pixel de fora fez o pixel receber a visita; com o 3xx abortado, não). Lista do que passa, e não do que
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
   e com os endereços inteiros passou) —: o `CORTADO` mostra o quê — método, tipo (documento, script, imagem, fetch) e
   de onde (`o site`, `a origem da entrada N` ou `outra origem`, nunca o host, que também pode levar token ou o nome do
   cliente — e o mesmo nas mensagens de `não houve` e de status), guardado num conjunto, sem repetir, para a página que
   tenta sem parar não encher a memória (medido: em 5 s de laço, o bloco anterior juntou 7.705 linhas, 262 KB; o novo, 1
   linha), sem o caminho nem a query, que podem levar token, e-mail ou nome (`/magic-link/<token>`, `/maria/pedidos`), e
   a marca do que estava na lista e abortou mesmo assim (`3xx`, `falhou`, `repetido`, `cors`, `status`, `erro`), e sai
   na própria mensagem de erro, até 10 linhas diferentes, para o teste que falhou dizer o que faltou —, e entra em
   `PASSA` depois de lido no código e conferido que não é medição. O preflight do CORS, o Playwright responde sozinho, e
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
   recusa), sem `Access-Control-Request-Headers` quando a página não pôs cabeçalho (o anterior mandava o campo vazio,
   que o navegador não manda), e o XHR a outra origem com corpo pergunta sempre, porque o navegador pergunta quando a
   página escuta o envio (`upload.onprogress`) e o `route` não mostra isso (medido: com o evento, o navegador mandou o
   `OPTIONS` antes do POST; o bloco anterior foi direto ao POST; o novo pergunta antes) — o XHR sem o evento ganha um
   `OPTIONS` que o navegador não manda, que é o lado seguro, salvo com `upload: false` na entrada, quando o código lido
   não escuta o envio (medido no Chromium sem o `route`: só perguntou com corpo e evento juntos; sem o evento, e com o
   evento num GET ou num `send(null)`, foi direto; com `upload: false`, o bloco foi direto como ele); e a resposta de
   toda chamada a outra origem só chega à página se liberar a origem (com credenciais, a origem exata e
   `Allow-Credentials`) — senão aborta (`cors`), e o servidor recebeu os mesmos `OPTIONS` e `POST` que recebeu do
   navegador sem o `route`, e a página, os mesmos erros (medido); a origem é a de quem chama, lida no `Origin` do
   pedido ou, no `fetch` que não o manda, na do documento que chamou (`self.origin`: o `iframe` `about:blank` herda a
   de quem o abriu, e o endereço dele dava `null` — medido: o GET da própria origem num `iframe` assim era cortado como
   `cors`; agora passa, como no navegador), e não a do site: o `iframe` de outra origem que chama o site faz chamada
   CORS (medido: um `iframe` de
   `localhost:8797` que chamava `127.0.0.1:8796` sem `Allow-Origin` leu a resposta no bloco anterior; no novo, deu o
   mesmo erro do navegador); cabeçalho simples é o da lista do Fetch com as regras de valor — um `Accept` de mais de 128
   bytes pede preflight, um `Range: bytes=0-` não, e o limite de 128 bytes vale para todos, o `Range` inclusive (medido
   nos dois contra o navegador sem o `route`: no bloco anterior, o primeiro foi direto ao servidor e o segundo mandou um
   `OPTIONS` que o navegador não manda; no novo, o servidor recebeu o mesmo que do navegador), e o `Range` invertido
   (`bytes=10-2`) pergunta antes, como no navegador, comparado em `BigInt` (medido: o navegador mandou o `OPTIONS`; o
   bloco anterior foi direto ao GET; o novo pergunta; com `bytes=9223372036854775809-9223372036854775808`, que em
   `Number` dá dois números iguais, o navegador perguntou, o bloco anterior foi direto, e o novo pergunta); credencial é
   o cookie que a página mandou, ou `cred: 'include'` na entrada, quando o código chama a outra origem com `credentials:
   'include'` (sem cookie a mandar, o pedido não mostra o modo); o `fetch` com `mode: 'no-cors'` passa sem pergunta e
   sem `Allow-Origin` e chega opaco à página, como no navegador: o modo não chega ao `route` (nem o `Sec-Fetch-Mode`, e
   o POST `no-cors` traz `Origin`, medido), então o próprio `fetch` da página anota o modo de cada pedido que pode ser
   `no-cors` (GET, HEAD, POST), sem ler o corpo, do começo até ele acabar, e o `route` só lê: trata como opaco só
   quando todo `fetch` no ar naquele endereço é `no-cors` — com um `cors` junto, não se sabe qual dos dois chegou, e
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
   contexto da página e os de busca recebem (`proxy`, com `localhost`, `127.0.0.1` e o que o `NO_PROXY` do ambiente
   lista fora dele — a busca, pelo mesmo caminho que a página: lê a mesma lista pela regra do Chromium (vírgula ou
   ponto e vírgula entre as entradas, `*`, porta, faixa IPv4 como `10.0.0.0/8`, curinga, ponto na frente; o IPv6 sem
   colchetes e a faixa IPv4 inválida, como `1.999.0.0/8` ou `/33`, o Chromium ignora — e, na faixa inválida, o bloco
   para) e vai direto ou pelo
   proxy sem lista, porque, na busca, a lista do Playwright só compara o fim do nome (medido num proxy de teste: com
   `NO_PROXY=*` e com `host:porta`, a página foi direto e a busca do bloco anterior, pelo proxy; com o host exato, a
   página mandou o subdomínio pelo proxy e a busca anterior, direto; a regra nova bateu com a página nos 25 casos
   medidos, e na rodada 41 em mais 11 — com `a;b`, a página foi direto e a regra anterior, pelo proxy; com
   `1.999.0.0/8`, a página foi pelo proxy e a regra anterior mandava `4.231.0.1` direto; e, como o Playwright põe
   `<-loopback>` na lista, `127.0.0.2`, `foo.localhost`, `[::1]` e `169.254.1.1` foram pelo proxy na página, como na
   regra: o desvio implícito do Chromium não vale ali —, e a forma que ela não sabe seguir — `<local>`, esquema,
   faixa IPv6 — para o bloco, e o IPv6 entre colchetes mal escrito também, com mensagem fixa, porque o erro do `URL`
   do Node traz a entrada inteira (medido: com `NO_PROXY=[abcd:token]`, o bloco da rodada 41 caiu em `Invalid URL`
   com a entrada no erro; o novo, em `NO_PROXY com IPv6 mal escrito`, sem ela)) —, e o usuário e a senha
   do endereço do proxy nos campos próprios, que o Chromium não lê do endereço — medido num proxy de teste que pede
   senha: o bloco anterior nem abriu a página, o novo abriu com 200; com o host no `NO_PROXY`, o anterior foi pelo proxy
   e o novo foi direto; com o endereço do proxy mal escrito e a senha nele, o anterior imprimiu a senha no erro, porque
   o do `URL` do Node traz o endereço inteiro no `input`, e o novo para em `HTTPS_PROXY/ALL_PROXY mal escrito`, sem o
   valor) — medido: o bloco anterior não abriu nem o `example.com` nem a prévia da Vercel; o novo abriu o `example.com`
   com 200 e recebeu da prévia o mesmo 302 para o login da Vercel que o `curl` recebe. Os cabeçalhos de relatório da
   resposta (`Report-To`, `NEL`, `Reporting-Endpoints`) saem antes de a página receber, porque o relatório é enviado
   pelo próprio navegador, que pode mandá-lo por fora do `route`, e sem o endereço ele não sai (medido: a página não leu
   mais o `Report-To`, e os dois `Set-Cookie` da mesma resposta continuaram); o relatório de CSP pelo `report-uri` passa
   pelo `route` e aborta como o resto (medido: sem o `route`, o servidor recebeu o `POST` do relatório; com o bloco,
   não). O `Sec-Fetch-Site`, o `Sec-Fetch-Mode` e o `Sec-Fetch-Dest` não chegam ao servidor pelo `route.fetch` (medido:
   o navegador manda os três; pelo bloco, nenhum, e o `allHeaders()` dentro do `route` também não os mostra, então não
   há o que repor): rota que decide por eles (proteção contra pedido de outro site) não se prova assim, e o veredito diz
   isso; e o corpo binário sem tipo (um `ArrayBuffer`, um `Blob` sem tipo) chega ao servidor como
   `application/octet-stream`, que o Playwright põe sem como tirar (medido: o navegador não mandou `Content-Type`; pelo
   bloco, `application/octet-stream`; com o campo vazio, um `Content-Type` vazio): rota que decide pelo tipo também não
   se prova assim. O `DEBUG=pw:…` do Playwright imprime cada URL inteira, token incluso: ligado, o bloco para antes de
   tudo; e o `NODE_DEBUG` também, com qualquer valor, porque o do Node imprime a URL, o cookie e o `Authorization` no
   erro padrão (medido: com `NODE_DEBUG=http,https,net,tls,http2`, o token da query, o cookie e a chave apareceram lá; o
   bloco anterior seguia, o novo para em `NODE_DEBUG imprime …`). Sem como cortar tudo — Playwright velho, service
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
   `--head` grava reprovava sempre — com `COND=''`, 200 e saída 0), e o bloco recusa o `-X HEAD` no `EXTRA` (medido: o
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
   rodava com `core=unlimited` herdado do terminal; no novo, com `core=0`); `jq -e` faz a condição falsa sair com erro
   (senão um `{}` ou um `{"status":"error"}` passaria); na falha, do corpo não sai nada — nem o código de erro, que pode
   ser token ou dado de cliente com cara de código —: sai só o status HTTP e o código do `curl`, e o diagnóstico segue
   pelo log do servidor só quando dá para achar a linha desta chamada — pelo código da checagem, se o log o registra, ou
   pelo id da requisição que a resposta traga; só pela janela de horário, com outro tráfego na rota, a linha pode ser de
   outra pessoa, e o log fica declarado não correlacionado — e só por consulta que já devolve campos fixos (status, rota
   sem a query, hora, nome do erro): filtrar a linha inteira depois de recebida não basta, porque ela já entrou no
   histórico da ferramenta. Rota que grava credencial na linha do log (no quiz-diagnosys, a de retomada registra o token
   cru), com ferramenta que só devolve a linha inteira: o log não se lê, e o diagnóstico fica no código. O corpo fica
   fora do repositório e fora do chat: dele sai só o campo que prova o caminho, nunca o corpo inteiro, que em painel ou
   produção pode trazer dado de cliente ou credencial. (c) leitura/escrita no banco (MCP do Supabase; `begin; set local
   statement_timeout = '5s'; set local lock_timeout = '2s'; …; set constraints all immediate; rollback` numa única
   chamada do `execute_sql` — os dois prazos, desligados por padrão no Postgres, impedem que a trava de outra transação
   prenda a checagem, e com ela as travas que ela já pegou (conferido no MCP do Supabase: `5s` e `2s` valem dentro da
   chamada); a consulta devolve só o que prova o caminho — contagem, status, ou as colunas do teste nas linhas com o
   código desta checagem, e o `returning` também —, nunca `select *` nem linha de cliente, porque o resultado entra
   inteiro no histórico da ferramenta antes de qualquer filtro; sem como projetar assim, fronteira; sem o `set
   constraints`, a restrição adiada, que só se confere no `commit`, passa sem ser testada, e ele vem depois das
   instruções testadas, logo antes do `rollback`, porque antes delas mudaria o modo da restrição e reprovaria a troca
   que o `commit` aceitaria; se uma instrução falha, o `rollback` do fim não roda, e quem desfaz é o fim da conexão
   (medido com o MCP do Supabase: a trava pega antes do erro saiu livre, e não sobrou conexão parada em transação), e
   cada chamada é uma conexão própria, e `begin` numa com `rollback` noutra não desfaz nada —, sabendo que o
   `rollback` não devolve número tirado de sequência (`serial`, `identity`, `nextval`) — por isso o censo, no passo
   2, reprova a transação desfeita em banco com sequência —; e sabendo que o
   `rollback` desfaz a linha e não o que sai do banco antes do `commit` (o censo da transação desfeita, no passo 2,
   diz se o banco tem por onde; reprovou, prévia isolada); e que a mensagem de erro do banco traz o valor da linha (`Key
   (email)=(…)`, `Failing row contains`) e chega ao histórico da ferramenta antes de qualquer filtro — com dado de
   teste, é o dele, mas na restrição de unicidade ou de exclusão vem também o da linha que já existia, de cliente: as
   escritas do caminho em que alguma pode colidir vão todas, na ordem dele, num bloco que guarda só o código do erro,
   com o `set constraints` dentro dele, depois da última (`do $$ begin <escritas>; set
   constraints all immediate; exception when others or query_canceled or assert_failure then perform
   set_config('shs.e', sqlstate, true); end $$; select current_setting('shs.e', true);` — sem tabela temporária: o
   `create temp table` é DDL e dispara gatilho de evento, que pode mandar algo para fora — medido num Postgres 16
   local: com ele, o gatilho de evento disparou; com o `set_config`, não, e saíram só `23505`, `57014` e `P0004`; no MCP
   do Supabase, um `1 / 0` no bloco devolveu só `22012`), sem erro no log — fora do bloco, a restrição adiada
   (`deferrable initially deferred`) deixa a escrita passar e só se confere no `set constraints` de depois, que devolve
   o erro inteiro (medido no MCP do Supabase, numa tabela temporária desfeita: sem o bloco, o erro trouxe `Key
   (chave)=(…) already exists`; com ele, só `23505`; o `when others` sozinho não pega o prazo estourado (`57014`, do
   `statement_timeout`) nem o `assert` (`P0004`), e os dois saíram com o texto da instrução do gatilho no contexto do
   erro (`SQL statement "…"`) ou a mensagem do `assert`; com os dois nomeados, só `57014` e `P0004`; numa restrição
   adiada, com o `set constraints` fora do bloco, o erro trouxe a chave de novo; dentro dele, só `23505`, e a linha
   repetida saiu desfeita; numa troca de dois valores únicos em duas instruções, só a primeira no bloco, com o `set
   constraints` logo depois dela, reprovou com `23505` a troca que o `commit` aceitaria, e as duas no bloco passaram,
   enquanto a colisão de verdade continuou saindo só como `23505`); se um gatilho ou função copia dado de cliente para a
   linha de teste, prévia isolada; nunca `raise exception` para desfazer em produção, que deixa um erro no log do banco
   e pode disparar alerta; prova o banco, não a rota: se a pergunta é sobre a rota, desfazer no banco não substitui
   chamá-la). (d) script do repositório (`npm run`, `scripts/*.sh`). Teste unitário **não** substitui (a)–(c): ele prova
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
   EXTRA=()               # só --head, -X <MÉTODO> e -H de Content-Type ou Accept (o resto, o bloco recusa); rota POST:
                          # EXTRA=(-X POST -H 'Content-Type: application/json') — credencial nunca aqui
   CORPO=''               # corpo, como filtro do jq: CORPO='{campo: "[shs] <código>", senha: env.SENHA}' — o bloco o
                          # monta num arquivo, lê a senha do ambiente e escapa; texto puro: CORPO='"a=\(env.A|@uri)"'
   COND='.status == "ok"'  # condição de sucesso sobre o corpo, filtro do jq; HEAD e resposta sem corpo: COND=''
   CAB=()                 # chaves: CAB=("x-api-key: $CHAVE" "Authorization: Bearer $TOKEN") — as variáveis, nunca o
                          # valor; todas vão pelo stdin
   ( f=$(mktemp /tmp/shs.XXXXXX); c=$(mktemp /tmp/shs.XXXXXX); trap 'rm -f "$f" "$c"' EXIT   # nunca no repo
     ulimit -c 0                    # sem core dump antes de qualquer processo ler a credencial (o jq do corpo, o curl)
     [ -z "$CORPO$COND" ] || command -v jq >/dev/null || { echo 'falta o jq: o corpo e a condição pedem'; exit 1; }
     for ((i = 0; i < ${#EXTRA[@]}; i++)); do a=${EXTRA[i]} b=${EXTRA[i+1]-}   # nada que mude o destino, siga
       if [ "$a" = --head ]; then :                     # redirecionamento ou mexa em arquivo; o -X HEAD esperava
       elif [ "$a" = -X ] && [[ $b =~ ^[A-Z]+$ && $b != HEAD ]]; then ((++i))   # o corpo anunciado até o MAX
       elif [ "$a" = -H ] && [[ $b =~ ^([Cc]ontent-[Tt]ype|[Aa]ccept):\ [^[:cntrl:]]*$ ]]; then ((++i))
       else echo 'EXTRA: só --head, -X <MÉTODO> (HEAD pelo --head) e -H de Content-Type ou Accept'; exit 1; fi; done
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
   if (/(^|[\s,])(pw|\*)/.test(process.env.DEBUG ?? '')) throw new Error('DEBUG=pw:… imprime a URL inteira: desligue');
   if (/\S/.test(process.env.NODE_DEBUG ?? '')) throw new Error('NODE_DEBUG imprime URL, cookie e chave: desligue');
   if (!SEGURO(ALVO)) throw new Error('ALVO_URL: só https:// (http só local), sem usuário antes do host');
   const N = s => { const x = new URL(s); x.hash = ''; return x.href; };   // endereço inteiro, com a query, sem o #
   const SITE = new URL(ALVO).origin, PAGINA = N(ALVO), MAX_MS = 815_000;   // o MAX do HTTP: prazo da rota + 15 s
   const ESPERA = 200;                               // o código da página (404 quando a checagem é a recusa)
   const FOLGA = 500;                                // depois da evidência, o tempo em que a chamada atrasada conta: o
   // maior prazo da página para chamar de novo (debounce, nova tentativa), lido no código, mais 500 ms
   const ESTATICO = [`${SITE}/_next/static/`];       // pasta do build (Next.js; outro framework, a dele), só GET
   const PREVISTO = [];                              // o que a página chama e o teste corta de propósito (analytics,
   // pixel, aviso de erro, fonte de fora), lido no código: o endereço inteiro, com a query, vale só para GET; outro
   // método, ou mais de um pedido no mesmo endereço, pede (u, m, c, t) => condição sobre endereço, método, corpo e tipo
   // (o mesmo POST /api/events leva o evento do analytics e o dado da página); o cortado fora daqui reprova, todo tipo
   const J = c => { try { return JSON.parse(c); } catch { return null; } };   // corpo que não é JSON não casa
   let SESSAO = null;                                // o teste guarda aqui a sessão aberta com o e-mail shs+…
   const PASSA = [{ m: 'POST', url: `${SITE}/api/quiz/score`,
     corpo: c => SESSAO !== null && J(c)?.session_id === SESSAO }];
   // m e url inteira, com a query (com token, montada do ambiente, como o ALVO); corpo, no que não é GET: a condição
   // que liga a chamada a esta checagem (o código no corpo, a sessão que nasceu do e-mail shs+…); se preciso: vezes
   // (padrão 1; GET que a página repete de propósito pede o número), status (padrão s => s < 400), tipo (padrão:
   // fetch, XHR ou EventSource no GET; script, imagem, folha de estilo, fonte ou página pedem o dela: tipo: 'script',
   // porque o mesmo endereço pedido por <img> não é a chamada da página), cred: 'include',
   // quando a página chama outra origem com credentials: 'include' (lido no código: sem cookie, o pedido não o mostra),
   // upload: false, no XHR com corpo sem ouvinte em xhr.upload (lido no código: sem ele, XHR com corpo pergunta antes),
   // resposta: t => condição sobre o corpo, quando a rota responde 200 com o erro dentro (J(t)?.status === 'ok'),
   // e opcional: true na que pode não acontecer — sem ele, a entrada que não houve reprova
   if (![...ESTATICO, ...PASSA.map(p => p.url)].every(SEGURO)) throw new Error('PASSA e ESTATICO: só https://');
   if (PASSA.some(p => p.m !== 'GET' && typeof p.corpo !== 'function')) throw new Error('PASSA: escrita sem condição');
   const PREV = (u, m = 'GET', c = '', t = '') => PREVISTO.some(p => { try { return typeof p === 'function'
     ? p(u, m, c, t) === true : m === 'GET' && N(p) === u; } catch { return false; } });   // exato: começo de endereço
   const DADO = t => ['fetch', 'xhr', 'eventsource'].includes(t);   // sem tipo, só chamada de dados, de todo método
   const CASA = (p, m, u, c, t) => m === p.m && N(p.url) === u && (p.tipo ? p.tipo === t : DADO(t))
     && (p.corpo ?? (() => true))(c) === true;       // a entrada da lista: método, endereço, tipo e corpo
   const QUEM = o => { const i = PASSA.findIndex(p => new URL(p.url).origin === o);   // nem o host vai à mensagem,
     return o === SITE ? 'o site' : i >= 0 ? `a origem da entrada ${i}` : 'outra origem'; };   // que pode levar token
   const VEZES = PASSA.map(() => 0), TARDE = PASSA.map(() => 0), CORTADO = new Set(), RUIM = [], FALTOU = new Set();
   const VOO = new Set();                            // no ar; TARDE conta, à parte, as da lista que vêm depois do fim
   let VISITAS = 0, VEIO, FECHADO = false;           // FECHADO: depois da evidência, nada novo passa
   const LIBERA = (x, cred, de) => { const o = x.headers()['access-control-allow-origin'];   // libera quem chamou?
     return cred ? o === de && x.headers()['access-control-allow-credentials'] === 'true' : o === de || o === '*'; };
   const INSEGURO = /[\x00-\x08\x0a-\x1f"():<>?@[\\\]{}\x7f]/;   // byte que o Fetch não aceita em cabeçalho simples
   const SIMPLES = (k, v, tipo) => Buffer.byteLength(v) <= 128 && (k === 'accept' ? !INSEGURO.test(v)
     : ['accept-language', 'content-language'].includes(k) ? /^[0-9A-Za-z *,.;=-]*$/.test(v)
     : k === 'content-type' ? !INSEGURO.test(v)
       && ['text/plain', 'multipart/form-data', 'application/x-www-form-urlencoded'].includes(tipo)
     : k === 'range' && (r => !!r && (!r[2] || BigInt(r[1]) <= BigInt(r[2])))(/^bytes=(\d+)-(\d*)$/.exec(v)));
   // a lista simples do Fetch: 128 bytes para todos; o Range invertido (bytes=10-2) pergunta antes, como no navegador,
   // comparado em BigInt: em Number, dois números de 19 dígitos diferentes saem iguais
   const ABERTO = new Map();                         // resposta → o contexto só dela, fechado junto (SOLTA)
   const BUSCA = async (url, op) => {                // contexto novo por busca: o Set-Cookie de uma não vai a outra, e
     const c = await browser.newContext(PELA(url));  // o Cookie só sai se a página mandou (medido: o vazio chegava)
     const r = await c.request.fetch(url, { maxRedirects: 0, timeout: MAX_MS, ...op }).catch(() => null);
     if (r) ABERTO.set(r, c); else await c.close(); return r; };
   const SOLTA = async r => { if (!r) return; await r.dispose().catch(() => {});
     await ABERTO.get(r)?.close().catch(() => {}); ABERTO.delete(r); };
   const PROIBIDO = new RegExp('^(sec-|proxy-)|^(accept-charset|accept-encoding|access-control-request-(headers|method)'
     + '|connection|content-length|cookie2?|date|dnt|expect|host|keep-alive|origin|referer|set-cookie|te|trailer'
     + '|transfer-encoding|upgrade|via|user-agent)$');   // os que só o navegador põe (a lista proibida do Fetch e o UA)
   const PREFLIGHT = async (q, m, cred, de, e, h) => {   // o Playwright finge o preflight (medido): este vai à rota
     const tipo = (h['content-type'] ?? '').split(';')[0].trim().toLowerCase();   // com os cabeçalhos que a BUSCA manda
     const meus = Object.keys(h).filter(k => !PROIBIDO.test(k) && !SIMPLES(k, h[k], tipo)).sort();   // (o allHeaders)
     const sobe = q.resourceType() === 'xhr' && !!q.postDataBuffer() && e?.upload !== false;   // o Chromium pergunta
     if (['GET', 'HEAD', 'POST'].includes(m) && !meus.length && !sobe) return true;   // no XHR com corpo e ouvinte de
     const p = await BUSCA(q.url(), { method: 'OPTIONS', headers: { origin: de,   // upload (medido), que o route não
       'access-control-request-method': m, ...(meus.length && { 'access-control-request-headers': meus.join() }) } });
     // vê: sem o upload: false da entrada, pergunta. Sem Cookie, como o do navegador
     const tem = (k, v, caixa) => { const l = (p.headers()[k] ?? '').split(',').map(s => s.trim());   // nome de método:
       return (caixa ? l : l.map(s => s.toLowerCase())).includes(v)   // na caixa exata (o navegador recusa o put)
         || (!cred && l.includes('*') && v !== 'authorization'); };   // * não cobre o Authorization
     const ok = !!p && p.status() >= 200 && p.status() < 300 && LIBERA(p, cred, de)
       && (['GET', 'HEAD', 'POST'].includes(m) || tem('access-control-allow-methods', m, true))
       && meus.every(k => tem('access-control-allow-headers', k));
     await SOLTA(p); return ok;
   };
   const E = process.env, PROXY = E.HTTPS_PROXY || E.https_proxy || E.ALL_PROXY || E.all_proxy;   // a nuvem do Claude
   const FORA = E.NO_PROXY || E.no_proxy;            // Code sai por ele: sem ele, a busca não acha host de fora
   let REDE = {}, PELA = () => ({});                 // (medido); a variável vazia passa à próxima; a senha vai no campo
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
     const g = new RegExp(`^${(h[0] === '.' ? `*${h}` : h)
       .toLowerCase().replace(/[.+^$()|{}\\[\]]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);   // curinga
     return x => (v6 ? x.h === v6 : g.test(x.h)) && (!p || +p === x.p); };
   if (PROXY) {                                      // sem esquema (proxy:3128) vale http://, como no Playwright
     let so; try { const PX = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(PROXY) ? PROXY : `http://${PROXY}`);
       so = { server: `${PX.protocol}//${PX.host}`, username: decodeURIComponent(PX.username),
         password: decodeURIComponent(PX.password) };
     } catch { throw new Error('HTTPS_PROXY/ALL_PROXY mal escrito'); }   // sem o valor: o erro do URL traz a senha
     const lista = [FORA, 'localhost,127.0.0.1'].filter(Boolean).join(), R = lista.split(/[,;]/).map(s => s.trim())
       .filter(Boolean).map(REGRA);                  // a página lê a lista, com , ou ; (medido); a busca, por esta
     REDE = { proxy: { ...so, bypass: lista } };
     PELA = u => { const x = new URL(u), y = { h: x.hostname, p: +(x.port || (x.protocol === 'https:' ? 443 : 80)) };
       return R.some(f => f(y)) ? {} : { proxy: so }; };   // direto, ou pelo proxy sem lista nenhuma
   }
   const ctx = await browser.newContext({ serviceWorkers: 'block', ...REDE });   // antes da página
   if (typeof ctx.routeWebSocket !== 'function') {   // sem ele, nenhum corte de WebSocket: para aqui
     await ctx.close(); throw new Error('Playwright < 1.48: sem como cortar WebSocket'); }
   let passo = 'preparar o contexto', ERRO = null;   // o teste troca antes de cada ação: passo = 'clicar em Gerar'
   try {                                             // já no preparo: se ele falha, o finally fecha o contexto
     ctx.setDefaultTimeout(MAX_MS);                  // navegação e espera com o prazo da rota, não os 30 s do padrão
     await ctx.addInitScript(() => {                  // o tráfego destes não passa pelo route (o do worker, medido)
       for (const k of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'WebTransport', 'Worker', 'SharedWorker'])
         Object.defineProperty(window, k, { value: undefined });
       const f = window.fetch, S = new Map();          // o modo do fetch não chega ao route (nem o Sec-Fetch-Mode,
       Object.defineProperty(window, '__shsNoCors', { value: S });   // medido): todo fetch que pode ser no-cors fica
       window.fetch = function (i, o) {                // anotado aqui com o modo, do começo até acabar, sem ler o
         let k, x;                                     // corpo nem tocar no pedido, e o route lê; com outro método, o
         try { const R = i instanceof Request, md = String(o?.method ?? (R ? i.method : 'GET')).toUpperCase();
           k = `${md} ${new URL(R ? i.url : String(i), location.href).href.split('#')[0]}`;   // no-cors é recusado
           if (['GET', 'HEAD', 'POST'].includes(md)) { x = { nc: (o?.mode ?? (R ? i.mode : 'cors')) === 'no-cors' };
             S.set(k, [...(S.get(k) ?? []), x]); } } catch {}   // antes de sair
         const p = f.apply(this, arguments);           // cada anotação sai quando o próprio fetch acaba (o route só
         if (x) p.catch(() => {}).finally(() => { const l = (S.get(k) ?? []).filter(y => y !== x);   // lê), e o
           if (l.length) S.set(k, l); else S.delete(k); });   // endereço sem nenhum no ar sai do mapa
         return p; }; });
     const ROTA = async r => {                       // passa só o que o caminho precisa; todo o resto aborta
       const q = r.request(), t = q.resourceType();
       let marca = 'erro ', m = '?', o = '', u = '', c = '', resp = null, e, repetido = false;
       if (FECHADO) {                                  // o teste acabou: nada sai; reprova o que não está previsto nem
         let i = -1;                                   // cabe na entrada dele (o corpo e as vezes de antes do fim), de
         try { u = N(q.url()); m = q.method(); o = new URL(u).origin; c = q.postData() ?? '';   // todo tipo — a página
           i = PASSA.findIndex(p => CASA(p, m, u, c, t));   // que navega depois da evidência, e o arquivo do build:
         } catch { u = ''; }                           // o pedaço que não roda esconderia o que ele faria
         if (!PREV(u, m, c, t) && !(i >= 0 && VEZES[i] + ++TARDE[i] <= (PASSA[i].vezes ?? 1)))
           FALTOU.add(`depois ${m} ${t} ${QUEM(o)}`);
         return r.abort().catch(() => {});
       }
       try {                                           // erro aqui aborta calado: o do JSON.parse traz o corpo (medido)
         u = N(q.url()); c = q.postData() ?? ''; const h = await q.allHeaders(); m = q.method(); o = new URL(u).origin;
         const i = PASSA.findIndex(p => CASA(p, m, u, c, t));
         e = PASSA[i]; const pagina = m === 'GET' && t === 'document' && u === PAGINA;
         repetido = (e && ++VEZES[i] > (e.vezes ?? 1)) || (pagina && ++VISITAS > 1);   // nova tentativa, recarga
         const ok = (pagina || (m === 'GET' && ESTATICO.some(p => u.startsWith(p))) || !!e) && !repetido;
         const cred = !!h.cookie || e?.cred === 'include';   // com credenciais, o Allow-Origin * não vale
         const de = h.origin ?? (t === 'fetch' ? await q.frame().evaluate(() => self.origin)   // a do documento: o
           .catch(() => new URL(q.frame().url()).origin) : undefined);   // about:blank herda a de quem o abriu
         const opaca = t === 'fetch' && await q.frame().evaluate(k => { const l = window.__shsNoCors?.get(k);
           return !!l?.length && l.every(x => x.nc); }, `${m} ${u}`).catch(() => false);   // só quando todo fetch no ar
         // neste endereço é no-cors: com um cors junto, não se sabe qual dos dois é este, e vale o mais estrito
         const fora = !!de && o !== de && t !== 'document' && !opaca;   // CORS a quem chamou; o no-cors, sem pergunta
         const cors = ok && fora && !(await PREFLIGHT(q, m, cred, de, e, h));   // nem Allow-Origin, chega opaca, como
         marca = repetido ? 'repetido ' : cors ? 'cors ' : '';   // no navegador; sem o sim do preflight, nada sai
         if (ok && !marca) {
           resp = await BUSCA(q.url(), { method: m, headers: h, data: q.postDataBuffer() ?? undefined });
           if (!resp) marca = 'falhou ';
           else if ([301, 302, 303, 307, 308].includes(resp.status())) marca = '3xx ';   // o route só vê o 1º endereço
           else if (pagina && resp.status() !== ESPERA) { marca = 'status '; VEIO = resp.status(); }   // nem roda
           else if (fora && !LIBERA(resp, cred, de)) marca = 'cors ';   // o navegador não entregaria a resposta
           else {                                       // chega como chegaria; fora do status, reprova no fim
             const certo = e ? (e.status ?? (s => s < 400))(resp.status())
               && (!e.resposta || e.resposta(await resp.text()) === true)   // 200 com o erro no corpo também reprova,
               : pagina || resp.status() < 400;           // e o arquivo do build que falha: a tela vem sem o script
             if (!certo) RUIM.push(`${m} ${resp.status()}${e?.resposta ? ' ou a resposta' : ''} ${t} ${QUEM(o)}`);
             const cab = resp.headers(), rel = ['nel', 'report-to', 'reporting-endpoints'].filter(k => k in cab);
             for (const k of rel) delete cab[k];      // sem endpoint de relatório: o envio dele não passa pelo route
             await r.fulfill(rel.length ? { response: resp, headers: cab } : { response: resp });
             return await SOLTA(resp);
           }
         }
       } catch { marca = 'erro '; }
       await SOLTA(resp);
       const linha = `${marca}${m} ${t} ${QUEM(o)}`;   // sem caminho; num Set, a página que tenta sem parar não enche a
       CORTADO.add(linha);                             // memória. Todo corte fora do PREVISTO reprova, de todo tipo: a
       if (!PREV(u, m, c, t)) FALTOU.add(linha);       // imagem nova do analytics, a da lista repetida ou a que não
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
       ? [`${p.m} da entrada ${i}${TARDE[i] ? ' (só depois do fim)' : ''}`] : []);   // a evidência veio antes dela
     if (NAO.length) { passo = `conferir as chamadas (não houve: ${NAO.join(', ')})`; throw new Error(); }
     if (FALTOU.size) { passo = `conferir o que foi cortado (${[...FALTOU].slice(0, 10).join(', ')})`;
       throw new Error(); }                            // a tela pode mostrar sucesso sem a chamada que faltou
     if (RUIM.length) { passo = `conferir as chamadas (${RUIM.join(', ')})`; throw new Error(); }   // a tela mente
   } catch (e) {                                     // a mensagem do erro traz URL e texto da página: sai só o passo
     const c = [...CORTADO].slice(0, 10).join(', ');   // e o que foi cortado, que não tem caminho nem host
     throw (ERRO = new Error(`falhou em ${passo} (${e.name})` + (c ? ` · cortado: ${c}` : '')));
   }                                                 // fecha também na falha; antes do adiado e do apagar (passo 4),
   finally {                                         // mas só depois das que estão no ar: fechar com uma no meio fez o
     FECHADO = true; const sem = await ctx.setOffline(true).then(() => true, () => false);   // a pausada que o route
     if (!sem) { FALTOU.add('rede ligada no fim'); if (ERRO) ERRO.message += ' · rede ligada no fim'; }   // ainda não
     do { while (VOO.size) await Promise.allSettled([...VOO]);   // viu, o fechar a soltava na rede (medido); sem rede,
       if (!sem) await new Promise(f => setTimeout(f, 500));   // ela falha; com a rede ligada, espera ela chegar ao
     } while (VOO.size);                               // route (que, fechado, aborta) e só então fecha — e reprova
     await Promise.allSettled([ctx, ...ABERTO.values()].map(c => c.close()));   // um não segura o outro
   }                                                 // a de dados que chegou enquanto fechava também reprova
   if (FALTOU.size) throw new Error(`falhou em conferir o fim (${[...FALTOU].slice(0, 10).join(', ')})`);
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
   anotado na `🧪`, presente em toda linha que ela cria — é por ele que se apaga, e por isso toda marca o leva:
   `criado_por = 'shs-<código>'` · nome/tema/título com prefixo `[shs] <código>` · lead com e-mail
   `shs+AAAA-MM-DD-<código>@alma-petra.test` · UTM `utm_source=shs&utm_content=<código>`; marca sem o código (`'shs'`
   sozinho) não acha a linha desta checagem sem pegar a de outra.
   **Antes de escrever em produção, confirmar que dá para recolher tudo o que o caminho grava** — inclusive telemetria e
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
   que reprocessa, webhook que pode chegar horas depois, job que tenta de novo depois do recolhimento) — → a escrita vai
   à prévia isolada, e, se a pergunta era sobre produção, o veredito diz que a produção não foi provada; transação
   desfeita só quando o caminho inteiro cabe nela, com `set constraints all immediate` depois das instruções, logo antes
   do `rollback`, e com o censo da transação desfeita passando (passo 2); senão, fronteira. Ao fim, com o navegador
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
  isolada do PR — na produção, a geração gastaria uma das 20 vagas do dia, que apagar a linha não devolve.
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
  recolhimento do passo 4, publicou, mexeu em conta de cliente, mandou mensagem a pessoa de fora, expôs credencial ou
  dado de cliente (no chat, no log, num print), deixou dado de teste sem recolher, disparou medição (pixel, analytics,
  conversão, gravação de sessão, aviso de erro) ou alargou o alcance do agente (rede, permissão, credencial) → erro
  classe A: linha nova em `docs/ops/SHS-QUARENTENA.md` no mesmo ato, num PR do hub com `SHS-QUARENTENA` no título (é por
  ele que as outras sessões acham a linha antes do merge; em repositório AIOX, quem abre o PR é o `@devops`, a quem a
  Constitution reserva o push e o PR: a sessão escreve a linha e delega a ele no mesmo ato), sem dado de ninguém
  (persona genérica e repositório, classe do erro, hashtag do chat — nunca nome de cliente, conta, e-mail, id ou o que
  vazou), e a história do caso no histórico da regra. A persona passa a exigir "sim" do Lucas por 30 dias — o passo 1 lê
  a lista antes de rodar; a linha só sai pela data.

*v1.1 · 2026-10-14 (v1.0 em 13/10) · fonte única: `Lucas-Contexto-Geral/.claude/skills/simulacao-humana-sintetica/SKILL.md`,
no hub — nos irmãos este arquivo é cópia do `scripts/sync-rules.mjs` (3º canal) e não se edita lá · deploy no claude.ai
de cada conta Max: enviar esta pasta.*

🕒 2026-10-14 14:44 (São Paulo) · ✍ lucasscudeler · 💬 🔥 !! 16/10 · A75 · CANON SHS → escolher teto e teste do banco; rodada 42 · #chat-4BNJMe
