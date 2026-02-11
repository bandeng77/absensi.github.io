// Data pengguna (dalam aplikasi nyata, ini akan diambil dari backend)
const users = [
    { id: 1, username: "user1", password: "pass123", name: "Budi Santoso", job: "Software Developer" },
    { id: 2, username: "user2", password: "pass123", name: "Siti Nurhaliza", job: "UI/UX Designer" },
    { id: 3, username: "user3", password: "pass123", name: "Agus Priyanto", job: "Project Manager" },
    { id: 4, username: "admin", password: "admin123", name: "Admin System", job: "Administrator", role: "admin" }
];

// Data absensi (disimpan di localStorage)
let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentPhoto = null;
let currentLocation = null;

// Fungsi untuk format tanggal
function formatDate(date = new Date()) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName}, ${day} ${month} ${year}`;
}

// Fungsi untuk format waktu
function formatTime(date = new Date()) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
}

// Fungsi untuk mendapatkan tanggal dalam format YYYY-MM-DD
function getDateString(date = new Date()) {
    return date.toISOString().split('T')[0];
}

// Login Page Logic
if (document.getElementById('loginBtn')) {
    const loginBtn = document.getElementById('loginBtn');
    
    loginBtn.addEventListener('click', function() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        
        // Validasi input
        if (!username || !password) {
            alert('Username dan password harus diisi!');
            return;
        }
        
        // Cari user
        const user = users.find(u => u.username === username && u.password === password);
        
        if (!user) {
            alert('Username atau password salah!');
            return;
        }
        
        // Simpan user yang login
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        // Redirect berdasarkan role
        if (role === 'admin' && user.username === 'admin') {
            window.location.href = 'admin.html';
        } else if (role === 'karyawan') {
            window.location.href = 'dashboard.html';
        } else {
            alert('Role tidak sesuai!');
        }
    });
}

// Dashboard Page Logic
if (document.getElementById('userName')) {
    // Inisialisasi dashboard
    document.addEventListener('DOMContentLoaded', function() {
        // Redirect ke login jika tidak ada user yang login
        if (!currentUser) {
            window.location.href = 'index.html';
            return;
        }
        
        // Tampilkan info user
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userJob').textContent = currentUser.job;
        document.getElementById('profileName').textContent = currentUser.name;
        document.getElementById('profileJob').textContent = currentUser.job;
        document.getElementById('profileId').textContent = `ID: ${currentUser.id}`;
        
        // Update waktu real-time
        updateDateTime();
        setInterval(updateDateTime, 1000);
        
        // Inisialisasi kamera
        initCamera();
        
        // Dapatkan lokasi
        getLocation();
        
        // Update status absensi
        updateAttendanceStatus();
        
        // Tampilkan riwayat
        displayAttendanceHistory();
        
        // Setup event listeners
        setupEventListeners();
    });
    
    // Fungsi untuk update waktu dan tanggal
    function updateDateTime() {
        const now = new Date();
        document.getElementById('currentTime').textContent = formatTime(now);
        document.getElementById('currentDate').textContent = formatDate(now);
    }
    
    // Fungsi untuk inisialisasi kamera
    function initCamera() {
        const video = document.getElementById('cameraPreview');
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user"
            }
        };
        
        // Akses kamera
        navigator.mediaDevices.getUserMedia(constraints)
            .then(function(stream) {
                video.srcObject = stream;
            })
            .catch(function(err) {
                console.error("Error mengakses kamera: ", err);
                document.getElementById('cameraPreview').style.display = 'none';
                document.querySelector('.camera-container').innerHTML = 
                    '<p style="color: white; text-align: center; padding-top: 130px;">Kamera tidak tersedia. Silakan gunakan upload foto manual.</p>';
            });
    }
    
    // Fungsi untuk mendapatkan lokasi
    function getLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    
                    currentLocation = {
                        latitude: lat,
                        longitude: lon,
                        address: `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`
                    };
                    
                    document.getElementById('locationDetails').textContent = 
                        `Lokasi berhasil dideteksi`;
                    document.getElementById('locationCoordinates').textContent = 
                        `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                    
                    // Reverse geocoding sederhana (simulasi)
                    setTimeout(() => {
                        const addresses = [
                            "Kantor Pusat, Jl. Sudirman No. 123, Jakarta",
                            "Kantor Cabang, Jl. Thamrin No. 45, Jakarta",
                            "Kantor Operasional, Jl. Gatot Subroto No. 67, Jakarta"
                        ];
                        const randomAddress = addresses[Math.floor(Math.random() * addresses.length)];
                        currentLocation.address = randomAddress;
                        document.getElementById('locationDetails').textContent = randomAddress;
                    }, 1000);
                },
                function(error) {
                    console.error("Error mendapatkan lokasi: ", error);
                    document.getElementById('locationInfo').innerHTML = 
                        '<p>Lokasi tidak dapat diakses. Pastikan izin lokasi diaktifkan.</p>';
                    
                    // Lokasi default jika gagal
                    currentLocation = {
                        latitude: -6.2088,
                        longitude: 106.8456,
                        address: "Jakarta, Indonesia (lokasi default)"
                    };
                }
            );
        } else {
            document.getElementById('locationInfo').innerHTML = 
                '<p>Geolocation tidak didukung oleh browser ini.</p>';
        }
    }
    
    // Fungsi untuk update status absensi
    function updateAttendanceStatus() {
        const today = getDateString();
        const todayAttendance = attendanceData.filter(record => 
            record.userId === currentUser.id && record.date === today
        );
        
        let hasCheckedIn = false;
        let hasCheckedOut = false;
        let checkInTime = null;
        let checkOutTime = null;
        
        if (todayAttendance.length > 0) {
            const checkInRecord = todayAttendance.find(record => record.type === 'masuk');
            const checkOutRecord = todayAttendance.find(record => record.type === 'pulang');
            
            if (checkInRecord) {
                hasCheckedIn = true;
                checkInTime = checkInRecord.time;
                document.getElementById('masukInfo').innerHTML = `
                    <p>Status: <span class="status done">Sudah Absen</span></p>
                    <p>Waktu: ${checkInRecord.time}</p>
                `;
                document.getElementById('absenMasukBtn').disabled = true;
            }
            
            if (checkOutRecord) {
                hasCheckedOut = true;
                checkOutTime = checkOutRecord.time;
                document.getElementById('pulangInfo').innerHTML = `
                    <p>Status: <span class="status done">Sudah Absen</span></p>
                    <p>Waktu: ${checkOutRecord.time}</p>
                `;
                document.getElementById('absenPulangBtn').disabled = true;
            }
        }
        
        // Enable tombol absen pulang jika sudah absen masuk
        if (hasCheckedIn && !hasCheckedOut) {
            document.getElementById('absenPulangBtn').disabled = false;
        }
        
        // Hitung statistik
        calculateStatistics();
    }
    
    // Fungsi untuk menghitung statistik
    function calculateStatistics() {
        const userAttendance = attendanceData.filter(record => record.userId === currentUser.id);
        const totalHadir = new Set(userAttendance.map(record => record.date)).size;
        
        // Hitung terlambat (absen masuk setelah jam 9:00)
        const totalTerlambat = userAttendance.filter(record => 
            record.type === 'masuk' && 
            parseInt(record.time.split(':')[0]) >= 9
        ).length;
        
        // Simulasikan data izin
        const totalIzin = Math.floor(Math.random() * 3);
        
        document.getElementById('totalHadir').textContent = totalHadir;
        document.getElementById('totalTerlambat').textContent = totalTerlambat;
        document.getElementById('totalIzin').textContent = totalIzin;
    }
    
    // Fungsi untuk menampilkan riwayat absensi
    function displayAttendanceHistory() {
        const historyTable = document.getElementById('attendanceHistory').getElementsByTagName('tbody')[0];
        historyTable.innerHTML = '';
        
        // Ambil data 7 hari terakhir
        const today = new Date();
        const last7Days = [];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            last7Days.push(getDateString(date));
        }
        
        // Filter data absensi untuk user ini dalam 7 hari terakhir
        const userAttendance = attendanceData.filter(record => 
            record.userId === currentUser.id && last7Days.includes(record.date)
        );
        
        // Tampilkan data
        last7Days.forEach(date => {
            const dateObj = new Date(date);
            const dayAttendance = userAttendance.filter(record => record.date === date);
            
            const checkIn = dayAttendance.find(record => record.type === 'masuk');
            const checkOut = dayAttendance.find(record => record.type === 'pulang');
            
            // Tentukan status
            let status = 'Tidak Absen';
            let statusClass = 'pending';
            
            if (checkIn && checkOut) {
                status = 'Hadir';
                statusClass = 'done';
            } else if (checkIn) {
                // Cek apakah terlambat
                const checkInHour = parseInt(checkIn.time.split(':')[0]);
                status = checkInHour >= 9 ? 'Terlambat' : 'Hadir (tanpa pulang)';
                statusClass = checkInHour >= 9 ? 'late' : 'done';
            }
            
            const row = historyTable.insertRow();
            row.innerHTML = `
                <td>${formatDate(dateObj)}</td>
                <td>${checkIn ? checkIn.time : '-'}</td>
                <td>${checkOut ? checkOut.time : '-'}</td>
                <td><span class="status ${statusClass}">${status}</span></td>
                <td>${checkIn ? (checkIn.location ? checkIn.location.address.substring(0, 20) + '...' : '-') : '-'}</td>
            `;
        });
    }
    
    // Fungsi untuk setup event listeners
    function setupEventListeners() {
        // Tombol logout
        document.getElementById('logoutBtn').addEventListener('click', function() {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
        
        // Tombol ambil foto
        document.getElementById('captureBtn').addEventListener('click', capturePhoto);
        
        // Tombol absen masuk
        document.getElementById('absenMasukBtn').addEventListener('click', function() {
            if (!currentPhoto) {
                alert('Harap ambil foto terlebih dahulu!');
                return;
            }
            
            checkIn();
        });
        
        // Tombol absen pulang
        document.getElementById('absenPulangBtn').addEventListener('click', function() {
            if (!currentPhoto) {
                alert('Harap ambil foto terlebih dahulu!');
                return;
            }
            
            checkOut();
        });
    }
    
    // Fungsi untuk mengambil foto
    function capturePhoto() {
        const video = document.getElementById('cameraPreview');
        const canvas = document.getElementById('photoCanvas');
        const photoPreview = document.getElementById('photoPreview');
        
        // Atur ukuran canvas sesuai video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Gambar frame video ke canvas
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Konversi ke data URL
        const photoData = canvas.toDataURL('image/jpeg');
        currentPhoto = photoData;
        
        // Tampilkan preview
        photoPreview.src = photoData;
        
        // Tampilkan notifikasi
        alert('Foto berhasil diambil!');
    }
    
    // Fungsi untuk absen masuk
    function checkIn() {
        const now = new Date();
        const currentTime = formatTime(now);
        const today = getDateString(now);
        
        // Cek apakah sudah absen hari ini
        const alreadyCheckedIn = attendanceData.some(record => 
            record.userId === currentUser.id && 
            record.date === today && 
            record.type === 'masuk'
        );
        
        if (alreadyCheckedIn) {
            alert('Anda sudah absen masuk hari ini!');
            return;
        }
        
        // Buat record absensi
        const attendanceRecord = {
            id: Date.now(),
            userId: currentUser.id,
            userName: currentUser.name,
            userJob: currentUser.job,
            date: today,
            time: currentTime,
            type: 'masuk',
            photo: currentPhoto,
            location: currentLocation,
            status: parseInt(currentTime.split(':')[0]) >= 9 ? 'terlambat' : 'hadir'
        };
        
        // Tambahkan ke data
        attendanceData.push(attendanceRecord);
        localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
        
        // Update UI
        updateAttendanceStatus();
        displayAttendanceHistory();
        
        // Reset foto
        currentPhoto = null;
        document.getElementById('photoPreview').src = '';
        
        alert(`Absen masuk berhasil pada pukul ${currentTime}`);
    }
    
    // Fungsi untuk absen pulang
    function checkOut() {
        const now = new Date();
        const currentTime = formatTime(now);
        const today = getDateString(now);
        
        // Cek apakah sudah absen masuk
        const hasCheckedIn = attendanceData.some(record => 
            record.userId === currentUser.id && 
            record.date === today && 
            record.type === 'masuk'
        );
        
        if (!hasCheckedIn) {
            alert('Anda belum absen masuk hari ini!');
            return;
        }
        
        // Cek apakah sudah absen pulang
        const alreadyCheckedOut = attendanceData.some(record => 
            record.userId === currentUser.id && 
            record.date === today && 
            record.type === 'pulang'
        );
        
        if (alreadyCheckedOut) {
            alert('Anda sudah absen pulang hari ini!');
            return;
        }
        
        // Buat record absensi
        const attendanceRecord = {
            id: Date.now(),
            userId: currentUser.id,
            userName: currentUser.name,
            userJob: currentUser.job,
            date: today,
            time: currentTime,
            type: 'pulang',
            photo: currentPhoto,
            location: currentLocation,
            status: 'hadir'
        };
        
        // Tambahkan ke data
        attendanceData.push(attendanceRecord);
        localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
        
        // Update UI
        updateAttendanceStatus();
        displayAttendanceHistory();
        
        // Reset foto
        currentPhoto = null;
        document.getElementById('photoPreview').src = '';
        
        alert(`Absen pulang berhasil pada pukul ${currentTime}`);
    }
}