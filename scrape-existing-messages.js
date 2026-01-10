// Citadel POW Discord Bot
// 기존 메시지 스크래핑 스크립트 (일회성 실행)

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// 환경 변수
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const POW_CHANNEL_ID = process.env.POW_CHANNEL_ID;
const BACKEND_API_URL = process.env.BACKEND_API_URL;

if (!DISCORD_BOT_TOKEN || !POW_CHANNEL_ID || !BACKEND_API_URL) {
  console.error('❌ 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
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

function getTotalReactionCount(message) {
  return message.reactions.cache.reduce((sum, reaction) => sum + reaction.count, 0);
}

function getReactionDetails(message) {
  const reactions = {};
  message.reactions.cache.forEach((reaction) => {
    reactions[reaction.emoji.name] = reaction.count;
  });
  return reactions;
}

/**
 * 메시지가 POW 인증카드인지 확인
 * (Webhook으로 보낸 메시지 또는 이미지 첨부가 있는 메시지)
 */
function isPOWMessage(message) {
  // Webhook으로 보낸 메시지
  if (message.webhookId) return true;

  // 이미지 첨부가 있는 메시지
  if (message.attachments.size > 0) {
    const hasImage = message.attachments.some(att =>
      att.contentType && att.contentType.startsWith('image/')
    );
    if (hasImage) return true;
  }

  // Embed가 있는 메시지
  if (message.embeds.length > 0) {
    const hasImage = message.embeds.some(embed => embed.image || embed.thumbnail);
    if (hasImage) return true;
  }

  return false;
}

/**
 * 메시지 내용에서 POW 정보 추출
 */
function extractPOWInfo(message) {
  const content = message.content || '';

  // plan_text 추출 (예: "오늘의 목표: ...")
  let planText = null;
  const planMatch = content.match(/목표[:\s]*(.+?)(?:\n|$)/i);
  if (planMatch) {
    planText = planMatch[1].trim();
  }

  // donation_mode 추출
  let donationMode = 'pow-writing'; // 기본값
  if (content.includes('글쓰기') || content.includes('Writing')) donationMode = 'pow-writing';
  else if (content.includes('음악') || content.includes('Music')) donationMode = 'pow-music';
  else if (content.includes('공부') || content.includes('Study')) donationMode = 'pow-study';
  else if (content.includes('그림') || content.includes('Art')) donationMode = 'pow-art';
  else if (content.includes('독서') || content.includes('Reading')) donationMode = 'pow-reading';
  else if (content.includes('봉사') || content.includes('Service')) donationMode = 'pow-service';

  // photo_url 추출
  let photoUrl = null;
  if (message.attachments.size > 0) {
    const imageAttachment = message.attachments.find(att =>
      att.contentType && att.contentType.startsWith('image/')
    );
    if (imageAttachment) {
      photoUrl = imageAttachment.url;
    }
  } else if (message.embeds.length > 0) {
    const embedWithImage = message.embeds.find(embed => embed.image);
    if (embedWithImage) {
      photoUrl = embedWithImage.image.url;
    }
  }

  // discord_id 추출 (mention에서)
  let discordId = null;
  const mentionMatch = content.match(/<@!?(\d+)>/);
  if (mentionMatch) {
    discordId = mentionMatch[1];
  }

  return {
    planText,
    donationMode,
    photoUrl,
    discordId,
  };
}

/**
 * 백엔드 API에 Discord 게시물 등록
 */
async function registerDiscordPost(messageId, channelId, powInfo) {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/discord-posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: messageId,
        channel_id: channelId,
        discord_id: powInfo.discordId,
        photo_url: powInfo.photoUrl,
        plan_text: powInfo.planText,
        donation_mode: powInfo.donationMode,
      }),
    });

    if (response.ok) {
      return true;
    } else {
      const data = await response.json();
      // 이미 존재하는 메시지는 무시
      if (response.status === 409 || (data.error && data.error.includes('unique'))) {
        return 'exists';
      }
      console.error(`  ❌ 등록 실패:`, data.error);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ API 호출 실패:`, error.message);
    return false;
  }
}

/**
 * 백엔드 API에 반응 수 업데이트
 */
async function updateReactions(messageId, reactionCount, reactions) {
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

    if (response.ok) {
      return true;
    } else {
      const data = await response.json();
      console.error(`  ❌ 반응 업데이트 실패:`, data.error);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ API 호출 실패:`, error.message);
    return false;
  }
}

// ============================================
// 메인 스크래핑 로직
// ============================================

client.once('ready', async () => {
  console.log(`✅ Discord Bot 로그인 성공: ${client.user.tag}`);
  console.log(`📺 스크래핑 채널: ${POW_CHANNEL_ID}`);
  console.log('');

  try {
    const channel = await client.channels.fetch(POW_CHANNEL_ID);

    if (!channel) {
      console.error('❌ 채널을 찾을 수 없습니다.');
      process.exit(1);
    }

    console.log(`📥 채널 "${channel.name}"에서 메시지 가져오는 중...`);
    console.log('');

    let allMessages = [];
    let lastMessageId = null;
    const limit = 100; // 한 번에 가져올 메시지 수

    // 최대 500개 메시지 가져오기 (5번 반복)
    for (let i = 0; i < 5; i++) {
      const options = { limit };
      if (lastMessageId) {
        options.before = lastMessageId;
      }

      const messages = await channel.messages.fetch(options);

      if (messages.size === 0) {
        break;
      }

      allMessages = allMessages.concat(Array.from(messages.values()));
      lastMessageId = messages.last().id;

      console.log(`  📄 ${messages.size}개 메시지 가져옴 (총 ${allMessages.length}개)`);

      // Rate limit 방지
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('');
    console.log(`📊 총 ${allMessages.length}개 메시지 수집 완료`);
    console.log('');

    // POW 메시지 필터링
    const powMessages = allMessages.filter(isPOWMessage);
    console.log(`🎯 POW 인증 메시지: ${powMessages.length}개`);
    console.log('');

    // 각 메시지 처리
    let registered = 0;
    let updated = 0;
    let existed = 0;
    let failed = 0;

    for (const message of powMessages) {
      const messageId = message.id;
      const powInfo = extractPOWInfo(message);
      const reactionCount = getTotalReactionCount(message);
      const reactions = getReactionDetails(message);

      console.log(`📝 처리 중: ${messageId} (반응: ${reactionCount}개)`);

      // 1. Discord 게시물 등록 시도
      const registerResult = await registerDiscordPost(messageId, channel.id, powInfo);

      if (registerResult === true) {
        registered++;
        console.log(`  ✅ 등록 성공`);
      } else if (registerResult === 'exists') {
        existed++;
        console.log(`  ℹ️  이미 존재함`);
      } else {
        failed++;
        console.log(`  ❌ 등록 실패`);
        continue; // 등록 실패하면 반응 업데이트도 건너뜀
      }

      // 2. 반응 수 업데이트
      if (reactionCount > 0) {
        const updateResult = await updateReactions(messageId, reactionCount, reactions);
        if (updateResult) {
          updated++;
          console.log(`  ✅ 반응 업데이트 성공`);
        }
      }

      console.log('');

      // Rate limit 방지
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🎉 스크래핑 완료!');
    console.log('═══════════════════════════════════════');
    console.log(`📊 총 메시지: ${allMessages.length}개`);
    console.log(`🎯 POW 메시지: ${powMessages.length}개`);
    console.log(`✅ 신규 등록: ${registered}개`);
    console.log(`ℹ️  기존 존재: ${existed}개`);
    console.log(`🔄 반응 업데이트: ${updated}개`);
    console.log(`❌ 실패: ${failed}개`);
    console.log('═══════════════════════════════════════');

  } catch (error) {
    console.error('❌ 스크래핑 중 에러:', error);
  } finally {
    console.log('');
    console.log('👋 Bot 종료 중...');
    client.destroy();
    process.exit(0);
  }
});

// 에러 핸들링
client.on('error', (error) => {
  console.error('❌ Discord 클라이언트 에러:', error);
});

// Bot 로그인
client.login(DISCORD_BOT_TOKEN);
