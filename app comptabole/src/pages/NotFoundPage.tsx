import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass className="h-6 w-6" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">Page introuvable</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
      </div>
      <Button variant="ledger" onClick={() => navigate("/")}>
        Retour au tableau de bord
      </Button>
    </div>
  );
}
