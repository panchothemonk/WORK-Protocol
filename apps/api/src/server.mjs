/**
 * WORK Protocol v4 — API Server Entry Point
 */
import http from 'node:http';
import { get as getConfig } from './config.mjs';
import { createPool, runMigrations } from '@workprotocol/store/db';
import { app } from './app.mjs';

const config = getConfig();
const pool = createPool(config.databaseUrl);
await runMigrations(pool);

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, protocol: 'WORK Protocol', version: '4.0' }));
    return;
  }
  app({ req, res, pool, config });
});

server.listen(config.port, () => {
  console.log(`WORK Protocol API v4.0 listening on ${config.port}`);
});

process.on('SIGTERM', async () => {
  await pool.end();
  server.close();
});
