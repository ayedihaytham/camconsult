const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const base = fs.readFileSync(path.join(root, 'direction-b.html'), 'utf8');
const script = base.match(/<script>([\s\S]*?)<\/script>/)[1];
const prefix = script.slice(0, script.indexOf('      function data()'));
function extract(name) {
  const start = script.indexOf(`      function ${name}(`);
  if (start < 0) throw Error(`Missing B helper: ${name}`);
  const after = script.slice(start + 1);
  const boundary = after.search(/\n      (?:function |let toastTimer|document\.addEventListener)/);
  if (boundary < 0) throw Error(`Missing helper boundary: ${name}`);
  return script.slice(start, start + 1 + boundary);
}
const helpers = ['shell','queueRows','team','activityRows','openDialog','destination','changeView'].map(extract).join('\n');
const events = script.slice(script.indexOf('      let toastTimer;'));
const behavior = fs.readFileSync(path.join(__dirname, 'final-workspace.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'final-workspace.css'), 'utf8');
const finalScript = prefix + helpers + '\n' + behavior + '\n' + events;
let html = base.replace(/<script>[\s\S]*?<\/script>/, () => `<script>${finalScript}</script>`)
  .replace('</head>', () => `<style>${css}</style></head>`)
  .replace('CamConsult — Daily Workspace · exploration', 'CamConsult — Daily Workspace final · design')
  .replace('B / Daily Workspace', 'B FINAL / Daily Workspace')
  .replace('class="stage direction-b"', 'class="stage direction-b final-candidate"')
  .replace(/<nav class="review-links"[\s\S]*?<\/nav>/, `<nav class="review-links" aria-label="Comparer les maquettes"><a href="direction-b-final.html" aria-current="page">B final</a><a href="direction-b.html">B initial</a><a href="direction-a.html">A</a><a href="direction-c.html">C</a></nav>`)
  .replace('<div class="device"', `<label class="sr" for="scenario">État de démonstration</label><select id="scenario"><option value="normal">Données complètes</option><option value="no-resume">Rien à reprendre</option><option value="no-today">Pas d’échéance aujourd’hui</option><option value="no-tasks">Aucune tâche ouverte</option><option value="no-messages">Aucun message non lu</option><option value="no-work">Périmètre sans travail ouvert</option><option value="loading">Chargement</option><option value="partial-error">Échec partiel · collectes</option></select><div class="device"`)
  .replace('Une journée organisée autour du travail commencé et des transmissions attendues.', 'Reprendre, suivre les transmissions et avancer dans son travail.')
  .replace('href="source-findings.md">Sources & faisabilité', 'href="final-design-notes.md">Décisions & préparation');
fs.writeFileSync(path.join(root, 'direction-b-final.html'), html, 'utf8');
console.log(`Generated direction-b-final.html (${Buffer.byteLength(html)} bytes)`);
