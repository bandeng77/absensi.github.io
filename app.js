// Konfigurasi Firebase
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

// APLIKASI ABSENSI ENTERPRISE
class EnterpriseAttendanceSystem {
    constructor() {
        this.currentUser = null;
        this.userRole = null;
        this.attendanceData = [];
        this.employeesData = [];
        this.currentPhoto = null;
        this.locationData = { lat: null, lng: null, address: 'Memuat...' };
        this.cameraStream = null;
        this.map = null;
        this.mapMarkers = [];
        
        this.initialize();
    }

    async initialize() {
        console.log('🚀 Inisialisasi Enterprise System...');
        
        // Setup auth state listener
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.handleAuthStateChange(user);
            } else {
                this.showLoginPage();
            }
            this.hideLoading();
        });

        // Setup event listeners
        this.setupEventListeners();
    }

    // ============= AUTHENTICATION =============
    async handleAuthStateChange(user) {
        try {
            // Get user role from Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    ...userDoc.data()
                };
                
                this.userRole = this.currentUser.role;
                
                // Update UI berdasarkan role
                if (this.userRole === 'admin') {
                    this.showAdminPanel();
                    await this.loadAdminData();
                } else {
                    this.showEmployeePanel();
                    this.startEmployeeFeatures();
                }
                
                this.updateUserDisplay();
                this.showNotification(`Selamat datang, ${this.currentUser.name || this.currentUser.email}!`, 'success');
            } else {
                // Create default user if not exists
                await this.createUserProfile(user);
            }
        } catch (error) {
            console.error('Error loading user:', error);
            this.showNotification('Gagal memuat data user', 'error');
        }
    }

    async createUserProfile(user) {
        const role = localStorage.getItem('selectedRole') || 'karyawan';
        const name = prompt('Masukkan nama Anda:') || user.email.split('@')[0];
        
        const userData = {
            name: name,
            email: user.email,
            role: role,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        
        await db.collection('users').doc(user.uid).set(userData);
        this.currentUser = { uid: user.uid, ...userData };
        this.userRole = role;
        
        if (role === 'admin') {
            this.showAdminPanel();
            await this.loadAdminData();
        } else {
            this.showEmployeePanel();
            this.startEmployeeFeatures();
        }
    }

    async login(email, password, role) {
        try {
            this.showLoading();
            localStorage.setItem('selectedRole', role);
            
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            console.log('Login success:', userCredential.user.email);
            
        } catch (error) {
            console.error('Login error:', error);
            
            if (error.code === 'auth/user-not-found') {
                // Create new user
                try {
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    console.log('User created:', userCredential.user.email);
                } catch (createError) {
                    this.showNotification('Gagal membuat akun: ' + createError.message, 'error');
                }
            } else {
                this.showNotification('Login gagal: ' + error.message, 'error');
            }
            
            this.hideLoading();
        }
    }

    logout() {
        auth.signOut().then(() => {
            this.currentUser = null;
            this.userRole = null;
            this.showLoginPage();
            this.stopCamera();
        });
    }

    // ============= EMPLOYEE FEATURES =============
    startEmployeeFeatures() {
        this.startRealTimeClock();
        this.getUserLocation();
        this.setupCamera();
        this.loadEmployeeTodayStatus();
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

    async clockIn() {
        if (!this.validateClockAction()) return;
        
        try {
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
                this.showNotification('Anda sudah clock in hari ini!', 'warning');
                return;
            }
            
            // Save photo to localStorage
            const photoId = `photo_${Date.now()}`;
            if (this.currentPhoto) {
                localStorage.setItem(photoId, this.currentPhoto);
            }
            
            // Create attendance record
            const attendanceRecord = {
                userId: this.currentUser.uid,
                userName: this.currentUser.name,
                userEmail: this.currentUser.email,
                type: 'clockin',
                timestamp: new Date().toISOString(),
                location: {
                    lat: this.locationData.lat,
                    lng: this.locationData.lng,
                    address: this.locationData.address
                },
                photoId: photoId,
                deviceInfo: navigator.userAgent
            };
            
            await db.collection('attendance').add(attendanceRecord);
            
            this.showNotification('✅ Clock In berhasil!', 'success');
            this.loadEmployeeTodayStatus();
            
        } catch (error) {
            console.error('Clock in error:', error);
            this.showNotification('Gagal clock in: ' + error.message, 'error');
        }
    }

    async clockOut() {
        if (!this.validateClockAction()) return;
        
        try {
            // Check if already clocked out today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Check if clocked in today
            const clockInSnapshot = await db.collection('attendance')
                .where('userId', '==', this.currentUser.uid)
                .where('type', '==', 'clockin')
                .where('timestamp', '>=', today.toISOString())
                .where('timestamp', '<', tomorrow.toISOString())
                .get();
            
            if (clockInSnapshot.empty) {
                this.showNotification('Anda belum clock in hari ini!', 'warning');
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
                this.showNotification('Anda sudah clock out hari ini!', 'warning');
                return;
            }
            
            // Save photo
            const photoId = `photo_${Date.now()}`;
            if (this.currentPhoto) {
                localStorage.setItem(photoId, this.currentPhoto);
            }
            
            // Create attendance record
            const attendanceRecord = {
                userId: this.currentUser.uid,
                userName: this.currentUser.name,
                userEmail: this.currentUser.email,
                type: 'clockout',
                timestamp: new Date().toISOString(),
                location: {
                    lat: this.locationData.lat,
                    lng: this.locationData.lng,
                    address: this.locationData.address
                },
                photoId: photoId,
                deviceInfo: navigator.userAgent
            };
            
            await db.collection('attendance').add(attendanceRecord);
            
            this.showNotification('✅ Clock Out berhasil!', 'success');
            this.loadEmployeeTodayStatus();
            
        } catch (error) {
            console.error('Clock out error:', error);
            this.showNotification('Gagal clock out: ' + error.message, 'error');
        }
    }

    // ============= ADMIN FEATURES =============
    async loadAdminData() {
        try {
            this.showLoading();
            
            // Load all employees
            const usersSnapshot = await db.collection('users').get();
            this.employeesData = [];
            usersSnapshot.forEach(doc => {
                this.employeesData.push({ id: doc.id, ...doc.data() });
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
                this.attendanceData.push({ id: doc.id, ...doc.data() });
            });
            
            // Update UI
            this.updateStatistics();
            this.populateEmployeeFilter();
            this.renderAttendanceTable();
            this.initMap();
            this.addMarkersToMap();
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Error loading admin data:', error);
            this.showNotification('Gagal memuat data admin', 'error');
            this.hideLoading();
        }
    }

    updateStatistics() {
        // Total karyawan
        document.getElementById('total-karyawan').textContent = this.employeesData.length;
        
        // Total absensi
        document.getElementById('total-absensi').textContent = this.attendanceData.length;
        
        // Clock in hari ini
        const today = new Date().toDateString();
        const todayClockIn = this.attendanceData.filter(record => {
            const recordDate = new Date(record.timestamp).toDateString();
            return recordDate === today && record.type === 'clockin';
        }).length;
        document.getElementById('hari-ini-clockin').textContent = todayClockIn;
        
        // Karyawan aktif hari ini
        const activeEmployees = new Set();
        this.attendanceData.forEach(record => {
            const recordDate = new Date(record.timestamp).toDateString();
            if (recordDate === today) {
                activeEmployees.add(record.userId);
            }
        });
        document.getElementById('aktif-hari-ini').textContent = activeEmployees.size;
    }

    populateEmployeeFilter() {
        const select = document.getElementById('filter-employee');
        select.innerHTML = '<option value="all">Semua Karyawan</option>';
        
        this.employeesData.forEach(emp => {
            select.innerHTML += `<option value="${emp.id}">${emp.name || emp.email}</option>`;
        });
    }

    async renderAttendanceTable() {
        const tbody = document.getElementById('table-body');
        let filteredData = [...this.attendanceData];
        
        // Apply filters
        const startDate = document.getElementById('filter-start-date').value;
        const endDate = document.getElementById('filter-end-date').value;
        const employeeId = document.getElementById('filter-employee').value;
        const type = document.getElementById('filter-type').value;
        
        if (startDate) {
            filteredData = filteredData.filter(record => record.timestamp >= startDate);
        }
        
        if (endDate) {
            filteredData = filteredData.filter(record => record.timestamp <= endDate + 'T23:59:59');
        }
        
        if (employeeId !== 'all') {
            filteredData = filteredData.filter(record => record.userId === employeeId);
        }
        
        if (type !== 'all') {
            filteredData = filteredData.filter(record => record.type === type);
        }
        
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 50px;">📭 Tidak ada data absensi</td></tr>';
            return;
        }
        
        let html = '';
        filteredData.slice(0, 100).forEach(record => {
            const date = new Date(record.timestamp);
            const timeStr = date.toLocaleString('id-ID');
            
            html += `
                <tr>
                    <td>${timeStr}</td>
                    <td><strong>${record.userName || 'Unknown'}</strong></td>
                    <td>${record.userEmail || '-'}</td>
                    <td>
                        <span class="badge ${record.type === 'clockin' ? 'badge-in' : 'badge-out'}">
                            ${record.type === 'clockin' ? 'CLOCK IN' : 'CLOCK OUT'}
                        </span>
                    </td>
                    <td>${record.location?.address || '-'}</td>
                    <td>${record.location?.lat ? record.location.lat.toFixed(4) + ', ' + record.location.lng.toFixed(4) : '-'}</td>
                    <td>
                        ${record.photoId ? 
                            `<img src="${localStorage.getItem(record.photoId) || 'default-avatar.jpg'}" 
                                  class="photo-thumb" 
                                  onclick="window.attendanceApp.showPhoto('${record.photoId}')">` 
                            : '-'}
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }

    initMap() {
        if (this.map) {
            this.map.remove();
        }
        
        this.map = L.map('attendance-map').setView([-6.2088, 106.8456], 11);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    addMarkersToMap() {
        // Clear existing markers
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];
        
        // Add markers for today's attendance
        const today = new Date().toDateString();
        const todayRecords = this.attendanceData.filter(record => {
            const recordDate = new Date(record.timestamp).toDateString();
            return recordDate === today;
        });
        
        // Group by user and take latest
        const latestRecords = {};
        todayRecords.forEach(record => {
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
                        ${record.location.address || ''}
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

    async exportToExcel() {
        try {
            this.showNotification('Menyiapkan data...', 'info');
            
            // Get filtered data
            await this.renderAttendanceTable();
            
            let csv = 'Waktu,Karyawan,Email,Tipe,Lokasi,Koordinat\n';
            
            this.attendanceData.forEach(record => {
                const date = new Date(record.timestamp).toLocaleString('id-ID');
                const line = [
                    date,
                    record.userName || '',
                    record.userEmail || '',
                    record.type === 'clockin' ? 'CLOCK IN' : 'CLOCK OUT',
                    record.location?.address || '',
                    record.location?.lat ? `${record.location.lat}, ${record.location.lng}` : ''
                ].join(',');
                
                csv += line + '\n';
            });
            
            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `absensi_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            
            this.showNotification('Export berhasil!', 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Gagal export data', 'error');
        }
    }

    // ============= UTILITY FUNCTIONS =============
    showPhoto(photoId) {
        const photo = localStorage.getItem(photoId);
        if (photo) {
            document.getElementById('modal-photo-img').src = photo;
            document.getElementById('photo-modal').classList.add('active');
        }
    }

    validateClockAction() {
        if (!this.locationData.lat || !this.locationData.lng) {
            this.showNotification('Lokasi belum tersedia', 'error');
            return false;
        }
        
        if (!this.currentPhoto) {
            this.showNotification('Ambil foto terlebih dahulu', 'warning');
            return false;
        }
        
        return true;
    }

    // ... (sertakan semua fungsi dari versi sebelumnya: 
    // startRealTimeClock, getUserLocation, getAddressFromCoordinates,
    // updateLocationDisplay, setupCamera, capturePhoto, updateEmployeeStatus,
    // showNotification, showLoading, hideLoading, dll)
}

// ============= EXPORT FUNCTIONS FOR GLOBAL ACCESS =============
window.showPhoto = function(photoId) {
    if (window.attendanceApp) {
        window.attendanceApp.showPhoto(photoId);
    }
};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.attendanceApp = new EnterpriseAttendanceSystem();
});
