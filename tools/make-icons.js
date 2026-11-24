// Gera os PNGs do ícone a partir de icons/icon.svg (usa o Chromium do Playwright).
// Uso: node tools/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'icons/icon.svg'), 'utf8');
const sizes = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'icon-1024.png': 1024 };

(async () => {
  const browser = await chromium.launch();
  for (const [file, size] of Object.entries(sizes)) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:#fff}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: path.join(root, 'icons', file), clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
  }
  await browser.close();
  console.log('ícones gerados');
})();
