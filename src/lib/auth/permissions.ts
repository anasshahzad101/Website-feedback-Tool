import { UserRole, ProjectRole, CommentStatus } from "@prisma/client";

// Role hierarchy for comparison
const roleHierarchy: Record<UserRole, number> = {
  [UserRole.OWNER]: 100,
  [UserRole.ADMIN]: 80,
  [UserRole.PROJECT_MANAGER]: 60,
  [UserRole.REVIEWER]: 40,
};

const projectRoleHierarchy: Record<ProjectRole, number> = {
  [ProjectRole.MANAGER]: 60,
  [ProjectRole.REVIEWER]: 40,
  [ProjectRole.CLIENT]: 20,
};

export class Permissions {
  // Check if user has required role or higher
  static hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  // Check if user has required project role or higher
  static hasProjectRole(
    userProjectRole: ProjectRole | null,
    requiredRole: ProjectRole
  ): boolean {
    if (!userProjectRole) return false;
    return projectRoleHierarchy[userProjectRole] >= projectRoleHierarchy[requiredRole];
  }

  // System-level permissions
  static canManageUsers(userRole: UserRole): boolean {
    return this.hasRole(userRole, UserRole.ADMIN);
  }

  static canManageClients(userRole: UserRole): boolean {
    return this.hasRole(userRole, UserRole.PROJECT_MANAGER);
  }

  static canDeleteProjects(userRole: UserRole): boolean {
    return this.hasRole(userRole, UserRole.ADMIN);
  }

  static canAccessAdminPanel(userRole: UserRole): boolean {
    return this.hasRole(userRole, UserRole.ADMIN);
  }

  // Project-level permissions
  static canCreateProject(userRole: UserRole): boolean {
    return this.hasRole(userRole, UserRole.PROJECT_MANAGER);
  }

  static canEditProject(
    userRole: UserRole,
    projectRole: ProjectRole | null,
    isProjectCreator: boolean
  ): boolean {
    // Admins and owners can edit any project
    if (this.hasRole(userRole, UserRole.ADMIN)) return true;
    // Project managers can edit projects they manage
    if (this.hasRole(userRole, UserRole.PROJECT_MANAGER) && isProjectCreator) return true;
    // Project-level managers can edit
    if (projectRole === ProjectRole.MANAGER) return true;
    return false;
  }

  static canManageProjectMembers(
    userRole: UserRole,
    projectRole: ProjectRole | null
  ): boolean {
    if (this.hasRole(userRole, UserRole.ADMIN)) return true;
    if (projectRole === ProjectRole.MANAGER) return true;
    return false;
  }

  static canArchiveProject(
    userRole: UserRole,
    projectRole: ProjectRole | null
  ): boolean {
    if (this.hasRole(userRole, UserRole.ADMIN)) return true;
    if (this.hasRole(userRole, UserRole.PROJECT_MANAGER)) return true;
    if (projectRole === ProjectRole.MANAGER) return true;
    return false;
  }

  // Review item permissions
  static canCreateReviewItem(
    userRole: UserRole,
    projectRole: ProjectRole | null
  ): boolean {
    if (this.hasRole(userRole, UserRole.REVIEWER)) return true;
    if (projectRole && projectRoleHierarchy[projectRole] >= projectRoleHierarchy[ProjectRole.REVIEWER]) {
      return true;
    }
    return false;
  }

  static canEditReviewItem(
    userRole: UserRole,
    projectRole: ProjectRole | null,
    isCreator: boolean
  ): boolean {
    if (this.hasRole(userRole, UserRole.ADMIN)) return true;
    if (projectRole === ProjectRole.MANAGER) return true;
    if (isCreator && this.hasRole(userRole, UserRole.REVIEWER)) return true;
    return false;
  }

  static canDeleteReviewItem(
    userRole: UserRole,
    projectRole: ProjectRole | null
  ): boolean {
    if (this.hasRole(userRole, UserRole.ADMIN)) return true;
    if (projectRole === ProjectRole.MANAGER) return true;
    return false;
  }

  static canManageRevisions(
    userRole: UserRole,
    projectRole: ProjectRole | null
  ): boolean {
    if (this.hasRole(userRole, UserRole.REVIEWER)) return true;
    if (projectRole && projectRoleHierarchy[projectRole] >= projectRoleHierarchy[ProjectRole.REVIEWER]) {
      return true;
    }
    return false;
  }

  // Comment permissions
  static canCreateComment(
    userRole: UserRole | null,
    projectRole: ProjectRole | null,
    guestCommentingEnabled: boolean,
    isGuest: boolean
  ): boolean {
    // Guests can comment if guest commenting is enabled
    if (isGuest) return guestCommentingEnabled;
    // Internal users with any role can comment
    if (userRole) return true;
    // Clients can comment if they have project access
    if (projectRole) return true;
    return false;
  }

  static canEditComment(
    userRole: UserRole,
    isCommentAuthor: boolean,
    projectRole: ProjectRole | null
  ): boolean {
    if (this.hasRole(userRole, UserRole.ADMIN)) return true;
    if (isCommentAuthor) return true;
    if (projectRole === ProjectRole.MANAGER) return true;
    return false;
  }

  static canDeleteComment(
    userRole: UserRole,
    isCommentAuthor: boolean,
    projectRole: ProjectRole | null
  ): boolean {
    if (this.hasRole(userRole, UserRole.ADMIN)) return true;
    if (isCommentAuthor) return true;
    if (projectRole === ProjectRole.MANAGER) return true;
    return false;
  }

  static canChangeThreadStatus(
    userRole: UserRole,
    projectRole: ProjectRole | null,
    isThreadAuthor: boolean,
    allowClientStatusChange: boolean = false
  ): boolean {
    // Internal users can always change status
    if (userRole) return true;
    // Thread authors can change status
    if (isThreadAuthor) return true;
    // Project managers can change status
    if (projectRole === ProjectRole.MANAGER) return true;
    // Clients can change status if explicitly allowed
    if (projectRole === ProjectRole.CLIENT && allowClientStatusChange) return true;
    return false;
  }

  static canAssignThread(
    userRole: UserRole,
    projectRole: ProjectRole | null
  ): boolean {
    if (this.hasRole(userRole, UserRole.REVIEWER)) return true;
    if (projectRole && projectRoleHierarchy[projectRole] >= projectRoleHierarchy[ProjectRole.REVIEWER]) {
      return true;
    }
    return false;
  }

  // Share link permissions
  static canCreateShareLink(
    userRole: UserRole,
    projectRole: ProjectRole | null
  ): boolean {
    if (this.hasRole(userRole, UserRole.REVIEWER)) return true;
    if (projectRole) return true;
    return false;
  }

  static canRevokeShareLink(
    userRole: UserRole,
    projectRole: ProjectRole | null,
    isCreator: boolean
  ): boolean {
    if (this.hasRole(userRole, UserRole.ADMIN)) return true;
    if (projectRole === ProjectRole.MANAGER) return true;
    if (isCreator) return true;
    return false;
  }

  // Annotation permissions
  static canCreateAnnotation(
    userRole: UserRole | null,
    projectRole: ProjectRole | null,
    guestCommentingEnabled: boolean,
    isGuest: boolean
  ): boolean {
    // Same rules as comments
    return this.canCreateComment(
      userRole,
      projectRole,
      guestCommentingEnabled,
      isGuest
    );
  }

  static canEditAnnotation(
    userRole: UserRole,
    isAnnotationAuthor: boolean,
    projectRole: ProjectRole | null
  ): boolean {
    return this.canEditComment(userRole, isAnnotationAuthor, projectRole);
  }

  static canDeleteAnnotation(
    userRole: UserRole,
    isAnnotationAuthor: boolean,
    projectRole: ProjectRole | null
  ): boolean {
    return this.canDeleteComment(userRole, isAnnotationAuthor, projectRole);
  }

  // Activity log permissions
  static canViewActivityLog(
    userRole: UserRole,
    projectRole: ProjectRole | null
  ): boolean {
    if (userRole) return true;
    if (projectRole) return true;
    return false;
  }

  // Guest access validation
  static validateGuestAccess(
    shareLink: {
      allowGuestView: boolean;
      allowGuestComments: boolean;
      expiresAt: Date | null;
      passwordProtected: boolean;
    },
    providedPassword: string | null,
    passwordHash: string | null
  ): { canView: boolean; canComment: boolean; error?: string } {
    // Check expiration
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return { canView: false, canComment: false, error: "Link has expired" };
    }

    // Check password protection
    if (shareLink.passwordProtected) {
      // In real implementation, compare hashed passwords
      if (!providedPassword) {
        return { canView: false, canComment: false, error: "Password required" };
      }
    }

    return {
      canView: shareLink.allowGuestView,
      canComment: shareLink.allowGuestComments,
    };
  }
}

// Helper type for permission context
export interface PermissionContext {
  userRole: UserRole | null;
  projectRole: ProjectRole | null;
  isCreator: boolean;
  isGuest: boolean;
}

// Status transition rules
export const allowedStatusTransitions: Record<CommentStatus, CommentStatus[]> = {
  [CommentStatus.OPEN]: [CommentStatus.IN_PROGRESS, CommentStatus.RESOLVED, CommentStatus.CLOSED, CommentStatus.IGNORED],
  [CommentStatus.IN_PROGRESS]: [CommentStatus.OPEN, CommentStatus.RESOLVED, CommentStatus.CLOSED, CommentStatus.IGNORED],
  [CommentStatus.RESOLVED]: [CommentStatus.OPEN, CommentStatus.IN_PROGRESS, CommentStatus.CLOSED],
  [CommentStatus.CLOSED]: [CommentStatus.OPEN],
  [CommentStatus.IGNORED]: [CommentStatus.OPEN],
};

export function canTransitionStatus(
  fromStatus: CommentStatus,
  toStatus: CommentStatus
): boolean {
  return allowedStatusTransitions[fromStatus].includes(toStatus);
}
