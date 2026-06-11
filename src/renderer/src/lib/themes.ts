export const THEME_PRESETS = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Current Pi Desktop look.',
    swatches: ['#1a1919', '#151414', '#007aff'],
  },
  {
    id: 'pi-native',
    name: 'Pi Native',
    description: 'VoltAgent-inspired void black canvas with emerald agent glow.',
    swatches: ['#030604', '#07110b', '#35f08d'],
  },
  {
    id: 'warp-flow',
    name: 'Warp Flow',
    description: 'Command-block workflow with cool blue process cards.',
    swatches: ['#060912', '#0b1020', '#5da8ff'],
  },
  {
    id: 'mint-docs',
    name: 'Mint Docs',
    description: 'Together.ai-inspired bright canvas with ink text and pastel mint accents.',
    swatches: ['#ffffff', '#ebebeb', '#c8f6f9'],
  },
] as const

export type ThemePresetId = typeof THEME_PRESETS[number]['id']
type ThemeColorScheme = 'dark' | 'light'

const THEME_IDS = new Set<string>(THEME_PRESETS.map((theme) => theme.id))
const THEME_COLOR_SCHEMES: Record<ThemePresetId, ThemeColorScheme> = {
  classic: 'dark',
  'pi-native': 'dark',
  'warp-flow': 'dark',
  'mint-docs': 'light',
}

export function normalizeThemePreset(value: unknown): ThemePresetId {
  if (typeof value === 'string' && THEME_IDS.has(value)) {
    return value as ThemePresetId
  }
  return 'classic'
}

export function applyThemePreset(value: unknown): ThemePresetId {
  const theme = normalizeThemePreset(value)
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = THEME_COLOR_SCHEMES[theme]
  return theme
}
