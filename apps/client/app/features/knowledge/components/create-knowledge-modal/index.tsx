'use client';

import { useState, useRef, useEffect, DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  X,
  Upload,
  FileText,
  Loader2,
  Globe,
  ChevronRight,
  ChevronDown,
  Database,
  Play,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // Fixed position is viewport relative, so rect.bottom is correct. Added 8px margin.
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('.custom-select-dropdown')
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full px-4 py-2.5 text-left bg-white dark:bg-gray-700 border rounded-xl flex items-center justify-between transition-all duration-200 ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800' : 'cursor-pointer'}`}
      >
        <div className="flex-1 truncate">
          {selectedOption ? (
            <span className="text-gray-900 dark:text-white font-medium">
              {selectedOption.label}
              {selectedOption.description && (
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  {selectedOption.description}
                </span>
              )}
            </span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-500' : ''
          }`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            className="custom-select-dropdown fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            <div className="p-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 mb-0.5 text-left rounded-lg flex items-center justify-between transition-colors ${
                    value === option.value
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div>
                    <div className="font-medium text-sm">{option.label}</div>
                    {option.description && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {option.description}
                      </div>
                    )}
                  </div>
                  {value === option.value && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
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
    name: '',
    description: '',
    chunkSize: 500,
    chunkOverlap: 50,
    embeddingModel: 'text-embedding-3-small',
    topK: 5,
    similarity: 0.7,
  });

  const [embeddingModels, setEmbeddingModels] = useState<EmbeddingModel[]>([]);

  // 유효성 검사
  const isNameValid = formData.name.length > 0 && formData.name.length <= 50;
  const isDescValid = formData.description.length <= 100;
  const isFormValid =
    isNameValid &&
    isDescValid &&
    (!knowledgeBaseId
      ? formData.embeddingModel && embeddingModels.length > 0
      : true);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 50) {
      setFormData((prev) => ({ ...prev, name: value }));
    }
  };

  const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 100) {
      setFormData((prev) => ({ ...prev, description: value }));
    }
  };

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
  const [loadingModels, setLoadingModels] = useState(false);
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

      // Reset Form Data/State
      setFile(null);
      setApiConfig({ url: '', method: 'GET', headers: '', body: '' });
      setDbConfig({
        connectionName: '',
        type: SUPPORTED_DB_TYPES[0].value,
        host: '',
        port: 5432,
        database: '',
        username: '',
        password: '',
        ssh: { enabled: false },
      });
      // 임베딩 모델은 fetchEmbeddingModels가 처리하므로 제외
      setFormData((prev) => ({
        ...prev,
        // Creation 시 초기화.
        // Creation 시 초기화.
        name: '',
        description: '',
        chunkSize: 500,
        chunkOverlap: 50,
        topK: 5,
        similarity: 0.7,
      }));

      // initialTab이 변경되면 sourceType 업데이트 (모달이 열릴 때마다 초기화되지 않도록 주의 필요, 여기서는 isOpen시 fetch와 함께 처리)
      if (initialTab) {
        setSourceType(initialTab);
      }
    }
  }, [isOpen, initialTab]); // initialTab dependency added

  useEffect(() => {
    // knowledgeBaseId가 있으면 (추가 모드) initialTab이 없어도 기본값 FILE로 설정
    if (knowledgeBaseId && !initialTab) {
      setSourceType('FILE');
    }
  }, [knowledgeBaseId, initialTab]);

  // Fix: Update CustomSelect to handle position correctly for FIXED positioning
  // Redefine updatePosition in CustomSelect or pass props?
  // CustomSelect is defined outside.

  // To logic about padding:
  // The structure is:
  // <div className="p-6 space-y-6">
  //   {knowledgeBaseId && ... (source type grid)}
  //   <div>
  //     {knowledgeBaseId && ... (source inputs)}
  //   </div>
  //   {!knowledgeBaseId && ... (basic info)}
  // </div>
  //
  // If knowledgeBaseId is false:
  // source type grid is hidden.
  // The 'div' for source inputs is Rendered but empty.
  // Because space-y-6 is used, it adds margin-top to content following it.
  // So we have: P-6 (container) -> Empty Div (height 0) -> Margin-top 24px (from space-y-6) -> Basic Info.
  // So effective top padding is 24px + 24px = 48px.
  // We need to NOT render that div if !knowledgeBaseId.

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
    try {
      setIsLoading(true);

      // [Case 1] New Knowledge Base Creation (Empty)
      if (!knowledgeBaseId) {
        if (!formData.name) {
          alert('지식 베이스 이름을 입력해주세요.');
          setIsLoading(false);
          return;
        }
        if (!formData.embeddingModel) {
          alert('임베딩 모델을 선택해주세요.');
          setIsLoading(false);
          return;
        }

        const response = await knowledgeApi.createKnowledgeBase({
          name: formData.name,
          description: formData.description,
          embedding_model: formData.embeddingModel,
        });

        toast.success('지식 베이스가 생성되었습니다.');
        onClose();
        router.push(`/dashboard/knowledge/${response.id}`);
        return;
      }

      // [Case 2] Add Source to Existing Knowledge Base
      // Source Validation
      if (sourceType === 'FILE' && !file) {
        alert('파일을 업로드해주세요.');
        setIsLoading(false);
        return;
      }
      if (sourceType === 'API' && !apiConfig.url) {
        alert('API URL을 입력해주세요.');
        setIsLoading(false);
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
        setIsLoading(false);
        return;
      }

      let connectionId = undefined;
      let s3FileUrl = undefined;
      let s3FileKey = undefined;

      // DB 타입이면, 커넥터 생성 API 호출하여 ID 발급 받습니다
      if (sourceType === 'DB') {
        try {
          const connectorRes = await connectorApi.createConnector(dbConfig);
          if (connectorRes.success && connectorRes.id) {
            connectionId = connectorRes.id;
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

      // FILE 타입이면 S3 직접 업로드
      if (sourceType === 'FILE' && file) {
        try {
          // 1. Presigned URL 요청
          const presignedData = await knowledgeApi.getPresignedUploadUrl(
            file.name,
            file.type || 'application/octet-stream',
          );

          if (presignedData.use_backend_proxy) {
            // s3FileUrl/Key를 설정하지 않음 -> 아래에서 file 객체가 전송됨
          } else {
            // 2. S3에 직접 업로드
            await knowledgeApi.uploadToS3(
              presignedData.upload_url,
              file,
              file.type || 'application/octet-stream',
            );

            // 3. S3 정보 저장
            s3FileUrl = presignedData.upload_url.split('?')[0]; // Query string 제거
            s3FileKey = presignedData.s3_key;
          }
        } catch (err: any) {
          console.error('[S3 Upload] Failed:', err);
          toast.error(`S3 업로드 실패: ${err.message}`);
          setIsLoading(false);
          return;
        }
      }

      // 지식 베이스 생성 (소스 추가)
      const response = await knowledgeApi.uploadKnowledgeBase({
        sourceType: sourceType,
        // S3 직접 업로드 정보 (있으면 전달)
        s3FileUrl: s3FileUrl,
        s3FileKey: s3FileKey,
        // file은 S3 업로드 실패 시 대체 수단으로만 사용
        file: s3FileUrl
          ? undefined
          : sourceType === 'FILE' && file
            ? file
            : undefined,
        apiUrl: sourceType === 'API' ? apiConfig.url : undefined,
        apiMethod: sourceType === 'API' ? apiConfig.method : undefined,
        apiHeaders: sourceType === 'API' ? apiConfig.headers : undefined,
        apiBody: sourceType === 'API' ? apiConfig.body : undefined,
        name: formData.name, // 기존 KB 이름 유지되거나 무시됨 (Backend 로직에 따라 다름)
        description: formData.description,
        embeddingModel: formData.embeddingModel,
        topK: formData.topK,
        similarity: formData.similarity,
        chunkSize: formData.chunkSize,
        chunkOverlap: formData.chunkOverlap,
        knowledgeBaseId: knowledgeBaseId, // 필수
        connectionId: connectionId,
      });

      // 성공 시 모달 닫기
      onClose();

      // 문서 ID가 있으면 문서 상세로 이동
      if (response.document_id) {
        router.push(
          `/dashboard/knowledge/${response.knowledge_base_id}/document/${response.document_id}`,
        );
      } else {
        // 혹시 모르니 KB 상세로
        router.push(`/dashboard/knowledge/${response.knowledge_base_id}`);
      }
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {knowledgeBaseId ? '소스 추가' : '지식 베이스 생성'}
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
          {/* 소스타입 선택 - knowledgeBaseId가 있을 때만 표시 (소스 추가 모드) */}
          {knowledgeBaseId && !initialTab && (
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

          {knowledgeBaseId && (
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
              {knowledgeBaseId && sourceType === 'API' && (
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
                          setApiConfig({
                            ...apiConfig,
                            headers: e.target.value,
                          })
                        }
                        placeholder='{"Authorization": "Bearer token"}'
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Body (JSON){' '}
                        <span className="text-gray-400">(선택)</span>
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
          )}

          {/* Basic Info (Only for New KB) - Header Removed, Flattened */}
          {!knowledgeBaseId && (
            <div className="space-y-5">
              {/* Name Input with Character Count */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  지식 베이스 이름 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={handleNameChange}
                    placeholder="지식 베이스 이름을 입력하세요"
                    maxLength={50}
                    className="w-full px-4 py-3 pr-16 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 right-3 text-xs text-gray-400">
                    ({formData.name.length}/50)
                  </div>
                </div>
              </div>

              {/* Description Input with Character Count */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  설명(선택)
                </label>
                <div className="relative">
                  <textarea
                    value={formData.description}
                    onChange={handleDescChange}
                    placeholder="이 지식 베이스의 목적이나 포함된 문서의 특징을 적어주세요."
                    className="w-full px-4 py-3 pb-8 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none h-24 resize-none"
                    maxLength={100}
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                    ({formData.description.length}/100)
                  </div>
                </div>
              </div>

              {/* Embedding Model Selection with Highlight Background */}
              <div className="space-y-3 p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-sm font-semibold text-gray-900 dark:text-white">
                    임베딩 모델
                  </label>
                  <span className="text-xs text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full font-medium">
                    중요
                  </span>
                </div>

                <div className="relative z-50">
                  {loadingModels ? (
                    <div className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>모델 목록을 불러오는 중...</span>
                    </div>
                  ) : embeddingModels.length === 0 ? (
                    <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl">
                      <span>사용 가능한 임베딩 모델이 없습니다.</span>
                      <a
                        href="/dashboard/settings"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 underline hover:text-amber-700 dark:hover:text-amber-300"
                      >
                        API 키 등록하기
                      </a>
                    </div>
                  ) : (
                    <CustomSelect
                      options={embeddingModels.map((model) => ({
                        value: model.model_id_for_api_call,
                        label: model.name,
                        description: model.provider_name
                          ? `(${model.provider_name})`
                          : undefined,
                      }))}
                      value={formData.embeddingModel}
                      onChange={(value) =>
                        setFormData({
                          ...formData,
                          embeddingModel: value,
                        })
                      }
                      placeholder="임베딩 모델 선택"
                    />
                  )}
                </div>

                {/* Warning Message with Icon and Color */}
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/20 p-3 rounded-lg">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    추후 임베딩 모델 변경 시 전체 문서에 대한 재임베딩 비용이
                    발생할 수 있습니다.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || (!knowledgeBaseId && !isFormValid)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg shadow-blue-500/20"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading
              ? knowledgeBaseId
                ? '소스 추가 중...'
                : '지식 베이스 생성 중...'
              : knowledgeBaseId
                ? '소스 추가'
                : '생성하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
