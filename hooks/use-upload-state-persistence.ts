"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export const UPLOAD_STATE_KEY = "upload-grades-state";
const MAX_STORAGE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const REDIS_SYNC_DEBOUNCE_MS = 2000; // debounce API writes to avoid flooding

// ── Types ──────────────────────────────────────────────────────────────────

export interface LogEntry {
  type: "success" | "error" | "warning";
  message: string;
  timestamp: string; // ISO string — Date is not JSON-roundtrippable
}

export interface UploadResult {
  studentNumber?: string;
  courseCode: string;
  status: string;
  studentName?: string;
  identifier?: string;
  matchQuality?: string;
}

export interface PersistedUploadState {
  fileName: string;
  fileSize: number;
  previewData: Record<string, unknown>[];
  academicYear: string;
  semester: string;
  allowLegacy: boolean;
  uploadResults: UploadResult[];
  logs: LogEntry[];
  hasValidated: boolean;
  progress: number;
  processedCount: number;
  totalRecords: number;
  timestamp: number; // Date.now() when persisted
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isFresh(ts: number): boolean {
  return Date.now() - ts < MAX_STORAGE_AGE_MS;
}

function loadFromLocalStorage(): PersistedUploadState | null {
  try {
    const raw = localStorage.getItem(UPLOAD_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedUploadState;
    if (!isFresh(parsed.timestamp)) {
      localStorage.removeItem(UPLOAD_STATE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(UPLOAD_STATE_KEY);
    return null;
  }
}

function saveToLocalStorage(state: Partial<PersistedUploadState>) {
  try {
    const existingRaw = localStorage.getItem(UPLOAD_STATE_KEY);
    const existing: Partial<PersistedUploadState> = existingRaw
      ? JSON.parse(existingRaw)
      : {};
    const merged = { ...existing, ...state, timestamp: Date.now() };
    localStorage.setItem(UPLOAD_STATE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn("[UploadPersistence] localStorage write failed:", e);
  }
}

function removeFromLocalStorage() {
  localStorage.removeItem(UPLOAD_STATE_KEY);
}

// ── API helpers (fire-and-forget with no throw) ──────────────────────────

async function fetchFromRedis(): Promise<PersistedUploadState | null> {
  try {
    const res = await fetch("/api/upload-state");
    if (!res.ok) return null;
    const json = await res.json();
    const state = json?.state as PersistedUploadState | null;
    if (state && isFresh(state.timestamp)) return state;
    return null;
  } catch {
    return null; // Redis unreachable → caller falls back to localStorage
  }
}

async function syncToRedis(state: Partial<PersistedUploadState>): Promise<void> {
  try {
    await fetch("/api/upload-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {
    // Silently ignore — localStorage already has the data
  }
}

async function deleteFromRedis(): Promise<void> {
  try {
    await fetch("/api/upload-state", { method: "DELETE" });
  } catch {
    // Silently ignore
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useUploadStatePersistence() {
  const [recoveredState, setRecoveredState] =
    useState<PersistedUploadState | null>(null);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
  const initialised = useRef(false);

  // Debounce refs for Redis sync
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRedisState = useRef<Partial<PersistedUploadState> | null>(null);

  // ── Load on mount: Redis first → localStorage fallback ─────────────────

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    (async () => {
      // 1) Try Redis (cross-device persistence)
      const redisState = await fetchFromRedis();
      if (redisState) {
        // Also hydrate localStorage so it stays in sync
        saveToLocalStorage(redisState);
        setRecoveredState(redisState);
        setShowRecoveryBanner(true);
        return;
      }

      // 2) Fall back to localStorage (local-only persistence)
      const localState = loadFromLocalStorage();
      if (localState) {
        setRecoveredState(localState);
        setShowRecoveryBanner(true);
      }
    })();
  }, []);

  // ── Persist: localStorage immediately → Redis debounced ───────────────

  const persistState = useCallback(
    (state: Partial<PersistedUploadState>) => {
      // Always write to localStorage synchronously (fast, reliable)
      saveToLocalStorage(state);

      // Debounce Redis sync — collect latest state and flush after quiet period
      pendingRedisState.current = {
        ...(pendingRedisState.current ?? {}),
        ...state,
      };

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const snapshot = pendingRedisState.current;
        pendingRedisState.current = null;
        if (snapshot) syncToRedis(snapshot);
      }, REDIS_SYNC_DEBOUNCE_MS);
    },
    []
  );

  // ── Clear: both localStorage and Redis ────────────────────────────────

  const clearPersistedState = useCallback(() => {
    // Cancel any pending Redis sync
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    pendingRedisState.current = null;

    removeFromLocalStorage();
    deleteFromRedis(); // fire-and-forget

    setShowRecoveryBanner(false);
    setRecoveredState(null);
  }, []);

  // ── Dismiss banner (keep data so user can recover later) ───────────────

  const dismissRecovery = useCallback(() => {
    setShowRecoveryBanner(false);
  }, []);

  // ── Confirm recovery ───────────────────────────────────────────────────

  const confirmRecovery = useCallback(() => {
    setShowRecoveryBanner(false);
  }, []);

  // ── Cleanup on unmount: flush any pending Redis write ──────────────────

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        // Flush pending state synchronously on unmount
        const snapshot = pendingRedisState.current;
        if (snapshot) syncToRedis(snapshot);
      }
    };
  }, []);

  return {
    recoveredState,
    showRecoveryBanner,
    persistState,
    clearPersistedState,
    dismissRecovery,
    confirmRecovery,
  } as const;
}
