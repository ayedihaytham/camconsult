import { useState } from "react";
import { Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AttentionList } from "../attention/AttentionList";
import { WorkspaceSection } from "../WorkspaceSection";
import type { DashboardAttentionItem } from "@/lib/dashboard/dashboardData";

export function AttentionTab({ items, loading, error }: { items: DashboardAttentionItem[]; loading: boolean; error: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Tout");
  const query = search.trim().toLocaleLowerCase("fr");
  const filtered = items.filter((item) => (!query || `${item.title} ${item.description}`.toLocaleLowerCase("fr").includes(query)) && (filter === "Tout" || (filter === "Collectes" ? item.type === "collecte" : filter === "Messages" ? item.type === "message" : !["collecte", "message"].includes(item.type))));
  return <div className="dashboard-soft"><WorkspaceSection title="À traiter" icon={Bell} target="dashboard-attention" description="Échéances dépassées, corrections et éléments à examiner. Les tâches sont dans la vue Tâches.">
    <div className="flex flex-wrap items-center gap-2 py-3">
      <Input aria-label="Rechercher un élément à traiter" placeholder="Société ou élément…" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 w-full sm:w-80" />
      <div role="group" aria-label="Type d’élément" className="flex flex-wrap gap-1">{["Tout", "Collectes", "Messages", "Autres"].map((value) => <Button key={value} variant={filter === value ? "secondary" : "ghost"} className="dashboard-choice min-h-11 px-3 text-xs" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</Button>)}</div>
    </div>
    {(loading || error) && <p role="status" className="pb-3 text-xs text-muted-foreground">Liste partielle : certaines sources sont {loading ? "en chargement" : "indisponibles"}. Les éléments déjà chargés restent consultables.</p>}
    {filtered.length ? <AttentionList items={filtered} grouped /> : <p className="py-4 text-sm text-muted-foreground">{loading || error ? "Aucun résultat parmi les éléments actuellement chargés." : query || filter !== "Tout" ? "Aucun élément ne correspond à cette recherche." : "Aucun élément à traiter dans ce périmètre."}</p>}
  </WorkspaceSection></div>;
}
