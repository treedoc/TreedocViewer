/**
 * ColumnManager - Handles column tracking, ordering, and visibility
 * 
 * This class is framework-agnostic and can be unit tested independently.
 */

/**
 * Column definition
 */
export interface TableColumn {
  field: string
  header: string
  sortable: boolean
  filterable: boolean
  visible: boolean
  isDerived?: boolean
}

/**
 * Column visibility info for UI
 */
export interface ColumnVisibility {
  field: string
  header: string
  visible: boolean
}

/**
 * Preset column configuration
 */
export interface PresetColumn {
  field: string
  visible: boolean
}

/**
 * ColumnManager - Manages column state and ordering
 */
export class ColumnManager {
  private columns: TableColumn[] = []
  private derivedColumnSources = new Map<string, string>()
  private presetOrder: string[] | null = null
  private presetVisibility: Map<string, boolean> | null = null
  
  /**
   * Get current columns
   */
  getColumns(): TableColumn[] {
    return [...this.columns]
  }
  
  /**
   * Set columns directly
   */
  setColumns(columns: TableColumn[]): void {
    this.columns = [...columns]
  }
  
  /**
   * Clear all columns
   */
  clear(): void {
    this.columns = []
    this.derivedColumnSources.clear()
  }
  
  /**
   * Add a column if it doesn't exist
   */
  addColumn(field: string, header: string, options: Partial<TableColumn> = {}): boolean {
    if (this.columns.find(c => c.field === field)) {
      return false
    }
    
    this.columns.push({
      field,
      header,
      sortable: options.sortable ?? true,
      filterable: options.filterable ?? true,
      visible: options.visible ?? true,
      isDerived: options.isDerived ?? false,
    })
    return true
  }
  
  /**
   * Find a column by field name
   */
  findColumn(field: string): TableColumn | undefined {
    return this.columns.find(c => c.field === field)
  }
  
  /**
   * Get column index
   */
  getColumnIndex(field: string): number {
    return this.columns.findIndex(c => c.field === field)
  }
  
  /**
   * Update column visibility
   */
  setColumnVisibility(field: string, visible: boolean): void {
    const col = this.findColumn(field)
    if (col) {
      col.visible = visible
    }
  }
  
  /**
   * Set preset for column ordering and visibility
   */
  setPreset(columns: PresetColumn[]): void {
    this.presetOrder = columns.map(c => c.field)
    this.presetVisibility = new Map(columns.map(c => [c.field, c.visible]))
  }
  
  /**
   * Clear preset
   */
  clearPreset(): void {
    this.presetOrder = null
    this.presetVisibility = null
  }
  
  /**
   * Check if there's a preset set
   */
  hasPreset(): boolean {
    return this.presetOrder !== null && this.presetOrder.length > 0
  }
  
  /**
   * Get preset visibility for a column
   */
  getPresetVisibility(field: string): boolean | undefined {
    return this.presetVisibility?.get(field)
  }
  
  /**
   * Update derived columns based on processing results
   * Returns true if columns changed
   */
  updateDerivedColumns(
    derivedColumns: string[],
    derivedColumnSources: Map<string, string>
  ): boolean {
    const newDerivedSet = new Set(derivedColumns)
    let changed = false
    
    // Update source map
    for (const [col, source] of derivedColumnSources) {
      this.derivedColumnSources.set(col, source)
    }
    // Remove old entries
    for (const key of this.derivedColumnSources.keys()) {
      if (!newDerivedSet.has(key)) {
        this.derivedColumnSources.delete(key)
      }
    }
    
    // Remove old derived columns
    const columnsToRemove = this.columns.filter(col => 
      col.isDerived && !newDerivedSet.has(col.field)
    )
    if (columnsToRemove.length > 0) {
      this.columns = this.columns.filter(col => 
        !col.isDerived || newDerivedSet.has(col.field)
      )
      changed = true
    }
    
    // Add new derived columns
    for (const colName of derivedColumns) {
      if (!this.findColumn(colName)) {
        const sourceField = this.derivedColumnSources.get(colName)
        const presetVisible = this.presetVisibility?.get(colName)
        
        const newCol: TableColumn = {
          field: colName,
          header: colName,
          sortable: true,
          filterable: true,
          visible: presetVisible !== undefined ? presetVisible : true,
          isDerived: true,
        }
        
        // Determine insert position
        const insertIndex = this.findInsertPosition(colName, sourceField)
        if (insertIndex !== -1) {
          this.columns.splice(insertIndex, 0, newCol)
        } else {
          this.columns.push(newCol)
        }
        changed = true
      }
    }
    
    // Apply preset order if available
    if (this.presetOrder && this.presetOrder.length > 0) {
      this.sortByPresetOrder()
      this.presetOrder = null
    }
    
    // Apply preset visibility if available
    if (this.presetVisibility && this.presetVisibility.size > 0) {
      for (const col of this.columns) {
        const presetVisible = this.presetVisibility.get(col.field)
        if (presetVisible !== undefined) {
          col.visible = presetVisible
        }
      }
      this.presetVisibility = null
    }
    
    return changed
  }
  
  /**
   * Find the best insert position for a derived column
   */
  private findInsertPosition(colName: string, sourceField: string | undefined): number {
    // Check preset order first
    if (this.presetOrder) {
      const presetIndex = this.presetOrder.indexOf(colName)
      if (presetIndex !== -1) {
        let insertIndex = 0
        for (let i = 0; i < this.columns.length; i++) {
          const existingPresetIndex = this.presetOrder.indexOf(this.columns[i].field)
          if (existingPresetIndex !== -1 && existingPresetIndex < presetIndex) {
            insertIndex = i + 1
          }
        }
        return insertIndex
      }
    }
    
    // Fallback: insert after source field
    if (sourceField) {
      const sourceIndex = this.getColumnIndex(sourceField)
      if (sourceIndex !== -1) {
        // Find last consecutive derived column from same source
        let insertIndex = sourceIndex + 1
        while (insertIndex < this.columns.length) {
          const col = this.columns[insertIndex]
          if (col.isDerived && this.derivedColumnSources.get(col.field) === sourceField) {
            insertIndex++
          } else {
            break
          }
        }
        return insertIndex
      }
    }
    
    return -1 // Will push to end
  }
  
  /**
   * Sort columns by preset order
   */
  private sortByPresetOrder(): void {
    if (!this.presetOrder) return
    
    const orderMap = new Map(this.presetOrder.map((field, i) => [field, i]))
    this.columns.sort((a, b) => {
      const aOrder = orderMap.get(a.field) ?? Infinity
      const bOrder = orderMap.get(b.field) ?? Infinity
      return aOrder - bOrder
    })
  }
  
  /**
   * Reorder columns based on a field order array
   */
  reorderColumns(fieldOrder: string[]): void {
    const currentColumnsMap = new Map(this.columns.map(c => [c.field, c]))
    const reorderedColumns: TableColumn[] = []
    
    // Add columns in specified order
    for (const field of fieldOrder) {
      const col = currentColumnsMap.get(field)
      if (col) {
        reorderedColumns.push(col)
        currentColumnsMap.delete(field)
      }
    }
    
    // Append remaining columns
    for (const col of currentColumnsMap.values()) {
      reorderedColumns.push(col)
    }
    
    this.columns = reorderedColumns
  }
  
  /**
   * Get column visibility array for UI
   */
  getColumnVisibility(): ColumnVisibility[] {
    return this.columns.map(c => ({
      field: c.field,
      header: c.header,
      visible: c.visible,
    }))
  }
  
  /**
   * Update visibility from UI
   */
  updateVisibility(visibility: ColumnVisibility[]): void {
    for (const vis of visibility) {
      const col = this.findColumn(vis.field)
      if (col) {
        col.visible = vis.visible
      }
    }
  }
  
  /**
   * Hide a column
   */
  hideColumn(field: string): void {
    this.setColumnVisibility(field, false)
  }
  
  /**
   * Get derived column source
   */
  getDerivedColumnSource(field: string): string | undefined {
    return this.derivedColumnSources.get(field)
  }
  
  /**
   * Get all derived column sources
   */
  getDerivedColumnSources(): Map<string, string> {
    return new Map(this.derivedColumnSources)
  }
  
  /**
   * Set derived column sources (for restoration)
   */
  setDerivedColumnSources(sources: Map<string, string>): void {
    this.derivedColumnSources = new Map(sources)
  }
  
  /**
   * Get visible columns only
   */
  getVisibleColumns(): TableColumn[] {
    return this.columns.filter(c => c.visible)
  }
  
  /**
   * Get column fields in order
   */
  getColumnOrder(): string[] {
    return this.columns.map(c => c.field)
  }
}
