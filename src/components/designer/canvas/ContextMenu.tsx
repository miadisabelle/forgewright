'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import type { ContextMenuItem } from './types';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onSelect: (action: string) => void;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ContextMenu({
  x,
  y,
  items,
  onSelect,
  onClose,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Click outside → close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleItemClick = useCallback(
    (action: string) => {
      onSelect(action);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-xl"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.action}
          disabled={item.disabled}
          onClick={() => handleItemClick(item.action)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {item.icon && <span className="w-4 text-center">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
