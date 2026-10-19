import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FileText, LoaderCircle, RotateCcw, TriangleAlert, X } from "lucide-react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { download } from "@/lib/export";
import { lireTamponClasseur, messageImport } from "@/lib/fichierImport";
import { texteDepuisFeuilles } from "@/lib/texteBrut";
import { buildTablesPdf, type PdfSheet } from "@/lib/pdfTables";
import { cn } from "@/lib/utils";
import { ZoneDepot } from "./ZoneDepot";
import type { StatsConversion } from "./types";
import { useIdentiteCabinet } from "./useIdentiteCabinet";

type Mode = "pdf" | "both" | "xls";
type Orientation = "auto" | "portrait" | "landscape";
type Format = "a4" | "a3";

interface ConvItem {
  id: string;
  file: File;
  name: string;
  baseName: string;
  status: "cours" | "ok" | "erreur";
  detail: string;
  sheets: PdfSheet[];
  /** Noms des feuilles écartées du PDF. */
  exclues: string[];
}

/** Le PDF s'ouvre sans volet de miniatures, ajusté à la largeur de la zone d'aperçu. */
const PARAMETRES_APERCU = "#navpanes=0&view=FitH";

/** Lit toutes les feuilles d'un classeur Excel — même lecture que ImportBalanceDialog.tsx, mais sur toutes les feuilles. */
async function readSheets(file: File): Promise<PdfSheet[]> {
  const buf = await lireTamponClasseur(file, { formats: ["xlsx", "xls"] });
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((name) => ({
    name,
    headerRow: true,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" }) as (string | number)[][],
  })).filter((sheet) => sheet.rows.some((r) => r.some((v) => v !== "" && v != null)));
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const retenues = (i: ConvItem) => i.sheets.filter((s) => !i.exclues.includes(s.name));

/** Excel vers PDF : lecture locale du classeur, options du PDF, aperçu qui suit les options, téléchargement par fichier ou regroupé. */
export function ExcelVersPdf({ onStats }: { onStats: (s: StatsConversion) => void }) {
  const [items, setItems] = useState<ConvItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [mode, setMode] = useState<Mode>("both");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [format, setFormat] = useState<Format>("a4");
  const [entete, setEntete] = useState(true);
  const [fusion, setFusion] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfErreur, setPdfErreur] = useState(false);
  const occupe = items.some((i) => i.status === "cours");

  const active = items.find((i) => i.id === activeId && i.status === "ok") ?? null;
  const activeSheetData = active ? (active.sheets[Math.min(activeSheet, active.sheets.length - 1)] ?? null) : null;
  const { logo, cabinet } = useIdentiteCabinet();
  const optionsPdf = useMemo(() => ({ orientation, format, entete, logo, cabinet, mention: "Document converti" }), [orientation, format, entete, logo, cabinet]);

  useEffect(() => {
    const ok = items.filter((i) => i.status === "ok");
    onStats({ fichiers: items.length, convertis: ok.length, erreurs: items.filter((i) => i.status === "erreur").length, elements: ok.reduce((n, i) => n + retenues(i).length, 0), libelleElements: "Feuilles" });
  }, [items, onStats]);

  async function fabriquer(entrees: ConvItem[]) {
    const multi = entrees.length > 1;
    const sheets = entrees.flatMap((e) => retenues(e).map((s) => ({ ...s, name: multi ? `${e.baseName} · ${s.name}` : s.name })));
    if (sheets.length === 0) return null;
    return buildTablesPdf({
      title: multi ? "Conversions regroupées" : entrees[0].baseName,
      subtitle: `${pluriel(sheets.length, "feuille")} · converti le ${new Date().toLocaleDateString("fr-FR")}`,
      sheets,
      fileName: `${multi ? "conversions" : entrees[0].baseName}.pdf`,
      plain: true,
      ...optionsPdf,
    });
  }

  // L'aperçu PDF est reconstruit à chaque changement d'option, de fichier ou de feuille retenue.
  useEffect(() => {
    if (!active) {
      setPdfUrl(null);
      return;
    }
    let annule = false;
    let courante: string | null = null;
    setPdfErreur(false);
    void fabriquer([active])
      .then((doc) => {
        if (annule) return;
        if (!doc) {
          setPdfUrl(null);
          return;
        }
        courante = URL.createObjectURL(doc.output("blob"));
        setPdfUrl(courante);
      })
      .catch(() => !annule && setPdfErreur(true));
    return () => {
      annule = true;
      if (courante) URL.revokeObjectURL(courante);
    };
    // fabriquer ne dépend que de optionsPdf et de l'élément actif
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, optionsPdf]);

  async function convertir(fichiers: File[]) {
    const nouveaux: ConvItem[] = fichiers.map((file) => ({
      id: crypto.randomUUID(), file, name: file.name, baseName: file.name.replace(/\.xlsx?$/i, ""), status: "cours", detail: "Lecture du classeur…", sheets: [], exclues: [],
    }));
    setItems((prev) => [...nouveaux, ...prev]);
    let premier: string | null = null;
    let echecs = 0;
    for (const n of nouveaux) {
      let maj: Partial<ConvItem>;
      try {
        const sheets = await readSheets(n.file);
        maj = sheets.length === 0 ? { status: "erreur", detail: "Fichier vide" } : { status: "ok", sheets, detail: `${pluriel(sheets.length, "feuille")} lue${sheets.length > 1 ? "s" : ""}` };
      } catch (err) {
        maj = { status: "erreur", detail: messageImport(err, "Fichier illisible — export Excel (.xlsx) attendu") };
      }
      if (maj.status === "ok") premier ??= n.id;
      else echecs++;
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, ...maj } : i)));
    }
    if (premier) {
      setActiveId(premier);
      setActiveSheet(0);
    }
    if (echecs > 0) toast.error(`${pluriel(echecs, "fichier")} non converti${echecs > 1 ? "s" : ""}`);
  }

  function reessayer(item: ConvItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    void convertir([item.file]);
  }

  function retirer(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function basculerFeuille(item: ConvItem, nom: string) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, exclues: i.exclues.includes(nom) ? i.exclues.filter((n) => n !== nom) : [...i.exclues, nom] } : i)));
  }

  async function telecharger(entrees: ConvItem[]) {
    try {
      const doc = await fabriquer(entrees);
      if (!doc) {
        toast.error("Aucune feuille retenue : cochez au moins une feuille");
        return;
      }
      doc.save(entrees.length > 1 ? "conversions.pdf" : `${entrees[0].baseName}.pdf`);
    } catch {
      toast.error("Le PDF n'a pas pu être créé");
    }
  }

  function telechargerTexte(item: ConvItem) {
    const feuilles = retenues(item);
    if (feuilles.length === 0) {
      toast.error("Aucune feuille retenue : cochez au moins une feuille");
      return;
    }
    download(new Blob([texteDepuisFeuilles(feuilles)], { type: "text/plain;charset=utf-8" }), `${item.baseName}.txt`);
  }

  async function toutTelecharger() {
    const prets = items.filter((i) => i.status === "ok" && retenues(i).length > 0);
    if (fusion) {
      await telecharger(prets);
      return;
    }
    for (const p of prets) await telecharger([p]);
  }

  const prets = items.filter((i) => i.status === "ok");
  const feuilleVisible = active ? retenues(active).length > 0 : false;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
      <div className="grid min-w-0 gap-4">
        <LedgerSheet>
          <div className="border-b border-border px-[18px] py-3">
            <h2 className="text-[0.86rem] font-bold text-foreground">Fichiers à convertir</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Les fichiers restent dans cette page : ils disparaissent à sa fermeture.</p>
          </div>
          <div className="p-[18px]">
            <ZoneDepot accept=".xlsx,.xls" extensions={["xlsx", "xls"]} types=".xlsx / .xls" occupe={occupe} libelleOccupe="Conversion en cours…" onFiles={(f) => void convertir(f)} />
          </div>
        </LedgerSheet>

        <LedgerSheet>
          <div className="border-b border-border px-[18px] py-3">
            <h2 className="text-[0.86rem] font-bold text-foreground">Options du PDF</h2>
          </div>
          <div className="grid gap-4 p-[18px] text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Orientation <span className="block text-xs text-muted-foreground">« Auto » choisit paysage pour les tableaux larges.</span></span>
              <LedgerSegmented<Orientation> value={orientation} onChange={setOrientation} ariaLabel="Orientation" options={[{ value: "auto", label: "Auto" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Paysage" }]} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Format</span>
              <LedgerSegmented<Format> value={format} onChange={setFormat} ariaLabel="Format" options={[{ value: "a4", label: "A4" }, { value: "a3", label: "A3" }]} />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox checked={entete} onCheckedChange={(c) => setEntete(Boolean(c))} className="mt-0.5" />
              <span>En-tête avec titre et date<span className="block text-xs text-muted-foreground">Nom du fichier et date de conversion en haut du document.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox checked={fusion} onCheckedChange={(c) => setFusion(Boolean(c))} className="mt-0.5" />
              <span>Un seul PDF pour tous les fichiers<span className="block text-xs text-muted-foreground">Utilisé par « Tout télécharger » ; sinon, un PDF par fichier.</span></span>
            </label>
            {active && active.sheets.length > 1 && (
              <div>
                <p className="mb-1.5">Feuilles à inclure <span className="text-xs text-muted-foreground">— {active.name}</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {active.sheets.map((s) => {
                    const incluse = !active.exclues.includes(s.name);
                    return (
                      <button key={s.name} type="button" aria-pressed={incluse} onClick={() => basculerFeuille(active, s.name)} className={cn("h-7 rounded-full px-3 text-xs font-semibold transition-colors", incluse ? "bg-primary text-primary-foreground" : "bg-accent/10 text-primary hover:bg-accent/20")}>
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </LedgerSheet>
      </div>

      <LedgerSheet data-tour="conversions-results" className="min-w-0 lg:sticky lg:top-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-[18px] py-3">
          <h2 className="text-[0.86rem] font-bold text-foreground">Aperçu</h2>
          <LedgerSegmented<Mode> value={mode} onChange={setMode} ariaLabel="Mode d'aperçu" options={[{ value: "pdf", label: "PDF" }, { value: "both", label: "Côte à côte" }, { value: "xls", label: "Excel" }]} />
        </div>
        {active && activeSheetData ? (
          <>
            {active.sheets.length > 1 && (
              <div className="px-[18px] pt-3">
                <LedgerSegmented value={String(activeSheet)} onChange={(v) => setActiveSheet(Number(v))} options={active.sheets.map((s, i) => ({ value: String(i), label: s.name }))} ariaLabel="Choisir une feuille" />
              </div>
            )}
            <div className={cn("grid gap-3 p-[18px]", mode === "both" && "xl:grid-cols-2")}>
              {mode !== "pdf" && (
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu Excel</p>
                  <div className="max-h-[560px] overflow-auto rounded-lg border border-border">
                    <table className="w-full border-collapse text-xs">
                      <tbody>
                        {activeSheetData.rows.map((row, ri) => (
                          <tr key={ri} className={ri === 0 && activeSheetData.headerRow ? "bg-muted/60 font-semibold" : ""}>
                            {row.map((cell, ci) => (
                              <td key={ci} className="whitespace-nowrap border border-border px-2 py-1">{String(cell ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {mode !== "xls" && (
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu PDF</p>
                  {pdfErreur ? (
                    <p className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive" role="alert">L'aperçu n'a pas pu être préparé.</p>
                  ) : !feuilleVisible ? (
                    <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Aucune feuille retenue : cochez au moins une feuille.</p>
                  ) : pdfUrl ? (
                    <iframe src={`${pdfUrl}${PARAMETRES_APERCU}`} title="Aperçu PDF" className="h-[560px] w-full rounded-lg border border-border bg-muted" />
                  ) : (
                    <p className="flex h-[560px] items-center justify-center gap-2 rounded-lg border border-border text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Préparation de l'aperçu…</p>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">Ajoutez un fichier, puis cliquez sur sa ligne pour voir l'aperçu.</p>
        )}
      </LedgerSheet>

      {items.length > 0 && (
        <LedgerSheet className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-[18px] py-3">
            <h2 className="text-[0.86rem] font-bold text-foreground">File de conversion</h2>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={prets.length < 2} onClick={() => void toutTelecharger()} title={prets.length < 2 ? "Disponible à partir de deux fichiers prêts" : undefined}>
                <Download className="h-3.5 w-3.5" /> Tout télécharger
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setItems([]); setActiveId(null); }}>Vider la liste</Button>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id}>
                <div
                  role={item.status === "ok" ? "button" : undefined}
                  tabIndex={item.status === "ok" ? 0 : undefined}
                  onClick={() => { if (item.status === "ok") { setActiveId(item.id); setActiveSheet(0); } }}
                  onKeyDown={(e) => { if (item.status === "ok" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setActiveId(item.id); setActiveSheet(0); } }}
                  className={cn("flex items-center gap-3 border-l-4 px-[18px] py-2.5", item.status === "ok" ? "cursor-pointer border-l-success hover:bg-accent/10" : item.status === "erreur" ? "border-l-destructive" : "border-l-accent", activeId === item.id && "bg-accent/15")}
                >
                  {item.status === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" /> : item.status === "erreur" ? <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" /> : <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className={cn("text-xs", item.status === "erreur" ? "text-destructive" : "text-muted-foreground")}>{item.detail}</p>
                  </div>
                  {item.status === "ok" && (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); telechargerTexte(item); }}>
                        <FileText className="h-3.5 w-3.5" /> Texte (.txt)
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); void telecharger([item]); }}>
                        <Download className="h-3.5 w-3.5" /> Télécharger le PDF
                      </Button>
                    </>
                  )}
                  {item.status === "erreur" && (
                    <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); reessayer(item); }}>
                      <RotateCcw className="h-3.5 w-3.5" /> Réessayer
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Retirer ${item.name}`} onClick={(e) => { e.stopPropagation(); retirer(item.id); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </LedgerSheet>
      )}
    </div>
  );
}
