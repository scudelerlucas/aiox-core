# Persona "lucas" (exemplo)

Para ativar a consistencia **"comigo"**, coloque nesta pasta de 3 a 7 imagens
suas nomeadas em ordem estavel:

```
ref-0.jpg   # rosto frontal, luz neutra
ref-1.jpg   # perfil 3/4
ref-2.jpg   # corpo/enquadramento medio
ref-3.jpg   # expressao falando
...ate ref-6
```

Formatos aceitos: `.jpg`, `.png`, `.webp`. O Omni Flash usa ate 7 referencias
para manter seu rosto e identidade consistentes entre os videos.

Depois:

```bash
omni-video generate --topic "seu tema" --persona lucas \
  --persona-dir examples/personas
```

Sem imagens, a persona funciona em modo **texto** (usa apenas a descricao do
`persona.json`) — util para prototipar prompts.
