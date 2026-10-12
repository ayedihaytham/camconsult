import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AtSign,
  Eye,
  EyeOff,
  KeyRound,
  Info,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/common/PasswordField";
import { Switch } from "@/components/common/Switch";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { generatePassword, scorePassword } from "@/lib/password";
import { IDENTIFIANT_RE, suggestIdentifiant } from "@/lib/identifiant";
import { api, ApiError } from "@/lib/api";
import { cn, initials } from "@/lib/utils";
import { useData, useSocieteById, useSocieteEmployes } from "@/store/data";
import type { EmailEnvoi, Employe, EmployePermissions } from "@/types";

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

export function SocieteEmployesSection({ societeId, peutSupprimer = true }: { societeId: string; peutSupprimer?: boolean }) {
  const employes = useSocieteEmployes(societeId);
  const societe = useSocieteById(societeId);
  const addEmploye = useData((s) => s.addEmploye);
  const updateEmploye = useData((s) => s.updateEmploye);
  const deleteEmployes = useData((s) => s.deleteEmployes);

  const [mode, setMode] = useState<FormMode>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [identifiantTouched, setIdentifiantTouched] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
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
    if (!email) return "Email requis.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email invalide.";
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
        const cree = await addEmploye({
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
        annonceEmail(draft.delegue ? "Délégué ajouté" : "Responsable ajouté", `${prenom} ${nom}`, email, cree?.emailEnvoi);
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

  /** Confirme l'action et dit si l'email d'identifiants est bien parti (résultat renvoyé par le serveur). */
  function annonceEmail(titre: string, description: string, email: string | undefined, envoi: EmailEnvoi | undefined) {
    if (envoi === "envoye") toast.success(titre, { description: `${description} — email envoyé à ${email}` });
    else if (envoi === "smtp") toast.warning(titre, { description: `${description} — email non envoyé : l'envoi d'emails n'est pas configuré sur le serveur.` });
    else if (envoi === "echec") toast.warning(titre, { description: `${description} — l'email n'a pas pu être envoyé à ${email}.` });
    else toast.success(titre, { description });
  }

  /** Renvoie les identifiants par email au compte ouvert et affiche le résultat réel. */
  async function envoyerAcces(e: Employe) {
    setEnvoiEnCours(true);
    try {
      const { emailEnvoi } = await api.post<{ emailEnvoi: EmailEnvoi }>(`/employes/${e.id}/envoyer-acces`);
      annonceEmail("Identifiants envoyés", `${e.prenom} ${e.nom}`, e.email, emailEnvoi);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Envoi impossible.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function confirmReset(id: string) {
    if (resetValue.length < 8) {
      toast.error("Mot de passe : 8 caractères minimum.");
      return;
    }
    const e = await updateEmploye(id, { motDePasse: resetValue });
    annonceEmail("Mot de passe réinitialisé", "Il devra en choisir un nouveau à sa prochaine connexion.", e?.email, e?.emailEnvoi);
    setResettingId(null);
    setResetValue("");
  }

  const responsables = employes.filter((e) => !e.delegue);
  const delegues = employes.filter((e) => e.delegue);
  const modifie =
    mode?.kind === "edit"
      ? draft.prenom !== mode.employe.prenom ||
        draft.nom !== mode.employe.nom ||
        draft.identifiant !== mode.employe.identifiant ||
        draft.email !== (mode.employe.email ?? "") ||
        draft.delegue !== Boolean(mode.employe.delegue)
      : true;
  const probleme = mode ? validate() : null;
  const { score, level } = scorePassword(draft.motDePasse);
  const roleLabel = draft.delegue ? "délégué" : "responsable";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
          <Users className="size-4 text-accent" aria-hidden="true" />
          Responsables et délégués
          <span className="rounded-full border border-border bg-muted px-2 text-[11px] font-semibold tracking-normal text-muted-foreground">{employes.length}</span>
        </h4>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 px-3 text-xs font-semibold" onClick={openAdd}>
          <Plus className="size-3.5" aria-hidden="true" />
          Ajouter
        </Button>
      </div>

      {employes.length === 0 && (
        <p className="rounded-lg border border-dashed border-accent/40 px-4 py-5 text-center text-sm text-muted-foreground">
          Aucun compte. Ajoutez le responsable de cette société, puis ses
          délégués, qui recevront les tâches qu'il leur confie.
        </p>
      )}

      {[...responsables, ...delegues].length > 0 && (
        <ul className="space-y-2.5" aria-label="Responsables et délégués">
          {[...responsables, ...delegues].map((e) => {
            const actif = e.statut === "actif";
            return (
              <li key={e.id} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3 p-3">
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-extrabold text-accent">
                    {initials(`${e.prenom} ${e.nom}`)}
                    <span
                      className={cn(
                        "absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-card",
                        actif ? "bg-success" : "bg-muted-foreground/50",
                      )}
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="truncate text-sm font-semibold text-primary">{e.prenom} {e.nom}</p>
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-px text-[11.5px] font-bold text-primary">
                        {e.delegue ? "Délégué" : "Responsable"}
                      </span>
                    </div>
                    <p className="break-all text-xs text-muted-foreground">
                      {e.identifiant}
                      {e.email ? ` · ${e.email}` : ""}
                    </p>
                    {e.doitChangerMotDePasse && (
                      <span className="mt-1 inline-flex items-center gap-1.5 rounded bg-warning/10 px-2 py-0.5 text-[11.5px] font-bold text-warning">
                        <AlertCircle className="size-3.5" aria-hidden="true" />
                        Doit changer son mot de passe
                      </span>
                    )}
                  </div>
                </div>

                {resettingId === e.id && (
                  <div className="space-y-2 border-t border-border px-3 py-3">
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

                <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-3 py-2">
                  <div className="mr-auto flex items-center gap-2 text-[12.5px] font-bold text-foreground">
                    <Switch
                      checked={actif}
                      onCheckedChange={(on) =>
                        updateEmploye(e.id, { statut: on ? "actif" : "inactif" })
                      }
                      label={actif ? `Désactiver ${e.prenom}` : `Activer ${e.prenom}`}
                    />
                    {actif ? "Actif" : "Inactif"}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2.5 text-xs font-semibold shadow-none"
                    onClick={() => openEdit(e)}
                    aria-label={`Modifier ${e.prenom} ${e.nom}`}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Modifier
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2.5 text-xs font-semibold shadow-none"
                    onClick={() => {
                      setResettingId(resettingId === e.id ? null : e.id);
                      setResetValue(generatePassword());
                    }}
                    aria-label={`Réinitialiser le mot de passe de ${e.prenom}`}
                  >
                    <KeyRound className="size-3.5" aria-hidden="true" />
                    Accès
                  </Button>
                  {peutSupprimer && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 border-destructive/30 px-2.5 text-xs font-semibold text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setToDelete(e)}
                      aria-label={`Supprimer ${e.prenom} ${e.nom}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Supprimer
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setMode(null);
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[520px] flex-col gap-0 overflow-hidden rounded-lg p-0">
          <div className="flex shrink-0 items-center gap-3.5 border-b border-border px-[18px] py-4 pr-14">
            <span
              aria-hidden="true"
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-full text-[15px] font-extrabold",
                draft.prenom.trim() || draft.nom.trim()
                  ? "bg-primary text-accent"
                  : "border border-dashed border-input bg-muted/60 text-muted-foreground/70",
              )}
            >
              {draft.prenom.trim() || draft.nom.trim() ? initials(`${draft.prenom} ${draft.nom}`) : "··"}
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-serif text-[22px] font-semibold leading-tight text-primary">
                {isEdit
                  ? `Modifier le ${roleLabel}`
                  : draft.delegue
                    ? "Nouveau délégué"
                    : "Nouveau responsable"}
              </DialogTitle>
              <DialogDescription className="truncate text-[12.5px] text-muted-foreground">
                {isEdit
                  ? `${`${draft.prenom} ${draft.nom}`.trim()}${societe ? ` · ${societe.raisonSociale}` : ""}`
                  : societe
                    ? `Société ${societe.raisonSociale}`
                    : "Informations du compte de la société."}
              </DialogDescription>
            </div>
          </div>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(ev) => {
              ev.preventDefault();
              void submit();
            }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-[18px] py-3.5">
              <section className="space-y-2.5">
                <h3 id="emp-role-titre" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
                  <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
                  Rôle
                </h3>
                <div role="radiogroup" aria-labelledby="emp-role-titre" className="grid grid-cols-2 gap-2.5">
                  {[
                    { value: false, label: "Responsable", hint: "Donne les tâches", Icone: ShieldCheck },
                    { value: true, label: "Délégué", hint: "Reçoit les tâches", Icone: Users },
                  ].map((o) => {
                    const selected = draft.delegue === o.value;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setDraft((d) => ({ ...d, delegue: o.value }))}
                        className={cn(
                          "grid grid-cols-[34px_1fr] items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          selected
                            ? "border-accent bg-accent/15 shadow-[0_0_0_2px_hsl(var(--accent)/0.18)]"
                            : "border-input bg-card hover:border-accent",
                        )}
                      >
                        <span className={cn("grid size-[34px] place-items-center rounded-lg", selected ? "bg-primary text-accent" : "bg-muted text-muted-foreground")}>
                          <o.Icone className="size-4" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-primary">{o.label}</span>
                          <span className="block text-xs text-muted-foreground">{o.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2.5">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
                  <User className="size-4 text-accent" aria-hidden="true" />
                  Identité
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="emp-prenom" className="text-[11.5px] font-semibold text-muted-foreground">
                      Prénom <span className="text-destructive" aria-hidden="true">*</span>
                    </Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input
                        id="emp-prenom"
                        autoFocus
                        value={draft.prenom}
                        onChange={(ev) => setDraft((d) => ({ ...d, prenom: ev.target.value }))}
                        className="h-10 pl-9 text-[13.5px]"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="emp-nom" className="text-[11.5px] font-semibold text-muted-foreground">
                      Nom <span className="text-destructive" aria-hidden="true">*</span>
                    </Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input
                        id="emp-nom"
                        value={draft.nom}
                        onChange={(ev) => setDraft((d) => ({ ...d, nom: ev.target.value }))}
                        className="h-10 pl-9 text-[13.5px]"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-2.5">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
                  <KeyRound className="size-4 text-accent" aria-hidden="true" />
                  Connexion
                </h3>
                <div className="space-y-1">
                  <Label htmlFor="emp-identifiant" className="text-[11.5px] font-semibold text-muted-foreground">
                    Identifiant <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="emp-identifiant"
                      value={draft.identifiant}
                      onChange={(ev) => {
                        setIdentifiantTouched(true);
                        setDraft((d) => ({ ...d, identifiant: ev.target.value }));
                      }}
                      placeholder="prenom.nom"
                      className="h-10 pl-9 text-[13.5px]"
                    />
                  </div>
                  <p className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {isEdit
                      ? `C'est avec cet identifiant que ${draft.prenom || "la personne"} se connecte — prévenez-la s'il change.`
                      : !identifiantTouched
                        ? "Proposé à partir du prénom et du nom — modifiable."
                        : "Minuscules, chiffres, points ou tirets uniquement — doit commencer par une lettre."}
                  </p>
                </div>

                {!isEdit && (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                      <div className="min-w-0 space-y-1">
                        <Label htmlFor="emp-mdp" className="text-[11.5px] font-semibold text-muted-foreground">
                          Mot de passe <span className="text-destructive" aria-hidden="true">*</span>
                        </Label>
                        <div className="relative">
                          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                          <Input
                            id="emp-mdp"
                            type={passwordVisible ? "text" : "password"}
                            value={draft.motDePasse}
                            onChange={(ev) => setDraft((d) => ({ ...d, motDePasse: ev.target.value }))}
                            autoComplete="new-password"
                            className="h-10 pl-9 pr-10 font-mono text-[13.5px]"
                          />
                          <button
                            type="button"
                            onClick={() => setPasswordVisible((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={passwordVisible ? "Masquer" : "Afficher"}
                          >
                            {passwordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 gap-2 px-3 text-[13px] font-semibold"
                        onClick={() => {
                          setDraft((d) => ({ ...d, motDePasse: generatePassword() }));
                          setPasswordVisible(true);
                        }}
                        aria-label="Générer un mot de passe"
                      >
                        <RefreshCw className="size-4" aria-hidden="true" />
                        Générer
                      </Button>
                    </div>
                    {draft.motDePasse.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-1 gap-1">
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
                        <span className="w-16 text-right text-xs capitalize text-muted-foreground">{level}</span>
                      </div>
                    )}
                    <p className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      Communiquez-le à {draft.prenom || "la personne"} : elle devra en choisir un nouveau à sa première connexion.
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor="emp-email" className="text-[11.5px] font-semibold text-muted-foreground">
                      Email <span className="text-destructive" aria-hidden="true">*</span>
                    </Label>
                    {mode?.kind === "edit" && draft.email.trim() === mode.employe.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) && (
                      <button
                        type="button"
                        disabled={envoiEnCours}
                        onClick={() => void envoyerAcces(mode.employe)}
                        className="inline-flex items-center gap-1 text-[11.5px] font-bold text-primary underline underline-offset-2 disabled:opacity-50"
                      >
                        <Mail className="size-3.5" aria-hidden="true" />
                        {envoiEnCours ? "Envoi en cours…" : "Envoyer les identifiants"}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="emp-email"
                      type="email"
                      required
                      value={draft.email}
                      onChange={(ev) => setDraft((d) => ({ ...d, email: ev.target.value }))}
                      placeholder="prenom@societe.tn"
                      className="h-10 pl-9 text-[13.5px]"
                    />
                  </div>
                </div>
              </section>

              {error && (
                <p role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/40 px-[18px] py-3">
              <span className={cn("mr-auto text-xs", isEdit ? (modifie || probleme ? "font-bold text-warning" : "text-muted-foreground") : probleme ? "font-bold text-warning" : "text-muted-foreground")}>
                {isEdit
                  ? modifie
                    ? (probleme ?? "Modifications non enregistrées")
                    : "Aucune modification en attente"
                  : (probleme ?? "Prêt à être ajouté")}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="ledger"
                className="gap-2"
                disabled={busy || (isEdit && !modifie)}
              >
                {isEdit ? <Save className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                {isEdit
                  ? "Enregistrer"
                  : draft.delegue
                    ? "Ajouter le délégué"
                    : "Ajouter le responsable"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
