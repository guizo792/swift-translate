// A 100px caption bar over a 1280x700 picture: the 1280x800 size the Chrome Web Store asks for.
import fs from 'node:fs';

export const CAPTION_HEIGHT = 100;

/** Width and height of a PNG, read from its header. */
export function size(file) {
  const header = fs.readFileSync(file).subarray(16, 24);
  return [header.readUInt32BE(0), header.readUInt32BE(4)];
}

/**
 * Draws `title` over `image` (cropped to fill 1280x700) and saves it as `output`.
 * `ring` marks something worth looking at: { x, y, w, h, radius } in picture pixels (centre x, y).
 */
export async function frame(context, { title, image, output, ring }) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  const marker = ring
    ? `<div style="position:absolute;left:${ring.x - ring.w / 2}px;top:${CAPTION_HEIGHT + ring.y - ring.h / 2}px;width:${ring.w}px;height:${ring.h}px;border-radius:${ring.radius}px;
         border:5px solid #ff2d55;box-shadow:0 0 0 4px rgba(255,255,255,.9), 0 0 24px rgba(255,45,85,.55)"></div>`
    : '';
  await page.setContent(`<!doctype html><body style="margin:0;width:1280px;height:800px;position:relative;overflow:hidden;background:#111">
    <div style="height:${CAPTION_HEIGHT}px;display:flex;align-items:center;justify-content:center;background:linear-gradient(90deg,#1a73e8,#1557b0);
      color:#fff;font:800 46px/1 'Segoe UI',Arial,sans-serif;letter-spacing:-.5px">${title}</div>
    <img src="data:image/png;base64,${fs.readFileSync(image).toString('base64')}" style="display:block;width:1280px;height:700px;object-fit:cover;object-position:center">
    ${marker}</body>`);
  await page.screenshot({ path: output, scale: 'css' });
  await page.close();
}
