import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useAppServices } from './services';

// ---------------------------------------------------------------------------
// Auto-growing textarea (used for bullets & freeform bodies)

export function AutoTextarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
): ReactNode {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useLayoutEffect(resize, [resize, props.value]);
  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      onInput={(e) => {
        resize();
        props.onInput?.(e);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Hooks

/** Reactively track whether the user has configured AI. */
export function useAiConfigured(): boolean {
  const { aiCredentials } = useAppServices();
  return useSyncExternalStore(
    (cb) => aiCredentials.subscribe(cb),
    () => aiCredentials.isConfigured(),
    () => false,
  );
}

/** Reactively track the OS colour-scheme preference (for CodeMirror theming). */
export function usePrefersDark(): boolean {
  const subscribe = useCallback((cb: () => void) => {
    if (typeof matchMedia === 'undefined') return () => {};
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches),
    () => false,
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons (14px, currentColor). No external icon deps.

type IconProps = { size?: number; className?: string };

function svg(path: ReactNode, viewBox = '0 0 24 24') {
  return function Icon({ size = 14, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {path}
      </svg>
    );
  };
}

export const IconPlus = svg(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>);
export const IconMore = svg(<><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></>);
export const IconChevronDown = svg(<polyline points="6 9 12 15 18 9" />);
export const IconChevronRight = svg(<polyline points="9 6 15 12 9 18" />);
export const IconEye = svg(<><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></>);
export const IconEyeOff = svg(<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>);
export const IconArrowUp = svg(<><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>);
export const IconArrowDown = svg(<><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>);
export const IconTrash = svg(<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>);
export const IconClose = svg(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>);
export const IconGithub = svg(<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />);
export const IconGlobe = svg(<><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>);
export const IconSliders = svg(<><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>);
export const IconSparkles = svg(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />);
export const IconDownload = svg(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>);
export const IconCopy = svg(<><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>);
export const IconImport = svg(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>);
export const IconInfo = svg(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="17" /><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" /></>);
export const IconGrip = svg(<><circle cx="9" cy="6" r="1.3" /><circle cx="15" cy="6" r="1.3" /><circle cx="9" cy="12" r="1.3" /><circle cx="15" cy="12" r="1.3" /><circle cx="9" cy="18" r="1.3" /><circle cx="15" cy="18" r="1.3" /></>);

// ---------------------------------------------------------------------------
// Modal

export function Modal(props: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}): ReactNode {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = getFocusable(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const frame = requestAnimationFrame(() => getFocusable(dialogRef.current)[0]?.focus());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      returnFocusRef.current?.focus();
    };
  }, [props.onClose]);

  return (
    <div className="ink-modal-backdrop" onMouseDown={props.onClose} role="presentation">
      <div
        ref={dialogRef}
        className={`ink-modal${props.wide ? ' ink-modal-wide' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
      >
        <header className="ink-modal-head">
          <h2>{props.title}</h2>
          <button className="ink-icon-btn" onClick={props.onClose} aria-label={t('common.close')}>
            <IconClose />
          </button>
        </header>
        <div className="ink-modal-body">{props.children}</div>
        {props.footer && <footer className="ink-modal-foot">{props.footer}</footer>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropdown menu (click-anchored, closes on outside click / Esc)

export interface MenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
  testId?: string;
}

export function DropdownMenu(props: {
  trigger: (open: () => void, isOpen: boolean) => ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
}): ReactNode {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    const frame = requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="ink-menu-root" ref={rootRef}>
      {props.trigger(() => {
        triggerRef.current = document.activeElement as HTMLElement | null;
        setOpen((v) => !v);
      }, open)}
      {open && (
        <div
          className={`ink-menu ink-menu-${props.align ?? 'left'}`}
          role="menu"
          onKeyDown={(event) => {
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
            const current = items.indexOf(document.activeElement as HTMLButtonElement);
            let next = current;
            if (event.key === 'ArrowDown') next = (current + 1) % items.length;
            else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = items.length - 1;
            else return;
            event.preventDefault();
            items[next]?.focus();
          }}
        >
          {props.items.map((item) => (
            <button
              key={item.key}
              className={`ink-menu-item${item.danger ? ' danger' : ''}`}
              role="menuitem"
              data-testid={item.testId}
              onClick={() => {
                setOpen(false);
                item.onSelect();
                requestAnimationFrame(() => triggerRef.current?.focus());
              }}
            >
              {item.icon && <span className="ink-menu-icon">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('hidden'));
}
