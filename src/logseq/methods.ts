/** Logseq API method names */
export const Methods = {
    // Pages
    GET_ALL_PAGES: 'logseq.Editor.getAllPages',
    GET_PAGE: 'logseq.Editor.getPage',
    GET_PAGE_BLOCKS_TREE: 'logseq.Editor.getPageBlocksTree',
    GET_PAGE_LINKED_REFERENCES: 'logseq.Editor.getPageLinkedReferences',
    CREATE_PAGE: 'logseq.Editor.createPage',
    RENAME_PAGE: 'logseq.Editor.renamePage',
    DELETE_PAGE: 'logseq.Editor.deletePage',

    // Blocks
    GET_BLOCK: 'logseq.Editor.getBlock',
    GET_BLOCK_PROPERTIES: 'logseq.Editor.getBlockProperties',
    GET_BLOCK_PROPERTY: 'logseq.Editor.getBlockProperty',
    INSERT_BLOCK: 'logseq.Editor.insertBlock',
    INSERT_BATCH_BLOCK: 'logseq.Editor.insertBatchBlock',
    APPEND_BLOCK_IN_PAGE: 'logseq.Editor.appendBlockInPage',
    PREPEND_BLOCK_IN_PAGE: 'logseq.Editor.prependBlockInPage',
    UPDATE_BLOCK: 'logseq.Editor.updateBlock',
    MOVE_BLOCK: 'logseq.Editor.moveBlock',
    REMOVE_BLOCK: 'logseq.Editor.removeBlock',
    UPSERT_BLOCK_PROPERTY: 'logseq.Editor.upsertBlockProperty',
    REMOVE_BLOCK_PROPERTY: 'logseq.Editor.removeBlockProperty',
    SET_BLOCK_ICON: 'logseq.Editor.setBlockIcon',
    REMOVE_BLOCK_ICON: 'logseq.Editor.removeBlockIcon',

    // Journals
    CREATE_JOURNAL_PAGE: 'logseq.Editor.createJournalPage',

    // Tags
    GET_TAG: 'logseq.Editor.getTag',
    GET_TAG_OBJECTS: 'logseq.Editor.getTagObjects',
    GET_ALL_TAGS: 'logseq.Editor.getAllTags',
    CREATE_TAG: 'logseq.Editor.createTag',
    ADD_BLOCK_TAG: 'logseq.Editor.addBlockTag',
    REMOVE_BLOCK_TAG: 'logseq.Editor.removeBlockTag',
    ADD_TAG_EXTENDS: 'logseq.Editor.addTagExtends',
    REMOVE_TAG_EXTENDS: 'logseq.Editor.removeTagExtends',

    // Properties
    GET_PROPERTY: 'logseq.Editor.getProperty',
    GET_ALL_PROPERTIES: 'logseq.Editor.getAllProperties',
    UPSERT_PROPERTY: 'logseq.Editor.upsertProperty',

    // Graph
    GET_CURRENT_GRAPH: 'logseq.App.getCurrentGraph',
    GET_GRAPHS: 'logseq.App.getGraphs',

    // Database / Query
    DATASCRIPT_QUERY: 'logseq.DB.datascriptQuery'
} as const;

/**
 * The set of methods that modify Logseq state.
 * All calls to these methods must go through `enqueueWrite()`.
 */
export const WRITE_METHODS = new Set<string>([
    Methods.CREATE_PAGE,
    Methods.RENAME_PAGE,
    Methods.DELETE_PAGE,
    Methods.INSERT_BLOCK,
    Methods.INSERT_BATCH_BLOCK,
    Methods.APPEND_BLOCK_IN_PAGE,
    Methods.PREPEND_BLOCK_IN_PAGE,
    Methods.UPDATE_BLOCK,
    Methods.MOVE_BLOCK,
    Methods.REMOVE_BLOCK,
    Methods.UPSERT_BLOCK_PROPERTY,
    Methods.REMOVE_BLOCK_PROPERTY,
    Methods.SET_BLOCK_ICON,
    Methods.REMOVE_BLOCK_ICON,
    Methods.CREATE_JOURNAL_PAGE,
    Methods.CREATE_TAG,
    Methods.ADD_BLOCK_TAG,
    Methods.REMOVE_BLOCK_TAG,
    Methods.ADD_TAG_EXTENDS,
    Methods.REMOVE_TAG_EXTENDS,
    Methods.UPSERT_PROPERTY
]);
