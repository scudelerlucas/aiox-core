# ONE-PAGER — ARSENAL DIAGNÓSTICO E DE COMANDO · PANDORA × FABLE × AIOX
**Fonte: IO v4.1.21 + MAESTRO v1.3 + AIOX PRO v5.0.3 · Score 0-10 = potência de nomear a causa certa (precisão × validação empírica × sinal/esforço) · 04/jul/2026**

---

## 🎯 DECISÃO & ESTRATÉGIA
| Score | Ferramenta | Contexto de uso | Gatilho específico |
|---|---|---|---|
| 9,5 | `!atom v2` | Qualquer decisão/problema — separa essencial de gordura + veredito | "A ou B?" · input >2000 chars · ambiguidade → AUTO |
| 9,0 | `!validar` | Antes de canonizar arquitetura/regra nova (régua ≥80% em 5-7 eventos) | "vou canonizar X" · regra nova pronta → SUGERIR |
| 8,5 | C3 Agnosia | Pontos cegos — "não sei o que não sei" | "não sei" declarado · board de decisão → trigger explícito |
| 8,0 | `!estressar [FORJA/VITA/PCS]` | Endurecer resposta/artefato até 3 turnos limpos | G1 irreversível · G2 ontológico · G3 cauda · G4 convicção → SUGERIR, nunca auto |
| 8,0 | §0 Preventiva | ANTES de construir qualquer coisa substantiva | intenção de construção → AUTO obrigatório |
| 7,5 | `!forja` | Tribunal 5 conselheiros + Assento 13 para alta estaca | decisão grande + impasse → explícito |
| — | **VERE v0.1** | *Quem* decide: automatiza meio reversível e barato; **para e devolve** em Dinheiro (>R$500) · Pessoas · Canon | embutido no `!atom` · **⚠️ não instalado em nenhum `CLAUDE.md`** — ver `docs/arsenal/vere/README.md` |
| — | **MÉTIS v0.3** | Aposta de longo prazo sob incerteza: `p = α·estrutura + (1−α)·consenso − Λ(entropia)` | previsão com mercado disponível · **skill estrutural real, sem edge de apostas** (backtest) |

## 👤 PESSOA & RELAÇÃO
| Score | Ferramenta | Contexto | Gatilho |
|---|---|---|---|
| 9,0 | `!compasso` (1 pessoa) | Ler pessoa em profundidade: perfil média+mín+regime | "avalia essa pessoa" · doc de perfil anexado → AUTO |
| 8,5 | `!compasso` (2 pessoas) | Sócio/casal/contratação sob carga — Sinergometria | "esses dois fecham sociedade?" → AUTO |
| 7,5* | TGIR/MOR | Trava = objeção relacional; localizar na régua das 6 pessoas | "pessoa travada/não age" → explícito · *sobe ~9 pós-P1 (set) |

## 💰 NEGÓCIO, CAIXA & OPERAÇÃO
| Score | Ferramenta | Contexto | Gatilho |
|---|---|---|---|
| 9,0 | `!GARGALO` | Onde o sistema trava — UMA restrição, ciclo 12 semanas | planilha financeira · "por que não cresce" · cash-in≠faturamento → AUTO |
| 8,5 | OP3LIF (LIF) | Auditar sistema/plano pelos modos garantidos de fracasso | "audita esse plano/sistema" → via `!decidir` |
| 8,0 | RETROFORJA rf/rfs/rfm | Calibração contínua: predição→resultado→delta | `rf` 7h diária · `rfs` dom 8h · `rfm` dia 1 |
| 7,0 | `!pentar` | Produto em escala vs 5 pilares (débito 3+ = NÃO-CANON) | oferta indo pra esteira → SUGERIR |

## 📚 TEORIA & CANON
| Score | Ferramenta | Contexto | Gatilho |
|---|---|---|---|
| 9,0 | PRT 7 gates | Doc teórico/paper antes de canon ou submissão | tese pronta · "roda o PRT" → via `!acadêmico` |
| 8,0 | PVE v1.0 | Tese ontológica contra **testemunha externa hostil** — 3 gatilhos-chave-morta (circularidade · derivação · substrato) | qualquer citação/recrutamento de autoridade → embutido · texto em `docs/arsenal/PVE-v1.0-*` |
| 8,0 | Falsificação 90d | A regra criada virou teatro? F1-F4 vs evidência | data marcada da ADR (10 auditorias ago-set/2026) |
| 7,5 | DPS M1/M2/M3 | Insight real ou ruído bonito? (60s) | padrão detectado em conversa → AUTO silencioso |
| 7,0 | `!comprimir` | Conteúdo de alta estaca sobrevive à compressão? | público + alta estaca pronto → SUGERIR |

## 🧲 PRODUTO, LEAD & ALUNO
| Score | Ferramenta | Contexto | Gatilho |
|---|---|---|---|
| 8,0* | IDFORGE/Quiz | Atributo amputado → routing de produto por pessoa | lead/aluno novo → via N3 · *travado no staging ("Iniciar") |
| 7,5 | 9D Canon Kit | Lacunas nos 12 docs fundacionais de expert | expert novo · "diagnóstico 9D" → via N3 |
| 7,0 | VEDAS | Agente/prompt fraco antes do deploy | agente IA pronto pra produção → pedir |

## 💻 TÉCNICO (AIOX PRO — Claude Code/terminal)
| Score | Ferramenta | Contexto | Gatilho |
|---|---|---|---|
| 8,0 | `@qa *risk-profile` `*nfr-assess` `*gate` | Risco e NFR antes de deploy | story pronta pra merge |
| 8,0 | `@data-engineer *security-audit` | RLS/segurança Supabase | mudança de schema/policy |
| 7,5 | `*ids impact {entity}` | Quem quebra rio abaixo se eu mudar isso | antes de alterar entidade compartilhada |
| 7,0 | `aiox doctor --fix` · código no chat | Ambiente quebrado · reproduzir bug | erro de instalação/setup |

## 🔍 FABLE (nativas — frase natural, sem `!`)
| Score | Capacidade | Contexto | Gatilho |
|---|---|---|---|
| 8,0 | Busca em chats passados | Reconstruir estado de sessão anterior | "continuar" · nome LCG-* · "o que decidimos" → AUTO (bootloader §3) |
| 8,0 | Conectores MCP | Agir em Notion/Supabase/Gmail/n8n/Calendar/Vercel | dado que vive no app → AUTO |
| 7,5 | Pesquisa web / Research | Fato atual, preço, status pós-jan/2026 | tema mutável → AUTO |
| 7,5 | Criação de arquivos | Qualquer entregável (Regra 6: íntegro, nunca copiar-colar) | "gera o doc" → AUTO |
| 7,0 | Execução de código | Calcular, converter, validar, reproduzir | arquivo/dado anexado → AUTO |

---

## ⭐ TOP 5 GERAL
**1. `!atom v2` (9,5)** generalista mais afiado · **2. `!GARGALO` (9)** anti-dispersão · **3. `!compasso` (9)** único calibrado clinicamente · **4. PRT (9)** cirúrgico em teoria · **5. `!validar` (9)** consulta a realidade passada

## 🚦 SEMPRE ATIVAS (sem comando)
VITA FRAIS (qualidade de resposta) · PCS-Detector+DPS (seeds) · §0 preventiva · sessões paralelas (Regra 18) · gate de ckp (Regra 14) · drift canon×memória (Regra 19)

## 🔒 TRAVAS CANÔNICAS
`!estressar` `!forjar` `!forja` `!validar` `!pentar` `!comprimir` = **explícito-only** (Claude sugere ⚙, nunca executa) · git push = exclusivo `@devops` · classes ontológico/teológico/familiar/identidade = decisão volta pra Lucas

> **Adendo 2026-09-03.** Entraram no repo, do anexo do operador: **VERE v0.1** (`docs/arsenal/vere/`),
> **MÉTIS v0.1→v0.3** (`docs/arsenal/metis/`) e o texto do **PVE v1.0** (`docs/arsenal/`). Sem score
> atribuído — a régua deste one-pager é de 04/jul/2026 e os três chegaram depois. Três avisos que a
> tabela não mostra: (a) o VERE **não foi instalado** em nenhum `CLAUDE.md` — instalá-lo é decisão
> LV3, que o próprio VERE manda devolver ao operador; (b) o MÉTIS tem **dois ADRs redigidos 3× e
> nunca gravados**, e a Copa 2026 encerrou sem que a previsão fosse comparada ao resultado real;
> (c) o `!estressar VERÍDICO/FRACTAL` desenhado no anexo está **bloqueado por colisão de nome** com o
> `!estressar fractal` que já existe dentro do `!forjar`/ATERRAR (ADR-20260624-02).

*Documento de referência, não-canônico. Scores = avaliação de Claude 04/jul/2026, critério declarado no cabeçalho.*
