export default function Loading() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      {/* Fake masthead */}
      <div
        style={{
          height: "96px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      />

      <div
        className="flex-1 mx-auto w-full px-4 sm:px-6 py-8"
        style={{ maxWidth: "var(--max-w)" }}
      >
        {/* Title skeleton */}
        <div className="flex items-baseline gap-4 mb-8">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-6 w-64 rounded" />
        </div>

        {/* Hero skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
          <div className="lg:col-span-2 skeleton rounded-xl" style={{ height: "220px" }} />
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton rounded-xl" style={{ height: "64px" }} />
            ))}
          </div>
        </div>

        {/* Section skeletons */}
        {[1, 2, 3].map(s => (
          <div key={s} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="skeleton w-1 h-5 rounded" />
              <div className="skeleton h-4 w-32 rounded" />
              <div className="flex-1 skeleton h-px rounded" />
            </div>
            <div
              className="grid gap-px"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                background: "var(--border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              {[1, 2, 3].map(c => (
                <div key={c} className="skeleton" style={{ height: "180px", background: "var(--surface-raised)" }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
