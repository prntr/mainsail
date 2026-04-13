<template>
    <div>
        <!-- Main View -->
        <v-card v-if="!showForm" flat>
            <v-card-text>
                <h3 class="text-h5 mb-3">{{ $t('Settings.WifiTab.Wifi') }}</h3>

                <!-- Connection Status -->
                <v-alert :type="statusAlertType" :icon="statusIcon" text dense class="mb-4">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <strong>{{ statusText }}</strong>
                            <div v-if="currentSsid" class="text-body-2">
                                {{ currentSsid }}
                                <span v-if="currentIp" class="ml-2 text--secondary">({{ currentIp }})</span>
                            </div>
                        </div>
                        <div v-if="isConnected" class="d-flex align-center">
                            <wifi-signal-icon :signal="signalStrength" class="mr-2" />
                            <span class="text-body-2">{{ signalStrength }}%</span>
                        </div>
                    </div>
                </v-alert>

                <!-- AP Mode Warning -->
                <v-alert v-if="isApMode" type="info" text dense class="mb-4">
                    <div class="d-flex align-center justify-space-between">
                        <div>
                            <strong>{{ $t('Settings.WifiTab.ApModeActive') }}</strong>
                            <div class="text-body-2">
                                {{ $t('Settings.WifiTab.ApModeDescription') }}
                            </div>
                        </div>
                        <v-btn small color="primary" :loading="isConnecting" @click="disableAp">
                            {{ $t('Settings.WifiTab.DisableAp') }}
                        </v-btn>
                    </div>
                </v-alert>

                <!-- Saved Profiles Section -->
                <div class="mb-6">
                    <div class="d-flex align-center justify-space-between mb-2">
                        <span class="text-subtitle-1 font-weight-medium">
                            {{ $t('Settings.WifiTab.SavedNetworks') }}
                        </span>
                    </div>

                    <v-list v-if="wifiProfiles.length" dense class="py-0">
                        <draggable v-model="sortedProfiles" handle=".drag-handle" @end="onProfileReorder">
                            <v-list-item v-for="profile in sortedProfiles" :key="profile.name" class="px-0">
                                <v-list-item-icon class="drag-handle mr-2" style="cursor: grab">
                                    <v-icon small>{{ mdiDrag }}</v-icon>
                                </v-list-item-icon>
                                <v-list-item-icon class="mr-3">
                                    <v-icon :color="isCurrentProfile(profile) ? 'success' : ''">
                                        {{ mdiWifi }}
                                    </v-icon>
                                </v-list-item-icon>
                                <v-list-item-content>
                                    <v-list-item-title>{{ profile.ssid || profile.name }}</v-list-item-title>
                                    <v-list-item-subtitle v-if="isCurrentProfile(profile)">
                                        {{ $t('Settings.WifiTab.Connected') }}
                                    </v-list-item-subtitle>
                                </v-list-item-content>
                                <v-list-item-action class="flex-row">
                                    <v-btn
                                        v-if="!isCurrentProfile(profile)"
                                        small
                                        text
                                        color="primary"
                                        :loading="isConnecting"
                                        @click="connectToProfile(profile)">
                                        {{ $t('Settings.WifiTab.Connect') }}
                                    </v-btn>
                                    <v-btn
                                        small
                                        icon
                                        color="error"
                                        :disabled="isCurrentProfile(profile)"
                                        @click="forgetProfile(profile)">
                                        <v-icon small>{{ mdiDelete }}</v-icon>
                                    </v-btn>
                                </v-list-item-action>
                            </v-list-item>
                        </draggable>
                    </v-list>
                    <div v-else class="text--secondary text-body-2">
                        {{ $t('Settings.WifiTab.NoSavedNetworks') }}
                    </div>
                </div>

                <v-divider class="mb-4" />

                <!-- Available Networks Section -->
                <div class="mb-4">
                    <div class="d-flex align-center justify-space-between mb-2">
                        <span class="text-subtitle-1 font-weight-medium">
                            {{ $t('Settings.WifiTab.AvailableNetworks') }}
                        </span>
                        <v-btn small text :loading="isScanning" @click="scanNetworks">
                            <v-icon left small>{{ mdiRefresh }}</v-icon>
                            {{ $t('Settings.WifiTab.Scan') }}
                        </v-btn>
                    </div>

                    <v-list v-if="sortedNetworks.length" dense class="py-0">
                        <v-list-item
                            v-for="network in sortedNetworks"
                            :key="network.ssid"
                            class="px-0"
                            @click="selectNetwork(network)">
                            <v-list-item-icon class="mr-3">
                                <wifi-signal-icon :signal="network.signal" :secured="network.security !== 'Open'" />
                            </v-list-item-icon>
                            <v-list-item-content>
                                <v-list-item-title>{{ network.ssid }}</v-list-item-title>
                                <v-list-item-subtitle>
                                    <v-chip v-if="network.saved" x-small color="success" outlined class="mr-1">
                                        {{ $t('Settings.WifiTab.Saved') }}
                                    </v-chip>
                                    <v-chip v-if="network.in_use" x-small color="primary" outlined class="mr-1">
                                        {{ $t('Settings.WifiTab.Connected') }}
                                    </v-chip>
                                    <span class="text--secondary">{{ network.security }}</span>
                                </v-list-item-subtitle>
                            </v-list-item-content>
                            <v-list-item-action>
                                <span class="text-body-2 text--secondary">{{ network.signal }}%</span>
                            </v-list-item-action>
                        </v-list-item>
                    </v-list>
                    <div v-else-if="!isScanning" class="text--secondary text-body-2">
                        {{ $t('Settings.WifiTab.NoNetworksFound') }}
                    </div>
                    <div v-else class="d-flex justify-center py-4">
                        <v-progress-circular indeterminate color="primary" />
                    </div>
                </div>

                <v-divider class="mb-4" />

                <!-- Access Point Settings -->
                <div>
                    <div class="d-flex align-center justify-space-between mb-2">
                        <span class="text-subtitle-1 font-weight-medium">
                            {{ $t('Settings.WifiTab.AccessPointSettings') }}
                        </span>
                        <v-btn v-if="!isApMode" small text color="warning" :loading="isConnecting" @click="enableAp">
                            <v-icon left small>{{ mdiAccessPoint }}</v-icon>
                            {{ $t('Settings.WifiTab.EnableAp') }}
                        </v-btn>
                    </div>

                    <settings-row :title="$t('Settings.WifiTab.ApUrl')" :sub-title="$t('Settings.WifiTab.ApUrlHint')">
                        <div class="d-flex flex-column align-end">
                            <a v-if="apAccessUrl" :href="apAccessUrl" target="_blank" rel="noopener">
                                {{ apAccessUrl }}
                            </a>
                            <span v-else class="text-body-2 text--secondary">
                                {{ $t('Settings.WifiTab.ApUrlUnknown') }}
                            </span>
                        </div>
                    </settings-row>
                    <v-divider class="my-2" />

                    <settings-row :title="$t('Settings.WifiTab.ApSsid')">
                        <v-text-field v-model="apSsidEditable" dense outlined hide-details style="max-width: 200px" />
                    </settings-row>
                    <v-divider class="my-2" />
                    <settings-row :title="$t('Settings.WifiTab.ApPassword')">
                        <v-text-field
                            v-model="apForm.password"
                            dense
                            outlined
                            hide-details
                            type="text"
                            :placeholder="$t('Settings.WifiTab.ApPasswordPlaceholder')"
                            style="max-width: 200px" />
                    </settings-row>
                    <div class="d-flex justify-end mt-3">
                        <v-btn
                            small
                            color="primary"
                            :disabled="!apFormChanged"
                            :loading="isSavingAp"
                            @click="saveApSettings">
                            {{ $t('Settings.Save') }}
                        </v-btn>
                    </div>
                </div>

                <v-expansion-panels class="mt-4" flat>
                    <v-expansion-panel>
                        <v-expansion-panel-header>
                            {{ $t('Settings.WifiTab.DebugTitle') }}
                        </v-expansion-panel-header>
                        <v-expansion-panel-content>
                            <div class="text-caption text--secondary mb-1">
                                {{ $t('Settings.WifiTab.DebugProfiles') }}
                            </div>
                            <pre class="wifi-debug">{{ formattedProfilesPayload }}</pre>
                            <div class="text-caption text--secondary mb-1 mt-3">
                                {{ $t('Settings.WifiTab.DebugScan') }}
                            </div>
                            <pre class="wifi-debug">{{ formattedScanPayload }}</pre>
                        </v-expansion-panel-content>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-card-text>

            <v-card-actions class="d-flex justify-end">
                <v-btn text color="primary" @click="showAddNetworkForm">
                    {{ $t('Settings.WifiTab.AddNetwork') }}
                </v-btn>
            </v-card-actions>
        </v-card>

        <!-- Add/Connect Network Form -->
        <v-card v-else flat>
            <v-card-title>
                {{ formTitle }}
            </v-card-title>
            <v-card-text>
                <settings-row :title="$t('Settings.WifiTab.NetworkName')">
                    <v-text-field
                        v-model="networkForm.ssid"
                        dense
                        outlined
                        hide-details
                        :disabled="!!selectedNetwork"
                        :placeholder="$t('Settings.WifiTab.SsidPlaceholder')" />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row
                    v-if="networkFormNeedsPassword"
                    :title="$t('Settings.WifiTab.Password')"
                    :sub-title="$t('Settings.WifiTab.PasswordHint')">
                    <v-text-field
                        v-model="networkForm.password"
                        dense
                        outlined
                        hide-details
                        :type="showPassword ? 'text' : 'password'"
                        :append-icon="showPassword ? mdiEyeOff : mdiEye"
                        @click:append="showPassword = !showPassword" />
                </settings-row>

                <!-- Connection Warning -->
                <v-alert v-if="showConnectionWarning" type="warning" text dense class="mt-4">
                    <strong>{{ $t('Settings.WifiTab.ConnectionWarningTitle') }}</strong>
                    <div class="text-body-2 mt-1">
                        {{ $t('Settings.WifiTab.ConnectionWarningText') }}
                    </div>
                    <div v-if="networkForm.ssid" class="text-body-2 mt-2">
                        {{ $t('Settings.WifiTab.NewNetworkHint', { ssid: networkForm.ssid }) }}
                    </div>
                </v-alert>
            </v-card-text>
            <v-card-actions class="d-flex justify-end">
                <v-btn text @click="cancelForm">{{ $t('Settings.Cancel') }}</v-btn>
                <v-btn
                    v-if="!selectedNetwork"
                    text
                    color="secondary"
                    :loading="isConnecting"
                    :disabled="!canSubmitForm"
                    @click="saveNetworkOnly">
                    {{ $t('Settings.WifiTab.SaveOnly') }}
                </v-btn>
                <v-btn
                    text
                    color="primary"
                    :loading="isConnecting"
                    :disabled="!canSubmitForm"
                    @click="submitNetworkForm">
                    {{ selectedNetwork ? $t('Settings.WifiTab.Connect') : $t('Settings.WifiTab.AddAndConnect') }}
                </v-btn>
            </v-card-actions>
        </v-card>

        <!-- Forget Confirmation Dialog -->
        <v-dialog v-model="showForgetDialog" max-width="400">
            <v-card>
                <v-card-title>{{ $t('Settings.WifiTab.ForgetNetwork') }}</v-card-title>
                <v-card-text>
                    {{ $t('Settings.WifiTab.ForgetConfirmation', { name: profileToForget?.name }) }}
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn text @click="showForgetDialog = false">{{ $t('Settings.Cancel') }}</v-btn>
                    <v-btn text color="error" @click="confirmForget">{{ $t('Settings.WifiTab.Forget') }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import SettingsRow from '@/components/settings/SettingsRow.vue'
import WifiSignalIcon from '@/components/settings/Wifi/WifiSignalIcon.vue'
import draggable from 'vuedraggable'
import { WifiNetwork, WifiProfile } from '@/store/server/wifiManager/types'
import {
    mdiWifi,
    mdiWifiOff,
    mdiAccessPoint,
    mdiDelete,
    mdiRefresh,
    mdiEye,
    mdiEyeOff,
    mdiDrag,
    mdiCheckCircle,
    mdiAlertCircle,
} from '@mdi/js'

interface NetworkForm {
    ssid: string
    password: string
}

interface ApForm {
    ssid: string
    password: string
}

@Component({
    components: {
        SettingsRow,
        WifiSignalIcon,
        draggable,
    },
})
export default class SettingsWifiTab extends Mixins(BaseMixin) {
    mdiWifi = mdiWifi
    mdiWifiOff = mdiWifiOff
    mdiAccessPoint = mdiAccessPoint
    mdiDelete = mdiDelete
    mdiRefresh = mdiRefresh
    mdiEye = mdiEye
    mdiEyeOff = mdiEyeOff
    mdiDrag = mdiDrag

    showForm = false
    showPassword = false
    showForgetDialog = false
    isSavingAp = false
    profileToForget: WifiProfile | null = null
    selectedNetwork: WifiNetwork | null = null

    networkForm: NetworkForm = {
        ssid: '',
        password: '',
    }

    apForm = {
        password: '',
    }

    sortedProfiles: WifiProfile[] = []

    mounted() {
        this.$store.dispatch('server/wifiManager/fetchStatus')
        this.$store.dispatch('server/wifiManager/fetchProfiles')
        this.$store.dispatch('server/wifiManager/fetchApConfig')
        this.scanNetworks()
        this.updateSortedProfiles()
        this.syncApForm()
    }

    get isAvailable(): boolean {
        return this.$store.getters['server/wifiManager/isAvailable']
    }

    get isConnected(): boolean {
        return this.$store.getters['server/wifiManager/isConnected']
    }

    get isApMode(): boolean {
        return this.$store.getters['server/wifiManager/isApMode']
    }

    get isDisconnected(): boolean {
        return this.$store.getters['server/wifiManager/isDisconnected']
    }

    get currentSsid(): string | null {
        return this.$store.getters['server/wifiManager/currentSsid']
    }

    get currentIp(): string | null {
        return this.$store.getters['server/wifiManager/currentIp']
    }

    get signalStrength(): number {
        return this.$store.getters['server/wifiManager/signalStrength']
    }

    get wifiProfiles(): WifiProfile[] {
        return this.$store.getters['server/wifiManager/wifiProfiles']
    }

    get sortedNetworks(): WifiNetwork[] {
        return this.$store.getters['server/wifiManager/sortedNetworks']
    }

    get apSsid(): string | null {
        return this.$store.getters['server/wifiManager/apSsid']
    }

    get apIp(): string | null {
        return this.$store.getters['server/wifiManager/apIp']
    }

    get apAccessUrl(): string | null {
        const ip = this.apIp?.split('/')[0]
        return ip ? `http://${ip}/` : null
    }

    get apSsidStored(): string {
        return this.$store.state.gui?.wifi?.apSsid ?? ''
    }

    get apPasswordStored(): string {
        return this.$store.state.gui?.wifi?.apPassword ?? ''
    }

    get lastProfilesPayload(): any {
        return this.$store.state.server.wifiManager.lastProfilesPayload
    }

    get lastScanPayload(): any {
        return this.$store.state.server.wifiManager.lastScanPayload
    }

    // Editable AP SSID - initialized from store, can be modified by user
    apSsidLocal: string = ''

    get apSsidEditable(): string {
        if (this.apSsidLocal !== '') return this.apSsidLocal
        if (this.apSsidStored) return this.apSsidStored
        if (this.apSsid) return this.apSsid
        return ''
    }

    set apSsidEditable(value: string) {
        this.apSsidLocal = value
    }

    get isScanning(): boolean {
        return this.$store.state.server.wifiManager.isScanning
    }

    get isConnecting(): boolean {
        return this.$store.state.server.wifiManager.isConnecting
    }

    get statusAlertType(): string {
        if (this.isConnected) return 'success'
        if (this.isApMode) return 'warning'
        return 'error'
    }

    get statusIcon(): string {
        if (this.isConnected) return mdiCheckCircle
        if (this.isApMode) return mdiAccessPoint
        return mdiAlertCircle
    }

    get statusText(): string {
        if (this.isConnected) return this.$t('Settings.WifiTab.StatusConnected').toString()
        if (this.isApMode) return this.$t('Settings.WifiTab.StatusApMode').toString()
        return this.$t('Settings.WifiTab.StatusDisconnected').toString()
    }

    get formTitle(): string {
        if (this.selectedNetwork) {
            return this.$t('Settings.WifiTab.ConnectTo', { ssid: this.selectedNetwork.ssid }).toString()
        }
        return this.$t('Settings.WifiTab.AddNetwork').toString()
    }

    get networkFormNeedsPassword(): boolean {
        if (this.selectedNetwork) {
            return this.selectedNetwork.security !== 'Open' && !this.selectedNetwork.saved
        }
        return true
    }

    get showConnectionWarning(): boolean {
        // Show warning when connecting to a different network
        return this.showForm && this.networkForm.ssid !== this.currentSsid
    }

    get canSubmitForm(): boolean {
        if (!this.networkForm.ssid) return false
        if (this.networkFormNeedsPassword && !this.networkForm.password) return false
        return true
    }

    get apFormChanged(): boolean {
        // Check if SSID was changed from original
        const baseSsid = this.apSsidStored || this.apSsid || ''
        const ssidChanged = this.apSsidEditable !== baseSsid
        const passwordChanged = this.apForm.password.length > 0 && this.apForm.password !== this.apPasswordStored
        return ssidChanged || passwordChanged
    }

    get formattedProfilesPayload(): string {
        return this.formatWifiPayload(this.lastProfilesPayload)
    }

    get formattedScanPayload(): string {
        return this.formatWifiPayload(this.lastScanPayload)
    }

    @Watch('apSsidStored')
    onApSsidStoredChanged() {
        this.syncApForm()
    }

    @Watch('apPasswordStored')
    onApPasswordStoredChanged() {
        this.syncApForm()
    }

    @Watch('apSsid')
    onApSsidChanged() {
        this.syncApForm()
    }

    @Watch('wifiProfiles', { deep: true, immediate: true })
    onWifiProfilesChanged() {
        this.updateSortedProfiles()
    }

    updateSortedProfiles() {
        this.sortedProfiles = [...this.wifiProfiles].sort((a, b) => b.priority - a.priority)
    }

    isCurrentProfile(profile: WifiProfile): boolean {
        return profile.ssid === this.currentSsid || profile.name === this.currentSsid
    }

    scanNetworks() {
        this.$store.dispatch('server/wifiManager/fetchNetworks')
    }

    selectNetwork(network: WifiNetwork) {
        this.selectedNetwork = network
        this.networkForm.ssid = network.ssid
        this.networkForm.password = ''
        this.showPassword = false

        if (network.saved || network.security === 'Open') {
            // Connect directly
            this.connectToNetwork(network.ssid)
        } else {
            // Show password form
            this.showForm = true
        }
    }

    showAddNetworkForm() {
        this.selectedNetwork = null
        this.networkForm = { ssid: '', password: '' }
        this.showPassword = false
        this.showForm = true
    }

    cancelForm() {
        this.showForm = false
        this.selectedNetwork = null
        this.networkForm = { ssid: '', password: '' }
    }

    async saveNetworkOnly() {
        try {
            await this.$store.dispatch('server/wifiManager/addNetwork', {
                ssid: this.networkForm.ssid,
                password: this.networkForm.password || undefined,
            })
            this.cancelForm()
            this.$toast.success(this.$t('Settings.WifiTab.NetworkSaved', { ssid: this.networkForm.ssid }).toString())
            // Refresh profiles after adding
            this.$store.dispatch('server/wifiManager/fetchProfiles')
        } catch (e: any) {
            this.$toast.error(e.message || this.$t('Settings.WifiTab.SaveFailed').toString())
        }
    }

    async submitNetworkForm() {
        try {
            const payload = {
                ssid: this.networkForm.ssid,
                password: this.networkForm.password || undefined,
            }
            if (!this.selectedNetwork || !this.selectedNetwork.saved) {
                await this.$store.dispatch('server/wifiManager/addNetwork', payload)
                this.$store.dispatch('server/wifiManager/fetchProfiles')
            }
            await this.$store.dispatch('server/wifiManager/connect', payload)
            this.cancelForm()
            this.$toast.success(this.$t('Settings.WifiTab.ConnectingTo', { ssid: this.networkForm.ssid }).toString())
        } catch (e: any) {
            this.$toast.error(e.message || this.$t('Settings.WifiTab.ConnectionFailed').toString())
        }
    }

    async connectToNetwork(ssid: string, password?: string) {
        try {
            await this.$store.dispatch('server/wifiManager/connect', { ssid, password })
            this.$toast.success(this.$t('Settings.WifiTab.ConnectingTo', { ssid }).toString())
        } catch (e: any) {
            this.$toast.error(e.message || this.$t('Settings.WifiTab.ConnectionFailed').toString())
        }
    }

    async connectToProfile(profile: WifiProfile) {
        await this.connectToNetwork(profile.name)
    }

    forgetProfile(profile: WifiProfile) {
        this.profileToForget = profile
        this.showForgetDialog = true
    }

    async confirmForget() {
        if (!this.profileToForget) return

        try {
            await this.$store.dispatch('server/wifiManager/forgetProfile', this.profileToForget.name)
            this.$toast.success(this.$t('Settings.WifiTab.NetworkForgotten').toString())
            this.updateSortedProfiles()
        } catch (e: any) {
            this.$toast.error(e.message)
        } finally {
            this.showForgetDialog = false
            this.profileToForget = null
        }
    }

    async onProfileReorder() {
        // Update priorities based on new order (higher index = higher priority)
        const updates = this.sortedProfiles.map((profile, index) => ({
            profile: profile.name,
            priority: this.sortedProfiles.length - index,
        }))

        for (const update of updates) {
            try {
                await this.$store.dispatch('server/wifiManager/setPriority', update)
            } catch (e) {
                console.error('Failed to update priority:', e)
            }
        }
    }

    async enableAp() {
        try {
            await this.$store.dispatch('server/wifiManager/enableAp')
            this.$toast.warning(this.$t('Settings.WifiTab.ApEnabled').toString())
        } catch (e: any) {
            this.$toast.error(e.message)
        }
    }

    async disableAp() {
        try {
            await this.$store.dispatch('server/wifiManager/disableAp')
            this.$toast.success(this.$t('Settings.WifiTab.ApDisabled').toString())
        } catch (e: any) {
            this.$toast.error(e.message)
        }
    }

    async saveApSettings() {
        this.isSavingAp = true
        try {
            const payload: { ssid?: string; password?: string } = {}
            const baseSsid = this.apSsidStored || this.apSsid || ''
            const targetSsid = this.apSsidEditable.trim()
            if (targetSsid && targetSsid !== baseSsid) {
                payload.ssid = targetSsid
            }
            if (this.apForm.password && this.apForm.password !== this.apPasswordStored) {
                payload.password = this.apForm.password
            }

            await this.$store.dispatch('server/wifiManager/configureAp', payload)
            this.$toast.success(this.$t('Settings.WifiTab.ApSettingsSaved').toString())

            if (targetSsid) {
                this.$store.dispatch('gui/saveSetting', { name: 'wifi.apSsid', value: targetSsid })
            }
            if (this.apForm.password) {
                this.$store.dispatch('gui/saveSetting', { name: 'wifi.apPassword', value: this.apForm.password })
            }

            // Refresh AP config to show updated values
            this.$store.dispatch('server/wifiManager/fetchApConfig')
        } catch (e: any) {
            this.$toast.error(e.message)
        } finally {
            this.isSavingAp = false
        }
    }

    syncApForm() {
        if (!this.apSsidLocal) {
            const fallbackSsid = this.apSsidStored || this.apSsid || ''
            if (fallbackSsid) {
                this.apSsidLocal = fallbackSsid
            }
        }
        if (!this.apForm.password && this.apPasswordStored) {
            this.apForm.password = this.apPasswordStored
        }
    }

    formatWifiPayload(payload: any): string {
        if (payload === null || payload === undefined) {
            return this.$t('Settings.WifiTab.DebugNoPayload').toString()
        }
        try {
            return JSON.stringify(payload, null, 2)
        } catch (error) {
            return String(payload)
        }
    }
}
</script>

<style scoped>
.wifi-debug {
    max-height: 220px;
    overflow: auto;
    background: rgba(0, 0, 0, 0.04);
    padding: 8px;
    border-radius: 4px;
    font-size: 11px;
    line-height: 1.3;
    white-space: pre-wrap;
    word-break: break-all;
}
</style>
