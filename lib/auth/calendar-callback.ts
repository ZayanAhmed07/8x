export function calendarCallbackMatchesSite(redirectUri: string, siteUrl: string): boolean {
  try {
    const callback = new URL(redirectUri);
    const site = new URL(siteUrl);
    return ["http:", "https:"].includes(callback.protocol)
      && callback.origin === site.origin
      && callback.pathname === "/api/integrations/google/callback"
      && !callback.search && !callback.hash && !callback.username && !callback.password;
  } catch { return false; }
}
