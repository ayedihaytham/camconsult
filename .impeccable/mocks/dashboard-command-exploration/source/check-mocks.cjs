// Static fixture/markup smoke checks only. No browser or application is started.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
let checks = 0;
for (const mode of ['a', 'b', 'c']) {
  const html = fs.readFileSync(path.join(root, `direction-${mode}.html`), 'utf8');
  assert(!html.includes('__MODE__'));
  assert(html.includes('DEMO STRUCTURAL DATA'));
  assert(html.includes('prefers-reduced-motion'));
  assert(/@container workspace \(max-width:\s*600px\)/.test(html));
  assert(!/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(html));
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new vm.Script(script);
  assert(!/\b(?:fetch|XMLHttpRequest)\s*\(/.test(script));
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      innerHTML: '', value: '', id, classList: { toggle() {} },
      setAttribute() {}, focus() {}, showModal() {}, close() {},
    });
    return nodes.get(id);
  }
  const context = vm.createContext({
    document: {
      getElementById: node, querySelector: node, querySelectorAll: () => [],
      addEventListener() {},
    },
    Intl, Date, setTimeout, clearTimeout,
  });
  vm.runInContext(script, context);
  const run = command => vm.runInContext(command, context);
  run("state.role='admin'; state.scope='all'; state.view='overview'; render()");
  assert.equal(run('data().open'), 8);
  assert.equal(run('data().overdue'), 2);
  assert.equal(run('data().unread'), 5);
  assert.equal(run("data().ss.filter(s=>s.status==='actif').length"), 6);
  assert(nodes.get('content').innerHTML.includes(mode === 'a' ? 'À traiter maintenant' : mode === 'b' ? 'Reprendre là où vous en étiez' : 'Le registre d’attention'));
  for (const view of ['overview','attention','work','deadlines','team','activity']) {
    run(`state.view='${view}'; render()`);
    const markup = nodes.get('content').innerHTML;
    assert(markup.includes(`id="tab-${view}"`));
    assert(!markup.includes('undefined'));
    assert(!markup.includes('NaN'));
    checks++;
  }
  run("state.scope='lina'; render()");
  assert.equal(run('data().open'), 3);
  assert.equal(run('data().unread'), 5);
  run("state.role='collab'; state.scope='all'; state.activity='Tout'");
  assert.equal(run('data().open'), 3);
  assert.equal(run('data().overdue'), 1);
  assert.equal(run('data().unread'), 3);
  assert.equal(run('data().ss.length'), 3);
  assert.equal(run("data().feed.filter(i=>i.type==='Journal').length"), 0);
  for (const view of ['overview','attention','work','deadlines','distribution','activity']) {
    run(`state.view='${view}'; render()`);
    const markup = nodes.get('content').innerHTML;
    assert(!markup.includes('Bordereaux à pointer'));
    assert(!markup.includes('Inès Mansour'));
    assert(!markup.includes('Atlas Services'));
    assert(!markup.includes('Horizon Conseil'));
    assert(!markup.includes('data-activity="Journal"'));
    assert(!nodes.get('sidebar').innerHTML.includes('/journal'));
    checks++;
  }
  run("state.view='attention'; state.query='introuvable'; render()");
  assert(nodes.get('content').innerHTML.includes('Aucun élément correspondant'));
  if (mode === 'b') {
    run("state.view='overview'; state.day='2026-10-01'; render()");
    assert(nodes.get('content').innerHTML.includes('Aucune transmission attendue à cette date'));
  }
  assert(run("data().cs.every(c=>c.status!=='valide' && c.status!=='archive')"));
  console.log(`Direction ${mode.toUpperCase()}: script syntax, role/state renders, derived counts, empty states and no-network checks passed`);
}
for (const file of ['index.html','direction-a.html','direction-b.html','direction-c.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  for (const link of [...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1])) {
    assert(fs.existsSync(path.join(root, link)), `${file}: missing ${link}`);
  }
}
console.log(`${checks} role/view render checks passed; all local artifact links resolve.`);
