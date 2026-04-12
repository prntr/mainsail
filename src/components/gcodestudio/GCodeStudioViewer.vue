<template>
    <div>
        <panel :title="panelTitle" :icon="mdiNeedle" card-class="gcode-viewer-panel" :margin-bottom="false">
            <template #buttons>
                <v-btn icon tile @click="resetView" :title="$t('GCodeStudio.TopView')">
                    <v-icon>{{ mdiCameraRetake }}</v-icon>
                </v-btn>
                <v-btn icon tile @click="fitToFrame" :title="$t('GCodeStudio.FitToFrame')">
                    <v-icon>{{ mdiFitToScreen }}</v-icon>
                </v-btn>
            </template>
            <v-card-text>
                <v-row :class="showScrubber ? 'withScrubber' : ''">
                    <v-col :cols="showGCode ? 8 : 12">
                        <canvas ref="canvas" class="gcode-canvas"></canvas>
                    </v-col>
                    <v-col v-show="showGCode" cols="4">
                        <div class="viewer">
                            <CodeStream
                                ref="gcodestream"
                                :shown="showGCode"
                                :currentline.sync="scrubPosition"
                                :document="fileData"
                                :is-simulating="!printerIsPrinting" />
                        </div>
                    </v-col>
                </v-row>
                <v-row v-show="showScrubber" class="scrubber">
                    <v-col class="pt-0">
                        <v-slider
                            v-model="scrubPosition"
                            :hint="scrubPosition + '/' + scrubFileSize"
                            :max="scrubFileSize"
                            dense
                            min="0"
                            persistent-hint />
                    </v-col>
                    <v-col class="col-auto pt-0 text-center">
                        <v-btn class="px-2 minwidth-0" color="primary" @click="scrubPlaying = !scrubPlaying">
                            <v-icon v-if="scrubPlaying">{{ mdiPause }}</v-icon>
                            <v-icon v-else>{{ mdiPlay }}</v-icon>
                        </v-btn>
                        <v-btn class="px-2 minwidth-0 mx-3" color="primary" @click="fastForward">
                            <v-icon>{{ mdiFastForward }}</v-icon>
                        </v-btn>
                        <v-btn-toggle v-model="scrubSpeed" class="mt-3 mt-sm-0" dense mandatory rounded>
                            <v-btn :value="1">1x</v-btn>
                            <v-btn :value="2">2x</v-btn>
                            <v-btn :value="5">5x</v-btn>
                            <v-btn :value="10">10x</v-btn>
                            <v-btn :value="20">20x</v-btn>
                        </v-btn-toggle>
                    </v-col>
                </v-row>
                <v-row class="mt-0 d-flex align-top">
                    <v-col>
                        <v-row>
                            <v-col
                                order-md="2"
                                class="d-flex align-content-space-around justify-center flex-wrap flex-md-nowrap col-12 col-md-4">
                                <template v-if="loadedFile === null">
                                    <v-btn
                                        v-if="sdCardFilePath !== '' && sdCardFilePath !== loadedFile"
                                        class="mr-3"
                                        @click="loadCurrentFile">
                                        {{ $t('GCodeViewer.LoadCurrentFile') }}
                                    </v-btn>
                                    <v-btn @click="chooseFile">{{ $t('GCodeViewer.LoadLocal') }}</v-btn>
                                </template>
                                <template v-else>
                                    <v-btn v-if="showTrackingButton" class="mr-3" @click="tracking = !tracking">
                                        <v-icon
                                            class="mr-2"
                                            v-html="tracking ? mdiToggleSwitch : mdiToggleSwitchOffOutline" />
                                        {{ $t('GCodeViewer.Tracking') }}
                                    </v-btn>
                                    <v-btn @click="clearLoadedFile">
                                        <v-icon left>{{ mdiBroom }}</v-icon>
                                        {{ $t('GCodeViewer.ClearLoadedFile') }}
                                    </v-btn>
                                </template>
                            </v-col>
                            <v-col class="col-12 col-sm-6 col-md-4">
                                <v-select
                                    v-model="colorMode"
                                    :items="colorModes"
                                    :label="$t('GCodeViewer.ColorMode')"
                                    item-text="text"
                                    dense
                                    hide-details
                                    outlined></v-select>
                            </v-col>
                            <v-col order-md="3" class="col-12 col-sm-6 col-md-4 d-flex">
                                <v-select
                                    v-model="renderQuality"
                                    :items="renderQualities"
                                    :label="$t('GCodeViewer.RenderQuality')"
                                    item-text="label"
                                    dense
                                    hide-details
                                    outlined></v-select>
                                <v-menu
                                    :offset-y="true"
                                    :offset-x="true"
                                    top
                                    :close-on-content-click="false"
                                    :title="$t('Files.SetupCurrentList')">
                                    <template #activator="{ on, attrs }">
                                        <v-btn class="minwidth-0 px-2 ml-3" v-bind="attrs" v-on="on">
                                            <v-icon>{{ mdiCog }}</v-icon>
                                        </v-btn>
                                    </template>
                                    <v-list>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="showCursor"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.ShowToolhead')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="showTravelMoves"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.ShowTravelMoves')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="showGCode"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.ShowGCode')" />
                                        </v-list-item>

                                        <v-list-item
                                            v-if="loadedFile === sdCardFilePath && printing_objects.length"
                                            class="minHeight36">
                                            <v-checkbox
                                                v-model="showObjectSelection"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.ShowObjectSelection')" />
                                        </v-list-item>
                                        <v-divider></v-divider>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="hdRendering"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.HDRendering')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="forceLineRendering"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.ForceLineRendering')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="transparency"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.Transparency')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="voxelMode"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.VoxelMode')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="specularLighting"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.SpecularLighting')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="cncMode"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.CNCMode')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="embroideryMode"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.EmbroideryMode')" />
                                        </v-list-item>
                                    </v-list>
                                </v-menu>
                            </v-col>
                        </v-row>
                    </v-col>
                </v-row>
                <input
                    ref="fileInput"
                    :accept="'.g,.gcode,.gc,.gco,.nc,.ngc,.tap'"
                    hidden
                    multiple
                    type="file"
                    @change="fileSelected" />
            </v-card-text>
            <resize-observer @notify="handleResize" />
        </panel>
        <v-snackbar v-model="loading" :timeout="-1" fixed right bottom>
            <div>
                {{ $t('GCodeViewer.Rendering') }} - {{ loadingPercent }}%
                <br />
                <strong>{{ loadedFile }}</strong>
            </div>
            <v-progress-linear class="mt-2" :value="loadingPercent"></v-progress-linear>
            <template #action="{ attrs }">
                <v-btn color="red" text v-bind="attrs" style="min-width: auto" @click="cancelRendering()">
                    <v-icon class="0">{{ mdiClose }}</v-icon>
                </v-btn>
            </template>
        </v-snackbar>
        <v-snackbar v-model="downloadSnackbar.status" :timeout="-1" fixed right bottom>
            <template v-if="downloadSnackbar.total > 0">
                <div>
                    {{ $t('GCodeViewer.Downloading') }} - {{ Math.round(downloadSnackbar.percent) }} % @
                    {{ formatFilesize(Math.round(downloadSnackbar.speed)) }}/s
                    <br />
                    <strong>{{ downloadSnackbar.filename }}</strong>
                </div>
                <v-progress-linear class="mt-2" :value="downloadSnackbar.percent" />
            </template>
            <template v-else>
                <div>
                    {{ $t('GCodeViewer.Downloading') }}
                    <br />
                    <strong>{{ downloadSnackbar.filename }}</strong>
                </div>
                <v-progress-linear class="mt-2" indeterminate />
            </template>
            <template #action="{ attrs }">
                <v-btn color="red" text v-bind="attrs" style="min-width: auto" @click="cancelDownload">
                    <v-icon class="0">{{ mdiClose }}</v-icon>
                </v-btn>
            </template>
        </v-snackbar>
        <v-dialog v-model="excludeObject.bool" max-width="400">
            <v-card>
                <v-toolbar flat dense>
                    <v-toolbar-title>
                        <span class="subheading">
                            <v-icon left>{{ mdiSelectionRemove }}</v-icon>
                            {{ $t('Panels.StatusPanel.ExcludeObject.ExcludeObjectHeadline') }}
                        </span>
                    </v-toolbar-title>
                </v-toolbar>
                <v-card-text class="mt-3">
                    {{ $t('Panels.StatusPanel.ExcludeObject.ExcludeObjectText', { name: excludeObject.name }) }}
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="excludeObject.bool = false">
                        {{ $t('Panels.StatusPanel.ExcludeObject.Cancel') }}
                    </v-btn>
                    <v-btn color="primary" text @click="cancelObject">
                        {{ $t('Panels.StatusPanel.ExcludeObject.ExcludeObject') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Ref, Watch } from 'vue-property-decorator'
import BaseMixin from '../mixins/base'
import axios, { AxiosProgressEvent } from 'axios'
import { escapePath, formatFilesize } from '@/plugins/helpers'
import Panel from '@/components/ui/Panel.vue'
import CodeStream from '@/components/gcodeviewer/CodeStream.vue'
import { needleIcon } from '@/components/icons/needleIcon'
import {
    mdiCameraRetake,
    mdiCog,
    mdiClose,
    mdiReloadAlert,
    mdiToggleSwitch,
    mdiToggleSwitchOffOutline,
    mdiFitToScreen,
    mdiPlay,
    mdiPause,
    mdiFastForward,
    mdiBroom,
    mdiSelectionRemove,
    mdiAxisArrow,
    mdiCropFree,
} from '@mdi/js'
import { Debounce } from 'vue-debounce-decorator'

interface downloadSnackbar {
    status: boolean
    filename: string
    percent: number
    speed: number
    total: number
    cancelTokenSource: any
}

interface GCode2DViewerColors {
    G0?: string
    G1?: string
    G2G3?: string
}

let viewer: any = null
@Component({
    components: { Panel, CodeStream },
})
export default class GCodeStudioViewer extends Mixins(BaseMixin) {
    /**
     * Icons
     */
    mdiReloadAlert = mdiReloadAlert
    mdiCameraRetake = mdiCameraRetake
    mdiAxisArrow = mdiAxisArrow
    mdiCropFree = mdiCropFree
    mdiToggleSwitch = mdiToggleSwitch
    mdiToggleSwitchOffOutline = mdiToggleSwitchOffOutline
    mdiClose = mdiClose
    mdiCog = mdiCog
    mdiNeedle = needleIcon
    mdiFitToScreen = mdiFitToScreen
    mdiPlay = mdiPlay
    mdiPause = mdiPause
    mdiFastForward = mdiFastForward
    mdiBroom = mdiBroom
    mdiSelectionRemove = mdiSelectionRemove

    formatFilesize = formatFilesize

    isBusy = false
    loading = false
    loadingPercent = 0

    tracking = false
    loadedFile: string | null = null

    reloadRequired = false
    fileSize = 0
    renderQuality = this.renderQualities[2]

    scrubPosition = 0
    scrubPlaying = false
    scrubSpeed = 1
    scrubInterval: ReturnType<typeof setInterval> | undefined = undefined
    scrubFileSize = 0

    downloadSnackbar: downloadSnackbar = {
        status: false,
        filename: '',
        percent: 0,
        speed: 0,
        total: 0,
        cancelTokenSource: {},
    }

    excludeObject = {
        bool: false,
        name: '',
    }

    fileData: string = ''

    @Prop({ type: String, default: '', required: false }) declare filename: string
    @Prop({ type: Boolean, default: false, required: false }) declare embroideryModeDefault: boolean
    @Ref('fileInput') declare fileInput: HTMLInputElement
    @Ref('canvas') declare canvas!: HTMLCanvasElement

    get renderQualities() {
        return [
            { label: this.$t('GCodeViewer.Low'), value: 2 },
            { label: this.$t('GCodeViewer.Medium'), value: 3 },
            { label: this.$t('GCodeViewer.High'), value: 4 },
            { label: this.$t('GCodeViewer.Ultra'), value: 5 },
            { label: this.$t('GCodeViewer.Max'), value: 6 },
        ]
    }

    async mounted() {
        this.loadedFile = this.$store.state.gcodeviewer?.loadedFileBackup ?? null
        viewer = this.$store.state.gcodeviewer?.viewerBackup ?? null
        await this.init()

        if (this.loadedFile !== null) this.scrubFileSize = viewer.fileSize
        if (viewer) {
            this.fileData = viewer.fileData
        }
    }

    beforeDestroy() {
        if (viewer) {
            viewer.gcodeProcessor.loadingProgressCallback = null
            this.$store.dispatch('gcodeviewer/setLoadedFileBackup', this.loadedFile)
            this.$store.dispatch('gcodeviewer/setViewerBackup', viewer)
        }

        this.scrubPlaying = false
        if (this.scrubInterval) {
            clearInterval(this.scrubInterval)
            this.scrubInterval = undefined
        }
    }

    @Debounce(200)
    handleResize() {
        this.$nextTick(() => {
            viewer?.resize()
        })
    }

    get panelTitle() {
        let title = this.$t('GCodeViewer.Title').toString()

        if (this.loadedFile) title += `: ${this.loadedFile}`

        return title
    }

    get filePosition() {
        return this.printerIsPrinting ? this.$store.state.printer.virtual_sdcard.file_position : 0
    }

    get sdCardFilePath() {
        return this.$store.state.printer.print_stats?.filename ?? ''
    }

    get livePosition() {
        return this.$store.state.printer.motion_report?.live_position ?? [0, 0, 0, 0]
    }

    get gcodeOffset() {
        return this.$store.state.printer?.gcode_move?.homing_origin ?? [0, 0, 0]
    }

    get currentPosition() {
        return [
            this.livePosition[0] - this.gcodeOffset[0],
            this.livePosition[1] - this.gcodeOffset[1],
            this.livePosition[2] - this.gcodeOffset[2],
            this.livePosition[3],
        ]
    }

    get showTrackingButton() {
        return this.printerIsPrinting && this.sdCardFilePath === this.loadedFile
    }

    get printing_objects() {
        return this.$store.state.printer?.exclude_object?.objects ?? []
    }

    @Watch('printing_objects')
    printing_objectsChanged() {
        this.refreshPrintingObjects()
    }

    get excluded_objects() {
        return this.$store.state.printer.exclude_object?.excluded_objects ?? []
    }

    @Watch('excluded_objects')
    excluded_objectsChanged() {
        this.refreshPrintingObjects()
    }

    get nozzle_diameter() {
        return this.$store.state.printer.configfile?.settings?.extruder?.nozzle_diameter ?? 0.4
    }

    async init() {
        // Load 2D viewer library scripts
        await this.loadLibraryScripts()

        // Initialize canvas
        this.$nextTick(() => {
            this.initCanvas()
        })

        if (this.$route.query?.filename && this.loadedFile !== this.$route.query?.filename?.toString()) {
            await this.sleep(1000)
            await this.loadFile(this.$route.query.filename.toString())
        }
    }

    loadLibraryScripts(): Promise<void> {
        return new Promise((resolve) => {
            // Check if already loaded
            if ((window as any).GCode2DViewer) {
                resolve()
                return
            }

            // Load parser first
            const script1 = document.createElement('script')
            script1.src = '/lib/gcode2dviewer/gcodetogeometry.min.js'
            script1.onload = () => {
                // Then load viewer
                const script2 = document.createElement('script')
                script2.src = '/lib/gcode2dviewer/gcode2dviewer.js'
                script2.onload = () => {
                    resolve()
                }
                document.head.appendChild(script2)
            }
            document.head.appendChild(script1)
        })
    }

    initCanvas(): void {
        if (!this.canvas) {
            console.error('Canvas not found')
            return
        }

        // Set canvas size based on container
        const container = this.canvas.parentElement
        if (container) {
            const rect = container.getBoundingClientRect()
            this.canvas.width = Math.max(rect.width || 600, 400)
            this.canvas.height = Math.max(rect.height || 400, 300)
        }
    }

    registerProgressCallback() {
        if (viewer === null) return

        viewer.gcodeProcessor.loadingProgressCallback = (progress: number) => {
            this.loadingPercent = Math.ceil(progress * 100)
            this.loading = this.loadingPercent <= 99
        }
    }

    async cancelRendering() {
        if (viewer === null) return

        viewer.gcodeProcessor.cancelLoad = true
        await this.sleep(1000)
    }

    clearLoadedFile() {
        if (viewer === null) return

        this.scrubPlaying = false
        this.scrubFileSize = 0
        viewer.clearScene(true)
        this.loadedFile = null
        this.tracking = false
    }

    chooseFile() {
        if (this.isBusy) return

        this.fileInput.click()
    }

    finishLoad() {
        this.loading = false
        viewer.setCursorVisiblity(this.showCursor)

        this.refreshPrintingObjects()
        this.scrubFileSize = viewer.fileSize

        viewer.gcodeProcessor.updateFilePosition(viewer.fileSize)

        // In embroidery mode, automatically set top-down camera view
        if (this.embroideryMode) {
            this.$nextTick(() => {
                this.setTopDownCamera()
            })
        }
    }

    refreshPrintingObjects() {
        if (this.loadedFile !== this.sdCardFilePath || this.printing_objects.length === 0) return

        let objects: {
            cancelled: boolean
            name: string
            x: number[]
            y: number[]
        }[] = []
        this.printing_objects.forEach((object: any) => {
            const xValues = object.polygon.map((point: number[]) => point[0])
            const yValues = object.polygon.map((point: number[]) => point[1])

            objects.push({
                cancelled: this.excluded_objects.includes(object.name),
                name: object.name,
                x: [Math.min(...xValues), Math.max(...xValues)],
                y: [Math.min(...yValues), Math.max(...yValues)],
            })
        })

        viewer?.buildObjects.loadObjectBoundaries(objects)
        viewer?.buildObjects.showObjectSelection(this.showObjectSelection)
    }

    async fileSelected(e: any) {
        const reader = new FileReader()
        reader.addEventListener('load', async (event) => {
            if (!event || !event.target) return
            const blob = event.target.result
            if (typeof blob === 'string') {
                this.fileSize = blob.length
                // Do something with result
                let processedBlob = blob
                if (this.embroideryMode) {
                    this.parsedEmbroideryColors = [] // Reset before parsing
                    processedBlob = this.preprocessEmbroideryGCode(blob)
                }
                await viewer.processFile(processedBlob)
                this.fileData = viewer.fileData
                // Load embroidery colors if parsed
                if (this.embroideryMode && this.parsedEmbroideryColors.length > 0) {
                    this.loadToolColors(this.parsedEmbroideryColors)
                }
            }
            this.finishLoad()
        })
        this.tracking = false
        if (e.target.files?.length) {
            this.loadedFile = e?.target?.files[0].name
            reader.readAsText(e.target.files[0])
        }
        e.target.value = ''
    }

    async loadFile(filename: string) {
        this.downloadSnackbar.status = true
        this.downloadSnackbar.speed = 0
        this.downloadSnackbar.filename = filename.startsWith('gcodes/') ? filename.slice(7) : filename
        const CancelToken = axios.CancelToken
        this.downloadSnackbar.cancelTokenSource = CancelToken.source()

        const text = await axios
            .get(this.apiUrl + '/server/files/' + escapePath(filename), {
                cancelToken: this.downloadSnackbar.cancelTokenSource.token,
                responseType: 'blob',
                onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
                    this.downloadSnackbar.percent = (progressEvent.progress ?? 0) * 100
                    this.downloadSnackbar.speed = progressEvent.rate ?? 0
                    this.downloadSnackbar.total = progressEvent.total ?? 0
                },
            })
            .then((res) => res.data.text())
            .catch((e) => {
                window.console.error(e.message)
            })
        this.downloadSnackbar.status = false
        this.loadedFile = this.downloadSnackbar.filename

        viewer.updateRenderQuality(this.renderQuality.value)
        let processedText = text
        if (this.embroideryMode) {
            this.parsedEmbroideryColors = [] // Reset before parsing
            processedText = this.preprocessEmbroideryGCode(text)
        }
        await viewer.processFile(processedText)
        this.fileData = viewer.fileData
        // Load embroidery colors if parsed
        if (this.embroideryMode && this.parsedEmbroideryColors.length > 0) {
            this.loadToolColors(this.parsedEmbroideryColors)
        }
        this.loadingPercent = 100
        this.finishLoad()
        this.scrubFileSize = viewer.fileSize
    }

    cancelDownload() {
        this.downloadSnackbar.cancelTokenSource.cancel('User canceled download gcode file')
    }

    async sleep(ms: number) {
        await new Promise((resolve) => setTimeout(resolve, ms))
    }

    async loadCurrentFile() {
        await this.loadFile('gcodes/' + this.sdCardFilePath)
        this.loadedFile = this.sdCardFilePath
    }

    async reloadViewer() {
        if (this.loadedFile === null) return

        if (this.loading) {
            //if we are actively loading signal a cancel and wait a second
            //This prevents a timing issue that can happen if a user changes settings and then
            //hits the reload viewer button. Will eventually move this to api
            viewer.gcodeProcessor.cancelLoad = true
            await this.sleep(1000)
        }

        this.reloadRequired = false
        this.loading = true
        this.loadingPercent = 0
        await viewer.reload()
        this.fileData = viewer.fileData
        this.loadingPercent = 100
        this.finishLoad()
    }

    resetCamera() {
        viewer.resetCamera()
        // In embroidery mode, default to top-down view
        if (this.embroideryMode) {
            this.$nextTick(() => {
                this.setTopDownCamera()
            })
        }
    }

    /**
     * Set camera to top-down orthographic-like view for 2D embroidery viewing
     * Locks camera to look straight down at the XY plane
     */
    setTopDownCamera() {
        if (!viewer || !viewer.scene) return

        // Use the viewbox "Top" camera position
        // This positions camera directly above looking down
        viewer.setViewboxCameraPosition({ x: 0, y: -1, z: 0 })

        // Lock camera angles for 2D-like view via scene.activeCamera
        // beta = 0 means looking straight down
        // alpha = 270° (3π/2) means aligned with Y axis
        const camera = viewer.scene.activeCamera
        if (camera) {
            camera.beta = 0.01 // Nearly 0 (can't be exactly 0)
            camera.alpha = (3 * Math.PI) / 2
            // Lock rotation for pure 2D panning/zooming
            camera.lowerBetaLimit = 0.01
            camera.upperBetaLimit = 0.01
        }

        viewer.forceRender()
    }

    /**
     * Unlock camera for free 3D rotation (used when exiting embroidery mode)
     */
    unlockCamera() {
        if (!viewer || !viewer.scene) return

        const camera = viewer.scene.activeCamera
        if (!camera) return

        camera.lowerBetaLimit = 0.1
        camera.upperBetaLimit = Math.PI - 0.1
        camera.lowerAlphaLimit = null
        camera.upperAlphaLimit = null
    }

    setReloadRequiredFlag() {
        if (this.loadedFile && this.loadedFile != '') {
            this.reloadRequired = true
        }
    }

    @Watch('renderQuality')
    async renderQualityChanged(newVal: number) {
        if (viewer && viewer.renderQuality !== newVal) {
            viewer.updateRenderQuality(newVal)
            await this.reloadViewer()
        }
    }

    @Watch('currentPosition')
    currentPositionChanged(newVal: number[]) {
        if (!viewer || !this.tracking || this.scrubPlaying) return

        const position = [
            { axes: 'X', position: newVal[0] },
            { axes: 'Y', position: newVal[1] },
            { axes: 'Z', position: newVal[2] },
        ]

        viewer.updateToolPosition(position)
    }

    @Watch('filePosition')
    filePositionChanged(newVal: number) {
        if (!viewer || !this.tracking || this.scrubPlaying) return

        const offset = 350
        if (newVal > 0 && this.printerIsPrinting && this.tracking && newVal > offset) {
            viewer.gcodeProcessor.updateFilePosition(newVal - offset)
            this.scrubPosition = newVal - offset
            return
        }

        viewer.gcodeProcessor.updateFilePosition(viewer.fileSize)
    }

    @Watch('tracking')
    async trackingChanged(newVal: boolean) {
        if (viewer === null) return

        if (newVal) {
            this.scrubPlaying = false
            //Force renderers reload.
            viewer.gcodeProcessor.updateFilePosition(0)
            viewer?.forceRender()
            return
        }

        viewer.gcodeProcessor.setLiveTracking(false)
        await this.reloadViewer()
    }

    @Watch('printerIsPrinting')
    printerIsPrintingChanged() {
        this.tracking = false
    }

    get showCursor(): boolean {
        return this.$store.state.gui.gcodeViewer.showCursor ?? false
    }

    set showCursor(newVal: boolean) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.showCursor', value: newVal })
    }

    @Watch('showCursor')
    showCursorChanged(newVal: boolean) {
        viewer?.setCursorVisiblity(newVal)
    }

    get showTravelMoves(): boolean {
        return this.$store.state.gui.gcodeViewer.showTravelMoves ?? false
    }

    set showTravelMoves(newVal: boolean) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.showTravelMoves', value: newVal })
    }

    get showGCode(): boolean {
        return this.$store.state.gui.gcodeViewer.showGCode ?? false
    }

    set showGCode(newVal: boolean) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.showGCode', value: newVal })
        if (newVal && viewer) {
            this.fileData = viewer.fileData
        }
        this.handleResize()
    }

    @Watch('showTravelMoves')
    showTravelMovesChanged(newVal: boolean) {
        viewer?.toggleTravels(newVal)
    }

    get showObjectSelection(): boolean {
        return this.$store.state.gui.gcodeViewer.showObjectSelection ?? false
    }

    set showObjectSelection(newVal: boolean) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.showObjectSelection', value: newVal })
    }

    @Watch('showObjectSelection')
    showObjectSelectionChanged(newVal: boolean) {
        viewer?.buildObjects.showObjectSelection(newVal)
    }

    get hdRendering() {
        return this.$store.state.gui.gcodeViewer.hdRendering
    }

    set hdRendering(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.hdRendering', value: newVal })
    }

    @Watch('hdRendering')
    async hdRenderingChanged(newVal: boolean) {
        if (viewer === null) return

        viewer.gcodeProcessor.useHighQualityExtrusion(newVal)
        await this.reloadViewer()
    }

    get forceLineRendering() {
        return this.$store.state.gui.gcodeViewer.forceLineRendering
    }

    set forceLineRendering(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.forceLineRendering', value: newVal })
    }

    @Watch('forceLineRendering')
    async forceLineRenderingChanged(newVal: boolean) {
        if (viewer === null) return

        viewer.gcodeProcessor.updateForceWireMode(newVal || this.cncMode)
        await this.reloadViewer()
    }

    get transparency() {
        return this.$store.state.gui.gcodeViewer.transparency
    }

    set transparency(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.transparency', value: newVal })
    }

    @Watch('transparency')
    async transparencyChanged(newVal: boolean) {
        if (viewer === null) return

        viewer.gcodeProcessor.setAlpha(newVal)
        await this.reloadViewer()
    }

    get voxelMode() {
        return this.$store.state.gui.gcodeViewer.voxelMode
    }

    set voxelMode(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.voxelMode', value: newVal })
    }

    @Watch('voxelMode')
    async voxelModeChanged(newVal: boolean) {
        if (viewer === null) return

        viewer.gcodeProcessor.setVoxelMode(newVal)
        viewer.gcodeProcessor.voxelWidth = this.voxelWidth
        viewer.gcodeProcessor.voxelHeight = this.voxelHeight
        await this.reloadViewer()
    }

    get voxelWidth() {
        return this.$store.state.gui.gcodeViewer.voxelWidth ?? 1
    }

    set voxelWidth(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.voxelWidth', value: newVal })
    }

    get voxelHeight() {
        return this.$store.state.gui.gcodeViewer.voxelHeight ?? 1
    }

    set voxelHeight(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.voxelHeight', value: newVal })
    }

    get specularLighting() {
        return this.$store.state.gui.gcodeViewer.specularLighting
    }

    set specularLighting(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.specularLighting', value: newVal })
    }

    @Watch('specularLighting')
    async specularLightingChanged(newVal: boolean) {
        if (viewer === null) return

        viewer.gcodeProcessor.useSpecularColor(newVal)
        //await this.reloadViewer()
    }

    get cncMode() {
        return this.$store.state.gui.gcodeViewer.cncMode
    }

    set cncMode(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.cncMode', value: newVal })
        viewer.gcodeProcessor.g1AsExtrusion = newVal
        viewer.gcodeProcessor.updateForceWireMode(this.forceLineRendering || newVal)
        this.reloadViewer()
    }

    get embroideryMode() {
        // Use prop default if store value is not set
        const storeValue = this.$store.state.gui.gcodeViewer.embroideryMode
        if (storeValue === undefined || storeValue === null) {
            return this.embroideryModeDefault
        }
        return storeValue
    }

    set embroideryMode(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.embroideryMode', value: newVal })
        if (viewer) {
            // In embroidery mode, treat G1 as extrusion and use wire mode
            if (newVal) {
                viewer.gcodeProcessor.g1AsExtrusion = true
                viewer.gcodeProcessor.updateForceWireMode(true)
                // Switch to top-down view
                this.$nextTick(() => {
                    this.setTopDownCamera()
                })
            } else {
                // Restore normal 3D view
                viewer.gcodeProcessor.g1AsExtrusion = this.cncMode
                viewer.gcodeProcessor.updateForceWireMode(this.forceLineRendering || this.cncMode)
                // Unlock camera for 3D rotation
                this.unlockCamera()
            }
            this.reloadViewer()
        }
    }

    /**
     * Preprocess embroidery G-code for 2D visualization
     * - Parses TurtleStitch color comments and converts to tool changes
     * - Removes Z-only lines (Z represents stitch count, not height)
     * - Adds E parameter to XY moves so lines are rendered as extrusions
     *
     * TurtleStitch format has Z on separate lines:
     *   G1 X2.000 Y8.596
     *   G1 Z5.000         <- Z-only line (stitch marker)
     *   G1 X4.000 Y8.596
     *   G1 Z10.000
     */
    preprocessEmbroideryGCode(gcode: string): string {
        const lines = gcode.split('\n')
        let toolNumber = 0
        let stitchCount = 0
        const colorToTool: Map<string, number> = new Map()
        const toolColors: string[] = []
        const processedLines: string[] = []

        for (const line of lines) {
            const trimmedLine = line.trim()

            // Parse TurtleStitch color comments: ; color r:X g:Y b:Z
            const colorMatch = trimmedLine.match(/;\s*color\s+r:(\d+)\s+g:(\d+)\s+b:(\d+)/i)
            if (colorMatch) {
                const r = parseInt(colorMatch[1])
                const g = parseInt(colorMatch[2])
                const b = parseInt(colorMatch[3])
                const colorKey = `${r},${g},${b}`
                const hexColor = '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')

                if (!colorToTool.has(colorKey)) {
                    colorToTool.set(colorKey, toolNumber)
                    toolColors.push(hexColor)
                    toolNumber++
                }

                const tool = colorToTool.get(colorKey)
                processedLines.push(line) // Keep original comment
                processedLines.push(`T${tool}`) // Add tool change
                continue
            }

            // Check for Z-only lines (G1 Z5.000) - these mark stitches
            // Skip these lines but count them as stitches
            const zOnlyMatch = trimmedLine.match(/^G[01]\s+Z[\d.-]+\s*$/i)
            if (zOnlyMatch) {
                stitchCount++
                // Skip Z-only lines - they just indicate stitch count
                continue
            }

            // Check for G0/G1 with X or Y coordinates (actual move commands)
            const moveMatch = trimmedLine.match(/^G([01])\s+(.+)/i)
            if (moveMatch && (trimmedLine.includes('X') || trimmedLine.includes('Y'))) {
                const gCode = moveMatch[1]
                // For G1 moves (not G0 rapid moves), add E parameter for extrusion rendering
                if (gCode === '1') {
                    // Remove any existing Z parameter and add E
                    let cleanLine = line.replace(/\s+Z[\d.-]+/gi, '')
                    if (!cleanLine.includes(' E')) {
                        stitchCount++
                        processedLines.push(cleanLine + ' E' + (stitchCount * 0.01).toFixed(4))
                    } else {
                        processedLines.push(cleanLine)
                    }
                } else {
                    // G0 rapid moves - keep as-is (travel moves)
                    processedLines.push(line)
                }
                continue
            }

            // Keep all other lines (comments, G21, G90, M400, M84, etc.)
            processedLines.push(line)
        }

        // Store parsed colors for tool loading
        if (toolColors.length > 0) {
            this.parsedEmbroideryColors = toolColors
        }

        return processedLines.join('\n')
    }

    // Store parsed embroidery colors for tool loading
    parsedEmbroideryColors: string[] = []

    get extruderColors() {
        return this.$store.state.gui.gcodeViewer?.extruderColors ?? false
    }

    loadToolColors(colors: string[]) {
        if (viewer && colors.length) {
            viewer.gcodeProcessor.resetTools()
            colors.forEach((color: string) => {
                viewer.gcodeProcessor.addTool(color, this.nozzle_diameter)
            })
            this.setReloadRequiredFlag()
        }
    }

    @Watch('extruderColors')
    extruderColorsChanged(newVal: string[]) {
        if (viewer && newVal && newVal.length) {
            this.loadToolColors(newVal)
            this.setReloadRequiredFlag()
        }
    }

    colorModes = [
        { text: 'Extruder', value: 0 },
        { text: 'Feed Rate', value: 1 },
        { text: 'Feature', value: 2 },
    ]

    get colorMode(): number {
        return this.$store.state.gui.gcodeViewer?.colorMode ?? 2
    }

    set colorMode(newVal: number) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.colorMode', value: newVal })

        if (viewer && viewer.gcodeProcessor.colorMode !== newVal) {
            viewer.gcodeProcessor.setColorMode(newVal)
            this.reloadViewer()
        }
    }

    get backgroundColor() {
        return this.$store.state.gui.gcodeViewer?.backgroundColor ?? '#121212'
    }

    @Watch('backgroundColor')
    backgroundColorChanged(newVal: string) {
        if (viewer === null) return

        viewer.setBackgroundColor(newVal)
    }

    get gridColor() {
        return this.$store.state.gui.gcodeViewer?.gridColor ?? '#B3B3B3'
    }

    @Watch('gridColor')
    gridColorChanged(newVal: string) {
        if (viewer === null) return
        viewer.bed.setBedColor(newVal)
    }

    get showAxes() {
        return this.$store.state.gui.gcodeViewer?.showAxes ?? true
    }

    @Watch('showAxes')
    showAxesChanged(newVal: boolean) {
        if (viewer === null) return

        viewer.axes.show(newVal)
    }

    get minFeed() {
        return this.$store.state.gui.gcodeViewer?.minFeed ?? 20
    }

    @Watch('minFeed')
    minFeedChanged(newVal: number) {
        if (viewer === null) return

        viewer.gcodeProcessor.updateColorRate(newVal * 60, this.maxFeed * 60)
    }

    get maxFeed() {
        return this.$store.state.gui.gcodeViewer?.maxFeed ?? 100
    }

    @Watch('maxFeed')
    maxFeedChanged(newVal: number) {
        if (viewer === null) return

        viewer.gcodeProcessor.updateColorRate(this.minFeed * 60, newVal * 60)
    }

    get minFeedColor() {
        return this.$store.state.gui.gcodeViewer?.minFeedColor ?? '#0000FF'
    }

    @Watch('minFeedColor')
    minFeedColorUpdated(newVal: string) {
        if (viewer === null) return

        viewer.gcodeProcessor.updateMinFeedColor(newVal)
        this.setReloadRequiredFlag()
    }

    get maxFeedColor() {
        return this.$store.state.gui.gcodeViewer?.maxFeedColor ?? '#FF0000'
    }

    @Watch('maxFeedColor')
    maxFeedColorUpdated(newVal: string) {
        if (viewer === null) return

        viewer.gcodeProcessor.updateMaxFeedColor(newVal)
        this.setReloadRequiredFlag()
    }

    get kinematics() {
        return (
            this.$store.state.printer.configfile?.settings?.printer?.kinematics ??
            this.$store.state.gui?.gcodeViewer?.klipperCache?.kinematics ??
            ''
        )
    }

    get bedMaxSize() {
        return (
            this.$store.state.printer.toolhead?.axis_maximum ??
            this.$store.state.gui?.gcodeViewer?.klipperCache?.axis_maximum ??
            null
        )
    }

    get bedMinSize() {
        return (
            this.$store.state.printer.toolhead?.axis_minimum ??
            this.$store.state.gui?.gcodeViewer?.klipperCache?.axis_minimum ??
            null
        )
    }

    @Watch('kinematics', { immediate: true })
    kinematicsChanged(newVal: string) {
        if (viewer === null || !newVal) return

        viewer.bed.setDelta(newVal.includes('delta'))
    }

    @Watch('bedMinSize', { deep: true, immediate: true })
    bedMinSizeChanged(newVal: number[] | null) {
        if (newVal === null || viewer === null || viewer.bed === null) return

        viewer.bed.buildVolume.x.min = newVal[0]
        viewer.bed.buildVolume.y.min = newVal[1]
        viewer.bed.buildVolume.z.min = newVal[2]
    }

    @Watch('bedMaxSize', { deep: true, immediate: true })
    bedMaxSizeChanged(newVal: number[] | null) {
        if (newVal === null || viewer === null || viewer.bed === null) return

        viewer.bed.buildVolume.x.max = newVal[0]
        viewer.bed.buildVolume.y.max = newVal[1]
        viewer.bed.buildVolume.z.max = newVal[2]
    }

    get progressColor() {
        return this.$store.state.gui.gcodeViewer?.progressColor ?? '#FFFFFF'
    }

    @Watch('progressColor')
    progressColorChanged(newVal: string) {
        viewer?.setProgressColor(newVal)
    }

    @Watch('scrubPlaying')
    scrubPlayingChanged(to: boolean): void {
        if (!to) {
            if (this.scrubInterval) clearInterval(this.scrubInterval)
            this.scrubPlaying = false
            this.scrubInterval = undefined
            return
        }

        if (this.scrubInterval) {
            clearInterval(this.scrubInterval)
            this.scrubInterval = undefined
        }

        this.scrubPlaying = true
        if (this.scrubPosition >= this.scrubFileSize) {
            this.scrubPosition = 0
        }

        viewer.gcodeProcessor.updateFilePosition(this.scrubPosition - 30000)
        this.scrubInterval = setInterval(() => {
            this.scrubPosition += 100 * this.scrubSpeed
            viewer.gcodeProcessor.updateFilePosition(this.scrubPosition)
            viewer.simulateToolPosition()
            if (this.tracking || this.scrubPosition >= this.scrubFileSize) {
                this.scrubPlaying = false
            }
        }, 200)
    }

    get showScrubber() {
        return !this.tracking && this.scrubFileSize > 0
    }

    @Debounce(200)
    @Watch('scrubPosition')
    updateScrubPosition(to: number): void {
        if (viewer === null || this.tracking) return

        viewer.gcodeProcessor.updateFilePosition(to)
        viewer.simulateToolPosition()
    }

    fastForward(): void {
        this.scrubPosition = this.scrubFileSize
        viewer.gcodeProcessor.updateFilePosition(this.scrubPosition)
    }

    objectCallback(metadata: any) {
        if (metadata?.cancelled === false) {
            this.excludeObject.name = metadata.name ?? 'UNKNOWN'
            this.excludeObject.bool = true
        }
    }

    cancelObject() {
        this.$socket.emit('printer.gcode.script', { script: 'EXCLUDE_OBJECT NAME=' + this.excludeObject.name })
        this.excludeObject.bool = false
    }
}
</script>

<!-- Because the viewer lives outside of the components DOM it can't be scoped -->
<style>
.viewer {
    width: 100%;
    height: calc(var(--app-height) - 240px);
    border: 1px solid #3f3f3f;
}

.withScrubber .viewer {
    height: calc(var(--app-height) - 300px);
}

@media (min-width: 600px) and (max-width: 959px) {
    .viewer {
        height: calc(var(--app-height) - 295px);
    }

    .withScrubber .viewer {
        height: calc(var(--app-height) - 360px);
    }
}

@media (max-width: 599px) {
    .viewer {
        height: calc(var(--app-height) - 340px);
    }

    .withScrubber .viewer {
        height: calc(var(--app-height) - 340px);
    }
}
</style>

<style scoped>
.scrubber {
    position: relative;
    left: 0;
    right: 0;
    bottom: 5px;
}
</style>
