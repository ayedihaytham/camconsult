import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BellRing, FolderOpen, Info } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { useCollectes } from "@/store/collectes";
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
const TABLEAUX_VISIBLES = 3;

const jours = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;

/** Titre de section commun : petites capitales, compteur en Playfair à droite. */
function TitreSection({ children, nombre }: { children: string; nombre?: number }) {
  return (
    <h3 className="mb-2 flex items-baseline gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
      {nombre !== undefined && <b className="ml-auto font-serif text-[15px] font-semibold normal-case tracking-normal text-primary">{nombre}</b>}
    </h3>
  );
}

/**
 * Fiche du dossier lié (à droite du fil, ou en volet du bas sur téléphone) : en-tête avec les informations clés, puis des sections
 * de même gabarit (avancement, tableaux, tâches, relances) et les actions fixées en pied.
 */
export function PanneauDossier({ societeNom, collecte, taches, route, onCreerTache }: { societeNom: string; collecte: Collecte | null; taches: Tache[]; route: string | null; onCreerTache?: () => void }) {
  const { canManageCollaborateurs } = usePermissions();
  const relanceNow = useCollectes((s) => s.relanceNow);
  const [relance, setRelance] = useState(false);
  const [tousLesTableaux, setTousLesTableaux] = useState(false);
  const j = collecte ? joursAvant(collecte.echeance) : null;
  const demandes = collecte?.tableauxDemandes ?? 0;
  const recus = (collecte?.tableauxTransmis ?? 0) + (collecte?.tableauxValides ?? 0);
  const tableaux = (collecte?.onglets ?? []).map((cle) => TAB_BY_KEY[cle]?.label ?? cle);
  const visibles = tousLesTableaux ? tableaux : tableaux.slice(0, TABLEAUX_VISIBLES);
  const etape = collecte ? (ETAPE_DU_STATUT[collecte.statut] ?? 0) : 0;
  const attendClient = collecte ? collecte.statut === "brouillon" || collecte.statut === "a_corriger" : false;
  const delaiTexte = j === null ? "—" : j < 0 ? `dépassée de ${jours(-j)}` : j === 0 ? "aujourd'hui" : `dans ${jours(j)}`;

  return (
    <div className="-m-5 flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <header className="border-b-[3px] border-double border-border px-5 pb-3.5 pt-[18px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a98a4a]">Dossier lié</p>
          <h2 className="mt-0.5 font-serif text-[22px] font-semibold leading-tight text-primary">{societeNom}</h2>
          {collecte && <p className="text-[12.5px] text-muted-foreground">Collecte {collecte.periode ? `de ${collecte.periode.charAt(0).toLowerCase()}${collecte.periode.slice(1)}` : "en cours"}</p>}
          {collecte && (
            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border">
              {[
                ["État", <span key="e" className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-accent" aria-hidden="true" />{COLLECTE_STATUT_LABELS[collecte.statut]}</span>],
                ["Échéance", collecte.echeance ? formatDate(collecte.echeance) : "—"],
                ["Délai", <span key="d" className={cn(j !== null && j < 0 && "font-bold text-[#A8402B]")}>{delaiTexte}</span>],
                ["Tableaux", demandes > 0 ? `${recus} / ${demandes} transmis` : "Aucun demandé"],
              ].map(([libelle, valeur]) => (
                <div key={String(libelle)} className="bg-card px-2.5 py-2">
                  <dt className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{libelle}</dt>
                  <dd className="text-[12.5px] font-semibold text-primary">{valeur}</dd>
                </div>
              ))}
            </dl>
          )}
        </header>

        <div className="flex flex-col gap-[18px] px-5 py-[18px]">
          {collecte ? (
            <>
              <section aria-label="Avancement de la collecte">
                <TitreSection>Avancement de la collecte</TitreSection>
                <ol className="grid grid-cols-3" aria-label="Circuit de la collecte">
                  {ETAPES.map((nom, i) => (
                    <li key={nom} aria-current={i === etape ? "step" : undefined} className={cn("relative text-center text-[11.5px] font-semibold", i === etape ? "font-bold text-primary" : i < etape ? "text-primary" : "text-muted-foreground")}>
                      {i > 0 && <span aria-hidden="true" className={cn("absolute left-[-50%] top-2.5 h-0.5 w-full", i <= etape ? "bg-primary" : "bg-border")} />}
                      <span aria-hidden="true" className={cn("relative z-[1] mx-auto mb-1.5 block size-[22px] rounded-full border-2 bg-card", i < etape && "border-primary bg-primary", i === etape && "border-accent shadow-[0_0_0_4px_hsl(var(--accent)/0.25)]", i > etape && "border-border")} />
                      {nom}
                    </li>
                  ))}
                </ol>
                {demandes > 0 ? (
                  <div className="mt-3 flex items-center gap-2.5 text-xs text-muted-foreground">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${recus} tableaux transmis sur ${demandes}`}><i className="block h-full bg-accent" style={{ width: `${(recus / demandes) * 100}%` }} /></div>
                    <span><b className="text-primary">{recus}</b> sur {demandes} tableaux transmis</span>
                  </div>
                ) : (
                  <p className="mt-3 flex items-start gap-2 rounded-[10px] border border-[#efe6d0] bg-[#FBF8F1] px-2.5 py-2 text-[11.5px] text-muted-foreground">
                    <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />Aucun tableau n'a encore été envoyé au client.
                  </p>
                )}
              </section>

              {tableaux.length > 0 && (
                <section aria-label="Tableaux de la collecte">
                  <TitreSection nombre={tableaux.length}>Tableaux de la collecte</TitreSection>
                  <ul>
                    {visibles.map((t) => <li key={t} className="border-b border-dotted border-border py-[7px] text-[12.5px] text-primary">{t}</li>)}
                  </ul>
                  {tableaux.length > TABLEAUX_VISIBLES && (
                    <button type="button" onClick={() => setTousLesTableaux((v) => !v)} className="mt-1 w-full py-2 text-center text-xs font-bold text-muted-foreground hover:text-primary">
                      {tousLesTableaux ? "Réduire la liste" : `Afficher les ${tableaux.length} tableaux →`}
                    </button>
                  )}
                </section>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Aucune collecte en cours pour cette société.</p>
          )}

          <section aria-label="Tâches de la société">
            <TitreSection nombre={taches.length}>Tâches de la société</TitreSection>
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
          </section>

          {collecte && (
            <section aria-label="Relances">
              <TitreSection>Relances</TitreSection>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <dt>Dernière relance</dt><dd className="text-right font-semibold text-primary">{collecte.derniereRelanceLe ? formatDate(collecte.derniereRelanceLe) : "Aucune"}</dd>
                <dt>Cadence</dt><dd className="text-right font-semibold text-primary">tous les {jours(collecte.relanceCadenceJours)}</dd>
              </dl>
            </section>
          )}
        </div>
      </div>

      {collecte && route && (
        <footer className="flex shrink-0 flex-col gap-2 border-t border-border bg-card px-5 pb-[18px] pt-3.5">
          <Link to={route} className="inline-flex h-[42px] items-center justify-center rounded-[10px] bg-accent text-[13px] font-bold text-primary transition-[filter] hover:brightness-105">
            {collecte.statut === "transmis" ? "Examiner la collecte" : "Ouvrir la collecte"}
          </Link>
          {canManageCollaborateurs && attendClient && (
            <button
              type="button"
              disabled={relance}
              onClick={() => {
                setRelance(true);
                void relanceNow(collecte.id).then(() => toast.success("Relance envoyée au client")).catch(() => {}).finally(() => setRelance(false));
              }}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border border-border text-[12.5px] font-semibold text-primary transition-colors hover:bg-muted disabled:opacity-60"
            >
              <BellRing className="size-4" aria-hidden="true" /> {relance ? "Envoi…" : "Relancer le client"}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
