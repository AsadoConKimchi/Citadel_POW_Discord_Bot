# Citadel POW Discord Bot

Discord 채널의 POW 인증 메시지 반응 수를 수집하여 백엔드 API에 전송하는 Bot입니다.

## 기능

- ✅ 기존 메시지 스크래핑 (일회성)
- ✅ 실시간 반응 모니터링 (지속적)
- ✅ 백엔드 API 연동 (`discord_posts` 테이블 업데이트)

---

## 1단계: Discord Bot 생성

### 1. Discord Developer Portal 접속
https://discord.com/developers/applications

### 2. New Application 생성
- **Application Name**: `Citadel POW Bot`
- Create 클릭

### 3. Bot 추가
- 좌측 메뉴에서 **Bot** 클릭
- **Add Bot** 클릭
- **Yes, do it!** 클릭

### 4. Bot Token 복사
- **Reset Token** 클릭
- 생성된 Token을 복사 (⚠️ 한 번만 표시됨!)
- 안전한 곳에 저장

### 5. Bot 권한 설정
- **Privileged Gateway Intents** 섹션에서 다음 활성화:
  - ✅ **MESSAGE CONTENT INTENT**
  - ✅ **SERVER MEMBERS INTENT**
  - ✅ **PRESENCE INTENT**

### 6. OAuth2 URL 생성
- 좌측 메뉴에서 **OAuth2** > **URL Generator** 클릭
- **SCOPES** 선택:
  - ✅ `bot`
- **BOT PERMISSIONS** 선택:
  - ✅ `Read Messages/View Channels`
  - ✅ `Read Message History`
  - ✅ `Add Reactions`

### 7. Bot을 Discord 서버에 초대
- 하단에 생성된 URL 복사
- 브라우저에서 URL 열기
- 서버 선택 후 **Authorize** 클릭

---

## 2단계: 채널 ID 확인

### Discord 개발자 모드 활성화
1. Discord 설정 > 고급 > **개발자 모드** 활성화

### 채널 ID 복사
1. POW 인증 채널에서 우클릭
2. **ID 복사** 클릭
3. 복사한 ID 저장 (예: `1330845896931319949`)

---

## 3단계: Bot 설정 및 실행

### 1. 패키지 설치
```bash
cd /Users/jinito/Citadel_POW_Discord_Bot
npm install
```

### 2. 환경 변수 설정
`.env` 파일 생성:

```bash
cp .env.example .env
```

`.env` 파일 편집:
```env
DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
POW_CHANNEL_ID=1330845896931319949
BACKEND_API_URL=https://citadel-pow-backend.magadenuevo2025.workers.dev
```

---

## 4단계: 기존 메시지 스크래핑 (일회성)

첫 실행 시 기존 메시지를 수집합니다:

```bash
npm run scrape
```

**실행 결과:**
- 최근 500개 메시지 스캔
- POW 인증 메시지 필터링
- `discord_posts` 테이블에 저장
- 반응 수 업데이트

**예상 출력:**
```
✅ Discord Bot 로그인 성공: Citadel POW Bot#1234
📺 스크래핑 채널: 1330845896931319949

📥 채널 "pow-certification"에서 메시지 가져오는 중...
  📄 100개 메시지 가져옴 (총 100개)
  📄 100개 메시지 가져옴 (총 200개)

📊 총 235개 메시지 수집 완료
🎯 POW 인증 메시지: 87개

📝 처리 중: 1234567890123456789 (반응: 15개)
  ✅ 등록 성공
  ✅ 반응 업데이트 성공

═══════════════════════════════════════
🎉 스크래핑 완료!
═══════════════════════════════════════
📊 총 메시지: 235개
🎯 POW 메시지: 87개
✅ 신규 등록: 87개
ℹ️  기존 존재: 0개
🔄 반응 업데이트: 65개
❌ 실패: 0개
═══════════════════════════════════════
```

---

## 5단계: 실시간 모니터링 시작

Bot을 백그라운드로 실행:

```bash
npm start
```

**실행 결과:**
```
✅ Discord Bot 로그인 성공: Citadel POW Bot#1234
📺 모니터링 채널: 1330845896931319949
🔗 백엔드 API: https://citadel-pow-backend.magadenuevo2025.workers.dev

👀 실시간 반응 모니터링 시작...
```

이제 Discord 채널에서 누군가가 반응을 추가/제거하면 자동으로 업데이트됩니다:

```
➕ 반응 추가: JohnDoe → ❤️ (메시지: 1234567890123456789)
✅ 반응 업데이트 성공: 1234567890123456789 (16개)
```

---

## 6단계: 프로덕션 배포 (선택)

### PM2로 백그라운드 실행 (권장)

```bash
# PM2 설치
npm install -g pm2

# Bot 시작
pm2 start bot.js --name citadel-pow-bot

# 자동 재시작 설정
pm2 startup
pm2 save

# 로그 확인
pm2 logs citadel-pow-bot

# 상태 확인
pm2 status
```

### 또는 nohup으로 실행

```bash
nohup npm start > bot.log 2>&1 &
```

---

## 백엔드 API 엔드포인트

### 1. Discord 게시물 등록
```
POST /api/discord-posts
{
  "message_id": "1234567890",
  "channel_id": "1330845896931319949",
  "discord_id": "user_discord_id",
  "photo_url": "https://...",
  "plan_text": "오늘의 목표",
  "donation_mode": "pow-writing"
}
```

### 2. 반응 수 업데이트
```
PUT /api/discord-posts/reactions
{
  "message_id": "1234567890",
  "reaction_count": 15,
  "reactions": {
    "👍": 8,
    "❤️": 5,
    "🔥": 2
  }
}
```

---

## 문제 해결

### Bot이 메시지를 읽지 못함
- Discord Developer Portal에서 **MESSAGE CONTENT INTENT** 활성화 확인

### 채널을 찾을 수 없음
- 채널 ID가 올바른지 확인
- Bot이 해당 채널에 접근 권한이 있는지 확인

### API 호출 실패
- `BACKEND_API_URL`이 올바른지 확인
- 백엔드 서버가 실행 중인지 확인

### 반응이 업데이트되지 않음
- Bot이 실행 중인지 확인 (`pm2 status`)
- 로그 확인 (`pm2 logs citadel-pow-bot`)

---

## 개발 모드

nodemon으로 자동 재시작:

```bash
npm run dev
```

---

## 라이센스

MIT
