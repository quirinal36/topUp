import { Page, Locator, expect } from '@playwright/test';

/**
 * 로그인 페이지 Page Object Model
 */
export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly registerLink: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.getByRole('button', { name: '로그인' });
    this.errorMessage = page.locator('.text-red-500, [role="alert"]');
    this.registerLink = page.getByRole('link', { name: /회원가입/ });
    this.forgotPasswordLink = page.getByRole('link', { name: /비밀번호를 잊으셨나요/ });
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async expectErrorMessage(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }

  async expectLoginSuccess() {
    // 대시보드로 리다이렉트 확인 (로그인 API 응답이 느릴 수 있으므로 충분한 시간 대기)
    await expect(this.page).toHaveURL(/\/(dashboard)?$/, { timeout: 15000 });
  }
}
