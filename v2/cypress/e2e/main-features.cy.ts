/// <reference types="cypress" />

describe('TreeDoc Viewer - Main UI Features', () => {
  const sampleData = [
    { id: 1, name: 'Alice', status: 'Success', value: 100 },
    { id: 2, name: 'Bob', status: 'Fail', value: 200 },
    { id: 3, name: 'Charlie', status: 'Success', value: null },
    { id: 4, name: 'David', status: '', value: 400 },
    { id: 5, name: 'Eve', status: 'Pending', value: 500 },
  ]

  const enterJsonData = (data: object) => {
    cy.get('.cm-content', { timeout: 10000 }).should('be.visible').click()
    cy.get('.cm-content').type('{selectall}{del}', { delay: 0 })
    cy.get('.cm-content').type(JSON.stringify(data), { parseSpecialCharSequences: false, delay: 0 })
    cy.wait(500)
  }

  const ensureTableViewVisible = () => {
    // Table is shown by default - just verify it exists
    // If it doesn't exist, toggle it on via the menu
    cy.get('body').then($body => {
      if ($body.find('.p-datatable').length === 0) {
        cy.get('.pi-th-large').parent('button').click()
        cy.get('.p-menu').should('be.visible')
        cy.get('.p-menu-item').contains('Table').click()
      }
    })
    cy.get('.p-datatable', { timeout: 10000 }).should('exist')
  }

  beforeEach(() => {
    cy.visit('/')
    cy.get('.cm-editor', { timeout: 10000 }).should('be.visible')
  })

  describe('Application Load', () => {
    it('should load the application successfully', () => {
      cy.get('body').should('be.visible')
      cy.title().should('not.be.empty')
    })

    it('should display the main layout with splitpanes', () => {
      cy.get('.splitpanes').should('exist')
    })

    it('should have code editor visible', () => {
      cy.get('.cm-editor').should('be.visible')
    })
  })

  describe('Data Input', () => {
    it('should accept JSON data in the editor', () => {
      enterJsonData(sampleData)
      cy.get('.cm-content').should('contain.text', 'Alice')
    })

    it('should parse JSON and show tree view', () => {
      enterJsonData(sampleData)
      cy.get('.tree-view, .tree-node', { timeout: 5000 }).should('exist')
    })
  })

  describe('Tree View Features', () => {
    beforeEach(() => {
      const nestedData = {
        root: {
          users: sampleData,
          config: { version: '1.0', debug: true }
        }
      }
      enterJsonData(nestedData)
    })

    it('should display tree structure', () => {
      cy.get('.tree-view, .tree-node', { timeout: 5000 }).should('exist')
    })

    it('should expand/collapse tree nodes', () => {
      cy.get('.tree-node-toggle, .expand-icon, [class*="toggle"], .pi-chevron-right, .pi-chevron-down')
        .first()
        .click({ force: true })
    })

    it('should show action buttons on hover', () => {
      cy.get('.tree-node, [class*="tree-item"]').first().trigger('mouseenter')
      cy.get('.node-action-btn, .node-action-bar, [class*="action"]').should('exist')
    })
  })

  describe('View Switching', () => {
    beforeEach(() => {
      enterJsonData(sampleData)
    })

    it('should open view toggle menu', () => {
      cy.get('.pi-th-large').parent('button').click()
      cy.get('.p-menu').should('be.visible')
      cy.get('.p-menu-item').should('have.length.at.least', 2)
    })

    it('should switch to Table View', () => {
      ensureTableViewVisible()
      cy.get('.p-datatable').should('be.visible')
    })

    it('should display data rows in table', () => {
      ensureTableViewVisible()
      cy.get('.p-datatable-tbody tr').should('have.length', 5)
    })
  })

  describe('Table View - Column Headers', () => {
    beforeEach(() => {
      enterJsonData(sampleData)
      ensureTableViewVisible()
    })

    it('should display column headers', () => {
      cy.get('.p-datatable-thead th').should('have.length.at.least', 1)
    })

    it('should have column header for each field', () => {
      cy.get('.column-header').should('have.length.at.least', 4)
    })
  })

  describe('Column Filter Dialog', () => {
    beforeEach(() => {
      enterJsonData(sampleData)
      ensureTableViewVisible()
    })

    it('should open column filter popover on header click', () => {
      cy.get('.column-header').first().click()
      cy.get('.p-popover', { timeout: 5000 }).should('be.visible')
    })

    it('should have filter input field', () => {
      cy.get('.column-header').first().click()
      cy.get('.p-popover').should('be.visible')
      cy.get('.filter-input, .p-popover input').should('exist')
    })

    it('should have filter option buttons', () => {
      cy.get('.column-header').first().click()
      cy.get('.p-popover').should('be.visible')
      cy.get('.filter-option-btn').should('have.length.at.least', 4)
    })

    it('should filter data when entering a query', () => {
      cy.get('.column-header').contains('name').click()
      cy.get('.p-popover').should('be.visible')
      cy.get('.filter-input').clear().type('Alice')
      // Wait for debounce and click outside to close popover
      cy.wait(2500)
      cy.get('.p-datatable').click({ force: true })
      cy.wait(500)
      cy.get('.p-datatable-tbody tr').should('have.length', 1)
    })

    it('should show filter indicator on column with active filter', () => {
      cy.get('.column-header').contains('name').click()
      cy.get('.p-popover').should('be.visible')
      cy.get('.filter-input').clear().type('Alice')
      cy.wait(2500)
      cy.get('.p-datatable').click({ force: true })
      cy.wait(500)
      cy.get('.pi-filter-fill, .column-filter-indicator').should('exist')
    })
  })

  describe('Filter Modes', () => {
    beforeEach(() => {
      enterJsonData(sampleData)
      ensureTableViewVisible()
    })

    it('should support array filter mode', () => {
      cy.get('.column-header').contains('name').click()
      cy.get('.p-popover').should('be.visible')
      cy.get('.filter-option-btn').contains('[]').click()
      cy.wait(500)
      cy.get('.filter-input').clear().type('Alice, Bob')
      cy.wait(2500)
      cy.get('.p-datatable').click({ force: true })
      cy.wait(500)
      cy.get('.p-datatable-tbody tr').should('have.length', 2)
    })

    it('should support negate filter mode', () => {
      cy.get('.column-header').contains('name').click()
      cy.get('.p-popover').should('be.visible')
      cy.get('.filter-option-btn').contains('!').click()
      cy.wait(500)
      cy.get('.filter-input').clear().type('Alice')
      cy.wait(2500)
      cy.get('.p-datatable').click({ force: true })
      cy.wait(500)
      cy.get('.p-datatable-tbody tr').should('have.length', 4)
    })

    it('should support JS expression filter', () => {
      cy.get('.column-header').contains('value').click()
      cy.get('.p-popover').should('be.visible')
      cy.get('.filter-option-btn').contains('JS').click()
      cy.get('.filter-input').clear().type('$ > 200')
      cy.wait(2500)
      cy.get('.p-datatable-tbody tr').should('have.length.at.least', 2)
    })
  })

  describe('Dark Mode', () => {
    it('should toggle dark mode', () => {
      cy.get('.theme-toggle').should('be.visible').click()
      cy.get('html').should('have.class', 'dark-mode')
    })

    it('should toggle back to light mode', () => {
      cy.get('.theme-toggle').click()
      cy.get('html').should('have.class', 'dark-mode')
      cy.get('.theme-toggle').click()
      cy.get('html').should('not.have.class', 'dark-mode')
    })
  })

  describe('Pagination', () => {
    beforeEach(() => {
      const largeData = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        status: i % 3 === 0 ? 'Success' : 'Pending',
        value: (i + 1) * 10
      }))
      enterJsonData(largeData)
      ensureTableViewVisible()
    })

    it('should show pagination controls', () => {
      cy.get('.p-paginator').should('exist')
    })

    it('should show page info', () => {
      cy.get('.p-paginator').should('contain.text', '1')
    })
  })

  describe('Keyboard Shortcuts', () => {
    beforeEach(() => {
      enterJsonData(sampleData)
      ensureTableViewVisible()
    })

    it('should close filter dialog on Escape', () => {
      cy.get('.column-header').first().click()
      cy.get('.p-popover').should('be.visible')
      cy.get('.filter-input').type('{esc}')
      cy.wait(500)
      cy.get('.p-popover').should('not.be.visible')
    })

    it('should apply filter and close on Enter', () => {
      cy.get('.column-header').contains('name').click()
      cy.get('.p-popover').should('be.visible')
      cy.get('.filter-input').type('Alice{enter}')
      cy.wait(500)
      cy.get('.p-popover').should('not.be.visible')
      cy.get('.p-datatable-tbody tr').should('have.length', 1)
    })
  })
})
