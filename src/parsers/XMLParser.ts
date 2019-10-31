import { ParserPlugin, ParseResult } from '../models/JTTOption';
import _ from 'lodash';

export class XMLParserOption  {
}

interface XNode {
  type?: string;
  name?: string;
  tag?: string;
  value?: string | null;
  attr?: {[key: string]: string | null};
  text?: string;
  children?: XNode [];
}

export default class XMLParser implements  ParserPlugin<XMLParserOption> {
  option: XMLParserOption = {};

  constructor(
    public name = 'XML',
    private mineType: SupportedType = 'text/xml',
    private compact: boolean = false) {}

  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      const doc = new DOMParser().parseFromString(str, this.mineType);
      const root = doc.childNodes.length < 2 ? doc.childNodes[0] : doc;
      result.result = this.docToObj(root);
      if (this.compact)
        result.result = { [result.result.tag || result.result.name] : this.compactToObject(result.result)};
      result.message = 'DOMParser().parseFromString()';
      return result;
    } catch (e) {
      result.message = `Error:${e.message}`;
      console.error(e);
      return result;
    }
  }

  docToObj(node: Node) {
    const result: XNode = {};
    if (!this.compact)
      result.type = node.constructor.name;
    if (node instanceof Element) {
      result.tag = node.tagName;
      if (node.getAttributeNames) {
        node.getAttributeNames().forEach(a => {
          result.attr = result.attr || {};
          result.attr[a] = node.getAttribute(a);
        });
      }
    // } else if (node instanceof Comment) {
    //   result.text = node.textContent;
    //   result.nodeValue = node.textContent;
    } else {
      result.name = node.nodeName;
      result.value = node.nodeValue;
    }

    if (node.childNodes) {
      node.childNodes.forEach(c => {
        if (c instanceof Text) {
          if (c.textContent && c.textContent.trim())
            result.text = (result.text || '') + c.textContent;
        } else {
          result.children = result.children || [];
          result.children.push(this.docToObj(c));
        }
      });
    }
    return result;
  }

  private addToMap(map: any, key: string, val: any) {
    let vals = map[key];
    if (!vals) {
      vals = [] as any[];
      map[key] = vals;
    }
    vals.push(val);
  }

  compactToObject(n: XNode): any {
    if (!n.attr && !n.children) // Simple node
      return n.text;

    const map: {[key: string]: any[]} = {};
    if (n.attr) {
      Object.keys(n.attr).forEach(key => {
        this.addToMap(map, key, n.attr![key]);
      });
    }
    const comments: string[] = [];
    if (n.children) {
      n.children.forEach(c => {
        if (!c.tag) {   // Assume it's comment
          if (c.value)
            comments.push(c.value);
          else
            console.error('unknown node: ' + c);
          return;
        }

        let cnode: any = this.compactToObject(c);
        if (comments.length > 0) {
          if (_.isObject(cnode)) {
            // ts could narrow the type based on the _.isObject method signiture by type predicate
            // (method) LoDashStatic.isObject(value?: any): value is object
            (cnode as any)['@comments'] = [...comments];
          } else
            cnode = {'@comments': [...comments], '@val': cnode};

          comments.length = 0;
        }
        this.addToMap(map, c.tag, cnode);
      });
    }

    const res: {[key: string]: any} = {};
    Object.keys(map).forEach(k => {
      res[k] = map[k].length === 1 ? map[k][0] : map[k];
    });
    if (n.text)
      res['@val'] = n.text;

    if (comments.length > 0)
      res['@comments'] = [...comments];

    return res;
  }

  stringify(obj: any): string {
    return '';
  }
}
