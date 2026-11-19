import { Link } from "react-router-dom";
import { ArrowRight, FolderOpen } from "lucide-react";
import { COLLECTE_STATUT_LABELS, TAB_BY_KEY } from "@/lib/collecte/tabs";
import { cn, formatDate } from "@/lib/utils";
import type { Collecte, Tache } from "@/types";

const TON_STATUT: Record<string, string> = {
  brouillon: "bg-[#E2EAF0] text-[#285378]",
  transmis: "bg-[#DBE8F8] text-[#1F5AA6]",
  a_corriger: "bg-[#FBEBC4] text-[#8A5A0B]",
  valide: "bg-[#DDF0E5] text-[#1D5D41]",
  archive: "bg-[#ECEDF0] text-[#5C6670]",
};

/** Collecte dont on parle dans une conversation : la plus récente qui n'est ni validée ni archivée, sinon la dernière créée. */
export function collecteDuFil(collectes: Collecte[], societeId: string | null | undefined): Collecte | null {
  if (!societeId) return null;
  const siennes = collectes.filter((c) => c.societeId === societeId && c.statut !== "archive");
  const ouvertes = siennes.filter((c) => c.statut !== "valide");
  const tri = (a: Collecte, b: Collecte) => (b.creeLe ?? "").localeCompare(a.creeLe ?? "");
  return [...ouvertes].sort(tri)[0] ?? [...siennes].sort(tri)[0] ?? null;
}

const joursAvant = (echeance: string | null | undefined) => {
  if (!echeance) return null;
  const jour = new Date().setHours(0, 0, 0, 0);
  return Math.round((new Date(echeance).setHours(0, 0, 0, 0) - jour) / 86_400_000);
};

function delai(echeance: string | null | undefined): { texte: string; retard: boolean } | null {
  const j = joursAvant(echeance);
  if (j === null) return null;
  if (j < 0) return { texte: `Échéance dépassée de ${-j} j`, retard: true };
  if (j === 0) return { texte: "Échéance aujourd'hui", retard: false };
  return { texte: `Échéance dans ${j} j`, retard: false };
}

/** Bande « dossier lié » sous l'en-tête du fil : société, collecte et son état, bouton pour l'ouvrir. */
export function BandeDossier({ societeNom, collecte, route, onDetails }: { societeNom: string; collecte: Collecte | null; route: string | null; onDetails?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/10 border-l-4 border-l-accent bg-card px-3.5 py-2.5">
      <FolderOpen className="size-[18px] shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Dossier lié</p>
        <p className="truncate text-sm font-bold text-primary">{societeNom}{collecte ? ` · Collecte ${collecte.periode}` : ""}</p>
      </div>
      {collecte && <span className={cn("rounded-full px-3 py-0.5 text-xs font-bold", TON_STATUT[collecte.statut])}>{COLLECTE_STATUT_LABELS[collecte.statut]}</span>}
      {onDetails && <button type="button" onClick={onDetails} className="inline-flex h-8 items-center rounded-lg border border-primary/25 bg-card px-3 text-xs font-bold text-primary transition-colors hover:bg-[#F5F8FD] xl:hidden">Voir le dossier</button>}
      {collecte && route && (
        <Link to={route} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/25 bg-card px-3 text-xs font-bold text-primary transition-colors hover:bg-[#F5F8FD]">
          Ouvrir la collecte <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

const ETAPES = ["Chez le client", "Transmise", "Validée"] as const;
const ETAPE_DU_STATUT: Record<string, number> = { brouillon: 0, a_corriger: 0, transmis: 1, valide: 2, archive: 2 };

/** Panneau de droite : où en est la collecte (circuit, progression, tableaux demandés), tâches de la société, accès à la collecte. */
export function PanneauDossier({ societeNom, collecte, taches, route, onCreerTache }: { societeNom: string; collecte: Collecte | null; taches: Tache[]; route: string | null; onCreerTache?: () => void }) {
  const d = collecte ? delai(collecte.echeance) : null;
  const demandes = collecte?.tableauxDemandes ?? 0;
  const transmis = collecte?.tableauxTransmis ?? 0;
  const valides = collecte?.tableauxValides ?? 0;
  const recus = transmis + valides;
  const aRemplir = Math.max(0, demandes - recus);
  const etape = collecte ? (ETAPE_DU_STATUT[collecte.statut] ?? 0) : 0;
  const tableaux = (collecte?.onglets ?? []).map((cle) => TAB_BY_KEY[cle]?.label ?? cle);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{collecte ? "Collecte liée" : "Dossier"} · {societeNom}</p>
          <p className="mt-0.5 font-serif text-2xl font-semibold leading-tight text-primary">{collecte ? collecte.periode : societeNom}</p>
          {collecte && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11.5px] font-bold", TON_STATUT[collecte.statut])}>{COLLECTE_STATUT_LABELS[collecte.statut]}</span>
              {d && <span className={cn("text-[12.5px]", d.retard ? "font-bold text-[#A8402B]" : "text-muted-foreground")}>{d.texte}{collecte.echeance ? ` · ${formatDate(collecte.echeance)}` : ""}</span>}
            </div>
          )}
        </div>

        {collecte ? (
          <>
            <ol className="flex items-start" aria-label="Circuit de la collecte">
              {ETAPES.map((nom, i) => (
                <li key={nom} aria-current={i === etape ? "step" : undefined} className={cn("relative flex-1 text-center text-[11px] font-semibold", i === etape ? "font-bold text-primary" : i < etape ? "text-primary" : "text-muted-foreground")}>
                  {i > 0 && <span aria-hidden="true" className={cn("absolute left-[-50%] top-[9px] h-0.5 w-full", i <= etape ? "bg-primary" : "bg-border")} />}
                  <span aria-hidden="true" className={cn("relative z-[1] mx-auto mb-1.5 block size-5 rounded-full border-2 bg-card", i < etape && "border-primary bg-primary", i === etape && "border-accent shadow-[0_0_0_4px_hsl(var(--accent)/0.25)]", i > etape && "border-border")} />
                  {nom}
                </li>
              ))}
            </ol>

            <div>
              {demandes > 0 ? (
                <>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <b className="font-serif text-[22px] font-semibold tabular-nums text-primary">{recus} / {demandes}</b>
                    <span className="text-xs text-muted-foreground">tableaux reçus</span>
                  </div>
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${recus} tableaux reçus sur ${demandes}`}>
                    <i className="block h-full bg-primary" style={{ width: `${(valides / demandes) * 100}%` }} />
                    <i className="block h-full bg-accent" style={{ width: `${(transmis / demandes) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11.5px] text-muted-foreground">
                    <span><b className="text-primary">{aRemplir}</b> à remplir</span>
                    <span><b className="text-primary">{transmis}</b> à examiner</span>
                    <span><b className="text-primary">{valides}</b> validé{valides > 1 ? "s" : ""}</span>
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Aucun tableau envoyé au client pour le moment.</p>
              )}
            </div>

            {tableaux.length > 0 && (
              <div className="border-t border-border pt-3.5">
                <p className="mb-2 flex justify-between text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Tableaux demandés <em className="not-italic text-primary">{tableaux.length}</em></p>
                <ul className="flex flex-wrap gap-1.5">
                  {tableaux.slice(0, 3).map((t) => <li key={t} className="rounded-full border border-border px-2.5 py-0.5 text-[11.5px] font-semibold text-muted-foreground">{t}</li>)}
                  {tableaux.length > 3 && <li className="rounded-full border border-border px-2.5 py-0.5 text-[11.5px] font-semibold text-muted-foreground" title={tableaux.slice(3).join(", ")}>+{tableaux.length - 3}</li>}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Aucune collecte en cours pour cette société.</p>
        )}

        <div className="border-t border-border pt-3.5">
          <p className="mb-2 flex justify-between text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Tâches de la société <em className="not-italic text-primary">{taches.length}</em></p>
          {taches.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
              Aucune tâche ouverte
              {onCreerTache && <button type="button" onClick={onCreerTache} className="mt-1 block w-full text-[12.5px] font-bold text-primary underline underline-offset-2">＋ Créer une tâche</button>}
            </div>
          ) : (
            <ul className="space-y-2">
              {taches.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", t.statut === "en_cours" ? "bg-primary" : "bg-[#7284a1]")} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-bold text-primary" title={t.titre}>{t.titre}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{t.statut === "en_cours" ? "En cours" : "À faire"}{t.finPrevue ? ` · ${formatDate(t.finPrevue)}` : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {collecte && route && (
        <Link to={route} className="mt-4 inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-primary transition-[filter] hover:brightness-105">
          {collecte.statut === "transmis" ? "Examiner la collecte" : "Ouvrir la collecte"}
        </Link>
      )}
    </div>
  );
}
