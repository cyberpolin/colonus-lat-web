type FetchContext = "client" | "server";

type GlobalWithFetchLogger = typeof globalThis & {
  __colonusFetchLoggerInstalled?: boolean;
  __colonusFetchLoggerCounter?: number;
};

const asGlobal = (): GlobalWithFetchLogger => globalThis as GlobalWithFetchLogger;

const toRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
};

const toRequestMethod = (input: RequestInfo | URL, init?: RequestInit): string => {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
};

const isEnabled = (context: FetchContext): boolean => {
  if (process.env.NODE_ENV === "development") return true;
  if (context === "client") return process.env.NEXT_PUBLIC_FETCH_DEBUG === "1";
  return process.env.FETCH_DEBUG === "1";
};

export const installFetchLogger = (context: FetchContext): void => {
  if (!isEnabled(context)) return;

  const root = asGlobal();
  if (root.__colonusFetchLoggerInstalled) return;
  if (typeof root.fetch !== "function") return;

  const originalFetch = root.fetch.bind(root);
  root.__colonusFetchLoggerInstalled = true;
  root.__colonusFetchLoggerCounter = 0;

  root.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestId = (root.__colonusFetchLoggerCounter ?? 0) + 1;
    root.__colonusFetchLoggerCounter = requestId;

    const method = toRequestMethod(input, init);
    const url = toRequestUrl(input);
    const startedAt = Date.now();
    const logPrefix = `[FETCH][${context}][${requestId}]`;

    console.info(`${logPrefix} -> ${method} ${url}`);
    try {
      const response = await originalFetch(input, init);
      const duration = Date.now() - startedAt;
      console.info(
        `${logPrefix} <- ${response.status} ${response.statusText} (${duration}ms) ${method} ${url}`
      );
      return response;
    } catch (error) {
      const duration = Date.now() - startedAt;
      console.error(`${logPrefix} !! (${duration}ms) ${method} ${url}`, error);
      throw error;
    }
  };
};

