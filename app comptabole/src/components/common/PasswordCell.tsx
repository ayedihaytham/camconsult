import { useEffect, useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

/**
 * Cellule mot de passe : masquée par défaut (••••••••), révélée
 * temporairement au clic, se re-masque automatiquement après 8 s.
 */
export function PasswordCell({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(false), 8000);
    return () => clearTimeout(t);
  }, [revealed]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Mot de passe copié");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copie impossible");
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={
          revealed
            ? "font-mono text-xs text-foreground"
            : "select-none font-mono text-sm tracking-[0.15em] text-muted-foreground"
        }
      >
        {revealed ? value : "••••••••••"}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {revealed ? <EyeOff /> : <Eye />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{revealed ? "Masquer" : "Afficher"}</TooltipContent>
      </Tooltip>
      {revealed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              onClick={copy}
              aria-label="Copier le mot de passe"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copier</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
