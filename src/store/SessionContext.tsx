"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  applySeatSwaps,
  DEFAULT_CONFIG,
  generateLayout,
  type SeatSwap,
  type SessionConfig,
  type StageLayout,
} from "@/lib/engine";

const STORAGE_KEY = "gpp:session:v1";

export interface SessionState {
  config: SessionConfig;
  swaps: SeatSwap[];
  generated: boolean;
  hydrated: boolean;
}

type Action =
  | { type: "hydrate"; state: Partial<SessionState> }
  | { type: "patchConfig"; patch: Partial<SessionConfig> }
  | { type: "adjustCount"; field: "totalStudents" | "totalTeachers"; delta: number }
  | { type: "addSwap"; swap: SeatSwap }
  | { type: "clearSwaps" }
  | { type: "markGenerated" }
  | { type: "reset" };

const initialState: SessionState = {
  config: DEFAULT_CONFIG,
  swaps: [],
  generated: false,
  hydrated: false,
};

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        ...action.state,
        config: { ...state.config, ...(action.state.config ?? {}) },
        hydrated: true,
      };
    case "patchConfig":
      return { ...state, config: { ...state.config, ...action.patch } };
    case "adjustCount": {
      const next = Math.max(0, state.config[action.field] + action.delta);
      return {
        ...state,
        config: { ...state.config, [action.field]: next },
      };
    }
    case "addSwap":
      return { ...state, swaps: [...state.swaps, action.swap] };
    case "clearSwaps":
      return { ...state, swaps: [] };
    case "markGenerated":
      return { ...state, generated: true };
    case "reset":
      return { ...initialState, hydrated: true };
    default:
      return state;
  }
}

interface SessionContextValue {
  state: SessionState;
  layout: StageLayout;
  /** seatRows with manual drag-and-drop swaps applied. */
  seatRows: StageLayout["seatRows"];
  patchConfig(patch: Partial<SessionConfig>): void;
  adjustCount(field: "totalStudents" | "totalTeachers", delta: number): void;
  addSwap(swap: SeatSwap): void;
  clearSwaps(): void;
  markGenerated(): void;
  reset(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SessionState>;
        dispatch({
          type: "hydrate",
          state: {
            config: parsed.config,
            swaps: Array.isArray(parsed.swaps) ? parsed.swaps : [],
            generated: Boolean(parsed.generated),
          },
        });
        return;
      }
    } catch {
      // Corrupt storage — start fresh.
    }
    dispatch({ type: "hydrate", state: {} });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          config: state.config,
          swaps: state.swaps,
          generated: state.generated,
        }),
      );
    } catch {
      // Storage full/unavailable — the app still works in memory.
    }
  }, [state]);

  const layout = useMemo(() => generateLayout(state.config), [state.config]);
  const seatRows = useMemo(
    () => applySeatSwaps(layout.seatRows, state.swaps),
    [layout, state.swaps],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      layout,
      seatRows,
      patchConfig: (patch) => dispatch({ type: "patchConfig", patch }),
      adjustCount: (field, delta) =>
        dispatch({ type: "adjustCount", field, delta }),
      addSwap: (swap) => dispatch({ type: "addSwap", swap }),
      clearSwaps: () => dispatch({ type: "clearSwaps" }),
      markGenerated: () => dispatch({ type: "markGenerated" }),
      reset: () => {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        dispatch({ type: "reset" });
      },
    }),
    [state, layout, seatRows],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
