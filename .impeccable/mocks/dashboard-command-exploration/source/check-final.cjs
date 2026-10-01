// Source-level prototype checks. No application, server or browser is started.
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'direction-b-final.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
assert(!/\b(?:fetch|XMLHttpRequest)\s*\(/.test(script));
assert(html.includes('DEMO STRUCTURAL DATA'));
assert(html.includes('prefers-reduced-motion'));
assert(!/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(html));
const nodes=new Map(), listeners={};
function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',id,value:'',classList:{toggle(){}},setAttribute(){},focus(){},showModal(){},close(){}});return nodes.get(id)}
const context=vm.createContext({document:{getElementById:node,querySelector:node,querySelectorAll:()=>[],addEventListener(type,fn){(listeners[type]??=[]).push(fn)}},Intl,Date,setTimeout,clearTimeout});
vm.runInContext(script,context);
const run=s=>vm.runInContext(s,context);
const markup=()=>nodes.get('content').innerHTML;
const scenarios=['normal','no-resume','no-today','no-tasks','no-messages','no-work','loading','partial-error'];
let checks=0;
for(const role of ['admin','collab'])for(const scenario of scenarios){
  run(`state.role='${role}';state.scope='all';state.scenario='${scenario}';state.query='';state.filter='all';state.taskFilter='open';state.activity='Tout';state.view='overview';render()`);
  const overview=markup();
  const order=['data-tour="dashboard-resume"','data-tour="dashboard-transmissions"','data-tour="dashboard-tasks"','Tâches à commencer','data-tour="dashboard-attention"','data-tour="dashboard-communication"'].map(t=>overview.indexOf(t));
  for(let i=1;i<order.length;i++)assert(order[i]>order[i-1],`Order: ${role}/${scenario}`);
  for(const view of ['overview','work','attention','deadlines',...(role==='admin'?['team']:[]),'activity']){
    run(`state.view='${view}';render()`);
    assert(!markup().includes('undefined'));
    assert(!markup().includes('NaN'));
    assert(markup().includes(`id="tab-${view}"`));
    assert(markup().includes(`aria-labelledby="tab-${view}"`));
    if(role==='collab'){
      for(const forbidden of ['data-scope-choice','id="tab-team"','data-activity="Journal"','Atlas Services','Inès Mansour','Bordereaux à pointer'])assert(!markup().includes(forbidden),`${role}/${scenario}/${view}: ${forbidden}`);
    }
    if(scenario==='loading'){
      assert(markup().includes('Chargement'));
      for(const wrong of ['Aucune tâche en cours.','Aucun message non lu.','Aucune transmission attendue aujourd’hui.','Aucun élément à traiter dans ce périmètre'])assert(!markup().includes(wrong));
    }
    if(scenario==='partial-error')assert(markup().includes('Les collectes n’ont pas pu être chargées.'));
    checks++;
  }
  if(scenario==='partial-error'){
    assert.equal(run('data().overdue'),null);
    assert.equal(run('data().open'),role==='admin'?8:3);
    assert.equal(run('data().unread'),role==='admin'?5:3);
    run("state.view='deadlines';render()");assert(markup().includes('Collectes indisponibles'));assert(!markup().includes('Aucune échéance de collecte ouverte'));
  }
  if(scenario==='no-resume')assert.equal(run("taskRows(data(),'en_cours').length"),0);
  if(scenario==='no-tasks')assert.equal(run('data().open'),0);
  if(scenario==='no-messages')assert.equal(run('data().unread'),0);
  if(scenario==='no-today')assert.equal(run("data().cs.filter(c=>c.due==='2026-09-30').length"),0);
}
run("state.role='admin';state.scenario='normal';state.scope='lina';state.view='overview';render()");
assert.equal(run('data().open'),3);assert.equal(run('data().unread'),5);
assert(nodes.get('topbar').innerHTML.includes('Mohamed Ayedi'));
assert(markup().includes('vous restez connecté à votre compte'));
assert(markup().includes('Déjà transmis · à examiner'));
run("state.scenario='partial-error';render()");
const retry={dataset:{},hasAttribute:name=>name==='data-retry'};
for(const callback of listeners.click)callback({target:{closest:()=>retry}});
assert.equal(run('state.scenario'),'normal');assert.equal(run('data().overdue'),1);
run("state.scope='all';state.view='attention';state.query='introuvable';render()");assert(markup().includes('Aucun élément correspondant'));
for(const type of ['collecte','message','other']){
 run(`state.query='';state.filter='${type}'`);
 const queue=run('groupedQueue(data())');
 if(type==='message'){assert(queue.includes('Lina Ben Ali'));assert(!queue.includes('Carthage Digital'))}
 if(type==='other'){assert(queue.includes('Bordereaux à pointer'));assert(!queue.includes('Carthage Digital'))}
}
run("state.view='overview';render()");
const ids=[...markup().matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
for(const anchor of ['dashboard-summary','dashboard-scope','dashboard-resume','dashboard-deadline-strip','dashboard-tasks','dashboard-attention','dashboard-quick-actions','dashboard-tabs','dashboard-work'])assert(markup().includes(`data-tour="${anchor}"`));
for(const link of [...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]))assert(fs.existsSync(path.join(root,link)),link);
console.log(`${checks} role/scenario/view renders passed; scope, counts, missing-source states, retry, source filters, DOM order, IDs, tour anchors, links and no-network checks passed.`);
