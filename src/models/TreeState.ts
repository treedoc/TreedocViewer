import { TDNode, TreeDoc, Bookmark, TDObjectCoder, TDNodeType, JSONPointer, LangUtil } from 'treedoc';
import History from './History';
import { ParserPlugin, ParseStatus } from './TDVOption';
import JSONParserPlugin from '../parsers/JSONParserPlugin';
import { Query, Column } from '../components/Vue2DataTable';
import { TDVOption } from '@/lib';

const { doIfNotNull } = LangUtil;

export interface Selection {
  start?: Bookmark;
  end?: Bookmark;
}

/** State that will be saved in history */
class CurState {
  selection: Selection = {};
  constructor(public selected: TDNode | null = null) { }
}

export class TableNodeState {
  constructor(
    public query: Query,
    public expandedLevel: number,
    public columns: Column[],
    public isColumnExpanded: boolean) { }
}

export default class TreeState {
  parseResult = 'OBJECT';
  history = new History<CurState>();
  initialNode?: TDNode | null;
  tableStateCache: Map<string, TableNodeState> = new Map();

  tree: TreeDoc;

  // TODO: move to TableState
  hasTreeInTable = false;  // If there's tree widget in the cells

  curState = new CurState();

  maxPane = '';
  textWrap = false;
  showSource = [true];
  showTree = [true];
  showTable = [true];
  codeView = [true];

  constructor(treeData: TDNode | string | any, 
      public parserPlugin: ParserPlugin<any> = new JSONParserPlugin(),
      rootLabel = 'root', 
      selectedPath: string[] = []) {
    this.tree = this.buildTree(treeData, rootLabel)!;
    if (this.tree) {
      this.tree.root.key = rootLabel;
      this.tree.root.freeze();
      this.select(selectedPath, true);
    }
  }

  setInitSOpt(opt?: TDVOption) {
    doIfNotNull(opt?.maxPane, $ => this.maxPane = $);
    doIfNotNull(opt?.textWrap, $ => this.textWrap = $);
    doIfNotNull(opt?.showSource, $ => this.showSource[0] = $);
    doIfNotNull(opt?.showTree, $ => this.showTree[0] = $);
    doIfNotNull(opt?.showTable, $ => this.showTable[0] = $);  
    return this;  
  }

  retainState(orgState: TreeState) {
    if (orgState == null)
      return this;
    this.maxPane = orgState.maxPane;
    this.textWrap = orgState.textWrap;
    this.showSource = orgState.showSource;
    this.showTree = orgState.showTree
    this.showTable = orgState.showTable;
    this.codeView = orgState.codeView;
    return this;
  }

  buildTree(treeData: TDNode | string | any, rootLabel: string) {
    if (!treeData || treeData.constructor.name === 'TDNode') {
      this.parseResult = 'TreeDoc';
      return (treeData as TDNode).doc;
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
    } else
      selectedNode = node;

    if (initial)
      this.initialNode = selectedNode;
    if (this.curState.selected === selectedNode)
      return;
    this.curState = new CurState(selectedNode);
    this.curState.selected = selectedNode;
    if (selectedNode)
      this.history.append(this.curState);

    // We don't auto select in case it's initial. If auto selected, when user edit the source
    // the user won't be able to continuous editing.
    if (!initial)
      this.curState.selection = this.curState.selected!;
  }

  public saveTableState(node: TDNode, state: TableNodeState) {
    this.tableStateCache.set(node.pathAsString, state);
  }

  public getTableState(node: TDNode) {
    return this.tableStateCache.get(node.pathAsString);
  }

  get selected() { return this.curState.selected; }
  get selection() { return this.curState.selection; }

  public findNodeByPath(path: string | string[], noNull = false): TDNode {
    const cNode: TDNode = this.curState.selected || this.tree.root;
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
  back() { this.curState = this.history.back()!; }
  forward() { this.curState = this.history.forward()!; }

  parse(jsonStr: string) {
    const result = this.parserPlugin.parse(jsonStr);
    this.parseResult = result.message;
    return result.result;
  }

  toggleMaxPane(pane: string) {
    if (this.maxPane)
      this.maxPane = '';
    else
      this.maxPane = pane;
  }
}
