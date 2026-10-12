export class PondAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: AudioBufferSourceNode | null = null;
  private loading: Promise<void> | null = null;
  private noise: AudioBuffer | null = null;
  private abort = new AbortController();
  private disposed = false;
  private lastRelease = -10;
  private startedAt = 0;
  private effects = new Set<AudioScheduledSourceNode>();
  releaseSounds = 0;
  enabled = false;

  async setEnabled(enabled: boolean) {
    if (this.disposed) return;
    this.enabled = enabled;
    if (!enabled) {
      if (this.context && this.master) this.master.gain.setTargetAtTime(0, this.context.currentTime, .09);
      return;
    }
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    await this.context.resume();
    if (!this.enabled || this.disposed) return;
    this.master!.gain.setTargetAtTime(.5, this.context.currentTime, .35);
    if (!this.music && !this.loading) this.loading = this.loadMusic().finally(() => { this.loading = null; });
    if (this.loading) await this.loading;
  }

  private async loadMusic() {
    const response = await fetch('/audio/quiet-pond.mp3', { signal: this.abort.signal });
    if (!response.ok) throw new Error('配樂載入失敗');
    const bytes = await response.arrayBuffer();
    if (this.disposed) return;
    const decoded = await this.context!.decodeAudioData(bytes);
    if (this.disposed) return;
    // Remove codec-boundary discontinuities before the sample-accurate Web Audio loop.
    const overlap = Math.min(2048, Math.floor(decoded.length / 8));
    const buffer = this.context!.createBuffer(decoded.numberOfChannels, decoded.length - overlap, decoded.sampleRate);
    for(let channel=0;channel<decoded.numberOfChannels;channel++){
      const input=decoded.getChannelData(channel),output=buffer.getChannelData(channel);
      const middle=decoded.length-2*overlap;
      output.set(input.subarray(overlap,decoded.length-overlap));
      for(let i=0;i<overlap;i++){const mix=i/(overlap-1);output[middle+i]=input[decoded.length-overlap+i]*(1-mix)+input[i]*mix;}
    }
    const source = this.context!.createBufferSource();
    source.buffer = buffer; source.loop = true; source.loopStart = 0; source.loopEnd = buffer.duration;
    const gain = this.context!.createGain(); gain.gain.value = .65;
    source.connect(gain).connect(this.master!); source.start();
    this.startedAt = this.context!.currentTime; this.music = source;
  }

  splash(strength = .5) {
    if (!this.enabled || !this.context || !this.master || this.disposed) return;
    this.drop(this.context.currentTime, strength, 450 + Math.random() * 220);
  }

  private drop(time: number, strength: number, frequency: number) {
    const context = this.context!;
    const osc = context.createOscillator(), gain = context.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(frequency, time);
    osc.frequency.exponentialRampToValueAtTime(frequency * .29, time + .21);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(strength * .11, time + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .32);
    osc.connect(gain).connect(this.master!); this.effects.add(osc);
    osc.start(time); osc.stop(time + .34);
    osc.onended = () => { this.effects.delete(osc); osc.disconnect(); gain.disconnect(); };
  }

  fishChange(added: boolean, count: number) {
    if (!this.enabled || !this.context || !this.master || !this.noise || this.disposed) return;
    const time = this.context.currentTime;
    if (time - this.lastRelease < .22) return;
    this.lastRelease = time; this.releaseSounds++;
    const strength = Math.min(.7, .3 + Math.sqrt(count) * .08);
    const source = this.context.createBufferSource(); source.buffer = this.noise;
    const filter = this.context.createBiquadFilter(); filter.type = 'lowpass';
    filter.frequency.setValueAtTime(added ? 1900 : 750, time);
    filter.frequency.exponentialRampToValueAtTime(160, time + .5);
    const gain = this.context.createGain(); gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(strength * (added ? .21 : .1), time + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .65);
    source.connect(filter).connect(gain).connect(this.master);
    this.effects.add(source); source.start(time); source.stop(time + .7);
    source.onended = () => { this.effects.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    for (let i = 0; i < 3; i++) this.drop(time + i * .085, strength * (added ? .8 : .45), (added ? 320 : 230) + i * 140);
  }

  inspect() {
    const duration = this.music?.buffer?.duration ?? 0;
    const elapsed = this.context ? this.context.currentTime - this.startedAt : 0;
    return { enabled: this.enabled, loaded: !!this.music, loop: this.music?.loop ?? false, duration, position: duration ? elapsed % duration : 0, loops: duration ? Math.floor(elapsed / duration) : 0, releaseSounds: this.releaseSounds };
  }
  dispose() {
    this.disposed = true; this.abort.abort(); this.music?.stop();
    this.effects.forEach(source => { try { source.stop(); } catch { /* Already ended. */ } });
    this.effects.clear(); void this.context?.close();
  }
}
