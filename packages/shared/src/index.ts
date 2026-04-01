export type ResourceKind =
  | "entry"
  | "entity"
  | "protocol"
  | "repository"
  | "folder"
  | "table"
  | "attachment";

export type OrganizationRole = "owner" | "admin" | "member";
export type RepositoryRole = "maintainer" | "writer" | "reader";

export interface WorkspaceScope {
  organizationId: string;
  repositoryId?: string;
  folderId?: string;
}
