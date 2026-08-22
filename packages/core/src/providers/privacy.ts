import { ProviderError } from "./provider.types";

/**
 * Check if a URL or hostname points to an allowed local loopback or local-network address.
 * Allowed patterns:
 * - localhost, *.localhost
 * - 127.0.0.1 (and 127.0.0.0/8 loopback range)
 * - 0.0.0.0
 * - [::1], ::1
 * - *.local (mDNS LAN address)
 */
export function isLocalEndpoint(urlOrHost: string): boolean {
  if (!urlOrHost || !urlOrHost.trim()) {
    return false;
  }

  const input = urlOrHost.trim();
  let hostname = "";

  try {
    const parsed = input.includes("://")
      ? new URL(input)
      : new URL(`http://${input}`);
    hostname = parsed.hostname;
  } catch {
    // If standard URL parsing fails (e.g. raw IPv6 without brackets), extract directly
    hostname = input
      .replace(/^[a-zA-Z]+:\/\//, "")
      .split("/")[0];

    // Strip trailing port if present
    if (hostname.includes(":") && !hostname.includes("::")) {
      hostname = hostname.split(":")[0];
    }
  }

  hostname = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // 1. localhost & subdomains
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }

  // 2. IPv4 loopback (127.0.0.0/8)
  if (hostname === "127.0.0.1" || hostname.startsWith("127.")) {
    return true;
  }

  // 3. IPv4 all interfaces (0.0.0.0)
  if (hostname === "0.0.0.0") {
    return true;
  }

  // 4. IPv6 loopback (::1, [::1])
  if (hostname === "::1" || hostname === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // 5. mDNS local domain (*.local)
  if (hostname.endsWith(".local")) {
    return true;
  }

  return false;
}

/**
 * Validate that the given URL conforms to local-only privacy constraints when enabled.
 * Throws a ProviderError if local-only mode is active and the URL points to a remote endpoint.
 */
export function validateLocalOnly(url: string, localOnly: boolean): void {
  if (!localOnly) {
    return;
  }

  if (!isLocalEndpoint(url)) {
    throw new ProviderError({
      code: "invalid_request",
      message: `Local-only mode is enabled. Blocked non-local URL: '${url}'. Allowed patterns: localhost, 127.0.0.1, 0.0.0.0, [::1], *.local`,
      retryable: false,
    });
  }
}
