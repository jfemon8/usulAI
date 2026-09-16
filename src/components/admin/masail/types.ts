import type { AnswerSource } from "@/types";

export interface MasalaAuthorView {
  id: string;
  name: string;
  category: string;
}

export interface WorkspaceMasala {
  id: string;
  question: string;
  excerpt: string;
  category: string | null;
  author: MasalaAuthorView | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  sourceCount: number;
  servedCount: number;
  canEdit: boolean;
  path: string | null;
}

export interface WorkspaceMasalaDetail extends WorkspaceMasala {
  answer: string;
  sources: AnswerSource[];
  reviewerNote: string;
}

export interface WorkspacePage {
  items: WorkspaceMasala[];
  total: number | null;
  nextCursor: string | null;
}

export interface AuthorCount extends MasalaAuthorView {
  count: number;
}
