-- Migration: RPC 함수에 new_balance 반환 추가
-- 트랜잭션 검증을 위해 충전/차감/취소 후 새 잔액을 반환

-- 기존 함수 삭제 (반환 타입 변경을 위해 필요)
DROP FUNCTION IF EXISTS charge_balance(uuid, uuid, integer, integer, text, text);
DROP FUNCTION IF EXISTS deduct_balance(uuid, uuid, integer, text);
DROP FUNCTION IF EXISTS cancel_transaction(uuid, uuid, text);

-- 1. charge_balance 함수 업데이트
CREATE OR REPLACE FUNCTION charge_balance(
    p_customer_id UUID,
    p_shop_id UUID,
    p_actual_payment INTEGER,
    p_service_amount INTEGER DEFAULT 0,
    p_payment_method TEXT DEFAULT 'CARD',
    p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer RECORD;
    v_total_amount INTEGER;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- 고객 조회 및 잠금
    SELECT * INTO v_customer
    FROM customers
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'CUSTOMER_NOT_FOUND',
            'message', '고객을 찾을 수 없습니다'
        );
    END IF;

    -- 권한 확인
    IF v_customer.shop_id != p_shop_id THEN
        RETURN json_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', '해당 고객에 대한 접근 권한이 없습니다'
        );
    END IF;

    -- 총 충전액 계산
    v_total_amount := p_actual_payment + p_service_amount;
    v_new_balance := v_customer.current_balance + v_total_amount;

    -- 잔액 업데이트
    UPDATE customers
    SET current_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_customer_id;

    -- 거래 기록 생성
    INSERT INTO transactions (
        customer_id,
        type,
        amount,
        actual_payment,
        service_amount,
        payment_method,
        note
    ) VALUES (
        p_customer_id,
        'CHARGE',
        v_total_amount,
        p_actual_payment,
        p_service_amount,
        p_payment_method,
        p_note
    )
    RETURNING id INTO v_transaction_id;

    RETURN json_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'customer_id', p_customer_id,
        'amount', v_total_amount,
        'actual_payment', p_actual_payment,
        'service_amount', p_service_amount,
        'note', p_note,
        'new_balance', v_new_balance
    );
END;
$$;

-- 2. deduct_balance 함수 업데이트
CREATE OR REPLACE FUNCTION deduct_balance(
    p_customer_id UUID,
    p_shop_id UUID,
    p_amount INTEGER,
    p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer RECORD;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- 금액 유효성 검사
    IF p_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_AMOUNT',
            'message', '차감 금액은 0보다 커야 합니다'
        );
    END IF;

    -- 고객 조회 및 잠금
    SELECT * INTO v_customer
    FROM customers
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'CUSTOMER_NOT_FOUND',
            'message', '고객을 찾을 수 없습니다'
        );
    END IF;

    -- 권한 확인
    IF v_customer.shop_id != p_shop_id THEN
        RETURN json_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', '해당 고객에 대한 접근 권한이 없습니다'
        );
    END IF;

    -- 잔액 확인
    IF v_customer.current_balance < p_amount THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INSUFFICIENT_BALANCE',
            'message', '잔액이 부족합니다',
            'current_balance', v_customer.current_balance
        );
    END IF;

    -- 새 잔액 계산
    v_new_balance := v_customer.current_balance - p_amount;

    -- 잔액 업데이트
    UPDATE customers
    SET current_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_customer_id;

    -- 거래 기록 생성
    INSERT INTO transactions (
        customer_id,
        type,
        amount,
        note
    ) VALUES (
        p_customer_id,
        'DEDUCT',
        p_amount,
        p_note
    )
    RETURNING id INTO v_transaction_id;

    RETURN json_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'customer_id', p_customer_id,
        'amount', p_amount,
        'note', p_note,
        'new_balance', v_new_balance
    );
END;
$$;

-- 3. cancel_transaction 함수 업데이트
CREATE OR REPLACE FUNCTION cancel_transaction(
    p_transaction_id UUID,
    p_shop_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction RECORD;
    v_customer RECORD;
    v_new_balance INTEGER;
    v_cancel_transaction_id UUID;
    v_cancel_amount INTEGER;
BEGIN
    -- 원본 거래 조회
    SELECT t.*, c.shop_id, c.current_balance
    INTO v_transaction
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE t.id = p_transaction_id
    FOR UPDATE OF t, c;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'TRANSACTION_NOT_FOUND',
            'message', '거래를 찾을 수 없습니다'
        );
    END IF;

    -- 권한 확인
    IF v_transaction.shop_id != p_shop_id THEN
        RETURN json_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', '해당 거래에 대한 접근 권한이 없습니다'
        );
    END IF;

    -- 이미 취소된 거래인지 확인
    IF v_transaction.is_cancelled THEN
        RETURN json_build_object(
            'success', false,
            'error', 'ALREADY_CANCELLED',
            'message', '이미 취소된 거래입니다'
        );
    END IF;

    -- 취소 거래는 취소 불가
    IF v_transaction.type = 'CANCEL' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_CANCEL',
            'message', '취소 거래는 다시 취소할 수 없습니다'
        );
    END IF;

    -- 취소 금액 및 새 잔액 계산
    IF v_transaction.type = 'CHARGE' THEN
        v_cancel_amount := v_transaction.amount;
        v_new_balance := v_transaction.current_balance - v_transaction.amount;

        -- 잔액 부족 확인 (충전 취소 시)
        IF v_new_balance < 0 THEN
            RETURN json_build_object(
                'success', false,
                'error', 'INSUFFICIENT_BALANCE_FOR_CANCEL',
                'message', '잔액이 부족하여 충전 취소를 할 수 없습니다'
            );
        END IF;
    ELSE -- DEDUCT
        v_cancel_amount := v_transaction.amount;
        v_new_balance := v_transaction.current_balance + v_transaction.amount;
    END IF;

    -- 원본 거래 취소 표시
    UPDATE transactions
    SET is_cancelled = true
    WHERE id = p_transaction_id;

    -- 잔액 업데이트
    UPDATE customers
    SET current_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = v_transaction.customer_id;

    -- 취소 거래 기록 생성
    INSERT INTO transactions (
        customer_id,
        type,
        amount,
        note,
        cancelled_by_id
    ) VALUES (
        v_transaction.customer_id,
        'CANCEL',
        v_cancel_amount,
        p_note,
        p_transaction_id
    )
    RETURNING id INTO v_cancel_transaction_id;

    RETURN json_build_object(
        'success', true,
        'transaction_id', v_cancel_transaction_id,
        'customer_id', v_transaction.customer_id,
        'amount', v_cancel_amount,
        'note', p_note,
        'new_balance', v_new_balance
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION charge_balance TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_balance TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_transaction TO authenticated;
