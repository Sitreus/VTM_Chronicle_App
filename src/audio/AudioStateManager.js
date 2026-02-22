/**
 * AudioStateManager — Bridges UI state to audio behavior
 *
 * This is the "brain" that listens to app state changes and drives
 * the audio layers accordingly. It maps UI events to audio actions:
 *
 *   Splash screen visible  → DroneLayer starts, evolves on idle
 *   "Enter the Darkness"   → TransitionLayer sting, drone fades
 *   Game line selected      → TransitionLayer sting, AmbientLayer crossfades
 *   Tab switched            → subtle UI sound (optional)
 *   Splash dismissed        → Ambient continues in main app
 *
 * Audio file naming convention (place files in /public/audio/):
 *
 *   Drones:       drone_vtm.ogg, drone_mta.ogg, ...
 *   Harmonics:    harmonic_vtm.ogg, harmonic_mta.ogg, ...
 *   Ambients:     ambient_vtm.ogg, ambient_mta.ogg, ...
 *   Transitions:  sting_vtm.ogg, sting_mta.ogg, ...
 *   UI:           ui_enter.ogg, ui_click.ogg, ...
 *
 * Usage:
 *   // In your React app's top-level component:
 *   const audioManager = useRef(null);
 *
 *   useEffect(() => {
 *     audioManager.current = new AudioStateManager();
 *     return () => audioManager.current.destroy();
 *   }, []);
 *
 *   // On user gesture (first click):
 *   audioManager.current.init();
 *
 *   // On state changes:
 *   audioManager.current.onSplashEnter();
 *   audioManager.current.onGameLineSelect('vtm');
 *   audioManager.current.onSplashExit();
 */

import AudioEngine from './AudioEngine.js';
import DroneLayer from './layers/DroneLayer.js';
import AmbientLayer from './layers/AmbientLayer.js';
import TransitionLayer from './layers/TransitionLayer.js';

// Game lines that have audio assets
const GAME_LINES = ['vtm', 'mta', 'wta', 'wto', 'htr', 'ctd'];

// Audio file manifest — maps asset names to file paths.
// Only entries whose files actually exist in /public/audio/ will load.
function buildManifest() {
  const manifest = [];
  for (const gl of GAME_LINES) {
    manifest.push({ name: `drone_${gl}`, url: `/audio/drone_${gl}.ogg` });
    manifest.push({ name: `harmonic_${gl}`, url: `/audio/harmonic_${gl}.ogg` });
    manifest.push({ name: `ambient_${gl}`, url: `/audio/ambient_${gl}.ogg` });
    manifest.push({ name: `sting_${gl}`, url: `/audio/sting_${gl}.ogg` });
  }
  // Generic UI sounds
  manifest.push({ name: 'ui_enter', url: '/audio/ui_enter.ogg' });
  manifest.push({ name: 'ui_click', url: '/audio/ui_click.ogg' });
  manifest.push({ name: 'ui_transition', url: '/audio/ui_transition.ogg' });
  // Generic fallback drone/ambient (used when game-specific files aren't available)
  manifest.push({ name: 'drone_default', url: '/audio/drone_default.ogg' });
  manifest.push({ name: 'ambient_default', url: '/audio/ambient_default.ogg' });
  return manifest;
}

export default class AudioStateManager {
  constructor() {
    this.engine = new AudioEngine();
    this.drone = new DroneLayer(this.engine);
    this.ambient = new AmbientLayer(this.engine);
    this.transition = new TransitionLayer(this.engine);

    this._initialized = false;
    this._currentGameLine = null;
    this._splashActive = false;
    this._muted = false;
    this._volume = 0.8;
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Initialize the audio system. MUST be called from a user gesture.
   * Loads all available audio assets.
   */
  async init() {
    if (this._initialized) return;

    await this.engine.init();
    this._initialized = true;

    // Load manifest — failures are silently logged (missing files are OK)
    const manifest = buildManifest();
    await this.engine.loadManifest(manifest);

    this.engine.setMasterVolume(this._volume);
  }

  /**
   * Check if the audio system is ready to play.
   */
  get isReady() {
    return this._initialized && this.engine.isReady;
  }

  /**
   * Clean up everything.
   */
  async destroy() {
    this.drone.stop();
    this.ambient.stop();
    this.transition.stop();
    await this.engine.destroy();
    this._initialized = false;
  }

  // ─── Volume Control ─────────────────────────────────────────

  setMasterVolume(value) {
    this._volume = Math.max(0, Math.min(1, value));
    this.engine.setMasterVolume(this._muted ? 0 : this._volume);
  }

  getMasterVolume() {
    return this._volume;
  }

  toggleMute() {
    this._muted = !this._muted;
    this.engine.setMasterVolume(this._muted ? 0 : this._volume);
    return this._muted;
  }

  get isMuted() { return this._muted; }

  // ─── State Events ───────────────────────────────────────────

  /**
   * Called when the splash screen becomes visible.
   * Starts the evolving drone.
   */
  onSplashEnter() {
    if (!this.isReady) return;
    this._splashActive = true;

    // Start drone — use game-specific if available, else default
    const droneName = this._resolveName('drone');
    const harmonicName = this._resolveName('harmonic');

    if (droneName) {
      this.drone.start(droneName, harmonicName);
    }
  }

  /**
   * Called when "Enter the Darkness" is clicked.
   * Plays a transition sound, fades the drone, transitions to ambient.
   *
   * @param {string} gameLineId — e.g. 'vtm', 'mta' (optional if not yet selected)
   */
  async onEnterDarkness(gameLineId = null) {
    if (!this.isReady) return;

    // Play UI enter sound
    if (this.engine.hasBuffer('ui_enter')) {
      this.transition.play('ui_enter', { volume: 0.5 });
    }

    // Fade out drone
    await this.drone.fadeOut(1.5);
  }

  /**
   * Called when a game line card is selected on the splash screen.
   * Plays the game-line-specific sting and transitions audio.
   *
   * @param {string} gameLineId — 'vtm', 'mta', 'wta', etc.
   */
  async onGameLineSelect(gameLineId) {
    if (!this.isReady) return;
    this._currentGameLine = gameLineId;

    // Play game-line sting
    const stingName = `sting_${gameLineId}`;
    if (this.engine.hasBuffer(stingName)) {
      this.transition.playTransition(stingName, this.ambient);
    }

    // Fade drone if still active
    if (this.drone.isActive) {
      this.drone.fadeOut(1.0);
    }

    // Start or crossfade ambient to this game line
    const ambientName = this._resolveName('ambient', gameLineId);
    if (ambientName) {
      if (this.ambient.isActive) {
        this.ambient.crossfadeTo(ambientName, 2.0);
      } else {
        this.ambient.play(ambientName, 2.0);
      }
    }
  }

  /**
   * Called when splash screen is dismissed and main app is shown.
   * The ambient continues; drone is stopped.
   */
  onSplashExit() {
    this._splashActive = false;

    if (this.drone.isActive) {
      this.drone.fadeOut(1.5);
    }
    // Ambient keeps playing — it persists into the main app
  }

  /**
   * Called when the user switches between game lines in the main app
   * (e.g. via the game type selector in the header).
   */
  onGameLineChange(gameLineId) {
    if (!this.isReady || gameLineId === this._currentGameLine) return;
    this._currentGameLine = gameLineId;

    const ambientName = this._resolveName('ambient', gameLineId);
    if (ambientName) {
      this.ambient.crossfadeTo(ambientName, 3.0);
    }
  }

  /**
   * Called on tab switches — plays a subtle UI click (optional).
   */
  onTabChange() {
    if (!this.isReady) return;
    if (this.engine.hasBuffer('ui_click')) {
      this.transition.play('ui_click', { volume: 0.15 });
    }
  }

  /**
   * Called when a modal opens — optional UI sound.
   */
  onModalOpen() {
    if (!this.isReady) return;
    if (this.engine.hasBuffer('ui_click')) {
      this.transition.play('ui_click', { volume: 0.1 });
    }
  }

  /**
   * Called when the user goes idle on the splash screen.
   * The drone layer handles evolution automatically,
   * but this can be used to trigger additional behavior.
   */
  onSplashIdle() {
    // Drone evolution is time-based internally.
    // This hook exists for future use (e.g. visual cues synced to audio).
  }

  /**
   * Called when user interacts during splash idle.
   * Resets drone evolution to subtle state.
   */
  onSplashInteract() {
    if (!this.isReady) return;
    if (this.drone.isActive) {
      this.drone.resetEvolution(1.5);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────

  /**
   * Resolve a buffer name with fallback to default.
   * e.g. _resolveName('drone', 'vtm') → 'drone_vtm' if loaded, else 'drone_default'
   */
  _resolveName(prefix, gameLineId = null) {
    const gl = gameLineId || this._currentGameLine;
    if (gl) {
      const specific = `${prefix}_${gl}`;
      if (this.engine.hasBuffer(specific)) return specific;
    }
    const fallback = `${prefix}_default`;
    return this.engine.hasBuffer(fallback) ? fallback : null;
  }

  // ─── Debug ──────────────────────────────────────────────────

  getStatus() {
    return {
      initialized: this._initialized,
      muted: this._muted,
      volume: this._volume,
      currentGameLine: this._currentGameLine,
      splashActive: this._splashActive,
      droneActive: this.drone.isActive,
      droneStage: this.drone.stage,
      ambientActive: this.ambient.isActive,
      ambientBuffer: this.ambient.currentBuffer,
    };
  }
}
