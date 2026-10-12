import type { ComponentType } from "react";
import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    cellClassName?: string;
    headerClassName?: string;
    label?: string;
    /** Icône affichée avant le titre dans l'en-tête « register ». */
    icon?: ComponentType<{ className?: string }>;
  }
}

export const DATA_TABLE_PAGE_SIZE = 10;
