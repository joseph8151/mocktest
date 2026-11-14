-- extra order metadata (e.g. KCP transaction number) and an admin-only low-price product for testing payments
ALTER TABLE orders ADD COLUMN meta TEXT;
INSERT OR IGNORE INTO products (id,exam_type,title,description,price_krw,price_usd_cents,attempts,valid_days,active,sort) VALUES ('p-test','MAP','[관리자 전용] 결제 테스트 1,000원','카드·계좌이체·가상계좌·휴대폰 결제 연동 점검용 (관리자에게만 표시됩니다)',1000,100,1,30,0,99);
