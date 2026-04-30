import { FrequencyData } from './frequency-data.js'

/**
 * Computes a spectrogram from an AudioBuffer by offloading FFT work to a
 * Web Worker. The main thread stays responsive while analysis runs.
 *
 * The worker handles:
 *   - Blackman windowing (precomputed once per fftSize)
 *   - Real FFT via fft.js
 *   - Magnitude → byte conversion using a fixed dB range
 *   - Inter-frame smoothing
 */
class FastFrequencyAnalyzer {
  /**
   * @param {!AudioBuffer} audioBuffer
   */
  constructor(audioBuffer) {
    this.audioBuffer = audioBuffer
  }

  /**
   * @param {{
   *   sampleTimeLength?: number,
   *   fftSize?: number,
   *   maxFrequency?: number,
   *   smoothingTimeConstant?: number,
   * }=} options
   * @return {!Promise<!FrequencyData>}
   */
  getFrequencyData({
    sampleTimeLength = 1 / 60,
    fftSize = 2 ** 11,
    maxFrequency = 44100 / 2,
    smoothingTimeConstant = 0.5,
  } = {}) {
    // Pull channel 0 as a Float32Array. We copy here (rather than transfer
    // the underlying AudioBuffer storage) because the AudioBuffer may still
    // be needed for playback after analysis.
    const sourceChannel = this.audioBuffer.getChannelData(0)
    const samples = new Float32Array(sourceChannel.length)
    samples.set(sourceChannel)

    const sampleRate = this.audioBuffer.sampleRate
    const effectiveMaxFrequency = Math.min(sampleRate / 2, maxFrequency)

    return new Promise((resolve, reject) => {
      // Vite resolves this URL at build time and bundles the worker.
      const worker = new Worker(
        new URL('./analyzer-worker.js', import.meta.url),
        { type: 'module' },
      )

      worker.onmessage = ({ data }) => {
        const {
          output,
          numFrames,
          frequencyBinCount,
          frequencyBandSize,
          duration,
        } = data

        // Reconstruct per-frame views into the single returned buffer.
        // Subarray is a view, not a copy.
        const frames = new Array(numFrames)
        for (let i = 0; i < numFrames; i++) {
          frames[i] = output.subarray(
            i * frequencyBinCount,
            (i + 1) * frequencyBinCount,
          )
        }

        worker.terminate()
        resolve(
          new FrequencyData({
            data         : frames,
            minFrequency : 0,
            maxFrequency : effectiveMaxFrequency,
            frequencyBandSize,
            frequencyBinCount,
            sampleTimeLength,
            duration,
          }),
        )
      }

      worker.onerror = (err) => {
        worker.terminate()
        reject(err)
      }

      worker.postMessage(
        {
          samples,
          sampleRate,
          sampleTimeLength,
          fftSize,
          maxFrequency: effectiveMaxFrequency,
          smoothingTimeConstant,
        },
        [samples.buffer], // transferable: zero-copy hand-off
      )
    })
  }
}

export { FastFrequencyAnalyzer }
