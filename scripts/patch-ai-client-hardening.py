from pathlib import Path
import re

P = Path("src/aiCoach.js")
s = P.read_text(encoding="utf-8")

# The client is already hardened in source on current production branches.
# Keep the release transform idempotent instead of failing when an older patch
# anchor is no longer present.
modern = "getIdToken(false)" in s and "status === 401" in s and "timeZone" in s
if modern:
    if "FIFTYFIT_AI_CLIENT_HARDENING_V2" not in s:
        s = "/* FIFTYFIT_AI_CLIENT_HARDENING_V2 */\n" + s
    P.write_text(s, encoding="utf-8")
    print("AI client hardening already present")
    raise SystemExit(0)

if "FIFTYFIT_AI_CLIENT_HARDENING_V2" not in s:
    s = s.replace(
        '    const requestDate = localISODateNow();\n    const idToken = await user.getIdToken(true);',
        '''    const requestDate = localISODateNow();
    const timeZone = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch (_) {
        return "UTC";
      }
    })();
    let idToken = await user.getIdToken(false);''',
        1,
    )
    s = s.replace(
        'const body = { messages: recent, message: lastUser ? String(lastUser.content) : "", lang: lang || "en", localDate: requestDate, context: userContext || {} };',
        'const body = { messages: recent, message: lastUser ? String(lastUser.content) : "", lang: lang || "en", localDate: requestDate, timeZone, context: userContext || {} };',
        1,
    )

    retry = re.compile(r'''      for \(let attempt = 0; attempt < 2; attempt \+= 1\) \{\n        response = await postAiRequest\(endpoint, headers, body\);\n        if \(response\.status !== 503 \|\| attempt === 1\) break;\n        writeAiDiagnostics\(\{ stage: "backend_retry", attempt: attempt \+ 1, status: response\.status \}\);\n        await new Promise\(\(resolve\) => setTimeout\(resolve, 900\)\);\n      \}''')
    replacement = '''      let refreshedAfter401 = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await postAiRequest(endpoint, headers, body);
        if (response.status === 401 && !refreshedAfter401) {
          refreshedAfter401 = true;
          try {
            idToken = await user.getIdToken(true);
            headers.Authorization = `Bearer ${idToken}`;
            writeAiDiagnostics({ stage: "auth_refresh_after_401" });
            continue;
          } catch (refreshError) {
            writeAiDiagnostics({ stage: "auth_refresh_failed", message: String(refreshError?.message || refreshError).slice(0, 160) });
          }
        }
        if (response.status !== 503 || attempt >= 2) break;
        writeAiDiagnostics({ stage: "backend_retry", attempt: attempt + 1, status: response.status });
        await new Promise((resolve) => setTimeout(resolve, 900));
      }'''
    s, count = retry.subn(replacement, s, count=1)
    if count != 1:
        raise SystemExit("AI client: retry anchor not found")
    s = '/* FIFTYFIT_AI_CLIENT_HARDENING_V2 */\n' + s

P.write_text(s, encoding="utf-8")
print("AI client hardening applied")
