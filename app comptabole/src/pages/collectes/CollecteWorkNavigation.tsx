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
  canVerify: boolean;
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
  canVerify,
  canSeeHistory,
  missingByTable,
  visibleMissing,
  recapCount,
  onSelect,
}: Props) {
  // Le client ne voit que les tableaux que le cabinet lui a envoyés (récap) ou renvoyés, et ceux déjà transmis ou validés.
  const requested = new Set(isClient ? tableauxVisiblesClient(collecte) : collecte.onglets);
  const groups = [
    { label: "Chèques", keys: COLLECTE_TABS.filter((item) => etatDeTableau(item.key)?.key === "cheques" && requested.has(item.key) && sectionStatut(collecte, item.key) !== "archive") },
    { label: "Virements", keys: COLLECTE_TABS.filter((item) => etatDeTableau(item.key)?.key === "virements" && requested.has(item.key) && sectionStatut(collecte, item.key) !== "archive") },
    { label: "Traites", keys: COLLECTE_TABS.filter((item) => etatDeTableau(item.key)?.key === "traites" && requested.has(item.key) && sectionStatut(collecte, item.key) !== "archive") },
    { label: "Autres tableaux", keys: COLLECTE_TABS.filter((item) => !etatDeTableau(item.key) && requested.has(item.key) && sectionStatut(collecte, item.key) !== "archive") },
    { label: "Archives", keys: COLLECTE_TABS.filter((item) => requested.has(item.key) && sectionStatut(collecte, item.key) === "archive") },
  ].filter((group) => group.keys.length > 0);
  const tableActive = requested.has(active);
  const selectedTable = COLLECTE_TABS.find((item) => item.key === active);
  const tableMissing = selectedTable && visibleMissing(active) ? missingByTable.get(active) ?? 0 : 0;

  const navButton = (key: string, label: string, Icon: typeof ClipboardList, badge?: number) => (
    <Button
      key={key}
      type="button"
      variant="ghost"
      size="sm"
      aria-current={active === key ? "page" : undefined}
      onClick={() => onSelect(key)}
      className={cn(
        "min-h-10 shrink-0 gap-2 rounded-lg px-3 text-sm",
        active === key ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={cn("min-w-5 rounded-full px-1.5 text-[10px] tabular-nums", active === key ? "bg-primary-foreground/15" : "bg-warning/15 font-semibold text-warning")}>{badge}</span>
      )}
    </Button>
  );

  return (
    <nav
      aria-label="Sections du dossier"
      className="flex min-w-0 flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-2"
    >
      {/* Le client n'a que le Récap, la vérification et ses tableaux : ni checklist ni documents. */}
      {!isClient && navButton("checklist", "Checklist", ClipboardList)}
      {navButton("recap", "Récap", MessageSquareText, recapCount)}
      {!isClient && navButton("documents", "Documents", Paperclip, collecte.fichiers.length)}
      {canVerify && navButton("verification", "Vérification", CheckCircle2)}
      {canSeeHistory && navButton("historique", "Historique", History)}
      <div className="ml-auto flex min-w-0 items-center gap-2 px-1">
        {tableMissing > 0 && <span className="hidden text-xs font-semibold text-warning sm:inline">{tableMissing} case(s) à compléter</span>}
        <Select value={tableActive ? active : ""} onValueChange={onSelect}>
          <SelectTrigger className="min-h-10 w-[min(19rem,calc(100vw-2rem))] gap-2" aria-label="Choisir un tableau" aria-current={tableActive ? "page" : undefined}>
            <Table2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <SelectValue placeholder="Choisir un tableau…" />
          </SelectTrigger>
          <SelectContent align="end" className="max-h-[70dvh]">
            {groups.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.keys.map((item) => {
                  const status = sectionStatut(collecte, item.key);
                  const hint = tableHint(collecte, item.key, isClient);
                  const missing = visibleMissing(item.key) ? missingByTable.get(item.key) ?? 0 : 0;
                  const attention = hint === "À examiner" || hint === "À reprendre" || hint === "À préciser" || hint === "À compléter";
                  return (
                    <SelectItem key={item.key} value={item.key} aria-current={active === item.key ? "page" : undefined}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("size-2 shrink-0 rounded-full", DOT[status])} aria-label={SECTION_STATUT_LABELS[status]} title={SECTION_STATUT_LABELS[status]} />
                        <span className="truncate">{item.label}</span>
                        <span className={cn("ml-auto pl-2 text-xs", attention ? "font-semibold text-warning" : "text-muted-foreground")}>{missing > 0 ? `${missing} à compléter` : hint}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    </nav>
  );
}
