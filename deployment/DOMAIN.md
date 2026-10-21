# nmikic.rs: Loopia, Cloudflare and GitHub Pages

The canonical domain is **https://nmikic.rs/**, with `www` and the old GitHub Pages address redirected to the apex. Loopia is the registrar, Cloudflare Free hosts DNS, and GitHub Pages hosts the site and manages its HTTPS certificate.

## DNS records in Cloudflare

Keep the records **DNS only**, with automatic TTL. `@` is the domain itself; `www` is a subdomain. Replace conflicting parking/web records for those names and keep unrelated mail/TXT records. Cloudflare's proxy warning does not prevent this DNS-only GitHub Pages setup from working.

| Name | Type | Value |
| --- | --- | --- |
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `www` | CNAME | `n0tl3ss.github.io` |
| `_github-pages-challenge-n0tl3ss` | TXT | The exact value supplied in the owner's GitHub account Settings → Pages |
| `@` | TXT | The `google-site-verification=…` value supplied by the owner's Search Console domain property |

Optional IPv6 records for `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`. Remove incompatible old AAAA records if any exist. No wildcard records are needed.

The Outlook contact address does not require mail hosting or MX records on `nmikic.rs`.

Retain both ownership-verification TXT records after verification. Google's domain property and GitHub's account verification are independent of the old Google URL-prefix HTML file, which also stays in `site/`.

## Activation order

1. Prepare Cloudflare records. Disable the old provider's DNSSEC through Loopia and wait for the old DS record to disappear from the `.rs` registry and expire from DNS caches. Check `dig @a.nic.rs nmikic.rs DS +noall +comments +answer`, then repeat against `1.1.1.1` and `8.8.8.8`. `NOERROR` with no DS answer confirms removal; a timeout or `SERVFAIL` does not. Allow the old record's TTL to expire after removal at the registry.
2. Add `nmikic.rs` under GitHub **account** Settings → Pages. GitHub supplies a TXT challenge under `_github-pages-challenge-n0tl3ss`; add the exact name/value in Cloudflare and retain it. When Cloudflare becomes authoritative and the TXT is publicly visible, click **Verify**. Account ownership verification and the repository's custom-domain setting are separate steps.
3. During the coordinated cutover, configure `nmikic.rs` as the repository's Pages custom domain, then replace Loopia's nameservers with only `gannon.ns.cloudflare.com` and `thea.ns.cloudflare.com`. Click **I updated my nameservers** in Cloudflare. The old GitHub URL may start redirecting before the new domain resolves; perform these steps together. GitHub may create a `CNAME` commit on `gh-pages`. Check `dig @a.nic.rs nmikic.rs NS +noall +answer +authority` and public A/CNAME/TXT answers rather than relying only on panel messages.
4. Wait for DNS validation and the HTTPS certificate, enable **Enforce HTTPS**, then verify the apex, `www`, HTTP-to-HTTPS and old GitHub URL redirects. Do not treat ordering the domain as successful activation.
5. Switch all canonical references together:

   ```sh
   node scripts/set-site-url.mjs https://nmikic.rs
   npm test
   npm run build
   git add site/index.html site/robots.txt site/sitemap.xml site/CNAME
   git commit -m 'Activate nmikic.rs as the canonical domain'
   git push origin codex/cv-website
   ```

6. GitHub's settings may have added a `CNAME` commit directly to `gh-pages`. Fetch it before deploying, then use the publishing procedure below to retain both histories. Push normally; do not force an unrelated branch over the settings commit.
7. Add/verify the old URL-prefix property and the new domain property in Google Search Console, submit `https://nmikic.rs/sitemap.xml`, inspect/request indexing of the homepage, and use Change of Address after redirects work. Keep the old GitHub URL redirecting.
8. Update professional profile website links to the final URL. Allow `nmikic.rs` in the existing reCAPTCHA key, and set Apps Script **Script Properties** to `ALLOWED_HOSTNAME=nmikic.rs` and `SITE_URL=https://nmikic.rs/`. Property-only changes do not require a new code deployment. After HTTPS is ready, send a real owner test and confirm the Sheet row, notification status and email receipt.
9. Once Cloudflare is active, enable DNSSEC there and publish its **new DS values** in Loopia: domain → **DNSSEC → Uključi DNSSEC → Dodaj DS zapis**. Copy the key tag, algorithm, digest type and digest exactly from Cloudflare; select its algorithm instead of retaining Loopia's default. Save, then confirm the setup in Cloudflare. Do not restore the old Loopia DS record or its signing configuration. A saved registrar setting is not yet an active trust chain: wait for the matching DS in the `.rs` registry, then verify successful responses with the `ad` flag from validating resolvers, for example `dig @1.1.1.1 nmikic.rs A +dnssec`. An RRSIG without `ad` alone does not confirm that the full chain is active.

## Publishing after a Pages settings commit

If GitHub's `CNAME` commit makes the usual subtree push non-fast-forward, publish exactly the reviewed `site/` tree with a commit that retains both the publishing branch and the site subtree histories:

```sh
git fetch origin gh-pages
task_site_commit=$(git subtree split --prefix=site)
task_site_tree=$(git rev-parse "$task_site_commit^{tree}")
git diff --stat origin/gh-pages "$task_site_commit"
task_publish_commit=$(git commit-tree "$task_site_tree" -p origin/gh-pages -p "$task_site_commit" -m 'Publish website with custom domain')
git push origin "$task_publish_commit":refs/heads/gh-pages
```

Use a normal push. If the remote moves again, fetch and review before rebuilding the publishing commit. Never force-push over another update. Check the Pages build and live files after deployment.

## Rollback

To prepare a rollback of source metadata, run `node scripts/set-site-url.mjs https://n0tl3ss.github.io`. Remove the custom domain in Pages settings too; changing a local file alone does not change the server redirect.

## References

- [GitHub custom domain and DNS records](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub account domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [GitHub HTTPS certificate provisioning](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Cloudflare full DNS setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)
- [Loopia DNSSEC](https://www.loopia.rs/dnssec/)
- [Google site moves](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
