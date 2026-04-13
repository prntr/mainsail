<template>
    <v-menu
        v-model="showMenu"
        bottom
        :left="!isMobile"
        offset-y
        :close-on-click="true"
        :close-on-content-click="false"
        origin="center center"
        transition="slide-y-transition"
        :min-width="isMobile ? '100%' : 320">
        <template #activator="{ on, attrs }">
            <v-btn icon tile class="minwidth-0" v-bind="attrs" v-on="on">
                <v-badge :value="hasActiveController" :color="statusColor" dot overlap bordered>
                    <v-icon>{{ mdiGamepadVariant }}</v-icon>
                </v-badge>
            </v-btn>
        </template>
        <v-card flat>
            <!-- Dongle Status Header -->
            <v-card-title class="py-2">
                <v-icon left :color="dongleConnected ? 'success' : 'error'">
                    {{ mdiUsb }}
                </v-icon>
                {{ $t('App.ControllerMenu.DongleStatus') }}
                <v-spacer />
                <v-chip
                    x-small
                    :color="wsConnected ? (dongleConnected ? 'success' : 'warning') : 'error'"
                    text-color="white">
                    {{ statusChipText }}
                </v-chip>
            </v-card-title>

            <v-divider />

            <!-- Dongle Info -->
            <v-card-text v-if="dongleConnected" class="pb-2">
                <v-row dense>
                    <v-col cols="6" class="text-caption text--secondary">
                        {{ $t('App.ControllerMenu.Firmware') }}
                    </v-col>
                    <v-col cols="6" class="text-caption">
                        {{ dongleInfo.firmware_version || 'N/A' }}
                    </v-col>
                    <v-col cols="6" class="text-caption text--secondary">
                        {{ $t('App.ControllerMenu.Uptime') }}
                    </v-col>
                    <v-col cols="6" class="text-caption">
                        {{ formatUptime(dongleStatus.uptime_seconds) }}
                    </v-col>
                    <v-col cols="6" class="text-caption text--secondary">
                        {{ $t('App.ControllerMenu.RSSI') }}
                    </v-col>
                    <v-col cols="6" class="text-caption">
                        <v-icon x-small :color="rssiColor">{{ mdiWifi }}</v-icon>
                        {{ dongleStatus.rssi || 'N/A' }} dBm
                    </v-col>
                </v-row>
            </v-card-text>

            <!-- Not connected message -->
            <v-card-text v-else-if="!wsConnected" class="text-center text--secondary py-4">
                {{ $t('App.ControllerMenu.ServiceNotRunning') }}
            </v-card-text>

            <v-divider v-if="dongleConnected" />

            <!-- Controllers Section -->
            <v-subheader class="pt-2" style="height: auto">
                {{ $t('App.ControllerMenu.Controllers') }}
                <v-spacer />
                <v-chip x-small>{{ activeControllerCount }}/{{ peers.length }}</v-chip>
            </v-subheader>

            <v-card-text v-if="peers.length" class="pt-0 pb-2">
                <v-list dense class="py-0">
                    <v-list-item
                        v-for="peer in peers"
                        :key="peer.slot_id"
                        class="px-0"
                        :class="{ 'v-list-item--active': peer.active }"
                        @click="selectController(peer)">
                        <v-list-item-icon class="mr-2 my-auto">
                            <v-icon :color="peer.active ? 'success' : 'grey'">
                                {{ peer.active ? mdiGamepadVariant : mdiGamepadVariantOutline }}
                            </v-icon>
                        </v-list-item-icon>
                        <v-list-item-content>
                            <v-list-item-title class="text-caption">
                                {{ $t('App.ControllerMenu.Controller') }} #{{ peer.slot_id + 1 }}
                            </v-list-item-title>
                            <v-list-item-subtitle class="text-caption text--secondary">
                                {{ peer.mac }}
                            </v-list-item-subtitle>
                        </v-list-item-content>
                        <v-list-item-action class="my-0">
                            <v-chip x-small :color="peer.active ? 'success' : 'grey'" text-color="white">
                                {{ peer.active ? $t('App.ControllerMenu.Active') : $t('App.ControllerMenu.Idle') }}
                            </v-chip>
                        </v-list-item-action>
                    </v-list-item>
                </v-list>
            </v-card-text>
            <v-card-text v-else class="text-center text--secondary py-4">
                {{ $t('App.ControllerMenu.NoControllers') }}
            </v-card-text>

            <v-divider />

            <!-- Service Controls -->
            <v-subheader class="pt-2" style="height: auto">
                {{ $t('App.ControllerMenu.ServiceControl') }}
            </v-subheader>

            <v-card-text class="pt-0">
                <v-row dense>
                    <!-- WiFi Toggle -->
                    <v-col cols="6">
                        <v-btn
                            small
                            block
                            :color="dongleInfo.wifi_enabled ? 'success' : 'grey'"
                            :loading="loadings.includes('controllerWifi')"
                            :disabled="!dongleConnected"
                            @click="toggleWifi">
                            <v-icon left small>{{ mdiWifi }}</v-icon>
                            {{ dongleInfo.wifi_enabled ? 'WiFi ON' : 'WiFi OFF' }}
                        </v-btn>
                    </v-col>
                    <!-- Pairing Mode -->
                    <v-col cols="6">
                        <v-btn
                            small
                            block
                            :color="dongleStatus.pairing_mode ? 'warning' : 'primary'"
                            :loading="loadings.includes('controllerPairing')"
                            :disabled="!dongleConnected || !dongleInfo.wifi_enabled"
                            @click="togglePairing">
                            <v-icon left small>{{ mdiLinkVariant }}</v-icon>
                            {{
                                dongleStatus.pairing_mode
                                    ? $t('App.ControllerMenu.PairingOn')
                                    : $t('App.ControllerMenu.Pair')
                            }}
                        </v-btn>
                    </v-col>
                </v-row>

                <!-- Service Start/Stop/Restart -->
                <v-row dense class="mt-2">
                    <v-col cols="4">
                        <v-btn
                            small
                            block
                            outlined
                            color="success"
                            :loading="loadings.includes('controllerStart')"
                            :disabled="wsConnected"
                            @click="startService">
                            <v-icon small>{{ mdiPlay }}</v-icon>
                        </v-btn>
                    </v-col>
                    <v-col cols="4">
                        <v-btn
                            small
                            block
                            outlined
                            color="error"
                            :loading="loadings.includes('controllerStop')"
                            :disabled="!wsConnected"
                            @click="stopService">
                            <v-icon small>{{ mdiStop }}</v-icon>
                        </v-btn>
                    </v-col>
                    <v-col cols="4">
                        <v-btn
                            small
                            block
                            outlined
                            :loading="loadings.includes('controllerRestart')"
                            @click="restartService">
                            <v-icon small>{{ mdiRestart }}</v-icon>
                        </v-btn>
                    </v-col>
                </v-row>
            </v-card-text>

            <!-- Link Status -->
            <v-divider />
            <v-card-text class="py-2 text-center">
                <v-icon x-small :color="linkActive ? 'success' : 'warning'" class="mr-1">
                    {{ linkActive ? mdiCheckCircle : mdiAlertCircle }}
                </v-icon>
                <span class="text-caption text--secondary">
                    {{ linkActive ? $t('App.ControllerMenu.LinkActive') : $t('App.ControllerMenu.LinkInactive') }}
                </span>
            </v-card-text>
        </v-card>
    </v-menu>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import {
    mdiGamepadVariant,
    mdiGamepadVariantOutline,
    mdiUsb,
    mdiWifi,
    mdiLinkVariant,
    mdiRestart,
    mdiCheckCircle,
    mdiAlertCircle,
    mdiPlay,
    mdiStop,
} from '@mdi/js'

interface DongleInfo {
    mac: string
    firmware_version: string
    wifi_enabled: boolean
    controller_count: number
    led_brightness: number
}

interface DongleStatus {
    uptime_seconds: number
    packets_rx: number
    packets_tx: number
    crc_errors: number
    link_active: boolean
    pairing_mode: boolean
    rssi: number
}

interface PeerInfo {
    slot_id: number
    mac: string
    active: boolean
    last_seen: number
    packet_count: number
}

@Component({
    components: {},
})
export default class TheControllerMenu extends Mixins(BaseMixin) {
    mdiGamepadVariant = mdiGamepadVariant
    mdiGamepadVariantOutline = mdiGamepadVariantOutline
    mdiUsb = mdiUsb
    mdiWifi = mdiWifi
    mdiLinkVariant = mdiLinkVariant
    mdiRestart = mdiRestart
    mdiCheckCircle = mdiCheckCircle
    mdiAlertCircle = mdiAlertCircle
    mdiPlay = mdiPlay
    mdiStop = mdiStop

    showMenu = false

    mounted() {
        // Initialize WebSocket connection to live_jogd
        this.$store.dispatch('server/controller/initWebSocket')
    }

    get wsConnected(): boolean {
        return this.$store.state.server.controller?.websocket_connected ?? false
    }

    get dongleConnected(): boolean {
        return this.$store.state.server.controller?.dongle_connected ?? false
    }

    get dongleInfo(): DongleInfo {
        return (
            this.$store.state.server.controller?.dongle_info ?? {
                mac: '',
                firmware_version: '',
                wifi_enabled: false,
                controller_count: 0,
                led_brightness: 0,
            }
        )
    }

    get dongleStatus(): DongleStatus {
        return (
            this.$store.state.server.controller?.dongle_status ?? {
                uptime_seconds: 0,
                packets_rx: 0,
                packets_tx: 0,
                crc_errors: 0,
                link_active: false,
                pairing_mode: false,
                rssi: 0,
            }
        )
    }

    get peers(): PeerInfo[] {
        return this.$store.state.server.controller?.peers ?? []
    }

    get linkActive(): boolean {
        return this.dongleStatus.link_active
    }

    get hasActiveController(): boolean {
        return this.peers.some((peer) => peer.active)
    }

    get activeControllerCount(): number {
        return this.peers.filter((peer) => peer.active).length
    }

    get statusColor(): string {
        if (!this.wsConnected) return 'error'
        if (!this.dongleConnected) return 'warning'
        if (this.hasActiveController) return 'success'
        return 'warning'
    }

    get statusChipText(): string {
        if (!this.wsConnected) return this.$t('App.ControllerMenu.ServiceOffline').toString()
        if (!this.dongleConnected) return this.$t('App.ControllerMenu.Disconnected').toString()
        return this.$t('App.ControllerMenu.Connected').toString()
    }

    get rssiColor(): string {
        const rssi = this.dongleStatus.rssi
        if (rssi >= -50) return 'success'
        if (rssi >= -70) return 'warning'
        return 'error'
    }

    formatUptime(seconds: number): string {
        if (!seconds) return 'N/A'
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        if (hours > 0) {
            return `${hours}h ${minutes}m`
        }
        return `${minutes}m`
    }

    selectController(peer: PeerInfo): void {
        if (peer.active) return // Already active
        this.$store.dispatch('server/controller/selectController', peer.slot_id)
    }

    toggleWifi(): void {
        this.$store.dispatch('server/controller/toggleWifi')
    }

    togglePairing(): void {
        this.$store.dispatch('server/controller/togglePairing')
    }

    startService(): void {
        this.$store.dispatch('socket/addLoading', { name: 'controllerStart' })
        this.$socket.emit('machine.services.start', { service: 'live_jogd' }, { action: 'server/serviceStarted' })
        setTimeout(() => {
            this.$store.dispatch('socket/removeLoading', { name: 'controllerStart' })
        }, 3000)
    }

    stopService(): void {
        this.$store.dispatch('socket/addLoading', { name: 'controllerStop' })
        this.$socket.emit('machine.services.stop', { service: 'live_jogd' }, { action: 'server/serviceStopped' })
        setTimeout(() => {
            this.$store.dispatch('socket/removeLoading', { name: 'controllerStop' })
        }, 3000)
    }

    restartService(): void {
        this.$store.dispatch('socket/addLoading', { name: 'controllerRestart' })
        this.$socket.emit('machine.services.restart', { service: 'live_jogd' }, { action: 'server/serviceRestarted' })
        setTimeout(() => {
            this.$store.dispatch('socket/removeLoading', { name: 'controllerRestart' })
        }, 3000)
    }
}
</script>

<style scoped>
.v-list-item--active {
    background-color: rgba(var(--v-primary-base), 0.1);
}
</style>
