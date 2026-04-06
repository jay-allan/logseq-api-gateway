# Logseq Core Concepts

This reference summarizes the Logseq concepts most relevant to an agent skill and API-driven workflows. It deliberately focuses on the graph model and content semantics rather than the user interface.

## Graph-first model

- A Logseq graph is a network of notes connected by references.
- The atomic unit is the block, not the page.
- Pages collect blocks, but meaning often lives at block level.
- Logseq combines two structures at once:
  - an outline hierarchy of parent and child blocks
  - a graph of links and references across pages and blocks

## Blocks

- Every bullet item is a block.
- Blocks can contain content, properties, and child blocks.
- Parent-child structure matters because many operations conceptually apply to a block together with its subtree.
- Blocks are addressable by UUID, which makes block references and stable API operations possible.

## Pages

- Pages are named containers for blocks.
- A page can be created explicitly or implicitly by referencing it.
- A page title is the human-facing identity of the page, but database identity, file representation, and display title are not always identical in practice.
- Journals are a special class of date-based pages.

## Journals

- Journal pages are date-named pages used for daily capture.
- Logseq encourages capturing notes first and organizing them later through links and queries.
- Journals are especially important for time-based tasks, reminders, and date-oriented queries.

## Links and references

### Page references

- `[[Page Name]]` creates or links to a page.
- `#tag` is also effectively a page reference, with a tagging-oriented notation.
- Multi-word hashtag-style references use `#[[Multi Word Page]]`.

### Block references

- `((block-uuid))` points to a specific block.
- Block references reuse the source block instead of copying its text.
- Because references are bidirectional, referenced content also accumulates backlinks and linked-reference context.

### Backlinks and linked references

- When a block references a page, the target page gains linked references automatically.
- Logseq also distinguishes unlinked references, which are plain text mentions without explicit page-link syntax.

## Embeds vs references

- A reference points to content.
- An embed transcludes content.
- Block references show a referenced block as a pointer-like reuse.
- Block embeds include the referenced block with its child context.
- Page embeds include an entire page.
- Editing embedded content edits the source content rather than a copy.

For an API integration, this means references and embeds should not be treated as duplicated text.

## Properties

- Properties use `key:: value` syntax.
- Page properties belong to the page-level metadata block.
- Block properties belong to an individual block.
- Property names are normalized to lowercase, and `_` is treated like `-`.
- Property values are not just plain strings; they can contain page references, tags, and structured semantics.
- Empty properties are not useful for querying.
- Property values cannot contain newlines.

### Important implications

- A property value may resolve to linked pages instead of remaining raw text.
- Quoting can suppress automatic reference parsing.
- Comma-separated parsing can affect how values are interpreted.
- Clients should normalize property keys before comparing them.

## Built-in and reserved properties

Some property names have built-in meaning and should be treated carefully:

- `title`
- `alias`
- `tags`
- `template`
- `public`
- `exclude-from-graph-view`
- internal or hidden fields such as `id` and collapse/timestamp-related properties

These are not safe as arbitrary free-form keys because they can change Logseq behavior.

## Aliases and tags

- Aliases let multiple names resolve to the same page.
- Tags are pages too; they participate in the same graph model rather than existing as a separate tagging system.
- This means a tag can often be queried or referenced like any other page.

## Tasks

- Tasks are ordinary blocks with workflow markers.
- Common markers include `TODO`, `DOING`, `DONE`, `WAIT`, `LATER`, `NOW`, `IN-PROGRESS`, and `CANCELLED`.
- Priorities are inline markers such as `[#A]`.
- `SCHEDULED:` and `DEADLINE:` add date semantics and are not limited to task blocks.
- Repeating tasks are encoded in scheduled-date syntax rather than as a separate task type.

For API work, a task is usually best understood as a block with task-related markers and properties, not as a separate entity class.

## Queries

- Logseq supports simple queries and advanced Datalog queries.
- Advanced queries operate on the internal database model and are the most expressive option.
- Query behavior is graph-aware rather than plain full-text search.
- In the database layer, page names are typically normalized to lowercase.

### Query design implications

- Property queries do not always behave like free-text matching.
- Date-oriented query helpers are often journal-centric.
- For precise automation, advanced queries are usually safer than relying on UI-oriented query shortcuts.

## Namespaces

- Namespaces group related pages conceptually.
- They are closer to logical naming/grouping than filesystem folders.
- The public docs for namespaces are sparse, so integrations should verify exact behavior before making assumptions.

## Markdown and Logseq syntax

Important syntax patterns include:

- Page reference: `[[Page]]`
- Block reference: `((uuid))`
- Labeled page link: `[label]([[Page]])`
- Labeled block link: `[label](((uuid)))`
- External link: `[label](https://example.com)`
- Property: `key:: value`

Logseq stores Markdown or Org-based content, but the graph semantics go beyond plain Markdown.

## Core principles for API integrations

- Prefer block-centric thinking over page-centric thinking.
- Treat UUIDs as stable identities for block-level operations.
- Preserve hierarchy; parent-child relationships carry meaning.
- Distinguish references, embeds, and copied text.
- Normalize property keys and be cautious with built-in properties.
- Expect page names in database/query contexts to be case-normalized.
- Model tasks as specialized blocks, not a separate resource type.
- Prefer read-only exploration until write semantics are clearly defined.

## Cautions and ambiguities

- Some docs, especially around namespaces and certain embed details, are incomplete.
- Embed syntax presentation is not entirely consistent across documentation.
- Display title, file name, and database identity may diverge.
- Parser behavior for property values can depend on quoting and configuration.
- Query semantics are richer and stricter than simple string matching.

When building automation against Logseq, verify uncertain edge cases against the actual API behavior before encoding assumptions into the skill.
