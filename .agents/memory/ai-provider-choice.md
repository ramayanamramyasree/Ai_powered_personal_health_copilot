---
name: AI provider choice for Altrix
description: The user declined Replit AI integration billing and chose their own OpenAI API key.
---

For Altrix, use the user-provided OpenAI API key rather than retrying Replit AI Integrations setup.

**Why:** The user declined the upgrade/credit-based Replit AI option and securely supplied an OpenAI key.

**How to apply:** Keep OpenAI requests server-side and use the existing Replit Secret; never expose or print its value, and do not retry the declined integration.
