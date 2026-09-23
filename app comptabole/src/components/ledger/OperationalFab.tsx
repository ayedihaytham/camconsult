import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OperationalFabProps {
  label: string;
  onClick: () => void;
  className?: string;
}

/** Mobile create affordance; the caller retains all permission and selection logic. */
export function OperationalFab({ label, onClick, className }: OperationalFabProps) {
  return (
    <Button
      type="button"
      variant="default"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className={cn("operational-fab lg:hidden", className)}
    >
      <Plus className="size-5" aria-hidden="true" />
    </Button>
  );
}
