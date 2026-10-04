import { useRef, useState } from "react";
import { toast } from "sonner";
import { Database, Download, KeyRound, RotateCcw, Save, Settings, Upload } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CARD_FIELD_INPUT, CardField } from "@/components/common/CardField";
import { PasswordCardField } from "@/components/common/PasswordCardField";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";
import { useData } from "@/store/data";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

function CardHead({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof KeyRound;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-accent/25 px-6 py-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/15 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="font-serif text-2xl font-medium leading-tight text-primary">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
    </div>
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

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {/* Compte & sécurité */}
        <section data-tour="parametres-account" className="overflow-hidden rounded-xl border border-accent/30 bg-card">
          <CardHead
            icon={KeyRound}
            title="Compte & sécurité"
            description="Identifiant et mot de passe du compte responsable."
          />
          <div className="space-y-5 p-6">
            <form onSubmit={submitProfil} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <CardField id="param-nom" label="Nom affiché">
                  <input
                    id="param-nom"
                    value={profilNom}
                    onChange={(e) => setProfilNom(e.target.value)}
                    className={CARD_FIELD_INPUT}
                  />
                </CardField>
                <CardField id="param-role" label="Fonction affichée">
                  <input
                    id="param-role"
                    value={profilRole}
                    onChange={(e) => setProfilRole(e.target.value)}
                    className={CARD_FIELD_INPUT}
                  />
                </CardField>
              </div>
              <Button type="submit" variant="ledger" className="h-12 rounded-lg px-6 text-sm uppercase tracking-[0.14em]">
                <Save className="h-4 w-4" />
                Mettre à jour le profil
              </Button>
            </form>

            <hr className="border-accent/25" />

            <form onSubmit={submitCredentials} className="space-y-4">
              <CardField
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
                <input
                  id="param-identifiant"
                  value={identifiant}
                  autoComplete="username"
                  placeholder="Laisser vide pour conserver l'identifiant actuel"
                  onChange={(e) => setIdentifiant(e.target.value)}
                  className={CARD_FIELD_INPUT}
                />
              </CardField>

              <hr className="border-accent/25" />

              <PasswordCardField
                id="param-mdp-actuel"
                label="Mot de passe actuel"
                value={currentPwd}
                onValueChange={setCurrentPwd}
                autoComplete="current-password"
                placeholder="Requis pour toute modification"
              />
              <PasswordCardField
                id="param-mdp-nouveau"
                label="Nouveau mot de passe"
                value={newPwd}
                onValueChange={setNewPwd}
                autoComplete="new-password"
                placeholder="Laisser vide pour ne pas changer"
                generator
                strength
              />
              <PasswordCardField
                id="param-mdp-confirmation"
                label="Confirmer le nouveau mot de passe"
                value={confirmPwd}
                onValueChange={setConfirmPwd}
                autoComplete="new-password"
              />

              <Button
                type="submit"
                variant="ledger"
                className="h-12 rounded-lg px-6 text-sm uppercase tracking-[0.14em]"
                disabled={!currentPwd}
              >
                <Save className="h-4 w-4" />
                Enregistrer
              </Button>
            </form>
          </div>
        </section>

        {/* Données */}
        <section data-tour="parametres-data" className="overflow-hidden rounded-xl border border-accent/30 bg-card">
          <CardHead
            icon={Database}
            title="Données"
            description="Sauvegarde, restauration et réinitialisation. Les données sont stockées localement dans ce navigateur."
          />
          <div className="space-y-5 p-6">
            <dl className="grid grid-cols-2 gap-x-10 gap-y-1 rounded-xl border border-accent/30 px-5 py-4">
              <Stat label="Sociétés" value={data.societes.length} />
              <Stat label="Employés" value={data.employes.length} />
              <Stat label="Dossiers" value={nbDossiers} />
              <Stat label="Fichiers" value={nbFichiers} />
              <Stat label="Messages" value={data.messages.length} />
            </dl>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="h-11 rounded-lg px-5" onClick={exportBackup}>
                <Download className="h-4 w-4 text-accent" />
                Exporter une sauvegarde
              </Button>
              <Button variant="outline" className="h-11 rounded-lg px-5" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 text-accent" />
                Importer une sauvegarde
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onImportFile}
              />
            </div>

            <hr className="border-accent/25" />

            <div className="rounded-xl border border-destructive/30 bg-destructive/[0.06] p-5">
              <p className="font-serif text-xl font-medium text-primary">Réinitialiser toutes les données</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Supprime définitivement sociétés, employés, dossiers, fichiers et messages. Le compte
                administrateur est conservé.
              </p>
              <Button variant="destructive" className="mt-4 h-11 rounded-lg px-5" onClick={() => setResetOpen(true)}>
                <RotateCcw className="h-4 w-4" />
                Tout réinitialiser
              </Button>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Réinitialiser toutes les données ?"
        description="Toutes les sociétés, employés, dossiers, fichiers et messages seront définitivement supprimés. Cette action est irréversible."
        confirmPhrase="RÉINITIALISER"
        confirmLabel="Tout supprimer"
        onConfirm={() => {
          data.resetAll();
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
    <div className="flex items-center justify-between border-b border-accent/25 py-3">
      <dt className="text-base text-muted-foreground">{label}</dt>
      <dd className="font-serif text-2xl font-medium tabular-nums text-primary">{formatNumber(value)}</dd>
    </div>
  );
}
