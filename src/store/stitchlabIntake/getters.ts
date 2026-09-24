import { GetterTree } from 'vuex'
import { normalizeIntakeFilename } from '@/store/stitchlabIntake/helpers'
import { StitchlabIntakeState } from '@/store/stitchlabIntake/types'

export const getters: GetterTree<StitchlabIntakeState, any> = {
    getEntry: (state) => (filename: string) => {
        return state.entries[normalizeIntakeFilename(filename)] ?? null
    },

    getState: (state) => (filename: string) => {
        return state.entries[normalizeIntakeFilename(filename)]?.state ?? 'unchecked'
    },
}
