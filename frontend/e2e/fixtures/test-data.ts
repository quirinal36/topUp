/**
 * E2E 테스트용 테스트 데이터
 */

// 테스트 계정 정보
export const TEST_USER = {
  username: 'turboguy',
  password: '789gagul',
  shopName: 'letscoding',
  email: 'turboguy@naver.com',
  pin: '1234',
};

// 테스트 고객 정보
export const TEST_CUSTOMERS = {
  customer1: {
    name: '홍길동',
    phone4: '1234',
  },
  customer2: {
    name: '김철수',
    phone4: '5678',
  },
  customerWithBalance: {
    name: '잔액있는고객',
    phone4: '9999',
    initialBalance: 100000,
  },
};

// 테스트 금액
export const TEST_AMOUNTS = {
  charge: {
    small: 10000,
    medium: 50000,
    large: 100000,
    withService: {
      payment: 100000,
      service: 10000,
    },
  },
  deduct: {
    small: 5000,
    medium: 20000,
  },
};

// 유효성 검사 테스트 케이스
export const VALIDATION_CASES = {
  username: {
    tooShort: 'abc',
    withUppercase: 'Test123',
    valid: 'testuser01',
  },
  password: {
    tooShort: '1234567',
    noNumber: 'abcdefgh',
    noLetter: '12345678',
    valid: 'Test1234!',
  },
};

// API 응답 대기 시간 (ms)
export const TIMEOUTS = {
  api: 5000,
  navigation: 10000,
  modal: 3000,
};
