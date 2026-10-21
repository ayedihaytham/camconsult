import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, Banknote, Building2, CalendarDays, CheckCircle2, Coins, Eye, Globe, Pencil, Plus, Send, Text, Trash2, Activity } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocieteById } from "@/store/data";
import { useEtatSwift } from "@/store/etatSwift";
import { cn, formatDate } from "@/lib/utils";
import { SwiftFacturesEditor } from "./SwiftFacturesEditor";
import { SwiftStatutBadge, SWIFT_BANDE, montantSwift } from "./SwiftStatut";
import { SwiftVirementDialog } from "./SwiftVirementDialog";
import type { SwiftVirement } from "@/types";

function Barre({ virement }: { virement: SwiftVirement }) {
  const ref = virement.equivalentDevise;
  if (virement.factures.length === 0) return <p className="text-xs text-muted-foreground">En attente des factures de la société</p>;
  if (!ref) return <p className="text-xs text-muted-foreground">Équivalent en devise pas encore indiqué</p>;
  const pct = Math.min(100, Math.round((virement.justifieDevise / ref) * 100));
  return (
    <div className="min-w-[140px]">
      <div className="h-2 overflow-hidden rounded-full border border-border bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Part de l'équivalent en devise justifiée">
        <div className={cn("h-full", virement.statut === "justifie" ? "bg-success" : virement.statut === "ecart" ? "bg-destructive" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
        {montantSwift(virement.justifieDevise)} / {montantSwift(ref)} {virement.devise} · {pct} %
      </p>
    </div>
  );
}

/** État SWIFT d'une société : le comptable pose les virements à justifier, la société les justifie par ses factures d'achat. */
export function EtatSwiftSocietePage() {
  const { societeId = "" } = useParams();
  return <EtatSwiftSociete societeId={societeId} />;
}

/** Le même écran, utilisable dans une collecte de pièces (`integre`) : mêmes virements, mêmes factures, même contrôle « jusqu'à atteindre le
 * montant en devise », sans bandeau de page. `circuit` : les boutons de la section (transmettre, valider…), affichés au-dessus ;
 * `lectureSeule` : section fermée, la société consulte seulement. */
export function EtatSwiftSociete({ societeId, integre = false, lectureSeule = false, circuit }: { societeId: string; integre?: boolean; lectureSeule?: boolean; circuit?: React.ReactNode }) {
  const societe = useSocieteById(societeId);
  const { isResponsableSociete } = usePermissions();
  const { virements, loading, fetch, clear, create, update, remove, saveFactures } = useEtatSwift();
  const [formOuvert, setFormOuvert] = useState(false);
  const [edition, setEdition] = useState<SwiftVirement | null>(null);
  const [voir, setVoir] = useState<SwiftVirement | null>(null);
  const [aSupprimer, setASupprimer] = useState<SwiftVirement | null>(null);
  const [ouvertId, setOuvertId] = useState<string | null>(null);

  useEffect(() => {
    void fetch(societeId).catch(() => undefined);
    return () => clear();
  }, [societeId, fetch, clear]);

  const totalMontant = useMemo(() => virements.reduce((s, v) => s + v.montant, 0), [virements]);
  const nbJustifies = virements.filter((v) => v.statut === "justifie").length;
  const nbAJustifier = virements.length - nbJustifies;

  // Le client ouvre d'office le premier virement qui attend ses factures.
  const premierAJustifier = virements.find((v) => v.statut !== "justifie")?.id ?? null;
  const ouvert = ouvertId ?? premierAJustifier;

  const nom = societe?.raisonSociale ?? "Société";

  const bandeau = integre ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {loading ? "Chargement…" : `${virements.length} virement${virements.length > 1 ? "s" : ""} SWIFT · ${nbAJustifier} à justifier`}
      </p>
      {!isResponsableSociete && !lectureSeule && (
        <Button variant="ledger" onClick={() => { setEdition(null); setFormOuvert(true); }}>
          <Plus className="h-4 w-4" />
          Nouveau virement SWIFT
        </Button>
      )}
    </div>
  ) : (
    <SignatureLedgerBanner
      icon={Globe}
      eyebrow={isResponsableSociete ? "Demandé par le cabinet · Devises" : "Comptabilité · Devises"}
      title="État SWIFT"
      description={`${nom} · ${societe?.code ?? ""}`}
      metrics={
        isResponsableSociete
          ? [
              { label: "Virements", value: virements.length, icon: Globe, loading },
              { label: "À justifier", value: nbAJustifier, icon: AlertCircle, tone: nbAJustifier > 0 ? "warning" : "success", loading },
            ]
          : [
              { label: "Virements SWIFT", value: virements.length, icon: Globe, loading },
              { label: "TND à justifier", value: montantSwift(totalMontant), icon: Coins, loading },
              { label: "Entièrement justifiés", value: `${nbJustifies} / ${virements.length}`, icon: CheckCircle2, tone: "success", loading },
              { label: "Virements à justifier", value: nbAJustifier, icon: AlertCircle, tone: nbAJustifier > 0 ? "warning" : "success", loading },
            ]
      }
      actions={
        !isResponsableSociete && (
          <Button
            variant="ledger"
            onClick={() => {
              setEdition(null);
              setFormOuvert(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nouveau virement SWIFT
          </Button>
        )
      }
    />
  );

  // ── Vue de la société (responsable ou délégué) ──
  if (isResponsableSociete) {
    return (
      <div>
        {circuit}
        {bandeau}
        <fieldset disabled={lectureSeule} className="mt-4 min-w-0 space-y-3 border-0 p-0">
          {virements.length === 0 ? (
            <div className="overflow-hidden rounded-xl border border-accent/30 bg-card">
              <EmptyState icon={Globe} title={loading ? "Chargement…" : "Aucun virement à justifier"} description="Le cabinet vous enverra ici les virements SWIFT dont il attend les factures d'achat." />
            </div>
          ) : (
            virements.map((v) => {
              const estOuvert = ouvert === v.id;
              return (
                <section key={v.id} className={cn("overflow-hidden rounded-md border bg-card", estOuvert ? "border-accent ring-1 ring-accent" : "border-border")}>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
                    <SwiftStatutBadge statut={v.statut} />
                    <div className="min-w-[220px] flex-1">
                      <p className="font-semibold text-foreground">{v.libelle}</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {v.date ? formatDate(v.date) : "—"} · {v.banque}
                        {v.factures.length > 0 && ` · ${v.factures.length} facture${v.factures.length > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-xl font-bold tabular-nums text-foreground">
                      {montantSwift(v.montant)}
                      <small className="ml-1 text-xs font-semibold text-muted-foreground">TND demandés</small>
                    </p>
                    <div className="min-w-[150px]">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Reste à justifier</p>
                      {v.resteDevise === null ? (
                        <p className="text-[13px] font-semibold text-warning">Équivalent en devise à indiquer</p>
                      ) : (
                        <p className={cn("text-[17px] font-bold tabular-nums", v.statut === "justifie" ? "text-success" : "text-warning")}>
                          {montantSwift(Math.max(v.resteDevise, 0))} <small className="text-xs font-semibold text-muted-foreground">{v.devise}</small>
                        </p>
                      )}
                    </div>
                    <Button variant={estOuvert ? "outline" : v.statut === "justifie" ? "outline" : "default"} className="gap-2" onClick={() => setOuvertId(estOuvert ? "" : v.id)}>
                      {v.statut === "justifie" ? <Eye className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                      {estOuvert ? "Réduire" : v.statut === "justifie" ? "Voir les factures" : "Ajouter les factures"}
                    </Button>
                  </div>
                  {estOuvert && (
                    <div className="border-t border-border bg-muted/40 px-4 py-3">
                      <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Factures d'achat qui composent ce virement</h2>
                      <SwiftFacturesEditor
                        key={`${v.id}-${v.factures.length}-${v.justifie}-${v.equivalentDevise ?? 0}`}
                        virement={v}
                        onSave={async (factures, reference) => {
                          const maj = await saveFactures(v.id, factures, reference);
                          toast.success(maj.statut === "justifie" ? "Virement justifié : le cabinet est prévenu" : "Factures envoyées au cabinet");
                        }}
                      />
                    </div>
                  )}
                </section>
              );
            })
          )}
          <p className="px-1 text-xs text-muted-foreground">La date, le montant, le libellé et la banque viennent du cabinet : vous les lisez seulement.</p>
        </fieldset>
      </div>
    );
  }

  // ── Vue du comptable ──
  return (
    <div>
      {circuit}
      {bandeau}
      <div className="mt-4 overflow-hidden rounded-xl border border-accent/30 bg-card">
        {virements.length === 0 ? (
          <EmptyState
            icon={Globe}
            title={loading ? "Chargement…" : "Aucun virement SWIFT"}
            description="Ajoutez un virement : la société recevra une notification et détaillera les factures d'achat qui le composent."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary text-left text-[11px] uppercase tracking-wide text-primary-foreground">
                  <th className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 text-accent" aria-hidden="true" />Date</span></th>
                  <th className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><Text className="size-3.5 text-accent" aria-hidden="true" />Libellé</span></th>
                  <th className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5 text-accent" aria-hidden="true" />Banque</span></th>
                  <th className="px-3 py-2.5 text-right"><span className="inline-flex items-center gap-1.5"><Coins className="size-3.5 text-accent" aria-hidden="true" />Montant à justifier (TND)</span></th>
                  <th className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><Activity className="size-3.5 text-accent" aria-hidden="true" />Justifié par la société</span></th>
                  <th className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-accent" aria-hidden="true" />Statut</span></th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {virements.map((v) => (
                  <tr key={v.id} className={cn("border-b border-border border-l-[3px]", SWIFT_BANDE[v.statut])}>
                    <td className="px-3 py-3 tabular-nums">{v.date ? formatDate(v.date) : "—"}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{v.libelle}</p>
                      <p className="text-xs text-muted-foreground">
                        {!v.envoye ? "Brouillon : pas encore envoyé à la société" : v.factures.length === 0 ? "Aucune facture reçue" : `${v.factures.length} facture${v.factures.length > 1 ? "s" : ""} reçue${v.factures.length > 1 ? "s" : ""}`}
                      </p>
                    </td>
                    <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 font-semibold"><Banknote className="size-4 text-muted-foreground" aria-hidden="true" />{v.banque}</span></td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{montantSwift(v.montant)}</td>
                    <td className="px-3 py-3"><Barre virement={v} /></td>
                    <td className="px-3 py-3">
                      {v.envoye ? (
                        <SwiftStatutBadge statut={v.statut} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                          <Pencil className="size-4" aria-hidden="true" />
                          Brouillon
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        {!v.envoye && (
                          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void update(v.id, { envoyer: true }).then(() => toast.success("Virement envoyé à la société"))}>
                            <Send className="size-3.5" aria-hidden="true" />
                            Envoyer
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setVoir(v)}>
                          <Eye className="size-3.5" aria-hidden="true" />
                          Voir
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setEdition(v); setFormOuvert(true); }}>
                          <Pencil className="size-3.5" aria-hidden="true" />
                          Modifier
                        </Button>
                        <button type="button" aria-label={`Supprimer ${v.libelle}`} className="grid size-8 place-items-center text-muted-foreground hover:text-destructive" onClick={() => setASupprimer(v)}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-4 py-2.5 text-[13px] text-muted-foreground">
          <Send className="size-4" aria-hidden="true" />
          Un virement n'est visible de la société qu'une fois <b className="text-foreground">envoyé</b> : elle reçoit alors une notification avec le montant à justifier.
        </div>
      </div>

      <SwiftVirementDialog
        open={formOuvert}
        onOpenChange={setFormOuvert}
        virement={edition}
        onSubmit={async (data) => {
          if (edition) {
            await update(edition.id, data);
            toast.success(data.envoyer ? "Virement enregistré et envoyé" : "Virement modifié");
          } else {
            await create(societeId, data);
            toast.success(data.envoyer ? "Virement envoyé à la société" : "Virement enregistré en brouillon");
          }
        }}
      />

      <Dialog open={voir !== null} onOpenChange={(ouvert) => !ouvert && setVoir(null)}>
        <DialogContent className="max-w-[min(1000px,calc(100vw-1.5rem))]">
          {voir && (
            <>
              <DialogHeader className="text-left">
                <DialogTitle>{voir.libelle}</DialogTitle>
                <DialogDescription>
                  {voir.date ? formatDate(voir.date) : "—"} · {voir.banque} · {montantSwift(voir.montant)} TND à justifier
                </DialogDescription>
              </DialogHeader>
              <SwiftFacturesEditor
                virement={voir}
                libelleBouton="Enregistrer les corrections"
                onSave={async (factures, reference) => {
                  const maj = await saveFactures(voir.id, factures, reference);
                  setVoir(maj);
                  toast.success("Factures enregistrées");
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(ouvert) => !ouvert && setASupprimer(null)}
        title="Supprimer ce virement SWIFT ?"
        description={aSupprimer ? `« ${aSupprimer.libelle} » et les factures déjà reçues de la société seront supprimés.` : undefined}
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (aSupprimer) await remove(aSupprimer.id);
          toast.success("Virement supprimé");
        }}
      />
    </div>
  );
}
