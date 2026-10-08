# 우리집 가계부

토스 가족 통장(모임통장) 거래내역을 가져와서 자동으로 분류해 보여 주는 가계부 웹앱입니다.
아이폰 Safari에서 **공유 → 홈 화면에 추가**를 하면 앱처럼 쓸 수 있습니다.

## 기능

- **거래내역 가져오기**: 토스 앱에서 받은 엑셀(.xlsx)이나 CSV 파일을 올리면 열을 자동으로 찾습니다. 이미 가져온 내역은 다시 올려도 건너뜁니다.
- **자동 분류**: 스타벅스는 카페·간식, 이마트는 마트·생활처럼 분류합니다. 내역의 분류를 한 번 바꾸면 같은 거래처는 앞으로도 그 분류로 들어갑니다.
- **월별 요약**: 지출과 수입, 지난달과 비교, 분류별 지출을 보여 줍니다.
- **직접 입력**: 현금 지출처럼 통장에 안 찍힌 내역을 넣을 수 있습니다.
- **내부이체** 분류: 가족 계좌끼리 옮긴 돈은 통계에서 뺍니다.
- CSV 백업, 다크 모드를 지원합니다.

## 토스 연동에 대해

토스는 개인이 거래내역을 자동으로 가져갈 수 있는 공개 API를 제공하지 않습니다. 오픈뱅킹과 마이데이터도 사업자만 쓸 수 있습니다. 그래서 이 앱은 **토스 앱에서 내보낸 파일을 올리는 방식**을 씁니다. 한 달에 한두 번 올리면 됩니다.

## 로컬에서 실행

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # 파일 가져오기와 분류 테스트
```

Supabase 설정이 없으면 **이 기기 브라우저에만 저장하는 모드**로 동작합니다. 혼자 써 보기에는 이것만으로 충분합니다.

## 가족과 함께 쓰기 (Supabase, 무료)

1. [supabase.com](https://supabase.com)에서 프로젝트를 만듭니다. 지역은 Northeast Asia (Seoul)를 고르세요.
2. **SQL Editor**에서 `supabase/schema.sql` 내용을 붙여 넣고 실행합니다. 마지막 줄의 `insert into members`에 가족 이메일을 넣어 같이 실행하세요.
3. **Authentication → Emails → Magic Link** 템플릿에 로그인 코드를 넣습니다. 예: `<p>로그인 코드: <b>{{ .Token }}</b></p>`
   - 아이폰 홈 화면 앱은 메일의 링크를 누르면 Safari로 열려서 로그인이 앱에 전달되지 않습니다. 그래서 이 앱은 코드 입력 방식으로 로그인합니다.
4. **Project Settings → API**에서 URL과 `anon` 키를 복사해 `.env` 파일을 만듭니다. `.env.example`을 참고하세요.
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

`members`에 등록된 이메일로 로그인한 사람만 내역을 읽고 쓸 수 있습니다. 데이터베이스의 행 수준 보안(RLS)으로 막습니다.

## 배포 (Vercel, 무료)

1. [vercel.com](https://vercel.com)에서 이 GitHub 저장소를 Import 합니다. Vite 프로젝트로 자동 인식됩니다.
2. Environment Variables에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 넣고 Deploy 합니다.
3. 아이폰 Safari로 배포된 주소를 열고 **공유 → 홈 화면에 추가**를 누릅니다.

## 구조

```
src/
  importer.ts        파일 읽기, 헤더 찾기, 금액·날짜 해석, 중복 키
  categories.ts      분류 목록과 키워드 자동 분류
  store/             저장소 (localRepo: 브라우저, supabaseRepo: 가족 공유)
  useLedger.ts       화면에서 쓰는 데이터와 동작
  views/             홈, 내역, 가져오기, 설정, 로그인 화면
supabase/schema.sql  DB 테이블과 접근 권한
```
