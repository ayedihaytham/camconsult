import { useMediaQuery } from "@/hooks/use-media-query";

export const SHORT_DESKTOP_QUERY =
  "(min-width: 1024px) and (max-height: 900px)";
export const SHORT_DESKTOP_PAGE_SIZE = 6;

export function getOperationalPageSize(
  defaultPageSize: number,
  isShortDesktop: boolean,
) {
  return isShortDesktop ? SHORT_DESKTOP_PAGE_SIZE : defaultPageSize;
}

export function useOperationalPageSize(defaultPageSize: number) {
  const isShortDesktop = useMediaQuery(SHORT_DESKTOP_QUERY);
  return getOperationalPageSize(defaultPageSize, isShortDesktop);
}
