---
name: arsenal
description: >-
  Catálogo das armas de auditoria e decisão do Lucas (Arsenal Pandora × FABLE ×
  AIOX). Use SEMPRE que precisar escolher QUAL ferramenta aplicar — decisão
  ("A ou B?", problema longo/ambíguo → !atom), diagnóstico de pessoa (!compasso),
  negócio/caixa travado (!GARGALO), endurecer artefato (!estressar), tribunal de
  decisão (!forja), validar regra nova contra o passado (!validar), teoria/canon
  (PRT, PVE), ou técnico AIOX (@qa, @data-engineer). Traz score, contexto e
  gatilho de cada arma. Fonte: IO v4.1.21 + MAESTRO v1.3 + AIOX PRO v5.0.3.
---

# ARSENAL — Armas de Auditoria e Decisão

> Catálogo universal. Consulte para **nomear a causa certa** e escolher o
> instrumento. Score 0-10 = potência de nomear a causa certa (precisão ×
> validação empírica × sinal/esforço). Diagnóstico sem instrumento é opinião.

## 🎯 DECISÃO & ESTRATÉGIA
| Score | Arma | Contexto | Gatilho |
|---|---|---|---|
| 9,5 | `!atom v2` | Separa essencial de gordura + veredito | "A ou B?" · input >2000 chars · ambiguidade → AUTO |
| 9,0 | `!validar` | Antes de canonizar arquitetura/regra nova (≥80% em 5-7 eventos) | "vou canonizar X" → SUGERIR |
| 8,5 | C3 Agnosia | Pontos cegos — "não sei o que não sei" | "não sei" declarado → explícito |
| 8,0 | `!estressar` | Endurecer resposta/artefato até 3 turnos limpos | G1 irreversível · G2 ontológico → SUGERIR, nunca auto |
| 8,0 | §0 Preventiva | ANTES de construir qualquer coisa substantiva | intenção de construção → AUTO |
| 7,5 | `!forja` | Tribunal 5 conselheiros + Assento 13 | decisão grande + impasse → explícito |

## 👤 PESSOA & RELAÇÃO
| Score | Arma | Contexto | Gatilho |
|---|---|---|---|
| 9,0 | `!compasso` (1 pessoa) | Ler pessoa: perfil média+mín+regime | "avalia essa pessoa" · perfil anexado → AUTO |
| 8,5 | `!compasso` (2 pessoas) | Sócio/casal/contratação sob carga | "esses dois fecham sociedade?" → AUTO |
| 7,5 | TGIR/MOR | Trava = objeção relacional (6 posições de vínculo) | "pessoa travada/não age" → explícito |

## 💰 NEGÓCIO, CAIXA & OPERAÇÃO
| Score | Arma | Contexto | Gatilho |
|---|---|---|---|
| 9,0 | `!GARGALO` | UMA restrição, ciclo 12 semanas | planilha · "por que não cresce" · cash-in≠faturamento → AUTO |
| 8,5 | OP3LIF (LIF) | Auditar plano pelos modos garantidos de fracasso | "audita esse plano" → via `!decidir` |
| 8,0 | RETROFORJA rf/rfs/rfm | Predição→resultado→delta | diária 7h · dom 8h · dia 1 |
| 7,0 | `!pentar` | Produto vs 5 pilares (débito 3+ = NÃO-CANON) | oferta indo pra esteira → SUGERIR |

## 📚 TEORIA & CANON
| Score | Arma | Contexto | Gatilho |
|---|---|---|---|
| 9,0 | PRT 7 gates | Doc teórico antes de canon/submissão | tese pronta → via `!acadêmico` |
| 8,0 | PVE | Fontes/conselheiros — anti-atribuição inventada | qualquer citação de autoridade → embutido |
| 8,0 | Falsificação 90d | A regra virou teatro? F1-F4 vs evidência | data marcada da ADR |
| 7,5 | DPS M1/M2/M3 | Insight real ou ruído bonito? (60s) | padrão detectado → AUTO silencioso |
| 7,0 | `!comprimir` | Sobrevive à compressão (criança/leigo/PhD)? | público + alta estaca → SUGERIR |

## 🧲 PRODUTO, LEAD & ALUNO
| Score | Arma | Contexto | Gatilho |
|---|---|---|---|
| 8,0 | IDFORGE/Quiz | Atributo amputado → routing de produto | lead/aluno novo → via N3 |
| 7,5 | 9D Canon Kit | Lacunas nos 12 docs fundacionais | expert novo → via N3 |
| 7,0 | VEDAS | Agente/prompt fraco antes do deploy | agente IA pronto → pedir |

## 💻 TÉCNICO (AIOX PRO — Claude Code/terminal)
| Score | Arma | Contexto | Gatilho |
|---|---|---|---|
| 8,0 | `@qa *risk-profile` `*nfr-assess` `*gate` | Risco/NFR antes de deploy | story pronta pra merge |
| 8,0 | `@data-engineer *security-audit` | RLS/segurança Supabase | mudança de schema/policy |
| 7,5 | `*ids impact {entity}` | Quem quebra rio abaixo | antes de alterar entidade compartilhada |
| 7,0 | `aiox doctor --fix` | Ambiente quebrado · reproduzir bug | erro de setup |

## ⭐ TOP 5 GERAL
`!atom v2` (9,5) · `!GARGALO` (9) · `!compasso` (9) · PRT (9) · `!validar` (9)

## 🔒 TRAVAS CANÔNICAS (inegociáveis)
- `!estressar` `!forjar` `!forja` `!validar` `!pentar` `!comprimir` = **explícito-only**: Claude **sugere** (⚙), nunca executa sozinho.
- **git push = exclusivo `@devops`.**
- Classes **ontológico / teológico / familiar / identidade** = decisão **volta pro Lucas**, nunca decidida pela IA.
- Cristo/Logos é fundamento — nenhuma arma dilui.

## 🚦 SEMPRE ATIVAS (sem comando)
VITA FRAIS (qualidade) · PCS-Detector+DPS (seeds) · §0 preventiva · gate de checkpoint · drift canon×memória.

---
*Catálogo de referência, não-canônico. Detalhe completo em `.claude/arsenal/one-pager-arsenal-pandora-v1.md`. Material restrito (ALMA PETRA operador, playbooks comerciais, auditorias de cliente) NÃO vive aqui — fica só na fonte canônica privada.*
