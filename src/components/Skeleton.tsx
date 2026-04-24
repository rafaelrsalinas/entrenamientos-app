export function Skeleton({ height = 20, width = '100%', radius = 6, style }: {
  height?: number | string;
  width?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ height, width, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="card">
      <Skeleton height={14} width="40%" />
      <Skeleton height={20} width="70%" style={{ marginTop: 10 }} />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} height={14} width={`${Math.round(60 + Math.random() * 30)}%`} style={{ marginTop: 8 }} />
      ))}
    </div>
  );
}
