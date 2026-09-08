import {build} from 'esbuild';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
const out=resolve(tmpdir(),'alex-planner-check.mjs');
await build({entryPoints:['tests/planner/check.ts'],outfile:out,bundle:true,platform:'node',format:'esm',alias:{'cloudflare:workers':resolve('tests/planner/cloudflare.mock.ts')}});
await import(out+'?t='+Date.now());
