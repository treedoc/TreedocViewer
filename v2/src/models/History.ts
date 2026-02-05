export default class History<T> {
  private items: T[] = []
  private currentIndex = -1

  append(item: T): void {
    // Remove any forward history if we're not at the end
    if (this.currentIndex < this.items.length - 1) {
      this.items = this.items.slice(0, this.currentIndex + 1)
    }
    
    // Don't add duplicates
    if (this.items.length > 0 && this.items[this.currentIndex] === item) {
      return
    }
    
    this.items.push(item)
    this.currentIndex = this.items.length - 1
  }

  canBack(): boolean {
    return this.currentIndex > 0
  }

  canForward(): boolean {
    return this.currentIndex < this.items.length - 1
  }

  back(): T | undefined {
    if (this.canBack()) {
      this.currentIndex--
      return this.items[this.currentIndex]
    }
    return undefined
  }

  forward(): T | undefined {
    if (this.canForward()) {
      this.currentIndex++
      return this.items[this.currentIndex]
    }
    return undefined
  }

  current(): T | undefined {
    return this.items[this.currentIndex]
  }

  clear(): void {
    this.items = []
    this.currentIndex = -1
  }
}
