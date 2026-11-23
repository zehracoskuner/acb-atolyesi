// Convert the existing web vector mark into native app icon assets. No web source is modified.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MOBILE_EDITOR_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    const root = path.resolve(__dirname, '..');
    const source = fs.readFileSync(path.join(root, '../frontend/public/acb.svg'), 'utf8').replace(/<\?xml[^>]*>/, '').replace(/<!DOCTYPE[\s\S]*?>/, '').replaceAll('#000000', '#863E27');
    const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:#F7F5F0;width:100%;height:100%}body{display:grid;place-items:center}svg{width:62%;height:62%}</style>${source}`);
    const vector = await page.locator('svg').evaluate(svg => { const bounds = svg.getBBox(); svg.setAttribute('viewBox', [bounds.x, bounds.y, bounds.width, bounds.height].join(' ')); svg.removeAttribute('width'); svg.removeAttribute('height'); return svg.outerHTML; });
    fs.writeFileSync(path.join(root, 'assets/brand.svg'), vector);
    await page.screenshot({ path: path.join(root, 'assets/icon.png') });
    await page.addStyleTag({ content: 'html,body{background:transparent}' });
    await page.screenshot({ path: path.join(root, 'assets/adaptive-icon.png'), omitBackground: true });
    console.log('Web mark converted to brand.svg / icon.png / adaptive-icon.png');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
