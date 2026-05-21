type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-md bg-border/60 ${className}`.trim()}
    />
  );
}

export function CardSkeleton({ fieldCount = 3 }: { fieldCount?: number }) {
  return (
    <div
      className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface-elevated p-5"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-4 w-full max-w-md" />
      {Array.from({ length: fieldCount }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

export function PhotoGallerySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section
      className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface-elevated p-5"
      aria-busy="true"
      aria-label="Loading photos"
    >
      <Skeleton className="h-5 w-32" />
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {Array.from({ length: rows }, (_, i) => (
          <li
            key={i}
            className="flex items-center gap-4 border-b border-border pb-3.5 last:border-b-0 last:pb-0"
          >
            <Skeleton className="size-[120px] shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/5 max-w-[200px]" />
              <Skeleton className="h-3 w-full max-w-sm" />
            </div>
            <Skeleton className="h-3 w-24 shrink-0" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PageGridSkeleton() {
  return (
    <main className="grid gap-5 md:grid-cols-2 md:items-start" aria-busy="true">
      <CardSkeleton />
      <PhotoGallerySkeleton />
    </main>
  );
}
