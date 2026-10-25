"""Regenerates src/AgentOffice/Data/skills/README.md: one row per built-in skill with its upstream source,
license, pinned commit and the roles that use it, read from each skill's SOURCE.md and SKILL.md and from
Data/roles.json. Run after adding or updating a vendored skill: python3 tools/skills-manifest.py
"""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent / "src" / "AgentOffice" / "Data"
skills_dir = root / "skills"
roles = json.loads((root / "roles.json").read_text(encoding="utf-8"))
used_by = {}
for role in roles:
    for name in role.get("skills", []):
        used_by.setdefault(name, []).append(role["title"])


def field(text, key):
    m = re.search(rf"^- {key}:\s*(.+)$", text, re.M)
    return m.group(1).strip() if m else ""


def frontmatter(text, key):
    m = re.search(rf"^{key}:\s*(.+)$", text.split("\n---", 1)[0], re.M)
    return m.group(1).strip().strip('"') if m else ""


rows = []
for d in sorted(p for p in skills_dir.iterdir() if (p / "SKILL.md").is_file()):
    skill = (d / "SKILL.md").read_text(encoding="utf-8")
    source = (d / "SOURCE.md").read_text(encoding="utf-8") if (d / "SOURCE.md").is_file() else ""
    upstream = field(source, "Upstream") or "unknown"
    house = upstream.lower().startswith("none")
    path = field(source, "Path")
    commit = field(source, "Commit")
    link = upstream if house or not path else f"{upstream.rstrip('/')}/tree/{commit or 'main'}/{path.strip('/')}"
    rows.append({
        "name": d.name,
        "source": "Agent Office (house)" if house else f"[{re.sub(r'^https?://github.com/', '', upstream).rstrip('/')}]({link})",
        "license": "house" if house else (frontmatter(skill, "license") or field(source, "License") or "?"),
        "commit": "" if house else (commit[:10] if commit else "?"),
        "roles": ", ".join(used_by.get(d.name, [])) or "—",
    })

lines = [
    "# Built-in skills",
    "",
    "Skills that ship with Agent Office, read-only in the app. Upstream skills are vetted copies pinned to a commit and",
    "adapted to run as instructions only; each folder keeps the upstream `LICENSE` and a `SOURCE.md` listing what changed.",
    "Skills marked CC-BY-SA-4.0 stay under that license when adapted. Regenerate this file with `python3 tools/skills-manifest.py`.",
    "",
    "| Skill | Source | License | Commit | Roles |",
    "|---|---|---|---|---|",
    *[f"| `{r['name']}` | {r['source']} | {r['license']} | {r['commit']} | {r['roles']} |" for r in rows],
    "",
]
(skills_dir / "README.md").write_text("\n".join(lines), encoding="utf-8")
print(f"Data/skills/README.md: {len(rows)} skills")
