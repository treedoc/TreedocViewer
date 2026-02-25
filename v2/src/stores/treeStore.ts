import { defineStore } from 'pinia'
import { ref, computed, shallowRef, watch, markRaw, toRaw } from 'vue'
import type { TDNode, TreeDoc } from 'treedoc'

function markTreeRaw(node: TDNode): void {
  markRaw(node)
  if (node.children) {
    markRaw(node.children)
    for (const child of node.children) {
      markTreeRaw(child)
    }
  }
}
import { TDObjectCoder, TDJSONWriter, TDJSONWriterOption, JSONPointer } from 'treedoc'
import type { ParserPlugin, Selection, TableNodeState, TDVOptions } from '../models/types'
import { ParseStatus } from '../models/types'
import History from '../models/History'
import JSONParserPlugin, { JSONParserType } from '../parsers/JSONParserPlugin'
import YAMLParserPlugin from '../parsers/YAMLParserPlugin'
import XMLParserPlugin from '../parsers/XMLParserPlugin'
import CSVParserPlugin from '../parsers/CSVParserPlugin'
import PrometheusParserPlugin from '../parsers/PrometheusParserPlugin'
import { debounce } from 'lodash-es'
import { Logger } from '@/utils/Logger'

const logger = new Logger('treeStore')

export const useTreeStore = defineStore('tree', () => {
  // State
  const rawText = ref('')
  const parseResult = ref('')
  const parseStatus = ref<ParseStatus>(ParseStatus.SUCCESS)
  
  const tree = shallowRef<TreeDoc | null>(null)
  const selectedNode = shallowRef<TDNode | null>(null)
  const initialNode = shallowRef<TDNode | null>(null)
  
  const selection = ref<Selection>({})
  const history = new History<TDNode>()
  const historyVersion = ref(0)
  const nodeVersion = ref(0)
  const tableStateCache = new Map<string, TableNodeState>()
  
  // View state
  const showSource = ref(true)
  const showTree = ref(true)
  const showTable = ref(true)
  const maxPane = ref<string>('')
  const currentPane = ref<string>('')
  const textWrap = ref(true)
  const codeView = ref(true)
  const hasTreeInTable = ref(false)
  
  // Tree filter state
  const showTreeFilter = ref(false)
  const treeFilterQuery = ref('')
  
  // Parser state
  const defaultParser: ParserPlugin = new JSONParserPlugin()
  const selectedParser = ref<ParserPlugin>(defaultParser)
  
  const availableParsers = computed<ParserPlugin[]>(() => [
    defaultParser,
    new JSONParserPlugin('Lombok.toString', JSONParserType.LOMBOK_TO_STRING),
    new JSONParserPlugin('Map.toString', JSONParserType.JAVA_MAP_TO_STRING),
    new XMLParserPlugin('XML compact', 'text/xml', true),
    new XMLParserPlugin(),
    new XMLParserPlugin('HTML', 'text/html'),
    new CSVParserPlugin(),
    new CSVParserPlugin('TSV', '\t'),
    new CSVParserPlugin('SSV', ' '),
    new YAMLParserPlugin(),
    new PrometheusParserPlugin(),
  ])
  
  // Computed
  const hasError = computed(() => parseStatus.value === ParseStatus.ERROR)
  
  const canBack = computed(() => {
    historyVersion.value // Trigger reactivity
    return history.canBack()
  })
  const canForward = computed(() => {
    historyVersion.value // Trigger reactivity
    return history.canForward()
  })
  
  // Actions
  function setRawText(text: string) {
    rawText.value = text
    debouncedParse(text)
  }
  
  function setTextImmediate(text: string) {
    rawText.value = text
    parseText(text, true)
  }
  
  const debouncedParse = debounce((text: string) => {
    parseText(text, true)
  }, 300)
  
  function parseText(text: string, detectParser = false) {
    if (!text) {
      tree.value = null
      selectedNode.value = null
      parseResult.value = 'No data'
      return
    }
    
    // Auto-detect parser
    if (detectParser) {
      const detected = availableParsers.value.find(p => p.looksLike(text))
      if (detected) {
        selectedParser.value = detected
      } else {
        selectedParser.value = defaultParser
      }
    }
    
    const result = selectedParser.value.parse(text)
    parseStatus.value = result.status
    parseResult.value = result.message
    
    if (result.result) {
      const doc = result.result.doc
      // Mark the entire tree structure as raw to prevent Vue's deep reactivity
      markRaw(doc)
      markTreeRaw(doc.root)
      
      // Clear history and table state cache when loading new data
      history.clear()
      tableStateCache.clear()
      historyVersion.value++
      
      tree.value = doc
      tree.value.root.key = 'root'
      tree.value.root.freeze()
      
      // Select root by default
      selectNode(tree.value.root, true)
    } else {
      tree.value = null
      selectedNode.value = null
      history.clear()
      tableStateCache.clear()
      historyVersion.value++
    }
  }
  
  function setParser(parser: ParserPlugin) {
    selectedParser.value = parser
    parseText(rawText.value, false)
  }
  
  function selectNode(node: TDNode | string | string[], initial = false) {
    logger.log(`selectNode: start`)
    
    if (!tree.value) return
    
    let targetNode: TDNode | null = null
    
    if (typeof node === 'string') {
      targetNode = findNodeByPath(node)
    } else if (Array.isArray(node)) {
      targetNode = findNodeByPath(node)
    } else {
      targetNode = node
    }
    if (!targetNode) return

    if (initial) {
      initialNode.value = markRaw(targetNode)
    }
    
    if (selectedNode.value === targetNode) return
    
    logger.log(`before update selectedNode`)
    selectedNode.value = markRaw(targetNode)
    nodeVersion.value++
    logger.log(`after update selectedNode`)
    history.append(targetNode)
    logger.log(`after append history`)
    historyVersion.value++
    logger.log(`after update historyVersion`)
    
    // Update selection for source view highlighting
    if (!initial && targetNode.start && targetNode.end) {
      selection.value = {
        start: { line: targetNode.start.line, col: targetNode.start.col, pos: targetNode.start.pos },
        end: { line: targetNode.end.line, col: targetNode.end.col, pos: targetNode.end.pos },
      }
    }
    logger.log(`selectNode: end`)
  }
  
  function findNodeByPath(path: string | string[]): TDNode | null {
    logger.log(`findNodeByPath: start`)
    if (!tree.value) return null
    
    const currentNode = selectedNode.value || tree.value.root
    let node = currentNode.getByPath(path)
    
    if (node) return node
    
    if (typeof path === 'string') {
      // Special handling for Google API schema references
      node = currentNode.getByPath('/schemas/' + path)
      if (node) return node
      
      // JSON Pointer standard
      try {
        const jsonPointer = JSONPointer.get().parse(path)
        if (!jsonPointer.docPath) {
          node = currentNode.getByPath(jsonPointer)
          if (node) return node
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    return currentNode
  }
  
  function back() {
    const node = history.back()
    if (node) {
      historyVersion.value++
      selectedNode.value = markRaw(node)
      nodeVersion.value++
      // Update selection for source view highlighting
      if (node.start && node.end) {
        selection.value = {
          start: { line: node.start.line, col: node.start.col, pos: node.start.pos },
          end: { line: node.end.line, col: node.end.col, pos: node.end.pos },
        }
      }
    }
  }
  
  function forward() {
    const node = history.forward()
    if (node) {
      historyVersion.value++
      selectedNode.value = markRaw(node)
      nodeVersion.value++
      // Update selection for source view highlighting
      if (node.start && node.end) {
        selection.value = {
          start: { line: node.start.line, col: node.start.col, pos: node.start.pos },
          end: { line: node.end.line, col: node.end.col, pos: node.end.pos },
        }
      }
    }
  }
  
  function toggleMaxPane(pane: string) {
    if (maxPane.value === pane) {
      maxPane.value = ''
    } else {
      maxPane.value = pane
    }
  }
  
  function format() {
    if (!tree.value) return
    rawText.value = TDJSONWriter.get().writeAsString(
      tree.value.root,
      new TDJSONWriterOption().setIndentFactor(2)
    )
  }
  
  function loadData(data: string | object) {
    if (typeof data === 'string') {
      setTextImmediate(data)
    } else {
      const str = JSON.stringify(data, null, 2)
      setTextImmediate(str)
    }
  }
  
  function saveTableState(node: TDNode, state: TableNodeState) {
    // The node is not from the current tree, ignore
    if (node.doc !== tree.value) return
    tableStateCache.set(node.pathAsString, state)
  }
  
  function getTableState(node: TDNode): TableNodeState | undefined {
    return tableStateCache.get(node.pathAsString)
  }
  
  function isInitialNodeSelected(): boolean {
    return tree.value !== null && selectedNode.value === initialNode.value
  }
  
  function setInitialOptions(options?: TDVOptions) {
    if (!options) return
    if (options.maxPane !== undefined) maxPane.value = options.maxPane
    if (options.textWrap !== undefined) textWrap.value = options.textWrap
    if (options.showSource !== undefined) showSource.value = options.showSource
    if (options.showTree !== undefined) showTree.value = options.showTree
    if (options.showTable !== undefined) showTable.value = options.showTable
  }
  
  function getRawTree(): TreeDoc | null {
    const t = tree.value
    return t ? toRaw(t) : null
  }
  
  function getRawSelectedNode(): TDNode | null {
    const n = selectedNode.value
    return n ? toRaw(n) : null
  }
  
  return {
    // State
    rawText,
    parseResult,
    parseStatus,
    tree,
    selectedNode,
    initialNode,
    selection,
    nodeVersion,
    
    // View state
    showSource,
    showTree,
    showTable,
    maxPane,
    currentPane,
    textWrap,
    codeView,
    hasTreeInTable,
    
    // Tree filter state
    showTreeFilter,
    treeFilterQuery,
    
    // Parser
    selectedParser,
    availableParsers,
    
    // Computed
    hasError,
    canBack,
    canForward,
    
    // Actions
    setRawText,
    setTextImmediate,
    setParser,
    selectNode,
    findNodeByPath,
    back,
    forward,
    toggleMaxPane,
    format,
    loadData,
    saveTableState,
    getTableState,
    isInitialNodeSelected,
    setInitialOptions,
    getRawTree,
    getRawSelectedNode,
  }
})
