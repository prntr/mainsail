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
 *   - WebSocket server in live_jogd: COMPLETE (live_jogd.py serves :7150)
 *
 *   The live_jogd service is installed but not auto-started. The Mainsail
 *   Controller menu starts it on demand via Moonraker
 *   `machine.services.start { service: "live_jogd" }`. The WebSocket
 *   client is connected only after the user clicks Initialize/Play, and
 *   torn down again when the user stops the service.
 *
 * PROTOCOL NOTES:
 *   The dongle uses a binary serial protocol. live_jogd translates between
 *   JSON (browser) and binary (dongle). Field mappings:
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
