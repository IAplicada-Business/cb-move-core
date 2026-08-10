import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type ThemeOption = "light" | "dark";

export type ThemeToggleSize = "sm" | "md" | "lg";

const themeIcons = {
  light: Sun,
  dark: Moon,
} as const;

export const themeLabels: Record<ThemeOption, string> = {
  light: "Claro",
  dark: "Escuro",
};

type ThemeTabsProps = {
  size?: ThemeToggleSize;
  themes?: ThemeOption[];
  className?: string;
  /** Preenche a largura — útil no rodapé da sidebar */
  stretch?: boolean;
  /** ID único quando há mais de um toggle na página */
  layoutId?: string;
  /** horizontal = pill lado a lado · icon-stack = coluna (sidebar recolhida) */
  variant?: "horizontal" | "icon-stack";
};

export function ThemeTabs({
  size = "sm",
  themes = ["light", "dark"],
  className,
  stretch = false,
  layoutId = "cb-theme-tab-bg",
  variant = "horizontal",
}: ThemeTabsProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (variant === "icon-stack") {
      return (
        <div className={cn("flex flex-col items-center gap-1", className)} aria-hidden>
          {themes.map((themeOption) => (
            <div key={themeOption} className="h-8 w-8 rounded-lg bg-muted" />
          ))}
        </div>
      );
    }

    return (
      <div
        className={cn(
          "inline-flex rounded-lg border border-border bg-muted p-1",
          stretch && "w-full",
          size === "sm" ? "h-8" : size === "md" ? "h-9" : "h-10",
          !stretch && (size === "sm" ? "w-[60px]" : size === "md" ? "w-[68px]" : "w-[76px]"),
          className,
        )}
        aria-hidden
      />
    );
  }

  const activeTheme = theme === "dark" ? "dark" : "light";
  const iconSize = size === "sm" ? 14 : size === "md" ? 15 : 16;

  if (variant === "icon-stack") {
    return (
      <div
        className={cn("flex flex-col items-center gap-1", className)}
        role="tablist"
        aria-label="Tema"
      >
        {themes.map((themeOption) => {
          const Icon = themeIcons[themeOption];
          const isSelected = activeTheme === themeOption;

          return (
            <button
              key={themeOption}
              type="button"
              role="tab"
              aria-selected={isSelected}
              title={themeLabels[themeOption]}
              onClick={() => setTheme(themeOption)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                isSelected
                  ? "bg-muted text-foreground ring-1 ring-border/60"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon size={iconSize} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <Tabs
      value={activeTheme}
      onValueChange={setTheme}
      className={cn(stretch && "w-full", className)}
    >
      <TabsList
        className={cn(
          "inline-flex h-auto items-center gap-0.5 rounded-lg border border-border bg-muted p-1",
          stretch && "grid w-full grid-cols-2",
        )}
      >
        {themes.map((themeOption) => {
          const Icon = themeIcons[themeOption];
          const isSelected = activeTheme === themeOption;

          return (
            <TabsTrigger
              key={themeOption}
              value={themeOption}
              title={themeLabels[themeOption]}
              className={cn(
                "relative inline-flex items-center justify-center gap-1 rounded-md border-0 bg-transparent px-2 py-1 text-xs font-medium shadow-none transition-all",
                "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                size === "sm" ? "h-7 px-2" : size === "md" ? "h-8 px-2.5" : "h-9 px-3",
                stretch && "w-full min-w-0",
                !stretch && (size === "sm" ? "min-w-7" : size === "md" ? "min-w-8" : "min-w-9"),
                isSelected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isSelected && (
                <motion.div
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-md bg-card shadow-sm ring-1 ring-border/60"
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                <Icon size={size === "sm" ? 12 : size === "md" ? 14 : 16} />
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
