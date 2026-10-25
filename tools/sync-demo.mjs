// Copies Data/roles.json and the built-in skills (Data/skills/*/SKILL.md: name, description, an excerpt) into the
// browser demo, between the /*ROLES*/ and /*SKILLS*/ markers, and, with --bundle <out.html>, inlines the whole UI
// into one self-contained HTML file.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'AgentOffice');
const www = join(root, 'wwwroot');
const roles = JSON.parse(readFileSync(join(root, 'Data', 'roles.json'), 'utf8'));
const demoPath = join(www, 'demo.js');
// Frontmatter is flat `key: value` lines (see SkillLibrary.Parse); quoted values may contain escaped quotes.
const skillsDir = join(root, 'Data', 'skills');
const skills = (existsSync(skillsDir) ? readdirSync(skillsDir, { withFileTypes: true }) : [])
  .filter((d) => d.isDirectory() && existsSync(join(skillsDir, d.name, 'SKILL.md')))
  .map((d) => {
    const text = readFileSync(join(skillsDir, d.name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
    const fm = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
    const meta = Object.fromEntries((fm?.[1] || '').split('\n').map((l) => /^([A-Za-z][\w-]*):\s?(.*)$/.exec(l)).filter(Boolean)
      .map(([, k, v]) => [k, v.trim().replace(/^"(.*)"$/, (_, x) => x.replace(/\\"/g, '"')).replace(/^'(.*)'$/, '$1')]));
    const body = (fm ? fm[2] : text).trim();
    return { name: meta.name || d.name, description: meta.description || '', instructions: body.length > 1200 ? body.slice(0, 1200) + '\n\n…(the full skill ships with the app)' : body };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
const demo = readFileSync(demoPath, 'utf8')
  .replace(/\/\*ROLES\*\/[\s\S]*?\/\*END_ROLES\*\//, () => `/*ROLES*/${JSON.stringify(roles)}/*END_ROLES*/`)
  .replace(/\/\*SKILLS\*\/[\s\S]*?\/\*END_SKILLS\*\//, () => `/*SKILLS*/${JSON.stringify(skills)}/*END_SKILLS*/`);
writeFileSync(demoPath, demo);
console.log(`demo.js: ${roles.length} role templates, ${skills.length} built-in skills`);

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
