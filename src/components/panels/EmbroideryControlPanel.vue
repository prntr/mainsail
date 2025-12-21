<template>
    <panel
        v-if="klipperReadyForGui"
        :icon="mdiNeedle"
        :title="$t('Panels.EmbroideryPanel.Headline')"
        card-class="embroidery-control-panel">
        <v-card-text>
            <!-- Current Needle Position Display -->
            <div class="text-center mb-4">
                <div class="text-h6">
                    {{ $t('Panels.EmbroideryPanel.CurrentPosition') }}:
                    <strong>{{ currentZPosition.toFixed(2) }}mm</strong>
                </div>
                <div class="mb-2">
                    <v-chip small :color="needleStateColor" dark>
                        {{ needleState }}
                    </v-chip>
                </div>
                <div class="text-caption grey--text">
                    ({{ stitchCount }} {{ $t('Panels.EmbroideryPanel.Stitches') }})
                </div>
            </div>

            <!-- Needle Toggle & Stitch Buttons -->
            <v-row class="mb-4">
                <v-col cols="6">
                    <v-btn
                        block
                        large
                        :color="needleStateColor"
                        :disabled="!canMoveNeedle"
                        :loading="loadings.includes('needleToggle')"
                        @click="toggleNeedle">
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
                        color="primary"
                        :disabled="!canMoveNeedle"
                        :loading="loadings.includes('stitch')"
                        @click="makeStitch">
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
                class="mb-4"
                :disabled="!canMoveNeedle"
                :loading="loadings.includes('lockStitch')"
                @click="makeLockStitch">
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
                :disabled="!klipperReadyForGui"
                :loading="loadings.includes('zeroNeedle')"
                @click="zeroNeedlePosition">
                <v-icon left>
                    {{ mdiTarget }}
                </v-icon>
                {{ $t('Panels.EmbroideryPanel.ZeroPosition') }}
            </v-btn>

            <!-- Last Position Info -->
            <div v-if="lastPositionBeforeMove !== null" class="text-caption text-center mt-3 grey--text">
                {{ $t('Panels.EmbroideryPanel.LastPosition') }}: {{ lastPositionBeforeMove.toFixed(2) }}mm
            </div>
        </v-card-text>
    </panel>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ControlMixin from '@/components/mixins/control'
import Panel from '@/components/ui/Panel.vue'
import { mdiNeedle, mdiArrowUp, mdiSwapVertical, mdiTarget, mdiLock } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class EmbroideryControlPanel extends Mixins(BaseMixin, ControlMixin) {
    mdiNeedle = mdiNeedle
    mdiArrowUp = mdiArrowUp
    mdiSwapVertical = mdiSwapVertical
    mdiTarget = mdiTarget
    mdiLock = mdiLock

    lastPositionBeforeMove: number | null = null

    /**
     * Get current Z position from printer state
     */
    get currentZPosition(): number {
        return this.$store.state.printer.toolhead?.position[2] ?? 0
    }

    /**
     * Calculate stitch count based on Z position
     * 5mm = 1 complete stitch (full rotation)
     */
    get stitchCount(): number {
        return Math.floor(this.currentZPosition / 5)
    }

    /**
     * Determine if needle is UP, DOWN, or BETWEEN
     */
    get needleState(): string {
        const zMod = this.currentZPosition % 5.0
        if (zMod < 0.5 || zMod > 4.5) {
            return 'UP (0°)'
        } else if (zMod > 1.5 && zMod < 3.5) {
            return 'DOWN (180°)'
        } else {
            return 'BETWEEN'
        }
    }

    /**
     * Color for needle state indicator
     */
    get needleStateColor(): string {
        const zMod = this.currentZPosition % 5.0
        if (zMod < 0.5 || zMod > 4.5) {
            return 'success' // Green for UP
        } else if (zMod > 1.5 && zMod < 3.5) {
            return 'warning' // Orange for DOWN
        } else {
            return 'grey' // Grey for BETWEEN
        }
    }

    /**
     * Dynamic text for toggle button - shows current needle state
     */
    get toggleButtonText(): string {
        const zMod = this.currentZPosition % 5.0
        if (zMod < 0.5 || zMod > 4.5) {
            return this.$t('Panels.EmbroideryPanel.NeedleUp') as string
        } else if (zMod > 1.5 && zMod < 3.5) {
            return this.$t('Panels.EmbroideryPanel.NeedleDown') as string
        } else {
            return this.$t('Panels.EmbroideryPanel.NeedleBetween') as string
        }
    }

    /**
     * Check if needle movements are allowed
     */
    get canMoveNeedle(): boolean {
        return this.klipperReadyForGui && !this.printerIsPrinting
    }

    /**
     * Toggle needle by moving 2.5mm (half rotation) for manual control
     */
    toggleNeedle(): void {
        const gcode = 'NEEDLE_TOGGLE'
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode }, { loading: 'needleToggle' })
    }

    /**
     * Advance one complete stitch (5mm Z movement)
     */
    makeStitch(): void {
        this.lastPositionBeforeMove = this.currentZPosition

        const gcode = 'STITCH'
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode }, { loading: 'stitch' })
    }

    /**
     * Perform lock stitch - 3 rapid stitches in place to secure thread
     */
    makeLockStitch(): void {
        this.lastPositionBeforeMove = this.currentZPosition

        const gcode = 'LOCK_STITCH'
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode }, { loading: 'lockStitch' })
    }

    /**
     * Zero the needle position without homing
     * Uses ZERO_NEEDLE_POSITION macro (which uses G92 Z0)
     */
    zeroNeedlePosition(): void {
        const gcode = 'ZERO_NEEDLE_POSITION'
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode }, { loading: 'zeroNeedle' })

        // Reset last position tracker
        this.lastPositionBeforeMove = null
    }
}
</script>

<style scoped>
.embroidery-control-panel {
    /* Custom styling for embroidery panel if needed */
}
</style>
