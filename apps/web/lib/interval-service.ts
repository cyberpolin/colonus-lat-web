"use client";

import { useEffect } from "react";
import { create } from "zustand";

interface IntervalServiceState {
  nowMs: number;
  running: boolean;
  enabled: boolean;
  tickSeconds: number;
}

let timerId: number | undefined;
let consumers = 0;

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
};

const parseSeconds = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.round(parsed));
};

const resolveTickerConfig = (): { enabled: boolean; tickSeconds: number } => {
  const rawEnabled =
    process.env.NEXT_PUBLIC_USE_INTERVAL_KODEN ??
    process.env.USE_INTERVAL_KODEN;
  const rawSeconds =
    process.env.NEXT_PUBLIC_USE_INTERVAL_SECONDS_KODEN ??
    process.env.USE_INTERVAL_SECONDS_KODEN;

  return {
    enabled: parseBoolean(rawEnabled, true),
    tickSeconds: parseSeconds(rawSeconds, 1)
  };
};

const tickerConfig = resolveTickerConfig();

export const useIntervalServiceStore = create<IntervalServiceState>(() => ({
  nowMs: Date.now(),
  running: false,
  enabled: tickerConfig.enabled,
  tickSeconds: tickerConfig.tickSeconds
}));

const startIntervalService = (): void => {
  if (typeof window === "undefined") return;
  if (!tickerConfig.enabled) {
    useIntervalServiceStore.setState((state) => ({
      ...state,
      nowMs: Date.now(),
      running: false,
      enabled: tickerConfig.enabled,
      tickSeconds: tickerConfig.tickSeconds
    }));
    return;
  }

  consumers += 1;
  if (timerId) return;

  const tickMs = tickerConfig.tickSeconds * 1000;
  useIntervalServiceStore.setState((state) => ({
    ...state,
    nowMs: Date.now(),
    running: true,
    enabled: tickerConfig.enabled,
    tickSeconds: tickerConfig.tickSeconds
  }));
  timerId = window.setInterval(() => {
    useIntervalServiceStore.setState((state) => ({
      ...state,
      nowMs: Date.now(),
      running: true
    }));
  }, tickMs);
};

const stopIntervalService = (): void => {
  if (typeof window === "undefined") return;
  if (!tickerConfig.enabled) return;
  consumers = Math.max(0, consumers - 1);
  if (consumers > 0) return;
  if (timerId) {
    window.clearInterval(timerId);
    timerId = undefined;
  }
  useIntervalServiceStore.setState((state) => ({ ...state, running: false }));
};

export const useIntervalService = (): void => {
  useEffect(() => {
    startIntervalService();
    return () => {
      stopIntervalService();
    };
  }, []);
};
