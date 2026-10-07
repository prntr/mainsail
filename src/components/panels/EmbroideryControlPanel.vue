<template>
    <panel
        v-if="klipperReadyForGui"
        :icon="mdiNeedle"
        :title="$t('Panels.EmbroideryPanel.Headline')"
        card-class="embroidery-control-panel">
        <v-card-text>
            <!-- Needle state, read from the machine -->
            <div class="text-center mb-4">
                <v-chip :color="needleStateColor" dark class="embroidery-control-panel__state" :data-state="needle">
                    {{ needleStateText }}
                </v-chip>
                <div v-if="hint" class="text-caption mt-2 embroidery-control-panel__hint">{{ hint }}</div>
            </div>

            <!-- Needle Toggle & Stitch Buttons -->
            <v-row class="mb-4">
                <v-col cols="6">
                    <v-btn
                        block
                        large
                        :color="toggleButtonColor"
                        class="embroidery-control-panel__toggle-btn"
                        :disabled="!canRun('NEEDLE_TOGGLE')"
                        :loading="loadings.includes('needleToggle')"
                        @click="send('NEEDLE_TOGGLE', 'needleToggle')">
                        <v-icon left>
                            {{ mdiSwapVertical }}
                        </v-icon>
                        {{ toggleButtonText }}
                    </v-btn>
                </v-col>
                <v-col cols="6">
                    <v-btn
                        block
                        large
                        color="secondary"
                        class="embroidery-control-panel__stitch-btn"
                        :disabled="!canRun('STITCH')"
                        :loading="loadings.includes('stitch')"
                        @click="send('STITCH', 'stitch')">
                        <v-icon left>
                            {{ mdiArrowUp }}
                        </v-icon>
                        {{ $t('Panels.EmbroideryPanel.Stitch') }}
                    </v-btn>
                </v-col>
            </v-row>

            <!-- Lock Stitch Button -->
            <v-btn
                block
                large
                color="secondary"
                class="mb-4 embroidery-control-panel__lock-btn"
                :disabled="!canRun('LOCK_STITCH')"
                :loading="loadings.includes('lockStitch')"
                @click="send('LOCK_STITCH', 'lockStitch')">
                <v-icon left>
                    {{ mdiLock }}
                </v-icon>
                {{ $t('Panels.EmbroideryPanel.LockStitch') }}
            </v-btn>

            <!-- Zero Position Button -->
            <v-btn
                block
                large
                color="warning"
                class="embroidery-control-panel__zero-btn"
                :disabled="!canRun('ZERO_NEEDLE_POSITION')"
                :loading="loadings.includes('zeroNeedle')"
                @click="send('ZERO_NEEDLE_POSITION', 'zeroNeedle')">
                <v-icon left>
                    {{ mdiTarget }}
                </v-icon>
                {{ $t('Panels.EmbroideryPanel.ZeroPosition') }}
            </v-btn>
        </v-card-text>
    </panel>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { needleIcon } from '@/components/icons/needleIcon'
import { embroideryCommandAllowed, jobPhase, JobPhase, needleState, NeedleState } from '@/plugins/stitchlabMachine'
import { mdiArrowUp, mdiSwapVertical, mdiTarget, mdiLock } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class EmbroideryControlPanel extends Mixins(BaseMixin) {
    mdiNeedle = needleIcon
    mdiArrowUp = mdiArrowUp
    mdiSwapVertical = mdiSwapVertical
    mdiTarget = mdiTarget
    mdiLock = mdiLock

    // Every browser on the machine reads the same toolhead position, so all of
    // them show the same state, after a reload and after a job too.
    get needle(): NeedleState {
        const toolhead = this.$store.state.printer.toolhead
        return needleState(toolhead?.position?.[2], toolhead?.homed_axes)
    }

    get phase(): JobPhase {
        return jobPhase(this.printer_state)
    }

    get needleStateText(): string {
        switch (this.needle) {
            case 'up':
                return `${this.$t('Panels.EmbroideryPanel.NeedleUp')} (0°)`
            case 'down':
                return `${this.$t('Panels.EmbroideryPanel.NeedleDown')} (180°)`
            case 'between':
                return this.$t('Panels.EmbroideryPanel.NeedleBetween') as string
            default:
                return this.$t('Panels.EmbroideryPanel.NeedleUnknown') as string
        }
    }

    get needleStateColor(): string {
        if (this.needle === 'up') return 'success'
        if (this.needle === 'unknown') return 'grey'
        return 'warning'
    }

    // The action the toggle performs: NEEDLE_TOGGLE takes a needle that is
    // down or between positions up.
    get toggleButtonText(): string {
        if (this.needle === 'up') return this.$t('Panels.EmbroideryPanel.ToggleToDown') as string
        if (this.needle === 'unknown') return this.$t('Panels.EmbroideryPanel.Toggle') as string
        return this.$t('Panels.EmbroideryPanel.ToggleToUp') as string
    }

    get toggleButtonColor(): string {
        return this.needle === 'up' ? 'success' : 'warning'
    }

    get hint(): string | null {
        if (this.phase === 'printing') return this.$t('Panels.EmbroideryPanel.HintPrinting') as string
        if (this.needle === 'unknown') return this.$t('Panels.EmbroideryPanel.HintHomeZ') as string
        if (this.phase === 'paused') return this.$t('Panels.EmbroideryPanel.HintPaused') as string
        return null
    }

    // Every needle macro needs a homed Z, and the job phase decides the rest.
    canRun(command: string): boolean {
        if (!this.klipperReadyForGui || this.needle === 'unknown') return false
        return embroideryCommandAllowed(command, this.phase)
    }

    send(gcode: string, loading: string): void {
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode }, { loading })
    }
}
</script>
