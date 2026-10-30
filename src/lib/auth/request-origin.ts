/**
 * Accepts a state-changing request only when the browser reports that it came from this site.
 * This stops other sites from submitting the sign-in, sign-out and password forms.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
