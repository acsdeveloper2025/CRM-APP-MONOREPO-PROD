/**
 * Render PWA icons from public/favicon.svg at the exact sizes declared in
 * public/manifest.json. Idempotent — re-run after editing the SVG to refresh
 * all eight PNGs. No runtime dep on sharp; this is a one-time/dev-only tool.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SVG = path.join(ROOT, 'public', 'favicon.svg');
const MANIFEST = path.join(ROOT, 'public', 'manifest.json');

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const svg = fs.readFileSync(SVG);

  for (const icon of manifest.icons || []) {
    const match = /^(\d+)x(\d+)$/.exec(icon.sizes || '');
    if (!match) continue;
    const size = Number(match[1]);
    const out = path.join(ROOT, 'public', path.basename(icon.src));
    await sharp(svg, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(out);
    const bytes = fs.statSync(out).size;
    console.log(`✓ ${path.relative(ROOT, out)} (${size}x${size}, ${bytes} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
