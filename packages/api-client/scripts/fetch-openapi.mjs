import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, '..', 'openapi.json');
const url = process.env.OPENAPI_URL || 'https://subscriptionapp-wgf8.onrender.com/api/v3/api-docs';

const res = await fetch(url);
if (!res.ok) {
  console.error(`Failed to fetch OpenAPI: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const json = await res.json();
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(json, null, 2), 'utf8');
console.log(`Wrote ${out} (${Object.keys(json.paths || {}).length} paths)`);
