import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { WorkspaceSplitterKind } from '../workspaceLayout';

export function WorkspaceSplitter({
  kind,
  label,
  value,
  min,
  max,
  onPreview,
  onCommit,
  onReset,
}: {
  kind: WorkspaceSplitterKind;
  label: string;
  value: number;
  min: number;
  max: number;
  onPreview: (kind: WorkspaceSplitterKind, value: number) => void;
  onCommit: (kind: WorkspaceSplitterKind, value: number) => void;
  onReset: (kind: WorkspaceSplitterKind) => void;
}): ReactNode {
  const drag = useRef<{ pointerId: number; startX: number; startValue: number; latestValue: number } | null>(null);

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startValue: value, latestValue: value };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.closest('.ink-app')?.classList.add('ink-is-resizing');
    event.preventDefault();
  };

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.latestValue = current.startValue + event.clientX - current.startX;
    onPreview(kind, current.latestValue);
  };

  const pointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const next = current.startValue + event.clientX - current.startX;
    drag.current = null;
    event.currentTarget.closest('.ink-app')?.classList.remove('ink-is-resizing');
    onCommit(kind, next);
  };

  const pointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.closest('.ink-app')?.classList.remove('ink-is-resizing');
    onCommit(kind, current.latestValue);
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 8;
    const next = event.key === 'Home'
      ? min
      : event.key === 'End'
        ? max
        : value + (event.key === 'ArrowLeft' ? -step : step);
    onCommit(kind, next);
  };

  return (
    <div
      className={`ink-workspace-splitter ink-workspace-splitter-${kind}`}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerEnd}
      onPointerCancel={pointerCancel}
      onDoubleClick={() => onReset(kind)}
      onKeyDown={keyDown}
    />
  );
}
