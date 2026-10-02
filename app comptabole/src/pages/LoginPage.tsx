import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";

/** Champ « carte » : l'étiquette est dans le cadre, au-dessus de la saisie. */
function LedgerField({
  label,
  htmlFor,
  trailing,
  children,
}: {
  label: string;
  htmlFor: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative rounded-md border border-accent/35 bg-secondary/60 px-4 pb-2.5 pt-3 transition-colors focus-within:border-primary focus-within:bg-card">
      {/* Équerres dorées : n'apparaissent qu'à la saisie */}
      {["-left-2 -top-2 border-l-2 border-t-2", "-right-2 -top-2 border-r-2 border-t-2", "-bottom-2 -left-2 border-b-2 border-l-2", "-bottom-2 -right-2 border-b-2 border-r-2"].map((pos) => (
        <span
          key={pos}
          className={`pointer-events-none absolute size-3 border-accent opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 ${pos}`}
          aria-hidden="true"
        />
      ))}
      <label htmlFor={htmlFor} className="flex items-center gap-2.5 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-primary/80">
        <span className="size-1.5 rotate-45 bg-accent" aria-hidden="true" />
        {label}
      </label>
      {children}
      {trailing}
    </div>
  );
}

export function LoginPage() {
  const status = useAuth((s) => s.status);
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "authed") return <Navigate to={from} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await login(identifiant, motDePasse);
    setBusy(false);
    if (res.ok) navigate(from, { replace: true });
    else setError(res.error ?? "Identifiant ou mot de passe incorrect.");
  }

  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
      {/* Panneau de marque — identité CAMCONSULT, masqué sur mobile */}
      <section className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          aria-hidden="true"
        >
          <div className="absolute -left-24 top-28 size-[420px] rounded-full border border-accent/35" />
          <div className="absolute -right-32 -bottom-20 size-[420px] rotate-45 border border-accent/25" />
        </div>
        <div className="relative z-10 inline-flex w-fit items-center">
          <img
            src="/brand/logo-cabinet-white.png"
            alt="Cabinet Ayadi Mohamed — Accounting & Consulting"
            width={1500}
            height={382}
            className="h-14 w-auto xl:h-16"
          />
        </div>
        <div className="relative z-10 max-w-lg">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.3em] text-accent">
            Cabinet comptable · Portail interne
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-[1.08] xl:text-6xl">
            Votre cabinet,{" "}
            <span className="text-accent">en un coup d'œil.</span>
          </h1>
          <p className="mt-8 max-w-lg text-base leading-8 text-primary-foreground/90">
            Sociétés, collecte de pièces, états financiers et bordereaux —
            tout l'outillage du cabinet dans un espace dédié.
          </p>
        </div>
        <p className="relative z-10 text-sm text-primary-foreground/50">
          © {new Date().getFullYear()} Cabinet AYEDI Mohamed
        </p>
      </section>

      {/* Panneau de connexion */}
      <section className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <div className="absolute -right-40 top-[58%] size-[520px] rounded-full border border-accent/20" />
          <div className="absolute -left-48 top-[62%] size-[420px] rounded-full border border-accent/15" />
        </div>
        <div className="relative w-full max-w-sm lg:max-w-md">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <img
              src="/brand/logo-cabinet-navy.png"
              alt="Cabinet Ayadi Mohamed — Accounting & Consulting"
              width={1500}
              height={382}
              className="mb-4 h-12 w-auto"
            />
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Cabinet Comptable
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Espace de gestion — accès responsable
            </p>
          </div>

          <div className="rounded-3xl border border-accent/30 bg-card p-6 shadow-pop sm:p-10">
            <div className="mb-8 hidden items-center gap-4 text-xs font-bold uppercase tracking-[0.22em] text-primary lg:flex">
              <span className="grid size-11 place-items-center rounded-full bg-primary text-accent ring-4 ring-accent/15">
                <ShieldCheck className="h-4 w-4" />
              </span>
              Accès sécurisé
            </div>
            <h2 className="hidden font-serif text-5xl leading-tight text-primary lg:block">
              Connexion
            </h2>
            <p className="mt-4 hidden max-w-xs font-serif text-lg italic leading-8 text-muted-foreground lg:block">
              Connectez-vous pour accéder à votre espace de gestion.
            </p>
            <div className="mt-6 hidden h-px w-4/5 bg-border lg:block" aria-hidden="true" />

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 lg:mt-8">
              <LedgerField label="Identifiant" htmlFor="identifiant">
                <input
                  id="identifiant"
                  autoFocus
                  autoComplete="username"
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  placeholder="mohamed.ayedi"
                  className="mt-1.5 block w-full bg-transparent text-lg text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </LedgerField>

              <LedgerField
                label="Mot de passe"
                htmlFor="motdepasse"
                trailing={
                  <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={visible ? "Masquer" : "Afficher"}
                  >
                    {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
              >
                <input
                  id="motdepasse"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 block w-full bg-transparent pr-10 text-lg text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </LedgerField>

              {error && (
                <p className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <Lock className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="ledger"
                className="h-14 w-full text-sm uppercase tracking-[0.2em]"
                disabled={busy}
              >
                {busy ? "Connexion…" : "Se connecter"}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground lg:hidden">
            <ShieldCheck className="h-3.5 w-3.5" />
            Accès réservé au responsable du cabinet
          </p>
        </div>
      </section>
    </div>
  );
}
