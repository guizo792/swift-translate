// Drives the real extension on real pages: select text with the mouse, click the icon, read the popup.
export const EN_ARTICLE = 'https://en.wikipedia.org/wiki/Language_acquisition?useskin=minerva';
export const DE_ARTICLE = 'https://de.wikipedia.org/wiki/Spracherwerb?useskin=minerva';

/** Opens an article in Wikipedia's plain reading skin, with the site chrome hidden. */
export async function openArticle(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.addStyleTag({
    content: `
    .header-container, .page-actions-menu, .banner-container, #page-secondary-actions, .minerva-footer { display: none !important }
    .content, #bodyContent { max-width: 760px; margin: 0 auto !important; font-size: 20px; line-height: 1.7 }
    .pre-content { max-width: 760px; margin: 24px auto 0 !important }
    ::-webkit-scrollbar { display: none }`,
  });
  await page.waitForTimeout(600);
}

/**
 * Finds `target` inside the first paragraph text that contains `context` and returns where it is,
 * in viewport pixels, after scrolling it to the middle of the window. `target` defaults to all of `context`.
 */
export async function locate(page, context, target = context, { top } = {}) {
  const box = await page.evaluate(
    ([context, target, top]) => {
      const nodes = [];
      const walker = document.createTreeWalker(document.querySelector('#bodyContent'), NodeFilter.SHOW_TEXT);
      let text = '';
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        nodes.push({ node: n, start: text.length });
        text += n.data;
      }
      const base = text.indexOf(context);
      if (base < 0) return null;
      const from = base + context.indexOf(target);
      const to = from + target.length;
      const at = (pos, end) => {
        const hit = nodes.filter((x) => (end ? x.start < pos : x.start <= pos)).pop();
        return [hit.node, pos - hit.start];
      };
      const range = document.createRange();
      range.setStart(...at(from, false));
      range.setEnd(...at(to, true));
      if (top === undefined) range.startContainer.parentElement.scrollIntoView({ block: 'center' });
      else window.scrollBy(0, range.getBoundingClientRect().top - top); // `top` px below the window's top edge
      const rects = [...range.getClientRects()].filter((r) => r.width > 1);
      const rect = (r) => ({ x: r.x, y: r.y, w: r.width, h: r.height });
      return { first: rect(rects[0]), last: rect(rects[rects.length - 1]) };
    },
    [context, target, top],
  );
  if (!box) throw new Error(`text not found on the page: ${context.slice(0, 50)}`);
  return box;
}

const mid = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Double-clicks a word, like a reader would. Returns the word's box. */
export async function selectWord(page, context, word) {
  const { first } = await locate(page, context, word);
  const { x, y } = mid(first);
  await page.mouse.move(x - 60, y + 30, { steps: 8 });
  await page.mouse.move(x, y, { steps: 6 });
  await page.mouse.dblclick(x, y);
  return first;
}

/** Drags across a stretch of text, from its first character to its last. */
export async function selectText(page, text) {
  const { first, last } = await locate(page, text);
  await page.mouse.move(first.x - 40, first.y + first.h + 30, { steps: 8 });
  await page.mouse.move(first.x + 1, first.y + first.h / 2, { steps: 6 });
  await page.mouse.down();
  await page.mouse.move(last.x + last.w - 1, last.y + last.h / 2, { steps: 20 });
  await page.mouse.up();
  return { first, last };
}

// Google's free translate endpoint answers "429 Too Many Requests" when lookups come close together
// (a second request inside a second or so is refused, and the block then lasts a while). So the
// scripts leave a gap between lookups, and wait and retry if one is refused.
const LOOKUP_GAP = 15_000;
const RETRY_WAIT = 45_000;
let lastLookup = 0;

// The popup lives in a shadow root, so poll through the locator (which sees into it).
async function readResult(page) {
  let text = '...';
  for (let i = 0; i < 80 && text === '...'; i++) {
    await page.waitForTimeout(250);
    text = await page.locator('#res').innerText();
  }
  return text;
}
const failed = (text) => text === '...' || text.startsWith('Translation failed') || text.startsWith('Google is limiting');

/** Waits out the gap since the last lookup. Call before clicking the icon. */
export const pace = (page) => page.waitForTimeout(Math.max(0, lastLookup + LOOKUP_GAP - Date.now()));

/** Clicks the icon that appears by the selection and waits until the popup has a translation. */
export async function openPopup(page) {
  const icon = page.locator('button[title="Translate"]');
  await icon.waitFor({ timeout: 10_000 });
  const iconBox = await icon.boundingBox();
  await pace(page);
  await icon.click();
  await page.locator('.gt-box').waitFor();
  return { iconBox, ...(await waitForTranslation(page)) };
}

/** After the icon was clicked: waits for the translation, and asks again if Google refused. */
export async function waitForTranslation(page) {
  lastLookup = Date.now();
  let text = await readResult(page);
  for (let attempt = 1; failed(text) && attempt <= 3; attempt++) {
    console.log(`  lookup refused, waiting ${RETRY_WAIT / 1000}s (attempt ${attempt})`);
    await page.waitForTimeout(RETRY_WAIT);
    // Choosing the same target language again makes the popup look the text up again.
    const target = page.locator('#tl');
    const code = await target.getAttribute('data-value');
    await target.click();
    await page.locator(`.lang-panel [role=option][data-value="${code}"]`).first().click();
    lastLookup = Date.now();
    text = await readResult(page);
  }
  if (failed(text)) throw new Error(`no translation: ${text}`);
  await page.waitForTimeout(600); // the slide-in animation, and the dictionary filling in
  return { text };
}

export const popupBox = (page) => page.locator('.gt-box').boundingBox();
