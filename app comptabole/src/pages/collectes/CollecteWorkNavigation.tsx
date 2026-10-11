import { useId } from "react";
import {
  CheckCircle2,
  ClipboardList,
  History,
  MessageSquareText,
  Paperclip,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { COLLECTE_TABS, etatDeTableau, TAB_BY_KEY } from "@/lib/collecte/tabs";
import { SECTION_STATUT_LABELS, sectionStatut, tableauxVisiblesClient } from "@/lib/collecte/sections";
import { sectionRecapStatut } from "@/lib/collecte/recap";
import type { CollecteFull, SectionStatut } from "@/types";

interface Props {
  collecte: CollecteFull;
  active: string;
  isClient: boolean;
  canSeeRecap?: boolean;
  canVerify?: boolean;
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

function tableHint(collecte: CollecteFull, key: string, isClient: boolean): string {
  const recap = sectionRecapStatut(collecte, key);
  const status = sectionStatut(collecte, key);
  if (isClient && TAB_BY_KEY[key]?.cabinetSeul) return "Tenu par le cabinet";
  if (recap === "envoye") return isClient ? "À préciser" : "Récap envoyé";
  if (isClient && status === "a_corriger") return "À reprendre";
  if (isClient && status === "brouillon") return "À compléter";
  if (!isClient && status === "transmis") return "À examiner";
  return SECTION_STATUT_LABELS[status];
}

export function CollecteWorkNavigation({
  collecte,
  active,
  isClient,
  canSeeRecap = !isClient,
  canVerify = false,
  canSeeHistory,
  missingByTable,
  visibleMissing,
  recapCount,
  onSelect,
}: Props) {
  const selectedStatusId = useId();
  // Le client ne voit que les tableaux que le cabinet lui a envoyés (récap) ou renvoyés, et ceux déjà transmis ou validés.
  const requested = new Set(isClient ? tableauxVisiblesClient(collecte) : collecte.onglets);
  const groups = [
    { label: "Chèques", keys: COLLECTE_TABS.filter((item) => etatDeTableau(item.key)?.key === "cheques" && requested.has(item.key) && sectionStatut(collecte, item.key) !== "archive") },
    { label: "Virements", keys: COLLECTE_TABS.filter((item) => etatDeTableau(item.key)?.key === "virements" && requested.has(item.key) && sectionStatut(collecte, item.key) !== "archive") },
    { label: "Traites", keys: COLLECTE_TABS.filter((item) => etatDeTableau(item.key)?.key === "traites" && requested.has(item.key) && sectionStatut(collecte, item.key) !== "archive") },
    { label: "Autres tableaux", keys: COLLECTE_TABS.filter((item) => !etatDeTableau(item.key) && requested.has(item.key) && sectionStatut(collecte, item.key) !== "archive") },
    { label: "Archives", keys: COLLECTE_TABS.filter((item) => requested.has(item.key) && sectionStatut(collecte, item.key) === "archive") },
  ].filter((group) => group.keys.length > 0);
  const selectedTable = requested.has(active) ? TAB_BY_KEY[active] : undefined;
  const tableActive = Boolean(selectedTable);
  const tableMissing = selectedTable && visibleMissing(active) ? missingByTable.get(active) ?? 0 : 0;
  const selectedHint = selectedTable
    ? tableMissing > 0
      ? `${tableMissing} ${tableMissing === 1 ? "case" : "cases"} à compléter`
      : tableHint(collecte, active, isClient)
    : "";
  const selectedStatus = selectedTable ? sectionStatut(collecte, active) : undefined;

  const navButton = (key: string, label: string, Icon: typeof ClipboardList, badge?: number) => (
    <Button
      key={key}
      type="button"
      variant="ghost"
      size="sm"
      aria-current={active === key ? "page" : undefined}
      onClick={() => onSelect(key)}
      className={cn(
        "min-h-10 min-w-0 flex-auto gap-1 rounded-sm border-b-2 px-1.5 text-xs lg:flex-none lg:gap-1.5 lg:px-2 lg:text-sm",
        active === key
          ? "border-accent bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="hidden size-3.5 shrink-0 xl:block" aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={cn("shrink-0 rounded-sm px-1 text-[10px] tabular-nums", active === key ? "bg-primary-foreground/15" : "bg-warning/15 font-semibold text-warning")}>{badge}</span>
      )}
    </Button>
  );

  return (
    <nav
      data-tour="collecte-navigation"
      aria-label="Sections du dossier"
      className="flex min-w-0 flex-col gap-2 border-b border-border bg-card px-3 py-2 lg:flex-row lg:items-center lg:gap-3"
    >
      {!isClient && (
        <div className="flex min-w-0 items-center gap-1">
          {canSeeRecap && navButton("recap", "Récap", MessageSquareText, recapCount)}
          {navButton("checklist", "Checklist", ClipboardList)}
          {navButton("documents", "Documents", Paperclip, collecte.fichiers.length)}
          {canVerify && navButton("verification", "Vérification", CheckCircle2)}
          {canSeeHistory && navButton("historique", "Historique", History)}
        </div>
      )}
      <div className={cn("min-w-0 w-full", !isClient && "lg:ml-auto lg:w-[42%] lg:max-w-sm")}>
        {groups.length > 0 ? (
          <Select value={tableActive ? active : ""} onValueChange={onSelect}>
            <SelectTrigger className="h-11 min-w-0 gap-2 text-left [&>span:first-of-type]:min-w-0 [&>span:first-of-type]:flex-1 [&>span:first-of-type]:line-clamp-none" aria-label="Choisir un tableau" aria-current={tableActive ? "page" : undefined} aria-describedby={tableActive ? selectedStatusId : undefined}>
              <Table2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <SelectValue placeholder="Choisir un tableau…">
                {selectedTable && (
                  <span className="grid min-w-0 gap-0.5 leading-tight">
                    <span className="truncate font-medium">{selectedTable.label}</span>
                    <span id={selectedStatusId} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn("size-1.5 shrink-0 rounded-full", selectedStatus && DOT[selectedStatus])} title={selectedStatus && SECTION_STATUT_LABELS[selectedStatus]} aria-hidden="true" />
                      {selectedStatus && selectedHint !== SECTION_STATUT_LABELS[selectedStatus] && (
                        <span className="sr-only">{SECTION_STATUT_LABELS[selectedStatus]} : </span>
                      )}
                      <span className="truncate">{selectedHint}</span>
                    </span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className="max-h-[70dvh] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] rounded-sm">
              {groups.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.keys.map((item) => {
                    const status = sectionStatut(collecte, item.key);
                    const hint = tableHint(collecte, item.key, isClient);
                    const missing = visibleMissing(item.key) ? missingByTable.get(item.key) ?? 0 : 0;
                    const attention = hint === "À examiner" || hint === "À reprendre" || hint === "À préciser" || hint === "À compléter";
                    return (
                      <SelectItem key={item.key} value={item.key} aria-current={active === item.key ? "page" : undefined} className="rounded-sm py-2 [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cn("size-1.5 shrink-0 rounded-full", DOT[status])} title={SECTION_STATUT_LABELS[status]} aria-hidden="true" />
                          <span className="min-w-0 flex-1 whitespace-normal">{item.label}</span>
                          {(missing > 0 || hint !== SECTION_STATUT_LABELS[status]) && (
                            <span className="sr-only">{SECTION_STATUT_LABELS[status]} : </span>
                          )}
                          <span className={cn("max-w-28 shrink-0 whitespace-normal pl-1 text-right text-xs", attention ? "font-semibold text-warning" : "text-muted-foreground")}>{missing > 0 ? `${missing} à compléter` : hint}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <Table2 className="size-4 shrink-0" aria-hidden="true" />
            {isClient ? "Aucun tableau demandé pour le moment." : "Aucun tableau dans cette collecte."}
          </p>
        )}
      </div>
    </nav>
  );
}
