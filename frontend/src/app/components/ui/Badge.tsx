interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'neutral', size = 'md' }: BadgeProps) {
  const variantStyles = {
    success: 'bg-success-bg text-success border-success/20',
    warning: 'bg-warning-bg text-warning border-warning/25',
    danger: 'bg-destructive-bg text-destructive border-destructive/20',
    info: 'bg-accent-bg text-accent border-accent/20',
    neutral: 'bg-muted text-muted-foreground border-border'
  };

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-[11px]',
    md: 'px-3 py-1 text-xs'
  };

  return (
    <span className={`inline-flex items-center rounded-full border font-semibold leading-none ${variantStyles[variant]} ${sizeStyles[size]}`}>
      {children}
    </span>
  );
}
