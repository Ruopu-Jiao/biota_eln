export type ResourceKind =
  | "entry"
  | "entity"
  | "organization"
  | "protocol"
  | "repository"
  | "folder"
  | "table"
  | "attachment";

export type OrganizationRole = "owner" | "admin" | "member";
export type RepositoryRole = "maintainer" | "writer" | "reader";
export type MembershipStatus = "active" | "invited" | "disabled";
export type WorkspaceKind = "personal" | "organization";
export type RepositoryVisibility = "private" | "organization";
export type AuthProviderType = "credentials" | "oauth" | "email" | "webauthn";

export interface WorkspaceScope {
  organizationId: string;
  repositoryId?: string;
  folderId?: string;
}

export interface AuthIdentity {
  userId: string;
  email: string;
  name?: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  kind: WorkspaceKind;
}

export interface MembershipSummary {
  userId: string;
  organizationId: string;
  role: OrganizationRole | RepositoryRole;
  status: MembershipStatus;
}

export interface RegisterUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  workspaceName: string;
  terms: boolean;
}
