// 화면을 여는 동안 보이는 뼈대 (loading.tsx). 실제 화면과 비슷한 자리에 회색 블록만 — DB·클라이언트 코드 없음

const Bar = ({ className = "" }: { className?: string }) => <div className={`skeleton rounded-lg ${className}`} />;

function Rows({ n }: { n: number }) {
  return (
    <div className="card mt-2 divide-y divide-black/5 overflow-hidden">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="skeleton size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Bar className="h-3.5 w-24" />
            <Bar className="h-3 w-16" />
          </div>
          <Bar className="h-9 w-24 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ kind = "list" }: { kind?: "list" | "dashboard" | "form" | "stats" }) {
  return (
    <main className="px-3 pt-3" aria-busy="true" aria-label="불러오는 중">
      <span className="sr-only">불러오는 중…</span>
      {kind === "dashboard" ? (
        <div className="space-y-4">
          <Bar className="h-7 w-32" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card h-[132px] p-5">
                <Bar className="h-3.5 w-20" />
                <Bar className="mt-4 h-7 w-16" />
                <Bar className="mt-3 h-3 w-28" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="card h-64" />
            <div className="card h-64" />
          </div>
        </div>
      ) : kind === "form" ? (
        <div className="space-y-3">
          <Bar className="h-7 w-28" />
          <div className="card space-y-3 p-4">
            <Bar className="h-4 w-20" />
            <Bar className="h-11 w-full rounded-xl" />
            <Bar className="h-4 w-24" />
            <Bar className="h-28 w-full rounded-xl" />
            <Bar className="h-12 w-full rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between py-1">
            <Bar className="h-9 w-16" />
            <Bar className="h-6 w-32" />
            <Bar className="h-9 w-16" />
          </div>
          {kind === "stats" ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="card h-[78px]" />
              <div className="card h-[78px]" />
            </div>
          ) : (
            <div className="card mt-2 h-[78px]" />
          )}
          <Rows n={6} />
        </>
      )}
    </main>
  );
}
