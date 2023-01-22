/* eslint-disable no-unused-vars */
import './style.css'
import * as d3Selection from 'd3-selection'
import {Spectrogram} from './spectrogram/spectrogram.js'
import crossbillsRaven from './data/crossbills-raven.wav'
import grosbeak from './data/blackheaded-grosbeak-song.wav'
import mexicanJays from './data/mexican-jays.wav'
import robinSwift from './data/robin-swift.wav'
import savannahOptimized from './data/savannah-optimized.wav'
import solitaire from './data/solitaire.wav'
import spottedTowhee from './data/spotted-towhee.wav'
import towheeSong from './data/towhee-song.wav'
import willow from './data/willow.wav'
import willowTwoCalls from './data/willow-two-calls.wav'

d3Selection.selectAll('spectrogram')
  .each(function () { Spectrogram.forElement(this) })