import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', className = '', ...props }, ref) => {
    const variantStyles = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary-dark',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
      outline: 'border border-border bg-transparent hover:bg-muted',
      danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    };

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:m-0 [&>svg]:shrink-0 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
