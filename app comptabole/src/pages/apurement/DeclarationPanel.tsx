import { Badge } from "@/components/ui/badge";
import {
  FileText,
  LockKeyhole,
  ArrowRight,
  Check,
  Send,
  ClipboardCheck,
} from "lucide-react";
import { ApurementSelect } from "./ApurementSelect";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { tnd } from "@/lib/apurement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentsPanel, downloadApurement } from "./DocumentsPanel";
import type { Quarter } from "@/types/apurement";
type Declaration = {
  id: string;
  version: number;
  statut: "brouillon" | "pret_a_valider" | "valide";
  snapshotHash: string | null;
  controlHash?: string;
  apercu?: { totals: { ht: string; tvaLignes: string; ecart: string } };
  depot?: string;
  supersedeDeclarationId?: string;
  exports?: { id: string; nom: string; type: string }[];
  depots?: {
    id: string;
    reference: string;
    dateDepot: string;
    statut: string;
    version: number;
  }[];
  snapshot?: { totals: { ht: string; tvaLignes: string; ecart: string } };
};
type Piece = { id: string; nom: string };
export function DeclarationPanel({
  societeId,
  annee,
  trimestre,
  selectedId,
}: {
  societeId: string;
  annee: number;
  trimestre: Quarter;
  selectedId?: string;
}) {
  const [list, setList] = useState<Declaration[]>([]),
    [selected, setSelected] = useState<Declaration | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [pieces, setPieces] = useState<Piece[]>([]),
    [proof, setProof] = useState(""),
    [reference, setReference] = useState(""),
    [date, setDate] = useState(""),
    [note, setNote] = useState("");
  const [policyReference, setPolicyReference] = useState(""),
    [policy, setPolicy] = useState<{ reference: string }[]>([]);
  const { canManageCollaborateurs } = usePermissions();
  const [documentsOpen, setDocumentsOpen] = useState(true);
  const load = useCallback(
    async (id?: string) => {
      let loaded: Declaration | null = null;
      const rows = await api.get<Declaration[]>(
        `/apurement/declarations?societeId=${societeId}&annee=${annee}&trimestre=${trimestre}`,
      );
      setList(rows);
      const target = id || selectedId;
      if (target) {
        const d = await api.get<Declaration>(
          `/apurement/declarations/${target}`,
        );
        setSelected(d);
        loaded = d;
        setPieces(
          await api.get<Piece[]>(
            `/apurement/pieces?societeId=${societeId}&parentType=declaration&parentId=${target}`,
          ),
        );
      }
      setPolicy(
        await api.get<{ reference: string }[]>(
          `/apurement/politique-calcul?societeId=${societeId}`,
        ),
      );
      return loaded;
    },
    [societeId, annee, trimestre, selectedId],
  );
  useEffect(() => {
    setSelected(null);
    load().catch((e) => setError(e.message));
  }, [load]);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      const declarationResult =
        typeof result === "object" &&
        result !== null &&
        "statut" in result &&
        ["brouillon", "pret_a_valider", "valide"].includes(
          String(result.statut),
        ) &&
        "id" in result;
      await load(declarationResult ? String(result.id) : selected?.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opération impossible");
    } finally {
      setBusy(false);
    }
  }
  async function exportFile(type: string) {
    if (!selected) return;
    await action(async () => {
      const e = await api.post<{ id: string; nom: string }>(
        `/apurement/declarations/${selected.id}/exports`,
        { type },
      );
      await downloadApurement(`/exports/${e.id}/telecharger`, e.nom);
    });
  }
  const totals = selected?.snapshot?.totals || selected?.apercu?.totals;
  return (
    <section
      className="space-y-4 [&_button]:max-w-full [&_button]:whitespace-normal [&_button]:h-auto [&_button]:min-h-10"
      data-tour="apurement-declarations"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          Déclarations {annee} {trimestre}
        </h2>
        <Button
          disabled={busy}
          onClick={() =>
            action(async () => {
              const d = await api.post<Declaration>("/apurement/declarations", {
                societeId,
                annee,
                trimestre,
              });
              setSelected(d);
              await load(d.id);
              return d;
            })
          }
        >
          Préparer une déclaration
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Préparez une version, faites-la valider puis renseignez le dépôt. Une
        génération Excel ou PDF ne vaut jamais dépôt.
      </p>
      {!list.length && (
        <p className="rounded-lg border border-dashed bg-background p-5 text-sm">
          Aucune déclaration pour ce trimestre. Commencez par les factures et
          leurs contrôles, puis choisissez « Préparer une déclaration ».
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b bg-muted/30 px-5 py-3 text-sm font-semibold text-primary">
          Versions du trimestre{" "}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {list.length} version(s)
          </span>
        </div>
        {list.map((d) => (
          <div
            key={d.id}
            className={`flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 text-sm last:border-b-0 ${selected?.id === d.id ? "bg-primary/5" : "hover:bg-muted/30"}`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <FileText
                className="mt-1 size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <Link
                  className="font-semibold text-primary hover:underline"
                  to={`/apurement/${societeId}/declarations/${d.id}?annee=${annee}&trimestre=${trimestre}`}
                >
                  Version {d.version}
                </Link>
                <p className="mt-2 flex flex-wrap gap-2">
                  <Badge
                    variant={
                      d.statut === "valide"
                        ? "success"
                        : d.statut === "pret_a_valider"
                          ? "warning"
                          : "muted"
                    }
                  >
                    {d.statut === "valide"
                      ? "Validée — figée"
                      : d.statut === "pret_a_valider"
                        ? "À valider"
                        : "Brouillon"}
                  </Badge>
                  <Badge variant="outline">{d.depot || "Non déposé"}</Badge>
                </p>
                {d.supersedeDeclarationId && (
                  <p className="text-xs text-muted-foreground">
                    Rectificative d’une version antérieure
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => action(() => load(d.id))}
            >
              {selected?.id === d.id ? "Version ouverte" : "Ouvrir"}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        ))}
      </div>
      {selected && (
        <div className="apurement-declaration-detail space-y-5 overflow-hidden rounded-xl border bg-card p-5 sm:p-6">
          <h3 className="apurement-declaration-title -mx-5 -mt-5 flex items-center gap-3 bg-primary px-5 py-5 text-lg font-semibold text-primary-foreground sm:-mx-6 sm:-mt-6 sm:px-6">
            {selected.statut === "valide" ? (
              <LockKeyhole className="size-5 shrink-0" />
            ) : (
              <FileText className="size-5 shrink-0" />
            )}
            Version {selected.version} ·{" "}
            {selected.statut === "valide"
              ? "Validée et figée"
              : selected.statut === "pret_a_valider"
                ? "À valider par le responsable"
                : "Brouillon"}
          </h3>
          <ol
            aria-label="Circuit de la déclaration"
            className="apurement-declaration-steps grid gap-2 text-sm sm:grid-cols-3"
          >
            <li className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-3 font-medium text-primary">
              <Check className="size-4 shrink-0" />
              Préparation
            </li>
            <li
              className={
                selected.statut !== "brouillon"
                  ? "flex items-center gap-2 rounded-md bg-primary/10 px-3 py-3 font-medium text-primary"
                  : "flex items-center gap-2 rounded-md bg-muted/50 px-3 py-3 text-muted-foreground"
              }
            >
              <ClipboardCheck className="size-4 shrink-0" />
              Validation{" "}
              {selected.statut === "valide" ? "effectuée" : "à obtenir"}
            </li>
            <li className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-3 text-muted-foreground">
              <Send className="size-4 shrink-0" />
              Dépôt {selected.depots?.length ? "enregistré" : "à renseigner"}
            </li>
          </ol>
          {totals && (
            <dl className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Total HT</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums">
                  {tnd(totals.ht)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">TVA suspendue</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums">
                  {tnd(totals.tvaLignes)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Écart de calcul
                </dt>
                <dd className="mt-1 text-base font-semibold tabular-nums">
                  {tnd(totals.ecart)}
                </dd>
              </div>
            </dl>
          )}
          {selected.snapshotHash && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                Empreinte de la version figée
              </summary>
              <p className="break-all pt-2">
                SHA-256 : {selected.snapshotHash}
              </p>
            </details>
          )}
          <details
            className="rounded-lg border bg-muted/10 p-4"
            open={documentsOpen}
            onToggle={(event) => setDocumentsOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer text-sm font-semibold">
              Justificatifs de cette déclaration · {pieces.length} pièce(s)
            </summary>
            <DocumentsPanel
              key={selected.id}
              societeId={societeId}
              parentType="declaration"
              parentId={selected.id}
              onPiecesChanged={setPieces}
            />
          </details>
          <details
            className="space-y-3 rounded-lg border bg-muted/10 p-4"
            open={!policy.length && selected.statut !== "valide"}
          >
            <summary className="cursor-pointer text-sm font-semibold">
              Règle d’arrondi ·{" "}
              {policy.length
                ? "décision interne documentée"
                : "décision requise avant validation"}
            </summary>
            <p className="text-xs text-muted-foreground">
              {policy[0]
                ? `Référence approuvée : ${policy[0].reference}`
                : "Validation financière bloquée : règle non approuvée."}{" "}
              Le seul mode pris en charge calcule par facture, au millime, demi
              supérieur. Ce choix ne valide pas le format BCD officiel.
            </p>
            {canManageCollaborateurs && !policy.length && (
              <>
                <label className="block text-sm">
                  Référence de la décision comptable
                  <Input
                    value={policyReference}
                    onChange={(e) => setPolicyReference(e.target.value)}
                  />
                </label>
                <ProofSelect
                  pieces={pieces}
                  value={proof}
                  onChange={setProof}
                />
                <Button
                  disabled={busy || !proof || !policyReference.trim()}
                  variant="outline"
                  onClick={() =>
                    action(() =>
                      api.put("/apurement/politique-calcul", {
                        societeId,
                        mode: "demi_superieur_facture",
                        reference: policyReference,
                        preuveId: proof,
                        confirmer: true,
                      }),
                    )
                  }
                >
                  Confirmer la règle interne documentée
                </Button>
              </>
            )}
          </details>
          {(selected.statut === "valide" ||
            (selected.apercu && selected.apercu.totals.ecart !== "0")) && (
            <label className="block text-sm">
              {selected.statut === "valide"
                ? "Motif ou observation du dépôt"
                : "Justification si la TVA détaillée diffère du calcul global"}
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          )}
          <div className="flex flex-wrap gap-3 border-t pt-5">
            {selected.statut === "brouillon" && (
              <Button
                disabled={busy}
                onClick={() =>
                  action(() =>
                    api.post(
                      `/apurement/declarations/${selected.id}/soumettre-validation`,
                    ),
                  )
                }
              >
                Soumettre à validation
              </Button>
            )}
            {selected.statut === "pret_a_valider" &&
              canManageCollaborateurs && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    action(() =>
                      api.post(
                        `/apurement/declarations/${selected.id}/valider`,
                        {
                          motifEcart: note,
                          expectedControlHash: selected.controlHash,
                        },
                      ),
                    )
                  }
                >
                  Valider et figer cette version
                </Button>
              )}
            {selected.statut === "valide" && (
              <>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => exportFile("excel")}
                >
                  Excel interne
                </Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => exportFile("pdf")}
                >
                  PDF interne
                </Button>
                {canManageCollaborateurs && (
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() =>
                      action(() =>
                        api.post(
                          `/apurement/declarations/${selected.id}/rectifier`,
                        ),
                      )
                    }
                  >
                    Préparer une rectificative
                  </Button>
                )}
              </>
            )}
            {selected.statut !== "valide" && (
              <>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => exportFile("excel")}
                >
                  Excel brouillon non validé
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => exportFile("pdf")}
                >
                  PDF brouillon non validé
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Les rapports Excel/PDF sont destinés au suivi interne. Le dépôt
            officiel n’est pas effectué par l’application ; le format BCD reste
            indisponible tant qu’il n’a pas été vérifié.
          </p>
          {!!selected.exports?.length && (
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Fichiers conservés</h4>
              {selected.exports.map((e) => (
                <Button
                  className="max-w-full whitespace-normal break-all"
                  key={e.id}
                  variant="link"
                  disabled={busy}
                  onClick={() =>
                    action(() =>
                      downloadApurement(`/exports/${e.id}/telecharger`, e.nom),
                    )
                  }
                >
                  {e.nom}
                </Button>
              ))}
            </div>
          )}
          {selected.statut === "valide" && (
            <section className="space-y-3 border-t pt-3">
              <h4 className="text-sm font-semibold">
                Registre des dépôts manuels
              </h4>
              <p className="text-xs text-muted-foreground">
                Générer un fichier ne constitue ni dépôt ni acceptation. Joignez
                la preuve correspondante à cette déclaration.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Date de dépôt
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Référence du dépôt
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
              </div>
              <ProofSelect pieces={pieces} value={proof} onChange={setProof} />
              {canManageCollaborateurs && (
                <Button
                  disabled={busy || !date || !reference || !proof}
                  onClick={() =>
                    action(() =>
                      api.post(
                        `/apurement/declarations/${selected.id}/depots`,
                        { dateDepot: date, reference, preuveId: proof },
                      ),
                    )
                  }
                >
                  Enregistrer « déposé » avec preuve
                </Button>
              )}
              {selected.depots?.map((d) => (
                <div key={d.id} className="space-y-2 border-b py-2 text-sm">
                  <p>
                    {d.reference} · {d.dateDepot?.slice(0, 10)} · {d.statut}
                  </p>
                  {d.statut === "depose" && canManageCollaborateurs && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={busy || !proof || !note}
                        variant="outline"
                        onClick={() =>
                          action(() =>
                            api.patch(`/apurement/depots/${d.id}`, {
                              expectedVersion: d.version,
                              statut: "accepte",
                              preuveId: proof,
                              motif: note,
                            }),
                          )
                        }
                      >
                        Enregistrer l’acceptation avec preuve
                      </Button>
                      <Button
                        disabled={busy || !proof || !note}
                        variant="outline"
                        onClick={() =>
                          action(() =>
                            api.patch(`/apurement/depots/${d.id}`, {
                              expectedVersion: d.version,
                              statut: "rejete",
                              preuveId: proof,
                              motif: note,
                            }),
                          )
                        }
                      >
                        Enregistrer le rejet et préparer une rectificative
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
function ProofSelect({
  pieces,
  value,
  onChange,
}: {
  pieces: Piece[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      Preuve associée à la déclaration
      <ApurementSelect
        value={value}
        onValueChange={(value) => onChange(value)}
        options={[
          { value: "", label: <>Choisir la preuve</> },
          ...pieces.map((p) => ({ value: p.id, label: <>{p.nom}</> })),
        ]}
      />
    </label>
  );
}
