import { createHash } from "node:crypto";
import { arrondi3, calculerTotaux } from "../../shared/factureTotaux.js";
import { normaliserMatriculeFiscal } from "../../shared/mf.js";
import { montantEnLettres } from "../../shared/montantEnLettres.js";
import { CODES, LONGUEURS, TEIF_AGENCE, TEIF_VERSION, UNITE_PAR_DEFAUT } from "./constantes.js";
import { aDesBloquants, controlerFactureTeif } from "./validerTeif.js";
import { DECLARATION_XML, feuille, noeud, serialiser } from "./xml.js";

/**
 * Message TEIF (facture, I-11) d'une facture d'honoraires du cabinet, SANS signature (l'étape de signature XAdES vient après).
 * Entrées et contrôles : voir validerTeif.js. Sortie déterministe : { xml, sha256, version, avertissements }.
 * Lève ErreurTeif (avec la liste des problèmes) si un contrôle bloquant échoue.
 */

export class ErreurTeif extends Error {
  constructor(problemes) {
    super("Facture non conforme au format TEIF");
    this.problemes = problemes;
  }
}

/** 3 décimales, point décimal (« 2.000 »), comme l'exemple TTN. */
const montant = (n) => arrondi3(Number(n)).toFixed(3);

/** AAAA-MM-JJ → ddMMyy (« 2026-10-17 » → « 171026 »). */
const ddMMyy = (iso) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(2, 4)}`;

/** Quantité : au moins une décimale (« 1.0 », « 2.5 »), 3 au plus, sans zéros inutiles. */
function quantite(q) {
  const n = Number(q);
  const t = n.toFixed(3).replace(/0+$/, "");
  return t.endsWith(".") ? `${t}0` : t;
}

/** Montant en lettres pour le message : majuscules sans accent (la spécification déconseille les caractères spéciaux). */
const enLettresMajuscules = (n) =>
  montantEnLettres(n)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .slice(0, LONGUEURS.montantEnLettres);

const sansEspaceSuperflu = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const moa = (code, valeur, description) =>
  noeud("Moa", [feuille("Amount", montant(valeur), { currencyIdentifier: "TND" }), description ? feuille("AmountDescription", description, { lang: "fr" }) : null], {
    amountTypeCode: code,
    currencyCodeList: "ISO_4217",
  });
const detailMontant = (nomConteneur, code, valeur, description) => noeud(nomConteneur, [moa(code, valeur, description)]);

function adressePartenaire(p) {
  const rue = sansEspaceSuperflu(p.rue);
  const adresse = sansEspaceSuperflu(p.adresse) || rue;
  return noeud(
    "PartnerAdresses",
    [
      feuille("AdressDescription", adresse),
      rue ? feuille("Street", rue) : null,
      feuille("CityName", sansEspaceSuperflu(p.ville)),
      feuille("PostalCode", sansEspaceSuperflu(p.codePostal)),
      feuille("Country", String(p.pays).trim().toUpperCase(), { codeList: "ISO_3166-1" }),
    ],
    { lang: "fr" },
  );
}

function partenaire(code, p, extra = []) {
  return noeud(
    "PartnerDetails",
    [
      noeud("Nad", [
        feuille("PartnerIdentifier", normaliserMatriculeFiscal(p.matriculeFiscal), { type: CODES.identifiantMf }),
        feuille("PartnerName", sansEspaceSuperflu(p.nom), { nameType: "Qualification" }),
        adressePartenaire(p),
      ]),
      ...extra,
    ],
    { functionCode: code },
  );
}

export function genererTeif({ facture, cabinet, client }) {
  const problemes = controlerFactureTeif({ facture, cabinet, client });
  if (aDesBloquants(problemes)) throw new ErreurTeif(problemes);

  const taux = Number(facture.tvaTaux);
  const timbre = Number(facture.timbre);
  const lignes = facture.lignes;
  const { totalHt, tva, netAPayer } = calculerTotaux(lignes, taux, timbre);
  const tauxTexte = String(taux);

  const rc = sansEspaceSuperflu(cabinet.rc);
  const rib = sansEspaceSuperflu(cabinet.rib);
  const note = sansEspaceSuperflu(facture.note);

  const lin = lignes.map((l, i) => {
    const totalLigne = arrondi3(Number(l.quantite) * Number(l.montantHt));
    return noeud("Lin", [
      feuille("ItemIdentifier", String(i + 1)),
      noeud("LinImd", [feuille("ItemCode", `L${i + 1}`), feuille("ItemDescription", sansEspaceSuperflu(l.description))], { lang: "fr" }),
      noeud("LinQty", [feuille("Quantity", quantite(l.quantite), { measurementUnit: UNITE_PAR_DEFAUT })]),
      noeud("LinTax", [feuille("TaxTypeName", "TVA", { code: CODES.tva }), noeud("TaxDetails", [feuille("TaxRate", tauxTexte)])]),
      noeud("LinMoa", [
        detailMontant("MoaDetails", CODES.montantUnitaireHt, l.montantHt),
        detailMontant("MoaDetails", CODES.montantLigneHt, totalLigne),
      ]),
    ]);
  });

  const taxes = [];
  if (timbre > 0)
    taxes.push(
      noeud("InvoiceTaxDetails", [
        noeud("Tax", [feuille("TaxTypeName", "droit de timbre", { code: CODES.timbre }), noeud("TaxDetails", [feuille("TaxRate", "0")])]),
        detailMontant("AmountDetails", CODES.montantTaxe, timbre),
      ]),
    );
  taxes.push(
    noeud("InvoiceTaxDetails", [
      noeud("Tax", [feuille("TaxTypeName", "TVA", { code: CODES.tva }), noeud("TaxDetails", [feuille("TaxRate", tauxTexte)])]),
      detailMontant("AmountDetails", CODES.baseTaxe, totalHt),
      detailMontant("AmountDetails", CODES.montantTaxe, tva),
    ]),
  );

  const racine = noeud(
    "TEIF",
    [
      noeud("InvoiceHeader", [
        feuille("MessageSenderIdentifier", normaliserMatriculeFiscal(cabinet.matriculeFiscal), { type: CODES.identifiantMf }),
        feuille("MessageRecieverIdentifier", normaliserMatriculeFiscal(client.matriculeFiscal), { type: CODES.identifiantMf }),
      ]),
      noeud("InvoiceBody", [
        noeud("Bgm", [feuille("DocumentIdentifier", facture.numero), feuille("DocumentType", "Facture", { code: CODES.facture })]),
        noeud("Dtm", [
          feuille("DateText", ddMMyy(facture.dateEmission), { format: "ddMMyy", functionCode: CODES.dateEmission }),
          facture.echeance ? feuille("DateText", ddMMyy(facture.echeance), { format: "ddMMyy", functionCode: CODES.dateEcheance }) : null,
        ]),
        noeud("PartnerSection", [
          partenaire(CODES.fournisseur, cabinet, rc ? [noeud("RffSection", [feuille("Reference", rc, { refID: CODES.referenceRc })])] : []),
          partenaire(CODES.client, client),
        ]),
        rib
          ? noeud("PytSection", [
              noeud("PytSectionDetails", [
                noeud("Pyt", [
                  feuille("PaymentTearmsTypeCode", CODES.conditionVirement),
                  feuille("PaymentTearmsDescription", `Paiement par virement bancaire au RIB ${rib}`.slice(0, LONGUEURS.conditionPaiement)),
                ]),
              ]),
            ])
          : null,
        note ? noeud("Ftx", [noeud("FreeTextDetail", [feuille("FreeTexts", note)], { subjectCode: CODES.observation })]) : null,
        noeud("LinSection", lin),
        noeud("InvoiceMoa", [
          detailMontant("AmountDetails", CODES.totalHt, totalHt),
          detailMontant("AmountDetails", CODES.baseTaxable, totalHt),
          detailMontant("AmountDetails", CODES.totalTaxes, tva),
          detailMontant("AmountDetails", CODES.totalTtc, netAPayer, enLettresMajuscules(netAPayer)),
        ]),
        noeud("InvoiceTax", taxes),
      ]),
    ],
    { controlingAgency: TEIF_AGENCE, version: TEIF_VERSION },
  );

  const xml = `${DECLARATION_XML}\n${serialiser(racine)}\n`;
  return {
    xml,
    sha256: createHash("sha256").update(xml, "utf8").digest("hex"),
    version: TEIF_VERSION,
    avertissements: problemes.filter((p) => p.niveau === "avertissement"),
  };
}
