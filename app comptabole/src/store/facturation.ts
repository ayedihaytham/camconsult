import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { download } from "@/lib/export";
import type { EinvoiceEtat, Facture, FactureCabinet, FactureJournalEntry, FactureStatut, SignatureEtat, TtnBilan, TtnEnvironnement, TtnEtat } from "@/types";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export interface FactureInput {
  societeId: string;
  dateEmission: string;
  echeance: string | null;
  tvaTaux: number;
  timbre: number;
  note: string;
  lignes: { description: string; quantite: number; montantHt: number }[];
}

interface FacturationState {
  list: Facture[];
  cabinet: FactureCabinet | null;
  loading: boolean;
  fetchList: () => Promise<void>;
  fetchCabinet: () => Promise<void>;
  saveCabinet: (data: Omit<FactureCabinet, "nom">) => Promise<void>;
  create: (data: FactureInput) => Promise<Facture>;
  /** Remplace l'en-tête et les lignes d'une facture émise (numéro conservé). */
  modifier: (id: string, data: FactureInput) => Promise<Facture>;
  update: (id: string, data: { statut?: FactureStatut; signee?: boolean }) => Promise<void>;
  /** Facture électronique (TEIF) : contrôle de conformité, préparation du XML non signé, téléchargement. */
  conformite: (id: string) => Promise<EinvoiceEtat>;
  preparer: (id: string, regenerer?: boolean) => Promise<EinvoiceEtat>;
  /** version : « signe » ou « non-signe » ; par défaut le message signé s'il existe. */
  telechargerXml: (id: string, numero: string, version?: "signe" | "non-signe" | "ttn") => Promise<void>;
  /** Accès au service TTN et dépôt des factures signées. */
  ttn: TtnEtat | null;
  fetchTtn: () => Promise<TtnEtat>;
  enregistrerTtn: (data: { url: string; login: string; motDePasse?: string; matricule?: string; environnement: TtnEnvironnement }) => Promise<void>;
  supprimerTtn: () => Promise<void>;
  testerTtn: () => Promise<string>;
  deposer: (id: string) => Promise<EinvoiceEtat>;
  actualiser: (id: string) => Promise<EinvoiceEtat>;
  actualiserTout: () => Promise<TtnBilan>;
  rouvrir: (id: string) => Promise<EinvoiceEtat>;
  /** Historique d'une facture (journal d'activité filtré sur elle), du plus récent au plus ancien. */
  journal: (id: string) => Promise<FactureJournalEntry[]>;
  /** Signature électronique : certificat du cabinet, déverrouillage par mot de passe, signature d'une facture. */
  signature: SignatureEtat | null;
  fetchSignature: () => Promise<SignatureEtat>;
  chargerCertificat: (fichier: File, motDePasse: string) => Promise<SignatureEtat>;
  supprimerCertificat: () => Promise<void>;
  deverrouiller: (motDePasse: string) => Promise<void>;
  verrouiller: () => Promise<void>;
  signer: (id: string) => Promise<EinvoiceEtat>;
}

/** Contenu binaire d'un fichier en base64 (sans préfixe data:). */
async function enBase64(fichier: File): Promise<string> {
  const octets = new Uint8Array(await fichier.arrayBuffer());
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

export const useFacturation = create<FacturationState>((set) => ({
  list: [],
  cabinet: null,
  loading: false,
  signature: null,
  ttn: null,

  fetchCabinet: async () => {
    try {
      set({ cabinet: await api.get<FactureCabinet>("/facturation/cabinet") });
    } catch (e) {
      fail(e);
    }
  },

  saveCabinet: async (data) => {
    try {
      set({ cabinet: await api.put<FactureCabinet>("/facturation/cabinet", data) });
    } catch (e) {
      fail(e);
    }
  },

  fetchList: async () => {
    set({ loading: true });
    try {
      const list = await api.get<Facture[]>("/facturation");
      set({ list, loading: false });
    } catch (e) {
      set({ loading: false });
      fail(e);
    }
  },

  create: async (data) => {
    try {
      const f = await api.post<Facture>("/facturation", data);
      set((st) => ({ list: [f, ...st.list] }));
      return f;
    } catch (e) {
      return fail(e);
    }
  },

  modifier: async (id, data) => {
    try {
      const f = await api.put<Facture>(`/facturation/${id}`, data);
      set((st) => ({ list: st.list.map((x) => (x.id === id ? f : x)) }));
      return f;
    } catch (e) {
      return fail(e);
    }
  },

  update: async (id, data) => {
    try {
      const f = await api.patch<Facture>(`/facturation/${id}`, data);
      set((st) => ({ list: st.list.map((x) => (x.id === id ? f : x)) }));
    } catch (e) {
      fail(e);
    }
  },

  conformite: async (id) => {
    try {
      return await api.get<EinvoiceEtat>(`/facturation/${id}/einvoice`);
    } catch (e) {
      return fail(e);
    }
  },

  preparer: async (id, regenerer = false) => {
    try {
      const etat = await api.post<EinvoiceEtat>(`/facturation/${id}/einvoice/${regenerer ? "regenerer" : "preparer"}`);
      set((st) => ({ list: st.list.map((x) => (x.id === id ? { ...x, einvoice: etat.einvoice } : x)) }));
      return etat;
    } catch (e) {
      return fail(e);
    }
  },

  telechargerXml: async (id, numero, version) => {
    try {
      const xml = await api.get<string>(`/facturation/${id}/einvoice/xml${version ? `?version=${version}` : ""}`);
      const nom = numero.replace(/[^A-Za-z0-9._-]/g, "_");
      download(new Blob([xml], { type: "application/xml;charset=utf-8" }), `${nom}${version === "non-signe" ? "-non-signe" : version === "ttn" ? "-ttn" : ""}.xml`);
    } catch (e) {
      fail(e);
    }
  },

  fetchSignature: async () => {
    try {
      const signature = await api.get<SignatureEtat>("/facturation/signature");
      set({ signature });
      return signature;
    } catch (e) {
      return fail(e);
    }
  },

  chargerCertificat: async (fichier, motDePasse) => {
    try {
      const signature = await api.put<SignatureEtat>("/facturation/signature/certificat", { fichier: await enBase64(fichier), motDePasse });
      set({ signature });
      return signature;
    } catch (e) {
      return fail(e);
    }
  },

  supprimerCertificat: async () => {
    try {
      set({ signature: await api.del<SignatureEtat>("/facturation/signature/certificat") });
    } catch (e) {
      fail(e);
    }
  },

  deverrouiller: async (motDePasse) => {
    try {
      set({ signature: await api.post<SignatureEtat>("/facturation/signature/deverrouiller", { motDePasse }) });
    } catch (e) {
      fail(e);
    }
  },

  verrouiller: async () => {
    try {
      set({ signature: await api.post<SignatureEtat>("/facturation/signature/verrouiller") });
    } catch (e) {
      fail(e);
    }
  },

  fetchTtn: async () => {
    try {
      const ttn = await api.get<TtnEtat>("/facturation/ttn");
      set({ ttn });
      return ttn;
    } catch (e) {
      return fail(e);
    }
  },

  enregistrerTtn: async (data) => {
    try {
      set({ ttn: await api.put<TtnEtat>("/facturation/ttn", data) });
    } catch (e) {
      fail(e);
    }
  },

  supprimerTtn: async () => {
    try {
      set({ ttn: await api.del<TtnEtat>("/facturation/ttn") });
    } catch (e) {
      fail(e);
    }
  },

  testerTtn: async () => {
    try {
      return (await api.post<{ ok: boolean; message: string }>("/facturation/ttn/tester")).message;
    } catch (e) {
      return fail(e);
    }
  },

  deposer: async (id) => {
    try {
      const etat = await api.post<EinvoiceEtat>(`/facturation/${id}/einvoice/deposer`);
      set((st) => ({ list: st.list.map((x) => (x.id === id ? { ...x, einvoice: etat.einvoice } : x)) }));
      return etat;
    } catch (e) {
      return fail(e);
    }
  },

  actualiser: async (id) => {
    try {
      const etat = await api.post<EinvoiceEtat>(`/facturation/${id}/einvoice/actualiser`);
      set((st) => ({ list: st.list.map((x) => (x.id === id ? { ...x, einvoice: etat.einvoice } : x)) }));
      return etat;
    } catch (e) {
      return fail(e);
    }
  },

  actualiserTout: async () => {
    try {
      const bilan = await api.post<TtnBilan>("/facturation/ttn/actualiser");
      if (bilan.changees > 0) await useFacturation.getState().fetchList();
      return bilan;
    } catch (e) {
      return fail(e);
    }
  },

  journal: async (id) => {
    try {
      return await api.get<FactureJournalEntry[]>(`/facturation/${id}/journal`);
    } catch (e) {
      return fail(e);
    }
  },

  rouvrir: async (id) => {
    try {
      const etat = await api.post<EinvoiceEtat>(`/facturation/${id}/einvoice/rouvrir`);
      set((st) => ({ list: st.list.map((x) => (x.id === id ? { ...x, einvoice: etat.einvoice } : x)) }));
      return etat;
    } catch (e) {
      return fail(e);
    }
  },

  signer: async (id) => {
    try {
      const etat = await api.post<EinvoiceEtat>(`/facturation/${id}/einvoice/signer`);
      set((st) => ({ list: st.list.map((x) => (x.id === id ? { ...x, einvoice: etat.einvoice } : x)) }));
      return etat;
    } catch (e) {
      // Verrouillée ou expirée entre-temps : on remet l'état réel pour que l'écran propose le déverrouillage.
      if (e instanceof ApiError && e.status === 409) void useFacturation.getState().fetchSignature().catch(() => undefined);
      return fail(e);
    }
  },
}));
