import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  trend?: {
    value: string;
    direction: 'up' | 'down';
  };
  iconBgColor?: string;
  iconColor?: string;
}

export function StatCard({
  icon: Icon,
  title,
  value,
  trend,
  iconBgColor = 'bg-primary-bg',
  iconColor = 'text-primary'
}: StatCardProps) {
  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm shadow-slate-900/5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/8">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mb-1 text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 text-xs">
              {trend.direction === 'up' ? (
                <TrendingUp className="w-3 h-3 text-success" />
              ) : (
                <TrendingDown className="w-3 h-3 text-destructive" />
              )}
              <span className={trend.direction === 'up' ? 'text-success' : 'text-destructive'}>
                {trend.value}
              </span>
            </div>
          )}
        </div>
        <div className={`${iconBgColor} ${iconColor} flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
