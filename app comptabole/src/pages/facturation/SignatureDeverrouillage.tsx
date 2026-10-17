import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CARD_FIELD_INPUT, CardField } from "@/components/common/CardField";
import { useFacturation } from "@/store/facturation";

/**
 * État de la signature et déverrouillage par le mot de passe du certificat. Le mot de passe est envoyé une fois au serveur, qui garde la
 * clé en mémoire 15 minutes ; il n'est jamais conservé ici (champ vidé dès l'envoi).
 */
export function SignatureDeverrouillage({ idPrefixe }: { idPrefixe: string }) {
  const signature = useFacturation((s) => s.signature);
  const deverrouiller = useFacturation((s) => s.deverrouiller);
  const verrouiller = useFacturation((s) => s.verrouiller);
  const [motDePasse, setMotDePasse] = useState("");
  const [occupe, setOccupe] = useState(false);

  if (!signature?.certificat) return null;

  async function ouvrir() {
    const saisi = motDePasse;
    setMotDePasse("");
    setOccupe(true);
    try {
      await deverrouiller(saisi);
    } catch {
      // Message déjà affiché par le magasin ; le champ reste vide pour une nouvelle saisie.
    } finally {
      setOccupe(false);
    }
  }

  if (signature.deverrouille) {
    const jusqua = signature.expireLe ? new Date(signature.expireLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
        <span className="flex items-center gap-2">
          <LockOpen className="size-4" aria-hidden="true" /> Signature déverrouillée{jusqua ? ` jusqu'à ${jusqua}` : ""}.
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={() => void verrouiller().catch(() => undefined)}>
          Verrouiller
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (motDePasse && !occupe) void ouvrir();
      }}
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-4" aria-hidden="true" /> La signature est verrouillée : saisissez le mot de passe du certificat (jamais enregistré).
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <CardField id={`${idPrefixe}-mdp`} label="Mot de passe du certificat" className="min-w-[14rem] flex-1">
          <input
            id={`${idPrefixe}-mdp`}
            type="password"
            autoComplete="off"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className={CARD_FIELD_INPUT}
          />
        </CardField>
        <Button type="submit" variant="outline" disabled={!motDePasse || occupe}>
          {occupe ? "Vérification…" : "Déverrouiller"}
        </Button>
      </div>
    </form>
  );
}
