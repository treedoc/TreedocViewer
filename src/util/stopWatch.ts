
export class StopWatch {
  startTime: number;
  constructor() {
    console.log(`[StopWatch] start at ${new Date()}`);
    this.startTime = Date.now();
  }

  get elapsed(): number {
    return Date.now() - this.startTime;
  }

  reset() {
    this.startTime = Date.now();
  }

  logWithReset(msg: string) {
    console.log(`[StopWatch] ${msg} ${this.elapsed}ms`);
    this.reset();
  }
}
const instance = new StopWatch();
export default instance;

