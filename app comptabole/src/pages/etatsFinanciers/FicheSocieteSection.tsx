import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmt } from "@/lib/etatsFinanciers/postes";
import type { Associe, FicheSociete, ObjetSocialBloc } from "@/types";

/**
 * Fiche société — infos statutaires, objet social, structure du capital.
 * Réutilisée chaque exercice (changent rarement ; l'évolution du capital
 * est déjà suivie via le Flux de financement).
 */
export function FicheSocieteSection({
  fiche,
  onSave,
}: {
  fiche: FicheSociete;
  onSave: (data: Omit<FicheSociete, "societeId" | "majLe">) => void;
}) {
  const [formeJuridique, setFormeJuridique] = useState(fiche.formeJuridique);
  const [statutFiscal, setStatutFiscal] = useState(fiche.statutFiscal);
  const [dateCreation, setDateCreation] = useState(fiche.dateCreation ?? "");
  const [capitalInitial, setCapitalInitial] = useState(String(fiche.capitalInitial || ""));
  const [partsInitiales, setPartsInitiales] = useState(String(fiche.partsInitiales || ""));
  const [valeurNominale, setValeurNominale] = useState(String(fiche.valeurNominale || ""));
  const [objetSocial, setObjetSocial] = useState<ObjetSocialBloc[]>(fiche.objetSocial);
  const [associes, setAssocies] = useState<Associe[]>(fiche.associes);

  useEffect(() => {
    setFormeJuridique(fiche.formeJuridique);
    setStatutFiscal(fiche.statutFiscal);
    setDateCreation(fiche.dateCreation ?? "");
    setCapitalInitial(String(fiche.capitalInitial || ""));
    setPartsInitiales(String(fiche.partsInitiales || ""));
    setValeurNominale(String(fiche.valeurNominale || ""));
    setObjetSocial(fiche.objetSocial);
    setAssocies(fiche.associes);
  }, [fiche]);

  function commit() {
    onSave({
      formeJuridique,
      statutFiscal,
      dateCreation: dateCreation || null,
      capitalInitial: Number(capitalInitial) || 0,
      partsInitiales: Number(partsInitiales) || 0,
      valeurNominale: Number(valeurNominale) || 0,
      objetSocial,
      associes,
    });
  }

  const totalParts = associes.reduce((s, a) => s + a.parts, 0);
  const totalValeur = associes.reduce((s, a) => s + a.valeurParts, 0);

  return (
    <div className="space-y-4">
      <LedgerSheet className="p-[18px]">
        <p className="mb-3 text-sm font-bold text-foreground">Présentation de la société</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Forme juridique">
            <Input value={formeJuridique} onChange={(e) => setFormeJuridique(e.target.value)} onBlur={commit} placeholder="SARL, SA…" />
          </Field>
          <Field label="Statut fiscal">
            <Input
              value={statutFiscal}
              onChange={(e) => setStatutFiscal(e.target.value)}
              onBlur={commit}
              placeholder="Résidente, totalement exportatrice…"
            />
          </Field>
          <Field label="Date de création">
            <Input type="date" value={dateCreation} onChange={(e) => setDateCreation(e.target.value)} onBlur={commit} />
          </Field>
          <Field label="Capital initial (DT)">
            <Input value={capitalInitial} onChange={(e) => setCapitalInitial(e.target.value)} onBlur={commit} />
          </Field>
          <Field label="Nombre de parts initiales">
            <Input value={partsInitiales} onChange={(e) => setPartsInitiales(e.target.value)} onBlur={commit} />
          </Field>
          <Field label="Valeur nominale d'une part (DT)">
            <Input value={valeurNominale} onChange={(e) => setValeurNominale(e.target.value)} onBlur={commit} />
          </Field>
        </div>
      </LedgerSheet>

      <LedgerSheet className="p-[18px]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-foreground">Objet social</p>
          <button
            onClick={() => setObjetSocial([...objetSocial, { titre: "", texte: "" }])}
            className="flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
          >
            <Plus className="h-3 w-3" />
            Ajouter une rubrique
          </button>
        </div>
        <div className="space-y-3">
          {objetSocial.map((bloc, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr_auto]">
              <Input
                value={bloc.titre}
                placeholder="Rubrique (ex. Objet social)"
                onChange={(e) => {
                  const next = [...objetSocial];
                  next[i] = { ...next[i], titre: e.target.value };
                  setObjetSocial(next);
                }}
                onBlur={commit}
              />
              <Textarea
                value={bloc.texte}
                placeholder="Texte"
                className="min-h-[44px]"
                onChange={(e) => {
                  const next = [...objetSocial];
                  next[i] = { ...next[i], texte: e.target.value };
                  setObjetSocial(next);
                }}
                onBlur={commit}
              />
              <button
                onClick={() => {
                  const next = objetSocial.filter((_, j) => j !== i);
                  setObjetSocial(next);
                  onSave({
                    formeJuridique,
                    statutFiscal,
                    dateCreation: dateCreation || null,
                    capitalInitial: Number(capitalInitial) || 0,
                    partsInitiales: Number(partsInitiales) || 0,
                    valeurNominale: Number(valeurNominale) || 0,
                    objetSocial: next,
                    associes,
                  });
                }}
                className="flex h-8 w-8 items-center justify-center self-start rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {objetSocial.length === 0 && <p className="text-sm text-muted-foreground">Aucune rubrique</p>}
        </div>
      </LedgerSheet>

      <LedgerSheet>
        <div className="flex items-center justify-between px-[18px] pt-[18px]">
          <p className="text-sm font-bold text-foreground">Structure du capital social</p>
          <button
            onClick={() => setAssocies([...associes, { nom: "", valeurParts: 0, parts: 0 }])}
            className="flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
          >
            <Plus className="h-3 w-3" />
            Ajouter un associé
          </button>
        </div>
        <div className="overflow-x-auto p-[18px]">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-1.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Associé</th>
                <th className="py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Valeur des parts (DT)</th>
                <th className="py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">%</th>
                <th className="py-1.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">Parts</th>
                <th className="w-8 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {associes.map((a, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 pr-2">
                    <Input
                      value={a.nom}
                      onChange={(e) => {
                        const next = [...associes];
                        next[i] = { ...next[i], nom: e.target.value };
                        setAssocies(next);
                      }}
                      onBlur={commit}
                      className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-1"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      value={a.valeurParts || ""}
                      onChange={(e) => {
                        const next = [...associes];
                        next[i] = { ...next[i], valeurParts: Number(e.target.value) || 0 };
                        setAssocies(next);
                      }}
                      onBlur={commit}
                      className="h-7 border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
                    />
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {totalValeur > 0 ? fmt((a.valeurParts / totalValeur) * 100) + " %" : "—"}
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      value={a.parts || ""}
                      onChange={(e) => {
                        const next = [...associes];
                        next[i] = { ...next[i], parts: Number(e.target.value) || 0 };
                        setAssocies(next);
                      }}
                      onBlur={commit}
                      className="h-7 border-0 bg-transparent text-right shadow-none focus-visible:ring-1"
                    />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      onClick={() => {
                        const next = associes.filter((_, j) => j !== i);
                        setAssocies(next);
                        onSave({
                          formeJuridique,
                          statutFiscal,
                          dateCreation: dateCreation || null,
                          capitalInitial: Number(capitalInitial) || 0,
                          partsInitiales: Number(partsInitiales) || 0,
                          valeurNominale: Number(valeurNominale) || 0,
                          objetSocial,
                          associes: next,
                        });
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {associes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2 text-sm text-muted-foreground">
                    Aucun associé
                  </td>
                </tr>
              )}
              {associes.length > 0 && (
                <tr className="border-t-2 border-foreground font-bold text-foreground">
                  <td className="py-1.5">TOTAL</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(totalValeur)}</td>
                  <td className="py-1.5 text-right tabular-nums">100 %</td>
                  <td className="py-1.5 text-right tabular-nums">{totalParts}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </LedgerSheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
