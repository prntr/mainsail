<template>
    <div v-if="enabled" class="debug-overlay" @click="cycle">
        <div class="row">
            <span class="label">WS</span>
            <span :class="['state', stateClass]">{{ stateLabel }}</span>
            <span class="dim">{{ uaShort }}</span>
        </div>
        <div class="row">
            <span class="label">recv</span><span>{{ fmtAgo(snap.recvAgo) }}</span>
            <span class="label">send</span><span>{{ fmtAgo(snap.sendAgo) }}</span>
            <span class="label">open</span><span>{{ fmtAgo(snap.openAgo) }}</span>
        </div>
        <div class="row">
            <span class="label">reconn</span><span>{{ snap.reconnects }}</span>
            <span class="label">waits</span><span>{{ snap.waitsCount }}</span>
            <span v-if="snap.paused" class="warn">paused</span>
            <span v-if="!snap.guiIsReady" class="warn">init</span>
        </div>
        <div v-if="expanded">
            <div v-if="snap.firstWaits.length" class="row sub">
                <span class="label">pending</span>
                <span class="dim">{{ snap.firstWaits.join(', ') }}</span>
            </div>
            <div v-for="(c, i) in snap.closes" :key="i" class="row sub">
                <span class="label">{{ fmtClock(c.at) }}</span>
                <span :class="closeClass(c)">code={{ c.code || 'none' }}</span>
                <span>recvGap={{ Math.round(c.recvGapMs / 100) / 10 }}s</span>
                <span>open={{ Math.round(c.openedForMs / 1000) }}s</span>
                <span class="dim">{{ c.cause }}</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { RecentClose } from '@/plugins/webSocketClient'

interface Snapshot {
    readyState: number
    recvAgo: number
    sendAgo: number
    openAgo: number
    reconnects: number
    waitsCount: number
    firstWaits: string[]
    paused: boolean
    guiIsReady: boolean
    closes: RecentClose[]
}

const FLAG_QUERY = 'debug'
const FLAG_LS_KEY = 'mainsailDebugOverlay'

@Component
export default class DebugOverlay extends Mixins(BaseMixin) {
    enabled = false
    expanded = false
    timer: number | null = null
    snap: Snapshot = {
        readyState: -1,
        recvAgo: 0,
        sendAgo: 0,
        openAgo: 0,
        reconnects: 0,
        waitsCount: 0,
        firstWaits: [],
        paused: false,
        guiIsReady: false,
        closes: [],
    }

    mounted(): void {
        const url = new URL(window.location.href)
        const flag = url.searchParams.get(FLAG_QUERY) === '1' || localStorage.getItem(FLAG_LS_KEY) === '1'
        if (!flag) return
        this.enabled = true
        if (url.searchParams.get(FLAG_QUERY) === '1') localStorage.setItem(FLAG_LS_KEY, '1')
        this.timer = window.setInterval(this.refresh, 500)
        this.refresh()
    }

    beforeDestroy(): void {
        if (this.timer !== null) {
            window.clearInterval(this.timer)
            this.timer = null
        }
    }

    refresh(): void {
        const sock = (this as any).$socket
        if (!sock) return
        const now = Date.now()
        this.snap = {
            readyState: sock.instance?.readyState ?? -1,
            recvAgo: sock.lastReceivedAt ? now - sock.lastReceivedAt : -1,
            sendAgo: sock.lastSentAt ? now - sock.lastSentAt : -1,
            openAgo: sock.lastOpenedAt ? now - sock.lastOpenedAt : -1,
            reconnects: sock.reconnects ?? 0,
            waitsCount: sock.waits?.length ?? 0,
            firstWaits: (sock.waits ?? []).slice(0, 5).map((w: any) => w.params?.method ?? w.action ?? '?'),
            paused: sock.paused ?? false,
            guiIsReady: this.$store.getters['socket/getConnectionState'] === 'connected',
            closes: (sock.recentCloses ?? []).slice(-5).reverse(),
        }
    }

    get stateLabel(): string {
        switch (this.snap.readyState) {
            case 0: return 'CONNECTING'
            case 1: return 'OPEN'
            case 2: return 'CLOSING'
            case 3: return 'CLOSED'
            default: return 'NULL'
        }
    }

    get stateClass(): string {
        return this.snap.readyState === 1 ? 'ok' : 'err'
    }

    get uaShort(): string {
        const ua = navigator.userAgent
        if (/HeadlessChrome/.test(ua)) return 'HeadlessChromium'
        if (/Edg\//.test(ua)) return 'Edge'
        if (/Firefox\//.test(ua)) return 'Firefox'
        if (/Chrome\//.test(ua)) return 'Chrome'
        if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari'
        return 'Other'
    }

    fmtAgo(ms: number): string {
        if (ms < 0) return '–'
        if (ms < 1000) return ms + 'ms'
        return (ms / 1000).toFixed(1) + 's'
    }

    fmtClock(at: number): string {
        const d = new Date(at)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    }

    closeClass(c: RecentClose): string {
        if (c.recvGapMs > 25_000) return 'err'
        if (c.recvGapMs > 10_000) return 'warn'
        return ''
    }

    cycle(): void {
        this.expanded = !this.expanded
    }
}
</script>

<style scoped>
.debug-overlay {
    position: fixed;
    right: 12px;
    bottom: 12px;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.82);
    color: #eee;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.5;
    padding: 10px 14px;
    border-radius: 6px;
    border: 1px solid #555;
    pointer-events: auto;
    min-width: 320px;
    max-width: 640px;
    width: max-content;
    user-select: text;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
.row {
    display: flex;
    gap: 12px;
    align-items: baseline;
    flex-wrap: wrap;
    white-space: nowrap;
}
.row.sub { font-size: 12px; opacity: 0.88; }
.label { color: #88c0d0; }
.dim { color: #888; }
.ok { color: #a3be8c; }
.warn { color: #ebcb8b; }
.err { color: #bf616a; }
.state { font-weight: 600; }
</style>
