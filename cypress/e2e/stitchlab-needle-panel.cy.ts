import { FakeMoonraker, installFakeMoonraker } from '../support/fakeMoonraker'

const NEEDLE_MACROS = [
    'NEEDLE_TOGGLE',
    'STITCH',
    'LOCK_STITCH',
    'NEEDLE_ADJUST',
    'ZERO_NEEDLE_POSITION',
    'EMBROIDERY_HOME',
]

function machineStatus(z: number, homedAxes: string, printState: string) {
    const macros: Record<string, Record<string, unknown>> = {}
    const settings: Record<string, Record<string, unknown>> = {}
    for (const name of [...NEEDLE_MACROS, 'PAUSE_DEMO']) {
        macros[`gcode_macro ${name}`] = {}
        settings[`gcode_macro ${name.toLowerCase()}`] = { gcode: '', description: name }
    }

    return {
        webhooks: { state: 'ready', state_message: 'Printer is ready' },
        toolhead: {
            position: [40, 65, z, 0],
            homed_axes: homedAxes,
            axis_minimum: [0, 0, -5, 0],
            axis_maximum: [80, 130, 99999, 0],
        },
        gcode_move: { gcode_position: [40, 65, 0, 0], absolute_coordinates: true },
        print_stats: { state: printState, filename: printState === 'standby' ? '' : 'face.gcode' },
        idle_timeout: { state: 'Ready' },
        virtual_sdcard: { is_active: printState === 'printing', progress: 0.5, file_path: null },
        configfile: { config: {}, settings },
        ...macros,
    }
}

function visitDashboard(z: number, homedAxes: string, printState: string): Cypress.Chainable<FakeMoonraker> {
    cy.intercept('GET', '**/server/files/config/**', { statusCode: 404, body: { error: { code: 404 } } })
    let fake: FakeMoonraker | null = null
    cy.visit('/', {
        onBeforeLoad(win) {
            fake = installFakeMoonraker(win, { status: machineStatus(z, homedAxes, printState) })
        },
    })
    cy.get('.embroidery-control-panel', { timeout: 20000 }).should('be.visible')
    return cy.then(() => fake as FakeMoonraker)
}

const panel = () => cy.get('.embroidery-control-panel')
const state = () => panel().find('.embroidery-control-panel__state')
// Exact label: 'STITCH' must not find 'LOCK STITCH'.
const macroButton = (name: string) =>
    cy.get('.macros-panel').contains('button', new RegExp(`^\\s*${name.replace(/_/g, ' ')}\\s*$`))

describe('StitchLAB needle panel', () => {
    it('shows the state the machine reports, without any click in this tab', () => {
        // .176 after the workshop job: physical Z 2897.5, needle down
        visitDashboard(2897.5, 'xyz', 'standby')
        state().should('have.attr', 'data-state', 'down')
        panel().find('.embroidery-control-panel__toggle-btn').should('contain.text', 'Toggle to Up')
    })

    it('changes only when the machine reports a new position', () => {
        visitDashboard(0, 'xyz', 'standby').then((fake) => {
            state().should('have.attr', 'data-state', 'up')
            panel().find('.embroidery-control-panel__toggle-btn').click()
            cy.wrap(fake.scripts).should('include', 'NEEDLE_TOGGLE')
            // another tab sending the toggle would see the same: no local flip
            state().should('have.attr', 'data-state', 'up')

            cy.then(() => fake.pushStatus({ toolhead: { position: [40, 65, 2.5, 0] } }))
            state().should('have.attr', 'data-state', 'down')
            cy.then(() => fake.pushStatus({ toolhead: { position: [40, 65, 3.9, 0] } }))
            state().should('have.attr', 'data-state', 'between')
        })
    })

    it('says unknown and offers nothing while Z is not homed', () => {
        visitDashboard(0, 'xy', 'standby')
        state().should('have.attr', 'data-state', 'unknown')
        panel().find('.embroidery-control-panel__hint').should('contain.text', 'home the machine first')
        panel()
            .find('button')
            .each(($button) => cy.wrap($button).should('be.disabled'))
    })

    it('locks every needle control and needle macro while printing', () => {
        visitDashboard(1000, 'xyz', 'printing')
        panel().find('.embroidery-control-panel__hint').should('contain.text', 'needle controls are locked')
        panel()
            .find('button')
            .each(($button) => cy.wrap($button).should('be.disabled'))
        NEEDLE_MACROS.forEach((name) => macroButton(name).should('be.disabled'))
        macroButton('PAUSE_DEMO').should('not.be.disabled')
    })

    it('allows needle up/down and stitches while paused, nothing that changes Z or homes', () => {
        visitDashboard(1002.5, 'xyz', 'paused')
        state().should('have.attr', 'data-state', 'down')
        panel().find('.embroidery-control-panel__toggle-btn').should('not.be.disabled')
        panel().find('.embroidery-control-panel__stitch-btn').should('not.be.disabled')
        panel().find('.embroidery-control-panel__lock-btn').should('not.be.disabled')
        panel().find('.embroidery-control-panel__zero-btn').should('be.disabled')

        macroButton('NEEDLE_TOGGLE').should('not.be.disabled')
        macroButton('STITCH').should('not.be.disabled')
        macroButton('LOCK_STITCH').should('not.be.disabled')
        macroButton('NEEDLE_ADJUST').should('be.disabled')
        macroButton('ZERO_NEEDLE_POSITION').should('be.disabled')
        macroButton('EMBROIDERY_HOME').should('be.disabled')
    })

    it('offers everything again when no job runs', () => {
        visitDashboard(5, 'xyz', 'complete')
        panel()
            .find('button')
            .each(($button) => cy.wrap($button).should('not.be.disabled'))
        NEEDLE_MACROS.forEach((name) => macroButton(name).should('not.be.disabled'))
    })
})
