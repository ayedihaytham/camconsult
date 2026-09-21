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
import { getAppBreadcrumbs } from "./breadcrumbs";

export function AppBreadcrumbs() {
  const { pathname } = useLocation();
  const societes = useSocietes();
  const collecteList = useCollectes((state) => state.list);
  const currentCollecte = useCollectes((state) => state.current);
  const balanceList = useBalances((state) => state.list);
  const currentBalance = useBalances((state) => state.current);

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
      }),
    [
      balanceList,
      collecteList,
      currentBalance,
      currentCollecte,
      pathname,
      societes,
    ],
  );
  const firstVisibleOnMobile = crumbs.length > 2 ? crumbs.length - 2 : 0;

  return (
    <Breadcrumb aria-label="Fil d’Ariane" className="min-w-0 flex-1 overflow-hidden">
      <BreadcrumbList className="flex-nowrap gap-1 overflow-hidden sm:gap-1.5">
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;
          const hiddenOnMobile = index < firstVisibleOnMobile;

          return (
            <Fragment key={`${crumb.to ?? "current"}-${crumb.label}`}>
              {index > 0 && (
                <BreadcrumbSeparator
                  className={cn(
                    "shrink-0",
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
                    className="block max-w-[9rem] truncate text-sm font-semibold text-primary sm:max-w-[14rem] lg:max-w-[22rem]"
                    title={crumb.label}
                  >
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={crumb.to ?? "/"}
                      className="block max-w-[8rem] truncate text-sm sm:max-w-[12rem]"
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
