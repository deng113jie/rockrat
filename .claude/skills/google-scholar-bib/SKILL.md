---
name: google-scholar-bib
description: >
  Retrieves a BibTeX citation entry from Google Scholar for a given paper title using Chrome DevTools.
  Use this skill whenever the user asks to get a BibTeX entry, citation, or bibliography item for a paper —
  especially when they provide a paper title and want the formatted BibTeX for use in LaTeX or a .bib file.
  Trigger on phrases like "get bib for", "fetch citation for", "find bibtex for", "add to refs.bib",
  "get the bibtex entry", or "look up citation on Google Scholar". Also trigger when the user pastes a
  paper title and wants a citation block, even if they don't say "Google Scholar" explicitly.
compatibility:
  tools:
    - mcp__chrome-devtools__navigate_page
    - mcp__chrome-devtools__evaluate_script
    - mcp__chrome-devtools__wait_for
    - mcp__chrome-devtools__take_snapshot
    - mcp__chrome-devtools__list_pages
    - mcp__chrome-devtools__select_page
---

# Google Scholar BibTeX Retrieval

Retrieve a BibTeX citation entry from Google Scholar for a given paper title.

## Steps

### 1. Navigate to Google Scholar search

Navigate to Google Scholar with the paper title as the query:

```
URL: https://scholar.google.com/scholar?hl=en&q={paper title, URL-encoded}
```

Use `navigate_page` with `type: "url"`. Then wait for the results page to load by calling `wait_for` with text `["Cite", "Scholar"]`.

### 2. Click "Cite" then "BibTeX" via JavaScript

Run the following script with `evaluate_script`. It clicks the first result's "Cite" button, then waits for the popup to appear and clicks "BibTeX":

```javascript
// Click the first "Cite" button on the page
const citeBtn = Array.from(document.querySelectorAll('a.gs_or_cit'))
    .find(el => el.querySelector('span')?.textContent.trim() === 'Cite');

if (!citeBtn) {
    return { found: false, step: 'cite_button' };
}
citeBtn.click();

// Watch for the BibTeX link to appear in the popup, then click it
const result = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ found: false, step: 'bibtex_link' }), 5000);
    const observer = new MutationObserver(() => {
        const bibtex = Array.from(document.querySelectorAll('a.gs_citi'))
            .find(el => el.textContent.trim() === 'BibTeX');
        if (bibtex) {
            clearTimeout(timeout);
            observer.disconnect();
            bibtex.click();
            resolve({ found: true });
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
});

return result;
```

**Check the return value:**
- If `{ found: false, step: 'cite_button' }` → the paper was not found in results. Report **"No item found"** and stop.
- If `{ found: false, step: 'bibtex_link' }` → the cite popup appeared but had no BibTeX link. Report **"No BibTeX link found"** and stop.
- If `{ found: true }` → clicking succeeded; proceed to step 3.

### 3. Read the BibTeX from the new page

Clicking "BibTeX" opens a new browser tab with raw BibTeX text. Wait briefly, then:

1. Call `list_pages` to find the newly opened tab.
2. Call `select_page` to switch to it.
3. Call `take_snapshot` (or `evaluate_script` with `() => document.body.innerText`) to read the page content.

The page content will be a raw BibTeX block, for example:
```
@article{smith2020example,
  title={Example Paper Title},
  author={Smith, John and Doe, Jane},
  journal={IEEE Transactions on Something},
  year={2020},
  publisher={IEEE}
}
```

### 4. Present the BibTeX to the user

Output the BibTeX entry in a fenced code block:

````
```bibtex
@article{...}
```
````

If the user is working with a `.bib` file, offer to append the entry.

## Error Handling

| Situation | Message to report |
|---|---|
| No results on the Scholar page | "No item found for: `{title}`" |
| Cite button not found in DOM | "No item found for: `{title}`" |
| BibTeX link not in popup | "No BibTeX link found — the citation popup may not support BibTeX" |
| New tab does not open or is empty | "BibTeX page did not load. Try again or check the link manually." |

After any error, continue with the rest of the user's task rather than stopping entirely.

## Notes

- Google Scholar sometimes shows a CAPTCHA or blocks automated access. If the page shows a CAPTCHA, inform the user and ask them to resolve it in the browser.
- The `evaluate_script` uses `async/await` for the `Promise`-based observer — this requires the script to be treated as an async function body. If the MCP tool doesn't support `await` at top level, wrap it in `(async () => { ... })()`.
- Always select the new BibTeX tab before reading its content; the devtools context stays on the original tab by default.
