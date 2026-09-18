import type { TacheStatut } from "@/types";

const STATUS_ORDER: Record<TacheStatut, number> = {
  a_faire: 0,
  en_cours: 1,
  termine: 2,
};

export function compareTaskStatuses(left: TacheStatut, right: TacheStatut) {
  return STATUS_ORDER[left] - STATUS_ORDER[right];
}

