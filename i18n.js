/**
 * ParkLog — Internationalization (i18n)
 * Translation strings for Spanish (primary) and Hebrew (secondary).
 * All UI text goes through t('key') — never hardcoded in HTML/JS.
 *
 * Usage:
 *   t('nav.vaultentry')          → "VaultEntry" / "וולטאנטרי"
 *   applyTranslations()          → updates all [data-i18n] elements
 *   toggleLang()                 → switches language + saves to localStorage
 *   getCurrentLang()             → 'es' | 'he'
 */

const TRANSLATIONS = {
  es: {
    /* ── Navigation ── */
    'nav.vaultentry': 'VaultEntry',
    'nav.commandcenter': 'CommandCenter',
    'nav.language': 'HE 🇮🇱',
    'nav.back': 'Volver',

    /* ── Landing Page ── */
    'app.title': 'ParkLog',
    'app.tagline': 'Sistema de gestión de estacionamiento',
    'landing.vaultentry.title': 'VaultEntry',
    'landing.vaultentry.desc': 'Registro rápido de entrada de vehículos',
    'landing.commandcenter.title': 'CommandCenter',
    'landing.commandcenter.desc': 'Dashboard administrativo con datos y reportes',

    /* ── VaultEntry ── */
    'entry.title': 'Registro de Entrada',
    'entry.subtitle': 'רישום כניסה',
    'entry.placa.label': 'Número de Placa',
    'entry.placa.placeholder': 'Ej: ABC-123',
    'entry.tipo.label': 'Tipo de Vehículo',
    'entry.tipo.auto': 'Automóvil',
    'entry.tipo.moto': 'Motocicleta',
    'entry.notes.label': 'Observaciones',
    'entry.notes.placeholder': 'Notas opcionales (máx. 300 caracteres)',
    'entry.submit': 'Guardar Entrada',
    'entry.submitting': 'Guardando...',

    /* ── Vehicle Status Badges ── */
    'badge.new': '¡Vehículo nuevo!',
    'badge.new.subtitle': 'Primera vez en el sistema',
    'badge.known': 'Vehículo conocido',
    'badge.known.lastSeen': 'Última visita',
    'badge.known.totalVisits': 'visitas en total',

    /* ── Session List ── */
    'session.title': 'Vehículos nuevos esta sesión',
    'session.empty': 'Aún no hay vehículos nuevos en esta sesión',
    'session.copy': 'Copiar todas las placas',
    'session.copied': '¡Copiado!',
    'session.count': 'nuevos',

    /* ── Success / Error Messages ── */
    'msg.saved.new': '¡Guardado! Vehículo nuevo registrado',
    'msg.saved.known': '¡Guardado! Entrada #{count} para este vehículo',
    'msg.error.empty': 'Ingrese un número de placa',
    'msg.error.format': 'Formato inválido: solo letras, números y guión (2-10 caracteres)',
    'msg.error.network': 'Sin conexión — Reintentando',
    'msg.error.server': 'Error del servidor — Intente nuevamente',
    'msg.offline': 'Sin conexión',
    'msg.online': 'Conectado',
    'msg.queued': 'Entrada guardada localmente — se enviará al reconectar',

    /* ── CommandCenter ── */
    'cc.title': 'CommandCenter',
    'cc.subtitle': 'קומנדסנטר',

    /* KPIs */
    'kpi.entriesToday': 'Entradas hoy',
    'kpi.newToday': 'Nuevos hoy',
    'kpi.totalVehicles': 'Total vehículos',
    'kpi.weeklyEntries': 'Entradas semana',

    'kpi.copyPlates': 'Copiar placas',
    'kpi.copiedPlates': '¡Placas copiadas!',
    'kpi.entriesToday.title': 'Entradas hoy',
    'kpi.newToday.title': 'Vehículos nuevos hoy',
    'kpi.emptyEntries': 'No hay entradas hoy',
    'kpi.emptyNew': 'No hay vehículos nuevos hoy',

    /* Filters */
    'filter.search': 'Buscar placa...',
    'filter.type': 'Tipo',
    'filter.type.all': 'Todos',
    'filter.type.auto': 'Automóvil',
    'filter.type.moto': 'Motocicleta',
    'filter.status': 'Estado',
    'filter.status.all': 'Todos',
    'filter.status.new': 'Nuevos',
    'filter.status.known': 'Conocidos',
    'filter.dateFrom': 'Desde',
    'filter.dateTo': 'Hasta',
    'filter.columns': 'Columnas',
    'filter.clear': 'Limpiar filtros',
    'filter.dateError': 'La fecha "Desde" es posterior a "Hasta"',

    /* Table */
    'table.num': '#',
    'table.tipo': 'Tipo',
    'table.placa': 'Placa',
    'table.firstSeen': 'Primera vez',
    'table.lastSeen': 'Última vez',
    'table.allDates': 'Fechas de entrada',
    'table.totalVisits': 'Total entradas',
    'table.status': 'Estado',
    'table.createdBy': 'Registrado por',
    'table.notes': 'Notas',
    'table.actions': 'Acciones',
    'table.empty': 'No hay datos para mostrar',
    'table.noResults': 'No se encontraron resultados',

    /* Exports */
    'export.newToday': 'Nuevos hoy',
    'export.byDate': 'Por fecha',
    'export.byLastSeen': 'Por última visita',
    'export.all': 'Exportar todo',
    'export.copy': 'Copiar al portapapeles',
    'export.csv': 'Descargar CSV',
    'export.copied': '¡Copiado!',

    /* Notes Modal */
    'notes.edit': 'Editar notas',
    'notes.vehicle': 'Notas del vehículo',
    'notes.entry': 'Notas de la entrada',
    'notes.save': 'Guardar',
    'notes.cancel': 'Cancelar',
    'notes.delete': 'Eliminar',
    'notes.saved': '¡Notas guardadas!',
    'notes.deleted': 'Notas eliminadas',
    'notes.lastUpdated': 'Actualizado',
    'notes.charCount': 'caracteres',

    /* Charts */
    'chart.weeklyLoad': 'Entradas por semana',
    'chart.newVsKnown': 'Nuevos vs Conocidos',
    'chart.new': 'Nuevos',
    'chart.known': 'Conocidos',

    /* History */
    'history.title': 'Historial de visitas',
    'history.close': 'Cerrar',

    /* Login */
    'login.title': 'Acceso',
    'login.username': 'Nombre de usuario',
    'login.password': 'Contraseña',
    'login.submit': 'Entrar',

    /* Loading & Empty */
    'loading': 'Cargando...',
    'empty.noEntries': 'No hay entradas aún',
    'empty.noVehicles': 'No hay vehículos registrados',
    'lastUpdated': 'Última actualización'
  },

  he: {
    /* ── Navigation ── */
    'nav.vaultentry': 'וולטאנטרי',
    'nav.commandcenter': 'קומנדסנטר',
    'nav.language': 'ES 🇪🇸',
    'nav.back': 'חזרה',

    /* ── Landing Page ── */
    'app.title': 'דרכלוג',
    'app.tagline': 'מערכת ניהול כניסות רכבים לחניון',
    'landing.vaultentry.title': 'וולטאנטרי',
    'landing.vaultentry.desc': 'רישום מהיר של כניסת רכבים',
    'landing.commandcenter.title': 'קומנדסנטר',
    'landing.commandcenter.desc': 'דשבורד ניהולי עם נתונים ודוחות',

    /* ── VaultEntry ── */
    'entry.title': 'רישום כניסה',
    'entry.subtitle': 'Registro de Entrada',
    'entry.placa.label': 'מספר לוחית',
    'entry.placa.placeholder': 'לדוגמה: ABC-123',
    'entry.tipo.label': 'סוג רכב',
    'entry.tipo.auto': 'מכונית',
    'entry.tipo.moto': 'אופנוע',
    'entry.notes.label': 'הערות',
    'entry.notes.placeholder': 'הערות אופציונליות (מקס. 300 תווים)',
    'entry.submit': 'שמור כניסה',
    'entry.submitting': 'שומר...',

    /* ── Vehicle Status Badges ── */
    'badge.new': 'רכב חדש!',
    'badge.new.subtitle': 'פעם ראשונה במערכת',
    'badge.known': 'רכב מוכר',
    'badge.known.lastSeen': 'ביקור אחרון',
    'badge.known.totalVisits': 'ביקורים בסה"כ',

    /* ── Session List ── */
    'session.title': 'רכבים חדשים בסשן זה',
    'session.empty': 'עדיין אין רכבים חדשים בסשן זה',
    'session.copy': 'העתק את כל הלוחיות',
    'session.copied': 'הועתק!',
    'session.count': 'חדשים',

    /* ── Success / Error Messages ── */
    'msg.saved.new': 'נשמר! רכב חדש נרשם',
    'msg.saved.known': 'נשמר! כניסה #{count} לרכב זה',
    'msg.error.empty': 'הזן מספר לוחית',
    'msg.error.format': 'פורמט לא תקין: רק אותיות, מספרים ומקף (2-10 תווים)',
    'msg.error.network': 'אין חיבור — מנסה שוב',
    'msg.error.server': 'שגיאת שרת — נסה שוב',
    'msg.offline': 'אופליין',
    'msg.online': 'מחובר',
    'msg.queued': 'הכניסה נשמרה מקומית — תישלח בהתחברות מחדש',

    /* ── CommandCenter ── */
    'cc.title': 'קומנדסנטר',
    'cc.subtitle': 'CommandCenter',

    /* KPIs */
    'kpi.entriesToday': 'כניסות היום',
    'kpi.newToday': 'חדשים היום',
    'kpi.totalVehicles': 'סה"כ רכבים',
    'kpi.weeklyEntries': 'כניסות השבוע',

    'kpi.copyPlates': 'העתק לוחיות',
    'kpi.copiedPlates': 'הלוחיות הועתקו!',
    'kpi.entriesToday.title': 'כניסות היום',
    'kpi.newToday.title': 'רכבים חדשים היום',
    'kpi.emptyEntries': 'אין כניסות היום',
    'kpi.emptyNew': 'אין רכבים חדשים היום',

    /* Filters */
    'filter.search': 'חיפוש לוחית...',
    'filter.type': 'סוג',
    'filter.type.all': 'הכל',
    'filter.type.auto': 'מכונית',
    'filter.type.moto': 'אופנוע',
    'filter.status': 'סטטוס',
    'filter.status.all': 'הכל',
    'filter.status.new': 'חדשים',
    'filter.status.known': 'מוכרים',
    'filter.dateFrom': 'מתאריך',
    'filter.dateTo': 'עד תאריך',
    'filter.columns': 'עמודות',
    'filter.clear': 'נקה פילטרים',
    'filter.dateError': 'התאריך "מ" מאוחר מ"עד"',

    /* Table */
    'table.num': '#',
    'table.tipo': 'סוג',
    'table.placa': 'לוחית',
    'table.firstSeen': 'כניסה ראשונה',
    'table.lastSeen': 'כניסה אחרונה',
    'table.allDates': 'תאריכי כניסה',
    'table.totalVisits': 'סה"כ כניסות',
    'table.status': 'סטטוס',
    'table.createdBy': 'נרשם על ידי',
    'table.notes': 'הערות',
    'table.actions': 'פעולות',
    'table.empty': 'אין נתונים להצגה',
    'table.noResults': 'לא נמצאו תוצאות',

    /* Exports */
    'export.newToday': 'חדשים היום',
    'export.byDate': 'לפי תאריך',
    'export.byLastSeen': 'לפי כניסה אחרונה',
    'export.all': 'ייצוא הכל',
    'export.copy': 'העתק ללוח',
    'export.csv': 'הורד CSV',
    'export.copied': 'הועתק!',

    /* Notes Modal */
    'notes.edit': 'ערוך הערות',
    'notes.vehicle': 'הערות רכב',
    'notes.entry': 'הערות כניסה',
    'notes.save': 'שמור',
    'notes.cancel': 'ביטול',
    'notes.delete': 'מחק',
    'notes.saved': 'ההערות נשמרו!',
    'notes.deleted': 'ההערות נמחקו',
    'notes.lastUpdated': 'עודכן',
    'notes.charCount': 'תווים',

    /* Charts */
    'chart.weeklyLoad': 'כניסות לפי שבוע',
    'chart.newVsKnown': 'חדשים מול מוכרים',
    'chart.new': 'חדשים',
    'chart.known': 'מוכרים',

    /* History */
    'history.title': 'היסטוריית ביקורים',
    'history.close': 'סגור',

    /* Login */
    'login.title': 'כניסה',
    'login.username': 'שם משתמש',
    'login.password': 'סיסמה',
    'login.submit': 'כניסה',

    /* Loading & Empty */
    'loading': 'טוען...',
    'empty.noEntries': 'אין כניסות עדיין',
    'empty.noVehicles': 'אין רכבים רשומים',
    'lastUpdated': 'עדכון אחרון'
  }
};

/** Current language state */
let currentLang = localStorage.getItem('parklog-lang') || CONFIG.DEFAULT_LANG;

/**
 * Returns the current active language.
 * @returns {'es'|'he'}
 */
function getCurrentLang() {
  return currentLang;
}

/**
 * Translates a key to the current language string.
 * Supports interpolation: t('msg.saved.known', { count: 5 })
 *
 * @param {string} key - Translation key (e.g., 'entry.title')
 * @param {Object} [params] - Optional interpolation params
 * @returns {string} Translated string, or key if not found
 */
function t(key, params = {}) {
  let text = TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS['es']?.[key] || key;

  Object.entries(params).forEach(([param, value]) => {
    text = text.replace(`#{${param}}`, value);
  });

  return text;
}

/**
 * Applies translations to all elements with [data-i18n] attribute.
 * The attribute value is the translation key.
 * Optional [data-i18n-attr] specifies which attribute to set (default: textContent).
 *
 * @returns {void}
 */
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');

    if (attr) {
      el.setAttribute(attr, t(key));
    } else {
      el.textContent = t(key);
    }
  });

  /* Update HTML dir and lang attributes */
  const htmlEl = document.documentElement;
  if (currentLang === 'he') {
    htmlEl.setAttribute('dir', 'rtl');
    htmlEl.setAttribute('lang', 'he');
  } else {
    htmlEl.setAttribute('dir', 'ltr');
    htmlEl.setAttribute('lang', 'es');
  }
}

/**
 * Toggles between Spanish and Hebrew.
 * Saves preference to localStorage and re-applies translations.
 *
 * @returns {void}
 */
function toggleLang() {
  currentLang = currentLang === 'es' ? 'he' : 'es';
  localStorage.setItem('parklog-lang', currentLang);
  applyTranslations();
}
