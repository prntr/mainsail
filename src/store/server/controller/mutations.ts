import Vue from 'vue'
import { MutationTree } from 'vuex'
import { getDefaultState } from '@/store/server/controller/index'
import {
    ServerControllerState,
    ControllerDongleInfo,
    ControllerDongleStatus,
    ControllerPeerInfo,
    ControllerJoystickState,
    ControllerType,
} from '@/store/server/controller/types'

export const mutations: MutationTree<ServerControllerState> = {
    reset(state) {
        Object.assign(state, getDefaultState())
    },

    setDongleConnected(state, payload: boolean) {
        Vue.set(state, 'dongle_connected', payload)
    },

    setDongleInfo(state, payload: ControllerDongleInfo) {
        Vue.set(state, 'dongle_info', payload)
    },

    setDongleStatus(state, payload: ControllerDongleStatus) {
        Vue.set(state, 'dongle_status', payload)
    },

    setPeers(state, payload: ControllerPeerInfo[]) {
        Vue.set(state, 'peers', payload)
    },

    setJoystick(state, payload: ControllerJoystickState) {
        Vue.set(state, 'joystick', payload)
    },

    setLiveControlEnabled(state, payload: boolean) {
        Vue.set(state, 'live_control_enabled', payload)
    },

    setActiveControllerType(state, payload: ControllerType) {
        Vue.set(state, 'active_controller_type', payload)
    },

    setMotionEnabled(state, payload: boolean) {
        Vue.set(state, 'motion_enabled', payload)
    },

    setMotionBlockReason(state, payload: string) {
        Vue.set(state, 'motion_block_reason', payload)
    },

    setWebsocketConnected(state, payload: boolean) {
        Vue.set(state, 'websocket_connected', payload)
    },

    updateDongleInfo(state, payload: Partial<ControllerDongleInfo>) {
        state.dongle_info = { ...state.dongle_info, ...payload }
    },

    updateDongleStatus(state, payload: Partial<ControllerDongleStatus>) {
        state.dongle_status = { ...state.dongle_status, ...payload }
    },

    updatePeer(state, payload: ControllerPeerInfo) {
        const index = state.peers.findIndex((p) => p.slot_id === payload.slot_id)
        if (index >= 0) {
            Vue.set(state.peers, index, payload)
        } else {
            state.peers.push(payload)
        }
    },

    removePeer(state, slot_id: number) {
        const index = state.peers.findIndex((p) => p.slot_id === slot_id)
        if (index >= 0) {
            state.peers.splice(index, 1)
        }
    },
}
