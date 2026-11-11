# Public CV source

`content.json` is the editable content and layout for the public one- and two-page English CVs. It follows the Calibri layout of the published CVs at source commit `d6b5c27`. The second page continues the experience section without repeating the contact header. Keep private contact information out of this public source.

`render.py` uses ReportLab to produce searchable PDFs with embedded fonts and evidence hyperlinks. Dependencies: Python, ReportLab, and the four Calibri TTF files from Microsoft Word for macOS. Set `CV_FONT_DIR` if they live elsewhere.

```sh
python3 cv/render.py --output .preview/cv-update/final
```

Before publishing, inspect every rendered page, verify page counts, content and evidence links, then copy the approved PDFs to `site/assets/cv-one-page.pdf` and `site/assets/cv-two-pages.pdf`.

## Contribution wording added in October 2026

The review count excludes the author's own PRs and is intentionally rounded down to 200+. The contribution total includes maintenance/backport PRs and AI-assisted or AI-generated contributions. The candidate confirmed that the Python dataclass implementation in micronaut-core#13786 was fully AI-generated and Micronaut Data vector search (#3637) was AI-assisted; keep these disclosures beside their features in both CVs. CV wording and layout were prepared with AI assistance. Do not infer AI use for other work from its date or GitHub authorship. Release authorship describes the published releases, without asserting a formal maintainer title.

- [Reviewed public Micronaut PRs by other contributors](https://github.com/search?q=org%3Amicronaut-projects+is%3Apublic+reviewed-by%3An0tl3ss+-author%3An0tl3ss+is%3Apr+is%3Amerged&type=pullrequests)
- Releases: [SQL](https://github.com/micronaut-projects/micronaut-sql/releases/tag/v7.1.3), [Data](https://github.com/micronaut-projects/micronaut-data/releases/tag/v5.1.5), [Tracing](https://github.com/micronaut-projects/micronaut-tracing/releases/tag/v5.0.2), [Oracle Cloud](https://github.com/micronaut-projects/micronaut-oracle-cloud/releases/tag/v5.8.2)
- GraalVM Native Build Tools: [Maven/Docker builds](https://github.com/graalvm/native-build-tools/pull/589), [resource scanning](https://github.com/graalvm/native-build-tools/pull/590), [JUnit compatibility](https://github.com/graalvm/native-build-tools/pull/781)
- [OpenTelemetry reachability metadata and tests](https://github.com/oracle/graalvm-reachability-metadata/pull/215)
