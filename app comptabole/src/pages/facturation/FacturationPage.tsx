import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ColumnDef, Table as TanstackTable } from "@tanstack/react-table";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FileCode2,
  FileKey2,
  FileText,
  MoreHorizontal,
  Pencil,
  PenLine,
  Plus,
  Printer,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { LedgerSearchFilter } from "@/components/ledger/LedgerSearchFilter";
import { OperationalFab } from "@/components/ledger/OperationalFab";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import {
  LedgerWorkSurface,
  OperationalLedgerFooter,
  OperationalLedgerPage,
  OperationalLedgerToolbar,
  OperationalMobileHeader,
  OperationalMobilePagination,
  OperationalMobileUtility,
} from "@/components/ledger/OperationalLedgerLayout";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { useDataTable } from "@/components/data-table/useDataTable";
import { useOperationalPageSize } from "@/components/data-table/useOperationalPageSize";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { RowAction } from "@/components/common/RowActions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportRows, type ExportFormat } from "@/lib/export";
import { estEnRetard, formatTnd, imprimerFacture } from "@/lib/facturation";
import { printTable } from "@/lib/print";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { cn, formatDate } from "@/lib/utils";
import { useFacturation, type FactureInput } from "@/store/facturation";
import { FACTURE_STATUT_LABELS, type Facture, type FactureStatut } from "@/types";
import { CabinetInfoDialog } from "./CabinetInfoDialog";
import { FactureElectroniqueDialog } from "./FactureElectroniqueDialog";
import { SignatureElectroniqueDialog } from "./SignatureElectroniqueDialog";
import { FactureFormSheet } from "./FactureFormSheet";

/** Libellé de la colonne « Facture électronique » (écran, CSV et filtre). */
const LIBELLE_EINVOICE: Record<string, string> = {
  prete: "Préparée",
  signee: "Signée",
  deposee: "Déposée",
  validee: "Validée",
  rejetee: "Rejetée",
};
const libelleEinvoice = (statut: string | undefined) => (statut ? (LIBELLE_EINVOICE[statut] ?? statut) : "Non préparée");

type FiltreEinvoice = "all" | "aucune" | "prete" | "signee";

const MONOGRAM_TONES = [
  "border-primary/15 bg-primary/[0.07] text-primary",
  "border-border bg-secondary text-primary/80",
  "border-accent/35 bg-accent/10 text-primary",
] as const;

function initialesClient(nom: string) {
  const ordre = nom.trim().match(/^\d{1,3}/);
  if (ordre) return ordre[0];
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return mots.length > 1 ? `${mots[0][0]}${mots[1][0]}`.toUpperCase() : nom.slice(0, 2).toUpperCase();
}
const tonMonogramme = (graine: string) => MONOGRAM_TONES[Array.from(graine).reduce((t, c) => t + c.charCodeAt(0), 0) % MONOGRAM_TONES.length];

/** Statut affiché : « En retard » l'emporte sur « Émise » ; icône colorée et nom, sur une ligne (comme le registre des sociétés). */
function statutAffiche(f: Facture): { cle: string; libelle: string; icone: LucideIcon; classe: string } {
  if (f.statut === "annulee") return { cle: "annulee", libelle: "Annulée", icone: Ban, classe: "text-muted-foreground" };
  if (f.statut === "payee") return { cle: "payee", libelle: "Payée", icone: CheckCircle2, classe: "text-success" };
  if (estEnRetard(f)) return { cle: "retard", libelle: "En retard", icone: AlertCircle, classe: "text-warning" };
  return { cle: "emise", libelle: "Émise", icone: Clock, classe: "text-primary" };
}

function StatutFacture({ facture }: { facture: Facture }) {
  const { libelle, icone: Icone, classe } = statutAffiche(facture);
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold", facture.statut === "annulee" ? "text-muted-foreground" : "text-foreground")}>
      <Icone className={cn("size-4 shrink-0", classe)} aria-hidden="true" />
      {libelle}
    </span>
  );
}

function EtatEinvoice({ facture }: { facture: Facture }) {
  if (facture.statut === "annulee") return <span className="text-xs text-muted-foreground">—</span>;
  const statut = facture.einvoice?.statut;
  const Icone = statut === "signee" || statut === "deposee" || statut === "validee" ? ShieldCheck : statut === "prete" ? Clock : FileCode2;
  const classe = statut === "prete" ? "text-warning" : statut ? "text-success" : "text-muted-foreground";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-foreground">
      <Icone className={cn("size-4 shrink-0", classe)} aria-hidden="true" />
      {libelleEinvoice(statut)}
    </span>
  );
}

const COLONNES_EXPORT = [
  { header: "Client", value: (f: Facture) => f.societeNom },
  { header: "N°", value: (f: Facture) => f.numero },
  { header: "Émission", value: (f: Facture) => f.dateEmission },
  { header: "Échéance", value: (f: Facture) => f.echeance ?? "" },
  { header: "Total HT", value: (f: Facture) => f.totalHt.toFixed(3) },
  { header: "TVA", value: (f: Facture) => f.tva.toFixed(3) },
  { header: "Timbre fiscal", value: (f: Facture) => f.timbre.toFixed(3) },
  { header: "Net à payer", value: (f: Facture) => f.netAPayer.toFixed(3) },
  { header: "Statut", value: (f: Facture) => FACTURE_STATUT_LABELS[f.statut] },
  { header: "Signature", value: (f: Facture) => (f.signeeLe ? "Signée" : "Non signée") },
  { header: "Facture électronique", value: (f: Facture) => libelleEinvoice(f.einvoice?.statut) },
];

function FiltresFactures({
  statut,
  einvoice,
  retardSeul,
  onStatut,
  onEinvoice,
  onRetard,
}: {
  statut: "all" | FactureStatut;
  einvoice: FiltreEinvoice;
  retardSeul: boolean;
  onStatut: (s: "all" | FactureStatut) => void;
  onEinvoice: (e: FiltreEinvoice) => void;
  onRetard: (r: boolean) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Statut</p>
        <Select value={statut} onValueChange={(v) => onStatut(v as "all" | FactureStatut)}>
          <SelectTrigger aria-label="Filtrer par statut">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {(Object.keys(FACTURE_STATUT_LABELS) as FactureStatut[]).map((s) => (
              <SelectItem key={s} value={s}>
                {FACTURE_STATUT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Facture électronique</p>
        <Select value={einvoice} onValueChange={(v) => onEinvoice(v as FiltreEinvoice)}>
          <SelectTrigger aria-label="Filtrer par facture électronique">
            <SelectValue placeholder="Facture électronique" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="aucune">Non préparées</SelectItem>
            <SelectItem value="prete">Préparées, à signer</SelectItem>
            <SelectItem value="signee">Signées</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox checked={retardSeul} onCheckedChange={(c) => onRetard(Boolean(c))} />
        En retard uniquement
      </label>
    </div>
  );
}

function OutilsListe({
  table,
  onExport,
  onPrint,
}: {
  table: TanstackTable<Facture>;
  onExport: (format: ExportFormat) => void;
  onPrint: () => void;
}) {
  const colonnes = table.getAllColumns().filter((c) => c.getCanHide() && c.accessorFn);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="shadow-none">
          <Settings2 className="hidden size-3.5 sm:block" />
          <span className="hidden sm:inline">Outils</span>
          <MoreHorizontal className="size-4 sm:hidden" />
          <ChevronDown className="hidden size-3.5 opacity-70 sm:block" />
          <span className="sr-only sm:hidden">Outils de la liste</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="size-4" />
            Exporter
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => onExport("csv")}>CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onPrint}>
          <Printer className="size-4" />
          Imprimer la liste
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Settings2 className="size-4" />
            Colonnes
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {colonnes.map((c) => (
              <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(Boolean(v))} onSelect={(e) => e.preventDefault()}>
                {(c.columnDef.meta as { label?: string } | undefined)?.label ?? c.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FacturationPage() {
  const list = useFacturation((s) => s.list);
  const loading = useFacturation((s) => s.loading);
  const fetchList = useFacturation((s) => s.fetchList);
  const create = useFacturation((s) => s.create);
  const modifier = useFacturation((s) => s.modifier);
  const update = useFacturation((s) => s.update);
  const telechargerXml = useFacturation((s) => s.telechargerXml);
  const societeActive = useSocieteActive();
  const cabinet = useFacturation((s) => s.cabinet);
  const fetchCabinet = useFacturation((s) => s.fetchCabinet);
  const saveCabinet = useFacturation((s) => s.saveCabinet);

  const [statut, setStatut] = useState<"all" | FactureStatut>("all");
  const [filtreEi, setFiltreEi] = useState<FiltreEinvoice>("all");
  const [retardSeul, setRetardSeul] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"nouvelle" | "modification" | "copie">("nouvelle");
  const [formSource, setFormSource] = useState<Facture | null>(null);
  const [cabinetOpen, setCabinetOpen] = useState(false);
  const [aAnnuler, setAAnnuler] = useState<Facture | null>(null);
  const [eiFacture, setEiFacture] = useState<Facture | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);

  useEffect(() => {
    fetchList();
    fetchCabinet();
  }, [fetchList, fetchCabinet]);

  const filtered = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase("fr");
    return list.filter((f) => {
      if (societeActive && f.societeId !== societeActive.id) return false;
      if (statut !== "all" && f.statut !== statut) return false;
      if (retardSeul && !estEnRetard(f)) return false;
      const ei = f.einvoice?.statut;
      if (filtreEi === "aucune" && ei) return false;
      if (filtreEi === "prete" && ei !== "prete") return false;
      if (filtreEi === "signee" && ei !== "signee" && ei !== "deposee" && ei !== "validee") return false;
      if (q && !`${f.societeNom} ${f.numero}`.toLocaleLowerCase("fr").includes(q)) return false;
      return true;
    });
  }, [list, statut, filtreEi, retardSeul, recherche, societeActive]);

  // Indicateurs : ceux de la société active, ou du cabinet entier sans société active.
  const portee = societeActive ? list.filter((f) => f.societeId === societeActive.id) : list;
  const actives = portee.filter((f) => f.statut !== "annulee");
  const facture = actives.reduce((s, f) => s + f.netAPayer, 0);
  const encaisse = portee.filter((f) => f.statut === "payee").reduce((s, f) => s + f.netAPayer, 0);
  const nbRetard = portee.filter((f) => estEnRetard(f)).length;
  const nbASigner = portee.filter((f) => f.statut !== "annulee" && f.einvoice?.statut === "prete").length;
  const totalAffiche = filtered.filter((f) => f.statut !== "annulee").reduce((s, f) => s + f.netAPayer, 0);

  function ouvrirFormulaire(mode: "nouvelle" | "modification" | "copie", source: Facture | null = null) {
    setFormMode(mode);
    setFormSource(source);
    setFormOpen(true);
  }

  async function generer(data: FactureInput) {
    if (formMode === "modification" && formSource) {
      const f = await modifier(formSource.id, data);
      toast.success(
        formSource.einvoice?.statut === "prete"
          ? `Facture ${f.numero} modifiée — régénérez sa facture électronique avant de la signer`
          : `Facture ${f.numero} modifiée`,
      );
      return;
    }
    const f = await create(data);
    toast.success(`Facture ${f.numero} générée`);
  }

  /** Une facture n'est modifiable que tant qu'elle est émise (ni payée, ni annulée) et que sa facture électronique n'est ni signée ni déposée. */
  const modifiable = (f: Facture) => f.statut === "emise" && (!f.einvoice || f.einvoice.statut === "prete");

  async function basculerPaiement(f: Facture) {
    await update(f.id, { statut: f.statut === "payee" ? "emise" : "payee" });
    toast.success(f.statut === "payee" ? "Paiement retiré" : `Facture ${f.numero} marquée payée`);
  }

  async function basculerSignature(f: Facture) {
    await update(f.id, { signee: !f.signeeLe });
  }

  const source = () => (selection.length ? list.filter((f) => selection.includes(f.id)) : filtered);

  function exporter(format: ExportFormat) {
    const lignes = source();
    if (!lignes.length) return toast.error("Rien à exporter");
    exportRows("Factures", lignes, COLONNES_EXPORT, format);
    toast.success(`Export ${format.toUpperCase()} généré`);
  }

  function imprimerListe() {
    const lignes = source();
    if (!lignes.length) return toast.error("Rien à imprimer");
    printTable({
      title: "Liste des factures",
      subtitle:
        [statut !== "all" && `Statut : ${FACTURE_STATUT_LABELS[statut]}`, retardSeul && "En retard uniquement", recherche && `Recherche : « ${recherche} »`]
          .filter(Boolean)
          .join(" — ") || undefined,
      columns: [
        { header: "Client", value: (f: Facture) => f.societeNom },
        { header: "N°", value: (f: Facture) => f.numero },
        { header: "Émission", value: (f: Facture) => formatDate(f.dateEmission) },
        { header: "Échéance", value: (f: Facture) => (f.echeance ? formatDate(f.echeance) : "") },
        { header: "Net à payer", value: (f: Facture) => formatTnd(f.netAPayer), align: "right" as const },
        { header: "Statut", value: (f: Facture) => statutAffiche(f).libelle },
        { header: "Facture électronique", value: (f: Facture) => libelleEinvoice(f.einvoice?.statut) },
      ],
      rows: lignes,
    });
  }

  function imprimer(f: Facture) {
    if (!imprimerFacture(f, cabinet)) toast.error("Autorisez les fenêtres pop-up pour imprimer la facture");
  }

  const actionsLigne = (f: Facture): RowAction[] => {
    const copier: RowAction = { icon: Copy, label: "Dupliquer", onClick: () => ouvrirFormulaire("copie", f) };
    if (f.statut === "annulee") return [{ icon: Printer, label: "Imprimer / PDF", onClick: () => imprimer(f) }, copier];
    const ei = f.einvoice?.statut;
    const actions: RowAction[] = [{ icon: Printer, label: "Imprimer / PDF", onClick: () => imprimer(f) }];
    if (modifiable(f)) actions.push({ icon: Pencil, label: "Modifier", onClick: () => ouvrirFormulaire("modification", f) });
    actions.push(copier);
    if (ei === "signee") actions.push({ icon: Download, label: "Télécharger le XML signé", onClick: () => void telechargerXml(f.id, f.numero, "signe").catch(() => undefined) });
    else if (ei === "prete") actions.push({ icon: Download, label: "Télécharger le XML", onClick: () => void telechargerXml(f.id, f.numero).catch(() => undefined) });
    actions.push(
      { icon: f.statut === "payee" ? RotateCcw : Wallet, label: f.statut === "payee" ? "Retirer le paiement" : "Marquer payée", onClick: () => void basculerPaiement(f) },
      { icon: PenLine, label: f.signeeLe ? "Retirer la signature papier" : "Marquer signée (papier)", onClick: () => void basculerSignature(f) },
      { icon: Ban, label: "Annuler la facture", onClick: () => setAAnnuler(f), destructive: true },
    );
    return actions;
  };

  const libelleBoutonEi = (f: Facture) => {
    const ei = f.einvoice?.statut;
    return ei === "signee" || ei === "deposee" || ei === "validee" ? "Voir" : ei === "prete" ? "Signer" : "Préparer";
  };

  const colonnes: ColumnDef<Facture>[] = [
    {
      id: "selection",
      enableHiding: false,
      enableSorting: false,
      header: ({ table }) => {
        const ids = table.getRowModel().rows.map((r) => r.original.id);
        const tout = ids.length > 0 && ids.every((id) => selection.includes(id));
        const partiel = ids.some((id) => selection.includes(id));
        return (
          <Checkbox
            checked={tout ? true : partiel ? "indeterminate" : false}
            onCheckedChange={() => setSelection(tout ? selection.filter((id) => !ids.includes(id)) : [...new Set([...selection, ...ids])])}
            aria-label="Sélectionner la page"
          />
        );
      },
      cell: ({ row }) => (
        <Checkbox
          checked={selection.includes(row.original.id)}
          onCheckedChange={() => setSelection((s) => (s.includes(row.original.id) ? s.filter((id) => id !== row.original.id) : [...s, row.original.id]))}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Sélectionner la facture ${row.original.numero}`}
        />
      ),
      meta: { headerClassName: "w-10", cellClassName: "w-10" },
    },
    {
      id: "client",
      accessorFn: (f) => f.societeNom.toLowerCase(),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Client" />,
      cell: ({ row }) => {
        const f = row.original;
        return (
          <div className={cn("flex min-w-0 items-center gap-3", f.statut === "annulee" && "opacity-60")}>
            <span
              className={cn("societes-ledger-monogram flex size-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold tracking-wide", tonMonogramme(f.societeId))}
              aria-hidden
            >
              {initialesClient(f.societeNom)}
            </span>
            <div className="min-w-0">
              <p className={cn("societes-ledger-name truncate text-[13px] font-semibold leading-4 text-foreground", f.statut === "annulee" && "line-through")}>{f.societeNom}</p>
              <p className="societes-ledger-meta truncate text-[11px] leading-4 text-muted-foreground">{f.clientTva ? `MF ${f.clientTva}` : "Matricule fiscal non renseigné"}</p>
            </div>
          </div>
        );
      },
      meta: { label: "Client", headerClassName: "min-w-[200px]", cellClassName: "min-w-[200px]" },
    },
    {
      accessorKey: "numero",
      header: ({ column }) => <DataTableColumnHeader column={column} title="N°" />,
      cell: ({ row }) => <span className="font-mono text-[13px] font-semibold text-primary">{row.original.numero}</span>,
      meta: { label: "N°", headerClassName: "w-[96px]" },
    },
    {
      accessorKey: "dateEmission",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Émission" />,
      cell: ({ row }) => <span className="text-[13px] text-muted-foreground">{formatDate(row.original.dateEmission)}</span>,
      meta: { label: "Émission", headerClassName: "w-[100px]" },
    },
    {
      id: "echeance",
      accessorFn: (f) => f.echeance ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Échéance" />,
      cell: ({ row }) => {
        const f = row.original;
        return <span className={cn("text-[13px]", estEnRetard(f) ? "font-semibold text-warning" : "text-muted-foreground")}>{f.echeance ? formatDate(f.echeance) : "—"}</span>;
      },
      meta: { label: "Échéance", headerClassName: "w-[100px]" },
    },
    {
      accessorKey: "netAPayer",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Montant" />,
      cell: ({ row }) => <span className="text-[13px] font-bold tabular-nums text-primary">{formatTnd(row.original.netAPayer)}</span>,
      meta: { label: "Montant", headerClassName: "w-[116px] text-right", cellClassName: "text-right" },
    },
    {
      id: "statut",
      accessorFn: (f) => statutAffiche(f).libelle,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Statut" />,
      cell: ({ row }) => <StatutFacture facture={row.original} />,
      meta: { label: "Statut", headerClassName: "w-[112px]" },
    },
    {
      id: "signature",
      accessorFn: (f) => f.signeeLe ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Signature papier" />,
      cell: ({ row }) => {
        const f = row.original;
        if (f.statut === "annulee") return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void basculerSignature(f);
            }}
            title={f.signeeLe ? `Signée le ${formatDate(f.signeeLe)} — cliquer pour retirer` : "Marquer comme signée (papier)"}
            className={cn("inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold", f.signeeLe ? "text-foreground" : "text-muted-foreground hover:text-primary")}
          >
            <PenLine className={cn("size-4 shrink-0", f.signeeLe ? "text-success" : "text-muted-foreground")} aria-hidden="true" />
            {f.signeeLe ? "Signée" : "Non signée"}
          </button>
        );
      },
      meta: { label: "Signature papier", headerClassName: "w-[116px]" },
    },
    {
      id: "einvoice",
      accessorFn: (f) => libelleEinvoice(f.einvoice?.statut),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Facture électronique" />,
      cell: ({ row }) => <EtatEinvoice facture={row.original} />,
      meta: { label: "Facture électronique", headerClassName: "w-[150px]" },
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => {
        const f = row.original;
        return (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <span className="mr-1 hidden items-center gap-1.5 lg:flex">
              {f.statut !== "annulee" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-accent bg-accent/15 px-2.5 text-xs font-semibold shadow-none hover:bg-accent/30"
                  onClick={() => setEiFacture(f)}
                >
                  <FileCode2 className="size-3.5" aria-hidden="true" />
                  {libelleBoutonEi(f)}
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 shadow-none" onClick={() => imprimer(f)} aria-label="Imprimer" title="Imprimer / PDF">
                <Printer className="size-3.5" aria-hidden="true" />
              </Button>
            </span>
            <LedgerRowMenu actions={actionsLigne(f)} />
          </div>
        );
      },
      meta: { headerClassName: "w-[190px]", cellClassName: "w-[190px]" },
    },
  ];

  const pageSize = useOperationalPageSize(10);
  const table = useDataTable({
    columns: colonnes,
    data: filtered,
    getRowId: (f) => f.id,
    initialSorting: [{ id: "dateEmission", desc: true }],
    pageSize,
    resetKey: `${recherche}\u0000${statut}\u0000${filtreEi}\u0000${retardSeul}`,
  });

  const nbFiltres = (statut !== "all" ? 1 : 0) + (filtreEi !== "all" ? 1 : 0) + (retardSeul ? 1 : 0);
  const emptyMessage = list.length === 0 ? "Aucune facture : créez une facture d'honoraires (client, lignes, TVA, timbre fiscal)." : "Aucune facture ne correspond à votre recherche ou à vos filtres.";
  const chargement = loading && list.length === 0;

  const rechercheFiltres = (className?: string) => (
    <LedgerSearchFilter
      value={recherche}
      onValueChange={setRecherche}
      placeholder="Rechercher un client ou un n° de facture"
      searchLabel="Rechercher une facture"
      filterLabel="Filtrer les factures"
      filterButtonText="Filtres"
      activeFilterCount={nbFiltres}
      onReset={() => {
        setStatut("all");
        setFiltreEi("all");
        setRetardSeul(false);
      }}
      className={className}
    >
      <FiltresFactures statut={statut} einvoice={filtreEi} retardSeul={retardSeul} onStatut={setStatut} onEinvoice={setFiltreEi} onRetard={setRetardSeul} />
    </LedgerSearchFilter>
  );

  return (
    <OperationalLedgerPage className={cn("societes-ledger-page flex-1", "ledger-fab-clearance lg:pb-0", selection.length > 0 && "ledger-selection-clearance lg:pb-0")}>
      <SignatureLedgerBanner
        icon={FileText}
        className="operational-signature-banner mb-0"
        eyebrow="Comptabilité · Honoraires"
        title="Facturation"
        description={
          societeActive
            ? `Factures de ${societeActive.raisonSociale} : émission, échéance, paiement et facture électronique signée.`
            : "Factures d'honoraires du cabinet : émission, échéance, paiement et facture électronique signée."
        }
        metrics={[
          { label: portee.length > 1 ? "Factures" : "Facture", icon: FileText, value: portee.length, loading, onSelect: () => { setStatut("all"); setRetardSeul(false); setFiltreEi("all"); }, active: statut === "all" && !retardSeul && filtreEi === "all" },
          { label: "Facturé", icon: Wallet, value: formatTnd(facture), loading },
          { label: "Encaissé", icon: CheckCircle2, value: formatTnd(encaisse), tone: "success", loading, onSelect: () => { setStatut("payee"); setRetardSeul(false); }, active: statut === "payee" },
          { label: "En retard", icon: AlertCircle, value: nbRetard, tone: nbRetard > 0 ? "warning" : "default", loading, onSelect: () => { setStatut("all"); setRetardSeul(true); }, active: retardSeul },
          { label: "À signer", icon: FileKey2, value: nbASigner, tone: nbASigner > 0 ? "warning" : "default", loading, onSelect: () => { setFiltreEi("prete"); }, active: filtreEi === "prete" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="signature-ledger__action" onClick={() => setCabinetOpen(true)}>
              <Settings2 className="h-4 w-4" />
              Cabinet
            </Button>
            <Button variant="outline" className="signature-ledger__action" onClick={() => setSignatureOpen(true)}>
              <FileKey2 className="h-4 w-4" />
              Signature
            </Button>
            <Button variant="ledger" onClick={() => ouvrirFormulaire("nouvelle")}>
              <Plus className="h-4 w-4" />
              Nouvelle facture
            </Button>
          </div>
        }
      />

      <LedgerWorkSurface className="societes-ledger-surface">
        {selection.length === 0 && (
          <OperationalLedgerToolbar
            label="Outils du registre des factures"
            search={rechercheFiltres("max-w-none")}
            resultCount={!chargement ? `${filtered.length} facture${filtered.length > 1 ? "s" : ""} · ${formatTnd(totalAffiche)} TND` : undefined}
            tools={<OutilsListe table={table} onExport={exporter} onPrint={imprimerListe} />}
          />
        )}

        <OperationalMobileUtility label="Recherche et filtres du registre des factures">{rechercheFiltres()}</OperationalMobileUtility>

        <div className="societes-ledger-register">
          <OperationalMobileHeader>
            <div className="min-w-0 flex-1">
              <h2>
                <DataTableColumnHeader column={table.getColumn("client")!} title="Registre des factures" className="h-7 text-[11px] font-bold uppercase tracking-[0.12em] text-primary" />
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <OutilsListe table={table} onExport={exporter} onPrint={imprimerListe} />
            </div>
          </OperationalMobileHeader>

          {selection.length > 0 && (
            <div className="ledger-selection-strip flex items-center justify-between gap-4 px-3 py-1.5">
              <span className="text-sm font-semibold">
                {selection.length} facture{selection.length > 1 ? "s" : ""} sélectionnée{selection.length > 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" className="text-primary hover:bg-primary/5 hover:text-primary" onClick={() => exporter("xlsx")}>
                  Exporter
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-primary hover:bg-primary/5 hover:text-primary" onClick={() => setSelection([])}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          <DataTable
            className="ledger-work-table societes-ledger-table facturation-ledger-table bg-transparent [&>div:last-child]:space-y-0"
            desktopDensity="ledger"
            desktopVariant="register"
            showSelectionHeader
            table={table}
            emptyMessage={emptyMessage}
            isLoading={chargement}
            footer={<OperationalLedgerFooter table={table} itemLabel="factures" />}
            getRowClassName={(row) => cn(`ledger-row--${statutAffiche(row.original).cle}`, selection.includes(row.original.id) && "bg-accent/[0.14] hover:bg-accent/[0.18]")}
            getRowAriaLabel={(row) => `Facture ${row.original.numero} de ${row.original.societeNom}`}
            onRowClick={(row) => row.original.statut !== "annulee" && setEiFacture(row.original)}
            mobileRow={(row) => {
              const f = row.original;
              return (
                <article className="relative min-w-0 border-b border-border/80 px-3 py-3 sm:px-1">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold tracking-wide", tonMonogramme(f.societeId))} aria-hidden>
                      {initialesClient(f.societeNom)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("break-words text-sm font-semibold text-foreground", f.statut === "annulee" && "line-through")}>{f.societeNom}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {f.numero} · {formatDate(f.dateEmission)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <LedgerRowMenu actions={[...(f.statut !== "annulee" ? [{ icon: FileCode2, label: `${libelleBoutonEi(f)} la facture électronique`, onClick: () => setEiFacture(f) }] : []), ...actionsLigne(f)]} />
                    </div>
                  </div>
                  <div className="mt-2 flex min-w-0 items-center justify-between gap-3 pl-[42px] text-xs text-muted-foreground">
                    <span className="font-bold tabular-nums text-primary">{formatTnd(f.netAPayer)} TND</span>
                    <StatutFacture facture={f} />
                  </div>
                </article>
              );
            }}
          />
          {!chargement && filtered.length > 0 && <OperationalMobilePagination table={table} itemLabel="factures" />}
        </div>
      </LedgerWorkSurface>

      <OperationalFab label="Nouvelle facture" onClick={() => ouvrirFormulaire("nouvelle")} />

      <FactureFormSheet open={formOpen} onOpenChange={setFormOpen} onSubmit={generer} defaultSocieteId={societeActive?.id ?? ""} source={formSource} mode={formMode} />
      <FactureElectroniqueDialog
        facture={eiFacture}
        onOpenChange={(o) => !o && setEiFacture(null)}
        onOpenCabinet={() => {
          setEiFacture(null);
          setCabinetOpen(true);
        }}
        onOpenSignature={() => {
          setEiFacture(null);
          setSignatureOpen(true);
        }}
      />
      <SignatureElectroniqueDialog open={signatureOpen} onOpenChange={setSignatureOpen} />
      <CabinetInfoDialog
        open={cabinetOpen}
        onOpenChange={setCabinetOpen}
        cabinet={cabinet}
        onSave={async (data) => {
          await saveCabinet(data);
          toast.success("Informations du cabinet enregistrées");
        }}
      />

      <ConfirmDialog
        open={Boolean(aAnnuler)}
        onOpenChange={(o) => !o && setAAnnuler(null)}
        title="Annuler cette facture ?"
        description={
          <>
            La facture <span className="font-medium text-foreground">{aAnnuler?.numero}</span> sera marquée annulée. Son numéro reste utilisé et elle ne pourra plus être modifiée.
          </>
        }
        confirmLabel="Annuler la facture"
        onConfirm={async () => {
          if (aAnnuler) {
            await update(aAnnuler.id, { statut: "annulee" });
            toast.success(`Facture ${aAnnuler.numero} annulée`);
          }
          setAAnnuler(null);
        }}
      />
    </OperationalLedgerPage>
  );
}
