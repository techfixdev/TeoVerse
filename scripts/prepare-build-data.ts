import { spawnSync } from 'node:child_process';

const hasTursoConnection = process.env.TURSO_CONNECTION_URL?.trim();

if (hasTursoConnection) {
  console.info('TURSO_CONNECTION_URL is set; skipping local build DB preparation.');
  console.info('Astro build queries will use the configured remote LibSQL/Turso database.');
  process.exit(0);
}

runPnpmScript('db:push');
runPnpmScript('db:seed');
// import:spapddpt populates versiculos + versiculos_tokens (Strong interlinear pipeline)
runPnpmScript('import:spapddpt');
runPnpmScript('import:sparvg');
runPnpmScript('import:sparv1909');
// import:mensaje parsea el HTML "El Mensaje" (Ríos de Vida); paráfrasis sin Strong.
runPnpmScript('import:mensaje');

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
