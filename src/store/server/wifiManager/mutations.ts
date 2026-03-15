import { MutationTree } from 'vuex'
import { getDefaultState } from './index'
import { ServerWifiState, WifiApConfig, WifiNetwork, WifiProfile, WifiStatus } from '@/store/server/wifiManager/types'
import Vue from 'vue'

export const mutations: MutationTree<ServerWifiState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setAvailable(state, available: boolean) {
        Vue.set(state, 'available', available)
    },

    setStatus(state, status: WifiStatus) {
        Vue.set(state, 'status', status)
    },

    setNetworks(state, networks: WifiNetwork[]) {
        Vue.set(state, 'networks', networks)
    },

    setProfiles(state, profiles: WifiProfile[]) {
        Vue.set(state, 'profiles', profiles)
    },

    setApConfig(state, config: WifiApConfig) {
        Vue.set(state, 'apConfig', config)
    },

    setScanning(state, scanning: boolean) {
        Vue.set(state, 'isScanning', scanning)
    },

    setConnecting(state, connecting: boolean) {
        Vue.set(state, 'isConnecting', connecting)
    },

    setLastScanPayload(state, payload: any) {
        Vue.set(state, 'lastScanPayload', payload)
    },

    setLastProfilesPayload(state, payload: any) {
        Vue.set(state, 'lastProfilesPayload', payload)
    },
}
