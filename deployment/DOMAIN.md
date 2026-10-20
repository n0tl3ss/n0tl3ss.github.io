# nmikic.rs on Loopia

The primary domain will be **https://nmikic.rs/**, with `www` redirected to the apex. Until registration, DNS and HTTPS are ready, **https://n0tl3ss.github.io/** stays live and canonical. Do not activate `site/CNAME` early: GitHub's redirect would send existing visitors to the unfinished domain.

## DNS records to prepare in Loopia

Open the domain in Loopia Customer Zone and select the DNS editor. `@` is the domain itself; `www` is a subdomain. Replace conflicting parking/web records for those names and keep unrelated mail/TXT records.

| Name | Type | Value |
| --- | --- | --- |
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `www` | CNAME | `n0tl3ss.github.io` |

Optional IPv6 records for `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`. Remove incompatible old AAAA records if any exist. No wildcard records are needed.

The Outlook contact address does not require mail hosting or MX records on `nmikic.rs`.

## Activation order

1. Wait for Loopia registration/delegation to complete. Check the authoritative DNS, not only a cached local answer.
2. Verify `nmikic.rs` under the GitHub **account** Settings → Pages. GitHub supplies a TXT challenge, normally under `_github-pages-challenge-n0tl3ss`. Add that exact name/value in Loopia and retain it. The token is account-specific; it is not invented or stored in this repository.
3. During cutover, configure `nmikic.rs` as the repository's Pages custom domain, then save the prepared DNS records. Follow GitHub's order so the domain is attached to the owner before its records point at Pages. This can briefly redirect the old URL while DNS propagates; perform these steps together. GitHub will create a `CNAME` commit on `gh-pages`.
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

6. GitHub's settings may have added a `CNAME` commit directly to `gh-pages`. Fetch it before deploying. Create the new site subtree commit, then merge its tree into that fetched publishing branch in a temporary checkout, preserving its history and `CNAME`. Push normally; do not discard the settings commit or force an unrelated branch over it. Later publish from the same source while preserving any Pages-created branch commits.
7. Add/verify the old URL-prefix property and the new domain property in Google Search Console, submit `https://nmikic.rs/sitemap.xml`, inspect/request indexing of the homepage, and use Change of Address after redirects work. Keep the old GitHub URL redirecting.
8. Update professional profile website links to the final URL. When enabling the contact form, register the exact `nmikic.rs` hostname in Google reCAPTCHA and use it in the backend's `ALLOWED_HOSTNAME`/`SITE_URL` settings.

To prepare a rollback of source metadata, run `node scripts/set-site-url.mjs https://n0tl3ss.github.io`. Remove the custom domain in Pages settings too; changing a local file alone does not change the server redirect.

## References

- [GitHub custom domain and DNS records](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain)
- [Loopia A/CNAME DNS editor](https://support.loopia.se/wiki/dnseditorn-a-och-cname/)
- [Loopia TXT verification records](https://support.loopia.se/wiki/verifiera-doman-via-dns/)
- [Google site moves](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
