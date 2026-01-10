// Citadel POW Discord Bot
// 실시간 반응 모니터링 및 백엔드 API 연동

require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');

// 환경 변수
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const POW_CHANNEL_ID = process.env.POW_CHANNEL_ID;
const BACKEND_API_URL = process.env.BACKEND_API_URL;

if (!DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN이 설정되지 않았습니다.');
  process.exit(1);
}

if (!POW_CHANNEL_ID) {
  console.error('❌ POW_CHANNEL_ID가 설정되지 않았습니다.');
  process.exit(1);
}

// Discord Client 생성
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 메시지의 총 반응 수 계산
 */
function getTotalReactionCount(message) {
  return message.reactions.cache.reduce((sum, reaction) => sum + reaction.count, 0);
}

/**
 * 메시지의 반응 상세 정보 (이모지별 카운트)
 */
function getReactionDetails(message) {
  const reactions = {};
  message.reactions.cache.forEach((reaction) => {
    reactions[reaction.emoji.name] = reaction.count;
  });
  return reactions;
}

/**
 * 백엔드 API에 반응 수 업데이트
 */
async function updateReactionsInBackend(messageId, reactionCount, reactions) {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/discord-posts/reactions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: messageId,
        reaction_count: reactionCount,
        reactions: reactions,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error(`❌ API 업데이트 실패 (${messageId}):`, data.error);
      return false;
    }

    const data = await response.json();
    console.log(`✅ 반응 업데이트 성공: ${messageId} (${reactionCount}개)`);
    return true;
  } catch (error) {
    console.error(`❌ API 호출 실패 (${messageId}):`, error.message);
    return false;
  }
}

// ============================================
// Discord 이벤트 핸들러
// ============================================

/**
 * Bot 준비 완료
 */
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Discord Bot 로그인 성공: ${c.user.tag}`);
  console.log(`📺 모니터링 채널: ${POW_CHANNEL_ID}`);
  console.log(`🔗 백엔드 API: ${BACKEND_API_URL}`);
  console.log('');
  console.log('👀 실시간 반응 모니터링 시작...');
});

/**
 * 반응 추가 이벤트
 */
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  // 봇 자신의 반응은 무시
  if (user.bot) return;

  // 부분적으로 로드된 메시지는 완전히 가져오기
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('메시지 fetch 실패:', error);
      return;
    }
  }

  // POW 채널의 메시지만 처리
  if (reaction.message.channelId !== POW_CHANNEL_ID) {
    return;
  }

  const messageId = reaction.message.id;
  const reactionCount = getTotalReactionCount(reaction.message);
  const reactions = getReactionDetails(reaction.message);

  console.log(`➕ 반응 추가: ${user.username} → ${reaction.emoji.name} (메시지: ${messageId})`);

  await updateReactionsInBackend(messageId, reactionCount, reactions);
});

/**
 * 반응 제거 이벤트
 */
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  // 봇 자신의 반응은 무시
  if (user.bot) return;

  // 부분적으로 로드된 메시지는 완전히 가져오기
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('메시지 fetch 실패:', error);
      return;
    }
  }

  // POW 채널의 메시지만 처리
  if (reaction.message.channelId !== POW_CHANNEL_ID) {
    return;
  }

  const messageId = reaction.message.id;
  const reactionCount = getTotalReactionCount(reaction.message);
  const reactions = getReactionDetails(reaction.message);

  console.log(`➖ 반응 제거: ${user.username} → ${reaction.emoji.name} (메시지: ${messageId})`);

  await updateReactionsInBackend(messageId, reactionCount, reactions);
});

/**
 * 반응 모두 제거 이벤트
 */
client.on(Events.MessageReactionRemoveAll, async (message) => {
  // POW 채널의 메시지만 처리
  if (message.channelId !== POW_CHANNEL_ID) {
    return;
  }

  console.log(`🗑️ 모든 반응 제거: 메시지 ${message.id}`);

  await updateReactionsInBackend(message.id, 0, {});
});

/**
 * 에러 핸들링
 */
client.on(Events.Error, (error) => {
  console.error('❌ Discord 클라이언트 에러:', error);
});

// ============================================
// Bot 로그인
// ============================================

client.login(DISCORD_BOT_TOKEN);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Bot 종료 중...');
  client.destroy();
  process.exit(0);
});
