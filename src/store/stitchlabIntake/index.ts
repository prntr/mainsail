import { Module } from 'vuex'
import { StitchlabIntakeState } from '@/store/stitchlabIntake/types'
import { actions } from '@/store/stitchlabIntake/actions'
import { mutations } from '@/store/stitchlabIntake/mutations'
import { getters } from '@/store/stitchlabIntake/getters'

export const getDefaultState = (): StitchlabIntakeState => {
    return {
        entries: {},
        requested: {},
    }
}

const state = getDefaultState()

export const stitchlabIntake: Module<StitchlabIntakeState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
