import _ from 'lodash';

import { TDNode, TDNodeType } from 'treedoc';

export default class TreeUtil {
  static readonly KEY_TYPE = '$type';
  static readonly KEY_ID = '$id';
  static readonly KEY_REF = '$ref';

  static getSimpleTypeName(typeName: string): string {
    const p = typeName.indexOf('<'); // remove generic types
    if (p > 0)
      typeName = typeName.substr(0, p);
    const p2 = typeName.lastIndexOf('.');
    return p2 < 0 ? typeName : typeName.substring(p + 1, p2);
  }

  static getValue(node: TDNode, key: string) {
    return node.getChildValue(key);
  }

  static getTypeLabel(node: TDNode) {
    let t = null; // TODO: support type factory
    const type = this.getValue(node, TreeUtil.KEY_TYPE);
    if (type && typeof(type) === 'string')
      t = type;
    if (!t)
      return '';
    return TreeUtil.getSimpleTypeName(t);
  }

  static getTypeSizeLabel(node: TDNode) {
    let label = node.type === TDNodeType.ARRAY ? `[${node.getChildrenSize()}]` : `{${node.getChildrenSize()}}`;
    let tl = this.getTypeLabel(node);
    const id = this.getValue(node, TreeUtil.KEY_ID);
    if (id)
      tl += `@${id}`;

    if (tl.length > 0) // Special handling for type and hash
      label += ` <${tl}>`;
    return label;
  }
}
