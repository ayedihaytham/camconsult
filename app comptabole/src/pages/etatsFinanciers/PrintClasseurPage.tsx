import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { Calculator } from "lucide-react";
import { api } from "@/lib/api";
import { useSocieteById } from "@/store/data";
import {
  fmt,
  resultatNet,
  resultatComptableAvantImpot,
  ROWS_BILAN_ACTIF,
  ROWS_BILAN_PASSIF,
  ROWS_ETAT_RESULTAT,
} from "@/lib/etatsFinanciers/postes";
import { computeImmoVariation, MASSE_AMORT_LABELS, MASSE_LABELS } from "@/lib/etatsFinanciers/immobilisations";
import {
  computeBiensPourExercice,
  mergeImmoMouvements,
  type BienCalcul,
} from "@/lib/etatsFinanciers/immobilisationsRegistre";
import { computeFlux, type FluxResult } from "@/lib/etatsFinanciers/flux";
import { computeTdrf } from "@/lib/etatsFinanciers/tdrf";
import { substituteTokens } from "./PrincipesComptablesSection";
import { FinancialTable } from "./FinancialTable";
import { SigTable } from "./SigTable";
import { AffectatSyntheseTable } from "./AffectatSyntheseTable";
import { ControleTable } from "./ControleTable";
import type { PostesExercice } from "@/store/balances";
import type {
  DetailCompteLigne,
  FicheSociete,
  FinancementMouvement,
  GrilleAffectatCode,
  ImmoBien,
  ImmoCategorie,
  ImmoMouvement,
  NotesExercice,
  NotesModele,
  TdrfLigne,
  TdrfParametres,
} from "@/types";
import { cn } from "@/lib/utils";

const NA = "n/d";

interface ClasseurData {
  postesParExercice: PostesExercice[];
  immoMouvements: ImmoMouvement[];
  financementMouvements: FinancementMouvement[];
  tdrfLignes: TdrfLigne[];
  tdrfParametres: TdrfParametres[];
  modele: NotesModele;
  fiche: FicheSociete;
  detailComptes: DetailCompteLigne[];
  notesParExercice: NotesExercice[];
  grilleCodes: GrilleAffectatCode[];
  immoBiens: ImmoBien[];
  immoCategories: ImmoCategorie[];
}

type SectionKey =
  | "actif"
  | "passif"
  | "resultat"
  | "sig"
  | "synthese"
  | "immo"
  | "registre"
  | "flux"
  | "tdrf"
  | "controle"
  | "notes";

const SECTION_LABELS: Record<SectionKey, string> = {
  actif: "Bilan Actif",
  passif: "Bilan Passif",
  resultat: "Etat de résultat",
  sig: "Soldes intermédiaires de gestion",
  synthese: "Synthèse AFFECTAT",
  immo: "Tableau des variations des immobilisations",
  registre: "Registre des immobilisations",
  flux: "Etat de flux de trésorerie",
  tdrf: "Tableau de détermination du résultat fiscal",
  controle: "Contrôle des états financiers",
  notes: "Notes aux états financiers",
};

/**
 * Vue imprimable du classeur complet — page de garde + sommaire + tous les
 * tableaux déjà construits, chacun sur une nouvelle page (voir
 * `.print-section` dans index.css). Lecture seule par construction (aucun
 * input/bouton d'édition) : contrairement aux onglets interactifs de
 * BalancesListPage, cette page ne réutilise pas les composants éditables —
 * elle recalcule tout depuis les mêmes fonctions pures
 * (computeRows/computeSig/computeImmoVariation/computeFlux/computeTdrf) pour
 * un rendu propre à l'impression. "Imprimer" déclenche window.print() ;
 * "Enregistrer en PDF" est le choix de destination standard du navigateur
 * dans cette boîte de dialogue.
 */
export function PrintClasseurPage() {
  const { societeId = "", section } = useParams();
  const navigate = useNavigate();
  const societe = useSocieteById(societeId);
  const sectionKey: SectionKey | null =
    section && section in SECTION_LABELS ? (section as SectionKey) : null;

  const [data, setData] = useState<ClasseurData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [
          postesParExercice,
          immoMouvementsManuels,
          financementMouvements,
          tdrfLignes,
          tdrfParametres,
          modele,
          fiche,
          detailComptes,
          immoBiens,
          immoCategories,
          grille,
        ] = await Promise.all([
          api.get<PostesExercice[]>(`/balances/postes?societeId=${societeId}`),
          api.get<ImmoMouvement[]>(`/balances/immo-mouvements?societeId=${societeId}`),
          api.get<FinancementMouvement[]>(`/balances/financement-mouvements?societeId=${societeId}`),
          api.get<TdrfLigne[]>(`/balances/tdrf-lignes?societeId=${societeId}`),
          api.get<TdrfParametres[]>(`/balances/tdrf-parametres?societeId=${societeId}`),
          api.get<NotesModele>("/notes/modele"),
          api.get<FicheSociete>(`/notes/fiche-societe/${societeId}`),
          api.get<DetailCompteLigne[]>(`/notes/detail-comptes?societeId=${societeId}`),
          api.get<ImmoBien[]>(`/immobilisations/biens?societeId=${societeId}`),
          api.get<ImmoCategorie[]>("/immobilisations/categories"),
          api.get<{ codes: GrilleAffectatCode[] }>("/grille-affectat"),
        ]);
        const notesParExercice = await Promise.all(
          postesParExercice.map((e) =>
            api.get<NotesExercice>(
              `/notes/exercice?societeId=${societeId}&exercice=${encodeURIComponent(e.exercice)}`,
            ),
          ),
        );
        const immoMouvements = mergeImmoMouvements(
          societeId,
          postesParExercice,
          immoMouvementsManuels,
          immoBiens,
          immoCategories,
        );
        if (!cancelled) {
          setData({
            postesParExercice,
            immoMouvements,
            financementMouvements,
            tdrfLignes,
            tdrfParametres,
            modele,
            fiche,
            detailComptes,
            notesParExercice,
            grilleCodes: grille.codes,
            immoBiens,
            immoCategories,
          });
        }
      } catch {
        if (!cancelled) setError("Impossible de charger les données de ce classeur.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [societeId]);

  if (error) {
    return (
      <div className="mx-auto max-w-[900px]">
        <BackBar societeId={societeId} navigate={navigate} />
        <EmptyState icon={Calculator} title="Erreur" description={error} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-[900px]">
        <BackBar societeId={societeId} navigate={navigate} />
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (data.postesParExercice.length === 0) {
    return (
      <div className="mx-auto max-w-[900px]">
        <BackBar societeId={societeId} navigate={navigate} />
        <EmptyState
          icon={Calculator}
          title="Aucune donnée"
          description="Importez ou saisissez une balance pour au moins un exercice avant d'imprimer."
        />
      </div>
    );
  }

  const chrono = [...data.postesParExercice].sort((a, b) => b.exercice.localeCompare(a.exercice));
  const societeName = societe?.raisonSociale ?? "Société";

  if (sectionKey) {
    return (
      <div className="mx-auto max-w-[900px] bg-card text-foreground">
        <BackBar societeId={societeId} navigate={navigate} />
        <PrintSection titre={SECTION_LABELS[sectionKey]}>
          {renderSectionContent(sectionKey, data, societeName, chrono)}
        </PrintSection>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] bg-card text-foreground">
      <BackBar societeId={societeId} navigate={navigate} />

      <PageDeGarde societeName={societeName} societe={societe} exercices={chrono.map((e) => e.exercice)} />

      <Sommaire />

      {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
        <PrintSection key={key} titre={SECTION_LABELS[key]}>
          {renderSectionContent(key, data, societeName, chrono)}
        </PrintSection>
      ))}
    </div>
  );
}

function renderSectionContent(
  key: SectionKey,
  data: ClasseurData,
  societeName: string,
  chrono: PostesExercice[],
): ReactNode {
  switch (key) {
    case "actif":
      return <FinancialTable rows={ROWS_BILAN_ACTIF} exercices={data.postesParExercice} titre="Actif" />;
    case "passif":
      return (
        <FinancialTable
          rows={ROWS_BILAN_PASSIF}
          exercices={data.postesParExercice}
          extraByExercice={(ex) => {
            const p = data.postesParExercice.find((e) => e.exercice === ex);
            return { resultat_exercice: p ? resultatNet(p.postes) : 0 };
          }}
          titre="Capitaux propres et passifs"
        />
      );
    case "resultat":
      return <FinancialTable rows={ROWS_ETAT_RESULTAT} exercices={data.postesParExercice} titre="Etat de résultat" />;
    case "sig":
      return <SigTable exercices={data.postesParExercice} />;
    case "synthese":
      return <AffectatSyntheseTable exercices={data.postesParExercice} grilleCodes={data.grilleCodes} />;
    case "immo":
      return <ImmoPrint exercices={data.postesParExercice} immoMouvements={data.immoMouvements} />;
    case "registre":
      return (
        <RegistrePrint
          exercices={data.postesParExercice}
          biens={data.immoBiens}
          categories={data.immoCategories}
        />
      );
    case "flux":
      return (
        <FluxPrint
          exercices={data.postesParExercice}
          immoMouvements={data.immoMouvements}
          financementMouvements={data.financementMouvements}
        />
      );
    case "tdrf":
      return (
        <TdrfPrint exercices={data.postesParExercice} lignes={data.tdrfLignes} parametres={data.tdrfParametres} />
      );
    case "controle":
      return (
        <ControleTable
          exercices={data.postesParExercice}
          immoMouvements={data.immoMouvements}
          financementMouvements={data.financementMouvements}
          tdrfLignes={data.tdrfLignes}
          tdrfParametres={data.tdrfParametres}
        />
      );
    case "notes":
      return (
        <NotesPrint
          societeName={societeName}
          fiche={data.fiche}
          modele={data.modele}
          notesParExercice={data.notesParExercice}
          detailComptes={data.detailComptes}
          exercices={chrono}
        />
      );
  }
}

function BackBar({
  societeId,
  navigate,
}: {
  societeId: string;
  navigate: (path: string) => void;
}) {
  return (
    <div className="no-print sticky top-0 z-10 mb-4 flex items-center justify-between border-b border-border bg-card px-2 py-3">
      <button
        onClick={() => navigate(`/etats-financiers/${societeId}`)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>
      <Button variant="ledger" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Imprimer / Enregistrer en PDF
      </Button>
    </div>
  );
}

function PrintSection({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="print-section px-2 py-8">
      <h2 className="mb-4 border-b-2 border-foreground pb-2 text-lg font-bold text-foreground">{titre}</h2>
      {children}
    </section>
  );
}

function PageDeGarde({
  societeName,
  societe,
  exercices,
}: {
  societeName: string;
  societe: { rne?: string; tva?: string; adresse?: string } | null | undefined;
  exercices: string[];
}) {
  const dernier = exercices[0] ?? "";
  return (
    <section className="print-section flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
        Cabinet comptable
      </p>
      <h1 className="mb-3 text-3xl font-bold text-foreground">{societeName}</h1>
      {societe?.tva && <p className="mb-1 text-sm text-muted-foreground">Matricule fiscal : {societe.tva}</p>}
      {societe?.rne && <p className="mb-1 text-sm text-muted-foreground">RNE : {societe.rne}</p>}
      {societe?.adresse && <p className="mb-8 text-sm text-muted-foreground">{societe.adresse}</p>}
      <p className="mb-2 mt-8 text-xl font-bold uppercase tracking-wide text-foreground">États financiers</p>
      {dernier && (
        <p className="text-sm text-muted-foreground">
          Exercice clos le 31 décembre {dernier}
          {exercices.length > 1 && ` (comparatif ${exercices[exercices.length - 1]}–${dernier})`}
        </p>
      )}
      <p className="mt-8 text-xs text-muted-foreground">(Chiffres exprimés en dinars tunisiens)</p>
    </section>
  );
}

const SOMMAIRE_ITEMS = [
  "Bilan Actif",
  "Bilan Passif",
  "Etat de résultat",
  "Soldes intermédiaires de gestion",
  "Tableau des variations des immobilisations",
  "Etat de flux de trésorerie",
  "Tableau de détermination du résultat fiscal",
  "Notes aux états financiers",
];

function Sommaire() {
  return (
    <section className="print-section px-6 py-16">
      <h2 className="mb-6 text-xl font-bold uppercase tracking-wide text-foreground">Sommaire</h2>
      <ol className="space-y-2">
        {SOMMAIRE_ITEMS.map((label, i) => (
          <li key={label} className="flex items-baseline gap-3 text-sm text-foreground">
            <span className="text-muted-foreground">{i + 1}.</span>
            {label}
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Registre des immobilisations (lecture seule) ──
function RegistrePrint({
  exercices,
  biens,
  categories,
}: {
  exercices: PostesExercice[];
  biens: ImmoBien[];
  categories: ImmoCategorie[];
}) {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));
  return (
    <div className="space-y-8">
      {chrono.map((e) => {
        const calculs = computeBiensPourExercice(biens, categories, e.exercice);
        const parCategorie = new Map<string, BienCalcul[]>();
        for (const c of calculs) {
          const list = parCategorie.get(c.categorie.id) ?? [];
          list.push(c);
          parCategorie.set(c.categorie.id, list);
        }
        const categoriesUtilisees = categories.filter((c) => parCategorie.has(c.id));
        if (categoriesUtilisees.length === 0) return null;
        return (
          <div key={e.exercice}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Exercice {e.exercice}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border-b border-foreground py-1 text-left text-xs font-bold">Bien</th>
                  <th className="border-b border-foreground py-1 text-right text-xs font-bold">Brut ouv.</th>
                  <th className="border-b border-foreground py-1 text-right text-xs font-bold">Acquis.</th>
                  <th className="border-b border-foreground py-1 text-right text-xs font-bold">Cessions</th>
                  <th className="border-b border-foreground py-1 text-right text-xs font-bold">Brut clôt.</th>
                  <th className="border-b border-foreground py-1 text-right text-xs font-bold">Amort. ouv.</th>
                  <th className="border-b border-foreground py-1 text-right text-xs font-bold">Dotations</th>
                  <th className="border-b border-foreground py-1 text-right text-xs font-bold">Amort. clôt.</th>
                  <th className="border-b border-foreground py-1 text-right text-xs font-bold">VNC</th>
                </tr>
              </thead>
              <tbody>
                {categoriesUtilisees.map((cat) => {
                  const items = parCategorie.get(cat.id) ?? [];
                  const sub = items.reduce(
                    (a, c) => ({
                      brutOuverture: a.brutOuverture + c.brutOuverture,
                      acquisitions: a.acquisitions + c.acquisitions,
                      cessionsBrut: a.cessionsBrut + c.cessionsBrut,
                      brutCloture: a.brutCloture + c.brutCloture,
                      amortOuverture: a.amortOuverture + c.amortOuverture,
                      dotations: a.dotations + c.dotations,
                      amortCloture: a.amortCloture + c.amortCloture,
                      vcn: a.vcn + c.vcn,
                    }),
                    {
                      brutOuverture: 0,
                      acquisitions: 0,
                      cessionsBrut: 0,
                      brutCloture: 0,
                      amortOuverture: 0,
                      dotations: 0,
                      amortCloture: 0,
                      vcn: 0,
                    },
                  );
                  return (
                    <Fragment key={cat.id}>
                      <tr>
                        <td colSpan={9} className="bg-muted px-1 py-1 text-xs font-bold uppercase tracking-wide">
                          {cat.nom} ({cat.taux}%)
                        </td>
                      </tr>
                      {items.map((c) => (
                        <tr key={c.bien.id}>
                          <td className="py-1 text-muted-foreground">{c.bien.libelle}</td>
                          <td className="py-1 text-right tabular-nums">{fmt(c.brutOuverture)}</td>
                          <td className="py-1 text-right tabular-nums">{fmt(c.acquisitions)}</td>
                          <td className="py-1 text-right tabular-nums">{fmt(c.cessionsBrut)}</td>
                          <td className="py-1 text-right tabular-nums">{fmt(c.brutCloture)}</td>
                          <td className="py-1 text-right tabular-nums">{fmt(c.amortOuverture)}</td>
                          <td className="py-1 text-right tabular-nums">{fmt(c.dotations)}</td>
                          <td className="py-1 text-right tabular-nums">{fmt(c.amortCloture)}</td>
                          <td className="py-1 text-right font-semibold tabular-nums">{fmt(c.vcn)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border font-semibold">
                        <td className="py-1">Sous-total</td>
                        <td className="py-1 text-right tabular-nums">{fmt(sub.brutOuverture)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(sub.acquisitions)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(sub.cessionsBrut)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(sub.brutCloture)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(sub.amortOuverture)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(sub.dotations)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(sub.amortCloture)}</td>
                        <td className="py-1 text-right tabular-nums">{fmt(sub.vcn)}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ── TAB VAR Immob (lecture seule) ─────────────────
function ImmoPrint({
  exercices,
  immoMouvements,
}: {
  exercices: PostesExercice[];
  immoMouvements: ImmoMouvement[];
}) {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));
  return (
    <div className="space-y-6">
      {chrono.map((e) => {
        const prevExercice =
          chrono.filter((x) => x.exercice < e.exercice).sort((a, b) => b.exercice.localeCompare(a.exercice))[0] ?? null;
        const lignes = computeImmoVariation(e.exercice, e.postes, prevExercice ? prevExercice.postes : null, immoMouvements);
        return (
          <div key={e.exercice}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Exercice {e.exercice}</p>
            {lignes.map((l) => (
              <table key={l.masse} className="mb-3 w-full text-sm">
                <thead>
                  <tr>
                    <th className="w-[200px] border-b border-foreground py-1 text-left text-xs font-bold">
                      {MASSE_LABELS[l.masse]}
                    </th>
                    <th className="border-b border-foreground py-1 text-right text-xs font-bold">Ouverture</th>
                    <th className="border-b border-foreground py-1 text-right text-xs font-bold">Augmentation</th>
                    <th className="border-b border-foreground py-1 text-right text-xs font-bold">Diminution</th>
                    <th className="border-b border-foreground py-1 text-right text-xs font-bold">Clôture</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1 text-muted-foreground">Valeurs brutes</td>
                    <td className="py-1 text-right tabular-nums">{fmt(l.brutOuverture)}</td>
                    <td className="py-1 text-right tabular-nums">{fmt(l.acquisitions)}</td>
                    <td className="py-1 text-right tabular-nums">{fmt(l.cessions)}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">{fmt(l.brutCloture)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">{MASSE_AMORT_LABELS[l.masse]}</td>
                    <td className="py-1 text-right tabular-nums">{fmt(l.amortOuverture)}</td>
                    <td className="py-1 text-right tabular-nums">{fmt(l.dotations)}</td>
                    <td className="py-1 text-right tabular-nums">{fmt(l.reprises)}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">{fmt(l.amortCloture)}</td>
                  </tr>
                  <tr className="border-t border-foreground font-bold">
                    <td className="py-1">Valeur nette comptable</td>
                    <td className="py-1 text-right tabular-nums">{fmt(l.netOuverture)}</td>
                    <td />
                    <td />
                    <td className="py-1 text-right tabular-nums">{fmt(l.netCloture)}</td>
                  </tr>
                </tbody>
              </table>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Flux (lecture seule) ───────────────────────────
function FluxPrint({
  exercices,
  immoMouvements,
  financementMouvements,
}: {
  exercices: PostesExercice[];
  immoMouvements: ImmoMouvement[];
  financementMouvements: FinancementMouvement[];
}) {
  const flux = computeFlux(exercices, immoMouvements, financementMouvements);
  const v = (x: number | null) => (x === null ? NA : fmt(x));
  return (
    <div className="space-y-6">
      {flux.map((f: FluxResult) => (
        <table key={f.exercice} className="w-full text-sm">
          <thead>
            <tr>
              <th className="border-b-2 border-foreground py-1.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Exercice {f.exercice}
              </th>
              <th className="border-b-2 border-foreground py-1.5 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Montant
              </th>
            </tr>
          </thead>
          <tbody>
            <PrintRow label="Flux de trésorerie liés à l'exploitation" section />
            <PrintRow label="Résultat net de l'exercice" value={fmt(f.resultatNet)} />
            <PrintRow label="Ajustements pour :" />
            <PrintRow label="Dotations aux amortissements et aux provisions" value={fmt(f.dotationsNettes)} indent />
            <PrintRow label="Intérêts sur placements courus et non échus" value={fmt(f.interetsCourusNonEchus)} indent />
            <PrintRow label="Variation des :" />
            <PrintRow label="Clients et comptes rattachés" value={v(f.variationClients)} indent />
            <PrintRow label="Autres actifs" value={v(f.variationAutresActifs)} indent />
            <PrintRow label="Fournisseurs et autres dettes" value={v(f.variationFournisseursAutresDettes)} indent />
            <PrintRow label="Modifications comptables" value={v(f.variationModificationsComptables)} indent />
            <PrintRow label="Flux de trésorerie provenant des opérations d'exploitation" value={v(f.fluxExploitation)} bold />

            <PrintRow label="Flux de trésorerie liés à l'investissement" section />
            <PrintRow
              label="Acquisition / Cession d'immobilisations corporelles et incorporelles"
              value={fmt(f.acquisitionCessionImmoCorpIncorp)}
            />
            <PrintRow label="Acquisition / Cession d'immobilisations financières" value={fmt(f.acquisitionCessionImmoFin)} />
            <PrintRow label="Flux de trésorerie affectés à des activités d'investissement" value={fmt(f.fluxInvestissement)} bold />

            <PrintRow label="Flux de trésorerie liés aux activités de financement" section />
            <PrintRow label="Variation des placements" value={v(f.variationPlacements)} />
            <PrintRow label="Encaissement suite à une augmentation de capital" value={fmt(f.capitalNumeraire)} />
            <PrintRow label="Distribution de dividendes" value={fmt(f.dividendesDistribues)} />
            <PrintRow label="Emprunts contractés" value={fmt(f.empruntsContractes)} />
            <PrintRow label="Remboursements d'emprunts" value={fmt(f.empruntsRembourses)} />
            <PrintRow label="Flux de trésorerie affecté à des activités de financement" value={v(f.fluxFinancement)} bold />

            <PrintRow label="VARIATION DE TRÉSORERIE" value={v(f.variationTresorerie)} bold />
            <PrintRow label="Trésorerie au début de l'exercice" value={f.tresorerieOuverture === null ? NA : fmt(f.tresorerieOuverture)} />
            <PrintRow label="Trésorerie à la clôture de l'exercice" value={fmt(f.tresorerieCloture)} bold />
          </tbody>
        </table>
      ))}
    </div>
  );
}

function PrintRow({
  label,
  value,
  bold,
  indent,
  section,
}: {
  label: string;
  value?: string;
  bold?: boolean;
  indent?: boolean;
  section?: boolean;
}) {
  if (section) {
    return (
      <tr>
        <td colSpan={2} className="bg-muted px-1 py-1.5 text-xs font-bold uppercase tracking-wide">
          {label}
        </td>
      </tr>
    );
  }
  return (
    <tr className={cn(bold && "border-t border-border")}>
      <td className={cn("py-1", indent && "pl-6 text-muted-foreground", bold && "font-bold")}>{label}</td>
      <td className={cn("py-1 text-right tabular-nums", bold && "font-bold")}>{value ?? ""}</td>
    </tr>
  );
}

// ── TDRF (lecture seule) ───────────────────────────
function TdrfPrint({
  exercices,
  lignes,
  parametres,
}: {
  exercices: PostesExercice[];
  lignes: TdrfLigne[];
  parametres: TdrfParametres[];
}) {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));
  return (
    <div className="space-y-6">
      {chrono.map((e) => {
        const lignesExercice = lignes.filter((l) => l.exercice === e.exercice);
        const p = parametres.find((x) => x.exercice === e.exercice);
        const result = computeTdrf(resultatComptableAvantImpot(e.postes), lignesExercice, p);
        return (
          <table key={e.exercice} className="w-full text-sm">
            <thead>
              <tr>
                <th className="border-b-2 border-foreground py-1.5 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Exercice {e.exercice}
                </th>
                <th className="border-b-2 border-foreground py-1.5 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              <PrintRow label="Résultat comptable avant impôt" value={fmt(result.resultatComptable)} />
              <PrintRow label="Réintégrations" section />
              {lignesExercice
                .filter((l) => l.kind === "reintegration")
                .map((l) => <PrintRow key={l.id} label={l.libelle} value={fmt(l.montant)} indent />)}
              <PrintRow label="Total réintégrations" value={fmt(result.totalReintegrations)} bold />
              <PrintRow label="Déductions" section />
              {lignesExercice
                .filter((l) => l.kind === "deduction")
                .map((l) => <PrintRow key={l.id} label={l.libelle} value={fmt(l.montant)} indent />)}
              <PrintRow label="Total déductions" value={fmt(result.totalDeductions)} bold />
              <PrintRow label="RÉSULTAT FISCAL (résultat imposable)" value={fmt(result.resultatFiscal)} bold />
              <PrintRow label="Détermination de l'impôt" section />
              <PrintRow label="Chiffre d'affaires local" value={fmt(result.chiffreAffairesLocal)} indent />
              <PrintRow label="Chiffre d'affaires export" value={fmt(result.chiffreAffairesExport)} indent />
              <PrintRow
                label="Impôt sur les sociétés (résultat imposable × taux)"
                value={fmt(result.isCalcule)}
                indent
              />
              <PrintRow label="Minimum d'impôt" value={fmt(result.minimumImpot)} indent />
              <PrintRow label="IMPÔTS SUR LES SOCIÉTÉS" value={fmt(result.impotSocietes)} bold />
              <PrintRow
                label="Contribution sociale de solidarité"
                value={fmt(result.contributionSociale)}
                indent
              />
              <PrintRow
                label="Excédents et acomptes provisionnels imputables"
                value={fmt(result.excedentsAcomptes)}
                indent
              />
              <PrintRow label="IMPÔTS À PAYER / (REPORT)" value={fmt(result.impotsAPayer)} bold />
            </tbody>
          </table>
        );
      })}
    </div>
  );
}

// ── Notes (lecture seule) ──────────────────────────
const DETAIL_TITRES: { poste: string; titre: string }[] = [
  { poste: "actif.clients", titre: "5.4 Clients et comptes rattachés" },
  { poste: "actif.autres_courants", titre: "5.5 Autres actifs courants" },
  { poste: "actif.liquidites", titre: "5.6 Liquidités et équivalents de liquidités" },
  { poste: "passif.fournisseurs", titre: "6.2 Fournisseurs et comptes rattachés" },
  { poste: "passif.autres_passifs_courants", titre: "6.3 Autres passifs courants" },
  { poste: "passif.concours_bancaires", titre: "6.4 Concours bancaires et autres passifs financiers" },
  { poste: "cpc.charges_externes", titre: "7.1 Autres charges d'exploitation" },
];

function NotesPrint({
  societeName,
  fiche,
  modele,
  notesParExercice,
  detailComptes,
  exercices,
}: {
  societeName: string;
  fiche: FicheSociete;
  modele: NotesModele;
  notesParExercice: NotesExercice[];
  detailComptes: DetailCompteLigne[];
  exercices: PostesExercice[];
}) {
  return (
    <div className="space-y-6 text-sm">
      <div>
        <p className="mb-1 font-bold text-foreground">Présentation de la société</p>
        <table className="w-full">
          <tbody>
            <PrintRow label="Forme juridique" value={fiche.formeJuridique} />
            <PrintRow label="Statut fiscal" value={fiche.statutFiscal} />
            <PrintRow label="Date de création" value={fiche.dateCreation ?? ""} />
            <PrintRow label="Capital initial (DT)" value={fmt(fiche.capitalInitial)} />
            <PrintRow label="Nombre de parts initiales" value={String(fiche.partsInitiales)} />
            <PrintRow label="Valeur nominale d'une part (DT)" value={fmt(fiche.valeurNominale)} />
          </tbody>
        </table>
      </div>

      {fiche.objetSocial.length > 0 && (
        <div>
          <p className="mb-1 font-bold text-foreground">Objet social</p>
          {fiche.objetSocial.map((b, i) => (
            <p key={i} className="mb-1">
              <span className="font-semibold">{b.titre}</span> — {b.texte}
            </p>
          ))}
        </div>
      )}

      {fiche.associes.length > 0 && (
        <div>
          <p className="mb-1 font-bold text-foreground">Structure du capital social</p>
          <table className="w-full">
            <thead>
              <tr>
                <th className="border-b border-foreground py-1 text-left text-xs font-bold">Associé</th>
                <th className="border-b border-foreground py-1 text-right text-xs font-bold">Valeur des parts (DT)</th>
                <th className="border-b border-foreground py-1 text-right text-xs font-bold">Parts</th>
              </tr>
            </thead>
            <tbody>
              {fiche.associes.map((a, i) => (
                <tr key={i}>
                  <td className="py-1">{a.nom}</td>
                  <td className="py-1 text-right tabular-nums">{fmt(a.valeurParts)}</td>
                  <td className="py-1 text-right tabular-nums">{a.parts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {exercices.map((e) => {
        const n = notesParExercice.find((x) => x.exercice === e.exercice);
        const texte = n?.texteOverride || substituteTokens(modele.texte, societeName, e.exercice);
        return (
          <div key={e.exercice}>
            <p className="mb-1 font-bold text-foreground">
              Présentation des états financiers, normes et principes comptables — {e.exercice}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{texte}</p>
          </div>
        );
      })}

      {DETAIL_TITRES.map(({ poste, titre }) => {
        const filtered = detailComptes.filter((l) => l.poste === poste);
        const comptes = [...new Set(filtered.map((l) => l.compte))].sort();
        if (comptes.length === 0) return null;
        return (
          <div key={poste}>
            <p className="mb-1 font-bold text-foreground">{titre}</p>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="border-b border-foreground py-1 text-left text-xs font-bold">Compte</th>
                  {exercices.map((e) => (
                    <th key={e.exercice} className="border-b border-foreground py-1 text-right text-xs font-bold">
                      {e.exercice}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comptes.map((compte) => {
                  const libelle = filtered.find((l) => l.compte === compte && l.libelle)?.libelle || "";
                  return (
                    <tr key={compte}>
                      <td className="py-1">
                        <span className="font-mono text-xs text-muted-foreground">{compte}</span> {libelle}
                      </td>
                      {exercices.map((e) => (
                        <td key={e.exercice} className="py-1 text-right tabular-nums">
                          {fmt(filtered.find((l) => l.compte === compte && l.exercice === e.exercice)?.solde ?? 0)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {exercices.map((e) => {
        const n = notesParExercice.find((x) => x.exercice === e.exercice);
        if (!n || n.blocsLibres.length === 0) return null;
        return (
          <div key={e.exercice}>
            <p className="mb-1 font-bold text-foreground">Notes complémentaires — {e.exercice}</p>
            {n.blocsLibres.map((b, i) => (
              <p key={i} className="mb-1">
                <span className="font-semibold">{b.titre}</span> — {b.texte}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
