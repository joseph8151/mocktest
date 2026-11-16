// 무통장입금 (direct bank transfer to the business account, no PG): the customer gets the account number,
// transfers the money, and an admin confirms the deposit, which issues the ticket (fulfillOrder).
// The account is set in 관리자 → 결제설정 (settings.bank_account) or with BANK_NAME / BANK_ACCOUNT / BANK_HOLDER vars.
export const BANK_DAYS = 3; // unpaid transfer orders expire after this
export async function bankAccount(env) {
  let s = null;
  try { s = JSON.parse((await env.DB.prepare(`SELECT value FROM settings WHERE key='bank_account'`).first())?.value || 'null'); } catch {}
  const a = s?.account ? s : env.BANK_ACCOUNT ? { bank: env.BANK_NAME || '', account: env.BANK_ACCOUNT, holder: env.BANK_HOLDER || '' } : null;
  return a && a.enabled !== false && a.bank && a.account && a.holder ? { bank: a.bank, account: a.account, holder: a.holder } : null;
}
export const cleanDepositor = (s) => String(s || '').replace(/[^\p{L}\p{N} ()&.-]/gu, '').trim().slice(0, 20);
