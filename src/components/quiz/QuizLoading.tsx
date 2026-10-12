import { Icon, Skeleton } from "@/components/ui";

export function QuizLoading() {
  return (
    <div className="relative flex aspect-[3/4] max-h-[460px] w-full items-center justify-center">
      <Skeleton className="absolute inset-0 h-full w-full rounded-xl" />
      <div className="relative z-10 flex flex-col items-center gap-2 rounded-xl bg-primary/80 px-6 py-4 text-center text-on-primary shadow-lg backdrop-blur-md">
        <Icon name="auto_awesome" filled size={28} className="animate-pulse" />
        <p className="font-headline-sm text-headline-sm">Estamos preparando su propuesta…</p>
        <p className="font-body-sm text-body-sm text-surface-container-low">Unos segundos más…</p>
      </div>
    </div>
  );
}
