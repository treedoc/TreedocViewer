export default class History {
  constructor() {
    this.items = [];
    this.pos = -1;
  }

  canBack() { return this.pos > 0; }
  back() {
    if (!this.canBack())
      return null;
    return this.items[--this.pos];
  }

  canForward() { return this.pos < this.items.length - 1; }
  forward() {
    if (!this.canForward())
      return null;
    return this.items[++this.pos];
  }

  append(element) {
    this.items.length = ++this.pos;
    this.items.push(element);
  }
}
