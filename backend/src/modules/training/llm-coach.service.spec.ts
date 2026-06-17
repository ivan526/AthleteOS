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
    },
  } as any;
  const service = new LlmCoachService(prisma, new AiCoachGuardrailService());

  beforeEach(() => {
    jest.clearAllMocks();
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
});
