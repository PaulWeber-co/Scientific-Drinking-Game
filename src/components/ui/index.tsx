import { useEffect, type ReactNode } from 'react';
import { Icon } from '../icons';
import { AVATAR_COLORS, avatarStyle, type AvatarColor } from './Avatar';
import { createPortal } from 'react-dom';
import { haptic } from '../../lib/haptics';

export function NavBar({
  title,
  left,
  right,
}: {
  title?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="navbar">
      <div className="navbar__slot">{left}</div>
      <div className="navbar__title">{title}</div>
      <div className="navbar__slot navbar__slot--end">{right}</div>
    </header>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portal ans <body>: die Screens haben durch ihre Einblend-Animation einen
  // eigenen Stacking-Context, sonst läge das Sheet unter der Tab-Leiste.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="sheet__grabber" />
        {title && (
          <div className="row-between" style={{ marginBottom: 12 }}>
            <div className="t-title2">{title}</div>
            <button className="btn btn--plain" onClick={onClose}>
              Fertig
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          className="segmented__opt"
          aria-pressed={value === o.value}
          onClick={() => {
            haptic('select');
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  const set = (v: number) => {
    const next = Math.min(max, Math.max(min, v));
    if (next !== value) haptic('tap');
    onChange(next);
  };
  return (
    <div className="stepper">
      <button className="stepper__btn" onClick={() => set(value - step)} aria-label="weniger">
        <Icon name="minus" size={19} strokeWidth={2.2} />
      </button>
      <div className="stepper__value">
        {value}
        {unit && <span className="stepper__unit">{unit}</span>}
      </div>
      <button className="stepper__btn" onClick={() => set(value + step)} aria-label="mehr">
        <Icon name="plus" size={19} strokeWidth={2.2} />
      </button>
    </div>
  );
}

const COLOR_LABEL: Record<AvatarColor, string> = {
  indigo: 'Indigo',
  purple: 'Violett',
  pink: 'Pink',
  red: 'Rot',
  orange: 'Orange',
  yellow: 'Gelb',
  green: 'Grün',
  mint: 'Mint',
  teal: 'Türkis',
  blue: 'Blau',
};

/** Ersetzt die Emoji-Auswahl: der Avatar ist ein Monogramm in Wunschfarbe. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: AvatarColor;
  onChange: (v: AvatarColor) => void;
}) {
  return (
    <div className="scroll-x" role="group" aria-label="Avatarfarbe">
      {AVATAR_COLORS.map((c) => (
        <button
          key={c}
          className={`swatch pressable ${c === value ? 'swatch--on' : ''}`}
          style={avatarStyle(c)}
          onClick={() => {
            haptic('select');
            onChange(c);
          }}
          aria-label={COLOR_LABEL[c]}
          aria-pressed={c === value}
        >
          {c === value && <Icon name="check" size={15} strokeWidth={2.4} />}
        </button>
      ))}
    </div>
  );
}

export function ListItem({
  icon,
  title,
  subtitle,
  right,
  onClick,
  active,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const inner = (
    <>
      {icon && <span className="listicon">{icon}</span>}
      <span className="grow">
        <span className="t-headline" style={{ display: 'block' }}>
          {title}
        </span>
        {subtitle && <span className="t-caption">{subtitle}</span>}
      </span>
      {right ?? (onClick && <Icon name="chevronRight" size={17} className="list__chevron" />)}
    </>
  );
  if (!onClick) return <div className={`list__item ${active ? 'list__item--active' : ''}`}>{inner}</div>;
  return (
    <button
      className={`list__item ${active ? 'list__item--active' : ''}`}
      onClick={() => {
        haptic('tap');
        onClick();
      }}
    >
      {inner}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'toggle--on' : ''}`}
      onClick={() => {
        haptic('select');
        onChange(!checked);
      }}
    >
      <span className="toggle__knob" />
    </button>
  );
}
