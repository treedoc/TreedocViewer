let lastTime: number = performance.now()
const startTime: number = performance.now()
  
class Logger {
  private name?: string

  constructor(name?: string) {
    this.name = name
  }

  private formatPrefix(delta: number, total: number): string {
    const prefix = `[+${delta.toFixed(2)}ms | ${total.toFixed(2)}ms]`
    return this.name ? `${prefix} [${this.name}]` : prefix
  }

  log(message: string, ...args: any[]) {
    const now = performance.now()
    const delta = now - lastTime
    const total = now - startTime
    
    console.log(
      `${this.formatPrefix(delta, total)} ${message}`,
      ...args
    )
    
    lastTime = now
  }

  group(label: string) {
    const prefix = this.name ? `[${this.name}]` : ''
    console.group(`[+0.00ms] ${prefix} ${label}`)
    lastTime = performance.now()
  }

  groupEnd() {
    const now = performance.now()
    const delta = now - lastTime
    console.log(`[Group duration: ${delta.toFixed(2)}ms]`)
    console.groupEnd()
    lastTime = now
  }
}

export { Logger }
export const logger = new Logger("default")
export default logger
