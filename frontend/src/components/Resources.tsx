import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Folder, FileText, Plus, Trash2, ArrowLeft, Search, Download, 
  Eye, BookOpen, ChevronRight, X, Check, Copy, FileCode,
  FileSpreadsheet, FileArchive, Upload, FolderPlus, Info, ArrowUpDown
} from 'lucide-react';
import { useAuth, useData } from '../context/AppContext';
import { ResourceFolder, ResourceItem, Branch } from '../types';
import { Button, Input, Select, HighlightText, UserNameWithTag } from './UI';
import { SimpleMarkdown } from './Markdown';
import { airtableService } from '../services/airtableService';
import { DatabaseLoader } from './DatabaseLoader';

// Helper to convert a Data URL back to a binary Blob for accurate file downloads
const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const base64Data = parts[1] || '';
  const mimeMatch = header.match(/data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const byteString = atob(base64Data);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
};

// Helper to match filenames/descriptions with wildcard patterns like *.pdf or abc_*.pdf
const matchesResourceSearch = (res: ResourceItem, rawQuery: string): boolean => {
  const q = rawQuery.trim();
  if (!q) return true;

  if (q.includes('*') || q.includes('?')) {
    const escaped = q
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    // If pattern ends with an extension or wildcard, anchor appropriately against the file name
    const regex = new RegExp(escaped.endsWith('.*') ? escaped : `${escaped}$`, 'i');
    const looseRegex = new RegExp(escaped, 'i');
    return regex.test(res.name) || looseRegex.test(res.name);
  }

  const lower = q.toLowerCase();
  return (
    res.name.toLowerCase().includes(lower) ||
    Boolean(res.description && res.description.toLowerCase().includes(lower))
  );
};

export const Resources = () => {
  const { user } = useAuth();
  const { 
    folders, resources, setResources,
    createFolder, deleteFolder, 
    uploadResource, deleteResource,
    isAirtableLoading, loadingTabPath
  } = useData();

  // Branch isolation: Students and CRs only see their branch's drive
  const effectiveBranch: Branch = (user?.branch && user.branch !== '-') ? user.branch : 'CS';
  const isCR = user?.role === 'CR';

  // Navigation, Search & Sort State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  // Focused / Selected Item for Tab & Enter Keyboard Navigation
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Deletion state for non-blocking in-app confirmation
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'folder' | 'resource';
    id: string;
    name: string;
  } | null>(null);

  // Modals
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'markdown'>('file');
  const [uploadForm, setUploadForm] = useState<{
    name: string;
    folder_id: string | null;
    type: 'md' | 'pdf' | 'code' | 'doc' | 'archive' | 'other';
    size: string;
    description: string;
    content: string;
  }>({
    name: '',
    folder_id: null,
    type: 'md',
    size: '12 KB',
    description: '',
    content: ''
  });

  // Markdown Viewer Modal State
  const [viewingMarkdownResource, setViewingMarkdownResource] = useState<ResourceItem | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // File input ref for real file upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current folder data
  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    return folders.find(f => f.id === currentFolderId && f.branch === effectiveBranch) || null;
  }, [folders, currentFolderId, effectiveBranch]);

  // Compute Breadcrumb Trail
  const breadcrumbs = useMemo(() => {
    const trail: Array<{ id: string | null; name: string }> = [
      { id: null, name: `${effectiveBranch} Root Drive` }
    ];

    if (!currentFolderId) return trail;

    const pathFolders: ResourceFolder[] = [];
    let curr: ResourceFolder | undefined = folders.find(f => f.id === currentFolderId);

    while (curr) {
      pathFolders.unshift(curr);
      if (curr.parent_id) {
        curr = folders.find(f => f.id === curr?.parent_id);
      } else {
        break;
      }
    }

    pathFolders.forEach(f => {
      trail.push({ id: f.id, name: f.name });
    });

    return trail;
  }, [folders, currentFolderId, effectiveBranch]);

  // Filter folders in the current directory
  const currentFolders = useMemo(() => {
    const list = folders.filter(f => f.branch === effectiveBranch && f.parent_id === currentFolderId);
    return [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      return b.created_at - a.created_at;
    });
  }, [folders, effectiveBranch, currentFolderId, sortBy]);

  // Filter resources in the current directory or via search (with glob support like *.pdf, abc_*.pdf)
  const currentResources = useMemo(() => {
    let list = resources.filter(r => r.branch === effectiveBranch);

    if (searchQuery.trim()) {
      list = list.filter(r => matchesResourceSearch(r, searchQuery));
    } else {
      list = list.filter(r => r.folder_id === currentFolderId);
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      return b.uploaded_at - a.uploaded_at;
    });
  }, [resources, effectiveBranch, currentFolderId, searchQuery, sortBy]);

  // Flat list of visible items for keyboard navigation (Folders first, then Files)
  const visibleItems = useMemo(() => {
    const items: Array<{
      type: 'folder' | 'resource';
      id: string;
      item: ResourceFolder | ResourceItem;
    }> = [];

    if (!searchQuery) {
      currentFolders.forEach(f => items.push({ type: 'folder', id: f.id, item: f }));
    }
    currentResources.forEach(r => items.push({ type: 'resource', id: r.id, item: r }));
    return items;
  }, [currentFolders, currentResources, searchQuery]);

  // Reset selectedIndex whenever directory or search changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [currentFolderId, searchQuery, sortBy]);

  // Track loading state for on-demand resource content fetches
  const [loadingResourceId, setLoadingResourceId] = useState<string | null>(null);

  // On-demand file viewer (fetches content strictly when required)
  const handleViewResource = async (res: ResourceItem) => {
    let content: any = res.content;
    const isMalformed =
      content === undefined ||
      typeof content !== 'string' ||
      content === '[object Object]' ||
      content === '[object Objects]' ||
      content.startsWith('[object');

    if (isMalformed) {
      setLoadingResourceId(res.id);
      try {
        content = await airtableService.fetchResourceContent(res.id);
      } catch (err) {
        console.warn('[Resources] Error loading resource content:', err);
      } finally {
        setLoadingResourceId(null);
      }
    }

    // If content is an attachment array or object (edge case from direct Airtable response)
    if (Array.isArray(content) && content.length > 0) {
      content = content[0]?.url || '';
    } else if (content && typeof content === 'object') {
      content = content.url || '';
    }

    // If content is an Airtable CDN URL pointing to a markdown or text file, fetch its text
    if (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://'))) {
      setLoadingResourceId(res.id);
      try {
        const textRes = await fetch(content);
        if (textRes.ok) {
          content = await textRes.text();
        }
      } catch (e) {
        console.warn('[Resources] Error fetching markdown text from URL:', e);
      } finally {
        setLoadingResourceId(null);
      }
    }

    // Sanitize any lingering malformed value
    const finalContent =
      typeof content === 'string' &&
      content &&
      content !== '[object Object]' &&
      content !== '[object Objects]' &&
      !content.startsWith('[object')
        ? content
        : `# ${res.name}\n\n${res.description || 'Educational resource uploaded on IRIS portal.'}`;

    // Update in memory so subsequent views do not need to re-fetch
    res.content = finalContent;

    setViewingMarkdownResource({
      ...res,
      content: finalContent
    });
  };

  // Close markdown viewer and immediately purge file contents from memory cache
  const handleCloseMarkdownViewer = () => {
    if (viewingMarkdownResource) {
      const targetId = viewingMarkdownResource.id;
      viewingMarkdownResource.content = undefined;
      setResources(prev =>
        prev.map(r => (r.id === targetId ? { ...r, content: undefined } : r))
      );
    }
    setViewingMarkdownResource(null);
  };

  // Accurate file download generator (fetches content strictly on-demand when downloading)
  const handleDownload = async (res: ResourceItem) => {
    let content: any = res.content;
    const isMalformed =
      content === undefined ||
      typeof content !== 'string' ||
      content === '[object Object]' ||
      content === '[object Objects]' ||
      content.startsWith('[object');

    if (isMalformed) {
      setLoadingResourceId(res.id);
      try {
        content = await airtableService.fetchResourceContent(res.id);
      } catch (err) {
        console.warn('[Resources] Error loading resource content for download:', err);
      } finally {
        setLoadingResourceId(null);
      }
    }

    // If content is an attachment array or object (edge case)
    if (Array.isArray(content) && content.length > 0) {
      content = content[0]?.url || '';
    } else if (content && typeof content === 'object') {
      content = content.url || '';
    }

    // If content is a direct HTTP/HTTPS URL (Airtable CDN URL)
    if (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://'))) {
      try {
        const fileRes = await fetch(content);
        if (fileRes.ok) {
          const blob = await fileRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = res.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        }
      } catch {
        // Direct link fallback
        const a = document.createElement('a');
        a.href = content;
        a.download = res.name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
    }

    let blob: Blob;

    if (typeof content === 'string' && content.startsWith('data:')) {
      blob = dataUrlToBlob(content);
    } else {
      const contentToDownload =
        typeof content === 'string' &&
        content !== '' &&
        content !== '[object Object]' &&
        content !== '[object Objects]' &&
        !content.startsWith('[object')
          ? content
          : `# ${res.name}\n\n${res.description || 'Educational resource uploaded on IRIS portal.'}`;

      const mimeType = res.name.endsWith('.md')
        ? 'text/markdown;charset=utf-8'
        : res.name.endsWith('.c')
        ? 'text/x-c;charset=utf-8'
        : res.name.endsWith('.py')
        ? 'text/x-python;charset=utf-8'
        : 'text/plain;charset=utf-8';

      blob = new Blob([contentToDownload], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Purge downloaded file content from memory
    res.content = undefined;
    setResources(prev =>
      prev.map(r => (r.id === res.id ? { ...r, content: undefined } : r))
    );
  };

  // Copy Markdown content
  const handleCopyMarkdown = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  // Keyboard navigation & shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (itemToDelete) {
          setItemToDelete(null);
          return;
        }
        if (viewingMarkdownResource) {
          handleCloseMarkdownViewer();
          return;
        }
        if (isFolderModalOpen) {
          setIsFolderModalOpen(false);
          return;
        }
        if (isUploadModalOpen) {
          setIsUploadModalOpen(false);
          return;
        }
      }

      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if (isFolderModalOpen || isUploadModalOpen || itemToDelete) {
        return;
      }

      if (viewingMarkdownResource) {
        if (e.key === 'Backspace' && !isInput) {
          e.preventDefault();
          setViewingMarkdownResource(null);
        }
        return;
      }

      if (e.key === 'Tab') {
        if (!isInput && visibleItems.length > 0) {
          e.preventDefault();
          if (e.shiftKey) {
            setSelectedIndex(prev => (prev <= 0 ? visibleItems.length - 1 : prev - 1));
          } else {
            setSelectedIndex(prev => (prev + 1) % visibleItems.length);
          }
        }
        return;
      }

      if (e.key === 'Enter') {
        if (!isInput && selectedIndex >= 0 && selectedIndex < visibleItems.length) {
          e.preventDefault();
          const targetItem = visibleItems[selectedIndex];
          if (targetItem.type === 'folder') {
            setCurrentFolderId(targetItem.id);
            setSelectedIndex(-1);
          } else {
            const res = targetItem.item as ResourceItem;
            const isMd = res.type === 'md' || res.name.toLowerCase().endsWith('.md');
            if (isMd) {
              handleViewResource(res);
            } else {
              handleDownload(res);
            }
          }
        }
        return;
      }

      if (e.key === 'Backspace') {
        if (!isInput) {
          e.preventDefault();
          if (currentFolderId) {
            setCurrentFolderId(currentFolder?.parent_id || null);
            setSelectedIndex(-1);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    visibleItems, selectedIndex, currentFolderId, currentFolder, 
    viewingMarkdownResource, isFolderModalOpen, isUploadModalOpen, itemToDelete
  ]);

  // Counts for folders
  const getFolderItemCounts = (folderId: string) => {
    const subfolderCount = folders.filter(f => f.parent_id === folderId).length;
    const fileCount = resources.filter(r => r.folder_id === folderId).length;
    return { subfolderCount, fileCount, total: subfolderCount + fileCount };
  };

  // Handle local file selection — preserves exact file contents for both text & binary files
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;

    let fileType: ResourceItem['type'] = 'other';
    if (ext === 'md' || ext === 'markdown') fileType = 'md';
    else if (ext === 'pdf') fileType = 'pdf';
    else if (['c', 'cpp', 'py', 'java', 'js', 'ts', 'sql', 'sh'].includes(ext)) fileType = 'code';
    else if (['doc', 'docx', 'txt'].includes(ext)) fileType = 'doc';
    else if (['zip', 'tar', 'gz', 'rar'].includes(ext)) fileType = 'archive';

    // For Markdown files, read as text so the in-app Markdown reader can render it directly
    if (ext === 'md' || ext === 'markdown') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) ?? '';
        setUploadForm(prev => ({
          ...prev,
          name: fileName,
          type: fileType,
          size: sizeStr,
          content: text
        }));
      };
      reader.readAsText(file);
    } else {
      // For all other files (txt, pdf, code, zip, binary, other), read as DataURL so downloading restores exact file bytes
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = (event.target?.result as string) ?? '';
        setUploadForm(prev => ({
          ...prev,
          name: fileName,
          type: fileType,
          size: sizeStr,
          content: dataUrl
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim(), currentFolderId, effectiveBranch);
    setNewFolderName('');
    setIsFolderModalOpen(false);
  };

  const handleUploadSubmit = () => {
    if (!uploadForm.name.trim()) return;

    let finalName = uploadForm.name.trim();
    if (uploadMode === 'markdown' && !finalName.toLowerCase().endsWith('.md')) {
      finalName += '.md';
    }

    uploadResource({
      name: finalName,
      folder_id: uploadForm.folder_id,
      branch: effectiveBranch,
      size: uploadForm.size || '12 KB',
      type: uploadMode === 'markdown' ? 'md' : uploadForm.type,
      description: uploadForm.description.trim(),
      content: uploadForm.content,
      uploaded_by: user?.name || 'Class Representative'
    });

    setIsUploadModalOpen(false);
    setUploadForm({
      name: '',
      folder_id: currentFolderId,
      type: 'md',
      size: '12 KB',
      description: '',
      content: ''
    });
  };

  const renderFileIcon = (type: ResourceItem['type']) => {
    switch (type) {
      case 'md':
        return <FileText className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0" />;
      case 'pdf':
        return <BookOpen className="w-5 h-5 text-rose-500 shrink-0" />;
      case 'code':
        return <FileCode className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case 'doc':
        return <FileSpreadsheet className="w-5 h-5 text-blue-500 shrink-0" />;
      case 'archive':
        return <FileArchive className="w-5 h-5 text-amber-600 shrink-0" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-5 select-none animate-fade-in">
      {/* Header Bar (File Explorer Yellow Base Tint) */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-yellow-200/70 dark:border-slate-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 border border-yellow-200/60 dark:border-yellow-900/40">
              <Folder className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Educational Resources
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-yellow-50 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300 border border-yellow-200/60 dark:border-yellow-900/50">
              {effectiveBranch} Branch
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Course notes, past exam papers, lecture summaries and code repositories curated for {effectiveBranch} batch.
          </p>
        </div>

        {/* CR Management Actions */}
        {isCR ? (
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setNewFolderName('');
                setIsFolderModalOpen(true);
              }}
              className="!text-xs !py-2"
            >
              <FolderPlus className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
              <span>New Folder</span>
            </Button>

            <button 
              onClick={() => {
                setUploadForm({
                  name: '',
                  folder_id: currentFolderId,
                  type: 'md',
                  size: '15 KB',
                  description: '',
                  content: ''
                });
                setUploadMode('file');
                setIsUploadModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-yellow-600 hover:bg-yellow-700 text-white shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Resource</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-yellow-50/50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-yellow-200/60 dark:border-slate-700">
            <Info className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
            <span>Read & Download Access</span>
          </div>
        )}
      </div>

      {/* Directory Explorer Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-yellow-200/60 dark:border-slate-800 p-5 shadow-2xs space-y-5">
        {/* Breadcrumb Navigation, Search & Minimal Sort Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
          {/* Breadcrumb Trail */}
          <nav className="flex items-center flex-wrap gap-1.5 text-xs">
            {breadcrumbs.map((b, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={b.id || 'root'}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  <button
                    onClick={() => {
                      setCurrentFolderId(b.id);
                      setSearchQuery('');
                      setSelectedIndex(-1);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      isLast
                        ? 'bg-yellow-50 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300 font-bold border border-yellow-200/60 dark:border-yellow-900/50'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {idx === 0 ? <Folder className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" /> : null}
                    <span>{b.name}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          {/* Search Input (Supports *.pdf, abc_*.pdf) & Minimal Sort Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search or filter (e.g. *.pdf, lab_*.c)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-yellow-500/25 focus:border-yellow-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Very Minimal Sort Dropdown */}
            <div className="relative flex items-center shrink-0">
              <ArrowUpDown className="w-3 h-3 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
                aria-label="Sort resources"
                className="pl-7 pr-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-yellow-500/25 cursor-pointer"
              >
                <option value="date">Date Added</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Directory Contents Wrapper with Folder/Sort Transition */}
        {(loadingTabPath === '/resources' || (isAirtableLoading && folders.length === 0 && resources.length === 0)) ? (
          <div className="py-8">
            <DatabaseLoader 
              type="resource_directory" 
              resourceName={`${effectiveBranch} Branch Resource Directory`}
              message="Fetching folder tree and educational document metadata from database..." 
              variant="panel"
            />
          </div>
        ) : (
          <div key={`${currentFolderId || 'root'}-${sortBy}`} className="space-y-5 animate-tab-enter">
          {/* 1. Folders Section (Shown when not searching) */}
          {!searchQuery && currentFolders.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                <span>Folders ({currentFolders.length})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentFolders.map((folder) => {
                  const counts = getFolderItemCounts(folder.id);
                  const itemIndex = visibleItems.findIndex(v => v.id === folder.id);
                  const isSelected = selectedIndex === itemIndex;

                  return (
                    <div
                      key={folder.id}
                      onClick={() => {
                        setCurrentFolderId(folder.id);
                        setSelectedIndex(-1);
                      }}
                      className={`group p-3.5 rounded-xl border transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer flex items-center justify-between shadow-2xs hover:shadow-sm ${
                        isSelected
                          ? 'ring-2 ring-yellow-500/80 dark:ring-yellow-400/80 bg-yellow-50/50 dark:bg-slate-800 border-yellow-300 dark:border-yellow-600'
                          : 'border-slate-200/70 dark:border-slate-800 bg-yellow-50/25 dark:bg-slate-800/40 hover:bg-yellow-50/60 dark:hover:bg-slate-800 hover:border-yellow-300 dark:hover:border-yellow-700/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-yellow-100/80 dark:bg-yellow-950/50 flex items-center justify-center text-yellow-700 dark:text-yellow-400 shrink-0 border border-yellow-200/60 dark:border-yellow-900/50 transition-transform duration-150 group-hover:scale-105">
                          <Folder className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-yellow-800 dark:group-hover:text-yellow-300 transition-colors">
                            {folder.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {counts.total} item{counts.total !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {isCR && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToDelete({ type: 'folder', id: folder.id, name: folder.name });
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/60 dark:hover:bg-slate-700 active:scale-90 transition-all cursor-pointer"
                            title={`Delete folder "${folder.name}"`}
                            aria-label="Delete folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Files & Documents Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                <span>
                  {searchQuery ? `Search Results (${currentResources.length})` : `Files & Notes (${currentResources.length})`}
                </span>
              </h3>

              {currentFolderId && !searchQuery && (
                <button
                  onClick={() => {
                    setCurrentFolderId(currentFolder?.parent_id || null);
                    setSelectedIndex(-1);
                  }}
                  className="text-xs text-yellow-700 dark:text-yellow-400 hover:underline flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                  title="Go to parent directory"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to parent
                </button>
              )}
            </div>

            {currentResources.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-900/30 animate-fade-in">
                <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {searchQuery 
                    ? 'No matching files or documents found.' 
                    : 'No files uploaded in this directory yet.'}
                </p>
                {isCR && !searchQuery && (
                  <div className="mt-3">
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        setUploadForm({
                          name: '',
                          folder_id: currentFolderId,
                          type: 'md',
                          size: '12 KB',
                          description: '',
                          content: ''
                        });
                        setIsUploadModalOpen(true);
                      }}
                      className="!text-xs !py-1.5 !px-3 mx-auto"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add File Here
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {currentResources.map((res) => {
                  const isMarkdown = res.type === 'md' || res.name.toLowerCase().endsWith('.md');
                  const uploadDateStr = new Date(res.uploaded_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  const itemIndex = visibleItems.findIndex(v => v.id === res.id);
                  const isSelected = selectedIndex === itemIndex;

                  return (
                    <div
                      key={res.id}
                      onClick={() => setSelectedIndex(itemIndex)}
                      className={`p-3.5 rounded-xl border transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group shadow-2xs hover:shadow-xs ${
                        isSelected
                          ? 'ring-2 ring-yellow-500/80 dark:ring-yellow-400/80 bg-yellow-50/40 dark:bg-slate-800/90 border-yellow-300 dark:border-yellow-600'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-yellow-300 dark:hover:border-yellow-700/60'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-yellow-50/70 dark:bg-slate-700/60 shrink-0 mt-0.5 border border-yellow-100 dark:border-slate-700 transition-transform duration-150 group-hover:scale-105">
                          {renderFileIcon(res.type)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 
                              onClick={(e) => {
                                if (isMarkdown) {
                                  e.stopPropagation();
                                  handleViewResource(res);
                                }
                              }}
                              className={`text-xs font-bold text-slate-800 dark:text-slate-100 truncate ${
                                isMarkdown ? 'cursor-pointer hover:text-yellow-700 dark:hover:text-yellow-400 hover:underline' : ''
                              }`}
                            >
                              <HighlightText text={res.name} query={searchQuery} />
                            </h4>

                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                              {res.size}
                            </span>
                          </div>

                          {res.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              <HighlightText text={res.description} query={searchQuery} />
                            </p>
                          )}

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                            <span className="inline-flex items-center gap-1">
                              Uploaded by <UserNameWithTag name={res.uploaded_by} className="text-slate-600 dark:text-slate-300 font-medium" />
                            </span>
                            <span>•</span>
                            <span>{uploadDateStr}</span>
                          </div>
                        </div>
                      </div>

                      {/* Minimalist Action Buttons */}
                      <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                        {isMarkdown && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewResource(res);
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:text-yellow-700 dark:text-slate-400 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-slate-700/70 active:scale-90 transition-all cursor-pointer"
                            title={loadingResourceId === res.id ? 'Loading...' : `Read ${res.name}`}
                            aria-label="Read document"
                            disabled={loadingResourceId === res.id}
                          >
                            <Eye className={`w-4 h-4 ${loadingResourceId === res.id ? 'animate-spin' : ''}`} />
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(res);
                          }}
                          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/70 active:scale-90 transition-all cursor-pointer"
                          title={`Download ${res.name}`}
                          aria-label="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {isCR && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToDelete({ type: 'resource', id: res.id, name: res.name });
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-90 transition-all cursor-pointer"
                            title={`Delete ${res.name}`}
                            aria-label="Delete resource"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>

      {/* ON-DEMAND RESOURCE FILE CONTENT FETCHING MODAL */}
      {loadingResourceId && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 max-w-md w-full animate-scale-in">
            <DatabaseLoader 
              type="resource_content"
              resourceName="File Content"
              message="Fetching document content and raw markdown from database..."
              variant="card"
            />
          </div>
        </div>
      )}

      {/* IN-APP CONFIRM DELETION MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-sm p-6 space-y-4 animate-scale-in">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Delete {itemToDelete.type === 'folder' ? 'Folder' : 'Resource'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-200 break-words">{itemToDelete.name}</strong>?
                  {itemToDelete.type === 'folder' && ' All contents inside this folder will also be removed.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/80">
              <Button variant="ghost" onClick={() => setItemToDelete(null)}>
                Cancel
              </Button>
              <button
                onClick={() => {
                  if (itemToDelete.type === 'folder') {
                    deleteFolder(itemToDelete.id);
                  } else {
                    deleteResource(itemToDelete.id);
                  }
                  setItemToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. MARKDOWN VIEWER MODAL */}
      {viewingMarkdownResource && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 bg-yellow-50/40 dark:bg-slate-900/60 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-yellow-100/80 dark:bg-slate-700 text-yellow-700 dark:text-yellow-400 shrink-0 border border-yellow-200/50 dark:border-slate-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    {viewingMarkdownResource.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    <span>{viewingMarkdownResource.size}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      Uploaded by <UserNameWithTag name={viewingMarkdownResource.uploaded_by} />
                    </span>
                  </div>
                </div>
              </div>

              {/* Reader Action Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyMarkdown(viewingMarkdownResource.content || '')}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-650 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy markdown to clipboard"
                >
                  {copiedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDownload(viewingMarkdownResource)}
                  className="p-1.5 rounded-xl bg-yellow-50 dark:bg-yellow-950/60 border border-yellow-200/60 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 transition-colors cursor-pointer"
                  title="Download file"
                  aria-label="Download"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={handleCloseMarkdownViewer}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer ml-1"
                  title="Close reader"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Markdown Rendered Content Area */}
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-slate-900 select-text">
              <div className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed text-sm">
                <SimpleMarkdown highlightQuery={searchQuery}>
                  {viewingMarkdownResource.content || viewingMarkdownResource.description || '# No Content Provided'}
                </SimpleMarkdown>
              </div>
            </div>

            {/* Reader Footer */}
            <div className="p-3.5 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
              <span>Document Viewer</span>
              <Button variant="ghost" onClick={handleCloseMarkdownViewer} className="!text-xs !py-1">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CREATE FOLDER MODAL (CR Only) */}
      {isFolderModalOpen && isCR && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-yellow-50/40 dark:bg-slate-900/50">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <span>Create New Folder</span>
              </h3>
              <button 
                onClick={() => setIsFolderModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Location: <strong>{breadcrumbs[breadcrumbs.length - 1].name}</strong> ({effectiveBranch} Branch)
                </p>
                <Input
                  label="Folder Name *"
                  placeholder="e.g. Operating Systems Lecture Notes"
                  value={newFolderName}
                  onChange={(e: any) => setNewFolderName(e.target.value)}
                  onKeyDown={(e: any) => e.key === 'Enter' && handleCreateFolder()}
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsFolderModalOpen(false)}>
                  Cancel
                </Button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white transition-all cursor-pointer"
                >
                  Create Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. UPLOAD RESOURCE MODAL (CR Only) */}
      {isUploadModalOpen && isCR && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-yellow-50/40 dark:bg-slate-900/50 shrink-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Upload className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <span>Upload Educational Resource</span>
              </h3>
              <button 
                onClick={() => setIsUploadModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {/* Method Switcher: Upload File vs Write Document */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    uploadMode === 'file'
                      ? 'bg-white dark:bg-slate-800 text-yellow-700 dark:text-yellow-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Local File</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('markdown');
                    setUploadForm(prev => ({ ...prev, type: 'md' }));
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    uploadMode === 'markdown'
                      ? 'bg-white dark:bg-slate-800 text-yellow-700 dark:text-yellow-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Write Notes (.md)</span>
                </button>
              </div>

              {/* Destination Folder Selector */}
              <Select
                label="Destination Folder"
                value={uploadForm.folder_id || ''}
                onChange={(e: any) => setUploadForm({ ...uploadForm, folder_id: e.target.value || null })}
              >
                <option value="">📁 Root Directory ({effectiveBranch} Drive)</option>
                {folders.filter(f => f.branch === effectiveBranch).map(f => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </Select>

              {uploadMode === 'file' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Select File from Device
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-yellow-50 file:text-yellow-800 hover:file:bg-yellow-100 dark:file:bg-slate-700 dark:file:text-slate-200 cursor-pointer border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-white dark:bg-slate-800"
                  />
                </div>
              ) : null}

              <Input
                label="Resource Title / File Name *"
                placeholder={uploadMode === 'markdown' ? 'e.g. Operating_Systems_Chapter_4_Paging.md' : 'e.g. DBMS_Syllabus.pdf'}
                value={uploadForm.name}
                onChange={(e: any) => setUploadForm({ ...uploadForm, name: e.target.value })}
              />

              <Input
                label="Short Description"
                placeholder="Brief summary of what this document covers..."
                value={uploadForm.description}
                onChange={(e: any) => setUploadForm({ ...uploadForm, description: e.target.value })}
              />

              {/* Notes Content Editor */}
              {uploadMode === 'markdown' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Document Content *
                  </label>
                  <textarea
                    rows={8}
                    placeholder="Write your study notes here..."
                    value={uploadForm.content}
                    onChange={(e) => setUploadForm({ ...uploadForm, content: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-yellow-500/20"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
              <Button variant="ghost" onClick={() => setIsUploadModalOpen(false)}>
                Cancel
              </Button>
              <button
                onClick={handleUploadSubmit}
                disabled={!uploadForm.name.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white transition-all cursor-pointer"
              >
                Save & Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
