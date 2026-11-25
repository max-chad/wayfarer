export default function Loading() {
  return (
    <div className="container-page space-y-6 pt-10" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-10 w-72" />
      <div className="skeleton h-5 w-96 max-w-full" />
      <div className="skeleton h-72 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton aspect-[4/3] w-full rounded-2xl" />
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
