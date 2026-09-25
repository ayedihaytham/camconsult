import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type FinancialView =
  | "exercices"
  | "actif"
  | "passif"
  | "resultat"
  | "sig"
  | "synthese"
  | "immo"
  | "registre"
  | "flux"
  | "tdrf"
  | "controle"
  | "notes";

export const FINANCIAL_VIEW_GROUPS: {
  label: string;
  views: { value: FinancialView; label: string }[];
}[] = [
  { label: "Dossier", views: [{ value: "exercices", label: "Exercices" }] },
  {
    label: "États financiers",
    views: [
      { value: "actif", label: "Bilan Actif" },
      { value: "passif", label: "Bilan Passif" },
      { value: "resultat", label: "État de résultat" },
      { value: "flux", label: "Flux de trésorerie" },
    ],
  },
  {
    label: "Analyses",
    views: [
      { value: "sig", label: "SIG" },
      { value: "tdrf", label: "TDRF" },
      { value: "synthese", label: "Synthèse AFFECTAT" },
    ],
  },
  {
    label: "Annexes",
    views: [
      { value: "notes", label: "Notes" },
      { value: "immo", label: "TAB VAR Immob" },
      { value: "registre", label: "Registre immobilisations" },
    ],
  },
  { label: "Contrôle", views: [{ value: "controle", label: "Contrôle" }] },
];

const ALL_VIEWS = FINANCIAL_VIEW_GROUPS.flatMap((group) => group.views);

export function financialViewLabel(value: FinancialView) {
  return ALL_VIEWS.find((view) => view.value === value)?.label ?? "Exercices";
}

function ViewGroups({
  value,
  onChange,
  closeOnSelect,
  rail = false,
}: {
  value: FinancialView;
  onChange: (value: FinancialView) => void;
  closeOnSelect?: () => void;
  rail?: boolean;
}) {
  return (
    <div className={cn(rail ? "space-y-2" : "space-y-3")}>
      {FINANCIAL_VIEW_GROUPS.map((group) => (
        <section key={group.label} aria-label={group.label} className={cn(rail && "border-t border-border/80 pt-2 first:border-t-0 first:pt-0")}>
          <h3 className={cn("border-b border-border px-2 pb-1.5 text-[0.63rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground", rail && "border-0 px-2 pb-1 text-[0.58rem] tracking-[0.11em]")}>
            {group.label}
          </h3>
          <div className={cn("mt-1 space-y-0.5", rail && "mt-0 space-y-px")}>
            {group.views.map((view) => {
              const active = value === view.value;
              return (
                <button
                  key={view.value}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    onChange(view.value);
                    closeOnSelect?.();
                  }}
                  className={cn(
                    "flex min-h-9 w-full items-center justify-between border-l-2 px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    rail && "min-h-[31px] px-2.5 text-[0.7rem]",
                    active
                      ? "border-accent bg-primary/[0.06] font-semibold text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    closeOnSelect && "min-h-11",
                  )}
                >
                  <span>{view.label}</span>
                  {active && !rail && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function FinancialViewNavigation({
  value,
  onChange,
}: {
  value: FinancialView;
  onChange: (value: FinancialView) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Navigation des états financiers"
        className="hidden border-r border-border bg-muted/40 px-2 py-3 lg:block"
      >
        <ViewGroups value={value} onChange={onChange} rail />
      </nav>

      <div className="border-b border-border p-3 lg:hidden">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full justify-between bg-background text-left"
          aria-haspopup="dialog"
          onClick={() => setMobileOpen(true)}
        >
          <span className="min-w-0 truncate">{financialViewLabel(value)}</span>
          <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
        </Button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="bottom" className="h-[min(82dvh,42rem)] rounded-t-xl p-0">
            <SheetHeader className="px-4 py-3">
              <SheetTitle>États financiers</SheetTitle>
              <SheetDescription>Choisissez une vue du dossier.</SheetDescription>
            </SheetHeader>
            <SheetBody className="px-3 py-3">
              <ViewGroups
                value={value}
                onChange={onChange}
                closeOnSelect={() => setMobileOpen(false)}
              />
            </SheetBody>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
