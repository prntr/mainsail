<template>
    <panel
        v-if="klipperReadyForGui"
        :icon="mdiNeedle"
        :title="$t('Panels.EmbroideryPanel.Headline')"
        card-class="embroidery-control-panel">
        <v-card-text>
            <!-- Needle State Display -->
            <div class="text-center mb-4">
                <v-chip :color="physicalStateColor" dark>
                    {{ physicalStateText }}
                </v-chip>
            </div>

            <!-- Needle Toggle & Stitch Buttons -->
            <v-row class="mb-4">
                <v-col cols="6">
                    <v-btn
                        block
                        large
                        :color="toggleButtonColor"
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

        </v-card-text>
    </panel>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import ControlMixin from '@/components/mixins/control'
import Panel from '@/components/ui/Panel.vue'
import { needleIcon } from '@/components/icons/needleIcon'
import { mdiArrowUp, mdiSwapVertical, mdiTarget, mdiLock } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class EmbroideryControlPanel extends Mixins(BaseMixin, ControlMixin) {
    mdiNeedle = needleIcon
    mdiArrowUp = mdiArrowUp
    mdiSwapVertical = mdiSwapVertical
    mdiTarget = mdiTarget
    mdiLock = mdiLock

    /**
     * Track physical needle position (independent of logical Z position)
     * This is needed because NEEDLE_TOGGLE uses G92 to restore Z position
     * after physical movement, so the frontend can't detect the change.
     */
    isPhysicallyDown: boolean = false

    /**
     * Get physical Z position from toolhead (actual motor position)
     */
    get physicalZPosition(): number {
        return this.$store.state.printer.toolhead?.position[2] ?? 0
    }

    /**
     * Watch physical Z position - when it returns to 0 (after homing),
     * reset the isPhysicallyDown state to match actual needle position
     */
    @Watch('physicalZPosition')
    onPhysicalZPositionChanged(newVal: number): void {
        // After homing, physical Z is 0 and needle is UP
        // Use a small threshold to account for floating point
        if (Math.abs(newVal) < 0.1) {
            this.isPhysicallyDown = false
        }
    }

    /**
     * Dynamic text for toggle button - shows the ACTION that will be performed
     * Based on physical state (not logical Z position)
     */
    get toggleButtonText(): string {
        if (this.isPhysicallyDown) {
            return this.$t('Panels.EmbroideryPanel.ToggleToUp') as string
        } else {
            return this.$t('Panels.EmbroideryPanel.ToggleToDown') as string
        }
    }

    /**
     * Button color based on physical needle state
     */
    get toggleButtonColor(): string {
        return this.isPhysicallyDown ? 'warning' : 'success'
    }

    /**
     * Physical state text for display - shows actual needle position
     * Format: "UP (0°)" or "DOWN (180°)"
     */
    get physicalStateText(): string {
        if (this.isPhysicallyDown) {
            return 'DOWN (180°)'
        } else {
            return 'UP (0°)'
        }
    }

    /**
     * Physical state color for chip display
     */
    get physicalStateColor(): string {
        return this.isPhysicallyDown ? 'warning' : 'success'
    }

    /**
     * Check if needle movements are allowed
     */
    get canMoveNeedle(): boolean {
        return this.klipperReadyForGui && !this.printerIsPrinting
    }

    /**
     * Toggle needle by moving 2.5mm (half rotation) for manual control
     * The macro uses G92 to restore Z position, so we track physical state locally
     */
    toggleNeedle(): void {
        const gcode = 'NEEDLE_TOGGLE'
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode }, { loading: 'needleToggle' })

        // Toggle physical state locally (since G92 hides the actual movement)
        this.isPhysicallyDown = !this.isPhysicallyDown
    }

    /**
     * Perform one complete stitch cycle (DOWN → UP) without changing logical Z
     */
    makeStitch(): void {
        const gcode = 'STITCH'
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode }, { loading: 'stitch' })
    }

    /**
     * Perform lock stitch - 3 rapid stitches in place to secure thread
     */
    makeLockStitch(): void {
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

        // Reset physical state - after zero, needle is assumed to be at UP
        this.isPhysicallyDown = false
    }
}
</script>

<style scoped>
.embroidery-control-panel {
    /* Custom styling for embroidery panel if needed */
}
</style>
