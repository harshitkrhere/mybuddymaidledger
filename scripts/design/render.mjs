// Render the MyBuddyMaid dashboard at 2x device scale (3072x1920), report layout metrics.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(__dirname, 'mbm-dashboard.html');
const RAW = path.join(__dirname, 'raw2x.png');

const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 2 });
await page.goto('file://' + HTML);
await page.waitForTimeout(1000);

const fontReport = await page.evaluate(() =>
  ['Fraunces', 'Archivo', 'IBM Plex Mono'].map(f => {
    const loaded = [];
    for (const w of [400, 600, 700]) for (const s of ['normal', 'italic']) {
      if (document.fonts.check(`${s} ${w} 20px "${f}"`)) loaded.push(`${s === 'italic' ? 'i' : ''}${w}`);
    }
    return `${f}: [${loaded.join(', ')}]`;
  })
);
console.log('FONTS LOADED:');
fontReport.forEach(f => console.log('  ' + f));

const m = await page.evaluate(() => {
  const r = s => { const el = document.querySelector(s); return el ? el.getBoundingClientRect() : null; };
  const body = document.querySelector('.body');
  return {
    docScrollW: document.documentElement.scrollWidth,
    docScrollH: document.documentElement.scrollHeight,
    bodyScrollH: body.scrollHeight,
    bodyClientH: body.clientHeight,
    ledgerBottom: Math.round(r('.ledgerblock')?.bottom ?? -1),
    abstractBottom: Math.round(r('.abstract')?.bottom ?? -1),
    footerTop: Math.round(r('.folio')?.top ?? -1),
    heroFigRight: Math.round(r('.bigfig')?.right ?? -1),
    navRightLeft: Math.round(r('.nav-right')?.left ?? -1),
    statcolRight: Math.round(r('.statcol')?.right ?? -1),
  };
});
console.log('LAYOUT METRICS (px, 1536x960 space):');
console.log(JSON.stringify(m, null, 2));

await page.screenshot({ path: RAW });
await browser.close();
console.log('saved', RAW);
