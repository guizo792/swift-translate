// Makes the Chrome Web Store small promo tile (440x280): node promo-tile.mjs
//
// The popup is cut out of the real screenshot, so run screenshots.mjs first. The store wants a PNG with no
// transparency, so the alpha channel is dropped at the end.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launch, ROOT } from './launch.mjs';

const SHOT = path.resolve(import.meta.dirname, 'screenshots', '02-dictionary.png');
const OUT = path.resolve(import.meta.dirname, 'promo-440x280.png');
if (!fs.existsSync(SHOT)) throw new Error('screenshots/02-dictionary.png is missing: run screenshots.mjs first');

// The popup inside the 1280x800 dictionary screenshot (just inside its rounded border).
const POPUP = { x: 279, y: 219, width: 722, height: 522 };
const source = PNG.sync.read(fs.readFileSync(SHOT));
const popup = new PNG({ width: POPUP.width, height: POPUP.height });
PNG.bitblt(source, popup, POPUP.x, POPUP.y, POPUP.width, POPUP.height, 0, 0);
const b64 = (buf) => buf.toString('base64');

const { context, close } = await launch({ viewport: { width: 440, height: 280 } });
try {
  const page = await context.newPage();
  await page.setViewportSize({ width: 440, height: 280 });
  await page.setContent(`<!doctype html><body style="margin:0;width:440px;height:280px;position:relative;overflow:hidden;
      background:linear-gradient(135deg,#1a73e8 0%,#1557b0 100%);font-family:'Segoe UI',Arial,sans-serif;color:#fff">
    <div style="position:absolute;left:28px;top:30px;display:flex;align-items:center;gap:10px">
      <img src="data:image/png;base64,${b64(fs.readFileSync(path.join(ROOT, 'icons', '128.png')))}" style="width:40px;height:40px;border-radius:10px;background:#fff;padding:4px;box-sizing:border-box">
      <div style="font-weight:800;font-size:22px;letter-spacing:-.3px">Swift Translate</div>
    </div>
    <div style="position:absolute;left:28px;top:78px;font-weight:800;font-size:28px;line-height:1.15;letter-spacing:-.5px;white-space:nowrap">
      Select any text.<br>Translate instantly.</div>
    <img src="data:image/png;base64,${b64(PNG.sync.write(popup))}"
      style="position:absolute;left:56px;top:158px;width:328px;border-radius:12px;box-shadow:0 -4px 24px rgba(0,0,0,.3)">
  </body>`);
  const shot = await page.screenshot({ type: 'png' });
  // Drop the alpha channel: 24-bit PNG, as the store asks.
  const rgba = PNG.sync.read(shot);
  fs.writeFileSync(OUT, PNG.sync.write(rgba, { colorType: 2, inputColorType: 6, inputHasAlpha: true }));
  const check = PNG.sync.read(fs.readFileSync(OUT));
  console.log(`${OUT}: ${check.width}x${check.height}, alpha: ${check.alpha}`);
} finally {
  await close();
}
