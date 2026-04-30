/**
 * Manages playback across multiple spectrogram widgets on a page.
 */
class PlaybackOrchestrator {
  /**
   *  @param {!Array<!Spectrogram>} spectrograms
   */
  constructor(spectrograms) {
    this.spectrograms = spectrograms

    // Control global playback via Space.
    document.addEventListener('keydown', (e) => {
      if (e.code == 'Space') {
        e.preventDefault()
        this.toggleGlobalPlayback()
      }
    })
  }

  toggleGlobalPlayback() {
    const lastInteracted = this.spectrograms
      .reduce((spectroA, spectroB) => 
        (spectroA.getLastInteractionTime() >= 
        spectroB.getLastInteractionTime())
          ? spectroA
          : spectroB
      )

    // First check if any playback is active; if so stop it.
    const activePlayers = this.spectrograms
      .filter(spectrogram => spectrogram.isPlaybackActive())

    if (activePlayers.length > 0) {
      activePlayers
        .forEach(spectrogram => spectrogram.stopPlayback())
    }
    if (!activePlayers.includes(lastInteracted)) {
      // start playback on last active.
      lastInteracted.togglePlayback()
    }
  }
}

export {PlaybackOrchestrator}
