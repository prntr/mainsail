import { Module } from 'vuex'
import { ServerWifiState } from '@/store/server/wifiManager/types'
import { actions } from '@/store/server/wifiManager/actions'
import { mutations } from '@/store/server/wifiManager/mutations'
import { getters } from '@/store/server/wifiManager/getters'

export const getDefaultState = (): ServerWifiState => {
    return {
        available: false,
        status: null,
        networks: [],
        profiles: [],
        apConfig: null,
        isScanning: false,
        isConnecting: false,
        lastScanPayload: null,
        lastProfilesPayload: null,
    }
}

// initial state
const state = getDefaultState()

// eslint-disable-next-line
export const wifiManager: Module<ServerWifiState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
