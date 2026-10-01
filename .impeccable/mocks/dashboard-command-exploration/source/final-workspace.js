// Final candidate: prototype state only, using the structural fixtures from B.
state.scenario = "normal";
state.taskFilter = "open";
const isCollectionReady = (d) => d.collectionState === "ready";
const countLabel = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const panelHead = (title, description) =>
  `<div class="section-head"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div></div>`;
function data() {
  const loading = state.scenario === "loading";
  const collectionState = loading
    ? "loading"
    : state.scenario === "partial-error"
      ? "error"
      : "ready";
  const allowed =
    state.role === "collab"
      ? employees[0].societies
      : societies.map((s) => s.id);
  const selected =
    state.role === "admin" && state.scope !== "all"
      ? employees.find((e) => e.id === state.scope)
      : null;
  const ids = selected ? selected.societies : allowed;
  let ss = societies.filter((s) => ids.includes(s.id));
  let cs = collections.filter(
    (c) => ids.includes(c.society) && !["valide", "archive"].includes(c.status),
  );
  let ts = tasks.filter(
    (t) =>
      (state.role === "collab" ? t.assignee === "lina" : true) &&
      (!selected || t.assignee === selected.id),
  );
  let msgs = conversations.filter((m) => m.role === state.role);
  if (state.scenario === "no-resume")
    ts = ts.map((t) =>
      t.status === "en_cours" ? { ...t, status: "a_faire" } : t,
    );
  if (state.scenario === "no-tasks")
    ts = ts.filter((t) => t.status === "termine");
  if (state.scenario === "no-today")
    cs = cs.filter((c) => c.due !== "2026-09-30");
  if (state.scenario === "no-messages") msgs = [];
  if (state.scenario === "no-work") {
    ts = ts.filter((t) => t.status === "termine");
    cs = [];
    msgs = [];
    ss = ss.map((s) =>
      s.status === "en_attente" ? { ...s, status: "actif" } : s,
    );
  }
  if (loading) {
    ts = [];
    msgs = [];
  }
  if (collectionState !== "ready") cs = [];
  const queue = cs.flatMap((c) => {
    const late = days(c.due) < 0;
    if (!late && !["a_corriger", "transmis"].includes(c.status)) return [];
    return [
      {
        id: c.id,
        title: societyName(c.society),
        desc: late
          ? `Septembre 2026 · échéance dépassée de ${countLabel(Math.abs(days(c.due)), "jour")}`
          : c.status === "a_corriger"
            ? "Septembre 2026 · corrections demandées"
            : "Septembre 2026 · collecte transmise au cabinet",
        type: "collecte",
        group: late
          ? "overdue"
          : c.status === "a_corriger"
            ? "correction"
            : "review",
        status: late
          ? "Échéance dépassée"
          : c.status === "a_corriger"
            ? "À corriger"
            : "À examiner",
        tone: late ? "red" : c.status === "a_corriger" ? "amber" : "",
        date: shortDate(c.due),
        route: "/collectes/" + c.id,
        icon: late ? "alert" : "collecte",
        action: "Consulter",
      },
    ];
  });
  if (!loading)
    queue.push(
      ...ss
        .filter((s) => s.status === "en_attente")
        .map((s) => ({
          id: s.id,
          title: s.name,
          desc: "Société en attente de traitement",
          type: "societe",
          group: "review",
          status: "En attente",
          tone: "amber",
          date: "30 sept",
          route: "/societes",
          icon: "building",
          action: "Consulter",
        })),
    );
  queue.push(
    ...msgs.map((m) => ({
      id: m.id,
      title: m.title,
      desc: m.preview,
      type: "message",
      group: "communication",
      status: countLabel(m.unread, "non lu", "non lus"),
      tone: "",
      date: m.time,
      route: "/messagerie",
      icon: "message",
      action: "Lire",
    })),
  );
  if (
    !loading &&
    state.role === "admin" &&
    !selected &&
    state.scenario !== "no-work"
  )
    queue.push({
      id: "bank",
      title: "Bordereaux à pointer",
      desc: "2 bordereaux non pointés",
      type: "bordereau",
      group: "other",
      status: "À pointer",
      tone: "",
      date: "29 sept",
      route: "/bordereaux",
      icon: "bank",
      action: "Consulter",
    });
  const feed = loading
    ? []
    : activity
        .filter(
          (a) =>
            (a.type === "Message" || ids.includes(a.society)) &&
            allowed.includes(a.society) &&
            (state.role === "admin" || a.type !== "Journal"),
        )
        .map((a) =>
          state.role === "collab" && a.type === "Message"
            ? {
                ...a,
                title: "Cabinet CamConsult",
                detail: "Pouvez-vous vérifier les pièces de septembre ?",
              }
            : a,
        );
  return {
    ss,
    cs,
    ts,
    msgs,
    queue,
    feed,
    selected,
    collectionState,
    taskReady: !loading,
    messageReady: !loading,
    activityReady: !loading,
    open: loading ? null : ts.filter((t) => t.status !== "termine").length,
    overdue:
      collectionState === "ready"
        ? cs.filter((c) => days(c.due) < 0).length
        : null,
    unread: loading ? null : msgs.reduce((n, m) => n + m.unread, 0),
  };
}
function banner(d) {
  const admin = state.role === "admin";
  return `<header class="banner" data-tour="dashboard-summary"><div class="banner-top"><div class="daily-identity"><div class="daily-date" aria-label="Mercredi 30 septembre 2026"><strong>30</strong><span>septembre</span></div><div><p class="greeting">Bonjour ${admin ? "Mohamed" : "Lina"} · mercredi</p><h1>${admin ? "Le travail du cabinet" : "Mon espace de travail"}</h1><p>${admin ? "Reprendre un dossier, suivre les transmissions, avancer." : "Reprendre mes tâches et suivre les transmissions de mes sociétés."}</p></div></div><button class="button inverse" data-quick data-tour="dashboard-quick-actions">Actions rapides${icon("chevron")}</button></div><div class="gold-rule"></div></header>`;
}
function metrics(d) {
  const admin = state.role === "admin";
  const rows = [
    {
      value:
        state.scenario === "loading"
          ? null
          : admin
            ? d.ss.filter((s) => s.status === "actif").length
            : d.ss.length,
      label: admin
        ? d.selected
          ? "Sociétés actives du périmètre"
          : "Clients actifs"
        : "Mes sociétés",
      route: "/societes",
    },
    {
      value: d.open,
      label: admin ? "Tâches ouvertes" : "Mes tâches ouvertes",
      route: "/taches",
    },
    { value: d.unread, label: "Mes messages non lus", route: "/messagerie" },
    {
      value: d.overdue,
      label: "Échéances en retard",
      view: "deadlines",
      danger: true,
    },
  ];
  return `<nav class="metrics" aria-label="Ouvrir les espaces de travail">${rows
    .map((m) => {
      const unknown = m.value === null;
      return `<button class="metric ${m.danger && !unknown && m.value > 0 ? "danger" : ""}" ${unknown ? "disabled" : m.view ? `data-view="${m.view}"` : `data-open="${m.route}" data-title="${m.label}"`} aria-label="${esc(unknown ? m.label + " · " + (state.scenario === "loading" ? "chargement" : "indisponible") : m.value + " " + m.label)}"><strong class="num">${unknown ? "—" : m.value}</strong><span>${m.label}</span>${icon("arrow")}</button>`;
    })
    .join(
      "",
    )}</nav>${state.role === "admin" && d.selected ? '<p class="metric-note">Dossiers et tâches filtrés. Les messages restent ceux de votre compte.</p>' : ""}`;
}
function scope() {
  if (state.role !== "admin")
    return `<div class="scope-bar" data-tour="dashboard-scope"><div class="scope-personal">${icon("tasks")}<strong>Mon travail</strong><span>· 3 sociétés accessibles</span></div><button class="button mobile-help" data-quick data-tour="dashboard-quick-actions" aria-label="Ouvrir les actions rapides">Actions${icon("chevron")}</button></div>`;
  const employee = state.scope !== "all";
  return `<div class="scope-bar" data-tour="dashboard-scope"><div class="scope-main"><div class="scope-switch" aria-label="Périmètre des dossiers et tâches"><button data-scope-choice="cabinet" aria-pressed="${!employee}">Tout le cabinet</button><button data-scope-choice="employee" aria-pressed="${employee}">Collaborateur</button></div>${employee ? `<label class="sr" for="scope">Choisir le collaborateur dont les dossiers et tâches sont affichés</label><select id="scope">${employees.map((e) => `<option value="${e.id}" ${state.scope === e.id ? "selected" : ""}>${e.name}</option>`).join("")}</select>` : ""}<button class="button mobile-help" data-quick data-tour="dashboard-quick-actions" aria-label="Ouvrir les actions rapides">Actions${icon("chevron")}</button></div><span class="scope-caption">${employee ? "Dossiers et tâches filtrés · vous restez connecté à votre compte" : "Dossiers et tâches du cabinet · messages de mon compte"}</span></div>`;
}
function tabs() {
  const rows = [
    ["overview", "Mon bureau"],
    ["work", "Tâches"],
    ["attention", "À traiter"],
    ["deadlines", "Échéances"],
    ...(state.role === "admin" ? [["team", "Équipe"]] : []),
    ["activity", "Activité"],
  ];
  return `<div class="tabs" data-tour="dashboard-tabs" role="tablist" aria-label="Espaces du Dashboard">${rows.map(([v, l]) => `<button role="tab" id="tab-${v}" data-view="${v}" aria-controls="view-panel" aria-selected="${state.view === v}" tabindex="${state.view === v ? "0" : "-1"}" ${v === "attention" ? 'data-tour="dashboard-attention-lens"' : ""}>${l}</button>`).join("")}</div>`;
}
function skeleton(label) {
  return `<div class="load-block" role="status" aria-live="polite"><div aria-hidden="true"><div class="load-line"></div><div class="load-line"></div><div class="load-line"></div></div><p class="load-label">${esc(label)}</p></div>`;
}
function unavailable(d) {
  return d.collectionState === "loading"
    ? skeleton("Chargement des collectes…")
    : `<div class="source-unavailable"><strong>Collectes indisponibles</strong>Les échéances et corrections n’ont pas pu être chargées.<br><button class="textlink" data-retry>Réessayer${icon("arrow")}</button></div>`;
}
function partialStatus(d) {
  return d.collectionState === "error"
    ? `<div class="workspace-status" role="status"><div class="status-copy">${icon("alert")}<div><strong>Les collectes n’ont pas pu être chargées.</strong><p>Les tâches et messages restent accessibles. Les échéances ne sont pas disponibles.</p></div></div><button class="button" data-retry>Réessayer les collectes</button></div>`
    : "";
}
function taskRows(d, status) {
  return d.ts
    .filter((t) => (status ? t.status === status : t.status !== "termine"))
    .map((t) => ({
      id: t.id,
      title: t.title,
      desc:
        societyName(t.society) +
        (state.role === "admin" ? " · " + employeeName(t.assignee) : ""),
      status: taskLabel[t.status],
      tone: t.status === "termine" ? "green" : "",
      icon: "tasks",
      route: "/taches",
      action: "Ouvrir",
    }));
}
function resume(d) {
  const rows = taskRows(d, "en_cours");
  return `<section class="desk-section resume-section" data-tour="dashboard-resume"><div class="desk-title"><div><h2>${state.role === "admin" ? "Reprendre le travail en cours" : "Reprendre mon travail"}</h2><p>Le travail déjà commencé, prêt à être poursuivi.</p></div></div>${!d.taskReady ? skeleton("Chargement du travail en cours…") : rows.length ? `<article class="resume-entry"><span class="queue-icon">${icon("tasks")}</span><div><h3>${esc(rows[0].title)}</h3><p class="context">${esc(rows[0].desc)}</p>${badge("En cours")}</div>${action("Reprendre", "/taches", rows[0].title)}</article>` : `<div class="resume-empty"><strong>Aucune tâche en cours.</strong>${d.open > 0 ? "Choisissez une tâche à commencer, dans la liste ci-dessous." : "Vous pouvez consulter vos tâches ou suivre les prochaines collectes."}</div>`}</section>`;
}
function transmissionRow(c) {
  const label =
    c.status === "transmis"
      ? "Déjà transmis · à examiner"
      : c.status === "a_corriger"
        ? "Corrections demandées"
        : "Transmission attendue";
  return `<article class="transmission-row"><time datetime="${c.due}">${c.due.slice(-2)}<small>${new Intl.DateTimeFormat("fr", { month: "short" }).format(new Date(c.due + "T12:00:00"))}</small></time><div><strong>${esc(societyName(c.society))}</strong><p>Collecte · septembre 2026<br>${label}</p>${badge(collectionLabel[c.status], c.status === "a_corriger" ? "amber" : "")}</div>${action("Ouvrir la collecte", "/collectes/" + c.id, societyName(c.society))}</article>`;
}
function dailyDateRail(d) {
  const dates = [
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
    "2026-10-05",
  ];
  return `<p class="date-rail-caption">Dates limites de transmission des collectes</p><div class="date-rail" aria-label="Choisir un jour pour les échéances de collecte">${dates
    .map((date) => {
      const n = d.cs.filter((c) => c.due === date).length;
      return `<button class="day-button" data-day="${date}" aria-pressed="${state.day === date}" aria-label="${date === "2026-09-30" ? "Aujourd’hui, " : ""}${shortDate(date)}, ${countLabel(n, "échéance")} de collecte"><small>${new Intl.DateTimeFormat("fr", { weekday: "short" }).format(new Date(date + "T12:00:00"))}</small><strong>${date.slice(-2)}</strong><em>${n ? countLabel(n, "collecte") : "Aucune"}</em></button>`;
    })
    .join("")}</div>`;
}
function transmissions(d) {
  const onDate = d.cs.filter((c) => c.due === state.day);
  const next = d.cs
    .filter((c) => c.due > state.day && days(c.due) >= 0)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 2);
  return `<section class="desk-section transmission-section" data-tour="dashboard-transmissions"><div class="desk-title"><div><h2>Transmissions de collecte</h2><p>Les dates des dossiers ouverts, distinctes du statut des tâches.</p></div></div>${!isCollectionReady(d) ? unavailable(d) : `<div data-tour="dashboard-deadline-strip">${dailyDateRail(d)}</div><div class="date-selection"><strong>${state.day === "2026-09-30" ? "Aujourd’hui · 30 septembre" : shortDate(state.day)}</strong><small>${countLabel(onDate.length, "échéance")}</small></div>${onDate.length ? onDate.map(transmissionRow).join("") : `<p class="date-empty"><strong>Aucune transmission attendue ${state.day === "2026-09-30" ? "aujourd’hui" : "à cette date"}.</strong><br>Consultez les prochaines échéances ci-dessous.</p>`}${next.length ? `<p class="next-label">Prochaines dates</p>${next.map(transmissionRow).join("")}` : '<p class="date-empty">Aucune autre échéance à venir dans ce périmètre.</p>'}${link("Toutes les échéances", "deadlines")}`}</section>`;
}
function progress(d) {
  const rest = taskRows(d, "en_cours").slice(1);
  return `<section class="desk-section progress-section" data-tour="dashboard-tasks"><div class="desk-title"><div><h2>${state.role === "admin" ? "Autres tâches en cours" : "Mes tâches en cours"}</h2><p>Les tâches sont regroupées par statut, sans date limite.</p></div>${d.taskReady ? `<small>${countLabel(taskRows(d, "en_cours").length, "tâche")}</small>` : ""}</div>${!d.taskReady ? skeleton("Chargement des tâches…") : rest.length ? queueRows(rest) : `<p class="date-empty">${taskRows(d, "en_cours").length ? "Votre tâche en cours figure dans Reprendre." : "Aucune tâche en cours. Les tâches à faire apparaissent ci-dessous."}</p>`}</section>`;
}
function begin(d) {
  const rows = taskRows(d, "a_faire");
  return `<section class="desk-section start-section"><div class="desk-title"><div><h2>Tâches à commencer</h2><p>${state.role === "admin" ? "Tâches à faire dans le périmètre sélectionné." : "Le travail qui vous est attribué."}</p></div>${d.taskReady ? `<small>${countLabel(rows.length, "tâche")}</small>` : ""}</div>${!d.taskReady ? skeleton("Chargement des tâches à faire…") : rows.length ? queueRows(rows.slice(0, 3)) : '<p class="date-empty">Aucune tâche à faire dans ce périmètre.</p>'}${d.taskReady ? link("Toutes les tâches", "work") : ""}</section>`;
}
function attentionSidebar(d) {
  const overdue = d.queue.filter((i) => i.group === "overdue");
  const correction = d.queue.filter((i) => i.group === "correction");
  const review = d.queue.filter((i) => ["review", "other"].includes(i.group));
  const mini = (label, rows) =>
    rows.length
      ? `<div class="attention-mini-group"><h3>${label} · ${rows.length}</h3>${rows
          .slice(0, 2)
          .map(
            (i) =>
              `<div class="subrow"><div><strong>${esc(i.title)}</strong><p>${badge(i.status, i.tone)}<br>${esc(i.desc)}</p></div>${action("Consulter", i.route, i.title)}</div>`,
          )
          .join("")}</div>`
      : "";
  return `<section class="side-section" data-tour="dashboard-attention"><div class="desk-title"><div><h2>À traiter</h2><p>Les points à vérifier, sans interrompre votre travail.</p></div></div>${!isCollectionReady(d) ? unavailable(d) : mini("Échéances dépassées", overdue) + mini("Corrections", correction)}${mini("À examiner", review)}${isCollectionReady(d) && !overdue.length && !correction.length && !review.length ? '<p class="side-empty"><strong>Aucun dossier à examiner ici.</strong>Les échanges non lus restent accessibles ci-dessous.</p>' : ""}${link("Tous les éléments", "attention")}</section>`;
}
function communication(d) {
  return `<section class="side-section" data-tour="dashboard-communication"><div class="desk-title"><div><h2>Mes messages non lus</h2><p>${state.role === "admin" ? "Les échanges de votre compte, quel que soit le filtre." : "Les échanges qui vous concernent."}</p></div>${d.messageReady ? `<span class="side-counter">${d.unread}</span>` : ""}</div>${
    !d.messageReady
      ? skeleton("Chargement des conversations…")
      : d.msgs.length
        ? d.msgs
            .slice(0, 2)
            .map(
              (m) =>
                `<div class="subrow"><div><strong>${esc(m.title)}</strong><p>${badge(countLabel(m.unread, "non lu", "non lus"))}<br>${esc(m.preview)}</p></div>${action("Lire", "/messagerie", m.title)}</div>`,
            )
            .join("")
        : '<p class="side-empty"><strong>Aucun message non lu.</strong>Vos conversations restent dans la messagerie.</p>'
  }<button class="textlink" data-open="/messagerie" data-title="Messagerie">Ouvrir la messagerie${icon("arrow")}</button></section>`;
}
function overviewB(d) {
  return `<div class="workdesk"><div class="work-main">${resume(d)}${transmissions(d)}${progress(d)}${begin(d)}</div><aside class="work-side" aria-label="Suivi et communication">${attentionSidebar(d)}${communication(d)}</aside></div>${state.role === "admin" ? `<section class="admin-summary"><div><strong>Le travail de l’équipe</strong><p>${d.taskReady ? `${countLabel(d.ts.filter((t) => t.status === "a_faire").length, "tâche")} à faire · ${d.ts.filter((t) => t.status === "en_cours").length} en cours · ${d.ts.filter((t) => t.status === "termine").length} terminées` : "Chargement de la répartition des tâches…"}</p></div>${link("Répartition", "team")}</section>` : ""}`;
}
function toolbar() {
  return `<div class="toolbar"><label class="search">${icon("search")}<span class="sr">Rechercher dans les dossiers et échanges à traiter</span><input id="queue-search" type="search" placeholder="Société ou échange…" value="${esc(state.query)}"></label><div class="filters" aria-label="Type d’élément à traiter">${[
    ["all", "Tout"],
    ["collecte", "Collectes"],
    ["message", "Messages"],
    ["other", "Autres"],
  ]
    .map(
      ([v, l]) =>
        `<button data-filter="${v}" aria-pressed="${state.filter === v}">${l}</button>`,
    )
    .join("")}</div></div>`;
}
function groupedQueue(d) {
  const items = d.queue.filter((i) => {
    const matchesType = state.filter === "all" ||
      (state.filter === "other" ? !["collecte", "message"].includes(i.type) : i.type === state.filter);
    return matchesType && (i.title + " " + i.desc + " " + i.status)
      .toLocaleLowerCase("fr").includes(state.query.toLocaleLowerCase("fr"));
  });
  const groups = [
    ["overdue", "Échéances dépassées"],
    ["correction", "Corrections"],
    ["review", "À examiner"],
    ["communication", "Communication"],
    ["other", "Autres éléments"],
  ];
  return `<div id="queue-results">${d.collectionState === "error" ? '<p class="partial-note">Liste partielle : les collectes ne sont pas disponibles. Les autres éléments restent accessibles.</p>' : ""}${
    state.scenario === "loading"
      ? skeleton("Chargement des éléments à traiter…")
      : items.length
        ? groups
            .map(([key, label]) => {
              const rows = items.filter((i) => i.group === key);
              return rows.length
                ? `<div class="group-label"><span>${label}</span><span>${rows.length}</span></div>${queueRows(rows)}`
                : "";
            })
            .join("")
        : `<div class="empty"><strong>${state.query || state.filter !== "all" ? "Aucun élément correspondant" : d.collectionState === "error" ? "Aucun autre élément disponible" : "Aucun élément à traiter dans ce périmètre"}</strong>${state.query || state.filter !== "all" ? "Essayez une autre recherche ou affichez tous les types." : d.collectionState === "error" ? "Les collectes restent à charger. Réessayez pour connaître les échéances et corrections." : "Vous pouvez reprendre votre travail ou consulter les collectes."}</div>`
  }${state.scenario === "loading" ? "" : `<div class="ledger-footer"><span>${countLabel(items.length, "élément")} ${d.collectionState === "error" ? "disponibles" : "affichés"}</span><span>Groupés par besoin d’action</span></div>`}</div>`;
}
function attention(d) {
  return (
    panelHead(
      "À traiter",
      "Échéances de collecte, corrections, dossiers à examiner et échanges non lus.",
    ) +
    `<section class="attention-panel" data-tour="dashboard-attention">${toolbar()}${groupedQueue(d)}</section>`
  );
}
function work(d) {
  const filter = state.taskFilter;
  const groups =
    filter === "done"
      ? [["termine", "Terminées"]]
      : [
          ["en_cours", "En cours"],
          ["a_faire", "À faire"],
        ];
  return (
    panelHead(
      state.role === "admin" ? "Tâches du périmètre" : "Mes tâches",
      "Le travail est regroupé par statut. Les tâches n’ont pas de date limite.",
    ) +
    `<div class="view-summary"><div class="filters" aria-label="État des tâches"><button data-task-state="open" aria-pressed="${filter === "open"}">Ouvertes</button><button data-task-state="done" aria-pressed="${filter === "done"}">Terminées</button><button class="textlink" data-open="/taches" data-title="Tâches">Ouvrir les tâches${icon("arrow")}</button></div></div><section data-tour="dashboard-tasks">${
      !d.taskReady
        ? skeleton("Chargement des tâches…")
        : groups
            .map(([status, title]) => {
              const rows = taskRows(d, status);
              return `<section class="docket-group"><div class="docket-head"><h3>${title}</h3><small>${countLabel(rows.length, "tâche")}</small></div>${rows.length ? queueRows(rows) : '<p class="date-empty">Aucune tâche dans ce groupe.</p>'}</section>`;
            })
            .join("")
    }</section>`
  );
}
function deadlines(d) {
  const groups = [
    ["overdue", "En retard"],
    ["today", "Aujourd’hui"],
    ["week", "7 prochains jours"],
    ["later", "Plus tard"],
  ];
  return (
    panelHead(
      "Échéances des collectes",
      "Dates de transmission des dossiers ouverts. Les collectes validées ou archivées sont exclues.",
    ) +
    `<div class="deadline-content" data-tour="dashboard-transmissions">${
      !isCollectionReady(d)
        ? unavailable(d)
        : d.cs.length
          ? groups
              .map(([key, title]) => {
                const cs = d.cs
                  .filter((c) => bucket(c.due) === key)
                  .sort((a, b) => a.due.localeCompare(b.due));
                return cs.length
                  ? `<section class="deadline-group"><h3>${title} · ${cs.length}</h3>${cs.map(transmissionRow).join("")}</section>`
                  : "";
              })
              .join("")
          : '<p class="date-empty">Aucune échéance de collecte ouverte dans ce périmètre.</p>'
    }</div>`
  );
}
function activityView(d) {
  const types = [
    "Tout",
    "Fichier",
    "Message",
    ...(state.role === "admin" ? ["Journal"] : []),
  ];
  const rows =
    state.activity === "Tout"
      ? d.feed
      : d.feed.filter((a) => a.type === state.activity);
  return (
    panelHead(
      "Activité récente",
      "Les derniers éléments accessibles, pour retrouver ce qui a changé.",
    ) +
    `<div class="activity-content"><div class="activity-filter" aria-label="Filtrer l’activité">${types.map((t) => `<button data-activity="${t}" aria-pressed="${state.activity === t}">${t}</button>`).join("")}</div>${!d.activityReady ? skeleton("Chargement de l’activité…") : rows.length ? `<h3 class="small muted">30 septembre 2026</h3>${activityRows(rows)}` : '<p class="date-empty">Aucun élément récent de ce type dans votre périmètre.</p>'}<p class="activity-source-note">Aperçu limité aux derniers fichiers, conversations${state.role === "admin" ? " et événements du journal" : ""}. Ce n’est pas un historique complet.</p></div>`
  );
}
function render() {
  const d = data();
  shell();
  document.getElementById("role").value = state.role;
  document.getElementById("scenario").value = state.scenario;
  const body =
    state.view === "overview"
      ? overviewB(d)
      : state.view === "work"
        ? work(d)
        : state.view === "attention"
          ? attention(d)
          : state.view === "deadlines"
            ? deadlines(d)
            : state.view === "team" && state.role === "admin"
              ? d.taskReady
                ? team(d)
                : panelHead(
                    "Répartition des tâches",
                    "Volumes réels par statut, sans mesure de capacité.",
                  ) + skeleton("Chargement du travail de l’équipe…")
              : activityView(d);
  document.getElementById("content").innerHTML =
    banner(d) +
    metrics(d) +
    scope() +
    tabs() +
    `<div id="view-panel" data-tour="dashboard-work" class="panel" role="tabpanel" tabindex="0" aria-labelledby="tab-${state.view}">${partialStatus(d)}${body}</div><div class="endnote"><span>DEMO STRUCTURAL DATA · noms, chiffres et événements fictifs</span><span>Scénario fixé au 30/09/2026</span></div><div class="help-footer"><button class="help desktop-help" data-help>${icon("help")} Aide</button></div>`;
}
document.addEventListener("change", (event) => {
  if (event.target.id === "scenario") {
    state.scenario = event.target.value;
    state.query = "";
    state.filter = "all";
    render();
  }
});
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.scopeChoice) {
    state.scope =
      b.dataset.scopeChoice === "cabinet"
        ? "all"
        : state.scope === "all"
          ? "lina"
          : state.scope;
    render();
    document
      .querySelector(`[data-scope-choice="${b.dataset.scopeChoice}"]`)
      ?.focus({ preventScroll: true });
  }
  if (b.dataset.taskState) {
    state.taskFilter = b.dataset.taskState;
    render();
    document
      .querySelector(`[data-task-state="${state.taskFilter}"]`)
      ?.focus({ preventScroll: true });
  }
  if (b.hasAttribute("data-retry")) {
    state.scenario = "normal";
    render();
    document.getElementById("view-panel")?.focus({ preventScroll: true });
  }
});
