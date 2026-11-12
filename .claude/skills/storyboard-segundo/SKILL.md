---
name: storyboard-segundo
description: >-
  !storyboard <roteiro ou edit sheet> — gera o STORYBOARD POR SEGUNDO de um vídeo (anúncio, reels, short, VSL,
  boas-vindas, aula, teaser): um bloco por segundo com o que se vê, o que se ouve, a fala, a camada, a fonte
  (gravado · real · HeyGen Avatar V · Seedance 2.5 só se essencial · 2.0 Fast/Standard/Mini · imagem animada ·
  biblioteca · render local), a unidade de compra, os créditos e o porquê — escolhendo sempre o motor mais barato que
  entrega. Sai em JSON (vsl-studio/schema/storyboard-segundo.schema.json) + tabela .md para o Lucas aprovar, mais a
  lista de disparo manual para o ilimitado do site. É o passo obrigatório antes de qualquer crédito de vídeo (regra
  video-storyboard-por-segundo, 30/10/2026; hook higgsfield-storyboard-gate.sh no hub). Ativar em: !storyboard,
  'storyboard por segundo', 'o que gerar em cada segundo', 'qual modelo para cada cena', 'cota esse roteiro',
  'quantos créditos esse vídeo gasta', ou quando uma sessão vai chamar generate_video/execute_preset da Higgsfield.
---

# !storyboard — o roteiro escolhe o motor, segundo a segundo

Você transforma um **roteiro** (word-by-word) ou um **edit sheet** (`editsheet.schema.json`, skill `edit-sheet-viral`)
em um **storyboard por segundo** — a arquitetura e a engenharia de cada segundo, escrita antes de gastar um crédito.
Fonte única do procedimento: `docs/os-meta-ads/PADRAO-VIDEO-storyboard-por-segundo-v1_0.md`.

## Entrada
- O roteiro (ou a pauta + edit sheet). Sem roteiro → 1 pergunta e para: *"qual é o roteiro, com a fala por batida?"*.
- O formato (anúncio · reels · short · VSL · boas-vindas · aula · teaser · stories) e o aspecto.
- Quem aparece: o Lucas gravado (então a gravação é a fonte do lipsync) ou sem rosto.

## Passos (nesta ordem)
1. **Faixas.** Herde `de/ate` do edit sheet (batidas); sem edit sheet, corte o roteiro em faixas de 1–4 s pela fala. Cobrir
   0..duração sem buraco.
2. **Camada e essencial.** Para cada faixa: camada (gancho · rosto · b-roll-cena · b-roll-fundo · prova · tela · texto · cta)
   e `essencial` — `true` só quando a **cena** carrega a venda e nenhum motor mais barato entrega (gancho que é cena e não
   rosto; abertura de VSL para tela grande; cena-âncora da virada). Na dúvida, `false` e pergunta ao Lucas na tabela.
3. **Fonte, de baixo para cima** (PADRÃO §2): biblioteca (0) → render local / tela / real (0) → imagem animada (IMG) →
   2.0 Mini (M4) → 2.0 Fast (F4) → 2.0 Standard (S4/S6) → **2.5 só se `essencial`** (X25-720 / X25-1080). Rosto falando =
   Lucas gravado ou HeyGen Avatar V; voz sintética = ElevenLabs v4. Prova = só real. Cada faixa ganha um `porque`.
   Emenda de 09/11 (D3, em prova até o bake-off): a faixa falada pode ganhar um 2º passo de acabamento Seedance sobre a
   saída do HeyGen. **O contrato tem o campo `acabamento` na faixa desde 10/11/2026** (`motor` só Seedance, `creditos`,
   `prompt` com a etiqueta, `porque`, `gate_pos` opcional): só vale em faixa falada com fonte `heygen-avatar-v`; o crédito
   soma no total da peça; **exige `gate.teto_autorizado` e `gate.aprovado_por = lucas`** — a sessão nunca aprova peça com
   acabamento. Depois do acabamento, mede-se o lipsync de novo e grava-se em `gate_pos`; reprovou (boca fora do tempo ou
   rosto que mudou), o trecho volta para a saída do HeyGen.
4. **Prompt com etiqueta.** Toda faixa gerada tem `prompt` começando por `[ss-AAAA-MM-DD-NNN s<de>-<ate>]`, em inglês, com
   plano · sujeito · ação · luz · câmera, sem rosto de pessoa real sem pedido explícito.
5. **Cotar.** `creditos` pela MATRIZ §1.1 (ou `get_cost`); some em `totais`; compare com o **teto do formato** (PADRÃO §4).
6. **Gravar** `docs/<tema>/storyboards/ss-AAAA-MM-DD-NNN.json` + `.md` ao lado (tabela: faixa · fala · vê · fonte · cr · porquê)
   + **lista de disparo manual** (faixas em que o ilimitado do site vale: imagem; Seedance 720p ≤ 8 s nos dias de ilimitado).
7. **Validar:** `python3 scripts/storyboard-segundo-validar.py <arquivo>` tem de passar.
8. **Gate.** Dentro do teto e sem 2.5 → `gate.aprovado_por: sessao-dentro-do-teto`, hora medida, `#chat-`. Acima do teto ou com
   2.5 → o sim do Lucas, com a frase *"X créditos, Y s em 2.5, porque Z — sim?"*. Só então disparar, na ordem barata.

## Saída
- O JSON validado e a tabela `.md` (link do GitHub, fora do diff).
- 3 números na resposta: créditos totais · segundos essenciais · créditos poupados pela biblioteca.
- Decisão ao Lucas só quando houver 2.5 ou teto estourado.

## Nunca
- Disparar sem o arquivo gravado e validado. Gerar prova. Rosto de pessoa real sem pedido. Robô no site da Higgsfield.
- "Essencial" por gosto: essencial é o que o roteiro diz que vende.
