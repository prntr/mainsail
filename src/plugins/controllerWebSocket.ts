import { Store } from 'vuex'
import { RootState } from '@/store/types'

export class ControllerWebSocketClient {
    private url: string
    private instance: WebSocket | null = null
    private store: Store<RootState>
    private reconnectTimeout: number | null = null
    private reconnectAttempts = 0
    private maxReconnectAttempts = 10
    private reconnectDelay = 2000
    private isManualClose = false

    constructor(store: Store<RootState>) {
        this.store = store
        // WebSocket URL for live_jogd - uses same host as the page, port 7150
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        this.url = `${protocol}//${window.location.hostname}:7150`
    }

    connect(): void {
        if (this.instance?.readyState === WebSocket.OPEN) {
            return
        }

        this.isManualClose = false

        try {
            this.instance = new WebSocket(this.url)

            this.instance.onopen = () => {
                window.console.log('[ControllerWS] Connected to live_jogd')
                this.reconnectAttempts = 0
                this.store.dispatch('server/controller/onConnect')

                // Request initial status
                this.send({ type: 'get_status' })
            }

            this.instance.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    this.handleMessage(data)
                } catch (e) {
                    window.console.error('[ControllerWS] Failed to parse message:', e)
                }
            }

            this.instance.onclose = (event) => {
                window.console.log('[ControllerWS] Disconnected:', event.code, event.reason)
                this.store.dispatch('server/controller/onDisconnect')

                if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect()
                }
            }

            this.instance.onerror = (error) => {
                window.console.error('[ControllerWS] Error:', error)
            }
        } catch (e) {
            window.console.error('[ControllerWS] Failed to connect:', e)
            this.scheduleReconnect()
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
        }

        this.reconnectAttempts++
        const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 30000)

        window.console.log(`[ControllerWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

        this.reconnectTimeout = window.setTimeout(() => {
            this.connect()
        }, delay)
    }

    close(): void {
        this.isManualClose = true

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }

        if (this.instance) {
            this.instance.close()
            this.instance = null
        }
    }

    send(data: Record<string, unknown>): void {
        if (this.instance?.readyState === WebSocket.OPEN) {
            this.instance.send(JSON.stringify(data))
        } else {
            window.console.warn('[ControllerWS] Cannot send, not connected')
        }
    }

    private handleMessage(data: Record<string, unknown>): void {
        const type = data.type as string

        switch (type) {
            case 'status':
                this.store.dispatch('server/controller/onStatusUpdate', data)
                break

            case 'joystick':
                this.store.dispatch('server/controller/onJoystickUpdate', data)
                break

            case 'peer_connected':
                this.store.dispatch('server/controller/onPeerConnected', data.peer)
                break

            case 'peer_disconnected':
                this.store.dispatch('server/controller/onPeerDisconnected', data.slot_id)
                break

            case 'command_response':
                // Handle command responses (wifi, pairing, etc.)
                this.handleCommandResponse(data)
                break

            default:
                window.console.log('[ControllerWS] Unknown message type:', type, data)
        }
    }

    private handleCommandResponse(data: Record<string, unknown>): void {
        const command = data.command as string
        const success = data.success as boolean

        // Remove loading state based on command
        const loadingMap: Record<string, string> = {
            wifi: 'controllerWifi',
            pairing: 'controllerPairing',
            select_controller: 'controllerSelect',
        }

        const loadingName = loadingMap[command]
        if (loadingName) {
            this.store.dispatch('socket/removeLoading', { name: loadingName })
        }

        if (!success) {
            const error = data.error as string
            window.console.error(`[ControllerWS] Command ${command} failed:`, error)
        }
    }

    // Command methods
    toggleWifi(enabled: boolean): void {
        this.store.dispatch('socket/addLoading', { name: 'controllerWifi' })
        this.send({ type: 'wifi', value: enabled ? 'on' : 'off' })
    }

    togglePairing(enabled: boolean): void {
        this.store.dispatch('socket/addLoading', { name: 'controllerPairing' })
        this.send({ type: 'pairing', value: enabled ? 'on' : 'off' })
    }

    selectController(slotId: number): void {
        this.store.dispatch('socket/addLoading', { name: 'controllerSelect' })
        this.send({ type: 'select_controller', value: slotId })
    }

    setLedBrightness(brightness: number): void {
        this.send({ type: 'led', value: brightness })
    }

    clearPeers(): void {
        this.send({ type: 'clear_peers' })
    }

    get isConnected(): boolean {
        return this.instance?.readyState === WebSocket.OPEN
    }
}

// Singleton instance
let controllerWsInstance: ControllerWebSocketClient | null = null

export function getControllerWebSocket(store: Store<RootState>): ControllerWebSocketClient {
    if (!controllerWsInstance) {
        controllerWsInstance = new ControllerWebSocketClient(store)
    }
    return controllerWsInstance
}

export function closeControllerWebSocket(): void {
    if (controllerWsInstance) {
        controllerWsInstance.close()
        controllerWsInstance = null
    }
}
