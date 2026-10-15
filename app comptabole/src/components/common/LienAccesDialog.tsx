import { useRef } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Info, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EmailEnvoi } from "@/types";

export interface LienAcces {
  nom: string;
  lien: string;
  emailEnvoi?: EmailEnvoi;
  but?: "activation" | "reset";
}

const ETAT_EMAIL: Record<EmailEnvoi, string> = {
  envoye: "Le lien a aussi été envoyé par email.",
  smtp: "L'envoi d'emails n'est pas configuré sur le serveur : transmettez le lien vous-même.",
  sans_email: "Ce compte n'a pas d'adresse email : transmettez le lien vous-même.",
  echec: "L'email n'a pas pu être envoyé : transmettez le lien vous-même.",
};

/** Lien d'accès à usage unique (activation ou nouveau mot de passe). Affiché une seule fois : il n'est jamais conservé. */
export function LienAccesDialog({ acces, onClose }: { acces: LienAcces | null; onClose: () => void }) {
  const champ = useRef<HTMLInputElement>(null);

  async function copier() {
    if (!acces) return;
    try {
      await navigator.clipboard.writeText(acces.lien);
      toast.success("Lien copié");
    } catch {
      champ.current?.select();
      toast.info("Sélectionnez le lien puis copiez-le (Ctrl+C).");
    }
  }

  return (
    <Dialog open={acces !== null} onOpenChange={(ouvert) => !ouvert && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[520px]">
        {acces && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-accent" aria-hidden="true" />
                {acces.but === "reset" ? "Nouveau mot de passe" : "Accès créé"} pour {acces.nom}
              </DialogTitle>
              <DialogDescription>
                La personne ouvre ce lien et choisit elle-même son mot de passe. Le lien ne fonctionne qu'une fois et expire ({acces.but === "reset" ? "24 heures" : "72 heures"}).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input ref={champ} readOnly value={acces.lien} aria-label="Lien d'accès" onFocus={(e) => e.target.select()} className="font-mono text-xs" />
                <Button type="button" className="gap-2" onClick={() => void copier()}>
                  <Copy className="size-4" aria-hidden="true" />
                  Copier
                </Button>
              </div>
              {acces.emailEnvoi && (
                <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
                  {acces.emailEnvoi === "envoye" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : <Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                  {ETAT_EMAIL[acces.emailEnvoi]}
                </p>
              )}
              <p className="flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-[13px] text-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-accent-foreground" aria-hidden="true" />
                Ce lien ne sera plus affiché une fois cette fenêtre fermée. Pour en obtenir un autre, utilisez de nouveau « Lien d'accès ».
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
