import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "./me.functions";

export function useMeQuery() {
  const fn = useServerFn(getMe);
  return useQuery({
    queryKey: ["me"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}

export const ALL_FEATURE_FLAGS = [
  "cv_builder",
  "cv_library",
  "jobs",
  "billing",
  "topup",
  "settings",
  "chat_support",
] as const;
export type FeatureFlag = (typeof ALL_FEATURE_FLAGS)[number];

export function hasFeature(flags: Record<string, boolean> | null | undefined, key: FeatureFlag): boolean {
  if (!flags) return true;
  const v = flags[key];
  return v === undefined ? true : !!v;
}

