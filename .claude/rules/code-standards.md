---
paths:
  - "packages/**"
  - "src/**"
  - "bin/**"
  - "apps/**"
  - "tests/**"
  - "squads/**"
---

# Padrões de Código — AIOX

## Convenções de Nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Componentes | PascalCase | `WorkflowList` |
| Hooks | prefixo `use` | `useWorkflowOperations` |
| Arquivos | kebab-case | `workflow-list.tsx` |
| Constantes | SCREAMING_SNAKE_CASE | `MAX_RETRIES` |
| Interfaces | PascalCase + sufixo | `WorkflowListProps` |

## Imports

**Sempre use imports absolutos.** Nunca use imports relativos.

```typescript
// ✓ Correto
import { useStore } from '@/stores/feature/store'
// ✗ Errado
import { useStore } from '../../../stores/feature/store'
```

**Ordem:** 1. React/core → 2. External libs → 3. UI components → 4. Utilities → 5. Stores → 6. Feature imports → 7. CSS

## TypeScript

- Sem `any` — use tipos apropriados ou `unknown` com type guards
- Sempre defina interface de props para componentes
- Use `as const` para objetos/arrays constantes
- Tipos de ref explícitos: `useRef<HTMLDivElement>(null)`

## Error Handling

```typescript
try {
  // Operation
} catch (error) {
  logger.error(`Failed to ${operation}`, { error })
  throw new Error(`Failed to ${operation}: ${error instanceof Error ? error.message : 'Unknown'}`)
}
```

## Testes & Quality Gates (Pre-Push)

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # Jest (npm run test:coverage para cobertura)
```
