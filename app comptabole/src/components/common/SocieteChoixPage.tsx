import { useNavigate } from "react-router-dom";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { usePermissions } from "@/hooks/usePermissions";
import { useData, useSocietes } from "@/store/data";
import "@/pages/societes/societes-registre.css";

interface Props {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  /** Adresse du module : une société s'ouvre sur `${basePath}/:societeId`. */
  basePath: string;
  tourId: string;
}

/** Choix de la société d'un module « par société » (suivi fournisseur, suivi bancaire…). */
export function SocieteChoixPage({ icon, eyebrow, title, description, basePath, tourId }: Props) {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const societes = useSocietes()
    .filter((s) => canSeeSociete(s.id))
    .sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr", { numeric: true }));
  const hydrated = useData((s) => s.hydrated);
  const Icon = icon;

  return (
    <div className="flex flex-1 flex-col">
      <SignatureLedgerBanner variant="compact" icon={icon} eyebrow={eyebrow} title={title} description={description} metrics={[]} />

      <h2 className="mt-2 font-display text-base font-extrabold text-primary">Dossiers</h2>
      <p className="mb-3 text-sm text-muted-foreground">{description}</p>
      <div className="overflow-hidden rounded-[14px] border border-primary/10 bg-card shadow-[0_1px_2px_hsl(var(--primary)/0.05),0_12px_32px_-18px_hsl(var(--primary)/0.18)]" data-tour={tourId}>
        {societes.length === 0 ? (
          <EmptyState
            icon={Icon}
            title={hydrated ? "Aucune société accessible" : "Chargement…"}
            description="Créez une société ou faites-vous assigner un périmètre."
          />
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_2.5rem] items-center bg-[#F7F9FC] px-5 py-3 text-[0.66rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <span>Société</span>
              <span>Situation</span>
              <span />
            </div>
            <ul>
              {societes.map((s) => (
                <li key={s.id} className="border-t border-primary/10">
                  <button
                    type="button"
                    onClick={() => navigate(`${basePath}/${s.id}`)}
                    aria-label={`Ouvrir ${title.toLowerCase()} de ${s.raisonSociale}`}
                    className="grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_2.5rem] items-center px-5 py-3 text-left transition-colors hover:bg-[#F5F8FD] focus-visible:bg-[#F5F8FD] focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-primary">{s.raisonSociale}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.theme} · {s.rne || "RNE non renseigné"} · {s.code}</span>
                    </span>
                    <span><span className="reg-pastille" data-statut={s.statut}>{s.statut === "actif" ? "Actif" : s.statut === "en_attente" ? "En attente" : "Inactif"}</span></span>
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
