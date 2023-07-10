import { CharSource, LangUtil, ListUtil, StringCharSource } from 'treedoc'
import _ from 'lodash';

const HELP = 'HELP';
const TYPE = 'TYPE';
export class Metrics {
  [key: string]: Metric;
}

export class Metric {
  help: string = '';
  type: string = '';
  metricsValues: MetricValue[] = [];

  getOrCreateValue(labels: {[key: string]: string}): MetricValue {
    for (const m of this.metricsValues) {
      if (m.matchLabels(labels))
        return m;
    }
    const ret: MetricValue = new MetricValue();
    Object.assign(ret, labels)
    this.metricsValues.push(ret);
    return ret;
  }
}

export class MetricValue {
  [key: string]: any;
  value?: number;
  quantiles?: {[key: string]: number};
  // Use $$ prefix to avoid name conflict with a label of bucket
  $$bucket?: {[key: string]: number};  
  count?: number;
  sum?: number;

  addQuantile(key: string, value: number) {
    if (!this.quantiles) this.quantiles = {};
    this.quantiles[key] = value
  }
  addBucket(key: string, value: number) {
    if (!this.$$bucket) this.$$bucket = {};
    this.$$bucket[key] = value
  }

  matchLabels(labels: {[key: string]: string}): boolean {
    for(const [key, value] of Object.entries(labels)) {
      if (this[key] !== value)
        return false;
    }
    return true;
  }
  
}

export class MetricLine {
  constructor(public name: string) {};
  labels: {[key: string]: string} = {};
  value: number = 0;
  timestamp?: number;
}

export default class PrometheusParser {
  result: Metrics = {};
  currentMetric: Metric = new Metric();
  currentMetricKey: string = '';
    
  parse(str: string) : Metrics {
    const src = new StringCharSource(str);
    while(src.skipSpacesAndReturns()) {
      if (src.peek() === '#') {
        src.skip(1);
        this.parseComment(src);
      } else {
        const metricLine = this.parseMetricLine(src);
        this.updateCurrentMetric(metricLine);
      }
    }
    return this.result;
  }

  parseComment(src: CharSource) {
    if (!src.skipSpacesAndReturns())
      return;
    const help = this.parseCommentOfKey(src, HELP);
    if (help)
     this.getOrCreateMetric(help.name).help = help.value;
    else {
      const type = this.parseCommentOfKey(src, TYPE);
      if (type) 
        this.getOrCreateMetric(type.name).type = type.value;
    }
    src.skipUntilTerminator('\n\r', true);
  }

  parseCommentOfKey(src: CharSource, key: string): {name: string, value: string} | null {
    if (src.startsWith(key)) {
      src.skip(key.length);
      src.skipChars(' ');
      const name = src.readUntilTerminator(' ');
      src.skipChars(' ');
      return {name, value: src.readUntilTerminator('\n\r')};
    } 
    return null;
  }

  parseMetricLine(src: CharSource): MetricLine {
    const ret: MetricLine = new MetricLine(src.readUntilTerminator('{ '));
    if (src.peek() === '{') {
      src.skip(1);
      while(true) {
        const key = src.readUntilTerminator('=}');
        if (src.read() === '}') break;  // either = or }
        const quote = src.read();
        if (quote !== '"' && quote !== '\'') throw src.createParseRuntimeException('missing quote when expecting a string label vale');
        const val = src.readQuotedString(quote);
        ret.labels[key] = val;
        const sep = src.read();
        if (sep === '}') break;
        if (sep !== ',') throw src.createParseRuntimeException(`expect ',' after label: ${key}=${val}`);
      }
    }
    src.skipChars(' \t');
    ret.value = Number.parseFloat(src.readUntilTerminator(' \n\r'));
    if (src.isEof())
      return ret;
    if (src.peek() === ' ')
    ret.timestamp = Number.parseFloat(src.readUntilTerminator('\n\r'));
    return ret;
  }
  
  updateCurrentMetric(metricLine: MetricLine) {
    if (metricLine.name === this.currentMetricKey) {
      const quantile = metricLine.labels.quantile;
      if (quantile) {
        delete metricLine.labels.quantile;
        this.currentMetric.getOrCreateValue(metricLine.labels).addQuantile(quantile, metricLine.value);
        return;
      }
      this.currentMetric.getOrCreateValue(metricLine.labels).value = metricLine.value;
      return;
    }

    if (metricLine.name === this.currentMetricKey + '_count') {
      this.currentMetric.getOrCreateValue(metricLine.labels).count = metricLine.value;
      return;
    }

    if (metricLine.name === this.currentMetricKey + '_sum') {
      this.currentMetric.getOrCreateValue(metricLine.labels).sum = metricLine.value;
      return;
    }

    if (metricLine.name === this.currentMetricKey + '_bucket') {
      const bucket = metricLine.labels.le;
      if (!bucket)
        throw new Error(`missing bucket label: ${JSON.stringify(metricLine)}`);
      delete metricLine.labels.le;
      this.currentMetric.getOrCreateValue(metricLine.labels).addBucket(bucket, metricLine.value);
      return;
    }
    
    // No matching, will assume it's an `count` without a type and help definition 
    const metric = this.getOrCreateMetric(metricLine.name);
    metric.type = 'count';
    metric.getOrCreateValue({}).value = metricLine.value;
  }

  getOrCreateMetric(name: string): Metric {
    let ret = this.result[name];
    if (ret)
      return ret;
    ret = new Metric();
    this.result[name] = ret;
    this.currentMetric = ret;
    this.currentMetricKey = name;
    return ret;
  }
}