export function PageTitle({ title, sub, right, info }: { title: string; sub?: string; right?: React.ReactNode; info?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between px-1 pt-1 pb-3">
      <div>
        <h1 className="flex items-center gap-1 text-[22px] font-bold tracking-tight">
          {title}
          {info}
        </h1>
        {sub && <p className="mt-0.5 text-[13px] text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
