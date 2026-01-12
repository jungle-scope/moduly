/**
 * Cron 표현식을 사람이 읽을 수 있는 한글 형식으로 변환
 */
export function formatCronExpression(cron: string): string {
  const presets: Record<string, string> = {
    '0 9 * * *': '매일 오전 9시',
    '0 18 * * *': '매일 오후 6시',
    '0 10 * * 1': '매주 월요일 오전 10시',
    '0 9 1 * *': '매달 1일 오전 9시',
    '0 * * * *': '매시간',
    '*/30 * * * *': '30분마다',
  };

  return presets[cron] || cron;
}
