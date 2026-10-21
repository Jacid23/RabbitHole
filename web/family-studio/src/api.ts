export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    signal,
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!response.ok) {
    const value = await response.json().catch(() => ({}));
    throw new Error(value.error || "Could not complete this request.");
  }
  return response.json();
}
export async function streamChat(
  body: unknown,
  onEvent: (event: {
    type: string;
    id?: string;
    text?: string;
    message?: string;
  }) => void,
  signal: AbortSignal,
) {
  const response = await fetch("/api/chat", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const value = await response.json().catch(() => ({}));
    throw Error(value.error || "The model could not reply.");
  }
  const reader = response.body!.getReader(),
    decoder = new TextDecoder();
  let pending = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const frames = pending.split("\n\n");
    pending = frames.pop() || "";
    for (const frame of frames) {
      const line = frame.split("\n").find((v) => v.startsWith("data:"));
      if (line) onEvent(JSON.parse(line.slice(5)));
    }
  }
}
