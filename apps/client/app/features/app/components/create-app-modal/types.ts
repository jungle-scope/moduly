/**
 * 앱 아이콘 선택 정보 타입
 */
export type AppIconSelection = {
  emoji: string; // 선택된 이모지 (예: '🤖')
  bg: string; // 배경색 Hex 코드 (예: '#FFEAD5')
};

/**
 * 앱 생성 모달 Props
 */
export type CreateAppProps = {
  onSuccess: () => void; // 앱 생성 성공 시 호출되는 콜백 (목록 새로고침 등)
  onClose: () => void; // 모달 닫기 요청 시 호출되는 콜백
};
