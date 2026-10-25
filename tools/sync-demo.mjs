// Copies Data/roles.json into the browser demo (between the /*ROLES*/ markers) and,
// with --bundle <out.html>, inlines the whole UI into one self-contained HTML file.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'AgentOffice');
const www = join(root, 'wwwroot');
const roles = JSON.parse(readFileSync(join(root, 'Data', 'roles.json'), 'utf8'));
const demoPath = join(www, 'demo.js');
const demo = readFileSync(demoPath, 'utf8').replace(/\/\*ROLES\*\/[\s\S]*?\/\*END_ROLES\*\//, `/*ROLES*/${JSON.stringify(roles)}/*END_ROLES*/`);
writeFileSync(demoPath, demo);
console.log(`demo.js: ${roles.length} role templates`);

const i = process.argv.indexOf('--bundle');
if (i > 0) {
  const out = process.argv[i + 1];
  let html = readFileSync(join(www, 'index.html'), 'utf8');
  const inline = (file) => readFileSync(join(www, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  html = html.replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${readFileSync(join(www, 'styles.css'), 'utf8')}\n</style>`);
  html = html.replace('<script src="lib/signalr.min.js"></script>', '');
  html = html.replace('<script src="demo.js"></script>', () => `<script>\n${inline('demo.js')}\n</script>`);
  html = html.replace('<script src="app.js"></script>', () => `<script>\n${inline('app.js')}\n</script>`);
  writeFileSync(out, html);
  console.log(`bundle: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
}
