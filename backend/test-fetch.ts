// 测试fetch API调用
async function testFetch() {
  const baseUrl = 'https://intervals.icu/api/v1';
  const athleteId = 'i212288';
  const apiKey = '1gzdnhjs6ya48kx0zgb3m22ap';
  const apiUser = 'API_KEY';

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 180);
  const endDate = new Date();

  let url = `${baseUrl}/athlete/${athleteId}/activities?page=1&per_page=10`;
  url += `&oldest=${startDate.toISOString().split('T')[0]}`;
  url += `&newest=${endDate.toISOString().split('T')[0]}`;

  console.log('Request URL:', url);

  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
  console.log('Auth header:', `Basic ${auth}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (AthleteOS)',
        'Authorization': `Basic ${auth}`,
      },
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
    } else {
      const data = await response.json();
      console.log('Success! Got', data.length, 'activities');
      console.log('First activity:', data[0]?.id, data[0]?.name, data[0]?.start_date);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testFetch();
