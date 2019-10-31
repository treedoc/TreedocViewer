import { ParserPlugin, ParseResult } from '../models/JTTOption';

export class XMLParserOption  {
}

export default class XMLParser implements  ParserPlugin<XMLParserOption> {
  option: XMLParserOption = {};

  constructor(
    public name = 'XML Compact',
    private mineType: SupportedType = 'text/xml') {}

  parse(str: string): ParseResult {
    const result = new ParseResult();
    try {
      const doc = new DOMParser().parseFromString(str, this.mineType);
      const root = doc.childNodes.length < 2 ? doc.childNodes[0] : doc;
      result.result = this.docToObj(root);
      result.message = 'DOMParser().parseFromString()';
      return result;
    } catch (e) {
      result.message = `Error:${e.message}`;
      console.error(e);
      return result;
    }
  }

  docToObj(node: Node) {
    const result: any = {};
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
      result.nodeName = node.nodeName;
      result.nodeValue = node.nodeValue;
    }

    if (node.childNodes) {
      node.childNodes.forEach(c => {
        if (c instanceof Text) {
          if (c.textContent && c.textContent.trim())
            result.text = (result.text || '') + c.textContent;
        } else {
          result.child = result.child || [];
          result.child.push(this.docToObj(c));
        }
      });
    }
    return result;
  }

  stringify(obj: any): string {
    return '';
  }
}
