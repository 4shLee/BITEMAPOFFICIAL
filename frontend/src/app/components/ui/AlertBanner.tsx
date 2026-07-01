import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface AlertBannerProps {
  variant?: 'info' | 'warning' | 'danger';
  message: string;
  onDismiss?: () => void;
}

export function AlertBanner({ variant = 'info', message, onDismiss }: AlertBannerProps) {
  const config = {
    info: {
      icon: Info,
      bgColor: 'bg-accent-bg',
      textColor: 'text-accent',
      borderColor: 'border-accent/20'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-warning-bg',
      textColor: 'text-warning',
      borderColor: 'border-warning/20'
    },
    danger: {
      icon: AlertCircle,
      bgColor: 'bg-destructive-bg',
      textColor: 'text-destructive',
      borderColor: 'border-destructive/20'
    }
  };

  const { icon: Icon, bgColor, textColor, borderColor } = config[variant];

  return (
    <div className={`${bgColor} ${borderColor} border rounded-lg p-4 flex items-start gap-3`}>
      <Icon className={`w-5 h-5 ${textColor} flex-shrink-0 mt-0.5`} />
      <p className={`flex-1 text-sm ${textColor}`}>{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className={`${textColor} hover:opacity-70 transition-opacity`}>
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
