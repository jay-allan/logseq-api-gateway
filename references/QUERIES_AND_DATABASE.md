# Logseq Queries and Database Reference

This reference summarizes the Logseq query model most relevant to a local HTTP integration. The source material is written for JavaScript plugin development, so the examples here are translated into the HTTP `method` plus `args` request shape.

Use this together with:

- `references/LOGSEQ_CONCEPTS.md`
- `references/CONCEPT_TO_CORE_API.md`

## Core idea

Logseq's most powerful read interface is its database query layer. Instead of relying only on page or block retrieval methods, you often query the graph directly with Datalog.

This is especially useful for:

- finding blocks by tag
- filtering by properties
- traversing relationships such as tag inheritance
- returning only specific fields instead of whole entities

## HTTP translation model

The source material shows plugin calls like:

```js
const results = await logseq.DB.datascriptQuery(query)
```

For the local HTTP API, convert that to:

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find ?b :where [?b :block/name]]}"]
}
```

General rule:

- plugin call: `logseq.DB.datascriptQuery(queryString)`
- HTTP payload:
  ```json
  {
    "method": "logseq.DB.datascriptQuery",
    "args": [queryString]
  }
  ```

Important compatibility note:

- Your earlier example used `logseq.db.q`.
- The plugin-oriented reference uses `logseq.DB.datascriptQuery`.
- Treat these as possibly different accepted method names until your local HTTP bridge is fully verified.
- The skill should preserve whichever method name the endpoint actually accepts.

## Query shape

The reference uses query strings like:

```clojure
{:query [:find (pull ?b [*])
         :where
         [?b :block/tags ?t]
         [?t :block/title "zot"]]}
```

Key parts:

- `:find` decides what is returned
- `:where` defines the matching conditions
- `(pull ?b [*])` returns a full entity map for a matched entity
- raw variables such as `?key` can return only a specific value

## Result shape

Query results are typically tuples, even when each row has only one item.

For example:

- whole-entity query result shape: `[[entity1], [entity2], ...]`
- scalar query result shape: `[[value1], [value2], ...]`

This matters because a client often needs to flatten or unwrap the result.

## Common query patterns

### Find all blocks tagged with a tag

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find (pull ?b [*]) :where [?b :block/tags ?t] [?t :block/title \"zot\"]]}"]
}
```

This returns entities for blocks tagged with `#zot`.

### Find blocks by property value

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find (pull ?b [*]) :where [?b :block/tags ?t] [?t :block/title \"zot\"] [?b :logseq.property/itemType \"journalArticle\"]]}"]
}
```

This pattern combines tag filtering with a property constraint.

### Find blocks by text contained in a property

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find (pull ?b [*]) :where [?b :block/tags ?t] [?t :block/title \"zot\"] [?b :logseq.property/author1 ?author] [(clojure.string/includes? ?author \"Example Author\")]]}"]
}
```

This is useful when a property is stored as text and exact equality is not enough.

### Find values inside a multi-value property

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find (pull ?b [*]) :where [?b :block/tags ?t] [?t :block/title \"zot\"] [?b :logseq.property/collections ?coll] [(contains? ?coll \"Reading List\")]]}"]
}
```

### Return a specific property only

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find ?key :where [?b :block/tags ?t] [?t :block/title \"zot\"] [?b :logseq.property/zoteroKey ?key]]}"]
}
```

This avoids pulling entire block objects when only one value is needed.

## Tag inheritance and `or-join`

One of the most important advanced patterns is tag inheritance.

Problem:

- a block may be tagged with a child tag such as `#shopping`
- that child tag may extend a parent tag such as `#task`
- a naive query for `#task` only finds direct `#task` assignments

The reference solution is to use `or-join`.

### Why `or-join` matters

Plain `or` fails when each branch introduces different free variables.

`or-join` fixes this by explicitly stating which variables must be shared across branches.

### Example

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find (pull ?b [*]) :where (or-join [?b] (and [?b :block/tags ?t] [?t :block/title \"task\"]) (and [?b :block/tags ?child] [?child :logseq.property.class/extends ?parent] [?parent :block/title \"task\"]))]}"]
}
```

This finds:

- blocks directly tagged with `#task`
- blocks tagged with any tag that extends `#task`

### Combined filter example

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find (pull ?b [*]) :where (or-join [?b] (and [?b :block/tags ?t] [?t :block/title \"task\"]) (and [?b :block/tags ?child] [?child :logseq.property.class/extends ?parent] [?parent :block/title \"task\")) [?b :logseq.property/status ?s] [?s :block/title \"Todo\"] [?b :logseq.property/priority ?p]]}"]
}
```

This demonstrates a graph-aware task query rather than relying on a special task endpoint.

## `:block/title` vs `:block/name`

Tags and pages can expose both display-oriented and normalized names.

- `:block/title` -> display-preserving name, often matching what users see
- `:block/name` -> normalized lowercase name for internal matching

Guidance:

- prefer `:block/title` when mirroring user-facing names from docs or examples
- prefer `:block/name` when you have normalized input or want case-insensitive matching

Example with normalized matching:

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find (pull ?t [*]) :where [?t :block/name \"task\"]]}"]
}
```

## Query context differences

The reference notes that similar Datalog ideas appear in several contexts:

- plugin code
- Logseq app query blocks
- CLI usage

For this skill, only the local HTTP pattern matters. Convert everything into:

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["<query string>"]
}
```

Do not copy CLI or plugin wrappers literally into the HTTP request.

## `get-class-objects` as a simpler alternative

For simple tag-based retrieval, the source reference offers `get-class-objects` as an easier alternative to full Datalog.

Plugin form:

```js
const items = await logseq.API['get-class-objects']('zot')
```

Likely HTTP translation:

```json
{
  "method": "logseq.API.get-class-objects",
  "args": ["zot"]
}
```

Use this when:

- retrieval is primarily tag-based
- no extra property filtering is needed
- subclass or inherited-tag inclusion is desired and supported

Use Datalog instead when:

- multiple conditions must be combined
- property filters are needed
- relationship traversal is needed
- only certain fields should be returned

Method naming caution:

- Because the JavaScript example uses bracket notation, the exact HTTP method string must be verified against the local API.
- Until verified, treat `logseq.API.get-class-objects` as a best-effort translation rather than a guaranteed accepted remote method name.

## Database attribute patterns

The reference repeatedly uses attribute names such as:

- `:block/tags`
- `:block/title`
- `:block/name`
- `:logseq.property/itemType`
- `:logseq.property/author1`
- `:logseq.property/collections`
- `:logseq.property/zoteroKey`
- `:logseq.property.class/extends`

This suggests several practical rules for API work:

- properties may appear in the database under namespaced attribute keys
- querying often requires database attribute names, not surface Markdown syntax
- tags and properties are often represented as graph relationships, not just plain strings

## Query design guidance for the skill

- Prefer read-only query methods by default.
- Use Datalog for anything beyond trivial retrieval.
- Expect tuple-shaped results and unwrap them deliberately.
- Use `(pull ?b [*])` when full entity context is needed.
- Return scalars directly when only one property or identifier is needed.
- Prefer `or-join` over plain `or` when traversing inherited tag relationships.
- Be careful about title-vs-name matching.
- Treat plugin examples as patterns to translate, not as HTTP requests to copy verbatim.

## Read-only examples for the skill

Find all blocks for a tag:

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find (pull ?b [*]) :where [?b :block/tags ?t] [?t :block/title \"zot\"]]}"]
}
```

Find only one property value across matching blocks:

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find ?key :where [?b :block/tags ?t] [?t :block/title \"zot\"] [?b :logseq.property/zoteroKey ?key]]}"]
}
```

Find all direct and inherited task-tagged blocks:

```json
{
  "method": "logseq.DB.datascriptQuery",
  "args": ["{:query [:find (pull ?b [*]) :where (or-join [?b] (and [?b :block/tags ?t] [?t :block/title \"task\"]) (and [?b :block/tags ?child] [?child :logseq.property.class/extends ?parent] [?parent :block/title \"task\"]))]}"]
}
```

## Main cautions

- Query strings must be escaped correctly when embedded in JSON.
- Results are usually tuples, not plain flat arrays of entities.
- Property storage in the database can differ from user-facing property syntax.
- The local HTTP API may accept method names that differ from plugin method names.
- Tag and page matching can depend on whether you use `:block/title` or `:block/name`.

When the skill needs rich read access, prefer carefully constructed `datascriptQuery` requests over ad hoc assumptions about pages, tags, or tasks.
