import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { BrainliftData, ReadingListGrade, BrainliftVersion, CLASSIFICATION, type Classification, type Expert } from '@shared/schema';
import { Share2, Check, ChevronDown, ChevronUp, ExternalLink, Download, RefreshCw, History, X, Upload, Search, Plus, Loader2, FileX, AlertTriangle, Zap, CheckCircle, Lightbulb, FileText, Clock, ThumbsUp, ThumbsDown, Users, User, Trash2 } from 'lucide-react';
import { SiX } from 'react-icons/si';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { tokens, getScoreChipColors, classificationColors } from '@/lib/colors';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const getTypeColor = (type: string) => {
  if (type === 'Twitter') return tokens.info;
  if (type === 'Substack') return tokens.warning;
  if (type === 'Blog') return tokens.secondary;
  return tokens.info;
};

const ClassificationBadge = ({ classification }: { classification?: Classification }) => {
  const badges = {
    brainlift: {
      icon: Check,
      text: 'BRAINLIFT',
      colors: classificationColors.brainlift,
    },
    partial: {
      icon: AlertTriangle,
      text: 'PARTIAL BRAINLIFT',
      colors: classificationColors.partial,
    },
    not_brainlift: {
      icon: FileX,
      text: 'NOT A BRAINLIFT',
      colors: classificationColors.not_brainlift,
    },
  };

  const badge = badges[classification || 'brainlift'];
  const Icon = badge.icon;

  return (
    <span
      data-testid={`badge-classification-${classification}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: badge.colors.bg,
        color: badge.colors.text,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      }}
    >
      <Icon size={14} />
      {badge.text}
    </span>
  );
};

interface NotBrainliftViewProps {
  data: BrainliftData;
  isSharedView: boolean;
}

const NotBrainliftView = ({ data, isSharedView }: NotBrainliftViewProps) => (
  <div 
    className="p-6 sm:p-12 mt-6 rounded-xl"
    style={{ backgroundColor: tokens.surfaceAlt }}
  >
    <div className="flex flex-col items-center text-center mb-10">
      <div style={{
        padding: '20px',
        borderRadius: '50%',
        backgroundColor: tokens.warningSoft,
        marginBottom: '16px',
      }}>
        <AlertTriangle size={40} style={{ color: tokens.warning }} />
      </div>
      <h2 style={{
        fontSize: '28px',
        fontWeight: 600,
        color: tokens.textPrimary,
        marginBottom: '8px',
      }}>
        Not a Brainlift
      </h2>
      <p style={{ fontSize: '15px', color: tokens.textSecondary, maxWidth: '500px' }}>
        This document isn't a brainlift yet, but it can be converted
      </p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {data.rejectionSubtype && (
        <div style={{
          padding: '24px',
          backgroundColor: tokens.surface,
          borderRadius: '12px',
          border: `1px solid ${tokens.border}`,
        }}>
          <div style={{ 
            fontSize: '11px', 
            color: tokens.textSecondary, 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em', 
            marginBottom: '12px',
            fontWeight: 600,
          }}>
            What It Is
          </div>
          <div style={{ 
            fontSize: '16px', 
            color: tokens.textPrimary, 
            fontWeight: 500,
            lineHeight: 1.5,
          }}>
            {data.rejectionSubtype}
          </div>
        </div>
      )}

      {data.rejectionReason && (
        <div style={{
          padding: '24px',
          backgroundColor: tokens.surface,
          borderRadius: '12px',
          border: `1px solid ${tokens.border}`,
        }}>
          <div style={{ 
            fontSize: '11px', 
            color: tokens.textSecondary, 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em', 
            marginBottom: '12px',
            fontWeight: 600,
          }}>
            Why It Can't Be Graded
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: tokens.textPrimary, 
            lineHeight: 1.7,
          }}>
            {data.rejectionReason}
          </div>
        </div>
      )}

      {data.rejectionRecommendation && (
        <div 
          className="lg:col-span-2"
          style={{
            padding: '24px',
            backgroundColor: tokens.successSoft,
            borderRadius: '12px',
            border: `2px solid ${tokens.success}`,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={18} style={{ color: tokens.success }} />
            <div style={{ 
              fontSize: '11px', 
              color: tokens.success, 
              textTransform: 'uppercase', 
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}>
              How to Fix
            </div>
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: tokens.textPrimary, 
            lineHeight: 1.7,
          }}>
            {data.rejectionRecommendation}
          </div>
        </div>
      )}
    </div>

    <div className="flex flex-wrap justify-center gap-3 mt-10 pt-6" style={{ borderTop: `1px solid ${tokens.border}` }}>
      <Link href="/grading/knowledge-rich-curriculum">
        <button
          data-testid="button-view-example"
          className="hover-elevate active-elevate-2"
          style={{
            padding: '12px 24px',
            backgroundColor: tokens.surface,
            color: tokens.primary,
            borderRadius: '8px',
            border: `1px solid ${tokens.primary}`,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FileText size={16} />
          View Example Brainlift
        </button>
      </Link>
      {!isSharedView && (
        <Link href="/">
          <button
            data-testid="button-back-to-list"
            className="hover-elevate active-elevate-2"
            style={{
              padding: '12px 24px',
              backgroundColor: tokens.primary,
              color: tokens.onPrimary,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Back to List
          </button>
        </Link>
      )}
    </div>
  </div>
);

interface DashboardProps {
  slug: string;
  isSharedView?: boolean;
}

export default function Dashboard({ slug, isSharedView = false }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('brainlift');
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [readingFilter, setReadingFilter] = useState<'all' | 'graded' | 'ungraded'>('all');
  
  const [copied, setCopied] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [expandedFacts, setExpandedFacts] = useState<number[]>([]);
  const [localGrades, setLocalGrades] = useState<Record<number, { aligns?: string; contradicts?: string; newInfo?: string; quality?: number }>>({});
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [updateSourceType, setUpdateSourceType] = useState<'pdf' | 'docx' | 'html' | 'text' | 'workflowy' | 'googledocs'>('pdf');
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [updateUrl, setUpdateUrl] = useState('');
  const [updateText, setUpdateText] = useState('');
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [researchMode, setResearchMode] = useState<'quick' | 'deep'>('quick');
  const [researchQuery, setResearchQuery] = useState('');
  const [researchResults, setResearchResults] = useState<any>(null);
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [manualResource, setManualResource] = useState({
    type: 'Article',
    author: '',
    topic: '',
    time: '10 min',
    facts: '',
    url: '',
  });
  const [tweetResults, setTweetResults] = useState<any>(null);
  const [showTweetSection, setShowTweetSection] = useState(false);
  const [tweetFeedbackState, setTweetFeedbackState] = useState<Record<string, 'accepted' | 'rejected'>>({});
  const [expertsExpanded, setExpertsExpanded] = useState(true);
  const [showAllExperts, setShowAllExperts] = useState(false);

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/view/${slug}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleExpand = (itemId: number) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const { data, isLoading, error } = useQuery<BrainliftData>({
    queryKey: ['brainlift', slug],
    queryFn: async () => {
      const res = await fetch(`/api/brainlifts/${slug}`);
      if (!res.ok) throw new Error('Failed to fetch brainlift');
      return res.json();
    },
    enabled: !!slug
  });

  const isNotBrainlift = data?.classification === 'not_brainlift';
  const isPartialBrainlift = data?.classification === 'partial';

  const { data: grades = [] } = useQuery<ReadingListGrade[]>({
    queryKey: ['grades', slug],
    queryFn: async () => {
      const res = await fetch(`/api/brainlifts/${slug}/grades`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!slug
  });

  const { data: versions = [] } = useQuery<BrainliftVersion[]>({
    queryKey: ['versions', slug],
    queryFn: async () => {
      const res = await fetch(`/api/brainlifts/${slug}/versions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!slug
  });

  const expertsList = data?.experts || [];

  const refreshExpertsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/brainlifts/${slug}/experts/refresh`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to refresh experts');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainlift', slug] });
    }
  });

  const toggleExpertFollowMutation = useMutation({
    mutationFn: async ({ expertId, isFollowing }: { expertId: number; isFollowing: boolean }) => {
      const res = await fetch(`/api/experts/${expertId}/follow`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFollowing }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update expert');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainlift', slug] });
    }
  });

  const deleteExpertMutation = useMutation({
    mutationFn: async (expertId: number) => {
      const res = await fetch(`/api/experts/${expertId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete expert');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainlift', slug] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/brainlifts/${slug}/update`, {
        method: 'PATCH',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update');
      }
      return res.json();
    },
    onSuccess: () => {
      setShowUpdateModal(false);
      setUpdateFile(null);
      setUpdateUrl('');
      setUpdateText('');
      queryClient.invalidateQueries({ queryKey: ['brainlift', slug] });
      queryClient.invalidateQueries({ queryKey: ['grades', slug] });
      queryClient.invalidateQueries({ queryKey: ['versions', slug] });
    }
  });

  const canSubmitUpdate = () => {
    if (updateSourceType === 'pdf' || updateSourceType === 'docx') {
      return !!updateFile;
    } else if (updateSourceType === 'workflowy' || updateSourceType === 'googledocs') {
      return !!updateUrl.trim();
    } else if (updateSourceType === 'text') {
      return updateText.trim().length >= 100;
    }
    return false;
  };

  const handleUpdate = () => {
    if (!canSubmitUpdate()) return;
    const formData = new FormData();
    formData.append('sourceType', updateSourceType);
    if (updateSourceType === 'pdf' || updateSourceType === 'docx') {
      if (updateFile) formData.append('file', updateFile);
    } else if (updateSourceType === 'workflowy' || updateSourceType === 'googledocs') {
      formData.append('url', updateUrl);
    } else if (updateSourceType === 'text') {
      formData.append('content', updateText);
    }
    updateMutation.mutate(formData);
  };

  const saveGradeMutation = useMutation({
    mutationFn: async (gradeData: { readingListItemId: number; aligns?: string; contradicts?: string; newInfo?: string; quality?: number }) => {
      return apiRequest('POST', '/api/grades', gradeData);
    },
    onSuccess: (_, variables) => {
      setLocalGrades(prev => {
        const updated = { ...prev };
        delete updated[variables.readingListItemId];
        return updated;
      });
      queryClient.invalidateQueries({ queryKey: ['grades', slug] });
    }
  });

  const researchMutation = useMutation({
    mutationFn: async ({ mode, query }: { mode: 'quick' | 'deep'; query?: string }) => {
      const res = await fetch(`/api/brainlifts/${slug}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode === 'deep' ? 'deep' : 'quick', query }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Research failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResearchResults(data);
    }
  });

  const addResourceMutation = useMutation({
    mutationFn: async (resource: { type: string; author: string; topic: string; time: string; facts: string; url: string }) => {
      return apiRequest('POST', `/api/brainlifts/${slug}/reading-list`, resource);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainlift', slug] });
    }
  });

  const { toast } = useToast();

  const tweetSearchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/brainlifts/${slug}/tweets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Tweet search failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setTweetResults(data);
      setShowTweetSection(true);
      if (data.tweets?.length === 0) {
        toast({
          title: 'No relevant tweets found',
          description: data.searchSummary || 'Try again later or with different brainlift content.',
        });
      }
    },
    onError: (err: Error) => {
      toast({
        title: 'Tweet search failed',
        description: err.message || 'Could not search Twitter. Please check your API key.',
        variant: 'destructive',
      });
    }
  });

  const sourceFeedbackMutation = useMutation({
    mutationFn: async (feedback: { sourceId: string; sourceType: 'tweet' | 'research'; title: string; snippet: string; url: string; decision: 'accepted' | 'rejected' }) => {
      const res = await fetch(`/api/brainlifts/${slug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save feedback');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      setTweetFeedbackState(prev => ({
        ...prev,
        [variables.sourceId]: variables.decision,
      }));
      const sourceLabel = variables.sourceType === 'tweet' ? 'Tweet' : 'Source';
      toast({
        title: variables.decision === 'accepted' ? `${sourceLabel} accepted` : `${sourceLabel} rejected`,
        description: 'Your feedback helps improve future searches.',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to save feedback',
        description: err.message,
        variant: 'destructive',
      });
    }
  });

  const getGradeForItem = (itemId: number) => {
    return grades.find(g => g.readingListItemId === itemId);
  };

  const isItemGraded = (itemId: number) => {
    const grade = getGradeForItem(itemId);
    return grade && (grade.aligns || grade.contradicts || grade.newInfo || grade.quality);
  };

  const handleGradeChange = (itemId: number, field: string, value: string | number) => {
    setLocalGrades(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }));
  };

  const handleSaveGrade = (itemId: number) => {
    const local = localGrades[itemId] || {};
    const existing = getGradeForItem(itemId);
    saveGradeMutation.mutate({
      readingListItemId: itemId,
      aligns: local.aligns ?? existing?.aligns ?? undefined,
      contradicts: local.contradicts ?? existing?.contradicts ?? undefined,
      newInfo: local.newInfo ?? existing?.newInfo ?? undefined,
      quality: local.quality ?? existing?.quality ?? undefined,
    });
  };

  const handleDownloadPDF = () => {
    if (!data) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 14;
    const marginRight = 14;
    const maxWidth = pageWidth - marginLeft - marginRight;
    let y = 20;

    doc.setFontSize(20);
    doc.setTextColor(30, 58, 95);
    const titleLines = doc.splitTextToSize(data.title, maxWidth);
    doc.text(titleLines, marginLeft, y);
    y += titleLines.length * 8 + 4;

    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    const descLines = doc.splitTextToSize(data.description, maxWidth);
    doc.text(descLines, marginLeft, y);
    y += descLines.length * 5 + 3;
    
    if (data.author) {
      doc.setTextColor(13, 148, 136);
      doc.text(`By ${data.author}`, marginLeft, y);
      y += 8;
    } else {
      y += 3;
    }

    doc.setFontSize(14);
    doc.setTextColor(30, 58, 95);
    doc.text('Summary', marginLeft, y);
    y += 7;

    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Total Facts: ${data.summary.totalFacts}  |  Mean Score: ${data.summary.meanScore}`, marginLeft, y);
    y += 5;
    doc.text(`Highly Verified (5/5): ${data.summary.score5Count}  |  With Contradictions: ${data.summary.contradictionCount}`, marginLeft, y);
    y += 10;

    doc.setFontSize(14);
    doc.setTextColor(30, 58, 95);
    doc.text('Facts', marginLeft, y);
    y += 4;

    const sortedFacts = [...data.facts].sort((a, b) => b.score - a.score || a.originalId.localeCompare(b.originalId));
    
    autoTable(doc, {
      startY: y,
      head: [['Fact ID', 'Fact (as written)', 'Correctness (1-5)', 'Verification Notes']],
      body: sortedFacts.map(f => {
        const scoreLabel = f.score === 5 ? 'Verified' : f.score === 4 ? 'Mostly Verified' : f.score === 3 ? 'Partially Verified' : f.score === 2 ? 'Weakly Verified' : 'Not Verified';
        const contradictionNote = f.contradicts ? ` [Contradicts: ${f.contradicts}]` : '';
        return [
          f.originalId,
          f.fact,
          `${f.score} - ${scoreLabel}`,
          (f.note || 'No verification notes') + contradictionNote,
        ];
      }),
      styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 55 },
        2: { cellWidth: 28 },
        3: { cellWidth: 'auto' },
      },
      margin: { left: marginLeft, right: marginRight },
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 95);
    doc.text('Contradiction Clusters', marginLeft, y);
    y += 4;

    if (data.contradictionClusters.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Cluster', 'Tension', 'Status', 'Fact IDs', 'Claims']],
        body: data.contradictionClusters.map(c => [
          c.name,
          c.tension,
          c.status,
          (c.factIds as string[]).join(', '),
          (c.claims as string[]).join('; '),
        ]),
        styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [245, 158, 11], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 45 },
          2: { cellWidth: 22 },
          3: { cellWidth: 22 },
          4: { cellWidth: 'auto' },
        },
        margin: { left: marginLeft, right: marginRight },
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    } else {
      y += 4;
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('No contradictions identified in this analysis.', marginLeft, y);
      y += 12;
    }

    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(30, 58, 95);
    doc.text('Reading List', marginLeft, y);
    y += 4;

    if (data.readingList.length > 0) {
      const readingListLinks: { url: string; x: number; y: number; width: number; height: number }[] = [];
      
      autoTable(doc, {
        startY: y,
        head: [['Type', 'Author', 'Topic', 'Aligns', 'Contradicts', 'New Info', 'Quality', 'Link']],
        body: data.readingList.map(r => {
          const grade = grades.find(g => g.readingListItemId === r.id);
          return [
            r.type,
            r.author,
            r.topic,
            grade?.aligns || '-',
            grade?.contradicts || '-',
            grade?.newInfo || '-',
            grade?.quality ? `${grade.quality}/5` : '-',
            r.url ? 'Open' : '-',
          ];
        }),
        styles: { fontSize: 6, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 6 },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 25 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 18 },
          4: { cellWidth: 18 },
          5: { cellWidth: 18 },
          6: { cellWidth: 14 },
          7: { cellWidth: 14, textColor: [59, 130, 246] },
        },
        margin: { left: marginLeft, right: marginRight },
        didDrawCell: (cellData: any) => {
          if (cellData.section === 'body' && cellData.column.index === 7) {
            const item = data.readingList[cellData.row.index];
            if (item?.url) {
              readingListLinks.push({
                url: item.url,
                x: cellData.cell.x,
                y: cellData.cell.y,
                width: cellData.cell.width,
                height: cellData.cell.height,
              });
            }
          }
        },
      });

      readingListLinks.forEach(link => {
        doc.link(link.x, link.y, link.width, link.height, { url: link.url });
      });
    } else {
      y += 4;
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('No reading list items available.', marginLeft, y);
    }

    doc.save(`${data.slug}-brainlift.pdf`);
  };

  if (isLoading) return <div className="p-12 text-center">Loading...</div>;
  if (error || !data) return (
    <div style={{ padding: '48px', textAlign: 'center' }}>
      <h1>Brainlift not found</h1>
      <p>No brainlift exists at this URL.</p>
      <Link href="/">← Back to home</Link>
    </div>
  );

  const { title, description, facts, contradictionClusters, readingList, summary } = data;

  // Reading List categorization
  const readingCategories = [
    { id: 1, name: 'Student Motivation', facts: '1.1, 2.1', keywords: ['motivat', 'interest', 'choice', 'engagement', 'Writing Gap', 'What Motivates'] },
    { id: 2, name: 'Explicit Instruction', facts: '1.2, 2.2, 2.3, 2.4', keywords: ['Writing Revolution', 'Six Principles', 'Hochman', 'TWR', 'sentence', 'explicit'] },
    { id: 3, name: 'Cognitive Load', facts: '3.1-3.5', keywords: ['cognitive', 'working memory', 'CLT', 'load', 'Hendrick', 'Ashman', 'Wiliam'] },
    { id: 4, name: 'Knowledge-Building', facts: '4.1-4.3', keywords: ['knowledge', 'writing to learn', 'Graham', 'elaboration', 'Shanahan'] },
    { id: 5, name: 'Mathemagenic', facts: '5.1-5.2', keywords: ['mathemagenic', 'transfer', 'Rothkopf', 'Kirschner', 'Stockard', 'Direct Instruction'] },
    { id: 6, name: 'Wise Feedback', facts: '6.1-6.2', keywords: ['wise feedback', 'Yeager', 'mentor', 'identity', 'Huberman'] },
    { id: 7, name: 'PCK', facts: '7.1-7.3', keywords: ['PCK', 'Shulman', 'pedagogical content', 'WWC', 'Practice Guide', 'Evidence Based'] },
  ];

  const categorizeSource = (item: typeof readingList[0]) => {
    const searchText = `${item.author} ${item.topic} ${item.facts}`.toLowerCase();
    for (const cat of readingCategories) {
      if (cat.keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
        return cat;
      }
    }
    return { id: 8, name: 'Other', facts: 'various', keywords: [] as string[] };
  };

  // Build category groups
  const categoryGroups = readingCategories.map(cat => ({
    ...cat,
    items: readingList.filter(item => categorizeSource(item).id === cat.id),
    gradedCount: readingList.filter(item => categorizeSource(item).id === cat.id && isItemGraded(item.id)).length,
  }));
  
  const uncategorizedItems = readingList.filter(item => categorizeSource(item).id === 8);
  if (uncategorizedItems.length > 0) {
    categoryGroups.push({ 
      id: 8, name: 'Other', facts: 'various', keywords: [] as string[], 
      items: uncategorizedItems,
      gradedCount: uncategorizedItems.filter(item => isItemGraded(item.id)).length,
    });
  }

  // Add "All Sources" as the first option (id: 0)
  const allSourcesCluster = {
    id: 0,
    name: 'All Sources',
    facts: 'all',
    keywords: [] as string[],
    items: readingList,
    gradedCount: readingList.filter(item => isItemGraded(item.id)).length,
  };
  
  const groupedSources = [allSourcesCluster, ...categoryGroups];

  // Default to "All Sources" (id: 0)
  const activeCluster = selectedCluster ?? 0;
  const currentCluster = groupedSources.find(c => c.id === activeCluster) || allSourcesCluster;
  
  const filteredItems = currentCluster?.items.filter(item => {
    if (readingFilter === 'graded') return isItemGraded(item.id);
    if (readingFilter === 'ungraded') return !isItemGraded(item.id);
    return true;
  }) || [];
  
  const totalGraded = readingList.filter(item => isItemGraded(item.id)).length;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: tokens.bg,
      color: tokens.textPrimary,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Header - Clear Hierarchy: Identity → Status → Navigation → Actions */}
      <header 
        className="px-4 pt-4 sm:px-8 md:px-12"
        style={{ backgroundColor: tokens.surface }}
      >
        {/* Row 1: Back Link */}
        {!isSharedView && (
          <Link href="/" style={{ 
            color: tokens.textSecondary, 
            textDecoration: 'none', 
            fontSize: '13px',
            display: 'inline-block',
            marginBottom: '8px',
          }}>
            ← All Brainlifts
          </Link>
        )}

        {/* Row 2: Identity Block - Title only, no buttons */}
        <h1 style={{
          fontSize: '26px',
          fontWeight: 700,
          margin: 0,
          color: tokens.textPrimary,
          letterSpacing: '-0.02em',
          lineHeight: 1.3,
        }}>{title}</h1>

        {/* Row 3: Subtitle */}
        <p style={{
          color: tokens.textSecondary,
          fontSize: '14px',
          margin: '6px 0 0 0',
        }}>{description}</p>

        {/* Row 4: Author */}
        {data.author && (
          <p style={{
            color: tokens.textMuted,
            fontSize: '13px',
            margin: '4px 0 0 0',
          }}>By {data.author}</p>
        )}

        {/* Row 5: Status Rail - Classification badge with checkmark */}
        <div style={{ marginTop: '12px' }}>
          {data.classification === 'brainlift' ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: tokens.successSoft,
              color: tokens.success,
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              <Check size={14} />
              Brainlift · DOK1 Graded
            </span>
          ) : data.classification === 'partial' ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: tokens.warningSoft,
              color: tokens.warning,
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              <AlertTriangle size={14} />
              Partial Brainlift
            </span>
          ) : (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: tokens.warningSoft,
              color: tokens.warning,
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              <AlertTriangle size={14} />
              Not a Brainlift
            </span>
          )}
        </div>

        {/* Row 6: Navigation Tabs (left) + Actions (right) */}
        <div 
          className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 sm:gap-0"
          style={{ 
            marginTop: '16px',
            borderBottom: `1px solid ${tokens.border}`,
          }}
        >
          {/* Navigation Tabs - Left aligned, flat underline style */}
          <div style={{ display: 'flex', gap: '0', overflowX: 'auto' }}>
            {!isNotBrainlift && ['brainlift', 'grading', 'contradictions', 'reading'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                data-testid={`tab-${tab}`}
                style={{
                  padding: '12px 20px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? `2px solid ${tokens.primary}` : '2px solid transparent',
                  color: activeTab === tab ? tokens.primary : tokens.textSecondary,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'color 0.15s ease',
                  marginBottom: '-1px',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.color = tokens.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.color = tokens.textSecondary;
                  }
                }}
              >
                {tab === 'brainlift' && 'Brainlift'}
                {tab === 'grading' && 'Fact Grading'}
                {tab === 'contradictions' && 'Contradictions'}
                {tab === 'reading' && 'Reading List'}
              </button>
            ))}
          </div>

          {/* Action Cluster - Right aligned */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingBottom: '8px', flexWrap: 'wrap' }}>
            {/* Primary Action: Update */}
            {!isSharedView && !isNotBrainlift && (
              <button
                data-testid="button-update-brainlift"
                onClick={() => setShowUpdateModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: tokens.primary,
                  color: tokens.surface,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <RefreshCw size={14} />
                Update
              </button>
            )}

            {/* Secondary Actions: Ghost buttons */}
            {!isNotBrainlift && (
              <button
                data-testid="button-download-pdf"
                onClick={handleDownloadPDF}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: tokens.textSecondary,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = tokens.textPrimary}
                onMouseLeave={(e) => e.currentTarget.style.color = tokens.textSecondary}
              >
                <Download size={14} />
                PDF
              </button>
            )}

            <button
              data-testid="button-copy-link"
              onClick={handleCopyLink}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: copied ? tokens.success : 'transparent',
                color: copied ? tokens.surface : tokens.textSecondary,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = tokens.textPrimary; }}
              onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = tokens.textSecondary; }}
            >
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              {copied ? 'Copied!' : 'Share'}
            </button>

            {/* History button */}
            {!isSharedView && !isNotBrainlift && versions.length > 0 && (
              <button
                data-testid="button-view-history"
                onClick={() => setShowHistoryModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: tokens.textSecondary,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = tokens.textPrimary}
                onMouseLeave={(e) => e.currentTarget.style.color = tokens.textSecondary}
              >
                <History size={14} />
                History
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 sm:px-6 md:px-8">
        
        {/* Not a Brainlift View */}
        {isNotBrainlift && (
          <NotBrainliftView data={data} isSharedView={isSharedView} />
        )}

        {/* Partial Brainlift Warning */}
        {isPartialBrainlift && (
          <div style={{
            backgroundColor: tokens.warningSoft,
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}>
            <AlertTriangle size={20} style={{ color: tokens.warning, flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, color: tokens.warning }}>Partial Brainlift</div>
              <div style={{ fontSize: '14px', color: tokens.textSecondary }}>
                Only {facts.length} claims in this document are gradeable. 
                Non-gradeable content (prescriptive statements, uncited claims) has been excluded.
              </div>
            </div>
          </div>
        )}

        {/* Brainlift Tab - Original Document */}
        {!isNotBrainlift && activeTab === 'brainlift' && (
          <div style={{
            backgroundColor: tokens.surface,
            borderRadius: '12px',
            border: `1px solid ${tokens.border}`,
            padding: '24px',
          }}>
            {/* Header with Download Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: `1px solid ${tokens.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: tokens.primarySoft,
                }}>
                  <FileText size={20} style={{ color: tokens.primary }} />
                </div>
                <div>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '16px', 
                    fontWeight: 600, 
                    color: tokens.textPrimary 
                  }}>
                    Original Document
                  </h3>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '13px', 
                    color: tokens.textSecondary 
                  }}>
                    {data.sourceType ? `Source: ${data.sourceType.toUpperCase()}` : 'The source document for this brainlift'}
                  </p>
                </div>
              </div>
              
              {data.originalContent && (
                <button
                  data-testid="button-download-original"
                  onClick={() => {
                    const blob = new Blob([data.originalContent || ''], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${data.slug}-original.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: `1px solid ${tokens.border}`,
                    backgroundColor: tokens.surface,
                    color: tokens.textPrimary,
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  <Download size={14} />
                  Download
                </button>
              )}
            </div>

            {/* Document Content */}
            {data.originalContent ? (
              <div style={{
                backgroundColor: tokens.surfaceAlt,
                borderRadius: '8px',
                padding: '20px',
                maxHeight: '600px',
                overflowY: 'auto',
              }}>
                <pre style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontSize: '14px',
                  lineHeight: 1.7,
                  color: tokens.textPrimary,
                }}>
                  {data.originalContent}
                </pre>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: tokens.textSecondary,
              }}>
                <FileText size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                <p style={{ margin: 0, fontSize: '15px' }}>
                  No original document available
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '13px', opacity: 0.7 }}>
                  Original content is saved when you import or update a brainlift
                </p>
              </div>
            )}
          </div>
        )}

        {/* Grading Tab */}
        {!isNotBrainlift && activeTab === 'grading' && (
          <div>
            {/* Summary Stats - compute contradiction count from facts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Facts', value: facts.length, color: tokens.primary },
                { label: 'Mean Score', value: summary.meanScore, color: tokens.primary },
                { label: 'Highly Verified (5/5)', value: facts.filter(f => f.score === 5).length, color: tokens.success },
                { label: 'With Contradictions', value: facts.filter(f => f.contradicts && f.contradicts.trim() !== '').length, color: tokens.warning },
              ].map((stat, i) => (
                <div key={i} data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`} style={{
                  backgroundColor: tokens.surface,
                  borderRadius: '8px',
                  border: `1px solid ${tokens.border}`,
                }} className="p-3 sm:p-5">
                  <p style={{ color: tokens.textSecondary, margin: 0, fontWeight: 500 }} className="text-xs sm:text-sm">{stat.label}</p>
                  <p style={{ fontWeight: 700, color: stat.color }} className="text-2xl sm:text-3xl mt-1 sm:mt-2">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Flags/Warnings - Compact inline callouts */}
            {data?.flags && data.flags.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.flags.map((flag, index) => (
                  <div
                    key={index}
                    data-testid={`flag-${index}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '10px 14px',
                      backgroundColor: tokens.warningSoft,
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: tokens.warning,
                      lineHeight: 1.5,
                    }}
                  >
                    <AlertTriangle size={14} style={{ color: tokens.warning, flexShrink: 0, marginTop: '2px' }} />
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Facts Table - PDF Style with Fixed Column Widths */}
            <div style={{ 
              overflow: 'auto',
              border: `1px solid ${tokens.border}`,
              borderRadius: '12px',
              backgroundColor: tokens.surface,
            }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '13px',
                tableLayout: 'fixed',
              }}>
                <colgroup>
                  <col style={{ width: '60px' }} />
                  <col style={{ width: '35%' }} />
                  <col style={{ width: '100px' }} />
                  <col />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: tokens.primary }}>
                    <th style={{ padding: '14px 16px', textAlign: 'center', color: tokens.onPrimary, fontWeight: 600, fontSize: '13px' }}>Fact ID</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: tokens.onPrimary, fontWeight: 600, fontSize: '13px' }}>Fact (as written)</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', color: tokens.onPrimary, fontWeight: 600, fontSize: '13px' }}>Correctness (1-5)</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: tokens.onPrimary, fontWeight: 600, fontSize: '13px' }}>Verification Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[...facts].sort((a, b) => b.score - a.score || a.originalId.localeCompare(b.originalId)).map((fact, index) => {
                    const hasContradiction = fact.contradicts !== null && fact.contradicts !== '';
                    const scoreChip = getScoreChipColors(fact.score);
                    const scoreLabel = fact.score === 5 ? 'Verified' : fact.score === 4 ? 'Strong' : fact.score === 3 ? 'Partial' : fact.score === 2 ? 'Weak' : 'Failed';
                    
                    const zebraColor = index % 2 === 0 ? tokens.surface : tokens.surfaceAlt;
                    
                    return (
                      <tr 
                        key={fact.id}
                        id={`fact-${fact.originalId}`}
                        data-testid={`row-fact-${fact.originalId}`}
                        style={{ backgroundColor: zebraColor }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.successSoft}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = zebraColor}
                      >
                        <td style={{ 
                          padding: '14px 16px', 
                          borderBottom: `1px solid ${tokens.border}`, 
                          fontWeight: 600,
                          color: tokens.primary,
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            {fact.originalId}
                            {hasContradiction && (
                              <span 
                                title={`Contradicts: ${fact.contradicts}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '16px',
                                  height: '16px',
                                  backgroundColor: tokens.warningSoft,
                                  color: tokens.warning,
                                  borderRadius: '50%',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                }}
                              >!</span>
                            )}
                          </div>
                        </td>
                        <td style={{ 
                          padding: '14px 16px', 
                          borderBottom: `1px solid ${tokens.border}`,
                          fontSize: '14px',
                          lineHeight: 1.5,
                          color: tokens.textPrimary,
                          verticalAlign: 'top',
                        }}>
                          {fact.fact}
                          {fact.source && (
                            <div style={{ 
                              marginTop: '6px', 
                              fontSize: '12px', 
                              color: '#9CA3AF',
                            }}>
                              Source: {fact.source}
                            </div>
                          )}
                        </td>
                        <td style={{ 
                          padding: '14px 16px', 
                          borderBottom: `1px solid ${tokens.border}`, 
                          textAlign: 'center',
                          verticalAlign: 'middle',
                        }}>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            borderRadius: '16px',
                            backgroundColor: scoreChip.bg,
                            color: scoreChip.text,
                            border: `1px solid ${scoreChip.text}`,
                            fontSize: '12px',
                            fontWeight: 600,
                          }}>
                            <span style={{ fontWeight: 700 }}>{fact.score}</span>
                            <span style={{ fontWeight: 500 }}>{scoreLabel}</span>
                          </div>
                        </td>
                        <td style={{ 
                          padding: '14px 16px', 
                          borderBottom: `1px solid ${tokens.border}`,
                          fontSize: '13px',
                          lineHeight: 1.5,
                          color: '#4B5563',
                          verticalAlign: 'top',
                        }}>
                          {fact.note ? (
                            <div>
                              <div style={{ marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600, color: '#111827' }}>Verdict:</span> {scoreLabel}
                              </div>
                              <div style={{ color: '#6B7280' }}>
                                {fact.note}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: tokens.textMuted, fontStyle: 'italic' }}>No verification notes</span>
                          )}
                          {hasContradiction && (
                            <div style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '8px',
                              fontSize: '11px',
                              color: tokens.warning,
                            }}>
                              <AlertTriangle size={12} />
                              Contradicts: {fact.contradicts}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Contradictions Tab - Card-based styled design */}
        {!isNotBrainlift && activeTab === 'contradictions' && (
          <div className="max-w-[1200px] mx-auto">
            {/* Page Header with icon */}
            <div style={{ 
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              marginBottom: '32px',
              paddingBottom: '24px',
              borderBottom: `1px solid ${tokens.border}`,
            }}>
              <div style={{ fontSize: '32px', lineHeight: 1, flexShrink: 0 }}>
                <AlertTriangle size={32} color={tokens.warning} />
              </div>
              <div>
                <h2 style={{ 
                  fontSize: '24px', 
                  fontWeight: 700, 
                  margin: '0 0 8px 0', 
                  color: tokens.textPrimary,
                }}>
                  Conceptual Tensions
                </h2>
                <p style={{ 
                  fontSize: '15px', 
                  color: tokens.textSecondary, 
                  margin: 0,
                  lineHeight: 1.6,
                  maxWidth: '600px',
                }}>
                  These tensions highlight places where accurate facts pull in different directions. 
                  They are presented for awareness only and are not resolved here.
                </p>
              </div>
            </div>

            {contradictionClusters.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 24px',
                color: tokens.textMuted,
              }}>
                <CheckCircle size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: tokens.textPrimary, margin: '0 0 8px 0' }}>
                  No Contradictions Found
                </h3>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  All facts in this brainlift are logically consistent.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {contradictionClusters.map((cluster, index) => (
                  <div 
                    key={index}
                    style={{
                      background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
                      border: '1px solid #FDBA74',
                      borderLeft: '4px solid #F97316',
                      borderRadius: '12px',
                      padding: '24px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    {/* Cluster Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <Zap size={20} color="#F97316" />
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        margin: 0,
                        color: tokens.textPrimary,
                      }}>{cluster.name}</h3>
                    </div>
                    
                    {/* Fact Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                      {cluster.factIds.map((factId, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setActiveTab('grading');
                            setTimeout(() => {
                              const el = document.getElementById(`fact-${factId}`);
                              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                          }}
                          style={{
                            background: 'white',
                            border: '1px solid #F97316',
                            color: '#C2410C',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                          data-testid={`badge-fact-${factId}`}
                        >
                          {factId}
                        </button>
                      ))}
                    </div>
                    
                    {/* Section Label */}
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6B7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '12px',
                    }}>
                      Competing Claims
                    </div>
                    
                    {/* Claims Grid */}
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '12px',
                      marginBottom: '20px',
                    }}>
                      {cluster.claims.map((claim, i) => (
                        <div 
                          key={i}
                          style={{
                            background: 'white',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                          }}
                        >
                          <span style={{
                            background: '#F3F4F6',
                            color: '#6B7280',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            flexShrink: 0,
                          }}>
                            {cluster.factIds[i] || (i + 1)}
                          </span>
                          <p style={{
                            margin: 0,
                            fontSize: '14px',
                            color: '#374151',
                            lineHeight: 1.5,
                          }}>{claim}</p>
                        </div>
                      ))}
                    </div>
                    
                    {/* Tension Insight Box */}
                    <div style={{
                      background: '#F0FDFA',
                      border: '1px solid #0D9488',
                      borderRadius: '8px',
                      padding: '16px',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#0D9488',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '8px',
                      }}>
                        <Lightbulb size={14} />
                        Interpretive Tension
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: '14px',
                        color: '#115E59',
                        lineHeight: 1.6,
                      }}>{cluster.tension}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reading List Tab - Card-based Design */}
        {!isNotBrainlift && activeTab === 'reading' && (
          <div className="max-w-[1200px] mx-auto">
            {/* Page Header */}
            <div style={{ 
              marginBottom: '32px',
              paddingBottom: '20px',
              borderBottom: `1px solid ${tokens.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 style={{ 
                    fontSize: '24px', 
                    fontWeight: 700, 
                    margin: '0 0 8px 0', 
                    color: tokens.textPrimary 
                  }}>
                    Reading List
                  </h2>
                  <p style={{ 
                    fontSize: '15px', 
                    color: tokens.textSecondary, 
                    margin: 0,
                  }}>
                    Sources selected to support, challenge, or contextualize the DOK1 fact base.
                  </p>
                  <p style={{ 
                    fontSize: '14px', 
                    color: '#0D9488', 
                    margin: '4px 0 0 0',
                    fontWeight: 500,
                  }}>
                    Read selectively. Grade alignment only after review.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    data-testid="button-find-sources"
                    onClick={() => setShowResearchModal(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: tokens.secondary,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'filter 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    <Search size={16} />
                    Find Sources
                  </button>
                  <button
                    data-testid="button-find-tweets"
                    onClick={() => tweetSearchMutation.mutate()}
                    disabled={tweetSearchMutation.isPending}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#0284C7',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: tweetSearchMutation.isPending ? 'wait' : 'pointer',
                      opacity: tweetSearchMutation.isPending ? 0.7 : 1,
                      transition: 'filter 0.15s',
                    }}
                    onMouseEnter={(e) => !tweetSearchMutation.isPending && (e.currentTarget.style.filter = 'brightness(1.1)')}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    {tweetSearchMutation.isPending ? (
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <SiX size={14} />
                    )}
                    {tweetSearchMutation.isPending ? 'Searching...' : 'Find on X'}
                  </button>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div style={{
              display: 'flex',
              gap: '24px',
              padding: '16px 20px',
              backgroundColor: tokens.surfaceAlt,
              borderRadius: '8px',
              marginBottom: '32px',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color={tokens.primary} />
                <span style={{ fontSize: '13px', color: tokens.textSecondary }}>Total sources:</span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: tokens.textPrimary }}>{readingList.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={18} color={tokens.success} />
                <span style={{ fontSize: '13px', color: tokens.textSecondary }}>Graded:</span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: tokens.textPrimary }}>
                  {readingList.filter((item: { id: number }) => isItemGraded(item.id)).length}/{readingList.length}
                </span>
              </div>
            </div>

            {/* Experts Section */}
            <div style={{
              marginBottom: '32px',
              padding: '20px',
              backgroundColor: tokens.surface,
              borderRadius: '12px',
              border: `1px solid ${tokens.border}`,
            }}>
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  cursor: 'pointer',
                  marginBottom: expertsExpanded ? '16px' : '0',
                }}
                onClick={() => setExpertsExpanded(!expertsExpanded)}
                data-testid="button-toggle-experts"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Users size={20} color={tokens.primary} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: tokens.textPrimary }}>
                      Experts
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: tokens.textSecondary }}>
                      Stack ranked by impact on this brainlift
                    </p>
                  </div>
                  <span style={{
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: tokens.primarySoft,
                    color: tokens.primary,
                  }}>
                    {expertsList.length} experts
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    data-testid="button-refresh-experts"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshExpertsMutation.mutate();
                    }}
                    disabled={refreshExpertsMutation.isPending}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: tokens.surfaceAlt,
                      color: tokens.textSecondary,
                      border: `1px solid ${tokens.border}`,
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: refreshExpertsMutation.isPending ? 'wait' : 'pointer',
                    }}
                  >
                    {refreshExpertsMutation.isPending ? (
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    {refreshExpertsMutation.isPending ? 'Refreshing...' : 'Refresh'}
                  </button>
                  {expertsExpanded ? <ChevronUp size={20} color={tokens.textMuted} /> : <ChevronDown size={20} color={tokens.textMuted} />}
                </div>
              </div>

              {expertsExpanded && (
                <>
                  {expertsList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: tokens.textSecondary }}>
                      <Users size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                      <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>No experts extracted yet</p>
                      <p style={{ margin: 0, fontSize: '12px' }}>Click "Refresh" to extract and rank experts from this brainlift</p>
                    </div>
                  ) : (
                    <>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '12px',
                        alignItems: 'stretch',
                      }}>
                        {(expertsList.length <= 8 ? expertsList : (showAllExperts ? expertsList : expertsList.slice(0, 6))).map((expert) => (
                          <div
                            key={expert.id}
                            data-testid={`expert-card-${expert.id}`}
                            style={{
                              padding: '16px',
                              backgroundColor: tokens.bg,
                              borderRadius: '8px',
                              border: `1px solid ${tokens.border}`,
                              display: 'flex',
                              flexDirection: 'column',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: tokens.primarySoft,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <User size={16} color={tokens.primary} />
                                </div>
                                <span style={{ fontWeight: 600, fontSize: '14px', color: tokens.textPrimary }}>
                                  {expert.name}
                                </span>
                              </div>
                            </div>

                            {/* Rank Score Bar */}
                            <div style={{ marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <div style={{
                                  flex: 1,
                                  height: '6px',
                                  backgroundColor: tokens.surfaceAlt,
                                  borderRadius: '3px',
                                  overflow: 'hidden',
                                }}>
                                  <div style={{
                                    width: `${expert.rankScore * 10}%`,
                                    height: '100%',
                                    backgroundColor: tokens.primary,
                                    borderRadius: '3px',
                                  }} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: tokens.textPrimary, minWidth: '20px' }}>
                                  {expert.rankScore}
                                </span>
                              </div>
                            </div>

                            {/* Rationale */}
                            <p style={{
                              margin: '0 0 8px 0',
                              fontSize: '12px',
                              color: tokens.textSecondary,
                              lineHeight: 1.4,
                              flex: 1,
                            }}>
                              {expert.rationale}
                            </p>

                            {/* Source & Twitter */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                              <span style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: tokens.primarySoft,
                                color: tokens.primary,
                                textTransform: 'uppercase',
                                fontWeight: 600,
                              }}>
                                {expert.source === 'listed' ? 'Listed in brainlift' : 'From verification'}
                              </span>
                              {expert.twitterHandle && (
                                <a
                                  href={`https://x.com/${expert.twitterHandle.replace('@', '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: '11px',
                                    color: '#0284C7',
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <SiX size={10} />
                                  {expert.twitterHandle}
                                </a>
                              )}
                            </div>

                            {/* Follow & Delete Buttons */}
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                data-testid={`button-follow-expert-${expert.id}`}
                                onClick={() => toggleExpertFollowMutation.mutate({ 
                                  expertId: expert.id, 
                                  isFollowing: !expert.isFollowing 
                                })}
                                style={{
                                  flex: 1,
                                  padding: '6px 12px',
                                  backgroundColor: expert.isFollowing ? tokens.primary : tokens.surfaceAlt,
                                  color: expert.isFollowing ? tokens.onPrimary : tokens.textSecondary,
                                  border: expert.isFollowing ? 'none' : `1px solid ${tokens.border}`,
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                }}
                              >
                                {expert.isFollowing ? (
                                  <>
                                    <Check size={12} />
                                    Following
                                  </>
                                ) : (
                                  'Follow'
                                )}
                              </button>
                              <button
                                data-testid={`button-delete-expert-${expert.id}`}
                                onClick={() => {
                                  if (confirm(`Remove ${expert.name} from expert list?`)) {
                                    deleteExpertMutation.mutate(expert.id);
                                  }
                                }}
                                style={{
                                  padding: '6px 10px',
                                  backgroundColor: tokens.surfaceAlt,
                                  color: tokens.danger,
                                  border: `1px solid ${tokens.border}`,
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Remove expert"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {expertsList.length > 8 && (
                        <button
                          data-testid="button-show-all-experts"
                          onClick={() => setShowAllExperts(!showAllExperts)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            width: '100%',
                            marginTop: '16px',
                            padding: '10px',
                            backgroundColor: 'transparent',
                            color: tokens.primary,
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          {showAllExperts ? (
                            <>Show less <ChevronUp size={14} /></>
                          ) : (
                            <>Show all {expertsList.length} experts <ChevronDown size={14} /></>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Tweet Results Section */}
            {showTweetSection && tweetResults && (
              <div style={{
                marginBottom: '40px',
                padding: '24px',
                backgroundColor: tokens.surface,
                borderRadius: '12px',
                border: `1px solid ${tokens.border}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <SiX size={20} />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: tokens.textPrimary }}>
                        Relevant Tweets
                      </h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: tokens.textSecondary }}>
                        {tweetResults.searchSummary}
                      </p>
                    </div>
                  </div>
                  <button
                    data-testid="button-close-tweets"
                    onClick={() => setShowTweetSection(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={20} color={tokens.textMuted} />
                  </button>
                </div>

                {tweetResults.tweets?.length === 0 ? (
                  <p style={{ color: tokens.textSecondary, textAlign: 'center', padding: '20px' }}>
                    No relevant tweets found. Try again later or adjust your brainlift content.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {tweetResults.tweets?.map((tweet: any) => {
                      const dokColors: Record<number, { bg: string; color: string; label: string }> = {
                        1: { bg: '#DBEAFE', color: '#1D4ED8', label: 'DOK1 - Recall' },
                        2: { bg: '#D1FAE5', color: '#047857', label: 'DOK2 - Application' },
                        3: { bg: '#FEF3C7', color: '#B45309', label: 'DOK3 - Synthesis' },
                      };
                      const dok = dokColors[tweet.dokLevel] || dokColors[1];

                      return (
                        <div
                          key={tweet.id}
                          data-testid={`tweet-card-${tweet.id}`}
                          style={{
                            padding: '16px',
                            backgroundColor: tokens.bg,
                            borderRadius: '8px',
                            border: `1px solid ${tokens.border}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: dok.bg,
                                color: dok.color,
                              }}>
                                {dok.label}
                              </span>
                              <span style={{ fontSize: '12px', color: tokens.textMuted }}>
                                {Math.round(tweet.relevanceScore * 100)}% relevant
                              </span>
                            </div>
                            <a
                              href={tweet.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`link-tweet-${tweet.id}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                color: '#0284C7',
                                textDecoration: 'none',
                              }}
                            >
                              View on X <ExternalLink size={12} />
                            </a>
                          </div>

                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ fontWeight: 600, color: tokens.textPrimary }}>@{tweet.authorUsername}</span>
                              <span style={{ fontSize: '12px', color: tokens.textMuted }}>
                                {tweet.authorFollowers?.toLocaleString()} followers
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '14px', color: tokens.textPrimary, lineHeight: 1.5 }}>
                              {tweet.text}
                            </p>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                            <span style={{ fontSize: '12px', color: tokens.textSecondary }}>Matches:</span>
                            {tweet.matchedFacts?.map((factId: string) => (
                              <span
                                key={factId}
                                style={{
                                  padding: '2px 8px',
                                  backgroundColor: '#E0F2FE',
                                  color: '#0369A1',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                }}
                              >
                                Fact {factId}
                              </span>
                            ))}
                          </div>

                          <p style={{ margin: 0, fontSize: '13px', color: tokens.textSecondary, fontStyle: 'italic' }}>
                            {tweet.dokRationale}
                          </p>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: tokens.textMuted }}>
                              <span>{tweet.likes} likes</span>
                              <span>{tweet.retweets} retweets</span>
                              <span>{tweet.replies} replies</span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {tweetFeedbackState[tweet.id] ? (
                                <span
                                  data-testid={`status-tweet-decision-${tweet.id}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    backgroundColor: tweetFeedbackState[tweet.id] === 'accepted' ? '#D1FAE5' : '#FEE2E2',
                                    color: tweetFeedbackState[tweet.id] === 'accepted' ? '#047857' : '#DC2626',
                                  }}
                                >
                                  {tweetFeedbackState[tweet.id] === 'accepted' ? (
                                    <><ThumbsUp size={12} /> Accepted</>
                                  ) : (
                                    <><ThumbsDown size={12} /> Rejected</>
                                  )}
                                </span>
                              ) : (
                                <>
                                  <button
                                    data-testid={`button-tweet-accept-${tweet.id}`}
                                    onClick={() => sourceFeedbackMutation.mutate({
                                      sourceId: tweet.id,
                                      sourceType: 'tweet',
                                      title: tweet.authorUsername,
                                      snippet: tweet.text,
                                      url: tweet.url,
                                      decision: 'accepted',
                                    })}
                                    disabled={sourceFeedbackMutation.isPending}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      backgroundColor: '#D1FAE5',
                                      color: '#047857',
                                      border: 'none',
                                      cursor: 'pointer',
                                      transition: 'filter 0.15s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
                                    onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                                  >
                                    <ThumbsUp size={12} /> Accept
                                  </button>
                                  <button
                                    data-testid={`button-tweet-reject-${tweet.id}`}
                                    onClick={() => sourceFeedbackMutation.mutate({
                                      sourceId: tweet.id,
                                      sourceType: 'tweet',
                                      title: tweet.authorUsername,
                                      snippet: tweet.text,
                                      url: tweet.url,
                                      decision: 'rejected',
                                    })}
                                    disabled={sourceFeedbackMutation.isPending}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      backgroundColor: '#FEE2E2',
                                      color: '#DC2626',
                                      border: 'none',
                                      cursor: 'pointer',
                                      transition: 'filter 0.15s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
                                    onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                                  >
                                    <ThumbsDown size={12} /> Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Sections grouped by category */}
            {categoryGroups.filter(cat => cat.items.length > 0).map(category => {
              const getSourceTypeStyle = (type: string) => {
                const lower = type.toLowerCase();
                if (lower.includes('blog')) return { bg: '#DBEAFE', color: '#1D4ED8', icon: 'Blog' };
                if (lower.includes('magazine') || lower.includes('atlantic')) return { bg: '#FCE7F3', color: '#BE185D', icon: 'Magazine' };
                if (lower.includes('research') || lower.includes('paper') || lower.includes('study')) return { bg: '#D1FAE5', color: '#047857', icon: 'Research' };
                if (lower.includes('policy')) return { bg: '#FEF3C7', color: '#B45309', icon: 'Policy' };
                if (lower.includes('podcast')) return { bg: '#EDE9FE', color: '#6D28D9', icon: 'Podcast' };
                if (lower.includes('video') || lower.includes('youtube')) return { bg: '#FEE2E2', color: '#DC2626', icon: 'Video' };
                if (lower.includes('twitter') || lower.includes('x.com')) return { bg: '#E0F2FE', color: '#000000', icon: 'X' };
                if (lower.includes('substack')) return { bg: '#FFEDD5', color: '#EA580C', icon: 'Substack' };
                return { bg: '#F3F4F6', color: '#6B7280', icon: type };
              };

              return (
                <div key={category.id} style={{ marginBottom: '40px' }}>
                  {/* Category Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{ 
                      fontSize: '18px', 
                      fontWeight: 600, 
                      margin: 0, 
                      color: tokens.textPrimary 
                    }}>
                      {category.name}
                    </h3>
                    <span style={{
                      background: '#F3F4F6',
                      color: '#6B7280',
                      fontSize: '12px',
                      padding: '4px 10px',
                      borderRadius: '12px',
                    }}>
                      {category.items.length} source{category.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p style={{ 
                    fontSize: '13px', 
                    color: '#6B7280',
                    margin: '0 0 16px 0',
                  }}>
                    Relates to Facts: <span style={{ color: '#0D9488', fontWeight: 500 }}>{category.facts}</span>
                  </p>

                  {/* Source Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {category.items.map((item) => {
                      const isExpanded = expandedItems[item.id];
                      const existingGrade = getGradeForItem(item.id);
                      const localGrade = localGrades[item.id] || {};
                      const graded = isItemGraded(item.id);
                      const relatedFacts = categorizeSource(item);
                      const typeStyle = getSourceTypeStyle(item.type);

                      return (
                        <div
                          key={item.id}
                          data-testid={`card-reading-${item.id}`}
                          style={{ 
                            background: 'white',
                            border: `1px solid ${tokens.border}`,
                            borderRadius: '12px',
                            padding: '20px',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#0D9488';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(13, 148, 136, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = tokens.border;
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {/* Source Header Row */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '12px',
                            flexWrap: 'wrap',
                          }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.3px',
                              background: typeStyle.bg,
                              color: typeStyle.color,
                            }}>
                              {typeStyle.icon}
                            </span>
                            <span style={{ fontSize: '13px', color: '#6B7280' }}>
                              <span style={{ fontWeight: 500, color: '#374151' }}>{item.author}</span>
                              <span style={{ margin: '0 6px', color: '#D1D5DB' }}>•</span>
                              {item.type}
                            </span>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              color: '#6B7280',
                              background: '#F3F4F6',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}>
                              <Clock size={12} /> ~{item.time}
                            </span>
                            {graded && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: tokens.success,
                                background: '#D1FAE5',
                                padding: '2px 8px',
                                borderRadius: '4px',
                              }}>
                                <Check size={12} /> Graded
                              </span>
                            )}
                          </div>

                          {/* Source Title */}
                          <h4 style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#111827',
                            margin: '0 0 8px 0',
                            lineHeight: 1.4,
                          }}>
                            {item.topic}
                          </h4>

                          {/* Source Description */}
                          <p style={{
                            fontSize: '14px',
                            color: '#4B5563',
                            lineHeight: 1.6,
                            margin: '0 0 16px 0',
                          }}>
                            <strong style={{ color: '#374151' }}>Why this matters:</strong>{' '}
                            {item.facts.length > 150 ? item.facts.substring(0, 150) + '...' : item.facts}
                          </p>

                          {/* Source Footer */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px',
                          }}>
                            {/* Fact Links */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '12px', color: '#6B7280' }}>Facts:</span>
                              {relatedFacts.facts.split(', ').map((factId, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setActiveTab('grading');
                                    setTimeout(() => {
                                      const el = document.getElementById(`fact-${factId}`);
                                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }, 100);
                                  }}
                                  style={{
                                    background: '#F0FDFA',
                                    color: '#0D9488',
                                    border: '1px solid #99F6E4',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {factId}
                                </button>
                              ))}
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`link-reading-${item.id}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '8px 16px',
                                  backgroundColor: tokens.primary,
                                  color: 'white',
                                  borderRadius: '8px',
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  textDecoration: 'none',
                                }}
                              >
                                Open source <ExternalLink size={12} />
                              </a>
                              {!isSharedView && (
                                <button
                                  onClick={() => toggleExpand(item.id)}
                                  data-testid={`button-grade-toggle-${item.id}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    background: 'white',
                                    color: '#374151',
                                    border: `1px solid ${tokens.border}`,
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Grade {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Grading Form - Pill-based Design */}
                          {isExpanded && (() => {
                            const currentAligns = localGrade.aligns ?? existingGrade?.aligns ?? '';
                            const currentContradicts = localGrade.contradicts ?? existingGrade?.contradicts ?? '';
                            const currentNewInfo = localGrade.newInfo ?? existingGrade?.newInfo ?? '';
                            const currentQuality = localGrade.quality ?? existingGrade?.quality ?? '';
                            
                            const pillBase = {
                              padding: '6px 14px',
                              background: 'white',
                              border: '1px solid #D1D5DB',
                              borderRadius: '20px',
                              fontSize: '13px',
                              fontWeight: 500,
                              color: '#374151',
                              cursor: 'pointer',
                            };
                            
                            const pillSelected = {
                              ...pillBase,
                              background: '#0D9488',
                              borderColor: '#0D9488',
                              color: 'white',
                            };
                            
                            const getQualityPillStyle = (val: number, selected: boolean) => {
                              if (!selected) return pillBase;
                              const colors: Record<number, string> = {
                                5: '#10B981', 4: '#0D9488', 3: '#EAB308', 2: '#F97316', 1: '#EF4444'
                              };
                              return { ...pillBase, background: colors[val], borderColor: colors[val], color: 'white' };
                            };
                            
                            return (
                              <div style={{
                                background: '#F9FAFB',
                                borderTop: `1px solid ${tokens.border}`,
                                borderRadius: '0 0 12px 12px',
                                padding: '20px',
                                margin: '16px -20px -20px -20px',
                              }}>
                                {/* Aligns? */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', minWidth: '90px' }}>Aligns?</span>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {['yes', 'partial', 'no'].map(val => (
                                      <button
                                        key={val}
                                        onClick={() => handleGradeChange(item.id, 'aligns', val)}
                                        data-testid={`pill-aligns-${val}-${item.id}`}
                                        style={currentAligns === val ? pillSelected : pillBase}
                                      >
                                        {val === 'yes' ? 'Yes' : val === 'partial' ? 'Partial' : 'No'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                
                                {/* Contradicts? */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', minWidth: '90px' }}>Contradicts?</span>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {['no', 'yes'].map(val => (
                                      <button
                                        key={val}
                                        onClick={() => handleGradeChange(item.id, 'contradicts', val)}
                                        data-testid={`pill-contradicts-${val}-${item.id}`}
                                        style={currentContradicts === val ? pillSelected : pillBase}
                                      >
                                        {val === 'no' ? 'None' : 'Yes'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                
                                {/* New Info? */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', minWidth: '90px' }}>New info?</span>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {['yes', 'no'].map(val => (
                                      <button
                                        key={val}
                                        onClick={() => handleGradeChange(item.id, 'newInfo', val)}
                                        data-testid={`pill-newinfo-${val}-${item.id}`}
                                        style={currentNewInfo === val ? pillSelected : pillBase}
                                      >
                                        {val === 'yes' ? 'Yes' : 'No'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                
                                {/* Quality */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', minWidth: '90px' }}>Quality</span>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {[1, 2, 3, 4, 5].map(val => (
                                      <button
                                        key={val}
                                        onClick={() => handleGradeChange(item.id, 'quality', val)}
                                        data-testid={`pill-quality-${val}-${item.id}`}
                                        style={getQualityPillStyle(val, currentQuality === val)}
                                      >
                                        {val}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                
                                {/* Save Button */}
                                <button
                                  onClick={() => handleSaveGrade(item.id)}
                                  data-testid={`button-save-grade-${item.id}`}
                                  disabled={saveGradeMutation.isPending}
                                  style={{
                                    width: '100%',
                                    padding: '10px 24px',
                                    background: '#0D9488',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    opacity: saveGradeMutation.isPending ? 0.7 : 1,
                                  }}
                                >
                                  {saveGradeMutation.isPending ? 'Saving...' : 'Save Grade'}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
      </main>

      {/* Update Modal */}
      {showUpdateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tokens.overlay,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div 
            className="p-4 sm:p-8 w-[95%] max-w-[500px] max-h-[90vh] overflow-auto rounded-xl"
            style={{ backgroundColor: tokens.surface }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: tokens.primary }}>Update Brainlift</h2>
              <button
                data-testid="button-close-update-modal"
                onClick={() => setShowUpdateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <p style={{ color: tokens.textSecondary, fontSize: '14px', marginBottom: '20px' }}>
              Import new content to update this brainlift. Your current data will be saved to version history.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Source Type</label>
              <select
                data-testid="select-update-source-type"
                value={updateSourceType}
                onChange={(e) => setUpdateSourceType(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${tokens.border}`,
                  fontSize: '14px',
                }}
              >
                <option value="pdf">PDF Document</option>
                <option value="docx">Word Document (.docx)</option>
                <option value="html">HTML File</option>
                <option value="text">Paste Text</option>
                <option value="workflowy">Workflowy</option>
                <option value="googledocs">Google Docs</option>
              </select>
            </div>

            {(updateSourceType === 'pdf' || updateSourceType === 'docx' || updateSourceType === 'html') && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Upload File</label>
                <div style={{
                  border: `2px dashed ${tokens.border}`,
                  borderRadius: '8px',
                  padding: '24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('update-file-input')?.click()}
                >
                  <Upload size={24} style={{ marginBottom: '8px', color: tokens.textSecondary }} />
                  <p style={{ margin: 0, fontSize: '14px', color: tokens.textSecondary }}>
                    {updateFile ? updateFile.name : `Click to upload ${updateSourceType === 'html' ? 'an HTML' : updateSourceType === 'pdf' ? 'a PDF' : 'a Word'} file`}
                  </p>
                  <input
                    type="file"
                    id="update-file-input"
                    data-testid="input-update-file"
                    accept={updateSourceType === 'pdf' ? '.pdf' : updateSourceType === 'docx' ? '.docx' : '.html,.htm'}
                    onChange={(e) => setUpdateFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            )}

            {(updateSourceType === 'workflowy' || updateSourceType === 'googledocs') && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>
                  {updateSourceType === 'workflowy' ? 'Workflowy URL' : 'Google Docs URL'}
                </label>
                <input
                  type="text"
                  data-testid="input-update-url"
                  value={updateUrl}
                  onChange={(e) => setUpdateUrl(e.target.value)}
                  placeholder={updateSourceType === 'workflowy' ? 'https://workflowy.com/#/...' : 'https://docs.google.com/...'}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${tokens.border}`,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {updateSourceType === 'text' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Content</label>
                <textarea
                  data-testid="input-update-text"
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder="Paste your educational content here..."
                  style={{
                    width: '100%',
                    minHeight: '150px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${tokens.border}`,
                    fontSize: '14px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {updateMutation.isError && (
              <p style={{ color: tokens.danger, fontSize: '14px', marginBottom: '16px' }}>
                {(updateMutation.error as Error).message}
              </p>
            )}

            <button
              data-testid="button-submit-update"
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !canSubmitUpdate()}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: (updateMutation.isPending || !canSubmitUpdate()) ? tokens.textMuted : tokens.secondary,
                color: tokens.surface,
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: (updateMutation.isPending || !canSubmitUpdate()) ? 'not-allowed' : 'pointer',
              }}
            >
              {updateMutation.isPending ? 'Updating... (this may take a minute)' : 'Update Brainlift'}
            </button>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tokens.overlay,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div 
            className="p-4 sm:p-8 w-[95%] max-w-[700px] max-h-[90vh] overflow-auto rounded-xl"
            style={{ backgroundColor: tokens.surface }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: tokens.primary }}>Version History</h2>
              <button
                data-testid="button-close-history-modal"
                onClick={() => setShowHistoryModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <p style={{ color: tokens.textSecondary, fontSize: '14px', marginBottom: '20px' }}>
              View previous versions of this brainlift with their preserved grades and data.
            </p>

            {versions.length === 0 ? (
              <p style={{ textAlign: 'center', color: tokens.textSecondary, padding: '24px' }}>
                No previous versions available.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {versions.map((version) => {
                  const snapshot = version.snapshot as any;
                  return (
                    <div
                      key={version.id}
                      data-testid={`version-${version.versionNumber}`}
                      style={{
                        border: `1px solid ${tokens.border}`,
                        borderRadius: '8px',
                        padding: '16px 20px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          backgroundColor: tokens.primary,
                          color: tokens.surface,
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}>
                          Version {version.versionNumber}
                        </span>
                        <span style={{ color: tokens.textSecondary, fontSize: '13px' }}>
                          {new Date(version.createdAt).toLocaleDateString()} at {new Date(version.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 600, color: tokens.textPrimary }}>
                        {snapshot?.title || 'Untitled'}
                      </p>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: tokens.textSecondary }}>
                        <span>{snapshot?.facts?.length || 0} facts</span>
                        <span>{snapshot?.readingList?.length || 0} reading items</span>
                        <span>Source: {version.sourceType}</span>
                      </div>
                      {snapshot?.grades && snapshot.grades.length > 0 && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${tokens.border}` }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: tokens.textSecondary, marginBottom: '8px' }}>Preserved Grades:</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {snapshot.grades.filter((g: any) => g.aligns || g.quality).slice(0, 5).map((grade: any, i: number) => (
                              <span
                                key={i}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: tokens.surfaceAlt,
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                }}
                              >
                                {grade.readingListTopic?.substring(0, 30)}... {grade.quality ? `(${grade.quality}/5)` : ''}
                              </span>
                            ))}
                            {snapshot.grades.filter((g: any) => g.aligns || g.quality).length > 5 && (
                              <span style={{ fontSize: '11px', color: tokens.textSecondary }}>
                                +{snapshot.grades.filter((g: any) => g.aligns || g.quality).length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Research Modal */}
      {showResearchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tokens.overlay,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div 
            className="p-4 sm:p-8 w-[95%] max-w-[700px] max-h-[90vh] overflow-auto rounded-xl"
            style={{ backgroundColor: tokens.surface }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: tokens.primary }}>
                <Search size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Find New Resources
              </h2>
              <button
                data-testid="button-close-research-modal"
                onClick={() => {
                  setShowResearchModal(false);
                  setResearchResults(null);
                  setResearchQuery('');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: tokens.textSecondary, fontSize: '14px', marginBottom: '20px' }}>
              Search the web for Substacks, Twitter threads, academic papers, and other resources related to this brainlift.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Research Mode</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  data-testid="button-research-quick"
                  onClick={() => setResearchMode('quick')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: researchMode === 'quick' ? `2px solid ${tokens.secondary}` : `1px solid ${tokens.border}`,
                    backgroundColor: researchMode === 'quick' ? tokens.secondary + '10' : tokens.surface,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, color: tokens.textPrimary }}>Quick Search</p>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: tokens.textSecondary }}>Find popular resources fast</p>
                </button>
                <button
                  data-testid="button-research-deep"
                  onClick={() => setResearchMode('deep')}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: researchMode === 'deep' ? `2px solid ${tokens.secondary}` : `1px solid ${tokens.border}`,
                    backgroundColor: researchMode === 'deep' ? tokens.secondary + '10' : tokens.surface,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, color: tokens.textPrimary }}>Deep Research</p>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: tokens.textSecondary }}>Academic papers & expert analysis</p>
                </button>
              </div>
            </div>

            {researchMode === 'deep' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>
                  Specific Research Focus (optional)
                </label>
                <input
                  data-testid="input-research-query"
                  type="text"
                  value={researchQuery}
                  onChange={(e) => setResearchQuery(e.target.value)}
                  placeholder="e.g., 'studies on phonics instruction' or 'counter-arguments to direct instruction'"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${tokens.border}`,
                    fontSize: '14px',
                  }}
                />
              </div>
            )}

            <button
              data-testid="button-start-research"
              onClick={() => researchMutation.mutate({ mode: researchMode, query: researchQuery || undefined })}
              disabled={researchMutation.isPending}
              style={{
                width: '100%',
                padding: '14px 20px',
                backgroundColor: tokens.secondary,
                color: tokens.surface,
                border: 'none',
                borderRadius: '8px',
                cursor: researchMutation.isPending ? 'wait' : 'pointer',
                fontSize: '15px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: researchMutation.isPending ? 0.7 : 1,
              }}
            >
              {researchMutation.isPending ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Searching the web...
                </>
              ) : (
                <>
                  <Search size={18} />
                  Search for Resources
                </>
              )}
            </button>

            {researchMutation.isError && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: tokens.dangerSoft, borderRadius: '8px', color: tokens.danger, fontSize: '14px' }}>
                {(researchMutation.error as Error).message}
              </div>
            )}

            {researchResults && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: tokens.secondary + '10', 
                  borderRadius: '8px', 
                  marginBottom: '20px',
                  borderLeft: `4px solid ${tokens.secondary}`,
                }}>
                  <p style={{ margin: 0, fontSize: '14px', color: tokens.textPrimary }}>
                    <strong>Summary:</strong> {researchResults.searchSummary}
                  </p>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: tokens.primary }}>
                  Found {researchResults.resources?.length || 0} Resources
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {researchResults.resources?.map((resource: any, index: number) => (
                    <div
                      key={index}
                      style={{
                        border: `1px solid ${tokens.border}`,
                        borderRadius: '8px',
                        padding: '16px',
                        backgroundColor: tokens.surface,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{
                              padding: '4px 10px',
                              backgroundColor: getTypeColor(resource.type) + '15',
                              color: getTypeColor(resource.type),
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}>{resource.type}</span>
                            <span style={{ color: tokens.textSecondary, fontSize: '12px' }}>{resource.time}</span>
                          </div>
                          <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '15px', color: tokens.textPrimary }}>
                            {resource.title || resource.topic}
                          </p>
                          <p style={{ margin: '0 0 8px', fontSize: '13px', color: tokens.textSecondary }}>
                            by {resource.author}
                          </p>
                          <p style={{ margin: '0 0 8px', fontSize: '13px', color: tokens.textPrimary }}>
                            {resource.summary}
                          </p>
                          <a 
                            href={resource.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ fontSize: '12px', color: tokens.info, textDecoration: 'none' }}
                          >
                            {resource.url}
                          </a>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                          <button
                            data-testid={`button-add-resource-${index}`}
                            onClick={() => {
                              addResourceMutation.mutate({
                                type: resource.type,
                                author: resource.author,
                                topic: resource.title || resource.topic,
                                time: resource.time,
                                facts: resource.summary || resource.relevance,
                                url: resource.url,
                              });
                            }}
                            disabled={addResourceMutation.isPending}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: tokens.success,
                              color: tokens.surface,
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Plus size={14} />
                            Add
                          </button>
                          
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {tweetFeedbackState[resource.url] ? (
                              <span
                                data-testid={`status-resource-decision-${index}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 8px',
                                  borderRadius: '8px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  backgroundColor: tweetFeedbackState[resource.url] === 'accepted' ? '#D1FAE5' : '#FEE2E2',
                                  color: tweetFeedbackState[resource.url] === 'accepted' ? '#047857' : '#DC2626',
                                }}
                              >
                                {tweetFeedbackState[resource.url] === 'accepted' ? (
                                  <><ThumbsUp size={10} /> Accepted</>
                                ) : (
                                  <><ThumbsDown size={10} /> Rejected</>
                                )}
                              </span>
                            ) : (
                              <>
                                <button
                                  data-testid={`button-resource-accept-${index}`}
                                  onClick={() => sourceFeedbackMutation.mutate({
                                    sourceId: resource.url,
                                    sourceType: 'research',
                                    title: resource.title || resource.topic,
                                    snippet: resource.summary || '',
                                    url: resource.url,
                                    decision: 'accepted',
                                  })}
                                  disabled={sourceFeedbackMutation.isPending}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    backgroundColor: '#D1FAE5',
                                    color: '#047857',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <ThumbsUp size={10} />
                                </button>
                                <button
                                  data-testid={`button-resource-reject-${index}`}
                                  onClick={() => sourceFeedbackMutation.mutate({
                                    sourceId: resource.url,
                                    sourceType: 'research',
                                    title: resource.title || resource.topic,
                                    snippet: resource.summary || '',
                                    url: resource.url,
                                    decision: 'rejected',
                                  })}
                                  disabled={sourceFeedbackMutation.isPending}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    backgroundColor: '#FEE2E2',
                                    color: '#DC2626',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <ThumbsDown size={10} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {researchResults.suggestedResearchers && researchResults.suggestedResearchers.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <h3 style={{ 
                      fontSize: '16px', 
                      fontWeight: 600, 
                      marginBottom: '16px', 
                      color: tokens.secondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <Users size={18} />
                      Similar Researchers to Explore
                    </h3>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                      gap: '12px' 
                    }}>
                      {researchResults.suggestedResearchers.map((researcher: any, idx: number) => (
                        <div
                          key={idx}
                          data-testid={`card-suggested-researcher-${idx}`}
                          style={{
                            padding: '14px',
                            borderRadius: '8px',
                            backgroundColor: tokens.surface,
                            border: `1px solid ${tokens.border}`,
                          }}
                        >
                          <p style={{ 
                            margin: '0 0 4px', 
                            fontWeight: 600, 
                            fontSize: '14px', 
                            color: tokens.textPrimary 
                          }}>
                            {researcher.name}
                          </p>
                          <p style={{ 
                            margin: '0 0 6px', 
                            fontSize: '12px', 
                            color: tokens.textSecondary 
                          }}>
                            {researcher.affiliation}
                          </p>
                          <p style={{ 
                            margin: '0 0 8px', 
                            fontSize: '12px', 
                            color: tokens.textPrimary,
                            fontStyle: 'italic',
                          }}>
                            {researcher.focus}
                          </p>
                          <p style={{ 
                            margin: 0, 
                            fontSize: '11px', 
                            color: tokens.textSecondary,
                            padding: '6px 8px',
                            backgroundColor: tokens.secondary + '10',
                            borderRadius: '4px',
                          }}>
                            Similar to: {researcher.similarTo}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Add Resource Modal */}
      {showAddResourceModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tokens.overlay,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div 
            className="p-4 sm:p-8 w-[95%] max-w-[500px] max-h-[90vh] overflow-auto rounded-xl"
            style={{ backgroundColor: tokens.surface }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: tokens.primary }}>
                <Plus size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Add Resource
              </h2>
              <button
                data-testid="button-close-add-resource-modal"
                onClick={() => setShowAddResourceModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '14px' }}>Type</label>
                <select
                  data-testid="select-resource-type"
                  value={manualResource.type}
                  onChange={(e) => setManualResource({ ...manualResource, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${tokens.border}`,
                    fontSize: '14px',
                  }}
                >
                  <option value="Article">Article</option>
                  <option value="Substack">Substack</option>
                  <option value="Twitter">X Thread</option>
                  <option value="Academic Paper">Academic Paper</option>
                  <option value="Video">Video</option>
                  <option value="Podcast">Podcast</option>
                  <option value="Blog">Blog Post</option>
                  <option value="Book">Book</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '14px' }}>Title / Topic *</label>
                <input
                  data-testid="input-resource-topic"
                  type="text"
                  value={manualResource.topic}
                  onChange={(e) => setManualResource({ ...manualResource, topic: e.target.value })}
                  placeholder="e.g., The Science of Reading"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${tokens.border}`,
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '14px' }}>Author *</label>
                <input
                  data-testid="input-resource-author"
                  type="text"
                  value={manualResource.author}
                  onChange={(e) => setManualResource({ ...manualResource, author: e.target.value })}
                  placeholder="e.g., Emily Hanford"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${tokens.border}`,
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '14px' }}>URL *</label>
                <input
                  data-testid="input-resource-url"
                  type="url"
                  value={manualResource.url}
                  onChange={(e) => setManualResource({ ...manualResource, url: e.target.value })}
                  placeholder="https://..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${tokens.border}`,
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '14px' }}>Reading Time</label>
                <input
                  data-testid="input-resource-time"
                  type="text"
                  value={manualResource.time}
                  onChange={(e) => setManualResource({ ...manualResource, time: e.target.value })}
                  placeholder="e.g., 15 min"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${tokens.border}`,
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '14px' }}>Description / Key Facts</label>
                <textarea
                  data-testid="input-resource-facts"
                  value={manualResource.facts}
                  onChange={(e) => setManualResource({ ...manualResource, facts: e.target.value })}
                  placeholder="Brief description or key points from this resource..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${tokens.border}`,
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <button
              data-testid="button-submit-resource"
              onClick={() => {
                if (!manualResource.topic || !manualResource.author || !manualResource.url) {
                  alert('Please fill in all required fields (Title, Author, URL)');
                  return;
                }
                addResourceMutation.mutate(manualResource, {
                  onSuccess: () => {
                    setShowAddResourceModal(false);
                    setManualResource({
                      type: 'Article',
                      author: '',
                      topic: '',
                      time: '10 min',
                      facts: '',
                      url: '',
                    });
                  }
                });
              }}
              disabled={addResourceMutation.isPending}
              style={{
                width: '100%',
                marginTop: '24px',
                padding: '14px 20px',
                backgroundColor: tokens.success,
                color: tokens.surface,
                border: 'none',
                borderRadius: '8px',
                cursor: addResourceMutation.isPending ? 'wait' : 'pointer',
                fontSize: '15px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: addResourceMutation.isPending ? 0.7 : 1,
              }}
            >
              {addResourceMutation.isPending ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Adding...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Add to Reading List
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
