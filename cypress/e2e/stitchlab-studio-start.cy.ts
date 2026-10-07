import { FakeMoonraker, installFakeMoonraker } from '../support/fakeMoonraker'

// A small TurtleStitch-style design inside the 80 x 130 standard frame.
const DESIGN = ['G90', 'G21', 'G1 X10 Y10', 'G1 Z5', 'G1 X20 Y10', 'G1 Z10', 'G1 X20 Y20', 'G1 Z15', 'M400'].join('\n')

function machineStatus(printState: string, filename: string) {
    return {
        webhooks: { state: 'ready', state_message: 'Printer is ready' },
        toolhead: {
            position: [40, 65, 15, 0],
            homed_axes: 'xyz',
            axis_minimum: [0, 0, -5, 0],
            axis_maximum: [80, 130, 99999, 0],
        },
        gcode_move: { gcode_position: [40, 65, 15, 0], absolute_coordinates: true },
        print_stats: { state: printState, filename },
        idle_timeout: { state: 'Ready' },
        virtual_sdcard: { is_active: printState === 'printing', progress: 0, file_path: null },
        configfile: { config: {}, settings: {} },
    }
}

function visitStudio(options: { printState?: string; filename?: string; intake?: boolean } = {}) {
    cy.intercept('GET', '**/server/files/config/**', { statusCode: 404, body: { error: { code: 404 } } })
    cy.intercept('GET', '**/server/files/gcodes/face.gcode*', { statusCode: 200, body: DESIGN }).as('download')
    cy.intercept('POST', '**/server/files/upload', {
        statusCode: 201,
        body: { item: { path: 'face.gcode', root: 'gcodes' }, action: 'create_file' },
    }).as('upload')

    let fake: FakeMoonraker | null = null
    cy.visit('/studio', {
        onBeforeLoad(win) {
            fake = installFakeMoonraker(win, {
                status: machineStatus(options.printState ?? 'standby', options.filename ?? ''),
                components: options.intake ? ['stitchlab_intake'] : [],
                answers: {
                    'server.stitchlab_intake.prepare': (params) => ({
                        filename: params.filename,
                        state: 'valid',
                        status: 'valid',
                        errors: [],
                        warnings: [],
                    }),
                    'printer.print.start': () => 'ok',
                },
            })
        },
    })
    cy.get('.gcode-studio-panel', { timeout: 20000 }).should('be.visible')
    // Settings typed before Mainsail has read its database would be replaced.
    cy.wrap(null).should(() => expect(fake?.requests.map((r) => r.method)).to.include('server.temperature_store'))
    return cy.then(() => fake as FakeMoonraker)
}

const loadLocalDesign = () =>
    cy
        .get('.gcode-studio-panel input[type=file]')
        .selectFile({ contents: Cypress.Buffer.from(DESIGN), fileName: 'face.gcode' }, { force: true })
const startAsIs = () => cy.get('.gcode-studio__start-as-is')
const printStarts = (fake: FakeMoonraker) => fake.requests.filter((request) => request.method === 'printer.print.start')

describe('G-Code Studio: start an unmoved design', () => {
    it('uploads a local design unchanged and starts it', () => {
        visitStudio().then((fake) => {
            loadLocalDesign()
            startAsIs().should('not.be.disabled').click()
            cy.wait('@upload')
            cy.wrap(fake).should((f) =>
                expect(printStarts(f).map((r) => r.params.filename)).to.deep.equal(['face.gcode'])
            )
        })
    })

    it('starts a design from the printer without uploading, through the intake', () => {
        visitStudio({ printState: 'complete', filename: 'face.gcode', intake: true }).then((fake) => {
            cy.contains('button', 'Current file').click()
            cy.wait('@download')
            startAsIs().should('not.be.disabled').click()
            cy.wrap(fake).should((f) =>
                expect(printStarts(f).map((r) => r.params.filename)).to.deep.equal(['face.gcode'])
            )
            cy.then(() => {
                const prepare = fake.requests.find((r) => r.method === 'server.stitchlab_intake.prepare')
                expect(prepare?.params.filename).to.equal('face.gcode')
                expect(prepare?.params.placement).to.include({ offset_x: 0, offset_y: 0, rotation_deg: 0 })
            })
            cy.get('@upload.all').should('have.length', 0)
        })
    })

    it('offers Save & Start instead once the design is moved', () => {
        visitStudio()
        loadLocalDesign()
        startAsIs().should('exist')
        cy.contains('.v-text-field', 'Offset X').find('input').clear().type('5').should('have.value', '5')
        cy.contains('button', 'Reset Offsets').should('not.be.disabled')
        startAsIs().should('not.exist')
        cy.contains('button', 'Save & Start').should('not.be.disabled')
    })

    it('stays disabled while a job runs', () => {
        visitStudio({ printState: 'printing', filename: 'other.gcode' })
        loadLocalDesign()
        startAsIs().should('be.disabled')
    })
})
