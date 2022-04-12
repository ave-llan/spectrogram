import * as d3Axis from 'd3-axis'
import * as d3Selection from 'd3-selection'
import * as d3Scale from 'd3-scale'
import {AudioData} from 'audio-frequency'
import robinSwift from '../data/robin-swift.wav'
import playIcon from '../resources/play_icon.svg'
import stopIcon from '../resources/stop_icon.svg'

getAndDrawData(robinSwift)

async function getAndDrawData(audioFile, {width = 1300, height = 400} = {}) {
  const audioData = await AudioData.fromFile(audioFile)
  const frequencyData = await audioData.getFrequencyData({
    sampleTimeLength      : 1/140,
    fftSize               : 2 ** 11,
    maxFrequency          : 11000,
    smoothingTimeConstant : 0.8,
  })

  const spectroMargin = {top: 40, right: 20, bottom: 40, left: 40},
    spectroWidth = width - spectroMargin.left - spectroMargin.right,
    spectroHeight = height - spectroMargin.top - spectroMargin.bottom

  // Create div container for spectrogram tool.
  const container = d3Selection.select('body')
    .append('div')
    .attr('class', 'sonogramVisualizer')
    .style('position', 'relative')
    .style('width', `${width}px`)
    .style('height', `${height}px`)

  // Create canvas for drawing spectrogram data.
  const sonogramCanvas = container
    .append('canvas')
    .attr('class', 'spectrogram')
    .attr('width', spectroWidth)
    .attr('height', spectroHeight)
  sonogramCanvas
    .style('position', 'absolute')
    .style('left', `${spectroMargin.left}px`)
    .style('top', `${spectroMargin.top}px`)
  const sonogramCtx = sonogramCanvas
    .node()
    .getContext('2d')

  drawSpectrogramData(frequencyData.data, {sonogramCtx, width: spectroWidth, height: spectroHeight})

  // Create svg that will contain the axis
  const svg = container
    .append('svg')
    .attr('class', 'spectrogramTool')
    .style('position', 'absolute')
    .attr('width', width)
    .attr('height', height + 20)
  drawSpectrogramAxis({frequencyData, svg, width, height, spectroMargin})
  addPlaybackButtons({audioBuffer: audioData.buffer, svg, height, width, spectroMargin})
  console.log(frequencyData)
}

function drawSpectrogramData(data, {sonogramCtx, width = 1400, height = 400} = {}) {
  sonogramCtx.fillStyle = 'rgb(240, 240, 240)'
  sonogramCtx.fillRect(0, 0, width, height)

  // Draw spectrogram
  const decibleColorScale = d3Scale.scaleLinear()
    // getAudioFrequencyData returns a normalized array of values
    // between 0 and 255
    .domain([0, 255])
    .range(['rgba(70, 130, 180, 0)', 'rgba(70, 130, 180, 1.0)'])
  console.log('Frequency bin count:', data[0].length)
  console.log('Num samples:', data.length)
  const frequencyBinCount = data[0].length
  const barWidth = width / data.length
  for (let x = 0; x < data.length; x++) {
    for (let y = 0; y < frequencyBinCount; y++) {
      const intensity = data[x][y] 
      const barHeight = height / frequencyBinCount
      sonogramCtx.fillStyle = decibleColorScale(intensity)
      sonogramCtx.fillRect(
        x * barWidth,
        height - (y * barHeight),
        barWidth,
        barHeight,
      )
    }
  }
}

/**
 * @param {!FrequencyData} frequencyData
 */
function drawSpectrogramAxis({frequencyData, svg, width = 1400, height = 400, spectroMargin} = {}) {
  console.log('frequencyData.duration:', frequencyData.duration)
  const spectrogramWidth = width - spectroMargin.left - spectroMargin.right 
  const spectrogramWHeight = height - spectroMargin.top - spectroMargin.bottom

  // Add x axis (time scale)
  const timeScale = d3Scale.scaleLinear()
    .domain([0, frequencyData.duration])
    .range([0, spectrogramWidth])
  const timeAxis = d3Axis.axisBottom(timeScale)
    .ticks(Math.floor(frequencyData.duration))
  svg.append('g')
    .attr('class', 'xAxis')
    .attr('transform', `translate(${spectroMargin.left},${height - spectroMargin.bottom})`)
    .call(timeAxis)
    // Add label for axis
    .append('g')
    .append('text')
    // Position axis label with enough room below axis ticks
    .attr('transform', `translate(${spectrogramWidth},${30})`)
    .attr('fill', 'black')
    .attr('text-anchor', 'end')
    .text('seconds  →')

  // Add y axis (frequency scale)
  const frequencyScale = d3Scale.scaleLinear()
    .domain([frequencyData.minFrequency, frequencyData.maxFrequency])
    .range([spectrogramWHeight, 0])
  const frequencyAxis = d3Axis.axisLeft(frequencyScale)
    .ticks(10)
    // convert to kHz
    .tickFormat(hz => `${hz / 1000}`)

  svg.append('g')
    .attr('class', 'yAxis')
    .attr('transform', `translate(${spectroMargin.left},${spectroMargin.top})`)
    .call(frequencyAxis)
    // Add label for axis
    .append('g')
    .append('text')
    // Position axis label so arrow roughly aligns with y axis
    .attr('transform', `translate(${-3},${-5})`)
    .attr('fill', 'black')
    .attr('text-anchor', 'start')
    .text('↑ kHz')

  // Add playback buttons

}

function addPlaybackButtons({audioBuffer, svg, height, width, spectroMargin, iconSize = 30}) {
  const spectroPadding = 5
  let playbackActive = false
  let playbackNode
  let playbackLineAnimationId
  let playbackStartedAt
  const audioContext = new AudioContext()

  const playbackLine = svg
    .append('g')
    .attr('class', 'playbackPositionLine')
    .append('line')
    .attr('x1', spectroMargin.left)
    .attr('x2', spectroMargin.left)
    .attr('y1', spectroMargin.top)
    .attr('y2', height - spectroMargin.bottom)
    .attr('stroke', 'black')
    .attr('opacity', 0)

  const playbackIcon = svg.append('g')
    .attr('class', 'play-icon')
    .attr('transform', 
      `translate(${width - (iconSize + spectroMargin.right)},${spectroMargin.top - spectroPadding - iconSize})`)
    .on('click', () => {
      updatePlaybackButtonAndLine(!playbackActive)
      playbackActive = !playbackActive
      if (playbackActive) {
        playbackNode = playBuffer({
          audioContext,
          buffer  : audioBuffer,
          onEnded : () => {
            updatePlaybackButtonAndLine(false)
            playbackActive = false
          }})
        playbackStartedAt = audioContext.currentTime
        animatePlaybackLine()
      } else if (playbackNode) {
        playbackNode.stop()
      }
    })

  playbackIcon.append('image')
    .attr('id', 'playback-icon')
    .attr('width', iconSize)
    .attr('height', iconSize)
    .attr('xlink:href', playIcon)
    .attr('opacity', 0.25)

  function updatePlaybackButtonAndLine(isBeingPlayedBack) {
    d3Selection.select('#playback-icon')
      .attr('xlink:href', isBeingPlayedBack ? stopIcon : playIcon)

    playbackLine
      .attr('opacity', isBeingPlayedBack ? 1.0 : 0.0)

    if (!isBeingPlayedBack) {
      cancelAnimationFrame(playbackLineAnimationId)
    }
  }

  /** 
   * Creates and animates a line to show the current playback position and animates it.
   * @return {number} the requestAnimationFrame ID for cancelling 
   */
  function animatePlaybackLine() {
    // Draw a vertical line to show current position of playback
    const timeElapsed = audioContext.currentTime - playbackStartedAt
    const percentComplete = timeElapsed / audioBuffer.duration 

    const spectroWidth = width - spectroMargin.left - spectroMargin.right
    const xPosition = spectroMargin.left + spectroWidth * percentComplete

    playbackLine
      .attr('x1', xPosition)
      .attr('x2', xPosition)

    playbackLineAnimationId = requestAnimationFrame(animatePlaybackLine)
  }
}

/**
 * Plays the provided audio buffer.
 * @param {!AudioBuffer} buffer
 * @param {!AudioContext} audioContext
 * @param {!Function} function to call when playback has ended
 * @return {!AudioBufferSourceNode} the node where playback was started. 
 *     May be used to call stop() or listen for onEnded.
 */
function playBuffer({buffer, audioContext, onEnded}) {
  const source = new AudioBufferSourceNode(audioContext, {buffer})
  source.onended = onEnded

  source.connect(audioContext.destination)
  source.start()

  return source
}

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

    this.drawSpectrogramData(this.frequencyData.data)


    // Create svg that will contain the axis
    this.svg = this.container
      .append('svg')
      .attr('class', 'spectrogramTool')
      .style('position', 'absolute')
      .attr('width', this.width)
      // TODO check why + 20?
      .attr('height', this.height + 20)

    // TODO also move these functions into the class 
    drawSpectrogramAxis({
      frequencyData : this.frequencyData, 
      svg           : this.svg, 
      width         : this.width, 
      height        : this.height, 
      spectroMargin : this.spectroMargin
    })
    addPlaybackButtons({
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
  // TODO look into why lower frequencies are not getting drawn.
  drawSpectrogramData(data) {
    this.sonogramCtx.fillStyle = 'rgb(240, 240, 240)'
    this.sonogramCtx.fillRect(0, 0, this.width, this.height)

    // Draw spectrogram
    const decibleColorScale = d3Scale.scaleLinear()
      // getAudioFrequencyData returns a normalized array of values
      // between 0 and 255
      .domain([0, 255])
      .range(['rgba(70, 130, 180, 0)', 'rgba(70, 130, 180, 1.0)'])
    console.log('Frequency bin count:', data[0].length)
    console.log('Num samples:', data.length)
    const frequencyBinCount = data[0].length
    const barWidth = this.width / data.length
    for (let x = 0; x < data.length; x++) {
      for (let y = 0; y < frequencyBinCount; y++) {
        const intensity = data[x][y] 
        const barHeight = this.height / frequencyBinCount
        this.sonogramCtx.fillStyle = decibleColorScale(intensity)
        this.sonogramCtx.fillRect(
          x * barWidth,
          this.height - (y * barHeight),
          barWidth,
          barHeight,
        )
      }
    }
  }
}

// TODO move to index.js
Spectrogram.fromFile(robinSwift)
