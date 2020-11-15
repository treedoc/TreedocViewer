/**
 * History maintains a linear history path, the current position can be moved backward or forward
 * in the history stack. It won't store branching information, once append a new event at a particular position
 * the history stack after the pos will be trimmed. So that only a linear path will be maintained.
 */
export default class History<T> {
  items: T[] = [];
  pos = -1;

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

  append(element: T) {
    this.items.length = ++this.pos;
    this.items.push(element);
  }
}
