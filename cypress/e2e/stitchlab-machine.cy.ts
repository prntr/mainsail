import { embroideryCommandAllowed, jobPhase, needleState } from '../../src/plugins/stitchlabMachine'

describe('StitchLAB machine rules', () => {
    describe('needleState', () => {
        it('reads the needle from Z modulo one stitch', () => {
            expect(needleState(0, 'xyz')).to.equal('up')
            expect(needleState(2.5, 'xyz')).to.equal('down')
            expect(needleState(2895, 'xyz')).to.equal('up')
            // .176 after the workshop job: physical Z 2897.5 was down
            expect(needleState(2897.5, 'xyz')).to.equal('down')
            expect(needleState(1.2, 'xyz')).to.equal('between')
            expect(needleState(3.8, 'xyz')).to.equal('between')
        })

        it('allows the same window as NEEDLE_TOGGLE around up and down', () => {
            expect(needleState(4.6, 'xyz')).to.equal('up')
            expect(needleState(0.4, 'xyz')).to.equal('up')
            expect(needleState(2.0, 'xyz')).to.equal('down')
            expect(needleState(3.0, 'xyz')).to.equal('down')
            expect(needleState(0.5, 'xyz')).to.equal('between')
        })

        it('handles Z below zero', () => {
            expect(needleState(-2.5, 'xyz')).to.equal('down')
            expect(needleState(-5, 'xyz')).to.equal('up')
        })

        it('is unknown while Z is not homed', () => {
            expect(needleState(2.5, '')).to.equal('unknown')
            expect(needleState(2.5, 'xy')).to.equal('unknown')
            expect(needleState(0, undefined)).to.equal('unknown')
            expect(needleState(undefined, 'xyz')).to.equal('unknown')
            expect(needleState(2.5, 'Z')).to.equal('down')
        })
    })

    describe('jobPhase', () => {
        it('reduces the printer state to the guard phases', () => {
            expect(jobPhase('printing')).to.equal('printing')
            expect(jobPhase('paused')).to.equal('paused')
            ;['standby', 'complete', 'cancelled', 'error', '', undefined].forEach((state) =>
                expect(jobPhase(state)).to.equal('idle')
            )
        })
    })

    describe('embroideryCommandAllowed', () => {
        const needleMacros = [
            'NEEDLE_TOGGLE',
            'STITCH',
            'LOCK_STITCH',
            'NEEDLE_ADJUST',
            'ZERO_NEEDLE_POSITION',
            'EMBROIDERY_HOME',
        ]

        it('refuses every needle and homing macro while printing', () => {
            needleMacros.forEach((name) => expect(embroideryCommandAllowed(name, 'printing'), name).to.equal(false))
        })

        it('allows only moves that keep the logical Z while paused', () => {
            expect(embroideryCommandAllowed('NEEDLE_TOGGLE', 'paused')).to.equal(true)
            expect(embroideryCommandAllowed('STITCH', 'paused')).to.equal(true)
            expect(embroideryCommandAllowed('LOCK_STITCH', 'paused')).to.equal(true)
            expect(embroideryCommandAllowed('NEEDLE_ADJUST', 'paused')).to.equal(false)
            expect(embroideryCommandAllowed('ZERO_NEEDLE_POSITION', 'paused')).to.equal(false)
            expect(embroideryCommandAllowed('EMBROIDERY_HOME', 'paused')).to.equal(false)
        })

        it('allows everything when no job runs', () => {
            needleMacros.forEach((name) => expect(embroideryCommandAllowed(name, 'idle'), name).to.equal(true))
        })

        it('matches names case-insensitively and ignores parameters', () => {
            expect(embroideryCommandAllowed('zero_needle_position', 'printing')).to.equal(false)
            expect(embroideryCommandAllowed('LOCK_STITCH COUNT=5', 'printing')).to.equal(false)
            expect(embroideryCommandAllowed('NEEDLE_ADJUST AMOUNT=0.1', 'paused')).to.equal(false)
        })

        it('leaves other macros alone', () => {
            expect(embroideryCommandAllowed('PAUSE', 'printing')).to.equal(true)
            expect(embroideryCommandAllowed('CANCEL_PRINT', 'printing')).to.equal(true)
            expect(embroideryCommandAllowed('STITCH_COUNTER', 'printing')).to.equal(true)
        })
    })
})
