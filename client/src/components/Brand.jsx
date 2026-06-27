export default function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-red via-accent-orange to-accent-yellow flex items-center justify-center shadow-warm">
          <span className="font-display font-extrabold text-cream text-xl leading-none">DM</span>
        </div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-accent-green border-2 border-charcoal-800"></div>
      </div>
      {!compact && (
        <div>
          <div className="font-display font-bold text-cream leading-tight text-lg">Dos Mezclas</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-cream/60">Staff Portal</div>
        </div>
      )}
      {compact && (
        <div className="font-display font-bold text-cream text-lg leading-tight">Dos Mezclas</div>
      )}
    </div>
  );
}
