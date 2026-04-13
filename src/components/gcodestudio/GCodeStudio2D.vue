<template>
    <div>
        <panel :title="panelTitle" :icon="mdiNeedle" card-class="gcode-studio-panel" :margin-bottom="false">
            <template #buttons>
                <v-btn icon tile :title="$t('GCodeStudio.TopView')" @click="resetView">
                    <v-icon>{{ mdiCameraRetake }}</v-icon>
                </v-btn>
                <v-btn icon tile :title="$t('GCodeStudio.FitToFrame')" @click="fitToFrame">
                    <v-icon>{{ mdiFitToScreen }}</v-icon>
                </v-btn>
                <v-btn
                    icon
                    tile
                    :disabled="!loadedFile"
                    :title="$t('GCodeStudio.CenterDesign')"
                    @click="centerDesignInFrame">
                    <v-icon>{{ mdiArrowExpandAll }}</v-icon>
                </v-btn>
                <v-btn
                    icon
                    tile
                    :disabled="!loadedFile || editMode"
                    :color="moveMode ? 'primary' : ''"
                    :title="$t('GCodeStudio.MoveMode')"
                    @click="moveMode = !moveMode">
                    <v-icon>{{ mdiCursorMove }}</v-icon>
                </v-btn>
                <v-btn
                    icon
                    tile
                    :disabled="!loadedFile || !showGCode"
                    :color="editMode ? 'primary' : ''"
                    :title="$t('GCodeStudio.EditMode')"
                    @click="toggleEditMode">
                    <v-icon>{{ mdiPencil }}</v-icon>
                </v-btn>
            </template>
            <v-card-text>
                <v-row :class="showScrubber ? 'withScrubber' : ''">
                    <v-col :cols="canvasCols" class="py-0">
                        <div ref="canvasWrapper" class="canvas-wrapper" :style="{ background: backgroundColor }">
                            <canvas ref="canvas" class="gcode-canvas"></canvas>
                            <div class="coords">X: {{ cursorX.toFixed(1) }} Y: {{ cursorY.toFixed(1) }}</div>
                        </div>
                    </v-col>
                    <v-col v-show="showGCode" :cols="gcodeCols" class="py-0">
                        <div class="viewer" :class="gcodeViewerModeClass">
                            <codemirror-async
                                v-if="showGCode"
                                ref="gcodeEditor"
                                :key="editMode ? 'edit' : 'view'"
                                :value="gcodePanelDocument"
                                :readonly="!editMode"
                                file-extension="gcode"
                                :class="['gcode-editor', gcodeEditorModeClass]"
                                @input="onEditorInput"
                                @lineChange="onEditorLineChange" />
                        </div>
                    </v-col>
                    <v-col v-show="showRightPanel" :cols="settingsCols" class="right-panel py-0">
                        <v-expansion-panels v-model="expandedPanels" multiple accordion>
                            <v-expansion-panel>
                                <v-expansion-panel-header>
                                    <v-icon small class="panel-icon">{{ mdiSquareOutline }}</v-icon>
                                    <span class="panel-title">{{ $t('GCodeStudio.Frame') }}</span>
                                </v-expansion-panel-header>
                                <v-expansion-panel-content>
                                    <v-select
                                        v-model="selectedFramePreset"
                                        :items="framePresets"
                                        item-text="name"
                                        item-value="id"
                                        :label="$t('GCodeStudio.FramePreset')"
                                        dense
                                        outlined
                                        hide-details
                                        class="mb-2"
                                        @change="applyFramePreset"></v-select>
                                    <v-row dense>
                                        <v-col cols="12">
                                            <v-text-field
                                                v-model.number="frameWidth"
                                                :label="$t('GCodeStudio.Width')"
                                                type="number"
                                                suffix="mm"
                                                dense
                                                outlined
                                                hide-details
                                                @change="renderFrame" />
                                        </v-col>
                                        <v-col cols="12">
                                            <v-text-field
                                                v-model.number="frameHeight"
                                                :label="$t('GCodeStudio.Height')"
                                                type="number"
                                                suffix="mm"
                                                dense
                                                outlined
                                                hide-details
                                                @change="renderFrame" />
                                        </v-col>
                                    </v-row>
                                </v-expansion-panel-content>
                            </v-expansion-panel>

                            <v-expansion-panel>
                                <v-expansion-panel-header>
                                    <v-icon small class="panel-icon">{{ mdiCrosshairsGps }}</v-icon>
                                    <span class="panel-title">{{ $t('GCodeStudio.Position') }}</span>
                                </v-expansion-panel-header>
                                <v-expansion-panel-content>
                                    <v-row dense>
                                        <v-col :cols="transformFieldCols">
                                            <v-text-field
                                                v-model.number="designOffsetX"
                                                :label="$t('GCodeStudio.OffsetX')"
                                                type="number"
                                                step="0.1"
                                                suffix="mm"
                                                dense
                                                outlined
                                                hide-details
                                                :disabled="!loadedFile || editMode"
                                                @input="updateDesignPosition" />
                                        </v-col>
                                        <v-col :cols="transformFieldCols">
                                            <v-text-field
                                                v-model.number="designOffsetY"
                                                :label="$t('GCodeStudio.OffsetY')"
                                                type="number"
                                                step="0.1"
                                                suffix="mm"
                                                dense
                                                outlined
                                                hide-details
                                                :disabled="!loadedFile || editMode"
                                                @input="updateDesignPosition" />
                                        </v-col>
                                    </v-row>
                                    <v-row dense class="mt-2">
                                        <v-col :cols="transformFieldCols">
                                            <v-text-field
                                                v-model.number="rotationDeg"
                                                :label="$t('GCodeStudio.Rotation')"
                                                type="number"
                                                step="1"
                                                suffix="deg"
                                                dense
                                                outlined
                                                hide-details
                                                :disabled="!loadedFile || editMode"
                                                @input="updateDesignPosition" />
                                        </v-col>
                                        <v-col :cols="transformFieldCols">
                                            <v-select
                                                v-model="rotationPivot"
                                                :items="rotationPivotOptions"
                                                item-text="name"
                                                item-value="id"
                                                :label="$t('GCodeStudio.RotationPivot')"
                                                dense
                                                outlined
                                                hide-details
                                                :disabled="!loadedFile || editMode"
                                                @change="updateDesignPosition"></v-select>
                                        </v-col>
                                    </v-row>
                                    <v-row dense class="mt-2">
                                        <v-col cols="12">
                                            <v-btn
                                                small
                                                block
                                                :disabled="!loadedFile || editMode"
                                                @click="centerDesignInFrame">
                                                <v-icon left small>{{ mdiArrowExpandAll }}</v-icon>
                                                {{ $t('GCodeStudio.CenterDesign') }}
                                            </v-btn>
                                        </v-col>
                                        <v-col cols="12" class="mt-2">
                                            <v-btn
                                                small
                                                block
                                                :disabled="!loadedFile || !hasOffset || editMode"
                                                @click="resetOffsets">
                                                <v-icon left small>{{ mdiBackupRestore }}</v-icon>
                                                {{ $t('GCodeStudio.ResetOffsets') }}
                                            </v-btn>
                                        </v-col>
                                        <v-col cols="12" class="mt-2">
                                            <v-btn
                                                small
                                                block
                                                color="primary"
                                                :disabled="!canExportRepositioned || repositionedActionBusy || editMode"
                                                @click="exportTransformedGcode">
                                                <v-icon left small>{{ mdiDownload }}</v-icon>
                                                {{ $t('GCodeStudio.ExportRepositioned') }}
                                            </v-btn>
                                        </v-col>
                                        <v-col cols="12" class="mt-2">
                                            <v-btn
                                                small
                                                block
                                                color="secondary"
                                                :disabled="!canExportRepositioned || repositionedActionBusy || editMode"
                                                :loading="isUploadingRepositioned"
                                                @click="uploadTransformedGcode">
                                                <v-icon left small>{{ mdiUpload }}</v-icon>
                                                {{ $t('GCodeStudio.SaveToPrinter') }}
                                            </v-btn>
                                        </v-col>
                                        <v-col cols="12" class="mt-2">
                                            <v-btn
                                                small
                                                block
                                                color="success"
                                                :disabled="
                                                    !canExportRepositioned ||
                                                    repositionedActionBusy ||
                                                    !klipperReadyForGui ||
                                                    printerIsPrinting ||
                                                    editMode
                                                "
                                                :loading="isStartingRepositioned"
                                                @click="uploadAndStartTransformedGcode">
                                                <v-icon left small>{{ mdiPlay }}</v-icon>
                                                {{ $t('GCodeStudio.SaveAndStart') }}
                                            </v-btn>
                                        </v-col>
                                    </v-row>
                                </v-expansion-panel-content>
                            </v-expansion-panel>

                            <v-expansion-panel v-if="editMode">
                                <v-expansion-panel-header>
                                    <v-icon small class="panel-icon">{{ mdiPencil }}</v-icon>
                                    <span class="panel-title">{{ $t('GCodeStudio.EditMode') }}</span>
                                </v-expansion-panel-header>
                                <v-expansion-panel-content>
                                    <v-row dense>
                                        <v-col cols="12">
                                            <v-btn
                                                small
                                                block
                                                color="primary"
                                                :disabled="!isEditorDirty || editedActionBusy"
                                                @click="exportEditedGcode">
                                                <v-icon left small>{{ mdiDownload }}</v-icon>
                                                {{ $t('GCodeStudio.ExportEdited') }}
                                            </v-btn>
                                        </v-col>
                                        <v-col cols="12" class="mt-2">
                                            <v-btn
                                                small
                                                block
                                                color="secondary"
                                                :disabled="!isEditorDirty || editedActionBusy"
                                                :loading="isUploadingEdited"
                                                @click="uploadEditedGcode">
                                                <v-icon left small>{{ mdiUpload }}</v-icon>
                                                {{ $t('GCodeStudio.SaveEdited') }}
                                            </v-btn>
                                        </v-col>
                                        <v-col cols="12" class="mt-2">
                                            <v-btn
                                                small
                                                block
                                                color="success"
                                                :disabled="
                                                    !isEditorDirty ||
                                                    editedActionBusy ||
                                                    !klipperReadyForGui ||
                                                    printerIsPrinting
                                                "
                                                :loading="isStartingEdited"
                                                @click="uploadAndStartEditedGcode">
                                                <v-icon left small>{{ mdiPlay }}</v-icon>
                                                {{ $t('GCodeStudio.SaveEditedAndStart') }}
                                            </v-btn>
                                        </v-col>
                                    </v-row>
                                </v-expansion-panel-content>
                            </v-expansion-panel>

                            <v-expansion-panel>
                                <v-expansion-panel-header>
                                    <v-icon small class="panel-icon">{{ mdiEye }}</v-icon>
                                    <span class="panel-title">{{ $t('GCodeStudio.Display') }}</span>
                                </v-expansion-panel-header>
                                <v-expansion-panel-content>
                                    <v-checkbox
                                        v-model="showGrid"
                                        class="mt-0"
                                        hide-details
                                        :label="$t('GCodeStudio.ShowGrid')"
                                        @change="renderGrid" />
                                    <v-text-field
                                        v-model.number="gridSpacing"
                                        :label="$t('GCodeStudio.GridSpacing')"
                                        type="number"
                                        suffix="mm"
                                        dense
                                        outlined
                                        hide-details
                                        class="mt-2"
                                        @change="renderGrid" />
                                    <v-checkbox
                                        v-model="showJumpStitches"
                                        class="mt-0"
                                        hide-details
                                        :label="$t('GCodeStudio.ShowJumpStitches')"
                                        @change="updateItemVisibility" />
                                    <v-checkbox
                                        v-model="showFrameBorder"
                                        class="mt-0"
                                        hide-details
                                        :label="$t('GCodeStudio.ShowFrameBorder')"
                                        @change="renderFrame" />
                                    <v-checkbox
                                        v-model="showStitchPoints"
                                        class="mt-0"
                                        hide-details
                                        :label="$t('GCodeStudio.ShowStitchPoints')"
                                        @change="renderStitchPoints" />
                                    <v-checkbox
                                        v-model="showColorChanges"
                                        class="mt-0"
                                        hide-details
                                        :label="$t('GCodeStudio.ShowColorChanges')"
                                        @change="renderColorChanges" />
                                    <v-checkbox
                                        v-model="showNeedlePosition"
                                        class="mt-0"
                                        hide-details
                                        :label="$t('GCodeStudio.ShowNeedlePosition')"
                                        @change="updateNeedleMarker" />
                                    <v-text-field
                                        v-model.number="lineWidth"
                                        :label="$t('GCodeStudio.LineWidth')"
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        suffix="mm"
                                        dense
                                        outlined
                                        hide-details
                                        class="mt-2" />
                                    <v-text-field
                                        v-model.number="stitchPointSize"
                                        :label="$t('GCodeStudio.StitchPointSize')"
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        suffix="mm"
                                        dense
                                        outlined
                                        hide-details
                                        class="mt-2" />
                                    <v-checkbox
                                        v-model="showGCode"
                                        class="mt-0"
                                        hide-details
                                        :label="$t('GCodeViewer.ShowGCode')" />
                                    <v-checkbox
                                        v-model="showTransformedGcode"
                                        class="mt-0"
                                        hide-details
                                        :disabled="editMode"
                                        :label="$t('GCodeStudio.ShowTransformedGCode')" />
                                </v-expansion-panel-content>
                            </v-expansion-panel>

                            <v-expansion-panel>
                                <v-expansion-panel-header>
                                    <v-icon small class="panel-icon">{{ mdiPalette }}</v-icon>
                                    <span class="panel-title">{{ $t('GCodeStudio.Colors') }}</span>
                                </v-expansion-panel-header>
                                <v-expansion-panel-content>
                                    <div class="mb-2">
                                        <label class="v-label color-label">{{ $t('GCodeStudio.Stitch') }}</label>
                                        <input
                                            v-model="stitchColor"
                                            type="color"
                                            class="color-picker"
                                            @change="updatePathColors" />
                                    </div>
                                    <div class="mb-2">
                                        <label class="v-label color-label">{{ $t('GCodeStudio.JumpStitches') }}</label>
                                        <input
                                            v-model="travelColor"
                                            type="color"
                                            class="color-picker"
                                            @change="updatePathColors" />
                                    </div>
                                    <div class="mb-2">
                                        <label class="v-label color-label">{{ $t('GCodeStudio.StitchPoints') }}</label>
                                        <input
                                            v-model="stitchPointColor"
                                            type="color"
                                            class="color-picker"
                                            @change="updatePathColors" />
                                    </div>
                                </v-expansion-panel-content>
                            </v-expansion-panel>

                            <v-expansion-panel v-if="loadedFile">
                                <v-expansion-panel-header>
                                    <v-icon small class="panel-icon">{{ mdiInformation }}</v-icon>
                                    <span class="panel-title">{{ $t('GCodeStudio.DesignInfo') }}</span>
                                </v-expansion-panel-header>
                                <v-expansion-panel-content>
                                    <v-simple-table dense>
                                        <tbody>
                                            <tr>
                                                <td>{{ $t('GCodeStudio.File') }}</td>
                                                <td class="text-right">{{ loadedFile }}</td>
                                            </tr>
                                            <tr v-if="stitchCount > 0">
                                                <td>{{ $t('GCodeStudio.TotalStitches') }}</td>
                                                <td class="text-right">{{ stitchCount }}</td>
                                            </tr>
                                            <tr v-if="jumpCount > 0">
                                                <td>{{ $t('GCodeStudio.JumpStitches') }}</td>
                                                <td class="text-right">{{ jumpCount }}</td>
                                            </tr>
                                            <tr v-if="designWidth > 0">
                                                <td>{{ $t('GCodeStudio.DesignWidth') }}</td>
                                                <td class="text-right">{{ designWidth.toFixed(1) }} mm</td>
                                            </tr>
                                            <tr v-if="designHeight > 0">
                                                <td>{{ $t('GCodeStudio.DesignHeight') }}</td>
                                                <td class="text-right">{{ designHeight.toFixed(1) }} mm</td>
                                            </tr>
                                        </tbody>
                                    </v-simple-table>
                                </v-expansion-panel-content>
                            </v-expansion-panel>
                        </v-expansion-panels>
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
                        <v-btn class="px-2 minwidth-0" color="primary" @click="toggleScrubPlayback">
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

                <v-row class="mt-2 d-flex align-top">
                    <v-col>
                        <v-row>
                            <v-col class="d-flex align-content-space-around justify-center flex-wrap">
                                <template v-if="loadedFile === null">
                                    <v-btn
                                        v-if="sdCardFilePath !== '' && sdCardFilePath !== loadedFile"
                                        class="mr-3"
                                        @click="loadCurrentFile">
                                        {{ $t('GCodeViewer.LoadCurrentFile') }}
                                    </v-btn>
                                    <v-btn class="mr-3" @click="showGcodeFileDialog = true">
                                        {{ $t('GCodeStudio.LoadFile') }}
                                    </v-btn>
                                    <v-btn color="primary" @click="chooseFile">
                                        <v-icon left>{{ mdiFileUpload }}</v-icon>
                                        {{ $t('GCodeViewer.LoadLocal') }}
                                    </v-btn>
                                </template>
                                <template v-else>
                                    <v-btn @click="clearLoadedFile">
                                        <v-icon left>{{ mdiBroom }}</v-icon>
                                        {{ $t('GCodeViewer.ClearLoadedFile') }}
                                    </v-btn>
                                </template>
                            </v-col>
                            <v-col class="col-auto">
                                <v-btn icon @click="showRightPanel = !showRightPanel">
                                    <v-icon>{{ showRightPanel ? mdiChevronRight : mdiChevronLeft }}</v-icon>
                                </v-btn>
                            </v-col>
                        </v-row>
                    </v-col>
                </v-row>

                <input
                    ref="fileInput"
                    :accept="'.g,.gcode,.gc,.gco,.nc,.ngc'"
                    hidden
                    type="file"
                    @change="fileSelected" />
            </v-card-text>
            <resize-observer @notify="handleResize" />
        </panel>
        <v-dialog v-model="showGcodeFileDialog" max-width="520">
            <v-card>
                <v-card-title class="text-h6">
                    {{ $t('GCodeStudio.LoadFile') }}
                </v-card-title>
                <v-card-text>
                    <v-autocomplete
                        v-model="selectedGcodeFile"
                        :items="gcodeFiles"
                        item-text="full_filename"
                        item-value="full_filename"
                        :label="$t('Files.Name')"
                        clearable
                        hide-details
                        dense
                        outlined></v-autocomplete>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="showGcodeFileDialog = false">
                        {{ $t('Files.Cancel') }}
                    </v-btn>
                    <v-btn color="primary" text :disabled="!selectedGcodeFile" @click="loadSelectedGcodeFile">
                        {{ $t('GCodeStudio.LoadFile') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
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
        <v-dialog v-model="showDiscardEditsDialog" persistent :width="400">
            <v-card>
                <v-card-title class="text-h6">
                    {{ $t('GCodeStudio.UnsavedEdits') }}
                </v-card-title>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="discardEdits">
                        {{ $t('GCodeStudio.DiscardEdits') }}
                    </v-btn>
                    <v-btn text color="primary" @click="keepEditedGcode">
                        {{ $t('GCodeStudio.KeepEdited') }}
                    </v-btn>
                    <v-btn text @click="showDiscardEditsDialog = false">
                        {{ $t('GCodeStudio.KeepEditing') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Ref, Watch } from 'vue-property-decorator'
import BaseMixin from '../mixins/base'
import Panel from '@/components/ui/Panel.vue'
import CodemirrorAsync from '@/components/inputs/CodemirrorAsync'
import axios, { AxiosProgressEvent } from 'axios'
import { escapePath, formatFilesize } from '@/plugins/helpers'
import { Debounce } from 'vue-debounce-decorator'
import paper from 'paper'
import gcodeToGeometryUrl from '@/lib/gcode2dviewer/gcodetogeometry.min.js?url'
import { FileStateGcodefile } from '@/store/files/types'
import { needleIcon } from '@/components/icons/needleIcon'
import {
    mdiCameraRetake,
    mdiBroom,
    mdiSquareOutline,
    mdiEye,
    mdiInformation,
    mdiFitToScreen,
    mdiFileUpload,
    mdiChevronLeft,
    mdiChevronRight,
    mdiPalette,
    mdiPlay,
    mdiPause,
    mdiFastForward,
    mdiClose,
    mdiCrosshairsGps,
    mdiArrowExpandAll,
    mdiCursorMove,
    mdiDownload,
    mdiUpload,
    mdiBackupRestore,
    mdiPencil,
    mdiContentSave,
} from '@mdi/js'
import { sha256 } from 'js-sha256'
import { defaultMode, getStitchlabGcodeStudioPalette } from '@/store/variables'

interface FramePreset {
    id: string
    name: string
    width: number
    height: number
}

interface GCodeGeometryPoint {
    x: number
    y: number
    z?: number
}

interface GCodeGeometryBezier {
    p0: GCodeGeometryPoint
    p1: GCodeGeometryPoint
    p2: GCodeGeometryPoint
    p3: GCodeGeometryPoint
}

interface GCodeGeometryLine {
    type: string
    start: GCodeGeometryPoint
    end: GCodeGeometryPoint
    beziers?: GCodeGeometryBezier[]
}

interface GCodeGeometry {
    lines: GCodeGeometryLine[]
    size: {
        min: GCodeGeometryPoint
        max: GCodeGeometryPoint
    }
}

interface GCodeGeometryResult extends GCodeGeometry {
    displayInInch?: boolean
}

interface GCodeToGeometryApi {
    parse: (gcode: string) => GCodeGeometry
}

interface RenderLine {
    line: GCodeGeometryLine
    color: string
    moveIndex: number
}

interface RenderItem {
    item: paper.PathItem
    moveIndex: number
    type: string
    color: string
}

interface downloadSnackbar {
    status: boolean
    filename: string
    percent: number
    speed: number
    total: number
    cancelTokenSource: any
}

declare global {
    interface Window {
        GCodeToGeometry?: GCodeToGeometryApi
    }
}

@Component({
    components: { Panel, CodemirrorAsync },
})
export default class GCodeStudio2D extends Mixins(BaseMixin) {
    mdiNeedle = needleIcon
    mdiCameraRetake = mdiCameraRetake
    mdiBroom = mdiBroom
    mdiSquareOutline = mdiSquareOutline
    mdiEye = mdiEye
    mdiInformation = mdiInformation
    mdiFitToScreen = mdiFitToScreen
    mdiFileUpload = mdiFileUpload
    mdiChevronLeft = mdiChevronLeft
    mdiChevronRight = mdiChevronRight
    mdiPalette = mdiPalette
    mdiPlay = mdiPlay
    mdiPause = mdiPause
    mdiFastForward = mdiFastForward
    mdiClose = mdiClose
    mdiCrosshairsGps = mdiCrosshairsGps
    mdiArrowExpandAll = mdiArrowExpandAll
    mdiCursorMove = mdiCursorMove
    mdiDownload = mdiDownload
    mdiUpload = mdiUpload
    mdiBackupRestore = mdiBackupRestore
    mdiPencil = mdiPencil
    mdiContentSave = mdiContentSave

    formatFilesize = formatFilesize

    loadedFile: string | null = null
    fileData = ''
    stitchCount = 0
    jumpCount = 0
    designWidth = 0
    designHeight = 0
    hasColorChanges = false
    designCenter: GCodeGeometryPoint = { x: 0, y: 0 }
    defaultFeedrate = 1200
    treatG0AsStitch = false
    stitchPointMoveIndices: number[] = []
    playbackPosition: GCodeGeometryPoint | null = null

    cursorX = 0
    cursorY = 0

    showRightPanel = true
    expandedPanels = [0, 1]

    scrubPosition = 0
    scrubPlaying = false
    scrubSpeed = 1
    scrubInterval: ReturnType<typeof setInterval> | undefined = undefined
    scrubFileSize = 0

    stitchColor = getStitchlabGcodeStudioPalette(defaultMode).stitchColors[0]
    travelColor = getStitchlabGcodeStudioPalette(defaultMode).travelColor
    stitchPointColor = getStitchlabGcodeStudioPalette(defaultMode).stitchPointColor

    renderLines: RenderLine[] = []
    renderItems: RenderItem[] = []
    stitchPointItems: Array<{ item: paper.PathItem; moveIndex: number }> = []
    colorChangeItems: Array<{ item: paper.PathItem; moveIndex: number }> = []
    moveOffsets: number[] = []
    colorChangeIndices: number[] = []
    visibleMoveCount = 0

    paperScope: paper.PaperScope | null = null
    layers: {
        grid?: paper.Layer
        frame?: paper.Layer
        path?: paper.Layer
        points?: paper.Layer
        markers?: paper.Layer
    } = {}
    needleMarker: paper.Group | null = null

    downloadSnackbar: downloadSnackbar = {
        status: false,
        filename: '',
        percent: 0,
        speed: 0,
        total: 0,
        cancelTokenSource: {},
    }

    isPanning = false
    lastPanPoint: paper.Point | null = null
    isDraggingDesign = false
    lastDragPoint: paper.Point | null = null
    originalGcode = ''
    boundMouseMove?: (event: MouseEvent) => void
    boundMouseDown?: (event: MouseEvent) => void
    boundMouseUp?: (event: MouseEvent) => void
    boundMouseLeave?: (event: MouseEvent) => void
    boundWheel?: (event: WheelEvent) => void
    boundTouchStart?: (event: TouchEvent) => void
    boundTouchMove?: (event: TouchEvent) => void
    boundTouchEnd?: (event: TouchEvent) => void
    boundKeyDown?: (event: KeyboardEvent) => void
    autoFitRequestId: number | null = null
    resizeAutoFitTimeout: number | null = null
    pendingGcode: string | null = null
    parserReady = false
    showGcodeFileDialog = false
    selectedGcodeFile: string | null = null
    isUploadingRepositioned = false
    isStartingRepositioned = false
    editedGcode = ''
    originalGcodeHash = ''
    isUploadingEdited = false
    isStartingEdited = false
    showDiscardEditsDialog = false
    isSyncingEditor = false

    framePresets: FramePreset[] = [
        { id: '4x4', name: '4" x 4" (100mm)', width: 100, height: 100 },
        { id: '5x7', name: '5" x 7" (127x178mm)', width: 127, height: 178 },
        { id: '6x10', name: '6" x 10" (150x250mm)', width: 150, height: 250 },
        { id: '8x8', name: '8" x 8" (200mm)', width: 200, height: 200 },
        { id: '8x12', name: '8" x 12" (200x300mm)', width: 200, height: 300 },
        { id: 'custom', name: 'Custom', width: 100, height: 100 },
    ]

    @Ref('canvas') declare canvas: HTMLCanvasElement
    @Ref('canvasWrapper') declare canvasWrapper: HTMLDivElement
    @Ref('fileInput') declare fileInput: HTMLInputElement

    get panelTitle() {
        let title = this.$t('GCodeStudio.Title').toString()
        if (this.loadedFile) title += `: ${this.loadedFile}`
        if (this.isEditorDirty) title += ' *'
        return title
    }

    get showScrubber() {
        return this.scrubFileSize > 0
    }

    get canvasCols() {
        if (this.isMobile) return 12
        if (this.isTablet) return 12
        if (this.showGCode && this.showRightPanel) return 6
        if (this.showGCode) return 8
        if (this.showRightPanel) return 9
        return 12
    }

    get gcodeCols() {
        if (this.isMobile) return 12
        if (this.isTablet) return this.showRightPanel ? 6 : 12
        return this.showRightPanel ? 4 : 4
    }

    get settingsCols() {
        if (this.isMobile) return 12
        if (this.isTablet) return this.showGCode ? 6 : 12
        return this.showGCode ? 2 : 3
    }

    get transformFieldCols() {
        if (this.isMobile) return 12
        return this.settingsCols <= 2 ? 12 : 6
    }

    get sdCardFilePath() {
        return this.$store.state.printer.print_stats?.filename ?? ''
    }

    get backgroundColor() {
        if (this.isStitchlabTheme) return this.stitchlabPalette.backgroundColor
        const defaultColor = this.$vuetify.theme.dark ? '#303446' : '#eff1f5'
        return this.$store.state.gui.gcodeStudio?.backgroundColor ?? defaultColor
    }

    get gridColor() {
        if (this.isStitchlabTheme) return this.stitchlabPalette.gridColor
        const defaultColor = this.$vuetify.theme.dark ? '#414559' : '#ccd0da'
        return this.$store.state.gui.gcodeStudio?.gridColor ?? defaultColor
    }

    get frameColor() {
        if (this.isStitchlabTheme) return this.stitchlabPalette.frameColor
        return this.$store.state.gui.gcodeStudio?.frameColor ?? (this.$vuetify.theme.dark ? '#c6a0f6' : '#8839ef')
    }

    get showGrid() {
        return this.$store.state.gui.gcodeStudio?.showGrid ?? true
    }

    set showGrid(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.showGrid', value: newVal })
    }

    get gridSpacing() {
        return this.$store.state.gui.gcodeStudio?.gridSpacing ?? 10
    }

    set gridSpacing(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.gridSpacing', value: newVal })
    }

    get showJumpStitches() {
        return this.$store.state.gui.gcodeStudio?.showJumpStitches ?? true
    }

    set showJumpStitches(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.showJumpStitches', value: newVal })
    }

    get showColorChanges() {
        return this.$store.state.gui.gcodeStudio?.showColorChanges ?? true
    }

    set showColorChanges(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.showColorChanges', value: newVal })
    }

    get showStitchPoints() {
        return this.$store.state.gui.gcodeStudio?.showStitchPoints ?? true
    }

    set showStitchPoints(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.showStitchPoints', value: newVal })
    }

    get showNeedlePosition() {
        return this.$store.state.gui.gcodeStudio?.showNeedlePosition ?? true
    }

    set showNeedlePosition(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.showNeedlePosition', value: newVal })
    }

    get lineWidth() {
        return this.$store.state.gui.gcodeStudio?.lineWidth ?? 0.1
    }

    set lineWidth(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.lineWidth', value: newVal })
    }

    get stitchPointSize() {
        return this.$store.state.gui.gcodeStudio?.stitchPointSize ?? 0.2
    }

    set stitchPointSize(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.stitchPointSize', value: newVal })
    }

    get gcodeFiles(): FileStateGcodefile[] {
        return this.$store.getters['files/getGcodeFiles'](null, false, true) ?? []
    }

    get showGCode(): boolean {
        const value = this.$store.state.gui.gcodeViewer?.showGCode
        if (value === undefined || value === null) return true
        return value
    }

    set showGCode(newVal: boolean) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeViewer.showGCode', value: newVal })
    }

    get showTransformedGcode(): boolean {
        return this.$store.state.gui.gcodeStudio?.showTransformedGcode ?? false
    }

    set showTransformedGcode(newVal: boolean) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.showTransformedGcode', value: newVal })
    }

    get rotationDeg(): number {
        return this.$store.state.gui.gcodeStudio?.rotationDeg ?? 0
    }

    set rotationDeg(newVal: number) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.rotationDeg', value: newVal })
    }

    get rotationPivot(): string {
        return this.$store.state.gui.gcodeStudio?.rotationPivot ?? 'design'
    }

    set rotationPivot(newVal: string) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.rotationPivot', value: newVal })
    }

    get rotationPivotOptions() {
        return [
            { id: 'design', name: this.$t('GCodeStudio.PivotDesignCenter').toString() },
            { id: 'frame', name: this.$t('GCodeStudio.PivotFrameCenter').toString() },
            { id: 'origin', name: this.$t('GCodeStudio.PivotOrigin').toString() },
        ]
    }

    get rotationRad(): number {
        return (this.rotationDeg || 0) * (Math.PI / 180)
    }

    get rotationPivotPoint(): GCodeGeometryPoint {
        if (this.rotationPivot === 'frame') {
            return { x: this.frameWidth / 2, y: this.frameHeight / 2 }
        }
        if (this.rotationPivot === 'origin') {
            return { x: 0, y: 0 }
        }
        return this.designCenter ?? { x: 0, y: 0 }
    }

    get normalizedRotationDeg(): number {
        const normalized = (((this.rotationDeg || 0) % 360) + 360) % 360
        return normalized
    }

    get hasRotation(): boolean {
        return this.normalizedRotationDeg !== 0
    }

    get hasTransform(): boolean {
        return this.hasOffset || this.hasRotation
    }

    get normalizedOriginalGcode(): string {
        return this.originalGcode || ''
    }

    get gcodePanelDocument(): string {
        if (!this.originalGcode) return ''
        if (this.editMode) return this.editedGcode || this.normalizedOriginalGcode
        if (this.showTransformedGcode && this.hasTransform) {
            return this.transformGcode()
        }
        return this.normalizedOriginalGcode
    }

    get gcodeEditorModeClass(): string {
        if (this.editMode) return 'gcode-editor--edit'
        if (this.showTransformedGcode && this.hasTransform) return 'gcode-editor--transformed'
        return 'gcode-editor--source'
    }

    get gcodeViewerModeClass(): string {
        if (this.editMode) return 'viewer--edit'
        if (this.showTransformedGcode && this.hasTransform) return 'viewer--transformed'
        return 'viewer--source'
    }

    get originalLineBreakOffsets(): number[] {
        return this.getLineBreakOffsets(this.normalizedOriginalGcode)
    }

    get panelLineBreakOffsets(): number[] {
        return this.getLineBreakOffsets(this.gcodePanelDocument)
    }

    get gcodePanelPosition(): number {
        if (this.editMode) return this.scrubPosition
        if (!this.showTransformedGcode || !this.hasTransform) return this.scrubPosition
        if (!this.originalLineBreakOffsets.length || !this.panelLineBreakOffsets.length) return this.scrubPosition
        const lineIndex = this.getLineIndexForOffset(this.scrubPosition, this.originalLineBreakOffsets)
        return (
            this.panelLineBreakOffsets[Math.min(lineIndex, this.panelLineBreakOffsets.length - 1)] ?? this.scrubPosition
        )
    }

    set gcodePanelPosition(newOffset: number) {
        if (this.editMode) {
            this.scrubPosition = newOffset
            return
        }
        if (!this.showTransformedGcode || !this.hasTransform) {
            this.scrubPosition = newOffset
            return
        }
        if (!this.originalLineBreakOffsets.length || !this.panelLineBreakOffsets.length) {
            this.scrubPosition = newOffset
            return
        }
        const lineIndex = this.getLineIndexForOffset(newOffset, this.panelLineBreakOffsets)
        const mappedOffset =
            this.originalLineBreakOffsets[Math.min(lineIndex, this.originalLineBreakOffsets.length - 1)]
        this.scrubPosition = mappedOffset ?? newOffset
    }

    get showFrameBorder() {
        return this.$store.state.gui.gcodeStudio?.showFrameBorder ?? true
    }

    set showFrameBorder(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.showFrameBorder', value: newVal })
    }

    get frameWidth() {
        return this.$store.state.gui.gcodeStudio?.frameWidth ?? 100
    }

    set frameWidth(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.frameWidth', value: newVal })
    }

    get frameHeight() {
        return this.$store.state.gui.gcodeStudio?.frameHeight ?? 100
    }

    set frameHeight(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.frameHeight', value: newVal })
    }

    get selectedFramePreset() {
        return this.$store.state.gui.gcodeStudio?.framePreset ?? '4x4'
    }

    set selectedFramePreset(newVal) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.framePreset', value: newVal })
    }

    get designOffsetX(): number {
        return this.$store.state.gui.gcodeStudio?.designOffsetX ?? 0
    }

    set designOffsetX(newVal: number) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.designOffsetX', value: newVal })
    }

    get designOffsetY(): number {
        return this.$store.state.gui.gcodeStudio?.designOffsetY ?? 0
    }

    set designOffsetY(newVal: number) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.designOffsetY', value: newVal })
    }

    get moveMode(): boolean {
        return this.$store.state.gui.gcodeStudio?.moveMode ?? false
    }

    set moveMode(newVal: boolean) {
        if (this.editMode) return
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.moveMode', value: newVal })
    }

    get editMode(): boolean {
        return this.$store.state.gui.gcodeStudio?.editMode ?? false
    }

    set editMode(newVal: boolean) {
        this.$store.dispatch('gui/saveSetting', { name: 'gcodeStudio.editMode', value: newVal })
    }

    get isEditorDirty(): boolean {
        if (!this.editMode || !this.originalGcodeHash) return false
        return sha256(this.editedGcode) !== this.originalGcodeHash
    }

    get editedActionBusy(): boolean {
        return this.isUploadingEdited || this.isStartingEdited
    }

    get hasOffset(): boolean {
        return this.designOffsetX !== 0 || this.designOffsetY !== 0
    }

    get canExportRepositioned(): boolean {
        return Boolean(this.loadedFile) && this.hasTransform
    }

    get repositionedActionBusy(): boolean {
        return this.isUploadingRepositioned || this.isStartingRepositioned
    }

    get livePosition() {
        return this.$store.state.printer.motion_report?.live_position ?? [0, 0, 0, 0]
    }

    get gcodeOffset() {
        return this.$store.state.printer?.gcode_move?.homing_origin ?? [0, 0, 0]
    }

    get currentPosition() {
        return [this.livePosition[0] - this.gcodeOffset[0], this.livePosition[1] - this.gcodeOffset[1]]
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

    mounted(): void {
        if (this.isStitchlabTheme) {
            this.applyThemePreviewColors()
        } else {
            this.stitchColor = this.$store.state.gui.gcodeStudio?.stitchColors?.[0] ?? this.stitchColor
        }
        this.$store.dispatch('files/initRootDirs', ['gcodes'])
        this.bindKeyboardEvents()
        this.loadLibraryScripts().then(() => {
            this.$nextTick(() => {
                this.initPaper()
                this.handleResize()
                if (this.pendingGcode) {
                    const gcode = this.pendingGcode
                    this.pendingGcode = null
                    this.loadGcode(gcode)
                }
            })
        })
    }

    beforeDestroy(): void {
        if (this.scrubInterval) clearInterval(this.scrubInterval)
        if (this.autoFitRequestId !== null) cancelAnimationFrame(this.autoFitRequestId)
        if (this.resizeAutoFitTimeout !== null) clearTimeout(this.resizeAutoFitTimeout)
        this.unbindKeyboardEvents()
        this.unbindCanvasEvents()
        this.paperScope?.project?.clear()
    }

    loadLibraryScripts(): Promise<void> {
        return new Promise((resolve) => {
            if (this.parserReady || (window as any).GCodeToGeometry) {
                this.parserReady = true
                resolve()
                return
            }

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

    initPaper(): void {
        if (!this.canvas) return

        this.paperScope = new paper.PaperScope()
        this.paperScope.setup(this.canvas)
        this.paperScope.view.center = new this.paperScope.Point(0, 0)

        this.layers.grid = new this.paperScope.Layer({ name: 'grid' })
        this.layers.frame = new this.paperScope.Layer({ name: 'frame' })
        this.layers.path = new this.paperScope.Layer({ name: 'path' })
        this.layers.points = new this.paperScope.Layer({ name: 'points' })
        this.layers.markers = new this.paperScope.Layer({ name: 'markers' })

        this.bindCanvasEvents()
    }

    @Debounce(200)
    handleResize(): void {
        if (!this.canvas || !this.canvasWrapper || !this.paperScope) return

        const rect = this.canvasWrapper.getBoundingClientRect()
        this.canvas.width = Math.max(rect.width || 600, 300)
        this.canvas.height = Math.max(rect.height || 400, 300)
        this.paperScope.view.viewSize = new this.paperScope.Size(this.canvas.width, this.canvas.height)

        this.renderGrid()
        this.renderFrame()
        this.updateNeedleMarker()
        this.scheduleResizeAutoFit()
    }

    bindCanvasEvents(): void {
        if (!this.canvas || !this.paperScope) return

        this.boundMouseMove = (event: MouseEvent) => this.handleMouseMove(event)
        this.boundMouseDown = (event: MouseEvent) => this.handleMouseDown(event)
        this.boundMouseUp = (event: MouseEvent) => this.handleMouseUp(event)
        this.boundMouseLeave = (event: MouseEvent) => this.handleMouseLeave(event)
        this.boundWheel = (event: WheelEvent) => this.handleWheel(event)

        this.canvas.addEventListener('mousemove', this.boundMouseMove)
        this.canvas.addEventListener('mousedown', this.boundMouseDown)
        this.canvas.addEventListener('mouseup', this.boundMouseUp)
        this.canvas.addEventListener('mouseleave', this.boundMouseLeave)
        this.canvas.addEventListener('wheel', this.boundWheel, { passive: false })

        this.boundTouchStart = (event: TouchEvent) => this.handleTouchStart(event)
        this.boundTouchMove = (event: TouchEvent) => this.handleTouchMove(event)
        this.boundTouchEnd = () => this.handleTouchEnd()

        this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false })
        this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false })
        this.canvas.addEventListener('touchend', this.boundTouchEnd)
    }

    unbindCanvasEvents(): void {
        if (!this.canvas) return

        if (this.boundMouseMove) this.canvas.removeEventListener('mousemove', this.boundMouseMove)
        if (this.boundMouseDown) this.canvas.removeEventListener('mousedown', this.boundMouseDown)
        if (this.boundMouseUp) this.canvas.removeEventListener('mouseup', this.boundMouseUp)
        if (this.boundMouseLeave) this.canvas.removeEventListener('mouseleave', this.boundMouseLeave)
        if (this.boundWheel) this.canvas.removeEventListener('wheel', this.boundWheel)
        if (this.boundTouchStart) this.canvas.removeEventListener('touchstart', this.boundTouchStart)
        if (this.boundTouchMove) this.canvas.removeEventListener('touchmove', this.boundTouchMove)
        if (this.boundTouchEnd) this.canvas.removeEventListener('touchend', this.boundTouchEnd)
    }

    bindKeyboardEvents(): void {
        if (this.boundKeyDown) return
        this.boundKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event)
        window.addEventListener('keydown', this.boundKeyDown)
    }

    unbindKeyboardEvents(): void {
        if (!this.boundKeyDown) return
        window.removeEventListener('keydown', this.boundKeyDown)
        this.boundKeyDown = undefined
    }

    handleKeyDown(event: KeyboardEvent): void {
        if (event.defaultPrevented) return
        if (this.scrubPlaying || !this.showScrubber || !this.renderLines.length) return
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        if (this.isEditableTarget(event.target)) return

        const delta = event.key === 'ArrowRight' ? 1 : -1
        this.stepScrubByMove(delta)
        event.preventDefault()
    }

    isEditableTarget(target: EventTarget | null): boolean {
        const element = target as HTMLElement | null
        if (!element) return false
        const tagName = element.tagName?.toUpperCase()
        if (!tagName) return false
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true
        return element.isContentEditable === true
    }

    handleMouseMove(event: MouseEvent): void {
        if (!this.paperScope) return

        const point = this.paperScope.view.viewToProject(new this.paperScope.Point(event.offsetX, event.offsetY))
        const halfW = (this.frameWidth || this.designWidth || 0) / 2
        const halfH = (this.frameHeight || this.designHeight || 0) / 2
        const machinePoint = { x: point.x + halfW, y: -point.y + halfH }
        const originalPoint = this.reverseDesignTransform(machinePoint)
        this.cursorX = originalPoint.x
        this.cursorY = originalPoint.y

        if (this.isDraggingDesign && this.lastDragPoint && this.loadedFile) {
            const delta = point.subtract(this.lastDragPoint)
            this.designOffsetX += delta.x
            this.designOffsetY -= delta.y
            this.lastDragPoint = point
            this.updateDesignPosition()
        } else if (this.isPanning && this.lastPanPoint) {
            const delta = point.subtract(this.lastPanPoint)
            this.paperScope.view.center = this.paperScope.view.center.subtract(delta)
            this.lastPanPoint = point
        }
    }

    handleMouseDown(event: MouseEvent): void {
        if (!this.paperScope) return
        if (event.button !== 0) return

        const point = this.paperScope.view.viewToProject(new this.paperScope.Point(event.offsetX, event.offsetY))

        if (this.moveMode && this.loadedFile) {
            this.isDraggingDesign = true
            this.lastDragPoint = point
        } else {
            this.isPanning = true
            this.lastPanPoint = point
        }
    }

    handleMouseUp(): void {
        this.isPanning = false
        this.lastPanPoint = null
        this.isDraggingDesign = false
        this.lastDragPoint = null
    }

    handleMouseLeave(): void {
        this.isPanning = false
        this.lastPanPoint = null
        this.isDraggingDesign = false
        this.lastDragPoint = null
    }

    getTouchCanvasOffset(touch: Touch): { offsetX: number; offsetY: number } {
        const rect = this.canvas.getBoundingClientRect()
        return {
            offsetX: touch.clientX - rect.left,
            offsetY: touch.clientY - rect.top,
        }
    }

    handleTouchStart(event: TouchEvent): void {
        if (!this.paperScope || event.touches.length !== 1) return
        event.preventDefault()

        const { offsetX, offsetY } = this.getTouchCanvasOffset(event.touches[0])
        const point = this.paperScope.view.viewToProject(new this.paperScope.Point(offsetX, offsetY))

        if (this.moveMode && this.loadedFile) {
            this.isDraggingDesign = true
            this.lastDragPoint = point
        } else {
            this.isPanning = true
            this.lastPanPoint = point
        }
    }

    handleTouchMove(event: TouchEvent): void {
        if (!this.paperScope || event.touches.length !== 1) return
        event.preventDefault()

        const { offsetX, offsetY } = this.getTouchCanvasOffset(event.touches[0])
        const point = this.paperScope.view.viewToProject(new this.paperScope.Point(offsetX, offsetY))

        if (this.isDraggingDesign && this.lastDragPoint && this.loadedFile) {
            const delta = point.subtract(this.lastDragPoint)
            this.designOffsetX += delta.x
            this.designOffsetY -= delta.y
            this.lastDragPoint = point
            this.updateDesignPosition()
        } else if (this.isPanning && this.lastPanPoint) {
            const delta = point.subtract(this.lastPanPoint)
            this.paperScope.view.center = this.paperScope.view.center.subtract(delta)
            this.lastPanPoint = point
        }
    }

    handleTouchEnd(): void {
        this.isPanning = false
        this.lastPanPoint = null
        this.isDraggingDesign = false
        this.lastDragPoint = null
    }

    handleWheel(event: WheelEvent): void {
        if (!this.paperScope) return

        event.preventDefault()

        const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9
        const view = this.paperScope.view
        const mousePoint = new this.paperScope.Point(event.offsetX, event.offsetY)
        const before = view.viewToProject(mousePoint)

        view.zoom = Math.min(Math.max(view.zoom * zoomFactor, 0.1), 50)

        const after = view.viewToProject(mousePoint)
        const offset = before.subtract(after)
        view.center = view.center.add(offset)
    }

    toPoint(point: GCodeGeometryPoint): paper.Point {
        if (!this.paperScope) return new paper.Point(point.x, -point.y)
        return new this.paperScope.Point(point.x, -point.y)
    }

    toDesignPoint(point: GCodeGeometryPoint): paper.Point {
        const halfW = (this.frameWidth || this.designWidth || 0) / 2
        const halfH = (this.frameHeight || this.designHeight || 0) / 2
        const transformed = this.applyDesignTransform(point)
        const x = -halfW + transformed.x
        const y = -halfH + transformed.y
        if (!this.paperScope) return new paper.Point(x, -y)
        return new this.paperScope.Point(x, -y)
    }

    rotatePoint(point: GCodeGeometryPoint, pivot: GCodeGeometryPoint, angleRad: number): GCodeGeometryPoint {
        const cos = Math.cos(angleRad)
        const sin = Math.sin(angleRad)
        const dx = point.x - pivot.x
        const dy = point.y - pivot.y
        return {
            x: pivot.x + dx * cos - dy * sin,
            y: pivot.y + dx * sin + dy * cos,
        }
    }

    rotateVector(x: number, y: number, angleRad: number): { x: number; y: number } {
        const cos = Math.cos(angleRad)
        const sin = Math.sin(angleRad)
        return {
            x: x * cos - y * sin,
            y: x * sin + y * cos,
        }
    }

    applyDesignTransform(point: GCodeGeometryPoint): GCodeGeometryPoint {
        let x = point.x
        let y = point.y
        if (this.hasRotation) {
            const rotated = this.rotatePoint({ x, y }, this.rotationPivotPoint, this.rotationRad)
            x = rotated.x
            y = rotated.y
        }
        return {
            x: x + this.designOffsetX,
            y: y + this.designOffsetY,
        }
    }

    reverseDesignTransform(point: GCodeGeometryPoint): GCodeGeometryPoint {
        let x = point.x - this.designOffsetX
        let y = point.y - this.designOffsetY
        if (this.hasRotation) {
            const rotated = this.rotatePoint({ x, y }, this.rotationPivotPoint, -this.rotationRad)
            x = rotated.x
            y = rotated.y
        }
        return { x, y }
    }

    applyFramePreset(): void {
        const preset = this.framePresets.find((p) => p.id === this.selectedFramePreset)
        if (preset && preset.id !== 'custom') {
            this.frameWidth = preset.width
            this.frameHeight = preset.height
            this.renderFrame()
            this.fitToFrame()
        }
    }

    renderGrid(): void {
        if (!this.paperScope || !this.layers.grid) return
        this.layers.grid.removeChildren()
        this.layers.grid.visible = this.showGrid
        if (!this.showGrid) return

        this.layers.grid.activate()
        const halfW = this.frameWidth / 2
        const halfH = this.frameHeight / 2
        const spacing = Math.max(this.gridSpacing, 1)

        for (let x = -halfW; x <= halfW; x += spacing) {
            const line = new this.paperScope.Path.Line(this.toPoint({ x, y: -halfH }), this.toPoint({ x, y: halfH }))
            line.strokeColor = new this.paperScope.Color(this.gridColor)
            line.strokeWidth = 0.35
        }

        for (let y = -halfH; y <= halfH; y += spacing) {
            const line = new this.paperScope.Path.Line(this.toPoint({ x: -halfW, y }), this.toPoint({ x: halfW, y }))
            line.strokeColor = new this.paperScope.Color(this.gridColor)
            line.strokeWidth = 0.35
        }
    }

    renderFrame(): void {
        if (!this.paperScope || !this.layers.frame) return
        this.layers.frame.removeChildren()
        this.layers.frame.visible = this.showFrameBorder
        if (!this.showFrameBorder) return

        this.layers.frame.activate()
        const halfW = this.frameWidth / 2
        const halfH = this.frameHeight / 2
        const rect = new this.paperScope.Path.Rectangle(
            this.toPoint({ x: -halfW, y: -halfH }),
            this.toPoint({ x: halfW, y: halfH })
        )
        rect.strokeColor = new this.paperScope.Color(this.frameColor)
        rect.strokeWidth = 0.75
        rect.dashArray = [3, 2]
        rect.fillColor = null
    }

    renderFrameAndGrid(): void {
        this.renderFrame()
        this.renderGrid()
    }

    centerDesignInFrame(): void {
        const halfW = (this.frameWidth || this.designWidth || 0) / 2
        const halfH = (this.frameHeight || this.designHeight || 0) / 2
        this.designOffsetX = halfW - this.designCenter.x
        this.designOffsetY = halfH - this.designCenter.y
        this.updateDesignPosition()
    }

    @Debounce(50)
    updateDesignPosition(): void {
        this.buildPathItems()
        this.renderStitchPoints()
        this.renderColorChanges()
        this.updateItemVisibility()
        this.updateNeedleMarker()
    }

    resetOffsets(): void {
        this.designOffsetX = 0
        this.designOffsetY = 0
        this.updateDesignPosition()
    }

    parseGcodeNumber(value: string): number {
        return parseFloat(value.replace(',', '.'))
    }

    formatAxisValue(value: number): string {
        return value.toFixed(3)
    }

    getCommentInsertIndex(line: string): number {
        const semicolonIndex = line.indexOf(';')
        const parenIndex = line.indexOf('(')
        let insertIndex = -1

        if (semicolonIndex >= 0) insertIndex = semicolonIndex
        if (parenIndex >= 0) insertIndex = insertIndex === -1 ? parenIndex : Math.min(insertIndex, parenIndex)

        return insertIndex
    }

    replaceAxisValue(line: string, axis: string, value: number, forceInsert: boolean): string {
        const axisRegex = new RegExp(`\\b${axis}([-+]?\\d*\\.?\\d+)`, 'i')
        const insertIndex = this.getCommentInsertIndex(line)
        const head = insertIndex === -1 ? line : line.slice(0, insertIndex)
        const tail = insertIndex === -1 ? '' : line.slice(insertIndex)

        if (axisRegex.test(head)) {
            const updatedHead = head.replace(axisRegex, `${axis}${this.formatAxisValue(value)}`)
            return insertIndex === -1 ? updatedHead : `${updatedHead}${tail}`
        }

        if (!forceInsert) return line

        const token = `${axis}${this.formatAxisValue(value)}`
        const updatedHead = `${head.trimEnd()} ${token}`
        return insertIndex === -1 ? updatedHead.trim() : `${updatedHead}${tail}`
    }

    transformGcode(): string {
        if (!this.originalGcode) return ''
        if (!this.hasTransform) {
            return this.originalGcode
        }

        const lines = this.normalizeLineEndings(this.originalGcode).split('\n')
        const angle = this.rotationRad
        const hasRotation = this.hasRotation
        let lastX = 0
        let lastY = 0

        const transformedLines = lines.map((line) => {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('(')) {
                return line
            }

            const commentIndex = this.getCommentInsertIndex(line)
            const codePart = commentIndex === -1 ? line : line.slice(0, commentIndex)
            const xMatch = codePart.match(/\bX([-+]?\d*\.?\d+)/i)
            const yMatch = codePart.match(/\bY([-+]?\d*\.?\d+)/i)
            const iMatch = codePart.match(/\bI([-+]?\d*\.?\d+)/i)
            const jMatch = codePart.match(/\bJ([-+]?\d*\.?\d+)/i)
            const hasX = !!xMatch
            const hasY = !!yMatch
            const hasI = !!iMatch
            const hasJ = !!jMatch

            if (!hasX && !hasY) {
                if (hasRotation && (hasI || hasJ)) {
                    const iVal = hasI ? this.parseGcodeNumber(iMatch![1]) : 0
                    const jVal = hasJ ? this.parseGcodeNumber(jMatch![1]) : 0
                    const rotated = this.rotateVector(iVal, jVal, angle)
                    let transformedLine = line
                    if (hasI) transformedLine = this.replaceAxisValue(transformedLine, 'I', rotated.x, false)
                    if (hasJ) transformedLine = this.replaceAxisValue(transformedLine, 'J', rotated.y, false)
                    return transformedLine
                }
                return line
            }

            const xVal = hasX ? this.parseGcodeNumber(xMatch![1]) : lastX
            const yVal = hasY ? this.parseGcodeNumber(yMatch![1]) : lastY
            if (hasX) lastX = xVal
            if (hasY) lastY = yVal

            const transformedPoint = this.applyDesignTransform({ x: xVal, y: yVal })
            const forceInsert = hasRotation
            let transformedLine = line
            transformedLine = this.replaceAxisValue(transformedLine, 'X', transformedPoint.x, forceInsert)
            transformedLine = this.replaceAxisValue(transformedLine, 'Y', transformedPoint.y, forceInsert)

            if (hasRotation && (hasI || hasJ)) {
                const iVal = hasI ? this.parseGcodeNumber(iMatch![1]) : 0
                const jVal = hasJ ? this.parseGcodeNumber(jMatch![1]) : 0
                const rotated = this.rotateVector(iVal, jVal, angle)
                if (hasI) transformedLine = this.replaceAxisValue(transformedLine, 'I', rotated.x, false)
                if (hasJ) transformedLine = this.replaceAxisValue(transformedLine, 'J', rotated.y, false)
            }

            return transformedLine
        })

        return transformedLines.join('\n')
    }

    exportTransformedGcode(): void {
        if (!this.canExportRepositioned || this.repositionedActionBusy) return
        const transformed = this.transformGcode()
        const filename = this.getRepositionedFilename()

        const blob = new Blob([transformed], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)
    }

    getRepositionedFilename(): string {
        const loadedFile = (this.loadedFile ?? '').replace(/^\//, '').replace(/^gcodes\//i, '')
        const baseName = loadedFile.split('/').pop() || ''
        if (!baseName) return 'repositioned.gcode'
        return `${baseName.replace(/\.g(code)?$/i, '')}_repositioned.gcode`
    }

    getRepositionedPath(): string {
        const loadedFile = (this.loadedFile ?? '').replace(/^\//, '').replace(/^gcodes\//i, '')
        if (!loadedFile.includes('/')) return ''
        const parts = loadedFile.split('/')
        return parts.slice(0, -1).join('/')
    }

    async uploadTransformedGcode(): Promise<void> {
        if (!this.canExportRepositioned || this.repositionedActionBusy) return
        this.isUploadingRepositioned = true
        try {
            const transformed = this.transformGcode()
            const filename = this.getRepositionedFilename()
            const path = this.getRepositionedPath()
            const file = new File([transformed], filename, { type: 'text/plain' })

            const result = await this.$store.dispatch('files/uploadFile', {
                file,
                path,
                root: 'gcodes',
            })

            if (result !== false) {
                this.$toast.success(this.$t('Files.SuccessfullyUploaded', { filename: result }).toString())
            }
        } finally {
            this.isUploadingRepositioned = false
        }
    }

    async uploadAndStartTransformedGcode(): Promise<void> {
        if (!this.canExportRepositioned || this.repositionedActionBusy) return
        if (!this.klipperReadyForGui || this.printerIsPrinting) return
        this.isStartingRepositioned = true
        try {
            const transformed = this.transformGcode()
            const filename = this.getRepositionedFilename()
            const path = this.getRepositionedPath()
            const file = new File([transformed], filename, { type: 'text/plain' })

            const result = await this.$store.dispatch('files/uploadFile', {
                file,
                path,
                root: 'gcodes',
            })

            if (result !== false) {
                const startPath = path ? `${path}/${result}` : result
                this.$socket.emit('printer.print.start', { filename: startPath }, { action: 'switchToDashboard' })
            }
        } finally {
            this.isStartingRepositioned = false
        }
    }

    toggleEditMode(): void {
        if (this.editMode) {
            if (this.isEditorDirty) {
                this.showDiscardEditsDialog = true
                return
            }
            this.exitEditMode()
        } else {
            this.enterEditMode()
        }
    }

    enterEditMode(): void {
        this.editedGcode = this.originalGcode
        this.originalGcodeHash = sha256(this.originalGcode)
        if (this.moveMode) this.moveMode = false
        this.editMode = true
    }

    exitEditMode(): void {
        this.editMode = false
        this.editedGcode = ''
        this.originalGcodeHash = ''
        this.showDiscardEditsDialog = false
    }

    discardEdits(): void {
        this.loadGcode(this.originalGcode)
        this.exitEditMode()
    }

    keepEditedGcode(): void {
        this.originalGcode = this.editedGcode
        this.showDiscardEditsDialog = false
        this.exitEditMode()
    }

    onEditorInput(newContent: string): void {
        if (!this.editMode) return
        if (newContent === this.editedGcode) return
        this.editedGcode = newContent
        this.debouncedReparse(newContent)
    }

    @Debounce(400)
    debouncedReparse(gcode: string): void {
        this.originalGcode = gcode
        this.scrubFileSize = gcode.length
        this.scrubPosition = Math.min(this.scrubPosition, this.scrubFileSize)

        const parsed = this.parseGcode(gcode)
        if (!parsed) {
            this.renderLines = []
            this.renderItems = []
            this.stitchPointItems = []
            this.colorChangeItems = []
            this.visibleMoveCount = 0
            this.treatG0AsStitch = false
            this.stitchPointMoveIndices = []
            this.playbackPosition = null
            this.layers.path?.removeChildren()
            this.layers.points?.removeChildren()
            this.layers.markers?.removeChildren()
            return
        }

        this.renderLines = parsed.renderLines
        this.moveOffsets = parsed.moveOffsets
        this.colorChangeIndices = parsed.colorChangeIndices
        this.hasColorChanges = parsed.hasColorChanges
        this.stitchCount = parsed.stitchCount
        this.jumpCount = parsed.jumpCount
        this.designWidth = parsed.designWidth
        this.designHeight = parsed.designHeight
        this.designCenter = parsed.designCenter
        this.treatG0AsStitch = parsed.treatG0AsStitch
        this.stitchPointMoveIndices = parsed.stitchPointMoveIndices
        this.visibleMoveCount = this.renderLines.length

        this.buildPathItems()
        this.renderStitchPoints()
        this.renderColorChanges()
        this.updatePlaybackPosition()
        this.updateNeedleMarker()
        this.updateItemVisibility()
        this.paperScope?.view?.update()
    }

    onEditorLineChange(lineNumber: number): void {
        if (this.isSyncingEditor) return
        if (!this.panelLineBreakOffsets.length || !lineNumber) return
        const clampedLine = Math.min(lineNumber - 1, this.panelLineBreakOffsets.length - 1)
        if (clampedLine < 0) return
        const byteOffset = this.panelLineBreakOffsets[clampedLine]
        this.gcodePanelPosition = byteOffset
    }

    getEditedFilename(): string {
        const loadedFile = (this.loadedFile ?? '').replace(/^\//, '').replace(/^gcodes\//i, '')
        const baseName = loadedFile.split('/').pop() || ''
        if (!baseName) return 'edited.gcode'
        return `${baseName.replace(/\.g(code)?$/i, '')}_edited.gcode`
    }

    getEditedPath(): string {
        const loadedFile = (this.loadedFile ?? '').replace(/^\//, '').replace(/^gcodes\//i, '')
        if (!loadedFile.includes('/')) return ''
        const parts = loadedFile.split('/')
        return parts.slice(0, -1).join('/')
    }

    exportEditedGcode(): void {
        if (!this.isEditorDirty || this.editedActionBusy) return
        const blob = new Blob([this.editedGcode], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = this.getEditedFilename()
        link.click()
        URL.revokeObjectURL(url)
    }

    async uploadEditedGcode(): Promise<void> {
        if (!this.isEditorDirty || this.editedActionBusy) return
        this.isUploadingEdited = true
        try {
            const filename = this.getEditedFilename()
            const path = this.getEditedPath()
            const file = new File([this.editedGcode], filename, { type: 'text/plain' })

            const result = await this.$store.dispatch('files/uploadFile', {
                file,
                path,
                root: 'gcodes',
            })

            if (result !== false) {
                this.$toast.success(this.$t('Files.SuccessfullyUploaded', { filename: result }).toString())
                this.originalGcodeHash = sha256(this.editedGcode)
            }
        } finally {
            this.isUploadingEdited = false
        }
    }

    async uploadAndStartEditedGcode(): Promise<void> {
        if (!this.isEditorDirty || this.editedActionBusy) return
        if (!this.klipperReadyForGui || this.printerIsPrinting) return
        this.isStartingEdited = true
        try {
            const filename = this.getEditedFilename()
            const path = this.getEditedPath()
            const file = new File([this.editedGcode], filename, { type: 'text/plain' })

            const result = await this.$store.dispatch('files/uploadFile', {
                file,
                path,
                root: 'gcodes',
            })

            if (result !== false) {
                const startPath = path ? `${path}/${result}` : result
                this.$socket.emit('printer.print.start', { filename: startPath }, { action: 'switchToDashboard' })
            }
        } finally {
            this.isStartingEdited = false
        }
    }

    updatePathColors(): void {
        if (!this.paperScope) return

        this.renderItems.forEach((item) => {
            const isTravel = item.type === 'G0' && !this.treatG0AsStitch
            if (isTravel) {
                item.item.strokeColor = new this.paperScope!.Color(this.travelColor)
                return
            }

            if (!this.hasColorChanges) {
                item.item.strokeColor = new this.paperScope!.Color(this.stitchColor)
            }
        })

        this.stitchPointItems.forEach((point) => {
            point.item.fillColor = new this.paperScope!.Color(this.stitchPointColor)
        })
    }

    applyThemePreviewColors(previousMode?: 'dark' | 'light'): void {
        if (!this.isStitchlabTheme) return

        const palette = this.stitchlabPalette
        if (!previousMode) {
            this.stitchColor = palette.stitchColors[0]
            this.travelColor = palette.travelColor
            this.stitchPointColor = palette.stitchPointColor
            return
        }

        const previousPalette = getStitchlabGcodeStudioPalette(previousMode)
        if (this.sameColor(this.stitchColor, previousPalette.stitchColors[0])) {
            this.stitchColor = palette.stitchColors[0]
        }
        if (this.sameColor(this.travelColor, previousPalette.travelColor)) {
            this.travelColor = palette.travelColor
        }
        if (this.sameColor(this.stitchPointColor, previousPalette.stitchPointColor)) {
            this.stitchPointColor = palette.stitchPointColor
        }
    }

    sameColor(first: string | null | undefined, second: string | null | undefined): boolean {
        return (first ?? '').trim().toLowerCase() === (second ?? '').trim().toLowerCase()
    }

    renderStitchPoints(): void {
        if (!this.paperScope || !this.layers.points) return

        this.layers.points.removeChildren()
        this.stitchPointItems = []
        this.layers.points.visible = this.showStitchPoints && this.stitchPointMoveIndices.length > 0

        if (!this.showStitchPoints) return
        if (this.renderLines.length > 15000) return
        if (!this.stitchPointMoveIndices.length) return

        this.layers.points.activate()
        // Treat the control value as visible dot size (diameter), not radius.
        const radius = Math.max(Number(this.stitchPointSize) || 0, 0.1) / 2
        const allowedMoves = new Set(this.stitchPointMoveIndices)
        this.renderLines.forEach((renderLine) => {
            if (!allowedMoves.has(renderLine.moveIndex)) return
            const circle = new this.paperScope!.Path.Circle(this.toDesignPoint(renderLine.line.end), radius)
            circle.fillColor = new this.paperScope!.Color(this.stitchPointColor)
            circle.strokeColor = null
            this.stitchPointItems.push({ item: circle, moveIndex: renderLine.moveIndex })
        })

        this.updateItemVisibility()
    }

    renderColorChanges(): void {
        if (!this.paperScope || !this.layers.markers) return

        this.colorChangeItems.forEach((marker) => marker.item.remove())
        this.colorChangeItems = []

        if (!this.showColorChanges || !this.hasColorChanges) return

        this.layers.markers.activate()
        this.colorChangeIndices.forEach((index) => {
            const line = this.renderLines[index]
            if (!line) return
            const point = this.toDesignPoint(line.line.start)
            const marker = new this.paperScope!.Path.Circle(point, 1.2)
            marker.fillColor = new this.paperScope!.Color(line.color)
            marker.strokeColor = new this.paperScope!.Color(this.$vuetify.theme.dark ? '#232634' : '#dce0e8')
            marker.strokeWidth = 0.2
            this.colorChangeItems.push({ item: marker, moveIndex: index })
        })

        this.updateItemVisibility()
    }

    updatePlaybackPosition(): void {
        if (!this.renderLines.length || this.visibleMoveCount <= 0) {
            this.playbackPosition = null
            return
        }

        const index = Math.min(this.visibleMoveCount, this.renderLines.length) - 1
        const line = this.renderLines[index]?.line
        if (!line) {
            this.playbackPosition = null
            return
        }

        this.playbackPosition = {
            x: line.end.x,
            y: line.end.y,
            z: line.end.z,
        }
    }

    updateNeedleMarker(): void {
        if (!this.paperScope || !this.layers.markers) return

        if (this.needleMarker) {
            this.needleMarker.remove()
            this.needleMarker = null
        }

        if (!this.showNeedlePosition) return

        this.layers.markers.activate()
        const playback = this.showScrubber ? this.playbackPosition : null
        const [x, y] = playback ? [playback.x, playback.y] : this.currentPosition
        const center = this.toDesignPoint({ x, y })
        const size = 2
        const horizontal = new this.paperScope!.Path.Line(
            new this.paperScope!.Point(center.x - size, center.y),
            new this.paperScope!.Point(center.x + size, center.y)
        )
        const vertical = new this.paperScope!.Path.Line(
            new this.paperScope!.Point(center.x, center.y - size),
            new this.paperScope!.Point(center.x, center.y + size)
        )

        horizontal.strokeColor = new this.paperScope!.Color(this.$vuetify.theme.dark ? '#c6d0f5' : '#4c4f69')
        vertical.strokeColor = new this.paperScope!.Color(this.$vuetify.theme.dark ? '#c6d0f5' : '#4c4f69')
        horizontal.strokeWidth = 0.45
        vertical.strokeWidth = 0.45

        this.needleMarker = new this.paperScope!.Group([horizontal, vertical])
    }

    resetView(): void {
        if (!this.paperScope) return

        this.paperScope.view.zoom = 1
        this.paperScope.view.center = new this.paperScope.Point(0, 0)
    }

    fitToFrame(): void {
        if (!this.paperScope) return

        const width = this.frameWidth || this.designWidth || 100
        const height = this.frameHeight || this.designHeight || 100
        const zoom = this.getZoomForSize(width, height)
        this.paperScope.view.zoom = zoom
        this.paperScope.view.center = new this.paperScope.Point(0, 0)
    }

    fitToDesign(): void {
        if (!this.paperScope) return

        const width = this.designWidth || this.frameWidth || 100
        const height = this.designHeight || this.frameHeight || 100
        const zoom = this.getZoomForSize(width, height)
        this.paperScope.view.zoom = zoom
        this.paperScope.view.center = new this.paperScope.Point(0, 0)
    }

    scheduleAutoFit(): void {
        if (!this.paperScope) return
        if (this.autoFitRequestId !== null) cancelAnimationFrame(this.autoFitRequestId)
        this.autoFitRequestId = requestAnimationFrame(() => {
            this.autoFitRequestId = null
            this.autoFitView()
            this.paperScope?.view?.update()
        })
    }

    scheduleResizeAutoFit(): void {
        if (this.resizeAutoFitTimeout !== null) clearTimeout(this.resizeAutoFitTimeout)
        this.resizeAutoFitTimeout = window.setTimeout(() => {
            this.resizeAutoFitTimeout = null
            this.scheduleAutoFit()
        }, 250)
    }

    autoFitView(): void {
        if (!this.paperScope) return

        const frameWidth = this.frameWidth || 100
        const frameHeight = this.frameHeight || 100
        const designWidth = this.designWidth || frameWidth
        const designHeight = this.designHeight || frameHeight
        const frameZoom = this.getZoomForSize(frameWidth, frameHeight)
        const designZoom = this.getZoomForSize(designWidth, designHeight)

        this.paperScope.view.zoom = Math.min(frameZoom, designZoom)
        this.paperScope.view.center = new this.paperScope.Point(0, 0)
    }

    getZoomForSize(width: number, height: number): number {
        if (!this.paperScope) return 1
        return Math.min(this.paperScope.view.size.width / width, this.paperScope.view.size.height / height) * 0.9
    }

    toggleScrubPlayback(): void {
        const shouldPlay = !this.scrubPlaying
        if (shouldPlay && this.scrubPosition >= this.scrubFileSize) {
            this.scrubPosition = 0
        }
        this.scrubPlaying = shouldPlay
        if (this.scrubPlaying) this.startScrubPlayback()
        else this.stopScrubPlayback()
    }

    startScrubPlayback(): void {
        if (this.scrubInterval) clearInterval(this.scrubInterval)
        this.scrubInterval = setInterval(() => {
            this.scrubPosition += 100 * this.scrubSpeed
            if (this.scrubPosition >= this.scrubFileSize) {
                this.scrubPosition = this.scrubFileSize
                this.stopScrubPlayback()
            }
        }, 200)
    }

    stopScrubPlayback(setPlaying = true): void {
        if (setPlaying) this.scrubPlaying = false
        if (this.scrubInterval) clearInterval(this.scrubInterval)
        this.scrubInterval = undefined
    }

    fastForward(): void {
        this.scrubPosition = Math.min(this.scrubPosition + 10000, this.scrubFileSize)
    }

    chooseFile(): void {
        this.fileInput.click()
    }

    async fileSelected(e: Event): Promise<void> {
        const input = e.target as HTMLInputElement
        if (!input.files?.length) return

        const file = input.files[0]
        this.loadedFile = file.name

        const reader = new FileReader()
        reader.addEventListener('load', (event) => {
            if (!event || !event.target) return
            const gcode = event.target.result as string
            this.loadGcode(gcode)
        })

        reader.readAsText(file)
        input.value = ''
    }

    clearLoadedFile(): void {
        if (this.editMode) this.exitEditMode()
        this.loadedFile = null
        this.fileData = ''
        this.originalGcode = ''
        this.scrubFileSize = 0
        this.scrubPosition = 0
        this.renderLines = []
        this.renderItems = []
        this.stitchPointItems = []
        this.colorChangeItems = []
        this.designWidth = 0
        this.designHeight = 0
        this.stitchCount = 0
        this.jumpCount = 0
        this.hasColorChanges = false
        this.moveOffsets = []
        this.colorChangeIndices = []
        this.visibleMoveCount = 0
        this.treatG0AsStitch = false
        this.stitchPointMoveIndices = []
        this.playbackPosition = null

        this.layers.path?.removeChildren()
        this.layers.points?.removeChildren()
        this.layers.markers?.removeChildren()
        this.paperScope?.view?.update()
    }

    async loadCurrentFile(): Promise<void> {
        if (!this.sdCardFilePath) return
        await this.loadFile('gcodes/' + this.sdCardFilePath)
        this.loadedFile = this.sdCardFilePath
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
        if (!text) return
        this.loadGcode(text)
    }

    cancelDownload() {
        this.downloadSnackbar.cancelTokenSource.cancel('User canceled download gcode file')
    }

    loadSelectedGcodeFile(): void {
        if (!this.selectedGcodeFile) return
        const filename = `gcodes/${this.selectedGcodeFile}`
        this.showGcodeFileDialog = false
        this.loadFile(filename)
    }

    loadGcode(gcode: string): void {
        this.fileData = gcode
        this.originalGcode = gcode
        this.scrubFileSize = gcode.length
        this.scrubPosition = this.scrubFileSize
        if (!this.parserReady && !(window as any).GCodeToGeometry) {
            this.pendingGcode = gcode
            return
        }
        if (!this.paperScope) {
            this.pendingGcode = gcode
            return
        }

        const parsed = this.parseGcode(gcode)
        if (!parsed) {
            this.renderLines = []
            this.renderItems = []
            this.stitchPointItems = []
            this.colorChangeItems = []
            this.visibleMoveCount = 0
            this.treatG0AsStitch = false
            this.stitchPointMoveIndices = []
            this.playbackPosition = null
            this.layers.path?.removeChildren()
            this.layers.points?.removeChildren()
            this.layers.markers?.removeChildren()
            return
        }

        this.renderLines = parsed.renderLines
        this.moveOffsets = parsed.moveOffsets
        this.colorChangeIndices = parsed.colorChangeIndices
        this.hasColorChanges = parsed.hasColorChanges
        this.stitchCount = parsed.stitchCount
        this.jumpCount = parsed.jumpCount
        this.designWidth = parsed.designWidth
        this.designHeight = parsed.designHeight
        this.designCenter = parsed.designCenter
        this.treatG0AsStitch = parsed.treatG0AsStitch
        this.stitchPointMoveIndices = parsed.stitchPointMoveIndices

        this.visibleMoveCount = this.renderLines.length

        this.buildPathItems()
        this.renderStitchPoints()
        this.renderColorChanges()
        this.updatePlaybackPosition()
        this.updateNeedleMarker()
        this.renderFrameAndGrid()
        this.updateItemVisibility()
        this.scheduleAutoFit()
        this.paperScope.view.update()
    }

    parseGcode(gcode: string): {
        renderLines: RenderLine[]
        moveOffsets: number[]
        colorChangeIndices: number[]
        stitchCount: number
        jumpCount: number
        designWidth: number
        designHeight: number
        hasColorChanges: boolean
        designCenter: GCodeGeometryPoint
        treatG0AsStitch: boolean
        stitchPointMoveIndices: number[]
        hasZStitchMarkers: boolean
    } | null {
        if (!window.GCodeToGeometry) {
            window.console.error('GCodeToGeometry not available')
            return null
        }

        const rawGcode = this.normalizeLineEndings(gcode)
        const normalizedGcode = this.normalizeGcode(rawGcode)
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
        let currentColor = this.stitchColor
        let offset = 0
        const feedratePattern = /\bF[-+]?\d*\.?\d+/i
        let g0Count = 0
        let g1Count = 0
        const stitchPointMoveIndices: number[] = []
        let hasZStitchMarkers = false

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
                hasZStitchMarkers = true
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
                    processedLine = this.appendFeedrate(processedLine, this.defaultFeedrate)
                }
                processedLines.push(processedLine)
                if (hasZ) {
                    hasZStitchMarkers = true
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

        if (geometry.lines.length !== moveColors.length) {
            window.console.warn('G-code parse mismatch: move count does not match geometry output')
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
            color: moveColors[index] ?? this.stitchColor,
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
            colorChangeIndices,
            stitchCount,
            jumpCount: normalizedJumpCount,
            designWidth,
            designHeight,
            hasColorChanges: colorChangeIndices.length > 0,
            designCenter,
            treatG0AsStitch,
            stitchPointMoveIndices,
            hasZStitchMarkers,
        }
    }

    normalizeLineEndings(gcode: string): string {
        return gcode
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\uFEFF/g, '')
    }

    normalizeGcode(gcode: string): string {
        return gcode.replace(/(-?\d+),(\d+)/g, '$1.$2')
    }

    appendFeedrate(line: string, feedrate: number): string {
        const semicolonIndex = line.indexOf(';')
        const parenIndex = line.indexOf('(')
        let insertIndex = -1

        if (semicolonIndex >= 0) insertIndex = semicolonIndex
        if (parenIndex >= 0) insertIndex = insertIndex === -1 ? parenIndex : Math.min(insertIndex, parenIndex)

        if (insertIndex === -1) return `${line} F${feedrate}`

        const head = line.slice(0, insertIndex).trimEnd()
        const tail = line.slice(insertIndex)
        return `${head} F${feedrate} ${tail}`
    }

    buildPathItems(): void {
        if (!this.paperScope || !this.layers.path) return

        this.layers.path.removeChildren()
        this.renderItems = []
        this.layers.path.activate()

        this.renderLines.forEach((renderLine) => {
            const line = renderLine.line
            const isTravel = line.type === 'G0' && !this.treatG0AsStitch
            const color = isTravel ? this.travelColor : renderLine.color
            const item = this.createPathItem(line, color)
            if (!item) return

            this.renderItems.push({
                item,
                moveIndex: renderLine.moveIndex,
                type: line.type,
                color: renderLine.color,
            })
        })
    }

    getLineWidthForType(type: string): number {
        const baseWidth = Math.max(Number(this.lineWidth) || 0, 0.05)
        const isTravel = type === 'G0' && !this.treatG0AsStitch
        return isTravel ? Math.max(0.12, baseWidth * 0.55) : baseWidth
    }

    updateLineWidths(): void {
        this.renderItems.forEach((item) => {
            item.item.strokeWidth = this.getLineWidthForType(item.type)
        })
    }

    createPathItem(line: GCodeGeometryLine, color: string): paper.Path | null {
        if (!this.paperScope) return null

        let path: paper.Path
        if (line.type === 'G2' || line.type === 'G3') {
            path = new this.paperScope.Path()
            const beziers = line.beziers ?? []
            if (!beziers.length) return null
            beziers.forEach((segment, index) => {
                if (index === 0) {
                    path.add(this.toDesignPoint(segment.p0))
                }
                if ((path as any).cubicCurveTo) {
                    ;(path as any).cubicCurveTo(
                        this.toDesignPoint(segment.p1),
                        this.toDesignPoint(segment.p2),
                        this.toDesignPoint(segment.p3)
                    )
                } else {
                    path.add(this.toDesignPoint(segment.p3))
                }
            })
        } else {
            path = new this.paperScope.Path.Line(this.toDesignPoint(line.start), this.toDesignPoint(line.end))
        }

        path.strokeColor = new this.paperScope.Color(color)
        const isTravel = line.type === 'G0' && !this.treatG0AsStitch
        path.strokeWidth = this.getLineWidthForType(line.type)
        path.strokeCap = 'round'
        path.strokeJoin = 'round'
        if (isTravel) {
            path.dashArray = [2, 3]
            path.opacity = 0.5
        }

        return path
    }

    updateItemVisibility(): void {
        const limit = this.visibleMoveCount
        this.renderItems.forEach((item) => {
            const isTravel = item.type === 'G0' && !this.treatG0AsStitch
            const visible = item.moveIndex < limit && (!isTravel || this.showJumpStitches)
            item.item.visible = visible
        })

        this.stitchPointItems.forEach((point) => {
            point.item.visible = point.moveIndex < limit
        })

        this.colorChangeItems.forEach((marker) => {
            marker.item.visible = marker.moveIndex < limit
        })
    }

    getMoveCountForOffset(offset: number): number {
        let low = 0
        let high = this.moveOffsets.length
        while (low < high) {
            const mid = Math.floor((low + high) / 2)
            if (this.moveOffsets[mid] <= offset) {
                low = mid + 1
            } else {
                high = mid
            }
        }
        return low
    }

    getLineBreakOffsets(gcode: string): number[] {
        if (!gcode) return []
        const lines = gcode.split('\n')
        const offsets: number[] = []
        let offset = 0
        lines.forEach((line, index) => {
            offset += line.length
            offsets.push(offset)
            if (index < lines.length - 1) offset += 1
        })
        return offsets
    }

    getLineIndexForOffset(offset: number, lineBreakOffsets: number[]): number {
        if (!lineBreakOffsets.length) return 0
        let low = 0
        let high = lineBreakOffsets.length
        while (low < high) {
            const mid = Math.floor((low + high) / 2)
            if (lineBreakOffsets[mid] < offset) {
                low = mid + 1
            } else {
                high = mid
            }
        }
        return Math.min(low, lineBreakOffsets.length - 1)
    }

    @Debounce(100)
    @Watch('scrubPosition')
    updateScrubPosition(): void {
        if (!this.renderLines.length) return
        if (!this.moveOffsets.length || this.moveOffsets.length !== this.renderLines.length) {
            const ratio = this.scrubFileSize > 0 ? this.scrubPosition / this.scrubFileSize : 1
            this.visibleMoveCount = Math.min(
                this.renderLines.length,
                Math.max(0, Math.floor(this.renderLines.length * ratio))
            )
        } else {
            this.visibleMoveCount = this.getMoveCountForOffset(this.scrubPosition)
        }
        this.updateItemVisibility()
        this.updatePlaybackPosition()
        this.updateNeedleMarker()
        this.scrollEditorToScrubPosition()
    }

    scrollEditorToScrubPosition(): void {
        if (!this.showGCode || !this.panelLineBreakOffsets.length) return
        const editor = this.$refs.gcodeEditor as any
        if (!editor?.gotoLine) return
        const panelOffset = this.gcodePanelPosition
        const lineIndex = this.getLineIndexForOffset(panelOffset, this.panelLineBreakOffsets)
        this.isSyncingEditor = true
        editor.gotoLine(lineIndex + 1)
        this.$nextTick(() => {
            this.isSyncingEditor = false
        })
    }

    stepScrubByMove(delta: number): void {
        if (!this.renderLines.length || !this.scrubFileSize) return

        const targetCount = Math.min(this.renderLines.length, Math.max(0, this.visibleMoveCount + delta))
        if (targetCount <= 0) {
            this.scrubPosition = 0
            return
        }

        if (this.moveOffsets.length === this.renderLines.length) {
            this.scrubPosition = this.moveOffsets[targetCount - 1]
            return
        }

        const ratio = this.renderLines.length > 0 ? targetCount / this.renderLines.length : 0
        this.scrubPosition = Math.round(this.scrubFileSize * ratio)
    }

    @Watch('showJumpStitches')
    jumpStitchesChanged(): void {
        this.updateItemVisibility()
    }

    @Watch('showGrid')
    showGridChanged(): void {
        this.renderGrid()
    }

    @Watch('gridSpacing')
    gridSpacingChanged(): void {
        this.renderGrid()
    }

    @Watch('showFrameBorder')
    frameBorderChanged(): void {
        this.renderFrame()
    }

    @Watch('frameWidth')
    frameWidthChanged(): void {
        this.renderFrameAndGrid()
    }

    @Watch('frameHeight')
    frameHeightChanged(): void {
        this.renderFrameAndGrid()
    }

    @Watch('showStitchPoints')
    stitchPointsChanged(): void {
        this.renderStitchPoints()
    }

    @Watch('showColorChanges')
    colorChangesChanged(): void {
        this.renderColorChanges()
    }

    @Watch('showNeedlePosition')
    needlePositionChanged(): void {
        this.updateNeedleMarker()
    }

    @Watch('rotationDeg')
    rotationDegChanged(): void {
        this.updateDesignPosition()
    }

    @Watch('rotationPivot')
    rotationPivotChanged(): void {
        this.updateDesignPosition()
    }

    @Watch('themeMode')
    themeModeChanged(_newMode: 'dark' | 'light', oldMode: 'dark' | 'light'): void {
        if (!this.isStitchlabTheme) return

        this.applyThemePreviewColors(oldMode)
        this.renderFrameAndGrid()
        this.updatePathColors()
        this.updateNeedleMarker()
    }

    @Watch('isStitchlabTheme')
    stitchlabThemeChanged(enabled: boolean): void {
        if (!enabled) return

        this.applyThemePreviewColors()
        this.renderFrameAndGrid()
        this.updatePathColors()
        this.updateNeedleMarker()
    }

    @Watch('lineWidth')
    lineWidthChanged(): void {
        this.updateLineWidths()
    }

    @Watch('stitchPointSize')
    stitchPointSizeChanged(): void {
        this.renderStitchPoints()
    }

    @Watch('currentPosition')
    currentPositionChanged(): void {
        this.updateNeedleMarker()
    }

    @Watch('showGCode')
    showGCodeChanged(): void {
        this.$nextTick(() => this.scheduleAutoFit())
    }

    @Watch('showRightPanel')
    showRightPanelChanged(): void {
        this.$nextTick(() => this.scheduleAutoFit())
    }
}
</script>

<style scoped>
.canvas-wrapper {
    position: relative;
    height: calc(100vh - 220px);
    min-height: 300px;
    max-height: 800px;
    border-radius: 4px;
    overflow: hidden;
}

.gcode-canvas {
    width: 100%;
    height: 100%;
    cursor: grab;
}

.gcode-canvas:active {
    cursor: grabbing;
}

.coords {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: var(--ctp-crust, rgba(0, 0, 0, 0.7));
    color: var(--ctp-text, white);
    padding: 4px 8px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    pointer-events: none;
}

.right-panel {
    height: calc(100vh - 220px);
    max-height: calc(100vh - 220px);
    overflow-y: auto;
    font-size: 13px;
}

.color-picker {
    width: 100%;
    height: 40px;
    border: 1px solid var(--ctp-surface1, rgba(128, 128, 128, 0.25));
    border-radius: 4px;
    cursor: pointer;
    background: transparent;
}

.color-label {
    font-weight: 500;
}

.right-panel .v-input:not(.v-input--selection-controls) input,
.right-panel .v-input:not(.v-input--selection-controls) .v-label,
.right-panel .v-select__selection {
    font-size: 12px;
}

.right-panel .v-input--selection-controls .v-label {
    font-size: 11px;
}

.right-panel .v-input--selection-controls .v-icon {
    font-size: 16px;
}

.viewer {
    height: calc(100vh - 220px);
    min-height: 200px;
    border: 1px solid var(--ctp-surface0, rgba(128, 128, 128, 0.25));
    border-radius: 4px;
    overflow: hidden;
}

.viewer--edit {
    border-color: var(--ctp-peach, rgba(128, 128, 128, 0.25));
}

.viewer--transformed {
    border-color: var(--ctp-sapphire, rgba(128, 128, 128, 0.25));
}

.gcode-editor {
    height: 100%;
}

.gcode-editor--source {
    --gcode-editor-pane-bg: var(--stitchlab-code-bg, var(--ctp-crust));
    --gcode-editor-gutter-bg: var(--stitchlab-code-gutter-bg, var(--ctp-crust));
    --gcode-editor-divider-color: var(--ctp-surface0);
    --gcode-editor-active-line-bg: var(--ctp-surface0);
    --gcode-editor-line-number-color: var(--ctp-overlay1);
}

.gcode-editor--edit {
    --gcode-editor-pane-bg: var(--stitchlab-code-bg, var(--ctp-crust));
    --gcode-editor-gutter-bg: var(--ctp-mantle);
    --gcode-editor-divider-color: var(--ctp-peach);
    --gcode-editor-active-line-bg: var(--ctp-surface1);
    --gcode-editor-line-number-color: var(--ctp-peach);
}

.gcode-editor--transformed {
    --gcode-editor-pane-bg: var(--stitchlab-code-bg, var(--ctp-crust));
    --gcode-editor-gutter-bg: var(--ctp-mantle);
    --gcode-editor-divider-color: var(--ctp-sapphire);
    --gcode-editor-active-line-bg: var(--ctp-surface1);
    --gcode-editor-line-number-color: var(--ctp-overlay1);
}

.gcode-editor /deep/ .cm-editor {
    height: 100%;
}

.gcode-editor /deep/ .cm-scroller {
    overflow: auto;
}

.scrubber {
    position: relative;
    left: 0;
    right: 0;
    bottom: 0;
    margin-top: 24px;
}

::v-deep .v-expansion-panel {
    background: transparent !important;
}

.right-panel ::v-deep .v-expansion-panel-header {
    padding: 6px 8px;
    min-height: 32px;
    align-items: center;
    justify-content: flex-start !important;
}

.right-panel ::v-deep .v-expansion-panel-header__content {
    flex: 0 0 auto !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    text-align: left !important;
    margin-left: auto !important;
    margin-right: 2px !important;
}

::v-deep .v-expansion-panel-content__wrap {
    padding: 6px 8px;
}

.panel-icon {
    margin-right: 2px;
}

.panel-title {
    margin-left: 0;
}

.right-panel ::v-deep .v-expansion-panel-header__icon {
    margin-left: 0 !important;
    margin-right: 0 !important;
}
</style>
