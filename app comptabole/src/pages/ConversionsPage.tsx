import { useState } from "react";
import { FileOutput, FileSpreadsheet, Lock, type LucideIcon } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { cn } from "@/lib/utils";
import { ExcelVersPdf } from "./conversions/ExcelVersPdf";
import { PdfVersExcel } from "./conversions/PdfVersExcel";
import { STATS_VIDES, type StatsConversion } from "./conversions/types";
import "./conversions/conversions.css";

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
        metrics={[]}
        actions={
          <span className="inline-flex items-center gap-2 rounded-md border border-accent/60 px-3 py-2 text-xs font-semibold text-primary-foreground" title="Aucun fichier n'est envoyé au serveur">
            <Lock className="size-4 text-accent" aria-hidden="true" />
            Traitement 100 % local · rien n'est envoyé au serveur
          </span>
        }
      />

      <div className="conv-barre">
      <div role="group" aria-label="Sens de la conversion" className="flex min-w-0 gap-1 overflow-x-auto px-2.5 [scrollbar-width:none]">
        {[...SENS].reverse().map((s) => {
          const actif = sens === s.value;
          return (
            <button
              key={s.value}
              type="button"
              aria-label={s.titre}
              aria-pressed={actif}
              title={s.detail}
              onClick={() => changerSens(s.value)}
              className={cn(
                "h-[54px] shrink-0 whitespace-nowrap border-b-[3px] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                actif ? "border-[#C9A96A] text-primary" : "border-transparent text-muted-foreground hover:text-primary",
              )}
            >
              {s.titre}
            </button>
          );
        })}
      </div>
      <dl className="conv-stats" aria-label="Avancement des conversions">
        <div><dt>Fichiers</dt><dd>{stats.fichiers}</dd></div>
        <div className="is-ok"><dt>Convertis</dt><dd>{stats.convertis}</dd></div>
        <div className={stats.erreurs > 0 ? "is-erreur" : "is-zero"}><dt>En erreur</dt><dd>{stats.erreurs}</dd></div>
        <div><dt>{stats.libelleElements}</dt><dd>{stats.elements}</dd></div>
      </dl>
      </div>

      {sens === "pdf-excel" ? <PdfVersExcel onStats={setStats} /> : <ExcelVersPdf onStats={setStats} />}
    </div>
  );
}
