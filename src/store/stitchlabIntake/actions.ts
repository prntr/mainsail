import Vue from 'vue'
import { ActionTree } from 'vuex'
import { BatchMessage } from '@/plugins/webSocketClient'
import i18n from '@/plugins/i18n'
import { RootState } from '@/store/types'
import { diagnosticMessage, buildPlacementFromGui, normalizeIntakeEntry, normalizeIntakeFilename } from './helpers'
import { StitchlabIntakePlacement, StitchlabIntakeState } from './types'

function t(key: string, params?: Record<string, any>): string {
    return i18n.t(`StitchlabIntake.${key}`, params ?? {}).toString()
}

const COMPONENT = 'stitchlab_intake'

function hasIntake(rootState: RootState): boolean {
    return rootState.server?.components?.includes(COMPONENT) ?? false
}

function startDirect(filename: string, action?: string, loading?: string): void {
    Vue.$socket.emit('printer.print.start', { filename }, { action: action ?? null, loading: loading ?? null })
}

function blockingMessages(entry: any): string[] {
    const errors = (entry.errors ?? []).map(diagnosticMessage)
    const macroMissing = entry.macros?.state === 'missing' ? (entry.macros.missing ?? []) : []
    macroMissing.forEach((macro: string) => errors.push(t('ToastMissingMacro', { macro })))
    if (entry.status === 'blocked' && errors.length === 0) errors.push(t('ToastJobBlocked'))
    return errors
}

function warningMessages(entry: any): string[] {
    const warnings = (entry.warnings ?? []).map(diagnosticMessage)
    if (entry.macros?.state === 'offline') warnings.push(t('ToastMacrosOffline'))
    if (entry.status === 'warnings' && warnings.length === 0) warnings.push(t('ToastWarningsReported'))
    return warnings
}

function confirmWarnings(filename: string, warnings: string[]): boolean {
    const preview = warnings.slice(0, 8).map((warning) => `- ${warning}`)
    if (warnings.length > preview.length) {
        preview.push(t('ConfirmMoreWarnings', { count: warnings.length - preview.length }))
    }

    return window.confirm([t('ConfirmTitle', { filename }), '', ...preview, '', t('ConfirmQuestion')].join('\n'))
}

export const actions: ActionTree<StitchlabIntakeState, RootState> = {
    reset({ commit }) {
        commit('reset')
    },

    requestStatuses({ state, rootState, commit }, payload: { filename: string }[]) {
        if (!hasIntake(rootState)) return

        const messages: BatchMessage[] = []
        for (const item of payload) {
            const filename = normalizeIntakeFilename(item.filename)
            if (!filename || state.requested[filename]) continue

            commit('setRequested', { filename, value: true })
            messages.push({
                method: 'server.stitchlab_intake.status',
                params: { filename },
                emitOptions: { action: 'stitchlabIntake/receiveStatus' },
            })
        }

        Vue.$socket.emitBatch(messages)
    },

    receiveStatus({ commit }, payload) {
        commit('setEntry', payload)
    },

    handleStatusEvent({ commit }, payload) {
        commit('setEntry', payload)
    },

    clearFile({ commit }, filename: string) {
        commit('clearEntry', filename)
    },

    recheck({ rootState, commit }, filename: string) {
        if (!hasIntake(rootState)) return

        filename = normalizeIntakeFilename(filename)
        commit('setEntry', { filename, state: 'queued', in_queue: true })
        Vue.$socket.emit('server.stitchlab_intake.recheck', { filename }, { action: 'stitchlabIntake/receiveStatus' })
    },

    async requestMetadataForCurrentFile({ rootState, commit }, filename: string) {
        if (!hasIntake(rootState)) return

        filename = normalizeIntakeFilename(filename)
        if (!filename) return

        try {
            const result = await Vue.$socket.emitAndWait('server.stitchlab_intake.metadata', { filename })
            const entry = normalizeIntakeEntry(result)
            commit('setEntry', entry)

            const active = normalizeIntakeFilename(rootState.printer?.print_stats?.filename ?? '')
            if (active === filename) {
                commit('printer/setData', { current_file: { stitchlab_intake: entry } }, { root: true })
            }
        } catch (error) {
            window.console.warn('StitchLab intake metadata request failed', error)
        }
    },

    async startPrint(
        { rootState, commit },
        payload: {
            filename: string
            placement?: StitchlabIntakePlacement
            action?: string
            loading?: string
        }
    ): Promise<boolean> {
        const filename = normalizeIntakeFilename(payload.filename)
        if (!filename) return false

        if (!hasIntake(rootState)) {
            startDirect(filename, payload.action, payload.loading)
            return true
        }

        const placement = payload.placement ?? buildPlacementFromGui(rootState.gui?.gcodeStudio)

        try {
            const result = await Vue.$socket.emitAndWait(
                'server.stitchlab_intake.prepare',
                { filename, placement },
                { loading: payload.loading ?? 'stitchlabIntakePrepare' }
            )
            const entry = normalizeIntakeEntry(result)
            commit('setEntry', entry)

            const blocked = blockingMessages(entry)
            if (blocked.length) {
                Vue.$toast.error(blocked[0])
                return false
            }

            const warnings = warningMessages(entry)
            if (warnings.length && !confirmWarnings(filename, warnings)) return false

            startDirect(filename, payload.action, payload.loading)
            return true
        } catch (error: any) {
            const message = error?.message ?? error?.error?.message ?? t('ToastPrepareFailed')
            Vue.$toast.error(message)
            return false
        }
    },
}
