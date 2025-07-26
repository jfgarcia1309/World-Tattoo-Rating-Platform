
// API Configuration for Global Sync
class APIClient {
  static baseURL = window.location.origin;
  static maxRetries = 3;
  static retryDelay = 1000;
  
  static async request(endpoint, options = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseURL}/api${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Timestamp': new Date().toISOString(),
            ...options.headers
          },
          timeout: 10000,
          ...options
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (attempt > 1) {
          console.log(`✅ API request succeeded on attempt ${attempt}`);
        }
        
        return data;
      } catch (error) {
        lastError = error;
        console.warn(`API attempt ${attempt}/${this.maxRetries} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }
    
    console.error('API Error after all retries:', lastError);
    throw lastError;
  }
  
  static async get(endpoint) {
    return this.request(endpoint);
  }
  
  static async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  static async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  static async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }
}

// Global Sync Manager
class GlobalSyncManager {
  static syncInterval = null;
  static lastSyncTime = null;
  static isSyncing = false;
  static isOnline = navigator.onLine;
  static region = 'unknown';
  
  static async initialize() {
    try {
      // Verificar conectividad y obtener información del servidor
      const healthCheck = await APIClient.get('/health');
      this.region = healthCheck.region || 'global';
      
      console.log(`🌐 Conexión global establecida - Región: ${this.region}`);
      console.log(`📊 Servidor: ${healthCheck.deployment} - ${healthCheck.timestamp}`);
      
      // Sincronizar datos iniciales
      await this.syncFromServer();
      
      // Configurar sincronización automática
      this.startAutoSync();
      
      // Configurar listeners de conectividad
      this.setupConnectivityListeners();
      
      return true;
    } catch (error) {
      console.warn('⚠️ Modo offline - usando datos locales');
      this.setupOfflineMode();
      return false;
    }
  }
  
  static setupConnectivityListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Conexión restaurada - reiniciando sincronización');
      this.isOnline = true;
      this.initialize();
    });
    
    window.addEventListener('offline', () => {
      console.log('📱 Modo offline activado');
      this.isOnline = false;
      this.stopAutoSync();
    });
  }
  
  static setupOfflineMode() {
    this.isOnline = false;
    // Intentar reconectar cada 30 segundos
    setTimeout(() => {
      if (!this.isOnline) {
        this.initialize();
      }
    }, 30000);
  }
  
  static startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncFromServer();
      } catch (error) {
        console.warn('Error en sincronización automática:', error);
      }
    }, 30000); // Cada 30 segundos
  }
  
  static stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  static async syncFromServer() {
    if (this.isSyncing) return;
    
    try {
      this.isSyncing = true;
      const serverData = await APIClient.get('/data');
      
      if (serverData && window.app) {
        // Actualizar datos en la aplicación
        window.app.tatuadores = serverData.tatuadores || [];
        window.app.jurados = serverData.jurados || [];
        window.app.evaluaciones = serverData.evaluaciones || [];
        
        // Actualizar credenciales del sistema
        if (serverData.systemCredentials) {
          localStorage.setItem('systemCredentials', JSON.stringify(serverData.systemCredentials));
        }
        
        // Actualizar interfaz si es necesario
        window.app.updateAllUI();
        
        this.lastSyncTime = new Date();
        console.log('✅ Datos sincronizados desde servidor');
      }
    } catch (error) {
      console.warn('Error sincronizando desde servidor:', error);
    } finally {
      this.isSyncing = false;
    }
  }
  
  static async syncToServer(data) {
    try {
      await APIClient.post('/data', data);
      console.log('✅ Datos sincronizados al servidor');
      return true;
    } catch (error) {
      console.warn('Error sincronizando al servidor:', error);
      return false;
    }
  }
}

// Utility Functions
class Utils {
  static showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification notification-${type} show`;

    const iconMap = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };

    notification.innerHTML = `
      <i class="${iconMap[type]}"></i>
      <span>${message}</span>
      <button class="notification-close" onclick="this.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    `;

    container.appendChild(notification);

    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  static formatNumber(num) {
    return new Intl.NumberFormat('es-ES').format(num);
  }

  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  static validatePhone(phone) {
    const re = /^[\+]?[1-9][\d]{0,15}$/;
    return re.test(phone.replace(/\s/g, ''));
  }

  static formatCategoryName(categoria) {
    const categoryNames = {
      'anime-comic': 'Anime y Comic',
      'blackwork': 'Blackwork',
      'color': 'Color',
      'lettering': 'Lettering',
      'homenaje': 'Homenaje',
      'libre': 'Libre',
      'neotradi': 'Neo-Tradicional',
      'nuevo-artista': 'Nuevo Artista',
      'r-color': 'Realismo Color',
      'r-sombras': 'Realismo Sombras',
      'sombras': 'Sombras',
      'tradicionales': 'Tradicionales'
    };
    return categoryNames[categoria] || categoria;
  }

  static animateNumber(element, start, end, duration = 2000) {
    const startTime = Date.now();
    const updateNumber = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * easeOut);
      element.textContent = this.formatNumber(current);

      if (progress < 1) {
        requestAnimationFrame(updateNumber);
      }
    };
    requestAnimationFrame(updateNumber);
  }
}

// Authentication Manager
class AuthManager {
  // Credenciales generadas dinámicamente - no expuestas
  static credentials = {};

  // Generador de credenciales aleatorias
  static generateRandomCredentials() {
    const adjectives = ['Swift', 'Secure', 'Dynamic', 'Advanced', 'Elite', 'Prime', 'Ultra', 'Global', 'Expert', 'Master'];
    const nouns = ['System', 'Portal', 'Access', 'Control', 'Manager', 'Gateway', 'Network', 'Platform', 'Console', 'Interface'];
    const numbers = Math.floor(Math.random() * 9000) + 1000;
    
    const username = adjectives[Math.floor(Math.random() * adjectives.length)] + 
                    nouns[Math.floor(Math.random() * nouns.length)] + 
                    numbers;
    
    // Generar contraseña segura de 12 caracteres
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return { username, password };
  }

  // Inicializar credenciales del sistema
  static initializeSystemCredentials() {
    let credentials = {};
    
    try {
      const existingCredentials = localStorage.getItem('systemCredentials');
      if (existingCredentials) {
        credentials = JSON.parse(existingCredentials);
      }
    } catch (e) {
      console.error('Error loading credentials:', e);
    }

    // Solo generar credenciales si no existen
    if (!credentials.administracion) {
      // Admin mantiene credenciales fijas para acceso inicial
      credentials.administracion = {
        username: 'admin',
        password: 'Colombia2026',
        email: 'admin@tattoorating.com',
        permissions: ['evaluacion', 'administracion', 'registro', 'resultados']
      };
    }

    // Generar credenciales aleatorias para otros módulos si no existen
    if (!credentials.evaluacion) {
      const evalCreds = this.generateRandomCredentials();
      credentials.evaluacion = {
        username: evalCreds.username,
        password: evalCreds.password,
        email: 'evaluacion@tattoorating.com',
        permissions: ['evaluacion']
      };
    }

    if (!credentials.registro) {
      const regCreds = this.generateRandomCredentials();
      credentials.registro = {
        username: regCreds.username,
        password: regCreds.password,
        email: 'registro@tattoorating.com',
        permissions: ['registro']
      };
    }

    if (!credentials.resultados) {
      const resCreds = this.generateRandomCredentials();
      credentials.resultados = {
        username: resCreds.username,
        password: resCreds.password,
        email: 'resultados@tattoorating.com',
        permissions: ['resultados']
      };
    }

    // Guardar credenciales de forma segura
    localStorage.setItem('systemCredentials', JSON.stringify(credentials));
    return credentials;
  }

  // Regenerar credenciales (solo admin)
  static regenerateCredentials(section, currentAdminSession) {
    if (!currentAdminSession || !this.isLoggedIn('administracion')) {
      return { success: false, message: 'Acceso denegado. Solo administradores pueden regenerar credenciales.' };
    }

    if (section === 'administracion') {
      return { success: false, message: 'No se pueden regenerar las credenciales de administrador desde esta función.' };
    }

    try {
      const credentials = JSON.parse(localStorage.getItem('systemCredentials') || '{}');
      const newCreds = this.generateRandomCredentials();
      
      credentials[section] = {
        ...credentials[section],
        username: newCreds.username,
        password: newCreds.password
      };

      localStorage.setItem('systemCredentials', JSON.stringify(credentials));
      
      return { 
        success: true, 
        message: `Credenciales regeneradas para ${section}`,
        credentials: { username: newCreds.username, password: newCreds.password }
      };
    } catch (e) {
      return { success: false, message: 'Error al regenerar credenciales' };
    }
  }

  // Cambiar contraseña de administrador
  static changeAdminPassword(newPassword, confirmPassword, currentAdminSession) {
    if (!currentAdminSession || !this.isLoggedIn('administracion')) {
      return { success: false, message: 'Acceso denegado.' };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, message: 'Las contraseñas no coinciden.' };
    }

    if (newPassword.length < 8) {
      return { success: false, message: 'La contraseña debe tener al menos 8 caracteres.' };
    }

    try {
      const credentials = JSON.parse(localStorage.getItem('systemCredentials') || '{}');
      credentials.administracion.password = newPassword;
      localStorage.setItem('systemCredentials', JSON.stringify(credentials));
      
      return { success: true, message: 'Contraseña de administrador actualizada correctamente.' };
    } catch (e) {
      return { success: false, message: 'Error al actualizar contraseña.' };
    }
  }

  // Obtener credenciales (solo para admin)
  static getCredentialsForAdmin(section) {
    if (!this.isLoggedIn('administracion')) {
      return null;
    }

    try {
      const credentials = JSON.parse(localStorage.getItem('systemCredentials') || '{}');
      return credentials[section] || null;
    } catch (e) {
      return null;
    }
  }

  static currentUser = {
    admin: null,
    evaluacion: null,
    registro: null,
    resultados: null
  };

  static login(username, password, section) {
    // Validar que se ingresen credenciales
    if (!username || !password) {
      return { success: false, message: 'Debe ingresar usuario y contraseña' };
    }

    // Inicializar credenciales si no existen
    const credentials = this.initializeSystemCredentials();

    // Verificar credenciales según la sección
    const sectionCredentials = credentials[section];
    if (!sectionCredentials) {
      return { success: false, message: 'Sección no configurada' };
    }

    // Verificar si es admin intentando acceder a cualquier módulo
    const adminCredentials = credentials.administracion;
    const isAdminLogin = username === adminCredentials.username && password === adminCredentials.password;
    
    // Si es admin, puede acceder a cualquier módulo
    if (isAdminLogin) {
      const userKey = 'admin';
      this.currentUser[userKey] = {
        username: adminCredentials.username,
        email: adminCredentials.email,
        permissions: adminCredentials.permissions,
        loginTime: new Date(),
        activeSection: section,
        isAdmin: true
      };
      return { success: true, userType: 'administracion', permissions: adminCredentials.permissions, isAdmin: true };
    }

    // Verificar credenciales específicas del módulo
    if (username === sectionCredentials.username && password === sectionCredentials.password) {
      const userKey = section;
      this.currentUser[userKey] = {
        username: username,
        email: sectionCredentials.email || `${section}@tattoorating.com`,
        permissions: sectionCredentials.permissions || [section],
        loginTime: new Date(),
        activeSection: section,
        isAdmin: false
      };
      return { success: true, userType: section, permissions: sectionCredentials.permissions || [section] };
    }

    return { success: false, message: 'Credenciales incorrectas' };
  }

  static logout(type) {
    if (type === 'administracion') {
      this.currentUser.admin = null;
    } else if (type === 'evaluacion') {
      this.currentUser.evaluacion = null;
    } else if (type === 'registro') {
      this.currentUser.registro = null;
    } else if (type === 'resultados') {
      this.currentUser.resultados = null;
    }
  }

  static isLoggedIn(section) {
    // Admin tiene acceso universal
    if (this.currentUser.admin !== null) {
      return true;
    }
    
    // Verificar acceso específico del módulo
    if (section === 'evaluacion') {
      return this.currentUser.evaluacion !== null;
    }
    if (section === 'administracion') {
      return false; // Solo admin puede acceder
    }
    if (section === 'registro') {
      return this.currentUser.registro !== null;
    }
    if (section === 'resultados') {
      return this.currentUser.resultados !== null;
    }
    return false;
  }

  static getCurrentUser(section) {
    // Admin tiene prioridad en todos los módulos
    if (this.currentUser.admin !== null) {
      return this.currentUser.admin;
    }
    
    // Retornar usuario específico del módulo
    if (section === 'evaluacion') {
      return this.currentUser.evaluacion;
    }
    if (section === 'administracion') {
      return null; // Solo admin
    }
    if (section === 'registro') {
      return this.currentUser.registro;
    }
    if (section === 'resultados') {
      return this.currentUser.resultados;
    }
    return null;
  }

  static showPasswordRecovery(type) {
    const modal = document.getElementById('passwordRecoveryModal');
    if (modal) {
      modal.classList.add('active');
    }
  }

  static hidePasswordRecovery() {
    const modal = document.getElementById('passwordRecoveryModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }
}

// Main Application Class
class TattooRatingApp {
  constructor() {
    this.tatuadores = [];
    this.jurados = [];
    this.evaluaciones = [];
    this.sessionTimeout = null;
    this.sessionTimeoutDuration = 0; // Desactivado (0 = sin timeout)
    this.lastActivity = Date.now();
    this.categorias = [
      'anime-comic', 'blackwork', 'color', 'lettering', 'homenaje', 'libre',
      'neotradi', 'nuevo-artista', 'r-color', 'r-sombras', 'sombras', 'tradicionales'
    ];

    this.criteriosPorCategoria = {
      'anime-comic': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'],
      'blackwork': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'],
      'color': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'],
      'lettering': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'],
      'homenaje': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'],
      'libre': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'],
      'neotradi': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'],
      'nuevo-artista': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'],
      'r-color': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'],
      'r-sombras': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'],
      'sombras': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'],
      'tradicionales': ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad']
    };

    this.initialize();
  }

  async initialize() {
    this.initializeSystemCredentials();
    await this.loadData();
    this.initEventListeners();
    this.updateHomeStats();
  }

  initializeSystemCredentials() {
    // Inicializar credenciales aleatorias usando AuthManager
    AuthManager.initializeSystemCredentials();
  }

  initEventListeners() {
    // Limpiar todos los formularios de login al cargar
    this.clearAllLoginForms();

    // Limpiar credenciales cuando se recarga la página o se oculta
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearAllLoginForms();
      }
    });

    // Limpiar credenciales al salir de la página
    window.addEventListener('beforeunload', () => {
      this.clearAllLoginForms();
    });

    // Limpiar credenciales periódicamente por seguridad (cada 30 segundos)
    setInterval(() => {
      // Solo limpiar formularios de módulos no activos
      const activeSections = [];
      if (AuthManager.isLoggedIn('administracion')) activeSections.push('administracion');
      if (AuthManager.isLoggedIn('evaluacion')) activeSections.push('evaluacion');
      if (AuthManager.isLoggedIn('registro')) activeSections.push('registro');
      if (AuthManager.isLoggedIn('resultados')) activeSections.push('resultados');

      const allSections = ['administracion', 'evaluacion', 'registro', 'resultados'];
      allSections.forEach(section => {
        if (!activeSections.includes(section)) {
          this.clearModuleCredentials(section);
        }
      });
    }, 30000); // Cada 30 segundos

    // Navigation
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (link) {
        e.preventDefault();
        const section = link.getAttribute('data-section');
        if (section) {
          this.showSection(section);
        }
      }
    });

    // Mobile menu toggle functionality
    const mobileToggle = document.querySelector('.nav-mobile-toggle');
    const navMenu = document.querySelector('.nav-menu');
    if (mobileToggle && navMenu) {
      mobileToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        navMenu.classList.toggle('active');
      });

      // Close mobile menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
          navMenu.classList.remove('active');
        }
      });
    }

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.currentTarget.getAttribute('data-tab');
        this.switchTab(e.currentTarget, tabName);
      });
    });

    // Form handlers
    document.getElementById('tatuadorForm')?.addEventListener('submit', (e) => this.handleTatuadorSubmit(e));
    document.getElementById('juradoForm')?.addEventListener('submit', (e) => this.handleJuradoSubmit(e));
    document.getElementById('evaluacionLoginForm')?.addEventListener('submit', (e) => this.handleEvaluacionLogin(e));
    document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => this.handleAdminLogin(e));
    document.getElementById('registroLoginForm')?.addEventListener('submit', (e) => this.handleRegistroLogin(e));
    document.getElementById('resultadosLoginForm')?.addEventListener('submit', (e) => this.handleResultadosLogin(e));
    document.getElementById('criteriosForm')?.addEventListener('submit', (e) => this.handleEvaluacionSubmit(e));
    document.getElementById('adminPasswordForm')?.addEventListener('submit', (e) => this.handleAdminPasswordChange(e));

    // Evaluation selects
    document.getElementById('juradoSelect')?.addEventListener('change', () => this.updateEvaluationForm());
    document.getElementById('tatuadorSelect')?.addEventListener('change', () => this.updateEvaluationForm());

    // Results filter
    document.getElementById('categoriaFilter')?.addEventListener('change', () => this.updateResultadosUI());

    // Score authentication
    document.getElementById('scoreAuthForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const username = formData.get('username');
      const password = formData.get('password');
      this.handleScoreAuth(username, password);
    });

    

    // Activity listeners for session timeout
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => this.resetActivityTimeout(), true);
    });
  }

  showSection(sectionName) {
    // Auto logout when navigating to public sections
    if (['home', 'score'].includes(sectionName)) {
      if (AuthManager.isLoggedIn('evaluacion')) {
        this.logout('evaluacion', 'navigation');
      }
      if (AuthManager.isLoggedIn('administracion')) {
        this.logout('administracion', 'navigation');
      }
      if (AuthManager.isLoggedIn('registro')) {
        this.logout('registro', 'navigation');
      }
      if (AuthManager.isLoggedIn('resultados')) {
        this.logout('resultados', 'navigation');
      }
    }

    // Auto logout when switching between different protected panels
    const protectedSections = ['evaluacion', 'administracion', 'registro', 'resultados'];
    if (protectedSections.includes(sectionName)) {
      protectedSections.forEach(section => {
        if (section !== sectionName && AuthManager.isLoggedIn(section)) {
          this.logout(section, 'panel_switch');
        }
      });
    }

    // Limpiar credenciales de formularios no activos cuando se cambia de sección
    const allSections = ['evaluacion', 'administracion', 'registro', 'resultados'];
    allSections.forEach(section => {
      if (section !== sectionName) {
        this.clearModuleCredentials(section);
      }
    });

    // Update navigation - Remove active from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    
    // Add active class to current section link
    const activeLinks = document.querySelectorAll(`[data-section="${sectionName}"]`);
    activeLinks.forEach(link => {
      if (link.classList.contains('nav-link')) {
        link.classList.add('active');
      }
    });

    // Show section - Hide all sections first
    document.querySelectorAll('.section').forEach(section => {
      section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
      targetSection.classList.add('active');
      
      // Update URL hash without triggering hashchange event
      if (window.location.hash !== `#${sectionName}`) {
        history.pushState(null, null, `#${sectionName}`);
      }
    }

    // Section-specific logic
    if (sectionName === 'evaluacion') {
      this.checkEvaluacionAccess();
    } else if (sectionName === 'administracion') {
      this.checkAdminAccess();
    } else if (sectionName === 'registro') {
      this.checkRegistroAccess();
    } else if (sectionName === 'resultados') {
      this.checkResultadosAccess();
    } else if (sectionName === 'home') {
      this.updateHomeStats();
    } else if (sectionName === 'score') {
      this.updateScoreSection();
    }

    // Close mobile menu if it's open
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu && navMenu.classList.contains('active')) {
      navMenu.classList.remove('active');
    }
  }

  switchTab(button, tabName) {
    const container = button.closest('.admin-tabs, .registration-tabs');
    if (!container) return;

    // Update tab buttons
    container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Show tab pane
    const section = container.closest('.section');
    section.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    const targetPane = section.querySelector(`#${tabName}Tab`);
    if (targetPane) {
      targetPane.classList.add('active');
    }
  }

  handleTatuadorSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const nombre = formData.get('nombre');
    const categoria = formData.get('categoria');
    const email = formData.get('email');
    const telefono = formData.get('telefono');

    // Validation
    if (!Utils.validateEmail(email)) {
      Utils.showNotification('Por favor ingresa un email válido', 'error');
      return;
    }

    if (!Utils.validatePhone(telefono)) {
      Utils.showNotification('Por favor ingresa un teléfono válido', 'error');
      return;
    }

    // Check duplicates
    if (this.tatuadores.some(t => t.email === email)) {
      Utils.showNotification('Ya existe un tatuador registrado con este email', 'error');
      return;
    }

    const tatuador = {
      id: Utils.generateId(),
      nombre,
      categoria,
      email,
      telefono,
      fechaRegistro: new Date().toISOString()
    };

    this.tatuadores.push(tatuador);
    this.saveData();
    this.updateHomeStats();
    this.updateAdminUI();

    Utils.showNotification('Tatuador registrado exitosamente', 'success');
    e.target.reset();
  }

  handleJuradoSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const nombre = formData.get('nombre');
    const email = formData.get('email');
    const experiencia = parseInt(formData.get('experiencia'));
    const especialidad = formData.get('especialidad');

    // Validation
    if (!Utils.validateEmail(email)) {
      Utils.showNotification('Por favor ingresa un email válido', 'error');
      return;
    }

    if (experiencia < 1) {
      Utils.showNotification('La experiencia debe ser de al menos 1 año', 'error');
      return;
    }

    // Check duplicates
    if (this.jurados.some(j => j.email === email)) {
      Utils.showNotification('Ya existe un jurado registrado con este email', 'error');
      return;
    }

    const jurado = {
      id: Utils.generateId(),
      nombre,
      email,
      experiencia,
      especialidad,
      fechaRegistro: new Date().toISOString()
    };

    this.jurados.push(jurado);
    this.saveData();
    this.updateHomeStats();
    this.updateAdminUI();
    this.updateEvaluationSelects();

    Utils.showNotification('Jurado registrado exitosamente', 'success');
    e.target.reset();
  }

  handleEvaluacionLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    const result = AuthManager.login(username, password, 'evaluacion');

    if (result.success) {
      Utils.showNotification('Acceso autorizado al sistema de evaluación', 'success');
      this.showEvaluacionPanel();
      this.updateEvaluationSelects();
    } else {
      Utils.showNotification(result.message || 'Credenciales incorrectas', 'error');
      // Limpiar formulario inmediatamente después de fallo de login
      setTimeout(() => {
        this.clearLoginForm('evaluacionLoginForm');
      }, 2000);
    }
  }

  handleAdminLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    const result = AuthManager.login(username, password, 'administracion');

    if (result.success) {
      Utils.showNotification('Acceso de administrador autorizado', 'success');
      this.showAdminPanel();
      this.updateAdminUI();
    } else {
      Utils.showNotification(result.message || 'Credenciales de administrador incorrectas', 'error');
      // Limpiar formulario inmediatamente después de fallo de login
      setTimeout(() => {
        this.clearLoginForm('adminLoginForm');
      }, 2000);
    }
  }

  handleRegistroLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    const result = AuthManager.login(username, password, 'registro');

    if (result.success) {
      Utils.showNotification('Acceso autorizado al sistema de registro', 'success');
      this.showRegistroPanel();
    } else {
      Utils.showNotification(result.message || 'Credenciales incorrectas', 'error');
      // Limpiar formulario inmediatamente después de fallo de login
      setTimeout(() => {
        this.clearLoginForm('registroLoginForm');
      }, 2000);
    }
  }

  handleResultadosLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    const result = AuthManager.login(username, password, 'resultados');

    if (result.success) {
      Utils.showNotification('Acceso autorizado al sistema de resultados', 'success');
      this.showResultadosPanel();
      this.updateResultadosUI();
    } else {
      Utils.showNotification(result.message || 'Credenciales incorrectas', 'error');
      // Limpiar formulario inmediatamente después de fallo de login
      setTimeout(() => {
        this.clearLoginForm('resultadosLoginForm');
      }, 2000);
    }
  }

  handleEvaluacionSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const juradoId = document.getElementById('juradoSelect').value;
    const tatuadorId = document.getElementById('tatuadorSelect').value;

    if (!juradoId || !tatuadorId) {
      Utils.showNotification('Debes seleccionar jurado y tatuador', 'error');
      return;
    }

    const jurado = this.jurados.find(j => j.id === juradoId);
    const tatuador = this.tatuadores.find(t => t.id === tatuadorId);

    // Verificar si ya existe una evaluación de este jurado para este tatuador en esta categoría
    const evaluacionExistente = this.evaluaciones.find(e => 
      e.juradoId === juradoId && 
      e.tatuadorId === tatuadorId && 
      e.categoria === tatuador.categoria
    );

    if (evaluacionExistente) {
      Utils.showNotification(`Restricción de evaluación: El jurado ${jurado.nombre} ya evaluó a ${tatuador.nombre} en la categoría ${Utils.formatCategoryName(tatuador.categoria)}. Un jurado solo puede evaluar a un tatuador una vez por categoría.`, 'error');
      return;
    }

    const criterios = {};
    const criteriosInputs = document.querySelectorAll('.criterio-input');
    let totalPuntuacion = 0;
    let criteriosEvaluados = 0;

    // Validar que todos los criterios hayan sido evaluados
    criteriosInputs.forEach(input => {
      const valor = parseFloat(input.value);
      if (valor > 0) {
        criteriosEvaluados++;
      }
      criterios[input.name] = valor;
      totalPuntuacion += valor;
    });

    // Verificar que se hayan evaluado todos los criterios
    if (criteriosEvaluados !== criteriosInputs.length) {
      Utils.showNotification('Debe evaluar todos los criterios antes de guardar la evaluación', 'error');
      return;
    }

    // Verificar que no haya criterios con puntuación 0
    const criteriosConCero = Array.from(criteriosInputs).filter(input => parseFloat(input.value) === 0);
    if (criteriosConCero.length > 0) {
      Utils.showNotification('Todos los criterios deben tener una puntuación mayor a 0', 'error');
      return;
    }

    const promedio = Math.round((totalPuntuacion / criteriosInputs.length) * 100) / 100;

    const evaluacion = {
      id: Utils.generateId(),
      juradoId: jurado.id,
      jurado: jurado.nombre,
      tatuadorId: tatuador.id,
      tatuador: tatuador.nombre,
      categoria: tatuador.categoria,
      criterios,
      puntuacionTotal: promedio,
      fecha: new Date().toISOString()
    };

    this.evaluaciones.push(evaluacion);
    this.saveData();
    this.updateHomeStats();
    this.updateAdminUI();
    this.updateResultadosUI();
    this.resetEvaluationForm();

    Utils.showNotification('Evaluación guardada exitosamente', 'success');
  }

  checkEvaluacionAccess() {
    const loginPanel = document.getElementById('evaluacionLogin');
    const evaluacionPanel = document.getElementById('evaluacionPanel');
    const userName = document.getElementById('evaluacionUserName');

    if (AuthManager.isLoggedIn('evaluacion')) {
      loginPanel.classList.add('hidden');
      evaluacionPanel.classList.remove('hidden');
      const user = AuthManager.getCurrentUser('evaluacion');
      userName.textContent = user.username;
      this.startSessionTimeout('evaluacion');
    } else {
      loginPanel.classList.remove('hidden');
      evaluacionPanel.classList.add('hidden');
    }
  }

  checkAdminAccess() {
    const loginPanel = document.getElementById('adminLogin');
    const adminPanel = document.getElementById('adminPanel');
    const userName = document.getElementById('adminUserName');

    if (AuthManager.isLoggedIn('administracion')) {
      loginPanel.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      const user = AuthManager.getCurrentUser('administracion');
      userName.textContent = user.username;
      this.startSessionTimeout('administracion');
    } else {
      loginPanel.classList.remove('hidden');
      adminPanel.classList.add('hidden');
    }
  }

  checkRegistroAccess() {
    const loginPanel = document.getElementById('registroLogin');
    const registroPanel = document.getElementById('registroPanel');
    const userName = document.getElementById('registroUserName');

    if (AuthManager.isLoggedIn('registro')) {
      loginPanel.classList.add('hidden');
      registroPanel.classList.remove('hidden');
      const user = AuthManager.getCurrentUser('registro');
      userName.textContent = user.username;
      this.startSessionTimeout('registro');
    } else {
      loginPanel.classList.remove('hidden');
      registroPanel.classList.add('hidden');
    }
  }

  checkResultadosAccess() {
    const loginPanel = document.getElementById('resultadosLogin');
    const resultadosPanel = document.getElementById('resultadosPanel');
    const userName = document.getElementById('resultadosUserName');

    if (AuthManager.isLoggedIn('resultados')) {
      loginPanel.classList.add('hidden');
      resultadosPanel.classList.remove('hidden');
      const user = AuthManager.getCurrentUser('resultados');
      userName.textContent = user.username;
      this.startSessionTimeout('resultados');
    } else {
      loginPanel.classList.remove('hidden');
      resultadosPanel.classList.add('hidden');
    }
  }

  showEvaluacionPanel() {
    document.getElementById('evaluacionLogin').classList.add('hidden');
    document.getElementById('evaluacionPanel').classList.remove('hidden');
    const user = AuthManager.getCurrentUser('evaluacion');
    document.getElementById('evaluacionUserName').textContent = user.username;
    this.startSessionTimeout('evaluacion');
  }

  showAdminPanel() {
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    const user = AuthManager.getCurrentUser('administracion');
    document.getElementById('adminUserName').textContent = user.username;
    this.startSessionTimeout('administracion');
  }

  showRegistroPanel() {
    document.getElementById('registroLogin').classList.add('hidden');
    document.getElementById('registroPanel').classList.remove('hidden');
    const user = AuthManager.getCurrentUser('registro');
    document.getElementById('registroUserName').textContent = user.username;
    this.startSessionTimeout('registro');
  }

  showResultadosPanel() {
    document.getElementById('resultadosLogin').classList.add('hidden');
    document.getElementById('resultadosPanel').classList.remove('hidden');
    const user = AuthManager.getCurrentUser('resultados');
    document.getElementById('resultadosUserName').textContent = user.username;
    this.startSessionTimeout('resultados');
  }

  startSessionTimeout(type) {
    this.lastActivity = Date.now();

    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }

    // Solo activar timeout si está configurado (mayor que 0)
    if (this.sessionTimeoutDuration > 0) {
      this.sessionTimeout = setTimeout(() => {
        if (AuthManager.isLoggedIn(type)) {
          this.logout(type, 'timeout');
          Utils.showNotification('Sesión expirada por inactividad después de 20 segundos', 'warning');
        }
      }, this.sessionTimeoutDuration);
    }
  }

  resetActivityTimeout() {
    const now = Date.now();
    if (now - this.lastActivity < 1000) return;

    this.lastActivity = now;

    // Solo procesar si el timeout está habilitado
    if (this.sessionTimeoutDuration > 0 && this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);

      let type = null;
      if (AuthManager.isLoggedIn('evaluacion')) type = 'evaluacion';
      else if (AuthManager.isLoggedIn('administracion')) type = 'administracion';
      else if (AuthManager.isLoggedIn('registro')) type = 'registro';
      else if (AuthManager.isLoggedIn('resultados')) type = 'resultados';

      if (type) {
        this.sessionTimeout = setTimeout(() => {
          if (AuthManager.isLoggedIn(type)) {
            this.logout(type, 'timeout');
            Utils.showNotification('Sesión expirada por inactividad después de 20 segundos', 'warning');
          }
        }, this.sessionTimeoutDuration);
      }
    }
  }

  logout(type, reason = 'manual') {
    AuthManager.logout(type);

    // Limpiar credenciales del módulo específico
    this.clearModuleCredentials(type);

    if (type === 'evaluacion') {
      this.checkEvaluacionAccess();
      this.resetEvaluationForm();
    } else if (type === 'administracion') {
      this.checkAdminAccess();
    } else if (type === 'registro') {
      this.checkRegistroAccess();
    } else if (type === 'resultados') {
      this.checkResultadosAccess();
    }

    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }

    if (reason === 'manual') {
      Utils.showNotification('Sesión cerrada', 'info');
    }
  }

  updateEvaluationSelects() {
    const juradoSelect = document.getElementById('juradoSelect');
    const tatuadorSelect = document.getElementById('tatuadorSelect');

    if (juradoSelect) {
      juradoSelect.innerHTML = '<option value="">Selecciona un jurado</option>';
      this.jurados.forEach(jurado => {
        juradoSelect.innerHTML += `<option value="${jurado.id}">${jurado.nombre}</option>`;
      });
    }

    if (tatuadorSelect) {
      tatuadorSelect.innerHTML = '<option value="">Selecciona un tatuador</option>';
      this.tatuadores.forEach(tatuador => {
        tatuadorSelect.innerHTML += `<option value="${tatuador.id}">${tatuador.nombre} (${Utils.formatCategoryName(tatuador.categoria)})</option>`;
      });
    }

    // Agregar información visual sobre restricciones
    this.updateEvaluationRestrictions();
  }

  // Método para mostrar información sobre evaluaciones ya realizadas
  updateEvaluationRestrictions() {
    const restrictionsContainer = document.getElementById('evaluationRestrictions');
    if (!restrictionsContainer) return;

    if (this.evaluaciones.length === 0) {
      restrictionsContainer.innerHTML = '<p class="text-muted">No hay evaluaciones previas registradas.</p>';
      return;
    }

    // Agrupar evaluaciones por jurado
    const evaluacionesPorJurado = {};
    this.evaluaciones.forEach(evaluacion => {
      if (!evaluacionesPorJurado[evaluacion.jurado]) {
        evaluacionesPorJurado[evaluacion.jurado] = [];
      }
      evaluacionesPorJurado[evaluacion.jurado].push({
        tatuador: evaluacion.tatuador,
        categoria: evaluacion.categoria
      });
    });

    let restrictionsHtml = '<div class="restrictions-info"><h5>Evaluaciones Realizadas:</h5>';
    Object.entries(evaluacionesPorJurado).forEach(([jurado, evaluaciones]) => {
      restrictionsHtml += `<div class="jurado-restrictions">
        <strong>${jurado}:</strong>
        <ul class="evaluaciones-list">`;
      evaluaciones.forEach(evaluation => {
        restrictionsHtml += `<li>${evaluation.tatuador} - ${Utils.formatCategoryName(evaluation.categoria)}</li>`;
      });
      restrictionsHtml += '</ul></div>';
    });
    restrictionsHtml += '</div>';

    restrictionsContainer.innerHTML = restrictionsHtml;
  }

  updateEvaluationForm() {
    const juradoId = document.getElementById('juradoSelect').value;
    const tatuadorId = document.getElementById('tatuadorSelect').value;
    const evaluacionForm = document.getElementById('evaluacionForm');

    if (juradoId && tatuadorId) {
      const jurado = this.jurados.find(j => j.id === juradoId);
      const tatuador = this.tatuadores.find(t => t.id === tatuadorId);

      // Verificar restricción de evaluación duplicada
      const evaluacionExistente = this.evaluaciones.find(e => 
        e.juradoId === juradoId && 
        e.tatuadorId === tatuadorId && 
        e.categoria === tatuador.categoria
      );

      if (evaluacionExistente) {
        // Mostrar advertencia y no permitir evaluación
        evaluacionForm.classList.add('hidden');
        Utils.showNotification(`Restricción: El jurado ${jurado.nombre} ya evaluó a ${tatuador.nombre} en ${Utils.formatCategoryName(tatuador.categoria)}. Seleccione una combinación diferente.`, 'warning', 8000);
        return;
      }

      document.getElementById('selectedJuradoName').textContent = jurado.nombre;
      document.getElementById('selectedTatuadorName').textContent = tatuador.nombre;
      document.getElementById('selectedCategoria').textContent = Utils.formatCategoryName(tatuador.categoria);

      const criteriosContainer = document.getElementById('criteriosContainer');
      criteriosContainer.innerHTML = '';

      const criterios = this.criteriosPorCategoria[tatuador.categoria] || [];

      criterios.forEach(criterio => {
        const criterioDiv = document.createElement('div');
        criterioDiv.className = 'criterio-item';

        let scoreButtons = '';
        for (let i = 0; i <= 100; i++) {
          const value = (i * 0.1).toFixed(2);
          scoreButtons += `<button type="button" class="criterio-btn" data-value="${value}" data-criterio="${criterio}">${value}</button>`;
        }

        criterioDiv.innerHTML = `
          <div class="criterio-header">
            <label class="criterio-label">
              <i class="fas fa-star"></i>
              <span>${criterio.toUpperCase()}</span>
            </label>
            <div class="criterio-value" id="value-${criterio}">0.00</div>
          </div>
          <div class="criterio-controls">
            ${scoreButtons}
          </div>
          <input type="hidden" name="${criterio}" class="criterio-input" value="0" required>
        `;
        criteriosContainer.appendChild(criterioDiv);
      });

      document.querySelectorAll('.criterio-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.resetActivityTimeout();
          const criterio = e.target.dataset.criterio;
          const value = e.target.dataset.value;

          document.querySelectorAll(`[data-criterio="${criterio}"]`).forEach(b => {
            b.classList.remove('active');
          });

          e.target.classList.add('active');

          document.querySelector(`input[name="${criterio}"]`).value = value;
          document.getElementById(`value-${criterio}`).textContent = value;

          this.updatePromedioTotal();
        });
      });

      evaluacionForm.classList.remove('hidden');
      this.updatePromedioTotal();
    } else {
      evaluacionForm.classList.add('hidden');
    }
  }

  updatePromedioTotal() {
    const criteriosInputs = document.querySelectorAll('.criterio-input');
    let total = 0;
    let count = 0;

    criteriosInputs.forEach(input => {
      const value = parseFloat(input.value) || 0;
      total += value;
      count++;
    });

    const promedio = count > 0 ? (total / count).toFixed(2) : '0.00';
    const promedioElement = document.getElementById('promedioTotal');
    if (promedioElement) {
      promedioElement.textContent = promedio;
    }
  }

  resetEvaluationForm() {
    document.getElementById('juradoSelect').value = '';
    document.getElementById('tatuadorSelect').value = '';
    document.getElementById('evaluacionForm').classList.add('hidden');
    document.getElementById('criteriosContainer').innerHTML = '';
    document.getElementById('promedioTotal').textContent = '0.00';

    document.querySelectorAll('.criterio-btn.active').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  updateResultadosUI() {
    const tableBody = document.getElementById('resultadosTableBody');
    const categoriaFilter = document.getElementById('categoriaFilter').value;

    const consolidatedScores = this.calculateConsolidatedScores();

    let resultadosFiltrados = consolidatedScores;
    if (categoriaFilter) {
      resultadosFiltrados = consolidatedScores.filter(r => r.categoria === categoriaFilter);
    }

    resultadosFiltrados.sort((a, b) => b.puntuacionConsolidada - a.puntuacionConsolidada);

    if (resultadosFiltrados.length === 0) {
      tableBody.innerHTML = `
        <tr class="no-data">
          <td colspan="7">
            <i class="fas fa-info-circle"></i>
            <span>No hay evaluaciones disponibles</span>
          </td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = resultadosFiltrados.map((resultado, index) => {
        const ranking = index + 1;
        let medalIcon = '';

        if (ranking === 1) medalIcon = '<i class="fas fa-trophy" style="color: #FFD700;"></i>';
        else if (ranking === 2) medalIcon = '<i class="fas fa-medal" style="color: #C0C0C0;"></i>';
        else if (ranking === 3) medalIcon = '<i class="fas fa-medal" style="color: #CD7F32;"></i>';

        // Calcular promedio general por tatuador en la categoría
        const promedioGeneral = (resultado.puntuacionConsolidada / resultado.numeroEvaluaciones).toFixed(2);

        return `
          <tr class="result-row ranking-${ranking}">
            <td class="ranking-cell">
              <div class="ranking-display">
                ${medalIcon}
                <span class="ranking-number">#${ranking}</span>
              </div>
            </td>
            <td class="tattoo-artist-cell">
              <div class="artist-info">
                <span class="artist-name">${resultado.tatuador}</span>
              </div>
            </td>
            <td class="category-cell">
              <span class="category-badge">${Utils.formatCategoryName(resultado.categoria)}</span>
            </td>
            <td class="score-cell">
              <div class="score-display">
                <span class="score-value">${resultado.puntuacionConsolidada.toFixed(2)}</span>
                <div class="score-breakdown">
                  <small>${resultado.numeroEvaluaciones} evaluaciones</small>
                </div>
              </div>
            </td>
            <td class="average-cell">
              <div class="average-display">
                <span class="average-value">${promedioGeneral}</span>
                <div class="average-label">
                  <small>Promedio por evaluación</small>
                </div>
              </div>
            </td>
            <td class="judge-cell">${resultado.jurados.join(', ')}</td>
            <td class="date-cell">${new Date(resultado.fechaUltimaEvaluacion).toLocaleDateString()}</td>
          </tr>
        `;
      }).join('');
    }
  }

  calculateConsolidatedScores() {
    const groupedEvaluations = {};

    this.evaluaciones.forEach(evaluacion => {
      const key = `${evaluacion.tatuadorId}_${evaluacion.categoria}`;

      if (!groupedEvaluations[key]) {
        groupedEvaluations[key] = {
          tatuador: evaluacion.tatuador,
          categoria: evaluacion.categoria,
          evaluaciones: [],
          jurados: new Set()
        };
      }

      groupedEvaluations[key].evaluaciones.push(evaluacion);
      groupedEvaluations[key].jurados.add(evaluacion.jurado);
    });

    const consolidatedResults = [];

    Object.values(groupedEvaluations).forEach(group => {
      let totalScore = 0;
      group.evaluaciones.forEach(evaluacion => {
        totalScore += evaluacion.puntuacionTotal;
      });

      const numeroEvaluaciones = group.evaluaciones.length;
      const fechaMasReciente = group.evaluaciones
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0].fecha;

      consolidatedResults.push({
        tatuador: group.tatuador,
        categoria: group.categoria,
        puntuacionConsolidada: totalScore,
        numeroEvaluaciones: numeroEvaluaciones,
        jurados: Array.from(group.jurados),
        fechaUltimaEvaluacion: fechaMasReciente
      });
    });

    return consolidatedResults;
  }

  calculateCriteriaAverages(tatuador, categoria) {
    const evaluaciones = this.evaluaciones.filter(evaluation => 
      evaluation.tatuador === tatuador && evaluation.categoria === categoria
    );

    const criteriaAverages = {};
    const criteriaNames = ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'];

    criteriaNames.forEach(criterio => {
      const values = evaluaciones.map(evaluation => evaluation.criterios[criterio] || 0);
      if (values.length > 0) {
        const average = values.reduce((sum, val) => sum + val, 0) / values.length;
        criteriaAverages[criterio] = average;
      }
    });

    return criteriaAverages;
  }

  updateAdminUI() {
    this.updateTatuadoresTable();
    this.updateJuradosTable();
    this.updateEvaluacionesTable();
    this.updateAdminStats();
  }

  updateTatuadoresTable() {
    const tbody = document.getElementById('tatuadoresTable');
    if (!tbody) return;

    if (this.tatuadores.length === 0) {
      tbody.innerHTML = '<tr class="no-data"><td colspan="5">No hay tatuadores registrados</td></tr>';
    } else {
      tbody.innerHTML = this.tatuadores.map(tatuador => `
        <tr>
          <td>${tatuador.nombre}</td>
          <td>${tatuador.email}</td>
          <td><span class="category-badge">${Utils.formatCategoryName(tatuador.categoria)}</span></td>
          <td>${tatuador.telefono}</td>
          <td class="actions-cell">
            <button class="btn btn-sm btn-danger" onclick="app.deleteTatuador('${tatuador.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  updateJuradosTable() {
    const tbody = document.getElementById('juradosTable');
    if (!tbody) return;

    if (this.jurados.length === 0) {
      tbody.innerHTML = '<tr class="no-data"><td colspan="5">No hay jurados registrados</td></tr>';
    } else {
      tbody.innerHTML = this.jurados.map(jurado => `
        <tr>
          <td>${jurado.nombre}</td>
          <td>${jurado.email}</td>
          <td>${jurado.experiencia} años</td>
          <td>${jurado.especialidad}</td>
          <td class="actions-cell">
            <button class="btn btn-sm btn-danger" onclick="app.deleteJurado('${jurado.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  updateEvaluacionesTable() {
    const tbody = document.getElementById('evaluacionesTable');
    if (!tbody) return;

    if (this.evaluaciones.length === 0) {
      tbody.innerHTML = '<tr class="no-data"><td colspan="6">No hay evaluaciones realizadas</td></tr>';
    } else {
      tbody.innerHTML = this.evaluaciones.map(evaluacion => {
        const fecha = new Date(evaluacion.fecha).toLocaleDateString('es-ES');
        return `
          <tr>
            <td>${evaluacion.jurado}</td>
            <td>${evaluacion.tatuador}</td>
            <td><span class="category-badge">${Utils.formatCategoryName(evaluacion.categoria)}</span></td>
            <td class="score-cell">
              <span class="score-value">${evaluacion.puntuacionTotal}</span>
            </td>
            <td>${fecha}</td>
            <td class="actions-cell">
              <button class="btn btn-sm btn-danger" onclick="app.deleteEvaluacion('${evaluacion.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  updateAdminStats() {
    const totalTatuadores = document.getElementById('totalTatuadores');
    const totalJurados = document.getElementById('totalJurados');
    const totalEvaluaciones = document.getElementById('totalEvaluaciones');
    const promedioGeneral = document.getElementById('promedioGeneral');

    if (totalTatuadores) totalTatuadores.textContent = this.tatuadores.length;
    if (totalJurados) totalJurados.textContent = this.jurados.length;
    if (totalEvaluaciones) totalEvaluaciones.textContent = this.evaluaciones.length;

    if (promedioGeneral) {
      const promedio = this.evaluaciones.length > 0 
        ? (this.evaluaciones.reduce((sum, ev) => sum + ev.puntuacionTotal, 0) / this.evaluaciones.length).toFixed(2)
        : '0.00';
      promedioGeneral.textContent = promedio;
    }
  }

  updateHomeStats() {
    const homeTatuadores = document.getElementById('homeStatTatuadores');
    const homeJurados = document.getElementById('homeStatJurados');
    const homeEvaluaciones = document.getElementById('homeStatEvaluaciones');

    if (homeTatuadores) {
      Utils.animateNumber(homeTatuadores, 0, this.tatuadores.length);
    }
    if (homeJurados) {
      Utils.animateNumber(homeJurados, 0, this.jurados.length);
    }
    if (homeEvaluaciones) {
      Utils.animateNumber(homeEvaluaciones, 0, this.evaluaciones.length);
    }
  }

  updateAllUI() {
    // Actualizar todas las interfaces tras sincronización
    this.updateHomeStats();
    this.updateAdminUI();
    this.updateEvaluationSelects();
    this.updateResultadosUI();
    this.updateScoreSection();
  }

  updateScoreSection() {
    this.updateScoreMetrics();
    this.updateDetailedScores();
    this.setupScoreFilters();
  }

  updateScoreMetrics() {
    const consolidatedScores = this.calculateConsolidatedScores();

    const avgScoreElement = document.getElementById('avgScore');
    const topScoreElement = document.getElementById('topScore');
    const totalEvaluatedElement = document.getElementById('totalEvaluated');
    const totalCategoriesElement = document.getElementById('totalCategories');

    if (consolidatedScores.length > 0) {
      // Calcular promedio general
      const totalPoints = consolidatedScores.reduce((sum, score) => {
        return sum + (score.puntuacionConsolidada / score.numeroEvaluaciones);
      }, 0);
      const generalAverage = (totalPoints / consolidatedScores.length).toFixed(2);

      // Calcular puntuación máxima
      const maxScore = Math.max(...consolidatedScores.map(score => 
        score.puntuacionConsolidada / score.numeroEvaluaciones
      )).toFixed(2);

      // Contar categorías únicas
      const uniqueCategories = new Set(consolidatedScores.map(s => s.categoria));

      // Actualizar elementos
      if (avgScoreElement) avgScoreElement.textContent = generalAverage;
      if (topScoreElement) topScoreElement.textContent = maxScore;
      if (totalEvaluatedElement) totalEvaluatedElement.textContent = consolidatedScores.length;
      if (totalCategoriesElement) totalCategoriesElement.textContent = uniqueCategories.size;
    } else {
      if (avgScoreElement) avgScoreElement.textContent = '0.0';
      if (topScoreElement) topScoreElement.textContent = '0.0';
      if (totalEvaluatedElement) totalEvaluatedElement.textContent = '0';
      if (totalCategoriesElement) totalCategoriesElement.textContent = '0';
    }
  }

  updateDetailedScores() {
    const tableBody = document.getElementById('scoresTableBody');
    const categoriaFilter = document.getElementById('scoreCategoria')?.value || '';

    const consolidatedScores = this.calculateConsolidatedScores();

    let filteredScores = consolidatedScores;
    if (categoriaFilter) {
      filteredScores = consolidatedScores.filter(s => s.categoria === categoriaFilter);
    }

    // Solo mostrar en orden alfabético para evitar rankings
    filteredScores.sort((a, b) => a.tatuador.localeCompare(b.tatuador));

    if (filteredScores.length === 0) {
      tableBody.innerHTML = `
        <tr class="no-data">
          <td colspan="4">
            <i class="fas fa-info-circle"></i>
            <span>No hay evaluaciones disponibles</span>
          </td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = filteredScores.map((score) => {
        const criteriaAverages = this.calculateCriteriaAverages(score.tatuador, score.categoria);

        return `
          <tr class="score-row">
            <td class="artist-cell">
              <div class="artist-info">
                <span class="artist-name">${score.tatuador}</span>
              </div>
            </td>
            <td class="category-cell">
              <span class="category-badge">${Utils.formatCategoryName(score.categoria)}</span>
            </td>
            <td class="criteria-cell">
              <div class="criteria-averages">
                ${Object.entries(criteriaAverages).map(([criterio, promedio]) => 
                  `<div class="criterio-avg">
                    <span class="criterio-name">${criterio.toUpperCase()}:</span>
                    <span class="criterio-value">${promedio.toFixed(2)}</span>
                  </div>`
                ).join('')}
              </div>
            </td>
            <td class="evaluations-cell">
              <div class="evaluations-info">
                <span class="eval-count">${score.numeroEvaluaciones}</span>
                <div class="eval-judges">
                  <small>${score.jurados.length} jurado(s)</small>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  setupScoreFilters() {
    const categoriaFilter = document.getElementById('scoreCategoria');
    const orderFilter = document.getElementById('scoreOrder');

    if (categoriaFilter) {
      categoriaFilter.addEventListener('change', () => this.updateDetailedScores());
    }

    if (orderFilter) {
      orderFilter.addEventListener('change', () => this.updateDetailedScores());
    }
  }

  showScoreBreakdown(tatuador, categoria) {
    this.pendingScoreAction = { action: 'breakdown', tatuador, categoria };
    this.showScoreAuthModal();
  }

  showScoreDetail(tatuador, categoria) {
    this.pendingScoreAction = { action: 'detail', tatuador, categoria };
    this.showScoreAuthModal();
  }

  showScoreAuthModal() {
    const modal = document.getElementById('scoreAuthModal');
    if (modal) {
      modal.classList.add('active');
      // Limpiar formulario
      const form = document.getElementById('scoreAuthForm');
      if (form) {
        form.reset();
      }
    }
  }

  hideScoreAuthModal() {
    const modal = document.getElementById('scoreAuthModal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.pendingScoreAction = null;
  }

  handleScoreAuth(username, password) {
    if (username === 'admin' && password === 'Colombia2026') {
      this.hideScoreAuthModal();

      if (this.pendingScoreAction) {
        const { action, tatuador, categoria } = this.pendingScoreAction;

        if (action === 'breakdown') {
          this.executeScoreBreakdown(tatuador, categoria);
        } else if (action === 'detail') {
          this.executeScoreDetail(tatuador, categoria);
        }

        this.pendingScoreAction = null;
      }
    } else {
      Utils.showNotification('Credenciales incorrectas', 'error');
    }
  }

  executeScoreBreakdown(tatuador, categoria) {
    const evaluaciones = this.evaluaciones.filter(e => 
      e.tatuador === tatuador && e.categoria === categoria
    );

    if (evaluaciones.length === 0) {
      Utils.showNotification('No hay evaluaciones para mostrar', 'info');
      return;
    }

    // Calculate criteria averages
    const criteriaAverages = {};
    const criteriaNames = ['tecnica', 'creatividad', 'composicion', 'color', 'dificultad'];

    criteriaNames.forEach(criterio => {
      const values = evaluaciones.map(e => e.criterios[criterio] || 0);
      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      criteriaAverages[criterio] = average;
    });

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'scoreBreakdownModal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>
            <i class="fas fa-chart-pie"></i>
            Desglose de Puntuación
          </h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="breakdown-header">
            <h4>${tatuador}</h4>
            <p><strong>Categoría:</strong> ${Utils.formatCategoryName(categoria)}</p>
            <p><strong>Evaluaciones:</strong> ${evaluaciones.length}</p>
          </div>

          <div class="criteria-breakdown">
            <h5>Promedio por Criterio</h5>
            ${criteriaNames.map(criterio => `
              <div class="criterio-breakdown-item">
                <div class="criterio-info">
                  <span class="criterio-name">${criterio.toUpperCase()}</span>
                  <span class="criterio-score">${criteriaAverages[criterio].toFixed(2)}/10</span>
                </div>
                <div class="criterio-bar">
                  <div class="criterio-fill" style="width: ${(criteriaAverages[criterio] / 10) * 100}%"></div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="evaluations-list">
            <h5>Evaluaciones Individuales</h5>
            ${evaluaciones.map(evaluation => `
              <div class="evaluation-item">
                <div class="eval-header">
                  <strong>${evaluation.jurado}</strong>
                  <span class="eval-score">${evaluation.puntuacionTotal}</span>
                </div>
                <div class="eval-date">${new Date(evaluation.fecha).toLocaleDateString()}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  executeScoreDetail(tatuador, categoria) {
    const evaluaciones = this.evaluaciones.filter(e => 
      e.tatuador === tatuador && e.categoria === categoria
    );

    if (evaluaciones.length === 0) {
      Utils.showNotification('No hay evaluaciones para mostrar', 'info');
      return;
    }

    const totalScore = evaluaciones.reduce((sum, e) => sum + e.puntuacionTotal, 0);
    const avgScore = totalScore / evaluaciones.length;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'scoreDetailModal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>
            <i class="fas fa-info-circle"></i>
            Detalle de Puntuación
          </h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="detail-header">
            <h4>${tatuador}</h4>
            <p><strong>Categoría:</strong> ${Utils.formatCategoryName(categoria)}</p>
            <p><strong>Puntuación Promedio:</strong> ${avgScore.toFixed(2)}</p>
            <p><strong>Total de Evaluaciones:</strong> ${evaluaciones.length}</p>
          </div>

          <div class="evaluations-detail">
            <h5>Historial de Evaluaciones</h5>
            <div class="evaluations-timeline">
              ${evaluaciones.map(evaluation => `
                <div class="timeline-item">
                  <div class="timeline-marker"></div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <span class="judge-name">${evaluation.jurado}</span>
                      <span class="eval-score">${evaluation.puntuacionTotal}</span>
                    </div>
                    <div class="timeline-date">${new Date(evaluation.fecha).toLocaleDateString()}</div>
                    <div class="criteria-summary">
                      ${Object.entries(evaluation.criterios).map(([criterio, valor]) => 
                        `<span class="criterio-chip">${criterio}: ${valor}</span>`
                      ).join('')}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  exportScores() {
    const consolidatedScores = this.calculateConsolidatedScores();

    if (consolidatedScores.length === 0) {
      Utils.showNotification('No hay puntuaciones para exportar', 'warning');
      return;
    }

    const csvData = [
      ['Posición', 'Tatuador', 'Categoría', 'Puntuación Total', 'Promedio', 'Evaluaciones', 'Jurados'],
      ...consolidatedScores
        .sort((a, b) => b.puntuacionConsolidada - a.puntuacionConsolidada)
        .map((score, index) => [
          index + 1,
          score.tatuador,
          Utils.formatCategoryName(score.categoria),
          score.puntuacionConsolidada.toFixed(2),
          (score.puntuacionConsolidada / score.numeroEvaluaciones).toFixed(2),
          score.numeroEvaluaciones,
          score.jurados.join(', ')
        ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `tattoo_scores_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Utils.showNotification('Puntuaciones exportadas exitosamente', 'success');
  }

  deleteTatuador(id) {
    if (confirm('¿Estás seguro de eliminar este tatuador?')) {
      this.tatuadores = this.tatuadores.filter(t => t.id !== id);
      this.evaluaciones = this.evaluaciones.filter(e => e.tatuadorId !== id);
      this.saveData();
      this.updateAdminUI();
      this.updateHomeStats();
      this.updateResultadosUI();
      Utils.showNotification('Tatuador eliminado exitosamente', 'success');
    }
  }

  deleteJurado(id) {
    if (confirm('¿Estás seguro de eliminar este jurado?')) {
      this.jurados = this.jurados.filter(j => j.id !== id);
      this.evaluaciones = this.evaluaciones.filter(e => e.juradoId !== id);
      this.saveData();
      this.updateAdminUI();
      this.updateHomeStats();
      this.updateEvaluationSelects();
      this.updateResultadosUI();
      Utils.showNotification('Jurado eliminado exitosamente', 'success');
    }
  }

  deleteEvaluacion(id) {
    if (confirm('¿Estás seguro de eliminar esta evaluación?')) {
      this.evaluaciones = this.evaluaciones.filter(e => e.id !== id);
      this.saveData();
      this.updateAdminUI();
      this.updateHomeStats();
      this.updateResultadosUI();
      Utils.showNotification('Evaluación eliminada exitosamente', 'success');
    }
  }

  exportData() {
    const data = {
      tatuadores: this.tatuadores,
      jurados: this.jurados,
      evaluaciones: this.evaluaciones,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tattoo_rating_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    Utils.showNotification('Datos exportados exitosamente', 'success');
  }

  // Mostrar credenciales de un módulo (solo admin)
  showCredentials(section) {
    if (!AuthManager.isLoggedIn('administracion')) {
      Utils.showNotification('Acceso denegado', 'error');
      return;
    }

    const credentials = AuthManager.getCredentialsForAdmin(section);
    if (!credentials) {
      Utils.showNotification('No se pudieron obtener las credenciales', 'error');
      return;
    }

    const sectionNames = {
      evaluacion: 'Sistema de Evaluación',
      registro: 'Sistema de Registro',
      resultados: 'Sistema de Resultados'
    };

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'credentialsModal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>
            <i class="fas fa-key"></i>
            Credenciales - ${sectionNames[section]}
          </h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="credentials-display">
            <div class="credential-item">
              <label><i class="fas fa-user"></i> Usuario:</label>
              <div class="credential-value">
                <input type="text" value="${credentials.username}" readonly onclick="this.select()">
                <button type="button" class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${credentials.username}'); Utils.showNotification('Usuario copiado', 'success')">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            <div class="credential-item">
              <label><i class="fas fa-lock"></i> Contraseña:</label>
              <div class="credential-value">
                <input type="password" value="${credentials.password}" readonly onclick="this.select(); this.type='text'; setTimeout(() => this.type='password', 3000)">
                <button type="button" class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${credentials.password}'); Utils.showNotification('Contraseña copiada', 'success')">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="credentials-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Importante:</strong> Estas credenciales son confidenciales. Solo compártelas con personal autorizado.
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // Regenerar credenciales de un módulo (solo admin)
  regenerateCredentials(section) {
    if (!AuthManager.isLoggedIn('administracion')) {
      Utils.showNotification('Acceso denegado', 'error');
      return;
    }

    const sectionNames = {
      evaluacion: 'Sistema de Evaluación',
      registro: 'Sistema de Registro',
      resultados: 'Sistema de Resultados'
    };

    if (confirm(`¿Estás seguro de regenerar las credenciales para ${sectionNames[section]}?\n\nEsto invalidará las credenciales actuales y cerrará las sesiones activas.`)) {
      const result = AuthManager.regenerateCredentials(section, AuthManager.getCurrentUser('administracion'));
      
      if (result.success) {
        // Cerrar sesiones activas del módulo
        if (AuthManager.currentUser[section]) {
          AuthManager.logout(section);
        }

        Utils.showNotification(result.message, 'success');

        // Mostrar las nuevas credenciales
        setTimeout(() => {
          this.showCredentials(section);
        }, 500);
      } else {
        Utils.showNotification(result.message, 'error');
      }
    }
  }

  resetSystem() {
    if (confirm('¿Estás seguro de resetear todo el sistema? Esta acción no se puede deshacer.')) {
      this.tatuadores = [];
      this.jurados = [];
      this.evaluaciones = [];
      this.saveData();
      this.updateHomeStats();
      this.updateAdminUI();
      this.updateResultadosUI();
      Utils.showNotification('Sistema reseteado completamente', 'warning');
    }
  }

  async saveData() {
    const data = {
      tatuadores: this.tatuadores,
      jurados: this.jurados,
      evaluaciones: this.evaluaciones,
      version: '1.0',
      lastUpdate: new Date().toISOString()
    };
    
    try {
      // Guardar localmente como respaldo
      localStorage.setItem('tattooRatingData', JSON.stringify(data));
      
      // Sincronizar con servidor global
      const synced = await GlobalSyncManager.syncToServer(data);
      
      if (synced) {
        console.log('✅ Datos guardados y sincronizados globalmente');
      } else {
        console.log('📱 Datos guardados localmente (servidor no disponible)');
      }
    } catch (error) {
      Utils.showNotification('Error al guardar datos', 'error');
      console.error('Error saving data:', error);
    }
  }

  clearAllLoginForms() {
    // Limpiar formularios de login
    const loginForms = [
      'registroLoginForm',
      'evaluacionLoginForm', 
      'resultadosLoginForm',
      'adminLoginForm'
    ];

    loginForms.forEach(formId => {
      const form = document.getElementById(formId);
      if (form) {
        form.reset();
        // Limpiar específicamente los campos de usuario y contraseña
        const usernameField = form.querySelector('input[name="username"]');
        const passwordField = form.querySelector('input[name="password"]');
        if (usernameField) {
          usernameField.value = '';
          usernameField.defaultValue = '';
        }
        if (passwordField) {
          passwordField.value = '';
          passwordField.defaultValue = '';
        }
      }
    });
  }

  // Método específico para limpiar un formulario individual
  clearLoginForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
      form.reset();
      const usernameField = form.querySelector('input[name="username"]');
      const passwordField = form.querySelector('input[name="password"]');
      if (usernameField) {
        usernameField.value = '';
        usernameField.defaultValue = '';
      }
      if (passwordField) {
        passwordField.value = '';
        passwordField.defaultValue = '';
      }
    }
  }

  // Limpiar credenciales de un módulo específico
  clearModuleCredentials(moduleType) {
    const formMappings = {
      'administracion': 'adminLoginForm',
      'evaluacion': 'evaluacionLoginForm',
      'registro': 'registroLoginForm',
      'resultados': 'resultadosLoginForm'
    };
    
    const formId = formMappings[moduleType];
    if (formId) {
      this.clearLoginForm(formId);
    }
  }

  // Manejar cambio de contraseña de administrador
  handleAdminPasswordChange(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');

    const result = AuthManager.changeAdminPassword(newPassword, confirmPassword, AuthManager.getCurrentUser('administracion'));
    
    if (result.success) {
      Utils.showNotification(result.message, 'success');
      e.target.reset();
    } else {
      Utils.showNotification(result.message, 'error');
    }
  }

  async loadData() {
    try {
      // Intentar cargar desde servidor primero
      const serverConnected = await GlobalSyncManager.initialize();
      
      if (serverConnected) {
        // Los datos ya se cargaron desde el servidor en initialize()
        console.log('✅ Datos cargados desde servidor global');
      } else {
        // Fallback a datos locales
        const savedData = localStorage.getItem('tattooRatingData');
        if (savedData) {
          const data = JSON.parse(savedData);
          this.tatuadores = data.tatuadores || [];
          this.jurados = data.jurados || [];
          this.evaluaciones = data.evaluaciones || [];
          console.log('📱 Datos cargados desde almacenamiento local');
        }
      }
    } catch (error) {
      Utils.showNotification('Error al cargar datos', 'warning');
      console.error('Error loading data:', error);
    }
  }
}

// Initialize application
let app;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando World Tattoo Rating Platform');
  console.log('🌐 Configurando sincronización global...');
  
  app = new TattooRatingApp();
  window.app = app; // Exponer globalmente para sincronización

  // Handle initial navigation from URL hash
  const hash = window.location.hash.replace('#', '');
  if (hash && ['home', 'registro', 'evaluacion', 'resultados', 'score', 'administracion'].includes(hash)) {
    app.showSection(hash);
  }

  // Handle hash changes
  window.addEventListener('hashchange', (e) => {
    const newHash = window.location.hash.replace('#', '');
    if (newHash && ['home', 'registro', 'evaluacion', 'resultados', 'score', 'administracion'].includes(newHash)) {
      app.showSection(newHash);
    }
  });

  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (AuthManager.isLoggedIn('administracion')) {
        app.logout('administracion', 'navigation');
      }
      if (AuthManager.isLoggedIn('evaluacion')) {
        app.logout('evaluacion', 'navigation');
      }
    }
  });

  // Setup carousel auto-scroll
  setInterval(() => {
    const carousel1 = document.getElementById('carousel1');
    if (carousel1) {
      carousel1.scrollLeft += 1;
      if (carousel1.scrollLeft >= carousel1.scrollWidth / 2) {
        carousel1.scrollLeft = 0;
      }
    }
  }, 30);
});

// Global error handler
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  Utils.showNotification('Ha ocurrido un error inesperado', 'error');
});

// Expose app globally for debugging
window.tattooApp = app;
