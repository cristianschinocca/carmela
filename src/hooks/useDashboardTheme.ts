import { useEffect, useState } from "react";

const STORAGE_KEY = "carmela.theme";

export function useDashboardTheme(publicView: boolean) {
  const [darkMode, setDarkMode] = useState(
    () =>
      (localStorage.getItem(STORAGE_KEY) ??
        document.documentElement.dataset.theme) === "dark",
  );

  useEffect(() => {
    const dashboardTheme = darkMode ? "dark" : "light";
    localStorage.setItem(STORAGE_KEY, dashboardTheme);
    document.documentElement.dataset.theme = publicView
      ? "public"
      : dashboardTheme;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        "content",
        publicView ? "#fbf7f2" : darkMode ? "#111112" : "#f0f0ef",
      );
    }
  }, [darkMode, publicView]);

  return { darkMode, setDarkMode };
}
