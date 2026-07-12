-- Scores de ASSIMETRIA/SINERGIA (packages/idea-forge/src/seeds/score.mjs)
-- calculados contra o seed bank (public.seeds, ver 20260711_seeds.sql) e
-- persistidos junto do registro da ideia (packages/idea-inbox/src/enrich.mjs).

alter table public.ideas
  add column if not exists asymmetry_score int,
  add column if not exists synergy_score int,
  add column if not exists cluster_reach int,
  add column if not exists matched_seeds jsonb;
