// app.js - Aplikasi Absensi Karyawan Modern

class AttendanceApp {
    constructor() {
        this.location = {
            lat: null,
            lng: null,
            address: 'Mendapatkan lokasi...'
        };
        this.currentPhoto = null;
        this.attendanceHistory = [];
        this.isCameraActive = false;
        this.videoStream = null;
        
        this.init();
    }

    init() {
        // Load data dari localStorage
        this.loadFromStorage();
        
        // Inisialisasi komponen
        this.initDateTime();
        this.initLocation();
        this.initCamera();
        this.initEventListeners();
        this.updateUI();
        
        // Update waktu setiap detik
        setInterval(() => this.updateDateTime(), 1000);
    }

    // ========== LOKASI ==========
    initLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.location.lat = position.coords.latitude;
                    this.location.lng = position.coords.longitude;
                    this.updateLocationDisplay();
                    this.reverseGeocode();
                },
                (error) => {
                    console.error('Error getting location:', error);
                    this.location.address = 'Gagal mendapatkan lokasi';
                    this.updateLocationDisplay();
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            this.location.address = 'Geolocation tidak didukung';
            this.updateLocationDisplay();
        }
    }

    reverseGeocode() {
        if (!this.location.lat || !this.location.lng) return;
        
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${this.location.lat}&lon=${this.location.lng}&zoom=18&addressdetails=1`)
            .then(response => response.json())
            .then(data => {
                if (data.display_name) {
                    this.location.address = data.display_name.split(', ').slice(0, 3).join(', ');
                    this.updateLocationDisplay();
                }
            })
            .catch(err => {
                console.error('Reverse geocode failed:', err);
                this.location.address = `${this.location.lat.toFixed(4)}, ${this.location.lng.toFixed(4)}`;
                this.updateLocationDisplay();
            });
    }

    // ========== KAMERA ==========
    async initCamera() {
        try {
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
            
            const videoElement = document.getElementById('videoElement');
            videoElement.srcObject = this.videoStream;
            this.isCameraActive = true;
        } catch (err) {
            console.error('Error accessing camera:', err);
            this.showNotification('Tidak dapat mengakses kamera', 'error');
        }
    }

    capturePhoto() {
        if (!this.isCameraActive) {
            this.showNotification('Kamera tidak aktif', 'error');
            return null;
        }

        const video = document.getElementById('videoElement');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const context = canvas.getContext('2d');
        // Mirror effect
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Simpan sebagai base64
        const photoData = canvas.toDataURL('image/jpeg', 0.9);
        this.currentPhoto = photoData;
        
        // Tampilkan foto yang diambil
        const capturedImage = document.getElementById('capturedImage');
        const container = document.getElementById('capturedImageContainer');
        capturedImage.src = photoData;
        container.classList.remove('hidden');
        
        return photoData;
    }

    // ========== DATE & TIME ==========
    initDateTime() {
        this.updateDateTime();
    }

    updateDateTime() {
        const now = new Date();
        
        // Format waktu
        const timeString = now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Format tanggal
        const dateString = now.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        document.getElementById('currentTime').textContent = timeString;
        document.getElementById('currentDate').textContent = dateString;
    }

    // ========== CLOCK IN/OUT ==========
    clockIn() {
        if (!this.validateClockAction()) return;
        
        // Cek apakah sudah clock in hari ini
        const today = new Date().toDateString();
        const hasClockedInToday = this.attendanceHistory.some(
            record => record.type === 'clockin' && 
            new Date(record.timestamp).toDateString() === today
        );
        
        if (hasClockedInToday) {
            this.showNotification('Anda sudah melakukan clock in hari ini', 'warning');
            return;
        }

        const record = this.createAttendanceRecord('clockin');
        this.attendanceHistory.unshift(record);
        this.saveToStorage();
        this.updateUI();
        this.showNotification('Clock in berhasil!', 'success');
    }

    clockOut() {
        if (!this.validateClockAction()) return;
        
        // Cek apakah sudah clock in hari ini
        const today = new Date().toDateString();
        const hasClockedInToday = this.attendanceHistory.some(
            record => record.type === 'clockin' && 
            new Date(record.timestamp).toDateString() === today
        );
        
        if (!hasClockedInToday) {
            this.showNotification('Anda belum clock in hari ini', 'warning');
            return;
        }

        // Cek apakah sudah clock out hari ini
        const hasClockedOutToday = this.attendanceHistory.some(
            record => record.type === 'clockout' && 
            new Date(record.timestamp).toDateString() === today
        );

        if (hasClockedOutToday) {
            this.showNotification('Anda sudah melakukan clock out hari ini', 'warning');
            return;
        }

        const record = this.createAttendanceRecord('clockout');
        this.attendanceHistory.unshift(record);
        this.saveToStorage();
        this.updateUI();
        this.showNotification('Clock out berhasil!', 'success');
    }

    validateClockAction() {
        if (!this.location.lat || !this.location.lng) {
            this.showNotification('Lokasi belum didapatkan', 'error');
            return false;
        }

        if (!this.currentPhoto) {
            this.showNotification('Silakan ambil foto terlebih dahulu', 'warning');
            return false;
        }

        return true;
    }

    createAttendanceRecord(type) {
        return {
            id: Date.now(),
            type: type,
            timestamp: new Date().toISOString(),
            location: {
                lat: this.location.lat,
                lng: this.location.lng,
                address: this.location.address
            },
            photo: this.currentPhoto
        };
    }

    // ========== STORAGE ==========
    saveToStorage() {
        localStorage.setItem('attendanceHistory', JSON.stringify(this.attendanceHistory));
        localStorage.setItem('lastPhoto', this.currentPhoto || '');
    }

    loadFromStorage() {
        // Load history
        const savedHistory = localStorage.getItem('attendanceHistory');
        if (savedHistory) {
            this.attendanceHistory = JSON.parse(savedHistory);
        }

        // Load last photo
        const savedPhoto = localStorage.getItem('lastPhoto');
        if (savedPhoto) {
            this.currentPhoto = savedPhoto;
            const capturedImage = document.getElementById('capturedImage');
            const container = document.getElementById('capturedImageContainer');
            if (capturedImage) {
                capturedImage.src = savedPhoto;
                container.classList.remove('hidden');
            }
        }
    }

    // ========== UI UPDATE ==========
    updateUI() {
        this.updateStatusBadge();
        this.updateHistoryList();
        this.updateLastAttendance();
    }

    updateLocationDisplay() {
        const addressEl = document.getElementById('locationAddress');
        const coordsEl = document.getElementById('locationCoords');
        
        if (addressEl) addressEl.textContent = this.location.address;
        if (coordsEl && this.location.lat && this.location.lng) {
            coordsEl.textContent = `${this.location.lat.toFixed(4)}, ${this.location.lng.toFixed(4)}`;
        }
    }

    updateStatusBadge() {
        const statusEl = document.getElementById('currentStatus');
        if (!statusEl) return;

        const today = new Date().toDateString();
        const hasClockedIn = this.attendanceHistory.some(
            record => record.type === 'clockin' && 
            new Date(record.timestamp).toDateString() === today
        );
        const hasClockedOut = this.attendanceHistory.some(
            record => record.type === 'clockout' && 
            new Date(record.timestamp).toDateString() === today
        );

        if (hasClockedIn && !hasClockedOut) {
            statusEl.className = 'status-badge status-active';
            statusEl.innerHTML = '✅ Sedang bekerja';
        } else if (hasClockedIn && hasClockedOut) {
            statusEl.className = 'status-badge status-inactive';
            statusEl.innerHTML = '⌛ Sudah clock out';
        } else {
            statusEl.className = 'status-badge status-inactive';
            statusEl.innerHTML = '⏳ Belum clock in';
        }
    }

    updateHistoryList() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        if (this.attendanceHistory.length === 0) {
            historyList.innerHTML = '<div class="empty-history">📭 Belum ada riwayat absensi</div>';
            return;
        }

        let html = '';
        this.attendanceHistory.slice(0, 10).forEach(record => {
            const date = new Date(record.timestamp);
            const timeStr = date.toLocaleTimeString('id-ID');
            const dateStr = date.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });

            html += `
                <div class="history-item ${record.type}">
                    <div class="history-time">${timeStr} • ${dateStr}</div>
                    <span class="history-type type-${record.type}">
                        ${record.type === 'clockin' ? 'CLOCK IN' : 'CLOCK OUT'}
                    </span>
                    <div class="history-location">
                        📍 ${record.location.address || 'Lokasi tidak diketahui'}
                    </div>
                    ${record.photo ? `<img src="${record.photo}" class="history-photo" alt="Photo">` : ''}
                </div>
            `;
        });

        historyList.innerHTML = html;
    }

    updateLastAttendance() {
        const lastAttendanceEl = document.getElementById('lastAttendance');
        if (!lastAttendanceEl) return;

        if (this.attendanceHistory.length === 0) {
            lastAttendanceEl.innerHTML = '<span style="color: #9ca3af;">Belum ada absensi</span>';
            return;
        }

        const last = this.attendanceHistory[0];
        const date = new Date(last.timestamp);
        const timeStr = date.toLocaleTimeString('id-ID');
        const dateStr = date.toLocaleDateString('id-ID');

        lastAttendanceEl.innerHTML = `
            <div style="background: #f3f4f6; padding: 0.8rem; border-radius: 12px;">
                <span style="font-weight: 600; color: #374151;">
                    ${last.type === 'clockin' ? '📥 Clock In' : '📤 Clock Out'}
                </span>
                <div style="font-size: 0.9rem; color: #6b7280; margin-top: 0.3rem;">
                    ${timeStr} - ${dateStr}
                </div>
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        // Simple alert for now
        alert(message);
    }

    // ========== EVENT LISTENERS ==========
    initEventListeners() {
        // Clock In button
        const clockInBtn = document.getElementById('clockInBtn');
        if (clockInBtn) {
            clockInBtn.addEventListener('click', () => this.clockIn());
        }

        // Clock Out button
        const clockOutBtn = document.getElementById('clockOutBtn');
        if (clockOutBtn) {
            clockOutBtn.addEventListener('click', () => this.clockOut());
        }

        // Capture button
        const captureBtn = document.getElementById('captureBtn');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.capturePhoto());
        }

        // Cleanup camera on page unload
        window.addEventListener('beforeunload', () => {
            if (this.videoStream) {
                this.videoStream.getTracks().forEach(track => track.stop());
            }
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.attendanceApp = new AttendanceApp();
});
