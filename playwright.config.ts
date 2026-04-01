const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const authSecret =
  process.env.AUTH_SECRET ?? "playwright-local-auth-secret-for-biota";
const demoEmail =
  process.env.NEXT_PUBLIC_BIOTA_DEMO_EMAIL ?? "demo@biota.local";
const demoPassword =
  process.env.NEXT_PUBLIC_BIOTA_DEMO_PASSWORD ?? "biota-demo";
const demoName =
  process.env.NEXT_PUBLIC_BIOTA_DEMO_NAME ?? "Demo Researcher";

const config = {
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    cwd: "apps/web",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      AUTH_SECRET: authSecret,
      NEXTAUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
      BIOTA_DEMO_MODE: "true",
      NEXT_PUBLIC_BIOTA_DEMO_MODE: "true",
      NEXT_PUBLIC_BIOTA_DEMO_EMAIL: demoEmail,
      NEXT_PUBLIC_BIOTA_DEMO_PASSWORD: demoPassword,
      NEXT_PUBLIC_BIOTA_DEMO_NAME: demoName,
    },
  },
};

export default config;
