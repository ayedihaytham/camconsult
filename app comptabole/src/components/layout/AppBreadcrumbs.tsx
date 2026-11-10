import { Fragment, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useBalances } from "@/store/balances";
import { useCollectes } from "@/store/collectes";
import { useSocietes } from "@/store/data";
import { useSuiviDevise } from "@/store/suiviDevise";
import { getAppBreadcrumbs } from "./breadcrumbs";

export function AppBreadcrumbs({ clair = false }: { clair?: boolean }) {
  const { pathname } = useLocation();
  const societes = useSocietes();
  const collecteList = useCollectes((state) => state.list);
  const currentCollecte = useCollectes((state) => state.current);
  const balanceList = useBalances((state) => state.list);
  const currentBalance = useBalances((state) => state.current);
  const suiviDeviseList = useSuiviDevise((state) => state.list);
  const currentSuiviDevise = useSuiviDevise((state) => state.current);

  const crumbs = useMemo(
    () =>
      getAppBreadcrumbs(pathname, {
        societes,
        collectes: currentCollecte
          ? [currentCollecte, ...collecteList.filter((item) => item.id !== currentCollecte.id)]
          : collecteList,
        balances: currentBalance
          ? [currentBalance, ...balanceList.filter((item) => item.id !== currentBalance.id)]
          : balanceList,
        suiviDevise: currentSuiviDevise
          ? [currentSuiviDevise, ...suiviDeviseList.filter((item) => item.id !== currentSuiviDevise.id)]
          : suiviDeviseList,
      }),
    [
      balanceList,
      collecteList,
      currentBalance,
      currentCollecte,
      currentSuiviDevise,
      pathname,
      societes,
      suiviDeviseList,
    ],
  );
  const firstVisibleOnMobile = crumbs.length > 2 ? crumbs.length - 2 : 0;

  return (
    <Breadcrumb aria-label="Fil d’Ariane" className="min-w-0 shrink overflow-hidden">
      <BreadcrumbList className={cn("flex-nowrap gap-1 overflow-hidden sm:gap-1.5", clair ? "text-muted-foreground" : "text-sidebar-muted")}>
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;
          const hiddenOnMobile = index < firstVisibleOnMobile;

          return (
            <Fragment key={`${crumb.to ?? "current"}-${crumb.label}`}>
              {index > 0 && (
                <BreadcrumbSeparator
                  className={cn(
                    clair ? "shrink-0 text-muted-foreground/40" : "shrink-0 text-white/30",
                    index === firstVisibleOnMobile && "hidden sm:inline-flex",
                  )}
                />
              )}
              <BreadcrumbItem
                className={cn(
                  "min-w-0",
                  hiddenOnMobile && "hidden sm:inline-flex",
                  isCurrent ? "flex-1" : "shrink-0",
                )}
              >
                {isCurrent ? (
                  <BreadcrumbPage
                    className={cn("block max-w-[9rem] truncate font-semibold sm:max-w-[14rem] lg:max-w-[22rem]", clair ? "text-[0.9rem] text-primary" : "text-[1.05rem] text-white")}
                    title={crumb.label}
                  >
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={crumb.to ?? "/"}
                      className={cn("block max-w-[8rem] truncate text-[0.8125rem] transition-colors sm:max-w-[12rem]", clair ? "text-muted-foreground hover:text-primary" : "text-sidebar-muted hover:text-white")}
                      title={crumb.label}
                    >
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
