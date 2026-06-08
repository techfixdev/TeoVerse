import { defineConfig } from 'drizzle-kit';

const tursoUrl = process.env.TURSO_CONNECTION_URL?.trim();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  // libsql/Turso remoto requiere el dialect 'turso'; el build local usa 'sqlite' sobre file:local.db.
  dialect: tursoUrl ? 'turso' : 'sqlite',
  dbCredentials: tursoUrl
    ? {
        url: tursoUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : {
        url: 'file:local.db',
      },
  verbose: true,
  strict: true,
});
