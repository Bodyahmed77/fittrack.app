from pathlib import Path

# Server-side quota clock: use Cairo time on the server, never the client-supplied date.
p = Path('supabase/functions/ai-coach/index.ts')
s = p.read_text(encoding='utf-8')
old = '''    // Quota bucket is server UTC, matching the PostgreSQL RPC's current_date.\n    // The client-supplied localDate remains intentionally ignored.\n    const localDate = new Date().toISOString().slice(0, 10);'''
new = '''    // Quota bucket is calculated on the server in the app's operating timezone.\n    // The client-supplied localDate remains intentionally ignored.\n    const localDate = new Intl.DateTimeFormat("en-CA", {\n      timeZone: "Africa/Cairo",\n      year: "numeric",\n      month: "2-digit",\n      day: "2-digit",\n    }).format(new Date());'''
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# AI client: remove unnecessary identity/entitlement fields and retry only the
# server's bounded-overload response. This gives a small queue-like experience
# without creating an unbounded server request queue.
p = Path('src/aiCoach.js')
s = p.read_text(encoding='utf-8')
s = s.replace('''function diag() {}''', '''function diag(...args) {\n  if (import.meta?.env?.DEV) console.log(...args);\n}''', 1)

old_body = '''      timeZone:\n        typeof Intl !== "undefined" && Intl.DateTimeFormat\n          ? Intl.DateTimeFormat().resolvedOptions().timeZone || ""\n          : "",\n      context: userContext || {},\n      hasAiPro: !!hasAiPro,\n      uid: user.uid,'''
new_body = '''      context: userContext || {},'''
if old_body in s:
    s = s.replace(old_body, new_body, 1)

old_fetch = '''    let res;\n    try {\n      res = await fetch(endpoint, {\n        method: "POST",\n        headers,\n        body: JSON.stringify(body),\n      });\n    } catch (e) {\n      diag(\n        "[AI_COACH_HTTP] network_error=" +\n          String(e?.message || e).slice(0, 160),\n      );\n      const err = new Error(e?.message || "Network error");\n      err.code = "network";\n      diag("[AI_COACH_FINAL_ERROR] code=network");\n      throw err;\n    }'''
new_fetch = '''    let res;\n    try {\n      // Retry only bounded server overload. The server does not consume quota\n      // before granting a global AI slot, so these retries cannot burn messages.\n      for (let attempt = 0; attempt < 3; attempt += 1) {\n        res = await fetch(endpoint, {\n          method: "POST",\n          headers,\n          body: JSON.stringify(body),\n        });\n        if (res.status !== 503 || attempt === 2) break;\n        await new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 900 * (attempt + 1)));\n      }\n    } catch (e) {\n      diag(\n        "[AI_COACH_HTTP] network_error=" +\n          String(e?.message || e).slice(0, 160),\n      );\n      const err = new Error(e?.message || "Network error");\n      err.code = "network";\n      diag("[AI_COACH_FINAL_ERROR] code=network");\n      throw err;\n    }'''
if old_fetch in s:
    s = s.replace(old_fetch, new_fetch, 1)
p.write_text(s, encoding='utf-8')
print('AI client/server hardening applied')
