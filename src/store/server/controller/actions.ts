import { ActionTree } from 'vuex'
import { ServerControllerState, ControllerDongleInfo, ControllerDongleStatus, ControllerPeerInfo } from '@/store/server/controller/types'
import { RootState } from '@/store/types'
import { getControllerWebSocket } from '@/plugins/controllerWebSocket'

// eslint-disable-next-line
export const actions: ActionTree<ServerControllerState, RootState> = {
    reset({ commit }) {
        commit('reset')
    },

    // Initialize WebSocket connection to live_jogd
    initWebSocket() {
        const ws = getControllerWebSocket(this as any)
        ws.connect()
    },

    // Called when live_jogd WebSocket connects
    onConnect({ commit }) {
        commit('setWebsocketConnected', true)
    },

    // Called when live_jogd WebSocket disconnects
    onDisconnect({ commit }) {
        commit('reset')  // Reset all state to defaults when WebSocket disconnects
    },

    // Handle status update from live_jogd WebSocket
    onStatusUpdate({ commit }, payload: {
        dongle_connected: boolean
        dongle_info?: ControllerDongleInfo
        dongle_status?: ControllerDongleStatus
        peers?: ControllerPeerInfo[]
    }) {
        commit('setDongleConnected', payload.dongle_connected)

        // Clear peers when dongle is not connected
        if (!payload.dongle_connected) {
            commit('setPeers', [])
        } else if (payload.peers) {
            commit('setPeers', payload.peers)
        }

        if (payload.dongle_info) {
            commit('setDongleInfo', payload.dongle_info)
        }

        if (payload.dongle_status) {
            commit('setDongleStatus', payload.dongle_status)
        }
    },

    // Handle joystick data from live_jogd WebSocket
    onJoystickUpdate({ commit }, payload: { vx: number; vy: number; deadman: boolean; buttons: number }) {
        commit('setJoystick', payload)
    },

    // Handle peer connected event
    onPeerConnected({ commit }, payload: ControllerPeerInfo) {
        commit('updatePeer', payload)
    },

    // Handle peer disconnected event
    onPeerDisconnected({ commit }, slot_id: number) {
        commit('removePeer', slot_id)
    },

    // Command: Toggle WiFi
    toggleWifi({ state }) {
        const ws = getControllerWebSocket(this as any)
        const newState = !state.dongle_info.wifi_enabled
        ws.toggleWifi(newState)
    },

    // Command: Toggle Pairing
    togglePairing({ state }) {
        const ws = getControllerWebSocket(this as any)
        const newState = !state.dongle_status.pairing_mode
        ws.togglePairing(newState)
    },

    // Command: Select active controller
    selectController(_, slot_id: number) {
        const ws = getControllerWebSocket(this as any)
        ws.selectController(slot_id)
    },

    // Command: Set LED brightness
    setLedBrightness(_, brightness: number) {
        const ws = getControllerWebSocket(this as any)
        ws.setLedBrightness(brightness)
    },

    // Command: Clear all peers
    clearPeers() {
        const ws = getControllerWebSocket(this as any)
        ws.clearPeers()
    },
}
