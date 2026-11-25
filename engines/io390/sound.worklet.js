// Runs on the Web Audio rendering thread. Dimensions, decay times and mix are illustrative (see SOURCES.md).
// Each bank has an outgoing pressure wave and a damped, inverted return from the pipe opening.
class ExhaustHeader {
  constructor(lengthM) {
    const transit = Math.max(1, Math.round((sampleRate * lengthM) / 510)); // assumed hot-gas sound speed, m/s
    this.line = new Float32Array(2 * transit);
    this.outlet = transit;
    this.inlet = 0;
    this.pressure = 0;
  }

  sample(decay) {
    const wave = this.line[this.outlet];
    this.line[this.inlet] = this.pressure - 0.52 * this.line[this.inlet];
    this.pressure *= decay;
    if (++this.inlet === this.line.length) this.inlet = 0;
    if (++this.outlet === this.line.length) this.outlet = 0;
    return wave;
  }
}

class Io390Processor extends AudioWorkletProcessor {
  constructor({ processorOptions }) {
    super();
    this.layout = processorOptions;
    this.slotDegrees = 720 / this.layout.leftBank.length;
    this.left = new ExhaustHeader(0.91); // crossover under the sump
    this.right = new ExhaustHeader(0.41);
    this.rpm = 0;
    this.phase = 0; // crank degrees relative to cylinder one's exhaust opening
    this.motorPhase = 0;
    this.muffler = 0;
    this.dc = 0;
    this.wind = 0;
    this.gain = 0;
    this.randomState = 390;
    const smoothing = (seconds) => 1 - Math.exp(-1 / (sampleRate * seconds));
    this.track = smoothing(0.018);
    this.fade = smoothing(0.006);
    this.lowpass = smoothing(1 / (2 * Math.PI * 1150));
    this.highpass = smoothing(1 / (2 * Math.PI * 28));
    this.windFilter = smoothing(1 / (2 * Math.PI * 900));
    this.port.onmessage = ({ data }) => {
      if (data && (!this.frame || data.reset)) {
        this.phase = (data.crank - this.layout.exhaustOpen + 720) % 720;
        this.rpm = data.rpm;
      }
      // Keep the last operating point through the short mute fade.
      this.audible = !!data && data.rpm > 0;
      if (data) this.frame = data;
    };
  }

  noise() {
    this.randomState = (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  process(_inputs, outputs) {
    const output = outputs[0][0];
    if (!this.frame || (!this.audible && this.gain < 0.0001)) return true;
    const { rpm, pulses, starter, load } = this.frame;
    const { leftBank, blades, starterRatio, ratedRpm } = this.layout;
    // Blowdown lasts a few crank degrees, with a finite release time at cranking speed.
    const decay = Math.exp(-1 / (sampleRate * Math.min(0.009, 22 / (6 * Math.max(1, rpm)))));
    for (let i = 0; i < output.length; i++) {
      this.rpm += this.track * (rpm - this.rpm);
      const degrees = (this.rpm * 6) / sampleRate;
      const lastSlot = Math.floor(this.phase / this.slotDegrees);
      this.phase = (this.phase + degrees) % 720;
      const slot = Math.floor(this.phase / this.slotDegrees);
      const speed = Math.min(this.rpm / ratedRpm, 1.3);
      if (slot !== lastSlot) {
        const { chance, strength } = pulses[slot];
        const burn = this.noise() < chance ? strength * (0.9 + 0.2 * this.noise()) : 0;
        // Even a motored cylinder displaces a little air on its exhaust stroke.
        const header = leftBank[slot] ? this.left : this.right;
        header.pressure += burn + 0.07 * speed;
      }
      const exhaust = this.left.sample(decay) + this.right.sample(decay);
      const noise = 2 * this.noise() - 1;
      this.wind += this.windFilter * (noise - this.wind);
      this.muffler += this.lowpass * (exhaust * (1 + 0.32 * this.wind) - this.muffler);
      this.dc += this.highpass * (this.muffler - this.dc);

      // Direct drive: every blade passage carries a loading tone and a burst of turbulent air.
      const bladeAngle = (this.phase * blades * Math.PI) / 180;
      const blade = Math.cos(bladeAngle);
      const prop =
        speed *
        speed *
        (0.4 + 0.6 * load) *
        (0.22 * blade + 0.08 * Math.cos(2 * bladeAngle) + (0.36 + 0.24 * blade) * this.wind);
      this.motorPhase = (this.motorPhase + (degrees * starterRatio * Math.PI) / 180) % (2 * Math.PI);
      let motor = 0;
      if (starter) {
        // Compression loads the motor twice per revolution. The upper harmonics make the whine audible at low rpm.
        const compression = Math.cos(((this.phase + this.layout.exhaustOpen) * Math.PI) / 90);
        motor =
          Math.min(1, this.rpm / 100) *
          (0.8 + 0.2 * compression) *
          (0.1 * Math.sin(this.motorPhase) +
            0.05 * Math.sin(3 * this.motorPhase) +
            0.045 * Math.sin(8 * this.motorPhase) +
            0.06 * this.wind);
      }
      this.gain += this.fade * (Number(this.audible) - this.gain);
      output[i] = this.gain * 0.78 * Math.tanh(1.5 * (this.muffler - this.dc) + prop + motor);
    }
    return true;
  }
}

registerProcessor("io390-sound", Io390Processor);
