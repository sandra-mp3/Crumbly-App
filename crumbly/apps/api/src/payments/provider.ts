export interface PaymentRequest { amount: number; phone: string; reference: string; description: string }
export interface PaymentInit { providerRef: string; merchantRef?: string }
/** Orders depend on this interface only. Add CardPaymentProvider later without touching order code. */
export interface PaymentProvider { readonly name: string; initiate(r: PaymentRequest): Promise<PaymentInit> }
