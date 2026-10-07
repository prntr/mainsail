// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Mainsail's PWA service worker answers page loads from its cache. Cypress
// cannot instrument such a page, so onBeforeLoad never runs and tests that
// stub the page's WebSocket connect to nothing. Tests run without it: drop
// what an earlier run registered on this origin, and register none.
before(() => {
    const serviceWorker = window.navigator.serviceWorker
    if (!serviceWorker) return
    cy.wrap(
        serviceWorker
            .getRegistrations()
            .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    )
})

Cypress.on('window:before:load', (win) => {
    delete Object.getPrototypeOf(win.navigator).serviceWorker
})
