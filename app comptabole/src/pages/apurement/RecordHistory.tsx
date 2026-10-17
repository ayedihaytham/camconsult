import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { tnd } from "@/lib/apurement";
import { Button } from "@/components/ui/button";
import type { ApurementList } from "@/types/apurement";
type Entry = {
  id: string;
  action: string;
  nomActeur: string;
  createdAt: string;
  avant: unknown;
  apres: unknown;
};
export function RecordHistory({
  societeId,
  recordId,
}: {
  societeId: string;
  recordId: string;
}) {
  const [rows, setRows] = useState<Entry[]>([]),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let live = true;
    api
      .get<Entry[]>(
        `/apurement/audit?societeId=${societeId}&entityId=${recordId}`,
      )
      .then((r) => {
        if (live) setRows(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [open, societeId, recordId]);
  return (
    <section className="space-y-3 border-t pt-4">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Historique audité
      </Button>
      {open &&
        rows.map((r) => (
          <details className="border-b py-2 text-sm" key={r.id}>
            <summary className="cursor-pointer">
              {r.action} · {r.nomActeur} ·{" "}
              {new Date(r.createdAt).toLocaleString("fr-TN", {
                timeZone: "Africa/Tunis",
              })}
            </summary>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">
              {JSON.stringify({ avant: r.avant, apres: r.apres }, null, 2)}
            </pre>
          </details>
        ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function BcDetails({
  societeId,
  bcId,
}: {
  societeId: string;
  bcId: string;
}) {
  const [result, setResult] = useState<{
    periodes: {
      annee: number;
      trimestre: string;
      factures: number;
      ht: string;
      tva: string;
    }[];
    declarations: {
      id: string;
      annee: number;
      trimestre: string;
      version: number;
      depot: string | null;
    }[];
  } | null>(null);
  const [invoices, setInvoices] = useState<ApurementList | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([
      api.get<NonNullable<typeof result>>(
        `/apurement/bcs/${bcId}/rapprochement`,
      ),
      api.get<ApurementList>(
        `/apurement/factures?societeId=${societeId}&bcId=${bcId}&page=${page}`,
      ),
    ])
      .then(([r, f]) => {
        if (live) {
          setResult(r);
          setInvoices(f);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [societeId, bcId, page]);
  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">Rapprochement du BC</h3>
      {result?.periodes.map((p) => (
        <p key={`${p.annee}-${p.trimestre}`} className="text-sm tabular-nums">
          {p.annee} {p.trimestre} · {p.factures} facture(s) · HT {tnd(p.ht)} ·
          TVA {tnd(p.tva)}
        </p>
      ))}
      {result?.declarations.map((d) => (
        <p key={d.id} className="text-sm">
          <Link
            className="underline"
            to={`/apurement/${societeId}/declarations/${d.id}?annee=${d.annee}&trimestre=${d.trimestre}`}
          >
            {d.annee} {d.trimestre} version {d.version}
          </Link>{" "}
          · Déclaré · {d.depot || "Non déposé"}
        </p>
      ))}
      <div className="divide-y">
        {invoices?.items.map((f) => (
          <div key={f.id} className="py-2 text-sm">
            <Link
              className="underline"
              to={`/apurement/${societeId}/factures/${f.id}?annee=${f.annee}&trimestre=${f.trimestre}`}
            >
              {f.numeroFacture}
            </Link>{" "}
            · {tnd(f.montantHtMillimes)}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Précédent
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!invoices?.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Suivant
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
