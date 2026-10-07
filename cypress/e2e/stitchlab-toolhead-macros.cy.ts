import { installFakeMoonraker } from '../support/fakeMoonraker'

const BUTTON_MACROS = ['NEEDLE_TOGGLE', 'STITCH']
const JOB_FILE_MACROS = ['M0', 'M00', 'M2', 'M600', 'COLOR_CHANGE']

function machineStatus(printState: string) {
    const macros: Record<string, Record<string, unknown>> = {}
    const settings: Record<string, Record<string, unknown>> = {}
    for (const name of [...BUTTON_MACROS, ...JOB_FILE_MACROS]) {
        macros[`gcode_macro ${name}`] = {}
        settings[`gcode_macro ${name.toLowerCase()}`] = { gcode: '' }
    }

    return {
        webhooks: { state: 'ready', state_message: 'Printer is ready' },
        toolhead: {
            position: [40, 65, 1002.5, 0],
            homed_axes: 'xyz',
            axis_minimum: [0, 0, -5, 0],
            axis_maximum: [80, 130, 99999, 0],
        },
        gcode_move: { gcode_position: [40, 65, 2.5, 0], absolute_coordinates: true },
        print_stats: { state: printState, filename: printState === 'standby' ? '' : 'face.gcode' },
        idle_timeout: { state: 'Ready' },
        virtual_sdcard: { is_active: printState === 'printing', progress: 0.5, file_path: null },
        configfile: { config: {}, settings },
        ...macros,
    }
}

function visitDashboard(printState: string, gui: Record<string, unknown> = {}) {
    cy.intercept('GET', '**/server/files/config/**', { statusCode: 404, body: { error: { code: 404 } } })
    cy.visit('/', {
        onBeforeLoad(win) {
            installFakeMoonraker(win, { status: machineStatus(printState), gui })
        },
    })
    cy.get('.toolhead-control-panel', { timeout: 20000 }).should('be.visible')
}

// The bars control: one button group per axis, around that axis's home button.
const axisRow = (axis: string) =>
    cy
        .get('.toolhead-control-panel')
        .contains('button', new RegExp(`^\\s*${axis}\\s*$`))
        .parent()
        .find('button')
const homeRow = () => cy.get('.toolhead-control-panel').contains('button', 'ALL').parent().find('button')
const homeButton = (axis: string) =>
    cy.get('.toolhead-control-panel').contains('button', new RegExp(`^\\s*${axis}\\s*$`))
const jogButtons = (axis: string) => axisRow(axis).not(`:contains("${axis}")`)

const allDisabled = ($buttons: JQuery<HTMLElement>) =>
    $buttons.toArray().forEach((button) => expect(button, button.innerText).to.have.attr('disabled'))
const noneDisabled = ($buttons: JQuery<HTMLElement>) =>
    $buttons.toArray().forEach((button) => expect(button, button.innerText).not.to.have.attr('disabled'))

describe('StitchLAB toolhead controls during a job', () => {
    it('keeps homing and XY jogs locked while paused, Z jogs usable', () => {
        visitDashboard('paused')
        homeRow().should('have.length.at.least', 2).then(allDisabled)
        axisRow('X').should('have.length.at.least', 3).then(allDisabled)
        axisRow('Y').should('have.length.at.least', 3).then(allDisabled)
        homeButton('Z').should('be.disabled')
        jogButtons('Z').should('have.length.at.least', 2).then(noneDisabled)
    })

    it('locks every home and jog button while printing', () => {
        visitDashboard('printing')
        homeRow().then(allDisabled)
        ;['X', 'Y', 'Z'].forEach((axis) => axisRow(axis).then(allDisabled))
    })

    it('offers every home and jog button when no job runs', () => {
        visitDashboard('standby')
        homeRow().then(noneDisabled)
        ;['X', 'Y', 'Z'].forEach((axis) => axisRow(axis).then(noneDisabled))
    })
})

describe('StitchLAB toolhead controls during a job: jog wheel', () => {
    it('keeps homing, motors off and XY steps locked while paused, Z steps usable', () => {
        visitDashboard('paused', { control: { style: 'circle' } })
        const svg = () => cy.get('.toolhead-control-panel svg')
        ;['#Right', '#Left', '#Top1', '#Bottom1'].forEach((id) => svg().find(`g${id}`).should('have.class', 'disabled'))
        ;['#Top', '#Bottom'].forEach((id) => svg().find(`g${id}`).should('not.have.class', 'disabled'))
        svg().find('#home_x').closest('a').should('have.class', 'disabled')
        svg().find('#home_z').closest('a').should('have.class', 'disabled')
        svg().find('a#stepper_off').should('have.class', 'disabled')
    })
})
