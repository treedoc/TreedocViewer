import YAML from 'yaml';
import { ParserPlugin, ParseResult } from '../models/TDVOption';
import { Bookmark, TD, TDNode, TDNodeType, TDObjectCoder, TreeDoc } from 'treedoc';
import XMLParserPlugin from './XMLParserPlugin';
import Util from '../util/Util';
import { Node, YAMLMap, Pair, YAMLSeq, Scalar } from 'yaml/types';
import { Type } from 'yaml/util';
import TextLine from '@/util/TextLine';

export class YMLParserOption {
}

export default class YAMLParserPlugin implements ParserPlugin<YMLParserOption> {
  name = 'YAML';
  syntax = 'yaml';
  option: YMLParserOption = {};

  looksLike(str: string): boolean {
    if (new XMLParserPlugin().looksLike(str))
      return false;

    if (Util.nonBlankStartsWith(str, ['{', '[', '/']))  // Don't accept JSON
      return false;

    // A line aligned partial YAML from beginning is also a valid YAML file
    // JSON is not the case. That's how we guess if the file is a YAML instead of JSON.
    const topLines = Util.topLines(str, 5000);
    if (topLines.numLines <= 1)
      return false;  // Single line 

    try {
      YAML.parseAllDocuments(str.substring(0, topLines.length));
      return true;
    } catch (e) {
      return false;
    }
  }

  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      // Not sure why some string accepted by parse(), but can't accepted by parseAllDocuments()
      // const doc = YAML.parseAllDocuments(str);
      // doc[0].cstNode

      result.result =this.parseYaml(str);
      result.message = 'YAML.parse()';
      return result;
    } catch (e) {
      result.message = `Error:${(e as any).message}`;
      console.error(e);
      return result;
    }
  }

  private textLine?: TextLine;   // Assume no concurrent parsing
  /** Try parse and parseAllDocuments */
  parseYaml(str: string): any {
    this.textLine = new TextLine(str);
    const yaml = YAML.parseAllDocuments(str);
    const doc = new TreeDoc();
    if (yaml.length === 1) {
      this.toTDNode(yaml[0].contents!, doc.root);
    } else {
      doc.root.type =  TDNodeType.ARRAY;
      doc.root.children = yaml.map(y => this.toTDNode(y.contents!, doc.root.createChild()));
    }
    return doc.root;
  }

  toTDNode(yaml: Node | undefined, node: TDNode): TDNode {
    // console.log(TD.stringify(yaml));
    // console.log(yaml.type);
    if (!yaml)
      return node;

    switch(yaml?.type) {
      case Type.FLOW_MAP:
      case Type.MAP: 
        this.toTDNodeMap(yaml as YAMLMap, node); break;
      case Type.FLOW_SEQ:
      case Type.SEQ: 
        this.toTDNodeAray(yaml as YAMLSeq, node); break;
      // Scala.Type
      case Type.PLAIN:
      case Type.BLOCK_FOLDED:
      case Type.BLOCK_LITERAL:
      case Type.PLAIN:
      case Type.QUOTE_DOUBLE:
      case Type.QUOTE_SINGLE:
         node.value = (yaml as Scalar).value; break;
      default: console.warn(`Unsupported type: ${yaml?.type}, ${TD.stringify(yaml)}, ${typeof yaml}, ${Object.keys(yaml)}`);
    }
    node.start = this.textLine!.getBookmark(yaml.range![0]);
    node.end = this.textLine!.getBookmark(yaml.range![1]);

    return node;
  }

  toTDNodeMap(yaml: YAMLMap, node: TDNode) {
    node.type = TDNodeType.MAP;
    for (const item of yaml.items as Pair[]) {
      const cNode = node.createChild(item.key.value)
      this.toTDNode(item.value, cNode);
    }
    return node;
  }

  toTDNodeAray(yaml: YAMLSeq, node: TDNode) {
    node.type = TDNodeType.ARRAY;
    for (const item of yaml.items) {
      const cNode = node.createChild();
      this.toTDNode(item, cNode);
    }
    return node;
  }

  stringify(obj: any): string {
    return YAML.stringify(obj);
  }
}
