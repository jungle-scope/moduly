'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Database,
  Table as TableIcon,
  Loader2,
  CheckSquare,
  Square,
  MinusSquare,
  Settings,
  Lock,
  LockOpen,
  CircleHelp,
  Link as LinkIcon,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { connectorApi } from '@/app/features/knowledge/api/connectorApi';
import { toast } from 'sonner';
import { JoinConfig } from '@/app/features/knowledge/api/knowledgeApi';

interface SchemaColumn {
  name: string;
  type: string;
}

interface ForeignKey {
  column: string;
  referenced_table: string;
  referenced_column: string;
}

interface SchemaTable {
  table_name: string;
  columns: SchemaColumn[];
  foreign_keys?: ForeignKey[];
}

interface DBSchemaSelectorProps {
  connectionId: string;
  value: Record<string, string[]>;
  onChange: (value: Record<string, string[]>) => void;
  sensitiveColumns?: Record<string, string[]>;
  onSensitiveColumnsChange?: (value: Record<string, string[]>) => void;
  aliases?: Record<string, Record<string, string>>; // {table: {column: alias}}
  onAliasesChange?: (value: Record<string, Record<string, string>>) => void;
  onEditConnection?: () => void;
  isEditingLoading?: boolean;
  enableAutoChunking?: boolean;
  onEnableAutoChunkingChange?: (enabled: boolean) => void;
  onJoinConfigChange?: (config: JoinConfig | null) => void;
}

export default function DBSchemaSelector({
  connectionId,
  value,
  onChange,
  sensitiveColumns = {},
  onSensitiveColumnsChange,
  aliases = {},
  onAliasesChange,
  onEditConnection,
  isEditingLoading,
  enableAutoChunking = true,
  onEnableAutoChunkingChange,
  onJoinConfigChange,
}: DBSchemaSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  //스키마 데이터 로딩
  useEffect(() => {
    const fetchSchema = async () => {
      if (!connectionId) return;
      try {
        setLoading(true);
        const res = await connectorApi.getSchema(connectionId);
        // 응답 구조가 {tables: [...]} 라고 가정한다
        setTables(res.tables || []);
      } catch {
        toast.error('테이블 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchSchema();
  }, [connectionId]);

  //검색 (필터링)
  const filteredTables = useMemo(() => {
    if (!searchTerm) return tables;
    return tables.filter((t) =>
      t.table_name.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase()),
    );
  }, [tables, searchTerm]);

  // 테이블 펼침/접힘 토글
  const toggleExpand = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  // FK 기반 JOIN 설정 자동 감지
  const detectJoinConfig = (
    selectedTables: string[],
    schemas: SchemaTable[],
  ): JoinConfig | null => {
    if (selectedTables.length !== 2) return null;

    const [t1, t2] = selectedTables;
    const s1 = schemas.find((s) => s.table_name === t1);
    const s2 = schemas.find((s) => s.table_name === t2);

    // t1 → t2 FK?
    const fk = s1?.foreign_keys?.find((fk) => fk.referenced_table === t2);
    if (fk) {
      return {
        enabled: true,
        base_table: t1,
        joins: [
          {
            from_table: t1,
            to_table: t2,
            from_column: fk.column,
            to_column: fk.referenced_column,
          },
        ],
      };
    }

    // t2 → t1 FK?
    const fk2 = s2?.foreign_keys?.find((fk) => fk.referenced_table === t1);
    if (fk2) {
      return {
        enabled: true,
        base_table: t2,
        joins: [
          {
            from_table: t2,
            to_table: t1,
            from_column: fk2.column,
            to_column: fk2.referenced_column,
          },
        ],
      };
    }

    return null;
  };

  // JOIN 설정 상태
  const selectedTables = Object.keys(value);
  const joinConfig = useMemo(
    () => detectJoinConfig(Object.keys(value), tables),
    [value, tables],
  );

  // Selected Table Toggle
  useEffect(() => {
    onJoinConfigChange?.(joinConfig);
  }, [joinConfig, onJoinConfigChange]);

  // 테이블 전체 선택/해제
  const handleTableToggle = (tableName: string, allColumns: string[]) => {
    const isCurrentlySelected = tableName in value;

    // 2개 테이블 제한
    if (!isCurrentlySelected && selectedTables.length >= 2) {
      toast.error('최대 2개 테이블만 선택 가능합니다');
      return;
    }

    const currentCols = value[tableName] || [];
    const isAllSelected = currentCols.length == allColumns.length;

    const newValue = { ...value };
    const newAliases = { ...aliases };

    if (isAllSelected) {
      delete newValue[tableName]; // 전체 해제
      delete newAliases[tableName]; // Alias도 삭제
    } else {
      newValue[tableName] = allColumns; // 전체 선택

      // 전체 선택 시 모든 컬럼에 대해 Alias 자동 생성
      if (onAliasesChange) {
        newAliases[tableName] = {};
        allColumns.forEach((col) => {
          newAliases[tableName][col] = col;
        });
      }
    }

    onChange(newValue);
    if (onAliasesChange) {
      onAliasesChange(newAliases);
    }

    // 테이블 선택 시 자동으로 펼치기
    if (!isAllSelected) {
      setExpandedTables((prev) => new Set(prev).add(tableName));
    }
  };

  // 개별 컬럼 선택/해제
  const handleColumnToggle = (tableName: string, colName: string) => {
    const currentCols = value[tableName] || [];
    const isSelected = currentCols.includes(colName);

    // 새 테이블의 첫 컬럼 선택 시 2개 제한 체크
    if (!isSelected && currentCols.length === 0 && selectedTables.length >= 2) {
      toast.error('최대 2개 테이블만 선택 가능합니다');
      return;
    }

    let newCols;
    if (isSelected) {
      newCols = currentCols.filter((c) => c !== colName);

      // [FIX] 컬럼 해제 시 해당 Alias도 삭제
      if (
        onAliasesChange &&
        aliases[tableName] &&
        aliases[tableName][colName]
      ) {
        const newAliases = { ...aliases };
        const tableAliases = { ...newAliases[tableName] };
        delete tableAliases[colName];

        if (Object.keys(tableAliases).length === 0) {
          delete newAliases[tableName];
        } else {
          newAliases[tableName] = tableAliases;
        }
        onAliasesChange(newAliases);
      }
    } else {
      newCols = [...currentCols, colName];
    }

    const newValue = { ...value };
    if (newCols.length == 0) {
      delete newValue[tableName];
    } else {
      newValue[tableName] = newCols;
    }

    // onChange 호출 후 Alias 생성 (상태 업데이트 순서 수정)
    onChange(newValue);
    if (!isSelected && onAliasesChange) {
      const newAliases = { ...aliases };
      if (!newAliases[tableName]) {
        newAliases[tableName] = {};
      }
      newAliases[tableName][colName] = colName;
      onAliasesChange(newAliases);

      // 컬럼 선택 시 테이블 자동으로 펼치기
      setExpandedTables((prev) => new Set(prev).add(tableName));
    }
  };

  // 민감 컬럼 토글
  const handleSensitiveToggle = (tableName: string, colName: string) => {
    if (!onSensitiveColumnsChange) return;

    const currentSensitive = sensitiveColumns[tableName] || [];
    const isSensitive = currentSensitive.includes(colName);

    let newSensitive;
    if (isSensitive) {
      newSensitive = currentSensitive.filter((c) => c !== colName);
    } else {
      newSensitive = [...currentSensitive, colName];
    }

    const newValue = { ...sensitiveColumns };
    if (newSensitive.length == 0) {
      delete newValue[tableName];
    } else {
      newValue[tableName] = newSensitive;
    }
    onSensitiveColumnsChange(newValue);
  };

  // Alias 변경
  const handleAliasChange = (
    tableName: string,
    colName: string,
    alias: string,
  ) => {
    if (!onAliasesChange) return;

    const newAliases = { ...aliases };
    if (!newAliases[tableName]) {
      newAliases[tableName] = {};
    }

    if (alias.trim()) {
      newAliases[tableName][colName] = alias.trim();
    } else {
      // Alias 비우면 삭제
      delete newAliases[tableName][colName];
      if (Object.keys(newAliases[tableName]).length === 0) {
        delete newAliases[tableName];
      }
    }

    onAliasesChange(newAliases);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        <p>데이터베이스 스키마를 불러오는 중...</p>
      </div>
    );
  }
  if (!loading && tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
        <Database className="w-10 h-10 mb-2 opacity-20" />
        <p className="text-sm">조회된 테이블이 없습니다.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Search Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="테이블 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
          />
        </div>

        {/* 자동 청킹 설정 */}
        <label
          className="flex items-center gap-2 cursor-pointer group select-none px-2 flex-none"
          title="자동 청킹 설정"
        >
          <input
            type="checkbox"
            checked={enableAutoChunking}
            onChange={(e) => onEnableAutoChunkingChange?.(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            자동 청킹
          </span>
          <div className="relative group/tooltip">
            <CircleHelp className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" />
            <div className="invisible group-hover/tooltip:visible absolute right-0 top-full mt-2 z-50 w-64 p-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none">
              긴 텍스트(1,000자 초과)를 자동으로 분할하여 검색 성능과 정확도를
              향상시킵니다.
            </div>
          </div>
        </label>

        {/* DB 연결 수정 버튼 */}
        {onEditConnection && (
          <button
            onClick={onEditConnection}
            disabled={isEditingLoading}
            className="px-3 py-2 text-sm font-medium bg-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 shadow-sm disabled:opacity-50 flex items-center gap-1.5 flex-none"
            title="DB 연결 정보 수정"
          >
            {isEditingLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Settings className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">DB 연결 수정</span>
          </button>
        )}
      </div>

      {/* JOIN 설정 패널 */}
      {selectedTables.length === 2 && (
        <div className="mx-4 mt-4 mb-2 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="mt-0.5">
              {joinConfig ? (
                <LinkIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              )}
            </div>
            <div className="flex-1">
              {joinConfig && joinConfig.joins ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      테이블 연결됨
                    </h4>
                    <div className="flex items-center gap-2 text-sm">
                      <code className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-blue-100 dark:border-blue-700 font-medium text-blue-900 dark:text-blue-100">
                        {joinConfig.joins[0].from_table}.
                        {joinConfig.joins[0].from_column}
                      </code>
                      <ArrowRight className="w-4 h-4 text-blue-400 dark:text-blue-500" />
                      <code className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-blue-100 dark:border-blue-700 font-medium text-blue-900 dark:text-blue-100">
                        {joinConfig.joins[0].to_table}.
                        {joinConfig.joins[0].to_column}
                      </code>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    <strong>{joinConfig.base_table}</strong> 데이터를 중심으로{' '}
                    <strong>{joinConfig.joins[0].to_table}</strong> 정보를
                    덧붙입니다. (LEFT JOIN)
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">
                    선택한 테이블 간 FK 관계가 없습니다
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    테이블을 1개만 선택하거나, FK 관계가 있는 테이블을
                    선택하세요. (현재 상태로는 연결이 불가능합니다.)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredTables.map((table) => {
          const selectedCols = value[table.table_name] || [];
          const isAllSelected = selectedCols.length === table.columns.length;
          const isPartial = selectedCols.length > 0 && !isAllSelected;
          const isExpanded = expandedTables.has(table.table_name);
          return (
            <div
              key={table.table_name}
              className="mb-2 border border-gray-100 dark:border-gray-700/50 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
            >
              {/* Table Header Row */}
              <div
                className={`flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${selectedCols.length > 0 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                onClick={() => toggleExpand(table.table_name)}
              >
                {/* Expand Icon */}
                <button className="mr-2 text-gray-400">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {/* Checkbox (Table Select) */}
                <div
                  className="mr-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTableToggle(
                      table.table_name,
                      table.columns.map((c) => c.name),
                    );
                  }}
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : isPartial ? (
                    <MinusSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                  )}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {table.table_name}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({table.columns.length} columns)
                  </span>
                </div>

                {/* 암호화 전체 선택 체크박스 */}
                {onSensitiveColumnsChange && selectedCols.length > 0 && (
                  <div
                    className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors mr-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentSensitive =
                        sensitiveColumns[table.table_name] || [];
                      const isAllSensitive =
                        currentSensitive.length === selectedCols.length;

                      const newSensitive = { ...sensitiveColumns };
                      if (isAllSensitive) {
                        delete newSensitive[table.table_name];
                      } else {
                        newSensitive[table.table_name] = selectedCols;
                      }
                      onSensitiveColumnsChange(newSensitive);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        (sensitiveColumns[table.table_name] || []).length ===
                          selectedCols.length && selectedCols.length > 0
                      }
                      onChange={() => {}}
                      className="w-3 h-3 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span
                      className={`flex items-center gap-1 ${
                        (sensitiveColumns[table.table_name] || []).length ===
                          selectedCols.length && selectedCols.length > 0
                          ? 'text-orange-600 dark:text-orange-400 font-medium'
                          : ''
                      }`}
                    >
                      {(sensitiveColumns[table.table_name] || []).length ===
                        selectedCols.length && selectedCols.length > 0 ? (
                        <Lock className="w-3 h-3" />
                      ) : (
                        <LockOpen className="w-3 h-3" />
                      )}{' '}
                      전체 암호화
                    </span>
                  </div>
                )}
              </div>
              {/* Columns List */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/30 dark:bg-gray-900/30 p-2 pl-12 space-y-1">
                  {table.columns.map((col) => {
                    const isChecked = selectedCols.includes(col.name);
                    const isSensitive = (
                      sensitiveColumns[table.table_name] || []
                    ).includes(col.name);
                    return (
                      <div
                        key={col.name}
                        className="flex items-center gap-3 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded group"
                      >
                        <label className="flex items-center gap-3 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              handleColumnToggle(table.table_name, col.name)
                            }
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span
                            className={`text-sm ${isChecked ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-900'}`}
                          >
                            {col.name}
                          </span>
                          <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                            {col.type}
                          </span>
                        </label>

                        {isChecked && onSensitiveColumnsChange && (
                          <label
                            className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSensitive}
                              onChange={() =>
                                handleSensitiveToggle(
                                  table.table_name,
                                  col.name,
                                )
                              }
                              className="w-3 h-3 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            />
                            <span
                              className={`flex items-center gap-1 ${
                                isSensitive
                                  ? 'text-orange-600 dark:text-orange-400 font-medium'
                                  : ''
                              }`}
                            >
                              {isSensitive ? (
                                <Lock className="w-3 h-3" />
                              ) : (
                                <LockOpen className="w-3 h-3" />
                              )}{' '}
                              암호화 저장
                            </span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
