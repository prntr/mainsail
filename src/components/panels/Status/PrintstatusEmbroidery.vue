<style scoped></style>

<template>
    <v-card-text class="pa-0">
        <v-container class="py-0">
            <v-row class="text-center py-5" align="center">
                <v-col class="col-3 pa-0">
                    <v-tooltip top>
                        <template #activator="{ on, attrs }">
                            <div v-bind="attrs" v-on="on">
                                <strong>{{ $t('Panels.StatusPanel.Stitch') }}</strong>
                                <br />
                                <span class="text-no-wrap">{{ currentStitchIndex }} / {{ stitchCount }}</span>
                            </div>
                        </template>
                        <span>{{ progressPercent }}%</span>
                    </v-tooltip>
                </v-col>
                <v-col class="col-3 pa-0">
                    <strong>{{ $t('Panels.StatusPanel.Jumps') }}</strong>
                    <br />
                    <span class="text-no-wrap">{{ jumpCount }}</span>
                </v-col>
                <v-col class="col-3 pa-0">
                    <v-tooltip top>
                        <template #activator="{ on, attrs }">
                            <div v-bind="attrs" v-on="on">
                                <strong>{{ $t('Panels.StatusPanel.Design') }}</strong>
                                <br />
                                <span class="text-no-wrap">{{ designDimensions }}</span>
                            </div>
                        </template>
                        <span>{{ $t('Panels.StatusPanel.DesignSize') }}</span>
                    </v-tooltip>
                </v-col>
                <v-col class="col-3 pa-0">
                    <strong>{{ $t('Panels.StatusPanel.Needle') }}</strong>
                    <br />
                    <span class="text-no-wrap" :class="needleStateClass">{{ needleStateText }}</span>
                </v-col>
            </v-row>
        </v-container>
    </v-card-text>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'

@Component({})
export default class StatusPanelPrintstatusEmbroidery extends Mixins(BaseMixin) {
    /**
     * Needle Z position — modulo 5mm rotation cycle.
     * 0 = UP, ~2.5 = DOWN (half rotation)
     */
    get physicalZPosition(): number {
        return this.$store.state.printer.toolhead?.position[2] ?? 0
    }

    get isNeedleDown(): boolean {
        const mod = ((this.physicalZPosition % 5) + 5) % 5
        return mod > 1.0 && mod < 4.0
    }

    get needleStateText(): string {
        return this.isNeedleDown
            ? (this.$t('Panels.StatusPanel.NeedleDown') as string)
            : (this.$t('Panels.StatusPanel.NeedleUp') as string)
    }

    get needleStateClass(): string {
        return this.isNeedleDown ? 'warning--text' : 'success--text'
    }

    /**
     * Embroidery stats shared by EmbroideryPreview via the store.
     */
    get embroideryStats() {
        return this.$store.state.printer.embroidery_stats ?? null
    }

    get filePosition(): number {
        return this.$store.state.printer.virtual_sdcard?.file_position ?? 0
    }

    get printProgress(): number {
        return this.$store.state.printer.virtual_sdcard?.progress ?? 0
    }

    get stitchCount(): number {
        return this.embroideryStats?.stitchCount ?? 0
    }

    get currentStitchIndex(): number {
        if (!this.embroideryStats) return 0

        const moveOffsets: number[] = this.embroideryStats.moveOffsets ?? []
        const stitchIndices: number[] = this.embroideryStats.stitchPointMoveIndices ?? []

        if (!moveOffsets.length || !stitchIndices.length) {
            // Fallback: estimate from progress
            if (!this.stitchCount) return 0
            return Math.round(this.printProgress * this.stitchCount)
        }

        // Find current move index from file position
        let moveIndex = 0
        for (let i = 0; i < moveOffsets.length; i++) {
            if (moveOffsets[i] <= this.filePosition) moveIndex = i
            else break
        }

        // Count stitches up to current move
        let count = 0
        for (const idx of stitchIndices) {
            if (idx <= moveIndex) count++
            else break
        }
        return count
    }

    get progressPercent(): number {
        return Math.min(100, Math.round(this.printProgress * 100))
    }

    get jumpCount(): number {
        return this.embroideryStats?.jumpCount ?? 0
    }

    get designDimensions(): string {
        const w = this.embroideryStats?.designWidth ?? 0
        const h = this.embroideryStats?.designHeight ?? 0
        if (!w && !h) return '--'
        return `${w.toFixed(0)} \u00d7 ${h.toFixed(0)} mm`
    }
}
</script>
