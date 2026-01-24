import { test, expect } from '@playwright/test';
import { CustomerPage } from './pages/customer.page';
import { TransactionPage } from './pages/transaction.page';
import { TEST_USER, TEST_AMOUNTS } from './fixtures/test-data';

test.describe('4. 충전 기능 테스트', () => {
  test.describe('시나리오 4.1: 기본 충전', () => {
    test('빠른 금액 선택으로 충전 성공', async ({ page }) => {
      const customerPage = new CustomerPage(page);
      const transactionPage = new TransactionPage(page);

      await customerPage.goto();

      // 고객 선택
      const firstCustomer = page.locator('[data-testid="customer-item"]').first();
      if (!(await firstCustomer.isVisible({ timeout: 5000 }))) {
        test.skip();
        return;
      }
      await firstCustomer.click();

      // 고객 상세 표시 대기
      await expect(page.locator('[data-testid="customer-detail"]')).toBeVisible();

      // 충전 버튼 클릭
      await customerPage.chargeButton.click();

      // 충전 모달 대기
      await expect(transactionPage.chargeModal).toBeVisible();

      // 빠른 금액 선택 (10,000원)
      await transactionPage.selectQuickAmount(10000);

      // 충전하기 버튼 클릭 (PIN 없이 진행)
      await transactionPage.chargeSubmitButton.click();

      // 성공 확인 (모달 닫힘)
      await transactionPage.expectSuccess();
    });
  });

  test.describe('시나리오 4.2: 서비스 금액 포함 충전', () => {
    test('서비스 금액과 함께 충전', async ({ page }) => {
      const customerPage = new CustomerPage(page);
      const transactionPage = new TransactionPage(page);

      await customerPage.goto();

      const firstCustomer = page.locator('[data-testid="customer-item"]').first();
      if (!(await firstCustomer.isVisible({ timeout: 5000 }))) {
        test.skip();
        return;
      }
      await firstCustomer.click();
      await expect(page.locator('[data-testid="customer-detail"]')).toBeVisible();

      await customerPage.chargeButton.click();
      await expect(transactionPage.chargeModal).toBeVisible();

      // 빠른 금액 선택
      await transactionPage.selectQuickAmount(50000);

      // 서비스 금액 입력
      const serviceInput = page.getByPlaceholder('0');
      await serviceInput.fill('5000');

      // 충전하기 버튼 클릭
      await transactionPage.chargeSubmitButton.click();

      // 성공 확인
      await transactionPage.expectSuccess();
    });
  });

  test.describe('시나리오 4.3: 결제 수단 선택', () => {
    test('현금 결제로 충전', async ({ page }) => {
      const customerPage = new CustomerPage(page);
      const transactionPage = new TransactionPage(page);

      await customerPage.goto();

      const firstCustomer = page.locator('[data-testid="customer-item"]').first();
      if (!(await firstCustomer.isVisible({ timeout: 5000 }))) {
        test.skip();
        return;
      }
      await firstCustomer.click();
      await expect(page.locator('[data-testid="customer-detail"]')).toBeVisible();

      await customerPage.chargeButton.click();
      await expect(transactionPage.chargeModal).toBeVisible();

      // 금액 선택
      await transactionPage.selectQuickAmount(30000);

      // 현금 결제 선택
      await page.getByRole('button', { name: '현금' }).click();

      // 충전하기 버튼 클릭
      await transactionPage.chargeSubmitButton.click();

      await transactionPage.expectSuccess();
    });
  });
});

test.describe('5. 차감 기능 테스트', () => {
  test.describe('시나리오 5.1: 빠른 금액 선택 차감', () => {
    test('빠른 금액 선택으로 차감 성공', async ({ page }) => {
      const customerPage = new CustomerPage(page);
      const transactionPage = new TransactionPage(page);

      await customerPage.goto();

      // 고객 선택
      const firstCustomer = page.locator('[data-testid="customer-item"]').first();
      const hasCustomer = await firstCustomer.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasCustomer) {
        test.skip();
        return;
      }
      await firstCustomer.click();
      await expect(page.locator('[data-testid="customer-detail"]')).toBeVisible({ timeout: 5000 });

      // 잔액 확인 - customer-detail 내의 잔액 표시
      const balanceText = await page.locator('[data-testid="customer-balance"]').first().textContent();
      const initialBalance = balanceText ? parseInt(balanceText.replace(/[^0-9]/g, ''), 10) : 0;

      // 잔액이 충분한지 확인
      if (initialBalance >= 5000) {
        await customerPage.deductButton.click();
        await expect(transactionPage.deductModal).toBeVisible({ timeout: 5000 });

        // 메뉴 로딩 대기
        await page.waitForTimeout(1500);

        // 빠른 선택 영역에서 금액 버튼 찾기 (예: "4,500원")
        const modal = page.locator('[data-testid="deduct-modal"]');

        // 빠른 금액 버튼 클릭 (정확한 텍스트 매칭)
        const quickAmountButton = modal.getByRole('button', { name: '4,500원' });
        if (await quickAmountButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await quickAmountButton.click();
        } else {
          // 직접입력 버튼 클릭
          const directInputButton = modal.getByRole('button', { name: /직접입력/ });
          await directInputButton.click();
          // 직접입력 모드로 전환될 때까지 대기
          await page.waitForTimeout(500);

          // 넘패드로 금액 입력 (5000원) - 모달 내의 numpad 사용
          await expect(modal.locator('[data-testid="numpad-5"]')).toBeVisible({ timeout: 3000 });
          await modal.locator('[data-testid="numpad-5"]').click();
          await modal.locator('[data-testid="numpad-0"]').click();
          await modal.locator('[data-testid="numpad-0"]').click();
          await modal.locator('[data-testid="numpad-0"]').click();
        }

        // 차감하기 버튼 클릭 (PIN 없이 진행)
        await transactionPage.deductSubmitButton.click();

        // 성공 확인
        await transactionPage.expectSuccess();
      } else {
        test.skip();
      }
    });
  });

  test.describe('시나리오 5.2: 잔액 부족 차감 시도', () => {
    test('잔액보다 큰 금액 차감 시 에러', async ({ page }) => {
      const customerPage = new CustomerPage(page);
      const transactionPage = new TransactionPage(page);

      await customerPage.goto();

      const firstCustomer = page.locator('[data-testid="customer-item"]').first();
      const hasCustomer = await firstCustomer.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasCustomer) {
        test.skip();
        return;
      }
      await firstCustomer.click();
      await expect(page.locator('[data-testid="customer-detail"]')).toBeVisible({ timeout: 5000 });

      // 잔액 확인
      const balanceText = await page.locator('[data-testid="customer-balance"]').first().textContent();
      const initialBalance = balanceText ? parseInt(balanceText.replace(/[^0-9]/g, ''), 10) : 0;

      await customerPage.deductButton.click();
      await expect(transactionPage.deductModal).toBeVisible({ timeout: 5000 });

      // 메뉴 로딩 대기
      await page.waitForTimeout(1500);

      // 직접입력 버튼 클릭
      const modal = page.locator('[data-testid="deduct-modal"]');
      const directInputButton = modal.getByRole('button', { name: /직접입력/ });
      await directInputButton.click();
      // 직접입력 모드로 전환될 때까지 대기
      await page.waitForTimeout(500);

      // 잔액보다 큰 금액 입력 - 모달 내의 numpad 사용
      const excessAmount = initialBalance + 100000;
      await expect(modal.locator('[data-testid="numpad-1"]')).toBeVisible({ timeout: 3000 });
      for (const digit of excessAmount.toString()) {
        await modal.locator(`[data-testid="numpad-${digit}"]`).click();
      }

      // 차감하기 버튼 비활성화 또는 에러 메시지 확인
      const submitButton = transactionPage.deductSubmitButton;
      const isDisabled = await submitButton.isDisabled();

      if (!isDisabled) {
        // 버튼이 활성화되어 있으면 클릭 후 에러 확인
        await submitButton.click();
        await transactionPage.expectError();
      } else {
        // 버튼이 비활성화되어 있으면 통과
        expect(isDisabled).toBeTruthy();
      }
    });
  });
});

test.describe('6. 거래 취소 테스트', () => {
  // 거래 취소는 /transactions 페이지에서 진행되며 PIN이 필요함
  test.describe('시나리오 6.1: 거래 취소 시 PIN 필요', () => {
    test.skip('거래 취소 시 PIN 모달 표시', async ({ page }) => {
      // 이 테스트는 /transactions 페이지가 구현된 후 활성화
      await page.goto('/transactions');

      // 최근 거래에서 취소 버튼 클릭
      const transactionItem = page.locator('[data-testid="transaction-item"]').first();
      if (await transactionItem.isVisible()) {
        // 더보기 메뉴 클릭
        await transactionItem.locator('button').last().click();

        // 취소하기 클릭
        await page.getByRole('button', { name: '취소하기' }).click();

        // PIN 모달 표시 확인
        const transactionPage = new TransactionPage(page);
        await expect(transactionPage.pinModal).toBeVisible();
      }
    });
  });

  test.describe('시나리오 6.2: 이미 취소된 거래', () => {
    test.skip('취소된 거래는 취소 버튼 없음', async ({ page }) => {
      await page.goto('/transactions');

      // 취소된 거래 찾기
      const cancelledTransaction = page.locator('[data-transaction-cancelled="true"]').first();
      if (await cancelledTransaction.isVisible()) {
        // 취소 버튼이 없어야 함
        const menuButton = cancelledTransaction.locator('button');
        expect(await menuButton.count()).toBe(0);
      }
    });
  });
});
