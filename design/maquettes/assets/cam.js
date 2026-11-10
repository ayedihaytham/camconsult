/* CAMCONSULT — moteur commun des templates : contenu réel, scènes au scroll, outils, échéance, formulaire */
(function(){
'use strict';
var CAM=window.CAM={};
var $=CAM.$=function(s,r){return (r||document).querySelector(s)},$$=CAM.$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var clamp=CAM.clamp=function(v,a,b){return Math.min(b,Math.max(a,v))};
CAM.pad=function(n){return String(n).padStart(2,'0')};
CAM.reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
CAM.lerp=function(a,b,t){return a+(b-a)*t};
CAM.ease=function(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2};
CAM.seg=function(p,a,b){return clamp((p-a)/(b-a),0,1)}; /* sous-intervalle de p */

/* ---------- contenu réel (lib/i18n/fr.ts) ---------- */
CAM.SERV=[
 {n:1,t:'Tenue comptable',c:'quotidien',k:'ledger',x:'Une comptabilité fiable et organisée pour piloter votre activité.',d:['Saisie et classement de vos pièces','Rapprochements bancaires mensuels','Situation comptable à jour']},
 {n:2,t:'Conseil & pilotage',c:'decider',k:'kpi',x:'Des indicateurs clairs pour transformer vos données en décisions.',d:['Tableaux de bord mensuels','Analyse de rentabilité et de trésorerie','Points de pilotage réguliers']},
 {n:3,t:'Fiscalité',c:'quotidien',k:'cal',x:'Une stratégie fiscale maîtrisée et un suivi attentif des échéances.',d:['Déclarations fiscales dans les délais','Veille sur les obligations et échéances','Optimisation fiscale légale']},
 {n:4,t:'Révision comptable',c:'securiser',k:'audit',x:'Un regard indépendant pour sécuriser vos comptes et obligations.',d:['Contrôle indépendant des comptes','Rapport de révision détaillé','Recommandations correctives']},
 {n:5,t:'Paie & ressources humaines',c:'quotidien',k:'pay',x:'Une gestion sociale précise, fluide et conforme.',d:['Bulletins de paie mensuels','Déclarations sociales (CNSS)','Suivi des contrats et absences']},
 {n:6,t:'Création d’entreprise',c:'demarrer',k:'doc',x:'Structure, formalités et premiers choix pour bien démarrer.',d:['Choix de la structure juridique','Formalités de constitution','Accompagnement au démarrage']},
 {n:7,t:'Juridique',c:'securiser',k:'act',x:'Des actes et conseils adaptés aux moments clés de votre société.',d:['Rédaction des actes et statuts','Conseil sur les moments clés','Veille réglementaire']},
 {n:8,t:'Finance d’entreprise',c:'decider',k:'fin',x:'Des analyses concrètes pour financer et développer vos projets.',d:['Montage de dossiers de financement','Analyse d’investissement','Plans de développement']}
];
CAM.NEEDS=[{k:'decider',l:'Pour décider',s:'Indicateurs et financement'},{k:'demarrer',l:'Pour démarrer',s:'Créer sa société sereinement'},{k:'quotidien',l:'Au quotidien',s:'Comptes, paie et déclarations'},{k:'securiser',l:'Pour sécuriser',s:'Contrôle et cadre juridique'}];
CAM.STEPS=[
 ['01','Prise de contact','Un premier échange pour comprendre votre contexte.','Un rendez-vous rapide, au cabinet ou par téléphone, sans engagement.'],
 ['02','Diagnostic','Nous identifions vos priorités et vos leviers.','Une vision claire de ce qui est urgent, important et optimisable.'],
 ['03','Proposition','Un accompagnement lisible, adapté à vos besoins.','Une lettre de mission précise : missions, calendrier et honoraires.'],
 ['04','Suivi continu','Un partenaire présent dans la durée.','Des comptes à jour, des échéances tenues et un interlocuteur dédié.']
];
CAM.RIGOR=[['Conformité légale','Une veille attentive de vos obligations.'],['Technologie utile','Des outils simples pour gagner en visibilité.'],['Expertise sectorielle','Une lecture fine de vos enjeux métier.']];
CAM.HUMAN=[['Réactivité','Des réponses claires, au bon moment.'],['Accompagnement personnalisé','Un interlocuteur qui connaît votre histoire.'],['Vision durable','Des décisions pensées pour demain.']];
CAM.FIG=[['25+','Ans d’expérience'],['100+','Clients accompagnés'],['1 200+','Déclarations traitées'],['98%','Clients satisfaits']];
CAM.FAQ=[
 ['Comment prendre rendez-vous ?','Cliquez sur « Prendre rendez-vous », appelez le 98 400 368 ou écrivez à camcompta@planet.tn. Nous vous recontactons pour fixer un créneau, au cabinet ou par téléphone.'],
 ['Travaillez-vous avec les indépendants ?','Oui. Nous accompagnons les indépendants et les professions libérales comme les sociétés, avec un suivi adapté à la taille de votre activité.'],
 ['Proposez-vous des forfaits ?','Oui, selon la mission, nous pouvons convenir d’un forfait clair, défini à l’avance dans la lettre de mission : missions, calendrier et honoraires.'],
 ['Quels documents préparer pour un premier échange ?','Rien de compliqué : venez avec vos questions et, si vous avez déjà une activité, vos derniers documents comptables ou fiscaux. Nous vous dirons ensuite ce dont nous avons besoin.']
];
CAM.CATS=['Création d’entreprise','Tenue comptable','Fiscalité','Paie & RH','Conseil & finance','Autre'];
var I={
 arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
 mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',check:'<path d="m5 12 5 5 9-10"/>',down:'<path d="m6 9 6 6 6-6"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',ne:'<path d="M7 7h10v10M7 17 17 7"/>',shield:'<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>'
};
CAM.ico=function(n,c){return '<svg class="ico'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+I[n]+'</svg>'};
CAM.fmt=function(v){return new Intl.NumberFormat('fr-FR',{minimumFractionDigits:3,maximumFractionDigits:3}).format(v)};

/* ---------- boucle de scroll : lissage + scènes ---------- */
var scenes=[],frames=[],tgt=0,cur=0,running=false;
CAM.scene=function(el,fn){var s={el:el,fn:fn,p:-1,t:0};scenes.push(s);return s};
CAM.frame=function(fn){frames.push(fn)};
function prog(s){var r=s.el.getBoundingClientRect(),tot=r.height-innerHeight;return {r:r,p:tot>0?clamp(-r.top/tot,0,1):(r.top<innerHeight?1:0)}}
var dirty=false,painted=-1;
function paint(){
  var os=scenes.map(prog); /* toutes les lectures de géométrie d'abord, puis les écritures */
  scenes.forEach(function(s,i){
    var o=os[i],vis=o.r.bottom>-innerHeight*.5&&o.r.top<innerHeight*1.5;
    if(!vis&&s.p>=0)return;
    s.t=CAM.reduce?1:o.p;s.p=s.t;
    if(!s.el.hasAttribute('data-nop'))s.el.style.setProperty('--p',s.p.toFixed(4));
    if(s.fn)s.fn(s.p,s.el,o.r);
  });
  frames.forEach(function(f){f()});
  dirty=false;painted=scrollY;
}
CAM.tick=paint;
function loop(){
  if(dirty)paint();
  if(Date.now()-last<160)requestAnimationFrame(loop);else running=false;
}
var last=0;
function kick(){last=Date.now();dirty=true;if(!running){running=true;requestAnimationFrame(loop)}}
addEventListener('scroll',function(){if(scrollY!==painted)kick()},{passive:true});addEventListener('resize',kick);
CAM.start=function(){paint();setTimeout(paint,120);kick()};

/* ---------- apparition, compteurs ---------- */
function countTo(el){
  var raw=el.getAttribute('data-count'),m=raw.match(/^([\d\s]+)(.*)$/);if(!m||CAM.reduce){el.textContent=raw;return}
  var n=parseInt(m[1].replace(/\s/g,''),10),suf=m[2],t0=performance.now(),dur=1400;
  (function st(t){var k=clamp((t-t0)/dur,0,1),v=Math.round(n*(1-Math.pow(1-k,3)));el.textContent=new Intl.NumberFormat('fr-FR').format(v).replace(/ /g,' ')+suf;if(k<1)requestAnimationFrame(st)})(t0);
}
CAM.count=countTo;
CAM.observe=function(){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');if(e.target.hasAttribute('data-count'))countTo(e.target);io.unobserve(e.target)}})},{threshold:.15,rootMargin:'0px 0px -5% 0px'});
  $$('.rv,[data-count]').forEach(function(el){io.observe(el)});
};

/* ---------- ouvert / fermé (lun.–sam. 8h–17h, Africa/Tunis) ---------- */
CAM.open=function(){
  function now(){var p=new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Tunis',hour:'2-digit',hour12:false,weekday:'short'}).formatToParts(new Date());var w=p.filter(function(x){return x.type==='weekday'})[0].value,h=+p.filter(function(x){return x.type==='hour'})[0].value%24;return w!=='Sun'&&h>=8&&h<17}
  function go(){var o=now();$$('[data-open]').forEach(function(e){e.classList.toggle('closed',!o)});$$('[data-open-txt]').forEach(function(e){e.textContent=o?'Ouvert maintenant · ferme à 17h00':'Fermé · ouvre à 8h00'})}
  go();setInterval(go,60000);
};

/* ---------- échéance TVA : le 28, 23 h 59 heure de Tunis (UTC 22:59), rappel .ics ---------- */
CAM.deadline=function(){
  function next(n){var d=Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),28,22,59);if(d<n.getTime())d=Date.UTC(n.getUTCFullYear(),n.getUTCMonth()+1,28,22,59);return new Date(d)}
  var due,tick=function(){
    var n=new Date();due=next(n);var rem=Math.max(0,due-n),f=function(o){return new Intl.DateTimeFormat('fr-FR',Object.assign({timeZone:'Africa/Tunis'},o)).format(due)};
    var map={month:f({month:'long'}),day:f({day:'numeric'}),weekday:f({weekday:'long'}),d:CAM.pad(Math.floor(rem/864e5)),h:CAM.pad(Math.floor(rem%864e5/36e5)),m:CAM.pad(Math.floor(rem%36e5/6e4))};
    $$('[data-dl]').forEach(function(e){e.textContent=map[e.getAttribute('data-dl')]});
    var dd=Math.floor(rem/864e5),pct=clamp(1-rem/(31*864e5),0,1);$$('[data-dl-bar]').forEach(function(e){e.style.setProperty('--k',pct.toFixed(3))});
  };
  tick();setInterval(tick,30000);
  $$('[data-ics]').forEach(function(b){b.addEventListener('click',function(){
    var st=function(d){return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')},day=new Date(due.getTime()-36e5),P=CAM.pad,
    ds=''+day.getUTCFullYear()+P(day.getUTCMonth()+1)+P(day.getUTCDate()),nx=new Date(Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate()+1)),de=''+nx.getUTCFullYear()+P(nx.getUTCMonth()+1)+P(nx.getUTCDate());
    var ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CAMCONSULT//Calendrier fiscal//FR','BEGIN:VEVENT','UID:tva-'+ds+'@camconsult','DTSTAMP:'+st(new Date()),'DTSTART;VALUE=DATE:'+ds,'DTEND;VALUE=DATE:'+de,'SUMMARY:Déclaration de TVA : échéance ce soir','BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Déclaration de TVA : échéance ce soir','TRIGGER:-PT15H','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));a.download='echeance-tva.ics';a.click();
  })});
};

/* ---------- outils fiscaux : TVA 19/13/7 %, IS 0/20/35 %, CNSS 9 % / 16 % ---------- */
CAM.tools=function(root){
  root=root||document;var S={mode:'ht',rate:19,tva:'1000',inc:'120000',sal:'5000'};
  var num=function(v){return Number(String(v).replace(',','.'))||0};
  function paint(){
    var a=num(S.tva),ht=S.mode==='ht'?a:a/(1+S.rate/100),vat=ht*S.rate/100,inc=num(S.inc),tax=Math.max(0,Math.min(inc,1e5)-5e4)*.2+Math.max(0,inc-1e5)*.35,g=num(S.sal);
    var o={ht:CAM.fmt(ht),vat:CAM.fmt(vat),ttc:CAM.fmt(ht+vat),rate:S.rate+' %',inc:CAM.fmt(inc),tax:CAM.fmt(tax),taxrate:(inc?tax/inc*100:0).toFixed(1)+' %',emp:CAM.fmt(g*.09),er:CAM.fmt(g*.16),cost:CAM.fmt(g*1.16),amtlabel:S.mode==='ht'?'Montant HT':'Montant TTC'};
    $$('[data-out]',root).forEach(function(e){var k=e.getAttribute('data-out');if(k in o)e.textContent=o[k]});
    $$('[data-mode]',root).forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-mode')===S.mode)});
    $$('[data-rate]',root).forEach(function(b){b.setAttribute('aria-pressed',+b.getAttribute('data-rate')===S.rate)});
    $$('[data-bar]',root).forEach(function(e){var k=e.getAttribute('data-bar'),v=k==='vat'?vat/Math.max(ht+vat,1):k==='tax'?(inc?tax/inc:0)*2:k==='er'?.16/1.16:0;e.style.setProperty('--k',clamp(v,0,1).toFixed(3))});
  }
  $$('[data-in]',root).forEach(function(i){i.addEventListener('input',function(){this.value=this.value.replace(/[^\d.,]/g,'');S[i.getAttribute('data-in')]=this.value;paint()})});
  root.addEventListener('click',function(e){var b=e.target.closest('[data-mode],[data-rate]');if(!b)return;if(b.hasAttribute('data-mode'))S.mode=b.getAttribute('data-mode');else S.rate=+b.getAttribute('data-rate');paint()});
  paint();
};

/* ---------- blocs rendus (FAQ, contact, pied de page) : le style est propre à chaque template ---------- */
CAM.faq=function(el){el.classList.add('cm-faq');el.innerHTML=CAM.FAQ.map(function(f,i){return '<details'+(i===0?' open':'')+'><summary><span class="n num">'+CAM.pad(i+1)+'</span><span class="q">'+f[0]+'</span><i></i></summary><p>'+f[1]+'</p></details>'}).join('')};
CAM.info=function(el){el.classList.add('cm-info');el.innerHTML=
 '<a href="tel:+21698400368"><span class="ci">'+CAM.ico('phone')+'</span><span><small>Téléphone</small><b dir="ltr">98 400 368</b></span></a>'+
 '<a href="mailto:camcompta@planet.tn"><span class="ci">'+CAM.ico('mail')+'</span><span><small>E-mail</small><b>camcompta@planet.tn</b></span></a>'+
 '<a href="https://www.google.com/maps/search/?api=1&query=21+Rue+Iraq%2C+1001+Lafayette%2C+Tunis" target="_blank" rel="noopener noreferrer"><span class="ci">'+CAM.ico('pin')+'</span><span><small>Adresse</small><b>21 Rue Iraq, 1001 Lafayette, Tunis</b></span></a>'+
 '<div><span class="ci">'+CAM.ico('clock')+'</span><span><small>Horaires</small><b>Lundi à samedi · 8h00 à 17h00</b></span></div>'};
CAM.form=function(el){el.classList.add('cm-form');el.innerHTML=
 '<div><p class="lb" id="cmT" style="margin-bottom:8px">Type de demande *</p><div class="chips" role="group" aria-labelledby="cmT">'+CAM.CATS.map(function(c,i){return '<button type="button" aria-pressed="'+(i===0)+'">'+c.replace('&','&amp;')+'</button>'}).join('')+'</div></div>'+
 '<div class="two"><label class="lb">Nom *<input required name="name" autocomplete="name" placeholder="Prénom et nom"></label><label class="lb">Email *<input required type="email" name="email" autocomplete="email" placeholder="vous@exemple.tn"></label></div>'+
 '<label class="lb">Téléphone <small>(facultatif, pour vous rappeler)</small><input type="tel" name="phone" autocomplete="tel" placeholder="+216 XX XXX XXX"></label>'+
 '<label class="lb">Votre message *<textarea required maxlength="500" rows="3" placeholder="Votre activité, votre forme juridique, ce dont vous avez besoin…"></textarea></label>'+
 '<button class="send" type="submit"><span>Envoyer le message</span>'+CAM.ico('arrow')+'</button>'+
 '<p class="conf">'+CAM.ico('lock')+'Vos informations restent confidentielles et ne servent qu’à vous répondre.</p>';
 el.addEventListener('click',function(e){var b=e.target.closest('.chips button');if(!b)return;$$('.chips button',el).forEach(function(x){x.setAttribute('aria-pressed',x===b)})});
 el.addEventListener('submit',function(e){e.preventDefault();$('.send span',el).textContent='Message envoyé';$('.send',el).classList.add('ok')})};
CAM.footer=function(el){el.classList.add('cm-foot');el.innerHTML=
 '<div><img src="assets/'+(el.getAttribute('data-logo')||'logo-white.png')+'" alt="Cabinet Ayadi Mohamed" width="1500" height="382" style="width:210px;height:auto"><p style="margin-top:16px;opacity:.75;max-width:30ch">L’expertise comptable et le conseil stratégique au service de vos ambitions.</p></div>'+
 '<div><h4>Navigation</h4><ul><li>Accueil</li><li>À propos</li><li>Services</li><li>Outils fiscaux</li><li>Blog</li><li>Ressources</li></ul></div>'+
 '<div><h4>Services</h4><ul><li>Expertise comptable</li><li>Fiscalité</li><li>Audit &amp; conformité</li><li>Paie &amp; RH</li><li>Juridique</li><li>Création d’entreprise</li><li>Conseil &amp; finance</li></ul></div>'+
 '<div><h4>Nous trouver</h4><address>21 Rue Iraq,<br>1001 Lafayette, Tunis<br><span dir="ltr">98 400 368</span><br>camcompta@planet.tn<br>Lun. – Sam. · 8h00 – 17h00</address></div>'};
CAM.footBar=function(el){el.classList.add('cm-foot-b');el.innerHTML='<nav aria-label="Liens légaux"><a href="#">Mentions légales</a><a href="#">Confidentialité</a><a href="#">CGU</a><a href="#">Cookies</a></nav><span>© Cabinet Ayadi Mohamed. Tous droits réservés.</span>'};
CAM.burger=function(){var b=$('[data-burger]'),m=$('[data-menu]');if(!b||!m)return;b.addEventListener('click',function(){var o=m.classList.toggle('open');b.setAttribute('aria-expanded',o);b.innerHTML=CAM.ico(o?'x':'menu')});m.addEventListener('click',function(e){if(e.target.closest('a')){m.classList.remove('open');b.setAttribute('aria-expanded','false');b.innerHTML=CAM.ico('menu')}})};

/* ---------- maquettes de services (mêmes 8 services, 6 visuels) ---------- */
CAM.mock=function(k){
  var L=function(a,b,c){return '<div class="mk-r"><span>'+a+'</span><i></i><b class="num">'+b+'</b></div>'};
  var M={
   ledger:'<div class="mk-h"><b>Journal · Novembre</b><small>à jour</small></div>'+L('Facture 0412','1 190,000')+L('Loyer cabinet','− 850,000')+L('Virement client','4 760,000')+L('Rapprochement','✓ OK'),
   kpi:'<div class="mk-h"><b>Tableau de bord</b><small>Mensuel</small></div><div class="mk-bars"><i style="--h:42%"></i><i style="--h:58%"></i><i style="--h:51%"></i><i style="--h:74%"></i><i style="--h:68%"></i><i style="--h:92%"></i></div><div class="mk-r"><span>Rentabilité</span><i></i><b>+ 12 %</b></div>',
   cal:'<div class="mk-h"><b>Échéances fiscales</b><small>TVA</small></div><div class="mk-cal">'+[7,14,21,28].map(function(d){return '<span'+(d===28?' class="on"':'')+'>'+d+'</span>'}).join('')+'</div>'+L('Déclaration','28 · 23h59'),
   audit:'<div class="mk-h"><b>Rapport de révision</b><small>Indépendant</small></div>'+['Contrôle des comptes','Points de vigilance','Recommandations'].map(function(t){return '<div class="mk-r"><span>'+t+'</span><i></i><b>✓</b></div>'}).join(''),
   pay:'<div class="mk-h"><b>Bulletin de paie</b><small>Mensuel</small></div>'+L('Salaire brut','5 000,000')+L('CNSS salarié 9 %','− 450,000')+L('CNSS employeur 16 %','800,000'),
   doc:'<div class="mk-h"><b>Dossier de création</b><small>Étapes</small></div>'+['Structure juridique','Statuts','Formalités','Démarrage'].map(function(t,i){return '<div class="mk-r"><span>'+t+'</span><i></i><b>'+(i<3?'✓':'→')+'</b></div>'}).join(''),
   act:'<div class="mk-h"><b>Statuts de la société</b><small>Acte</small></div><div class="mk-lines"><i></i><i></i><i style="width:70%"></i><i></i><i style="width:45%"></i></div><div class="mk-r"><span>Signature</span><i></i><b>✓</b></div>',
   fin:'<div class="mk-h"><b>Plan de financement</b><small>Projet</small></div><div class="mk-bars"><i style="--h:30%"></i><i style="--h:44%"></i><i style="--h:63%"></i><i style="--h:80%"></i></div>'+L('Investissement','Analysé')
  };
  return M[k]||M.ledger;
};

/* ---------- défilement fluide (inertie) + ancres + vitesse ---------- */
CAM.vel=0;
CAM.smooth=function(){
  var fine=matchMedia('(pointer:fine)').matches;
  var target=scrollY,cur=scrollY,on=false;
  function max(){return document.documentElement.scrollHeight-innerHeight}
  function step(){cur+=(target-cur)*.14;if(Math.abs(target-cur)<.4){cur=target;on=false}scrollTo(0,cur);CAM.tick();if(on)requestAnimationFrame(step)}
  CAM.to=function(y){target=clamp(y,0,max());if(!fine||CAM.reduce){scrollTo({top:target,behavior:CAM.reduce?'auto':'smooth'});return}if(!on){on=true;cur=scrollY;requestAnimationFrame(step)}};
  var lastY=scrollY;
  (function v(){CAM.vel+=((scrollY-lastY)-CAM.vel)*.12;lastY=scrollY;requestAnimationFrame(v)})();
  if(fine&&!CAM.reduce){
    addEventListener('wheel',function(e){
      if(e.ctrlKey||e.target.closest('textarea,input,[data-nosnap]'))return;
      e.preventDefault();var dy=e.deltaMode===1?e.deltaY*32:e.deltaY;
      target=clamp((on?target:scrollY)+dy,0,max());
      if(!on){on=true;cur=scrollY;requestAnimationFrame(step)}
    },{passive:false});
    addEventListener('scroll',function(){if(!on){target=scrollY;cur=scrollY}},{passive:true});
  }
  document.addEventListener('click',function(e){var a=e.target.closest('a[href^="#"]');if(!a||a.getAttribute('href')==='#')return;var el=document.querySelector(a.getAttribute('href'));if(!el)return;e.preventDefault();CAM.to(el.getBoundingClientRect().top+scrollY)});
};
/* boutons magnétiques */
CAM.magnet=function(sel){if(!matchMedia('(pointer:fine)').matches||CAM.reduce)return;$$(sel).forEach(function(b){b.addEventListener('pointermove',function(e){var r=b.getBoundingClientRect();b.style.transform='translate('+((e.clientX-r.left-r.width/2)*.18).toFixed(1)+'px,'+((e.clientY-r.top-r.height/2)*.25).toFixed(1)+'px)'});b.addEventListener('pointerleave',function(){b.style.transform=''})})};
})();
