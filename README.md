# 우리집 가계부

토스 가족 통장(모임통장) 거래내역을 가져와서 자동으로 분류해 보여 주는 가계부 웹앱입니다.
아이폰 Safari에서 **공유 → 홈 화면에 추가**를 하면 앱처럼 쓸 수 있습니다.

## 기능

- **거래내역 가져오기**: 토스 앱에서 받은 엑셀(.xlsx)이나 CSV 파일을 올리면 열을 자동으로 찾습니다. 이미 가져온 내역은 다시 올려도 건너뜁니다.
- **캡처 가져오기**: 토스 거래내역 화면이나 카드 승인 문자 캡처를 올리면 AI(Claude)가 읽어서 내역으로 바꿉니다. 여러 장이나 긴 스크롤 캡처도 되고, 저장 전에 날짜·금액·분류를 확인하고 고칠 수 있습니다. 이미 있는 내역(파일로 가져온 것 포함)은 자동으로 빼 둡니다.
- **자동 분류**: 스타벅스는 카페·간식, 이마트는 마트·생활처럼 분류합니다. 내역의 분류를 한 번 바꾸면 같은 거래처는 앞으로도 그 분류로 들어갑니다.
- **월별 요약**: 지출과 수입, 지난달과 비교, 분류별 지출을 보여 줍니다. 한 달은 월급날 기준으로 **21일부터 다음 달 20일까지**입니다 (`src/format.ts`의 `CYCLE_START_DAY`).
- **월별 예산**: 홈의 **예산 정하기**에서 분류별 예산을 정하면 분류마다 사용률(%)과 남은·초과 금액을, 위쪽 **전체 예산** 칸에서 전체 사용률과 기간이 얼마나 지났는지를 보여 줍니다. 정한 금액은 다음 달에도 이어집니다.
- **카드 문자 자동 입력**: 하나카드 승인 문자가 오면 아이폰 단축어가 바로 가계부 지출로 넣습니다 (아래 [카드 문자 자동 입력](#카드-문자-자동-입력) 참고).
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

같은 코드로 가계부 세 개를 만듭니다. 데이터는 완전히 따로 저장됩니다.

| 가계부 | 주소 | Supabase 테이블 |
|---|---|---|
| 내 가계부 (혼자) | https://ziro0914.github.io/myMoney/ | `personal_transactions`, `personal_rules`, `personal_budgets` |
| 우리집 가계부 (부부) | https://ziro0914.github.io/myMoney/family/ | `transactions`, `rules`, `budgets` |
| 새라 가계부 (혼자) | https://ziro0914.github.io/myMoney/saera/ | `personal_*` 테이블에서 `owner = 'saera'` (내 가계부는 `owner = 'me'`) |

`main`에 올라오면 GitHub Actions(`.github/workflows/deploy.yml`)가 테스트 후 모두 배포합니다. 빌드할 때 `VITE_BOOK=personal`이면 개인용, `saera`면 새라용, 아니면 가족용이 됩니다 (`src/book.ts`). 로컬에서는 `npm run dev`(가족), `npm run dev:personal`(개인), `npm run dev:saera`(새라).

## 가족과 함께 쓰기 (Supabase, 무료)

설정 전에는 폰마다 따로 저장됩니다. 두 사람이 같은 가계부를 보려면:

1. [supabase.com](https://supabase.com)에서 프로젝트를 만듭니다 (Region: Northeast Asia (Seoul)).
2. **SQL Editor**에서 `supabase/schema.sql`(가족), `supabase/personal.sql`(개인), `supabase/personal-owner.sql`(개인·새라 구분)을 차례로 실행합니다.
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

## 카드 문자 자동 입력

하나카드 승인 문자를 받으면 아이폰 **단축어** 자동화가 문자 내용을 서버 함수(`supabase/functions/add-card-sms`)로 보내고, 서버가 읽어서 지출로 저장합니다. AI를 쓰지 않아 요금이 들지 않습니다. 취소 문자는 돌려받은 돈(+)으로, 광고 문자는 건너뜁니다. 같은 거래를 캡처로 또 올리면 중복으로 표시됩니다.

### 1. 서버 함수 올리기 (한 번만)

```bash
# 단축어만 알고 있는 비밀 값. 출력된 값을 적어 두었다가 단축어에 넣습니다.
TOKEN=$(openssl rand -hex 16); echo $TOKEN
npx supabase secrets set SMS_TOKEN=$TOKEN --project-ref <프로젝트 ref>
npx supabase functions deploy add-card-sms --no-verify-jwt --project-ref <프로젝트 ref>
```

`--no-verify-jwt`는 단축어가 Supabase 키 없이 부르게 하려는 것이고, 대신 `SMS_TOKEN`이 맞아야만 저장됩니다.

### 2. 아이폰 단축어 만들기

1. **단축어** 앱 → **자동화** → **+** → **메시지**
2. **메시지에 포함**: `누적` (하나카드 승인·취소 문자에만 있는 말), 필요하면 **보낸 사람**에 1800-1111 연락처도 지정 → **즉시 실행** 선택 → 다음
3. 동작 **URL 콘텐츠 가져오기** 추가
   - URL: `https://<프로젝트 ref>.supabase.co/functions/v1/add-card-sms`
   - 방법: **POST**, 요청 본문: **JSON**
   - `text` (텍스트): 변수 **단축어 입력** (메시지 내용)
   - `book` (텍스트): `family`(우리집 가계부), `personal`(내 가계부), `saera`(새라 가계부) 중 하나
   - `token` (텍스트): 위에서 정한 `SMS_TOKEN` 값
4. (선택) 동작 **사전 값 가져오기**로 `message`를 꺼내 **알림 보기**에 넣으면 "우리집 가계부에 넣었어요: 국민카메라 200,000원 (미분류)"처럼 알려 줍니다.

가맹점 분류는 가계부의 분류 규칙을 그대로 씁니다. 처음 보는 가맹점은 미분류로 들어가니, 내역에서 분류를 한 번 바꿔 두면 다음부터 그 분류로 들어갑니다.

## 구조

```
src/
  screenshot.ts      캡처 줄이기·자르기, 인식 결과를 내역으로 바꾸기
  screenshotAi.ts    캡처 인식 서버 함수 호출
  importer.ts        파일 읽기, 헤더 찾기, 금액·날짜 해석, 중복 키
  categories.ts      지금 가계부의 분류 목록 (본체는 supabase/functions/_shared/categories.ts)
  book.ts            어떤 가계부(개인/가족/새라)로 빌드할지
  budget.ts          월별 예산 계산 (이전 달 예산 이어 쓰기)
  store/             저장소 (localRepo: 브라우저, supabaseRepo: 가족 공유)
  useLedger.ts       화면에서 쓰는 데이터와 동작
  members.ts         사용자 이름 목록
  views/             홈, 내역, 가져오기, 설정, 사용자 선택 화면
supabase/schema.sql  DB 테이블과 접근 권한
supabase/functions/  캡처 인식(parse-screenshot), 카드 문자 저장(add-card-sms), 둘이 같이 쓰는 코드(_shared)
```
