/**
 * StitchLab Controller Store State
 *
 * Manages state for the wireless control system (StitchLabController + StitchLabDongle).
 *
 * ARCHITECTURE:
 *   Browser (this store) <--WebSocket:7150--> live_jogd.py <--USB Serial--> Dongle <--ESP-NOW--> Controller
 *
 * INTEGRATION STATUS:
 *   - WebSocket client (controllerWebSocket.ts): COMPLETE
 *   - WebSocket server in live_jogd: NOT IMPLEMENTED
 *   - Workaround: Use CLI (dongle_api.py) or physical controller
 *
 * PROTOCOL NOTES:
 *   The actual dongle uses a binary serial protocol. If a WebSocket bridge is added to live_jogd,
 *   it should translate between JSON (browser) and binary (dongle). Field mappings:
 *
 *   | Frontend Field       | Dongle Field              | Conversion                    |
 *   |----------------------|---------------------------|-------------------------------|
 *   | firmware_version     | fw_major.minor.patch      | Format as "X.Y.Z" string      |
 *   | uptime_seconds       | uptime_ms                 | Divide by 1000                |
 *   | wifi_enabled         | wifi_enabled (0/1)        | Convert to boolean            |
 *   | link_active          | link_status (0/1)         | Convert to boolean            |
 *   | joystick.vx/vy       | vx/vy (int16 * 10)        | Divide by 10.0 for mm/s       |
 *
 * See: KlipperLiveControl/project.md for full protocol documentation
 */
export interface ServerControllerState {
    dongle_connected: boolean
    dongle_info: ControllerDongleInfo
    dongle_status: ControllerDongleStatus
    peers: ControllerPeerInfo[]
    joystick: ControllerJoystickState
    websocket_connected: boolean
}

export interface ControllerDongleInfo {
    mac: string
    firmware_version: string
    wifi_enabled: boolean
    controller_count: number
    led_brightness: number
}

export interface ControllerDongleStatus {
    uptime_seconds: number
    packets_rx: number
    packets_tx: number
    crc_errors: number
    link_active: boolean
    pairing_mode: boolean
    rssi: number
}

export interface ControllerPeerInfo {
    slot_id: number
    mac: string
    active: boolean
    last_seen: number
    packet_count: number
}

export interface ControllerJoystickState {
    vx: number
    vy: number
    deadman: boolean
    buttons: number
}
