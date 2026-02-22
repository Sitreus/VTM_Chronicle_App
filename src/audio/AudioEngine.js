/**
 * AudioEngine — Core Web Audio API engine for World of Darkness Chronicle App
 *
 * Manages the AudioContext, master bus, buffer loading/caching,
 * gain routing, and crossfade utilities. All audio layers connect
 * through this engine.
 *
 * Architecture:
 *   Source nodes → Layer gain → Master gain → Destination
 *
 * Usage:
 *   const engine = new AudioEngine();
 *   await engine.init();          // Must be called after user gesture
 *   await engine.loadBuffer('drone_vtm', '/audio/drone_vtm.ogg');
 *   engine.setMasterVolume(0.8);
 */

export default class AudioEngine {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._bufferCache = new Map();    // name → AudioBuffer
    this._activeSources = new Map();  // id → { source, gain, startedAt }
    this._initialized = false;
    this._suspended = false;
    this._masterVolume = 0.8;
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Initialize the AudioContext. Must be called from a user gesture
   * (click/keydown) to satisfy browser autoplay policy.
   */
  async init() {
    if (this._initialized) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      console.warn('[AudioEngine] Web Audio API not supported');
      return;
    }

    this._ctx = new AudioCtx();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._masterVolume;
    this._masterGain.connect(this._ctx.destination);
    this._initialized = true;

    // Resume if suspended (common on first user gesture)
    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }
  }

  /**
   * Ensure context is running. Call this on user interactions
   * to handle browser autoplay restrictions.
   */
  async resume() {
    if (!this._ctx) return;
    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }
  }

  /**
   * Suspend audio processing (e.g. when tab is hidden).
   */
  async suspend() {
    if (!this._ctx || this._ctx.state !== 'running') return;
    await this._ctx.suspend();
    this._suspended = true;
  }

  /**
   * Tear down the engine and release all resources.
   */
  async destroy() {
    this.stopAll();
    this._bufferCache.clear();
    if (this._ctx) {
      await this._ctx.close();
      this._ctx = null;
    }
    this._initialized = false;
  }

  get context() { return this._ctx; }
  get masterGain() { return this._masterGain; }
  get currentTime() { return this._ctx ? this._ctx.currentTime : 0; }
  get isReady() { return this._initialized && this._ctx?.state === 'running'; }

  // ─── Master Volume ──────────────────────────────────────────

  setMasterVolume(value, rampTime = 0.05) {
    this._masterVolume = Math.max(0, Math.min(1, value));
    if (!this._masterGain) return;
    this._masterGain.gain.cancelScheduledValues(this.currentTime);
    this._masterGain.gain.setTargetAtTime(this._masterVolume, this.currentTime, rampTime);
  }

  getMasterVolume() {
    return this._masterVolume;
  }

  // ─── Buffer Loading ─────────────────────────────────────────

  /**
   * Load an audio file into a cached AudioBuffer.
   * @param {string} name  — cache key for this buffer
   * @param {string} url   — path to audio file (e.g. '/audio/drone.ogg')
   * @returns {AudioBuffer}
   */
  async loadBuffer(name, url) {
    if (this._bufferCache.has(name)) return this._bufferCache.get(name);
    if (!this._ctx) throw new Error('[AudioEngine] Not initialized');

    const response = await fetch(url);
    if (!response.ok) throw new Error(`[AudioEngine] Failed to load ${url}: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this._ctx.decodeAudioData(arrayBuffer);
    this._bufferCache.set(name, audioBuffer);
    return audioBuffer;
  }

  /**
   * Preload multiple buffers in parallel.
   * @param {Array<{name: string, url: string}>} manifest
   * @returns {Map<string, AudioBuffer>}
   */
  async loadManifest(manifest) {
    const results = await Promise.allSettled(
      manifest.map(({ name, url }) => this.loadBuffer(name, url))
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.warn(`[AudioEngine] Failed to load "${manifest[i].name}":`, result.reason);
      }
    });
    return this._bufferCache;
  }

  /**
   * Get a previously loaded buffer by name.
   */
  getBuffer(name) {
    return this._bufferCache.get(name) || null;
  }

  /**
   * Check if a buffer is loaded.
   */
  hasBuffer(name) {
    return this._bufferCache.has(name);
  }

  // ─── Gain Node Factory ──────────────────────────────────────

  /**
   * Create a GainNode connected to the master bus.
   * Layers use this to create their own sub-buses.
   */
  createGain(initialValue = 1) {
    if (!this._ctx) return null;
    const gain = this._ctx.createGain();
    gain.gain.value = initialValue;
    gain.connect(this._masterGain);
    return gain;
  }

  /**
   * Create a GainNode connected to a custom destination.
   */
  createGainTo(destination, initialValue = 1) {
    if (!this._ctx) return null;
    const gain = this._ctx.createGain();
    gain.gain.value = initialValue;
    gain.connect(destination);
    return gain;
  }

  // ─── Source Playback ────────────────────────────────────────

  /**
   * Play a loaded buffer through a gain node.
   * Returns a handle { source, gain, id } for further control.
   *
   * @param {string} bufferName   — name of a previously loaded buffer
   * @param {Object} options
   * @param {GainNode} options.output   — destination gain (defaults to master)
   * @param {boolean}  options.loop     — loop the source
   * @param {number}   options.volume   — initial volume 0-1
   * @param {number}   options.fadeIn   — fade-in duration in seconds
   * @param {number}   options.offset   — start offset in seconds
   * @param {number}   options.playbackRate — playback rate multiplier
   * @returns {{ source: AudioBufferSourceNode, gain: GainNode, id: string }}
   */
  play(bufferName, options = {}) {
    const buffer = this.getBuffer(bufferName);
    if (!buffer || !this._ctx) return null;

    const {
      output = this._masterGain,
      loop = false,
      volume = 1,
      fadeIn = 0,
      offset = 0,
      playbackRate = 1,
    } = options;

    const gain = this._ctx.createGain();
    gain.connect(output);

    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = playbackRate;
    source.connect(gain);

    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, this.currentTime);
      gain.gain.linearRampToValueAtTime(volume, this.currentTime + fadeIn);
    } else {
      gain.gain.setValueAtTime(volume, this.currentTime);
    }

    const id = `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this._activeSources.set(id, { source, gain, startedAt: this.currentTime });

    source.onended = () => {
      this._activeSources.delete(id);
    };

    source.start(0, offset);
    return { source, gain, id };
  }

  /**
   * Stop a source by its id with optional fade-out.
   */
  stop(id, fadeOut = 0) {
    const entry = this._activeSources.get(id);
    if (!entry) return;

    const { source, gain } = entry;
    if (fadeOut > 0) {
      gain.gain.cancelScheduledValues(this.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, this.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.currentTime + fadeOut);
      source.stop(this.currentTime + fadeOut + 0.05);
    } else {
      source.stop();
    }
    this._activeSources.delete(id);
  }

  /**
   * Stop all active sources.
   */
  stopAll(fadeOut = 0.1) {
    for (const [id] of this._activeSources) {
      this.stop(id, fadeOut);
    }
  }

  // ─── Crossfade Utility ──────────────────────────────────────

  /**
   * Crossfade between two gain nodes over a duration.
   * Uses equal-power crossfade for perceptually smooth transitions.
   *
   * @param {GainNode} fromGain  — the outgoing gain node
   * @param {GainNode} toGain    — the incoming gain node
   * @param {number}   duration  — crossfade duration in seconds
   * @param {number}   fromLevel — starting level of fromGain (default: current)
   * @param {number}   toLevel   — target level of toGain (default: 1)
   */
  crossfade(fromGain, toGain, duration, fromLevel = null, toLevel = 1) {
    if (!this._ctx) return;
    const now = this.currentTime;
    const startLevel = fromLevel !== null ? fromLevel : fromGain.gain.value;

    // Equal-power curve: use setValueCurveAtTime for smooth fades
    fromGain.gain.cancelScheduledValues(now);
    toGain.gain.cancelScheduledValues(now);

    fromGain.gain.setValueAtTime(startLevel, now);
    fromGain.gain.linearRampToValueAtTime(0, now + duration);

    toGain.gain.setValueAtTime(0, now);
    toGain.gain.linearRampToValueAtTime(toLevel, now + duration);
  }

  // ─── Automation Helpers ─────────────────────────────────────

  /**
   * Smoothly ramp a parameter to a target value.
   * Uses exponential approach (setTargetAtTime) for natural feel.
   *
   * @param {AudioParam} param    — e.g. gainNode.gain, filter.frequency
   * @param {number}     target   — target value
   * @param {number}     timeConstant — time constant in seconds (smaller = faster)
   */
  rampTo(param, target, timeConstant = 0.5) {
    if (!this._ctx) return;
    param.cancelScheduledValues(this.currentTime);
    param.setTargetAtTime(target, this.currentTime, timeConstant);
  }

  /**
   * Schedule a linear ramp on a parameter.
   */
  linearRamp(param, target, duration) {
    if (!this._ctx) return;
    param.cancelScheduledValues(this.currentTime);
    param.setValueAtTime(param.value, this.currentTime);
    param.linearRampToValueAtTime(target, this.currentTime + duration);
  }

  // ─── Filter Factory ─────────────────────────────────────────

  /**
   * Create a BiquadFilterNode (useful for drone evolution, EQ, etc.).
   */
  createFilter(type = 'lowpass', frequency = 1000, Q = 1) {
    if (!this._ctx) return null;
    const filter = this._ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = Q;
    return filter;
  }
}
