const placeholderOrigin = "http://internal.invalid";

/**
 * Returns `target` when it is a path on this site, and `fallback` otherwise. Used for every
 * redirect whose destination comes from a request, so users cannot be sent to another site.
 */
export function safeRedirectPath<T extends string | null>(
  target: unknown,
  fallback: T,
): string | T {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) {
    return fallback;
  }
  // Browsers treat backslashes like slashes and ignore tabs and newlines in URLs.
  if (/[\\\u0000-\u001f\u007f]/.test(target)) {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(target, placeholderOrigin);
  } catch {
    return fallback;
  }
  if (url.origin !== placeholderOrigin) {
    return fallback;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
