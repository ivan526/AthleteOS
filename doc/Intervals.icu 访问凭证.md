【Intervals.icu 访问凭证】
运动员ID：i212288
API密钥：1gzdnhjs6ya48kx0zgb3m22ap
API调用规范：
1. Basic Auth 用户名固定为 "API_KEY"，密码为上面的密钥
2. 请求头必须携带：Accept: application/json、User-Agent: Mozilla/5.0
3. 基础接口：
   - 获取用户信息：GET https://intervals.icu/api/v1/athlete/0
   - 获取活动记录：GET https://intervals.icu/api/v1/athlete/i212288/activities
   - 获取健康数据：GET https://intervals.icu/api/v1/athlete/i212288/wellness
