export type NormalizedPaymentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'unknown';

export interface NormalizedPayment {
  providerPaymentId: string;
  externalReference: string;
  amount: string;
  currency: string;
  status: NormalizedPaymentStatus;
  paymentMethod?: string;
  providerStatus?: string;
  occurredAt?: string;
  confirmedAt?: string;
}

export interface PaymentLookupInput {
  paymentId: string;
  accessToken: string;
}

export interface PaymentProviderAdapter {
  readonly code: string;
  getPayment(input: PaymentLookupInput): Promise<NormalizedPayment>;
}
