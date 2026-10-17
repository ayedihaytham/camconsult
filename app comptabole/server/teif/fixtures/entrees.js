// Entrées SYNTHÉTIQUES (aucune donnée réelle) partagées par les tests TEIF.
export const entreesSimples = () => ({
  facture: {
    numero: "2026-0001",
    statut: "emise",
    dateEmission: "2026-10-17",
    echeance: "2026-11-16",
    tvaTaux: 19,
    timbre: 1,
    note: "Honoraires & frais <octobre>",
    lignes: [
      { description: "Honoraires de tenue comptable - octobre 2026", quantite: 1, montantHt: 500 },
      { description: "Déclaration fiscale mensuelle", quantite: 2, montantHt: 100 },
    ],
  },
  cabinet: {
    nom: "CABINET EXEMPLE",
    matriculeFiscal: "1234567ABM000",
    adresse: "1 Rue Exemple, Tunis",
    rue: "Rue Exemple",
    ville: "Tunis",
    codePostal: "1000",
    pays: "TN",
    rc: "B0000000000",
    rib: "00 000 0000000000000 00",
  },
  client: {
    nom: "CLIENT EXEMPLE SARL",
    matriculeFiscal: "7654321KAM000",
    adresse: "2 Avenue Exemple",
    rue: "Avenue Exemple",
    ville: "Sfax",
    codePostal: "3000",
    pays: "TN",
  },
});
