import { TDJSONParser, TDJSONParserOption, TDNodeType } from 'jsonex-treedoc';
import History from './History';
import Tree, { TreeNode } from './Tree';
import { ParserPlugin, ParseResult, ParseStatus } from './JTTOption';
import JSONParser from '@/parsers/JSONParser';


// tslint:disable-next-line: prefer-const
let o: any | null;
export default class TreeState {
  parseResult = 'OBJECT';
  parseStatus = ParseStatus.SUCCESS;
  parserPlugin: ParserPlugin<any>;

  history = new History<TreeNode>();
  selected: TreeNode | null = null;
  initialNode?: TreeNode | null;
  tree: Tree;

  constructor(treeData: Tree | string | any, parserPlugin = new JSONParser(), rootLabel = 'root') {
    this.parserPlugin = parserPlugin;
    this.tree = this.buildTree(treeData, rootLabel);
    if (this.tree)
      this.select(this.tree.root, true);
  }

  buildTree(treeData: Tree | string | any, rootLabel: string) {
    if (!treeData || treeData.constructor.name === 'Tree') {
      this.parseResult = 'TREE';
      return treeData;
    }
    const jsonObj = typeof(treeData) === 'string' ? this.parse(treeData) : treeData;
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

  parse(jsonStr: string) {
    const result = this.parserPlugin.parse(jsonStr);
    this.parseResult = result.message;
    this.parseStatus = result.status;
    return result.result;
  }
}
