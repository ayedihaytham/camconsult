import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/common/PasswordField";
import { PasswordCell } from "@/components/common/PasswordCell";
import { StatutDot } from "@/components/ledger/StatusDot";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { generatePassword } from "@/lib/password";
import { IDENTIFIANT_RE, suggestIdentifiant } from "@/lib/identifiant";
import { ApiError } from "@/lib/api";
import { useData, useSocieteEmployes } from "@/store/data";
import type { Employe, EmployePermissions } from "@/types";

const SOC_EMP_PERMS: EmployePermissions = {
  consulterDossiers: true,
  deposerFichiers: false,
  modifierSocietes: false,
  supprimer: false,
  messagerie: true,
};

const emptyDraft = () => ({
  prenom: "",
  nom: "",
  identifiant: "",
  email: "",
  motDePasse: generatePassword(),
  delegue: false,
});

export function SocieteEmployesSection({ societeId }: { societeId: string }) {
  const employes = useSocieteEmployes(societeId);
  const addEmploye = useData((s) => s.addEmploye);
  const updateEmploye = useData((s) => s.updateEmploye);
  const deleteEmployes = useData((s) => s.deleteEmployes);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [identifiantTouched, setIdentifiantTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Employe | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetValue, setResetValue] = useState("");

  // Propose un identifiant à partir du prénom/nom (comme pour les
  // collaborateurs) tant que l'utilisateur n'a pas tapé le sien.
  useEffect(() => {
    if (!adding || identifiantTouched) return;
    setDraft((d) => ({ ...d, identifiant: suggestIdentifiant(d.prenom, d.nom) }));
  }, [adding, identifiantTouched, draft.prenom, draft.nom]);

  async function confirmReset(id: string) {
    if (resetValue.length < 8) {
      toast.error("Mot de passe : 8 caractères minimum.");
      return;
    }
    await updateEmploye(id, { motDePasse: resetValue });
    toast.success("Mot de passe réinitialisé", {
      description: "Il devra en choisir un nouveau à sa prochaine connexion.",
    });
    setResettingId(null);
    setResetValue("");
  }

  async function submit() {
    setError(null);
    if (draft.prenom.trim().length < 2 || draft.nom.trim().length < 2) {
      setError("Prénom et nom requis.");
      return;
    }
    const identifiant = draft.identifiant.trim();
    if (identifiant.length < 3) {
      setError("Identifiant : 3 caractères minimum.");
      return;
    }
    if (!IDENTIFIANT_RE.test(identifiant)) {
      setError(
        "Identifiant : minuscules, chiffres, points ou tirets uniquement — doit commencer par une lettre.",
      );
      return;
    }
    if (draft.motDePasse.length < 8) {
      setError("Mot de passe : 8 caractères minimum.");
      return;
    }
    const email = draft.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email invalide (ou laissez-le vide).");
      return;
    }
    try {
      await addEmploye({
        prenom: draft.prenom.trim(),
        nom: draft.nom.trim(),
        identifiant,
        motDePasse: draft.motDePasse,
        type: "Assistant",
        role: "societe_employe",
        societeId,
        email,
        statut: "actif",
        societesAssignees: [],
        permissions: SOC_EMP_PERMS,
        delegue: draft.delegue,
      });
      toast.success(draft.delegue ? "Délégué ajouté" : "Responsable ajouté", {
        description: `${draft.prenom} ${draft.nom}`,
      });
      setDraft(emptyDraft());
      setIdentifiantTouched(false);
      setAdding(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible d'ajouter ce compte.",
      );
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          Responsables et délégués
        </p>
        {!adding && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(emptyDraft());
              setIdentifiantTouched(false);
              setError(null);
              setAdding(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        )}
      </div>

      {employes.length === 0 && !adding && (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          Aucun compte. Ajoutez le responsable de cette société, puis ses
          délégués, qui recevront les tâches qu'il leur confie.
        </p>
      )}

      <ul className="space-y-2">
        {employes.map((e) => (
          <li
            key={e.id}
            className="rounded-xl border border-border p-3 transition-colors hover:bg-secondary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium text-foreground">
                    {e.prenom} {e.nom}
                  </span>
                  <StatutDot statut={e.statut} />
                  <span
                    className={
                      e.delegue
                        ? "shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground"
                        : "shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-primary"
                    }
                  >
                    {e.delegue ? "Délégué" : "Responsable"}
                  </span>
                </div>
                <div className="pl-6 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {e.identifiant}
                  </span>
                  <span className="mx-1.5">·</span>
                  <PasswordCell value={e.motDePasse} />
                  {e.doitChangerMotDePasse && (
                    <span className="ml-1.5 rounded-full bg-warning/12 px-1.5 py-0.5 text-[0.65rem] font-semibold text-warning">
                      Doit changer son mot de passe
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() =>
                    updateEmploye(e.id, {
                      statut: e.statut === "actif" ? "inactif" : "actif",
                    })
                  }
                >
                  {e.statut === "actif" ? "Désactiver" : "Activer"}
                </button>
                <button
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() => {
                    setResettingId(resettingId === e.id ? null : e.id);
                    setResetValue(generatePassword());
                  }}
                  title="Réinitialiser le mot de passe"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setToDelete(e)}
                  title="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {resettingId === e.id && (
              <div className="mt-2.5 space-y-2 border-t border-border pt-2.5 pl-6">
                <Label className="text-xs">Nouveau mot de passe</Label>
                <PasswordField value={resetValue} onValueChange={setResetValue} />
                <p className="text-xs text-muted-foreground">
                  Communiquez-le à {e.prenom} — il devra en choisir un nouveau,
                  connu de lui seul, à sa prochaine connexion.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResettingId(null)}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    variant="ledger"
                    onClick={() => confirmReset(e.id)}
                  >
                    Réinitialiser
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {draft.delegue ? "Nouveau délégué" : "Nouveau responsable"}
            </p>
            <button
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() => setAdding(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: false, label: "Responsable", hint: "Donne les tâches" },
                { value: true, label: "Délégué", hint: "Reçoit les tâches" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={draft.delegue === o.value}
                  onClick={() => setDraft((d) => ({ ...d, delegue: o.value }))}
                  className={
                    "rounded-lg border px-3 py-2 text-left transition-colors " +
                    (draft.delegue === o.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary")
                  }
                >
                  <span className="block text-sm font-medium text-foreground">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prénom</Label>
              <Input
                value={draft.prenom}
                onChange={(ev) =>
                  setDraft((d) => ({ ...d, prenom: ev.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={draft.nom}
                onChange={(ev) =>
                  setDraft((d) => ({ ...d, nom: ev.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Identifiant</Label>
            <Input
              value={draft.identifiant}
              onChange={(ev) => {
                setIdentifiantTouched(true);
                setDraft((d) => ({ ...d, identifiant: ev.target.value }));
              }}
              placeholder="prenom.nom"
            />
            <p className="text-xs text-muted-foreground">
              {!identifiantTouched
                ? "Proposé à partir du prénom/nom — modifiable"
                : "Minuscules, chiffres, points ou tirets — doit commencer par une lettre"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Email (facultatif)</Label>
            <Input
              type="email"
              value={draft.email}
              onChange={(ev) =>
                setDraft((d) => ({ ...d, email: ev.target.value }))
              }
              placeholder="marwen@exemple.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mot de passe</Label>
            <PasswordField
              value={draft.motDePasse}
              onValueChange={(v) => setDraft((d) => ({ ...d, motDePasse: v }))}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>
              Annuler
            </Button>
            <Button size="sm" variant="ledger" onClick={submit}>
              {draft.delegue ? "Ajouter le délégué" : "Ajouter le responsable"}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete?.delegue ? "Supprimer ce délégué ?" : "Supprimer ce responsable ?"}
        description={
          <>
            Le compte de{" "}
            <span className="font-medium text-foreground">
              {toDelete ? `${toDelete.prenom} ${toDelete.nom}` : ""}
            </span>{" "}
            sera supprimé et perdra l'accès aux documents partagés.
          </>
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) deleteEmployes([toDelete.id]);
          setToDelete(null);
        }}
      />
    </div>
  );
}
