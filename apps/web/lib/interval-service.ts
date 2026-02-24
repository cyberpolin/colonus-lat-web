"use client";

import { useEffect } from "react";
import { create } from "zustand";

interface IntervalServiceState {
  nowMs: number;
  running: boolean;
}

const TICK_MS = 1000;
let timerId: number | undefined;
let consumers = 0;

export const useIntervalServiceStore = create<IntervalServiceState>(() => ({
  nowMs: Date.now(),
  running: false
}));

const startIntervalService = (): void => {
  if (typeof window === "undefined") return;
  consumers += 1;
  if (timerId) return;

  useIntervalServiceStore.setState({ nowMs: Date.now(), running: true });
  timerId = window.setInterval(() => {
    useIntervalServiceStore.setState({ nowMs: Date.now(), running: true });
  }, TICK_MS);
};

const stopIntervalService = (): void => {
  if (typeof window === "undefined") return;
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
