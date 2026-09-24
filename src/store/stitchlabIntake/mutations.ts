import Vue from 'vue'
import { MutationTree } from 'vuex'
import { getDefaultState } from '@/store/stitchlabIntake'
import { normalizeIntakeEntry, normalizeIntakeFilename } from '@/store/stitchlabIntake/helpers'
import { StitchlabIntakeState } from '@/store/stitchlabIntake/types'

export const mutations: MutationTree<StitchlabIntakeState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setRequested(state, payload) {
        const filename = normalizeIntakeFilename(payload.filename ?? payload)
        if (!filename) return
        Vue.set(state.requested, filename, payload.value ?? true)
    },

    setEntry(state, payload) {
        const entry = normalizeIntakeEntry(payload)
        if (!entry.filename) return

        const previous = state.entries[entry.filename] ?? {}
        Vue.set(state.entries, entry.filename, {
            ...previous,
            ...entry,
        })
        Vue.set(state.requested, entry.filename, true)
    },

    clearEntry(state, payload) {
        const filename = normalizeIntakeFilename(payload.filename ?? payload)
        if (!filename) return
        Vue.delete(state.entries, filename)
        Vue.delete(state.requested, filename)
    },
}
