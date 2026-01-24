import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 테스트 설정
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // 테스트 디렉토리
  testDir: './e2e',

  // 테스트 파일 패턴
  testMatch: '**/*.spec.ts',

  // 전체 테스트 타임아웃 (분)
  timeout: 60 * 1000,

  // 각 expect의 타임아웃
  expect: {
    timeout: 10 * 1000,
  },

  // CI에서는 재시도, 로컬에서는 재시도 없음
  retries: process.env.CI ? 2 : 0,

  // 병렬 실행 워커 수
  workers: process.env.CI ? 1 : undefined,

  // 리포터 설정
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // 모든 프로젝트에 공통으로 적용되는 설정
  use: {
    // 베이스 URL (로컬 개발 서버)
    baseURL: 'http://localhost:5173',

    // 실패 시 스크린샷
    screenshot: 'only-on-failure',

    // 실패 시 트레이스
    trace: 'on-first-retry',

    // 비디오 녹화 (실패 시만)
    video: 'on-first-retry',

    // 액션 타임아웃
    actionTimeout: 15 * 1000,

    // 네비게이션 타임아웃
    navigationTimeout: 30 * 1000,
  },

  // 브라우저별 프로젝트
  projects: [
    // 인증 설정 (로그인 상태 저장)
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Chrome 데스크톱
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 인증 상태 사용
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // 모바일 Chrome (반응형 테스트)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // 테스트 전 로컬 서버 시작
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
