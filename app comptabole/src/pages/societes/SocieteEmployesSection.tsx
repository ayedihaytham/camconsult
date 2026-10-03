import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { PasswordField } from "@/components/common/PasswordField";
import { PasswordCell } from "@/components/common/PasswordCell";
import { CARD_FIELD_INPUT, CardField } from "@/components/common/CardField";
import { Switch } from "@/components/common/Switch";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { generatePassword, scorePassword } from "@/lib/password";
import { IDENTIFIANT_RE, suggestIdentifiant } from "@/lib/identifiant";
import { ApiError } from "@/lib/api";
import { cn, initials } from "@/lib/utils";
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

type Draft = ReturnType<typeof emptyDraft>;
type FormMode = { kind: "add" } | { kind: "edit"; employe: Employe } | null;

const STRENGTH_COLOR = [
  "bg-destructive",
  "bg-destructive",
  "bg-warning",
  "bg-accent",
  "bg-success",
];

export function SocieteEmployesSection({ societeId }: { societeId: string }) {
  const employes = useSocieteEmployes(societeId);
  const addEmploye = useData((s) => s.addEmploye);
  const updateEmploye = useData((s) => s.updateEmploye);
  const deleteEmployes = useData((s) => s.deleteEmployes);

  const [mode, setMode] = useState<FormMode>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [identifiantTouched, setIdentifiantTouched] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Employe | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetValue, setResetValue] = useState("");

  const isEdit = mode?.kind === "edit";

  // Propose un identifiant à partir du prénom/nom tant que l'utilisateur n'a
  // pas tapé le sien (création uniquement).
  useEffect(() => {
    if (mode?.kind !== "add" || identifiantTouched) return;
    setDraft((d) => ({ ...d, identifiant: suggestIdentifiant(d.prenom, d.nom) }));
  }, [mode, identifiantTouched, draft.prenom, draft.nom]);

  function openAdd() {
    setDraft(emptyDraft());
    setIdentifiantTouched(false);
    setPasswordVisible(false);
    setError(null);
    setMode({ kind: "add" });
  }

  function openEdit(e: Employe) {
    setResettingId(null);
    setDraft({
      prenom: e.prenom,
      nom: e.nom,
      identifiant: e.identifiant,
      email: e.email ?? "",
      motDePasse: "",
      delegue: Boolean(e.delegue),
    });
    setIdentifiantTouched(true);
    setError(null);
    setMode({ kind: "edit", employe: e });
  }

  function validate(): string | null {
    if (draft.prenom.trim().length < 2 || draft.nom.trim().length < 2)
      return "Prénom et nom requis.";
    const identifiant = draft.identifiant.trim();
    if (identifiant.length < 3) return "Identifiant : 3 caractères minimum.";
    if (!IDENTIFIANT_RE.test(identifiant))
      return "Identifiant : minuscules, chiffres, points ou tirets uniquement — doit commencer par une lettre.";
    if (!isEdit && draft.motDePasse.length < 8)
      return "Mot de passe : 8 caractères minimum.";
    const email = draft.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Email invalide (ou laissez-le vide).";
    return null;
  }

  async function submit() {
    setError(null);
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const prenom = draft.prenom.trim();
    const nom = draft.nom.trim();
    const identifiant = draft.identifiant.trim();
    const email = draft.email.trim();
    setBusy(true);
    try {
      if (mode?.kind === "edit") {
        await updateEmploye(mode.employe.id, {
          prenom,
          nom,
          identifiant,
          email,
          delegue: draft.delegue,
        });
        toast.success("Compte modifié", { description: `${prenom} ${nom}` });
      } else {
        await addEmploye({
          prenom,
          nom,
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
          description: `${prenom} ${nom}`,
        });
      }
      setMode(null);
    } catch (err) {
      // Le store affiche déjà le message du serveur ; on garde le panneau ouvert.
      setError(
        err instanceof ApiError ? err.message : "Impossible d'enregistrer ce compte.",
      );
    } finally {
      setBusy(false);
    }
  }

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

  const responsables = employes.filter((e) => !e.delegue);
  const delegues = employes.filter((e) => e.delegue);
  const groups = [
    { key: "resp", title: "Responsables", hint: "Donnent les tâches", items: responsables },
    { key: "deleg", title: "Délégués", hint: "Reçoivent les tâches", items: delegues },
  ].filter((g) => g.items.length > 0);

  const { score, level } = scorePassword(draft.motDePasse);
  const roleLabel = draft.delegue ? "délégué" : "responsable";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          Responsables et délégués
        </p>
        <Button size="sm" variant="outline" className="h-10 rounded-lg px-4" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {employes.length === 0 && (
        <p className="rounded-xl border border-dashed border-accent/40 px-4 py-5 text-center text-sm text-muted-foreground">
          Aucun compte. Ajoutez le responsable de cette société, puis ses
          délégués, qui recevront les tâches qu'il leur confie.
        </p>
      )}

      {groups.map((group) => (
        <section key={group.key} aria-label={group.title} className="space-y-3">
          <p className="flex items-baseline gap-2">
            <span className="font-serif text-base font-medium text-primary">{group.title}</span>
            <span className="text-sm text-muted-foreground">{group.hint}</span>
          </p>
          <ul className="space-y-3">
            {group.items.map((e) => {
              const actif = e.statut === "actif";
              return (
                <li
                  key={e.id}
                  className="overflow-hidden rounded-xl border border-accent/30 bg-card"
                >
                  <div className="flex items-start gap-3.5 p-4">
                    <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-bold text-primary">
                      {initials(`${e.prenom} ${e.nom}`)}
                      <span
                        className={cn(
                          "absolute bottom-0 left-0 size-3 rounded-full border-2 border-card",
                          actif ? "bg-success" : "bg-muted-foreground/50",
                        )}
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-serif text-lg font-medium leading-tight text-primary">
                          {e.prenom} {e.nom}
                        </p>
                        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {e.delegue ? "Délégué" : "Responsable"}
                        </span>
                      </div>
                      <p className="mt-0.5 break-all text-sm text-muted-foreground">
                        {e.identifiant}
                        {e.email ? ` · ${e.email}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <PasswordCell value={e.motDePasse} />
                        {e.doitChangerMotDePasse && (
                          <span className="rounded-full bg-warning/12 px-2 py-0.5 text-[0.7rem] font-semibold text-warning">
                            Doit changer son mot de passe
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {resettingId === e.id && (
                    <div className="space-y-2 border-t border-accent/25 px-4 py-3">
                      <Label className="text-xs">Nouveau mot de passe</Label>
                      <PasswordField value={resetValue} onValueChange={setResetValue} />
                      <p className="text-xs text-muted-foreground">
                        Communiquez-le à {e.prenom} — il devra en choisir un nouveau,
                        connu de lui seul, à sa prochaine connexion.
                      </p>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setResettingId(null)}>
                          Annuler
                        </Button>
                        <Button size="sm" variant="ledger" onClick={() => confirmReset(e.id)}>
                          Réinitialiser
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 border-t border-accent/25 bg-accent/[0.06] px-4 py-3">
                    <div className="flex items-center gap-2.5 text-sm font-medium text-primary">
                      <Switch
                        checked={actif}
                        onCheckedChange={(on) =>
                          updateEmploye(e.id, { statut: on ? "actif" : "inactif" })
                        }
                        label={actif ? `Désactiver ${e.prenom}` : `Activer ${e.prenom}`}
                      />
                      {actif ? "Actif" : "Inactif"}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => openEdit(e)}
                        title="Modifier"
                        aria-label={`Modifier ${e.prenom} ${e.nom}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => {
                          setResettingId(resettingId === e.id ? null : e.id);
                          setResetValue(generatePassword());
                        }}
                        title="Réinitialiser le mot de passe"
                        aria-label={`Réinitialiser le mot de passe de ${e.prenom}`}
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setToDelete(e)}
                        title="Supprimer"
                        aria-label={`Supprimer ${e.prenom} ${e.nom}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Sheet
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setMode(null);
        }}
      >
        <SheetContent side="right" className="gap-0 p-0 sm:max-w-md">
          <div className="flex shrink-0 items-center gap-3 border-b border-accent/30 px-5 py-5 pr-12">
            <button
              type="button"
              onClick={() => setMode(null)}
              disabled={busy}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <SheetTitle className="font-serif text-2xl font-medium text-primary">
              {isEdit
                ? `Modifier le ${roleLabel}`
                : draft.delegue
                  ? "Nouveau délégué"
                  : "Nouveau responsable"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Informations du compte de la société.
            </SheetDescription>
          </div>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(ev) => {
              ev.preventDefault();
              void submit();
            }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-6">
              <div className="space-y-2">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Rôle
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: false, label: "Responsable", hint: "Donne les tâches" },
                    { value: true, label: "Délégué", hint: "Reçoit les tâches" },
                  ].map((o) => {
                    const selected = draft.delegue === o.value;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setDraft((d) => ({ ...d, delegue: o.value }))}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left transition-colors",
                          selected
                            ? "border-primary bg-card shadow-[0_0_0_3px_hsl(var(--accent)/0.22)]"
                            : "border-accent/35 bg-secondary/60 hover:border-accent",
                        )}
                      >
                        <span className="flex items-center gap-2 font-serif text-lg font-medium text-primary">
                          {o.label}
                          {selected && <span className="size-2 rotate-45 bg-accent" aria-hidden="true" />}
                        </span>
                        <span className="block text-sm text-muted-foreground">{o.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CardField id="emp-prenom" label="Prénom">
                  <input
                    id="emp-prenom"
                    autoFocus
                    value={draft.prenom}
                    onChange={(ev) => setDraft((d) => ({ ...d, prenom: ev.target.value }))}
                    className={CARD_FIELD_INPUT}
                  />
                </CardField>
                <CardField id="emp-nom" label="Nom">
                  <input
                    id="emp-nom"
                    value={draft.nom}
                    onChange={(ev) => setDraft((d) => ({ ...d, nom: ev.target.value }))}
                    className={CARD_FIELD_INPUT}
                  />
                </CardField>
              </div>

              <CardField
                id="emp-identifiant"
                label="Identifiant"
                hint={
                  isEdit
                    ? `C'est avec cet identifiant que ${draft.prenom || "la personne"} se connecte — prévenez-la s'il change.`
                    : !identifiantTouched
                      ? "Proposé à partir du prénom/nom — modifiable"
                      : "Minuscules, chiffres, points ou tirets uniquement — doit commencer par une lettre"
                }
              >
                <input
                  id="emp-identifiant"
                  value={draft.identifiant}
                  onChange={(ev) => {
                    setIdentifiantTouched(true);
                    setDraft((d) => ({ ...d, identifiant: ev.target.value }));
                  }}
                  placeholder="prenom.nom"
                  className={CARD_FIELD_INPUT}
                />
              </CardField>

              <CardField id="emp-email" label="Email (facultatif)">
                <input
                  id="emp-email"
                  type="email"
                  value={draft.email}
                  onChange={(ev) => setDraft((d) => ({ ...d, email: ev.target.value }))}
                  placeholder="marwen@exemple.com"
                  className={CARD_FIELD_INPUT}
                />
              </CardField>

              {!isEdit && (
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <CardField id="emp-mdp" label="Mot de passe" className="flex-1">
                      <div className="relative">
                        <input
                          id="emp-mdp"
                          type={passwordVisible ? "text" : "password"}
                          value={draft.motDePasse}
                          onChange={(ev) => setDraft((d) => ({ ...d, motDePasse: ev.target.value }))}
                          autoComplete="new-password"
                          className={cn(CARD_FIELD_INPUT, "pr-8 font-mono")}
                        />
                        <button
                          type="button"
                          onClick={() => setPasswordVisible((v) => !v)}
                          className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={passwordVisible ? "Masquer" : "Afficher"}
                        >
                          {passwordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </CardField>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft((d) => ({ ...d, motDePasse: generatePassword() }));
                        setPasswordVisible(true);
                      }}
                      aria-label="Générer un mot de passe"
                      className="grid w-14 shrink-0 place-items-center self-stretch rounded-lg border border-accent/35 bg-secondary/60 text-primary transition-colors hover:border-accent hover:bg-card"
                    >
                      <RefreshCw className="h-5 w-5" />
                    </button>
                  </div>
                  {draft.motDePasse.length > 0 && (
                    <div className="flex items-center gap-4">
                      <div className="flex flex-1 gap-2">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-colors",
                              i < score ? STRENGTH_COLOR[score] : "bg-border",
                            )}
                          />
                        ))}
                      </div>
                      <span className="w-20 text-right text-sm capitalize text-muted-foreground">{level}</span>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-accent/30 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-lg px-6"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="ledger"
                className="h-12 rounded-lg px-6 text-sm uppercase tracking-[0.14em]"
                disabled={busy}
              >
                {isEdit
                  ? "Enregistrer"
                  : draft.delegue
                    ? "Ajouter le délégué"
                    : "Ajouter le responsable"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

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
