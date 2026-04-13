/**
 * Lightweight G-Code parser for embroidery preview.
 *
 * Extracts geometry lines, stitch points, and color changes from embroidery G-Code
 * using the same GCodeToGeometry parser that GCode Studio 2D uses, but without
 * Paper.js dependency.
 */

declare global {
    interface Window {
        GCodeToGeometry?: GCodeToGeometryApi
    }
}

interface GCodeToGeometryApi {
    parse(gcode: string): GCodeGeometryResult
}

interface GCodeGeometryPoint {
    x: number
    y: number
    z?: number
}

interface GCodeGeometryLine {
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
const DEFAULT_FEEDRATE = 1200

function normalizeLineEndings(gcode: string): string {
    return gcode
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\uFEFF/g, '')
}

function normalizeGcode(gcode: string): string {
    return gcode.replace(/(-?\d+),(\d+)/g, '$1.$2')
}

function appendFeedrate(line: string, feedrate: number): string {
    const semicolonIndex = line.indexOf(';')
    const parenIndex = line.indexOf('(')
    let insertIndex = -1

    if (semicolonIndex >= 0) insertIndex = semicolonIndex
    if (parenIndex >= 0) insertIndex = insertIndex === -1 ? parenIndex : Math.min(insertIndex, parenIndex)

    if (insertIndex >= 0) {
        return line.slice(0, insertIndex).trimEnd() + ` F${feedrate} ` + line.slice(insertIndex)
    }
    return line.trimEnd() + ` F${feedrate}`
}

export function parseEmbroideryGcode(gcode: string, stitchColor?: string): ParsedEmbroidery | null {
    if (!window.GCodeToGeometry) {
        window.console.error('GCodeToGeometry not available')
        return null
    }

    const defaultColor = stitchColor ?? DEFAULT_STITCH_COLOR
    const rawGcode = normalizeLineEndings(gcode)
    const normalizedGcode = normalizeGcode(rawGcode)
    const rawLines = rawGcode.split('\n')
    const lines = normalizedGcode.split('\n')
    const headerMatch = rawGcode.match(/\(STITCH_COUNT:(\d+)\)/i)
    const headerStitchCount = headerMatch ? parseInt(headerMatch[1]) : null
    let stitchCountFromMoves = 0
    let jumpCount = 0

    const processedLines: string[] = []
    const moveOffsets: number[] = []
    const moveColors: string[] = []
    const colorChangeIndices: number[] = []
    let currentColor = defaultColor
    let offset = 0
    const feedratePattern = /\bF[-+]?\d*\.?\d+/i
    let g0Count = 0
    let g1Count = 0
    const stitchPointMoveIndices: number[] = []

    lines.forEach((line, index) => {
        const rawLine = rawLines[index] ?? line
        offset += rawLine.length + 1
        const trimmed = line.trim()
        const rawTrimmed = rawLine.trim()

        const colorMatch = rawTrimmed.match(/;\s*color\s+r:(\d+)\s+g:(\d+)\s+b:(\d+)/i)
        if (colorMatch) {
            const r = parseInt(colorMatch[1])
            const g = parseInt(colorMatch[2])
            const b = parseInt(colorMatch[3])
            currentColor = `#${r.toString(16).padStart(2, '0')}${g
                .toString(16)
                .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
            colorChangeIndices.push(moveColors.length)
            return
        }

        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('(')) {
            return
        }

        const moveMatch = trimmed.match(/G0*([0-3])(?=[^0-9]|$)/i)
        const hasXY = /[XY]/i.test(trimmed)
        const hasZ = /\bZ[\d.-]+/i.test(trimmed)
        const isZOnly = !!(moveMatch && hasZ && !hasXY)

        if (isZOnly) {
            if (headerStitchCount === null) {
                stitchCountFromMoves += 1
            }
            if (moveColors.length > 0) {
                stitchPointMoveIndices.push(moveColors.length - 1)
            }
            return
        }

        if (moveMatch && hasXY) {
            const code = moveMatch[1]
            moveOffsets.push(offset)
            if (code === '0') {
                jumpCount += 1
                g0Count += 1
            } else if (headerStitchCount === null) {
                stitchCountFromMoves += 1
                g1Count += 1
            }
            moveColors.push(currentColor)
            let processedLine = hasZ ? line.replace(/\s+Z[\d.-]+/gi, '') : line
            if (code === '1' && !feedratePattern.test(processedLine)) {
                processedLine = appendFeedrate(processedLine, DEFAULT_FEEDRATE)
            }
            processedLines.push(processedLine)
            if (hasZ) {
                stitchPointMoveIndices.push(moveColors.length - 1)
            }
            return
        }

        processedLines.push(line)
    })

    const processedGcode = processedLines.filter((line) => line !== '').join('\n')
    let geometry: GCodeGeometryResult
    try {
        geometry = window.GCodeToGeometry.parse(processedGcode)
    } catch (error) {
        window.console.error('Failed to parse G-code', error)
        return null
    }

    if (!geometry || !geometry.lines.length) {
        return null
    }

    const unitScale = geometry.displayInInch === false ? 25.4 : 1
    const scalePoint = (point: GCodeGeometryPoint): GCodeGeometryPoint => ({
        x: point.x * unitScale,
        y: point.y * unitScale,
        z: point.z !== undefined ? point.z * unitScale : undefined,
    })

    const scaledLines = geometry.lines.map((line) => ({
        type: line.type,
        start: scalePoint(line.start),
        end: scalePoint(line.end),
        beziers: line.beziers
            ? line.beziers.map((bezier) => ({
                  p0: scalePoint(bezier.p0),
                  p1: scalePoint(bezier.p1),
                  p2: scalePoint(bezier.p2),
                  p3: scalePoint(bezier.p3),
              }))
            : undefined,
    }))

    const renderLines: RenderLine[] = scaledLines.map((line, index) => ({
        line,
        color: moveColors[index] ?? defaultColor,
        moveIndex: index,
    }))

    const size = {
        min: scalePoint(geometry.size.min),
        max: scalePoint(geometry.size.max),
    }
    const designWidth = Math.abs(size.max.x - size.min.x)
    const designHeight = Math.abs(size.max.y - size.min.y)
    const designCenter = {
        x: (size.max.x + size.min.x) / 2,
        y: (size.max.y + size.min.y) / 2,
    }
    const treatG0AsStitch = g1Count === 0 && g0Count > 0
    const normalizedJumpCount = treatG0AsStitch ? 0 : jumpCount
    const stitchCount = headerStitchCount ?? (treatG0AsStitch ? g0Count : stitchCountFromMoves)

    return {
        renderLines,
        moveOffsets,
        stitchCount,
        jumpCount: normalizedJumpCount,
        designWidth,
        designHeight,
        designCenter,
        treatG0AsStitch,
        stitchPointMoveIndices,
        colorChangeIndices,
        hasColorChanges: colorChangeIndices.length > 0,
    }
}
