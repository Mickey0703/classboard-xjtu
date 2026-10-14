# Project delivery workflow

The user has authorized the following workflow for every change in this project:

- Keep working on the original branch; currently this is `feat/design-refresh`. Do not create or switch branches unless the user requests it.
- After completing a change, run the relevant tests and the production build. Resolve failures before publishing.
- Commit the task's changes on the original branch and push to its existing remote. Do not force-push or include unrelated user changes.
- Deploy the verified commit to the existing Cloudflare Pages production website, `classboard-xjtu`. Check the project's production branch before deployment and verify the live site afterward.
- Report the commit and deployment result. If credentials or permissions block an operation, explain the actual blocker; do not claim an unverified deployment succeeded.

This standing authorization includes Git commits, pushes, and production deployments after verification; do not request the same approval again for each modification. Database migrations and destructive operations still require checking the task's scope and existing authorization.
