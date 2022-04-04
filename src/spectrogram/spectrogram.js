import * as d3Axis from 'd3-axis'
import * as d3Selection from 'd3-selection'
import * as d3Scale from 'd3-scale'
import {AudioData} from 'audio-frequency'
import robinSwift from '../data/robin-swift.wav'

getAndDrawData(robinSwift)

async function getAndDrawData(audioFile, {width = 1400, height = 400} = {}) {
  const audioData = await AudioData.fromFile(audioFile)
  const frequencyData = await audioData.getFrequencyData({
    sampleTimeLength      : 1/140,
    fftSize               : 2 ** 11,
    maxFrequency          : 11000,
    smoothingTimeConstant : 0.8,
  })

  const margin = {top: 20, right: 20, bottom: 20, left: 20},
    spectroWidth = width - margin.left - margin.right,
    spectroHeight = height - margin.top - margin.bottom

  // Create div container forr spectrogram tool.
  const container = d3Selection.select('body')
    .append('div')
    .attr('class', 'sonogramVisualizer')
    .style('position', 'relative')

  // Create canvas for drawing spectrogram data.
  const sonogramCanvas = container
    .append('canvas')
    .attr('class', 'spectrogram')
    .attr('width', spectroWidth)
    .attr('height', spectroHeight)
  sonogramCanvas
    .style('position', 'absolute')
    .style('left', `${margin.left}px`)
    .style('top', `${margin.top}px`)
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
  drawSpectrogramAxis({audioData, svg, width, height, spectrogramMargin: margin})

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
 * @param {AudioData} audioData
 */
function drawSpectrogramAxis({audioData, svg, width = 1400, height = 400, spectrogramMargin} = {}) {
  console.log('audioData.duration:', audioData.duration)
  const spectrogramWidth = width - spectrogramMargin.left - spectrogramMargin.right 
  const spectrogramWHeight = height - spectrogramMargin.top - spectrogramMargin.bottom
  const timeScale = d3Scale.scaleLinear()
    .domain([0, audioData.duration])
    .range([0, spectrogramWidth])
  const timeAxis = d3Axis.axisBottom(timeScale)
    .ticks(Math.floor(audioData.duration))

  svg.append('g')
    .attr('class', 'x axis')
    .attr('transform', `translate(${spectrogramMargin.left},${height - spectrogramMargin.bottom})`)
    .call(timeAxis)
}
