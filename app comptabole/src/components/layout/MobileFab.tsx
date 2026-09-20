import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileFabProps
  extends Omit<ComponentProps<typeof Button>, "children" | "size"> {
  icon: LucideIcon;
  label: string;
}

export function MobileFab({
  icon: Icon,
  label,
  className,
  type = "button",
  ...props
}: MobileFabProps) {
  return (
    <Button
      type={type}
      size="icon"
      className={cn(
        "fixed right-4 z-40 size-14 rounded-full shadow-lg lg:hidden",
        "bottom-[calc(1rem+env(safe-area-inset-bottom))]",
        className,
      )}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
}
