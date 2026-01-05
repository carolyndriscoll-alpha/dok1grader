import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Brainlift } from '@shared/schema';
import { queryClient } from '@/lib/queryClient';
import { tokens } from '@/lib/colors';
import { Plus, X, Upload, FileText, Link as LinkIcon, File, Loader2, Check, Clock, AlertTriangle } from 'lucide-react';

type SourceType = 'pdf' | 'docx' | 'html' | 'workflowy' | 'googledocs' | 'text';

const tabs: { id: SourceType; label: string; icon: typeof FileText }[] = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'docx', label: 'Word', icon: File },
  { id: 'html', label: 'HTML', icon: FileText },
  { id: 'workflowy', label: 'Workflowy', icon: LinkIcon },
  { id: 'googledocs', label: 'Google Docs', icon: LinkIcon },
  { id: 'text', label: 'Paste Text', icon: FileText },
];

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<SourceType>('pdf');
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: brainlifts, isLoading } = useQuery<Brainlift[]>({
    queryKey: ['brainlifts'],
    queryFn: async () => {
      const res = await fetch('/api/brainlifts');
      if (!res.ok) throw new Error('Failed to fetch brainlifts');
      return res.json();
    }
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('sourceType', activeTab);

      if (activeTab === 'pdf' || activeTab === 'docx' || activeTab === 'html') {
        if (!selectedFile) throw new Error('Please select a file');
        formData.append('file', selectedFile);
      } else if (activeTab === 'workflowy' || activeTab === 'googledocs') {
        if (!url.trim()) throw new Error('Please enter a URL');
        formData.append('url', url);
      } else if (activeTab === 'text') {
        if (!textContent.trim()) throw new Error('Please enter some content');
        formData.append('content', textContent);
      }

      const res = await fetch('/api/brainlifts/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Import failed');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainlifts'] });
      closeModal();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to import');
    }
  });

  const closeModal = () => {
    setShowModal(false);
    setActiveTab('pdf');
    setUrl('');
    setTextContent('');
    setSelectedFile(null);
    setError('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
    }
  };

  const handleSubmit = () => {
    setError('');
    importMutation.mutate();
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: tokens.bg,
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header - surface bg with border */}
      <header 
        className="flex justify-between items-center flex-wrap gap-3 px-4 py-4 sm:px-8 md:px-12"
        style={{
          backgroundColor: tokens.surface,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: tokens.textPrimary,
            margin: 0,
          }}>DOK1 GRADING</h1>
          <p style={{ color: tokens.textSecondary, fontSize: '14px', marginTop: '4px' }}>
            Select a brainlift to grade
          </p>
        </div>
        {/* Primary button - only for main actions */}
        <button
          data-testid="button-add-brainlift"
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: tokens.primary,
            color: tokens.onPrimary,
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.primaryHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.primary}
        >
          <Plus size={18} />
          Add Brainlift
        </button>
      </header>

      {/* Thin primary indicator line */}
      <div style={{
        height: '2px',
        backgroundColor: tokens.primary,
      }} />

      <main className="px-4 sm:px-6 md:px-8 py-4 max-w-[1200px] mx-auto">
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: tokens.textMuted }} />
          </div>
        ) : brainlifts?.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 24px',
            backgroundColor: '#F9FAFB',
            borderRadius: '12px',
            border: '2px dashed #E5E7EB',
          }}>
            <Upload size={48} style={{ marginBottom: '16px', color: tokens.textMuted }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: tokens.primary, margin: '0 0 8px 0' }}>No brainlifts yet</h3>
            <p style={{ fontSize: '14px', color: tokens.textSecondary, margin: '0 0 20px 0' }}>
              Click "Add Brainlift" to upload your first one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
            {brainlifts?.map((data) => {
              const isNotGradeable = data.classification === 'not_brainlift';
              const meanScore = parseFloat(data.summary.meanScore || '0');
              const hasContradictions = data.summary.contradictionCount > 0;
              const authorInitials = data.author 
                ? data.author.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                : '??';
              
              const getScoreColor = () => {
                if (meanScore >= 4.5) return '#10B981';
                if (meanScore >= 4.0) return '#0D9488';
                if (meanScore >= 3.0) return '#EAB308';
                return '#EF4444';
              };
              
              const getStatus = () => {
                if (isNotGradeable) return { label: 'Not a Brainlift', bg: '#FEF3C7', color: '#B45309', border: '#F59E0B', icon: AlertTriangle };
                if (data.summary.totalFacts > 0) return { label: 'Graded', bg: '#ECFDF5', color: '#059669', border: '#10B981', icon: Check };
                return { label: 'Pending', bg: '#FEF3C7', color: '#B45309', border: '#F59E0B', icon: Clock };
              };
              
              const status = getStatus();
              const StatusIcon = status.icon;
              
              return (
                <Link
                  key={data.slug}
                  href={`/grading/${data.slug}`}
                  data-testid={`card-brainlift-${data.slug}`}
                  style={{
                    backgroundColor: isNotGradeable ? '#F9FAFB' : 'white',
                    border: isNotGradeable ? '1px dashed #D1D5DB' : '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '20px',
                    paddingRight: '24px',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    opacity: isNotGradeable ? 0.7 : 1,
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!isNotGradeable) {
                      e.currentTarget.style.borderColor = '#0D9488';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(13, 148, 136, 0.12)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    } else {
                      e.currentTarget.style.opacity = '0.85';
                      e.currentTarget.style.borderColor = '#9CA3AF';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isNotGradeable ? '#D1D5DB' : '#E5E7EB';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.opacity = isNotGradeable ? '0.7' : '1';
                  }}
                >
                  {/* Status Badge - Top Right */}
                  <span style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    whiteSpace: 'nowrap',
                    zIndex: 1,
                    backgroundColor: status.bg,
                    color: status.color,
                    border: `1px solid ${status.border}`,
                  }}>
                    <StatusIcon size={10} />
                    {status.label}
                  </span>
                  
                  {/* Card Header */}
                  <div style={{ marginBottom: '12px', paddingRight: '110px' }}>
                    <h3 style={{
                      fontSize: '17px',
                      fontWeight: 600,
                      color: '#111827',
                      margin: '0 0 6px 0',
                      lineHeight: 1.3,
                      wordWrap: 'break-word',
                    }}>{data.title}</h3>
                    <p style={{
                      fontSize: '14px',
                      color: '#6B7280',
                      margin: 0,
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>{data.description}</p>
                  </div>
                  
                  {/* Author & Date */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: '#6B7280',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#E5E7EB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#6B7280',
                      }}>{authorInitials}</span>
                      <span>{data.author || 'Unknown'}</span>
                    </div>
                  </div>
                  
                  {/* Stats Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    paddingTop: '16px',
                    borderTop: '1px solid #F3F4F6',
                    marginTop: 'auto',
                    flexWrap: 'wrap',
                  }}>
                    {/* Facts Badge */}
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500,
                      backgroundColor: isNotGradeable && data.summary.totalFacts === 0 ? '#FEE2E2' : '#F0FDFA',
                      color: isNotGradeable && data.summary.totalFacts === 0 ? '#DC2626' : '#0D9488',
                    }}>
                      <span style={{ fontWeight: 700 }}>{data.summary.totalFacts}</span> facts
                    </span>
                    
                    {/* Contradictions Badge */}
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500,
                      backgroundColor: hasContradictions ? '#FFF7ED' : '#F3F4F6',
                      color: hasContradictions ? '#EA580C' : '#6B7280',
                    }}>
                      {hasContradictions && <AlertTriangle size={12} />}
                      {data.summary.contradictionCount} {hasContradictions ? 'contradictions' : 'contradictions'}
                    </span>
                    
                    {/* Score Preview */}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#6B7280', textAlign: 'right', lineHeight: 1.3 }}>
                        Mean<br/>Score
                      </div>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isNotGradeable || data.summary.totalFacts === 0 ? '12px' : '14px',
                        fontWeight: 700,
                        color: isNotGradeable || data.summary.totalFacts === 0 ? '#6B7280' : 'white',
                        backgroundColor: isNotGradeable || data.summary.totalFacts === 0 ? '#E5E7EB' : getScoreColor(),
                      }}>
                        {isNotGradeable || data.summary.totalFacts === 0 ? 'N/A' : meanScore.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: tokens.overlay,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={closeModal}
        >
          <div
            className="p-4 sm:p-6 w-full max-w-[600px] max-h-[90vh] overflow-auto rounded-xl"
            style={{ backgroundColor: tokens.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: tokens.textPrimary, margin: 0 }}>
                Add New Brainlift
              </h2>
              <button
                data-testid="button-close-modal"
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: tokens.textSecondary,
                }}
              >
                <X size={24} />
              </button>
            </div>

            <p style={{ color: tokens.textSecondary, fontSize: '14px', marginBottom: '20px' }}>
              Add New Brainlift to Grade DOK1 facts and create a curated reading list.
            </p>

            {/* Secondary/ghost tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  data-testid={`tab-${tab.id}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setError('');
                    setSelectedFile(null);
                    setUrl('');
                    setTextContent('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: `1px solid ${activeTab === tab.id ? tokens.primary : tokens.border}`,
                    backgroundColor: activeTab === tab.id ? tokens.primarySoft : 'transparent',
                    color: activeTab === tab.id ? tokens.primary : tokens.textSecondary,
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ minHeight: '150px' }}>
              {(activeTab === 'pdf' || activeTab === 'docx' || activeTab === 'html') && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={activeTab === 'pdf' ? '.pdf' : activeTab === 'docx' ? '.docx,.doc' : '.html,.htm'}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    data-testid="input-file"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${tokens.border}`,
                      borderRadius: '8px',
                      padding: '40px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: selectedFile ? tokens.surfaceAlt : 'transparent',
                    }}
                  >
                    {selectedFile ? (
                      <>
                        <File size={32} color={tokens.secondary} style={{ marginBottom: '8px' }} />
                        <p style={{ margin: 0, color: tokens.textPrimary, fontWeight: 500 }}>{selectedFile.name}</p>
                        <p style={{ margin: '4px 0 0', color: tokens.textSecondary, fontSize: '13px' }}>
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload size={32} color={tokens.textMuted} style={{ marginBottom: '8px' }} />
                        <p style={{ margin: 0, color: tokens.textSecondary }}>
                          Click to upload {activeTab === 'pdf' ? 'a PDF' : activeTab === 'docx' ? 'a Word' : 'an HTML'} file
                        </p>
                        <p style={{ margin: '4px 0 0', color: tokens.textMuted, fontSize: '13px' }}>
                          Max file size: 10MB
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {(activeTab === 'workflowy' || activeTab === 'googledocs') && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: tokens.textPrimary, fontSize: '14px', fontWeight: 500 }}>
                    {activeTab === 'workflowy' ? 'Workflowy Share Link' : 'Google Docs URL'}
                  </label>
                  <input
                    type="url"
                    data-testid="input-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={activeTab === 'workflowy' ? 'https://workflowy.com/#/...' : 'https://docs.google.com/document/d/...'}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${tokens.border}`,
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <p style={{ marginTop: '8px', color: tokens.textMuted, fontSize: '13px' }}>
                    {activeTab === 'workflowy' 
                      ? 'Enter a Workflowy URL (e.g., https://workflowy.com/#/abc123) or node ID. Uses your connected Workflowy account.'
                      : 'Make sure your Google Doc has link sharing enabled (anyone with the link can view).'}
                  </p>
                </div>
              )}

              {activeTab === 'text' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: tokens.textPrimary, fontSize: '14px', fontWeight: 500 }}>
                    Paste your content
                  </label>
                  <textarea
                    data-testid="input-text"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Paste your educational content here. Include facts, claims, and any source references..."
                    style={{
                      width: '100%',
                      height: '200px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${tokens.border}`,
                      fontSize: '14px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              )}
            </div>

            {error && (
              <p style={{ color: tokens.danger, fontSize: '14px', marginTop: '12px' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              {/* Ghost button */}
              <button
                data-testid="button-cancel"
                onClick={closeModal}
                disabled={importMutation.isPending}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: `1px solid ${tokens.border}`,
                  backgroundColor: 'transparent',
                  color: tokens.textSecondary,
                  fontSize: '14px',
                  cursor: importMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: importMutation.isPending ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              {/* Primary button */}
              <button
                data-testid="button-submit-import"
                onClick={handleSubmit}
                disabled={importMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: importMutation.isPending ? tokens.textMuted : tokens.primary,
                  color: tokens.onPrimary,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: importMutation.isPending ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!importMutation.isPending) {
                    e.currentTarget.style.backgroundColor = tokens.primaryHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!importMutation.isPending) {
                    e.currentTarget.style.backgroundColor = tokens.primary;
                  }
                }}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Analyzing...
                  </>
                ) : (
                  'Import & Analyze'
                )}
              </button>
            </div>

            {importMutation.isPending && (
              <p style={{ textAlign: 'center', color: tokens.textMuted, fontSize: '13px', marginTop: '16px' }}>
                AI is analyzing your content. This may take 30-60 seconds...
              </p>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
