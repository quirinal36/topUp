import { test as setup, expect } from '@playwright/test';
import { TEST_USER } from './fixtures/test-data';

const authFile = 'e2e/.auth/user.json';

/**
 * 인증 Setup - 로그인 상태를 저장하여 다른 테스트에서 재사용
 */
setup('authenticate', async ({ page }) => {
  // 로그인 페이지로 이동
  await page.goto('/login');

  // 로그인 수행 (id 속성 사용 - 더 안정적)
  await page.locator('#username').fill(TEST_USER.username);
  await page.locator('#password').fill(TEST_USER.password);
  await page.getByRole('button', { name: '로그인' }).click();

  // 대시보드로 이동 확인
  await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 10000 });

  // 인증 상태 저장
  await page.context().storageState({ path: authFile });
});
