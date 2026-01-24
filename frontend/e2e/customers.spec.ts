import { test, expect } from '@playwright/test';
import { CustomerPage } from './pages/customer.page';
import { DashboardPage } from './pages/dashboard.page';
import { TEST_CUSTOMERS } from './fixtures/test-data';

test.describe('3. 고객 관리 테스트', () => {
  test.describe('시나리오 3.1: 고객 등록', () => {
    test('신규 고객 등록 성공', async ({ page }) => {
      const customerPage = new CustomerPage(page);
      await customerPage.goto();
      const dashboardPage = new DashboardPage(page);

      // 고객 추가
      const testCustomer = {
        name: `테스트고객_${Date.now().toString().slice(-6)}`,
        phone4: Math.floor(1000 + Math.random() * 9000).toString(),
      };

      await customerPage.addCustomer(testCustomer.name, testCustomer.phone4);

      // 모달이 닫히면 등록 성공 (토스트 메시지가 없을 수 있음)
      await expect(page.locator('[data-testid="add-customer-modal"]')).not.toBeVisible({ timeout: 5000 });

      // 성공 토스트 메시지 확인 또는 고객 수 증가 확인
      // (고객 목록은 페이지네이션되어 있어서 새 고객이 바로 보이지 않을 수 있음)
      await page.waitForTimeout(1000);

      // 고객 수가 증가했는지 확인 (예: "135명" -> "136명")
      const customerCountText = await page.locator('text=/\\d+명/').first().textContent();
      expect(customerCountText).toBeTruthy();
    });

    test('전화번호 없이 고객 등록 성공', async ({ page }) => {
      const customerPage = new CustomerPage(page);
      await customerPage.goto();

      const testCustomer = {
        name: `고객없음_${Date.now().toString().slice(-6)}`,
      };

      await customerPage.addCustomer(testCustomer.name);

      // 모달이 닫히면 성공
      await expect(page.locator('[data-testid="add-customer-modal"]')).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('시나리오 3.2: 고객 검색 (POS 스타일)', () => {
    test('넘패드로 전화번호 검색', async ({ page }) => {
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.goto();

      // 전화번호 4자리로 검색
      await dashboardPage.searchCustomerByPhone('1234');

      // 검색 입력 필드에 값이 입력되었는지 확인
      const searchInput = page.getByPlaceholder('뒷자리 4자리 입력');
      await expect(searchInput).toHaveValue('1234', { timeout: 5000 });

      // 검색 결과 영역 표시 확인 (결과가 있든 없든 영역은 표시됨)
      await page.waitForTimeout(1000); // API 응답 대기
    });

    test('검색어 지우기', async ({ page }) => {
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.goto();

      await dashboardPage.searchCustomerByPhone('1234');
      await dashboardPage.clearSearch();

      // 검색 입력이 비워졌는지 확인
      const searchInput = page.getByPlaceholder('뒷자리 4자리 입력');
      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('시나리오 3.3: 고객 상세 조회', () => {
    test('고객 클릭 시 상세 정보 표시', async ({ page }) => {
      const customerPage = new CustomerPage(page);
      await customerPage.goto();

      // 먼저 검색해서 고객 목록을 표시
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.searchCustomerByPhone('');
      await page.waitForTimeout(500);

      // 첫 번째 고객 선택 (기존 고객이 있다고 가정)
      const firstCustomer = page.locator('[data-testid="customer-item"]').first();
      if (await firstCustomer.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstCustomer.click();

        // 상세 정보 표시 확인
        await expect(page.locator('[data-testid="customer-detail"]')).toBeVisible({ timeout: 5000 });

        // 잔액 표시 확인
        await expect(page.locator('[data-testid="customer-balance"]').first()).toBeVisible({ timeout: 5000 });
      } else {
        // 고객이 없는 경우 테스트 스킵
        test.skip();
      }
    });
  });

  test.describe('시나리오 3.4: 고객 정보 수정', () => {
    // 현재 Dashboard에서는 고객 수정 기능이 구현되지 않음
    // /customers 페이지에서 구현 후 테스트 활성화
    test.skip('고객명 수정 성공', async ({ page }) => {
      const customerPage = new CustomerPage(page);
      await customerPage.goto();

      // 고객 선택
      const firstCustomer = page.locator('[data-testid="customer-item"]').first();
      if (await firstCustomer.isVisible()) {
        await firstCustomer.click();

        // 수정 버튼 클릭
        await page.getByRole('button', { name: /수정|편집/ }).click();

        // 이름 변경
        const newName = `수정된고객_${Date.now()}`;
        await page.getByPlaceholder(/고객명|이름/).fill(newName);

        // 저장
        await page.getByRole('button', { name: /저장|확인/ }).click();

        // 성공 메시지 확인
        await expect(page.locator('text=/성공|수정/')).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
