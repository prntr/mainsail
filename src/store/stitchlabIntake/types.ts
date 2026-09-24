export interface StitchlabIntakePlacement {
    hoop_id: string
    offset_x: number
    offset_y: number
    rotation_deg: number
    scale: number
    pivot: string
    frame_width_mm?: number
    frame_height_mm?: number
}

export interface StitchlabIntakeThumbnail {
    relative_path: string
    width: number
    height: number
    size?: number
}

export interface StitchlabIntakeMacroDiagnostic {
    state: string
    missing: string[]
    checked?: boolean
}

export interface StitchlabIntakeEntry {
    filename: string
    state: string
    status?: string
    analysis_key?: string
    preview_key?: string
    thumbnail?: StitchlabIntakeThumbnail | null
    errors?: any[]
    warnings?: any[]
    info?: any[]
    macros?: StitchlabIntakeMacroDiagnostic
    placement?: StitchlabIntakePlacement
    stats?: { [key: string]: any }
    bounds?: { [key: string]: any }
    stitchCount?: number
    jumpCount?: number
    designWidth?: number
    designHeight?: number
    in_queue?: boolean
    [key: string]: any
}

export interface StitchlabIntakeState {
    entries: {
        [filename: string]: StitchlabIntakeEntry
    }
    requested: {
        [filename: string]: boolean
    }
}
