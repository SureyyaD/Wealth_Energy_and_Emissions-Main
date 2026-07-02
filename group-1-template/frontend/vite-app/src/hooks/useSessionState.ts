import { useState, useCallback } from "react";
import { getUUID } from "../utils/uuid";

export type ThemeType = "drought" | "wildfire" | "renewable";

export interface SessionState {
  id: string;
  theme: ThemeType;

  // Timeline
  year: number;
  month?: number;

  // Map
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch?: number;
    bearing?: number;
  };

  // Selections
  selectedFeature: any | null;

  // UI
  linked: {
    time: boolean;
    view: boolean;
  };
}

const DEFAULT_VIEW = {
  longitude: 0,
  latitude: 20,
  zoom: 1.5,
};

export function createSession(theme: ThemeType): SessionState {
  return {
    id: getUUID(),
    theme,
    year: 2023,
    month: theme === "climate" ? 1 : undefined,

    viewState: DEFAULT_VIEW,
    selectedFeature: null,

    linked: {
      time: false,
      view: false,
    },
  };
}

export function useSessionState(initialTheme: ThemeType) {
  const [session, setSession] = useState<SessionState>(() =>
    createSession(initialTheme)
  );

  const updateSession = useCallback(
    (patch: Partial<SessionState>) => {
      setSession((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const updateViewState = useCallback((viewState: SessionState["viewState"]) => {
    setSession((prev) => ({ ...prev, viewState }));
  }, []);

  const updateTime = useCallback((year: number, month?: number) => {
    setSession((prev) => ({
      ...prev,
      year,
      month,
    }));
  }, []);

  const resetSession = useCallback(() => {
    setSession(createSession(session.theme));
  }, [session.theme]);

  return {
    session,
    setSession,
    updateSession,
    updateViewState,
    updateTime,
    resetSession,
  };
}
