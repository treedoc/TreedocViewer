class Logger {
  private lastTime: number = performance.now()
  private startTime: number = performance.now()

  log(message: string, ...args: any[]) {
    const now = performance.now()
    const delta = now - this.lastTime
    const total = now - this.startTime
    
    console.log(
      `[+${delta}ms | ${total}ms] ${message}`,
      ...args
    )
    
    this.lastTime = now
  }

  reset() {
    this.lastTime = performance.now()
    this.startTime = performance.now()
  }

  group(label: string) {
    console.group(`[+0.00ms] ${label}`)
    this.lastTime = performance.now()
  }

  groupEnd() {
    const now = performance.now()
    const delta = now - this.lastTime
    console.log(`[Group duration: ${delta}ms]`)
    console.groupEnd()
    this.lastTime = now
  }
}

export const logger = new Logger()
export default logger
