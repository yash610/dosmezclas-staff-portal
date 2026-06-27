export default function StatCard({ label, value, accent = 'orange', icon, hint }) {
  const ring = {
    red:    'from-accent-red/20    to-accent-red/0    ring-accent-red/30',
    orange: 'from-accent-orange/20 to-accent-orange/0 ring-accent-orange/30',
    yellow: 'from-accent-yellow/20 to-accent-yellow/0 ring-accent-yellow/30',
    green:  'from-accent-green/20  to-accent-green/0  ring-accent-green/30',
  }[accent] || '';

  return (
    <div className={`card-dark relative overflow-hidden bg-gradient-to-br ${ring} ring-1`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-cream/60 text-sm">{label}</div>
          <div className="font-display font-bold text-3xl mt-1 text-cream">{value}</div>
          {hint && <div className="text-cream/50 text-xs mt-1">{hint}</div>}
        </div>
        {icon && <div className="text-3xl opacity-80">{icon}</div>}
      </div>
    </div>
  );
}
