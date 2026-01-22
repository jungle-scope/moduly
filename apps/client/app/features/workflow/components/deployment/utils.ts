/**
 * Cron 표현식을 사람이 읽을 수 있는 한글 형식으로 변환
 * Supported patterns:
 * - Interval: *\/N * * * *, 0 *\/N * * *
 * - Daily: M H * * *
 * - Weekly: M H * * D,D,D
 * - Monthly: M H D * *
 */
export function formatCronExpression(cron: string): string {
  if (!cron) return '';

  const presets: Record<string, string> = {
    '0 9 * * *': '매일 오전 9시',
    '0 18 * * *': '매일 오후 6시',
    '0 10 * * 1': '매주 월요일 오전 10시',
    '0 9 1 * *': '매달 1일 오전 9시',
    '0 * * * *': '매시간',
    '30 * * * *': '매시간 30분',
    '0 0 * * *': '매일 자정',
    '0 12 * * *': '매일 정오',
  };

  if (presets[cron]) return presets[cron];

  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [min, hour, day, month, week] = parts;

  // 1. Interval (분 단위): */15 * * * *
  if (
    min.startsWith('*/') &&
    hour === '*' &&
    day === '*' &&
    month === '*' &&
    week === '*'
  ) {
    const minute = min.split('/')[1];
    return `${minute}분마다 실행`;
  }

  // 2. Interval (시간 단위): 0 */2 * * *
  if (
    min === '0' &&
    hour.startsWith('*/') &&
    day === '*' &&
    month === '*' &&
    week === '*'
  ) {
    const h = hour.split('/')[1];
    return `${h}시간마다 실행`;
  }

  // Helper for time format
  const formatTime = (h: string, m: string) => {
    const hNum = parseInt(h);
    const mNum = parseInt(m);
    const period = hNum < 12 ? '오전' : '오후';
    const displayHour = hNum % 12 || 12;
    const displayMin = mNum === 0 ? '' : `${mNum}분`;
    return `${period} ${displayHour}시${displayMin ? ' ' + displayMin : ''}`;
  };

  // 3. Daily: 30 14 * * *
  if (
    day === '*' &&
    month === '*' &&
    week === '*' &&
    !hour.includes('*') &&
    !min.includes('*')
  ) {
    return `매일 ${formatTime(hour, min)} 실행`;
  }

  // 4. Weekly: 30 14 * * 1,3,5
  if (
    day === '*' &&
    month === '*' &&
    week !== '*' &&
    !hour.includes('*') &&
    !min.includes('*')
  ) {
    const dayMap: Record<string, string> = {
      '0': '일',
      '1': '월',
      '2': '화',
      '3': '수',
      '4': '목',
      '5': '금',
      '6': '토',
      '7': '일',
    };
    const days = week
      .split(',')
      .map((d) => dayMap[d] || d)
      .join(', ');
    return `매주 ${days}요일 ${formatTime(hour, min)} 실행`;
  }

  // 5. Monthly: 30 14 1 * *
  if (
    day !== '*' &&
    month === '*' &&
    week === '*' &&
    !hour.includes('*') &&
    !min.includes('*')
  ) {
    return `매달 ${day}일 ${formatTime(hour, min)} 실행`;
  }

  return cron;
}
