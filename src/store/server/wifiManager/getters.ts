import { GetterTree } from 'vuex'
import { ServerWifiState, WifiNetwork, WifiProfile } from '@/store/server/wifiManager/types'
import { RootState } from '@/store/types'

export const getters: GetterTree<ServerWifiState, RootState> = {
    isAvailable: (state): boolean => {
        return state.available
    },

    isConnected: (state): boolean => {
        return state.status?.status === 'connected'
    },

    isApMode: (state): boolean => {
        return state.status?.status === 'ap_mode'
    },

    isDisconnected: (state): boolean => {
        return state.status?.status === 'disconnected'
    },

    currentSsid: (state): string | null => {
        return state.status?.connection?.ssid ?? null
    },

    currentIp: (state): string | null => {
        return state.status?.connection?.ip ?? null
    },

    signalStrength: (state): number => {
        return state.status?.connection?.signal ?? 0
    },

    wifiProfiles: (state): WifiProfile[] => {
        return state.profiles.filter((p) => p.type === 'wifi')
    },

    apProfiles: (state): WifiProfile[] => {
        return state.profiles.filter((p) => p.type === 'ap')
    },

    sortedNetworks: (state): WifiNetwork[] => {
        // Remove duplicates (keep strongest signal), sort by signal strength
        const uniqueNetworks: Record<string, WifiNetwork> = {}
        state.networks.forEach((n) => {
            if (!uniqueNetworks[n.ssid] || uniqueNetworks[n.ssid].signal < n.signal) {
                uniqueNetworks[n.ssid] = n
            }
        })
        return Object.values(uniqueNetworks).sort((a, b) => b.signal - a.signal)
    },

    apSsid: (state): string | null => {
        return state.apConfig?.ssid ?? null
    },

    apIp: (state): string | null => {
        return state.apConfig?.ip ?? null
    },
}
