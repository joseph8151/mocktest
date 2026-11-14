// NHN KCP direct integration ("표준웹" flow): trade registration -> payment window -> return URL -> server approval.
//
// !! Field names, URLs and pay_method codes below follow the KCP standard-web guide as best known, but the official guide
// !! (developer.kcp.co.kr, issued with the merchant contract) was NOT available when this was written and no KCP server could be
// !! reached. Every endpoint is overridable via env (KCP_REGISTER_URL / KCP_APPROVE_URL / KCP_CANCEL_URL) and everything that
// !! depends on the spec is in THIS file, so verifying against KCP's test mall (site_cd T0000) means editing only this module.
// !! Same-flow alternative that needs no such verification: pay through PortOne with a KCP channel (already supported).
const MODES = {
  test: { base: 'https://stg-spl.kcp.co.kr' },
  prod: { base: 'https://spl.kcp.co.kr' },
};
// VERIFY against the guide: 12-digit pay_method switches (position = method)
export const KCP_PAY_METHODS = { CARD: '100000000000', VIRTUAL_ACCOUNT: '001000000000', TRANSFER: '010000000000', MOBILE: '000010000000' };

export const kcpEnabled = (env) => !!(env.KCP_SITE_CD && env.KCP_CERT_INFO);
export function kcpConfig(env) {
  const m = MODES[env.KCP_MODE === 'prod' ? 'prod' : 'test'];
  return {
    mode: env.KCP_MODE === 'prod' ? 'prod' : 'test',
    register: env.KCP_REGISTER_URL || `${m.base}/std/tradeReg/register`,
    approve: env.KCP_APPROVE_URL || `${m.base}/gw/enc/v1/payment`,
    cancel: env.KCP_CANCEL_URL || `${m.base}/gw/mod/v1/cancel`,
  };
}
/** KCP order id: <= 40 chars, we derive it from our order UUID so it can be looked up again. */
export const kcpOrderId = (orderId) => 'K' + orderId.replace(/-/g, '').slice(0, 31);

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const text = await r.text();
  try { return JSON.parse(text); } catch { throw new Error(`KCP non-JSON response (${r.status})`); }
}

/** Step 1: register the trade; KCP returns an approval key + the URL of its payment window. */
export async function kcpRegister(env, { orderId, amount, goodName, payMethod, retUrl, userAgent }) {
  const j = await post(kcpConfig(env).register, {
    site_cd: env.KCP_SITE_CD, ordr_idxx: orderId, good_mny: String(amount), good_name: goodName,
    pay_method: KCP_PAY_METHODS[payMethod] || KCP_PAY_METHODS.CARD, Ret_URL: retUrl, user_agent: userAgent || '',
  });
  if (j.Code !== '0000' && j.res_cd !== '0000') throw new Error(`KCP register failed: ${j.Message || j.res_msg || JSON.stringify(j).slice(0, 120)}`);
  return { approvalKey: j.approvalKey, payUrl: j.PayUrl || j.payUrl, traceNo: j.traceNo };
}

/** The form the browser submits to open KCP's payment window. */
export function kcpForm(env, reg, { orderId, amount, goodName, payMethod, retUrl }) {
  return {
    action: reg.payUrl, method: 'POST',
    fields: { site_cd: env.KCP_SITE_CD, ordr_idxx: orderId, good_name: goodName, good_mny: String(amount), pay_method: KCP_PAY_METHODS[payMethod] || KCP_PAY_METHODS.CARD,
      Ret_URL: retUrl, approval_key: reg.approvalKey, PayUrl: reg.payUrl },
  };
}

/** Step 3: server-side approval using what KCP posted to our return URL. Returns { ok, amount, tno, raw }. */
export async function kcpApprove(env, posted) {
  const j = await post(kcpConfig(env).approve, {
    tran_cd: posted.tran_cd, site_cd: env.KCP_SITE_CD, kcp_cert_info: env.KCP_CERT_INFO,
    enc_data: posted.enc_data, enc_info: posted.enc_info, ordr_idxx: posted.ordr_idxx,
  });
  return { ok: j.res_cd === '0000', amount: Number(j.amount ?? j.good_mny ?? NaN), tno: j.tno, raw: j };
}

export async function kcpCancel(env, { tno, reason = '관리자 환불' }) {
  const j = await post(kcpConfig(env).cancel, { site_cd: env.KCP_SITE_CD, kcp_cert_info: env.KCP_CERT_INFO, tno, mod_type: 'STSC', mod_desc: reason });
  return j.res_cd === '0000';
}
