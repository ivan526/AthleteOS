# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
你要跟我说中文。

## Project Overview
AthleteOS is an endurance training decision support tool for Chinese users. The MVP (v1.1) focuses on delivering clear, actionable daily training recommendations based on data from Intervals.icu API.

## Core Goals (MVP)
- Users can understand their daily training status, recommended workout, and adjustment options within 10 seconds of opening the app
- No social features, leaderboards, complex dashboards, or free-form AI chat in the MVP
- Data is explicitly sourced from Intervals.icu (no other integrations in MVP)
- Low-anxiety, professional, health-focused user experience

## Key Documentation
- UI design specification: [doc/ui-design.md](doc/ui-design.md) – complete design system, page structures, and component guidelines
- Intervals.icu API credentials: [doc/Intervals.icu 访问凭证.md](doc/Intervals.icu%20访问凭证.md) – API keys and endpoint documentation

## Design System Rules (Non-negotiable for MVP)
1. **Language**: Chinese-first UI, only retain English for standardized terms (TSS, CTL, ATL, Intervals.icu, etc.)
2. **Color Scheme**:
   - Primary: #5BBE8A (light green)
   - Dark primary: #2F8F64
   - Background: #F4FAF7 (light green-white)
   - Blue only used for Intervals.icu branding, sync status, and data source indicators
   - Red only used for small-area risk prompts (no large warning areas)
3. **Navigation**: 4 bottom tabs only: 今日 (Today), 历史 (History), 复盘 (Review), 设置 (Settings)
4. **Homepage (今日训练)**:
   - Single main metric: "今日训练能力" (training_capacity)
   - No multiple competing metrics on homepage
   - Clear feedback entry for user state changes (太累了, 只有30分钟, etc.)
5. **Risk Expression**:
   - Never show "受伤概率 xx%" (injury probability) or medical diagnoses
   - Use standardized risk levels: 训练风险较低 / 训练风险略有上升 / 训练风险偏高 / 建议恢复优先
6. **Data Sourcing**:
   - MVP only integrates with Intervals.icu API
   - Explicitly label all data as from Intervals.icu
   - For unimplemented features (sleep/HRV sync), show "暂未接入" (not yet available) instead of "同步中" (syncing)

## API Information (Intervals.icu)
- Base URL: `https://intervals.icu/api/v1/`
- Auth: Basic Auth with username = "API_KEY", password = `1gzdnhjs6ya48kx0zgb3m22ap`
- Required headers: `Accept: application/json`, `User-Agent: Mozilla/5.0`
- Key endpoints:
  - User info: `GET /athlete/0`
  - Activities: `GET /athlete/i212288/activities`
  - Wellness data: `GET /athlete/i212288/wellness`

## MVP Development Priority
1. First build UI with mock data (mock structure provided in [doc/ui-design.md](doc/ui-design.md#142-ui-%E5%85%88%E7%94%A8-mock-%E6%95%B0%E6%8D%AE))
2. Implement core interactions and page flows
3. Integrate with Intervals.icu API after UI is complete

## Prohibited Features (MVP)
Do not implement any of the following in the MVP phase:
- Social features, communities, leaderboards
- Garmin/Apple Health/Strava/Coros/Whoop/Oura API integrations
- Free-form AI chat functionality
- Complex dashboards with multiple competing metrics
- E-commerce/mall features
- "Dashboard" terminology (homepage is "今日训练")

## Current Repository State
This repository currently contains only documentation. No codebase has been initialized yet.