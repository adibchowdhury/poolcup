// run: node scripts/shrink-rest.mjs
import sharp from 'sharp';
import { readdirSync, statSync, existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shrink(src, width, palette = true) {
  if (!existsSync(src)) { console.log(`skip (missing): ${src}`); return; }
  const b = statSync(src).size;
  const input = await readFile(src);
  const out = await sharp(input)
    .resize({ width, withoutEnlargement: true })
    .png(palette ? { palette: true, quality: 90, compressionLevel: 9 } : { compressionLevel: 9 })
    .toBuffer();
  for (let i = 0; i < 5; i++) {
    try { await writeFile(src, out); break; }
    catch (e) { if (i === 4) throw e; await sleep(300); }
  }
  console.log(`${src}: ${(b/1e6).toFixed(2)}MB -> ${(out.length/1e6).toFixed(2)}MB`);
}

// avatars render small
for (const f of readdirSync('public/avatars').filter(f => f.toLowerCase().endsWith('.png')))
  await shrink(`public/avatars/${f}`, 320);

// illustrations / icons
await shrink('public/under-construction.png', 512);
await shrink('public/paper_plane.png', 512);
await shrink('public/cheerleader.png', 512);
await shrink('public/bug-icon.png', 256);
await shrink('public/favicon.png', 256);

// full-bleed background keeps more resolution and full color (no palette, avoids banding)
await shrink('public/background.png', 1920, false);