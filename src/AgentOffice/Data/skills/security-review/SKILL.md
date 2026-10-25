---
name: security-review
description: "Security code review for vulnerabilities. Use when asked to \"security review\", \"find vulnerabilities\", \"check for security issues\", \"audit security\", \"OWASP review\", or review code for injection, XSS, authentication, authorization, cryptography issues. Provides systematic, read-only review with confidence-based reporting and BLOCKER/MAJOR/MINOR/NIT severities; reports findings and remediation guidance, never patches."
license: Apache-2.0 AND CC-BY-SA-4.0
---

> This SKILL.md is adapted from getsentry/skills (Apache-2.0). The bundled reference material under
> `references/`, `languages/` and `infrastructure/` is derived from the OWASP Cheat Sheet Series
> (https://cheatsheetseries.owasp.org/), licensed CC BY-SA 4.0; see `LICENSE-CC-BY-SA`.

# Security Review Skill

Identify exploitable security vulnerabilities in code. Report only **HIGH CONFIDENCE** findings—clear vulnerable patterns with attacker-controlled input.

## Ground Rules in This Office

- **Read-only.** You review; you do not fix. Never edit source files, never write patches or diffs, never commit. Remediation goes into the report as guidance text for whoever owns the code.
- **Tools.** Use `list_files` and `read_file` to trace data flow. If your role has `run_command`, you may run read-only searches (e.g. the `grep` patterns in the reference files) inside the mission workspace. The shell commands in the reference files are examples of what to look for, not steps you must run.
- **Static review only.** Do not run exploit payloads, fuzzers, network scanners, or anything against live systems. Do not install tools or download code.
- **Secrets.** If you find a hardcoded secret, report its location and type; redact the value (show at most a short prefix). Do not copy secrets, customer data or PII into reports or board cards.

## Scope: Research vs. Reporting

**CRITICAL DISTINCTION:**

- **Report on**: Only the specific file, diff, or code given to you by whoever asked
- **Research**: The ENTIRE codebase to build confidence before reporting

Before flagging any issue, you MUST research the codebase to understand:
- Where does this input actually come from? (Trace data flow)
- Is there validation/sanitization elsewhere?
- How is this configured? (Check settings, config files, middleware)
- What framework protections exist?

**Do NOT report issues based solely on pattern matching.** Investigate first, then report only what you're confident is exploitable.

## Confidence Levels

Confidence (how sure you are) is separate from severity (how bad it is).

| Level | Criteria | Action |
|-------|----------|--------|
| **HIGH** | Vulnerable pattern + attacker-controlled input confirmed | **Report** with severity |
| **MEDIUM** | Vulnerable pattern, input source unclear | **Note** as "Needs verification" |
| **LOW** | Theoretical, best practice, defense-in-depth | **Do not report** |

## Do Not Flag

### General Rules
- Test files (unless explicitly reviewing test security)
- Dead code, commented code, documentation strings
- Patterns using **constants** or **server-controlled configuration**
- Code paths that require prior authentication to reach (note the auth requirement instead)

### Server-Controlled Values (NOT Attacker-Controlled)

These are configured by operators, not controlled by attackers:

| Source | Example | Why It's Safe |
|--------|---------|---------------|
| Django settings | `settings.API_URL`, `settings.ALLOWED_HOSTS` | Set via config/env at deployment |
| Environment variables | `os.environ.get('DATABASE_URL')` | Deployment configuration |
| Config files | `config.yaml`, `app.config['KEY']` | Server-side files |
| Framework constants | `django.conf.settings.*` | Not user-modifiable |
| Hardcoded values | `BASE_URL = "https://api.internal"` | Compile-time constants |

**SSRF Example - NOT a vulnerability:**
```python
# SAFE: URL comes from Django settings (server-controlled)
response = requests.get(f"{settings.SEER_AUTOFIX_URL}{path}")
```

**SSRF Example - IS a vulnerability:**
```python
# VULNERABLE: URL comes from request (attacker-controlled)
response = requests.get(request.GET.get('url'))
```

### Framework-Mitigated Patterns
Check language guides before flagging. Common false positives:

| Pattern | Why It's Usually Safe |
|---------|----------------------|
| Django `{{ variable }}` | Auto-escaped by default |
| React `{variable}` | Auto-escaped by default |
| Vue `{{ variable }}` | Auto-escaped by default |
| `User.objects.filter(id=input)` | ORM parameterizes queries |
| `cursor.execute("...%s", (input,))` | Parameterized query |
| `innerHTML = "<b>Loading...</b>"` | Constant string, no user input |

**Only flag these when:**
- Django: `{{ var|safe }}`, `{% autoescape off %}`, `mark_safe(user_input)`
- React: `dangerouslySetInnerHTML={{__html: userInput}}`
- Vue: `v-html="userInput"`
- ORM: `.raw()`, `.extra()`, `RawSQL()` with string interpolation

## Review Process

Read bundled files with `read_skill_file("security-review", "<path>")`, using the paths below.

### 1. Detect Context

What type of code am I reviewing?

| Code Type | Load These References |
|-----------|----------------------|
| API endpoints, routes | `references/authorization.md`, `references/authentication.md`, `references/injection.md` |
| Django/DRF views, permission classes, object-level access | `references/authorization.md` |
| Frontend, templates | `references/xss.md`, `references/csrf.md`, `references/modern-threats.md` (DOM clobbering, prototype pollution) |
| File handling, uploads | `references/file-security.md` |
| Crypto, secrets, tokens | `references/cryptography.md`, `references/data-protection.md` |
| Data serialization | `references/deserialization.md` |
| External requests | `references/ssrf.md` |
| Business workflows | `references/business-logic.md` |
| GraphQL, REST design | `references/api-security.md` |
| Config, headers, CORS | `references/misconfiguration.md` |
| CI/CD, dependencies | `references/supply-chain.md` |
| Error handling | `references/error-handling.md` |
| Audit, logging | `references/logging.md` |
| Object merging/cloning, `__proto__`, DOM `id`/`name` lookups, WebSocket handlers, LLM prompt construction | `references/modern-threats.md` |

### 2. Load Language Guide

Based on file extension or imports:

| Indicators | Guide |
|------------|-------|
| `.py`, `django`, `flask`, `fastapi` | `languages/python.md` |
| `.js`, `.ts`, `express`, `react`, `vue`, `next` | `languages/javascript.md` |

For other languages there is no dedicated guide; rely on the `references/` files and verify framework protections directly in the codebase.

### 3. Load Infrastructure Guide (if applicable)

| File Type | Guide |
|-----------|-------|
| `Dockerfile`, `.dockerignore` | `infrastructure/docker.md` |
| GitHub Actions workflows | `references/supply-chain.md` |
| Other CI/CD pipelines, lockfiles, package manifests | `references/supply-chain.md` (to run installed audit tools against the lockfiles, use the `dependency-review` skill) |

### 4. Research Before Flagging

**For each potential issue, research the codebase to build confidence:**

- Where does this value actually come from? Trace the data flow.
- Is it configured at deployment (settings, env vars) or from user input?
- Is there validation, sanitization, or allowlisting elsewhere?
- What framework protections apply?

Only report issues where you have HIGH confidence after understanding the broader context.

### 5. Verify Exploitability

For each potential finding, confirm:

**Is the input attacker-controlled?**

| Attacker-Controlled (Investigate) | Server-Controlled (Usually Safe) |
|-----------------------------------|----------------------------------|
| `request.GET`, `request.POST`, `request.args` | `settings.X`, `app.config['X']` |
| `request.json`, `request.data`, `request.body` | `os.environ.get('X')` |
| `request.headers` (most headers) | Hardcoded constants |
| `request.cookies` (unsigned) | Internal service URLs from config |
| URL path segments: `/users/<id>/` | Database content from admin/system |
| File uploads (content and names) | Signed session data |
| Database content from other users | Framework settings |
| WebSocket messages | |

**Does the framework mitigate this?**
- Check language guide for auto-escaping, parameterization
- Check for middleware/decorators that sanitize

**Is there validation upstream?**
- Input validation before this code
- Sanitization libraries (DOMPurify, bleach, etc.)

### 6. Report HIGH Confidence Only

Skip theoretical issues. Report only what you've confirmed is exploitable after research.

---

## Severity Classification

Use the office severity scale.

| Severity | Impact | Examples |
|----------|--------|----------|
| **BLOCKER** | Direct exploit, severe impact, no auth required | RCE, SQL injection to data, auth bypass, hardcoded secrets |
| **MAJOR** | Exploitable with conditions, significant impact | Stored XSS, SSRF to metadata, IDOR to sensitive data |
| **MINOR** | Specific conditions required, moderate impact | Reflected XSS, CSRF on state-changing actions, path traversal |
| **NIT** | Defense-in-depth, minimal direct impact | Missing headers, verbose errors, weak algorithms in non-critical context |

NIT-level items are usually LOW confidence or best practice; per the confidence rules, do not report them unless whoever asked wants hardening notes.

---

## Quick Patterns Reference

### Always Flag (BLOCKER)
```
eval(user_input)           # Any language
exec(user_input)           # Any language
pickle.loads(user_data)    # Python
yaml.load(user_data)       # Python (not safe_load)
unserialize($user_data)    # PHP
deserialize(user_data)     # Java ObjectInputStream
shell=True + user_input    # Python subprocess
child_process.exec(user)   # Node.js
```

### Always Flag (MAJOR)
```
innerHTML = userInput              # DOM XSS
dangerouslySetInnerHTML={user}     # React XSS
v-html="userInput"                 # Vue XSS
f"SELECT * FROM x WHERE {user}"    # SQL injection
`SELECT * FROM x WHERE ${user}`    # SQL injection
os.system(f"cmd {user_input}")     # Command injection
```

### Always Flag (Secrets)
```
password = "hardcoded"
api_key = "sk-..."
AWS_SECRET_ACCESS_KEY = "..."
private_key = "-----BEGIN"
```

### Check Context First (MUST Investigate Before Flagging)
```
# SSRF - ONLY if URL is from user input, NOT from settings/config
requests.get(request.GET['url'])     # FLAG: User-controlled URL
requests.get(settings.API_URL)       # SAFE: Server-controlled config
requests.get(f"{settings.BASE}/{x}") # CHECK: Is 'x' user input?

# Path traversal - ONLY if path is from user input
open(request.GET['file'])            # FLAG: User-controlled path
open(settings.LOG_PATH)              # SAFE: Server-controlled config
open(f"{BASE_DIR}/{filename}")       # CHECK: Is 'filename' user input?

# Open redirect - ONLY if URL is from user input
redirect(request.GET['next'])        # FLAG: User-controlled redirect
redirect(settings.LOGIN_URL)         # SAFE: Server-controlled config

# Weak crypto - ONLY if used for security purposes
hashlib.md5(file_content)            # SAFE: File checksums, caching
hashlib.md5(password)                # FLAG: Password hashing
random.random()                      # SAFE: Non-security uses (UI, sampling)
random.random() for token            # FLAG: Security tokens need secrets module
```

---

## Output Format

Return the report to whoever asked (write it to a file in the mission workspace only if asked to).

```markdown
## Security Review: [File/Component Name]

### Summary
- **Findings**: X (Y BLOCKER, Z MAJOR, ...)
- **Risk Level**: BLOCKER/MAJOR/MINOR/NIT (highest severity found)
- **Confidence**: High/Mixed

### Findings

#### [VULN-001] [Vulnerability Type] (BLOCKER|MAJOR|MINOR|NIT)
- **Location**: `file.py:123`
- **Confidence**: High
- **Issue**: [What the vulnerability is]
- **Impact**: [What an attacker could do]
- **Evidence**:
  ```python
  [Vulnerable code snippet, secrets redacted]
  ```
- **Remediation**: [How to remediate, as guidance for the code owner; do not apply it yourself]

### Needs Verification

#### [VERIFY-001] [Potential Issue]
- **Location**: `file.py:456`
- **Question**: [What needs to be verified]
```

If no vulnerabilities found, state: "No high-confidence vulnerabilities identified."

To combine these findings with other security skills' output into a single ship decision, use the `security-verdict` skill.

---

## Reference Files

### Core Vulnerabilities (`references/`)
| File | Covers |
|------|--------|
| `references/injection.md` | SQL, NoSQL, OS command, LDAP, template injection |
| `references/xss.md` | Reflected, stored, DOM-based XSS |
| `references/authorization.md` | Authorization, IDOR, privilege escalation |
| `references/authentication.md` | Sessions, credentials, password storage |
| `references/cryptography.md` | Algorithms, key management, randomness |
| `references/deserialization.md` | Pickle, YAML, Java, PHP deserialization |
| `references/file-security.md` | Path traversal, uploads, XXE |
| `references/ssrf.md` | Server-side request forgery |
| `references/csrf.md` | Cross-site request forgery |
| `references/data-protection.md` | Secrets exposure, PII, logging |
| `references/api-security.md` | REST, GraphQL, mass assignment |
| `references/business-logic.md` | Race conditions, workflow bypass |
| `references/modern-threats.md` | Prototype pollution, LLM injection, WebSocket |
| `references/misconfiguration.md` | Headers, CORS, debug mode, defaults |
| `references/error-handling.md` | Fail-open, information disclosure |
| `references/supply-chain.md` | Dependencies, build security |
| `references/logging.md` | Audit failures, log injection |

### Language Guides (`languages/`)
- `languages/python.md` - Django, Flask, FastAPI patterns
- `languages/javascript.md` - Node, Express, React, Vue, Next.js

### Infrastructure (`infrastructure/`)
- `infrastructure/docker.md` - Container security
