// A Moonraker stand-in for UI tests: it replaces the page's WebSocket before
// Mainsail loads, answers the JSON-RPC calls Mainsail makes while it starts,
// and records the G-code scripts the page sends. Printer state comes from the
// test and changes through pushStatus, as Klipper's status updates would.

type Status = Record<string, Record<string, unknown>>

export interface FakeMoonraker {
    scripts: string[]
    requests: { method: string; params: any }[]
    pushStatus(update: Status): void
}

export interface FakeMoonrakerOptions {
    status: Status
    components?: string[]
    // Mainsail's saved settings (database namespace 'mainsail'), as a user left them.
    gui?: Record<string, unknown>
    // Answers for methods the defaults do not cover, by method name.
    answers?: Record<string, (params: any) => unknown>
}

const OPEN = 1
const CLOSED = 3

export function installFakeMoonraker(win: Window, options: FakeMoonrakerOptions): FakeMoonraker {
    const status: Status = JSON.parse(JSON.stringify(options.status))
    const sockets: FakeSocket[] = []
    const fake: FakeMoonraker = {
        scripts: [],
        requests: [],
        pushStatus(update: Status) {
            for (const [name, fields] of Object.entries(update)) {
                status[name] = { ...(status[name] ?? {}), ...fields }
            }
            const message = { jsonrpc: '2.0', method: 'notify_status_update', params: [update, Date.now() / 1000] }
            sockets.forEach((socket) => socket.deliver(message))
        },
    }

    const answers: Record<string, (params: any) => unknown> = {
        'server.connection.identify': () => ({ connection_id: 1 }),
        'server.info': () => ({
            klippy_connected: true,
            klippy_state: 'ready',
            components: options.components ?? [],
            failed_components: [],
            registered_directories: ['gcodes', 'config'],
            warnings: [],
            websocket_count: 1,
            moonraker_version: 'v0.9.3',
            api_version: [1, 5, 0],
            api_version_string: '1.5.0',
        }),
        'server.config': () => ({ config: {} }),
        'machine.system_info': () => ({ system_info: {} }),
        'machine.proc_stats': () => ({ moonraker_stats: [], throttled_state: null, system_uptime: 100 }),
        'server.database.list': () => ({ namespaces: ['mainsail', 'maintenance'] }),
        'server.database.get_item': (params) => ({
            namespace: params?.namespace,
            key: params?.key ?? null,
            value: params?.namespace === 'mainsail' ? JSON.parse(JSON.stringify(options.gui ?? {})) : {},
        }),
        'server.webcams.list': () => ({ webcams: [] }),
        'printer.info': () => ({
            state: 'ready',
            state_message: 'Printer is ready',
            hostname: 'fake-stitchlab',
            software_version: 'v0.12.0',
            app: 'Klipper',
        }),
        'server.gcode_store': () => ({ gcode_store: [] }),
        'server.temperature_store': () => ({}),
        'printer.objects.list': () => ({ objects: Object.keys(status) }),
        'printer.objects.subscribe': () => ({ eventtime: Date.now() / 1000, status }),
        'printer.objects.query': (params) => ({
            eventtime: Date.now() / 1000,
            status: Object.fromEntries(Object.keys(params?.objects ?? {}).map((name) => [name, status[name] ?? {}])),
        }),
        'server.files.get_directory': (params) => ({
            dirs: [],
            files: [],
            disk_usage: { total: 1e9, used: 0, free: 1e9 },
            root_info: { name: params?.path ?? 'gcodes', permissions: 'rw' },
        }),
        'printer.gcode.script': (params) => {
            fake.scripts.push(params.script)
            return 'ok'
        },
        ...options.answers,
    }

    class FakeSocket {
        static CONNECTING = 0
        static OPEN = OPEN
        static CLOSING = 2
        static CLOSED = CLOSED

        readyState = 0
        onopen: ((event: unknown) => void) | null = null
        onclose: ((event: unknown) => void) | null = null
        onerror: ((event: unknown) => void) | null = null
        onmessage: ((event: { data: string }) => void) | null = null

        constructor() {
            sockets.push(this)
            win.setTimeout(() => {
                this.readyState = OPEN
                this.onopen?.({})
            }, 0)
        }

        send(raw: string) {
            const parsed = JSON.parse(raw)
            const batch = Array.isArray(parsed) ? parsed : [parsed]
            const replies = batch.map((request) => this.answer(request))
            this.deliver(Array.isArray(parsed) ? replies : replies[0])
        }

        answer(request: { id: number; method: string; params: any }) {
            fake.requests.push({ method: request.method, params: request.params })
            const handler = answers[request.method]
            if (!handler) {
                return { jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } }
            }
            return { jsonrpc: '2.0', id: request.id, result: handler(request.params) }
        }

        deliver(message: unknown) {
            if (this.readyState !== OPEN) return
            win.setTimeout(() => this.onmessage?.({ data: JSON.stringify(message) }), 0)
        }

        close() {
            this.readyState = CLOSED
            this.onclose?.({ code: 1000, reason: '', wasClean: true })
        }
    }

    ;(win as any).WebSocket = FakeSocket
    return fake
}
