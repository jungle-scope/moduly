import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ChunkPreviewList from './ChunkPreviewList';
import { DocumentSegment } from '@/app/features/knowledge/api/knowledgeApi';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: () => <span data-testid="check-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
  Eye: () => <span data-testid="eye-icon" />,
  ChevronRight: () => <span data-testid="chevron-right-icon" />,
  ChevronDown: () => <span data-testid="chevron-down-icon" />,
  ChevronLeft: () => <span data-testid="chevron-left-icon" />,
  ChevronsUpDown: () => <span data-testid="chevrons-updown-icon" />,
  Search: () => <span data-testid="search-icon" />,
}));

// 테스트용 세그먼트 생성 헬퍼
const createSegments = (count: number): DocumentSegment[] => {
  return Array.from({ length: count }, (_, i) => ({
    content: `Content of segment ${i + 1}`,
    char_count: 100 + i,
    token_count: 20 + i,
    created_at: new Date().toISOString(),
  }));
};

// 각 테스트 후 cleanup
beforeEach(() => {
  cleanup();
});

describe('ChunkPreviewList', () => {
  describe('기본 렌더링', () => {
    it('로딩 중일 때 로딩 UI를 표시한다', () => {
      render(<ChunkPreviewList previewSegments={[]} isLoading={true} />);
      expect(
        screen.getByText('문서를 분석하여 조각내고 있습니다...'),
      ).toBeInTheDocument();
    });

    it('세그먼트가 없을 때 빈 상태 메시지를 표시한다', () => {
      render(<ChunkPreviewList previewSegments={[]} isLoading={false} />);
      expect(screen.getByText('미리보기 결과가 없습니다')).toBeInTheDocument();
    });

    it('세그먼트가 있을 때 조각 개수를 표시한다', () => {
      const segments = createSegments(5);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);
      expect(screen.getByText(/5.*개 조각/)).toBeInTheDocument();
    });

    it('headerButton prop을 렌더링한다', () => {
      const segments = createSegments(3);
      render(
        <ChunkPreviewList
          previewSegments={segments}
          isLoading={false}
          headerButton={<button>Custom Button</button>}
        />,
      );
      expect(screen.getByText('Custom Button')).toBeInTheDocument();
    });
  });

  describe('Collapsible 기능', () => {
    it('기본 상태에서 조각은 collapsed 상태이다 (내용이 숨겨짐)', () => {
      const segments = createSegments(3);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);

      // 헤더는 보이지만 내용은 보이지 않아야 함
      expect(screen.getByText(/조각 #.*1/)).toBeInTheDocument();
      expect(
        screen.queryByText('Content of segment 1'),
      ).not.toBeInTheDocument();
    });

    it('조각 헤더 클릭 시 내용이 펼쳐진다', () => {
      const segments = createSegments(3);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);

      // 조각 #1 헤더 클릭
      const header = screen.getByText(/조각 #.*1/).closest('button');
      fireEvent.click(header!);

      // 내용이 표시되어야 함
      expect(screen.getByText('Content of segment 1')).toBeInTheDocument();
    });

    it('펼쳐진 조각을 다시 클릭하면 접힌다', () => {
      const segments = createSegments(3);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);

      const header = screen.getByText(/조각 #.*1/).closest('button');

      // 펼치기
      fireEvent.click(header!);
      expect(screen.getByText('Content of segment 1')).toBeInTheDocument();

      // 접기
      fireEvent.click(header!);
      expect(
        screen.queryByText('Content of segment 1'),
      ).not.toBeInTheDocument();
    });

    it('전체 펼치기 버튼 클릭 시 모든 조각이 펼쳐진다', () => {
      const segments = createSegments(3);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);

      // 전체 펼치기 클릭
      const expandButton = screen.getByText('전체 펼치기');
      fireEvent.click(expandButton);

      // 모든 내용이 표시되어야 함
      expect(screen.getByText('Content of segment 1')).toBeInTheDocument();
      expect(screen.getByText('Content of segment 2')).toBeInTheDocument();
      expect(screen.getByText('Content of segment 3')).toBeInTheDocument();
    });

    it('전체 접기 버튼 클릭 시 모든 조각이 접힌다', () => {
      const segments = createSegments(3);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);

      // 먼저 전체 펼치기
      fireEvent.click(screen.getByText('전체 펼치기'));

      // 전체 접기 클릭
      fireEvent.click(screen.getByText('전체 접기'));

      // 모든 내용이 숨겨져야 함
      expect(
        screen.queryByText('Content of segment 1'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Content of segment 2'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Content of segment 3'),
      ).not.toBeInTheDocument();
    });
  });

  describe('페이지네이션', () => {
    it('50개 이하일 때 페이지네이션이 표시되지 않는다', () => {
      const segments = createSegments(30);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);

      // 페이지 범위 표시(1-50 / N개)가 없어야 함
      expect(screen.queryByText(/1-50/)).not.toBeInTheDocument();
    });

    it('50개 초과일 때 페이지네이션이 표시된다', () => {
      const segments = createSegments(100);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);

      // 범위 표시 확인
      expect(screen.getByText(/1-50.*100개/)).toBeInTheDocument();
    });

    it('다음 페이지 버튼이 동작한다', () => {
      const segments = createSegments(100);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);

      // 첫 페이지: Content of segment 1이 클릭 시 표시될 수 있어야 함
      const firstHeader = screen.getAllByRole('button')[1]; // 첫 번째 조각 헤더
      fireEvent.click(firstHeader);
      expect(screen.getByText('Content of segment 1')).toBeInTheDocument();
      fireEvent.click(firstHeader); // 다시 접기

      // 페이지 2로 이동
      const page2Button = screen.getByRole('button', { name: '2' });
      fireEvent.click(page2Button);

      // 두 번째 페이지에서는 segment 1이 없고 segment 51이 있어야 함
      expect(
        screen.queryByText('Content of segment 1'),
      ).not.toBeInTheDocument();

      // 51번 조각 헤더를 클릭하면 Content of segment 51이 표시됨
      const segment51Header = screen.getAllByRole('button')[1];
      fireEvent.click(segment51Header);
      expect(screen.getByText('Content of segment 51')).toBeInTheDocument();
    });

    it('N번 조각으로 이동 기능이 동작한다', () => {
      const segments = createSegments(100);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);

      // 입력 필드에 75 입력
      const input = screen.getByPlaceholderText('N번');
      fireEvent.change(input, { target: { value: '75' } });

      // 이동 버튼 클릭
      const searchButton = screen
        .getAllByRole('button')
        .find((btn) => btn.getAttribute('title') === '이동');
      fireEvent.click(searchButton!);

      // 조각 #75가 있는 페이지로 이동 (페이지 2)
      expect(screen.getByText(/조각 #.*75$/)).toBeInTheDocument();

      // 해당 조각이 펼쳐졌는지 확인
      expect(screen.getByText('Content of segment 75')).toBeInTheDocument();
    });

    it('Enter 키로 N번 조각 이동이 동작한다', () => {
      const segments = createSegments(100);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);

      const input = screen.getByPlaceholderText('N번');
      fireEvent.change(input, { target: { value: '60' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText(/조각 #.*60$/)).toBeInTheDocument();
    });
  });

  describe('조각 정보 표시', () => {
    it('각 조각의 글자 수와 토큰 수를 표시한다', () => {
      const segments = createSegments(3);
      render(<ChunkPreviewList previewSegments={segments} isLoading={false} />);

      // 첫 번째 조각의 정보 확인 (여러 개가 있으므로 getAllBy 사용)
      const charCounts = screen.getAllByText(/100자/);
      const tokenCounts = screen.getAllByText(/20토큰/);

      expect(charCounts.length).toBeGreaterThan(0);
      expect(tokenCounts.length).toBeGreaterThan(0);
    });
  });
});
