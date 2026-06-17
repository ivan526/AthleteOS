#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3007}"

node <<'NODE'
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3007';

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path} returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${text}`);
  }
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const results = [];

async function scenario(id, name, fn) {
  try {
    const details = await fn();
    results.push({ id, name, passed: true, details });
  } catch (error) {
    results.push({ id, name, passed: false, error: error.message });
  }
}

await scenario('25.1/31.1', 'Today 页面契约', async () => {
  const today = await request('/api/today');
  assert(today.training_capacity?.score >= 0 && today.training_capacity.score <= 100, 'Training Capacity must be 0-100');
  assert(today.training_capacity?.status, 'capacity_status missing');
  assert(today.training_capacity?.confidence !== undefined, 'confidence missing');
  assert(today.training_capacity?.data_quality, 'data_quality missing');
  assert(today.training_risk?.level && today.training_risk?.label, 'training risk missing');
  assert(today.recommendation?.title, 'recommendation title missing');
  assert(today.recommendation?.duration_minutes > 0, 'duration missing');
  assert(today.recommendation?.expected_tss >= 0, 'expected_tss missing');
  assert(today.explanation?.reasons?.length >= 3, 'needs at least 3 explanation reasons');
  assert(today.feedback_options?.includes('too_tired'), 'too_tired feedback missing');
  return { capacity: today.training_capacity.score, recommendation: today.recommendation.title };
});

await scenario('25.2/25.3/25.4/25.5/25.8/25.9', '算法边界与硬安全规则', async () => {
  const result = await request('/api/test/prd-acceptance');
  assert(result.passed, `algorithm acceptance failed: ${JSON.stringify(result.scenarios)}`);
  return result.scenarios.map((item) => ({ id: item.id, passed: item.passed }));
});

await scenario('25.6', '用户反馈：太累了', async () => {
  const today = await request('/api/today');
  const feedback = await request('/api/today/feedback', {
    method: 'POST',
    body: JSON.stringify({
      recommendation_id: today.recommendation.id,
      feedback_type: 'too_tired',
      subjective_fatigue: 8,
    }),
  });
  assert(feedback.adjusted === true, 'feedback should adjust recommendation');
  assert(['easy_run', 'recovery_run', 'mobility'].includes(feedback.new_recommendation.type), 'too_tired should reduce workout type');
  assert(feedback.new_recommendation.duration_minutes <= today.recommendation.duration_minutes, 'duration should decrease');
  assert(feedback.new_recommendation.expected_tss <= today.recommendation.expected_tss, 'TSS should decrease');
  const structureText = JSON.stringify(feedback.new_recommendation.structure);
  assert(!/(阈值|间歇|冲刺|高强度)/.test(structureText), 'reduced workout structure must not keep hard intensity blocks');
  return feedback.new_recommendation;
});

await scenario('25.7/24.2', '用户反馈：疼痛或不适', async () => {
  const today = await request('/api/today');
  const feedback = await request('/api/today/feedback', {
    method: 'POST',
    body: JSON.stringify({
      recommendation_id: today.recommendation.id,
      feedback_type: 'pain_or_discomfort',
      pain: true,
      pain_area: 'left knee',
    }),
  });
  assert(feedback.adjusted === true, 'pain feedback should adjust recommendation');
  assert(['mobility', 'recovery_run', 'recovery_ride'].includes(feedback.new_recommendation.type), 'pain should force recovery/mobility');
  assert(feedback.reason.includes('医生') || feedback.reason.includes('专业'), 'pain feedback must include medical safety language');
  return feedback.new_recommendation;
});

await scenario('25.4/25.5 data API', '历史、周报、模型覆盖数据', async () => {
  const activities = await request('/api/activities?limit=5');
  const history = await request('/api/history/summary');
  const weekly = await request('/api/weekly-review/latest');
  const coverage = await request('/api/model/data-coverage');
  assert(Array.isArray(activities), 'activities must be array');
  assert(typeof history.weeklyTss === 'number', 'history summary must use numeric weeklyTss');
  assert(Array.isArray(history.fourWeekTrend), 'fourWeekTrend missing');
  assert(typeof weekly.weeklyTss === 'number', 'weekly review missing');
  assert(Array.isArray(coverage.available) && Array.isArray(coverage.missing), 'coverage must list available and missing data');
  return {
    activities: activities.length,
    weeklyTss: history.weeklyTss,
    dataLevel: coverage.dataLevel,
    missing: coverage.missing,
  };
});

await scenario('AI Coach P0', 'AI Coach 边界、问答和分析契约', async () => {
  const today = await request('/api/today');
  const weekly = await request('/api/weekly-review/latest');
  const answer = await request('/api/ai-coach/ask', {
    method: 'POST',
    body: JSON.stringify({ question: '为什么今天这样安排？' }),
  });
  assert(typeof today.explanation?.simple === 'string' && today.explanation.simple.length > 0, 'training explanation missing');
  assert(typeof weekly.aiCoachSummary === 'string' && weekly.aiCoachSummary.length > 0, 'AI Coach weekly summary missing');
  assert(weekly.modelCoverage && weekly.recoveryTrend, 'training analysis context missing');
  assert(typeof answer.answer === 'string' && answer.answer.length > 0, 'AI Coach answer missing');
  assert(typeof answer.used_llm === 'boolean', 'AI Coach mode missing');
  assert(typeof answer.safety_filtered === 'boolean', 'AI Coach safety status missing');
  return {
    explanation: today.explanation.simple,
    weeklySummary: weekly.aiCoachSummary,
    usedLlm: answer.used_llm,
  };
});

const failed = results.filter((item) => !item.passed);
console.log(JSON.stringify({ passed: failed.length === 0, results }, null, 2));
if (failed.length) process.exit(1);
NODE
