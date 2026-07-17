import { verify, X509Certificate } from "node:crypto";
import { requiredEnv } from "./config.ts";

export interface SnsEnvelope {
  Type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: "1" | "2";
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
}

const certificateCache = new Map<string, X509Certificate>();

export async function verifySnsEnvelope(envelope: SnsEnvelope): Promise<void> {
  if (envelope.TopicArn !== requiredEnv("SNS_TOPIC_ARN")) {
    throw new Error("Unexpected SNS topic");
  }

  const certificateUrl = validAwsCertificateUrl(envelope.SigningCertURL);
  let certificate = certificateCache.get(certificateUrl.href);
  if (!certificate) {
    const response = await fetch(certificateUrl, { redirect: "error" });
    if (!response.ok) {
      throw new Error("Could not retrieve SNS signing certificate");
    }
    certificate = new X509Certificate(await response.text());
    certificateCache.set(certificateUrl.href, certificate);
  }

  const algorithm = envelope.SignatureVersion === "1"
    ? "RSA-SHA1"
    : "RSA-SHA256";
  if (
    !verify(
      algorithm,
      new TextEncoder().encode(canonicalMessage(envelope)),
      certificate.publicKey,
      Uint8Array.from(
        atob(envelope.Signature),
        (character) => character.charCodeAt(0),
      ),
    )
  ) throw new Error("Invalid SNS signature");
}

export async function confirmSnsSubscription(
  envelope: SnsEnvelope,
): Promise<void> {
  if (!envelope.SubscribeURL) {
    throw new Error("SNS confirmation omitted SubscribeURL");
  }
  const url = new URL(envelope.SubscribeURL);
  if (url.protocol !== "https:" || !isSnsHostname(url.hostname)) {
    throw new Error("Invalid SNS subscription URL");
  }
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) throw new Error("SNS subscription confirmation failed");
}

function validAwsCertificateUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.port ||
    !isSnsHostname(url.hostname) ||
    !/^\/SimpleNotificationService-[A-Za-z0-9_-]+\.pem$/.test(url.pathname)
  ) throw new Error("Invalid SNS signing certificate URL");
  return url;
}

function isSnsHostname(hostname: string): boolean {
  return hostname === "sns.amazonaws.com" ||
    /^sns\.[a-z0-9-]+\.amazonaws\.com(?:\.cn)?$/.test(hostname);
}

function canonicalMessage(envelope: SnsEnvelope): string {
  const fields = envelope.Type === "Notification"
    ? [
      "Message",
      "MessageId",
      ...(envelope.Subject ? ["Subject"] : []),
      "Timestamp",
      "TopicArn",
      "Type",
    ]
    : [
      "Message",
      "MessageId",
      "SubscribeURL",
      "Timestamp",
      "Token",
      "TopicArn",
      "Type",
    ];

  return fields.map((field) => {
    const value = envelope[field as keyof SnsEnvelope];
    if (typeof value !== "string") {
      throw new Error(`SNS envelope omitted ${field}`);
    }
    return `${field}\n${value}`;
  }).join("\n") + "\n";
}
