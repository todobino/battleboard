
'use client';

import type { UndoableState } from '@/types';
import React, { useState, useCallback, useRef } from 'react';

const MAX_HISTORY_LENGTH = 20; // Increased slightly

interface UseUndoRedoProps {
  initialSnapshot: UndoableState;
  getCurrentSnapshot: () => UndoableState;
  restoreSnapshot: (snapshot: UndoableState) => void;
  maxHistory?: number;
  onStateRestored?: () => void; // Callback after state is restored (e.g., to clear selections)
}

export function useUndoRedo({
  initialSnapshot,
  getCurrentSnapshot,
  restoreSnapshot,
  maxHistory = MAX_HISTORY_LENGTH,
  onStateRestored,
}: UseUndoRedoProps) {
  const [history, setHistory] = useState<UndoableState[]>([initialSnapshot]);
  const [historyPointer, setHistoryPointer] = useState<number>(0);
  const isRestoring = useRef(false); // To prevent feedback loops

  const addSnapshot = useCallback(() => {
    if (isRestoring.current) {
      isRestoring.current = false; // Reset flag after a restore operation
      return;
    }
    const newSnapshot = getCurrentSnapshot();
    // Avoid adding identical consecutive snapshots
    if (history.length > 0 && JSON.stringify(history[historyPointer]) === JSON.stringify(newSnapshot)) {
      return;
    }

    const newHistoryBase = history.slice(0, historyPointer + 1);
    const updatedHistory = [...newHistoryBase, newSnapshot].slice(-maxHistory);
    
    setHistory(updatedHistory);
    setHistoryPointer(updatedHistory.length - 1);
  }, [getCurrentSnapshot, history, historyPointer, maxHistory]);

  const undo = useCallback(() => {
    if (historyPointer <= 0) return false;
    isRestoring.current = true;
    const newPointer = historyPointer - 1;
    restoreSnapshot(history[newPointer]);
    setHistoryPointer(newPointer);
    if (onStateRestored) onStateRestored();
    return true;
  }, [history, historyPointer, restoreSnapshot, onStateRestored]);

  const redo = useCallback(() => {
    if (historyPointer >= history.length - 1) return false;
    isRestoring.current = true;
    const newPointer = historyPointer + 1;
    restoreSnapshot(history[newPointer]);
    setHistoryPointer(newPointer);
    if (onStateRestored) onStateRestored();
    return true;
  }, [history, historyPointer, restoreSnapshot, onStateRestored]);
  
  const resetHistory = useCallback((newInitialSnapshot: UndoableState) => {
    isRestoring.current = true; // Prevent addSnapshot from firing immediately
    setHistory([newInitialSnapshot]);
    setHistoryPointer(0);
    // restoreSnapshot(newInitialSnapshot); // This would be called by the board reset function directly
  }, [/*restoreSnapshot*/]);


  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < history.length - 1;

  return {
    addSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
    isRestoring, // Expose to allow BattleBoardPage to set it to false after initial load
  };
}
