import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', className = '', ...props }, ref) => {
    const variantStyles = {
      primary: 'bg-primary text-primary-foreground shadow-sm shadow-emerald-900/10 hover:bg-primary-dark hover:shadow-md',
      secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90',
      outline: 'border border-border bg-white text-foreground shadow-sm hover:border-primary/30 hover:bg-primary-bg hover:text-primary-dark',
      danger: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90'
    };

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base'
    };

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold leading-none transition-all disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:m-0 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
