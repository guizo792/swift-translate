// Turns captured frames into a small GIF: one shared palette, and only the pixels that changed from
// one frame to the next are drawn (the rest is transparent), so a mostly still screen costs almost nothing.
import gifenc from 'gifenc'; // CommonJS build: its named exports aren't importable directly
import { PNG } from 'pngjs';

const { GIFEncoder, applyPalette, quantize } = gifenc;

const TRANSPARENT = 255;

/** frames: [{ png: Buffer, ms: number }] (all the same size). Returns the GIF as a Uint8Array. */
export function encodeGif(frames) {
  const decoded = frames.map((f) => PNG.sync.read(f.png));
  const { width, height } = decoded[0];

  // One palette for every frame, learned from a sample of their pixels (index 255 is kept for "unchanged").
  const sample = [];
  decoded.forEach((img, i) => {
    if (i % 3) return;
    for (let p = 0; p < img.data.length; p += 4 * 11) sample.push(img.data[p], img.data[p + 1], img.data[p + 2], 255);
  });
  const palette = quantize(Uint8Array.from(sample), 255);
  palette.push([0, 0, 0]);

  const gif = GIFEncoder();
  let previous = null;
  decoded.forEach((img, i) => {
    const index = applyPalette(img.data, palette);
    const out = index.slice();
    if (previous) for (let p = 0; p < index.length; p++) if (index[p] === previous[p]) out[p] = TRANSPARENT;
    gif.writeFrame(out, width, height, {
      ...(i === 0 ? { palette } : {}),
      delay: frames[i].ms,
      transparent: i > 0,
      transparentIndex: TRANSPARENT,
      dispose: 1, // leave the last picture in place, so transparent pixels keep what was there
    });
    previous = index;
  });
  gif.finish();
  return gif.bytes();
}
