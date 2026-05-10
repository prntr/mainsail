import { Store } from 'vuex'
import _Vue from 'vue'
import { RootState } from '@/store/types'
import { initableServerComponents } from '@/store/variables'

// Module-scoped log helper. All connection-lifecycle logging goes
// through here so remote diagnostic reports surface the same prefix
// regardless of which method ran them. See P0-8 of the Cross-Platform
// Mainsail Stability plan and CLAUDE.md.
const log = (...args: unknown[]) => window.console.log('[WebSocket]', ...args)

const HEARTBEAT_RECV_GAP_MS = 30_000
const KEEPALIVE_INTERVAL_MS = 10_000
const HEALTHY_TRAFFIC_RESET_MS = 60_000
const INIT_WAIT_TIMEOUT_MS = 30_000

export class WebSocketClient {
    url = ''
    instance: WebSocket | null = null
    maxReconnects = 5
    reconnectInterval = 1000
    reconnects = 0
    keepAliveTimeout = 1000
    messageId: number = 0
    timerId: number | null = null
    store: Store<RootState> | null = null
    waits: Wait[] = []
    heartbeatTimer: number | null = null
    keepaliveTimer: number | null = null
    reconnectTimer: number | null = null

    // P0-6: separate inbound and outbound timestamps so the receive
    // watchdog cannot be masked by our own keepalive emit traffic.
    lastReceivedAt = 0
    lastSentAt = 0
    lastOpenedAt = 0

    // P0-6: heartbeat watchdog uses an explicit close path — onclose
    // would otherwise see wasClean=true and skip reconnect.
    explicitClose = false

    // P0-5: pause keepalive while the OS reports offline so we don't
    // burn timers / battery while the radio is down.
    paused = false

    lifecycleAttached = false

    constructor(options: WebSocketPluginOptions) {
        this.url = options.url
        this.maxReconnects = options.maxReconnects || 5
        this.reconnectInterval = options.reconnectInterval || 1000
        this.store = options.store
        this.attachLifecycleHandlers()
    }

    setUrl(url: string): void {
        this.url = url
    }

    // P0-5: react to tab focus, network online/offline and BFCache
    // restores. Without these, a backgrounded Chromium tab waits up to
    // 30 s before the next exponential-backoff reconnect tick.
    attachLifecycleHandlers(): void {
        if (this.lifecycleAttached || typeof window === 'undefined') return
        this.lifecycleAttached = true

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') this.handleResume('visibility')
        })
        window.addEventListener('online', () => this.handleResume('online'))
        window.addEventListener('offline', () => {
            log('network offline — pausing keepalive')
            this.paused = true
            this.stopKeepalive()
        })
        window.addEventListener('pageshow', () => this.handleResume('pageshow'))
    }

    handleResume(source: string): void {
        this.paused = false
        if (this.instance?.readyState === WebSocket.OPEN) {
            log(`${source}: socket OPEN, probing server.info and resetting watchdog`)
            this.lastReceivedAt = Date.now()
            this.resetReceiveWatchdog()
            this.startKeepalive()
            // Send a probe so the server confirms it's still reachable;
            // a missing response within HEARTBEAT_RECV_GAP_MS will trip
            // the watchdog and force a reconnect.
            this.emit('server.info', {})
            return
        }
        log(`${source}: socket not OPEN — forcing immediate reconnect`)
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        this.reconnects = 0
        this.connect()
    }

    handleMessage(data: any) {
        const wait = this.getWaitById(data.id)

        // reject promise if it exists
        if ('error' in data && wait?.reject) {
            wait.reject(data.error)
            this.removeWaitById(wait.id)
            return
        }

        // report error messages
        if (data.error?.message) {
            // only report errors, if not disconnected and no init component
            if (data.error?.message !== 'Klippy Disconnected') {
                window.console.error(`Response Error: ${data.error.message} (${wait?.action ?? 'no action'})`)
            }

            if (wait) {
                this.failInitWaitIfApplicable(wait, 'error response')
                this.removeWaitById(wait.id)
            }

            return
        }

        // pass it to socket/onMessage, if no wait exists
        if (!wait) {
            this.store?.dispatch('socket/onMessage', data)
            return
        }

        // resolve promise if it exists
        if (wait?.resolve) wait.resolve(data.result ?? {})

        // pass result to action
        if (wait.action) {
            let result = data.result
            if (result === 'ok') result = { result: result }
            if (typeof result === 'string') result = { result: result }

            const preload = {}
            if (wait.actionPayload) Object.assign(preload, wait.actionPayload)
            Object.assign(preload, { requestParams: wait.params })
            Object.assign(preload, result)
            this.store?.dispatch(wait.action, preload)
        }

        this.removeWaitById(wait.id)
    }

    async connect() {
        this.store?.dispatch('socket/setData', {
            isConnecting: true,
        })

        log(`connecting to ${this.url}`)
        this.instance?.close()
        this.instance = new WebSocket(this.url)

        this.instance.onopen = () => {
            log('opened')
            this.reconnects = 0
            this.lastOpenedAt = Date.now()
            this.lastReceivedAt = this.lastOpenedAt
            this.lastSentAt = this.lastOpenedAt
            this.explicitClose = false
            this.resetReceiveWatchdog()
            this.startKeepalive()
            this.store?.dispatch('socket/onOpen', event)
        }

        this.instance.onclose = (e) => {
            log(`closed code=${e.code} reason=${e.reason || '(none)'} wasClean=${e.wasClean}`)
            this.stopKeepalive()
            this.clearReceiveWatchdog()

            // Reconnect on any non-clean close, AND on a clean close
            // that we initiated from the heartbeat watchdog (P0-6).
            // Browser-clean closes from our own close() would otherwise
            // be ignored and leave the user disconnected forever.
            const shouldReconnect = !e.wasClean || this.explicitClose
            if (!shouldReconnect) {
                this.store?.dispatch('socket/onClose', e)
                return
            }

            const delay = Math.min(30000, this.reconnectInterval * Math.pow(2, Math.min(this.reconnects, 5)))
            this.reconnects++
            log(`reconnect scheduled in ${delay}ms (attempt ${this.reconnects})`)
            this.explicitClose = false
            this.reconnectTimer = window.setTimeout(() => {
                this.reconnectTimer = null
                this.connect()
            }, delay)
        }

        this.instance.onerror = () => {
            log('error event')
            this.instance?.close()
        }

        this.instance.onmessage = (msg) => {
            if (this.store === null) return

            // Receive-side liveness only (P0-6).
            this.lastReceivedAt = Date.now()
            this.resetReceiveWatchdog()

            // P0-7: clear the reconnects counter after sustained
            // healthy traffic so a long-running tab does not creep up
            // to the 32 s ceiling because of intermittent prior drops.
            if (this.reconnects > 0 && this.lastReceivedAt - this.lastOpenedAt > HEALTHY_TRAFFIC_RESET_MS) {
                log(`healthy for >${HEALTHY_TRAFFIC_RESET_MS}ms — resetting reconnects counter`)
                this.reconnects = 0
            }

            const data = JSON.parse(msg.data)
            if (Array.isArray(data)) {
                for (const message of data) {
                    this.handleMessage(message)
                }

                return
            }

            this.handleMessage(data)
        }
    }

    close(): void {
        this.instance?.close()
    }

    getWaitById(id: number): Wait | null {
        return this.waits.find((wait: Wait) => wait.id === id) ?? null
    }

    removeWaitById(id: number | null): void {
        const index = this.waits.findIndex((wait: Wait) => wait.id === id)
        if (index !== -1) {
            const wait = this.waits[index]
            if (wait.loading) this.store?.dispatch('socket/removeLoading', { name: wait.loading })
            if (wait.timeoutId !== undefined && wait.timeoutId !== null) {
                clearTimeout(wait.timeoutId)
            }
            this.waits.splice(index, 1)
        }
    }

    // P0-9: tag init-related waits with a 30 s timeout so a single
    // hung response can no longer stall guiIsReady forever. On timeout
    // mark the component failed (server/addFailedInitComponent) and
    // remove it from the init list — same path as an error response.
    private armInitTimeout(wait: Wait): void {
        if (!wait.action?.startsWith('server/')) return
        const component = wait.action.split('/')[1]
        if (!component || !initableServerComponents.includes(component)) return

        wait.timeoutId = window.setTimeout(() => {
            log(`init wait timed out after ${INIT_WAIT_TIMEOUT_MS}ms: ${wait.action}`)
            this.failInitWaitIfApplicable(wait, 'timeout')
            this.removeWaitById(wait.id)
        }, INIT_WAIT_TIMEOUT_MS)
    }

    private failInitWaitIfApplicable(wait: Wait, reason: string): void {
        if (!wait.action?.startsWith('server/')) return
        const modulename = wait.action.split('/')[1]
        if (!modulename || !initableServerComponents.includes(modulename)) return
        if (!this.store?.state.socket?.initializationList.length) return
        const component = wait.action.replace('server/', '').split('/')[0]
        window.console.error(`init server component ${component} failed (${reason})`)
        this.store?.dispatch('server/addFailedInitComponent', component)
        this.store?.dispatch('socket/removeInitComponent', `server/${component}/`)
    }

    emit(method: string, params: Params, options: emitOptions = {}): void {
        if (this.instance?.readyState !== WebSocket.OPEN) {
            log(`emit dropped (readyState=${this.instance?.readyState ?? 'null'}): ${method}`)
            return
        }

        const id = this.messageId++
        const wait: Wait = {
            id: id,
            params: params,
            action: options.action ?? null,
            actionPayload: options.actionPayload ?? {},
            loading: options.loading ?? null,
        }
        this.waits.push(wait)
        this.armInitTimeout(wait)

        if (options.loading) this.store?.dispatch('socket/addLoading', { name: options.loading })

        this.lastSentAt = Date.now()
        this.instance?.send(
            JSON.stringify({
                jsonrpc: '2.0',
                method,
                params,
                id,
            })
        )
    }

    async emitAndWait(method: string, params: Params | undefined = undefined, options: emitOptions = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.instance?.readyState !== WebSocket.OPEN) {
                log(`emitAndWait rejected (socket not OPEN): ${method}`)
                reject()
                return
            }

            const id = this.messageId++
            const wait: Wait = {
                id: id,
                params: params,
                action: options.action ?? null,
                actionPayload: options.actionPayload ?? {},
                loading: options.loading ?? null,
                resolve,
                reject,
            }
            this.waits.push(wait)
            this.armInitTimeout(wait)

            if (options.loading) this.store?.dispatch('socket/addLoading', { name: options.loading })

            this.lastSentAt = Date.now()
            this.instance?.send(
                JSON.stringify({
                    jsonrpc: '2.0',
                    method,
                    params,
                    id,
                })
            )
        })
    }

    emitBatch(messages: BatchMessage[]): void {
        if (messages.length === 0) return
        if (this.instance?.readyState !== WebSocket.OPEN) {
            log(`emitBatch dropped (readyState=${this.instance?.readyState ?? 'null'}, ${messages.length} msgs)`)
            return
        }

        const body = []
        for (const { method, params, emitOptions = {} } of messages) {
            const id = this.messageId++
            const wait: Wait = {
                id: id,
                params: params,
                action: emitOptions.action ?? null,
                actionPayload: emitOptions.actionPayload ?? {},
                loading: emitOptions.loading ?? null,
            }
            this.waits.push(wait)
            this.armInitTimeout(wait)

            if (emitOptions.loading) this.store?.dispatch('socket/addLoading', { name: emitOptions.loading })
            body.push({
                jsonrpc: '2.0',
                method,
                params,
                id,
            })
        }

        this.lastSentAt = Date.now()
        this.instance.send(JSON.stringify(body))
    }

    // P0-6: receive-side watchdog only. Outbound traffic does NOT
    // reset this — a dead server is detected by the absence of any
    // inbound traffic for HEARTBEAT_RECV_GAP_MS (including the keepalive
    // server.info responses, which arrive every ~10 s when healthy).
    resetReceiveWatchdog(): void {
        this.clearReceiveWatchdog()
        this.heartbeatTimer = window.setTimeout(() => {
            if (this.instance?.readyState !== WebSocket.OPEN || !this.store) return
            log(`heartbeat watchdog: no inbound message in ${HEARTBEAT_RECV_GAP_MS}ms — closing for reconnect`)
            this.explicitClose = true
            this.close()
        }, HEARTBEAT_RECV_GAP_MS)
    }

    clearReceiveWatchdog(): void {
        if (this.heartbeatTimer !== null) {
            clearTimeout(this.heartbeatTimer)
            this.heartbeatTimer = null
        }
    }

    startKeepalive(): void {
        this.stopKeepalive()
        if (this.paused) return
        this.keepaliveTimer = window.setInterval(() => {
            if (this.instance?.readyState !== WebSocket.OPEN) return
            this.emit('server.info', {})
        }, KEEPALIVE_INTERVAL_MS)
    }

    stopKeepalive(): void {
        if (this.keepaliveTimer) {
            clearInterval(this.keepaliveTimer)
            this.keepaliveTimer = null
        }
    }
}

export function WebSocketPlugin(Vue: typeof _Vue, options: WebSocketPluginOptions): void {
    const socket = new WebSocketClient(options)
    Vue.prototype.$socket = socket
    Vue.$socket = socket
}

export interface WebSocketPluginOptions {
    url: string
    maxReconnects?: number
    reconnectInterval?: number
    store: Store<RootState>
}

export interface WebSocketClient {
    connect(): void
    close(): void
    emit(method: string, params: Params, emitOptions: emitOptions): void
    emitBatch(messages: BatchMessage[]): void
}

export interface BatchMessage {
    method: string
    params: Params
    emitOptions: emitOptions
}

export interface Wait {
    id: number
    params: any
    action?: string | null
    actionPayload?: any
    loading?: string | null
    resolve?: (value: any) => void
    reject?: (reason: any) => void
    timeoutId?: number | null
}

interface Params {
    data?: any
    [key: string]: any
}

interface emitOptions {
    action?: string | null
    actionPayload?: Params
    loading?: string | null
}
