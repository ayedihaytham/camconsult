import type { DashboardDataInput } from "./dashboardData";
import type { Collecte, Employe, Societe, Tache } from "@/types";
import type { Session } from "@/store/auth";

export const NOW = new Date("2026-09-30T10:00:00");
export const permissions = { consulterDossiers: true, deposerFichiers: true, modifierSocietes: false, supprimer: false, messagerie: true };
export function employee(id = "emp-1", assigned = ["soc-1"]): Employe { return { id, nom: id, prenom: "Amira", identifiant: id, motDePasse: "", type: "Comptable", role: "collaborateur", email: "", statut: "actif", societesAssignees: assigned, permissions, creeLe: "2026-09-01T08:00:00Z" }; }
export function society(id = "soc-1"): Societe { return { id, raisonSociale: `Société ${id}`, rne: "", tva: "", theme: "PME", code: id, statut: "actif", telephone: "", email: "", adresse: "", creeLe: "2026-09-01T08:00:00Z" }; }
export function task(id: string, statut: Tache["statut"] = "en_cours", assigneId: string | null = "emp-1"): Tache { return { id, titre: `Travail ${id}`, description: "", societeId: "soc-1", assigneId, statut, origine: "cabinet", module: null, creePar: "admin", creeLe: "2026-09-01T08:00:00Z", majLe: "2026-09-28T08:00:00Z", termineLe: null }; }
export function collection(id = "col-1", echeance = "2026-09-30", statut: Collecte["statut"] = "brouillon"): Collecte { return { id, societeId: "soc-1", periode: "Septembre 2026", statut, onglets: [], devise: "TND", echeance, derniereRelanceLe: null, relanceCadenceJours: 3, creeLe: "2026-09-01T08:00:00Z", majLe: "2026-09-28T08:00:00Z", transmisLe: null, valideLe: null }; }
export function dashboardInput(patch: Partial<DashboardDataInput> = {}): DashboardDataInput { return { role: "admin", viewerEmployeId: null, canUseMessaging: true, now: NOW, societes: [society()], collaborateurs: [employee()], noeuds: [], taches: [task("first"), task("second"), task("todo", "a_faire")], conversations: [], notifications: [], collectes: [collection()], bordereaux: [], journalEntries: [], adminName: "Cabinet", ...patch }; }
export function session(poste: Session["poste"] = null): Session { return { role: poste ? "employe" : "admin", poste, employeId: poste ? "emp-1" : null, nom: "Amira", fonction: "", initiales: "A", cabinetNom: "Cabinet", permissions, societeIds: poste ? ["soc-1"] : null }; }
