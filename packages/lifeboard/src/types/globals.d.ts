/**
 * OS-LIFEBOARD · E5 — Declarações de módulo para side-effect imports de estilo.
 * Permite `import "reactflow/dist/style.css"` e `import "@/app/globals.css"` sob
 * `tsc --noEmit` (o Next processa o CSS no build; o tsc só precisa da declaração).
 */
declare module "*.css";
