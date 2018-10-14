import _ from 'lodash';

class Util {
  static getSimpleTypeName(typeName) {
    const p = typeName.indexOf('<'); // remove generic types
    if (p > 0)
      typeName = typeName.substr(0, p);
    const p2 = typeName.lastIndexOf('.');
    return p2 < 0 ? typeName : typeName.substring(p + 1, p2);
  }
}

export default class Tree {
  static TAG_TYPE = '$type';
  static TAG_HASH = '$hash';
  static TAG_HASH_PREFIX = '$hash:';

  constructor(obj, rootLabel = 'root') {
    this.obj = obj;
    this.hashMap = {};
    this.tagType = Tree.TAG_TYPE;
    this.tagHash = Tree.TAG_HASH;
    this.tagHashPrefix = Tree.TAG_HASH_PREFIX;
    /* eslint-disable no-use-before-define */
    this.root = new TreeNode(this, null, rootLabel, obj);
  }

  toString() {
    return `root:${this.root.toString()}`;
  }
}

export class TreeNode {
  constructor(tree, parent, key, obj) {
    this.tree = tree;
    this.parent = parent;
    this.key = key;
    this.obj = obj;
    this._children = null;

    if (this.hash)
      this.hashMap[this.hash] = this;
  }

  get hash() {
    return this.getChildValue(this.tagHash);
  }

  getChildValue(key) {
    return this.obj && this.obj[key];
  }

  get typeSizeLabel() {
    let label = _.isArray(this.obj) ? `[${this.obj.length}]` : `{${Object.keys(this.obj).length}}`;
    let tl = this.typeLabel;
    if (this.hash)
      tl += ` @ ${this.hash}`;

    if (tl.length > 0) // Speical handling for type and hash
      label += ` <${tl}>`;
    return label;
  }

  get typeLabel() {
    let t = null; // TODO: support type factory
    if (this.type)
      t = this.type;
    if (!t)
      return '';
    return Util.getSimpleTypeName(t);
  }

  get type() {
    return this.getChildValue(this.tree.tagType);
  }

  toString(indent = '') {
    let str = `${indent}${this.label}: ${this.obj}\n`;
    for (const c of Object.keys(this.children)) {
      str += this.children[c].toString(`${indent}  `);
    }
    return str;
  }

  isLeaf() { return _.isEmpty(this.children); }
  isArray() { return _.isArray(this.obj); }
  isObject() { return _.isObject(this.obj); }
  isSimpleType() { return !this.isArray() && !this.isObject(); }

  get size() { return _.size(this.children); }
  get children() {
    if (this._children == null) {
      this._children = {};
      const ia = _.isArray(this.obj);
      const io = _.isObject(this.obj);
      if (!io)
        return this._children;
      const cks = this.obj ? Object.keys(this.obj) : [];
      if (!ia && this.tree.sorted)
        cks.sort();

      for (const ck of cks) {
        const cv = this.obj[ck];
        if (cv === null || ck === this.tree.tagType || ck === this.tree.tagHash)
          continue;
        this.children[ck] = new TreeNode(this.tree, this, ck, cv, this);
      }
    }
    return this._children;
  }

  /**
   * @param {Array | String} path
   * @returns TreeNode
   */
  getByPath(path) {
    if (_.isString(path))
      path = path.split('/');

    if (path.length === 0)
      return this;
    let node = null;
    if (path[0] === '..')
      node = this.parent;
    else if (path[0] === '')
      node = this.tree.root;
    else if (path[0] === '.')
      node = this;
    else
      node = this.children[path[0]];
    path.shift();
    return node ? node.getByPath(path) : null;
  }
}

Object.defineProperty(TreeNode.prototype, 'label', { enumerable: true });
Object.defineProperty(TreeNode.prototype, 'children', { enumerable: true });
