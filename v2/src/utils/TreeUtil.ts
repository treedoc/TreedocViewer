import { TDNode, TDNodeType } from 'treedoc';
import { Logger } from './Logger';
const logger = new Logger('TreeUtil')


export default class TreeUtil {
  static readonly KEY_TYPE = '$type';
  static readonly KEY_ID = '$id';
  static readonly KEY_REF = '$ref';

  static getSimpleTypeName(typeName: string): string {
    const p = typeName.indexOf('<'); // remove generic types
    if (p > 0)
      typeName = typeName.substr(0, p);
    const p2 = typeName.lastIndexOf('.');
    return p2 < 0 ? typeName : typeName.substring(p2 + 1);
  }

  static getTypeLabel(node: TDNode) {
    let t = null; // TODO: support type factory
    const type = node.getChildValue(TreeUtil.KEY_TYPE);
    if (type && typeof(type) === 'string')
      t = type;
    if (!t)
      return '';
    return TreeUtil.getSimpleTypeName(t);
  }

  static getTypeSizeLabel(node: TDNode, includeSummary = false) {
    logger.log(`getTypeSizeLabel: start`)
    let label = node.type === TDNodeType.ARRAY ? `[${node.getChildrenSize()}]` : `{${node.getChildrenSize()}}`;
    let tl = this.getTypeLabel(node);
    const id = node.getChildValue(TreeUtil.KEY_ID);
    if (id)
      tl += `@${id}`;

    if (tl.length > 0) // Special handling for type and hash
      label += ` <${tl}>`;

    if (includeSummary)
      label = node.toStringInternal(label, false, false, 100);

    logger.log(`getTypeSizeLabel: end`)
    return label
  }
}
