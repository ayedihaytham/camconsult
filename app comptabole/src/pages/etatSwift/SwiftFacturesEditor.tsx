import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Coins, FileText, Hash, Paperclip, Plus, Repeat, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/common/AmountInput";
import { api } from "@/lib/api";
import { round3 } from "@/lib/amount";
import { MAX_INLINE_FILE_BYTES, downloadDataUrl, readFileAsDataUrl } from "@/lib/file";
import { cn } from "@/lib/utils";
import { montantSwift } from "./SwiftStatut";
import type { SwiftFacture, SwiftVirement } from "@/types";

interface Ligne extends SwiftFacture {
  cle: string;
  /** Montant en TND saisi à la main (la banque applique son propre taux) : on ne le recalcule plus. */
  tndManuel: boolean;
}

let compteur = 0;
const nouvelleCle = () => `l${++compteur}`;

const vide = (devise: string): Ligne => ({ cle: nouvelleCle(), numFacture: "", montantDevise: 0, devise, taux: 0, montantTnd: 0, tndManuel: false });

/** Factures d'achat qui composent un virement SWIFT : une par ligne, jusqu'à atteindre le montant demandé. */
export function SwiftFacturesEditor({
  virement,
  onSave,
  libelleBouton = "Envoyer au cabinet",
}: {
  virement: SwiftVirement;
  onSave: (factures: SwiftFacture[], reference: { equivalentDevise: number; devise: string }) => Promise<void>;
  libelleBouton?: string;
}) {
  const [lignes, setLignes] = useState<Ligne[]>(() =>
    virement.factures.map((f) => ({ ...f, cle: nouvelleCle(), tndManuel: f.montantTnd !== round3(f.montantDevise * f.taux) })),
  );
  // Équivalent du virement en devise, indiqué par la société : les factures sont comparées à ce montant, pas au dinar.
  const [equivalent, setEquivalent] = useState(virement.equivalentDevise ?? 0);
  const [deviseRef, setDeviseRef] = useState(virement.devise || virement.factures[0]?.devise || "EUR");
  const [busy, setBusy] = useState(false);
  const [modifie, setModifie] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);
  const [pieceCible, setPieceCible] = useState<string | null>(null);

  const justifieTnd = useMemo(() => round3(lignes.reduce((s, l) => s + (l.montantTnd || 0), 0)), [lignes]);
  // Seules les factures dans la devise du virement comptent dans la comparaison.
  const justifie = useMemo(
    () => round3(lignes.filter((l) => l.devise.trim().toUpperCase() === deviseRef.trim().toUpperCase()).reduce((s, l) => s + (l.montantDevise || 0), 0)),
    [lignes, deviseRef],
  );
  const autreDevise = lignes.some((l) => l.devise.trim().toUpperCase() !== deviseRef.trim().toUpperCase());
  const reference = equivalent > 0;
  const reste = reference ? round3(equivalent - justifie) : 0;
  const atteint = reference && Math.abs(reste) < 0.0005;
  const depasse = reference && reste < -0.0005;
  const pct = reference ? Math.min(100, Math.round((justifie / equivalent) * 100)) : 0;

  function maj(cle: string, patch: Partial<Ligne>) {
    setModifie(true);
    setLignes((ls) =>
      ls.map((l) => {
        if (l.cle !== cle) return l;
        const suivante = { ...l, ...patch };
        if (!suivante.tndManuel && ("montantDevise" in patch || "taux" in patch)) suivante.montantTnd = round3(suivante.montantDevise * suivante.taux);
        return suivante;
      }),
    );
  }

  async function choisirPiece(fichier: File | undefined) {
    if (!fichier || !pieceCible) return;
    if (fichier.size > MAX_INLINE_FILE_BYTES) {
      toast.warning("Fichier trop volumineux (2 Mo au plus).");
      return;
    }
    maj(pieceCible, { pieceNom: fichier.name, pieceDataUrl: await readFileAsDataUrl(fichier) });
    setPieceCible(null);
  }

  async function ouvrirPiece(l: Ligne) {
    if (l.pieceDataUrl) return downloadDataUrl(l.pieceDataUrl, l.pieceNom || "piece");
    if (!l.id) return;
    const { nom, dataUrl } = await api.get<{ nom: string; dataUrl: string }>(`/etat-swift/factures/${l.id}/piece`);
    downloadDataUrl(dataUrl, nom);
  }

  async function enregistrer() {
    if (lignes.some((l) => !l.numFacture.trim())) {
      toast.error("Indiquez le numéro de chaque facture.");
      return;
    }
    setBusy(true);
    try {
      await onSave(
        lignes.map(({ cle: _cle, tndManuel: _manuel, ...f }) => ({ ...f, numFacture: f.numFacture.trim() })),
        { equivalentDevise: equivalent, devise: deviseRef.trim().toUpperCase() },
      );
      setModifie(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2.5">
        <div className="min-w-[220px] flex-1 space-y-1">
          <Label htmlFor={`swift-equiv-${virement.id}`} className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Coins className="size-3.5" aria-hidden="true" />
            Équivalent du virement en devise
          </Label>
          <AmountInput id={`swift-equiv-${virement.id}`} className="text-right font-bold tabular-nums" value={equivalent} allowNegative={false} onValueChange={(v) => { setEquivalent(v); setModifie(true); }} />
        </div>
        <div className="w-28 space-y-1">
          <Label htmlFor={`swift-devise-${virement.id}`} className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Devise</Label>
          <Input
            id={`swift-devise-${virement.id}`}
            value={deviseRef}
            maxLength={8}
            onChange={(e) => {
              const nouvelle = e.target.value.toUpperCase();
              // Les factures qui étaient dans l'ancienne devise suivent le changement.
              setLignes((ls) => ls.map((l) => (l.devise.trim().toUpperCase() === deviseRef.trim().toUpperCase() ? { ...l, devise: nouvelle } : l)));
              setDeviseRef(nouvelle);
              setModifie(true);
            }}
          />
        </div>
        <p className="min-w-[220px] flex-1 text-xs text-muted-foreground">
          Indiquez à combien le virement de <b className="text-foreground">{montantSwift(virement.montant)} TND</b> correspond en devise : vos factures sont comparées à ce montant.
        </p>
      </div>
      <input
        ref={fichierRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        aria-label="Joindre la facture"
        onChange={(e) => {
          void choisirPiece(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-1.5 py-1.5"><span className="inline-flex items-center gap-1.5"><Hash className="size-3.5" aria-hidden="true" />N° facture</span></th>
              <th className="px-1.5 py-1.5"><span className="inline-flex items-center gap-1.5"><Coins className="size-3.5" aria-hidden="true" />Montant devise</span></th>
              <th className="px-1.5 py-1.5">Devise</th>
              <th className="px-1.5 py-1.5"><span className="inline-flex items-center gap-1.5"><Repeat className="size-3.5" aria-hidden="true" />Taux de change</span></th>
              <th className="px-1.5 py-1.5 text-right"><span className="inline-flex items-center gap-1.5"><Coins className="size-3.5" aria-hidden="true" />Montant en TND</span></th>
              <th className="px-1.5 py-1.5"><span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" aria-hidden="true" />Pièce</span></th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-1.5 py-4 text-center text-[13px] text-muted-foreground">Aucune facture pour l'instant : ajoutez la première facture d'achat.</td>
              </tr>
            )}
            {lignes.map((l, i) => (
              <tr key={l.cle}>
                <td className="px-1.5 py-1"><Input aria-label={`Numéro de la facture ${i + 1}`} value={l.numFacture} onChange={(e) => maj(l.cle, { numFacture: e.target.value })} placeholder="N° facture" /></td>
                <td className="px-1.5 py-1"><AmountInput aria-label={`Montant devise de la facture ${i + 1}`} className="text-right tabular-nums" value={l.montantDevise} onValueChange={(v) => maj(l.cle, { montantDevise: v })} allowNegative={false} /></td>
                <td className="w-24 px-1.5 py-1"><Input aria-label={`Devise de la facture ${i + 1}`} value={l.devise} maxLength={8} onChange={(e) => maj(l.cle, { devise: e.target.value.toUpperCase() })} /></td>
                <td className="px-1.5 py-1"><AmountInput aria-label={`Taux de change de la facture ${i + 1}`} className="text-right tabular-nums" value={l.taux} decimals={4} onValueChange={(v) => maj(l.cle, { taux: v })} allowNegative={false} /></td>
                <td className="px-1.5 py-1"><AmountInput aria-label={`Montant en dinar de la facture ${i + 1}`} className="text-right font-bold tabular-nums" value={l.montantTnd} onValueChange={(v) => maj(l.cle, { montantTnd: v, tndManuel: true })} allowNegative={false} /></td>
                <td className="px-1.5 py-1">
                  {l.pieceNom ? (
                    <button type="button" onClick={() => void ouvrirPiece(l)} className="inline-flex max-w-[9rem] items-center gap-1.5 truncate text-xs font-semibold text-primary underline underline-offset-2" title={l.pieceNom}>
                      <Paperclip className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{l.pieceNom}</span>
                    </button>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => { setPieceCible(l.cle); fichierRef.current?.click(); }}>
                      <Paperclip className="size-3.5" aria-hidden="true" />
                      Joindre
                    </Button>
                  )}
                </td>
                <td className="px-1 py-1">
                  <button type="button" aria-label={`Retirer la facture ${i + 1}`} className="grid size-8 place-items-center text-muted-foreground hover:text-destructive" onClick={() => { setModifie(true); setLignes((ls) => ls.filter((x) => x.cle !== l.cle)); }}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => { setModifie(true); setLignes((ls) => [...ls, vide(deviseRef.trim().toUpperCase() || "EUR")]); }}>
        <Plus className="size-4" aria-hidden="true" />
        Ajouter une facture
      </Button>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-3">
        <div className="min-w-[200px] flex-1">
          <div className="h-2 overflow-hidden rounded-full border border-border bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Part du montant justifiée">
            <div className={cn("h-full", atteint ? "bg-success" : depasse ? "bg-destructive" : "bg-accent")} style={{ width: `${pct}%` }} />
          </div>
          <p className={cn("mt-1 text-xs", depasse ? "text-destructive" : "text-muted-foreground")}>
            {!reference
              ? "Indiquez d'abord l'équivalent du virement en devise : c'est avec lui que les factures sont comparées."
              : atteint
                ? `Le total des factures atteint l'équivalent demandé (${montantSwift(equivalent)} ${deviseRef}).`
                : depasse
                  ? `Dépassement de ${montantSwift(-reste)} ${deviseRef} : vérifiez les montants ou retirez une facture.`
                  : `${pct} % justifié · encore ${montantSwift(reste)} ${deviseRef} à couvrir avec d'autres factures`}
            {autreDevise && " Les factures dans une autre devise ne sont pas comptées."}
          </p>
        </div>
        <dl className="flex gap-5 text-xs text-muted-foreground">
          <div><dt>Équivalent ({deviseRef || "devise"})</dt><dd className="text-[15px] font-bold tabular-nums text-foreground">{reference ? montantSwift(equivalent) : "—"}</dd></div>
          <div><dt>Justifié</dt><dd className="text-[15px] font-bold tabular-nums text-foreground">{montantSwift(justifie)}</dd></div>
          <div><dt>Reste</dt><dd className={cn("text-[15px] font-bold tabular-nums", atteint ? "text-success" : "text-warning")}>{reference ? montantSwift(Math.max(reste, 0)) : "—"}</dd></div>
          <div title="Information : le total des factures converti au taux de chaque facture"><dt>≈ en dinar</dt><dd className="text-[15px] font-bold tabular-nums text-foreground">{montantSwift(justifieTnd)}</dd></div>
        </dl>
        <Button type="button" className="gap-2" disabled={busy || !modifie} onClick={() => void enregistrer()}>
          {libelleBouton.startsWith("Envoyer") ? <Send className="size-4" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {libelleBouton}
        </Button>
      </div>
    </div>
  );
}
