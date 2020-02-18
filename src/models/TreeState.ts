import { TDNode, TreeDoc, Bookmark, TDObjectCoder, TDNodeType, JSONPointer } from 'treedoc';
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

  maxPane = '';

  constructor(treeData: TDNode | string | any, parserPlugin = new JSONParser(), rootLabel = 'root', selectedPath: string[] = []) {
    this.parserPlugin = parserPlugin;
    this.tree = this.buildTree(treeData, rootLabel);
    if (this.tree) {
      this.tree.root.key = rootLabel;
      this.tree.root.freeze();
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

  public select(node: TDNode | string | string[], initial = false): void {
    if (this.tree == null)
      return;

    let selectedNode: TDNode | null = null;
    if (!(node instanceof TDNode)) {
      // when initial, we specify noNull, for the case that current node name is edited, so it can't be selected
      // we will fullback to its parent.
      selectedNode = this.findNodeByPath(node, initial);
      if (!selectedNode)
        return;
    } else
      selectedNode = node;

    if (initial)
      this.initialNode = selectedNode;
    if (this.selected === selectedNode)
      return;
    this.selected = selectedNode;
    if (selectedNode)
      this.history.append(selectedNode);

    // We don't auto select in case it's initial. If auto selected, when user edit the source
    // the user won't be able to continuous editing.
    if (!initial)
      this.selection = this.selected!;
  }

  private findNodeByPath(path: string | string[], noNull = false): TDNode {
    const cNode: TDNode = this.selected || this.tree.root;
    let node = cNode.getByPath(path);
    if (node)
      return node;

    if (typeof(path) !== 'string')
      return cNode;

    // special handling for google API schema, e.g. https://www.googleapis.com/discovery/v1/apis/vision/v1p1beta1/rest
    node = cNode.getByPath('/schemas/' + path);
    if (node)
      return node;

    // using json pointer standard
    const jsonPointer = JSONPointer.get().parse(path);
    if (jsonPointer.docPath) {
      console.warn(`Cross document reference is not supported: ${path}`);
      return cNode;
    }
    node = cNode.getByPath(jsonPointer);
    if (node)
      return node;
    return cNode;
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

  toggleMaxPane(pane: string) {
    console.log(`pane=${pane}`);
    if (this.maxPane)
      this.maxPane = '';
    else
      this.maxPane = pane;
  }
}
