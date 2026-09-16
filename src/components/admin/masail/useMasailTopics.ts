"use client";

import { useAdminData } from "@/components/admin/useAdminData";

export interface MasailTopic {
  slug: string;
  name: string;
  description: string;
  count: number;
  path: string;
}

export function useMasailTopics(): MasailTopic[] {
  const { data } = useAdminData<{ items: MasailTopic[] }>("/api/admin/topics");
  return data?.items ?? [];
}
