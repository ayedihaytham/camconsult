import { useState } from "react";
import { FileOutput, Lock } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { ExcelVersPdf } from "./conversions/ExcelVersPdf";
import { PdfVersExcel } from "./conversions/PdfVersExcel";
import { STATS_VIDES, type StatsConversion } from "./conversions/types";

type Sens = "excel-pdf" | "pdf-excel";

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

      <div className="mt-4">
        <LedgerSegmented<Sens>
          value={sens}
          onChange={changerSens}
          ariaLabel="Sens de la conversion"
          options={[
            { value: "excel-pdf", label: "Excel vers PDF" },
            { value: "pdf-excel", label: "PDF vers Excel" },
          ]}
        />
      </div>

      {sens === "pdf-excel" ? <PdfVersExcel onStats={setStats} /> : <ExcelVersPdf onStats={setStats} />}
    </div>
  );
}
