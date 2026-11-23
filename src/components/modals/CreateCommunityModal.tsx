import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Users, MapPin, Sparkles, Shield } from 'lucide-react';
import { Modal } from '../ui/Modal';

const IRAQI_PROVINCES = [
  'بغداد',
  'البصرة',
  'نينوى',
  'أربيل',
  'النجف الأشرف',
  'كربلاء المقدسة',
  'السليمانية',
  'كركوك',
  'بابل',
  'ذي قار',
  'ميسان',
  'ديالى',
  'الأنبار',
  'واسط',
  'القادسية',
  'دهوك',
  'صلاح الدين',
  'المثنى',
  'حلبجة',
];

const CATEGORIES = [
  'تقنية وبرمجة',
  'تراث وعمارة',
  'فنون وتصميم',
  'حرف وتجارة يدوية',
  'كتب وثقافة',
  'رياضة ولياقة',
  'أعمال واستثمار محلي',
];

export function CreateCommunityModal() {
  const { isCreateCommunityOpen, setIsCreateCommunityOpen, addCommunity } = useApp();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [province, setProvince] = useState('بغداد');
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addCommunity({
      name: name.trim(),
      province,
      category,
      isPrivate,
      description: description.trim() || `مجتمع ${name.trim()} لتبادل الخبرات والنقاشات المفيدة.`,
    });

    setName('');
    setDescription('');
    setIsPrivate(false);
    setIsCreateCommunityOpen(false);
  };

  return (
    <Modal
      isOpen={isCreateCommunityOpen}
      onClose={() => setIsCreateCommunityOpen(false)}
      title="إنشاء مجتمع عراقي جديد"
      testId="tw-create-community-modal"
      contentClassName="max-w-lg"
    >
      <div className="w-full bg-[var(--surface)] text-[var(--text)] rounded-3xl border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] select-none">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--primary)]" />
            <h3 className="text-base font-bold text-[var(--text)]">إنشاء مجتمع عراقي جديد</h3>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateCommunityOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] active:scale-95"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Community Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text)]">
              اسم المجتمع <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: نادي مصوري البصرة التراثية"
              className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)] focus:outline-hidden focus:border-[var(--primary)] transition-colors"
            />
          </div>

          {/* Governorate Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text)] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>المحافظة الحاضنة</span>
            </label>
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)] focus:outline-hidden focus:border-[var(--primary)] transition-colors"
            >
              {IRAQI_PROVINCES.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text)]">تصنيف المجال</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)] focus:outline-hidden focus:border-[var(--primary)] transition-colors"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text)]">وصف ورسالة المجتمع</label>
            <textarea
              rows={3}
              maxLength={250}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="عرّف برؤية المجتمع، قواعده، وما يمكن للأعضاء مشاركته..."
              className="w-full p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)] focus:outline-hidden focus:border-[var(--primary)] transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Privacy Toggle */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-[var(--text-muted)]" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[var(--text)]">مجتمع خاص</span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  يتطلب انضمام الأعضاء موافقة إدارة المجتمع
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-strong)] text-[var(--primary)] accent-[var(--primary)] cursor-pointer"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full h-11 rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:opacity-95 active:scale-98 transition-all disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4" />
              <span>إطلاق المجتمع وتفعيل القنوات</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
