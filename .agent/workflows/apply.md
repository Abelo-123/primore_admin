---
description: Apply Qwen plan, provide 3-5 point fix summary, output service-specific Git commands (file-specific add, custom remotes, master branch) & .env commands, wait for deploy confirmation, and test live Render URLs
---

When the user runs this workflow:

1. **Phase 1 — Plan Acquisition & Guardrails:**
   - Check if `plan.txt` exists in the workspace root. If so, read the plan from `plan.txt`. Otherwise, use the text passed directly into the command.
   - Act purely as an implementer. Follow the plan verbatim without skipping steps, guessing, or touching unaffected files.
   - Respect service boundaries across the 5 platforms (Client FE, Client BE, Admin FE, Admin BE, Bot Server).

2. **Phase 2 — Code Execution:**
   - Apply every file edit, replacement snippet, or file creation described in the plan.
   - Verify syntax, types, and imports are fully intact.
   - If database migrations or SQL scripts are included, apply them if local, or provide the exact queries to run.

3. . **Phase 3 — Fix Summary, Precise Git Commands & .ENV Handoff:**
   - **DO NOT automatically run `git push`.**
   - In the chat response, output the following sections:

     1. **3–5 Point Fix & Error Summary:**
        Provide a concise breakdown (strictly 3 to 5 bullet points) covering:
        - What the underlying bug/error was actually caused by.
        - What specific changes were applied to fix it across the affected services/database.
        - Any side effects or edge cases guarded against.

     2. **Manual Git Commands (Strict Path Isolation & Explicit Files Only):**
        To completely prevent staging entire folders or leaking files from one service into another, output the exact terminal commands following these strict isolation rules:
        
        - **Service-Level Isolation:** Every service must be handled in an independent command block. Never stage files across multiple services in a single command block.
        - **Exact Directory Navigation:** Always `cd` into the exact local directory of the service first.
        - **Strictly Relative & Explicit Paths:**
          * Every file passed to `git add` must be an explicit, single file path written **strictly relative to the service root** (the folder you just `cd`'d into).
          * **ABSOLUTELY FORBIDDEN:** Never output `git add .`, `git add -A`, `git add *`, or directory-level staging like `git add src/` or `git add app/`.
          * Do NOT use workspace-root relative paths inside a service repository.
        - **Staging Verification Step:** Include `git diff --name-only --cached` after `git add` so the user can verify that ONLY the intended files were staged before committing.
        - **Custom Remotes:** Use the service-specific remote name (NOT `origin`):
          * Client Front-end: `client-front`
          * Client Back-end:  `client-back`
          * Admin Front-end:  `admin-front`
          * Admin Back-end:   `admin-back`
          * Bot Server:       `bot-server` (or corresponding remote from Master KI)
        - **Target Branch:** Always target the `master` branch.

        Format to output for EACH modified service:
        ```bash
        # --- [PLATFORM NAME] ---
        cd <exact-local-path-to-service>
        git status -s
        # Stage ONLY the exact modified/created files relative to this directory:
        git add path/to/exact_file_1.ext path/to/exact_file_2.ext
        # Verify that ONLY the intended files are staged (no accidental files):
        git diff --name-only --cached
        git commit -m "fix: [issue summary] - applied architecture plan"
        git push <remote-name> master
        ```

     3. **New / Updated .ENV Variables:**
        Clearly list any environment variable additions or updates specified in the plan (to update locally and in the Render Dashboard).

   - **Wait for Confirmation:** Ask the user to run the git commands, update Render env vars, and reply with **"deployed"** once Render finishes building and deploying.


4. **Phase 4 — Post-Deploy Verification Testing (Triggered after user confirmation):**
   - Once the user confirms that the deployment is live on Render:
     1. Run local test or build scripts (e.g., `npm test` or `npm run build`) to ensure clean execution.
     2. Using the Render service URLs from the Master KI, ping the live health/status endpoints (via `curl` or HTTP requests).
     3. If a specific API endpoint or bot action was fixed, run a test request against the live Render URL to confirm the fix works in production.

5. **Phase 5 — Cleanup & Final Report:**
   - Provide a final summary in the chat:
     * **Files Modified:** (Grouped by service)
     * **Live Verification Results:** (Render URL health check status and API test response)
     * **Cleanup:** Confirmation that temporary context/plan files were removed