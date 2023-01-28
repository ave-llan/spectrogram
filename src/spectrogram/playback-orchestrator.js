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
    document.addEventListener('keydown', ({code}) => {
      if (code == 'Space') {
        this.toggleGlobalPlayback()
      }
    })
  }

  toggleGlobalPlayback() {
    const lastInteracted = this.spectrograms
      .reduce((spectroA, spectroB) => 
        (spectroA.playbackController.getLastInteractionTime() >= 
        spectroB.playbackController.getLastInteractionTime())
          ? spectroA
          : spectroB
      )

    // First check if any playback is active; if so stop it.
    const activePlayers = this.spectrograms
      .filter(spectrogram => spectrogram.playbackController.isPlaybackActive())

    if (activePlayers.length > 0) {
      activePlayers
        .forEach(spectrogram => spectrogram.playbackController.stopPlayback())
    }
    if (!activePlayers.includes(lastInteracted)) {
      // start playback on last active.
      lastInteracted.playbackController.togglePlayback()
    }
  }
}

export {PlaybackOrchestrator}
