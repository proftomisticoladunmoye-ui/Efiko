// Efiko — SMS transport. Mock by default (returns what WOULD be sent), or live via
// Africa's Talking (the best fit for the African 2G markets Efiko targets). Swappable
// like every other channel. Set SMS_PROVIDER=africastalking + AT_* to go live.
const PROVIDER = (process.env.SMS_PROVIDER || 'mock').toLowerCase();
const atKey = () => (process.env.AT_API_KEY || '').trim();
const atUser = () => (process.env.AT_USERNAME || '').trim();
const atSender = () => (process.env.AT_SENDER_ID || '').trim();

export function smsLive() {
  return PROVIDER === 'africastalking' && Boolean(atKey() && atUser());
}

export async function sendSms(to, messages) {
  if (!smsLive()) {
    return messages.map((text) => ({ to, text, mock: true }));
  }
  const results = [];
  for (const text of messages) {
    const body = new URLSearchParams({ username: atUser(), to, message: text });
    if (atSender()) body.set('from', atSender());
    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey: atKey(),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: body.toString()
    });
    results.push({ to, status: res.status });
  }
  return results;
}
