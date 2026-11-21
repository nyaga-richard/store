import "server-only";

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export function isSecureRequest(forwardedProto: string | null): boolean {
  if (forwardedProto) return forwardedProto.split(",")[0].trim() === "https";
  return appUrl().startsWith("https://");
}
