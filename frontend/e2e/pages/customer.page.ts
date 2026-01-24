import { Page, Locator, expect } from '@playwright/test';

/**
 * 고객 관리 페이지 Page Object Model
 * - Dashboard에서 고객 관리 기능을 테스트
 */
export class CustomerPage {
  readonly page: Page;
  readonly addCustomerButton: Locator;
  readonly customerList: Locator;
  readonly customerNameInput: Locator;
  readonly customerPhone4Input: Locator;
  readonly saveButton: Locator;
  readonly chargeButton: Locator;
  readonly deductButton: Locator;
  readonly balanceDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    // Dashboard에서 '고객 등록' 버튼
    this.addCustomerButton = page.getByRole('button', { name: /고객 등록/ });
    this.customerList = page.locator('[data-testid="search-results"]');
    // 고객 추가 모달의 입력 필드
    this.customerNameInput = page.getByPlaceholder('홍길동');
    this.customerPhone4Input = page.getByPlaceholder('1234');
    this.saveButton = page.getByRole('button', { name: '등록하기' });
    this.chargeButton = page.getByRole('button', { name: /충전/ });
    this.deductButton = page.getByRole('button', { name: /차감|사용/ });
    this.balanceDisplay = page.locator('[data-testid="customer-balance"]');
  }

  async goto() {
    // Dashboard에서 고객 관리
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async addCustomer(name: string, phone4?: string) {
    await this.addCustomerButton.click();
    // 모달이 열릴 때까지 대기
    await expect(this.page.locator('[data-testid="add-customer-modal"]')).toBeVisible({ timeout: 5000 });
    await this.customerNameInput.fill(name);
    if (phone4) {
      await this.customerPhone4Input.fill(phone4);
    }
    await this.saveButton.click();
  }

  async selectCustomer(name: string) {
    await this.page.locator(`[data-testid="customer-item"]:has-text("${name}")`).click();
  }

  async getCustomerBalance(): Promise<number> {
    await expect(this.balanceDisplay).toBeVisible({ timeout: 5000 });
    const balanceText = await this.balanceDisplay.textContent();
    if (!balanceText) return 0;
    // "10,000원" -> 10000
    return parseInt(balanceText.replace(/[^0-9]/g, ''), 10);
  }

  async expectCustomerInList(name: string) {
    await expect(this.customerList).toContainText(name, { timeout: 5000 });
  }

  async expectBalance(expectedBalance: number) {
    const balance = await this.getCustomerBalance();
    expect(balance).toBe(expectedBalance);
  }
}
