import { StitchlabIntakeEntry, StitchlabIntakePlacement } from '@/store/stitchlabIntake/types'

export function normalizeIntakeFilename(filename = ''): string {
    return filename
        .replace(/^\/+/, '')
        .replace(/^gcodes\//i, '')
        .replace(/\/+/g, '/')
}

export function buildPlacementFromGui(gcodeStudio: any = {}): StitchlabIntakePlacement {
    const framePreset = gcodeStudio.framePreset ?? 'standard'
    const frameWidth = Number(gcodeStudio.frameWidth ?? 0)
    const frameHeight = Number(gcodeStudio.frameHeight ?? 0)

    return {
        hoop_id: framePreset || 'standard',
        offset_x: Number(gcodeStudio.designOffsetX ?? 0) || 0,
        offset_y: Number(gcodeStudio.designOffsetY ?? 0) || 0,
        rotation_deg: Number(gcodeStudio.rotationDeg ?? 0) || 0,
        scale: 1,
        pivot: gcodeStudio.rotationPivot ?? 'design',
        frame_width_mm: frameWidth > 0 ? frameWidth : undefined,
        frame_height_mm: frameHeight > 0 ? frameHeight : undefined,
    }
}

export function normalizeIntakeEntry(payload: any = {}): StitchlabIntakeEntry {
    const filename = normalizeIntakeFilename(payload.filename ?? payload.requestParams?.filename ?? '')
    const stats = payload.stats ?? {}
    const bounds = payload.bounds ?? {}
    const state = payload.state ?? payload.status ?? (payload.in_queue ? 'queued' : 'unchecked')

    return {
        ...payload,
        filename,
        state,
        status: payload.status ?? (['valid', 'warnings', 'blocked'].includes(state) ? state : payload.status),
        stitchCount: payload.stitchCount ?? stats.stitch_count ?? 0,
        jumpCount: payload.jumpCount ?? stats.jump_count ?? 0,
        designWidth: payload.designWidth ?? bounds.width ?? 0,
        designHeight: payload.designHeight ?? bounds.height ?? 0,
    }
}

export function diagnosticMessage(diagnostic: any): string {
    if (typeof diagnostic === 'string') return diagnostic
    const code = diagnostic?.code ? `${diagnostic.code}: ` : ''
    return `${code}${diagnostic?.message ?? JSON.stringify(diagnostic)}`
}
