import { useEffect, useState } from "react";
import { Download, Eye, FileCode2, LoaderCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PARAMETRES_APERCU, chargerLogo, construireFacturePdf } from "@/lib/facturePdf";
import { formatTnd } from "@/lib/facturation";
import { cn, formatDate } from "@/lib/utils";
import { useFacturation } from "@/store/facturation";
import type { Facture, FactureCabinet, FactureEinvoice, FactureJournalEntry } from "@/types";
import { ETAPES_EINVOICE } from "./EinvoiceProgression";

const heureTunis = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" }).format(new Date(iso));

export interface EtapeChronologie {
  libelle: string;
  detail: string;
  etat: "fait" | "suivante" | "avenir" | "rejet";
}

/** Chronologie des quatre étapes de la facture électronique, avec leurs dates quand elles sont connues. */
export function chronologieEinvoice(ei: FactureEinvoice | null | undefined): EtapeChronologie[] {
  const statut = ei?.statut ?? null;
  const dates: (string | null | undefined)[] = [ei?.genereLe, ei?.signeLe, ei?.deposeLe, ei?.refTtnDate];
  const atteint = statut === null ? -1 : { prete: 0, signee: 1, deposee: 2, validee: 3, rejetee: 2 }[statut];
  return ETAPES_EINVOICE.map((nom, i) => {
    if (statut === "rejetee" && i === 3) return { libelle: "Rejetée par TTN", detail: ei?.acquittements?.length ? `${ei.acquittements.length} motif(s) renvoyé(s)` : "Aucun motif détaillé", etat: "rejet" as const };
    if (i <= atteint) {
      const extra = i === 3 && ei?.refTtn ? ` — réf. ${ei.refTtn}` : "";
      return { libelle: `${nom}${i === 2 ? " chez TTN" : i === 3 ? " par TTN" : ""}${extra}`, detail: dates[i] ? heureTunis(dates[i] as string) : "Date non enregistrée", etat: "fait" as const };
    }
    return { libelle: nom, detail: i === atteint + 1 && statut !== "rejetee" ? "Prochaine étape" : "À venir", etat: i === atteint + 1 && statut !== "rejetee" ? ("suivante" as const) : ("avenir" as const) };
  });
}

function Chronologie({ items }: { items: { cle: string; titre: string; detail: string; etat: "fait" | "suivante" | "avenir" | "rejet" }[] }) {
  return (
    <ol className="space-y-0">
      {items.map((it, i) => (
        <li key={it.cle} className="relative pb-3.5 pl-7 last:pb-0">
          <span
            className={cn(
              "absolute left-0.5 top-1 size-3 rounded-full border-2 border-input bg-card",
              it.etat === "fait" && "border-success bg-success",
              it.etat === "suivante" && "border-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.3)]",
              it.etat === "rejet" && "border-destructive bg-destructive",
            )}
            aria-hidden="true"
          />
          {i < items.length - 1 && <span className={cn("absolute left-[0.4375rem] top-4 h-[calc(100%-0.5rem)] w-0.5 bg-input", it.etat === "fait" && "bg-success")} aria-hidden="true" />}
          <p className="text-[13px] font-medium text-foreground">{it.titre}</p>
          <p className="text-xs text-muted-foreground">{it.detail}</p>
        </li>
      ))}
    </ol>
  );
}

interface Props {
  facture: Facture | null;
  cabinet: FactureCabinet | null;
  onOpenChange: (open: boolean) => void;
  /** Ouvre la fenêtre « Facture électronique » (préparer, signer, déposer…). */
  onOpenEinvoice: (f: Facture) => void;
  onTelechargerPdf: (f: Facture) => void;
  onImprimer: (f: Facture) => void;
}

/** Détail d'une facture : avancement de la facture électronique, lignes et totaux, aperçu du PDF, historique du journal. */
export function FactureDetailSheet({ facture, cabinet, onOpenChange, onOpenEinvoice, onTelechargerPdf, onImprimer }: Props) {
  const journal = useFacturation((s) => s.journal);
  const courante = useFacturation((s) => s.list.find((f) => f.id === facture?.id)) ?? facture;
  const [historique, setHistorique] = useState<FactureJournalEntry[] | null>(null);
  const [erreurHistorique, setErreurHistorique] = useState(false);
  const [apercu, setApercu] = useState<string | null>(null);
  const [apercuEnCours, setApercuEnCours] = useState(false);
  const id = facture?.id ?? null;

  // Historique : rechargé à chaque ouverture ; l'aperçu est libéré à la fermeture ou au changement de facture.
  useEffect(() => {
    setHistorique(null);
    setErreurHistorique(false);
    if (!id) return;
    let annule = false;
    journal(id)
      .then((h) => !annule && setHistorique(h))
      .catch(() => !annule && setErreurHistorique(true));
    return () => {
      annule = true;
    };
  }, [id, journal, courante?.einvoice?.statut]);

  useEffect(
    () => () => {
      if (apercu) URL.revokeObjectURL(apercu);
    },
    [apercu],
  );
  useEffect(() => {
    setApercu(null);
  }, [id]);

  async function afficherApercu() {
    if (!courante) return;
    setApercuEnCours(true);
    try {
      const doc = await construireFacturePdf(courante, cabinet, { logo: await chargerLogo(window.location.origin) });
      setApercu(URL.createObjectURL(doc.output("blob")));
    } catch {
      setApercu(null);
    } finally {
      setApercuEnCours(false);
    }
  }

  const f = courante;
  const chrono = chronologieEinvoice(f?.einvoice).map((e) => ({ cle: e.libelle, titre: e.libelle, detail: e.detail, etat: e.etat }));
  const rejetee = f?.einvoice?.statut === "rejetee";

  return (
    <Sheet open={facture !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-medium text-primary">Facture {f?.numero}</SheetTitle>
          <SheetDescription>
            {f?.societeNom}
            {f?.clientTva ? ` · MF ${f.clientTva}` : ""}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6">
          {f && (
            <>
              <section aria-label="Avancement de la facture électronique">
                <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Avancement</h3>
                {f.einvoice ? <Chronologie items={chrono} /> : <p className="text-sm text-muted-foreground">La facture électronique n'est pas encore préparée.</p>}
                {rejetee && (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
                    <p className="font-semibold">TTN a rejeté cette facture.</p>
                    {(f.einvoice?.acquittements ?? []).length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {(f.einvoice?.acquittements ?? []).map((a, i) => (
                          <li key={i}>{Object.values(a).join(" — ")}</li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1.5 text-xs text-foreground">Ouvrez la facture électronique pour la rouvrir, la corriger puis la redéposer.</p>
                  </div>
                )}
              </section>

              <section aria-label="Lignes de la facture">
                <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Lignes</h3>
                <table className="w-full text-[13px]">
                  <tbody>
                    {f.lignes.map((l, i) => (
                      <tr key={l.id ?? i} className="border-b border-accent/20">
                        <td className="py-1.5 pr-3">{l.description}</td>
                        <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-muted-foreground">{l.quantite.toLocaleString("fr-FR")} ×</td>
                        <td className="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums">{formatTnd(l.montantHt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <dl className="mt-2 space-y-1 text-[13px] text-muted-foreground">
                  <div className="flex justify-between"><dt>Total HT</dt><dd className="tabular-nums">{formatTnd(f.totalHt)} TND</dd></div>
                  <div className="flex justify-between"><dt>TVA ({f.tvaTaux} %)</dt><dd className="tabular-nums">{formatTnd(f.tva)} TND</dd></div>
                  <div className="flex justify-between"><dt>Droit de timbre</dt><dd className="tabular-nums">{formatTnd(f.timbre)} TND</dd></div>
                </dl>
                <div className="mt-2 flex items-center justify-between rounded-md bg-primary px-3 py-2.5 text-primary-foreground">
                  <span className="text-sm font-bold">Net à payer</span>
                  <span className="font-serif text-base font-bold tabular-nums">{formatTnd(f.netAPayer)} TND</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Émise le {formatDate(f.dateEmission)}
                  {f.echeance ? ` · échéance le ${formatDate(f.echeance)}` : ""}
                </p>
              </section>

              <section aria-label="Aperçu du PDF">
                <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Aperçu du PDF</h3>
                {apercu ? (
                  <iframe src={`${apercu}${PARAMETRES_APERCU}`} title={`Aperçu de la facture ${f.numero}`} className="aspect-[1/1.4142] max-h-[70vh] w-full rounded-lg border border-accent/30 bg-card" />
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => void afficherApercu()} disabled={apercuEnCours}>
                    {apercuEnCours ? <LoaderCircle className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <Eye className="mr-1.5 size-4" aria-hidden="true" />}
                    {apercuEnCours ? "Préparation de l'aperçu…" : "Afficher l'aperçu"}
                  </Button>
                )}
              </section>

              <section aria-label="Historique">
                <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Historique</h3>
                {erreurHistorique ? (
                  <p className="text-sm text-destructive">L'historique n'a pas pu être chargé.</p>
                ) : historique === null ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Chargement…
                  </p>
                ) : historique.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune action enregistrée pour cette facture.</p>
                ) : (
                  <Chronologie items={historique.map((h) => ({ cle: h.id, titre: h.label, detail: `${heureTunis(h.at)} · ${h.actor}`, etat: "fait" as const }))} />
                )}
              </section>
            </>
          )}
        </SheetBody>

        <SheetFooter>
          {f && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onImprimer(f)}>
                <Printer className="mr-1.5 size-4" aria-hidden="true" /> Imprimer
              </Button>
              <Button type="button" variant="outline" onClick={() => onTelechargerPdf(f)}>
                <Download className="mr-1.5 size-4" aria-hidden="true" /> PDF
              </Button>
              {f.statut !== "annulee" && (
                <Button type="button" variant="ledger" onClick={() => onOpenEinvoice(f)}>
                  <FileCode2 className="mr-1.5 size-4" aria-hidden="true" /> Facture électronique
                </Button>
              )}
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
