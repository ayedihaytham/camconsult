import { useState } from "react";
import { FileOutput, FileSpreadsheet, Lock, type LucideIcon } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { cn } from "@/lib/utils";
import { ExcelVersPdf } from "./conversions/ExcelVersPdf";
import { PdfVersExcel } from "./conversions/PdfVersExcel";
import { STATS_VIDES, type StatsConversion } from "./conversions/types";

type Sens = "excel-pdf" | "pdf-excel";

const SENS: { value: Sens; titre: string; detail: string; icone: LucideIcon }[] = [
  { value: "excel-pdf", titre: "Excel vers PDF", detail: "Classeurs .xlsx / .xls en PDF mis en page, ou en texte (.txt)", icone: FileOutput },
  { value: "pdf-excel", titre: "PDF vers Excel", detail: "PDF contenant du texte en Excel (.xlsx) ou en texte (.txt)", icone: FileSpreadsheet },
];

export function ConversionsPage() {
  const [sens, setSens] = useState<Sens>("excel-pdf");
  // Chaque sens garde ses propres fichiers (ils sont remis à zéro quand on change de sens) ; le bandeau affiche ceux du sens courant.
  const [stats, setStats] = useState<StatsConversion>(STATS_VIDES);

  function changerSens(s: Sens) {
    setStats(STATS_VIDES);
    setSens(s);
  }

  return (
    <div>
      <SignatureLedgerBanner
        icon={FileOutput}
        eyebrow="Outils · Fichiers"
        title="Conversions"
        description="Convertit des fichiers Excel en PDF, ou des PDF en Excel, directement dans votre navigateur."
        metrics={[
          { label: "Fichiers", value: stats.fichiers },
          { label: "Convertis", value: stats.convertis, tone: "success" },
          { label: "En erreur", value: stats.erreurs, tone: stats.erreurs > 0 ? "destructive" : "default" },
          { label: stats.libelleElements, value: stats.elements },
        ]}
        actions={
          <span className="inline-flex items-center gap-2 rounded-md border border-accent/60 px-3 py-2 text-xs font-semibold text-primary-foreground" title="Aucun fichier n'est envoyé au serveur">
            <Lock className="size-4 text-accent" aria-hidden="true" />
            Traitement 100 % local · rien n'est envoyé au serveur
          </span>
        }
      />

      <div role="group" aria-label="Sens de la conversion" className="mt-4 grid gap-3 sm:grid-cols-2">
        {SENS.map((s) => {
          const actif = sens === s.value;
          return (
            <button
              key={s.value}
              type="button"
              aria-label={s.titre}
              aria-pressed={actif}
              onClick={() => changerSens(s.value)}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-accent/30 bg-card px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                actif && "border-primary bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", actif ? "bg-primary-foreground/10 text-accent" : "bg-accent/15 text-primary")}>
                <s.icone className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{s.titre}</span>
                <span className={cn("block text-xs", actif ? "text-primary-foreground/80" : "text-muted-foreground")}>{s.detail}</span>
              </span>
            </button>
          );
        })}
      </div>

      {sens === "pdf-excel" ? <PdfVersExcel onStats={setStats} /> : <ExcelVersPdf onStats={setStats} />}
    </div>
  );
}
