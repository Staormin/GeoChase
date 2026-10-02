/** Complete workspace themes, including their surfaces and text hierarchy. */
interface ThemeDefinition {
  dark: boolean;
  colors: Record<string, string>;
}
export interface Palette {
  id: string;
  theme: string;
}
// id, Vuetify name, dark, canvas, panel, controls, primary, complementary accent, ink, muted, border
const definitions = [
  [
    'classic',
    'cartography',
    false,
    '#edf2f4',
    '#ffffff',
    '#f4f7f8',
    '#176b70',
    '#96631b',
    '#203745',
    '#5c7180',
    '#dce5e8',
  ],
  [
    'classicDark',
    'cartographyDark',
    true,
    '#111c24',
    '#192832',
    '#22343e',
    '#80ccc8',
    '#e0b56a',
    '#e2edf2',
    '#a5bbc7',
    '#3a515e',
  ],
  [
    'ocean',
    'ocean',
    true,
    '#09162d',
    '#10213e',
    '#1a3253',
    '#8fcdf2',
    '#efb58b',
    '#e3efff',
    '#a9bfdc',
    '#395273',
  ],
  [
    'forest',
    'forest',
    true,
    '#101e17',
    '#192e23',
    '#243d30',
    '#a3d7a2',
    '#e9a6cf',
    '#e7f1e5',
    '#a9bda7',
    '#3e5945',
  ],
  [
    'iris',
    'iris',
    false,
    '#eee8f7',
    '#faf6ff',
    '#e9e0f4',
    '#6843a3',
    '#687016',
    '#38294d',
    '#70617e',
    '#cfc0df',
  ],
  [
    'lagoon',
    'lagoon',
    false,
    '#dfefee',
    '#f2fcfa',
    '#d8efeb',
    '#126d70',
    '#aa4549',
    '#193e40',
    '#506f70',
    '#aacdc8',
  ],
  [
    'terracotta',
    'terracotta',
    false,
    '#eddfd1',
    '#fff5e9',
    '#f1e1d0',
    '#9d412d',
    '#226e7a',
    '#49342b',
    '#7c6456',
    '#d8bfa9',
  ],
  [
    'rose',
    'rose',
    false,
    '#f0e0e9',
    '#fff4f8',
    '#f3dfe9',
    '#963c64',
    '#326d49',
    '#482b3b',
    '#7e5e70',
    '#dcb9ca',
  ],
  [
    'amber',
    'amber',
    true,
    '#201a10',
    '#302719',
    '#423723',
    '#f1c776',
    '#b4b9fb',
    '#f9efda',
    '#c6b693',
    '#655336',
  ],
  [
    'mint',
    'mint',
    false,
    '#dfeddf',
    '#f2fbef',
    '#ddefd8',
    '#246d4c',
    '#96436a',
    '#263e2a',
    '#5a735b',
    '#b6cdb0',
  ],
  [
    'indigo',
    'indigo',
    true,
    '#14152e',
    '#202341',
    '#303557',
    '#b6bdfa',
    '#edda8b',
    '#ebeaff',
    '#b3b7d9',
    '#4c527f',
  ],
  [
    'plum',
    'plum',
    true,
    '#211426',
    '#32203a',
    '#462d4d',
    '#e5ade8',
    '#c0d993',
    '#f7e9f6',
    '#caacce',
    '#6a4471',
  ],
  [
    'goldVelvet',
    'goldVelvet',
    true,
    '#050505',
    '#121212',
    '#242424',
    '#ffd700',
    '#ff5252',
    '#fffdf5',
    '#d6d0c1',
    '#746000',
  ],
  [
    'clockworkOrange',
    'clockworkOrange',
    true,
    '#171412',
    '#24201c',
    '#342b24',
    '#ff8a00',
    '#f5f0e8',
    '#f5f0e8',
    '#c0b6a7',
    '#5a4634',
  ],
  [
    'cyberpunk',
    'cyberpunk',
    true,
    '#05050a',
    '#0c0c14',
    '#141421',
    '#00ffcc',
    '#ff007f',
    '#ffffff',
    '#a0a0c0',
    '#2a2a40',
  ],
  [
    'vaporwaveNeon',
    'vaporwaveNeon',
    true,
    '#06050b',
    '#10101a',
    '#1a1a29',
    '#ff007f',
    '#39ff14',
    '#ffffff',
    '#bfbfbf',
    '#3d3d5c',
  ],
  [
    'christmasTree',
    'christmasTree',
    true,
    '#07110d',
    '#0e2219',
    '#173627',
    '#ffd700',
    '#ff3366',
    '#f4f9f6',
    '#9fbdb0',
    '#2d5a43',
  ],
] as const;

export const palettes: Palette[] = definitions.map(([id, theme]) => ({ id, theme }));
export const themes: Record<string, ThemeDefinition> = Object.fromEntries(
  definitions.map(
    ([, name, dark, background, surface, controls, primary, secondary, ink, muted, border]) => [
      name,
      {
        dark,
        colors: {
          background,
          surface,
          'surface-bright': controls,
          'surface-variant': controls,
          primary,
          'primary-darken-1': primary,
          secondary,
          'secondary-darken-1': secondary,
          accent: secondary,
          'on-background': ink,
          'on-surface': ink,
          'on-primary': dark ? '#18242b' : '#ffffff',
          'on-secondary': dark ? '#18242b' : '#ffffff',
          muted,
          border,
          error: dark ? '#ff919b' : '#b53843',
          warning: dark ? '#e8be72' : '#93600a',
          info: dark ? '#91c6ed' : '#306c98',
          success: dark ? '#83d4ab' : '#247052',
        },
      },
    ]
  )
);

export function readTheme(): string {
  try {
    const saved = localStorage.getItem('geochase_theme');
    if (saved === 'dark') return 'cartographyDark';
    if (saved && Object.hasOwn(themes, saved)) return saved;
    // Migrate palette/mode combinations from the previous selector.
    const previousPalette = saved?.replace(/(Light|Dark)$/, '');
    if (previousPalette && Object.hasOwn(themes, previousPalette)) return previousPalette;
  } catch {
    /* Storage is optional. */
  }
  return 'cartography';
}

export function applyWorkspaceTheme(name: string, persist = true): void {
  const definition = themes[name] ?? themes.cartography!;
  const c = definition.colors;
  const root = document.documentElement;
  root.dataset.theme = definition.dark ? 'dark' : 'light';
  root.dataset.palette = palettes.find((p) => p.theme === name)?.id ?? 'classic';
  const tokens: Record<string, string> = {
    '--gc-ink': c['on-surface']!,
    '--gc-muted': c.muted!,
    '--gc-border': c.border!,
    '--gc-toolbar': c['surface-bright']!,
    '--gc-subtle': c['surface-variant']!,
    '--gc-hover': c['surface-variant']!,
    '--gc-scrollbar': c.border!,
    '--gc-on-accent': c['on-primary']!,
    '--bg': c.surface!,
    '--panel': c.surface!,
    '--panel-border': c.border!,
    '--text': c['on-surface']!,
    '--muted': c.muted!,
    '--accent': c.primary!,
    '--accent-600': c.primary!,
    '--accent-700': c.primary!,
    '--success': c.success!,
    '--danger': c.error!,
    '--shadow': definition.dark ? '0 12px 40px #00000050' : '0 12px 40px #20374520',
  };
  for (const [key, value] of Object.entries(tokens)) root.style.setProperty(key, value);
  if (persist) {
    try {
      localStorage.setItem('geochase_theme', name);
    } catch {
      /* Keep the current session usable. */
    }
  }
}
