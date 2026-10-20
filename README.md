# Nemanja Mikić — CV & portfolio

An English portfolio and CV website for GitHub Pages. Plain HTML, CSS and JavaScript, with no frontend dependencies or third-party analytics.

**Website:** https://n0tl3ss.github.io/ — publishing is manual from the `gh-pages` branch. The contact form is deliberately disabled until the Google and Cloudflare services are connected; visitors can use the email link. The form never simulates successful delivery.

## Local preview

Requires Node.js 22 or newer. No dependency installation is needed.

```sh
npm run dev
```

Open `http://127.0.0.1:4173`. To check or build:

```sh
npm test
npm run build
```

Only `site/` is copied to `dist/`. The Apps Script backend, tests, setup instructions and secrets do not belong in the public website artifact.

## Contents

- Experience at Oracle and Seven Bridges Genomics, education and technical skills.
- Selected framework, cloud and developer-tooling work with public contribution links.
- Six published Micronaut guides with direct links and attribution.
- One-page and detailed PDF downloads. These web copies use city/country instead of a street address and omit the phone number. The original CV documents are unchanged.
- An accessible, responsive contact form with an email fallback.
- Light and dark themes, with a header switch and a saved browser preference. Light is the default; printing uses a light palette.
- Search metadata, `ProfilePage`/`Person`/`WebSite` structured data, a canonical URL, sitemap, robots file and social sharing image.

## Search and custom domain

The current canonical is the working GitHub Pages URL. [Loopia DNS and domain activation instructions](deployment/DOMAIN.md) prepare the move to `nmikic.rs`; registration, ownership verification and HTTPS must be ready before cutover.

Google Search Console still needs an owner-authenticated property verification, sitemap submission and homepage URL inspection. After verification, check indexing and search queries over time. No metadata or test score can guarantee first place for a name search.

When changing content, keep the sitemap `lastmod` and profile `dateModified` accurate. The social image is generated from [design/social-card.svg](design/social-card.svg); it is a title card, not a portrait.

The repository history was rewritten to update retired contact details, including historical PDF content. If you cloned before that cleanup, clone it again rather than merging or pushing old branches back.

## Contact: private Sheet + email

```text
GitHub Pages form
       ↓ native form POST
Google Apps Script
       ├─ validates Cloudflare Turnstile on the server
       ├─ stores the message in a private Google Sheet
       └─ sends an email notification to the fixed owner address
```

The visitor receives a confirmation page from Apps Script and a return link. Using a regular form POST avoids an extra CORS proxy or a paid application server.

1. Follow [apps-script/README.md](apps-script/README.md) to configure the private spreadsheet and backend. Google authorization is performed by the account owner. Do not paste secrets into GitHub files or chat.
2. Create a Cloudflare Turnstile widget for the exact final website hostname, normally `n0tl3ss.github.io`. Set its secret in Apps Script and its **public site key** in `site/contact-config.js`.
3. Set `endpoint` in the same public configuration file to the versioned Apps Script `/exec` URL. This URL and the site key are public by design. Keep the secret key, Sheet ID and backend settings server-side.
4. Use the live widget action `contact`. The backend checks both the action and hostname; client-side validation alone never authorizes a submission.
5. After deployment, send one message with the owner's approval and verify the Sheet row, notification and reply address. Local tests use mocked provider services and cannot establish real delivery.

Apps Script and email have account quotas. A saved message remains in the Sheet if email notification fails; inspect the notification-status column. This personal contact endpoint is not a general mailing service or a guarantee against distributed denial-of-service.

## Publish

The owner approved public deployment after reviewing the light and dark themes. GitHub Pages serves the root of `gh-pages`. That branch contains only the contents of `site/`, including `.nojekyll`; backend files and tests are not part of the served website.

After committing and pushing source changes:

```sh
npm test
npm run build
git push origin "$(git subtree split --prefix=site)":refs/heads/gh-pages
```

The subtree split preserves site history, so later deployments push normally without force. Pushing the source branch alone does not deploy. Check the Pages build and the public URL after updating `gh-pages`.

This branch-based deployment uses the current GitHub login without requiring additional OAuth workflow permissions. `deployment/github-actions/` contains inactive templates for a future switch to custom Actions. Their publish template requires live contact configuration; the current branch deployment permits the explicitly disabled form and email fallback.

To activate the form later, connect the services above, run `node scripts/check-live-config.mjs`, then deploy and verify one real message reaches both the Sheet and the owner's email.

## Sources

Content is based on the candidate's CV, employment dates and verified public contributions. Examples:

- [Micronaut OpenTelemetry](https://github.com/micronaut-projects/micronaut-tracing/pull/65)
- [OCI SDK retry scheduling](https://github.com/micronaut-projects/micronaut-oracle-cloud/pull/1403)
- [Python dataclass introspection](https://github.com/micronaut-projects/micronaut-core/pull/13786)
- [Published OKE guide](https://guides.micronaut.io/micronaut-k8s-oci-gradle-java/)

Service documentation:

- [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Cloudflare Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
