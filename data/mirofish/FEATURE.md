# MiroFish Populations — a população como FEATURE

O pack não é só dado: `calibrate.mjs` transforma o perfil de cada mercado em
**diretivas acionáveis**. Isso é o que faz a população virar feature de produto.

## O que a feature entrega

```js
import { calibrate } from "./data/mirofish/loader.mjs";

calibrate("MX");
// {
//   code:"MX", name:"México", region:"latam", confidence:"firm",
//   directives:{
//     social_proof:"grupo/família",       // IDV 30 (coletivista)
//     guarantee:"alta",                    // UAI 82 (avesso a risco)
//     timeframe:"resultado rápido",        // LTO 24
//     motivation:"urgência/gratificação",  // IVR 97
//     authority:"autoridade clássica"      // PDI 81
//   },
//   signals:{ internet_penetration_pct:83, trust:{...}, entrepreneurship:{...} },
//   caveat:null
// }
```

Cada diretiva cita o eixo Hofstede de origem. Mercado `placeholder` → `confidence:"placeholder"` + `caveat` preenchido.

## Como virar feature em cada tipo de app (recipe mínimo)

O padrão é sempre: **detectar o mercado do usuário → `calibrate(code)` → aplicar as diretivas na superfície**.

### App Next.js / React (quiz, VSL, landing)
1. Detectar país do lead (form, geo-IP, ou seleção). Normalizar para ISO-2 (`BR`, `MX`…).
2. Server-side (route handler, edge function, RSC): `const cal = calibrate(country)`.
3. Aplicar:
   - `directives.social_proof` → escolher bloco de prova social (depoimento individual vs de grupo/família).
   - `directives.guarantee` → mostrar/realçar garantia quando "alta".
   - `directives.motivation` → tom de urgência vs disciplina no CTA/headline.
   - `directives.authority` → como apresentar o mentor.
4. Sempre checar `cal.confidence` — se "placeholder", usar diretiva como default suave, não travar.

### Quiz Diagnosys / gerador de carta (LLM)
- Injetar `calibrate(country)` no contexto do prompt (SHAKESPEARMOZI/COMPASSO): a carta e a
  oferta passam a respeitar a cultura do mercado (ex.: coletivista → prova social de grupo).
- Ver a integração de referência: `src/lib/mirofish/` (Lucas-Contexto-Geral).

### Backend / edge (Deno/Node)
- `import { calibrate } from "<...>/data/mirofish/loader.mjs"` (usa `node:fs`; em edge sem fs,
  importe `populations.v1.json` como asset e passe o path ao loader, ou pré-compute no build).

## Projetos futuros (fase de planejamento)
- Instalar via o **skill** `mirofish-populations` (`.claude/skills/`), que roda o `install.mjs`
  e deixa a feature disponível no novo projeto desde o dia 1.
- Projetos sobre o framework AIOX herdam o pack quando ele está no scaffold do framework.

## Atualização
`node install.mjs --dest <proj>/data/mirofish --update` propaga nova versão do dado E da feature.
