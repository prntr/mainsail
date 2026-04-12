<template>
    <panel
        v-if="klipperReadyForGui && showPanel"
        :icon="mdiThermometerLines"
        :title="$t('Panels.TemperaturePanel.Headline')"
        :collapsible="true"
        card-class="temperature-panel">
        <template v-if="!isEmbroideryMode" #buttons>
            <temperature-panel-presets />
            <temperature-panel-settings />
        </template>
        <v-card-text class="pa-0">
            <temperature-panel-embroidery-list v-if="isEmbroideryMode" />
            <template v-else>
                <temperature-panel-list />
            </template>
            <template v-if="boolTempchart && !isEmbroideryMode">
                <v-divider class="my-0" />
                <temp-chart />
            </template>
        </v-card-text>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import TempChart from '@/components/charts/TempChart.vue'
import Panel from '@/components/ui/Panel.vue'
import { mdiThermometerLines } from '@mdi/js'
import TemperaturePanelPresets from '@/components/panels/Temperature/TemperaturePanelPresets.vue'
import TemperaturePanelEmbroideryList from '@/components/panels/Temperature/TemperaturePanelEmbroideryList.vue'
import { PrinterStateMcu } from '@/store/printer/types'

@Component({
    components: { Panel, TempChart, TemperaturePanelPresets, TemperaturePanelEmbroideryList },
})
export default class TemperaturePanel extends Mixins(BaseMixin) {
    mdiThermometerLines = mdiThermometerLines

    get boolTempchart(): boolean {
        return this.$store.state.gui.view.tempchart.boolTempchart ?? false
    }

    get isEmbroideryMode(): boolean {
        return (this.$store.state.gui.uiSettings?.theme ?? '') === 'stitchlab'
    }

    get showPanel(): boolean {
        if (!this.isEmbroideryMode) return true

        return this.hasEmbroideryHostStats || this.hasEmbroideryMcu
    }

    get hasEmbroideryHostStats(): boolean {
        return this.$store.getters['server/getHostStats'] !== null
    }

    get hasEmbroideryMcu(): boolean {
        const mcus = this.$store.getters['printer/getMcus'] ?? []

        return mcus.some((mcu: PrinterStateMcu) => mcu !== null)
    }
}
</script>
