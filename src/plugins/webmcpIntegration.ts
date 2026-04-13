/**
 * WebMCP Integration for Mainsail
 *
 * Loads webmcp.js in dev mode and registers Moonraker/Klipper tools
 * so AI agents can interact with the printer through the Mainsail UI.
 *
 * @see https://webmcp.dev
 * @see https://github.com/jasonjmcghee/WebMCP
 */

import Vue from 'vue'
import { Store } from 'vuex'
import { RootState } from '@/store/types'

declare global {
    interface Window {
        WebMCP: new (options?: Record<string, unknown>) => WebMCPInstance
        __webmcp: WebMCPInstance | null
    }
}

interface WebMCPInstance {
    registerTool(
        name: string,
        description: string,
        schema: Record<string, unknown>,
        executeFn: (args: Record<string, unknown>) => unknown
    ): void
    registerResource(
        name: string,
        description: string,
        options: Record<string, unknown>,
        provideFn: (uri: string) => unknown
    ): void
    registerPrompt(
        name: string,
        description: string,
        promptArgs: Array<Record<string, unknown>>,
        executeFn: (args: Record<string, unknown>) => unknown
    ): void
}

const WEBMCP_CDN = 'https://cdn.jsdelivr.net/gh/jasonjmcghee/WebMCP@v0.1.13/src/webmcp.js'

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve()
            return
        }
        const script = document.createElement('script')
        script.src = src
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed to load WebMCP from ${src}`))
        document.head.appendChild(script)
    })
}

function textResult(text: string) {
    return { content: [{ type: 'text', text }] }
}

function jsonResult(data: unknown) {
    return textResult(JSON.stringify(data, null, 2))
}

function errorResult(msg: string) {
    return textResult(`Error: ${msg}`)
}

function registerTools(mcp: WebMCPInstance, store: Store<RootState>) {
    // ── Printer Status ──────────────────────────────────────────────

    mcp.registerTool(
        'get_printer_status',
        'Get current printer status including temperatures, position, print progress, and speeds. Returns a comprehensive snapshot of the printer state.',
        { type: 'object', properties: {} },
        () => {
            const printer = store.state.printer ?? {}
            const toolhead = printer['toolhead'] ?? {}
            const gcode_move = printer['gcode_move'] ?? {}
            const print_stats = printer['print_stats'] ?? {}
            const display_status = printer['display_status'] ?? {}
            const heater_bed = printer['heater_bed'] ?? {}
            const extruder = printer['extruder'] ?? {}
            const fan = printer['fan'] ?? {}

            return jsonResult({
                state: print_stats.state ?? 'unknown',
                message: print_stats.message ?? '',
                progress: display_status.progress ?? 0,
                filename: print_stats.filename ?? '',
                print_duration: print_stats.print_duration ?? 0,
                total_duration: print_stats.total_duration ?? 0,
                position: toolhead.position ?? [],
                homed_axes: toolhead.homed_axes ?? '',
                extruder: {
                    temperature: extruder.temperature ?? 0,
                    target: extruder.target ?? 0,
                    power: extruder.power ?? 0,
                },
                bed: {
                    temperature: heater_bed.temperature ?? 0,
                    target: heater_bed.target ?? 0,
                    power: heater_bed.power ?? 0,
                },
                fan_speed: fan.speed ?? 0,
                speed_factor: gcode_move.speed_factor ?? 1,
                extrude_factor: gcode_move.extrude_factor ?? 1,
                max_velocity: toolhead.max_velocity ?? 0,
                max_accel: toolhead.max_accel ?? 0,
                square_corner_velocity: toolhead.square_corner_velocity ?? 0,
            })
        }
    )

    // ── Printer Info ────────────────────────────────────────────────

    mcp.registerTool(
        'get_printer_info',
        'Get Klipper firmware info: version, hostname, MCU state, klippy connection status.',
        { type: 'object', properties: {} },
        () => {
            const printer = (store.state.printer ?? {}) as Record<string, any>
            const server = (store.state.server ?? {}) as Record<string, any>

            return jsonResult({
                app_name: printer.app_name ?? 'klipper',
                hostname: printer.hostname ?? 'unknown',
                software_version: printer.software_version ?? 'unknown',
                cpu_info: printer.cpu_info ?? 'unknown',
                klippy_state: server.klippy_state ?? 'unknown',
                klippy_message: server.klippy_message ?? '',
                klippy_connected: server.klippy_connected ?? false,
                moonraker_version: server.moonraker_version ?? 'unknown',
                components: server.components ?? [],
            })
        }
    )

    // ── Send GCode ──────────────────────────────────────────────────

    mcp.registerTool(
        'send_gcode',
        'Send a G-code command to the printer. Examples: "G28" (home), "G1 X100 Y100 F3000" (move), "M104 S200" (set extruder temp). Multiple commands can be separated by newlines.',
        {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'G-code command(s) to execute. Separate multiple commands with newlines.',
                },
            },
            required: ['command'],
        },
        async (args: Record<string, unknown>) => {
            const command = String(args.command ?? '')
            if (!command.trim()) return errorResult('No command provided')

            try {
                await Vue.$socket.emitAndWait('printer.gcode.script', { script: command })
                return textResult(`Sent: ${command}`)
            } catch (e) {
                return errorResult(`Failed to send G-code: ${e}`)
            }
        }
    )

    // ── Printer Config ──────────────────────────────────────────────

    mcp.registerTool(
        'get_printer_config',
        'Get printer configuration. Optionally filter by section name (e.g. "extruder", "stepper_x", "printer"). Returns all config if no section specified.',
        {
            type: 'object',
            properties: {
                section: {
                    type: 'string',
                    description: 'Optional config section name to filter (e.g. "extruder", "stepper_x", "printer")',
                },
            },
        },
        (args: Record<string, unknown>) => {
            const printer = store.state.printer ?? {}
            const configfile = printer['configfile'] ?? {}
            const config = configfile.config ?? configfile.settings ?? {}

            const section = args.section ? String(args.section) : null
            if (section) {
                const sectionData = config[section]
                if (!sectionData) {
                    const available = Object.keys(config).slice(0, 50).join(', ')
                    return errorResult(`Section "${section}" not found. Available: ${available}`)
                }
                return jsonResult({ [section]: sectionData })
            }

            // Return section names only (full config can be huge)
            return jsonResult({
                sections: Object.keys(config),
                hint: 'Call with a section name to get details',
            })
        }
    )

    // ── Console History ─────────────────────────────────────────────

    mcp.registerTool(
        'get_console_history',
        'Get recent G-code console output (commands and responses). Useful for debugging.',
        {
            type: 'object',
            properties: {
                count: {
                    type: 'number',
                    description: 'Number of recent entries to return (default: 30)',
                },
            },
        },
        async (args: Record<string, unknown>) => {
            const count = Number(args.count) || 30
            try {
                const result = await Vue.$socket.emitAndWait('server.gcode_store', { count })
                const entries = (result?.gcode_store ?? []) as Array<{
                    message: string
                    time: number
                    type: string
                }>
                const formatted = entries.map((e) => `[${e.type}] ${e.message}`).join('\n')
                return textResult(formatted || 'No console history')
            } catch (e) {
                return errorResult(`Failed to fetch console history: ${e}`)
            }
        }
    )

    // ── List GCode Files ────────────────────────────────────────────

    mcp.registerTool(
        'list_gcode_files',
        'List G-code files available on the printer. Returns filenames, sizes, and modification times.',
        {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Subdirectory path to list (default: root "gcodes")',
                },
            },
        },
        async (args: Record<string, unknown>) => {
            const root = String(args.path ?? 'gcodes')
            try {
                const result = await Vue.$socket.emitAndWait('server.files.list', { root })
                return jsonResult(result)
            } catch (e) {
                return errorResult(`Failed to list files: ${e}`)
            }
        }
    )

    // ── Server Info ─────────────────────────────────────────────────

    mcp.registerTool(
        'get_server_info',
        'Get Moonraker server info including system stats, CPU usage, memory, network, and uptime.',
        { type: 'object', properties: {} },
        () => {
            const server = (store.state.server ?? {}) as Record<string, any>

            return jsonResult({
                moonraker_version: server.moonraker_version ?? 'unknown',
                klippy_state: server.klippy_state ?? 'unknown',
                klippy_connected: server.klippy_connected ?? false,
                components: server.components ?? [],
                failed_components: server.failed_components ?? [],
                websocket_count: server.websocket_count ?? 0,
                moonraker_stats: server.moonraker_stats ?? null,
                system_info: server.system_info ?? null,
                system_cpu_usage: server.system_cpu_usage ?? {},
            })
        }
    )

    // ── Restart Klipper ─────────────────────────────────────────────

    mcp.registerTool(
        'restart_klipper',
        'Restart the Klipper firmware. Use "firmware_restart" for a full firmware restart, or "restart" for a soft restart.',
        {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    description: '"restart" for soft restart (default), "firmware_restart" for full firmware restart',
                },
            },
        },
        async (args: Record<string, unknown>) => {
            const type = String(args.type ?? 'restart')
            const method = type === 'firmware_restart' ? 'printer.firmware_restart' : 'printer.restart'
            try {
                await Vue.$socket.emitAndWait(method, {})
                return textResult(`Klipper ${type} initiated`)
            } catch (e) {
                return errorResult(`Failed to restart: ${e}`)
            }
        }
    )

    // ── Emergency Stop ──────────────────────────────────────────────

    mcp.registerTool(
        'emergency_stop',
        'EMERGENCY STOP the printer immediately. Use only in critical situations. Requires Klipper restart after.',
        { type: 'object', properties: {} },
        async () => {
            try {
                await Vue.$socket.emitAndWait('printer.emergency_stop', {})
                return textResult('EMERGENCY STOP executed. Klipper restart required.')
            } catch (e) {
                return errorResult(`Emergency stop failed: ${e}`)
            }
        }
    )

    // ── Temperature Data ────────────────────────────────────────────

    mcp.registerTool(
        'get_temperature_data',
        'Get current temperature readings from all available heaters and sensors.',
        { type: 'object', properties: {} },
        () => {
            const printer = store.state.printer ?? {}
            const heaters = printer['heaters'] ?? {}
            const sensors: Record<string, unknown> = {}

            const sensorNames = [...(heaters.available_heaters ?? []), ...(heaters.available_sensors ?? [])] as string[]

            for (const name of sensorNames) {
                const obj = printer[name]
                if (obj) {
                    sensors[name] = {
                        temperature: obj.temperature ?? null,
                        target: obj.target ?? null,
                        power: obj.power ?? null,
                    }
                }
            }

            return jsonResult(sensors)
        }
    )

    // ── Get Macros ──────────────────────────────────────────────────

    mcp.registerTool(
        'get_macros',
        'List available G-code macros defined in the printer configuration.',
        { type: 'object', properties: {} },
        () => {
            const printer = store.state.printer ?? {}
            const configfile = printer['configfile'] ?? {}
            const config = configfile.config ?? {}

            const macros = Object.keys(config)
                .filter((key) => key.startsWith('gcode_macro '))
                .map((key) => {
                    const name = key.replace('gcode_macro ', '')
                    const macro = config[key]
                    return {
                        name,
                        description: macro.description ?? '',
                        gcode: macro.gcode ?? '',
                    }
                })

            return jsonResult({ macros, count: macros.length })
        }
    )

    // ── Bed Mesh ────────────────────────────────────────────────────

    mcp.registerTool(
        'get_bed_mesh',
        'Get current bed mesh data including profile name, mesh points, and min/max values.',
        { type: 'object', properties: {} },
        () => {
            const printer = store.state.printer ?? {}
            const bedMesh = printer['bed_mesh'] ?? {}

            if (!bedMesh.profile_name && !bedMesh.probed_matrix) {
                return textResult('No bed mesh data available. Run BED_MESH_CALIBRATE first.')
            }

            return jsonResult({
                profile_name: bedMesh.profile_name ?? '',
                mesh_min: bedMesh.mesh_min ?? [],
                mesh_max: bedMesh.mesh_max ?? [],
                probed_matrix: bedMesh.probed_matrix ?? [],
                mesh_matrix: bedMesh.mesh_matrix ?? [],
                profiles: bedMesh.profiles ?? {},
            })
        }
    )

    // ── Connection Status ───────────────────────────────────────────

    mcp.registerTool(
        'get_connection_status',
        'Get Mainsail WebSocket connection status to Moonraker. Useful for debugging connectivity.',
        { type: 'object', properties: {} },
        () => {
            const socket = (store.state.socket ?? {}) as Record<string, any>

            return jsonResult({
                isConnected: socket.isConnected ?? false,
                isConnecting: socket.isConnecting ?? false,
                connectingFailed: socket.connectingFailed ?? false,
                hostname: socket.hostname ?? 'unknown',
                port: socket.port ?? 0,
                path: socket.path ?? '',
                protocol: socket.protocol ?? 'ws',
                loadings: socket.loadings ?? [],
            })
        }
    )
}

function registerResources(mcp: WebMCPInstance, store: Store<RootState>) {
    mcp.registerResource(
        'printer_status',
        'Live printer status snapshot including all temperatures, position, and print state',
        { uri: 'printer://status', mimeType: 'application/json' },
        () => {
            const printer = store.state.printer ?? {}
            const toolhead = printer['toolhead'] ?? {}
            const print_stats = printer['print_stats'] ?? {}
            const heater_bed = printer['heater_bed'] ?? {}
            const extruder = printer['extruder'] ?? {}

            return {
                contents: [
                    {
                        uri: 'printer://status',
                        text: JSON.stringify(
                            {
                                state: print_stats.state ?? 'unknown',
                                position: toolhead.position ?? [],
                                extruder_temp: extruder.temperature ?? 0,
                                bed_temp: heater_bed.temperature ?? 0,
                            },
                            null,
                            2
                        ),
                        mimeType: 'application/json',
                    },
                ],
            }
        }
    )

    mcp.registerResource(
        'printer_config',
        'Full printer configuration from Klipper configfile',
        { uri: 'printer://config', mimeType: 'application/json' },
        () => {
            const printer = store.state.printer ?? {}
            const configfile = printer['configfile'] ?? {}

            return {
                contents: [
                    {
                        uri: 'printer://config',
                        text: JSON.stringify(configfile.config ?? {}, null, 2),
                        mimeType: 'application/json',
                    },
                ],
            }
        }
    )
}

export async function initWebMCP(store: Store<RootState>): Promise<void> {
    try {
        await loadScript(WEBMCP_CDN)
    } catch (e) {
        window.console.warn('[WebMCP] Failed to load webmcp.js:', e)
        window.console.warn('[WebMCP] Agent integration will not be available.')
        return
    }

    if (!window.WebMCP) {
        window.console.warn('[WebMCP] WebMCP class not found after loading script')
        return
    }

    const mcp = new window.WebMCP({
        color: '#D51F26', // Mainsail red
        position: 'bottom-right',
        size: '30px',
        padding: '15px',
    })

    window.__webmcp = mcp

    registerTools(mcp, store)
    registerResources(mcp, store)

    window.console.info('[WebMCP] StitchLab OS tools registered. Connect an AI agent to interact with the printer.')
}
