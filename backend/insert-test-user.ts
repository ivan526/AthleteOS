import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 创建测试用户
  const user = await prisma.user.upsert({
    where: { id: 'b23d32aa-870a-449e-8572-b1fccd8c00e0' },
    update: {},
    create: {
      id: 'b23d32aa-870a-449e-8572-b1fccd8c00e0',
      email: 'test@example.com',
      name: '测试用户',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('测试用户ID:', user.id);

  // 创建运动员档案
  const profile = await prisma.athleteProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      primarySport: 'running',
      weeklyAvailableDays: 5,
      preferredSports: JSON.stringify(['running', 'cycling']),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('运动员档案创建完成');

  // 创建Intervals.icu连接账户，使用真实凭证
  const connectedAccount = await prisma.connectedAccount.upsert({
    where: {
      userId_provider: {
        userId: user.id,
        provider: 'intervals.icu',
      },
    },
    update: {
      athleteId: 'i212288',
      apiKey: '1gzdnhjs6ya48kx0zgb3m22ap',
      syncStatus: 'idle',
      syncMessage: '等待同步',
      lastSyncAt: null,
    },
    create: {
      userId: user.id,
      provider: 'intervals.icu',
      athleteId: 'i212288',
      apiKey: '1gzdnhjs6ya48kx0zgb3m22ap',
      syncStatus: 'idle',
      syncMessage: '等待同步',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('Intervals.icu连接账户创建完成，ID:', connectedAccount.id);
  console.log('运动员ID:', connectedAccount.athleteId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
