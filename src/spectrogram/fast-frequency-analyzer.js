import FFT from 'fft.js'
import { FrequencyData } from './frequency-data.js'

class FastFrequencyAnalyzer {
  constructor(audioBuffer, sampleTimeLength = 1 / 60) {
    this.audioBuffer = audioBuffer
    this.sampleTimeLength = sampleTimeLength
    this.sampleSize = Math.floor(audioBuffer.sampleRate * sampleTimeLength)
  }

  async getFrequencyData({
    sampleTimeLength = 1 / 60,
    fftSize = 2 ** 11,
    maxFrequency = 44100 / 2,
    smoothingTimeConstant = 0.5,
  } = {}) {
    const sampleSize = Math.floor(
      this.audioBuffer.sampleRate * sampleTimeLength)
    const offlineContext = new OfflineAudioContext(
      this.audioBuffer.numberOfChannels,
      this.audioBuffer.length,
      this.audioBuffer.sampleRate
    )
    const audioBufferSource = offlineContext.createBufferSource()
    audioBufferSource.buffer = this.audioBuffer
    audioBufferSource.connect(offlineContext.destination)
    audioBufferSource.start()

    await offlineContext.startRendering()

    const totalTimeLength = this.audioBuffer.duration
    const steps = Math.ceil(totalTimeLength / sampleTimeLength)
    const results = []

    let previousSpectrum = new Float32Array(fftSize / 2)

    for (let i = 0; i < steps; i++) {
      const startSample = i * sampleSize
      const endSample = Math.min((i + 1) * sampleSize, this.audioBuffer.length)
      const inputArray = this.audioBuffer
        .getChannelData(0)
        .slice(startSample, endSample)
      const windowedArray = this.applyBlackmanWindow(inputArray, fftSize)
      const fftArray = this.customFFT(windowedArray, fftSize)

      // Apply smoothing
      for (let j = 0; j < fftArray.length; j++) {
        fftArray[j] =
          smoothingTimeConstant * previousSpectrum[j] +
          (1 - smoothingTimeConstant) * fftArray[j]
      }
      previousSpectrum = fftArray

      const frequencyData = this.fftToFrequencyData(fftArray, maxFrequency)
      results.push(frequencyData)
    }

    return new FrequencyData({
      data              : results,
      minFrequency      : 0,
      maxFrequency,
      frequencyBandSize : this.audioBuffer.sampleRate / fftSize,
      frequencyBinCount : results[0].length,
      sampleTimeLength,
      duration          : audioBufferSource.buffer.duration,
    })
  }


  /**
   * The Blackman window function is applied to the input signal before 
   * performing the FFT. It reduces spectral leakage, which occurs when 
   * a signal is not perfectly periodic within the analyzed window.
   * 
   * The Blackman window is defined by the following equation:
   * w(n) = a0 - a1 * cos((2 * pi * n) / 
   *        (N - 1)) + a2 * cos((4 * pi * n) / 
   *        (N - 1))
   * where N is the window size (sample size) and n is the sample index.
   * 
   * The constants a0, a1, and a2 are defined as:
   * a0 = (1 - alpha) / 2
   * a1 = 1 / 2
   * a2 = alpha / 2
   * 
   * The 'alpha' parameter is a design choice and is usually set to 0.16.
   * 
   * @param {number} sampleIndex The index of the sample in the input signal.
   * @param {number} sampleSize The window size (the number of samples in 
   *     the input signal).
   * @return {number} The Blackman window function value at the given sample 
   *     index.
   */
  blackmanWindow(sampleIndex, sampleSize) {
    const alpha = 0.16
    const a0 = (1 - alpha) / 2
    const a1 = 0.5
    const a2 = alpha / 2

    return (
      a0 -
      a1 * Math.cos((2 * Math.PI * sampleIndex) / (sampleSize - 1)) +
      a2 * Math.cos((4 * Math.PI * sampleIndex) / (sampleSize - 1))
    )
  }

  applyBlackmanWindow(inputArray, fftSize) {
    const outputArray = new Float32Array(fftSize)
    for (let i = 0; i < inputArray.length; i++) {
      outputArray[i] = inputArray[i] 
        * this.blackmanWindow(i, inputArray.length)
    }
    return outputArray
  }

  customFFT(inputArray, fftSize) {
    const fft = new FFT(fftSize)
    const inputPadded = new Float32Array(fftSize)
    inputPadded.set(inputArray)

    const outputArray = fft.createComplexArray()
    fft.realTransform(outputArray, inputPadded)
    const spectrum = fft.fromComplexArray(outputArray).map((value, index) => {
      // Convert complex numbers to magnitude
      return Math.sqrt(Math.pow(value, 2) + Math.pow(outputArray[index], 2))
    })

    return spectrum.slice(0, fftSize / 2)
  }

  fftToFrequencyData(spectrum, maxFrequency) {
    const numBins = Math.floor((maxFrequency * spectrum.length * 2) 
      / this.audioBuffer.sampleRate)
    const frequencyData = new Uint8Array(numBins)

    // Find the maximum value in the spectrum
    const maxSpectrumValue = Math.max(...spectrum)
    
    for (let i = 0; i < numBins; i++) {
      // Normalize decibel values to the range of 0 to 255
      frequencyData[i] = Math.min(
        255, 
        Math.max(
          0, 
          (Math.log10(spectrum[i]) / Math.log10(maxSpectrumValue)) * 255))
    }

    return frequencyData
  }

  getNextPowerOfTwo(value) {
    return Math.pow(2, Math.ceil(Math.log(value) / Math.log(2)))
  }
}

export { FastFrequencyAnalyzer }

