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

// ==================== ENTERPRISE ATTENDANCE SYSTEM ====================
class EnterpriseAttendanceSystem {
    constructor() {
        this.currentUser = null;
        this.userRole = null;
        this.attendanceData = [];
        this.employeesData = [];
        this.currentPhoto = null;
        this.locationData = {
            lat: null,
            lng: null,
            address: 'Mendapatkan lokasi...'
        };
        this.cameraStream = null;
        this.isCameraReady = false;
        this.map = null;
        this.mapMarkers = [];
        this.clockInterval = null;
        this.currentCalendarDate = new Date(); // Untuk tracking tanggal di calendar
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            this.initialize();
        });
    }

    // ==================== INITIALIZATION ====================
    async initialize() {
        console.log('🚀 Inisialisasi Sistem Absensi...');
        
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
        
        // Render calendar
        this.renderCalendar();
    }

    // ==================== AUTHENTICATION - ROLE SYSTEM ====================
    async handleAuthStateChange(user) {
        try {
            this.showLoading();
            
            // Tentukan role berdasarkan email
            // HANYA admin@genetek.co.id yang jadi ADMIN
            const role = (user.email === 'admin@genetek.co.id') ? 'admin' : 'karyawan';
            
            console.log(`📧 Email: ${user.email}, Role: ${role}`);
            
            // Get atau create user di Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    ...userDoc.data()
                };
                
                // PASTIKAN role sesuai email (update jika diperlukan)
                if (this.currentUser.role !== role) {
                    await db.collection('users').doc(user.uid).update({
                        role: role,
                        updatedAt: new Date().toISOString()
                    });
                    this.currentUser.role = role;
                }
            } else {
                // Create new user profile
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
            
            // Update UI based on role
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
            
            // VALIDASI: Admin harus menggunakan email yang benar
            if (email === 'admin@genetek.co.id') {
                console.log('🔐 Login sebagai Admin');
            } else {
                console.log('🔐 Login sebagai Karyawan');
            }
            
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            console.log('✅ Login berhasil:', userCredential.user.email);
            
        } catch (error) {
            console.error('Login error:', error);
            
            if (error.code === 'auth/user-not-found') {
                // Auto register untuk user baru
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
            this.showLoginPage();
            this.showNotification('Berhasil logout', 'success');
        }).catch((error) => {
            console.error('Logout error:', error);
            this.showNotification('Gagal logout', 'error');
        });
    }

    // ==================== EMPLOYEE FEATURES ====================
    startEmployeeFeatures() {
        this.startRealTimeClock();
        this.getUserLocation();
        this.setupCamera();
        this.loadEmployeeTodayStatus();
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

    getUserLocation() {
        if (!navigator.geolocation) {
            this.locationData.address = 'Geolocation tidak didukung';
            this.updateLocationDisplay();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.locationData.lat = position.coords.latitude;
                this.locationData.lng = position.coords.longitude;
                this.updateLocationDisplay();
                this.getAddressFromCoordinates();
            },
            (error) => {
                console.error('Location error:', error);
                this.locationData.address = '❌ Gagal mendapatkan lokasi';
                this.updateLocationDisplay();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    async getAddressFromCoordinates() {
        if (!this.locationData.lat || !this.locationData.lng) return;
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${this.locationData.lat}&lon=${this.locationData.lng}&zoom=18&addressdetails=1`
            );
            const data = await response.json();
            
            if (data.display_name) {
                const addressParts = data.display_name.split(', ');
                this.locationData.address = addressParts.slice(0, 4).join(', ');
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            this.locationData.address = `${this.locationData.lat.toFixed(4)}, ${this.locationData.lng.toFixed(4)}`;
        }
        
        this.updateLocationDisplay();
    }

    updateLocationDisplay() {
        const addressEl = document.getElementById('employee-address');
        const coordsEl = document.getElementById('employee-coords');
        
        if (addressEl) addressEl.textContent = this.locationData.address;
        if (coordsEl && this.locationData.lat && this.locationData.lng) {
            coordsEl.textContent = `${this.locationData.lat.toFixed(6)}, ${this.locationData.lng.toFixed(6)}`;
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

    capturePhoto() {
        if (!this.isCameraReady) {
            this.showNotification('Kamera belum siap', 'error');
            return null;
        }

        const video = document.getElementById('video-feed');
        if (!video || video.readyState !== 4) {
            this.showNotification('Video belum siap', 'warning');
            return null;
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
            this.currentPhoto = photoData;
            
            // Show preview - PREVIEW DITAMPILKAN SEMENTARA
            const photoPreview = document.getElementById('captured-photo');
            const previewContainer = document.getElementById('photo-preview-container');
            
            if (photoPreview && previewContainer) {
                photoPreview.src = photoData;
                previewContainer.classList.add('active');
            }
            
            this.showNotification('✅ Foto berhasil diambil!', 'success');
            return photoData;
            
        } catch (error) {
            console.error('Capture error:', error);
            this.showNotification('Gagal mengambil foto', 'error');
            return null;
        }
    }

    async loadEmployeeTodayStatus() {
        if (!this.currentUser) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        try {
            const snapshot = await db.collection('attendance')
                .where('userId', '==', this.currentUser.uid)
                .where('timestamp', '>=', today.toISOString())
                .where('timestamp', '<', tomorrow.toISOString())
                .orderBy('timestamp', 'desc')
                .get();
            
            const todayRecords = [];
            snapshot.forEach(doc => todayRecords.push({ id: doc.id, ...doc.data() }));
            
            this.updateEmployeeStatus(todayRecords);
            
        } catch (error) {
            console.error('Error loading today status:', error);
        }
    }

    updateEmployeeStatus(records) {
        const statusContainer = document.getElementById('employee-status');
        if (!statusContainer) return;
        
        const statusText = statusContainer.querySelector('.status-text');
        if (!statusText) return;
        
        const hasClockIn = records.some(r => r.type === 'clockin');
        const hasClockOut = records.some(r => r.type === 'clockout');
        
        if (hasClockIn && !hasClockOut) {
            statusContainer.classList.add('active');
            statusText.textContent = '✅ Sedang bekerja';
        } else if (hasClockIn && hasClockOut) {
            statusContainer.classList.remove('active');
            statusText.textContent = '📤 Sudah clock out';
        } else {
            statusContainer.classList.remove('active');
            statusText.textContent = '⏳ Belum clock in';
        }
    }

    async clockIn() {
        if (!this.validateClockAction()) return;
        
        try {
            this.showLoading();
            
            // Check if already clocked in today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const snapshot = await db.collection('attendance')
                .where('userId', '==', this.currentUser.uid)
                .where('type', '==', 'clockin')
                .where('timestamp', '>=', today.toISOString())
                .where('timestamp', '<', tomorrow.toISOString())
                .get();
            
            if (!snapshot.empty) {
                this.showNotification('⚠️ Anda sudah clock in hari ini!', 'warning');
                this.hideLoading();
                return;
            }
            
            // Generate ID untuk foto
            const photoId = `photo_${Date.now()}`;
            
            // Simpan foto ke localStorage (BASE64)
            if (this.currentPhoto) {
                localStorage.setItem(photoId, this.currentPhoto);
            }
            
            // Create attendance record
            const attendanceRecord = {
                userId: this.currentUser.uid,
                userName: this.currentUser.name || this.currentUser.email.split('@')[0],
                userEmail: this.currentUser.email,
                type: 'clockin',
                timestamp: new Date().toISOString(),
                date: new Date().toISOString().split('T')[0],
                location: {
                    lat: this.locationData.lat,
                    lng: this.locationData.lng,
                    address: this.locationData.address
                },
                photoId: photoId,
                photoBase64: this.currentPhoto, // Simpan base64 langsung di record
                deviceInfo: navigator.userAgent,
                createdAt: new Date().toISOString()
            };
            
            await db.collection('attendance').add(attendanceRecord);
            
            // Update last active
            await db.collection('users').doc(this.currentUser.uid).update({
                lastActive: new Date().toISOString(),
                lastLocation: attendanceRecord.location
            });
            
            // HAPUS PREVIEW FOTO SETELAH CLOCK IN BERHASIL
            this.clearPhotoPreview();
            
            this.showNotification('✅ Clock In berhasil!', 'success');
            await this.loadEmployeeTodayStatus();
            
        } catch (error) {
            console.error('Clock in error:', error);
            this.showNotification('❌ Gagal clock in: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async clockOut() {
        if (!this.validateClockAction()) return;
        
        try {
            this.showLoading();
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Check if already clocked in today
            const clockInSnapshot = await db.collection('attendance')
                .where('userId', '==', this.currentUser.uid)
                .where('type', '==', 'clockin')
                .where('timestamp', '>=', today.toISOString())
                .where('timestamp', '<', tomorrow.toISOString())
                .get();
            
            if (clockInSnapshot.empty) {
                this.showNotification('⚠️ Anda belum clock in hari ini!', 'warning');
                this.hideLoading();
                return;
            }
            
            // Check if already clocked out
            const clockOutSnapshot = await db.collection('attendance')
                .where('userId', '==', this.currentUser.uid)
                .where('type', '==', 'clockout')
                .where('timestamp', '>=', today.toISOString())
                .where('timestamp', '<', tomorrow.toISOString())
                .get();
            
            if (!clockOutSnapshot.empty) {
                this.showNotification('⚠️ Anda sudah clock out hari ini!', 'warning');
                this.hideLoading();
                return;
            }
            
            // Generate ID untuk foto
            const photoId = `photo_${Date.now()}`;
            
            // Simpan foto ke localStorage (BASE64)
            if (this.currentPhoto) {
                localStorage.setItem(photoId, this.currentPhoto);
            }
            
            // Create attendance record
            const attendanceRecord = {
                userId: this.currentUser.uid,
                userName: this.currentUser.name || this.currentUser.email.split('@')[0],
                userEmail: this.currentUser.email,
                type: 'clockout',
                timestamp: new Date().toISOString(),
                date: new Date().toISOString().split('T')[0],
                location: {
                    lat: this.locationData.lat,
                    lng: this.locationData.lng,
                    address: this.locationData.address
                },
                photoId: photoId,
                photoBase64: this.currentPhoto, // Simpan base64 langsung di record
                deviceInfo: navigator.userAgent,
                createdAt: new Date().toISOString()
            };
            
            await db.collection('attendance').add(attendanceRecord);
            
            // Update last active
            await db.collection('users').doc(this.currentUser.uid).update({
                lastActive: new Date().toISOString()
            });
            
            // HAPUS PREVIEW FOTO SETELAH CLOCK OUT BERHASIL
            this.clearPhotoPreview();
            
            this.showNotification('✅ Clock Out berhasil!', 'success');
            await this.loadEmployeeTodayStatus();
            
        } catch (error) {
            console.error('Clock out error:', error);
            this.showNotification('❌ Gagal clock out: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // FUNGSI BARU: Membersihkan preview foto
    clearPhotoPreview() {
        this.currentPhoto = null;
        
        const photoPreview = document.getElementById('captured-photo');
        const previewContainer = document.getElementById('photo-preview-container');
        
        if (photoPreview) {
            photoPreview.src = '';
        }
        
        if (previewContainer) {
            previewContainer.classList.remove('active');
        }
        
        // Hapus juga dari localStorage jika ada
        // Tapi tidak perlu karena kita simpan dengan ID spesifik
    }

    validateClockAction() {
        if (!this.locationData.lat || !this.locationData.lng) {
            this.showNotification('📍 Lokasi belum tersedia', 'error');
            return false;
        }
        
        if (!this.currentPhoto) {
            this.showNotification('📸 Ambil foto terlebih dahulu', 'warning');
            return false;
        }
        
        return true;
    }

    // ==================== ADMIN FEATURES ====================
    async loadAdminData() {
        try {
            this.showLoading();
            
            // Load all employees - HANYA KARYAWAN (bukan admin)
            const usersSnapshot = await db.collection('users').get();
            this.employeesData = [];
            
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                // Filter: HANYA karyawan (bukan admin) yang ditampilkan
                if (userData.role !== 'admin') {
                    this.employeesData.push({ 
                        id: doc.id, 
                        ...userData 
                    });
                }
            });
            
            // Load attendance data (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const attendanceSnapshot = await db.collection('attendance')
                .where('timestamp', '>=', thirtyDaysAgo.toISOString())
                .orderBy('timestamp', 'desc')
                .get();
            
            this.attendanceData = [];
            attendanceSnapshot.forEach(doc => {
                this.attendanceData.push({ 
                    id: doc.id, 
                    ...doc.data() 
                });
            });
            
            // Update UI
            this.updateStatistics();
            this.populateEmployeeFilter();
            this.renderAttendanceTable();
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
        
        const totalAbsensiEl = document.getElementById('total-absensi');
        if (totalAbsensiEl) totalAbsensiEl.textContent = this.attendanceData.length;
        
        // Clock in hari ini
        const today = new Date().toDateString();
        const todayClockIn = this.attendanceData.filter(record => {
            const recordDate = new Date(record.timestamp).toDateString();
            return recordDate === today && record.type === 'clockin';
        }).length;
        
        const hariIniClockinEl = document.getElementById('hari-ini-clockin');
        if (hariIniClockinEl) hariIniClockinEl.textContent = todayClockIn;
        
        // Karyawan aktif hari ini
        const activeEmployees = new Set();
        this.attendanceData.forEach(record => {
            const recordDate = new Date(record.timestamp).toDateString();
            if (recordDate === today) {
                activeEmployees.add(record.userId);
            }
        });
        
        const aktifHariIniEl = document.getElementById('aktif-hari-ini');
        if (aktifHariIniEl) aktifHariIniEl.textContent = activeEmployees.size;
    }

    populateEmployeeFilter() {
        const select = document.getElementById('filter-employee');
        if (!select) return;
        
        select.innerHTML = '<option value="all">📋 Semua Karyawan</option>';
        
        this.employeesData.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
        
        this.employeesData.forEach(emp => {
            select.innerHTML += `<option value="${emp.id}">${emp.name || emp.email}</option>`;
        });
    }

    async renderAttendanceTable() {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;
        
        let filteredData = [...this.attendanceData];
        
        // Apply filters
        let startDate = document.getElementById('filter-start-date')?.value;
        let endDate = document.getElementById('filter-end-date')?.value;
        const employeeId = document.getElementById('filter-employee')?.value;
        const type = document.getElementById('filter-type')?.value;
        
        // Jika tidak ada filter tanggal, gunakan tanggal yang dipilih di calendar
        if (!startDate && !endDate) {
            const selectedDate = this.currentCalendarDate;
            startDate = selectedDate.toISOString().split('T')[0];
            endDate = startDate;
            
            // Update input filter
            const startDateEl = document.getElementById('filter-start-date');
            const endDateEl = document.getElementById('filter-end-date');
            if (startDateEl) startDateEl.value = startDate;
            if (endDateEl) endDateEl.value = endDate;
        }
        
        if (startDate) {
            filteredData = filteredData.filter(record => 
                record.timestamp && record.timestamp.split('T')[0] >= startDate
            );
        }
        
        if (endDate) {
            filteredData = filteredData.filter(record => 
                record.timestamp && record.timestamp.split('T')[0] <= endDate
            );
        }
        
        if (employeeId && employeeId !== 'all') {
            filteredData = filteredData.filter(record => record.userId === employeeId);
        }
        
        if (type && type !== 'all') {
            filteredData = filteredData.filter(record => record.type === type);
        }
        
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 50px; color: var(--gray);">📭 Tidak ada data absensi</td></tr>';
            return;
        }
        
        let html = '';
        filteredData.slice(0, 100).forEach(record => {
            const date = new Date(record.timestamp);
            const timeStr = date.toLocaleString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // PRIORITAS: Gunakan photoBase64 yang ada di record
            let photoSrc = null;
            
            if (record.photoBase64) {
                // Foto langsung dari database (base64)
                photoSrc = record.photoBase64;
            } else if (record.photoId) {
                // Fallback ke localStorage
                photoSrc = localStorage.getItem(record.photoId);
            }
            
            html += `
                <tr>
                    <td>${timeStr}</td>
                    <td><strong>${record.userName || 'Unknown'}</strong></td>
                    <td>${record.userEmail || '-'}</td>
                    <td>
                        <span class="badge ${record.type === 'clockin' ? 'badge-in' : 'badge-out'}">
                            ${record.type === 'clockin' ? '📥 CLOCK IN' : '📤 CLOCK OUT'}
                        </span>
                    </td>
                    <td>${record.location?.address || '-'}</td>
                    <td>${record.location?.lat ? record.location.lat.toFixed(4) + ', ' + record.location.lng.toFixed(4) : '-'}</td>
                    <td>
                        ${photoSrc ? 
                            `<img src="${photoSrc}" 
                                  class="photo-thumb" 
                                  onclick="window.attendanceSystem.showPhotoBase64('${photoSrc}')"
                                  alt="Foto">` 
                            : '<span style="color: var(--gray);">📷 Tidak ada</span>'}
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
            // Buat calendar container jika belum ada
            this.createCalendarContainer();
        }
        
        this.updateCalendar();
    }
    
    createCalendarContainer() {
        const adminContainer = document.getElementById('admin-container');
        if (!adminContainer) return;
        
        // Cari elemen setelah stats-grid
        const statsGrid = document.querySelector('.stats-grid');
        if (!statsGrid) return;
        
        // Buat section calendar
        const calendarSection = document.createElement('div');
        calendarSection.className = 'calendar-section';
        calendarSection.innerHTML = `
            <div class="card" style="margin-bottom: 24px;">
                <div class="card-title">
                    <span>📅</span> Kalender Absensi
                </div>
                <div id="attendance-calendar" class="calendar-container"></div>
                <div id="calendar-legend" class="calendar-legend">
                    <span><span class="legend-dot" style="background: #06d6a0;"></span> Ada absensi</span>
                    <span><span class="legend-dot" style="background: #ef476f;"></span> Tidak ada absensi</span>
                    <span><span class="legend-dot" style="background: #4361ee;"></span> Hari ini</span>
                </div>
            </div>
        `;
        
        // Insert setelah stats-grid
        statsGrid.parentNode.insertBefore(calendarSection, statsGrid.nextSibling);
        
        // Tambahkan CSS untuk calendar
        this.addCalendarStyles();
        
        // Render calendar
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
        
        // Nama hari
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        
        // Header hari
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
        
        // Header hari
        days.forEach(day => {
            html += `<div class="calendar-header">${day}</div>`;
        });
        
        // Empty cells sebelum tanggal 1
        for (let i = 0; i < startDay; i++) {
            html += `<div class="calendar-day" style="background: transparent; cursor: default;"></div>`;
        }
        
        // Tanggal
        const today = new Date();
        const todayStr = today.toDateString();
        
        // Hitung absensi per tanggal
        const attendanceByDate = {};
        this.attendanceData.forEach(record => {
            const date = record.timestamp.split('T')[0];
            if (!attendanceByDate[date]) {
                attendanceByDate[date] = 0;
            }
            attendanceByDate[date]++;
        });
        
        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(year, month, d);
            const dateStr = date.toISOString().split('T')[0];
            const isToday = date.toDateString() === todayStr;
            const isSelected = this.currentCalendarDate.toDateString() === date.toDateString();
            const hasAttendance = attendanceByDate[dateStr] > 0;
            const attendanceCount = attendanceByDate[dateStr] || 0;
            
            let classes = 'calendar-day';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';
            if (hasAttendance) classes += ' has-attendance';
            
            html += `
                <div class="${classes}" onclick="window.attendanceSystem.selectDate('${dateStr}')">
                    <span class="day-number">${d}</span>
                    ${attendanceCount > 0 ? `<span class="attendance-count">${attendanceCount}</span>` : ''}
                </div>
            `;
        }
        
        html += '</div>';
        calendarEl.innerHTML = html;
    }
    
    selectDate(dateStr) {
        // Update current calendar date
        const [year, month, day] = dateStr.split('-').map(Number);
        this.currentCalendarDate = new Date(year, month - 1, day);
        
        // Update filter tanggal
        const startDateEl = document.getElementById('filter-start-date');
        const endDateEl = document.getElementById('filter-end-date');
        
        if (startDateEl) startDateEl.value = dateStr;
        if (endDateEl) endDateEl.value = dateStr;
        
        // Re-render calendar dan table
        this.updateCalendar();
        this.renderAttendanceTable();
        
        this.showNotification(`📅 Menampilkan data tanggal ${dateStr}`, 'info');
    }
    
    prevMonth() {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
        this.updateCalendar();
        
        // Reset filter tanggal
        const startDateEl = document.getElementById('filter-start-date');
        const endDateEl = document.getElementById('filter-end-date');
        
        if (startDateEl) startDateEl.value = '';
        if (endDateEl) endDateEl.value = '';
        
        this.renderAttendanceTable();
    }
    
    nextMonth() {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
        this.updateCalendar();
        
        // Reset filter tanggal
        const startDateEl = document.getElementById('filter-start-date');
        const endDateEl = document.getElementById('filter-end-date');
        
        if (startDateEl) startDateEl.value = '';
        if (endDateEl) endDateEl.value = '';
        
        this.renderAttendanceTable();
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
    }

    addMarkersToMap() {
        if (!this.map) return;
        
        // Clear existing markers
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // Get selected date from filter or use today
        let targetDate = new Date();
        const filterDate = document.getElementById('filter-start-date')?.value;
        if (filterDate) {
            targetDate = new Date(filterDate);
        }
        
        const targetDateStr = targetDate.toDateString();
        
        // Add markers for selected date
        const dateRecords = this.attendanceData.filter(record => {
            const recordDate = new Date(record.timestamp).toDateString();
            return recordDate === targetDateStr;
        });
        
        // Group by user and take latest
        const latestRecords = {};
        dateRecords.forEach(record => {
            if (!latestRecords[record.userId] || 
                new Date(record.timestamp) > new Date(latestRecords[record.userId].timestamp)) {
                latestRecords[record.userId] = record;
            }
        });
        
        Object.values(latestRecords).forEach(record => {
            if (record.location?.lat && record.location?.lng) {
                const marker = L.marker([record.location.lat, record.location.lng])
                    .addTo(this.map)
                    .bindPopup(`
                        <b>${record.userName || 'Karyawan'}</b><br>
                        ${record.type === 'clockin' ? '✅ Clock In' : '📤 Clock Out'}<br>
                        ${new Date(record.timestamp).toLocaleString('id-ID')}<br>
                        <small>${record.location.address || ''}</small>
                    `);
                
                this.mapMarkers.push(marker);
            }
        });
        
        // Fit bounds
        if (this.mapMarkers.length > 0) {
            const group = L.featureGroup(this.mapMarkers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
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
            
            let csv = 'Waktu,Karyawan,Email,Tipe,Lokasi,Koordinat\n';
            
            this.attendanceData.forEach(record => {
                const date = new Date(record.timestamp).toLocaleString('id-ID');
                const line = [
                    `"${date}"`,
                    `"${record.userName || ''}"`,
                    `"${record.userEmail || ''}"`,
                    record.type === 'clockin' ? 'CLOCK IN' : 'CLOCK OUT',
                    `"${(record.location?.address || '').replace(/"/g, '""')}"`,
                    record.location?.lat ? `${record.location.lat}, ${record.location.lng}` : ''
                ].join(',');
                
                csv += line + '\n';
            });
            
            // Download CSV
            const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `absensi_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            this.showNotification('✅ Export berhasil!', 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('❌ Gagal export data', 'error');
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    showPhoto(photoId) {
        // Method lama - untuk kompatibilitas
        const photo = localStorage.getItem(photoId);
        this.showPhotoBase64(photo);
    }
    
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
        
        // Render calendar setelah admin panel muncul
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
        const clockInBtn = document.getElementById('employee-clockin');
        const clockOutBtn = document.getElementById('employee-clockout');
        const captureBtn = document.getElementById('btn-capture');
        
        if (clockInBtn) {
            clockInBtn.addEventListener('click', () => this.clockIn());
        }
        
        if (clockOutBtn) {
            clockOutBtn.addEventListener('click', () => this.clockOut());
        }
        
        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.capturePhoto());
        }

        // Admin buttons
        const applyFilterBtn = document.getElementById('btn-apply-filter');
        const exportBtn = document.getElementById('btn-export-excel');
        
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', () => {
                this.renderAttendanceTable();
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
window.attendanceSystem = new EnterpriseAttendanceSystem();

window.showPhoto = function(photoId) {
    if (window.attendanceSystem) {
        window.attendanceSystem.showPhoto(photoId);
    }
};

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
