'use client';

import { useState, useRef, useEffect, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Upload,
  FileText,
  Settings,
  Loader2,
  Globe,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Database,
  HelpCircle,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { knowledgeApi } from '@/app/features/knowledge/api/knowledgeApi';
import DBConnectionForm from './DBConnectionForm';
import {
  DBConfig,
  SUPPORTED_DB_TYPES,
} from '@/app/features/knowledge/types/DB';
import { connectorApi } from '@/app/features/knowledge/api/connectorApi';

interface CreateKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBaseId?: string;
  initialTab?: 'FILE' | 'API' | 'DB';
}

export default function CreateKnowledgeModal({
  isOpen,
  onClose,
  knowledgeBaseId,
  initialTab,
}: CreateKnowledgeModalProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<'FILE' | 'API' | 'DB'>(
    initialTab || 'FILE',
  );
  const [apiConfig, setApiConfig] = useState({
    url: '',
    method: 'GET',
    headers: '',
    body: '',
  });
  const [dbConfig, setDbConfig] = useState<DBConfig>({
    connectionName: '',
    type: SUPPORTED_DB_TYPES[0].value,
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssh: {
      enabled: false,
    },
  });

  const [formData, setFormData] = useState({
    name: '참고자료 생성 테스트',
    description: `참고자료 생성 테스트입니다 ${new Date().toLocaleString()}`,
    chunkSize: 500,
    chunkOverlap: 50,
    embeddingModel: 'text-embedding-3-small',
    topK: 5,
    similarity: 0.7,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingApi, setIsFetchingApi] = useState(false);
  const [apiPreviewData, setApiPreviewData] = useState<any>(null);

  // API에서 가져온 임베딩 모델 옵션
  type EmbeddingModel = {
    id: string;
    model_id_for_api_call: string;
    name: string;
    provider_name?: string;
  };
  const [embeddingModels, setEmbeddingModels] = useState<EmbeddingModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // UX: Advanced Settings Toggle
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 50MB 제한 (bytes)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  // 사용 가능한 임베딩 모델 가져오기
  useEffect(() => {
    const fetchEmbeddingModels = async () => {
      try {
        setLoadingModels(true);
        const res = await fetch(`/api/v1/llm/my-embedding-models`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          setEmbeddingModels(json);
          // 모델이 있고 현재 기본값이 목록에 없으면 첫 번째 모델로 설정
          if (
            json.length > 0 &&
            !json.find(
              (m: EmbeddingModel) =>
                m.model_id_for_api_call === formData.embeddingModel,
            )
          ) {
            setFormData((prev) => ({
              ...prev,
              embeddingModel: json[0].model_id_for_api_call,
            }));
          }
        } else {
          console.error('Failed to fetch embedding models');
        }
      } catch (err) {
        console.error('Error fetching embedding models', err);
      } finally {
        setLoadingModels(false);
      }
    };

    if (isOpen) {
      fetchEmbeddingModels();
      // initialTab이 변경되면 sourceType 업데이트 (모달이 열릴 때마다 초기화되지 않도록 주의 필요, 여기서는 isOpen시 fetch와 함께 처리)
      if (initialTab) {
        setSourceType(initialTab);
      }
    }
  }, [isOpen, initialTab]); // initialTab dependency added

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > MAX_FILE_SIZE) {
        alert('파일 크기는 50MB를 초과할 수 없습니다.');
        e.target.value = ''; // 초기화
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.size > MAX_FILE_SIZE) {
        alert('파일 크기는 50MB를 초과할 수 없습니다.');
        return;
      }
      setFile(droppedFile);
    }
  };

  // DB Connection Test
  const handleTestDBConnection = async (config: DBConfig): Promise<boolean> => {
    try {
      const result = await connectorApi.testConnection(config);
      if (result.success) {
        toast.success(result.message || 'DB 연결 테스트 성공!');
        return true;
      } else {
        toast.error(result.message || 'DB 연결에 실패했습니다.');
        return false;
      }
    } catch (err: any) {
      console.error('DB Connection Test Error', err);
      toast.error(
        err.message || 'DB 연결 테스트 중 알 수 없는 오류가 발생했습니다.',
      );
      return false;
    }
  };

  const handleSubmit = async () => {
    if (sourceType === 'FILE' && !file) {
      alert('파일을 업로드해주세요.');
      return;
    }
    if (sourceType === 'API' && !apiConfig.url) {
      alert('API URL을 입력해주세요.');
      return;
    }
    if (
      sourceType === 'DB' &&
      (!dbConfig.host ||
        !dbConfig.port ||
        !dbConfig.database ||
        !dbConfig.username ||
        !dbConfig.password)
    ) {
      alert('DB 정보를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);

      let connectionId = undefined;
      let s3FileUrl = undefined;
      let s3FileKey = undefined;

      // DB 타입이면, 커넥터 생성 API 호출하여 ID 발급 받습니다
      if (sourceType === 'DB') {
        try {
          const connectorRes = await connectorApi.createConnector(dbConfig);
          if (connectorRes.success && connectorRes.id) {
            connectionId = connectorRes.id;
            console.log('Connector created: ', connectionId);
          } else {
            console.error('Connector creation failed:', connectorRes.message);
            toast.error(
              connectorRes.message || 'DB 연결 정보 저장에 실패했습니다.',
            );
            setIsLoading(false);
            return;
          }
        } catch (err: any) {
          console.error('Connector creation error:', err);
          toast.error(
            err.message || 'DB 연결 정보 저장 중 오류가 발생했습니다.',
          );
          setIsLoading(false);
          return;
        }
      }

      // [NEW] FILE 타입이면 S3 직접 업로드
      if (sourceType === 'FILE' && file) {
        try {
          // 1. Presigned URL 요청
          const presignedData = await knowledgeApi.getPresignedUploadUrl(
            file.name,
            file.type || 'application/octet-stream',
          );

          // 2. S3에 직접 업로드
          await knowledgeApi.uploadToS3(
            presignedData.upload_url,
            file,
            file.type || 'application/octet-stream',
          );

          // 3. S3 정보 저장
          s3FileUrl = presignedData.upload_url.split('?')[0]; // Query string 제거
          s3FileKey = presignedData.s3_key;

          console.log('[S3 Upload] Success:', s3FileKey);
        } catch (err: any) {
          console.error('[S3 Upload] Failed:', err);
          toast.error(`S3 업로드 실패: ${err.message}`);
          setIsLoading(false);
          return;
        }
      }

      // 참고자료 생성
      const response = await knowledgeApi.uploadKnowledgeBase({
        sourceType: sourceType,
        // [NEW] S3 직접 업로드 정보 (있으면 전달)
        s3FileUrl: s3FileUrl,
        s3FileKey: s3FileKey,
        // [기존] file은 S3 업로드 실패 시 대체 수단으로만 사용
        file: s3FileUrl
          ? undefined
          : sourceType === 'FILE' && file
            ? file
            : undefined,
        apiUrl: sourceType === 'API' ? apiConfig.url : undefined,
        apiMethod: sourceType === 'API' ? apiConfig.method : undefined,
        apiHeaders: sourceType === 'API' ? apiConfig.headers : undefined,
        apiBody: sourceType === 'API' ? apiConfig.body : undefined,
        name: formData.name,
        description: formData.description,
        embeddingModel: formData.embeddingModel,
        topK: formData.topK,
        similarity: formData.similarity,
        chunkSize: formData.chunkSize,
        chunkOverlap: formData.chunkOverlap,
        knowledgeBaseId: knowledgeBaseId,
        connectionId: connectionId,
      });

      // console.log(JSON.stringify(response));
      // 성공 시 모달 닫기 및 문서 설정 페이지로 이동
      onClose();
      router.push(
        `/dashboard/knowledge/${response.knowledge_base_id}/document/${response.document_id}`,
      );
    } catch (error: any) {
      console.group('[CreateKnowledgeModal] Submission failed');
      console.error('Error object:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      console.groupEnd();
      console.error('Failed to create/upload knowledge base:', error);
      alert(
        `요청 처리에 실패했습니다: ${error.response?.data?.detail || error.message}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchApiData = async () => {
    if (!apiConfig.url) {
      toast.error('API URL을 입력해주세요.');
      return;
    }

    try {
      setIsFetchingApi(true);
      setApiPreviewData(null);

      let headers = {};
      try {
        if (apiConfig.headers) {
          headers = JSON.parse(apiConfig.headers);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        toast.error('Headers 형식이 올바르지 않습니다.');
        return;
      }

      let body = null;
      try {
        if (apiConfig.body) {
          body = JSON.parse(apiConfig.body);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        toast.error('Body 형식이 올바르지 않습니다.');
        return;
      }

      // 백엔드 프록시 사용 (CORS 해결)
      const data = await knowledgeApi.proxyApiPreview({
        url: apiConfig.url,
        method: apiConfig.method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: apiConfig.method !== 'GET' ? body : undefined,
      });

      // 프록시 응답 구조: { status, data, headers }
      if (data.status >= 400) {
        throw new Error(`API Request failed: ${data.status}`);
      }

      sessionStorage.setItem(
        'api_preview' + apiConfig.url,
        JSON.stringify(data.data),
      );
      setApiPreviewData(data.data);
      toast.success('데이터를 성공적으로 불러왔습니다.');
    } catch (error: any) {
      console.error('API Fetch Error:', error);
      toast.error(`API 호출 실패: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsFetchingApi(false);
    }
  };

  // Simple recursive JSON Tree Viewer
  const JsonTreeViewer = ({
    data,
    level = 0,
  }: {
    data: any;
    level?: number;
  }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (data === null) return <span className="text-gray-400">null</span>;
    if (typeof data !== 'object') {
      const isString = typeof data === 'string';
      return (
        <span
          className={
            isString
              ? 'text-green-600 dark:text-green-400'
              : 'text-blue-600 dark:text-blue-400'
          }
        >
          {isString ? `"${data}"` : String(data)}
        </span>
      );
    }

    const isArray = Array.isArray(data);
    const keys = Object.keys(data);
    const isEmpty = keys.length === 0;

    if (isEmpty)
      return <span className="text-gray-500">{isArray ? '[]' : '{}'}</span>;

    return (
      <div className="font-mono text-xs">
        <div
          className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded px-1"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
          <span className="text-gray-500">{isArray ? '[' : '{'}</span>
          {!isExpanded && <span className="text-gray-400 m-1">...</span>}
          {!isExpanded && (
            <span className="text-gray-500">{isArray ? ']' : '}'}</span>
          )}
          {!isExpanded && (
            <span className="text-gray-400 ml-2 text-[10px]">
              {keys.length} items
            </span>
          )}
        </div>

        {isExpanded && (
          <div className="pl-4 border-l border-gray-200 dark:border-gray-700 ml-1.5 my-1">
            {keys.map((key, idx) => (
              <div key={key} className="my-0.5">
                {!isArray && (
                  <span className="text-purple-600 dark:text-purple-400 mr-1">
                    "{key}":
                  </span>
                )}
                <JsonTreeViewer data={data[key]} level={level + 1} />
                {idx < keys.length - 1 && (
                  <span className="text-gray-400">,</span>
                )}
              </div>
            ))}
          </div>
        )}

        {isExpanded && (
          <div className="text-gray-500 pl-1">{isArray ? ']' : '}'}</div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {knowledgeBaseId ? '자료 추가' : '참고자료 그룹 생성'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* 소스타입 선택 - initialTab이 없을 때만 표시 */}
          {!initialTab && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <button
                type="button"
                onClick={() => setSourceType('FILE')}
                className={`group flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all ${
                  sourceType === 'FILE'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-400/50 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500'
                }`}
              >
                <div
                  className={`p-3 rounded-full ${
                    sourceType === 'FILE'
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-700'
                  }`}
                >
                  <FileText className="w-6 h-6" />
                </div>
                <span className="font-semibold">파일 업로드</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('API')}
                className={`group flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all ${
                  sourceType === 'API'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-400/50 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500'
                }`}
              >
                <div
                  className={`p-3 rounded-full ${
                    sourceType === 'API'
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-700'
                  }`}
                >
                  <Globe className="w-6 h-6" />
                </div>
                <span className="font-semibold">API 연동</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('DB')}
                className={`group flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all ${
                  sourceType === 'DB'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-400/50 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500'
                }`}
              >
                <div
                  className={`p-3 rounded-full ${
                    sourceType === 'DB'
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-700'
                  }`}
                >
                  <Database className="w-6 h-6" />
                </div>
                <span className="font-semibold">외부 DB 연결</span>
              </button>
            </div>
          )}

          <div>
            {sourceType === 'FILE' && (
              <>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-10 text-center hover:border-blue-500 hover:bg-blue-50/50 dark:hover:border-blue-400 dark:hover:bg-blue-900/10 transition-all cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200 shadow-sm">
                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>

                  {file ? (
                    <div className="animate-in fade-in zoom-in duration-200">
                      <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-1">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-base font-medium text-gray-900 dark:text-white mb-2">
                        파일을 여기로 드래그하거나 클릭하세요
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        지원 형식: PDF, Excel, Word, TXT, MD 등 (최대 50MB)
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.txt,.md,.docx,.xlsx,.xls,.csv"
                  />
                </div>
              </>
            )}
            {sourceType === 'API' && (
              <div className="space-y-4">
                <div>
                  <div className="flex gap-2 mb-2">
                    <select
                      value={apiConfig.method}
                      onChange={(e) =>
                        setApiConfig({ ...apiConfig, method: e.target.value })
                      }
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-24"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                    <input
                      type="text"
                      value={apiConfig.url}
                      onChange={(e) =>
                        setApiConfig({ ...apiConfig, url: e.target.value })
                      }
                      placeholder="https://api.example.com/data"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Headers (JSON){' '}
                      <span className="text-gray-400">(선택)</span>
                    </label>
                    <textarea
                      value={apiConfig.headers}
                      onChange={(e) =>
                        setApiConfig({ ...apiConfig, headers: e.target.value })
                      }
                      placeholder='{"Authorization": "Bearer token"}'
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Body (JSON) <span className="text-gray-400">(선택)</span>
                    </label>
                    <textarea
                      value={apiConfig.body}
                      onChange={(e) =>
                        setApiConfig({ ...apiConfig, body: e.target.value })
                      }
                      placeholder='{"query": "example"}'
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs resize-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={fetchApiData}
                    disabled={isFetchingApi || !apiConfig.url}
                    className="w-full py-3 px-4 border-2 border-blue-100 dark:border-blue-900/30 hover:border-blue-500 dark:hover:border-blue-400 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFetchingApi ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    연결 테스트 및 미리보기
                  </button>
                </div>

                {/* API Response Preview */}
                {apiPreviewData && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Response Preview
                      </h4>
                      <button
                        type="button"
                        onClick={() => setApiPreviewData(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Clear
                      </button>
                    </div>
                    <JsonTreeViewer data={apiPreviewData} />
                  </div>
                )}
              </div>
            )}
            {sourceType === 'DB' && (
              <DBConnectionForm
                onChange={setDbConfig}
                onTestConnection={handleTestDBConnection}
              />
            )}
          </div>

          {/* Basic Info (Only for New KB) */}
          {!knowledgeBaseId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📝 기본 정보
              </label>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    자료 그룹 이름
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="예: 제품 매뉴얼, 사내 규정 등"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    설명 (선택)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="어떤 자료들이 모여있나요?"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex items-center justify-between w-full text-left group"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <Settings className="w-4 h-4" />
                고급 설정
              </span>
              {isAdvancedOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-500 group-hover:text-blue-600 transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-blue-600 transition-colors" />
              )}
            </button>

            {isAdvancedOpen && (
              <div className="mt-4 space-y-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg animate-in slide-in-from-top-2 fade-in duration-200">
                {/* Chunk Settings */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    청크 설정
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="group relative">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 mb-1 cursor-help">
                        청크 (정보 조각 크기)
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                      </label>
                      <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-20 leading-relaxed pointer-events-none">
                        <div className="font-semibold text-blue-300 mb-1">
                          값을 높이면?
                        </div>
                        <div className="mb-2">
                          한 번에 많은 내용을 이해해요.
                        </div>
                        <div className="font-semibold text-red-300 mb-1">
                          값을 낮추면?
                        </div>
                        <div>세밀하고 정확하게 정보를 찾아요.</div>
                        <div className="absolute bottom-[-6px] left-4 w-3 h-3 bg-gray-900 transform rotate-45"></div>
                      </div>
                      <input
                        type="number"
                        value={formData.chunkSize}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            chunkSize: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="group relative">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 mb-1 cursor-help">
                        오버랩 (문맥 연결량)
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                      </label>
                      <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-20 leading-relaxed pointer-events-none">
                        <div className="font-semibold text-blue-300 mb-1">
                          값을 높이면?
                        </div>
                        <div className="mb-2">
                          앞뒤 맥락을 더 풍부하게 파악해요.
                        </div>
                        <div className="font-semibold text-red-300 mb-1">
                          값을 낮추면?
                        </div>
                        <div>중복 없이 깔끔하게 정보를 처리해요.</div>
                        <div className="absolute bottom-[-6px] left-4 w-3 h-3 bg-gray-900 transform rotate-45"></div>
                      </div>
                      <input
                        type="number"
                        value={formData.chunkOverlap}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            chunkOverlap: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Embedding Settings - 새로운 참고자료그룹 생성시에만 임베딩 설정 가능 */}
                {!knowledgeBaseId && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      임베딩 설정
                    </h4>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        모델
                      </label>
                      {loadingModels ? (
                        <div className="text-xs text-gray-400 p-2">
                          모델 로딩 중...
                        </div>
                      ) : embeddingModels.length === 0 ? (
                        <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                          <span>사용 가능한 임베딩 모델이 없습니다.</span>
                          <a
                            href="/settings/provider"
                            className="ml-2 underline hover:text-amber-700 dark:hover:text-amber-300"
                          >
                            API 키 등록하기
                          </a>
                        </div>
                      ) : (
                        <select
                          value={formData.embeddingModel}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              embeddingModel: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {embeddingModels.map((model) => (
                            <option
                              key={model.id}
                              value={model.model_id_for_api_call}
                            >
                              {model.name}{' '}
                              {model.provider_name
                                ? `(${model.provider_name})`
                                : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                {/* Search Settings */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    검색 설정
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="group relative">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 mb-1 cursor-help">
                        Top K (참고 자료 수)
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                      </label>
                      <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-20 leading-relaxed pointer-events-none">
                        <div className="font-semibold text-blue-300 mb-1">
                          값을 높이면?
                        </div>
                        <div className="mb-2">
                          다양한 근거를 바탕으로 대답해요.
                        </div>
                        <div className="font-semibold text-red-300 mb-1">
                          값을 낮추면?
                        </div>
                        <div>핵심적인 근거로 빠르게 대답해요.</div>
                        <div className="absolute bottom-[-6px] left-4 w-3 h-3 bg-gray-900 transform rotate-45"></div>
                      </div>
                      <input
                        type="number"
                        value={formData.topK}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            topK: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="group relative">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 mb-1 cursor-help">
                        유사도 임계값 (답변의 정확도)
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                      </label>
                      <div className="hidden group-hover:block absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-20 leading-relaxed pointer-events-none">
                        <div className="font-semibold text-blue-300 mb-1">
                          값을 높이면?
                        </div>
                        <div className="mb-2">
                          엉뚱한 대답을 하지 않고 깐깐해져요.
                        </div>
                        <div className="font-semibold text-red-300 mb-1">
                          값을 낮추면?
                        </div>
                        <div>조금 부족한 정보라도 최대한 찾아내요.</div>
                        <div className="absolute bottom-[-6px] right-4 w-3 h-3 bg-gray-900 transform rotate-45"></div>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={formData.similarity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            similarity: parseFloat(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || embeddingModels.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : knowledgeBaseId ? (
              '추가하기'
            ) : (
              '생성하기'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
