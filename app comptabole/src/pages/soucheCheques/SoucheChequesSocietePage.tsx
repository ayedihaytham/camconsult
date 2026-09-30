import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Pencil,
  Printer,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import {
  LedgerWorkSurface,
  OperationalContentHeader,
  OperationalLedgerToolbar,
  OperationalMobileUtility,
} from "@/components/ledger/OperationalLedgerLayout";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { AmountInput } from "@/components/common/AmountInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportSoucheChequesStyled } from "@/lib/soucheCheques/exportStyled";
import {
  chequesEnAttente,
  DEVISES,
  fmtDate,
  fmtMontant,
  joursDepuis,
  SEUIL_ATTENTE_JOURS,
  totauxParBanque,
  totauxParDevise,
} from "@/lib/soucheCheques/model";
import { buildSouchePdf } from "@/lib/soucheCheques/pdf";
import { cn } from "@/lib/utils";
import { useSocieteById } from "@/store/data";
import { useSoucheCheques, type SoucheChequeInput } from "@/store/soucheCheques";
import type { SoucheCheque, SoucheChequeDevise } from "@/types";
import { SoucheChequeImportDialog } from "./SoucheChequeImportDialog";

type Vue = "tous" | "a_debiter" | "debites";

const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const emptyDraft = (): SoucheChequeInput => ({
  banque: "",
  numCheque: "",
  dateEmission: todayIso(),
  beneficiaire: "",
  motif: "",
  montant: 0,
  devise: "TND",
  debite: false,
  dateDebit: null,
});

const draftFrom = (l: SoucheCheque): SoucheChequeInput => ({
  banque: l.banque,
  numCheque: l.numCheque,
  dateEmission: l.dateEmission,
  beneficiaire: l.beneficiaire,
  motif: l.motif,
  montant: l.montant,
  devise: l.devise,
  debite: l.debite,
  dateDebit: l.dateDebit,
});

const inputCls = "h-8 px-2 text-[13px]";

/** Ligne éditable en place — nouveau chèque (sous la dernière ligne) ou
 * modification d'une ligne existante, comme le tableau de Collecte de pièces
 * (pas de fiche à droite). */
function EditableRow({
  draft,
  banques,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  draft: SoucheChequeInput;
  banques: string[];
  saving: boolean;
  onChange: <K extends keyof SoucheChequeInput>(key: K, value: SoucheChequeInput[K]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <TableRow className="!bg-primary/[0.04] hover:!bg-primary/[0.04]">
      <TableCell className="px-1 py-1.5">
        <Input
          list="souche-banques-inline"
          className={inputCls}
          value={draft.banque}
          onChange={(e) => onChange("banque", e.target.value)}
          placeholder="Banque"
        />
        <datalist id="souche-banques-inline">
          {banques.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </TableCell>
      <TableCell className="px-1 py-1.5">
        <Input
          className={cn(inputCls, "font-mono")}
          value={draft.numCheque}
          onChange={(e) => onChange("numCheque", e.target.value)}
          placeholder="N°"
          autoFocus
        />
      </TableCell>
      <TableCell className="px-1 py-1.5">
        <Input
          type="date"
          className={inputCls}
          value={draft.dateEmission ?? ""}
          onChange={(e) => onChange("dateEmission", e.target.value || null)}
        />
      </TableCell>
      <TableCell className="px-1 py-1.5">
        <Input
          className={inputCls}
          value={draft.beneficiaire}
          onChange={(e) => onChange("beneficiaire", e.target.value)}
          placeholder="Bénéficiaire"
        />
      </TableCell>
      <TableCell className="px-1 py-1.5">
        <Input
          className={inputCls}
          value={draft.motif}
          onChange={(e) => onChange("motif", e.target.value)}
          placeholder="Motif / description"
        />
      </TableCell>
      <TableCell className="px-1 py-1.5">
        <div className="flex items-center gap-1">
          <AmountInput
            value={draft.montant}
            onValueChange={(n) => onChange("montant", n)}
            allowNegative={false}
            className={cn(inputCls, "w-20 text-right tabular-nums")}
          />
          <Select value={draft.devise} onValueChange={(d) => onChange("devise", d as SoucheChequeDevise)}>
            <SelectTrigger className={cn(inputCls, "w-[4.2rem] shrink-0")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEVISES.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TableCell>
      <TableCell className="px-1 py-1.5">
        <Select
          value={draft.debite ? "oui" : "non"}
          onValueChange={(v) => onChange("debite", v === "oui")}
        >
          <SelectTrigger className={cn(inputCls, "w-20")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="non">Non</SelectItem>
            <SelectItem value="oui">Oui</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="px-1 py-1.5">
        <Input
          type="date"
          className={inputCls}
          disabled={!draft.debite}
          value={draft.dateDebit ?? ""}
          onChange={(e) => onChange("dateDebit", e.target.value || null)}
        />
      </TableCell>
      <TableCell className="px-1 py-1.5">
        <div className="flex gap-0.5">
          <button
            aria-label="Enregistrer"
            disabled={saving}
            onClick={onSave}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-success transition-colors hover:bg-success/10 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            aria-label="Annuler"
            disabled={saving}
            onClick={onCancel}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function SoucheChequesSocietePage() {
  const { societeId = "" } = useParams();
  const societe = useSocieteById(societeId);
  const societeNom = societe?.raisonSociale ?? "Société";

  const list = useSoucheCheques((s) => s.list);
  const loading = useSoucheCheques((s) => s.loading);
  const fetchList = useSoucheCheques((s) => s.fetchList);
  const clear = useSoucheCheques((s) => s.clear);
  const create = useSoucheCheques((s) => s.create);
  const update = useSoucheCheques((s) => s.update);
  const remove = useSoucheCheques((s) => s.remove);

  const [vue, setVue] = useState<Vue>("tous");
  const [recherche, setRecherche] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [toDelete, setToDelete] = useState<SoucheCheque | null>(null);
  const [busy, setBusy] = useState<"pdf" | "print" | "xlsx" | null>(null);

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<SoucheChequeInput>(emptyDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchList(societeId).catch(() => {});
    return () => clear();
  }, [societeId, fetchList, clear]);

  const totaux = useMemo(() => totauxParDevise(list), [list]);
  const parBanque = useMemo(() => totauxParBanque(list), [list]);
  const nbBanques = useMemo(
    () => new Set(list.map((l) => l.banque || "Sans banque")).size,
    [list],
  );
  const enAttente = useMemo(() => chequesEnAttente(list), [list]);
  const banques = useMemo(
    () => [...new Set(list.map((l) => l.banque).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [list],
  );
  const nbADebiter = list.filter((l) => !l.debite).length;

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return list.filter((l) => {
      if (vue === "a_debiter" && l.debite) return false;
      if (vue === "debites" && !l.debite) return false;
      if (!q) return true;
      return [l.banque, l.numCheque, l.beneficiaire, l.motif].some((t) => t.toLowerCase().includes(q));
    });
  }, [list, vue, recherche]);

  async function exportPdf() {
    setBusy("pdf");
    try {
      // On exporte ce qui est affiché (filtres compris) : totaux cohérents avec le tableau.
      const { doc, fileName } = await buildSouchePdf(visibles, societeNom);
      doc.save(fileName);
    } catch {
      toast.error("PDF impossible");
    } finally {
      setBusy(null);
    }
  }

  // Ouvre le PDF dans un onglet avec la boîte d'impression. La fenêtre est
  // ouverte tout de suite (avant la génération, asynchrone) pour ne pas être
  // bloquée comme popup ; si elle l'est quand même, on enregistre le PDF.
  async function imprimer() {
    setBusy("print");
    const w = window.open("", "_blank");
    try {
      const { doc, fileName } = await buildSouchePdf(visibles, societeNom);
      if (!w) {
        doc.save(fileName);
        toast.info("Fenêtre d'impression bloquée : le PDF a été téléchargé.");
        return;
      }
      doc.autoPrint();
      // jsPDF type `output("bloburl")` en URL mais renvoie bien une chaîne
      w.location.href = doc.output("bloburl") as unknown as string;
    } catch {
      w?.close();
      toast.error("Impression impossible");
    } finally {
      setBusy(null);
    }
  }

  async function exportExcel() {
    setBusy("xlsx");
    try {
      await exportSoucheChequesStyled(visibles, societeNom);
    } catch {
      toast.error("Export Excel impossible");
    } finally {
      setBusy(null);
    }
  }

  function startNew() {
    setDraft(emptyDraft());
    setEditingId("new");
  }
  function startEdit(l: SoucheCheque) {
    setDraft(draftFrom(l));
    setEditingId(l.id);
  }
  function cancelEdit() {
    setEditingId(null);
  }
  function changeDraft<K extends keyof SoucheChequeInput>(key: K, value: SoucheChequeInput[K]) {
    setDraft((d) => {
      if (key === "debite") {
        const debite = value as boolean;
        return { ...d, debite, dateDebit: debite ? d.dateDebit || todayIso() : null };
      }
      return { ...d, [key]: value };
    });
  }

  async function saveDraft() {
    if (!draft.numCheque.trim()) {
      toast.error("Le n° de chèque est obligatoire.");
      return;
    }
    if (!(draft.montant > 0)) {
      toast.error("Saisissez le montant du chèque.");
      return;
    }
    setSaving(true);
    try {
      if (editingId === "new") {
        await create(societeId, draft);
        toast.success("Chèque ajouté");
      } else if (editingId) {
        await update(editingId, draft);
        toast.success("Chèque modifié");
      }
      setEditingId(null);
    } catch {
      // erreur déjà affichée par le store — on garde la saisie
    } finally {
      setSaving(false);
    }
  }

  async function marquerDebite(l: SoucheCheque) {
    try {
      await update(l.id, { ...draftFrom(l), debite: true, dateDebit: todayIso() });
      toast.success(`Chèque ${l.numCheque} marqué débité`);
    } catch {
      // erreur déjà affichée par le store
    }
  }

  const isEditing = editingId !== null;
  const showTable = visibles.length > 0 || editingId === "new";
  const busyAny = busy !== null;

  return (
    <div className="min-w-0">
      <h1 className="sr-only">{`Souche de chèques — ${societeNom}`}</h1>

      <SignatureLedgerBanner
        icon={FileText}
        className="mb-0 sm:mb-2"
        eyebrow="Comptabilité · Financial Ledger"
        title={societeNom}
        description="Chèques émis, montants et statut de débit — le reste à débiter est calculé par devise (TND, EUR, USD)."
        metrics={[
          { label: "Chèques", value: list.length },
          { label: "À débiter", value: nbADebiter, tone: nbADebiter > 0 ? "warning" : "default" },
          { label: "En attente (> 30 j)", value: enAttente.length, tone: enAttente.length > 0 ? "destructive" : "default" },
        ]}
        action={{ label: "Nouveau chèque", onClick: startNew }}
      />

      {totaux.length > 0 && (
        <dl className="mt-3 grid grid-cols-1 divide-y divide-border border-y border-border bg-muted/35 sm:grid-cols-2 lg:grid-cols-4 sm:divide-x sm:divide-y-0">
          {totaux.map((t) => (
            <div key={t.devise} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">
                Reste à débiter ({t.devise})
                <span className="block text-[0.65rem]">
                  {t.nb} chèque(s) · moyenne {fmtMontant(t.moyenEmis)}
                </span>
              </dt>
              <dd className={cn("font-mono text-sm font-semibold tabular-nums", t.restant > 0.0005 ? "text-warning" : "text-foreground")}>
                {fmtMontant(t.restant)}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">
              Chèques en attente
              <span className="block text-[0.65rem]">Émis depuis plus de {SEUIL_ATTENTE_JOURS} jours</span>
            </dt>
            <dd className={cn("font-mono text-sm font-semibold tabular-nums", enAttente.length > 0 ? "text-warning" : "text-foreground")}>
              {enAttente.length}
            </dd>
          </div>
        </dl>
      )}

      {nbBanques > 1 && (
        <div className="mt-3 min-w-0">
          <p className="mb-1 text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
            Reste à débiter par banque
          </p>
          <div className="overflow-visible border-y border-border/80 bg-transparent">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Banque</TableHead>
                  <TableHead>Devise</TableHead>
                  <TableHead className="text-right">Émis</TableHead>
                  <TableHead className="text-right">Débité</TableHead>
                  <TableHead className="text-right">Reste à débiter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parBanque.map((t) => (
                  <TableRow key={`${t.banque}-${t.devise}`}>
                    <TableCell className="text-foreground">{t.banque}</TableCell>
                    <TableCell className="text-muted-foreground">{t.devise}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {fmtMontant(t.emis)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {fmtMontant(t.debite)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-right font-semibold tabular-nums",
                        t.restant > 0.0005 && "text-destructive",
                      )}
                    >
                      {fmtMontant(t.restant)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <LedgerWorkSurface className="mt-3">
        <div className="px-3">
          <LedgerSegmented<Vue>
            value={vue}
            onChange={setVue}
            ariaLabel="Filtrer par statut"
            options={[
              { value: "tous", label: `Tous (${list.length})` },
              { value: "a_debiter", label: `À débiter (${nbADebiter})` },
              { value: "debites", label: `Débités (${list.length - nbADebiter})` },
            ]}
          />
        </div>
        <OperationalLedgerToolbar
          label="Recherche des chèques"
          search={
            <Input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher (n°, bénéficiaire, banque, motif)…"
              className="h-9"
            />
          }
          tools={
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Importer
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={busyAny || list.length === 0}>
                    Outils
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void exportPdf()}>
                    <FileText className="h-4 w-4" /> Enregistrer PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportExcel()}>
                    <Download className="h-4 w-4" /> Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void imprimer()}>
                    <Printer className="h-4 w-4" /> Imprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
        <OperationalMobileUtility label="Recherche des chèques">
          <div className="flex flex-col gap-2">
            <Input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher (n°, bénéficiaire, banque, motif)…"
              className="h-9"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Importer
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1" disabled={busyAny || list.length === 0}>
                    Outils
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void exportPdf()}>
                    <FileText className="h-4 w-4" /> Enregistrer PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportExcel()}>
                    <Download className="h-4 w-4" /> Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void imprimer()}>
                    <Printer className="h-4 w-4" /> Imprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </OperationalMobileUtility>
        <OperationalContentHeader>
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.11em] text-primary">Registre des chèques</h2>
            <p className="hidden truncate text-[11px] text-muted-foreground md:block">Banque, montant et statut de débit</p>
          </div>
          {!loading && <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">{visibles.length} chèque{visibles.length === 1 ? "" : "s"} visible{visibles.length === 1 ? "" : "s"}</span>}
        </OperationalContentHeader>

        {!showTable ? (
          <div className="border-b border-border/80 px-4 py-5">
            <p className="text-sm text-muted-foreground">
              {loading ? "Chargement…" : list.length === 0 ? "Aucun chèque." : "Aucun chèque ne correspond à ce filtre."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Banque</TableHead>
                  <TableHead>N° chèque</TableHead>
                  <TableHead>Émission</TableHead>
                  <TableHead>Bénéficiaire</TableHead>
                  <TableHead>Motif / Description</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Débité</TableHead>
                  <TableHead>Date de débit</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((l) => {
                  const jours = joursDepuis(l.dateEmission);
                  const attente = !l.debite && jours !== null && jours > SEUIL_ATTENTE_JOURS;
                  return l.id === editingId ? (
                    <EditableRow
                      key={l.id}
                      draft={draft}
                      banques={banques}
                      saving={saving}
                      onChange={changeDraft}
                      onSave={saveDraft}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <TableRow key={l.id} className={cn(isEditing && "opacity-60")}>
                      <TableCell className="text-foreground">{l.banque || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.numCheque || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {fmtDate(l.dateEmission) || "—"}
                        {!l.debite && jours !== null && (
                          <span className={cn("ml-1.5 text-[11px]", attente ? "font-semibold text-amber-600" : "text-muted-foreground/70")}>
                            · {jours} j
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground">{l.beneficiaire || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{l.motif || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                        {fmtMontant(l.montant)} <span className="text-xs font-normal text-muted-foreground">{l.devise}</span>
                      </TableCell>
                      <TableCell>
                        {l.debite ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Oui
                          </span>
                        ) : (
                          <button
                            title={
                              attente
                                ? `Émis il y a ${jours} jours, toujours non débité — marquer comme débité aujourd'hui`
                                : "Marquer comme débité aujourd'hui"
                            }
                            disabled={isEditing}
                            onClick={() => marquerDebite(l)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-xs transition-colors hover:border-success hover:text-success disabled:pointer-events-none",
                              attente
                                ? "border-amber-300 bg-amber-50 text-amber-700"
                                : "border-border text-muted-foreground",
                            )}
                          >
                            Non · marquer débité
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {fmtDate(l.dateDebit) || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <button
                            aria-label="Modifier"
                            disabled={isEditing}
                            onClick={() => startEdit(l)}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            aria-label="Supprimer"
                            disabled={isEditing}
                            onClick={() => setToDelete(l)}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {editingId === "new" && (
                  <EditableRow
                    draft={draft}
                    banques={banques}
                    saving={saving}
                    onChange={changeDraft}
                    onSave={saveDraft}
                    onCancel={cancelEdit}
                  />
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {showTable && (
          <div className="operational-ledger-footer">
            {visibles.length} chèque{visibles.length === 1 ? "" : "s"}
          </div>
        )}
      </LedgerWorkSurface>

      <SoucheChequeImportDialog open={importOpen} onOpenChange={setImportOpen} societeId={societeId} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer ce chèque ?"
        description={
          toDelete
            ? `Le chèque n° ${toDelete.numCheque || "—"} (${toDelete.beneficiaire || "sans bénéficiaire"}) sera définitivement supprimé de la souche.`
            : ""
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) remove(toDelete.id).catch(() => {});
          setToDelete(null);
        }}
      />
    </div>
  );
}
