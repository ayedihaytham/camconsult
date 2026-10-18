import { cn } from "@/lib/utils";
import type { FactureEinvoice } from "@/types";

/** Les quatre étapes d'une facture électronique, dans l'ordre. */
export const ETAPES_EINVOICE = ["Préparée", "Signée", "Déposée", "Validée"] as const;

type Statut = FactureEinvoice["statut"] | "aucune";

/** Étape atteinte (0 = préparée … 3 = validée) ; -1 = rien de fait. Une facture rejetée s'arrête à l'étape « déposée ». */
const RANG: Record<Statut, number> = { aucune: -1, prete: 0, signee: 1, deposee: 2, validee: 3, rejetee: 2 };

/** Libellé court et ton de la situation, y compris la prochaine action attendue. */
export function libelleProgression(statut: Statut): { texte: string; ton: "neutre" | "action" | "ok" | "ko" } {
  switch (statut) {
    case "aucune":
      return { texte: "Non préparée", ton: "neutre" };
    case "prete":
      return { texte: "Préparée — à signer", ton: "action" };
    case "signee":
      return { texte: "Signée — à déposer", ton: "action" };
    case "deposee":
      return { texte: "Déposée — en attente", ton: "neutre" };
    case "validee":
      return { texte: "Validée par TTN", ton: "ok" };
    case "rejetee":
      return { texte: "Rejetée par TTN", ton: "ko" };
  }
}

/** Quatre points reliés (préparée → signée → déposée → validée) et le libellé de la situation, en une lecture. */
export function EinvoiceProgression({ statut }: { statut: FactureEinvoice["statut"] | null | undefined }) {
  const s: Statut = statut ?? "aucune";
  const rang = RANG[s];
  const { texte, ton } = libelleProgression(s);
  return (
    <div className="grid gap-1" role="img" aria-label={`Facture électronique : ${texte}`} title={ETAPES_EINVOICE.join(" → ")}>
      <div className="flex items-center" aria-hidden="true">
        {ETAPES_EINVOICE.map((etape, i) => {
          const fait = i < rang || (i === rang && s === "validee") || (s === "rejetee" && i < 2);
          const courant = i === rang && !fait && s !== "rejetee";
          const rejet = s === "rejetee" && i === 2;
          const lienFait = i < rang || s === "validee";
          return (
            <span key={etape} className="flex items-center">
              <span
                className={cn(
                  "size-3 shrink-0 rounded-full border-2 border-input bg-card",
                  fait && "border-success bg-success",
                  courant && "border-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.3)]",
                  rejet && "border-destructive bg-destructive",
                )}
              />
              {i < ETAPES_EINVOICE.length - 1 && <span className={cn("h-0.5 w-4 shrink-0 bg-input", lienFait && "bg-success")} />}
            </span>
          );
        })}
      </div>
      <span
        className={cn(
          "whitespace-nowrap text-xs font-semibold",
          ton === "neutre" && "text-muted-foreground",
          ton === "action" && "text-warning",
          ton === "ok" && "text-success",
          ton === "ko" && "text-destructive",
        )}
      >
        {texte}
      </span>
    </div>
  );
}
