import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AppearancePreferences, NotificationPreferences, TaskCategoryItem } from './types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './NotificationService';

const APPEARANCE_KEY = 'digi_appearance_settings_v1';
const TASK_CATEGORIES_KEY = 'digi_task_categories_v1';

export const DEFAULT_APPEARANCE_SETTINGS: AppearancePreferences = {
  mode: 'particles',
  speed: 1.0,
  theme: 'cyber',
  density: 60,
  reducedMotion: false,
  isWorkspaceDefault: false
};

export const DEFAULT_TASK_CATEGORIES: TaskCategoryItem[] = [
  'Graphic Design',
  'Reel Editing',
  'Video Shoot',
  'Video Editing',
  'Script Writing',
  'Caption Writing',
  'Meta Ads',
  'Google Ads',
  'SEO',
  'Website Update',
  'Blog',
  'Other'
].map((name, i) => ({
  id: `cat_${name.toLowerCase().replace(/\s+/g, '_')}`,
  name,
  isArchived: false,
  createdAt: new Date().toISOString()
}));

export class SettingsService {
  private static appearance: AppearancePreferences = DEFAULT_APPEARANCE_SETTINGS;
  private static categories: TaskCategoryItem[] = DEFAULT_TASK_CATEGORIES;
  private static isInitialized = false;

  public static init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Load appearance
    try {
      const rawApp = localStorage.getItem(APPEARANCE_KEY);
      if (rawApp) {
        this.appearance = { ...DEFAULT_APPEARANCE_SETTINGS, ...JSON.parse(rawApp) };
      } else {
        // Compatibility with legacy keys
        const legMode = localStorage.getItem('digi_bg_mode');
        const legSpeed = localStorage.getItem('digi_bg_speed');
        const legTheme = localStorage.getItem('digi_bg_theme');
        const legDensity = localStorage.getItem('digi_bg_density');
        if (legMode) this.appearance.mode = legMode as any;
        if (legSpeed) this.appearance.speed = parseFloat(legSpeed);
        if (legTheme) this.appearance.theme = legTheme as any;
        if (legDensity) this.appearance.density = parseInt(legDensity, 10);
      }
    } catch (e) {}

    // Load categories
    try {
      const rawCat = localStorage.getItem(TASK_CATEGORIES_KEY);
      if (rawCat) {
        this.categories = JSON.parse(rawCat);
      }
    } catch (e) {}

    // Load remote workspace settings
    getDoc(doc(db, 'system', 'workspaceSettings')).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.taskCategories && Array.isArray(data.taskCategories)) {
          this.categories = data.taskCategories;
          this.persistCategories();
          window.dispatchEvent(new CustomEvent('digi_task_categories_changed', { detail: this.categories }));
        }
        if (data.defaultAppearance && !localStorage.getItem(APPEARANCE_KEY)) {
          this.appearance = { ...this.appearance, ...data.defaultAppearance };
          this.persistAppearance();
          window.dispatchEvent(new CustomEvent('digi_appearance_changed', { detail: this.appearance }));
        }
      }
    }).catch(err => {
      console.warn('Workspace settings sync notice:', err);
    });
  }

  // ── Appearance ────────────────────────────────────────────────────────
  public static getAppearance(): AppearancePreferences {
    this.init();
    return { ...this.appearance };
  }

  public static setAppearance(newPrefs: Partial<AppearancePreferences>, isWorkspaceDefault = false): AppearancePreferences {
    this.init();
    this.appearance = { ...this.appearance, ...newPrefs, isWorkspaceDefault };
    this.persistAppearance();

    // Compatibility events for legacy MotionalBackground
    if (typeof window !== 'undefined') {
      localStorage.setItem('digi_bg_mode', this.appearance.mode);
      localStorage.setItem('digi_bg_speed', String(this.appearance.speed));
      localStorage.setItem('digi_bg_theme', this.appearance.theme);
      localStorage.setItem('digi_bg_density', String(this.appearance.density));

      window.dispatchEvent(new CustomEvent('digi_bg_change', {
        detail: {
          mode: this.appearance.mode,
          speed: this.appearance.reducedMotion ? 0.2 : this.appearance.speed,
          theme: this.appearance.theme,
          density: this.appearance.reducedMotion ? 20 : this.appearance.density
        }
      }));

      window.dispatchEvent(new CustomEvent('digi_appearance_changed', { detail: this.appearance }));
    }

    if (isWorkspaceDefault) {
      setDoc(doc(db, 'system', 'workspaceSettings'), {
        defaultAppearance: this.appearance
      }, { merge: true }).catch(() => {});
    }

    return { ...this.appearance };
  }

  // ── Task Categories ───────────────────────────────────────────────────
  public static getActiveCategories(): TaskCategoryItem[] {
    this.init();
    return this.categories.filter(c => !c.isArchived);
  }

  public static getAllCategories(): TaskCategoryItem[] {
    this.init();
    return [...this.categories];
  }

  public static addCategory(name: string, color?: string): TaskCategoryItem {
    this.init();
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name cannot be blank');

    const exists = this.categories.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      if (exists.isArchived) {
        exists.isArchived = false;
        this.persistCategories();
        this.broadcastCategories();
        return exists;
      }
      throw new Error(`Category "${trimmed}" already exists.`);
    }

    const newCat: TaskCategoryItem = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      color: color || '#8B5CF6',
      isArchived: false,
      createdAt: new Date().toISOString()
    };

    this.categories.push(newCat);
    this.persistCategories();
    this.broadcastCategories();
    this.syncCategoriesRemote();
    return newCat;
  }

  public static renameCategory(categoryId: string, newName: string): TaskCategoryItem {
    this.init();
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Category name cannot be blank');

    const cat = this.categories.find(c => c.id === categoryId);
    if (!cat) throw new Error('Category not found');

    cat.name = trimmed;
    cat.updatedAt = new Date().toISOString();
    this.persistCategories();
    this.broadcastCategories();
    this.syncCategoriesRemote();
    return cat;
  }

  public static archiveCategory(categoryId: string): TaskCategoryItem {
    this.init();
    const cat = this.categories.find(c => c.id === categoryId);
    if (!cat) throw new Error('Category not found');

    cat.isArchived = true;
    cat.updatedAt = new Date().toISOString();
    this.persistCategories();
    this.broadcastCategories();
    this.syncCategoriesRemote();
    return cat;
  }

  public static unarchiveCategory(categoryId: string): TaskCategoryItem {
    this.init();
    const cat = this.categories.find(c => c.id === categoryId);
    if (!cat) throw new Error('Category not found');

    cat.isArchived = false;
    cat.updatedAt = new Date().toISOString();
    this.persistCategories();
    this.broadcastCategories();
    this.syncCategoriesRemote();
    return cat;
  }

  // ── System Information ────────────────────────────────────────────────
  public static getSystemInfo() {
    return {
      platform: 'Digiexplode Agency OS · Control Plane 2.0',
      database: 'Firebase Firestore Live Engine',
      auth: 'Firebase Authentication & Secure Session Bridge',
      version: 'v2.4.0 (Enterprise Control Plane)',
      buildDate: '2026.10-Live',
      nodeEnv: 'production-ready',
      permissionsModel: 'Canonical Role-Matrix v1',
      eventBackbone: 'WorkspaceEventService 2.0 (Active)'
    };
  }

  private static persistAppearance() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(APPEARANCE_KEY, JSON.stringify(this.appearance));
      }
    } catch (e) {}
  }

  private static persistCategories() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(TASK_CATEGORIES_KEY, JSON.stringify(this.categories));
      }
    } catch (e) {}
  }

  private static broadcastCategories() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('digi_task_categories_changed', { detail: this.categories }));
    }
  }

  private static syncCategoriesRemote() {
    setDoc(doc(db, 'system', 'workspaceSettings'), {
      taskCategories: this.categories,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});

    try {
      fetch('/api/system/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskCategories: this.categories })
      }).catch(() => {});
    } catch (e) {}
  }
}
