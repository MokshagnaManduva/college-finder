import fs from 'node:fs';
import path from 'node:path';

const assets = fs.readdirSync('dist/assets');
const js = assets.filter(name => name.endsWith('.js'));
const css = assets.filter(name => name.endsWith('.css'));
if (js.length !== 1) throw new Error('Standalone preview requires a single JS bundle');
const script = fs.readFileSync(path.join('dist/assets', js[0]), 'utf8').replace(/<\/script/gi, '<\\/script');
const styles = css.map(name => fs.readFileSync(path.join('dist/assets', name), 'utf8')).join('\n');
fs.mkdirSync('../preview', { recursive: true });
fs.writeFileSync('../preview/college-finder.html', `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#1d4a3b"><title>College Finder · Demo Preview</title><style>${styles}</style></head><body><div id="root"></div><script type="module">${script}</script></body></html>`);
console.log('Standalone preview: ../preview/college-finder.html');
