# Missão de navegador — coletar a evidência do erro 500 do LifeBoard

> **Para:** Claude on Chrome (ou o Lucas, à mão — os passos são os mesmos)
> **Por que existe:** a sessão do Claude Code não alcança painel nenhum. Tudo aqui é **leitura**.
> **Data:** 15/09/2026 · **Volta para:** o laudo `packages/lifeboard/DIAGNOSTICO-500-troca-de-projeto-2026-09-15.md`

## NÃO FAÇA — leia isto antes de qualquer clique

- **Não edite, não salve, não apague nada.** Nenhum botão *Save*, *Edit*, *Redeploy*, *Delete*.
- **Não revele o valor de nenhuma chave, segredo ou senha.** Nem no relatório, nem no chat, nem
  em captura de tela. Só os **nomes** das variáveis e os **20 primeiros caracteres** de uma URL.
- **Não mude configuração de rede, permissão ou segurança de ambiente nenhum.** Se algo pedir
  isso, pare e devolva a missão dizendo onde parou.
- **Não troque o projeto Supabase de volta nem para frente.** A decisão é do Lucas, depois do laudo.
- Se uma tela pedir login que você não tem, **pare e relate** — não tente contornar.

---

## M1 — A linha de log do erro 500  ⬅ é o item decisivo

1. Abra `https://vercel.com/scudelerlucas-projects/aiox-core-lifeboard`
2. Aba **Deployments**. Ache a publicação de **15/09/2026** em **Production** (a que foi feita
   quando as variáveis apontavam para o projeto novo, e depois revertida).
3. Abra essa publicação → aba **Logs** (ou **Runtime Logs**). Filtre por **Status 500**, ou pelo
   nível **Error**.
4. Copie **a mensagem de erro inteira**, incluindo o nome do tipo de erro e a rota.
   O que estou procurando, em ordem de valor:
   - `MIDDLEWARE_INVOCATION_FAILED` — confirma que o portão explodiu
   - `TypeError` com algo sobre URL (`Failed to parse URL`, `Invalid URL`) — confirma a hipótese H2
   - Uma sequência de `307` indo e voltando entre `/` e `/login` sem nenhum `500` — aí H2 cai e a
     hipótese é outra (H1: dois bancos em jogo ao mesmo tempo)

**Pronto quando:** você tem a mensagem de erro literal, ou a afirmação de que **não há** nenhum
registro de erro naquela publicação (isso também é resultado, e muda o laudo).

---

## M2 — Quais variáveis de banco existem hoje

1. Abra `https://vercel.com/scudelerlucas-projects/aiox-core-lifeboard/settings/environment-variables`
2. Para **Production** e para **Preview**, anote **só os nomes** que existirem desta lista:

   | Nome | Existe? | Para qual projeto aponta |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | | os 20 primeiros caracteres bastam |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | | **não copie o valor** — só diga se existe |
   | `SUPABASE_URL` *(sem o prefixo)* | | os 20 primeiros caracteres bastam |
   | `SUPABASE_ANON_KEY` *(sem o prefixo)* | | **não copie o valor** — só diga se existe |
   | `LIFEBOARD_LOAD_SECRET` | | **não copie o valor** — só diga se existe |
   | `LIFEBOARD_DATA_MODE` | | este valor pode dizer: `fixture` ou `live` |

3. **Por que isto importa:** se as duas de baixo (sem o prefixo `NEXT_PUBLIC_`) existirem, a
   troca de projeto tem de mexer nas **quatro** ao mesmo tempo. Trocar só as de cima faz a
   entrada pelo Google abrir sessão num banco enquanto o portão procura no outro.

**Pronto quando:** a tabela está preenchida para os dois ambientes, **sem nenhum valor de chave**.

---

## M3 — O login Google do projeto novo

1. Abra `https://supabase.com/dashboard/project/hciiilopyivjaekaxfqp`
   (confirme no alto da tela que o nome do projeto é **`quiz-diagnosys`** — a busca do painel
   filtra por nome, não por esse código, então só a URL direta serve)
2. **Authentication → Providers → Google**: está **ligado**? (sim / não)
3. **Authentication → URL Configuration**: anote a **Site URL** e a lista de **Redirect URLs**.
4. **Settings → API**: a chave pública (*anon* / *publishable*) começa com **`eyJ`** ou com
   **`sb_publishable_`**? **Só o começo — não copie a chave.**

**Pronto quando:** as quatro respostas estão escritas.

---

## M4 — A publicação reconstruiu ou reaproveitou?

1. Ainda em `https://vercel.com/scudelerlucas-projects/aiox-core-lifeboard`, na publicação de 15/09.
2. Procure na aba **Building** / **Build Logs** se aparece algo como *"Restored build cache"* ou
   *"Build cache"*.
3. **Por que importa:** as variáveis com prefixo `NEXT_PUBLIC_` são coladas dentro do programa na
   hora de construir. Se a publicação reaproveitou a construção anterior, o valor antigo foi para
   o navegador enquanto o portão já usava o novo — meio sistema em cada banco.

**Pronto quando:** você sabe dizer se houve reconstrução completa ou reaproveitamento.

---

## Relatório final

Devolva exatamente isto, em português simples:

1. **M1 —** a mensagem de erro literal (ou "nenhum erro registrado").
2. **M2 —** a tabela das duas colunas (Production e Preview), sem valor de chave nenhum.
3. **M3 —** Google ligado? · Site URL · Redirect URLs · a chave começa com quê.
4. **M4 —** reconstruiu ou reaproveitou.
5. **Qualquer coisa que te fez parar** — tela que não abriu, login que faltou, botão diferente do
   que está escrito aqui.

**Nenhum segredo no relatório.** Se em algum momento você estiver prestes a copiar um valor de
chave, pare: não é isso que a missão pede.
