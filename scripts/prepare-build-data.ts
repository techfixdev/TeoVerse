import { spawnSync } from 'node:child_process';

const hasTursoConnection = process.env.TURSO_CONNECTION_URL?.trim();

if (hasTursoConnection) {
  console.info('TURSO_CONNECTION_URL is set; skipping local build DB preparation.');
  console.info('Astro build queries will use the configured remote LibSQL/Turso database.');
  process.exit(0);
}

runPnpmScript('db:push');
runPnpmScript('db:seed');
runPnpmScript('import:spapddpt');

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
