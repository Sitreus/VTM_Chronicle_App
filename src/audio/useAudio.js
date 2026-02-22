/**
 * useAudio — React hook for AudioStateManager integration
 *
 * Provides a clean React interface to the audio system.
 * Handles initialization on first user gesture, cleanup on unmount,
 * and exposes event methods for components to call.
 *
 * Usage:
 *   function App() {
 *     const audio = useAudio();
 *
 *     // The hook auto-initializes on first click/keydown.
 *     // Components just call event methods:
 *     audio.onSplashEnter();
 *     audio.onGameLineSelect('vtm');
 *     audio.toggleMute();
 *   }
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import AudioStateManager from './AudioStateManager.js';

export default function useAudio() {
  const managerRef = useRef(null);
  const initPromiseRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [isReady, setIsReady] = useState(false);

  // Create manager on mount
  useEffect(() => {
    managerRef.current = new AudioStateManager();
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
    };
  }, []);

  // Initialize and resume AudioContext.
  // The AudioContext can only leave "suspended" state when called from
  // a user gesture (click/keydown). Calls outside gestures will init
  // the engine but the context stays suspended until the next gesture.
  const ensureInit = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return null;

    // Already fully running — nothing to do
    if (manager.isReady) return manager;

    // Initialize engine + load manifest (first call only)
    if (!initPromiseRef.current) {
      initPromiseRef.current = manager.init().catch(err => {
        console.warn('[useAudio] Init failed:', err);
        initPromiseRef.current = null;
      });
    }
    await initPromiseRef.current;

    // Resume a suspended AudioContext (succeeds when called from a user gesture)
    await manager.resume();

    // Update reactive state so dependent useEffects re-fire
    if (manager.isReady && !isReady) {
      setIsReady(true);
    }

    return manager;
  }, [isReady]);

  // Auto-init on first user interaction
  useEffect(() => {
    const handleGesture = () => {
      ensureInit();
      // Remove after first gesture
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
    window.addEventListener('click', handleGesture, { once: false });
    window.addEventListener('keydown', handleGesture, { once: false });
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [ensureInit]);

  // ─── Exposed Methods ───────────────────────────────────────

  const onSplashEnter = useCallback(async () => {
    const m = await ensureInit();
    m?.onSplashEnter();
  }, [ensureInit]);

  const onEnterDarkness = useCallback(async (gameLineId) => {
    const m = await ensureInit();
    m?.onEnterDarkness(gameLineId);
  }, [ensureInit]);

  const onGameLineSelect = useCallback(async (gameLineId) => {
    const m = await ensureInit();
    m?.onGameLineSelect(gameLineId);
  }, [ensureInit]);

  const onSplashExit = useCallback(() => {
    managerRef.current?.onSplashExit();
  }, []);

  const onGameLineChange = useCallback((gameLineId) => {
    managerRef.current?.onGameLineChange(gameLineId);
  }, []);

  const onTabChange = useCallback(() => {
    managerRef.current?.onTabChange();
  }, []);

  const onModalOpen = useCallback(() => {
    managerRef.current?.onModalOpen();
  }, []);

  const onSplashInteract = useCallback(() => {
    managerRef.current?.onSplashInteract();
  }, []);

  const toggleMute = useCallback(() => {
    const isMuted = managerRef.current?.toggleMute();
    setMuted(!!isMuted);
    return isMuted;
  }, []);

  const setVolume = useCallback((val) => {
    managerRef.current?.setMasterVolume(val);
    setVolumeState(val);
  }, []);

  const getStatus = useCallback(() => {
    return managerRef.current?.getStatus() || null;
  }, []);

  return {
    onSplashEnter,
    onEnterDarkness,
    onGameLineSelect,
    onSplashExit,
    onGameLineChange,
    onTabChange,
    onModalOpen,
    onSplashInteract,
    toggleMute,
    setVolume,
    getStatus,
    muted,
    volume,
    isReady,
  };
}
