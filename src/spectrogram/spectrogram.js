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

  const decibleColorScale = d3Scale.scaleLinear()
    // getAudioFrequencyData returns a normalized array of values
    // between 0 and 255
    .domain([0, 255])
    .range(['rgba(70, 130, 180, 0)', 'rgba(70, 130, 180, 1.0)'])

  // Draw spectrogram
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
