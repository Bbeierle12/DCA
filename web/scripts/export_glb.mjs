/**
 * B2: export the batched street geometry to ../data/london_streets.glb.
 *
 *   cd web && npm run export:glb      (cloud sandbox: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium)
 *
 * Starts a Vite dev server, opens scripts/export_glb.html in headless Chromium, and writes the
 * binary glTF the page produces. Stats go to stdout.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(here, '..');
const out = resolve(webDir, '../data/london_streets.glb');
const statsOut = resolve(webDir, '../data/london_streets.json');

const server = await createServer({
    root: webDir,
    configFile: resolve(webDir, 'vite.config.ts'),
    server: { port: 5199, host: '127.0.0.1', strictPort: false },
    logLevel: 'warn',
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
try {
    const page = await browser.newPage();
    page.on('console', m => {
        if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}] ${m.text()}`);
    });
    await page.goto(new URL('scripts/export_glb.html', base).href);
    await page.waitForFunction(() => window.__export !== undefined, null, { timeout: 180_000 });
    const result = await page.evaluate(() => window.__export);
    if (result.error) throw new Error(result.error);
    const bytes = Buffer.from(result.glb, 'base64');
    writeFileSync(out, bytes);
    console.log(`wrote ${out}`);
    const stats = { schema: 1, source: 'web/scripts/export_glb.mjs', ...result.stats };
    writeFileSync(statsOut, JSON.stringify(stats, null, 1) + '\n');
    console.log(`wrote ${statsOut}`);
    console.log(JSON.stringify(result.stats));
} finally {
    await browser.close();
    await server.close();
}
