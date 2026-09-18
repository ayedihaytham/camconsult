import { useRef, useState } from "react";
import { toast } from "sonner";
import { Database, Download, KeyRound, RotateCcw, Save, Upload } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PasswordField } from "@/components/common/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/store/auth";
import { useData } from "@/store/data";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

function SheetHead({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof KeyRound;
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-border px-[18px] py-3.5">
      <h2 className="flex items-center gap-2 text-[0.86rem] font-bold text-foreground">
        <Icon className="h-4 w-4 text-accent" />
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
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
      <LedgerPageHeader
        title="Paramètres"
        description="Compte administrateur, données et préférences de l'application."
      />

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {/* Compte & sécurité */}
        <LedgerSheet>
          <SheetHead
            icon={KeyRound}
            title="Compte & sécurité"
            description="Identifiant et mot de passe du compte responsable."
          />
          <div className="space-y-5 p-[18px]">
            <form onSubmit={submitProfil} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="param-nom">Nom affiché</Label>
                  <Input
                    id="param-nom"
                    value={profilNom}
                    onChange={(e) => setProfilNom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="param-role">Fonction affichée</Label>
                  <Input
                    id="param-role"
                    value={profilRole}
                    onChange={(e) => setProfilRole(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" variant="ledger">
                <Save className="h-4 w-4" />
                Mettre à jour le profil
              </Button>
            </form>

            <Separator />

            <form onSubmit={submitCredentials} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="param-identifiant">Identifiant de connexion</Label>
                <Input
                  id="param-identifiant"
                  value={identifiant}
                  autoComplete="username"
                  placeholder="Laisser vide pour conserver l'identifiant actuel"
                  onChange={(e) => setIdentifiant(e.target.value)}
                />
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label>Mot de passe actuel</Label>
                <PasswordField
                  value={currentPwd}
                  onValueChange={setCurrentPwd}
                  showGenerator={false}
                  showStrength={false}
                  autoComplete="current-password"
                  placeholder="Requis pour toute modification"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nouveau mot de passe</Label>
                <PasswordField
                  value={newPwd}
                  onValueChange={setNewPwd}
                  autoComplete="new-password"
                  placeholder="Laisser vide pour ne pas changer"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmer le nouveau mot de passe</Label>
                <PasswordField
                  value={confirmPwd}
                  onValueChange={setConfirmPwd}
                  showGenerator={false}
                  showStrength={false}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" variant="ledger" disabled={!currentPwd}>
                <Save className="h-4 w-4" />
                Enregistrer
              </Button>
            </form>
          </div>
        </LedgerSheet>

        {/* Données */}
        <LedgerSheet>
          <SheetHead
            icon={Database}
            title="Données"
            description="Sauvegarde, restauration et réinitialisation. Les données sont stockées localement dans ce navigateur."
          />
          <div className="space-y-4 p-[18px]">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 rounded-sm border border-border p-3 text-sm">
              <Stat label="Sociétés" value={data.societes.length} />
              <Stat label="Employés" value={data.employes.length} />
              <Stat label="Dossiers" value={nbDossiers} />
              <Stat label="Fichiers" value={nbFichiers} />
              <Stat label="Messages" value={data.messages.length} />
            </dl>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportBackup}>
                <Download className="h-4 w-4" />
                Exporter une sauvegarde
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
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

            <Separator />

            <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-foreground">
                Réinitialiser toutes les données
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Supprime définitivement sociétés, employés, dossiers, fichiers
                et messages. Le compte administrateur est conservé.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-3"
                onClick={() => setResetOpen(true)}
              >
                <RotateCcw className="h-4 w-4" />
                Tout réinitialiser
              </Button>
            </div>
          </div>
        </LedgerSheet>

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
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums text-foreground">{formatNumber(value)}</dd>
    </div>
  );
}
