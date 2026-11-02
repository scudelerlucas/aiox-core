---
name: arsenal-pilhas
description: "!pilha — empilhar, cruzar e encadear armas do arsenal numa sequência só (→ encadear · × cruzar · + empilhar), com sete pilhas nomeadas: !investigar, !tribunal, !publicar, !criativos, !caixa, !pessoa, !produto (e !fullforce, a mais antiga). Ativar em: !pilha <arma> <op> <arma> <alvo> ou em qualquer pilha nomeada escrita com '!'. Explícito-only: assunto nunca dispara pilha. Fonte única no hub, §🧱 EMPILHAMENTOS de .claude/skills/arsenal/SKILL.md; esta página é o espelho fino para os repositórios irmãos."
---

# !pilha — empilhamentos do arsenal (v1.0 · 02/11/2026)

> Ordem do operador (01/11/2026, `#chat-8T82by`): *"aumentemos a potência do comando arsenal em todo o ecossistema, com cruzamentos e encadeamentos
> de cada skill e comando, e principalmente EMPILHAMENTOS."* Fonte única: `Lucas-Contexto-Geral/.claude/skills/arsenal/SKILL.md` §🧱 (no hub, o hook
> `arsenal-router.sh` detecta e imprime a receita; fora do hub não há hook — leia esta página e execute). Não edite aqui: o `sync-rules` regrava.

## Os três operadores
| Operador | Lê-se | O que faz |
|---|---|---|
| `→` | encadear | a saída de A é a entrada de B; B não refaz A |
| `×` | cruzar | A e B sobre o **mesmo alvo**, em subagentes separados; uma síntese nomeia onde concordam e onde divergem |
| `+` | empilhar | B é **lente** sobre o produto de A — marca, nunca reescreve |

## Sintaxe
`!pilha <arma> <op> <arma> [<op> <arma>…] <alvo>` — até **5 armas** (mais que isso são duas pilhas; a segunda entra com a saída da primeira). Sem alvo → 1 pergunta e para.

## Pilhas nomeadas
| Pilha | Sequência | Tier |
|---|---|---|
| `!fullforce` | `!atom v2 → !estressar³ → !elenchos → !4z → lint da lei central` | Fable |
| `!investigar` | `!sherlock → !elenchos + !moat` | Fable |
| `!tribunal` | `!atom v2 → !forja → !LDL` (não é `!decidir`, que é o núcleo N2) | Fable |
| `!publicar` | `!slop + humanizer (lente) → scripts/sinais-de-ia-pt.py` | Sonnet |
| `!criativos` | `!mulati → !maxxima × !surreal-casa → !humanos` | Opus |
| `!caixa` | `!GARGALO → !atom v2 → !tarefas` | Fable |
| `!pessoa` | `!compasso → !tipologia + !colegiado-santo` | Fable |
| `!produto` | `!humanos → ui-ux → !shs → !estressar³` | Fable |

## Travas (herdadas, não novas)
- **Explícito-only:** o comando `!` tem de estar escrito. `!estressar³`, `!forja`, `!validar`, `!pentar`, `!comprimir` só entram na `!pilha` livre se escritos nela.
- **Tier da pilha = o mais alto entre os membros** (`model-routing`); sessão abaixo dele pede a troca em vez de executar.
- **Teto:** a pilha conta como **um** domínio; além dela, no máximo duas armas por turno.
- **Nenhuma pilha destrava** Meta, dinheiro, pessoa de fora, chave, apagar dado, merge de governança ou instrumento que amarre terceiro (`ssr`, `chave-meta-acesso-total`, `formalizacao-tardia-como-teste`).
- Pilha com mais de 3 armas declara o **custo estimado** (US$) antes de rodar.

## Saída
**Um produto só**, com o placar no fim — qual arma acrescentou o quê — e o selo `[ARSENAL: !<pilha> · executada · <arma ✓ o que acrescentou>]` (com o `!` e a grafia exata: o `skills-usage.sh` procura a string literal).
Pilha sem disparo em 90 dias entra em *(suspenso)*; falsificador em 01/02/2027: nenhuma pilha além do `!fullforce` disparada → a seção volta a "só `!fullforce`".
