import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ClipboardPaste, Coins, Plus, Save, Trash2 } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MOIS, anneesAvecCours, lireCoursCollés, moyenneAnnee } from "@/lib/coursChange";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import "../stock/stock-page.css";
import { useCoursChange } from "@/store/coursChange";

const cle = (devise: string, mois: number) => `${devise}:${mois}`;
const texte = (n: number | undefined) => (n === undefined ? "" : String(n).replace(".", ","));
const lire = (t: string): number | null | "invalide" => {
  const v = t.trim();
  if (!v) return null;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : "invalide";
};

/** Cours de change : moyenne mensuelle du marché interbancaire par devise, année par année. Ils alimentent les factures d'achat et de
 * vente du stock (et les règlements fournisseurs), qui proposent le cours du mois de leur date. */
export function CoursChangePage() {
  const { devises, cours: coursTnd, coursUsd = [], charge, fetch, saveAnnee, addDevise, removeDevise } = useCoursChange();
  // Toute l'équipe consulte les cours ; l'admin et le responsable des collaborateurs les modifient.
  const { canManageCollaborateurs: peutModifier } = usePermissions();
  const anneeCourante = new Date().getFullYear();
  const [annee, setAnnee] = useState(anneeCourante);
  // Deux tableaux : les cours par rapport au dinar (TND pour 1 unité) et par rapport au dollar (USD pour 1 unité, sans le dollar lui-même).
  const [base, setBase] = useState<"TND" | "USD">("TND");
  const cours = base === "TND" ? coursTnd : coursUsd;
  const colonnes = useMemo(() => (base === "TND" ? devises : devises.filter((d) => d.code !== "USD")), [base, devises]);
  const [saisie, setSaisie] = useState<Record<string, string>>({});
  const [enregistrement, setEnregistrement] = useState(false);
  const [nouvelle, setNouvelle] = useState(false);
  const [coller, setColler] = useState(false);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);

  useEffect(() => {
    void fetch(true);
  }, [fetch]);

  // Les cours de l'année affichée : on repart des valeurs enregistrées quand l'année ou les données changent.
  useEffect(() => {
    const init: Record<string, string> = {};
    for (const c of cours) if (c.annee === annee) init[cle(c.devise, c.mois)] = texte(c.cours);
    setSaisie(init);
  }, [cours, annee, base]);

  const enregistres = useMemo(() => new Map(cours.filter((c) => c.annee === annee).map((c) => [cle(c.devise, c.mois), c.cours])), [cours, annee]);
  const annees = useMemo(() => [...new Set([...anneesAvecCours(cours), anneeCourante])].sort((a, b) => b - a), [cours, anneeCourante]);

  const modifies = useMemo(() => {
    const l: { devise: string; mois: number; cours: number | null }[] = [];
    let invalide = false;
    for (const d of colonnes)
      for (let m = 1; m <= 12; m++) {
        const v = lire(saisie[cle(d.code, m)] ?? "");
        if (v === "invalide") {
          invalide = true;
          continue;
        }
        const avant = enregistres.get(cle(d.code, m)) ?? null;
        if (v !== avant) l.push({ devise: d.code, mois: m, cours: v });
      }
    return { l, invalide };
  }, [saisie, colonnes, enregistres]);

  async function enregistrer() {
    if (modifies.invalide) {
      toast.error("Un cours est un nombre positif (ex. 3,3167).");
      return;
    }
    setEnregistrement(true);
    try {
      await saveAnnee(annee, modifies.l, base);
      toast.success(`Cours ${annee} enregistrés`);
    } catch {
      // déjà signalé
    } finally {
      setEnregistrement(false);
    }
  }

  const nbRenseignes = coursTnd.filter((c) => c.annee === annee).length + coursUsd.filter((c) => c.annee === annee).length;

  return (
    <div className="stock-page">
      <SignatureLedgerBanner
        variant="compact"
        icon={Coins}
        eyebrow="Gestion de stock · Comptabilité"
        title="Cours de change"
        description="Moyennes mensuelles du marché interbancaire, par devise et par année : proposées dans les factures d'achat et de vente."
        metrics={[
          { label: "devises", value: devises.length },
          { label: `cours ${annee}`, value: nbRenseignes },
        ]}
        actions={
          !peutModifier ? undefined : (
          <>
            <Button variant="outline" className="min-h-10 gap-2 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setColler(true)}>
              <ClipboardPaste className="size-4" /> Coller un tableau
            </Button>
            <Button variant="outline" className="min-h-10 gap-2 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setNouvelle(true)}>
              <Plus className="size-4" /> Ajouter une devise
            </Button>
          </>
          )
        }
      />

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-1" role="group" aria-label="Choisir l'année">
            <Button variant="outline" size="icon" className="size-9" aria-label="Année précédente" onClick={() => setAnnee((a) => a - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-20 text-center text-xl font-semibold text-primary tabular-nums" aria-live="polite">
              {annee}
            </span>
            <Button variant="outline" size="icon" className="size-9" aria-label="Année suivante" onClick={() => setAnnee((a) => a + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div role="group" aria-label="Tableau de cours" className="inline-flex overflow-hidden rounded-md border border-border">
            {([["TND", "Par rapport au dinar (TND)"], ["USD", "Par rapport au dollar (USD)"]] as const).map(([code, nom]) => (
              <button
                key={code}
                type="button"
                aria-pressed={base === code}
                onClick={() => setBase(code)}
                className={cn("h-9 border-r border-border px-3.5 text-[0.8125rem] font-medium last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", base === code ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}
              >
                {nom}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Années">
            {annees.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAnnee(a)}
                aria-pressed={a === annee}
                className={cn(
                  "min-h-8 rounded-full border px-3 text-xs font-semibold tabular-nums transition-colors",
                  a === annee ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary/70",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {colonnes.length === 0 && charge ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{base === "USD" && devises.length > 0 ? "Aucune devise autre que le dollar : ajoutez-en une pour saisir ses cours par rapport au dollar." : "Aucune devise. Ajoutez-en une pour saisir ses cours."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-[0.8125rem] tabular-nums">
              <thead>
                <tr className="bg-primary text-xs text-primary-foreground">
                  <th scope="col" className="border-r border-primary-foreground/15 px-4 py-3 text-left font-semibold">Mois</th>
                  {colonnes.map((d) => (
                    <th key={d.code} scope="col" className="border-r border-primary-foreground/15 px-3 py-3 text-right font-medium last:border-r-0">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <span title={d.libelle} className="text-sm font-semibold">{d.code}</span>
                        <span className="font-normal text-primary-foreground/70">{d.unite > 1 ? `(pour ${d.unite})` : ""}</span>
                        {peutModifier && <button
                          type="button"
                          aria-label={`Supprimer la devise ${d.code}`}
                          onClick={() => setASupprimer(d.code)}
                          className="rounded p-1 text-primary-foreground/60 hover:bg-primary-foreground/15 hover:text-primary-foreground"
                        >
                          <Trash2 className="size-3.5" />
                        </button>}
                      </span>
                      {d.libelle && <span className="block text-xs font-normal text-primary-foreground/70">{d.libelle}</span>}
                      <span className="mt-0.5 block text-xs font-normal text-primary-foreground/60">{cours.filter((c) => c.devise === d.code && c.annee === annee).length} / 12 mois saisis</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOIS.map((nom, i) => (
                  <tr key={nom} className={cn("even:bg-muted/25 hover:bg-muted/50", annee === anneeCourante && i + 1 === new Date().getMonth() + 1 && "bg-accent/15 even:bg-accent/15")}>
                    <th scope="row" className="h-11 border-b border-r border-border/70 px-4 py-1 text-left font-medium text-foreground">{nom}</th>
                    {colonnes.map((d) => {
                      const k = cle(d.code, i + 1);
                      const v = saisie[k] ?? "";
                      const invalide = lire(v) === "invalide";
                      return (
                        <td key={d.code} className="border-b border-r border-border/70 p-0 last:border-r-0">
                          <Input
                            inputMode="decimal"
                            aria-label={`${d.code} ${nom} ${annee}`}
                            aria-invalid={invalide || undefined}
                            className={cn("h-11 rounded-none border-0 bg-transparent px-4 text-right text-sm tabular-nums shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent", invalide && "bg-destructive/10 text-destructive", v !== texte(enregistres.get(k)) && !invalide && "bg-warning/10")}
                            value={v}
                            readOnly={!peutModifier}
                            placeholder="—"
                            onChange={(e) => setSaisie((s) => ({ ...s, [k]: e.target.value }))}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary bg-muted/50 text-sm font-semibold text-primary">
                  <th scope="row" className="border-r border-border/70 px-4 py-2.5 text-left">Moyenne {annee}</th>
                  {colonnes.map((d) => (
                    <td key={d.code} className="border-r border-border/70 px-4 py-2.5 text-right tabular-nums last:border-r-0">
                      {texte(moyenneAnnee(cours, d.code, annee)) || "—"}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {base === "TND"
              ? "Cours en dinars (TND) pour 1 unité de devise (pour 1000 yens, indiquez « 1000 » comme unité de la devise). Un mois laissé vide n'a pas de cours proposé."
              : "Cours en dollars (USD) pour 1 unité de devise : proposé dans les factures du stock avant le cours calculé d'après les cours en dinars. Un mois laissé vide n'a pas de cours saisi."}
          </p>
          <div className="flex items-center gap-3">
            {peutModifier && modifies.l.length > 0 && (
              <span role="status" className="text-xs font-medium text-warning">
                {modifies.l.length} modification{modifies.l.length > 1 ? "s" : ""} non enregistrée{modifies.l.length > 1 ? "s" : ""}
              </span>
            )}
            {peutModifier && <Button variant="ledger" className="min-h-10 gap-2" disabled={modifies.l.length === 0 || modifies.invalide || enregistrement} onClick={() => void enregistrer()}>
              <Save className="size-4" />
              {enregistrement ? "Enregistrement…" : `Enregistrer ${annee}`}
            </Button>}
          </div>
        </div>
      </section>

      <DialogDevise open={nouvelle} onOpenChange={setNouvelle} existantes={devises.map((d) => d.code)} onAjouter={addDevise} />
      <DialogColler
        open={coller}
        onOpenChange={setColler}
        devises={colonnes.map((d) => d.code)}
        onImporter={async (liste) => {
          const parAnnee = new Map<number, { devise: string; mois: number; cours: number | null }[]>();
          for (const c of liste) parAnnee.set(c.annee, [...(parAnnee.get(c.annee) ?? []), { devise: c.devise, mois: c.mois, cours: c.cours }]);
          for (const [a, valeurs] of parAnnee) await saveAnnee(a, valeurs, base);
          const premiere = [...parAnnee.keys()].sort()[0];
          if (premiere) setAnnee(premiere);
          toast.success(`${liste.length} cours importés`);
        }}
      />
      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(o) => !o && setASupprimer(null)}
        title={`Supprimer la devise ${aSupprimer ?? ""} ?`}
        description="Tous ses cours (toutes les années) seront supprimés. Les factures déjà enregistrées gardent leur cours."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (aSupprimer) await removeDevise(aSupprimer);
          setASupprimer(null);
        }}
      />
    </div>
  );
}

function DialogDevise({
  open,
  onOpenChange,
  existantes,
  onAjouter,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existantes: string[];
  onAjouter: (d: { code: string; libelle: string; unite: number }) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [libelle, setLibelle] = useState("");
  const [unite, setUnite] = useState("1");
  const [occupe, setOccupe] = useState(false);
  useEffect(() => {
    if (open) {
      setCode("");
      setLibelle("");
      setUnite("1");
    }
  }, [open]);
  const c = code.trim().toUpperCase();
  const erreur = c && !/^[A-Z]{3}$/.test(c) ? "Code sur 3 lettres (ex. CHF)." : existantes.includes(c) ? `${c} existe déjà.` : c === "TND" ? "Le dinar est la monnaie de référence." : "";
  const u = Number(unite);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une devise</DialogTitle>
          <DialogDescription>Elle apparaît comme une colonne de plus pour toutes les années.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1 text-sm font-medium">
            Code (3 lettres)
            <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={3} placeholder="CHF" autoFocus />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Libellé
            <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Franc suisse" />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Unité de cotation
            <Input value={unite} onChange={(e) => setUnite(e.target.value)} inputMode="numeric" />
            <span className="block text-xs font-normal text-muted-foreground">1 pour la plupart des devises, 1000 pour le yen japonais.</span>
          </label>
          {erreur && (
            <p role="alert" className="text-xs text-destructive">
              {erreur}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="ledger"
            disabled={!c || Boolean(erreur) || !Number.isInteger(u) || u < 1 || occupe}
            onClick={async () => {
              setOccupe(true);
              try {
                await onAjouter({ code: c, libelle: libelle.trim(), unite: u });
                toast.success(`Devise ${c} ajoutée`);
                onOpenChange(false);
              } catch {
                // déjà signalé
              } finally {
                setOccupe(false);
              }
            }}
          >
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogColler({
  open,
  onOpenChange,
  devises,
  onImporter,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  devises: string[];
  onImporter: (liste: { devise: string; annee: number; mois: number; cours: number }[]) => Promise<void>;
}) {
  const [texteColle, setTexteColle] = useState("");
  const [occupe, setOccupe] = useState(false);
  useEffect(() => {
    if (open) setTexteColle("");
  }, [open]);
  const lu = useMemo(() => lireCoursCollés(texteColle, devises), [texteColle, devises]);
  const inconnues = lu.devises.filter((d) => !devises.includes(d));
  const importables = lu.cours.filter((c) => devises.includes(c.devise));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl">
        <DialogHeader>
          <DialogTitle>Coller un tableau de cours</DialogTitle>
          <DialogDescription>
            Copiez le tableau mensuel (en-têtes des devises, puis une ligne par date « 31/01/2025 », valeurs dans l'ordre des colonnes) et collez-le ici.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={9}
          value={texteColle}
          onChange={(e) => setTexteColle(e.target.value)}
          aria-label="Tableau de cours à coller"
          placeholder={"Dollar des USA (USD) Unité:1\tLivre Sterling (GBP) Unité:1\tEURO (EUR) Unité:1\n31/01/2025\t3,2000\t3,9556\t3,3167"}
          className="font-mono text-xs"
        />
        {texteColle.trim() && (
          <div className="space-y-1 text-sm" role="status">
            <p>
              <strong>{importables.length}</strong> cours lus pour {lu.devises.filter((d) => devises.includes(d)).join(", ") || "aucune devise reconnue"}.
              {lu.ignorees > 0 && <span className="text-muted-foreground"> {lu.ignorees} ligne(s) ignorée(s).</span>}
            </p>
            {inconnues.length > 0 && <p className="text-warning">Devise(s) à ajouter d'abord : {inconnues.join(", ")}.</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="ledger"
            disabled={importables.length === 0 || occupe}
            onClick={async () => {
              setOccupe(true);
              try {
                await onImporter(importables);
                onOpenChange(false);
              } catch {
                // déjà signalé
              } finally {
                setOccupe(false);
              }
            }}
          >
            {occupe ? "Import…" : `Importer ${importables.length} cours`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
