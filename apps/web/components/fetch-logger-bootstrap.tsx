"use client";

import { useEffect } from "react";
import { installFetchLogger } from "@/lib/fetch-logger";

export function FetchLoggerBootstrap() {
  useEffect(() => {
    installFetchLogger("client");
  }, []);

  return null;
}

