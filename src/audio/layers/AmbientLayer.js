/**
 * AmbientLayer — Background ambient bed with crossfade support
 *
 * Manages a persistent ambient background that can smoothly
 * crossfade between different tracks (e.g. switching game lines,
 * entering different sections of the app).
 *
 * Supports two simultaneous tracks for seamless crossfading:
 * the "active" track and the "outgoing" track.
 *
 * Signal chain:
 *   BufferSource A → GainA ─┐
 *                            ├→ LayerGain → Engine master
 *   BufferSource B → GainB ─┘
 *
 * Usage:
 *   const ambient = new AmbientLayer(engine);
 *   ambient.play('ambient_vtm');                     // Start ambient
 *   ambient.crossfadeTo('ambient_mta', 3.0);         // Smooth switch
 *   ambient.setVolume(0.5);                           // Adjust level
 *   await ambient.fadeOut(2.0);                       // Exit
 */

export default class AmbientLayer {
  constructor(engine) {
    this._engine = engine;
    this._layerGain = null;
    this._trackA = null;  // { source handle, gain, bufferName }
    this._trackB = null;
    this._activeSlot = null;  // 'A' or 'B' — which is currently playing
    this._active = false;
    this._currentBuffer = null;

    this.config = {
      defaultVolume: 0.3,
      crossfadeDuration: 3.0,
      fadeInTime: 2.0,
      fadeOutTime: 2.0,
    };
  }

  get isActive() { return this._active; }
  get currentBuffer() { return this._currentBuffer; }

  /**
   * Start playing an ambient track.
   * If already playing, crossfades to the new track.
   *
   * @param {string} bufferName — name of a loaded buffer
   * @param {number} fadeIn     — fade-in duration in seconds
   */
  play(bufferName, fadeIn = null) {
    const engine = this._engine;
    if (!engine.isReady || !engine.hasBuffer(bufferName)) return;

    // If already playing this buffer, do nothing
    if (this._active && this._currentBuffer === bufferName) return;

    // If already active, crossfade instead
    if (this._active) {
      this.crossfadeTo(bufferName);
      return;
    }

    this._active = true;
    this._currentBuffer = bufferName;
    const fadeDur = fadeIn ?? this.config.fadeInTime;

    // Create layer gain
    this._layerGain = engine.createGain(this.config.defaultVolume);

    // Create track A gain
    const gainA = engine.createGainTo(this._layerGain, 0);
    const sourceA = engine.play(bufferName, {
      output: gainA,
      loop: true,
      volume: 1,
    });

    this._trackA = { handle: sourceA, gain: gainA, bufferName };
    this._activeSlot = 'A';

    // Fade in
    engine.linearRamp(gainA.gain, 1, fadeDur);
  }

  /**
   * Crossfade from the current track to a new one.
   *
   * @param {string} bufferName — buffer to crossfade to
   * @param {number} duration   — crossfade duration
   */
  crossfadeTo(bufferName, duration = null) {
    const engine = this._engine;
    if (!engine.isReady || !engine.hasBuffer(bufferName)) return;

    // If same buffer, skip
    if (this._currentBuffer === bufferName) return;

    const fadeDur = duration ?? this.config.crossfadeDuration;
    this._currentBuffer = bufferName;

    if (!this._active) {
      this.play(bufferName);
      return;
    }

    // Determine which slot is active and which is free
    const outSlot = this._activeSlot;
    const inSlot = outSlot === 'A' ? 'B' : 'A';
    const outTrack = outSlot === 'A' ? this._trackA : this._trackB;

    // Create the incoming track
    const inGain = engine.createGainTo(this._layerGain, 0);
    const inSource = engine.play(bufferName, {
      output: inGain,
      loop: true,
      volume: 1,
    });
    const inTrack = { handle: inSource, gain: inGain, bufferName };

    if (inSlot === 'A') this._trackA = inTrack;
    else this._trackB = inTrack;

    // Crossfade
    if (outTrack?.gain) {
      engine.crossfade(outTrack.gain, inGain, fadeDur);

      // Clean up outgoing source after crossfade
      setTimeout(() => {
        if (outTrack.handle) {
          engine.stop(outTrack.handle.id, 0.05);
        }
        outTrack.gain.disconnect();
      }, fadeDur * 1000 + 200);
    } else {
      engine.linearRamp(inGain.gain, 1, fadeDur);
    }

    this._activeSlot = inSlot;
  }

  /**
   * Set the overall ambient layer volume.
   */
  setVolume(value, rampTime = 0.5) {
    if (!this._layerGain) return;
    this._engine.rampTo(this._layerGain.gain, Math.max(0, Math.min(1, value)), rampTime);
  }

  /**
   * Duck the ambient volume temporarily (e.g. during a transition sting).
   * @param {number} level    — ducked volume (0-1)
   * @param {number} rampDown — time to duck in seconds
   * @returns {Function} — call to restore volume
   */
  duck(level = 0.1, rampDown = 0.3) {
    if (!this._layerGain) return () => {};
    const prevVolume = this.config.defaultVolume;
    this._engine.rampTo(this._layerGain.gain, level, rampDown);

    return (rampUp = 1.0) => {
      if (this._layerGain) {
        this._engine.rampTo(this._layerGain.gain, prevVolume, rampUp);
      }
    };
  }

  /**
   * Fade out and stop the ambient layer.
   */
  fadeOut(duration = null) {
    const fadeDur = duration ?? this.config.fadeOutTime;
    return new Promise(resolve => {
      if (!this._active || !this._layerGain) {
        resolve();
        return;
      }

      this._engine.linearRamp(this._layerGain.gain, 0, fadeDur);

      setTimeout(() => {
        this._cleanup();
        resolve();
      }, fadeDur * 1000 + 100);
    });
  }

  stop() {
    this._cleanup();
  }

  _cleanup() {
    const engine = this._engine;
    if (this._trackA?.handle) {
      engine.stop(this._trackA.handle.id, 0.05);
      this._trackA.gain?.disconnect();
    }
    if (this._trackB?.handle) {
      engine.stop(this._trackB.handle.id, 0.05);
      this._trackB.gain?.disconnect();
    }
    if (this._layerGain) {
      this._layerGain.disconnect();
    }
    this._trackA = null;
    this._trackB = null;
    this._layerGain = null;
    this._activeSlot = null;
    this._active = false;
    this._currentBuffer = null;
  }
}
