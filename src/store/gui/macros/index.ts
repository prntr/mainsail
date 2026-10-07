import { Module } from 'vuex'
import { actions } from '@/store/gui/macros/actions'
import { mutations } from '@/store/gui/macros/mutations'
import { getters } from '@/store/gui/macros/getters'
import { GuiMacrosState } from '@/store/gui/macros/types'
import { JOB_FILE_MACROS } from '@/plugins/stitchlabMachine'

export const getDefaultState = (): GuiMacrosState => {
    return {
        mode: 'simple',
        // StitchLAB: job-file commands are no buttons; Settings > Macros can show them.
        hiddenMacros: [...JOB_FILE_MACROS],
        macrogroups: {},
    }
}

// initial state
const state = getDefaultState()

// eslint-disable-next-line
export const macros: Module<GuiMacrosState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
