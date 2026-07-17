# Arsenais — espelhados e vinculados nos 3 repos (permanente)

Estes documentos ficam **idênticos** em três repositórios:
`Lucas-Contexto-Geral`, `quiz-diagnosys` e `aiox-core`.

## Como o vínculo funciona
- **Fonte:** editar em qualquer um dos três repos.
- **Espelho automático:** um hook `PostToolUse` (em `.claude/settings.json` dos três repos)
  roda `scripts/sync-arsenal.mjs` sempre que um arquivo em `docs/arsenal/` é salvo. O script
  copia a versão nova para os outros dois repos (só o que mudou).
- **Manual (opcional):** `node scripts/sync-arsenal.mjs` a partir de qualquer repo espelha
  o `docs/arsenal/` dele para os outros dois.

> Depois do espelho, faça commit em cada repo (o hook copia os arquivos; o commit é seu).

## Arquivos
- `ONE-PAGER-Arsenal-Diagnostico-Pandora-v1.0.md` — arsenal de diagnóstico/comando (Pandora × Fable × AIOX).
- `ALMA-PETRA-Arsenal-Consultoria-Operador-Rafael-Lara-v1.0.md` — arsenal de consultoria (versão operador).
