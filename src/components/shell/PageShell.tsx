import type { ReactNode } from "react";

import { AppHeader } from "./AppHeader";

export interface PageShellProps {
  title: string;
  children: ReactNode;
}

export function PageShell({ title, children }: PageShellProps) {
  return (
    <>
      <AppHeader title={title} />
      <main className="relative flex min-h-screen w-full flex-col bg-surface pt-20 pb-8">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-y-space-lg px-margin md:max-w-[768px] md:px-margin-tablet">
          {children}
        </div>
      </main>
    </>
  );
}
