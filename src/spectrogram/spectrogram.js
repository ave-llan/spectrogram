import * as d3Axis from 'd3-axis'
import * as d3Selection from 'd3-selection'
import * as d3Scale from 'd3-scale'
import {AudioData} from 'audio-frequency'
import playIcon from '../resources/play_icon.svg'
import stopIcon from '../resources/stop_icon.svg'

class Spectrogram {
  constructor({audioData, frequencyData, width = 1300, height = 400}) {
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
      audioBuffer   : audioData.buffer,
      svg           : this.svg, 
      width         : this.width, 
      height        : this.height, 
      spectroMargin : this.spectroMargin
    })
  }

  /**
   * New Spectrogram given an audioFile path. 
   * @param {string} audioFile path to audio file
   * @return {!Spectrogram}
   */
  static async fromFile(audioFile, {width = 1300, height = 400} = {}) {
    const audioData = await AudioData.fromFile(audioFile)
    const frequencyData = await audioData.getFrequencyData({
      sampleTimeLength      : 1/140,
      fftSize               : 2 ** 11,
      maxFrequency          : 11000,
      smoothingTimeConstant : 0.8,
    })
    return new Spectrogram({audioData, frequencyData, width, height})
  }

  /**
   * Draws spectrogram data and axis.
   */
  drawSpectrogram({scaleLogarithmic, useMusicNotation}) {
    console.log('drawSpectrogram')
    console.log('scaleLogarithmic', scaleLogarithmic)
    console.log('useMusicNotation', useMusicNotation)
    this.drawSpectrogramData(this.frequencyData.data, {scaleLogarithmic})
    this.drawSpectrogramAxis({useMusicNotation, scaleLogarithmic})
  }

  /** 
   * Draws the sonogram.
   * @param {!Array<!Uint8Array>} an array of frequency samples, each 
   *     sample should be a normalized array of decibel values between 0 and 
   *     255. The frequencies are spread linearly from 0 to 1/2 of the sample
   *     rate.
   * @private
   */ 
  drawSpectrogramData(data,  {scaleLogarithmic = true} = {}) {
    this.sonogramCtx.fillStyle = 'rgb(240, 240, 240)'
    this.sonogramCtx.fillRect(0, 0, this.spectroWidth, this.spectroHeight)

    // Scale for positioning frequency values.
    const frequencyScale = 
    (scaleLogarithmic ?  d3Scale.scaleLog().base(2) : d3Scale.scaleLinear())
      .domain([
        this.minFrequencyToRender || 1, 
        this.frequencyData.maxFrequency
      ])
      .range([this.spectroHeight, 0])

    // Scale for decible colors.
    const decibleColorScale = d3Scale.scaleLinear()
      // getAudioFrequencyData returns a normalized array of values
      // between 0 and 255
      .domain([0, 255])
      .range(['rgba(70, 130, 180, 0)', 'rgba(70, 130, 180, 1.0)'])

    const frequencyBinCount = data[0].length
    const barWidth = this.spectroWidth / data.length
    for (let x = 0; x < data.length; x++) {
      for (let y = 0; y < frequencyBinCount; y++) {
        const intensity = data[x][y]
        const y1 = frequencyScale(this.frequencyData.frequencyAtBin(y))
        const y2 = frequencyScale(this.frequencyData.frequencyAtBin(y + 1))
        // if (x == 0)
        //   console.log(this.frequencyData.frequencyAtBin(y), "    ",y1 - y2)
        const barHeight = y1 - y2
        this.sonogramCtx.fillStyle = decibleColorScale(intensity)
        this.sonogramCtx.fillRect(
          x * barWidth,
          y1,
          barWidth,
          barHeight,
        )
      }
    }
  }

  /**
   * @param {boolean} useMusicNotation
   * @private
   */
  drawSpectrogramAxis({useMusicNotation = true, scaleLogarithmic = true} = {}) {
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
      .attr('class', 'xAxis')
      .attr('transform', `translate(
        ${this.spectroMargin.left},${this.height - this.spectroMargin.bottom})`
      )
      .call(timeAxis)
      // Add label for axis
      .append('g')
      .append('text')
      // Position axis label with enough room below axis ticks
      .attr('transform', `translate(${this.spectroWidth},${30})`)
      .attr('fill', 'black')
      .attr('text-anchor', 'end')
      .text('seconds  →')

    // Add y axis (frequency scale)
    const frequencyAxis = useMusicNotation ? 
      musicNotationAxis({
        minFrequency  : this.minFrequencyToRender, 
        maxFrequency  : this.frequencyData.maxFrequency,
        spectroHeight : this.spectroHeight,
        scaleLogarithmic
      }) :
      frequencyScaleAxis({
        minFrequency  : this.frequencyData.minFrequency, 
        maxFrequency  : this.frequencyData.maxFrequency,
        spectroHeight : this.spectroHeight,
        scaleLogarithmic
      })
    this.svg.append('g')
      .attr('class', 'yAxis')
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
      .attr('fill', 'black')
      .attr('text-anchor', 'start')
      .text(`↑ ${useMusicNotation ? '♫' : 'kHz'}`)
  }
}

/**
 *  Adds playback functionality to spectrogram.
 */
class SpectroPlaybackController {
  constructor({audioBuffer, svg, height, width, spectroMargin, iconSize = 30}) {

    this.audioBuffer = audioBuffer
    this.audioContext = new AudioContext()

    /** @type {number} padding around spectrogram */
    this.spectroPadding = 5
    this.width = width,
    this.height = height,
    this.spectroMargin = spectroMargin

    this.playbackActive = false
    this.playbacknode,
    this.playbackLineAnimationId,
    this.playbackStartedAt


    this.playbackLine = svg
      .append('g')
      .attr('class', 'playbackPositionLine')
      .append('line')
      .attr('x1', spectroMargin.left)
      .attr('x2', spectroMargin.left)
      .attr('y1', spectroMargin.top)
      .attr('y2', this.height - spectroMargin.bottom)
      .attr('stroke', 'black')
      .attr('opacity', 0)

    this.playbackIcon = svg.append('g')
      .attr('class', 'play-icon')
      .attr('transform', 
        `translate(
          ${this.width - (iconSize + spectroMargin.right)},
          ${spectroMargin.top - this.spectroPadding - iconSize})`
      )
      .on('click', () => {
        this.updatePlaybackButtonAndLineAnimation(!this.playbackActive)
        this.playbackActive = !this.playbackActive
        if (this.playbackActive) {
          this.playbackNode = this.playBuffer({
            buffer: this.audioBuffer,
          })
          this.animatePlaybackLine()
        } else if (this.playbackNode) {
          this.playbackNode.stop()
        }
      })

    this.playbackIcon.append('image')
      .attr('id', 'playback-icon')
      .attr('width', iconSize)
      .attr('height', iconSize)
      .attr('xlink:href', playIcon)
      .attr('opacity', 0.25)
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
    const timeElapsed = this.audioContext.currentTime - this.playbackStartedAt
    const percentComplete = timeElapsed / this.audioBuffer.duration 

    const spectroWidth = this.width 
      - this.spectroMargin.left 
      - this.spectroMargin.right
    const xPosition = this.spectroMargin.left + spectroWidth * percentComplete

    this.playbackLine
      .attr('x1', xPosition)
      .attr('x2', xPosition)

    this.playbackLineAnimationId = 
      requestAnimationFrame(() => this.animatePlaybackLine())
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

export {Spectrogram}
