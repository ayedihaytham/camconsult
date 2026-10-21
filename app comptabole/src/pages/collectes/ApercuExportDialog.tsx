import { useEffect, useMemo, useState } from "react";
import { Download, FileWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { create } from "zustand";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PdfPages } from "@/components/common/PdfPages";
import { apercuCollecteSectionPdf, downloadCollecteSectionPdf, exportCollecteSectionXlsx, sectionReport } from "@/lib/collecte/exportXlsx";
import { cn } from "@/lib/utils";
import type { CollecteFull } from "@/types";

export interface DemandeApercuExport {
  format: "pdf" | "excel";
  collecte: CollecteFull;
  section: string;
  societeNom: string;
}

/** Demande d'aperçu avant téléchargement. Dans un petit magasin : les boutons Excel / PDF vivent dans des menus qui se démontent à la fermeture,
 * la fenêtre est donc montée une seule fois dans la page et lit cette demande. */
export const useApercuExport = create<{ demande: DemandeApercuExport | null; ouvrir: (demande: DemandeApercuExport) => void; fermer: () => void }>((set) => ({
  demande: null,
  ouvrir: (demande) => set({ demande }),
  fermer: () => set({ demande: null }),
}));

/** Aperçu d'un export Excel ou PDF d'une section avant de le télécharger : le PDF s'affiche page par page (le fichier exact), l'Excel montre
 * le tableau exporté (titre, en-têtes, lignes, total). « Télécharger » produit ensuite le fichier ; fermer n'enregistre rien. */
export function ApercuExportDialog() {
  const demande = useApercuExport((s) => s.demande);
  const fermer = useApercuExport((s) => s.fermer);
  const [pdf, setPdf] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);
  const rapport = useMemo(() => (demande ? sectionReport(demande.collecte, demande.section, demande.societeNom) : null), [demande]);

  useEffect(() => {
    setPdf(null);
    setErreur(false);
    if (!demande || demande.format !== "pdf") return;
    let annule = false;
    apercuCollecteSectionPdf(demande.collecte, demande.section, demande.societeNom)
      .then((url) => {
        if (annule) return;
        if (url) setPdf(url);
        else setErreur(true);
      })
      .catch(() => !annule && setErreur(true));
    return () => {
      annule = true;
    };
  }, [demande]);

  async function telecharger() {
    if (!demande) return;
    const d = demande;
    fermer();
    if (d.format === "pdf") await downloadCollecteSectionPdf(d.collecte, d.section, d.societeNom).catch(() => toast.error("PDF impossible"));
    else await exportCollecteSectionXlsx(d.collecte, d.section, d.societeNom).catch(() => toast.error("Export impossible"));
  }

  const nom = demande?.format === "pdf" ? "PDF" : "Excel";
  return (
    <Dialog open={demande !== null} onOpenChange={(open) => !open && fermer()}>
      {/* Plein écran, comme l'aperçu des documents : le document occupe la fenêtre, « Télécharger » reste en bas. */}
      <DialogContent className="flex h-[96dvh] w-[96vw] max-w-none flex-col gap-3 rounded-xl p-4 sm:p-5" aria-describedby="apercu-export-description">
        <DialogHeader className="shrink-0">
          <DialogTitle className="truncate pr-8">Aperçu {nom} · {rapport?.title ?? "Export"}</DialogTitle>
          <DialogDescription id="apercu-export-description">
            {demande?.format === "pdf"
              ? "Voici le document tel qu'il sera téléchargé. Rien n'est enregistré tant que vous ne cliquez pas sur Télécharger."
              : "Voici les données du tableau exporté. Le fichier Excel les reprend avec la mise en forme du cabinet."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted/30">
          {!rapport ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
              <FileWarning className="h-7 w-7" aria-hidden="true" />
              Cette section ne peut pas être exportée.
            </div>
          ) : demande?.format === "pdf" ? (
            erreur ? (
              <div role="alert" className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
                <FileWarning className="h-7 w-7" aria-hidden="true" />
                L'aperçu n'a pas pu être préparé. Vous pouvez tout de même télécharger le PDF.
              </div>
            ) : !pdf ? (
              <div role="status" className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
                Préparation de l'aperçu…
              </div>
            ) : (
              <PdfPages dataUrl={pdf} titre={rapport.title} />
            )
          ) : (
            <div className="p-4">
              <div className="mx-auto max-w-full rounded-md border border-border bg-card p-4">
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "#1F4E79" }}>{rapport.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{rapport.subtitle}</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-xs tabular-nums" aria-label={`Aperçu de l'export Excel : ${rapport.title}`}>
                    <thead>
                      <tr>
                        {rapport.header.map((titre, i) => (
                          <th key={i} scope="col" className={cn("border border-border px-2 py-1.5 font-semibold text-white", rapport.align[i] === "right" ? "text-right" : "text-left")} style={{ backgroundColor: "#1F4E79" }}>{titre}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rapport.rows.length === 0 ? (
                        <tr><td colSpan={rapport.header.length} className="border border-border px-2 py-4 text-center text-muted-foreground">Aucune ligne saisie.</td></tr>
                      ) : rapport.rows.map((ligne, r) => {
                        const total = rapport.totalRow && r === rapport.rows.length - 1;
                        return (
                          <tr key={r} className={cn(total ? "bg-[#E8EEF5] font-bold" : r % 2 === 1 && "bg-[#F7F8FA]")}>
                            {ligne.map((cellule, i) => (
                              <td key={i} className={cn("border border-border px-2 py-1.5", rapport.align[i] === "right" ? "text-right" : "text-left")}>{cellule}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={fermer}>Fermer</Button>
          <Button variant="ledger" disabled={!rapport} onClick={() => void telecharger()}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Télécharger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
