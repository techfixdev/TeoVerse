import { spawnSync } from 'node:child_process';

// Build wrapper: el SSG debe leer de la DB LOCAL (file:local.db), no de Turso.
//
// Si TURSO_CONNECTION_URL está presente durante el build, cada página estática
// consulta Turso por red (~240ms c/u) → builds de 30-45 min y riesgo de timeout.
// El runtime serverless (buscar.json, lectura-diaria.json) SÍ usa Turso: lo lee de
// process.env en cada request (ver src/db/client.ts). Por eso quitamos las vars solo
// del proceso de build; Vercel las sigue inyectando en runtime.
const env = { ...process.env };
delete env.TURSO_CONNECTION_URL;
delete env.TURSO_AUTH_TOKEN;

function run(script) {
  const result = spawnSync('pnpm', ['run', script], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });
  if (result.error) {
    console.error(`Failed to run pnpm ${script}:`, result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('prepare:build-data');
run('build:astro');
