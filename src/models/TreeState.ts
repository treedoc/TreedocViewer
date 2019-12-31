import { TDNode, TreeDoc, Bookmark, TDObjectCoder, TDNodeType } from 'jsonex-treedoc';
import History from './History';
import { ParserPlugin, ParseStatus } from './JTTOption';
import JSONParser from '@/parsers/JSONParser';

export interface Selection {
  start?: Bookmark;
  end?: Bookmark;
}

export default class TreeState {
  parseResult = 'OBJECT';
  parseStatus = ParseStatus.SUCCESS;
  parserPlugin: ParserPlugin<any>;

  history = new History<TDNode>();
  selected: TDNode | null = null;
  selection: Selection = {};
  initialNode?: TDNode | null;
  tree: TreeDoc;

  constructor(treeData: TDNode | string | any, parserPlugin = new JSONParser(), rootLabel = 'root', selectedPath: string[] = []) {
    this.parserPlugin = parserPlugin;
    this.tree = this.buildTree(treeData, rootLabel);
    if (this.tree) {
      this.tree.root.key = rootLabel;
      this.select(selectedPath, true);
    }
  }

  buildTree(treeData: TDNode | string | any, rootLabel: string) {
    if (!treeData || treeData.constructor.name === 'TreeDoc') {
      this.parseResult = 'TreeDoc';
      return treeData as TreeDoc;
    }
    const tdNode = typeof(treeData) === 'string' ? this.parse(treeData) : TDObjectCoder.get().encode(treeData);
    return tdNode && tdNode.doc;
  }

  select(node: TDNode | string | string[], initial = false): void {
    if (this.tree == null)
      return;

    let selectedNode: TDNode | null = null;
    if (!(node instanceof TDNode)) {
      selectedNode = this.tree.root.getByPath(node, true);
      // if (!selectedNode)
      //   return;
    } else
      selectedNode = node;

    if (initial)
      this.initialNode = selectedNode;
    if (this.selected === selectedNode)
      return;
    this.selected = selectedNode;
    if (selectedNode)
      this.history.append(selectedNode);

    if (!initial)
      this.selection = this.selected!;
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
