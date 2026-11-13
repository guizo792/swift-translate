// Makes the Firefox version of the extension in firefox/build: node build.mjs
//
// It is the same code as the Chrome version. Only the manifest differs: Firefox runs the background script as an
// event page, not a service worker, and wants an add-on id and a statement of what data the extension sends.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(import.meta.dirname, 'build');
const FILES = ['background.js', 'content.js', 'languages.js', 'popup.html', 'popup.js', 'vocab.html', 'vocab.js', 'icons'];

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
manifest.background = { scripts: ['background.js'] };
manifest.browser_specific_settings = {
  gecko: {
    id: 'swift-translate@guizo792',
    strict_min_version: '140.0',
    // The text you select is sent to Google to be translated, and nothing else leaves the device.
    data_collection_permissions: { required: ['websiteContent'] },
  },
  gecko_android: { strict_min_version: '142.0' },
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of FILES) fs.cpSync(path.join(ROOT, f), path.join(OUT, f), { recursive: true });
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`firefox/build ready: version ${manifest.version}`);
