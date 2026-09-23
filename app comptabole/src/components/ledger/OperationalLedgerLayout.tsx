import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OperationalLedgerPageProps {
  children: ReactNode;
  className?: string;
}

/** Shared desktop page rhythm; mobile spacing remains owned by each module. */
export function OperationalLedgerPage({
  children,
  className,
}: OperationalLedgerPageProps) {
  return (
    <div
      className={cn(
        "operational-ledger-page flex w-full min-w-0 flex-col lg:gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface OperationalLedgerToolbarProps {
  search: ReactNode;
  resultCount?: string;
  tools?: ReactNode;
  label: string;
}

/** Common desktop utility row; module controls and search semantics stay local. */
export function OperationalLedgerToolbar({
  search,
  resultCount,
  tools,
  label,
}: OperationalLedgerToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className="operational-ledger-toolbar hidden min-w-0 items-center gap-2 border-y border-border/80 bg-secondary/45 px-2 py-1 lg:flex"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 flex-1">{search}</div>
        {resultCount && (
          <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {resultCount}
          </span>
        )}
      </div>
      {tools && (
        <div className="ml-auto flex shrink-0 items-center gap-2">{tools}</div>
      )}
    </div>
  );
}

interface OperationalContentHeaderProps {
  children: ReactNode;
  className?: string;
}

/** Shared title/context band for registry and work-surface headers. */
export function OperationalContentHeader({
  children,
  className,
}: OperationalContentHeaderProps) {
  return (
    <div
      className={cn(
        "operational-ledger-content-header flex min-w-0 items-center justify-between gap-3 border-b border-border/80 bg-card px-3 py-1 sm:px-4 lg:min-h-10 lg:px-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
