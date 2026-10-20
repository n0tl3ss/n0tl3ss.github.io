# Nemanja Mikić — CV & portfolio

An English portfolio and CV website for GitHub Pages. Plain HTML, CSS and JavaScript, with no frontend dependencies or third-party analytics.

**Website:** https://n0tl3ss.github.io/ — publishing is manual from the `gh-pages` branch. The contact form is deliberately disabled until the Google services are connected; visitors can use the email link. The form never simulates successful delivery.

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
- Framework and cloud feature contributions, including Micronaut Data vector search, OpenTelemetry, OKE Workload Identity, OCI Certificates, Micrometer Observation, CloudWatch logging and Python dataclasses, with dated public PR links. Additional links cover Prometheus Pushgateway, JDBC tracing, OCI raw metrics and OCI DevOps project generation.
- Apple web server security acknowledgment (November 2025), with the source link and a saved screenshot of the relevant section.
- Six published Micronaut guides with direct links and attribution.
- One-page and detailed PDF downloads. These web copies use city/country instead of a street address and omit the phone number. The editable CV documents are maintained separately.
- An accessible, responsive contact form with an email fallback.
- Light and dark themes, with a header switch and a saved browser preference. Light is the default; printing uses a light palette.
- Search metadata, `ProfilePage`/`Person`/`WebSite` structured data, a canonical URL, sitemap, robots file and social sharing image.

## Search and custom domain

The current canonical is the working GitHub Pages URL. [Loopia DNS and domain activation instructions](deployment/DOMAIN.md) prepare the move to `nmikic.rs`; registration, ownership verification and HTTPS must be ready before cutover.

The owner-provided `google2b694a43c865015d.html` file is included for Google Search Console URL-prefix verification. After deployment, click Verify in the owner account, submit `sitemap.xml`, and inspect/request indexing of the homepage. Keep the verification file after verification succeeds. After verification, check indexing and search queries over time. No metadata or test score can guarantee first place for a name search.

When changing content, keep the sitemap `lastmod` and profile `dateModified` accurate. The social image is generated from [design/social-card.svg](design/social-card.svg); it is a title card, not a portrait.

The repository history was rewritten to update retired contact details, including historical PDF content. If you cloned before that cleanup, clone it again rather than merging or pushing old branches back.

## Contact: Google reCAPTCHA + private Sheet + email

[Uputstvo za aktiviranje na srpskom](deployment/CONTACT-SR.md).

```text
GitHub Pages form
       ↓ native form POST with reCAPTCHA token
Google Apps Script
       ├─ verifies Google reCAPTCHA through a server-side assessment
       ├─ stores the message in a private Google Sheet
       └─ sends an email notification to the fixed owner address
```

The visitor receives a confirmation page from Apps Script and a return link. A regular form POST works without an extra CORS proxy or application server.

1. Follow [apps-script/README.md](apps-script/README.md) to configure the Google Cloud checkbox key, private spreadsheet and backend. The owner performs Google authorization.
2. Keep the restricted API key, Sheet ID and backend settings in Apps Script **Script Properties**. Never put secrets in GitHub files or chat.
3. Only the **public reCAPTCHA site key** and deployed Apps Script **`/exec` URL** go into `site/contact-config.js`. These two values can be shared for final connection.
4. Add the current `n0tl3ss.github.io` and future `nmikic.rs` domains to the CAPTCHA key. The backend accepts the exact live hostname configured in Script Properties.
5. Run `node scripts/check-live-config.mjs`, deploy, and verify one real owner test: Sheet row, `MAIL_SENT` status, email receipt and reply address. Local tests mock Google and cannot establish actual delivery.

Google offers a free assessment allowance without billing; see its current [billing and quota documentation](https://docs.cloud.google.com/recaptcha/docs/billing-information). Apps Script and email also have account quotas. A message remains in the Sheet if notification fails; inspect the notification-status column.

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
- [Micronaut Data vector type support — May 2026](https://github.com/micronaut-projects/micronaut-data/pull/3637) and [published vector mapping documentation](https://micronaut-projects.github.io/micronaut-data/latest/guide/#sqlVectorType)
- [OKE Workload Identity — September 2023](https://github.com/micronaut-projects/micronaut-oracle-cloud/pull/686)
- [OCI Certificates — June 2023](https://github.com/micronaut-projects/micronaut-oracle-cloud/pull/596)
- [Micrometer Observation — July 2023](https://github.com/micronaut-projects/micronaut-micrometer/pull/585)
- [OCI runner configuration update — March 2024](https://github.com/micronaut-projects/github-actions/pull/43)
- [Apple acknowledgment — November 2025](https://support.apple.com/en-gw/102774)
- [CloudWatch logging — September 2022](https://github.com/micronaut-projects/micronaut-aws/pull/1438)
- [Prometheus Pushgateway module — October 2024](https://github.com/micronaut-projects/micronaut-micrometer/pull/848)
- [OpenTelemetry JDBC instrumentation — October 2024](https://github.com/micronaut-projects/micronaut-tracing/pull/646)
- [OCI raw metrics registry — January 2024](https://github.com/micronaut-projects/micronaut-oracle-cloud/pull/779)
- [OCI DevOps CI project generation — July 2022](https://github.com/micronaut-projects/micronaut-starter/pull/1302)
- [Python dataclass introspection](https://github.com/micronaut-projects/micronaut-core/pull/13786)
- [Published OKE guide](https://guides.micronaut.io/micronaut-k8s-oci-gradle-java/)

Service documentation:

- [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Google reCAPTCHA checkbox integration](https://docs.cloud.google.com/recaptcha/docs/instrument-web-pages-with-checkbox)
- [Google reCAPTCHA server-side assessments](https://docs.cloud.google.com/recaptcha/docs/create-assessment-website)
- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
