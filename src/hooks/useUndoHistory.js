import { useState, useCallback, useRef } from "react";

const MAX_HISTORY = 30;

export default function useUndoHistory() {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const isUndoRedoing = useRef(false);

  const pushState = useCallback((label, data) => {
    if (isUndoRedoing.current) return;
    setUndoStack(prev => {
      const next = [...prev, { label, data: JSON.parse(JSON.stringify(data)), timestamp: Date.now() }];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    let result = null;
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      result = last;
      setRedoStack(r => [...r, last]);
      return prev.slice(0, -1);
    });
    return result;
  }, []);

  const redo = useCallback(() => {
    let result = null;
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      result = last;
      setUndoStack(u => [...u, last]);
      return prev.slice(0, -1);
    });
    return result;
  }, []);

  const setIsUndoRedoing = useCallback((val) => {
    isUndoRedoing.current = val;
  }, []);

  return {
    undoStack,
    redoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushState,
    undo,
    redo,
    setIsUndoRedoing,
  };
}
