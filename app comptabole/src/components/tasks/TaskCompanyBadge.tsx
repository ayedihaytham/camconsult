import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TaskCompanyBadge({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      title={name}
      className={cn(
        "max-w-full border-border bg-transparent px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      <span className="truncate">{name}</span>
    </Badge>
  );
}
