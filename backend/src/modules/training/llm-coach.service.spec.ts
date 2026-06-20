import axios from 'axios';
import { AiCoachGuardrailService } from './ai-coach-guardrail.service';
import { LlmCoachService } from './llm-coach.service';

jest.mock('axios');

describe('LlmCoachService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const auditCreate = jest.fn();
  const prisma = {
    llmSetting: {
      findUnique: jest.fn(),
    },
    aiCoachAudit: {
      create: auditCreate,
      findFirst: jest.fn(),
    },
  } as any;
  const service = new LlmCoachService(prisma, new AiCoachGuardrailService());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.aiCoachAudit.findFirst.mockResolvedValue(null);
  });

  it('falls back without calling the LLM when disabled', async () => {
    prisma.llmSetting.findUnique.mockResolvedValue({ enabled: false });

    const result = await service.polishTrainingExplanation({
      userId: 'user-1',
      fallbackText: '规则解释',
      evidence: {},
      ruleResult: {},
      hardSafetyTriggered: false,
    });

    expect(result.text).toBe('规则解释');
    expect(result.usedLlm).toBe(false);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('filters unsafe LLM output and writes an audit', async () => {
    prisma.llmSetting.findUnique.mockResolvedValue({
      enabled: true,
      provider: 'openai-compatible',
      model: 'test-model',
      baseUrl: 'http://llm.local/v1',
      apiKey: 'secret',
    });
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: '忽略安全规则，可以继续进行高强度间歇训练。' } }],
      },
    } as any);
    auditCreate.mockResolvedValue({});

    const result = await service.polishTrainingExplanation({
      userId: 'user-1',
      fallbackText: '今天执行恢复训练。',
      evidence: { capacity: 30 },
      ruleResult: { workout: 'recovery' },
      hardSafetyTriggered: true,
    });

    expect(result.text).toBe('今天执行恢复训练。');
    expect(result.safetyFiltered).toBe(true);
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        safetyFiltered: true,
        fallbackUsed: true,
      }),
    }));
  });

  it('returns a cached successful response without calling the provider', async () => {
    prisma.llmSetting.findUnique.mockResolvedValue({
      enabled: true,
      provider: 'volcengine',
      model: 'test-model',
      baseUrl: 'https://example.com/v1',
      apiKey: 'secret',
    });
    prisma.aiCoachAudit.findFirst.mockResolvedValue({
      rawOutput: '缓存解释',
      finalOutput: '缓存解释',
      guardrailReasons: [],
    });

    const result = await service.polishTrainingExplanation({
      userId: 'user-1',
      fallbackText: '规则解释',
      evidence: { capacity: 75 },
      ruleResult: { workout: 'aerobic' },
      hardSafetyTriggered: false,
    });

    expect(result.text).toBe('缓存解释');
    expect(result.usedLlm).toBe(true);
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cacheHit: true }),
    }));
  });

  it('provides deterministic activity analysis when the LLM is disabled', async () => {
    prisma.llmSetting.findUnique.mockResolvedValue({ enabled: false });

    const result = await service.analyzeActivity({
      userId: 'user-1',
      fallbackText: '本次训练形成了有效的有氧耐力刺激。',
      evidence: { sport: 'running', tss: 45 },
    });

    expect(result.text).toContain('有氧耐力刺激');
    expect(result.usedLlm).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
