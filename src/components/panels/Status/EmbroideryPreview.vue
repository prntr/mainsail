<template>
    <div v-if="currentFilename" class="embroidery-preview">
        <div ref="canvasWrapper" class="embroidery-preview__canvas-wrapper">
            <canvas ref="canvas" class="embroidery-preview__canvas" />
            <div v-if="loading" class="embroidery-preview__loading">
                <v-progress-circular indeterminate color="primary" size="32" />
            </div>
            <div v-if="parsed && !loading" class="embroidery-preview__overlay">
                <span class="embroidery-preview__filename text--disabled">
                    <v-icon small class="mr-1">{{ mdiFileOutline }}</v-icon>
                    {{ currentFilename }}
                </span>
                <span class="embroidery-preview__stats text--disabled">
                    {{ $t('EmbroideryPreview.Stitch') }} {{ currentStitchIndex }} / {{ stitchCount }}
                    &middot; {{ progressPercent }}%
                </span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins, Ref, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { parseEmbroideryGcode, ParsedEmbroidery, RenderLine } from '@/lib/embroideryPreview/parseEmbroideryGcode'
import gcodeToGeometryUrl from '@/lib/gcode2dviewer/gcodetogeometry.min.js?url'
import { mdiFileOutline } from '@mdi/js'
import { escapePath } from '@/plugins/helpers'

@Component({})
export default class EmbroideryPreview extends Mixins(BaseMixin) {
    mdiFileOutline = mdiFileOutline

    @Ref() readonly canvas!: HTMLCanvasElement
    @Ref() readonly canvasWrapper!: HTMLDivElement

    parsed: ParsedEmbroidery | null = null
    loading = false
    parserReady = false
    loadedFilename = ''
    cachedGcode = ''
    resizeObserver: ResizeObserver | null = null
    renderThrottleId: number | null = null

    get currentFilename(): string {
        return this.$store.state.printer.print_stats?.filename ?? ''
    }

    get isPrinting(): boolean {
        return ['printing', 'paused'].includes(this.printer_state)
    }

    get filePosition(): number {
        return this.$store.state.printer.virtual_sdcard?.file_position ?? 0
    }

    get toolheadPosition(): number[] {
        return this.$store.state.printer.toolhead?.position ?? [0, 0, 0, 0]
    }

    get frameWidth(): number {
        return this.$store.state.gui.gcodeStudio?.frameWidth ?? 100
    }

    get frameHeight(): number {
        return this.$store.state.gui.gcodeStudio?.frameHeight ?? 100
    }

    get designOffsetX(): number {
        return this.$store.state.gui.gcodeStudio?.designOffsetX ?? 0
    }

    get designOffsetY(): number {
        return this.$store.state.gui.gcodeStudio?.designOffsetY ?? 0
    }

    get frameColor(): string {
        return this.$store.state.gui.gcodeStudio?.frameColor ?? '#8caaee'
    }

    get stitchColors(): string[] {
        return this.$store.state.gui.gcodeStudio?.stitchColors ?? ['#E76F51']
    }

    get showFrameBorder(): boolean {
        return this.$store.state.gui.gcodeStudio?.showFrameBorder ?? true
    }

    get stitchCount(): number {
        return this.parsed?.stitchCount ?? 0
    }

    get currentStitchIndex(): number {
        if (!this.parsed || !this.isPrinting) return 0
        const moveIndex = this.filePositionToMoveIndex(this.filePosition)
        // Count stitches up to current move
        let count = 0
        for (const idx of this.parsed.stitchPointMoveIndices) {
            if (idx <= moveIndex) count++
            else break
        }
        return count
    }

    get progressPercent(): number {
        if (!this.stitchCount) return 0
        return Math.min(100, Math.round((this.currentStitchIndex / this.stitchCount) * 100))
    }

    @Watch('currentFilename')
    async onFilenameChanged(newVal: string): Promise<void> {
        if (newVal && newVal !== this.loadedFilename) {
            await this.loadAndParse(newVal)
        } else if (!newVal) {
            this.parsed = null
            this.loadedFilename = ''
            this.cachedGcode = ''
            this.clearCanvas()
            this.$store.commit('printer/setData', { embroidery_stats: null })
        }
    }

    @Watch('filePosition')
    onFilePositionChanged(): void {
        this.throttledRender()
    }

    @Watch('toolheadPosition')
    onToolheadPositionChanged(): void {
        this.throttledRender()
    }

    @Watch('stitchColors')
    onStitchColorsChanged(): void {
        if (this.cachedGcode && this.parsed) {
            const stitchColor = this.stitchColors[0] ?? '#E76F51'
            this.parsed = parseEmbroideryGcode(this.cachedGcode, stitchColor)
            this.drawCanvas()
        }
    }

    async mounted(): Promise<void> {
        await this.ensureParser()

        if (this.currentFilename) {
            await this.loadAndParse(this.currentFilename)
        }

        this.resizeObserver = new ResizeObserver(() => {
            this.resizeCanvas()
            this.drawCanvas()
        })
        if (this.canvasWrapper) {
            this.resizeObserver.observe(this.canvasWrapper)
        }
    }

    beforeDestroy(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect()
            this.resizeObserver = null
        }
        if (this.renderThrottleId !== null) {
            cancelAnimationFrame(this.renderThrottleId)
            this.renderThrottleId = null
        }
    }

    async ensureParser(): Promise<void> {
        if (this.parserReady || (window as any).GCodeToGeometry) {
            this.parserReady = true
            return
        }

        return new Promise((resolve) => {
            const script = document.createElement('script')
            script.src = gcodeToGeometryUrl
            script.onload = () => {
                this.parserReady = true
                resolve()
            }
            script.onerror = () => {
                window.console.error('Failed to load GCodeToGeometry parser')
                resolve()
            }
            document.head.appendChild(script)
        })
    }

    async loadAndParse(filename: string): Promise<void> {
        this.loading = true
        try {
            const url = `${this.apiUrl}/server/files/gcodes/${escapePath(filename)}`
            const response = await fetch(url)
            if (!response.ok) {
                window.console.error(`Failed to fetch G-Code file: ${response.status}`)
                this.parsed = null
                return
            }
            const gcode = await response.text()
            this.cachedGcode = gcode
            const stitchColor = this.stitchColors[0] ?? '#E76F51'
            this.parsed = parseEmbroideryGcode(gcode, stitchColor)
            this.loadedFilename = filename

            // Share parsed stats with other components via the store
            this.$store.commit('printer/setData', {
                embroidery_stats: {
                    stitchCount: this.parsed.stitchCount,
                    jumpCount: this.parsed.jumpCount,
                    designWidth: this.parsed.designWidth,
                    designHeight: this.parsed.designHeight,
                    hasColorChanges: this.parsed.hasColorChanges,
                    stitchPointMoveIndices: this.parsed.stitchPointMoveIndices,
                    moveOffsets: this.parsed.moveOffsets,
                },
            })

            this.$nextTick(() => {
                this.resizeCanvas()
                this.drawCanvas()
            })
        } catch (error) {
            window.console.error('EmbroideryPreview: failed to load G-Code', error)
            this.parsed = null
        } finally {
            this.loading = false
        }
    }

    resizeCanvas(): void {
        if (!this.canvas || !this.canvasWrapper) return
        const dpr = window.devicePixelRatio || 1
        const rect = this.canvasWrapper.getBoundingClientRect()
        this.canvas.width = rect.width * dpr
        this.canvas.height = rect.height * dpr
        this.canvas.style.width = rect.width + 'px'
        this.canvas.style.height = rect.height + 'px'
    }

    clearCanvas(): void {
        if (!this.canvas) return
        const ctx = this.canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }

    throttledRender(): void {
        if (this.renderThrottleId !== null) return
        this.renderThrottleId = requestAnimationFrame(() => {
            this.renderThrottleId = null
            this.drawCanvas()
        })
    }

    drawCanvas(): void {
        if (!this.canvas || !this.parsed) return
        const ctx = this.canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const w = this.canvas.width
        const h = this.canvas.height

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w / dpr, h / dpr)

        const canvasW = w / dpr
        const canvasH = h / dpr
        const padding = 16
        const fw = this.frameWidth
        const fh = this.frameHeight

        // Compute bounding box that fits both the frame and the design
        const dc = this.parsed.designCenter
        const dw = this.parsed.designWidth
        const dh = this.parsed.designHeight
        const ox = this.designOffsetX
        const oy = this.designOffsetY

        // Frame spans (0,0)–(fw,fh); design bounds in the same coord space
        const viewMinX = Math.min(0, dc.x + ox - dw / 2)
        const viewMaxX = Math.max(fw, dc.x + ox + dw / 2)
        const viewMinY = Math.min(0, dc.y + oy - dh / 2)
        const viewMaxY = Math.max(fh, dc.y + oy + dh / 2)
        const viewW = viewMaxX - viewMinX
        const viewH = viewMaxY - viewMinY

        // Scale to fit the combined view
        const scaleX = (canvasW - padding * 2) / viewW
        const scaleY = (canvasH - padding * 2) / viewH
        const scale = Math.min(scaleX, scaleY)

        // View center in design coordinates
        const vcx = (viewMinX + viewMaxX) / 2
        const vcy = (viewMinY + viewMaxY) / 2

        const cx = canvasW / 2
        const cy = canvasH / 2

        // Draw frame border
        if (this.showFrameBorder) {
            const frameLeft = cx + (0 - vcx) * scale
            const frameTop = cy - (fh - vcy) * scale
            ctx.strokeStyle = this.frameColor
            ctx.lineWidth = 1.5
            ctx.setLineDash([6, 4])
            ctx.strokeRect(frameLeft, frameTop, fw * scale, fh * scale)
            ctx.setLineDash([])
        }

        const { renderLines, treatG0AsStitch } = this.parsed
        const currentMoveIndex = this.isPrinting ? this.filePositionToMoveIndex(this.filePosition) : renderLines.length

        // Draw stitch paths
        this.drawStitchPaths(ctx, renderLines, treatG0AsStitch, currentMoveIndex, vcx, vcy, scale, cx, cy, false)
        if (this.isPrinting && currentMoveIndex < renderLines.length) {
            this.drawStitchPaths(ctx, renderLines, treatG0AsStitch, renderLines.length, vcx, vcy, scale, cx, cy, true)
        }

        // Draw needle position when printing
        if (this.isPrinting) {
            this.drawNeedle(ctx, vcx, vcy, scale, cx, cy)
        }
    }

    drawStitchPaths(
        ctx: CanvasRenderingContext2D,
        renderLines: RenderLine[],
        treatG0AsStitch: boolean,
        upToIndex: number,
        vcx: number, vcy: number,
        scale: number,
        cx: number, cy: number,
        faded: boolean
    ): void {
        const startIndex = faded ? this.filePositionToMoveIndex(this.filePosition) + 1 : 0
        const endIndex = faded ? renderLines.length : Math.min(upToIndex + 1, renderLines.length)

        let currentColor = ''
        let currentFaded = faded

        for (let i = startIndex; i < endIndex; i++) {
            const rl = renderLines[i]
            const isTravel = rl.line.type === 'G0' && !treatG0AsStitch

            if (isTravel) continue // skip jumps in preview

            const color = rl.color
            if (color !== currentColor || currentFaded !== faded) {
                currentColor = color
                currentFaded = faded
            }

            ctx.strokeStyle = faded ? this.fadeColor(color, 0.2) : color
            ctx.lineWidth = faded ? 0.8 : 1.5
            ctx.beginPath()

            const from = this.toCanvas(rl.line.start, vcx, vcy, scale, cx, cy)
            const to = this.toCanvas(rl.line.end, vcx, vcy, scale, cx, cy)

            if (rl.line.beziers && rl.line.beziers.length > 0) {
                ctx.moveTo(from.x, from.y)
                for (const b of rl.line.beziers) {
                    const p1 = this.toCanvas(b.p1, vcx, vcy, scale, cx, cy)
                    const p2 = this.toCanvas(b.p2, vcx, vcy, scale, cx, cy)
                    const p3 = this.toCanvas(b.p3, vcx, vcy, scale, cx, cy)
                    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
                }
            } else {
                ctx.moveTo(from.x, from.y)
                ctx.lineTo(to.x, to.y)
            }
            ctx.stroke()
        }
    }

    drawNeedle(
        ctx: CanvasRenderingContext2D,
        vcx: number, vcy: number,
        scale: number,
        cx: number, cy: number
    ): void {
        const x = this.toolheadPosition[0] ?? 0
        const y = this.toolheadPosition[1] ?? 0
        const pos = this.toCanvas({ x, y }, vcx, vcy, scale, cx, cy)

        const r = 4
        // Outer circle
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, r + 1, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.fill()

        // Inner dot
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()

        // Crosshair lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(pos.x - r * 2.5, pos.y)
        ctx.lineTo(pos.x - r - 1, pos.y)
        ctx.moveTo(pos.x + r + 1, pos.y)
        ctx.lineTo(pos.x + r * 2.5, pos.y)
        ctx.moveTo(pos.x, pos.y - r * 2.5)
        ctx.lineTo(pos.x, pos.y - r - 1)
        ctx.moveTo(pos.x, pos.y + r + 1)
        ctx.lineTo(pos.x, pos.y + r * 2.5)
        ctx.stroke()
    }

    toCanvas(
        pt: { x: number; y: number },
        vcx: number, vcy: number,
        scale: number,
        cx: number, cy: number
    ): { x: number; y: number } {
        // Map design coordinates to canvas, centered on the combined view center
        const x = pt.x + this.designOffsetX
        const y = pt.y + this.designOffsetY
        return {
            x: cx + (x - vcx) * scale,
            y: cy - (y - vcy) * scale, // Y inverted
        }
    }

    filePositionToMoveIndex(filePosition: number): number {
        if (!this.parsed) return 0
        const offsets = this.parsed.moveOffsets
        if (!offsets.length) return 0

        // Binary search
        let lo = 0
        let hi = offsets.length - 1
        while (lo <= hi) {
            const mid = (lo + hi) >>> 1
            if (offsets[mid] <= filePosition) {
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        return Math.max(0, hi)
    }

    fadeColor(hex: string, alpha: number): string {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
}
</script>

<style lang="scss" scoped>
.embroidery-preview {
    position: relative;
    width: 100%;

    &__canvas-wrapper {
        position: relative;
        width: 100%;
        height: 200px;
        background-color: var(--v-card-base, #1e1e2e);
    }

    &__canvas {
        display: block;
        width: 100%;
        height: 100%;
    }

    &__loading {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    &__overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
        pointer-events: none;
    }

    &__filename {
        font-size: 0.75rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 60%;
    }

    &__stats {
        font-size: 0.75rem;
        white-space: nowrap;
    }
}
</style>
