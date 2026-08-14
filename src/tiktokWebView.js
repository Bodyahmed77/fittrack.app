import { registerPlugin } from "@capacitor/core";

const TikTokWebView = registerPlugin("TikTokWebView");

export async function openTikTokWebView(url) {
  const value = String(url || "").trim();
  if (!/^https?:\/\//i.test(value)) {
    throw new Error("TikTok WebView requires an http(s) URL");
  }
  return TikTokWebView.open({ url: value });
}
