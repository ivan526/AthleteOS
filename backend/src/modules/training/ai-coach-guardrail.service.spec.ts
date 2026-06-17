import { AiCoachGuardrailService } from './ai-coach-guardrail.service';

describe('AiCoachGuardrailService', () => {
  const service = new AiCoachGuardrailService();

  it('keeps safe explanation text', () => {
    const result = service.evaluate('今天建议轻松跑，重点控制强度并观察恢复。', {
      fallbackText: '规则解释',
    });

    expect(result.filtered).toBe(false);
    expect(result.text).toContain('轻松跑');
  });

  it('blocks medical diagnosis', () => {
    const result = service.evaluate('你肯定是膝关节炎，不用看医生。', {
      fallbackText: '请停止训练并咨询专业医生。',
      painReported: true,
    });

    expect(result.filtered).toBe(true);
    expect(result.reasons).toContain('medical_diagnosis_or_advice');
    expect(result.text).toBe('请停止训练并咨询专业医生。');
  });

  it('blocks hard safety override', () => {
    const result = service.evaluate('可以继续进行高强度间歇训练。', {
      fallbackText: '今天执行恢复训练。',
      hardSafetyTriggered: true,
    });

    expect(result.filtered).toBe(true);
    expect(result.reasons).toContain('hard_safety_override');
    expect(result.text).toBe('今天执行恢复训练。');
  });

  it('adds medical safety language when pain is reported', () => {
    const result = service.evaluate('今天改为休息并观察疼痛变化。', {
      fallbackText: '今天休息。',
      painReported: true,
    });

    expect(result.filtered).toBe(false);
    expect(result.text).toContain('咨询专业医生');
  });
});
