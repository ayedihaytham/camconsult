import { ArrowRight, CheckCircle2, Clock3, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resumeSections, sectionOuverte, sectionStatut } from "@/lib/collecte/sections";
import { sectionRecapStatut } from "@/lib/collecte/recap";
import { TAB_BY_KEY, ordonnerTableaux } from "@/lib/collecte/tabs";
import type { CollecteFull } from "@/types";

interface Props {
  collecte: CollecteFull;
  isClient: boolean;
  isCabinet: boolean;
  recapPending: boolean;
  onNavigate: (tab: string) => void;
}

/** Role-aware action cue derived from the existing section and recap states. */
export function CollecteNextStep({ collecte, isClient, isCabinet, recapPending, onNavigate }: Props) {
  const counts = resumeSections(collecte);
  const keys = ordonnerTableaux(collecte.onglets);
  const awaitingReview = keys.find((key) => sectionStatut(collecte, key) === "transmis");
  const returned = keys.find((key) => sectionStatut(collecte, key) === "a_corriger");
  const open = keys.find((key) => sectionOuverte(sectionStatut(collecte, key)));
  const label = (key: string | undefined) => key ? TAB_BY_KEY[key]?.label ?? key : "";

  let title = "Dossier à jour";
  let description = "Tous les tableaux de cette collecte ont été traités.";
  let action: { label: string; tab: string } | undefined;
  let icon = <CheckCircle2 className="size-4 text-success" aria-hidden="true" />;

  if (isClient) {
    if (recapPending) {
      title = "Une réponse est attendue";
      description = "Le cabinet vous a demandé des précisions. Les cases ciblées sont regroupées dans le récap.";
      action = { label: "Compléter le récap", tab: "recap" };
      icon = <FileCheck2 className="size-4 text-warning" aria-hidden="true" />;
    } else if (returned || open) {
      const key = returned ?? open;
      title = returned ? "Un tableau est à corriger" : "Votre saisie peut continuer";
      description = returned
        ? `Reprenez « ${label(key)} », puis transmettez-le à nouveau au cabinet.`
        : `Complétez « ${label(key)} » puis transmettez-le quand vous êtes prêt.`;
      action = { label: returned ? "Reprendre ce tableau" : "Continuer la saisie", tab: key! };
      icon = <ArrowRight className="size-4 text-primary" aria-hidden="true" />;
    } else if (counts.transmis > 0) {
      title = "Le cabinet examine vos tableaux";
      description = "Les tableaux transmis sont verrouillés pendant leur examen. Vous serez informé si une correction est demandée.";
      icon = <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />;
    } else if (collecte.statut === "archive") {
      title = "Collecte archivée";
      description = "Cette collecte est conservée en lecture seule.";
    } else if (collecte.statut === "valide") {
      title = "Collecte validée";
      description = "Le cabinet a terminé le traitement de cette collecte.";
    }
  } else if (isCabinet) {
    if (awaitingReview) {
      title = "Un tableau attend votre examen";
      description = `Consultez « ${label(awaitingReview)} », puis validez-le ou renvoyez-le avec un motif.`;
      action = { label: "Examiner ce tableau", tab: awaitingReview };
      icon = <Clock3 className="size-4 text-warning" aria-hidden="true" />;
    } else if (returned) {
      title = "En attente du client";
      description = `« ${label(returned)} » a été renvoyé pour correction.`;
      action = { label: "Voir le tableau", tab: returned };
      icon = <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />;
    } else if (open) {
      title = "Préparer la collecte";
      description = `« ${label(open)} » n’a pas encore été transmis par le client.`;
      action = { label: "Ouvrir ce tableau", tab: open };
      icon = <ArrowRight className="size-4 text-primary" aria-hidden="true" />;
    } else if (collecte.statut === "archive") {
      title = "Collecte archivée";
      description = "Cette collecte est conservée en lecture seule.";
    } else if (collecte.statut === "valide") {
      title = "Collecte validée";
      description = "Tous les tableaux sont validés ou archivés.";
    }
  }

  const summary = isClient
    ? [
        { label: "À compléter", value: counts.brouillon + counts.a_corriger },
        { label: "Transmis", value: counts.transmis },
        { label: "Validés", value: counts.valide },
      ]
    : [
        { label: "À examiner", value: counts.transmis },
        { label: "Chez le client", value: counts.brouillon + counts.a_corriger },
        { label: "Validés", value: counts.valide },
      ];

  return (
    <section aria-label="Prochaine étape" className="mt-3 rounded-xl border border-border bg-card px-4 py-3.5 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-muted" aria-hidden="true">{icon}</span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 max-w-3xl text-sm leading-snug text-muted-foreground">{description}</p>
          </div>
        </div>
        {action && (
          <Button type="button" variant="ledger" className="min-h-10 shrink-0 gap-2 sm:self-center" onClick={() => onNavigate(action!.tab)}>
            {action.label}<ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border/70 pt-2.5 text-xs text-muted-foreground" aria-label="Avancement des tableaux">
        {summary.map((item) => (
          <span key={item.label}><strong className="tabular-nums font-semibold text-foreground">{item.value}</strong> {item.label.toLocaleLowerCase("fr")}</span>
        ))}
        {recapPending && !isClient && <span className="font-medium text-warning">Récap en attente du client</span>}
        {collecte.fichiers.length > 0 && <span>{collecte.fichiers.length} document{collecte.fichiers.length > 1 ? "s" : ""} joint{collecte.fichiers.length > 1 ? "s" : ""}</span>}
        {!isClient && !isCabinet && <span>{keys.filter((key) => sectionRecapStatut(collecte, key) !== "none").length} demande(s) de précision</span>}
      </div>
    </section>
  );
}
