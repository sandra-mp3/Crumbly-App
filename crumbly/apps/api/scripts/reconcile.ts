// Manual run of the payment reconciliation job (the same code the /internal route uses).
import { queryStk } from "../src/payments/mpesa.js";
import { reconcilePending } from "../src/payments/reconcile.js";
import { onPaymentApplied } from "../src/notify.js";
console.log(await reconcilePending(queryStk, onPaymentApplied));
