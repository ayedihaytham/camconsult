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
  Eye,
  FileCode2,
  FileDown,
  FileKey2,
  FileText,
  MoreHorizontal,
  Network,
  Pencil,
  PenLine,
  Plus,
  Printer,
  Send,
  RotateCcw,
  Settings2,
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
import { telechargerFacturePdf } from "@/lib/facturePdf";
import { printTable } from "@/lib/print";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { cn, formatDate } from "@/lib/utils";
import { useFacturation, type FactureInput } from "@/store/facturation";
import { FACTURE_STATUT_LABELS, type Facture, type FactureStatut } from "@/types";
import { CabinetInfoDialog } from "./CabinetInfoDialog";
import { FactureElectroniqueDialog } from "./FactureElectroniqueDialog";
import { SignatureElectroniqueDialog } from "./SignatureElectroniqueDialog";
import { EinvoiceProgression } from "./EinvoiceProgression";
import { FactureDetailSheet } from "./FactureDetailSheet";
import { FacturationMiseEnRoute } from "./FacturationMiseEnRoute";
import { JOURS_AVANT_EXPIRATION, etapesMiseEnRoute, joursRestants, type CibleEtape } from "./miseEnRoute";
import { TtnConnexionDialog } from "./TtnConnexionDialog";
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

type FiltreEinvoice = "all" | "traiter" | "aucune" | "prete" | "signee" | "deposee" | "validee" | "rejetee";

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
            <SelectItem value="traiter">À traiter (à signer, à déposer, rejetées)</SelectItem>
            <SelectItem value="aucune">Non préparées</SelectItem>
            <SelectItem value="prete">Préparées, à signer</SelectItem>
            <SelectItem value="signee">Signées, à déposer</SelectItem>
            <SelectItem value="deposee">Déposées chez TTN</SelectItem>
            <SelectItem value="validee">Validées par TTN</SelectItem>
            <SelectItem value="rejetee">Rejetées par TTN</SelectItem>
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
  const signature = useFacturation((s) => s.signature);
  const fetchSignature = useFacturation((s) => s.fetchSignature);
  const ttn = useFacturation((s) => s.ttn);
  const fetchTtn = useFacturation((s) => s.fetchTtn);
  const testerTtn = useFacturation((s) => s.testerTtn);
  const signer = useFacturation((s) => s.signer);
  const deposer = useFacturation((s) => s.deposer);

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
  const [ttnOpen, setTtnOpen] = useState(false);
  const [detail, setDetail] = useState<Facture | null>(null);
  const [confirmerLot, setConfirmerLot] = useState<"signer" | "deposer" | null>(null);
  const [lotEnCours, setLotEnCours] = useState<"signer" | "deposer" | null>(null);
  const [essai, setEssai] = useState<CibleEtape | null>(null);

  useEffect(() => {
    fetchList();
    fetchCabinet();
    // État du certificat et des accès TTN : alimente la liste de mise en route et les badges du bandeau.
    fetchSignature().catch(() => undefined);
    fetchTtn().catch(() => undefined);
  }, [fetchList, fetchCabinet, fetchSignature, fetchTtn]);

  const filtered = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase("fr");
    return list.filter((f) => {
      if (societeActive && f.societeId !== societeActive.id) return false;
      if (statut !== "all" && f.statut !== statut) return false;
      if (retardSeul && !estEnRetard(f)) return false;
      const ei = f.einvoice?.statut;
      if (filtreEi === "aucune" && ei) return false;
      if (filtreEi === "traiter" && !(ei === "prete" || ei === "signee" || ei === "rejetee")) return false;
      if (["prete", "signee", "deposee", "validee", "rejetee"].includes(filtreEi) && ei !== filtreEi) return false;
      if (f.statut === "annulee" && filtreEi !== "all" && filtreEi !== "aucune") return false;
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
  const nbATraiter = portee.filter((f) => f.statut !== "annulee" && ["prete", "signee", "rejetee"].includes(f.einvoice?.statut ?? "")).length;
  const totalAffiche = filtered.filter((f) => f.statut !== "annulee").reduce((s, f) => s + f.netAPayer, 0);

  // Pastilles de filtre rapide : raccourcis vers les trois filtres existants (statut, e-facture, retard).
  const compteEi = (e: string) => portee.filter((f) => f.statut !== "annulee" && f.einvoice?.statut === e).length;
  const pastilles: { id: string; label: string; n: number; alerte: boolean }[] = [
    { id: "all", label: "Toutes", n: portee.length, alerte: false },
    { id: "prete", label: "À signer", n: compteEi("prete"), alerte: true },
    { id: "signee", label: "À déposer", n: compteEi("signee"), alerte: true },
    { id: "deposee", label: "Déposées", n: compteEi("deposee"), alerte: false },
    { id: "rejetee", label: "Rejetées", n: compteEi("rejetee"), alerte: true },
    { id: "retard", label: "En retard", n: nbRetard, alerte: true },
    { id: "impayees", label: "Impayées", n: portee.filter((f) => f.statut === "emise").length, alerte: false },
  ];
  const FILTRES_EI = ["prete", "signee", "deposee", "rejetee"];
  const pastilleActive =
    statut === "all" && filtreEi === "all" && !retardSeul
      ? "all"
      : statut === "all" && !retardSeul && FILTRES_EI.includes(filtreEi)
        ? filtreEi
        : statut === "all" && retardSeul && filtreEi === "all"
          ? "retard"
          : statut === "emise" && !retardSeul && filtreEi === "all"
            ? "impayees"
            : null;
  function choisirPastille(id: string) {
    setStatut(id === "impayees" ? "emise" : "all");
    setFiltreEi(FILTRES_EI.includes(id) ? (id as FiltreEinvoice) : "all");
    setRetardSeul(id === "retard");
  }

  // Liste de mise en route et badges d'alerte du bandeau (certificat bientôt expiré, environnement TTN).
  const etapes = useMemo(() => etapesMiseEnRoute({ cabinet, signature, ttn }), [cabinet, signature, ttn]);
  const joursCertificat = signature?.certificat && !signature.certificat.expire ? joursRestants(signature.certificat.validAu) : null;
  const badgeSignature = signature?.certificat?.expire
    ? { texte: "expiré", classe: "bg-destructive text-destructive-foreground" }
    : joursCertificat !== null && joursCertificat <= JOURS_AVANT_EXPIRATION
      ? { texte: `expire dans ${joursCertificat} j`, classe: "bg-warning text-warning-foreground" }
      : null;
  const badgeTtn = ttn?.connexion ? (ttn.connexion.environnement === "reel" ? { texte: "réel", classe: "bg-primary-foreground/20 text-primary-foreground" } : { texte: "test", classe: "bg-warning text-warning-foreground" }) : null;

  async function actionEtape(cible: CibleEtape) {
    if (cible === "cabinet") return setCabinetOpen(true);
    if (cible === "signature") return setSignatureOpen(true);
    if (cible === "ttn") return setTtnOpen(true);
    setEssai("tester");
    try {
      await testerTtn();
      toast.success("Connexion TTN réussie");
    } catch {
      // Message déjà affiché par le magasin ; l'échec est mémorisé côté serveur et relu ci-dessous.
    } finally {
      await fetchTtn().catch(() => undefined);
      setEssai(null);
    }
  }

  // Actions groupées : seules les factures dans le bon état sont traitées (préparée → signer, signée → déposer).
  const ciblesLot = (type: "signer" | "deposer") => list.filter((f) => selection.includes(f.id) && f.statut !== "annulee" && f.einvoice?.statut === (type === "signer" ? "prete" : "signee"));
  const nbASigner = ciblesLot("signer").length;
  const nbADeposer = ciblesLot("deposer").length;

  async function executerLot(type: "signer" | "deposer") {
    const cibles = ciblesLot(type);
    if (!cibles.length) return;
    if (type === "signer" && !signature?.deverrouille) {
      toast.error("La signature est verrouillée : déverrouillez-la d'abord (bouton Signature).");
      setSignatureOpen(true);
      return;
    }
    if (type === "deposer" && !ttn?.connexion) {
      toast.error("Enregistrez d'abord les accès TTN.");
      setTtnOpen(true);
      return;
    }
    setLotEnCours(type);
    let ok = 0;
    const echecs: string[] = [];
    for (const f of cibles) {
      try {
        await (type === "signer" ? signer(f.id) : deposer(f.id));
        ok++;
      } catch {
        echecs.push(f.numero); // le magasin a déjà affiché la raison de cet échec
      }
    }
    setLotEnCours(null);
    if (ok) toast.success(`${ok} facture${ok > 1 ? "s" : ""} ${type === "signer" ? "signée" : "déposée"}${ok > 1 ? "s" : ""}${type === "deposer" ? " chez TTN" : ""}`);
    if (echecs.length) toast.error(`${echecs.length} facture${echecs.length > 1 ? "s" : ""} en échec : ${echecs.join(", ")}`);
  }

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

  /** Télécharge le PDF de la facture (vrai fichier, sans fenêtre d'impression). */
  async function telechargerPdf(f: Facture, silencieux = false) {
    try {
      await telechargerFacturePdf(f, cabinet);
      if (!silencieux) toast.success(`PDF de la facture ${f.numero} téléchargé`);
      return true;
    } catch {
      toast.error(`Le PDF de la facture ${f.numero} n'a pas pu être généré`);
      return false;
    }
  }

  /** PDF de toutes les factures sélectionnées (20 au plus, l'un après l'autre : le navigateur peut demander d'autoriser les téléchargements multiples). */
  async function telechargerSelectionPdf() {
    const lignes = list.filter((f) => selection.includes(f.id)).slice(0, 20);
    if (!lignes.length) return;
    let ok = 0;
    for (const f of lignes) {
      if (await telechargerPdf(f, true)) ok++;
      await new Promise((r) => setTimeout(r, 300));
    }
    if (ok) toast.success(`${ok} PDF téléchargé${ok > 1 ? "s" : ""}${selection.length > 20 ? " (20 au maximum à la fois)" : ""}`);
  }

  function imprimer(f: Facture) {
    if (!imprimerFacture(f, cabinet)) toast.error("Autorisez les fenêtres pop-up pour imprimer la facture");
  }

  const actionsLigne = (f: Facture): RowAction[] => {
    const copier: RowAction = { icon: Copy, label: "Dupliquer", onClick: () => ouvrirFormulaire("copie", f) };
    if (f.statut === "annulee") return [{ icon: Eye, label: "Voir le détail", onClick: () => setDetail(f) }, { icon: Printer, label: "Imprimer", onClick: () => imprimer(f) }, { icon: FileDown, label: "Télécharger le PDF", onClick: () => void telechargerPdf(f) }, copier];
    const ei = f.einvoice?.statut;
    const actions: RowAction[] = [{ icon: Eye, label: "Voir le détail", onClick: () => setDetail(f) }, { icon: Printer, label: "Imprimer", onClick: () => imprimer(f) }, { icon: FileDown, label: "Télécharger le PDF", onClick: () => void telechargerPdf(f) }];
    if (modifiable(f)) actions.push({ icon: Pencil, label: "Modifier", onClick: () => ouvrirFormulaire("modification", f) });
    actions.push(copier);
    if (ei === "signee" || ei === "deposee" || ei === "validee" || ei === "rejetee")
      actions.push({ icon: Download, label: "Télécharger le XML signé", onClick: () => void telechargerXml(f.id, f.numero, "signe").catch(() => undefined) });
    if (ei === "validee") actions.push({ icon: Download, label: "Télécharger le XML validé TTN", onClick: () => void telechargerXml(f.id, f.numero, "ttn").catch(() => undefined) });
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
    return ei === "deposee" || ei === "validee" ? "Voir" : ei === "signee" ? "Déposer" : ei === "rejetee" ? "Corriger" : ei === "prete" ? "Signer" : "Préparer";
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
      cell: ({ row }) => <span className="text-[13px] font-semibold tabular-nums text-primary">{row.original.numero}</span>,
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Papier" />,
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
      meta: { label: "Signature papier", headerClassName: "w-[108px]" },
    },
    {
      id: "einvoice",
      accessorFn: (f) => libelleEinvoice(f.einvoice?.statut),
      header: ({ column }) => <DataTableColumnHeader column={column} title="E-facture" />,
      cell: ({ row }) => (row.original.statut === "annulee" ? <span className="text-xs text-muted-foreground">—</span> : <EinvoiceProgression statut={row.original.einvoice?.statut} />),
      meta: { label: "Facture électronique", headerClassName: "w-[176px]" },
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
                  className="h-8 min-w-[92px] justify-center gap-1.5 border-accent bg-accent/15 px-2.5 text-xs font-semibold shadow-none hover:bg-accent/30"
                  onClick={() => setEiFacture(f)}
                >
                  <FileCode2 className="size-3.5" aria-hidden="true" />
                  {libelleBoutonEi(f)}
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 shadow-none" onClick={() => imprimer(f)} aria-label="Imprimer" title="Imprimer">
                <Printer className="size-3.5" aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 shadow-none" onClick={() => void telechargerPdf(f)} aria-label="Télécharger le PDF" title="Télécharger le PDF">
                <FileDown className="size-3.5" aria-hidden="true" />
              </Button>
            </span>
            <LedgerRowMenu actions={actionsLigne(f)} />
          </div>
        );
      },
      meta: { headerClassName: "w-[232px]", cellClassName: "w-[232px]" },
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
    // La signature papier est secondaire : colonne masquée au départ, réaffichable par Outils › Colonnes.
    initialColumnVisibility: { signature: false },
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
          { label: "À traiter", icon: FileKey2, value: nbATraiter, tone: nbATraiter > 0 ? "warning" : "default", loading, onSelect: () => { setFiltreEi("traiter"); }, active: filtreEi === "traiter" },
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
              {badgeSignature && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-none", badgeSignature.classe)}>{badgeSignature.texte}</span>}
            </Button>
            <Button variant="outline" className="signature-ledger__action" onClick={() => setTtnOpen(true)}>
              <Network className="h-4 w-4" />
              TTN
              {badgeTtn && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-none", badgeTtn.classe)}>{badgeTtn.texte}</span>}
            </Button>
            <Button variant="ledger" onClick={() => ouvrirFormulaire("nouvelle")}>
              <Plus className="h-4 w-4" />
              Nouvelle facture
            </Button>
          </div>
        }
      />

      <FacturationMiseEnRoute etapes={etapes} occupe={essai} onAction={(c) => void actionEtape(c)} />

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

        <div role="group" aria-label="Filtres rapides" className="flex flex-wrap gap-2 border-b border-accent/25 px-3 py-2.5">
          {pastilles.map((c) => {
            const actif = pastilleActive === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={actif}
                onClick={() => choisirPastille(c.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  actif ? "bg-primary text-primary-foreground" : "bg-accent/10 text-primary hover:bg-accent/20",
                )}
              >
                {c.label}
                <span className={cn("tabular-nums", actif ? "opacity-80" : c.alerte && c.n > 0 ? "font-bold text-warning" : "opacity-70")}>{c.n}</span>
              </button>
            );
          })}
        </div>

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
            <div className="ledger-selection-strip flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-1.5">
              <span className="text-sm font-semibold">
                {selection.length} facture{selection.length > 1 ? "s" : ""} sélectionnée{selection.length > 1 ? "s" : ""}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <Button type="button" variant="ghost" size="sm" className="text-primary hover:bg-primary/5 hover:text-primary" disabled={nbASigner === 0 || lotEnCours !== null} onClick={() => setConfirmerLot("signer")}>
                  <PenLine className="mr-1 size-4" aria-hidden="true" /> {lotEnCours === "signer" ? "Signature…" : `Signer (${nbASigner})`}
                </Button>
                <Button type="button" variant="outline" size="sm" className="border-accent bg-accent/20 text-primary shadow-none hover:bg-accent/30" disabled={nbADeposer === 0 || lotEnCours !== null} onClick={() => setConfirmerLot("deposer")}>
                  <Send className="mr-1 size-4" aria-hidden="true" /> {lotEnCours === "deposer" ? "Dépôt…" : `Déposer chez TTN (${nbADeposer})`}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-primary hover:bg-primary/5 hover:text-primary" onClick={() => void telechargerSelectionPdf()}>
                  <FileDown className="mr-1 size-4" aria-hidden="true" /> PDF
                </Button>
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
            onRowClick={(row) => setDetail(row.original)}
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
        onOpenTtn={() => {
          setEiFacture(null);
          setTtnOpen(true);
        }}
      />
      <FactureDetailSheet
        facture={detail}
        cabinet={cabinet}
        onOpenChange={(o) => !o && setDetail(null)}
        onOpenEinvoice={(f) => {
          setDetail(null);
          setEiFacture(f);
        }}
        onTelechargerPdf={(f) => void telechargerPdf(f)}
        onImprimer={imprimer}
      />
      <ConfirmDialog
        open={confirmerLot === "signer"}
        onOpenChange={(o) => !o && setConfirmerLot(null)}
        title={`Signer ${nbASigner} facture${nbASigner > 1 ? "s" : ""} ?`}
        destructive={false}
        description={`Les ${nbASigner} facture${nbASigner > 1 ? "s" : ""} préparée${nbASigner > 1 ? "s" : ""} de la sélection seront signées avec le certificat du cabinet. Une fois signée, une facture ne peut plus être modifiée, régénérée ni annulée ici.${selection.length > nbASigner ? " Les autres factures sélectionnées ne sont pas concernées." : ""}`}
        confirmLabel="Signer"
        onConfirm={async () => {
          setConfirmerLot(null);
          await executerLot("signer");
        }}
      />
      <ConfirmDialog
        open={confirmerLot === "deposer"}
        onOpenChange={(o) => !o && setConfirmerLot(null)}
        title={`Déposer ${nbADeposer} facture${nbADeposer > 1 ? "s" : ""} chez TTN${ttn?.connexion?.environnement === "reel" ? " (RÉEL)" : " (test)"} ?`}
        destructive={false}
        description={
          ttn?.connexion?.environnement === "reel"
            ? `ENVIRONNEMENT RÉEL : le dépôt de ${nbADeposer} facture${nbADeposer > 1 ? "s" : ""} est définitif. Une facture déposée ne peut plus être modifiée ni annulée ici.`
            : `Environnement de TEST : ${nbADeposer} facture${nbADeposer > 1 ? "s sont envoyées" : " est envoyée"} au service de test de TTN. Elles ne peuvent plus être modifiées ici une fois déposées.`
        }
        confirmLabel="Déposer"
        onConfirm={async () => {
          setConfirmerLot(null);
          await executerLot("deposer");
        }}
      />
      <TtnConnexionDialog open={ttnOpen} onOpenChange={setTtnOpen} />
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
