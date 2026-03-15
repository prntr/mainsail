<template>
    <v-icon :color="iconColor" :size="size">{{ iconPath }}</v-icon>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { mdiWifi, mdiWifiStrength1, mdiWifiStrength2, mdiWifiStrength3, mdiWifiStrength4, mdiWifiStrength1Lock, mdiWifiStrength2Lock, mdiWifiStrength3Lock, mdiWifiStrength4Lock } from '@mdi/js'

@Component
export default class WifiSignalIcon extends Vue {
    @Prop({ type: Number, default: 0 })
    declare readonly signal: number

    @Prop({ type: Boolean, default: false })
    declare readonly secured: boolean

    @Prop({ type: Number, default: 24 })
    declare readonly size: number

    get iconPath(): string {
        const strength = this.signalStrength

        if (this.secured) {
            if (strength >= 4) return mdiWifiStrength4Lock
            if (strength >= 3) return mdiWifiStrength3Lock
            if (strength >= 2) return mdiWifiStrength2Lock
            return mdiWifiStrength1Lock
        }

        if (strength >= 4) return mdiWifiStrength4
        if (strength >= 3) return mdiWifiStrength3
        if (strength >= 2) return mdiWifiStrength2
        if (strength >= 1) return mdiWifiStrength1
        return mdiWifi
    }

    get signalStrength(): number {
        if (this.signal >= 80) return 4
        if (this.signal >= 60) return 3
        if (this.signal >= 40) return 2
        if (this.signal >= 20) return 1
        return 0
    }

    get iconColor(): string {
        if (this.signal >= 60) return 'success'
        if (this.signal >= 40) return 'warning'
        return 'error'
    }
}
</script>
