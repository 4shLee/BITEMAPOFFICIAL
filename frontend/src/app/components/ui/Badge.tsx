interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'neutral', size = 'md' }: BadgeProps) {
  const variantStyles = {
    success: 'bg-success-bg text-success border-success/20',
    warning: 'bg-warning-bg text-warning border-warning/20',
    danger: 'bg-destructive-bg text-destructive border-destructive/20',
    info: 'bg-accent-bg text-accent border-accent/20',
    neutral: 'bg-muted text-muted-foreground border-border'
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs'
  };

  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${variantStyles[variant]} ${sizeStyles[size]}`}>
      {children}
    </span>
  );
}
