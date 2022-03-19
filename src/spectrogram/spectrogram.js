import * as d3Selection from 'd3-selection'
import {getAudioFrequencyData} from 'audio-frequency'
import robinSwift from '../data/robin-swift.wav'

getAudioFrequencyData(robinSwift,
  {
    sampleTimeLength      : 1/240,
    fftSize               : 2 ** 11,
    maxFrequency          : 11000,
    smoothingTimeConstant : 0.8,
  })
  .then(drawSpectrogram)

function drawSpectrogram(data, {width = 1400, height = 400} = {}) {
  console.log('data ready')

  const sonogramCtx = d3Selection.select('body')
    .append('canvas')
    .attr('class', 'spectrogram')
    .attr('width', width)
    .attr('height', height)
    .node()
    .getContext('2d')

  sonogramCtx.fillStyle = 'rgb(0, 0, 0)'
  sonogramCtx.fillRect(0, 0, width, height)

  // Draw spectrogram
  console.log('Frequency bin count:', data[0].length)
  console.log('Num samples:', data.length)
  const frequencyBinCount = data[0].length
  const barWidth = width / data.length
  for (let x = 0; x < data.length; x++) {
    for (let y = 0; y < frequencyBinCount; y++) {
      // analyser.getByteFrequencyData returns a normalized array of values
      // between 0 and 255
      const intensity = data[x][y] / 255
      const barHeight = height / frequencyBinCount
      sonogramCtx.fillStyle = 'hsl(228 51% ' + (intensity * 100) + '%)'
      sonogramCtx.fillRect(
        x * barWidth,
        height - (y * barHeight),
        barWidth,
        barHeight,
      )
    }
  }
}
