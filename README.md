# 우리집 가계부

토스 가족 통장(모임통장) 거래내역을 가져와서 자동으로 분류해 보여 주는 가계부 웹앱입니다.
아이폰 Safari에서 **공유 → 홈 화면에 추가**를 하면 앱처럼 쓸 수 있습니다.

## 기능

- **거래내역 가져오기**: 토스 앱에서 받은 엑셀(.xlsx)이나 CSV 파일을 올리면 열을 자동으로 찾습니다. 이미 가져온 내역은 다시 올려도 건너뜁니다.
- **캡처 가져오기**: 토스 거래내역 화면이나 카드 승인 문자 캡처를 올리면 AI(Claude)가 읽어서 내역으로 바꿉니다. 여러 장이나 긴 스크롤 캡처도 되고, 저장 전에 날짜·금액·분류를 확인하고 고칠 수 있습니다. 이미 있는 내역(파일로 가져온 것 포함)은 자동으로 빼 둡니다.
- **자동 분류**: 스타벅스는 카페·간식, 이마트는 마트·생활처럼 분류합니다. 내역의 분류를 한 번 바꾸면 같은 거래처는 앞으로도 그 분류로 들어갑니다.
- **월별 요약**: 지출과 수입, 지난달과 비교, 분류별 지출을 보여 줍니다.
- **직접 입력**: 현금 지출처럼 통장에 안 찍힌 내역을 넣을 수 있습니다.
- **내부이체** 분류: 가족 계좌끼리 옮긴 돈은 통계에서 뺍니다.
- CSV 백업, 다크 모드를 지원합니다.

## 토스 연동에 대해

토스는 개인이 거래내역을 자동으로 가져갈 수 있는 공개 API를 제공하지 않습니다. 오픈뱅킹과 마이데이터도 사업자만 쓸 수 있습니다. 그래서 이 앱은 **토스 앱에서 내보낸 파일**이나 **거래내역 화면 캡처**를 올리는 방식을 씁니다.

## 로컬에서 실행

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # 파일 가져오기와 분류 테스트
```

Supabase 설정이 없으면 **이 기기 브라우저에만 저장하는 모드**로 동작합니다. 혼자 써 보기에는 이것만으로 충분합니다.

## 주소

https://ziro0914.github.io/myMoney/ — `main`에 올라오면 GitHub Actions(`.github/workflows/deploy.yml`)가 테스트 후 자동으로 배포합니다.

## 가족과 함께 쓰기 (Supabase, 무료)

설정 전에는 폰마다 따로 저장됩니다. 두 사람이 같은 가계부를 보려면:

1. [supabase.com](https://supabase.com)에서 프로젝트를 만듭니다 (Region: Northeast Asia (Seoul)).
2. **SQL Editor**에서 `supabase/schema.sql`을 실행합니다.
3. **Project Settings → API**의 Project URL과 `anon public` 키를 GitHub 저장소 **Settings → Secrets and variables → Actions → Variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`로 넣고, **Actions** 탭에서 Deploy를 다시 실행합니다.

로그인은 없습니다. 첫 화면에서 누가 쓰는지(`src/members.ts`의 이름)만 고르면 바로 들어갑니다.
그 대신 `anon` 키가 웹페이지에 들어 있으므로 **주소를 아는 사람은 누구나 내역을 보고 고칠 수 있습니다.** 주소를 다른 사람과 공유하지 마세요.

## 캡처 인식

Anthropic API 키는 브라우저에 두지 않고 Supabase Edge Function(`supabase/functions/parse-screenshot`)에 둡니다.

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <프로젝트 ref>
npx supabase functions deploy parse-screenshot --project-ref <프로젝트 ref>
```

키가 워크스페이스에 묶이지 않은 종류라면 `ANTHROPIC_WORKSPACE_ID` 시크릿에 워크스페이스 ID(`wrkspc_…`)도 넣습니다.

사용한 만큼 요금이 나갑니다 (캡처 한 장에 수십 원 수준으로 예상).

## 구조

```
src/
  screenshot.ts      캡처 줄이기·자르기, 인식 결과를 내역으로 바꾸기
  screenshotAi.ts    캡처 인식 서버 함수 호출
  importer.ts        파일 읽기, 헤더 찾기, 금액·날짜 해석, 중복 키
  categories.ts      분류 목록과 키워드 자동 분류
  store/             저장소 (localRepo: 브라우저, supabaseRepo: 가족 공유)
  useLedger.ts       화면에서 쓰는 데이터와 동작
  members.ts         사용자 이름 목록
  views/             홈, 내역, 가져오기, 설정, 사용자 선택 화면
supabase/schema.sql  DB 테이블과 접근 권한
supabase/functions/  캡처 인식 서버 함수 (Claude 호출)
```
