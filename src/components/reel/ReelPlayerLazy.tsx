"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui";

export const ReelPlayerLazy = dynamic(() => import("./ReelPlayer").then((m) => m.ReelPlayer), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});
