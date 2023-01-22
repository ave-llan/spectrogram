import './style.css'
import * as d3Selection from 'd3-selection'
import {Spectrogram} from './spectrogram/spectrogram.js'

d3Selection.selectAll('spectrogram')
  .each(function () { Spectrogram.forElement(this) })