import _ from 'lodash';

class Util {
  static getSimpleTypeName(typeName) {
    let p = typeName.indexOf("<");  // remove generic types
    if (p > 0)
      typeName = typeName.substr(0, p);
    p = typeName.lastIndexOf(".");
    return p < 0 ? typeName : typeName.substring(p + 1, p2);
  }
}

export class Tree {
  static TAG_TYPE = '@type';
  static TAG_HASH = '@hash';
  static TAG_HASH_PREFIX = "$hash:";
  
  constructor(obj, rootLabel = 'root') {
    this.obj = obj;
    this.hashMap = {};
    this.tagType = Tree.TAG_TYPE;
    this.tagHash = Tree.TAG_HASH;
    this.tagHashPrefix = Tree.TAG_HASH_PREFIX;
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
    this.children = null;
    
    if (this.hash)
      this.hashMap[this.hash] = this;
  }
  
  get hash() {
    return this.getChildValue(this.TAG_HASH)
  }

  getChildValue(key) {
    return this.obj && this.obj[key];
  }

  get label() {
    var label = _.isArray(this.value) ? `${this.key}[${this.value.length}]` : this.key;
    var typeLabel = this.typeLabel;
    if (this.hash)
      typeLabel += " @ " + this.hash;

    if (typeLabel.length > 0)  //Speical handling for type and hash
      label += ` <${typeLabel}>`;
    return label;
  }

  get typeLabel() {
    let type = null;  // TODO: support type factory
    if (this.type)
      type = this.type;
    if (!type)
      return "";
    return Util.getSimpleTypeName(type);
  }

  get type() {
		return this.getChildValue(this.tree.TAG_TYPE);
  }

  toString() {
    return `${this.label}:${this.obj}`;
  }
}

Object.defineProperty(TreeNode.prototype, 'label', {enumerable: true});
