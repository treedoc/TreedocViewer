import { TDJSONParser, TDJSONParserOption, TDNodeType } from 'jsonex-treedoc';
import History from './History';
import Tree, { TreeNode } from './Tree';


// tslint:disable-next-line: prefer-const
let o: any | null;
export default class TreeState {
  parseResult = 'OBJECT';
  history = new History<TreeNode>();
  selected: TreeNode | null = null;
  initialNode?: TreeNode | null;
  tree: Tree;

  constructor(treeData: Tree | string | any, rootLabel = 'root') {
    this.tree = this.buildTree(treeData, rootLabel);
    if (this.tree)
      this.select(this.tree.root, true);
  }

  buildTree(treeData: Tree | string | any, rootLabel: string) {
    if (!treeData || treeData.constructor.name === 'Tree') {
      this.parseResult = 'TREE';
      return treeData;
    }
    const jsonObj = typeof(treeData) === 'string' ? this.parseJson(treeData) : treeData;
    return jsonObj ? new Tree(jsonObj, rootLabel) : null;
  }

  select(node: TreeNode | string | null, resetInitialNode = false): void {
    if (this.tree == null)
      return;

    let selectedNode: TreeNode | null = null;
    if (typeof(node) === 'string') {
      selectedNode = this.tree.root.getByPath(node);
      if (!selectedNode)
        return;
    } else
      selectedNode = node;

    if (resetInitialNode)
      this.initialNode = selectedNode;
    if (this.selected === selectedNode)
      return;
    this.selected = selectedNode;
    if (selectedNode)
      this.history.append(selectedNode);
  }

  isRootSelected() { return this.tree != null && this.selected === this.tree.root; }
  isInitialNodeSelected() { return this.tree != null && this.selected === this.initialNode; }
  canBack() { return this.history.canBack(); }
  canForward() { return this.history.canForward(); }
  back() { this.selected = this.history.back(); }
  forward() { this.selected = this.history.forward(); }

  parseJson(jsonStr: string) {
    try {
      const json = JSON.parse(jsonStr);
      this.parseResult = 'JSON_PARSE';
      return json;
    } catch (e) {
      try {
        /* eslint-disable no-eval */
        // tslint:disable-next-line: no-eval
        eval(`o=${jsonStr}`);
        this.parseResult = 'EVAL';
        return o;
      } catch (e1) {
        try {
          const o1 = TDJSONParser.get().parse(new TDJSONParserOption(jsonStr).setDefaultRootType(TDNodeType.MAP)).toObject();
          this.parseResult = 'TDJSON_PARSE';
          return o1;
        } catch (e2) {
          this.parseResult = `Error:${e2.message}`;
          console.error(e2);
        }
      }
    }
    return null;
  }
}
