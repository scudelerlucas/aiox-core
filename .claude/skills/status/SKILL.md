---
name: status
description: "!status [tema | completo] — painel de progresso por FRENTE, em português, visual e baseado em evidência, para tarefa longa (mais de uma sessão, 3+ frentes ou PRs encadeados): cor do estado (🟢 concluído e validado · 🟡 em execução de fato · 🟠 bloqueado/aguardando · 🔴 falha confirmada · ⚪ não iniciado ou sem dados), % por marcos observáveis definidos antes (reparo = 4 marcos de 25 %: diagnóstico confirmado, correção preparada, correção aplicada, validado no uso real), barra de 4 blocos, e o que mudou desde o último painel. Previsão de término em faixa, com confiança, premissas e data/hora com fuso, separando trabalho ativo, espera e tempo corrido; nunca prazo tirado só do %. Guarda a 1ª previsão e todas as revisões com o motivo; bloqueio de duração desconhecida = término indeterminado + estimativa condicional depois da liberação. Ao concluir, compara o real com a 1ª previsão e com a última (dentro da faixa, antecipado ou atrasado, e por quanto), com causas comprovadas, o que não foi medido e um ajuste concreto. Nunca inventa %, trabalho em andamento, prazo nem histórico de precisão; N/D quando não há base. Não autoriza nada. Ativar em: !status, !status <tema>, !status completo."
---

# !status — painel de progresso por frente (v1.1 · 03/11/2026)

> **v1.1 (ordem do operador, 02/11/2026 23:13, `#chat-SxPeMP`):** *"mantenha as barras coloridas e o percentual baseado em
> marcos verificáveis. Inclua tempo restante em faixa, confiança, premissas e data/hora prevista de conclusão com fuso. Separe trabalho
> ativo de espera e tempo corrido. Nunca estime prazo apenas pelo percentual. Preserve a primeira previsão e todas as revisões (…).
> Essa atualização deve ser universal para todos os repos e contas."* Íntegra no adendo do [`PROMPT-PORTATIL.md`](PROMPT-PORTATIL.md).
> Viaja aos 12 irmãos pelo 3º canal do `scripts/sync-rules.mjs` (antes só o hub tinha a skill).

> Ordem do operador, 02/11/2026 21:13 (`#chat-dzCbTV`): *"adicione esse comando no arsenal quando for fazer tarefas muito longas"*,
> com o prompt portátil colado no chat (íntegra em [`PROMPT-PORTATIL.md`](PROMPT-PORTATIL.md), para colar em projeto do claude.ai ou em
> outro assistente). Esta skill é a forma da casa: o mesmo comportamento, ligado às regras que já valem aqui.
>
> **Irmão do `!tarefas`, não substituto:** o `!tarefas` conta **tarefas** (`feito/total` com unidade, barra de 10 casas, script
> `render.py`); o `!status` mede **frentes** por **marcos** (barra de 4 blocos), separa fato de relato e de hipótese e diz o que mudou
> desde o último painel. Pedido de "quantas fotos faltam" → `!tarefas`; pedido de "onde estamos em cada frente" → `!status`.

## Gatilhos
| Comando | O que mostra |
|---|---|
| `!status` | as frentes ativas deste chat, na prioridade mais recente que o Lucas deu |
| `!status <tema>` | só aquele tema (frente, PR, casa); tema ambíguo → 1 pergunta e para |
| `!status completo` | as frentes + pendências e critério de conclusão de cada uma |

**Quando usar sem ser chamado:** em tarefa longa, a sessão **oferece** em 1 linha (`⚙ !status`) ao fechar um marco; não monta o painel
sozinha. É explícito, como o resto do arsenal de entrega.

## Antes de responder
1. **Reaproveitar a evidência que já existe no chat** e conferir **só o que pode ter mudado**, com as ferramentas que a sessão já tem
   (estado do PR e do CI, `git log`, arquivo, rotina). Nada de auditoria longa para atualizar painel: o custo de um `!status` é uma ou
   duas leituras, não um turno inteiro.
2. **Sem acesso agora** → a linha diz a data e a hora da última verificação. Sem acesso não quer dizer que falhou.
3. **Cada afirmação tem classe** (é a régua de `procedencia-numero-com-selo` aplicada ao painel):
   `medido HH:MM` (fato verificado neste turno) · `visto dd/mm HH:MM` (verificado antes, não remedido) · `relato do Lucas` ·
   `hipótese` · `N/D` (informação indisponível).
4. **Não inventar** trabalho em andamento, ferramenta, arquivo, teste, percentual, resultado nem prazo.

## Formato
```
STATUS • 2026-11-02 21:15 • São Paulo

🟢 LOGIN DO MÁRCIO • 100 % (4/4 marcos)
🟩🟩🟩🟩
Estado: na main e com ponto de volta.
Concluído: merge 605d01b (medido 21:11); tag casa-alma-petra-vI2.21-final → c77003fa (medido 21:11).
Falta/bloqueio: o primeiro login real é do Márcio (fronteira: sessão dele).
Próximo passo: avisar o Márcio — Lucas.

🟠 REGRA DOS NOMES • 75 % (3/4 marcos)
🟧🟧🟧⬜
Estado: verde e sem conflito, esperando merge.
Concluído: Codex sem achado no head a54d4f7 (medido 21:03).
Falta/bloqueio: merge de governança, que é do Lucas.
Próximo passo: mergear o #2531 — Lucas.
Tempo: corrido 2 h 10 = ativo 0 h 45 + espera 1 h 25 (medido 21:15).
Falta: ativo 10–25 min + espera indeterminada (merge do Lucas).
Término: indeterminado — depende do merge do Lucas. Depois do merge: 10–25 min (se mergear às 22:00 → 22:10–22:25, UTC−03:00).
Confiança: média — CI e Codex medidos hoje; o tempo do merge não tem base.
Premissas: CI 5–8 min (medido 3× hoje) · Codex revisa em 5–15 min (visto 2× hoje) · nenhum achado novo.
Previsões: v1 20:40 → 21:30–22:00 · v2 21:15 → indeterminado (o merge passou a ser de governança, do Lucas).
```
As seis linhas de tempo (`Tempo`, `Falta`, `Término`, `Confiança`, `Premissas`, `Previsões`) entram em toda frente que não está 🟢;
frente 🟢 troca as seis pelo **fechamento da previsão** (abaixo); frente ⚪ sem marcos definidos escreve só `Término: N/D — sem marcos
para estimar`. O nome da frente é o que o Lucas usa (o TEMA do título do chat), não o nome técnico. A linha de carimbo `🕒` da resposta continua sendo a
linha 2 (`response-protocol`); o cabeçalho `STATUS • …` repete a mesma hora medida.

## Cores
| | Quando |
|---|---|
| 🟢 | concluído **e validado** no escopo declarado |
| 🟡 | execução **de fato** em andamento: algo está rodando agora (CI, rotina, tarefa do Codex) com prova |
| 🟠 | bloqueado ou aguardando ação ou dependência (inclui "espera o Lucas") |
| 🔴 | falha confirmada ou risco crítico observado |
| ⚪ | não iniciado, ou sem dados suficientes |

## Percentual — marcos, não sensação
- **Marcos observáveis, definidos antes de calcular**, e a base escrita ao lado do % (`3/4 marcos`).
- **Reparo (padrão):** 4 marcos iguais de 25 % — (1) diagnóstico confirmado · (2) correção preparada · (3) correção aplicada ·
  (4) resultado validado no uso real. Diagnóstico parcial não prova todas as causas: bug diferente vira linha própria.
- **Outros projetos:** marcos próprios, nomeados no `!status completo`. Na casa, o padrão de entrega é: PR aberto e pronto · revisão
  sem achado no head · merge · validado em produção (SHS ou uso real). Escopo ou denominador desconhecido → **N/D**, nunca um número.
- O % é de **marcos**: não é tempo, esforço, qualidade nem funcionalidade. **Nunca média global** de frentes com escopos diferentes.
- **Não sobe** por tentativa, tempo gasto ou mensagem a mais. **Regride** quando uma evidência derruba um marco, com o motivo na linha.

## Barras
Quatro blocos, um por 25 %: `⬜⬜⬜⬜` · `🟨⬜⬜⬜` · `🟨🟨⬜⬜` · `🟨🟨🟨⬜` · `🟩🟩🟩🟩`. A cor dos blocos cheios acompanha o estado
(🟧 bloqueado, 🟥 falha, 🟨 andando, 🟩 só em 100 % validado): bloqueada em 50 % = `🟧🟧⬜⬜`. N/D = *"sem base para calcular"*, sem barra.

## Previsão de término — faixa, não ponto; nunca tirada do %
O % diz **quanto** dos marcos está feito; não diz **quando** acaba. A previsão é calculada à parte, **marco por marco do que falta**:
1. **Para cada marco restante**, o trabalho ativo que ele pede e as esperas que ele tem (CI, revisão do Codex, deploy, terceiro, Lucas),
   cada um com selo (`procedencia-numero-com-selo`): `E` medido neste chat ou em tarefa igual registrada · `P` projetado com a
   premissa escrita · `H` sem base. Proibido: *"75 % em 3 h → falta 1 h"* — a regra de três sobre o % é a violação central desta seção.
2. **Faixa**, sempre: `mín–máx` de trabalho ativo + espera. A faixa larga é a informação certa quando a base é fraca; ponto único só
   quando o marco restante é um processo medido e repetido (CI de 6 min já visto 3×).
3. **Término previsto** = hora da medição + faixa, escrito como **data e hora com fuso** (`03/11 21:30–22:00, UTC−03:00 (São Paulo)`).
   Janela noturna ou espera de horário comercial entram na conta e na premissa.
4. **Confiança**, uma palavra e o porquê: **alta** (todos os marcos restantes com duração `E` e sem dependência de pessoa) · **média**
   (parte `E`, parte `P`) · **baixa** (maioria `P`/`H`, ou depende de terceiro). Sem número de probabilidade inventado; probabilidade só
   quando a previsão for registrada no diário de previsões (`docs/previsoes/`), que é onde ela vira Brier.
5. **Premissas**, as que derrubam a previsão se falharem (sem achado novo, sem conflito, Lucas responde hoje).

**Três relógios, nunca somados por baixo do pano:**
- **Tempo corrido** — do início da frente (1º turno que a abriu) até agora, relógio de parede.
- **Trabalho ativo** — soma dos turnos em que a sessão trabalhou na frente (início e fim de turno medidos pelo relógio da sessão ou
  pelos eventos do chat, `list_events`). Sem como medir → `N/D` ou `estimado`, nunca um número limpo.
- **Espera** — o resto, separado por motivo quando importa (Lucas · CI · Codex · terceiro). Ocioso sem motivo conhecido é espera
  "sem dono", e se diz isso.

**Bloqueio de duração desconhecida** (decisão do Lucas sem data, terceiro, acesso, cota): `Término: indeterminado — depende de <quê>`.
Ao lado, **só** a estimativa condicional: `depois da liberação: <faixa> de trabalho ativo + <esperas conhecidas>`, e no máximo um
exemplo de conta (`se liberar às 22:00 → …`). Nunca uma data final que esconda o bloqueio.

**Previsões — nada se apaga.** A primeira previsão da frente (`v1`) fica no painel até o fim; cada revisão vira `v2`, `v3`… com hora e
**motivo comprovado** (marco caiu, achado novo, escopo mudou — e o que entrou ou saiu dele —, espera maior que a premissa, bloqueio).
Revisão sem motivo é proibida; revisar só para "acertar" depois do fato, também. No `!status` comum mostram-se a `v1` e a última; no
`!status completo`, todas. Frente que atravessa sessões leva o histórico no handoff do próprio chat (kernel item 10), seção
`Previsões do !status`, para o chat seguinte não recomeçar da `v1`.

## Fechamento da previsão (quando a frente chega a 🟢)
```
✅ REGRA DOS NOMES • concluída 03/11 00:40 (UTC−03:00) • corrido 3 h 35 = ativo 1 h 05 + espera 2 h 30
Contra a v1 (21:30–22:00): atrasado 2 h 40 além do fim da faixa.
Contra a última (v3, 00:20–00:50): dentro da faixa.
Causas comprovadas: o merge virou decisão de governança (evidência: #2531, 21:11); 2ª rodada do Codex (achado P2, 23:40).
Não medido: quanto da espera foi o Lucas fora do ar × fila da notificação.
Ajuste para tarefas parecidas: PR que toca `.claude/rules/**` nasce com espera do Lucas como premissa e término indeterminado na v1.
```
- **Dentro da faixa** = real entre o início e o fim da faixa; **antecipado** = antes do início (por quanto, a partir do início);
  **atrasado** = depois do fim (por quanto, a partir do fim). Sempre contra as **duas**: a 1ª e a última.
- **Causas comprovadas** = só as que têm evidência (link, hora, commit); suspeita vai como hipótese, separada.
- **Não medido** = o que ninguém mediu e poderia mudar a conclusão. Sempre ao menos uma linha, ou "nada relevante".
- **Ajuste concreto**, um só, testável na próxima tarefa parecida (premissa a mudar, espera a incluir, marco a dividir). É hipótese a
  conferir, **nunca** promessa de que a próxima previsão vai acertar.
- **Registro:** uma linha em `docs/ops/STATUS-CALIBRACAO.md` do hub (pela API do GitHub quando o hub não está clonado; sem acesso → a
  linha fica no handoff do chat e o painel diz isso). **Histórico de precisão só se cita a partir dessas linhas**, com quantas são;
  menos de 5 de tarefas parecidas = *"sem histórico suficiente"*.

## Honestidade (as frases que esta skill existe para impedir)
- Plano não é execução · patch pronto não é aplicado · teste isolado não é validação completa · conexão não é funcionamento ·
  enviado não é recebido · PR aberto não é mergeado · mergeado não é validado em produção.
- **100 %** só com todos os critérios do escopo comprovados, e com as limitações que restam escritas.
- Estimativa não vira fato; **sem prazo inventado** — previsão sempre em faixa, com confiança, premissas e dependências (seção acima).
- **Sem "em segundo plano"** sem uma execução real iniciada e visível (tarefa, rotina, CI com id).
- Não repetir pedido de autorização já atendido; autorização não remove trava técnica nem limite de segurança.
- **O comando não autoriza nada:** instalar, apagar, reiniciar, gastar, enviar mensagem, ligar conta ou ampliar acesso continuam com as
  regras deles (`chave-meta-acesso-total`, `git-main-protegida`, `ssr-siga-sua-recomendacao` item 3).

## Fechamento
Depois do painel, o fechamento da casa (`response-protocol`), curto e já no formato do `!status`:
- **✅ Resumo simples** = *o que mudou desde o último painel deste chat*, inclusive previsão revista e por quê (sem painel anterior →
  "primeiro painel"; nada mudou → dizer isso, sem inflar);
- **🔀 Decisões** = só as que são mesmo do Lucas; **👉 Recomendação** e **⚠️ Riscos** em 1 linha cada, quando houver decisão;
- **🧭 Passo a passo (!PPL)** = até **3** próximos passos, por prioridade, com quem executa.
Não repetir link que o Lucas disse que não abre.

**"continue" depois de um painel:** a sessão segue com o trabalho autorizado e possível. Se tudo depende de acesso ou decisão, diz
exatamente qual — sem simular execução e sem repetir a mesma tentativa.

## Violação
% sem base escrita · 🟢 sem validação · 🟡 sem nada rodando · média de frentes incomparáveis · % que subiu sem marco novo · marco
derrubado sem regressão · prazo inventado · "rodando em segundo plano" sem execução · painel usado como autorização · auditoria longa
para atualizar painel · **prazo tirado só do %** · previsão em ponto sem base medida · hora sem fuso · ativo e espera somados sem
separar · `v1` apagada ou reescrita · revisão sem motivo · data final escondendo bloqueio de duração desconhecida · fechamento sem
comparar com a 1ª e a última previsão · histórico de precisão citado sem as linhas do registro · ajuste vendido como garantia.

*Norma da casa. Prompt portátil (texto do operador, íntegro): `PROMPT-PORTATIL.md` nesta pasta.*

🕒 2026-11-02 21:18 (São Paulo) · ✍ arborcactus · 💬 ✋🏗️ !!! 04/11 · A70 · ALMA PETRA DEVOPS → mergear #2531 (nomes) · #chat-dzCbTV

🕒 2026-11-02 23:15 (São Paulo) · ✍ almapetra.ltda · 💬 📜 !! 05/11 · A60 · TRANSVERSAL !STATUS → previsão de prazo nos 13 repos · #chat-SxPeMP
