// run: node scripts/shrink-flags.mjs
import sharp from 'sharp';
import { readdirSync, statSync, unlinkSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';

const dir = 'public/flags';
const sleep = ms => new Promise(r => setTimeout(r, ms));

for (const f of readdirSync(dir).filter(f => f.endsWith('.tmp'))) unlinkSync(`${dir}/${f}`);

let before = 0, after = 0;
for (const f of readdirSync(dir).filter(f => f.toLowerCase().endsWith('.png'))) {
  const src = `${dir}/${f}`;
  before += statSync(src).size;
  const input = await readFile(src);
  const out = await sharp(input)
    .resize({ width: 400, withoutEnlargement: true })
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toBuffer();
  let ok = false;
  for (let i = 0; i < 5 && !ok; i++) {
    try { await writeFile(src, out); ok = true; }
    catch (e) { if (i === 4) throw e; await sleep(300); }
  }
  after += out.length;
}
console.log(`flags: ${(before/1e6).toFixed(1)}MB -> ${(after/1e6).toFixed(1)}MB`);