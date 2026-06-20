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

    hrv_ms = summary.get("lastNightAvg") or summary.get("lastNight")
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


def first_value(data, *keys):
    if not data:
        return None
    for key in keys:
        value = data.get(key)
        if value is not None:
            return value
    return None


def map_activity(activity):
    activity_type = activity.get("activityType") or {}
    type_value = activity_type.get("typeKey") or activity_type.get("parentTypeId")
    return {
        "id": str(activity.get("activityId")),
        "name": activity.get("activityName"),
        "type": str(type_value) if type_value is not None else None,
        "startTime": (
            activity.get("startTimeGMT")
            or activity.get("startTimeLocal")
            or activity.get("beginTimestamp")
        ),
        "durationSeconds": first_value(
            activity, "movingDuration", "duration", "elapsedDuration"
        ),
        "distanceMeters": activity.get("distance"),
        "avgHr": first_value(activity, "averageHR", "avgHR"),
        "maxHr": activity.get("maxHR"),
        "avgPower": first_value(activity, "avgPower", "averagePower"),
        "normalizedPower": first_value(activity, "normPower", "normalizedPower"),
        "avgCadence": first_value(
            activity,
            "averageBikingCadenceInRevPerMinute",
            "averageRunningCadenceInStepsPerMinute",
            "averageSwimCadenceInStrokesPerMinute",
        ),
        "avgSpeed": first_value(activity, "averageSpeed", "avgSpeed"),
        "maxSpeed": activity.get("maxSpeed"),
        "elevationGain": first_value(activity, "elevationGain", "totalElevationGain"),
        "calories": activity.get("calories"),
        "tss": first_value(activity, "trainingStressScore", "tss"),
        "trainingLoad": first_value(
            activity,
            "activityTrainingLoad",
            "trainingLoad",
        ),
        "aerobicTrainingEffect": activity.get("aerobicTrainingEffect"),
        "anaerobicTrainingEffect": activity.get("anaerobicTrainingEffect"),
        "raw": activity,
    }


def sleep_values(payload):
    daily = (payload or {}).get("dailySleepDTO") or {}
    scores = (payload or {}).get("sleepScores") or daily.get("sleepScores") or {}
    overall = scores.get("overall") or {}
    sleep_score = (
        first_value(overall, "value", "score")
        if isinstance(overall, dict)
        else overall
    )
    return {
        "sleepScore": sleep_score,
        "sleepSeconds": first_value(
            daily, "sleepTimeSeconds", "durationInSeconds"
        ),
        "sleepQuality": first_value(daily, "sleepQualityTypePK", "sleepQuality"),
        "raw": payload,
    }


def main():
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    mfa_code = os.environ.get("GARMIN_MFA_CODE")
    tokenstore = os.environ.get("GARMIN_TOKENSTORE")
    auth_domain = os.environ.get("GARMIN_AUTH_DOMAIN", "garmin.com").strip().lower()
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

    is_cn = auth_domain in {"garmin.cn", "cn", "china"}
    client = Garmin(email, password, is_cn=is_cn, prompt_mfa=prompt_mfa)
    try:
        client.login(tokenstore)
    except Exception as exc:
        fail("Garmin 登录失败", str(exc))

    try:
        activities = [
            map_activity(item)
            for item in client.get_activities_by_date(
                oldest.isoformat(), newest.isoformat(), sortorder="asc"
            )
            if item.get("activityId") is not None
        ]
    except Exception as exc:
        fail("Garmin 活动同步失败", str(exc))

    records = []
    wellness_records = []
    fetched_days = 0
    response_days = 0
    wellness_oldest = max(oldest, newest - timedelta(days=30))
    for day in daterange(wellness_oldest, newest):
        date_id = day.isoformat()
        wellness = {"date": date_id}
        try:
            payload = client.get_hrv_data(date_id)
            fetched_days += 1
        except Exception as exc:
            payload = None
            wellness["hrvError"] = str(exc)

        summary = (payload or {}).get("hrvSummary") or {}
        if payload:
            response_days += 1
        hrv_ms = summary.get("lastNightAvg") or summary.get("lastNight")
        hrv_score = score_from_garmin(summary)
        if hrv_score is not None:
            record = {
                "date": summary.get("calendarDate") or date_id,
                "hrvScore": hrv_score,
                "hrvMs": hrv_ms,
                "status": summary.get("status"),
                "feedbackPhrase": summary.get("feedbackPhrase"),
                "baseline": summary.get("baseline"),
                "raw": summary,
            }
            records.append(record)
            wellness.update(record)

        try:
            wellness.update(sleep_values(client.get_sleep_data(date_id)))
        except Exception as exc:
            wellness["sleepError"] = str(exc)

        try:
            heart_rates = client.get_heart_rates(date_id)
            wellness["restingHr"] = first_value(
                heart_rates, "restingHeartRate", "restingHR"
            )
            wellness["heartRateRaw"] = heart_rates
        except Exception as exc:
            wellness["heartRateError"] = str(exc)

        try:
            readiness = client.get_training_readiness(date_id) or []
            readiness_item = readiness[0] if readiness else {}
            wellness["readiness"] = first_value(
                readiness_item, "score", "trainingReadinessScore"
            )
            wellness["readinessRaw"] = readiness
        except Exception as exc:
            wellness["readinessError"] = str(exc)

        if any(
            wellness.get(key) is not None
            for key in (
                "hrvScore",
                "sleepScore",
                "sleepSeconds",
                "restingHr",
                "readiness",
            )
        ):
            wellness_records.append(wellness)

    print(json.dumps({
        "success": True,
        "activities": activities,
        "activityCount": len(activities),
        "fetchedDays": fetched_days,
        "responseDays": response_days,
        "hrvDays": len([record for record in records if record.get("hrvScore") is not None]),
        "records": records,
        "wellnessRecords": wellness_records,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
