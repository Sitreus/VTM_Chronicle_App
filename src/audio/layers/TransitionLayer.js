/**
 * TransitionLayer — One-shot stingers and transition sounds
 *
 * Plays non-looping audio cues tied to UI events:
 * - Game line selection transitions (blood drip, arcane shatter, etc.)
 * - "Enter the Darkness" button click
 * - Tab switches, modal opens, other UI moments
 *
 * Unlike DroneLayer and AmbientLayer, these are fire-and-forget sounds
 * that play once and clean up automatically. Multiple can overlap.
 *
 * Signal chain:
 *   BufferSource → individual Gain → LayerGain → Engine master
 *
 * Usage:
 *   const transitions = new TransitionLayer(engine);
 *   transitions.play('sting_vtm');                // Fire a one-shot
 *   transitions.play('ui_click', { volume: 0.3 }); // Quieter UI sound
 *   transitions.play('sting_mta', { duck: ambient }); // Duck ambient during sting
 */

export default class TransitionLayer {
  constructor(engine) {
    this._engine = engine;
    this._layerGain = null;
    this._activeSounds = new Map();  // id → { handle, timeout }
    this._active = false;

    this.config = {
      defaultVolume: 0.6,
      maxConcurrent: 8,  // Safety limit
    };
  }

  get isActive() { return this._active; }

  /**
   * Initialize the layer gain node.
   * Called lazily on first play.
   */
  _ensureReady() {
    if (this._layerGain) return true;
    const engine = this._engine;
    if (!engine.isReady) return false;

    this._layerGain = engine.createGain(this.config.defaultVolume);
    this._active = true;
    return true;
  }

  /**
   * Play a one-shot transition sound.
   *
   * @param {string} bufferName — name of a loaded buffer
   * @param {Object} options
   * @param {number} options.volume   — volume for this sound (0-1, relative to layer)
   * @param {number} options.fadeIn   — optional fade-in
   * @param {number} options.playbackRate — speed adjustment
   * @param {AmbientLayer} options.duck — ambient layer to duck during playback
   * @param {number} options.duckLevel  — duck target volume
   * @param {number} options.duckRelease — duck release time after sound ends
   * @returns {string|null} — sound id for manual control, or null if failed
   */
  play(bufferName, options = {}) {
    if (!this._ensureReady()) return null;
    const engine = this._engine;
    if (!engine.hasBuffer(bufferName)) return null;

    // Safety: limit concurrent sounds
    if (this._activeSounds.size >= this.config.maxConcurrent) {
      // Stop the oldest sound
      const oldestId = this._activeSounds.keys().next().value;
      this._stopSound(oldestId);
    }

    const {
      volume = 1,
      fadeIn = 0,
      playbackRate = 1,
      duck = null,
      duckLevel = 0.15,
      duckRelease = 1.0,
    } = options;

    // Duck ambient if requested
    let unduck = null;
    if (duck && typeof duck.duck === 'function') {
      unduck = duck.duck(duckLevel, 0.2);
    }

    const handle = engine.play(bufferName, {
      output: this._layerGain,
      loop: false,
      volume,
      fadeIn,
      playbackRate,
    });

    if (!handle) return null;

    // Calculate buffer duration for auto-cleanup
    const buffer = engine.getBuffer(bufferName);
    const duration = buffer ? (buffer.duration / playbackRate) * 1000 : 10000;

    const timeout = setTimeout(() => {
      this._activeSounds.delete(handle.id);
      // Restore ambient duck
      if (unduck) unduck(duckRelease);
    }, duration + 200);

    this._activeSounds.set(handle.id, { handle, timeout, unduck });
    return handle.id;
  }

  /**
   * Play a transition sting with automatic ambient ducking.
   * Convenience method for game-line transitions.
   *
   * @param {string} bufferName  — sting buffer
   * @param {AmbientLayer} ambient — ambient layer to duck
   * @param {Object} options     — additional play options
   */
  playTransition(bufferName, ambient = null, options = {}) {
    return this.play(bufferName, {
      volume: 0.8,
      duck: ambient,
      duckLevel: 0.1,
      duckRelease: 1.5,
      ...options,
    });
  }

  /**
   * Stop a specific sound by id.
   */
  _stopSound(id) {
    const entry = this._activeSounds.get(id);
    if (!entry) return;
    clearTimeout(entry.timeout);
    this._engine.stop(entry.handle.id, 0.1);
    if (entry.unduck) entry.unduck(0.5);
    this._activeSounds.delete(id);
  }

  /**
   * Set the overall transition layer volume.
   */
  setVolume(value) {
    if (!this._layerGain) return;
    this._engine.rampTo(
      this._layerGain.gain,
      Math.max(0, Math.min(1, value)),
      0.1
    );
  }

  /**
   * Stop all active transition sounds.
   */
  stopAll() {
    for (const [id] of this._activeSounds) {
      this._stopSound(id);
    }
  }

  stop() {
    this.stopAll();
    if (this._layerGain) {
      this._layerGain.disconnect();
      this._layerGain = null;
    }
    this._active = false;
  }
}
