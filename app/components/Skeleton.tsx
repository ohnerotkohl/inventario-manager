export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded-lg w-1/3" />
      <div className="h-3 bg-gray-100 rounded-lg w-2/3" />
      <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < rows - 1 ? "border-b border-gray-100" : ""}`}>
          <div className="h-4 bg-gray-200 rounded-lg flex-1" />
          <div className="h-4 bg-gray-100 rounded-lg w-12" />
          <div className="h-4 bg-gray-100 rounded-lg w-12" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 animate-pulse">
        <div className="h-7 bg-gray-200 rounded-lg w-40" />
        <div className="h-4 bg-gray-100 rounded-lg w-56" />
      </div>
      <SkeletonList rows={4} />
      <SkeletonList rows={6} />
    </div>
  );
}
