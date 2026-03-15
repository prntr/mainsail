// WiFi Manager Types

export interface WifiConnection {
    name: string | null
    ssid: string | null
    ip: string | null
    type: string
    signal: number
    is_ap: boolean
}

export interface WifiStatus {
    status: 'connected' | 'disconnected' | 'ap_mode'
    connection: WifiConnection
    wifi_enabled: boolean
    timer_active: boolean
}

export interface WifiNetwork {
    ssid: string
    signal: number
    security: string
    in_use: boolean
    saved: boolean
}

export interface WifiProfile {
    name: string
    type: 'wifi' | 'ap'
    ssid: string
    autoconnect: boolean
    priority: number
}

export interface WifiApConfig {
    profile: string
    ssid: string | null
    ip: string | null
    security: string | null
}

export interface ServerWifiState {
    available: boolean
    status: WifiStatus | null
    networks: WifiNetwork[]
    profiles: WifiProfile[]
    apConfig: WifiApConfig | null
    isScanning: boolean
    isConnecting: boolean
    lastScanPayload: any | null
    lastProfilesPayload: any | null
}
