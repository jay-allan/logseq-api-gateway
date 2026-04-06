# Logseq HTTP API Cookbook

This cookbook translates practical Logseq automation examples into patterns suitable for a local HTTP API skill.

It is intentionally focused on request-response usage, not plugin runtime features or UI integrations.

Use this together with:

- `references/LOGSEQ_CONCEPTS.md`
- `references/CONCEPT_TO_CORE_API.md`
- `references/QUERIES_AND_DATABASE.md`

## How to read this cookbook

The source examples are written like this:

```js
await logseq.Editor.getBlock(uuid)
```

For the HTTP API, translate them to:

```json
{
  "method": "logseq.Editor.getBlock",
  "args": ["<uuid>"]
}
```

General translation rule:

- JavaScript plugin call: `logseq.Namespace.method(arg1, arg2)`
- HTTP payload: `{ "method": "logseq.Namespace.method", "args": [arg1, arg2] }`

Important compatibility note:

- Some examples use `logseq.DB.q(...)`.
- Earlier references use `logseq.DB.datascriptQuery(...)`.
- Your original local API example used `logseq.db.q`.
- The skill should preserve the exact method names accepted by the local endpoint rather than assuming all naming variants are interchangeable.

## Read-first guidance

Because write operations are disabled by default, treat this cookbook in two layers:

- read-safe patterns you can use immediately
- write-capable patterns that should remain documented but inactive by default

## Reading content

### Get the current page

Plugin example:

```js
const page = await logseq.Editor.getCurrentPage()
```

HTTP translation:

```json
{
  "method": "logseq.Editor.getCurrentPage",
  "args": []
}
```

Use when the user asks about the currently open page or current journal context.

### Get all blocks on a page

Plugin example:

```js
const blocks = await logseq.Editor.getPageBlocksTree('Project Notes')
```

HTTP translation:

```json
{
  "method": "logseq.Editor.getPageBlocksTree",
  "args": ["Project Notes"]
}
```

Use when the user wants the page structure, nested outline, or all content on a page.

### Get a specific block

```json
{
  "method": "logseq.Editor.getBlock",
  "args": ["<block-uuid>"]
}
```

### Get a block with children

```json
{
  "method": "logseq.Editor.getBlock",
  "args": ["<block-uuid>", { "includeChildren": true }]
}
```

Use this when hierarchy matters, for example reviewing a task block together with its checklist or notes.

### Find backlinks for a page

Plugin example:

```js
const refs = await logseq.Editor.getPageLinkedReferences('Project A')
```

HTTP translation:

```json
{
  "method": "logseq.Editor.getPageLinkedReferences",
  "args": ["Project A"]
}
```

Use when the user asks which blocks or pages mention a page.

## Creating and editing content

These are write operations. Keep them documented, but disabled by default.

### Create a page

```json
{
  "method": "logseq.Editor.createPage",
  "args": ["Meeting Notes"]
}
```

With properties and options:

```json
{
  "method": "logseq.Editor.createPage",
  "args": [
    "Project Alpha",
    { "status": "active", "tags": "project, work", "owner": "Example Owner" },
    { "redirect": false }
  ]
}
```

### Insert one block

As child:

```json
{
  "method": "logseq.Editor.insertBlock",
  "args": ["<parent-uuid>", "- New task item", { "sibling": false }]
}
```

As sibling after target:

```json
{
  "method": "logseq.Editor.insertBlock",
  "args": ["<target-uuid>", "New sibling block", { "sibling": true, "before": false }]
}
```

Before target:

```json
{
  "method": "logseq.Editor.insertBlock",
  "args": ["<target-uuid>", "Insert above target", { "sibling": true, "before": true }]
}
```

### Insert multiple nested blocks

```json
{
  "method": "logseq.Editor.insertBatchBlock",
  "args": [
    "<parent-uuid>",
    [
      { "content": "TODO Review documentation", "properties": { "priority": "high" } },
      { "content": "TODO Update examples", "children": [
        { "content": "Add code samples" },
        { "content": "Test all examples" }
      ] },
      { "content": "DONE Setup project" }
    ],
    { "sibling": false }
  ]
}
```

### Update block content

Simple update:

```json
{
  "method": "logseq.Editor.updateBlock",
  "args": ["<uuid>", "Updated content"]
}
```

With properties:

```json
{
  "method": "logseq.Editor.updateBlock",
  "args": ["<uuid>", "Content text", { "properties": { "status": "completed", "reviewed": "true" } }]
}
```

### Move blocks

Move as child:

```json
{
  "method": "logseq.Editor.moveBlock",
  "args": ["<block-uuid>", "<target-uuid>", { "children": true }]
}
```

Move after target:

```json
{
  "method": "logseq.Editor.moveBlock",
  "args": ["<block-uuid>", "<target-uuid>", { "before": false }]
}
```

Move before target:

```json
{
  "method": "logseq.Editor.moveBlock",
  "args": ["<block-uuid>", "<target-uuid>", { "before": true }]
}
```

## Task patterns

Tasks are blocks with markers, so many task operations are query plus block retrieval/update patterns.

### Find TODO and DOING tasks

Plugin example:

```js
const todos = await logseq.DB.q(`
  [:find (pull ?b [*])
   :where
   [?b :block/marker ?marker]
   [(contains? #{"TODO" "DOING"} ?marker)]]
`)
```

HTTP translation using the same query idea:

```json
{
  "method": "logseq.DB.q",
  "args": ["[:find (pull ?b [*]) :where [?b :block/marker ?marker] [(contains? #{\"TODO\" \"DOING\"} ?marker)]]"]
}
```

If your endpoint expects the other naming style, the same query would instead be passed to `logseq.DB.datascriptQuery` or `logseq.db.q`.

### Get tasks on a specific page

Pattern:

- fetch page blocks with `logseq.Editor.getPageBlocksTree`
- filter blocks by `marker` field in the returned data

HTTP read step:

```json
{
  "method": "logseq.Editor.getPageBlocksTree",
  "args": ["<page-name>"]
}
```

### Find high-priority active tasks

```json
{
  "method": "logseq.DB.q",
  "args": ["[:find (pull ?b [*]) :where [?b :block/marker ?m] [(contains? #{\"TODO\" \"DOING\"} ?m)] [?b :block/properties ?props] [(get ?props :priority) ?p] [(= ?p \"high\")]]"]
}
```

### Mark a task as complete

This is a write pattern and should remain disabled by default.

Recommended workflow:

- fetch block with `logseq.Editor.getBlock`
- rewrite marker in content from `TODO` or `DOING` to `DONE`
- update block with `logseq.Editor.updateBlock`

## Query and search patterns

### Search block content for a keyword

```json
{
  "method": "logseq.DB.q",
  "args": ["[:find (pull ?b [*]) :where [?b :block/content ?content] [(clojure.string/includes? ?content \"keyword\")]]"]
}
```

### Find journal pages

```json
{
  "method": "logseq.DB.q",
  "args": ["[:find (pull ?p [*]) :where [?p :block/journal? true]]"]
}
```

Returned journals can then be sorted by `journalDay` client-side.

### Find blocks linking to a page

Plugin example passes both the query and an input value.

HTTP translation:

```json
{
  "method": "logseq.DB.q",
  "args": [
    "[:find (pull ?b [*]) :in $ ?page-name :where [?p :block/name ?page-name] [?b :block/refs ?p]]",
    "target-page"
  ]
}
```

This is an important pattern: extra plugin arguments become additional items in the HTTP `args` array.

### Find pages in a namespace

```json
{
  "method": "logseq.Editor.getPagesFromNamespace",
  "args": ["project"]
}
```

## Workflow patterns

These examples are valuable as workflow templates, but most contain writes and should stay disabled by default.

### Daily task list generation

Typical sequence:

- get or create the journal page
- fetch page blocks
- find an insertion anchor block
- insert a batch of task blocks

This is a useful future pattern for the skill once writes are enabled.

### Weekly review generation

Typical sequence:

- create a review page
- query completed tasks
- transform results into review sections
- insert blocks into the review page

This is a good cookbook example because it combines queries, data transformation, and batch insertion.

### Archive completed tasks

Typical sequence:

- query `DONE` blocks
- create or fetch an archive page
- move matching blocks to an archive location

This is powerful but highly write-sensitive and should require explicit permission.

### Auto-tagging pages

Typical sequence:

- query or list pages
- inspect block content per page
- update page metadata or content based on heuristics

This is especially risky because it performs broad write changes across many pages.

## What to exclude from the skill's main workflow

The source examples also include plugin-only or UI-only ideas that should not be central to this HTTP skill:

- slash commands
- block context menu commands
- command palette registration
- toolbar UI items
- `logseq.UI.showMsg`
- `logseq.useSettingsSchema`
- plugin lifecycle setup like `logseq.ready(...)`

These are useful for understanding the plugin ecosystem, but they are not direct patterns for a stateless HTTP caller.

## Error-handling guidance

Adapt the source advice into HTTP-safe rules:

- expect methods like `getBlock` or `getCurrentPage` to return `null`
- distinguish not-found results from transport failures
- do not assume page or block lookups always succeed
- inspect returned objects before chaining dependent calls

Recommended read workflow:

- fetch
- verify non-null
- only then query or inspect child fields

## Performance guidance

The source examples imply several good practices that also apply to HTTP usage:

- prefer batch operations over many small writes
- prefer targeted queries over fetching the entire graph
- use UUIDs for stable block targeting
- avoid repeated broad scans when a narrower query can answer the question

## Recommended cookbook uses in the eventual skill

Yes, this should serve as a cookbook for the skill.

Best use:

- keep the main `SKILL.md` focused on connection rules, safety rules, and decision-making
- keep this file as a practical pattern library the skill can consult when choosing an API call sequence

Most useful read-first recipes from this source:

- current page retrieval
- page block tree retrieval
- block retrieval with children
- linked-reference lookup
- task queries
- journal-page queries
- backlink queries
- namespace page listing

Most useful write recipes for later activation:

- create page
- insert block
- insert batch block
- update block
- move block
- generate daily or weekly structures

## Main cautions

- Some methods shown here were not in the earlier core API reference, so they should be treated as plausible until verified against your local HTTP endpoint.
- The examples mix `logseq.DB.q` with other DB naming styles; method-name compatibility still needs confirmation.
- Plugin UI APIs and registration APIs should not be treated as remote HTTP methods.
- Multi-step workflows often depend on intermediate object fields such as page UUIDs or first-block UUIDs; the skill should retrieve these explicitly rather than assuming them.
