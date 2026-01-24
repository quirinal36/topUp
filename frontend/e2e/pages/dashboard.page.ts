import { Page, Locator, expect } from '@playwright/test';

/**
 * 대시보드 페이지 Page Object Model
 */
export class DashboardPage {
  readonly page: Page;
  readonly shopName: Locator;
  readonly totalCustomers: Locator;
  readonly todayChargeAmount: Locator;
  readonly todayDeductAmount: Locator;
  readonly recentTransactions: Locator;
  readonly searchInput: Locator;
  readonly numpad: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.shopName = page.locator('[data-testid="shop-name"]');
    this.totalCustomers = page.locator('[data-testid="total-customers"]');
    this.todayChargeAmount = page.locator('[data-testid="today-charge"]');
    this.todayDeductAmount = page.locator('[data-testid="today-deduct"]');
    this.recentTransactions = page.locator('[data-testid="recent-transactions"]');
    this.searchInput = page.getByPlaceholder('뒷자리 4자리 입력');
    this.numpad = page.locator('[data-testid="numpad"]');
    this.logoutButton = page.locator('[data-testid="logout-button"]');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async searchCustomerByPhone(phone4: string) {
    // 넘패드로 전화번호 4자리 입력
    for (const digit of phone4) {
      await this.page.click(`[data-testid="numpad-${digit}"]`);
    }
  }

  async clearSearch() {
    await this.page.click('[data-testid="numpad-clear"]');
  }

  async logout() {
    await this.logoutButton.click();
    await expect(this.page).toHaveURL('/login');
  }

  async expectDashboardLoaded() {
    await expect(this.page).toHaveURL(/\/(dashboard)?$/);
  }
}
