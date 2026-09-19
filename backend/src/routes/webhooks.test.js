import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';

// recordRentalPayment hits Supabase - mocked here so these tests exercise
// only the signature-verification logic in webhooks.js, not the database.
vi.mock('../lib/recordPayment.js', () => ({
  recordRentalPayment: vi.fn().mockResolvedValue({ id: 'payment_1' }),
}));

const { recordRentalPayment } = await import('../lib/recordPayment.js');
const { default: app } = await import('../app.js');

const WEBHOOK_SECRET = 'test_webhook_secret';

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function capturedPayload(rentalId = 'rental_123') {
  return JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_abc123',
          order_id: 'order_abc123',
          notes: { rental_id: rentalId },
        },
      },
    },
  });
}

describe('POST /api/webhooks/razorpay', () => {
  const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    recordRentalPayment.mockClear();
  });

  afterEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
  });

  it('records the payment when the signature is valid', async () => {
    const body = capturedPayload();
    const signature = sign(body, WEBHOOK_SECRET);

    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(body);

    expect(res.status).toBe(200);
    expect(recordRentalPayment).toHaveBeenCalledWith({
      rentalId: 'rental_123',
      razorpayOrderId: 'order_abc123',
      razorpayPaymentId: 'pay_abc123',
    });
  });

  it('rejects a forged/incorrect signature and never touches the database', async () => {
    const body = capturedPayload();

    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'not-the-real-signature')
      .send(body);

    expect(res.status).toBe(401);
    expect(recordRentalPayment).not.toHaveBeenCalled();
  });

  it('rejects a payload signed with the wrong secret', async () => {
    const body = capturedPayload();
    const signature = sign(body, 'some-other-secret');

    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(body);

    expect(res.status).toBe(401);
    expect(recordRentalPayment).not.toHaveBeenCalled();
  });

  it('rejects a request with no signature header at all', async () => {
    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .send(capturedPayload());

    expect(res.status).toBe(401);
    expect(recordRentalPayment).not.toHaveBeenCalled();
  });

  it('acknowledges but ignores events other than payment.captured', async () => {
    const body = JSON.stringify({ event: 'payment.failed', payload: {} });
    const signature = sign(body, WEBHOOK_SECRET);

    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(body);

    expect(res.status).toBe(200);
    expect(recordRentalPayment).not.toHaveBeenCalled();
  });

  it('returns 503 when RAZORPAY_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const body = capturedPayload();

    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body, WEBHOOK_SECRET))
      .send(body);

    expect(res.status).toBe(503);
    expect(recordRentalPayment).not.toHaveBeenCalled();
  });

  it('is exempt from the global rate limiter path ordering (mounted before it)', async () => {
    // Not a behavioral assertion about rate-limit counts (slow/flaky to test
    // directly) - just confirms a single well-formed webhook call still
    // succeeds, which would only fail if middleware ordering in app.js
    // regressed and something upstream started rejecting it.
    const body = capturedPayload();
    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body, WEBHOOK_SECRET))
      .send(body);

    expect(res.status).toBe(200);
  });
});
