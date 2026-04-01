<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Commit workflow

Before creating any git commit, always bump the `version` field in `package.json` using semantic versioning:
- **patch** (0.1.0 → 0.1.1): bug fixes
- **minor** (0.1.0 → 0.2.0): new features
- **major** (0.1.0 → 1.0.0): breaking changes

Include the version bump in the same commit as the code changes.
