import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function WorkspaceSection({ title, description, children, target, route, linkLabel = "Tout voir", subsection = false, icon: Icon, footerLink = false }: { title: string; description?: string; children: ReactNode; target?: string; route?: string; linkLabel?: string; subsection?: boolean; icon?: LucideIcon; footerLink?: boolean }) {
  const Heading = subsection ? "h3" : "h2";
  return <section data-tour={target} className={`${subsection ? "dashboard-group" : "dashboard-major"} min-w-0`}>
    <header className={`${subsection ? "dashboard-subsection" : "mb-1 border-b border-primary/25 pb-2"} flex items-start justify-between gap-3`}>
      <div className="dashboard-section-identity min-w-0">{Icon && <Icon className="dashboard-section-icon" aria-hidden="true" />}<div className="min-w-0"><Heading className={`${subsection ? "text-sm" : "text-base"} font-semibold text-primary`}>{title}</Heading>{description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}</div></div>
      {route && !footerLink && <Link to={route} className="flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{linkLabel}<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>}
    </header>{children}
    {route && footerLink && <footer className="dashboard-card-footer"><Link to={route} className="dashboard-navigation">{linkLabel}<span className="dashboard-card-footer-icon" aria-hidden="true"><ArrowUpRight /></span></Link></footer>}
  </section>;
}

export function WorkspaceLoading() { return <div role="status" aria-label="Chargement des collectes" className="space-y-2 py-3"><span className="sr-only">Chargement des collectes…</span>{[0, 1].map((id) => <Skeleton key={id} className="h-14 w-full motion-reduce:animate-none" />)}</div>; }

export function CollectionFailure({ onRetry }: { onRetry: () => void }) {
  return <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded border border-destructive/25 bg-destructive/5 px-3 py-3 text-sm">
    <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /><div><p className="font-medium">Collectes indisponibles</p><p className="mt-1 text-xs text-muted-foreground">Leurs échéances et corrections ne sont pas chargées. Les autres éléments restent accessibles.</p></div></div>
    <Button variant="outline" className="min-h-11" onClick={onRetry}>Réessayer</Button>
  </div>;
}
