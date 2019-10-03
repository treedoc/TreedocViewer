import _ from 'lodash';
import { TDJSONParser, TDJSONParserOption, TDNodeType } from 'jsonex-treedoc';
import History from './History';
import Tree from './Tree';


let o;
export default class TreeState {
  /**
   * @param {Tree | String | Object} treeData
   * @param {String} root
   */
  constructor(treeData, root) {
    this.tree = this.buildTree(treeData, root);
    this.history = new History();
    this.selected = null;
    this.initialNode = null;
    this.sourceType = 'OBJECT';
    if (this.tree)
      this.select(this.tree.root, true);
  }

  buildTree(treeData, root) {
    if (!treeData || treeData.constructor.name === 'Tree') {
      this.sourceType = 'TREE';
      return treeData;
    }
    const jsonObj = _.isString(treeData) ? this.parseJson(treeData) : treeData;
    return jsonObj ? new Tree(jsonObj, root) : null;
  }

  /**
   * @param {TreeNode | String} node
   * @param {Boolean} initialNode
   */
  select(node, initialNode) {
    if (this.tree == null)
      return;

    if (_.isString(node)) {
      node = this.tree.root.getByPath(node);
      if (!node)
        return;
    }

    if (initialNode)
      this.initialNode = node;
    if (this.selected === node)
      return;
    this.selected = node;
    this.history.append(node);
  }

  isRootSelected() { return this.tree != null && this.selected === this.tree.root; }
  isInitialNodeSelected() { return this.tree != null && this.selected === this.initialNode; }
  canBack() { return this.history.canBack(); }
  canForward() { return this.history.canForward(); }
  back() { this.selected = this.history.back(); }
  forward() { this.selected = this.history.forward(); }

  parseJson(jsonStr) {
    try {
      const json = JSON.parse(jsonStr);
      this.sourceType = 'JSON_PARSE';
      return json;
    } catch (e) {
      try {
        /* eslint-disable no-eval */
        eval(`o=${jsonStr}`);
        this.sourceType = 'EVAL';
        return o;
      } catch (e1) {
        try {
          return TDJSONParser.get().parse(new TDJSONParserOption(jsonStr).setDefaultRootType(TDNodeType.MAP)).toObject();
        } catch (e2) {
          console.error(e2);
        }
      }
    }
    return null;
  }
}
