<template>
    <tr
        v-longpress:600="showContextMenuAction"
        class="file-list-cursor user-select-none"
        draggable="true"
        @click="clickOnRow"
        @contextmenu="showContextMenuAction($event)"
        @dragstart="onDragStart"
        @drag="onDrag">
        <td class="file-list__select-td pr-0">
            <v-simple-checkbox v-ripple :value="isSelected" class="pa-0 mr-0" @click.stop="select(!isSelected)" />
        </td>
        <td class="px-0 text-center" style="width: 32px">
            <gcodefiles-thumbnail :item="item" />
        </td>
        <td class=" ">
            <span>{{ item.filename }}</span>
            <v-chip
                v-if="showIntakeControls"
                x-small
                label
                outlined
                class="ml-2 file-list__intake-badge"
                :color="intakeBadgeColor"
                @click.stop="showDiagnosticsDialog = true">
                <v-icon x-small left>{{ intakeBadgeIcon }}</v-icon>
                {{ intakeBadgeLabel }}
            </v-chip>
        </td>
        <td class="text-right text-no-wrap">
            <v-tooltip v-if="item.last_status" top>
                <template #activator="{ on, attrs }">
                    <span v-bind="attrs" v-on="on">
                        <span v-if="item.count_printed > 0" :class="`file-list__count_printed ${printStatusTextColor}`">
                            {{ item.count_printed }}
                        </span>
                        <v-icon small :color="printStatusIconColor">{{ printStatusIcon }}</v-icon>
                    </span>
                </template>
                <span>{{ item.last_status.replace(/_/g, ' ') }}</span>
            </v-tooltip>
        </td>
        <template v-for="col in tableColumns">
            <gcodefiles-panel-table-row-file-metadata-slicer
                v-if="col.value === 'slicer'"
                :key="col.value"
                :item="item" />
            <gcodefiles-panel-table-row-file-metadata-filaments
                v-else-if="col.value === 'filaments'"
                :key="col.value"
                :item="item" />
            <gcodefiles-panel-table-row-file-metadata-filament-strings
                v-else-if="['filament_name', 'filament_type'].includes(col.value)"
                :key="col.value"
                :item="item"
                :column="col.value" />
            <gcodefiles-panel-table-row-file-metadata v-else :key="col.value" :col="col" :item="item" />
        </template>
        <v-menu
            v-model="showContextMenu"
            :position-x="showContextMenuX"
            :position-y="showContextMenuY"
            absolute
            offset-y>
            <v-list>
                <v-list-item
                    v-if="isGcodeFile"
                    :disabled="!klipperReadyForGui || ['error', 'printing', 'paused'].includes(printer_state)"
                    @click="showStartPrintDialog = true">
                    <v-icon class="mr-1">{{ mdiPlay }}</v-icon>
                    {{ $t('Files.PrintStart') }}
                </v-list-item>
                <v-list-item
                    v-if="moonrakerComponents.includes('job_queue')"
                    :disabled="!isGcodeFile"
                    @click="addToQueue">
                    <v-icon class="mr-1">{{ mdiPlaylistPlus }}</v-icon>
                    {{ $t('Files.AddToQueue') }}
                </v-list-item>
                <v-list-item
                    v-if="moonrakerComponents.includes('job_queue')"
                    :disabled="!isGcodeFile"
                    @click="showAddBatchToQueueDialog = true">
                    <v-icon class="mr-1">{{ mdiPlaylistPlus }}</v-icon>
                    {{ $t('Files.AddBatchToQueue') }}
                </v-list-item>
                <v-list-item
                    v-if="item.preheat_gcode !== null"
                    :disabled="['error', 'printing', 'paused'].includes(printer_state)"
                    @click="doSend(item.preheat_gcode)">
                    <v-icon class="mr-1">{{ mdiFire }}</v-icon>
                    {{ $t('Files.Preheat') }}
                </v-list-item>
                <v-list-item :disabled="!isGcodeFile" @click="view3D">
                    <v-icon class="mr-1">{{ mdiVideo3d }}</v-icon>
                    {{ $t('Files.View3D') }}
                </v-list-item>
                <v-list-item :disabled="!isGcodeFile" @click="viewStudio">
                    <v-icon class="mr-1">{{ mdiPencilRuler }}</v-icon>
                    {{ $t('Files.ViewStudio') }}
                </v-list-item>
                <v-list-item :disabled="!isGcodeFile" @click="scanMeta">
                    <v-icon class="mr-1">{{ mdiMagnify }}</v-icon>
                    {{ $t('Files.ScanMeta') }}
                </v-list-item>
                <v-list-item v-if="showIntakeControls" :disabled="intakeIsChecking" @click="recheckIntake">
                    <v-icon class="mr-1">{{ mdiRefresh }}</v-icon>
                    {{ $t('StitchlabIntake.MenuRecheck') }}
                </v-list-item>
                <v-list-item v-if="showIntakeControls" @click="showDiagnosticsDialog = true">
                    <v-icon class="mr-1">{{ mdiInformationOutline }}</v-icon>
                    {{ $t('StitchlabIntake.MenuDiagnostics') }}
                </v-list-item>
                <v-list-item @click="downloadFile">
                    <v-icon class="mr-1">{{ mdiCloudDownload }}</v-icon>
                    {{ $t('Files.Download') }}
                </v-list-item>
                <v-list-item @click="editFile">
                    <v-icon class="mr-1">{{ mdiFileDocumentEditOutline }}</v-icon>
                    {{ $t('Files.EditFile') }}
                </v-list-item>
                <v-list-item @click="showRenameFileDialog = true">
                    <v-icon class="mr-1">{{ mdiRenameBox }}</v-icon>
                    {{ $t('Files.Rename') }}
                </v-list-item>
                <v-list-item @click="showDuplicateFileDialog = true">
                    <v-icon class="mr-1">{{ mdiContentCopy }}</v-icon>
                    {{ $t('Files.Duplicate') }}
                </v-list-item>
                <v-list-item class="red--text" @click="showDeleteFileDialog = true">
                    <v-icon class="mr-1" color="error">{{ mdiDelete }}</v-icon>
                    {{ $t('Files.Delete') }}
                </v-list-item>
            </v-list>
        </v-menu>
        <start-print-dialog
            :bool="showStartPrintDialog"
            :file="item"
            :current-path="currentPath"
            @closeDialog="showStartPrintDialog = false" />
        <add-batch-to-queue-dialog v-model="showAddBatchToQueueDialog" :filename="item.full_filename" />
        <gcodefiles-rename-file-dialog v-model="showRenameFileDialog" :item="item" />
        <gcodefiles-duplicate-file-dialog v-model="showDuplicateFileDialog" :item="item" />
        <confirmation-dialog
            v-model="showDeleteFileDialog"
            :title="$t('Files.Delete')"
            :text="$t('Files.DeleteSingleFileQuestion', { name: item.filename })"
            :action-button-text="$t('Buttons.Delete')"
            @action="deleteFile" />
        <v-dialog v-model="showDiagnosticsDialog" max-width="640">
            <v-card>
                <v-card-title class="text-h6">{{ $t('StitchlabIntake.DialogTitle') }}</v-card-title>
                <v-card-text>
                    <div class="mb-3">
                        <strong>{{ $t('StitchlabIntake.DialogStatus') }}</strong>
                        <span :class="`${intakeBadgeColor}--text`">{{ intakeBadgeLabel }}</span>
                    </div>
                    <template v-if="intakeErrors.length">
                        <div class="font-weight-bold error--text mb-1">
                            {{ $t('StitchlabIntake.DialogErrors') }}
                        </div>
                        <ul class="mb-3">
                            <li v-for="(entry, index) in intakeErrors" :key="`intake-error-${index}`">
                                {{ entry }}
                            </li>
                        </ul>
                    </template>
                    <template v-if="intakeWarnings.length">
                        <div class="font-weight-bold warning--text mb-1">
                            {{ $t('StitchlabIntake.DialogWarnings') }}
                        </div>
                        <ul class="mb-3">
                            <li v-for="(entry, index) in intakeWarnings" :key="`intake-warning-${index}`">
                                {{ entry }}
                            </li>
                        </ul>
                    </template>
                    <template v-if="intakeInfo.length">
                        <div class="font-weight-bold info--text mb-1">
                            {{ $t('StitchlabIntake.DialogInfo') }}
                        </div>
                        <ul class="mb-3">
                            <li v-for="(entry, index) in intakeInfo" :key="`intake-info-${index}`">
                                {{ entry }}
                            </li>
                        </ul>
                    </template>
                    <div
                        v-if="!intakeErrors.length && !intakeWarnings.length && !intakeInfo.length"
                        class="text--disabled">
                        {{ $t('StitchlabIntake.DialogNone') }}
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="showDiagnosticsDialog = false">
                        {{ $t('StitchlabIntake.DialogClose') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </tr>
</template>
<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import GcodefilesMixin from '@/components/mixins/gcodefiles'
import { FileStateGcodefile } from '@/store/files/types'
import { validGcodeExtensions } from '@/store/variables'
import GcodefilesThumbnail from '@/components/panels/Gcodefiles/GcodefilesThumbnail.vue'
import {
    mdiCloudDownload,
    mdiContentCopy,
    mdiDelete,
    mdiFileDocumentEditOutline,
    mdiFire,
    mdiMagnify,
    mdiAlertCircleOutline,
    mdiCheckCircleOutline,
    mdiClockOutline,
    mdiHelpCircleOutline,
    mdiInformationOutline,
    mdiPlay,
    mdiPlaylistPlus,
    mdiRenameBox,
    mdiRefresh,
    mdiShieldAlertOutline,
    mdiVideo3d,
    mdiPencilRuler,
} from '@mdi/js'
import ControlMixin from '@/components/mixins/control'
import { convertPrintStatusIcon, convertPrintStatusIconColor, escapePath } from '@/plugins/helpers'
import GcodefilesRenameFileDialog from '@/components/dialogs/GcodefilesRenameFileDialog.vue'
import GcodefilesDuplicateFileDialog from '@/components/dialogs/GcodefilesDuplicateFileDialog.vue'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog.vue'
import GcodefilesPanelTableRowFileMetadata from '@/components/panels/Gcodefiles/GcodefilesPanelTableRowFileMetadata.vue'
import GcodefilesPanelTableRowFileMetadataFilaments from '@/components/panels/Gcodefiles/GcodefilesPanelTableRowFileMetadataFilaments.vue'
import GcodefilesPanelTableRowFileMetadataSlicer from '@/components/panels/Gcodefiles/GcodefilesPanelTableRowFileMetadataSlicer.vue'
import GcodefilesPanelTableRowFileMetadataFilamentStrings from '@/components/panels/Gcodefiles/GcodefilesPanelTableRowFileMetadataFilamentStrings.vue'
import { CLOSE_CONTEXT_MENU, EventBus } from '@/plugins/eventBus'
import { diagnosticMessage } from '@/store/stitchlabIntake/helpers'

@Component({
    components: {
        ConfirmationDialog,
        GcodefilesPanelTableRowFileMetadataFilamentStrings,
        GcodefilesPanelTableRowFileMetadataFilaments,
        GcodefilesPanelTableRowFileMetadataSlicer,
        GcodefilesPanelTableRowFileMetadata,
        GcodefilesDuplicateFileDialog,
        GcodefilesRenameFileDialog,
        GcodefilesThumbnail,
    },
})
export default class GcodefilesPanelTableRowFile extends Mixins(BaseMixin, ControlMixin, GcodefilesMixin) {
    mdiCloudDownload = mdiCloudDownload
    mdiContentCopy = mdiContentCopy
    mdiDelete = mdiDelete
    mdiFileDocumentEditOutline = mdiFileDocumentEditOutline
    mdiFire = mdiFire
    mdiMagnify = mdiMagnify
    mdiAlertCircleOutline = mdiAlertCircleOutline
    mdiCheckCircleOutline = mdiCheckCircleOutline
    mdiClockOutline = mdiClockOutline
    mdiHelpCircleOutline = mdiHelpCircleOutline
    mdiInformationOutline = mdiInformationOutline
    mdiPlay = mdiPlay
    mdiPlaylistPlus = mdiPlaylistPlus
    mdiRenameBox = mdiRenameBox
    mdiRefresh = mdiRefresh
    mdiShieldAlertOutline = mdiShieldAlertOutline
    mdiVideo3d = mdiVideo3d
    mdiPencilRuler = mdiPencilRuler

    showContextMenu = false
    showContextMenuX = 0
    showContextMenuY = 0

    showStartPrintDialog = false
    showAddBatchToQueueDialog = false
    showRenameFileDialog = false
    showDuplicateFileDialog = false
    showDeleteFileDialog = false
    showDiagnosticsDialog = false

    @Prop({ type: Object, required: true }) readonly item!: FileStateGcodefile
    @Prop({ type: Boolean, required: true }) readonly isSelected!: boolean
    @Prop({ type: Function, required: true }) readonly select!: Function

    get isGcodeFile() {
        const format = this.item.filename.slice(this.item.filename.lastIndexOf('.'))

        return validGcodeExtensions.includes(format)
    }

    get printStatusTextColor() {
        switch (this.item.last_status) {
            case 'in_progress':
                return 'blue--text' //'blue-grey darken-1'
            case 'completed':
                return 'green--text' //'green'
            case 'cancelled':
                return 'red--text'

            default:
                return 'orange--text'
        }
    }

    get printStatusIcon() {
        return convertPrintStatusIcon(this.item.last_status ?? '')
    }

    get printStatusIconColor() {
        return convertPrintStatusIconColor(this.item.last_status ?? '')
    }

    get fullIntakeFilename(): string {
        const filename = [this.currentPath, this.item.filename].join('/')
        return filename.replace(/^\/+/, '')
    }

    get showIntakeControls(): boolean {
        return this.isGcodeFile && this.moonrakerComponents.includes('stitchlab_intake')
    }

    get intakeEntry(): any {
        return this.$store.getters['stitchlabIntake/getEntry'](this.fullIntakeFilename) ?? null
    }

    get intakeState(): string {
        return this.intakeEntry?.state ?? 'unchecked'
    }

    get intakeIsChecking(): boolean {
        return ['queued', 'running', 'checking'].includes(this.intakeState)
    }

    get intakeBadgeKey(): 'Checking' | 'Valid' | 'Warnings' | 'Blocked' | 'Unchecked' {
        switch (this.intakeState) {
            case 'queued':
            case 'running':
            case 'checking':
                return 'Checking'
            case 'valid':
                return 'Valid'
            case 'warnings':
                return 'Warnings'
            case 'blocked':
            case 'error':
                return 'Blocked'
            default:
                return 'Unchecked'
        }
    }

    get intakeBadgeLabel(): string {
        return this.$t(`StitchlabIntake.Badge${this.intakeBadgeKey}`).toString()
    }

    get intakeBadgeColor(): string {
        switch (this.intakeBadgeKey) {
            case 'Checking':
                return 'info'
            case 'Valid':
                return 'success'
            case 'Warnings':
                return 'warning'
            case 'Blocked':
                return 'error'
            default:
                return 'grey'
        }
    }

    get intakeBadgeIcon(): string {
        switch (this.intakeBadgeKey) {
            case 'Checking':
                return this.mdiClockOutline
            case 'Valid':
                return this.mdiCheckCircleOutline
            case 'Warnings':
                return this.mdiAlertCircleOutline
            case 'Blocked':
                return this.mdiShieldAlertOutline
            default:
                return this.mdiHelpCircleOutline
        }
    }

    get intakeErrors(): string[] {
        const output = (this.intakeEntry?.errors ?? []).map(diagnosticMessage)
        if (this.intakeEntry?.macros?.state === 'missing') {
            for (const macro of this.intakeEntry.macros.missing ?? []) {
                output.push(this.$t('StitchlabIntake.ToastMissingMacro', { macro }).toString())
            }
        }
        return output
    }

    get intakeWarnings(): string[] {
        const output = (this.intakeEntry?.warnings ?? []).map(diagnosticMessage)
        if (this.intakeEntry?.macros?.state === 'offline') {
            output.push(this.$t('StitchlabIntake.ToastMacrosOffline').toString())
        }
        return output
    }

    get intakeInfo(): string[] {
        return (this.intakeEntry?.info ?? []).map(diagnosticMessage)
    }

    showContextMenuAction(e: MouseEvent) {
        e?.preventDefault()
        EventBus.$emit(CLOSE_CONTEXT_MENU)

        this.showContextMenuX = e?.clientX || e?.pageX || window.screenX / 2
        this.showContextMenuY = e?.clientY || e?.pageY || window.screenY / 2

        this.showContextMenu = true
    }

    closeContextMenu() {
        this.showContextMenu = false
    }

    clickOnRow() {
        if (!this.isGcodeFile || ['error', 'printing', 'paused'].includes(this.printer_state)) return

        this.showStartPrintDialog = true
    }

    addToQueue() {
        let filename = [this.currentPath, this.item.filename].join('/')
        if (filename.startsWith('/')) filename = filename.slice(1)

        this.$store.dispatch('server/jobQueue/addToQueue', [filename])
    }

    view3D() {
        this.$router.push({
            path: '/viewer',
            query: { filename: 'gcodes' + this.currentPath + '/' + this.item.filename },
        })
    }

    viewStudio() {
        this.$router.push({
            path: '/studio',
            query: { filename: 'gcodes' + this.currentPath + '/' + this.item.filename },
        })
    }

    scanMeta() {
        this.$store.dispatch('files/scanMetadata', {
            filename: 'gcodes' + this.currentPath + '/' + this.item.filename,
        })
    }

    recheckIntake() {
        this.$store.dispatch('stitchlabIntake/recheck', this.fullIntakeFilename)
    }

    downloadFile() {
        const filename = this.currentPath + '/' + this.item.filename
        const href = this.apiUrl + '/server/files/gcodes' + escapePath(filename)

        window.open(href)
    }

    editFile() {
        this.$store.dispatch('editor/openFile', {
            root: 'gcodes',
            path: this.currentPath,
            filename: this.item.filename,
            size: this.item.size,
            permissions: this.item.permissions,
        })
    }

    deleteFile() {
        this.$socket.emit(
            'server.files.delete_file',
            { path: 'gcodes' + this.currentPath + '/' + this.item.filename },
            { action: 'files/getDeleteFile' }
        )
    }

    onDragStart(e: DragEvent) {
        if (e.dataTransfer === null) return

        e.dataTransfer.setData('filename', this.item.filename)
        e.dataTransfer.effectAllowed = 'move'
    }

    onDrag(e: DragEvent) {
        e.preventDefault()
        e.stopPropagation()
    }

    mounted() {
        EventBus.$on(CLOSE_CONTEXT_MENU, this.closeContextMenu)
    }

    beforeDestroy() {
        EventBus.$off(CLOSE_CONTEXT_MENU, this.closeContextMenu)
    }
}
</script>

<style scoped>
.file-list__count_printed {
    position: relative;
    top: 1px;
}
</style>
