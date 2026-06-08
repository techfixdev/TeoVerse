import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
// process.env primero: en runtime serverless Vercel inyecta las vars ahí. El build de SSG
// corre con TURSO_* removido del entorno (ver scripts/build.mjs) y cae a file:local.db,
// evitando consultar Turso por red en cada página estática (builds de 30-45 min).
const connectionUrl = process.env.TURSO_CONNECTION_URL ?? env?.TURSO_CONNECTION_URL;
const authToken = process.env.TURSO_AUTH_TOKEN ?? env?.TURSO_AUTH_TOKEN;
const url = connectionUrl && connectionUrl.trim().length > 0 ? connectionUrl : 'file:local.db';

// isLocalFallback es true cuando no se configuró TURSO_CONNECTION_URL.
// Es correcto en dev y durante el build (prepare-build-data usa local.db),
// pero en producción indica una variable de entorno faltante.
export const isLocalFallback = url === 'file:local.db';

if (isLocalFallback) {
  console.warn('[db] TURSO_CONNECTION_URL no está configurada — usando file:local.db');
}

export const client = createClient({
  url,
  authToken: authToken && authToken.trim().length > 0 ? authToken : undefined,
});

// SQLite deshabilita la verificación de claves foráneas por defecto.
// Habilitarla garantiza que los ON DELETE CASCADE de versiculos_tokens funcionen
// correctamente al re-importar versículos. Es un no-op para conexiones remotas (Turso).
void client.execute('PRAGMA foreign_keys = ON').catch((e) => {
  console.warn('[db] no se pudo habilitar PRAGMA foreign_keys:', e);
});

export const db = drizzle(client, { schema });
