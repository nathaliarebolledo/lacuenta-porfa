// Split Bill uses a single, fixed light theme (matching the findmypet design
// reference, which never adapts to system dark mode) — so this intentionally
// ignores the device's color scheme instead of forwarding react-native's
// useColorScheme.
export function useColorScheme(): 'light' {
  return 'light';
}
