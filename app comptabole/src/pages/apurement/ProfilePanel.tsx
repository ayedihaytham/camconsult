import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Profile = {
  version: number;
  donnees: Record<string, string>;
  verifiedAt?: string;
  differenceSociete?: boolean;
};
const fields = {
  raisonSociale: "Raison sociale déclarant",
  matriculeFiscal: "Matricule fiscal déclarant",
  activite: "Activité",
  ville: "Ville",
  rue: "Rue",
  numero: "Numéro",
  codePostal: "Code postal",
  reference: "Référence de vérification",
};
export function ProfilePanel({ societeId }: { societeId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const { canManageCollaborateurs } = usePermissions();
  useEffect(() => {
    let live = true;
    api
      .get<Profile>(`/apurement/societes/${societeId}/profil`)
      .then((p) => {
        if (live)
          setProfile({
            ...p,
            donnees: {
              ...Object.fromEntries(Object.keys(fields).map((k) => [k, ""])),
              ...p.donnees,
            },
          });
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [societeId]);
  async function save(verifier: boolean) {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      setProfile(
        await api.put(`/apurement/societes/${societeId}/profil`, {
          expectedVersion: profile.version,
          donnees: profile.donnees,
          verifier,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }
  const incomplete = ["raisonSociale", "matriculeFiscal", "reference"].some(
    (k) => !profile?.donnees[k]?.trim(),
  );
  return (
    <section className="space-y-3 border-t pt-4">
      <h2 className="font-semibold">Profil fiscal déclarant</h2>
      <p className="text-sm text-muted-foreground">
        Identité indépendante du référentiel Société.{" "}
        {profile?.verifiedAt
          ? "Vérifié par le cabinet."
          : "À vérifier avant validation."}
      </p>
      {profile?.differenceSociete && (
        <p className="text-sm text-amber-700">
          La fiche Société diffère du profil revu ; aucune donnée n’a été
          écrasée.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {profile &&
          Object.entries(fields).map(([key, label]) => (
            <label key={key} className="space-y-1 text-sm">
              {label}
              <Input
                required={[
                  "raisonSociale",
                  "matriculeFiscal",
                  "reference",
                ].includes(key)}
                value={profile.donnees[key] || ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    donnees: { ...profile.donnees, [key]: e.target.value },
                  })
                }
              />
            </label>
          ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!profile || busy || incomplete}
          variant="outline"
          onClick={() => save(false)}
        >
          Enregistrer le profil
        </Button>
        {canManageCollaborateurs && (
          <Button
            disabled={!profile || busy || incomplete}
            onClick={() => save(true)}
          >
            Confirmer la vérification du profil
          </Button>
        )}
      </div>
      {profile && incomplete && (
        <p className="text-xs text-muted-foreground">
          Renseignez la raison sociale, le matricule fiscal et la référence de
          vérification pour enregistrer.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
