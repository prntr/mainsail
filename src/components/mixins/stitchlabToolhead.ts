import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { jobPhase, toolheadActionAllowed } from '@/plugins/stitchlabMachine'

// StitchLAB: which toolhead controls a job leaves usable. Upstream locks them
// only while printing; the rules are in stitchlabMachine.ts.
@Component
export default class StitchlabToolheadMixin extends Mixins(BaseMixin) {
    get homeLocked(): boolean {
        return !toolheadActionAllowed('home', jobPhase(this.printer_state))
    }

    get jogXYLocked(): boolean {
        return !toolheadActionAllowed('jogXY', jobPhase(this.printer_state))
    }

    get jogZLocked(): boolean {
        return !toolheadActionAllowed('jogZ', jobPhase(this.printer_state))
    }
}
