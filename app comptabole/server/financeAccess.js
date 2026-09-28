/** Financial data is cabinet-internal: company employees never access it. */
export function canAccessFinanceSociete(session, societeId) {
  if (!session || !societeId) return false;
  if (session.role === "admin") return true;
  if (session.poste === "societe_employe") return false;
  return (session.societeIds || []).includes(societeId);
}

/** The shared cabinet AFFECTAT reference is available to internal users only. */
export function canViewGlobalAffectat(session) {
  return Boolean(session && (session.role === "admin" || session.poste !== "societe_employe"));
}
