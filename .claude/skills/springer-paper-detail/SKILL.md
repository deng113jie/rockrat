---
name: springer-detail
description: Extracts full metadata from an Springer Nature article page (abstract, authors, keywords, DOI, references, PDF link). Use when the user wants details about a specific paper.
argument-hint: "[article number or URL]"
---

# Springer Nature Paper Detail Extraction

Extract complete metadata from an Springer Nature article page.

## Steps

### Step 1: Navigate to article

Determine the article URL from `$ARGUMENTS`:
- If an article number is given (e.g. `10.1186/s13638-025-02510-8`): URL is `https://link.springer.com/article/{ARNUMBER}/`, e.g. `https://link.springer.com/article/10.1186/s13638-025-02510-8`
- If a full URL is given: use that URL directly

Use `navigate_page` with `initScript`:

```
navigate_page({
  url: "{article_url}",
  initScript: "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
})
```

If the article is already open in the current tab, skip navigation and go directly to Step 3.

### Step 2: Check access

After navigation, verify:
- If the page shows a captcha or bot challenge: tell the user "请在浏览器中完成验证后告知我。"
- If the page URL no longer points to IEEE Xplore, the user may need to log in. Tell the user: "页面被重定向，请在浏览器中完成登录或认证后告知我。"

### Step 3: Extract metadata

Use `evaluate_script` with built-in waiting. Do NOT use `wait_for`.

```javascript
async () => {
  // Wait for article content to load (up to 15s)
  for (let i = 0; i < 30; i++) {
    if (document.querySelector('h1.c-article-title')) break;
    await new Promise(r => setTimeout(r, 500));
  }

  const result = {};

  // ----------------------
  // Title
  // ----------------------
  result.title = document.querySelector('h1.c-article-title')
    ?.textContent?.trim() || '';

  // ----------------------
  // Authors
  // ----------------------
  result.authors = [
    ...document.querySelectorAll('a[data-test="author-name"]')
  ]
    .map(a => a.childNodes[0]?.textContent.trim()) // avoid svg icon text
    .filter(Boolean);

  // ----------------------
  // Abstract
  // ----------------------
  result.abstract = document.querySelector('#Abs1-content p')
    ?.textContent?.trim() || '';

  // ----------------------
  // DOI
  // ----------------------
  const doiText = document.querySelector('.c-bibliographic-information__citation')
    ?.textContent || '';

  const doiMatch = doiText.match(/https?:\/\/doi\.org\/[^\s]+/);
  result.doi = doiMatch ? doiMatch[0] : '';

  // ----------------------
  // Publication (Journal)
  // ----------------------
  result.publication = document.querySelector('.app-article-masthead__journal-title')
    ?.textContent?.trim() || '';

  // ----------------------
  // Date
  // ----------------------
  result.date = document.querySelector('time[datetime]')
    ?.textContent?.trim() || '';

  // ----------------------
  // PDF Link
  // ----------------------
  const pdfEl = document.querySelector('a[data-test="pdf-link"]');
  result.pdfUrl = pdfEl ? new URL(pdfEl.getAttribute('href'), window.location.origin).href : '';

  // ----------------------
  // Conclusion
  // ----------------------
  const conclusionSection = document.querySelector('section[data-title="Conclusion"]');
  result.conclusion = conclusionSection
    ?.querySelector('.c-article-section__content')
    ?.textContent?.trim() || '';

  // ----------------------
  // (Optional) Sections / TOC
  // ----------------------
  result.sections = [
    ...document.querySelectorAll('.c-article-section__title')
  ]
    .map(el => el.textContent.trim())
    .filter(t => t && t.length < 100);

  return result;
};
```

### Step 4: Present metadata

Format the output clearly:

```
## {title}

**Authors**: {authors}
**Publication**: {publication}
**DOI**: {doi}
**Article #**: {ARGUMENTS}

### Date Info
{Date items, each on its own line}

### Abstract
{abstract}

### Article Structure
{sections}

**Cited by**: {citedBy} papers
**PDF**: {pdfUrl or "Not available"}
```

## Key CSS Selectors

| Element | Selector |
|---------|----------|
| Title | `h1.c-article-title` |
| Authors | `a[data-test="author-name"]` |
| Abstract | `#Abs1-content p` |
| DOI link | `a[href*="doi.org"]` |
| Publication | `.app-article-masthead__journal-title` |
| Meta items | `.c-article-identifiers__item` |
| PDF link | `a[data-test="pdf-link"]` |
| Section headings | `.c-article-section__title` |

## Notes

- PDF link format: `https://link.springer.com/content/pdf/{ARNUMBER}.pdf`, e.g. `https://link.springer.com/content/pdf/10.1186/s13638-025-02510-8.pdf`
- The `arnumber` is the universal identifier across springer nature database (like PII on ScienceDirect).
- Always include `initScript` on every `navigate_page` call.
- This skill uses 2 tool calls: `navigate_page` + `evaluate_script`.
