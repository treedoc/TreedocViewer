export default class Lazy<T> {
  private val: T|null = null;
  get(supplier: () => T) {
    if (this.val !== null) {
      this.val = supplier();
    }
    return this.val!;
  }
}
