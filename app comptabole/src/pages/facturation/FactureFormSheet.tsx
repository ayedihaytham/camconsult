import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Eye, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/common/AmountInput";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSocietes } from "@/store/data";
import { useFacturation, type FactureInput } from "@/store/facturation";
import type { Facture, Societe } from "@/types";
import { validerMatriculeFiscal } from "../../../shared/mf.js";
import { DELAI_PAIEMENT_JOURS, TIMBRE_DEFAUT, TVA_TAUX, ajouterJours, calculerTotaux, formatTnd, montantEnLettres, prochainNumero } from "@/lib/facturation";
import { cn } from "@/lib/utils";
import { FactureApercuDialog } from "./FactureApercuDialog";

interface LigneDraft {
  description: string;
  quantite: number;
  montantHt: number;
}

const emptyLigne = (): LigneDraft => ({ description: "", quantite: 1, montantHt: 0 });
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const ECHEANCES = [
  { label: "À réception", jours: 0 },
  { label: "30 jours", jours: 30 },
  { label: "45 jours", jours: 45 },
  { label: "60 jours", jours: 60 },
] as const;
const SUGGESTIONS = [
  "Honoraires de tenue comptable — mois",
  "Déclarations fiscales mensuelles",
  "Assistance fiscale annuelle",
  "Bilan et liasse fiscale",
  "Conseil juridique",
];

/** Ce qu'il manque à une société cliente pour que sa facture puisse devenir une facture électronique (matricule fiscal et adresse structurée). */
export function manquesClientEinvoice(s: Pick<Societe, "tva" | "adresseRue" | "ville" | "codePostal">): string[] {
  const manque: string[] = [];
  if (!validerMatriculeFiscal(s.tva ?? "").ok) manque.push("matricule fiscal valide");
  if (!(s.adresseRue ?? "").trim() || !(s.ville ?? "").trim() || !(s.codePostal ?? "").trim()) manque.push("adresse (rue, ville, code postal)");
  return manque;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (data: FactureInput) => Promise<void> | void;
  /** Client proposé à l'ouverture (société active). */
  defaultSocieteId?: string;
  /** Facture de départ : « modification » la remplace (numéro conservé), « copie » en reprend client, lignes et taux avec de nouvelles dates. */
  source?: Facture | null;
  mode?: "nouvelle" | "modification" | "copie";
}

const etiquette = "grid gap-1.5 text-xs font-semibold text-primary";
const champ = "h-10 rounded-lg border-input bg-card px-3 text-sm focus-visible:border-primary";

function Rubrique({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        <span className="size-1.5 rotate-45 bg-accent" aria-hidden="true" />
        {titre}
      </h2>
      {children}
    </section>
  );
}

/**
 * Nouvelle facture d'honoraires (création, modification ou copie) : formulaire à gauche, récapitulatif toujours visible à droite
 * (totaux, montant en lettres, état du client pour la facture électronique, numéro prévu) et aperçu fidèle du PDF.
 */
export function FactureFormSheet({ open, onOpenChange, onSubmit, defaultSocieteId = "", source = null, mode = "nouvelle" }: Props) {
  const societes = useSocietes();
  const factures = useFacturation((s) => s.list);
  const cabinet = useFacturation((s) => s.cabinet);
  const [societeId, setSocieteId] = useState("");
  const [dateEmission, setDateEmission] = useState(aujourdhui());
  const [echeance, setEcheance] = useState("");
  const [tvaTaux, setTvaTaux] = useState<number>(19);
  const [timbre, setTimbre] = useState<number>(TIMBRE_DEFAUT);
  const [note, setNote] = useState("");
  const [lignes, setLignes] = useState<LigneDraft[]>([emptyLigne()]);
  const [sending, setSending] = useState(false);
  const [apercuOuvert, setApercuOuvert] = useState(false);

  useEffect(() => {
    if (!open) return;
    const jour = aujourdhui();
    if (source && mode !== "nouvelle") {
      const modification = mode === "modification";
      setSocieteId(source.societeId);
      setDateEmission(modification ? source.dateEmission : jour);
      setEcheance(modification ? (source.echeance ?? "") : ajouterJours(jour, DELAI_PAIEMENT_JOURS));
      setTvaTaux(source.tvaTaux);
      setTimbre(source.timbre);
      setNote(source.note ?? "");
      setLignes(source.lignes.length ? source.lignes.map((l) => ({ description: l.description, quantite: l.quantite, montantHt: l.montantHt })) : [emptyLigne()]);
      return;
    }
    setSocieteId(defaultSocieteId);
    setDateEmission(jour);
    setEcheance(ajouterJours(jour, DELAI_PAIEMENT_JOURS));
    setTvaTaux(19);
    setTimbre(TIMBRE_DEFAUT);
    setNote("");
    setLignes([emptyLigne()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totaux = useMemo(() => calculerTotaux(lignes, tvaTaux, timbre), [lignes, tvaTaux, timbre]);
  const lignesValides = lignes.filter((l) => l.description.trim() && Number(l.montantHt) > 0);
  const societe = societes.find((s) => s.id === societeId) ?? null;
  const echeanceIncoherente = Boolean(echeance && dateEmission && echeance < dateEmission);
  const peutGenerer = Boolean(societeId) && lignesValides.length > 0 && !echeanceIncoherente && !sending;
  const manques = societe ? manquesClientEinvoice(societe) : [];
  const numero = mode === "modification" && source ? source.numero : prochainNumero(factures.map((f) => f.numero), dateEmission);

  const societesActives = useMemo(() => [...societes].sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr")), [societes]);

  // Facture telle que l'aperçu la montre : les lignes valides, les totaux calculés ici (le serveur recalcule à la génération).
  const brouillon: Facture | null = useMemo(
    () =>
      societe
        ? {
            id: "apercu",
            societeId: societe.id,
            societeNom: societe.raisonSociale,
            clientAdresse: societe.adresse ?? "",
            clientTva: societe.tva ?? "",
            clientRne: societe.rne ?? "",
            numero,
            dateEmission,
            echeance: echeance || null,
            tvaTaux,
            timbre,
            statut: "emise",
            payeLe: null,
            signeeLe: null,
            note: note.trim(),
            totalHt: totaux.totalHt,
            tva: totaux.tva,
            netAPayer: totaux.netAPayer,
            creeLe: new Date().toISOString(),
            einvoice: null,
            lignes: (lignesValides.length ? lignesValides : lignes).map((l, i) => ({ id: String(i), ordre: i, description: l.description.trim() || "—", quantite: Number(l.quantite) || 1, montantHt: Number(l.montantHt) || 0 })),
          }
        : null,
    [societe, numero, dateEmission, echeance, tvaTaux, timbre, note, totaux, lignes, lignesValides],
  );

  function setLigne(i: number, patch: Partial<LigneDraft>) {
    setLignes((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!peutGenerer) return;
    setSending(true);
    try {
      await onSubmit({
        societeId,
        dateEmission,
        echeance: echeance || null,
        tvaTaux,
        timbre,
        note: note.trim(),
        lignes: lignesValides.map((l) => ({
          description: l.description.trim(),
          quantite: Number(l.quantite) || 1,
          montantHt: Number(l.montantHt) || 0,
        })),
      });
      onOpenChange(false);
    } catch {
      // Le store a déjà affiché l'erreur : le formulaire reste ouvert pour corriger.
    } finally {
      setSending(false);
    }
  }

  const message = !societeId
    ? "Choisissez le client."
    : echeanceIncoherente
      ? "L'échéance ne peut pas précéder la date d'émission."
      : lignesValides.length === 0
        ? "Ajoutez au moins une ligne avec une description et un montant HT."
        : `${lignesValides.length} ligne${lignesValides.length > 1 ? "s" : ""} facturée${lignesValides.length > 1 ? "s" : ""} — prête à être ${mode === "modification" ? "enregistrée" : "générée"}.`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[94vh] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl border-accent/30 p-0">
          <div className="shrink-0 border-b border-accent/30 px-6 pb-4 pt-6 sm:px-8">
            <DialogTitle className="pr-8 font-serif text-3xl font-medium text-primary">
              {mode === "modification" ? `Modifier la facture ${source?.numero ?? ""}` : mode === "copie" ? "Dupliquer la facture" : "Nouvelle facture d'honoraires"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {mode === "modification"
                ? "Le numéro est conservé. Si la facture électronique était déjà préparée, il faudra la régénérer avant de la signer."
                : mode === "copie"
                  ? `Client, lignes et taux repris de la facture ${source?.numero ?? ""} ; dates mises à jour, nouveau numéro attribué à la génération.`
                  : "Le numéro est attribué à la génération ; les totaux se calculent tout seuls."}
            </DialogDescription>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:overflow-hidden">
            <div className="space-y-6 px-6 py-5 sm:px-8 lg:overflow-y-auto">
              <Rubrique titre="Client">
                <label className={etiquette}>
                  Société facturée
                  <Select value={societeId} onValueChange={setSocieteId}>
                    <SelectTrigger id="facture-client" className="h-10 rounded-lg border-input bg-card text-sm" aria-label="Société facturée">
                      <SelectValue placeholder="Choisir la société…" />
                    </SelectTrigger>
                    <SelectContent>
                      {societesActives.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.raisonSociale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {societe && (
                  <div className="grid gap-1.5 rounded-xl border border-accent/25 bg-background/60 px-3.5 py-2.5 text-[13px]" aria-label="Fiche du client">
                    <p className="font-semibold text-primary">{societe.raisonSociale}</p>
                    <p className="text-muted-foreground">
                      {societe.tva ? `MF ${societe.tva}` : "Matricule fiscal non renseigné"} · {societe.adresse || "Adresse non renseignée"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", validerMatriculeFiscal(societe.tva ?? "").ok ? "text-success" : "text-warning")}>
                        {validerMatriculeFiscal(societe.tva ?? "").ok ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <AlertTriangle className="size-3.5" aria-hidden="true" />}
                        Matricule fiscal
                      </span>
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", !manques.includes("adresse (rue, ville, code postal)") ? "text-success" : "text-warning")}>
                        {!manques.includes("adresse (rue, ville, code postal)") ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <AlertTriangle className="size-3.5" aria-hidden="true" />}
                        Adresse
                      </span>
                      {manques.length > 0 && (
                        <Link to="/societes" className="text-xs font-semibold text-primary underline underline-offset-4">
                          Compléter la société
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </Rubrique>

              <Rubrique titre="Dates et taxes">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={etiquette}>
                    Date d'émission
                    <Input id="facture-emission" type="date" value={dateEmission} onChange={(e) => setDateEmission(e.target.value)} className={champ} />
                  </label>
                  <label className={etiquette}>
                    Échéance de paiement
                    <Input id="facture-echeance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className={cn(champ, echeanceIncoherente && "border-destructive")} aria-invalid={echeanceIncoherente} />
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Raccourcis d'échéance">
                  {ECHEANCES.map((e) => (
                    <button
                      key={e.label}
                      type="button"
                      onClick={() => setEcheance(ajouterJours(dateEmission || aujourdhui(), e.jours))}
                      className="h-7 rounded-full border border-input bg-card px-3 text-xs font-semibold text-primary transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={etiquette}>
                    TVA
                    <div role="group" aria-label="Taux de TVA" className="inline-grid h-10 grid-flow-col overflow-hidden rounded-lg border border-input bg-card">
                      {TVA_TAUX.map((t) => (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={tvaTaux === t}
                          onClick={() => setTvaTaux(t)}
                          className={cn(
                            "border-r border-input px-4 text-sm font-semibold transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                            tvaTaux === t ? "bg-primary text-primary-foreground" : "hover:bg-accent/15",
                          )}
                        >
                          {t} %
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className={etiquette}>
                    Droit de timbre (TND)
                    <AmountInput id="facture-timbre" value={timbre} onValueChange={setTimbre} allowNegative={false} className={cn(champ, "text-right tabular-nums")} />
                  </label>
                </div>
              </Rubrique>

              <Rubrique titre="Prestations">
                <div className="overflow-hidden rounded-xl border border-accent/25" role="table" aria-label="Lignes de la facture">
                  <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_7.5rem_7.5rem_2.25rem] gap-2 bg-primary px-2.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-primary-foreground sm:grid" role="row">
                    <span role="columnheader">Description</span>
                    <span role="columnheader" className="text-right">Qté</span>
                    <span role="columnheader" className="text-right">P.U. HT</span>
                    <span role="columnheader" className="text-right">Total HT</span>
                    <span />
                  </div>
                  {lignes.map((l, i) => (
                    <div key={i} role="row" className="grid grid-cols-[minmax(0,1fr)_5rem_6.5rem_2.25rem] items-center gap-2 border-t border-accent/20 px-2.5 py-2 even:bg-background/50 sm:grid-cols-[minmax(0,1fr)_5.5rem_7.5rem_7.5rem_2.25rem]">
                      <Input
                        className={cn(champ, "col-span-4 h-9 sm:col-span-1")}
                        aria-label={`Description, ligne ${i + 1}`}
                        list="facture-suggestions"
                        value={l.description}
                        onChange={(e) => setLigne(i, { description: e.target.value })}
                        placeholder="Désignation de la prestation"
                      />
                      <AmountInput className={cn(champ, "h-9 text-right tabular-nums")} aria-label={`Quantité, ligne ${i + 1}`} value={l.quantite} onValueChange={(n) => setLigne(i, { quantite: n })} allowNegative={false} />
                      <AmountInput
                        className={cn(champ, "h-9 text-right tabular-nums")}
                        aria-label={`Prix unitaire HT, ligne ${i + 1}`}
                        value={l.montantHt}
                        onValueChange={(n) => setLigne(i, { montantHt: n })}
                        allowNegative={false}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && i === lignes.length - 1) {
                            e.preventDefault();
                            setLignes((ls) => [...ls, emptyLigne()]);
                          }
                        }}
                      />
                      <span className="text-right text-[13.5px] font-bold tabular-nums text-primary max-sm:col-span-3 max-sm:text-left" aria-label={`Total HT, ligne ${i + 1}`}>
                        <span className="font-medium text-muted-foreground sm:hidden">Total HT : </span>
                        {formatTnd(Math.round(l.quantite * l.montantHt * 1000) / 1000)}
                      </span>
                      <button
                        type="button"
                        disabled={lignes.length === 1}
                        onClick={() => setLignes((ls) => ls.filter((_, idx) => idx !== i))}
                        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        aria-label={`Supprimer la ligne ${i + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <datalist id="facture-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="outline" size="sm" className="h-9 border-accent bg-accent/15 font-semibold text-primary shadow-none hover:bg-accent/30" onClick={() => setLignes((ls) => [...ls, emptyLigne()])}>
                    <Plus className="mr-1.5 size-4" aria-hidden="true" />
                    Ajouter une ligne
                  </Button>
                  <span className="text-xs text-muted-foreground">Entrée dans le prix de la dernière ligne en ajoute une.</span>
                </div>
              </Rubrique>

              <label className={etiquette}>
                Note (facultative)
                <Input id="facture-note" value={note} onChange={(e) => setNote(e.target.value)} className={champ} placeholder="Mention affichée en bas de la facture" />
              </label>
            </div>

            <aside aria-label="Récapitulatif" className="border-t border-accent/30 bg-background/60 px-6 py-5 sm:px-8 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:px-6">
              <div className="space-y-4">
                <div>
                  <h2 className="mb-2 font-serif text-base font-bold text-primary">Récapitulatif</h2>
                  <dl className="space-y-1 text-[13px] text-muted-foreground">
                    <div className="flex justify-between"><dt>Total HT</dt><dd className="tabular-nums">{formatTnd(totaux.totalHt)} TND</dd></div>
                    <div className="flex justify-between"><dt>TVA ({tvaTaux} %)</dt><dd className="tabular-nums">{formatTnd(totaux.tva)} TND</dd></div>
                    <div className="flex justify-between"><dt>Droit de timbre</dt><dd className="tabular-nums">{formatTnd(timbre)} TND</dd></div>
                  </dl>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-primary px-3.5 py-3 text-primary-foreground">
                    <span className="text-[13px] font-bold">Net à payer</span>
                    <span className="font-serif text-xl font-bold tabular-nums" data-testid="net-a-payer">{formatTnd(totaux.netAPayer)} TND</span>
                  </div>
                </div>

                <p className="rounded-r-md border-l-[3px] border-accent bg-accent/10 px-2.5 py-1.5 text-xs text-muted-foreground">
                  Arrêtée la présente facture à la somme de
                  <b className="block text-[13px] text-primary">{montantEnLettres(totaux.netAPayer)}</b>
                </p>

                <div className="space-y-1.5 rounded-xl border border-accent/25 bg-card px-3 py-2.5 text-xs">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Facture électronique</h3>
                  {!societe ? (
                    <p className="text-muted-foreground">Choisissez d'abord le client.</p>
                  ) : manques.length === 0 ? (
                    <p className="flex items-center gap-1.5 font-semibold text-success">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> Client complet : facture électronique possible
                    </p>
                  ) : (
                    <>
                      <p className="flex items-center gap-1.5 font-semibold text-warning">
                        <AlertTriangle className="size-3.5" aria-hidden="true" /> À compléter : {manques.join(", ")}
                      </p>
                      <p className="text-muted-foreground">La facture peut être générée, mais pas transformée en facture électronique tant que la société n'est pas complète.</p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{mode === "modification" ? "Numéro conservé" : "Numéro prévu"}</span>
                  <b className="tabular-nums text-primary">{numero}</b>
                </div>
                <Button type="button" variant="outline" className="w-full" disabled={!brouillon} onClick={() => setApercuOuvert(true)}>
                  <Eye className="mr-1.5 size-4" aria-hidden="true" /> Aperçu de la facture
                </Button>
              </div>
            </aside>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-accent/30 px-6 py-4 sm:px-8">
            <p className={cn("text-sm", peutGenerer ? "text-success" : "text-muted-foreground")} role="status">
              {message}
            </p>
            <div className="ml-auto flex gap-3">
              <Button type="button" variant="outline" className="h-11 rounded-lg px-6" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="button" variant="ledger" className="h-11 rounded-lg px-6 text-sm uppercase tracking-[0.14em]" disabled={!peutGenerer} onClick={submit}>
                {mode === "modification" ? "Enregistrer les modifications" : "Générer la facture"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FactureApercuDialog open={apercuOuvert} onOpenChange={setApercuOuvert} facture={apercuOuvert ? brouillon : null} cabinet={cabinet} />
    </>
  );
}
