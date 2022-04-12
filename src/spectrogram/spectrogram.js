import * as d3Axis from 'd3-axis'
import * as d3Selection from 'd3-selection'
import * as d3Scale from 'd3-scale'
import {AudioData} from 'audio-frequency'
import robinSwift from '../data/robin-swift.wav'
import playIcon from '../resources/play_icon.svg'
import stopIcon from '../resources/stop_icon.svg'

class Spectrogram {
  constructor({audioData, frequencyData, width = 1300, height = 400}) {
    /** @type {!AudioData} */
    this.audioData = audioData,

    /**  @type {!Array<!FrequencyData>} */
    this.frequencyData = frequencyData,

    /** @type {number} width of the Spectrogram visualizer tool. */
    this.width = width,

    /** @type {number} height of the Spectrogram visualizer tool. */
    this.height = height

    this.spectroMargin = {top: 40, right: 20, bottom: 40, left: 40}
    this.spectroWidth = this.width - this.spectroMargin.left - this.spectroMargin.right
    this.spectroHeight = this.height - this.spectroMargin.top - this.spectroMargin.bottom

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

    this.drawSpectrogramData(this.frequencyData.data)
    this.drawSpectrogramAxis()
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
   * Draws the sonogram.
   * @param {!Array<!Uint8Array>} an array of frequency samples, each 
   *     sample should be a normalized array of decibel values between 0 and 255.
   *     The frequencies are spread linearly from 0 to 1/2 of the sample rate.
   * @private
   */ 
  drawSpectrogramData(data) {
    this.sonogramCtx.fillStyle = 'rgb(240, 240, 240)'
    this.sonogramCtx.fillRect(0, 0, this.spectroWidth, this.spectroHeight)

    // Draw spectrogram
    const decibleColorScale = d3Scale.scaleLinear()
      // getAudioFrequencyData returns a normalized array of values
      // between 0 and 255
      .domain([0, 255])
      .range(['rgba(70, 130, 180, 0)', 'rgba(70, 130, 180, 1.0)'])
    console.log('Frequency bin count:', data[0].length)
    console.log('Num samples:', data.length)
    const frequencyBinCount = data[0].length
    const barWidth = this.spectroWidth / data.length
    for (let x = 0; x < data.length; x++) {
      for (let y = 0; y < frequencyBinCount; y++) {
        const intensity = data[x][y] 
        const barHeight = this.spectroHeight / frequencyBinCount
        this.sonogramCtx.fillStyle = decibleColorScale(intensity)
        this.sonogramCtx.fillRect(
          x * barWidth,
          this.spectroHeight - (y * barHeight),
          barWidth,
          barHeight,
        )
      }
    }
  }

  /**
   * @private
   */
  drawSpectrogramAxis() {
    console.log('frequencyData.duration:', this.frequencyData.duration)

    // Add x axis (time scale)
    const timeScale = d3Scale.scaleLinear()
      .domain([0, this.frequencyData.duration])
      .range([0, this.spectroWidth])
    const timeAxis = d3Axis.axisBottom(timeScale)
      .ticks(Math.floor(this.frequencyData.duration))
    this.svg.append('g')
      .attr('class', 'xAxis')
      .attr('transform', `translate(${this.spectroMargin.left},${this.height - this.spectroMargin.bottom})`)
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
    const frequencyScale = d3Scale.scaleLinear()
      .domain([this.frequencyData.minFrequency, this.frequencyData.maxFrequency])
      .range([this.spectroHeight, 0])
    const frequencyAxis = d3Axis.axisLeft(frequencyScale)
      .ticks(10)
      // convert to kHz
      .tickFormat(hz => `${hz / 1000}`)

    this.svg.append('g')
      .attr('class', 'yAxis')
      .attr('transform', `translate(${this.spectroMargin.left},${this.spectroMargin.top})`)
      .call(frequencyAxis)
      // Add label for axis
      .append('g')
      .append('text')
      // Position axis label so arrow roughly aligns with y axis
      .attr('transform', `translate(${-3},${-5})`)
      .attr('fill', 'black')
      .attr('text-anchor', 'start')
      .text('↑ kHz')
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
        `translate(${this.width - (iconSize + spectroMargin.right)},${spectroMargin.top - this.spectroPadding - iconSize})`)
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
   *  Sets the stop/play icon to the appropriate state, hides/shows the animation line as needed,
   *  and cancels animation if needed.
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

    const spectroWidth = this.width - this.spectroMargin.left - this.spectroMargin.right
    const xPosition = this.spectroMargin.left + spectroWidth * percentComplete

    this.playbackLine
      .attr('x1', xPosition)
      .attr('x2', xPosition)

    this.playbackLineAnimationId = requestAnimationFrame(() => this.animatePlaybackLine())
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

// TODO move to index.js
Spectrogram.fromFile(robinSwift)
