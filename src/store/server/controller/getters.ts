import { GetterTree } from 'vuex'
import { ServerControllerState, ControllerPeerInfo } from '@/store/server/controller/types'
import { RootState } from '@/store/types'

// eslint-disable-next-line
export const getters: GetterTree<ServerControllerState, RootState> = {
    isDongleConnected: (state): boolean => {
        return state.dongle_connected
    },

    isWebsocketConnected: (state): boolean => {
        return state.websocket_connected
    },

    isLinkActive: (state): boolean => {
        return state.dongle_status.link_active
    },

    getActivePeers: (state): ControllerPeerInfo[] => {
        return state.peers.filter((peer) => peer.active)
    },

    getActiveControllerCount: (state): number => {
        return state.peers.filter((peer) => peer.active).length
    },

    hasActiveController: (state): boolean => {
        return state.peers.some((peer) => peer.active)
    },

    isWifiEnabled: (state): boolean => {
        return state.dongle_info.wifi_enabled
    },

    isPairingMode: (state): boolean => {
        return state.dongle_status.pairing_mode
    },

    getRssiLevel: (state): 'good' | 'medium' | 'poor' | 'none' => {
        const rssi = state.dongle_status.rssi
        if (!rssi || rssi === 0) return 'none'
        if (rssi >= -50) return 'good'
        if (rssi >= -70) return 'medium'
        return 'poor'
    },

    getFormattedUptime: (state): string => {
        const seconds = state.dongle_status.uptime_seconds
        if (!seconds) return 'N/A'

        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)

        if (hours > 0) {
            return `${hours}h ${minutes}m`
        }
        return `${minutes}m`
    },
}
