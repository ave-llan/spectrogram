/* eslint-disable no-unused-vars */
import './style.css'
import {Spectrogram} from './spectrogram/spectrogram.js'
import robinSwift from './data/robin-swift.wav'
import savannahOptimized from './data/savannah-optimized.wav'
import solitaire from './data/solitaire.wav'
import spottedTowhee from './data/spotted-towhee.wav'
import towheeSong from './data/towhee-song.wav'
import willow from './data/willow.wav'
import willowTwoCalls from './data/willow-two-calls.wav'

Spectrogram.fromFile(willowTwoCalls)