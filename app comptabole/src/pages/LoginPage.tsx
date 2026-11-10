import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, LogIn, Smartphone, TriangleAlert, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconField } from "@/components/auth/LoginField";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";

const delai = (s: number) => ({ "--login-delay": `${s}s` }) as React.CSSProperties;

const inputClass = "lx-input";

/** Initiales et prénom déduits de l'identifiant saisi (« mohamed.ayedi » → MA, Mohamed) ; vides tant que la saisie ne contient aucune lettre. */
function accueilDepuis(identifiant: string): { initiales: string; prenom: string } {
  const local = identifiant.trim().split("@")[0];
  const parts = local.split(/[^\p{L}]+/u).filter(Boolean);
  if (parts.length === 0) return { initiales: "", prenom: "" };
  const initiales = (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toLocaleUpperCase("fr-FR");
  const prenom = parts[0].charAt(0).toLocaleUpperCase("fr-FR") + parts[0].slice(1).toLocaleLowerCase("fr-FR");
  return { initiales, prenom: prenom.length > 16 ? `${prenom.slice(0, 15)}…` : prenom };
}

const COULOIRS = [
  { nom: "Chez le client", ton: "", dossiers: [["SARL Atlas · Octobre", "60%"], ["Dar Zitouna · T3", "30%"]] },
  { nom: "Transmis", ton: "", dossiers: [["Éts Karray · Octobre", "85%"]] },
  { nom: "À corriger", ton: "am", dossiers: [["Imprimerie Sfax · T3", "40%"]] },
  { nom: "Validées", ton: "ok", dossiers: [["Atelier Nour · T2", "100%"], ["Pharma Sud · T2", "100%"]] },
] as const;
const ETIQUETTES_DOSSIER = ["Chez le client", "Transmis", "À corriger", "Validé ✓"];

/** Aperçu illustratif du circuit de collecte (noms, chiffres et échéances fictifs) : le dossier « Votre accès » avance avec la saisie, le bureau se dévoile à mesure. */
function CircuitApercu({ prenom, initiales, etape, refuse, avancement }: { prenom: string; initiales: string; etape: 0 | 1; refuse: boolean; avancement: number }) {
  const couloirs = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const dossier = useRef<HTMLDivElement>(null);
  const actif = refuse ? 2 : etape;
  const palier = Math.min(4, Math.floor(avancement * 4 + 1e-6));

  // Place le dossier sous le titre du couloir actif (mesure d'affichage uniquement).
  useLayoutEffect(() => {
    const place = () => {
      const l = refs.current[actif];
      const d = dossier.current;
      const titre = l?.querySelector("h3") as HTMLElement | null;
      if (!l || !d || !titre || !couloirs.current?.clientWidth) return;
      d.style.width = `${l.offsetWidth - 14}px`;
      d.style.transform = `translate(${l.offsetLeft + 7}px, ${titre.offsetTop + titre.offsetHeight + 8}px)`;
    };
    place();
    const obs = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (couloirs.current) obs?.observe(couloirs.current);
    return () => obs?.disconnect();
  }, [actif]);

  return (
    <>
      <div ref={couloirs} className={cn("lx-lanes", palier >= 1 && "lit")} aria-hidden="true">
        {COULOIRS.map((c, i) => (
          <div key={c.nom} ref={(el) => (refs.current[i] = el)} className={cn("lx-ln", c.ton, actif === i && "hl")}>
            <h3>
              {c.nom}
              <b>{c.dossiers.length + (i === 0 ? 1 : 0)}</b>
            </h3>
            {c.dossiers.map(([nom, w]) => (
              <div key={nom} className="lx-gc">
                <span>{nom}</span>
                <i style={{ "--w": w } as React.CSSProperties} />
              </div>
            ))}
          </div>
        ))}
        <div ref={dossier} className={cn("lx-tk", actif === 2 && "er")}>
          <div className="lx-who">
            <i data-ini={initiales || "CA"} />
            <span>{prenom || "Votre accès"}</span>
          </div>
          <div className="lx-bar" style={{ "--o": avancement.toFixed(3) } as React.CSSProperties} />
          <small>{ETIQUETTES_DOSSIER[actif]}</small>
        </div>
      </div>

      <div className="lx-cl3" aria-hidden="true">
        <div className={cn("lx-cd lx-c1", palier >= 2 && "lit")}>
          <h4>Échéances du mois</h4>
          <ul>
            <li><b>28</b><span>Déclaration de TVA<em>12 sociétés</em></span></li>
            <li><b>30</b><span>Clôture des collectes<em>8 sociétés</em></span></li>
            <li><b>05</b><span>Rapprochement bancaire<em>5 sociétés</em></span></li>
          </ul>
        </div>
        <div className={cn("lx-cd lx-c3", palier >= 3 && "lit")}>
          <h4>Banque</h4>
          <svg className="lx-ring" viewBox="0 0 64 64">
            <circle className="t" cx="32" cy="32" r="26" />
            <circle className="v" cx="32" cy="32" r="26" />
          </svg>
          <div>
            <strong>86 %</strong>
            <span>Rapprochement</span>
          </div>
        </div>
        <div className={cn("lx-cd lx-c4", palier >= 4 && "lit")}>
          <h4>Messagerie</h4>
          <div className="lx-mg"><i>AT</i><span>Relevés d'octobre transmis</span></div>
          <div className="lx-mg"><i>EK</i><span>Facture 2026-114 à valider</span></div>
        </div>
      </div>
    </>
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
  /** Aperçu du circuit (présentation seulement) : un accès refusé renvoie brièvement le dossier fictif dans « À corriger ». */
  const [refuse, setRefuse] = useState(false);
  useEffect(() => {
    if (!error) return;
    setRefuse(true);
    const t = setTimeout(() => setRefuse(false), 1700);
    return () => clearTimeout(t);
  }, [error]);

  if (status === "authed") return <Navigate to={from} replace />;

  const { initiales, prenom } = accueilDepuis(identifiant);
  /** Avancement de l'identification (0 à 1) : fait se dévoiler l'aperçu à mesure de la saisie. */
  const avancement = ticket
    ? 0.6 + Math.min(code.trim().length / 6, 1) * 0.38
    : Math.min(identifiant.trim().length / 8, 1) * 0.3 + Math.min(motDePasse.length / 10, 1) * 0.3;

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

  const boutonClass = "lx-go";

  return (
    <div className="lx lx-page">
      <div className="lx-hero">
        <div className="lx-tp">
          <img src="/brand/logo-cabinet-white.png" alt="Cabinet Ayadi Mohamed — Accounting & Consulting" width={1500} height={382} />
          <span className="lx-pill">Circuit de collecte</span>
        </div>
        <div>
          <h2 className="lx-h1">
            {prenom ? (
              <>
                Bon retour, <em>{prenom}.</em>
              </>
            ) : (
              <>
                Votre cabinet, <em>en un coup d'œil.</em>
              </>
            )}
          </h2>
          <p className="lx-sub">Chaque dossier suit son circuit. Votre accès aussi : votre bureau se dévoile à mesure que vous vous identifiez.</p>
        </div>
        <CircuitApercu prenom={prenom} initiales={initiales} etape={ticket ? 1 : 0} refuse={refuse} avancement={avancement} />
        <p className="lx-fn">Aperçu illustratif : noms, chiffres et échéances sont fictifs, aucune donnée réelle n'est affichée avant la connexion.</p>
      </div>

      <main className="lx-fp">
        <div className="lx-pn login-rise" style={delai(0.15)}>
          <div className="lx-hd">
            <span className="lx-av">
              {initiales ? (
                <span key={initiales} className="login-pop" aria-hidden="true">
                  {initiales}
                </span>
              ) : (
                <LogIn className="login-slide" aria-hidden="true" />
              )}
            </span>
            <p className="lx-eb">{ticket ? "Vérification en deux étapes" : prenom ? "Ravi de vous revoir" : "Accès sécurisé"}</p>
            <h1>{prenom ? `Bon retour, ${prenom}` : "Connexion"}</h1>
            <p>{ticket ? "Un dernier contrôle pour protéger les dossiers de votre cabinet." : "Connectez-vous pour accéder à votre espace de gestion."}</p>
          </div>

          {ticket && (
            <form onSubmit={handleCode} className="lx-form" aria-label="Vérification en deux étapes">
              <p className="lx-note">
                <Smartphone aria-hidden="true" />
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
                  className={cn(inputClass, "lx-input-code")}
                />
              </IconField>
              {error && (
                <p role="alert" className="lx-err">
                  <Lock aria-hidden="true" />
                  {error}
                </p>
              )}
              <Button type="submit" className={boutonClass} disabled={busy || code.trim() === ""}>
                {busy ? <span className="lx-spin" aria-hidden="true" /> : null}
                {busy ? "Vérification…" : "Vérifier"}
                {!busy && <LogIn aria-hidden="true" />}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setTicket(null);
                  setCode("");
                  setError(null);
                }}
                className="lx-back"
              >
                <ArrowLeft aria-hidden="true" /> Revenir au mot de passe
              </button>
            </form>
          )}

          <form onSubmit={handleSubmit} className={cn("lx-form", ticket && "hidden")}>
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
                <button type="button" onClick={() => setVisible((v) => !v)} className="lx-eye" aria-label={visible ? "Masquer" : "Afficher"}>
                  {visible ? <EyeOff /> : <Eye />}
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
              <p role="status" className="lx-caps">
                <TriangleAlert aria-hidden="true" />
                Verrouillage majuscules activé
              </p>
            )}

            {error && (
              <p className="lx-err">
                <Lock aria-hidden="true" />
                {error}
              </p>
            )}

            <Button type="submit" className={boutonClass} disabled={busy}>
              {busy ? <span className="lx-spin" aria-hidden="true" /> : null}
              {busy ? "Connexion…" : "Se connecter"}
              {!busy && <LogIn aria-hidden="true" />}
            </Button>
          </form>
          <p className="lx-copy">© {new Date().getFullYear()} Cabinet AYEDI Mohamed</p>
        </div>
      </main>
    </div>
  );
}
