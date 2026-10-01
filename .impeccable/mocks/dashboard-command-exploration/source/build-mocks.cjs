const fs = require('node:fs');
const path = require('node:path');
const template = fs.readFileSync(path.join(__dirname, 'dashboard.template.html'), 'utf8');
const directions = [
  { mode: 'a', title: 'Command Center', thesis: 'Une file d’attention dominante. Ouvrir le bon dossier, puis agir.' },
  { mode: 'b', title: 'Daily Workspace', thesis: 'Une journée organisée autour du travail commencé et des transmissions attendues.' },
  { mode: 'c', title: 'Hybrid Command Ledger', thesis: 'Une vue du cabinet et un registre d’action, avec un bureau secondaire pour les échéances.' },
];
for (const direction of directions) {
  const replacements = {
    MODE: direction.mode, LETTER: direction.mode.toUpperCase(), TITLE: direction.title,
    THESIS: direction.thesis,
    A_CURRENT: direction.mode === 'a' ? 'aria-current="page"' : '',
    B_CURRENT: direction.mode === 'b' ? 'aria-current="page"' : '',
    C_CURRENT: direction.mode === 'c' ? 'aria-current="page"' : '',
  };
  const html = template.replace(/__([A-Z_]+)__/g, (_, key) => replacements[key] ?? '');
  const destination = path.join(__dirname, '..', `direction-${direction.mode}.html`);
  fs.writeFileSync(destination, html, 'utf8');
  console.log(`Generated direction-${direction.mode}.html (${Buffer.byteLength(html)} bytes)`);
}
