import { createTheme } from "@mui/material/styles";

export const m3Theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00E5FF" },
    secondary: { main: "#B8D2E6" },
    background: {
      default: "#0C1218",
      paper: "#141E2A",
    },
    text: {
      primary: "#FFFFFF",
      secondary: "#AFC7DA",
    },
    success: { main: "#36D399" },
    error: { main: "#FF6A80" },
    divider: "#223446",
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: '"Ubuntu", ui-sans-serif, system-ui, sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "none",
          boxShadow: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 12 },
        outlined: { borderColor: "#00D8FF55" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 500 },
      },
    },
  },
});
