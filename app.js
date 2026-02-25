// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
    apiKey: "AIzaSyDPfvR6WFK29D9zAhfj_qOgi3ZMwQi4rRI",
    authDomain: "absen-efk.firebaseapp.com",
    projectId: "absen-efk",
    storageBucket: "absen-efk.firebasestorage.app",
    messagingSenderId: "63730633504",
    appId: "1:63730633504:web:d1b07245bcd43a0df92545"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ==================== OB TASK CHECKLIST SYSTEM ====================
class OBTaskSystem {
    constructor() {
        this.currentUser = null;
        this.userRole = null;
        this.taskData = [];
        this.employeesData = [];
        this.currentPhoto = null;
        this.cameraStream = null;
        this.isCameraReady = false;
        this.map = null;
        this.mapMarkers = [];
        this.clockInterval = null;
        this.currentCalendarDate = new Date();
        
        // Task definitions per floor
        this.tasksByFloor = {
            'Lantai 1': [
                { id: 'l1_task1', name: 'Sapu lobby dan resepsionis' },
                { id: 'l1_task2', name: 'Pel lantai lobby' },
                { id: 'l1_task3', name: 'Bersihkan meja resepsionis' },
                { id: 'l1_task4', name: 'Buang sampah' },
                { id: 'l1_task5', name: 'Semprot pewangi ruangan' }
            ],
            'Lantai 2': [
                { id: 'l2_task1', name: 'Sapu area kantor utama' },
                { id: 'l2_task2', name: 'Bersihkan meja karyawan' },
                { id: 'l2_task3', name: 'Buang sampah' },
                { id: 'l2_task4', name: 'Bersihkan pantry' },
                { id: 'l2_task5', name: 'Cuci peralatan pantry' },
                { id: 'l2_task6', name: 'Bersihkan toilet' }
            ],
            'Lantai 3': [
                { id: 'l3_task1', name: 'Bersihkan ruang meeting A' },
                { id: 'l3_task2', name: 'Bersihkan ruang meeting B' },
                { id: 'l3_task3', name: 'Rapikan kursi meeting' },
                { id: 'l3_task4', name: 'Buang sampah' },
                { id: 'l3_task5', name: 'Bersihkan proyektor/LCD' }
            ],
            'Lantai 4': [
                { id: 'l4_task1', name: 'Bersihkan ruang direktur' },
                { id: 'l4_task2', name: 'Bersihkan ruang wakil direktur' },
                { id: 'l4_task3', name: 'Bersihkan ruang rapat direksi' },
                { id: 'l4_task4', name: 'Buang sampah' },
                { id: 'l4_task5', name: 'Sapu dan pel lantai' }
            ]
        };
        
        // Current session data
        this.currentSession = {
            floor: null,
            tasks: [],
            completedTasks: [],
            taskPhotos: {},
            startTime: null,
            status: 'idle' // idle, active, completed
        };
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            this.initialize();
        });
    }

    // ==================== INITIALIZATION ====================
    async initialize() {
        console.log('🚀 Inisialisasi Sistem OB Task...');
        
        setTimeout(() => this.hideLoading(), 1000);
        
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.handleAuthStateChange(user);
            } else {
                this.showLoginPage();
            }
        });

        this.setupEventListeners();
        this.setDefaultFilterDates();
        this.renderCalendar();
    }

    // ==================== AUTHENTICATION - ROLE SYSTEM ====================
    async handleAuthStateChange(user) {
        try {
            this.showLoading();
            
            const role = (user.email === 'admin@genetek.co.id') ? 'admin' : 'karyawan';
            
            console.log(`📧 Email: ${user.email}, Role: ${role}`);
            
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    ...userDoc.data()
                };
                
                if (this.currentUser.role !== role) {
                    await db.collection('users').doc(user.uid).update({
                        role: role,
                        updatedAt: new Date().toISOString()
                    });
                    this.currentUser.role = role;
                }
            } else {
                const name = user.email.split('@')[0];
                const displayName = name.charAt(0).toUpperCase() + name.slice(1);
                
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    name: displayName,
                    role: role,
                    createdAt: new Date().toISOString(),
                    lastActive: new Date().toISOString(),
                    isActive: true,
                    deviceInfo: navigator.userAgent
                };
                
                await db.collection('users').doc(user.uid).set(this.currentUser);
            }
            
            this.userRole = this.currentUser.role;
            
            if (this.userRole === 'admin') {
                this.showAdminPanel();
                await this.loadAdminData();
                this.showNotification(`👑 Selamat datang Admin!`, 'success');
            } else {
                this.showEmployeePanel();
                this.startEmployeeFeatures();
                this.showNotification(`👤 Selamat datang, ${this.currentUser.name || this.currentUser.email}!`, 'success');
            }
            
            this.updateUserDisplay();
            this.hideLoading();
            
        } catch (error) {
            console.error('Error handling auth state:', error);
            this.showNotification('Gagal memuat data user: ' + error.message, 'error');
            this.hideLoading();
        }
    }

    async login(email, password) {
        try {
            this.showLoading();
            
            if (email === 'admin@genetek.co.id') {
                console.log('🔐 Login sebagai Admin');
            } else {
                console.log('🔐 Login sebagai OB');
            }
            
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            console.log('✅ Login berhasil:', userCredential.user.email);
            
        } catch (error) {
            console.error('Login error:', error);
            
            if (error.code === 'auth/user-not-found') {
                try {
                    this.showNotification('Membuat akun baru...', 'info');
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    console.log('✅ Akun berhasil dibuat:', userCredential.user.email);
                    this.showNotification('Akun berhasil dibuat!', 'success');
                } catch (createError) {
                    console.error('Create account error:', createError);
                    this.showNotification('Gagal membuat akun: ' + createError.message, 'error');
                }
            } else if (error.code === 'auth/wrong-password') {
                this.showNotification('Password salah!', 'error');
            } else if (error.code === 'auth/invalid-email') {
                this.showNotification('Email tidak valid!', 'error');
            } else {
                this.showNotification('Login gagal: ' + error.message, 'error');
            }
            
            this.hideLoading();
        }
    }

    logout() {
        this.stopCamera();
        
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
            this.clockInterval = null;
        }
        
        auth.signOut().then(() => {
            this.currentUser = null;
            this.userRole = null;
            this.currentPhoto = null;
            this.currentSession = {
                floor: null,
                tasks: [],
                completedTasks: [],
                taskPhotos: {},
                startTime: null,
                status: 'idle'
            };
            this.showLoginPage();
            this.showNotification('Berhasil logout', 'success');
        }).catch((error) => {
            console.error('Logout error:', error);
            this.showNotification('Gagal logout', 'error');
        });
    }

    // ==================== EMPLOYEE (OB) FEATURES ====================
    startEmployeeFeatures() {
        this.startRealTimeClock();
        this.setupCamera();
        this.setupFloorSelector();
        this.loadTodaySession();
    }

    startRealTimeClock() {
        this.updateDateTime();
        this.clockInterval = setInterval(() => {
            this.updateDateTime();
        }, 1000);
    }

    updateDateTime() {
        const timeElement = document.getElementById('live-time');
        const dateElement = document.getElementById('live-date');
        
        if (!timeElement || !dateElement) return;
        
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        dateElement.textContent = now.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    setupFloorSelector() {
        const floorSelect = document.getElementById('floor-select');
        if (!floorSelect) return;
        
        floorSelect.addEventListener('change', (e) => {
            const floor = e.target.value;
            if (floor) {
                this.loadTasksForFloor(floor);
            } else {
                document.getElementById('task-checklist-container').innerHTML = 
                    '<p style="color: var(--gray); text-align: center;">Pilih lantai untuk melihat tugas</p>';
            }
        });
    }

    loadTasksForFloor(floor) {
        const container = document.getElementById('task-checklist-container');
        if (!container) return;
        
        const tasks = this.tasksByFloor[floor] || [];
        let html = '<h4 style="margin-bottom: 16px;">📋 Daftar Tugas:</h4>';
        
        tasks.forEach(task => {
            const isCompleted = this.currentSession.completedTasks.includes(task.id);
            const hasPhoto = this.currentSession.taskPhotos[task.id];
            
            html += `
                <div class="task-item ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}">
                    <div class="task-header">
                        <input type="checkbox" 
                               class="task-checkbox" 
                               data-task-id="${task.id}"
                               ${isCompleted ? 'checked' : ''}
                               ${!this.isCameraReady ? 'disabled' : ''}>
                        <span class="task-name">${task.name}</span>
                        <button class="task-camera-btn ${hasPhoto ? 'completed' : ''}" 
                                data-task-id="${task.id}"
                                ${!this.isCameraReady ? 'disabled' : ''}>
                            📸
                        </button>
                    </div>
                    <div id="photo-preview-${task.id}" class="task-photo-preview ${hasPhoto ? 'active' : ''}">
                        <img src="${hasPhoto || ''}" alt="Foto tugas">
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add event listeners
        tasks.forEach(task => {
            const cameraBtn = document.querySelector(`.task-camera-btn[data-task-id="${task.id}"]`);
            if (cameraBtn) {
                cameraBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.capturePhotoForTask(task.id, task.name);
                });
            }
            
            const checkbox = document.querySelector(`.task-checkbox[data-task-id="${task.id}"]`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.toggleTaskCompletion(task.id, e.target.checked);
                });
            }
        });
        
        this.updateStartButton();
        this.updateProgress();
    }

    async capturePhotoForTask(taskId, taskName) {
        if (!this.isCameraReady) {
            this.showNotification('Kamera belum siap', 'error');
            return;
        }

        const video = document.getElementById('video-feed');
        if (!video || video.readyState !== 4) {
            this.showNotification('Video belum siap', 'warning');
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const context = canvas.getContext('2d');
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const photoData = canvas.toDataURL('image/jpeg', 0.9);
            
            // Store photo for this task
            this.currentSession.taskPhotos[taskId] = photoData;
            
            // Show preview
            const previewContainer = document.getElementById(`photo-preview-${taskId}`);
            const previewImg = previewContainer?.querySelector('img');
            if (previewContainer && previewImg) {
                previewImg.src = photoData;
                previewContainer.classList.add('active');
            }
            
            // Update camera button
            const cameraBtn = document.querySelector(`.task-camera-btn[data-task-id="${taskId}"]`);
            if (cameraBtn) {
                cameraBtn.classList.add('completed');
            }
            
            // Show current task info
            const taskInfo = document.getElementById('current-task-info');
            const taskNameEl = document.getElementById('current-task-name');
            if (taskInfo && taskNameEl) {
                taskInfo.style.display = 'block';
                taskNameEl.textContent = taskName;
            }
            
            this.showNotification(`✅ Foto untuk "${taskName}" berhasil!`, 'success');
            
        } catch (error) {
            console.error('Capture error:', error);
            this.showNotification('Gagal mengambil foto', 'error');
        }
    }

    toggleTaskCompletion(taskId, completed) {
        if (completed) {
            // Check if photo exists
            if (!this.currentSession.taskPhotos[taskId]) {
                this.showNotification('📸 Ambil foto terlebih dahulu!', 'warning');
                // Revert checkbox
                const checkbox = document.querySelector(`.task-checkbox[data-task-id="${taskId}"]`);
                if (checkbox) checkbox.checked = false;
                return;
            }
            
            if (!this.currentSession.completedTasks.includes(taskId)) {
                this.currentSession.completedTasks.push(taskId);
            }
        } else {
            const index = this.currentSession.completedTasks.indexOf(taskId);
            if (index > -1) {
                this.currentSession.completedTasks.splice(index, 1);
            }
        }
        
        // Update task item style
        const taskItem = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (taskItem) {
            if (completed) {
                taskItem.classList.add('completed');
            } else {
                taskItem.classList.remove('completed');
            }
        }
        
        this.updateProgress();
        this.updateStartButton();
    }

    updateProgress() {
        const tasks = this.tasksByFloor[this.currentSession.floor] || [];
        const completed = this.currentSession.completedTasks.length;
        const total = tasks.length;
        
        const progressEl = document.getElementById('task-progress');
        if (progressEl) {
            progressEl.textContent = `${completed}/${total}`;
        }
        
        // Update status text
        const statusText = document.querySelector('.status-text');
        if (statusText) {
            if (this.currentSession.status === 'active') {
                statusText.textContent = 'Sedang mengerjakan tugas';
            } else if (this.currentSession.status === 'completed') {
                statusText.textContent = 'Tugas selesai';
            } else {
                statusText.textContent = 'Belum memulai tugas';
            }
        }
        
        // Update status indicator
        const statusContainer = document.getElementById('employee-status');
        if (statusContainer) {
            if (this.currentSession.status === 'active') {
                statusContainer.classList.add('active');
            } else {
                statusContainer.classList.remove('active');
            }
        }
    }

    updateStartButton() {
        const startBtn = document.getElementById('employee-start');
        if (!startBtn) return;
        
        const floor = document.getElementById('floor-select')?.value;
        const tasks = this.tasksByFloor[floor] || [];
        const completed = this.currentSession.completedTasks.length;
        const total = tasks.length;
        
        if (this.currentSession.status === 'idle' && floor) {
            startBtn.disabled = false;
            startBtn.textContent = '🚀 Mulai Tugas';
        } else if (this.currentSession.status === 'active') {
            if (completed === total && total > 0) {
                startBtn.disabled = false;
                startBtn.textContent = '✅ Selesaikan Tugas';
            } else {
                startBtn.disabled = true;
                startBtn.textContent = `⏳ Progress: ${completed}/${total}`;
            }
        } else if (this.currentSession.status === 'completed') {
            startBtn.disabled = true;
            startBtn.textContent = '✨ Tugas Selesai';
        }
    }

    async startTaskSession() {
        const floor = document.getElementById('floor-select')?.value;
        
        if (!floor) {
            this.showNotification('Pilih lantai terlebih dahulu!', 'warning');
            return;
        }
        
        if (this.currentSession.status === 'idle') {
            // Start new session
            this.currentSession = {
                floor: floor,
                tasks: this.tasksByFloor[floor] || [],
                completedTasks: [],
                taskPhotos: {},
                startTime: new Date().toISOString(),
                status: 'active'
            };
            
            this.loadTasksForFloor(floor);
            this.showNotification('✅ Tugas dimulai!', 'success');
            
        } else if (this.currentSession.status === 'active') {
            // Complete session
            const total = this.currentSession.tasks.length;
            const completed = this.currentSession.completedTasks.length;
            
            if (completed !== total) {
                this.showNotification(`Selesaikan semua tugas terlebih dahulu! (${completed}/${total})`, 'warning');
                return;
            }
            
            await this.completeTaskSession();
        }
        
        this.updateProgress();
        this.updateStartButton();
    }

    async completeTaskSession() {
        try {
            this.showLoading();
            
            if (!this.currentUser) {
                this.showNotification('User tidak ditemukan', 'error');
                return;
            }
            
            // Validate all tasks have photos
            for (const taskId of this.currentSession.completedTasks) {
                if (!this.currentSession.taskPhotos[taskId]) {
                    this.showNotification(`Foto untuk task ${taskId} tidak ditemukan`, 'error');
                    this.hideLoading();
                    return;
                }
            }
            
            // Create task record
            const taskRecord = {
                userId: this.currentUser.uid,
                userName: this.currentUser.name || this.currentUser.email.split('@')[0],
                userEmail: this.currentUser.email,
                floor: this.currentSession.floor,
                tasks: this.currentSession.tasks,
                completedTasks: this.currentSession.completedTasks,
                taskPhotos: this.currentSession.taskPhotos,
                startTime: this.currentSession.startTime,
                endTime: new Date().toISOString(),
                date: new Date().toISOString().split('T')[0],
                status: 'completed',
                progress: `${this.currentSession.completedTasks.length}/${this.currentSession.tasks.length}`,
                createdAt: new Date().toISOString()
            };
            
            await db.collection('ob_tasks').add(taskRecord);
            
            // Update last active
            await db.collection('users').doc(this.currentUser.uid).update({
                lastActive: new Date().toISOString(),
                lastTask: taskRecord
            });
            
            this.currentSession.status = 'completed';
            
            this.showNotification('✅ Tugas selesai! Terima kasih!', 'success');
            
            // Reset after 3 seconds
            setTimeout(() => {
                this.currentSession = {
                    floor: null,
                    tasks: [],
                    completedTasks: [],
                    taskPhotos: {},
                    startTime: null,
                    status: 'idle'
                };
                
                const floorSelect = document.getElementById('floor-select');
                if (floorSelect) floorSelect.value = '';
                
                document.getElementById('task-checklist-container').innerHTML = 
                    '<p style="color: var(--gray); text-align: center;">Pilih lantai untuk melihat tugas</p>';
                
                document.getElementById('current-task-info').style.display = 'none';
                
                this.updateProgress();
                this.updateStartButton();
            }, 3000);
            
        } catch (error) {
            console.error('Error completing task:', error);
            this.showNotification('❌ Gagal menyelesaikan tugas: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadTodaySession() {
        if (!this.currentUser) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        try {
            const snapshot = await db.collection('ob_tasks')
                .where('userId', '==', this.currentUser.uid)
                .where('createdAt', '>=', today.toISOString())
                .where('createdAt', '<', tomorrow.toISOString())
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                const todaySession = snapshot.docs[0].data();
                
                if (todaySession.status === 'completed') {
                    this.currentSession.status = 'completed';
                    
                    const statusContainer = document.getElementById('employee-status');
                    const statusText = statusContainer?.querySelector('.status-text');
                    if (statusText) {
                        statusText.textContent = '✅ Tugas sudah selesai hari ini';
                    }
                    
                    const startBtn = document.getElementById('employee-start');
                    if (startBtn) {
                        startBtn.disabled = true;
                        startBtn.textContent = '✨ Tugas Selesai';
                    }
                }
            }
            
        } catch (error) {
            console.error('Error loading today session:', error);
        }
    }

    async setupCamera() {
        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
            
            const videoElement = document.getElementById('video-feed');
            if (videoElement) {
                videoElement.srcObject = this.cameraStream;
                this.isCameraReady = true;
            }
        } catch (error) {
            console.error('Camera error:', error);
            this.showNotification('❌ Tidak dapat mengakses kamera', 'error');
        }
    }

    // ==================== ADMIN FEATURES ====================
    async loadAdminData() {
        try {
            this.showLoading();
            
            // Load all employees (OB)
            const usersSnapshot = await db.collection('users').get();
            this.employeesData = [];
            
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                if (userData.role !== 'admin') {
                    this.employeesData.push({ 
                        id: doc.id, 
                        ...userData 
                    });
                }
            });
            
            // Load task data (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const taskSnapshot = await db.collection('ob_tasks')
                .where('createdAt', '>=', thirtyDaysAgo.toISOString())
                .orderBy('createdAt', 'desc')
                .get();
            
            this.taskData = [];
            taskSnapshot.forEach(doc => {
                this.taskData.push({ 
                    id: doc.id, 
                    ...doc.data() 
                });
            });
            
            // Update UI
            this.updateStatistics();
            this.populateEmployeeFilter();
            this.renderTaskTable();
            this.initMap();
            this.addMarkersToMap();
            
        } catch (error) {
            console.error('Error loading admin data:', error);
            this.showNotification('❌ Gagal memuat data admin: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateStatistics() {
        const totalKaryawanEl = document.getElementById('total-karyawan');
        if (totalKaryawanEl) totalKaryawanEl.textContent = this.employeesData.length;
        
        const totalTugasEl = document.getElementById('total-tugas');
        if (totalTugasEl) totalTugasEl.textContent = this.taskData.length;
        
        // Tugas hari ini
        const today = new Date().toDateString();
        const todayTasks = this.taskData.filter(record => {
            const recordDate = new Date(record.createdAt).toDateString();
            return recordDate === today;
        }).length;
        
        const hariIniTugasEl = document.getElementById('hari-ini-tugas');
        if (hariIniTugasEl) hariIniTugasEl.textContent = todayTasks;
        
        // OB aktif hari ini
        const activeOB = new Set();
        this.taskData.forEach(record => {
            const recordDate = new Date(record.createdAt).toDateString();
            if (recordDate === today) {
                activeOB.add(record.userId);
            }
        });
        
        const aktifHariIniEl = document.getElementById('aktif-hari-ini');
        if (aktifHariIniEl) aktifHariIniEl.textContent = activeOB.size;
    }

    populateEmployeeFilter() {
        const select = document.getElementById('filter-employee');
        if (!select) return;
        
        select.innerHTML = '<option value="all">📋 Semua OB</option>';
        
        this.employeesData.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
        
        this.employeesData.forEach(emp => {
            select.innerHTML += `<option value="${emp.id}">${emp.name || emp.email}</option>`;
        });
    }

    async renderTaskTable() {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;
        
        let filteredData = [...this.taskData];
        
        // Apply filters
        let startDate = document.getElementById('filter-start-date')?.value;
        let endDate = document.getElementById('filter-end-date')?.value;
        const employeeId = document.getElementById('filter-employee')?.value;
        const floor = document.getElementById('filter-floor')?.value;
        
        if (!startDate && !endDate) {
            const selectedDate = this.currentCalendarDate;
            startDate = selectedDate.toISOString().split('T')[0];
            endDate = startDate;
            
            const startDateEl = document.getElementById('filter-start-date');
            const endDateEl = document.getElementById('filter-end-date');
            if (startDateEl) startDateEl.value = startDate;
            if (endDateEl) endDateEl.value = endDate;
        }
        
        if (startDate) {
            filteredData = filteredData.filter(record => 
                record.createdAt && record.createdAt.split('T')[0] >= startDate
            );
        }
        
        if (endDate) {
            filteredData = filteredData.filter(record => 
                record.createdAt && record.createdAt.split('T')[0] <= endDate
            );
        }
        
        if (employeeId && employeeId !== 'all') {
            filteredData = filteredData.filter(record => record.userId === employeeId);
        }
        
        if (floor && floor !== 'all') {
            filteredData = filteredData.filter(record => record.floor === floor);
        }
        
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 50px; color: var(--gray);">📭 Tidak ada data tugas</td></tr>';
            return;
        }
        
        let html = '';
        filteredData.slice(0, 100).forEach(record => {
            const date = new Date(record.createdAt);
            const timeStr = date.toLocaleString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Create tasks list
            let tasksList = '';
            if (record.completedTasks && record.tasks) {
                const completedTasks = record.completedTasks;
                const allTasks = record.tasks;
                
                allTasks.forEach(task => {
                    const isCompleted = completedTasks.includes(task.id);
                    tasksList += `
                        <div class="task-item-detail">
                            ${isCompleted ? '✅' : '⭕'} ${task.name}
                        </div>
                    `;
                });
            }
            
            // Create photo thumbnails
            let photoHtml = '';
            if (record.taskPhotos) {
                const firstPhoto = Object.values(record.taskPhotos)[0];
                if (firstPhoto) {
                    photoHtml = `<img src="${firstPhoto}" class="photo-thumb" onclick="window.attendanceSystem.showPhotoBase64('${firstPhoto}')" alt="Foto">`;
                } else {
                    photoHtml = '<span style="color: var(--gray);">📷 Tidak ada</span>';
                }
            } else {
                photoHtml = '<span style="color: var(--gray);">📷 Tidak ada</span>';
            }
            
            const progress = record.progress || '0/0';
            const [completed, total] = progress.split('/').map(Number);
            const progressPercent = total > 0 ? (completed / total) * 100 : 0;
            
            html += `
                <tr>
                    <td>${timeStr}</td>
                    <td><strong>${record.userName || 'Unknown'}</strong></td>
                    <td>${record.userEmail || '-'}</td>
                    <td><span class="badge badge-floor">${record.floor || '-'}</span></td>
                    <td class="task-detail">
                        ${tasksList}
                    </td>
                    <td>
                        <div>${progress}</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                    </td>
                    <td>
                        ${photoHtml}
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }

    // ==================== CALENDAR FEATURE ====================
    renderCalendar() {
        const calendarContainer = document.getElementById('attendance-calendar');
        if (!calendarContainer) {
            this.createCalendarContainer();
        }
        
        this.updateCalendar();
    }
    
    createCalendarContainer() {
        const adminContainer = document.getElementById('admin-container');
        if (!adminContainer) return;
        
        const statsGrid = document.querySelector('.stats-grid');
        if (!statsGrid) return;
        
        const calendarSection = document.createElement('div');
        calendarSection.className = 'calendar-section';
        calendarSection.innerHTML = `
            <div class="card" style="margin-bottom: 24px;">
                <div class="card-title">
                    <span>📅</span> Kalender Tugas
                </div>
                <div id="attendance-calendar" class="calendar-container"></div>
                <div id="calendar-legend" class="calendar-legend">
                    <span><span class="legend-dot" style="background: #06d6a0;"></span> Ada tugas</span>
                    <span><span class="legend-dot" style="background: #ef476f;"></span> Tidak ada tugas</span>
                    <span><span class="legend-dot" style="background: #4361ee;"></span> Hari ini</span>
                </div>
            </div>
        `;
        
        statsGrid.parentNode.insertBefore(calendarSection, statsGrid.nextSibling);
        
        this.addCalendarStyles();
        this.updateCalendar();
    }
    
    addCalendarStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .calendar-container {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 8px;
                padding: 16px 0;
            }
            
            .calendar-header {
                text-align: center;
                font-weight: 600;
                color: var(--dark);
                padding: 8px;
                font-size: 0.85rem;
            }
            
            .calendar-day {
                aspect-ratio: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: #f8fafc;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
                padding: 8px;
            }
            
            .calendar-day:hover {
                background: #e2e8f0;
                transform: scale(1.05);
            }
            
            .calendar-day.selected {
                background: var(--primary);
                color: white;
                font-weight: 600;
                box-shadow: 0 4px 10px rgba(67, 97, 238, 0.3);
            }
            
            .calendar-day.today {
                border: 2px solid var(--primary);
            }
            
            .calendar-day.has-attendance {
                background: #d1fae5;
            }
            
            .calendar-day.has-attendance.selected {
                background: var(--primary);
                color: white;
            }
            
            .day-number {
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .attendance-count {
                font-size: 0.7rem;
                background: var(--primary);
                color: white;
                padding: 2px 6px;
                border-radius: 20px;
                margin-top: 4px;
            }
            
            .calendar-day.selected .attendance-count {
                background: white;
                color: var(--primary);
            }
            
            .calendar-legend {
                display: flex;
                gap: 24px;
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid #e2e8f0;
                flex-wrap: wrap;
            }
            
            .legend-dot {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 6px;
            }
            
            .calendar-month {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            
            .calendar-month h3 {
                color: var(--dark);
                font-size: 1.2rem;
            }
            
            .calendar-nav {
                display: flex;
                gap: 12px;
            }
            
            .calendar-nav-btn {
                background: #f1f5f9;
                border: none;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 1.2rem;
                transition: all 0.2s;
            }
            
            .calendar-nav-btn:hover {
                background: var(--primary);
                color: white;
            }
        `;
        document.head.appendChild(style);
    }
    
    updateCalendar() {
        const calendarEl = document.getElementById('attendance-calendar');
        if (!calendarEl) return;
        
        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const startDay = firstDay.getDay(); // 0 = Minggu
        const totalDays = lastDay.getDate();
        
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        
        let html = `
            <div class="calendar-month">
                <h3>${this.currentCalendarDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h3>
                <div class="calendar-nav">
                    <button class="calendar-nav-btn" onclick="window.attendanceSystem.prevMonth()">◀</button>
                    <button class="calendar-nav-btn" onclick="window.attendanceSystem.nextMonth()">▶</button>
                </div>
            </div>
            <div class="calendar-container">
        `;
        
        days.forEach(day => {
            html += `<div class="calendar-header">${day}</div>`;
        });
        
        for (let i = 0; i < startDay; i++) {
            html += `<div class="calendar-day" style="background: transparent; cursor: default;"></div>`;
        }
        
        const today = new Date();
        const todayStr = today.toDateString();
        
        const tasksByDate = {};
        this.taskData.forEach(record => {
            const date = record.createdAt.split('T')[0];
            if (!tasksByDate[date]) {
                tasksByDate[date] = 0;
            }
            tasksByDate[date]++;
        });
        
        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(year, month, d);
            const dateStr = date.toISOString().split('T')[0];
            const isToday = date.toDateString() === todayStr;
            const isSelected = this.currentCalendarDate.toDateString() === date.toDateString();
            const hasTasks = tasksByDate[dateStr] > 0;
            const taskCount = tasksByDate[dateStr] || 0;
            
            let classes = 'calendar-day';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';
            if (hasTasks) classes += ' has-attendance';
            
            html += `
                <div class="${classes}" onclick="window.attendanceSystem.selectDate('${dateStr}')">
                    <span class="day-number">${d}</span>
                    ${taskCount > 0 ? `<span class="attendance-count">${taskCount}</span>` : ''}
                </div>
            `;
        }
        
        html += '</div>';
        calendarEl.innerHTML = html;
    }
    
    selectDate(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        this.currentCalendarDate = new Date(year, month - 1, day);
        
        const startDateEl = document.getElementById('filter-start-date');
        const endDateEl = document.getElementById('filter-end-date');
        
        if (startDateEl) startDateEl.value = dateStr;
        if (endDateEl) endDateEl.value = dateStr;
        
        this.updateCalendar();
        this.renderTaskTable();
        
        this.showNotification(`📅 Menampilkan data tanggal ${dateStr}`, 'info');
    }
    
    prevMonth() {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
        this.updateCalendar();
        
        const startDateEl = document.getElementById('filter-start-date');
        const endDateEl = document.getElementById('filter-end-date');
        
        if (startDateEl) startDateEl.value = '';
        if (endDateEl) endDateEl.value = '';
        
        this.renderTaskTable();
    }
    
    nextMonth() {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
        this.updateCalendar();
        
        const startDateEl = document.getElementById('filter-start-date');
        const endDateEl = document.getElementById('filter-end-date');
        
        if (startDateEl) startDateEl.value = '';
        if (endDateEl) endDateEl.value = '';
        
        this.renderTaskTable();
    }

    initMap() {
        const mapContainer = document.getElementById('attendance-map');
        if (!mapContainer) return;
        
        if (this.map) {
            this.map.remove();
        }
        
        this.map = L.map('attendance-map').setView([-6.2088, 106.8456], 11);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        // Add markers for each floor (simulated locations)
        const floorLocations = [
            { floor: 'Lantai 1', lat: -6.2088, lng: 106.8456, name: 'Lobby & Resepsionis' },
            { floor: 'Lantai 2', lat: -6.2090, lng: 106.8458, name: 'Kantor Utama' },
            { floor: 'Lantai 3', lat: -6.2092, lng: 106.8460, name: 'Ruang Meeting' },
            { floor: 'Lantai 4', lat: -6.2094, lng: 106.8462, name: 'Kantor Direksi' }
        ];
        
        floorLocations.forEach(loc => {
            const marker = L.marker([loc.lat, loc.lng])
                .addTo(this.map)
                .bindPopup(`<b>${loc.floor}</b><br>${loc.name}`);
            
            this.mapMarkers.push(marker);
        });
    }

    addMarkersToMap() {
        // Map already initialized with floor markers
    }

    setDefaultFilterDates() {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const startDateEl = document.getElementById('filter-start-date');
        const endDateEl = document.getElementById('filter-end-date');
        
        if (startDateEl) {
            startDateEl.value = thirtyDaysAgo.toISOString().split('T')[0];
        }
        
        if (endDateEl) {
            endDateEl.value = today.toISOString().split('T')[0];
        }
    }

    async exportToExcel() {
        try {
            this.showNotification('📊 Menyiapkan data...', 'info');
            
            let csv = 'Tanggal,OB,Email,Lantai,Tugas,Progress,Status\n';
            
            this.taskData.forEach(record => {
                const date = new Date(record.createdAt).toLocaleString('id-ID');
                
                // Create tasks summary
                let tasksSummary = '';
                if (record.completedTasks && record.tasks) {
                    const completedCount = record.completedTasks.length;
                    const totalCount = record.tasks.length;
                    tasksSummary = `${completedCount}/${totalCount} tugas`;
                }
                
                const line = [
                    `"${date}"`,
                    `"${record.userName || ''}"`,
                    `"${record.userEmail || ''}"`,
                    `"${record.floor || ''}"`,
                    `"${tasksSummary}"`,
                    record.progress || '0/0',
                    record.status || 'completed'
                ].join(',');
                
                csv += line + '\n';
            });
            
            const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tugas_ob_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            this.showNotification('✅ Export berhasil!', 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('❌ Gagal export data', 'error');
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    showPhotoBase64(photoBase64) {
        const modal = document.getElementById('photo-modal');
        const modalImg = document.getElementById('modal-photo-img');
        
        if (photoBase64 && modal && modalImg) {
            modalImg.src = photoBase64;
            modal.classList.add('active');
        } else {
            this.showNotification('Foto tidak ditemukan', 'warning');
        }
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => {
                track.stop();
            });
            this.cameraStream = null;
            this.isCameraReady = false;
        }
    }

    // ==================== UI CONTROLLERS ====================
    showLoginPage() {
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('app-container').classList.remove('active');
        document.getElementById('admin-container').classList.remove('active');
        
        const emailInput = document.getElementById('login-email');
        if (emailInput) emailInput.value = 'admin@genetek.co.id';
    }

    showEmployeePanel() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app-container').classList.add('active');
        document.getElementById('admin-container').classList.remove('active');
    }

    showAdminPanel() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app-container').classList.remove('active');
        document.getElementById('admin-container').classList.add('active');
        
        setTimeout(() => this.renderCalendar(), 100);
    }

    updateUserDisplay() {
        const userDisplay = document.getElementById('user-display');
        const adminDisplay = document.getElementById('admin-display');
        
        if (userDisplay && this.currentUser) {
            userDisplay.textContent = `👤 ${this.currentUser.name || this.currentUser.email.split('@')[0]}`;
        }
        
        if (adminDisplay && this.currentUser) {
            adminDisplay.textContent = `👑 ${this.currentUser.name || 'Admin'}`;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const icon = document.getElementById('notification-icon');
        const messageEl = document.getElementById('notification-message');
        
        if (!notification || !messageEl) return;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        icon.textContent = icons[type] || 'ℹ️';
        notification.className = `notification ${type}`;
        messageEl.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    showLoading() {
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.classList.add('hidden');
        }
    }

    // ==================== EVENT LISTENERS ====================
    setupEventListeners() {
        // Login button
        const loginBtn = document.getElementById('btn-login');
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;
                
                if (!email || !password) {
                    this.showNotification('Email dan password harus diisi!', 'warning');
                    return;
                }
                
                if (password.length < 6) {
                    this.showNotification('Password minimal 6 karakter!', 'warning');
                    return;
                }
                
                this.login(email, password);
            });
        }

        // Logout buttons
        const logoutBtn = document.getElementById('btn-logout');
        const adminLogoutBtn = document.getElementById('admin-logout');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        
        if (adminLogoutBtn) {
            adminLogoutBtn.addEventListener('click', () => this.logout());
        }

        // Employee buttons
        const startBtn = document.getElementById('employee-start');
        const captureBtn = document.getElementById('btn-capture');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startTaskSession());
        }
        
        if (captureBtn) {
            captureBtn.addEventListener('click', () => {
                // Generic capture - will be used by task-specific buttons
                this.showNotification('Pilih tugas yang ingin difoto!', 'info');
            });
        }

        // Admin buttons
        const applyFilterBtn = document.getElementById('btn-apply-filter');
        const exportBtn = document.getElementById('btn-export-excel');
        
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', () => {
                this.renderTaskTable();
                this.addMarkersToMap();
            });
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToExcel());
        }

        // Enter key for login
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !document.getElementById('login-page').classList.contains('hidden')) {
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;
                this.login(email, password);
            }
        });

        // Cleanup
        window.addEventListener('beforeunload', () => {
            this.stopCamera();
            if (this.clockInterval) {
                clearInterval(this.clockInterval);
            }
        });
    }
}

// ==================== GLOBAL ACCESS ====================
window.attendanceSystem = new OBTaskSystem();

window.showPhotoBase64 = function(photoBase64) {
    if (window.attendanceSystem) {
        window.attendanceSystem.showPhotoBase64(photoBase64);
    }
};

window.selectDate = function(dateStr) {
    if (window.attendanceSystem) {
        window.attendanceSystem.selectDate(dateStr);
    }
};

window.prevMonth = function() {
    if (window.attendanceSystem) {
        window.attendanceSystem.prevMonth();
    }
};

window.nextMonth = function() {
    if (window.attendanceSystem) {
        window.attendanceSystem.nextMonth();
    }
};
