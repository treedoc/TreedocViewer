// @ts-check
export class PaneStatus {}
PaneStatus.NORMAL = new PaneStatus();
PaneStatus.MAXIMIZED = new PaneStatus();
PaneStatus.MIIMIZED = new PaneStatus();

export class Range {
  /**
   * @param {Number} min
   * @param {Number} max
   */
  constructor(min = 0, max = 0) {
    this.min = min;
    this.max = max;
  }

  /**
   * @param {number} num
   * @returns {boolean}
   */
  contains(num) {
    return num > this.min && num < this.max;
  }

  /**
   * @param {Range} other
   */
  add(other) {
    this.min += other.min;
    if (this.max === Number.MAX_VALUE && other.max === Number.MAX_VALUE)
      return;
    this.max += other.max;
  }
}

export class Pane extends Range {
  /**
   * @param {String} name
   * @param {Number} [size = 0]  Assume the initial size should always between min and max
   * @param {Number} [min = 10]
   * @param {Number} [max = Number.MAX_VALUE]
   * @param {Number} [grow = 1] The propotion to fill the remain spaces
   */
  constructor(name, size, min, max, grow) {
    super(min || 10, max || Number.MAX_VALUE);
    this.name = name;
    this.size = size;
    this.curSize = size;
    this.grow = grow || 1;
    this.status = PaneStatus.NORMAL;
    /** @type {PaneSet} */
    this.paneSet = null;
  }

  /** @returns {Number} */
  getDisplaySize() {
    if (this.paneSet.maxPane != null)
      return this.paneSet.maxPane === this ? this.paneSet.totalSize : 0;
    return this.status === PaneStatus.NORMAL ? this.curSize : 0;
  }

  /** @returns {String} */
  toString() {
    return `{name:${this.name},curSize:${this.curSize.toFixed(2)}, grow:${this.grow.toFixed(2)}}`;
  }
}

export default class PaneSet {
  constructor() {
    this.totalSize = 0;
    /** @type {Pane[]} */
    this.panes = [];
    /** @type {Pane} */
    this.maxPane = null;
  }

  /** @returns {String} */
  toString() {
    return `{totalSize:${this.totalSize},panes:[${this.panes}]}`;
  }

  /** @param {Pane} pane */
  addPane(pane) {
    pane.paneSet = this;
    this.panes.push(pane);
  }

  /**
   * @param {string} name
   * @param {PaneStatus} status
   */
  setPaneStatus(name, status) {
    const pane = this.panes.find(p => p.name === name);
    if (!pane)
      throw new Error(`Pane not found: name=${name}`);
    if (pane.status === status)
      return;
    if (status === PaneStatus.MAXIMIZED)
      this.maxPane = pane;
    else
      pane.status = status;

    this.calculateSize();
  }

  calculateSize(fromIdx = 0, toIdx = this.panes.length, totalSize = this.totalSize) {
    /** @type {Set.<Pane>} */
    const remainPanes = new Set();
    const remain = {
      size: totalSize,
      grow: 0,
    };

    for (let i = fromIdx; i < toIdx; i++) {
      const p = this.panes[i];
      if (p.size) {
        remain.size -= p.size;
        p.size = 0;
        continue;
      }

      if (p.status === PaneStatus.NORMAL) {
        remainPanes.add(p);
        remain.grow += p.grow;
      }
    }

    while (remainPanes.size > 0) {
      const outFitPanel = PaneSet.findOutFit(remainPanes, remain);
      if (!outFitPanel)
        break;
      remainPanes.delete(outFitPanel);
      remain.size -= outFitPanel.curSize;
      remain.grow -= outFitPanel.grow;
    }

    const perSize = remain.size / remain.grow;
    remainPanes.forEach((p) => { p.curSize = perSize * p.grow; });
    this.panes.forEach((p) => { p.grow = p.curSize; });
  }

  /**
   * @param {Set<Pane>} remainPanes
   * @param {Object} remain
   * @returns {Pane} return null, if no more outfit panels
   */
  static findOutFit(remainPanes, remain) {
    const perSize = remain.size / remain.grow;
    /** @type {Pane} */
    let result = null;
    let delta = 0;
    let limitSize = 0;
    for (const p of Array.from(remainPanes)) {
      const size = perSize * p.grow;
      if (size < p.min && p.min - size > delta) {
        result = p;
        delta = p.min - size;
        limitSize = p.min;
      } else if (size > p.max && size - p.max > delta) {
        result = p;
        delta = size - p.max;
        limitSize = p.max;
      }
    }
    if (result != null)
      result.curSize = limitSize;
    return result;
  }

  /**
   * @param {Number} fromIdx
   * @param {Number} toIdx
   * @returns {Range}
   */
  getSizeRange(fromIdx = 0, toIdx = this.panes.length) {
    const res = new Range();
    for (let i = fromIdx; i < toIdx; i++) {
      const p = this.panes[i];
      if (p.status !== PaneStatus.NORMAL)
        continue;
      res.add(p);
    }
    return res;
  }

  /**
   *  @param {Number} idx
   */
  getHandlePos(idx) {
    let result = 0;
    for (let i = 0; i <= idx; i++) {
      result += this.panes[i].getDisplaySize();
    }
    return result;
  }

  /**
   * @param {number} idx
   * @param {number} pos
   */
  moveHandle(idx, pos) {
    if (!this.getSizeRange(0, idx + 1).contains(pos) ||
      !this.getSizeRange(idx + 1).contains(this.totalSize - pos))
      return;

    this.calculateSize(0, idx + 1, pos);
    this.calculateSize(idx + 1, this.panes.length, this.totalSize - this.getHandlePos(idx));
  }
}

