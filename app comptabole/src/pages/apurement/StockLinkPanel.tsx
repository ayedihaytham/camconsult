import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { tnd } from "@/lib/apurement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApurementRecord } from "@/types/apurement";
type Source = {
  id: string;
  hash: string;
  numero: string;
  fournisseur: string;
  date: string | null;
  htMillimes: string;
  erreur?: string;
};
export function StockLinkPanel({
  invoice,
  onSaved,
  bcs,
}: {
  invoice: ApurementRecord;
  onSaved: () => void;
  bcs: ApurementRecord[];
}) {
  const [sources, setSources] = useState<Source[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [q, setQ] = useState("");
  const [resolution, setResolution] = useState("stock");
  const [chosenBc, setChosenBc] = useState(invoice.bcId || "");
  const [params] = useSearchParams();
  async function find() {
    setBusy(true);
    try {
      if (invoice.stockMouvementId) {
        const r = await api.get<Source>(
          `/apurement/factures/${invoice.id}/stock`,
        );
        setSources([r]);
      } else if (params.get("stockId")) {
        setSources([
          await api.get<Source>(`/apurement/stock/${params.get("stockId")}`),
        ]);
      } else {
        const r = await api.post<{ items: Source[] }>(
          "/apurement/stock/suggestions",
          { societeId: invoice.societeId, q },
        );
        setSources(r.items);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lecture impossible");
    } finally {
      setBusy(false);
    }
  }
  async function link(source: Source) {
    setBusy(true);
    setError("");
    try {
      await api.post(
        `/apurement/factures/${invoice.id}/${invoice.stockMouvementId ? "synchroniser" : "lier-stock"}`,
        {
          expectedVersion: invoice.version,
          stockId: source.id,
          stockHash: source.hash,
          resolution,
          confirmer: true,
          ...(chosenBc ? { bcId: chosenBc } : {}),
        },
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Liaison impossible");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">Source Stock</h3>
      <p className="text-xs text-muted-foreground">
        Une liaison explicite synchronise date et numéro. Les montants liés se
        corrigent dans Stock, sauf confirmation d’une ligne unique TND non
        ambiguë.
      </p>
      {invoice.conflit != null && (
        <p role="alert" className="text-sm text-destructive">
          Conflit à résoudre avant modification.
        </p>
      )}
      <label className="block text-sm">
        BC à confirmer pour ce rapprochement
        <select
          className="mt-1 h-10 w-full rounded border bg-background px-2"
          value={chosenBc}
          onChange={(e) => setChosenBc(e.target.value)}
        >
          <option value="">Conserver l’affectation actuelle</option>
          {bcs.map((b) => (
            <option key={b.id} value={b.id}>
              {b.numero}
            </option>
          ))}
        </select>
      </label>
      {invoice.stockMouvementId && (
        <Link className="text-sm underline" to={`/stock/${invoice.societeId}`}>
          Ouvrir Stock
        </Link>
      )}
      {invoice.stockMouvementId && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.post(`/apurement/factures/${invoice.id}/delier-stock`, {
                expectedVersion: invoice.version,
                motif: "Déliaison explicitement demandée par le préparateur",
              });
              onSaved();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Déliaison impossible");
            } finally {
              setBusy(false);
            }
          }}
        >
          Délier explicitement ce brouillon
        </Button>
      )}
      <Input
        aria-label="Numéro ou fournisseur Stock"
        placeholder="Numéro ou fournisseur Stock"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Button type="button" variant="outline" disabled={busy} onClick={find}>
        {invoice.stockMouvementId
          ? "Comparer avec Stock"
          : "Rechercher les achats Stock"}
      </Button>
      {sources.length > 0 && (
        <>
          <label className="block text-sm" htmlFor="stock-resolution">
            Résolution à confirmer
          </label>
          <select
            id="stock-resolution"
            className="h-10 w-full rounded border bg-background px-2"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          >
            <option value="stock">Reprendre les valeurs Stock</option>
            <option value="apurement">
              Reprendre Apurement (en-tête seulement)
            </option>
            <option value="conflit">Conserver et ouvrir un conflit</option>
          </select>
          {sources.map((s) => (
            <div key={s.id} className="space-y-2 border-b py-2 text-sm">
              <p>
                {s.numero} · {s.fournisseur} · {s.date || "Date absente"}
              </p>
              <p>
                Stock : {tnd(s.htMillimes)} · Apurement :{" "}
                {tnd(invoice.montantHtMillimes)}
              </p>
              {s.erreur ? (
                <p>{s.erreur}</p>
              ) : (
                <Button type="button" disabled={busy} onClick={() => link(s)}>
                  Confirmer cette source et cette résolution
                </Button>
              )}
            </div>
          ))}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
