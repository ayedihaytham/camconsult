import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleBannerTitleProps {
  icon: LucideIcon;
  children: ReactNode;
  id?: string;
  className?: string;
}

/** Shared title treatment for visible module banners. */
export function ModuleBannerTitle({
  icon: Icon,
  children,
  id,
  className,
}: ModuleBannerTitleProps) {
  return (
    <h1
      id={id}
      className={cn("flex min-w-0 items-center gap-2", className)}
    >
      <Icon
        aria-hidden="true"
        className="size-[18px] shrink-0 text-primary-foreground/75 sm:size-5"
      />
      <span className="min-w-0">{children}</span>
    </h1>
  );
}
