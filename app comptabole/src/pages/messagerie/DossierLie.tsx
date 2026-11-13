import { Link } from "react-router-dom";
import { ArrowRight, FolderOpen } from "lucide-react";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
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
export function BandeDossier({ societeNom, collecte, route }: { societeNom: string; collecte: Collecte | null; route: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/10 border-l-4 border-l-[#2A6DBF] bg-card px-3.5 py-2.5">
      <FolderOpen className="size-[18px] shrink-0 text-[#2A6DBF]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Dossier lié</p>
        <p className="truncate text-sm font-bold text-primary">{societeNom}{collecte ? ` · Collecte ${collecte.periode}` : ""}</p>
      </div>
      {collecte && <span className={cn("rounded-full px-3 py-0.5 text-xs font-bold", TON_STATUT[collecte.statut])}>{COLLECTE_STATUT_LABELS[collecte.statut]}</span>}
      {collecte && route && (
        <Link to={route} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/25 bg-card px-3 text-xs font-bold text-primary transition-colors hover:bg-[#F5F8FD]">
          Ouvrir la collecte <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/** Panneau de droite : circuit de la collecte, tâches de la société, bouton d'accès. */
export function PanneauDossier({ societeNom, collecte, taches, route }: { societeNom: string; collecte: Collecte | null; taches: Tache[]; route: string | null }) {
  const d = collecte ? delai(collecte.echeance) : null;
  const demandes = collecte?.tableauxDemandes ?? 0;
  const transmis = collecte?.tableauxTransmis ?? 0;
  const valides = collecte?.tableauxValides ?? 0;
  const tuiles: { cle: string; n: number; libelle: string; trait: string }[] = [
    { cle: "a-remplir", n: Math.max(0, demandes - transmis - valides), libelle: "À remplir", trait: "border-t-[#7A8CA0]" },
    { cle: "a-examiner", n: transmis, libelle: "À examiner", trait: "border-t-[#2A6DBF]" },
    { cle: "valides", n: valides, libelle: "Validés", trait: "border-t-[#246549]" },
  ];
  return (
    <>
      <div>
        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{collecte ? "Collecte liée" : "Dossier"}</p>
        <p className="mt-1 font-display text-lg font-extrabold leading-tight text-primary">{collecte ? collecte.periode : societeNom}</p>
        {collecte && <p className="text-xs text-muted-foreground">{societeNom}</p>}
        {d && <p className={cn("mt-0.5 text-[12.5px] font-bold", d.retard ? "text-destructive" : "text-muted-foreground")}>{d.texte}{collecte?.echeance ? ` · ${formatDate(collecte.echeance)}` : ""}</p>}
      </div>

      {collecte ? (
        <div className="grid grid-cols-3 gap-2">
          {tuiles.map((t) => (
            <div key={t.cle} className={cn("rounded-[10px] border border-primary/10 border-t-[3px] px-2.5 py-2", t.trait)}>
              <p className="font-display text-xl font-extrabold leading-none tabular-nums text-primary">{t.n}</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">{t.libelle}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Aucune collecte en cours pour cette société.</p>
      )}

      <div className="border-t border-primary/10 pt-3">
        <p className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Tâches de la société</p>
        {taches.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune tâche ouverte.</p>
        ) : (
          <ul className="space-y-2">
            {taches.slice(0, 4).map((t) => (
              <li key={t.id} className="flex items-start gap-2">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", t.statut === "en_cours" ? "bg-[#2A6DBF]" : "bg-[#7A8CA0]")} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-bold text-primary" title={t.titre}>{t.titre}</span>
                  <span className="block text-[11.5px] text-muted-foreground">{t.statut === "en_cours" ? "En cours" : "À faire"}{t.finPrevue ? ` · ${formatDate(t.finPrevue)}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {collecte && route && (
        <Link to={route} className="mt-auto inline-flex h-10 items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground transition-colors hover:bg-primary/90">
          {collecte.statut === "transmis" ? "Examiner la collecte" : "Ouvrir la collecte"}
        </Link>
      )}
    </>
  );
}
