import * as React from "react";
import { useTheme } from "next-themes";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { THEME_STORAGE_KEY, applyThemeClass, normalizeStoredTheme } from "@/lib/theme-storage";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

function ThemeBootstrap() {
  const { setTheme } = useTheme();

  React.useLayoutEffect(() => {
    const resolved = normalizeStoredTheme();
    applyThemeClass(resolved);
    setTheme(resolved);
  }, [setTheme]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      storageKey={THEME_STORAGE_KEY}
      {...props}
    >
      <ThemeBootstrap />
      {children}
    </NextThemesProvider>
  );
}
