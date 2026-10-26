import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Lock, LogIn, Smartphone, TriangleAlert, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";

const delai = (s: number) => ({ "--login-delay": `${s}s` }) as React.CSSProperties;

/** Champ de saisie du reçu : l'étiquette est au-dessus, l'icône à gauche, une ligne en pointillés dessous qui passe à l'or au focus. */
function IconField({
  label,
  htmlFor,
  icon: Icon,
  trailing,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: typeof User;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="text-left">
      <label htmlFor={htmlFor} className="block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary">
        {label}
      </label>
      <div className="group flex items-center gap-2.5 border-b-2 border-dashed border-primary/30 transition-colors focus-within:border-accent">
        <Icon className="h-[18px] w-[18px] shrink-0 text-primary/50 transition-colors group-focus-within:text-primary" aria-hidden="true" />
        {children}
        {trailing}
      </div>
    </div>
  );
}

const inputClass = "h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60";

/** Initiales et prénom déduits de l'identifiant saisi (« mohamed.ayedi » → MA, Mohamed) ; vides tant que la saisie ne contient aucune lettre. */
function accueilDepuis(identifiant: string): { initiales: string; prenom: string } {
  const local = identifiant.trim().split("@")[0];
  const parts = local.split(/[^\p{L}]+/u).filter(Boolean);
  if (parts.length === 0) return { initiales: "", prenom: "" };
  const initiales = (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toLocaleUpperCase("fr-FR");
  const prenom = parts[0].charAt(0).toLocaleUpperCase("fr-FR") + parts[0].slice(1).toLocaleLowerCase("fr-FR");
  return { initiales, prenom: prenom.length > 16 ? `${prenom.slice(0, 15)}…` : prenom };
}

/** Prochaine échéance mensuelle de déclaration (le 28), au format jj/mm. */
function prochaineDeclaration(maintenant: Date): string {
  const d = new Date(maintenant.getFullYear(), maintenant.getMonth() + (maintenant.getDate() > 28 ? 1 : 0), 28);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const BARRES = [40, 55, 48, 68, 62, 78, 72, 92];
const DOCUMENTS = [
  { libelle: "Relevés bancaires", fait: true },
  { libelle: "Factures d'achat", fait: true },
  { libelle: "Bulletins de paie", fait: false },
];

/** Aperçu illustratif du suivi d'un dossier : aucune donnée réelle, uniquement une démonstration animée. */
function ApercuDossier() {
  const largeur = 320;
  const hauteur = 112;
  const pas = largeur / BARRES.length;
  const sommets = BARRES.map((v, i) => [i * pas + pas / 2, hauteur - (v / 100) * (hauteur - 8)] as const);
  const ligne = sommets.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${(y - 6).toFixed(1)}`).join(" ");
  const [xf, yf] = sommets[sommets.length - 1];

  return (
    <aside
      className="login-rise hidden flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 lg:flex"
      style={delai(0.35)}
      aria-label="Aperçu illustratif du suivi d'un dossier"
    >
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <span className="relative grid size-10 place-items-center rounded-full bg-accent font-serif text-lg font-semibold text-primary" aria-hidden="true">
          A
          <span className="login-halo absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[hsl(var(--primary))] bg-emerald-400" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary-foreground/60">Votre expert</p>
          <p className="truncate text-sm font-semibold">Cabinet Ayadi Mohamed</p>
        </div>
      </div>
      <div>
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-accent">Votre cabinet, en un coup d'œil</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold leading-tight">Situation de votre dossier</h2>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-primary/60 p-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary-foreground/60">Activité mensuelle</p>
        <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="mt-3 h-28 w-full" role="img" aria-label="Graphique d'activité mensuelle, exemple">
          {BARRES.map((v, i) => {
            const h = (v / 100) * (hauteur - 8);
            const derniere = i === BARRES.length - 1;
            return (
              <rect
                key={i}
                x={i * pas + pas * 0.16}
                y={hauteur - h}
                width={pas * 0.68}
                height={h}
                rx={3}
                className={cn("login-bar", derniere ? "fill-accent" : "fill-white/20")}
                style={delai(0.7 + i * 0.07)}
              />
            );
          })}
          <path d={ligne} pathLength={1} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="login-trace" style={delai(1.3)} />
          <circle cx={xf} cy={yf - 6} r={4} className="login-halo fill-white/60" />
          <circle cx={xf} cy={yf - 6} r={4} className="fill-white" />
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-primary/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary-foreground/60">Échéance</p>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold tabular-nums text-primary">{prochaineDeclaration(new Date())}</span>
          </div>
          <p className="mt-3 font-serif text-lg font-semibold leading-tight">Déclaration de TVA</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="login-fill h-full w-[65%] rounded-full bg-accent" style={delai(1.1)} />
          </div>
          <p className="mt-2 text-xs text-primary-foreground/60">Préparation en cours</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-primary/60 p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary-foreground/60">Documents à fournir</p>
          <ul className="mt-3 space-y-2.5">
            {DOCUMENTS.map((d, i) => (
              <li key={d.libelle} className="login-tick flex items-center gap-2.5 text-sm" style={delai(1.3 + i * 0.25)}>
                <span
                  className={cn("grid size-5 shrink-0 place-items-center rounded-full", d.fait ? "bg-accent text-primary" : "border border-dashed border-white/40")}
                  aria-hidden="true"
                >
                  {d.fait && <Check className="size-3" strokeWidth={3} />}
                </span>
                {d.libelle}
              </li>
            ))}
          </ul>
        </div>
      </div>

    </aside>
  );
}

export function LoginPage() {
  const status = useAuth((s) => s.status);
  const login = useAuth((s) => s.login);
  const verifier2fa = useAuth((s) => s.verifier2fa);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Deuxième étape (double authentification) : le ticket prouve que le mot de passe est bon, le code ouvre la session. */
  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [majActive, setMajActive] = useState(false);

  if (status === "authed") return <Navigate to={from} replace />;

  const { initiales, prenom } = accueilDepuis(identifiant);
  const maintenant = new Date();
  const salutation = maintenant.getHours() < 5 || maintenant.getHours() >= 18 ? "Bonsoir" : "Bonjour";
  const dateDuJour = maintenant.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await login(identifiant, motDePasse);
    setBusy(false);
    if (res.ok) navigate(from, { replace: true });
    else if (res.etape === "2fa" && res.ticket) {
      setTicket(res.ticket);
      setCode("");
    } else setError(res.error ?? "Identifiant ou mot de passe incorrect.");
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    setError(null);
    setBusy(true);
    const res = await verifier2fa(ticket, code);
    setBusy(false);
    if (res.ok) navigate(from, { replace: true });
    else {
      setError(res.error ?? "Code incorrect.");
      // ticket expiré : il faut reprendre depuis le mot de passe
      if (res.error?.includes("expiré")) setTicket(null);
      setCode("");
    }
  }

  const boutonClass =
    "group relative h-12 w-full gap-3 overflow-hidden rounded-full bg-primary text-sm font-bold uppercase tracking-[0.2em] text-primary-foreground hover:bg-primary/90 active:translate-y-px";
  const barre = (
    <span className="absolute bottom-0 left-0 h-[3px] w-0 bg-accent transition-[width] duration-500 group-hover:w-full" aria-hidden="true" />
  );

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-primary text-primary-foreground lg:h-screen">
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
        <div className="absolute -left-40 top-[55%] size-[460px] rounded-full border border-accent/15" />
        <div className="absolute -right-44 -top-24 size-[480px] rounded-full border border-accent/10" />
      </div>

      <header className="login-rise relative z-10 px-6 py-5 sm:px-10 lg:px-14 lg:py-6" style={delai(0)}>
        <img
          src="/brand/logo-cabinet-white.png"
          alt="Cabinet Ayadi Mohamed — Accounting & Consulting"
          width={1500}
          height={382}
          className="h-9 w-auto lg:h-10"
        />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-4 pt-2">
        <div className="grid w-full max-w-md items-stretch gap-6 lg:max-w-[960px] lg:grid-cols-2">
          <section className="login-rise login-recu relative flex flex-col bg-card py-6 text-foreground" style={delai(0.15)}>
            <div className="flex flex-1 flex-col justify-center px-7 pb-2 pt-5 text-center sm:px-9">
              <span className="relative mx-auto grid size-14 place-items-center rounded-full bg-primary text-accent ring-[5px] ring-accent/20">
                {initiales ? (
                  <span key={initiales} className="login-pop font-serif text-xl font-semibold" aria-hidden="true">
                    {initiales}
                  </span>
                ) : (
                  <LogIn className="login-slide h-6 w-6" aria-hidden="true" />
                )}
                <span className="login-wave absolute -inset-1.5 rounded-full border border-accent opacity-0" aria-hidden="true" />
              </span>
              <p className="mt-4 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-accent">{prenom ? "Ravi de vous revoir" : "Accès sécurisé"}</p>
              <h1 className="mt-1 text-balance font-serif text-4xl leading-none text-primary">{prenom ? `Bon retour, ${prenom}` : "Connexion"}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Connectez-vous pour accéder à votre espace de gestion.</p>
              <p className="mb-4 mt-1 text-xs capitalize-first text-muted-foreground/80">
                {salutation} · {dateDuJour}
              </p>
              <div className="mb-5 border-t-2 border-dashed border-primary/20" aria-hidden="true" />

              {ticket && (
                <form onSubmit={handleCode} className="space-y-4" aria-label="Vérification en deux étapes">
                  <p className="flex items-start gap-2.5 text-left text-sm text-muted-foreground">
                    <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    Saisissez le code à 6 chiffres de votre application d'authentification, ou l'un de vos codes de secours.
                  </p>
                  <IconField label="Code de vérification" htmlFor="code2fa" icon={KeyRound}>
                    <input
                      id="code2fa"
                      autoFocus
                      inputMode="text"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123 456"
                      className={cn(inputClass, "text-xl tracking-[0.3em]")}
                    />
                  </IconField>
                  {error && (
                    <p role="alert" className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-left text-sm text-destructive">
                      <Lock className="h-4 w-4 shrink-0" />
                      {error}
                    </p>
                  )}
                  <Button type="submit" className={boutonClass} disabled={busy || code.trim() === ""}>
                    {barre}
                    {busy ? "Vérification…" : "Vérifier"}
                    {!busy && <LogIn className="h-[18px] w-[18px] text-accent" />}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setTicket(null);
                      setCode("");
                      setError(null);
                    }}
                    className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" /> Revenir au mot de passe
                  </button>
                </form>
              )}

              <form onSubmit={handleSubmit} className={cn("space-y-4", ticket && "hidden")}>
                <IconField label="Identifiant" htmlFor="identifiant" icon={User}>
                  <input
                    id="identifiant"
                    autoFocus
                    autoComplete="username"
                    value={identifiant}
                    onChange={(e) => setIdentifiant(e.target.value)}
                    placeholder="mohamed.ayedi"
                    className={inputClass}
                  />
                </IconField>

                <IconField
                  label="Mot de passe"
                  htmlFor="motdepasse"
                  icon={Lock}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setVisible((v) => !v)}
                      className="grid w-9 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
                      aria-label={visible ? "Masquer" : "Afficher"}
                    >
                      {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
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
                    className={inputClass}
                    onKeyDown={(e) => setMajActive(e.getModifierState("CapsLock"))}
                    onKeyUp={(e) => setMajActive(e.getModifierState("CapsLock"))}
                    onBlur={() => setMajActive(false)}
                  />
                </IconField>
                {majActive && (
                  <p role="status" className="-mt-2 flex items-center gap-1.5 text-left text-xs font-medium text-amber-700">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Verrouillage majuscules activé
                  </p>
                )}

                {error && (
                  <p className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-left text-sm text-destructive">
                    <Lock className="h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}

                <Button type="submit" className={boutonClass} disabled={busy}>
                  {barre}
                  {busy ? "Connexion…" : "Se connecter"}
                  {!busy && <LogIn className="h-[18px] w-[18px] text-accent" />}
                </Button>
              </form>
            </div>
          </section>

          <ApercuDossier />
        </div>
      </main>

      <footer className="login-rise relative z-10 px-6 py-4 text-xs text-primary-foreground/50 sm:px-10 lg:px-14" style={delai(0.3)}>
        © {new Date().getFullYear()} Cabinet AYEDI Mohamed
      </footer>
    </div>
  );
}
