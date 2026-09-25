import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { useCollectes } from "@/store/collectes";
import type { CollecteNote } from "@/types";

interface Props {
  collecteId: string;
  onglet: string;
  notes: CollecteNote[];
  canWrite: boolean; // admin ou client de société (pas le collaborateur)
}

/** Fil de notes d'un onglet (admin <-> client). */
export function OngletNotes({ collecteId, onglet, notes, canWrite }: Props) {
  const addNote = useCollectes((s) => s.addNote);
  const [text, setText] = useState("");
  const thread = notes.filter((n) => n.kind === "note" && n.onglet === onglet);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Notes sur cet onglet {thread.length ? `(${thread.length})` : ""}
      </p>
      <div className="space-y-1.5">
        {thread.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune note. {canWrite ? "" : "Seuls le cabinet et le client peuvent en ajouter."}
          </p>
        )}
        {thread.map((n) => (
          <div key={n.id} className="border-b border-border/70 px-2 py-1.5 last:border-b-0">
            <p className="text-sm text-foreground">{n.texte}</p>
            <p className="text-[11px] text-muted-foreground">
              {n.auteur === "admin" ? "Cabinet" : "Client"} ·{" "}
              {formatRelative(n.creeLe)}
            </p>
          </div>
        ))}
      </div>
      {canWrite && (
        <div className="mt-2 flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
          <Input
            className="h-10 w-full min-w-0 flex-1 lg:h-8"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Préciser ce qui manque / une remarque…"
            aria-label="Préciser ce qui manque ou ajouter une remarque"
          />
          <Button
            size="sm"
            variant="outline"
            className="min-h-10 self-end lg:min-h-8 lg:self-auto"
            onClick={async () => {
              if (!text.trim()) return;
              await addNote(collecteId, onglet, text.trim());
              setText("");
            }}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>
      )}
    </div>
  );
}
