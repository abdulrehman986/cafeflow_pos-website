import { randomInt } from "crypto";

const WORDS = ["chai", "biryani", "kebab", "karahi", "paratha", "falooda", "lassi", "samosa"];

/** Human-friendly temporary password: word + 2 digits + symbol-ish letter. */
export function generatePassword(): string {
  const word = WORDS[randomInt(WORDS.length)];
  const n = randomInt(10, 99);
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ"[randomInt(24)];
  return `${WordCap(word)}${n}${c}!`;
}

function WordCap(w: string) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}
