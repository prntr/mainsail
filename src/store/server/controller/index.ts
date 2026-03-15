import { Module } from 'vuex'
import { ServerControllerState } from '@/store/server/controller/types'
import { actions } from '@/store/server/controller/actions'
import { mutations } from '@/store/server/controller/mutations'
import { getters } from '@/store/server/controller/getters'

export const getDefaultState = (): ServerControllerState => {
    return {
        dongle_connected: false,
        dongle_info: {
            mac: '',
            firmware_version: '',
            wifi_enabled: false,
            controller_count: 0,
            led_brightness: 0,
        },
        dongle_status: {
            uptime_seconds: 0,
            packets_rx: 0,
            packets_tx: 0,
            crc_errors: 0,
            link_active: false,
            pairing_mode: false,
            rssi: 0,
        },
        peers: [],
        joystick: {
            vx: 0,
            vy: 0,
            deadman: false,
            buttons: 0,
        },
        websocket_connected: false,
    }
}

const state = getDefaultState()

// eslint-disable-next-line
export const controller: Module<ServerControllerState, any> = {
    namespaced: true,
    state,
    getters,
    actions,
    mutations,
}
