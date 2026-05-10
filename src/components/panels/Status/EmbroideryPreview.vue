<template>
    <div v-if="currentFilename" class="embroidery-preview">
        <div ref="canvasWrapper" class="embroidery-preview__canvas-wrapper">
            <canvas ref="canvas" class="embroidery-preview__canvas" />
            <div v-if="loading" class="embroidery-preview__loading">
                <v-progress-circular indeterminate color="primary" size="32" />
            </div>
            <div v-if="!loading" class="embroidery-preview__overlay">
                <span class="embroidery-preview__filename text--disabled">
                    <v-icon small class="mr-1">{{ mdiFileOutline }}</v-icon>
                    {{ currentFilename }}
                </span>
                <span class="embroidery-preview__stats text--disabled">{{ progressPercent }}%</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
/*
 * EmbroideryPreview — stable job-preview renderer.
 *
 * Per P0-4 of the Cross-Platform Mainsail Stability plan, this component
 * MUST NOT fetch the full active G-Code file or parse stitch paths on
 * the browser main thread. It only renders:
 *
 *   - the selected hoop / usable area outline,
 *   - a finished-design thumbnail (current_file.thumbnails[*]) when
 *     Moonraker exposes one, positioned at the configured design
 *     placement offset,
 *   - a lightweight filename / progress overlay.
 *
 * When no thumbnail is available the canvas falls back to a
 * placeholder (hoop outline only). Future intake metadata can replace
 * the thumbnail source without changing this component's contract.
 */
import Component from 'vue-class-component'
import { Mixins, Ref, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { mdiFileOutline } from '@mdi/js'
import { escapePath } from '@/plugins/helpers'
import { getStitchlabGcodeStudioPalette } from '@/store/variables'

const THUMB_MIN_WIDTH = 200

@Component({})
export default class EmbroideryPreview extends Mixins(BaseMixin) {
    mdiFileOutline = mdiFileOutline

    @Ref() readonly canvas!: HTMLCanvasElement
    @Ref() readonly canvasWrapper!: HTMLDivElement

    loading = false
    thumbImage: HTMLImageElement | null = null
    thumbUrl = ''
    resizeObserver: ResizeObserver | null = null

    get currentFilename(): string {
        return this.$store.state.printer.print_stats?.filename ?? ''
    }

    get currentFile() {
        return this.$store.state.printer.current_file ?? {}
    }

    get printProgress(): number {
        return this.$store.state.printer.virtual_sdcard?.progress ?? 0
    }

    get progressPercent(): number {
        return Math.min(100, Math.round(this.printProgress * 100))
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

    get isStitchlabTheme(): boolean {
        return (this.$store.state.gui.uiSettings?.theme ?? '') === 'stitchlab'
    }

    get themeMode(): 'dark' | 'light' {
        return this.$vuetify.theme.dark ? 'dark' : 'light'
    }

    get stitchlabPalette() {
        return getStitchlabGcodeStudioPalette(this.themeMode)
    }

    get frameColor(): string {
        if (this.isStitchlabTheme) return this.stitchlabPalette.frameColor
        return this.$store.state.gui.gcodeStudio?.frameColor ?? '#8caaee'
    }

    get showFrameBorder(): boolean {
        return this.$store.state.gui.gcodeStudio?.showFrameBorder ?? true
    }

    get computedThumbUrl(): string {
        const cf: any = this.currentFile
        if (!cf || !Array.isArray(cf.thumbnails) || cf.thumbnails.length === 0) return ''
        const thumb =
            cf.thumbnails.find((t: any) => t.width >= THUMB_MIN_WIDTH) ?? cf.thumbnails[cf.thumbnails.length - 1]
        if (!thumb || !thumb.relative_path) return ''
        let prefix = ''
        const fname: string = cf.filename ?? ''
        const slash = fname.lastIndexOf('/')
        if (slash !== -1) prefix = fname.substr(0, slash + 1)
        return `${this.apiUrl}/server/files/gcodes/${escapePath(prefix + thumb.relative_path)}?timestamp=${
            cf.modified ?? 0
        }`
    }

    @Watch('currentFilename')
    onFilenameChanged(newVal: string): void {
        if (!newVal) {
            this.thumbImage = null
            this.thumbUrl = ''
            this.clearCanvas()
        } else {
            this.loadThumbnail()
        }
    }

    @Watch('computedThumbUrl')
    onThumbUrlChanged(): void {
        this.loadThumbnail()
    }

    mounted(): void {
        this.loadThumbnail()
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
    }

    loadThumbnail(): void {
        const url = this.computedThumbUrl
        if (!url) {
            this.thumbImage = null
            this.thumbUrl = ''
            this.$nextTick(() => {
                this.resizeCanvas()
                this.drawCanvas()
            })
            return
        }
        if (url === this.thumbUrl && this.thumbImage) return

        this.loading = true
        this.thumbUrl = url
        const img = new Image()
        img.onload = () => {
            this.thumbImage = img
            this.loading = false
            this.$nextTick(() => {
                this.resizeCanvas()
                this.drawCanvas()
            })
        }
        img.onerror = () => {
            this.thumbImage = null
            this.loading = false
            this.drawCanvas()
        }
        img.src = url
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

    drawCanvas(): void {
        if (!this.canvas) return
        const ctx = this.canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const w = this.canvas.width / dpr
        const h = this.canvas.height / dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)

        const padding = 16
        const fw = this.frameWidth
        const fh = this.frameHeight
        if (fw <= 0 || fh <= 0) return

        const scale = Math.min((w - padding * 2) / fw, (h - padding * 2) / fh)
        const frameLeft = (w - fw * scale) / 2
        const frameTop = (h - fh * scale) / 2

        if (this.thumbImage) {
            // Without intake metadata for physical design dimensions the
            // thumbnail is drawn to fit inside the hoop (90% of the
            // shorter axis) centred on the configured placement offset.
            const designFit = Math.min(fw, fh) * 0.9
            const aspect = this.thumbImage.width / Math.max(1, this.thumbImage.height)
            const dW = aspect >= 1 ? designFit : designFit * aspect
            const dH = aspect >= 1 ? designFit / aspect : designFit
            const cxDesign = fw / 2 + this.designOffsetX
            const cyDesign = fh / 2 + this.designOffsetY
            const x = frameLeft + (cxDesign - dW / 2) * scale
            // Y inverted: design (0,0) bottom-left.
            const y = frameTop + (fh - cyDesign - dH / 2) * scale
            ctx.drawImage(this.thumbImage, x, y, dW * scale, dH * scale)
        }

        if (this.showFrameBorder) {
            ctx.strokeStyle = this.frameColor
            ctx.lineWidth = Math.max(0.9, Math.min(1.4, scale * 0.12))
            ctx.setLineDash([4, 3])
            ctx.strokeRect(frameLeft, frameTop, fw * scale, fh * scale)
            ctx.setLineDash([])
        }
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
        height: 300px;
        background-color: var(--stitchlab-preview-bg, var(--ctp-crust, var(--v-card-base, #d6dae2)));
        border: 1px solid var(--ctp-surface0, rgba(128, 128, 128, 0.25));
        border-radius: 8px;
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
