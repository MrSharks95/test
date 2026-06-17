import type { Locale } from "@/lib/i18n/proxy";

/**
 * Default acknowledgement email templates (durable medium, EU Directive
 * 2023/2673). Simple `{{variable}}` interpolation — merchant-editable, with
 * these defaults as fallback.
 *
 * Variables: customer_name, reference, date, items (HTML), refund_deadline.
 */
export interface EmailTemplate {
  subject: string;
  body: string;
}

const FR: EmailTemplate = {
  subject: "Accusé de réception de votre rétractation ({{reference}})",
  body: `<div style="font-family:system-ui,sans-serif;color:#1a1a2e;max-width:560px">
  <h1 style="font-size:1.3rem">Demande de rétractation enregistrée</h1>
  <p>Bonjour {{customer_name}},</p>
  <p>Nous accusons réception de votre demande de rétractation enregistrée le {{date}}.
     Conservez votre référence&nbsp;: <strong>{{reference}}</strong>.</p>
  <p><strong>Articles concernés&nbsp;:</strong></p>
  {{items}}
  <p>Le remboursement éventuel interviendra au plus tard le {{refund_deadline}}.</p>
  <p style="color:#6b7280;font-size:.85rem">Cet email constitue votre accusé de réception sur support durable.</p>
</div>`,
};

const EN: EmailTemplate = {
  subject: "Acknowledgement of your withdrawal request ({{reference}})",
  body: `<div style="font-family:system-ui,sans-serif;color:#1a1a2e;max-width:560px">
  <h1 style="font-size:1.3rem">Withdrawal request recorded</h1>
  <p>Hello {{customer_name}},</p>
  <p>We acknowledge receipt of your withdrawal request recorded on {{date}}.
     Please keep your reference: <strong>{{reference}}</strong>.</p>
  <p><strong>Items concerned:</strong></p>
  {{items}}
  <p>Any applicable refund will be issued no later than {{refund_deadline}}.</p>
  <p style="color:#6b7280;font-size:.85rem">This email is your acknowledgement on a durable medium.</p>
</div>`,
};

export const DEFAULT_TEMPLATES: Record<Locale, EmailTemplate> = { fr: FR, en: EN };

/**
 * Merchant override shape stored on shops.email_template (jsonb). Any missing
 * field falls back to the default template for that locale.
 */
export interface StoredTemplate {
  subject_fr?: string;
  body_fr?: string;
  subject_en?: string;
  body_en?: string;
}

export function pickTemplate(
  stored: StoredTemplate | null | undefined,
  locale: Locale,
): EmailTemplate {
  const def = DEFAULT_TEMPLATES[locale];
  if (!stored) return def;
  if (locale === "fr") {
    return {
      subject: stored.subject_fr ?? def.subject,
      body: stored.body_fr ?? def.body,
    };
  }
  return {
    subject: stored.subject_en ?? def.subject,
    body: stored.body_en ?? def.body,
  };
}
