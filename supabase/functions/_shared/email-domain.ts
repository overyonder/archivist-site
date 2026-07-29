export type EmailDomainStatus =
  | "invalid"
  | "receivable"
  | "unreceivable"
  | "unknown";

const domainFromEmail = (email: string): string | null => {
  const separator = email.lastIndexOf("@");
  if (
    separator <= 0 ||
    separator !== email.indexOf("@") ||
    separator === email.length - 1
  ) {
    return null;
  }

  try {
    const url = new URL(`http://${email.slice(separator + 1)}/`);
    return !url.username &&
        !url.password &&
        !url.port &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash &&
        !url.hostname.startsWith("[")
      ? url.hostname
      : null;
  } catch {
    return null;
  }
};

const hasAddressRecord = async (
  domain: string,
  type: "A" | "AAAA",
): Promise<boolean> =>
  (await Deno.resolveDns(domain, type, {
    signal: AbortSignal.timeout(1_500),
  })).length > 0;

export async function emailDomainStatus(
  email: string,
): Promise<EmailDomainStatus> {
  const domain = domainFromEmail(email);
  if (!domain) return "invalid";

  try {
    const records = await Deno.resolveDns(domain, "MX", {
      signal: AbortSignal.timeout(1_500),
    });
    return records.length === 1 &&
        records[0].preference === 0 &&
        records[0].exchange === "."
      ? "unreceivable"
      : records.length > 0
      ? "receivable"
      : "unknown";
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn("Could not resolve email domain MX records", error);
      return "unknown";
    }
  }

  const addressRecords = await Promise.allSettled([
    hasAddressRecord(domain, "A"),
    hasAddressRecord(domain, "AAAA"),
  ]);
  if (
    addressRecords.some((result) =>
      result.status === "fulfilled" && result.value
    )
  ) {
    return "receivable";
  }
  return addressRecords.every((result) =>
      result.status === "rejected" &&
      result.reason instanceof Deno.errors.NotFound
    )
    ? "unreceivable"
    : "unknown";
}
