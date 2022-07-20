import * as d3Axis from 'd3-axis'
import * as d3Brush from 'd3-brush'
import * as d3Selection from 'd3-selection'
import * as d3Scale from 'd3-scale'
import {AudioData} from './audio-data.js'
import {steelBlue} from '../resources/color.js'
import playIcon from '../resources/play_icon.svg'
import stopIcon from '../resources/stop_icon.svg'

class Spectrogram {
  constructor({
    audioData, 
    frequencyData, 
    width = 1300, 
    height = 400,
    showAxes = true
  }) {
    /** @type {!AudioData} */
    this.audioData = audioData,

    /**  @type {!Array<!FrequencyData>} */
    this.frequencyData = frequencyData,

    this.minFrequencyToRender = 880,
    this.maxFrequencyToRender = 14080

    /** @type {number} width of the Spectrogram visualizer tool. */
    this.width = width,

    /** @type {number} height of the Spectrogram visualizer tool. */
    this.height = height

    /** @type {boolean} whether or not the axes should be shown. */
    this.showAxes = showAxes

    this.spectroMargin = {top: 40, right: 20, bottom: 40, left: 40}
    this.spectroWidth = this.width 
      - this.spectroMargin.left - this.spectroMargin.right
    this.spectroHeight = this.height 
      - this.spectroMargin.top - this.spectroMargin.bottom

    this.displayState = new DisplayState()

    /** @type {!d3Selection.Selection} A div container for spectrogram tool. */
    this.container = d3Selection.select('body')
      .append('div')
      .attr('class', 'spectrogramVisualizer')
      .style('width', `${this.width}px`)
      .style('height', `${this.height}px`)
      .style('position', 'relative')

    /** @type {!d3Selection.Selection} A canvas for drawing spectrogram data. */
    this.sonogramCanvas = this.container
      .append('canvas')
      .attr('class', 'spectrogram')
      .attr('width', this.spectroWidth)
      .attr('height', this.spectroHeight)
      .style('position', 'absolute')
      .style('left', `${this.spectroMargin.left}px`)
      .style('top', `${this.spectroMargin.top}px`)

    /** @type {!CanvasRenderingContext2D} canvas context for sonogram. */ 
    this.sonogramCtx = this.sonogramCanvas
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
    new SpectroPlaybackController({
      audioData      : this.audioData,
      spectrogramDiv : this.container,
      spectorgramSvg : this.svg, 
      width          : this.width, 
      height         : this.height, 
      spectroMargin  : this.spectroMargin
    })
  }

  /**
   * New Spectrogram given an audioFile path. 
   * @param {string} audioFile path to audio file
   * @param {{
   *     width: (number|undefined),
   *     height: (number|undefined),
   *     sizeScale: (number|undefined),
   *     }=} options
   *         width The width in pixels of the spectrogram, defaults to the 
   *             number of samples in the frequency data.
   *         height The height in pixels of the spectrogram, defaults to the
   *             number of frequency bins in the frequency data.
   *         sizeScale If width and/or height is not set, scales them by this
   *             amount.
   *         showAxes True if axes should be rendered to show time and
   *             frequency values.
   * @return {!Spectrogram}
   */
  static async fromFile(audioFile, 
    {width, height, sizeScale = 2, showAxes = true} = {}) {
    performance.mark('Spectrogram.fromFile')

    performance.mark('decodeAudioFromFile')
    const audioData = await AudioData.fromFile(audioFile)
    performance.measure('decodeAudioFromFile', 'decodeAudioFromFile')

    performance.mark('getFrequencyData')
    const frequencyData = await audioData.getFrequencyData({
      sampleTimeLength      : 1/140,
      fftSize               : 2 ** 9,
      maxFrequency          : 14080,
      smoothingTimeConstant : 0.,
    })
    performance.measure('getFrequencyData', 'getFrequencyData')

    const spectrogram = new Spectrogram(
      {
        audioData, 
        frequencyData, 
        width: Math.floor(
          width || frequencyData.data.length * sizeScale), 
        height: Math.floor(
          height || frequencyData.frequencyBinCount * sizeScale),
        showAxes,
      })
    performance.measure('Spectrogram.fromFile', 'Spectrogram.fromFile')

    logAndClearPerformanceMeasures()
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
   * Draws the sonogram.
   * @param {!Array<!Uint8Array>} an array of frequency samples, each 
   *     sample should be a normalized array of decibel values between 0 and 
   *     255. The frequencies are spread linearly from 0 to 1/2 of the sample
   *     rate.
   * @private
   */ 
  drawSpectrogramData(data, {scaleLogarithmic = true} = {}) {
    performance.mark('drawSpectrogramData')

    const width = this.spectroWidth * 1
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
      .exponent(3) // Future UI control: slider to adjust this. 
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

    this.sonogramCtx.putImageData(imageData, 0, 0)
    performance.measure(
      'drawSpectrogramData', 'drawSpectrogramData')
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
      .domain([0, this.frequencyData.duration])
      .range([0, this.spectroWidth])
    const timeAxis = d3Axis.axisBottom(timeScale)
      .ticks(Math.floor(this.frequencyData.duration))
    this.svg.append('g')
      .attr('class', 'xAxis axis')
      .attr('transform', `translate(
        ${this.spectroMargin.left},${this.height - this.spectroMargin.bottom})`
      )
      .call(timeAxis)
      // Add label for axis
      .append('g')
      .append('text')
      // Position axis label with enough room below axis ticks
      .attr('transform', `translate(${this.spectroWidth},${30})`)
      // .attr('fill', 'black')
      .attr('text-anchor', 'end')
      .text('seconds  →')

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
      .attr('transform', `translate(${-3},${-5})`)
      // .attr('fill', 'black')
      .attr('text-anchor', 'start')
      .text(`↑ ${useMusicNotation ? '♫' : 'kHz'}`)

    performance.measure('drawSpectrogramAxis', 'drawSpectrogramAxis')
  }
}

/**
 *  Adds playback functionality to spectrogram.
 */
class SpectroPlaybackController {
  constructor({
    audioData, 
    spectrogramDiv,
    spectorgramSvg, 
    height, 
    width, 
    spectroMargin, 
    iconSize = 30}) {

    this.audioData = audioData
    this.audioContext = new AudioContext()

    /** @type {number} padding around spectrogram */
    this.spectroPadding = 5
    this.width = width,
    this.height = height,
    this.spectroMargin = spectroMargin
    this.spectroWidth = width
      - this.spectroMargin.left 
      - this.spectroMargin.right
    this.spectroHeight = height - spectroMargin.top - spectroMargin.bottom

    this.playbackActive = false
    this.playbacknode,
    this.playbackLineAnimationId,
    this.playbackStartedAt

    /** @type {number} When (in seconds) to start playback */
    this.playbackSelectionStart = 0
    this.playbackSelectionEnd =  this.audioData.duration
    // Selection area in pixels.
    this.selectionStart = {x: 0, y: 0}
    this.selectionEnd = {x: this.spectroWidth, y: this.spectroHeight}

    // Create a new SVG overlay for selection UI. 
    this.selectionSvg = spectrogramDiv
      .append('svg')
      .attr('class', 'selectionSvg')
      .style('position', 'absolute')
      .attr('width', this.spectroWidth)
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

    this.playbackIcon = spectorgramSvg.append('g')
      .attr('class', 'play-icon button')
      .attr('transform', 
        `translate(
          ${this.width - (iconSize + spectroMargin.right)},
          ${spectroMargin.top - this.spectroPadding - iconSize})`
      )

    this.playbackIcon.append('image')
      .attr('id', 'playback-icon')
      .attr('width', iconSize)
      .attr('height', iconSize)
      .attr('xlink:href', playIcon)
      .attr('opacity', 0.25)

    // Add event listeners for playback.
    this.playbackIcon
      .on('click', (event) => {
        event.stopPropagation()
        this.togglePlayback()
      })
    document.addEventListener('keydown', ({code}) => {
      if (code == 'Space') {
        this.togglePlayback()
      }
    })


    /** @const {!Function} D3 brush UI controller for selecting a
     *      two-dimensional region by clicking and dragging the mouse.
     */
    this.brush = d3Brush.brush()

    // Activate brush on selection svg.
    this.selectionSvg
      .call(this.brush)

    // At start of brush, capture beginning x1 position in case the user does
    // not drag (and we want to set playbackSelectionLine)
    this.brush
      .on('start', ({selection}) => {
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
        this.selectionEnd.x = this.spectroWidth
        this.selectionEnd.y = this.spectroHeight
        this.setPlaybackTimerangeFromSelection(
          this.selectionStart.x, 
          this.selectionEnd.x)
      })

    // Add event listern for playbackSelectionLine based on end of brush event.
    // If there is no selection at the end, instead set the time based 
    // playback selection line.
    this.brush
      .on('end', ({selection}) => {
        if (selection) {
          // Capture selection.
          [[this.selectionStart.x , 
            this.selectionStart.y], 
           [this.selectionEnd.x, 
            this.selectionEnd.y]] = selection 

          this.setPlaybackTimerangeFromSelection(
            this.selectionStart.x, 
            this.selectionEnd.x)
        } else {
          // No selection, so activate playbackSelectionLine
          this.setPlaybackSelectionLine(this.selectionStart.x)
        }
      })
      
    this.brush
      .on('brush', (event) => {
        console.log('brush: ', event.selection)
        // TODO: Show selection time points and frequency points while brushing.
      })
  }

  /**
   * @param {number} x
   * @param {number} y
   * @return {boolean} True if the click is within the spectrogram display (not
   *     just the canvas as a whole).
   */
  clickIsWithinSpectrogram(x, y) {
    if (x < this.spectroMargin.left || 
        x - this.spectroMargin.left > this.spectroWidth ||
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
    d3Selection.select('#playback-icon')
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
      - (this.playbackStartedAt - this.playbackSelectionStart)
    const percentComplete = timePosition / this.audioData.duration 
    const xPosition = this.spectroWidth * percentComplete

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

    return source
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
   * Updates playback seleciton start and end (in seconds) based on UI selection
   * range.
   */
  setPlaybackTimerangeFromSelection(startX, endX) {
    this.playbackSelectionStart = this.getTimePositionFromX(startX)
    this.playbackSelectionEnd = this.getTimePositionFromX(endX)
  }

  /**
   * @param {number} xPosition
   * @return {number} time position in seconds
   */ 
  getTimePositionFromX(xPosition) {
    const xPercentage = xPosition / this.spectroWidth
    return this.audioData.duration * xPercentage
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
    // .ticks(10)
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

function logAndClearPerformanceMeasures() {
  performance.getEntriesByType('measure')
    .sort((a,b) => 
      (a.startTime - b.startTime) || 
      // If startTime is equal, show the one that finishes last first.
      (b.duration - a.duration) )
    .forEach(m => 
      console.log(
        `${m.name.padEnd(20)} ` + 
        `startTime: ${m.startTime.toFixed(1).padStart(6)}  ` +
        `duration: ${m.duration.toFixed(1).padStart(6)}` + 
        // Log a simple timeline.
        ' ['.padStart(m.startTime / 5).padEnd(m.duration / 5, '*') + ']'))
  performance.clearMarks()
  performance.clearMeasures()
}

export {Spectrogram}
