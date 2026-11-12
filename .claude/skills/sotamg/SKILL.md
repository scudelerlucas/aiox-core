---
name: sotamg
description: "!SOTAMG — State Of The Art Motion Graphics: movimento de nível estado-da-arte numa tela da casa (painel da Casa Una primeiro; serve a qualquer painel, página ou peça). Um momento orquestrado por tela, movimento que responde a um gesto e mostra o que mudou, tokens de duração e curva na configuração da casa, orçamento de desempenho medido (60 fps, CLS 0, LCP intacto), redução de movimento obrigatória e medição antes e depois com foto e vídeo. Escolhe a ferramenta certa (CSS/WAAPI, GSAP + ScrollTrigger, Three.js, HyperFrames/Remotion para vídeo) e proíbe sequestro de rolagem. Ativar em: !SOTAMG, !sotamg, 'state of the art motion graphics', 'motion graphics de ponta', 'motion state of the art'."
---

# !SOTAMG — State Of The Art Motion Graphics (v1.0.1 · 07/11/2026)

> Ordem do operador (`#chat-L8TKbi`, 31/10): *"Eu queria criar na Casa Una um state of the art motion graphics (comando novo !SOTAMG,
> tiver outro com grafia errada, corrija para essa daqui)."* Conferido no mesmo turno: não havia comando parecido com grafia errada
> (busca por `sotamg`, `sotmg`, `sota mg` e afins no hub); o nome canônico é este. O pedido de 26/10 no `00-PROMPT-MELHORADO-funil-sdr-…`
> ("state of the art motion graphics") é o primeiro uso da expressão e passa a ser coberto por este comando.

**Sem alvo** (`!SOTAMG` sozinho) → uma pergunta: *"em qual tela ou peça?"* e para. **Com alvo** (`!SOTAMG casa-una início`) → protocolo abaixo.

## O que "estado da arte" quer dizer aqui (a régua, não o adjetivo)
1. **Um momento orquestrado por tela.** Uma única sequência que chama atenção para o que importa (a tarefa do dia, a etapa que andou, o
   número que virou). Entrada com fade e subida em cada seção e hover em cada cartão é o padrão genérico e **não** conta como estado da arte.
2. **Movimento que responde a um gesto mostra o que mudou.** Marcar feito, abrir um item, trocar de aba, a etapa avançar: o movimento liga
   o antes ao depois (continuidade de objeto, não efeito). Movimento sem causa na tela é ruído.
3. **Significado antes de beleza.** Cada animação responde "o que a pessoa entende a mais por causa disto?". Sem resposta, sai.
4. **Tokens, não números soltos.** Duração e curva vivem na configuração da casa (`src/casas-painel/tela/casas/<casa>.mjs`, chave
   `movimento`) e no CSS como variáveis: `--mov-rapido 140ms` (resposta a toque), `--mov-medio 260ms` (abrir/fechar),
   `--mov-lento 520ms` (o momento orquestrado), `--mov-curva cubic-bezier(.2,.7,.2,1)` (saída suave), `--mov-mola` só via GSAP.
5. **Redução de movimento é contrato.** `prefers-reduced-motion: reduce` e o botão de pausa da casa trocam tudo por troca de estado sem
   deslocamento (opacidade ≤ 120 ms ou nada). Testado em toda entrega.
6. **Rolagem é da pessoa.** Proibido sequestrar a rolagem (Locomotive em modo suave, scroll-jacking, `pin` que prende mais de uma tela).
   ScrollTrigger só para revelar ou desenhar enquanto a pessoa rola no ritmo dela.
7. **Orçamento medido** (régua `ui-ux` F12 + Core Web Vitals): 60 fps sem queda sustentada no celular médio; **CLS 0** (nada empurra o
   layout: só `transform` e `opacity`); LCP não piora mais de 100 ms; nenhum laço de quadro rodando com a tela fora de vista ou a aba
   escondida; JS de movimento novo ≤ 30 KB comprimido além do que a casa já carrega.

## Ferramenta certa por tamanho do gesto
| Gesto | Ferramenta | Por quê |
|---|---|---|
| Resposta a toque, abrir/fechar, foco | CSS (`transition`, `@starting-style`) ou WAAPI | zero dependência, roda no compositor |
| Sequência com várias peças (o momento orquestrado) | GSAP (`gsap.timeline`) | controle de ordem e sobreposição; já está na casa |
| Desenhar enquanto rola (linha da etapa, número que conta) | GSAP ScrollTrigger com `scrub` | segue a rolagem sem sequestrar |
| Fundo vivo do herói | Three.js (já existe: ondas) | só um por página, pausa fora de vista, cai para imagem sem WebGL |
| Trocar de tela mantendo o objeto | View Transitions API (com teste de suporte) | continuidade real entre estados |
| Vídeo de demonstração, reel, peça para rede | skill `hyperframes` (ou `remotion-*`) | movimento renderizado, não na tela viva |

Skills de apoio: `gsap-core`, `gsap-scrolltrigger`, `gsap-performance`, `threejs-webgl`, `frontend-design:frontend-design`, `ui-ux`.
`locomotive-scroll` fica só para leitura de projetos antigos (regra 6).

## Fora do painel das casas: o piso portátil (v1.0.1, `!LAPIDAR` 2026-W45)

O protocolo abaixo aponta para o medidor do painel das casas. Em qualquer outro repositório (quiz, landing, blog), comece por este piso:
os tokens da regra 4 e a redução de movimento da regra 5 **antes** do primeiro movimento. Medido na 1ª lapidação (07/11): as duas telas
de produção não tinham movimento nenhum **e** nenhuma regra `prefers-reduced-motion` (0 de 2) — o primeiro efeito que alguém puser ali
nasceria sem a trava.

```css
:root { --mov-rapido: 140ms; --mov-medio: 260ms; --mov-lento: 520ms; --mov-curva: cubic-bezier(.2,.7,.2,1); }
.momento { animation: momento-entra var(--mov-lento) var(--mov-curva) both; }   /* um só por tela (regra 1) */
@keyframes momento-entra { from { opacity: 0; transform: translateY(12px); } }   /* só transform e opacity: CLS 0 */
@media (prefers-reduced-motion: reduce) {
  .momento { animation: none; }                                                  /* o momento some; o conteúdo já está no lugar */
  *, *::before, *::after { animation-duration: .01ms !important; animation-delay: 0s !important;
    animation-iteration-count: 1 !important; transition-duration: .01ms !important; transition-delay: 0s !important;
    scroll-behavior: auto !important; }
}
```

Movimento por **GSAP** não é alcançado por esse CSS: todo `gsap.to/from/timeline` com deslocamento vai dentro de
`gsap.matchMedia()` com um ramo `(prefers-reduced-motion: reduce)` que troca o deslocamento por estado final (ou opacidade ≤ 120 ms).

**Guarda** (antes do merge, no CSS e JS servidos): `grep -c 'prefers-reduced-motion'` ≥ 1 sempre que houver `animation`,
`transition` de deslocamento ou GSAP; e, com `emulateMedia({ reducedMotion: 'reduce' })`, nenhuma animação **rodando** —
`document.getAnimations().filter(a => a.playState === 'running').length === 0` (a terminada que fica por `fill-mode` não conta) — e,
havendo GSAP, foto do elemento no meio da interação igual à foto do estado final. Movimento na tela sem isso = regra 5 violada.

## Protocolo (nesta ordem)
1. **Medir antes:** fotos 1280 e 390 (claro e escuro) e um vídeo curto da tela-alvo (Playwright `recordVideo`), mais as medidas do
   medidor da casa (`node tests/tela/casas/rodar.mjs --casa=<casa>`) e fps do momento atual (trace do Chromium).
2. **Escolher o momento:** qual é *a* coisa que esta tela precisa que a pessoa veja? Escrever em uma frase antes de codar.
3. **Desenhar em tokens** (regra 4) e implementar atrás de uma chave na configuração da casa (`movimento: { ... }`), para voltar sem deploy.
4. **Reduzir:** caminho de redução de movimento e de pausa, cada um com teste em `tests/tela/casas/fluxos.mjs`.
5. **Medir depois**, mesma régua: fps, CLS, LCP, medidor zerado, fluxos verdes, vídeo antes × depois anexado ao PR.
6. **Simulação humana** (`simulacao-humana-sintetica`, fluxo de clique em Haiku): a persona de primeiro acesso percorre a tela com o
   movimento ligado e desligado; a confusão não pode subir.
7. **Versão e volta** (`versionamento-e-rollback`): sobe a versão da casa, congela a anterior, escreve o caminho de volta no PR.

## Sinal de violação
Animação sem frase de "o que a pessoa entende a mais" · número de duração solto no código · `top/left/height` animado · laço de quadro
com a aba escondida · rolagem suave sequestrada · entrega sem o teste de redução de movimento · "ficou mais fluido" sem fps medido ·
mais de um momento orquestrado na mesma tela.

🕒 2026-10-31 21:40 (São Paulo) · ✍ lucasscudeler · 💬 ✋🏛️ !!! 02/11 · A75 · UNA TRÁFEGO VIVO → aplicar migração e rodar o workflow · #chat-L8TKbi
