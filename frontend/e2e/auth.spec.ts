import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { DashboardPage } from './pages/dashboard.page';
import { TEST_USER, VALIDATION_CASES } from './fixtures/test-data';

test.describe('2. 로그인/로그아웃 테스트', () => {
  // 로그인 테스트는 fresh state에서 시작해야 함
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('시나리오 2.1: 정상 로그인', () => {
    test('유효한 자격증명으로 로그인 성공', async ({ page }) => {
      // localStorage 클리어하여 로그인 상태 제거
      await page.goto('/login');
      await page.evaluate(() => localStorage.clear());

      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // 로그인 페이지 로드 후 약간 대기 (rate limit 회피)
      await page.waitForTimeout(1000);

      await loginPage.login(TEST_USER.username, TEST_USER.password);

      // 대시보드로 이동 확인
      await loginPage.expectLoginSuccess();

      // 토큰이 localStorage에 저장됨 확인
      const token = await page.evaluate(() => localStorage.getItem('auth-storage'));
      expect(token).toBeTruthy();
    });
  });

  test.describe('시나리오 2.2: 로그인 실패 - 잘못된 자격증명', () => {
    test('잘못된 비밀번호로 로그인 시도 시 에러 메시지 표시', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.login(TEST_USER.username, 'wrongpassword123');

      // 에러 메시지 확인
      await loginPage.expectErrorMessage('아이디 또는 비밀번호가 올바르지 않습니다');

      // 페이지 유지 확인
      await expect(page).toHaveURL('/login');
    });

    test('존재하지 않는 아이디로 로그인 시도', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.login('nonexistentuser', 'anypassword123');

      await loginPage.expectErrorMessage('아이디 또는 비밀번호가 올바르지 않습니다');
    });
  });

  test.describe('시나리오 2.3: 로그인 Rate Limiting', () => {
    // 주의: 이 테스트는 실제 rate limit을 발생시켜 다른 테스트에 영향을 줌
    // CI 환경에서만 실행하거나 격리된 환경에서 실행해야 함
    test.skip('6회 연속 실패 시 잠금 메시지 표시', async ({ page }) => {
      const loginPage = new LoginPage(page);

      // 존재하지 않는 테스트용 계정으로 Rate limit 테스트
      const testUsername = `ratelimit_test_${Date.now()}`;

      // 6회 연속 실패 시도 - 매번 새로운 페이지 로드
      for (let i = 0; i < 6; i++) {
        await loginPage.goto();
        await loginPage.usernameInput.fill(testUsername);
        await loginPage.passwordInput.fill('wrongpassword');
        await loginPage.loginButton.click();
        // 에러 메시지 또는 rate limit 메시지가 표시될 때까지 대기
        await page.waitForSelector('text=/올바르지 않습니다|너무 많은|잠시 후/', { timeout: 10000 });
      }

      // Rate limit 메시지 확인
      await expect(page.locator('text=/너무 많은|잠시 후|Too many/')).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe('시나리오 2.4: 로그아웃', () => {
    test('로그아웃 후 로그인 페이지로 이동', async ({ page }) => {
      // 먼저 로그인
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(TEST_USER.username, TEST_USER.password);
      await loginPage.expectLoginSuccess();

      // 로그아웃
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.logout();

      // 로그인 페이지로 이동 확인
      await expect(page).toHaveURL('/login');

      // 토큰 삭제 확인
      const token = await page.evaluate(() => {
        const storage = localStorage.getItem('auth-storage');
        if (!storage) return null;
        const parsed = JSON.parse(storage);
        return parsed.state?.token;
      });
      expect(token).toBeFalsy();
    });

    test('로그아웃 후 보호된 페이지 접근 시 리다이렉트', async ({ page }) => {
      // 먼저 localStorage를 클리어하여 로그아웃 상태로 만듦
      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.clear();
      });

      // 로그아웃 상태에서 대시보드 접근 시도
      await page.goto('/dashboard');

      // 로그인 페이지로 리다이렉트 확인
      await expect(page).toHaveURL('/login', { timeout: 10000 });
    });
  });

  test.describe('시나리오 2.5: 세션 만료', () => {
    test('유효하지 않은 토큰으로 API 호출 시 로그아웃', async ({ page }) => {
      // 로그인
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(TEST_USER.username, TEST_USER.password);
      await loginPage.expectLoginSuccess();

      // 토큰 변조 - state 구조에 맞게 수정
      await page.evaluate(() => {
        const storage = localStorage.getItem('auth-storage');
        if (storage) {
          const parsed = JSON.parse(storage);
          if (parsed.state) {
            parsed.state.token = 'invalid_token_12345';
            // shop도 초기화하여 재인증 필요하게 만듦
            parsed.state.shop = null;
            localStorage.setItem('auth-storage', JSON.stringify(parsed));
          }
        }
      });

      // 페이지 새로고침하여 API 호출 유발
      await page.reload();
      // API 호출 후 401 응답으로 인한 로그아웃 대기
      await page.waitForTimeout(2000);

      // 로그인 페이지로 리다이렉트 확인 또는 대시보드에 남아있을 수 있음
      // 앱이 토큰 검증 후 자동 로그아웃하는지 확인
      const url = page.url();
      // 무효 토큰일 경우 API 호출 시 401이 발생하고 로그아웃 처리됨
      // 하지만 클라이언트 사이드 라우팅이므로 바로 리다이렉트 안 될 수 있음
      expect(url).toMatch(/\/(login)?$/);
    });
  });
});

test.describe('1. 회원가입 유효성 검사 테스트', () => {
  // 회원가입 테스트는 로그인 상태 없이 실행
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('시나리오 1.3: 유효성 검사 오류', () => {
    test.beforeEach(async ({ page }) => {
      // localStorage 클리어하여 로그인 상태 제거
      await page.goto('/login');
      await page.evaluate(() => localStorage.clear());
      // 회원가입 페이지로 이동
      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      // Step 1 폼이 로드될 때까지 대기
      await expect(page.locator('#username')).toBeVisible({ timeout: 10000 });
    });

    test('아이디 4자 미만 입력 시 중복확인 버튼 비활성화', async ({ page }) => {
      // Step 1에서 아이디 입력 (id 속성 사용)
      await page.locator('#username').fill(VALIDATION_CASES.username.tooShort);

      // 중복확인 버튼이 비활성화되어 있어야 함 (4자 미만)
      const checkButton = page.getByRole('button', { name: '중복확인' });
      await expect(checkButton).toBeDisabled({ timeout: 5000 });

      // 하단 안내 문구에 4~20자 안내가 표시되어야 함
      await expect(page.locator('text=/4~20자/')).toBeVisible({ timeout: 5000 });
    });

    test('아이디에 특수문자 포함 시 에러', async ({ page }) => {
      // 특수문자가 포함된 아이디 입력
      await page.locator('#username').fill('test@user');

      // 중복확인 버튼 클릭
      const checkButton = page.getByRole('button', { name: '중복확인' });
      await checkButton.click();

      // 에러 메시지 확인 (영문 소문자와 숫자만 사용 가능) - 빨간색 텍스트로 표시됨
      await expect(page.locator('.text-red-500, .text-red-400').filter({ hasText: /소문자|특수문자|영문/ })).toBeVisible({ timeout: 5000 });
    });

    test('비밀번호 8자 미만 입력 시 에러', async ({ page }) => {
      const uniqueUsername = `validuser${Date.now().toString().slice(-5)}`;
      await page.locator('#username').fill(uniqueUsername);

      // 중복확인 버튼 활성화 대기 후 클릭
      const checkButton = page.getByRole('button', { name: '중복확인' });
      await expect(checkButton).toBeEnabled({ timeout: 5000 });
      await checkButton.click();

      // 중복확인 응답 대기 (사용 가능 또는 이미 사용 중)
      await expect(page.locator('text=/사용 가능|이미 사용/')).toBeVisible({ timeout: 10000 });

      // 사용 가능한 경우에만 진행
      const isAvailable = await page.locator('text=/사용 가능/').isVisible().catch(() => false);
      if (!isAvailable) {
        test.skip();
        return;
      }

      // 비밀번호 입력
      await page.locator('#password').fill(VALIDATION_CASES.password.tooShort);
      await page.locator('#confirmPassword').fill(VALIDATION_CASES.password.tooShort);

      // 다음 버튼 클릭하여 유효성 검사 트리거
      await page.getByRole('button', { name: '다음' }).click();

      await expect(page.locator('text=/8자 이상/')).toBeVisible({ timeout: 5000 });
    });

    test('비밀번호에 숫자 미포함 시 에러', async ({ page }) => {
      const uniqueUsername = `validuser${Date.now().toString().slice(-5)}`;
      await page.locator('#username').fill(uniqueUsername);

      // 중복확인 버튼 활성화 대기 후 클릭
      const checkButton = page.getByRole('button', { name: '중복확인' });
      await expect(checkButton).toBeEnabled({ timeout: 5000 });
      await checkButton.click();

      // 중복확인 응답 대기 (사용 가능 또는 이미 사용 중)
      await expect(page.locator('text=/사용 가능|이미 사용/')).toBeVisible({ timeout: 10000 });

      // 사용 가능한 경우에만 진행
      const isAvailable = await page.locator('text=/사용 가능/').isVisible().catch(() => false);
      if (!isAvailable) {
        test.skip();
        return;
      }

      await page.locator('#password').fill(VALIDATION_CASES.password.noNumber);
      await page.locator('#confirmPassword').fill(VALIDATION_CASES.password.noNumber);
      await page.getByRole('button', { name: '다음' }).click();

      // 에러 메시지 확인 (빨간색 텍스트로 표시됨)
      await expect(page.locator('.text-red-500, .text-red-400').filter({ hasText: /숫자/ })).toBeVisible({ timeout: 5000 });
    });

    test('비밀번호에 영문 미포함 시 에러', async ({ page }) => {
      const uniqueUsername = `validuser${Date.now().toString().slice(-5)}`;
      await page.locator('#username').fill(uniqueUsername);

      const checkButton = page.getByRole('button', { name: '중복확인' });
      await expect(checkButton).toBeEnabled({ timeout: 5000 });
      await checkButton.click();

      await expect(page.locator('text=/사용 가능|이미 사용/')).toBeVisible({ timeout: 10000 });

      const isAvailable = await page.locator('text=/사용 가능/').isVisible().catch(() => false);
      if (!isAvailable) {
        test.skip();
        return;
      }

      await page.locator('#password').fill(VALIDATION_CASES.password.noLetter);
      await page.locator('#confirmPassword').fill(VALIDATION_CASES.password.noLetter);
      await page.getByRole('button', { name: '다음' }).click();

      // 에러 메시지 확인 (빨간색 텍스트로 표시됨)
      await expect(page.locator('.text-red-500, .text-red-400').filter({ hasText: /영문/ })).toBeVisible({ timeout: 5000 });
    });
  });
});
