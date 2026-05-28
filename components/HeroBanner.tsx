export default function HeroBanner() {
  return (
    <div className="bg-gradient-to-br from-[#002868] via-[#BF0A30] to-[#006847] text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10 text-center">
        <div className="text-3xl sm:text-4xl mb-2">🇺🇸 🇲🇽 🇨🇦</div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-1">
          2026 FIFA World Cup Pool
        </h1>
        <p className="text-sm sm:text-lg font-medium opacity-90 mb-0.5">
          USA &middot; Mexico &middot; Canada
        </p>
        <p className="text-xs sm:text-sm opacity-70">June 11 – July 19, 2026</p>
      </div>
    </div>
  );
}
