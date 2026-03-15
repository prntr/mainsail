import { ActionTree } from 'vuex'
import { ServerWifiState } from '@/store/server/wifiManager/types'
import { RootState } from '@/store/types'
import Vue from 'vue'

export const actions: ActionTree<ServerWifiState, RootState> = {
    reset({ commit }) {
        commit('reset')
    },

    async init({ commit, dispatch }) {
        // This module is initialized only if wifi_manager is reported by Moonraker.
        commit('setAvailable', true)
        Vue.$socket.emit('server.wifi.status', {}, { action: 'server/wifiManager/onStatus' })
        Vue.$socket.emit('server.wifi.profiles', {}, { action: 'server/wifiManager/onProfiles' })
        Vue.$socket.emit('server.wifi.ap.config', {}, { action: 'server/wifiManager/onApConfig' })

        // Remove from init queue immediately - don't block app startup
        await dispatch('socket/removeInitModule', 'server/wifiManager/init', { root: true })
    },

    onStatus({ commit }, payload) {
        console.log('[WiFi] onStatus received:', payload)
        if (!payload.error) {
            commit('setStatus', payload)
        } else {
            console.error('[WiFi] onStatus error:', payload.error)
        }
    },

    onProfiles({ commit }, payload) {
        console.log('[WiFi] onProfiles received:', payload)
        commit('setLastProfilesPayload', payload)
        if (!payload.error) {
            const profiles = Array.isArray(payload) ? payload : payload.profiles
            if (profiles) {
                commit('setProfiles', profiles)
            }
        } else if (payload.error) {
            console.error('[WiFi] onProfiles error:', payload.error)
        }
    },

    onApConfig({ commit }, payload) {
        if (!payload.error) {
            commit('setApConfig', payload)
        }
    },

    onScan({ commit }, payload) {
        console.log('[WiFi] onScan received:', payload)
        commit('setLastScanPayload', payload)
        commit('setScanning', false)
        if (!payload.error && payload.networks) {
            commit('setNetworks', payload.networks)
        } else if (payload.error) {
            console.error('[WiFi] onScan error:', payload.error)
        }
    },

    onConnect({ commit }, payload) {
        commit('setConnecting', false)
        if (!payload.error) {
            // Refresh status after successful connect
            setTimeout(() => {
                Vue.$socket.emit('server.wifi.status', {}, { action: 'server/wifiManager/onStatus' })
                Vue.$socket.emit('server.wifi.profiles', {}, { action: 'server/wifiManager/onProfiles' })
            }, 2000)
        }
    },

    onForget(_, payload) {
        if (!payload.error) {
            Vue.$socket.emit('server.wifi.profiles', {}, { action: 'server/wifiManager/onProfiles' })
        }
    },

    onPriority(_, payload) {
        if (!payload.error) {
            Vue.$socket.emit('server.wifi.profiles', {}, { action: 'server/wifiManager/onProfiles' })
        }
    },

    onApEnable({ commit }, payload) {
        commit('setConnecting', false)
        if (!payload.error) {
            setTimeout(() => {
                Vue.$socket.emit('server.wifi.status', {}, { action: 'server/wifiManager/onStatus' })
            }, 2000)
        }
    },

    onApDisable({ commit }, payload) {
        commit('setConnecting', false)
        if (!payload.error) {
            setTimeout(() => {
                Vue.$socket.emit('server.wifi.status', {}, { action: 'server/wifiManager/onStatus' })
            }, 2000)
        }
    },

    onApConfigure(_, payload) {
        if (!payload.error) {
            Vue.$socket.emit('server.wifi.ap.config', {}, { action: 'server/wifiManager/onApConfig' })
        }
    },

    // Public actions to be called from components
    fetchStatus({ state, commit, rootState }) {
        console.log('[WiFi] fetchStatus - available:', state.available)
        // Check if wifi_manager is available even if state.available is false
        const components = rootState.server?.components ?? []
        if (!state.available && components.includes('wifi_manager')) {
            console.log('[WiFi] fetchStatus - wifi_manager found, setting available=true')
            commit('setAvailable', true)
        }
        if (!state.available) {
            console.warn('[WiFi] fetchStatus - wifi_manager not available')
            return
        }
        Vue.$socket.emit('server.wifi.status', {}, { action: 'server/wifiManager/onStatus' })
    },

    fetchNetworks({ commit, state, rootState }) {
        console.log('[WiFi] fetchNetworks - available:', state.available)
        const components = rootState.server?.components ?? []
        if (!state.available && components.includes('wifi_manager')) {
            console.log('[WiFi] fetchNetworks - wifi_manager found, setting available=true')
            commit('setAvailable', true)
        }
        if (!state.available) {
            console.warn('[WiFi] fetchNetworks - wifi_manager not available')
            return
        }
        commit('setScanning', true)
        Vue.$socket.emit('server.wifi.scan', {}, { action: 'server/wifiManager/onScan' })
    },

    fetchProfiles({ state, commit, rootState }) {
        console.log('[WiFi] fetchProfiles - available:', state.available)
        // Check if wifi_manager is available even if state.available is false
        const components = rootState.server?.components ?? []
        if (!state.available && components.includes('wifi_manager')) {
            console.log('[WiFi] fetchProfiles - wifi_manager found, setting available=true')
            commit('setAvailable', true)
        }
        if (!state.available) {
            console.warn('[WiFi] fetchProfiles - wifi_manager not available')
            return
        }
        Vue.$socket.emit('server.wifi.profiles', {}, { action: 'server/wifiManager/onProfiles' })
    },

    fetchApConfig({ state, commit, rootState }) {
        console.log('[WiFi] fetchApConfig - available:', state.available)
        const components = rootState.server?.components ?? []
        if (!state.available && components.includes('wifi_manager')) {
            console.log('[WiFi] fetchApConfig - wifi_manager found, setting available=true')
            commit('setAvailable', true)
        }
        if (!state.available) {
            console.warn('[WiFi] fetchApConfig - wifi_manager not available')
            return
        }
        Vue.$socket.emit('server.wifi.ap.config', {}, { action: 'server/wifiManager/onApConfig' })
    },

    connect({ commit, state }, payload: { ssid: string; password?: string }) {
        if (!state.available) return
        commit('setConnecting', true)
        Vue.$socket.emit('server.wifi.connect', payload, { action: 'server/wifiManager/onConnect' })
    },

    disconnect({ state }) {
        if (!state.available) return
        Vue.$socket.emit('server.wifi.disconnect', {}, { action: 'server/wifiManager/onStatus' })
    },

    forgetProfile({ state }, profile: string) {
        if (!state.available) return
        Vue.$socket.emit('server.wifi.forget', { profile }, { action: 'server/wifiManager/onForget' })
    },

    setPriority({ state }, payload: { profile: string; priority: number }) {
        if (!state.available) return
        Vue.$socket.emit('server.wifi.priority', payload, { action: 'server/wifiManager/onPriority' })
    },

    enableAp({ commit, state }, profile?: string) {
        if (!state.available) return
        commit('setConnecting', true)
        Vue.$socket.emit('server.wifi.ap.enable', { profile: profile ?? 'AccessPopup' }, { action: 'server/wifiManager/onApEnable' })
    },

    disableAp({ commit, state }) {
        if (!state.available) return
        commit('setConnecting', true)
        Vue.$socket.emit('server.wifi.ap.disable', {}, { action: 'server/wifiManager/onApDisable' })
    },

    configureAp({ state }, payload: { ssid?: string; password?: string; ip?: string }) {
        if (!state.available) return
        Vue.$socket.emit('server.wifi.ap.configure', payload, { action: 'server/wifiManager/onApConfigure' })
    },

    addNetwork({ state }, payload: { ssid: string; password?: string; autoconnect?: boolean; priority?: number }) {
        if (!state.available) return
        Vue.$socket.emit('server.wifi.add', payload, { action: 'server/wifiManager/onProfiles' })
    },
}
