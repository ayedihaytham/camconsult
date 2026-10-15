import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Eye, EyeOff, RefreshCw, RotateCcw, Save, Settings, Upload } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generatePassword, scorePassword } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";
import { useData } from "@/store/data";
import { api } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";

const STRENGTH_COLOR = ["bg-destructive", "bg-destructive", "bg-warning", "bg-accent", "bg-success"];

/** Bloc de paramètres : titre et explication, contenu, puis pied avec l'unique action du formulaire. */
function Bloc({
  title,
  description,
  footer,
  danger = false,
  children,
}: {
  title: string;
  description?: string;
  footer?: React.ReactNode;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-sm border bg-card", danger ? "border-destructive/30" : "border-border")}>
      <div className={cn("border-b px-5 py-3.5", danger ? "border-destructive/30 bg-destructive/[0.06]" : "border-border")}>
        <h2 className={cn("text-[15px] font-semibold", danger ? "text-destructive" : "text-primary")}>{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children}
      {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-muted/40 px-5 py-3">{footer}</div>}
    </section>
  );
}

function Champ({ id, label, hint, className, children }: { id: string; label: string; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-semibold text-primary">{label}</Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ChampMotDePasse({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  autoComplete,
  generer = false,
  force = false,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  generer?: boolean;
  force?: boolean;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const { score, level } = scorePassword(value);
  return (
    <Champ
      id={id}
      label={label}
      className={className}
      hint={
        force && value.length > 0 ? (
          <span className="flex items-center gap-2">
            <span className="flex flex-1 gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1 flex-1 rounded-full", i < score ? STRENGTH_COLOR[score] : "bg-border")} />
              ))}
            </span>
            <span className="capitalize">{level}</span>
          </span>
        ) : undefined
      }
    >
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn("h-10 pr-20", visible && "font-mono")}
        />
        <span className="absolute inset-y-0 right-1 flex items-center">
          {generer && (
            <button
              type="button"
              onClick={() => {
                onValueChange(generatePassword());
                setVisible(true);
              }}
              aria-label="Générer un mot de passe"
              title="Générer un mot de passe"
              className="grid size-8 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Masquer" : "Afficher"}
            className="grid size-8 place-items-center rounded text-muted-foreground hover:text-foreground"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
      </div>
    </Champ>
  );
}

export function ParametresPage() {
  const { session, changeCredentials, updateAdminProfile } = useAuth();
  const data = useData();

  // ── Profil affiché ─────────────────────────────────
  const [profilNom, setProfilNom] = useState(session?.nom ?? "");
  const [profilRole, setProfilRole] = useState(session?.fonction ?? "");

  async function submitProfil(e: React.FormEvent) {
    e.preventDefault();
    const res = await updateAdminProfile({
      nom: profilNom.trim(),
      role: profilRole.trim(),
    });
    if (res.ok) toast.success("Profil mis à jour");
    else toast.error(res.error ?? "Mise à jour impossible");
  }

  const nbFichiers = data.noeuds.filter((n) => n.type === "fichier").length;
  const nbDossiers = data.noeuds.filter((n) => n.type === "dossier").length;

  // ── Compte & sécurité ──────────────────────────────
  const [identifiant, setIdentifiant] = useState("");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd && newPwd !== confirmPwd) {
      toast.error("La confirmation ne correspond pas.");
      return;
    }
    const res = await changeCredentials(currentPwd, {
      identifiant: identifiant.trim() || undefined,
      motDePasse: newPwd || undefined,
    });
    if (res.ok) {
      toast.success("Identifiants mis à jour");
      setIdentifiant("");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } else {
      toast.error(res.error ?? "Modification impossible");
    }
  }

  // ── Données ────────────────────────────────────────
  const [resetOpen, setResetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const pendingImport = useRef<Parameters<typeof data.importAll>[0] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportBackup() {
    try {
      const payload = await api.get<unknown>("/data/backup");
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sauvegarde-cabinet-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Sauvegarde exportée");
    } catch {
      toast.error("Export impossible");
    }
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !Array.isArray(parsed.societes)
        ) {
          throw new Error("format");
        }
        pendingImport.current = {
          societes: parsed.societes ?? [],
          employes: parsed.employes ?? [],
          noeuds: parsed.noeuds ?? [],
          messages: parsed.messages ?? [],
          conversations: parsed.conversations ?? [],
        };
        setImportOpen(true);
      } catch {
        toast.error("Fichier de sauvegarde invalide");
      }
    };
    reader.readAsText(file);
  }

  const [onglet, setOnglet] = useState<"profil" | "securite" | "donnees">("profil");
  const profilModifie = profilNom.trim() !== (session?.nom ?? "") || profilRole.trim() !== (session?.fonction ?? "");
  const initiales = (profilNom || session?.nom || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join("");

  return (
    <div>
      <SignatureLedgerBanner
        variant="compact"
        icon={Settings}
        eyebrow="Administration"
        title="Paramètres"
        description="Compte, sécurité et données du cabinet."
        metrics={[]}
      />

      <div className="mt-4 space-y-4">
        <div data-tour="parametres-account">
          <LedgerSegmented
            ariaLabel="Rubrique des paramètres"
            value={onglet}
            onChange={setOnglet}
            options={[
              { value: "profil", label: "Profil" },
              { value: "securite", label: "Sécurité" },
              { value: "donnees", label: "Données" },
            ]}
          />
        </div>

        <div data-tour="parametres-content" className="space-y-4">
        {onglet === "profil" && (
          <form onSubmit={submitProfil}>
            <Bloc
              title="Profil affiché"
              description="Ce nom et cette fonction apparaissent en haut à droite et dans la messagerie."
              footer={
                <>
                  <span className="mr-auto text-[13px] text-muted-foreground">{profilModifie ? "Modifications non enregistrées" : "Aucune modification en attente"}</span>
                  <Button type="submit" variant="ledger" disabled={!profilModifie || !profilNom.trim()}>
                    <Save className="h-4 w-4" />
                    Mettre à jour le profil
                  </Button>
                </>
              }
            >
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-accent" aria-hidden="true">{initiales}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-primary">{profilNom || "—"}</p>
                    <p className="truncate text-[13px] text-muted-foreground">{profilRole || "Aucune fonction renseignée"}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Champ id="param-nom" label="Nom affiché">
                    <Input id="param-nom" value={profilNom} onChange={(e) => setProfilNom(e.target.value)} className="h-10" />
                  </Champ>
                  <Champ id="param-role" label="Fonction affichée">
                    <Input id="param-role" value={profilRole} onChange={(e) => setProfilRole(e.target.value)} className="h-10" />
                  </Champ>
                </div>
              </div>
            </Bloc>
          </form>
        )}

        {onglet === "securite" && (
          <form onSubmit={submitCredentials}>
            <Bloc
              title="Identifiants de connexion"
              description="Changez l'identifiant, le mot de passe, ou les deux. Votre mot de passe actuel confirme la demande."
              footer={
                <>
                  <span className="mr-auto text-[13px] text-muted-foreground">Le bouton s'active dès que le mot de passe actuel est saisi</span>
                  <Button type="submit" variant="ledger" disabled={!currentPwd}>
                    <Save className="h-4 w-4" />
                    Enregistrer
                  </Button>
                </>
              }
            >
              <div className="space-y-4 p-5">
                <Champ
                  id="param-identifiant"
                  label="Identifiant de connexion"
                  hint={
                    session?.identifiant ? (
                      <>
                        Identifiant actuel : <code className="font-mono font-semibold text-primary">{session.identifiant}</code>
                      </>
                    ) : undefined
                  }
                >
                  <Input
                    id="param-identifiant"
                    value={identifiant}
                    autoComplete="username"
                    placeholder="Laisser vide pour conserver l'identifiant actuel"
                    onChange={(e) => setIdentifiant(e.target.value)}
                    className="h-10"
                  />
                </Champ>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ChampMotDePasse
                    id="param-mdp-nouveau"
                    label="Nouveau mot de passe"
                    value={newPwd}
                    onValueChange={setNewPwd}
                    autoComplete="new-password"
                    placeholder="Laisser vide pour ne pas changer"
                    generer
                    force
                  />
                  <ChampMotDePasse
                    id="param-mdp-confirmation"
                    label="Confirmer le nouveau mot de passe"
                    value={confirmPwd}
                    onValueChange={setConfirmPwd}
                    autoComplete="new-password"
                  />
                </div>
                <div className="rounded-sm border border-accent/40 bg-accent/10 p-3.5">
                  <ChampMotDePasse
                    id="param-mdp-actuel"
                    label="Mot de passe actuel · requis pour enregistrer"
                    value={currentPwd}
                    onValueChange={setCurrentPwd}
                    autoComplete="current-password"
                    placeholder="Votre mot de passe actuel"
                    className="max-w-sm"
                  />
                </div>
              </div>
            </Bloc>
          </form>
        )}

        {onglet === "donnees" && (
          <>
            <Bloc title="Contenu du cabinet" description="Les données sont enregistrées sur le serveur du cabinet, pas dans ce navigateur.">
              <dl className="grid grid-cols-2 gap-2.5 p-5 sm:grid-cols-3 lg:grid-cols-5">
                <Stat label="Sociétés" value={data.societes.length} />
                <Stat label="Employés" value={data.employes.length} />
                <Stat label="Dossiers" value={nbDossiers} />
                <Stat label="Fichiers" value={nbFichiers} />
                <Stat label="Messages" value={data.messages.length} />
              </dl>
            </Bloc>

            <Bloc title="Sauvegarde" description="Un fichier JSON complet, à conserver hors de l'application.">
              <div className="divide-y divide-border">
                <Action titre="Exporter une sauvegarde" texte="Télécharge toutes les données du cabinet.">
                  <Button variant="outline" onClick={exportBackup}>
                    <Download className="h-4 w-4 text-accent" />
                    Exporter
                  </Button>
                </Action>
                <Action titre="Importer une sauvegarde" texte="Remplace les données actuelles par le contenu du fichier.">
                  <Button variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4 text-accent" />
                    Importer
                  </Button>
                  <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />
                </Action>
              </div>
            </Bloc>

            <Bloc danger title="Zone sensible" description="Action irréversible : à utiliser avec précaution.">
              <Action
                titre="Réinitialiser toutes les données"
                texte="Supprime TOUTES les données métier : sociétés, employés, dossiers, fichiers, messages, collectes, stock, factures, honoraires, suivi fournisseur et bancaire, virements SWIFT, souches et suivis en devise. Le compte administrateur est conservé. Désactivée en production sauf autorisation du serveur ; il faudra taper « RÉINITIALISER » pour confirmer."
              >
                <Button variant="destructive" onClick={() => setResetOpen(true)}>
                  <RotateCcw className="h-4 w-4" />
                  Tout réinitialiser
                </Button>
              </Action>
            </Bloc>
          </>
        )}
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Réinitialiser toutes les données ?"
        description="Toutes les données métier (sociétés, employés, dossiers, fichiers, messages, collectes, stock, factures, honoraires, banque, SWIFT…) seront définitivement supprimées. Cette action est irréversible : faites d'abord une sauvegarde."
        confirmPhrase="RÉINITIALISER"
        confirmLabel="Tout supprimer"
        onConfirm={async () => {
          await data.resetAll();
          toast.success("Données réinitialisées");
        }}
      />

      <ConfirmDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        destructive={false}
        title="Restaurer cette sauvegarde ?"
        description="Les données actuelles seront remplacées par le contenu du fichier importé."
        confirmLabel="Restaurer"
        onConfirm={() => {
          if (pendingImport.current) {
            data.importAll(pendingImport.current);
            pendingImport.current = null;
            toast.success("Sauvegarde restaurée");
          }
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-border bg-muted/40 px-3 py-2.5">
      <dd className="text-[22px] font-bold leading-tight tabular-nums text-primary">{formatNumber(value)}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

function Action({ titre, texte, children }: { titre: string; texte: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="min-w-[14rem] flex-1">
        <p className="font-semibold text-primary">{titre}</p>
        <p className="text-[13px] text-muted-foreground">{texte}</p>
      </div>
      {children}
    </div>
  );
}
