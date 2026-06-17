#!/usr/bin/env python3
import json
import os
import sys
from datetime import date, datetime, timedelta


def fail(message, details=None):
    print(json.dumps({"success": False, "error": message, "details": details}, ensure_ascii=False))
    sys.exit(1)


try:
    from garminconnect import Garmin
except Exception as exc:
    fail(
        "Garmin Connect 依赖未安装，请在 backend 目录执行 pip install -r requirements.txt",
        str(exc),
    )


def parse_day(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except Exception:
        fail(f"日期格式无效: {value}")


def daterange(start_day, end_day):
    current = start_day
    while current <= end_day:
        yield current
        current += timedelta(days=1)


def score_from_garmin(summary):
    if not summary:
        return None

    hrv_ms = summary.get("lastNightAvg") or summary.get("lastNight") or summary.get("weeklyAvg")
    if hrv_ms is None:
        return None

    baseline = summary.get("baseline") or {}
    balanced_low = baseline.get("balancedLow")
    balanced_upper = baseline.get("balancedUpper")
    low_upper = baseline.get("lowUpper")

    if balanced_low is not None and balanced_upper is not None:
        if low_upper is not None and hrv_ms < low_upper:
            return 35
        if hrv_ms < balanced_low:
            return 55
        if hrv_ms <= balanced_upper:
            return 82
        return 88

    if hrv_ms >= 55:
        return 85
    if hrv_ms >= 45:
        return 75
    if hrv_ms >= 35:
        return 65
    if hrv_ms >= 25:
        return 50
    return 35


def main():
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    mfa_code = os.environ.get("GARMIN_MFA_CODE")
    tokenstore = os.environ.get("GARMIN_TOKENSTORE")
    oldest = parse_day(os.environ.get("GARMIN_OLDEST", (date.today() - timedelta(days=30)).isoformat()))
    newest = parse_day(os.environ.get("GARMIN_NEWEST", date.today().isoformat()))

    if not email or not password:
        fail("缺少 Garmin 邮箱或密码")

    if tokenstore:
        os.makedirs(tokenstore, exist_ok=True)

    def prompt_mfa():
        if mfa_code:
            return mfa_code
        raise RuntimeError("Garmin 需要 MFA 验证码，请在设置页填写后重试")

    client = Garmin(email, password, prompt_mfa=prompt_mfa)
    try:
        client.login(tokenstore)
    except Exception as exc:
        fail("Garmin 登录失败", str(exc))

    records = []
    fetched_days = 0
    for day in daterange(oldest, newest):
        try:
            payload = client.get_hrv_data(day.isoformat())
            fetched_days += 1
        except Exception as exc:
            records.append({
                "date": day.isoformat(),
                "error": str(exc),
            })
            continue

        summary = (payload or {}).get("hrvSummary") or {}
        hrv_ms = summary.get("lastNightAvg") or summary.get("lastNight") or summary.get("weeklyAvg")
        hrv_score = score_from_garmin(summary)
        if hrv_score is None:
            continue

        records.append({
            "date": summary.get("calendarDate") or day.isoformat(),
            "hrvScore": hrv_score,
            "hrvMs": hrv_ms,
            "status": summary.get("status"),
            "feedbackPhrase": summary.get("feedbackPhrase"),
            "baseline": summary.get("baseline"),
            "raw": summary,
        })

    print(json.dumps({
        "success": True,
        "fetchedDays": fetched_days,
        "hrvDays": len([record for record in records if record.get("hrvScore") is not None]),
        "records": records,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
