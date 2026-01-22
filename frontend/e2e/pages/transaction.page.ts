import { Page, Locator, expect } from '@playwright/test';

/**
 * 거래(충전/차감) 모달 Page Object Model
 * - 충전/차감은 PIN 없이 낙관적 업데이트로 처리됨
 * - 거래 취소 시에만 PIN 필요
 */
export class TransactionPage {
  readonly page: Page;

  // 충전 모달
  readonly chargeModal: Locator;
  readonly chargeSubmitButton: Locator;

  // 차감 모달
  readonly deductModal: Locator;
  readonly deductSubmitButton: Locator;

  // PIN 입력 (거래 취소 시에만 사용)
  readonly pinModal: Locator;
  readonly pinError: Locator;
  readonly pinConfirmButton: Locator;

  // 공통
  readonly successToast: Locator;
  readonly errorToast: Locator;

  constructor(page: Page) {
    this.page = page;

    // 충전 모달
    this.chargeModal = page.locator('[data-testid="charge-modal"]');
    this.chargeSubmitButton = page.getByRole('button', { name: /충전하기/ });

    // 차감 모달
    this.deductModal = page.locator('[data-testid="deduct-modal"]');
    this.deductSubmitButton = page.getByRole('button', { name: /차감하기/ });

    // PIN 입력 (거래 취소 시에만 사용)
    this.pinModal = page.locator('[data-testid="pin-modal"]');
    this.pinError = page.locator('[data-testid="pin-error"]');
    this.pinConfirmButton = page.locator('[data-testid="pin-confirm"]');

    // Toast 메시지
    this.successToast = page.locator('[class*="toast"]').filter({ hasText: /충전|차감|성공|완료/ });
    this.errorToast = page.locator('[class*="toast"]').filter({ hasText: /실패|오류|부족/ });
  }

  async enterPin(pin: string) {
    // PIN 모달이 표시될 때까지 대기
    await expect(this.pinModal).toBeVisible({ timeout: 5000 });

    // 각 자리 입력
    for (let i = 0; i < pin.length; i++) {
      await this.page.locator(`[data-testid="pin-input-${i}"]`).fill(pin[i]);
    }

    // 확인 버튼 클릭
    await this.pinConfirmButton.click();
  }

  async charge(amount: number, serviceAmount: number = 0, paymentMethod: string = 'CARD') {
    // 충전 모달 대기
    await expect(this.chargeModal).toBeVisible({ timeout: 5000 });

    // 빠른 금액 선택 또는 직접 입력
    // 빠른 선택 버튼에서 금액 찾기
    const quickAmountButton = this.page.locator(`button:has-text("${amount.toLocaleString()}")`);
    if (await quickAmountButton.isVisible()) {
      await quickAmountButton.click();
    } else {
      // 직접 입력 버튼 클릭
      await this.page.getByRole('button', { name: '직접 입력' }).click();
      // 넘패드로 입력
      for (const digit of amount.toString()) {
        await this.page.locator(`[data-testid="numpad-${digit}"]`).click();
      }
    }

    // 서비스 금액 입력 (있는 경우)
    if (serviceAmount > 0) {
      const serviceInput = this.page.getByPlaceholder('0');
      await serviceInput.fill(serviceAmount.toString());
    }

    // 결제 수단 선택 (버튼 형태)
    const paymentLabel = paymentMethod === 'CARD' ? '카드' : paymentMethod === 'CASH' ? '현금' : '이체';
    await this.page.getByRole('button', { name: paymentLabel }).click();

    // 충전하기 버튼 클릭
    await this.chargeSubmitButton.click();
  }

  async deductDirect(amount: number, memo?: string) {
    // 차감 모달 대기
    await expect(this.deductModal).toBeVisible({ timeout: 5000 });

    // 직접 입력 버튼 클릭
    const customInputButton = this.page.getByRole('button', { name: '직접 입력' });
    if (await customInputButton.isVisible()) {
      await customInputButton.click();
    }

    // 넘패드로 금액 입력
    for (const digit of amount.toString()) {
      await this.page.locator(`[data-testid="numpad-${digit}"]`).click();
    }

    // 메모 입력 (있는 경우)
    if (memo) {
      const memoInput = this.page.getByPlaceholder(/아메리카노|메뉴/);
      if (await memoInput.isVisible()) {
        await memoInput.fill(memo);
      }
    }

    // 차감하기 버튼 클릭
    await this.deductSubmitButton.click();
  }

  async selectQuickAmount(amount: number) {
    // 빠른 금액 선택
    const quickAmountButton = this.page.locator(`button:has-text("${amount.toLocaleString()}")`);
    await quickAmountButton.click();
  }

  async expectSuccess() {
    // 토스트 메시지 또는 모달 닫힘으로 성공 확인
    await expect(this.chargeModal.or(this.deductModal)).not.toBeVisible({ timeout: 5000 });
  }

  async expectError(message?: string) {
    // 에러 메시지 확인
    const errorLocator = this.page.locator('text=/잔액|부족|실패|오류/');
    await expect(errorLocator).toBeVisible({ timeout: 5000 });
  }

  async expectPinError() {
    await expect(this.pinError).toBeVisible({ timeout: 5000 });
  }

  async closeModal() {
    const closeButton = this.page.getByRole('button', { name: '취소' });
    await closeButton.click();
  }
}
