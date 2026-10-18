import { create } from "zustand";
import { api } from "@/lib/api";
import type {
  ApurementKind,
  ApurementList,
  ApurementRecord,
} from "@/types/apurement";
interface State {
  result: ApurementList;
  loading: boolean;
  requestId: number;
  load: (kind: ApurementKind, query: string) => Promise<void>;
  save: (
    kind: ApurementKind,
    input: unknown,
    id?: string,
  ) => Promise<ApurementRecord>;
  clear: () => void;
  enterPurchase: (input: unknown) => Promise<ApurementRecord>;
}
const empty: ApurementList = {
  items: [],
  page: 1,
  size: 25,
  total: 0,
  hasMore: false,
};
export const useApurement = create<State>((set, get) => ({
  result: empty,
  loading: false,
  requestId: 0,
  load: async (kind, query) => {
    const requestId = get().requestId + 1;
    set({ requestId, loading: true });
    try {
      const result = await api.get<ApurementList>(
        `/apurement/${kind}?${query}`,
      );
      if (get().requestId === requestId) set({ result });
    } finally {
      if (get().requestId === requestId) set({ loading: false });
    }
  },
  save: (kind, input, id) =>
    id
      ? api.patch(`/apurement/${kind}/${id}`, input)
      : api.post(`/apurement/${kind}`, input),
  enterPurchase: (input) => api.post("/apurement/achats", input),
  clear: () =>
    set((s) => ({ result: empty, loading: false, requestId: s.requestId + 1 })),
}));
