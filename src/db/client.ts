import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const connectionUrl = env?.TURSO_CONNECTION_URL ?? process.env.TURSO_CONNECTION_URL;
const authToken = env?.TURSO_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;
const url = connectionUrl && connectionUrl.trim().length > 0 ? connectionUrl : 'file:local.db';

export const client = createClient({
  url,
  authToken: authToken && authToken.trim().length > 0 ? authToken : undefined,
});

export const db = drizzle(client, { schema });
