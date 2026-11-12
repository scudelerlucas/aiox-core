---
name: sotad
description: "!SOTAD — State Of The Art Design: a pilha de design da casa para uma tela, página ou peça (frontend-design → ui-ux + !SOTAMG → !shs → !estressar³). Direção de arte, a régua de 12 e a régua de 7 do movimento por cima, medida antes e depois no lugar do operador, endurecida até 3 rodadas limpas. Ativar SOMENTE com o comando escrito: !SOTAD <tela ou peça>; sem alvo, uma pergunta e para."
---

# !SOTAD — State Of The Art Design (v1.0 · 02/11/2026)

> Ordem do operador (`#chat-wE99Fh`, 02/11): *"crie uma skill nova de empilhamento de skills de design, com !arsenal e !estressar³ e
> chame ela de !SOTAD"*. É a **8ª pilha nomeada** do arsenal (`.claude/skills/arsenal/SKILL.md` §🧱; mecânica em `arsenal-pilhas`).
> O `D` é **Design**. Irmã do `!SOTAMG` (movimento): o SOTAMG é um membro desta pilha, não o contrário.

**Sem alvo** (`!SOTAD` sozinho) → uma pergunta: *"qual tela, página ou peça?"* e para. **Com alvo** → a sequência abaixo, nesta ordem.

## A pilha
| # | Arma | Operador | O que acrescenta |
|---|---|---|---|
| 1 | `frontend-design` (plugin `frontend-design:frontend-design`; `dataviz` quando há número) | → | direção de arte: tipografia, cor, hierarquia, ritmo de leitura, **estados** (vazio, erro, espera, sucesso); código que a casa consegue manter |
| 2 | `ui-ux` **+** `!SOTAMG` | + (lentes) | a régua de 12 (`docs/arsenal/UI-UX-PRINCIPIOS-CANONICOS-v1_0.md` §3; B11) marca o que falta sem reescrever; o movimento entra pela régua de 7 do `!SOTAMG` (um momento por tela, tokens `--dur-casa-*`, redução de movimento, CLS 0, JS novo ≤ 30 KB) |
| 3 | `!shs` | → | **mede antes e depois** no lugar do operador: fotos 1280/390 (claro/escuro), CLS, LCP, peso em KB, rolagem lateral = 0, só-teclado, zero erros de página; travas da regra `simulacao-humana-sintetica` |
| 4 | `!estressar³` | → | *"como esta tela morre?"* — MF → uma guarda concreta cada; até 3 rodadas limpas; sem guarda, amputa |

**Tier:** Fable (puxado pelo `!estressar³`; `model-routing`). **Cinco armas → custo estimado (US$) declarado antes de rodar.**

## O que "estado da arte" quer dizer aqui (a régua, não o adjetivo)
1. **Uma ação primária por tela** e um momento de movimento por tela — tudo o mais é apoio (régua 1 do `ui-ux`, régua 1 do `!SOTAMG`).
2. **Leve antes de bonito:** peso da página e do JSON medidos; nada carrega antes do gesto quando pode esperar (prévias e carrosséis da Mesa vI 2.15 são o precedente: 0 pedidos antes do gesto).
3. **Significado antes de ornamento:** cada cor, tipo e movimento responde "o que a pessoa entende a mais?" — sem resposta, sai.
4. **Dois temas, duas larguras, dois modos:** claro/escuro, 1280/390, com e sem movimento. Falhou em um, não passou.
5. **Reversível:** chave em tempo de execução ou `?x=off`, tag de retorno, `git revert -m 1` escrito no PR (`versionamento-e-rollback`).
6. **A cascata:** o que nasce na Mesa nasce como bloco `@casa/<bloco>` quando serve a mais de uma casa (`docs/casas/mesa/ADR-CASCATA-DA-MESA-v1_0.md`).

## Ferramenta certa por tamanho do pedido
| Pedido | Ferramenta |
|---|---|
| uma tela ou componente | `frontend-design` + esta pilha |
| ≥ 3 telas que precisam falar a mesma língua | agente `design-system` (Brad Frost: tokens, consolidação, componentes) antes do passo 1; checklists em `squads/design/checklists/` |
| gráfico ou número que muda | `dataviz` dentro do passo 1 |
| imagem, ícone, capa | `nano-banana-generator` dentro do passo 1 |
| vídeo, reel, peça animada para rede | `hyperframes` ou `remotion-*` (fora da tela viva) |

## Saída
**Um produto só** (a tela ou peça, no PR) com o placar no fim — qual arma acrescentou o quê — e o selo
`[ARSENAL: !SOTAD · executada · <arma ✓ o que acrescentou>]`. As medidas de antes e depois vão em `docs/casas/<casa>/fotos-<versão>/` com `medidas.json`.

## Sinal de violação
Tela entregue "bonita" sem medida de antes e depois · régua de 12 ou de 7 citada sem número · movimento com número solto fora dos tokens ·
`!SOTAD` rodado sem alvo · pilha que afrouxa uma guarda do `!estressar³` para caber no prazo.

🕒 2026-11-02 10:19 (São Paulo) · ✍ almapetra.ltda · 💬 🔥📣 !! 09/11 · A70 · ALMA PETRA CONTEÚDO → manter ou desligar leitura semanal · #chat-wE99Fh
