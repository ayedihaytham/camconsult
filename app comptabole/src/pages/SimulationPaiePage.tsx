import { useMemo, useState } from "react";
import { Banknote, Info } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { baremeApplicable } from "@/lib/paie/baremes";
import { calculerSimulation, etapesCalcul, type EntreeSimulation } from "@/lib/paie/calcul";
import { salaireDepuisNet } from "@/lib/paie/inverse";
import { enDinars, versMillimes } from "@/lib/paie/saisie";
import { cn } from "@/lib/utils";

type Sens = "brut-net" | "net-brut";

const SENS: { value: Sens; titre: string; detail: string }[] = [
  { value: "brut-net", titre: "Du brut au net", detail: "Je connais le salaire de base" },
  { value: "net-brut", titre: "Du net au brut", detail: "Je connais le net à payer souhaité" },
];

const moisCourant = () => new Date().toISOString().slice(0, 7);

function Champ({ id, label, aide, children }: { id: string; label: string; aide?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-semibold text-foreground">
        {label}
      </label>
      {children}
      {aide ? <p className="text-[11px] text-muted-foreground">{aide}</p> : null}
    </div>
  );
}

export function SimulationPaiePage() {
  const [sens, setSens] = useState<Sens>("brut-net");
  const [mois, setMois] = useState(moisCourant);
  const [base, setBase] = useState("1000");
  const [netVoulu, setNetVoulu] = useState("1500");
  const [transport, setTransport] = useState("77,847");
  const [primes, setPrimes] = useState("");
  const [panier, setPanier] = useState("");
  const [retenues, setRetenues] = useState("");
  const [enfants, setEnfants] = useState("0");
  const [chefFamille, setChefFamille] = useState(false);

  const bareme = baremeApplicable(mois);

  const autres: Omit<EntreeSimulation, "base"> = {
    transport: versMillimes(transport),
    primes: versMillimes(primes),
    panier: versMillimes(panier),
    retenues: versMillimes(retenues),
    enfants: Math.trunc(Number(enfants)) || 0,
    chefFamille,
  };

  const calcul = useMemo(() => {
    if (!bareme) return null;
    if (sens === "brut-net") {
      const entree = { ...autres, base: versMillimes(base) };
      return { entree, resultat: calculerSimulation(entree, bareme), ecart: 0, atteignable: true };
    }
    const inverse = salaireDepuisNet(versMillimes(netVoulu), autres, bareme);
    if (!inverse) return { entree: { ...autres, base: 0 }, resultat: null, ecart: 0, atteignable: false };
    return { entree: { ...autres, base: inverse.base }, resultat: inverse.resultat, ecart: inverse.ecart, atteignable: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bareme, sens, base, netVoulu, transport, primes, panier, retenues, enfants, chefFamille]);

  const resultat = calcul?.resultat ?? null;
  const etapes = useMemo(() => (bareme && calcul && resultat ? etapesCalcul(calcul.entree, bareme, resultat) : []), [bareme, calcul, resultat]);

  return (
    <div>
      <SignatureLedgerBanner
        icon={Banknote}
        eyebrow="Outils · Paie"
        title="Simulation de paie"
        description="Estime le net à payer à partir du salaire de base, ou retrouve le salaire de base à partir du net souhaité. Résultat indicatif, calculé dans votre navigateur."
        metrics={[
          { label: "Barème", value: bareme ? String(bareme.annee) : "—" },
          { label: "Brut", value: resultat ? enDinars(resultat.brut) : "—" },
          { label: "Net à payer", value: resultat ? enDinars(resultat.netAPayer) : "—", tone: "success" },
        ]}
      />

      <div role="group" aria-label="Sens de la simulation" className="mt-4 grid gap-3 sm:grid-cols-2">
        {SENS.map((s) => {
          const actif = sens === s.value;
          return (
            <button
              key={s.value}
              type="button"
              aria-label={s.titre}
              aria-pressed={actif}
              onClick={() => setSens(s.value)}
              className={cn(
                "rounded-xl border border-accent/30 bg-card px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                actif && "border-primary bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              <span className="block text-sm font-semibold">{s.titre}</span>
              <span className={cn("block text-xs", actif ? "text-primary-foreground/80" : "text-muted-foreground")}>{s.detail}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section aria-label="Saisie" className="space-y-3 rounded-xl border border-accent/30 bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ id="sp-mois" label="Mois de paie" aide={bareme ? `Barème ${bareme.annee} appliqué` : "Aucun barème avant 2022"}>
              <Input id="sp-mois" type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
            </Champ>
            {sens === "brut-net" ? (
              <Champ id="sp-base" label="Salaire de base (DT)">
                <Input id="sp-base" inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} />
              </Champ>
            ) : (
              <Champ id="sp-net" label="Net à payer souhaité (DT)">
                <Input id="sp-net" inputMode="decimal" value={netVoulu} onChange={(e) => setNetVoulu(e.target.value)} />
              </Champ>
            )}
            <Champ id="sp-transport" label="Prime de transport (DT)">
              <Input id="sp-transport" inputMode="decimal" value={transport} onChange={(e) => setTransport(e.target.value)} />
            </Champ>
            <Champ id="sp-primes" label="Autres primes imposables (DT)">
              <Input id="sp-primes" inputMode="decimal" value={primes} onChange={(e) => setPrimes(e.target.value)} />
            </Champ>
            <Champ id="sp-panier" label="Panier non imposable (DT)" aide="Soumis à la CNSS, exonéré d'impôt">
              <Input id="sp-panier" inputMode="decimal" value={panier} onChange={(e) => setPanier(e.target.value)} />
            </Champ>
            <Champ id="sp-retenues" label="Retenues sur le net (DT)" aide="Avance, prêt : après impôt">
              <Input id="sp-retenues" inputMode="decimal" value={retenues} onChange={(e) => setRetenues(e.target.value)} />
            </Champ>
            <Champ id="sp-enfants" label="Enfants à charge" aide={`${bareme?.enfantsMax ?? 4} pris en compte au plus`}>
              <Input id="sp-enfants" type="number" min={0} max={20} value={enfants} onChange={(e) => setEnfants(e.target.value)} />
            </Champ>
            <div className="flex items-center gap-2 self-end pb-2">
              <Checkbox id="sp-chef" checked={chefFamille} onCheckedChange={(v) => setChefFamille(v === true)} />
              <label htmlFor="sp-chef" className="text-xs font-semibold">
                Chef de famille
              </label>
            </div>
          </div>
        </section>

        <section aria-label="Résultat" className="space-y-3 rounded-xl border border-accent/30 bg-card p-4">
          {!bareme ? (
            <p role="alert" className="text-sm text-destructive">
              Aucun barème n'est disponible pour ce mois (les barèmes commencent en 2022).
            </p>
          ) : !calcul?.atteignable ? (
            <p role="alert" className="text-sm text-destructive">
              Ce net est impossible à atteindre avec ces éléments.
            </p>
          ) : resultat ? (
            <>
              {sens === "net-brut" ? (
                <p className="text-sm">
                  Salaire de base à prévoir : <strong className="tabular-nums">{enDinars(calcul.entree.base)} DT</strong>
                  {calcul.ecart !== 0 ? <span className="text-muted-foreground"> (écart de {enDinars(calcul.ecart)} DT sur le net demandé)</span> : null}
                </p>
              ) : null}
              <table className="w-full text-sm">
                <caption className="sr-only">Comment ce résultat est calculé</caption>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1 font-semibold">Étape</th>
                    <th className="py-1 text-right font-semibold">Montant (DT)</th>
                  </tr>
                </thead>
                <tbody>
                  {etapes.map((e) => (
                    <tr key={e.cle} className={cn("border-b last:border-0 align-top", (e.cle === "netAPayer" || e.cle === "brut") && "font-semibold")}>
                      <td className="py-1.5 pr-2">
                        {e.libelle}
                        <span className="block text-[11px] font-normal text-muted-foreground">{e.detail}</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{enDinars(e.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </section>
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Simulation indicative : le mois est calculé comme s'il durait toute l'année, sans cumul ni régularisation. Les charges patronales affichées se limitent à la CNSS ; la taxe accident du travail,
        la TFP et le FOPROLOS ne sont pas incluses. Autour du seuil d'exonération de la CSS, le net n'augmente pas toujours avec le salaire.
      </p>
    </div>
  );
}
