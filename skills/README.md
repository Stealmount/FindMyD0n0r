# 🧠 Agent Skills & Custom Rules (`/skills`)

This directory documents the agent skills, customizations, and project rules used to maintain code quality and prevent accidental data loss.

---

## 🎯 Active Project Rules (`AGENTS.md`)

Location: `.agents/AGENTS.md` & `.user_rules/AGENTS.md`

1. **Visual Parity**: Maintain glassmorphic aesthetic defined in `findmydonor` (`--color-blood-*`, `--color-ink-*`, `.glass`, `.btn-glow`).
2. **Community Platform**: No commercial pricing tiers; 100% free volunteer donor network.
3. **Core Workflow Preservation**: Retain functional compatibility for `DonorRegistration`, `DonorDashboard`, `RequestForm`, `RequesterPortal`, `RequestTracking`, and `NotificationSimulator`.
4. **CTA Wiring**: All display CTAs must trigger active view navigation (`setActiveView`).
5. **TypeScript Rigor**: Strict typing without implicit `any` errors.

---

## 🛠️ Loaded Specialized Skills

| Skill | Purpose | Instruction Location |
|---|---|---|
| **`accidental-data-loss-prevention`** | Requires explicit user confirmation ("yes run it") before executing broad SQL mutations or table drops | `skills/accidental-data-loss-prevention/SKILL.md` |
| **`ponytail`** | Prefers clean, minimal, non-bloated implementation patterns | `.agents/skills/ponytail/SKILL.md` |
| **`building-data-apps`** | Web app component creation and design system utilities | `skills/building-data-apps/SKILL.md` |
| **`skill-repair`** | Automatic skill installation and manifest management | `skills/skill-repair/SKILL.md` |
