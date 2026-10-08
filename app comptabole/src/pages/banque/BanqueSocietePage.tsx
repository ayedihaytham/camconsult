import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftRight, Download, FileUp, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocieteById } from "@/store/data";
import { useBanque, type CompteInput, type MouvementInput } from "@/store/banque";
import { controleSolde, coursAvant, moisDesMouvements, soldesCourants, totaux } from "@/lib/banque";
import { exporterCompte } from "@/lib/banqueExport";
import { fmtMontant } from "@/lib/stockRecap";
import { cn } from "@/lib/utils";
import type { MouvementBancaire } from "@/types";
import { CompteDialog } from "./CompteDialog";
import { ImportReleveDialog } from "./ImportReleveDialog";
import { MouvementDialog } from "./MouvementDialog";
import { MouvementsTable } from "./MouvementsTable";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const libelleMois = (m: string) => `${MOIS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export function BanqueSocietePage() {
  const { societeId = "" } = useParams();
  const navigate = useNavigate();
  const societe = useSocieteById(societeId);
  const { lectureSeule } = usePermissions();

  const comptes = useBanque((s) => s.comptes);
  const tous = useBanque((s) => s.mouvements);
  const loading = useBanque((s) => s.loading);
  const fetchEtat = useBanque((s) => s.fetchEtat);
  const clear = useBanque((s) => s.clear);
  const createCompte = useBanque((s) => s.createCompte);
  const updateCompte = useBanque((s) => s.updateCompte);
  const removeCompte = useBanque((s) => s.removeCompte);
  const addMouvement = useBanque((s) => s.addMouvement);
  const importMouvements = useBanque((s) => s.importMouvements);
  const updateMouvement = useBanque((s) => s.updateMouvement);
  const removeMouvement = useBanque((s) => s.removeMouvement);

  const [choisi, setChoisi] = useState<string | null>(null);
  const [mois, setMois] = useState("tous");
  const [vueSociete, setVueSociete] = useState(false);
  const [compteOuvert, setCompteOuvert] = useState<"nouveau" | "modifier" | null>(null);
  const [importOuvert, setImportOuvert] = useState(false);
  const [mouvementOuvert, setMouvementOuvert] = useState(false);
  const [editing, setEditing] = useState<MouvementBancaire | null>(null);
  const [toDelete, setToDelete] = useState<MouvementBancaire | null>(null);
  const [compteToDelete, setCompteToDelete] = useState(false);

  useEffect(() => {
    void fetchEtat(societeId).catch(() => undefined);
    return () => clear();
  }, [societeId, fetchEtat, clear]);

  const compte = comptes.find((c) => c.id === choisi) ?? comptes[0] ?? null;
  const mouvements = useMemo(() => tous.filter((m) => m.compteId === compte?.id), [tous, compte]);
  const soldes = useMemo(() => (compte ? soldesCourants(compte, mouvements) : new Map<string, number>()), [compte, mouvements]);
  const moisDispo = useMemo(() => moisDesMouvements(mouvements), [mouvements]);
  const affiches = useMemo(() => (mois === "tous" ? mouvements : mouvements.filter((m) => m.dateOp.startsWith(mois))), [mouvements, mois]);
  const sommes = totaux(affiches);
  const controle = compte ? controleSolde(compte, mouvements) : null;
  const nonRapproches = tous.filter((m) => m.type === "paiement_fournisseur" && m.debit > 0 && !m.reglementId).length;

  // Le mois choisi n'existe plus (autre compte, suppression) : retour à tous les mois.
  useEffect(() => {
    if (mois !== "tous" && !moisDispo.includes(mois)) setMois("tous");
  }, [mois, moisDispo]);

  async function enregistrerCompte(data: CompteInput) {
    if (compteOuvert === "modifier" && compte) {
      await updateCompte(compte.id, data);
      toast.success("Compte modifié");
    } else {
      await createCompte(societeId, data);
      toast.success("Compte créé");
      setChoisi(null);
    }
  }

  async function enregistrerMouvement(data: MouvementInput) {
    if (!compte) return;
    if (editing) {
      await updateMouvement(editing.id, data);
      toast.success("Mouvement modifié");
    } else {
      await addMouvement(compte.id, data);
      toast.success("Mouvement ajouté");
    }
    setEditing(null);
  }

  /** Ouvre le suivi fournisseur avec un règlement prérempli d'après ce paiement bancaire. */
  function rapprocher(m: MouvementBancaire) {
    // Cours de la dernière opération de change de la société avant ce paiement : proposé pour un règlement en devise.
    const cours = coursAvant(tous, m.dateOp);
    navigate(`/fournisseurs/${societeId}`, {
      state: {
        prefill: {
          mouvementId: m.id,
          date: m.dateOp,
          montant: m.debit,
          libelle: `${m.libelle} ${m.details}`.trim(),
          reference: m.details || m.numPiece,
          banque: compte?.banque ?? "",
          devise: compte?.devise ?? "TND",
          ...(cours ? { cours } : {}),
        },
      },
    });
  }

  return (
    <div>
      <div data-tour="banque-summary">
        <SignatureLedgerBanner
          icon={Wallet}
          eyebrow="Clients & travail · Banque"
          title="Suivi bancaire"
          description={`${societe?.raisonSociale ?? "Société"} · ${societe?.code ?? ""}`}
          metrics={[
            { label: comptes.length > 1 ? "Comptes" : "Compte", value: comptes.length, loading },
            { label: mouvements.length > 1 ? "Mouvements" : "Mouvement", value: mouvements.length },
            { label: "Paiements à rapprocher", value: nonRapproches, tone: nonRapproches > 0 ? "warning" : "default" },
            ...(controle && compte ? [{ label: `Solde calculé (${compte.devise})`, value: fmtMontant(controle.calcule) }] : []),
          ]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {compte && (
                <Button variant="outline" className="signature-ledger__action" onClick={() => void exporterCompte(compte, mouvements)}>
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
              )}
              {!lectureSeule && compte && (
                <>
                  <Button variant="outline" className="signature-ledger__action" onClick={() => setImportOuvert(true)}>
                    <FileUp className="h-4 w-4" />
                    Importer un relevé
                  </Button>
                  <Button
                    variant="ledger"
                    onClick={() => {
                      setEditing(null);
                      setMouvementOuvert(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Nouveau mouvement
                  </Button>
                </>
              )}
              {!lectureSeule && !compte && (
                <Button variant="ledger" onClick={() => setCompteOuvert("nouveau")}>
                  <Plus className="h-4 w-4" />
                  Nouveau compte
                </Button>
              )}
            </div>
          }
        />
      </div>

      {!compte ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-accent/30 bg-card px-4 py-14 text-center">
          <span className="grid size-[70px] place-items-center rounded-full bg-accent/15 text-primary">
            <Wallet className="size-7" aria-hidden="true" />
          </span>
          <p className="font-serif text-2xl font-medium text-primary">{loading ? "Chargement…" : "Aucun compte bancaire"}</p>
          <p className="max-w-md text-base text-muted-foreground">
            Créez un compte (banque, devise, solde de départ) puis importez son relevé pour suivre ses mouvements et rapprocher les paiements des fournisseurs.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-accent/30 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/25 px-5 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <LedgerSegmented
                value={compte.id}
                onChange={(v) => {
                  setChoisi(v);
                  setMois("tous");
                }}
                options={comptes.map((c) => ({ value: c.id, label: `${c.banque} ${c.devise}` }))}
                ariaLabel="Choisir un compte"
              />
              {!lectureSeule && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setCompteOuvert("nouveau")}>
                    <Plus className="h-3.5 w-3.5" />
                    Compte
                  </Button>
                  <button
                    type="button"
                    aria-label="Modifier ce compte"
                    onClick={() => setCompteOuvert("modifier")}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer ce compte"
                    onClick={() => setCompteToDelete(true)}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={mois} onValueChange={setMois}>
                <SelectTrigger className="h-9 w-48" aria-label="Filtrer par mois">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les mois</SelectItem>
                  {moisDispo.map((m) => (
                    <SelectItem key={m} value={m}>
                      {libelleMois(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant={vueSociete ? "ledger" : "outline"} size="sm" aria-pressed={vueSociete} onClick={() => setVueSociete((v) => !v)}>
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Vue société
              </Button>
            </div>
          </div>

          {affiches.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              {mouvements.length === 0 ? "Aucun mouvement : importez le relevé de la banque ou ajoutez-en un." : "Aucun mouvement ce mois-ci."}
            </p>
          ) : (
            <MouvementsTable
              societeId={societeId}
              mouvements={affiches}
              soldes={soldes}
              vueSociete={vueSociete}
              lectureSeule={lectureSeule}
              onEdit={(m) => {
                setEditing(m);
                setMouvementOuvert(true);
              }}
              onDelete={setToDelete}
              onRapprocher={rapprocher}
            />
          )}

          {controle && (
            <dl className="grid gap-x-6 gap-y-2 border-t-2 border-accent/40 bg-accent/[0.07] px-5 py-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <Cle label="Solde de départ" valeur={`${fmtMontant(compte.soldeDepart)} ${compte.devise}`} />
              <Cle label={vueSociete ? "Total débit société" : "Total débit"} valeur={fmtMontant(vueSociete ? sommes.credit : sommes.debit)} />
              <Cle label={vueSociete ? "Total crédit société" : "Total crédit"} valeur={fmtMontant(vueSociete ? sommes.debit : sommes.credit)} />
              <Cle label="Solde calculé" valeur={`${fmtMontant(controle.calcule)} ${compte.devise}`} fort />
              <Cle label="Solde réel (relevé)" valeur={compte.soldeReel == null ? "—" : `${fmtMontant(compte.soldeReel)} ${compte.devise}`} />
              <Cle
                label="Écart"
                valeur={controle.ecart == null ? "—" : fmtMontant(controle.ecart)}
                fort
                alerte={controle.ecart !== null && controle.ecart !== 0}
              />
            </dl>
          )}
        </div>
      )}

      <CompteDialog
        open={compteOuvert !== null}
        onOpenChange={(o) => !o && setCompteOuvert(null)}
        compte={compteOuvert === "modifier" ? compte : null}
        onSubmit={enregistrerCompte}
      />

      {compte && (
        <>
          <ImportReleveDialog
            open={importOuvert}
            onOpenChange={setImportOuvert}
            devise={compte.devise}
            proposerSoldeDepart={mouvements.length === 0}
            onImport={async (liste, maj) => {
              // Solde de départ et solde réel du relevé : mis à jour avec le compte, avant l'import des mouvements.
              if ((maj.ouverture && maj.ouverture.date) || maj.soldeReel) {
                await updateCompte(compte.id, {
                  ...compte,
                  ...(maj.ouverture?.date ? { soldeDepart: maj.ouverture.montant, dateDepart: maj.ouverture.date } : {}),
                  ...(maj.soldeReel ? { soldeReel: maj.soldeReel.montant, dateReel: maj.soldeReel.date } : {}),
                });
              }
              const { importes, ignores } = await importMouvements(compte.id, liste);
              toast.success(`${importes} mouvement${importes > 1 ? "s" : ""} importé${importes > 1 ? "s" : ""}${ignores ? ` · ${ignores} déjà présent${ignores > 1 ? "s" : ""}` : ""}`);
            }}
          />
          <MouvementDialog
            open={mouvementOuvert}
            onOpenChange={(o) => {
              setMouvementOuvert(o);
              if (!o) setEditing(null);
            }}
            mouvement={editing}
            devise={compte.devise}
            onSubmit={enregistrerMouvement}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer ce mouvement ?"
        description={toDelete?.reglementId ? "Il est rapproché d'un règlement fournisseur : le règlement est conservé, sans lien bancaire." : "Cette ligne du relevé sera supprimée."}
        confirmLabel="Supprimer"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          await removeMouvement(toDelete.id);
          toast.success("Mouvement supprimé");
          setToDelete(null);
        }}
      />

      <ConfirmDialog
        open={compteToDelete}
        onOpenChange={setCompteToDelete}
        title="Supprimer ce compte ?"
        description="Le compte et tous ses mouvements seront supprimés. Les règlements fournisseur déjà rapprochés sont conservés."
        confirmLabel="Supprimer le compte"
        destructive
        onConfirm={async () => {
          if (!compte) return;
          await removeCompte(compte.id);
          toast.success("Compte supprimé");
          setCompteToDelete(false);
          setChoisi(null);
        }}
      />
    </div>
  );
}

function Cle({ label, valeur, fort = false, alerte = false }: { label: string; valeur: string; fort?: boolean; alerte?: boolean }) {
  return (
    <div>
      <dt className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 tabular-nums", fort ? "font-bold text-primary" : "text-foreground", alerte && "text-destructive")}>{valeur}</dd>
    </div>
  );
}
