/**
 * AudioStateManager — Bridges UI state to audio behavior
 *
 * This is the "brain" that listens to app state changes and drives
 * the audio layers accordingly. It maps UI events to audio actions:
 *
 *   Welcome screen visible  → Intro music starts (on first user gesture)
 *   "Enter the Darkness"    → Button press + stinger (music already playing)
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

// Priority manifest — splash screen audio loaded first for fast response.
function buildPriorityManifest() {
  return [
    { name: 'intro_start', url: '/audio/intro_splash_screen_start.ogg' },
    { name: 'intro_loop', url: '/audio/intro_splash_screen_loop.ogg' },
    { name: 'intro_press', url: '/audio/intro_splash_screen_press_button.ogg' },
    { name: 'intro_stinger', url: '/audio/intro_splash_screen_stinger.ogg' },
  ];
}

// Background manifest — game-specific audio loaded after splash is ready.
function buildBackgroundManifest() {
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
  // Generic fallback drone/ambient
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

    // Intro splash audio state
    this._introStartHandle = null;   // handle from engine.play
    this._introLoopHandle = null;    // handle from engine.playGaplessLoop

    // Welcome screen music state
    this._welcomeMusicRequested = false;
    this._welcomeMusicStarted = false;
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

    // Load splash screen audio first for immediate playback
    const priority = buildPriorityManifest();
    await this.engine.loadManifest(priority);

    this.engine.setMasterVolume(this._volume);

    // Load game-specific audio in background (failures are expected for missing files)
    const background = buildBackgroundManifest();
    this.engine.loadManifest(background);
  }

  /**
   * Resume a suspended AudioContext.
   * Must be called from a user gesture (click/keydown) to satisfy
   * browser autoplay policy.
   */
  async resume() {
    await this.engine.resume();
  }

  /**
   * Check if the audio system is ready to play.
   */
  get isReady() {
    return this._initialized && this.engine.isReady;
  }

  /**
   * Signal that the welcome screen is active and music should play.
   * If audio is ready, starts immediately. Otherwise sets a pending flag
   * so music begins as soon as the system initializes (on first user gesture).
   */
  requestWelcomeMusic() {
    this._welcomeMusicRequested = true;
    this._startWelcomeMusic();
  }

  /**
   * Called after audio system becomes ready (post-gesture init).
   * Starts any pending welcome music.
   */
  onSystemReady() {
    if (this._welcomeMusicRequested) {
      this._startWelcomeMusic();
    }
  }

  /**
   * Start the welcome/main-menu music (intro_start → intro_loop).
   *
   * Uses Web Audio sample-accurate scheduling instead of setTimeout
   * to eliminate the gap between intro_start and intro_loop.
   * The loop uses double-buffered gapless playback to avoid
   * OGG codec padding micro-gaps on repeat.
   *
   * Idempotent — safe to call multiple times.
   * @private
   */
  _startWelcomeMusic() {
    if (!this.isReady) return;
    if (this._welcomeMusicStarted) return;
    this._welcomeMusicStarted = true;
    this._splashActive = true;

    const startTime = this.engine.currentTime;

    // Play intro start music with a gentle fade-in
    if (this.engine.hasBuffer('intro_start')) {
      this._introStartHandle = this.engine.play('intro_start', {
        loop: false,
        volume: 1,
        fadeIn: 1.0,
      });
    }

    // Schedule gapless loop to begin at the exact sample where intro_start ends.
    // Web Audio scheduling is sample-accurate — no JS timer jitter.
    if (this.engine.hasBuffer('intro_loop')) {
      const introDuration = this.engine.getBufferDuration('intro_start');
      if (introDuration) {
        this._introLoopHandle = this.engine.playGaplessLoop('intro_loop', {
          volume: 1,
          when: startTime + introDuration,
        });
      } else {
        // Fallback: no intro_start buffer, start loop immediately
        this._introLoopHandle = this.engine.playGaplessLoop('intro_loop', {
          volume: 1,
        });
      }
    }
  }

  /**
   * Clean up everything.
   */
  async destroy() {
    this._stopIntroAudio(0);
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
   * Called when the card selection screen becomes visible.
   * Welcome music is already playing (started on welcome screen).
   * This only tracks splash state.
   */
  onSplashEnter() {
    if (!this.isReady) return;
    this._splashActive = true;
  }

  /**
   * Called when "Enter the Darkness" is clicked (welcome screen).
   * Plays button press sound and stinger, then fades out the intro music.
   * The stinger masks the fade-out for a smooth transition.
   */
  async onEnterDarkness(gameLineId = null) {
    if (!this.isReady) return;
    this._splashActive = true;

    // Play button press sound
    if (this.engine.hasBuffer('intro_press')) {
      this.transition.play('intro_press', { volume: 1 });
    }

    // Play stinger — masks the fade-out of intro music
    if (this.engine.hasBuffer('intro_stinger')) {
      this.transition.play('intro_stinger', { volume: 1 });
    }

    // Fade out intro music (intro_start and/or intro_loop).
    // The stinger covers the fade so the transition feels seamless.
    this._stopIntroAudio(1.3);

    // If welcome music hasn't started yet (edge case: this button
    // is the very first interaction), cancel the pending request —
    // no point starting music just to immediately fade it out.
    if (!this._welcomeMusicStarted) {
      this._welcomeMusicRequested = false;
    }

    // Fade out drone if it was active
    if (this.drone.isActive) {
      this.drone.fadeOut(1.3);
    }
  }

  /**
   * Stop all intro splash audio.
   * @param {number} fadeOut — fade-out duration in seconds (0 = immediate)
   */
  _stopIntroAudio(fadeOut = 0) {
    if (this._introStartHandle) {
      this.engine.stop(this._introStartHandle.id, fadeOut);
      this._introStartHandle = null;
    }
    if (this._introLoopHandle) {
      this.engine.stop(this._introLoopHandle.id, fadeOut);
      this._introLoopHandle = null;
    }
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

    // Fade out intro splash audio (playing during card selection)
    this._stopIntroAudio(1.3);

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
   * The ambient continues; drone and intro audio are stopped.
   */
  onSplashExit() {
    this._splashActive = false;

    // Stop any lingering intro audio
    this._stopIntroAudio(0.5);

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
