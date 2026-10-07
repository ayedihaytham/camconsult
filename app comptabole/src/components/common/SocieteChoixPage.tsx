import { useNavigate } from "react-router-dom";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { usePermissions } from "@/hooks/usePermissions";
import { useData, useSocietes } from "@/store/data";
import { initials } from "@/lib/utils";

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

      <div className="mt-4 overflow-hidden rounded-xl border border-accent/30 bg-card" data-tour={tourId}>
        {societes.length === 0 ? (
          <EmptyState
            icon={Icon}
            title={hydrated ? "Aucune société accessible" : "Chargement…"}
            description="Créez une société ou faites-vous assigner un périmètre."
          />
        ) : (
          <ul className="divide-y divide-accent/25">
            {societes.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => navigate(`${basePath}/${s.id}`)}
                  aria-label={`Ouvrir ${title.toLowerCase()} de ${s.raisonSociale}`}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/[0.06] focus-visible:bg-accent/[0.06] focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-[54px] shrink-0 place-items-center rounded-xl bg-accent/15 text-sm font-bold text-primary"
                  >
                    {initials(s.raisonSociale)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-xl font-medium leading-tight text-primary">{s.raisonSociale}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {s.theme} · {s.rne || "RNE non renseigné"} · {s.code}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
