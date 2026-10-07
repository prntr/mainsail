/**
 * Embroidery G-code to preview geometry, for G-Code Studio.
 *
 * Moves go through GCodeToGeometry (public/lib/gcode2dviewer), which only
 * understands G and M words; a macro line such as COLOR_CHANGE makes it throw.
 * So this reads every line first and hands the parser only XY moves and the
 * modal codes that change how it reads them. Everything else is read here.
 *
 * Stitch model (the beta6 G-code contract): one Z step is one stitch, the
 * needle going through the fabric once. XY moves only place the hoop; a G0
 * move is a jump unless the file has no G1 moves at all (Ink/Stitch writes
 * only G0, with Z-only lines for the stitches).
 */

declare global {
    interface Window {
        GCodeToGeometry?: GCodeToGeometryApi
    }
}

interface GCodeToGeometryApi {
    parse(gcode: string): GCodeGeometryResult
}

export interface GCodeGeometryPoint {
    x: number
    y: number
    z?: number
}

export interface GCodeGeometryLine {
    type: string
    start: GCodeGeometryPoint
    end: GCodeGeometryPoint
    beziers?: {
        p0: GCodeGeometryPoint
        p1: GCodeGeometryPoint
        p2: GCodeGeometryPoint
        p3: GCodeGeometryPoint
    }[]
}

interface GCodeGeometryResult {
    lines: GCodeGeometryLine[]
    size: {
        min: GCodeGeometryPoint
        max: GCodeGeometryPoint
    }
    displayInInch: boolean
}

export interface RenderLine {
    line: GCodeGeometryLine
    color: string
    moveIndex: number
}

export interface ParsedEmbroidery {
    renderLines: RenderLine[]
    moveOffsets: number[]
    stitchCount: number
    jumpCount: number
    designWidth: number
    designHeight: number
    designCenter: GCodeGeometryPoint
    treatG0AsStitch: boolean
    stitchPointMoveIndices: number[]
    colorChangeIndices: number[]
    hasColorChanges: boolean
}

const DEFAULT_STITCH_COLOR = '#E76F51'
// GCodeToGeometry skips a G1 move whose feed rate is zero, and the files
// rarely set one.
const DEFAULT_FEEDRATE = 1200

// First command of a line, after an optional line number: G1, M600,
// COLOR_CHANGE, NEEDLE_TOGGLE ...
const COMMAND_WORD = /^(?:N\d+\s*)?([GM]\d+(?:\.\d+)?|[A-Z_][A-Z0-9_]*)/i
const MOVE_COMMAND = /^G0*([0-3])$/i
// Ink/Stitch writes M00, Klipper users M0 or M600; TurtleStitch writes COLOR_CHANGE.
const COLOR_CHANGE_COMMAND = /^(COLOR_CHANGE|M0*0|M0*600)$/i
// Plane, units and absolute/relative: they change how later moves read.
const MODAL_COMMAND = /^G0*(17|18|19|20|21|90|91)$/i
const XY_WORD = /[XY]\s*[-+]?[\d.]/i
const Z_WORD = /Z\s*[-+]?[\d.]/i
const Z_WORDS = /\s*Z\s*[-+]?[\d.]+/gi
const FEEDRATE_WORD = /F\s*[-+]?[\d.]/i
const COLOR_COMMENT = /;\s*color\s+r:(\d+)\s+g:(\d+)\s+b:(\d+)/i
const STITCH_COUNT_HEADER = /\(STITCH_COUNT:(\d+)\)/i

function normalizeLineEndings(gcode: string): string {
    return gcode
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\uFEFF/g, '')
}

function normalizeDecimalCommas(gcode: string): string {
    return gcode.replace(/(-?\d+),(\d+)/g, '$1.$2')
}

function withoutComment(line: string): string {
    return line.split(';')[0].split('(')[0].trim()
}

function hexColor(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')
}

export function parseEmbroideryGcode(gcode: string, stitchColor?: string): ParsedEmbroidery | null {
    if (!window.GCodeToGeometry) {
        window.console.error('GCodeToGeometry not available')
        return null
    }

    const defaultColor = stitchColor ?? DEFAULT_STITCH_COLOR
    const rawGcode = normalizeLineEndings(gcode)
    const rawLines = rawGcode.split('\n')
    const lines = normalizeDecimalCommas(rawGcode).split('\n')
    const headerMatch = rawGcode.match(STITCH_COUNT_HEADER)
    const headerStitchCount = headerMatch ? parseInt(headerMatch[1]) : null

    const geometryInput: string[] = []
    const moveOffsets: number[] = []
    const moveColors: string[] = []
    const colorChangeIndices: number[] = []
    const stitchPointMoveIndices: number[] = []
    let currentColor = defaultColor
    let offset = 0
    let zSteps = 0
    let g0Count = 0
    let g1Count = 0

    // A '; color' comment and the COLOR_CHANGE after it are one change.
    const markColorChange = () => {
        if (colorChangeIndices[colorChangeIndices.length - 1] !== moveColors.length) {
            colorChangeIndices.push(moveColors.length)
        }
    }

    lines.forEach((line, index) => {
        const rawLine = rawLines[index] ?? line
        offset += rawLine.length + 1

        const colorMatch = rawLine.match(COLOR_COMMENT)
        if (colorMatch) {
            currentColor = hexColor(parseInt(colorMatch[1]), parseInt(colorMatch[2]), parseInt(colorMatch[3]))
            markColorChange()
            return
        }

        const code = withoutComment(line)
        const command = code.match(COMMAND_WORD)?.[1] ?? ''
        if (COLOR_CHANGE_COMMAND.test(command)) {
            markColorChange()
            return
        }
        if (MODAL_COMMAND.test(command)) {
            geometryInput.push(code)
            return
        }

        const move = command.match(MOVE_COMMAND)
        if (!move) return

        const hasXY = XY_WORD.test(code)
        const hasZ = Z_WORD.test(code)
        if (hasZ && !hasXY) {
            zSteps += 1
            if (moveColors.length > 0) stitchPointMoveIndices.push(moveColors.length - 1)
            return
        }
        if (!hasXY) return

        const isJump = move[1] === '0'
        if (isJump) g0Count += 1
        else g1Count += 1
        moveOffsets.push(offset)
        moveColors.push(currentColor)
        if (hasZ) stitchPointMoveIndices.push(moveColors.length - 1)

        const xyOnly = code.replace(Z_WORDS, '')
        geometryInput.push(isJump || FEEDRATE_WORD.test(xyOnly) ? xyOnly : `${xyOnly} F${DEFAULT_FEEDRATE}`)
    })

    let geometry: GCodeGeometryResult
    try {
        geometry = window.GCodeToGeometry.parse(geometryInput.join('\n'))
    } catch (error) {
        window.console.error('Failed to parse G-code', error)
        return null
    }

    if (!geometry || !geometry.lines.length) {
        return null
    }

    if (geometry.lines.length !== moveColors.length) {
        window.console.warn('G-code parse mismatch: move count does not match geometry output')
    }

    const unitScale = geometry.displayInInch === false ? 25.4 : 1
    const scalePoint = (point: GCodeGeometryPoint): GCodeGeometryPoint => ({
        x: point.x * unitScale,
        y: point.y * unitScale,
        z: point.z !== undefined ? point.z * unitScale : undefined,
    })

    const renderLines: RenderLine[] = geometry.lines.map((line, index) => ({
        line: {
            type: line.type,
            start: scalePoint(line.start),
            end: scalePoint(line.end),
            beziers: line.beziers?.map((bezier) => ({
                p0: scalePoint(bezier.p0),
                p1: scalePoint(bezier.p1),
                p2: scalePoint(bezier.p2),
                p3: scalePoint(bezier.p3),
            })),
        },
        color: moveColors[index] ?? defaultColor,
        moveIndex: index,
    }))

    const min = scalePoint(geometry.size.min)
    const max = scalePoint(geometry.size.max)
    const treatG0AsStitch = g1Count === 0 && g0Count > 0

    return {
        renderLines,
        moveOffsets,
        stitchCount: headerStitchCount ?? zSteps,
        jumpCount: treatG0AsStitch ? 0 : g0Count,
        designWidth: Math.abs(max.x - min.x),
        designHeight: Math.abs(max.y - min.y),
        designCenter: { x: (max.x + min.x) / 2, y: (max.y + min.y) / 2 },
        treatG0AsStitch,
        stitchPointMoveIndices,
        colorChangeIndices,
        hasColorChanges: colorChangeIndices.length > 0,
    }
}
