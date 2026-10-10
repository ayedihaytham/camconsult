import {
  ClipboardList,
  History,
  MessageSquareText,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTE_TABS, etatDeTableau, TAB_BY_KEY } from "@/lib/collecte/tabs";
import { SECTION_STATUT_LABELS, sectionStatut } from "@/lib/collecte/sections";
import { sectionRecapStatut } from "@/lib/collecte/recap";
import type { CollecteFull, SectionStatut } from "@/types";

interface Props {
  collecte: CollecteFull;
  active: string;
  isClient: boolean;
  canSeeHistory: boolean;
  missingByTable: Map<string, number>;
  visibleMissing: (key: string) => boolean;
  recapCount: number;
  onSelect: (key: string) => void;
}

const DOT: Record<SectionStatut, string> = {
  brouillon: "bg-muted-foreground/50",
  transmis: "bg-primary",
  a_corriger: "bg-warning",
  valide: "bg-success",
  archive: "bg-muted-foreground/30",
};

function Item({
  label,
  active,
  badge,
  hint,
  onClick,
  icon,
  tone = "default",
}: {
  label: string;
  active: boolean;
  badge?: string | number;
  hint?: string;
  onClick: () => void;
  icon?: React.ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-h-10 min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "xl:w-full xl:justify-between",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground hover:bg-muted/70",
        tone === "warning" && !active && "text-warning-foreground",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {hint && !active && <span className="hidden truncate text-[10px] text-muted-foreground xl:block">{hint}</span>}
      {badge !== undefined && badge !== 0 && badge !== "" && (
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-primary-foreground/15 text-primary-foreground" : tone === "warning" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function tableHint(
  collecte: CollecteFull,
  key: string,
  isClient: boolean,
): { label: string; priority: boolean } {
  const recap = sectionRecapStatut(collecte, key);
  const status = sectionStatut(collecte, key);
  if (isClient && TAB_BY_KEY[key]?.cabinetSeul) return { label: "Tenu par le cabinet", priority: false };
  if (recap === "envoye") return { label: isClient ? "À préciser" : "Récap envoyé", priority: isClient };
  if (isClient && status === "a_corriger") return { label: "À reprendre", priority: true };
  if (isClient && status === "brouillon") return { label: "À compléter", priority: true };
  if (!isClient && status === "transmis") return { label: "À examiner", priority: true };
  return { label: SECTION_STATUT_LABELS[status], priority: false };
}

export function CollecteWorkNavigation({
  collecte,
  active,
  isClient,
  canSeeHistory,
  missingByTable,
  visibleMissing,
  recapCount,
  onSelect,
}: Props) {
  const archivee = collecte.statut === "archive";
  const tableKeys = new Set(collecte.onglets);
  const groups = [
    { label: "Chèques", keys: COLLECTE_TABS.filter((tab) => etatDeTableau(tab.key)?.key === "cheques" && tableKeys.has(tab.key) && sectionStatut(collecte, tab.key) !== "archive").map((tab) => tab.key) },
    { label: "Virements", keys: COLLECTE_TABS.filter((tab) => etatDeTableau(tab.key)?.key === "virements" && tableKeys.has(tab.key) && sectionStatut(collecte, tab.key) !== "archive").map((tab) => tab.key) },
    { label: "Traites", keys: COLLECTE_TABS.filter((tab) => etatDeTableau(tab.key)?.key === "traites" && tableKeys.has(tab.key) && sectionStatut(collecte, tab.key) !== "archive").map((tab) => tab.key) },
    { label: "Autres tableaux", keys: COLLECTE_TABS.filter((tab) => !etatDeTableau(tab.key) && tableKeys.has(tab.key) && sectionStatut(collecte, tab.key) !== "archive").map((tab) => tab.key) },
    { label: "Archives", keys: COLLECTE_TABS.filter((tab) => tableKeys.has(tab.key) && sectionStatut(collecte, tab.key) === "archive").map((tab) => tab.key) },
  ].filter((group) => group.keys.length > 0);

  return (
    <aside className="min-w-0 rounded-xl border border-border bg-card xl:sticky xl:top-3">
      <div className="hidden border-b border-border px-3 py-3 xl:block">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dossier de travail</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{collecte.periode}</p>
      </div>
      <nav
        aria-label="Sections du dossier"
        className="flex min-w-0 gap-3 overflow-x-auto p-2 xl:max-h-[calc(100vh-13rem)] xl:flex-col xl:gap-1 xl:overflow-y-auto"
      >
        <div className="flex shrink-0 gap-1 xl:flex-col">
          {!isClient && <Item label="Checklist" active={active === "checklist"} onClick={() => onSelect("checklist")} icon={<ClipboardList className="size-4 shrink-0" aria-hidden="true" />} />}
          <Item label="Récap" active={active === "recap"} onClick={() => onSelect("recap")} badge={recapCount} tone={recapCount > 0 ? "warning" : "default"} icon={<MessageSquareText className="size-4 shrink-0" aria-hidden="true" />} />
          {!isClient && <Item label="Documents" active={active === "documents"} onClick={() => onSelect("documents")} badge={collecte.fichiers.length} icon={<Paperclip className="size-4 shrink-0" aria-hidden="true" />} />}
          {canSeeHistory && <Item label="Historique" active={active === "historique"} onClick={() => onSelect("historique")} icon={<History className="size-4 shrink-0" aria-hidden="true" />} />}
        </div>

        <div className="hidden h-px shrink-0 bg-border xl:block" />
        <div className="flex shrink-0 gap-1 xl:flex-col xl:gap-3">
          {groups.map((group) => (
            <div key={group.label} className="flex shrink-0 gap-1 xl:flex-col xl:gap-0.5">
              <p className="hidden px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground xl:block">{group.label}</p>
              {group.keys.map((key) => {
                const status = sectionStatut(collecte, key);
                const hint = tableHint(collecte, key, isClient);
                const statusText = isClient && TAB_BY_KEY[key]?.cabinetSeul ? "Tenu par le cabinet" : SECTION_STATUT_LABELS[status];
                const missing = visibleMissing(key) ? missingByTable.get(key) : undefined;
                return (
                  <Item
                    key={key}
                    label={TAB_BY_KEY[key]?.label ?? key}
                    active={active === key}
                    onClick={() => onSelect(key)}
                    hint={hint.label}
                    tone={hint.priority ? "warning" : "default"}
                    badge={missing && missing > 0 ? missing : undefined}
                    icon={<span className={cn("size-2 shrink-0 rounded-full", DOT[status])} aria-label={statusText} title={statusText} />}
                  />
                );
              })}
            </div>
          ))}
          {collecte.onglets.length === 0 && !archivee && (
            <p className="hidden px-2.5 py-2 text-xs text-muted-foreground xl:block">Aucun tableau n’est encore demandé.</p>
          )}
        </div>
      </nav>
    </aside>
  );
}
