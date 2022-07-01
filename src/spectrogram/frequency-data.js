class FrequencyData {
  /**
   * @param {{
   *     data: !Array<!Uint8Array>
   *     minFrequency: number,
   *     maxFrequency: number,
   *     frequencyBandSize: number,
   *     frequencyBinCount: number,
   *     sampleTimeLength: number,
   *     duration: number,
   *     }} params
   */
  constructor({
    data,
    minFrequency,
    maxFrequency,
    frequencyBandSize,
    frequencyBinCount,
    sampleTimeLength,
    duration,
  }) {

    /**  
     *  An array of frequency samples; each sample is a normalized array of
     *  decibel values between 0 and 255. The frequencies are spread linearly 
     *  from 0 to 1/2 
     *  of the sample rate.
     *  @type {!Array<!Uint8Array>}
     *  @public
     */ 
    this.data = data

    /**
     * The min frequency used for analysis (lowest frequency bucket in {@link 
     * FrequencyData#data}).
     * @type {number}
     * @public
     */
    this.minFrequency = minFrequency

    /**
     * The max frequency used for analysis (highest frequency bucket in {@link 
     * FrequencyData#data}).
     * @type {number}
     * @public
     */
    this.maxFrequency =    maxFrequency

    /**
     * The frequency covered in each bin in {@link FrequencyData#data}).
     * @type {number}
     * @public
     */
    this.frequencyBandSize = frequencyBandSize

    /**
     * Number of frequency bins for each time sample in {@link 
     * FrequencyData#data}).
     * @type {number}
     * @public
     */
    this.frequencyBinCount = frequencyBinCount

    /**
     * Length of each individual sample in {@link FrequencyData#data}) in
     * seconds.
     * @type {number}
     * @public
     */
    this.sampleTimeLength = sampleTimeLength

    /**
     * Total length of {@link FrequencyData#data}) in seconds.
     * @type {number}
     * @public
     */
    this.duration = duration
  }

  /**
   * @param {number} binIndex
   * @return {number} Frequency at the given bin index.
   */
  frequencyAtBin(binIndex) {
    return this.minFrequency + (this.frequencyBandSize * binIndex)
  }

  /**
   * @param {number} binIndex
   * @return {number} Timestamp (in seconds) at the given sample index.
   */
  timeAtSample(sampleIndex) {
    return sampleIndex * this.sampleTimeLength
  }
}

export {FrequencyData}