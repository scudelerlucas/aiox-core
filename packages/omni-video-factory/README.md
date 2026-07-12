# @aiox/omni-video-factory 🎬

Fábrica de vídeos **infinitos comigo** com o **Google Gemini OMNI** (Omni Flash)
+ **Veo 3.1** — reels virais verticais (9:16), YouTube horizontal (16:9), Shorts
e feed quadrado. Zero dependências, **CLI First**, offline por fallback
determinístico (dry-run).

> **Por que assim?** O Google **Flow** (labs.google/fx/tools/flow) é um produto
> web sem API pública. Mas os **mesmos modelos que rodam dentro do Flow** — o
> Gemini **Omni Flash** e o **Veo 3.1** — são expostos via **Gemini API**. Esta
> fábrica automatiza exatamente esse caminho: programável, em lote e infinito,
> sem depender da UI do Flow.

---

## O que ele faz

```
tema/seed ─► angulos virais ─► prompt cinematográfico ─► OMNI/Veo ─► clips ─► montagem ─► vídeo
                (deterministico)      (persona "comigo")     (API)            (ffmpeg)
```

- **"Comigo"** — personas com até 7 imagens de referência mantêm **seu rosto**
  consistente entre os vídeos (recurso de reference-images do Omni Flash).
- **Infinito** — a partir de um seed, deriva N ângulos de hook de alta retenção
  e produz N vídeos. Plugue seus próprios temas via arquivo.
- **Multi-formato** — reels 9:16, YouTube 16:9, Shorts, quadrado, storytime.
- **Offline-first** — sem `GEMINI_API_KEY`, roda em **dry-run**: gera os prompts
  e o `manifest.json` sem chamar a API. Nunca é blocker.
- **Montagem tolerante** — com `ffmpeg` monta o vídeo final; sem ele, salva os
  clips + um `assemble.sh` pronto para rodar onde houver ffmpeg.

---

## Instalação

Faz parte do monorepo `aiox-core` (workspace). Dentro do pacote:

```bash
cd packages/omni-video-factory
cp .env.example .env      # opcional; coloque sua GEMINI_API_KEY
```

Node >= 20. Sem `npm install` necessário (zero dependências de runtime).

---

## Uso rápido (CLI First)

```bash
# Diagnóstico do ambiente (API key, ffmpeg, modelos)
node bin/omni-video.mjs doctor

# 1 reel viral vertical de um tema, com você ("comigo")
node bin/omni-video.mjs generate \
  --topic "como sair da estagnação" \
  --format reel-viral \
  --persona lucas --persona-dir examples/personas

# ∞ : 20 vídeos derivando ângulos virais de um seed
node bin/omni-video.mjs loop --seed "produtividade" --count 20 --format shorts

# Lote a partir de um arquivo de briefs ou de temas
node bin/omni-video.mjs batch examples/briefs.example.json --format reel-viral
node bin/omni-video.mjs batch examples/topics.example.txt  --format youtube-horizontal

# Listar formatos e personas
node bin/omni-video.mjs presets
node bin/omni-video.mjs personas
```

Sem `GEMINI_API_KEY`, tudo acima roda em **dry-run** automaticamente (gera
prompts + `manifest.json`). Adicione a chave e remova `--dry-run` para gerar de
verdade.

Instalado como bin: `omni-video` / `ovf`.

---

## Formatos (presets)

| id | ratio | duração | provider | uso |
|----|-------|---------|----------|-----|
| `reel-viral` | 9:16 | 8s | Omni | base de reels virais |
| `shorts` | 9:16 | 24s | Veo | YouTube Shorts (3 batidas) |
| `youtube-horizontal` | 16:9 | 32s | Veo | long-form horizontal |
| `square` | 1:1 | 6s | Omni | feed quadrado loopável |
| `tiktok-story` | 9:16 | 24s | Veo | storytime multi-cena |

Adicione presets em `presets/*.json` (extend-only) — carregados sem tocar no core.

---

## Persona "comigo"

```
personas/<nome>/
  persona.json          # { name, description, wardrobe, voice, negative }
  ref-0.jpg ... ref-6   # 3 a 7 fotos suas (rosto/ângulos variados)
```

Veja `examples/personas/lucas/`. Sem imagens, a persona funciona em modo texto
(usa só a descrição) — ótimo para prototipar prompts.

---

## API programática

```js
import { produce } from "@aiox/omni-video-factory";

await produce({
  seed: "marketing de conteúdo",
  count: 10,
  format: "reel-viral",
  persona: "lucas",
  log: console.log,
});
```

Exports: `loadConfig`, `BUILT_IN_FORMATS`, `loadPersona`, `buildPrompt`,
`createProvider`, `runBrief`, `runFactory`, `briefsFromSeed`, `produce`.

---

## Saída

Cada vídeo gera uma pasta em `output/<id>/`:

```
manifest.json     # brief, prompt, request enviado, persona (auditável)
clip-00.mp4 ...   # clips gerados (modo live)
<id>.mp4          # vídeo final montado (se ffmpeg presente)
assemble.sh       # comando ffmpeg (se ffmpeg ausente)
```

Um `output/state.json` evita reprocessar briefs já feitos (use `--no-resume`
para ignorar).

---

## Testes

```bash
npm test        # node --test (10 testes, offline)
```

---

## Nota sobre a API preview

O corpo exato do request do **Omni Flash (preview)** pode evoluir. Todo o
mapeamento de campos está centralizado em `src/providers/gemini.mjs →
buildRequestBody()`. Ajuste apenas ali quando a API estabilizar; o restante do
pipeline não muda. O caminho do **Veo 3.1** segue o padrão estável
`:predictLongRunning`.

---

*CLI First · Observability Second · UI Third — Synkra AIOX*
