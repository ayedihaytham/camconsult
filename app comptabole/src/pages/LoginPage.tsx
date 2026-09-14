import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Eye, EyeOff, Lock, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/store/auth";

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
        <div className="relative z-10 inline-flex w-fit items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full border border-accent font-serif text-xl text-accent">
            C
          </span>
          <span className="text-sm font-semibold tracking-[0.28em]">
            CAMCONSULT
          </span>
        </div>
        <div className="relative z-10 max-w-lg">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.3em] text-accent">
            Cabinet comptable · Portail interne
          </p>
          <h1 className="font-serif text-4xl leading-[1.1] xl:text-5xl">
            Votre cabinet,{" "}
            <span className="text-accent">en un coup d'œil.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-primary-foreground/70">
            Sociétés, collecte de pièces, états financiers et bordereaux —
            tout l'outillage du cabinet dans un espace dédié.
          </p>
        </div>
        <p className="relative z-10 text-xs text-primary-foreground/40">
          © {new Date().getFullYear()} Cabinet AYEDI Mohamed
        </p>
      </section>

      {/* Panneau de connexion */}
      <section className="flex min-h-full flex-col items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-accent text-accent">
              <span className="font-serif text-xl">C</span>
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Cabinet Comptable
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Espace de gestion — accès responsable
            </p>
          </div>

          <div className="rounded-2xl border border-accent/50 bg-card p-6 shadow-pop sm:p-8">
            <div className="mb-6 hidden items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary lg:flex">
              <span className="grid size-8 place-items-center rounded-full bg-primary text-accent">
                <ShieldCheck className="h-4 w-4" />
              </span>
              Accès sécurisé
            </div>
            <h2 className="hidden font-serif text-3xl leading-tight text-primary lg:block">
              Connexion
            </h2>
            <p className="mt-2 hidden text-sm leading-6 text-muted-foreground lg:block">
              Connectez-vous pour accéder à votre espace de gestion.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 lg:mt-8">
              <div className="space-y-1.5">
                <Label htmlFor="identifiant">Identifiant</Label>
                <Input
                  id="identifiant"
                  autoFocus
                  autoComplete="username"
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  placeholder="mohamed.ayedi"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="motdepasse">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="motdepasse"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    className="pr-9"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={visible ? "Masquer" : "Afficher"}
                  >
                    {visible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <Lock className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="ledger"
                className="w-full"
                disabled={busy}
              >
                <LogIn className="h-4 w-4" />
                {busy ? "Connexion…" : "Se connecter"}
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
