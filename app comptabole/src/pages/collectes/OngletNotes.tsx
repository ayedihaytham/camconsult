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
    <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
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
          <div key={n.id} className="rounded-md bg-card px-3 py-1.5">
            <p className="text-sm text-foreground">{n.texte}</p>
            <p className="text-[11px] text-muted-foreground">
              {n.auteur === "admin" ? "Cabinet" : "Client"} ·{" "}
              {formatRelative(n.creeLe)}
            </p>
          </div>
        ))}
      </div>
      {canWrite && (
        <div className="mt-2 flex gap-2">
          <Input
            className="h-8"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Préciser ce qui manque / une remarque…"
          />
          <Button
            size="sm"
            variant="outline"
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
