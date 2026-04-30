/**
 * Web Worker that computes a spectrogram from raw PCM samples.
 *
 * Receives a Float32Array of mono samples (transferable) plus analysis
 * parameters, and posts back a single Uint8Array containing all frames
 * concatenated. The main thread reconstructs per-frame views without copying.
 *
 * Why a worker:
 *   - FFT analysis is CPU-bound and was previously blocking the main thread.
 *   - Doing it in a worker keeps the UI responsive during load and lets us
 *     run multiple spectrograms concurrently.
 *
 * Why no OfflineAudioContext:
 *   - The previous implementation rendered an offline graph just to read its
 *     AnalyserNode, which is wasted work. We already have the decoded PCM,
 *     so we can window + FFT it directly. This was the dominant cost in
 *     Safari, where suspend(time).then(...) per-frame is especially slow.
 */

import FFT from 'fft.js'

/**
 * Precomputed Blackman window cache, keyed by fftSize. The window
 * coefficients are constant for a given fftSize, so there is no reason to
 * recompute Math.cos for every sample of every frame.
 */
const blackmanCache = new Map()

function getBlackmanWindow(fftSize) {
  const cached = blackmanCache.get(fftSize)
  if (cached) return cached

  const alpha = 0.16
  const a0 = (1 - alpha) / 2
  const a1 = 0.5
  const a2 = alpha / 2
  const window = new Float32Array(fftSize)
  const denom = fftSize - 1
  for (let n = 0; n < fftSize; n++) {
    window[n] =
      a0 -
      a1 * Math.cos((2 * Math.PI * n) / denom) +
      a2 * Math.cos((4 * Math.PI * n) / denom)
  }
  blackmanCache.set(fftSize, window)
  return window
}

/**
 * Convert linear magnitude to a 0–255 byte using a fixed dB range.
 * Matches the convention used by Web Audio's AnalyserNode#getByteFrequencyData
 * so downstream rendering code keeps working without tuning.
 *
 *   minDecibels = -100 dB → 0
 *   maxDecibels =  -30 dB → 255
 */
function magnitudeToByte(magnitude, minDecibels, maxDecibels) {
  // 20*log10(mag); guard against log10(0).
  const db = 20 * Math.log10(magnitude > 1e-12 ? magnitude : 1e-12)
  const range = maxDecibels - minDecibels
  const normalized = ((db - minDecibels) / range) * 255
  if (normalized < 0) return 0
  if (normalized > 255) return 255
  return normalized | 0
}

self.onmessage = (event) => {
  const {
    samples,            // Float32Array of mono PCM samples
    sampleRate,
    sampleTimeLength,
    fftSize,
    maxFrequency,
    smoothingTimeConstant,
    minDecibels = -100,
    maxDecibels = -30,
  } = event.data

  // `hop` is the stride between consecutive frame *starts*. Each frame still
  // reads a full `fftSize`-sample window from `samples`, so consecutive frames
  // overlap when fftSize > hop (which is the normal case at 1/60s frames and
  // fftSize=2048). This is the standard STFT with overlap, and it's what
  // AnalyserNode does internally. Without overlap, applying a tapered window
  // to only the first `hop` samples (and zero-padding the rest) introduces
  // DC bias and severe spectral leakage on transients — visible as vertical
  // halos through the spectrogram.
  const hop = Math.floor(sampleRate * sampleTimeLength)
  const totalDuration = samples.length / sampleRate
  const numFrames = Math.ceil(totalDuration / sampleTimeLength)

  const halfFft = fftSize / 2

  // Frequency bin span in Hz, and how many bins fall under maxFrequency.
  const frequencyBandSize = sampleRate / fftSize
  const frequencyBinCount = Math.min(
    halfFft,
    Math.ceil(maxFrequency / frequencyBandSize),
  )

  // One contiguous output buffer holding all frames back-to-back.
  // The main thread can create subarray views per frame for free.
  const output = new Uint8Array(numFrames * frequencyBinCount)

  // Reused per-frame buffers — no allocation in the hot loop.
  const fft = new FFT(fftSize)
  const window = getBlackmanWindow(fftSize)
  const input = new Float32Array(fftSize)
  const complex = fft.createComplexArray()
  const previousMagnitudes = new Float32Array(halfFft)

  const oneMinusSmoothing = 1 - smoothingTimeConstant
  // Normalize FFT magnitudes by fftSize so the dB scale is stable across
  // different fftSize values.
  const magnitudeScale = 1 / fftSize

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hop
    // Read a full fftSize-length window from `samples`, applying the
    // precomputed Blackman taper. Zero-pad past end-of-audio.
    const available = Math.min(fftSize, samples.length - start)
    for (let n = 0; n < available; n++) {
      input[n] = samples[start + n] * window[n]
    }
    for (let n = available; n < fftSize; n++) {
      input[n] = 0
    }

    fft.realTransform(complex, input)
    // realTransform only fills the first half of `complex`; the upper half
    // is the complex conjugate and we don't need it.

    const outOffset = frame * frequencyBinCount
    for (let bin = 0; bin < frequencyBinCount; bin++) {
      const re = complex[2 * bin]
      const im = complex[2 * bin + 1]
      const magnitude = Math.sqrt(re * re + im * im) * magnitudeScale

      // Exponential moving average across frames (matches AnalyserNode's
      // smoothingTimeConstant semantics).
      const smoothed =
        smoothingTimeConstant * previousMagnitudes[bin] +
        oneMinusSmoothing * magnitude
      previousMagnitudes[bin] = smoothed

      output[outOffset + bin] = magnitudeToByte(
        smoothed,
        minDecibels,
        maxDecibels,
      )
    }
  }

  self.postMessage(
    {
      output,
      numFrames,
      frequencyBinCount,
      frequencyBandSize,
      duration: totalDuration,
    },
    [output.buffer],
  )
}
