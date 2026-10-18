import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import "./apurement.css";
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
  onSaved: (created?: ApurementRecord) => void;
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
  const [vatMode, setVatMode] = useState(record?.tvaMode || "auto");
  const [requestId] = useState(() => crypto.randomUUID());
  const save = useApurement((s) => s.save);
  const enterPurchase = useApurement((s) => s.enterPurchase);
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
          fournisseurId:
            bc && bc !== "new"
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
      if (kind === "factures" && !record) {
        const {
          societeId: _soc,
          fournisseurId: _supplier,
          bcId: _bc,
          ...facture
        } = input;
        const created = await enterPurchase({
          societeId,
          requestId,
          facture,
          fournisseur:
            bc && bc !== "new"
              ? refs.bcs.find((b) => b.id === bc)?.fournisseurId
              : supplier === "new"
                ? {
                    raisonSociale: s("newSupplierName"),
                    matriculeFiscalRaw: s("newSupplierMf"),
                  }
                : supplier,
          bc:
            bc === "new"
              ? {
                  numero: s("newBcNumero"),
                  dateBc: nullable("newBcDate"),
                  autorisation:
                    auth === "new"
                      ? { numero: s("newAutorisationNumero") }
                      : auth,
                }
              : bc || null,
        });
        onSaved(created);
        return;
      } else await save(kind, input, record?.id);
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
        {kind === "factures" && !record && (
          <option value="new">
            + Créer{" "}
            {name === "bcId"
              ? "un bon de commande"
              : name === "newAutorisationId"
                ? "une autorisation"
                : "un fournisseur"}{" "}
            ici
          </option>
        )}
      </select>
    </div>
  );
  const [auth, setAuth] = useState(record?.autorisationId || "");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="apurement-dialog flex w-[calc(100vw-1.5rem)] max-w-5xl max-h-[calc(100dvh-1.5rem)] flex-col gap-0 overflow-hidden rounded-xl p-0">
        <DialogHeader className="shrink-0 border-b border-primary-foreground/15 bg-primary px-5 py-5 pr-14 text-primary-foreground sm:px-8 sm:py-6">
          <DialogTitle className="apurement-dialog-title text-2xl text-primary-foreground">
            {record ? "Modifier" : "Ajouter"} {names[kind]}
          </DialogTitle>
          <DialogDescription className="text-primary-foreground/80">
            Achats en suspension de TVA · {annee} {trimestre}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="apurement-form-grid min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
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
                <h3 className="border-b pb-2 text-sm font-semibold">
                  Facture et rattachement
                </h3>
                {field(
                  "numeroFacture",
                  "Numéro de facture",
                  record?.numeroFacture || initialValues?.numeroFacture,
                  "text",
                  true,
                )}
                {select("bcId", "Bon de commande", refs.bcs, bc, setBc)}
                {(!bc || bc === "new") &&
                  select(
                    "fournisseurId",
                    "Fournisseur",
                    refs.fournisseurs,
                    supplier,
                    setSupplier,
                  )}
                {supplier === "new" && (!bc || bc === "new") && (
                  <div className="space-y-3 rounded-md bg-muted p-3">
                    {field(
                      "newSupplierName",
                      "Nom du nouveau fournisseur",
                      "",
                      "text",
                      true,
                    )}
                    {field(
                      "newSupplierMf",
                      "Matricule fiscal figurant sur la facture",
                    )}
                    <p className="text-xs text-muted-foreground">
                      Le responsable vérifiera cette identité avant la
                      déclaration.
                    </p>
                  </div>
                )}
                {bc === "new" && (
                  <div className="space-y-3 rounded-md bg-muted p-3">
                    <p className="text-sm font-medium">
                      Recopiez les références de votre bon de commande
                    </p>
                    {field(
                      "newBcNumero",
                      "Numéro du nouveau bon de commande",
                      "",
                      "text",
                      true,
                    )}
                    {field(
                      "newBcDate",
                      "Date du nouveau bon de commande",
                      "",
                      "date",
                      true,
                    )}
                    {select(
                      "newAutorisationId",
                      "Autorisation couvrant ce bon",
                      refs.autorisations,
                      auth,
                      setAuth,
                    )}
                    {auth === "new" &&
                      field(
                        "newAutorisationNumero",
                        "Numéro de la nouvelle autorisation",
                        "",
                        "text",
                        true,
                      )}
                    <p className="text-xs text-muted-foreground">
                      La facture, le fournisseur et ces références seront
                      enregistrés ensemble. Vous joindrez ensuite leurs
                      documents.
                    </p>
                  </div>
                )}
                {bc && bc !== "new" && (
                  <p className="text-xs text-muted-foreground">
                    Fournisseur du BC :{" "}
                    {refs.fournisseurs.find(
                      (f) =>
                        f.id ===
                        refs.bcs.find((b) => b.id === bc)?.fournisseurId,
                    )?.raisonSociale || "fourni par le BC"}
                    . Une facture est rattachée à un seul BC.
                  </p>
                )}
                {field(
                  "dateFacture",
                  "Date complète",
                  record?.dateFacture || initialValues?.dateFacture || "",
                  "date",
                )}
                <details
                  open={Boolean(record?.dateBrute && !record.dateFacture)}
                  className="text-sm"
                >
                  <summary className="cursor-pointer text-muted-foreground">
                    Je connais seulement le mois de la facture
                  </summary>
                  <div className="pt-2">
                    {field(
                      "dateBrute",
                      "Mois seul (MM/AAAA), si jour inconnu",
                      record?.dateBrute,
                    )}
                  </div>
                </details>
                <h3 className="border-b pb-2 pt-2 text-sm font-semibold">
                  Montants en dinars tunisiens
                </h3>
                <p className="text-xs text-muted-foreground">
                  Saisissez jusqu’à 3 décimales, par exemple 1234.567. Le taux
                  19 signifie 19 %.
                </p>
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
                    value={vatMode}
                    onChange={(e) =>
                      setVatMode(e.target.value as "auto" | "manuel")
                    }
                  >
                    <option value="auto">
                      Automatique (arrondi provisoire)
                    </option>
                    <option value="manuel">
                      Correction manuelle justifiée
                    </option>
                  </select>
                </div>
                {vatMode === "manuel" && (
                  <div className="space-y-3 rounded-md border border-warning/30 bg-warning/5 p-3">
                    {field(
                      "tva",
                      "TVA suspendue corrigée (TND)",
                      decimalTnd(record?.tvaSuspendueMillimes),
                      "text",
                      true,
                    )}
                    {field(
                      "motifCorrection",
                      "Justification de correction",
                      record?.motifCorrection,
                      "text",
                      true,
                    )}
                  </div>
                )}
                {vatMode === "auto" && (
                  <p className="text-xs text-muted-foreground">
                    La TVA est calculée à l’enregistrement. Aucune correction
                    manuelle à renseigner.
                  </p>
                )}
                <details
                  open={Boolean(record?.motifPeriode)}
                  className="text-sm"
                >
                  <summary className="cursor-pointer text-muted-foreground">
                    Facture affectée à un autre trimestre
                  </summary>
                  <div className="pt-2">
                    {field(
                      "motifPeriode",
                      "Justification de période exceptionnelle",
                      record?.motifPeriode,
                    )}
                  </div>
                </details>
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
              <div id="apurement-record-documents" className="scroll-mt-4">
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
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t bg-secondary/30 px-5 py-4 sm:px-8">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button disabled={busy} type="submit">
              {busy
                ? "Enregistrement…"
                : kind === "factures" && !record
                  ? "Enregistrer et ajouter les pièces"
                  : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
