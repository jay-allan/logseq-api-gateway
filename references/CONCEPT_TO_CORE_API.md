# Logseq Concepts to Core API Mapping

This reference connects Logseq's core concepts to the low-level Core API methods exposed through the local HTTP API.

Use this together with `references/LOGSEQ_CONCEPTS.md`.

## HTTP payload model

The source material for these APIs is written for JavaScript plugins and typically shows calls like:

```js
await logseq.Editor.getBlock(uuid)
```

For the local HTTP API, convert that into this payload shape:

```json
{
  "method": "logseq.Editor.getBlock",
  "args": ["<uuid>"]
}
```

General translation rule:

- JavaScript call: `logseq.Namespace.method(arg1, arg2, arg3)`
- HTTP payload:
  ```json
  {
    "method": "logseq.Namespace.method",
    "args": [arg1, arg2, arg3]
  }
  ```

Example with options:

```js
await logseq.Editor.getBlock(uuid, { includeChildren: true })
```

becomes:

```json
{
  "method": "logseq.Editor.getBlock",
  "args": ["<uuid>", { "includeChildren": true }]
}
```

## Safety model

- Treat any method that creates, updates, deletes, renames, inserts, appends, prepends, removes, or upserts as a write operation.
- Read-only use should prefer methods that fetch, list, query, or inspect data.
- This reference includes both read and write counterparts, but write methods should remain disabled by default for the skill.

## Graph and database model

Logseq is block-centric and graph-oriented. The main low-level counterparts are:

- graph query access -> `logseq.DB.datascriptQuery`
- direct task or page queries -> often expressed as Datalog rather than dedicated task endpoints
- change observation -> `logseq.DB.onChanged` in plugin contexts

### Read examples

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["[:find ?b :where [?b :block/uuid ?u]]"]
}
```

Notes:

- `logseq.DB.onChanged` is event-driven plugin functionality, not a normal one-shot request pattern for the local HTTP API.
- For HTTP usage, favor explicit queries over subscription-style APIs unless you later confirm event support.

## Blocks

Blocks are the primary content unit. Core API counterparts:

- fetch a block -> `logseq.Editor.getBlock`
- fetch a block with subtree -> `logseq.Editor.getBlock` with options
- update a block -> `logseq.Editor.updateBlock` (write)
- insert near a block -> `logseq.Editor.insertBlock` (write)
- append/prepend in page -> `logseq.Editor.appendBlockInPage`, `logseq.Editor.prependBlockInPage` (write)
- insert nested structures -> `logseq.Editor.insertBatchBlock` (write)
- inspect block properties -> `logseq.Editor.getBlockProperties`, `logseq.Editor.getBlockProperty`

### Read examples

Get one block:

```json
{
  "method": "logseq.Editor.getBlock",
  "args": ["<block-uuid>"]
}
```

Get one block with children:

```json
{
  "method": "logseq.Editor.getBlock",
  "args": ["<block-uuid>", { "includeChildren": true }]
}
```

Get all properties on a block:

```json
{
  "method": "logseq.Editor.getBlockProperties",
  "args": ["<block-uuid>"]
}
```

Get one property from a block:

```json
{
  "method": "logseq.Editor.getBlockProperty",
  "args": ["<block-uuid>", "status"]
}
```

### Write counterparts

- `logseq.Editor.updateBlock`
- `logseq.Editor.insertBlock`
- `logseq.Editor.appendBlockInPage`
- `logseq.Editor.prependBlockInPage`
- `logseq.Editor.insertBatchBlock`
- `logseq.Editor.upsertBlockProperty`
- `logseq.Editor.removeBlockProperty`
- `logseq.Editor.setBlockIcon`
- `logseq.Editor.removeBlockIcon`

## Pages

Pages are named containers for blocks. Core API counterparts:

- create a page -> `logseq.Editor.createPage` (write)
- create a journal page -> `logseq.Editor.createJournalPage` (write)
- list pages -> `logseq.Editor.getAllPages`
- rename a page -> `logseq.Editor.renamePage` (write)
- delete a page -> `logseq.Editor.deletePage` (write)

### Read example

```json
{
  "method": "logseq.Editor.getAllPages",
  "args": []
}
```

### Write counterpart example

JavaScript:

```js
await logseq.Editor.createPage('Item Name', {
  tags: ['zot'],
  title: 'My Title'
})
```

HTTP payload:

```json
{
  "method": "logseq.Editor.createPage",
  "args": ["Item Name", { "tags": ["zot"], "title": "My Title" }]
}
```

Important note:

- In the provided core API reference, page properties for `createPage` are passed at the top level of the second argument object, not inside a nested `properties` object.

## Journals and date pages

Journal pages are date-based pages. Core API counterpart:

- create a journal page -> `logseq.Editor.createJournalPage` (write)

For read access to journal content, use normal page listing, page lookup methods if available later, or Datalog queries.

## Properties

Properties are key-value metadata attached to pages or blocks. Core API counterparts:

- define or update property schema -> `logseq.Editor.upsertProperty` (write)
- fetch property schema object -> `logseq.Editor.getProperty`
- list all properties -> `logseq.Editor.getAllProperties`
- write block property value -> `logseq.Editor.upsertBlockProperty` (write)
- fetch block property value -> `logseq.Editor.getBlockProperty`
- fetch all block properties -> `logseq.Editor.getBlockProperties`
- remove block property -> `logseq.Editor.removeBlockProperty` (write)

### Read examples

Get one property definition:

```json
{
  "method": "logseq.Editor.getProperty",
  "args": ["propertyName"]
}
```

Get all property definitions:

```json
{
  "method": "logseq.Editor.getAllProperties",
  "args": []
}
```

### Write counterpart example

```json
{
  "method": "logseq.Editor.upsertProperty",
  "args": ["year", { "type": "number" }]
}
```

API usage cautions:

- Normalize property names to lowercase and prefer `-` over `_` when comparing or generating keys.
- Avoid casually writing reserved properties such as `title`, `alias`, and `tags`.

## Tags, classes, and page-like categorization

The provided core API reference treats tags as first-class entities managed through editor methods. This lines up with the Logseq concept that tags behave much like pages in the graph.

Core API counterparts:

- create a tag/class page -> `logseq.Editor.createTag` (write)
- get a tag -> `logseq.Editor.getTag`
- list all tags -> `logseq.Editor.getAllTags`
- get objects carrying a tag -> `logseq.Editor.getTagObjects`
- add a tag to a block -> `logseq.Editor.addBlockTag` (write)
- remove a tag from a block -> `logseq.Editor.removeBlockTag` (write)

### Read examples

Get one tag:

```json
{
  "method": "logseq.Editor.getTag",
  "args": ["zot"]
}
```

Get all tagged objects:

```json
{
  "method": "logseq.Editor.getTagObjects",
  "args": ["zot"]
}
```

List all tags:

```json
{
  "method": "logseq.Editor.getAllTags",
  "args": []
}
```

### Write counterpart example

```json
{
  "method": "logseq.Editor.addBlockTag",
  "args": ["<block-uuid>", "zot"]
}
```

## Tag inheritance and taxonomy

The provided API reference includes tag inheritance methods. These are relevant when modeling parent-child category relationships.

Core API counterparts:

- add inheritance -> `logseq.Editor.addTagExtends` (write)
- remove inheritance -> `logseq.Editor.removeTagExtends` (write)

These are write operations and should not be used by default.

## Links, references, and embeds

The supplied core API reference does not expose dedicated "create page reference" or "create block reference" methods. In practice, links, references, and embeds are usually expressed in block content syntax.

That means the concept-to-API mapping is indirect:

- page reference -> represented in content as `[[Page]]`
- block reference -> represented in content as `((uuid))`
- embeds -> represented in Logseq markup/macros within block content

Programmatic interaction usually happens through:

- reading block content with `logseq.Editor.getBlock`
- querying structured relationships with `logseq.DB.datascriptQuery`
- editing content with block update methods only when writes are explicitly allowed

## Tasks

Tasks are blocks with task markers rather than a separate resource class. There is no dedicated task API in the provided reference.

Core API counterpart:

- use `logseq.DB.datascriptQuery` to query task blocks
- use `logseq.Editor.getBlock` to inspect specific task blocks
- task mutation would happen through block update or property update methods (write)

Example task-oriented query payload:

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["(task TODO)"]
}
```

Note:

- The earlier `curl` example you provided uses `logseq.db.q`. The core API reference here uses `logseq.DB.datascriptQuery`. Treat naming carefully and verify which method names are accepted by your local HTTP bridge.
- Until verified, preserve the exact method names the HTTP API expects rather than assuming JavaScript namespace casing will always work.

## Queries and graph inspection

Queries are the main counterpart for graph-wide inspection.

Core API counterparts:

- Datalog query -> `logseq.DB.datascriptQuery`
- class/tag object retrieval -> `logseq.API['get-class-objects']`

### Read examples

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["[:find ?p :where [?p :block/name]]"]
}
```

```json
{
  "method": "logseq.API.get-class-objects",
  "args": ["tagName"]
}
```

Method naming caution:

- The JavaScript notation `logseq.API['get-class-objects']('tagName')` should be translated for HTTP as a method string plus args array.
- A reasonable method string is `logseq.API.get-class-objects`, but this should be verified against the actual HTTP API implementation because bracket-notation JavaScript examples do not always imply an identical string path remotely.

## Icons and presentation metadata

The provided reference includes icon management for blocks:

- set icon -> `logseq.Editor.setBlockIcon` (write)
- remove icon -> `logseq.Editor.removeBlockIcon` (write)

These affect presentation metadata on blocks and should be considered write operations.

## Methods that are plugin-specific rather than good HTTP targets

The source reference includes some methods that are primarily plugin-runtime concepts:

- `logseq.DB.onChanged`
- `logseq.useSettingsSchema`
- `logseq.UI.showMsg`
- `logseq.UI.close`
- `window.parent.logseq.api.add_tag_property`
- `window.parent.logseq.api.remove_tag_property`

These should not be assumed to map cleanly to the local HTTP API.

For the skill, prefer methods that clearly match request-response behavior over HTTP:

- `logseq.Editor.*`
- `logseq.DB.datascriptQuery`
- any additional explicitly confirmed remote methods you provide later

## Recommended read-only method families for the skill

Until write access is explicitly enabled, prefer these method families:

- `logseq.Editor.getBlock`
- `logseq.Editor.getBlockProperties`
- `logseq.Editor.getBlockProperty`
- `logseq.Editor.getAllPages`
- `logseq.Editor.getProperty`
- `logseq.Editor.getAllProperties`
- `logseq.Editor.getTag`
- `logseq.Editor.getTagObjects`
- `logseq.Editor.getAllTags`
- `logseq.DB.datascriptQuery`

## Cross-reference to concepts

- Graph-first model -> `logseq.DB.datascriptQuery`
- Blocks -> `logseq.Editor.getBlock`, `logseq.Editor.getBlockProperties`
- Pages -> `logseq.Editor.getAllPages`
- Journals -> `logseq.Editor.createJournalPage` for writes; queries for reads
- Properties -> `logseq.Editor.getProperty`, `logseq.Editor.getAllProperties`, `logseq.Editor.getBlockProperty`
- Tags and aliases -> `logseq.Editor.getTag`, `logseq.Editor.getTagObjects`, `logseq.Editor.getAllTags`
- Tasks -> query blocks rather than expect a separate task endpoint
- References and embeds -> inspect or modify block content, or query graph relationships

When in doubt, model Logseq as a graph of blocks and pages whose meaning is often discovered through queries rather than through narrowly specialized endpoints.
