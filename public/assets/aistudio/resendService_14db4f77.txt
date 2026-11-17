import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  tags?: Array<{ name: string; value: string }>;
  replyTo?: string;
}

export interface SendEmailResult {
  sent: boolean;
  provider: 'resend' | 'sandbox-preview';
  emailId?: string;
  errorMessage?: string;
  statusCode?: number;
}

function getResendConfig() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const fromAddress = (
    process.env.RESEND_FROM_EMAIL || 'Amir Mobile <onboarding@resend.dev>'
  ).trim();
  const usingTestSender = fromAddress.toLowerCase().includes('onboarding@resend.dev');

  return {
    apiKey,
    configured: apiKey.length > 0,
    fromAddress,
    usingTestSender,
  };
}

export function getResendProviderStatus() {
  const cfg = getResendConfig();
  return {
    resendConfigured: cfg.configured,
    fromAddress: cfg.fromAddress,
    usingTestSender: cfg.usingTestSender,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableResendError(error: { name?: string; statusCode?: number | null; message?: string }): boolean {
  const status = typeof error.statusCode === 'number' ? error.statusCode : 0;
  if (status === 429 || (status >= 500 && status < 600)) {
    return true;
  }
  const name = (error.name || '').toLowerCase();
  return name === 'rate_limit_exceeded' || name === 'internal_server_error' || name === 'application_error';
}

export async function sendEmailWithResend(input: SendEmailInput): Promise<SendEmailResult> {
  const cfg = getResendConfig();
  if (!cfg.configured) {
    return {
      sent: false,
      provider: 'sandbox-preview',
      errorMessage: 'RESEND_API_KEY is not configured in server environment.',
    };
  }

  const resend = new Resend(cfg.apiKey);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await resend.emails.send(
      {
        from: cfg.fromAddress,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
      },
      {
        idempotencyKey: input.idempotencyKey,
      }
    );

    if (!error && data) {
      console.log(`[Resend] Email sent successfully: id=${data.id} to=${input.to}`);
      return {
        sent: true,
        provider: 'resend',
        emailId: data.id,
      };
    }

    const errStatus =
      error && typeof (error as { statusCode?: number | null }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : undefined;

    if (error && isRetryableResendError(error as { name?: string; statusCode?: number | null; message?: string }) && attempt < maxAttempts) {
      await delay(350 * Math.pow(2, attempt - 1));
      continue;
    }

    const message = error?.message || 'Unknown error while sending email via Resend';
    console.error(`[Resend] Email failed: ${message}`);
    return {
      sent: false,
      provider: 'resend',
      errorMessage: message,
      statusCode: errStatus,
    };
  }

  return {
    sent: false,
    provider: 'resend',
    errorMessage: 'Failed to send email after retries.',
  };
}
