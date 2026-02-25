import { useState, useCallback, useRef } from "react";

const MAX_HISTORY = 30;

export default function useUndoHistory() {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const isUndoRedoing = useRef(false);

  const pushState = useCallback((label, data) => {
    if (isUndoRedoing.current) return;
    const entry = { label, data: JSON.parse(JSON.stringify(data)), timestamp: Date.now() };
    const next = [...undoStackRef.current, entry];
    const trimmed = next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    undoStackRef.current = trimmed;
    setUndoStack(trimmed);
    redoStackRef.current = [];
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return null;
    const last = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setUndoStack(undoStackRef.current);
    redoStackRef.current = [...redoStackRef.current, last];
    setRedoStack(redoStackRef.current);
    return last;
  }, []);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return null;
    const last = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    setRedoStack(redoStackRef.current);
    undoStackRef.current = [...undoStackRef.current, last];
    setUndoStack(undoStackRef.current);
    return last;
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
