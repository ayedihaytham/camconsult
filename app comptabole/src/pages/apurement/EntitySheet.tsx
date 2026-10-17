import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { decimalTnd, inputTnd, inputRate, displayRate } from "@/lib/apurement";
import { useApurement } from "@/store/apurement";
import { StockLinkPanel } from "./StockLinkPanel";
import { DocumentsPanel } from "./DocumentsPanel";
import { BcDetails, RecordHistory } from "./RecordHistory";
import type {
  ApurementKind,
  ApurementRecord,
  Quarter,
} from "@/types/apurement";

const names = {
  autorisations: "autorisation",
  fournisseurs: "fournisseur",
  bcs: "BC",
  factures: "facture",
};
type Props = {
  kind: ApurementKind;
  societeId: string;
  annee: number;
  trimestre: Quarter;
  record?: ApurementRecord;
  initialValues?: Partial<ApurementRecord>;
  refs: Record<"autorisations" | "fournisseurs" | "bcs", ApurementRecord[]>;
  onClose: () => void;
  onSaved: () => void;
};
export function EntitySheet({
  kind,
  societeId,
  annee,
  trimestre,
  record,
  initialValues,
  refs,
  onClose,
  onSaved,
}: Props) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [supplier, setSupplier] = useState(
    record?.fournisseurId || initialValues?.fournisseurId || "",
  );
  const [bc, setBc] = useState(record?.bcId || "");
  const save = useApurement((s) => s.save);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const s = (key: string) => String(form.get(key) || "");
    const nullable = (key: string) => s(key) || null;
    try {
      const common = {
        societeId,
        ...(record ? { expectedVersion: record.version } : {}),
      };
      let input: Record<string, unknown>;
      if (kind === "fournisseurs")
        input = {
          ...common,
          raisonSociale: s("raisonSociale"),
          matriculeFiscalRaw: s("matriculeFiscalRaw"),
          matriculeFiscalNormalise: nullable("matriculeFiscalNormalise"),
          aliases: s("aliases")
            .split(";")
            .map((v) => v.trim())
            .filter(Boolean),
        };
      else if (kind === "autorisations")
        input = {
          ...common,
          numero: s("numero"),
          dateDebut: nullable("dateDebut"),
          dateFin: nullable("dateFin"),
          plafondHtMillimes: s("plafondHt") ? inputTnd(s("plafondHt")) : null,
          plafondTvaMillimes: s("plafondTva")
            ? inputTnd(s("plafondTva"))
            : null,
          statutInterne: s("statutInterne"),
        };
      else if (kind === "bcs")
        input = {
          ...common,
          numero: s("numero"),
          autorisationId: s("autorisationId"),
          fournisseurId: supplier,
          dateBc: nullable("dateBc"),
          description: s("description"),
          plafondHtMillimes: s("plafondHt") ? inputTnd(s("plafondHt")) : null,
        };
      else
        input = {
          ...common,
          bcId: bc || null,
          ...(record?.stockMouvementId
            ? {
                confirmerMontantStock:
                  form.get("confirmerMontantStock") === "on",
              }
            : {}),
          fournisseurId: bc
            ? refs.bcs.find((x) => x.id === bc)?.fournisseurId
            : supplier,
          numeroFacture: s("numeroFacture"),
          dateFacture: nullable("dateFacture"),
          datePrecision: s("dateFacture")
            ? "day"
            : s("dateBrute")
              ? "month"
              : "unknown",
          dateBrute: s("dateBrute"),
          objet: s("objet"),
          montantHtMillimes: inputTnd(s("ht")),
          tauxTvaBps: inputRate(s("taux")),
          tvaMode: s("tvaMode"),
          ...(s("tvaMode") === "manuel"
            ? { tvaSuspendueMillimes: inputTnd(s("tva")) }
            : {}),
          motifCorrection: s("motifCorrection"),
          annee,
          trimestre,
          motifPeriode: s("motifPeriode"),
        };
      await save(kind, input, record?.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Enregistrement impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  const field = (
    name: string,
    label: string,
    value = "",
    type = "text",
    required = false,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`ap-${name}`}>{label}</Label>
      <Input
        id={`ap-${name}`}
        name={name}
        type={type}
        defaultValue={value}
        required={required}
      />
    </div>
  );
  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const select = (
    name: string,
    label: string,
    options: ApurementRecord[],
    value = "",
    onChange?: (v: string) => void,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`ap-${name}`}>{label}</Label>
      <select
        id={`ap-${name}`}
        className={selectClass}
        name={name}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        required={name !== "bcId"}
      >
        <option value="">
          {name === "bcId" ? "À affecter (brouillon)" : "Choisir…"}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.numero || o.raisonSociale}
          </option>
        ))}
      </select>
    </div>
  );
  const [auth, setAuth] = useState(record?.autorisationId || "");
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader className="px-4 sm:px-6">
          <SheetTitle>
            {record ? "Modifier" : "Ajouter"} {names[kind]}
          </SheetTitle>
          <SheetDescription>
            Achats en suspension de TVA · {annee} {trimestre}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-4 px-4 sm:px-6">
            {error && (
              <p
                role="alert"
                className="rounded border border-destructive p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {kind === "fournisseurs" ? (
              <>
                {field(
                  "raisonSociale",
                  "Raison sociale",
                  record?.raisonSociale,
                  "text",
                  true,
                )}
                {field(
                  "matriculeFiscalRaw",
                  "Matricule fiscal (source)",
                  record?.matriculeFiscalRaw,
                )}
                {field(
                  "matriculeFiscalNormalise",
                  "Matricule vérifié par le cabinet",
                  record?.matriculeFiscalNormalise || "",
                )}
                {field(
                  "aliases",
                  "Autres noms confirmés dans Stock (séparer par ;)",
                  (record?.aliases || []).join("; "),
                )}
                <p className="text-xs text-muted-foreground">
                  Renseigner le matricule vérifié uniquement après contrôle du
                  justificatif.
                </p>
              </>
            ) : kind === "factures" ? (
              <>
                {field(
                  "numeroFacture",
                  "Numéro de facture",
                  record?.numeroFacture || initialValues?.numeroFacture,
                  "text",
                  true,
                )}
                {select("bcId", "Bon de commande", refs.bcs, bc, setBc)}
                {!bc &&
                  select(
                    "fournisseurId",
                    "Fournisseur",
                    refs.fournisseurs,
                    supplier,
                    setSupplier,
                  )}
                {field(
                  "dateFacture",
                  "Date complète",
                  record?.dateFacture || initialValues?.dateFacture || "",
                  "date",
                )}
                {field(
                  "dateBrute",
                  "Mois seul (MM/AAAA), si jour inconnu",
                  record?.dateBrute,
                )}
                {field(
                  "ht",
                  "Montant HT (TND)",
                  decimalTnd(
                    record?.montantHtMillimes ||
                      initialValues?.montantHtMillimes,
                  ),
                  "text",
                  true,
                )}
                {record?.stockMouvementId && (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      name="confirmerMontantStock"
                      type="checkbox"
                      className="mt-1"
                    />
                    Confirmer la correction du montant dans Stock si une seule
                    ligne, quantité 1, devise TND et cours 1. Les autres lignes
                    exigent une correction dans Stock.
                  </label>
                )}
                {field(
                  "taux",
                  "Taux de TVA (%)",
                  displayRate(record?.tauxTvaBps),
                  "text",
                  true,
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="ap-tvaMode">Calcul TVA</Label>
                  <select
                    className={selectClass}
                    id="ap-tvaMode"
                    name="tvaMode"
                    defaultValue={record?.tvaMode || "auto"}
                  >
                    <option value="auto">
                      Automatique (arrondi provisoire)
                    </option>
                    <option value="manuel">
                      Correction manuelle justifiée
                    </option>
                  </select>
                </div>
                {field(
                  "tva",
                  "TVA suspendue corrigée (TND)",
                  decimalTnd(record?.tvaSuspendueMillimes),
                )}
                {field(
                  "motifCorrection",
                  "Justification de correction",
                  record?.motifCorrection,
                )}
                {field(
                  "motifPeriode",
                  "Justification de période exceptionnelle",
                  record?.motifPeriode,
                )}
                {field("objet", "Objet", record?.objet)}
              </>
            ) : (
              <>
                {field("numero", "Numéro", record?.numero, "text", true)}
                {kind === "bcs" ? (
                  <>
                    {select(
                      "autorisationId",
                      "Autorisation",
                      refs.autorisations,
                      auth,
                      setAuth,
                    )}
                    {select(
                      "fournisseurId",
                      "Fournisseur",
                      refs.fournisseurs,
                      supplier,
                      setSupplier,
                    )}
                    {field(
                      "dateBc",
                      "Date du BC",
                      record?.dateBc || "",
                      "date",
                    )}
                    {field("description", "Description", record?.description)}
                  </>
                ) : (
                  <>
                    {field(
                      "dateDebut",
                      "Début de validité renseigné",
                      record?.dateDebut || "",
                      "date",
                    )}
                    {field(
                      "dateFin",
                      "Fin de validité renseignée",
                      record?.dateFin || "",
                      "date",
                    )}
                    <Label htmlFor="ap-statutInterne">État interne</Label>
                    <select
                      id="ap-statutInterne"
                      name="statutInterne"
                      className={selectClass}
                      defaultValue={record?.statutInterne || "brouillon"}
                    >
                      <option value="brouillon">Brouillon</option>
                      <option value="active">Active</option>
                      <option value="fermee">Fermée</option>
                      <option value="annulee">Annulée</option>
                    </select>
                  </>
                )}
                {field(
                  "plafondHt",
                  "Plafond HT renseigné (TND, facultatif)",
                  decimalTnd(record?.plafondHtMillimes),
                )}
                {kind === "autorisations" &&
                  field(
                    "plafondTva",
                    "Plafond TVA renseigné (TND, facultatif)",
                    decimalTnd(record?.plafondTvaMillimes),
                  )}
              </>
            )}
            {kind === "factures" && record && (
              <StockLinkPanel
                invoice={record}
                bcs={refs.bcs}
                onSaved={() => {
                  onSaved();
                  onClose();
                }}
              />
            )}
            {kind === "bcs" && record && (
              <BcDetails societeId={societeId} bcId={record.id} />
            )}
            {kind === "autorisations" && record && (
              <section className="space-y-2 border-t pt-4">
                <h3 className="font-semibold">BC de cette autorisation</h3>
                {refs.bcs
                  .filter((b) => b.autorisationId === record.id)
                  .slice(0, 10)
                  .map((b) => (
                    <Link
                      className="block py-2 text-sm underline"
                      key={b.id}
                      to={`/apurement/${societeId}/bcs/${b.id}?annee=${annee}&trimestre=${trimestre}`}
                    >
                      BC {b.numero} ·{" "}
                      {
                        refs.fournisseurs.find((f) => f.id === b.fournisseurId)
                          ?.raisonSociale
                      }
                    </Link>
                  ))}
                <Link
                  className="block text-sm underline"
                  to={`/apurement/${societeId}?vue=registre&registre=bcs&autorisationId=${record.id}&annee=${annee}&trimestre=${trimestre}`}
                >
                  Ouvrir le registre des BC de cette autorisation
                </Link>
              </section>
            )}
            {record && (
              <RecordHistory societeId={societeId} recordId={record.id} />
            )}
            {record && kind !== "fournisseurs" && (
              <DocumentsPanel
                societeId={societeId}
                parentType={
                  kind === "factures"
                    ? "facture"
                    : kind === "bcs"
                      ? "bc"
                      : "autorisation"
                }
                parentId={record.id}
              />
            )}
          </SheetBody>
          <SheetFooter className="px-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button disabled={busy} type="submit">
              {busy ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
