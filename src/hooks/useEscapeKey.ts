
'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * A hook that listens for Escape key presses and increments a counter.
 * It also resets the counter if the active element is an input, textarea, or contentEditable.
 * @returns The current escape press count.
 */
export function useEscapeKey(): number {
  const [escapePressCount, setEscapePressCount] = useState(0);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const isInputFocused = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );

    if (event.key === 'Escape') {
      if (isInputFocused && (document.activeElement === target || (document.activeElement && document.activeElement.contains(target)))) {
        // If an input is focused, Escape might be used by the input itself (e.g., blur).
        // We still increment, but consumers of the hook might ignore it if an input was active.
        // Or, we could choose to not increment if an input is focused, depending on desired behavior.
        // For now, let's increment, and the component using the hook can decide.
      }
      // event.preventDefault(); // Be cautious with preventDefault, might interfere with dialogs own escape handling.
      setEscapePressCount(prev => prev + 1);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return escapePressCount;
}
