import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function ModalDialog({ open, title, description, banner, children, footer, className, onClose }: {
  open: boolean;
  title: string;
  description?: string;
  banner?: string;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]') ?? []);
    window.setTimeout(() => {
      const autofocus = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]');
      if (autofocus) autofocus.focus();
      else focusables()[0]?.focus();
    }, 0);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables(); if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
      returnFocus.current?.focus();
    };
  }, [open]);
  if (!open) return null;
  return <div className="dialog-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className={`dialog-shell${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
      <button type="button" className="dialog-close" aria-label={`Cerrar ${title}`} onClick={onClose}><X size={22} aria-hidden="true" /></button>
      <header><h2 id={titleId}>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}</header>
      {banner ? <p className="dialog-banner">{banner}</p> : null}
      <div className="dialog-body">{children}</div>
      <footer>{footer}</footer>
    </section>
  </div>;
}
