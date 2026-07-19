import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium text-foreground mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          aria-invalid={error ? true : undefined}
          className={`w-full px-3 py-2 bg-input-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow ${
            error ? 'border-destructive' : 'border-input'
          } ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
