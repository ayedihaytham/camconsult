// Vrai fichier PDF de la facture (modèle « Registre », même contenu que l'impression), téléchargé directement : texte vectoriel
// sélectionnable, sans fenêtre d'impression. jsPDF est chargé à la demande. Le QR de contrôle est dessiné en carrés vectoriels ;
// le QR officiel de TTN (PNG renvoyé par TTN) est inséré tel quel, jamais fabriqué ici.
import type { jsPDF as JsPDF } from "jspdf";
import qrcode from "qrcode-generator";
import type { Facture, FactureCabinet } from "@/types";
import { contenuQrControle, formatTnd, montantEnLettres } from "./facturation";

const MARINE: [number, number, number] = [23, 50, 92];
const OR: [number, number, number] = [200, 169, 106];
const TEXTE: [number, number, number] = [27, 42, 61];
const GRIS: [number, number, number] = [90, 102, 118];
const FILET: [number, number, number] = [223, 227, 232];
const CREME: [number, number, number] = [250, 247, 240];
const VERT: [number, number, number] = [31, 77, 46];

const MARGE = 38;

/** Les polices PDF standard n'ont ni l'espace fine insécable (séparateur de milliers fr-FR) ni les caractères hors Latin-1. */
export const propre = (s: unknown): string =>
  String(s ?? "")
    .replace(/[  ]/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\n -ÿ–—‘’“”•€]/g, "?");

const nombre = (n: number) => propre(formatTnd(n));
const quantite = (q: number) => propre(q.toLocaleString("fr-FR", { maximumFractionDigits: 3 }));
const jjmmaaaa = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const heureTunis = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });
const STADES_SIGNES = ["signee", "deposee", "validee", "rejetee"];

/**
 * Paramètres d'ouverture du visualiseur PDF du navigateur pour un aperçu : page entière visible (ajustée à la fenêtre), sans barre d'outils,
 * sans panneau de miniatures, sans ascenseur. Ils s'ajoutent à l'adresse du PDF (« #… ») ; un navigateur qui ne les connaît pas affiche son
 * visualiseur habituel.
 */
export const PARAMETRES_APERCU = "#toolbar=0&navpanes=0&scrollbar=0&view=Fit&zoom=page-fit";

/** Logo du cabinet : image de l'application (null si elle est introuvable : la facture reste valable sans logo). */
export async function chargerLogo(origine = ""): Promise<string | null> {
  try {
    const reponse = await fetch(`${origine}/brand/logo-cabinet-navy.png`);
    if (!reponse.ok) return null;
    const blob = await reponse.blob();
    return await new Promise<string | null>((resolve) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resolve(typeof lecteur.result === "string" ? lecteur.result : null);
      lecteur.onerror = () => resolve(null);
      lecteur.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface Options {
  /** Logo en data URL PNG (voir chargerLogo) ; sans logo, seul le nom du cabinet est imprimé. */
  logo?: string | null;
  /** Mot affiché en grand, en filigrane clair, sur chaque page (ex. « Aperçu ») : un aperçu ne doit jamais passer pour la vraie facture. */
  filigrane?: string;
}

/** Construit le PDF de la facture (sans le télécharger). */
export async function construireFacturePdf(f: Facture, cabinet: FactureCabinet | null, options: Options = {}): Promise<JsPDF> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const L = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const utile = L - 2 * MARGE;
  const c = cabinet ?? { nom: "", adresse: "", matriculeFiscal: "", telephone: "", email: "", rib: "", mentions: "" };
  const nomCabinet = propre((c.raisonSociale || c.nom || "").trim());
  const villeCabinet = [c.codePostal, c.ville].filter(Boolean).join(" ");
  const adresseCabinet = propre(c.adresse?.trim() || [c.rue, villeCabinet].filter(Boolean).join(", "));
  const taux = `${f.tvaTaux.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;

  const ecrire = (texte: string, x: number, y: number, o: { taille?: number; gras?: boolean; couleur?: [number, number, number]; align?: "left" | "right" | "center"; maxLargeur?: number; police?: "helvetica" | "times" } = {}) => {
    doc.setFont(o.police ?? "helvetica", o.gras ? "bold" : "normal");
    doc.setFontSize(o.taille ?? 9);
    doc.setTextColor(...(o.couleur ?? TEXTE));
    const lignes = o.maxLargeur ? (doc.splitTextToSize(propre(texte), o.maxLargeur) as string[]) : [propre(texte)];
    doc.text(lignes, x, y, { align: o.align ?? "left", lineHeightFactor: 1.25 });
    return lignes.length * (o.taille ?? 9) * 1.25;
  };
  const etiquette = (texte: string, x: number, y: number, aDroite = false) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS);
    const t = propre(texte).toUpperCase();
    doc.setCharSpace(0);
    const largeur = doc.getTextWidth(t) + 0.9 * t.length; // largeur avec l'espacement des lettres
    doc.setCharSpace(0.9);
    doc.text(t, aDroite ? x - largeur : x, y);
    doc.setCharSpace(0);
  };

  // ── En-tête : logo et coordonnées du cabinet à gauche, titre et références à droite ──
  let yGauche = MARGE;
  if (options.logo) {
    try {
      const p = doc.getImageProperties(options.logo);
      const h = 36;
      doc.addImage(options.logo, "PNG", MARGE, yGauche, (p.width / p.height) * h, h);
      yGauche += h + 6;
    } catch {
      // logo illisible : on continue sans
    }
  }
  if (nomCabinet) yGauche += ecrire(nomCabinet, MARGE, yGauche + 9, { taille: 11, gras: true, couleur: MARINE, police: "times" }) + 2;
  for (const ligne of [adresseCabinet, c.telephone && `Tél. : ${c.telephone}`, c.email].filter(Boolean) as string[])
    yGauche += ecrire(ligne, MARGE, yGauche + 8, { taille: 8.5, couleur: GRIS, maxLargeur: utile * 0.55 });

  ecrire("FACTURE", L - MARGE, MARGE + 20, { taille: 22, gras: true, couleur: MARINE, align: "right", police: "times" });
  let yDroite = MARGE + 38;
  const meta: [string, string][] = [["N°", f.numero], ["Date d'émission", jjmmaaaa(f.dateEmission)], ...(f.echeance ? [["Échéance", jjmmaaaa(f.echeance)] as [string, string]] : []), ["Devise", "TND"]];
  for (const [k, v] of meta) {
    ecrire(k, L - MARGE - 118, yDroite, { taille: 8.5, couleur: GRIS });
    ecrire(v, L - MARGE, yDroite, { taille: 8.5, gras: true, align: "right" });
    yDroite += 12;
  }
  let y = Math.max(yGauche, yDroite) + 6;
  doc.setDrawColor(...OR);
  doc.setLineWidth(1.5);
  doc.line(MARGE, y, L - MARGE, y);
  y += 14;

  // ── Émetteur et client côte à côte, avec leurs identifiants fiscaux ──
  const largeurBoite = (utile - 12) / 2;
  const champs = (liste: [string, string | undefined | null][]) => liste.filter(([, v]) => v && String(v).trim()) as [string, string][];
  const boite = (x: number, titre: string, nom: string, lignes: [string, string][], fond: boolean) => {
    const interieur = largeurBoite - 20;
    const valeurs = lignes.map(([, v]) => doc.setFontSize(8.5).splitTextToSize(propre(v), interieur - 48) as string[]);
    const hauteur = 12 + 10 + 16 + valeurs.reduce((s, v) => s + v.length * 10.6 + 1.5, 0) + 6;
    if (fond) {
      doc.setFillColor(...CREME);
      doc.setDrawColor(230, 220, 195);
    } else doc.setDrawColor(...FILET);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, largeurBoite, hauteur, 3, 3, fond ? "FD" : "S");
    etiquette(titre, x + 10, y + 14);
    ecrire(nom, x + 10, y + 28, { taille: 10, gras: true, maxLargeur: interieur });
    let yy = y + 42;
    lignes.forEach(([k], i) => {
      ecrire(k, x + 10, yy, { taille: 8.5, couleur: GRIS });
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...TEXTE);
      doc.text(valeurs[i], x + 58, yy, { lineHeightFactor: 1.25 });
      yy += valeurs[i].length * 10.6 + 1.5;
    });
    return hauteur;
  };
  const h1 = boite(MARGE, "Émetteur", nomCabinet || "Cabinet", champs([["MF", c.matriculeFiscal], ["RC", c.rc]]), false);
  const h2 = boite(MARGE + largeurBoite + 12, "Facturé à", f.societeNom, champs([["MF", f.clientTva], ["RNE / RC", f.clientRne], ["Adresse", f.clientAdresse]]), true);
  y += Math.max(h1, h2) + 14;

  // ── Lignes de la facture ──
  autoTable(doc, {
    startY: y,
    margin: { left: MARGE, right: MARGE, bottom: 120 },
    head: [["#", "Désignation", "Qté", "P.U. HT", "TVA", "Total HT"]],
    body: f.lignes.map((l, i) => [String(i + 1), propre(l.description), quantite(l.quantite), nombre(l.montantHt), propre(taux), nombre(l.quantite * l.montantHt)]),
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9, textColor: TEXTE, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 }, lineColor: FILET, lineWidth: { bottom: 0.6 } },
    headStyles: { fillColor: MARINE, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold", lineWidth: 0 },
    columnStyles: { 0: { cellWidth: 22, textColor: [138, 122, 82] }, 2: { halign: "right", cellWidth: 44 }, 3: { halign: "right", cellWidth: 70 }, 4: { halign: "right", cellWidth: 44 }, 5: { halign: "right", cellWidth: 76 } },
    didParseCell: (d) => {
      if (d.section === "head" && [2, 3, 4, 5].includes(d.column.index)) d.cell.styles.halign = "right";
    },
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 14;

  // ── Règlement et montant en lettres (gauche), totaux et récapitulatif de TVA (droite) ──
  const hBas = 190;
  if (y + hBas > H - MARGE - 70) {
    doc.addPage();
    y = MARGE;
  }
  const largeurDroite = 200;
  const largeurGauche = utile - largeurDroite - 18;
  let yg = y;
  if (c.rib || f.echeance) {
    const lignes: string[] = [];
    if (f.echeance) lignes.push(`Règlement avant le ${jjmmaaaa(f.echeance)}${c.rib ? " par virement :" : "."}`);
    if (c.rib) lignes.push(`RIB / IBAN ${c.rib}`);
    const hauteur = lignes.length * 12 + 10;
    doc.setFillColor(...CREME);
    doc.rect(MARGE, yg, largeurGauche, hauteur, "F");
    doc.setFillColor(...OR);
    doc.rect(MARGE, yg, 2.5, hauteur, "F");
    lignes.forEach((l, i) => ecrire(l, MARGE + 10, yg + 14 + i * 12, { taille: 9, gras: i === 0 }));
    yg += hauteur + 10;
  }
  etiquette("Arrêtée la présente facture à la somme de", MARGE, yg + 8);
  yg += 12 + ecrire(montantEnLettres(f.netAPayer), MARGE, yg + 22, { taille: 10, gras: true, maxLargeur: largeurGauche });
  if (f.note) yg += 8 + ecrire(f.note, MARGE, yg + 22, { taille: 8.5, couleur: GRIS, maxLargeur: largeurGauche });

  const xd = L - MARGE - largeurDroite;
  let yd = y;
  for (const [k, v] of [["Total HT", `${nombre(f.totalHt)} TND`], [`TVA (${taux})`, `${nombre(f.tva)} TND`], ["Droit de timbre", `${nombre(f.timbre)} TND`]] as [string, string][]) {
    ecrire(k, xd, yd + 10, { taille: 9, couleur: GRIS });
    ecrire(v, L - MARGE, yd + 10, { taille: 9, couleur: GRIS, align: "right" });
    yd += 15;
  }
  doc.setFillColor(...MARINE);
  doc.roundedRect(xd - 4, yd + 2, largeurDroite + 8, 26, 2, 2, "F");
  ecrire("Net à payer", xd + 6, yd + 19, { taille: 10.5, gras: true, couleur: [255, 255, 255] });
  ecrire(`${nombre(f.netAPayer)} TND`, L - MARGE - 6, yd + 19, { taille: 10.5, gras: true, couleur: [255, 255, 255], align: "right" });
  yd += 40;
  etiquette("Taux TVA", xd, yd);
  etiquette("Base HT", xd + 100, yd);
  etiquette("Montant TVA", L - MARGE, yd, true);
  doc.setDrawColor(...FILET).setLineWidth(0.6).line(xd, yd + 4, L - MARGE, yd + 4);
  ecrire(taux, xd, yd + 16, { taille: 8.5 });
  ecrire(nombre(f.totalHt), xd + 130, yd + 16, { taille: 8.5, align: "right" });
  ecrire(nombre(f.tva), L - MARGE, yd + 16, { taille: 8.5, align: "right" });
  y = Math.max(yg, yd + 24) + 12;

  // ── Facture électronique : QR officiel TTN (validée) ou QR de contrôle (signée), en bas de page ──
  const ei = f.einvoice;
  const piedY = H - MARGE - 52;
  const validee = ei?.statut === "validee" && Boolean(ei.refTtn);
  const signee = Boolean(ei && STADES_SIGNES.includes(ei.statut) && ei.shaSigne);
  if (ei && (validee || signee)) {
    const hBloc = 84;
    let yb = Math.max(y, piedY - hBloc - 10);
    if (yb + hBloc > H - MARGE - 60) {
      doc.addPage();
      yb = MARGE;
    }
    doc.setFillColor(244, 250, 245);
    doc.setDrawColor(207, 227, 212);
    doc.setLineWidth(0.8);
    doc.roundedRect(MARGE, yb, utile, hBloc, 3, 3, "FD");
    const tQr = 64;
    const xQr = MARGE + 10;
    const yQr = yb + 10;
    let dessine = false;
    if (validee && ei.qrPng && /^[A-Za-z0-9+/=]+$/.test(ei.qrPng)) {
      try {
        doc.addImage(`data:image/png;base64,${ei.qrPng}`, "PNG", xQr, yQr, tQr, tQr);
        dessine = true;
      } catch {
        dessine = false;
      }
    }
    if (!dessine && !validee) {
      try {
        const q = qrcode(0, "M");
        q.addData(contenuQrControle(f, c, ei.shaSigne as string));
        q.make();
        const n = q.getModuleCount();
        const pas = tQr / n;
        doc.setFillColor(255, 255, 255).rect(xQr, yQr, tQr, tQr, "F");
        doc.setFillColor(0, 0, 0);
        for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) doc.rect(xQr + k * pas, yQr + r * pas, pas + 0.15, pas + 0.15, "F");
      } catch {
        // contenu trop long pour un QR : le bloc reste lisible sans lui
      }
    }
    const xt = xQr + tQr + 14;
    const lt = utile - tQr - 44;
    let yt = yb + 20;
    if (validee) {
      yt += ecrire("Facture électronique validée par TTN (El Fatoora)", xt, yt, { taille: 9.5, gras: true, couleur: VERT, maxLargeur: lt });
      yt += ecrire(`Référence TTN : ${ei.refTtn}`, xt, yt, { taille: 8.5, maxLargeur: lt });
      if (ei.refTtnDate) yt += ecrire(`Validée le ${jjmmaaaa(ei.refTtnDate)} à ${heureTunis(ei.refTtnDate)}`, xt, yt, { taille: 8.5, maxLargeur: lt });
      if (ei.shaSigne) ecrire(`Empreinte SHA-256 du fichier signé : ${ei.shaSigne}`, xt, yt, { taille: 6.5, couleur: GRIS, maxLargeur: lt });
    } else {
      yt += ecrire("Facture électronique signée", xt, yt, { taille: 9.5, gras: true, couleur: VERT, maxLargeur: lt });
      yt += ecrire(`Signée${ei.signeLe ? ` le ${jjmmaaaa(ei.signeLe)}` : ""} avec le certificat du cabinet (format El Fatoora / TEIF).`, xt, yt, { taille: 8, maxLargeur: lt });
      yt += ecrire(`Empreinte SHA-256 du fichier signé : ${ei.shaSigne}`, xt, yt, { taille: 6.5, couleur: GRIS, maxLargeur: lt });
      ecrire("Le QR permet de contrôler l'intégrité du fichier ; le QR officiel de TTN n'est ajouté qu'après le dépôt de la facture.", xt, yt + 2, { taille: 7, couleur: GRIS, maxLargeur: lt });
    }
  }

  // ── Pied de page : mentions légales et cadre de cachet ──
  const pied = c.mentions?.trim() || [nomCabinet, c.rc && `RC ${c.rc}`, c.matriculeFiscal && `MF ${c.matriculeFiscal}`].filter(Boolean).join(" · ") || `Facture ${f.numero}`;
  doc.setDrawColor(...FILET).setLineWidth(0.6).line(MARGE, piedY + 4, MARGE + utile - 150, piedY + 4);
  ecrire(pied, MARGE, piedY + 16, { taille: 7.5, couleur: GRIS, maxLargeur: utile - 170 });
  doc.setDrawColor(196, 204, 214).setLineDashPattern([2, 2], 0).roundedRect(L - MARGE - 140, piedY - 6, 140, 52, 3, 3, "S").setLineDashPattern([], 0);
  etiquette("Cachet et signature", L - MARGE - 132, piedY + 6);

  if (options.filigrane) {
    const GState = (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
    const setGState = (doc as unknown as { setGState: (g: unknown) => void }).setGState.bind(doc);
    for (let page = 1; page <= doc.getNumberOfPages(); page++) {
      doc.setPage(page);
      setGState(new GState({ opacity: 0.08 }));
      doc.setFont("helvetica", "bold").setFontSize(92).setTextColor(...MARINE);
      doc.text(propre(options.filigrane).toUpperCase(), L / 2, H / 2, { align: "center", angle: 35 });
      setGState(new GState({ opacity: 1 }));
    }
  }

  doc.setProperties({ title: `Facture ${f.numero}`, subject: `Facture d'honoraires ${f.numero}`, author: nomCabinet || "Cabinet" });
  return doc;
}

/** Construit et télécharge `<numéro>.pdf`. */
export async function telechargerFacturePdf(f: Facture, cabinet: FactureCabinet | null): Promise<void> {
  const doc = await construireFacturePdf(f, cabinet, { logo: await chargerLogo(window.location.origin) });
  doc.save(`${f.numero.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`);
}
