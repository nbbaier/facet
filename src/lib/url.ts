import normalizeUrl from "normalize-url";
import crypto from "crypto";

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ref",
  "source",
];

export function normalizeBookmarkUrl(url: string): string {
  return normalizeUrl(url, {
    stripWWW: true,
    stripHash: true,
    removeTrailingSlash: true,
    removeQueryParameters: TRACKING_PARAMS,
    sortQueryParameters: true,
    forceHttps: true,
  });
}

export function hashUrl(normalizedUrl: string): string {
  return crypto.createHash("sha256").update(normalizedUrl).digest("hex");
}
