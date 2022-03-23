import * as d3Axis from 'd3-axis'
import * as d3Selection from 'd3-selection'
import * as d3Scale from 'd3-scale'
import {AudioData} from 'audio-frequency'
import robinSwift from '../data/robin-swift.wav'

getAndDrawData(robinSwift)

async function getAndDrawData(audioFile) {
  const audioData = await AudioData.fromFile(audioFile)
  const frequencyData = await audioData.getFrequencyData({
    sampleTimeLength      : 1/140,
    fftSize               : 2 ** 11,
    maxFrequency          : 11000,
    smoothingTimeConstant : 0.8,
  })
  drawSpectrogramData(frequencyData.data)
  drawSpectrogramAxis(audioData)
  console.log(frequencyData)
}

function drawSpectrogramData(data, {width = 1400, height = 400} = {}) {
  const sonogramCtx = d3Selection.select('body')
    .append('canvas')
    .attr('class', 'spectrogram')
    .attr('width', width)
    .attr('height', height)
    .node()
    .getContext('2d')

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
function drawSpectrogramAxis(audioData, {width = 1400, height = 400} = {}) {
  const svg = d3Selection.select('body')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    // TODO to change position of axis with respect to chart, specify a transform attribute

  console.log('audioData.duration:', audioData.duration)
  const timeScale = d3Scale.scaleLinear()
    .domain([0, audioData.duration])
    // TODO remove width - 1 once using margin/padding
    .range([0, width - 1])
  const timeAxis = d3Axis.axisBottom(timeScale)
    .ticks(39)
    // .tickSize(10)
    // .tickPadding(10)

  svg.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(0,' + (10) + ')')
    .call(timeAxis)
}