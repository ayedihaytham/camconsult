import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validerMatriculeFiscal } from "../../../shared/mf.js";
import { cn } from "@/lib/utils";
import type { FactureCabinet } from "@/types";
import { ApercuFactureCabinet } from "./ApercuFactureCabinet";
import { AIDE, CHAMP, Carte, ETIQUETTE, FenetreFacturation, Puce, Rubrique } from "./FenetreFacturation";

type Champs = Omit<FactureCabinet, "nom">;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cabinet: FactureCabinet | null;
  onSave: (data: Champs) => Promise<void>;
}

const VIDE: Champs = {
  adresse: "",
  matriculeFiscal: "",
  telephone: "",
  email: "",
  rib: "",
  mentions: "",
  raisonSociale: "",
  rue: "",
  ville: "",
  codePostal: "",
  pays: "TN",
  rc: "",
};

/** Adresse imprimée en une ligne, composée de l'adresse structurée (la ligne libre d'autrefois n'est plus saisie). */
export const composerAdresse = (v: Pick<Champs, "rue" | "ville" | "codePostal" | "adresse">) =>
  [v.rue?.trim(), [v.codePostal?.trim(), v.ville?.trim()].filter(Boolean).join(" ")].filter(Boolean).join(", ") || v.adresse;

/**
 * Coordonnées du cabinet imprimées sur chaque facture. Formulaire en sections à gauche ; à droite, la liste « prêt pour la facture
 * électronique » et une miniature de la vraie facture qui se met à jour pendant la saisie.
 */
export function CabinetInfoDialog({ open, onOpenChange, cabinet, onSave }: Props) {
  const [v, setV] = useState<Champs>(VIDE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Le nom d'usage (`nom`) vient du compte administrateur : il n'est pas saisi ici et n'est pas renvoyé à l'enregistrement.
    const { nom: _nom, ...sansNom } = cabinet ?? ({} as FactureCabinet);
    const base: Champs = cabinet ? { ...VIDE, ...sansNom } : { ...VIDE };
    // Ancienne adresse en une ligne : reprise comme rue quand elle tient dans le champ, pour ne pas la perdre à l'enregistrement.
    if (!base.rue?.trim() && base.adresse?.trim() && base.adresse.trim().length <= 35) base.rue = base.adresse.trim();
    setV(base);
  }, [open, cabinet]);

  const set = (patch: Partial<Champs>) => setV((s) => ({ ...s, ...patch }));
  const mf = validerMatriculeFiscal(v.matriculeFiscal);
  const mfSaisi = Boolean(v.matriculeFiscal.trim());

  const points = [
    { id: "nom", libelle: "Raison sociale", ok: Boolean(v.raisonSociale?.trim()) },
    { id: "mf", libelle: "Matricule fiscal valide", ok: mf.ok },
    { id: "adresse", libelle: "Rue, ville et code postal", ok: Boolean(v.rue?.trim() && v.ville?.trim() && v.codePostal?.trim()) },
    { id: "rib", libelle: "RIB / IBAN pour le règlement", ok: Boolean(v.rib.trim()) },
  ];
  const aCompleter = points.filter((p) => !p.ok).length;

  // Valeurs de l'aperçu : l'adresse en une ligne est recomposée à partir des champs, comme à l'enregistrement.
  const apercu = useMemo<FactureCabinet>(() => ({ ...v, nom: cabinet?.nom ?? "", adresse: composerAdresse(v) }), [v, cabinet?.nom]);

  async function save() {
    setSaving(true);
    try {
      await onSave({ ...v, adresse: composerAdresse(v) });
      onOpenChange(false);
    } catch {
      // Message d'erreur déjà affiché par le store.
    } finally {
      setSaving(false);
    }
  }

  return (
    <FenetreFacturation
      open={open}
      onOpenChange={onOpenChange}
      titre="Informations du cabinet"
      description="Imprimées sur chaque facture : en-tête, coordonnées bancaires et mentions de pied de page. L'aperçu à droite se met à jour pendant la saisie."
      aside={
        <>
          <Carte titre="Prêt pour la facture électronique">
            <ul className="space-y-1.5">
              {points.map((p) => (
                <li key={p.id}>
                  <Puce ton={p.ok ? "ok" : "alerte"}>{p.libelle}</Puce>
                </li>
              ))}
            </ul>
          </Carte>
          <Carte titre="Aperçu de la facture" serif={false}>
            <ApercuFactureCabinet cabinet={apercu} />
            <p className={AIDE}>Miniature de la facture : l'en-tête, les références fiscales, le RIB et le pied de page suivent votre saisie.</p>
          </Carte>
        </>
      }
      pied={
        <>
          <p className={cn("text-sm", aCompleter === 0 ? "text-success" : "text-muted-foreground")} role="status">
            {aCompleter === 0 ? "Toutes les informations nécessaires sont renseignées." : `${aCompleter} information${aCompleter > 1 ? "s" : ""} à compléter pour la facture électronique.`}
          </p>
          <div className="ml-auto flex gap-3">
            <Button type="button" variant="outline" className="h-11 rounded-lg px-6" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="button" variant="ledger" className="h-11 rounded-lg px-6 text-sm uppercase tracking-[0.14em]" disabled={saving} onClick={() => void save()}>
              Enregistrer
            </Button>
          </div>
        </>
      }
    >
      <Rubrique titre="Identité fiscale">
        <label className={ETIQUETTE}>
          Raison sociale
          <Input id="cab-raison" aria-label="Raison sociale" value={v.raisonSociale ?? ""} onChange={(e) => set({ raisonSociale: e.target.value })} className={CHAMP} />
          <span className={AIDE}>Nom du cabinet tel qu'il figure sur la déclaration fiscale.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={ETIQUETTE}>
            Matricule fiscal
            <span className="relative block">
              <Input
                id="cab-mf"
                aria-label="Matricule fiscal"
                value={v.matriculeFiscal}
                onChange={(e) => set({ matriculeFiscal: e.target.value })}
                aria-invalid={mfSaisi && !mf.ok}
                className={cn(CHAMP, "w-full pr-9", mfSaisi && mf.ok && "border-success/60", mfSaisi && !mf.ok && "border-destructive")}
              />
              {mfSaisi && mf.ok && <Check className="absolute right-3 top-3 size-4 text-success" strokeWidth={3} aria-hidden="true" />}
            </span>
            <span className={cn(AIDE, mfSaisi && !mf.ok && "text-destructive")}>{mfSaisi ? (mf.ok ? "Matricule fiscal valide." : mf.erreur) : "13 caractères, ex. 1234567ABM000."}</span>
          </label>
          <label className={ETIQUETTE}>
            Registre de commerce
            <Input id="cab-rc" aria-label="Registre de commerce" value={v.rc ?? ""} onChange={(e) => set({ rc: e.target.value })} className={CHAMP} />
            <span className={AIDE}>Facultatif.</span>
          </label>
        </div>
      </Rubrique>

      <Rubrique titre="Adresse">
        <label className={ETIQUETTE}>
          Rue
          <Input id="cab-rue" aria-label="Rue" value={v.rue ?? ""} maxLength={35} onChange={(e) => set({ rue: e.target.value })} className={CHAMP} />
          <span className={AIDE}>35 caractères au plus.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <label className={ETIQUETTE}>
            Ville
            <Input id="cab-ville" aria-label="Ville" value={v.ville ?? ""} onChange={(e) => set({ ville: e.target.value })} className={CHAMP} />
          </label>
          <label className={ETIQUETTE}>
            Code postal
            <Input id="cab-cp" aria-label="Code postal" value={v.codePostal ?? ""} onChange={(e) => set({ codePostal: e.target.value })} className={CHAMP} />
          </label>
          <label className={ETIQUETTE}>
            Pays
            <Input id="cab-pays" aria-label="Pays" value={v.pays ?? ""} maxLength={2} onChange={(e) => set({ pays: e.target.value.toUpperCase() })} className={CHAMP} />
            <span className={AIDE}>2 lettres, ex. TN.</span>
          </label>
        </div>
      </Rubrique>

      <Rubrique titre="Contact et règlement">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={ETIQUETTE}>
            Téléphone
            <Input id="cab-tel" aria-label="Téléphone" value={v.telephone} onChange={(e) => set({ telephone: e.target.value })} className={CHAMP} />
          </label>
          <label className={ETIQUETTE}>
            E-mail
            <Input id="cab-email" aria-label="E-mail" type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} className={CHAMP} />
          </label>
        </div>
        <label className={ETIQUETTE}>
          RIB / IBAN
          <Input id="cab-rib" aria-label="RIB / IBAN" value={v.rib} onChange={(e) => set({ rib: e.target.value })} className={CHAMP} />
        </label>
      </Rubrique>

      <Rubrique titre="Pied de page">
        <label className={ETIQUETTE}>
          Mentions
          <textarea
            id="cab-mentions"
            aria-label="Mentions"
            rows={3}
            value={v.mentions}
            onChange={(e) => set({ mentions: e.target.value })}
            className="min-h-[4.5rem] w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm font-normal text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <span className={AIDE}>Ex. : forme juridique, capital, registre de commerce.</span>
        </label>
      </Rubrique>
    </FenetreFacturation>
  );
}
