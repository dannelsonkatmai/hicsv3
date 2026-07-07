// Vendor-agnostic notification provider layer (spec §7 / resolved decision 4).
// No SMS/paging vendor is confirmed, so providers implement one interface and
// are selected per channel. Email ships working (Resend-compatible HTTP API);
// SMS/voice/paging are pluggable stubs — add a Twilio/Everbridge-class adapter
// here and register it in getProvider() without touching anything else.

export interface NotificationRecipient {
  name: string;
  address: string; // email address, phone number, or pager id depending on channel
}

export interface SendResult {
  ok: boolean;
  provider: string;
  error?: string;
}

export interface NotificationProvider {
  readonly name: string;
  readonly channel: 'email' | 'sms' | 'paging';
  send(recipient: NotificationRecipient, subject: string, body: string): Promise<SendResult>;
}

/** Email via Resend's HTTP API (SendGrid-compatible shape; swap the URL/payload to change vendors). */
export class ResendEmailProvider implements NotificationProvider {
  readonly name = 'resend';
  readonly channel = 'email' as const;

  constructor(
    private apiKey: string,
    private fromAddress: string
  ) {}

  async send(recipient: NotificationRecipient, subject: string, body: string): Promise<SendResult> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [recipient.address],
          subject,
          text: body
        })
      });
      if (!response.ok) {
        return { ok: false, provider: this.name, error: `HTTP ${response.status}: ${await response.text()}` };
      }
      return { ok: true, provider: this.name };
    } catch (err) {
      return { ok: false, provider: this.name, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Placeholder adapter: records the attempt without sending. Replace with Twilio/etc. when a vendor is chosen. */
export class StubProvider implements NotificationProvider {
  constructor(
    readonly name: string,
    readonly channel: 'sms' | 'paging'
  ) {}

  send(_recipient: NotificationRecipient, _subject: string, _body: string): Promise<SendResult> {
    return Promise.resolve({
      ok: false,
      provider: this.name,
      error: `No ${this.channel} vendor configured — plug an adapter into notification-providers.ts`
    });
  }
}

export function getProvider(channel: 'email' | 'sms' | 'paging'): NotificationProvider {
  switch (channel) {
    case 'email': {
      const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
      const from = Deno.env.get('NOTIFY_FROM_EMAIL') ?? 'alerts@example.com';
      return new ResendEmailProvider(apiKey, from);
    }
    case 'sms':
      return new StubProvider('sms-stub', 'sms');
    case 'paging':
      return new StubProvider('paging-stub', 'paging');
  }
}
