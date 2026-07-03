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
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-foreground tracking-tight mb-1">{value}</p>
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
        <div className={`${iconBgColor} ${iconColor} w-11 h-11 rounded-xl flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
