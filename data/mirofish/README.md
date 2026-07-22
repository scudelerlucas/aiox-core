# MiroFish Populations Pack (MPP) — v1.0.0

Kit **portátil e versionado** de dados de mercado por país — a base demográfica/
cultural/comportamental das populações da MiroFish (KOINONIA Anexo C/D). Instala em
**qualquer projeto** com um comando; a fonte da verdade é única e versionada.

- **Fonte:** `docs/frameworks/KOINONIA-anexo-D-populacoes-mirofish.md` + upgrade LATAM
  validado (Edelman 2026 · GEM · IMD · DataReportal — sessão r2-3).
- **19 mercados** em 4 regiões: `latam` · `eastern_europe` · `west` · `asia`.
- **Honestidade:** cada campo tem `quality: firm | placeholder` e `source`.
  Placeholder = hipótese a validar — **não travar preço/mensagem** nele.

## Instalar em um projeto

```bash
# a partir da pasta do pack (repo-canon):
node install.mjs --dest /caminho/do/projeto/data/mirofish
# atualizar depois:
node install.mjs --dest /caminho/do/projeto/data/mirofish --update
```

O instalador copia `populations.v1.json`, `manifest.json`, `loader.mjs`, `README.md`
e grava `.installed.json` (versão + checksum). Idempotente.

## Consumir (zero-dependência, ESM)

```js
import { getMarket, byRegion, hofstede } from "./data/mirofish/loader.mjs";

getMarket("MX").hofstede;        // { pdi:81, idv:30, mas:69, uai:82, lto:24, ivr:97 }
getMarket("MX").entrepreneurship;// { gem_tea_pct:19.6, quality:"firm", source:"GEM 2023" }
byRegion("latam").map(m => m.code); // ["BR","MX","CO","AR","CL","PE"]
```

Também pode ler o JSON direto em qualquer linguagem (Python, etc.).

## Regra estratégica (do dataset)

A variável que mais separa mercados para copy de infoproduto **não é renda — é IDV
(individualismo):** EUA (91)/Hungria (80) pedem conquista pessoal; Indonésia (14)/
Colômbia (13)/China (20) exigem benefício de família/grupo.

## Sincronização

Fonte única no repo-canon (`Lucas-Contexto-Geral/mirofish-populations/`). Regenerar o
dataset: `node build-dataset.mjs`. Cada projeto guarda `.installed.json` com o checksum
— rodar o instalador de novo com `--update` propaga a nova versão. Sem divergência silenciosa.
