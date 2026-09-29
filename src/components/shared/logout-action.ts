"use client";

export async function logout(): Promise<{ success: boolean }> {
  try {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    return res.ok ? { success: true } : { success: false };
  } catch {
    return { success: false };
  }
}
