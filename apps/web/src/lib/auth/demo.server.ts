const fallbackDemoEmail = "demo@biota.local";
const fallbackDemoPassword = "biota-demo";
const fallbackDemoName = "Demo Researcher";
export const demoRepositoryId = "demo-repository";
export const demoWorkspaceId = "demo-workspace";
export const demoRootFolderId = "demo-folder-root";

const demoEntries = [
  {
    id: "demo-entry-crispr-screen",
    title: "CRISPR pilot screen day 0 setup",
    slug: "crispr-pilot-screen-day-0-setup",
    summary:
      "Seed plate map, transduction notes, and baseline confluence readout for the pilot sgRNA panel.",
    status: "DRAFT",
    repositoryName: "Main notebook",
    folderName: "Root",
    latestVersionNumber: 1,
    updatedAt: new Date("2026-03-28T15:10:00.000Z"),
    createdByName: fallbackDemoName,
    bodyText:
      "Objective\nEstablish the day 0 baseline for the 12-guide pilot screen.\n\nMaterials\n- HEK293T Cas9 pool\n- Lentiviral sgRNA panel A\n- Polybrene\n- Standard complete media\n\nNotes\nCells were plated at 2.0e5 per well in a 12-well format. Viral addition was staggered in 10-minute intervals to keep collection timing aligned.",
  },
  {
    id: "demo-entry-miniprep-qc",
    title: "Miniprep QC and digest review",
    slug: "miniprep-qc-and-digest-review",
    summary:
      "Concentration measurements and restriction digest outcomes for the pBIOTA reporter build set.",
    status: "REVIEW",
    repositoryName: "Main notebook",
    folderName: "Root",
    latestVersionNumber: 2,
    updatedAt: new Date("2026-03-31T11:25:00.000Z"),
    createdByName: fallbackDemoName,
    bodyText:
      "Summary\nSix constructs cleared concentration threshold. Two require re-miniprep because the expected backbone band was weak.\n\nFollow-up\nRepeat digest on clones 4 and 7 with fresh enzyme mix before moving to sequencing.",
  },
];

const demoProtocols = [
  {
    id: "demo-protocol-sgrna-oligo",
    title: "sgRNA oligo duplex setup",
    slug: "sgrna-oligo-duplex-setup",
    summary:
      "Standard duplexing workflow for sense and antisense oligos before cloning into the guide backbone.",
    status: "ACTIVE",
    repositoryName: "Main notebook",
    folderName: "Root",
    latestVersionNumber: 3,
    updatedAt: new Date("2026-03-27T18:40:00.000Z"),
    createdByName: fallbackDemoName,
    bodyText:
      "1. Combine 1 uL sense oligo, 1 uL antisense oligo, 1 uL 10x ligation buffer, and 7 uL water.\n2. Heat to 95 C for 5 minutes.\n3. Ramp down to room temperature over 45 minutes.\n4. Dilute 1:200 before ligation into the digested backbone.",
  },
  {
    id: "demo-protocol-colony-pcr",
    title: "Rapid colony PCR check",
    slug: "rapid-colony-pcr-check",
    summary:
      "Fast colony PCR workflow for screening cloned inserts before overnight culture expansion.",
    status: "DRAFT",
    repositoryName: "Main notebook",
    folderName: "Root",
    latestVersionNumber: 1,
    updatedAt: new Date("2026-03-30T09:05:00.000Z"),
    createdByName: fallbackDemoName,
    bodyText:
      "Reaction mix\n- 5 uL 2x master mix\n- 0.4 uL forward primer\n- 0.4 uL reverse primer\n- 4.2 uL water\n\nCycling\n95 C 2 min\n30 cycles of 95 C 15 s, 58 C 20 s, 72 C 25 s\n72 C 2 min",
  },
];

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
      id: demoWorkspaceId,
      name: "Demo workspace",
      slug: "demo-workspace",
      repositories: [
        {
          id: demoRepositoryId,
          name: "Main notebook",
          slug: "main",
          visibility: "PRIVATE",
          isDefault: true,
          folders: [{ id: demoRootFolderId, name: "Root", slug: "root" }],
        },
      ],
    },
    organizationMembers: [
      {
        role: "OWNER",
        organization: {
          id: demoWorkspaceId,
          name: "Demo workspace",
          slug: "demo-workspace",
          kind: "PERSONAL",
        },
      },
    ],
  };
}

export function getDemoEntries() {
  return demoEntries;
}

export function getDemoEntryById(entryId: string) {
  return demoEntries.find((entry) => entry.id === entryId) ?? null;
}

export function getDemoProtocols() {
  return demoProtocols;
}

export function getDemoProtocolById(protocolId: string) {
  return demoProtocols.find((protocol) => protocol.id === protocolId) ?? null;
}
