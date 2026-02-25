import { describe, it, expect, beforeEach } from 'vitest'
import { ColumnManager, type TableColumn } from './ColumnManager'

describe('ColumnManager', () => {
  let manager: ColumnManager
  
  beforeEach(() => {
    manager = new ColumnManager()
  })
  
  describe('addColumn', () => {
    it('should add a new column', () => {
      const added = manager.addColumn('name', 'Name')
      expect(added).toBe(true)
      expect(manager.getColumns()).toHaveLength(1)
      expect(manager.getColumns()[0].field).toBe('name')
    })
    
    it('should not add duplicate columns', () => {
      manager.addColumn('name', 'Name')
      const added = manager.addColumn('name', 'Name Again')
      expect(added).toBe(false)
      expect(manager.getColumns()).toHaveLength(1)
    })
    
    it('should respect column options', () => {
      manager.addColumn('id', 'ID', { sortable: false, filterable: false, visible: false })
      const col = manager.findColumn('id')
      expect(col?.sortable).toBe(false)
      expect(col?.filterable).toBe(false)
      expect(col?.visible).toBe(false)
    })
  })
  
  describe('findColumn', () => {
    it('should find existing column', () => {
      manager.addColumn('name', 'Name')
      const col = manager.findColumn('name')
      expect(col).toBeDefined()
      expect(col?.field).toBe('name')
    })
    
    it('should return undefined for non-existent column', () => {
      const col = manager.findColumn('nonexistent')
      expect(col).toBeUndefined()
    })
  })
  
  describe('getColumnIndex', () => {
    it('should return correct index', () => {
      manager.addColumn('a', 'A')
      manager.addColumn('b', 'B')
      manager.addColumn('c', 'C')
      
      expect(manager.getColumnIndex('a')).toBe(0)
      expect(manager.getColumnIndex('b')).toBe(1)
      expect(manager.getColumnIndex('c')).toBe(2)
    })
    
    it('should return -1 for non-existent column', () => {
      expect(manager.getColumnIndex('nonexistent')).toBe(-1)
    })
  })
  
  describe('setColumnVisibility', () => {
    it('should update column visibility', () => {
      manager.addColumn('name', 'Name')
      manager.setColumnVisibility('name', false)
      expect(manager.findColumn('name')?.visible).toBe(false)
      
      manager.setColumnVisibility('name', true)
      expect(manager.findColumn('name')?.visible).toBe(true)
    })
  })
  
  describe('hideColumn', () => {
    it('should hide a column', () => {
      manager.addColumn('name', 'Name')
      manager.hideColumn('name')
      expect(manager.findColumn('name')?.visible).toBe(false)
    })
  })
  
  describe('clear', () => {
    it('should remove all columns', () => {
      manager.addColumn('a', 'A')
      manager.addColumn('b', 'B')
      manager.clear()
      expect(manager.getColumns()).toHaveLength(0)
    })
  })
  
  describe('reorderColumns', () => {
    it('should reorder columns according to field order', () => {
      manager.addColumn('a', 'A')
      manager.addColumn('b', 'B')
      manager.addColumn('c', 'C')
      
      manager.reorderColumns(['c', 'a', 'b'])
      
      const fields = manager.getColumnOrder()
      expect(fields).toEqual(['c', 'a', 'b'])
    })
    
    it('should append columns not in order list', () => {
      manager.addColumn('a', 'A')
      manager.addColumn('b', 'B')
      manager.addColumn('c', 'C')
      
      manager.reorderColumns(['b'])
      
      const fields = manager.getColumnOrder()
      expect(fields[0]).toBe('b')
      expect(fields).toHaveLength(3)
    })
    
    it('should handle order list with non-existent columns', () => {
      manager.addColumn('a', 'A')
      manager.addColumn('b', 'B')
      
      manager.reorderColumns(['nonexistent', 'b', 'a'])
      
      const fields = manager.getColumnOrder()
      expect(fields).toEqual(['b', 'a'])
    })
  })
  
  describe('updateDerivedColumns', () => {
    beforeEach(() => {
      manager.addColumn('source', 'Source')
    })
    
    it('should add new derived columns', () => {
      const sources = new Map([['derived1', 'source'], ['derived2', 'source']])
      const changed = manager.updateDerivedColumns(['derived1', 'derived2'], sources)
      
      expect(changed).toBe(true)
      expect(manager.findColumn('derived1')).toBeDefined()
      expect(manager.findColumn('derived2')).toBeDefined()
      expect(manager.findColumn('derived1')?.isDerived).toBe(true)
    })
    
    it('should insert derived columns after source', () => {
      manager.addColumn('other', 'Other')
      
      const sources = new Map([['derived', 'source']])
      manager.updateDerivedColumns(['derived'], sources)
      
      const order = manager.getColumnOrder()
      const sourceIndex = order.indexOf('source')
      const derivedIndex = order.indexOf('derived')
      
      expect(derivedIndex).toBe(sourceIndex + 1)
    })
    
    it('should remove old derived columns', () => {
      const sources1 = new Map([['derived1', 'source']])
      manager.updateDerivedColumns(['derived1'], sources1)
      expect(manager.findColumn('derived1')).toBeDefined()
      
      // Update with empty list
      manager.updateDerivedColumns([], new Map())
      expect(manager.findColumn('derived1')).toBeUndefined()
    })
    
    it('should not remove non-derived columns', () => {
      const sources = new Map([['derived', 'source']])
      manager.updateDerivedColumns(['derived'], sources)
      
      // Update with empty list should only remove derived columns
      manager.updateDerivedColumns([], new Map())
      
      expect(manager.findColumn('source')).toBeDefined()
    })
    
    it('should track derived column sources', () => {
      const sources = new Map([['derived', 'source']])
      manager.updateDerivedColumns(['derived'], sources)
      
      expect(manager.getDerivedColumnSource('derived')).toBe('source')
    })
  })
  
  describe('preset handling', () => {
    beforeEach(() => {
      manager.addColumn('a', 'A')
      manager.addColumn('b', 'B')
      manager.addColumn('c', 'C')
    })
    
    it('should set preset', () => {
      manager.setPreset([
        { field: 'c', visible: true },
        { field: 'b', visible: false },
        { field: 'a', visible: true }
      ])
      
      expect(manager.hasPreset()).toBe(true)
    })
    
    it('should apply preset visibility for derived columns', () => {
      manager.setPreset([
        { field: 'derived', visible: false }
      ])
      
      expect(manager.getPresetVisibility('derived')).toBe(false)
    })
    
    it('should sort by preset order when updating derived columns', () => {
      manager.setPreset([
        { field: 'c', visible: true },
        { field: 'derived', visible: true },
        { field: 'a', visible: true },
        { field: 'b', visible: true }
      ])
      
      const sources = new Map([['derived', 'a']])
      manager.updateDerivedColumns(['derived'], sources)
      
      const order = manager.getColumnOrder()
      expect(order.indexOf('c')).toBeLessThan(order.indexOf('derived'))
      expect(order.indexOf('derived')).toBeLessThan(order.indexOf('a'))
    })
    
    it('should apply preset visibility to all columns', () => {
      manager.setPreset([
        { field: 'a', visible: false },
        { field: 'b', visible: true },
        { field: 'c', visible: false }
      ])
      
      // Trigger preset application through updateDerivedColumns
      manager.updateDerivedColumns([], new Map())
      
      expect(manager.findColumn('a')?.visible).toBe(false)
      expect(manager.findColumn('b')?.visible).toBe(true)
      expect(manager.findColumn('c')?.visible).toBe(false)
    })
    
    it('should clear preset after application', () => {
      manager.setPreset([{ field: 'a', visible: true }])
      manager.updateDerivedColumns([], new Map())
      
      expect(manager.hasPreset()).toBe(false)
    })
  })
  
  describe('getColumnVisibility', () => {
    it('should return visibility info for all columns', () => {
      manager.addColumn('a', 'A', { visible: true })
      manager.addColumn('b', 'B', { visible: false })
      
      const visibility = manager.getColumnVisibility()
      
      expect(visibility).toHaveLength(2)
      expect(visibility[0]).toEqual({ field: 'a', header: 'A', visible: true })
      expect(visibility[1]).toEqual({ field: 'b', header: 'B', visible: false })
    })
  })
  
  describe('updateVisibility', () => {
    it('should update visibility from UI data', () => {
      manager.addColumn('a', 'A', { visible: true })
      manager.addColumn('b', 'B', { visible: true })
      
      manager.updateVisibility([
        { field: 'a', header: 'A', visible: false },
        { field: 'b', header: 'B', visible: true }
      ])
      
      expect(manager.findColumn('a')?.visible).toBe(false)
      expect(manager.findColumn('b')?.visible).toBe(true)
    })
  })
  
  describe('getVisibleColumns', () => {
    it('should return only visible columns', () => {
      manager.addColumn('a', 'A', { visible: true })
      manager.addColumn('b', 'B', { visible: false })
      manager.addColumn('c', 'C', { visible: true })
      
      const visible = manager.getVisibleColumns()
      
      expect(visible).toHaveLength(2)
      expect(visible.map(c => c.field)).toEqual(['a', 'c'])
    })
  })
  
  describe('setColumns', () => {
    it('should replace all columns', () => {
      manager.addColumn('a', 'A')
      
      const newColumns: TableColumn[] = [
        { field: 'x', header: 'X', sortable: true, filterable: true, visible: true },
        { field: 'y', header: 'Y', sortable: true, filterable: true, visible: true }
      ]
      
      manager.setColumns(newColumns)
      
      expect(manager.getColumns()).toHaveLength(2)
      expect(manager.findColumn('a')).toBeUndefined()
      expect(manager.findColumn('x')).toBeDefined()
    })
  })
  
  describe('multiple derived columns from same source', () => {
    it('should keep derived columns grouped after source', () => {
      manager.addColumn('source', 'Source')
      manager.addColumn('other', 'Other')
      
      // Add first derived column
      const sources1 = new Map([['derived1', 'source']])
      manager.updateDerivedColumns(['derived1'], sources1)
      
      // Add second derived column from same source
      const sources2 = new Map([['derived1', 'source'], ['derived2', 'source']])
      manager.updateDerivedColumns(['derived1', 'derived2'], sources2)
      
      const order = manager.getColumnOrder()
      const sourceIndex = order.indexOf('source')
      const derived1Index = order.indexOf('derived1')
      const derived2Index = order.indexOf('derived2')
      const otherIndex = order.indexOf('other')
      
      expect(derived1Index).toBeGreaterThan(sourceIndex)
      expect(derived2Index).toBeGreaterThan(sourceIndex)
      expect(otherIndex).toBeGreaterThan(derived1Index)
      expect(otherIndex).toBeGreaterThan(derived2Index)
    })
  })
})
