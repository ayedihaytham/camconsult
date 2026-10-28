import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MouvementInput } from "@/store/suiviDevise";
import { cn } from "@/lib/utils";
import { facturesCiteesClient, repartitionAuto, type EncaissementCandidat } from "@/lib/suiviDeviseBanque";
import { lireNombre } from "@/lib/filtresRecapSociete";
import type { SuiviDeviseFacture, SuiviDeviseLot, SuiviDeviseMouvement, SuiviDeviseMouvementType } from "@/types";

const NONE = "__aucun__";

const TYPE_LABELS: Record<SuiviDeviseMouvementType, string> = {
  charge_transport: "Charge de transport",
  avoir: "Avoir",
  reglement: "Règlement",
};

const schema = z.object({
  type: z.enum(["charge_transport", "avoir", "reglement"]),
  lotId: z.string(),
  libelle: z.string(),
  date: z.string(),
  montant: z.coerce.number(),
});

type FormValues = z.infer<typeof schema>;

const empty: FormValues = { type: "reglement", lotId: NONE, libelle: "", date: "", montant: 0 };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mouvement?: SuiviDeviseMouvement | null;
  lots: SuiviDeviseLot[];
  /** Factures de la fiche : un règlement se répartit dessus. */
  factures?: SuiviDeviseFacture[];
  /** Encaissements du suivi bancaire (crédits de la devise de la fiche) qu'il reste à affecter. */
  encaissements?: EncaissementCandidat[];
  devise?: string;
  onSubmit: (values: MouvementInput) => void;
}

const fmtN = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function SuiviDeviseMouvementFormSheet({ open, onOpenChange, mouvement, lots, factures = [], encaissements = [], devise = "", onSubmit }: Props) {
  const isEdit = Boolean(mouvement);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });

  useEffect(() => {
    if (!open) return;
    reset(
      mouvement
        ? {
            type: mouvement.type,
            lotId: mouvement.lotId ?? NONE,
            libelle: mouvement.libelle,
            date: mouvement.date ?? "",
            montant: mouvement.montant,
          }
        : empty,
    );
  }, [open, mouvement, reset]);

  const type = watch("type");
  const lotId = watch("lotId");
  const montant = Number(watch("montant")) || 0;

  // Encaissement du suivi bancaire et répartition sur les factures (règlement seulement).
  const [encaissementId, setEncaissementId] = useState<string | null>(null);
  const [parts, setParts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setEncaissementId(mouvement?.mouvementBancaireId ?? null);
    setParts(Object.fromEntries((mouvement?.affectations ?? []).map((a) => [a.factureId, String(a.montant).replace(".", ",")])));
  }, [open, mouvement]);
  const proprePart = (factureId: string) => mouvement?.affectations.find((a) => a.factureId === factureId)?.montant ?? 0;
  /** Factures que ce règlement peut encore payer : celles qui ont un reste (le sien compris), ou qu'il paie déjà. */
  const aRegler = useMemo(
    () => factures.map((f) => ({ f, reste: Math.round((f.reste + proprePart(f.id)) * 1000) / 1000 })).filter((x) => x.reste > 0.0005 || proprePart(x.f.id) > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [factures, mouvement],
  );
  const lu = (id: string) => {
    const t = parts[id]?.trim() ?? "";
    if (t === "") return 0;
    const n = lireNombre(t);
    return Number.isNaN(n) ? 0 : n;
  };
  const totalAffecte = Math.round(aRegler.reduce((t, x) => t + lu(x.f.id), 0) * 1000) / 1000;
  const nonReparti = Math.round((montant - totalAffecte) * 1000) / 1000;
  const trop = totalAffecte > montant + 0.0005;
  const encaissement = encaissements.find((e) => e.mouvement.id === encaissementId) ?? null;
  const depasseEncaissement = Boolean(encaissement && montant > encaissement.reste + 0.0005);

  function repartir(montantARepartir: number, libelleBanque: string) {
    const citees = facturesCiteesClient(libelleBanque, factures);
    const { affectations } = repartitionAuto(montantARepartir, aRegler.map(({ f, reste }) => ({ id: f.id, reste, dateFacture: f.dateFacture, ordre: f.ordre })), citees);
    setParts(Object.fromEntries(affectations.map((a) => [a.factureId, String(a.montant).replace(".", ",")])));
  }

  function choisirEncaissement(id: string) {
    if (id === NONE) {
      setEncaissementId(null);
      return;
    }
    const e = encaissements.find((x) => x.mouvement.id === id);
    if (!e) return;
    setEncaissementId(id);
    setValue("type", "reglement");
    setValue("date", e.mouvement.dateOp);
    setValue("libelle", e.mouvement.libelle);
    setValue("montant", e.reste);
    repartir(e.reste, `${e.mouvement.libelle} ${e.mouvement.details}`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifier le mouvement" : "Nouveau mouvement"}</SheetTitle>
          <SheetDescription>Charge de transport, avoir ou règlement — s'ajoute au solde.</SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit((v) => {
            onSubmit({
              type: v.type,
              lotId: v.lotId === NONE ? null : v.lotId,
              libelle: v.libelle.trim(),
              date: v.date || null,
              montant: v.montant,
              mouvementBancaireId: v.type === "reglement" ? encaissementId : null,
              affectations: v.type === "reglement" ? aRegler.map((x) => ({ factureId: x.f.id, montant: lu(x.f.id) })).filter((a) => a.montant > 0) : [],
            });
            onOpenChange(false);
          })}
        >
          <SheetBody className="space-y-5">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setValue("type", v as SuiviDeviseMouvementType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as SuiviDeviseMouvementType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Lot LC (facultatif)</Label>
              <Select value={lotId} onValueChange={(v) => setValue("lotId", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucun lot — global</SelectItem>
                  {lots.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.libelle || "Lot sans nom"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input {...register("libelle")} placeholder="Ex. DU F N°202300015" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...register("date")} />
              </div>
              <div className="space-y-1.5">
                <Label>Montant</Label>
                <Input type="number" step="any" {...register("montant")} className="text-right tabular-nums" />
              </div>
            </div>

            {type === "reglement" && (
              <>
                {(encaissements.length > 0 || encaissementId) && (
                  <div className="space-y-1.5">
                    <Label>Encaissement du suivi bancaire (facultatif)</Label>
                    <Select value={encaissementId ?? NONE} onValueChange={choisirEncaissement}>
                      <SelectTrigger aria-label="Encaissement du suivi bancaire">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Aucun — règlement saisi à la main</SelectItem>
                        {encaissements.map((e) => (
                          <SelectItem key={e.mouvement.id} value={e.mouvement.id}>
                            {e.mouvement.dateOp.split("-").reverse().join("/")} · {fmtN(e.reste)} {devise} restant · {e.mouvement.libelle.slice(0, 50)}
                            {e.nommeLeClient ? " ★" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">★ : le libellé de la banque nomme ce client. Le montant, la date et les factures citées sont préremplis.</p>
                    {depasseEncaissement && encaissement && (
                      <p role="alert" className="text-xs font-medium text-destructive">Le montant dépasse ce qu'il reste à affecter sur l'encaissement ({fmtN(encaissement.reste)} {devise}).</p>
                    )}
                  </div>
                )}

                {aRegler.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Répartition sur les factures</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => repartir(montant, encaissement ? `${encaissement.mouvement.libelle} ${encaissement.mouvement.details}` : watch("libelle"))} disabled={montant <= 0}>
                        Répartir automatiquement
                      </Button>
                    </div>
                    <div className="overflow-hidden rounded-md border border-border">
                      <table className="w-full text-xs" aria-label="Répartition sur les factures">
                        <thead className="bg-secondary text-left text-muted-foreground">
                          <tr>
                            <th className="px-2 py-1.5 font-medium">Facture</th>
                            <th className="px-2 py-1.5 font-medium">Lot</th>
                            <th className="px-2 py-1.5 text-right font-medium">Reste</th>
                            <th className="px-2 py-1.5 text-right font-medium">Affecté</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aRegler.map(({ f, reste }) => {
                            const part = lu(f.id);
                            return (
                              <tr key={f.id} className="border-t border-border">
                                <td className="px-2 py-1 font-medium">{f.nFacture || "—"}</td>
                                <td className="px-2 py-1 text-muted-foreground">{f.lotId ? lots.find((l) => l.id === f.lotId)?.libelle || "—" : "—"}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{fmtN(reste)}</td>
                                <td className="px-2 py-1">
                                  <Input
                                    inputMode="decimal"
                                    aria-label={`Montant affecté à la facture ${f.nFacture}`}
                                    value={parts[f.id] ?? ""}
                                    onChange={(e) => setParts((p) => ({ ...p, [f.id]: e.target.value }))}
                                    className={cn("h-7 w-28 text-right text-xs tabular-nums", part > reste + 0.0005 && "border-warning")}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className={cn("flex justify-between text-xs", trop ? "font-medium text-destructive" : "text-muted-foreground")} role={trop ? "alert" : undefined}>
                      <span>{trop ? "La répartition dépasse le montant du règlement" : `Affecté ${fmtN(totalAffecte)} · reste non réparti ${fmtN(Math.max(0, nonReparti))}`}</span>
                    </p>
                  </div>
                )}
              </>
            )}
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="ledger" disabled={trop || depasseEncaissement}>
              {isEdit ? "Enregistrer" : "Ajouter le mouvement"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
