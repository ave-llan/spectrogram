import * as d3Axis from 'd3-axis'
import * as d3Brush from 'd3-brush'
import * as d3Selection from 'd3-selection'
import * as d3Scale from 'd3-scale'
import {AudioData} from './audio-data.js'
import {PerformanceMeasure} from './performance-measure.js'
import {PlaybackOrchestrator} from './playback-orchestrator.js'
import {steelBlue} from '../resources/color.js'
import playIcon from '../resources/play_icon.svg'
import stopIcon from '../resources/stop_icon.svg'

class Spectrogram {
  constructor({
    audioData, 
    frequencyData,
    spectrogramElement,
    width, 
    height = 400,
    showAxes = true,
    scrolling = true,
    minFrequencyToRender = 440,
    maxFrequencyToRender = 10000,
    performanceMeasure
  }) {

    /** @type {!AudioData} */
    this.audioData = audioData,

    /**  @type {!Array<!FrequencyData>} */
    this.frequencyData = frequencyData,

    /** @type {number} Min frequency to display, in hertz. */
    this.minFrequencyToRender = minFrequencyToRender,
    /** @type {number} Max frequency to display, in hertz. */
    this.maxFrequencyToRender = maxFrequencyToRender

    this.container = spectrogramElement
      .append('div')
      .attr('class', 'spectrogramVisualizer')
 
    /** 
     * @type {number} width of the Spectrogram visualizer tool. If not set, uses
     *   the max width available to the element.
     */
    this.width = width || this.container.node().offsetWidth

    /** @type {number} height of the Spectrogram visualizer tool. */
    this.height = height

    /** @type {boolean} whether or not the axes should be shown. */
    this.showAxes = showAxes

    /** @type {!PerformanceMasure} */
    this.performanceMeasure = performanceMeasure || 
      new PerformanceMeasure(`${Math.random()}`)

    this.spectroMargin = {
      top    : 40, 
      right  : this.showAxes ? 20 : 0, 
      bottom : this.showAxes ? 40 : 0, 
      left   : this.showAxes ? 40 : 0,
    }

    /** The visible width of the spectrogram display. */
    this.spectroDisplayWidth = this.width 
        - this.spectroMargin.left - this.spectroMargin.right

    /** @type {number} Width of a second in spectrogram display. */
    this.pixelsPerSecond = scrolling 
      ? 100 
      : this.spectroDisplayWidth / this.frequencyData.duration
 
    /** The full width of the spectrogram display if fully rendered. */
    this.spectroFullWidth = scrolling 
      ? Math.round(this.pixelsPerSecond * this.frequencyData.duration)
      : this.spectroDisplayWidth
    /** The rendered height of the spectrogram display. */
    this.spectroHeight = this.height 
      - this.spectroMargin.top - this.spectroMargin.bottom

    /** @type {number} Left-most visible time on the tool. */
    this.spectroDisplayStartSeconds = 0

    this.displayState = new DisplayState()

    /** @type {!d3Selection.Selection} A div container for spectrogram tool. */
    this.container
      .style('width', `${this.width}px`)
      .style('height', `${this.height}px`)
      .style('position', 'relative')

    /** @type {!d3Selection.Selection} A canvas for drawing spectrogram data. */
    this.spectrogramCanvas = this.container
      .append('canvas')
      .attr('class', 'spectrogram')
      .attr('width', this.spectroFullWidth)
      .attr('height', this.spectroHeight)
      .style('position', 'absolute')
      .style('left', `${this.spectroMargin.left}px`)
      .style('top', `${this.spectroMargin.top}px`)

    /** @type {!CanvasRenderingContext2D} canvas context for spectrogram. */ 
    this.spectrogramCtx = this.spectrogramCanvas
      .node()
      .getContext('2d')

    // Create svg that will contain the axis
    this.svg = this.container
      .append('svg')
      .attr('class', 'spectrogramTool')
      .style('position', 'absolute')
      .attr('width', this.width)
      .attr('height', this.height)

    this.drawSpectrogram(this.displayState.getState())
    


    // PLAYBACK and ANIMATION.
    this.audioContext = new AudioContext()
    // Size of icons like the play button.
    this.iconSize = 30
    /** @type {number} padding around spectrogram */
    this.spectroPadding = 5

    /** @type {number} Last timestamp a user interacted with spectrogram. */
    this.lastUserInteractionTimestamp = 0

    this.playbackActive = false
    this.playbacknode,
    this.playbackLineAnimationId,
    /** @type {number} World time when playback started. */
    this.playbackStartedAt,
    /** @type {number} Time in audio clip where playback started. */
    this.timeInAudioClipWherePlaybackStarted

    /** @type {number} When (in seconds) to start playback */
    this.playbackSelectionStart = 0
    this.playbackSelectionEnd =  this.audioData.duration
    // Selection area in pixels.
    this.selectionStart = {x: 0, y: 0}
    this.selectionEnd = {x: this.spectroDisplayWidth, y: this.spectroHeight}

    // Create a new SVG overlay for selection UI. 
    this.selectionSvg = this.container
      .append('svg')
      .attr('class', 'selectionSvg')
      .style('position', 'absolute')
      .attr('width', this.spectroDisplayWidth)
      .attr('height', this.spectroHeight)
      .style('top', this.spectroMargin.top)
      .style('left', this.spectroMargin.left)

    this.playbackSelectionLine = this.selectionSvg
      .append('g')
      .attr('class', 'playbackSelectionLine')
      .append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', this.spectroHeight)
      .attr('stroke', 'grey')
      .attr('opacity', 0)

    this.playbackLine = this.selectionSvg
      .append('g')
      .attr('class', 'playbackPositionLine')
      .append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', this.spectroHeight)
      .attr('stroke', 'black')
      .attr('opacity', 0)

    this.playbackIcon = this.svg.append('g')
      .attr('class', 'play-icon button')
      .attr('transform', 
        `translate(
          ${this.width - (this.iconSize + this.spectroMargin.right)},
          ${this.spectroMargin.top - this.spectroPadding - this.iconSize})`
      )

    this.playbackIconImage = this.playbackIcon.append('image')
      .attr('id', 'playback-icon')
      .attr('width', this.iconSize)
      .attr('height', this.iconSize)
      .attr('xlink:href', playIcon)
      .attr('opacity', 0.25)

    // Add event listeners for playback.
    this.playbackIcon
      .on('click', (event) => {
        this.markInteractionTime()

        event.stopPropagation()
        this.togglePlayback()
      })

    /** @const {!Function} D3 brush UI controller for selecting a
     *      two-dimensional region by clicking and dragging the mouse.
     */
    this.playbackAreaSelectionBrush = d3Brush.brush()

    // Activate brush on selection svg.
    this.selectionSvg
      .call(this.playbackAreaSelectionBrush)

    // At start of brush, capture beginning x1 position in case the user does
    // not drag (and we want to set playbackSelectionLine)
    this.playbackAreaSelectionBrush
      .on('start', ({selection}) => {
        this.markInteractionTime()

        const playbackWasActive = this.playbackActive
        if (playbackWasActive) {
          // Stop current playback.
          this.togglePlayback()
        }
        
        // Hide previously selection playback line if it was visible, as the
        // user is making a new selection.
        this.playbackSelectionLine
          .attr('opacity', 0)

        // Selection contains [[x1, y1], [x2, y2]] but we only need x1.
        const [[x1]] = selection 
        // Reset selection from x1 to end in case user does not drag to make
        // a more specific selection.
        this.selectionStart.x = x1
        this.selectionStart.y = 0
        this.selectionEnd.x = this.spectroDisplayWidth
        this.selectionEnd.y = this.spectroHeight
        this.setPlaybackTimerangeFromSelectionPoint(this.selectionStart.x)
      })

    // Add event listern for playbackSelectionLine based on end of brush event.
    // If there is no selection at the end, instead set the time based 
    // playback selection line.
    this.playbackAreaSelectionBrush
      .on('end', ({selection}) => {
        this.markInteractionTime()

        if (selection) {
          // Capture selection.
          [[this.selectionStart.x , 
            this.selectionStart.y], 
           [this.selectionEnd.x, 
            this.selectionEnd.y]] = selection 

          this.setPlaybackTimerangeFromSelectionRange(
            this.selectionStart.x, 
            this.selectionEnd.x)
        } else {
          // No selection, so activate playbackSelectionLine
          this.setPlaybackSelectionLine(this.selectionStart.x)
        }
      })
      
    this.playbackAreaSelectionBrush
      .on('brush', (event) => {
        console.log('brush: ', event.selection)
        // TODO: Show selection time points and frequency points while brushing.
      })
  }

  /**
   * Creates a spectrogram for each Element, configured using attributes defined
   * on the elements. Manages playback controls among all elements.
   * @param {!Array<!Element>} containerElements
   * @return {!PlaybackOrchestrator}
   */
  static async forElements(containerElements) {
    return new PlaybackOrchestrator(
      await Promise.all(containerElements.map(Spectrogram.forElement))
    )
  }

  /**
   * Creates a spectrogram for an Element, configured using attributes defined
   * on that element.
   * @param {!Element} containerElement
   * @return {!Promise<!Spectrogram>}
   */
  static async forElement(containerElement) {
    const container = d3Selection.select(containerElement)

    return Spectrogram.fromFile(
      container.attr('src'),
      {
        spectrogramElement   : containerElement,
        width                : container.attr('width') || undefined,
        height               : container.attr('height') || undefined,
        widthSizeScale       : container.attr('widthSizeScale') || undefined,
        heightSizeScale      : container.attr('heightSizeScale') || undefined,
        showAxes             : container.attr('showAxes') == 'true',
        scrolling            : container.attr('scrolling') == 'true',
        minFrequencyToRender : container.attr('minFrequencyToRender') 
          || undefined,
        maxFrequencyToRender: container.attr('maxFrequencyToRender') 
          || undefined,
      }
    )
  }

  /**
   * New Spectrogram given an audioFile path. 
   * @param {string} audioFile path to audio file
   * @param {{
   *     spectrogramElement: (!Element|undefined), 
   *     width: (number|undefined),
   *     height: (number|undefined),
   *     sizeScale: (number|undefined),
   *     showAxes: (boolean|undefined),
   *     scrolling: (boolean|undefined),
   *     minFrequencyToRender = (number|undefined),
   *     maxFrequencyToRender = (number|undefined),
   *     }=} options
   *         spectrogramElement The element in which to put the spectrogram.
   *             If not defined, uses the body as a container. 
   *         width The width in pixels of the spectrogram, defaults to the 
   *             number of samples in the frequency data.
   *         height The height in pixels of the spectrogram, defaults to the
   *             number of frequency bins in the frequency data.
   *         sizeScale If width and/or height is not set, scales them by this
   *             amount.
   *         showAxes True if axes should be rendered to show time and
   *             frequency values.
   *         scrolling True if spectrogram should scroll during playback.
   *         minFrequencyToRender Min frequency to display, in herz.
   *         maxFrequencyToRender Max frequency to display, in herz.
   * @return {!Promise<!Spectrogram>}
   */
  static async fromFile(audioFile, 
    {
      spectrogramElement, 
      width, 
      height, 
      widthSizeScale, 
      heightSizeScale = 2, 
      showAxes = true,
      scrolling = true,
      minFrequencyToRender = 440,
      maxFrequencyToRender = 10000,
    } = {}) {
    const id = audioFile.split('/').at(-1)
    const performanceMeasure = new PerformanceMeasure(id)

    performanceMeasure.mark('Spectrogram.fromFile')

    performanceMeasure.mark('decodeAudioFromFile')
    console.log('audiofile', audioFile)
    const audioData = await AudioData.fromFile(audioFile)
    performanceMeasure.measure('decodeAudioFromFile', 'decodeAudioFromFile')

    performanceMeasure.mark('getFrequencyData')
    const frequencyData = await audioData.getFrequencyData({
      sampleTimeLength      : 1/140,
      fftSize               : 2 ** 9,
      maxFrequency          : 14080,
      smoothingTimeConstant : 0.,
    })
    performanceMeasure.measure('getFrequencyData', 'getFrequencyData')

    // If width is not set but widthSizeScale is, calculate width.
    if (!width && widthSizeScale) {
      width = frequencyData.data.length * widthSizeScale 
    }
    // Height is required
    height = height || frequencyData.frequencyBinCount * heightSizeScale
    const spectrogram = new Spectrogram(
      {
        audioData, 
        frequencyData,
        spectrogramElement: d3Selection.select(spectrogramElement || 'body'),
        width, 
        height,
        showAxes,
        scrolling,
        performanceMeasure,
        minFrequencyToRender,
        maxFrequencyToRender,
      })
    performanceMeasure.measure('Spectrogram.fromFile', 'Spectrogram.fromFile')

    performanceMeasure.logAndClearPerformanceMeasures()
    return spectrogram
  }

  /**
   * Draws spectrogram data and axis.
   */
  drawSpectrogram({scaleLogarithmic, useMusicNotation}) {
    this.drawSpectrogramData(this.frequencyData.data, {scaleLogarithmic})
    if (this.showAxes) {
      this.drawSpectrogramAxis({useMusicNotation, scaleLogarithmic})
    }
  }

  /** 
   * Draws the spectrogram.
   * @param {!Array<!Uint8Array>} an array of frequency samples, each 
   *     sample should be a normalized array of decibel values between 0 and 
   *     255. The frequencies are spread linearly from 0 to 1/2 of the sample
   *     rate.
   * @private
   */ 
  drawSpectrogramData(data, {scaleLogarithmic = true} = {}) {
    this.performanceMeasure.mark('drawSpectrogramData')

    const width = this.spectroFullWidth * 1
    const height = this.spectroHeight * 1

    const byteCount = 4 * width * height
    const imageArray = new Uint8ClampedArray(byteCount)
    const pixelWidthPerSample =  data.length / width 

    const xToSample = (x) => Math.floor(x * pixelWidthPerSample)
    const frequencyScale = 
    scaleLogarithmic ?  
      (d3Scale.scalePow()
        .exponent(2)
        .domain([0, height])
        .range([this.minFrequencyToRender, this.maxFrequencyToRender])) 
      : 
      (d3Scale.scaleLinear()
        .domain([0, height])
        .range([this.minFrequencyToRender, this.maxFrequencyToRender]))

    const scaleDecibels = 
    d3Scale.scalePow()
      .exponent(2) // Future UI control: slider to adjust this. 
      .domain([0, 255])
      .range([0, 255])

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const decibel = this.frequencyData.decibelFor(
          xToSample(x), frequencyScale(height - y))
        const rIndex = y * (width) * 4 + x * 4
        const [red, green, blue, alpha] = steelBlue(
          Math.floor(scaleDecibels(decibel)))
        imageArray[rIndex] = red          
        imageArray[rIndex + 1] = green 
        imageArray[rIndex + 2] = blue   
        imageArray[rIndex + 3] =  alpha 
      }
    }

    const imageData = new ImageData(
      imageArray,
      width, 
      height)

    this.spectrogramCtx.putImageData(imageData, 0, 0)
    this.performanceMeasure.measure('drawSpectrogramData')
  }

  /**
   * @param {boolean} useMusicNotation
   * @private
   */
  drawSpectrogramAxis({useMusicNotation = true, scaleLogarithmic = true} = {}) {
    performance.mark('drawSpectrogramAxis')

    // Clear current scales in case this is a re-draw
    this.svg.select('.xAxis').remove()
    this.svg.select('.yAxis').remove()

    // Add x axis (time scale)
    const timeScale = d3Scale.scaleLinear()
      .domain([this.spectroDisplayStartSeconds, this.getDisplayEndSeconds()])
      .range([0, this.spectroDisplayWidth])
    const TARGET_TICK_SPACE = 100
    const timeAxis = d3Axis.axisTop(timeScale)
      .ticks(Math.ceil(this.spectroDisplayWidth / TARGET_TICK_SPACE))
    this.svg.append('g')
      .attr('class', 'xAxis axis')
      .attr('transform', `translate(
        ${this.spectroMargin.left},${this.spectroMargin.top})`
      )
      .call(timeAxis)
      .call(g => g.select('.domain').remove())
      // Position ticks to the right of tick lines
      .call(g => g.selectAll('text')
        .attr('text-anchor', 'start')
        .attr('y', -1.5)
        .attr('x', 4))
      // Slightly increase tick size to match text label
      .call(g => g.selectAll('line')
        .attr('y2', -8.5)
        .attr('y1', -1))
      // Remove the tick for '0'
      .call(g => g.selectAll('.tick')
        .filter(d => d === 0)
        .remove())

    // Add y axis (frequency scale)
    const frequencyAxis = useMusicNotation ? 
      musicNotationAxis({
        minFrequency  : this.minFrequencyToRender, 
        maxFrequency  : this.maxFrequencyToRender,
        spectroHeight : this.spectroHeight,
        scaleLogarithmic
      }) :
      frequencyScaleAxis({
        minFrequency  : this.minFrequencyToRender, 
        maxFrequency  : this.maxFrequencyToRender,
        spectroHeight : this.spectroHeight,
        scaleLogarithmic
      })
    this.svg.append('g')
      .attr('class', 'yAxis button axis')
      .attr('transform', `translate(
        ${this.spectroMargin.left},${this.spectroMargin.top})`
      )
      .call(frequencyAxis)
      // Add label for axis
      .append('g')
      .on('click', () => 
        this.drawSpectrogram(this.displayState.nextDisplayState())
      )
      .append('text')
      // Position axis label so arrow roughly aligns with y axis
      .attr('transform', `translate(${-3},${this.spectroHeight })`)
      // This matches the default x adjustment on axis tick text.
      .attr('x', -9) 
      .attr('y', 16)
      .attr('text-anchor', 'middle')
      .text(`${useMusicNotation ? '♫' : 'kHz'}`)

    performance.measure('drawSpectrogramAxis', 'drawSpectrogramAxis')
  }

  /**
   * @param {number} x
   * @param {number} y
   * @return {boolean} True if the click is within the spectrogram display (not
   *     just the canvas as a whole).
   */
  clickIsWithinSpectrogram(x, y) {
    if (x < this.spectroMargin.left || 
        x - this.spectroMargin.left > this.spectroDisplayWidth ||
        y < this.spectroMargin.top ||
        y - this.spectroMargin.top > this.spectroHeight) {
      return false
    }
    return true
  }

  /**
   *  Sets the stop/play icon to the appropriate state, hides/shows the 
   *  animation line as needed, and cancels animation if needed.
   *  @param {boolean} isBelingPlayedBack
   */
  updatePlaybackButtonAndLineAnimation(isBeingPlayedBack) {
    this.playbackIconImage
      .attr('xlink:href', isBeingPlayedBack ? stopIcon : playIcon)

    this.playbackLine
      .attr('opacity', isBeingPlayedBack ? 1.0 : 0.0)

    if (!isBeingPlayedBack) {
      cancelAnimationFrame(this.playbackLineAnimationId)
    }
  }

  /** 
   * Animates a line to show the current playback position.
   * @return {number} the requestAnimationFrame ID for cancelling 
   */
  animatePlaybackLine() {
    // Draw a vertical line to show current position of playback
    const timePosition = this.audioContext.currentTime 
      - (this.playbackStartedAt - this.timeInAudioClipWherePlaybackStarted)

    // Check if we have reached the end of visible area and need to update
    // display.
    if (timePosition > this.getDisplayEndSeconds()) {
      this.spectroDisplayStartSeconds = this.getDisplayEndSeconds()

      // Hide previously selection playback line if it was visible, as the
      // user is making a new selection.
      this.playbackSelectionLine
        .attr('opacity', 0)

      // For now, set playback selection start to the new visible beginning.
      this.setPlaybackTimerangeFromSelectionPoint(0)

      this.spectrogramCanvas.style(
        'left', 
        `${this.spectroMargin.left - 
          this.spectroDisplayStartSeconds * this.pixelsPerSecond}px`)
    }


    const percentVisibleComplete = 
      (timePosition - this.spectroDisplayStartSeconds) / 
      this.getVisibleTimeDuration()
    const xPosition = this.spectroDisplayWidth * percentVisibleComplete

    this.playbackLine
      .attr('x1', xPosition)
      .attr('x2', xPosition)

    this.playbackLineAnimationId = 
      requestAnimationFrame(() => this.animatePlaybackLine())
  }

  setPlaybackSelectionLine(xPosition) {
    this.playbackSelectionLine
      .attr('opacity', 1.0)
      .attr('x1', xPosition)
      .attr('x2', xPosition)
  }

  /**
   * Plays the provided audio buffer.
   * @param {!AudioBuffer} buffer
   * @return {!AudioBufferSourceNode} the node where playback was started. 
   *     May be used to call stop() or listen for onEnded.
   */
  playBuffer({buffer}) {
    const source = new AudioBufferSourceNode(this.audioContext, {buffer})
    source.onended = () => { 
      this.updatePlaybackButtonAndLineAnimation(false)
      this.playbackActive = false}

    source.connect(this.audioContext.destination)
    source.start()

    this.playbackStartedAt = this.audioContext.currentTime
    this.timeInAudioClipWherePlaybackStarted = this.playbackSelectionStart

    return source
  }

  /** @return {boolean} True if playback is active. */ 
  isPlaybackActive() {
    return this.playbackActive
  }

  /** Stops any active playback. */ 
  stopPlayback() {
    if (this.playbackActive) {
      this.togglePlayback()
    }
  }

  /** */
  markInteractionTime() {
    this.lastUserInteractionTimestamp = Date.now()
  }

  /** {number} Timestamp when the user last interacted with this spectrogram. */
  getLastInteractionTime() {
    return this.lastUserInteractionTimestamp
  }

  togglePlayback() {
    this.updatePlaybackButtonAndLineAnimation(!this.playbackActive)
    this.playbackActive = !this.playbackActive
    if (this.playbackActive) {
      this.playbackNode = this.playBuffer({
        buffer: this.getBufferForPlayback(),
      })
      this.animatePlaybackLine()
    } else if (this.playbackNode) {
      this.playbackNode.stop()
    }
  }

  /**
   * @return {!AudioBuffer} audioBuffer for playback, taking into account the
   *     playback selection, if any.
   */ 
  getBufferForPlayback() {
    if (this.playbackSelectionStart == 0 
      && this.playbackSelectionEnd == this.audioData.duration) {
      return this.audioData.buffer
    } else {
      return this.audioData.slice(
        this.playbackSelectionStart, this.playbackSelectionEnd).buffer
    }
  }

  /**
   * Updates playback selection start (in seconds) based on UI selection
   * range, and sets end to end of audio.
   * @param {number} startX
   */
  setPlaybackTimerangeFromSelectionPoint(startX) {
    this.playbackSelectionStart = this.getTimePositionFromX(startX)
    this.playbackSelectionEnd = this.audioData.duration
  }

  /**
   * Updates playback seleciton start and end (in seconds) based on UI selection
   * range. 
   * @param {number} startX
   * @param {number} endX
   */
  setPlaybackTimerangeFromSelectionRange(startX, endX) {
    this.playbackSelectionStart = this.getTimePositionFromX(startX)
    this.playbackSelectionEnd = this.getTimePositionFromX(endX)
  }

  /**
   * @param {number} xPosition
   * @return {number} time position in seconds
   */ 
  getTimePositionFromX(xPosition) {
    const xPercentage = xPosition / this.spectroDisplayWidth

    return this.spectroDisplayStartSeconds + 
      this.getVisibleTimeDuration() * xPercentage
  }

  /**
   * @return {number} Duration in seconds of visible spectrogram.
   */
  getVisibleTimeDuration() {
    return this.spectroDisplayWidth / this.pixelsPerSecond
  }

  /**
   * @return {number} Last visible displayed part of spectrogram, in seconds.
   */
  getDisplayEndSeconds() {
    return this.spectroDisplayStartSeconds + this.getVisibleTimeDuration()
  }
}

function frequencyScaleAxis({
  minFrequency, 
  maxFrequency, 
  spectroHeight, 
  scaleLogarithmic
}) {
  const scale = scaleLogarithmic ? 
    d3Scale.scaleLog()
      .base(2)
      // domain must be > 0 for log scale
      .domain([minFrequency || 1, maxFrequency])
      .nice()
      .range([spectroHeight, 0])
    : d3Scale.scaleLinear()
      .domain([minFrequency, maxFrequency])
      .range([spectroHeight, 0])

  const frequencyAxis = d3Axis.axisLeft(scale)
    .ticks(5)
    // convert to kHz
    .tickFormat(hz => `${hz / 1000}`)

  return frequencyAxis
}

/** 
 * Shows octaves from A4 -> A9.
 */ 
function musicNotationAxis({
  minFrequency, 
  maxFrequency, 
  spectroHeight, 
  scaleLogarithmic
}) {
  const baseFrequency = 880
  const baseNoteClass = 'A'
  const baseFrequencyOctaveNum = 5
  const scale = scaleLogarithmic ? 
    d3Scale.scaleLog()
      .base(2)
      // domain must be > 0 for log scale
      .domain([minFrequency || 1, maxFrequency])
      .range([spectroHeight, 0])
    : d3Scale.scaleLinear()
      .domain([minFrequency, maxFrequency])
      .range([spectroHeight, 0])


  const frequencyAxis = d3Axis.axisLeft(scale)
    .tickValues([0,1,2,3,4]
      .map(exponent => baseFrequency * Math.pow(2, exponent))
    )
    // convert to A4, A5, etc
    .tickFormat(
      hz => baseNoteClass + 
        (Math.log2(hz / baseFrequency) + baseFrequencyOctaveNum)
    )
  return frequencyAxis
}

class DisplayState {
  constructor() {
    this.displayStates = [
      {scaleLogarithmic: false, useMusicNotation: false},
      {scaleLogarithmic: true, useMusicNotation: false},
      {scaleLogarithmic: true, useMusicNotation: true},
      {scaleLogarithmic: false, useMusicNotation: true},
    ]

    this.position = 0
  }

  /** 
   * Moves to the next display state and returns it. 
   * @return {{
   *     scaleLogarithmic: boolean,
   *     useMusicNotation: boolean 
   *     }}
   */
  nextDisplayState() {
    this.position = (this.position + 1) % this.displayStates.length
    return this.getState()
  }

  /** 
   * Gets current display state.
   * @return {{
   *     scaleLogarithmic: boolean,
   *     useMusicNotation: boolean 
   *     }}
   */
  getState() {
    return this.displayStates[this.position]
  }
}

export {Spectrogram}
