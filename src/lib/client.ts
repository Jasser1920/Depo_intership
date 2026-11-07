"use client";

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const FLAGS: Record<string, string> = {
  portugal: "🇵🇹", switzerland: "🇨🇭", denmark: "🇩🇰",
};

export function flag(country: string): string {
  return FLAGS[country.trim().toLowerCase()] ?? "🌍";
}

export function daysSince(iso?: string): number {
  return iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : 0;
}
