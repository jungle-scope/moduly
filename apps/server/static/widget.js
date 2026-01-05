/**
 * Moduly 채팅 위젯 로더 스크립트
 * 
 * 사용법:
 * <script>
 *   window.ModulyConfig = {
 *     appId: 'your-url-slug'
 *     frontendUrl: 'https://www.moviepick.shop'
 *   };
 * </script>
 * <script src="http://localhost:8000/static/widget.js"></script>
 */

(function() {
  'use strict';

  // 설정 확인
  if (!window.ModulyConfig || !window.ModulyConfig.appId) {
    console.error('Moduly Widget: window.ModulyConfig.appId is required');
    return;
  }

  const config = window.ModulyConfig;
  
  // 프론트엔드 URL 결정
  // 1. ModulyConfig.frontendUrl이 명시적으로 설정되어 있으면 사용
  // 2. 없으면 현재 스크립트가 로드된 백엔드 URL에서 추론
  let frontendUrl = config.frontendUrl;
    
  // 기본값 (스크립트를 찾지 못한 경우)
  if (!frontendUrl) {
    frontendUrl = 'https://www.moviepick.shop';
  }
  
  const CHAT_URL = `${frontendUrl}/embed/chat/${config.appId}`;

  // 위젯 상태
  let isOpen = false;
  let chatButton, chatContainer, chatIframe;

  /**
   * 채팅 버튼 생성
   */
  function createChatButton() {
    chatButton = document.createElement('button');
    chatButton.id = 'moduly-chat-button';
    chatButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 11.5C21 16.75 16.75 21 11.5 21C6.25 21 2 16.75 2 11.5C2 6.25 6.25 2 11.5 2C16.75 2 21 6.25 21 11.5Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7 11.5H16" stroke="white" stroke-width="2" stroke-linecap="round"/>
        <path d="M7 15H13" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    
    // 스타일
    Object.assign(chatButton.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '60px',
      height: '60px',
      borderRadius: '50%',
      backgroundColor: '#2563eb',
      border: 'none',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9998',
      transition: 'all 0.3s ease',
    });

    // 호버 효과
    chatButton.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.1)';
      this.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
    });

    chatButton.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    });

    // 클릭 이벤트
    chatButton.addEventListener('click', toggleChat);

    document.body.appendChild(chatButton);
  }

  /**
   * 채팅 컨테이너 생성
   */
  function createChatContainer() {
    chatContainer = document.createElement('div');
    chatContainer.id = 'moduly-chat-container';
    
    Object.assign(chatContainer.style, {
      position: 'fixed',
      bottom: '90px',
      right: '20px',
      width: '400px',
      height: '600px',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
      overflow: 'hidden',
      zIndex: '9999',
      display: 'none',
      opacity: '0',
      transform: 'translateY(20px)',
      transition: 'all 0.3s ease',
    });

    // 로딩 표시
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'moduly-loading';
    Object.assign(loadingDiv.style, {
      width: '100%',
      height: '100%',
      backgroundColor: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      color: '#666',
    });
    loadingDiv.textContent = '로딩 중...';
    chatContainer.appendChild(loadingDiv);

    document.body.appendChild(chatContainer);
  }

  /**
   * iframe 생성
   */
  function createIframe() {
    chatIframe = document.createElement('iframe');
    chatIframe.id = 'moduly-chat-iframe';
    chatIframe.src = CHAT_URL;
    chatIframe.title = 'Moduly 채팅';
    
    Object.assign(chatIframe.style, {
      width: '100%',
      height: '100%',
      border: 'none',
      display: 'block',
    });

    // iframe 로드 완료 시 로딩 제거
    chatIframe.addEventListener('load', function() {
      const loading = document.getElementById('moduly-loading');
      if (loading) {
        loading.remove();
      }
    });

    chatContainer.appendChild(chatIframe);
  }

  /**
   * 채팅 토글
   */
  function toggleChat() {
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  /**
   * 채팅 열기
   */
  function openChat() {
    if (!chatIframe) {
      createIframe();
    }

    chatContainer.style.display = 'block';
    // 애니메이션을 위해 약간의 지연
    setTimeout(() => {
      chatContainer.style.opacity = '1';
      chatContainer.style.transform = 'translateY(0)';
    }, 10);

    isOpen = true;

    // 버튼 아이콘 변경 (닫기 아이콘)
    chatButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  /**
   * 채팅 닫기
   */
  function closeChat() {
    chatContainer.style.opacity = '0';
    chatContainer.style.transform = 'translateY(20px)';

    setTimeout(() => {
      chatContainer.style.display = 'none';
    }, 300);

    isOpen = false;

    // 버튼 아이콘 변경 (채팅 아이콘)
    chatButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 11.5C21 16.75 16.75 21 11.5 21C6.25 21 2 16.75 2 11.5C2 6.25 6.25 2 11.5 2C16.75 2 21 6.25 21 11.5Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7 11.5H16" stroke="white" stroke-width="2" stroke-linecap="round"/>
        <path d="M7 15H13" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  /**
   * 초기화
   */
  function init() {
    // DOM이 준비되면 실행
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        createChatButton();
        createChatContainer();
      });
    } else {
      createChatButton();
      createChatContainer();
    }

    console.log('✅ Moduly Widget initialized with appId:', config.appId);
  }

  // 초기화 실행
  init();

})();
