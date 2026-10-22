# Public CV source

`content.json` is the editable content and layout for the public one- and two-page English CVs. It follows the Calibri layout of the published CVs at source commit `d6b5c27`. The second page continues the experience section without repeating the contact header. Keep private contact information out of this public source.

`render.py` uses ReportLab to produce searchable PDFs with embedded fonts and evidence hyperlinks. It also writes `layout.json`, which the PowerPoint builder uses to keep both formats aligned. Dependencies: Python, ReportLab, and the four Calibri TTF files from Microsoft Word for macOS. Change `font_dir` if building elsewhere.

```sh
python3 cv/render.py --output .preview/cv-update/final
```

`build-pptx.mjs` uses the bundled Codex Artifact Tool to generate native editable text, native bullet paragraphs, hyperlinks, and section rules. It preserves the same page dimensions and uses the PDF layout. Set `PRESENTATIONS_SKILL_DIR`, `RUNTIME_NODE_MODULES`, and `CV_PYTHON` to the installed presentation skill, bundled Node modules directory, and Python executable. Make the Node packages available through an ignored `node_modules` symlink. Python also needs `lxml` for the serializer's native bullet repair.

```sh
node cv/build-pptx.mjs
```

Drafts and page previews stay in `.preview/cv-update/final`. Optional settings:

- `CV_FONT_DIR`: folder containing `Calibri.ttf`, `Calibrib.ttf`, `Calibrii.ttf`, and `Calibriz.ttf`.
- `CV_BUILD_DIR`: the PDF/layout output directory.
- `CV_OUTPUT_DIR`: a new final output directory inside the task workspace. When set, the presentation skill finalizer validates both PowerPoints before delivery. Final filenames must not already exist.

Before publishing, inspect every rendered page, verify page counts, content and evidence links, then copy the approved PDFs to `site/assets/cv-one-page.pdf` and `site/assets/cv-two-pages.pdf`. Keep the prior published PDFs in place until PowerPoint finalization finishes because they provide the reference font policy.

## Contribution wording added in October 2026

The review count excludes the author's own PRs and is intentionally rounded down to 200+. The authored total includes maintenance/backport PRs. Release authorship describes the published releases, without asserting a formal maintainer title.

- [Reviewed public Micronaut PRs by other contributors](https://github.com/search?q=org%3Amicronaut-projects+is%3Apublic+reviewed-by%3An0tl3ss+-author%3An0tl3ss+is%3Apr+is%3Amerged&type=pullrequests)
- Releases: [SQL](https://github.com/micronaut-projects/micronaut-sql/releases/tag/v7.1.3), [Data](https://github.com/micronaut-projects/micronaut-data/releases/tag/v5.1.5), [Tracing](https://github.com/micronaut-projects/micronaut-tracing/releases/tag/v5.0.2), [Oracle Cloud](https://github.com/micronaut-projects/micronaut-oracle-cloud/releases/tag/v5.8.2)
- GraalVM Native Build Tools: [Maven/Docker builds](https://github.com/graalvm/native-build-tools/pull/589), [resource scanning](https://github.com/graalvm/native-build-tools/pull/590), [JUnit compatibility](https://github.com/graalvm/native-build-tools/pull/781)
- [OpenTelemetry reachability metadata and tests](https://github.com/oracle/graalvm-reachability-metadata/pull/215)
