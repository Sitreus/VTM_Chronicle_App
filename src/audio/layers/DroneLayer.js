/**
 * DroneLayer — Evolving drone with time-based automation
 *
 * Plays a base drone that evolves over time when the user is idle.
 * The drone starts minimal and gradually opens up (filter sweep,
 * additional harmonic layers fading in) to create tension/atmosphere.
 *
 * Designed for the splash screen: a small drone starts on load,
 * evolves if the user idles, then transitions out on interaction.
 *
 * Signal chain:
 *   BufferSource → Filter (lowpass, automated) → DroneGain → Engine master
 *
 * Evolution stages (time-based):
 *   0s  — drone starts, filter closed, quiet
 *   ~5s — filter begins opening, volume rises slightly
 *   ~15s — full evolution: filter wide open, harmonics layer fades in
 *
 * Usage:
 *   const drone = new DroneLayer(engine);
 *   drone.start('drone_vtm');           // Begin with subtle drone
 *   // ... time passes, evolution happens automatically ...
 *   await drone.fadeOut(2.0);           // Smooth exit
 */

export default class DroneLayer {
  constructor(engine) {
    this._engine = engine;
    this._layerGain = null;       // Overall layer volume
    this._filter = null;          // Lowpass filter for evolution
    this._baseSource = null;      // Primary drone source handle
    this._harmonicSource = null;  // Secondary harmonic layer handle
    this._evolutionTimer = null;  // setInterval for evolution stages
    this._stage = 0;              // Current evolution stage (0-3)
    this._active = false;
    this._paused = false;

    // Tuning parameters — adjust these to taste
    this.config = {
      initialVolume: 0.15,        // Starting volume (subtle)
      evolvedVolume: 0.35,        // Full evolution volume
      harmonicVolume: 0.2,        // Harmonic layer max volume
      filterStart: 300,           // Initial lowpass cutoff Hz
      filterMid: 800,             // Mid-evolution cutoff
      filterOpen: 2400,           // Full evolution cutoff
      filterQ: 0.7,               // Filter resonance
      evolutionDelay: 5000,       // ms before first evolution step
      evolutionInterval: 5000,    // ms between evolution steps
      fadeInTime: 2.0,            // Initial fade-in seconds
      fadeOutTime: 2.0,           // Default fade-out seconds
    };
  }

  get isActive() { return this._active; }
  get stage() { return this._stage; }

  /**
   * Start the drone layer with a base buffer.
   * Optionally provide a harmonics buffer for the evolution layer.
   *
   * @param {string} baseBuffer     — buffer name for the base drone
   * @param {string} harmonicBuffer — buffer name for the harmonic layer (optional)
   */
  start(baseBuffer, harmonicBuffer = null) {
    const engine = this._engine;
    if (!engine.isReady || !engine.hasBuffer(baseBuffer)) return;

    this._active = true;
    this._stage = 0;

    // Create layer gain → master
    this._layerGain = engine.createGain(0);

    // Create lowpass filter
    this._filter = engine.createFilter('lowpass', this.config.filterStart, this.config.filterQ);
    this._filter.connect(this._layerGain);

    // Start base drone through filter
    this._baseSource = engine.play(baseBuffer, {
      output: this._filter,
      loop: true,
      volume: 1,  // Volume controlled at layer gain
      fadeIn: 0,
    });

    // Fade in the layer
    engine.linearRamp(this._layerGain.gain, this.config.initialVolume, this.config.fadeInTime);

    // Prepare harmonic layer (silent, ready to fade in during evolution)
    if (harmonicBuffer && engine.hasBuffer(harmonicBuffer)) {
      this._harmonicSource = engine.play(harmonicBuffer, {
        output: this._layerGain,
        loop: true,
        volume: 0,
        fadeIn: 0,
      });
    }

    // Start evolution timer
    this._evolutionTimer = setTimeout(() => this._evolve(), this.config.evolutionDelay);
  }

  /**
   * Internal: advance evolution by one stage.
   */
  _evolve() {
    if (!this._active || this._paused) return;
    const engine = this._engine;
    if (!engine.isReady) return;

    this._stage++;

    switch (this._stage) {
      case 1:
        // Stage 1: Filter begins opening, slight volume bump
        engine.rampTo(this._filter.frequency, this.config.filterMid, 3.0);
        engine.rampTo(this._layerGain.gain, this.config.initialVolume + 0.05, 2.0);
        break;

      case 2:
        // Stage 2: Filter opens more, harmonics begin fading in
        engine.rampTo(this._filter.frequency, this.config.filterOpen, 4.0);
        engine.rampTo(this._layerGain.gain, this.config.evolvedVolume, 3.0);
        if (this._harmonicSource) {
          engine.rampTo(this._harmonicSource.gain.gain, this.config.harmonicVolume, 4.0);
        }
        break;

      case 3:
        // Stage 3: Fully evolved — no further changes, just sustain
        return; // Don't schedule more
    }

    // Schedule next evolution step
    if (this._stage < 3) {
      this._evolutionTimer = setTimeout(() => this._evolve(), this.config.evolutionInterval);
    }
  }

  /**
   * Pause evolution (e.g. when user hovers a card but hasn't committed).
   * The drone stays at its current level but stops evolving.
   */
  pauseEvolution() {
    this._paused = true;
    if (this._evolutionTimer) {
      clearTimeout(this._evolutionTimer);
      this._evolutionTimer = null;
    }
  }

  /**
   * Resume evolution from wherever it left off.
   */
  resumeEvolution() {
    if (!this._active || !this._paused) return;
    this._paused = false;
    if (this._stage < 3) {
      this._evolutionTimer = setTimeout(() => this._evolve(), this.config.evolutionInterval);
    }
  }

  /**
   * Reset evolution back to stage 0 (subtle drone).
   * Useful when the user interacts and you want the drone to settle.
   */
  resetEvolution(rampTime = 2.0) {
    if (!this._active) return;
    const engine = this._engine;
    this.pauseEvolution();
    this._stage = 0;

    engine.rampTo(this._filter.frequency, this.config.filterStart, rampTime);
    engine.rampTo(this._layerGain.gain, this.config.initialVolume, rampTime);
    if (this._harmonicSource) {
      engine.rampTo(this._harmonicSource.gain.gain, 0, rampTime);
    }
  }

  /**
   * Fade out and stop the drone entirely.
   * @param {number} duration — fade-out time in seconds
   * @returns {Promise} resolves when fade is complete
   */
  fadeOut(duration = null) {
    const fadeDur = duration ?? this.config.fadeOutTime;
    return new Promise(resolve => {
      if (!this._active || !this._layerGain) {
        resolve();
        return;
      }

      this.pauseEvolution();
      const engine = this._engine;

      // Fade the layer gain to 0
      engine.linearRamp(this._layerGain.gain, 0, fadeDur);

      // Clean up after fade
      setTimeout(() => {
        this._cleanup();
        resolve();
      }, fadeDur * 1000 + 100);
    });
  }

  /**
   * Immediately stop everything.
   */
  stop() {
    this.pauseEvolution();
    this._cleanup();
  }

  _cleanup() {
    if (this._baseSource) {
      this._engine.stop(this._baseSource.id, 0.05);
      this._baseSource = null;
    }
    if (this._harmonicSource) {
      this._engine.stop(this._harmonicSource.id, 0.05);
      this._harmonicSource = null;
    }
    if (this._layerGain) {
      this._layerGain.disconnect();
      this._layerGain = null;
    }
    if (this._filter) {
      this._filter.disconnect();
      this._filter = null;
    }
    this._active = false;
    this._stage = 0;
  }
}
