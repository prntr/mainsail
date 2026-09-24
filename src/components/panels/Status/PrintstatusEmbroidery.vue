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

    /*
     * Embroidery stats are sourced from Moonraker file metadata
     * (printer.current_file) when available. Per P0-4 of the
     * Cross-Platform Mainsail Stability plan, the dashboard does NOT
     * parse the active G-Code file in the browser to compute stitch
     * counts \u2014 anything missing falls back to lightweight Moonraker
     * progress.
     */
    get currentFile() {
        return this.$store.state.printer.current_file ?? null
    }

    get printProgress(): number {
        return this.$store.state.printer.virtual_sdcard?.progress ?? 0
    }

    get stitchCount(): number {
        const meta: any = this.currentFile
        return (
            meta?.stitchlab_intake?.stitchCount ??
            meta?.stitchlab_intake?.stats?.stitch_count ??
            meta?.stitch_count ??
            0
        )
    }

    get jumpCount(): number {
        const meta: any = this.currentFile
        return meta?.stitchlab_intake?.jumpCount ?? meta?.stitchlab_intake?.stats?.jump_count ?? meta?.jump_count ?? 0
    }

    get currentStitchIndex(): number {
        if (!this.stitchCount) return 0
        return Math.round(this.printProgress * this.stitchCount)
    }

    get progressPercent(): number {
        return Math.min(100, Math.round(this.printProgress * 100))
    }

    get designDimensions(): string {
        const meta: any = this.currentFile
        const w =
            meta?.stitchlab_intake?.designWidth ?? meta?.stitchlab_intake?.bounds?.width ?? meta?.design_width ?? 0
        const h =
            meta?.stitchlab_intake?.designHeight ?? meta?.stitchlab_intake?.bounds?.height ?? meta?.design_height ?? 0
        if (!w && !h) return '--'
        return `${w.toFixed(0)} \u00d7 ${h.toFixed(0)} mm`
    }
}
</script>
