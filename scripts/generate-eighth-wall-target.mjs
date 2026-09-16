// Offline asset generation only; uses the pinned official processor, never a site build.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { applyCrop } from '@8thwall/image-target-cli/src/apply.js';
import { getDefaultCrop } from '@8thwall/image-target-cli/src/crop.js';

const root = new URL('../', import.meta.url);
const assets = new URL('public/assets/', root);
const output = new URL('public/image-targets/', root);
await mkdir(output, { recursive: true });
const logo = (await readFile(new URL('pizza-inn-logo.png', assets))).toString('base64');
// Distinct silhouettes, text and irregular landmarks survive grayscale conversion.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960">
<rect width="960" height="960" fill="#fff6dc"/>
<path d="M24 310V24H936V936H24V670" fill="none" stroke="#193e2b" stroke-width="18"/>
<path d="M38 78H128V172H38M818 820H920V918H850V872H792" fill="none" stroke="#c6442c" stroke-width="20"/>
<image href="data:image/png;base64,${logo}" x="720" y="72" width="150" height="168"/>
<g fill="#193e2b" font-family="DejaVu Sans, sans-serif" font-weight="bold">
<text x="178" y="153" font-size="80">SLICE</text><text x="170" y="239" font-size="80">SNAKE</text>
<text x="166" y="857" font-size="42">ONE MORE BITE.</text><text x="180" y="901" font-size="24">01 / PRINT · SCAN · PLAY</text></g>
<path d="M195 365H431V475H293V652H547V565H689V720H778" fill="none" stroke="#173d2a" stroke-width="83" stroke-linejoin="round"/>
<path d="M195 365H431V475H293V652H547V565H689V720H778" fill="none" stroke="#39875a" stroke-width="53" stroke-linejoin="round"/>
<g fill="#fff6dc"><rect x="370" y="340" width="18" height="20"/><rect x="411" y="340" width="18" height="20"/></g>
<g fill="#193e2b"><rect x="377" y="347" width="8" height="10"/><rect x="413" y="347" width="8" height="10"/></g>
<path d="M535 285L773 390L563 509Z" fill="#f6bd42" stroke="#193e2b" stroke-width="12"/>
<path d="M535 285Q538 389 563 509" fill="none" stroke="#c67a30" stroke-width="28"/>
<g fill="#bc3826" stroke="#193e2b" stroke-width="5"><circle cx="605" cy="353" r="22"/><circle cx="615" cy="438" r="18"/><circle cx="691" cy="391" r="25"/></g>
<g fill="none" stroke="#193e2b" stroke-width="12"><path d="M77 365L123 408L68 461L115 500M804 297L859 273L900 325L843 359Z"/><circle cx="818" cy="545" r="44"/><path d="M795 545H841M818 522V568M134 699L100 762L146 787"/></g>
<g fill="#bd402a"><path d="M140 270L172 290L156 323L119 311Z"/><path d="M376 750L399 701L432 728L424 777Z"/><path d="M470 300L497 270L515 321Z"/><path d="M778 617L834 639L812 677Z"/></g>
<g stroke="#193e2b" stroke-width="8"><path d="M193 528L228 557M182 560L222 586M503 418L510 459M486 432L530 440M625 775L670 803M674 769L653 815"/></g>
</svg>`;
await writeFile(new URL('eighth-wall-target.svg', assets), svg);
const png = await sharp(Buffer.from(svg)).png().toBuffer();
await writeFile(new URL('eighth-wall-target.png', assets), png);
const geometry = getDefaultCrop({ width: 960, height: 960 }, false);
const { dataPath } = await applyCrop(sharp(png), { type: 'PLANAR', geometry }, output.pathname, 'slice-snake-square', true);
const data = JSON.parse(await readFile(dataPath, 'utf8'));
data.metadata = { printWidthMm: 160, artwork: 'eighth-wall-target.png', boardSpan: 'full-square-height' };
// Stable provenance timestamps make regeneration reviewable.
data.created = data.updated = Date.UTC(2026, 8, 16);
await writeFile(dataPath, JSON.stringify(data, null, 2) + '\n');
console.log('Generated 160 mm square artwork and official 8th Wall target data.');
