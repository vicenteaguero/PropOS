type LogLevel = "info" | "warn" | "error";

const EMOJI_MAP: Record<string, string> = {
  auth: "\uD83D\uDD10",
  data: "\uD83D\uDCE6",
  start: "\uD83D\uDE80",
  success: "\u2705",
  error: "\u274C",
  warning: "\u26A0\uFE0F",
  process: "\uD83D\uDD04",
  write: "\uD83D\uDCDD",
  delete: "\uD83D\uDDD1\uFE0F",
  query: "\uD83D\uDD0D",
  request: "\uD83D\uDCE1",
  test: "\uD83E\uDDEA",
};

function formatTimestamp(): string {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function formatContext(context?: Record<string, string>): string {
  if (!context) return "";
  const pairs = Object.entries(context)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  return ` (${pairs})`;
}

export function createLogger(scope: string) {
  function log(level: LogLevel, emojiKey: string, message: string, context?: Record<string, string>) {
    const timestamp = formatTimestamp();
    const emoji = EMOJI_MAP[emojiKey] ?? "\uD83D\uDCCB";
    const ctx = formatContext(context);
    const output = `[${timestamp}] [${scope}]${ctx} ${emoji} ${message}`;

    switch (level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "info":
        console.warn(output);
        break;
    }
  }

  return {
    info: (emojiKey: string, message: string, context?: Record<string, string>) =>
      log("info", emojiKey, message, context),
    warn: (emojiKey: string, message: string, context?: Record<string, string>) =>
      log("warn", emojiKey, message, context),
    error: (emojiKey: string, message: string, context?: Record<string, string>) =>
      log("error", emojiKey, message, context),
  };
}
