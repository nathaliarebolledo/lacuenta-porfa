// Split Bill uses a single, fixed light theme (matching the findmypet design
// reference, which never adapts to system dark mode) — so this intentionally
// ignores the device's color scheme instead of reading prefers-color-scheme.
export function useColorScheme(): 'light' {
  return 'light';
}
