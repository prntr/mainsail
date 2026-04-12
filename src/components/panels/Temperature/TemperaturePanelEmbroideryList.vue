<template>
    <div class="temperature-panel__embroidery">
        <div v-for="item in items" :key="item.key" class="temperature-panel__embroidery-item">
            <div class="temperature-panel__embroidery-header">
                <div class="temperature-panel__embroidery-label">
                    <v-icon small :color="item.iconColor">{{ item.icon }}</v-icon>
                    <span>{{ item.label }}</span>
                </div>
                <strong class="temperature-panel__embroidery-value">{{ item.temperatureOutput }}</strong>
            </div>
            <v-progress-linear
                class="temperature-panel__embroidery-bar"
                height="6"
                :value="item.progress"
                :color="item.progressColor" />
            <div
                v-if="item.measuredMinTemp !== null || item.measuredMaxTemp !== null"
                class="temperature-panel__embroidery-meta text-caption">
                <span v-if="item.measuredMinTemp !== null">
                    {{ $t('Panels.TemperaturePanel.Min') }} {{ item.measuredMinTemp }}°C
                </span>
                <span v-if="item.measuredMinTemp !== null && item.measuredMaxTemp !== null">•</span>
                <span v-if="item.measuredMaxTemp !== null">
                    {{ $t('Panels.TemperaturePanel.Max') }} {{ item.measuredMaxTemp }}°C
                </span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { convertName } from '@/plugins/helpers'
import { mdiMemory, mdiThermometer } from '@mdi/js'
import { PrinterStateMcu } from '@/store/printer/types'

const EMBROIDERY_TEMPERATURE_MAX = 100
const EMBROIDERY_WARNING_TEMPERATURE = 70
const EMBROIDERY_ERROR_TEMPERATURE = 85
const HOST_SENSOR_TYPES = ['rpi_temperature', 'temperature_host']

interface TemperatureSensorValues {
    temperature: number | string
    measured_min_temp: number | string | null
    measured_max_temp: number | string | null
}

interface EmbroideryTemperatureItem {
    key: string
    icon: string
    iconColor: string
    label: string
    temperature: number | null
    temperatureOutput: string
    measuredMinTemp: string | null
    measuredMaxTemp: string | null
    progress: number
    progressColor: string
}

@Component
export default class TemperaturePanelEmbroideryList extends Mixins(BaseMixin) {
    mdiMemory = mdiMemory
    mdiThermometer = mdiThermometer

    get items(): EmbroideryTemperatureItem[] {
        const items: EmbroideryTemperatureItem[] = []

        items.push(
            this.createTemperatureItem({
                key: 'host',
                icon: this.mdiThermometer,
                label: this.hostTemperatureLabel,
                sensor: this.hostTemperatureSensor,
            })
        )

        this.mcus
            .sort((a: PrinterStateMcu, b: PrinterStateMcu) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
            )
            .forEach((mcu: PrinterStateMcu) => {
                items.push(
                    this.createTemperatureItem({
                        key: mcu.name,
                        icon: this.mdiMemory,
                        label: this.formatMcuLabel(mcu.name),
                        sensor: mcu.tempSensor,
                    })
                )
            })

        return items
    }

    get hostTemperatureSensor(): TemperatureSensorValues | null {
        return this.$store.getters['server/getHostStats']?.tempSensor ?? null
    }

    get hostTemperatureLabel(): string {
        const sensorName = this.getHostSensorShortName()
        if (sensorName) return convertName(sensorName)

        return String(this.$t('Machine.SystemPanel.Cpu'))
    }

    get mcus(): PrinterStateMcu[] {
        return this.$store.getters['printer/getMcus'] ?? []
    }

    get printerSettings() {
        return this.$store.state.printer?.configfile?.settings ?? {}
    }

    formatMcuLabel(name: string): string {
        const label = String(this.$t('Settings.WebcamsTab.IconMcu'))
        const suffix = name.replace(/^mcu\b/i, '').trim()

        if (!suffix) return label

        return `${label} ${convertName(suffix)}`
    }

    createTemperatureItem(payload: {
        key: string
        icon: string
        label: string
        sensor: TemperatureSensorValues | null
    }): EmbroideryTemperatureItem {
        const temperature = this.normalizeNumber(payload.sensor?.temperature)

        return {
            key: payload.key,
            icon: payload.icon,
            iconColor: this.getTemperatureColor(temperature, true),
            label: payload.label,
            temperature,
            temperatureOutput: temperature === null ? '--°C' : `${temperature}°C`,
            measuredMinTemp: this.formatMeasuredTemperature(payload.sensor?.measured_min_temp),
            measuredMaxTemp: this.formatMeasuredTemperature(payload.sensor?.measured_max_temp),
            progress:
                temperature === null ? 0 : Math.min(Math.max((temperature / EMBROIDERY_TEMPERATURE_MAX) * 100, 0), 100),
            progressColor: this.getTemperatureColor(temperature),
        }
    }

    getHostSensorShortName(): string {
        for (const [fullName, settings] of Object.entries(this.printerSettings)) {
            if (!HOST_SENSOR_TYPES.includes(settings?.sensor_type ?? '')) continue

            const splits = fullName.split(' ')
            return splits.length > 1 ? splits.slice(1).join(' ') : fullName
        }

        return ''
    }

    normalizeNumber(value: number | string | null | undefined): number | null {
        if (value === null || value === undefined) return null

        const output = Number(value)

        return Number.isFinite(output) ? Math.round(output) : null
    }

    formatMeasuredTemperature(value: number | string | null | undefined): string | null {
        if (value === null || value === undefined) return null

        const output = Number(value)
        if (!Number.isFinite(output)) return null

        return output.toFixed(1)
    }

    getTemperatureColor(temperature: number | null, allowMuted = false): string {
        if (temperature === null) return allowMuted ? 'grey' : 'primary'
        if (temperature >= EMBROIDERY_ERROR_TEMPERATURE) return 'error'
        if (temperature >= EMBROIDERY_WARNING_TEMPERATURE) return 'warning'

        return 'primary'
    }
}
</script>

<style scoped>
.temperature-panel__embroidery {
    display: grid;
    gap: 10px;
    padding: 14px 16px 16px;
}

.temperature-panel__embroidery-item {
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 12px;
}

.temperature-panel__embroidery-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.temperature-panel__embroidery-label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-weight: 600;
}

.temperature-panel__embroidery-label span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.temperature-panel__embroidery-value {
    flex-shrink: 0;
    font-size: 1.05rem;
    line-height: 1;
}

.temperature-panel__embroidery-bar {
    border-radius: 999px;
    overflow: hidden;
}

.temperature-panel__embroidery-meta {
    display: flex;
    align-items: center;
    gap: 6px;
}
</style>
