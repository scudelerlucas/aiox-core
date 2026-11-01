---
name: ssr
description: "!SSR — 'siga sua recomendação': o operador aceita exatamente a recomendação da última resposta (seção 👉 Minha recomendação e a opção recomendada de cada decisão A/B/C) e a sessão executa sem reperguntar; `!SSR <texto>` = a recomendação com um ajuste. Nunca destrava Meta, dinheiro, pessoa de fora, chave, apagar dado, merge de governança ou contrato com terceiro — esses voltam como fronteira. Ativar em: !SSR, !ssr, `✅` abrindo a mensagem (alias, decisão 1-A 30/10), 'siga sua recomendação', 'segue a sua recomendação', 'faz o que você recomendou'. Decisão reversível marcada `SSR-auto` dispara sozinha em 2 h (08:00–22:00 SP) se o operador não escrever nada no chat (decisão 2-A 30/10). Vale em todo repositório e toda conta (regra ssr-siga-sua-recomendacao, hub)."
---

# !SSR — siga sua recomendação (v1.0 · 30/10/2026)

> Ordem do operador (`#chat-T9wZQ4`): *"quando eu colocar !SSR significa 'siga sua recomendação'. Se eu escrever isso e mais algo, será um ajuste
> na recomendação."* Irmão do `!PPL` e do `!LDL`: aqueles mudam a forma da resposta; este fecha a decisão. Norma: `.claude/rules/ssr-siga-sua-recomendacao.md`.

## Protocolo (nesta ordem)
1. **Achar o alvo:** a última resposta substantiva deste chat com `👉 Minha recomendação`. Sem ela → *"`!SSR` sem alvo: não há recomendação
   anterior neste chat"* e parar. Recomendação de outro chat não vale.
2. **Montar a decisão:** a recomendação em uma linha + a opção recomendada de cada item de `🔀 Decisões` (A/B/C). Com `<texto>` depois do
   comando, aplicar o ajuste e reescrever a linha (ex.: `!SSR mas o prazo é 15/11` → troca só o prazo).
3. **Conferir o estado:** o que mudou desde a recomendação (PR mergeado, prazo vencido, dado novo)? Mudou → dizer em uma linha; executar o
   que continua válido; nomear o que caiu.
4. **Passar pelas fronteiras:** item que toca Meta, dinheiro, pessoa de fora, chave/segredo/login, apagar dado, merge de `.github/**` ou de
   governança, instrumento que amarra terceiro → **não executa**; devolve `fronteira: <item> — precisa do seu sim nomeando a ação`.
5. **Executar** o resto, de verdade (PR, arquivo, evento, previsão, mensagem interna), com as regras de sempre (`git-main-protegida`,
   `carimbo-pr`, `item-so-entra-com-dono`, SHS antes de pedir checagem).
6. **Responder** começando por `✅ !SSR aplicado: <recomendação em uma linha>` (com o ajuste, se houve); depois o `response-protocol`
   normal (4 seções + `!PPL`). **Registrar** `decisão do operador por !SSR, <hora>` no handoff do chat, na memória e no PR/diário citado.

## O que não é
- `!SSR` não é "pode tudo": só o que a recomendação dizia, e nunca o item 4.
- Não reperguntar depois de um `!SSR` limpo ("confirma?") — é a violação que o comando existe para evitar.
- `✅` abrindo a mensagem é `!SSR` (1-A, 30/10). No meio de frase, é emoji.

## SSR por omissão (2-A, 30/10) — como a sessão marca e dispara
1. Só decisão da **classe reversível** (nada de Meta, dinheiro, pessoa de fora, chave, apagar dado, governança, contrato) pode levar a
   marca `SSR-auto` na seção `🔀 Decisões`; a sessão escreve a hora do disparo ao lado (`SSR-auto às HH:MM`).
2. No fim do turno, `send_later` para si mesma em 2 h dentro de 08:00–22:00 SP (à noite, 10:00 do dia seguinte), mensagem: *"SSR-auto: se o
   operador não escreveu nada depois da recomendação de <hora>, aplique-a; se escreveu, não faça nada e diga em uma linha."*
3. Ao disparar: conferir no transcript se houve mensagem dele depois da recomendação. Houve → cancelado, uma linha. Não houve → executar e
   abrir com *"sem resposta em 2 h, segui a recomendação: …"*; renomear o chat com o mesmo aviso; registrar como `decisão por SSR-auto`.

🕒 2026-10-30 12:50 (São Paulo) · ✍ lsgpandora · 💬 ✋🏗️ !!!! 01/11 · A90 · OS ALMA PETRA SEMENTES → mergear 3 PRs (#2294 #2295 #2297) · #chat-T9wZQ4
