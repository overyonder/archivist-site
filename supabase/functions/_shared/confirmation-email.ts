export function confirmationEmail(confirmUrl: string) {
  const escapedUrl = escapeHtml(confirmUrl);
  return {
    subject: "Confirm your Archivist early access",
    text: [
      "Confirm your Archivist early access",
      "",
      "Open this link to confirm your address:",
      confirmUrl,
      "",
      "If you didn’t request this, you can ignore this email.",
      "",
      "Archivist — an over|yonder product",
      "https://over-yonder.tech/",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark"><title>Confirm your Archivist early access</title></head>
<body style="margin:0;padding:0;background:#080706;color:#f4eee6;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#080706">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;border:1px solid #493a2d;background:#0e0c0b">
        <tr><td style="padding:18px 24px;border-bottom:1px solid #302820">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="width:28px;height:28px;border:2px solid #ff8a00;color:#ff8a00;font:700 16px/28px Arial,sans-serif;text-align:center">A</td>
            <td style="padding-left:12px;color:#f4eee6;font:700 13px Arial,sans-serif;letter-spacing:3px;text-transform:uppercase">Archivist</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:52px 24px 46px">
          <p style="margin:0 0 18px;color:#ff8a00;font:700 11px monospace;letter-spacing:2px;text-transform:uppercase">Early access · Address confirmation</p>
          <h1 style="margin:0;color:#f4eee6;font:700 36px/1.05 Arial,sans-serif;letter-spacing:-1px">Confirm your address.</h1>
          <p style="max-width:430px;margin:22px 0 0;color:#a69b90;font:16px/1.6 Arial,sans-serif">Open the link below to finish joining Archivist early access.</p>
          <p style="margin:34px 0 0"><a href="${escapedUrl}" style="display:inline-block;padding:14px 18px;border:1px solid #ff8a00;background:#ff8a00;color:#130b03;font:700 13px monospace;letter-spacing:1px;text-decoration:none;text-transform:uppercase">Confirm my address&nbsp;&nbsp;→</a></p>
        </td></tr>
        <tr><td style="padding:18px 24px;border-top:1px solid #302820;color:#756d66;font:12px/1.5 Arial,sans-serif">
          If you didn’t request this, you can ignore this email.
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#655d56;font:10px monospace;letter-spacing:1px;text-transform:uppercase">Archivist · An <a href="https://over-yonder.tech/" style="color:#756d66;text-decoration:underline">over|yonder</a> product</p>
    </td></tr>
  </table>
</body></html>`,
  };
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
