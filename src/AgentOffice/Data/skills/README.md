# Built-in skills

Skills that ship with Agent Office, read-only in the app. Upstream skills are vetted copies pinned to a commit and
adapted to run as instructions only; each folder keeps the upstream `LICENSE` and a `SOURCE.md` listing what changed.
Skills marked CC-BY-SA-4.0 stay under that license when adapted. Regenerate this file with `python3 tools/skills-manifest.py`.

| Skill | Source | License | Commit | Roles |
|---|---|---|---|---|
| `ab-test-analysis` | [phuryn/pm-skills](https://github.com/phuryn/pm-skills/tree/07b34f64ee828df08953f505b7f747aef85ae7c6/pm-data-analytics/skills/ab-test-analysis) | MIT | 07b34f64ee | Data Analyst |
| `ac-test-plan` | Agent Office (house) | house |  | QA Engineer |
| `accessibility` | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills/tree/afa8da942115f2961fdbfa80807ea0b232ff6c00/skills/accessibility) | MIT | afa8da9421 | Product Designer |
| `analyze-data` | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/analyze) | Apache-2.0 | 33d3dea41a | Data Analyst |
| `api-and-interface-design` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills/tree/aeac41d4d005999432bb7312f7ff06383a91d59d/skills/api-and-interface-design) | MIT | aeac41d4d0 | Software Architect |
| `bug-report-severity` | Agent Office (house) | house |  | QA Engineer |
| `bug-reproduction-brief` | [github/awesome-copilot](https://github.com/github/awesome-copilot/tree/d85f762d6e521abf5fe16703946e9b38adc42da7/skills/bug-reproduction-brief) | MIT | d85f762d6e | QA Engineer |
| `define-prioritization-framework` | [product-on-purpose/pm-skills](https://github.com/product-on-purpose/pm-skills/tree/f943d9589bfe9db06fac2641f9740987ff9b3aee/skills/define-prioritization-framework (skill version 1.3.0)) | Apache-2.0 | f943d9589b | Product Manager |
| `deliver-acceptance-criteria` | [product-on-purpose/pm-skills](https://github.com/product-on-purpose/pm-skills/tree/f943d9589bfe9db06fac2641f9740987ff9b3aee/skills/deliver-acceptance-criteria (skill version 1.1.1; repo release v2.34.0)) | Apache-2.0 | f943d9589b | Product Manager |
| `deliver-edge-cases` | [product-on-purpose/pm-skills](https://github.com/product-on-purpose/pm-skills/tree/f943d9589bfe9db06fac2641f9740987ff9b3aee/skills/deliver-edge-cases (skill version 2.1.1)) | Apache-2.0 | f943d9589b | Product Manager |
| `dependency-review` | Agent Office (house) | house |  | Security Reviewer |
| `deploy-checklist` | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/engineering/skills/deploy-checklist) | Apache-2.0 | 33d3dea41a | Site Reliability Engineer |
| `diataxis-docs-framework` | [anivar/developer-docs-framework](https://github.com/anivar/developer-docs-framework/tree/c0e9445fcdf832681db78eaca58cdcefccd1e654/SKILL.md (repo root), references/, references/styles/, rules) | MIT | c0e9445fcd | Technical Writer |
| `differential-review` | [trailofbits/skills](https://github.com/trailofbits/skills/tree/196a9073ab10d35bacf111f945e02c00b2c6883a/plugins/differential-review/skills/differential-review) | CC-BY-SA-4.0 | 196a9073ab | Security Reviewer |
| `docker-build-strategies` | [docker/skills](https://github.com/docker/skills/tree/179c9cfd04c89ae50cd5d5d68b939797a8fd03d3/skills/docker-build-strategies) | Apache-2.0 | 179c9cfd04 | Site Reliability Engineer |
| `docker-destructive-guardrails` | [docker/skills](https://github.com/docker/skills/tree/179c9cfd04c89ae50cd5d5d68b939797a8fd03d3/skills/docker-destructive-guardrails) | Apache-2.0 | 179c9cfd04 | Site Reliability Engineer |
| `documentation-and-adrs` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills/tree/aeac41d4d005999432bb7312f7ff06383a91d59d/skills/documentation-and-adrs) | MIT | aeac41d4d0 | Software Architect |
| `documentation-writer` | [github/awesome-copilot](https://github.com/github/awesome-copilot/tree/d85f762d6e521abf5fe16703946e9b38adc42da7/skills/documentation-writer) | MIT | d85f762d6e | Technical Writer |
| `estimate-with-uncertainty` | Agent Office (house) | house |  | Project Manager |
| `exploratory-charter` | Agent Office (house) | house |  | QA Engineer |
| `explore-data` | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/explore-data) | Apache-2.0 | 33d3dea41a | Data Analyst |
| `flaky-test-triage` | Agent Office (house) | house |  | QA Engineer |
| `foundation-build-risk-review` | [product-on-purpose/pm-skills](https://github.com/product-on-purpose/pm-skills/tree/f943d9589bfe9db06fac2641f9740987ff9b3aee/skills/foundation-build-risk-review (skill version 1.1.0). PM-Skills itself adapted this from bin1874/before-you-build-skill (Apache-2.0); attribution kept in SKILL.md.) | Apache-2.0 | f943d9589b | Product Manager |
| `foundation-meeting-recap` | [product-on-purpose/pm-skills](https://github.com/product-on-purpose/pm-skills/tree/f943d9589bfe9db06fac2641f9740987ff9b3aee/skills/foundation-meeting-recap (skill version 1.2.0); contract excerpt from site/src/content/docs/reference/skill-families/meeting-skills-contract.md (contract v1.1.0)) | Apache-2.0 | f943d9589b | Project Manager |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design) | Apache-2.0 | dbd4588f9e | Product Designer |
| `humanizer` | [blader/humanizer](https://github.com/blader/humanizer/tree/8c307f367c91bd974002f10f2be2965d642c13df/SKILL.md (repo root)) | MIT | 8c307f367c | Technical Writer |
| `incident-runbook-templates` | [wshobson/agents](https://github.com/wshobson/agents/tree/0874a27b17a22e2b7c2e2bcd725768e0803cad06/plugins/incident-response/skills/incident-runbook-templates) | MIT | 0874a27b17 | Site Reliability Engineer |
| `incremental-implementation` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills/tree/aeac41d4d005999432bb7312f7ff06383a91d59d/skills/incremental-implementation) | MIT | aeac41d4d0 | Software Engineer |
| `playwright-cli` | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli/tree/b1a5903c5b633b8c9f843ad7b629c2a78437040c/skills/playwright-cli) | Apache-2.0 | b1a5903c5b | QA Engineer |
| `postmortem-writing` | [wshobson/agents](https://github.com/wshobson/agents/tree/0874a27b17a22e2b7c2e2bcd725768e0803cad06/plugins/incident-response/skills/postmortem-writing) | MIT | 0874a27b17 | Site Reliability Engineer |
| `prod-change-approval` | Agent Office (house) | house |  | Site Reliability Engineer |
| `release-notes-from-board` | Agent Office (house) | house |  | Technical Writer |
| `risk-assessment` | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/operations/skills/risk-assessment) | Apache-2.0 | 33d3dea41a | Project Manager |
| `security-audit` | [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill/tree/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit) | MIT | c1c8a8c147 | Security Reviewer |
| `security-review` | [getsentry/skills](https://github.com/getsentry/skills/tree/d12f250460ffd961f549dbebf7eeb0cf4afd4c2e/skills/security-review) | Apache-2.0 AND CC-BY-SA-4.0 | d12f250460 | Security Reviewer |
| `security-verdict` | Agent Office (house) | house |  | Security Reviewer |
| `short-design-doc` | Agent Office (house) | house |  | Software Architect |
| `slo-implementation` | [wshobson/agents](https://github.com/wshobson/agents/tree/0874a27b17a22e2b7c2e2bcd725768e0803cad06/plugins/observability-monitoring/skills/slo-implementation) | MIT | 0874a27b17 | Site Reliability Engineer |
| `spec-driven-development` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills/tree/aeac41d4d005999432bb7312f7ff06383a91d59d/skills/spec-driven-development) | MIT | aeac41d4d0 | Software Architect |
| `sprint-planning` | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/product-management/skills/sprint-planning) | Apache-2.0 | 33d3dea41a | Project Manager |
| `statistical-analysis` | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/statistical-analysis) | Apache-2.0 | 33d3dea41a | Data Analyst |
| `status-report` | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/operations/skills/status-report) | Apache-2.0 | 33d3dea41a | Project Manager |
| `systematic-debugging` | [obra/superpowers](https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/systematic-debugging) | MIT | 2ce8aa15d0 | Software Engineer, QA Engineer |
| `technical-documentation` | [dsebastien/technical-documentation-skill](https://github.com/dsebastien/technical-documentation-skill/tree/19dd53184ef2755504d985d68f98ff73b05cacda/skills/technical-documentation) | Apache-2.0 | 19dd53184e | Technical Writer |
| `terraform-skill` | [antonbabenko/terraform-skill](https://github.com/antonbabenko/terraform-skill/tree/9c1e92d962a5407c227e5566416e962a2f057240/skills/terraform-skill) | Apache-2.0 | 9c1e92d962 | Site Reliability Engineer |
| `test-driven-development` | [obra/superpowers](https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/test-driven-development) | MIT | 2ce8aa15d0 | Software Engineer |
| `test-gap-audit` | [github/awesome-copilot](https://github.com/github/awesome-copilot/tree/d85f762d6e521abf5fe16703946e9b38adc42da7/skills/test-gap-audit) | MIT | d85f762d6e | QA Engineer |
| `threat-model-analyst` | [github/awesome-copilot](https://github.com/github/awesome-copilot/tree/d85f762d6e521abf5fe16703946e9b38adc42da7/skills/threat-model-analyst) | MIT | d85f762d6e | Security Reviewer |
| `ui-state-matrix` | Agent Office (house) | house |  | Product Designer |
| `ui-ux-designer` | [dr-spook/ui-ux-designer-skill](https://github.com/dr-spook/ui-ux-designer-skill/tree/bf0ee838620e74a11115841346330953da13bced/skills/ui-ux-designer) | MIT | bf0ee83862 | Product Designer |
| `ux-writing` | [content-designer/ux-writing-skill](https://github.com/content-designer/ux-writing-skill/tree/98cacde4ba2dd10ed28df43a8d53eef1e321c539/(repo root) SKILL.md, references/, examples/, templates) | MIT | 98cacde4ba | Product Designer |
| `validate-data` | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/data/skills/validate-data) | Apache-2.0 | 33d3dea41a | Data Analyst |
| `verification-before-completion` | [obra/superpowers](https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/verification-before-completion) | MIT | 2ce8aa15d0 | Software Engineer, QA Engineer, Site Reliability Engineer |
| `work-handoff-brief` | Agent Office (house) | house |  | Project Manager |
| `write-spec` | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins/tree/33d3dea41a341b341d4f5da2e8801ae0c89be2b8/product-management/skills/write-spec) | Apache-2.0 | 33d3dea41a | Product Manager |
| `writing-plans` | [obra/superpowers](https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/writing-plans) | MIT | 2ce8aa15d0 | Software Architect |
