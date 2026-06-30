export interface FanPagePalette {
  id: string
  name: string
  primary: string
  accent: string
  background: string
  text: string
}

export const FAN_PAGE_PALETTES: FanPagePalette[] = [
  { id: 'dark-minimal', name: 'Dark Minimal', primary: '#e8e8e8', accent: '#ff3366', background: '#0a0a0a', text: '#f5f5f5' },
  { id: 'dark-techno', name: 'Dark Techno', primary: '#00ffcc', accent: '#ff00aa', background: '#050505', text: '#e0e0e0' },
  { id: 'neon', name: 'Neon', primary: '#39ff14', accent: '#ff10f0', background: '#111111', text: '#ffffff' },
  { id: 'blood-red', name: 'Blood Red', primary: '#ff4444', accent: '#cc0000', background: '#0d0000', text: '#f0e0e0' },
  { id: 'minimal-black', name: 'Minimal Black', primary: '#ffffff', accent: '#888888', background: '#000000', text: '#cccccc' },
  { id: 'industrial', name: 'Industrial', primary: '#c0c0c0', accent: '#ff6600', background: '#1a1a1a', text: '#d4d4d4' },
]

export function getPaletteById(id: string): FanPagePalette {
  return FAN_PAGE_PALETTES.find((p) => p.id === id) ?? FAN_PAGE_PALETTES[0]
}