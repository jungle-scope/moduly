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
} from 'lucide-react';
import { connectorApi } from '@/app/features/knowledge/api/connectorApi';
import { toast } from 'sonner';

interface SchemaColumn {
  name: string;
  type: string;
}

interface SchemaTable {
  table_name: string;
  columns: SchemaColumn[];
}

interface DBSchemaSelectorProps {
  connectionId: string;
  value: Record<string, string[]>;
  onChange: (value: Record<string, string[]>) => void;
}

export default function DBSchemaSelector({
  connectionId,
  value,
  onChange,
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
      } catch (err) {
        console.error('Failed to fetch schema', err);
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

  // 테이블 전체 선택/해제
  const handleTableToggle = (tableName: string, allColumns: string[]) => {
    const currentCols = value[tableName] || [];
    const isAllSelected = currentCols.length == allColumns.length;

    const newValue = { ...value };
    if (isAllSelected) {
      delete newValue[tableName]; // 전체 해제
    } else {
      newValue[tableName] = allColumns; // 전체 선택
    }
    onChange(newValue);
  };

  // 개별 컬럼 선택/해제
  const handleColumnToggle = (tableName: string, colName: string) => {
    const currentCols = value[tableName] || [];
    const isSelected = currentCols.includes(colName);

    let newCols;
    if (isSelected) {
      newCols = currentCols.filter((c) => c !== colName);
    } else {
      newCols = [...currentCols, colName];
    }

    const newValue = { ...value };
    if (newCols.length == 0) {
      delete newValue[tableName];
    } else {
      newValue[tableName] = newCols;
    }
    onChange(newValue);
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
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="테이블 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
          />
        </div>
      </div>
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
              </div>
              {/* Columns List */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/30 dark:bg-gray-900/30 p-2 pl-12 space-y-1">
                  {table.columns.map((col) => {
                    const isChecked = selectedCols.includes(col.name);
                    return (
                      <label
                        key={col.name}
                        className="flex items-center gap-3 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded cursor-pointer group"
                      >
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
