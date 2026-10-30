export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between px-1 pt-1 pb-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-[13px] text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
