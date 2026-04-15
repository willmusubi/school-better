"use client";

// Client-only teacher profile, persisted to localStorage.
// MVP-grade: a single "surname" field that drives the avatar badge and how the AI
// addresses the teacher. No account system, no server sync — if the teacher
// switches browsers they just re-enter their 姓.

import { useEffect, useState, useCallback } from "react";

const KEY = "tc_profile_surname_v1";
const EVENT = "tc_profile_change";

export function getSurname(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setSurname(value: string): void {
  if (typeof window === "undefined") return;
  const trimmed = value.trim();
  try {
    if (trimmed) localStorage.setItem(KEY, trimmed);
    else localStorage.removeItem(KEY);
  } catch { /* ignore quota errors */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

// Reactive hook. Subscribes to in-tab changes (custom event) and cross-tab changes (storage event).
export function useSurname(): [string, (s: string) => void] {
  const [surname, setState] = useState("");

  useEffect(() => {
    setState(getSurname());
    const onChange = () => setState(getSurname());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = useCallback((s: string) => {
    setSurname(s);
    setState(s.trim());
  }, []);

  return [surname, update];
}
