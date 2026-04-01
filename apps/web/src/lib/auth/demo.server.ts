const fallbackDemoEmail = "demo@biota.local";
const fallbackDemoPassword = "biota-demo";
const fallbackDemoName = "Demo Researcher";

export function isDemoAuthMode() {
  return (
    process.env.BIOTA_DEMO_MODE === "true" ||
    (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL)
  );
}

export function getDemoCredentials() {
  return {
    email: process.env.NEXT_PUBLIC_BIOTA_DEMO_EMAIL ?? fallbackDemoEmail,
    password:
      process.env.NEXT_PUBLIC_BIOTA_DEMO_PASSWORD ?? fallbackDemoPassword,
    name: process.env.NEXT_PUBLIC_BIOTA_DEMO_NAME ?? fallbackDemoName,
  };
}

export function getDemoUser() {
  const credentials = getDemoCredentials();

  return {
    id: "demo-user",
    email: credentials.email,
    name: credentials.name,
  };
}

export function getDemoWorkspaceSnapshot() {
  return {
    id: "demo-user",
    email: getDemoCredentials().email,
    name: getDemoCredentials().name,
    personalWorkspace: {
      id: "demo-workspace",
      name: "Demo workspace",
      slug: "demo-workspace",
      repositories: [
        {
          id: "demo-repository",
          name: "Main notebook",
          slug: "main",
          visibility: "PRIVATE",
          isDefault: true,
          folders: [{ id: "demo-folder-root", name: "Root", slug: "root" }],
        },
      ],
    },
    organizationMembers: [
      {
        role: "OWNER",
        organization: {
          id: "demo-workspace",
          name: "Demo workspace",
          slug: "demo-workspace",
          kind: "PERSONAL",
        },
      },
    ],
  };
}
