import { AlertTriangle, ArrowRight, Check, FileText, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COLLECTE_STATUT_LABELS, TAB_BY_KEY } from "@/lib/collecte/tabs";
import { sectionStatut } from "@/lib/collecte/sections";
import type { ChecklistRow } from "@/lib/collecte/checklist";
import type { CollecteFull } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  collecte: CollecteFull;
  rows: ChecklistRow[];
  canTransmit: boolean;
  canSubmitRecap: boolean;
  recapPending: boolean;
  recapRemaining: number;
  onTransmit: () => void;
  onSubmitRecap: () => void;
  onOpenTable: (key: string) => void;
}

export function CollecteClientVerification({
  collecte,
  rows,
  canTransmit,
  canSubmitRecap,
  recapPending,
  recapRemaining,
  onTransmit,
  onSubmitRecap,
  onOpenTable,
}: Props) {
  const received = rows.filter((row) => row.recu).length;
  const pending = rows.length - received;
  const tablesWithContent = collecte.onglets.filter((key) => collecte.lignes.some((line) => line.onglet === key)).length;
  const waitingOnClient = collecte.onglets.filter((key) => {
    const status = sectionStatut(collecte, key);
    return status === "brouillon" || status === "a_corriger";
  });
  const showRecapOnly = recapPending && !canTransmit && canSubmitRecap;
  const blocked = recapPending && recapRemaining > 0;

  return (
    <section aria-labelledby="client-review-title" className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-7">
      <div className="max-w-2xl">
        <h2 id="client-review-title" className="text-xl font-semibold tracking-tight text-primary sm:text-2xl">
          Vérifiez votre collecte
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Vérifiez les pièces et les tableaux avant de transmettre votre collecte au cabinet.
        </p>
      </div>

      <div className="mt-5 flex flex-col items-start gap-3 rounded-lg bg-primary px-4 py-4 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="max-w-xl">
          <p className="font-semibold">{showRecapOnly ? "Envoyer les précisions au cabinet" : "Prêt à transmettre ?"}</p>
          <p className="mt-1 text-sm text-primary-foreground/80">
            {showRecapOnly
              ? "Cette action répond aux questions ciblées du cabinet et ne modifie pas le statut général de la collecte."
              : canTransmit
                ? "Les tableaux seront transmis pour examen. Le cabinet pourra ensuite les valider ou demander une correction."
                : "Votre collecte a déjà été transmise. Le cabinet doit maintenant l’examiner."}
          </p>
        </div>
        {showRecapOnly ? (
          <Button type="button" variant="ledger" className="min-h-11 shrink-0 gap-2" disabled={blocked} onClick={onSubmitRecap}>
            <Send className="size-4" aria-hidden="true" /> Envoyer les précisions
          </Button>
        ) : canTransmit ? (
          <Button type="button" variant="ledger" className="min-h-11 shrink-0 gap-2" disabled={blocked} onClick={onTransmit}>
            <Send className="size-4" aria-hidden="true" /> Transmettre au cabinet
          </Button>
        ) : (
          <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-primary-foreground/25 px-3 text-sm font-medium">
            <Check className="size-4" aria-hidden="true" /> {collecte.statut === "valide" ? "Collecte validée" : collecte.statut === "archive" ? "Collecte archivée" : "En attente du cabinet"}
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Summary icon={FileText} label="Pièces reçues" value={`${received} / ${rows.length}`} detail={pending ? `${pending} encore en attente` : "Tout est renseigné"} />
        <Summary icon={Check} label="Tableaux renseignés" value={`${tablesWithContent} / ${collecte.onglets.length}`} detail={waitingOnClient.length ? `${waitingOnClient.length} à compléter ou reprendre` : "Aucune action restante"} />
        <Summary icon={Paperclip} label="Documents joints" value={String(collecte.fichiers.length)} detail="Documents enregistrés dans la collecte" />
      </div>

      {recapPending && (
        <div className={cn("mt-5 rounded-lg border px-4 py-3", blocked ? "border-warning/40 bg-warning/5" : "border-border bg-muted/20")}>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {blocked ? <AlertTriangle className="size-4 text-warning-foreground" aria-hidden="true" /> : <Check className="size-4 text-success" aria-hidden="true" />}
            Précisions demandées par le cabinet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {blocked
              ? `${recapRemaining} case(s) demandée(s) restent à compléter. Ouvrez chaque tableau concerné, puis revenez ici.`
              : "Toutes les précisions demandées sont renseignées. Elles seront envoyées au cabinet avec votre action ci-dessous."}
          </p>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/25 px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">État des tableaux</h3>
          <span className="text-xs text-muted-foreground">{COLLECTE_STATUT_LABELS[collecte.statut]}</span>
        </div>
        <ul className="divide-y divide-border">
          {collecte.onglets.map((key) => {
            const status = sectionStatut(collecte, key);
            const label = status === "brouillon" ? "À compléter" : status === "a_corriger" ? "À reprendre" : status === "transmis" ? "Transmis" : status === "valide" ? "Validé" : "Archivé";
            const clientCanOpen = !TAB_BY_KEY[key]?.cabinetSeul;
            return (
              <li key={key} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
                <span className={cn("size-2 shrink-0 rounded-full", status === "valide" ? "bg-success" : status === "a_corriger" ? "bg-warning" : status === "transmis" ? "bg-primary" : "bg-muted-foreground/50")} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{TAB_BY_KEY[key]?.label ?? key}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
                {clientCanOpen && (status === "brouillon" || status === "a_corriger" || (recapPending && recapRemaining > 0)) && (
                  <Button type="button" variant="ghost" size="sm" className="min-h-9 gap-1 px-2" onClick={() => onOpenTable(key)}>
                    Ouvrir <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
                {status === "valide" && <Check className="size-4 text-success" aria-label="Validé" />}
              </li>
            );
          })}
          {collecte.onglets.length === 0 && <li className="px-4 py-4 text-sm text-muted-foreground">Aucun tableau n’a été demandé.</li>}
        </ul>
      </div>

    </section>
  );
}

function Summary({ icon: Icon, label, value, detail }: { icon: typeof FileText; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border px-3.5 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4" aria-hidden="true" />{label}</div>
      <p className="mt-1.5 text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
