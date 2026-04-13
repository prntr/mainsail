import { KlipperRepos, Theme } from '@/store/types'

export const defaultMode = 'light'
export const defaultTheme = 'stitchlab'
export const defaultLogoColor = '#D41216'
export const defaultPrimaryColor = '#2196f3'
export const defaultBigThumbnailBackground = '#1e1e1e'
export const stitchlabPrimaryPrefix = 'stitchlab:'
export const stitchlabDefaultPrimary = `${stitchlabPrimaryPrefix}blue`

export interface ThemePrimaryOption {
    key: string
    dark: string
    light: string
}

export interface StitchlabGcodeStudioPalette {
    backgroundColor: string
    gridColor: string
    frameColor: string
    stitchColors: string[]
    travelColor: string
    stitchPointColor: string
}

export const stitchlabPrimaryOptions: ThemePrimaryOption[] = [
    { key: 'rosewater', dark: '#f2d5cf', light: '#dc8a78' },
    { key: 'flamingo', dark: '#eebebe', light: '#dd7878' },
    { key: 'pink', dark: '#f4b8e4', light: '#ea76cb' },
    { key: 'mauve', dark: '#ca9ee6', light: '#8839ef' },
    { key: 'red', dark: '#e78284', light: '#d20f39' },
    { key: 'maroon', dark: '#ea999c', light: '#e64553' },
    { key: 'peach', dark: '#ef9f76', light: '#fe640b' },
    { key: 'yellow', dark: '#e5c890', light: '#df8e1d' },
    { key: 'green', dark: '#a6d189', light: '#40a02b' },
    { key: 'teal', dark: '#81c8be', light: '#179299' },
    { key: 'sky', dark: '#99d1db', light: '#04a5e5' },
    { key: 'sapphire', dark: '#85c1dc', light: '#209fb5' },
    { key: 'blue', dark: '#8caaee', light: '#1e66f5' },
    { key: 'lavender', dark: '#babbf1', light: '#7287fd' },
]

const stitchlabGcodeStudioPalettes: Record<'dark' | 'light', StitchlabGcodeStudioPalette> = {
    dark: {
        backgroundColor: '#1f2230',
        gridColor: '#414559',
        frameColor: '#838ba7',
        stitchColors: ['#8caaee', '#81c8be', '#ef9f76', '#ca9ee6', '#e5c890'],
        travelColor: '#737994',
        stitchPointColor: '#8caaee',
    },
    light: {
        backgroundColor: '#d6dae2',
        gridColor: '#ccd0da',
        frameColor: '#8c8fa1',
        stitchColors: ['#1e66f5', '#179299', '#fe640b', '#8839ef', '#df8e1d'],
        travelColor: '#9ca0b0',
        stitchPointColor: '#1e66f5',
    },
}

export function getStitchlabGcodeStudioPalette(mode: string): StitchlabGcodeStudioPalette {
    return stitchlabGcodeStudioPalettes[mode === 'dark' ? 'dark' : 'light']
}

function getStitchlabPrimaryOptionByKey(key: string | null | undefined): ThemePrimaryOption | undefined {
    if (!key) return undefined

    return stitchlabPrimaryOptions.find((option) => option.key === key)
}

function getStitchlabPrimaryOptionKey(value: string | null | undefined): string | null {
    const normalizedValue = value?.toLowerCase() ?? ''
    if (!normalizedValue) return null

    if (normalizedValue.startsWith(stitchlabPrimaryPrefix)) {
        const optionKey = normalizedValue.slice(stitchlabPrimaryPrefix.length)

        return getStitchlabPrimaryOptionByKey(optionKey)?.key ?? null
    }

    const option = stitchlabPrimaryOptions.find(
        ({ dark, light }) => dark.toLowerCase() === normalizedValue || light.toLowerCase() === normalizedValue
    )

    return option?.key ?? null
}

export function getThemePrimaryOptions(themeName: string): ThemePrimaryOption[] {
    return themeName === 'stitchlab' ? stitchlabPrimaryOptions : []
}

export function getThemePrimaryOptionKey(themeName: string, value: string | null | undefined): string | null {
    if (themeName !== 'stitchlab') return null

    return getStitchlabPrimaryOptionKey(value)
}

export function normalizeThemePrimarySetting(themeName: string, value: string | null | undefined): string {
    if (themeName !== 'stitchlab') return value ?? defaultPrimaryColor

    if (!value || value.toLowerCase() === defaultPrimaryColor.toLowerCase()) return stitchlabDefaultPrimary

    const optionKey = getStitchlabPrimaryOptionKey(value)

    return optionKey ? `${stitchlabPrimaryPrefix}${optionKey}` : value
}

export function resolveThemePrimaryColor(themeName: string, mode: string, value: string | null | undefined): string {
    const normalizedValue = normalizeThemePrimarySetting(themeName, value)
    if (themeName !== 'stitchlab') return normalizedValue

    const optionKey = getStitchlabPrimaryOptionKey(normalizedValue)
    const option = getStitchlabPrimaryOptionByKey(optionKey)

    if (!option) return normalizedValue

    return mode === 'dark' ? option.dark : option.light
}

export const minKlipperVersion = 'v0.11.0-257'
export const minMoonrakerVersion = 'v0.8.0-306'
export const minBrowserVersions = [{ name: 'safari', version: '16.5.2' }]

export const colorArray = ['#F44336', '#8e379d', '#03DAC5', '#3F51B5', '#ffde03', '#009688', '#E91E63']

export const colorHeaterBed = '#2196F3'
export const colorChamber = '#4CAF50'
export const opacityHeaterActive = '99'
export const opacityHeaterInactive = '44'
export const themeDir = '.theme'
export const datasetInterval = 1000
export const datasetTypes = ['temperature', 'target', 'power', 'speed']
export const datasetTypesInPercents = ['power', 'speed']
export const additionalSensors = [
    'aht10',
    'aht1x',
    'aht2x',
    'aht3x',
    'bme280',
    'htu21d',
    'sgp40',
    'sht3x',
    'temperature_combined',
]

/*
 * List of valid gcode file extensions
 */
export const validGcodeExtensions = ['.gcode', '.g', '.gco', '.ufp', '.nc']

/*
 * List of initable server components
 */
export const initableServerComponents = [
    'history',
    'power',
    'updateManager',
    'timelapse',
    'jobQueue',
    'announcements',
    'spoolman',
    'sensor',
    'wifiManager',
]

/*
 * List of required klipper config modules
 */
export const checkKlipperConfigModules = [
    'virtual_sdcard',
    'pause_resume',
    'gcode_macro pause',
    'gcode_macro resume',
    'gcode_macro cancel_print',
]

/*
 * List of allowed metadata fields
 */
export const allowedMetadata = [
    'uuid',
    'estimated_time',
    'extruder_colors',
    'filament_change_count',
    'filament_colors',
    'filament_name',
    'filament_temps',
    'filament_type',
    'filament_colors',
    'extruder_colors',
    'filament_temps',
    'referenced_tools',
    'mmu_print',
    'filament_total',
    'filament_weight_total',
    'filament_weights',
    'nozzle_diameter',
    'first_layer_bed_temp',
    'first_layer_extr_temp',
    'chamber_temp',
    'first_layer_height',
    'gcode_end_byte',
    'gcode_start_byte',
    'job_id',
    'layer_height',
    'mmu_print',
    'object_height',
    'print_start_time',
    'referenced_tools',
    'size',
    'slicer',
    'slicer_version',
    'thumbnails',
]

export const maxEventHistory = 500
export const maxGcodeHistory = 50

/*
 * List of generic dashboard panels
 */
export const allDashboardPanels = [
    'afc',
    'embroidery-control',
    'toolhead-control',
    'extruder-control',
    'macros',
    'led-effects',
    'machine-settings',
    'miniconsole',
    'miscellaneous',
    'spoolman',
    'mmu',
    'temperature',
    'webcam',
]

export const thumbnailSmallMin = 30
export const thumbnailSmallMax = 64
export const thumbnailBigMin = 128

export const navigationWidth = 220
export const navigationItemHeight = 48
export const panelToolbarHeight = 48
export const topbarHeight = 48

/*
 * List of hidden timelapse console outputs
 */
export const timelapseConsoleFilters = [
    '^_TIMELAPSE_NEW_FRAME',
    '^TIMELAPSE_TAKE_FRAME',
    '^TIMELAPSE_RENDER',
    '^_SET_TIMELAPSE_SETUP',
    '^HYPERLAPSE ACTION=',
    '^SET_GCODE_VARIABLE MACRO=TIMELAPSE_',
]

/*
 * List of hidden root directories in config files panel
 */
export const hiddenRootDirectories = ['gcodes', 'timelapse', 'timelapse_frames']

/*
 * Hide directories
 */
export const hiddenDirectories = ['.git']

/*
 * List of all downloadable logfiles
 */
export const genericLogfiles = ['klippy', 'moonraker', 'crowsnest', 'mmu', 'sonar']

/*
 * List of all rollover logfiles
 */
export const rolloverLogfiles = ['klipper', 'moonraker']

/*
 * List of all Themes
 */
export const themes: Theme[] = [
    { name: 'mainsail', displayName: 'Mainsail', colorLogo: defaultLogoColor },
    {
        name: 'klipper',
        displayName: 'Klipper',
        colorLogo: '#b12f35',
        logo: { show: true, light: false },
    },
    {
        name: 'voron',
        displayName: 'Voron Design',
        colorLogo: '#FF2300',
        logo: { show: true, light: false },
    },
    {
        name: 'ldo',
        displayName: 'LDO Motion (Sponsor)',
        colorLogo: '#326799',
        colorPrimary: '#326799',
        logo: { show: true, light: false },
    },
    {
        name: 'yumi',
        displayName: 'YUMI (Sponsor)',
        colorLogo: '#F6CF3D',
        colorPrimary: '#F6CF3D',
        logo: { show: true, light: false },
    },
    {
        name: 'vzbot',
        displayName: 'VzBot',
        colorLogo: '#FF0000',
        logo: { show: true, light: false },
        sidebarBackground: { show: true, light: false },
        css: true,
    },
    {
        name: 'prusa',
        displayName: 'Prusa Research (Sponsor)',
        colorLogo: '#fa6831',
        colorPrimary: '#fa6831',
        logo: { show: true, light: false },
    },
    {
        name: 'btt',
        displayName: 'BigTreeTech (Sponsor)',
        colorLogo: '#ef0025',
        logo: { show: true, light: false },
    },
    {
        name: 'multec',
        displayName: 'Multec GmbH (Sponsor)',
        colorLogo: '#234D7A',
        colorPrimary: '#234D7A',
        logo: { show: true, light: false },
    },
    {
        name: 'stitchlab',
        displayName: 'StitchLab',
        colorLogo: '#4c4f69',
        colorPrimary: stitchlabDefaultPrimary,
        logo: { show: true, light: false },
        css: true,
    },
]

/*
 * List of all supported Klipper-Repos
 */
export const klipperRepos: KlipperRepos = {
    Klipper: {
        url: 'https://www.klipper3d.org/',
        docsLanguages: ['it', 'hu', 'zh'],
    },
    Kalico: {
        url: 'https://docs.kalico.gg/',
    },
}
