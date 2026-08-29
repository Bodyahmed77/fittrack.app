#!/usr/bin/env python3
"""Treat verify-purchase ack-pending as success so Pro unlocks after grant."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src" / "registerPurchase.js"
text = path.read_text(encoding="utf-8")
if "ok_ack_pending" in text:
    print("registerPurchase: ack-pending handling already present")
    raise SystemExit(0)

old = """  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.error || "backend_error";
    err.httpStatus = res.status;
    err.backend = data;
    err.productId = serverProductId;
    err.requestId = data?.requestId || null;
    writeServerDiagnostics({
      stage: "server_verification_failed",
      serverVerification: "failed",
      productId: serverProductId,
      code: err.code,
      httpStatus: res.status,
      requestId: err.requestId,
      message: err.message,
    });
    throw err;
  }"""

new = """  const activatedList = Array.isArray(data?.activated) ? data.activated : [];
  if (!res.ok) {
    if (
      (res.status === 503 || data?.error === "acknowledgement_failed") &&
      activatedList.length > 0
    ) {
      writeServerDiagnostics({
        stage: "server_verification_ok_ack_pending",
        serverVerification: "ok_ack_pending",
        productId: serverProductId,
        httpStatus: res.status,
        requestId: data?.requestId || null,
        activated: activatedList,
      });
      recentSuccessByToken.set(
        purchaseToken,
        Date.now() + RECENT_SUCCESS_TTL_MS,
      );
      return {
        ok: true,
        productId: serverProductId,
        activated: activatedList,
        acknowledged: false,
        acknowledgementPending: true,
        requestId: data?.requestId || null,
      };
    }
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.error || "backend_error";
    err.httpStatus = res.status;
    err.backend = data;
    err.productId = serverProductId;
    err.requestId = data?.requestId || null;
    writeServerDiagnostics({
      stage: "server_verification_failed",
      serverVerification: "failed",
      productId: serverProductId,
      code: err.code,
      httpStatus: res.status,
      requestId: err.requestId,
      message: err.message,
    });
    throw err;
  }"""

if old not in text:
    raise SystemExit("registerPurchase error block not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("registerPurchase: ack-pending unlock path applied")
