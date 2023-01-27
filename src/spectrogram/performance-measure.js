/**
 * Instance based version of web Performance API.
 */
class PerformanceMeasure {

  /**
   * @param {string} id
   */
  constructor (id) {
    const FIXED_ID_LENGTH = 15

    // Get constant length ID for logging timeline
    this.id = id.padEnd(FIXED_ID_LENGTH, '.').substring(0, FIXED_ID_LENGTH)
    this.activeMarks = []
    this.activeMeasures = []
  }

  /**
   * @param {string} name
   */
  getName(name) {
    return `[${this.id}] ` + name
  }

  /**
   * @param {string} name
   */
  mark(name) {
    const markName = this.getName(name)
    performance.mark(markName)
    this.activeMarks.push(markName)
  }

  /**
   * @param {string} name
   */
  measure(name) {
    const measureName = this.getName(name)
    performance.measure(measureName, measureName)
    this.activeMeasures.push(measureName)
  }

  logAndClearPerformanceMeasures() {
    performance.getEntriesByType('measure')
      .filter(m => m.name.includes(this.id))
      .sort((a,b) => 
        (a.startTime - b.startTime) || 
      // If startTime is equal, show the one that finishes last first.
      (b.duration - a.duration) )
      .forEach(m => 
        console.log(
          `${m.name.padEnd(40)} ` + 
        `startTime: ${m.startTime.toFixed(1).padStart(6)}  ` +
        `duration: ${m.duration.toFixed(1).padStart(6)}` + 
        // Log a simple timeline.
        ' ['.padStart(m.startTime / 5) + ''.padEnd(m.duration / 5, '*') + ']'))

    this.activeMarks.forEach(mark => performance.clearMarks(mark))
    this.activeMeasures.forEach(measure => performance.clearMeasures(measure))
  }
}

export {PerformanceMeasure}