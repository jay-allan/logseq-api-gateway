export interface LogseqBlock {
    uuid: string;
    content: string;
    properties: Record<string, unknown>;
    parent: { id: number } | null;
    page: { id: number };
    left: { id: number };
    format: 'markdown' | 'org';
    marker?: string;
    priority?: string;
    children?: LogseqBlock[];
}

export interface LogseqPage {
    id: number;
    uuid: string;
    name: string;
    originalName: string;
    properties: Record<string, unknown>;
    journal?: boolean;
    journalDay?: number;
    namespace?: { id: number };
    file?: { path: string };
    createdAt?: number;
    updatedAt?: number;
}

export interface LogseqTag {
    id: number;
    uuid: string;
    name: string;
    originalName: string;
}

export interface LogseqProperty {
    id: number;
    name: string;
    schema?: Record<string, unknown>;
}

export interface LogseqGraph {
    url: string;
    name: string;
    path: string;
}

export interface LogseqApiResponse<T = unknown> {
    result?: T;
    error?: string;
}
