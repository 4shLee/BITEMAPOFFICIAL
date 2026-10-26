import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, Info, X } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: 'trash' | 'warning' | 'info';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  icon = variant === 'danger' ? 'trash' : variant === 'warning' ? 'warning' : 'info',
  isLoading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const iconStyles = {
    danger: 'bg-destructive/10 text-destructive border-destructive/20',
    warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    primary: 'bg-primary/10 text-primary border-primary/20',
  };

  const renderIcon = () => {
    if (icon === 'trash') return <Trash2 className="h-6 w-6" />;
    if (icon === 'warning') return <AlertTriangle className="h-6 w-6" />;
    return <Info className="h-6 w-6" />;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/50 transition-opacity animate-in fade-in"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all animate-in zoom-in-95 sm:p-7">
        <button
          type="button"
          aria-label="Close dialog"
          onClick={() => {
            if (!isLoading) onClose();
          }}
          disabled={isLoading}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${iconStyles[variant]}`}
          >
            {renderIcon()}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-foreground">
              {title}
            </h2>
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
