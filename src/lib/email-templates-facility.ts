// The two facility onboarding emails: registration welcome and profile completed.
// Table layout with inline styles (what email clients render reliably), 600px wide and fluid on
// phones, brand teal #0f5c52 + gold #c7963f on cream. {{placeholders}} are filled (HTML-escaped)
// by sendTemplatedEmail; the editable copies live in Admin → Notifications → Templates.

const FONT = "Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

function shell(opts: { title: string; preheader: string; rows: string; recipientNote: string }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${opts.title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3ede0; -webkit-text-size-adjust:100%;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3ede0;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#fffdf8; border:1px solid #e3d9c0; border-radius:14px; overflow:hidden;">
<tr>
<td style="background-color:#0f5c52; padding:26px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-family:${SERIF}; font-size:20px; font-weight:700; color:#f6ead0; letter-spacing:0.3px;">{{portal_name}}</td>
<td align="right" style="font-family:${FONT}; font-size:10.5px; letter-spacing:2px; text-transform:uppercase; color:#b7d9cf;">Unani practice &middot; Modern care</td>
</tr></table>
</td>
</tr>
<tr><td style="height:4px; background-color:#c7963f; line-height:4px; font-size:0;">&nbsp;</td></tr>
${opts.rows}
<tr>
<td style="padding:22px 32px 6px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e9e0cb;"><tr>
<td style="padding-top:18px; font-family:${FONT}; font-size:13px; line-height:1.6; color:#6b6155;">
<strong style="color:#2b2420;">Need a hand?</strong> Write to <a href="mailto:{{support_email}}" style="color:#0f5c52; font-weight:600; text-decoration:none;">{{support_email}}</a> or call <strong style="color:#2b2420;">{{support_phone}}</strong>. We read every message.
</td>
</tr></table>
</td>
</tr>
<tr>
<td style="padding:16px 32px 26px 32px; font-family:${FONT}; font-size:11.5px; line-height:1.6; color:#9a9183;">
${opts.recipientNote}<br>
&copy; {{year}} {{portal_name}}. All rights reserved.
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const eyebrow = (text: string) =>
  `<div style="font-family:${FONT}; font-size:11px; font-weight:700; letter-spacing:2.2px; text-transform:uppercase; color:#c7963f;">${text}</div>`;

const button = (href: string, label: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
<tr><td style="background-color:#0f5c52; border-radius:8px;">
<a href="${href}" style="display:inline-block; padding:14px 28px; font-family:${FONT}; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none;">${label} &rarr;</a>
</td></tr></table>`;

const sectionTitle = (text: string) =>
  `<div style="font-family:${SERIF}; font-size:17px; font-weight:700; color:#0f5c52; margin:0 0 10px 0;">${text}</div>`;

const tick = `<td width="26" valign="top" style="padding:2px 0;"><div style="width:18px; height:18px; border-radius:9px; background-color:#dcebe6; color:#0f5c52; font-family:${FONT}; font-size:11px; font-weight:700; line-height:18px; text-align:center;">&#10003;</div></td>`;

const detailRow = (label: string, value: string) => `<tr>
<td width="150" valign="top" style="padding:7px 0; font-family:${FONT}; font-size:13px; color:#9a9183; border-bottom:1px solid #efe7d4;">${label}</td>
<td valign="top" style="padding:7px 0; font-family:${FONT}; font-size:13.5px; font-weight:600; color:#2b2420; border-bottom:1px solid #efe7d4;">${value}</td>
</tr>`;

// ---------------------------------------------------------------- Welcome (registration)

export const FACILITY_WELCOME_SUBJECT = "Welcome to {{portal_name}} — finish setting up {{facility_name}}";

export const FACILITY_WELCOME_HTML = shell({
  title: "Welcome to {{portal_name}}",
  preheader: "{{facility_name}} is registered. Complete your facility profile in about 3 minutes to start seeing patients.",
  recipientNote: "You are receiving this because {{facility_email}} was used to register a facility on {{portal_name}}.",
  rows: `<tr>
<td style="padding:32px 32px 6px 32px;">
${eyebrow("Registration confirmed")}
<h1 style="margin:10px 0 0 0; font-family:${SERIF}; font-size:27px; line-height:1.25; font-weight:700; color:#2b2420;">Welcome, {{facility_name}}</h1>
<p style="margin:12px 0 0 0; font-family:${FONT}; font-size:15px; line-height:1.7; color:#4a4238;">Your facility account on {{portal_name}} is ready. One short step remains before you can register patients: tell us about your clinic.</p>
</td>
</tr>
<tr>
<td style="padding:20px 32px 4px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f1e2; border:1px solid #e9e0cb; border-radius:10px;">
<tr>
<td width="50%" valign="top" style="padding:16px 18px; border-right:1px solid #e9e0cb;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="top" style="padding-right:10px;"><div style="width:26px; height:26px; border-radius:13px; background-color:#0f5c52; color:#ffffff; font-family:${FONT}; font-size:13px; font-weight:700; line-height:26px; text-align:center;">&#10003;</div></td>
<td valign="top" style="font-family:${FONT};"><div style="font-size:13.5px; font-weight:700; color:#2b2420;">Account created</div><div style="font-size:12.5px; color:#6b6155; margin-top:2px;">{{registration_date}}</div></td>
</tr></table>
</td>
<td width="50%" valign="top" style="padding:16px 18px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="top" style="padding-right:10px;"><div style="width:26px; height:26px; border-radius:13px; border:2px solid #c7963f; color:#c7963f; font-family:${FONT}; font-size:13px; font-weight:700; line-height:22px; text-align:center; box-sizing:border-box;">2</div></td>
<td valign="top" style="font-family:${FONT};"><div style="font-size:13.5px; font-weight:700; color:#2b2420;">Complete your profile</div><div style="font-size:12.5px; color:#6b6155; margin-top:2px;">About 3 minutes</div></td>
</tr></table>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:22px 32px 4px 32px;">
${button("{{profile_setup_url}}", "Complete your facility profile")}
<p style="margin:10px 0 0 0; font-family:${FONT}; font-size:12.5px; color:#9a9183;">Or sign in any time at <a href="{{login_url}}" style="color:#0f5c52; text-decoration:none;">{{login_url}}</a></p>
</td>
</tr>
<tr>
<td style="padding:26px 32px 4px 32px;">
${sectionTitle("Keep these ready")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${FONT}; font-size:14px; line-height:1.55; color:#4a4238;">
<tr>${tick}<td style="padding:2px 0 8px 0;"><strong style="color:#2b2420;">HFR number</strong> &mdash; your Health Facility Registry ID from ABDM (IN followed by 10 digits)</td></tr>
<tr>${tick}<td style="padding:2px 0 8px 0;"><strong style="color:#2b2420;">Address and PIN code</strong> &mdash; printed on your receipts and reports</td></tr>
<tr>${tick}<td style="padding:2px 0 8px 0;"><strong style="color:#2b2420;">Opening days and hours</strong>, and roughly how many patients you see a day</td></tr>
<tr>${tick}<td style="padding:2px 0 0 0;"><strong style="color:#2b2420;">Specializations and services</strong> &mdash; from Moalijat and Hijama to diagnostics</td></tr>
</table>
</td>
</tr>
<tr>
<td style="padding:26px 32px 4px 32px;">
${sectionTitle("What your clinic gets")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="50%" valign="top" style="padding:0 8px 12px 0;"><div style="border:1px solid #e9e0cb; border-radius:10px; padding:14px; font-family:${FONT};"><div style="font-size:14px; font-weight:700; color:#0f5c52;">Reception desk</div><div style="font-size:12.5px; line-height:1.55; color:#6b6155; margin-top:4px;">Register and find patients, see the day&rsquo;s visits at a glance.</div></div></td>
<td width="50%" valign="top" style="padding:0 0 12px 8px;"><div style="border:1px solid #e9e0cb; border-radius:10px; padding:14px; font-family:${FONT};"><div style="font-size:14px; font-weight:700; color:#0f5c52;">Unani assessment</div><div style="font-size:12.5px; line-height:1.55; color:#6b6155; margin-top:4px;">Vitals, Mizaj, Asbab-e-Sitta and Tashkhees in one guided flow.</div></div></td>
</tr>
<tr>
<td width="50%" valign="top" style="padding:0 8px 0 0;"><div style="border:1px solid #e9e0cb; border-radius:10px; padding:14px; font-family:${FONT};"><div style="font-size:14px; font-weight:700; color:#0f5c52;">Payments &amp; receipts</div><div style="font-size:12.5px; line-height:1.55; color:#6b6155; margin-top:4px;">Your own fee list, printable receipts and daily collections.</div></div></td>
<td width="50%" valign="top" style="padding:0 0 0 8px;"><div style="border:1px solid #e9e0cb; border-radius:10px; padding:14px; font-family:${FONT};"><div style="font-size:14px; font-weight:700; color:#0f5c52;">Your team</div><div style="font-size:12.5px; line-height:1.55; color:#6b6155; margin-top:4px;">Add staff, choose what each role can do, see who did what.</div></div></td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:26px 32px 4px 32px;">
${sectionTitle("Your account")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${detailRow("Facility", "{{facility_name}}")}
${detailRow("Registered email", "{{facility_email}}")}
${detailRow("Registered on", "{{registration_date}}")}
</table>
<p style="margin:14px 0 0 0; font-family:${FONT}; font-size:12.5px; line-height:1.6; color:#6b6155;">&#128274; Sign in with your password or a one-time code sent to this email. {{portal_name}} will never ask for your password or a code by phone or message.</p>
</td>
</tr>`,
});

// ---------------------------------------------------------------- Profile completed

export const FACILITY_COMPLETED_SUBJECT = "{{facility_name}} is live — your free trial runs until {{end_date}}";

export const FACILITY_COMPLETED_HTML = shell({
  title: "Your facility profile is complete",
  preheader: "Your profile is complete and your free trial is active until {{end_date}}. Here is how to get started.",
  recipientNote: "You are receiving this because the facility profile for {{facility_name}} was completed on {{portal_name}}.",
  rows: `<tr>
<td style="padding:32px 32px 6px 32px;">
${eyebrow("Profile complete")}
<h1 style="margin:10px 0 0 0; font-family:${SERIF}; font-size:27px; line-height:1.25; font-weight:700; color:#2b2420;">You&rsquo;re all set, {{facility_name}}</h1>
<p style="margin:12px 0 0 0; font-family:${FONT}; font-size:15px; line-height:1.7; color:#4a4238;">Your facility is now live on {{portal_name}}. Below is your plan, a summary of what you set up, and the quickest way to see your first patient.</p>
</td>
</tr>
<tr>
<td style="padding:20px 32px 4px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #0f5c52; border-radius:12px; background-color:#f2f8f6;">
<tr>
<td style="padding:18px 20px 6px 20px; font-family:${FONT};">
<span style="display:inline-block; background-color:#0f5c52; color:#ffffff; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:4px 10px; border-radius:20px;">Free trial &middot; Active</span>
<div style="font-family:${SERIF}; font-size:26px; font-weight:700; color:#0f5c52; margin-top:10px;">{{trial_months}} months free</div>
</td>
</tr>
<tr>
<td style="padding:6px 20px 4px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${FONT};"><tr>
<td width="50%" style="padding:8px 0;"><div style="font-size:11.5px; text-transform:uppercase; letter-spacing:1px; color:#6b6155;">Started</div><div style="font-size:15px; font-weight:700; color:#2b2420; margin-top:2px;">{{start_date}}</div></td>
<td width="50%" style="padding:8px 0;"><div style="font-size:11.5px; text-transform:uppercase; letter-spacing:1px; color:#6b6155;">Trial ends</div><div style="font-size:15px; font-weight:700; color:#2b2420; margin-top:2px;">{{end_date}}</div></td>
</tr></table>
</td>
</tr>
<tr>
<td style="padding:6px 20px 16px 20px; font-family:${FONT}; font-size:13px; line-height:1.6; color:#4a4238; border-top:1px solid #d5e7e1;">
Then <strong>{{price_text}} / month</strong> to continue, with no interruption. No payment details are needed now.
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:24px 32px 4px 32px;">
${button("{{dashboard_url}}", "Open your dashboard")}
</td>
</tr>
<tr>
<td style="padding:26px 32px 4px 32px;">
${sectionTitle("Your first day, in 4 steps")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${FONT};">
<tr><td width="34" valign="top" style="padding:0 0 12px 0;"><div style="width:24px; height:24px; border-radius:12px; background-color:#c7963f; color:#ffffff; font-size:12px; font-weight:700; line-height:24px; text-align:center;">1</div></td><td valign="top" style="padding:2px 0 12px 0; font-size:14px; line-height:1.5; color:#4a4238;"><strong style="color:#2b2420;">Set your fees</strong> &mdash; Facility Profile &rarr; Fees. Reception then picks a fee and prints a receipt.</td></tr>
<tr><td width="34" valign="top" style="padding:0 0 12px 0;"><div style="width:24px; height:24px; border-radius:12px; background-color:#c7963f; color:#ffffff; font-size:12px; font-weight:700; line-height:24px; text-align:center;">2</div></td><td valign="top" style="padding:2px 0 12px 0; font-size:14px; line-height:1.5; color:#4a4238;"><strong style="color:#2b2420;">Add your staff</strong> &mdash; give each person a role; their permissions follow.</td></tr>
<tr><td width="34" valign="top" style="padding:0 0 12px 0;"><div style="width:24px; height:24px; border-radius:12px; background-color:#c7963f; color:#ffffff; font-size:12px; font-weight:700; line-height:24px; text-align:center;">3</div></td><td valign="top" style="padding:2px 0 12px 0; font-size:14px; line-height:1.5; color:#4a4238;"><strong style="color:#2b2420;">Register your first patient</strong> &mdash; Reception desk &rarr; Register new patient.</td></tr>
<tr><td width="34" valign="top" style="padding:0;"><div style="width:24px; height:24px; border-radius:12px; background-color:#c7963f; color:#ffffff; font-size:12px; font-weight:700; line-height:24px; text-align:center;">4</div></td><td valign="top" style="padding:2px 0 0 0; font-size:14px; line-height:1.5; color:#4a4238;"><strong style="color:#2b2420;">Run the assessment</strong> &mdash; Vitals, Mizaj, Asbab-e-Sitta, then Tashkhees and the treatment plan.</td></tr>
</table>
</td>
</tr>
<tr>
<td style="padding:26px 32px 4px 32px;">
${sectionTitle("Your facility profile")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${detailRow("Facility", "{{facility_name}}")}
${detailRow("Type", "{{facility_type}}")}
${detailRow("HFR number", "{{hfr_number}}")}
${detailRow("Address", "{{address}}")}
${detailRow("Specializations", "{{specializations}}")}
${detailRow("Services offered", "{{services_count}} selected")}
</table>
<p style="margin:12px 0 0 0; font-family:${FONT}; font-size:12.5px; line-height:1.6; color:#6b6155;">Anything to change? Everything above can be edited any time in Facility Profile.</p>
</td>
</tr>`,
});
