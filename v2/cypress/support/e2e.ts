/// <reference types="cypress" />

// Ignore uncaught exceptions from PrimeVue components
Cypress.on('uncaught:exception', (err) => {
  // Ignore PrimeVue popover alignment errors
  if (err.message.includes('alignOverlay') || err.message.includes('Cannot read properties')) {
    return false
  }
  return true
})

// Custom commands
Cypress.Commands.add('loadSampleData', () => {
  const sampleData = [
    { id: 1, name: 'Alice', status: 'Success', value: 100 },
    { id: 2, name: 'Bob', status: 'Fail', value: 200 },
    { id: 3, name: 'Charlie', status: 'Success', value: '' },
    { id: 4, name: 'David', status: '', value: 400 },
    { id: 5, name: 'Eve', status: 'Pending', value: 500 },
  ]
  cy.get('.code-editor textarea, .cm-content').first().click().clear()
  cy.get('.code-editor textarea, .cm-content').first().type(JSON.stringify(sampleData), { parseSpecialCharSequences: false })
})

Cypress.Commands.add('pasteData', (data: string) => {
  cy.get('.code-editor textarea, .cm-content').first().click()
  cy.get('.code-editor').first().then($el => {
    const el = $el[0]
    el.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: new DataTransfer(),
      bubbles: true
    }))
  })
})

declare global {
  namespace Cypress {
    interface Chainable {
      loadSampleData(): Chainable<void>
      pasteData(data: string): Chainable<void>
    }
  }
}

export {}
