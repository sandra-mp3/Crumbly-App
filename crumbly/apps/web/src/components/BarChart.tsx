export function BarChart({ data, label, format = (n: number) => String(n) }: { data: { label: string; value: number }[]; label: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value)), w = 100 / data.length;
  return (
    <figure>
      <svg viewBox="0 0 100 44" role="img" aria-label={label} className="h-44 w-full" preserveAspectRatio="none">
        {data.map((d, i) => { const h = (d.value / max) * 38; return <rect key={i} x={i * w + w * 0.15} y={40 - h} width={w * 0.7} height={Math.max(h, 0.4)} rx="0.6" className="fill-sun"><title>{`${d.label}: ${format(d.value)}`}</title></rect>; })}
      </svg>
      <figcaption className="flex justify-between text-xs text-mute"><span>{data[0]?.label}</span><span>peak {format(max)}</span><span>{data.at(-1)?.label}</span></figcaption>
    </figure>
  );
}
