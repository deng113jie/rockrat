---
name: ieee-search
description: Searches for academic papers on Springer, also as known as Springer nature. Use when the user wants to find papers by keyword or title on springer nature article database.
argument-hint: "[search keywords]"
---

# Springer Nature Basic Search

Search for academic papers on Springer Nature using Chrome DevTools MCP.

## Important: Determine the Springer Nature base URL

Before the first operation, check the current browser page URL to determine which Springer Nature domain the user is accessing. Store it as `BASE_URL`. Common patterns:
- Direct access: `https://link.springer.com/`
- Institutional proxy: URL containing `springer` in the hostname (e.g. WebVPN or EZProxy)

Use whatever origin the user's browser is currently on. If no Springer Nature page is open, ask the user which URL to use.

## Steps

### Step 1: Navigate to search results

Use `navigate_page` to go to:

```
{BASE_URL}/search?query={QUERY}
```

Where `{QUERY}` is the URL-encoded search keywords from `$ARGUMENTS`.


### Step 2: Extract search results

Use `evaluate_script` with built-in waiting. Do NOT use `wait_for` — it returns the full page snapshot which can exceed token limits.

```javascript
async () => {
  // Wait for results to load (up to 15s)
  for (let i = 0; i < 30; i++) {
    if (document.querySelectorAll('li .app-card-open__main').length > 0) break;
    await new Promise(r => setTimeout(r, 500));
  }

  const items = document.querySelectorAll('li .app-card-open__main');
  const papers = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Title + Link
    const titleLink = item.querySelector('.app-card-open__heading a');
    const title = titleLink?.textContent?.trim() || '';
    const link = titleLink?.href || '';

    // Authors (deduplicate because Springer repeats spans)
    const authorSpans = item.querySelectorAll('[data-test="authors"]');
    let authors = [];
    authorSpans.forEach(span => {
      const names = span.textContent.split(',').map(a => a.trim());
      authors.push(...names);
    });
    authors = [...new Set(authors)]; // remove duplicates

    // Journal / publication
    const journalEl = item.querySelector('a[data-test="parent"]');
    const journal = journalEl?.textContent?.trim() || '';

    // Publication date
    const dateEl = item.querySelector('[data-test="published"]');
    const date = dateEl?.textContent?.trim() || '';

    // Abstract snippet
    const abstract = item.querySelector('.app-card-open__description p')
      ?.textContent?.trim() || '';

    // Content type (Article, Chapter, etc.)
    const type = item.querySelector('.c-meta__type')
      ?.textContent?.trim() || '';

    papers.push({
      rank: i + 1,
      title,
      link,
      authors,
      journal,
      date,
      type,
      abstract: abstract.substring(0, 200)
    });
  }

  // Result count (Springer usually shows it differently)
  const resultCount = document.querySelector('h1, h2')?.textContent?.trim() || '';
  const noResults = items.length === 0;

  return { papers, resultCount, noResults };
}
```

### Step 4: Handle no results

If `noResults` is true:
1. Tell the user no results were found on Springer Nature.
2. Suggest broadening the search (use fewer keywords, remove quotes, try synonyms).


### Step 5: Present results

Format results as a numbered list:

```
{resultCount}

1. {title}
   Authors: {authors}
   Publication: {journal} | {date}
   Article #: {link}

2. ...
```

## Key CSS Selectors

| Element | Selector |
|---------|----------|
| Result items | `li .app-card-open__main` |
| Title link | `.app-card-open__heading a[href*="/article/"]` |
| Authors | `[data-test="authors"]` |
| Publication link | `a[data-test="parent"]` |
| Date | `[data-test="published"]` |
| Abstract snippet | `.app-card-open__description p` |
| Content Type| `.c-meta__type` |


## URL Parameters

| Param | Description | Example |
|-------|-------------|---------|
| `queryText` | Query string | `deep learning` |
| `page` | Page number (1-based) | `1`, `2`, `3` |
| `language` | Content Language (En only is fine) | `En` |
| `content-type` | Type of publication | `Article`, `Research`, `Review` |
| `dateFrom` | Date when the content was published, in year | `2022`, `2021`, `2023` |
| `dateTo` | Date to the content was published, in year, not used usually, default is up to date | `2026` |

## Search Strategy (Learned from Testing)

**Quoting matters**: Springer Nature treats unquoted words as individual tokens joined by OR. Always quote multi-word phrases.

| Query | Results | Quality |
|-------|---------|---------|
| `coupling capacitor power line carrier` | ~12,000+ | Terrible — each word matches independently |
| `"coupling capacitor" "power line carrier"` | 4 | Excellent — exact phrases, both required |
| `"coupling capacitor" OR "capacitor divider"` | Moderate | OK — OR between synonyms of same concept |
| `"coupling capacitor" OR "power line carrier"` | ~12,000+ | Bad — OR between different concepts |

**Rules**:
1. **Always quote multi-word phrases** with double quotes
2. **Use AND (implicit) between different concepts** — just put quoted phrases next to each other
3. **Use OR only between synonyms** of the same concept (e.g. `"drain coil" OR "line trap"`)
4. **Add a domain anchor** like `"HVDC"` or `"high voltage"` to prevent cross-domain noise
5. If results > 500, the query is too broad — add more AND terms
6. If results = 0, the query is too narrow — remove one quoted phrase or try synonyms, unless you are searching a particular paper with specific title, instead of searching keywords
7. For multi-topic searches, use `ieee-advanced-search` with `matchBoolean=true` for full boolean control

## Notes

- Results include article numbers (`link`) needed for detail extraction, PDF download, and citation export.
- This skill performs at most 2 tool calls: `navigate_page` + `evaluate_script`.
- Springer Nature uses Angular and loads content dynamically; the wait loop in `evaluate_script` handles this.
