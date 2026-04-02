"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { m3Theme } from "@/theme/m3-theme";

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={m3Theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
