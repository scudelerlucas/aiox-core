---
name: simulacao-humana-sintetica
description: "!shs [alvo] · alias !simular — Simulação Humana Sintética: antes de pedir ao Lucas que confira, teste, abra ou gere algo 'e avise', a sessão vira o humano e faz a checagem no lugar dele — assume a persona (ele no painel, o visitante, o lead), percorre o caminho real (HTTP na prévia/produção, navegador sem tela, rota, banco, script) e relata o medido numa seção `🧪 Checagem sintética`. Mesmas travas do humano (nada irreversível; dinheiro só até US$ 0,50 por checagem e US$ 2,00 por dia; nada na Meta, a pessoa de fora, publicado ou em conta de cliente; dado de teste marcado `shs` e recolhido). Só sobra pedido quando a fronteira é só dele (credencial/sessão/2FA, aprovação exigida por regra, juízo humano) ou o ambiente não alcança, e aí vai até a borda e pede um passo só, com o porquê. Ativar SEMPRE que a resposta for pedir checagem ao operador, em qualquer repositório e conta; e em !shs, !simular, 'simula o humano', 'checa antes de me pedir', 'testa você', 'simulação humana sintética'. NÃO confundir com !mirofish/!sintetica (população sintética: prevê reação de público; esta simula o operador conferindo)."
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
1. **Alvo e persona.** Em 1 linha: *o que* se quer saber (a rota responde? o botão gera? a linha gravou?) e *quem* faria
   isso (Lucas no painel da Casa X · visitante anônimo da página · lead terminando o quiz · membro logado · Codex lendo
   o AGENTS.md). A persona decide o caminho e a credencial: visitante usa o que a página pública usa; o painel usa a
   chave que o painel usa; nunca credencial que o humano não teria.
2. **Caminho real, na camada mais externa que alcança.** Ordem de preferência: (a) navegador sem tela sobre a URL
   (Playwright com o navegador que o ambiente já tem: na nuvem do Claude Code, `executablePath: '/opt/pw-browsers/chromium'`;
   fora dela, o que o próprio Playwright encontra): clique, formulário, texto na tela, print; (b) HTTP na rota
   (`f=$(mktemp); curl -sS -o "$f" -w '%{http_code} %{time_total}' <url>; head -c 2000 "$f"; rm -f "$f"` — o corpo da
   resposta nunca fica dentro do repositório); (c) leitura/escrita no banco
   (MCP do Supabase; preferir `begin … rollback` ou bloco `do $$ … raise exception 'TESTE_OK …' $$` que se desfaz
   sozinho); (d) script do repositório (`npm run`, `scripts/*.sh`). Teste unitário **não** substitui (a)–(c): ele prova o
   código, não o caminho. Sites públicos da casa: `vigia/dominios.txt` (hub); prévia do PR: o link da Vercel no próprio PR.
3. **Mesmas travas do humano.** Nada irreversível · nada de dinheiro fora do teto (US$ 0,50 por checagem, US$ 2,00 por
   dia; acima, pergunta com o número) · nada na Meta (`chave-meta-acesso-total`) · nada a pessoa de fora da casa
   (e-mail, WhatsApp, DM, lista de parceiro) · nada publicado · nada em conta de cliente · nada que amplie o alcance do
   agente (`execucao-remota` §exceção). Prévia por padrão; produção quando a pergunta é sobre produção.
4. **Dado de teste marcado e recolhido.** `criado_por = 'shs'` · nome/tema/título com prefixo `[shs]` · lead com e-mail
   `shs+AAAA-MM-DD-<6 últimos do id da sessão>@alma-petra.test` (único por sessão; é por ele que se apaga) · UTM
   `utm_source=shs`. **Antes de escrever em produção, confirmar que dá para recolher** (apagar a linha, desfazer a
   transação). Não dá — log imutável, fila que se consome, envio a terceiro — → a escrita vai à prévia ou a uma transação
   desfeita, ou vira fronteira. Ao fim, apagar e mostrar que apagou.
5. **Relatar na seção `🧪 Checagem sintética`** (modelo no §4) — persona · caminho · evidência · veredito · dado de teste
   recolhido · custo. A seção vem **antes** do `✅ Resumo simples`, e o `🧭 Passo a passo` perde o passo "confira".
6. **Fronteira, se sobrar.** Só quatro motivos justificam pedir ao Lucas: credencial ou sessão só dele (login no navegador,
   celular, QR, 2FA) · ação que outra regra manda aprovar (dinheiro acima do teto, irreversível, Meta, pessoa de fora) ·
   juízo humano (gosto, voz, decisão de negócio) · alcance: o ambiente desta sessão não chega lá (rede, IP, ferramenta que
   falta) e outro chega, sem alargar o alcance do agente. Mesmo assim: ir até a borda e escrever `fronteira: fiz até X; falta só o seu clique
   em Y, porque Z` — um passo, com link. Depois da fronteira, `execucao-remota` (prompt para quem alcança).

## 4. Modelo da seção
```
## 🧪 Checagem sintética
- **Persona · caminho:** Lucas no painel da Casa Magna → aba Roteiros → "Gerar" (POST /api/casas/magna/roteiros), produção.
- **Evidência:** 201 em 6,8 s; corpo com os 5 blocos (gancho, dor, virada, evidencia, cta); linha `casas_roteiros`
  id `…` status `rascunho`, tema `[shs] teste pós-merge #1664`; contador do dia 1/20.
- **Veredito:** passa — a reserva atômica está no ar; nenhum 503.
- **Dado de teste:** linha apagada (`delete … where id = …`); custo US$ 0,03.
```
Falhou? A seção mostra o erro medido (status, trecho) e o diagnóstico começa na mesma resposta — a falha é da sessão
resolver, não do Lucas reportar.

## 5. Personas da casa (ponto de partida; a sessão descobre o caminho no repositório, nunca inventa URL)
| Persona | Caminho típico | Credencial | Marca do dado |
|---|---|---|---|
| Lucas no painel de uma casa / CRM | tela estática gerada (`npm run tela:casas`), rotas `/api/casas/*` | a mesma chave do painel (variável do ambiente) | tema `[shs]`, `criado_por='shs'` |
| Visitante de página pública / VSL | URL de `vigia/dominios.txt` ou prévia da Vercel | nenhuma | — (só leitura) |
| Lead terminando um quiz | fluxo inteiro até a carta | nenhuma (anon) | e-mail `shs+data-<sessão>@alma-petra.test`; apagar lead e leitura ao fim; parceiro de destino **não** recebe (`nossa-base-e-a-fonte`): prévia, ou supressão só do lead `shs` pelo marcador, se o fluxo já tiver — **nunca** desligar o envio compartilhado (lead real chegando no meio se perderia) |
| Membro logado / área restrita | login de teste **já existente** da casa | só se já existir; nunca criar conta em sistema de terceiro | — |
| Codex / outra CLI lendo regra | no hub (`../Lucas-Contexto-Geral` ou um clone dele): `node scripts/sync-rules.mjs --check`, `bash scripts/rules-drift.sh`; num irmão esses scripts não existem — lá, `diff` do arquivo contra o do hub | — | — |

## 6. O que a SHS não faz
Não decide por ele (gosto, voz, negócio) · não aprova o que a regra manda ele aprovar · não entra em conta de cliente ·
não "testa" com dinheiro real acima do teto · não substitui o campo (`!mirofish` prediz, SHS confere, o campo mede).

## 7. Falsificador e medição
- **Sinal de que funciona:** resposta ao operador sem "confira/teste/me avise" ou com a fronteira nomeada. Contar isso
  exige ler respostas, e `memoria/` guarda só resumos: a contagem quinzenal (amostra de sessões lida por `list_events`,
  pedidos de checagem sem `🧪`, meta **zero**) está por ligar e ainda não tem dono. Até lá, quem mede é o F-SHS-1.
- **F-SHS-1:** duas checagens `🧪` dadas como "passa" que o Lucas depois achou quebradas no mesmo caminho → a evidência
  mínima sobe (print obrigatório em tela; linha do banco obrigatória em escrita) e o caso entra no histórico da regra.
- **F-SHS-2:** simulação que gastou acima do teto sem perguntar, publicou, mexeu em conta de cliente ou mandou mensagem a
  pessoa de fora → erro classe A no diário do domínio,
  e a persona em questão passa a exigir "sim" do Lucas por 30 dias.

*v1.1 · 2026-10-14 (v1.0 em 13/10) · fonte única: `Lucas-Contexto-Geral/.claude/skills/simulacao-humana-sintetica/SKILL.md`,
no hub — nos irmãos este arquivo é cópia do `scripts/sync-rules.mjs` (3º canal) e não se edita lá · deploy no claude.ai
de cada conta Max: enviar esta pasta.*

🕒 2026-10-14 01:17 (São Paulo) · ✍ lucasscudeler · 💬 ✋ !! 16/10 · A75 · CANON SHS → mergear #1708 e os 12 PRs dos irmãos · #chat-4BNJMe
