import { spawnSync } from 'node:child_process';

const hasTursoConnection = process.env.TURSO_CONNECTION_URL?.trim();

if (hasTursoConnection) {
  console.info('TURSO_CONNECTION_URL is set; skipping local build DB preparation.');
  console.info('Astro build queries will use the configured remote LibSQL/Turso database.');
  process.exit(0);
}

// drop-fts must run before db:push: drizzle-kit detects versiculos_fts in
// sqlite_master (from a prior build:fts run) and tries to drop its FTS shadow
// tables individually, which fails. Dropping the virtual table first gives
// drizzle-kit a clean schema to reconcile against.
runPnpmScript('drop:fts');
runPnpmScript('db:push');
runPnpmScript('db:seed');
// import:spapddpt populates versiculos + versiculos_tokens (Strong interlinear pipeline)
runPnpmScript('import:spapddpt');
runPnpmScript('import:sparvg');
runPnpmScript('import:sparv1909');
// import:mensaje parsea el HTML "El Mensaje" (Ríos de Vida); paráfrasis sin Strong.
runPnpmScript('import:mensaje');
// import:ntv parsea el .bblx de e-Sword "Nueva Traducción Viviente"; sin Strong.
runPnpmScript('import:ntv');
// import:tsk carga las referencias cruzadas TSK desde OpenBible.info (~340K filas).
runPnpmScript('import:tsk');
// import:vine carga el Diccionario Expositivo Vine (AT+NT) como recurso vine-es.
runPnpmScript('import:vine');
// db:seed-plan carga el plan de lectura diaria (depende de que libros ya exista).
runPnpmScript('db:seed-plan');
// build:fts MUST run last — importers DELETE+reinsert versiculos, so rowids are
// unstable until all imports finish. External-content FTS5 rebuild needs settled rowids.
runPnpmScript('build:fts');

function runPnpmScript(script: string) {
  const result = spawnSync('pnpm', ['run', script], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    console.error(`Failed to run pnpm ${script}:`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
